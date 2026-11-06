import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
const { groupChannelId, newNexconnUserId } = await import("@/lib/nexconn/ids");

describe("nexconn ids", () => {
  it("group channel id is letters+digits only, ≤ 64 chars", () => {
    expect(groupChannelId("RC-2026-0042", "A1B2C3D4-0000-4000-8000-000000000000")).toBe("rc20260042a1b2c3");
    expect(groupChannelId("RC-2026-0042", "a1b2c3d4-0000-4000-8000-000000000000")).toMatch(/^[a-z0-9]{1,64}$/);
  });
  it("user ids are opaque and unique", () => {
    const a = newNexconnUserId();
    expect(a).toMatch(/^rcu_[a-z0-9]{12}$/);
    expect(new Set(Array.from({ length: 500 }, newNexconnUserId)).size).toBe(500);
  });
});
