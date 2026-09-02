// Helpers for turning SCDOT tagged defect notes into app records. Pure so they
// can be unit-tested; the wiring lives in InspectionContext.importFromPdf.
import type { ScdotDefectNote } from "./scdotParser";

/**
 * Map the free-text location at the start of an SCDOT defect sentence onto the
 * station labels the app filters on ("Span 10", "Bent 2", "End Bent 1",
 * "Joint 5", "Abutment"). Anything else stays "Unassigned" so the inspector
 * assigns it; the full sentence is preserved in locationDesc regardless.
 */
export function scdotLocationLabel(location: string): string {
  const loc = location.trim();
  let m: RegExpMatchArray | null;
  if ((m = loc.match(/^(?:End Bent|EB)\s*(\d+)/i))) return `End Bent ${m[1]}`;
  if ((m = loc.match(/^(?:Bent|BT)\s*(\d+)/i))) return `Bent ${m[1]}`;
  if ((m = loc.match(/^Spans?\s*(\d+)\b(?!\s*[-–]\s*\d)/i))) return `Span ${m[1]}`;
  if ((m = loc.match(/^(?:Joint|JT)\s*(\d+)/i))) return `Joint ${m[1]}`;
  if (/^Abut/i.test(loc)) return "Abutment";
  if (/^(?:Pier)\s*(\d+)/i.test(loc)) return `Bent ${loc.match(/\d+/)![0]}`;
  return "Unassigned";
}

/** Human-readable description for a tagged note: sub-heading context + sentence. */
export function scdotNoteDescription(note: ScdotDefectNote): string {
  return note.context ? `${note.context} — ${note.text}` : note.text;
}
