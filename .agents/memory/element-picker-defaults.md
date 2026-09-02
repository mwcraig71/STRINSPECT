---
name: Element picker defaults
description: Preventing filtered element-list updates from overriding an inspector's explicit selection.
---

When choosing a default element from a filtered list, first preserve the current element if it is still present. Only choose a remembered or first-list default when the current selection is absent or invalid.

**Why:** The filtered list can be recomputed as a consequence of selecting an element. An unconditional “select the first result” effect then immediately overrides the inspector’s choice and makes the picker appear stuck.

**How to apply:** Any effect that synchronizes the current element with location, inspection mode, shortlist, search, or material filters must test whether the current selection remains valid before assigning a default.