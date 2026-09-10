const { test, expect, boot, assertClean, normalPosts } = require('./harness');

async function fits(page, label) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const issues = [];
    if (document.documentElement.scrollWidth > width + 1) issues.push(`page ${document.documentElement.scrollWidth} > ${width}`);
    for (const node of document.querySelectorAll('.sidebar, .widget-container, .post-table-wrap, .search-result-row, .modal-content')) {
      if (!node.getClientRects().length) continue;
      if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== 'auto') issues.push(`${node.className}: ${node.scrollWidth} > ${node.clientWidth}`);
    }
    for (const node of document.querySelectorAll('button, .sidebar a, #readContent img, #readContent iframe, input:not([type="file"]), select, textarea')) {
      if (!node.getClientRects().length) continue;
      if (node.matches('.sidebar a') && getComputedStyle(node.closest('.sidebar')).overflowX === 'auto') continue;
      const rect = node.getBoundingClientRect();
      if (rect.left < -1 || rect.right > width + 1) issues.push(`${node.id || node.tagName}: ${rect.left}..${rect.right} outside ${width}`);
    }
    return issues;
  });
  expect(overflow, label).toEqual([]);
}

const sizes = [
  [320, 568], [360, 800], [375, 667], [390, 844], [430, 932],
  [600, 800], [768, 1024], [840, 900], [841, 900], [844, 390], [1024, 768], [1440, 900]
];
for (const [width, height] of sizes) {
  test(`layout ${width}x${height}: every screen fits with long content`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const long = '긴앨범제목과작성자'.repeat(12) + 'VeryLongUnbrokenText'.repeat(12);
    const posts = [
      { ...normalPosts[0], title: long, author: long, tag: long, content: long + '\nhttps://example.test/' + 'x'.repeat(300) + '\n[img]https://assets.test/wide.png[/img]\nhttps://youtu.be/abcdefghijk' },
      { ...normalPosts[1], title: long, author: long, album_title: long, album_artist: long },
      normalPosts[2]
    ];
    const state = await boot(page, { posts, nickname: long, albums: [{ collectionName: long, artistName: long, artworkUrl100: 'https://assets.test/cover.png' }] });
    await page.route('https://assets.test/wide.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="teal"/></svg>' }));
    await fits(page, 'board, header, wrapped categories and HOT');
    await page.locator('#postList a').first().click();
    await expect(page.locator('#readTitle')).toHaveText(long);
    await expect.poll(() => page.locator('#readContent img').evaluate(img => img.naturalWidth)).toBe(1600);
    await fits(page, 'post including large image and YouTube');
    await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).click();
    await fits(page, 'album grid');
    await page.locator('.album-card').first().click();
    await fits(page, 'album detail and review');
    await page.locator('#albumDetailSection .write-btn').click();
    await fits(page, 'preselected writing, stars and form');
    await page.locator('#albumQuery').fill('mock');
    await page.locator('#btnSearchAlbum').click();
    await page.locator('.search-item').waitFor({ state: 'visible' });
    await fits(page, 'search results');
    await page.locator('.search-item').click();
    await fits(page, 'selected search result');
    await page.locator('.btn-cancel-write').click();
    await page.locator('#showSettingsBtn').click();
    await fits(page, 'settings modal');
    await page.locator('#settingsModal .btn-cancel').click();
    await page.locator('.site-footer a').click();
    await fits(page, 'privacy modal');
    await page.locator('#privacyModal button').click();
    await page.evaluate(() => window.mockAuth('SIGNED_OUT', null));
    await page.locator('#showLoginBtn').click();
    await fits(page, 'login modal');
    await page.locator('#loginModal .btn-cancel').click();
    await page.locator('#showSignupBtn').click();
    await fits(page, 'signup and consent');
    await page.locator('#signupModal .btn-cancel').click();
    await assertClean(page, state);
  });
}

test('layout: rotation, zoom and mobile typography', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await boot(page);
  await page.locator('#postList a').first().click();
  expect(await page.locator('.view-title').evaluate(node => getComputedStyle(node).fontSize)).toBe('18px');
  expect(await page.locator('.view-content-area').evaluate(node => getComputedStyle(node).fontSize)).toBe('14px');
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toBe('width=device-width, initial-scale=1.0, minimum-scale=1.0');
  await fits(page, 'portrait');
  await page.setViewportSize({ width: 844, height: 390 });
  await fits(page, 'landscape after resize');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await fits(page, '200% CSS zoom');
  await assertClean(page, state);
});

for (const width of [320, 390, 600, 840]) {
  test(`layout ${width}: horizontal sections scroll independently`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await boot(page, { posts: normalPosts.map(post => ({ ...post, recs: 4 })) });
    for (const selector of ['.sidebar', '#topWidgetArea']) {
      const section = page.locator(selector);
      const geometry = await section.evaluate(node => {
        node.scrollLeft = node.scrollWidth;
        return { left: node.scrollLeft, max: node.scrollWidth - node.clientWidth, pageLeft: window.scrollX };
      });
      if (selector === '.sidebar' || (selector === '#topWidgetArea' && width < 768)) expect(geometry.max).toBeGreaterThan(0);
      expect(geometry.left).toBeCloseTo(geometry.max, 0);
      expect(geometry.pageLeft).toBe(0);
      await fits(page, `${selector} after scrolling`);
    }
    expect(await page.locator('#postTableArea').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.locator('#topWidgetArea .widget-card').last().click();
    await expect(page.locator('#readTitle')).toHaveText(normalPosts[2].title);
    await page.locator('.sidebar a').filter({ hasText: /^전체 게시판$/ }).click();
    await page.locator('#postList a').first().click();
    await expect(page.locator('#readTitle')).toHaveText(normalPosts[0].title);
    await assertClean(page, state);
  });
}

for (const width of [320, 390, 840, 841, 1280]) {
  test(`layout ${width}: empty boards preserve populated column widths`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await boot(page);
    const widths = () => page.locator('.post-table th:visible').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    const populated = await widths();
    await page.evaluate(() => changeBoard('빈 테스트 게시판'));
    await expect(page.locator('#postList')).toContainText('등록된 게시글이 없습니다.');
    const empty = await widths();
    expect(empty).toHaveLength(populated.length);
    empty.forEach((value, i) => expect(Math.abs(value - populated[i])).toBeLessThan(1));
    await fits(page, 'empty board');
    await assertClean(page, state);
  });
}
