// Cloudflare Pages Function: duli.kr/board/{slug}/{id} 요청을 가로채서, 정적 index.html을
// 그대로 서빙하는 대신 해당 글의 제목/설명/앨범커버로 OG 메타태그를 채운 HTML을 돌려준다.
//
// 카카오톡/디스코드 같은 링크 미리보기 크롤러는 JS를 실행하지 않으므로, 클라이언트 라우팅
// (app.js의 routeFromPath)이 나중에 채워주는 <title>/og:*는 크롤러 입장에선 절대 보이지
// 않는다 — 그래서 이 서버 응답 시점에 이미 올바른 값이 박혀 있어야 한다.
//
// index.html의 기본 title/description 문구를 나중에 바꾸면, 아래 REPLACEMENTS의 원본
// 문자열도 같이 고쳐야 한다(안 고치면 조용히 치환이 안 먹고 기본 메타 그대로 나간다).
// 정규식 대신 리터럴 문자열 매칭을 쓴 이유는 페이지의 다른 부분을 실수로 건드릴 위험을
// 줄이기 위함이다.
//
// SUPABASE_URL/anon key는 app.js와 동일한 값을 그대로 복제했다 — 둘 다 RLS로만 보호되는
// 공개 anon key라 노출 자체는 문제 없지만, 앞으로 키를 회전시키면 여기도 같이 바꿔야 한다.
// 이 프로젝트엔 빌드 단계가 없어 app.js를 import할 수 없으므로 값 중복이 불가피하다.
const SUPABASE_URL = 'https://jvitmimabxupkhrksudu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aXRtaW1hYnh1cGtocmtzdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU2NDEsImV4cCI6MjEwNDUzMTY0MX0.AD_7HM1C6xhKbXKKOwF6WSRfM1tPHfpj4McmMTJ0jNY';

const DEFAULT_DESCRIPTION = '인디음악 좋아하는 사람들의 커뮤니티 게시판. 인디 게시판, 추천곡 공유, 앨범 평가, 공연 정보/후기까지.';
// 앨범 커버가 없는 게시판(자유/야구/장터 등) 글에 쓰는 기본 og:image. design-system은
// 정적 자산으로 같이 배포되므로 절대경로로 참조 가능하다.
const DEFAULT_OG_IMAGE = 'https://duli.kr/design-system/assets/Logos/app-icon.png';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// app.js가 본문 렌더링 때 [img]...[/img] 토큰과 URL을 걸러내는 것과 같은 취지의 경량 버전.
// 여긴 크롤러 미리보기용 짧은 요약만 만들면 되므로 완전히 동일할 필요는 없다.
function buildDescription(post) {
  const raw = String(post.content || '')
    .replace(/\[img\][\s\S]*?\[\/img\]/gi, ' ')
    .replace(/(https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = raw || post.title || DEFAULT_DESCRIPTION;
  return base.length > 100 ? base.slice(0, 100) + '…' : base;
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const postId = Number(params.id);

  // 정적 SPA 셸을 항상 베이스로 가져온다. _redirects의 SPA 폴백 규칙이 이 경로에도
  // 적용되므로, env.ASSETS.fetch(request)를 그대로 쓰면 index.html 내용이 온다.
  const assetResponse = await env.ASSETS.fetch(request);

  if (!Number.isInteger(postId) || postId <= 0) return assetResponse;

  let post = null;
  try {
    const apiUrl = `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=id,tag,title,content,album_title,album_artist,album_cover`;
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (res.ok) {
      const rows = await res.json();
      post = rows[0] || null;
    }
  } catch {
    // Supabase 호출이 실패해도 사이트가 죽으면 안 되니 조용히 기본 정적 메타로 폴백한다.
  }

  // 삭제된 글이거나 잘못된 id면 기존 정적 메타 그대로(사이트가 절대 깨지지 않게).
  if (!post) return assetResponse;

  const title = post.title || '너 인디 좋아해?';
  const description = buildDescription(post);
  const image = post.album_cover || DEFAULT_OG_IMAGE;
  const canonicalUrl = `https://duli.kr/board/${params.slug}/${postId}`;

  let html = await assetResponse.text();

  html = html
    .replace('<title>너 인디 좋아해?</title>', `<title>${escapeHtml(title)}</title>`)
    .replace(
      '<meta name="description" content="인디음악 좋아하는 사람들의 커뮤니티 게시판. 인디 게시판, 추천곡 공유, 앨범 평가, 공연 정보/후기까지 — 너 인디 좋아해?">',
      `<meta name="description" content="${escapeHtml(description)}">`
    )
    .replace('<link rel="canonical" href="https://duli.kr/">', `<link rel="canonical" href="${canonicalUrl}">`)
    .replace('<meta property="og:title" content="너 인디 좋아해?">', `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(
      '<meta property="og:description" content="인디음악 좋아하는 사람들의 커뮤니티 게시판. 인디 게시판, 추천곡 공유, 앨범 평가, 공연 정보/후기까지.">',
      `<meta property="og:description" content="${escapeHtml(description)}">`
    )
    .replace('<meta property="og:url" content="https://duli.kr/">', `<meta property="og:url" content="${canonicalUrl}">`)
    // og:image/twitter:image는 index.html에 원래 없던 태그라 "삽입"이 필요하다 —
    // 항상 존재가 보장된 og:locale/twitter:card 줄을 앵커로 삼아 끼워 넣는다.
    .replace(
      '<meta property="og:locale" content="ko_KR">',
      `<meta property="og:image" content="${image}">\n` +
      `<meta property="og:image:alt" content="${escapeHtml(title)}">\n` +
      '<meta property="og:locale" content="ko_KR">'
    )
    .replace(
      '<meta name="twitter:card" content="summary">',
      '<meta name="twitter:card" content="summary_large_image">\n' +
      `<meta name="twitter:title" content="${escapeHtml(title)}">\n` +
      `<meta name="twitter:description" content="${escapeHtml(description)}">\n` +
      `<meta name="twitter:image" content="${image}">`
    );

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      // 조회수/추천수 등은 크롤러 미리보기에 안 쓰이니 짧게만 캐시한다.
      'cache-control': 'public, max-age=60',
    },
  });
}
