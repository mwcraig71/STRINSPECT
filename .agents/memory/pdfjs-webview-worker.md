---
name: pdf.js worker setup in a WebView
description: Reliable Blob-worker and isolated fake-worker fallback setup for production WebViews.
---

# pdf.js worker in a WebView (WKWebView / Android WebView)

## Rule
Never set `pdfjsLib.GlobalWorkerOptions.workerSrc = ''`. pdf.js 4.4.x throws
**"No GlobalWorkerOptions.workerSrc specified"** for any falsy value (including
`''`) before it ever checks for `pdfjsWorker.WorkerMessageHandler`. Simulator
may tolerate it; real devices do not.

## Working pattern
JSON-encode the worker bundle and embed it as a JS string variable. Before
creating the Blob worker URL, run the worker bundle inside a new Function so
PDF.js's in-thread fallback is already registered:

```typescript
// In getPdfAnnotatorHtml():
const workerJson = JSON.stringify(PDFJS_WORKER_INLINE_SCRIPT).replace(/<\//g, "<\\/");
// ^ '<\/' prevents HTML parser from seeing '</script>' inside the <script> tag

// In the HTML template:
// <script>var __pdfWorkerSrc__=${workerJson};</script>

// In the init block (JS inside the HTML):
// Function(__pdfWorkerSrc__)();
// try {
//   var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
//   pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
// } catch (_wErr) {
//   pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
// }
```

**Why:** Blob URL gives pdf.js a real, non-empty workerSrc. Android production
WebViews can accept the URL but reject the worker asynchronously, so the fake
worker must be registered before the attempt. Global `eval` is not safe because
the main and worker bundles declare identical top-level names; that collision
silently prevents registration and later causes an undefined `.setup` error.
Function scope avoids the collision while still publishing
`globalThis.pdfjsWorker.WorkerMessageHandler`.

**How to apply:** Every WebView that runs pdf.js—extraction, read-only viewing,
or annotation—must pre-register the worker in isolated function scope before
attempting the Blob worker.
