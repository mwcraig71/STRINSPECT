import { useState, useCallback, useEffect } from "react";
import { Upload, AlertTriangle, Wrench, HelpCircle, RefreshCw, Cloud, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SessionData, DefectRecord, NbiRating, ImportSummary } from "@/lib/types";
import {
  useListSessions,
  useGetSession,
  getListSessionsQueryKey,
  getGetSessionQueryKey,
} from "@workspace/api-client-react";

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

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InspectionProgress({ sessionData, setSessionData }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const {
    data: sessions,
    isLoading: listLoading,
    isError: listError,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useListSessions({ query: { queryKey: getListSessionsQueryKey(), refetchInterval: 30_000 } });

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

  const handleFile = useCallback(async (file: File) => {
    try {
      const data = await parseSessionFile(file);
      setSessionData(data);
      setFileError("");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Unknown error");
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

  type SummaryCard = {
    label: string;
    value: number;
    sub: string;
    color?: string;
    Icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  };

  const summaryCards: SummaryCard[] = [
    { label: "Total Records", value: defects.length, sub: "defect observations" },
    { label: "Critical", value: critCount, sub: "need immediate action", color: "#ef4444", Icon: AlertTriangle },
    { label: "Maintenance", value: maintCount, sub: "flagged items", color: "#f97316", Icon: Wrench },
    { label: "Needs Verify", value: verifyCount, sub: "imported / legacy", color: "#eab308", Icon: HelpCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inspection Progress</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a synced session from the cloud, or upload a local JSON export.
        </p>
      </div>

      {/* Cloud Sessions */}
      <div className="bg-card border border-border rounded-lg mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Synced Sessions</span>
            {sessions && sessions.length > 0 && (
              <span className="text-xs bg-primary/15 text-primary rounded-full px-2 py-0.5 font-semibold">
                {sessions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                Updated {formatRelativeTime(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors disabled:opacity-40"
              title="Refresh sessions"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {listLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-secondary/60 animate-pulse" />
            ))}
          </div>
        ) : listError ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Could not reach the API server. Check that it is running.
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Cloud className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No synced sessions yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Sessions appear here after the mobile app syncs to the API server.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((s) => {
              const isLoading = detailLoading && selectedId === s.id;
              return (
                <button
                  key={s.id}
                  data-testid={`session-row-${s.id}`}
                  onClick={() => setSelectedId(s.id)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-left hover:bg-secondary/40 transition-colors flex items-center justify-between gap-4 group disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {s.structureNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Synced {formatRelativeTime(s.syncedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{s.defectCount}</p>
                      <p className="text-xs text-muted-foreground">records</p>
                    </div>
                    {s.cs4Count > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-400">{s.cs4Count}</p>
                        <p className="text-xs text-muted-foreground">CS4</p>
                      </div>
                    )}
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border group-hover:border-primary transition-colors flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual upload fallback */}
      <div className="bg-card border border-border rounded-lg mb-6 overflow-hidden">
        <button
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-secondary/20 transition-colors"
          onClick={() => setShowUpload((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Upload JSON Manually</span>
            <span className="text-xs text-muted-foreground">(fallback for unsynced sessions)</span>
          </div>
          {showUpload
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showUpload && (
          <div className="px-4 pb-4 pt-1">
            <div
              data-testid="dropzone-session"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border"
              }`}
            >
              <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">Drop session JSON here</p>
              <p className="text-xs text-muted-foreground mb-4">or click to browse</p>
              <label className="cursor-pointer">
                <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity">
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
            {fileError && <p className="text-xs text-destructive mt-2">{fileError}</p>}
          </div>
        )}
      </div>

      {/* Progress metrics — shown when a session is loaded */}
      {sessionData && (
        <>
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Session Metrics</h2>
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
            {summaryCards.map(({ label, value, sub, color, Icon }) => (
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
        </>
      )}
    </div>
  );
}
