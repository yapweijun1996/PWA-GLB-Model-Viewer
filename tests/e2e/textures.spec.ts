import { test, expect } from '@playwright/test';
test('embedded GLB texture loads without network resources', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('#files').setInputFiles('tests/fixtures/textured.glb');
  await expect(page.locator('#status')).toHaveText('Ready · WebGL2');
  await expect(page.locator('#performance')).toContainText('textures');
  await expect(page.locator('#error')).toBeHidden();
});
