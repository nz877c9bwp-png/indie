// --- 공통 유틸리티 및 보안 ---
const $ = id => document.getElementById(id);
const toggleModal = (id, show) => $(id).style.display = show ? 'flex' : 'none';
const switchView = (view) => {
  ['postViewSection', 'albumDetailSection', 'boardSection', 'writeSection'].forEach(id => {
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

// --- 상태 관리 변수 ---
let currentPosts = [], currentCategory = '전체'; 
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

// 같이 갈 사람/장터는 카카오 로그인 사용자만 글을 쓸 수 있다 (서버 RLS에서도 동일하게 강제됨).
const RESTRICTED_TAGS = ['같이 갈 사람', '장터'];
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

// 유동 글/댓글의 기본 닉네임. "인좋"이 이미 쓰였으면 인좋2, 인좋3처럼 안 겹치는 다음 번호를 찾는다.
function nextGuestNickname(existingAuthors) {
  const used = new Set(existingAuthors);
  let candidate = '인좋', n = 2;
  while (used.has(candidate)) { candidate = `인좋${n}`; n += 1; }
  return candidate;
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
    $('showSettingsBtn').style.display = $('logoutBtn').style.display = 'inline-block';
    
    if(authorInput) authorInput.value = nickname; 
  } else {
    currentUser = null; isAdmin = false;
    $('userStatus').replaceChildren();
    $('showLoginBtn').style.display = $('showSignupBtn').style.display = 'inline-block';
    $('showSettingsBtn').style.display = $('logoutBtn').style.display = 'none';
    if(authorInput) authorInput.value = ''; 
  }
});

window.openSettings = () => {
  $('settingNickname').value = currentUser ? resolveNickname(currentUser) : '';
  toggleModal('settingsModal', true);
};

$('doSaveSettingsBtn').addEventListener('click', async () => {
  const newNick = $('settingNickname').value.trim();
  if(!newNick) return alert('변경할 닉네임을 입력해주세요.');
  $('doSaveSettingsBtn').disabled = true; $('doSaveSettingsBtn').textContent = '저장 중...';
  const { error } = await client.auth.updateUser({ data: { nickname: newNick } });
  $('doSaveSettingsBtn').disabled = false; $('doSaveSettingsBtn').textContent = '저장하기';
  if (error) alert('실패: ' + error.message);
  else { alert('변경 완료!'); toggleModal('settingsModal', false); location.reload(); }
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

// 카카오는 OAuth 특성상 로그인/회원가입이 동일한 호출이다 (처음 인증하면 자동으로 계정이 생성됨).
// Supabase는 카카오 로그인에 한해 scopes 옵션과 무관하게 account_email을 강제로 포함시키므로,
// 클라이언트에서 스코프를 좁혀도 KOE205를 피할 수 없다 (카카오 앱에 이메일 동의항목을 등록해야 해결됨).
async function kakaoAuth() {
  const { error } = await client.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: location.origin } });
  if (error) alert('카카오 인증 실패: ' + error.message);
}
$('kakaoLoginBtn').addEventListener('click', kakaoAuth);
$('kakaoSignupBtn').addEventListener('click', kakaoAuth);

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
  const isBaseball = e.target.value === '야구';
  $('albumSearchWrap').style.display = isAlbum ? 'block' : 'none';
  if (!isAlbum) tempAlbum = { title: null, artist: null, cover: null };
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
      card.addEventListener('click', () => selectAlbum(a.collectionName, a.artistName, coverUrl));
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

window.selectAlbum = (title, artist, cover) => {
  tempAlbum = { title, artist, cover: imageUrl(cover) }; 
  $('selAlbumWrap').style.display = 'flex'; $('starInputWrapper').style.display = 'flex';
  setImageSource($('selCover'), tempAlbum.cover);
  $('selTitle').innerText = title; $('selArtist').innerText = artist;
  setStars(5); 
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
  const msgs = ['별로임', '아쉬움', '들을만함', '훌륭함', '명반!'];
  const labelIdx = Math.min(5, Math.max(1, Math.round(val)));
  $('starRatingText').innerText = `${msgs[labelIdx-1]} (${val}점)`;
  $('starRatingText').style.color = val >= 4 ? 'var(--special)' : 'var(--text)';
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
  $('postAuthor').value = currentUser ? resolveNickname(currentUser) : nextGuestNickname(currentPosts.map(p => p.author));

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

window.openWriteWithAlbumParams = (title, artist, cover) => {
  $('openWriteBtn').click();
  $('postTag').value = '앨범 평가'; $('postTag').dispatchEvent(new Event('change'));
  selectAlbum(title, artist, cover);
};

// --- 게시글 데이터 및 렌더링 ---
async function fetchPosts() {
  const { data, error } = await client.from('posts').select('id, created_at, tag, author, title, content, team, user_id, album_title, album_artist, album_cover, rating, views, recs, is_notice, is_kakao').order('id', { ascending: false });
  if (!error && data) currentPosts = data;
  renderPosts(); 
}

window.toggleSort = (type) => {
  genSortDir = genSortType === type ? (genSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
  genSortType = type;
  currentPage = 1;
  $('btnSortLatest').className = type === 'latest' ? 'active' : '';
  $('btnSortLatest').innerText = type === 'latest' && genSortDir === 'asc' ? '오래된순' : '최신순';
  $('btnSortPopular').className = type === 'popular' ? 'active' : '';
  $('btnSortPopular').innerText = type === 'popular' && genSortDir === 'asc' ? '비인기순' : '인기순';
  renderPosts();
};

window.toggleAlbumSort = (type) => {
  albSortDir = albSortType === type ? (albSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
  albSortType = type;
  $('btnSortAlbumReview').className = type === 'review' ? 'active' : '';
  $('btnSortAlbumReview').innerText = type === 'review' && albSortDir === 'asc' ? '리뷰 적은순' : '리뷰 많은순';
  $('btnSortAlbumDate').className = type === 'date' ? 'active' : '';
  $('btnSortAlbumDate').innerText = type === 'date' && albSortDir === 'asc' ? '오래된순' : '최신순';
  $('btnSortAlbumRating').className = type === 'rating' ? 'active' : '';
  $('btnSortAlbumRating').innerText = type === 'rating' && albSortDir === 'asc' ? '평점 낮은순' : '평점 높은순';
  renderPosts();
};

function renderPosts() {
  const widgetArea = $('topWidgetArea');
  const hotPosts = currentPosts.filter(p => p.recs > 0 || p.views > 5).sort((a, b) => (b.recs !== a.recs) ? b.recs - a.recs : b.views - a.views).slice(0, 3);
  
  if (hotPosts.length) {
    widgetArea.replaceChildren(...hotPosts.map((post, i) => {
      const card = element('div', 'widget-card');
      card.onclick = () => openPostView(post.id);
      const stats = element('div', 'widget-stats');
      const recs = element('span', '', `추천 ${post.recs || 0}`); recs.style.color = 'var(--music)';
      const author = element('span', 'author-wrap'); author.style.marginLeft = 'auto';
      author.append(element('span', 'author-name', post.author || 'ㅇㅇ'));
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
    currentPosts.filter(p => p.tag === '앨범 평가' && p.album_title).forEach(p => {
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

    const albumSignature = `${albSortType}|${albSortDir}|${keyword}`;
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
    
    let filtered = currentCategory === '전체' ? [...currentPosts] : 
                   (currentCategory === '인디' ? currentPosts.filter(p => ['국내 인디', '해외 인디', '인디'].includes(p.tag)) : 
                   currentPosts.filter(p => p.tag === currentCategory));

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

    // 공지글은 전체 게시판(검색 중이 아닐 때)에서 정렬 기준보다 우선해 항상 맨 위에 고정한다.
    const pinNotices = currentCategory === '전체' && !postSearchKeyword;
    filtered.sort((a, b) => {
      if (pinNotices && a.is_notice !== b.is_notice) return a.is_notice ? -1 : 1;
      let diff = genSortType === 'popular' ? ((b.recs !== a.recs ? (b.recs||0) - (a.recs||0) : (b.views !== a.views ? (b.views||0) - (a.views||0) : b.id - a.id))) : (b.id - a.id);
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
        tag.append(element('span', 'tag', post.tag));

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

        if (post.album_title) titleCell.append(element('span', 'dc-comment-count', `★ ${formatRating(post.rating)}`));
        
        const authorCell = element('td', 'col-author');
        const authorWrap = element('span', 'author-wrap');
        authorWrap.append(element('span', 'author-name', post.author || 'ㅇㅇ'));
        if (post.is_kakao) authorWrap.append(kakaoMark());
        if (post.tag === '야구' && post.team) authorWrap.append(teamBadge(post.team));
        authorCell.append(authorWrap);

        const dateFormatted = new Date(post.created_at).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');
        const dateCell = element('td', 'col-date', dateFormatted);
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

window.openAlbumDetail = (title, artist, pushHistory = true) => {
  const albumPosts = currentPosts.filter(p => p.tag === '앨범 평가' && p.album_title === title && p.album_artist === artist);
  if(!albumPosts.length) return;
  
  setImageSource($('adCover'), albumPosts[0].album_cover);
  $('adTitle').innerText = title; $('adArtist').innerText = artist;
  $('adScore').replaceChildren(`★ ${(albumPosts.reduce((s, p) => s + Number(p.rating||0), 0) / albumPosts.length).toFixed(1)} `, element('span', '', `(${albumPosts.length}명 참여)`));
  $('adReviews').replaceChildren(...albumPosts.map(p => {
    const card = element('div', 'review-card'); card.onclick = () => openPostView(p.id);
    const header = element('div', 'rc-header'); header.append(element('span', 'rc-author', escapeHTML(p.author || 'ㅇㅇ(유동)')), element('span', 'rc-stars', `★ ${formatRating(p.rating)}`));
    card.append(header, element('div', 'rc-title', escapeHTML(p.title)), element('div', 'rc-content', contentPreview(p.content)));
    return card;
  }));
  switchView('albumDetail');
  if (pushHistory) history.pushState({ view: 'albumDetail', albumTitle: title, albumArtist: artist }, '', '#album');
};

function changeBoard(category, pushHistory = true) {
  currentCategory = category;
  const isAlbum = category === '앨범 평가';
  const isBaseball = category === '야구';
  
  $('generalBoardHeader').style.display = isAlbum ? 'none' : 'flex';
  $('albumBoardHeader').style.display = isAlbum ? 'flex' : 'none';
  $('baseballTeamTabs').style.display = isBaseball ? 'flex' : 'none';
  if (isBaseball) { baseballTeamFilter = '전체'; renderBaseballTabs(); }
  if (!isAlbum) $('boardTitle').innerText = category === '전체' ? '전체 게시판' : category + ' 게시판';
  
  document.querySelectorAll('.sidebar a').forEach(link => link.classList.toggle('active', link.getAttribute('onclick')?.includes(`'${category}'`)));
  $('albumBoardSearchInput').value = '';
  postSearchType = 'all'; postSearchKeyword = '';
  $('postSearchType').value = 'all'; $('postSearchInput').value = '';
  currentPage = 1;

  genSortType = 'latest'; genSortDir = 'desc'; albSortType = 'review'; albSortDir = 'desc';
  $('btnSortLatest').innerText = '최신순'; $('btnSortPopular').innerText = '인기순';
  $('btnSortAlbumReview').innerText = '리뷰 많은순'; $('btnSortAlbumDate').innerText = '최신순'; $('btnSortAlbumRating').innerText = '평점 높은순';
  
  backToList();
  if (pushHistory) history.pushState({ view: 'board', category }, '', '#board-' + encodeURIComponent(category));
}

// --- 댓글 및 대댓글 기능 ---
async function fetchAndRenderComments() {
  if (!currentReadPostId) return;
  const { data, error } = await client.from('comments').select('id, created_at, post_id, parent_id, author, content, user_id, is_kakao').eq('post_id', currentReadPostId).order('id', { ascending: true });
  if (error) return console.error('댓글 불러오기 실패:', error);
  
  currentComments = data || [];
  $('commentCount').textContent = currentComments.length;

  // 유동 댓글 기본 닉네임: 이 글의 댓글 중 이미 쓰인 "인좋"류와 안 겹치는 다음 번호로.
  if (!currentUser) $('commentAuthor').value = nextGuestNickname(currentComments.map(c => c.author));

  const parents = currentComments.filter(c => !c.parent_id);
  const replies = currentComments.filter(c => c.parent_id);
  
  const list = $('commentList');
  list.replaceChildren();

  if (parents.length === 0) {
    list.innerHTML = '<li style="padding:30px; text-align:center; color:var(--muted); border-bottom:1px solid var(--border);">등록된 댓글이 없습니다.</li>';
    return;
  }

  parents.forEach(parent => {
    list.append(createCommentElement(parent, false));
    replies.filter(r => r.parent_id === parent.id).forEach(reply => {
      list.append(createCommentElement(reply, true));
    });
  });
}

function createCommentElement(comment, isReply) {
  const li = element('li', `comment-item ${isReply ? 'reply' : ''}`);
  const meta = element('div', 'ci-meta');
  
  let authorDisplay = comment.author || 'ㅇㅇ';
  if (isReply) authorDisplay = '↳ ' + authorDisplay;

  const authorSpan = element('span', 'ci-author', authorDisplay);
  if (comment.is_kakao) authorSpan.append(kakaoMark());
  // 댓글 작성자 닉네임이 이 글의 작성자 닉네임과 같으면(예: 인좋) 글쓴이가 단 댓글임을 표시.
  const openPost = currentPosts.find(p => p.id === currentReadPostId);
  if (openPost && comment.author && comment.author === openPost.author) {
    authorSpan.append(element('span', 'ci-op-badge', '(작성자)'));
  }

  meta.append(
    authorSpan,
    element('span', 'ci-date', new Date(comment.created_at).toLocaleString('ko-KR', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}))
  );
  
  const actions = element('div', 'ci-actions');
  if (!isReply) {
    const replyBtn = element('button', '', '답글');
    replyBtn.onclick = () => toggleReplyForm(comment.id);
    actions.append(replyBtn);
  }
  
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
  
  if (!isReply) {
    const replyForm = element('div', 'reply-write-form');
    replyForm.id = `replyForm_${comment.id}`;
    replyForm.innerHTML = `
      <div class="cw-author"><input type="text" id="replyAuthor_${comment.id}" placeholder="닉네임 (유동)" value="${currentUser ? escapeHTML(resolveNickname(currentUser)) : escapeHTML(nextGuestNickname(currentComments.map(c => c.author)))}"><input type="password" id="replyGuestPw_${comment.id}" placeholder="비밀번호" maxlength="20" style="${currentUser ? 'display:none;' : ''}"></div>
      <div class="cw-input">
        <textarea id="replyContent_${comment.id}" placeholder="대댓글을 입력하세요."></textarea>
        <button onclick="submitComment(${comment.id})">등록</button>
      </div>
    `;
    li.append(replyForm);
  }
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
  if (post.is_kakao) $('readAuthor').append(kakaoMark());
  $('readTeamBadge').replaceChildren();
  if (post.tag === '야구' && post.team) $('readTeamBadge').append(teamBadge(post.team));
  $('readDate').textContent = new Date(post.created_at).toLocaleString('ko-KR');
  $('readContent').replaceChildren(formatContent(post.content)); // 렌더링 시 escapeHTML 적용됨

  if (post.tag === '앨범 평가' && post.album_title) {
    $('readAlbumInfo').style.display = 'flex';
    setImageSource($('readAlbumCover'), post.album_cover);
    $('readAlbumName').textContent = post.album_title;
    $('readAlbumArtist').textContent = post.album_artist || '';
    $('readAlbumRating').textContent = `★ ${formatRating(post.rating)}`;
  } else {
    $('readAlbumInfo').style.display = 'none';
  }
  $('readViews').textContent = (post.views || 0) + 1;
  $('readRecs').textContent = $('btnRecCount').textContent = post.recs || 0;

  // 유동(비로그인) 사용자가 이 글을 이미 추천했으면 버튼을 비활성화해서 재추천 시도를 막는다.
  const alreadyRecommended = !currentUser && hasCachedRecommend(postId);
  $('recommendBtn').disabled = alreadyRecommended;
  $('recommendBtn').style.opacity = alreadyRecommended ? '0.5' : '';

  // 수정/삭제: 관리자, 본인이 쓴 글, 유동(비로그인) 글(비밀번호로 인증) 모두 가능.
  const isAuthor = currentUser && currentUser.id === post.user_id;
  const isGuestPost = !post.user_id;
  $('adminEditBtn').style.display = (isAdmin || isAuthor || isGuestPost) ? 'inline-block' : 'none';
  $('adminDeleteBtn').style.display = (isAdmin || isAuthor || isGuestPost) ? 'inline-block' : 'none';
  $('adminNoticeBtn').style.display = isAdmin ? 'inline-block' : 'none';
  $('adminNoticeBtn').textContent = post.is_notice ? '공지 해제' : '공지 등록';

  if(post.tag === '앨범 평가' && post.album_title) {
    $('btnEvalSame').style.display = 'inline-block';
    $('btnEvalSame').onclick = () => openWriteWithAlbumParams(post.album_title, post.album_artist, post.album_cover);
  } else $('btnEvalSame').style.display = 'none';

  if (currentUser) $('commentAuthor').value = resolveNickname(currentUser);
  // 유동 기본 닉네임은 이 글의 댓글 목록을 불러온 뒤 fetchAndRenderComments에서 채운다 (중복 확인 필요).
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
  changeBoard('전체');
  postSearchType = 'all';
  postSearchKeyword = keyword;
  $('postSearchType').value = 'all';
  $('postSearchInput').value = keyword;
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
  const guestPw = $('postGuestPw').value.trim();

  if (!title.trim()) return alert('제목을 입력해주세요.');
  if (tag === '앨범 평가' && !tempAlbum.title && !isEditMode) return alert('검색을 통해 평가할 앨범을 선택해주세요!');
  if (tag === '야구' && !team) return alert('응원하는 팀을 선택해주세요!');
  if (RESTRICTED_TAGS.includes(tag) && !(isAdmin || isKakaoUser())) return alert('회원 간 거래, 오프라인 만남의 안전을 위해 카카오 로그인 사용자만 글을 쓸 수 있는 게시판입니다.');
  if (!currentUser && !isEditMode && !guestPw) return alert('유동 글쓰기는 비밀번호가 필요합니다. (나중에 삭제할 때 사용)');

  const editingPost = isEditMode ? currentPosts.find(p => p.id === currentReadPostId) : null;
  const canDirectEdit = isEditMode && (isAdmin || (currentUser && editingPost && currentUser.id === editingPost.user_id));
  if (isEditMode && !canDirectEdit && !guestPw) return alert('수정하려면 작성 시 입력한 비밀번호가 필요합니다.');

  $('savePostBtn').disabled = true; $('savePostBtn').textContent = '처리 중...';
  let error;
  if (isEditMode) {
    const ratingField = tag === '앨범 평가' ? { rating: currentSelectedRating } : {};
    if (canDirectEdit) {
      const updateData = { tag, author, title, content, team: tag === '야구' ? team : null, ...ratingField };
      ({ error } = await client.from('posts').update(updateData).eq('id', currentReadPostId));
    } else {
      const { data, error: rpcError } = await client.rpc('edit_post_with_password', {
        p_id: currentReadPostId, p_password: guestPw, p_tag: tag, p_author: author, p_title: title, p_content: content,
        p_team: tag === '야구' ? team : null, p_rating: tag === '앨범 평가' ? currentSelectedRating : null
      });
      error = rpcError || (!data ? { message: '비밀번호가 틀렸습니다.' } : null);
    }
  } else {
    const postData = {
      tag, author, title, content, user_id: currentUser ? currentUser.id : null,
      ...(!currentUser && { guest_password: guestPw }),
      ...(tag === '앨범 평가' && { album_title: tempAlbum.title, album_artist: tempAlbum.artist, album_cover: tempAlbum.cover, rating: currentSelectedRating }),
      ...(tag === '야구' && { team })
    };
    ({ error } = await client.from('posts').insert([postData]));
  }

  $('savePostBtn').disabled = false; $('savePostBtn').textContent = isEditMode ? '수정 완료' : '등록하기';
  if (!error) { alert(isEditMode ? '수정됨' : '등록됨'); returnToBoardAfterAction(); fetchPosts(); }
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
    changeBoard(state?.category || '전체', false);
  } else if (state.view === 'postView') {
    openPostView(state.postId, false);
  } else if (state.view === 'albumDetail') {
    openAlbumDetail(state.albumTitle, state.albumArtist, false);
  } else if (state.view === 'write') {
    switchView('write');
  }
});

// 휠클릭/새 탭 열기 등으로 #post-123 같은 주소에 바로 들어왔을 때, 게시판 목록이 아니라 해당 글이 뜨게 한다.
function routeFromHash() {
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
