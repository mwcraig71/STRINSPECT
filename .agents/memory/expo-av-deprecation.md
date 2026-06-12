---
name: expo-av → expo-audio migration
description: expo-av is fully removed; SpeechToTextButton uses expo-audio's useAudioRecorder hook.
---

# expo-av → expo-audio migration

The SpeechToTextButton has been fully migrated from expo-av to expo-audio (SDK 54 standard).

## What changed
- `expo-av` removed from `artifacts/bridge-inspection/package.json`
- `expo-audio` added as a dependency
- `SpeechToTextButton.tsx` now uses `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` hook
- Permissions via `AudioModule.requestRecordingPermissionsAsync()`
- iOS audio mode via `AudioModule.setAudioModeAsync({ playsInSilentMode: true })` — note: no `allowsRecordingIOS` flag in expo-audio; recording mode is handled internally by `prepareToRecordAsync()`
- Recording start: `await recorder.prepareToRecordAsync()` then `recorder.record()`
- Recording stop: `await recorder.stop()` then `recorder.uri` for the file path
- `recorder.isRecording` replaces the old `useState<Audio.Recording | null>` pattern

**Why:** expo-av is deprecated in SDK 54 and will be removed in a future release.

**How to apply:** If any new recording-related features are added, use expo-audio (not expo-av). The AudioModule default export is the module-level singleton; useAudioRecorder returns a stable SharedObject. `playsInSilentMode: true` is the correct AudioMode key (not `playsInSilentModeIOS`).
