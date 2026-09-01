---
name: WebView toolbar icons
description: Reliable icon rendering convention for embedded PDF viewer and annotator controls.
---

Use inline SVG paths for icons inside embedded PDF HTML. Do not use emoji, Unicode pictographs, or app icon fonts for WebView toolbar controls.

**Why:** Android WebView font fallback can render those glyphs as square placeholders even when React Native icon fonts are loaded correctly outside the WebView.

**How to apply:** Keep PDF viewer and annotator button icons self-contained in their HTML with `currentColor` SVG strokes and accessible button labels.