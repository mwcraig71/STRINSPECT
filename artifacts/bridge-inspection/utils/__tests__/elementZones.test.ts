import { describe, expect, it } from "vitest";
import {
  effectiveZone,
  isInZone,
  isZoneFilter,
  sortForUnderwater,
  type ZoneElement,
  type ZoneOptions,
} from "../elementZones";

// Representative slice of SNBI_ELEMENTS (id + category are all the classifier uses).
const E = {
  deck12: { id: "12", category: "Deck" },
  topFlange16: { id: "16", category: "Deck" },
  slab38: { id: "38", category: "Deck" },
  approach321: { id: "321", category: "Deck" },
  wearing510: { id: "510", category: "Other" },
  rail331: { id: "331", category: "Railing" },
  joint300: { id: "300", category: "Joint" },
  girder107: { id: "107", category: "Superstructure" },
  gusset162: { id: "162", category: "Superstructure" },
  bearing310: { id: "310", category: "Bearing" },
  coating515: { id: "515", category: "Other" },
  rebarProt520: { id: "520", category: "Other" },
  column205: { id: "205", category: "Substructure" },
  pscColumn204: { id: "204", category: "Substructure" },
  pierWall212: { id: "212", category: "Substructure" },
  abutment215: { id: "215", category: "Substructure" },
  footing220: { id: "220", category: "Substructure" },
  timberPile228: { id: "228", category: "Substructure" },
  pierCap234: { id: "234", category: "Substructure" },
  culvert241: { id: "241", category: "Culvert" },
  steelCulvert240: { id: "240", category: "Culvert" },
} satisfies Record<string, ZoneElement>;

const all = Object.values(E);
const ids = (zone: Parameters<typeof isInZone>[1], opts?: ZoneOptions) =>
  all.filter((el) => isInZone(el, zone, opts)).map((el) => el.id).sort();

const bridge: ZoneOptions = { includeUnderside: false, culvertStructure: false };
const bridgeWithUnderside: ZoneOptions = { includeUnderside: true, culvertStructure: false };
const culvert: ZoneOptions = { includeUnderside: false, culvertStructure: true };

describe("Topside", () => {
  it("is decks, slabs, approach slabs, wearing surface, railings and joints", () => {
    expect(ids("Topside")).toEqual(["12", "16", "300", "321", "331", "38", "510"]);
  });
});

describe("Underside", () => {
  it("is superstructure, bearings, substructure, protective systems and deck undersides", () => {
    expect(ids("Underside", bridge)).toEqual(["107", "12", "16", "162", "204", "205", "212", "215", "220", "228", "234", "310", "38", "515", "520"]);
  });
  it("keeps decks and top flanges available for underside-of-deck findings", () => {
    expect(isInZone(E.deck12, "Underside", bridge)).toBe(true);
    expect(isInZone(E.topFlange16, "Underside", bridge)).toBe(true);
  });
  it("leaves out approach slabs, wearing surface, railings and joints", () => {
    for (const el of [E.approach321, E.wearing510, E.rail331, E.joint300]) {
      expect(isInZone(el, "Underside", bridge), el.id).toBe(false);
    }
  });
  it("swaps substructure for culverts on a culvert structure", () => {
    expect(ids("Underside", culvert)).toEqual(["107", "12", "16", "162", "240", "241", "310", "38", "515", "520"]);
  });
});

describe("Underwater", () => {
  it("defaults to substructure and foundations only, every material variant", () => {
    expect(ids("Underwater", bridge)).toEqual(["204", "205", "212", "215", "220", "228", "234"]);
  });
  it("does not list culverts on a bridge", () => {
    expect(isInZone(E.culvert241, "Underwater", bridge)).toBe(false);
  });
  it("lists only culverts as the substructure on a culvert structure", () => {
    expect(ids("Underwater", culvert)).toEqual(["240", "241"]);
    expect(isInZone(E.column205, "Underwater", culvert)).toBe(false);
  });
  it("adds the underside families when toggled on", () => {
    expect(ids("Underwater", bridgeWithUnderside)).toEqual(ids("Underside", bridge));
    expect(ids("Underwater", { includeUnderside: true, culvertStructure: true })).toEqual(ids("Underside", culvert));
  });
  it("never includes topside-only elements, even with underside on", () => {
    for (const el of [E.approach321, E.wearing510, E.rail331, E.joint300]) {
      expect(isInZone(el, "Underwater", bridgeWithUnderside), el.id).toBe(false);
    }
  });
  it("orders substructure/foundation elements first", () => {
    const sorted = sortForUnderwater([E.girder107, E.bearing310, E.column205, E.deck12, E.footing220], bridgeWithUnderside);
    expect(sorted.map((e) => e.id)).toEqual(["205", "220", "107", "310", "12"]);
    const culvertSorted = sortForUnderwater([E.girder107, E.culvert241], { includeUnderside: true, culvertStructure: true });
    expect(culvertSorted.map((e) => e.id)).toEqual(["241", "107"]);
  });
});

describe("All / effective zone / persistence guard", () => {
  it("All is every element", () => {
    expect(ids("All")).toEqual(all.map((e) => e.id).sort());
  });
  it("All on the chip follows the inspection type", () => {
    expect(effectiveZone("All", "Underwater")).toBe("Underwater");
    expect(effectiveZone("All", "Topside")).toBe("Topside");
    expect(effectiveZone("Underside", "Underwater")).toBe("Underside");
    expect(effectiveZone("All", "Something else")).toBe("All");
  });
  it("accepts only known zone filters from storage", () => {
    expect(isZoneFilter("Underwater")).toBe(true);
    expect(isZoneFilter("All")).toBe(true);
    expect(isZoneFilter("Deck")).toBe(false);
    expect(isZoneFilter(null)).toBe(false);
  });
});
