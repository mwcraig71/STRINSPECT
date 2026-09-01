// SCDOT (AASHTOWare BrM) "Bridge Inspection Report" parser.
//
// Input is the per-page line text produced by the shared pdf.js reconstruction
// (utils/pdfParser.ts loadPdfTextWeb / components/pdfExtractorHtml.ts). Every
// function here is pure so it can be unit-tested against the fixtures in
// utils/__fixtures__/scdot-*.pages.json.
//
// Report anatomy (template "Bridge Inspection Report (v15, 11/01/2024)"):
//   p1     IDENTIFICATION / CONDITION AND APPRAISAL / GEOMETRY / CULVERT GEOMETRY / PARKING
//   p2-3   INSPECTION / LOAD RATING AND POSTING / POSTING SIGN VALUES / ROADWAY AND CLEARANCES
//   p4     OTHER BRIDGE DATA / CURB REVEAL / CULVERT FILL / ELEMENT CONDITION SUMMARY
//   p5+    ELEMENT NOTES  — element rows + free text; defect sentences end in "[elem, CSn, Qn]"
//   ...    SECTION 4: NON-ELEMENT INSPECTION NOTES — 13 fixed headings
//   ...    INSPECTION PHOTOS — "Photo N:" captions in a two-column grid
//   ...    INSPECTION SKETCHES / STREAMBED CROSS SECTIONS / SCOUR AND WATERWAY /
//          BRIDGE MAINTENANCE OFFICE FIELDS / JOINT / BEARINGS / PILES /
//          PROCEDURES FOR THIS INSPECTION / EQUIPMENT USED / INSPECTOR SIGNATURE
//
// Known extraction quirk: inventory values are drawn 0.3–1.3 pt off the label
// baseline, so the 2 pt row bucketing sometimes puts a value on the line ABOVE
// its "(NNN) Label:" — see parseFields() for how orphan values are re-attached.

// ─── Public types ────────────────────────────────────────────────────────────

export interface ScdotField {
  /** Item key: "058", "43A", "36A" … or a slug for unnumbered labels ("weather_during_inspection") */
  item: string;
  label: string;
  /** SNBI reference in brackets, e.g. "B.C.04" */
  snbi?: string;
  value: string;
}

export interface ScdotHeader {
  assetId: string;
  /** (468) Structure Number — 13-digit NBI structure number */
  structureNumber: string;
  teamLeader: string;
  teamMembers: string[];
  inspectionDate: string;
  /** Raw "Inspection Type(s)" text, e.g. "Routine", "Underwater (Unscheduled)" */
  inspectionTypes: string;
  facilityCarried: string;
  featureIntersected: string;
  latitude: string;
  longitude: string;
  district: string;
  county: string;
  owner: string;
  yearBuilt: string;
  yearReconstructed: string;
  location: string;
  weather: string;
  temperatureF: string;
}

export interface ScdotFrequency {
  inspectionType: string;
  frequencyMonths: string;
  lastInspection: string;
  nextInspection: string;
}

export interface ScdotDefectNote {
  parentElementId: string;
  /** Defect element code from the tag (e.g. "1130"); undefined for "[CS4, Q3]" style tags */
  defectCode?: string;
  cs: 1 | 2 | 3 | 4;
  qty: number;
  /** Full sentence(s) with the tag removed */
  text: string;
  /** Text before the first comma: "Barrel 1", "IW 1", "Span 10" */
  location: string;
  /** Parenthetical dimensions: "8in L x 14in W x 1in D" */
  size: string;
  /** Sub-heading(s) in force when the note appeared: "Top of Deck", "Span 10 › At BT 10" */
  context: string;
  rawTag: string;
}

export interface ScdotElementRow {
  elementId: string;
  environment: string;
  name: string;
  totalQty: number;
  /** Normalised unit: "sq ft" | "ft" | "ea" | raw */
  unit: string;
  rawUnit: string;
  cs: [number, number, number, number];
  isDefect: boolean;
  /** Untagged description/observation lines under this element (parents only) */
  notes: string[];
  /** Tagged defect sentences under this element (parents only) */
  defects: ScdotDefectNote[];
}

export interface ScdotPhoto {
  number: number;
  caption: string;
}

export interface ScdotStreambedRow {
  station: string;
  elevation: string;
  remark: string;
}

export interface ScdotStreambedSection {
  orientation: string;
  offsetRemark: string;
  elevBasis: string;
  waterSurface: string;
  sndElevInd: string;
  soundingDate: string;
  bmLocation: string;
  offset: string;
  rows: ScdotStreambedRow[];
}

export interface ScdotProcedure {
  /** Done flag as printed: "S" (satisfied), "R" (required) … */
  done: string;
  inspType: string;
  procedureType: string;
  name: string;
  details: string;
}

export interface ScdotEquipment {
  name: string;
  hours: string;
  cost: string;
}

export interface ScdotSignoff {
  inspectedBy: string;
  date: string;
  qcReviewedBy: string;
  qcCompleted: string;
  qaReviewedBy: string;
  qaCompleted: string;
}

export interface ParsedScdotReport {
  templateVersion: string;
  header: ScdotHeader;
  fields: Record<string, ScdotField>;
  frequencies: ScdotFrequency[];
  elements: ScdotElementRow[];
  /** Section 4 notes keyed by heading, in report order */
  sectionNotes: Record<string, string[]>;
  photos: ScdotPhoto[];
  streambed: ScdotStreambedSection[];
  procedures: ScdotProcedure[];
  procedureNotes: string;
  equipment: ScdotEquipment[];
  equipmentNotes: string;
  signoff: ScdotSignoff;
  warnings: string[];
}

// ─── Section 4 headings (fixed in the BrM template) ─────────────────────────

export const SCDOT_SECTION4_HEADINGS = [
  "Miscellaneous Notes",
  "Traffic Signs",
  "Encroachments",
  "Waterway and Channel",
  "Approach Roadway Condition",
  "Fender System",
  "Median and Other Barriers",
  "Under Bridge Railings/Barriers",
  "Curbs and Sidewalks",
  "Drainage System",
  "Diaphragms",
  "Wingwalls",
] as const;

const MAINTENANCE_SUMMARY_HEADING = /^\(623\) Summary of Previously Performed Maintenance Work/;

// ─── Detection ───────────────────────────────────────────────────────────────

export function isScdotReport(pages: string[][]): boolean {
  const first = (pages[0] || []).slice(0, 12).join("\n");
  return /^Bridge Inspection Report$/m.test(first) && /^Asset ID:\s+\S+/m.test(pages.flat().slice(0, 40).join("\n"));
}

// ─── Page chrome removal ─────────────────────────────────────────────────────

const CHROME_RE = [
  /^\d{4,6}$/, // asset id repeated top-right
  /^Bridge Inspection Report$/,
  /^Team Leader:/,
  /^Inspection Date:/,
  /^Inspection Type\(s\):/,
  /^\(16\) Latitude:/,
  /^Bridge Inspection Report \(v\d+/, // footer
  /^Page \d+ of \d+$/,
];

/** Lines of the report body with the repeated per-page header/footer removed. */
export function scdotBodyLines(pages: string[][]): string[] {
  const out: string[] = [];
  for (const page of pages) {
    for (const line of page) {
      if (CHROME_RE.some((re) => re.test(line))) continue;
      out.push(line);
    }
  }
  return out;
}

function splitCells(line: string): string[] {
  return line
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSectionHeading(line: string): boolean {
  // "IDENTIFICATION", "CONDITION AND APPRAISAL", "SECTION 4: NON-ELEMENT INSPECTION NOTES", …
  return /^[A-Z][A-Z0-9 :/&\-']{7,}$/.test(line) && !/N\/A|\d{2,}\/\d{1,2}\/\d{2,4}/.test(line);
}

// ─── Header ──────────────────────────────────────────────────────────────────

function firstMatch(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

export function parseScdotHeader(pages: string[][], fields: Record<string, ScdotField>): ScdotHeader {
  const p1 = (pages[0] || []).join("\n");
  const all = pages.flat();
  const teamMembersLine = all.find((l) => /^Team Members:/.test(l)) || "";
  const teamMembers = teamMembersLine
    .replace(/^Team Members:\s*/, "")
    .split(/\s{2,}|;|,/)
    .map((s) => s.trim())
    .filter((s) => s && !/^Schedule Notes/.test(s));

  const f = (k: string) => fields[k]?.value ?? "";

  return {
    assetId: firstMatch(p1, /^Asset ID:\s+(\S+)/m),
    structureNumber: f("468") || firstMatch(p1, /\(468\) Structure Number:\s+(\d+)/),
    teamLeader: firstMatch(p1, /Team Leader:\s+(.+?)(?:\s{2,}|$)/m),
    teamMembers,
    inspectionDate: firstMatch(p1, /Inspection Date:\s+([\d/]+)/),
    inspectionTypes: firstMatch(p1, /Inspection Type\(s\):\s+(.+)$/m),
    facilityCarried: firstMatch(p1, /\(7\) Facility Carried:\s+(.+)$/m),
    featureIntersected: firstMatch(p1, /\(6\) Crossing:\s+(.+)$/m) || f("006"),
    latitude: firstMatch(p1, /\(16\) Latitude:\s+(-?[\d.]+)/),
    longitude: firstMatch(p1, /\(17\) Longitude:\s+(-?[\d.]+)/),
    district: f("002"),
    county: f("003"),
    owner: f("022"),
    yearBuilt: f("027"),
    yearReconstructed: f("106"),
    location: f("009"),
    weather: f("weather_during_inspection"),
    temperatureF: f("temperature_during_inspection_f"),
  };
}

// ─── "(NNN) Label [B.X.NN]: value" fields ────────────────────────────────────

interface LabelSpan {
  item: string;
  label: string;
  snbi?: string;
  start: number;
  end: number; // index just after the label (and its colon)
}

// Numbered label: "(058) Deck Structure Condition [B.C.01]:". The label text may
// not span a column gap (2+ spaces). Two shapes:
//   - bracket form: label + "[B.X.NN]" (+ optional colon). The template drops the
//     colon on a few rows and leaves one bracket unclosed ("[B.AP.01"), and one
//     label carries an inner colon ("Traffic Status: County [B.PS.01]:").
//   - colon form: label + ":".
const LABEL_TEXT = "[A-Z0-9#](?:[^\\[\\]\\s]|\\s(?!\\s))*?";
const NUMBERED_LABEL_RE = new RegExp(
  `\\((\\d{2,3}[A-Z]?|SBI)\\)\\s+(?:` +
    // bracket form: "Deck Structure Condition [B.C.01]:" / "[B.AP.01" (unclosed)
    `(${LABEL_TEXT})\\s*\\[([^\\]]*?)(?:\\]|(?=\\s{2,}|$))\\s*:?` +
    // colon form: "Scour Condition:"
    `|(${LABEL_TEXT.replace("[^\\[\\]\\s]", "[^\\[\\]\\s:]")}):` +
    // unit-suffix form with no colon: "Max Water Depth at Bent (ft)"
    `|(${LABEL_TEXT.replace("[^\\[\\]\\s]", "[^\\[\\]\\s:]")}\\([a-z°A-Z/]{1,6}\\))(?=\\s{2,}|$)` +
    `)(?=\\s|$)`,
  "g"
);

// Unnumbered label: "Weather During Inspection:", "Team Members:", "Max Fill (ft):"
const UNNUMBERED_LABEL_RE = /(?:^|(?<=\s{2}))([A-Z](?:[A-Za-z0-9'’()\/°%.&-]|\s(?!\s)){2,70}?):(?=\s|$)/g;

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[°]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function findLabels(line: string): LabelSpan[] {
  const spans: LabelSpan[] = [];
  NUMBERED_LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBERED_LABEL_RE.exec(line))) {
    const [, item, bracketLabel, snbi, colonLabel, unitLabel] = m;
    const label = (bracketLabel ?? colonLabel ?? unitLabel ?? "").trim();
    spans.push({ item, label, snbi: snbi?.trim() || undefined, start: m.index, end: m.index + m[0].length });
  }
  UNNUMBERED_LABEL_RE.lastIndex = 0;
  while ((m = UNNUMBERED_LABEL_RE.exec(line))) {
    const start = m.index + (m[0].length - m[1].length - 1);
    const end = m.index + m[0].length;
    if (spans.some((s) => start < s.end && end > s.start)) continue;
    const label = m[1].trim();
    if (/^(Inspection Type|Freq|Last Insp|Next Insp|Photo \d+|Notes|Name|Hours|Cost|Done|Details)$/.test(label)) continue;
    spans.push({ item: slug(label), label, start, end });
  }
  return spans.sort((a, b) => a.start - b.start);
}

const FIELD_SECTIONS_END = /^ELEMENT CONDITION SUMMARY$/;
const FIELD_SECTIONS_RESUME = /^SCOUR AND WATERWAY$/;
const FIELD_SECTIONS_STOP = /^JOINT$|^BEARINGS$|^PILES$/;

/** Does a stray value look like it belongs under this label? (Used only to break ties.) */
function valueFitsLabel(label: string, value: string): boolean {
  // Sub-headings that sit between field rows ("40T Combination Posting", "R-12-6-48 Legal Load Posting and Sign Posted Values")
  if (/\bposting\b|sign posted values/i.test(value)) return false;
  // Sentences and table words are never field values.
  if (value.length > 60 || /\.$/.test(value)) return false;
  if (INSPECTION_TYPES.includes(value)) return false;
  if (/\bdate\b/i.test(label)) return /\d{1,2}\/\d{1,2}\/\d{2,4}|^\d{4}$|^\d{1,2}\/\d{4}$/.test(value);
  if (
    /\((ft|in|tons|°F|mi)\)|\bwidth\b|\blength\b|\barea\b|\bskew\b|\bheight\b|\bADT\b|\blanes\b|%|latitude|longitude|\brating\b|\bfactor\b|\bspeed\b|clearance|mile ?post|detour|\bspans\b|beam lines|temperature|frequency|depth|\bcost\b|\bhours\b|\bbin\b|\byear\b/i.test(
      label
    )
  ) {
    return /^-?[\d.,]/.test(value) || /^N\b/.test(value);
  }
  return true;
}

interface LabelLine {
  kind: "labels";
  labels: LabelSpan[];
  values: (string | null)[]; // null = empty, awaiting a stray value
  prefix: string[]; // cells before the first label
}
interface OrphanLine {
  kind: "orphans";
  cells: string[];
}
type FieldLine = LabelLine | OrphanLine | { kind: "heading" };

/**
 * Harvest every "(NNN) Label: value" pair from the inventory pages.
 *
 * Stray values: the row bucketing sometimes separates a value from its label,
 * leaving a value-only line directly above or below the label line (which
 * side depends on the block). A stray line is attached to the empty labels of
 * the adjacent label line that fits best: the value must look right for the
 * label (dates, numbers, codes), an equal count of strays and empties wins,
 * and otherwise the column that was patched most recently in the block is
 * preferred. Anything still ambiguous is reported in `warnings`.
 */
export function parseFields(body: string[]): { fields: Record<string, ScdotField>; warnings: string[] } {
  const fields: Record<string, ScdotField> = {};
  const warnings: string[] = [];

  // Pass 1: classify lines inside the field sections.
  const lines: FieldLine[] = [];
  let active = true;
  for (const line of body) {
    if (FIELD_SECTIONS_END.test(line)) active = false;
    else if (FIELD_SECTIONS_RESUME.test(line)) active = true;
    else if (FIELD_SECTIONS_STOP.test(line)) active = false;
    if (!active) continue;
    if (isSectionHeading(line)) {
      lines.push({ kind: "heading" });
      continue;
    }
    const labels = findLabels(line);
    if (labels.length === 0) {
      lines.push({ kind: "orphans", cells: splitCells(line) });
      continue;
    }
    const prefix = line.slice(0, labels[0].start).trim();
    const values = labels.map((span, idx) => {
      const next = labels[idx + 1];
      const raw = line.slice(span.end, next ? next.start : undefined).trim();
      // Only the first cell is the value; later cells are chart ticks or an
      // unlabeled neighbouring column ("10.0  2022  2024").
      return raw ? splitCells(raw)[0] : null;
    });
    lines.push({ kind: "labels", labels, values, prefix: prefix ? splitCells(prefix) : [] });
  }

  // Pass 2: attach stray values.
  let lastCol = -1;
  const labelLineAt = (i: number): LabelLine | null => (lines[i]?.kind === "labels" ? (lines[i] as LabelLine) : null);
  const empties = (ll: LabelLine | null) =>
    ll ? ll.labels.map((l, idx) => ({ ll, idx, label: l })).filter((e) => ll.values[e.idx] === null) : [];

  const attach = (strays: string[], candidates: { ll: LabelLine; idx: number; label: LabelSpan }[], where: string) => {
    if (strays.length === 0 || candidates.length === 0) return;
    let pool = [...candidates];
    // Same count and every value fits its column: zip in order.
    if (strays.length === pool.length && strays.every((v, k) => valueFitsLabel(pool[k].label.label, v))) {
      strays.forEach((v, k) => {
        pool[k].ll.values[pool[k].idx] = v;
        lastCol = pool[k].idx;
      });
      return;
    }
    for (const v of strays) {
      const pick = pool.filter((c) => valueFitsLabel(c.label.label, v));
      if (pick.length === 0) {
        // Most likely a sub-heading or chart tick, not a value; only flag things that look like data.
        if (/\d/.test(v) && v.length <= 40 && !/posting|values$/i.test(v)) {
          warnings.push(`Stray value "${v}" near "${where}" could not be attached to a field`);
        }
        continue;
      }
      // No column history yet: the right-hand column is the one that drifts in this template.
      const preferred = pick.find((c) => c.idx === lastCol) || pick[pick.length - 1];
      if (pick.length > 1 && !pick.some((c) => c.idx === lastCol)) {
        warnings.push(`Stray value "${v}" attached to "${preferred.label.label}" (ambiguous near "${where}")`);
      }
      preferred.ll.values[preferred.idx] = v;
      lastCol = preferred.idx;
      pool = pool.filter((c) => c !== preferred);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (cur.kind === "heading") {
      lastCol = -1;
      continue;
    }
    if (cur.kind === "labels") {
      if (cur.prefix.length) {
        const own = empties(cur);
        const below = empties(labelLineAt(i + 1));
        attach(cur.prefix, own.length ? own : below, cur.labels[0].label);
      }
      continue;
    }
    // orphan line: try the adjacent label lines above and below
    const above = i > 0 ? empties(labelLineAt(i - 1)) : [];
    const below = empties(labelLineAt(i + 1));
    const fits = (cands: typeof above) => cands.filter((c) => cur.cells.some((v) => valueFitsLabel(c.label.label, v)));
    const aboveFit = fits(above);
    const belowFit = fits(below);
    const where = (above[0] || below[0])?.label.label ?? "?";
    const n = cur.cells.length;
    if (aboveFit.length === 0 && belowFit.length === 0) {
      // chart ticks, table rows, sub-headings — nothing to attach to
    } else if (aboveFit.length === 0) attach(cur.cells, below, where);
    else if (belowFit.length === 0) attach(cur.cells, above, where);
    else {
      // Both sides plausible. Prefer the side that continues the column being
      // patched in this block, then an exact count match, then "value precedes
      // label" (the common case in this template).
      const aboveHasCol = aboveFit.some((c) => c.idx === lastCol);
      const belowHasCol = belowFit.some((c) => c.idx === lastCol);
      if (aboveHasCol && !belowHasCol) attach(cur.cells, above, where);
      else if (belowHasCol && !aboveHasCol) attach(cur.cells, below, where);
      else if (aboveFit.length === n && belowFit.length !== n) attach(cur.cells, above, where);
      else if (belowFit.length === n && aboveFit.length !== n) attach(cur.cells, below, where);
      else attach(cur.cells, below, where);
    }
    // No empties nearby: chart ticks, table rows, notes — ignore.
  }

  for (const ll of lines) {
    if (ll.kind !== "labels") continue;
    ll.labels.forEach((span, idx) => {
      const v = (ll.values[idx] ?? "").replace(/\s{2,}/g, " ").trim();
      // The template reuses a few item numbers for different labels ((631) Scour
      // Condition Rating vs (631) Nav. Channel Min. Horiz. Clearance); keep both.
      let key = span.item === "SBI" ? `SBI_${slug(span.label)}` : span.item;
      if (fields[key] && fields[key].label !== span.label) key = `${span.item}_${slug(span.label)}`;
      const existing = fields[key];
      if (!existing || (!existing.value && v)) {
        fields[key] = { item: key, label: span.label, snbi: span.snbi, value: v };
      }
    });
  }
  return { fields, warnings };
}

/** "7 Minor Deterioration" → { code: "7", text: "Minor Deterioration" }; "N N/A (NBI)" → { code: "N", … } */
export function splitCodedValue(value: string): { code: string; text: string } {
  const m = value.match(/^([0-9]|N)(?:\s+(?:-\s*)?(.*)|$)/);
  if (!m) return { code: "", text: value };
  return { code: m[1], text: (m[2] || "").trim() };
}

// ─── Inspection frequency table ──────────────────────────────────────────────

const INSPECTION_TYPES = [
  "Routine",
  "NSTM (A)",
  "Underwater (B)",
  "Special (C)",
  "Other Routine",
  "Complex Other",
  "Damage",
  "Load Rating",
];

export function parseFrequencies(body: string[]): ScdotFrequency[] {
  const start = body.findIndex((l) => l === "INSPECTION");
  if (start < 0) return [];
  const end = body.findIndex((l, i) => i > start && /^LOAD RATING AND POSTING$/.test(l));
  const block = body.slice(start, end < 0 ? start + 40 : end);
  const out: ScdotFrequency[] = [];
  for (let i = 0; i < block.length; i++) {
    for (const t of INSPECTION_TYPES) {
      const escaped = t.replace(/[()]/g, "\\$&");
      if (!new RegExp(`(?:^|\\s{2,})${escaped}$`).test(block[i])) continue;
      const next = block[i + 1] || "";
      const m = next.match(/^(\d+)\s{2,}([\d/]+)\s{2,}([\d/]+)$/);
      if (m) out.push({ inspectionType: t, frequencyMonths: m[1], lastInspection: m[2], nextInspection: m[3] });
    }
  }
  return out;
}

// ─── Element notes ───────────────────────────────────────────────────────────

const ELEMENT_ROW_RE =
  /^(\d{1,4})\/(\d)\s+(?:(.+?)\s{2,})?([\d,]+)\s{2,}(?:([^\d\s,]\S*)\s{2,})?([\d,]+)\s{2,}([\d,]+)\s{2,}([\d,]+)\s{2,}([\d,]+)$/;
const UNIT_ONLY_RE = /^(ft²|ft2|sq ft|ft|each|ea|lf)$/i;
const TAG_RE = /\[([^\[\]]*\bCS\s*[1-4]\b[^\[\]]*)\]/g;
const NOTES_CHROME_RE = /^ELEM\/ENV\b|^ELEMENT NAME$/;

function toInt(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}

export function normalizeUnit(raw: string): string {
  const u = raw.toLowerCase().replace(/\.$/, "");
  if (u === "ft²" || u === "ft2" || u === "sq ft" || u === "sqft" || u === "sf") return "sq ft";
  if (u === "each" || u === "ea") return "ea";
  if (u === "ft" || u === "lf" || u === "ln ft") return "ft";
  return raw;
}

/**
 * Parse one tag body ("1130, CS2, Q3", "3220, CS2, Q2415 and 3220, CS3, Q2415",
 * "1080, CS2, Q200 & CS3, Q40", "1080, CS2 Q20", "CS4, Q3") into (code, cs, qty)
 * triples. Returns [] when nothing usable is found.
 */
export function parseTag(body: string): { defectCode?: string; cs: 1 | 2 | 3 | 4; qty: number }[] {
  const tokens = body.split(/\s*(?:,|&|\band\b|;)\s*|\s+(?=Q\d|CS\s*\d)/i).map((t) => t.trim()).filter(Boolean);
  const out: { defectCode?: string; cs: 1 | 2 | 3 | 4; qty: number }[] = [];
  let code: string | undefined;
  let cs: 1 | 2 | 3 | 4 | undefined;
  for (const tok of tokens) {
    let m: RegExpMatchArray | null;
    if ((m = tok.match(/^(\d{3,4})$/))) {
      code = m[1];
    } else if ((m = tok.match(/^CS\s*([1-4])$/i))) {
      cs = Number(m[1]) as 1 | 2 | 3 | 4;
    } else if ((m = tok.match(/^Q\s*([\d,]+(?:\.\d+)?)$/i))) {
      if (cs) {
        out.push({ defectCode: code, cs, qty: parseFloat(m[1].replace(/,/g, "")) });
        cs = undefined;
      }
    }
  }
  return out;
}

function extractSize(text: string): string {
  const parens = text.match(/\(([^()]*)\)/g) || [];
  for (const p of parens) {
    const inner = p.slice(1, -1);
    if (/\d/.test(inner) && /\bx\b|\b(?:high|deep|wide|long|thick|diameter|dia|L|W|H|D|FH|FW)\b|%/.test(inner)) return inner;
  }
  return "";
}

function extractLocation(text: string): string {
  const head = text.split(",")[0].trim();
  return head.length <= 60 ? head : "";
}

export function parseElementNotes(body: string[]): { elements: ScdotElementRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const start = body.findIndex((l) => l === "ELEMENT NOTES");
  if (start < 0) return { elements: [], warnings: ["ELEMENT NOTES section not found"] };
  let end = body.findIndex((l, i) => i > start && /^SECTION 4:/.test(l));
  if (end < 0) end = body.length;

  // Re-join tags that wrapped across two lines: "… [1080,"  +  "CS2, Q200 & CS3, Q40]".
  const raw = body.slice(start + 1, end).filter((l) => !NOTES_CHROME_RE.test(l));
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    if (/\[[^\]]*$/.test(line) && i + 1 < raw.length && /^[^\[]*\]/.test(raw[i + 1])) {
      line = `${line} ${raw[i + 1]}`;
      i++;
    }
    lines.push(line);
  }

  const elements: ScdotElementRow[] = [];
  let parent: ScdotElementRow | null = null;
  let current: ScdotElementRow | null = null;
  let contextStack: string[] = [];
  let pendingText: string[] = []; // untagged sentence fragments awaiting a tag or a full stop
  let absorbInto: ScdotDefectNote[] | null = null; // tag line ended with ":" → following lines are its location list

  const flushPending = () => {
    if (pendingText.length && parent) parent.notes.push(pendingText.join(" "));
    pendingText = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row = line.match(ELEMENT_ROW_RE);
    if (row) {
      flushPending();
      absorbInto = null;
      const [, id, env, name, qty, unitTok, c1, c2, c3, c4] = row;
      // The unit column is occasionally bucketed onto its own line just above the row.
      const unit = unitTok || (i > 0 && UNIT_ONLY_RE.test(lines[i - 1]) ? lines[i - 1].trim() : "");
      let elementName = (name || "").trim();
      // Name split onto the next line by row bucketing ("234/3  588  ft  …" / "Re Conc Pier Cap").
      if (!elementName && i + 1 < lines.length && !ELEMENT_ROW_RE.test(lines[i + 1]) && !/\[|\.$/.test(lines[i + 1])) {
        elementName = lines[i + 1].trim();
        i++;
      }
      const el: ScdotElementRow = {
        elementId: id,
        environment: env,
        name: elementName,
        totalQty: toInt(qty),
        unit: normalizeUnit(unit),
        rawUnit: unit,
        cs: [toInt(c1), toInt(c2), toInt(c3), toInt(c4)],
        isDefect: id.length >= 4,
        notes: [],
        defects: [],
      };
      elements.push(el);
      current = el;
      if (!el.isDefect) {
        parent = el;
        contextStack = [];
      }
      continue;
    }
    if (!current || !parent) continue;
    if (UNIT_ONLY_RE.test(line)) continue; // stray unit cell belonging to the next row

    TAG_RE.lastIndex = 0;
    const tags = Array.from(line.matchAll(TAG_RE));
    if (tags.length === 0) {
      // Location lists after "… at the following locations [tag]:" are short
      // items ("BM1-5 at BT 2"); a long line is the next paragraph starting.
      if (absorbInto && line.length <= 60 && !/\.$/.test(line) && !/:$/.test(line)) {
        for (const d of absorbInto) d.text = `${d.text} ${line.trim()}`;
        continue;
      }
      absorbInto = null;
      // Sub-heading such as "Top of Deck:", "Span 10:", "At BT 10:"
      if (/^[^.]{1,50}:$/.test(line)) {
        flushPending();
        const label = line.slice(0, -1).trim();
        // Nested headings: a "Span 10:" resets deeper "At BT 10:" contexts.
        if (/^(span|bent|bt|pier|abut|end bent|barrel|top|underside|bottom|north|south|east|west)/i.test(label) && contextStack.length > 1) {
          contextStack = [contextStack[0]];
        }
        if (contextStack.length >= 2) contextStack = [contextStack[0]];
        contextStack.push(label);
        parent.notes.push(line);
        continue;
      }
      if (/[.)]$/.test(line)) {
        pendingText.push(line.trim());
        flushPending();
      } else {
        pendingText.push(line.trim());
      }
      continue;
    }

    // Tagged defect sentence(s)
    const text = [...pendingText, line.replace(TAG_RE, "").replace(/\s{2,}/g, " ").replace(/\s+([.:])/g, "$1").trim()]
      .join(" ")
      .trim();
    pendingText = [];
    const created: ScdotDefectNote[] = [];
    for (const t of tags) {
      const triples = parseTag(t[1]);
      if (triples.length === 0) {
        warnings.push(`Element ${parent.elementId}: could not read tag "[${t[1]}]"`);
        continue;
      }
      for (const tr of triples) {
        const note: ScdotDefectNote = {
          parentElementId: parent.elementId,
          defectCode: tr.defectCode,
          cs: tr.cs,
          qty: tr.qty,
          text: text.replace(/:$/, "").trim(),
          location: extractLocation(text),
          size: extractSize(text),
          context: contextStack.join(" › "),
          rawTag: `[${t[1]}]`,
        };
        parent.defects.push(note);
        created.push(note);
      }
    }
    absorbInto = /:\s*$/.test(line) || /\]\s*:$/.test(line) ? created : null;
  }
  flushPending();

  // Roll-up check: tag quantities per (defect, CS) should equal the defect row.
  for (const row of elements.filter((e) => e.isDefect)) {
    const p = [...elements].reverse().find((e) => !e.isDefect && elements.indexOf(e) < elements.indexOf(row));
    if (!p) continue;
    const tagged = p.defects.filter((d) => d.defectCode === row.elementId);
    if (tagged.length === 0) {
      if (row.cs.some((q, idx) => idx > 0 && q > 0)) {
        warnings.push(`Element ${p.elementId}: defect ${row.elementId} (${row.name}) has quantities but no tagged notes`);
      }
      continue;
    }
    const sums = [0, 0, 0, 0];
    for (const d of tagged) sums[d.cs - 1] += d.qty;
    const rounded = sums.map((s) => Math.round(s));
    if (rounded.some((s, idx) => s !== row.cs[idx])) {
      warnings.push(
        `Element ${p.elementId}: tagged quantities for ${row.elementId} (${row.name}) are CS ${rounded.join("/")} but the row says ${row.cs.join("/")}`
      );
    }
  }

  return { elements, warnings };
}

// ─── Section 4: non-element notes ────────────────────────────────────────────

export function parseSectionNotes(body: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const start = body.findIndex((l) => /^SECTION 4:/.test(l));
  if (start < 0) return out;
  let end = body.findIndex((l, i) => i > start && l === "INSPECTION PHOTOS");
  if (end < 0) end = body.findIndex((l, i) => i > start && l === "INSPECTION SKETCHES");
  if (end < 0) end = body.length;
  let key = "";
  for (const line of body.slice(start + 1, end)) {
    if ((SCDOT_SECTION4_HEADINGS as readonly string[]).includes(line) || MAINTENANCE_SUMMARY_HEADING.test(line)) {
      key = MAINTENANCE_SUMMARY_HEADING.test(line) ? "Summary of Previously Performed Maintenance Work" : line;
      if (!out[key]) out[key] = [];
      continue;
    }
    if (!key) continue;
    out[key].push(line);
  }
  return out;
}

// ─── Photos ──────────────────────────────────────────────────────────────────

export function parsePhotos(body: string[]): { photos: ScdotPhoto[]; warnings: string[] } {
  const warnings: string[] = [];
  const start = body.findIndex((l) => l === "INSPECTION PHOTOS");
  if (start < 0) return { photos: [], warnings };
  let end = body.findIndex((l, i) => i > start && /^(INSPECTION SKETCHES|STREAMBED CROSS SECTIONS|SCOUR AND WATERWAY)$/.test(l));
  if (end < 0) end = body.length;

  const captions = new Map<number, string[]>();
  let slots: number[] = [];
  for (const line of body.slice(start + 1, end)) {
    const heads = Array.from(line.matchAll(/Photo (\d+):/g)).map((m) => Number(m[1]));
    if (heads.length > 0 && /^Photo \d+:(\s{2,}Photo \d+:)?$/.test(line)) {
      slots = heads;
      for (const n of slots) if (!captions.has(n)) captions.set(n, []);
      continue;
    }
    if (slots.length === 0) continue;
    const cells = splitCells(line);
    if (slots.length === 2 && cells.length >= 2) {
      captions.get(slots[0])!.push(cells[0]);
      captions.get(slots[1])!.push(cells.slice(1).join(" "));
    } else if (slots.length === 2) {
      // Only one column wrapped. Give the fragment to the caption that is not
      // yet a finished sentence; if both/neither qualify, keep it with the right column.
      const left = captions.get(slots[0])!;
      const right = captions.get(slots[1])!;
      const unfinished = (c: string[]) => c.length > 0 && !/[.)]$/.test(c[c.length - 1]);
      if (unfinished(left) && !unfinished(right)) left.push(cells[0]);
      else if (unfinished(right) && !unfinished(left)) right.push(cells[0]);
      else {
        right.push(cells[0]);
        warnings.push(`Photo ${slots[1]}: wrapped caption fragment "${cells[0]}" could not be attributed reliably`);
      }
    } else {
      captions.get(slots[0])!.push(cells.join(" "));
    }
  }
  const photos = Array.from(captions.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([number, parts]) => ({ number, caption: parts.join(" ").replace(/\s{2,}/g, " ").trim() }));
  return { photos, warnings };
}

// ─── Streambed cross sections ────────────────────────────────────────────────

const STREAMBED_LABELS: [keyof Omit<ScdotStreambedSection, "rows">, RegExp][] = [
  ["orientation", /Orientation:/],
  ["offsetRemark", /Offset Remark:/],
  ["elevBasis", /Elev Basis:/],
  ["waterSurface", /Water Surface:/],
  ["sndElevInd", /SND\/ELEV Ind\.:/],
  ["soundingDate", /Snding Date:/],
  ["bmLocation", /Location of BM:/],
  ["offset", /\bOffset:/],
];

export function parseStreambed(body: string[]): ScdotStreambedSection[] {
  const sections: ScdotStreambedSection[] = [];
  let cur: ScdotStreambedSection | null = null;
  let strays: string[] = []; // header values bucketed onto the line above their labels
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (line === "STREAMBED CROSS SECTIONS") {
      cur = { orientation: "", offsetRemark: "", elevBasis: "", waterSurface: "", sndElevInd: "", soundingDate: "", bmLocation: "", offset: "", rows: [] };
      sections.push(cur);
      strays = [];
      continue;
    }
    if (!cur) continue;
    if (/^(SCOUR AND WATERWAY|INSPECTION PHOTOS|BRIDGE MAINTENANCE OFFICE FIELDS)$/.test(line)) {
      cur = null;
      continue;
    }
    const row = line.match(/^(\d+\s*\+\s*-?[\d.]+)\s{2,}(-?[\d.]+)(?:\s{2,}(.*))?$/);
    if (row) {
      cur.rows.push({ station: row[1].replace(/\s+/g, " "), elevation: row[2], remark: (row[3] || "").trim() });
      continue;
    }
    // Header rows carry up to two "Label:  value" pairs.
    const hits = STREAMBED_LABELS.map(([key, re]) => ({ key, m: re.exec(line) })).filter((h) => h.m).sort((a, b) => a.m!.index - b.m!.index);
    if (hits.length > 0) {
      const values = hits.map((h, idx) => {
        const from = h.m!.index + h.m![0].length;
        const to = idx + 1 < hits.length ? hits[idx + 1].m!.index : line.length;
        return line.slice(from, to).trim();
      });
      // "Right View  11/2024" above "Orientation:  Snding Date:" — zip the stray cells in.
      if (values.every((v) => !v) && strays.length === hits.length) {
        strays.forEach((v, k) => (values[k] = v));
      }
      hits.forEach((h, idx) => {
        cur![h.key] = values[idx];
      });
      strays = [];
      continue;
    }
    if (/^(Streambed Details|Stations\s)/.test(line)) {
      strays = [];
      continue;
    }
    strays = splitCells(line);
  }
  return sections;
}

// ─── Procedures, equipment, sign-off ─────────────────────────────────────────

export function parseProcedures(body: string[]): { procedures: ScdotProcedure[]; procedureNotes: string } {
  const start = body.findIndex((l) => l === "PROCEDURES FOR THIS INSPECTION");
  if (start < 0) return { procedures: [], procedureNotes: "" };
  let notesIdx = body.findIndex((l, i) => i > start && l === "Inspector Procedure Notes");
  let end = body.findIndex((l, i) => i > start && l === "EQUIPMENT USED IN THIS INSPECTION");
  if (end < 0) end = body.length;
  if (notesIdx < 0) notesIdx = end;

  const procedures: ScdotProcedure[] = [];
  const join = (a: string, b: string) => (a ? `${a} ${b}` : b).replace(/\s{2,}/g, " ").trim();
  for (const line of body.slice(start + 1, notesIdx)) {
    if (/^Done\s{2,}Insp Type/.test(line)) continue;
    const m = line.match(/^([A-Z])\s{2,}(\S+(?: \S+)?)\s{2,}([^\s].*?\))\s{2,}(.*)$/);
    if (m) {
      const cells = splitCells(m[4]);
      procedures.push({ done: m[1], inspType: m[2], procedureType: m[3], name: cells[0] || "", details: cells.slice(1).join(" ") });
    } else if (procedures.length > 0) {
      // Name and Details are side-by-side columns that both wrap; a two-cell
      // continuation carries a fragment of each, a one-cell line is details only.
      const last = procedures[procedures.length - 1];
      const cells = splitCells(line);
      if (cells.length >= 2) {
        last.name = join(last.name, cells[0]);
        last.details = join(last.details, cells.slice(1).join(" "));
      } else if (cells.length === 1) {
        last.details = join(last.details, cells[0]);
      }
    }
  }
  const procedureNotes = body.slice(notesIdx + 1, end).join(" ").trim();
  return { procedures, procedureNotes };
}

export function parseEquipment(body: string[]): { equipment: ScdotEquipment[]; equipmentNotes: string } {
  const start = body.findIndex((l) => l === "EQUIPMENT USED IN THIS INSPECTION");
  if (start < 0) return { equipment: [], equipmentNotes: "" };
  let notesIdx = body.findIndex((l, i) => i > start && l === "Inspector Equipment Notes");
  let end = body.findIndex((l, i) => i > start && l === "INSPECTOR SIGNATURE AND QC/QA INFORMATION");
  if (end < 0) end = body.length;
  if (notesIdx < 0) notesIdx = end;
  const equipment: ScdotEquipment[] = [];
  for (const line of body.slice(start + 1, notesIdx)) {
    if (/^Name\s{2,}Hours/.test(line)) continue;
    const m = line.match(/^(.+?)\s{2,}([\d.]+)\s{2,}([\d.]+)$/);
    if (m) equipment.push({ name: m[1].trim(), hours: m[2], cost: m[3] });
  }
  return { equipment, equipmentNotes: body.slice(notesIdx + 1, end).join(" ").trim() };
}

export function parseSignoff(body: string[]): ScdotSignoff {
  const out: ScdotSignoff = { inspectedBy: "", date: "", qcReviewedBy: "", qcCompleted: "", qaReviewedBy: "", qaCompleted: "" };
  const start = body.findIndex((l) => l === "INSPECTOR SIGNATURE AND QC/QA INFORMATION");
  if (start < 0) return out;
  for (const line of body.slice(start + 1, start + 12)) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^INSPECTED BY\s{2,}(.+)$/))) out.inspectedBy = m[1].trim();
    else if ((m = line.match(/^Date\s{2,}([\d/]+)$/))) out.date = m[1];
    else if ((m = line.match(/^QC Reviewed By:\s*(.*?)\s{2,}QC Completed:\s*(.*)$/))) {
      out.qcReviewedBy = m[1].trim();
      out.qcCompleted = m[2].trim();
    } else if ((m = line.match(/^QA Reviewed By:\s*(.*?)\s{2,}QA Completed:\s*(.*)$/))) {
      out.qaReviewedBy = m[1].trim();
      out.qaCompleted = m[2].trim();
    }
  }
  return out;
}

// ─── Top level ───────────────────────────────────────────────────────────────

export function parseScdotReport(pages: string[][]): ParsedScdotReport {
  const all = pages.flat();
  const templateVersion = firstMatch(all.join("\n"), /^Bridge Inspection Report \((v\d+, [\d/]+)\)/m);
  const body = scdotBodyLines(pages);

  const { fields, warnings: fieldWarnings } = parseFields(body);
  const header = parseScdotHeader(pages, fields);
  const frequencies = parseFrequencies(body);
  const { elements, warnings: elementWarnings } = parseElementNotes(body);
  const sectionNotes = parseSectionNotes(body);
  const { photos, warnings: photoWarnings } = parsePhotos(body);
  const streambed = parseStreambed(body);
  const { procedures, procedureNotes } = parseProcedures(body);
  const { equipment, equipmentNotes } = parseEquipment(body);
  const signoff = parseSignoff(body);

  return {
    templateVersion,
    header,
    fields,
    frequencies,
    elements,
    sectionNotes,
    photos,
    streambed,
    procedures,
    procedureNotes,
    equipment,
    equipmentNotes,
    signoff,
    warnings: [...fieldWarnings, ...elementWarnings, ...photoWarnings],
  };
}
