import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Asset } from "expo-asset";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useInspection } from "@/context/InspectionContext";
import { useListSessions, getListSessionsQueryKey } from "@workspace/api-client-react";
import PDFAnnotatorModal from "@/components/PDFAnnotatorModal";

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function BridgesScreen() {
  const c = useColors();
  const {
    structureNumber,
    setStructureNumber,
    savedDefects,
    lastModified,
    lastSynced,
    hasUnsyncedChanges,
    syncSession,
    clearInspection,
    importedPdfPath,
    pdfAnnotations,
    setPdfAnnotations,
    importFromPdf,
    parsingActive,
  } = useInspection();

  const [submitStatus, setSubmitStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [newBridgeVisible, setNewBridgeVisible] = useState(false);
  const [newBridgeDraft, setNewBridgeDraft] = useState("");
  const [annotatorOpen, setAnnotatorOpen] = useState(false);

  const handleImportPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      await importFromPdf({ uri: asset.uri, name: asset.name });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not open document picker.";
      Alert.alert("Error", message);
    }
  };

  const handleLoadSampleReport = async () => {
    try {
      const module = require("@/assets/docs/sample-inspection-report.pdf");
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      if (!asset.localUri) {
        Alert.alert("Error", "Could not load sample report from device storage.");
        return;
      }
      await importFromPdf({ uri: asset.localUri, name: "18-061-0081-13-133_RTInsp_2025-02.pdf" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not load sample report.";
      Alert.alert("Error", message);
    }
  };

  const {
    data: sessions,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useListSessions({ query: { queryKey: getListSessionsQueryKey(), refetchInterval: 30_000 } });

  const hasActiveSession = !!(structureNumber || savedDefects.length > 0);

  const handleSubmit = async () => {
    if (submitStatus === "syncing") return;
    if (!structureNumber) {
      Alert.alert("Missing Info", "Please set a structure number before submitting.\n\nTap the structure number in the Inspection tab header to enter it.");
      return;
    }
    setSubmitStatus("syncing");
    try {
      const result = await syncSession();
      if (result === "queued") {
        setSubmitStatus("idle");
        Alert.alert(
          "Saved — Waiting for Connection",
          "Your inspection is saved locally and queued for upload. It will sync automatically as soon as you have internet access.",
          [{ text: "OK" }]
        );
      } else {
        setSubmitStatus("success");
        setTimeout(() => setSubmitStatus("idle"), 4000);
        refetch();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      Alert.alert("Submit Failed", msg);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 3000);
    }
  };

  const openNewBridgeFlow = () => {
    if (Platform.OS === "ios") {
      const doPrompt = () => {
        Alert.prompt(
          "New Bridge",
          "Enter the structure number for the new bridge",
          (text) => {
            if (text === undefined) return;
            clearInspection();
            setStructureNumber(text.trim());
          },
          "plain-text",
          "",
        );
      };
      if (hasUnsyncedChanges) {
        Alert.alert(
          "Unsubmitted Changes",
          "You have data that hasn't been submitted. Starting a new bridge will permanently discard it.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Discard & Continue", style: "destructive", onPress: doPrompt },
          ],
        );
      } else {
        doPrompt();
      }
    } else {
      if (hasUnsyncedChanges) {
        Alert.alert(
          "Unsubmitted Changes",
          "You have data that hasn't been submitted. Starting a new bridge will permanently discard it.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Discard & Continue",
              style: "destructive",
              onPress: () => { setNewBridgeDraft(""); setNewBridgeVisible(true); },
            },
          ],
        );
      } else {
        setNewBridgeDraft("");
        setNewBridgeVisible(true);
      }
    }
  };

  const handleConfirmNewBridge = () => {
    clearInspection();
    setStructureNumber(newBridgeDraft.trim());
    setNewBridgeVisible(false);
    setNewBridgeDraft("");
  };

  const handleOpenSubmitted = (sn: string) => {
    const doOpen = () => {
      clearInspection();
      setStructureNumber(sn);
    };

    const confirmEdit = () => {
      Alert.alert(
        "Re-open for Editing?",
        `Open "${sn}" as the active inspection? You can add or update data and resubmit when done.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open for Editing", onPress: doOpen },
        ]
      );
    };

    if (hasUnsyncedChanges) {
      Alert.alert(
        "Unsubmitted Changes",
        "You have data that hasn't been submitted. Opening another bridge will permanently discard it.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard & Continue", style: "destructive", onPress: confirmEdit },
        ]
      );
    } else {
      confirmEdit();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* ── New Bridge Modal (Android / Web) ── */}
      <Modal
        visible={newBridgeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewBridgeVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setNewBridgeVisible(false)}
          >
            <Pressable style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.modalHeader}>
                <Feather name="layers" size={16} color="#38bdf8" />
                <Text style={[styles.modalTitle, { color: c.foreground }]}>New Bridge</Text>
              </View>
              <Text style={[styles.modalSubtitle, { color: c.mutedForeground }]}>
                Enter the structure number to start a new inspection. All current data will be cleared.
              </Text>
              <TextInput
                style={[styles.modalInput, { color: c.foreground, backgroundColor: "#0f172a", borderColor: "#334155" }]}
                value={newBridgeDraft}
                onChangeText={setNewBridgeDraft}
                placeholder="e.g. 18057026103105"
                placeholderTextColor="#475569"
                autoFocus
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleConfirmNewBridge}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: "#334155" }]}
                  onPress={() => setNewBridgeVisible(false)}
                >
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, !newBridgeDraft.trim() && { opacity: 0.4 }]}
                  onPress={handleConfirmNewBridge}
                  disabled={!newBridgeDraft.trim()}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Start Inspection</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {Platform.OS !== "web" && (
        <PDFAnnotatorModal
          visible={annotatorOpen}
          pdfPath={importedPdfPath}
          annotations={pdfAnnotations}
          onSave={(anns) => {
            setPdfAnnotations(anns);
            setAnnotatorOpen(false);
            // Fire-and-forget sync so annotations reach server immediately
            syncSession().catch(() => {});
          }}
          onClose={() => setAnnotatorOpen(false)}
        />
      )}

      <View style={[styles.header, { backgroundColor: c.headerBg }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Feather name="layers" size={16} color="#38bdf8" />
            <Text style={styles.headerTitle}>My Bridges</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: "#1e293b" }]}
              onPress={openNewBridgeFlow}
            >
              <Feather name="plus" size={14} color="#38bdf8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: "#1e293b" }]}
              onPress={() => refetch()}
              disabled={isFetching}
            >
              <Feather name="refresh-cw" size={14} color={isFetching ? "#475569" : "#94a3b8"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* ── In Progress ── */}
        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeader}>
            <View style={[styles.dot, { backgroundColor: "#f97316" }]} />
            <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>In Progress</Text>
          </View>

          {hasActiveSession ? (
            <View style={[
              styles.sessionCard,
              {
                backgroundColor: c.card,
                borderColor: hasUnsyncedChanges ? "#f97316" : "#10b981",
                borderWidth: hasUnsyncedChanges ? 1.5 : 1,
              },
            ]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={[styles.bridgeName, { color: c.foreground }]}>
                    {structureNumber || "Unnamed Bridge"}
                  </Text>
                  <View style={styles.statRow}>
                    <View style={styles.stat}>
                      <Feather name="alert-triangle" size={11} color={c.mutedForeground} />
                      <Text style={[styles.statText, { color: c.mutedForeground }]}>
                        {savedDefects.length} {savedDefects.length === 1 ? "defect" : "defects"}
                      </Text>
                    </View>
                    {lastModified && (
                      <View style={styles.stat}>
                        <Feather name="clock" size={11} color={c.mutedForeground} />
                        <Text style={[styles.statText, { color: c.mutedForeground }]}>
                          Modified {formatRelativeTime(lastModified)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: hasUnsyncedChanges ? "#7c2d12" : "#052e16" },
                ]}>
                  <Feather
                    name={hasUnsyncedChanges ? "upload-cloud" : "check-circle"}
                    size={11}
                    color={hasUnsyncedChanges ? "#fb923c" : "#34d399"}
                  />
                  <Text style={[
                    styles.statusText,
                    { color: hasUnsyncedChanges ? "#fb923c" : "#34d399" },
                  ]}>
                    {hasUnsyncedChanges ? "Unsubmitted" : "Submitted"}
                  </Text>
                </View>
              </View>

              {lastSynced && (
                <Text style={[styles.lastSyncText, { color: c.mutedForeground }]}>
                  Last submitted {formatRelativeTime(lastSynced)}
                </Text>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    !hasUnsyncedChanges && !!lastSynced && { backgroundColor: "#1e293b", borderColor: "#334155" },
                    submitStatus === "syncing" && { opacity: 0.6 },
                    submitStatus === "success" && { backgroundColor: "#052e16", borderColor: "#10b981" },
                    submitStatus === "error" && { backgroundColor: "#450a0a", borderColor: "#ef4444" },
                  ]}
                  onPress={handleSubmit}
                  disabled={submitStatus === "syncing"}
                >
                  {submitStatus === "syncing" ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather
                      name={
                        submitStatus === "success" ? "check-circle"
                        : submitStatus === "error" ? "x-circle"
                        : !hasUnsyncedChanges && !!lastSynced ? "refresh-cw"
                        : "upload-cloud"
                      }
                      size={14}
                      color={
                        submitStatus === "success" ? "#34d399"
                        : submitStatus === "error" ? "#f87171"
                        : !hasUnsyncedChanges && !!lastSynced ? "#94a3b8"
                        : "#fff"
                      }
                    />
                  )}
                  <Text style={[
                    styles.submitBtnText,
                    !hasUnsyncedChanges && !!lastSynced && { color: "#94a3b8" },
                    submitStatus === "success" && { color: "#34d399" },
                    submitStatus === "error" && { color: "#f87171" },
                  ]}>
                    {submitStatus === "syncing" ? "Submitting…"
                      : submitStatus === "success" ? "Submitted!"
                      : submitStatus === "error" ? "Failed — Retry"
                      : !hasUnsyncedChanges && !!lastSynced ? "Resubmit"
                      : "Submit to Cloud"}
                  </Text>
                </TouchableOpacity>

                {importedPdfPath && Platform.OS !== "web" && (
                  <TouchableOpacity
                    style={[styles.newBtn, { backgroundColor: "#0c1a2e", borderColor: "#0284c7" }]}
                    onPress={() => setAnnotatorOpen(true)}
                  >
                    <Feather name="edit-3" size={13} color="#38bdf8" />
                    <Text style={[styles.newBtnText, { color: "#38bdf8" }]}>Annotate PDF</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.newBtn, { backgroundColor: parsingActive ? "#1e293b" : "#0c1a2e", borderColor: parsingActive ? "#334155" : "#0369a1" }]}
                  onPress={handleImportPdf}
                  disabled={parsingActive}
                >
                  <Feather name={parsingActive ? "loader" : "file-text"} size={13} color={parsingActive ? "#475569" : "#38bdf8"} />
                  <Text style={[styles.newBtnText, { color: parsingActive ? "#475569" : "#38bdf8" }]}>
                    {parsingActive ? "Parsing PDF…" : "Import Previous Report"}
                  </Text>
                </TouchableOpacity>

                {!importedPdfPath && !parsingActive && (
                  <TouchableOpacity
                    style={[styles.newBtn, { backgroundColor: "#0c1a2e", borderColor: "#334155" }]}
                    onPress={handleLoadSampleReport}
                  >
                    <Feather name="download" size={13} color="#94a3b8" />
                    <Text style={[styles.newBtnText, { color: "#94a3b8" }]}>Load Sample Report</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="layers" size={28} color={c.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: c.foreground }]}>No Active Inspection</Text>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                Enter a structure number to begin a new bridge inspection.
              </Text>
              <TouchableOpacity
                style={styles.emptyStartBtn}
                onPress={openNewBridgeFlow}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.emptyStartBtnText}>Start New Inspection</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Submitted ── */}
        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeader}>
            <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
            <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Submitted</Text>
            {sessions && sessions.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: "#052e16" }]}>
                <Text style={[styles.countBadgeText, { color: "#34d399" }]}>{sessions.length}</Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Loading submitted inspections…</Text>
            </View>
          ) : isError ? (
            <View style={[styles.emptyCard, { backgroundColor: "#1c0a09", borderColor: "#ef4444" }]}>
              <Feather name="wifi-off" size={24} color="#ef4444" />
              <Text style={[styles.emptyTitle, { color: "#ef4444" }]}>Cannot Reach Server</Text>
              <Text style={[styles.emptyText, { color: "#94a3b8" }]}>Check your connection.</Text>
              <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : !sessions || sessions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="cloud" size={28} color={c.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: c.foreground }]}>No Submissions Yet</Text>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                Submitted inspections will appear here.
              </Text>
            </View>
          ) : (
            sessions.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.submittedCard, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => handleOpenSubmitted(s.structureNumber || "")}
                activeOpacity={0.75}
              >
                <View style={styles.submittedTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bridgeName, { color: c.foreground }]}>
                      {s.structureNumber || "Unnamed Bridge"}
                    </Text>
                    <Text style={[styles.submittedMeta, { color: c.mutedForeground }]}>
                      Submitted {formatRelativeTime(s.syncedAt)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[
                      styles.sourceBadge,
                      { backgroundColor: (s.source as string) === "pdf_import" ? "#451a03" : "#0c1a2e" },
                    ]}>
                      <Feather
                        name={(s.source as string) === "pdf_import" ? "file-text" : "smartphone"}
                        size={11}
                        color={(s.source as string) === "pdf_import" ? "#fb923c" : "#38bdf8"}
                      />
                      <Text style={[
                        styles.sourceText,
                        { color: (s.source as string) === "pdf_import" ? "#fb923c" : "#38bdf8" },
                      ]}>
                        {(s.source as string) === "pdf_import" ? "PDF Import" : "Device"}
                      </Text>
                    </View>
                    <Feather name="edit-2" size={13} color={c.mutedForeground} />
                  </View>
                </View>
                <View style={[styles.webNoteRow, { borderTopColor: c.border }]}>
                  <Feather name="monitor" size={11} color={c.mutedForeground} />
                  <Text style={[styles.webNote, { color: c.mutedForeground }]}>
                    Tap to re-open for editing · View full report on web
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },
  iconBtn: { padding: 8, borderRadius: 10 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 16 },
  sectionGroup: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countBadgeText: { fontSize: 10, fontWeight: "900" },
  sessionCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bridgeName: { fontSize: 15, fontWeight: "900" },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 11, fontWeight: "600" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  lastSyncText: { fontSize: 10, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 8 },
  submitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#0284c7",
    borderWidth: 1,
    borderColor: "#0369a1",
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  newBtnText: { fontSize: 11, fontWeight: "800" },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 13, fontWeight: "800" },
  emptyText: { fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 16 },
  emptyStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#0284c7",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyStartBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: "900" },
  modalSubtitle: { fontSize: 12, fontWeight: "600", lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0284c7",
    borderRadius: 12,
    paddingVertical: 12,
  },
  retryBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  retryText: { color: "#94a3b8", fontSize: 12, fontWeight: "800" },
  submittedCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  submittedTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
  },
  submittedMeta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  sourceText: { fontSize: 10, fontWeight: "800" },
  webNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  webNote: { fontSize: 10, fontWeight: "600", fontStyle: "italic", flex: 1 },
});
