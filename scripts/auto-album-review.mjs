// 3시간마다 GitHub Actions에서 실행되는 앨범 평가 자동 등록 스크립트.
// Claude 클라우드 루틴은 샌드박스 네트워크 정책상 Supabase/iTunes에 접속이 막혀서
// 대신 GitHub Actions(제약 없는 아웃바운드)에서 직접 실행한다.
// 글 생성은 비용이 들지 않는 Gemini API 무료 티어를 쓴다 (gemini-2.5-flash는
// 구글 검색 그라운딩까지 하루 500회 무료라 3시간마다 도는 이 작업엔 충분하다).

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

const SUPABASE_URL = "https://jvitmimabxupkhrksudu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aXRtaW1hYnh1cGtocmtzdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU2NDEsImV4cCI6MjEwNDUzMTY0MX0.AD_7HM1C6xhKbXKKOwF6WSRfM1tPHfpj4McmMTJ0jNY";

const sb = (path) => `${SUPABASE_URL}/rest/v1/${path}`;
const sbHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

async function fetchExistingReviews() {
  const res = await fetch(
    sb(
      "posts?tag=eq.%EC%95%A8%EB%B2%94%20%ED%8F%89%EA%B0%80&select=title,content,album_title,album_artist,rating&order=id.desc&limit=15"
    ),
    { headers: sbHeaders }
  );
  if (!res.ok) throw new Error(`Failed to read existing posts: ${res.status} ${await res.text()}`);
  return res.json();
}

async function searchItunes(artist, album) {
  const term = encodeURIComponent(`${artist} ${album}`);
  const res = await fetch(
    `https://itunes.apple.com/search?term=${term}&entity=album&country=US&limit=5`
  );
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const data = await res.json();
  return data.results?.[0] ?? null;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output: " + text.slice(0, 500));
  }
  return JSON.parse(text.slice(start, end + 1));
}

// Gemini의 /v1beta/interactions 응답은 steps[] 안에 model_output 타입 스텝이 있고,
// 그 안의 content[]에 {type:"text", text:"..."} 형태로 실제 텍스트가 들어있다.
// 정확한 중첩 구조가 문서마다 조금씩 다르게 보일 수 있어서, model_output 스텝을
// 우선 찾되 못 찾으면 응답 전체를 재귀적으로 훑어 text 조각을 다 모으는 방식으로
// 방어적으로 파싱한다.
function extractGeminiText(data) {
  const modelOutputSteps = (data.steps || []).filter((s) => s?.type === "model_output");
  if (modelOutputSteps.length) {
    const last = modelOutputSteps[modelOutputSteps.length - 1];
    const texts = (last.content || [])
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text);
    if (texts.length) return texts.join("\n");
  }

  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      if (node.type === "text" && typeof node.text === "string") found.push(node.text);
      Object.values(node).forEach(walk);
    }
  };
  walk(data);
  return found.join("\n");
}

async function callGemini(prompt) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: prompt,
      tools: [{ type: "google_search" }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(data)}`);

  const text = extractGeminiText(data);
  if (!text) {
    console.error("Full Gemini response (no text found):", JSON.stringify(data, null, 2));
    throw new Error("No text found in Gemini response");
  }
  return text;
}

async function generateReview(existingReviews) {
  const existingList = existingReviews
    .map((p) => `- ${p.album_artist} - ${p.album_title} (평점 ${p.rating})`)
    .join("\n");
  const sampleContent = existingReviews
    .slice(0, 4)
    .map((p) => `[${p.title}]\n${p.content}`)
    .join("\n\n");

  const prompt = `너는 한국 인디음악 커뮤니티 사이트 'Do U Like Indie'의 '앨범 평가' 게시판에 유동(비로그인) 닉네임으로 글을 쓰는 실제 이용자다.

이미 이 게시판에 올라온 앨범들(절대 중복 선택 금지):
${existingList || "(아직 없음)"}

기존 글들의 실제 문체(참고용, 그대로 베끼지 말 것 — 수위/격식만 참고):
${sampleContent || "(참고할 기존 글 없음)"}

할 일:
1. 위 목록에 없는 실제 인디 앨범을 하나 골라라. 한국 인디/얼터너티브 아티스트를 우선하되(실리카겔, 잔나비, 새소년, 혁오, 검정치마, 브로콜리너마저, 데이먼스이어, 한로로, 술탄오브더디스코, 카더가든, 디어클라우드 등), 해외 인디/얼터너티브도 괜찮다. 장르/아티스트/시대를 매번 다르게 골라라.
2. 검색을 활용해서 이 앨범에 대한 실제 리스너 반응/감상을 몇 개 찾아봐라 (커뮤니티, 스트리밍 서비스 리뷰, 블로그 등). 문구를 그대로 베끼지 말고, 실제 사람들이 이 앨범을 어떻게 느끼는지 감을 잡는 용도로만 써라.
3. 조사한 내용을 바탕으로, 위 기존 글들과 비슷한 톤(반말/구어체, 개인적인 감상, 전문 평론가 말투 아님, 그렇다고 일부러 허접하게 쓰지도 않음)으로 리뷰를 써라. 실제로 확인 못한 곡 제목은 지어내지 말고, 가사나 실제 리뷰 문구를 그대로 베끼지 마라. 길이/평점/제목 스타일은 매번 다르게.

마지막 응답은 반드시 아래 형식의 JSON 객체 하나만 출력해라 (다른 텍스트 없이, 코드블록 없이, 마크다운 표시 없이):
{"album_artist": "아티스트명(영문 또는 원어 표기, iTunes 검색에 쓸 것)", "album_title": "앨범명", "author": "유동 닉네임(짧고 자연스럽게)", "title": "게시글 제목", "content": "리뷰 본문", "rating": 평점(1.0~5.0, 0.5 단위 숫자)}`;

  const finalText = await callGemini(prompt);
  return extractJson(finalText);
}

async function insertPost(review, coverUrl, albumTitle, albumArtist) {
  const guestPassword = Math.random().toString(36).slice(2, 12);
  const body = {
    tag: "앨범 평가",
    author: review.author || "인좋",
    title: review.title,
    content: review.content,
    guest_password: guestPassword,
    album_title: albumTitle,
    album_artist: albumArtist,
    album_cover: coverUrl,
    rating: review.rating,
  };

  const res = await fetch(sb("posts"), {
    method: "POST",
    headers: {
      ...sbHeaders,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Insert failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const existing = await fetchExistingReviews();
  const review = await generateReview(existing);
  console.log("Model picked:", review.album_artist, "-", review.album_title);

  const itunesResult = await searchItunes(review.album_artist, review.album_title);
  if (!itunesResult?.artworkUrl100) {
    throw new Error(
      `No iTunes match for "${review.album_artist} - ${review.album_title}" — aborting rather than fabricate a cover.`
    );
  }
  const coverUrl = itunesResult.artworkUrl100.replace("100x100bb", "300x300bb");
  const albumTitle = itunesResult.collectionName;
  const albumArtist = itunesResult.artistName;

  const inserted = await insertPost(review, coverUrl, albumTitle, albumArtist);
  console.log("Inserted post:", JSON.stringify(inserted));
}

main().catch((err) => {
  console.error("auto-album-review failed:", err);
  process.exit(1);
});
