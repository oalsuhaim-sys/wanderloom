/**
 * Generate VAPID keys for Web Push:
 *   npx web-push generate-vapid-keys
 *
 * Then set in your environment (Vercel / .env.local):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:you@wanderloom.app   (optional)
 */
console.log(`
Run:
  npx web-push generate-vapid-keys

Add the output to env as NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
Also run supabase/sql/crm_push_subscriptions.sql in Supabase.
`);
