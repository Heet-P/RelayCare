import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
const { groupChannelId, newNexconnUserId } = await import("@/lib/nexconn/ids");

describe("nexconn ids", () => {
  it("group channel id is letters+digits only, ≤ 64 chars", () => {
    expect(groupChannelId("RC-2026-0042")).toBe("rc20260042");
    expect(groupChannelId("RC-2026-0042")).toMatch(/^[a-z0-9]{1,64}$/);
  });
  it("user ids are opaque and unique", () => {
    const a = newNexconnUserId();
    expect(a).toMatch(/^rcu_[a-z0-9]{12}$/);
    expect(new Set(Array.from({ length: 500 }, newNexconnUserId)).size).toBe(500);
  });
});
