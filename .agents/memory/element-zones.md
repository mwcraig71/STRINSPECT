---
name: Element zones (Topside / Underside / Underwater)
description: Where the Elements picker's zone membership lives and the culvert/underside rules; read before touching element filtering.
---

`utils/elementZones.ts` is the single classifier for which SNBI elements the
Elements picker and the shortlist editor show per zone. Never re-add literal
category lists in `InspectionContext.filteredElements` or `index.tsx`.

- Topside: Deck (incl. approach slabs), Railing, Joint, 510.
- Underside: Superstructure, Bearing, Substructure (or Culvert), 515/520, and
  Deck minus approach slabs — SCDOT reports record "Underside of Deck" findings
  against 12/16, so decks must stay reachable from below.
- Underwater: Substructure (or Culvert) only, every material variant (`core`
  is NOT applied); `includeUndersideUnderwater` (persisted) adds the Underside
  families. Structure type and material still narrow the substructure family.
- Culvert override: `culvertStructure` is derived (a Culvert element among
  saved defects, the shortlist, or the element being edited); when true the
  Culvert family replaces Substructure in Underside/Underwater. There is no
  culvert substructure type; do not add culverts to `SUBSTRUCTURE_TYPES`.
- Chip "All" means "follow inspectionType" (not "everything"); Search bypasses
  zone and shortlist; the shortlist is never bypassed by a chip.
- Scour (`scour`) was missing from `DEFECT_OVERRIDES` for 215–218/220 and is
  now present; the SCDOT parser maps tag 6000 → scour.

Tests: `utils/__tests__/elementZones.test.ts`.
