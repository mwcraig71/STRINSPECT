---
name: Opening bundled PDFs in Expo (web + native)
description: How to bundle and open a static PDF asset across web and native, including the web popup-blocker gotcha.
---

To open a PDF that ships with the Expo app (bridge-inspection):

- Bundle it: copy the PDF under `assets/` and add `"pdf"` to `config.resolver.assetExts` in `metro.config.js`, otherwise Metro won't include it.
- Resolve a URL at runtime with `expo-asset`: `const a = Asset.fromModule(require(...)); await a.downloadAsync(); const uri = a.localUri ?? a.uri;`
- Native: `WebBrowser.openBrowserAsync(uri)` (expo-web-browser).
- Web: open the tab **synchronously inside the user gesture** with `window.open("", "_blank")` BEFORE the `await downloadAsync()`, then set `preopened.location.href = uri` once resolved.

**Why:** On mobile web especially, calling `window.open` *after* an `await` loses the user-gesture context and the popup blocker silently rejects it. Pre-opening a blank tab in the click handler preserves the gesture. Always handle the blocked case (null window) with a `Linking.openURL` fallback and close the pre-opened tab on error.

**How to apply:** Any "view/open document" button in an Expo app that resolves its URL asynchronously.
