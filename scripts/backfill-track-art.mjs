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
const DAILY_CAP = 80; // 100에서 여유를 두고, 방문자가 실시간으로 쓰는 몫도 남겨둔다

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
  return (content || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(" - ");
      if (idx === -1) return null;
      return { artist: line.slice(0, idx).trim(), song: line.slice(idx + 3).trim() };
    })
    .filter(Boolean);
}

async function fetchExistingKeys() {
  const res = await fetch(sb("track_art?select=key"), { headers: sbHeaders });
  if (!res.ok) throw new Error(`Failed to fetch track_art: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return new Set(rows.map((r) => r.key));
}

async function searchYoutube(artist, song) {
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
    cover: thumb?.high?.url || thumb?.medium?.url || thumb?.default?.url || null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function upsertTrackArt(key, artist, song, art) {
  const res = await fetch(sb("track_art"), {
    method: "POST",
    headers: {
      ...sbHeaders,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ key, artist, song, cover: art.cover, url: art.url }),
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
      const art = await searchYoutube(artist, song);
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
}

main().catch((err) => {
  console.error("backfill-track-art failed:", err);
  process.exit(1);
});
