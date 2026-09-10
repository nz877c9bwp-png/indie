const { test, expect, boot, assertClean, normalPosts } = require('./harness');

test('regression: board text, HOT cards, post navigation, image and YouTube', async ({ page }) => {
  const state = await boot(page);
  await expect(page.locator('#postList tr')).toHaveCount(3);
  await expect(page.locator('#postList tr').first().locator('.tag')).toHaveText('국내 인디');
  await expect(page.locator('#postList tr').first().locator('.col-author')).toHaveText('작성자 <문자>');
  await expect(page.locator('.widget-card')).toHaveCount(2);
  await expect(page.locator('.widget-title').first()).toHaveText(normalPosts[0].title);
  await page.locator('#postList a').first().click();
  await expect(page.locator('#postViewSection')).toBeVisible();
  await expect(page.locator('#readTitle')).toHaveText(normalPosts[0].title);
  await expect(page.locator('#readAuthor')).toHaveText(normalPosts[0].author);
  await expect(page.locator('#readTag')).toHaveText(normalPosts[0].tag);
  expect(await page.locator('#readContent').textContent()).toContain('첫 줄\n둘째 줄');
  await expect(page.locator('#readContent img')).toHaveAttribute('src', 'https://assets.test/cover.png');
  await expect.poll(() => page.locator('#readContent img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#readContent iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/abcdefghijk');
  await page.locator('#postViewSection .btn-list').first().click();
  await expect(page.locator('#postViewSection')).toBeHidden();
  await page.locator('.widget-card').first().click();
  await expect(page.locator('#readTitle')).toHaveText(normalPosts[0].title);
  await expect.poll(() => page.evaluate(() => window.mockCalls.filter(c => c.action === 'update').length)).toBe(2);
  await page.locator('.sidebar a').filter({ hasText: /^국내 인디$/ }).click();
  await expect(page.locator('#postList tr')).toHaveCount(1);
  await expect(page.locator('#boardTitle')).toHaveText('국내 인디 게시판');
  await assertClean(page, state);
});

test('regression: album averages, review text, navigation and preselected writing', async ({ page }) => {
  const state = await boot(page);
  await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).click();
  await expect(page.locator('.album-card')).toHaveCount(1);
  await expect(page.locator('.album-card-rating')).toHaveText('★ 4 (2명)');
  await page.locator('.album-card').click();
  await expect(page.locator('#albumDetailSection')).toBeVisible();
  await expect(page.locator('#adTitle')).toHaveText(normalPosts[1].album_title);
  await expect(page.locator('#adArtist')).toHaveText(normalPosts[1].album_artist);
  await expect(page.locator('#adScore')).toHaveText('★ 4 (2명 참여)');
  await expect(page.locator('.rc-title').first()).toHaveText('좋은 리뷰');
  await expect(page.locator('.rc-author').first()).toHaveText('리뷰어');
  expect(await page.locator('.rc-content').first().textContent()).toBe(normalPosts[1].content + '...');
  await page.locator('.review-card').first().click();
  await expect(page.locator('#readTitle')).toHaveText('좋은 리뷰');
  await page.locator('#postViewSection .btn-list').first().click();
  await page.locator('.album-card').click();
  await page.locator('#albumDetailSection .write-btn').click();
  await expect(page.locator('#writeSection')).toBeVisible();
  await expect(page.locator('#postTag')).toHaveValue('앨범 평가');
  await expect(page.locator('#selTitle')).toHaveText(normalPosts[1].album_title);
  await expect(page.locator('#starRatingText')).toHaveText('명반! (5점)');
  await page.locator('.btn-cancel-write').click();
  await expect(page.locator('#boardSection')).toBeVisible();
  await assertClean(page, state);
});

test('regression: album search, apostrophes, rating, upload and unchanged insert contract', async ({ page }) => {
  const album = { collectionName: "It's 100% 음악", artistName: "Singer's name", artworkUrl100: 'https://assets.test/100x100bb.png' };
  const state = await boot(page, { albums: [album] });
  await page.locator('#openWriteBtn').click();
  await page.locator('#postTag').selectOption('앨범 평가');
  await page.locator('#albumQuery').fill("Singer's name");
  await page.locator('#btnSearchAlbum').click();
  await expect(page.locator('.s-title')).toHaveText(album.collectionName);
  await page.locator('.search-item').click();
  await expect(page.locator('#selArtist')).toHaveText(album.artistName);
  await expect(page.locator('#selCover')).toHaveAttribute('src', 'https://assets.test/300x300bb.png');
  await page.locator('.star[data-value="4"]').click();
  await expect(page.locator('#starRatingText')).toHaveText('훌륭함 (4점)');
  await page.locator('#postTitle').fill('새 리뷰');
  await page.locator('#postContent').fill('본문');
  await page.locator('#imageUpload').setInputFiles({ name: 'mock.png', mimeType: 'image/png', buffer: Buffer.from('mock') });
  await expect(page.locator('#postContent')).toHaveValue('본문\n[img]https://assets.test/upload.png[/img]\n');
  await page.locator('#savePostBtn').click();
  await expect(page.locator('#boardSection')).toBeVisible();
  const inserts = await page.evaluate(() => window.mockCalls.filter(c => c.action === 'insert'));
  expect(inserts).toEqual([{ action: 'insert', table: 'posts', data: [{ tag: '앨범 평가', author: '테스터', title: '새 리뷰', content: '본문\n[img]https://assets.test/upload.png[/img]\n', album_title: album.collectionName, album_artist: album.artistName, album_cover: 'https://assets.test/300x300bb.png', rating: 4 }] }]);
  await assertClean(page, state, ['등록됨']);
});

test('regression: empty states, no search results and logged-out writing', async ({ page }) => {
  const state = await boot(page, { posts: [], signedIn: false });
  await expect(page.locator('#postList')).toContainText('등록된 게시글이 없습니다.');
  await expect(page.locator('#topWidgetArea')).toContainText('아직 핫게시글이 없습니다.');
  await page.locator('#openWriteBtn').click();
  await expect(page.locator('#writeSection')).toBeHidden();
  await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).click();
  await expect(page.locator('#albumGrid')).toContainText('아직 평가된 앨범이 없습니다.');
  await page.evaluate(() => window.mockAuth('SIGNED_IN', { user: { email: 'test@example.test', user_metadata: { nickname: '닉네임' } } }));
  await page.locator('#openWriteBtn').click();
  await page.locator('#albumQuery').fill('없는 앨범');
  await page.locator('#btnSearchAlbum').click();
  await expect(page.locator('#albumResults')).toContainText('결과가 없습니다.');
  await assertClean(page, state, ['로그인 후 이용할 수 있습니다.']);
});

const payloads = [
  '<b>HTML 제목</b>',
  '<script>window.__xss++;alert(901)</script>',
  '<img src=x onerror="window.__xss++;alert(902)">',
  '<svg onload="window.__xss++;alert(903)"></svg>',
  '\"><img src=x onerror=alert(904)>',
  "'-alert(905)-'",
  '&lt;img src=x onerror=alert(906)&gt;',
  '</div><iframe srcdoc="<script>alert(907)</script>"></iframe>',
  'javascript:alert(908)',
  '정상 & <문자> "따옴표" \'작은따옴표\' 100% :::'
];
for (const [index, payload] of payloads.entries()) {
  test(`security: plain text in every DB/search/auth surface, payload ${index + 1}`, async ({ page }) => {
    const posts = [
      { ...normalPosts[0], title: payload, author: payload, tag: payload, content: payload },
      { ...normalPosts[1], title: payload, author: payload, content: payload, album_title: payload, album_artist: payload }
    ];
    const state = await boot(page, { posts, nickname: payload, albums: [{ collectionName: payload, artistName: payload, artworkUrl100: 'https://assets.test/cover.png' }] });
    await expect(page.locator('#postList a').first()).toHaveText(payload);
    await expect(page.locator('#postList .col-author').first()).toHaveText(payload);
    await expect(page.locator('#postList .tag').first()).toHaveText(payload);
    await expect(page.locator('#userStatus')).toHaveText(payload + '님');
    await expect(page.locator('.widget-title').first()).toHaveText(payload);
    await expect(page.locator('.widget-stats').first().locator('span').last()).toHaveText(payload);
    await page.locator('#postList a').first().click();
    await expect(page.locator('#readContent')).toHaveText(payload);
    await expect(page.locator('#readTitle')).toHaveText(payload);
    await expect(page.locator('#readAuthor')).toHaveText(payload);
    await expect(page.locator('#readTag')).toHaveText(payload);
    await page.locator('.widget-card').first().click();
    await expect(page.locator('#readTitle')).toHaveText(payload);
    await assertClean(page, state);
    await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).click();
    await expect(page.locator('.album-card-title')).toHaveText(payload);
    await expect(page.locator('.album-card-artist')).toHaveText(payload);
    await page.locator('.album-card').click();
    await expect(page.locator('#adTitle')).toHaveText(payload);
    await expect(page.locator('.rc-title')).toHaveText(payload);
    await expect(page.locator('.rc-author')).toHaveText(payload);
    await expect(page.locator('.rc-content')).toHaveText(payload.substring(0, 150) + '...');
    await page.locator('.review-card').click();
    await expect(page.locator('#readContent')).toHaveText(payload);
    await page.locator('#openWriteBtn').click();
    await page.locator('#albumQuery').fill('mock');
    await page.locator('#btnSearchAlbum').click();
    await expect(page.locator('.s-title')).toHaveText(payload);
    await expect(page.locator('.s-artist')).toHaveText(payload);
    await page.locator('.search-item').click();
    await expect(page.locator('#selTitle')).toHaveText(payload);
    await expect(page.locator('#selArtist')).toHaveText(payload);
    await assertClean(page, state);
  });
}

test('security: invalid image schemes, malformed URLs and attribute breakout stay text', async ({ page }) => {
  const invalid = [
    'https://assets.test/x" onload="alert(1)', "https://assets.test/x' onerror='alert(2)",
    'javascript:alert(3)', 'JaVaScRiPt:alert(3)', 'data:image/svg+xml,<svg onload=alert(4)>',
    'http://assets.test/x.png', '//assets.test/x.png', '/image.png', 'https://', 'https://[broken',
    'https://user:password@assets.test/x.png', 'https:\\assets.test\\x', 'https://assets.test/\nx',
    'https://assets.test/x onerror=alert(5)', 'https://assets.test/<svg>', '\u0000https://assets.test/x'
  ];
  const content = invalid.map(url => `[img]${url}[/img]`).join('\n');
  const state = await boot(page, { posts: [{ ...normalPosts[0], content }] });
  await page.locator('#postList a').click();
  expect(await page.locator('#readContent').textContent()).toBe(content);
  await expect(page.locator('#readContent img, #readContent iframe')).toHaveCount(0);
  await assertClean(page, state);
});

test('security: hostile album/search artwork cannot create attributes or executable URLs', async ({ page }) => {
  const covers = ['https://assets.test/x" onload="window.__xss++;alert(911)', "https://assets.test/x');alert(912);//", 'javascript:alert(913)', 'data:image/svg+xml,<svg onload=alert(914)>', 'https://[broken'];
  const state = await boot(page, {
    posts: covers.map((cover, i) => ({ ...normalPosts[1], id: i + 1, album_title: `Album ${i}`, album_cover: cover })),
    albums: covers.map((cover, i) => ({ collectionName: `Album ${i}`, artistName: 'artist', artworkUrl100: cover }))
  });
  await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).click();
  await expect(page.locator('.album-card')).toHaveCount(covers.length);
  await expect(page.locator('.album-card img[src]')).toHaveCount(0);
  for (let i = 0; i < covers.length; i++) {
    await page.locator('.album-card').nth(i).click();
    await expect(page.locator('#adCover')).not.toHaveAttribute('src');
    await page.locator('#albumDetailSection .btn-list').click();
  }
  await page.locator('#openWriteBtn').click();
  await page.locator('#albumQuery').fill('mock');
  await page.locator('#btnSearchAlbum').click();
  await expect(page.locator('.search-item img[src]')).toHaveCount(0);
  for (let i = 0; i < covers.length; i++) {
    await page.locator('.search-item').nth(i).click();
    await expect(page.locator('#selCover')).not.toHaveAttribute('src');
  }
  await assertClean(page, state);
});

test('security/regression: exact YouTube host, path and video ID validation', async ({ page }) => {
  const valid = ['https://www.youtube.com/watch?v=abcdefghijk&feature=share', 'http://youtube.com/watch?feature=share&v=abcdefghijk', 'youtube.com/embed/abcdefghijk', 'https://youtu.be/abcdefghijk?t=10', 'www.youtube.com/watch?v=abcdefghijk'];
  const invalid = ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://evil.test/?next=https://youtu.be/abcdefghijk', 'https://youtube.com@evil.test/watch?v=abcdefghijk', 'https://user@youtube.com/watch?v=abcdefghijk', 'https://youtube.com:444/watch?v=abcdefghijk', 'https://youtu.be/abcdefghijkEXTRA', 'https://youtube.com/watch?v=short', 'https://youtube.com/embed/abcdefghijk/extra', 'https://youtube.com/watch?v=abc%22defghijk', 'javascript:alert(1)', 'javascript:https://youtu.be/abcdefghijk', 'notyoutube.com/watch?v=abcdefghijk', 'https://youtube.com/shorts/abcdefghijk'];
  const content = valid.join('\n') + '\n' + invalid.join('\n');
  const state = await boot(page, { posts: [{ ...normalPosts[0], content }] });
  await page.locator('#postList a').click();
  await expect(page.locator('#readContent iframe')).toHaveCount(valid.length);
  expect(await page.locator('#readContent').textContent()).toContain(invalid.join('\n'));
  for (const iframe of await page.locator('#readContent iframe').all()) await expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/abcdefghijk');
  await assertClean(page, state);
});

test('security/regression: media is parsed once and previews never parse HTML', async ({ page }) => {
  const content = '시작 & <b>그대로</b>\n[img]https://assets.test/x.png?x=1&y=2[/img]\n[img]https://assets.test/x.png?next=https://youtu.be/abcdefghijk[/img]\nhttps://youtu.be/abcdefghijk.\n끝';
  const state = await boot(page, { posts: [{ ...normalPosts[1], content }] });
  await page.locator('#postList a').click();
  await expect(page.locator('#readContent img')).toHaveCount(2);
  await expect(page.locator('#readContent img').first()).toHaveAttribute('src', 'https://assets.test/x.png?x=1&y=2');
  await expect(page.locator('#readContent iframe')).toHaveCount(1);
  await expect(page.locator('#readContent b')).toHaveCount(0);
  await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).click();
  await page.locator('.album-card').click();
  expect(await page.locator('.rc-content').textContent()).toBe('시작 & <b>그대로</b>\n\n\n.\n끝...');
  await expect(page.locator('.rc-content *')).toHaveCount(0);
  await assertClean(page, state);
});

test('regression: recommendation and admin edit keep mock update contracts', async ({ page }) => {
  const state = await boot(page);
  await page.evaluate(() => window.mockAuth('SIGNED_IN', { user: { email: ADMIN_EMAIL, user_metadata: { nickname: '관리자' } } }));
  await expect(page.locator('#userStatus')).toHaveText('[관리자] 관리자님');
  await page.locator('#postList a').first().click();
  await page.locator('#recommendBtn').click();
  await expect(page.locator('#readRecs')).toHaveText('5');
  await page.locator('#recommendBtn').click();
  await page.locator('#adminEditBtn').click();
  await expect(page.locator('#writeSection')).toBeVisible();
  await expect(page.locator('#postTitle')).toHaveValue(normalPosts[0].title);
  await page.locator('#postTitle').fill('수정된 제목');
  await page.locator('#savePostBtn').click();
  const updates = await page.evaluate(() => window.mockCalls.filter(c => c.action === 'update'));
  expect(updates.map(call => call.data)).toEqual([{ views: 11 }, { recs: 5 }, { tag: '국내 인디', author: normalPosts[0].author, title: '수정된 제목', content: normalPosts[0].content }]);
  await assertClean(page, state, ['추천 완료!', '이미 추천했습니다.', '수정됨']);
});

test('security/regression: encoded quotes stay inside image src and clear stale covers', async ({ page }) => {
  const content = '[img]https://assets.test/x%22%20onerror%3D%22alert(1).png[/img]';
  const state = await boot(page, { posts: [{ ...normalPosts[0], content }] });
  await page.locator('#postList a').click();
  await expect(page.locator('#readContent img')).toHaveCount(1);
  expect(await page.locator('#readContent img').evaluate(img => [...img.attributes].map(attr => attr.name))).toEqual(['src']);
  await page.evaluate(() => {
    selectAlbum('valid', 'artist', 'https://assets.test/cover.png');
    selectAlbum('invalid', 'artist', 'javascript:alert(2)');
  });
  await expect(page.locator('#selCover')).not.toHaveAttribute('src');
  await assertClean(page, state);
});

test('regression: upstream footer and signup consent remain intact', async ({ page }) => {
  const state = await boot(page, { signedIn: false });
  await page.locator('.site-footer a').click();
  await expect(page.locator('#privacyModal')).toBeVisible();
  await page.locator('#privacyModal button').click();
  await page.locator('#showSignupBtn').click();
  await expect(page.locator('#signupConsent')).not.toBeChecked();
  await page.locator('#signupEmail').fill('tester@example.test');
  await page.locator('#signupPw').fill('mock-password');
  await page.locator('#doSignupBtn').click();
  await page.locator('#signupConsent').check();
  await page.locator('#signupModal .btn-cancel').click();
  await page.locator('#showSignupBtn').click();
  await expect(page.locator('#signupConsent')).not.toBeChecked();
  await assertClean(page, state, ['서비스 이용을 위해 개인정보 수집 및 이용약관에 동의해주세요.']);
});
