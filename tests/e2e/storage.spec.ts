import { test, expect } from '@playwright/test';
test('a denied persistence request does not hide a successful library save', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(() => {
    Object.defineProperty(navigator.storage, 'persist', {
      value: () => Promise.reject(new Error('Denied')),
    });
  });
  await page.locator('#files').setInputFiles('public/models/studio-rover.glb');
  await expect(page.locator('#status')).toHaveText('Ready · WebGL2');
  await page.locator('#save').click();
  await expect(page.locator('.saved-card')).toHaveCount(1);
});
