// Condition State descriptions pulled from the AASHTO Manual for Bridge
// Element Inspection, 2nd Edition (2019).  Keys are either `defectId` or
// `material:defectId` for material-specific overrides; lookupCS tries the
// specific key first and falls back to the plain defect key.

export type CSDef = {
  name: string;
  cs1: string;
  cs2: string;
  cs3: string;
  cs4: string;
};

const REVIEW =
  "The condition warrants a structural review to determine the effect on strength or serviceability of the element or bridge; OR a structural review has been completed and the defects impact strength or serviceability of the element or bridge.";

export const CS_DEFINITIONS: Record<string, CSDef> = {
  // ─── Steel ────────────────────────────────────────────────────────────────
  corr: {
    name: "Corrosion/Section Loss",
    cs1: "None.",
    cs2: "Freckled rust. Corrosion of the steel has initiated.",
    cs3: "Section loss is evident or pack rust is present but does not warrant structural review.",
    cs4: REVIEW,
  },
  crack_s: {
    name: "Cracking/Fatigue",
    cs1: "None.",
    cs2: "Crack that has self-arrested or has been arrested with effective arrest holes, doubling plates, or similar.",
    cs3: "Identified crack that is not arrested but does not warrant structural review.",
    cs4: REVIEW,
  },
  conn: {
    name: "Connection Deterioration",
    cs1: "Connection is in place and functioning as intended.",
    cs2: "Loose fasteners or pack rust without distortion is present but the connection is in place and functioning as intended.",
    cs3: "Missing bolts, rivets, or fasteners; broken welds; or pack rust with distortion but does not warrant a structural review.",
    cs4: REVIEW,
  },
  distort: {
    name: "Distortion",
    cs1: "None.",
    cs2: "Distortion not requiring mitigation or mitigated distortion.",
    cs3: "Distortion that requires mitigation that has not been addressed but does not warrant structural review.",
    cs4: REVIEW,
  },
  // ─── Concrete (RC / PSC) ─────────────────────────────────────────────────
  spall: {
    name: "Delamination/Spall/Patched Area",
    cs1: "None.",
    cs2: "Delaminated. Spall 1 in. or less deep or 6 in. or less in diameter. Patched area that is sound.",
    cs3: "Spall greater than 1 in. deep or greater than 6 in. diameter. Patched area that is unsound or showing distress. Does not warrant structural review.",
    cs4: REVIEW,
  },
  rebar: {
    name: "Exposed/Corroded Reinforcing",
    cs1: "None.",
    cs2: "Present without measurable section loss.",
    cs3: "Present with measurable section loss but does not warrant structural review.",
    cs4: REVIEW,
  },
  psc_rebar: {
    name: "Exposed Prestressing",
    cs1: "None.",
    cs2: "Present without section loss.",
    cs3: "Present with section loss but does not warrant structural review.",
    cs4: REVIEW,
  },
  crack: {
    name: "Cracking",
    cs1: "Insignificant cracks or moderate-width cracks that have been sealed.",
    cs2: "Unsealed moderate-width cracks or unsealed moderate pattern (map) cracking.",
    cs3: "Wide cracks or heavy pattern (map) cracking.",
    cs4: REVIEW,
  },
  corr_s: {
    name: "Efflorescence/Rust Staining",
    cs1: "None.",
    cs2: "Surface white without build-up or leaching without rust staining.",
    cs3: "Heavy build-up with rust staining.",
    cs4: REVIEW,
  },
  wear: {
    name: "Abrasion/Wear",
    cs1: "No abrasion or wearing.",
    cs2: "Abrasion or wearing has exposed coarse aggregate but the aggregate remains secure in the concrete.",
    cs3: "Coarse aggregate is loose or has popped out of the concrete matrix due to abrasion or wear.",
    cs4: REVIEW,
  },
  // ─── Timber ───────────────────────────────────────────────────────────────
  "Timber:crack": {
    name: "Cracks",
    cs1: "None.",
    cs2: "Crack that has been arrested through effective measures.",
    cs3: "Identified crack that is not arrested but does not require structural review.",
    cs4: REVIEW,
  },
  "Timber:wear": {
    name: "Abrasion/Wear",
    cs1: "None or no measurable section loss.",
    cs2: "Section loss less than 10% of the member thickness.",
    cs3: "Section loss 10% or more of the member thickness but does not warrant structural review.",
    cs4: REVIEW,
  },
  decay: {
    name: "Decay/Section Loss",
    cs1: "None.",
    cs2: "Affects less than 10% of the member section.",
    cs3: "Affects 10% or more of the member but does not warrant structural review.",
    cs4: REVIEW,
  },
  check: {
    name: "Checks/Shakes",
    cs1: "Surface penetration less than 5% of the member thickness regardless of location.",
    cs2: "Penetrates 5%–50% of the thickness of the member and not in a tension zone.",
    cs3: "Penetrates more than 50% of the thickness of the member, or penetrates more than 5% of the thickness in a tension zone. Does not warrant structural review.",
    cs4: REVIEW,
  },
  split: {
    name: "Split/Delamination",
    cs1: "None.",
    cs2: "Length less than the member depth or arrested with effective actions taken to mitigate.",
    cs3: "Length equal to or greater than the member depth but does not require structural review.",
    cs4: REVIEW,
  },
  crush: {
    name: "Crushing/Compression",
    cs1: "None.",
    cs2: "Crushing or compression present without measurable section loss.",
    cs3: "Measurable section loss due to crushing or compression but does not warrant structural review.",
    cs4: REVIEW,
  },
  // ─── Masonry ──────────────────────────────────────────────────────────────
  "Masonry:spall": {
    name: "Delamination/Spalling/Split",
    cs1: "None.",
    cs2: "Block or stone has split or spalled with no shifting.",
    cs3: "Block or stone has split or spalled with shifting but does not warrant a structural review.",
    cs4: REVIEW,
  },
  mortar: {
    name: "Mortar Breakdown",
    cs1: "None.",
    cs2: "Cracking or voids in less than 10% of joints.",
    cs3: "Cracking or voids in 10% or more of the joints.",
    cs4: REVIEW,
  },
  displace: {
    name: "Masonry Displacement",
    cs1: "None.",
    cs2: "Block or stone has shifted slightly out of alignment.",
    cs3: "Block or stone has shifted significantly out of alignment or is missing but does not warrant structural review.",
    cs4: REVIEW,
  },
  // ─── Wearing Surface (element 510) ────────────────────────────────────────
  crack_ws: {
    name: "Cracking (Wearing Surface)",
    cs1: "Width less than 0.012 in. or spacing greater than 3.0 ft.",
    cs2: "Width 0.012–0.05 in. or spacing of 1.0–3.0 ft.",
    cs3: "Width of more than 0.05 in. or spacing of less than 1.0 ft.",
    cs4: "The wearing surface is no longer effective.",
  },
  // Spall for wearing surface differs from structural concrete spall
  "WearSurface:spall": {
    name: "Delamination/Spall/Pothole",
    cs1: "None.",
    cs2: "Delaminated. Spall less than 1 in. deep or less than 6 in. diameter. Patched area that is sound. Partial-depth pothole.",
    cs3: "Spall 1 in. deep or greater or 6 in. diameter or greater. Patched area that is unsound or showing distress. Full-depth pothole.",
    cs4: "The wearing surface is no longer effective.",
  },
  // Effectiveness for wearing surfaces (3230) and concrete protective coating (3540)
  deterioration: {
    name: "Effectiveness/Deterioration",
    cs1: "Fully effective. No evidence of leakage or further deterioration of the protected element.",
    cs2: "Substantially effective. Deterioration of the protected element has slowed.",
    cs3: "Limited effectiveness. Deterioration of the protected element has progressed.",
    cs4: "The wearing surface or protective system is no longer effective.",
  },
  // ─── Steel Protective Coating (element 515) ───────────────────────────────
  coat_fail: {
    name: "Peeling/Bubbling/Cracking",
    cs1: "None.",
    cs2: "Finish coats only affected.",
    cs3: "Finish and primer coats affected.",
    cs4: "Exposure of bare metal.",
  },
  // ─── Bearings ─────────────────────────────────────────────────────────────
  movement: {
    name: "Movement/Expansion",
    cs1: "Free to move.",
    cs2: "Minor restriction.",
    cs3: "Restricted, but not warranting structural review.",
    cs4: REVIEW,
  },
  alignment: {
    name: "Alignment",
    cs1: "Lateral and vertical alignment is as expected for the temperature conditions.",
    cs2: "Tolerable lateral or vertical alignment that is inconsistent with the temperature conditions.",
    cs3: "Approaching the limits of lateral or vertical alignment for the bearing but does not warrant a structural review.",
    cs4: REVIEW,
  },
  bulging: {
    name: "Bulging/Splitting/Tearing",
    cs1: "None.",
    cs2: "Bulging less than 15% of the thickness.",
    cs3: "Bulging 15% or more of the thickness. Splitting or tearing. Bearing surfaces are not parallel. Does not warrant structural review.",
    cs4: REVIEW,
  },
  bearing_loss: {
    name: "Loss of Bearing Area",
    cs1: "None.",
    cs2: "Less than 10% loss of bearing area.",
    cs3: "10% or more loss of bearing area but does not warrant structural review.",
    cs4: REVIEW,
  },
  rotation: {
    name: "Excessive Rotation",
    cs1: "None.",
    cs2: "Rotation within tolerable range.",
    cs3: "Excessive rotation present but does not warrant structural review.",
    cs4: REVIEW,
  },
  shear: {
    name: "Shear/Movement",
    cs1: "None.",
    cs2: "Shear deformation within tolerable range.",
    cs3: "Significant shear deformation but does not warrant structural review.",
    cs4: REVIEW,
  },
  // ─── Joints ───────────────────────────────────────────────────────────────
  leak: {
    name: "Leakage",
    cs1: "None.",
    cs2: "Minimal. Minor dripping through the joint.",
    cs3: "Moderate. More than a drip and less than free flow of water.",
    cs4: "Free flow of water through the joint.",
  },
  adhesion: {
    name: "Seal Adhesion",
    cs1: "Fully adhered.",
    cs2: "Adhered for more than 50% of the joint height.",
    cs3: "Adhered 50% or less of joint height, but still some adhesion.",
    cs4: "Complete loss of adhesion.",
  },
  seal: {
    name: "Seal Damage",
    cs1: "None.",
    cs2: "Seal abrasion without punctures.",
    cs3: "Punctured or ripped, or partially pulled out.",
    cs4: "Punctured completely through, pulled out, or missing.",
  },
  seal_crack: {
    name: "Seal Cracking",
    cs1: "None.",
    cs2: "Surface crack.",
    cs3: "Crack that partially penetrates the seal.",
    cs4: "Crack that fully penetrates the seal.",
  },
  debris: {
    name: "Debris Impaction",
    cs1: "No debris, or a shallow cover of loose debris that does not affect joint performance.",
    cs2: "Partially filled with hard-packed material but still allowing free movement.",
    cs3: "Completely filled and impacts joint movement.",
    cs4: "Completely filled and prevents joint movement.",
  },
  adj_deck: {
    name: "Adjacent Deck/Header",
    cs1: "Sound. No spall, delamination, or unsound patch.",
    cs2: "Edge delamination or spall 1 in. or less deep or 6 in. or less in diameter. No exposed rebar. Patched area that is sound.",
    cs3: "Spall greater than 1 in. deep or greater than 6 in. diameter. Exposed rebar. Delamination or unsound patched area that makes the joint loose.",
    cs4: "Spall, delamination, unsound patched area, or loose joint anchor that prevents the joint from functioning as intended.",
  },
  metal_det: {
    name: "Metal Deterioration/Damage",
    cs1: "None.",
    cs2: "Freckled rust; metal has no cracks or impact damage. Connection may be loose but functioning as intended.",
    cs3: "Section loss, missing or broken fasteners, cracking of the metal, or impact damage but joint still functioning.",
    cs4: "Metal cracking, section loss, damage, or connection failure that prevents the joint from functioning as intended.",
  },
  armour: {
    name: "Armour Damage",
    cs1: "None.",
    cs2: "Minor wear or abrasion without section loss.",
    cs3: "Section loss present but joint still functioning.",
    cs4: "Armour damage that prevents the joint from functioning as intended.",
  },
  // ─── Universal ────────────────────────────────────────────────────────────
  settle: {
    name: "Settlement",
    cs1: "None.",
    cs2: "Exists within tolerable limits or no observed structural distress.",
    cs3: "Exceeds tolerable limits but does not warrant structural review.",
    cs4: REVIEW,
  },
  scour: {
    name: "Scour",
    cs1: "None.",
    cs2: "Exists within tolerable limits or has been arrested with effective countermeasures.",
    cs3: "Exceeds tolerable limits but is less than the critical limits determined by scour evaluation and does not warrant structural review.",
    cs4: "Exceeds critical scour limits. " + REVIEW,
  },
  damage: {
    name: "Damage (Impact)",
    cs1: "Not applicable.",
    cs2: "The element has impact damage. The specific damage caused by the impact has been captured in CS 2 under the appropriate material defect entry.",
    cs3: "The element has impact damage. The specific damage caused by the impact has been captured in CS 3 under the appropriate material defect entry.",
    cs4: "The element has impact damage. The specific damage caused by the impact has been captured in CS 4 under the appropriate material defect entry.",
  },
  impact: {
    name: "Impact Damage",
    cs1: "None.",
    cs2: "Minor impact damage without section loss.",
    cs3: "Impact damage with section loss or cracking but does not warrant structural review.",
    cs4: REVIEW,
  },
  // ─── Custom / Agency ──────────────────────────────────────────────────────
  corr_pile: {
    name: "Section Loss (Remaining Section)",
    cs1: "None.",
    cs2: "Section loss less than 10% of original.",
    cs3: "Section loss 10%–25% of original but does not warrant structural review.",
    cs4: REVIEW,
  },
  pitting: {
    name: "Pitting Corrosion",
    cs1: "None.",
    cs2: "Minor pitting without measurable section loss.",
    cs3: "Pitting with measurable section loss but does not warrant structural review.",
    cs4: REVIEW,
  },
};

/**
 * Look up CS descriptions for a given defect and element material.
 * Tries `${material}:${defectId}` first, then falls back to `${defectId}`.
 * Also tries an element-category-specific key (e.g. "WearSurface:spall").
 */
export function lookupCS(
  defectId: string,
  material: string,
  elementId?: string
): CSDef | null {
  // Wearing surface (element 510) has pothole-specific spall description
  if (elementId === "510" && defectId === "spall") {
    return CS_DEFINITIONS["WearSurface:spall"] ?? CS_DEFINITIONS[defectId] ?? null;
  }
  return (
    CS_DEFINITIONS[`${material}:${defectId}`] ??
    CS_DEFINITIONS[defectId] ??
    null
  );
}
