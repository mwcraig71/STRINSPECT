import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

export const NOMENCLATURES = {
  TXDOT: "Texas (TxDOT)",
  NCDOT: "North Carolina (NCDOT)",
};

export const INSPECTION_TYPES = {
  TOPSIDE: "Topside",
  UNDERSIDE: "Underside",
};

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
  { id: "109", name: "PSC Girder", category: "Superstructure", material: "Concrete", unit: "ft" },
  { id: "205", name: "RC Column", category: "Substructure", material: "Concrete", unit: "ea" },
  { id: "215", name: "RC Abutment", category: "Substructure", material: "Concrete", unit: "ft" },
  { id: "225", name: "RC Pile", category: "Substructure", material: "Concrete", unit: "ea" },
  { id: "226", name: "Steel Pipe Pile", category: "Substructure", material: "Steel", unit: "ea" },
  { id: "228", name: "Timber Pile", category: "Substructure", material: "Timber", unit: "ea" },
  { id: "234", name: "RC Cap", category: "Substructure", material: "Concrete", unit: "ft" },
  { id: "310", name: "Elastomeric Bearing", category: "Bearing", material: "Other", unit: "ea" },
  { id: "331", name: "RC Bridge Railing", category: "Railing", material: "Concrete", unit: "ft" },
  { id: "300", name: "Strip Seal Joint", category: "Joint", material: "Other", unit: "ft" },
  { id: "304", name: "Open Joint", category: "Joint", material: "Other", unit: "ft" },
  { id: "515", name: "Protective Coating", category: "Other", material: "Steel", unit: "sq ft" },
] as const;

export const DEFECTS_BY_ELEMENT: Record<string, { id: string; name: string; unit: string }[]> = {
  "12": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "38": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "107": [{ id: "corr", name: "Corrosion/Section Loss", unit: "in" }, { id: "crack_s", name: "Cracking (Steel)", unit: "in" }],
  "109": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "205": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "215": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "225": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "226": [{ id: "corr_pile", name: "Section Loss (Remaining Section)", unit: "in" }, { id: "pitting", name: "Pitting Corrosion", unit: "in" }],
  "228": [{ id: "decay", name: "Decay/Section Loss", unit: "in" }, { id: "check", name: "Checking/Splitting", unit: "ft" }],
  "234": [{ id: "spall", name: "Spalling/Delamination", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "310": [{ id: "rotation", name: "Excessive Rotation", unit: "ea" }, { id: "bulging", name: "Excessive Bulging", unit: "ea" }],
  "300": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }],
  "304": [{ id: "debris", name: "Debris Accumulation", unit: "sq ft" }, { id: "armour", name: "Armour Damage", unit: "ft" }],
  "331": [{ id: "impact", name: "Impact Damage", unit: "ea" }, { id: "crack", name: "Cracking", unit: "ft" }],
  "515": [{ id: "coat_fail", name: "Coating Failure", unit: "sq ft" }],
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
}

export interface SubComponent {
  name: string;
  desc: string;
  min: string;
  rating: string;
  snbiIds: string[];
  comments: string;
  previousComments: string;
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
      {
        name: "Deck - Component Rating",
        desc: "",
        min: "6",
        rating: "7",
        snbiIds: ["12", "38"],
        comments: "",
        previousComments:
          "Underside exhibits isolated insignificant transverse cracks with isolated light efflorescence.",
      },
    ],
  },
  {
    item: "59",
    description: "Superstructure",
    subComponents: [
      {
        name: "Superstructure - Component Rating",
        desc: "",
        min: "6",
        rating: "7",
        snbiIds: ["107", "109"],
        comments: "",
        previousComments: "Steel girders show light surface corrosion on bottom flanges.",
      },
    ],
  },
  {
    item: "60",
    description: "Substructure",
    subComponents: [
      {
        name: "Substructure - Component Rating",
        desc: "",
        min: "6",
        rating: "N",
        snbiIds: ["205", "215", "225", "226", "228", "234"],
        comments: "",
        previousComments: "RC substructure units show minor efflorescence.",
      },
    ],
  },
];

const INITIAL_CIF: CifData = {
  structureNumber: "18-061-0081-13-133",
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
  fuaId: "645238",
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
  simulateLegacyImport: () => void;
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

function getFilteredElements(location: string): readonly SnbiElement[] {
  if (!location) return [];
  if (location.includes("Joint"))
    return SNBI_ELEMENTS.filter((e) => e.category === "Joint");
  if (location.includes("Approach"))
    return SNBI_ELEMENTS.filter((e) =>
      ["Deck", "Railing"].includes(e.category)
    );
  if (location.includes("Span"))
    return SNBI_ELEMENTS.filter((e) =>
      ["Deck", "Superstructure", "Railing"].includes(e.category)
    );
  if (
    location.includes("Abutment") ||
    location.includes("Bent") ||
    location.includes("End Bent")
  ) {
    return SNBI_ELEMENTS.filter((e) =>
      ["Substructure", "Bearing"].includes(e.category)
    );
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
};

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const supportCount = 25;

  const [nomenclature, setNomenclatureState] = useState(NOMENCLATURES.TXDOT);
  const [inspectionType, setInspectionTypeState] = useState(INSPECTION_TYPES.TOPSIDE);
  const [savedDefects, setSavedDefectsState] = useState<DefectRecord[]>([]);
  const [nbiRatings, setNbiRatingsState] = useState<NbiRating[]>(INITIAL_NBI_RATINGS);

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
        const [defects, nbi, nom, insType] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SAVED_DEFECTS),
          AsyncStorage.getItem(STORAGE_KEYS.NBI_RATINGS),
          AsyncStorage.getItem(STORAGE_KEYS.NOMENCLATURE),
          AsyncStorage.getItem(STORAGE_KEYS.INSPECTION_TYPE),
        ]);
        if (defects) setSavedDefectsState(JSON.parse(defects));
        if (nbi) setNbiRatingsState(JSON.parse(nbi));
        if (nom) setNomenclatureState(nom);
        if (insType) setInspectionTypeState(insType);
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

  // ── Derived ──
  const locationSequence = useMemo(
    () => buildLocationSequence(inspectionType, nomenclature, supportCount),
    [inspectionType, nomenclature]
  );

  const filteredElements = useMemo(
    () => getFilteredElements(currentLocation),
    [currentLocation]
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

  const simulateLegacyImport = useCallback(() => {
    setParsingActive(true);
    setTimeout(() => {
      const ts = Date.now().toString();
      const legacy: DefectRecord = {
        id: `leg-${ts}`,
        location: "Span 1",
        elementId: "107",
        element: "Steel Girder",
        environment: "2",
        defect: "Corrosion/Section Loss",
        defectId: "corr",
        cs: "CS2",
        quantityValue: "10",
        maintenanceQuantityValue: "10",
        quantity: "10 in",
        size: "N/A",
        locationDesc: "Surface rust.",
        needsVerification: true,
        isLegacy: true,
        photos: [],
        photosCount: 0,
        isCritical: false,
        isMaintenance: false,
      };
      setSavedDefects([legacy, ...savedDefects]);
      setParsingActive(false);
    }, 1200);
  }, [savedDefects, setSavedDefects]);

  const value: InspectionContextType = {
    nomenclature,
    setNomenclature,
    inspectionType,
    setInspectionType,
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
    simulateLegacyImport,
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
