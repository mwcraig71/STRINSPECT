import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "/home/runner/workspace/node_modules/.pnpm/pdfjs-dist@4.4.168/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "file://"
).href;

const pdfPath = process.argv[2];
if (!pdfPath) { console.error("Usage: node dump-all-pages.mjs <pdf-path>"); process.exit(1); }

const data = new Uint8Array(readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data }).promise;

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

  console.log(`\n${"=".repeat(60)}`);
  console.log(`PAGE ${pageNum} (${pageLines.length} lines)`);
  console.log("=".repeat(60));
  pageLines.forEach((l, i) => console.log(`  ${String(i).padStart(3)}: ${l}`));
}
