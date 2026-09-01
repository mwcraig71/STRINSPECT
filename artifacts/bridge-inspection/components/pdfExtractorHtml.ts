import { PDFJS_INLINE_SCRIPT, PDFJS_WORKER_INLINE_SCRIPT } from "./pdfAnnotatorPdfjsBundled";

// Headless HTML document that runs pdf.js inside a real browser (WebView) to
// extract text from a PDF. React Native's Hermes engine is not a browser and
// cannot run pdf.js reliably (no web workers, no browser text APIs), so on
// native we route extraction through this WebView instead.
//
// CRITICAL: the per-page line/column reconstruction below must stay byte-for-byte
// equivalent to the web path in utils/pdfParser.ts (loadPdfTextWeb): rows grouped
// by Math.round(y / 2) * 2, sorted top-to-bottom, items sorted left-to-right, and
// a double space inserted whenever the horizontal gap exceeds COLUMN_GAP_PX (15).
// Downstream parsers depend on this exact text shape to keep matching identically.
export function getPdfExtractorHtml(): string {
  const workerJson = JSON.stringify(PDFJS_WORKER_INLINE_SCRIPT).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>

<!-- PDF.js bundled locally — no network dependency (same bundle the annotator
     uses). The first <script> sets up globalThis.pdfjsLib; the second stores the
     worker script as a JS string so the init block can spin an in-thread worker. -->
<script>
${PDFJS_INLINE_SCRIPT}
</script>
<script>var __pdfWorkerSrc__=${workerJson};</script>

<script>
function postRN(msg) {
  try {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  } catch (e) {}
}

/* ── Initialise PDF.js from bundled global ── */
var pdfjsLib = window.pdfjsLib || globalThis.pdfjsLib;
if (!pdfjsLib) {
  postRN({ type: 'extract-error', message: 'PDF viewer failed to initialise.' });
} else {
  // Register the in-thread worker before trying the Blob worker. Android
  // production WebViews can create a Blob URL successfully and then reject the
  // worker asynchronously. PDF.js falls back to this global handler in that
  // case; without it, _setupFakeWorker() calls setup on undefined.
  // Function scope prevents the worker bundle's internal top-level names from
  // colliding with identical names in the already-loaded main PDF.js bundle.
  try { Function(__pdfWorkerSrc__)(); } catch (_) {}
  try {
    var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
  } catch (_wErr) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
  }
}

var extractStarted = false;
var jobId = null;

async function extract(base64Uri) {
  if (!pdfjsLib) { postRN({ type: 'extract-error', id: jobId, message: 'PDF.js not available.' }); return; }
  try {
    var resp = await fetch(base64Uri);
    var buf = await resp.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    var allPages = [];

    for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      var page = await pdf.getPage(pageNum);
      var textContent = await page.getTextContent();

      var rowMap = new Map();
      for (var k = 0; k < textContent.items.length; k++) {
        var item = textContent.items[k];
        if (!('str' in item) || !item.str.trim()) continue;
        var x = item.transform[4];
        var y = item.transform[5];
        var w = item.width;
        var yKey = Math.round(y / 2) * 2;
        if (!rowMap.has(yKey)) rowMap.set(yKey, []);
        rowMap.get(yKey).push({ x: x, rightEdge: x + w, text: item.str });
      }

      var COLUMN_GAP_PX = 15;
      var sortedYs = Array.from(rowMap.keys()).sort(function(a, b) { return b - a; });
      var pageLines = [];
      for (var yi = 0; yi < sortedYs.length; yi++) {
        var items = rowMap.get(sortedYs[yi]).sort(function(a, b) { return a.x - b.x; });
        var line = '';
        var prevRightEdge = -1;
        for (var ii = 0; ii < items.length; ii++) {
          var it = items[ii];
          if (prevRightEdge < 0) {
            line = it.text;
          } else {
            var gap = it.x - prevRightEdge;
            line += (gap > COLUMN_GAP_PX ? '  ' : ' ') + it.text;
          }
          prevRightEdge = it.rightEdge;
        }
        line = line.trim();
        if (line) pageLines.push(line);
      }
      allPages.push(pageLines);
    }

    postRN({ type: 'extract-result', id: jobId, pages: allPages });
  } catch (e) {
    postRN({ type: 'extract-error', id: jobId, message: (e && e.message ? e.message : String(e)) });
  }
}

function onMsg(e) {
  var raw = (typeof e.data === 'string') ? e.data : null;
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch (err) { return; }
  if (data && data.type === 'extract') {
    if (extractStarted) return;
    extractStarted = true;
    jobId = (typeof data.id !== 'undefined') ? data.id : null;
    extract(data.pdfBase64);
  }
}
window.addEventListener('message', onMsg);
document.addEventListener('message', onMsg);

postRN({ type: 'extractor-ready' });
</script>
</body>
</html>`;
}
