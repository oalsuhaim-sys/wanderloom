# Legacy import path

`WelcomeDnaClient` moved to `src/app/welcome/_components/WelcomeDnaClient.tsx`.

DNA routes:

- `/welcome/vip/{onboarding_token}` — primary WhatsApp link
- `/welcome/client/{client.id}` — CRM numeric link

Legacy `/welcome/{segment}` redirects via `middleware.ts`.
