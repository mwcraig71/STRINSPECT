# PR proposal: move inspection PDFs (and photos) out of Postgres into object storage

**Scope:** api-server, lib/db, bridge-web, and the sync side of bridge-inspection. Independent of the parser PR (`feat/scdot-report-parser`), which it should follow.
**Constraint:** the mobile app is offline-first. Nothing here touches the inspector's critical path (import, parse, annotate, summary all work from the original file on the device). This PR only changes what happens when the offline queue gets a connection, and what the web dashboard reads.

## Problem

Today (`lib/db/src/schema/inspectionSessions.ts`, `sessionPhotos.ts`, `artifacts/api-server/src/routes/sessions.ts`):

- The full report is stored in `inspection_sessions.pdf_document bytea`; every photo in `session_photos.photo_data bytea`.
- `PUT /api/sessions/pdf/:structureNumber` reads the raw body into one `Buffer` (`Buffer.concat(chunks)`) and writes it to the row. There is no size cap on the raw route (the 10 MB `express.json` limit does not apply).
- `GET /api/sessions/pdf/:structureNumber` selects the `bytea` into memory and `res.send()`s it.
- `bridge-web` (`PDFRedlineViewer`, `review-export.tsx`) `fetch()`es the whole document into an `ArrayBuffer` before rendering page 1.

With 200 MB+ reports this means: a 200 MB request body held in Node memory per upload, a 200 MB row that makes every `SELECT *` on the session slow (Drizzle selects the column unless excluded), TOAST bloat and slow backups in Postgres, a 200 MB download before the dashboard shows anything, and a single non-resumable `PUT` from a field connection that restarts from zero on every drop. The mobile side already streams the upload from disk (`FileSystem.uploadAsync`, on the parser branch), which removes the device-memory problem but not the transport or server problems.

## Design

1. **Object storage for binaries.** Originals and photos go to an S3-compatible bucket (Supabase Storage is the natural fit given the Postgres/Supabase stack; S3 or R2 work identically through the S3 API). Keys: `reports/{structureNumber}/{inspectionDate}/original.pdf`, `reports/{structureNumber}/{inspectionDate}/light.pdf`, `photos/{structureNumber}/{photoId}.jpg`. Bucket is private; all access via short-lived signed URLs.
2. **Signed, resumable uploads from the device.** New `POST /api/sessions/pdf/:structureNumber/upload-url` returns a signed PUT URL (or an S3 multipart/TUS session for files > 50 MB). The device uploads straight to storage with `FileSystem.uploadAsync(..., { sessionType: BACKGROUND })` so it continues when the app is backgrounded, then calls `POST /api/sessions/pdf/:structureNumber/complete` with the object key, byte size and SHA-256 so the server can verify and record it. The API server never proxies file bytes.
3. **Metadata in Postgres, not bytes.** Replace `pdf_document bytea` with `pdf_object_key text`, `pdf_bytes bigint`, `pdf_sha256 text`, `pdf_uploaded_at timestamptz`, `pdf_light_object_key text` (nullable). Replace `photo_data bytea` with `object_key text`, `bytes int`, `content_type text`. Photos follow the same upload-url/complete pattern.
4. **Reads redirect.** `GET /api/sessions/pdf/:structureNumber` returns `302` to a signed GET URL (`?variant=light|original`, default light when present). `pdfjs-dist` in `PDFRedlineViewer` is given the URL instead of an `ArrayBuffer` (`getDocument({ url })`), which lets it use HTTP range requests and render page 1 without downloading the rest.
5. **Server-side light copy (dashboard only).** On `complete`, enqueue a job that downloads the original, downsamples embedded images to ~100 dpi (`qpdf` + `gs`, or `pdfcpu optimize`), and writes `light.pdf` (typically 200 MB → 5–15 MB, text layer untouched). Run it as a background worker or a Supabase Edge Function; until it finishes, `variant=light` falls back to the original. The device never depends on this.
6. **Keep the old routes working during migration.** `PUT /api/sessions/pdf/:sn` keeps accepting a raw body for one release (streams it to storage instead of `bytea`) so older app builds still sync. A one-off script moves existing `bytea` rows to storage and nulls the columns; the columns are dropped in a follow-up migration once no rows remain.

## Changes by package

- `lib/db`: migration adding the object-key columns, backfill script, later migration dropping `pdf_document` / `photo_data`; Zod schemas regenerated.
- `lib/api-spec` + generated clients: new `upload-url` / `complete` endpoints, `GET` documented as a redirect.
- `artifacts/api-server`: storage client (`@aws-sdk/client-s3` + `s3-request-presigner`, or `@supabase/supabase-js` storage), the three PDF routes, the same for photos, the light-copy job trigger, env vars `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, credentials.
- `artifacts/bridge-inspection` (sync only): `syncSession` and `lib/offlineQueue.ts` call `upload-url`, upload to the signed URL with `uploadAsync` (`BACKGROUND`, multipart above 50 MB), then `complete`. Import, parse, annotate unchanged.
- `artifacts/bridge-web`: `PDFRedlineViewer` takes a URL for pdf.js; review-export uses the light variant for display and offers the original for download.

## Rollout

1. Schema migration (additive), storage bucket, server routes deployed; old `PUT` still accepted and now writes to storage.
2. Backfill existing rows; verify counts and checksums.
3. App release with the signed-URL sync path.
4. Light-copy worker enabled; dashboard switches to `variant=light`.
5. After the app release reaches the field, drop the `bytea` columns.

## Risks and answers

- *Storage credentials on the device:* none; the device only ever holds a short-lived signed URL for one object.
- *Partial uploads:* `complete` verifies size and SHA-256 before the key is recorded; the offline queue entry stays until `complete` succeeds.
- *Offline mode:* unchanged; the queue behaves exactly as today, just with a different destination for bytes.
- *Cost:* object storage is an order of magnitude cheaper than Postgres for this data, and egress from signed URLs replaces API-server bandwidth.

## Effort

Roughly: db + backfill 1 day, api-server routes + storage client 1–2 days, mobile sync 1 day, web viewer 0.5 day, light-copy worker 1 day, testing across a real 200 MB report and a dropped-connection upload 1 day. About a week for one developer, split across two PRs if preferred (storage + routes first, light-copy worker second).

## Not in this PR

Lazy page rendering in the annotator/viewer HTML (the remaining on-device memory cost — see `docs/large-pdf-handling.md` item 1), the web import size guard, and size telemetry on `ImportSummary`.
