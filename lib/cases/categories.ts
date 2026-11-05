/** Spec Journey B: suggested issue categories (stable keys; labels are display text). */
export const ISSUE_CATEGORIES = [
  { key: "not_working", label: "Product not working" },
  { key: "physical_damage", label: "Physical damage" },
  { key: "power", label: "Charging or power issue" },
  { key: "performance", label: "Performance issue" },
  { key: "missing_component", label: "Missing component" },
  { key: "installation", label: "Installation problem" },
  { key: "warranty_claim", label: "Warranty claim" },
  { key: "other", label: "Other" },
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = ISSUE_CATEGORIES.map((c) => c.key) as [IssueCategory, ...IssueCategory[]];
export const categoryLabel = (key: string) => ISSUE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
