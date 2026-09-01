import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePages } from "../pdfParser";

const FIXTURES = path.join(__dirname, "..", "__fixtures__");
const load = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));

describe("parsePages — TxDOT regression", () => {
  // Expected files were generated from the parser as it stood before the SCDOT
  // work (commit 5a91f09) so that the TxDOT path is provably unchanged.
  // Regenerate deliberately, never to make a red test green.
  const txdot = fs.readdirSync(FIXTURES).filter((f) => f.startsWith("txdot-") && f.endsWith(".pages.json"));

  it.each(txdot)("%s matches the pre-change output", (file) => {
    const actual = parsePages(load(file));
    const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, file.replace(".pages.json", ".expected.json")), "utf8"));
    const { warnings, ...rest } = actual;
    expect(warnings).toEqual([]);
    expect(JSON.parse(JSON.stringify(rest))).toEqual(expected);
  });
});

describe("parsePages — SCDOT adapter", () => {
  const report = parsePages(load("scdot-261-Routine-2024-11-06-001.pages.json"));

  it("detects the agency and identifiers", () => {
    expect(report.agency).toBe("SCDOT");
    expect(report.isSnbi).toBe(true);
    expect(report.structureNumber).toBe("4540026100200");
    expect(report.assetId).toBe("00261");
    expect(report.inspectionType).toBeUndefined();
    expect(report.scdot).toBeDefined();
  });

  it("flags underwater reports from the header, not the frequency table", () => {
    const uw = parsePages(load("scdot-237-UW-2024-09-19-001.pages.json"));
    expect(uw.inspectionType).toBe("Underwater");
    expect(uw.assetId).toBe("00237");
  });

  it("exposes element rows with defect rows pointing at their parent", () => {
    expect(report.elements).toEqual([
      { elementId: "241", elementName: "Re Conc Culvert", isDefect: false, defectCode: undefined, environment: "3", totalQty: 96, unit: "ft", cs1: 1, cs2: 92, cs3: 3, cs4: 0 },
      { elementId: "241", elementName: "Delamination/Spall/Patched Area", isDefect: true, defectCode: "1080", environment: "3", totalQty: 1, unit: "ft", cs1: 0, cs2: 0, cs3: 1, cs4: 0 },
      { elementId: "241", elementName: "Cracking (RC and Other)", isDefect: true, defectCode: "1130", environment: "3", totalQty: 6, unit: "ft", cs1: 0, cs2: 4, cs3: 2, cs4: 0 },
      { elementId: "241", elementName: "Abrasion(PSC/RC)", isDefect: true, defectCode: "1190", environment: "3", totalQty: 88, unit: "ft", cs1: 0, cs2: 88, cs3: 0, cs4: 0 },
    ]);
  });

  it("seeds universal SNBI ratings from the condition fields (no junk entries)", () => {
    const by = (item: string, name: string) => report.nbi.find((e) => e.item === item && e.componentName === name);
    expect(report.nbi.every((e) => /^BC(0[1-9]|1[01])$/.test(e.item))).toBe(true);
    expect(report.nbi.every((e) => !/^\(\d+\)/.test(e.componentName))).toBe(true);
    expect(by("BC04", "Overall Component Rating")).toMatchObject({ rating: "7", desc: "Minor Deterioration" });
    expect(by("BC01", "Overall Component Rating")).toMatchObject({ rating: "N", desc: "N/A (NBI)" });
    expect(by("BC09", "Overall Component Rating")).toMatchObject({ rating: "5", desc: "Bank Prot Eroded" });
    expect(by("BC09", "Overall Component Rating")!.comment).toMatch(/^Waterway Details:/);
    expect(by("BC10", "Scour Vulnerability Assessment")).toMatchObject({ rating: "8", desc: "Calc Scour Above Ftg" });
    expect(by("BC10", "Scour Vulnerability Assessment")!.comment).toMatch(/1ft of degradation/);
    expect(by("BC10", "Underwater Inspection")).toMatchObject({ rating: "7", desc: "Good" });
    expect(by("BC10", "Overall Component Rating")).toMatchObject({ rating: "7", desc: "Minor" });
    expect(by("BC11", "Bridge Railing")).toMatchObject({ rating: "0", desc: "Substandard" });
    // Culvert: headwall and wingwall notes land on BC04 Headwalls & WingWalls
    expect(by("BC04", "Headwalls & WingWalls")!.comment).toMatch(/Reinforced Concrete Headwalls .* All wingwalls, scattered spalls/);
    expect(by("BC01", "Delineation")!.comment).toMatch(/^\(4\) Delineators\./);
    expect(by("BC01", "Drainage System")!.comment).toBe("Original top slab drain holes have been sealed.");
    expect(by("BC01", "Curbs & Sidewalks")).toBeUndefined();
  });

  it("routes wingwall notes to the substructure on a bridge", () => {
    const bridge = parsePages(load("scdot-9698-Routine-2024-11-13-001.pages.json"));
    const wing = bridge.nbi.find((e) => e.componentName === "Backwalls & WingWalls");
    expect(wing?.item).toBe("BC03");
    expect(bridge.nbi.find((e) => e.componentName === "Headwalls & WingWalls")).toBeUndefined();
  });

  it("maps the streambed cross sections onto the channel form", () => {
    expect(report.channelCrossSection).toMatchObject({
      structureNumber: "4540026100200",
      route: "SC 261",
      featureCrossed: "BOGGY SWAMP",
      inspectionDate: "11/06/2024",
    });
    expect(report.channelCrossSection!.upstream).toEqual([
      { topRef: "Top of Headwall", botRef: "", totalHoriz: "0.0", distFromLastBent: "", vertDist: "10.8", notes: "Exterior Wall 1" },
      { topRef: "Top of Headwall", botRef: "", totalHoriz: "5.0", distFromLastBent: "", vertDist: "10.0", notes: "Barrel 1" },
      { topRef: "Top of Headwall", botRef: "", totalHoriz: "10.0", distFromLastBent: "", vertDist: "10.8", notes: "Interior Wall 1" },
      { topRef: "Top of Headwall", botRef: "", totalHoriz: "15.0", distFromLastBent: "", vertDist: "10.3", notes: "Barrel 2" },
      { topRef: "Top of Headwall", botRef: "", totalHoriz: "20.0", distFromLastBent: "", vertDist: "9.9", notes: "Exterior Wall 2" },
    ]);
    expect(report.channelCrossSection!.downstream.map((r) => r.vertDist)).toEqual(["10.0", "10.0", "9.6", "8.7", "6.7"]);
    expect(report.channelCrossSection!.comments).toMatch(/^Inlet \/ Left View, Water Surface -5.20, Offset 24.00/);
    expect(report.underclearance).toBeUndefined();
  });

  it("passes parser warnings through", () => {
    const r = parsePages(load("scdot-9967-Routine-2024-10-07-001.pages.json"));
    expect(r.warnings.some((w) => w.startsWith("Element 302: tagged quantities"))).toBe(true);
  });
});
