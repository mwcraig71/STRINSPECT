import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inspectionSessionsTable } from "@workspace/db";
import {
  UpsertSessionBody,
  UpsertSessionResponse,
  ListSessionsResponse,
  GetSessionParams,
  GetSessionResponse,
  DeleteSessionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (_req, res) => {
  const rows = await db
    .select({
      id: inspectionSessionsTable.id,
      structureNumber: inspectionSessionsTable.structureNumber,
      source: inspectionSessionsTable.source,
      defectCount: inspectionSessionsTable.defectCount,
      cs4Count: inspectionSessionsTable.cs4Count,
      syncedAt: inspectionSessionsTable.syncedAt,
    })
    .from(inspectionSessionsTable)
    .orderBy(inspectionSessionsTable.syncedAt);

  res.json(ListSessionsResponse.parse(rows));
});

router.post("/sessions", async (req, res) => {
  const bodyParsed = UpsertSessionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { structureNumber } = bodyParsed.data;
  const source = bodyParsed.data.source ?? "mobile_sync";
  const defects = bodyParsed.data.defects ?? [];
  const nbiRatings = bodyParsed.data.nbiRatings ?? [];
  const importSummary = bodyParsed.data.importSummary ?? null;
  const defectCount = defects.length;
  const cs4Count = defects.filter(
    (d): d is { cs: string } =>
      typeof d === "object" &&
      d !== null &&
      (d as Record<string, unknown>)["cs"] === "CS4",
  ).length;

  const [row] = await db
    .insert(inspectionSessionsTable)
    .values({ structureNumber, source, defects, nbiRatings, importSummary, defectCount, cs4Count })
    .onConflictDoUpdate({
      target: inspectionSessionsTable.structureNumber,
      set: { source, defects, nbiRatings, importSummary, defectCount, cs4Count, syncedAt: new Date() },
    })
    .returning({
      id: inspectionSessionsTable.id,
      structureNumber: inspectionSessionsTable.structureNumber,
      source: inspectionSessionsTable.source,
      defectCount: inspectionSessionsTable.defectCount,
      cs4Count: inspectionSessionsTable.cs4Count,
      syncedAt: inspectionSessionsTable.syncedAt,
    });

  res.json(UpsertSessionResponse.parse(row));
});

router.get("/sessions/:id", async (req, res) => {
  const paramsParsed = GetSessionParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(inspectionSessionsTable)
    .where(eq(inspectionSessionsTable.id, paramsParsed.data.id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(GetSessionResponse.parse(rows[0]));
});

router.delete("/sessions/:id", async (req, res) => {
  const paramsParsed = DeleteSessionParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const deleted = await db
    .delete(inspectionSessionsTable)
    .where(eq(inspectionSessionsTable.id, paramsParsed.data.id))
    .returning({ id: inspectionSessionsTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.status(204).send();
});

export default router;
