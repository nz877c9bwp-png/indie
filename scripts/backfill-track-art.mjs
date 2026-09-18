// 추천곡 게시글에 있는 모든 곡을 유튜브에서 찾아 track_art 표에 미리 채워 넣는
// 백필 스크립트. 유튜브 검색(search.list)은 무료 할당량이 하루 10,000단위,
// 1회당 100단위라 하루에 최대 100번뿐이다. 한 번에 다 못 채우므로 하루치
// 분량(DAILY_CAP)만 처리하고, 이미 track_art에 있는 키는 건너뛰므로 매일
// 실행해도 안전하게 이어서 진행된다(.github/workflows/backfill-track-art.yml
// 이 매일 자동으로 실행한다).
//
// 이 스크립트는 서버(GitHub Actions)에서 돌아가는데, 사이트에 쓰는 유튜브 키는
// 브라우저 전용으로 "웹사이트 리퍼러가 duli.kr일 때만" 허용되게 제한돼 있어서
// 그 키를 그대로 쓸 수 없다. 그래서 리퍼러 제한이 없는 별도의 서버용 키를
// GEMINI_API_KEY와 같은 방식으로 GitHub Secret(YOUTUBE_API_KEY)에 넣어 쓴다.

const SUPABASE_URL = "https://jvitmimabxupkhrksudu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aXRtaW1hYnh1cGtocmtzdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU2NDEsImV4cCI6MjEwNDUzMTY0MX0.AD_7HM1C6xhKbXKKOwF6WSRfM1tPHfpj4McmMTJ0jNY";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const DAILY_CAP = 50; // 하루 100번 중 절반은 방문자가 실시간으로 검색하는 몫으로 남겨둔다
const APPLE_RETRY_CAP = 30; // 애플뮤직은 무료 API라 유튜브 할당량과 무관, 조금 더 넉넉하게

const sb = (path) => `${SUPABASE_URL}/rest/v1/${path}`;
const sbHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

async function fetchAllRecommendContent() {
  const res = await fetch(sb(`posts?tag=eq.${encodeURIComponent("추천곡")}&select=content`), {
    headers: sbHeaders,
  });
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status} ${await res.text()}`);
  return res.json();
}

function parseLines(content) {
  // app.js의 groupRecommendLines와 동일한 규칙: 하이픈 앞 공백은 필수("K-pop" 같은 단어 안
  // 하이픈과 구분하기 위해), 뒤 공백은 있어도 되고 없어도 된다.
  return (content || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s-\s*(.+)$/);
      if (!m) return null;
      return { artist: m[1].trim(), song: m[2].trim() };
    })
    .filter(Boolean);
}

async function fetchExistingKeys() {
  const res = await fetch(sb("track_art?select=key"), { headers: sbHeaders });
  if (!res.ok) throw new Error(`Failed to fetch track_art: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return new Set(rows.map((r) => r.key));
}

// 커버는 애플뮤직(iTunes) 정식 앨범아트를 먼저 쓴다 — 유튜브 썸네일은 뮤비 캡처라
// 곡마다 스타일이 제각각이라 목록이 지저분해 보인다(app.js의 searchTrackArt와 동일한
// 우선순위). previewUrl(30초 미리듣기, 로그인/키 불필요)과 trackViewUrl(애플뮤직
// 앱/웹 "전체 듣기" 링크)도 여기서 같이 얻어서 저장해둔다 — 사이트에서 곡 재생 시
// 유튜브/유튜브뮤직/애플뮤직 중 고를 수 있게 하는 기능에 쓰인다. 재생 링크(유튜브)는
// 애플뮤직만으로는 못 구하므로 유튜브 검색은 항상 순차로(동시에 X) 이어서 시도한다 —
// 애플뮤직도 무료지만 너무 빠르게 몰아치면 막힐 수 있어 순차 호출로 배려한다.
async function searchAppleMusicInfo(artist, song) {
  const term = encodeURIComponent(`${artist} ${song}`);
  for (const country of ["KR", "US"]) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&country=${country}&limit=1`);
      const data = await res.json();
      const r = data.results?.[0];
      if (r) {
        return {
          cover: r.artworkUrl100 || r.artworkUrl60 || null,
          previewUrl: r.previewUrl || null,
          trackUrl: r.trackViewUrl || null,
        };
      }
    } catch { /* 다음 국가로 */ }
  }
  return { cover: null, previewUrl: null, trackUrl: null };
}

async function searchYoutube(artist, song, apple) {
  const term = encodeURIComponent(`${artist} ${song}`);
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${term}&key=${YOUTUBE_API_KEY}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "youtube api error");
  const r = data.items?.[0];
  const videoId = r?.id?.videoId;
  if (!videoId) return null;
  const thumb = r.snippet?.thumbnails;
  return {
    cover: apple.cover || thumb?.high?.url || thumb?.medium?.url || thumb?.default?.url || null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    applePreviewUrl: apple.previewUrl,
    appleUrl: apple.trackUrl,
  };
}

// 유튜브는 이미 채워졌지만 애플뮤직 정보가 없는 기존 곡들 — 스키마에 애플뮤직
// 컬럼을 나중에 추가해서 그 전에 캐시된 곡들은 영영 채워질 기회가 없었다(track_art에
// 행이 있으면 재검색을 안 하니까). 유튜브 재검색은 필요 없어서(할당량 안 씀) 이건
// 별도로 소량씩 계속 재시도한다 — 지금은 애플뮤직 카탈로그에 없어도 나중에 입점되면
// 잡힐 수 있다.
async function fetchYoutubeOnlyMissingApple() {
  const res = await fetch(
    sb("track_art?select=key,artist,song&url=not.is.null&apple_preview_url=is.null&limit=" + APPLE_RETRY_CAP),
    { headers: sbHeaders }
  );
  if (!res.ok) throw new Error(`Failed to fetch apple-missing rows: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchAppleFields(key, apple) {
  const res = await fetch(sb(`track_art?key=eq.${encodeURIComponent(key)}`), {
    method: "PATCH",
    headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ apple_preview_url: apple.previewUrl, apple_url: apple.trackUrl }),
  });
  if (!res.ok) throw new Error(`Patch failed: ${res.status} ${await res.text()}`);
}

async function upsertTrackArt(key, artist, song, art) {
  const res = await fetch(sb("track_art"), {
    method: "POST",
    headers: {
      ...sbHeaders,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ key, artist, song, cover: art.cover, url: art.url, apple_preview_url: art.applePreviewUrl, apple_url: art.appleUrl }),
  });
  if (!res.ok) throw new Error(`Upsert failed: ${res.status} ${await res.text()}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is not set");

  const posts = await fetchAllRecommendContent();
  const allLines = posts.flatMap((p) => parseLines(p.content));
  const uniqueByKey = new Map();
  for (const { artist, song } of allLines) {
    uniqueByKey.set(`${artist}|${song}`, { artist, song });
  }
  console.log(`Total unique tracks across all 추천곡 posts: ${uniqueByKey.size}`);

  const existingKeys = await fetchExistingKeys();
  const remaining = [...uniqueByKey.entries()].filter(([key]) => !existingKeys.has(key));
  console.log(`Already cached: ${existingKeys.size}. Remaining: ${remaining.length}.`);

  if (remaining.length === 0) {
    console.log("Nothing left to backfill.");
    return;
  }

  const batch = remaining.slice(0, DAILY_CAP);
  console.log(`Processing ${batch.length} tracks this run (daily cap: ${DAILY_CAP}).`);

  let done = 0,
    notFound = 0,
    failed = 0;
  for (const [key, { artist, song }] of batch) {
    try {
      const apple = await searchAppleMusicInfo(artist, song);
      await sleep(200); // 애플뮤직 다음에 유튜브로, 순차적으로만 호출
      const art = await searchYoutube(artist, song, apple);
      if (!art) {
        notFound++;
        console.log(`No match: ${artist} - ${song}`);
      } else {
        await upsertTrackArt(key, artist, song, art);
        done++;
        console.log(`Cached: ${artist} - ${song} -> ${art.url}`);
      }
    } catch (err) {
      failed++;
      console.error(`Failed: ${artist} - ${song}:`, err.message);
      if (/quota/i.test(err.message)) {
        console.log("Quota exceeded — stopping this run early.");
        break;
      }
    }
    await sleep(300); // 너무 빠르게 몰아치지 않게 살짝 간격을 둔다
  }

  console.log(
    `Done. cached=${done} notFound=${notFound} failed=${failed}. ${remaining.length - done - notFound - failed} left for next run.`
  );

  // 2단계: 유튜브는 있는데 애플뮤직만 없는 기존 곡들을 소량 재시도.
  const appleMissing = await fetchYoutubeOnlyMissingApple();
  if (appleMissing.length === 0) {
    console.log("No youtube-only rows missing Apple Music info.");
    return;
  }
  console.log(`Retrying Apple Music info for ${appleMissing.length} existing rows.`);
  let appleFilled = 0, appleNotFound = 0;
  for (const { key, artist, song } of appleMissing) {
    try {
      const apple = await searchAppleMusicInfo(artist, song);
      if (apple.previewUrl || apple.trackUrl) {
        await patchAppleFields(key, apple);
        appleFilled++;
      } else {
        appleNotFound++;
      }
    } catch (err) {
      console.error(`Apple retry failed: ${artist} - ${song}:`, err.message);
    }
    await sleep(150);
  }
  console.log(`Apple retry done. filled=${appleFilled} stillMissing=${appleNotFound}`);
}

main().catch((err) => {
  console.error("backfill-track-art failed:", err);
  process.exit(1);
});
