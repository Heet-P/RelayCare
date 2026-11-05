import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_PAIRS, availableActions, canTransition, CASE_STATUSES, ownerKindFor } from "@/lib/cases/state-machine";

describe("case state machine", () => {
  it("DB transition table mirrors ALLOWED_PAIRS exactly", () => {
    const sql = readFileSync("drizzle/0001_rules.sql", "utf8");
    const block = sql.split("INSERT INTO public.case_status_transitions")[1].split(";")[0];
    const fromSql = [...block.matchAll(/\('(\w+)', '(\w+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    expect(fromSql).toEqual(ALLOWED_PAIRS.map(([a, b]) => `${a}>${b}`));
  });

  it("rejects pairs that are not in the table", () => {
    expect(canTransition("submitted", "closed", "owner")).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(canTransition("closed", "under_triage", "owner")).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("only the customer can confirm a resolution", () => {
    for (const role of ["owner", "support_agent", "dispatcher", "technician"] as const) {
      expect(canTransition("resolution_pending", "resolved", role)).toMatchObject({ ok: false, code: "forbidden" });
    }
    expect(canTransition("resolution_pending", "resolved", "customer")).toEqual({ ok: true, action: "confirm_resolution" });
  });

  it("technician cannot close or resolve a case", () => {
    for (const from of CASE_STATUSES) {
      expect(canTransition(from, "closed", "technician").ok).toBe(false);
      expect(canTransition(from, "resolved", "technician").ok).toBe(false);
    }
  });

  it("completing work requires report, resolution type and evidence", () => {
    const base = { resolutionType: "repair" as const, hasCompletionReport: true, technicianEvidenceCount: 1 };
    expect(canTransition("in_progress", "resolution_pending", "technician", base).ok).toBe(true);
    expect(canTransition("in_progress", "resolution_pending", "technician", { ...base, technicianEvidenceCount: 0 }))
      .toMatchObject({ ok: false, code: "precondition_failed" });
    expect(canTransition("in_progress", "resolution_pending", "technician", { ...base, hasCompletionReport: false }))
      .toMatchObject({ ok: false, code: "precondition_failed" });
    expect(canTransition("in_progress", "resolution_pending", "technician", { ...base, resolutionType: null }))
      .toMatchObject({ ok: false, code: "precondition_failed" });
  });

  it("dispatch requires verified warranty and a handoff", () => {
    expect(canTransition("warranty_review", "awaiting_assignment", "support_agent", { warrantyStatus: "unverified", hasHandoff: true }).ok).toBe(false);
    expect(canTransition("warranty_review", "awaiting_assignment", "support_agent", { warrantyStatus: "eligible", hasHandoff: false }).ok).toBe(false);
    expect(canTransition("warranty_review", "awaiting_assignment", "support_agent", { warrantyStatus: "exception", hasHandoff: true }).ok).toBe(true);
  });

  it("assignment only through the assign endpoint", () => {
    expect(canTransition("awaiting_assignment", "assigned", "dispatcher").ok).toBe(false);
    expect(canTransition("awaiting_assignment", "assigned", "dispatcher", { hasActiveAssignment: true }).ok).toBe(true);
    expect(canTransition("awaiting_assignment", "assigned", "customer", { hasActiveAssignment: true }))
      .toMatchObject({ code: "forbidden" });
  });

  it("de-escalation restores the previous status for dispatch only", () => {
    expect(canTransition("escalated", "scheduled", "dispatcher", { escalatedFromStatus: "scheduled" }).ok).toBe(true);
    expect(canTransition("escalated", "scheduled", "support_agent", { escalatedFromStatus: "scheduled" }).ok).toBe(false);
    expect(canTransition("escalated", "scheduled", "dispatcher", { escalatedFromStatus: "in_progress" }).ok).toBe(false);
  });

  it("reasons are required where the spec implies them", () => {
    expect(canTransition("under_triage", "rejected", "support_agent").ok).toBe(false);
    expect(canTransition("under_triage", "rejected", "support_agent", { reason: "Physical damage by user" }).ok).toBe(true);
  });

  it("exposes actions per role and owner kinds for every status", () => {
    expect(availableActions("resolution_pending", "customer").map((a) => a.to).sort()).toEqual(["reopened", "resolved"]);
    expect(availableActions("closed", "owner")).toEqual([]);
    for (const s of CASE_STATUSES) expect(() => ownerKindFor(s)).not.toThrow();
  });
});
