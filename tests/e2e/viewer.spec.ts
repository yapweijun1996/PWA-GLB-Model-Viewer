import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const sample = 'public/models/studio-rover.glb';
const ready = async (page: Page) => {
  await expect(page.locator('#status')).toHaveText('Ready · WebGL2', {
    timeout: 30000,
  });
  await expect(page.locator('canvas')).toHaveCount(1);
};
const load = async (page: Page) => {
  await page.locator('#files').setInputFiles(sample);
  await ready(page);
};
const controlled = async (page: Page) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      );
  });
};
test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('01 shell renders without creating a WebGL canvas', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Every detail. Every angle.' }),
  ).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});
test('02 GLB imports and reports real geometry', async ({ page }) => {
  await load(page);
  await expect(page.locator('#geometry')).toContainText('13');
  await expect(page.locator('#model-name')).toHaveText('studio-rover.glb');
});
test('03 bundled sample opens through its visible action', async ({ page }) => {
  await page.locator('#sample').click();
  await ready(page);
});
test('04 glTF resolves a selected local binary dependency', async ({
  page,
}) => {
  await page
    .locator('#files')
    .setInputFiles(['tests/fixtures/rover.gltf', 'tests/fixtures/rover.bin']);
  await ready(page);
});
test('05 missing dependencies produce a recoverable error', async ({
  page,
}) => {
  await page.locator('#files').setInputFiles('tests/fixtures/rover.gltf');
  await expect(page.locator('#error')).toContainText(
    'Missing local dependency',
  );
});
test('06 malformed GLB never reports Ready', async ({ page }) => {
  await page.locator('#files').setInputFiles({
    name: 'broken.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from('bad'),
  });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#status')).not.toHaveText('Ready · WebGL2');
});
test('07 remote resources are rejected without remote network calls', async ({
  page,
}) => {
  let external = false;
  page.on('request', (request) => {
    if (request.url().includes('evil.test')) external = true;
  });
  await page.locator('#files').setInputFiles({
    name: 'unsafe.gltf',
    mimeType: 'model/gltf+json',
    buffer: Buffer.from(
      JSON.stringify({
        asset: { version: '2.0' },
        buffers: [{ byteLength: 12, uri: 'https://evil.test/a.bin' }],
      }),
    ),
  });
  await expect(page.locator('#error')).toContainText('Unsafe');
  expect(external).toBe(false);
});
test('08 another import recovers after invalid model', async ({ page }) => {
  await page.locator('#files').setInputFiles({
    name: 'bad.glb',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('bad'),
  });
  await expect(page.locator('#error')).toBeVisible();
  await load(page);
  await expect(page.locator('#error')).toBeHidden();
});
test('09 scene tree selects and highlights a mesh', async ({ page }) => {
  await load(page);
  await page.locator('.node').filter({ hasText: '◇ Body' }).click();
  await expect(page.locator('#selection')).toHaveText('Body');
  await expect(page.locator('.node[aria-pressed=true]')).toHaveCount(1);
});
test('10 material inspector shows source material properties', async ({
  page,
}) => {
  await load(page);
  await page.locator('.node').filter({ hasText: '◇ Body' }).click();
  await expect(page.locator('#material')).toContainText('Ceramic blue');
  await expect(page.locator('#material')).toContainText('roughness');
});
test('11 grid and axes toggles operate', async ({ page }) => {
  await load(page);
  await page.locator('#grid').check();
  await page.locator('#axes').check();
  await expect(page.locator('#grid')).toBeChecked();
  await expect(page.locator('#axes')).toBeChecked();
});
test('12 wireframe changes rendered model', async ({ page }) => {
  await load(page);
  const before = await page.locator('canvas').screenshot();
  await page.locator('#wireframe').check();
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.locator('canvas').screenshot()),
    )
    .not.toBe(0);
});
test('13 background selection changes canvas', async ({ page }) => {
  await load(page);
  const before = await page.locator('canvas').screenshot();
  await page.locator('#background').selectOption('#000000');
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.locator('canvas').screenshot()),
    )
    .not.toBe(0);
});
test('14 lighting presets and intensity operate', async ({ page }) => {
  await load(page);
  await page.locator('#lighting').selectOption('Soft');
  await page.locator('#intensity').fill('0.5');
  await expect(page.locator('#intensity-value')).toHaveText('0.5');
});
test('15 built-in animation is listed and plays', async ({ page }) => {
  await load(page);
  await expect(page.locator('#animation')).toContainText('Turntable');
  const before = await page.locator('canvas').screenshot();
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Pause');
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.locator('canvas').screenshot()),
    )
    .not.toBe(0);
});
test('16 animation pauses and resumes', async ({ page }) => {
  await load(page);
  await page.locator('#play').click();
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Resume');
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Pause');
});
test('17 animation restarts', async ({ page }) => {
  await load(page);
  await page.locator('#stop').click();
  await expect(page.locator('#play')).toHaveText('Pause');
});
test('18 zoom and camera fit change then restore the view', async ({
  page,
}) => {
  await load(page);
  const before = await page.locator('canvas').screenshot();
  await page.locator('#zoom-in').click();
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.locator('canvas').screenshot()),
    )
    .not.toBe(0);
  await page.locator('#fit').click();
  await expect(page.locator('#status')).toHaveText('Ready · WebGL2');
});
test('19 keyboard camera controls are available', async ({ page }) => {
  await load(page);
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('+');
  await page.keyboard.press('f');
  await expect(page.locator('canvas')).toBeFocused();
});
test('20 mouse drag orbits the model', async ({ page }) => {
  await load(page);
  const before = await page.locator('canvas').screenshot();
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.locator('canvas').screenshot()),
    )
    .not.toBe(0);
});
test('21 PNG screenshot downloads', async ({ page }) => {
  await load(page);
  const download = page.waitForEvent('download');
  await page.locator('#screenshot').click();
  expect((await download).suggestedFilename()).toBe('glb-studio.png');
});
test('22 reset clears scene and disables model actions', async ({ page }) => {
  await load(page);
  await page.locator('#reset').click();
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('.node')).toHaveCount(0);
});
test('23 repeated model switches retain one canvas and stable GPU counts', async ({
  page,
}) => {
  await load(page);
  await expect(page.locator('#performance')).toContainText('FPS');
  const counts = () => page.locator('#performance').innerText();
  const before = (await counts()).split('draw calls ·')[1];
  for (let i = 0; i < 3; i++) await load(page);
  await expect
    .poll(async () => (await counts()).split('draw calls ·')[1])
    .toBe(before);
  await expect(page.locator('canvas')).toHaveCount(1);
});
test('24 library persists a saved model across reload', async ({ page }) => {
  await load(page);
  await page.locator('#save').click();
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.saved-card')).toContainText('studio-rover.glb');
  await page
    .locator('.saved-actions')
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
});
test('25 saved model exports original file', async ({ page }) => {
  await load(page);
  await page.locator('#save').click();
  const download = page.waitForEvent('download');
  await page
    .locator('.saved-actions')
    .getByRole('button', { name: 'Export' })
    .click();
  expect((await download).suggestedFilename()).toBe('studio-rover.glb');
});
test('26 saved model can be removed', async ({ page }) => {
  await load(page);
  await page.locator('#save').click();
  await page
    .locator('.saved-actions')
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(page.locator('.saved-card')).toHaveCount(0);
});
test('27 theme persists and updates opaque system chrome', async ({ page }) => {
  await page.locator('#theme').selectOption('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name=theme-color]')).toHaveAttribute(
    'content',
    '#1b222d',
  );
});
for (const width of [320, 390, 768, 1440])
  test(`responsive ${width}px: no overflow and panel access`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 1200) {
      await page.locator('#inspector-toggle').click();
      await expect(page.locator('#inspector')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#inspector')).toBeHidden();
    }
    await load(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/layout-${width}.png` });
  });
test('32 validation report reflects actual Khronos output', async ({
  page,
}) => {
  await load(page);
  await expect(page.locator('#validation')).toContainText('0 errors');
});
test('33 cached app launches and imports local GLB offline', async ({
  page,
  context,
}) => {
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#empty')).toBeVisible();
  await load(page);
});
test('34 saved model reopens offline', async ({ page, context }) => {
  await load(page);
  await page.locator('#save').click();
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await page
    .locator('.saved-actions')
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
});
test('35 core flow has no uncaught browser errors or serious accessibility violations', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await load(page);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([]);
  await page.locator('#reset').click();
  expect(errors).toEqual([]);
});
test('36 new worker waits for explicit update action', async ({ page }) => {
  await controlled(page);
  const original = readFileSync('dist/sw.js', 'utf8');
  try {
    writeFileSync('dist/sw.js', original + '\n// E2E update ' + Date.now());
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await expect(page.locator('#update-prompt')).toBeVisible();
    await expect(page.locator('#empty')).toBeVisible();
    await page.locator('#update-now').click();
    await expect(page.locator('#empty')).toBeVisible();
    await expect(page.locator('#update-prompt')).toBeHidden();
  } finally {
    writeFileSync('dist/sw.js', original);
  }
});
