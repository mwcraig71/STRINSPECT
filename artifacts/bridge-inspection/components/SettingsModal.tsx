import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  INSPECTION_TYPES,
  NOMENCLATURES,
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
    simulateLegacyImport,
    parsingActive,
  } = useInspection();

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

        <View style={styles.body}>
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

          {/* Import */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="upload" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Legacy Data Import</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Import previous inspection records for verification. Imported defects appear in the legacy manifest and require confirmation before being promoted.
            </Text>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: parsingActive ? c.muted : c.headerBg, borderColor: "#334155" }]}
              onPress={() => {
                simulateLegacyImport();
                onClose();
              }}
              disabled={parsingActive}
            >
              <Feather name={parsingActive ? "loader" : "upload"} size={16} color={parsingActive ? c.mutedForeground : "#38bdf8"} />
              <Text style={[styles.importBtnText, { color: parsingActive ? c.mutedForeground : "#f8fafc" }]}>
                {parsingActive ? "Parsing..." : "Import Previous Report"}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#f8fafc", letterSpacing: -0.3, textTransform: "uppercase" },
  closeBtn: { padding: 8, borderRadius: 16 },
  body: { padding: 16, gap: 14 },
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
