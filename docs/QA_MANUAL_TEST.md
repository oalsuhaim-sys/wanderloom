# Wanderloom — Manual E2E QA Guide

Use this checklist to verify the core operational lifecycle in the CRM UI:

**Client Request → Expert Claim → Quote / Itinerary → Client Accept → Leader Assign → Trip Logs → Wallet Payout**

Automated companion: `POST` or `GET` `/api/admin/system-test` (CRM admin only). Add `?keep=1` to retain fixtures for visual inspection.

---

## Prerequisites

1. Sign in to CRM as an **admin** (`/login` → `/crm`).
2. Confirm at least one **active Expert** and one **active Leader** under **دليل الشركاء** (`/crm/partners-directory`).
3. Confirm schema migrations for `trip_logs`, `wallet_transactions`, and `expert_id` on itineraries/quotations are applied (see `src/lib/supabase-schema-updates.sql` and `supabase/sql/expert_assignment_links.sql`).
4. Browser DevTools → Network open (optional) to spot 401/500 failures.

---

## Step 1 — Client request (Lead)

| Action | Where |
|--------|--------|
| Open **رادار العملاء** | `/crm/radar` |
| Confirm a new lead appears (or create one via the public trip form / contact flow) | Public site lead form |
| Note the lead name, phone, and destination (e.g. كوريا) | New Leads inbox |

**Pass:** Lead status is `new` (or equivalent) and destination is visible. No orphan client without a lead row.

---

## Step 2 — Expert claims / is assigned

| Action | Where |
|--------|--------|
| Open the lead / convert to client if your intake flow requires it | Radar / client intake |
| Open **مسارات الرحلات** or builder | `/crm/itineraries` or `/crm/itineraries/builder` |
| Assign an **active Expert** from the expert dropdown | Itinerary edit / builder |
| Optionally open **رادار الشركاء** and expand the expert | `/crm/partners-radar` |

**Pass:** `expert_id` is saved on the itinerary. Expert profile → **Expert Assignments** shows the trip. Expert list is not empty / not `غير مصرح`.

---

## Step 3 — Quote + itinerary

| Action | Where |
|--------|--------|
| Create or open a quotation for the client | `/crm/quotations/new` or `/crm/quotations/edit/[id]` |
| Set destination (e.g. Korea / كوريا), dates, totals | Quote builder |
| Link / create itinerary with day plan content | Itinerary editor |
| Confirm quote status is awaiting client (e.g. `pending_client`) | Quotations list |

**Pass:** Quotation and itinerary both exist; destinations and costs match; expert still linked if assigned.

---

## Step 4 — Client accepts

| Action | Where |
|--------|--------|
| Mark quotation **approved** / client accepted via CRM or public quote page | `/crm/quotations` or `/quote/[id]` |
| Confirm itinerary moves to an active operational status | Itinerary detail |

**Pass:** Quotation status = approved (or product equivalent of “client accepted”). Itinerary is usable for operations (not stuck as draft-only).

---

## Step 5 — Assign trip leader

| Action | Where |
|--------|--------|
| Open **دليل الشركاء** → Leaders tab | `/crm/partners-directory` |
| Pick an active leader; open profile | `/crm/partners-directory/profile?type=leader&id=…` |
| Assign that leader to the trip (itinerary `leader_id` or meta if column not present) | Itinerary edit / admin assignment |
| Optionally set leader availability for trip dates | Profile → Leader Availability |

**Pass:** Leader is associated with the trip. Relation does not point at a deleted or wrong partner UUID.

---

## Step 6 — Trip active + live logs

| Action | Where |
|--------|--------|
| Ensure itinerary status reflects an active trip | Itinerary |
| Open **Live Trip Log** for this itinerary (admin) | Component / trip view using `LiveTripLog` |
| Add a log entry with text (and optional image URL) | POST via UI → `/api/trips/logs` |

**Pass:** Log appears under the correct `trip_id`. `leader_id` on the log matches the assigned leader. No cross-trip leakage.

---

## Step 7 — Trip ends + wallet commissions

| Action | Where |
|--------|--------|
| Mark trip complete / archive itinerary | Itinerary status |
| Record commissions in Smart Wallet for **Expert** and **Leader** | Profile → Smart Wallet (`/api/partners/wallet`) |
| Confirm transactions: `partner_type` = `expert` / `leader`, status `pending` then `cleared` | Wallet history |

**Pass:** Two commission rows exist (expert + leader), amounts correct, partner IDs match the assigned partners. Wallet UI does not show another partner’s transactions.

---

## Relation integrity checks (after the flow)

Run these mentally or in Supabase SQL editor:

1. **Lead → Client → Quotation → Itinerary** IDs all resolve; no dangling FKs.
2. **Itinerary.expert_id** exists in `experts`.
3. **Trip log.trip_id** = itinerary id; **trip_log.leader_id** exists in `leaders`.
4. **wallet_transactions.partner_id** matches expert/leader UUIDs with correct `partner_type`.
5. Changing or deleting a test itinerary (cascade) does not leave orphan trip logs if FK `on delete cascade` is applied.

---

## Automated health check

From a logged-in admin session (or with Bearer access token):

```http
POST /api/admin/system-test
Authorization: Bearer <supabase_access_token>
```

Optional: `?keep=1` to keep `[E2E-TEST]` rows for UI inspection.

**Expected JSON:** `overall: "PASS"` and each of steps 1–7 `"status": "PASS"`.

Default run **deletes** fixtures after the test (lead, client, quote, itinerary, logs, wallet rows, and any temp expert/leader created for the run).

---

## Failure triage

| Symptom | Likely cause |
|---------|----------------|
| Step fails at lead/quote insert | Missing columns / RLS without service role |
| Expert dropdown empty / 401 | Missing Bearer token; use CRM session access token |
| Trip log insert fails | Missing `trip_logs` table or invalid leader UUID |
| Wallet step fails | Missing `wallet_transactions` or bad `partner_type` |
| Leader assign SKIP/FAIL with meta note | `itineraries.leader_id` column not migrated — meta fallback used |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Admin QA | | | PASS / FAIL |
| Notes | | | |
