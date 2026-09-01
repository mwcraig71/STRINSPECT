import { useState } from "react";
import { Download, FileText, Info, Cloud, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useUpsertSession } from "@workspace/api-client-react";

interface BridgeConfig {
  structureNumber: string;
  inspectionDate: string;
  teamLeader: string;
  teamMembers: string;
  weather: string;
  equipmentUsed: string;
  bridgeName: string;
  location: string;
  numberOfSpans: number;
  numberOfSupports: number;
  createdAt: string;
}

type FormFields = Omit<BridgeConfig, "createdAt">;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50";

export default function BridgeSetup() {
  const [form, setForm] = useState<FormFields>({
    structureNumber: "",
    inspectionDate: new Date().toISOString().split("T")[0],
    teamLeader: "",
    teamMembers: "",
    weather: "",
    equipmentUsed: "",
    bridgeName: "",
    location: "",
    numberOfSpans: 1,
    numberOfSupports: 2,
  });
  const [downloaded, setDownloaded] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [cloudError, setCloudError] = useState("");

  const upsertSession = useUpsertSession();

  const set = (field: keyof FormFields, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isValid = form.structureNumber.trim() !== "" && form.teamLeader.trim() !== "";

  const downloadConfig = () => {
    const config: BridgeConfig = { ...form, createdAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.structureNumber.replace(/\s+/g, "_") || "bridge"}.bridge.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const saveToCloud = () => {
    setCloudError("");
    setCloudSaved(false);
    upsertSession.mutate(
      {
        data: {
          structureNumber: form.structureNumber.trim(),
          teamLeader: form.teamLeader.trim() || null,
          teamMembers: form.teamMembers.split(/[,\n]/).map((name) => name.trim()).filter(Boolean),
          inspectionDate: form.inspectionDate || null,
          weather: form.weather.trim() || null,
          equipmentUsed: form.equipmentUsed.trim() || null,
          defects: [],
          nbiRatings: [],
        },
      },
      {
        onSuccess: () => setCloudSaved(true),
        onError: () => setCloudError("Could not reach the API server. Check that it is running."),
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-foreground">Bridge Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter bridge metadata to generate a configuration file for the field inspection team.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Structure Number" required>
            <input
              data-testid="input-structure-number"
              className={inputClass}
              value={form.structureNumber}
              onChange={(e) => { set("structureNumber", e.target.value); setCloudSaved(false); setCloudError(""); }}
              placeholder="e.g. 0800-01-001"
            />
          </Field>
          <Field label="Inspection Date">
            <input
              data-testid="input-inspection-date"
              type="date"
              className={inputClass}
              value={form.inspectionDate}
              onChange={(e) => set("inspectionDate", e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-md border border-border bg-secondary/20 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Inspection Team & Field Notes</p>
            <p className="text-xs text-muted-foreground mt-1">
              Supplemental information only. These values are not mapped to SNBI or NBI rating fields.
            </p>
          </div>
        <Field label="Team Leader" required>
          <input
            data-testid="input-inspector-name"
            className={inputClass}
            value={form.teamLeader}
            onChange={(e) => set("teamLeader", e.target.value)}
            placeholder="Full name of lead inspector"
          />
        </Field>
        <Field label="Additional Team Members">
          <textarea
            data-testid="input-team-members"
            className={inputClass}
            value={form.teamMembers}
            onChange={(e) => set("teamMembers", e.target.value)}
            placeholder="Separate names with commas or new lines"
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Weather">
            <input
              data-testid="input-weather"
              className={inputClass}
              value={form.weather}
              onChange={(e) => set("weather", e.target.value)}
              placeholder="e.g. Clear, 72°F"
            />
          </Field>
          <Field label="Equipment Used">
            <input
              data-testid="input-equipment"
              className={inputClass}
              value={form.equipmentUsed}
              onChange={(e) => set("equipmentUsed", e.target.value)}
              placeholder="e.g. Bucket truck, drone"
            />
          </Field>
        </div>
        </div>

        <Field label="Bridge Name / Feature Crossed">
          <input
            data-testid="input-bridge-name"
            className={inputClass}
            value={form.bridgeName}
            onChange={(e) => set("bridgeName", e.target.value)}
            placeholder="e.g. US-281 over Medina River"
          />
        </Field>

        <Field label="Location / County">
          <input
            data-testid="input-location"
            className={inputClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. Bexar County, TX"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Number of Spans">
            <input
              data-testid="input-spans"
              type="number"
              min={1}
              className={inputClass}
              value={form.numberOfSpans}
              onChange={(e) => set("numberOfSpans", Math.max(1, parseInt(e.target.value) || 1))}
            />
          </Field>
          <Field label="Number of Supports">
            <input
              data-testid="input-supports"
              type="number"
              min={2}
              className={inputClass}
              value={form.numberOfSupports}
              onChange={(e) => set("numberOfSupports", Math.max(2, parseInt(e.target.value) || 2))}
            />
          </Field>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            data-testid="button-download-config"
            disabled={!isValid}
            onClick={downloadConfig}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Download className="h-4 w-4" />
            Download .bridge.json
          </button>

          <button
            data-testid="button-save-cloud"
            disabled={!isValid || upsertSession.isPending}
            onClick={saveToCloud}
            className="flex items-center gap-2 bg-secondary border border-border text-foreground px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
          >
            {upsertSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            {upsertSession.isPending ? "Saving…" : "Save to cloud"}
          </button>

          {downloaded && (
            <span className="text-xs text-green-400 font-medium">Config downloaded</span>
          )}
          {cloudSaved && (
            <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              Saved to cloud
            </span>
          )}
          {cloudError && (
            <span className="flex items-center gap-1 text-xs text-destructive font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {cloudError}
            </span>
          )}
          {!isValid && !upsertSession.isPending && (
            <span className="text-xs text-muted-foreground">Structure number and team leader required</span>
          )}
        </div>
      </div>

      <div className="mt-5 bg-card border border-border rounded-lg p-4 flex gap-3">
        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">About the config file</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">.bridge.json</code> file
            contains bridge metadata for the mobile inspection app. Use{" "}
            <strong className="text-foreground font-medium">Save to cloud</strong> to register the bridge in the
            database immediately. After completing the inspection, the session appears in{" "}
            <strong className="text-foreground font-medium">Inspection Progress</strong> once the mobile app syncs.
          </p>
        </div>
      </div>

      {isValid && (
        <div className="mt-4 bg-secondary/50 border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
          <pre className="text-xs text-muted-foreground font-mono overflow-x-auto">
            {JSON.stringify({ ...form, createdAt: "…" }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
