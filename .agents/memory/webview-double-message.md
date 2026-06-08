---
name: WebView init message fires twice
description: react-native-webview init handlers run twice (window + document); guard async setup or renders interleave
---

# react-native-webview: the init message is delivered twice

The RN side (PDFAnnotatorModal) dispatches the `init` MessageEvent to **both**
`window` and `document` (and the embedded HTML registers its handler on both),
because iOS delivers to `window` and Android to `document`. On a single device,
**both** can fire, so the handler runs twice.

**Why it matters:** if the handler kicks off async work (e.g. `loadPdf` that does
`zoomWrap.innerHTML=''` then awaits page rendering and writes a `pageCanvases`
map), two passes interleave. Each clears the DOM and appends page-wraps, so the
visible canvas and the `pageCanvases[pn]` entry end up out of sync on alternating
pages. Symptom in the PDF annotator: redlines drawn on page N appeared on page
N+1, "every other page."

**How to apply:** make any one-shot WebView init idempotent. Guard with a flag
(e.g. `pdfInitStarted`) set on first `init` before launching async work; ignore
subsequent `init` messages. Do NOT assume only one of window/document fires.
