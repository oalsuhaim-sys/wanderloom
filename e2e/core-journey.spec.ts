import { expect, test, type Page } from '@playwright/test';

import { expectCrmShell, loginAsCrmAdmin } from './helpers/auth';
import { loadE2EEnv } from './helpers/env';
import { seedRadarPendingLead, type SeededLead } from './helpers/seed-lead';

/**
 * Master CRM journey: Radar approval → Client Database → DNA/AI → Itinerary builder.
 * Serial: each step depends on shared fixture state from the previous one.
 */
test.describe('Core Business Flow (Radar to Delivery)', () => {
  test.describe.configure({ mode: 'serial' });

  let seeded: SeededLead;
  let approvedClientName: string;

  test.beforeAll(async () => {
    const env = loadE2EEnv();
    test.skip(!env.email || !env.password, 'Set E2E_CRM_EMAIL + E2E_CRM_PASSWORD (see e2e/.env.example)');
    seeded = await seedRadarPendingLead();
    approvedClientName = seeded.fullName;
  });

  /** Mock OpenAI proxy so DNA AI step is cheap + deterministic. */
  async function mockAiItineraryRoute(page: Page) {
    await page.route('**/api/ai-itinerary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          suggestions: [
            {
              title: 'مقهى الهانوك الذهبي',
              time: '16:15',
              type: 'cafe',
              ai_reasoning: 'E2E mock — golden hour DNA match',
            },
          ],
        }),
      });
    });
  }

  test('Step 1 — Authentication & Dashboard', async ({ page }) => {
    await loginAsCrmAdmin(page);
    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expectCrmShell(page);

    // Header system health CTA (admin-only)
    await expect(page.getByRole('button', { name: /فحص شامل للنظام|جاري الفحص/ })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('Step 2 — Radar & Lead Approval', async ({ page }) => {
    await loginAsCrmAdmin(page);
    await page.goto('/crm/radar', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page.getByText(/الرادار الحي/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('صندوق الوارد — الطلبات الجديدة')).toBeVisible();

    // Find seeded lead card and open details
    const leadCard = page.locator('article').filter({ hasText: approvedClientName }).first();
    await expect(leadCard).toBeVisible({ timeout: 45_000 });
    await leadCard.getByRole('button', { name: 'عرض التفاصيل' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'موافقة على الطلب' }).click();

    // Success toast from react-hot-toast
    await expect(page.getByText(/تمت الموافقة/)).toBeVisible({ timeout: 45_000 });

    // Manual DNA sender remains available (no auto WhatsApp)
    await expect(
      dialog.getByRole('button', { name: /إرسال رابط DNA عبر واتساب/ }),
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'إغلاق' }).click();
  });

  test('Step 3 — Client Database & Profile', async ({ page }) => {
    await loginAsCrmAdmin(page);
    await page.goto('/crm/clients', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page.getByRole('heading', { name: /قاعدة العملاء/ })).toBeVisible({
      timeout: 30_000,
    });

    // Wait for loading to finish
    await expect(page.getByText(/جاري تحميل قاعدة العملاء/)).toBeHidden({ timeout: 60_000 });

    // Search for the approved client (SSOT = clients table)
    const search = page.getByPlaceholder(/بحث في قاعدة العملاء/);
    await search.fill(approvedClientName);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const clientCard = page.locator('article').filter({ hasText: approvedClientName }).first();
    await expect(clientCard).toBeVisible({ timeout: 45_000 });

    await clientCard.click();
    await page.waitForURL(/\/crm\/clients\/\d+/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page.getByText(/تفاصيل الـ DNA السياحي|DNA/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('Step 4 — DNA & AI Generation', async ({ page }) => {
    await mockAiItineraryRoute(page);
    await loginAsCrmAdmin(page);

    // Land on clients list → open profile again (serial journey continuity)
    await page.goto('/crm/clients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/جاري تحميل قاعدة العملاء/)).toBeHidden({ timeout: 60_000 });
    await page.getByPlaceholder(/بحث في قاعدة العملاء/).fill(approvedClientName);
    await page.locator('article').filter({ hasText: approvedClientName }).first().click();
    await page.waitForURL(/\/crm\/clients\/\d+/);

    const aiCard = page.locator('aside').filter({ hasText: 'سحر واندرلوم التنبؤي' });
    await expect(aiCard).toBeVisible({ timeout: 30_000 });

    // Auto-fetch may already be loading; wait for settle or trigger regenerate
    const loading = aiCard.getByText(/جاري توليد اقتراحات/);
    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 45_000 });
    }

    const regenerate = aiCard.getByRole('button', { name: 'إعادة التوليد' });
    if (await regenerate.isVisible().catch(() => false)) {
      await regenerate.click();
      await expect(aiCard.getByText(/جاري توليد اقتراحات/)).toBeVisible({ timeout: 10_000 });
      await expect(aiCard.getByText(/جاري توليد اقتراحات/)).toBeHidden({ timeout: 45_000 });
    }

    // Mocked suggestion title should appear
    await expect(aiCard.getByText('مقهى الهانوك الذهبي')).toBeVisible({ timeout: 20_000 });
  });

  test('Step 5 — Itinerary Builder', async ({ page }) => {
    await loginAsCrmAdmin(page);

    await page.goto('/crm/clients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/جاري تحميل قاعدة العملاء/)).toBeHidden({ timeout: 60_000 });
    await page.getByPlaceholder(/بحث في قاعدة العملاء/).fill(approvedClientName);
    const card = page.locator('article').filter({ hasText: approvedClientName }).first();
    await card.click();
    await page.waitForURL(/\/crm\/clients\/\d+/);

    const profileUrl = page.url();
    const clientIdMatch = profileUrl.match(/\/crm\/clients\/(\d+)/);
    expect(clientIdMatch?.[1]).toBeTruthy();
    const clientId = clientIdMatch![1];

    // Prefill builder with this client
    await page.goto(
      `/crm/itineraries/builder?from=client&clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(approvedClientName)}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page.getByRole('button', { name: /حفظ المسار/ })).toBeVisible({
      timeout: 30_000,
    });

    // Simulate flight detail entry (UI update without requiring full save)
    const flightInput = page.locator('label').filter({ hasText: 'رقم الرحلة' }).locator('input');
    await expect(flightInput).toBeVisible({ timeout: 20_000 });
    await flightInput.fill('SV123');
    await expect(flightInput).toHaveValue('SV123');

    // Hotel section present (ItineraryHotelsEditor)
    await expect(page.getByText(/فندق|الفنادق|Hotels/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
