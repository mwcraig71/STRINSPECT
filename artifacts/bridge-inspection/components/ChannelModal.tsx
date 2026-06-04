import { Feather } from "@expo/vector-icons";
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

  // Which Top/Bot reference cell currently has its dropdown open.
  const [refPicker, setRefPicker] = useState<{
    section: ChannelSection;
    id: string;
    field: "topRef" | "botRef";
  } | null>(null);

  const setHeader = (field: keyof typeof d, value: string) => {
    // Structure # is globally synced (CIF + header); route through the source of truth.
    if (field === "structureNumber") {
      setStructureNumber(value);
      return;
    }
    setChannelData({ ...d, [field]: value });
  };

  // Parse a bent-stations string ("0, 25, 50") into a sorted numeric list.
  const parseBents = (raw: string): number[] =>
    raw
      .split(/[,\s]+/)
      .map((s) => parseFloat(s))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

  // Distance from the last bent at or before the given station (Total Horizontal Distance).
  const distFromLastBent = (totalHoriz: string, bents: number[]): string => {
    const station = parseFloat(totalHoriz);
    if (isNaN(station) || !bents.length) return "";
    let preceding: number | null = null;
    for (const b of bents) {
      if (b <= station) preceding = b;
      else break;
    }
    // No bent at or before this station → distance from last bent is undefined.
    if (preceding === null) return "";
    const dist = station - preceding;
    return Number.isInteger(dist) ? String(dist) : dist.toFixed(2);
  };

  const updateMeasure = (
    section: ChannelSection,
    id: string,
    patch: Partial<ChannelMeasurement>
  ) => {
    const bents = parseBents(d.bentStations[section]);
    setChannelData({
      ...d,
      [section]: d[section].map((m) => {
        if (m.id !== id) return m;
        const merged = { ...m, ...patch };
        // Auto-calculate Distance From Last Bent when bent stations are provided.
        if (bents.length && patch.totalHoriz !== undefined) {
          merged.distFromLastBent = distFromLastBent(merged.totalHoriz, bents);
        }
        return merged;
      }),
    });
  };

  const setBentStations = (section: ChannelSection, value: string) => {
    const bents = parseBents(value);
    setChannelData({
      ...d,
      bentStations: { ...d.bentStations, [section]: value },
      // Recompute all rows in this section against the new bent list.
      [section]: d[section].map((m) => ({
        ...m,
        distFromLastBent: bents.length
          ? distFromLastBent(m.totalHoriz, bents)
          : m.distFromLastBent,
      })),
    });
  };

  const hasBents = (section: ChannelSection): boolean =>
    parseBents(d.bentStations[section]).length > 0;

  const renderRefCell = (
    section: ChannelSection,
    m: ChannelMeasurement,
    field: "topRef" | "botRef"
  ) => {
    const open =
      refPicker?.section === section && refPicker?.id === m.id && refPicker?.field === field;
    return (
      <TouchableOpacity
        style={[
          styles.colRef,
          styles.cell,
          styles.refCell,
          { backgroundColor: c.secondary, borderColor: open ? ACCENT : c.border },
        ]}
        onPress={() =>
          setRefPicker(open ? null : { section, id: m.id, field })
        }
      >
        <Text style={[styles.refCellText, { color: m[field] ? c.foreground : c.mutedForeground }]}>
          {m[field] || "—"}
        </Text>
        <Feather name="chevron-down" size={10} color={c.mutedForeground} />
      </TouchableOpacity>
    );
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

      {/* Bent stations (optional) — enables auto-calc of Distance From Last Bent */}
      <View>
        <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
          Bent Stations (optional)
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
          value={d.bentStations[section]}
          onChangeText={(t) => setBentStations(section, t)}
          placeholder="e.g. 0, 25, 50, 75"
          placeholderTextColor={c.mutedForeground}
        />
        {hasBents(section) && (
          <Text style={[styles.hintText, { color: ACCENT }]}>
            Distance From Last Bent is auto-calculated from Total Horiz.
          </Text>
        )}
      </View>

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

      {d[section].map((m, idx) => {
        const autoDist = hasBents(section);
        return (
        <View key={m.id} style={styles.measureBlock}>
          <View style={[styles.measureRow, { borderColor: c.border }]}>
            <Text style={[styles.colNo, styles.rowNo, { color: c.mutedForeground }]}>{idx + 1}</Text>
            {renderRefCell(section, m, "topRef")}
            {renderRefCell(section, m, "botRef")}
            <TextInput
              style={[styles.colNum, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.totalHoriz}
              onChangeText={(t) => updateMeasure(section, m.id, { totalHoriz: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
              keyboardType="numeric"
            />
            <TextInput
              style={[
                styles.colNum,
                styles.cell,
                { backgroundColor: autoDist ? c.muted : c.secondary, borderColor: c.border, color: autoDist ? c.mutedForeground : c.foreground },
              ]}
              value={m.distFromLastBent}
              onChangeText={(t) => updateMeasure(section, m.id, { distFromLastBent: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
              keyboardType="numeric"
              editable={!autoDist}
            />
            <TextInput
              style={[styles.colNum, styles.cell, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={m.vertDist}
              onChangeText={(t) => updateMeasure(section, m.id, { vertDist: t })}
              placeholder="—"
              placeholderTextColor={c.mutedForeground}
              keyboardType="numeric"
            />
            <TouchableOpacity
              onPress={() => removeChannelMeasurement(section, m.id)}
              style={styles.colDel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>

          {/* Reference dropdown (opens under the row) */}
          {refPicker && refPicker.section === section && refPicker.id === m.id && (
            <View style={[styles.refDropdown, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.refDropdownTitle, { color: c.mutedForeground }]}>
                {refPicker.field === "topRef" ? "Top Reference" : "Bottom Reference"}
              </Text>
              <View style={styles.refOptions}>
                {CHANNEL_REFERENCE_FEATURES.map((r) => {
                  const selected = m[refPicker.field] === r.code;
                  return (
                    <TouchableOpacity
                      key={r.code}
                      style={[
                        styles.refOption,
                        { borderColor: c.border },
                        selected && { backgroundColor: ACCENT, borderColor: ACCENT },
                      ]}
                      onPress={() => {
                        updateMeasure(section, m.id, { [refPicker.field]: r.code });
                        setRefPicker(null);
                      }}
                    >
                      <Text style={[styles.refOptionCode, { color: selected ? "#fff" : ACCENT }]}>{r.code}</Text>
                      <Text style={[styles.refOptionLabel, { color: selected ? "#fff" : c.foreground }]} numberOfLines={1}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TextInput
            style={[styles.notesInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
            value={m.notes}
            onChangeText={(t) => updateMeasure(section, m.id, { notes: t })}
            placeholder="Notes…"
            placeholderTextColor={c.mutedForeground}
          />
        </View>
        );
      })}

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
  refCell: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 1 },
  refCellText: { fontSize: 11, fontWeight: "800" },
  refDropdown: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6, marginTop: 2 },
  refDropdownTitle: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  refOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  refOption: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: "47%" },
  refOptionCode: { fontSize: 10, fontWeight: "900", minWidth: 20 },
  refOptionLabel: { fontSize: 10, fontWeight: "600", flex: 1 },
  hintText: { fontSize: 9, fontWeight: "700", marginTop: 4, fontStyle: "italic" },
  notesInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  commentsInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600", minHeight: 70 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed" },
  addBtnText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 16, borderTopWidth: 1 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  doneBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
});
