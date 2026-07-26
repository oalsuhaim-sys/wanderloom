import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { loadE2EEnv, requireAuthEnv } from './env';

/** Login via /login UI (Supabase Auth). */
export async function loginAsCrmAdmin(page: Page): Promise<void> {
  const env = loadE2EEnv();
  requireAuthEnv(env);

  await page.goto('/login?next=/crm', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(env.email);
  await page.locator('input[type="password"]').fill(env.password);
  await page.getByRole('button', { name: 'دخول النظام' }).click();

  await page.waitForURL(/\/crm(\/|$|\?)/, { timeout: 45_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

/** Soft wait for CRM chrome (sidebar / dashboard). */
export async function expectCrmShell(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: /لوحة القيادة/i }).first()).toBeVisible({
    timeout: 30_000,
  });
}
