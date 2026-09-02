# Large inspection-report PDFs (200 MB+), offline-first

Inspection reports are mostly photographs: a 26-page report can be 200 MB or
more while its text layer is a few thousand lines. Parsing is not the
problem — pdf.js `getTextContent()` never decodes images — the problem is every
place the app moves the whole file through React Native memory.

The governing constraint is that the app is used at the bridge with no
connectivity. Everything an inspector needs during the inspection (import,
parse, annotate, summary, photos) must work from the original file on the
device; the server only ever sees the file later, through the offline queue.
Nothing on the critical path may wait on an upload or on server processing.

## Done (branch `feat/scdot-report-parser`)

- **Import reads the file once, on device.** `loadPdfTextNative` hands any
  `file://` URI (document-picker copies and bundled assets) straight to the
  extraction WebView, which reads it and runs pdf.js. The base64 route (file →
  JS string → WebView → bytes: three copies) remains only for non-file URIs
  and refuses files over 60 MB with a clear message instead of crashing.
- **Annotator and read-only viewer load by file URI.** `PDFAnnotatorModal` and
  `PdfReadOnlyPanel` pass the local path to their WebView (`pdfUri`) instead
  of a base64 data URI, so the file is held once, inside the WebView, while
  pdf.js decodes only the pages it renders. Web keeps the data-URI path.
- **Sync streams from disk.** `syncSession` and `offlineQueue` upload with
  `FileSystem.uploadAsync(BINARY_CONTENT)` rather than
  `readAsStringAsync(Base64)` → `atob` → `fetch`. Behaviour in the queue is
  unchanged: a failed upload throws, the entry stays queued, retry later.

## Still limited, in priority order

1. **Page rendering memory (device).** `renderAllPages()` in both viewer HTML
   files renders every page eagerly at 2–3× device resolution. On a 26-page
   report that is several hundred MB of canvas regardless of file size. This
   is now the dominant memory cost on device. Fix: render only pages near the
   viewport (there is already an `IntersectionObserver` for page tracking to
   hang it on) and release canvases that scroll far away; annotations are
   stored per page in PDF coordinates so they survive re-rendering.
2. **Upload resilience (field → office).** A 200 MB single `PUT` over a
   field connection will fail often; `uploadAsync` retries whole. Use
   `sessionType: BACKGROUND` so uploads continue when the app is backgrounded,
   and prefer a resumable/multipart target (see 4) so a dropped connection
   resumes instead of restarting.
3. **Web import.** `File.arrayBuffer()` loads the whole file into browser
   memory; pdf.js cannot range-read a local `File`. Desktop is fine; warn
   above ~150 MB and suggest the desktop app or a light copy.
4. **Server storage (`bytea`).** Full proposal: `pr-proposal-pdf-object-storage.md`. `PUT /api/sessions/pdf/:sn` buffers the
   body and stores it in Postgres; `GET` sends it from memory; no size cap.
   Move originals to object storage (Supabase Storage / S3 / R2) keyed by
   structure number + inspection date, keep only object keys and sizes on
   `inspection_sessions`, upload with a signed URL, and make `GET` a
   redirect so the web redline viewer can use HTTP range requests.
5. **Server-side light copy (dashboard only).** Once the original is in
   object storage, a worker (`qpdf`/`gs`/`pdfcpu`) can downsample images to
   ~100 dpi (200 MB → 5–15 MB, text layer untouched) for the web viewer and
   the download button. This never runs on the device and never blocks the
   inspector; it is an optimisation for people reviewing in the office.
6. **Size telemetry.** Record original size and page count on
   `ImportSummary` so support can see what inspectors actually import.

What was considered and rejected: producing a downsampled copy on the device
(needs a native PDF library; not available in Expo managed JS), and any flow
that uploads before annotating (breaks offline use). If lazy rendering (1)
is not enough on older phones, the next step is a native renderer such as
`react-native-pdf` that draws from the file path without loading it into JS,
at the cost of an Expo dev build.
