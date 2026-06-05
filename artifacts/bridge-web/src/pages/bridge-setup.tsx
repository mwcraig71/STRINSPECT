import { useState } from "react";
import { Download, FileText, Info } from "lucide-react";

interface BridgeConfig {
  structureNumber: string;
  inspectionDate: string;
  inspectorName: string;
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
    inspectorName: "",
    bridgeName: "",
    location: "",
    numberOfSpans: 1,
    numberOfSupports: 2,
  });
  const [downloaded, setDownloaded] = useState(false);

  const set = (field: keyof FormFields, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value, }));

  const isValid = form.structureNumber.trim() !== "" && form.inspectorName.trim() !== "";

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
              onChange={(e) => set("structureNumber", e.target.value)}
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

        <Field label="Inspector Name" required>
          <input
            data-testid="input-inspector-name"
            className={inputClass}
            value={form.inspectorName}
            onChange={(e) => set("inspectorName", e.target.value)}
            placeholder="Full name of lead inspector"
          />
        </Field>

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

        <div className="pt-2 flex items-center gap-4">
          <button
            data-testid="button-download-config"
            disabled={!isValid}
            onClick={downloadConfig}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Download className="h-4 w-4" />
            Download .bridge.json
          </button>
          {downloaded && (
            <span className="text-xs text-green-400 font-medium">Config downloaded</span>
          )}
          {!isValid && (
            <span className="text-xs text-muted-foreground">Structure number and inspector name required</span>
          )}
        </div>
      </div>

      <div className="mt-5 bg-card border border-border rounded-lg p-4 flex gap-3">
        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">About the config file</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">.bridge.json</code> file
            contains bridge metadata for the mobile inspection app. After completing the inspection, export the
            session from the mobile app and upload it in the{" "}
            <strong className="text-foreground font-medium">Inspection Progress</strong> or{" "}
            <strong className="text-foreground font-medium">Review &amp; Export</strong> modules.
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
