import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

type Annotation = {
  type: "stroke" | "highlight" | "text";
  page: number;
  color?: string;
  width?: number;
  points?: [number, number][];
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
};

type Props = {
  pdfUrl: string;
  annotations: Annotation[];
};

/**
 * Assumed mobile canvas width used when inspector annotated the PDF.
 * Mobile renders at scale = (vw-4) / pdfPageWidth, so canvas.width = vw-4.
 * Standard Expo device viewport ~390px → canvas width ≈ 386px.
 */
const MOBILE_CANVAS_WIDTH = 386;

function drawStroke(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  scaleX: number,
  scaleY: number,
) {
  const pts = ann.points;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = ann.color ?? "#ef4444";
  ctx.lineWidth = (ann.width ?? 4) * scaleX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (ann.type === "highlight") ctx.globalAlpha = 0.38;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleY);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * scaleX;
    const my = ((pts[i][1] + pts[i + 1][1]) / 2) * scaleY;
    ctx.quadraticCurveTo(pts[i][0] * scaleX, pts[i][1] * scaleY, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0] * scaleX, pts[pts.length - 1][1] * scaleY);
  ctx.stroke();
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  scaleX: number,
  scaleY: number,
) {
  if (!ann.text || ann.x == null || ann.y == null) return;
  ctx.save();
  ctx.fillStyle = ann.color ?? "#ef4444";
  const fontSize = (ann.fontSize ?? 18) * Math.min(scaleX, scaleY);
  ctx.font = `bold ${fontSize}px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
  ctx.fillText(ann.text, ann.x * scaleX, ann.y * scaleY);
  ctx.restore();
}

export default function PDFRedlineViewer({ pdfUrl, annotations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    async function render() {
      if (!containerRef.current) return;
      const container = containerRef.current;
      container.innerHTML = "";

      let arrayBuffer: ArrayBuffer;
      try {
        const resp = await fetch(pdfUrl);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        arrayBuffer = await resp.arrayBuffer();
      } catch (e) {
        if (!cancelled) {
          setErrorMsg("Could not fetch PDF: " + (e instanceof Error ? e.message : String(e)));
          setStatus("error");
        }
        return;
      }

      let pdfDoc: pdfjsLib.PDFDocumentProxy;
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      } catch (e) {
        if (!cancelled) {
          setErrorMsg("Could not parse PDF: " + (e instanceof Error ? e.message : String(e)));
          setStatus("error");
        }
        return;
      }

      const containerWidth = container.clientWidth || 800;

      for (let pn = 1; pn <= pdfDoc.numPages; pn++) {
        if (cancelled) return;

        const page = await pdfDoc.getPage(pn);
        const baseVp = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseVp.width;
        const vp = page.getViewport({ scale });

        const wrap = document.createElement("div");
        wrap.style.cssText = `position:relative;margin:8px auto;display:block;width:${vp.width}px;height:${vp.height}px;box-shadow:0 2px 12px rgba(0,0,0,.25)`;

        const pdfCanvas = document.createElement("canvas");
        pdfCanvas.width = vp.width;
        pdfCanvas.height = vp.height;
        pdfCanvas.style.cssText = "display:block;width:100%;height:100%";

        const annCanvas = document.createElement("canvas");
        annCanvas.width = vp.width;
        annCanvas.height = vp.height;
        annCanvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%";

        wrap.appendChild(pdfCanvas);
        wrap.appendChild(annCanvas);
        container.appendChild(wrap);

        const pdfCtx = pdfCanvas.getContext("2d")!;
        await page.render({ canvasContext: pdfCtx, viewport: vp }).promise;

        // Scale annotation coordinates from mobile canvas space to web canvas space.
        // Mobile canvas width ≈ MOBILE_CANVAS_WIDTH (device-independent assumption).
        // Mobile canvas height = MOBILE_CANVAS_WIDTH * (pageHeight / pageWidth).
        const mobileCanvasHeight =
          (MOBILE_CANVAS_WIDTH / baseVp.width) * baseVp.height;
        const scaleX = vp.width / MOBILE_CANVAS_WIDTH;
        const scaleY = vp.height / mobileCanvasHeight;

        const pageAnns = annotations.filter((a) => a.page === pn);
        if (pageAnns.length > 0) {
          const annCtx = annCanvas.getContext("2d")!;
          for (const ann of pageAnns) {
            if (ann.type === "text") {
              drawText(annCtx, ann, scaleX, scaleY);
            } else {
              drawStroke(annCtx, ann, scaleX, scaleY);
            }
          }
        }
      }

      if (!cancelled) setStatus("done");
    }

    render().catch((e) => {
      if (!cancelled) {
        setErrorMsg(String(e));
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, annotations]);

  return (
    <div className="w-full rounded border border-border overflow-hidden bg-slate-900">
      {status === "loading" && (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground gap-2">
          <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
          Rendering PDF with annotations…
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center justify-center h-28 text-sm text-red-400 px-4 text-center">
          {errorMsg || "Failed to load PDF."}
        </div>
      )}
      <div
        ref={containerRef}
        className="p-2 overflow-y-auto"
        style={{ maxHeight: 520, display: status === "done" ? "block" : "none" }}
      />
    </div>
  );
}
