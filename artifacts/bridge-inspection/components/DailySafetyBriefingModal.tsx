import { AppIcon as Feather } from "@/components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
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
import { SignaturePad } from "@/components/SignaturePad";

const ACCENT = "#b91c1c";
const SAFETY_PLAN_PDF = require("@/assets/docs/safety-plan.pdf");
const STICKY_KEY = "@bridge_safety_sticky";

interface StickyData {
  employeeInCharge: string;
  employeeInChargePhone: string;
  selectedRisks: string[];
  nearestHospitals: string;
  crewNames: string[];
}

interface HospitalResult {
  name: string;
  address: string;
}

function todayString() {
  return new Date().toLocaleDateString("en-US");
}

export function DailySafetyBriefingModal({ inline = false }: { inline?: boolean }) {
  const c = useColors();
  const {
    showDailySafetyModal,
    setShowDailySafetyModal,
    safetyBriefingData,
    setSafetyBriefingData,
    structureNumber,
  } = useInspection();

  const d = safetyBriefingData;
  const [opening, setOpening] = useState(false);
  const [searchingHospitals, setSearchingHospitals] = useState(false);
  const [hospitalResults, setHospitalResults] = useState<HospitalResult[]>([]);
  const [showHospitalPicker, setShowHospitalPicker] = useState(false);
  const [sigCrewId, setSigCrewId] = useState<string | null>(null);
  const stickyRef = useRef<StickyData | null>(null);

  // ── Load sticky data and merge into current briefing when modal opens ─────
  useEffect(() => {
    if (!showDailySafetyModal) return;

    AsyncStorage.getItem(STICKY_KEY).then((raw) => {
      let sticky: StickyData | null = null;
      if (raw) {
        try { sticky = JSON.parse(raw); } catch {}
      }
      stickyRef.current = sticky;

      // Read current briefing data snapshot (d is captured at effect run time — modal just opened)
      const next = { ...safetyBriefingData };

      // Always sync work location to bridge number
      if (structureNumber.trim()) next.workLocation = structureNumber.trim();

      // Always set briefing date to today
      next.briefingDate = todayString();

      // Sticky fields: only apply if current value is blank
      if (sticky) {
        if (!next.employeeInCharge.trim() && sticky.employeeInCharge)
          next.employeeInCharge = sticky.employeeInCharge;
        if (!next.employeeInChargePhone.trim() && sticky.employeeInChargePhone)
          next.employeeInChargePhone = sticky.employeeInChargePhone;
        if (!next.selectedRisks.length && sticky.selectedRisks?.length)
          next.selectedRisks = sticky.selectedRisks;
        if (!next.nearestHospitals.trim() && sticky.nearestHospitals)
          next.nearestHospitals = sticky.nearestHospitals;

        // Restore crew names if the current list is all empty
        const allEmpty = next.crew.every((m: SafetyCrewSignoff) => !m.name.trim());
        if (allEmpty && sticky.crewNames?.length) {
          next.crew = sticky.crewNames.map((name: string) => ({
            ...createSafetyCrewSignoff(),
            name,
          }));
        }
      }

      setSafetyBriefingData(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDailySafetyModal]);

  const saveSticky = useCallback((updated: typeof d) => {
    const sticky: StickyData = {
      employeeInCharge: updated.employeeInCharge,
      employeeInChargePhone: updated.employeeInChargePhone,
      selectedRisks: updated.selectedRisks,
      nearestHospitals: updated.nearestHospitals,
      crewNames: updated.crew.map((m: SafetyCrewSignoff) => m.name).filter(Boolean),
    };
    stickyRef.current = sticky;
    AsyncStorage.setItem(STICKY_KEY, JSON.stringify(sticky)).catch(() => {});
  }, []);

  const setField = <K extends keyof typeof d>(field: K, value: (typeof d)[K]) => {
    const next = { ...d, [field]: value };
    setSafetyBriefingData(next);
    // Save sticky for persistent fields
    if (["employeeInCharge", "employeeInChargePhone", "selectedRisks", "nearestHospitals"].includes(field as string)) {
      saveSticky(next);
    }
  };

  const toggleRisk = (risk: string) => {
    const selected = d.selectedRisks.includes(risk);
    const next = {
      ...d,
      selectedRisks: selected
        ? d.selectedRisks.filter((r) => r !== risk)
        : [...d.selectedRisks, risk],
    };
    setSafetyBriefingData(next);
    saveSticky(next);
  };

  const updateCrew = (id: string, patch: Partial<SafetyCrewSignoff>) => {
    const next = {
      ...d,
      crew: d.crew.map((m: SafetyCrewSignoff) => (m.id === id ? { ...m, ...patch } : m)),
    };
    setSafetyBriefingData(next);
    if ("name" in patch) saveSticky(next);
  };

  const addCrew = () => {
    const next = { ...d, crew: [...d.crew, createSafetyCrewSignoff()] };
    setSafetyBriefingData(next);
  };

  const removeCrew = (id: string) => {
    const remaining = d.crew.filter((m: SafetyCrewSignoff) => m.id !== id);
    const next = { ...d, crew: remaining.length ? remaining : [createSafetyCrewSignoff()] };
    setSafetyBriefingData(next);
    saveSticky(next);
  };

  // ── Hospital search ───────────────────────────────────────────────────────
  const searchHospitals = async () => {
    setSearchingHospitals(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location access is needed to find nearby hospitals. Please enter the address manually.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = loc.coords;

      const query = `[out:json][timeout:15];(node["amenity"~"^(hospital|clinic)$"](around:30000,${lat},${lon});way["amenity"~"^(hospital|clinic)$"](around:30000,${lat},${lon}););out center 10;`;
      const resp = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      );
      const data = await resp.json();

      if (!data.elements?.length) {
        Alert.alert("No Results", "No hospitals found within 30 km. Please enter the address manually.");
        return;
      }

      const results: HospitalResult[] = data.elements
        .filter((el: Record<string, unknown>) => el.tags)
        .map((el: Record<string, unknown>) => {
          const tags = el.tags as Record<string, string>;
          const name = tags.name || tags["name:en"] || "Hospital";
          const addr = [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:city"],
            tags["addr:state"],
          ]
            .filter(Boolean)
            .join(" ");
          return { name, address: addr || "Address not available" };
        })
        .slice(0, 8);

      setHospitalResults(results);
      setShowHospitalPicker(true);
    } catch {
      Alert.alert("Search Failed", "Could not search for hospitals. Please enter the address manually.");
    } finally {
      setSearchingHospitals(false);
    }
  };

  const selectHospital = (h: HospitalResult) => {
    const text = h.address ? `${h.name}\n${h.address}` : h.name;
    const existing = d.nearestHospitals.trim();
    const next = { ...d, nearestHospitals: existing ? `${existing}\n\n${text}` : text };
    setSafetyBriefingData(next);
    saveSticky(next);
    setShowHospitalPicker(false);
  };

  // ── Open safety plan PDF ──────────────────────────────────────────────────
  const openSafetyPlan = async () => {
    const isWeb = Platform.OS === "web";
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
        } else {
          const win = window.open(uri, "_blank");
          if (!win) await Linking.openURL(uri);
        }
      } else {
        await WebBrowser.openBrowserAsync(uri);
      }
    } catch {
      if (preopened) preopened.close();
      Alert.alert("Unable to open", "The safety plan document could not be opened on this device.");
    } finally {
      setOpening(false);
    }
  };

  // ── Submit briefing ───────────────────────────────────────────────────────
  const handleSubmit = () => {
    Alert.alert(
      "Submit Safety Briefing",
      "Mark this safety briefing as complete? All information will be saved and synced with the inspection report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          style: "default",
          onPress: () => {
            const next = {
              ...d,
              submitted: true,
              submittedAt: new Date().toISOString(),
            };
            setSafetyBriefingData(next);
            saveSticky(next);
            setShowDailySafetyModal(false);
          },
        },
      ],
    );
  };

  if (inline && !showDailySafetyModal) return null;

  const submittedBanner = d.submitted && d.submittedAt ? (
    <View style={styles.submittedBanner}>
      <Feather name="check-circle" size={15} color="#059669" />
      <Text style={styles.submittedText}>
        Submitted {new Date(d.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </Text>
      <TouchableOpacity onPress={() => setSafetyBriefingData({ ...d, submitted: false, submittedAt: undefined })}>
        <Text style={styles.submittedReopen}>Re-open</Text>
      </TouchableOpacity>
    </View>
  ) : null;

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
        <TouchableOpacity onPress={() => setShowDailySafetyModal(false)} style={styles.closeBtn}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {submittedBanner}

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
            <Text style={[styles.planTitle, { color: c.foreground }]}>View Full Safety Plan</Text>
            <Text style={[styles.planSub, { color: c.mutedForeground }]}>
              Strinteg Bridge Inspection Safety Plan (PDF)
            </Text>
          </View>
          <Feather name={opening ? "loader" : "external-link"} size={18} color={ACCENT} />
        </TouchableOpacity>

        {/* Project Details */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Project Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Work / Project Location</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={d.workLocation}
              onChangeText={(t) => setField("workLocation", t)}
              placeholder="Bridge / site location…"
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
                placeholder="Print name…"
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
            <View style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, justifyContent: "center" }]}>
              <Text style={{ color: c.foreground, fontSize: 12, fontWeight: "600" }}>{d.briefingDate}</Text>
            </View>
          </View>
        </View>

        {/* Identified risks */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Identified Risks & Mitigations</Text>
          <Text style={[styles.cardHint, { color: c.mutedForeground }]}>
            Tap each risk present at this site — selections carry over to future briefings
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
                <View style={[styles.riskCheck, { borderColor: c.border }, selected && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                  {selected
                    ? <Feather name="check" size={13} color="#fff" />
                    : <Feather name="alert-triangle" size={11} color={c.mutedForeground} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.riskTitle, { color: c.foreground }, selected && { color: ACCENT }]}>
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
            This is not an exhaustive list of hazards. If new hazards are identified, STOP work and re-evaluate this site-specific safety plan.
          </Text>
        </View>

        {/* Emergency Readiness */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Emergency Readiness</Text>

          <View style={styles.fieldGroup}>
            <View style={styles.hospitalLabelRow}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground, flex: 1 }]}>
                Nearest Hospital(s) — CALL 911
              </Text>
              <TouchableOpacity
                style={[styles.searchHospBtn, searchingHospitals && { opacity: 0.5 }]}
                onPress={searchHospitals}
                disabled={searchingHospitals}
              >
                <Feather name={searchingHospitals ? "loader" : "map-pin"} size={12} color="#fff" />
                <Text style={styles.searchHospBtnText}>
                  {searchingHospitals ? "Searching…" : "Find Nearest"}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.textArea, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
              value={d.nearestHospitals}
              onChangeText={(t) => setField("nearestHospitals", t)}
              placeholder="Hospital name(s) and address…"
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
                    style={[styles.toggleBtn, sel ? { backgroundColor: ACCENT, borderColor: ACCENT } : { backgroundColor: c.secondary, borderColor: c.border }]}
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
              placeholder="Specify other PPE…"
              placeholderTextColor={c.mutedForeground}
            />
          )}
        </View>

        {/* Crew Sign-Off with Signatures */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>
            Recognition Safety Meeting — Sign-Off
          </Text>
          <Text style={[styles.cardHint, { color: c.mutedForeground }]}>
            Names carry over to future briefings. Tap "Sign" for each crew member to collect a digital signature.
          </Text>

          {d.crew.map((m: SafetyCrewSignoff) => (
            <View key={m.id} style={[styles.crewBlock, { borderColor: c.border }]}>
              <View style={styles.crewTopRow}>
                <TextInput
                  style={[styles.crewName, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={m.name}
                  onChangeText={(t) => updateCrew(m.id, { name: t })}
                  placeholder="Crew member name…"
                  placeholderTextColor={c.mutedForeground}
                />
                <TextInput
                  style={[styles.crewInit, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={m.initials}
                  onChangeText={(t) => updateCrew(m.id, { initials: t })}
                  placeholder="Init."
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

              {/* Signature area */}
              <View style={styles.sigRow}>
                {m.signature ? (
                  <View style={styles.sigPreviewWrap}>
                    <Image source={{ uri: m.signature }} style={styles.sigPreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.sigClearBtn} onPress={() => updateCrew(m.id, { signature: undefined })}>
                      <Feather name="x" size={12} color="#dc2626" />
                      <Text style={styles.sigClearText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.sigBtn, { borderColor: ACCENT }]}
                    onPress={() => setSigCrewId(m.id)}
                  >
                    <Feather name="edit-2" size={14} color={ACCENT} />
                    <Text style={[styles.sigBtnText, { color: ACCENT }]}>Tap to Sign</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.crewDateLabel, { color: c.mutedForeground }]}>{m.date}</Text>
              </View>
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
          style={[styles.saveBtn, { backgroundColor: c.secondary, borderColor: c.border, borderWidth: 1 }]}
          onPress={() => setShowDailySafetyModal(false)}
        >
          <Feather name="check" size={16} color={c.foreground} />
          <Text style={[styles.saveBtnText, { color: c.foreground }]}>Save & Close</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: d.submitted ? "#059669" : ACCENT }]}
          onPress={d.submitted ? () => setShowDailySafetyModal(false) : handleSubmit}
        >
          <Feather name={d.submitted ? "check-circle" : "send"} size={16} color="#fff" />
          <Text style={styles.submitBtnText}>
            {d.submitted ? "Briefing Submitted" : "Submit Safety Briefing"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hospital picker modal */}
      <Modal
        visible={showHospitalPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHospitalPicker(false)}
      >
        <View style={[styles.pickerModal, { backgroundColor: c.background }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.pickerTitle, { color: c.foreground }]}>Select a Hospital</Text>
            <TouchableOpacity onPress={() => setShowHospitalPicker(false)}>
              <Feather name="x" size={20} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {hospitalResults.map((h, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.hospRow, { borderBottomColor: c.border }]}
                onPress={() => selectHospital(h)}
              >
                <Feather name="map-pin" size={16} color={ACCENT} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hospName, { color: c.foreground }]}>{h.name}</Text>
                  <Text style={[styles.hospAddr, { color: c.mutedForeground }]}>{h.address}</Text>
                </View>
                <Feather name="plus-circle" size={18} color={ACCENT} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Signature pad modal */}
      <SignaturePad
        visible={sigCrewId !== null}
        crewName={d.crew.find((m: SafetyCrewSignoff) => m.id === sigCrewId)?.name}
        onSave={(dataUrl) => {
          if (sigCrewId) updateCrew(sigCrewId, { signature: dataUrl });
          setSigCrewId(null);
        }}
        onClose={() => setSigCrewId(null)}
      />
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
  submittedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#bbf7d0",
  },
  submittedText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#059669" },
  submittedReopen: { fontSize: 11, fontWeight: "800", color: "#b91c1c", textDecorationLine: "underline" },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  planLink: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 2, padding: 14 },
  planIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  planTitle: { fontSize: 14, fontWeight: "900" },
  planSub: { fontSize: 10, fontWeight: "600", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
  cardHint: { fontSize: 10, fontWeight: "700", marginTop: -6 },
  row: { flexDirection: "row", gap: 10 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 12, fontWeight: "600", minHeight: 64, textAlignVertical: "top" },
  hospitalLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchHospBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  searchHospBtnText: { color: "#fff", fontSize: 10, fontWeight: "800" },
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
  crewBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  crewTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  crewName: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  crewInit: { width: 54, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 7, fontSize: 11, fontWeight: "700", textAlign: "center" },
  crewRemove: { width: 28, alignItems: "center" },
  sigRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sigBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 10,
  },
  sigBtnText: { fontSize: 12, fontWeight: "800" },
  sigPreviewWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  sigPreview: { flex: 1, height: 44, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  sigClearBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  sigClearText: { fontSize: 10, fontWeight: "700", color: "#dc2626" },
  crewDateLabel: { fontSize: 10, fontWeight: "700", width: 54, textAlign: "center" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 12, borderTopWidth: 1, flexDirection: "row", gap: 10 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 12,
    flex: 1,
  },
  saveBtnText: { fontSize: 13, fontWeight: "800" },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  submitBtnText: { fontSize: 13, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.3 },
  pickerModal: { flex: 1 },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: { fontSize: 16, fontWeight: "900" },
  hospRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hospName: { fontSize: 14, fontWeight: "800" },
  hospAddr: { fontSize: 12, fontWeight: "500", marginTop: 2 },
});
