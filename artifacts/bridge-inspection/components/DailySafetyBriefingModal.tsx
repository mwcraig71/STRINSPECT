import { Feather } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  Linking,
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
import {
  SAFETY_BRIEFING_RISKS,
  SafetyCrewSignoff,
  createSafetyCrewSignoff,
  useInspection,
} from "@/context/InspectionContext";

const ACCENT = "#b91c1c";
const SAFETY_PLAN_PDF = require("@/assets/docs/safety-plan.pdf");

export function DailySafetyBriefingModal({ inline = false }: { inline?: boolean }) {
  const c = useColors();
  const {
    showDailySafetyModal,
    setShowDailySafetyModal,
    safetyBriefingData,
    setSafetyBriefingData,
  } = useInspection();

  const d = safetyBriefingData;
  const [opening, setOpening] = useState(false);

  const setField = <K extends keyof typeof d>(field: K, value: (typeof d)[K]) => {
    setSafetyBriefingData({ ...d, [field]: value });
  };

  const toggleRisk = (risk: string) => {
    const selected = d.selectedRisks.includes(risk);
    setSafetyBriefingData({
      ...d,
      selectedRisks: selected
        ? d.selectedRisks.filter((r) => r !== risk)
        : [...d.selectedRisks, risk],
    });
  };

  const updateCrew = (id: string, patch: Partial<SafetyCrewSignoff>) => {
    setSafetyBriefingData({
      ...d,
      crew: d.crew.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  const addCrew = () => {
    setSafetyBriefingData({ ...d, crew: [...d.crew, createSafetyCrewSignoff()] });
  };

  const removeCrew = (id: string) => {
    const remaining = d.crew.filter((m) => m.id !== id);
    setSafetyBriefingData({
      ...d,
      crew: remaining.length ? remaining : [createSafetyCrewSignoff()],
    });
  };

  const openSafetyPlan = async () => {
    const isWeb = Platform.OS === "web";
    // On web, open the tab synchronously inside the user gesture so the
    // popup blocker doesn't reject it after the async asset download.
    let preopened: Window | null = null;
    if (isWeb && typeof window !== "undefined") {
      preopened = window.open("", "_blank");
    }
    try {
      setOpening(true);
      const asset = Asset.fromModule(SAFETY_PLAN_PDF);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri) throw new Error("missing uri");
      if (isWeb) {
        if (preopened) {
          preopened.location.href = uri;
        } else if (typeof window !== "undefined") {
          // Popup was blocked — try a direct open, then fall back to Linking.
          const win = window.open(uri, "_blank");
          if (!win) await Linking.openURL(uri);
        } else {
          await Linking.openURL(uri);
        }
      } else {
        await WebBrowser.openBrowserAsync(uri);
      }
    } catch {
      if (preopened) preopened.close();
      Alert.alert(
        "Unable to open",
        "The safety plan document could not be opened on this device."
      );
    } finally {
      setOpening(false);
    }
  };

  if (inline && !showDailySafetyModal) return null;
  const sheet = (
    <View style={inline ? [StyleSheet.absoluteFill, styles.container, { backgroundColor: c.background, zIndex: 999 }] : [styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: ACCENT }]}>
          <View style={styles.headerLeft}>
            <Feather name="shield" size={26} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Daily Safety Briefing</Text>
              <Text style={styles.headerSubtitle}>Risk Assessment & Sign-Off</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowDailySafetyModal(false)}
            style={styles.closeBtn}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Safety plan link */}
          <TouchableOpacity
            style={[styles.planLink, { backgroundColor: c.card, borderColor: ACCENT }]}
            onPress={openSafetyPlan}
            disabled={opening}
          >
            <View style={[styles.planIcon, { backgroundColor: ACCENT }]}>
              <Feather name="file-text" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planTitle, { color: c.foreground }]}>
                View Full Safety Plan
              </Text>
              <Text style={[styles.planSub, { color: c.mutedForeground }]}>
                Strinteg Bridge Inspection Safety Plan (PDF)
              </Text>
            </View>
            <Feather
              name={opening ? "loader" : "external-link"}
              size={18}
              color={ACCENT}
            />
          </TouchableOpacity>

          {/* Project details */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Project Details</Text>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                Work / Project Location
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                value={d.workLocation}
                onChangeText={(t) => setField("workLocation", t)}
                placeholder="Bridge / site location..."
                placeholderTextColor={c.mutedForeground}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 2 }]}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                  Employee In-Charge of On-Site Safety
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={d.employeeInCharge}
                  onChangeText={(t) => setField("employeeInCharge", t)}
                  placeholder="Print name..."
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Phone #</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={d.employeeInChargePhone}
                  onChangeText={(t) => setField("employeeInChargePhone", t)}
                  placeholder="(000) 000-0000"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Briefing Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                value={d.briefingDate}
                onChangeText={(t) => setField("briefingDate", t)}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          </View>

          {/* Identified risks — select all that apply to this site */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              Identified Risks & Mitigations
            </Text>
            <Text style={[styles.cardHint, { color: c.mutedForeground }]}>
              Tap each risk present at this site
            </Text>
            {SAFETY_BRIEFING_RISKS.map((r, i) => {
              const selected = d.selectedRisks.includes(r.risk);
              return (
                <Pressable
                  key={r.risk}
                  onPress={() => toggleRisk(r.risk)}
                  style={[
                    styles.riskRow,
                    { borderColor: c.border },
                    i === SAFETY_BRIEFING_RISKS.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View
                    style={[
                      styles.riskCheck,
                      { borderColor: c.border },
                      selected && { backgroundColor: ACCENT, borderColor: ACCENT },
                    ]}
                  >
                    {selected ? (
                      <Feather name="check" size={13} color="#fff" />
                    ) : (
                      <Feather name="alert-triangle" size={11} color={c.mutedForeground} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.riskTitle,
                        { color: c.foreground },
                        selected && { color: ACCENT },
                      ]}
                    >
                      {r.risk}
                    </Text>
                    <Text style={[styles.riskMitigation, { color: c.mutedForeground }]}>
                      {r.mitigation}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={[styles.disclaimer, { color: c.mutedForeground }]}>
              This is not an exhaustive list of hazards. If new hazards are
              identified, STOP work and re-evaluate this site-specific safety plan.
            </Text>
          </View>

          {/* Emergency + on-site safety plan */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Emergency Readiness</Text>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                Nearest Hospital(s) — CALL 911
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                value={d.nearestHospitals}
                onChangeText={(t) => setField("nearestHospitals", t)}
                placeholder="Hospital name(s) and address..."
                placeholderTextColor={c.mutedForeground}
                multiline
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                Project Safety Plan & First Aid Kit On-Site w/ Emergency Procedures
              </Text>
              <View style={styles.toggleRow}>
                {(["Yes", "No"] as const).map((opt) => {
                  const sel = d.safetyPlanOnSite === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.toggleBtn,
                        sel
                          ? { backgroundColor: ACCENT, borderColor: ACCENT }
                          : { backgroundColor: c.secondary, borderColor: c.border },
                      ]}
                      onPress={() => setField("safetyPlanOnSite", sel ? "" : opt)}
                    >
                      <Text style={{ color: sel ? "#fff" : c.mutedForeground, fontWeight: "800", fontSize: 13 }}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Required PPE */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Required PPE</Text>
            <Pressable style={styles.checkRow} onPress={() => setField("ppeStandard", !d.ppeStandard)}>
              <View style={[styles.checkbox, { borderColor: c.border }, d.ppeStandard && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                {d.ppeStandard && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={[styles.checkText, { color: c.foreground }]}>
                Hard Hat / Class III Reflective Vest + Pants / Safety Glasses / Safety Boots / Gloves / First Aid Kit
              </Text>
            </Pressable>
            <Pressable style={styles.checkRow} onPress={() => setField("ppeHarness", !d.ppeHarness)}>
              <View style={[styles.checkbox, { borderColor: c.border }, d.ppeHarness && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                {d.ppeHarness && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={[styles.checkText, { color: c.foreground }]}>Harness & Lanyard</Text>
            </Pressable>
            <Pressable style={styles.checkRow} onPress={() => setField("ppeOther", !d.ppeOther)}>
              <View style={[styles.checkbox, { borderColor: c.border }, d.ppeOther && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                {d.ppeOther && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={[styles.checkText, { color: c.foreground }]}>Other</Text>
            </Pressable>
            {d.ppeOther && (
              <TextInput
                style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                value={d.ppeOtherText}
                onChangeText={(t) => setField("ppeOtherText", t)}
                placeholder="Specify other PPE..."
                placeholderTextColor={c.mutedForeground}
              />
            )}
          </View>

          {/* Recognition safety meeting sign-off */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.crewHeader}>
              <Text style={[styles.cardTitle, { color: c.foreground }]}>
                Recognition Safety Meeting — Sign-Off
              </Text>
            </View>
            <View style={styles.crewColHeader}>
              <Text style={[styles.crewHeadName, { color: c.mutedForeground }]}>Signature (Print Name)</Text>
              <Text style={[styles.crewHeadDate, { color: c.mutedForeground }]}>Date</Text>
              <Text style={[styles.crewHeadInit, { color: c.mutedForeground }]}>Init.</Text>
              <View style={styles.crewHeadSpacer} />
            </View>
            {d.crew.map((m) => (
              <View key={m.id} style={styles.crewRow}>
                <TextInput
                  style={[styles.crewName, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={m.name}
                  onChangeText={(t) => updateCrew(m.id, { name: t })}
                  placeholder="Crew member name..."
                  placeholderTextColor={c.mutedForeground}
                />
                <TextInput
                  style={[styles.crewDate, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={m.date}
                  onChangeText={(t) => updateCrew(m.id, { date: t })}
                  placeholder="MM/DD"
                  placeholderTextColor={c.mutedForeground}
                />
                <TextInput
                  style={[styles.crewInit, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={m.initials}
                  onChangeText={(t) => updateCrew(m.id, { initials: t })}
                  placeholder="—"
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="characters"
                  maxLength={4}
                />
                <TouchableOpacity
                  onPress={() => removeCrew(m.id)}
                  style={styles.crewRemove}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={15} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={addCrew}>
              <Feather name="plus" size={16} color={ACCENT} />
              <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Crew Member</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: ACCENT }]}
            onPress={() => setShowDailySafetyModal(false)}
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
      visible={showDailySafetyModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDailySafetyModal(false)}
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
  planLink: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 2, padding: 14 },
  planIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  planTitle: { fontSize: 14, fontWeight: "900" },
  planSub: { fontSize: 10, fontWeight: "600", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
  row: { flexDirection: "row", gap: 10 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 12, fontWeight: "600", minHeight: 56, textAlignVertical: "top" },
  cardHint: { fontSize: 10, fontWeight: "700", marginTop: -6 },
  riskRow: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  riskCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  riskTitle: { fontSize: 12, fontWeight: "800" },
  riskMitigation: { fontSize: 11, fontWeight: "500", marginTop: 2, lineHeight: 15 },
  disclaimer: { fontSize: 10, fontWeight: "700", fontStyle: "italic", marginTop: 4 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { fontSize: 11, fontWeight: "700", flex: 1 },
  crewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  crewColHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  crewHeadName: { flex: 1, fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  crewHeadDate: { width: 64, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  crewHeadInit: { width: 44, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  crewHeadSpacer: { width: 24 },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  crewName: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  crewDate: { width: 64, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 7, fontSize: 11, fontWeight: "600", textAlign: "center" },
  crewInit: { width: 44, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 7, fontSize: 11, fontWeight: "700", textAlign: "center" },
  crewRemove: { width: 24, alignItems: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", marginTop: 4 },
  addBtnText: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 16, borderTopWidth: 1 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  doneBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
});
