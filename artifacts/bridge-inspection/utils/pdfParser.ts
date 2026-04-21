import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

export interface ParsedElementRow {
  elementId: string;
  elementName: string;
  isDefect: boolean;
  defectCode?: string;
  environment: string;
  totalQty: number;
  unit: string;
  cs1: number;
  cs2: number;
  cs3: number;
  cs4: number;
}

export interface ParsedNbiEntry {
  item: string;
  componentName: string;
  rating: string;
  comment: string;
}

export interface ParsedReport {
  structureNumber: string;
  elements: ParsedElementRow[];
  nbi: ParsedNbiEntry[];
}

type PdfSource = File | { uri: string };

async function loadPdfText(source: PdfSource): Promise<string[][]> {
  let data: ArrayBuffer;
  if (typeof File !== "undefined" && source instanceof File) {
    data = await source.arrayBuffer();
  } else {
    const s = source as { uri: string };
    const response = await fetch(s.uri);
    data = await response.arrayBuffer();
  }

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const allPages: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const rowMap = new Map<number, { x: number; rightEdge: number; text: string }[]>();
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const w = item.width;
      const yKey = Math.round(y / 2) * 2;
      if (!rowMap.has(yKey)) rowMap.set(yKey, []);
      rowMap.get(yKey)!.push({ x, rightEdge: x + w, text: item.str });
    }

    const COLUMN_GAP_PX = 15;
    const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];
    for (const y of sortedYs) {
      const items = rowMap.get(y)!.sort((a, b) => a.x - b.x);
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

export function parseStructureNumber(pages: string[][]): string {
  for (const lines of pages) {
    for (const line of lines) {
      const m = line.match(/Structure\s+Number[:\s]+([0-9][0-9-]{5,})/i);
      if (m) return m[1].replace(/-/g, "");
    }
  }
  return "";
}

const NBI_SECTION_PATTERNS: { pattern: RegExp; item: string }[] = [
  { pattern: /\bDECK\b.*ITEM\s*58|\bITEM\s*58\b.*DECK/i, item: "58" },
  { pattern: /\bSUPERSTRUCTURE\b.*ITEM\s*59|\bITEM\s*59\b.*SUPER/i, item: "59" },
  { pattern: /\bSUBSTRUCTURE\b.*ITEM\s*60|\bITEM\s*60\b.*SUB/i, item: "60" },
  { pattern: /\bCHANNEL\b.*ITEM\s*61|\bITEM\s*61\b.*CHANNEL/i, item: "61" },
  { pattern: /\bAPPROACH(ES)?\b.*ITEM\s*65|\bITEM\s*65\b/i, item: "65" },
  { pattern: /\bTRAFFIC\b.*ITEM\s*36|\bITEM\s*36\b.*TRAFFIC/i, item: "36" },
  { pattern: /\bWATERWAY\b.*ITEM\s*71|\bITEM\s*71\b/i, item: "71" },
  { pattern: /\bAPPROACH\s+ROAD|\bITEM\s*72\b/i, item: "72" },
];

const NBI_COMPONENT_ALIASES: Record<string, string> = {
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

function normalizeComponentName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  for (const [key, canonical] of Object.entries(NBI_COMPONENT_ALIASES)) {
    if (lower.startsWith(key) || lower === key) return canonical;
  }
  return raw.trim();
}

export function parseNbiRatings(pages: string[][]): ParsedNbiEntry[] {
  const results: ParsedNbiEntry[] = [];
  const allLines = pages.flat();

  let currentItem = "";
  let i = 0;

  while (i < allLines.length) {
    const line = allLines[i];
    const next = allLines[i + 1] || "";

    let matched = false;
    for (const { pattern, item } of NBI_SECTION_PATTERNS) {
      if (pattern.test(line) || pattern.test(line + " " + next)) {
        currentItem = item;
        matched = true;
        break;
      }
    }

    if (matched) { i++; continue; }

    if (currentItem) {
      const ratingMatch = line.match(
        /^(.+?)\s{2,}(?:\S+\s+){0,3}(\d+|-)\s+([N\d])\b\s*(.*)?$/
      );
      if (ratingMatch) {
        const rawName = ratingMatch[1].trim();
        const rating = ratingMatch[3];
        const comment = ratingMatch[4]?.trim() || "";
        const componentName = normalizeComponentName(rawName);

        if (
          componentName.length > 3 &&
          !rawName.match(/^\d{4,}/) &&
          !rawName.match(/Structure ID|Inspection Date|DO NOT DISCLOSE|ITEM\s*\d/i)
        ) {
          results.push({ item: currentItem, componentName, rating, comment });
        }
      }
    }

    i++;
  }

  return results;
}

function parseEnvCode(raw: string): string {
  const m = raw.match(/(\d+)\s*[-–]\s*\w+/);
  if (m) return m[1];
  if (/^\d+$/.test(raw.trim())) return raw.trim();
  return "2";
}

function extractTrailingNumbers(parts: string[]): number[] {
  const nums: number[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const n = Number(parts[i]);
    if (!isNaN(n) && /^\d+$/.test(parts[i])) {
      nums.unshift(n);
    } else {
      break;
    }
  }
  return nums;
}

const UNIT_KEYWORDS = ["sq", "ft", "each", "ea", "ln", "in", "m", "m2", "m3"];

export function parseElementsTable(pages: string[][]): ParsedElementRow[] {
  const results: ParsedElementRow[] = [];
  const allLines = pages.flat();

  let inElementsSection = false;
  let headerFound = false;
  let currentElement: ParsedElementRow | null = null;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const upper = line.toUpperCase();

    if (!inElementsSection) {
      if (upper.match(/^\s*ELEMENTS\s*$/) || upper.includes("ELEMENTS\n") || upper === "ELEMENTS") {
        inElementsSection = true;
      }
      continue;
    }

    if (!headerFound) {
      if (upper.includes("ENVIRONMENT") && upper.includes("CONDITION")) {
        headerFound = true;
      }
      continue;
    }

    if (upper.match(/^\s*(PICTURES|PHOTOS|APPENDIX|BRIDGE INSPECTION RECORD)\s*$/)) {
      break;
    }

    const elementMatch = line.match(/^(\d{1,3})-(.+?)(?:\s{2,}(.+?))?(?:\s+(\d[\d.,]*)\s+([\w.\s/]+?))?\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
    const defectMatch = line.match(/^(\d{4,})-(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);

    if (elementMatch) {
      const parts = line.split(/\s+/);
      const nums = extractTrailingNumbers(parts);
      if (nums.length < 4) { i++; continue; }

      const [cs4, cs3, cs2, cs1] = nums.reverse();
      const idMatch = line.match(/^(\d{1,3})-/);
      if (!idMatch) { i++; continue; }

      const elementId = idMatch[1];
      const rest = line.slice(idMatch[0].length);

      let environment = "2";
      const envM = rest.match(/(\d+)\s*[-–]\s*(?:Mod|Ben|Low|Sev|Ext)\w*/i);
      if (envM) environment = envM[1];

      let unit = "";
      const unitM = rest.match(/\b(sq\.?\s*ft\.?|ft\.?|each|ea\.?|ln\.?\s*ft\.?|in\.?)\b/i);
      if (unitM) unit = unitM[1].replace(/\.$/, "").toLowerCase();

      const totalM = rest.match(/(\d[\d,]*)\s+(?:sq|ft|ea)/i);
      const totalQty = totalM ? parseInt(totalM[1].replace(/,/g, "")) : nums.reduce((a, b) => a + b, 0);

      let elementName = rest.replace(/\s+\d+\s*-\s*\w+\.?\s*\d[\d,]*\s*[\w.]+.*$/, "")
        .replace(/\s+\d[\d,]*\s*[\w.]+\s*\d+\s+\d+\s+\d+\s+\d+.*$/, "")
        .trim();
      if (!elementName) elementName = `Element ${elementId}`;

      currentElement = {
        elementId,
        elementName,
        isDefect: false,
        environment,
        totalQty,
        unit,
        cs1: cs1 ?? 0,
        cs2: cs2 ?? 0,
        cs3: cs3 ?? 0,
        cs4: cs4 ?? 0,
      };
      results.push(currentElement);
      continue;
    }

    if (defectMatch) {
      const defectCode = defectMatch[1];
      const defectNameRaw = defectMatch[2].trim();
      const cs1 = parseInt(defectMatch[3]) || 0;
      const cs2 = parseInt(defectMatch[4]) || 0;
      const cs3 = parseInt(defectMatch[5]) || 0;
      const cs4 = parseInt(defectMatch[6]) || 0;

      if (currentElement) {
        results.push({
          elementId: currentElement.elementId,
          elementName: defectNameRaw,
          isDefect: true,
          defectCode,
          environment: currentElement.environment,
          totalQty: cs1 + cs2 + cs3 + cs4,
          unit: currentElement.unit,
          cs1,
          cs2,
          cs3,
          cs4,
        });
      }
      continue;
    }

    const simpleIdMatch = line.match(/^(\d{1,3})-(.+)/) || line.match(/^(\d{4,})-(.+)/);
    if (simpleIdMatch) {
      const combined = line + " " + (allLines[i + 1] || "");
      const allNums = combined.match(/\b\d[\d,]*\b/g);
      if (allNums && allNums.length >= 4) {
        const last4 = allNums.slice(-4).map((n) => parseInt(n.replace(/,/g, "")));
        const id = simpleIdMatch[1];
        const isDefect = id.length >= 4;
        const rawName = simpleIdMatch[2].trim();

        let environment = "2";
        const envM = combined.match(/(\d+)\s*[-–]\s*(?:Mod|Ben|Low|Sev)\w*/i);
        if (envM) environment = envM[1];

        let unit = "";
        const unitM = combined.match(/\b(sq\.?\s*ft\.?|ft\.?|each|ea\.?)\b/i);
        if (unitM) unit = unitM[1].replace(/\.$/, "").toLowerCase();

        if (isDefect && currentElement) {
          results.push({
            elementId: currentElement.elementId,
            elementName: rawName,
            isDefect: true,
            defectCode: id,
            environment: currentElement.environment,
            totalQty: last4.reduce((a, b) => a + b, 0),
            unit: currentElement.unit,
            cs1: last4[0],
            cs2: last4[1],
            cs3: last4[2],
            cs4: last4[3],
          });
        } else {
          currentElement = {
            elementId: id,
            elementName: rawName,
            isDefect: false,
            environment,
            totalQty: last4.reduce((a, b) => a + b, 0),
            unit,
            cs1: last4[0],
            cs2: last4[1],
            cs3: last4[2],
            cs4: last4[3],
          };
          results.push(currentElement);
        }
        if (allNums.length > 4 && allLines[i + 1]?.match(/^\d+\s+\d+\s+\d+\s+\d+/)) {
          i++;
        }
      }
    }
  }

  return results;
}

export async function parseReport(source: PdfSource): Promise<ParsedReport> {
  const pages = await loadPdfText(source);
  const structureNumber = parseStructureNumber(pages);
  const elements = parseElementsTable(pages);
  const nbi = parseNbiRatings(pages);
  return { structureNumber, elements, nbi };
}
