import { Platform } from "react-native";
import { extractPdfTextNative } from "../components/pdfExtractorBridge";
import {
  isScdotReport,
  parseScdotReport,
  splitCodedValue,
  type ParsedScdotReport,
  type ScdotElementRow,
} from "./scdotParser";

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
  /** Agency asset identifier when it differs from the NBI structure number (SCDOT "Asset ID"). */
  assetId?: string;
  elements: ParsedElementRow[];
  nbi: ParsedNbiEntry[];
  isSnbi: boolean;
  agency?: "TXDOT" | "SCDOT";
  inspectionType?: "Underwater";
  underclearance?: ParsedUnderclearance;
  channelCrossSection?: ParsedChannelCrossSection;
  /** Full SCDOT (BrM) report breakdown; present only for SCDOT reports. */
  scdot?: ParsedScdotReport;
  /** Parser notes worth showing in the import audit (roll-up mismatches, ambiguous values, …). */
  warnings: string[];
}

// ─── Shared form header (District, County, Control-Section, Structure #, Route, Feature Crossed, Date) ─────

export interface ParsedFormHeader {
  district: string;
  county: string;
  controlSection: string;
  structureNumber: string;
  route: string;
  featureCrossed: string;
  inspectionDate: string;
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
  /** Extra metadata from Channel Measurement report (water level, measurement type, etc.) */
  comments?: string;
}

type PdfSource = File | { uri: string; nativeDirectUri?: boolean };

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
  if (
    typeof source === "object" &&
    "uri" in source &&
    source.nativeDirectUri &&
    !source.uri.startsWith("data:")
  ) {
    return extractPdfTextNative({ uri: source.uri });
  }
  const base64 = await readPdfBase64(source);
  return extractPdfTextNative({ base64 });
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

// ─── SNBI format (B.C.01–B.C.11) ────────────────────────────────────────────

export function detectSnbiFormat(pages: string[][]): boolean {
  const text = pages.flat().join(" ");
  return /[\[(]B\.C\.0[1-9][\])]|[\[(]B\.C\.1[01][\])]/.test(text);
}

const SNBI_SECTION_PATTERNS: { pattern: RegExp; item: string }[] = [
  { pattern: /[\[(]B\.C\.01[\])]/i, item: "BC01" },
  { pattern: /[\[(]B\.C\.02[\])]/i, item: "BC02" },
  { pattern: /[\[(]B\.C\.03[\])]/i, item: "BC03" },
  { pattern: /[\[(]B\.C\.04[\])]/i, item: "BC04" },
  { pattern: /[\[(]B\.C\.05[\])]/i, item: "BC05" },
  { pattern: /[\[(]B\.C\.06[\])]/i, item: "BC06" },
  { pattern: /[\[(]B\.C\.07[\])]/i, item: "BC07" },
  { pattern: /[\[(]B\.C\.08[\])]/i, item: "BC08" },
  { pattern: /[\[(]B\.C\.09[\])]/i, item: "BC09" },
  { pattern: /[\[(]B\.C\.10[\])]/i, item: "BC10" },
  { pattern: /[\[(]B\.C\.11[\])]/i, item: "BC11" },
];

const SNBI_COMPONENT_ALIASES: Record<string, string> = {
  "deck component rating": "Deck - Component Rating",
  "deck - component rating": "Deck - Component Rating",
  "wearing surface": "Wearing Surface",
  "drainage system": "Drainage System",
  "curbs & sidewalks": "Curbs & Sidewalks",
  "curbs and sidewalks": "Curbs & Sidewalks",
  "curbs sidewalks": "Curbs & Sidewalks",
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
  "steel protective coating": "Steel Protective Coating",
  "overall component rating": "Overall Component Rating",
  "abutment caps": "Abutment Caps",
  "above ground": "Above Ground",
  "below ground or foundation": "Below Ground or Foundation",
  "below ground": "Below Ground or Foundation",
  "backwalls & wingwalls": "Backwalls & WingWalls",
  "backwalls wingwalls": "Backwalls & WingWalls",
  "backwalls": "Backwalls & WingWalls",
  "int. supports: caps - concrete": "Int. Supports: Caps - Concrete",
  "int supports caps concrete": "Int. Supports: Caps - Concrete",
  "int. supports: caps - steel": "Int. Supports: Caps - Steel",
  "int. supports: caps - timber": "Int. Supports: Caps - Timber",
  "int. supports: above ground - concrete": "Int. Supports: Above Ground - Concrete",
  "int. supports: above ground - steel": "Int. Supports: Above Ground - Steel",
  "int. supports: above ground - timber": "Int. Supports: Above Ground - Timber",
  "int. supports: above ground - masonry": "Int. Supports: Above Ground - Masonry",
  "int. supports: below ground or foundation": "Int. Supports: Below Ground or Foundation",
  "int. supports: below ground": "Int. Supports: Below Ground or Foundation",
  "collision protection system": "Collision Protection System",
  "collision protection": "Collision Protection System",
  "top slabs": "Top Slabs",
  "bottom slab or footing": "Bottom Slab or Footing",
  "bottom slab": "Bottom Slab or Footing",
  "abutments, intermed. supports": "Abutments, Intermed. Supports",
  "abutments intermed supports": "Abutments, Intermed. Supports",
  "headwalls & wingwalls": "Headwalls & WingWalls",
  "headwalls wingwalls": "Headwalls & WingWalls",
  "median barrier": "Median Barrier",
  "railings": "Railings",
  "pedestrian railing": "Pedestrian Railing",
  "railing protective coating": "Railing Protective Coating",
  "transition railings": "Transition Railings",
  "railing transitions protective coating": "Railing Transitions Protective Coating",
  "expansion bearings": "Expansion Bearings",
  "fixed bearings": "Fixed Bearings",
  "joints, expansion, open": "Joints, Expansion, Open",
  "joints expansion open": "Joints, Expansion, Open",
  "joints, expansion, sealed": "Joints, Expansion, Sealed",
  "joints expansion sealed": "Joints, Expansion, Sealed",
  "joints, other": "Joints, Other",
  "joints other": "Joints, Other",
  "channel banks": "Channel Banks",
  "channel bed": "Channel Bed",
  "rip rap, toe walls & apron": "Rip Rap, Toe Walls & Apron",
  "rip rap": "Rip Rap, Toe Walls & Apron",
  "dikes": "Dikes",
  "jetties": "Jetties",
  "scour vulnerability assessment": "Scour Vulnerability Assessment",
  "scour vulnerability": "Scour Vulnerability Assessment",
  "underwater inspection": "Underwater Inspection",
  "underwater inspection results": "Underwater Inspection",
  "countermeasures": "Countermeasures",
  "bridge railing": "Bridge Railing",
  "bridge rail": "Bridge Railing",
  "end treatments": "End Treatments",
  "end treatment": "End Treatments",
  "other": "Other",
};

function normalizeSnbiComponentName(raw: string): string {
  const norm = normalizeForMatching(raw);
  if (SNBI_COMPONENT_ALIASES[norm]) return SNBI_COMPONENT_ALIASES[norm];
  const sortedKeys = Object.keys(SNBI_COMPONENT_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (norm.startsWith(normalizeForMatching(key))) return SNBI_COMPONENT_ALIASES[key];
  }
  return raw.trim();
}

export function parseSnbiRatings(pages: string[][]): ParsedNbiEntry[] {
  const results: ParsedNbiEntry[] = [];
  const allLines = pages.flat();

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

    for (const { pattern, item } of SNBI_SECTION_PATTERNS) {
      if (pattern.test(line) || pattern.test(block3)) {
        currentItem = item;
        break;
      }
    }

    if (!currentItem) continue;
    if (/[\[(]B\.C\.\d\d[\])]/i.test(line)) continue;

    let matched: { rawName: string; desc: string; min: string; rating: string; comment: string } | null = null;

    const m1 = line.match(RATING_LINE_PATTERNS[0]);
    if (m1) {
      matched = { rawName: m1[1].trim(), desc: (m1[2] || "").trim(), min: m1[3], rating: m1[4], comment: m1[5]?.trim() || "" };
    } else {
      const m2 = line.match(RATING_LINE_PATTERNS[1]);
      if (m2) {
        matched = { rawName: m2[1].trim(), desc: "", min: m2[2], rating: m2[3], comment: m2[4]?.trim() || "" };
      } else {
        const m3 = line.match(RATING_LINE_PATTERNS[2]);
        if (m3) {
          matched = { rawName: m3[1].trim(), desc: "", min: "", rating: m3[2], comment: m3[3]?.trim() || "" };
        }
      }
    }

    if (!matched) continue;

    const { rawName, desc, min, rating, comment } = matched;
    const componentName = normalizeSnbiComponentName(rawName);

    if (componentName.length <= 3) continue;
    if (rawName.match(/^\d{1,3}-/)) continue;
    if (rawName.match(/^\d{4,}/)) continue;
    if (rawName.match(/^\d[\d,]*\s+(?:sq|ft|each|ea)/i)) continue;
    if (rawName.match(/Structure ID|Inspection Date|DO NOT DISCLOSE|Page\s*\d|^Date\b|^Time\b/i)) continue;
    if (componentName.toLowerCase().match(/^(yes|no|n\/a|na|none|date|page|sheet)\b/)) continue;

    const key = `${currentItem}|${componentName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let fullComment = comment;
    let j = i + 1;
    let continued = 0;
    while (j < allLines.length && continued < 10) {
      const cont = allLines[j];
      if (!cont || !cont.trim()) break;
      if (STRUCTURAL_LINE_RE.test(cont)) break;
      if (RATING_LINE_PATTERNS.some((re) => re.test(cont))) break;
      let isSection = false;
      for (const { pattern } of SNBI_SECTION_PATTERNS) {
        if (pattern.test(cont)) { isSection = true; break; }
      }
      if (isSection) break;
      fullComment = fullComment ? `${fullComment} ${cont.trim()}` : cont.trim();
      j++;
      continued++;
    }
    i = j - 1;

    results.push({ item: currentItem, componentName, desc, min, rating, comment: fullComment });
  }

  if (typeof console !== "undefined") {
    console.log(`[pdfParser] Parsed ${results.length} SNBI entries`);
  }

  return results;
}

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

// ─── Channel Measurement Report (alternate format) ───────────────────────────
// Parses the Channel Measurement image/table form that shows labeled measurement
// points with horizontal locations and depth values (e.g., from the Channel
// Measurement software). This differs from TxDOT Form 2600 (Channel
// Cross-Section) which uses upstream/downstream sections with topRef/botRef.
//
// Expected PDF text structure on the page:
//   Channel Measurement                         ← page title / anchor
//   Date of Channel Measurements:  06/18/2024  Number of Fixed Objects…
//   Distance Measured From:  0                 Water Level:  34.1
//   Depth Measured From:  0                    High Water Mark:
//   Number of Measurement Points Taken:         Measurement Type:  Depth…
//   Bridge #150150052104404 IH 410 SBFR over Leon Creek  ← title line
//   [diagram — no useful text]
//   Measurement Points  1  2  3  …  10
//   Measurement Point Label  SW A1  B2  B3  …  NE A10
//   Measurement Location     0  75  146  …  587
//   Depth/Height Measured    8.0  25.9  30.6  …  9.2
//
// Measurement points are imported into the upstream section of ChannelData:
//   totalHoriz  ← Measurement Location
//   vertDist    ← Depth/Height Measured
//   notes       ← Measurement Point Label (e.g. "SW A1", "B2")
//   topRef      ← "TR"   (Top of Railing — standard reference)
//   botRef      ← "CH"   (Channel — bottom reference)

export function parseChannelMeasurementReport(
  pages: string[][]
): ParsedChannelCrossSection | null {
  const allLines = pages.flat();

  // Anchor: a line that starts (and roughly ends) with "Channel Measurement"
  // but is NOT one of the row-header lines ("Measurement Point Label", etc.).
  const anchorIdx = allLines.findIndex((l) => {
    const t = l.trim();
    return (
      /^Channel\s+Measurement\b/i.test(t) &&
      !/Date|Points?\b|Location|Height|Depth|Type/i.test(t)
    );
  });
  if (anchorIdx < 0) return null;

  // ── Parse header fields ──────────────────────────────────────────────────
  let inspectionDate = "";
  let waterLevel = "";
  let measurementType = "";
  let structureNumber = "";
  let featureCrossed = "";

  const headerEnd = Math.min(anchorIdx + 25, allLines.length);
  for (let i = anchorIdx; i < headerEnd; i++) {
    const line = allLines[i];

    const dateM = line.match(/Date\s+of\s+Channel\s+Measurements?:\s*([\d/\-]+)/i);
    if (dateM && !inspectionDate) inspectionDate = dateM[1].trim();

    // Water Level can appear on the same line as other fields
    const waterM = line.match(/Water\s+Level:\s*([\d.]+)/i);
    if (waterM && !waterLevel) waterLevel = waterM[1].trim();

    const typeM = line.match(/Measurement\s+Type:\s*(.+)/i);
    if (typeM && !measurementType) measurementType = typeM[1].trim();

    // Bridge title: "Bridge #150150052104404 IH 410 SBFR over Leon Creek"
    const bridgeM = line.match(/Bridge\s+#?([\w\-]+)\s+.+\s+over\s+(.+)/i);
    if (bridgeM && !structureNumber) {
      structureNumber = bridgeM[1].trim();
      featureCrossed = bridgeM[2].trim();
    }
  }

  // ── Find measurement table rows ─────────────────────────────────────────
  let labelLineIdx = -1;
  let locationLineIdx = -1;
  let depthLineIdx = -1;

  for (let i = anchorIdx; i < allLines.length; i++) {
    const l = allLines[i];
    if (/Measurement\s+Point\s+Label/i.test(l) && labelLineIdx < 0) labelLineIdx = i;
    else if (/Measurement\s+Location/i.test(l) && locationLineIdx < 0) locationLineIdx = i;
    else if (/Depth\s*[\/|]\s*Height\s+Measured/i.test(l) && depthLineIdx < 0) depthLineIdx = i;
    if (labelLineIdx >= 0 && locationLineIdx >= 0 && depthLineIdx >= 0) break;
  }

  // We need at least the location and depth rows to produce useful data.
  if (locationLineIdx < 0 || depthLineIdx < 0) return null;

  // Extract all numeric values from a row (skips the leading label text).
  const extractNums = (lineIdx: number): string[] => {
    const line = allLines[lineIdx] || "";
    // Try splitting on 2+ spaces first; the first chunk is the row header.
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length > 1) {
      const candidates = parts.slice(1).map((s) => s.trim()).filter(Boolean);
      // Validate that they look numeric before returning.
      if (candidates.every((c) => /^[\d.]+$/.test(c))) return candidates;
    }
    // Fallback: pull all numbers out of the line via regex.
    return (line.match(/\b\d+\.?\d*\b/g) || []);
  };

  // Extract label tokens from a row (non-numeric, variable spacing).
  const extractLabels = (lineIdx: number): string[] => {
    if (lineIdx < 0) return [];
    const line = allLines[lineIdx] || "";
    const parts = line.trim().split(/\s{2,}/);
    return parts.slice(1).map((s) => s.trim()).filter(Boolean);
  };

  const labels = extractLabels(labelLineIdx);
  const locations = extractNums(locationLineIdx);
  const depths = extractNums(depthLineIdx);

  if (!locations.length && !depths.length) return null;

  const count = Math.max(locations.length, depths.length);
  const upstream: ParsedChannelMeasurement[] = [];

  for (let i = 0; i < count; i++) {
    const loc = locations[i] || "";
    const depth = depths[i] || "";
    if (!loc && !depth) continue;
    upstream.push({
      topRef: "TR",
      botRef: "CH",
      totalHoriz: loc,
      distFromLastBent: "",
      vertDist: depth,
      notes: labels[i] || "",
    });
  }

  if (!upstream.length) return null;

  const commentParts: string[] = [];
  if (waterLevel) commentParts.push(`Water Level: ${waterLevel}`);
  if (measurementType) commentParts.push(`Measurement Type: ${measurementType}`);

  return {
    district: "",
    county: "",
    controlSection: "",
    structureNumber,
    route: "",
    featureCrossed,
    inspectionDate,
    upstream,
    downstream: [],
    comments: commentParts.length ? commentParts.join(" | ") : undefined,
  };
}

// ─── SCDOT (BrM) adapter ─────────────────────────────────────────────────────
// Maps the SCDOT-specific breakdown onto the agency-neutral ParsedReport shape
// consumed by importFromPdf. Details that have no neutral home stay on
// ParsedReport.scdot.

/** Element rows in the shape importFromPdf expects: defect rows point at their parent element. */
export function scdotElementsToRows(elements: ScdotElementRow[]): ParsedElementRow[] {
  const rows: ParsedElementRow[] = [];
  let parentId = "";
  for (const e of elements) {
    if (!e.isDefect) parentId = e.elementId;
    rows.push({
      elementId: e.isDefect ? parentId : e.elementId,
      elementName: e.name,
      isDefect: e.isDefect,
      defectCode: e.isDefect ? e.elementId : undefined,
      environment: e.environment,
      totalQty: e.totalQty,
      unit: e.unit,
      cs1: e.cs[0],
      cs2: e.cs[1],
      cs3: e.cs[2],
      cs4: e.cs[3],
    });
  }
  return rows;
}

// SCDOT condition fields → universal SNBI (B.C.01–B.C.11) sub-components.
// The app keeps one "Overall Component Rating" row per B.C. item plus a few
// named sub-components; only fields with an unambiguous home are mapped.
const SCDOT_CONDITION_FIELDS: { item: string; component: string; field: string }[] = [
  { item: "BC01", component: "Overall Component Rating", field: "058" },
  { item: "BC02", component: "Overall Component Rating", field: "059" },
  { item: "BC03", component: "Overall Component Rating", field: "060" },
  { item: "BC04", component: "Overall Component Rating", field: "062" },
  { item: "BC05", component: "Overall Component Rating", field: "602" },
  { item: "BC06", component: "Overall Component Rating", field: "603" },
  { item: "BC07", component: "Overall Component Rating", field: "604" },
  { item: "BC08", component: "Overall Component Rating", field: "605" },
  { item: "BC09", component: "Overall Component Rating", field: "061" },
  { item: "BC09", component: "Rip Rap, Toe Walls & Apron", field: "601" }, // (601) Channel Protection Condition
  { item: "BC10", component: "Scour Vulnerability Assessment", field: "113" }, // (113) Scour Condition
  { item: "BC10", component: "Underwater Inspection", field: "600" }, // (600) UW Substructure Condition
  { item: "BC10", component: "Overall Component Rating", field: "631" }, // (631) Scour Condition Rating
  { item: "BC11", component: "Bridge Railing", field: "36A" },
  { item: "BC06", component: "Transition Railings", field: "36B" },
  { item: "BC11", component: "End Treatments", field: "36D" },
];

// Section 4 headings → sub-component whose previousComments should carry the text.
function scdotSectionTargets(hasCulvert: boolean): { heading: string; item: string; component: string }[] {
  return [
    { heading: "Traffic Signs", item: "BC01", component: "Delineation" },
    { heading: "Drainage System", item: "BC01", component: "Drainage System" },
    { heading: "Curbs and Sidewalks", item: hasCulvert ? "BC04" : "BC01", component: hasCulvert ? "Headwalls & WingWalls" : "Curbs & Sidewalks" },
    { heading: "Wingwalls", item: hasCulvert ? "BC04" : "BC03", component: hasCulvert ? "Headwalls & WingWalls" : "Backwalls & WingWalls" },
    { heading: "Median and Other Barriers", item: "BC05", component: "Median Barrier" },
    { heading: "Diaphragms", item: "BC02", component: "Secondary Members" },
    { heading: "Fender System", item: "BC03", component: "Collision Protection System" },
    { heading: "Waterway and Channel", item: "BC09", component: "Overall Component Rating" },
  ];
}

/** Condition ratings + Section 4 notes as ParsedNbiEntry rows for the universal SNBI form. */
export function scdotConditionEntries(report: ParsedScdotReport): ParsedNbiEntry[] {
  const entries = new Map<string, ParsedNbiEntry>();
  const key = (item: string, component: string) => `${item}|${component}`;
  const get = (item: string, component: string) => {
    const k = key(item, component);
    if (!entries.has(k)) entries.set(k, { item, componentName: component, desc: "", min: "", rating: "", comment: "" });
    return entries.get(k)!;
  };

  for (const m of SCDOT_CONDITION_FIELDS) {
    const value = report.fields[m.field]?.value ?? "";
    if (!value) continue;
    const { code, text } = splitCodedValue(value);
    const e = get(m.item, m.component);
    e.rating = code;
    e.desc = text;
  }

  const hasCulvert = report.elements.some((e) => !e.isDefect && /^24[0-5]$/.test(e.elementId));
  for (const t of scdotSectionTargets(hasCulvert)) {
    const lines = (report.sectionNotes[t.heading] || []).filter((l) => l.trim() && l.trim() !== "N/A");
    if (lines.length === 0) continue;
    const e = get(t.item, t.component);
    e.comment = e.comment ? `${e.comment} ${lines.join(" ")}` : lines.join(" ");
  }
  // The "Scour:" sub-block of Waterway and Channel is the scour narrative.
  const waterway = report.sectionNotes["Waterway and Channel"] || [];
  const scourIdx = waterway.findIndex((l) => /^Scour:?$/i.test(l.trim()));
  if (scourIdx >= 0) {
    const scourLines = waterway.slice(scourIdx + 1).filter((l) => /^-\s/.test(l) || !/:$/.test(l));
    const stop = scourLines.findIndex((l) => /:$/.test(l));
    const text = (stop >= 0 ? scourLines.slice(0, stop) : scourLines).join(" ").trim();
    if (text) {
      const e = get("BC10", "Scour Vulnerability Assessment");
      e.comment = e.comment ? `${e.comment} ${text}` : text;
    }
  }

  return Array.from(entries.values()).filter((e) => e.rating || e.desc || e.comment);
}

/** Streambed cross sections → ChannelData shape (inlet = upstream, outlet = downstream). */
export function scdotStreambedToChannel(report: ParsedScdotReport): ParsedChannelCrossSection | undefined {
  const sections = report.streambed.filter((s) => s.rows.length > 0);
  if (sections.length === 0) return undefined;
  const isOutlet = (s: (typeof sections)[number]) => /outlet|down|right/i.test(`${s.offsetRemark} ${s.orientation}`);
  const upstreamSec = sections.find((s) => !isOutlet(s)) ?? sections[0];
  const downstreamSec = sections.find((s) => isOutlet(s) && s !== upstreamSec);
  const toRows = (s: (typeof sections)[number]) =>
    s.rows.map((r) => ({
      topRef: s.bmLocation || "",
      botRef: "",
      // "1 + 5.0" → offset along the section in feet; the leading number is the section index.
      totalHoriz: r.station.replace(/^\d+\s*\+\s*/, ""),
      distFromLastBent: "",
      vertDist: r.elevation,
      notes: r.remark,
    }));
  const describe = (s: (typeof sections)[number]) =>
    [
      [s.offsetRemark, s.orientation].filter(Boolean).join(" / "),
      s.waterSurface && `Water Surface ${s.waterSurface}`,
      s.offset && `Offset ${s.offset}`,
      s.elevBasis && `Elev Basis ${s.elevBasis}`,
      s.soundingDate && `Sounded ${s.soundingDate}`,
    ]
      .filter(Boolean)
      .join(", ");
  return {
    district: report.header.district,
    county: report.header.county,
    controlSection: "",
    structureNumber: report.header.structureNumber,
    route: report.header.facilityCarried,
    featureCrossed: report.header.featureIntersected,
    inspectionDate: report.header.inspectionDate,
    upstream: toRows(upstreamSec),
    downstream: downstreamSec ? toRows(downstreamSec) : [],
    comments: [describe(upstreamSec), downstreamSec && describe(downstreamSec)].filter(Boolean).join(" | ") || undefined,
  };
}

function parseScdotPages(pages: string[][]): ParsedReport {
  const scdot = parseScdotReport(pages);
  const inspectionType = /\bUnderwater\b/i.test(scdot.header.inspectionTypes) ? "Underwater" : undefined;
  return {
    structureNumber: scdot.header.structureNumber || parseStructureNumber(pages),
    assetId: scdot.header.assetId || undefined,
    elements: scdotElementsToRows(scdot.elements),
    nbi: scdotConditionEntries(scdot),
    isSnbi: true,
    agency: "SCDOT",
    inspectionType,
    underclearance: undefined,
    channelCrossSection: scdotStreambedToChannel(scdot),
    scdot,
    warnings: scdot.warnings,
  };
}

// ─── Top-level report parser ──────────────────────────────────────────────────

export async function parseReport(source: PdfSource): Promise<ParsedReport> {
  const pages = await loadPdfText(source);
  return parsePages(pages);
}

// Pure entry point: turn already-extracted page lines into a ParsedReport.
// Exported so the parsers can be unit-tested against fixture text without
// pdf.js or a WebView.
export function parsePages(pages: string[][]): ParsedReport {
  if (isScdotReport(pages)) return parseScdotPages(pages);
  // Join lines, not pages: joining the page arrays directly would stringify each
  // page with commas and let the line-anchored regexes below span a whole page.
  const reportText = pages.flat().join("\n");
  const agency =
    /\bSCDOT\b|SOUTH\s+CAROLINA\s+DEPARTMENT\s+OF\s+TRANSPORTATION/i.test(reportText)
      ? "SCDOT"
      : /\bTXDOT\b|TEXAS\s+DEPARTMENT\s+OF\s+TRANSPORTATION/i.test(reportText)
        ? "TXDOT"
        : undefined;
  const inspectionType = /Inspection\s+Type(?:\(s\))?:.*\bUnderwater\b/i.test(reportText)
    ? "Underwater"
    : undefined;
  const structureNumber = parseStructureNumber(pages);
  const elements = parseElementsTable(pages);
  const isSnbi = detectSnbiFormat(pages);
  const nbi = isSnbi ? parseSnbiRatings(pages) : parseNbiRatings(pages);
  const underclearance = parseUnderclearance(pages) ?? undefined;
  // Try TxDOT Form 2600 first; fall back to Channel Measurement report format.
  const channelCrossSection =
    parseChannelCrossSection(pages) ??
    parseChannelMeasurementReport(pages) ??
    undefined;
  return { structureNumber, elements, nbi, isSnbi, agency, inspectionType, underclearance, channelCrossSection, warnings: [] };
}
