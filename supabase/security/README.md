# Security hardening — status

| File | Status | What it is |
|---|---|---|
| `2026-10-07_tier1_safe_hardening.sql` | **APPLIED 2026-10-07** (migration `security_tier1_safe_hardening`) | Zero-regression hardening: removes only anon privileges that no code path uses. Verified with 16 live tests as the `anon` role. |
| `2026-10-07_wave2_full_lockdown_DRAFT.sql` | Draft — NOT applied | Full deny-by-default lockdown (RLS on every table, staff via `is_staff()`). Requires wave 2 frontend changes first (client portal / itinerary / onboarding / checkout must read through server routes). |
| `2026-10-07_schema_sync_missing_columns.sql` | **APPLIED 2026-10-07** (migration `schema_sync_missing_columns`) | Adds 8 columns the code already queries (fixes recurring 400 errors). Additive only. |
| `2026-10-07_phase1_rollback.sql` | Ready | Restores policies, RLS flags and anon grants exactly as captured before any change. Works after tier 1 or wave 2. |
| `2026-10-07_snapshot_before.json` | Reference | Policies, RLS flags and grants before any change. |

## Still open after tier 1 (closed by wave 2)
Anon can still read/insert/update `clients`, `itineraries`, `leads`, `client_preferences`, and read `wallet_transactions`, `employees`, `group_members`, because public pages and anon-key server actions read them directly. Wave 2 moves those reads/writes behind token-checked server routes, then applies the full lockdown.

## Manual settings (Supabase dashboard)
- Authentication: disable "Allow new users to sign up" (staff policies currently trust any signed-in user).
- Authentication: enable leaked password protection.

## Known code issue (not a database issue)
The code often converts ids with `Number(...)` (e.g. `parseGroupTripLeaderIdForDb`, client updates), but live ids are `uuid`.
Result seen in logs: `PATCH /clients?id=eq.NaN`, and group trip `leader_id` never saved. Fix in the app code (wave 2).
Missing tables still referenced by code: `partner_applications`, `customers` — the app falls back when they are absent; they need a design decision before creating.
