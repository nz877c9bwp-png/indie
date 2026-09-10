const { test, expect, boot, normalPosts } = require('./harness');

test('baseline: stored album_cover creates an executable event attribute', async ({ page }) => {
  await boot(page, { baseline: true, posts: [{ ...normalPosts[1], album_cover: 'https://assets.test/cover.png" onload="window.__xss++;alert(731)' }] });
  await page.evaluate(() => changeBoard('앨범 평가'));
  await expect(page.locator('.album-card img')).toHaveAttribute('onload', 'window.__xss++;alert(731)');
  await expect.poll(() => page.evaluate(() => window.__xss)).toBe(1);
});

test('baseline: stored album_title executes through inline click handler', async ({ page }) => {
  await boot(page, { baseline: true, posts: [{ ...normalPosts[1], album_title: "'-alert(732)-'", album_artist: 'artist' }] });
  await page.evaluate(() => changeBoard('앨범 평가'));
  const dialog = page.waitForEvent('dialog');
  await page.locator('.album-card').click();
  expect((await dialog).message()).toBe('732');
});

test('baseline: external search title executes through inline click handler', async ({ page }) => {
  await boot(page, { baseline: true, albums: [{ collectionName: "'-alert(733)-'", artistName: 'artist', artworkUrl100: 'https://assets.test/cover.png' }] });
  await page.locator('#openWriteBtn').click();
  await page.locator('#postTag').selectOption('앨범 평가');
  await page.locator('#albumQuery').fill('mock');
  await page.locator('#btnSearchAlbum').click();
  const dialog = page.waitForEvent('dialog');
  await page.locator('.search-item').click();
  expect((await dialog).message()).toBe('733');
});


test('baseline: escaped plain text and direct image quote breakout are already protected', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss++;alert(734)">';
  const state = await boot(page, { baseline: true, posts: [{ ...normalPosts[1], album_title: 'Album', album_artist: 'Artist', title: payload, author: payload, content: payload }] });
  await expect(page.locator('#postList a')).toHaveText(payload);
  await expect(page.locator('#postList .col-author')).toHaveText(payload);
  await page.locator('#postList a').click();
  await expect(page.locator('#readContent')).toHaveText(payload);
  await page.evaluate(() => changeBoard('앨범 평가'));
  await page.locator('.album-card').click();
  await expect(page.locator('.rc-title')).toHaveText(payload);
  await expect(page.locator('.rc-author')).toHaveText(payload);
  await expect(page.locator('.rc-content')).toHaveText(payload + '...');
  const attributes = await page.evaluate(() => {
    const template = document.createElement('template');
    template.innerHTML = formatContent('[img]https://assets.test/x" onerror="alert(735)[/img]');
    return [...template.content.querySelector('img').attributes].map(attr => attr.name);
  });
  expect(attributes).toEqual(['src']);
  expect(await page.evaluate(() => window.__xss)).toBe(0);
  expect(state.dialogs).toEqual([]);
});
