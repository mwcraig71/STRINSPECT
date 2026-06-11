export interface TextShortcut {
  id: string;
  category: string;
  label: string;
  text: string;
}

export const TEXT_SHORTCUTS: TextShortcut[] = [
  // ── General Notes ──
  { id: "gen_01", category: "General Notes", label: "Routine inspection", text: "Routine inspection performed in accordance with TxDOT bridge inspection guidelines." },
  { id: "gen_02", category: "General Notes", label: "No defects found", text: "No defects or deterioration observed during this inspection." },
  { id: "gen_03", category: "General Notes", label: "Previous defects monitored", text: "Defects noted in previous inspection continue to be monitored. No significant change observed." },
  { id: "gen_04", category: "General Notes", label: "Access limited", text: "Access to element was limited due to vegetation, water depth, or traffic control. Inspection performed from available vantage points." },
  { id: "gen_05", category: "General Notes", label: "Underwater not inspected", text: "Underwater elements not inspected at this time. Recommend underwater inspection." },
  { id: "gen_06", category: "General Notes", label: "Inspector safety note", text: "Safety precautions observed throughout inspection. PPE worn at all times." },
  { id: "gen_07", category: "General Notes", label: "High water", text: "High water at time of inspection prevented full access to substructure elements." },
  { id: "gen_08", category: "General Notes", label: "Photos taken", text: "Photographic documentation collected for all areas of concern." },
  { id: "gen_09", category: "General Notes", label: "Consistent with records", text: "Conditions consistent with previous inspection records." },
  { id: "gen_10", category: "General Notes", label: "Follow-up needed", text: "Follow-up inspection recommended within 6 months to monitor progression." },

  // ── Concrete — Cracks ──
  { id: "con_01", category: "Concrete — Cracks", label: "Hairline cracks", text: "Hairline cracks observed. Width less than 0.01 in. Monitoring recommended." },
  { id: "con_02", category: "Concrete — Cracks", label: "Longitudinal cracks", text: "Longitudinal cracks present, consistent with flexural stress patterns. Width approximately 0.02–0.05 in." },
  { id: "con_03", category: "Concrete — Cracks", label: "Transverse cracks", text: "Transverse cracks observed. Likely shrinkage or thermal origin. No active leaching noted." },
  { id: "con_04", category: "Concrete — Cracks", label: "Diagonal cracks", text: "Diagonal shear cracks observed. Recommend structural review." },
  { id: "con_05", category: "Concrete — Cracks", label: "Map cracking", text: "Map (pattern) cracking present over approximately 20% of surface area. Indicative of alkali-silica reaction or early carbonation." },
  { id: "con_06", category: "Concrete — Cracks", label: "Active leaching", text: "White calcium carbonate leaching through cracks. Indicates sustained water infiltration." },
  { id: "con_07", category: "Concrete — Cracks", label: "Cracks sealed", text: "Cracks previously sealed with epoxy injection. Seal appears intact at time of inspection." },

  // ── Concrete — Spalling & Delamination ──
  { id: "con_08", category: "Concrete — Spalling", label: "Surface spalling", text: "Surface spalling observed. Depth less than cover depth. No exposed reinforcing steel." },
  { id: "con_09", category: "Concrete — Spalling", label: "Deep spalling", text: "Deep spalling present with exposed and corroding reinforcing steel. Repair required." },
  { id: "con_10", category: "Concrete — Spalling", label: "Delamination", text: "Delamination detected by sounding. Area is hollow and at risk of spalling. Repair recommended." },
  { id: "con_11", category: "Concrete — Spalling", label: "Spalling repaired", text: "Previous spalling repaired with patching material. Patch appears sound with no signs of debonding." },
  { id: "con_12", category: "Concrete — Spalling", label: "Rebar exposed", text: "Exposed reinforcing steel observed with active corrosion and section loss. Immediate repair required." },

  // ── Concrete — General Deterioration ──
  { id: "con_13", category: "Concrete — Deterioration", label: "Efflorescence", text: "Efflorescence present on surface, indicating moisture migration through concrete." },
  { id: "con_14", category: "Concrete — Deterioration", label: "Honeycombing", text: "Honeycombing observed in concrete. Likely resulted from inadequate consolidation during placement." },
  { id: "con_15", category: "Concrete — Deterioration", label: "Scaling", text: "Surface scaling present due to freeze-thaw cycles or chemical exposure." },
  { id: "con_16", category: "Concrete — Deterioration", label: "Carbonation", text: "Carbonation reducing alkalinity of concrete cover; reinforcement corrosion risk elevated." },
  { id: "con_17", category: "Concrete — Deterioration", label: "Good condition", text: "Concrete in good condition. Sound, no significant cracking, spalling, or deterioration noted." },

  // ── Steel Elements ──
  { id: "stl_01", category: "Steel Elements", label: "Light surface rust", text: "Light surface rust (oxidation) observed. No significant section loss. Cleaning and painting recommended." },
  { id: "stl_02", category: "Steel Elements", label: "Moderate corrosion", text: "Moderate corrosion with section loss estimated at less than 10%. Monitoring and maintenance coating recommended." },
  { id: "stl_03", category: "Steel Elements", label: "Severe corrosion", text: "Severe corrosion with measurable section loss. Structural review and repair required." },
  { id: "stl_04", category: "Steel Elements", label: "Pack rust", text: "Pack rust present between steel components. Causes section loss and overstress at connections." },
  { id: "stl_05", category: "Steel Elements", label: "Paint system sound", text: "Protective coating system intact. No significant peeling, blistering, or loss of adhesion observed." },
  { id: "stl_06", category: "Steel Elements", label: "Paint deteriorated", text: "Protective coating deteriorated. Exposed bare steel susceptible to corrosion. Repainting required." },
  { id: "stl_07", category: "Steel Elements", label: "Section loss", text: "Section loss present. Ultrasonic thickness measurements recommended to quantify loss." },
  { id: "stl_08", category: "Steel Elements", label: "Good condition", text: "Steel elements in good condition. Coating intact, no significant corrosion or distortion." },
  { id: "stl_09", category: "Steel Elements", label: "Distortion/buckling", text: "Distortion or out-of-plane buckling observed. Cause and structural impact require engineering review." },
  { id: "stl_10", category: "Steel Elements", label: "Fatigue cracks", text: "Potential fatigue cracks observed at welds or connections. Recommend immediate structural review." },
  { id: "stl_11", category: "Steel Elements", label: "Loose bolts/rivets", text: "Loose fasteners observed. Bolts or rivets require tightening or replacement." },

  // ── Timber Elements ──
  { id: "tim_01", category: "Timber Elements", label: "Sound timber", text: "Timber elements sound. No significant rot, cracking, or section loss observed." },
  { id: "tim_02", category: "Timber Elements", label: "Surface checking", text: "Surface checking (longitudinal cracks) present. Typical for seasoned timber; no structural concern at this time." },
  { id: "tim_03", category: "Timber Elements", label: "Decay/rot", text: "Wood rot (decay) observed. Probe testing indicates soft or punky material. Section loss estimated." },
  { id: "tim_04", category: "Timber Elements", label: "Section loss", text: "Section loss due to decay reduces load-carrying capacity. Replacement recommended." },
  { id: "tim_05", category: "Timber Elements", label: "Insect damage", text: "Insect damage (termite or beetle) observed. Core probing recommended to assess extent of interior damage." },
  { id: "tim_06", category: "Timber Elements", label: "Split/broken", text: "Splitting or fracture of timber element observed. Element may need replacement." },
  { id: "tim_07", category: "Timber Elements", label: "Preservative treatment", text: "Preservative treatment visible and appears adequate. No excessive leaching noted." },

  // ── Deck ──
  { id: "dck_01", category: "Deck", label: "Deck good condition", text: "Bridge deck in good condition. Riding surface acceptable, no significant cracking or surface distress." },
  { id: "dck_02", category: "Deck", label: "Potholes", text: "Potholes present in riding surface. Maintenance patching required." },
  { id: "dck_03", category: "Deck", label: "Ruts/depressions", text: "Rutting or depressions in riding surface. Potential drainage issue." },
  { id: "dck_04", category: "Deck", label: "Deck drains blocked", text: "Deck drains blocked with debris. Cleaning required to prevent ponding and accelerated deterioration." },
  { id: "dck_05", category: "Deck", label: "Wearing surface worn", text: "Wearing surface worn through in areas exposing underlying concrete deck." },
  { id: "dck_06", category: "Deck", label: "Overlay deteriorated", text: "Bituminous overlay deteriorated with areas of delamination and potholing." },
  { id: "dck_07", category: "Deck", label: "Transverse cracking", text: "Transverse deck cracks noted. Cracks appear to extend through wearing surface." },
  { id: "dck_08", category: "Deck", label: "Longitudinal cracking", text: "Longitudinal deck cracks noted above girder lines. Possible reflective cracking from underlying element." },
  { id: "dck_09", category: "Deck", label: "Deck replacement needed", text: "Deck deterioration is extensive. Deck replacement should be considered in near-term capital program." },

  // ── Bearings & Joints ──
  { id: "brg_01", category: "Bearings & Joints", label: "Bearings functional", text: "Bearings appear functional. No excessive distortion, cracking, or displacement observed." },
  { id: "brg_02", category: "Bearings & Joints", label: "Elastomeric bearing cracked", text: "Elastomeric bearing pads show cracking or bulging. Replacement recommended." },
  { id: "brg_03", category: "Bearings & Joints", label: "Rocker/pin frozen", text: "Rocker or pin bearings appear frozen. No evidence of rotation or translation movement. Potential thermal stress buildup." },
  { id: "brg_04", category: "Bearings & Joints", label: "Bearing debris", text: "Debris and dirt accumulation around bearings restricting movement. Cleaning required." },
  { id: "brg_05", category: "Bearings & Joints", label: "Bearing corrosion", text: "Steel bearing components corroded. Painting and possible replacement required." },
  { id: "brg_06", category: "Bearings & Joints", label: "Expansion joint open", text: "Expansion joint open beyond expected range. Verify with design documentation." },
  { id: "brg_07", category: "Bearings & Joints", label: "Expansion joint closed", text: "Expansion joint compressed or closed. Possible restricted thermal movement." },
  { id: "brg_08", category: "Bearings & Joints", label: "Joint sealed", text: "Expansion joint sealed with compression seal or poured seal. Seal appears intact." },
  { id: "brg_09", category: "Bearings & Joints", label: "Joint seal failed", text: "Expansion joint seal failed or missing. Water and debris infiltrating onto bearings and substructure." },
  { id: "brg_10", category: "Bearings & Joints", label: "Joint debris filled", text: "Expansion joint filled with incompressible debris. May restrict thermal movement and cause damage." },

  // ── Scour & Channel ──
  { id: "scr_01", category: "Scour & Channel", label: "No scour observed", text: "No scour or erosion observed at foundations. Channel in stable condition." },
  { id: "scr_02", category: "Scour & Channel", label: "Bank erosion", text: "Bank erosion noted at channel margins. Foundation not currently exposed." },
  { id: "scr_03", category: "Scour & Channel", label: "Scour at footing", text: "Scour observed exposing top of footing. Recommend monitoring and possible countermeasure." },
  { id: "scr_04", category: "Scour & Channel", label: "Pile exposure", text: "Piles exposed below original ground line due to scour. Structural review required." },
  { id: "scr_05", category: "Scour & Channel", label: "Riprap displaced", text: "Riprap countermeasures displaced or lost. Channel protection diminished." },
  { id: "scr_06", category: "Scour & Channel", label: "Debris accumulation", text: "Significant debris accumulation against superstructure or piers. High-water obstruction risk." },
  { id: "scr_07", category: "Scour & Channel", label: "Channel migration", text: "Channel migrating toward abutment. Potential for undermining if trend continues." },
  { id: "scr_08", category: "Scour & Channel", label: "Waterway adequate", text: "Waterway opening appears adequate for observed flow conditions." },
  { id: "scr_09", category: "Scour & Channel", label: "Scour critical", text: "Bridge is scour critical. Monitoring plan in place per TxDOT policy." },

  // ── Approach & Roadway ──
  { id: "apr_01", category: "Approach & Roadway", label: "Approach slab good", text: "Approach slabs in good condition. No significant settlement or cracking noted." },
  { id: "apr_02", category: "Approach & Roadway", label: "Bump at bridge", text: "Bump at bridge end noted. Approach slab settlement or backfill settlement contributing." },
  { id: "apr_03", category: "Approach & Roadway", label: "Guardrail good", text: "Guardrail and railing in good condition. Terminals and connections secure." },
  { id: "apr_04", category: "Approach & Roadway", label: "Guardrail damaged", text: "Guardrail damaged or missing sections. Replacement required for motorist safety." },
  { id: "apr_05", category: "Approach & Roadway", label: "Wingwall cracked", text: "Wingwall cracking noted. Possible settlement or fill movement behind abutment." },
  { id: "apr_06", category: "Approach & Roadway", label: "Roadway drainage", text: "Roadway drainage adequate. No excessive ponding or erosion observed on approaches." },

  // ── Signage & Safety ──
  { id: "sgn_01", category: "Signage & Safety", label: "Load posting signs present", text: "Load posting signs present and legible at both approaches." },
  { id: "sgn_02", category: "Signage & Safety", label: "Load signs missing", text: "Load posting sign missing or illegible. Replacement required." },
  { id: "sgn_03", category: "Signage & Safety", label: "No load restriction", text: "No load restriction in place. Bridge posted for legal loads." },
  { id: "sgn_04", category: "Signage & Safety", label: "Vertical clearance sign", text: "Vertical clearance sign present and accurately reflects current clearance." },
  { id: "sgn_05", category: "Signage & Safety", label: "Warning signs present", text: "Appropriate warning signs present and visible on approach." },
  { id: "sgn_06", category: "Signage & Safety", label: "Lighting functional", text: "Bridge lighting functional and providing adequate illumination." },

  // ── Maintenance Recommendations ──
  { id: "mnt_01", category: "Maintenance", label: "Clean and seal", text: "Recommend cleaning concrete surfaces and sealing cracks to prevent water infiltration." },
  { id: "mnt_02", category: "Maintenance", label: "Vegetation removal", text: "Vegetation growing on structure should be removed. Roots can accelerate joint opening and concrete deterioration." },
  { id: "mnt_03", category: "Maintenance", label: "Drain cleaning", text: "Deck drains and scuppers require cleaning to restore drainage function." },
  { id: "mnt_04", category: "Maintenance", label: "Paint touch-up", text: "Touch-up painting recommended on areas of coating failure to prevent base metal corrosion." },
  { id: "mnt_05", category: "Maintenance", label: "Joint cleaning", text: "Expansion joint cleaning required to remove incompressible material and restore movement capacity." },
  { id: "mnt_06", category: "Maintenance", label: "Graffiti removal", text: "Graffiti present on bridge elements. Removal recommended to facilitate future condition monitoring." },
  { id: "mnt_07", category: "Maintenance", label: "Debris removal", text: "Debris accumulation noted. Removal recommended to prevent obstruction and accelerated deterioration." },
  { id: "mnt_08", category: "Maintenance", label: "Routine maintenance adequate", text: "Routine maintenance appears adequate. Continue current maintenance program." },

  // ── Engineering Recommendations ──
  { id: "rec_01", category: "Recommendations", label: "Monitor next cycle", text: "Recommend monitoring this condition at the next scheduled inspection." },
  { id: "rec_02", category: "Recommendations", label: "Interim inspection", text: "Recommend interim inspection within 6 months to monitor rate of deterioration." },
  { id: "rec_03", category: "Recommendations", label: "Load analysis needed", text: "Recommend structural load analysis by a licensed engineer prior to posting any overweight permits." },
  { id: "rec_04", category: "Recommendations", label: "Underwater inspection", text: "Recommend Level I or Level II underwater inspection to assess submerged foundation condition." },
  { id: "rec_05", category: "Recommendations", label: "NDE recommended", text: "Non-destructive evaluation (NDE) recommended to assess extent of subsurface deterioration." },
  { id: "rec_06", category: "Recommendations", label: "Immediate action", text: "Condition requires immediate maintenance or engineering action. Notify district bridge engineer." },
  { id: "rec_07", category: "Recommendations", label: "Reduce posting", text: "Recommend reducing load posting in response to observed structural deterioration." },
  { id: "rec_08", category: "Recommendations", label: "Bridge replacement", text: "Bridge has reached end of serviceable life. Recommend programming for replacement." },
  { id: "rec_09", category: "Recommendations", label: "Repair project", text: "Recommend programming a repair project to address deterioration before it advances further." },
  { id: "rec_10", category: "Recommendations", label: "No action needed", text: "No maintenance or engineering action required at this time based on current conditions." },
];

export const SC_FAVORITES_KEY = "@bridge_sc_favorites";
export const CUSTOM_SHORTCUTS_KEY = "@bridge_custom_shortcuts";
export const SC_OVERRIDES_KEY = "@bridge_sc_overrides";
export const SC_HIDDEN_KEY = "@bridge_sc_hidden";

export function mergeShortcuts(
  customRaw: string | null,
  overridesRaw?: string | null,
  hiddenRaw?: string | null,
): TextShortcut[] {
  try {
    const custom: TextShortcut[] = customRaw ? JSON.parse(customRaw) : [];
    const overrides: Record<string, { label: string; text: string }> =
      overridesRaw ? JSON.parse(overridesRaw) : {};
    const hidden: string[] = hiddenRaw ? JSON.parse(hiddenRaw) : [];
    const builtIns = TEXT_SHORTCUTS
      .filter((s) => !hidden.includes(s.id))
      .map((s) => (overrides[s.id] ? { ...s, ...overrides[s.id] } : s));
    return [...builtIns, ...custom];
  } catch {
    return [...TEXT_SHORTCUTS];
  }
}
