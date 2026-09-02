---
name: Samsung action icons
description: Reliable rendering rule for save, delete, edit, expand, collapse, and close controls on Samsung Android devices.
---

Use the shared SVG-backed action icon wrapper for save, delete, edit/modify, expand, collapse, and close controls. Keep font icons only as the fallback for non-critical decorative icons.

**Why:** Samsung Android devices can render some icon-font glyphs as rectangular boxes with X marks even when the same controls look correct with Apple-native symbols.

**How to apply:** Route new critical action controls through the shared icon wrapper and add an SVG path there when introducing another essential action icon.