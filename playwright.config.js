const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  fullyParallel: true,
  workers: 2,
  use: { browserName: 'chromium', serviceWorkers: 'block' },
  projects: [
    { name: 'chromium', testMatch: 'frontend.spec.js', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', testMatch: 'frontend.spec.js', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ...['chromium', 'firefox', 'webkit'].map(browserName => ({ name: `layout-${browserName}`, testMatch: 'layout.spec.js', use: { browserName } })),
    { name: 'baseline', testMatch: 'baseline.spec.js' }
  ]
});
