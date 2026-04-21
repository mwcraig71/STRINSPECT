import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  INSPECTION_TYPES,
  NOMENCLATURES,
  SUBSTRUCTURE_TYPES,
  SUPERSTRUCTURE_TYPES,
  useInspection,
} from "@/context/InspectionContext";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const c = useColors();
  const {
    nomenclature,
    setNomenclature,
    inspectionType,
    setInspectionType,
    superstructureType,
    setSuperstructureType,
    substructureType,
    setSubstructureType,
    simulateLegacyImport,
    importFromPdf,
    parsingActive,
  } = useInspection();

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      onClose();
      await importFromPdf({ uri: asset.uri, name: asset.name });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not open document picker.";
      Alert.alert("Error", message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: "#1e293b" }]}>
          <View style={styles.headerLeft}>
            <Feather name="settings" size={18} color="#38bdf8" />
            <Text style={styles.headerTitle}>Inspection Settings</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: "#1e293b" }]}>
            <Feather name="x" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* State / Nomenclature */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="map-pin" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Agency Nomenclature</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Select your state DOT to apply the correct naming convention for supports and bents.
            </Text>
            <View style={styles.optionGroup}>
              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  nomenclature === NOMENCLATURES.TXDOT
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setNomenclature(NOMENCLATURES.TXDOT)}
              >
                <View style={styles.optionInner}>
                  <View style={[styles.optionIcon, { backgroundColor: nomenclature === NOMENCLATURES.TXDOT ? "rgba(255,255,255,0.2)" : c.card }]}>
                    <Text style={[styles.optionIconText, { color: nomenclature === NOMENCLATURES.TXDOT ? "#fff" : c.primary }]}>TX</Text>
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: nomenclature === NOMENCLATURES.TXDOT ? "#fff" : c.foreground }]}>Texas (TxDOT)</Text>
                    <Text style={[styles.optionSub, { color: nomenclature === NOMENCLATURES.TXDOT ? "rgba(255,255,255,0.75)" : c.mutedForeground }]}>
                      Abutment · Bent · Pile
                    </Text>
                  </View>
                  {nomenclature === NOMENCLATURES.TXDOT && (
                    <Feather name="check-circle" size={18} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  nomenclature === NOMENCLATURES.NCDOT
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setNomenclature(NOMENCLATURES.NCDOT)}
              >
                <View style={styles.optionInner}>
                  <View style={[styles.optionIcon, { backgroundColor: nomenclature === NOMENCLATURES.NCDOT ? "rgba(255,255,255,0.2)" : c.card }]}>
                    <Text style={[styles.optionIconText, { color: nomenclature === NOMENCLATURES.NCDOT ? "#fff" : c.primary }]}>NC</Text>
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: nomenclature === NOMENCLATURES.NCDOT ? "#fff" : c.foreground }]}>North Carolina (NCDOT)</Text>
                    <Text style={[styles.optionSub, { color: nomenclature === NOMENCLATURES.NCDOT ? "rgba(255,255,255,0.75)" : c.mutedForeground }]}>
                      End Bent · Bent · Pile
                    </Text>
                  </View>
                  {nomenclature === NOMENCLATURES.NCDOT && (
                    <Feather name="check-circle" size={18} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Inspection Type */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="layers" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Inspection Module</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Sets the active inspection perspective and filters available structural locations accordingly.
            </Text>
            <View style={styles.optionGroup}>
              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  inspectionType === INSPECTION_TYPES.TOPSIDE
                    ? { backgroundColor: "#0f172a", borderColor: "#38bdf8" }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setInspectionType(INSPECTION_TYPES.TOPSIDE)}
              >
                <View style={styles.optionInner}>
                  <View style={[styles.optionIcon, { backgroundColor: inspectionType === INSPECTION_TYPES.TOPSIDE ? "#1e293b" : c.card }]}>
                    <Feather name="arrow-up" size={16} color={inspectionType === INSPECTION_TYPES.TOPSIDE ? "#38bdf8" : c.mutedForeground} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: inspectionType === INSPECTION_TYPES.TOPSIDE ? "#f8fafc" : c.foreground }]}>Topside</Text>
                    <Text style={[styles.optionSub, { color: inspectionType === INSPECTION_TYPES.TOPSIDE ? "#94a3b8" : c.mutedForeground }]}>
                      Deck · Joints · Approaches
                    </Text>
                  </View>
                  {inspectionType === INSPECTION_TYPES.TOPSIDE && (
                    <Feather name="check-circle" size={18} color="#38bdf8" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  inspectionType === INSPECTION_TYPES.UNDERSIDE
                    ? { backgroundColor: "#0f172a", borderColor: "#38bdf8" }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setInspectionType(INSPECTION_TYPES.UNDERSIDE)}
              >
                <View style={styles.optionInner}>
                  <View style={[styles.optionIcon, { backgroundColor: inspectionType === INSPECTION_TYPES.UNDERSIDE ? "#1e293b" : c.card }]}>
                    <Feather name="arrow-down" size={16} color={inspectionType === INSPECTION_TYPES.UNDERSIDE ? "#38bdf8" : c.mutedForeground} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: inspectionType === INSPECTION_TYPES.UNDERSIDE ? "#f8fafc" : c.foreground }]}>Underside</Text>
                    <Text style={[styles.optionSub, { color: inspectionType === INSPECTION_TYPES.UNDERSIDE ? "#94a3b8" : c.mutedForeground }]}>
                      Superstructure · Substructure · Bearings
                    </Text>
                  </View>
                  {inspectionType === INSPECTION_TYPES.UNDERSIDE && (
                    <Feather name="check-circle" size={18} color="#38bdf8" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Structural Build */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="triangle" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Structural Build</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Define the bridge's structural composition. Combined with the current location, this filters the available elements on the Inspection tab to only those relevant to the structure type.
            </Text>

            {/* Superstructure */}
            <View style={styles.structSection}>
              <View style={styles.structLabelRow}>
                <View style={[styles.structLabelDot, { backgroundColor: "#38bdf8" }]} />
                <Text style={[styles.structLabel, { color: c.foreground }]}>Superstructure</Text>
              </View>
              <View style={styles.typeGrid}>
                {SUPERSTRUCTURE_TYPES.map((t) => {
                  const active = superstructureType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: active ? "#0f172a" : c.secondary,
                          borderColor: active ? "#38bdf8" : c.border,
                        },
                      ]}
                      onPress={() => setSuperstructureType(t.id)}
                    >
                      <Text style={[styles.typeChipLabel, { color: active ? "#f8fafc" : c.foreground }]}>
                        {t.label}
                      </Text>
                      <Text style={[styles.typeChipSub, { color: active ? "#94a3b8" : c.mutedForeground }]}>
                        {t.sub}
                      </Text>
                      {active && (
                        <View style={styles.typeChipCheck}>
                          <Feather name="check" size={11} color="#38bdf8" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.structDivider, { borderTopColor: c.border }]} />

            {/* Substructure */}
            <View style={styles.structSection}>
              <View style={styles.structLabelRow}>
                <View style={[styles.structLabelDot, { backgroundColor: "#a78bfa" }]} />
                <Text style={[styles.structLabel, { color: c.foreground }]}>Substructure</Text>
              </View>
              <View style={styles.typeGrid}>
                {SUBSTRUCTURE_TYPES.map((t) => {
                  const active = substructureType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: active ? "#1a0f2e" : c.secondary,
                          borderColor: active ? "#a78bfa" : c.border,
                        },
                      ]}
                      onPress={() => setSubstructureType(t.id)}
                    >
                      <Text style={[styles.typeChipLabel, { color: active ? "#f8fafc" : c.foreground }]}>
                        {t.label}
                      </Text>
                      <Text style={[styles.typeChipSub, { color: active ? "#c4b5fd" : c.mutedForeground }]}>
                        {t.sub}
                      </Text>
                      {active && (
                        <View style={[styles.typeChipCheck, { backgroundColor: "rgba(167,139,250,0.15)" }]}>
                          <Feather name="check" size={11} color="#a78bfa" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Active summary pill */}
            <View style={[styles.buildSummary, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <View style={styles.buildSummaryItem}>
                <Text style={[styles.buildSummaryLabel, { color: c.mutedForeground }]}>Super</Text>
                <Text style={[styles.buildSummaryValue, { color: "#38bdf8" }]}>
                  {SUPERSTRUCTURE_TYPES.find((t) => t.id === superstructureType)?.label ?? "—"}
                </Text>
              </View>
              <View style={[styles.buildSummaryDivider, { backgroundColor: c.border }]} />
              <View style={styles.buildSummaryItem}>
                <Text style={[styles.buildSummaryLabel, { color: c.mutedForeground }]}>Sub</Text>
                <Text style={[styles.buildSummaryValue, { color: "#a78bfa" }]}>
                  {SUBSTRUCTURE_TYPES.find((t) => t.id === substructureType)?.label ?? "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* Import */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="upload" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Previous Report Import</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Select a TxDOT bridge inspection PDF to extract ELEMENTS table data, NBI ratings, and the structure number. Imported defects appear in the legacy manifest and require verification.
            </Text>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: parsingActive ? c.muted : c.headerBg, borderColor: "#334155" }]}
              onPress={handleImport}
              disabled={parsingActive}
            >
              <Feather name={parsingActive ? "loader" : "file-text"} size={16} color={parsingActive ? c.mutedForeground : "#38bdf8"} />
              <Text style={[styles.importBtnText, { color: parsingActive ? c.mutedForeground : "#f8fafc" }]}>
                {parsingActive ? "Parsing PDF..." : "Import Previous Report (PDF)"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#f8fafc", letterSpacing: -0.3, textTransform: "uppercase" },
  closeBtn: { padding: 8, borderRadius: 16 },
  scroll: { flex: 1 },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: "800", textTransform: "uppercase" },
  cardDesc: { fontSize: 12, fontWeight: "500", lineHeight: 17 },
  optionGroup: { gap: 8 },
  optionBtn: { borderRadius: 12, borderWidth: 1.5, padding: 12 },
  optionInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optionIconText: { fontSize: 13, fontWeight: "900" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: "800" },
  optionSub: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  // Structural build
  structSection: { gap: 8 },
  structLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  structLabelDot: { width: 8, height: 8, borderRadius: 4 },
  structLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  typeGrid: { gap: 6 },
  typeChip: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  typeChipLabel: { fontSize: 13, fontWeight: "700", flex: 1 },
  typeChipSub: { fontSize: 10, fontWeight: "500", flex: 1, textAlign: "right", marginRight: 6 },
  typeChipCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(56,189,248,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  structDivider: { borderTopWidth: 1, marginVertical: 2 },
  buildSummary: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    padding: 10,
    gap: 0,
  },
  buildSummaryItem: { flex: 1, gap: 2 },
  buildSummaryLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  buildSummaryValue: { fontSize: 12, fontWeight: "800" },
  buildSummaryDivider: { width: 1, marginHorizontal: 10 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  importBtnText: { fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
});
