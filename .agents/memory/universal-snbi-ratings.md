---
name: Universal SNBI ratings
description: Compatibility rule for active condition ratings and historical Item-based imports.
---

Use the universal SNBI B.C.01–B.C.11 catalog as the active condition-rating model for every agency and every new inspection. Keep imported Item 58/59/60-style values reviewable as explicitly labeled historical records; do not silently convert, discard, or present them as the active agency form.

**Why:** SCDOT and other active workflows need one consistent SNBI vocabulary, while historical TxDOT/NBI reports still contain useful source values that inspectors must be able to approve, modify, or reject without losing provenance.

**How to apply:** New rating features, readiness checks, dashboards, and reports should treat B.C. records as active data. Historical Item records may accompany them for import review, must remain visibly historical, and rejected values must not remain active or export as accepted ratings.