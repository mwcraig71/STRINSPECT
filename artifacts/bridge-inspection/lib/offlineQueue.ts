import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const QUEUE_KEY = "@bridge_sync_queue_v2";
const UPLOADED_PHOTOS_KEY = "@bridge_uploaded_photo_ids_v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoToUpload {
  id: string;  // stable photo reference, or "std_${slotId}"
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
    teamLeader?: string | null;
    teamMembers?: string[];
    inspectionDate?: string | null;
    weather?: string | null;
    equipmentUsed?: string | null;
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

export async function clearUploadedPhotoIds(): Promise<void> {
  await AsyncStorage.removeItem(UPLOADED_PHOTOS_KEY);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function collectPhotosFromDefects(defects: unknown[]): PhotoToUpload[] {
  const photos: PhotoToUpload[] = [];
  for (const d of defects) {
    const defect = d as {
      id?: string;
      elementId?: string;
      element?: string;
      defect?: string;
      location?: string;
      photos?: Array<{ uri?: string; photoId?: string; description?: string; heading?: number | null; capturedAt?: string; directionTags?: string[]; subjectTags?: string[] }>;
    };
    if (!defect.id || !Array.isArray(defect.photos)) continue;
    defect.photos.forEach((p, i) => {
      if (p.uri) {
        const id = p.photoId || `${defect.id}_${i}`;
        photos.push({
          id,
          uri: p.uri,
          description: JSON.stringify({
            ownerType: "defect",
            defectId: defect.id,
            elementId: defect.elementId,
            element: defect.element,
            defect: defect.defect,
            location: defect.location,
            description: p.description || "",
            heading: p.heading ?? null,
            capturedAt: p.capturedAt,
            directionTags: p.directionTags ?? [],
            subjectTags: p.subjectTags ?? [],
          }),
        });
      }
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
  idPrefix = "std_",
): PhotoToUpload[] {
  return slots
    .filter((s) => !!s.photoUri)
    .map((s) => ({
      id: `${idPrefix}${s.slotId}`,
      uri: s.photoUri as string,
      description: JSON.stringify({
        directionTags: s.directionTags,
        subjectTags: s.subjectTags,
      }),
    }));
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

/**
 * Fetch the server photo inventory. A failed inventory check must fail sync so
 * stale removals remain queued rather than being silently marked complete.
 */
async function fetchServerPhotos(
  structureNumber: string,
  apiUrl: string,
  apiKey: string | undefined,
): Promise<Map<string, string | undefined>> {
  const url = `${apiUrl}/api/sessions/photos/${encodeURIComponent(structureNumber)}`;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`Photo inventory failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as Array<{ photoId?: string; description?: string | null }>;
  if (!Array.isArray(data)) throw new Error("Photo inventory returned an invalid response.");
  return new Map(
    data
      .filter((row): row is { photoId: string; description?: string | null } => !!row.photoId)
      .map((row) => [row.photoId, row.description ?? undefined])
  );
}

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

async function deleteOnePhoto(
  photoId: string,
  structureNumber: string,
  apiUrl: string,
  apiKey: string | undefined,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(
      `${apiUrl}/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(photoId)}`,
      { method: "DELETE", headers },
    );
    return res.ok || res.status === 404;
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
  // Query the server for photos already stored there, so we never re-upload them
  // even when the local tracking set was cleared between syncs.
  const serverPhotos = await fetchServerPhotos(structureNumber, apiUrl, apiKey);

  // Seed local tracking from server knowledge so subsequent calls are instant.
  for (const id of serverPhotos.keys()) {
    await markPhotoUploaded(structureNumber, id);
  }

  for (const photo of photos) {
    // The description includes capture time, notes, and tags. Matching metadata means
    // the stable server object is current; any edit or replacement safely overwrites it.
    if (serverPhotos.has(photo.id) && serverPhotos.get(photo.id) === photo.description) continue;
    const ok = await uploadOnePhoto(photo, structureNumber, apiUrl, apiKey);
    if (!ok) throw new Error(`Photo upload failed: ${photo.id}`);
    await markPhotoUploaded(structureNumber, photo.id);
  }

  const currentIds = new Set(photos.map((photo) => photo.id));
  for (const [serverId, description] of serverPhotos) {
    if (currentIds.has(serverId) || !description) continue;
    try {
      const metadata = JSON.parse(description) as { ownerType?: string };
      if (metadata.ownerType !== "defect") continue;
    } catch {
      continue;
    }
    const ok = await deleteOnePhoto(serverId, structureNumber, apiUrl, apiKey);
    if (!ok) throw new Error(`Photo deletion failed: ${serverId}`);
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

  // 3. Upload and reconcile every photo. Any failure retains the queue entry for retry.
  await uploadPhotos(entry.photos, entry.structureNumber, apiUrl, apiKey);
}
