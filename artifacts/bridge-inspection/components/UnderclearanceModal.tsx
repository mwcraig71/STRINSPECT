import { AppIcon as Feather } from "@/components/AppIcon";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { SketchPad } from "@/components/SketchPad";
import {
  SketchStroke,
  UC_MEASURE_ROWS,
  UC_REFERENCE_FEATURES,
  UcMeasure,
  UcMeasureKey,
  UnderclearanceEntry,
  useInspection,
} from "@/context/InspectionContext";

const AMBER = "#f59e0b";
const AMBER_BG = "#fffbeb";
const AMBER_BORDER = "#fcd34d";

export function UnderclearanceModal({ inline = false }: { inline?: boolean }) {
  const c = useColors();
  const {
    showUnderclearanceModal,
    setShowUnderclearanceModal,
    underclearanceData,
    setUnderclearanceData,
    addUnderclearanceEntry,
    removeUnderclearanceEntry,
    setStructureNumber,
  } = useInspection();

  const d = underclearanceData;
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // step 1 = selecting first reference code, step 2 = selecting second
  const [refPicker, setRefPicker] = useState<{
    entryId: string;
    key: UcMeasureKey;
    step: 1 | 2;
  } | null>(null);

  // Parse "G-H" → ["G","H"], "G" → ["G",""], "" → ["",""]
  const parseRefer = (refer: string): [string, string] => {
    const dash = refer.indexOf("-");
    if (dash >= 0) return [refer.slice(0, dash), refer.slice(dash + 1)];
    return [refer, ""];
  };

  // Build "G-H" or "G" or "" from two codes
  const buildRefer = (r1: string, r2: string): string => {
    if (r1 && r2) return `${r1}-${r2}`;
    return r1 || r2;
  };

  const hasImported = d.entries.some((e) => e.isImported);
  const hasNeedsVerification = d.entries.some((e) => e.needsVerification);

  const setHeader = (field: keyof typeof d, value: string) => {
    if (field === "structureNumber") {
      setStructureNumber(value);
      return;
    }
    setUnderclearanceData({ ...d, [field]: value });
  };

  const setSketch = (strokes: SketchStroke[]) => {
    setUnderclearanceData({ ...d, sketch: strokes });
  };

  const updateEntry = (id: string, patch: Partial<UnderclearanceEntry>) => {
    setUnderclearanceData({
      ...d,
      entries: d.entries.map((e) =>
        e.id === id ? { ...e, ...patch, needsVerification: false } : e
      ),
    });
  };

  const updateMeasure = (
    id: string,
    key: UcMeasureKey,
    patch: Partial<UcMeasure>
  ) => {
    const entry = d.entries.find((e) => e.id === id);
    if (!entry) return;
    updateEntry(id, { [key]: { ...entry[key], ...patch } });
  };

  const renderReferCell = (entryId: string, key: UcMeasureKey, m: UcMeasure) => {
    const open = refPicker?.entryId === entryId && refPicker?.key === key;
    const [r1, r2] = parseRefer(m.refer);
    const display = r1 && r2 ? `${r1}-${r2}` : r1 || "—";
    return (
      <TouchableOpacity
        style={[
          styles.measureRefer,
          styles.referCell,
          { backgroundColor: c.secondary, borderColor: open ? "#0f766e" : c.border },
        ]}
        onPress={() => setRefPicker(open ? null : { entryId, key, step: 1 })}
      >
        <Text style={[styles.referCellText, { color: m.refer ? c.foreground : c.mutedForeground }]}>
          {display}
        </Text>
      </TouchableOpacity>
    );
  };

  const headerFields: { key: keyof typeof d; label: string; placeholder: string }[] = [
    { key: "district", label: "District", placeholder: "02" },
    { key: "county", label: "County", placeholder: "220" },
    { key: "controlSection", label: "Control - Section", placeholder: "0747 - 04" },
    { key: "structureNumber", label: "Structure #", placeholder: "046" },
    { key: "route", label: "Route", placeholder: "Center Pedestrian Bridge" },
    { key: "featureCrossed", label: "Feature Crossed", placeholder: "FM-157" },
    { key: "company", label: "Company Name & No.", placeholder: "Strinteg Corporation [F-20066]" },
    { key: "inspectionDate", label: "Date", placeholder: "MM/DD/YYYY" },
  ];

  if (inline && !showUnderclearanceModal) return null;
  const sheet = (
    <View style={inline ? [StyleSheet.absoluteFill, styles.container, { backgroundColor: c.background, zIndex: 999 }] : [styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: "#0f766e" }]}>
          <View style={styles.headerLeft}>
            <Feather name="minimize-2" size={26} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Underclearance Record</Text>
              <Text style={styles.headerSubtitle}>TxDOT Form 2601</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowUnderclearanceModal(false)}
            style={styles.closeBtn}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          scrollEnabled={scrollEnabled}
        >
          {/* Import verification banner */}
          {hasImported && hasNeedsVerification && (
            <View style={styles.importBanner}>
              <Feather name="alert-triangle" size={14} color="#92400e" />
              <Text style={styles.importBannerText}>
                Verify imported values — tap any field to confirm
              </Text>
            </View>
          )}
          {hasImported && !hasNeedsVerification && (
            <View style={styles.importBannerDone}>
              <Feather name="check-circle" size={14} color="#065f46" />
              <Text style={styles.importBannerDoneText}>
                All imported values have been verified
              </Text>
            </View>
          )}

          {/* Structure header info */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Record Information</Text>
            <View style={styles.headerGrid}>
              {headerFields.map((f) => (
                <View key={f.key} style={styles.headerField}>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                    value={String(d[f.key] ?? "")}
                    onChangeText={(t) => setHeader(f.key, t)}
                    placeholder={f.placeholder}
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Reference features legend */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Reference Features</Text>
            <View style={styles.legendGrid}>
              {UC_REFERENCE_FEATURES.map((r) => (
                <View key={r.code} style={styles.legendItem}>
                  <View style={[styles.legendBadge, { backgroundColor: "#0f766e" }]}>
                    <Text style={styles.legendBadgeText}>{r.code}</Text>
                  </View>
                  <Text style={[styles.legendLabel, { color: c.mutedForeground }]}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Feature-crossed entries */}
          {d.entries.map((entry, idx) => {
            const isImportedEntry = entry.isImported === true;
            const needsVerif = entry.needsVerification === true;
            const cardBg = isImportedEntry ? AMBER_BG : c.card;
            const cardBorder = isImportedEntry
              ? needsVerif ? AMBER : AMBER_BORDER
              : c.border;

            return (
              <View key={entry.id} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isImportedEntry ? 1.5 : 1 }]}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryTitleRow}>
                    <Text style={[styles.cardTitle, { color: "#0f766e" }]}>
                      Feature Crossed #{idx + 1}
                    </Text>
                    {isImportedEntry && (
                      <View style={[styles.importBadge, { backgroundColor: needsVerif ? AMBER : "#d97706" }]}>
                        <Feather name={needsVerif ? "alert-circle" : "check"} size={10} color="#fff" />
                        <Text style={styles.importBadgeText}>
                          {needsVerif ? "Imported — verify" : "Imported"}
                        </Text>
                      </View>
                    )}
                  </View>
                  {d.entries.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeUnderclearanceEntry(entry.id)}
                      style={styles.removeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>PSN</Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: isImportedEntry ? "#fef3c7" : c.secondary,
                      borderColor: isImportedEntry ? AMBER_BORDER : c.border,
                      color: c.foreground,
                    }]}
                    value={entry.psn}
                    onChangeText={(t) => updateEntry(entry.id, { psn: t })}
                    placeholder="Point/Span number..."
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>

                {/* Column header */}
                <View style={styles.measureHeaderRow}>
                  <Text style={[styles.measureHeadLabel, { color: c.mutedForeground }]}>Measurement</Text>
                  <Text style={[styles.measureHeadData, { color: c.mutedForeground }]}>Field Data</Text>
                  <Text style={[styles.measureHeadRefer, { color: c.mutedForeground }]}>Refer.</Text>
                  <Text style={[styles.measureHeadItem, { color: c.mutedForeground }]}>Item</Text>
                </View>

                {UC_MEASURE_ROWS.map((row) => {
                  const m = entry[row.key];
                  const pickerOpen = refPicker?.entryId === entry.id && refPicker?.key === row.key;
                  return (
                    <View key={row.key}>
                      <View style={[styles.measureRow, { borderColor: isImportedEntry ? AMBER_BORDER : c.border }]}>
                        <Text style={[styles.measureLabel, { color: c.foreground }]} numberOfLines={2}>
                          {row.label}
                        </Text>
                        <TextInput
                          style={[styles.measureData, {
                            backgroundColor: isImportedEntry ? "#fef3c7" : c.secondary,
                            borderColor: isImportedEntry ? AMBER_BORDER : c.border,
                            color: c.foreground,
                          }]}
                          value={m.data}
                          onChangeText={(t) => updateMeasure(entry.id, row.key, { data: t })}
                          placeholder="—"
                          placeholderTextColor={c.mutedForeground}
                        />
                        {renderReferCell(entry.id, row.key, m)}
                        <Text style={[styles.measureItem, { color: c.mutedForeground }]}>{row.itemNo}</Text>
                      </View>
                      {pickerOpen && (() => {
                        const [ref1, ref2] = parseRefer(m.refer);
                        const activeStep = refPicker?.step ?? 1;
                        return (
                        <View style={[styles.refDropdown, { backgroundColor: c.card, borderColor: c.border }]}>
                          <Text style={[styles.refDropdownTitle, { color: c.mutedForeground }]}>
                            {row.label} — Reference Feature
                          </Text>

                          {/* Slot display: Ref 1 — Ref 2 */}
                          <View style={styles.refSlotRow}>
                            <TouchableOpacity
                              style={[styles.refSlot, activeStep === 1 && styles.refSlotActive, { borderColor: activeStep === 1 ? "#0f766e" : c.border }]}
                              onPress={() => setRefPicker(refPicker ? { ...refPicker, step: 1 } : null)}
                            >
                              <Text style={[styles.refSlotLabel, { color: c.mutedForeground }]}>Ref 1</Text>
                              <Text style={[styles.refSlotValue, { color: ref1 ? "#0f766e" : c.mutedForeground }]}>
                                {ref1 || "—"}
                              </Text>
                            </TouchableOpacity>
                            <Text style={[styles.refSlotDash, { color: c.mutedForeground }]}>—</Text>
                            <TouchableOpacity
                              style={[styles.refSlot, activeStep === 2 && styles.refSlotActive, { borderColor: activeStep === 2 ? "#0891b2" : c.border }]}
                              onPress={() => setRefPicker(refPicker ? { ...refPicker, step: 2 } : null)}
                            >
                              <Text style={[styles.refSlotLabel, { color: c.mutedForeground }]}>Ref 2</Text>
                              <Text style={[styles.refSlotValue, { color: ref2 ? "#0891b2" : c.mutedForeground }]}>
                                {ref2 || "—"}
                              </Text>
                            </TouchableOpacity>
                            {m.refer ? (
                              <TouchableOpacity
                                style={styles.refClearBtn}
                                onPress={() => { updateMeasure(entry.id, row.key, { refer: "" }); setRefPicker(null); }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="x" size={12} color="#dc2626" />
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          <Text style={[styles.refStepHint, { color: c.mutedForeground }]}>
                            {activeStep === 1 ? "Tap to set first reference →" : "Tap to set second reference"}
                          </Text>

                          {/* Options grid */}
                          <View style={styles.refOptions}>
                            {UC_REFERENCE_FEATURES.map((r) => {
                              const isRef1 = r.code === ref1;
                              const isRef2 = r.code === ref2;
                              const bg = isRef1 ? "#0f766e" : isRef2 ? "#0891b2" : c.secondary;
                              const borderColor = isRef1 ? "#0f766e" : isRef2 ? "#0891b2" : c.border;
                              const textColor = (isRef1 || isRef2) ? "#fff" : c.foreground;
                              const codeColor = (isRef1 || isRef2) ? "#fff" : "#0f766e";
                              return (
                                <TouchableOpacity
                                  key={r.code}
                                  style={[styles.refOption, { backgroundColor: bg, borderColor }]}
                                  onPress={() => {
                                    let newR1 = ref1, newR2 = ref2;
                                    if (activeStep === 1) {
                                      newR1 = r.code === ref1 ? "" : r.code;
                                      // Auto-advance to step 2 when ref1 is set
                                      const newRefer = buildRefer(newR1, newR2);
                                      updateMeasure(entry.id, row.key, { refer: newRefer });
                                      if (newR1) setRefPicker(refPicker ? { ...refPicker, step: 2 } : null);
                                    } else {
                                      newR2 = r.code === ref2 ? "" : r.code;
                                      const newRefer = buildRefer(newR1, newR2);
                                      updateMeasure(entry.id, row.key, { refer: newRefer });
                                      if (newR2) setRefPicker(null);
                                    }
                                  }}
                                >
                                  <View style={styles.refOptionCodeWrap}>
                                    <Text style={[styles.refOptionCode, { color: codeColor }]}>{r.code}</Text>
                                    {isRef1 && <View style={[styles.refBadge, { backgroundColor: "rgba(255,255,255,0.3)" }]}><Text style={styles.refBadgeText}>1</Text></View>}
                                    {isRef2 && <View style={[styles.refBadge, { backgroundColor: "rgba(255,255,255,0.3)" }]}><Text style={styles.refBadgeText}>2</Text></View>}
                                  </View>
                                  <Text style={[styles.refOptionLabel, { color: textColor }]} numberOfLines={1}>
                                    {r.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                        );
                      })()}
                    </View>
                  );
                })}

                {/* Signed Vertical Clearance + tolerance */}
                <View style={[styles.signedBox, {
                  borderColor: isImportedEntry ? AMBER : "#0f766e",
                  backgroundColor: isImportedEntry ? "#fef3c7" : c.secondary,
                }]}>
                  <Text style={[styles.fieldLabel, { color: isImportedEntry ? AMBER : "#0f766e" }]}>Signed Vertical Clr</Text>
                  <View style={styles.signedRow}>
                    <View style={styles.signedField}>
                      <Text style={[styles.fieldSubLabel, { color: c.mutedForeground }]}>Field Data</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: c.card, borderColor: isImportedEntry ? AMBER_BORDER : c.border, color: c.foreground }]}
                        value={entry.signedVertData}
                        onChangeText={(t) => updateEntry(entry.id, { signedVertData: t })}
                        placeholder={"17'10\""}
                        placeholderTextColor={c.mutedForeground}
                      />
                    </View>
                    <View style={styles.signedField}>
                      <Text style={[styles.fieldSubLabel, { color: c.mutedForeground }]}>Tolerance</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: c.card, borderColor: isImportedEntry ? AMBER_BORDER : c.border, color: c.foreground }]}
                        value={entry.signedVertTolerance}
                        onChangeText={(t) => updateEntry(entry.id, { signedVertTolerance: t })}
                        placeholder={"1'4\""}
                        placeholderTextColor={c.mutedForeground}
                      />
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.addBtn, { borderColor: "#0f766e" }]}
            onPress={addUnderclearanceEntry}
          >
            <Feather name="plus" size={16} color="#0f766e" />
            <Text style={[styles.addBtnText, { color: "#0f766e" }]}>Add Feature Crossed</Text>
          </TouchableOpacity>

          {/* Vertical clearance sketch */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Vertical Clearance Sketch</Text>
            <SketchPad
              strokes={d.sketch}
              onChange={setSketch}
              onDrawStateChange={(drawing) => setScrollEnabled(!drawing)}
            />
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: "#0f766e" }]}
            onPress={() => setShowUnderclearanceModal(false)}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Save & Close</Text>
          </TouchableOpacity>
        </View>
    </View>
  );
  if (inline) return sheet;
  return (
    <Modal
      visible={showUnderclearanceModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowUnderclearanceModal(false)}
    >
      {sheet}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  closeBtn: { padding: 8, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.2)" },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  importBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  importBannerText: { fontSize: 12, fontWeight: "700", color: "#92400e", flex: 1 },
  importBannerDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#d1fae5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  importBannerDoneText: { fontSize: 12, fontWeight: "700", color: "#065f46", flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
  entryHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  entryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" },
  importBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  importBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.3 },
  headerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  headerField: { width: "47%" },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  fieldSubLabel: { fontSize: 8, fontWeight: "700", textTransform: "uppercase", marginBottom: 3 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5, width: "47%" },
  legendBadge: { width: 18, height: 18, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  legendBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  legendLabel: { fontSize: 10, fontWeight: "600", flex: 1 },
  removeBtn: { padding: 4 },
  measureHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  measureHeadLabel: { flex: 1, fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  measureHeadData: { width: 72, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureHeadRefer: { width: 56, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureHeadItem: { width: 34, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  measureLabel: { flex: 1, fontSize: 11, fontWeight: "700" },
  measureData: { width: 72, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6, fontSize: 11, fontWeight: "700", textAlign: "center" },
  measureRefer: { width: 56, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6, fontSize: 11, fontWeight: "700", textAlign: "center" },
  referCell: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  referCellText: { fontSize: 10, fontWeight: "800" },
  refDropdown: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6, marginTop: 2, marginBottom: 4 },
  refDropdownTitle: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  refSlotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  refSlot: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" },
  refSlotActive: { backgroundColor: "rgba(15,118,110,0.06)" },
  refSlotLabel: { fontSize: 8, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  refSlotValue: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  refSlotDash: { fontSize: 16, fontWeight: "900" },
  refStepHint: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  refClearBtn: { padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  refOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  refOption: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: "47%" },
  refOptionCodeWrap: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 22 },
  refOptionCode: { fontSize: 10, fontWeight: "900" },
  refBadge: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  refBadgeText: { fontSize: 7, fontWeight: "900", color: "#fff" },
  refOptionLabel: { fontSize: 10, fontWeight: "600", flex: 1 },
  measureItem: { width: 34, fontSize: 10, fontWeight: "800", textAlign: "center" },
  signedBox: { borderWidth: 2, borderRadius: 10, padding: 12, gap: 8, marginTop: 4 },
  signedRow: { flexDirection: "row", gap: 12 },
  signedField: { flex: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderStyle: "dashed" },
  addBtnText: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 16, borderTopWidth: 1 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  doneBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
});
