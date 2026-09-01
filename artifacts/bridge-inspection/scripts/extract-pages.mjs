#!/usr/bin/env node
// Extract the per-page text lines from an inspection-report PDF using the SAME
// row/column reconstruction as the app (utils/pdfParser.ts loadPdfTextWeb and
// components/pdfExtractorHtml.ts). Use it to (re)generate parser fixtures:
//
//   node scripts/extract-pages.mjs <report.pdf> [out.json]
//
// If the reconstruction recipe in the app changes, regenerate every fixture in
// utils/__fixtures__ and review the parser test diffs.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjsLib = await import(
  path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "legacy/build/pdf.mjs")
);

const [, , input, output] = process.argv;
if (!input) {
  console.error("usage: node scripts/extract-pages.mjs <report.pdf> [out.json]");
  process.exit(1);
}

// Keep this block byte-for-byte equivalent to loadPdfTextWeb / pdfExtractorHtml.
export async function extractPages(data) {
  const pdf = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const allPages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rowMap = new Map();
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const w = item.width;
      const yKey = Math.round(y / 2) * 2;
      if (!rowMap.has(yKey)) rowMap.set(yKey, []);
      rowMap.get(yKey).push({ x, rightEdge: x + w, text: item.str });
    }
    const COLUMN_GAP_PX = 15;
    const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
    const pageLines = [];
    for (const y of sortedYs) {
      const items = rowMap.get(y).sort((a, b) => a.x - b.x);
      let line = "";
      let prevRightEdge = -1;
      for (const item of items) {
        if (prevRightEdge < 0) {
          line = item.text;
        } else {
          const gap = item.x - prevRightEdge;
          line += (gap > COLUMN_GAP_PX ? "  " : " ") + item.text;
        }
        prevRightEdge = item.rightEdge;
      }
      line = line.trim();
      if (line) pageLines.push(line);
    }
    allPages.push(pageLines);
  }
  return allPages;
}

const pages = await extractPages(new Uint8Array(fs.readFileSync(input)));
const out = output ?? path.join("utils", "__fixtures__", path.basename(input, ".pdf") + ".pages.json");
fs.writeFileSync(out, JSON.stringify(pages, null, 1) + "\n");
console.log(`${pages.length} pages, ${pages.flat().length} lines -> ${out}`);
