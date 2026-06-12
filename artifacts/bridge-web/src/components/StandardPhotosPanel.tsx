import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, ImageOff, ChevronLeft, ChevronRight, X, Images } from "lucide-react";

const STANDARD_SLOTS = [
  { slotId: "roadway",         label: "Roadway" },
  { slotId: "load_sign_1",     label: "Load Posting Sign (Approach 1)" },
  { slotId: "load_sign_2",     label: "Load Posting Sign (Approach 2)" },
  { slotId: "elevation",       label: "Elevation" },
  { slotId: "super_underside", label: "Superstructure Underside" },
  { slotId: "under_view",      label: "Under View" },
  { slotId: "upstream",        label: "Upstream" },
  { slotId: "downstream",      label: "Downstream" },
] as const;

interface PhotoMeta {
  photoId: string;
  mimeType: string;
  description: string | null;
  createdAt: string;
}

interface PhotoTags {
  directionTags: string[];
  subjectTags: string[];
}

function parseTags(description: string | null): PhotoTags {
  if (!description) return { directionTags: [], subjectTags: [] };
  try {
    const parsed = JSON.parse(description) as Partial<PhotoTags>;
    return {
      directionTags: Array.isArray(parsed.directionTags) ? parsed.directionTags : [],
      subjectTags: Array.isArray(parsed.subjectTags) ? parsed.subjectTags : [],
    };
  } catch {
    return { directionTags: [], subjectTags: [] };
  }
}

export const SESSION_PHOTOS_QUERY_KEY = "session-photos";

async function fetchPhotoMeta(structureNumber: string): Promise<PhotoMeta[]> {
  const r = await fetch(`/api/sessions/photos/${encodeURIComponent(structureNumber)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PhotoMeta[]>;
}

interface Props {
  structureNumber: string;
}

export default function StandardPhotosPanel({ structureNumber }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: photoMeta, isLoading, isError } = useQuery<PhotoMeta[]>({
    queryKey: [SESSION_PHOTOS_QUERY_KEY, structureNumber],
    queryFn: () => fetchPhotoMeta(structureNumber),
    enabled: !!structureNumber,
    staleTime: 5 * 60 * 1000,
  });

  const metaBySlot = new Map<string, PhotoMeta>();
  const extraPhotos: PhotoMeta[] = [];

  if (photoMeta) {
    for (const p of photoMeta) {
      if (p.photoId.startsWith("std_")) {
        metaBySlot.set(p.photoId.slice(4), p);
      } else {
        extraPhotos.push(p);
      }
    }
  }

  const uploadedCount = STANDARD_SLOTS.filter((s) => metaBySlot.has(s.slotId)).length;

  const photoUrl = (photoId: string) =>
    `/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(photoId)}`;

  // Unified ordered list of all photos that can appear in the lightbox:
  // uploaded standard slots first, then extra photos.
  const uploadedSlots = STANDARD_SLOTS.filter((s) => metaBySlot.has(s.slotId));
  const allLightboxPhotos: Array<{ label: string; meta: PhotoMeta }> = [
    ...uploadedSlots.map((s) => ({
      label: s.label,
      meta: metaBySlot.get(s.slotId)!,
    })),
    ...extraPhotos.map((meta, idx) => ({
      label: `Additional Photo ${idx + 1}`,
      meta,
    })),
  ];

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % allLightboxPhotos.length));
  }, [allLightboxPhotos.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) =>
      i === null ? null : (i - 1 + allLightboxPhotos.length) % allLightboxPhotos.length
    );
  }, [allLightboxPhotos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  const openLightboxForPhotoId = (photoId: string) => {
    const idx = allLightboxPhotos.findIndex((p) => p.meta.photoId === photoId);
    if (idx !== -1) setLightboxIndex(idx);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Camera className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-foreground">Standard Photos</span>
        {!isLoading && (
          <span
            className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
              uploadedCount === STANDARD_SLOTS.length
                ? "bg-green-500/15 text-green-400"
                : uploadedCount > 0
                ? "bg-sky-500/15 text-sky-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {uploadedCount}/{STANDARD_SLOTS.length} uploaded
          </span>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {STANDARD_SLOTS.map((s) => (
              <div key={s.slotId} className="rounded-lg overflow-hidden border border-border">
                <div className="h-28 bg-secondary/60 animate-pulse" />
                <div className="p-2">
                  <div className="h-3 bg-secondary/60 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Could not load photos. Ensure the API server is running.
          </p>
        ) : (
          <>
            {/* Standard 8-slot grid */}
            <div className="grid grid-cols-4 gap-3">
              {STANDARD_SLOTS.map((slot) => {
                const meta = metaBySlot.get(slot.slotId);
                const url = meta ? photoUrl(meta.photoId) : null;
                const tags = parseTags(meta?.description ?? null);

                return (
                  <div
                    key={slot.slotId}
                    className={`rounded-lg overflow-hidden border transition-colors ${
                      meta ? "border-sky-500/40 bg-sky-500/5" : "border-border bg-card"
                    }`}
                  >
                    {url && meta ? (
                      <button
                        className="w-full relative block group"
                        onClick={() => openLightboxForPhotoId(meta.photoId)}
                        title="Click to view full-screen"
                      >
                        <img
                          src={url}
                          alt={slot.label}
                          className="w-full h-28 object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-full">
                            View
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div className="h-28 flex items-center justify-center bg-muted/30">
                        <div className="flex flex-col items-center gap-1.5">
                          <ImageOff className="h-6 w-6 text-muted-foreground/40" />
                          <span className="text-xs text-muted-foreground/50">Not uploaded</span>
                        </div>
                      </div>
                    )}

                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium text-foreground leading-snug truncate" title={slot.label}>
                        {slot.label}
                      </p>
                      {(tags.directionTags.length > 0 || tags.subjectTags.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.directionTags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            >
                              {t}
                            </span>
                          ))}
                          {tags.subjectTags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Additional Photos — hidden when none exist */}
            {extraPhotos.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Images className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">Additional Photos</span>
                  <span className="text-xs rounded-full px-2 py-0.5 font-semibold bg-amber-500/15 text-amber-400">
                    {extraPhotos.length}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {extraPhotos.map((meta, idx) => {
                    const url = photoUrl(meta.photoId);
                    const tags = parseTags(meta.description);
                    return (
                      <div
                        key={meta.photoId}
                        className="rounded-lg overflow-hidden border border-amber-500/40 bg-amber-500/5"
                      >
                        <button
                          className="w-full relative block group"
                          onClick={() => openLightboxForPhotoId(meta.photoId)}
                          title="Click to view full-screen"
                        >
                          <img
                            src={url}
                            alt={`Additional photo ${idx + 1}`}
                            className="w-full h-28 object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-full">
                              View
                            </span>
                          </div>
                        </button>
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-medium text-foreground leading-snug truncate">
                            Photo {idx + 1}
                          </p>
                          {(tags.directionTags.length > 0 || tags.subjectTags.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.directionTags.map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                >
                                  {t}
                                </span>
                              ))}
                              {tags.subjectTags.map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {meta.createdAt && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {new Date(meta.createdAt).toLocaleDateString("en-US")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Unified lightbox — carousel covers standard and extra photos */}
      {lightboxIndex !== null && allLightboxPhotos.length > 0 && (() => {
        const { label, meta } = allLightboxPhotos[lightboxIndex];
        const url = photoUrl(meta.photoId);
        const tags = parseTags(meta.description);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <div
              className="relative flex flex-col bg-card rounded-xl overflow-hidden shadow-2xl max-w-3xl w-full mx-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="h-4 w-4 text-sky-400 shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">{label}</span>
                  {(tags.directionTags.length > 0 || tags.subjectTags.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {tags.directionTags.map((t) => (
                        <span key={t} className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20 whitespace-nowrap">
                          {t}
                        </span>
                      ))}
                      {tags.subjectTags.map((t) => (
                        <span key={t} className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 whitespace-nowrap">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {allLightboxPhotos.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {lightboxIndex + 1} / {allLightboxPhotos.length}
                    </span>
                  )}
                  <button
                    onClick={closeLightbox}
                    className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Image area with nav arrows */}
              <div className="relative bg-black flex items-center justify-center">
                <img
                  key={url}
                  src={url}
                  alt={label}
                  className="max-h-[70vh] w-full object-contain"
                />
                {allLightboxPhotos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
                      title="Previous (←)"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); goNext(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
                      title="Next (→)"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-border flex items-center justify-between shrink-0">
                {meta.createdAt ? (
                  <p className="text-xs text-muted-foreground">
                    Uploaded {new Date(meta.createdAt).toLocaleString("en-US")}
                  </p>
                ) : (
                  <span />
                )}
                {allLightboxPhotos.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    ESC to close · ← → to navigate
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
