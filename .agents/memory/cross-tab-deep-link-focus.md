---
name: Cross-tab deep-link focus pattern
description: How "Fix" deep-links from Summary focus a specific item on another tab without re-snapping.
---

Deep-links between tabs (expo-router, works for both NativeTabs and classic Tabs)
use `router.navigate({ pathname: "/(tabs)/<route>", params: { focus, focusTs } })`
where `focusTs = String(Date.now())` is a per-tap nonce. The "/(tabs)" index route
is the Inspection screen; pass `focus` = a defect/NBI item id.

The receiving screen reads `useLocalSearchParams` and applies the focus in a
`useEffect`, but MUST guard with a `handledFocusRef` so each nonce applies exactly
once:

```ts
const nonce = focusTs ?? focus;
if (!focus || !nonce || handledFocusRef.current === nonce) return;
if (/* target found in data */) { applyFocus(); handledFocusRef.current = nonce; }
```

**Why:** Without the once-guard, keeping the data array (nbiRatings, sessionManifest)
in the effect deps — which is required so a link that arrives before data loads still
resolves — would re-fire `setActiveItem(focus)` / `startEdit(target)` on every later
edit, snapping the user back to the originally focused item. The nonce ref makes it
retry-until-resolved-once instead of run-on-every-data-change.

**How to apply:** Any new cross-tab "jump to X" deep-link. Keep the data dep in the
array (resilient to async load) AND the handledFocusRef guard (no re-snap). A fresh
tap always carries a new focusTs, so it re-applies as intended.
Summary-internal targets (importAudit, criticalFindings) instead scroll within the
ScrollView using y-offsets captured via per-card `onLayout`.
