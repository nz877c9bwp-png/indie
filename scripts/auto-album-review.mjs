// 3시간마다 GitHub Actions에서 실행되는 앨범 평가 자동 등록 스크립트.
// Claude 클라우드 루틴은 샌드박스 네트워크 정책상 Supabase/iTunes에 접속이 막혀서
// 대신 GitHub Actions(제약 없는 아웃바운드)에서 직접 실행한다.
// 글 생성은 비용이 들지 않는 Gemini API 무료 티어를 쓴다. gemini-2.5-flash는
// 신규 사용자에게 더 이상 제공되지 않아 gemini-3.6-flash로 대체했는데, 이 모델은
// 텍스트 생성 자체는 무료지만 구글 검색 그라운딩은 무료 티어에서 보장되지 않아서
// (문서상 애매함) 검색 도구는 빼고 모델 자체 지식만으로 감상을 쓰게 한다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.6-flash";

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
    { headers: { ...sbHeaders, Prefer: "count=exact" } }
  );
  if (!res.ok) throw new Error(`Failed to read existing posts: ${res.status} ${await res.text()}`);
  const reviews = await res.json();
  // Content-Range: 0-14/57 형태 — "/" 뒤 숫자가 전체 개수. 말투 로테이션 계산에 쓴다.
  const totalCount = parseInt(res.headers.get("content-range")?.split("/")[1] ?? String(reviews.length), 10);
  return { reviews, totalCount };
}

// 전부 같은 닉네임(인좋)으로 올라가니, 매번 같은 사람이 쓴 것처럼 보이지 않게
// 글 2개마다 말투를 다른 프로필로 바꾼다. totalCount 기준으로 순환하므로
// 실행할 때마다 별도 상태 저장 없이도 일관되게 로테이션된다.
const TONE_PROFILES = [
  "텐션 높고 신난 팬 말투. 감탄사와 느낌표를 자주 쓰고 흥분한 티가 남.",
  "차분하고 살짝 시니컬한 말투. 문장 짧게 끊어 쓰고 과장하지 않음.",
  "친구한테 수다 떨듯 디테일하게 설명하는 말투. 문장이 길고 이것저것 덧붙임.",
  "무심한 듯 툭툭 던지는 말투. 문장 짧고 감정 표현 절제됨.",
  "잔잔하고 약간 감성적인 말투. 밤에 혼자 듣는 느낌으로 차분하게 씀.",
];
function pickToneProfile(totalCount) {
  const bucket = Math.floor(totalCount / 2) % TONE_PROFILES.length;
  return TONE_PROFILES[bucket];
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

async function generateReview(existingReviews, totalCount) {
  const existingList = existingReviews
    .map((p) => `- ${p.album_artist} - ${p.album_title} (평점 ${p.rating})`)
    .join("\n");
  const sampleContent = existingReviews
    .slice(0, 4)
    .map((p) => `[${p.title}]\n${p.content}`)
    .join("\n\n");
  const toneProfile = pickToneProfile(totalCount);

  const prompt = `너는 한국 인디음악 커뮤니티 사이트 'Do U Like Indie'의 '앨범 평가' 게시판에 "인좋"이라는 유동(비로그인) 닉네임으로 글을 쓰는 실제 이용자다. "인좋"은 이 사이트 유동 이용자들의 기본 닉네임이라 여러 사람이 같이 쓰는 이름이다 — 그래서 매번 같은 사람처럼 보이지 않게 아래 지정된 말투를 반드시 지켜서 써야 한다.

이번 글에서 지켜야 할 말투: ${toneProfile}

이미 이 게시판에 올라온 앨범들(절대 중복 선택 금지):
${existingList || "(아직 없음)"}

기존 글들의 실제 문체(참고용, 그대로 베끼지 말 것 — 수위/격식만 참고):
${sampleContent || "(참고할 기존 글 없음)"}

할 일:
1. 위 목록에 없는 실제 인디 앨범을 하나 골라라. 네가 실제로 알고 있는(확신 있는) 앨범만 골라라. 한국 인디/얼터너티브 아티스트를 우선하되(실리카겔, 잔나비, 새소년, 혁오, 검정치마, 브로콜리너마저, 데이먼스이어, 한로로, 술탄오브더디스코, 카더가든, 디어클라우드 등), 해외 인디/얼터너티브도 괜찮다. 장르/아티스트/시대를 매번 다르게 골라라.
2. 네가 알고 있는 이 앨범의 실제 평가/평판/분위기를 바탕으로, 위에서 지정한 말투로 리뷰를 써라(전문 평론가 말투 아님, 그렇다고 일부러 허접하게 쓰지도 않음). 확신 없는 곡 제목이나 가사는 절대 지어내지/인용하지 말고, 실제 리뷰 문구를 베끼지도 마라. 길이/평점/제목 스타일도 지정된 말투에 맞게 자연스럽게 정해라.

마지막 응답은 반드시 아래 형식의 JSON 객체 하나만 출력해라 (다른 텍스트 없이, 코드블록 없이, 마크다운 표시 없이):
{"album_artist": "아티스트명(영문 또는 원어 표기, iTunes 검색에 쓸 것)", "album_title": "앨범명", "title": "게시글 제목", "content": "리뷰 본문", "rating": 평점(1.0~5.0, 0.5 단위 숫자)}`;

  const finalText = await callGemini(prompt);
  return extractJson(finalText);
}

async function insertPost(review, coverUrl, albumTitle, albumArtist) {
  const guestPassword = Math.random().toString(36).slice(2, 12);
  const body = {
    tag: "앨범 평가",
    author: "인좋",
    title: review.title,
    content: review.content,
    guest_password: guestPassword,
    album_title: albumTitle,
    album_artist: albumArtist,
    album_cover: coverUrl,
    rating: review.rating,
  };

  // select=id,title로 반환 컬럼을 제한해야 한다 — anon 롤은 posts에 컬럼 단위
  // select 권한만 있고(guest_password 등은 제외) 테이블 전체 select 권한은 없어서,
  // return=representation이 기본값인 select=*로 RETURNING하려 하면 권한 오류가 난다.
  const res = await fetch(sb("posts?select=id,title"), {
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
  const { reviews: existing, totalCount } = await fetchExistingReviews();
  const review = await generateReview(existing, totalCount);
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
