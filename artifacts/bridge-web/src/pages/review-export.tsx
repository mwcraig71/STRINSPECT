import { useState, useCallback, useEffect } from "react";
import {
  FileSpreadsheet, FileText, Search, AlertTriangle, CheckCircle,
  RefreshCw, Camera, Compass, Database, FileDown, X, ChevronDown, ChevronUp,
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

const CS_COLORS: Record<string, string> = {
  CS1: "#22c55e", CS2: "#eab308", CS3: "#f97316", CS4: "#ef4444",
};
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

function generatePrintHtml(data: SessionData): string {
  const defects = data.defects ?? [];
  const nbiRatings = data.nbiRatings ?? [];
  const importSummary = data.importSummary;
  const structNum = data.structureNumber ?? "Unknown";
  const now = new Date().toLocaleString();

  const cs4 = defects.filter((d) => d.cs === "CS4").length;
  const critical = defects.filter((d) => d.isCritical).length;
  const needsVerify = defects.filter((d) => d.needsVerification).length;
  const locations = sortedLocations(defects);

  const nbiRows = nbiRatings
    .map((n) => {
      const sub = n.subComponents[0];
      return `<tr>
        <td style="padding:5px 8px">${esc(n.item)}</td>
        <td style="padding:5px 8px">${esc(n.description)}</td>
        <td style="padding:5px 8px;text-align:center;font-weight:700">${esc(sub?.rating ?? "—")}</td>
        <td style="padding:5px 8px">${esc(sub?.comments ?? "")}</td>
      </tr>`;
    })
    .join("");

  const defectSections = locations
    .map((loc) => {
      const locDefects = defects.filter((d) => d.location === loc);
      const rows = locDefects
        .map((d) => {
          const flags = [
            d.isCritical ? `<span style="color:#ef4444">&#9888; Critical</span>` : "",
            d.isMaintenance ? `<span style="color:#f97316">&#128295; Maint</span>` : "",
            d.needsVerification ? `<span style="color:#ca8a04">&#10003; Verify</span>` : "",
            d.isLegacy ? `<span style="color:#94a3b8">Legacy</span>` : "",
          ].filter(Boolean).join(" &nbsp;");

          const photos = d.photos ?? [];
          const photoBlock = photos.length
            ? `<tr><td colspan="7" style="padding:8px 12px 12px 24px;background:#f8fafc">
                <strong style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">
                  Photos (${photos.length})
                </strong>
                <table style="width:100%;margin-top:6px;border-collapse:collapse;font-size:10px">
                  <tr style="background:#e2e8f0">
                    <th style="padding:4px 8px;text-align:left">#</th>
                    <th style="padding:4px 8px;text-align:left">Description</th>
                    <th style="padding:4px 8px;text-align:left">Direction</th>
                    <th style="padding:4px 8px;text-align:left">Image</th>
                  </tr>
                  ${photos
                    .map((p, i) => {
                      const accessible =
                        p.uri?.startsWith("http://") ||
                        p.uri?.startsWith("https://") ||
                        p.uri?.startsWith("data:");
                      const imgCell = accessible
                        ? `<img src="${esc(p.uri)}" style="max-width:200px;max-height:130px;border-radius:4px;display:block" onerror="this.replaceWith(document.createTextNode('(image unavailable)'))" />`
                        : `<span style="color:#94a3b8;font-style:italic">Stored on device</span>`;
                      return `<tr>
                        <td style="padding:4px 8px;vertical-align:top">${i + 1}</td>
                        <td style="padding:4px 8px;vertical-align:top">${esc(p.description || "—")}</td>
                        <td style="padding:4px 8px;vertical-align:top;white-space:nowrap">${p.heading != null ? headingLabel(p.heading) : "—"}</td>
                        <td style="padding:4px 8px;vertical-align:top">${imgCell}</td>
                      </tr>`;
                    })
                    .join("")}
                </table>
              </td></tr>`
            : "";

          return `<tr>
            <td style="padding:6px 8px;white-space:nowrap;font-size:11px">
              <span style="color:#94a3b8">${esc(d.elementId)}</span>
              <span style="font-weight:500"> — ${esc(d.element)}</span>
            </td>
            <td style="padding:6px 8px;font-size:11px">${esc(d.defect)}</td>
            <td style="padding:6px 8px;text-align:center;font-weight:700;color:${CS_COLORS[d.cs] ?? "#000"};font-size:11px">${d.cs}</td>
            <td style="padding:6px 8px;text-align:center;font-size:11px">${esc(d.quantityValue || d.quantity)}</td>
            <td style="padding:6px 8px;font-size:11px;color:#64748b">${esc(d.locationDesc || "")}</td>
            <td style="padding:6px 8px;font-size:10px">${flags || "—"}</td>
            <td style="padding:6px 8px;text-align:center">
              ${photos.length ? `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:9999px;font-size:10px">${photos.length}</span>` : "—"}
            </td>
          </tr>${photoBlock}`;
        })
        .join("");

      return `
        <h3 style="margin:24px 0 8px;font-size:13px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:4px">
          ${esc(loc)}
        </h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Element</th>
              <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Defect</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">CS</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Qty</th>
              <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Notes</th>
              <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Flags</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Photos</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

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
          <tr><td style="padding:3px 20px 3px 0;color:#6b7280">NBI Items Filled</td><td style="font-weight:600">${importSummary.nbiFilledCount} / ${importSummary.nbiTotalCount}</td></tr>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Bridge Inspection Report \u2014 ${esc(structNum)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2937;line-height:1.5}
    .print-bar{background:#1e293b;color:#fff;padding:12px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:10}
    .print-btn{background:#3b82f6;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
    .print-btn:hover{background:#2563eb}
    .content{max-width:960px;margin:0 auto;padding:32px 24px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 28px}
    .stat{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px}
    .stat .val{font-size:26px;font-weight:700;line-height:1.1}
    .stat .lbl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
    h1{font-size:22px;font-weight:700;color:#111827;margin-bottom:4px}
    h2{font-size:15px;font-weight:700;color:#1f2937;margin:28px 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}
    .meta{color:#6b7280;font-size:11px;margin-bottom:8px}
    @media print{
      .print-bar{display:none!important}
      .content{padding:0;max-width:100%}
      tr{page-break-inside:avoid}
      h2,h3{page-break-after:avoid}
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">&#128424; Print / Save as PDF</button>
    <span style="font-size:13px">Bridge Inspection Report &mdash; ${esc(structNum)}</span>
  </div>
  <div class="content">
    <h1>Bridge Inspection Report</h1>
    <p class="meta">Structure: <strong>${esc(structNum)}</strong> &nbsp;&middot;&nbsp; Generated: ${esc(now)} &nbsp;&middot;&nbsp; ${defects.length} defect records</p>

    <div class="stats">
      <div class="stat"><div class="val">${defects.length}</div><div class="lbl">Total Defects</div></div>
      <div class="stat"><div class="val" style="color:#ef4444">${cs4}</div><div class="lbl">CS4 Defects</div></div>
      <div class="stat"><div class="val" style="color:#f97316">${critical}</div><div class="lbl">Critical Findings</div></div>
      <div class="stat"><div class="val" style="color:#ca8a04">${needsVerify}</div><div class="lbl">Needs Verification</div></div>
    </div>

    <h2>Condition State Distribution</h2>
    <table style="max-width:320px;border-collapse:collapse">
      <thead><tr style="background:#f9fafb">
        <th style="padding:6px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">State</th>
        <th style="padding:6px 12px;text-align:right;font-size:10px;text-transform:uppercase;color:#6b7280">Count</th>
        <th style="padding:6px 12px;text-align:right;font-size:10px;text-transform:uppercase;color:#6b7280">Share</th>
      </tr></thead>
      <tbody>
        ${["CS1","CS2","CS3","CS4"]
          .map((cs) => {
            const n = defects.filter((d) => d.cs === cs).length;
            const pct = defects.length ? Math.round((n / defects.length) * 100) : 0;
            return `<tr>
              <td style="padding:5px 12px;font-weight:700;color:${CS_COLORS[cs]}">${cs}</td>
              <td style="padding:5px 12px;text-align:right">${n}</td>
              <td style="padding:5px 12px;text-align:right;color:#6b7280">${pct}%</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>

    ${
      nbiRatings.length
        ? `<h2>NBI Ratings</h2>
           <table style="border-collapse:collapse">
             <thead><tr style="background:#f9fafb">
               <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Item</th>
               <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Description</th>
               <th style="padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;color:#6b7280">Rating</th>
               <th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280">Comments</th>
             </tr></thead>
             <tbody>${nbiRows}</tbody>
           </table>`
        : ""
    }

    <h2>Defect Records by Location</h2>
    ${defects.length === 0 ? `<p style="color:#6b7280;font-style:italic">No defect records in this session.</p>` : defectSections}

    ${importBlock}
  </div>
</body>
</html>`;
}

interface Props {
  sessionData: SessionData | null;
  setSessionData: (data: SessionData | null) => void;
}

export default function ReviewExport({ sessionData, setSessionData }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<"defects" | "nbi" | "summary">("defects");
  const [search, setSearch] = useState("");
  const [csFilter, setCsFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [showFlagged, setShowFlagged] = useState(false);
  const [exporting, setExporting] = useState<"excel" | "word" | "pdf" | null>(null);
  const [expandedNbi, setExpandedNbi] = useState<string | null>(null);
  const [showReportHeader, setShowReportHeader] = useState(false);
  const [reportHeader, setReportHeader] = useState({
    facilityCarried: "",
    featureCrossed: "",
    inspectionDate: "",
    inspectors: "",
    inspectionType: "Routine",
  });

  const { data: sessions, isLoading: listLoading, isError: listError, refetch, isFetching } =
    useListSessions({ query: { queryKey: getListSessionsQueryKey(), refetchInterval: 60_000 } });

  const { data: sessionDetail, isLoading: detailLoading } = useGetSession(selectedId, {
    query: { queryKey: getGetSessionQueryKey(selectedId), enabled: !!selectedId },
  });

  useEffect(() => {
    if (sessionDetail) {
      setSessionData({
        structureNumber: sessionDetail.structureNumber,
        defects: sessionDetail.defects as DefectRecord[],
        nbiRatings: sessionDetail.nbiRatings as NbiRating[],
        importSummary: (sessionDetail.importSummary as ImportSummary | null) ?? null,
      });
      setSelectedId("");
    }
  }, [sessionDetail, setSessionData]);

  const defects = sessionData?.defects ?? [];
  const nbiRatings = sessionData?.nbiRatings ?? [];
  const importSummary = sessionData?.importSummary;
  const locations = ["All", ...sortedLocations(defects)];

  const filtered = defects.filter((d) => {
    if (csFilter !== "All" && d.cs !== csFilter) return false;
    if (locationFilter !== "All" && d.location !== locationFilter) return false;
    if (showFlagged && !d.needsVerification && !d.isCritical && !d.isMaintenance) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${d.element} ${d.defect} ${d.location} ${d.locationDesc} ${d.elementId}`.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

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
        ["CS Distribution"],
        ["CS", "Count", "Percentage"],
        ...["CS1", "CS2", "CS3", "CS4"].map((cs) => {
          const n = defects.filter((d) => d.cs === cs).length;
          return [cs, n, defects.length ? `${Math.round((n / defects.length) * 100)}%` : "0%"];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

      const headers = [
        "Location", "Element ID", "Element", "Defect", "CS",
        "Quantity", "Maint Qty", "Environment", "Size", "Location Desc",
        "Critical", "Maintenance", "Needs Verify", "Legacy", "Photos", "Photo Directions",
      ];
      const rows = defects.map((d) => [
        d.location, d.elementId, d.element, d.defect, d.cs,
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
        const nbiRows = nbiRatings.map((n) => {
          const sub = n.subComponents[0];
          return [n.item, n.description, sub?.rating ?? "", sub?.comments ?? ""];
        });
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([["Item", "Description", "Rating", "Comments"], ...nbiRows]),
          "NBI Ratings",
        );
      }

      sortedLocations(defects).slice(0, 20).forEach((loc) => {
        const locDefects = defects.filter((d) => d.location === loc);
        const locRows = locDefects.map((d) => [
          d.elementId, d.element, d.defect, d.cs,
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

      // ── 2. FOLLOW-UP ACTIONS ──────────────────────────────────────────────
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
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Condition State", bold: true })] })] }),
              new TableCell({ children: [new Paragraph(d.cs)] }),
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

      // ── 3. LOAD POSTING INFORMATION ────────────────────────────────────────
      children.push(new Paragraph({ text: "Load Posting Information", heading: HeadingLevel.HEADING_2 }));
      const LOAD_CODES = ["58", "59", "60", "62"];
      const loadRatings = nbiRatings.filter((n) => LOAD_CODES.some((c) => n.item.includes(c)));
      if (loadRatings.length > 0) {
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
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: "N/A \u2014 No deck, superstructure, substructure, or culvert ratings recorded.", italics: true })],
        }));
      }
      children.push(new Paragraph({ text: "" }));

      // ── 4. BRIDGE INSPECTION RECORD (NBI) ──────────────────────────────────
      if (nbiRatings.length > 0) {
        children.push(new Paragraph({ text: "Bridge Inspection Record", heading: HeadingLevel.HEADING_2 }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["Item", "Description", "Rating", "Comments"].map(
                (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
              ),
            }),
            ...nbiRatings.map((n) => {
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
                    d.cs,
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

  const exportPdf = useCallback(() => {
    if (!sessionData) return;
    setExporting("pdf");
    try {
      const html = generatePrintHtml(sessionData);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } finally {
      setExporting(null);
    }
  }, [sessionData]);

  const loadSession = (id: string) => {
    setSelectedId(id);
    setActiveTab("defects");
    setSearch("");
    setCsFilter("All");
    setLocationFilter("All");
    setShowFlagged(false);
  };

  const clearSession = () => {
    setSessionData(null);
    setSelectedId("");
  };

  const isLoading = detailLoading && !!selectedId;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review & Export</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sessionData
              ? <>Structure: <span className="text-foreground font-semibold">{sessionData.structureNumber}</span></>
              : "Select a synced session to review and export."}
          </p>
        </div>
        {sessionData && (
          <button
            onClick={clearSession}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
          >
            <X className="h-3 w-3" />
            Change
          </button>
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
            onClick={() => refetch()}
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
              const isLoading = detailLoading && selectedId === s.id;
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
                    disabled={isLoading || (isSelected && !detailLoading)}
                    className={`ml-4 flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary hover:bg-secondary/80 text-foreground"
                    } disabled:opacity-50`}
                  >
                    {isLoading ? "Loading…" : isSelected ? "Loaded" : "Load"}
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

      {/* Export buttons — below Report Header so the header is filled in first */}
      {sessionData && (
        <div className="flex items-center justify-end gap-2 mb-5">
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
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" />
            {exporting === "pdf" ? "Opening…" : "Print PDF"}
          </button>
        </div>
      )}

      {/* Review panel */}
      {sessionData && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Defects", value: defects.length, color: "text-foreground" },
              { label: "CS4", value: defects.filter((d) => d.cs === "CS4").length, color: "text-red-400" },
              { label: "Critical", value: defects.filter((d) => d.isCritical).length, color: "text-orange-400" },
              { label: "NBI Ratings", value: nbiRatings.length, color: "text-blue-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-3">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 border-b border-border">
            {([
              { key: "defects", label: `Defects (${defects.length})` },
              { key: "nbi", label: `NBI Ratings (${nbiRatings.length})` },
              ...(importSummary ? [{ key: "summary", label: "Import Audit" }] : []),
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                  activeTab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Defects tab */}
          {activeTab === "defects" && (
            <>
              <div className="bg-card border border-border rounded-lg p-3 mb-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-44">
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    data-testid="input-search"
                    className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none w-full"
                    placeholder="Search element, defect, location…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground text-xs">
                      Clear
                    </button>
                  )}
                </div>
                <select
                  data-testid="select-cs-filter"
                  className="bg-secondary border border-border rounded-md text-xs px-2 py-1.5 text-foreground focus:outline-none"
                  value={csFilter}
                  onChange={(e) => setCsFilter(e.target.value)}
                >
                  <option value="All">All CS</option>
                  {["CS1", "CS2", "CS3", "CS4"].map((cs) => <option key={cs} value={cs}>{cs}</option>)}
                </select>
                <select
                  data-testid="select-location-filter"
                  className="bg-secondary border border-border rounded-md text-xs px-2 py-1.5 text-foreground focus:outline-none max-w-44 truncate"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    data-testid="checkbox-flagged"
                    type="checkbox"
                    checked={showFlagged}
                    onChange={(e) => setShowFlagged(e.target.checked)}
                    className="accent-primary"
                  />
                  Flagged only
                </label>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filtered.length} of {defects.length}
                </span>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        {["Location", "Element", "Defect", "CS", "Qty", "Notes", "Photos", "Flags"].map((h) => (
                          <th
                            key={h}
                            className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                              ["CS", "Qty", "Photos", "Flags"].includes(h) ? "text-center" : "text-left"
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                            No records match the current filters.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((d) => {
                          const photos = d.photos ?? [];
                          return (
                            <tr
                              key={d.id}
                              data-testid={`row-defect-${d.id}`}
                              className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
                            >
                              <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{d.location}</td>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                <span className="text-muted-foreground">{d.elementId}</span>
                                <span className="text-foreground font-medium ml-1">— {d.element}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-36 truncate">{d.defect}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-xs font-bold tracking-wide"
                                  style={{ color: CS_COLORS[d.cs], backgroundColor: CS_BG[d.cs] }}
                                >
                                  {d.cs}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">
                                {d.quantityValue || d.quantity}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-40 truncate" title={d.locationDesc}>
                                {d.locationDesc}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {photos.length > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                                    <Camera className="h-3 w-3" />
                                    {photos.length}
                                    {photos.some((p) => p.heading != null) && (
                                      <span title="Has direction data"><Compass className="h-3 w-3 text-muted-foreground" /></span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {d.isCritical && (
                                    <span title="Critical finding">
                                      <AlertTriangle className="h-3 w-3 text-red-400" />
                                    </span>
                                  )}
                                  {d.needsVerification && (
                                    <span title="Needs verification">
                                      <CheckCircle className="h-3 w-3 text-yellow-400" />
                                    </span>
                                  )}
                                  {d.isLegacy && (
                                    <span title="Legacy / imported" className="text-muted-foreground/50 text-xs">L</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* NBI Ratings tab */}
          {activeTab === "nbi" && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {nbiRatings.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No NBI ratings in this session.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {nbiRatings.map((n) => {
                    const isExpanded = expandedNbi === n.item;
                    const sub = n.subComponents[0];
                    const rating = sub?.rating ?? "—";
                    return (
                      <div key={n.item}>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
                          onClick={() => setExpandedNbi(isExpanded ? null : n.item)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="flex-shrink-0 text-base font-bold w-8 text-center"
                              style={{
                                color: rating === "N" || rating === "—" ? "#6b7280" : Number(rating) <= 3 ? "#ef4444" : Number(rating) <= 5 ? "#f97316" : "#22c55e",
                              }}
                            >
                              {rating}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">
                                {n.item} — {n.description}
                              </p>
                              {sub?.comments && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{sub.comments}</p>
                              )}
                            </div>
                          </div>
                          {n.subComponents.length > 1 && (
                            isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                        {isExpanded && n.subComponents.length > 1 && (
                          <div className="bg-secondary/20 px-4 pb-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border/50">
                                  {["Sub-Component", "Rating", "Min", "Comments"].map((h) => (
                                    <th key={h} className="pb-1.5 pt-2 text-left text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {n.subComponents.map((sc, i) => (
                                  <tr key={i} className="border-b border-border/20">
                                    <td className="py-1.5 pr-4 text-foreground">{sc.name}</td>
                                    <td className="py-1.5 pr-4 font-bold text-foreground">{sc.rating || "—"}</td>
                                    <td className="py-1.5 pr-4 text-muted-foreground">{sc.min || "—"}</td>
                                    <td className="py-1.5 text-muted-foreground">{sc.comments || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Import audit tab */}
          {activeTab === "summary" && importSummary && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  Previous report imported on{" "}
                  <span className="text-foreground">{new Date(importSummary.timestamp).toLocaleString()}</span>
                  {" "}for structure{" "}
                  <span className="text-foreground font-semibold">{importSummary.structureNumber}</span>
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Structure # Found", value: importSummary.structureNumberFound ? "Yes" : "No" },
                    { label: "Elements Found", value: importSummary.elementsFound },
                    { label: "Records Created", value: importSummary.elementRecordsCreated },
                    { label: "NBI Filled", value: `${importSummary.nbiFilledCount} / ${importSummary.nbiTotalCount}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-secondary/40 rounded-lg p-3">
                      <p className="text-lg font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {importSummary.sections.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Matched Sections ({importSummary.sections.length})
                  </p>
                  <div className="bg-card border border-border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/40 border-b border-border">
                          {["Item", "Description", "Filled", "Total"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importSummary.sections.map((s, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="px-3 py-2 text-muted-foreground">{s.item}</td>
                            <td className="px-3 py-2 text-foreground">{s.description}</td>
                            <td className="px-3 py-2 text-center">{s.filled}</td>
                            <td className="px-3 py-2 text-center">{s.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importSummary.unmatchedComponents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
                    Unmatched Components ({importSummary.unmatchedComponents.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {importSummary.unmatchedComponents.map((c, i) => (
                      <span key={i} className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {importSummary.emptySections.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Empty Sections ({importSummary.emptySections.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {importSummary.emptySections.map((s, i) => (
                      <span key={i} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                        {s.item} — {s.description}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
