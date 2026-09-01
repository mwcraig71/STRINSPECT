import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SESSION_PHOTOS_QUERY_KEY } from "@/components/StandardPhotosPanel";
import {
  FileSpreadsheet, FileText, RefreshCw, Database, FileDown, X,
  ChevronDown, ChevronUp, ExternalLink, PenLine,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType, ImageRun,
} from "docx";
import { SessionData, DefectRecord, NbiRating, ImportSummary } from "@/lib/types";
import {
  useListSessions, useGetSession,
  getListSessionsQueryKey, getGetSessionQueryKey,
} from "@workspace/api-client-react";

type Annotation = {
  type: "stroke" | "highlight" | "text" | "_meta";
  page: number;
  color?: string;
  width?: number;
  points?: [number, number][];
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  pageDimensions?: Record<string, { w: number; h: number }>;
};

const FALLBACK_MOBILE_CANVAS_WIDTH = 386;

function drawStroke(ctx: CanvasRenderingContext2D, ann: Annotation, sx: number, sy: number) {
  const pts = ann.points;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = ann.color ?? "#ef4444";
  ctx.lineWidth = (ann.width ?? 4) * sx;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (ann.type === "highlight") ctx.globalAlpha = 0.38;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * sx, pts[0][1] * sy);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * sx;
    const my = ((pts[i][1] + pts[i + 1][1]) / 2) * sy;
    ctx.quadraticCurveTo(pts[i][0] * sx, pts[i][1] * sy, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0] * sx, pts[pts.length - 1][1] * sy);
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, ann: Annotation, sx: number, sy: number) {
  if (!ann.text || ann.x == null || ann.y == null) return;
  ctx.save();
  ctx.fillStyle = ann.color ?? "#ef4444";
  const fontSize = (ann.fontSize ?? 18) * Math.min(sx, sy);
  ctx.font = `bold ${fontSize}px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
  ctx.fillText(ann.text, ann.x * sx, ann.y * sy);
  ctx.restore();
}

const CS_COLORS: Record<string, string> = {
  CS1: "#22c55e", CS2: "#eab308", CS3: "#f97316", CS4: "#ef4444",
};

const CS_STATES = ["CS1", "CS2", "CS3", "CS4"] as const;

function conditionQuantities(defect: DefectRecord) {
  if (defect.conditionQuantities && Object.values(defect.conditionQuantities).some(Boolean)) {
    return defect.conditionQuantities;
  }
  return { [defect.cs]: defect.quantityValue };
}

function conditionBreakdown(defect: DefectRecord) {
  const quantities = conditionQuantities(defect);
  return CS_STATES
    .filter((state) => (parseFloat(quantities[state] || "") || 0) > 0)
    .map((state) => `${state}: ${quantities[state]}`)
    .join(" · ");
}

function ratingItemLabel(item: string) {
  return /^BC\d{2}$/.test(item)
    ? `B.C.${item.replace("BC", "")}`
    : `Historical NBI Item ${item}`;
}
const CS_BG: Record<string, string> = {
  CS1: "rgba(34,197,94,0.12)", CS2: "rgba(234,179,8,0.12)",
  CS3: "rgba(249,115,22,0.12)", CS4: "rgba(239,68,68,0.12)",
};

function headingLabel(deg: number | null | undefined): string {
  if (deg == null) return "";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return `${dirs[Math.round(deg / 22.5) % 16]} (${Math.round(deg)}\u00b0)`;
}

function sortedLocations(defects: DefectRecord[]) {
  return Array.from(new Set(defects.map((d) => d.location))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function formatRelativeTime(d: string | Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface ReportHeader {
  facilityCarried: string;
  featureCrossed: string;
  inspectionDate: string;
  inspectors: string;
  inspectionType: string;
  latitude: string;
  longitude: string;
}

const EMPTY_HEADER: ReportHeader = {
  facilityCarried: "", featureCrossed: "", inspectionDate: "",
  inspectors: "", inspectionType: "", latitude: "", longitude: "",
};

interface ExtraPhotoEntry {
  photoId: string;
  dataUri: string | null;
  directionTags: string[];
  subjectTags: string[];
  capturedAt: Date;
}

const REPORT_STYLES = `
  *{box-sizing:border-box;margin:0;padding:0}
  body,div{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2937;line-height:1.5}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 28px}
  .stat{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px}
  .stat .val{font-size:26px;font-weight:700;line-height:1.1}
  .stat .lbl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
  h1{font-size:22px;font-weight:700;color:#111827;margin-bottom:4px}
  h2{font-size:15px;font-weight:700;color:#1f2937;margin:28px 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}
  .meta{color:#6b7280;font-size:11px;margin-bottom:8px}
  @media print{tr{page-break-inside:avoid}h2,h3{page-break-after:avoid}}
`;

function buildReportContentHtml(data: SessionData, header: ReportHeader = EMPTY_HEADER, extraPhotos: ExtraPhotoEntry[] = []): string {
  const defects = data.defects ?? [];
  const nbiRatings = data.nbiRatings ?? [];
  const universalRatings = nbiRatings.filter((rating) => /^BC\d{2}$/.test(rating.item));
  const historicalRatings = nbiRatings.filter((rating) => !/^BC\d{2}$/.test(rating.item));
  const hasHistoricalRatings = historicalRatings.length > 0;
  const importSummary = data.importSummary;
  const structNum = data.structureNumber ?? "Unknown";
  const now = new Date().toLocaleString();

  const cs4 = defects.filter((d) => d.cs === "CS4").length;
  const critical = defects.filter((d) => d.isCritical).length;
  const needsVerify = defects.filter((d) => d.needsVerification).length;

  let globalPhotoIdx = 0;

  function photoImgCell(p: { uri?: string; description?: string; heading?: number | null }, num: number): string {
    const accessible =
      p.uri?.startsWith("http://") ||
      p.uri?.startsWith("https://") ||
      p.uri?.startsWith("data:");
    return accessible
      ? `<img src="${esc(p.uri)}" style="max-width:240px;max-height:160px;border-radius:4px;display:block" onerror="this.replaceWith(document.createTextNode('(image unavailable)'))" />`
      : `<span style="color:#94a3b8;font-style:italic">Stored on device</span>`;
  }

  // ── 1. COVER ────────────────────────────────────────────────────────────────
  const coverFields: [string, string][] = [
    ["Structure Number", structNum],
    ["Facility Carried", header.facilityCarried],
    ["Feature Crossed", header.featureCrossed],
    ["Inspection Date", header.inspectionDate],
    ["Inspected By", header.inspectors],
    ["Inspection Type(s)", header.inspectionType],
    ["Report Generated", now],
  ];
  const coverRows = coverFields
    .filter(([, v]) => v)
    .map(([label, value]) =>
      `<tr>
        <td style="padding:5px 16px 5px 0;color:#6b7280;white-space:nowrap;font-weight:600;font-size:11px">${esc(label)}</td>
        <td style="padding:5px 0;font-size:11px">${esc(value)}</td>
      </tr>`
    )
    .join("");

  const statsBlock = `
    <div class="stats">
      <div class="stat"><div class="val">${defects.length}</div><div class="lbl">Total Defects</div></div>
      <div class="stat"><div class="val" style="color:#ef4444">${cs4}</div><div class="lbl">CS4 Defects</div></div>
      <div class="stat"><div class="val" style="color:#f97316">${critical}</div><div class="lbl">Critical Findings</div></div>
      <div class="stat"><div class="val" style="color:#ca8a04">${needsVerify}</div><div class="lbl">Needs Verification</div></div>
    </div>`;

  // ── 2. LOCATION MAP ─────────────────────────────────────────────────────────
  const hasLocation = !!(header.latitude && header.longitude);
  const lat = parseFloat(header.latitude);
  const lon = parseFloat(header.longitude);
  const locationSection = hasLocation && !isNaN(lat) && !isNaN(lon) ? (() => {
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=14&size=600x300&markers=${lat},${lon},red-pushpin`;
    return `
    <h2>Location Map</h2>
    <table style="border-collapse:collapse;margin-bottom:12px">
      <tr>
        <td style="padding:4px 20px 4px 0;color:#6b7280;font-weight:600;font-size:11px;white-space:nowrap">Latitude</td>
        <td style="padding:4px 0;font-size:11px">${esc(String(lat))}</td>
      </tr>
      <tr>
        <td style="padding:4px 20px 4px 0;color:#6b7280;font-weight:600;font-size:11px;white-space:nowrap">Longitude</td>
        <td style="padding:4px 0;font-size:11px">${esc(String(lon))}</td>
      </tr>
    </table>
    <div style="margin-bottom:8px">
      <img
        src="${esc(mapUrl)}"
        alt="Location map for ${esc(structNum)}"
        style="max-width:600px;width:100%;border:1px solid #e5e7eb;border-radius:6px;display:block"
        onerror="this.replaceWith(document.createTextNode('(Map image unavailable \u2014 check internet connection)'))"
      />
    </div>
    <p style="font-size:10px;color:#9ca3af;margin-top:4px">\u00a9 OpenStreetMap contributors</p>`;
  })() : "";

  // ── 3. FOLLOW-UP ACTIONS ────────────────────────────────────────────────────
  const fuaDefects = defects.filter((d) => d.isCritical || d.isMaintenance);
  const fuaPhotoNums = new Map<string, number[]>();
  for (const d of fuaDefects) {
    const nums: number[] = [];
    for (const _p of (d.photos ?? [])) { globalPhotoIdx++; nums.push(globalPhotoIdx); }
    fuaPhotoNums.set(d.id, nums);
  }

  const fuaSection = fuaDefects.length === 0 ? "" : `
    <h2>Bridge Inspection Follow-Up Actions</h2>
    ${fuaDefects.map((d) => {
      const typeLabel = d.isCritical ? "&#9888; Critical Finding" : "&#128295; Maintenance Item";
      const typeColor = d.isCritical ? "#ef4444" : "#f97316";
      const nums = fuaPhotoNums.get(d.id) ?? [];
      const fuaPhotos = (d.photos ?? []).map((p, i) => {
        const num = nums[i];
        return `<div style="margin-top:12px;page-break-inside:avoid">
          <div style="font-size:11px;font-weight:700;margin-bottom:4px">PHOTO ${num}</div>
          <div style="font-size:10px;color:#64748b;margin-bottom:4px">
            ${esc(d.element)} &mdash; ${esc(d.defect)}
            ${p.description ? ` &nbsp;&middot;&nbsp; ${esc(p.description)}` : ""}
            ${p.heading != null ? ` &nbsp;&middot;&nbsp; ${esc(headingLabel(p.heading))}` : ""}
          </div>
          ${photoImgCell(p, num)}
        </div>`;
      }).join("");

      return `<div style="margin-bottom:24px;page-break-inside:avoid">
        <p style="font-size:12px;font-weight:700;color:${typeColor};margin-bottom:8px">${typeLabel}</p>
        <table style="border-collapse:collapse;width:100%;max-width:640px;font-size:11px">
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;white-space:nowrap">Bridge Component</td><td style="padding:4px 0">${esc(d.element)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;white-space:nowrap">Defect Type</td><td style="padding:4px 0">${esc(d.defect)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;white-space:nowrap">Condition States</td><td style="padding:4px 0;font-weight:700;color:${CS_COLORS[d.cs] ?? "#000"}">${esc(conditionBreakdown(d))}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;white-space:nowrap">Location</td><td style="padding:4px 0">${esc(d.location)}</td></tr>
          ${d.locationDesc ? `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;white-space:nowrap">Description / Notes</td><td style="padding:4px 0">${esc(d.locationDesc)}</td></tr>` : ""}
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;white-space:nowrap">Recommendation</td><td style="padding:4px 0">&nbsp;</td></tr>
        </table>
        ${fuaPhotos}
      </div>`;
    }).join("")}`;

  // ── 3. LOAD POSTING INFORMATION ─────────────────────────────────────────────
  const LOAD_CODES = ["58", "59", "60", "62"];
  const loadRatings = historicalRatings.filter((n) =>
    LOAD_CODES.includes(n.item)
    && !!n.subComponents[0]?.rating
    && !n.subComponents[0]?.isImported
  );
  const loadRows = loadRatings.map((n) => {
    const sub = n.subComponents[0];
    return `<tr>
      <td style="padding:5px 8px">${esc(ratingItemLabel(n.item))}</td>
      <td style="padding:5px 8px">${esc(n.description)}</td>
      <td style="padding:5px 8px;text-align:center;font-weight:700">${esc(sub?.rating ?? "—")}</td>
      <td style="padding:5px 8px">${esc(sub?.comments ?? "")}</td>
    </tr>`;
  }).join("");

  const loadSection = loadRatings.length > 0 ? `
    <h2>Historical NBI Load Posting (Reviewed)</h2>
    <table style="border-collapse:collapse;width:100%">
           <thead><tr style="background:#f9fafb">
             <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Item</th>
             <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Description</th>
             <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;color:#6b7280">Rating</th>
             <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Comments</th>
           </tr></thead>
           <tbody>${loadRows}</tbody>
         </table>` : "";

  // ── 4. UNIVERSAL CONDITION RATINGS + EXPLICIT HISTORICAL IMPORTS ─────────────
  const nbiRows = universalRatings.flatMap((n) =>
    n.subComponents.map((sub) => `<tr>
      <td style="padding:5px 8px">${esc(ratingItemLabel(n.item))}</td>
      <td style="padding:5px 8px">${esc(n.description)} — ${esc(sub.name)}</td>
      <td style="padding:5px 8px;text-align:center;font-weight:700">${esc(sub.rating || "—")}</td>
      <td style="padding:5px 8px">${esc(sub.comments || "")}</td>
    </tr>`)
  ).join("");

  const nbiSection = universalRatings.length === 0 ? "" : `
    <h2>${hasHistoricalRatings ? "Condition Ratings (SNBI and Historical Imports)" : "Condition Ratings (SNBI)"}</h2>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#f9fafb">
        <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">SNBI / Historical Item</th>
        <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Description</th>
        <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;color:#6b7280">Rating</th>
        <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Comments</th>
      </tr></thead>
      <tbody>${nbiRows}</tbody>
    </table>`;

  const historicalRows = historicalRatings.flatMap((rating) =>
    rating.subComponents
      .filter((component) =>
        component.isImported || component.rating || component.desc || component.comments
      )
      .map((component) => `<tr>
        <td style="padding:5px 8px">${esc(ratingItemLabel(rating.item))}</td>
        <td style="padding:5px 8px">${esc(rating.description)} — ${esc(component.name)}</td>
        <td style="padding:5px 8px;text-align:center;font-weight:700">${esc(component.rating || "—")}</td>
        <td style="padding:5px 8px;color:${component.isImported ? "#b45309" : "#047857"};font-weight:700">
          ${component.isImported ? "Pending review — not accepted" : "Reviewed"}
        </td>
        <td style="padding:5px 8px">${esc(component.comments || "")}</td>
      </tr>`)
  ).join("");
  const historicalSection = historicalRows ? `
    <h2>Historical NBI Import Review</h2>
    <p style="font-size:11px;color:#6b7280;margin-bottom:8px">Historical values are not active SNBI ratings. Pending values require inspector review.</p>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#fff7ed">
        <th style="padding:6px 8px;text-align:left">Historical Item</th>
        <th style="padding:6px 8px;text-align:left">Component</th>
        <th style="padding:6px 8px;text-align:center">Imported Rating</th>
        <th style="padding:6px 8px;text-align:left">Review Status</th>
        <th style="padding:6px 8px;text-align:left">Comments</th>
      </tr></thead>
      <tbody>${historicalRows}</tbody>
    </table>` : "";

  // ── 5. DEFECT RECORDS BY LOCATION ───────────────────────────────────────────
  const locations = sortedLocations(defects);

  const defectPhotoNums = new Map<string, number[]>();
  for (const d of defects) {
    if (fuaPhotoNums.has(d.id)) {
      defectPhotoNums.set(d.id, fuaPhotoNums.get(d.id)!);
    } else {
      const nums: number[] = [];
      for (const _p of (d.photos ?? [])) { globalPhotoIdx++; nums.push(globalPhotoIdx); }
      defectPhotoNums.set(d.id, nums);
    }
  }

  const defectSections = locations.map((loc) => {
    const locDefects = defects.filter((d) => d.location === loc);
    const rows = locDefects.map((d) => {
      const flags = [
        d.isCritical ? `<span style="color:#ef4444">&#9888; Critical</span>` : "",
        d.isMaintenance ? `<span style="color:#f97316">&#128295; Maint</span>` : "",
        d.needsVerification ? `<span style="color:#ca8a04">&#10003; Verify</span>` : "",
        d.isLegacy ? `<span style="color:#94a3b8">Legacy</span>` : "",
      ].filter(Boolean).join(" &nbsp;");

      const photos = d.photos ?? [];
      const nums = defectPhotoNums.get(d.id) ?? [];
      const photoBlock = photos.length
        ? `<tr><td colspan="7" style="padding:8px 12px 12px 24px;background:#f8fafc">
            <strong style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Photos (${photos.length})</strong>
            <table style="width:100%;margin-top:6px;border-collapse:collapse;font-size:10px">
              <tr style="background:#e2e8f0">
                <th style="padding:4px 8px;text-align:left">#</th>
                <th style="padding:4px 8px;text-align:left">Description</th>
                <th style="padding:4px 8px;text-align:left">Direction</th>
                <th style="padding:4px 8px;text-align:left">Image</th>
              </tr>
              ${photos.map((p, i) => `<tr>
                <td style="padding:4px 8px;vertical-align:top">PHOTO ${nums[i] ?? (i + 1)}</td>
                <td style="padding:4px 8px;vertical-align:top">${esc(p.description || "—")}</td>
                <td style="padding:4px 8px;vertical-align:top;white-space:nowrap">${p.heading != null ? headingLabel(p.heading) : "—"}</td>
                <td style="padding:4px 8px;vertical-align:top">${photoImgCell(p, nums[i] ?? (i + 1))}</td>
              </tr>`).join("")}
            </table>
          </td></tr>`
        : "";

      return `<tr>
        <td style="padding:6px 8px;white-space:nowrap;font-size:11px">
          <span style="color:#94a3b8">${esc(d.elementId)}</span>
          <span style="font-weight:500"> &mdash; ${esc(d.element)}</span>
        </td>
        <td style="padding:6px 8px;font-size:11px">${esc(d.defect)}</td>
        <td style="padding:6px 8px;text-align:center;font-weight:700;color:${CS_COLORS[d.cs] ?? "#000"};font-size:11px">${esc(conditionBreakdown(d))}</td>
        <td style="padding:6px 8px;text-align:center;font-size:11px">${esc(d.quantityValue || d.quantity)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#64748b">${esc(d.locationDesc || "")}</td>
        <td style="padding:6px 8px;font-size:10px">${flags || "—"}</td>
        <td style="padding:6px 8px;text-align:center">
          ${photos.length ? `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:9999px;font-size:10px">${photos.length}</span>` : "—"}
        </td>
      </tr>${photoBlock}`;
    }).join("");

    return `
      <h3 style="margin:24px 0 8px;font-size:13px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${esc(loc)}</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
        <thead><tr style="background:#f9fafb">
          <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Element</th>
          <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Defect</th>
          <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">CS</th>
          <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Qty</th>
          <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Notes</th>
          <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Flags</th>
          <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Photos</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }).join("");

  // ── 6. PHOTOS ────────────────────────────────────────────────────────────────
  type PhotoEntry = { photo: { uri?: string; description?: string; heading?: number | null }; element: string; defect: string; num: number };
  const photoInventory: PhotoEntry[] = [];
  let allPhotoIdx = 0;
  for (const d of defects) {
    for (const p of (d.photos ?? [])) {
      allPhotoIdx++;
      photoInventory.push({ photo: p, element: d.element, defect: d.defect, num: allPhotoIdx });
    }
  }

  const photosSection = photoInventory.length === 0 ? "" : `
    <h2>Photos</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${photoInventory.map((e) => {
        const dir = e.photo.heading != null ? headingLabel(e.photo.heading) : "";
        const desc = [e.photo.description, dir].filter(Boolean).join(", ");
        return `<div style="page-break-inside:avoid;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb">
            <div style="font-size:11px;font-weight:700">PHOTO ${e.num}</div>
            <div style="font-size:10px;color:#64748b;margin-top:1px">${esc(e.element)} &mdash; ${esc(e.defect)}</div>
            ${desc ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${esc(desc)}</div>` : ""}
          </div>
          <div style="padding:10px 12px">
            ${photoImgCell(e.photo, e.num)}
          </div>
        </div>`;
      }).join("")}
    </div>`;

  // ── 7. ADDITIONAL PHOTOS ─────────────────────────────────────────────────────
  const additionalPhotosSection = extraPhotos.length === 0 ? "" : `
    <h2>Additional Photos</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${extraPhotos.map((e, i) => {
        const tags = [...e.directionTags, ...e.subjectTags].filter(Boolean);
        const tagsLabel = tags.length ? tags.join(", ") : "";
        const dateLabel = e.capturedAt.toLocaleString();
        const imgHtml = e.dataUri
          ? `<img src="${esc(e.dataUri)}" style="max-width:240px;max-height:160px;border-radius:4px;display:block" />`
          : `<span style="color:#94a3b8;font-style:italic">Image unavailable</span>`;
        return `<div style="page-break-inside:avoid;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb">
            <div style="font-size:11px;font-weight:700">EXTRA PHOTO ${i + 1}</div>
            ${tagsLabel ? `<div style="font-size:10px;color:#64748b;margin-top:1px">${esc(tagsLabel)}</div>` : ""}
            <div style="font-size:10px;color:#9ca3af;margin-top:1px">${esc(dateLabel)}</div>
          </div>
          <div style="padding:10px 12px">
            ${imgHtml}
          </div>
        </div>`;
      }).join("")}
    </div>`;

  // ── IMPORT AUDIT (appended at end if present) ────────────────────────────────
  const importBlock = importSummary
    ? `<div style="margin-top:36px;padding-top:24px;border-top:2px solid #e5e7eb">
        <h2 style="font-size:15px;font-weight:700;color:#1f2937;margin-bottom:4px">Previous Report Import Audit</h2>
        <p style="font-size:11px;color:#6b7280;margin-bottom:16px">
          Imported from PDF on ${new Date(importSummary.timestamp).toLocaleString()}
        </p>
        <table style="border-collapse:collapse;font-size:11px;margin-bottom:16px">
          <tr><td style="padding:3px 20px 3px 0;color:#6b7280">Structure # Found</td><td style="font-weight:600">${importSummary.structureNumberFound ? "Yes" : "No"}</td></tr>
          <tr><td style="padding:3px 20px 3px 0;color:#6b7280">Elements Found</td><td style="font-weight:600">${importSummary.elementsFound}</td></tr>
          <tr><td style="padding:3px 20px 3px 0;color:#6b7280">Records Created</td><td style="font-weight:600">${importSummary.elementRecordsCreated}</td></tr>
          <tr><td style="padding:3px 20px 3px 0;color:#6b7280">Rating Items Filled</td><td style="font-weight:600">${importSummary.nbiFilledCount} / ${importSummary.nbiTotalCount}</td></tr>
        </table>
        ${
          importSummary.unmatchedComponents.length
            ? `<p style="font-size:11px;font-weight:600;color:#dc2626;margin-bottom:6px">
                Unmatched Components (${importSummary.unmatchedComponents.length})
               </p>
               <ul style="font-size:11px;color:#6b7280;padding-left:18px;margin:0">
                 ${importSummary.unmatchedComponents.map((c) => `<li>${esc(c)}</li>`).join("")}
               </ul>`
            : ""
        }
      </div>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2937;line-height:1.5;padding:32px 24px;max-width:960px">
    <h1>Bridge Inspection Report</h1>
    <p class="meta">Generated: ${esc(now)} &nbsp;&middot;&nbsp; ${defects.length} defect records</p>
    <table style="border-collapse:collapse;margin-bottom:4px">${coverRows}</table>
    ${statsBlock}
    ${locationSection}
    ${fuaSection}
    ${loadSection}
    ${nbiSection}
    ${historicalSection}
    <h2>Defect Records by Location</h2>
    ${defects.length === 0 ? `<p style="color:#6b7280;font-style:italic">No defect records in this session.</p>` : defectSections}
    ${photosSection}
    ${additionalPhotosSection}
    ${importBlock}
  </div>`;
}

function generatePrintHtml(data: SessionData, header: ReportHeader = EMPTY_HEADER, extraPhotos: ExtraPhotoEntry[] = []): string {
  const structNum = data.structureNumber ?? "Unknown";
  const content = buildReportContentHtml(data, header, extraPhotos);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Bridge Inspection Report \u2014 ${esc(structNum)}</title>
  <style>
    ${REPORT_STYLES}
    .print-bar{background:#1e293b;color:#fff;padding:12px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:10}
    .print-btn{background:#3b82f6;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
    .print-btn:hover{background:#2563eb}
    @media print{.print-bar{display:none!important}}
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">&#128424; Print / Save as PDF</button>
    <span style="font-size:13px">Bridge Inspection Report &mdash; ${esc(structNum)}</span>
  </div>
  ${content}
</body>
</html>`;
}

interface Props {
  sessionData: SessionData | null;
  setSessionData: (data: SessionData | null) => void;
}

export default function ReviewExport({ sessionData, setSessionData }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [exporting, setExporting] = useState<"excel" | "word" | "pdf" | "redline" | "annotations" | null>(null);
  const [showReportHeader, setShowReportHeader] = useState(true);
  const [pdfAnnotations, setPdfAnnotations] = useState<Annotation[]>([]);
  const [reportHeader, setReportHeader] = useState<ReportHeader>(() => {
    const today = new Date();
    const todayFormatted = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
    const DEFAULTS = {
      facilityCarried: "",
      featureCrossed: "",
      inspectionDate: todayFormatted,
      inspectors: "",
      inspectionType: "Routine",
      latitude: "",
      longitude: "",
    };
    try {
      const raw = localStorage.getItem("bridge_report_header_last");
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...DEFAULTS, ...saved, inspectionDate: saved.inspectionDate || todayFormatted };
      }
    } catch { /* ignore */ }
    return DEFAULTS;
  });

  const { data: sessions, isLoading: listLoading, isError: listError, refetch, isFetching } =
    useListSessions({ query: { queryKey: getListSessionsQueryKey(), refetchInterval: 60_000 } });

  const { data: sessionDetail, isLoading: detailLoading } = useGetSession(selectedId, {
    query: { queryKey: getGetSessionQueryKey(selectedId), enabled: !!selectedId },
  });

  useEffect(() => {
    if (!sessionDetail) return;
    const data: SessionData = {
      structureNumber: sessionDetail.structureNumber,
      teamLeader: sessionDetail.teamLeader,
      teamMembers: sessionDetail.teamMembers,
      inspectionDate: sessionDetail.inspectionDate,
      weather: sessionDetail.weather,
      equipmentUsed: sessionDetail.equipmentUsed,
      defects: sessionDetail.defects as DefectRecord[],
      nbiRatings: sessionDetail.nbiRatings as NbiRating[],
      importSummary: (sessionDetail.importSummary as ImportSummary | null) ?? null,
    };
    setSessionData(data);

    const rawAnns = (sessionDetail.pdfAnnotations ?? []) as Annotation[];
    setPdfAnnotations(rawAnns);

    const structureNumber = sessionDetail.structureNumber;

    const openReport = (extraPhotos: ExtraPhotoEntry[]) => {
      const html = generatePrintHtml(data, reportHeader, extraPhotos);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    };

    const fetchExtraPhotos = async (): Promise<ExtraPhotoEntry[]> => {
      try {
        const metaRes = await fetch(`/api/sessions/photos/${encodeURIComponent(structureNumber)}`);
        if (!metaRes.ok) return [];
        const photoMeta = (await metaRes.json()) as Array<{
          photoId: string;
          mimeType: string;
          description: string | null;
          createdAt: string;
        }>;
        const extraMeta = photoMeta.filter((p) => p.photoId.startsWith("extra_"));
        return await Promise.all(
          extraMeta.map(async (p): Promise<ExtraPhotoEntry> => {
            let directionTags: string[] = [];
            let subjectTags: string[] = [];
            try {
              const parsed = JSON.parse(p.description ?? "{}") as {
                directionTags?: string[];
                subjectTags?: string[];
              };
              directionTags = parsed.directionTags ?? [];
              subjectTags = parsed.subjectTags ?? [];
            } catch { /* ignore */ }

            let dataUri: string | null = null;
            try {
              const photoRes = await fetch(
                `/api/sessions/photos/${encodeURIComponent(structureNumber)}/${encodeURIComponent(p.photoId)}`,
              );
              if (photoRes.ok) {
                const blobData = await photoRes.blob();
                dataUri = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blobData);
                });
              }
            } catch { /* ignore — best-effort */ }

            return {
              photoId: p.photoId,
              dataUri,
              directionTags,
              subjectTags,
              capturedAt: new Date(p.createdAt),
            };
          }),
        );
      } catch {
        return [];
      }
    };

    fetchExtraPhotos().then((extraPhotos) => {
      openReport(extraPhotos);
    });

    setSelectedId("");
  }, [sessionDetail, setSessionData]);

  const hydratedStructureRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("bridge_report_header_last", JSON.stringify(reportHeader));
      if (
        sessionData?.structureNumber &&
        hydratedStructureRef.current === sessionData.structureNumber
      ) {
        localStorage.setItem(
          `bridge_report_header_${sessionData.structureNumber}`,
          JSON.stringify(reportHeader),
        );
      }
    } catch { /* ignore quota errors */ }
  }, [reportHeader, sessionData?.structureNumber]);

  useEffect(() => {
    if (!sessionData?.structureNumber) return;
    try {
      const raw = localStorage.getItem(`bridge_report_header_${sessionData.structureNumber}`);
      if (raw) {
        const saved = JSON.parse(raw);
        setReportHeader((prev) => ({ ...prev, ...saved }));
      }
    } catch { /* ignore */ }
    hydratedStructureRef.current = sessionData.structureNumber;
  }, [sessionData?.structureNumber]);

  const defects = sessionData?.defects ?? [];
  const nbiRatings = sessionData?.nbiRatings ?? [];
  const universalRatings = nbiRatings.filter((rating) => /^BC\d{2}$/.test(rating.item));
  const historicalRatings = nbiRatings.filter((rating) => !/^BC\d{2}$/.test(rating.item));
  const hasHistoricalRatings = historicalRatings.length > 0;

  const hasRedlinePdf = pdfAnnotations.some((a) => a.type !== "_meta");
  const pdfAvailable = !!sessionData?.structureNumber;

  const exportExcel = useCallback(() => {
    setExporting("excel");
    try {
      const wb = XLSX.utils.book_new();
      const structNum = sessionData?.structureNumber ?? "";

      const summaryRows = [
        ["Bridge Inspection Report"],
        ["Structure Number", structNum],
        ["Total Records", defects.length],
        ["Critical Findings", defects.filter((d) => d.isCritical).length],
        ["Maintenance Items", defects.filter((d) => d.isMaintenance).length],
        ["Needs Verification", defects.filter((d) => d.needsVerification).length],
        [],
        ["CS Quantity Distribution"],
        ["CS", "Quantity", "Percentage"],
        ...CS_STATES.map((cs) => {
          const quantity = defects.reduce(
            (sum, defect) => sum + (parseFloat(conditionQuantities(defect)[cs] || "") || 0),
            0,
          );
          const totalQuantity = defects.reduce(
            (sum, defect) => sum + CS_STATES.reduce(
              (stateSum, state) => stateSum + (parseFloat(conditionQuantities(defect)[state] || "") || 0),
              0,
            ),
            0,
          );
          return [cs, quantity, totalQuantity ? `${Math.round((quantity / totalQuantity) * 100)}%` : "0%"];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

      const headers = [
        "Location", "Element ID", "Element", "Defect", "CS", "CS1 Qty", "CS2 Qty", "CS3 Qty", "CS4 Qty",
        "Total Quantity", "Maint Qty", "Environment", "Size", "Location Desc",
        "Critical", "Maintenance", "Needs Verify", "Legacy", "Photos", "Photo Directions",
      ];
      const rows = defects.map((d) => [
        d.location, d.elementId, d.element, d.defect, conditionBreakdown(d),
        ...CS_STATES.map((state) => conditionQuantities(d)[state] || ""),
        d.quantityValue || d.quantity, d.maintenanceQuantityValue, d.environment,
        d.size, d.locationDesc,
        d.isCritical ? "Yes" : "",
        d.isMaintenance ? "Yes" : "",
        d.needsVerification ? "Yes" : "",
        d.isLegacy ? "Yes" : "",
        (d.photos ?? []).length,
        (d.photos ?? [])
          .filter((p) => p.heading != null)
          .map((p) => headingLabel(p.heading))
          .join("; "),
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "All Defects");

      if (nbiRatings.length > 0) {
        const nbiRows = universalRatings.flatMap((n) =>
          n.subComponents.map((sub) => [
            ratingItemLabel(n.item),
            `${n.description} — ${sub.name}`,
            sub.rating || "",
            sub.comments || "",
          ])
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([["Item", "Description", "Rating", "Comments"], ...nbiRows]),
          "Condition Ratings",
        );
        const historicalRows = historicalRatings.flatMap((rating) =>
          rating.subComponents
            .filter((component) =>
              component.isImported || component.rating || component.desc || component.comments
            )
            .map((component) => [
              ratingItemLabel(rating.item),
              `${rating.description} — ${component.name}`,
              component.rating || "",
              component.isImported ? "Pending review — not accepted" : "Reviewed",
              component.comments || "",
            ])
        );
        if (historicalRows.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.aoa_to_sheet([
              ["Historical Item", "Component", "Imported Rating", "Review Status", "Comments"],
              ...historicalRows,
            ]),
            "Historical Review",
          );
        }
      }

      sortedLocations(defects).slice(0, 20).forEach((loc) => {
        const locDefects = defects.filter((d) => d.location === loc);
        const locRows = locDefects.map((d) => [
          d.elementId, d.element, d.defect, conditionBreakdown(d),
          d.quantityValue || d.quantity, d.locationDesc,
          d.isCritical ? "Yes" : "", d.needsVerification ? "Yes" : "",
        ]);
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([["Element ID", "Element", "Defect", "CS", "Qty", "Notes", "Critical", "Verify"], ...locRows]),
          loc.substring(0, 31),
        );
      });

      XLSX.writeFile(wb, `${structNum || "bridge"}_inspection.xlsx`);
    } finally {
      setExporting(null);
    }
  }, [sessionData, defects, nbiRatings]);

  const exportWord = useCallback(async () => {
    setExporting("word");
    try {
      const structNum = sessionData?.structureNumber ?? "";

      async function fetchPhotoBase64(uri: string): Promise<{ b64: string; type: "jpg" | "png" | "gif" | "bmp" } | null> {
        if (!uri) return null;
        try {
          if (uri.startsWith("data:image/")) {
            const m = uri.match(/^data:image\/(\w+);base64,(.+)$/s);
            if (!m) return null;
            const sub = m[1].toLowerCase();
            const imgType = sub === "jpeg" ? "jpg" : (["png", "gif", "bmp"].includes(sub) ? sub as "png" | "gif" | "bmp" : "jpg");
            return { b64: m[2], type: imgType };
          }
          if (uri.startsWith("http://") || uri.startsWith("https://")) {
            const resp = await fetch(uri);
            if (!resp.ok) return null;
            const ct = resp.headers.get("content-type") ?? "";
            const imgType: "jpg" | "png" | "gif" | "bmp" = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpg";
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return { b64: btoa(bin), type: imgType };
          }
        } catch { /* unreachable or CORS blocked */ }
        return null;
      }

      function dirLabel(deg: number | null | undefined): string {
        if (deg == null) return "";
        const names = ["north","north-northeast","northeast","east-northeast","east","east-southeast",
          "southeast","south-southeast","south","south-southwest","southwest","west-southwest",
          "west","west-northwest","northwest","north-northwest"];
        return "looking " + names[Math.round(deg / 22.5) % 16];
      }

      type PhotoEntry = { photo: { uri: string; description: string; heading?: number | null }; element: string; defect: string; num: number };
      const photoInventory: PhotoEntry[] = [];
      let photoIdx = 0;
      for (const d of defects) {
        for (const p of (d.photos ?? [])) {
          photoIdx++;
          photoInventory.push({ photo: p, element: d.element, defect: d.defect, num: photoIdx });
        }
      }

      const photoDataMap = new Map<number, { b64: string; type: "jpg" | "png" | "gif" | "bmp" } | null>();
      await Promise.all(photoInventory.map(async (e) => {
        photoDataMap.set(e.num, await fetchPhotoBase64(e.photo.uri));
      }));

      function buildPhotoBlock(e: PhotoEntry, w: number, h: number): Paragraph[] {
        const dir = dirLabel(e.photo.heading);
        const raw = e.photo.description ?? "";
        const desc = raw && dir ? `${raw}, ${dir}` : raw || dir;
        const paras: Paragraph[] = [];
        paras.push(new Paragraph({ children: [new TextRun({ text: `PHOTO ${e.num}`, bold: true, size: 26 })] }));
        if (e.element || e.defect) {
          paras.push(new Paragraph({ children: [new TextRun({ text: [e.element, e.defect].filter(Boolean).join(" \u2014 "), color: "555555" })] }));
        }
        if (desc) {
          paras.push(new Paragraph({ children: [new TextRun({ text: `Description: ${desc}` })] }));
        }
        const imgData = photoDataMap.get(e.num);
        if (imgData) {
          paras.push(new Paragraph({
            children: [new ImageRun({ data: imgData.b64, transformation: { width: w, height: h }, type: imgData.type })],
          }));
        } else if (e.photo.uri && (e.photo.uri.startsWith("http://") || e.photo.uri.startsWith("https://"))) {
          paras.push(new Paragraph({ children: [new TextRun({ text: "(image unavailable)", italics: true, color: "888888" })] }));
        } else {
          paras.push(new Paragraph({ children: [new TextRun({ text: "(image stored on device)", italics: true, color: "888888" })] }));
        }
        paras.push(new Paragraph({ text: "" }));
        return paras;
      }

      const children: (Paragraph | Table)[] = [];

      // ── 1. COVER ────────────────────────────────────────────────────────────
      children.push(new Paragraph({ text: "Bridge Inspection Report", heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph({ text: "" }));
      const coverFields: [string, string][] = [
        ["Structure Number", structNum || "(not set)"],
        ["Facility Carried", reportHeader.facilityCarried],
        ["Feature Crossed", reportHeader.featureCrossed],
        ["Inspection Date", reportHeader.inspectionDate],
        ["Inspected By", reportHeader.inspectors],
        ["Inspection Type(s)", reportHeader.inspectionType],
        ["Report Generated", new Date().toLocaleString()],
      ];
      for (const [label, value] of coverFields) {
        if (!value) continue;
        children.push(new Paragraph({
          children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)],
        }));
      }
      children.push(new Paragraph({ text: "" }));

      // ── 2. LOCATION MAP ───────────────────────────────────────────────────
      const hasLoc = !!(reportHeader.latitude && reportHeader.longitude);
      const wLat = parseFloat(reportHeader.latitude);
      const wLon = parseFloat(reportHeader.longitude);
      if (hasLoc && !isNaN(wLat) && !isNaN(wLon)) {
        children.push(new Paragraph({ text: "Location Map", heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({
          children: [new TextRun({ text: "Latitude: ", bold: true }), new TextRun(String(wLat))],
        }));
        children.push(new Paragraph({
          children: [new TextRun({ text: "Longitude: ", bold: true }), new TextRun(String(wLon))],
        }));
        const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${wLat},${wLon}&zoom=14&size=600x300&markers=${wLat},${wLon},red-pushpin`;
        const mapImgData = await fetchPhotoBase64(mapUrl);
        if (mapImgData) {
          children.push(new Paragraph({
            children: [new ImageRun({ data: mapImgData.b64, transformation: { width: 480, height: 240 }, type: mapImgData.type })],
          }));
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: "(Map image unavailable \u2014 check internet connection)", italics: true, color: "888888" })] }));
        }
        children.push(new Paragraph({ children: [new TextRun({ text: "\u00a9 OpenStreetMap contributors", color: "9ca3af", size: 16 })] }));
        children.push(new Paragraph({ text: "" }));
      }

      // ── 3. FOLLOW-UP ACTIONS ──────────────────────────────────────────────
      const fuaDefects = defects.filter((d) => d.isCritical || d.isMaintenance);
      if (fuaDefects.length > 0) {
        children.push(new Paragraph({ text: "Bridge Inspection Follow-Up Actions", heading: HeadingLevel.HEADING_2 }));
        for (const d of fuaDefects) {
          children.push(new Paragraph({ text: "" }));
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${d.isCritical ? "Critical Finding" : "Maintenance Item"}: `, bold: true }),
              new TextRun(d.element || ""),
            ],
          }));
          const fuaRows: TableRow[] = [
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bridge Component", bold: true })] })] }),
              new TableCell({ children: [new Paragraph(d.element || "")] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Defect Type", bold: true })] })] }),
              new TableCell({ children: [new Paragraph(d.defect || "")] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Condition States", bold: true })] })] }),
              new TableCell({ children: [new Paragraph(conditionBreakdown(d))] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Location", bold: true })] })] }),
              new TableCell({ children: [new Paragraph(d.location || "")] }),
            ]}),
          ];
          if (d.locationDesc) {
            fuaRows.push(new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description / Notes", bold: true })] })] }),
              new TableCell({ children: [new Paragraph(d.locationDesc)] }),
            ]}));
          }
          fuaRows.push(new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Recommendation", bold: true })] })] }),
            new TableCell({ children: [new Paragraph("")] }),
          ]}));
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: fuaRows }));
          for (const p of (d.photos ?? [])) {
            const entry = photoInventory.find((e) => e.photo === p);
            if (entry) children.push(...buildPhotoBlock(entry, 400, 300));
          }
        }
        children.push(new Paragraph({ text: "" }));
      }

      // ── 3. REVIEWED HISTORICAL NBI LOAD POSTING ────────────────────────────
      const LOAD_CODES = ["58", "59", "60", "62"];
      const loadRatings = historicalRatings.filter((n) =>
        LOAD_CODES.includes(n.item)
        && !!n.subComponents[0]?.rating
        && !n.subComponents[0]?.isImported
      );
      if (loadRatings.length > 0) {
        children.push(new Paragraph({ text: "Historical NBI Load Posting (Reviewed)", heading: HeadingLevel.HEADING_2 }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["Item", "Description", "Rating", "Comments"].map(
                (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
              ),
            }),
            ...loadRatings.map((n) => {
              const sub = n.subComponents[0];
              return new TableRow({
                children: [n.item, n.description, sub?.rating ?? "\u2014", sub?.comments ?? ""].map(
                  (v) => new TableCell({ children: [new Paragraph(v)] }),
                ),
              });
            }),
          ],
        }));
        children.push(new Paragraph({ text: "" }));
      }

      // ── 4. CONDITION RATINGS ────────────────────────────────────────────────
      if (universalRatings.length > 0) {
        children.push(new Paragraph({
          text: hasHistoricalRatings
            ? "Condition Ratings (SNBI and Historical Imports)"
            : "Condition Ratings (SNBI)",
          heading: HeadingLevel.HEADING_2,
        }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["Item", "Description", "Rating", "Comments"].map(
                (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
              ),
            }),
            ...universalRatings.flatMap((n) => n.subComponents.map((sub) => {
              return new TableRow({
                children: [ratingItemLabel(n.item), `${n.description} — ${sub.name}`, sub.rating || "\u2014", sub.comments || ""].map(
                  (v) => new TableCell({ children: [new Paragraph(v)] }),
                ),
              });
            })),
          ],
        }));
        children.push(new Paragraph({ text: "" }));
      }
      const historicalRows = historicalRatings.flatMap((rating) =>
        rating.subComponents
          .filter((component) =>
            component.isImported || component.rating || component.desc || component.comments
          )
          .map((component) => new TableRow({
            children: [
              ratingItemLabel(rating.item),
              `${rating.description} — ${component.name}`,
              component.rating || "\u2014",
              component.isImported ? "Pending review — not accepted" : "Reviewed",
              component.comments || "",
            ].map((value) => new TableCell({ children: [new Paragraph(value)] })),
          }))
      );
      if (historicalRows.length > 0) {
        children.push(new Paragraph({ text: "Historical NBI Import Review", heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({
          children: [new TextRun({
            text: "Historical values are not active SNBI ratings. Pending values require inspector review.",
            italics: true,
          })],
        }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["Historical Item", "Component", "Imported Rating", "Review Status", "Comments"].map(
                (heading) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: heading, bold: true })] })] }),
              ),
            }),
            ...historicalRows,
          ],
        }));
        children.push(new Paragraph({ text: "" }));
      }

      // ── 5. DEFECT RECORDS BY LOCATION ──────────────────────────────────────
      children.push(new Paragraph({ text: "Defect Records by Location", heading: HeadingLevel.HEADING_2 }));
      if (defects.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: "No defect records in this session.", italics: true })] }));
      } else {
        sortedLocations(defects).forEach((loc) => {
          const locDefects = defects.filter((d) => d.location === loc);
          children.push(new Paragraph({ text: loc, heading: HeadingLevel.HEADING_3 }));
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["Element", "Defect", "CS", "Qty", "Notes", "Flags"].map(
                  (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
                ),
              }),
              ...locDefects.map((d) => {
                const flags = [
                  d.isCritical ? "Critical" : "",
                  d.isMaintenance ? "Maintenance" : "",
                  d.needsVerification ? "Needs Verify" : "",
                  d.isLegacy ? "Legacy" : "",
                ].filter(Boolean).join(", ");
                return new TableRow({
                  children: [
                    `${d.elementId} \u2014 ${d.element}`,
                    d.defect,
                    conditionBreakdown(d),
                    d.quantityValue || d.quantity,
                    d.locationDesc || "",
                    flags || "\u2014",
                  ].map((v) => new TableCell({ children: [new Paragraph(v)] })),
                });
              }),
            ],
          }));
          children.push(new Paragraph({ text: "" }));
        });
      }

      // ── 6. PHOTOS ──────────────────────────────────────────────────────────
      if (photoInventory.length > 0) {
        children.push(new Paragraph({ text: "Photos", heading: HeadingLevel.HEADING_2 }));
        for (const e of photoInventory) {
          children.push(...buildPhotoBlock(e, 480, 360));
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${structNum || "bridge"}_inspection.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [sessionData, defects, nbiRatings, reportHeader]);

  const exportPdf = useCallback(async () => {
    if (!sessionData) return;
    setExporting("pdf");
    const structNum = sessionData.structureNumber ?? "bridge";
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:960px;background:#fff";
    container.innerHTML = `<style>${REPORT_STYLES}</style>${buildReportContentHtml(sessionData, reportHeader)}`;
    document.body.appendChild(container);
    try {
      const { jsPDF } = await import("jspdf");
      await import("html2canvas");
      const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
      await new Promise<void>((resolve, reject) => {
        pdf.html(container, {
          callback(doc) {
            try { doc.save(`bridge_report_${structNum}.pdf`); resolve(); }
            catch (e) { reject(e); }
          },
          margin: [24, 20, 24, 20],
          autoPaging: "text",
          width: 572,
          windowWidth: 960,
        });
      });
    } catch (e) {
      alert("Could not generate PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      document.body.removeChild(container);
      setExporting(null);
    }
  }, [sessionData, reportHeader]);

  const exportRedlinePdf = useCallback(async () => {
    if (!sessionData?.structureNumber) return;
    setExporting("redline");
    try {
      const structNum = sessionData.structureNumber;
      const pdfUrl = `/api/sessions/pdf/${encodeURIComponent(structNum)}`;
      const resp = await fetch(pdfUrl);
      if (!resp.ok) throw new Error(`Could not fetch PDF: ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).href;

      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

      const metaEntry = pdfAnnotations.find((a) => a.type === "_meta");
      const pageDims = metaEntry?.pageDimensions ?? {};
      const realAnns = pdfAnnotations.filter((a) => a.type !== "_meta");

      const pageDataUrls: string[] = [];
      const RENDER_WIDTH = 1200;

      for (let pn = 1; pn <= pdfDoc.numPages; pn++) {
        const page = await pdfDoc.getPage(pn);
        const baseVp = page.getViewport({ scale: 1 });
        const scale = RENDER_WIDTH / baseVp.width;
        const vp = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const stored = pageDims[String(pn)];
        const mobileW = stored?.w ?? FALLBACK_MOBILE_CANVAS_WIDTH;
        const mobileH = stored?.h ?? (FALLBACK_MOBILE_CANVAS_WIDTH / baseVp.width) * baseVp.height;
        const sx = vp.width / mobileW;
        const sy = vp.height / mobileH;

        for (const ann of realAnns.filter((a) => a.page === pn)) {
          if (ann.type === "text") drawText(ctx, ann, sx, sy);
          else drawStroke(ctx, ann, sx, sy);
        }

        pageDataUrls.push(canvas.toDataURL("image/png"));
      }

      const imgTags = pageDataUrls
        .map((url, i) =>
          `<img src="${url}" style="width:100%;display:block;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.2);page-break-after:always" alt="Page ${i + 1}" />`,
        )
        .join("");

      const html = `<!DOCTYPE html><html><head>
        <meta charset="UTF-8"/>
        <title>Redline PDF \u2014 ${esc(structNum)}</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#e5e7eb;font-family:Arial,sans-serif}
          .bar{background:#1e293b;color:#fff;padding:12px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:10}
          .print-btn{background:#3b82f6;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
          .print-btn:hover{background:#2563eb}
          .content{max-width:900px;margin:0 auto;padding:24px}
          @media print{.bar{display:none!important}body{background:#fff}.content{padding:0;max-width:100%}}
        </style>
      </head><body>
        <div class="bar">
          <button class="print-btn" onclick="window.print()">&#128424; Save / Print as PDF</button>
          <span style="font-size:13px">Redline PDF \u2014 ${esc(structNum)} (${pageDataUrls.length} page${pageDataUrls.length !== 1 ? "s" : ""})</span>
        </div>
        <div class="content">${imgTags}</div>
      </body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert("Could not generate redline PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(null);
    }
  }, [sessionData, pdfAnnotations]);

  const exportAnnotationsWord = useCallback(async () => {
    if (!sessionData?.structureNumber) return;
    setExporting("annotations");
    try {
      const structNum = sessionData.structureNumber;
      const realAnns = pdfAnnotations.filter((a) => a.type !== "_meta");

      if (realAnns.length === 0) {
        alert("No annotations found for this inspection.");
        return;
      }

      const byPage = new Map<number, Annotation[]>();
      for (const ann of realAnns) {
        const pg = ann.page ?? 1;
        if (!byPage.has(pg)) byPage.set(pg, []);
        byPage.get(pg)!.push(ann);
      }

      const children: (Paragraph | Table)[] = [];

      children.push(new Paragraph({ text: "PDF Annotation Report", heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph({
        children: [new TextRun({ text: "Structure Number: ", bold: true }), new TextRun(structNum)],
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: "Total Annotations: ", bold: true }), new TextRun(String(realAnns.length))],
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: "Generated: ", bold: true }), new TextRun(new Date().toLocaleString())],
      }));
      children.push(new Paragraph({ text: "" }));

      const sortedPages = Array.from(byPage.keys()).sort((a, b) => a - b);

      for (const pg of sortedPages) {
        const anns = byPage.get(pg)!;
        children.push(new Paragraph({ text: `Page ${pg}`, heading: HeadingLevel.HEADING_2 }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["#", "Type", "Color", "Content"].map(
                (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
              ),
            }),
            ...anns.map((ann, i) => {
              const typeLabel = ann.type === "highlight" ? "Highlight" : ann.type === "text" ? "Text label" : "Freehand stroke";
              const content = ann.text
                ? ann.text
                : ann.type === "stroke" || ann.type === "highlight"
                  ? `${(ann.points ?? []).length} point stroke`
                  : "\u2014";
              return new TableRow({
                children: [String(i + 1), typeLabel, ann.color ?? "(red)", content].map(
                  (v) => new TableCell({ children: [new Paragraph(v)] }),
                ),
              });
            }),
          ],
        }));
        children.push(new Paragraph({ text: "" }));
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${structNum || "bridge"}_annotations.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [sessionData, pdfAnnotations]);

  const loadSession = (id: string) => {
    setSelectedId(id);
  };

  const clearSession = () => {
    setSessionData(null);
    setPdfAnnotations([]);
    setSelectedId("");
  };

  const reopenReport = () => {
    if (!sessionData) return;
    const html = generatePrintHtml(sessionData, reportHeader);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review & Export</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sessionData
              ? <>Structure: <span className="text-foreground font-semibold">{sessionData.structureNumber}</span> — report opened in new window</>
              : "Select a synced session to open its report and download exports."}
          </p>
        </div>
        {sessionData && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={reopenReport}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/40 rounded-md px-3 py-1.5 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Re-open Report
            </button>
            <button
              onClick={clearSession}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
            >
              <X className="h-3 w-3" />
              Change
            </button>
          </div>
        )}
      </div>

      {/* Session picker */}
      <div className="bg-card border border-border rounded-lg mb-5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Synced Sessions
            </span>
          </div>
          <button
            onClick={() => { void refetch(); queryClient.invalidateQueries({ queryKey: [SESSION_PHOTOS_QUERY_KEY] }); }}
            disabled={isFetching}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {listLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading sessions…
          </div>
        ) : listError ? (
          <div className="px-4 py-6 text-center text-sm text-destructive">
            Could not reach the server. Is the API running?
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Database className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No sessions synced yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use &ldquo;Sync to Cloud&rdquo; in the mobile app to upload inspection data.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {sessions.map((s) => {
              const isSelected = sessionData?.structureNumber === s.structureNumber;
              const isRowLoading = detailLoading && selectedId === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors ${
                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.structureNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.defectCount} defects
                      {s.cs4Count > 0 && (
                        <span className="ml-1.5 text-red-400 font-medium">· {s.cs4Count} CS4</span>
                      )}
                      <span className="ml-1.5">· synced {formatRelativeTime(s.syncedAt)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => loadSession(s.id)}
                    disabled={isRowLoading || (isSelected && !detailLoading)}
                    className={`ml-4 flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary hover:bg-secondary/80 text-foreground"
                    } disabled:opacity-50`}
                  >
                    {isRowLoading ? (
                      "Loading…"
                    ) : isSelected ? (
                      <><ExternalLink className="h-3 w-3" /> Opened</>
                    ) : (
                      <><ExternalLink className="h-3 w-3" /> Open</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Header (for Word export) */}
      {sessionData && (
        <div className="bg-card border border-border rounded-lg mb-4 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30 text-left"
            onClick={() => setShowReportHeader((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Report Header
              </span>
              <span className="text-xs text-muted-foreground/50 normal-case font-normal">
                — optional fields for the Word export
              </span>
            </div>
            {showReportHeader
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          </button>
          {showReportHeader && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                { key: "facilityCarried", label: "Facility Carried", placeholder: "e.g. MAIN ST" },
                { key: "featureCrossed",  label: "Feature Crossed",  placeholder: "e.g. MUDDY CREEK" },
                { key: "inspectionDate",  label: "Inspection Date",  placeholder: "e.g. 03/18/2023" },
                { key: "inspectors",      label: "Inspected By",     placeholder: "e.g. Jane Smith, PE" },
                { key: "latitude",        label: "Latitude",         placeholder: "e.g. 30.2672" },
                { key: "longitude",       label: "Longitude",        placeholder: "e.g. -97.7431" },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                  <input
                    className="w-full bg-secondary border border-border rounded-md text-xs px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={placeholder}
                    value={reportHeader[key]}
                    onChange={(e) => setReportHeader((h) => ({ ...h, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Inspection Type</label>
                <select
                  className="w-full bg-secondary border border-border rounded-md text-xs px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={reportHeader.inspectionType}
                  onChange={(e) => setReportHeader((h) => ({ ...h, inspectionType: e.target.value }))}
                >
                  {["Routine", "In-Depth", "Fracture Critical", "Underwater", "Special", "Other"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export buttons */}
      {sessionData && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Downloads</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              data-testid="button-export-excel"
              onClick={exportExcel}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button
              data-testid="button-export-word"
              onClick={exportWord}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              {exporting === "word" ? "Exporting…" : "Word (.docx)"}
            </button>
            <button
              data-testid="button-export-pdf"
              onClick={exportPdf}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              {exporting === "pdf" ? "Generating…" : "Download PDF"}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1" />

            <button
              data-testid="button-export-redline"
              onClick={exportRedlinePdf}
              disabled={exporting !== null || !pdfAvailable}
              title={!pdfAvailable ? "No PDF uploaded for this session" : hasRedlinePdf ? "Render PDF with annotations" : "No annotations — renders clean PDF pages"}
              className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            >
              <PenLine className="h-3.5 w-3.5" />
              {exporting === "redline" ? "Rendering…" : "Redline PDF"}
            </button>
            <button
              data-testid="button-export-annotations"
              onClick={exportAnnotationsWord}
              disabled={exporting !== null || !hasRedlinePdf}
              title={!hasRedlinePdf ? "No annotations recorded for this session" : "Download annotation log as Word document"}
              className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              {exporting === "annotations" ? "Exporting…" : "Annotations (.docx)"}
            </button>
          </div>

          {/* Quick stats row */}
          <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-4">
            {[
              { label: "Defects", value: defects.length, color: "text-foreground" },
              { label: "CS4", value: defects.filter((d) => d.cs === "CS4").length, color: "text-red-400" },
              { label: "Critical", value: defects.filter((d) => d.isCritical).length, color: "text-orange-400" },
              { label: "Condition Ratings", value: universalRatings.length, color: "text-blue-400" },
              { label: "Annotations", value: pdfAnnotations.filter((a) => a.type !== "_meta").length, color: "text-violet-400" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <span className={`text-lg font-bold ${color}`}>{value}</span>
                <span className="text-xs text-muted-foreground ml-1">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
