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

const pdfjs = readFileSync(pdfjsPath, 'utf8');
const out = `// AUTO-GENERATED — DO NOT EDIT
// Regenerate: node artifacts/bridge-inspection/scripts/embed-pdfjs.mjs
/* eslint-disable */
// @ts-nocheck
export const PDFJS_INLINE_SCRIPT: string = ${JSON.stringify(pdfjs)};
`;
const outPath = resolve(__dirname, '../components/pdfAnnotatorPdfjsBundled.ts');
writeFileSync(outPath, out);
console.log('PDF.js embedded (' + Math.round(pdfjs.length / 1024) + ' KB) → components/pdfAnnotatorPdfjsBundled.ts');
