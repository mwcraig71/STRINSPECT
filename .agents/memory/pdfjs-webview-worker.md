---
name: pdf.js worker setup in a WebView
description: Why workerSrc='' breaks on real devices and the blob URL fix.
---

# pdf.js worker in a WebView (WKWebView / Android WebView)

## Rule
Never set `pdfjsLib.GlobalWorkerOptions.workerSrc = ''`. pdf.js 4.4.x throws
**"No GlobalWorkerOptions.workerSrc specified"** for any falsy value (including
`''`) before it ever checks for `pdfjsWorker.WorkerMessageHandler`. Simulator
may tolerate it; real devices do not.

## Working pattern (current codebase)
JSON-encode the worker bundle, embed as a JS string variable, create a Blob URL:

```typescript
// In getPdfAnnotatorHtml():
const workerJson = JSON.stringify(PDFJS_WORKER_INLINE_SCRIPT).replace(/<\//g, "<\\/");
// ^ '<\/' prevents HTML parser from seeing '</script>' inside the <script> tag

// In the HTML template:
// <script>var __pdfWorkerSrc__=${workerJson};</script>

// In the init block (JS inside the HTML):
// try {
//   var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
//   pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
// } catch (_wErr) {
//   try { (0, eval)(__pdfWorkerSrc__); } catch (_) {}
//   pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
// }
```

**Why:** Blob URL gives pdf.js a real, non-empty workerSrc. WKWebView iOS 16+
and Android WebView 60+ both support blob URL workers. Eval fallback registers
`globalThis.pdfjsWorker.WorkerMessageHandler` for old engines.

**How to apply:** Any WebView that runs pdf.js must use this pattern. The same
blob URL approach should be used for the future extraction WebView (Task #40).
