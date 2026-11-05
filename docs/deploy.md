# Deployment notes

## Job queue sweep (Supabase pg_cron + pg_net)

Webhooks process jobs immediately via `after()`. This sweep retries failures and picks up anything
left behind. Run once in the Supabase SQL editor after the app is deployed (replace both values):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'relaycare-jobs',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://YOUR-APP.vercel.app/api/jobs/run',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
     ) $$
);
-- check:   select * from cron.job_run_details order by start_time desc limit 5;
-- remove:  select cron.unschedule('relaycare-jobs');
```

Locally, `pnpm worker` polls the same endpoint (needs `pnpm dev`).

## Deploying to Vercel

Functions run in Tokyo (`vercel.json` → `hnd1`), next to the Supabase database, so each query
is ~1–2 ms instead of ~140 ms from India.

1. `npx vercel login`, then from `relaycare/`: `npx vercel link` (create the project).
2. Add every variable from `.env.example` in Vercel → Settings → Environment Variables
   (Production). Set `NEXT_PUBLIC_APP_URL` to the production URL. Do **not** set `WC_WEBHOOK_BASE_URL`
   or `WC_DEV_*` in production.
3. `npx vercel --prod`.
4. Supabase SQL editor: run the pg_cron block above with the production URL and `CRON_SECRET`.
5. Supabase → Authentication → URL configuration: add the production URL to Site URL / Redirect URLs.
   Email templates → Magic Link: include `{{ .Token }}` so customers get a 6-digit code.
6. Nexconn Console → Chat settings → Webhook: `https://<prod>/api/webhooks/nexconn`
   (message and group-channel events). Confirm translation is enabled for gu, hi, en.
   Confirm the App Key matches the one entered in the challenge form.
7. Store: Settings › Store integration in RelayCare → connect with HTTPS store URL and
   Read/Write keys (webhooks register themselves). Install the `wordpress/relaycare-woocommerce`
   plugin (zip the folder) and paste the RelayCare URL, Integration ID and Link secret.
8. Resend: verify the sending domain and set `EMAIL_FROM` to an address on it.
9. `pnpm demo:reset` before the demo.
