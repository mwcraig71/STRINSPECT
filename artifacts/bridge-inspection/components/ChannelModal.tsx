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
  CHANNEL_REFERENCE_FEATURES,
  ChannelMeasurement,
  ChannelSection,
  useInspection,
} from "@/context/InspectionContext";

const ACCENT = "#0369a1";

export function ChannelModal() {
  const c = useColors();
  const {
    showChannelModal,
    setShowChannelModal,
    channelData,
    setChannelData,
    addChannelMeasurement,
    removeChannelMeasurement,
    setStructureNumber,
  } = useInspection();

  const d = channelData;

  const setHeader = (field: keyof typeof d, value: string) => {
    // Structure # is globally synced (CIF + header); route through the source of truth.
    if (field === "structureNumber") {
      setStructureNumber(value);
      return;
    }
    setChannelData({ ...d, [field]: value });
  };

  const updateMeasure = (
    section: ChannelSection,
    id: string,
    patch: Partial<ChannelMeasurement>
  ) => {
    setChannelData({
      ...d,
      [section]: d[section].map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  const headerFields: { key: keyof typeof d; label: string; placeholder: string }[] = [
    { key: "district", label: "District", placeholder: "02" },
    { key: "county", label: "County", placeholder: "220" },
    { key: "controlSection", label: "Control - Section", placeholder: "0747 - 04" },
    { key: "structureNumber", label: "Structure #", placeholder: "046" },
    { key: "route", label: "Route", placeholder: "FM-157" },
    { key: "featureCrossed", label: "Feature Crossed", placeholder: "Clear Creek" },
    { key: "company", label: "Company Name & No.", placeholder: "Strinteg Corporation [F-20066]" },
    { key: "inspectionDate", label: "Date", placeholder: "MM/DD/YYYY" },
  ];

  const renderSection = (section: ChannelSection, title: string) => (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: ACCENT }]}>{title}</Text>

      {/* Column header */}
      <View style={styles.measureHeaderRow}>
        <Text style={[styles.colNo, styles.headTxt, { color: c.mutedForeground }]}>#</Text>
        <Text style={[styles.colRef, styles.headTxt, { color: c.mutedForeground }]}>Top Ref.</Text>
        <Text style={[styles.colRef, styles.headTxt, { color: c.mutedForeground }]}>Bot. Ref.</Text>
        <Text style={[styles.colNum, styles.headTxt, { color: c.mutedForeground }]}>Total Horiz.</Text>
        <Text style={[styles.colNum, styles.headTxt, { color: c.mutedForeground }]}>Dist. Last Bent</Text>
        <Text style={[styles.colNum, styles.headTxt, { color: c.mutedForeground }]}>Vert. Dist.</Text>
        <View style={styles.colDel} />
      </View>

      {d[section].map((m, idx) => (
        <View key={m.id} style={styles.measureBlock}>
          <View style={[styles.measureRow, { borderColor: c.border }]}>
            <Text style={[styles.colNo, styles.rowNo, { color: c.mutedForeground }]}>{idx + 1}</Text>
            <TextInput
              style={[styles.colRef, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.topRef}
              onChangeText={(t) => updateMeasure(section, m.id, { topRef: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="characters"
            />
            <TextInput
              style={[styles.colRef, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.botRef}
              onChangeText={(t) => updateMeasure(section, m.id, { botRef: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="characters"
            />
            <TextInput
              style={[styles.colNum, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.totalHoriz}
              onChangeText={(t) => updateMeasure(section, m.id, { totalHoriz: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
            />
            <TextInput
              style={[styles.colNum, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.distFromLastBent}
              onChangeText={(t) => updateMeasure(section, m.id, { distFromLastBent: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
            />
            <TextInput
              style={[styles.colNum, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.vertDist}
              onChangeText={(t) => updateMeasure(section, m.id, { vertDist: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
            />
            <TouchableOpacity
              onPress={() => removeChannelMeasurement(section, m.id)}
              style={styles.colDel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.notesInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
            value={m.notes}
            onChangeText={(t) => updateMeasure(section, m.id, { notes: t })}
            placeholder="Notes…"
            placeholderTextColor={c.mutedForeground}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addBtn, { borderColor: ACCENT }]}
        onPress={() => addChannelMeasurement(section)}
      >
        <Feather name="plus" size={16} color={ACCENT} />
        <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Measurement</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={showChannelModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowChannelModal(false)}
    >
      <View style={[styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: ACCENT }]}>
          <View style={styles.headerLeft}>
            <Feather name="activity" size={26} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Channel Cross-Section</Text>
              <Text style={styles.headerSubtitle}>TxDOT Form 2600</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowChannelModal(false)}
            style={styles.closeBtn}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Record information */}
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
              {CHANNEL_REFERENCE_FEATURES.map((r) => (
                <View key={r.code} style={styles.legendItem}>
                  <View style={[styles.legendBadge, { backgroundColor: ACCENT }]}>
                    <Text style={styles.legendBadgeText}>{r.code}</Text>
                  </View>
                  <Text style={[styles.legendLabel, { color: c.mutedForeground }]}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {renderSection("upstream", "Upstream")}
          {renderSection("downstream", "Downstream")}

          {/* Comments */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Comments</Text>
            <TextInput
              style={[styles.commentsInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={d.comments}
              onChangeText={(t) => setHeader("comments", t)}
              placeholder="Record any important comments…"
              placeholderTextColor={c.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: ACCENT }]}
            onPress={() => setShowChannelModal(false)}
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
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5, width: "47%" },
  legendBadge: { minWidth: 24, height: 18, paddingHorizontal: 3, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  legendBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff" },
  legendLabel: { fontSize: 10, fontWeight: "600", flex: 1 },
  measureHeaderRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  headTxt: { fontSize: 7, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  measureBlock: { gap: 4 },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  colNo: { width: 16, textAlign: "center" },
  rowNo: { fontSize: 10, fontWeight: "800" },
  colRef: { flex: 1, minWidth: 0 },
  colNum: { flex: 1.1, minWidth: 0 },
  colDel: { width: 22, alignItems: "center", justifyContent: "center" },
  cell: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 2, paddingVertical: 6, fontSize: 11, fontWeight: "700", textAlign: "center", width: "100%" },
  notesInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  commentsInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600", minHeight: 70 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed" },
  addBtnText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 16, borderTopWidth: 1 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  doneBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
});
