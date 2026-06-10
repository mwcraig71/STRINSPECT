import { Platform } from "react-native";
import { extractPdfTextNative } from "../components/pdfExtractorBridge";

// PDF text extraction runs in a real browser, never in Hermes.
//   - Web (Expo web): pdf.js runs directly in the browser (loadPdfTextWeb).
//   - Native (Android/iOS): pdf.js runs inside a headless WebView, driven via
//     the extractor bridge (loadPdfTextNative). Hermes is not a browser and
//     cannot run pdf.js reliably, so there is no native pdf.js path here.
type PdfjsModule = typeof import("pdfjs-dist");
let webPdfjsPromise: Promise<PdfjsModule> | null = null;

// Lazily load pdf.js on web only. Importing it is gated behind Platform.OS so
// the (heavy, browser-only) pdf.js bundle is never pulled into the native graph.
function getWebPdfjs(): Promise<PdfjsModule> {
  if (!webPdfjsPromise) {
    webPdfjsPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
      if (typeof (globalThis as Record<string, unknown>).pdfjsWorker === "undefined") {
        (globalThis as Record<string, unknown>).pdfjsWorker = pdfjsWorker;
      }
      // Empty string = in-thread worker; no separate worker file URL needed.
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      return pdfjsLib;
    })();
  }
  return webPdfjsPromise;
}

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
  underclearance?: ParsedUnderclearance;
  channelCrossSection?: ParsedChannelCrossSection;
}

// ─── Form 2601 – Underclearance Record ───────────────────────────────────────

export interface ParsedUcMeasure {
  data: string;
  refer: string;
}

export interface ParsedUnderclearanceEntry {
  psn: string;
  rightLateral: ParsedUcMeasure;
  leftLateral: ParsedUcMeasure;
  totalHorizontal: ParsedUcMeasure;
  maxPracticalVert: ParsedUcMeasure;
  minMeasuredVert: ParsedUcMeasure;
  signedVertData: string;
  signedVertTolerance: string;
}

export interface ParsedUnderclearance {
  district: string;
  county: string;
  controlSection: string;
  structureNumber: string;
  route: string;
  featureCrossed: string;
  inspectionDate: string;
  entries: ParsedUnderclearanceEntry[];
}

// ─── Form 2600 – Channel Cross-Section ───────────────────────────────────────

export interface ParsedChannelMeasurement {
  topRef: string;
  botRef: string;
  totalHoriz: string;
  distFromLastBent: string;
  vertDist: string;
  notes: string;
}

export interface ParsedChannelCrossSection {
  district: string;
  county: string;
  controlSection: string;
  structureNumber: string;
  route: string;
  featureCrossed: string;
  inspectionDate: string;
  upstream: ParsedChannelMeasurement[];
  downstream: ParsedChannelMeasurement[];
}

type PdfSource = File | { uri: string };

// Read the raw PDF bytes from a source. WEB ONLY — on web, fetch() reads
// file/blob/http URLs correctly and File exposes arrayBuffer(). Native never
// calls this; it reads base64 and extracts inside a WebView (see readPdfBase64
// / loadPdfTextNative).
async function readPdfBytes(source: PdfSource): Promise<ArrayBuffer | Uint8Array> {
  if (typeof File !== "undefined" && source instanceof File) {
    return source.arrayBuffer();
  }

  const { uri } = source as { uri: string };

  // Inline data: URIs carry the bytes directly — decode them.
  if (uri.startsWith("data:")) {
    const b64 = uri.slice(uri.indexOf(",") + 1);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  const response = await fetch(uri);
  return response.arrayBuffer();
}

// Read a PDF as base64 for the native WebView extractor. The WebView decodes the
// base64 back into bytes in a real browser, sidestepping Hermes' unreliable
// local-file reads.
async function readPdfBase64(source: PdfSource): Promise<string> {
  const { uri } = source as { uri: string };
  if (uri.startsWith("data:")) {
    return uri.slice(uri.indexOf(",") + 1);
  }
  const FS = await import("expo-file-system/legacy");
  return FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
}

async function loadPdfText(source: PdfSource): Promise<string[][]> {
  return Platform.OS === "web" ? loadPdfTextWeb(source) : loadPdfTextNative(source);
}

// Native: run pdf.js inside the headless WebView. The WebView reproduces the
// SAME per-page line/column reconstruction as loadPdfTextWeb below (see
// components/pdfExtractorHtml.ts), so downstream parsers match identically.
async function loadPdfTextNative(source: PdfSource): Promise<string[][]> {
  const base64 = await readPdfBase64(source);
  return extractPdfTextNative(base64);
}

// Web: run pdf.js directly in the browser.
async function loadPdfTextWeb(source: PdfSource): Promise<string[][]> {
  const pdfjsLib = await getWebPdfjs();
  const data = await readPdfBytes(source);

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
  { pattern: /\bDECK\b.*ITEM\s*58|\bITEM\s*58\b/i, item: "58" },
  { pattern: /\bSUPERSTRUCTURE\b.*ITEM\s*59|\bITEM\s*59\b/i, item: "59" },
  { pattern: /\bSUBSTRUCTURE\b.*ITEM\s*60|\bITEM\s*60\b/i, item: "60" },
  { pattern: /\bCHANNEL\b.*ITEM\s*61|\bITEM\s*61\b/i, item: "61" },
  { pattern: /\bAPPROACH(ES)?\b.*ITEM\s*65|\bITEM\s*65\b/i, item: "65" },
  { pattern: /\bTRAFFIC\b.*ITEM\s*36|\bITEM\s*36\b/i, item: "36" },
  { pattern: /\bWATERWAY\b.*ITEM\s*71|\bITEM\s*71\b/i, item: "71" },
  { pattern: /\bAPPROACH\s+ROAD(?:WAY)?\s+ALIGN|\bITEM\s*72\b/i, item: "72" },
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
    if (norm === normalizeForMatching(key)) return canonical;
  }

  const sortedKeys = Object.keys(NBI_COMPONENT_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const normKey = normalizeForMatching(key);
    if (norm.startsWith(normKey)) return NBI_COMPONENT_ALIASES[key];
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

function isElementTableHeader(lines: string[], i: number): boolean {
  const block = [
    lines[i] || "",
    lines[i + 1] || "",
    lines[i + 2] || "",
  ].join(" ").toUpperCase();
  return (
    block.includes("ENVIRONMENT") &&
    (block.includes("STATE 1") || block.includes("CONDITION STATE") || block.includes("QUANTITY"))
  );
}

export function parseNbiRatings(pages: string[][]): ParsedNbiEntry[] {
  const results: ParsedNbiEntry[] = [];
  const allLines = pages.flat();
  const debug: string[] = [];

  let currentItem = "";
  const seen = new Set<string>();

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    if (isElementTableHeader(allLines, i)) {
      break;
    }

    const next = allLines[i + 1] || "";
    const next2 = allLines[i + 2] || "";
    const block3 = line + " " + next + " " + next2;

    for (const { pattern, item } of NBI_SECTION_PATTERNS) {
      if (pattern.test(line) || pattern.test(block3)) {
        currentItem = item;
        break;
      }
    }

    if (!currentItem) continue;

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
    if (rawName.match(/^\d{1,3}-/)) continue;
    if (rawName.match(/^\d{4,}/)) continue;
    if (rawName.match(/^\d[\d,]*\s+(?:sq|ft|each|ea)/i)) continue;
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

interface ParsedNumbers {
  env: string;
  qty: number;
  unit: string;
  cs: [number, number, number, number];
}

function extractTrailingFourNumbers(line: string): [number, number, number, number] | null {
  const parts = line.trim().split(/\s+/);
  const nums: number[] = [];
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

function parseDataLine(line: string): ParsedNumbers | null {
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

function isNumbersOrDataLine(line: string): boolean {
  if (/^\d{1,3}-/.test(line.trim()) || /^\d{4,}-/.test(line.trim())) return false;
  return extractTrailingFourNumbers(line) !== null;
}

function isIdLine(line: string): boolean {
  return /^\d{1,3}-/.test(line.trim()) || /^\d{4,}-/.test(line.trim());
}

function stripDataFromName(name: string): string {
  return name
    .replace(/\s+\d+\s*[-–]\s*\w+\.?\s*\d[\d,]*\s*[\w./]+.*$/, "")
    .replace(/\s+\d[\d,]*\s*[\w./]+\s*\d+\s+\d+\s+\d+\s+\d+.*$/, "")
    .replace(/\s+\d+\s+\d+\s+\d+\s+\d+\s*$/, "")
    .trim();
}

const SECTION_END_PATTERN = /^\s*(PICTURES|PHOTOS|APPENDIX|BRIDGE INSPECTION RECORD|Bridge Inspection Report|Inspector:|Inspection Date:)\s*/i;

export function parseElementsTable(pages: string[][]): ParsedElementRow[] {
  const results: ParsedElementRow[] = [];
  const allLines = pages.flat();

  let startIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (isElementTableHeader(allLines, i)) {
      startIdx = i + 3;
      break;
    }
  }

  if (startIdx < 0) return [];

  let currentElement: ParsedElementRow | null = null;
  let pendingData: ParsedNumbers | null = null;

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
        cs1,
        cs2,
        cs3,
        cs4,
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
        cs1,
        cs2,
        cs3,
        cs4,
      };
      results.push(currentElement);
    }
  }

  return results;
}

// ─── Shared header parser (used by both Form 2601 and Form 2600) ─────────────

function parseFormHeaderBlock(
  allLines: string[],
  anchorIdx: number
): {
  district: string;
  county: string;
  controlSection: string;
  structureNumber: string;
  route: string;
  featureCrossed: string;
  inspectionDate: string;
} {
  let district = "",
    county = "",
    controlSection = "",
    structureNumber = "",
    route = "",
    featureCrossed = "",
    inspectionDate = "";
  const end = Math.min(anchorIdx + 40, allLines.length);

  for (let i = anchorIdx; i < end; i++) {
    const line = allLines[i];

    // Line with "District:" and "County:" holds labels; values follow on the next line
    if (/District:/i.test(line) && /County:/i.test(line)) {
      // Route value is embedded at the end of the label line
      const routeM = line.match(/Route:\s*(.+)/i);
      if (routeM) route = routeM[1].trim();

      // Section suffix embedded: "Section:  -  NN  Structure" pattern
      const secSufM = line.match(/Section:.*?-\s*(\d+)\s+Structure/i);
      const sectionSuffix = secSufM ? secSufM[1].trim() : "";

      // Values line immediately follows
      const vLine = allLines[i + 1] || "";
      const vParts = vLine
        .trim()
        .split(/\s{2,}/)
        .map((s) => s.trim())
        .filter((s) => s && /\d/.test(s));
      if (vParts.length >= 1) district = vParts[0];
      if (vParts.length >= 2) county = vParts[1];
      if (vParts.length >= 3) {
        const ctrl = vParts[2];
        controlSection = sectionSuffix ? `${ctrl}-${sectionSuffix}` : ctrl;
      }
      if (vParts.length >= 4) structureNumber = vParts[3];
    }

    // "Feature Crossed:" — value may be on same or next line
    if (/Feature\s+Crossed:/i.test(line)) {
      const sameRest = line
        .replace(/Feature\s+Crossed:/i, "")
        .replace(/Inspector['s\s]+Signature:?/i, "")
        .trim();
      if (sameRest) {
        const parts = sameRest.split(/\s{2,}/).filter(Boolean);
        if (parts.length >= 1) featureCrossed = parts[0].trim();
      }
      if (!featureCrossed) {
        const nextLine = allLines[i + 1] || "";
        const dateM2 = nextLine.match(/Date:\s*(\S+)/i);
        if (dateM2 && !inspectionDate) inspectionDate = dateM2[1];
        const fcParts = nextLine
          .replace(/Date:.*$/i, "")
          .trim()
          .split(/\s{2,}/)
          .filter(Boolean);
        if (fcParts.length >= 1) featureCrossed = fcParts[0].trim();
      }
    }

    // Date (pick up on any near-header line)
    if (!inspectionDate) {
      const dateM = line.match(/\bDate:\s*(\d[\d\/\-]+)/i);
      if (dateM) inspectionDate = dateM[1].trim();
    }
  }

  return { district, county, controlSection, structureNumber, route, featureCrossed, inspectionDate };
}

// ─── Form 2601 – Underclearance Record ───────────────────────────────────────

const UC_LABEL_PATTERNS: {
  key: "rightLateral" | "leftLateral" | "totalHorizontal" | "maxPracticalVert" | "minMeasuredVert";
  re: RegExp;
}[] = [
  { key: "rightLateral", re: /Right\s+Lateral\s+Clearance/i },
  { key: "leftLateral", re: /Left\s+Lateral\s+Clearance/i },
  { key: "totalHorizontal", re: /Total\s+Horizontal\s+Cl\w*/i },
  { key: "maxPracticalVert", re: /Max(?:imum)?\s+Practical\s+Vert/i },
  { key: "minMeasuredVert", re: /Min(?:imum)?\s+Measured\s+Vert/i },
];

function isUcMeasureLabelLine(line: string): boolean {
  return (
    UC_LABEL_PATTERNS.some(({ re }) => re.test(line)) ||
    /Signed\s+Vertical\s+Cl/i.test(line)
  );
}

function extractUcDataAfterLabel(labelRe: RegExp, line: string): ParsedUcMeasure | null {
  const rest = line.replace(labelRe, "").trim();
  if (!rest || /^(?:Field|Data|Refer\.|Item\s+No\.)/i.test(rest)) return null;
  const parts = rest
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return { data: parts[0], refer: parts[1] || "" };
}

function extractUcDataFromLine(line: string): ParsedUcMeasure | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^(?:Field|Data|Refer\.|Item\s+No\.|Tolerance)/i.test(trimmed)) return null;
  if (isUcMeasureLabelLine(trimmed) || /^PSN:/i.test(trimmed)) return null;
  const parts = trimmed
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return { data: parts[0], refer: parts[1] || "" };
}

export function parseUnderclearance(pages: string[][]): ParsedUnderclearance | null {
  const allLines = pages.flat();
  const anchorIdx = allLines.findIndex((l) => /Underclearance Record/i.test(l));
  if (anchorIdx < 0) return null;

  const header = parseFormHeaderBlock(allLines, anchorIdx);

  // PSN header rows delimit each clearance-point block
  const psnHeaders: number[] = [];
  for (let i = anchorIdx; i < allLines.length; i++) {
    if (/^PSN:.*Refer\./i.test(allLines[i])) psnHeaders.push(i);
  }

  const EMPTY: ParsedUcMeasure = { data: "", refer: "" };
  const entries: ParsedUnderclearanceEntry[] = [];

  for (let b = 0; b < psnHeaders.length; b++) {
    // Extract PSN value from the header line: "PSN:  <value>  Refer.  ..."
    let psn = "";
    const psnHeaderLine = allLines[psnHeaders[b]];
    const psnM = psnHeaderLine.match(/^PSN:\s+(.+?)\s{2,}Refer\./i);
    if (psnM) {
      const candidate = psnM[1].trim();
      if (candidate && !/^Refer\./i.test(candidate)) psn = candidate;
    }
    // Fallback: check the line two positions before the PSN header (after "Field  Field..." row)
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
    // Skip optional "Data  Data  Data  Data" sub-header
    if (blockStart < allLines.length && /^Data\s+Data/i.test(allLines[blockStart])) {
      blockStart++;
    }
    const blockEnd = b + 1 < psnHeaders.length ? psnHeaders[b + 1] : allLines.length;
    const blockLines = allLines.slice(blockStart, blockEnd);

    const meas: Partial<
      Record<
        "rightLateral" | "leftLateral" | "totalHorizontal" | "maxPracticalVert" | "minMeasuredVert",
        ParsedUcMeasure
      >
    > = {};
    let signedVertData = "";
    let signedVertTolerance = "";

    for (let li = 0; li < blockLines.length; li++) {
      const bline = blockLines[li];
      if (!bline.trim()) continue;

      if (/Signed\s+Vertical\s+Cl/i.test(bline)) {
        const rest = bline.replace(/Signed\s+Vertical\s+Cl\w*\s*/i, "").trim();
        const tokens = rest.split(/\s+/).filter((s) => s && !/^Tolerance$/i.test(s));
        if (tokens.length >= 1) signedVertData = tokens[0];
        if (tokens.length >= 2) signedVertTolerance = tokens[1];
        continue;
      }

      for (const { key, re } of UC_LABEL_PATTERNS) {
        if (re.test(bline)) {
          let m = extractUcDataAfterLabel(re, bline);
          if (!m) {
            const nextLine = blockLines[li + 1] || "";
            if (nextLine.trim() && !isUcMeasureLabelLine(nextLine)) {
              m = extractUcDataFromLine(nextLine);
              if (m) li++;
            }
          }
          if (m) meas[key] = m;
          break;
        }
      }
    }

    const hasData =
      Object.values(meas).some((m) => m.data && m.data !== "-") ||
      (signedVertData !== "" && signedVertData !== "-");

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

// ─── Form 2600 – Channel Cross-Section ───────────────────────────────────────

export function parseChannelCrossSection(pages: string[][]): ParsedChannelCrossSection | null {
  const allLines = pages.flat();
  const anchorIdx = allLines.findIndex((l) =>
    /Channel\s+Cross[-\s]Section|Form\s+2600/i.test(l)
  );
  if (anchorIdx < 0) return null;

  const header = parseFormHeaderBlock(allLines, anchorIdx);

  const upstream: ParsedChannelMeasurement[] = [];
  const downstream: ParsedChannelMeasurement[] = [];
  let currentSection: "upstream" | "downstream" | null = null;
  let inMeasTable = false;

  for (let i = anchorIdx; i < allLines.length; i++) {
    const line = allLines[i];

    if (/\bUPSTREAM\b/i.test(line) && !/\bDOWNSTREAM\b/i.test(line)) {
      currentSection = "upstream";
      inMeasTable = false;
      continue;
    }
    if (/\bDOWNSTREAM\b/i.test(line)) {
      currentSection = "downstream";
      inMeasTable = false;
      continue;
    }
    if (!currentSection) continue;

    // Column header row detection
    if (/TOP\s+REF|BOT\.?\s+REF|VERT\.?\s+DIST|TOTAL\s+HORIZ/i.test(line)) {
      inMeasTable = true;
      continue;
    }
    if (!inMeasTable) continue;

    // Section-ending anchors
    if (/^(?:COMMENTS?|Inspector|Date:|Page\s+\d|DISTRICT)/i.test(line)) break;

    const parts = line
      .trim()
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 3) continue;
    if (/^(?:No\.|Row|Station|Top|Bot|Total|Dist|Vert|Notes)/i.test(parts[0])) continue;

    const offset = /^\d+$/.test(parts[0]) ? 1 : 0;
    const meas: ParsedChannelMeasurement = {
      topRef: parts[offset] || "",
      botRef: parts[offset + 1] || "",
      totalHoriz: parts[offset + 2] || "",
      distFromLastBent: parts[offset + 3] || "",
      vertDist: parts[offset + 4] || "",
      notes: parts[offset + 5] || "",
    };

    if (meas.totalHoriz || meas.vertDist) {
      if (currentSection === "upstream") upstream.push(meas);
      else downstream.push(meas);
    }
  }

  return { ...header, upstream, downstream };
}

// ─── Top-level report parser ──────────────────────────────────────────────────

export async function parseReport(source: PdfSource): Promise<ParsedReport> {
  const pages = await loadPdfText(source);
  const structureNumber = parseStructureNumber(pages);
  const elements = parseElementsTable(pages);
  const nbi = parseNbiRatings(pages);
  const underclearance = parseUnderclearance(pages) ?? undefined;
  const channelCrossSection = parseChannelCrossSection(pages) ?? undefined;
  return { structureNumber, elements, nbi, underclearance, channelCrossSection };
}
