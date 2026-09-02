---
name: Native PDF text extraction via WebView
description: Why/how native PDF import extraction runs in a headless WebView, and the parity constraint that binds it to the web path.
---

# Native PDF text extraction runs in a WebView, never in Hermes

Hermes is not a browser: no web workers, unreliable local-file reads, no browser
text APIs. Running pdf.js there caused a recurring chain of import failures
(missing worker, "Invalid PDF structure", base64 decode errors). So extraction is
split by platform in `utils/pdfParser.ts` (`loadPdfText`):
- **Web** (`loadPdfTextWeb`): pdf.js runs directly in the browser. pdf.js is
  **lazy-loaded** (`getWebPdfjs`) so the heavy browser-only bundle never enters
  the native Metro graph.
- **Native** (`loadPdfTextNative`): drives a headless WebView through an imperative
  bridge. Local `file://` sources are passed directly first so the PDF is read
  once by pdf.js. Some Samsung Android WebViews reject `fetch(file://...)` with
  "Failed to fetch"; for that transport failure only, retry through base64 below
  `MAX_BASE64_PDF_BYTES` (60 MB). Larger files fail clearly instead of risking an
  out-of-memory crash.

## Moving parts
- `components/pdfExtractorHtml.ts` — self-contained HTML that reuses the annotator's
  bundled pdf.js (`pdfAnnotatorPdfjsBundled.ts`) and extracts text.
- `components/pdfExtractorBridge.ts` — module singleton; the host registers its impl,
  the (non-component) parser passes either a base64 payload or local file URI.
- `components/PdfTextExtractorHost.tsx` — always mounted (in `app/_layout.tsx`),
  invisible; owns one on-demand WebView. Single-flight, 180s timeout, teardown reject.

## Hard constraint: web/native extraction parity
The per-page line/column reconstruction is **duplicated** (TS in `loadPdfTextWeb`,
JS string in `pdfExtractorHtml.ts`) and MUST stay byte-for-byte identical, or the
downstream pure parsers stop matching. The shared recipe: bucket rows by
`Math.round(y/2)*2`, sort Ys descending, sort items ascending by x, insert a
**double** space when `gap > COLUMN_GAP_PX (15)` else single, trim, drop empties.
**Why:** parsers key off exact spacing/column layout. Change one copy → change both.

## Transport gotchas (learned in review)
- Send the PDF to the WebView via `webViewRef.postMessage(...)`, NOT by eval'ing a
  multi-MB JS string through `injectJavaScript` — the latter is fragile for large
  payloads.
- Do not base64-encode very large bundled PDFs. Base64 adds roughly one-third in
  size and JSON/state transfer creates additional copies, which can exhaust a
  phone's memory before pdf.js starts. Mark that source for direct URI transport
  and allow local-file access on the extraction WebView.
- Treat direct `file://` loading as an optimization, not a guarantee. Samsung
  Android System WebView may still block it despite the file-access flags. On a
  direct transport error, retry base64 only after enforcing the 60 MB cap.
- The tablet's read-only Previous Report pane has the same WebView restriction.
  On Android, pass local PDFs at or below 60 MB as base64 before rendering;
  preserve direct URI loading for larger files to avoid extra memory copies.
- Correlate request/response with a **job id**; a late result from a torn-down job
  must be ignored or it can resolve a newer pending job with stale pages.
