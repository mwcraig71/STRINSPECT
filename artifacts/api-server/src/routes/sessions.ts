import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inspectionSessionsTable } from "@workspace/db";
import { UpsertSessionBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (_req, res) => {
  const rows = await db
    .select({
      id: inspectionSessionsTable.id,
      structureNumber: inspectionSessionsTable.structureNumber,
      defectCount: inspectionSessionsTable.defectCount,
      cs4Count: inspectionSessionsTable.cs4Count,
      syncedAt: inspectionSessionsTable.syncedAt,
    })
    .from(inspectionSessionsTable)
    .orderBy(inspectionSessionsTable.syncedAt);

  res.json(rows);
});

router.post("/sessions", async (req, res) => {
  const parsed = UpsertSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { structureNumber } = parsed.data;
  const defects = parsed.data.defects ?? [];
  const nbiRatings = parsed.data.nbiRatings ?? [];
  const defectCount = defects.length;
  const cs4Count = defects.filter(
    (d): d is { cs: string } => typeof d === "object" && d !== null && (d as Record<string, unknown>)["cs"] === "CS4",
  ).length;

  const existing = await db
    .select({ id: inspectionSessionsTable.id })
    .from(inspectionSessionsTable)
    .where(eq(inspectionSessionsTable.structureNumber, structureNumber))
    .limit(1);

  let row;
  if (existing.length > 0) {
    const updated = await db
      .update(inspectionSessionsTable)
      .set({
        defects,
        nbiRatings,
        defectCount,
        cs4Count,
        syncedAt: new Date(),
      })
      .where(eq(inspectionSessionsTable.structureNumber, structureNumber))
      .returning({
        id: inspectionSessionsTable.id,
        structureNumber: inspectionSessionsTable.structureNumber,
        defectCount: inspectionSessionsTable.defectCount,
        cs4Count: inspectionSessionsTable.cs4Count,
        syncedAt: inspectionSessionsTable.syncedAt,
      });
    row = updated[0];
  } else {
    const inserted = await db
      .insert(inspectionSessionsTable)
      .values({ structureNumber, defects, nbiRatings, defectCount, cs4Count })
      .returning({
        id: inspectionSessionsTable.id,
        structureNumber: inspectionSessionsTable.structureNumber,
        defectCount: inspectionSessionsTable.defectCount,
        cs4Count: inspectionSessionsTable.cs4Count,
        syncedAt: inspectionSessionsTable.syncedAt,
      });
    row = inserted[0];
  }

  res.json(row);
});

router.get("/sessions/:id", async (req, res) => {
  const rows = await db
    .select()
    .from(inspectionSessionsTable)
    .where(eq(inspectionSessionsTable.id, req.params.id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const row = rows[0];
  res.json({
    id: row.id,
    structureNumber: row.structureNumber,
    defectCount: row.defectCount,
    cs4Count: row.cs4Count,
    syncedAt: row.syncedAt,
    defects: row.defects,
    nbiRatings: row.nbiRatings,
  });
});

router.delete("/sessions/:id", async (req, res) => {
  const deleted = await db
    .delete(inspectionSessionsTable)
    .where(eq(inspectionSessionsTable.id, req.params.id))
    .returning({ id: inspectionSessionsTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.status(204).send();
});

export default router;
