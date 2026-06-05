import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, FileText, Search, AlertTriangle, CheckCircle } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
} from "docx";
import { SessionData, DefectRecord } from "@/lib/types";

const CS_COLORS: Record<string, string> = {
  CS1: "#22c55e",
  CS2: "#eab308",
  CS3: "#f97316",
  CS4: "#ef4444",
};
const CS_BG: Record<string, string> = {
  CS1: "rgba(34,197,94,0.12)",
  CS2: "rgba(234,179,8,0.12)",
  CS3: "rgba(249,115,22,0.12)",
  CS4: "rgba(239,68,68,0.12)",
};

interface Props {
  sessionData: SessionData | null;
  setSessionData: (data: SessionData | null) => void;
}

function parseSessionFile(file: File): Promise<SessionData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string) as SessionData);
      } catch {
        reject(new Error("Invalid JSON file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function sortedLocations(defects: DefectRecord[]) {
  return Array.from(new Set(defects.map((d) => d.location))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

export default function ReviewExport({ sessionData, setSessionData }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [csFilter, setCsFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [showFlagged, setShowFlagged] = useState(false);
  const [exporting, setExporting] = useState<"excel" | "word" | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      const data = await parseSessionFile(file);
      setSessionData(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [setSessionData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const defects = sessionData?.defects ?? [];
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

  const exportExcel = () => {
    setExporting("excel");
    try {
      const wb = XLSX.utils.book_new();
      const structNum = sessionData?.structureNumber ?? "";

      // Summary sheet
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

      // All defects sheet
      const headers = [
        "Location", "Element ID", "Element", "Defect", "CS",
        "Quantity", "Maint Qty", "Environment", "Size", "Location Desc",
        "Critical", "Maintenance", "Needs Verify", "Legacy",
      ];
      const rows = defects.map((d) => [
        d.location, d.elementId, d.element, d.defect, d.cs,
        d.quantityValue || d.quantity, d.maintenanceQuantityValue, d.environment,
        d.size, d.locationDesc,
        d.isCritical ? "Yes" : "",
        d.isMaintenance ? "Yes" : "",
        d.needsVerification ? "Yes" : "",
        d.isLegacy ? "Yes" : "",
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "All Defects");

      // Per-location sheets (max 31 chars each, max 20 sheets)
      sortedLocations(defects).slice(0, 20).forEach((loc) => {
        const locDefects = defects.filter((d) => d.location === loc);
        const locRows = locDefects.map((d) => [
          d.elementId, d.element, d.defect, d.cs,
          d.quantityValue || d.quantity, d.locationDesc,
          d.isCritical ? "Yes" : "", d.needsVerification ? "Yes" : "",
        ]);
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([
            ["Element ID", "Element", "Defect", "CS", "Qty", "Notes", "Critical", "Verify"],
            ...locRows,
          ]),
          loc.substring(0, 31)
        );
      });

      XLSX.writeFile(wb, `${structNum || "bridge"}_inspection.xlsx`);
    } finally {
      setExporting(null);
    }
  };

  const exportWord = async () => {
    setExporting("word");
    try {
      const structNum = sessionData?.structureNumber ?? "";

      const children: (Paragraph | Table)[] = [
        new Paragraph({ text: "Bridge Inspection Report", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun({ text: "Structure Number: ", bold: true }),
            new TextRun(structNum || "(not set)"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Total Defect Records: ", bold: true }),
            new TextRun(String(defects.length)),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "Condition State Summary", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["Condition State", "Record Count", "Percentage"].map(
                (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
              ),
            }),
            ...(["CS1", "CS2", "CS3", "CS4"] as const).map((cs) => {
              const count = defects.filter((d) => d.cs === cs).length;
              const pct = defects.length ? `${Math.round((count / defects.length) * 100)}%` : "0%";
              return new TableRow({
                children: [cs, String(count), pct].map(
                  (v) => new TableCell({ children: [new Paragraph(v)] })
                ),
              });
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "Defect Records by Location", heading: HeadingLevel.HEADING_2 }),
      ];

      sortedLocations(defects).forEach((loc) => {
        const locDefects = defects.filter((d) => d.location === loc);
        children.push(new Paragraph({ text: loc, heading: HeadingLevel.HEADING_3 }));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["Element", "Defect", "CS", "Quantity", "Notes"].map(
                  (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
                ),
              }),
              ...locDefects.map(
                (d) =>
                  new TableRow({
                    children: [
                      `${d.elementId} — ${d.element}`,
                      d.defect,
                      d.cs,
                      d.quantityValue || d.quantity,
                      d.locationDesc || "",
                    ].map((v) => new TableCell({ children: [new Paragraph(v)] })),
                  })
              ),
            ],
          })
        );
        children.push(new Paragraph({ text: "" }));
      });

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
  };

  if (!sessionData) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-foreground">Review & Export</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a session JSON export to review defect records and generate Excel or Word reports.
          </p>
        </div>
        <div
          data-testid="dropzone-review"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-14 text-center transition-all ${
            dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border"
          }`}
        >
          <Upload className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Drop session JSON here</p>
          <p className="text-xs text-muted-foreground mb-5">or click to browse</p>
          <label className="cursor-pointer">
            <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
              Browse file
            </span>
            <input
              data-testid="input-review-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + export actions */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review & Export</h1>
          {sessionData.structureNumber && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Structure: <span className="text-foreground font-semibold">{sessionData.structureNumber}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="cursor-pointer">
            <span
              data-testid="button-replace-review"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
            >
              <Upload className="h-3 w-3" />
              Replace
            </span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
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
            {exporting === "word" ? "Exporting…" : "Word"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-52">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            data-testid="input-search"
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none w-full"
            placeholder="Search element, defect, location..."
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
          {["CS1", "CS2", "CS3", "CS4"].map((cs) => (
            <option key={cs} value={cs}>{cs}</option>
          ))}
        </select>

        <select
          data-testid="select-location-filter"
          className="bg-secondary border border-border rounded-md text-xs px-2 py-1.5 text-foreground focus:outline-none max-w-44 truncate"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        >
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
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
          {filtered.length} of {defects.length} records
        </span>
      </div>

      {/* Defect table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["Location", "Element", "Defect", "CS", "Qty", "Notes", "Flags"].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                      h === "CS" || h === "Qty" || h === "Flags" ? "text-center" : "text-left"
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
                  <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
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
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-40 truncate">{d.defect}</td>
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
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-48 truncate" title={d.locationDesc}>
                      {d.locationDesc}
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
