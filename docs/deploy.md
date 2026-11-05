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
