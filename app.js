const $ = id => document.getElementById(id);
  const toggleModal = (id, show) => $(id).style.display = show ? 'flex' : 'none';
  const switchView = (view) => {
    ['postViewSection', 'albumDetailSection', 'boardSection', 'writeSection'].forEach(id => {
      $(id).style.display = (id === view + 'Section') ? 'block' : 'none';
    });
    window.scrollTo(0, 0);
  };

  const SUPABASE_URL = 'https://jvitmimabxupkhrksudu.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aXRtaW1hYnh1cGtocmtzdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU2NDEsImV4cCI6MjEwNDUzMTY0MX0.AD_7HM1C6xhKbXKKOwF6WSRfM1tPHfpj4McmMTJ0jNY';
  const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const ADMIN_EMAIL = 'bkseungah010223@gmail.com'; 

  let currentPosts = [], currentCategory = '전체'; 
  let genSortType = 'latest', genSortDir = 'desc';
  let albSortType = 'review', albSortDir = 'desc'; 
  let currentReadPostId = null, currentUser = null, isAdmin = false, isEditMode = false;
  let tempAlbum = { title: null, artist: null, cover: null };
  let currentSelectedRating = 5;

  function element(tag, className = '', text = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null) node.textContent = String(text ?? '');
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

  function contentParts(value) {
    const text = String(value ?? ''), parts = [];
    const tokens = /\[img\]([\s\S]*?)\[\/img\]|(?:[a-z][a-z0-9+.-]*:\/\/|(?:www\.)?(?:youtube\.com|youtu\.be)\/)\S+/gi;
    let cursor = 0;
    for (const match of text.matchAll(tokens)) {
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
      } else fragment.append(document.createTextNode(part.text));
    }
    return fragment;
  }

  const contentPreview = value => contentParts(value).map(p => p.text ?? '').join('').substring(0, 150) + '...';

  client.auth.onAuthStateChange((event, session) => {
    const authorInput = $('postAuthor');
    if (session) {
      currentUser = session.user;
      const nickname = currentUser.user_metadata?.nickname || currentUser.email.split('@')[0]; 
      isAdmin = currentUser.email === ADMIN_EMAIL;
      
      const status = element('span', '', `${isAdmin ? '[관리자] ' : ''}${nickname}`);
      status.style.cssText = `color: var(--${isAdmin ? 'admin' : 'text'}); font-weight:bold;`;
      $('userStatus').replaceChildren(status, '님');

      $('showLoginBtn').style.display = $('showSignupBtn').style.display = 'none';
      $('showSettingsBtn').style.display = $('logoutBtn').style.display = 'inline-block';
      
      authorInput.value = nickname; 
    } else {
      currentUser = null; isAdmin = false;
      $('userStatus').replaceChildren();
      $('showLoginBtn').style.display = $('showSignupBtn').style.display = 'inline-block';
      $('showSettingsBtn').style.display = $('logoutBtn').style.display = 'none';
      authorInput.value = ''; 
    }
  });

  window.openSettings = () => {
    $('settingNickname').value = currentUser.user_metadata?.nickname || currentUser.email.split('@')[0];
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
  
  $('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); alert('로그아웃 됨'); });

  $('postTag').addEventListener('change', (e) => {
    const isAlbum = e.target.value === '앨범 평가';
    $('albumSearchWrap').style.display = isAlbum ? 'block' : 'none';
    if (!isAlbum) tempAlbum = { title: null, artist: null, cover: null }; 
  });

  $('btnSearchAlbum').addEventListener('click', async () => {
    const query = $('albumQuery').value.trim(), searchType = $('searchType').value;
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

  $('starsContainer').addEventListener('click', (e) => {
    if(e.target.classList.contains('star')) setStars(parseInt(e.target.dataset.value));
  });

  function setStars(val) {
    currentSelectedRating = val;
    document.querySelectorAll('#starsContainer .star').forEach(s => s.style.color = parseInt(s.dataset.value) <= val ? 'var(--special)' : 'var(--border)');
    const msgs = ['별로임 (1점)', '아쉬움 (2점)', '들을만함 (3점)', '훌륭함 (4점)', '명반! (5점)'];
    $('starRatingText').innerText = msgs[val-1];
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
  });

  $('openWriteBtn').onclick = () => {
    if (!currentUser) return alert('로그인 후 이용할 수 있습니다.');
    isEditMode = false;
    $('writeSectionTitle').textContent = '새 글 작성하기'; $('savePostBtn').textContent = '등록하기';
    $('postTitle').value = ''; $('postContent').value = '';
    
    let targetTag = ['전체'].includes(currentCategory) ? '인디' : currentCategory;
    $('postTag').value = targetTag || '자유';
    $('postTag').dispatchEvent(new Event('change'));

    $('albumResults').replaceChildren(); $('albumQuery').value = '';
    $('selAlbumWrap').style.display = 'none'; $('starInputWrapper').style.display = 'none';
    tempAlbum = { title: null, artist: null, cover: null };

    switchView('write'); 
  };

  window.openWriteWithAlbumParams = (title, artist, cover) => {
    $('openWriteBtn').click();
    $('postTag').value = '앨범 평가'; $('postTag').dispatchEvent(new Event('change'));
    selectAlbum(title, artist, cover);
  };

  async function fetchPosts() {
    const { data, error } = await client.from('posts').select('*').order('id', { ascending: false });
    if (!error && data) currentPosts = data;
    renderPosts(); 
  }

  window.toggleSort = (type) => {
    genSortDir = genSortType === type ? (genSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
    genSortType = type;
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
    const hotPosts = [...currentPosts].filter(p => p.recs > 0 || p.views > 5).sort((a, b) => (b.recs !== a.recs) ? b.recs - a.recs : b.views - a.views).slice(0, 3);
    
    if (hotPosts.length) {
      widgetArea.replaceChildren(...hotPosts.map((post, i) => {
        const card = element('div', 'widget-card');
        card.onclick = () => openPostView(post.id);
        const stats = element('div', 'widget-stats');
        const recs = element('span', '', `추천 ${post.recs || 0}`); recs.style.color = 'var(--music)';
        const author = element('span', '', post.author || 'ㅇㅇ'); author.style.marginLeft = 'auto';
        stats.append(element('span', '', `조회 ${post.views || 0}`), recs, author);
        card.append(element('span', 'hot-badge', `HOT ${i + 1}`), element('div', 'widget-title', post.title), stats);
        return card;
      }));
    } else widgetArea.innerHTML = '<div style="color:var(--muted); font-size:13px; padding:10px;">핫게시글이 없습니다.</div>';

    if (currentCategory === '앨범 평가') {
      $('postTableArea').style.display = 'none'; $('albumGrid').style.display = 'grid';

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
      
      if(!sortedAlbums.length) {
        $('albumGrid').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--muted);">검색된 앨범이 없습니다. 명반을 직접 추가해 보세요!</div>';
      } else {
        $('albumGrid').replaceChildren(...sortedAlbums.map(a => {
          const card = element('div', 'album-card'); card.onclick = () => openAlbumDetail(a.title, a.artist);
          const img = element('img'); img.loading = 'lazy'; setImageSource(img, a.cover);
          const info = element('div', 'album-card-info');
          const rating = element('div', 'album-card-rating', `★ ${(a.totalScore/a.count).toFixed(1)} `);
          rating.append(element('span', '', `(${a.count}명)`));
          info.append(element('div', 'album-card-title', a.title), element('div', 'album-card-artist', a.artist), rating);
          card.append(img, info);
          return card;
        }));
      }
    } else {
      $('albumGrid').style.display = 'none'; $('postTableArea').style.display = 'block';
      const tbody = $('postList');
      
      let filtered = currentCategory === '전체' ? [...currentPosts] : 
                     (currentCategory === '인디' ? currentPosts.filter(p => ['국내 인디', '해외 인디', '인디'].includes(p.tag)) : 
                     currentPosts.filter(p => p.tag === currentCategory));

      filtered.sort((a, b) => {
        let diff = genSortType === 'popular' ? ((b.recs !== a.recs ? (b.recs||0) - (a.recs||0) : (b.views !== a.views ? (b.views||0) - (a.views||0) : b.id - a.id))) : (b.id - a.id);
        return genSortDir === 'desc' ? diff : -diff;
      });

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--muted);">게시글이 없습니다.</td></tr>';
        $('boardFooter').style.display = 'none';
      } else {
        $('boardFooter').style.display = 'flex';
        const total = filtered.length;
        
        tbody.replaceChildren(...filtered.map((post, i) => {
          const displayNum = genSortDir === 'desc' ? total - i : i + 1;
          const row = element('tr');
          
          const tag = element('td', 'col-category');
          tag.append(element('span', `tag${post.recs >= 3 ? ' hot' : ''}`, post.tag));
          
          const titleCell = element('td', 'col-title');
          const link = element('a', 'dc-title-link', post.title); 
          link.href = '#'; link.onclick = e => { e.preventDefault(); openPostView(post.id); };
          titleCell.append(link);
          
          if (post.album_title) titleCell.append(element('span', 'dc-comment-count', `★ ${post.rating}`)); 
          
          const authorCell = element('td', 'col-author', post.author || 'ㅇㅇ');
          
          const dateFormatted = new Date(post.created_at).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');
          const dateCell = element('td', 'col-date', dateFormatted);
          
          const viewsCell = element('td', 'col-views tabular', post.views || 0);
          
          const recsVal = post.recs || 0;
          const recsCell = element('td', 'col-likes tabular', recsVal);
          if(recsVal > 0) recsCell.style.cssText = 'color:#d31900; font-weight:bold;'; 
          
          row.append(
            element('td', 'col-id tabular', displayNum), 
            tag, 
            titleCell, 
            authorCell, 
            dateCell, 
            viewsCell, 
            recsCell
          );
          return row;
        }));
      }
    }
  }

  window.openAlbumDetail = (title, artist) => {
    const albumPosts = currentPosts.filter(p => p.tag === '앨범 평가' && p.album_title === title && p.album_artist === artist);
    if(!albumPosts.length) return;
    
    setImageSource($('adCover'), albumPosts[0].album_cover);
    $('adTitle').innerText = title; $('adArtist').innerText = artist;
    $('adScore').replaceChildren(`★ ${(albumPosts.reduce((s, p) => s + Number(p.rating||0), 0) / albumPosts.length).toFixed(1)} `, element('span', '', `(${albumPosts.length}명 참여)`));
    $('adReviews').replaceChildren(...albumPosts.map(p => {
      const card = element('div', 'review-card'); card.onclick = () => openPostView(p.id);
      const header = element('div', 'rc-header'); header.append(element('span', 'rc-author', p.author || 'ㅇㅇ(유동)'), element('span', 'rc-stars', `★ ${p.rating}`));
      card.append(header, element('div', 'rc-title', p.title), element('div', 'rc-content', contentPreview(p.content)));
      return card;
    }));
    switchView('albumDetail');
  };

  function changeBoard(category) {
    currentCategory = category;
    const isAlbum = category === '앨범 평가';
    
    $('generalBoardHeader').style.display = isAlbum ? 'none' : 'flex';
    $('albumBoardHeader').style.display = isAlbum ? 'flex' : 'none';
    if (!isAlbum) $('boardTitle').innerText = category === '전체' ? '전체 게시판' : category + ' 게시판';
    
    document.querySelectorAll('.sidebar a').forEach(link => link.classList.toggle('active', link.getAttribute('onclick').includes(`'${category}'`)));
    $('albumBoardSearchInput').value = ''; 
    
    genSortType = 'latest'; genSortDir = 'desc'; albSortType = 'review'; albSortDir = 'desc';
    $('btnSortLatest').innerText = '최신순'; $('btnSortPopular').innerText = '인기순';
    $('btnSortAlbumReview').innerText = '리뷰 많은순'; $('btnSortAlbumDate').innerText = '최신순'; $('btnSortAlbumRating').innerText = '평점 높은순';
    
    backToList();
  }

  async function openPostView(postId) {
    const post = currentPosts.find(p => p.id === postId); if(!post) return;
    currentReadPostId = postId;
    
    $('readTitle').textContent = post.title; $('readTag').textContent = post.tag;
    $('readAuthor').textContent = post.author || 'ㅇㅇ'; $('readDate').textContent = new Date(post.created_at).toLocaleString('ko-KR');
    $('readContent').replaceChildren(formatContent(post.content));
    $('readViews').textContent = (post.views || 0) + 1;
    $('readRecs').textContent = $('btnRecCount').textContent = post.recs || 0;
    $('adminEditBtn').style.display = $('adminDeleteBtn').style.display = isAdmin ? 'inline-block' : 'none';

    if(post.tag === '앨범 평가' && post.album_title) {
      $('btnEvalSame').style.display = 'inline-block';
      $('btnEvalSame').onclick = () => openWriteWithAlbumParams(post.album_title, post.album_artist, post.album_cover);
    } else $('btnEvalSame').style.display = 'none';

    switchView('postView');
    await client.rpc('increment_views', { post_id: postId });
  }

  window.backToList = () => { renderPosts(); switchView('board'); };

  $('recommendBtn').addEventListener('click', async () => {
    if(!currentReadPostId || localStorage.getItem('rec_' + currentReadPostId)) return alert(currentReadPostId ? '이미 추천했습니다.' : '');
    const post = currentPosts.find(p => p.id === currentReadPostId); post.recs = (post.recs || 0) + 1;
    $('readRecs').textContent = $('btnRecCount').textContent = post.recs;
    localStorage.setItem('rec_' + currentReadPostId, 'true'); alert('추천 완료!');
    await client.rpc('increment_recs', { post_id: currentReadPostId });
  });

  $('adminEditBtn').addEventListener('click', () => {
    const post = currentPosts.find(p => p.id === currentReadPostId);
    isEditMode = true; $('writeSectionTitle').textContent = '게시글 수정하기'; $('savePostBtn').textContent = '수정 완료';
    $('postTag').value = post.tag; $('postTitle').value = post.title; $('postContent').value = post.content;
    $('albumSearchWrap').style.display = 'none';
    if(isAdmin) $('postAuthor').value = post.author || 'ㅇㅇ';
    switchView('write');
  });

  $('adminDeleteBtn').addEventListener('click', async () => {
    if(!confirm('삭제하시겠습니까?')) return;
    const { error } = await client.from('posts').delete().eq('id', currentReadPostId);
    if (!error) { alert('삭제됨'); backToList(); fetchPosts(); }
  });

  $('savePostBtn').addEventListener('click', async () => {
    if (!currentUser) return alert('로그인 후 이용할 수 있습니다.');
    const tag = $('postTag').value, title = $('postTitle').value, content = $('postContent').value, author = $('postAuthor').value.trim() || 'ㅇㅇ(유동)';
    if (!title.trim()) return alert('제목을 입력해주세요.'); 
    if (tag === '앨범 평가' && !tempAlbum.title && !isEditMode) return alert('검색을 통해 평가할 앨범을 선택해주세요!');

    $('savePostBtn').disabled = true; $('savePostBtn').textContent = '처리 중...';
    let error;
    if (isEditMode) {
      ({ error } = await client.from('posts').update({ tag, author, title, content }).eq('id', currentReadPostId));
    } else {
      const postData = { tag, author, title, content, ...(tag === '앨범 평가' && { album_title: tempAlbum.title, album_artist: tempAlbum.artist, album_cover: tempAlbum.cover, rating: currentSelectedRating }) };
      ({ error } = await client.from('posts').insert([postData]));
    }
    
    $('savePostBtn').disabled = false;
    if (!error) { alert(isEditMode ? '수정됨' : '등록됨'); backToList(); fetchPosts(); } else alert('실패: ' + (error.message || ''));
  });

  fetchPosts();
