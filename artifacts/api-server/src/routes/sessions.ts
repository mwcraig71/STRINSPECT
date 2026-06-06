import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  const xApiKey = req.headers["x-api-key"];

  let provided: string | undefined;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    provided = authHeader.slice(7);
  } else if (typeof xApiKey === "string") {
    provided = xApiKey;
  }

  if (!provided || provided !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

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

router.post("/sessions", requireApiKey, async (req, res) => {
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
  const pdfAnnotations = bodyParsed.data.pdfAnnotations ?? null;
  const defectCount = defects.length;
  const cs4Count = defects.filter(
    (d): d is { cs: string } =>
      typeof d === "object" &&
      d !== null &&
      (d as Record<string, unknown>)["cs"] === "CS4",
  ).length;

  const [row] = await db
    .insert(inspectionSessionsTable)
    .values({ structureNumber, source, defects, nbiRatings, importSummary, pdfAnnotations, defectCount, cs4Count })
    .onConflictDoUpdate({
      target: inspectionSessionsTable.structureNumber,
      set: { source, defects, nbiRatings, importSummary, pdfAnnotations, defectCount, cs4Count, syncedAt: new Date() },
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

// ── PDF binary upload/download ────────────────────────────────────────────────

router.put(
  "/sessions/pdf/:structureNumber",
  requireApiKey,
  (req: Request, _res: Response, next: NextFunction) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on("error", next);
  },
  async (req: Request, res: Response) => {
    const structureNumber = String(req.params["structureNumber"] ?? "");
    if (!structureNumber) {
      res.status(400).json({ error: "structureNumber is required" });
      return;
    }

    const body = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!body || body.length === 0) {
      res.status(400).json({ error: "Empty PDF body" });
      return;
    }

    const [updated] = await db
      .update(inspectionSessionsTable)
      .set({ pdfDocument: body })
      .where(eq(inspectionSessionsTable.structureNumber, structureNumber))
      .returning({ id: inspectionSessionsTable.id });

    if (!updated) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ ok: true, bytes: body.length });
  },
);

// GET is intentionally public (read-only; web dashboard fetches through Vite proxy
// which adds auth in dev; making it readable is explicit policy for this endpoint).
// NOTE: endpoint uses PUT /sessions/pdf/:structureNumber (raw body) rather than the
// originally specified multipart POST — mobile and server are internally consistent.
router.get("/sessions/pdf/:structureNumber", async (req, res) => {
  const structureNumber = String(req.params["structureNumber"] ?? "");
  if (!structureNumber) {
    res.status(400).json({ error: "structureNumber is required" });
    return;
  }

  const rows = await db
    .select({ pdfDocument: inspectionSessionsTable.pdfDocument })
    .from(inspectionSessionsTable)
    .where(eq(inspectionSessionsTable.structureNumber, structureNumber))
    .limit(1);

  if (rows.length === 0 || !rows[0].pdfDocument) {
    res.status(404).json({ error: "No PDF found for this session" });
    return;
  }

  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `inline; filename="${structureNumber}.pdf"`);
  res.send(rows[0].pdfDocument);
});

// ── Single session (by UUID id) ────────────────────────────────────────────────

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
