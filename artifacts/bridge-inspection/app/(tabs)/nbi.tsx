import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getConditionQuantities, useInspection } from "@/context/InspectionContext";
import { SettingsModal } from "@/components/SettingsModal";
import { SpeechToTextButton } from "@/components/SpeechToTextButton";

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
  const insets = useSafeAreaInsets();
  const {
    nbiRatings,
    updateSubComponent,
    reviewImportedSubComponent,
    savedDefects,
    importSummary,
    isSnbiFormat,
  } = useInspection();

  const blankSectionItems = React.useMemo(
    () => new Set((importSummary?.emptySections ?? []).map((s) => s.item)),
    [importSummary]
  );
  const [activeItem, setActiveItem] = useState("58");

  const { focus, focusTs } = useLocalSearchParams<{ focus?: string; focusTs?: string }>();
  const handledFocusRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    // focusTs is a per-tap nonce; apply each deep-link exactly once so later
    // rating edits don't re-snap the user back to the originally focused item.
    const nonce = focusTs ?? focus;
    if (!focus || !nonce || handledFocusRef.current === nonce) return;
    if (nbiRatings.some((r) => r.item === focus)) {
      setActiveItem(focus);
      handledFocusRef.current = nonce;
    }
  }, [focus, focusTs, nbiRatings]);

  const [expandedComp, setExpandedComp] = useState<number | null>(null);
  const [ratingPickerOpen, setRatingPickerOpen] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeNbi = nbiRatings.find((r) => r.item === activeItem);
  const activeIdx = nbiRatings.findIndex((r) => r.item === activeItem);

  const getAssociatedDefects = (snbiIds: string[]) => {
    return savedDefects.filter((d) => snbiIds.includes(d.elementId));
  };


  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Slim Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitle}>
            <Feather name="bar-chart-2" size={16} color="#38bdf8" />
            <Text style={styles.headerTitleText}>{isSnbiFormat ? "SNBI Ratings" : "NBI Ratings"}</Text>
          </View>
          <TouchableOpacity style={[styles.gearBtn, { backgroundColor: "#1e293b" }]} onPress={() => setSettingsOpen(true)}>
            <Feather name="settings" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Tab strip */}
      <View style={[styles.tabStrip, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStripContent}>
          {nbiRatings.map((item) => {
            const isBlankImport = blankSectionItems.has(item.item);
            return (
              <TouchableOpacity
                key={item.item}
                style={[
                  styles.tab,
                  activeItem === item.item
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.background, borderColor: c.border },
                  isBlankImport && activeItem !== item.item && { borderColor: "#f59e0b" },
                ]}
                onPress={() => {
                  setActiveItem(item.item);
                  setExpandedComp(null);
                  setRatingPickerOpen(null);
                }}
              >
                {isBlankImport && (
                  <View style={styles.blankDot}>
                    <Feather name="alert-triangle" size={9} color="#fff" />
                  </View>
                )}
                <Text style={[styles.tabText, { color: activeItem === item.item ? "#fff" : c.mutedForeground }]}>
                  {isSnbiFormat ? `B.C.${item.item.replace("BC", "")}` : `Item ${item.item}`}
                </Text>
                <Text style={[styles.tabSub, { color: activeItem === item.item ? "rgba(255,255,255,0.8)" : c.mutedForeground }]}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {activeNbi && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.cardHeader, { backgroundColor: c.headerBg }]}>
              <Text style={styles.cardHeaderTitle}>{activeNbi.description} Assessment</Text>
              <Text style={styles.cardHeaderItem}>{isSnbiFormat ? `B.C.${activeNbi.item.replace("BC", "")}` : `Item ${activeNbi.item}`}</Text>
            </View>

            {activeNbi.subComponents.map((comp, compIdx) => {
              const associated = getAssociatedDefects(comp.snbiIds);
              const isExpanded = expandedComp === compIdx;
              const ratingColor = RATING_COLOR(comp.rating);

              return (
                <View key={compIdx} style={styles.compContainer}>
                  {/* Previous Note from Imported Report */}
                  {comp.isImported && (
                    <View style={styles.prevNoteCard}>
                      <View style={styles.prevNoteHeader}>
                        <Feather name="file-text" size={13} color="#9a3412" />
                        <Text style={styles.prevNoteTitle}>Previous Note from Imported Report</Text>
                      </View>
                      <View style={styles.prevNoteGrid}>
                        <View style={styles.prevNoteField}>
                          <Text style={styles.prevNoteKey}>Component</Text>
                          <Text style={styles.prevNoteVal}>{comp.name}</Text>
                        </View>
                        <View style={styles.prevNoteField}>
                          <Text style={styles.prevNoteKey}>Description</Text>
                          <Text style={styles.prevNoteVal}>{comp.previousDesc || "—"}</Text>
                        </View>
                        <View style={styles.prevNoteField}>
                          <Text style={styles.prevNoteKey}>Min. Rating</Text>
                          <Text style={styles.prevNoteVal}>{comp.previousMin || "—"}</Text>
                        </View>
                        <View style={styles.prevNoteField}>
                          <Text style={styles.prevNoteKey}>Rating</Text>
                          <Text style={styles.prevNoteVal}>{comp.previousRating || "—"}</Text>
                        </View>
                        <View style={[styles.prevNoteField, { width: "100%" }]}>
                          <Text style={styles.prevNoteKey}>Comment</Text>
                          <Text style={styles.prevNoteVal}>{comp.previousComments || "—"}</Text>
                        </View>
                      </View>
                      <View style={styles.prevNoteActions}>
                        <TouchableOpacity
                          style={[styles.prevNoteBtn, { backgroundColor: "#059669" }]}
                          onPress={() => reviewImportedSubComponent(activeIdx, compIdx, "approve")}
                        >
                          <Feather name="check" size={13} color="#fff" />
                          <Text style={styles.prevNoteBtnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.prevNoteBtn, { backgroundColor: "#0284c7" }]}
                          onPress={() => reviewImportedSubComponent(activeIdx, compIdx, "modify")}
                        >
                          <Feather name="edit-2" size={13} color="#fff" />
                          <Text style={styles.prevNoteBtnText}>Modify</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.prevNoteBtn, { backgroundColor: "#dc2626" }]}
                          onPress={() => reviewImportedSubComponent(activeIdx, compIdx, "disapprove")}
                        >
                          <Feather name="x" size={13} color="#fff" />
                          <Text style={styles.prevNoteBtnText}>Disapprove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Component Header */}
                  <View style={[styles.compHeader, { backgroundColor: c.background, borderColor: comp.isImported ? "#f97316" : c.border }]}>
                    <View style={styles.compHeaderLeft}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.compName, { color: c.foreground }]}>{comp.name}</Text>
                        {comp.isImported && (
                          <View style={styles.importedBadge}>
                            <Text style={styles.importedBadgeText}>IMPORTED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.compMin, { color: c.mutedForeground }]}>Min: {comp.min}</Text>
                    </View>
                    <View style={styles.compHeaderRight}>
                      <TouchableOpacity
                        style={[styles.ratingBadge, { backgroundColor: comp.isImported ? "#f97316" : ratingColor }]}
                        onPress={() => setRatingPickerOpen(ratingPickerOpen === compIdx ? null : compIdx)}
                      >
                        <Text style={styles.ratingBadgeText}>{comp.rating || "—"}</Text>
                        <Feather name="chevron-down" size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Rating picker */}
                  {ratingPickerOpen === compIdx && (
                    <View style={[styles.ratingPicker, { backgroundColor: c.card, borderColor: c.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[styles.ratingPickerTitle, { color: c.mutedForeground }]}>Select Rating</Text>
                        {comp.isImported && (
                          <Text style={[styles.ratingPickerTitle, { color: "#f97316" }]}>⚠ Pre-filled from 2025 Report</Text>
                        )}
                      </View>
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
                              if (comp.isImported) {
                                updateSubComponent(activeIdx, compIdx, "isImported", false);
                              }
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
                    <View style={styles.narrativeLabelRow}>
                      <Text style={[styles.fieldKey, { color: c.mutedForeground }]}>Diagnostic Narrative</Text>
                      {Platform.OS !== "web" && (
                        <SpeechToTextButton
                          onResult={(text) =>
                            updateSubComponent(
                              activeIdx,
                              compIdx,
                              "comments",
                              comp.comments ? `${comp.comments} ${text}` : text
                            )
                          }
                        />
                      )}
                    </View>
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
                  {comp.previousComments && !comp.isImported ? (
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
                              {d.location} • {Object.entries(getConditionQuantities(d))
                                .filter(([, value]) => (parseFloat(value || "") || 0) > 0)
                                .map(([state, value]) => `${state} ${value}`)
                                .join(" · ")}
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
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerTitleText: { fontSize: 14, fontWeight: "900", color: "#f8fafc", letterSpacing: -0.3, textTransform: "uppercase" },
  modulePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  modulePillText: { fontSize: 9, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
  gearBtn: { padding: 8, borderRadius: 10 },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
  },
  pickerValue: { fontSize: 13, fontWeight: "700", flex: 1 },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: { fontSize: 13, fontWeight: "700" },
  tabStrip: { borderBottomWidth: 1 },
  tabStripContent: { padding: 8, gap: 6, flexDirection: "row", alignItems: "center" },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    position: "relative",
  },
  blankDot: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
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
  importedBadge: { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#f97316", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  importedBadgeText: { fontSize: 9, fontWeight: "700", color: "#f97316", textTransform: "uppercase" },
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
  narrativeLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  prevNoteCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#f97316",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  prevNoteHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  prevNoteTitle: { fontSize: 10, fontWeight: "900", color: "#9a3412", textTransform: "uppercase", letterSpacing: 0.4 },
  prevNoteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prevNoteField: { width: "48%", gap: 2 },
  prevNoteKey: { fontSize: 9, fontWeight: "800", color: "#9a3412", textTransform: "uppercase", letterSpacing: 0.3 },
  prevNoteVal: { fontSize: 12, fontWeight: "700", color: "#7c2d12" },
  prevNoteActions: { flexDirection: "row", gap: 6, marginTop: 4 },
  prevNoteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  prevNoteBtnText: { fontSize: 10, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.3 },
});
