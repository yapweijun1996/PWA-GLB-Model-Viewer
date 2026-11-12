import { chromium, firefox, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base =
  process.env.VIEWER_URL || 'http://127.0.0.1:5188/PWA-GLB-Model-Viewer/';
const results = [];
for (const [name, type, options] of [
  [
    'Chromium',
    chromium,
    { args: ['--use-angle=swiftshader', '--enable-webgl'] },
  ],
  [
    'Edge',
    chromium,
    { channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-webgl'] },
  ],
  ['Firefox', firefox, {}],
  ['WebKit', webkit, {}],
]) {
  let browser;
  try {
    browser = await type.launch({ headless: true, ...options });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page
      .locator('#files')
      .setInputFiles('public/models/studio-rover.glb');
    await page
      .locator('#status')
      .filter({ hasText: 'Ready · WebGL2' })
      .waitFor({ timeout: 30000 });
    await page.locator('#play').click();
    await page.locator('#play').filter({ hasText: 'Pause' }).waitFor();
    await page
      .locator('#files')
      .setInputFiles(['tests/fixtures/rover.gltf', 'tests/fixtures/rover.bin']);
    await page
      .locator('#model-name')
      .filter({ hasText: 'rover.gltf' })
      .waitFor({ timeout: 30000 });
    if ((await page.locator('canvas').count()) !== 1 || errors.length)
      throw new Error(errors.join('; ') || 'Unexpected canvas count.');
    mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: `test-results/smoke-${name}.png` });
    results.push({
      browser: name,
      version: browser.version(),
      status: 'PASS',
      scope:
        'Local GLB, animation, glTF dependency import, one canvas, no uncaught errors',
    });
  } catch (error) {
    results.push({
      browser: name,
      status: 'UNVERIFIED',
      reason: String(error),
    });
  } finally {
    await browser?.close();
  }
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(
  'test-results/browser-matrix.json',
  JSON.stringify({ url: base, results }, null, 2),
);
if (results.some((result) => result.status !== 'PASS')) process.exitCode = 1;
