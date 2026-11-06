# RelayCare demo handover

Everything you need to log in and run the demo. These are **seeded demo accounts only**. No real
secrets are stored here (API keys stay in `.env.local`, which is never committed).

## The short answer: how to log in

Everyone, customers included, can sign in at **`/login` with email + password**. After sign-in,
`/workspace` sends each person to the right place for their role.

| Person | Role | Email | Password | Lands on |
|---|---|---|---|---|
| Heet | Store owner | `owner@relaycare.test` | `relaycare-demo-2026` | `/dashboard` |
| Maya | Support agent (English) | `maya@relaycare.test` | `relaycare-demo-2026` | `/dashboard` |
| Arjun | Dispatcher (English) | `arjun@relaycare.test` | `relaycare-demo-2026` | `/dashboard` (then Dispatch centre) |
| Ravi | Technician (Hindi) | `ravi@relaycare.test` | `relaycare-demo-2026` | `/technician/jobs` |
| Demo Customer | Customer (Gujarati) | `customer@relaycare.test` | `relaycare-demo-2026` | `/my-orders` |

The password comes from `SEED_PASSWORD` (default above). Any email can be swapped for a real
inbox with `SEED_<KEY>_EMAIL`, e.g. `SEED_CUSTOMER_EMAIL=you@gmail.com`, then `pnpm db:seed`.

### One-click sign-in (local dev only)

`http://localhost:3000/api/dev/sign-in?as=<owner|maya|arjun|ravi|customer>`. Add
`&next=/my-orders` to choose where it lands. This returns 404 in production.

### Customers and email codes

Customers normally sign in with a one-time email code at `/verify`. `@relaycare.test` inboxes
can't receive mail, so for the demo either:

1. **Easiest:** sign the customer in at `/login` with the password above, or
2. **To show the real code flow:** set `SEED_CUSTOMER_EMAIL` to an inbox you can open, reseed,
   and finish the Resend setup below so the code email is actually delivered.

## Run five people at once

Each browser profile keeps one session. Use one window per person: a normal window, an
incognito window, and separate Chrome profiles (or Chrome + Edge + Firefox).

## WooCommerce store (Docker)

| What | Value |
|---|---|
| Store | `http://localhost:8080` (start with `docker compose -f docker/docker-compose.yml up -d`) |
| WP admin | `http://localhost:8080/wp-admin`, user `admin`, password `relaycare-admin` |
| Store customer | `customer@relaycare.test` / `relaycare-demo-2026` |
| Demo order | `WC-10842`, AquaWash 7kg, serial `AW7-DEMO-0042` |
| Database | MariaDB `wordpress` / `wordpress` (root `root`), container-internal only |

## Demo reset

`pnpm demo:reset` deletes demo cases and events, resets Ravi's availability and re-syncs
WC-10842, so every rehearsal starts from the same state.

## Still to do before going live (needs your accounts)

| Item | Where | Why |
|---|---|---|
| Deploy | Vercel (CLI is logged out) | Public URL for judges |
| Resend domain + `EMAIL_FROM` | resend.com, `.env` | `EMAIL_FROM` is still an example.com address, so mail is refused |
| Supabase SMTP + OTP template | Supabase Auth settings | Customer code emails |
| Nexconn webhook URL | Nexconn Console | Point at `<deployed URL>/api/webhooks/nexconn` |
