import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { nbiSubNameMatchScore, parseReport } from "../utils/pdfParser";

// ─── Constants ───────────────────────────────────────────────────────────────

export const NOMENCLATURES = {
  TXDOT: "Texas (TxDOT)",
  NCDOT: "North Carolina (NCDOT)",
};

export const INSPECTION_TYPES = {
  TOPSIDE: "Topside",
  UNDERSIDE: "Underside",
};

export const SUPERSTRUCTURE_TYPES = [
  {
    id: "STEEL_GIRDER",
    label: "Steel Girder/Beam",
    sub: "W-shape · Plate Girder · Box Girder",
    icon: "⬛",
    elementIds: ["107", "515"],
    deckId: "12",
  },
  {
    id: "PSC_GIRDER",
    label: "Prestressed Concrete",
    sub: "I-Beam · Box Beam · AASHTO",
    icon: "⬜",
    elementIds: ["109"],
    deckId: "12",
  },
  {
    id: "RC_SLAB",
    label: "RC Deck/Slab",
    sub: "Solid Slab · Voided Slab",
    icon: "▬",
    elementIds: ["38"],
    deckId: "38",
  },
  {
    id: "TIMBER",
    label: "Timber",
    sub: "Stringer · Deck Plank",
    icon: "🪵",
    elementIds: [] as string[],
    deckId: null as string | null,
  },
  {
    id: "OTHER",
    label: "Other / Not Set",
    sub: "Show all superstructure elements",
    icon: "?",
    elementIds: ["107", "109", "38"],
    deckId: "12",
  },
];

export const SUBSTRUCTURE_TYPES = [
  {
    id: "CONCRETE_COLUMN",
    label: "Concrete Column/Pier",
    sub: "RC Column · Drilled Shaft · Cap",
    elementIds: ["205", "234"],
  },
  {
    id: "CONCRETE_ABUTMENT",
    label: "Concrete Abutment",
    sub: "RC Abutment · Backwall · Wingwall",
    elementIds: ["215"],
  },
  {
    id: "CONCRETE_PILE",
    label: "Concrete Pile/Cap",
    sub: "RC Pile · Prestressed Pile",
    elementIds: ["225", "234"],
  },
  {
    id: "STEEL_PILE",
    label: "Steel Pile",
    sub: "H-Pile · Steel Pipe Pile",
    elementIds: ["226"],
  },
  {
    id: "TIMBER_PILE",
    label: "Timber Pile/Bent",
    sub: "Timber Pile · Timber Cap",
    elementIds: ["228"],
  },
  {
    id: "OTHER",
    label: "Other / Not Set",
    sub: "Show all substructure elements",
    elementIds: ["205", "215", "225", "226", "228", "234"],
  },
];

export const ENVIRONMENTS = [
  { id: "1", name: "1 - Benign" },
  { id: "2", name: "2 - Low" },
  { id: "3", name: "3 - Moderate" },
  { id: "4", name: "4 - Severe" },
];

export const SNBI_ELEMENTS = [
  { id: "12", name: "RC Deck", category: "Deck", material: "Concrete", unit: "sq ft" },
  { id: "38", name: "RC Slab", category: "Deck", material: "Concrete", unit: "sq ft" },
  { id: "107", name: "Steel Girder", category: "Superstructure", material: "Steel", unit: "ft" },
  { id: "108", name: "PSC Open Girder/Beam", category: "Superstructure", material: "Concrete", unit: "ft" },
  { id: "109", name: "PSC Girder", category: "Superstructure", material: "Concrete", unit: "ft" },
  { id: "113", name: "RC Open Girder/Beam", category: "Superstructure", material: "Concrete", unit: "ft" },
  { id: "205", name: "RC Column", category: "Substructure", material: "Concrete", unit: "ea" },
  { id: "215", name: "RC Abutment", category: "Substructure", material: "Concrete", unit: "ft" },
  { id: "225", name: "RC Pile", category: "Substructure", material: "Concrete", unit: "ea" },
  { id: "226", name: "Steel Pipe Pile", category: "Substructure", material: "Steel", unit: "ea" },
  { id: "228", name: "Timber Pile", category: "Substructure", material: "Timber", unit: "ea" },
  { id: "234", name: "RC Cap", category: "Substructure", material: "Concrete", unit: "ft" },
  { id: "310", name: "Elastomeric Bearing", category: "Bearing", material: "Other", unit: "ea" },
  { id: "311", name: "Movable Bearing", category: "Bearing", material: "Steel", unit: "ea" },
  { id: "313", name: "Fixed Bearing", category: "Bearing", material: "Steel", unit: "ea" },
  { id: "321", name: "RC Approach Slab", category: "Deck", material: "Concrete", unit: "sq ft" },
  { id: "330", name: "Metal Bridge Railing", category: "Railing", material: "Steel", unit: "ft" },
  { id: "331", name: "RC Bridge Railing", category: "Railing", material: "Concrete", unit: "ft" },
  { id: "300", name: "Strip Seal Joint", category: "Joint", material: "Other", unit: "ft" },
  { id: "304", name: "Open Joint", category: "Joint", material: "Other", unit: "ft" },
  { id: "515", name: "Protective Coating", category: "Other", material: "Steel", unit: "sq ft" },
] as const;

export const DEFECTS_BY_ELEMENT: Record<string, { id: string; name: string; unit: string }[]> = {
  "12": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }],
  "38": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }],
  "107": [{ id: "corr", name: "Corrosion/Section Loss", unit: "in" }, { id: "crack_s", name: "Cracking (Steel)", unit: "in" }],
  "108": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }],
  "109": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }],
  "113": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }],
  "205": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "215": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "225": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "226": [{ id: "corr_pile", name: "Section Loss (Remaining Section)", unit: "in" }, { id: "pitting", name: "Pitting Corrosion", unit: "in" }, { id: "corr", name: "Corrosion", unit: "sq ft" }],
  "228": [{ id: "decay", name: "Decay/Section Loss", unit: "in" }, { id: "check", name: "Checking/Splitting", unit: "ft" }],
  "234": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "310": [{ id: "rotation", name: "Excessive Rotation", unit: "ea" }, { id: "bulging", name: "Excessive Bulging", unit: "ea" }],
  "311": [{ id: "corr", name: "Corrosion", unit: "sq ft" }, { id: "rotation", name: "Excessive Rotation", unit: "ea" }],
  "313": [{ id: "corr", name: "Corrosion", unit: "sq ft" }, { id: "rotation", name: "Excessive Rotation", unit: "ea" }],
  "321": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "330": [{ id: "corr", name: "Corrosion", unit: "sq ft" }, { id: "impact", name: "Impact Damage", unit: "ea" }],
  "300": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }],
  "304": [{ id: "debris", name: "Debris Accumulation", unit: "sq ft" }, { id: "armour", name: "Armour Damage", unit: "ft" }],
  "331": [{ id: "impact", name: "Impact Damage", unit: "ea" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "515": [{ id: "coat_fail", name: "Coating Failure", unit: "sq ft" }],
};

const SNBI_CODE_TO_DEFECT_ID: Record<string, string> = {
  "1000": "corr",
  "1010": "crack_s",
  "1020": "crack_s",
  "1060": "spall",
  "1080": "spall",
  "1090": "spall",
  "1100": "corr_s",
  "1120": "corr_s",
  "1130": "crack",
  "1190": "wear",
  "2000": "corr",
  "2010": "crack_s",
  "3000": "decay",
  "3010": "check",
  "4000": "spall",
};

export type SnbiElement = (typeof SNBI_ELEMENTS)[number];
export type DefectType = { id: string; name: string; unit: string };
export type ConditionState = "CS1" | "CS2" | "CS3" | "CS4";

export interface PhotoItem {
  uri: string;
  description: string;
}

export interface DefectRecord {
  id: string;
  location: string;
  elementId: string;
  element: string;
  environment: string;
  defect: string;
  defectId: string;
  cs: ConditionState;
  quantityValue: string;
  maintenanceQuantityValue: string;
  quantity: string;
  size: string;
  locationDesc: string;
  photosCount: number;
  photos: PhotoItem[];
  isCritical: boolean;
  isMaintenance: boolean;
  needsVerification: boolean;
  isLegacy: boolean;
  isImported?: boolean;
}

export interface SubComponent {
  name: string;
  desc: string;
  min: string;
  rating: string;
  snbiIds: string[];
  comments: string;
  previousComments: string;
  isImported?: boolean;
}

export interface NbiRating {
  item: string;
  description: string;
  subComponents: SubComponent[];
}

export interface CifData {
  structureNumber: string;
  inspectionDate: string;
  findings: string;
  defectDistress: string;
  material: string;
  referenceFeature: string;
  recommendation: string;
  phoneNotified: boolean;
  assetWiseLogged: boolean;
  photos: PhotoItem[];
}

export interface FuaData {
  fuaId: string;
  priority: string;
  previouslyRecommended: string;
  description: string;
  recommendation: string;
  bridgeComponent: string;
  phoneNotified: boolean;
  assetWiseLogged: boolean;
  photos: PhotoItem[];
}

const INITIAL_NBI_RATINGS: NbiRating[] = [
  {
    item: "58",
    description: "Deck",
    subComponents: [
      { name: "Deck - Component Rating", desc: "", min: "1", rating: "", snbiIds: ["12","38"], comments: "", previousComments: "" },
      { name: "Wearing Surface", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Joints, Expansion, Open", desc: "", min: "6", rating: "", snbiIds: ["304"], comments: "", previousComments: "" },
      { name: "Joints, Expansion, Sealed", desc: "", min: "6", rating: "", snbiIds: ["300"], comments: "", previousComments: "" },
      { name: "Joints, Other", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Drainage System", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Curbs, Sidewalk & Parapets", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Median Barrier", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Railings", desc: "", min: "6", rating: "", snbiIds: ["331"], comments: "", previousComments: "" },
      { name: "Railing Protective Coating", desc: "", min: "7", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Delineation", desc: "", min: "7", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Other", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
    ],
  },
  {
    item: "59",
    description: "Superstructure",
    subComponents: [
      { name: "Main Members - Steel", desc: "", min: "0", rating: "", snbiIds: ["107"], comments: "", previousComments: "" },
      { name: "Main Members - Concrete", desc: "", min: "0", rating: "", snbiIds: ["109"], comments: "", previousComments: "" },
      { name: "Main Members - Timber", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Main Members - Connections", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Floor System Members", desc: "", min: "1", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Floor System Connections", desc: "", min: "1", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Secondary Members", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Secondary Mem. Connections", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Expansion Bearings", desc: "", min: "6", rating: "", snbiIds: ["310"], comments: "", previousComments: "" },
      { name: "Fixed Bearings", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Steel Protective Coating", desc: "", min: "6", rating: "", snbiIds: ["515"], comments: "", previousComments: "" },
      { name: "Overall Component Rating", desc: "", min: "-", rating: "", snbiIds: ["107","109"], comments: "", previousComments: "" },
    ],
  },
  {
    item: "60",
    description: "Substructure",
    subComponents: [
      { name: "Abutment Caps", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Above Ground", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Below Ground or Foundation", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Backwalls & Wingwalls", desc: "", min: "0", rating: "", snbiIds: ["215"], comments: "", previousComments: "" },
      { name: "Caps - Concrete", desc: "", min: "-", rating: "", snbiIds: ["234"], comments: "", previousComments: "" },
      { name: "Caps - Steel", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Caps - Timber", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Above Ground - Concrete", desc: "", min: "-", rating: "", snbiIds: ["205"], comments: "", previousComments: "" },
      { name: "Above Ground - Steel", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Above Ground - Timber", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Above Ground - Masonry", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Below Ground (Int. Supports)", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Collision Protection System", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Steel Protective Coating", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Overall Component Rating", desc: "", min: "-", rating: "", snbiIds: ["205","215","234"], comments: "", previousComments: "" },
    ],
  },
  {
    item: "61",
    description: "Channel",
    subComponents: [
      { name: "Channel Banks", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Channel Bed", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Rip Rap, Toe Walls & Apron", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Dikes", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Jetties", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Overall Component Rating", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
    ],
  },
  {
    item: "65",
    description: "Approaches",
    subComponents: [
      { name: "Embankments", desc: "", min: "0", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Embankment Retaining Walls", desc: "", min: "4", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Slope Protection", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Roadway", desc: "", min: "5", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Relief Joints", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Drainage", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Guardfence", desc: "", min: "6", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Delineation", desc: "", min: "7", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Sight Distance", desc: "", min: "7", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Overall Component Rating", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
    ],
  },
  {
    item: "36",
    description: "Traffic Safety",
    subComponents: [
      { name: "Bridge Rails", desc: "", min: "-", rating: "", snbiIds: ["331"], comments: "", previousComments: "" },
      { name: "Transitions", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Approach Rails", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
      { name: "Approach Rail Ends", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
    ],
  },
  {
    item: "71",
    description: "Waterway",
    subComponents: [
      { name: "Waterway Adequacy", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
    ],
  },
  {
    item: "72",
    description: "Appr. Alignment",
    subComponents: [
      { name: "Approach Roadway Alignment", desc: "", min: "-", rating: "", snbiIds: [], comments: "", previousComments: "" },
    ],
  },
];

const INITIAL_CIF: CifData = {
  structureNumber: "",
  inspectionDate: new Date().toLocaleDateString("en-US"),
  findings: "",
  defectDistress: "",
  material: "",
  referenceFeature: "",
  recommendation: "",
  phoneNotified: false,
  assetWiseLogged: false,
  photos: [],
};

const INITIAL_FUA: FuaData = {
  fuaId: "",
  priority: "Level 3",
  previouslyRecommended: "N",
  description: "",
  recommendation: "",
  bridgeComponent: "",
  phoneNotified: false,
  assetWiseLogged: false,
  photos: [],
};

// ─── Context Types ────────────────────────────────────────────────────────────

interface InspectionContextType {
  // Settings
  nomenclature: string;
  setNomenclature: (v: string) => void;
  inspectionType: string;
  setInspectionType: (v: string) => void;
  superstructureType: string;
  setSuperstructureType: (v: string) => void;
  substructureType: string;
  setSubstructureType: (v: string) => void;
  supportCount: number;

  // Form state
  editId: string | null;
  setEditId: (v: string | null) => void;
  currentLocation: string;
  setCurrentLocation: (v: string) => void;
  element: SnbiElement | null;
  setElement: (v: SnbiElement | null) => void;
  environment: string;
  setEnvironment: (v: string) => void;
  defect: DefectType | null;
  setDefect: (v: DefectType | null) => void;
  conditionState: ConditionState;
  setConditionState: (v: ConditionState) => void;
  quantity: string;
  setQuantity: (v: string) => void;
  maintenanceQuantity: string;
  setMaintenanceQuantity: (v: string) => void;
  size: string;
  setSize: (v: string) => void;
  locationDesc: string;
  setLocationDesc: (v: string) => void;
  isCritical: boolean;
  setIsCritical: (v: boolean) => void;
  isMaintenance: boolean;
  setIsMaintenance: (v: boolean) => void;
  photos: PhotoItem[];
  setPhotos: (v: PhotoItem[]) => void;

  // Saved data
  savedDefects: DefectRecord[];
  setSavedDefects: (v: DefectRecord[]) => void;
  nbiRatings: NbiRating[];
  setNbiRatings: (v: NbiRating[]) => void;

  // Modal state
  showCIFModal: boolean;
  setShowCIFModal: (v: boolean) => void;
  showFUAModal: boolean;
  setShowFUAModal: (v: boolean) => void;
  pendingFUA: boolean;
  setPendingFUA: (v: boolean) => void;
  cifData: CifData;
  setCifData: (v: CifData) => void;
  fuaData: FuaData;
  setFuaData: (v: FuaData) => void;

  // Filters
  sortCriteria: string;
  setSortCriteria: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  rangeMin: string;
  setRangeMin: (v: string) => void;
  rangeMax: string;
  setRangeMax: (v: string) => void;
  syncToCurrentLoc: boolean;
  setSyncToCurrentLoc: (v: boolean) => void;

  // Derived
  locationSequence: string[];
  filteredElements: readonly SnbiElement[];
  sessionManifest: DefectRecord[];
  legacyManifest: DefectRecord[];
  elementSummary: ElementSummaryRow[];
  criticalFindingsSummary: DefectRecord[];
  maintenanceSummary: DefectRecord[];

  // Structure number
  structureNumber: string;
  setStructureNumber: (v: string) => void;

  // Actions
  handleSave: () => void;
  startEdit: (record: DefectRecord) => void;
  deleteDefect: (id: string) => void;
  verifyDefect: (id: string) => void;
  completeCIF: () => void;
  completeFUA: () => void;
  updateSubComponent: (
    itemIndex: number,
    compIndex: number,
    field: string,
    value: string
  ) => void;
  importFromPdf: (source: File | { uri: string; name?: string }) => Promise<void>;
  parsingActive: boolean;
}

export interface ElementSummaryRow {
  name: string;
  unit: string;
  CS1: number;
  CS2: number;
  CS3: number;
  CS4: number;
  maintQty: number;
  critQty: number;
  total: number;
}

const InspectionContext = createContext<InspectionContextType | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLocationSequence(
  inspectionType: string,
  nomenclature: string,
  supportCount: number
): string[] {
  const sequence: string[] = [];
  if (inspectionType === INSPECTION_TYPES.TOPSIDE) {
    sequence.push("Approach 1");
    for (let i = 1; i < supportCount; i++) {
      sequence.push(`Joint ${i}`, `Span ${i}`);
    }
    sequence.push("Approach 2");
  } else {
    const start =
      nomenclature === NOMENCLATURES.TXDOT ? "Abutment 1" : "End Bent 1";
    const end =
      nomenclature === NOMENCLATURES.TXDOT
        ? `Abutment ${supportCount}`
        : "End Bent 2";
    sequence.push(start);
    for (let i = 1; i < supportCount - 1; i++) {
      sequence.push(
        `Span ${i}`,
        `Bent ${nomenclature === NOMENCLATURES.TXDOT ? i + 1 : i}`
      );
    }
    sequence.push(`Span ${supportCount - 1}`, end);
  }
  return sequence;
}

function getFilteredElements(
  location: string,
  superTypeId: string,
  subTypeId: string
): readonly SnbiElement[] {
  if (!location) return [];

  if (location.includes("Joint"))
    return SNBI_ELEMENTS.filter((e) => e.category === "Joint");

  if (location.includes("Approach"))
    return SNBI_ELEMENTS.filter((e) => ["Deck", "Railing"].includes(e.category));

  if (location.includes("Span")) {
    const sType = SUPERSTRUCTURE_TYPES.find((t) => t.id === superTypeId);
    if (!sType || superTypeId === "OTHER") {
      return SNBI_ELEMENTS.filter((e) =>
        ["Deck", "Superstructure", "Railing", "Bearing", "Other"].includes(e.category)
      );
    }
    const allowedIds = new Set<string>([
      ...(sType.deckId ? [sType.deckId] : []),
      ...sType.elementIds,
      "331",
      "310",
    ]);
    return SNBI_ELEMENTS.filter((e) => allowedIds.has(e.id));
  }

  if (
    location.includes("Abutment") ||
    location.includes("Bent") ||
    location.includes("End Bent")
  ) {
    const sType = SUBSTRUCTURE_TYPES.find((t) => t.id === subTypeId);
    if (!sType || subTypeId === "OTHER") {
      return SNBI_ELEMENTS.filter((e) =>
        ["Substructure", "Bearing"].includes(e.category)
      );
    }
    const allowedIds = new Set<string>([...sType.elementIds, "310"]);
    return SNBI_ELEMENTS.filter((e) => allowedIds.has(e.id));
  }

  return SNBI_ELEMENTS;
}

function applyFilters(
  list: DefectRecord[],
  syncToCurrentLoc: boolean,
  currentLocation: string,
  filterType: string,
  rangeMin: string,
  rangeMax: string,
  sortCriteria: string
): DefectRecord[] {
  let result = [...list];
  if (syncToCurrentLoc) {
    result = result.filter((d) => d.location === currentLocation);
  } else {
    if (filterType !== "All")
      result = result.filter((d) => d.location.includes(filterType));
    if (rangeMin || rangeMax) {
      result = result.filter((d) => {
        const numMatch = String(d.location).match(/\d+/);
        if (!numMatch) return true;
        const num = parseInt(numMatch[0]);
        const min = rangeMin === "" ? -Infinity : parseInt(rangeMin);
        const max = rangeMax === "" ? Infinity : parseInt(rangeMax);
        return num >= min && num <= max;
      });
    }
  }
  return result.sort((a, b) => {
    if (sortCriteria === "location")
      return String(a.location).localeCompare(String(b.location), undefined, {
        numeric: true,
      });
    if (sortCriteria === "severity") {
      const order: Record<string, number> = {
        CS4: 0,
        CS3: 1,
        CS2: 2,
        CS1: 3,
      };
      return (order[a.cs] ?? 4) - (order[b.cs] ?? 4);
    }
    return String(a.element).localeCompare(String(b.element));
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  SAVED_DEFECTS: "@bridge_saved_defects",
  NBI_RATINGS: "@bridge_nbi_ratings",
  NOMENCLATURE: "@bridge_nomenclature",
  INSPECTION_TYPE: "@bridge_inspection_type",
  SUPERSTRUCTURE_TYPE: "@bridge_superstructure_type",
  SUBSTRUCTURE_TYPE: "@bridge_substructure_type",
  STRUCTURE_NUMBER: "@bridge_structure_number",
  DEMO_CLEARED: "@bridge_demo_cleared_v1",
};

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const supportCount = 25;

  const [nomenclature, setNomenclatureState] = useState(NOMENCLATURES.TXDOT);
  const [inspectionType, setInspectionTypeState] = useState(INSPECTION_TYPES.TOPSIDE);
  const [superstructureType, setSuperstructureTypeState] = useState("OTHER");
  const [substructureType, setSubstructureTypeState] = useState("OTHER");
  const [savedDefects, setSavedDefectsState] = useState<DefectRecord[]>([]);
  const [nbiRatings, setNbiRatingsState] = useState<NbiRating[]>(INITIAL_NBI_RATINGS);
  const [structureNumber, setStructureNumberState] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState("");
  const [element, setElement] = useState<SnbiElement | null>(null);
  const [environment, setEnvironment] = useState("2");
  const [defect, setDefect] = useState<DefectType | null>(null);
  const [conditionState, setConditionState] = useState<ConditionState>("CS1");
  const [quantity, setQuantity] = useState("");
  const [maintenanceQuantity, setMaintenanceQuantity] = useState("");
  const [size, setSize] = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [showCIFModal, setShowCIFModal] = useState(false);
  const [showFUAModal, setShowFUAModal] = useState(false);
  const [pendingFUA, setPendingFUA] = useState(false);
  const [cifData, setCifData] = useState<CifData>(INITIAL_CIF);
  const [fuaData, setFuaData] = useState<FuaData>(INITIAL_FUA);

  const [sortCriteria, setSortCriteria] = useState("location");
  const [filterType, setFilterType] = useState("All");
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");
  const [syncToCurrentLoc, setSyncToCurrentLoc] = useState(false);
  const [parsingActive, setParsingActive] = useState(false);

  // ── AsyncStorage load on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const demoCleared = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_CLEARED);
        if (!demoCleared) {
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.SAVED_DEFECTS,
            STORAGE_KEYS.NBI_RATINGS,
            STORAGE_KEYS.STRUCTURE_NUMBER,
          ]);
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_CLEARED, "1");
        }
        const [defects, nbi, nom, insType, superType, subType, structNum] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SAVED_DEFECTS),
          AsyncStorage.getItem(STORAGE_KEYS.NBI_RATINGS),
          AsyncStorage.getItem(STORAGE_KEYS.NOMENCLATURE),
          AsyncStorage.getItem(STORAGE_KEYS.INSPECTION_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.SUPERSTRUCTURE_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.SUBSTRUCTURE_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.STRUCTURE_NUMBER),
        ]);
        if (defects) setSavedDefectsState(JSON.parse(defects));
        if (nbi) setNbiRatingsState(JSON.parse(nbi));
        if (nom) setNomenclatureState(nom);
        if (insType) setInspectionTypeState(insType);
        if (superType) setSuperstructureTypeState(superType);
        if (subType) setSubstructureTypeState(subType);
        if (structNum) {
          setStructureNumberState(structNum);
          setCifData((prev) => ({ ...prev, structureNumber: structNum }));
        }
      } catch {}
    };
    load();
  }, []);

  // ── Persist savedDefects ──
  const setSavedDefects = useCallback((v: DefectRecord[]) => {
    setSavedDefectsState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SAVED_DEFECTS, JSON.stringify(v)).catch(() => {});
  }, []);

  // ── Persist nbiRatings ──
  const setNbiRatings = useCallback((v: NbiRating[]) => {
    setNbiRatingsState(v);
    AsyncStorage.setItem(STORAGE_KEYS.NBI_RATINGS, JSON.stringify(v)).catch(() => {});
  }, []);

  const setNomenclature = useCallback((v: string) => {
    setNomenclatureState(v);
    AsyncStorage.setItem(STORAGE_KEYS.NOMENCLATURE, v).catch(() => {});
  }, []);

  const setInspectionType = useCallback((v: string) => {
    setInspectionTypeState(v);
    AsyncStorage.setItem(STORAGE_KEYS.INSPECTION_TYPE, v).catch(() => {});
  }, []);

  const setSuperstructureType = useCallback((v: string) => {
    setSuperstructureTypeState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SUPERSTRUCTURE_TYPE, v).catch(() => {});
  }, []);

  const setSubstructureType = useCallback((v: string) => {
    setSubstructureTypeState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SUBSTRUCTURE_TYPE, v).catch(() => {});
  }, []);

  const setStructureNumber = useCallback((v: string) => {
    setStructureNumberState(v);
    AsyncStorage.setItem(STORAGE_KEYS.STRUCTURE_NUMBER, v).catch(() => {});
    setCifData((prev) => ({ ...prev, structureNumber: v }));
  }, []);

  // ── Derived ──
  const locationSequence = useMemo(
    () => buildLocationSequence(inspectionType, nomenclature, supportCount),
    [inspectionType, nomenclature]
  );

  const filteredElements = useMemo(
    () => getFilteredElements(currentLocation, superstructureType, substructureType),
    [currentLocation, superstructureType, substructureType]
  );

  useEffect(() => {
    if (!editId && locationSequence.length > 0) {
      setCurrentLocation(locationSequence[0]);
    }
  }, [locationSequence, editId]);

  useEffect(() => {
    if (filteredElements.length > 0 && !editId) {
      setElement(filteredElements[0]);
    }
  }, [filteredElements, editId]);

  useEffect(() => {
    if (element && !editId) {
      const available = DEFECTS_BY_ELEMENT[element.id] || [];
      setDefect(available[0] || null);
    }
  }, [element, editId]);

  const sessionManifest = useMemo(() => {
    const base = savedDefects.filter(
      (d) => !d.needsVerification && !d.isLegacy
    );
    return applyFilters(base, syncToCurrentLoc, currentLocation, filterType, rangeMin, rangeMax, sortCriteria);
  }, [savedDefects, syncToCurrentLoc, currentLocation, filterType, rangeMin, rangeMax, sortCriteria]);

  const legacyManifest = useMemo(() => {
    const base = savedDefects.filter(
      (d) => d.needsVerification || d.isLegacy
    );
    return applyFilters(base, syncToCurrentLoc, currentLocation, filterType, rangeMin, rangeMax, sortCriteria);
  }, [savedDefects, syncToCurrentLoc, currentLocation, filterType, rangeMin, rangeMax, sortCriteria]);

  const elementSummary = useMemo<ElementSummaryRow[]>(() => {
    const summary: Record<string, ElementSummaryRow> = {};
    savedDefects.forEach((d) => {
      const elKey = d.elementId || d.element;
      if (!summary[elKey]) {
        const fullEl = SNBI_ELEMENTS.find(
          (e) => e.id === d.elementId || e.name === d.element
        );
        summary[elKey] = {
          name: fullEl?.name || d.element,
          unit: fullEl?.unit || "",
          CS1: 0,
          CS2: 0,
          CS3: 0,
          CS4: 0,
          maintQty: 0,
          critQty: 0,
          total: 0,
        };
      }
      const qty = parseFloat(d.quantityValue) || 0;
      const mQty = parseFloat(d.maintenanceQuantityValue) || qty;
      const row = summary[elKey];
      (row as Record<string, number>)[d.cs] += qty;
      row.total += qty;
      if (d.isMaintenance) row.maintQty += mQty;
      if (d.isCritical) row.critQty += qty;
    });
    return Object.values(summary);
  }, [savedDefects]);

  const criticalFindingsSummary = useMemo(
    () => savedDefects.filter((d) => d.isCritical),
    [savedDefects]
  );

  const maintenanceSummary = useMemo(
    () => savedDefects.filter((d) => d.isMaintenance),
    [savedDefects]
  );

  // ── Actions ──
  const handleSave = useCallback(() => {
    if (!element || !defect) return;
    const id = editId || (Date.now().toString() + Math.random().toString(36).substr(2, 9));
    const record: DefectRecord = {
      id,
      location: currentLocation,
      elementId: element.id,
      element: element.name,
      environment,
      defect: defect.name,
      defectId: defect.id,
      cs: conditionState,
      quantityValue: quantity,
      maintenanceQuantityValue: maintenanceQuantity || quantity,
      quantity: `${quantity} ${defect.unit}`,
      size,
      locationDesc,
      photosCount: photos.length,
      photos: [...photos],
      isCritical,
      isMaintenance,
      needsVerification: false,
      isLegacy: false,
    };

    const updated = editId
      ? savedDefects.map((d) => (d.id === editId ? record : d))
      : [record, ...savedDefects];

    setSavedDefects(updated);
    setEditId(null);

    if (isCritical) {
      setCifData({
        ...INITIAL_CIF,
        structureNumber: cifData.structureNumber,
        inspectionDate: cifData.inspectionDate,
        findings: locationDesc,
        defectDistress: defect.name,
        material: element.material,
        referenceFeature: `${element.id}. ${element.name}`,
        photos: [...photos],
        phoneNotified: false,
        assetWiseLogged: false,
      });
      setPendingFUA(isMaintenance);
      setShowCIFModal(true);
    } else if (isMaintenance) {
      setFuaData({
        ...INITIAL_FUA,
        description: locationDesc,
        bridgeComponent: element.name,
        photos: [...photos],
        phoneNotified: false,
        assetWiseLogged: false,
      });
      setShowFUAModal(true);
    }

    setQuantity("");
    setMaintenanceQuantity("");
    setSize("");
    setLocationDesc("");
    setIsCritical(false);
    setIsMaintenance(false);
    setPhotos([]);
  }, [
    editId,
    element,
    defect,
    currentLocation,
    environment,
    conditionState,
    quantity,
    maintenanceQuantity,
    size,
    locationDesc,
    photos,
    isCritical,
    isMaintenance,
    savedDefects,
    cifData.structureNumber,
    cifData.inspectionDate,
    setSavedDefects,
  ]);

  const startEdit = useCallback(
    (record: DefectRecord) => {
      setEditId(record.id);
      setCurrentLocation(record.location);
      const matchedEl = SNBI_ELEMENTS.find(
        (e) => String(e.id) === String(record.elementId)
      );
      if (matchedEl) {
        setElement(matchedEl);
        const available = DEFECTS_BY_ELEMENT[matchedEl.id] || [];
        setDefect(
          available.find((d) => String(d.id) === String(record.defectId)) ||
            available[0] ||
            null
        );
      }
      setEnvironment(record.environment);
      setConditionState(record.cs);
      setQuantity(record.quantityValue);
      setMaintenanceQuantity(record.maintenanceQuantityValue || "");
      setSize(record.size);
      setLocationDesc(record.locationDesc);
      setIsCritical(record.isCritical || false);
      setIsMaintenance(record.isMaintenance || false);
      setPhotos(record.photos || []);
    },
    []
  );

  const deleteDefect = useCallback(
    (id: string) => {
      setSavedDefects(savedDefects.filter((d) => d.id !== id));
    },
    [savedDefects, setSavedDefects]
  );

  const verifyDefect = useCallback(
    (id: string) => {
      setSavedDefects(
        savedDefects.map((d) =>
          d.id === id ? { ...d, needsVerification: false, isLegacy: true } : d
        )
      );
    },
    [savedDefects, setSavedDefects]
  );

  const completeCIF = useCallback(() => {
    if (!cifData.phoneNotified || !cifData.assetWiseLogged) return false;
    setShowCIFModal(false);
    if (pendingFUA) {
      setFuaData({
        ...INITIAL_FUA,
        description: cifData.findings,
        bridgeComponent: cifData.referenceFeature,
        recommendation: cifData.recommendation,
        photos: [...cifData.photos],
        phoneNotified: false,
        assetWiseLogged: false,
      });
      setShowFUAModal(true);
      setPendingFUA(false);
    }
    return true;
  }, [cifData, pendingFUA]);

  const completeFUA = useCallback(() => {
    if (
      (fuaData.priority === "Level 1" || fuaData.priority === "Level 2") &&
      !fuaData.phoneNotified
    )
      return false;
    if (!fuaData.assetWiseLogged) return false;
    setShowFUAModal(false);
    return true;
  }, [fuaData]);

  const updateSubComponent = useCallback(
    (itemIndex: number, compIndex: number, field: string, value: string) => {
      const next = [...nbiRatings];
      const nextItem = { ...next[itemIndex] };
      const nextSub = [...nextItem.subComponents];
      nextSub[compIndex] = { ...nextSub[compIndex], [field]: value };
      nextItem.subComponents = nextSub;
      next[itemIndex] = nextItem;
      setNbiRatings(next);
    },
    [nbiRatings, setNbiRatings]
  );

  const importFromPdf = useCallback(
    async (source: File | { uri: string; name?: string }) => {
      setParsingActive(true);
      try {
        const { structureNumber: parsedNum, elements, nbi } = await parseReport(source);

        if (parsedNum) {
          setStructureNumber(parsedNum);
        }

        const ts = Date.now();
        const newDefects: DefectRecord[] = [];
        let recIndex = 0;

        let currentParentElementId = "";
        let currentParentElementName = "";

        for (const row of elements) {
          const csMap: [ConditionState, number][] = [
            ["CS1", row.cs1],
            ["CS2", row.cs2],
            ["CS3", row.cs3],
            ["CS4", row.cs4],
          ];

          if (!row.isDefect) {
            currentParentElementId = row.elementId;
            const match = (SNBI_ELEMENTS as readonly { id: string; name: string }[]).find(
              (e) => e.id === row.elementId
            );
            currentParentElementName = match?.name || row.elementName;

            for (const [cs, qty] of csMap) {
              if (qty <= 0) continue;
              const defects = DEFECTS_BY_ELEMENT[row.elementId];
              const defaultDefect = defects?.[0] || { id: "other", name: "General Defect", unit: row.unit || "ea" };
              recIndex++;
              newDefects.push({
                id: `pdf-${ts}-${recIndex}`,
                location: "Unassigned",
                elementId: row.elementId,
                element: currentParentElementName,
                environment: row.environment || "2",
                defect: defaultDefect.name,
                defectId: defaultDefect.id,
                cs,
                quantityValue: String(qty),
                maintenanceQuantityValue: String(qty),
                quantity: `${qty} ${row.unit || "ea"}`,
                size: "",
                locationDesc: `${currentParentElementName} — ${cs} — Imported`,
                needsVerification: true,
                isLegacy: true,
                isImported: true,
                photos: [],
                photosCount: 0,
                isCritical: false,
                isMaintenance: false,
              });
            }
          } else {
            const defectName = row.elementName;
            const snbiCode = row.defectCode || "";
            const internalDefectId =
              SNBI_CODE_TO_DEFECT_ID[snbiCode] ||
              DEFECTS_BY_ELEMENT[currentParentElementId]?.[0]?.id ||
              "other";
            const unit =
              DEFECTS_BY_ELEMENT[currentParentElementId]?.find((d) => d.id === internalDefectId)?.unit ||
              "ea";

            for (const [cs, qty] of csMap) {
              if (qty <= 0) continue;
              recIndex++;
              newDefects.push({
                id: `pdf-${ts}-${recIndex}`,
                location: "Unassigned",
                elementId: currentParentElementId,
                element: currentParentElementName,
                environment: row.environment || "2",
                defect: defectName,
                defectId: internalDefectId,
                cs,
                quantityValue: String(qty),
                maintenanceQuantityValue: String(qty),
                quantity: `${qty} ${unit}`,
                size: "",
                locationDesc: `${defectName} — ${cs} — Imported`,
                needsVerification: true,
                isLegacy: true,
                isImported: true,
                photos: [],
                photosCount: 0,
                isCritical: false,
                isMaintenance: false,
              });
            }
          }
        }

        setSavedDefectsState((prev) => {
          const merged = [...newDefects, ...prev];
          AsyncStorage.setItem(STORAGE_KEYS.SAVED_DEFECTS, JSON.stringify(merged)).catch(() => {});
          return merged;
        });

        const FUZZY_THRESHOLD = 0.5;

        function findFuzzyNbiEntry(
          entries: typeof nbi,
          itemId: string,
          subName: string,
          usedIndices: Set<number>
        ): { entry: (typeof nbi)[number]; index: number } | null {
          let bestScore = 0;
          let bestIndex = -1;
          for (let idx = 0; idx < entries.length; idx++) {
            if (usedIndices.has(idx)) continue;
            const r = entries[idx];
            if (r.item !== itemId) continue;
            const score = nbiSubNameMatchScore(r.componentName, subName);
            if (score > bestScore) {
              bestScore = score;
              bestIndex = idx;
            }
          }
          if (bestScore >= FUZZY_THRESHOLD && bestIndex >= 0) {
            return { entry: entries[bestIndex], index: bestIndex };
          }
          return null;
        }

        const usedIndicesForAlert = new Set<number>();
        let nbiMatchedCount = 0;
        for (const item of nbiRatings) {
          for (const sub of item.subComponents) {
            const result = findFuzzyNbiEntry(nbi, item.item, sub.name, usedIndicesForAlert);
            if (result) {
              usedIndicesForAlert.add(result.index);
              nbiMatchedCount++;
            }
          }
        }
        const unmatchedNbi = nbi.filter((_, i) => !usedIndicesForAlert.has(i));
        if (unmatchedNbi.length > 0) {
          console.warn(
            "[NBI Import] Unmatched components (not imported):",
            unmatchedNbi.map((r) => `Item ${r.item}: "${r.componentName}"`).join(", ")
          );
        }

        if (nbi.length > 0) {
          setNbiRatingsState((prevNbi) => {
            const usedIndices = new Set<number>();
            const updated = prevNbi.map((item) => ({
              ...item,
              subComponents: item.subComponents.map((sub) => {
                const result = findFuzzyNbiEntry(nbi, item.item, sub.name, usedIndices);
                if (!result) return sub;
                usedIndices.add(result.index);
                const match = result.entry;
                const wasBlank = !sub.rating;
                return {
                  ...sub,
                  rating: wasBlank ? match.rating : sub.rating,
                  previousComments: match.comment || sub.previousComments,
                  isImported: !!(match.rating || match.comment),
                };
              }),
            }));
            AsyncStorage.setItem(STORAGE_KEYS.NBI_RATINGS, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }

        const unmatchedNames = unmatchedNbi.map((r) => `Item ${r.item}: ${r.componentName}`);
        const unmatchedSummary =
          unmatchedNames.length > 0
            ? `\n\n${unmatchedNames.length} NBI component(s) not matched:\n${unmatchedNames.join("\n")}`
            : "";

        const { Alert } = require("react-native");
        Alert.alert(
          "Import Complete",
          `Imported ${newDefects.length} element record(s) across ${
            elements.filter((e) => !e.isDefect).length
          } elements.\n${nbiMatchedCount} NBI rating(s) pre-filled.${unmatchedSummary}\n${
            parsedNum ? `Structure: ${parsedNum}` : "Structure number not found."
          }\n\nAssign locations and verify records before submitting.`
        );
      } catch (err: unknown) {
        const { Alert } = require("react-native");
        const message = err instanceof Error ? err.message : "Could not parse the PDF. Ensure the file is a valid TxDOT inspection report.";
        Alert.alert("Import Failed", message);
      } finally {
        setParsingActive(false);
      }
    },
    [setSavedDefectsState, setNbiRatingsState, setStructureNumber, nbiRatings]
  );

  const value: InspectionContextType = {
    nomenclature,
    setNomenclature,
    inspectionType,
    setInspectionType,
    superstructureType,
    setSuperstructureType,
    substructureType,
    setSubstructureType,
    supportCount,
    editId,
    setEditId,
    currentLocation,
    setCurrentLocation,
    element,
    setElement,
    environment,
    setEnvironment,
    defect,
    setDefect,
    conditionState,
    setConditionState,
    quantity,
    setQuantity,
    maintenanceQuantity,
    setMaintenanceQuantity,
    size,
    setSize,
    locationDesc,
    setLocationDesc,
    isCritical,
    setIsCritical,
    isMaintenance,
    setIsMaintenance,
    photos,
    setPhotos,
    savedDefects,
    setSavedDefects,
    nbiRatings,
    setNbiRatings,
    showCIFModal,
    setShowCIFModal,
    showFUAModal,
    setShowFUAModal,
    pendingFUA,
    setPendingFUA,
    cifData,
    setCifData,
    fuaData,
    setFuaData,
    sortCriteria,
    setSortCriteria,
    filterType,
    setFilterType,
    rangeMin,
    setRangeMin,
    rangeMax,
    setRangeMax,
    syncToCurrentLoc,
    setSyncToCurrentLoc,
    locationSequence,
    filteredElements,
    sessionManifest,
    legacyManifest,
    elementSummary,
    criticalFindingsSummary,
    maintenanceSummary,
    handleSave,
    startEdit,
    deleteDefect,
    verifyDefect,
    completeCIF,
    completeFUA,
    updateSubComponent,
    structureNumber,
    setStructureNumber,
    importFromPdf,
    parsingActive,
  };

  return (
    <InspectionContext.Provider value={value}>
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection() {
  const ctx = useContext(InspectionContext);
  if (!ctx) throw new Error("useInspection must be used within InspectionProvider");
  return ctx;
}
