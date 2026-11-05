/**
 * RelayCare database schema (spec §6 + plan additions).
 *
 * Conventions:
 * - UUID primary keys for every RelayCare record; WooCommerce IDs are kept in separate `wc_*` columns.
 * - Business rules that must hold even if app code is wrong live in the custom SQL migration
 *   (drizzle/0001_rules.sql): transition table + trigger, append-only events, RLS policies.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------- enums

export const memberRole = pgEnum("member_role", ["owner", "support_agent", "dispatcher", "technician"]);

export const caseStatus = pgEnum("case_status", [
  "submitted",
  "under_triage",
  "warranty_review",
  "awaiting_assignment",
  "assigned",
  "scheduled",
  "in_progress",
  "resolution_pending",
  "awaiting_customer",
  "resolved",
  "closed",
  "escalated",
  "rejected",
  "cancelled",
  "reopened",
]);

export const assignmentStatus = pgEnum("assignment_status", ["assigned", "accepted", "rejected", "completed", "cancelled"]);

export const warrantyStatus = pgEnum("warranty_status", [
  "unverified",
  "pending",
  "eligible",
  "expired",
  "not_covered",
  "exception",
]);

export const resolutionType = pgEnum("resolution_type", [
  "repair",
  "replacement",
  "return",
  "refund",
  "no_fault_found",
  "not_covered",
]);

export const casePriority = pgEnum("case_priority", ["low", "normal", "high", "urgent"]);
export const threadType = pgEnum("thread_type", ["direct", "group"]);
export const attachmentVisibility = pgEnum("attachment_visibility", ["case_participants", "staff_only"]);
export const participantRole = pgEnum("participant_role", ["customer", "support_agent", "dispatcher", "technician", "owner"]);
export const jobStatus = pgEnum("job_status", ["pending", "running", "done", "failed"]);
export const partnerKind = pgEnum("partner_kind", ["in_house", "authorised_centre", "manufacturer"]);
export const policyMatch = pgEnum("policy_match", ["all", "product_id", "sku_prefix"]);
export const warrantyStartBasis = pgEnum("warranty_start_basis", ["ordered", "completed"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const tstz = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------- tenancy & people

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: uuid("auth_user_id").unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    /** Chat + UI language: 'en' | 'hi' | 'gu'. Applied to Nexconn translation target. */
    locale: text("locale").notNull().default("en"),
    /** Stable opaque Nexconn ID (rcu_xxx). Never an email or phone. */
    nexconnUserId: text("nexconn_user_id").unique(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: memberRole("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

export const servicePartners = pgTable("service_partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  kind: partnerKind("kind").notNull().default("in_house"),
  phone: text("phone"),
  createdAt: createdAt(),
});

export const technicianProfiles = pgTable(
  "technician_profiles",
  {
    userId: uuid("user_id").notNull().references(() => users.id),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    servicePartnerId: uuid("service_partner_id").references(() => servicePartners.id),
    /** Issue categories this technician handles (empty = all). */
    categories: text("categories").array().notNull().default(sql`'{}'`),
    /** Postcodes / city names served (empty = all). */
    serviceAreas: text("service_areas").array().notNull().default(sql`'{}'`),
    isAvailable: boolean("is_available").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

// ---------------------------------------------------------------- WooCommerce

export const storeIntegrations = pgTable("store_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  storeUrl: text("store_url").notNull(),
  consumerKeyEncrypted: text("consumer_key_encrypted").notNull(),
  consumerSecretEncrypted: text("consumer_secret_encrypted").notNull(),
  webhookSecretEncrypted: text("webhook_secret_encrypted").notNull(),
  /** Signs "Get Support" links generated by the WordPress plugin. */
  linkSecretEncrypted: text("link_secret_encrypted").notNull(),
  /** 'read' | 'write' | 'read_write' as reported by WooCommerce. */
  keyPermissions: text("key_permissions"),
  /** Woo webhook IDs we registered: { "order.created": 12, "order.updated": 13 } */
  webhookIds: jsonb("webhook_ids").$type<Record<string, number>>().notNull().default({}),
  /** Line-item meta keys that may hold a device serial number. */
  serialMetaKeys: text("serial_meta_keys").array().notNull().default(sql`'{_serial_number,serial_number}'`),
  connectionStatus: text("connection_status").notNull().default("pending"),
  lastSyncAt: tstz("last_sync_at"),
  createdAt: createdAt(),
});

export const webhookInbox = pgTable(
  "webhook_inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id").notNull().references(() => storeIntegrations.id),
    deliveryId: text("delivery_id").notNull(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    receivedAt: tstz("received_at").notNull().defaultNow(),
    processedAt: tstz("processed_at"),
    error: text("error"),
  },
  (t) => [unique("webhook_inbox_delivery_uq").on(t.integrationId, t.deliveryId)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    /** Linked once the customer proves ownership of `email` via OTP. */
    userId: uuid("user_id").references(() => users.id),
    wcCustomerId: bigint("wc_customer_id", { mode: "number" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    address: jsonb("address").$type<Address>(),
    verifiedAt: tstz("verified_at"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("customers_wc_id_uq").on(t.organizationId, t.wcCustomerId),
    // Guests have no wc_customer_id, so verified email is the identity key.
    uniqueIndex("customers_email_uq").on(t.organizationId, sql`lower(${t.email})`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    wcOrderId: bigint("wc_order_id", { mode: "number" }).notNull(),
    orderNumber: text("order_number").notNull(),
    wcStatus: text("wc_status").notNull(),
    orderedAt: tstz("ordered_at"),
    completedAt: tstz("completed_at"),
    /** Woo `date_modified_gmt`; older webhook deliveries never overwrite newer data. */
    wcDateModified: tstz("wc_date_modified"),
    total: numeric("total", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }),
    shippingAddress: jsonb("shipping_address").$type<Address>(),
    rawSnapshot: jsonb("raw_snapshot").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    unique("orders_wc_uq").on(t.organizationId, t.wcOrderId),
    // Target for the composite FK from service_cases (case customer must own the order).
    unique("orders_id_customer_uq").on(t.id, t.customerId),
    index("idx_orders_customer").on(t.customerId, t.orderedAt.desc()),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    wcLineItemId: bigint("wc_line_item_id", { mode: "number" }).notNull(),
    productId: bigint("product_id", { mode: "number" }),
    variationId: bigint("variation_id", { mode: "number" }),
    name: text("name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull().default(1),
    serialNumber: text("serial_number"),
    snapshot: jsonb("snapshot").notNull().default({}),
  },
  (t) => [
    unique("order_items_wc_uq").on(t.orderId, t.wcLineItemId),
    // Target for the composite FK from service_cases (case item must belong to case order).
    unique("order_items_id_order_uq").on(t.id, t.orderId),
  ],
);

export const warrantyPolicies = pgTable("warranty_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  matchType: policyMatch("match_type").notNull().default("all"),
  matchValue: text("match_value"),
  durationMonths: integer("duration_months").notNull(),
  startBasis: warrantyStartBasis("start_basis").notNull().default("completed"),
  coverageNotes: text("coverage_notes"),
  /** Higher priority wins when several policies match. */
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const warranties = pgTable("warranties", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id").notNull().unique().references(() => orderItems.id),
  policyId: uuid("policy_id").references(() => warrantyPolicies.id),
  durationMonths: integer("duration_months"),
  startsAt: date("starts_at"),
  expiresAt: date("expires_at"),
  verificationStatus: warrantyStatus("verification_status").notNull().default("unverified"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: tstz("verified_at"),
  notes: text("notes"),
  /** 'policy' (computed suggestion) | 'manual' | 'woocommerce_meta' */
  source: text("source"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- service cases

export const caseCounters = pgTable(
  "case_counters",
  {
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    year: smallint("year").notNull(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.year] })],
);

export const serviceCases = pgTable(
  "service_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    caseNumber: text("case_number").notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    orderId: uuid("order_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    /** The original complaint, exactly as the customer wrote it. Never edited. */
    description: text("description").notNull(),
    /** Troubleshooting the customer already tried. */
    troubleshooting: text("troubleshooting").array().notNull().default(sql`'{}'`),
    reportedSerial: text("reported_serial"),
    priority: casePriority("priority").notNull().default("normal"),
    status: caseStatus("status").notNull().default("submitted"),
    warrantyStatus: warrantyStatus("warranty_status").notNull().default("unverified"),
    resolutionType: resolutionType("resolution_type"),
    resolutionNotes: text("resolution_notes"),
    assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
    /** Who is responsible right now (agent, dispatcher, technician or customer). */
    currentOwnerId: uuid("current_owner_id").references(() => users.id),
    serviceAddress: jsonb("service_address").$type<Address>(),
    escalatedFromStatus: caseStatus("escalated_from_status"),
    csatScore: smallint("csat_score"),
    csatComment: text("csat_comment"),
    createdAt: createdAt(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
    resolvedAt: tstz("resolved_at"),
    closedAt: tstz("closed_at"),
  },
  (t) => [
    unique("service_cases_number_uq").on(t.organizationId, t.caseNumber),
    // Composite FKs: a case can never point at another customer's order or another order's item.
    foreignKey({
      name: "service_cases_order_customer_fk",
      columns: [t.orderId, t.customerId],
      foreignColumns: [orders.id, orders.customerId],
    }),
    foreignKey({
      name: "service_cases_item_order_fk",
      columns: [t.orderItemId, t.orderId],
      foreignColumns: [orderItems.id, orderItems.orderId],
    }),
    index("idx_cases_status").on(t.organizationId, t.status, t.createdAt.desc()),
    index("idx_cases_customer").on(t.customerId, t.createdAt.desc()),
  ],
);

export const caseParticipants = pgTable(
  "case_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => serviceCases.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    participantRole: participantRole("participant_role").notNull(),
    joinedAt: tstz("joined_at").notNull().defaultNow(),
    /** Removed participants lose case access (enforced by app.can_access_case). */
    removedAt: tstz("removed_at"),
  },
  (t) => [unique("case_participants_uq").on(t.caseId, t.userId)],
);

export const caseAssignments = pgTable(
  "case_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => serviceCases.id),
    technicianId: uuid("technician_id").notNull().references(() => users.id),
    servicePartnerId: uuid("service_partner_id").references(() => servicePartners.id),
    assignedBy: uuid("assigned_by").notNull().references(() => users.id),
    assignmentStatus: assignmentStatus("assignment_status").notNull().default("assigned"),
    scheduledAt: tstz("scheduled_at"),
    acceptedAt: tstz("accepted_at"),
    completedAt: tstz("completed_at"),
    /** Reason given on reject / cancel. */
    note: text("note"),
    /** Technician's completion report: findings, work performed, parts. */
    report: jsonb("report"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_assignments_technician").on(t.technicianId, t.assignmentStatus),
    // History is kept forever; only ONE assignment per case may be active at a time.
    uniqueIndex("case_assignments_one_active_uq")
      .on(t.caseId)
      .where(sql`${t.assignmentStatus} in ('assigned', 'accepted')`),
  ],
);

export const caseHandoffs = pgTable("case_handoffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => serviceCases.id),
  fromUserId: uuid("from_user_id").references(() => users.id),
  /** null = handed to the dispatch queue rather than a person. */
  toUserId: uuid("to_user_id").references(() => users.id),
  contextSnapshot: jsonb("context_snapshot").notNull(),
  acknowledgedAt: tstz("acknowledged_at"),
  createdAt: createdAt(),
});

export const caseAttachments = pgTable("case_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => serviceCases.id),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  checksum: text("checksum"),
  /** 'complaint' | 'inspection' | 'repair' | 'document' */
  purpose: text("purpose").notNull().default("complaint"),
  visibility: attachmentVisibility("visibility").notNull().default("case_participants"),
  createdAt: createdAt(),
});

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => serviceCases.id),
    threadType: threadType("thread_type").notNull(),
    customerNexconnId: text("customer_nexconn_id"),
    agentNexconnId: text("agent_nexconn_id"),
    nexconnGroupId: text("nexconn_group_id"),
    isActive: boolean("is_active").notNull().default(true),
    lastMessageAt: tstz("last_message_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chat_threads_one_group_uq").on(t.caseId).where(sql`${t.threadType} = 'group'`),
    uniqueIndex("chat_threads_group_id_uq").on(t.nexconnGroupId),
  ],
);

export const caseEvents = pgTable(
  "case_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => serviceCases.id),
    actorId: uuid("actor_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    oldStatus: caseStatus("old_status"),
    newStatus: caseStatus("new_status"),
    metadata: jsonb("metadata").notNull().default({}),
    // clock_timestamp(), not now(): several events written in one transaction must keep their order.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (t) => [index("idx_case_events_timeline").on(t.caseId, t.createdAt.desc())],
);

// ---------------------------------------------------------------- infrastructure

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: jobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: tstz("run_at").notNull().defaultNow(),
    lockedAt: tstz("locked_at"),
    lastError: text("last_error"),
    /** Optional idempotency key: enqueueing the same key twice is a no-op. */
    dedupeKey: text("dedupe_key").unique(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_jobs_ready").on(t.status, t.runAt)],
);

export const nexconnEvents = pgTable("nexconn_events", {
  /** Nexconn's unique event id: primary key = free deduplication. */
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: tstz("received_at").notNull().defaultNow(),
  processedAt: tstz("processed_at"),
  error: text("error"),
});

// ---------------------------------------------------------------- shared types

export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
};
