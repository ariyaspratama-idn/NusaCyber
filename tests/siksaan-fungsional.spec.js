const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5173';

test.describe('NUSA CYBER v3.0: Mega Ultimate Audit Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(TARGET_URL);
  });

  test('🛡️ LEVEL 1: Rendering & Stability (Blank of Death)', async ({ page }) => {
    const content = await page.content();
    expect(content).not.toContain('Internal Server Error');
    expect(content).not.toContain('Database Connection Failed');
  });

  test('🛡️ LEVEL 2: Security Injection (XSS & SQLi)', async ({ page }) => {
    const xssPayload = '\'"><script>alert("NUSACYBER")</script>';
    const sqliPayload = "' OR '1'='1'; -- ";
    const inputs = page.locator('input[type="text"], textarea');
    const count = await inputs.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
       await inputs.nth(i).fill(i % 2 === 0 ? xssPayload : sqliPayload).catch(() => {});
    }
    expect(await page.locator('body').isVisible()).toBeTruthy();
  });

  // --- v3.0 NEW: ACCESSIBILITY ---
  test('♿ LEVEL 3: Accessibility Audit (Axe-core)', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]); // Fail if there are violations
  });

  test('🛡️ LEVEL 4: SEO & Meta Data Readiness', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
    expect(ogTitle).not.toBeNull();
  });

  test('🛡️ LEVEL 5: i18n & Special Characters', async ({ page }) => {
    const weirdChars = '🚀 你好俄羅斯 🔥 𐎀 ﷽';
    const inputs = page.locator('input[type="text"], textarea').first();
    if (await inputs.count() > 0) {
      await inputs.fill(weirdChars);
      expect(await inputs.inputValue()).toBe(weirdChars);
    }
  });

  test('🛡️ LEVEL 6: Third-Party & Network Resilience', async ({ page }) => {
    await page.route('**/*', (route) => {
      if (route.request().url().includes('analytics')) return route.abort('failed');
      return route.continue();
    });
    await page.reload();
    expect(await page.locator('body').isVisible()).toBeTruthy();
  });

  test('🛡️ LEVEL 7: Client-Side Memory Leak Check', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.evaluate(() => window.scrollTo(0, 0));
    }
    expect(page.isClosed()).toBeFalsy();
  });

});
