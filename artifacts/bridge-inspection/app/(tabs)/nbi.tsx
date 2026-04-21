import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useInspection, SNBI_ELEMENTS, NOMENCLATURES, INSPECTION_TYPES } from "@/context/InspectionContext";

const RATING_OPTIONS = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0", "N", "-"];

const RATING_COLOR = (rating: string): string => {
  const n = parseInt(rating);
  if (isNaN(n)) return "#64748b";
  if (n >= 7) return "#059669";
  if (n >= 5) return "#0284c7";
  if (n >= 3) return "#d97706";
  return "#dc2626";
};

export default function NBIScreen() {
  const c = useColors();
  const {
    nbiRatings,
    updateSubComponent,
    savedDefects,
    nomenclature,
    setNomenclature,
    inspectionType,
    setInspectionType,
  } = useInspection();
  const [activeItem, setActiveItem] = useState("58");
  const [expandedComp, setExpandedComp] = useState<number | null>(null);
  const [ratingPickerOpen, setRatingPickerOpen] = useState<number | null>(null);

  const activeNbi = nbiRatings.find((r) => r.item === activeItem);
  const activeIdx = nbiRatings.findIndex((r) => r.item === activeItem);

  const getAssociatedDefects = (snbiIds: string[]) => {
    return savedDefects.filter((d) => snbiIds.includes(d.elementId));
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerInner}>
            <Feather name="bar-chart-2" size={20} color="#38bdf8" />
            <Text style={styles.headerTitle}>NBI Ratings</Text>
          </View>
          <View style={styles.headerControls}>
            <View style={[styles.nomToggle, { backgroundColor: "#1e293b" }]}>
              <TouchableOpacity
                style={[styles.nomBtn, nomenclature === NOMENCLATURES.TXDOT && styles.nomBtnActive]}
                onPress={() => setNomenclature(NOMENCLATURES.TXDOT)}
              >
                <Text style={[styles.nomBtnText, nomenclature === NOMENCLATURES.TXDOT && styles.nomBtnTextActive]}>TX</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nomBtn, nomenclature === NOMENCLATURES.NCDOT && styles.nomBtnActive]}
                onPress={() => setNomenclature(NOMENCLATURES.NCDOT)}
              >
                <Text style={[styles.nomBtnText, nomenclature === NOMENCLATURES.NCDOT && styles.nomBtnTextActive]}>NC</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.moduleToggle,
            inspectionType === INSPECTION_TYPES.TOPSIDE
              ? { backgroundColor: "#0284c7", borderColor: "#0ea5e9" }
              : { backgroundColor: "#1e293b", borderColor: "#334155" },
          ]}
          onPress={() => setInspectionType(inspectionType === INSPECTION_TYPES.TOPSIDE ? INSPECTION_TYPES.UNDERSIDE : INSPECTION_TYPES.TOPSIDE)}
        >
          <Feather name="refresh-cw" size={14} color={inspectionType === INSPECTION_TYPES.TOPSIDE ? "#fff" : "#38bdf8"} />
          <Text style={[styles.moduleToggleText, { color: inspectionType === INSPECTION_TYPES.TOPSIDE ? "#fff" : "#38bdf8" }]}>
            Active Module: {inspectionType}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab strip */}
      <View style={[styles.tabStrip, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStripContent}>
          {nbiRatings.map((item) => (
            <TouchableOpacity
              key={item.item}
              style={[
                styles.tab,
                activeItem === item.item
                  ? { backgroundColor: c.primary, borderColor: c.primary }
                  : { backgroundColor: c.background, borderColor: c.border },
              ]}
              onPress={() => {
                setActiveItem(item.item);
                setExpandedComp(null);
                setRatingPickerOpen(null);
              }}
            >
              <Text style={[styles.tabText, { color: activeItem === item.item ? "#fff" : c.mutedForeground }]}>
                Item {item.item}
              </Text>
              <Text style={[styles.tabSub, { color: activeItem === item.item ? "rgba(255,255,255,0.8)" : c.mutedForeground }]}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {activeNbi && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.cardHeader, { backgroundColor: c.headerBg }]}>
              <Text style={styles.cardHeaderTitle}>{activeNbi.description} Assessment</Text>
              <Text style={styles.cardHeaderItem}>Item {activeNbi.item}</Text>
            </View>

            {activeNbi.subComponents.map((comp, compIdx) => {
              const associated = getAssociatedDefects(comp.snbiIds);
              const isExpanded = expandedComp === compIdx;
              const ratingColor = RATING_COLOR(comp.rating);

              return (
                <View key={compIdx} style={styles.compContainer}>
                  {/* Component Header */}
                  <View style={[styles.compHeader, { backgroundColor: c.background, borderColor: c.border }]}>
                    <View style={styles.compHeaderLeft}>
                      <Text style={[styles.compName, { color: c.foreground }]}>{comp.name}</Text>
                      <Text style={[styles.compMin, { color: c.mutedForeground }]}>Min: {comp.min}</Text>
                    </View>
                    <View style={styles.compHeaderRight}>
                      <TouchableOpacity
                        style={[styles.ratingBadge, { backgroundColor: ratingColor }]}
                        onPress={() => setRatingPickerOpen(ratingPickerOpen === compIdx ? null : compIdx)}
                      >
                        <Text style={styles.ratingBadgeText}>{comp.rating}</Text>
                        <Feather name="chevron-down" size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Rating picker */}
                  {ratingPickerOpen === compIdx && (
                    <View style={[styles.ratingPicker, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={[styles.ratingPickerTitle, { color: c.mutedForeground }]}>Select Rating</Text>
                      <View style={styles.ratingGrid}>
                        {RATING_OPTIONS.map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[
                              styles.ratingOption,
                              { borderColor: c.border },
                              comp.rating === r && { backgroundColor: RATING_COLOR(r), borderColor: RATING_COLOR(r) },
                            ]}
                            onPress={() => {
                              updateSubComponent(activeIdx, compIdx, "rating", r);
                              setRatingPickerOpen(null);
                            }}
                          >
                            <Text style={[styles.ratingOptionText, { color: comp.rating === r ? "#fff" : RATING_COLOR(r) }]}>
                              {r}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Spec/material */}
                  <View style={[styles.fieldRow, { borderColor: c.border }]}>
                    <Text style={[styles.fieldKey, { color: c.mutedForeground }]}>Spec / Material</Text>
                    <TextInput
                      style={[styles.inlineInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                      value={comp.desc}
                      onChangeText={(t) => updateSubComponent(activeIdx, compIdx, "desc", t)}
                      placeholder="Enter spec..."
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>

                  {/* Min rating */}
                  <View style={[styles.fieldRow, { borderColor: c.border }]}>
                    <Text style={[styles.fieldKey, { color: c.mutedForeground }]}>Min. Rating</Text>
                    <TextInput
                      style={[styles.inlineInputSmall, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                      value={comp.min}
                      onChangeText={(t) => updateSubComponent(activeIdx, compIdx, "min", t)}
                      placeholder="Min"
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>

                  {/* Diagnostic narrative */}
                  <View style={styles.narrativeRow}>
                    <Text style={[styles.fieldKey, { color: c.mutedForeground }]}>Diagnostic Narrative</Text>
                    <TextInput
                      style={[styles.narrativeInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                      value={comp.comments}
                      onChangeText={(t) => updateSubComponent(activeIdx, compIdx, "comments", t)}
                      multiline
                      numberOfLines={3}
                      placeholder="Enter observations..."
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>

                  {/* Previous comments */}
                  {comp.previousComments ? (
                    <View style={[styles.prevComments, { backgroundColor: c.secondary, borderColor: c.border }]}>
                      <Text style={[styles.prevCommentsLabel, { color: c.mutedForeground }]}>Previous Report</Text>
                      <Text style={[styles.prevCommentsText, { color: c.mutedForeground }]}>{comp.previousComments}</Text>
                    </View>
                  ) : null}

                  {/* Linked defects */}
                  {comp.snbiIds.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.linkedBtn,
                        associated.length > 0
                          ? { backgroundColor: c.primary + "20", borderColor: c.primary }
                          : { backgroundColor: c.secondary, borderColor: c.border },
                      ]}
                      onPress={() => setExpandedComp(isExpanded ? null : compIdx)}
                    >
                      <Feather
                        name={isExpanded ? "chevron-up" : "arrow-down-circle"}
                        size={16}
                        color={associated.length > 0 ? c.primary : c.mutedForeground}
                      />
                      <Text style={[styles.linkedBtnText, { color: associated.length > 0 ? c.primary : c.mutedForeground }]}>
                        {associated.length > 0
                          ? `${associated.length} Linked Defect${associated.length !== 1 ? "s" : ""}`
                          : "No Linked Defects"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isExpanded && associated.length > 0 && (
                    <View style={[styles.linkedList, { backgroundColor: c.background, borderColor: c.border }]}>
                      <View style={styles.linkedListHeader}>
                        <Feather name="zap" size={12} color={c.primary} />
                        <Text style={[styles.linkedListTitle, { color: c.primary }]}>Cataloged SNBI Defect Logs</Text>
                      </View>
                      {associated.map((d) => (
                        <View key={d.id} style={[styles.linkedDefect, { backgroundColor: c.card, borderColor: c.border }]}>
                          <View style={styles.linkedDefectLeft}>
                            <Text style={[styles.linkedDefectLoc, { color: c.primary }]}>
                              {d.location} • CS {d.cs}
                            </Text>
                            <Text style={[styles.linkedDefectName, { color: c.foreground }]}>
                              {d.element}: {d.defect}
                            </Text>
                          </View>
                          <Text style={[styles.linkedDefectQty, { color: c.mutedForeground }]}>{d.quantity}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "web" ? 67 : 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 },
  headerControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#f8fafc", textTransform: "uppercase" },
  nomToggle: { flexDirection: "row", borderRadius: 8, padding: 3, gap: 2 },
  nomBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  nomBtnActive: { backgroundColor: "#0284c7" },
  nomBtnText: { fontSize: 11, fontWeight: "900", color: "#64748b" },
  nomBtnTextActive: { color: "#fff" },
  moduleToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  moduleToggleText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  tabStrip: {
    borderBottomWidth: 1,
  },
  tabStripContent: { padding: 8, gap: 6 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  tabText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  tabSub: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  cardHeaderTitle: { fontSize: 14, fontWeight: "900", color: "#f8fafc", textTransform: "uppercase" },
  cardHeaderItem: { fontSize: 14, fontWeight: "900", color: "#38bdf8" },
  compContainer: { borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 14, gap: 10 },
  compHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1 },
  compHeaderLeft: { flex: 1, gap: 2 },
  compHeaderRight: {},
  compName: { fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  compMin: { fontSize: 10, fontWeight: "600" },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  ratingBadgeText: { fontSize: 20, fontWeight: "900", color: "#fff" },
  ratingPicker: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  ratingPickerTitle: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  ratingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ratingOption: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ratingOptionText: { fontSize: 16, fontWeight: "900" },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1 },
  fieldKey: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", width: 100 },
  inlineInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 12, fontWeight: "600" },
  inlineInputSmall: { width: 60, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 12, fontWeight: "700", textAlign: "center" },
  narrativeRow: { gap: 6 },
  narrativeInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    fontWeight: "600",
    minHeight: 70,
    textAlignVertical: "top",
  },
  prevComments: { padding: 10, borderRadius: 8, borderWidth: 1, gap: 4 },
  prevCommentsLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  prevCommentsText: { fontSize: 11, fontStyle: "italic" },
  linkedBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  linkedBtnText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  linkedList: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 8 },
  linkedListHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  linkedListTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  linkedDefect: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 8, borderWidth: 1 },
  linkedDefectLeft: { flex: 1, gap: 2 },
  linkedDefectLoc: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  linkedDefectName: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  linkedDefectQty: { fontSize: 11, fontWeight: "700" },
});
