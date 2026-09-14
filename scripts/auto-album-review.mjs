// GitHub Actions에서 매일 15~20시(KST) 매시 정각에 "체크"용으로 실행되는
// 앨범 평가 자동 등록 스크립트. 실제로는 평균 3일에 한 번, 그 6번의 체크 중
// 무작위로 뽑힌 시각에만 실제로 글을 쓴다 (아래 shouldPostNow 참고).
// Claude 클라우드 루틴은 샌드박스 네트워크 정책상 Supabase/iTunes에 접속이 막혀서
// 대신 GitHub Actions(제약 없는 아웃바운드)에서 직접 실행한다.
// 글 생성은 비용이 들지 않는 Gemini API 무료 티어를 쓴다. gemini-2.5-flash는
// 신규 사용자에게 더 이상 제공되지 않아 gemini-3.6-flash로 대체했는데, 이 모델은
// 텍스트 생성 자체는 무료지만 구글 검색 그라운딩은 무료 티어에서 보장되지 않아서
// (문서상 애매함) 검색 도구는 빼고 모델 자체 지식만으로 감상을 쓰게 한다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.6-flash";

const MIN_DAYS_BETWEEN_POSTS = 3;
// 이 6개는 워크플로 cron('0 6-11 * * *')이 호출되는 KST 시각과 정확히 일치해야 한다.
const DAILY_CHECK_HOURS_KST = [15, 16, 17, 18, 19, 20];

function nowInKst() {
  // UTC + 9시간
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 오늘 이 시각에 실제로 글을 쓸지 결정한다. 마지막 글 이후 3일이 안 지났으면 무조건 쉰다.
// 3일이 지났으면, 남은 체크 횟수 중 이번 차례가 뽑힐 확률을 1/n로 둬서
// 15~20시 사이 어느 시각이든 균등하게 뽑히게 하고, 마지막 체크(20시)까지 아무것도
// 안 뽑혔으면 그날은 무조건 그 시각에 쓰도록 강제한다(확률 1).
function shouldPostNow(daysSinceLastPost) {
  if (daysSinceLastPost < MIN_DAYS_BETWEEN_POSTS) {
    return { post: false, reason: `아직 ${daysSinceLastPost.toFixed(1)}일밖에 안 지남 (${MIN_DAYS_BETWEEN_POSTS}일 필요)` };
  }
  const kstHour = nowInKst().getUTCHours();
  const slotIndex = DAILY_CHECK_HOURS_KST.indexOf(kstHour);
  if (slotIndex === -1) {
    return { post: false, reason: `체크 시간대(${DAILY_CHECK_HOURS_KST.join(",")}시)가 아님, 현재 KST ${kstHour}시` };
  }
  const slotsRemaining = DAILY_CHECK_HOURS_KST.length - slotIndex;
  const roll = Math.random();
  const threshold = 1 / slotsRemaining;
  if (roll > threshold) {
    return { post: false, reason: `이번 시간대는 랜덤 추첨에서 안 뽑힘 (남은 기회 ${slotsRemaining}번)` };
  }
  return { post: true, reason: `당첨 (남은 기회 ${slotsRemaining}번 중 이번 차례)` };
}

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
      "posts?tag=eq.%EC%95%A8%EB%B2%94%20%ED%8F%89%EA%B0%80&select=title,content,album_title,album_artist,rating,created_at&order=id.desc&limit=15"
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

// 평점이 매번 4.5로만 몰리지 않게, 실제 리뷰처럼 호불호가 갈리도록 평점대와
// 그에 맞는 논조를 가중치를 둬서 무작위로 뽑는다. "좋다" 정도면 3점대, "극찬"이어도
// 보통 4점대에 그치게 전체 스케일을 낮췄고, 4.5~5.0은 정말 어쩌다 한 번만 나오게
// 가중치를 극단적으로 낮게 뒀다.
const RATING_PROFILES = [
  { min: 4.5, max: 5.0, weight: 0.05, stance: "정말 인생 앨범급으로 느낀, 좀처럼 안 나오는 최고 극찬 리뷰." },
  { min: 4.0, max: 4.5, weight: 0.18, stance: "정말 좋아서 극찬하는 리뷰. 구체적으로 뭐가 왜 좋았는지 짚어라." },
  { min: 3.0, max: 3.5, weight: 0.32, stance: "전반적으로 만족스러운, 좋았다는 리뷰. 아쉬운 점도 한두 가지 솔직하게 짚어도 됨." },
  { min: 2.0, max: 2.5, weight: 0.28, stance: "무난하거나 애매한 리뷰. 나쁘진 않은데 특별히 인상적이지도 않았다는 뉘앙스." },
  { min: 1.0, max: 1.5, weight: 0.17, stance: "기대했는데 실망한, 확실히 비판적인 리뷰. 음악적으로 구체적으로 뭐가 아쉬웠는지 써라(근거 없이 욕만 하지 말 것)." },
];
function pickRatingProfile() {
  const totalWeight = RATING_PROFILES.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const profile of RATING_PROFILES) {
    if (roll < profile.weight) return profile;
    roll -= profile.weight;
  }
  return RATING_PROFILES[0];
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
  const ratingProfile = pickRatingProfile();

  const prompt = `너는 한국 인디음악 커뮤니티 사이트 'Do U Like Indie'의 '앨범 평가' 게시판에 "인좋"이라는 유동(비로그인) 닉네임으로 글을 쓰는 실제 이용자다. "인좋"은 이 사이트 유동 이용자들의 기본 닉네임이라 여러 사람이 같이 쓰는 이름이다 — 그래서 매번 같은 사람처럼 보이지 않게 아래 지정된 말투를 반드시 지켜서 써야 한다.

이번 글에서 지켜야 할 말투: ${toneProfile}

이번 글의 평가 성향(반드시 따를 것 — 실제 리뷰들처럼 호불호가 갈려야 하니 매번 극찬만 하면 안 된다): ${ratingProfile.stance}
평점은 반드시 ${ratingProfile.min}~${ratingProfile.max} 사이(0.5 단위)에서 골라라. 리뷰 본문의 논조가 이 평점과 실제로 맞아야 한다 — 낮은 평점인데 칭찬 일색이거나, 높은 평점인데 비판 일색이면 안 된다.

이미 이 게시판에 올라온 앨범들(절대 중복 선택 금지):
${existingList || "(아직 없음)"}

기존 글들의 실제 문체(참고용, 그대로 베끼지 말 것 — 수위/격식만 참고):
${sampleContent || "(참고할 기존 글 없음)"}

할 일:
1. 위 목록에 없는 실제 인디 앨범을 하나 골라라. 네가 실제로 알고 있는(확신 있는) 앨범만 골라라. 한국 인디/얼터너티브 아티스트를 우선하되(실리카겔, 잔나비, 새소년, 혁오, 검정치마, 브로콜리너마저, 데이먼스이어, 한로로, 술탄오브더디스코, 카더가든, 디어클라우드 등), 해외 인디/얼터너티브도 괜찮다. 장르/아티스트/시대를 매번 다르게 골라라.
2. 네가 알고 있는 이 앨범의 실제 평가/평판/분위기를 바탕으로, 위에서 지정한 말투와 평가 성향으로 리뷰를 써라(전문 평론가 말투 아님, 그렇다고 일부러 허접하게 쓰지도 않음). 확신 없는 곡 제목이나 가사는 절대 지어내지/인용하지 말고, 실제 리뷰 문구를 베끼지도 마라. 길이/제목 스타일도 지정된 말투에 맞게 자연스럽게 정해라.

마지막 응답은 반드시 아래 형식의 JSON 객체 하나만 출력해라 (다른 텍스트 없이, 코드블록 없이, 마크다운 표시 없이):
{"album_artist": "아티스트명(영문 또는 원어 표기, iTunes 검색에 쓸 것)", "album_title": "앨범명", "title": "게시글 제목", "content": "리뷰 본문", "rating": 평점(${ratingProfile.min}~${ratingProfile.max} 사이, 0.5 단위 숫자)}`;

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

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3.0;
  return Math.min(5.0, Math.max(1.0, Math.round(n * 2) / 2));
}

async function main() {
  const { reviews: existing, totalCount } = await fetchExistingReviews();

  const forcePost = process.env.FORCE_POST === "true";
  if (forcePost) {
    console.log("FORCE_POST=true — 스케줄/랜덤 대기를 건너뛰고 즉시 작성한다 (수동 테스트).");
  } else {
    const lastPostAt = existing[0]?.created_at ? new Date(existing[0].created_at) : null;
    const daysSinceLastPost = lastPostAt ? (Date.now() - lastPostAt.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
    const decision = shouldPostNow(daysSinceLastPost);
    console.log("Schedule check:", decision.reason);
    if (!decision.post) return;

    // 당첨된 시간대(정각) 안에서도 매번 같은 분에 올라오지 않게, 최대 55분 랜덤 대기 후 작성한다.
    const delayMs = Math.floor(Math.random() * 55 * 60 * 1000);
    console.log(`Posting this run — waiting ${Math.round(delayMs / 60000)} minutes before writing.`);
    await sleep(delayMs);
  }

  const review = await generateReview(existing, totalCount);
  review.rating = clampRating(review.rating);
  console.log("Model picked:", review.album_artist, "-", review.album_title, "| rating:", review.rating);

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
