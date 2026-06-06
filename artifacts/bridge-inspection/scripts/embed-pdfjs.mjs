import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve pdfjs-dist from the workspace node_modules
const candidates = [
  resolve(__dirname, '../../../node_modules/pdfjs-dist/build/pdf.min.mjs'),
  resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.min.mjs'),
];
let pdfjsPath = null;
for (const c of candidates) {
  try { readFileSync(c); pdfjsPath = c; break; } catch {}
}
if (!pdfjsPath) throw new Error('pdfjs-dist not found');

let pdfjs = readFileSync(pdfjsPath, 'utf8');

// pdfjs-dist ships the ESM build (pdf.min.mjs). It assigns everything to
// `globalThis.pdfjsLib` AND ends with a top-level `export{...}` statement.
// We embed it in a classic <script> (WKWebView silently drops module scripts
// loaded via source={{ html }}), where a top-level `export{}` is a syntax
// error that discards the ENTIRE script — leaving globalThis.pdfjsLib unset.
// The global assignment already exposes the full API, so strip the export.
// The trailing-comment allowance (\/\/...|\/*...*\/) tolerates a sourceMappingURL
// or license comment that some builds append after the export statement.
const before = pdfjs.length;
pdfjs = pdfjs.replace(/export\s*\{[^}]*\}\s*;?\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*$/, '');
if (pdfjs.length === before) {
  throw new Error('Expected a trailing ESM export statement to strip but found none');
}

// Postcondition guards: this embed strategy depends entirely on the bundle
// exposing its API on the global object and no top-level export surviving.
// Fail loudly during regeneration if a future pdfjs build changes either,
// rather than silently shipping a bundle that breaks at runtime in WKWebView.
if (!pdfjs.includes('globalThis.pdfjsLib')) {
  throw new Error('Bundle no longer assigns globalThis.pdfjsLib — embed strategy needs review');
}
if (/(^|[^.\w])export\s*[{*]/.test(pdfjs)) {
  throw new Error('A top-level ESM export still remains in the bundle after strip');
}

const out = `// AUTO-GENERATED — DO NOT EDIT
// Regenerate: node artifacts/bridge-inspection/scripts/embed-pdfjs.mjs
/* eslint-disable */
// @ts-nocheck
export const PDFJS_INLINE_SCRIPT: string = ${JSON.stringify(pdfjs)};
`;
const outPath = resolve(__dirname, '../components/pdfAnnotatorPdfjsBundled.ts');
writeFileSync(outPath, out);
console.log('PDF.js embedded (' + Math.round(pdfjs.length / 1024) + ' KB) → components/pdfAnnotatorPdfjsBundled.ts');
