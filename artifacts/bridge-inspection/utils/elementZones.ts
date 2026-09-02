// Element zone classification — the single source of truth for which SNBI
// elements the Elements picker shows for Topside, Underside and Underwater
// work. Both the picker (InspectionContext.filteredElements) and the shortlist
// editor (index.tsx shortlistElements) go through here; nothing else should
// hard-code category lists.
//
// Zones follow how SCDOT reports organise findings:
//   Topside    – riding surface, railings, joints, approach slabs.
//   Underside  – superstructure, bearings, substructure, culverts, protective
//                systems, and the decks/slabs/top flanges whose underside is
//                inspected from below ("Underside of Deck" notes in the reports).
//   Underwater – substructure and foundations (columns, pier walls, abutments,
//                pile caps/footings, piles, pier caps) or, on a culvert, the
//                culvert barrels. Underside families can be toggled in.
//
// Culvert override: a culvert structure has no other substructure elements, so
// when the structure is a culvert the Culvert elements replace the Substructure
// category in the Underside and Underwater zones; otherwise culverts stay out
// of the defaults and are reached through All or Search.

export type ElementZone = "Topside" | "Underside" | "Underwater";
export type ZoneFilter = "All" | ElementZone;

export const ZONE_FILTERS: readonly ZoneFilter[] = ["All", "Topside", "Underside", "Underwater"];

export interface ZoneElement {
  id: string;
  category: string;
}

export interface ZoneOptions {
  /** Underwater: also show the Underside families (superstructure, bearings, coatings, deck undersides). */
  includeUnderside: boolean;
  /** The structure is a culvert: Culvert elements replace the Substructure category. */
  culvertStructure: boolean;
}

export const DEFAULT_ZONE_OPTIONS: ZoneOptions = { includeUnderside: false, culvertStructure: false };

const APPROACH_SLAB_IDS = new Set(["320", "321"]);
const WEARING_SURFACE_ID = "510";
/** Category "Other" elements that belong with the underside/underwater structure. */
const PROTECTIVE_SYSTEM_IDS = new Set(["515", "520"]);

export function isTopsideElement(el: ZoneElement): boolean {
  return el.category === "Deck" || el.category === "Railing" || el.category === "Joint" || el.id === WEARING_SURFACE_ID;
}

function isSubstructureFamily(el: ZoneElement, opts: ZoneOptions): boolean {
  return opts.culvertStructure ? el.category === "Culvert" : el.category === "Substructure";
}

export function isUndersideElement(el: ZoneElement, opts: ZoneOptions = DEFAULT_ZONE_OPTIONS): boolean {
  if (el.category === "Superstructure" || el.category === "Bearing") return true;
  if (PROTECTIVE_SYSTEM_IDS.has(el.id)) return true;
  if (el.category === "Deck") return !APPROACH_SLAB_IDS.has(el.id);
  return isSubstructureFamily(el, opts);
}

export function isUnderwaterElement(el: ZoneElement, opts: ZoneOptions = DEFAULT_ZONE_OPTIONS): boolean {
  if (isSubstructureFamily(el, opts)) return true;
  return opts.includeUnderside && isUndersideElement(el, opts);
}

export function isInZone(el: ZoneElement, zone: ZoneFilter, opts: ZoneOptions = DEFAULT_ZONE_OPTIONS): boolean {
  switch (zone) {
    case "All":
      return true;
    case "Topside":
      return isTopsideElement(el);
    case "Underside":
      return isUndersideElement(el, opts);
    case "Underwater":
      return isUnderwaterElement(el, opts);
  }
}

/** The zone the picker should filter by: the chip when set, else the inspection type. */
export function effectiveZone(chip: ZoneFilter, inspectionType: string): ZoneFilter {
  if (chip !== "All") return chip;
  if (inspectionType === "Topside" || inspectionType === "Underside" || inspectionType === "Underwater") return inspectionType;
  return "All";
}

export function isZoneFilter(value: unknown): value is ZoneFilter {
  return typeof value === "string" && (ZONE_FILTERS as readonly string[]).includes(value);
}

/** Substructure/foundation first, then everything else — keeps the long Underwater list usable on a phone. */
export function sortForUnderwater<T extends ZoneElement>(list: readonly T[], opts: ZoneOptions): T[] {
  const rank = (el: T) => (isSubstructureFamily(el, opts) ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}
