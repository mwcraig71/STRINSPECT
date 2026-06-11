import { useEffect, useState } from "react";
import { Camera, ImageOff } from "lucide-react";

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
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

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
              const isExpanded = expandedSlot === slot.slotId;

              return (
                <div
                  key={slot.slotId}
                  className={`rounded-lg overflow-hidden border transition-colors ${
                    meta ? "border-sky-500/40 bg-sky-500/5" : "border-border bg-card"
                  }`}
                >
                  {photoUrl ? (
                    <button
                      className="w-full relative block"
                      onClick={() => setExpandedSlot(isExpanded ? null : slot.slotId)}
                      title="Click to enlarge"
                    >
                      <img
                        src={photoUrl}
                        alt={slot.label}
                        className="w-full h-28 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
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

      {/* Lightbox for expanded photo */}
      {expandedSlot && (() => {
        const slot = STANDARD_SLOTS.find((s) => s.slotId === expandedSlot);
        const meta = metaBySlot.get(expandedSlot);
        if (!slot || !meta) return null;
        const photoUrl = `/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(meta.photoId)}`;
        const tags = parseTags(meta.description);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setExpandedSlot(null)}
          >
            <div
              className="bg-card rounded-xl overflow-hidden max-w-2xl w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-sky-400" />
                  <span className="text-sm font-semibold text-foreground">{slot.label}</span>
                  {(tags.directionTags.length > 0 || tags.subjectTags.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {tags.directionTags.map((t) => (
                        <span key={t} className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                          {t}
                        </span>
                      ))}
                      {tags.subjectTags.map((t) => (
                        <span key={t} className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setExpandedSlot(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                >
                  ✕ Close
                </button>
              </div>
              <img src={photoUrl} alt={slot.label} className="w-full max-h-[70vh] object-contain bg-black" />
              {meta.createdAt && (
                <p className="text-xs text-muted-foreground px-4 py-2 border-t border-border">
                  Uploaded {new Date(meta.createdAt).toLocaleString("en-US")}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
