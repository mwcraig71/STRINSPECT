---
name: structure-number sync
description: How the bridge structure number stays consistent across CIF, Underclearance, and the global header in the bridge-inspection app
---

# Structure number is single-source-of-truth

The global `structureNumber` in `InspectionContext` is authoritative. CIF (`cifData.structureNumber`)
and Underclearance (`underclearanceData.structureNumber`) are mirrors of it, not independent fields.

**Why:** these forms all print the same physical bridge ID; if any could diverge, persisted/imported
records would silently disagree.

**How to apply:**
- Any new module that shows the structure number must edit it through `setStructureNumber`, never write
  its own copy directly. `setStructureNumber` updates global + CIF + UC and persists all of them.
- On load-on-mount hydration, when a persisted module payload also carries a structure number, override
  it with the global persisted value so a stale embedded value can't win.
