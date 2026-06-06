---
name: Offline-first sync architecture
description: How the bridge inspection app queues, retries, and uploads everything when offline then reconnects.
---

## Rule
`syncSession()` returns `"synced" | "queued"` — it never throws when the device is offline. Offline = data is snapshotted into the persistent queue and "queued" is returned. Online upload failure = queued AND thrown (so UI can show error state).

**Why:** Inspectors work in the field with no connectivity. All data must be saved locally and synced automatically without requiring user intervention or showing scary errors when offline.

**How to apply:**
- Any caller of `syncSession()` must handle both return values. "queued" = no error, just waiting.
- Use `offlineQueue.ts` functions directly only for queue management and API upload (processQueueEntry). Never call them from UI components.
- Add new uploadable data types (e.g. audio memos) to `processQueueEntry` and `syncSession` in tandem.

## Key files
- `artifacts/bridge-inspection/lib/offlineQueue.ts` — queue persistence + processQueueEntry + photo upload
- `artifacts/bridge-inspection/hooks/useAutoSync.ts` — 15 s polling + foreground trigger + queue drain
- `artifacts/bridge-inspection/context/InspectionContext.tsx` — syncSession, pendingSyncCount state
- `artifacts/api-server/src/routes/sessions.ts` — PUT/GET /sessions/photos/:sn/:photoId
- `lib/db/src/schema/sessionPhotos.ts` — session_photos table (structureNumber + photoId unique)

## Photo upload IDs
Photos are identified by `${defectId}_${photoIndex}`. The uploaded-IDs set lives in AsyncStorage key `@bridge_uploaded_photo_ids_v1`. Photos whose ID is in this set are skipped on subsequent syncs (idempotent uploads).

## Queue key
`@bridge_sync_queue_v2` — JSON array of SyncQueueEntry. One entry per structureNumber (upserted). Entry stores full data snapshot so it can be processed without InspectionContext.
