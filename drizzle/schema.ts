import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
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

/** One current shared object per kind; bytes live in Manus storage, not MySQL. */
export const cemagSharedFiles = mysqlTable("cemag_shared_files", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["base", "metas"]).notNull().unique(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  contentType: varchar("contentType", { length: 160 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CemagSharedFile = typeof cemagSharedFiles.$inferSelect;
export type InsertCemagSharedFile = typeof cemagSharedFiles.$inferInsert;

/** Retrato interno da base analítica reconstruída a partir da base central. */
export const cemagAnalyticBases = mysqlTable("cemag_analytic_bases", {
  id: int("id").primaryKey(),
  version: varchar("version", { length: 180 }).notNull().unique(),
  sourceStorageKey: varchar("source_storage_key", { length: 512 }).notNull(),
  sourceFileName: varchar("source_file_name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["processing", "ready", "error"]).notNull(),
  rowCount: int("row_count").notNull().default(0),
  dimensions: text("dimensions").notNull(),
  dataInicio: varchar("data_inicio", { length: 32 }),
  dataFim: varchar("data_fim", { length: 32 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CemagAnalyticBase = typeof cemagAnalyticBases.$inferSelect;
export type InsertCemagAnalyticBase = typeof cemagAnalyticBases.$inferInsert;

/** Linhas normalizadas/raw da versão corrente, mantidas internamente para consultas futuras. */
export const cemagAnalyticRows = mysqlTable("cemag_analytic_rows", {
  id: int("id").autoincrement().primaryKey(),
  baseVersion: varchar("base_version", { length: 180 }).notNull(),
  rowNumber: int("row_number").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ baseRowIdx: uniqueIndex("cemag_analytic_base_row_idx").on(table.baseVersion, table.rowNumber) }));

export type CemagAnalyticRow = typeof cemagAnalyticRows.$inferSelect;
export type InsertCemagAnalyticRow = typeof cemagAnalyticRows.$inferInsert;

/** Último retrato consultado automaticamente para cada município selecionado. */
export const cemagExternalSnapshots = mysqlTable("cemag_external_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  cidade: varchar("cidade", { length: 120 }).notNull(),
  uf: varchar("uf", { length: 2 }),
  payload: text("payload").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
}, (table) => ({ cidadeUfIdx: uniqueIndex("cemag_external_city_uf_idx").on(table.cidade, table.uf) }));

export type CemagExternalSnapshot = typeof cemagExternalSnapshots.$inferSelect;
export type InsertCemagExternalSnapshot = typeof cemagExternalSnapshots.$inferInsert;
