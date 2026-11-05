# Acceptance checklist

Spec §16 acceptance targets and §14 critical tests, with the evidence for each.
"Automated" = covered by `pnpm test:integration` against the real database, storage and Nexconn.
"Manual" = still to be confirmed in the browser before the demo (see the UI checklist in the
hand-over notes).

## §16 acceptance targets

| Target | Status | Evidence |
|---|---|---|
| WooCommerce order sync: one working integration | Done | Live webhooks from the Docker store; `tests/integration/authz.test.ts` (webhook auth), manual replay tests in Phase 2 |
| Customer-to-agent chat | Done | Nexconn PoC (`docs/nexconn-notes.md`); customer and Maya chat on case RC-2026-0042 |
| Multi-party group chat: four participants | Done | `dispatch.test.ts` › "creates the real Nexconn group with customer, agent, dispatcher and technician" (member list read back from Nexconn) |
| Technician assignment | Done | `dispatch.test.ts` (assign, reassign, accept, decline, concurrency) |
| Case handoff: complete context | Done | `workflow.test.ts` › handoff snapshot fields; technician copy in `dispatch.test.ts` |
| Language demonstration: Gujarati, Hindi, English | Done (manual re-check) | PoC: gu→en, hi→en, en→hi verified live; customer/technician UI localised |
| Resolution workflow: end-to-end | Done | `resolution.test.ts` (report → assign → accept → start → evidence → report → confirm → rate → close) |
| Duplicate webhook handling: no duplicate order | Done | Phase 2 replay: same delivery id → `duplicate: true`, same order new id → 1 order |
| Unauthorised case access: blocked | Done | `authz.test.ts` access matrix; RLS probes in Phase 0 |

## §14 critical tests

| Test | Evidence |
|---|---|
| Two users can send and receive actual Nexconn messages | PoC + case chats (manual) |
| A customer can access only their own order | `authz.test.ts` › other customers' items → 404; RLS: unrelated customer sees 0 orders |
| Backend can create a Nexconn group | `dispatch.test.ts` |
| A fourth user can join the conversation | `dispatch.test.ts` (four members read back from Nexconn) |
| Messages remain available after reconnecting | PoC: reload → history via `createMessagesQuery` |
| Gujarati-to-English translation works | PoC: "મશીનમાંથી પાણી લીક થાય છે." → "Water from the machine leaks." |
| Duplicate WooCommerce webhooks do not duplicate orders | Phase 2 replay tests |
| Unauthorised users cannot access a case | `authz.test.ts`, `dispatch.test.ts` (reassigned technician → 404) |
| A technician cannot close a case without the completion workflow | `resolution.test.ts` (no photo → 422; resolve/close → 409; only the customer confirms) |
| Never close a case because a technician says "done" in chat | `resolution.test.ts` (signed `message:send` "done" webhook → status unchanged) |

## Still to do before the submission

- Deploy (docs/deploy.md) and re-run the journey on the production URL with the challenge App Key.
- Configure the Nexconn webhook URL and Supabase OTP template in production.
- Verify a Resend sending domain so emails and staff invitations are delivered.
- Capture real screenshots for the write-up.
