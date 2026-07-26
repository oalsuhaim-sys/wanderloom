# Wanderloom Playwright E2E

## Setup

```bash
npm install
npx playwright install chromium
```

Copy `e2e/.env.example` values into your environment (or `.env.local` — Playwright does not auto-load it; export vars / use dotenv-cli).

Required:

| Variable | Purpose |
|----------|---------|
| `E2E_CRM_EMAIL` | CRM login email |
| `E2E_CRM_PASSWORD` | CRM login password |
| `NEXT_PUBLIC_SUPABASE_URL` | Seed radar lead |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed radar lead |

Optional: `E2E_BASE_URL` (default `http://localhost:3000`), `E2E_SKIP_WEBSERVER=1`.

## Run

```bash
# PowerShell example
$env:E2E_CRM_EMAIL="…"
$env:E2E_CRM_PASSWORD="…"
$env:NEXT_PUBLIC_SUPABASE_URL=(Get-Content .env.local | …)  # or set manually
$env:SUPABASE_SERVICE_ROLE_KEY="…"
$env:E2E_SKIP_WEBSERVER="1"   # if `npm run dev` already up
npm run test:e2e
```

```bash
npm run test:e2e:ui
```

## Suite

`e2e/core-journey.spec.ts` — serial **Radar → Clients → DNA/AI (mocked) → Builder**.
