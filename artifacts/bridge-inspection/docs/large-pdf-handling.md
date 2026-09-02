# Large inspection-report PDFs (200 MB+)

SCDOT/TxDOT inspection reports are mostly photographs; a 26-page report can be
200 MB or more while its text layer is a few thousand lines. Parsing is not the
problem — pdf.js `getTextContent()` never decodes images — the problem is every
place the app moves the whole file through memory. This note records what is
done on the parser branch and proposes the rest.

## Done (branch `feat/scdot-report-parser`)

- **Native import reads the file once.** `loadPdfTextNative` hands any `file://`
  URI (document-picker copies and bundled assets alike) straight to the
  extraction WebView; the base64 route (three in-memory copies of the file)
  is used only for non-file URIs and refuses files over 60 MB with a message
  instead of crashing.
- **PDF sync streams from disk.** `InspectionContext.syncSession` and
  `offlineQueue` upload with `FileSystem.uploadAsync(BINARY_CONTENT)` rather
  than `readAsStringAsync(Base64)` → `atob` → `fetch`.

## Still limited

| Path | Limit today |
|---|---|
| Web import (`File.arrayBuffer()`) | Whole file in browser memory. Desktop OK, tablet browsers may fail >150 MB. pdf.js cannot range-read a local `File`. |
| Annotator (`PDFAnnotatorModal`) | Reads the file as a base64 data URI into its WebView — same three-copy problem as the old import path. |
| Server storage | `PUT /api/sessions/pdf/:sn` buffers the body in memory and stores it in a Postgres `bytea` column; `GET` sends it back from memory. No size cap. |
| Web redline viewer | `PDFRedlineViewer` downloads the whole document before rendering. |

## Proposal

1. **Derive a light copy at import time, on the server.** After the original
   is uploaded, run a worker (`qpdf`/`gs`/`pdfcpu`) that downsamples embedded
   images to ~100 dpi. Typical result: 200 MB → 5–15 MB with the text layer
   untouched. The app's annotator, the web redline viewer and the "download
   PDF" action all use the light copy; the original is kept for the record.
2. **Move binaries out of Postgres.** Store originals and light copies in
   object storage (Supabase Storage / S3 / R2) keyed by structure number +
   inspection date; keep only the object keys and sizes on
   `inspection_sessions`. Upload from the device with a signed URL and a
   resumable/multipart client (`uploadAsync` with `sessionType: BACKGROUND`
   on Expo, or tus) so a dropped field connection resumes instead of
   restarting 200 MB. `GET` becomes a redirect to a signed URL, which lets
   pdf.js in the browser use HTTP range requests and render page 1 without
   downloading the rest.
3. **Annotator on the light copy, by file URI.** Pass the light copy's local
   path to the annotator WebView the same way import now does, instead of a
   data URI.
4. **Web import guard.** Warn above ~150 MB and suggest the desktop app or
   a light copy; when the storage change lands, the web flow can upload
   first and parse the server-side light copy.
5. **Size telemetry.** Record original size and page count on
   `ImportSummary` so support can see what inspectors actually import.

Order of work: 2 (storage + signed URLs) unlocks 1, 3 and 4; it is a
separate PR from the parser.
