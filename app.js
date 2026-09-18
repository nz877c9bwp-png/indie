// --- 공통 유틸리티 및 보안 ---
const $ = id => document.getElementById(id);
const toggleModal = (id, show) => $(id).style.display = show ? 'flex' : 'none';
const switchView = (view) => {
  ['postViewSection', 'albumDetailSection', 'boardSection', 'writeSection', 'myPageSection'].forEach(id => {
    $(id).style.display = (id === view + 'Section') ? 'block' : 'none';
  });
  window.scrollTo(0, 0);
};

// 모바일 햄버거 메뉴: 게시판 목록을 좌측 드로어로 열고 닫는다.
function toggleSidebarDrawer(open) {
  document.querySelector('.sidebar').classList.toggle('open', open);
  $('sidebarBackdrop').classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
$('mobileMenuBtn').addEventListener('click', () => toggleSidebarDrawer(true));
$('sidebarBackdrop').addEventListener('click', () => toggleSidebarDrawer(false));
document.querySelectorAll('.sidebar a').forEach(a => a.addEventListener('click', () => toggleSidebarDrawer(false)));

// 모바일에서는 좁은 상단바 대신 로그인/회원가입/마이페이지/로그아웃 버튼을 게시판 메뉴(드로어) 맨 위로 옮긴다.
// 같은 엘리먼트를 그대로 옮기는 거라(복제 아님) 기존 show/hide, onclick 로직이 그대로 유지된다.
// (예전엔 로그아웃만 빠져 있어서, 로그인 상태의 좁은 화면에서 로고+관리자 닉네임+로그아웃+글쓰기가
// 상단바 폭을 넘어 글쓰기 버튼이 화면 밖으로 밀려나는 문제가 있었다.)
const authRelocateButtons = [$('showLoginBtn'), $('showSignupBtn'), $('myPageBtn'), $('logoutBtn')];
authRelocateButtons.forEach(btn => btn.addEventListener('click', () => toggleSidebarDrawer(false)));

const MOBILE_MENU_QUERY = window.matchMedia('(max-width: 840px)');
function relocateAuthButtons() {
  if (MOBILE_MENU_QUERY.matches) {
    const slot = $('sidebarAuthSlot');
    authRelocateButtons.forEach(btn => slot.appendChild(btn));
  } else {
    const headerActions = document.querySelector('.user-actions');
    const anchor = $('openWriteBtn');
    authRelocateButtons.forEach(btn => headerActions.insertBefore(btn, anchor));
  }
}
relocateAuthButtons();
MOBILE_MENU_QUERY.addEventListener('change', relocateAuthButtons);

// 비로그인(유동) 사용자의 추천 중복 방지용 로컬 캐시. 기기/브라우저 단위라 완벽하진 않지만
// 새로고침해도 유지되고, 서버에 사용자 식별자를 남기지 않는 선에서 "한 번만" 제약을 준다.
function getRecommendedCache() {
  try { return JSON.parse(localStorage.getItem('recommendedPosts') || '[]'); } catch { return []; }
}
function hasCachedRecommend(postId) { return getRecommendedCache().includes(postId); }
function addRecommendedCache(postId) {
  const cache = getRecommendedCache();
  if (!cache.includes(postId)) { cache.push(postId); try { localStorage.setItem('recommendedPosts', JSON.stringify(cache)); } catch {} }
}

// 비추천도 추천과 동일한 방식(유동은 로컬 캐시 1회 제한)으로 처리한다.
function getDislikedCache() {
  try { return JSON.parse(localStorage.getItem('dislikedPosts') || '[]'); } catch { return []; }
}
function hasCachedDislike(postId) { return getDislikedCache().includes(postId); }
function addDislikedCache(postId) {
  const cache = getDislikedCache();
  if (!cache.includes(postId)) { cache.push(postId); try { localStorage.setItem('dislikedPosts', JSON.stringify(cache)); } catch {} }
}

// XSS 방어: 악성 스크립트 태그 무력화
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

// --- Supabase 설정 ---
const SUPABASE_URL = 'https://jvitmimabxupkhrksudu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aXRtaW1hYnh1cGtocmtzdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU2NDEsImV4cCI6MjEwNDUzMTY0MX0.AD_7HM1C6xhKbXKKOwF6WSRfM1tPHfpj4McmMTJ0jNY';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_EMAIL = 'bkseungah010223@gmail.com';
// 앱스토어 심사 지침 1.2: 부적절한 내용을 걸러내는 최소한의 장치. 걸리면 등록을 막는다.
// ponytail: 단순 포함 검사라 우회는 쉽다. 실제 방어선은 신고 + 관리자 삭제.
const BANNED_WORDS = ['씨발', '시발', '병신', '좆까', '니미', '느금'];
const hasBannedWord = text => BANNED_WORDS.some(w => text.includes(w));
// 추천곡 트랙 커버가 iTunes(KR/US)에 없을 때 마지막으로 시도할 유튜브 검색용 키.
// 구글 클라우드 콘솔에서 "웹사이트 제한(https://duli.kr/*)" + "YouTube Data API v3만
// 허용"으로 제한해서 발급받은 키를 여기에 넣는다. 빈 문자열이면(키를 아직 안 넣었으면)
// 유튜브 검색 자체를 건너뛴다 — 이 리포를 포크해서 쓰는 다른 배포에서도 안전하게 동작한다.
const YOUTUBE_API_KEY = 'AIzaSyALwR11EPar0GDl__PIzSMHagT8ngQ8Ueo';

// --- 상태 관리 변수 ---
let currentPosts = [], currentCategory = '전체';
// 추천곡 글 중 아직 track_art에 안 채워진 곡이 하나라도 있으면, 그 글을 열어보는 것만으로
// 방문자가 실시간 유튜브 검색(할당량 소모)을 트리거하게 된다. 백필이 다 끝나기 전까지는
// 그런 글 자체를 목록/HOT에서 숨겨서 아무도 실수로 못 열어보게 한다 — 백필이 매일 조금씩
// 채워나가면서 자연히 순차적으로 노출된다.
let trackArtKeys = new Set();
let genSortType = 'latest', genSortDir = 'desc';
let albSortType = 'review', albSortDir = 'desc';
let albumRenderCount = 12, lastAlbumSignature = null, albumObserver = null;
const ALBUMS_PER_PAGE = 12;
let currentReadPostId = null, currentUser = null, isAdmin = false, isEditMode = false;
let currentPage = 1;
const POSTS_PER_PAGE = 20;
let postSearchType = 'all', postSearchKeyword = '';
let tempAlbum = { title: null, artist: null, cover: null };
let currentSelectedRating = 5;
let currentComments = [];
let baseballTeamFilter = '전체';
let albumReleaseFilter = '정규';

// 트랙 수 기준으로 발매 형태를 추정한다(1~3=싱글, 4~6=EP, 7+=정규). iTunes가
// collectionName 자체에 "- EP"/"- Single"을 붙여주는 경우엔 그 표기를 우선한다 —
// 자동 리뷰 봇(scripts/auto-album-review.mjs)의 classifyReleaseType과 같은 기준이다.
function classifyReleaseType(itunesResult) {
  const name = itunesResult?.collectionName || '';
  if (/-\s*Single$/i.test(name)) return '싱글';
  if (/-\s*EP$/i.test(name)) return 'EP';
  const n = Number(itunesResult?.trackCount);
  if (!Number.isFinite(n)) return '정규';
  if (n <= 3) return '싱글';
  if (n <= 6) return 'EP';
  return '정규';
}

// 같이 갈 사람/장터는 카카오 로그인 사용자만 글을 쓸 수 있다 (서버 RLS에서도 동일하게 강제됨).
const RESTRICTED_TAGS = ['같이 갈 사람', '장터'];

// 게시판 이름을 짧게 보여주기 위한 화면 표시용 라벨. changeBoard/tag 값(DB에 저장된
// 실제 식별자, RLS·자동화 스크립트가 참조하는 값)은 그대로 두고, 목록의 말머리
// 태그나 메뉴처럼 자리가 좁은 곳에 보여줄 텍스트만 이걸로 바꿔치기한다.
const SHORT_BOARD_NAME = { '같이 갈 사람': '동행', '공연 정보': '정보', '공연 후기': '후기', '추천곡': '추천', '앨범 평가': '평가' };
const shortBoardName = name => SHORT_BOARD_NAME[name] || name;
const isKakaoUser = () => currentUser?.app_metadata?.provider === 'kakao';

// --- 야구 응원팀 정보 ---
const KBO_TEAMS = [
  { code: '두산', label: '두산 베어스', color: '#131230' },
  { code: 'LG',   label: 'LG 트윈스',   color: '#C30452' },
  { code: 'KT',   label: 'KT 위즈',     color: '#2C3E50' },
  { code: 'SSG',  label: 'SSG 랜더스',  color: '#CE0E2D' },
  { code: 'NC',   label: 'NC 다이노스', color: '#315288' },
  { code: '키움', label: '키움 히어로즈', color: '#820024' },
  { code: '삼성', label: '삼성 라이온즈', color: '#074CA1' },
  { code: '롯데', label: '롯데 자이언츠', color: '#041E42' },
  { code: '한화', label: '한화 이글스',   color: '#FF6600' },
  { code: 'KIA',  label: 'KIA 타이거즈', color: '#EA0029' },
];
const teamColor = code => KBO_TEAMS.find(t => t.code === code)?.color || 'var(--muted)';

function teamBadge(teamCode) {
  if (!teamCode) return null;
  const badge = element('span', 'team-badge', teamCode);
  badge.style.background = teamColor(teamCode);
  return badge;
}

// 카카오 로그인으로 작성된 글/댓글의 닉네임 옆에 붙는 작은 말풍선 마크.
function kakaoMark() {
  const mark = element('span', 'kakao-mark');
  mark.title = '카카오 로그인 사용자';
  mark.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 3C6.48 3 2 6.48 2 11c0 2.9 1.94 5.44 4.86 6.9-.2.75-.73 2.73-.84 3.15-.13.52.19.51.4.37.17-.11 2.66-1.8 3.74-2.54.6.09 1.22.13 1.84.13 5.52 0 10-3.48 10-8s-4.48-8-10-8z" fill="#FEE500"/></svg>';
  return mark;
}

// 유동(비로그인) 글/댓글에는 디시처럼 IP 앞 두 자리를 닉네임 옆에 보여준다. 닉네임이 같아도
// 다른 사람일 수 있으니, 이 정보로 구분하라는 취지 — 회원(user_id 있음)은 표시하지 않는다.
function ipTag(item) {
  if (!item || item.user_id || !item.ip_prefix) return null;
  return element('span', 'ip-tag', `(${item.ip_prefix})`);
}

// 관리자가 실제로 로그인한 상태로 쓴 글/댓글에는 닉네임과 무관하게 항상 이 뱃지를 붙인다.
// (닉네임만 "관리자 닉네임"과 똑같이 써도 이 뱃지는 서버가 저장한 is_admin_author로만 판정되므로 위조 불가)
function adminAuthorBadge() {
  return element('span', 'admin-post-badge', '관리자');
}

function renderBaseballTabs() {
  const wrap = $('baseballTeamTabs');
  const names = ['전체', ...KBO_TEAMS.map(t => t.code)];
  wrap.replaceChildren(...names.map(name => {
    const btn = element('button', `team-tab-btn${baseballTeamFilter === name ? ' active' : ''}`, name);
    btn.type = 'button';
    if (name !== '전체') btn.style.setProperty('--team-color', teamColor(name));
    btn.onclick = () => { baseballTeamFilter = name; renderBaseballTabs(); renderPosts(); };
    return btn;
  }));
}

// 앨범 평가 게시판을 싱글/EP/정규 3개로 나누는 탭. 야구 응원팀 탭과 같은 패턴이다 —
// 태그 자체는 계속 '앨범 평가' 하나로 유지하고(기존 로직을 그대로 쓰기 위해),
// release_type으로 한 번 더 필터링만 한다.
const ALBUM_RELEASE_TYPES = ['싱글', 'EP', '정규'];
function renderAlbumReleaseTabs() {
  const wrap = $('albumReleaseTabs');
  wrap.replaceChildren(...ALBUM_RELEASE_TYPES.map(type => {
    const btn = element('button', `team-tab-btn${albumReleaseFilter === type ? ' active' : ''}`, type);
    btn.type = 'button';
    btn.onclick = () => { albumReleaseFilter = type; renderAlbumReleaseTabs(); renderPosts(); };
    return btn;
  }));
}

// --- 요소 생성 및 포맷팅 ---
function element(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text; // textContent 사용으로 기본적 XSS 방어
  return node;
}

function imageUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\s<>"'\\]/.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username ? url.href : null; } catch { return null; }
}

function setImageSource(img, value) {
  const url = imageUrl(value);
  if (url) img.src = url; else img.removeAttribute('src');
}

function youtubeId(value) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username) return null;
    let id = ['youtube.com', 'www.youtube.com'].includes(url.hostname) ? 
             (url.pathname === '/watch' ? url.searchParams.get('v') : (url.pathname.startsWith('/embed/') ? url.pathname.slice(7) : null)) :
             (['youtu.be', 'www.youtu.be'].includes(url.hostname) ? url.pathname.slice(1) : null);
    return /^[a-zA-Z0-9_-]{11}$/.test(id ?? '') ? id : null;
  } catch { return null; }
}

const CONTENT_TOKEN_RE = /\[img\]([\s\S]*?)\[\/img\]|(?:[a-z][a-z0-9+.-]*:\/\/|(?:www\.)?(?:youtube\.com|youtu\.be)\/)\S+/gi;
function contentParts(value) {
  const text = String(value ?? ''), parts = [];
  let cursor = 0;
  for (const match of text.matchAll(CONTENT_TOKEN_RE)) {
    parts.push({ text: text.slice(cursor, match.index) });
    if (match[1] !== undefined) {
      const url = imageUrl(match[1]);
      parts.push(url ? { image: url } : { text: match[0] });
    } else {
      const candidate = match[0].replace(/[.,!?;:)]+$/, '');
      const id = (match.index === 0 || /[\s([{]/.test(text[match.index - 1])) ? youtubeId(candidate) : null;
      if (id) parts.push({ youtube: id }, { text: match[0].slice(candidate.length) });
      else parts.push({ text: match[0] });
    }
    cursor = match.index + match[0].length;
  }
  parts.push({ text: text.slice(cursor) });
  return parts;
}

function formatContent(value) {
  const fragment = document.createDocumentFragment();
  for (const part of contentParts(value)) {
    if (part.image) {
      const img = element('img'); setImageSource(img, part.image); fragment.append(img);
    } else if (part.youtube) {
      const wrapper = element('div', 'yt-wrapper'), iframe = element('iframe');
      iframe.src = `https://www.youtube.com/embed/${part.youtube}`; iframe.allowFullscreen = true;
      wrapper.append(iframe); fragment.append(wrapper);
    } else {
      // 텍스트 출력 시 HTML 이스케이프 적용
      fragment.append(document.createTextNode(part.text));
    }
  }
  return fragment;
}

function songCount(post) {
  return (post.content || '').split('\n').filter(l => l.trim()).length;
}

// 추천곡 게시글은 "언제 올렸는지"보다 "몇 곡 추천했는지"가 더 유용한 정보라
// 목록의 작성일 자리를 곡 수로 대체한다.
function dateOrSongCountLabel(post) {
  if (post.tag === '추천곡') return `${songCount(post)}곡`;
  return new Date(post.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');
}

// 추천곡 본문을 문단 텍스트가 아니라 스포티파이 플레이리스트 행처럼(커버+제목+
// 아티스트) 보여준다. "아티스트 - 곡명" 형식이면 곡마다 iTunes에서 커버/재생
// 시간을 찾아 채우고, 그 형식이 아닌 자유 코멘트 줄은 커버 없이 한 줄로 둔다.
// "아티스트 곡명|아티스트명" 조합으로 캐싱해서, 같은 글을 다시 열거나 같은
// 곡이 여러 글에 나와도 매번 다시 검색하지 않는다.
const recTrackArtCache = new Map();
let recTrackArtToken = 0;

// 같은 가수 곡들이 원문에서 뿔뿔이 흩어져 있으면 지저분해 보이니, 가수가 처음
// 등장한 순서를 기준으로 묶는다(안정 정렬 — 그룹 내부/그룹 순서 모두 원래 순서
// 유지). "아티스트 - 곡명" 형식이 아닌 자유 코멘트 줄은 어떤 그룹에도 안 섞이게
// 매번 고유 키를 줘서 원래 있던 자리 그대로 둔다.
function groupRecommendLines(lines) {
  // "아티스트 - 곡명"처럼 하이픈 앞뒤에 공백이 둘 다 있어야만 인식했는데, "아티스트 -곡명"처럼
  // 하이픈 뒤 공백을 빼먹으면 그냥 코멘트 줄로 취급돼 유튜브 매칭 자체가 시도되지 않았다
  // (실제로 겪은 사례: "실리카겔 -ryudejakeiru"). 하이픈 앞 공백은 "K-pop" 같은 단어 안
  // 하이픈과 구분하기 위해 여전히 필수로 두고, 뒤쪽 공백만 있어도 되고 없어도 되게 한다.
  const parsed = lines.map((line, i) => {
    const m = line.match(/^(.*?)\s-\s*(.+)$/);
    return m
      ? { line, artist: m[1].trim(), song: m[2].trim() }
      : { line, artist: null, song: null, soloKey: `__comment_${i}` };
  });
  const order = [];
  const groups = new Map();
  parsed.forEach(item => {
    const key = item.artist ?? item.soloKey;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(item);
  });
  return order.flatMap(key => groups.get(key));
}

function formatRecommendContent(content) {
  const lines = (content || '').split('\n').map(l => l.trim()).filter(Boolean);
  const list = element('ol', 'rec-tracklist');
  const rows = groupRecommendLines(lines).map(item => {
    const li = element('li', 'rec-track-row');
    const img = element('img', 'rec-track-art rec-track-art-empty');
    img.alt = '';
    const textWrap = element('div', 'rec-track-text');
    if (item.artist) {
      textWrap.append(element('div', 'rec-track-song', item.song), element('div', 'rec-track-artist', item.artist));
      li.dataset.artist = item.artist;
      li.dataset.song = item.song;
      li.classList.add('rec-track-clickable');
      li.addEventListener('click', () => toggleRecTrackPlayer(li));
    } else {
      li.classList.add('rec-track-comment');
      textWrap.append(element('div', 'rec-track-song', item.line));
    }
    li.append(img, textWrap);
    return li;
  });
  list.append(...rows);
  loadRecommendTrackArt(list, rows);
  return list;
}

function extractYoutubeId(url) {
  const m = url?.match(/[?&]v=([\w-]{11})/) || url?.match(/youtu\.be\/([\w-]{11})/);
  return m ? m[1] : null;
}

// 트랙을 클릭하면 새 탭으로 유튜브에 나가는 대신, 그 자리에서 바로 재생되게
// 임베드 플레이어를 펼친다(글 본문에 유튜브 링크를 붙이면 자동으로 영상이
// 뜨는 기존 기능과 같은 방식). 다시 클릭하면 접히고, 다른 곡을 클릭하면
// 동시에 여러 곡이 재생되지 않도록 먼저 열려있던 플레이어를 닫는다.
//
// 애플뮤직 정보(미리듣기/전체듣기 링크)가 있는 곡만 유튜브·유튜브뮤직·애플뮤직 중
// 고를 수 있는 탭을 보여준다 — 대부분의 곡(아직 애플뮤직이 안 채워진)은 지금처럼
// 클릭 한 번에 바로 유튜브가 재생된다.
function toggleRecTrackPlayer(li) {
  if (!li.dataset.url) return;
  const list = li.closest('.rec-tracklist, .ad-tracklist'); // 추천곡/앨범 평가 트랙리스트 둘 다 지원
  const alreadyOpen = li.nextElementSibling?.classList?.contains('rec-track-player-row') ? li.nextElementSibling : null;
  list.querySelectorAll('.rec-track-player-row').forEach((row) => row.remove());
  list.querySelectorAll('.rec-track-row.rec-track-playing').forEach((row) => row.classList.remove('rec-track-playing'));
  if (alreadyOpen) return; // 같은 곡을 다시 누른 거면 닫기만 하고 끝낸다.

  const playerRow = element('li', 'rec-track-player-row');
  li.insertAdjacentElement('afterend', playerRow);
  li.classList.add('rec-track-playing');

  const hasApple = li.dataset.applePreview || li.dataset.appleUrl;
  if (!hasApple) {
    renderYoutubeEmbed(playerRow, li.dataset.url);
    return;
  }

  const tabs = element('div', 'rec-service-tabs');
  const body = element('div', 'rec-service-body');
  const ytTab = element('button', 'rec-service-tab', '유튜브');
  const ytmTab = element('button', 'rec-service-tab', '유튜브뮤직');
  const appleTab = element('button', 'rec-service-tab', '애플뮤직');
  const setActive = (btn) => { tabs.querySelectorAll('.rec-service-tab').forEach((b) => b.classList.remove('active')); btn.classList.add('active'); };
  ytTab.onclick = () => { setActive(ytTab); renderYoutubeEmbed(body, li.dataset.url); };
  ytmTab.onclick = () => {
    const videoId = extractYoutubeId(li.dataset.url);
    if (videoId) window.open(`https://music.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
  };
  appleTab.onclick = () => { setActive(appleTab); renderApplePlayer(body, li.dataset.applePreview, li.dataset.appleUrl); };
  tabs.append(ytTab, ytmTab, appleTab);
  playerRow.append(tabs, body);
  ytTab.click(); // 기본값은 유튜브로 바로 재생
}

function renderYoutubeEmbed(container, url) {
  container.replaceChildren();
  const videoId = extractYoutubeId(url);
  if (!videoId) return;
  const wrapper = element('div', 'yt-wrapper');
  const iframe = element('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  iframe.allow = 'autoplay; encrypted-media; fullscreen';
  iframe.allowFullscreen = true;
  wrapper.append(iframe);
  container.append(wrapper);
}

// 애플뮤직은 로그인 없이 전체 곡을 재생할 방법이 없어서(구독 인증 필요), 30초
// 미리듣기를 바로 재생하고 "전체 듣기"는 애플뮤직 앱/웹으로 넘겨주는 링크로 대신한다.
function renderApplePlayer(container, previewUrl, appleUrl) {
  container.replaceChildren();
  const wrap = element('div', 'apple-player-wrap');
  if (previewUrl) {
    const audio = element('audio');
    audio.controls = true; audio.autoplay = true; audio.src = previewUrl;
    wrap.append(audio, element('div', 'apple-preview-note', '30초 미리듣기'));
  }
  if (appleUrl) {
    const link = element('a', 'apple-full-link', '애플뮤직에서 전체 듣기 →');
    link.href = appleUrl; link.target = '_blank'; link.rel = 'noopener';
    wrap.append(link);
  }
  container.append(wrap);
}

// 커버는 애플뮤직(iTunes) 정식 앨범아트를 먼저 쓴다 — 유튜브 썸네일은 뮤비 캡처라
// 곡마다 스타일이 제각각이라 목록이 지저분해 보인다. 재생 링크는 애플뮤직에 없으므로
// (30초 미리듣기뿐) 클릭하면 바로 들을 수 있게 유튜브 검색은 커버 유무와 무관하게
// 항상 시도한다 — 애플뮤직에 커버가 있으면 유튜브 썸네일은 버리고 애플뮤직 걸 쓴다.
//
// 순서: (1) 글쓰기 화면에서 사용자가 직접 고른 적 있는 곡인지 track_art 표를
// 먼저 확인 — 한 번 검증된 매칭은 항상 우선. (2) 애플뮤직(iTunes, KR→US)에서
// 커버/앨범/재생시간 조회 — 키가 필요 없고 순차로 호출한다. (3) 유튜브 검색
// (키가 설정돼 있으면) — 재생 링크를 얻고, 애플뮤직에 커버가 없었으면 유튜브
// 썸네일로 대체한다. 찾은 결과는 track_art에 저장해서 같은 곡을 다시 볼 때
// 할당량을 또 쓰지 않게 한다.
//
// Deezer 공개 검색도 시도해봤는데(키 없이 JSONP로 호출은 됨), 작은 국내
// 인디 곡은 카탈로그에 거의 없어서 엉뚱한 서양 곡을 "그럴듯하게" 잘못
// 매칭해주는 경우가 많아서(예: "김마리 - 비행소녀" -> 전혀 무관한
// "Kimmarie - Fly!") 뺐다 — iTunes도 같은 문제가 있어서(라자냐/Lasagna
// 사례) 여기 있는 어떤 자동 검색도 100% 정확하진 않다는 점은 감안해야 한다.
async function searchTrackArt(artist, song) {
  const key = `${artist}|${song}`;
  try {
    const { data } = await client.from('track_art').select('cover,album,duration_ms,url,apple_preview_url,apple_url').eq('key', key).maybeSingle();
    if (data) return { cover: data.cover, album: data.album, duration: formatTrackDuration(data.duration_ms), url: data.url, applePreviewUrl: data.apple_preview_url, appleUrl: data.apple_url };
  } catch { /* 조회 실패해도 자동 검색으로 계속 진행 */ }

  const term = encodeURIComponent(`${artist} ${song}`);

  // previewUrl(30초 미리듣기 mp3, 로그인/키 불필요)과 trackViewUrl(애플뮤직 앱/웹
  // 페이지 — "전체 듣기" 링크용)도 같이 뽑아둔다. 둘 다 재생 링크가 아니라 커버와
  // 마찬가지로 이 단계에서 바로 얻을 수 있는 정보라 유튜브 검색 성공 여부와 무관하게
  // 같이 저장한다.
  let itunesCover = null, itunesAlbum = null, itunesDuration = null, itunesPreviewUrl = null, itunesTrackUrl = null;
  for (const country of ['KR', 'US']) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&country=${country}&limit=1`);
      const data = await res.json();
      const r = data.results?.[0];
      if (r) {
        itunesCover = r.artworkUrl100 || r.artworkUrl60 || null; itunesAlbum = r.collectionName || null; itunesDuration = formatTrackDuration(r.trackTimeMillis);
        itunesPreviewUrl = r.previewUrl || null; itunesTrackUrl = r.trackViewUrl || null;
        break;
      }
    } catch { /* 다음 국가로 */ }
  }

  if (YOUTUBE_API_KEY) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${term}&key=${YOUTUBE_API_KEY}`);
      const data = await res.json();
      const r = data.items?.[0];
      const videoId = r?.id?.videoId;
      const thumb = r?.snippet?.thumbnails;
      if (videoId) {
        const art = {
          cover: itunesCover || thumb?.high?.url || thumb?.medium?.url || thumb?.default?.url || null,
          duration: itunesDuration, album: itunesAlbum,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          applePreviewUrl: itunesPreviewUrl, appleUrl: itunesTrackUrl,
        };
        client.from('track_art').upsert({ key, artist, song, cover: art.cover, url: art.url, apple_preview_url: art.applePreviewUrl, apple_url: art.appleUrl }).then(({ error }) => { if (error) console.error('track_art auto-cache 실패:', error.message); });
        return art;
      }
    } catch { /* 유튜브 실패(할당량 소진 등)해도 애플뮤직 결과만이라도 아래에서 반환 */ }
  }
  if (itunesCover) return { cover: itunesCover, album: itunesAlbum, duration: itunesDuration, url: null, applePreviewUrl: itunesPreviewUrl, appleUrl: itunesTrackUrl };
  return null;
}

// 한 글에 곡이 많으면(90곡 이상도 있음) 동시에 다 검색하지 않고 몇 개씩만
// 병렬로 처리한다. 사용자가 다른 글로 넘어가면 토큰이 바뀌어 남은 검색
// 결과는 화면에 반영하지 않는다.
async function loadRecommendTrackArt(list, rows) {
  const myToken = ++recTrackArtToken;
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const { artist, song } = row.dataset;
      if (!artist || !song) continue;
      const key = `${artist}|${song}`;
      let art = recTrackArtCache.get(key);
      if (art === undefined) {
        art = await searchTrackArt(artist, song);
        recTrackArtCache.set(key, art);
      }
      if (myToken !== recTrackArtToken) return;
      row.dataset.album = art?.album || '';
      if (art?.url) row.dataset.url = art.url;
      if (art?.applePreviewUrl) row.dataset.applePreview = art.applePreviewUrl;
      if (art?.appleUrl) row.dataset.appleUrl = art.appleUrl;
      const img = row.querySelector('.rec-track-art');
      if (art?.cover && img) {
        setImageSource(img, art.cover);
        img.classList.remove('rec-track-art-empty');
      }
      if (art?.duration) {
        row.querySelector('.rec-track-artist')?.append(document.createTextNode(` · ${art.duration}`));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, worker));
  // 검색이 다 끝난 뒤(collectionName을 다 알게 된 뒤) 같은 가수 안에서 같은
  // 앨범 곡들도 한 번 더 인접하게 재배치한다. 검색 중간중간 움직이면 산만해서
  // 한 번에 몰아서 정리한다.
  if (myToken === recTrackArtToken) regroupRecommendRowsByAlbum(list, rows);
}

function regroupRecommendRowsByAlbum(list, rows) {
  const order = [];
  const groups = new Map();
  rows.forEach((row, i) => {
    const key = row.dataset.artist ? `${row.dataset.artist}||${row.dataset.album || ''}` : `__solo_${i}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(row);
  });
  list.append(...order.flatMap(key => groups.get(key))); // 이미 리스트의 자식이라 append하면 위치만 옮겨진다
}

// 글쓰기 중 [img]/유튜브 링크가 텍스트 그대로 보이지 않도록, 실제 업로드 전에도 사진/영상을 미리 보여준다.
function updateContentPreview() {
  const content = $('postContent').value;
  const hasMedia = /\[img\]|youtube\.com|youtu\.be/i.test(content);
  $('contentPreviewWrap').style.display = hasMedia ? 'block' : 'none';
  $('contentPreviewArea').replaceChildren(hasMedia ? formatContent(content) : '');
}

const contentPreview = value => escapeHTML(contentParts(value).map(p => p.text ?? '').join('').substring(0, 150) + '...');

// 0.5 단위 평점을 4 -> "4", 4.5 -> "4.5" 처럼 불필요한 소수점 없이 표시.
const formatRating = v => { const n = Number(v); return n % 1 === 0 ? String(n) : n.toFixed(1); };

// 목록에 쓸 썸네일: 앨범 평가는 앨범 커버, 그 외는 본문에 첨부된 첫 이미지.
function firstThumbnail(post) {
  if (post.album_cover) return post.album_cover;
  const imagePart = contentParts(post.content).find(p => p.image);
  return imagePart ? imagePart.image : null;
}

// --- 인증 및 계정 설정 ---
// 카카오 등 소셜 로그인은 이메일 없이 가입될 수 있어 email.split('@')로 바로 닉네임을 뽑으면 안 된다.
function resolveNickname(user) {
  const meta = user?.user_metadata || {};
  return meta.nickname || meta.name || meta.full_name || user?.email?.split('@')[0] || '사용자';
}

client.auth.onAuthStateChange((event, session) => {
  const authorInput = $('postAuthor');
  if (session) {
    currentUser = session.user;
    const nickname = resolveNickname(currentUser);
    isAdmin = currentUser.email === ADMIN_EMAIL;
    
    const status = element('span', '', `${isAdmin ? '[관리자] ' : ''}${nickname}`);
    status.style.cssText = `color: var(--${isAdmin ? 'admin' : 'text'}); font-weight:bold;`;
    $('userStatus').replaceChildren(status, '님');

    $('showLoginBtn').style.display = $('showSignupBtn').style.display = 'none';
    $('logoutBtn').style.display = $('myPageBtn').style.display = 'inline-block';

    if(authorInput) authorInput.value = nickname;
  } else {
    currentUser = null; isAdmin = false;
    $('userStatus').replaceChildren();
    $('showLoginBtn').style.display = $('showSignupBtn').style.display = 'inline-block';
    $('logoutBtn').style.display = $('myPageBtn').style.display = 'none';
    if(authorInput) authorInput.value = '';
  }

  // 게시글을 열어둔 채로 로그인/로그아웃하면 수정/삭제 버튼, 댓글 삭제 버튼 등
  // isAdmin/currentUser에 의존하는 UI가 새로고침 전까지 로그인 이전 상태로 남아있던
  // 문제 — 지금 보고 있는 글이 있으면 그 화면을 다시 그려서 즉시 반영한다.
  // pushHistory=false라 히스토리/조회수 중복 카운트는 안 된다.
  if (currentReadPostId && $('postViewSection').style.display === 'block') {
    openPostView(currentReadPostId, false);
  }
});

$('doSignupBtn').addEventListener('click', async () => {
  const email = $('signupEmail').value, password = $('signupPw').value;
  if(!email || password.length < 6) return alert('이메일과 6자 이상 비밀번호가 필요합니다.');
  if(!$('signupConsent').checked) return alert('약관에 동의해주세요.');
  const { error } = await client.auth.signUp({ email, password });
  if(error) alert('실패: ' + error.message);
  else { alert('가입 완료'); toggleModal('signupModal', false); setTimeout(()=>client.auth.signInWithPassword({ email, password }), 1000); }
});

$('doLoginBtn').addEventListener('click', async () => {
  const { error } = await client.auth.signInWithPassword({ email: $('loginEmail').value, password: $('loginPw').value });
  if(error) alert('로그인 실패'); else toggleModal('loginModal', false);
});
$('loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('doLoginBtn').click(); });

// 카카오는 OAuth 특성상 로그인/회원가입이 동일한 호출이다 (처음 인증하면 자동으로 계정이 생성됨).
// Supabase는 카카오 로그인에 한해 scopes 옵션과 무관하게 account_email을 강제로 포함시키므로,
// 클라이언트에서 스코프를 좁혀도 KOE205를 피할 수 없다 (카카오 앱에 이메일 동의항목을 등록해야 해결됨).
async function kakaoAuth() {
  const { error } = await client.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: location.origin } });
  if (error) alert('카카오 인증 실패: ' + error.message);
}
$('kakaoLoginBtn').addEventListener('click', kakaoAuth);
$('kakaoSignupBtn').addEventListener('click', kakaoAuth);

// 앱스토어 심사 지침 4.8: 카카오 같은 소셜 로그인을 제공하면 Apple 로그인(또는 동급)을 같이 제공해야 한다.
// Supabase 대시보드에서 Apple 프로바이더를 켜야 동작한다 (설정 절차: docs/apple-signin-setup.md).
// 웹에서는 Supabase OAuth(리다이렉트)를 쓰고, iOS 앱 안에서는 Apple 공식 네이티브 로그인 창을 띄운 뒤
// 받은 id_token을 Supabase에 넘긴다. 웹뷰 안의 Apple 웹 로그인은 세션이 앱으로 안 넘어오고 심사에서도 문제 된다.
async function appleAuth() {
  const cap = window.Capacitor;
  // 페이지에 주입되는 Capacitor 브리지에는 registerPlugin이 없어서, 저수준 nativePromise로 플러그인을 직접 부른다.
  if (cap?.isNativePlatform?.() && cap.isPluginAvailable?.('SignInWithApple')) return appleAuthNative(opts => cap.nativePromise('SignInWithApple', 'authorize', opts));
  const { error } = await client.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: location.origin } });
  if (error) alert('Apple 인증 실패: ' + error.message);
}
async function appleAuthNative(authorize) {
  // Apple에는 nonce의 SHA-256을, Supabase에는 원본 nonce를 넘겨야 id_token 검증이 맞아떨어진다.
  const nonce = crypto.randomUUID();
  const hashed = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)))].map(b => b.toString(16).padStart(2, '0')).join('');
  let response;
  try {
    ({ response } = await authorize({ clientId: 'kr.duli.app', redirectURI: location.origin, scopes: 'email name', nonce: hashed }));
  } catch (e) {
    // 1001 = 사용자가 Apple 창을 닫음. 그 외는 설정/플러그인 문제라 그대로 보여준다.
    if (!/1001|cancel/i.test(e?.message || '')) alert('Apple 인증 실패: ' + (e?.message || e));
    return;
  }
  const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token: response.identityToken, nonce });
  if (error) return alert('Apple 인증 실패: ' + error.message);
  // Apple은 이름을 첫 로그인 때 한 번만 알려주므로 그때 닉네임으로 저장해 둔다.
  if (response.givenName) await client.auth.updateUser({ data: { nickname: (response.familyName || '') + response.givenName } });
  toggleModal('loginModal', false); toggleModal('signupModal', false);
}
const appleAuthSafe = () => appleAuth().catch(e => alert('Apple 인증 오류: ' + (e?.message || e)));
$('appleLoginBtn').addEventListener('click', appleAuthSafe);
$('appleSignupBtn').addEventListener('click', appleAuthSafe);

$('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); alert('로그아웃 됨'); });

// --- 글쓰기 및 앨범 검색 ---
// 브라우저 기본 select의 펼쳐진 목록은 CSS로 못 꾸미기 때문에, 원래 select는 값만 들고 있게 숨겨두고
// 화면에 보이는 목록은 사이트 톤에 맞춘 커스텀 UI로 그린다. 값/change 이벤트는 그대로라 나머지 코드는 손댈 필요가 없다.
let closeAllCustomSelects = () => {};

function makeCustomSelect(selectId) {
  const select = $(selectId);
  const wrap = element('div', 'custom-select');
  wrap.id = selectId + 'Custom';
  const trigger = element('div', 'custom-select-trigger');
  const panel = element('div', 'custom-select-panel');

  const syncTrigger = () => { trigger.textContent = select.selectedOptions[0]?.textContent || ''; };
  const closePanel = () => { panel.style.display = 'none'; };

  function optionItem(opt) {
    const classes = ['custom-select-option'];
    if (opt.disabled) classes.push('disabled');
    if (opt.value === select.value) classes.push('selected');
    const item = element('div', classes.join(' '), opt.textContent);
    if (!opt.disabled) item.onclick = () => {
      select.value = opt.value;
      select.dispatchEvent(new Event('change'));
      closePanel();
    };
    return item;
  }

  // 옵션의 비활성화 상태/문구가 로그인 상태에 따라 바뀌므로 열 때마다 새로 그린다.
  function openPanel() {
    closeAllCustomSelects();
    panel.replaceChildren();
    for (const node of select.children) {
      if (node.tagName === 'OPTGROUP') {
        panel.append(element('div', 'custom-select-group', node.label));
        for (const opt of node.children) panel.append(optionItem(opt));
      } else if (node.tagName === 'OPTION') {
        panel.append(optionItem(node));
      }
    }
    panel.style.display = 'block';
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (panel.style.display === 'block') closePanel(); else openPanel();
  };
  panel.onclick = (e) => e.stopPropagation();
  select.addEventListener('change', syncTrigger);

  const closeOthers = closeAllCustomSelects;
  closeAllCustomSelects = () => { closeOthers(); closePanel(); };

  wrap.append(trigger, panel);
  select.after(wrap);
  if (select.style.display === 'none') wrap.style.display = 'none'; // 원래 숨겨져 있던 select면 대체 UI도 숨긴 채로 시작
  select.style.display = 'none';
  syncTrigger();
}

document.addEventListener('click', () => closeAllCustomSelects());
makeCustomSelect('postTag');
makeCustomSelect('postTeam');

$('postTag').addEventListener('change', (e) => {
  const isAlbum = e.target.value === '앨범 평가';
  const isRecommend = e.target.value === '추천곡';
  const showAlbumSearch = isAlbum || isRecommend;
  const isBaseball = e.target.value === '야구';
  $('albumSearchWrap').style.display = showAlbumSearch ? 'block' : 'none';
  $('albumSearchLabel').textContent = isRecommend ? '커버를 가져올 곡/앨범 검색 (Apple Music, 선택)' : '평가할 앨범 검색 (Apple Music)';
  $('starInputWrapper').style.display = (isAlbum && tempAlbum.title) ? 'flex' : 'none';
  $('recTrackSearchWrap').style.display = isRecommend ? 'block' : 'none';
  if (!showAlbumSearch) tempAlbum = { title: null, artist: null, cover: null };
  $('postTeamCustom').style.display = isBaseball ? 'inline-block' : 'none';
  if (!isBaseball) { $('postTeam').value = ''; $('postTeam').dispatchEvent(new Event('change')); }
});

$('btnSearchAlbum').addEventListener('click', async () => {
  const query = escapeHTML($('albumQuery').value.trim()), searchType = $('searchType').value;
  if(!query) return alert('검색어를 입력하세요.');
  $('albumResults').innerHTML = '<div style="color:var(--muted); font-size:12px;">앨범 찾는 중...</div>';
  
  try {
    const queryTerm = encodeURIComponent(query).replace(/%20/g, '+');
    const attrParam = searchType !== 'all' ? `&attribute=${searchType}` : '';
    let res = await fetch(`https://itunes.apple.com/search?term=${queryTerm}&entity=album&country=KR${attrParam}&limit=30`);
    let data = await res.json();
    
    if(data.results.length === 0) {
      res = await fetch(`https://itunes.apple.com/search?term=${queryTerm}&entity=album&country=US${attrParam}&limit=30`);
      data = await res.json();
    }

    if(data.results.length === 0) { 
      $('albumResults').innerHTML = `<div style="color:var(--admin); font-size:13px;">결과가 없습니다. [가수명만]으로 변경하거나 영문으로 검색해보세요.</div>`; 
      return; 
    }

    $('albumResults').replaceChildren(...data.results.map(a => {
      const coverUrl = typeof a.artworkUrl100 === 'string' ? a.artworkUrl100.replace('100x100bb', '300x300bb') : '';
      const card = element('div', 'search-item');
      card.addEventListener('click', () => selectAlbum(a.collectionName, a.artistName, coverUrl, classifyReleaseType(a)));
      const img = element('img');
      img.addEventListener('error', () => img.src = 'https://via.placeholder.com/300x300?text=No+Image', { once: true });
      setImageSource(img, coverUrl);
      card.append(img, element('div', 's-title', a.collectionName), element('div', 's-artist', a.artistName));
      return card;
    }));
  } catch {
    $('albumResults').innerHTML = '<div style="color:var(--admin); font-size:12px;">검색 서버 오류입니다.</div>';
  }
});

window.selectAlbum = (title, artist, cover, releaseType) => {
  tempAlbum = { title, artist, cover: imageUrl(cover) };
  const isAlbumEval = $('postTag').value === '앨범 평가';
  $('selAlbumWrap').style.display = 'flex'; $('starInputWrapper').style.display = isAlbumEval ? 'flex' : 'none';
  setImageSource($('selCover'), tempAlbum.cover);
  $('selTitle').innerText = title; $('selArtist').innerText = artist;
  $('postReleaseType').value = releaseType || '정규';
  setStars(5);
};

// 추천곡 본문에 "아티스트 - 곡명" 줄을 자동 검색으로 추측해서 채우는 대신, 유튜브
// 검색 결과 중 사용자가 직접 골라서 추가하게 한다. 자동 검색이 가끔 제목만
// 비슷한 무관한 곡을 매칭하는 문제(예: "집토끼 - 라자냐"가 이탈리아 스톡뮤직으로
// 잘못 매칭됨)가 있어서, 직접 고른 곡의 영상 링크는 track_art 표에 저장해두고
// 이후로는 그 검증된 매칭을 자동 검색보다 우선해서 보여주고(클릭하면 그 링크로
// 바로 이동해 들을 수 있다). 유튜브 영상 제목엔 "(Official MV)" 같은 군더더기가
// 붙어있거나 가수/곡명이 안 나뉘어 있어서, 본문에 들어갈 "아티스트 - 곡명" 줄은
// 검색 결과가 아니라 사용자가 직접 입력한 두 칸(아티스트/곡명)에서 만든다.
$('btnSearchRecTrack').addEventListener('click', async () => {
  const artist = $('recTrackArtist').value.trim();
  const song = $('recTrackSong').value.trim();
  if (!artist || !song) return alert('아티스트와 곡명을 모두 입력하세요.');
  if (!YOUTUBE_API_KEY) return alert('유튜브 검색 키가 아직 설정되지 않았습니다.');
  $('recTrackResults').innerHTML = '<div style="color:var(--muted); font-size:12px;">곡 찾는 중...</div>';
  try {
    const term = encodeURIComponent(`${artist} ${song}`);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${term}&key=${YOUTUBE_API_KEY}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'youtube api error');
    if (!data.items?.length) {
      $('recTrackResults').innerHTML = '<div style="color:var(--admin); font-size:13px;">결과가 없습니다.</div>';
      return;
    }
    $('recTrackResults').replaceChildren(...data.items.map(v => {
      const thumb = v.snippet.thumbnails;
      const coverUrl = thumb?.medium?.url || thumb?.default?.url || '';
      const videoId = v.id.videoId;
      const card = element('div', 'search-item');
      card.addEventListener('click', () => pickRecTrack(artist, song, coverUrl, videoId));
      const img = element('img');
      setImageSource(img, coverUrl);
      card.append(img, element('div', 's-title', v.snippet.title), element('div', 's-artist', v.snippet.channelTitle));
      return card;
    }));
  } catch (e) {
    $('recTrackResults').innerHTML = `<div style="color:var(--admin); font-size:12px;">검색 실패: ${escapeHTML(e.message || '오류')}</div>`;
  }
});

window.pickRecTrack = async (artist, song, cover, videoId) => {
  const textarea = $('postContent');
  const line = `${artist} - ${song}`;
  textarea.value = textarea.value.trim() ? `${textarea.value}\n${line}` : line;
  $('recTrackResults').replaceChildren();

  const key = `${artist}|${song}`;
  const safeCover = imageUrl(cover);
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  recTrackArtCache.set(key, { cover: safeCover, album: null, duration: null, url });
  const { error } = await client.from('track_art').upsert({ key, artist, song, cover: safeCover, url });
  if (error) console.error('track_art upsert failed:', error.message);
};

// 별점을 0.5 단위로, 마우스/터치 드래그로 조절할 수 있게 한다.
function ratingFromClientX(clientX) {
  const rect = $('starsContainer').getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const stepped = Math.round(ratio * 5 * 2) / 2; // 0.5 단위로 반올림
  return Math.max(0.5, Math.min(5, stepped));
}

let isDraggingStars = false;
$('starsContainer').addEventListener('mousedown', (e) => {
  isDraggingStars = true;
  setStars(ratingFromClientX(e.clientX));
});
document.addEventListener('mousemove', (e) => {
  if (isDraggingStars) setStars(ratingFromClientX(e.clientX));
});
document.addEventListener('mouseup', () => { isDraggingStars = false; });

$('starsContainer').addEventListener('touchstart', (e) => {
  isDraggingStars = true;
  setStars(ratingFromClientX(e.touches[0].clientX));
}, { passive: true });
$('starsContainer').addEventListener('touchmove', (e) => {
  if (isDraggingStars) setStars(ratingFromClientX(e.touches[0].clientX));
}, { passive: true });
document.addEventListener('touchend', () => { isDraggingStars = false; });

function setStars(val) {
  currentSelectedRating = val;
  document.querySelectorAll('#starsContainer .star').forEach(s => {
    const fill = Math.max(0, Math.min(1, val - (parseInt(s.dataset.value) - 1)));
    s.querySelector('.star-fill').style.width = (fill * 100) + '%';
  });
  $('starRatingText').innerText = `${formatRating(val)}점`;
}

$('imageUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if(!file) return;
  $('btnImageUploadText').innerText = '업로드 중...';
  const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await client.storage.from('images').upload(fileName, file);
  if (error) return alert('실패: ' + error.message), $('btnImageUploadText').innerText = '사진 첨부';
  $('postContent').value += `\n[img]${client.storage.from('images').getPublicUrl(fileName).data.publicUrl}[/img]\n`;
  $('btnImageUploadText').innerText = '사진 첨부'; e.target.value = '';
  updateContentPreview();
});

$('postContent').addEventListener('input', updateContentPreview);

// 같이 갈 사람/장터는 카카오 로그인 사용자(또는 관리자)만 선택할 수 있게 드롭다운에서도 막는다.
function updateRestrictedTagOptions() {
  const eligible = isAdmin || isKakaoUser();
  RESTRICTED_TAGS.forEach(tag => {
    const opt = $('postTag').querySelector(`option[value="${tag}"]`);
    if (!opt) return;
    opt.disabled = !eligible;
    opt.textContent = eligible ? tag : `${tag} (카카오 로그인 필요)`;
  });
}

$('openWriteBtn').onclick = () => {
  isEditMode = false;
  $('writeSectionTitle').textContent = '새 글 작성하기'; $('savePostBtn').textContent = '등록하기';
  $('postTitle').value = ''; $('postContent').value = ''; $('postGuestPw').value = '';
  updateContentPreview();
  $('postGuestPw').style.display = currentUser ? 'none' : '';
  // 유동은 닉네임을 자유롭게 바꿔도 된다 — 어차피 닉네임은 아무나 똑같이 따라 쓸 수 있어서
  // "글쓴이" 판정이나 구분에는 전혀 쓰이지 않고(ip_prefix로만 구분), 닉네임을 바꾸더라도
  // ipTag()가 user_id 없는 글/댓글엔 무조건 IP를 붙여 보여준다.
  $('postAuthor').value = currentUser ? resolveNickname(currentUser) : '인좋';

  updateRestrictedTagOptions();
  // 보고 있던 게시판을 그대로 미리 선택해준다. 같이 갈 사람/장터라도 일단 선택은 되고,
  // 작성 권한이 없으면 옵션 자체에 "(카카오 로그인 필요)" 표시가 붙어 있고 제출 시점에도 다시 막는다.
  let targetTag = ['전체'].includes(currentCategory) ? '인디' : currentCategory;
  $('postTag').value = targetTag || '자유';
  $('postTag').dispatchEvent(new Event('change'));

  if (targetTag === '야구' && baseballTeamFilter !== '전체') {
    $('postTeam').value = baseballTeamFilter;
  }

  $('albumResults').replaceChildren(); $('albumQuery').value = '';
  $('albumSearchOnly').style.display = 'block';
  $('selAlbumWrap').style.display = 'none'; $('starInputWrapper').style.display = 'none';
  tempAlbum = { title: null, artist: null, cover: null };

  switchView('write');
  history.pushState({ view: 'write' }, '', '#write');
};

window.openWriteWithAlbumParams = (title, artist, cover, releaseType) => {
  $('openWriteBtn').click();
  $('postTag').value = '앨범 평가'; $('postTag').dispatchEvent(new Event('change'));
  selectAlbum(title, artist, cover, releaseType);
};

// --- 게시글 데이터 및 렌더링 ---
async function fetchPosts() {
  const [{ data, error }, { data: trackArtRows }] = await Promise.all([
    client.from('posts').select('id, created_at, tag, author, title, content, team, user_id, album_title, album_artist, album_cover, rating, views, recs, dislikes, is_notice, is_kakao, comment_count, release_type, ip_prefix, is_admin_author').order('id', { ascending: false }),
    client.from('track_art').select('key'),
  ]);
  if (!error && data) currentPosts = data.filter(p => !isBlocked(p, 'post'));
  trackArtKeys = new Set((trackArtRows || []).map(r => r.key));
  renderPosts();
}

// 추천곡 글의 곡 중 하나라도 아직 track_art에 없으면 false — 그런 글은 목록에서 숨긴다.
function isRecPostFullyCached(post) {
  if (post.tag !== '추천곡') return true;
  const lines = (post.content || '').split('\n').map(l => l.trim()).filter(Boolean);
  return groupRecommendLines(lines).every(item => !item.artist || trackArtKeys.has(`${item.artist}|${item.song}`));
}

function updateGenSortLabels() {
  // 추천곡 게시판엔 "최신순/인기순"이 안 맞아서(다 한꺼번에 올라온 글이라 최신순 의미가
  // 없고, 추천 대신 곡 수/조회수가 더 유용해서) 같은 버튼 두 개를 "곡 많은순/조회수순"으로
  // 재활용한다. genSortType('latest'/'popular') 값 자체는 그대로 쓰고 라벨/정렬 기준만 바꾼다.
  const isRecommend = currentCategory === '추천곡';
  $('btnSortLatest').className = genSortType === 'latest' ? 'active' : '';
  $('btnSortLatest').innerText = isRecommend
    ? (genSortType === 'latest' && genSortDir === 'asc' ? '곡 적은순' : '곡 많은순')
    : (genSortType === 'latest' && genSortDir === 'asc' ? '오래된순' : '최신순');
  $('btnSortPopular').className = genSortType === 'popular' ? 'active' : '';
  $('btnSortPopular').innerText = isRecommend
    ? (genSortType === 'popular' && genSortDir === 'asc' ? '조회수 낮은순' : '조회수순')
    : (genSortType === 'popular' && genSortDir === 'asc' ? '비인기순' : '인기순');

  // 추천곡 게시판은 위 두 버튼을 곡수/조회수로 재활용해서 정작 "언제 올라왔는지" 순으로
  // 볼 방법이 없었다 — 이 게시판에서만 보이는 세 번째 버튼으로 진짜 날짜순 정렬을 추가한다.
  $('sortDivRecTrackDate').style.display = isRecommend ? '' : 'none';
  $('btnSortRecTrackDate').style.display = isRecommend ? '' : 'none';
  $('btnSortRecTrackDate').className = genSortType === 'date' ? 'active' : '';
  $('btnSortRecTrackDate').innerText = genSortType === 'date' && genSortDir === 'asc' ? '오래된순' : '최신순';
}
function updateAlbSortLabels() {
  $('btnSortAlbumReview').className = albSortType === 'review' ? 'active' : '';
  $('btnSortAlbumReview').innerText = albSortType === 'review' && albSortDir === 'asc' ? '리뷰 적은순' : '리뷰 많은순';
  $('btnSortAlbumDate').className = albSortType === 'date' ? 'active' : '';
  $('btnSortAlbumDate').innerText = albSortType === 'date' && albSortDir === 'asc' ? '오래된순' : '최신순';
  $('btnSortAlbumRating').className = albSortType === 'rating' ? 'active' : '';
  $('btnSortAlbumRating').innerText = albSortType === 'rating' && albSortDir === 'asc' ? '평점 낮은순' : '평점 높은순';
}

window.toggleSort = (type) => {
  genSortDir = genSortType === type ? (genSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
  genSortType = type;
  currentPage = 1;
  updateGenSortLabels();
  renderPosts();
};

window.toggleAlbumSort = (type) => {
  albSortDir = albSortType === type ? (albSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
  albSortType = type;
  updateAlbSortLabels();
  renderPosts();
};

// 페이지네이션/정렬/검색/응원팀 필터를 바꿔도 새 히스토리 항목을 쌓지 않고
// "지금 보고 있는 게시판" 항목 자체를 최신 상태로 갱신해둔다. 그래야 다른
// 화면(글 읽기 등)으로 갔다가 뒤로가기를 눌렀을 때 보던 페이지/정렬 그대로
// 돌아온다 — 안 그러면 changeBoard가 매번 1페이지로 리셋해버린다.
function syncBoardHistoryState() {
  if (!history.state || history.state.view !== 'board') return;
  const state = {
    view: 'board', category: currentCategory, page: currentPage,
    genSortType, genSortDir, albSortType, albSortDir,
    postSearchType, postSearchKeyword, baseballTeamFilter, albumReleaseFilter,
  };
  history.replaceState(state, '', location.hash || (location.pathname + location.search));
}

function renderPosts() {
  const widgetArea = $('topWidgetArea');
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const hotPosts = currentPosts.filter(p => (p.recs > 0 || p.views > 5) && new Date(p.created_at).getTime() >= threeDaysAgo && isRecPostFullyCached(p)).sort((a, b) => (b.recs !== a.recs) ? b.recs - a.recs : b.views - a.views).slice(0, 4);
  
  if (hotPosts.length) {
    widgetArea.replaceChildren(...hotPosts.map((post, i) => {
      const card = element('div', 'widget-card');
      card.onclick = () => openPostView(post.id);
      const stats = element('div', 'widget-stats');
      const recs = element('span', '', `추천 ${post.recs || 0}`);
      recs.style.cssText = "background:var(--accent-gradient); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;";
      const author = element('span', 'author-wrap'); author.style.marginLeft = 'auto';
      author.append(element('span', 'author-name', post.author || 'ㅇㅇ'));
      if (post.is_admin_author) author.append(adminAuthorBadge());
      const hotIpTag = ipTag(post); if (hotIpTag) author.append(hotIpTag);
      if (post.is_kakao) author.append(kakaoMark());
      if (post.tag === '야구' && post.team) author.append(teamBadge(post.team));
      stats.append(element('span', '', `조회 ${post.views || 0}`), recs, author);
      card.append(element('span', 'hot-badge', `HOT ${i + 1}`), element('div', 'widget-title', escapeHTML(post.title)), stats);
      return card;
    }));
  } else widgetArea.innerHTML = '<div style="color:var(--muted); font-size:13px; padding:10px;">핫게시글이 없습니다.</div>';

  if (currentCategory === '앨범 평가') {
    $('postTableArea').style.display = 'none'; $('albumGrid').style.display = 'grid';
    $('albumBoardFooter').style.display = 'flex';

    const stats = Object.create(null);
    currentPosts.filter(p => p.tag === '앨범 평가' && p.album_title && p.release_type === albumReleaseFilter).forEach(p => {
      const key = `${p.album_title}|${p.album_artist}|${p.album_cover}`; 
      if(!stats[key]) stats[key] = { count:0, totalScore:0, title:p.album_title, artist:p.album_artist, cover:p.album_cover, maxId: p.id };
      stats[key].count += 1; stats[key].totalScore += Number(p.rating || 0);
      if (p.id > stats[key].maxId) stats[key].maxId = p.id;
    });

    let sortedAlbums = Object.values(stats); 
    const keyword = $('albumBoardSearchInput').value.trim().toLowerCase();
    if (keyword) sortedAlbums = sortedAlbums.filter(a => a.title.toLowerCase().includes(keyword) || a.artist.toLowerCase().includes(keyword));

    sortedAlbums.sort((a, b) => {
      const diff = albSortType === 'rating' ? (b.totalScore/b.count) - (a.totalScore/a.count) :
                   (albSortType === 'date' ? b.maxId - a.maxId : b.count - a.count);
      return albSortDir === 'desc' ? diff : -diff;
    });

    const albumSignature = `${albumReleaseFilter}|${albSortType}|${albSortDir}|${keyword}`;
    if (albumSignature !== lastAlbumSignature) { lastAlbumSignature = albumSignature; albumRenderCount = ALBUMS_PER_PAGE; }

    if(!sortedAlbums.length) {
      if (albumObserver) { albumObserver.disconnect(); albumObserver = null; }
      $('albumGrid').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--muted);">검색된 앨범이 없습니다. 명반을 직접 추가해 보세요!</div>';
    } else {
      const albumsToShow = sortedAlbums.slice(0, albumRenderCount);
      $('albumGrid').replaceChildren(...albumsToShow.map(a => {
        const card = element('div', 'album-card'); card.onclick = () => openAlbumDetail(a.title, a.artist);
        const img = element('img'); img.loading = 'lazy'; setImageSource(img, a.cover);
        const info = element('div', 'album-card-info');
        const rating = element('div', 'album-card-rating', `★ ${(a.totalScore/a.count).toFixed(1)} `);
        rating.append(element('span', '', `(${a.count}명)`));
        const meta = element('div', 'album-card-meta');
        meta.append(element('span', 'album-card-artist', escapeHTML(a.artist)), rating);
        info.append(element('div', 'album-card-title', escapeHTML(a.title)), meta);
        card.append(img, info);
        return card;
      }));

      if (albumObserver) { albumObserver.disconnect(); albumObserver = null; }
      if (sortedAlbums.length > albumRenderCount) {
        const sentinel = element('div', 'album-grid-sentinel');
        sentinel.style.cssText = 'grid-column:1/-1; height:1px;';
        $('albumGrid').append(sentinel);
        albumObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) { albumRenderCount += ALBUMS_PER_PAGE; renderPosts(); }
        }, { rootMargin: '400px' });
        albumObserver.observe(sentinel);
      }
    }
  } else {
    $('albumGrid').style.display = 'none'; $('postTableArea').style.display = 'block';
    $('albumBoardFooter').style.display = 'none';
    if (albumObserver) { albumObserver.disconnect(); albumObserver = null; }
    const tbody = $('postList');
    
    // 추천곡은 전용 게시판에서만 보이게 하고, 전체 게시판(뒤섞여 보이면 지저분함)에서는 뺀다.
    let filtered = currentCategory === '전체' ? currentPosts.filter(p => p.tag !== '추천곡') :
                   (currentCategory === '인디' ? currentPosts.filter(p => ['국내 인디', '해외 인디', '인디'].includes(p.tag)) :
                   currentPosts.filter(p => p.tag === currentCategory));

    // 추천곡 글은 곡이 하나라도 아직 안 채워졌으면(썸네일/재생 준비 안 됨) 목록에서 숨긴다 —
    // 방문자가 열어보는 것만으로 실시간 유튜브 검색이 트리거되는 걸 막기 위함. 백필이
    // 진행되면서 다 채워진 글부터 자연히 순차적으로 노출된다.
    if (currentCategory === '추천곡') filtered = filtered.filter(isRecPostFullyCached);

    if (currentCategory === '야구' && baseballTeamFilter !== '전체') {
      filtered = filtered.filter(p => p.team === baseballTeamFilter);
    }

    if (postSearchKeyword) {
      const kw = postSearchKeyword.toLowerCase();
      filtered = filtered.filter(p => {
        if (postSearchType === 'title') return (p.title || '').toLowerCase().includes(kw);
        if (postSearchType === 'author') return (p.author || '').toLowerCase().includes(kw);
        return (p.title || '').toLowerCase().includes(kw) || (p.content || '').toLowerCase().includes(kw);
      });
    }

    // 공지글은 어느 게시판/정렬 기준으로 보든(검색 중이 아닐 때) 항상 맨 위에 고정한다.
    // 전에는 전체 게시판에서만 고정돼서, 추천곡처럼 개별 게시판에서 최신순/인기순으로
    // 정렬을 바꾸면 공지가 파묻히는 문제가 있었다.
    const pinNotices = !postSearchKeyword;
    filtered.sort((a, b) => {
      if (pinNotices && a.is_notice !== b.is_notice) return a.is_notice ? -1 : 1;
      let diff;
      if (currentCategory === '추천곡') {
        diff = genSortType === 'popular' ? ((b.views || 0) - (a.views || 0))
             : genSortType === 'date' ? (b.id - a.id)
             : (songCount(b) - songCount(a));
      } else {
        diff = genSortType === 'popular' ? ((b.recs !== a.recs ? (b.recs||0) - (a.recs||0) : (b.views !== a.views ? (b.views||0) - (a.views||0) : b.id - a.id))) : (b.id - a.id);
      }
      return genSortDir === 'desc' ? diff : -diff;
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--muted);">게시글이 없습니다.</td></tr>';
      $('boardFooter').style.display = 'none';
      $('paginationArea').replaceChildren();
    } else {
      $('boardFooter').style.display = 'flex';
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
      if (currentPage > totalPages) currentPage = totalPages;
      const startIdx = (currentPage - 1) * POSTS_PER_PAGE;
      const pagePosts = filtered.slice(startIdx, startIdx + POSTS_PER_PAGE);

      tbody.replaceChildren(...pagePosts.map((post, i) => {
        const displayNum = genSortDir === 'desc' ? total - (startIdx + i) : startIdx + i + 1;
        const row = element('tr');
        if (post.is_notice) row.classList.add('notice-row');
        row.style.cursor = 'pointer';
        row.onclick = e => { e.preventDefault(); openPostView(post.id); };

        const tag = element('td', 'col-category');
        tag.append(element('span', 'tag', shortBoardName(post.tag)));

        const titleCell = element('td', 'col-title');
        const thumbUrl = firstThumbnail(post);
        if (thumbUrl) {
          const thumb = element('img', 'dc-album-thumb');
          thumb.alt = '';
          setImageSource(thumb, thumbUrl);
          titleCell.append(thumb);
        }
        if (post.is_notice) titleCell.append(element('span', 'notice-badge', '공지'));
        const link = element('a', 'dc-title-link', escapeHTML(post.title));
        link.href = '#post-' + post.id; // 휠클릭/새 탭 열기 시 제목 링크가 실제로 그 글을 가리키게 한다
        titleCell.append(link);

        if (post.comment_count > 0) titleCell.append(element('span', 'dc-cmt-count', `[${post.comment_count}]`));
        if (post.tag === '앨범 평가' && post.album_title) titleCell.append(element('span', 'dc-comment-count', `★ ${formatRating(post.rating)}`));
        
        const authorCell = element('td', 'col-author');
        const authorWrap = element('span', 'author-wrap');
        authorWrap.append(element('span', 'author-name', post.author || 'ㅇㅇ'));
        if (post.is_admin_author) authorWrap.append(adminAuthorBadge());
        const rowIpTag = ipTag(post); if (rowIpTag) authorWrap.append(rowIpTag);
        if (post.is_kakao) authorWrap.append(kakaoMark());
        if (post.tag === '야구' && post.team) authorWrap.append(teamBadge(post.team));
        authorCell.append(authorWrap);

        const dateCell = element('td', 'col-date', dateOrSongCountLabel(post));
        const viewsCell = element('td', 'col-views tabular', post.views || 0);
        
        const recsVal = post.recs || 0;
        const recsCell = element('td', 'col-likes tabular', recsVal);
        if(recsVal > 0) recsCell.style.cssText = 'color:var(--admin); font-weight:bold;';
        
        const idCell = element('td', 'col-id tabular', post.is_notice ? '공지' : displayNum);
        row.append(idCell, tag, titleCell, authorCell, dateCell, viewsCell, recsCell);
        return row;
      }));
      renderPagination(totalPages);
    }
  }
  syncBoardHistoryState();
}

function renderPagination(totalPages) {
  const area = $('paginationArea');
  area.replaceChildren();

  const prev = element('button', 'page-btn', '<');
  prev.disabled = currentPage === 1;
  prev.onclick = () => { currentPage--; renderPosts(); };
  area.append(prev);

  const windowSize = 10;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  for (let p = start; p <= end; p++) {
    const btn = element('button', `page-btn${p === currentPage ? ' active' : ''}`, String(p));
    btn.onclick = () => { currentPage = p; renderPosts(); };
    area.append(btn);
  }

  const next = element('button', 'page-btn', '>');
  next.disabled = currentPage === totalPages;
  next.onclick = () => { currentPage++; renderPosts(); };
  area.append(next);
}

// 앨범 상세를 열 때마다 iTunes에 다시 물어보지 않게 트랙리스트를 캐싱한다.
const albumTracklistCache = new Map();
let tracklistRequestToken = 0;

function formatTrackDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  const totalSec = Math.round(n / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
}

async function loadAlbumTracklist(title, artist) {
  const cacheKey = `${title}|${artist}`;
  const myToken = ++tracklistRequestToken;
  const list = $('adTracklist');

  if (albumTracklistCache.has(cacheKey)) {
    const rows = renderTracklistItems(albumTracklistCache.get(cacheKey), artist);
    list.replaceChildren(...rows);
    loadRecommendTrackArt(list, rows);
    return;
  }

  list.innerHTML = '<li class="ad-track-empty">트랙리스트 불러오는 중...</li>';
  try {
    const term = encodeURIComponent(`${artist} ${title}`);
    const searchRes = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&country=US&limit=1`);
    const searchData = await searchRes.json();
    const collectionId = searchData.results?.[0]?.collectionId;
    if (!collectionId) throw new Error('no collection match');

    const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`);
    const lookupData = await lookupRes.json();
    const tracks = (lookupData.results || [])
      .filter(r => r.wrapperType === 'track')
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));

    if (myToken !== tracklistRequestToken) return; // 그새 다른 앨범으로 넘어갔으면 무시
    albumTracklistCache.set(cacheKey, tracks);
    const rows = renderTracklistItems(tracks, artist);
    list.replaceChildren(...rows);
    loadRecommendTrackArt(list, rows);
  } catch {
    if (myToken !== tracklistRequestToken) return;
    list.innerHTML = '<li class="ad-track-empty">트랙리스트를 불러오지 못했습니다.</li>';
  }
}

// 앨범 lookup 응답에 이미 트랙별 미리듣기(previewUrl)/전체듣기(trackViewUrl) 링크가
// 같이 온다 — 애플뮤직 정보는 여기서 바로 채우고, 유튜브 링크만 loadRecommendTrackArt로
// (추천곡 게시판과 동일한 함수) 비동기로 채운다. 트랙 순서(trackNumber 정렬)는 그대로
// DOM 순서에 반영되고, toggleRecTrackPlayer도 추천곡과 완전히 동일하게 재사용한다.
function renderTracklistItems(tracks, albumArtist) {
  if (!tracks.length) return [element('li', 'ad-track-empty', '트랙리스트를 찾을 수 없습니다.')];
  return tracks.map(t => {
    const li = element('li', 'ad-track-row rec-track-clickable');
    li.append(element('span', 'ad-track-name', t.trackName || ''), element('span', 'ad-track-dur', formatTrackDuration(t.trackTimeMillis)));
    li.dataset.artist = albumArtist;
    li.dataset.song = t.trackName || '';
    if (t.previewUrl) li.dataset.applePreview = t.previewUrl;
    if (t.trackViewUrl) li.dataset.appleUrl = t.trackViewUrl;
    li.addEventListener('click', () => toggleRecTrackPlayer(li));
    return li;
  });
}

window.openAlbumDetail = (title, artist, pushHistory = true) => {
  const albumPosts = currentPosts.filter(p => p.tag === '앨범 평가' && p.album_title === title && p.album_artist === artist);
  if(!albumPosts.length) return;

  const avgRating = albumPosts.reduce((s, p) => s + Number(p.rating||0), 0) / albumPosts.length;
  setImageSource($('adCover'), albumPosts[0].album_cover);
  $('adTitle').innerText = title; $('adArtist').innerText = artist;
  $('adScore').replaceChildren(`★ ${avgRating.toFixed(1)} `, element('span', '', `(${albumPosts.length}명 참여)`));
  $('adEvalBtn').onclick = () => openWriteWithAlbumParams(title, artist, albumPosts[0].album_cover, albumPosts[0].release_type);
  $('adReviews').replaceChildren(...albumPosts.map(p => {
    const card = element('div', 'review-card'); card.onclick = () => openPostView(p.id);
    const header = element('div', 'rc-header');
    const rcAuthor = element('span', 'rc-author', escapeHTML(p.author || 'ㅇㅇ(유동)'));
    if (p.is_admin_author) rcAuthor.append(adminAuthorBadge());
    const rcIpTag = ipTag(p); if (rcIpTag) rcAuthor.append(rcIpTag);
    header.append(rcAuthor, element('span', 'rc-stars', `전체 ★${avgRating.toFixed(1)} · 작성자 ★${formatRating(p.rating)}`));
    card.append(header, element('div', 'rc-title', escapeHTML(p.title)), element('div', 'rc-content', contentPreview(p.content)));
    return card;
  }));
  loadAlbumTracklist(title, artist);
  switchView('albumDetail');
  if (pushHistory) history.pushState({ view: 'albumDetail', albumTitle: title, albumArtist: artist }, '', '#album');
};

// --- 마이페이지: 내가 쓴 글 / 내가 쓴 댓글 ---
let myPageTab = 'posts';

window.openMyPage = (pushHistory = true) => {
  if (!currentUser) return alert('로그인이 필요합니다.');
  switchMyPageTab('posts');
  switchView('myPage');
  if (pushHistory) history.pushState({ view: 'myPage' }, '', '#mypage');
};

window.switchMyPageTab = (tab) => {
  myPageTab = tab;
  $('btnMyTabPosts').classList.toggle('active', tab === 'posts');
  $('btnMyTabComments').classList.toggle('active', tab === 'comments');
  $('btnMyTabSettings').classList.toggle('active', tab === 'settings');
  $('myPostsArea').style.display = tab === 'posts' ? 'block' : 'none';
  $('myCommentsList').style.display = tab === 'comments' ? 'block' : 'none';
  $('mySettingsArea').style.display = tab === 'settings' ? 'flex' : 'none';
  if (tab === 'posts') renderMyPosts();
  else if (tab === 'comments') renderMyComments();
  else renderMySettings();
};

function renderMyPosts() {
  const tbody = $('myPostsList');
  const myPosts = currentPosts.filter(p => p.user_id === currentUser.id).sort((a, b) => b.id - a.id);

  if (!myPosts.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--muted);">작성한 게시글이 없습니다.</td></tr>';
    return;
  }

  tbody.replaceChildren(...myPosts.map(post => {
    const row = element('tr');
    row.style.cursor = 'pointer';
    // 제목 안에 실제 href="#post-N" 링크가 있어서, preventDefault 없이 두면 이 클릭으로
    // openPostView가 postView를 띄운 직후 앵커의 기본 이동이 popstate(state=null)를 일으켜
    // 다시 board로 튕겨나간다 (renderPosts의 동일 패턴과 같은 이유로 여기도 막아야 한다).
    row.onclick = e => { e.preventDefault(); openPostView(post.id); };

    const tag = element('td', 'col-category');
    tag.append(element('span', 'tag', shortBoardName(post.tag)));

    const titleCell = element('td', 'col-title');
    const thumbUrl = firstThumbnail(post);
    if (thumbUrl) {
      const thumb = element('img', 'dc-album-thumb');
      thumb.alt = '';
      setImageSource(thumb, thumbUrl);
      titleCell.append(thumb);
    }
    const link = element('a', 'dc-title-link', escapeHTML(post.title));
    link.href = '#post-' + post.id;
    titleCell.append(link);
    if (post.comment_count > 0) titleCell.append(element('span', 'dc-cmt-count', `[${post.comment_count}]`));
    if (post.tag === '앨범 평가' && post.album_title) titleCell.append(element('span', 'dc-comment-count', `★ ${formatRating(post.rating)}`));

    const dateCell = element('td', 'col-date', dateOrSongCountLabel(post));
    const viewsCell = element('td', 'col-views tabular', post.views || 0);

    const recsVal = post.recs || 0;
    const recsCell = element('td', 'col-likes tabular', recsVal);
    if (recsVal > 0) recsCell.style.cssText = 'color:var(--admin); font-weight:bold;';

    row.append(tag, titleCell, dateCell, viewsCell, recsCell);
    return row;
  }));
}

async function renderMyComments() {
  const area = $('myCommentsList');
  area.innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted);">불러오는 중...</div>';

  const { data, error } = await client.from('comments')
    .select('id,created_at,post_id,content')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (myPageTab !== 'comments') return; // 불러오는 동안 다른 탭으로 전환했으면 그리지 않는다.
  if (error) { area.innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted);">댓글을 불러오지 못했습니다.</div>'; return; }
  if (!data.length) { area.innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted);">작성한 댓글이 없습니다.</div>'; return; }

  area.replaceChildren(...data.map(c => {
    const post = currentPosts.find(p => p.id === c.post_id);
    const card = element('div', 'review-card');
    if (post) card.onclick = () => openPostView(post.id);
    else card.style.cssText = 'cursor:default; opacity:0.6;';
    const header = element('div', 'rc-header');
    header.append(element('span', 'rc-author', post ? `→ ${escapeHTML(post.title)}` : '삭제된 게시글'));
    header.append(element('span', 'rc-stars', new Date(c.created_at).toLocaleDateString('ko-KR')));
    card.append(header, element('div', 'rc-content', contentPreview(c.content)));
    return card;
  }));
}

function renderMySettings() {
  $('mySettingNickname').value = resolveNickname(currentUser);
  const provider = currentUser?.app_metadata?.provider;
  const social = provider === 'kakao' || provider === 'apple';
  $('mySettingsPasswordCard').style.display = social ? 'none' : 'block';

  const info = $('mySettingsAccountInfo');
  const joinDate = currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('ko-KR') : '-';
  info.replaceChildren(...[
    ['가입 방식', provider === 'kakao' ? '카카오 로그인' : provider === 'apple' ? 'Apple 로그인' : '이메일'],
    ['이메일', currentUser.email || '(비공개)'],
    ['가입일', joinDate],
  ].map(([label, value]) => {
    const row = element('div');
    row.append(`${label}: `, element('strong', '', value));
    return row;
  }));
}

$('mySaveNicknameBtn').addEventListener('click', async () => {
  const newNick = $('mySettingNickname').value.trim();
  if (!newNick) return alert('변경할 닉네임을 입력해주세요.');
  const btn = $('mySaveNicknameBtn');
  btn.disabled = true; btn.textContent = '확인 중...';
  // 다른 회원이 이미 쓰고 있는 닉네임(소셜 로그인으로 자동 채워진 이름 포함)인지
  // 먼저 서버에 물어보고, 겹치면 저장 자체를 막는다.
  const { data: isTaken, error: checkError } = await client.rpc('is_nickname_taken', { p_nickname: newNick });
  if (checkError) { btn.disabled = false; btn.textContent = '변경'; return alert('중복 확인에 실패했습니다: ' + checkError.message); }
  if (isTaken) { btn.disabled = false; btn.textContent = '변경'; return alert('이미 다른 회원이 사용 중인 닉네임입니다.'); }
  btn.textContent = '저장 중...';
  const { error } = await client.auth.updateUser({ data: { nickname: newNick } });
  btn.disabled = false; btn.textContent = '변경';
  if (error) alert('실패: ' + error.message);
  else { alert('닉네임이 변경되었습니다.'); location.reload(); }
});

$('mySavePasswordBtn').addEventListener('click', async () => {
  const pw = $('mySettingNewPw').value;
  const pwConfirm = $('mySettingNewPwConfirm').value;
  if (pw.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
  if (pw !== pwConfirm) return alert('비밀번호가 서로 일치하지 않습니다.');
  const btn = $('mySavePasswordBtn');
  btn.disabled = true; btn.textContent = '변경 중...';
  const { error } = await client.auth.updateUser({ password: pw });
  btn.disabled = false; btn.textContent = '비밀번호 변경';
  if (error) alert('실패: ' + error.message);
  else { alert('비밀번호가 변경되었습니다.'); $('mySettingNewPw').value = ''; $('mySettingNewPwConfirm').value = ''; }
});

$('myDeleteAccountBtn').addEventListener('click', async () => {
  if (!confirm('정말 탈퇴하시겠습니까?\n계정 정보(이메일, 로그인 연동)는 즉시 삭제되며 되돌릴 수 없습니다.\n작성한 글/댓글은 내용은 남고 작성자 연결만 해제됩니다.')) return;
  const btn = $('myDeleteAccountBtn');
  btn.disabled = true; btn.textContent = '처리 중...';
  const { error } = await client.rpc('delete_own_account');
  if (error) { btn.disabled = false; btn.textContent = '회원 탈퇴'; return alert('실패: ' + error.message); }
  await client.auth.signOut();
  alert('탈퇴 처리가 완료되었습니다. 이용해주셔서 감사합니다.');
  location.href = location.pathname;
});

// restoreState가 있으면(뒤로/앞으로가기로 이 게시판에 되돌아온 경우) 그때의
// 페이지/정렬/검색/응원팀 상태를 그대로 복원한다. 없으면(사이드바 클릭 등
// 새로 들어온 경우) 항상 1페이지/기본 정렬로 시작한다.
function changeBoard(category, pushHistory = true, restoreState = null) {
  currentCategory = category;
  const isAlbum = category === '앨범 평가';
  const isBaseball = category === '야구';

  $('generalBoardHeader').style.display = isAlbum ? 'none' : 'flex';
  $('albumBoardHeader').style.display = isAlbum ? 'flex' : 'none';
  $('baseballTeamTabs').style.display = isBaseball ? 'flex' : 'none';
  $('albumReleaseTabs').style.display = isAlbum ? 'flex' : 'none';
  if (isBaseball) { baseballTeamFilter = restoreState?.baseballTeamFilter || '전체'; renderBaseballTabs(); }
  if (isAlbum) { albumReleaseFilter = restoreState?.albumReleaseFilter || '정규'; renderAlbumReleaseTabs(); }
  if (!isAlbum) $('boardTitle').innerText = category === '전체' ? '전체 게시판' : category + ' 게시판';
  $('colDateHeader').textContent = category === '추천곡' ? '곡수' : '작성일';

  document.querySelectorAll('.sidebar a').forEach(link => link.classList.toggle('active', link.getAttribute('onclick')?.includes(`'${category}'`)));
  postSearchType = restoreState?.postSearchType || 'all';
  postSearchKeyword = restoreState?.postSearchKeyword || '';
  $('albumBoardSearchInput').value = '';
  $('postSearchType').value = postSearchType; $('postSearchInput').value = postSearchKeyword;
  currentPage = restoreState?.page || 1;

  genSortType = restoreState?.genSortType || 'latest';
  genSortDir = restoreState?.genSortDir || 'desc';
  albSortType = restoreState?.albSortType || 'review';
  albSortDir = restoreState?.albSortDir || 'desc';
  updateGenSortLabels();
  updateAlbSortLabels();

  // renderPosts()(=backToList 내부)가 끝에서 "현재" 히스토리 항목을 최신
  // 상태로 replaceState하므로, 새 항목을 push하는 건 반드시 그보다 먼저
  // 해야 한다 — 안 그러면 이전 게시판의 히스토리 항목을 덮어써버린다.
  if (pushHistory) history.pushState({ view: 'board', category, page: currentPage, genSortType, genSortDir, albSortType, albSortDir, postSearchType, postSearchKeyword, baseballTeamFilter, albumReleaseFilter }, '', '#board-' + encodeURIComponent(category));
  backToList();
}

// --- 신고/차단 (앱스토어 심사 지침 1.2: 사용자 생성 콘텐츠) --- 둘 다 로그인 사용자만.
const requireLogin = () => {
  if (currentUser) return true;
  alert('로그인 후 이용할 수 있습니다.');
  toggleModal('loginModal', true);
  return false;
};
window.reportContent = async (type, id) => {
  if (!requireLogin()) return;
  const reason = prompt('신고 사유를 적어주세요. (욕설·혐오, 도배·광고, 권리 침해 등)');
  if (reason === null) return;
  const { error } = await client.from('reports').insert([{ target_type: type, target_id: id, reason: reason.trim() || null, reporter_id: currentUser.id }]);
  alert(error ? '신고 접수에 실패했습니다: ' + error.message : '신고가 접수되었습니다. 확인 후 조치하겠습니다.');
};

// 차단은 이 기기(브라우저)에만 저장한다. 로그인 사용자는 user_id로 식별한다. 유동은 닉네임이
// 전부 "ㅇㅇ"로 똑같아서(구분은 IP로만 함) 닉네임으로는 식별할 수 없으므로, 서버가 기록한
// ip_prefix로 식별한다 — 그마저도 없으면(과거 데이터 등) 그 글/댓글 하나만 숨긴다.
// ponytail: localStorage라 기기 간 동기화 안 됨. 필요해지면 blocks 테이블로 옮긴다.
const blockedKeys = new Set((() => { try { return JSON.parse(localStorage.getItem('blockedUsers') || '[]'); } catch { return []; } })());
const blockKey = (item, type) => item.user_id ? 'u:' + item.user_id : (item.ip_prefix ? 'ip:' + item.ip_prefix : `${type}:${item.id}`);
const isBlocked = (item, type) => blockedKeys.has(blockKey(item, type));
function blockAuthor(item, type) {
  if (!requireLogin()) return false;
  if (!confirm(`'${item.author || 'ㅇㅇ'}'님의 글과 댓글을 더 이상 보지 않을까요?`)) return false;
  blockedKeys.add(blockKey(item, type));
  try { localStorage.setItem('blockedUsers', JSON.stringify([...blockedKeys])); } catch {}
  currentPosts = currentPosts.filter(p => !isBlocked(p, 'post'));
  return true;
}
window.blockPostAuthor = () => {
  const post = currentPosts.find(p => p.id === currentReadPostId);
  if (post && blockAuthor(post, 'post')) returnToBoardAfterAction();
};
window.unblockAll = () => {
  if (!blockedKeys.size) return alert('차단한 사용자가 없습니다.');
  if (!confirm(`차단 ${blockedKeys.size}건을 모두 해제할까요?`)) return;
  blockedKeys.clear();
  try { localStorage.removeItem('blockedUsers'); } catch {}
  fetchPosts();
};

// --- 댓글 및 대댓글 기능 ---
async function fetchAndRenderComments() {
  if (!currentReadPostId) return;
  const { data, error } = await client.from('comments').select('id, created_at, post_id, parent_id, author, content, user_id, is_kakao, ip_prefix, is_admin_author').eq('post_id', currentReadPostId).order('id', { ascending: true });
  if (error) return console.error('댓글 불러오기 실패:', error);
  
  currentComments = (data || []).filter(c => !isBlocked(c, 'comment'));
  $('commentCount').textContent = currentComments.length;

  const list = $('commentList');
  list.replaceChildren();

  if (currentComments.length === 0) {
    list.innerHTML = '<li style="padding:30px; text-align:center; color:var(--muted); border-bottom:1px solid var(--border);">등록된 댓글이 없습니다.</li>';
    return;
  }

  // 답글에 답글을 달아도 디시처럼 갈래로 계속 뻗어나가게, parent_id로 트리를 만들어
  // 재귀적으로 그린다. 부모가 삭제돼서 parent_id가 가리키는 대상이 없으면(고아 댓글)
  // 최상위 댓글처럼 취급한다.
  const byId = new Map(currentComments.map(c => [c.id, c]));
  const childrenOf = new Map();
  const roots = [];
  currentComments.forEach(c => {
    if (c.parent_id && byId.has(c.parent_id)) {
      if (!childrenOf.has(c.parent_id)) childrenOf.set(c.parent_id, []);
      childrenOf.get(c.parent_id).push(c);
    } else {
      roots.push(c);
    }
  });

  const appendTree = (comment, depth) => {
    list.append(createCommentElement(comment, depth));
    (childrenOf.get(comment.id) || []).forEach(child => appendTree(child, depth + 1));
  };
  roots.forEach(root => appendTree(root, 0));
}

// 답글이 깊어질수록 계속 들여쓰면 모바일에서 글자 쓸 공간이 없어지므로, 이 depth부터는
// 더 들여쓰지 않고 화살표(↳)로만 "답글의 답글"임을 표시한다(디시도 일정 깊이부턴 flat).
const MAX_INDENT_DEPTH = 6;
const REPLY_INDENT_PX = 18;

function createCommentElement(comment, depth) {
  const isReply = depth > 0;
  const li = element('li', `comment-item ${isReply ? 'reply' : ''}`);
  if (isReply) li.style.marginLeft = Math.min(depth, MAX_INDENT_DEPTH) * REPLY_INDENT_PX + 'px';
  const meta = element('div', 'ci-meta');

  let authorDisplay = comment.author || 'ㅇㅇ';
  if (isReply) authorDisplay = '↳ ' + authorDisplay;

  const authorSpan = element('span', 'ci-author', authorDisplay);
  if (comment.is_admin_author) authorSpan.append(adminAuthorBadge());
  const commentIpTag = ipTag(comment); if (commentIpTag) authorSpan.append(commentIpTag);
  if (comment.is_kakao) authorSpan.append(kakaoMark());
  // 댓글 작성자가 이 글의 작성자와 실제로 같은 사람인지 표시한다. 닉네임은 누구나 똑같이
  // 따라 쓸 수 있어서(사칭 오탐 사례 발견됨) 절대 식별 기준으로 쓰지 않는다 — 로그인
  // 사용자는 user_id가 같은지로, 유동은 서버가 저장한 IP 앞 두 자리(ip_prefix)가 같은지로만
  // 판단한다.
  const openPost = currentPosts.find(p => p.id === currentReadPostId);
  const sameLoggedInAuthor = openPost?.user_id && comment.user_id && openPost.user_id === comment.user_id;
  const sameGuestByIp = !openPost?.user_id && !comment.user_id && openPost?.ip_prefix && comment.ip_prefix && openPost.ip_prefix === comment.ip_prefix;
  if (sameLoggedInAuthor || sameGuestByIp) {
    authorSpan.append(element('span', 'ci-op-badge', '(글쓴이)'));
  }

  meta.append(
    authorSpan,
    element('span', 'ci-date', new Date(comment.created_at).toLocaleString('ko-KR', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}))
  );
  
  const actions = element('div', 'ci-actions');
  const replyBtn = element('button', '', '답글');
  replyBtn.onclick = () => toggleReplyForm(comment.id);
  actions.append(replyBtn);
  const reportBtn = element('button', '', '신고');
  reportBtn.onclick = () => reportContent('comment', comment.id);
  const blockBtn = element('button', '', '차단');
  blockBtn.onclick = () => { if (blockAuthor(comment, 'comment')) fetchAndRenderComments(); };
  actions.append(reportBtn, blockBtn);
  
  // 관리자/작성자는 바로 삭제, 유동(비로그인) 댓글은 비밀번호로 삭제 가능하니 버튼 노출
  const isCommentAuthor = currentUser && currentUser.id === comment.user_id;
  const isGuestComment = !comment.user_id;
  if (isAdmin || isCommentAuthor || isGuestComment) {
    const delBtn = element('button', '', '삭제');
    delBtn.style.color = 'var(--admin)';
    delBtn.onclick = async () => {
      if (isAdmin || isCommentAuthor) {
        if(!confirm('댓글을 삭제하시겠습니까?')) return;
        const { error } = await client.from('comments').delete().eq('id', comment.id);
        if (error) alert('권한이 없거나 삭제에 실패했습니다.');
        else fetchAndRenderComments();
      } else {
        const pw = prompt('삭제하려면 댓글 작성 시 입력한 비밀번호를 입력하세요.');
        if (pw === null) return;
        const { data, error } = await client.rpc('delete_comment_with_password', { p_id: comment.id, p_password: pw });
        if (error || !data) alert('비밀번호가 틀렸거나 삭제할 수 없습니다.');
        else fetchAndRenderComments();
      }
    };
    actions.append(delBtn);
  }

  li.append(meta, element('div', 'ci-content', escapeHTML(comment.content)), actions);

  // 답글/대댓글 모두 자기 자신에게 다시 답글을 달 수 있어야 갈래로 계속 뻗어나갈 수 있다.
  const replyForm = element('div', 'reply-write-form');
  replyForm.id = `replyForm_${comment.id}`;
  replyForm.innerHTML = `
    <div class="cw-author"><input type="text" id="replyAuthor_${comment.id}" placeholder="닉네임 (유동)" autocomplete="off" value="${currentUser ? escapeHTML(resolveNickname(currentUser)) : '인좋'}"><input type="text" class="pseudo-password" id="replyGuestPw_${comment.id}" placeholder="비밀번호" maxlength="20" autocomplete="off" style="${currentUser ? 'display:none;' : ''}"></div>
    <div class="cw-input">
      <textarea id="replyContent_${comment.id}" placeholder="답글을 입력하세요." autocomplete="off"></textarea>
      <button onclick="submitComment(${comment.id})">등록</button>
    </div>
  `;
  li.append(replyForm);
  return li;
}

window.toggleReplyForm = (commentId) => {
  const form = $(`replyForm_${commentId}`);
  const isVisible = form.style.display === 'block';
  document.querySelectorAll('.reply-write-form').forEach(el => el.style.display = 'none');
  if (!isVisible) {
    form.style.display = 'block';
    $(`replyContent_${commentId}`).focus();
  }
};

window.submitComment = async (parentId = null) => {
  const authorId = parentId ? `replyAuthor_${parentId}` : 'commentAuthor';
  const contentId = parentId ? `replyContent_${parentId}` : 'commentContent';
  const pwId = parentId ? `replyGuestPw_${parentId}` : 'commentGuestPw';

  const author = escapeHTML($(authorId).value.trim()) || '인좋';
  const content = $(contentId).value.trim();
  const guestPw = $(pwId).value.trim();

  if (!content) return alert('댓글 내용을 입력해주세요.');
  if (hasBannedWord(content)) return alert('부적절한 표현이 포함되어 등록할 수 없습니다.');
  if (!currentUser && !guestPw) return alert('유동 댓글은 비밀번호가 필요합니다. (나중에 삭제할 때 사용)');

  const btn = parentId ? $(`replyForm_${parentId}`).querySelector('button') : $('btnSubmitComment');
  const originalText = btn.textContent;
  btn.textContent = '등록 중...';
  btn.disabled = true;

  const { error } = await client.from('comments').insert([{
    post_id: currentReadPostId,
    parent_id: parentId,
    author: author,
    content: content,
    user_id: currentUser ? currentUser.id : null,
    ...(!currentUser && { guest_password: guestPw })
  }]);

  btn.textContent = originalText;
  btn.disabled = false;

  if (error) {
    alert('댓글 등록 실패: ' + error.message);
  } else {
    $(contentId).value = '';
    fetchAndRenderComments(); 
  }
};

$('btnSubmitComment').addEventListener('click', () => submitComment(null));

// --- 게시물 열람 함수 ---
async function openPostView(postId, pushHistory = true) {
  const post = currentPosts.find(p => p.id === postId); if(!post) return;
  currentReadPostId = postId;
  if (pushHistory) history.pushState({ view: 'postView', postId }, '', '#post-' + postId);
  
  $('readTitle').textContent = post.title; $('readTag').textContent = post.tag;
  $('readAuthor').replaceChildren(document.createTextNode(post.author || 'ㅇㅇ'));
  if (post.is_admin_author) $('readAuthor').append(adminAuthorBadge());
  const readIpTag = ipTag(post); if (readIpTag) $('readAuthor').append(readIpTag);
  if (post.is_kakao) $('readAuthor').append(kakaoMark());
  $('readTeamBadge').replaceChildren();
  if (post.tag === '야구' && post.team) $('readTeamBadge').append(teamBadge(post.team));
  $('readDate').textContent = post.tag === '추천곡' ? '' : new Date(post.created_at).toLocaleString('ko-KR');
  $('readContent').replaceChildren(post.tag === '추천곡' ? formatRecommendContent(post.content) : formatContent(post.content)); // 렌더링 시 escapeHTML 적용됨

  if (post.tag === '앨범 평가' && post.album_title) {
    $('readAlbumInfo').style.display = 'flex';
    setImageSource($('readAlbumCover'), post.album_cover);
    $('readAlbumName').textContent = post.album_title;
    $('readAlbumArtist').textContent = post.album_artist || '';
    const albumReviews = currentPosts.filter(p => p.tag === '앨범 평가' && p.album_title === post.album_title && p.album_artist === post.album_artist);
    const avgRating = albumReviews.length ? albumReviews.reduce((s, p) => s + Number(p.rating || 0), 0) / albumReviews.length : Number(post.rating || 0);
    $('readAlbumRating').textContent = `전체평점 ★${avgRating.toFixed(1)}  ·  작성자 평점 ★${formatRating(post.rating)}`;
  } else if (post.tag === '추천곡' && post.album_cover) {
    // 추천곡은 평점이 없는 참고용 커버라 이름/평점 없이 이미지만 보여준다.
    $('readAlbumInfo').style.display = 'flex';
    setImageSource($('readAlbumCover'), post.album_cover);
    $('readAlbumName').textContent = post.album_title || '';
    $('readAlbumArtist').textContent = post.album_artist || '';
    $('readAlbumRating').textContent = '';
  } else {
    $('readAlbumInfo').style.display = 'none';
  }
  $('readViews').textContent = (post.views || 0) + 1;
  $('readRecs').textContent = $('btnRecCount').textContent = post.recs || 0;
  $('readDislikes').textContent = $('btnDislikeCount').textContent = post.dislikes || 0;

  // 유동(비로그인) 사용자가 이 글을 이미 추천/비추천했으면 버튼을 비활성화해서 중복 시도를 막는다.
  const alreadyRecommended = !currentUser && hasCachedRecommend(postId);
  $('recommendBtn').disabled = alreadyRecommended;
  $('recommendBtn').style.opacity = alreadyRecommended ? '0.5' : '';
  const alreadyDisliked = !currentUser && hasCachedDislike(postId);
  $('dislikeBtn').disabled = alreadyDisliked;
  $('dislikeBtn').style.opacity = alreadyDisliked ? '0.5' : '';

  // 수정/삭제: 관리자, 본인이 쓴 글, 유동(비로그인) 글(비밀번호로 인증) 모두 가능.
  const isAuthor = currentUser && currentUser.id === post.user_id;
  const isGuestPost = !post.user_id;
  $('adminEditBtn').style.display = (isAdmin || isAuthor || isGuestPost) ? 'inline-block' : 'none';
  $('adminDeleteBtn').style.display = (isAdmin || isAuthor || isGuestPost) ? 'inline-block' : 'none';
  $('adminNoticeBtn').style.display = isAdmin ? 'inline-block' : 'none';
  $('adminNoticeBtn').textContent = post.is_notice ? '공지 해제' : '공지 등록';

  if(post.tag === '앨범 평가' && post.album_title) {
    $('btnEvalSame').style.display = 'inline-block';
    $('btnEvalSame').onclick = () => openWriteWithAlbumParams(post.album_title, post.album_artist, post.album_cover, post.release_type);
  } else $('btnEvalSame').style.display = 'none';

  // 유동은 닉네임을 자유롭게 바꿔도 된다 — 구분은 ip_prefix로만 하고, ipTag()가
  // user_id 없는 댓글엔 닉네임과 무관하게 무조건 IP를 붙여 보여준다.
  $('commentAuthor').value = currentUser ? resolveNickname(currentUser) : '인좋';
  $('commentContent').value = ''; $('commentGuestPw').value = '';
  $('commentGuestPw').style.display = currentUser ? 'none' : '';

  switchView('postView');
  await fetchAndRenderComments();
  
  // 조회수 DB 함수 직접 호출 (안전한 카운팅). 뒤로/앞으로가기로 복원될 땐 중복 카운트하지 않음.
  if (pushHistory) await client.rpc('increment_views', { p_id: postId });
}

window.backToList = () => { renderPosts(); switchView('board'); };

// 글 삭제/저장처럼 지금 보던 대상이 사라지거나 바뀌는 액션 후 목록으로 돌아갈 때 씀.
// 뒤로가기를 눌러도 없어진 글로 돌아가지 않도록 현재 히스토리 항목 자체를 목록으로 교체한다.
function returnToBoardAfterAction() {
  backToList();
  history.replaceState({ view: 'board', category: currentCategory }, '', '#board-' + encodeURIComponent(currentCategory));
}

$('btnPostSearch').addEventListener('click', () => {
  postSearchType = $('postSearchType').value;
  postSearchKeyword = $('postSearchInput').value.trim();
  currentPage = 1;
  renderPosts();
});

$('headerSearchBtn').addEventListener('click', () => {
  const keyword = $('headerSearchInput').value.trim();
  if (!keyword) return;
  // 지금 보고 있던 게시판(전체 포함)을 유지한 채 그 안에서만 검색한다.
  // 처음 접속해서 아직 게시판을 고르지 않은 상태면 currentCategory 기본값인
  // '전체'가 그대로 쓰이므로, 이전처럼 전체 검색으로 자연스럽게 동작한다.
  changeBoard(currentCategory);
  if (currentCategory === '앨범 평가') {
    // 앨범 평가 게시판은 postSearchKeyword가 아니라 albumBoardSearchInput을 따로 읽어서 그린다.
    $('albumBoardSearchInput').value = keyword;
  } else {
    postSearchType = 'all';
    postSearchKeyword = keyword;
    $('postSearchType').value = 'all';
    $('postSearchInput').value = keyword;
  }
  currentPage = 1;
  renderPosts();
});

// 추천 로직: 로그인 사용자는 서버 검증(중복 추천 방지 RPC), 유동은 로컬 캐시로 1회 제한
$('recommendBtn').addEventListener('click', async () => {
  const prevRecs = parseInt($('btnRecCount').textContent);

  if (!currentUser) {
    if (hasCachedRecommend(currentReadPostId)) return alert('이미 추천한 게시글입니다.');
    $('btnRecCount').textContent = '...';
    const { error } = await client.rpc('increment_recs', { p_id: currentReadPostId });
    if (error) {
      alert('추천 처리에 실패했습니다.');
      $('btnRecCount').textContent = prevRecs;
      return;
    }
    addRecommendedCache(currentReadPostId);
    $('recommendBtn').disabled = true;
    $('recommendBtn').style.opacity = '0.5';
    alert('추천 완료!');
    const newRecs = prevRecs + 1;
    $('readRecs').textContent = $('btnRecCount').textContent = newRecs;
    const post = currentPosts.find(p => p.id === currentReadPostId);
    if (post) post.recs = newRecs;
    return;
  }

  $('btnRecCount').textContent = '...';

  // DB 단에서 만들어 둔 중복 추천 방지용 RPC 호출
  const { error } = await client.rpc('toggle_recommendation', { p_id: currentReadPostId });

  if (error) {
    // 이미 추천한 경우(Unique Constraint 위반) DB에서 에러 반환됨
    alert('이미 추천한 게시글입니다.');
    $('btnRecCount').textContent = prevRecs;
  } else {
    alert('추천 완료!');
    const newRecs = prevRecs + 1;
    $('readRecs').textContent = $('btnRecCount').textContent = newRecs;

    // 로컬 데이터도 갱신
    const post = currentPosts.find(p => p.id === currentReadPostId);
    if(post) post.recs = newRecs;
  }
});

// 비추천 로직: 추천과 완전히 동일한 구조(로그인은 서버 dedup RPC, 유동은 로컬 캐시로 1회 제한).
$('dislikeBtn').addEventListener('click', async () => {
  const prevDislikes = parseInt($('btnDislikeCount').textContent);

  if (!currentUser) {
    if (hasCachedDislike(currentReadPostId)) return alert('이미 비추천한 게시글입니다.');
    $('btnDislikeCount').textContent = '...';
    const { error } = await client.rpc('increment_dislikes', { p_id: currentReadPostId });
    if (error) {
      alert('비추천 처리에 실패했습니다.');
      $('btnDislikeCount').textContent = prevDislikes;
      return;
    }
    addDislikedCache(currentReadPostId);
    $('dislikeBtn').disabled = true;
    $('dislikeBtn').style.opacity = '0.5';
    alert('비추천 완료!');
    const newDislikes = prevDislikes + 1;
    $('readDislikes').textContent = $('btnDislikeCount').textContent = newDislikes;
    const post = currentPosts.find(p => p.id === currentReadPostId);
    if (post) post.dislikes = newDislikes;
    return;
  }

  $('btnDislikeCount').textContent = '...';

  const { error } = await client.rpc('toggle_dislike', { p_id: currentReadPostId });

  if (error) {
    alert('이미 비추천한 게시글입니다.');
    $('btnDislikeCount').textContent = prevDislikes;
  } else {
    alert('비추천 완료!');
    const newDislikes = prevDislikes + 1;
    $('readDislikes').textContent = $('btnDislikeCount').textContent = newDislikes;
    const post = currentPosts.find(p => p.id === currentReadPostId);
    if (post) post.dislikes = newDislikes;
  }
});

$('adminEditBtn').addEventListener('click', () => {
  const post = currentPosts.find(p => p.id === currentReadPostId);
  isEditMode = true; $('writeSectionTitle').textContent = '게시글 수정하기'; $('savePostBtn').textContent = '수정 완료';
  updateRestrictedTagOptions();
  $('postTag').value = post.tag; $('postTag').dispatchEvent(new Event('change'));
  $('postTitle').value = post.title; $('postContent').value = post.content;
  updateContentPreview();
  if (post.tag === '야구') $('postTeam').value = post.team || '';
  $('postAuthor').value = post.author || 'ㅇㅇ';

  if (post.tag === '앨범 평가') {
    // 앨범을 다시 검색하게 하지 않고, 기존 앨범 정보를 보여준 채로 리뷰 내용/별점만 수정하게 한다.
    tempAlbum = { title: post.album_title, artist: post.album_artist, cover: post.album_cover };
    $('albumSearchOnly').style.display = 'none';
    $('selAlbumWrap').style.display = 'flex';
    setImageSource($('selCover'), post.album_cover);
    $('selTitle').innerText = post.album_title;
    $('selArtist').innerText = post.album_artist;
    $('starInputWrapper').style.display = 'flex';
    setStars(Number(post.rating) || 5);
    $('postReleaseType').value = post.release_type || '정규';
  } else if (post.tag === '추천곡' && post.album_cover) {
    // 추천곡은 커버가 선택 사항이라, 이미 붙어있으면 그대로 보여주고 없으면 새로 검색하게 둔다.
    tempAlbum = { title: post.album_title, artist: post.album_artist, cover: post.album_cover };
    $('albumSearchOnly').style.display = 'none';
    $('selAlbumWrap').style.display = 'flex';
    setImageSource($('selCover'), post.album_cover);
    $('selTitle').innerText = post.album_title || '';
    $('selArtist').innerText = post.album_artist || '';
  }

  // 관리자/본인 글이 아니면 유동(비로그인) 글 수정이므로 비밀번호 확인이 필요하다.
  const isAuthorEdit = currentUser && currentUser.id === post.user_id;
  const needsPassword = !isAdmin && !isAuthorEdit;
  $('postGuestPw').value = '';
  $('postGuestPw').style.display = needsPassword ? 'block' : 'none';
  $('postGuestPw').placeholder = '비밀번호 (수정하려면 입력)';

  switchView('write');
  history.pushState({ view: 'write' }, '', '#write');
});

$('adminNoticeBtn').addEventListener('click', async () => {
  const post = currentPosts.find(p => p.id === currentReadPostId);
  const nextState = !post.is_notice;
  const { error } = await client.rpc('set_notice', { p_id: currentReadPostId, p_is_notice: nextState });
  if (error) return alert('실패: ' + error.message);
  post.is_notice = nextState;
  $('adminNoticeBtn').textContent = nextState ? '공지 해제' : '공지 등록';
  alert(nextState ? '공지로 등록됐습니다.' : '공지가 해제됐습니다.');
});

$('adminDeleteBtn').addEventListener('click', async () => {
  const post = currentPosts.find(p => p.id === currentReadPostId);
  const isAuthor = currentUser && post && currentUser.id === post.user_id;

  if (isAdmin || isAuthor) {
    if(!confirm('삭제하시겠습니까?')) return;
    const { error } = await client.from('posts').delete().eq('id', currentReadPostId);
    if (!error) { alert('삭제됨'); returnToBoardAfterAction(); fetchPosts(); } else { alert('삭제 실패(권한 부족): ' + error.message); }
  } else {
    // 유동(비로그인) 글: 작성 시 입력한 비밀번호로만 삭제 가능
    const pw = prompt('삭제하려면 글 작성 시 입력한 비밀번호를 입력하세요.');
    if (pw === null) return;
    const { data, error } = await client.rpc('delete_post_with_password', { p_id: currentReadPostId, p_password: pw });
    if (error || !data) alert('비밀번호가 틀렸거나 삭제할 수 없습니다.');
    else { alert('삭제됨'); returnToBoardAfterAction(); fetchPosts(); }
  }
});

$('savePostBtn').addEventListener('click', async () => {
  // XSS 1차 필터링
  const tag = $('postTag').value;
  const title = escapeHTML($('postTitle').value);
  const content = $('postContent').value; // 본문은 렌더링 시 필터링됨
  const author = escapeHTML($('postAuthor').value.trim()) || '인좋';
  const team = $('postTeam').value;
  const releaseType = $('postReleaseType').value;
  const guestPw = $('postGuestPw').value.trim();

  if (!title.trim()) return alert('제목을 입력해주세요.');
  if (hasBannedWord(title + content)) return alert('부적절한 표현이 포함되어 등록할 수 없습니다.');
  if (tag === '앨범 평가' && !tempAlbum.title && !isEditMode) return alert('검색을 통해 평가할 앨범을 선택해주세요!');
  if (tag === '야구' && !team) return alert('응원하는 팀을 선택해주세요!');
  if (RESTRICTED_TAGS.includes(tag) && !(isAdmin || isKakaoUser())) return alert('회원 간 거래, 오프라인 만남의 안전을 위해 카카오 로그인 사용자만 글을 쓸 수 있는 게시판입니다.');
  if (!currentUser && !isEditMode && !guestPw) return alert('유동 글쓰기는 비밀번호가 필요합니다. (나중에 삭제할 때 사용)');

  const editingPost = isEditMode ? currentPosts.find(p => p.id === currentReadPostId) : null;
  const canDirectEdit = isEditMode && (isAdmin || (currentUser && editingPost && currentUser.id === editingPost.user_id));
  if (isEditMode && !canDirectEdit && !guestPw) return alert('수정하려면 작성 시 입력한 비밀번호가 필요합니다.');

  $('savePostBtn').disabled = true; $('savePostBtn').textContent = '처리 중...';
  let error;
  let mergedIntoExisting = false;
  if (isEditMode) {
    const ratingField = tag === '앨범 평가' ? { rating: currentSelectedRating, release_type: releaseType } : {};
    // 추천곡은 커버가 선택 사항이라, 새로 고른(tempAlbum.title이 있는) 경우에만 갱신하고
    // 안 건드렸으면 기존 값을 그대로 둔다(빈 값으로 덮어쓰지 않음).
    const coverField = tag === '추천곡' && tempAlbum.title ? { album_title: tempAlbum.title, album_artist: tempAlbum.artist, album_cover: tempAlbum.cover } : {};
    if (canDirectEdit) {
      const updateData = { tag, author, title, content, team: tag === '야구' ? team : null, ...ratingField, ...coverField };
      ({ error } = await client.from('posts').update(updateData).eq('id', currentReadPostId));
    } else {
      const { data, error: rpcError } = await client.rpc('edit_post_with_password', {
        p_id: currentReadPostId, p_password: guestPw, p_tag: tag, p_author: author, p_title: title, p_content: content,
        p_team: tag === '야구' ? team : null, p_rating: tag === '앨범 평가' ? currentSelectedRating : null,
        p_release_type: tag === '앨범 평가' ? releaseType : null
      });
      error = rpcError || (!data ? { message: '비밀번호가 틀렸습니다.' } : null);
    }
  } else if (tag === '추천곡' && !currentUser) {
    // 추천곡은 유동일 때 닉네임이 같으면 새 글을 안 만들고 기존 글에 이어 붙인다
    // ("닉네임이 같으면 같은 사람" — 원래 카카오톡 공지 규칙을 그대로 적용).
    const { data, error: rpcError } = await client.rpc('upsert_recommend_post', {
      p_author: author, p_title: title, p_content: content, p_password: guestPw,
      p_album_title: tempAlbum.title, p_album_artist: tempAlbum.artist, p_album_cover: tempAlbum.cover
    });
    error = rpcError;
    mergedIntoExisting = !error && data?.appended === true;
  } else {
    const postData = {
      tag, author, title, content, user_id: currentUser ? currentUser.id : null,
      ...(!currentUser && { guest_password: guestPw }),
      ...(tag === '앨범 평가' && { album_title: tempAlbum.title, album_artist: tempAlbum.artist, album_cover: tempAlbum.cover, rating: currentSelectedRating, release_type: releaseType }),
      ...(tag === '추천곡' && tempAlbum.title && { album_title: tempAlbum.title, album_artist: tempAlbum.artist, album_cover: tempAlbum.cover }),
      ...(tag === '야구' && { team })
    };
    ({ error } = await client.from('posts').insert([postData]));
  }

  $('savePostBtn').disabled = false; $('savePostBtn').textContent = isEditMode ? '수정 완료' : '등록하기';
  if (!error) {
    alert(isEditMode ? '수정됨' : (mergedIntoExisting ? `이미 있는 '${author}'님의 추천곡 글에 이어 붙였습니다.` : '등록됨'));
    returnToBoardAfterAction(); fetchPosts();
  }
  else if (RESTRICTED_TAGS.includes(tag) && /row-level security/i.test(error.message || '')) {
    // 클라이언트 검증을 어떤 이유로든 못 거친 경우에도(캐시된 구버전 등) 서버 거부 사유를 그대로 노출하지 않고 같은 안내를 보여준다.
    alert('회원 간 거래, 오프라인 만남의 안전을 위해 카카오 로그인 사용자만 글을 쓸 수 있는 게시판입니다.');
  }
  else alert(error.message === '비밀번호가 틀렸습니다.' ? error.message : '실패: 권한이 없거나 오류가 발생했습니다.');
});

// 브라우저 뒤로가기/앞으로가기 지원
window.addEventListener('popstate', (e) => {
  const state = e.state;
  if (!state || state.view === 'board') {
    changeBoard(state?.category || '전체', false, state || null);
  } else if (state.view === 'postView') {
    openPostView(state.postId, false);
  } else if (state.view === 'albumDetail') {
    openAlbumDetail(state.albumTitle, state.albumArtist, false);
  } else if (state.view === 'write') {
    switchView('write');
  } else if (state.view === 'myPage') {
    switchView('myPage');
    switchMyPageTab(myPageTab);
  }
});

// 휠클릭/새 탭 열기 등으로 #post-123 같은 주소에 바로 들어왔을 때, 게시판 목록이 아니라 해당 글이 뜨게 한다.
function routeFromHash() {
  // 외부(구글 API 할당량 신청서 등)에 "개인정보처리방침 URL"로 직접 링크할 수 있게,
  // 모달을 페이지 로드 시점에 바로 띄워주는 딥링크를 만든다.
  if (location.hash === '#privacy') {
    toggleModal('privacyModal', true);
  }
  const postMatch = location.hash.match(/^#post-(\d+)/);
  if (postMatch) {
    const postId = Number(postMatch[1]);
    history.replaceState({ view: 'postView', postId }, '', location.hash);
    openPostView(postId, false);
    return;
  }
  const boardMatch = location.hash.match(/^#board-(.+)/);
  if (boardMatch) {
    const category = decodeURIComponent(boardMatch[1]);
    history.replaceState({ view: 'board', category }, '', location.hash);
    changeBoard(category, false);
    return;
  }
  history.replaceState({ view: 'board', category: '전체' }, '', location.pathname + location.search);
  changeBoard('전체', false);
}

// #privacy는 게시글 데이터가 필요 없어서, fetchPosts()를 기다리지 않고 곧바로 연다.
// (fetchPosts 완료를 기다렸다가 routeFromHash 안에서 처리하면, 이 fetch가 오래 걸릴 때
// 그사이 다른 코드가 location.hash를 이미 지워버리는 경우가 있어 레이스가 생겼다.)
if (location.hash === '#privacy') toggleModal('privacyModal', true);

// 초기화: 게시글을 먼저 불러온 뒤에 주소를 반영해야 #post-123 링크로 바로 들어왔을 때 그 글을 찾을 수 있다.
fetchPosts().then(routeFromHash);

// PC 화면에서 사이드바가 스크롤을 스프링처럼 관성 있게 따라오도록 처리
(function initSidebarSpring() {
  const sidebar = document.querySelector('.sidebar');
  const mainEl = document.querySelector('.shell > main');
  if (!sidebar || !mainEl) return;

  const DESKTOP_QUERY = window.matchMedia('(min-width: 841px)');
  const TOP_GAP = 20;
  const STIFFNESS = 0.14;
  const DAMPING = 0.66;

  let current = 0, velocity = 0;
  let baseTop = 0, maxTranslate = 0;

  // 사이드바 자체의 transform을 잠깐 없앤 상태로 재보정해야 밀린 위치가 기준점에 섞이지 않는다.
  function measure() {
    const prevTransform = sidebar.style.transform;
    sidebar.style.transform = 'none';
    baseTop = sidebar.getBoundingClientRect().top + window.scrollY;
    const colBottom = mainEl.getBoundingClientRect().bottom + window.scrollY;
    maxTranslate = Math.max(0, (colBottom - sidebar.offsetHeight) - baseTop);
    sidebar.style.transform = prevTransform;
  }

  function tick() {
    if (DESKTOP_QUERY.matches) {
      const header = document.querySelector('header');
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const target = Math.max(0, Math.min((window.scrollY + headerH + TOP_GAP) - baseTop, maxTranslate));

      velocity += (target - current) * STIFFNESS;
      velocity *= DAMPING;
      current += velocity;
      if (Math.abs(target - current) < 0.05 && Math.abs(velocity) < 0.05) { current = target; velocity = 0; }

      sidebar.style.transform = current !== 0 ? `translateY(${current.toFixed(2)}px)` : '';
    } else if (sidebar.style.transform) {
      sidebar.style.transform = '';
      current = velocity = 0;
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', measure);
  new ResizeObserver(measure).observe(mainEl);

  measure();
  requestAnimationFrame(tick);
})();
