import { pgTable, text, integer, timestamp, jsonb, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inspectionSessionsTable = pgTable(
  "inspection_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    structureNumber: text("structure_number").notNull(),
    defectCount: integer("defect_count").notNull().default(0),
    cs4Count: integer("cs4_count").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    defects: jsonb("defects").notNull().default([]),
    nbiRatings: jsonb("nbi_ratings").notNull().default([]),
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
