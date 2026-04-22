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
  desc: string;
  min: string;
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
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?58\b[^\n]{0,40}\bdeck\b|\bdeck\b[^\n]{0,40}\b(?:item\s*(?:no\.?\s*)?)?58\b/i, item: "58" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?59\b[^\n]{0,40}\bsuper(?:structure)?\b|\bsuper(?:structure)?\b[^\n]{0,40}\b(?:item\s*(?:no\.?\s*)?)?59\b/i, item: "59" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?60\b[^\n]{0,40}\bsub(?:structure)?\b|\bsub(?:structure)?\b[^\n]{0,40}\b(?:item\s*(?:no\.?\s*)?)?60\b/i, item: "60" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?61\b[^\n]{0,40}\bchannel\b|\bchannel\b[^\n]{0,40}\b(?:item\s*(?:no\.?\s*)?)?61\b/i, item: "61" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?65\b|\bapproach(?:es)?\b/i, item: "65" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?36\b[^\n]{0,40}\btraffic\b|\btraffic\s+safety\b/i, item: "36" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?71\b|\bwaterway\b/i, item: "71" },
  { pattern: /\b(?:item\s*(?:no\.?\s*)?)?72\b|\bapproach\s+road(?:way)?\s+align/i, item: "72" },
];

const COMPONENT_TO_ITEMS: Record<string, string[]> = {
  "Deck - Component Rating": ["58"],
  "Wearing Surface": ["58"],
  "Joints, Expansion, Open": ["58"],
  "Joints, Expansion, Sealed": ["58"],
  "Joints, Other": ["58"],
  "Drainage System": ["58"],
  "Curbs, Sidewalk & Parapets": ["58"],
  "Median Barrier": ["58"],
  "Railings": ["58"],
  "Railing Protective Coating": ["58"],
  "Main Members - Steel": ["59"],
  "Main Members - Concrete": ["59"],
  "Main Members - Timber": ["59"],
  "Main Members - Connections": ["59"],
  "Floor System Members": ["59"],
  "Floor System Connections": ["59"],
  "Secondary Members": ["59"],
  "Secondary Mem. Connections": ["59"],
  "Expansion Bearings": ["59"],
  "Fixed Bearings": ["59"],
  "Abutment Caps": ["60"],
  "Above Ground": ["60"],
  "Below Ground or Foundation": ["60"],
  "Backwalls & Wingwalls": ["60"],
  "Caps - Concrete": ["60"],
  "Caps - Steel": ["60"],
  "Caps - Timber": ["60"],
  "Above Ground - Concrete": ["60"],
  "Above Ground - Steel": ["60"],
  "Above Ground - Timber": ["60"],
  "Above Ground - Masonry": ["60"],
  "Below Ground (Int. Supports)": ["60"],
  "Collision Protection System": ["60"],
  "Channel Banks": ["61"],
  "Channel Bed": ["61"],
  "Rip Rap, Toe Walls & Apron": ["61"],
  "Dikes": ["61"],
  "Jetties": ["61"],
  "Embankments": ["65"],
  "Embankment Retaining Walls": ["65"],
  "Slope Protection": ["65"],
  "Roadway": ["65"],
  "Relief Joints": ["65"],
  "Drainage": ["65"],
  "Guardfence": ["65"],
  "Sight Distance": ["65"],
  "Bridge Rails": ["36"],
  "Transitions": ["36"],
  "Approach Rails": ["36"],
  "Approach Rail Ends": ["36"],
  "Waterway Adequacy": ["71"],
  "Approach Roadway Alignment": ["72"],
  // Ambiguous (appear in multiple items) — order = preference
  "Steel Protective Coating": ["59", "60"],
  "Delineation": ["58", "65"],
  "Other": ["58"],
  "Overall Component Rating": ["59", "60", "61", "65"],
};

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

export function normalizeForMatching(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*[-–]\s*/g, " - ")
    .replace(/[.,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const tokA = new Set(a.split(/[\s\-]+/).filter(Boolean));
  const tokB = new Set(b.split(/[\s\-]+/).filter(Boolean));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function nbiSubNameMatchScore(parsedName: string, subName: string): number {
  const normParsed = normalizeForMatching(parsedName);
  const normSub = normalizeForMatching(subName);
  if (normParsed === normSub) return 1;
  return tokenOverlapScore(normParsed, normSub);
}

function normalizeComponentName(raw: string): string {
  const norm = normalizeForMatching(raw);
  for (const [key, canonical] of Object.entries(NBI_COMPONENT_ALIASES)) {
    const normKey = normalizeForMatching(key);
    if (norm === normKey || norm.startsWith(normKey)) return canonical;
  }
  const lower = raw.toLowerCase().trim();
  for (const [key, canonical] of Object.entries(NBI_COMPONENT_ALIASES)) {
    if (lower === key || lower.startsWith(key)) return canonical;
  }
  return raw.trim();
}

function inferItemForComponent(componentName: string, currentItem: string): string {
  const candidates = COMPONENT_TO_ITEMS[componentName];
  if (!candidates || candidates.length === 0) return currentItem;
  if (candidates.length === 1) return candidates[0];
  if (currentItem && candidates.includes(currentItem)) return currentItem;
  return candidates[0];
}

const RATING_LINE_PATTERNS: RegExp[] = [
  // name  [spec…]  min  rating  [comment]
  // spec tokens must start with a non-digit so the min value isn't absorbed
  /^(.+?)\s{2,}((?:[^\d\s\-][^\s]*\s+){0,3})(\d+|-|N)\s+([N\d])(?!\d)\s*(.*)?$/,
  // name  min  rating  [comment]
  /^(.+?)\s{2,}(\d+|-|N)\s+([N\d])(?!\d)\s*(.*)?$/,
  // name  rating  [comment] (no min column)
  /^(.+?)\s{2,}([N\d])(?!\d)\s*(.*)?$/,
];

const STRUCTURAL_LINE_RE = /^\s*(?:\d{1,3}\s*-|page\s*\d|sheet\s*\d|date\s*[:\/]|time\s*[:\/]|inspector|firm|structure\s+id|inspection\s+date|do\s+not\s+disclose|item\s*(?:no\.?\s*)?\d|appendix)/i;

export function parseNbiRatings(pages: string[][]): ParsedNbiEntry[] {
  const results: ParsedNbiEntry[] = [];
  const allLines = pages.flat();
  const debug: string[] = [];

  let currentItem = "";
  const seen = new Set<string>();

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const next = allLines[i + 1] || "";

    for (const { pattern, item } of NBI_SECTION_PATTERNS) {
      if (pattern.test(line) || pattern.test(line + " " + next)) {
        currentItem = item;
        break;
      }
    }

    let matched: { rawName: string; desc: string; min: string; rating: string; comment: string } | null = null;

    const m1 = line.match(RATING_LINE_PATTERNS[0]);
    if (m1) {
      matched = {
        rawName: m1[1].trim(),
        desc: (m1[2] || "").trim(),
        min: m1[3],
        rating: m1[4],
        comment: m1[5]?.trim() || "",
      };
    } else {
      const m2 = line.match(RATING_LINE_PATTERNS[1]);
      if (m2) {
        matched = {
          rawName: m2[1].trim(),
          desc: "",
          min: m2[2],
          rating: m2[3],
          comment: m2[4]?.trim() || "",
        };
      } else {
        const m3 = line.match(RATING_LINE_PATTERNS[2]);
        if (m3) {
          matched = {
            rawName: m3[1].trim(),
            desc: "",
            min: "",
            rating: m3[2],
            comment: m3[3]?.trim() || "",
          };
        }
      }
    }

    if (!matched) continue;

    const { rawName, desc, min, rating, comment } = matched;
    const componentName = normalizeComponentName(rawName);

    if (componentName.length <= 3) continue;
    if (rawName.match(/^\d{4,}/)) continue;
    if (rawName.match(/Structure ID|Inspection Date|DO NOT DISCLOSE|ITEM\s*\d|Page\s*\d|^Date\b|^Time\b/i)) continue;
    if (componentName.toLowerCase().match(/^(yes|no|n\/a|na|none|date|page|sheet)\b/)) continue;

    const item = inferItemForComponent(componentName, currentItem);
    if (!item) continue;

    const key = `${item}|${componentName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Append continuation lines (multi-line comments) until next structural line
    let fullComment = comment;
    let j = i + 1;
    let continued = 0;
    while (j < allLines.length && continued < 10) {
      const cont = allLines[j];
      if (!cont || !cont.trim()) break;
      if (STRUCTURAL_LINE_RE.test(cont)) break;
      if (RATING_LINE_PATTERNS.some((re) => re.test(cont))) break;
      let isSection = false;
      for (const { pattern } of NBI_SECTION_PATTERNS) {
        if (pattern.test(cont)) { isSection = true; break; }
      }
      if (isSection) break;
      fullComment = fullComment ? `${fullComment} ${cont.trim()}` : cont.trim();
      j++;
      continued++;
    }
    i = j - 1;

    debug.push(`[NBI] item=${item} comp="${componentName}" min=${min} rating=${rating} desc="${desc}" comment="${fullComment.slice(0, 100)}"`);
    results.push({ item, componentName, desc, min, rating, comment: fullComment });
  }

  if (typeof console !== "undefined") {
    console.log(`[pdfParser] Parsed ${results.length} NBI entries:`);
    debug.forEach((d) => console.log(d));
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
