---
name: Tablet orientation
description: Responsive and native-orientation convention for the bridge inspection tablet experience.
---

The bridge inspection app supports portrait and landscape. The full tablet split view should activate when the shortest screen edge is at least 600 points, keeping phones in the phone layout even when rotated. On native, check full screen dimensions as a fallback because Android system bars can make the app window slightly smaller; on web, use the viewport only.

**Why:** Portrait tablets can be narrower than a width-only 768-point check, while landscape phones can exceed that width. Android emulators can report a nominal 600-point shortest edge but a smaller content window after system bars. The app is intended for field use in either tablet orientation, without letting a desktop monitor size affect web responsiveness.

**How to apply:** Keep the Expo orientation unlocked and use the shared tablet hook consistently in tablet layout and tablet-specific screen calculations.