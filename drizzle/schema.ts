import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const cadastralPlots = mysqlTable("cadastral_plots", {
  id: int("id").autoincrement().primaryKey(),
  khasraNo: varchar("khasraNo", { length: 50 }).notNull(),
  village: varchar("village", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  totalAreaHa: decimal("totalAreaHa", { precision: 8, scale: 2 }).notNull(),
  sownCrop: varchar("sownCrop", { length: 50 }).notNull(),
  farmerName: varchar("farmerName", { length: 100 }).notNull(),
  farmerPhone: varchar("farmerPhone", { length: 20 }).notNull(),
  geometry: json("geometry").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const floodEvents = mysqlTable("flood_events", {
  id: int("id").autoincrement().primaryKey(),
  acquisitionDate: timestamp("acquisitionDate").notNull(),
  satelliteSource: varchar("satelliteSource", { length: 50 }).notNull().default("Sentinel-1 SAR"),
  affectedDistrict: varchar("affectedDistrict", { length: 100 }).notNull(),
  thresholdMethod: varchar("thresholdMethod", { length: 120 }).notNull(),
  thresholdDb: decimal("thresholdDb", { precision: 5, scale: 2 }).notNull(),
  inundationGeojson: json("inundationGeojson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const claimRecords = mysqlTable("claim_records", {
  id: varchar("id", { length: 64 }).primaryKey(),
  plotId: int("plotId").notNull(),
  floodEventId: int("floodEventId").notNull(),
  inundationPercentage: decimal("inundationPercentage", { precision: 5, scale: 2 }).notNull(),
  cropLossCategory: varchar("cropLossCategory", { length: 20 }).notNull(),
  smsStatus: mysqlEnum("smsStatus", ["QUEUED", "SENT", "DELIVERED", "FAILED"]).notNull().default("QUEUED"),
  claimStatus: mysqlEnum("claimStatus", ["INTIMATION_GENERATED", "PENDING_CONSENT", "SUBMITTED_NCIP", "DECLINED"]).notNull().default("INTIMATION_GENERATED"),
  smsSentAt: timestamp("smsSentAt"),
  farmerResponse: varchar("farmerResponse", { length: 10 }),
  consentTimestamp: timestamp("consentTimestamp"),
  ncipPayload: json("ncipPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const smsEvents = mysqlTable("sms_events", {
  id: int("id").autoincrement().primaryKey(),
  claimId: varchar("claimId", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["OUTBOUND", "INBOUND"]).notNull(),
  payload: text("payload").notNull(),
  deliveryStatus: varchar("deliveryStatus", { length: 30 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const consentTokens = mysqlTable("consent_tokens", {
  id: int("id").autoincrement().primaryKey(),
  claimId: varchar("claimId", { length: 64 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 160 }).notNull(),
  consentChannel: varchar("consentChannel", { length: 30 }).notNull().default("SMS"),
  signedAt: timestamp("signedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
