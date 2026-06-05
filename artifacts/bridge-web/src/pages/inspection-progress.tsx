import { useState, useCallback } from "react";
import { Upload, AlertTriangle, Wrench, HelpCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SessionData } from "@/lib/types";

const CS_COLORS: Record<string, string> = {
  CS1: "#22c55e",
  CS2: "#eab308",
  CS3: "#f97316",
  CS4: "#ef4444",
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
        reject(new Error("Invalid JSON file. Please upload a session export from the mobile app."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

export default function InspectionProgress({ sessionData, setSessionData }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

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
  const nbiRatings = sessionData?.nbiRatings ?? [];

  const csDist = (["CS1", "CS2", "CS3", "CS4"] as const).map((cs) => ({
    cs,
    count: defects.filter((d) => d.cs === cs).length,
  }));

  const elementMap: Record<string, { name: string; count: number; cs3: number; cs4: number }> = {};
  defects.forEach((d) => {
    if (!elementMap[d.elementId]) elementMap[d.elementId] = { name: d.element, count: 0, cs3: 0, cs4: 0 };
    elementMap[d.elementId].count++;
    if (d.cs === "CS3") elementMap[d.elementId].cs3++;
    if (d.cs === "CS4") elementMap[d.elementId].cs4++;
  });
  const elementCoverage = Object.entries(elementMap).sort((a, b) => b[1].count - a[1].count);

  const nbiTotal = nbiRatings.reduce((s, n) => s + n.subComponents.length, 0);
  const nbiFilled = nbiRatings.reduce((s, n) => s + n.subComponents.filter((sc) => sc.rating).length, 0);
  const nbiPct = nbiTotal > 0 ? Math.round((nbiFilled / nbiTotal) * 100) : 0;

  const critCount = defects.filter((d) => d.isCritical).length;
  const maintCount = defects.filter((d) => d.isMaintenance).length;
  const verifyCount = defects.filter((d) => d.needsVerification).length;

  if (!sessionData) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-foreground">Inspection Progress</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a session JSON export from the mobile app to view progress metrics and CS distribution.
          </p>
        </div>

        <div
          data-testid="dropzone-session"
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
              data-testid="input-session-file"
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inspection Progress</h1>
          {sessionData.structureNumber && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Structure:{" "}
              <span className="text-foreground font-semibold">{sessionData.structureNumber}</span>
            </p>
          )}
        </div>
        <label className="cursor-pointer flex-shrink-0">
          <span
            data-testid="button-replace-session"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
          >
            <Upload className="h-3 w-3" />
            Replace session
          </span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {([
          { label: "Total Records", value: defects.length, sub: "defect observations", color: undefined },
          { label: "Critical", value: critCount, sub: "need immediate action", color: "#ef4444", Icon: AlertTriangle },
          { label: "Maintenance", value: maintCount, sub: "flagged items", color: "#f97316", Icon: Wrench },
          { label: "Needs Verify", value: verifyCount, sub: "imported / legacy", color: "#eab308", Icon: HelpCircle },
        ] as const).map(({ label, value, sub, color, Icon }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" style={{ color }} />}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-3xl font-bold" style={{ color: color ?? "inherit" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* CS Distribution chart */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">CS Distribution</h2>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={csDist} barSize={36} margin={{ left: -10, right: 4 }}>
              <XAxis
                dataKey="cs"
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={26}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#f8fafc",
                }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                formatter={(v: number) => [v, "Records"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {csDist.map((entry) => (
                  <Cell key={entry.cs} fill={CS_COLORS[entry.cs]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            {(["CS1", "CS2", "CS3", "CS4"] as const).map((cs) => (
              <span key={cs} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CS_COLORS[cs] }} />
                {cs} — {cs === "CS1" ? "Good" : cs === "CS2" ? "Fair" : cs === "CS3" ? "Poor" : "Severe"}
              </span>
            ))}
          </div>
        </div>

        {/* NBI Completion */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">NBI Rating Completion</h2>
          {nbiTotal > 0 ? (
            <>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold text-foreground">{nbiPct}%</span>
                <span className="text-sm text-muted-foreground mb-1">
                  {nbiFilled} / {nbiTotal} fields
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 mb-4">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${nbiPct}%`,
                    backgroundColor: nbiPct >= 80 ? "#22c55e" : nbiPct >= 50 ? "#eab308" : "#ef4444",
                  }}
                />
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {nbiRatings.map((n) => {
                  const filled = n.subComponents.filter((sc) => sc.rating).length;
                  const pct = n.subComponents.length
                    ? Math.round((filled / n.subComponents.length) * 100)
                    : 0;
                  return (
                    <div key={n.item} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex-1 truncate">
                        Item {n.item} — {n.description}
                      </span>
                      <span
                        className={`text-xs font-semibold flex-shrink-0 ${
                          pct === 100 ? "text-green-400" : pct > 0 ? "text-yellow-400" : "text-muted-foreground"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No NBI ratings found in session data.</p>
          )}
        </div>
      </div>

      {/* Element coverage */}
      {elementCoverage.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Element Coverage</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Element</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Records</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">CS3</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">CS4</th>
                </tr>
              </thead>
              <tbody>
                {elementCoverage.map(([id, { name, count, cs3, cs4 }]) => (
                  <tr key={id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground text-xs">
                      <span className="text-muted-foreground mr-1.5">{id}</span>{name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{count}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {cs3 > 0 ? <span className="text-orange-400 font-semibold">{cs3}</span> : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {cs4 > 0 ? <span className="text-red-400 font-semibold">{cs4}</span> : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
