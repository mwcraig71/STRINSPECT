import { pgTable, text, integer, timestamp, jsonb, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const SESSION_SOURCES = ["mobile_sync", "pdf_import"] as const;
export type SessionSource = typeof SESSION_SOURCES[number];

export const SESSION_STATUSES = ["in_progress", "finalized"] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];

export const inspectionSessionsTable = pgTable(
  "inspection_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    structureNumber: text("structure_number").notNull(),
    source: text("source").$type<SessionSource>().notNull().default("mobile_sync"),
    status: text("status").$type<SessionStatus>().notNull().default("in_progress"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    defectCount: integer("defect_count").notNull().default(0),
    cs4Count: integer("cs4_count").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    defects: jsonb("defects").notNull().default([]),
    nbiRatings: jsonb("nbi_ratings").notNull().default([]),
    importSummary: jsonb("import_summary"),
    pdfAnnotations: jsonb("pdf_annotations"),
    pdfDocument: bytea("pdf_document"),
  },
  (t) => [uniqueIndex("uq_inspection_sessions_structure_number").on(t.structureNumber)],
);

export const insertInspectionSessionSchema = createInsertSchema(inspectionSessionsTable).omit({
  id: true,
  syncedAt: true,
});

export const selectInspectionSessionSchema = createSelectSchema(inspectionSessionsTable);

export type InsertInspectionSession = z.infer<typeof insertInspectionSessionSchema>;
export type InspectionSession = typeof inspectionSessionsTable.$inferSelect;
