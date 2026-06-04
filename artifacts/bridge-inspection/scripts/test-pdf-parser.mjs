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
    label: "18-061-0081-13-133 (2025-02)",
    path: resolve(__dirname, "../../../attached_assets/18-061-0081-13-133_RTInsp_2025-02_1776775977835.pdf"),
    expectedElements: [
      { id: "12", name: /Reinforced Concrete Deck/i },
      { id: "109", name: /Prestressed Concrete/i },
      { id: "205", name: /Reinforced Concrete Column/i },
      { id: "215", name: /Reinforced Concrete.*Abutment/i },
      { id: "234", name: /Reinforced Concrete Pier Cap/i },
      { id: "310", name: /Elastomeric Bearing/i },
      { id: "331", name: /Reinforced Concrete Bridge.*Railing|Railing/i },
    ],
    expectedNbi: [
      { item: "58", name: /Deck.*Component|Component.*Rating/i },
      { item: "58", name: /Wearing Surface/i },
      { item: "59", name: /Main Members.*Concrete|Concrete.*Main/i },
      { item: "60", name: /Abutment Cap/i },
      { item: "65", name: /Embankment/i },
    ],
  },
  {
    label: "18-057-0261-03-105 (2024-01)",
    path: resolve(__dirname, "../../../attached_assets/18-057-0261-03-105_RTInsp_2024-01_1776782452768.pdf"),
    expectedElements: [
      { id: "12", name: /Reinforced Concrete Deck/i },
      { id: "107", name: /Steel.*Girder|Open Girder/i },
      { id: "205", name: /Reinforced Concrete Column/i },
      { id: "215", name: /Reinforced Concrete.*Abutment/i },
      { id: "234", name: /Reinforced Concrete Pier Cap/i },
      { id: "330", name: /Metal.*Railing|Bridge Railing/i },
    ],
    expectedNbi: [
      { item: "58", name: /Deck.*Component|Component.*Rating/i },
      { item: "59", name: /Main Members/i },
      { item: "60", name: /Abutment|Column|Cap/i },
      { item: "65", name: /Embankment/i },
    ],
  },
];

async function loadPdfText(filePath) {
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
    allPages.push(pageLines);
  }
  return allPages;
}

function parseStructureNumber(pages) {
  for (const lines of pages) {
    for (const line of lines) {
      const m = line.match(/Structure\s+Number[:\s]+([0-9][0-9-]{5,})/i);
      if (m) return m[1].replace(/-/g, "");
    }
  }
  return "";
}

const NBI_SECTION_PATTERNS = [
  { pattern: /\bDECK\b.*ITEM\s*58|\bITEM\s*58\b/i, item: "58" },
  { pattern: /\bSUPERSTRUCTURE\b.*ITEM\s*59|\bITEM\s*59\b/i, item: "59" },
  { pattern: /\bSUBSTRUCTURE\b.*ITEM\s*60|\bITEM\s*60\b/i, item: "60" },
  { pattern: /\bCHANNEL\b.*ITEM\s*61|\bITEM\s*61\b/i, item: "61" },
  { pattern: /\bAPPROACH(ES)?\b.*ITEM\s*65|\bITEM\s*65\b/i, item: "65" },
  { pattern: /\bTRAFFIC\b.*ITEM\s*36|\bITEM\s*36\b/i, item: "36" },
  { pattern: /\bWATERWAY\b.*ITEM\s*71|\bITEM\s*71\b/i, item: "71" },
  { pattern: /\bAPPROACH\s+ROAD(?:WAY)?\s+ALIGN|\bITEM\s*72\b/i, item: "72" },
];

const NBI_COMPONENT_ALIASES = {
  "deck component rating": "Deck - Component Rating",
  "deck - component rating": "Deck - Component Rating",
  "wearing surface": "Wearing Surface",
  "joints, expansion, open": "Joints, Expansion, Open",
  "joints expansion open": "Joints, Expansion, Open",
  "joints, expansion, sealed": "Joints, Expansion, Sealed",
  "joints expansion sealed": "Joints, Expansion, Sealed",
  "joints, other": "Joints, Other",
  "joints other": "Joints, Other",
  "drainage system": "Drainage System",
  "curbs, sidewalk": "Curbs, Sidewalk & Parapets",
  "curbs sidewalk": "Curbs, Sidewalk & Parapets",
  "median barrier": "Median Barrier",
  "railings": "Railings",
  "railing protective coating": "Railing Protective Coating",
  "delineation": "Delineation",
  "main members - steel": "Main Members - Steel",
  "main members steel": "Main Members - Steel",
  "main members - concrete": "Main Members - Concrete",
  "main members concrete": "Main Members - Concrete",
  "main members - timber": "Main Members - Timber",
  "main members timber": "Main Members - Timber",
  "main members - connections": "Main Members - Connections",
  "main members connections": "Main Members - Connections",
  "floor system members": "Floor System Members",
  "floor system connections": "Floor System Connections",
  "secondary members": "Secondary Members",
  "secondary mem. connections": "Secondary Mem. Connections",
  "secondary mem connections": "Secondary Mem. Connections",
  "expansion bearings": "Expansion Bearings",
  "fixed bearings": "Fixed Bearings",
  "steel protective coating": "Steel Protective Coating",
  "overall component rating": "Overall Component Rating",
  "abutment caps": "Abutment Caps",
  "above ground": "Above Ground",
  "below ground or foundation": "Below Ground or Foundation",
  "below ground": "Below Ground or Foundation",
  "backwalls": "Backwalls & Wingwalls",
  "backwalls & wingwalls": "Backwalls & Wingwalls",
  "caps - concrete": "Caps - Concrete",
  "caps - steel": "Caps - Steel",
  "caps - timber": "Caps - Timber",
  "above ground - concrete": "Above Ground - Concrete",
  "above ground - steel": "Above Ground - Steel",
  "above ground - timber": "Above Ground - Timber",
  "above ground - masonry": "Above Ground - Masonry",
  "below ground (int. supports)": "Below Ground (Int. Supports)",
  "collision protection": "Collision Protection System",
  "channel banks": "Channel Banks",
  "channel bed": "Channel Bed",
  "rip rap": "Rip Rap, Toe Walls & Apron",
  "embankments": "Embankments",
  "embankment retaining": "Embankment Retaining Walls",
  "slope protection": "Slope Protection",
  "roadway": "Roadway",
  "relief joints": "Relief Joints",
  "drainage": "Drainage",
  "guardfence": "Guardfence",
  "sight distance": "Sight Distance",
  "bridge rails": "Bridge Rails",
  "transitions": "Transitions",
  "approach rails": "Approach Rails",
  "approach rail ends": "Approach Rail Ends",
  "waterway adequacy": "Waterway Adequacy",
  "approach roadway alignment": "Approach Roadway Alignment",
};

function normalizeForMatching(s) {
  return s.toLowerCase().replace(/\s*[-–]\s*/g, " - ").replace(/[.,;:]+$/, "").replace(/\s+/g, " ").trim();
}

function normalizeComponentName(raw) {
  const norm = normalizeForMatching(raw);
  for (const [key, canonical] of Object.entries(NBI_COMPONENT_ALIASES)) {
    if (norm === normalizeForMatching(key)) return canonical;
  }
  const sortedKeys = Object.keys(NBI_COMPONENT_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const normKey = normalizeForMatching(key);
    if (norm.startsWith(normKey)) return NBI_COMPONENT_ALIASES[key];
  }
  return raw.trim();
}

function isElementTableHeader(lines, i) {
  const block = [lines[i] || "", lines[i + 1] || "", lines[i + 2] || ""].join(" ").toUpperCase();
  return block.includes("ENVIRONMENT") && (block.includes("STATE 1") || block.includes("CONDITION STATE") || block.includes("QUANTITY"));
}

function parseNbiRatings(pages) {
  const results = [];
  const allLines = pages.flat();
  let currentItem = "";
  let i = 0;
  while (i < allLines.length) {
    const line = allLines[i];
    if (isElementTableHeader(allLines, i)) break;

    const next = allLines[i + 1] || "";
    const next2 = allLines[i + 2] || "";
    const block3 = line + " " + next + " " + next2;

    let matched = false;
    for (const { pattern, item } of NBI_SECTION_PATTERNS) {
      if (pattern.test(line) || pattern.test(block3)) {
        currentItem = item;
        matched = true;
        break;
      }
    }
    if (matched) { i++; continue; }

    if (currentItem) {
      const ratingMatch = line.match(/^(.+?)\s{2,}(?:\S+\s+){0,3}(\d+|-)\s+([N\d])\b\s*(.*)?$/);
      if (ratingMatch) {
        const rawName = ratingMatch[1].trim();
        const rating = ratingMatch[3];
        const comment = ratingMatch[4]?.trim() || "";
        const componentName = normalizeComponentName(rawName);
        if (
          componentName.length > 3 &&
          !rawName.match(/^\d{1,3}-/) &&
          !rawName.match(/^\d{4,}/) &&
          !rawName.match(/Structure ID|Inspection Date|DO NOT DISCLOSE|ITEM\s*\d/i) &&
          !rawName.match(/^\d[\d,]*\s+(?:sq|ft|each|ea)/i)
        ) {
          results.push({ item: currentItem, componentName, rating, comment });
        }
      }
    }
    i++;
  }
  return results;
}

function extractTrailingFourNumbers(line) {
  const parts = line.trim().split(/\s+/);
  const nums = [];
  for (let j = parts.length - 1; j >= 0 && nums.length < 4; j--) {
    if (/^\d+$/.test(parts[j])) {
      nums.unshift(parseInt(parts[j]));
    } else {
      break;
    }
  }
  if (nums.length < 4) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

function parseDataLine(line) {
  const cs = extractTrailingFourNumbers(line);
  if (!cs) return null;
  const envM = line.match(/(\d+)\s*[-–]\s*(?:Mod|Ben|Low|Sev|Ext)\w*/i);
  const env = envM ? envM[1] : "2";
  const unitM = line.match(/\b(sq\.?\s*ft\.?|ft\.?|each|ea\.?|ln\.?\s*ft\.?)\b/i);
  const unit = unitM ? unitM[1].replace(/\.$/, "").toLowerCase() : "";
  const qtyM = line.match(/(\d[\d,]*)\s+(?:sq|ft|each|ea)/i);
  const qty = qtyM ? parseInt(qtyM[1].replace(/,/g, "")) : cs.reduce((a, b) => a + b, 0);
  return { env, qty, unit, cs };
}

function isNumbersOrDataLine(line) {
  if (/^\d{1,3}-/.test(line.trim()) || /^\d{4,}-/.test(line.trim())) return false;
  return extractTrailingFourNumbers(line) !== null;
}

function isIdLine(line) {
  return /^\d{1,3}-/.test(line.trim()) || /^\d{4,}-/.test(line.trim());
}

function stripDataFromName(name) {
  return name
    .replace(/\s+\d+\s*[-–]\s*\w+\.?\s*\d[\d,]*\s*[\w./]+.*$/, "")
    .replace(/\s+\d[\d,]*\s*[\w./]+\s*\d+\s+\d+\s+\d+\s+\d+.*$/, "")
    .replace(/\s+\d+\s+\d+\s+\d+\s+\d+\s*$/, "")
    .trim();
}

const SECTION_END_PATTERN = /^\s*(PICTURES|PHOTOS|APPENDIX|BRIDGE INSPECTION RECORD|Bridge Inspection Report|Inspector:|Inspection Date:)\s*/i;

function parseElementsTable(pages) {
  const results = [];
  const allLines = pages.flat();

  let startIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (isElementTableHeader(allLines, i)) {
      startIdx = i + 3;
      break;
    }
  }
  if (startIdx < 0) return [];

  let currentElement = null;
  let pendingData = null;

  for (let i = startIdx; i < allLines.length; i++) {
    const line = allLines[i];
    if (SECTION_END_PATTERN.test(line)) break;

    if (isNumbersOrDataLine(line)) {
      pendingData = parseDataLine(line);
      continue;
    }

    const idMatch = line.match(/^(\d{1,4})-(.+)/);
    if (!idMatch) {
      pendingData = null;
      continue;
    }

    const id = idMatch[1];
    const isDefect = id.length >= 4;
    const restOfLine = idMatch[2];

    let data = parseDataLine(line);
    let nameText = restOfLine;

    if (data) {
      nameText = stripDataFromName(restOfLine);
      pendingData = null;
    } else if (pendingData) {
      data = pendingData;
      nameText = restOfLine.trim();
      pendingData = null;
    } else {
      const nextLine = allLines[i + 1] || "";
      const nextData = parseDataLine(nextLine);
      if (nextData) {
        data = nextData;
        const lineAfter = allLines[i + 2] || "";
        if (
          lineAfter.trim() &&
          !isIdLine(lineAfter) &&
          !isNumbersOrDataLine(lineAfter) &&
          !SECTION_END_PATTERN.test(lineAfter) &&
          !/^\d/.test(lineAfter.trim())
        ) {
          nameText = (restOfLine + " " + lineAfter).trim();
          i += 2;
        } else {
          nameText = restOfLine.trim();
          i += 1;
        }
        pendingData = null;
      }
    }

    if (!data) continue;
    const [cs1, cs2, cs3, cs4] = data.cs;

    if (isDefect) {
      if (!currentElement) continue;
      const defectName = nameText.replace(/(\s+\d+)+\s*$/, "").trim();
      results.push({
        elementId: currentElement.elementId,
        elementName: defectName,
        isDefect: true,
        defectCode: id,
        environment: currentElement.environment,
        totalQty: cs1 + cs2 + cs3 + cs4,
        unit: currentElement.unit,
        cs1, cs2, cs3, cs4,
      });
    } else {
      const elementName = nameText || `Element ${id}`;
      currentElement = {
        elementId: id,
        elementName,
        isDefect: false,
        environment: data.env,
        totalQty: data.qty || cs1 + cs2 + cs3 + cs4,
        unit: data.unit,
        cs1, cs2, cs3, cs4,
      };
      results.push(currentElement);
    }
  }
  return results;
}

let totalPassed = 0;
let totalFailed = 0;
const issues = [];

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    totalPassed++;
  } else {
    console.log(`  ✗ FAIL: ${label}${detail ? " — " + detail : ""}`);
    totalFailed++;
    issues.push(`${label}${detail ? ": " + detail : ""}`);
  }
}

for (const { label, path, expectedElements, expectedNbi } of PDFS) {
  console.log(`\n${"=".repeat(65)}`);
  console.log(`Testing: ${label}`);
  console.log("=".repeat(65));

  let pages;
  try {
    pages = await loadPdfText(path);
    console.log(`  Loaded ${pages.length} pages`);
  } catch (e) {
    console.error(`  ERROR loading PDF: ${e.message}`);
    totalFailed++;
    issues.push(`Could not load ${label}: ${e.message}`);
    continue;
  }

  console.log("\n  [Structure Number]");
  const structNum = parseStructureNumber(pages);
  console.log(`  Parsed: "${structNum}"`);
  assert("Structure number is non-empty", structNum.length > 0);
  assert("Structure number is numeric digits only", /^\d+$/.test(structNum), `Got: "${structNum}"`);
  assert("Structure number length is 14-16 chars", structNum.length >= 14 && structNum.length <= 16, `Got length ${structNum.length}: "${structNum}"`);

  console.log("\n  [Elements Table]");
  const elements = parseElementsTable(pages);
  const parentElements = elements.filter((e) => !e.isDefect);
  const defectRows = elements.filter((e) => e.isDefect);
  console.log(`  Found ${elements.length} total rows (${parentElements.length} elements, ${defectRows.length} defects)`);

  assert("At least 5 parent elements found", parentElements.length >= 5, `Found: ${parentElements.length}`);
  assert("At least 1 defect row found", defectRows.length >= 1, `Found: ${defectRows.length}`);
  assert("All parent elements have numeric elementId", parentElements.every((e) => /^\d+$/.test(e.elementId)));
  assert("All parent elements have non-empty elementName", parentElements.every((e) => e.elementName.length > 0));
  assert("All parent elements have environment set (1 digit)", parentElements.every((e) => /^\d$/.test(e.environment)));
  assert("All CS values are non-negative", elements.every((e) => e.cs1 >= 0 && e.cs2 >= 0 && e.cs3 >= 0 && e.cs4 >= 0));
  assert("No element names are just a number", elements.every((e) => !/^\d+$/.test(e.elementName.trim())));

  console.log("\n  Element rows:");
  for (const el of parentElements) {
    console.log(`    [${el.elementId}] "${el.elementName}" env=${el.environment} total=${el.totalQty} ${el.unit} cs=(${el.cs1},${el.cs2},${el.cs3},${el.cs4})`);
  }
  console.log("\n  Defect rows (first 10):");
  for (const d of defectRows.slice(0, 10)) {
    console.log(`    [defect ${d.defectCode}→parent ${d.elementId}] "${d.elementName}" cs=(${d.cs1},${d.cs2},${d.cs3},${d.cs4})`);
  }

  for (const exp of expectedElements) {
    const found = parentElements.find((e) => e.elementId === exp.id && exp.name.test(e.elementName));
    assert(`Element ${exp.id} found with expected name`, !!found, `Looking for ${exp.name}, got: ${parentElements.find(e=>e.elementId===exp.id)?.elementName || "NOT FOUND"}`);
  }

  const deckEl = parentElements.find((e) => e.elementId === "12");
  if (deckEl) {
    assert("Deck element has total quantity > 1000 sq ft", deckEl.totalQty > 1000, `Got: ${deckEl.totalQty}`);
    assert("Deck CS1 is largest CS value (best condition)", deckEl.cs1 >= deckEl.cs2, `cs1=${deckEl.cs1}, cs2=${deckEl.cs2}`);
  }

  console.log("\n  [NBI Ratings]");
  const nbi = parseNbiRatings(pages);
  console.log(`  Found ${nbi.length} NBI entries`);
  console.log("\n  NBI entries:");
  for (const n of nbi) {
    console.log(`    Item ${n.item}: "${n.componentName}" = ${n.rating}${n.comment ? ` [${n.comment.slice(0, 50)}]` : ""}`);
  }

  assert("At least 10 NBI entries found", nbi.length >= 10, `Found: ${nbi.length}`);
  const itemsFound = new Set(nbi.map((n) => n.item));
  assert("Items 58, 59, 60 are all present", ["58", "59", "60"].every((i) => itemsFound.has(i)), `Found items: ${[...itemsFound].join(", ")}`);
  assert("Item 65 (approaches) is present", itemsFound.has("65"));
  assert("All NBI ratings are valid (single 0-9 or N)", nbi.every((n) => /^[0-9N]$/.test(n.rating)), nbi.filter((n) => !/^[0-9N]$/.test(n.rating)).map((n) => `"${n.componentName}"=${n.rating}`).join(", "));
  assert("No element rows leaked into NBI (no NN-Name pattern)", nbi.every((n) => !/^\d{1,3}-/.test(n.componentName)));
  assert("No element rows leaked into NBI (no sq.ft patterns)", nbi.every((n) => !/sq\.\s*ft|[\d,]+\s+sq/i.test(n.componentName)));

  for (const exp of expectedNbi) {
    const found = nbi.find((n) => n.item === exp.item && exp.name.test(n.componentName));
    assert(`NBI Item ${exp.item} has entry matching ${exp.name}`, !!found, `Not found. Available for item ${exp.item}: ${nbi.filter(n=>n.item===exp.item).map(n=>n.componentName).join(", ")}`);
  }
}

console.log("\n" + "=".repeat(65));
console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
if (issues.length > 0) {
  console.log("\nFailed checks:");
  for (const issue of issues) {
    console.log(`  - ${issue}`);
  }
}
console.log("=".repeat(65));
process.exit(totalFailed > 0 ? 1 : 0);
