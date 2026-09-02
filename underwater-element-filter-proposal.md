# Underwater Element Filtering Proposal

## Purpose

Use this document as a review brief for Claude before updating the Git working tree. The goal is to make the Elements picker match how SCDOT underwater inspection reports organize bridge components, without removing the inspector's ability to reach an uncommon element.

This is a proposal only. It does not authorize implementation changes until the behavior and scope have been reviewed.

## Evidence reviewed

The following attached SCDOT underwater reports were reviewed:

- `attached_assets/237-InspectReport_UW-2024-09-19-001_1788353108761.pdf`
- `attached_assets/2753-InspectReport_UW-2025-02-21-001_1788353108761.pdf`
- `attached_assets/9697-InspectReport_UW-2025-10-07-001_1788353108762.pdf`

The reports contain both underwater findings and ordinary bridge elements carried into the full inspection report. An element appearing in an Underwater report does not necessarily mean it belongs in the default underwater picker.

## Proposed user-facing behavior

### Topside assignment

When Topside is selected at the top of the screen:

- Default to topside-relevant elements.
- Include applicable decks/slabs, wearing surfaces, railings, and joints.
- Preserve Search and All as ways to reach an uncommon element.

### Underside assignment

When Underside is selected:

- Default to underside structural elements.
- Include superstructure members, substructure members, bearings, culverts, and relevant protective systems.
- Keep applicable deck/slab and top-flange elements available because SCDOT reports record underside-of-deck findings against those same elements.
- Do not show topside-only items by default unless they apply to the location or are reached through All/Search.

### Underwater assignment

When Underwater is selected:

- Default to the underwater set plus the applicable underside set.
- Base the underwater set on component families, not only the exact element IDs present in the three sample reports.
- Prioritize submerged or waterline structural components and foundations.

The underwater default set should include all applicable material variants of:

- Columns: steel, prestressed concrete, reinforced concrete, timber, and other
- Pier walls
- Abutments
- Pile caps and footings
- Piles: steel, steel pipe, reinforced concrete, timber, and other
- Pier caps
- Culverts: steel, reinforced concrete, prestressed concrete, timber, masonry, and other

The applicable underside set should include:

- Girders and beams
- Stringers
- Trusses and arches
- Floor beams
- Pin-and-hanger assemblies
- Gusset plates
- Bearings
- Steel protective coating
- Concrete reinforcing protective systems
- Applicable deck, slab, and top-flange elements when their underside can be inspected

## Elements demonstrated by the reports

The reports specifically demonstrate these element families:

- Reinforced concrete culvert — element 241
- Reinforced concrete deck — element 12
- Reinforced concrete top flange — element 16
- Steel open girder/beam — element 107
- Prestressed concrete open girder/beam — element 109
- Reinforced concrete open girder/beam — element 110
- Reinforced concrete column — element 205
- Reinforced concrete abutment — element 215
- Reinforced concrete pile cap/footing — element 220
- Timber pile — element 228
- Reinforced concrete pier cap — element 234
- Strip seal expansion joint — element 300
- Pourable joint seal — element 301
- Compression joint seal — element 302
- Elastomeric bearing — element 310
- Movable bearing — element 311
- Fixed bearing — element 313
- Reinforced concrete approach slab — element 321
- Wearing surface — element 510
- Steel protective coating — element 515
- Reinforced concrete bridge railing — element 331

The reports also show these underwater-relevant element/defect combinations:

- Columns with abrasion, spalling, exposed reinforcing, and scour
- Pile caps/footings with abrasion, scour, undermining, exposure, and voiding
- Timber piles exposed by scour
- Pier caps with sediment, debris, spalling, exposed reinforcing, and cracking
- Culverts with abrasion, cracking, spalling, exposed reinforcing, and scour
- Girders/beams with underside spalling, cracking, corrosion, section loss, and connection deterioration
- Bearings with coating failure and corrosion
- Underside decks/top flanges with cracking, abrasion, efflorescence, delamination, and spalling

## Scour and waterway handling

Scour, code 6000 in the SCDOT reports, should remain a defect that can be recorded against an applicable component. It should not become a standalone bridge element.

The following are underwater inspection information, but should not be element-picker entries:

- Water depth and waterline
- High-water line
- Streambed material
- Probe depth
- Debris and obstructions
- Channel protection
- Embankment erosion
- Footing exposure and undermining
- Scour evaluation
- Waterway adequacy
- Streambed cross-sections and soundings

These should remain in the appropriate channel, waterway, or underwater inspection workflow.

## All filter behavior

Keep All as an explicit escape hatch.

All should allow the inspector to reach elements outside the current Topside, Underside, or Underwater default grouping. It should continue respecting legitimate constraints such as:

- Current bridge location
- Applicable structure type
- Material compatibility

Search should continue to find uncommon elements by number or name, even when they are not in the default group.

Recommended behavior:

- All bypasses the zone restriction.
- The active shortlist remains a separate bridge-specific preference.
- Search remains an emergency path to the full catalog.

Claude should verify whether All is intended to bypass the active shortlist before implementing this behavior.

## Shortlist / Done behavior

The current control is not an inspection completion control.

Recommended interpretation:

- **Shortlist** enters active-element-list editing mode.
- In that mode, tapping an element adds or removes it from the bridge's active element list.
- Stars show which elements are active.
- **Done** exits shortlist-editing mode.

Consider renaming the control in a later usability pass to make this explicit, such as:

- `Edit shortlist` / `Finish shortlist`
- `Manage shortlist` / `Done`

Do not change Done to mean that a defect, element, or inspection is complete.

## Recommended implementation shape

Before editing, Claude should inspect the existing element catalog and filtering logic and preserve current location, structure-type, material, search, persistence, and active-shortlist behavior unless this proposal explicitly changes it.

Prefer one explicit classification model for element visibility, with support for:

- Topside membership
- Underside membership
- Underwater membership
- Elements intentionally belonging to more than one group, especially decks/slabs and top flanges
- Structure-specific applicability

Use element families and material variants so underwater inspections of steel, timber, prestressed-concrete, masonry, or other structures are not missing relevant components.

Do not infer underwater membership only from the three sample report IDs. The reports are examples, not an exhaustive catalog.

## Acceptance criteria

- Topside assignment defaults to topside-relevant elements.
- Underside assignment defaults to underside-relevant elements.
- Underwater assignment defaults to underwater substructure/foundation elements plus applicable underside elements.
- Deck and top-flange elements can be selected for underside findings.
- All remains visible and provides access to elements outside the default group.
- Search can find uncommon elements by ID or name.
- Shortlist remains a bridge-specific active-element list.
- Done only exits shortlist editing and does not mark inspection work complete.
- Scour remains available as a defect on relevant underwater elements rather than becoming a standalone element.
- Existing location, structure-type, material, persistence, and editing behavior are not regressed.
- Existing non-underwater and non-SCDOT workflows continue to work.

## Out of scope

- Redesigning the entire Elements screen
- Changing SNBI element IDs without a separate review
- Adding new underwater report pages
- Replacing the existing channel/waterway workflow
- Changing condition states or quantities
- Automatically importing every element appearing in an SCDOT report
- Changing PDF parsing or report export behavior

## Files to inspect first

- `artifacts/bridge-inspection/app/(tabs)/index.tsx`
- `artifacts/bridge-inspection/context/InspectionContext.tsx`
