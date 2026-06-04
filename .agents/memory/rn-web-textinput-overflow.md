---
name: RN Web TextInput overflow in flex rows
description: Why TextInputs overflow narrow flex containers on React Native Web and how to prevent it
---

On React Native Web, a `<TextInput>` renders to an HTML `<input>` that has an
intrinsic minimum content width (~146px from the browser default). A flex child's
default `min-width` is `auto`, which means the input will NOT shrink below that
intrinsic width even when its flex container is narrower. The input then overflows
its wrapper — and any card/border around it — pushing past the screen edge.

**Symptom:** input fields stick out past the right edge of their card/modal, clipped
by the screen. Happens specifically when a TextInput with `flex: 1` lives inside a
fixed-width or narrow flex row (e.g. a label + small input "measure" row), where the
available space is less than the input's ~146px intrinsic width.

**Fix:** add `minWidth: 0` to the TextInput's style (the flex child). This lets flex
shrink it to fit the container. Pair with a sensible wrapper width.

**How to apply:** any time you put a `<TextInput>` with `flex: 1` next to fixed-width
siblings in a `flexDirection: "row"`, add `minWidth: 0` to the input style. If the
available space already exceeds ~146px (e.g. a wide name field), it won't overflow,
but adding `minWidth: 0` defensively is harmless and future-proofs against narrower
layouts. Vertically-stacked full-width inputs (label on top, input below) are not
affected because they stretch to the parent width.

**Why it matters here:** the bridge-inspection TxDOT form modals (SnbiModal and
siblings) use compact horizontal "measure" rows (label + narrow input + unit). Those
narrow wrappers triggered the overflow. Stacked `fieldGroup` inputs were fine.
