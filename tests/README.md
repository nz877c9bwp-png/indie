# Local frontend security tests

These tests render `index.html` in headless Chromium without contacting the live site or database. No application build or production dependency is introduced.

## Run

```sh
npm ci
npx playwright install chromium
npm test
npm run test:baseline
```

On a Linux machine missing browser system libraries, provision them with Playwright's `install-deps chromium` command using your environment's normal package-management process. Node.js 24.18.0 was used for the recorded run.

`npm test` runs the patched page in desktop (1280×900) and mobile (390×844) Chromium contexts. It checks navigation, text/media rendering, ratings, mock uploads/writes, hostile input, generated elements/attributes, dialogs, runtime errors and browser console errors. See `frontend.spec.js` for assertions and `harness.js` for fixtures. This is viewport emulation, not a real mobile device test.

`npm run test:baseline` reads the original page from Git commit `dce21b9fd5d01f8aeeb32e5eeb1b1221e5cd0950`. That commit must exist locally; shallow clones may need its history fetched. Three tests intentionally prove execution in the old code, and one checks existing escaping protections. A baseline PASS means the expected historical behavior was reproduced. It does not test the patched page.

## Isolation

The harness fulfills the page at a synthetic `http://127.0.0.1:8000` URL; no HTTP server needs to be started. Supabase is replaced before application code executes. All reads and writes use in-memory fixtures. CDN assets, iTunes responses, image bytes and YouTube iframe documents are fulfilled locally. Every other HTTP request is aborted; no handler forwards requests. Service workers are blocked. Never replace these mocks with production credentials or run these payloads on duli.kr.

The tests prove DOM/URL behavior and mocked call shapes, not live backend authorization, real uploads, CDN availability or YouTube playback. Expected application dialogs (e.g. save success) are asserted separately from attack dialogs. Generated output and dependencies are gitignored. There is no coverage percentage requirement.

Recorded results and the complete source-to-sink inventory are in [the security review](../docs/security-xss-review.md).

## Responsive layout checks

```sh
npx playwright install --with-deps chromium firefox webkit
npm run test:layout
```

The layout suite checks 320, 360, 375, 390, 430, 600, 768, 840, 841, 844, 1024 and 1440 CSS-pixel widths across Chromium, Firefox and WebKit. It covers long unbroken text, large images, navigation, album/review screens, forms and modals. It asserts that the document and layout containers have no horizontal overflow and that controls stay inside the viewport. A separate case covers resizing and 200% CSS zoom; this does not replace physical-device or native pinch-zoom testing.
