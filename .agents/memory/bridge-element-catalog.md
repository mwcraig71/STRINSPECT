---
name: Bridge element catalog conventions
description: AASHTO element catalog rules for the bridge-inspection app — the 226/900 pile split and how core vs. search reachability works.
---

# Bridge element catalog (AASHTO MBEI 2019)

Source of truth: AASHTO Manual for Bridge Element Inspection, 2nd Ed. (2019). The
catalog lives in `SNBI_ELEMENTS` in `context/InspectionContext.tsx`.

## Pile numbering: 226 is standard, custom pile is 900
- AASHTO **226 = Prestressed Concrete Pile** (Concrete). Keep it standard.
- The custom TxDOT-style **Steel Pipe Pile** (with its dedicated remaining-section
  form, `SteelPipePileModal`) is the **agency-defined id "900"** — NOT 226.
- **Why:** the app originally overloaded 226 for the custom pile; the user chose to
  restore standard AASHTO numbering and move the custom one out.
- **How to apply:** the custom-form mount gates on `element?.id === "900"` (in
  `app/(tabs)/index.tsx`), and the `DEFECT_OVERRIDES` remaining-section entry is
  keyed "900". Don't reintroduce 226 as Steel Pipe Pile.

## core vs. search reachability
- `core: true` elements show in the location dropdown by default; everything else
  (the majority, including all culverts 240–245) is reachable **only via the
  in-dropdown search**, which scans the entire catalog regardless of location.
- `getFilteredElements` reduces the no-search browse list to core-only when any
  core elements exist, so adding a non-core element to a category browse list is a
  no-op for default browsing — it still appears via search.
- **Why:** declutters the common case while keeping the full ~90-element catalog
  available. There is no "Culvert" location type (locations are
  Span/Bent/Abutment/Approach/Joint), so culverts are intentionally search-only.
