# Nexconn integration notes (Phase 1 PoC, verified 2026-11-05)

SDK `@nexconn/engine` + `@nexconn/chat` 26.2.1, area `SG`, API `https://api.sg-light-api.com`.

## Verified live (dev PoC: /dev/chat?as=customer|maya|arjun|ravi)
| Spec critical test | Result |
|---|---|
| Two users send and receive real messages | ✅ customer → Maya direct, delivered live |
| Backend creates a group | ✅ `POST /v4/group-channel/create` |
| A fourth user joins | ✅ `POST /v4/group-channel/join`, Ravi receives history + live |
| Messages persist after reconnect | ✅ reload → `createMessagesQuery` returns history |
| Gujarati → English | ✅ "મશીનમાંથી પાણી લીક થાય છે." → "Water from the machine leaks." |
| Hindi → English, English → Hindi | ✅ both directions in the group |
| Server-sent system message | ✅ `POST /v4/group-channel/message/send` (sender need not be a member) |

## Behaviour to remember
- **Translation**: `translateModule.setTranslationLanguage(locale)` + `setAutoTranslateEnabled(true)` succeed, but
  live messages were not auto-translated. We explicitly call `translateMessages` for history AND every received
  text message; results arrive via `TranslateHandler.onTranslationCompleted`, keyed by `messageId`.
- Same-language messages come back "translated" to identical text → UI must hide translations equal to the original.
- `createMessagesQuery({ isAscending: false })` returns a page already oldest-first. We sort by `sentTime` anyway.
- History for a group you are not (yet) a member of fails with code **22406**. Group panes must load after membership.
- Group channel ids: letters + digits only, ≤ 64 (`RC-2026-0042` → `rc20260042`).
- Direct channel id = the OTHER user's id on both sides.
- Dev-only gotcha: Fast Refresh of `lib/nexconn/client.ts` orphans listener sets (handlers register once). Reload the tab.
