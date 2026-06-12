import { useEffect, useState, useCallback } from "react";
import { Camera, ImageOff, ChevronLeft, ChevronRight, X } from "lucide-react";

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

interface Props {
  structureNumber: string;
}

export default function StandardPhotosPanel({ structureNumber }: Props) {
  const [photoMeta, setPhotoMeta] = useState<PhotoMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!structureNumber) return;
    setLoading(true);
    setError(false);
    setPhotoMeta(null);

    fetch(`/api/sessions/photos/${encodeURIComponent(structureNumber)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PhotoMeta[]>;
      })
      .then((data) => {
        setPhotoMeta(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [structureNumber]);

  const metaBySlot = new Map<string, PhotoMeta>();
  if (photoMeta) {
    for (const p of photoMeta) {
      if (p.photoId.startsWith("std_")) {
        metaBySlot.set(p.photoId.slice(4), p);
      }
    }
  }

  const uploadedCount = STANDARD_SLOTS.filter((s) => metaBySlot.has(s.slotId)).length;

  const uploadedSlots = STANDARD_SLOTS.filter((s) => metaBySlot.has(s.slotId));

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % uploadedSlots.length));
  }, [uploadedSlots.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) =>
      i === null ? null : (i - 1 + uploadedSlots.length) % uploadedSlots.length
    );
  }, [uploadedSlots.length]);

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

  const openLightbox = (slotId: string) => {
    const idx = uploadedSlots.findIndex((s) => s.slotId === slotId);
    if (idx !== -1) setLightboxIndex(idx);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Camera className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-foreground">Standard Photos</span>
        {!loading && (
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
        {loading ? (
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
        ) : error ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Could not load photos. Ensure the API server is running.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {STANDARD_SLOTS.map((slot) => {
              const meta = metaBySlot.get(slot.slotId);
              const photoUrl = meta
                ? `/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(meta.photoId)}`
                : null;
              const tags = parseTags(meta?.description ?? null);

              return (
                <div
                  key={slot.slotId}
                  className={`rounded-lg overflow-hidden border transition-colors ${
                    meta ? "border-sky-500/40 bg-sky-500/5" : "border-border bg-card"
                  }`}
                >
                  {photoUrl ? (
                    <button
                      className="w-full relative block group"
                      onClick={() => openLightbox(slot.slotId)}
                      title="Click to view full-screen"
                    >
                      <img
                        src={photoUrl}
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
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && uploadedSlots.length > 0 && (() => {
        const slot = uploadedSlots[lightboxIndex];
        const meta = metaBySlot.get(slot.slotId)!;
        const photoUrl = `/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(meta.photoId)}`;
        const tags = parseTags(meta.description);
        const hasPrev = uploadedSlots.length > 1;
        const hasNext = uploadedSlots.length > 1;

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
                  <span className="text-sm font-semibold text-foreground truncate">{slot.label}</span>
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
                  {uploadedSlots.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {lightboxIndex + 1} / {uploadedSlots.length}
                    </span>
                  )}
                  <button
                    onClick={closeLightbox}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                    title="Close (Esc)"
                    aria-label="Close lightbox"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Image area with nav arrows */}
              <div className="relative bg-black flex items-center justify-center">
                <img
                  key={photoUrl}
                  src={photoUrl}
                  alt={slot.label}
                  className="max-h-[70vh] w-full object-contain"
                />
                {hasPrev && (
                  <button
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
                    title="Previous (←)"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {hasNext && (
                  <button
                    onClick={goNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
                    title="Next (→)"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
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
                <p className="text-xs text-muted-foreground">
                  ESC to close · ← → to navigate
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
