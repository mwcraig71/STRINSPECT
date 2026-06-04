import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "/home/runner/workspace/node_modules/.pnpm/pdfjs-dist@4.4.168/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "file://"
).href;

const PDFS = [
  {
    label: "18-061-0081-13-133",
    path: resolve(__dirname, "../../../attached_assets/18-061-0081-13-133_RTInsp_2025-02_1776775977835.pdf"),
  },
  {
    label: "18-057-0261-03-105",
    path: resolve(__dirname, "../../../attached_assets/18-057-0261-03-105_RTInsp_2024-01_1776782452768.pdf"),
  },
];

async function loadPdfPages(filePath) {
  const data = new Uint8Array(readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;
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
    allPages.push({ pageNum, lines: pageLines });
  }
  return allPages;
}

for (const { label, path } of PDFS) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`PDF: ${label}`);
  console.log("=".repeat(70));

  const pages = await loadPdfPages(path);
  
  for (const { pageNum, lines } of pages) {
    const hasElements = lines.some(l => l.toUpperCase().includes("ELEMENT"));
    const hasNbi = lines.some(l => /ITEM\s*[56][0-9]|DECK|SUPERSTRUCTURE|SUBSTRUCTURE/i.test(l));
    if (hasElements || hasNbi) {
      console.log(`\n--- PAGE ${pageNum} (${lines.length} lines) [hasElements=${hasElements}, hasNBI=${hasNbi}] ---`);
      lines.forEach((l, i) => console.log(`  ${String(i).padStart(3)}: ${l}`));
    }
  }
}
