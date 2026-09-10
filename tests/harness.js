const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');

const baselineRevision = 'dce21b9fd5d01f8aeeb32e5eeb1b1221e5cd0950';
const normalPosts = [
  { id: 3, tag: '국내 인디', title: '정상 제목 & 이야기', author: '작성자 <문자>', content: '첫 줄\n둘째 줄\n[img]https://assets.test/cover.png[/img]\nhttps://www.youtube.com/watch?v=abcdefghijk', views: 10, recs: 4, created_at: '2026-09-01T00:00:00Z' },
  { id: 2, tag: '앨범 평가', title: '좋은 리뷰', author: '리뷰어', content: '좋은 음악입니다.\n다시 듣고 싶어요.', album_title: "Artist's ::: Album", album_artist: "Singer's ::: Name", album_cover: 'https://assets.test/cover.png', rating: 5, views: 2, recs: 1, created_at: '2026-09-01T00:00:00Z' },
  { id: 1, tag: '앨범 평가', title: '다른 리뷰', author: '다른 작성자', content: '두 번째 리뷰', album_title: "Artist's ::: Album", album_artist: "Singer's ::: Name", album_cover: 'https://assets.test/cover.png', rating: 3, views: 0, recs: 0, created_at: '2026-09-01T00:00:00Z' }
];

async function boot(page, { posts = normalPosts, albums = [], baseline = false, nickname = '테스터', signedIn = true } = {}) {
  const html = baseline
    ? execFileSync('git', ['show', `${baselineRevision}:index.html`], { encoding: 'utf8' })
    : readFileSync('index.html', 'utf8');
  const errors = [], dialogs = [], unexpectedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  // Every request is fulfilled locally or aborted. No route ever calls continue/fetch.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:8000') {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (url.hostname === 'cdn.jsdelivr.net') {
      return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript', body: '' });
    }
    if (url.hostname === 'itunes.apple.com' && url.pathname === '/search') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: albums }) });
    }
    if (url.hostname === 'assets.test') {
      return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQuvwOAAL+AeSGuPZQAAAAAElFTkSuQmCC', 'base64') });
    }
    if (url.hostname === 'www.youtube.com' && url.pathname.startsWith('/embed/')) {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Mock YouTube</title>' });
    }
    unexpectedRequests.push(url.href);
    return route.abort();
  });
  await page.addInitScript(({ posts, nickname, signedIn }) => {
    window.__xss = 0;
    window.mockPosts = posts;
    window.mockCalls = [];
    const session = signedIn ? { user: { email: 'tester@example.test', user_metadata: { nickname } } } : null;
    const success = async () => ({ data: {}, error: null });
    window.supabase = { createClient: () => ({
      auth: {
        onAuthStateChange(callback) { window.mockAuth = callback; callback('INITIAL_SESSION', session); },
        signUp: success, signInWithPassword: success, updateUser: success,
        signOut: async () => { window.mockAuth('SIGNED_OUT', null); return { error: null }; }
      },
      from(table) {
        return {
          select: () => ({ order: async () => ({ data: window.mockPosts, error: null }) }),
          update: data => ({ eq: async (key, id) => { window.mockCalls.push({ action: 'update', table, data, key, id }); return { error: null }; } }),
          delete: () => ({ eq: async (key, id) => { window.mockCalls.push({ action: 'delete', table, key, id }); return { error: null }; } }),
          insert: async data => { window.mockCalls.push({ action: 'insert', table, data }); return { error: null }; }
        };
      },
      storage: { from: bucket => ({
        upload: async (name, file) => { window.mockCalls.push({ action: 'upload', bucket, name, size: file.size }); return { error: null }; },
        getPublicUrl: () => ({ data: { publicUrl: 'https://assets.test/upload.png' } })
      }) }
    }) };
  }, { posts, nickname, signedIn });
  await page.goto('http://127.0.0.1:8000');
  await expect(page.locator('#postList')).not.toContainText('게시글을 불러오는 중');
  return { errors, dialogs, unexpectedRequests };
}

async function assertClean(page, state, expectedDialogs = []) {
  await expect.poll(() => page.evaluate(() => window.__xss)).toBe(0);
  expect(state.dialogs).toEqual(expectedDialogs);
  expect(state.errors).toEqual([]);
  expect(state.unexpectedRequests).toEqual([]);
  const unsafe = await page.evaluate(() => {
    const roots = ['postList', 'topWidgetArea', 'albumGrid', 'adReviews', 'readContent', 'albumResults', 'userStatus'];
    return roots.flatMap(id => [...document.getElementById(id).querySelectorAll('*')].flatMap(node => {
      const issues = [];
      if (['SCRIPT', 'SVG', 'OBJECT', 'EMBED', 'STYLE', 'LINK', 'META', 'FORM'].includes(node.tagName)) issues.push(node.outerHTML);
      for (const attr of node.attributes) {
        if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || (['src', 'href'].includes(attr.name) && /^\s*(javascript|data|vbscript):/i.test(attr.value))) issues.push(node.outerHTML);
      }
      if (node.tagName === 'IFRAME' && !/^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{11}$/.test(node.src)) issues.push(node.outerHTML);
      return issues;
    }));
  });
  expect(unsafe).toEqual([]);
}
module.exports = { test, expect, boot, assertClean, normalPosts, baselineRevision };
