import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve a pdfjs-dist build file from the workspace node_modules.
function resolvePdfjs(relFile) {
  const tries = [
    resolve(__dirname, '../../../node_modules/pdfjs-dist/build/' + relFile),
    resolve(__dirname, '../node_modules/pdfjs-dist/build/' + relFile),
  ];
  for (const c of tries) {
    try { readFileSync(c); return c; } catch {}
  }
  throw new Error('pdfjs-dist build file not found: ' + relFile);
}

// pdfjs-dist ships ESM builds (pdf.min.mjs / pdf.worker.min.mjs). Each assigns
// its API to a global (globalThis.pdfjsLib / globalThis.pdfjsWorker) AND ends
// with a top-level `export{...}` statement. We embed them in classic <script>
// tags (WKWebView silently drops module scripts loaded via source={{ html }}),
// where a top-level `export{}` is a syntax error that discards the ENTIRE
// script — leaving the global unset. The global assignment already exposes the
// full API, so strip the export. The trailing-comment allowance
// (\/\/...|\/*...*\/) tolerates a sourceMappingURL/license comment some builds
// append after the export statement.
function stripEsmExport(src, requiredGlobal) {
  const before = src.length;
  const out = src.replace(/export\s*\{[^}]*\}\s*;?\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*$/, '');
  if (out.length === before) {
    throw new Error('Expected a trailing ESM export statement to strip but found none');
  }
  // Postcondition guards: this embed strategy depends entirely on the bundle
  // exposing its API on the global object and no top-level export surviving.
  // Fail loudly during regeneration if a future pdfjs build changes either,
  // rather than silently shipping a bundle that breaks at runtime in WKWebView.
  if (!out.includes(requiredGlobal)) {
    throw new Error('Bundle no longer assigns ' + requiredGlobal + ' — embed strategy needs review');
  }
  if (/(^|[^.\w])export\s*[{*]/.test(out)) {
    throw new Error('A top-level ESM export still remains in the bundle after strip');
  }
  return out;
}

const pdfjs = stripEsmExport(readFileSync(resolvePdfjs('pdf.min.mjs'), 'utf8'), 'globalThis.pdfjsLib');
// The worker module self-registers globalThis.pdfjsWorker.WorkerMessageHandler.
// Running it in the WebView's main thread lets pdf.js use its in-thread "fake
// worker" (workerSrc = ''), exactly like the native parser in utils/pdfParser.ts
// — no separate worker file and no WKWebView Web Worker spawning required.
const pdfjsWorker = stripEsmExport(readFileSync(resolvePdfjs('pdf.worker.min.mjs'), 'utf8'), 'globalThis.pdfjsWorker');

const out = `// AUTO-GENERATED — DO NOT EDIT
// Regenerate: node artifacts/bridge-inspection/scripts/embed-pdfjs.mjs
/* eslint-disable */
// @ts-nocheck
export const PDFJS_INLINE_SCRIPT: string = ${JSON.stringify(pdfjs)};
export const PDFJS_WORKER_INLINE_SCRIPT: string = ${JSON.stringify(pdfjsWorker)};
`;
const outPath = resolve(__dirname, '../components/pdfAnnotatorPdfjsBundled.ts');
writeFileSync(outPath, out);
console.log(
  'PDF.js embedded (lib ' + Math.round(pdfjs.length / 1024) + ' KB, worker ' +
  Math.round(pdfjsWorker.length / 1024) + ' KB) → components/pdfAnnotatorPdfjsBundled.ts'
);
