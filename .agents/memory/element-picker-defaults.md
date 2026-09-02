---
name: Element picker defaults
description: Preventing filtered element-list updates from overriding an inspector's explicit selection.
---

Once the inspector explicitly selects an element, preserve it even if it came from search and is outside the compact default list. Only choose a remembered or first-list default when no element is selected. A mode change must clear the old element and update the first valid location together before defaulting.

**Why:** The compact list intentionally omits non-core catalog items such as some material variants. Treating absence from that list as an invalid selection makes searched choices snap back. Separately, defaulting before a mode's location changes can select a Topside deck for Underside.

**How to apply:** Default-selection effects should return whenever an element already exists. Topside, Underside, or Underwater transitions should clear search/element/defect and set the mode's first location in the same state update cycle.