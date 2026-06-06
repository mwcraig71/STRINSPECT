---
name: pdf.js inline bundle in WKWebView (classic script)
description: Why the embedded pdf.js bundle must have its trailing ESM export stripped, and how it is loaded in the annotator WebView.
---

# pdf.js inline bundle for the PDF annotator WebView

The bridge-inspection PDF annotator runs pdf.js **inside a react-native-webview**
loaded via `source={{ html }}` (no base URL), so everything is offline-safe and
self-contained. `scripts/embed-pdfjs.mjs` embeds `pdfjs-dist/build/pdf.min.mjs`
as a string into `components/pdfAnnotatorPdfjsBundled.ts`.

## Rule 1 — must use a CLASSIC `<script>`, not `type="module"`
WKWebView silently **drops module scripts** when the HTML is provided via
`source={{ html }}` (data-URL / no origin). So the bundle and the annotator
logic are injected in plain `<script>` tags.

## Rule 2 — strip the trailing ESM `export{...}` from the bundle
`pdf.min.mjs` is the ESM build: it both assigns the API to `globalThis.pdfjsLib`
AND ends with a top-level `export{te as AbortException,...}` statement. In a
**classic** `<script>`, a top-level `export{}` is a *syntax error that discards
the entire script*, so `globalThis.pdfjsLib` is never set and the annotator shows
"PDF.js not available." The embed script strips that trailing export with a regex
(and throws if it can't find one). The `globalThis.pdfjsLib` assignment already
exposes the full API, so the export is redundant.

**Why:** symptom is the WebView rendering only "PDF.js not available." on iOS even
though the bundle looks present — the whole `<script>` was rejected at parse time.

**How to apply:** if you regenerate the bundle (e.g. after a pdfjs-dist upgrade),
keep both rules. Verify with `grep -c 'export[[:space:]]*{'` on the generated
string — must be 0. The annotator reads `window.pdfjsLib || globalThis.pdfjsLib`
(WKWebView: they're the same object, but keep both for safety).

## Gotcha — backticks inside the HTML template literal
`getPdfAnnotatorHtml()` returns one big template literal. Any backtick in added
HTML comments/text terminates it and breaks the Metro/babel parse with a
misleading "Missing semicolon" pointing at the comment. Never put backticks in
that file's HTML.

## Gotcha — Expo/Metro re-displays a stale bundling error
A failed Expo web-bundle error stays in the workflow log and is re-printed on
later restarts even after the source is fixed (web bundles compile lazily, on
request). Don't trust the log alone. To confirm a *real* recompile, request a
fresh cache-busted bundle and grep the response:
`curl 'http://localhost:$PORT/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&cb=$(date +%s%N)'`
HTTP 200 + your expected code present + 0 syntax-error strings = actually fixed.
