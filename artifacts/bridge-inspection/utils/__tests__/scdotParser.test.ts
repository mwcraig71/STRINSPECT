import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseFields,
  parseScdotReport,
  parseTag,
  splitCodedValue,
  type ParsedScdotReport,
} from "../scdotParser";

const FIXTURES = path.join(__dirname, "..", "__fixtures__");

function loadPages(name: string): string[][] {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

const SCDOT_FIXTURES = fs.readdirSync(FIXTURES).filter((f) => f.startsWith("scdot-") && f.endsWith(".pages.json"));

describe("parseTag", () => {
  it("reads the standard [elem, CSn, Qn] tag", () => {
    expect(parseTag("1190, CS2, Q88")).toEqual([{ defectCode: "1190", cs: 2, qty: 88 }]);
  });
  it("reads multi-state tags in every spelling seen in the corpus", () => {
    expect(parseTag("3220, CS2, Q2415 and 3220, CS3, Q2415")).toEqual([
      { defectCode: "3220", cs: 2, qty: 2415 },
      { defectCode: "3220", cs: 3, qty: 2415 },
    ]);
    expect(parseTag("1080, CS2, Q200 & CS3, Q40")).toEqual([
      { defectCode: "1080", cs: 2, qty: 200 },
      { defectCode: "1080", cs: 3, qty: 40 },
    ]);
    expect(parseTag("2320, CS2, Q10; CS3 Q5")).toEqual([
      { defectCode: "2320", cs: 2, qty: 10 },
      { defectCode: "2320", cs: 3, qty: 5 },
    ]);
    expect(parseTag("1080, CS2 Q20")).toEqual([{ defectCode: "1080", cs: 2, qty: 20 }]);
  });
  it("accepts tags without an element code", () => {
    expect(parseTag("CS4, Q3")).toEqual([{ defectCode: undefined, cs: 4, qty: 3 }]);
  });
  it("ignores inventory-only tags", () => {
    expect(parseTag("Q48")).toEqual([]);
  });
});

describe("splitCodedValue", () => {
  it("separates the code from its description", () => {
    expect(splitCodedValue("7 Minor Deterioration")).toEqual({ code: "7", text: "Minor Deterioration" });
    expect(splitCodedValue("8 - Calc Scour Above Ftg")).toEqual({ code: "8", text: "Calc Scour Above Ftg" });
    expect(splitCodedValue("N N/A (NBI)")).toEqual({ code: "N", text: "N/A (NBI)" });
    expect(splitCodedValue("20.8")).toEqual({ code: "", text: "20.8" });
  });
});

describe("parseFields — stray value re-attachment", () => {
  it("re-attaches values that the row bucketing pushed above their labels", () => {
    const { fields } = parseFields([
      "CONDITION AND APPRAISAL",
      "N N/A (NBI)  N N/A (NBI)",
      "(058) Deck Structure Condition [B.C.01]:  (602) Bridge Railing Condition [B.C.05]",
      "(059) Superstructure Condition [B.C.02]:  N N/A (NBI)  (603) Bridge Railing Trans. Condition [B.C.06]:  N N/A (NBI)",
      "7 Minor Deterioration  N N/A (NBI)",
      "(062) Culvert Retaining Condition [B.C.04]:  (605) Bridge Joint Condition [B.C.08]:",
      "8 - Calc Scour Above Ftg",
      "(601) Channel Protection Condition [B.C.09]:  N N/A (NBI)  (113) Scour Condition:",
    ]);
    expect(fields["058"]).toMatchObject({ label: "Deck Structure Condition", snbi: "B.C.01", value: "N N/A (NBI)" });
    expect(fields["602"].value).toBe("N N/A (NBI)");
    expect(fields["062"].value).toBe("7 Minor Deterioration");
    expect(fields["605"].value).toBe("N N/A (NBI)");
    expect(fields["113"].value).toBe("8 - Calc Scour Above Ftg");
    expect(fields["601"].value).toBe("N N/A (NBI)");
  });

  it("re-attaches values that sit below their labels and respects value types", () => {
    const { fields } = parseFields([
      "CURB REVEAL MEASUREMENTS",
      "No Curb:  Hidden Curb:",
      "Yes  No",
      "Curb Reveal Beginning Left (in):  Curb Reveal Beginning Right (in):",
      "CULVERT FILL INVENTORY",
      "Not a Culvert (N/A):  Max Fill (ft):  1.5",
      "No",
      "Culvert Inlet (ft):  1.0  Culvert Outlet (ft):  1.0",
    ]);
    expect(fields.no_curb.value).toBe("Yes");
    expect(fields.hidden_curb.value).toBe("No");
    expect(fields.curb_reveal_beginning_left_in.value).toBe("");
    expect(fields.not_a_culvert_n_a.value).toBe("No");
    expect(fields.max_fill_ft.value).toBe("1.5");
  });

  it("uses value types and column history to place ambiguous strays", () => {
    const { fields } = parseFields([
      "OTHER BRIDGE DATA",
      "(106) Year Reconstructed [B.W.02]:  1967  (508) Damaged Superstructure:  N - No Damage",
      "N - No Damage",
      "(319) Paint Date:  (509) Damaged Substructure:",
      "N - No Damage",
      "(037) History [B.CL.04]:  5 Not eligible for NRHP  (510) Damaged Culvert:",
      "LOAD RATING AND POSTING",
      "5 - Equal/Abv Legal Load  (063) Opr Method [B.LR.04]:  6 LFR",
      "(070) Posting %:",
      "0.79 rf",
      "(418A) Deck/Culvert Condition:  7  (466) Alternative Inventory Rating Factor:",
      "8 LRFR",
      "(418B) Superstructure Condition:  (463) Alternative Operating Rate Method:",
      "1.03 rf",
      "(418C) Substructure Condition:  (464) Alternative Operating Rating Factor:",
    ]);
    expect(fields["319"].value).toBe("");
    expect(fields["509"].value).toBe("N - No Damage");
    expect(fields["510"].value).toBe("N - No Damage");
    expect(fields["070"].value).toBe("5 - Equal/Abv Legal Load");
    expect(fields["063"].value).toBe("6 LFR");
    expect(fields["466"].value).toBe("0.79 rf");
    expect(fields["463"].value).toBe("8 LRFR");
    expect(fields["464"].value).toBe("1.03 rf");
    expect(fields["418B"].value).toBe("");
    expect(fields["418C"].value).toBe("");
  });

  it("does not treat numbered values or sub-headings as labels", () => {
    const { fields } = parseFields([
      "IDENTIFICATION",
      "(002) District [B.L.04]:  District 5  (003) County [B.L.02]:  (45) Williamsburg",
      "POSTING SIGN VALUES",
      "R-12-6-48 Legal Load Posting and Sign Posted Values  R-12-9-36 Emergency Vehicle Posting and Sign Posted Values",
      "(443) Legal (non-EV) Single 2-3 Axles (tons):  (446) EV Single Axle (tons):",
      "40T Combination Posting",
      "(889) 40T Combination Sign Posted:",
    ]);
    expect(fields["003"].value).toBe("(45) Williamsburg");
    expect(fields["45"]).toBeUndefined();
    expect(fields["443"].value).toBe("");
    expect(fields["446"].value).toBe("");
    expect(fields["889"].value).toBe("");
  });

  it("keeps both fields when the template reuses an item number", () => {
    const { fields } = parseFields([
      "CONDITION AND APPRAISAL",
      "(631) Scour Condition Rating:  7 - Minor",
      "ROADWAY AND CLEARANCES",
      "(010) Wide Load Clearance Vertical:  99.99 (631) Nav. Channel Min. Horiz. Clearance [B.N.05]:  0.00",
    ]);
    expect(fields["631"].value).toBe("7 - Minor");
    expect(fields["631_nav_channel_min_horiz_clearance"].value).toBe("0.00");
  });
});

describe("parseScdotReport — asset 00261 (routine, 2-barrel RC culvert)", () => {
  const report: ParsedScdotReport = parseScdotReport(loadPages("scdot-261-Routine-2024-11-06-001.pages.json"));

  it("reads the header", () => {
    expect(report.templateVersion).toBe("v15, 11/01/2024");
    expect(report.header).toMatchObject({
      assetId: "00261",
      structureNumber: "4540026100200",
      teamLeader: "Michael Meyer",
      teamMembers: ["Jay Hahn"],
      inspectionDate: "11/06/2024",
      inspectionTypes: "Routine",
      facilityCarried: "SC 261",
      featureIntersected: "BOGGY SWAMP",
      latitude: "33.693197",
      longitude: "-79.742056",
      district: "District 5",
      county: "(45) Williamsburg",
      owner: "SCDOT",
      yearBuilt: "1927",
      yearReconstructed: "1967",
      weather: "2 - Cloudy",
      temperatureF: "71",
    });
  });

  it("harvests the inventory and condition fields", () => {
    const v = (k: string) => report.fields[k]?.value;
    expect(Object.keys(report.fields).length).toBeGreaterThan(180);
    // Condition and appraisal
    expect(v("058")).toBe("N N/A (NBI)");
    expect(v("062")).toBe("7 Minor Deterioration");
    expect(report.fields["062"].snbi).toBe("B.C.04");
    expect(v("600")).toBe("7 Good");
    expect(v("061")).toBe("5 Bank Prot Eroded");
    expect(v("601")).toBe("N N/A (NBI)");
    expect(v("633")).toBe("N N/A (NBI) (No NSTMs)");
    expect(v("113")).toBe("8 - Calc Scour Above Ftg");
    expect(v("631")).toBe("7 - Minor");
    expect(v("071")).toBe("8 Equal Desirable");
    expect(v("072")).toBe("8 Equal Desirable Crit");
    // Geometry
    expect(v("049")).toBe("20.8");
    expect(v("606")).toBe("10.0");
    expect(v("045")).toBe("2");
    expect(v("43B")).toBe("19 Culvert");
    expect(v("36A")).toBe("0 Substandard");
    // Load rating
    expect(v("063")).toBe("6 LFR");
    expect(v("064")).toBe("1.15 rf");
    expect(v("066")).toBe("0.69 rf");
    expect(v("411")).toBe("11/01/2020");
    expect(v("070")).toBe("5 - Equal/Abv Legal Load");
    expect(v("031")).toBe("2 M 13.5 (H 15)");
    expect(v("464")).toBe("1.03 rf");
    // Roadway / classification
    expect(v("029")).toBe("2,300 Cars/Day");
    expect(v("28A")).toBe("2");
    expect(v("026")).toBe("06 Rural Minor Arterial");
    // Other bridge data
    expect(v("502")).toBe("1 - West to East");
    expect(v("505")).toBe("1 - North to South");
    expect(v("504")).toBe("Bent 1 (SW Corner)");
    expect(v("509")).toBe("N - No Damage");
    expect(v("319")).toBe("");
    // Scour and waterway (page 17)
    expect(v("517")).toBe("5.6");
    expect(v("519")).toBe("1 - Within Banks");
    expect(v("450")).toBe("2");
    expect(v("SBI_underwater_inspection_category")).toBe("UA1");
  });

  it("reads the inspection frequency table", () => {
    expect(report.frequencies).toEqual([
      { inspectionType: "Routine", frequencyMonths: "24", lastInspection: "11/6/2024", nextInspection: "11/6/2026" },
      { inspectionType: "Underwater (B)", frequencyMonths: "60", lastInspection: "4/1/2022", nextInspection: "4/1/2027" },
    ]);
  });

  it("parses element rows and the tagged defect notes", () => {
    expect(report.elements.map((e) => `${e.elementId}/${e.environment}`)).toEqual(["241/3", "1080/3", "1130/3", "1190/3"]);
    const culvert = report.elements[0];
    expect(culvert).toMatchObject({ name: "Re Conc Culvert", totalQty: 96, unit: "ft", cs: [1, 92, 3, 0], isDefect: false });
    expect(culvert.notes).toEqual([
      "(2) Barrel Reinforced Concrete box culvert (48ft L x 10ft W x 10ft H).",
      "Original section is (24ft L), Widened (12ft L) on each side.",
    ]);
    expect(culvert.defects).toHaveLength(6);
    expect(culvert.defects[0]).toMatchObject({
      defectCode: "1190",
      cs: 2,
      qty: 88,
      location: "Both barrels",
      size: "1ft high x 1/8in deep",
      text: "Both barrels, along water line, minor abrasion (1ft high x 1/8in deep).",
      rawTag: "[1190, CS2, Q88]",
    });
    expect(culvert.defects[1]).toMatchObject({ defectCode: "1080", cs: 3, qty: 1, location: "Barrel 1", size: "8in L x 14in W x 1in D" });
    expect(culvert.defects.map((d) => `${d.defectCode}:${d.cs}:${d.qty}`)).toEqual([
      "1190:2:88",
      "1080:3:1",
      "1130:2:1",
      "1130:2:3",
      "1130:3:1",
      "1130:3:1",
    ]);
    expect(report.elements[2]).toMatchObject({ elementId: "1130", name: "Cracking (RC and Other)", cs: [0, 4, 2, 0], isDefect: true });
  });

  it("tag quantities roll up to the defect rows (no roll-up warnings)", () => {
    expect(report.warnings.filter((w) => /tagged quantities|no tagged notes/.test(w))).toEqual([]);
  });

  it("splits Section 4 notes by heading", () => {
    expect(Object.keys(report.sectionNotes)).toEqual([
      "Miscellaneous Notes",
      "Traffic Signs",
      "Encroachments",
      "Waterway and Channel",
      "Approach Roadway Condition",
      "Fender System",
      "Median and Other Barriers",
      "Under Bridge Railings/Barriers",
      "Curbs and Sidewalks",
      "Drainage System",
      "Diaphragms",
      "Wingwalls",
      "Summary of Previously Performed Maintenance Work",
    ]);
    expect(report.sectionNotes["Wingwalls"]).toEqual([
      "(4) Reinforced Concrete Wingwalls at all corners.",
      "All wingwalls, scattered spalls along top inside corner.",
    ]);
    expect(report.sectionNotes["Waterway and Channel"]).toHaveLength(12);
    expect(report.sectionNotes["Drainage System"]).toEqual(["Original top slab drain holes have been sealed."]);
  });

  it("reads all 26 photo captions, including wrapped two-column captions", () => {
    expect(report.photos).toHaveLength(26);
    const cap = (n: number) => report.photos.find((p) => p.number === n)?.caption;
    expect(cap(1)).toBe("West Approach Looking East");
    expect(cap(9)).toBe("Asset ID Plaque at Bent 1 (SW Corner)");
    expect(cap(14)).toBe("(1) metal conduit (1-1/2in diameter) and (1) metal conduit (2-1/2in diameter) along North end of culvert.");
    expect(cap(15)).toBe("Both barrels, along water line, minor abrasion (1ft high x 1/8in deep).");
    expect(cap(16)).toBe("Barrel 1, top slab at south end, honeycombing and spall (8in L x 14in W x 1in D) with (2) exposed rebars.");
    expect(cap(25)).toBe("North headwall, at East end, spall (14in long x 11in wide x up to 12in deep).");
    expect(cap(26)).toBe("All wingwalls, scattered spalls along top inside corner.");
    // Defect photo captions reuse the element-note sentence verbatim
    const defectTexts = report.elements[0].defects.map((d) => d.text);
    expect(defectTexts).toContain(cap(15));
    expect(defectTexts).toContain(cap(16));
  });

  it("reads both streambed cross sections", () => {
    expect(report.streambed).toHaveLength(2);
    expect(report.streambed[0]).toMatchObject({
      orientation: "Left View",
      offsetRemark: "Inlet",
      elevBasis: "Assumption",
      waterSurface: "-5.20",
      sndElevInd: "Soundings",
      soundingDate: "11/2024",
      bmLocation: "Top of Headwall",
      offset: "24.00",
    });
    expect(report.streambed[0].rows).toEqual([
      { station: "1 + 0.0", elevation: "10.8", remark: "Exterior Wall 1" },
      { station: "1 + 5.0", elevation: "10.0", remark: "Barrel 1" },
      { station: "1 + 10.0", elevation: "10.8", remark: "Interior Wall 1" },
      { station: "1 + 15.0", elevation: "10.3", remark: "Barrel 2" },
      { station: "1 + 20.0", elevation: "9.9", remark: "Exterior Wall 2" },
    ]);
    expect(report.streambed[1].offsetRemark).toBe("Outlet");
    expect(report.streambed[1].rows.map((r) => r.elevation)).toEqual(["10.0", "10.0", "9.6", "8.7", "6.7"]);
  });

  it("reads procedures, equipment and sign-off", () => {
    expect(report.procedures).toHaveLength(6);
    expect(report.procedures[0]).toEqual({
      done: "S",
      inspType: "Routine",
      procedureType: "Routine (Typical)",
      name: "Inspection: Timber Sounding",
      details: "Sound full length of exposed timber piles (including through bolts) per BIGD 5.3.3.1 and 5.3.3.2.1.",
    });
    expect(report.procedures.map((p) => p.name)).toEqual([
      "Inspection: Timber Sounding",
      "Inspection: Pile Sketch",
      "Inspection: Defect Photos",
      "Post-Inspection: Requests",
      "Post-Inspection: Data Verification",
      "Inspection: Posting Photos",
    ]);
    expect(report.procedureNotes).toBe("Substructure is a Culvert, No Pile Sketch Needed; No Timber Piles; Culvert is not Posted");
    expect(report.equipment).toEqual([{ name: "A06 Boat: John Boat without Motor", hours: "1.00", cost: "0" }]);
    expect(report.signoff).toEqual({
      inspectedBy: "Michael Meyer",
      date: "11/6/2024",
      qcReviewedBy: "Bill Mitchell",
      qcCompleted: "12/31/2024",
      qaReviewedBy: "",
      qaCompleted: "",
    });
  });
});

describe("parseScdotReport — corpus", () => {
  it.each(SCDOT_FIXTURES)("%s parses every section", (file) => {
    const r = parseScdotReport(loadPages(file));
    expect(r.templateVersion).toMatch(/^v\d+, \d{2}\/\d{2}\/\d{4}$/);
    expect(r.header.assetId).toMatch(/^\d{5}$/);
    expect(r.header.structureNumber).toMatch(/^\d{13}$/);
    expect(r.header.teamLeader).not.toBe("");
    expect(r.header.inspectionDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(Object.keys(r.fields).length).toBeGreaterThan(180);
    for (const k of ["058", "059", "060", "062", "061", "071", "072", "113", "049", "029", "090", "063", "064", "066"]) {
      expect(r.fields[k], `field ${k}`).toBeDefined();
    }
    expect(r.frequencies.length).toBeGreaterThan(0);
    expect(r.elements.filter((e) => !e.isDefect).length).toBeGreaterThan(0);
    // every element row has a name, a unit and four condition states
    for (const e of r.elements) {
      expect(e.name, `${e.elementId}/${e.environment} name`).not.toBe("");
      expect(e.unit, `${e.elementId}/${e.environment} unit`).not.toBe("");
      expect(e.cs).toHaveLength(4);
    }
    expect(Object.keys(r.sectionNotes)).toHaveLength(13);
    expect(r.photos.length).toBeGreaterThan(0);
    // photo numbers are contiguous
    expect(r.photos.map((p) => p.number)).toEqual(r.photos.map((_, i) => i + 1));
    expect(r.signoff.inspectedBy).not.toBe("");
    expect(r.procedures.length).toBeGreaterThan(0);
  });

  it.each(SCDOT_FIXTURES)("%s: every tagged note carries a condition state and quantity", (file) => {
    const r = parseScdotReport(loadPages(file));
    for (const e of r.elements) {
      for (const d of e.defects) {
        expect(d.cs).toBeGreaterThanOrEqual(1);
        expect(d.cs).toBeLessThanOrEqual(4);
        expect(d.qty).toBeGreaterThanOrEqual(0);
        expect(d.text).not.toMatch(/\[[^\]]*CS\s*\d/);
      }
    }
  });

  it("handles rows whose unit or name was bucketed onto a neighbouring line", () => {
    const r = parseScdotReport(loadPages("scdot-9967-Routine-2024-10-07-001.pages.json"));
    const pierCap = r.elements.find((e) => e.elementId === "234");
    expect(pierCap).toMatchObject({ name: "Re Conc Pier Cap", unit: "ft", totalQty: 66, cs: [58, 8, 0, 0] });
    const r2 = parseScdotReport(loadPages("scdot-9698-Routine-2024-11-13-001.pages.json"));
    expect(r2.elements.find((e) => e.elementId === "234")).toMatchObject({ name: "Re Conc Pier Cap", unit: "ft", totalQty: 588 });
    expect(r2.elements.find((e) => e.elementId === "15")).toMatchObject({ unit: "sq ft", totalQty: 24650 });
    expect(r2.elements.find((e) => e.elementId === "226")).toMatchObject({ unit: "ea", totalQty: 56 });
  });

  it("captures sub-heading context and multi-line location lists", () => {
    const r = parseScdotReport(loadPages("scdot-9698-Routine-2024-11-13-001.pages.json"));
    const girder = r.elements.find((e) => e.elementId === "104")!;
    const listNote = girder.defects.find((d) => d.qty === 14)!;
    expect(listNote.text).toMatch(/^Throughout all spans over interior bents on West fascia/);
    expect(listNote.text).toMatch(/BM1-5 at BT 2 .* BM15-5 at BT 15$/);
    const r2 = parseScdotReport(loadPages("scdot-2753-UW-2025-02-21-001.pages.json"));
    const steel = r2.elements.find((e) => e.elementId === "107")!;
    expect(steel.defects[0]).toMatchObject({ context: "Span 10 › At BT 10", location: "BM 10-1", cs: 4, qty: 3, defectCode: undefined });
    const deck = r2.elements.find((e) => e.elementId === "12")!;
    expect(deck.defects.filter((d) => d.rawTag === "[1080, CS2, Q200 & CS3, Q40]")).toHaveLength(2);
  });

  it("reports roll-up mismatches instead of silently trusting either side", () => {
    const r = parseScdotReport(loadPages("scdot-9967-Routine-2024-10-07-001.pages.json"));
    expect(r.warnings).toContain(
      "Element 302: tagged quantities for 2350 (Debris Impaction) are CS 0/44/0/0 but the row says 0/50/0/0"
    );
  });
});
