# RelayCare

After-sales service orchestration for WooCommerce electronics retailers, powered by the Nexconn Chat SDK.

**One purchase. One connected service journey. One resolution.** A customer reports a fault against
the order they actually placed; a support agent triages it in a direct chat; a dispatcher assigns a
technician, who receives a structured handoff and joins a group chat with everyone involved; the
customer confirms the repair; the store closes the case. Nobody explains the problem twice.

## Stack

Next.js 16 (App Router, cache components) · TypeScript · Tailwind v4 + shadcn/ui · Supabase
(Postgres, Auth, Storage) · Drizzle ORM · Nexconn Chat SDK + Server API · WooCommerce REST and
webhooks · Resend · Mapbox.

## Run it locally

```bash
pnpm install
cp .env.example .env.local        # fill in Supabase, Nexconn, Resend, Mapbox; see comments
pnpm db:migrate && pnpm db:seed   # schema, RLS, demo org and accounts
pnpm dev                          # http://localhost:3000

# Local WooCommerce demo store (Docker)
docker compose -f docker/docker-compose.yml up -d
MSYS_NO_PATHCONV=1 docker compose -f docker/docker-compose.yml run --rm cli bash /seed/wp-seed.sh
# copy the printed REST key into .env.local as WC_DEV_* and connect it in Settings › Store integration
```

Demo accounts (password `relaycare-demo-2026`): `owner@`, `maya@` (support), `arjun@`
(dispatch), `ravi@` (technician), `customer@` — all `@relaycare.test`. In development,
`/api/dev/sign-in?as=maya` signs in without typing (404 in production).

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (state machine, signatures, normaliser, warranty, OAuth) |
| `pnpm test:integration` | Real HTTP against `pnpm dev` + the real database, storage and Nexconn |
| `pnpm worker` | Local job runner (production uses Supabase pg_cron, see `docs/deploy.md`) |
| `pnpm demo:reset` | Clear demo cases and group chats; next case is RC-<year>-0042 |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations |

## How it fits together

```
WooCommerce ──signed webhooks──▶ /api/webhooks/woocommerce ─▶ webhook_inbox ─▶ jobs ─▶ orders
Customer portal ─┐                                                                      │
Staff dashboard ─┼─▶ Next.js route handlers ─▶ access checks ─▶ Postgres (RLS) ◀─────────┘
Technician app ──┘            │                                   ▲
                              ├─▶ Nexconn Server API (tokens, group channels, notices)
Browser ◀──Nexconn Chat SDK──▶ Nexconn (direct + group chat, history, translation)
Nexconn ──signed webhooks──▶ /api/webhooks/nexconn ─▶ conversation activity (never case status)
```

- **Source of truth.** Postgres owns orders, cases, assignments, warranties, handoffs and
  resolutions. Nexconn owns real-time messaging. WooCommerce owns the original purchase.
- **Case state machine.** `lib/cases/state-machine.ts` decides who may move a case where; the
  same table is enforced by a database trigger. Every change goes through `transitionCase()`,
  which locks the row and appends a `case_events` row (append-only by trigger).
- **Access.** Every case request checks: signed in → case exists → org staff, active participant
  or owning customer → role allows it → transition valid. Postgres row-level security repeats
  the visibility rules for every read made on a user's behalf.
- **Handoffs.** A versioned snapshot (`lib/cases/handoff.ts`) built on the server from data
  RelayCare already holds. The technician gets a copy on assignment.
- **Jobs.** A Postgres queue (`lib/jobs`) drained right after each response (`after()`), by the
  cron sweep, and by `pnpm worker`. Handlers are idempotent.

## Layout

```
app/            routes: (auth) sign-in, (customer) portal, dashboard, technician, api
components/     cases, chat, customer, dashboard, dispatch, technician, shared, ui (shadcn, Skiper26)
lib/            auth, cases, contracts (zod API shapes), db (schema, queries, RLS), jobs,
                nexconn, woocommerce, storage, email, i18n, notify, geocode
drizzle/        migrations (0001_rules.sql: trigger, append-only events, RLS policies)
wordpress/      relaycare-woocommerce plugin (Get Support button, status column, serial field)
docker/         local WooCommerce store
tests/          unit/, integration/
docs/           deploy, Nexconn notes, acceptance checklist, submission write-up
```
