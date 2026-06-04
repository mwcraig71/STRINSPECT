import { Feather } from "@expo/vector-icons";
import React from "react";
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
import {
  UC_MEASURE_ROWS,
  UC_REFERENCE_FEATURES,
  UcMeasure,
  UnderclearanceEntry,
  useInspection,
} from "@/context/InspectionContext";

export function UnderclearanceModal() {
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

  const setHeader = (field: keyof typeof d, value: string) => {
    // Structure # is globally synced (CIF + header); route through the source of truth.
    if (field === "structureNumber") {
      setStructureNumber(value);
      return;
    }
    setUnderclearanceData({ ...d, [field]: value });
  };

  const updateEntry = (id: string, patch: Partial<UnderclearanceEntry>) => {
    setUnderclearanceData({
      ...d,
      entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const updateMeasure = (
    id: string,
    key: "rightLateral" | "leftLateral" | "totalHorizontal" | "maxPracticalVert" | "minMeasuredVert",
    patch: Partial<UcMeasure>
  ) => {
    const entry = d.entries.find((e) => e.id === id);
    if (!entry) return;
    updateEntry(id, { [key]: { ...entry[key], ...patch } });
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

  return (
    <Modal
      visible={showUnderclearanceModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowUnderclearanceModal(false)}
    >
      <View style={[styles.container, { backgroundColor: c.background }]}>
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

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
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
          {d.entries.map((entry, idx) => (
            <View key={entry.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.entryHeader}>
                <Text style={[styles.cardTitle, { color: "#0f766e" }]}>
                  Feature Crossed #{idx + 1}
                </Text>
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
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
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
                return (
                  <View key={row.key} style={[styles.measureRow, { borderColor: c.border }]}>
                    <Text style={[styles.measureLabel, { color: c.foreground }]} numberOfLines={2}>
                      {row.label}
                    </Text>
                    <TextInput
                      style={[styles.measureData, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                      value={m.data}
                      onChangeText={(t) => updateMeasure(entry.id, row.key, { data: t })}
                      placeholder="—"
                      placeholderTextColor={c.mutedForeground}
                    />
                    <TextInput
                      style={[styles.measureRefer, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                      value={m.refer}
                      onChangeText={(t) => updateMeasure(entry.id, row.key, { refer: t })}
                      placeholder="A-N"
                      placeholderTextColor={c.mutedForeground}
                      autoCapitalize="characters"
                    />
                    <Text style={[styles.measureItem, { color: c.mutedForeground }]}>{row.itemNo}</Text>
                  </View>
                );
              })}

              {/* Signed Vertical Clearance + tolerance */}
              <View style={[styles.signedBox, { borderColor: "#0f766e", backgroundColor: c.secondary }]}>
                <Text style={[styles.fieldLabel, { color: "#0f766e" }]}>Signed Vertical Clr</Text>
                <View style={styles.signedRow}>
                  <View style={styles.signedField}>
                    <Text style={[styles.fieldSubLabel, { color: c.mutedForeground }]}>Field Data</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      value={entry.signedVertData}
                      onChangeText={(t) => updateEntry(entry.id, { signedVertData: t })}
                      placeholder={"17'10\""}
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>
                  <View style={styles.signedField}>
                    <Text style={[styles.fieldSubLabel, { color: c.mutedForeground }]}>Tolerance</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      value={entry.signedVertTolerance}
                      onChangeText={(t) => updateEntry(entry.id, { signedVertTolerance: t })}
                      placeholder={"1'4\""}
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addBtn, { borderColor: "#0f766e" }]}
            onPress={addUnderclearanceEntry}
          >
            <Feather name="plus" size={16} color="#0f766e" />
            <Text style={[styles.addBtnText, { color: "#0f766e" }]}>Add Feature Crossed</Text>
          </TouchableOpacity>

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
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
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
  entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  removeBtn: { padding: 4 },
  measureHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  measureHeadLabel: { flex: 1, fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  measureHeadData: { width: 72, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureHeadRefer: { width: 48, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureHeadItem: { width: 34, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  measureLabel: { flex: 1, fontSize: 11, fontWeight: "700" },
  measureData: { width: 72, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6, fontSize: 11, fontWeight: "700", textAlign: "center" },
  measureRefer: { width: 48, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6, fontSize: 11, fontWeight: "700", textAlign: "center" },
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
