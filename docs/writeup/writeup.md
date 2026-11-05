# RelayCare

**After-sales service orchestration for electronics commerce, powered by Nexconn.**
Nexconn Build Challenge 2026, Marketplace & Support track.

---

## 1. The problem, in one paragraph

A customer buys a washing machine from an online store. Twenty days later it leaks. The store,
the manufacturer, the service centre and the technician each hold part of the story and talk
through phone calls, email and separate messaging apps. The customer repeats the problem to
every new person, requests get lost between organisations, and the technician arrives without
knowing what was already tried.

**RelayCare** gives every complaint one persistent service case, attached to the order the
customer actually placed. When responsibility moves from support to dispatch to a technician,
the context moves with it. The customer never explains the problem twice.

---

## 2. The real-world problem

After-sales service for appliances crosses company boundaries. The merchant sold the product;
an authorised service partner repairs it; the customer only knows the store. Every handoff
between them is a place where information is lost:

- the original complaint and photos stay in a support inbox,
- warranty status is checked by phone,
- the technician receives a name and an address, not a history,
- the customer has no single place to see progress.

> **To complete before submission:** findings from conversations with WooCommerce merchants
> (how they handle service today, how many tools, where cases get lost). We will not present
> hypothetical users; a real pilot with one merchant is the next step (page 8).

---

## 3. The solution and workflow

One case, five people, one conversation history.

| Step | Who | What RelayCare does |
|---|---|---|
| 1 | Customer | Clicks **Get Support** on the order in their WooCommerce account. A signed link plus an email code proves it is their order. |
| 2 | Customer | Picks the product, the problem, describes it in any language, lists what they tried, adds photos. A case number (RC-2026-0042) is created and a support agent is assigned. |
| 3 | Support agent | Chats with the customer (Nexconn direct channel, translated), verifies the warranty against store rules, and prepares a **structured handoff**. |
| 4 | Dispatcher | Assigns a technician who covers the area. RelayCare creates a **Nexconn group channel** for customer, agent, dispatcher and technician. |
| 5 | Technician | Receives the full handoff, accepts, books the visit, repairs, uploads photos and a report. |
| 6 | Customer | Confirms the repair (or says it is not fixed), rates the service. The store closes the case. |

**The differentiator: context-preserving handoffs.** The handoff is a snapshot built on the
server from data RelayCare already holds (order, product, serial, customer contact, warranty
decision, original complaint, symptoms, troubleshooting, evidence, required action). The
technician reads it before arriving.

---

## 4. Product screenshots and journeys

> Insert real screenshots (captured from the running app):
> 1. WooCommerce My Account with **Get Support** and the **Support** status column
> 2. Customer report flow on a phone (Gujarati UI)
> 3. Staff case page: relay strip, original complaint, timeline, chat with translation
> 4. Handoff dialog and the resulting handoff card
> 5. Dispatch Centre with the Mapbox map and the assign dialog
> 6. Technician job page (Hindi UI) with the handoff and group chat
> 7. Customer confirming the repair; case timeline from report to closed

---

## 5. Technical architecture and database

- **One Next.js 16 application** (customer portal, staff dashboard, technician app, API) and a
  Postgres-backed job queue. No microservices.
- **Supabase Postgres** with Drizzle: 23 tables. UUIDs for RelayCare records, WooCommerce IDs
  kept separately.
- **A strict state machine** (15 states) enforced twice: in application code (who may do what,
  with preconditions such as "a repair photo exists") and by a database trigger (which status
  changes are legal at all).
- **Append-only history.** `case_events` cannot be updated or deleted (trigger).
- **Row-level security on every table.** A technician sees only cases they are actively assigned
  to; a customer only their own orders; removed participants lose access immediately.
- **Composite foreign keys** make it impossible for a case to point at another customer's order.
- **Private evidence storage** with server-chosen object keys, verified size and type, and
  5-minute signed download links after an access check.

---

## 6. Nexconn SDK implementation

App Key: `<the App Key entered in the challenge form>` (the App Secret never leaves the server).

- **Chat SDK (Web)** `@nexconn/engine` + `@nexconn/chat` 26.2.1, custom mobile-friendly UI.
  - `NCEngine.initialize` once; `NCEngine.connect` with a token issued by our backend.
  - **Direct channels** for customer ↔ support agent.
  - **Group channels** for customer, agent, dispatcher and technician on each assigned case.
  - **Message history** via `BaseChannel.createMessagesQuery` (persists across reconnects).
  - **Image and file messages** for conversational attachments.
  - **Translation** via `translateModule` with per-user language (Gujarati, Hindi, English).
- **Server API** (signed with SHA1(AppSecret + Nonce + Timestamp)): access-token issuing,
  group create / join / leave / dismiss, server-sent system messages ("Technician Ravi has
  joined", "repair finished").
- **Webhooks**: signature-verified, de-duplicated by event id, used for conversation activity.
  A chat message never changes a case: "done" in chat does not close anything.

---

## 7. WooCommerce integration

- **Connector:** the owner pastes the store URL and REST keys; RelayCare verifies them, stores
  them encrypted (AES-256-GCM), registers `order.created` and `order.updated` webhooks, and
  imports existing orders in the background.
- **Webhook pipeline:** raw-body HMAC-SHA256 verification, source check, inbox row unique per
  delivery id, 2xx immediately, processing in a retrying job. Older deliveries never overwrite
  newer data; duplicate deliveries never create duplicate orders.
- **WordPress plugin** `relaycare-woocommerce`: **Get Support** on each order (signed link),
  a **Support** status column in My Account, and a **serial number** field on order lines.

---

## 8. Demo, roadmap and expected impact

**Demo (6 minutes):** a real WooCommerce order → Gujarati complaint with a photo → English reply
with translation → warranty verified → handoff → technician assigned, group created → Hindi
messages translated for the customer → repair photo and report → customer confirms → full
timeline.

**Next steps:**
1. Pilot with one real WooCommerce merchant and a small number of cases.
2. More commerce platforms (Shopify) through the same connector pattern.
3. Manufacturer and service-partner portals with their own technicians.
4. Message moderation hooks (Nexconn `pre_messaging`) to restrict direct chats to case members.

**Expected impact** (to be measured in the pilot, not claimed): fewer repeated explanations,
fewer lost handoffs, faster time to resolution, and one place for the customer to follow the
repair.
