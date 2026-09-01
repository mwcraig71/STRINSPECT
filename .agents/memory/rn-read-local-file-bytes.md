---
name: Reading local file bytes in React Native
description: Why fetch(fileUri).arrayBuffer() fails on native and the correct expo-file-system base64 read.
---

# Reading local file bytes in React Native (Expo)

`fetch(uri).arrayBuffer()` on a local `file://` / `content://` URI works on
**web** but is **unreliable on native (Android/iOS)** — it silently returns
corrupt/empty bytes. Symptom downstream: pdf.js throws **"Invalid PDF structure"**
even though the file is a perfectly valid PDF. This is why the PDF *import* flow
worked in the web preview but failed on Android.

## Correct pattern (used across this app)
On native, read the file with expo-file-system and decode base64 yourself:
```ts
import { Platform } from "react-native";
if (Platform.OS === "web") {
  data = await (await fetch(uri)).arrayBuffer();
} else {
  const FS = await import("expo-file-system/legacy"); // SDK 54: legacy API
  const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); // atob is global in Expo
}
```
`pdfjsLib.getDocument({ data })` accepts either `ArrayBuffer` or `Uint8Array`.
Same pattern is used in `PDFAnnotatorModal.tsx` (read→data: URI) and
`InspectionContext.tsx` (read→upload). For `data:` URIs, slice after the comma
and `atob`-decode directly — no platform branch needed.

**Why:** RN's `fetch`/Blob has no dependable local-file support; expo-file-system
is the supported way to get bytes. **How to apply:** when React Native itself
needs raw bytes for parsing, uploading, or hashing, use the FS read, not fetch.
Exception: do not load very large bundled PDFs into RN memory as base64. The
headless extraction WebView can receive a direct local file URI with local-file
access enabled, avoiding several in-memory copies while still letting pdf.js read
the file in a browser runtime.
