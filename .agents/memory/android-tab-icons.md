---
name: Android tab icons
description: Cross-platform rule for tab icon rendering in the Expo bridge inspection app.
---

Use liquid-glass NativeTabs only on iOS when the capability is available. Use the classic tab navigator with Feather icons on Android, and preload the Feather font at root startup.

**Why:** NativeTabs icon definitions containing only SF Symbols have no Android image or drawable source, so Android displays missing glyphs. Lazy per-icon font loading can also leave initial Android screens blank.

**How to apply:** Any future tab-navigation change must either keep Android on the classic Feather tab bar or provide explicit Android icon sources for every NativeTabs trigger.