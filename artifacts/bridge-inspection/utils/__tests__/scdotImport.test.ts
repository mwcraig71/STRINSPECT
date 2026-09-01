import { describe, expect, it } from "vitest";
import { scdotLocationLabel, scdotNoteDescription } from "../scdotImport";

describe("scdotLocationLabel", () => {
  it("maps SCDOT note locations onto app station labels", () => {
    expect(scdotLocationLabel("Span 10")).toBe("Span 10");
    expect(scdotLocationLabel("Span 2 left shoulder at BT 2")).toBe("Span 2");
    expect(scdotLocationLabel("Bent 8")).toBe("Bent 8");
    expect(scdotLocationLabel("BT 12")).toBe("Bent 12");
    expect(scdotLocationLabel("End Bent 1")).toBe("End Bent 1");
    expect(scdotLocationLabel("JT 5")).toBe("Joint 5");
    expect(scdotLocationLabel("Abutment 2 cap")).toBe("Abutment");
  });
  it("leaves culvert and range locations for the inspector", () => {
    expect(scdotLocationLabel("Both barrels")).toBe("Unassigned");
    expect(scdotLocationLabel("IW 1")).toBe("Unassigned");
    expect(scdotLocationLabel("Spans 10-12")).toBe("Unassigned");
    expect(scdotLocationLabel("Throughout all spans")).toBe("Unassigned");
  });
});

describe("scdotNoteDescription", () => {
  const base = { parentElementId: "107", cs: 4 as const, qty: 3, location: "BM 10-1", size: "", rawTag: "[CS4, Q3]" };
  it("prefixes the sub-heading context when present", () => {
    expect(scdotNoteDescription({ ...base, text: "BM 10-1, South face, section loss.", context: "Span 10 › At BT 10" })).toBe(
      "Span 10 › At BT 10 — BM 10-1, South face, section loss."
    );
    expect(scdotNoteDescription({ ...base, text: "BM 10-1, South face, section loss.", context: "" })).toBe("BM 10-1, South face, section loss.");
  });
});
