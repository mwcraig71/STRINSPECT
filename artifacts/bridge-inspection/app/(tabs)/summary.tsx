import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useInspection, type ReadinessCheck } from "@/context/InspectionContext";
import { SettingsModal } from "@/components/SettingsModal";
import colors from "@/constants/colors";

const CS_COLORS = {
  CS1: colors.light.cs1,
  CS2: colors.light.cs2,
  CS3: colors.light.cs3,
  CS4: colors.light.cs4,
};

export default function SummaryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    elementSummary,
    maintenanceSummary,
    criticalFindingsSummary,
    importSummary,
    clearImportSummary,
    syncSession,
    structureNumber,
    hasUnsyncedChanges,
    readiness,
    isReady,
    isFinalized,
    finalizeInspection,
    importAuditAcknowledged,
    acknowledgeImportAudit,
    criticalFindingsAcknowledged,
    acknowledgeCriticalFindings,
    ucChannelOverrideAcknowledged,
    acknowledgeUcChannelOverride,
    standardPhotos,
    standardPhotosComplete,
    isSnbiFormat,
  } = useInspection();
  const missingPhotos = standardPhotos.filter((s) => !s.photoUri).length;
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<"idle" | "syncing" | "success" | "error">("idle");
  const [finalizeStatus, setFinalizeStatus] = React.useState<"idle" | "working">("idle");

  const scrollRef = React.useRef<ScrollView>(null);
  const sectionY = React.useRef<Record<string, number>>({});
  const onSectionLayout = (id: string) => (e: LayoutChangeEvent) => {
    sectionY.current[id] = e.nativeEvent.layout.y;
  };

  const goToTarget = (target: ReadinessCheck["target"]) => {
    if (target.screen === "summary") {
      const y = target.focusId ? sectionY.current[target.focusId] ?? 0 : 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      return;
    }
    const focusTs = String(Date.now());
    if (target.screen === "bridges") {
      router.navigate("/(tabs)/bridges");
    } else if (target.screen === "inspection") {
      router.navigate({ pathname: "/(tabs)", params: { focus: target.focusId ?? "", focusTs } });
    } else if (target.screen === "nbi") {
      router.navigate({ pathname: "/(tabs)/nbi", params: { focus: target.focusId ?? "", focusTs } });
    } else if (target.screen === "photos") {
      router.navigate("/(tabs)/photos");
    }
  };

  const handleFinalize = async () => {
    if (finalizeStatus === "working") return;
    if (!isReady) {
      Alert.alert("Not Ready", "Resolve every readiness check before marking this inspection complete.");
      return;
    }
    setFinalizeStatus("working");
    try {
      const result = await finalizeInspection();
      Alert.alert(
        "Inspection Finalized",
        result === "queued"
          ? "Marked complete. It will sync automatically when you're back online."
          : "Marked complete and synced to the cloud."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Finalize failed";
      Alert.alert("Cannot Finalize", msg);
    } finally {
      setFinalizeStatus("idle");
    }
  };

  const handleSubmit = async () => {
    if (submitStatus === "syncing") return;
    if (!structureNumber) {
      Alert.alert("Missing Info", "Please set a structure number in the Inspection tab before submitting.");
      return;
    }
    setSubmitStatus("syncing");
    try {
      await syncSession();
      setSubmitStatus("success");
      setTimeout(() => setSubmitStatus("idle"), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      const isOffline = err instanceof TypeError || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch");
      Alert.alert("Submit Failed", isOffline ? "No internet connection. Check your network and try again." : msg);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 3000);
    }
  };

  const importedAt = importSummary
    ? new Date(importSummary.timestamp).toLocaleString("en-US")
    : "";

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Slim Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerInner}>
            <Feather name="list" size={16} color="#38bdf8" />
            <Text style={styles.headerTitle}>Summary</Text>
            {isFinalized && (
              <View style={styles.headerCompleteBadge}>
                <Feather name="check-circle" size={11} color="#34d399" />
                <Text style={styles.headerCompleteText}>Complete</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {hasUnsyncedChanges && (
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  submitStatus === "syncing" && { opacity: 0.7 },
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
                    name={submitStatus === "success" ? "check" : submitStatus === "error" ? "x" : "upload-cloud"}
                    size={13}
                    color={submitStatus === "success" ? "#34d399" : submitStatus === "error" ? "#f87171" : "#fff"}
                  />
                )}
                <Text style={[
                  styles.submitBtnText,
                  submitStatus === "success" && { color: "#34d399" },
                  submitStatus === "error" && { color: "#f87171" },
                ]}>
                  {submitStatus === "syncing" ? "…" : submitStatus === "success" ? "Done" : submitStatus === "error" ? "Error" : "Submit"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.gearBtn, { backgroundColor: "#1e293b" }]} onPress={() => setSettingsOpen(true)}>
              <Feather name="settings" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* ── Standard Photos Warning ── */}
        {!standardPhotosComplete && (
          <TouchableOpacity
            style={[styles.photosWarning, { borderColor: "#78716c", backgroundColor: "#1c1917" }]}
            onPress={() => router.navigate("/(tabs)/photos")}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={16} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.photosWarningTitle}>
                {missingPhotos} required photo{missingPhotos !== 1 ? "s" : ""} missing
              </Text>
              <Text style={styles.photosWarningBody}>
                Capture all standard photos before leaving the bridge
              </Text>
            </View>
            <Feather name="arrow-right" size={16} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* ── Readiness Checklist ── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: isFinalized ? "#10b981" : isReady ? "#10b981" : "#f59e0b",
              borderWidth: 2,
            },
          ]}
        >
          <View style={[styles.cardHeader, { borderBottomColor: isReady ? "#bbf7d0" : "#fde68a" }]}>
            <View style={styles.cardHeaderLeft}>
              <Feather
                name={isReady ? "check-circle" : "alert-circle"}
                size={20}
                color={isReady ? "#10b981" : "#f59e0b"}
              />
              <Text style={[styles.cardTitle, { color: isReady ? "#047857" : "#b45309" }]}>
                Readiness Checklist
              </Text>
            </View>
            <View
              style={[
                styles.countBadge,
                { backgroundColor: isReady ? "#10b981" : "#f59e0b" },
              ]}
            >
              <Text style={styles.countBadgeText}>
                {readiness.filter((r) => r.passed).length}/{readiness.length}
              </Text>
            </View>
          </View>

          {readiness.map((check, idx) => (
            <View
              key={check.id}
              style={[
                styles.checkRow,
                { borderBottomColor: c.border },
                idx === readiness.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Feather
                name={check.passed ? "check-circle" : "x-circle"}
                size={18}
                color={check.passed ? "#10b981" : "#ef4444"}
              />
              <View style={styles.checkTextWrap}>
                <Text style={[styles.checkLabel, { color: c.foreground }]}>{check.label}</Text>
                <Text
                  style={[
                    styles.checkReason,
                    { color: check.passed ? c.mutedForeground : "#dc2626" },
                  ]}
                >
                  {check.reason}
                </Text>
              </View>
              {!check.passed && (
                <View style={styles.checkActions}>
                  <TouchableOpacity
                    style={[styles.fixBtn, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}
                    onPress={() => goToTarget(check.target)}
                  >
                    <Text style={styles.fixBtnText}>Fix</Text>
                    <Feather name="arrow-right" size={12} color="#dc2626" />
                  </TouchableOpacity>
                  {check.id === "ucChannel" && (
                    <TouchableOpacity
                      style={[styles.overrideBtn, { borderColor: "#fbbf24", backgroundColor: "#fffbeb" }]}
                      onPress={acknowledgeUcChannelOverride}
                    >
                      <Feather name="slash" size={11} color="#b45309" />
                      <Text style={styles.overrideBtnText}>Override</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {check.id === "ucChannel" && check.passed && ucChannelOverrideAcknowledged && (
                <View style={[styles.overrideDoneBadge, { borderColor: "#fcd34d", backgroundColor: "#fef9c3" }]}>
                  <Feather name="slash" size={10} color="#b45309" />
                  <Text style={styles.overrideDoneText}>Overridden</Text>
                </View>
              )}
            </View>
          ))}

          <View style={[styles.finalizeFooter, { borderTopColor: c.border }]}>
            {isFinalized ? (
              <View style={styles.finalizedRow}>
                <Feather name="check-circle" size={16} color="#10b981" />
                <Text style={styles.finalizedText}>
                  Inspection marked complete. Editing any field will reopen it.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.finalizeBtn,
                  isReady
                    ? { backgroundColor: "#059669", borderColor: "#047857" }
                    : { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1" },
                ]}
                onPress={handleFinalize}
                disabled={!isReady || finalizeStatus === "working"}
              >
                {finalizeStatus === "working" ? (
                  <ActivityIndicator size="small" color={isReady ? "#fff" : "#94a3b8"} />
                ) : (
                  <Feather name="check-square" size={16} color={isReady ? "#fff" : "#94a3b8"} />
                )}
                <Text style={[styles.finalizeBtnText, { color: isReady ? "#fff" : "#94a3b8" }]}>
                  {isReady ? "Mark Complete" : "Resolve checks to finalize"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Import Audit ── */}
        {importSummary && (
          <View
            onLayout={onSectionLayout("importAudit")}
            style={[styles.card, { backgroundColor: c.card, borderColor: "#f97316", borderWidth: 2 }]}
          >
            <View style={[styles.cardHeader, { borderBottomColor: "#fed7aa" }]}>
              <View style={styles.cardHeaderLeft}>
                <Feather name="file-text" size={20} color="#f97316" />
                <Text style={[styles.cardTitle, { color: "#c2410c" }]}>Import Audit</Text>
              </View>
              <TouchableOpacity
                style={[styles.dismissBtn, { backgroundColor: "#fff7ed", borderColor: "#fdba74" }]}
                onPress={clearImportSummary}
              >
                <Feather name="x" size={14} color="#c2410c" />
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.auditBody}>
              <Text style={[styles.auditMeta, { color: c.mutedForeground }]}>
                Imported {importedAt}
              </Text>

              {/* Stat tiles */}
              <View style={styles.statRow}>
                <View style={[styles.statTile, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Text style={[styles.statNum, { color: c.foreground }]}>{importSummary.elementsFound}</Text>
                  <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Elements Found</Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Text style={[styles.statNum, { color: c.foreground }]}>{importSummary.elementRecordsCreated}</Text>
                  <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Records Created</Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Text style={[styles.statNum, { color: c.foreground }]}>
                    {importSummary.nbiFilledCount}/{importSummary.nbiTotalCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{isSnbiFormat ? "Rating Fields Filled" : "NBI Fields Filled"}</Text>
                </View>
              </View>

              {/* Structure number */}
              <View style={[styles.auditLine, { borderColor: c.border }]}>
                <Feather
                  name={importSummary.structureNumberFound ? "check-circle" : "alert-triangle"}
                  size={14}
                  color={importSummary.structureNumberFound ? "#059669" : "#dc2626"}
                />
                <Text style={[styles.auditLineText, { color: c.foreground }]}>
                  {importSummary.structureNumberFound
                    ? `Structure ${importSummary.structureNumber}`
                    : "Structure number not found — enter manually"}
                </Text>
              </View>

              {/* NBI section breakdown */}
              <Text style={[styles.auditSectionTitle, { color: c.mutedForeground }]}>{isSnbiFormat ? "SNBI Sections" : "NBI Sections"}</Text>
              <View style={styles.chipWrap}>
                {importSummary.sections.map((s) => {
                  const blank = !s.hasData;
                  return (
                    <View
                      key={s.item}
                      style={[
                        styles.chip,
                        blank
                          ? { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }
                          : { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
                      ]}
                    >
                      <Feather
                        name={blank ? "alert-triangle" : "check"}
                        size={11}
                        color={blank ? "#dc2626" : "#059669"}
                      />
                      <Text style={[styles.chipText, { color: blank ? "#b91c1c" : "#15803d" }]}>
                        {s.item} · {blank ? "blank" : `${s.filled}/${s.total}`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Blank sections callout */}
              {importSummary.emptySections.length > 0 && (
                <View style={styles.calloutWarn}>
                  <View style={styles.calloutHeader}>
                    <Feather name="alert-triangle" size={13} color="#b91c1c" />
                    <Text style={styles.calloutTitle}>
                      {importSummary.emptySections.length} section(s) need manual review
                    </Text>
                  </View>
                  {importSummary.emptySections.map((s) => (
                    <Text key={s.item} style={styles.calloutItem}>
                      {isSnbiFormat ? `B.C.${s.item.replace("BC", "")}` : `Item ${s.item}`} — {s.description}: no data extracted
                    </Text>
                  ))}
                </View>
              )}

              {/* Unmatched components */}
              {importSummary.unmatchedComponents.length > 0 && (
                <View style={styles.calloutNeutral}>
                  <View style={styles.calloutHeader}>
                    <Feather name="help-circle" size={13} color="#92400e" />
                    <Text style={[styles.calloutTitle, { color: "#92400e" }]}>
                      {importSummary.unmatchedComponents.length} parsed component(s) not matched
                    </Text>
                  </View>
                  {importSummary.unmatchedComponents.map((name, idx) => (
                    <Text key={idx} style={[styles.calloutItem, { color: "#92400e" }]}>
                      {name}
                    </Text>
                  ))}
                </View>
              )}

              {/* Acknowledge — clears the readiness blocker for blank sections */}
              {importSummary.emptySections.length > 0 && (
                importAuditAcknowledged ? (
                  <View style={styles.ackDone}>
                    <Feather name="check-circle" size={14} color="#059669" />
                    <Text style={styles.ackDoneText}>Blank sections reviewed & acknowledged</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.ackBtn} onPress={acknowledgeImportAudit}>
                    <Feather name="check" size={14} color="#fff" />
                    <Text style={styles.ackBtnText}>Acknowledge blank sections</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        )}

        {/* ── Element Data ── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Feather name="bar-chart-2" size={20} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Element Data</Text>
            </View>
          </View>
          {/* Column headers */}
          <View style={[styles.tableHeader, { borderBottomColor: c.border, backgroundColor: c.background }]}>
            <Text style={[styles.colElement, styles.colHeader, { color: c.mutedForeground }]}>Element</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS1 }]}>CS1</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS2 }]}>CS2</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS3 }]}>CS3</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS4 }]}>CS4</Text>
            <Text style={[styles.colTotal, styles.colHeader, { color: c.foreground }]}>Total</Text>
          </View>
          {elementSummary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No defects logged yet</Text>
            </View>
          ) : (
            elementSummary.map((row, idx) => (
              <View
                key={row.name}
                style={[
                  styles.tableRow,
                  { borderBottomColor: c.border },
                  idx % 2 === 1 && { backgroundColor: c.background },
                ]}
              >
                <View style={styles.colElement}>
                  <Text style={[styles.elementName, { color: c.foreground }]}>{row.name}</Text>
                  <Text style={[styles.elementUnit, { color: c.mutedForeground }]}>{row.unit}</Text>
                </View>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS1 > 0 ? CS_COLORS.CS1 : c.mutedForeground }]}>
                  {row.CS1 > 0 ? row.CS1 : "—"}
                </Text>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS2 > 0 ? CS_COLORS.CS2 : c.mutedForeground }]}>
                  {row.CS2 > 0 ? row.CS2 : "—"}
                </Text>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS3 > 0 ? CS_COLORS.CS3 : c.mutedForeground }]}>
                  {row.CS3 > 0 ? row.CS3 : "—"}
                </Text>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS4 > 0 ? CS_COLORS.CS4 : c.mutedForeground }]}>
                  {row.CS4 > 0 ? row.CS4 : "—"}
                </Text>
                <Text style={[styles.colTotal, styles.cellTotal, { color: c.foreground }]}>{row.total}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Maintenance Plan ── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.primary, borderWidth: 2 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Feather name="tool" size={20} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.primary }]}>Maintenance Plan</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.countBadgeText}>{maintenanceSummary.length} Items</Text>
            </View>
          </View>
          <View style={[styles.tableHeader, { borderBottomColor: "#bfdbfe", backgroundColor: "#eff6ff" }]}>
            <Text style={[styles.colLocation, styles.colHeader, { color: c.primary }]}>Location / Element</Text>
            <Text style={[styles.colDesc, styles.colHeader, { color: c.primary }]}>Defect Description</Text>
            <Text style={[styles.colQtyRight, styles.colHeader, { color: c.primary }]}>Qty</Text>
          </View>
          {maintenanceSummary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: c.mutedForeground, fontStyle: "italic" }]}>
                No Maintenance Tasks Cataloged
              </Text>
            </View>
          ) : (
            maintenanceSummary.map((d, idx) => (
              <View
                key={d.id}
                style={[
                  styles.tableRow,
                  { borderBottomColor: "#bfdbfe" },
                  idx % 2 === 1 && { backgroundColor: "#f0f9ff" },
                ]}
              >
                <View style={styles.colLocation}>
                  <Text style={[styles.locationText, { color: c.foreground }]}>{d.location}</Text>
                  <Text style={[styles.elementSmall, { color: c.primary }]}>{d.element}</Text>
                </View>
                <View style={styles.colDesc}>
                  <Text style={[styles.defectName, { color: c.foreground }]}>{d.defect}</Text>
                  {d.locationDesc ? (
                    <Text style={[styles.defectNote, { color: c.mutedForeground }]} numberOfLines={2}>
                      {d.locationDesc}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.colQtyRight, styles.qtyText, { color: c.primary }]}>
                  {d.maintenanceQuantityValue || d.quantityValue}
                  {"\n"}
                  <Text style={{ fontSize: 9 }}>{d.quantity.split(" ")[1]}</Text>
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Critical Finding Summary ── */}
        <View
          onLayout={onSectionLayout("criticalFindings")}
          style={[styles.card, { backgroundColor: c.card, borderColor: "#dc2626", borderWidth: 2 }]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Feather name="alert-octagon" size={20} color="#dc2626" />
              <Text style={[styles.cardTitle, { color: "#dc2626" }]}>Critical Finding Summary</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: "#dc2626" }]}>
              <Text style={styles.countBadgeText}>{criticalFindingsSummary.length} Active</Text>
            </View>
          </View>
          <View style={[styles.tableHeader, { borderBottomColor: "#fecaca", backgroundColor: "#fef2f2" }]}>
            <Text style={[styles.colLocation, styles.colHeader, { color: "#dc2626" }]}>Location / Element</Text>
            <Text style={[styles.colDesc, styles.colHeader, { color: "#dc2626" }]}>Structural Write-up</Text>
            <Text style={[styles.colQtyRight, styles.colHeader, { color: "#dc2626" }]}>Qty</Text>
          </View>
          {criticalFindingsSummary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: c.mutedForeground, fontStyle: "italic" }]}>
                No Critical Deficiencies Reported
              </Text>
            </View>
          ) : (
            criticalFindingsSummary.map((d, idx) => (
              <View
                key={d.id}
                style={[
                  styles.tableRow,
                  { borderBottomColor: "#fecaca" },
                  idx % 2 === 1 && { backgroundColor: "#fff5f5" },
                ]}
              >
                <View style={styles.colLocation}>
                  <Text style={[styles.locationText, { color: c.foreground }]}>{d.location}</Text>
                  <Text style={[styles.elementSmall, { color: "#dc2626" }]}>{d.element}</Text>
                </View>
                <View style={styles.colDesc}>
                  <Text style={[styles.defectName, { color: c.foreground }]}>{d.defect}</Text>
                  {d.locationDesc ? (
                    <Text style={[styles.defectNote, { color: c.mutedForeground }]} numberOfLines={2}>
                      {d.locationDesc}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.colQtyRight, styles.qtyText, { color: "#dc2626" }]}>
                  {d.quantityValue}
                  {"\n"}
                  <Text style={{ fontSize: 9 }}>{d.quantity.split(" ")[1]}</Text>
                </Text>
              </View>
            ))
          )}
          {criticalFindingsSummary.length > 0 && (
            <View style={styles.critAckWrap}>
              {criticalFindingsAcknowledged ? (
                <View style={styles.ackDone}>
                  <Feather name="check-circle" size={14} color="#059669" />
                  <Text style={styles.ackDoneText}>Critical findings reviewed & acknowledged</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.ackBtn, { backgroundColor: "#dc2626" }]}
                  onPress={acknowledgeCriticalFindings}
                >
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.ackBtnText}>Acknowledge critical findings</Text>
                </TouchableOpacity>
              )}
            </View>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
  headerInner: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerTitle: { fontSize: 14, fontWeight: "900", color: "#f8fafc", letterSpacing: -0.3, textTransform: "uppercase" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#0284c7",
    borderWidth: 1,
    borderColor: "#0369a1",
  },
  submitBtnText: { fontSize: 11, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
  modulePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  modulePillText: { fontSize: 9, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
  gearBtn: { padding: 8, borderRadius: 10 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5, flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff", textTransform: "uppercase" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  colHeader: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  colElement: { flex: 2.5, paddingRight: 8 },
  colCS: { flex: 1, textAlign: "center" },
  colTotal: { flex: 1, textAlign: "right" },
  colLocation: { flex: 1.5, paddingRight: 8 },
  colDesc: { flex: 2.5, paddingRight: 8 },
  colQtyRight: { width: 50, textAlign: "right" },
  elementName: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  elementUnit: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  cellValue: { fontWeight: "900", fontSize: 14 },
  cellTotal: { fontWeight: "900", fontSize: 14 },
  locationText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  elementSmall: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  defectName: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  defectNote: { fontSize: 10, fontStyle: "italic", marginTop: 2 },
  qtyText: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  emptyRow: { padding: 28, alignItems: "center" },
  emptyText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  dismissBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  dismissBtnText: { fontSize: 10, fontWeight: "900", color: "#c2410c", textTransform: "uppercase" },
  auditBody: { padding: 14, gap: 12 },
  auditMeta: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  statRow: { flexDirection: "row", gap: 8 },
  statTile: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 4 },
  statNum: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 8.5, fontWeight: "800", textTransform: "uppercase", textAlign: "center", letterSpacing: 0.2 },
  auditLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
  auditLineText: { fontSize: 12, fontWeight: "700", flex: 1 },
  auditSectionTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  calloutWarn: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", borderRadius: 10, padding: 10, gap: 4 },
  calloutNeutral: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 10, padding: 10, gap: 4 },
  calloutHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  calloutTitle: { fontSize: 11, fontWeight: "900", color: "#b91c1c", textTransform: "uppercase" },
  calloutItem: { fontSize: 11, fontWeight: "600", color: "#b91c1c" },
  headerCompleteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "#052e16",
    borderWidth: 1,
    borderColor: "#10b981",
    marginLeft: 4,
  },
  headerCompleteText: { fontSize: 10, fontWeight: "900", color: "#34d399", textTransform: "uppercase", letterSpacing: 0.4 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  checkTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  checkLabel: { fontSize: 12.5, fontWeight: "800" },
  checkReason: { fontSize: 11, fontWeight: "600" },
  fixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  fixBtnText: { fontSize: 11, fontWeight: "900", color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.3 },
  checkActions: { flexDirection: "column", alignItems: "flex-end", gap: 4 },
  overrideBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  overrideBtnText: { fontSize: 10, fontWeight: "800", color: "#b45309", textTransform: "uppercase", letterSpacing: 0.3 },
  overrideDoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  overrideDoneText: { fontSize: 9, fontWeight: "800", color: "#92400e", textTransform: "uppercase", letterSpacing: 0.3 },
  finalizeFooter: { padding: 14, borderTopWidth: 1 },
  finalizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  finalizeBtnText: { fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  finalizedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  finalizedText: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "700", color: "#047857" },
  ackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#059669",
  },
  ackBtnText: { fontSize: 12, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.4 },
  ackDone: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  ackDoneText: { fontSize: 11.5, fontWeight: "800", color: "#047857", textTransform: "uppercase", letterSpacing: 0.3 },
  critAckWrap: { padding: 14 },
  photosWarning: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 2 },
  photosWarningTitle: { color: "#f59e0b", fontSize: 13, fontWeight: "700" },
  photosWarningBody: { color: "#a8a29e", fontSize: 12, marginTop: 2 },
});
