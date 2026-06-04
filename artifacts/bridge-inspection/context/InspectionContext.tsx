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
    sub: "RC Column · Pier Wall · Cap",
    elementIds: ["205", "204", "210", "234", "220"],
  },
  {
    id: "CONCRETE_ABUTMENT",
    label: "Concrete Abutment",
    sub: "RC Abutment · Backwall · Wingwall",
    elementIds: ["215", "220"],
  },
  {
    id: "CONCRETE_PILE",
    label: "Concrete Pile/Cap",
    sub: "PSC Pile · RC Pile · Pile Cap · Cap",
    elementIds: ["226", "227", "220", "234"],
  },
  {
    id: "STEEL_PILE",
    label: "Steel Pile",
    sub: "H-Pile · Steel Pipe Pile",
    elementIds: ["225", "900"],
  },
  {
    id: "TIMBER_PILE",
    label: "Timber Pile/Bent",
    sub: "Timber Pile · Timber Cap",
    elementIds: ["228", "235", "206"],
  },
  {
    id: "OTHER",
    label: "Other / Not Set",
    sub: "Show all substructure elements",
    elementIds: ["205", "215", "225", "226", "227", "228", "234", "900"],
  },
];

export const ENVIRONMENTS = [
  { id: "1", name: "1 - Benign" },
  { id: "2", name: "2 - Low" },
  { id: "3", name: "3 - Moderate" },
  { id: "4", name: "4 - Severe" },
];

// Element catalog based on the AASHTO Manual for Bridge Element Inspection (MBEI),
// Second Edition (2019). Includes National Bridge Elements (NBE), Bridge
// Management Elements (BME), and one agency-defined element. `core: true`
// elements show in the dropdown by default; the rest are reachable via the
// in-dropdown search. Element 226 is the standard AASHTO Prestressed Concrete
// Pile; the custom TxDOT-style "Steel Pipe Pile" (remaining-section form) is the
// agency-defined element 900.
export const SNBI_ELEMENTS = [
  // --- Decks / Slabs ---
  { id: "12", name: "RC Deck", category: "Deck", material: "Concrete", unit: "sq ft", core: true },
  { id: "13", name: "PSC Deck", category: "Deck", material: "Concrete", unit: "sq ft", core: false },
  { id: "15", name: "PSC Top Flange", category: "Deck", material: "Concrete", unit: "sq ft", core: false },
  { id: "16", name: "RC Top Flange", category: "Deck", material: "Concrete", unit: "sq ft", core: false },
  { id: "28", name: "Steel Deck — Open Grid", category: "Deck", material: "Steel", unit: "sq ft", core: false },
  { id: "29", name: "Steel Deck — Concrete Filled Grid", category: "Deck", material: "Steel", unit: "sq ft", core: false },
  { id: "30", name: "Steel Deck — Corrugated/Orthotropic", category: "Deck", material: "Steel", unit: "sq ft", core: false },
  { id: "31", name: "Timber Deck", category: "Deck", material: "Timber", unit: "sq ft", core: true },
  { id: "38", name: "RC Slab", category: "Deck", material: "Concrete", unit: "sq ft", core: true },
  { id: "54", name: "Timber Slab", category: "Deck", material: "Timber", unit: "sq ft", core: false },
  { id: "60", name: "Other Deck", category: "Deck", material: "Other", unit: "sq ft", core: false },
  { id: "65", name: "Other Slab", category: "Deck", material: "Other", unit: "sq ft", core: false },
  // --- Approach Slabs ---
  { id: "320", name: "PSC Approach Slab", category: "Deck", material: "Concrete", unit: "sq ft", core: false },
  { id: "321", name: "RC Approach Slab", category: "Deck", material: "Concrete", unit: "sq ft", core: true },
  // --- Superstructure ---
  { id: "102", name: "Steel Box/Closed Web Girder", category: "Superstructure", material: "Steel", unit: "ft", core: false },
  { id: "104", name: "PSC Box/Closed Web Girder", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "105", name: "RC Box/Closed Web Girder", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "106", name: "Other Box/Closed Web Girder", category: "Superstructure", material: "Other", unit: "ft", core: false },
  { id: "107", name: "Steel Girder/Beam", category: "Superstructure", material: "Steel", unit: "ft", core: true },
  { id: "109", name: "PSC Open Girder/Beam", category: "Superstructure", material: "Concrete", unit: "ft", core: true },
  { id: "110", name: "RC Open Girder/Beam", category: "Superstructure", material: "Concrete", unit: "ft", core: true },
  { id: "111", name: "Timber Girder/Beam", category: "Superstructure", material: "Timber", unit: "ft", core: true },
  { id: "113", name: "Steel Stringer", category: "Superstructure", material: "Steel", unit: "ft", core: false },
  { id: "115", name: "PSC Stringer", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "116", name: "RC Stringer", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "117", name: "Timber Stringer", category: "Superstructure", material: "Timber", unit: "ft", core: false },
  { id: "118", name: "Other Stringer", category: "Superstructure", material: "Other", unit: "ft", core: false },
  { id: "120", name: "Steel Truss", category: "Superstructure", material: "Steel", unit: "ft", core: true },
  { id: "135", name: "Timber Truss", category: "Superstructure", material: "Timber", unit: "ft", core: false },
  { id: "141", name: "Steel Arch", category: "Superstructure", material: "Steel", unit: "ft", core: false },
  { id: "142", name: "Other Arch", category: "Superstructure", material: "Other", unit: "ft", core: false },
  { id: "143", name: "PSC Arch", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "144", name: "RC Arch", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "145", name: "Masonry Arch", category: "Superstructure", material: "Masonry", unit: "ft", core: false },
  { id: "146", name: "Timber Arch", category: "Superstructure", material: "Timber", unit: "ft", core: false },
  { id: "147", name: "Steel Main Cables", category: "Superstructure", material: "Steel", unit: "ft", core: false },
  { id: "148", name: "Secondary Steel Cables", category: "Superstructure", material: "Steel", unit: "ft", core: false },
  { id: "152", name: "Steel Floor Beam", category: "Superstructure", material: "Steel", unit: "ft", core: false },
  { id: "154", name: "PSC Floor Beam", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "155", name: "RC Floor Beam", category: "Superstructure", material: "Concrete", unit: "ft", core: false },
  { id: "156", name: "Timber Floor Beam", category: "Superstructure", material: "Timber", unit: "ft", core: false },
  { id: "157", name: "Other Floor Beam", category: "Superstructure", material: "Other", unit: "ft", core: false },
  { id: "161", name: "Steel Pin & Hanger Assembly", category: "Superstructure", material: "Steel", unit: "ea", core: false },
  { id: "162", name: "Steel Gusset Plate", category: "Superstructure", material: "Steel", unit: "ea", core: false },
  // --- Substructure ---
  { id: "202", name: "Steel Column", category: "Substructure", material: "Steel", unit: "ea", core: true },
  { id: "203", name: "Other Column", category: "Substructure", material: "Other", unit: "ea", core: false },
  { id: "204", name: "PSC Column", category: "Substructure", material: "Concrete", unit: "ea", core: false },
  { id: "205", name: "RC Column", category: "Substructure", material: "Concrete", unit: "ea", core: true },
  { id: "206", name: "Timber Column", category: "Substructure", material: "Timber", unit: "ea", core: false },
  { id: "207", name: "Steel Tower", category: "Substructure", material: "Steel", unit: "ft", core: false },
  { id: "208", name: "Timber Trestle", category: "Substructure", material: "Timber", unit: "ft", core: false },
  { id: "210", name: "RC Pier Wall", category: "Substructure", material: "Concrete", unit: "ft", core: true },
  { id: "211", name: "Other Pier Wall", category: "Substructure", material: "Other", unit: "ft", core: false },
  { id: "212", name: "Timber Pier Wall", category: "Substructure", material: "Timber", unit: "ft", core: false },
  { id: "213", name: "Masonry Pier Wall", category: "Substructure", material: "Masonry", unit: "ft", core: false },
  { id: "215", name: "RC Abutment", category: "Substructure", material: "Concrete", unit: "ft", core: true },
  { id: "216", name: "Timber Abutment", category: "Substructure", material: "Timber", unit: "ft", core: false },
  { id: "217", name: "Masonry Abutment", category: "Substructure", material: "Masonry", unit: "ft", core: false },
  { id: "218", name: "Other Abutment", category: "Substructure", material: "Other", unit: "ft", core: false },
  { id: "219", name: "Steel Abutment", category: "Substructure", material: "Steel", unit: "ft", core: false },
  { id: "220", name: "RC Pile Cap/Footing", category: "Substructure", material: "Concrete", unit: "ft", core: true },
  { id: "225", name: "Steel Pile", category: "Substructure", material: "Steel", unit: "ea", core: true },
  { id: "226", name: "Prestressed Concrete Pile", category: "Substructure", material: "Concrete", unit: "ea", core: true },
  { id: "227", name: "Reinforced Concrete Pile", category: "Substructure", material: "Concrete", unit: "ea", core: true },
  { id: "228", name: "Timber Pile", category: "Substructure", material: "Timber", unit: "ea", core: true },
  { id: "229", name: "Other Pile", category: "Substructure", material: "Other", unit: "ea", core: false },
  { id: "231", name: "Steel Pier Cap", category: "Substructure", material: "Steel", unit: "ft", core: false },
  { id: "233", name: "PSC Pier Cap", category: "Substructure", material: "Concrete", unit: "ft", core: false },
  { id: "234", name: "RC Pier Cap", category: "Substructure", material: "Concrete", unit: "ft", core: true },
  { id: "235", name: "Timber Pier Cap", category: "Substructure", material: "Timber", unit: "ft", core: false },
  { id: "236", name: "Other Pier Cap", category: "Substructure", material: "Other", unit: "ft", core: false },
  // --- Culverts ---
  { id: "240", name: "Steel Culvert", category: "Culvert", material: "Steel", unit: "ft", core: false },
  { id: "241", name: "RC Culvert", category: "Culvert", material: "Concrete", unit: "ft", core: false },
  { id: "242", name: "Timber Culvert", category: "Culvert", material: "Timber", unit: "ft", core: false },
  { id: "243", name: "Other Culvert", category: "Culvert", material: "Other", unit: "ft", core: false },
  { id: "244", name: "Masonry Culvert", category: "Culvert", material: "Masonry", unit: "ft", core: false },
  { id: "245", name: "PSC Culvert", category: "Culvert", material: "Concrete", unit: "ft", core: false },
  // --- Bearings ---
  { id: "310", name: "Elastomeric Bearing", category: "Bearing", material: "Other", unit: "ea", core: true },
  { id: "311", name: "Movable Bearing", category: "Bearing", material: "Steel", unit: "ea", core: true },
  { id: "312", name: "Enclosed/Concealed Bearing", category: "Bearing", material: "Other", unit: "ea", core: false },
  { id: "313", name: "Fixed Bearing", category: "Bearing", material: "Steel", unit: "ea", core: true },
  { id: "314", name: "Pot Bearing", category: "Bearing", material: "Other", unit: "ea", core: false },
  { id: "315", name: "Disk Bearing", category: "Bearing", material: "Other", unit: "ea", core: false },
  { id: "316", name: "Other Bearing", category: "Bearing", material: "Other", unit: "ea", core: false },
  // --- Joints ---
  { id: "300", name: "Strip Seal Joint", category: "Joint", material: "Other", unit: "ft", core: true },
  { id: "301", name: "Pourable Joint Seal", category: "Joint", material: "Other", unit: "ft", core: false },
  { id: "302", name: "Compression Joint Seal", category: "Joint", material: "Other", unit: "ft", core: false },
  { id: "303", name: "Assembly Joint with Seal (Modular)", category: "Joint", material: "Other", unit: "ft", core: false },
  { id: "304", name: "Open Joint", category: "Joint", material: "Other", unit: "ft", core: true },
  { id: "305", name: "Assembly Joint without Seal", category: "Joint", material: "Other", unit: "ft", core: false },
  { id: "306", name: "Other Joint", category: "Joint", material: "Other", unit: "ft", core: false },
  // --- Railings ---
  { id: "330", name: "Metal Bridge Railing", category: "Railing", material: "Steel", unit: "ft", core: true },
  { id: "331", name: "RC Bridge Railing", category: "Railing", material: "Concrete", unit: "ft", core: true },
  { id: "332", name: "Timber Bridge Railing", category: "Railing", material: "Timber", unit: "ft", core: false },
  { id: "333", name: "Other Bridge Railing", category: "Railing", material: "Other", unit: "ft", core: false },
  { id: "334", name: "Masonry Bridge Railing", category: "Railing", material: "Masonry", unit: "ft", core: false },
  // --- Wearing Surfaces / Protective Systems ---
  { id: "510", name: "Wearing Surface", category: "Other", material: "Other", unit: "sq ft", core: false },
  { id: "515", name: "Steel Protective Coating", category: "Other", material: "Steel", unit: "sq ft", core: true },
  { id: "520", name: "Concrete Reinforcing Steel Protective System", category: "Other", material: "Concrete", unit: "sq ft", core: false },
  // --- Agency-Defined (custom) ---
  { id: "900", name: "Steel Pipe Pile", category: "Substructure", material: "Steel", unit: "ea", core: true },
] as const;

// Material-appropriate default defect lists. Any element without a specific
// override below inherits the list for its material. Defect ids are kept stable so
// the SNBI import mapping (SNBI_CODE_TO_DEFECT_ID) continues to resolve correctly.
const DEFECTS_BY_MATERIAL: Record<string, { id: string; name: string; unit: string }[]> = {
  Steel: [
    { id: "corr", name: "Corrosion/Section Loss", unit: "sq ft" },
    { id: "crack_s", name: "Cracking/Fatigue", unit: "in" },
    { id: "conn", name: "Connection Deterioration", unit: "ea" },
    { id: "distort", name: "Distortion/Out-of-Plane", unit: "ea" },
    { id: "damage", name: "Damage", unit: "ea" },
  ],
  Concrete: [
    { id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" },
    { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" },
    { id: "crack", name: "Cracking", unit: "ft" },
    { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" },
    { id: "damage", name: "Damage", unit: "ea" },
  ],
  Timber: [
    { id: "decay", name: "Decay/Section Loss", unit: "in" },
    { id: "check", name: "Checks/Shakes", unit: "ft" },
    { id: "crack", name: "Splits/Cracks", unit: "ft" },
    { id: "crush", name: "Crushing/Compression", unit: "ea" },
    { id: "conn", name: "Connection Deterioration", unit: "ea" },
    { id: "damage", name: "Damage", unit: "ea" },
  ],
  Masonry: [
    { id: "mortar", name: "Mortar Deterioration", unit: "ft" },
    { id: "crack", name: "Cracking", unit: "ft" },
    { id: "spall", name: "Spalling/Splitting", unit: "sq ft" },
    { id: "displace", name: "Masonry Displacement", unit: "ea" },
    { id: "damage", name: "Damage", unit: "ea" },
  ],
  Other: [
    { id: "damage", name: "Damage", unit: "ea" },
    { id: "deterioration", name: "Deterioration", unit: "ea" },
    { id: "wear", name: "Abrasion/Wear", unit: "sq ft" },
  ],
};

// Element-specific defect lists that differ from the material default (decks,
// bearings, joints, railings, protective systems, and the custom 900 pile form).
const DEFECT_OVERRIDES: Record<string, { id: string; name: string; unit: string }[]> = {
  // Decks / slabs (concrete suite + abrasion/wear from traffic)
  "12": [{ id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "damage", name: "Damage", unit: "ea" }],
  "38": [{ id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "damage", name: "Damage", unit: "ea" }],
  "28": [{ id: "corr", name: "Corrosion/Section Loss", unit: "sq ft" }, { id: "crack_s", name: "Cracking/Fatigue", unit: "in" }, { id: "conn", name: "Connection Deterioration", unit: "ea" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "damage", name: "Damage", unit: "ea" }],
  "29": [{ id: "corr", name: "Corrosion/Section Loss", unit: "sq ft" }, { id: "crack_s", name: "Cracking/Fatigue", unit: "in" }, { id: "conn", name: "Connection Deterioration", unit: "ea" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "damage", name: "Damage", unit: "ea" }],
  "31": [{ id: "decay", name: "Decay/Section Loss", unit: "in" }, { id: "check", name: "Checks/Shakes", unit: "ft" }, { id: "crack", name: "Splits/Cracks", unit: "ft" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "damage", name: "Damage", unit: "ea" }],
  "54": [{ id: "decay", name: "Decay/Section Loss", unit: "in" }, { id: "check", name: "Checks/Shakes", unit: "ft" }, { id: "crack", name: "Splits/Cracks", unit: "ft" }, { id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "damage", name: "Damage", unit: "ea" }],
  "321": [{ id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }, { id: "settle", name: "Settlement/Faulting", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  // Custom Steel Pipe Pile remaining-section form (agency element 900)
  "900": [{ id: "corr_pile", name: "Section Loss (Remaining Section)", unit: "in" }, { id: "pitting", name: "Pitting Corrosion", unit: "in" }, { id: "corr", name: "Corrosion", unit: "sq ft" }],
  // Bearings
  "310": [{ id: "rotation", name: "Excessive Rotation", unit: "ea" }, { id: "bulging", name: "Excessive Bulging", unit: "ea" }, { id: "shear", name: "Shear/Movement", unit: "ea" }],
  "311": [{ id: "corr", name: "Corrosion", unit: "sq ft" }, { id: "rotation", name: "Excessive Rotation", unit: "ea" }, { id: "debris", name: "Debris/Loss of Travel", unit: "ea" }],
  "312": [{ id: "corr", name: "Corrosion", unit: "sq ft" }, { id: "debris", name: "Debris Accumulation", unit: "ea" }],
  "313": [{ id: "corr", name: "Corrosion", unit: "sq ft" }, { id: "rotation", name: "Excessive Rotation", unit: "ea" }],
  "314": [{ id: "rotation", name: "Excessive Rotation", unit: "ea" }, { id: "leak", name: "Seal/Fluid Leakage", unit: "ea" }],
  "315": [{ id: "rotation", name: "Excessive Rotation", unit: "ea" }, { id: "wear", name: "Wear/Disk Deterioration", unit: "ea" }],
  // Joints
  "300": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }],
  "301": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }],
  "302": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }],
  "303": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }, { id: "armour", name: "Armour Damage", unit: "ft" }],
  "304": [{ id: "debris", name: "Debris Accumulation", unit: "sq ft" }, { id: "armour", name: "Armour Damage", unit: "ft" }],
  "306": [{ id: "seal", name: "Seal Damage", unit: "ft" }, { id: "debris", name: "Debris Accumulation", unit: "sq ft" }],
  // Railings (material suite + vehicular impact damage)
  "330": [{ id: "corr", name: "Corrosion/Section Loss", unit: "sq ft" }, { id: "crack_s", name: "Cracking/Fatigue", unit: "in" }, { id: "conn", name: "Connection Deterioration", unit: "ea" }, { id: "impact", name: "Impact Damage", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "331": [{ id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }, { id: "impact", name: "Impact Damage", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "332": [{ id: "decay", name: "Decay/Section Loss", unit: "in" }, { id: "check", name: "Checks/Shakes", unit: "ft" }, { id: "crack", name: "Splits/Cracks", unit: "ft" }, { id: "impact", name: "Impact Damage", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "333": [{ id: "deterioration", name: "Deterioration", unit: "ea" }, { id: "impact", name: "Impact Damage", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "334": [{ id: "mortar", name: "Mortar Deterioration", unit: "ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "spall", name: "Spalling/Splitting", unit: "sq ft" }, { id: "impact", name: "Impact Damage", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  // Substructure (material suite + settlement / movement)
  "215": [{ id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }, { id: "settle", name: "Settlement/Movement", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "216": [{ id: "decay", name: "Decay/Section Loss", unit: "in" }, { id: "check", name: "Checks/Shakes", unit: "ft" }, { id: "crack", name: "Splits/Cracks", unit: "ft" }, { id: "settle", name: "Settlement/Movement", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "217": [{ id: "mortar", name: "Mortar Deterioration", unit: "ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "spall", name: "Spalling/Splitting", unit: "sq ft" }, { id: "displace", name: "Masonry Displacement", unit: "ea" }, { id: "settle", name: "Settlement/Movement", unit: "ea" }],
  "218": [{ id: "deterioration", name: "Deterioration", unit: "ea" }, { id: "settle", name: "Settlement/Movement", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  "220": [{ id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "rebar", name: "Exposed/Corroded Reinforcing", unit: "sq ft" }, { id: "crack", name: "Cracking", unit: "ft" }, { id: "corr_s", name: "Efflorescence/Rust Staining", unit: "sq ft" }, { id: "settle", name: "Settlement/Movement", unit: "ea" }, { id: "damage", name: "Damage", unit: "ea" }],
  // Protective systems / wearing surface
  "510": [{ id: "wear", name: "Abrasion/Wear", unit: "sq ft" }, { id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "deterioration", name: "Effectiveness/Deterioration", unit: "sq ft" }],
  "515": [{ id: "coat_fail", name: "Peeling/Bubbling/Cracking", unit: "sq ft" }, { id: "deterioration", name: "Chalking/Oxide Film/Effectiveness", unit: "sq ft" }, { id: "corr", name: "Underlying Steel Corrosion", unit: "sq ft" }],
  "520": [{ id: "coat_fail", name: "Sealer/System Failure", unit: "sq ft" }, { id: "spall", name: "Delamination/Spall/Patched Area", unit: "sq ft" }, { id: "deterioration", name: "Effectiveness/Deterioration", unit: "sq ft" }],
};

export const DEFECTS_BY_ELEMENT: Record<string, { id: string; name: string; unit: string }[]> =
  Object.fromEntries(
    SNBI_ELEMENTS.map((e) => [
      e.id,
      DEFECT_OVERRIDES[e.id] ?? DEFECTS_BY_MATERIAL[e.material] ?? DEFECTS_BY_MATERIAL.Other,
    ])
  );

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
  previousRating?: string;
  previousDesc?: string;
  previousMin?: string;
  isImported?: boolean;
}

export interface NbiRating {
  item: string;
  description: string;
  subComponents: SubComponent[];
}

export interface ImportSectionAudit {
  item: string;
  description: string;
  filled: number;
  total: number;
  hasData: boolean;
}

export interface ImportSummary {
  timestamp: number;
  structureNumber: string;
  structureNumberFound: boolean;
  elementsFound: number;
  elementRecordsCreated: number;
  nbiFilledCount: number;
  nbiTotalCount: number;
  sections: ImportSectionAudit[];
  emptySections: ImportSectionAudit[];
  unmatchedComponents: string[];
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

// ─── Underclearance (TxDOT Form 2601) ────────────────────────────────────────

export interface UcMeasure {
  data: string;
  refer: string;
}

export interface SketchStroke {
  d: string; // SVG path data
  color: string;
  width: number;
}

export interface UnderclearanceEntry {
  id: string;
  psn: string;
  rightLateral: UcMeasure; // Item 55.2
  leftLateral: UcMeasure; // Item 56
  totalHorizontal: UcMeasure; // Item 47 / 47A
  maxPracticalVert: UcMeasure; // Item 10 / 10A
  minMeasuredVert: UcMeasure; // Item 54.2
  signedVertData: string;
  signedVertTolerance: string;
}

export interface UnderclearanceData {
  district: string;
  county: string;
  controlSection: string;
  structureNumber: string;
  route: string;
  featureCrossed: string;
  company: string;
  inspectionDate: string;
  entries: UnderclearanceEntry[];
  sketch: SketchStroke[];
}

export const UC_MEASURE_ROWS: {
  key: keyof Pick<
    UnderclearanceEntry,
    | "rightLateral"
    | "leftLateral"
    | "totalHorizontal"
    | "maxPracticalVert"
    | "minMeasuredVert"
  >;
  label: string;
  itemNo: string;
}[] = [
  { key: "rightLateral", label: "Right Lateral Clearance", itemNo: "55.2" },
  { key: "leftLateral", label: "Left Lateral Clearance", itemNo: "56" },
  { key: "totalHorizontal", label: "Total Horizontal Clr", itemNo: "47" },
  { key: "maxPracticalVert", label: "Max Practical Vert Clr", itemNo: "10" },
  { key: "minMeasuredVert", label: "Min Measured Vert Clr", itemNo: "54.2" },
];

export const UC_REFERENCE_FEATURES = [
  { code: "A", label: "Beam" },
  { code: "B", label: "Slab" },
  { code: "C", label: "Cap" },
  { code: "D", label: "Railing" },
  { code: "E", label: "Guard fence" },
  { code: "F", label: "Column" },
  { code: "G", label: "Pile" },
  { code: "H", label: "Curb" },
  { code: "I", label: "Toe of >3:1 Slope" },
  { code: "J", label: "Barrier" },
  { code: "K", label: "Middle of Yellow Stripe" },
  { code: "L", label: "Middle of White Stripe" },
  { code: "M", label: "Retaining Wall" },
  { code: "N", label: "Pavement" },
];

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

export type UcMeasureKey =
  | "rightLateral"
  | "leftLateral"
  | "totalHorizontal"
  | "maxPracticalVert"
  | "minMeasuredVert";

export function createUnderclearanceEntry(
  // Reference features persist until changed: seed each row's refer code from the previous entry.
  seedRefer?: Partial<Record<UcMeasureKey, string>>
): UnderclearanceEntry {
  return {
    id: `uc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    psn: "",
    rightLateral: { data: "", refer: seedRefer?.rightLateral ?? "" },
    leftLateral: { data: "", refer: seedRefer?.leftLateral ?? "" },
    totalHorizontal: { data: "", refer: seedRefer?.totalHorizontal ?? "" },
    maxPracticalVert: { data: "", refer: seedRefer?.maxPracticalVert ?? "" },
    minMeasuredVert: { data: "", refer: seedRefer?.minMeasuredVert ?? "" },
    signedVertData: "",
    signedVertTolerance: "",
  };
}

const INITIAL_UNDERCLEARANCE: UnderclearanceData = {
  district: "",
  county: "",
  controlSection: "",
  structureNumber: "",
  route: "",
  featureCrossed: "",
  company: "",
  inspectionDate: new Date().toLocaleDateString("en-US"),
  entries: [createUnderclearanceEntry()],
  sketch: [],
};

// ─── Channel Cross-Section (TxDOT Form 2600) ─────────────────────────────────

export interface ChannelMeasurement {
  id: string;
  topRef: string; // Top reference feature
  botRef: string; // Bottom reference feature
  totalHoriz: string; // Total Horizontal Distance
  distFromLastBent: string; // Distance From Last Bent
  vertDist: string; // Vertical Distance
  notes: string;
}

export type ChannelSection = "upstream" | "downstream";

export interface ChannelData {
  district: string;
  county: string;
  controlSection: string;
  structureNumber: string;
  route: string;
  featureCrossed: string;
  company: string;
  inspectionDate: string;
  comments: string;
  upstream: ChannelMeasurement[];
  downstream: ChannelMeasurement[];
  // Optional bent stations per section (comma/space separated station values).
  // When present, "Distance From Last Bent" is auto-calculated from Total Horizontal Distance.
  bentStations: { upstream: string; downstream: string };
}

export const CHANNEL_REFERENCE_FEATURES: { code: string; label: string }[] = [
  { code: "TR", label: "Top of Railing" },
  { code: "ED", label: "Edge of Deck" },
  { code: "TC", label: "Top of Curb" },
  { code: "TP", label: "Top of Parapet" },
  { code: "SW", label: "Sidewalk" },
  { code: "CP", label: "Top of Cap" },
  { code: "WS", label: "Water Surface" },
  { code: "CH", label: "Channel" },
  { code: "RG", label: "Rigid Rip-Rap" },
  { code: "RB", label: "Rubble Rip-Rap" },
];

export function createChannelMeasurement(
  seed?: { topRef?: string; botRef?: string }
): ChannelMeasurement {
  return {
    id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    // References default to Top of Railing / Water Surface and persist until changed.
    topRef: seed?.topRef ?? "TR",
    botRef: seed?.botRef ?? "WS",
    totalHoriz: "",
    distFromLastBent: "",
    vertDist: "",
    notes: "",
  };
}

const INITIAL_CHANNEL: ChannelData = {
  district: "",
  county: "",
  controlSection: "",
  structureNumber: "",
  route: "",
  featureCrossed: "",
  company: "",
  inspectionDate: new Date().toLocaleDateString("en-US"),
  comments: "",
  upstream: [createChannelMeasurement()],
  downstream: [createChannelMeasurement()],
  bentStations: { upstream: "", downstream: "" },
};

// ─── Daily Safety Briefing / Risk Assessment (Strinteg) ───────────────────────

export interface SafetyCrewSignoff {
  id: string;
  name: string; // Printed name / signature
  date: string;
  initials: string;
}

export interface SafetyBriefingData {
  workLocation: string;
  employeeInCharge: string;
  employeeInChargePhone: string;
  briefingDate: string;
  nearestHospitals: string;
  safetyPlanOnSite: "" | "Yes" | "No";
  ppeStandard: boolean; // Hard Hat / Vest+Pants / Glasses / Boots / Gloves / First Aid Kit
  ppeHarness: boolean; // Harness & Lanyard
  ppeOther: boolean;
  ppeOtherText: string;
  selectedRisks: string[]; // identified risks present at this site (by risk title)
  crew: SafetyCrewSignoff[];
}

// Static reference content from the Strinteg Risk Assessment & Safety Briefing form.
export const SAFETY_BRIEFING_RISKS: { risk: string; mitigation: string }[] = [
  {
    risk: "Elevated Height / Fall Hazard",
    mitigation:
      "100% tie-off within 6' of unprotected edge; access opening awareness; trauma straps on harnesses; ladder safety training; proper fall arrest usage",
  },
  {
    risk: "Vehicular Traffic / Impact Hazard",
    mitigation:
      "Situational awareness; identify and stay within safe work zones; never turn back to flow of traffic; inspect traffic control setup prior to entering",
  },
  {
    risk: "Work over Water / Drowning Hazard",
    mitigation:
      "Employ safety boat when necessary; personal flotation devices; wader belts",
  },
  {
    risk: "Aerial Lift & UBIU / Pinch, Crush, & Hydraulic Hazard",
    mitigation:
      "Competent and qualified through appropriate training in aerial lift equipment; awareness of exposure to hydraulic fluid and pinch-points; 100% tie-off",
  },
  {
    risk: "Falling Objects",
    mitigation:
      "Awareness of hazard zone; properly fitted impact-rated hard hats; tie-off loose equipment whenever possible",
  },
  {
    risk: "Hot Environment / Fatigue Risk",
    mitigation:
      "Stay hydrated; take adequate breaks; cool down when necessary; look for signs of heat stroke among coworkers",
  },
  {
    risk: "Extreme Weather Events",
    mitigation:
      "Halt work if weather becomes unsafe for the task being performed; track weather forecast prior to beginning work",
  },
  {
    risk: "Allergic Reactions / Wildlife Hazard",
    mitigation:
      "Awareness of inspector allergies; ensure corrective options are available on-site (i.e. EpiPen); use snake guards",
  },
];

export function createSafetyCrewSignoff(): SafetyCrewSignoff {
  return {
    id: `sb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    date: new Date().toLocaleDateString("en-US"),
    initials: "",
  };
}

const INITIAL_SAFETY_BRIEFING: SafetyBriefingData = {
  workLocation: "",
  employeeInCharge: "",
  employeeInChargePhone: "",
  briefingDate: new Date().toLocaleDateString("en-US"),
  nearestHospitals: "",
  safetyPlanOnSite: "",
  ppeStandard: false,
  ppeHarness: false,
  ppeOther: false,
  ppeOtherText: "",
  selectedRisks: [],
  crew: [createSafetyCrewSignoff()],
};

// ─── SNBI Field Collection ────────────────────────────────────────────────────

export interface SnbiRoadway {
  id: string;
  name: string; // Roadway name
  width: string; // Clear/Approach roadway width
  lanes: string; // No. of lanes
}

export type SnbiEquipment = "" | "Waders" | "Boat" | "Ladder" | "D-Meter" | "Other";

export interface SnbiData {
  sidewalkLeft: string; // ft (one decimal)
  sidewalkRight: string; // ft (one decimal)
  nbisBridgeLength: string; // feet (nearest tenth)
  totalBridgeLength: string; // feet (nearest tenth)
  maxSpanLength: string; // feet (nearest tenth)
  minSpanLength: string; // feet (nearest tenth)
  abutBrgToBackwall: string; // inches (for max/min span length)
  backwallToCapFace: string; // inches (for NBIS bridge length)
  backwallThickness: string; // inches (for total bridge length)
  culvertBridgeHeight: string; // feet (no decimal)
  culvertWallThickness: string; // inches (for NBIS bridge length)
  fatigueDetailsPresent: "" | "Yes" | "No"; // Steel superstructure E/E' details
  scourRating: string; // condition rating
  railingTransitionsRating: string; // condition rating
  equipmentRequired: Exclude<SnbiEquipment, "">[]; // multiple selectable
  equipmentOtherText: string;
  roadways: SnbiRoadway[];
}

export function createSnbiRoadway(): SnbiRoadway {
  return {
    id: `snbi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    width: "",
    lanes: "",
  };
}

const INITIAL_SNBI: SnbiData = {
  sidewalkLeft: "",
  sidewalkRight: "",
  nbisBridgeLength: "",
  totalBridgeLength: "",
  maxSpanLength: "",
  minSpanLength: "",
  abutBrgToBackwall: "",
  backwallToCapFace: "",
  backwallThickness: "",
  culvertBridgeHeight: "",
  culvertWallThickness: "",
  fatigueDetailsPresent: "",
  scourRating: "",
  railingTransitionsRating: "",
  equipmentRequired: [],
  equipmentOtherText: "",
  roadways: [createSnbiRoadway()],
};

// ─── Steel Pipe Pile: Remaining Section Measurements (element 900) ────────────
export interface SteelPipePileRow {
  id: string;
  bent: string; // Bent (per plans / sketch)
  pile: string; // Pile (L to R)
  lengthH: string; // H - ground to bottom of cap (in)
  lengthY: string; // Y - bottom of cap to section loss (in)
  lengthX: string; // X - length of area of corrosion (in)
  outsideDiameter: string; // outside diameter measured (in)
  pittingDepth: string; // depth of pitting (in)
  wallSec1: string; // wall of cross sec 1 (in)
  wallSec2: string; // wall of cross sec 2 (in)
  wallSec3: string; // wall of cross sec 3 (in)
  wallSec4: string; // wall of cross sec 4 (in)
  photos: PhotoItem[]; // photos tied to this defect (pile)
}

export interface SteelPipePileData {
  // Reference field measurements (inches)
  outsideDiameterRef: string; // A - Outside Diameter
  insideDiameterRef: string; // B - Inside Diameter
  wallThicknessRef: string; // C - Wall Thickness
  rows: SteelPipePileRow[];
}

export function createSteelPipePileRow(): SteelPipePileRow {
  return {
    id: `spp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    bent: "",
    pile: "",
    lengthH: "",
    lengthY: "",
    lengthX: "",
    outsideDiameter: "",
    pittingDepth: "",
    wallSec1: "",
    wallSec2: "",
    wallSec3: "",
    wallSec4: "",
    photos: [],
  };
}

const INITIAL_STEEL_PIPE_PILE: SteelPipePileData = {
  outsideDiameterRef: "",
  insideDiameterRef: "",
  wallThicknessRef: "",
  rows: [createSteelPipePileRow()],
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
  superstructureMaterial: string;
  setSuperstructureMaterial: (v: string) => void;
  substructureMaterial: string;
  setSubstructureMaterial: (v: string) => void;
  elementSearch: string;
  setElementSearch: (v: string) => void;
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
  showUnderclearanceModal: boolean;
  setShowUnderclearanceModal: (v: boolean) => void;
  underclearanceData: UnderclearanceData;
  setUnderclearanceData: (v: UnderclearanceData) => void;
  addUnderclearanceEntry: () => void;
  removeUnderclearanceEntry: (id: string) => void;
  showChannelModal: boolean;
  setShowChannelModal: (v: boolean) => void;
  channelData: ChannelData;
  setChannelData: (v: ChannelData) => void;
  addChannelMeasurement: (section: ChannelSection) => void;
  removeChannelMeasurement: (section: ChannelSection, id: string) => void;
  showDailySafetyModal: boolean;
  setShowDailySafetyModal: (v: boolean) => void;
  safetyBriefingData: SafetyBriefingData;
  setSafetyBriefingData: (v: SafetyBriefingData) => void;
  showSnbiModal: boolean;
  setShowSnbiModal: (v: boolean) => void;
  snbiData: SnbiData;
  setSnbiData: (v: SnbiData) => void;
  showSteelPipePileModal: boolean;
  setShowSteelPipePileModal: (v: boolean) => void;
  steelPipePileData: SteelPipePileData;
  setSteelPipePileData: (v: SteelPipePileData) => void;

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
    value: string | boolean
  ) => void;
  reviewImportedSubComponent: (
    itemIndex: number,
    compIndex: number,
    action: "approve" | "disapprove" | "modify"
  ) => void;
  importFromPdf: (source: File | { uri: string; name?: string }) => Promise<void>;
  simulateLegacyImport: () => void;
  parsingActive: boolean;
  importSummary: ImportSummary | null;
  clearImportSummary: () => void;
  clearInspection: () => void;
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

// Material settings double as a filter axis. "" means "Not Set" (no filtering).
export const MATERIAL_OPTIONS = [
  { id: "", label: "Not Set" },
  { id: "Steel", label: "Steel" },
  { id: "Concrete", label: "Concrete" },
  { id: "Timber", label: "Timber" },
  { id: "Masonry", label: "Masonry" },
  { id: "Other", label: "Other" },
] as const;

function isSubstructureLocation(location: string): boolean {
  return (
    location.includes("Abutment") ||
    location.includes("Bent") ||
    location.includes("End Bent")
  );
}

// All elements relevant to a location by category alone (ignores the narrow
// structure-type lists). Used when searching so the user can look up any element.
function locationCategoryElements(location: string): readonly SnbiElement[] {
  if (!location) return [];
  if (location.includes("Joint"))
    return SNBI_ELEMENTS.filter((e) => e.category === "Joint");
  if (location.includes("Approach"))
    return SNBI_ELEMENTS.filter((e) => ["Deck", "Railing"].includes(e.category));
  if (location.includes("Span"))
    return SNBI_ELEMENTS.filter((e) =>
      ["Deck", "Superstructure", "Railing", "Bearing", "Other"].includes(e.category)
    );
  if (isSubstructureLocation(location))
    return SNBI_ELEMENTS.filter((e) => ["Substructure", "Culvert", "Bearing"].includes(e.category));
  return SNBI_ELEMENTS;
}

// Location + structure-type narrowed candidate list (the default, pre-material view).
function locationTypeElements(
  location: string,
  superTypeId: string,
  subTypeId: string
): readonly SnbiElement[] {
  if (!location) return [];

  if (location.includes("Joint") || location.includes("Approach"))
    return locationCategoryElements(location);

  if (location.includes("Span")) {
    const sType = SUPERSTRUCTURE_TYPES.find((t) => t.id === superTypeId);
    if (!sType || superTypeId === "OTHER") return locationCategoryElements(location);
    const allowedIds = new Set<string>([
      ...(sType.deckId ? [sType.deckId] : []),
      ...sType.elementIds,
      "331",
      "310",
    ]);
    return SNBI_ELEMENTS.filter((e) => allowedIds.has(e.id));
  }

  if (isSubstructureLocation(location)) {
    const sType = SUBSTRUCTURE_TYPES.find((t) => t.id === subTypeId);
    if (!sType || subTypeId === "OTHER") return locationCategoryElements(location);
    const allowedIds = new Set<string>([...sType.elementIds, "310"]);
    return SNBI_ELEMENTS.filter((e) => allowedIds.has(e.id));
  }

  return SNBI_ELEMENTS;
}

function getFilteredElements(
  location: string,
  superTypeId: string,
  subTypeId: string,
  superMaterial: string,
  subMaterial: string,
  search: string
): readonly SnbiElement[] {
  if (!location) return [];

  const query = search.trim().toLowerCase();

  // When the inspector is searching, scan the ENTIRE catalog (every element,
  // every material, regardless of location) so any element can be found —
  // including ones not normally listed for the current location/structure type.
  if (query) {
    return SNBI_ELEMENTS.filter((e) =>
      `${e.id} ${e.name} ${e.category} ${e.material}`.toLowerCase().includes(query)
    );
  }

  // Material that applies to this location: substructure → sub material; otherwise super.
  const material = isSubstructureLocation(location) ? subMaterial : superMaterial;
  const materialApplies =
    !!material &&
    (location.includes("Span") || isSubstructureLocation(location));

  // No search: honor the selected structure type for this location.
  let list: readonly SnbiElement[] = locationTypeElements(location, superTypeId, subTypeId);

  if (materialApplies) list = list.filter((e) => e.material === material);

  const coreList = list.filter((e) => e.core);
  // Fall back to the full narrowed list if a filter leaves no core elements.
  if (coreList.length > 0) list = coreList;

  return list;
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
  SUPERSTRUCTURE_MATERIAL: "@bridge_superstructure_material",
  SUBSTRUCTURE_MATERIAL: "@bridge_substructure_material",
  STRUCTURE_NUMBER: "@bridge_structure_number",
  UNDERCLEARANCE: "@bridge_underclearance",
  CHANNEL: "@bridge_channel",
  SAFETY_BRIEFING: "@bridge_safety_briefing",
  SNBI: "@bridge_snbi",
  STEEL_PIPE_PILE: "@bridge_steel_pipe_pile",
  IMPORT_SUMMARY: "@bridge_import_summary",
  DEMO_CLEARED: "@bridge_demo_cleared_v1",
};

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const supportCount = 25;

  const [nomenclature, setNomenclatureState] = useState(NOMENCLATURES.TXDOT);
  const [inspectionType, setInspectionTypeState] = useState(INSPECTION_TYPES.TOPSIDE);
  const [superstructureType, setSuperstructureTypeState] = useState("OTHER");
  const [substructureType, setSubstructureTypeState] = useState("OTHER");
  const [superstructureMaterial, setSuperstructureMaterialState] = useState("");
  const [substructureMaterial, setSubstructureMaterialState] = useState("");
  const [elementSearch, setElementSearch] = useState("");
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
  const [showUnderclearanceModal, setShowUnderclearanceModal] = useState(false);
  const [underclearanceData, setUnderclearanceDataState] =
    useState<UnderclearanceData>(INITIAL_UNDERCLEARANCE);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelData, setChannelDataState] = useState<ChannelData>(INITIAL_CHANNEL);
  const [showDailySafetyModal, setShowDailySafetyModal] = useState(false);
  const [safetyBriefingData, setSafetyBriefingDataState] =
    useState<SafetyBriefingData>(INITIAL_SAFETY_BRIEFING);
  const [showSnbiModal, setShowSnbiModal] = useState(false);
  const [snbiData, setSnbiDataState] = useState<SnbiData>(INITIAL_SNBI);
  const [showSteelPipePileModal, setShowSteelPipePileModal] = useState(false);
  const [steelPipePileData, setSteelPipePileDataState] =
    useState<SteelPipePileData>(INITIAL_STEEL_PIPE_PILE);

  const [sortCriteria, setSortCriteria] = useState("location");
  const [filterType, setFilterType] = useState("All");
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");
  const [syncToCurrentLoc, setSyncToCurrentLoc] = useState(false);
  const [parsingActive, setParsingActive] = useState(false);
  const [importSummary, setImportSummaryState] = useState<ImportSummary | null>(null);

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
            STORAGE_KEYS.IMPORT_SUMMARY,
          ]);
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_CLEARED, "1");
        }
        const [defects, nbi, nom, insType, superType, subType, superMat, subMat, structNum, uc, ch, sb, sn, spp, impSummary] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SAVED_DEFECTS),
          AsyncStorage.getItem(STORAGE_KEYS.NBI_RATINGS),
          AsyncStorage.getItem(STORAGE_KEYS.NOMENCLATURE),
          AsyncStorage.getItem(STORAGE_KEYS.INSPECTION_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.SUPERSTRUCTURE_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.SUBSTRUCTURE_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.SUPERSTRUCTURE_MATERIAL),
          AsyncStorage.getItem(STORAGE_KEYS.SUBSTRUCTURE_MATERIAL),
          AsyncStorage.getItem(STORAGE_KEYS.STRUCTURE_NUMBER),
          AsyncStorage.getItem(STORAGE_KEYS.UNDERCLEARANCE),
          AsyncStorage.getItem(STORAGE_KEYS.CHANNEL),
          AsyncStorage.getItem(STORAGE_KEYS.SAFETY_BRIEFING),
          AsyncStorage.getItem(STORAGE_KEYS.SNBI),
          AsyncStorage.getItem(STORAGE_KEYS.STEEL_PIPE_PILE),
          AsyncStorage.getItem(STORAGE_KEYS.IMPORT_SUMMARY),
        ]);
        if (defects) setSavedDefectsState(JSON.parse(defects));
        if (nbi) setNbiRatingsState(JSON.parse(nbi));
        if (impSummary) {
          try {
            setImportSummaryState(JSON.parse(impSummary) as ImportSummary);
          } catch {}
        }
        if (nom) setNomenclatureState(nom);
        if (insType) setInspectionTypeState(insType);
        if (superType) setSuperstructureTypeState(superType);
        if (subType) setSubstructureTypeState(subType);
        if (superMat !== null) setSuperstructureMaterialState(superMat);
        if (subMat !== null) setSubstructureMaterialState(subMat);
        if (structNum) {
          setStructureNumberState(structNum);
          setCifData((prev) => ({ ...prev, structureNumber: structNum }));
        }
        if (uc) {
          const parsed = JSON.parse(uc) as UnderclearanceData;
          if (parsed && Array.isArray(parsed.entries)) {
            setUnderclearanceDataState({
              ...parsed,
              // Global structure number is the source of truth; override any stale persisted value.
              structureNumber: structNum || parsed.structureNumber,
              entries: parsed.entries.length ? parsed.entries : [createUnderclearanceEntry()],
              sketch: Array.isArray(parsed.sketch) ? parsed.sketch : [],
            });
          }
        } else if (structNum) {
          setUnderclearanceDataState((prev) => ({ ...prev, structureNumber: structNum }));
        }
        if (ch) {
          const parsed = JSON.parse(ch) as Partial<ChannelData>;
          if (parsed && typeof parsed === "object") {
            const upstream = Array.isArray(parsed.upstream) && parsed.upstream.length
              ? parsed.upstream
              : [createChannelMeasurement()];
            const downstream = Array.isArray(parsed.downstream) && parsed.downstream.length
              ? parsed.downstream
              : [createChannelMeasurement()];
            const pb = (parsed.bentStations ?? {}) as Partial<ChannelData["bentStations"]>;
            setChannelDataState({
              ...INITIAL_CHANNEL,
              ...parsed,
              // Global structure number is the source of truth; override any stale persisted value.
              structureNumber: structNum || parsed.structureNumber || "",
              upstream,
              downstream,
              bentStations: {
                upstream: typeof pb.upstream === "string" ? pb.upstream : "",
                downstream: typeof pb.downstream === "string" ? pb.downstream : "",
              },
            });
          }
        } else if (structNum) {
          setChannelDataState((prev) => ({ ...prev, structureNumber: structNum }));
        }
        if (sb) {
          const parsed = JSON.parse(sb) as Partial<SafetyBriefingData>;
          if (parsed && typeof parsed === "object") {
            setSafetyBriefingDataState({
              ...INITIAL_SAFETY_BRIEFING,
              ...parsed,
              selectedRisks: Array.isArray(parsed.selectedRisks)
                ? parsed.selectedRisks
                : [],
              crew:
                Array.isArray(parsed.crew) && parsed.crew.length
                  ? parsed.crew
                  : [createSafetyCrewSignoff()],
            });
          }
        }
        if (sn) {
          const parsed = JSON.parse(sn) as Partial<SnbiData>;
          if (parsed && typeof parsed === "object") {
            const eq = (parsed as { equipmentRequired?: unknown }).equipmentRequired;
            const equipmentRequired = Array.isArray(eq)
              ? (eq as Exclude<SnbiEquipment, "">[])
              : typeof eq === "string" && eq
                ? [eq as Exclude<SnbiEquipment, "">]
                : [];
            setSnbiDataState({
              ...INITIAL_SNBI,
              ...parsed,
              equipmentRequired,
              roadways:
                Array.isArray(parsed.roadways) && parsed.roadways.length
                  ? parsed.roadways
                  : [createSnbiRoadway()],
            });
          }
        }
        if (spp) {
          const parsed = JSON.parse(spp) as Partial<SteelPipePileData>;
          if (parsed && typeof parsed === "object") {
            setSteelPipePileDataState({
              ...INITIAL_STEEL_PIPE_PILE,
              ...parsed,
              rows:
                Array.isArray(parsed.rows) && parsed.rows.length
                  ? parsed.rows.map((row) => ({
                      ...createSteelPipePileRow(),
                      ...row,
                      photos: Array.isArray(row?.photos) ? row.photos : [],
                    }))
                  : [createSteelPipePileRow()],
            });
          }
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

  // ── Persist importSummary ──
  const setImportSummary = useCallback((v: ImportSummary | null) => {
    setImportSummaryState(v);
    if (v) {
      AsyncStorage.setItem(STORAGE_KEYS.IMPORT_SUMMARY, JSON.stringify(v)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEYS.IMPORT_SUMMARY).catch(() => {});
    }
  }, []);

  const clearImportSummary = useCallback(() => {
    setImportSummary(null);
  }, [setImportSummary]);

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

  const setSuperstructureMaterial = useCallback((v: string) => {
    setSuperstructureMaterialState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SUPERSTRUCTURE_MATERIAL, v).catch(() => {});
  }, []);

  const setSubstructureMaterial = useCallback((v: string) => {
    setSubstructureMaterialState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SUBSTRUCTURE_MATERIAL, v).catch(() => {});
  }, []);

  const setStructureNumber = useCallback((v: string) => {
    setStructureNumberState(v);
    AsyncStorage.setItem(STORAGE_KEYS.STRUCTURE_NUMBER, v).catch(() => {});
    setCifData((prev) => ({ ...prev, structureNumber: v }));
    setUnderclearanceDataState((prev) => {
      const next = { ...prev, structureNumber: v };
      AsyncStorage.setItem(STORAGE_KEYS.UNDERCLEARANCE, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setChannelDataState((prev) => {
      const next = { ...prev, structureNumber: v };
      AsyncStorage.setItem(STORAGE_KEYS.CHANNEL, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── Discard the entire imported/working inspection session ──
  const clearInspection = useCallback(() => {
    setSavedDefects([]);
    setNbiRatings(INITIAL_NBI_RATINGS);
    setStructureNumber("");
    setImportSummary(null);
  }, [setSavedDefects, setNbiRatings, setStructureNumber, setImportSummary]);

  // ── Persist underclearance ──
  const setUnderclearanceData = useCallback((v: UnderclearanceData) => {
    setUnderclearanceDataState(v);
    AsyncStorage.setItem(STORAGE_KEYS.UNDERCLEARANCE, JSON.stringify(v)).catch(() => {});
  }, []);

  const addUnderclearanceEntry = useCallback(() => {
    setUnderclearanceDataState((prev) => {
      const last = prev.entries[prev.entries.length - 1];
      const seedRefer = last
        ? {
            rightLateral: last.rightLateral.refer,
            leftLateral: last.leftLateral.refer,
            totalHorizontal: last.totalHorizontal.refer,
            maxPracticalVert: last.maxPracticalVert.refer,
            minMeasuredVert: last.minMeasuredVert.refer,
          }
        : undefined;
      const next = { ...prev, entries: [...prev.entries, createUnderclearanceEntry(seedRefer)] };
      AsyncStorage.setItem(STORAGE_KEYS.UNDERCLEARANCE, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeUnderclearanceEntry = useCallback((id: string) => {
    setUnderclearanceDataState((prev) => {
      const remaining = prev.entries.filter((e) => e.id !== id);
      const next = {
        ...prev,
        entries: remaining.length ? remaining : [createUnderclearanceEntry()],
      };
      AsyncStorage.setItem(STORAGE_KEYS.UNDERCLEARANCE, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── Persist channel ──
  const setChannelData = useCallback((v: ChannelData) => {
    setChannelDataState(v);
    AsyncStorage.setItem(STORAGE_KEYS.CHANNEL, JSON.stringify(v)).catch(() => {});
  }, []);

  const setSafetyBriefingData = useCallback((v: SafetyBriefingData) => {
    setSafetyBriefingDataState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SAFETY_BRIEFING, JSON.stringify(v)).catch(() => {});
  }, []);

  const setSteelPipePileData = useCallback((v: SteelPipePileData) => {
    setSteelPipePileDataState(v);
    AsyncStorage.setItem(STORAGE_KEYS.STEEL_PIPE_PILE, JSON.stringify(v)).catch(() => {});
  }, []);

  const setSnbiData = useCallback((v: SnbiData) => {
    setSnbiDataState(v);
    AsyncStorage.setItem(STORAGE_KEYS.SNBI, JSON.stringify(v)).catch(() => {});
  }, []);

  const addChannelMeasurement = useCallback((section: ChannelSection) => {
    setChannelDataState((prev) => {
      const rows = prev[section];
      // References persist until changed: inherit them from the last row.
      const last = rows[rows.length - 1];
      const seeded = createChannelMeasurement(
        last ? { topRef: last.topRef, botRef: last.botRef } : undefined
      );
      const next = {
        ...prev,
        [section]: [...rows, seeded],
      };
      AsyncStorage.setItem(STORAGE_KEYS.CHANNEL, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeChannelMeasurement = useCallback((section: ChannelSection, id: string) => {
    setChannelDataState((prev) => {
      const remaining = prev[section].filter((m) => m.id !== id);
      const next = {
        ...prev,
        [section]: remaining.length ? remaining : [createChannelMeasurement()],
      };
      AsyncStorage.setItem(STORAGE_KEYS.CHANNEL, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── Derived ──
  const locationSequence = useMemo(
    () => buildLocationSequence(inspectionType, nomenclature, supportCount),
    [inspectionType, nomenclature]
  );

  const filteredElements = useMemo(
    () =>
      getFilteredElements(
        currentLocation,
        superstructureType,
        substructureType,
        superstructureMaterial,
        substructureMaterial,
        elementSearch
      ),
    [
      currentLocation,
      superstructureType,
      substructureType,
      superstructureMaterial,
      substructureMaterial,
      elementSearch,
    ]
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
      row[d.cs] += qty;
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
    (itemIndex: number, compIndex: number, field: string, value: string | boolean) => {
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

  const reviewImportedSubComponent = useCallback(
    (itemIndex: number, compIndex: number, action: "approve" | "disapprove" | "modify") => {
      const next = [...nbiRatings];
      const nextItem = { ...next[itemIndex] };
      const nextSub = [...nextItem.subComponents];
      const cur = nextSub[compIndex];

      if (action === "approve" || action === "modify") {
        nextSub[compIndex] = {
          ...cur,
          rating: cur.previousRating || cur.rating,
          desc: cur.previousDesc || cur.desc,
          min: cur.previousMin || cur.min,
          comments: cur.previousComments || cur.comments,
          isImported: false,
          ...(action === "approve"
            ? {
                previousRating: undefined,
                previousDesc: undefined,
                previousMin: undefined,
                previousComments: "",
              }
            : {}),
        };
      } else {
        nextSub[compIndex] = {
          ...cur,
          previousRating: undefined,
          previousDesc: undefined,
          previousMin: undefined,
          previousComments: "",
          isImported: false,
        };
      }

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

        // ── Build per-section import audit (mirrors the actual fill below) ──
        const usedIndicesForAudit = new Set<number>();
        let nbiFilledCount = 0;
        let nbiTotalCount = 0;
        const sectionAudits: ImportSectionAudit[] = [];
        for (const item of nbiRatings) {
          let filled = 0;
          for (const sub of item.subComponents) {
            nbiTotalCount++;
            const result = findFuzzyNbiEntry(nbi, item.item, sub.name, usedIndicesForAudit);
            if (result) {
              usedIndicesForAudit.add(result.index);
              const match = result.entry;
              const hasAny = !!(match.rating || match.comment || match.desc || match.min);
              if (hasAny) {
                filled++;
                nbiFilledCount++;
              }
            }
          }
          sectionAudits.push({
            item: item.item,
            description: item.description,
            filled,
            total: item.subComponents.length,
            hasData: filled > 0,
          });
        }
        const emptySections = sectionAudits.filter((s) => !s.hasData);
        const unmatchedNbi = nbi.filter((_, i) => !usedIndicesForAudit.has(i));
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
                const hasAny = !!(match.rating || match.comment || match.desc || match.min);
                if (!hasAny) return sub;
                const isBlank = (v?: string) => !v || v.trim() === "";
                return {
                  ...sub,
                  previousRating: match.rating || sub.previousRating,
                  previousDesc: match.desc || sub.previousDesc,
                  previousMin: match.min || sub.previousMin,
                  previousComments: match.comment || sub.previousComments,
                  rating: isBlank(sub.rating) && match.rating ? match.rating : sub.rating,
                  desc: isBlank(sub.desc) && match.desc ? match.desc : sub.desc,
                  min: isBlank(sub.min) && match.min ? match.min : sub.min,
                  comments: isBlank(sub.comments) && match.comment ? match.comment : sub.comments,
                  isImported: true,
                };
              }),
            }));
            AsyncStorage.setItem(STORAGE_KEYS.NBI_RATINGS, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }

        const unmatchedNames = unmatchedNbi.map((r) => `Item ${r.item}: ${r.componentName}`);
        const elementsFound = elements.filter((e) => !e.isDefect).length;

        const summary: ImportSummary = {
          timestamp: ts,
          structureNumber: parsedNum || "",
          structureNumberFound: !!parsedNum,
          elementsFound,
          elementRecordsCreated: newDefects.length,
          nbiFilledCount,
          nbiTotalCount,
          sections: sectionAudits,
          emptySections,
          unmatchedComponents: unmatchedNames,
        };
        setImportSummary(summary);

        const emptySummary =
          emptySections.length > 0
            ? `\n\n${emptySections.length} NBI section(s) with no data extracted — review manually:\n${emptySections
                .map((s) => `Item ${s.item}: ${s.description}`)
                .join("\n")}`
            : "";
        const unmatchedSummary =
          unmatchedNames.length > 0
            ? `\n\n${unmatchedNames.length} NBI component(s) not matched:\n${unmatchedNames.join("\n")}`
            : "";

        const { Alert } = require("react-native");
        Alert.alert(
          "Import Complete",
          `Imported ${newDefects.length} element record(s) across ${elementsFound} elements.\n${nbiFilledCount} of ${nbiTotalCount} NBI field(s) pre-filled.${emptySummary}${unmatchedSummary}\n\n${
            parsedNum ? `Structure: ${parsedNum}` : "Structure number not found."
          }\n\nSee the import audit on the Summary tab. Assign locations and verify records before submitting.`
        );
      } catch (err: unknown) {
        const { Alert } = require("react-native");
        const message = err instanceof Error ? err.message : "Could not parse the PDF. Ensure the file is a valid TxDOT inspection report.";
        Alert.alert("Import Failed", message);
      } finally {
        setParsingActive(false);
      }
    },
    [setSavedDefectsState, setNbiRatingsState, setStructureNumber, nbiRatings, setImportSummary]
  );

  // Retained fallback hook. The UI always triggers a real PDF import via
  // importFromPdf; this named entry point exists for environments where no
  // machine-readable report is available. It runs the parsing lifecycle
  // without fabricating any placeholder/demo defect records.
  const simulateLegacyImport = useCallback(() => {
    setParsingActive(true);
    setTimeout(() => {
      setParsingActive(false);
    }, 600);
  }, []);

  const value: InspectionContextType = {
    nomenclature,
    setNomenclature,
    inspectionType,
    setInspectionType,
    superstructureType,
    setSuperstructureType,
    substructureType,
    setSubstructureType,
    superstructureMaterial,
    setSuperstructureMaterial,
    substructureMaterial,
    setSubstructureMaterial,
    elementSearch,
    setElementSearch,
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
    showUnderclearanceModal,
    setShowUnderclearanceModal,
    underclearanceData,
    setUnderclearanceData,
    addUnderclearanceEntry,
    removeUnderclearanceEntry,
    showChannelModal,
    setShowChannelModal,
    channelData,
    setChannelData,
    addChannelMeasurement,
    removeChannelMeasurement,
    showDailySafetyModal,
    setShowDailySafetyModal,
    safetyBriefingData,
    setSafetyBriefingData,
    showSnbiModal,
    setShowSnbiModal,
    snbiData,
    setSnbiData,
    showSteelPipePileModal,
    setShowSteelPipePileModal,
    steelPipePileData,
    setSteelPipePileData,
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
    reviewImportedSubComponent,
    structureNumber,
    setStructureNumber,
    importFromPdf,
    simulateLegacyImport,
    parsingActive,
    importSummary,
    clearImportSummary,
    clearInspection,
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
