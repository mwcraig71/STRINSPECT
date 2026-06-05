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

// ─── Form 2601 Underclearance parser ─────────────────────────────────────────

const UC_LABEL_PATTERNS_JS = [
  { key: "rightLateral", re: /Right\s+Lateral\s+Clearance/i },
  { key: "leftLateral", re: /Left\s+Lateral\s+Clearance/i },
  { key: "totalHorizontal", re: /Total\s+Horizontal\s+Cl\w*/i },
  { key: "maxPracticalVert", re: /Max(?:imum)?\s+Practical\s+Vert/i },
  { key: "minMeasuredVert", re: /Min(?:imum)?\s+Measured\s+Vert/i },
];

function isUcMeasureLabelLine(line) {
  return UC_LABEL_PATTERNS_JS.some(({ re }) => re.test(line)) || /Signed\s+Vertical\s+Cl/i.test(line);
}

function extractUcDataAfterLabel(labelRe, line) {
  const rest = line.replace(labelRe, "").trim();
  if (!rest || /^(?:Field|Data|Refer\.|Item\s+No\.)/i.test(rest)) return null;
  const parts = rest.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return { data: parts[0], refer: parts[1] || "" };
}

function extractUcDataFromLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^(?:Field|Data|Refer\.|Item\s+No\.|Tolerance)/i.test(trimmed)) return null;
  if (isUcMeasureLabelLine(trimmed) || /^PSN:/i.test(trimmed)) return null;
  const parts = trimmed.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return { data: parts[0], refer: parts[1] || "" };
}

function parseFormHeaderBlockJS(allLines, anchorIdx) {
  let district = "", county = "", controlSection = "", structureNumber = "", route = "", featureCrossed = "", inspectionDate = "";
  const end = Math.min(anchorIdx + 40, allLines.length);
  for (let i = anchorIdx; i < end; i++) {
    const line = allLines[i];
    if (/District:/i.test(line) && /County:/i.test(line)) {
      const routeM = line.match(/Route:\s*(.+)/i);
      if (routeM) route = routeM[1].trim();
      const secSufM = line.match(/Section:.*?-\s*(\d+)\s+Structure/i);
      const sectionSuffix = secSufM ? secSufM[1].trim() : "";
      const vLine = allLines[i + 1] || "";
      const vParts = vLine.trim().split(/\s{2,}/).map(s => s.trim()).filter(s => s && /\d/.test(s));
      if (vParts.length >= 1) district = vParts[0];
      if (vParts.length >= 2) county = vParts[1];
      if (vParts.length >= 3) { const ctrl = vParts[2]; controlSection = sectionSuffix ? `${ctrl}-${sectionSuffix}` : ctrl; }
      if (vParts.length >= 4) structureNumber = vParts[3];
    }
    if (/Feature\s+Crossed:/i.test(line)) {
      const sameRest = line.replace(/Feature\s+Crossed:/i, "").replace(/Inspector['s\s]+Signature:?/i, "").trim();
      if (sameRest) { const parts = sameRest.split(/\s{2,}/).filter(Boolean); if (parts.length >= 1) featureCrossed = parts[0].trim(); }
      if (!featureCrossed) {
        const nextLine = allLines[i + 1] || "";
        const dateM2 = nextLine.match(/Date:\s*(\S+)/i);
        if (dateM2 && !inspectionDate) inspectionDate = dateM2[1];
        const fcParts = nextLine.replace(/Date:.*$/i, "").trim().split(/\s{2,}/).filter(Boolean);
        if (fcParts.length >= 1) featureCrossed = fcParts[0].trim();
      }
    }
    if (!inspectionDate) { const dateM = line.match(/\bDate:\s*(\d[\d\/\-]+)/i); if (dateM) inspectionDate = dateM[1].trim(); }
  }
  return { district, county, controlSection, structureNumber, route, featureCrossed, inspectionDate };
}

function parseUnderclearance(pages) {
  const allLines = pages.flat();
  const anchorIdx = allLines.findIndex(l => /Underclearance Record/i.test(l));
  if (anchorIdx < 0) return null;
  const header = parseFormHeaderBlockJS(allLines, anchorIdx);
  const psnHeaders = [];
  for (let i = anchorIdx; i < allLines.length; i++) {
    if (/^PSN:.*Refer\./i.test(allLines[i])) psnHeaders.push(i);
  }
  const EMPTY = { data: "", refer: "" };
  const entries = [];
  for (let b = 0; b < psnHeaders.length; b++) {
    // Extract PSN value from the header line: "PSN:  <value>  Refer.  ..."
    let psn = "";
    const psnHeaderLine = allLines[psnHeaders[b]];
    const psnM = psnHeaderLine.match(/^PSN:\s+(.+?)\s{2,}Refer\./i);
    if (psnM) {
      const candidate = psnM[1].trim();
      if (candidate && !/^Refer\./i.test(candidate)) psn = candidate;
    }
    // Fallback: check the line two positions before the PSN header
    if (!psn) {
      const prevIdx = psnHeaders[b] - 2;
      if (prevIdx >= 0) {
        const prevLine = allLines[prevIdx].trim();
        if (prevLine && !/^Field\b/i.test(prevLine) && !/^PSN:/i.test(prevLine) && !/^(?:Reference|District|Feature|Signed|Right|Left|Total|Max|Min|Data)\b/i.test(prevLine)) {
          psn = prevLine;
        }
      }
    }

    let blockStart = psnHeaders[b] + 1;
    if (blockStart < allLines.length && /^Data\s+Data/i.test(allLines[blockStart])) blockStart++;
    const blockEnd = b + 1 < psnHeaders.length ? psnHeaders[b + 1] : allLines.length;
    const blockLines = allLines.slice(blockStart, blockEnd);
    const meas = {};
    let signedVertData = "", signedVertTolerance = "";
    for (let li = 0; li < blockLines.length; li++) {
      const bline = blockLines[li];
      if (!bline.trim()) continue;
      if (/Signed\s+Vertical\s+Cl/i.test(bline)) {
        const rest = bline.replace(/Signed\s+Vertical\s+Cl\w*\s*/i, "").trim();
        const tokens = rest.split(/\s+/).filter(s => s && !/^Tolerance$/i.test(s));
        if (tokens.length >= 1) signedVertData = tokens[0];
        if (tokens.length >= 2) signedVertTolerance = tokens[1];
        continue;
      }
      for (const { key, re } of UC_LABEL_PATTERNS_JS) {
        if (re.test(bline)) {
          let m = extractUcDataAfterLabel(re, bline);
          if (!m) {
            const nextLine = blockLines[li + 1] || "";
            if (nextLine.trim() && !isUcMeasureLabelLine(nextLine)) { m = extractUcDataFromLine(nextLine); if (m) li++; }
          }
          if (m) meas[key] = m;
          break;
        }
      }
    }
    const hasData = Object.values(meas).some(m => m.data && m.data !== "-") || (signedVertData !== "" && signedVertData !== "-");
    if (hasData) {
      entries.push({
        psn,
        rightLateral: meas.rightLateral ?? EMPTY,
        leftLateral: meas.leftLateral ?? EMPTY,
        totalHorizontal: meas.totalHorizontal ?? EMPTY,
        maxPracticalVert: meas.maxPracticalVert ?? EMPTY,
        minMeasuredVert: meas.minMeasuredVert ?? EMPTY,
        signedVertData,
        signedVertTolerance,
      });
    }
  }
  return { ...header, entries };
}

function parseChannelCrossSection(pages) {
  const allLines = pages.flat();
  const anchorIdx = allLines.findIndex(l => /Channel\s+Cross[-\s]Section|Form\s+2600/i.test(l));
  if (anchorIdx < 0) return null;
  const header = parseFormHeaderBlockJS(allLines, anchorIdx);
  const upstream = [], downstream = [];
  let currentSection = null, inMeasTable = false;
  for (let i = anchorIdx; i < allLines.length; i++) {
    const line = allLines[i];
    if (/\bUPSTREAM\b/i.test(line) && !/\bDOWNSTREAM\b/i.test(line)) { currentSection = "upstream"; inMeasTable = false; continue; }
    if (/\bDOWNSTREAM\b/i.test(line)) { currentSection = "downstream"; inMeasTable = false; continue; }
    if (!currentSection) continue;
    if (/TOP\s+REF|BOT\.?\s+REF|VERT\.?\s+DIST|TOTAL\s+HORIZ/i.test(line)) { inMeasTable = true; continue; }
    if (!inMeasTable) continue;
    if (/^(?:COMMENTS?|Inspector|Date:|Page\s+\d|DISTRICT)/i.test(line)) break;
    const parts = line.trim().split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    if (/^(?:No\.|Row|Station|Top|Bot|Total|Dist|Vert|Notes)/i.test(parts[0])) continue;
    const offset = /^\d+$/.test(parts[0]) ? 1 : 0;
    const meas = { topRef: parts[offset]||"", botRef: parts[offset+1]||"", totalHoriz: parts[offset+2]||"", distFromLastBent: parts[offset+3]||"", vertDist: parts[offset+4]||"", notes: parts[offset+5]||"" };
    if (meas.totalHoriz || meas.vertDist) { if (currentSection === "upstream") upstream.push(meas); else downstream.push(meas); }
  }
  return { ...header, upstream, downstream };
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

// ─── Form 2601 / Form 2600 tests ─────────────────────────────────────────────

const FORM_PDFS = [
  {
    label: "Form 2601 – Underclearance Record",
    path: resolve(__dirname, "../../../attached_assets/2601_-_Underclearance_1780594111262.pdf"),
    type: "underclearance",
    expected: {
      district: "02",
      county: "220",
      routeContains: "Center Pedestrian Bridge",
      featureCrossed: "FM-157",
      inspectionDate: "4/14/2024",
      minEntries: 1,
      firstEntry: {
        rightLateralData: "6.5'",
        totalHorizontalData: "78.9'",
        signedVertData: "17'10\"",
      },
    },
  },
  {
    label: "Form 2600 – Channel Cross-Section (blank fillable)",
    path: resolve(__dirname, "../../../attached_assets/Channel_Form_Fillable_1780595585246.pdf"),
    type: "channel",
    expectedNull: true,
  },
];

for (const { label, path, type, expected, expectedNull } of FORM_PDFS) {
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

  if (type === "underclearance") {
    const uc = parseUnderclearance(pages);
    console.log(`  parseUnderclearance result: ${uc ? "non-null" : "null"}`);
    assert("parseUnderclearance returns non-null", uc !== null, "Form 2601 not detected");
    if (uc) {
      console.log(`  district="${uc.district}" county="${uc.county}" controlSection="${uc.controlSection}" structureNumber="${uc.structureNumber}"`);
      console.log(`  route="${uc.route}" featureCrossed="${uc.featureCrossed}" inspectionDate="${uc.inspectionDate}"`);
      console.log(`  entries: ${uc.entries.length}`);
      assert(`district = "${expected.district}"`, uc.district === expected.district, `Got: "${uc.district}"`);
      assert(`county = "${expected.county}"`, uc.county === expected.county, `Got: "${uc.county}"`);
      assert(`route contains "${expected.routeContains}"`, uc.route.includes(expected.routeContains), `Got: "${uc.route}"`);
      assert(`featureCrossed = "${expected.featureCrossed}"`, uc.featureCrossed === expected.featureCrossed, `Got: "${uc.featureCrossed}"`);
      assert(`inspectionDate = "${expected.inspectionDate}"`, uc.inspectionDate === expected.inspectionDate, `Got: "${uc.inspectionDate}"`);
      assert(`at least ${expected.minEntries} entry(ies)`, uc.entries.length >= expected.minEntries, `Got: ${uc.entries.length}`);
      if (uc.entries.length >= 1) {
        const e = uc.entries[0];
        console.log(`  First entry: psn="${e.psn}" rightLateral="${e.rightLateral.data}" totalHorizontal="${e.totalHorizontal.data}" signedVert="${e.signedVertData}"`);
        assert("first entry has psn field (string, may be blank if not filled in form)", typeof e.psn === "string", `psn is ${typeof e.psn}`);
        assert(`first entry rightLateral.data = "${expected.firstEntry.rightLateralData}"`, e.rightLateral.data === expected.firstEntry.rightLateralData, `Got: "${e.rightLateral.data}"`);
        assert(`first entry totalHorizontal.data = "${expected.firstEntry.totalHorizontalData}"`, e.totalHorizontal.data === expected.firstEntry.totalHorizontalData, `Got: "${e.totalHorizontal.data}"`);
        assert(`first entry signedVertData = "${expected.firstEntry.signedVertData}"`, e.signedVertData === expected.firstEntry.signedVertData, `Got: "${e.signedVertData}"`);
      }
    }
  } else if (type === "channel") {
    const ch = parseChannelCrossSection(pages);
    console.log(`  parseChannelCrossSection result: ${ch ? "non-null" : "null"}`);
    if (expectedNull) {
      assert("parseChannelCrossSection returns null (blank fillable PDF — expected)", ch === null, `Got non-null result: upstream=${ch?.upstream?.length} downstream=${ch?.downstream?.length}`);
    }
  }
}

// ─── PSN extraction unit test (synthetic) ─────────────────────────────────────
{
  console.log(`\n${"=".repeat(65)}`);
  console.log("Testing: PSN extraction from header line (synthetic)");
  console.log("=".repeat(65));
  const mockPages = [[
    "Underclearance Record",
    "District: County: Control - Section: - 01 Structure #: Route: FM-1234",
    "02  300  1111  099",
    "Feature Crossed:  Inspector's Signature:",
    "Creek  Date: 5/1/2025",
    "",
    "Reference Features:",
    "A. Beam  B. Slab",
    "Feature Xed ",
    "Field  Field  Field  Field",
    "PSN:  CL  Refer.  Item No.  Refer.  Item No.  Refer.  Item No.  Refer.  Item No.",
    "Data  Data  Data  Data",
    "Right Lateral Clearance",
    "10.5'  A-B  10",
    "Left Lateral Clearance",
    "8.0'  A-B  11",
    "Total Horizontal Clr",
    "85.0'",
    "Max Practical Vert Clr",
    "20'0\"",
    "Min Measured Vert Clr  19'6\"  A-N  20",
    "Signed Vertical Clr  19'0\" 1'0\" Tolerance  Tolerance  Tolerance  Tolerance",
  ]];
  const uc = parseUnderclearance(mockPages);
  assert("synthetic: parseUnderclearance returns non-null", uc !== null, "Form not detected");
  if (uc) {
    assert("synthetic: district = '02'", uc.district === "02", `Got: "${uc.district}"`);
    assert("synthetic: at least 1 entry", uc.entries.length >= 1, `Got: ${uc.entries.length}`);
    if (uc.entries.length >= 1) {
      const e = uc.entries[0];
      console.log(`  psn="${e.psn}" rightLateral="${e.rightLateral.data}" totalHoriz="${e.totalHorizontal.data}" signedVert="${e.signedVertData}"`);
      assert("synthetic: PSN extracted = 'CL'", e.psn === "CL", `Got: "${e.psn}"`);
      assert("synthetic: rightLateral.data = '10.5''", e.rightLateral.data === "10.5'", `Got: "${e.rightLateral.data}"`);
      assert("synthetic: totalHorizontal.data = '85.0''", e.totalHorizontal.data === "85.0'", `Got: "${e.totalHorizontal.data}"`);
      assert("synthetic: signedVertData = '19'0\"'", e.signedVertData === "19'0\"", `Got: "${e.signedVertData}"`);
      assert("synthetic: signedVertTolerance = '1'0\"'", e.signedVertTolerance === "1'0\"", `Got: "${e.signedVertTolerance}"`);
    }
  }
}

// ─── Form 2600 populated (synthetic) ──────────────────────────────────────────
{
  console.log(`\n${"=".repeat(65)}`);
  console.log("Testing: Form 2600 Channel Cross-Section (synthetic populated)");
  console.log("=".repeat(65));
  const mockChannelPages = [[
    "Channel Cross-Section",
    "District: County: Control - Section: - 02 Structure #: Route: US-90",
    "03  150  9999-02  042",
    "Feature Crossed:  Inspector's Signature:",
    "Dry Creek  Date: 3/22/2025",
    "",
    "UPSTREAM",
    "TOP REF  BOT REF  TOTAL HORIZ  DIST FROM LAST BENT  VERT DIST  NOTES",
    "CL  BOT  100.5  50.0  12.5",
    "L10  BOT  95.0  45.0  11.0",
    "",
    "DOWNSTREAM",
    "TOP REF  BOT REF  TOTAL HORIZ  DIST FROM LAST BENT  VERT DIST  NOTES",
    "CL  BOT  100.5  50.0  12.3",
    "R5  BOT  90.0  40.0  10.5",
  ]];
  const ch = parseChannelCrossSection(mockChannelPages);
  console.log(`  parseChannelCrossSection result: ${ch ? "non-null" : "null"}`);
  assert("synthetic: parseChannelCrossSection returns non-null", ch !== null, "Channel form not detected");
  if (ch) {
    console.log(`  district="${ch.district}" county="${ch.county}" featureCrossed="${ch.featureCrossed}" date="${ch.inspectionDate}"`);
    console.log(`  upstream=${ch.upstream.length} downstream=${ch.downstream.length}`);
    assert("synthetic: district = '03'", ch.district === "03", `Got: "${ch.district}"`);
    assert("synthetic: county = '150'", ch.county === "150", `Got: "${ch.county}"`);
    assert("synthetic: featureCrossed = 'Dry Creek'", ch.featureCrossed === "Dry Creek", `Got: "${ch.featureCrossed}"`);
    assert("synthetic: inspectionDate = '3/22/2025'", ch.inspectionDate === "3/22/2025", `Got: "${ch.inspectionDate}"`);
    assert("synthetic: upstream has 2 measurements", ch.upstream.length === 2, `Got: ${ch.upstream.length}`);
    assert("synthetic: downstream has 2 measurements", ch.downstream.length === 2, `Got: ${ch.downstream.length}`);
    if (ch.upstream.length >= 1) {
      const u = ch.upstream[0];
      console.log(`  upstream[0]: topRef="${u.topRef}" botRef="${u.botRef}" totalHoriz="${u.totalHoriz}" vertDist="${u.vertDist}"`);
      assert("synthetic: upstream[0].totalHoriz = '100.5'", u.totalHoriz === "100.5", `Got: "${u.totalHoriz}"`);
      assert("synthetic: upstream[0].vertDist = '12.5'", u.vertDist === "12.5", `Got: "${u.vertDist}"`);
    }
    if (ch.downstream.length >= 1) {
      const d = ch.downstream[0];
      console.log(`  downstream[0]: topRef="${d.topRef}" totalHoriz="${d.totalHoriz}" vertDist="${d.vertDist}"`);
      assert("synthetic: downstream[0].totalHoriz = '100.5'", d.totalHoriz === "100.5", `Got: "${d.totalHoriz}"`);
    }
  }
}

// ─── Merge regression: partial existing row must not be overwritten ───────────
{
  console.log(`\n${"=".repeat(65)}`);
  console.log("Testing: underclearance merge – partial row preservation");
  console.log("=".repeat(65));

  // Helper: simulate the merge logic that InspectionContext uses
  function mergeUcEntries(existingEntries, importedEntries) {
    const result = [...existingEntries];
    let importIdx = 0;
    for (let i = 0; i < result.length && importIdx < importedEntries.length; i++) {
      const e = result[i];
      const isEmpty =
        !e.psn &&
        !e.rightLateral?.data && !e.rightLateral?.refer &&
        !e.leftLateral?.data && !e.leftLateral?.refer &&
        !e.totalHorizontal?.data && !e.totalHorizontal?.refer &&
        !e.maxPracticalVert?.data && !e.maxPracticalVert?.refer &&
        !e.minMeasuredVert?.data && !e.minMeasuredVert?.refer &&
        !e.signedVertData && !e.signedVertTolerance;
      if (isEmpty) result[i] = importedEntries[importIdx++];
    }
    while (importIdx < importedEntries.length) result.push(importedEntries[importIdx++]);
    return result;
  }

  function mergeChannelRows(existing, imported) {
    if (imported.length === 0) return existing;
    const result = [...existing];
    let importIdx = 0;
    for (let i = 0; i < result.length && importIdx < imported.length; i++) {
      const m = result[i];
      const isDefaultRef = (m.topRef === "" || m.topRef === "TR") && (m.botRef === "" || m.botRef === "WS");
      const isEmpty = isDefaultRef && !m.totalHoriz && !m.distFromLastBent && !m.vertDist && !m.notes;
      if (isEmpty) result[i] = imported[importIdx++];
    }
    while (importIdx < imported.length) result.push(imported[importIdx++]);
    return result;
  }

  const emptyUcEntry = (override = {}) => ({
    psn: "", rightLateral: { data: "", refer: "" }, leftLateral: { data: "", refer: "" },
    totalHorizontal: { data: "", refer: "" }, maxPracticalVert: { data: "", refer: "" },
    minMeasuredVert: { data: "", refer: "" }, signedVertData: "", signedVertTolerance: "",
    ...override,
  });

  const importedUcEntry = (psn, rightData) => ({
    ...emptyUcEntry({ psn, rightLateral: { data: rightData, refer: "" } }),
    needsVerification: true, isImported: true,
  });

  // Case 0: inspectionDate is overwritten by imported value (even when default was set)
  const mergeHeader = (prevDate, parsedDate) => parsedDate || prevDate;
  assert("UC merge: imported inspectionDate wins over default today-date",
    mergeHeader(new Date().toLocaleDateString("en-US"), "4/14/2024") === "4/14/2024",
    `Got: "${mergeHeader(new Date().toLocaleDateString("en-US"), "4/14/2024")}"`);
  assert("UC merge: existing date kept when no parsed date available",
    mergeHeader("1/1/2024", "") === "1/1/2024",
    `Got: "${mergeHeader("1/1/2024", "")}"`);

  // Case 1: existing entry with only psn set → must NOT be overwritten
  const existing1 = [emptyUcEntry({ psn: "Bent 1" })];
  const imported1 = [importedUcEntry("CL", "10.5'")];
  const result1 = mergeUcEntries(existing1, imported1);
  assert("UC merge: row with only psn is NOT overwritten", result1[0].psn === "Bent 1", `Got psn="${result1[0].psn}"`);
  assert("UC merge: imported entry appended after existing", result1.length === 2, `Got length=${result1.length}`);
  assert("UC merge: imported entry at index 1", result1[1].rightLateral.data === "10.5'", `Got "${result1[1].rightLateral?.data}"`);

  // Case 2: existing entry with only signedVertTolerance set → must NOT be overwritten
  const existing2 = [emptyUcEntry({ signedVertTolerance: "1'0\"" })];
  const imported2 = [importedUcEntry("CL", "8.0'")];
  const result2 = mergeUcEntries(existing2, imported2);
  assert("UC merge: row with only signedVertTolerance is NOT overwritten", result2[0].signedVertTolerance === "1'0\"", `Got "${result2[0].signedVertTolerance}"`);
  assert("UC merge: imported appended (not placed in slot 0)", result2.length === 2, `Got length=${result2.length}`);

  // Case 3: fully empty existing entry → IS replaced with imported
  const existing3 = [emptyUcEntry()];
  const imported3 = [importedUcEntry("CL", "12.0'")];
  const result3 = mergeUcEntries(existing3, imported3);
  assert("UC merge: fully empty row IS replaced with imported", result3[0].rightLateral.data === "12.0'", `Got "${result3[0].rightLateral?.data}"`);
  assert("UC merge: no extra appended when slot was filled", result3.length === 1, `Got length=${result3.length}`);

  console.log(`\n${"=".repeat(65)}`);
  console.log("Testing: channel merge – partial row preservation");
  console.log("=".repeat(65));

  const emptyChRow = (override = {}) => ({ topRef: "", botRef: "", totalHoriz: "", distFromLastBent: "", vertDist: "", notes: "", ...override });
  const importedChRow = (totalHoriz, vertDist) => ({ ...emptyChRow({ totalHoriz, vertDist }), needsVerification: true, isImported: true });

  // Case 4a: default-seeded placeholder row (TR/WS, no measurements) IS replaced
  const existingChDefault = [{ topRef: "TR", botRef: "WS", totalHoriz: "", distFromLastBent: "", vertDist: "", notes: "" }];
  const importedChDefault = [importedChRow("100.0", "12.0")];
  const resultChDefault = mergeChannelRows(existingChDefault, importedChDefault);
  assert("CH merge: default TR/WS placeholder IS replaced with imported", resultChDefault[0].totalHoriz === "100.0", `Got totalHoriz="${resultChDefault[0].totalHoriz}"`);
  assert("CH merge: no extra appended for default row replacement", resultChDefault.length === 1, `Got length=${resultChDefault.length}`);

  // Case 4b: existing row with non-default topRef → must NOT be overwritten
  const existingCh1 = [emptyChRow({ topRef: "CL" })];
  const importedCh1 = [importedChRow("100.0", "12.0")];
  const resultCh1 = mergeChannelRows(existingCh1, importedCh1);
  assert("CH merge: row with non-default topRef is NOT overwritten", resultCh1[0].topRef === "CL", `Got topRef="${resultCh1[0].topRef}"`);
  assert("CH merge: imported appended after existing", resultCh1.length === 2, `Got length=${resultCh1.length}`);

  // Case 5: existing row with only notes → must NOT be overwritten
  const existingCh2 = [emptyChRow({ notes: "scour observed" })];
  const importedCh2 = [importedChRow("90.0", "11.0")];
  const resultCh2 = mergeChannelRows(existingCh2, importedCh2);
  assert("CH merge: row with only notes is NOT overwritten", resultCh2[0].notes === "scour observed", `Got notes="${resultCh2[0].notes}"`);
  assert("CH merge: imported appended", resultCh2.length === 2, `Got length=${resultCh2.length}`);

  // Case 6: fully empty channel row IS replaced
  const existingCh3 = [emptyChRow()];
  const importedCh3 = [importedChRow("88.5", "9.5")];
  const resultCh3 = mergeChannelRows(existingCh3, importedCh3);
  assert("CH merge: fully empty row IS replaced with imported", resultCh3[0].totalHoriz === "88.5", `Got totalHoriz="${resultCh3[0].totalHoriz}"`);
  assert("CH merge: no extra appended", resultCh3.length === 1, `Got length=${resultCh3.length}`);
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
