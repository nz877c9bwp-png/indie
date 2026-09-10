const { defineConfig, devices } = require('@playwright/test');
const names = ['iPhone 13 Mini', 'iPhone 16', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'Galaxy S24', 'Pixel 9 Pro XL', 'iPad Pro 11', 'Galaxy Tab S9'];
const projects = names.flatMap(name => [name, `${name} landscape`].map(profile => ({
  name: profile,
  use: { ...devices[profile], browserName: devices[profile].defaultBrowserType }
})));
// Representative CSS viewports, not claims about a specific device's physical resolution.
for (const [name, width, height] of [['tablet-compact', 744, 1133], ['tablet-medium', 820, 1180], ['tablet-large', 1032, 1376], ['tablet-split', 600, 900]]) {
  for (const landscape of [false, true]) projects.push({
    name: `${name}${landscape ? ' landscape' : ''}`,
    use: { browserName: 'webkit', viewport: { width: landscape ? height : width, height: landscape ? width : height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  });
}
module.exports = defineConfig({
  testDir: './tests', testMatch: 'devices.spec.js', timeout: 30000, fullyParallel: true, workers: 2,
  outputDir: 'test-results/devices', use: { serviceWorkers: 'block' }, projects
});
