const { test, expect, boot, assertClean, normalPosts } = require('./harness');

async function fits(page) {
  const issues = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const result = [];
    if (document.documentElement.scrollWidth > width + 1) result.push('page overflow');
    for (const node of document.querySelectorAll('#postTableArea, #readContent, #albumDetailSection, #writeSection, .modal-content')) {
      if (node.getClientRects().length && node.scrollWidth > node.clientWidth + 1) result.push(`${node.id || node.className} overflow`);
    }
    for (const node of document.querySelectorAll('button, input:not([type=file]), select, textarea, #readContent img, #readContent iframe')) {
      if (!node.getClientRects().length) continue;
      const rect = node.getBoundingClientRect();
      if (rect.left < -1 || rect.right > width + 1) result.push(`${node.id || node.tagName} outside page`);
    }
    return result;
  });
  expect(issues).toEqual([]);
}

test('device: board, empty columns, HOT, media, albums, writing and modals', async ({ page }, testInfo) => {
  const state = await boot(page, { posts: normalPosts.map(post => ({ ...post, recs: 4 })), albums: [{ collectionName: '검색 앨범', artistName: '아티스트', artworkUrl100: 'https://assets.test/cover.png' }] });
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('board.png'), fullPage: true });
  const columnWidths = () => page.locator('.post-table th:visible').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  const populated = await columnWidths();
  await page.locator('.sidebar a').filter({ hasText: /^해외 인디$/ }).tap();
  await expect(page.locator('#postList')).toContainText('등록된 게시글이 없습니다.');
  (await columnWidths()).forEach((width, i) => expect(Math.abs(width - populated[i])).toBeLessThan(1));
  await fits(page);
  await page.locator('.sidebar a').filter({ hasText: /^전체 게시판$/ }).tap();
  for (const selector of ['.sidebar', '#topWidgetArea']) {
    await page.locator(selector).evaluate(node => { node.scrollLeft = node.scrollWidth; });
    await fits(page);
  }
  await page.locator('#topWidgetArea .widget-card').last().tap();
  await expect(page.locator('#readTitle')).toHaveText(normalPosts[2].title);
  await page.locator('.sidebar a').filter({ hasText: /^전체 게시판$/ }).tap();
  await page.locator('#postList a').first().tap();
  await expect(page.locator('#readContent img')).toBeVisible();
  await expect(page.locator('#readContent iframe')).toBeVisible();
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('post.png'), fullPage: true });
  await page.locator('.sidebar a').filter({ hasText: /^앨범 평가$/ }).tap();
  await fits(page);
  await page.locator('.album-card').first().tap();
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('album.png'), fullPage: true });
  await page.locator('#albumDetailSection .write-btn').tap();
  await fits(page);
  await page.locator('#albumQuery').fill('mock');
  await page.locator('#btnSearchAlbum').tap();
  await page.locator('.search-item').tap();
  await fits(page);
  await page.locator('.btn-cancel-write').tap();
  await page.locator('#showSettingsBtn').tap();
  await fits(page);
  await page.locator('#settingsModal .btn-cancel').tap();
  await page.locator('.site-footer a').tap();
  await fits(page);
  await page.locator('#privacyModal button').tap();
  await page.evaluate(() => window.mockAuth('SIGNED_OUT', null));
  await page.locator('#showLoginBtn').tap();
  await fits(page);
  await page.locator('#loginModal .btn-cancel').tap();
  await page.locator('#showSignupBtn').tap();
  await fits(page);
  await page.locator('#signupModal .btn-cancel').tap();
  await assertClean(page, state);
});
