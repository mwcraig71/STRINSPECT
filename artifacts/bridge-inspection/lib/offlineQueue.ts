import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const QUEUE_KEY = "@bridge_sync_queue_v2";
const UPLOADED_PHOTOS_KEY = "@bridge_uploaded_photo_ids_v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoToUpload {
  id: string;  // stable: "${defectId}_${photoIndex}" or "std_${slotId}"
  uri: string;
  description?: string; // JSON-encoded tags, e.g. '{"directionTags":["N"],"subjectTags":["deck"]}'
}

export interface SyncQueueEntry {
  structureNumber: string;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
  payload: {
    status?: "in_progress" | "finalized";
    finalizedAt?: string | null;
    defects: unknown[];
    nbiRatings: unknown[];
    importSummary: unknown | null;
    pdfAnnotations: unknown | null;
  };
  pdfPath?: string;
  photos: PhotoToUpload[];
}

// ─── Queue persistence ────────────────────────────────────────────────────────

export async function loadQueue(): Promise<SyncQueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: SyncQueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueueLength(): Promise<number> {
  return (await loadQueue()).length;
}

export async function enqueueSession(
  entry: Omit<SyncQueueEntry, "enqueuedAt" | "attempts">,
): Promise<void> {
  const queue = await loadQueue();
  const idx = queue.findIndex((e) => e.structureNumber === entry.structureNumber);
  const base: SyncQueueEntry = {
    ...entry,
    enqueuedAt: new Date().toISOString(),
    attempts: idx >= 0 ? queue[idx].attempts : 0,
  };
  if (idx >= 0) {
    queue[idx] = base;
  } else {
    queue.push(base);
  }
  await saveQueue(queue);
}

export async function removeFromQueue(structureNumber: string): Promise<void> {
  const queue = await loadQueue();
  await saveQueue(queue.filter((e) => e.structureNumber !== structureNumber));
}

async function incrementAttempts(structureNumber: string, error: string): Promise<void> {
  const queue = await loadQueue();
  const idx = queue.findIndex((e) => e.structureNumber === structureNumber);
  if (idx >= 0) {
    queue[idx].attempts += 1;
    queue[idx].lastError = error;
    await saveQueue(queue);
  }
}

// ─── Uploaded photo tracking ──────────────────────────────────────────────────

export async function getUploadedPhotoIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(UPLOADED_PHOTOS_KEY);
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

// Keys are stored as "<structureNumber>:<photoId>" to avoid cross-session collisions.
// Two inspections for different bridges that happen to share a slot ID (e.g. "std_roadway")
// must each upload independently.
function scopedPhotoKey(structureNumber: string, photoId: string): string {
  return `${structureNumber}:${photoId}`;
}

export async function markPhotoUploaded(structureNumber: string, id: string): Promise<void> {
  const set = await getUploadedPhotoIds();
  set.add(scopedPhotoKey(structureNumber, id));
  await AsyncStorage.setItem(UPLOADED_PHOTOS_KEY, JSON.stringify([...set]));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function collectPhotosFromDefects(defects: unknown[]): PhotoToUpload[] {
  const photos: PhotoToUpload[] = [];
  for (const d of defects) {
    const defect = d as { id?: string; photos?: Array<{ uri?: string }> };
    if (!defect.id || !Array.isArray(defect.photos)) continue;
    defect.photos.forEach((p, i) => {
      if (p.uri) photos.push({ id: `${defect.id}_${i}`, uri: p.uri });
    });
  }
  return photos;
}

export interface StandardPhotoSlotLike {
  slotId: string;
  photoUri?: string;
  directionTags: string[];
  subjectTags: string[];
}

export function collectPhotosFromStandardSlots(
  slots: StandardPhotoSlotLike[],
): PhotoToUpload[] {
  return slots
    .filter((s) => !!s.photoUri)
    .map((s) => ({
      id: `std_${s.slotId}`,
      uri: s.photoUri as string,
      description: JSON.stringify({
        directionTags: s.directionTags,
        subjectTags: s.subjectTags,
      }),
    }));
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

async function uploadOnePhoto(
  photo: PhotoToUpload,
  structureNumber: string,
  apiUrl: string,
  apiKey: string | undefined,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const FS = await import("expo-file-system/legacy");
    const info = await FS.getInfoAsync(photo.uri);
    if (!info.exists) return false;
    const b64 = await FS.readAsStringAsync(photo.uri, {
      encoding: FS.EncodingType.Base64,
    });
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = `${apiUrl}/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(photo.id)}`;
    const headers: Record<string, string> = { "Content-Type": "image/jpeg" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    if (photo.description) headers["X-Photo-Description"] = photo.description;
    const res = await fetch(url, { method: "PUT", headers, body: bytes });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadPhotos(
  photos: PhotoToUpload[],
  structureNumber: string,
  apiUrl: string,
  apiKey: string | undefined,
): Promise<void> {
  const uploadedIds = await getUploadedPhotoIds();
  for (const photo of photos) {
    if (uploadedIds.has(scopedPhotoKey(structureNumber, photo.id))) continue;
    const ok = await uploadOnePhoto(photo, structureNumber, apiUrl, apiKey);
    if (ok) await markPhotoUploaded(structureNumber, photo.id);
  }
}

// ─── Full queue entry processor ───────────────────────────────────────────────

export async function processQueueEntry(
  entry: SyncQueueEntry,
  apiUrl: string,
  apiKey: string | undefined,
): Promise<void> {
  const authHeader: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};

  // 1. Upload session JSON
  const sessionRes = await fetch(`${apiUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({
      structureNumber: entry.structureNumber,
      source: "mobile_sync",
      ...entry.payload,
    }),
  });
  if (!sessionRes.ok) {
    const txt = await sessionRes.text().catch(() => String(sessionRes.status));
    const err = `Session upload failed (${sessionRes.status}): ${txt}`;
    await incrementAttempts(entry.structureNumber, err);
    throw new Error(err);
  }

  // 2. Upload PDF binary (best-effort — don't fail whole entry on PDF error)
  if (entry.pdfPath && Platform.OS !== "web") {
    try {
      const FS = await import("expo-file-system/legacy");
      const info = await FS.getInfoAsync(entry.pdfPath);
      if (info.exists) {
        const b64 = await FS.readAsStringAsync(entry.pdfPath, {
          encoding: FS.EncodingType.Base64,
        });
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        await fetch(
          `${apiUrl}/api/sessions/pdf/${encodeURIComponent(entry.structureNumber)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/pdf", ...authHeader },
            body: bytes,
          },
        );
      }
    } catch {
      // PDF upload failure is non-fatal
    }
  }

  // 3. Upload photos (best-effort per photo) — includes both defect and standard photos
  await uploadPhotos(entry.photos, entry.structureNumber, apiUrl, apiKey);
}
