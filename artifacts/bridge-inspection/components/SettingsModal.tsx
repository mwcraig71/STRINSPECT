import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import {
  ActivityIndicator,
  Alert,
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

import { CUSTOM_SHORTCUTS_KEY, SC_FAVORITES_KEY, SC_HIDDEN_KEY, SC_OVERRIDES_KEY, TEXT_SHORTCUTS, TextShortcut } from "@/data/textShortcuts";
import { useColors } from "@/hooks/useColors";
import {
  MATERIAL_OPTIONS,
  INSPECTION_TYPES,
  NOMENCLATURES,
  normalizeInspectionDateInput,
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
    superstructureTypes,
    setSuperstructureTypes,
    substructureTypes,
    setSubstructureTypes,
    superstructureMaterials,
    setSuperstructureMaterials,
    substructureMaterials,
    setSubstructureMaterials,
    clearInspection,
    savedDefects,
    structureNumber,
    importSummary,
    lastSynced,
    syncSession,
    pendingSyncCount,
    aspectRatio,
    setAspectRatio,
    imageSize,
    setImageSize,
    dateStampEnabled,
    setDateStampEnabled,
    openAiKey,
    setOpenAiKey,
    aiRephrase,
    setAiRephrase,
    teamLeader,
    setTeamLeader,
    teamMembers,
    setTeamMembers,
    inspectionDate,
    setInspectionDate,
    weather,
    setWeather,
    equipmentUsed,
    setEquipmentUsed,
  } = useInspection();

  const [aspectRatioInput, setAspectRatioInput] = React.useState(aspectRatio);
  React.useEffect(() => { setAspectRatioInput(aspectRatio); }, [aspectRatio]);

  const [keyInput, setKeyInput] = React.useState("");
  const [keyVisible, setKeyVisible] = React.useState(false);
  const [inspectionDateTouched, setInspectionDateTouched] = React.useState(false);
  const [teamMembersInput, setTeamMembersInput] = React.useState(teamMembers.join(", "));
  React.useEffect(() => {
    if (visible) setTeamMembersInput(teamMembers.join(", "));
  }, [visible]);

  const [scExpanded, setScExpanded] = React.useState(false);
  const [customShortcuts, setCustomShortcuts] = React.useState<TextShortcut[]>([]);
  const [scFavs, setScFavs] = React.useState<string[]>([]);
  const [newLabel, setNewLabel] = React.useState("");
  const [newText, setNewText] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editText, setEditText] = React.useState("");
  const [scOverrides, setScOverrides] = React.useState<Record<string, { label: string; text: string }>>({});
  const [scHidden, setScHidden] = React.useState<string[]>([]);
  const [editingBuiltinId, setEditingBuiltinId] = React.useState<string | null>(null);
  const [editBuiltinLabel, setEditBuiltinLabel] = React.useState("");
  const [editBuiltinText, setEditBuiltinText] = React.useState("");

  React.useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(CUSTOM_SHORTCUTS_KEY).then((raw) => {
      try { setCustomShortcuts(raw ? JSON.parse(raw) : []); } catch { setCustomShortcuts([]); }
    }).catch(() => {});
    AsyncStorage.getItem(SC_FAVORITES_KEY).then((raw) => {
      try { setScFavs(raw ? JSON.parse(raw) : []); } catch { setScFavs([]); }
    }).catch(() => {});
    AsyncStorage.getItem(SC_OVERRIDES_KEY).then((raw) => {
      try { setScOverrides(raw ? JSON.parse(raw) : {}); } catch { setScOverrides({}); }
    }).catch(() => {});
    AsyncStorage.getItem(SC_HIDDEN_KEY).then((raw) => {
      try { setScHidden(raw ? JSON.parse(raw) : []); } catch { setScHidden([]); }
    }).catch(() => {});
  }, [visible]);

  const saveCustom = (list: TextShortcut[]) => {
    setCustomShortcuts(list);
    AsyncStorage.setItem(CUSTOM_SHORTCUTS_KEY, JSON.stringify(list)).catch(() => {});
  };
  const saveFavs = (list: string[]) => {
    setScFavs(list);
    AsyncStorage.setItem(SC_FAVORITES_KEY, JSON.stringify(list)).catch(() => {});
  };
  const toggleFav = (id: string) => {
    const next = scFavs.includes(id) ? scFavs.filter((f) => f !== id) : [...scFavs, id];
    saveFavs(next);
  };
  const addSc = () => {
    const lbl = newLabel.trim();
    const txt = newText.trim();
    if (!lbl || !txt) return;
    saveCustom([...customShortcuts, { id: "custom_" + Date.now(), category: "Custom", label: lbl, text: txt }]);
    setNewLabel("");
    setNewText("");
  };
  const deleteSc = (id: string) => {
    saveCustom(customShortcuts.filter((s) => s.id !== id));
    saveFavs(scFavs.filter((f) => f !== id));
  };
  const startEdit = (s: TextShortcut) => {
    setEditingId(s.id);
    setEditLabel(s.label);
    setEditText(s.text);
  };
  const commitEdit = (id: string) => {
    const lbl = editLabel.trim();
    const txt = editText.trim();
    if (!lbl || !txt) { setEditingId(null); return; }
    saveCustom(customShortcuts.map((s) => (s.id === id ? { ...s, label: lbl, text: txt } : s)));
    setEditingId(null);
  };

  const saveOverrides = (ovr: Record<string, { label: string; text: string }>) => {
    setScOverrides(ovr);
    AsyncStorage.setItem(SC_OVERRIDES_KEY, JSON.stringify(ovr)).catch(() => {});
  };
  const saveHidden = (hidden: string[]) => {
    setScHidden(hidden);
    AsyncStorage.setItem(SC_HIDDEN_KEY, JSON.stringify(hidden)).catch(() => {});
  };
  const startEditBuiltin = (s: TextShortcut) => {
    const effective = scOverrides[s.id] ? { ...s, ...scOverrides[s.id] } : s;
    setEditingBuiltinId(s.id);
    setEditBuiltinLabel(effective.label);
    setEditBuiltinText(effective.text);
  };
  const commitBuiltinEdit = (id: string) => {
    const lbl = editBuiltinLabel.trim();
    const txt = editBuiltinText.trim();
    if (!lbl || !txt) { setEditingBuiltinId(null); return; }
    saveOverrides({ ...scOverrides, [id]: { label: lbl, text: txt } });
    setEditingBuiltinId(null);
  };

  const hasInspectionData =
    savedDefects.length > 0 || !!structureNumber || !!importSummary;

  type SyncStatus = "idle" | "syncing" | "success" | "queued" | "error" | "validation_error";
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [syncError, setSyncError] = React.useState("");

  const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const handleSync = async () => {
    if (syncStatus === "syncing") return;
    if (normalizeInspectionDateInput(inspectionDate) === null) {
      const message = "Enter a real calendar date as YYYY-MM-DD or MM/DD/YYYY before syncing.";
      setInspectionDateTouched(true);
      setSyncError(message);
      setSyncStatus("validation_error");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Invalid Inspection Date", message);
      }
      return;
    }
    setSyncStatus("syncing");
    setSyncError("");
    try {
      const result = await syncSession();
      setSyncStatus(result === "queued" ? "queued" : "success");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Sync failed.";
      setSyncError(raw);
      setSyncStatus("error");
    }
  };

  const handleClearInspection = () => {
    Alert.alert(
      "Clear Inspection",
      "This permanently discards all imported and recorded inspection data — element records, NBI ratings, and the structure number. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Inspection",
          style: "destructive",
          onPress: () => {
            clearInspection();
            onClose();
          },
        },
      ]
    );
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
          {/* Supplemental field notes */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="clipboard" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Inspection Team & Field Notes</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Optional supplemental information for identifying the field team and conditions. These notes are not mapped to SNBI or NBI rating fields.
            </Text>

            <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Team leader</Text>
            <View style={[styles.keyRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <TextInput
                accessibilityLabel="Team leader"
                style={[styles.keyInput, { color: c.foreground }]}
                value={teamLeader}
                onChangeText={setTeamLeader}
                placeholder="Lead inspector's name"
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="words"
              />
            </View>

            <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Additional team members</Text>
            <TextInput
              accessibilityLabel="Additional team members"
              style={[styles.scInput, styles.scTextArea, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
              value={teamMembersInput}
              onChangeText={(value) => {
                setTeamMembersInput(value);
                setTeamMembers(value.split(/[,\n]/));
              }}
              placeholder="Separate names with commas or new lines"
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={2}
              autoCapitalize="words"
            />

            <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Inspection date</Text>
            <View style={[styles.keyRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <TextInput
                accessibilityLabel="Inspection date"
                style={[styles.keyInput, { color: c.foreground }]}
                value={inspectionDate}
                onChangeText={(value) => {
                  setInspectionDate(value);
                  setInspectionDateTouched(false);
                  if (syncStatus === "validation_error" || (syncStatus === "error" && syncError.includes("Inspection date"))) {
                    setSyncStatus("idle");
                    setSyncError("");
                  }
                }}
                onBlur={() => {
                  setInspectionDateTouched(true);
                  const normalized = normalizeInspectionDateInput(inspectionDate);
                  if (normalized === null) {
                    const message = "Enter a real calendar date as YYYY-MM-DD or MM/DD/YYYY.";
                    if (Platform.OS === "web" && typeof window !== "undefined") {
                      window.alert(message);
                    } else {
                      Alert.alert("Invalid Inspection Date", message);
                    }
                    return;
                  }
                  if (normalized !== inspectionDate) setInspectionDate(normalized);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            {inspectionDateTouched && normalizeInspectionDateInput(inspectionDate) === null && (
              <View style={[styles.syncErrorBox, { backgroundColor: "#1f0a0a", borderColor: "#7f1d1d" }]}>
                <Feather name="alert-circle" size={13} color="#f87171" />
                <Text style={styles.syncErrorText}>
                  Enter a real calendar date as YYYY-MM-DD or MM/DD/YYYY.
                </Text>
              </View>
            )}

            <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Weather</Text>
            <View style={[styles.keyRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <TextInput
                accessibilityLabel="Weather"
                style={[styles.keyInput, { color: c.foreground }]}
                value={weather}
                onChangeText={setWeather}
                placeholder="e.g. Clear, 72°F, light wind"
                placeholderTextColor={c.mutedForeground}
              />
            </View>

            <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Equipment used</Text>
            <TextInput
              accessibilityLabel="Equipment used"
              style={[styles.scInput, styles.scTextArea, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
              value={equipmentUsed}
              onChangeText={setEquipmentUsed}
              placeholder="e.g. Bucket truck, sounding hammer, drone"
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={2}
              autoCapitalize="sentences"
            />
          </View>

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
                  nomenclature === NOMENCLATURES.SCDOT
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setNomenclature(NOMENCLATURES.SCDOT)}
              >
                <View style={styles.optionInner}>
                  <View style={[styles.optionIcon, { backgroundColor: nomenclature === NOMENCLATURES.SCDOT ? "rgba(255,255,255,0.2)" : c.card }]}>
                    <Text style={[styles.optionIconText, { color: nomenclature === NOMENCLATURES.SCDOT ? "#fff" : c.primary }]}>SC</Text>
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: nomenclature === NOMENCLATURES.SCDOT ? "#fff" : c.foreground }]}>South Carolina (SCDOT)</Text>
                    <Text style={[styles.optionSub, { color: nomenclature === NOMENCLATURES.SCDOT ? "rgba(255,255,255,0.75)" : c.mutedForeground }]}>
                      End Bent · Interior Bent · Pile
                    </Text>
                  </View>
                  {nomenclature === NOMENCLATURES.SCDOT && (
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

          {/* Inspection assignment */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="users" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Inspection Assignment</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Choose the work this inspector is assigned to. Topside inspectors can switch between topside and underside work; underwater inspectors use the dedicated underwater workflow.
            </Text>
            <View style={styles.assignmentGroup}>
              <TouchableOpacity
                style={[
                  styles.assignmentBtn,
                  inspectionType !== INSPECTION_TYPES.UNDERWATER
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => {
                  if (inspectionType === INSPECTION_TYPES.UNDERWATER) {
                    setInspectionType(INSPECTION_TYPES.TOPSIDE);
                  }
                }}
              >
                <View style={[styles.assignmentIcon, { backgroundColor: inspectionType !== INSPECTION_TYPES.UNDERWATER ? "rgba(255,255,255,0.2)" : c.card }]}>
                  <Feather name="layers" size={16} color={inspectionType !== INSPECTION_TYPES.UNDERWATER ? "#fff" : c.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: inspectionType !== INSPECTION_TYPES.UNDERWATER ? "#fff" : c.foreground }]}>
                    Topside + Underside
                  </Text>
                  <Text style={[styles.optionSub, { color: inspectionType !== INSPECTION_TYPES.UNDERWATER ? "rgba(255,255,255,0.75)" : c.mutedForeground }]}>
                    Deck, roadway, superstructure, and supports
                  </Text>
                </View>
                {inspectionType !== INSPECTION_TYPES.UNDERWATER && <Feather name="check-circle" size={18} color="#fff" />}
              </TouchableOpacity>

              <TouchableOpacity
                disabled={nomenclature !== NOMENCLATURES.SCDOT}
                style={[
                  styles.assignmentBtn,
                  inspectionType === INSPECTION_TYPES.UNDERWATER
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                  nomenclature !== NOMENCLATURES.SCDOT && { opacity: 0.45 },
                ]}
                onPress={() => setInspectionType(INSPECTION_TYPES.UNDERWATER)}
              >
                <View style={[styles.assignmentIcon, { backgroundColor: inspectionType === INSPECTION_TYPES.UNDERWATER ? "rgba(255,255,255,0.2)" : c.card }]}>
                  <Feather name="droplet" size={16} color={inspectionType === INSPECTION_TYPES.UNDERWATER ? "#fff" : c.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: inspectionType === INSPECTION_TYPES.UNDERWATER ? "#fff" : c.foreground }]}>
                    Underwater
                  </Text>
                  <Text style={[styles.optionSub, { color: inspectionType === INSPECTION_TYPES.UNDERWATER ? "rgba(255,255,255,0.75)" : c.mutedForeground }]}>
                    {nomenclature === NOMENCLATURES.SCDOT ? "SCDOT dive inspection and photo checklist" : "Select South Carolina (SCDOT) first"}
                  </Text>
                </View>
                {inspectionType === INSPECTION_TYPES.UNDERWATER && <Feather name="check-circle" size={18} color="#fff" />}
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
              Define the bridge's structural composition and material. Combined with the current location, these filter the elements available on the Inspection tab. Leave material on "Not Set" to show every material.
            </Text>

            {/* Superstructure */}
            <View style={styles.structSection}>
              <View style={styles.structLabelRow}>
                <View style={[styles.structLabelDot, { backgroundColor: "#38bdf8" }]} />
                <Text style={[styles.structLabel, { color: c.foreground }]}>Superstructure</Text>
              </View>
              <View style={styles.typeGrid}>
                {SUPERSTRUCTURE_TYPES.map((t) => {
                  const active = superstructureTypes.includes(t.id);
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
                      onPress={() => {
                        if (t.id === "OTHER") {
                          setSuperstructureTypes(["OTHER"]);
                        } else {
                          const without = superstructureTypes.filter((x) => x !== "OTHER" && x !== t.id);
                          const next = active ? without : [...without, t.id];
                          setSuperstructureTypes(next.length > 0 ? next : ["OTHER"]);
                        }
                      }}
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
              <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Material (select all that apply)</Text>
              <View style={styles.matRow}>
                {MATERIAL_OPTIONS.map((m) => {
                  const isNone = m.id === "";
                  const active = isNone
                    ? superstructureMaterials.length === 0
                    : superstructureMaterials.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id || "not-set"}
                      style={[
                        styles.matChip,
                        {
                          backgroundColor: active ? "#0f172a" : c.secondary,
                          borderColor: active ? "#38bdf8" : c.border,
                        },
                      ]}
                      onPress={() => {
                        if (isNone) {
                          setSuperstructureMaterials([]);
                        } else {
                          const without = superstructureMaterials.filter((x) => x !== m.id);
                          setSuperstructureMaterials(active ? without : [...without, m.id]);
                        }
                      }}
                    >
                      <Text style={[styles.matChipText, { color: active ? "#38bdf8" : c.mutedForeground }]}>
                        {m.label}
                      </Text>
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
                  const active = substructureTypes.includes(t.id);
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
                      onPress={() => {
                        if (t.id === "OTHER") {
                          setSubstructureTypes(["OTHER"]);
                        } else {
                          const without = substructureTypes.filter((x) => x !== "OTHER" && x !== t.id);
                          const next = active ? without : [...without, t.id];
                          setSubstructureTypes(next.length > 0 ? next : ["OTHER"]);
                        }
                      }}
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
              <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Material (select all that apply)</Text>
              <View style={styles.matRow}>
                {MATERIAL_OPTIONS.map((m) => {
                  const isNone = m.id === "";
                  const active = isNone
                    ? substructureMaterials.length === 0
                    : substructureMaterials.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id || "not-set"}
                      style={[
                        styles.matChip,
                        {
                          backgroundColor: active ? "#1a0f2e" : c.secondary,
                          borderColor: active ? "#a78bfa" : c.border,
                        },
                      ]}
                      onPress={() => {
                        if (isNone) {
                          setSubstructureMaterials([]);
                        } else {
                          const without = substructureMaterials.filter((x) => x !== m.id);
                          setSubstructureMaterials(active ? without : [...without, m.id]);
                        }
                      }}
                    >
                      <Text style={[styles.matChipText, { color: active ? "#a78bfa" : c.mutedForeground }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Active summary pill */}
            <View style={[styles.buildSummary, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <View style={styles.buildSummaryItem}>
                <Text style={[styles.buildSummaryLabel, { color: c.mutedForeground }]}>Super</Text>
                <Text style={[styles.buildSummaryValue, { color: "#38bdf8" }]} numberOfLines={2}>
                  {superstructureTypes
                    .map((id) => SUPERSTRUCTURE_TYPES.find((t) => t.id === id)?.label ?? id)
                    .join(", ") || "—"}
                </Text>
                <Text style={[styles.buildSummaryMat, { color: c.mutedForeground }]}>
                  {superstructureMaterials.length > 0 ? superstructureMaterials.join(", ") : "Any material"}
                </Text>
              </View>
              <View style={[styles.buildSummaryDivider, { backgroundColor: c.border }]} />
              <View style={styles.buildSummaryItem}>
                <Text style={[styles.buildSummaryLabel, { color: c.mutedForeground }]}>Sub</Text>
                <Text style={[styles.buildSummaryValue, { color: "#a78bfa" }]} numberOfLines={2}>
                  {substructureTypes
                    .map((id) => SUBSTRUCTURE_TYPES.find((t) => t.id === id)?.label ?? id)
                    .join(", ") || "—"}
                </Text>
                <Text style={[styles.buildSummaryMat, { color: c.mutedForeground }]}>
                  {substructureMaterials.length > 0 ? substructureMaterials.join(", ") : "Any material"}
                </Text>
              </View>
            </View>
          </View>

          {/* Photo Settings */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="camera" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Photo Settings</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Output size applied when photos are captured or imported. Larger sizes retain more detail.
            </Text>
            <View style={styles.matRow}>
              {[
                { key: "original", label: "Original" },
                { key: "4x6", label: '4"×6"' },
                { key: "5x7", label: '5"×7"' },
                { key: "8x10", label: '8"×10"' },
              ].map((opt) => {
                const active = imageSize === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.matChip,
                      {
                        borderColor: active ? "#38bdf8" : c.border,
                        backgroundColor: active ? "rgba(56,189,248,0.12)" : c.secondary,
                      },
                    ]}
                    onPress={() => setImageSize(opt.key)}
                  >
                    <Text style={[styles.matChipText, { color: active ? "#38bdf8" : c.mutedForeground }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.clearDivider, { borderTopColor: c.border }]} />
            <Text style={[styles.matLabel, { color: c.mutedForeground }]}>Aspect Ratio</Text>
            <Text style={[styles.cardDesc, { color: c.mutedForeground, marginBottom: 8 }]}>
              Optional crop ratio for camera captures (e.g. 4:3, 16:9). Leave blank for free-form.
            </Text>
            <View style={[styles.keyRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <TextInput
                style={[styles.keyInput, { color: c.foreground }]}
                value={aspectRatioInput}
                onChangeText={setAspectRatioInput}
                onBlur={() => setAspectRatio(aspectRatioInput.trim())}
                onSubmitEditing={() => setAspectRatio(aspectRatioInput.trim())}
                placeholder="e.g. 4:3"
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              {aspectRatioInput.trim() ? (
                <TouchableOpacity
                  onPress={() => { setAspectRatioInput(""); setAspectRatio(""); }}
                  style={styles.keyEye}
                >
                  <Feather name="x" size={14} color={c.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={[styles.clearDivider, { borderTopColor: c.border }]} />
            <View style={styles.photoToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: c.foreground }]}>Date Stamp</Text>
                <Text style={[styles.optionSub, { color: c.mutedForeground }]}>
                  Show the capture date on each photo (bottom right)
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleTrack,
                  { backgroundColor: dateStampEnabled ? "#0284c7" : c.muted, borderColor: dateStampEnabled ? "#38bdf8" : c.border },
                ]}
                onPress={() => setDateStampEnabled(!dateStampEnabled)}
              >
                <View style={[styles.toggleThumb, { alignSelf: dateStampEnabled ? "flex-end" : "flex-start" }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Data Management */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="trash-2" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Data Management</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Discard all imported and recorded inspection data to start a fresh session. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={[
                styles.clearBtn,
                {
                  borderColor: hasInspectionData ? "#7f1d1d" : c.border,
                  backgroundColor: hasInspectionData ? "#1f0a0a" : c.muted,
                },
              ]}
              onPress={handleClearInspection}
              disabled={!hasInspectionData}
            >
              <Feather
                name="trash-2"
                size={16}
                color={hasInspectionData ? "#f87171" : c.mutedForeground}
              />
              <Text
                style={[
                  styles.clearBtnText,
                  { color: hasInspectionData ? "#fca5a5" : c.mutedForeground },
                ]}
              >
                {hasInspectionData ? "Clear Inspection" : "No Inspection Data"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* AI Transcription */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="mic" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>AI Transcription</Text>
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Dictate inspection notes using the mic button on the Elements and NBI tabs. Whisper transcribes your speech; optionally GPT-4o-mini reformats it into a professional narrative.
            </Text>

            {/* API key input */}
            <View style={[styles.keyRow, { borderColor: c.border, backgroundColor: c.background }]}>
              <TextInput
                style={[styles.keyInput, { color: c.foreground }]}
                value={keyInput || (openAiKey ? "sk-••••••••••••••••••••••••••••••••••••••••••••••••" : "")}
                onFocus={() => setKeyInput(openAiKey)}
                onChangeText={setKeyInput}
                secureTextEntry={!keyVisible}
                placeholder="Paste OpenAI API key…"
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setKeyVisible((v) => !v)} style={styles.keyEye}>
                <Feather name={keyVisible ? "eye-off" : "eye"} size={14} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.keyActions}>
              <TouchableOpacity
                style={[styles.keyBtn, { backgroundColor: "#0c4a6e", borderColor: "#0284c7" }]}
                onPress={() => {
                  const trimmed = keyInput.trim();
                  if (!trimmed) return;
                  setOpenAiKey(trimmed);
                  setKeyInput("");
                  Alert.alert("Saved", "OpenAI API key saved.");
                }}
              >
                <Feather name="check" size={13} color="#38bdf8" />
                <Text style={[styles.keyBtnText, { color: "#38bdf8" }]}>Save Key</Text>
              </TouchableOpacity>
              {openAiKey ? (
                <TouchableOpacity
                  style={[styles.keyBtn, { backgroundColor: "#1f0a0a", borderColor: "#7f1d1d" }]}
                  onPress={() => {
                    setOpenAiKey("");
                    setKeyInput("");
                    Alert.alert("Cleared", "OpenAI API key removed.");
                  }}
                >
                  <Feather name="trash-2" size={13} color="#f87171" />
                  <Text style={[styles.keyBtnText, { color: "#fca5a5" }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* AI Rephrasing toggle */}
            <View style={styles.photoToggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: aiRephrase ? "#0c4a6e" : c.muted,
                    borderColor: aiRephrase ? "#0284c7" : c.border,
                  },
                ]}
                onPress={() => setAiRephrase(!aiRephrase)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      alignSelf: aiRephrase ? "flex-end" : "flex-start",
                      backgroundColor: aiRephrase ? "#38bdf8" : c.mutedForeground,
                    },
                  ]}
                />
              </TouchableOpacity>
              <Text style={[styles.cardDesc, { color: c.foreground, flex: 1, marginBottom: 0 }]}>
                AI Rephrasing (GPT-4o-mini)
              </Text>
            </View>
          </View>

          {/* Text Shortcuts */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setScExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Feather name="type" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground, flex: 1 }]}>Text Shortcuts</Text>
              <Feather name={scExpanded ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              {scExpanded
                ? "Tap \u2606 to favorite a shortcut for quick toolbar access."
                : "Manage snippets used in the PDF annotator. Tap \u2606 to favorite for quick access."}
            </Text>
            {scExpanded && (
              <>
                {/* Add custom shortcut */}
                <View style={[styles.scAddForm, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Text style={[styles.scSectionTitle, { color: c.foreground, marginBottom: 4 }]}>Add Custom Shortcut</Text>
                  <TextInput
                    style={[styles.scInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.secondary }]}
                    value={newLabel}
                    onChangeText={setNewLabel}
                    placeholder="Label (e.g. Hairline cracks observed)"
                    placeholderTextColor={c.mutedForeground}
                    autoCapitalize="sentences"
                  />
                  <TextInput
                    style={[styles.scInput, styles.scTextArea, { color: c.foreground, borderColor: c.border, backgroundColor: c.secondary }]}
                    value={newText}
                    onChangeText={setNewText}
                    placeholder="Full inspection text..."
                    placeholderTextColor={c.mutedForeground}
                    multiline
                    numberOfLines={3}
                    autoCapitalize="sentences"
                  />
                  <TouchableOpacity
                    style={[styles.scAddBtn, { backgroundColor: "#0c4a6e", borderColor: "#0284c7", opacity: (!newLabel.trim() || !newText.trim()) ? 0.45 : 1 }]}
                    onPress={addSc}
                    disabled={!newLabel.trim() || !newText.trim()}
                  >
                    <Feather name="plus" size={13} color="#38bdf8" />
                    <Text style={[styles.keyBtnText, { color: "#38bdf8" }]}>Add Shortcut</Text>
                  </TouchableOpacity>
                </View>

                {/* Custom shortcuts list */}
                {customShortcuts.length > 0 && (
                  <View style={styles.scSection}>
                    <Text style={[styles.scSectionTitle, { color: "#a78bfa" }]}>Custom ({customShortcuts.length})</Text>
                    {customShortcuts.map((s) => (
                      <View key={s.id} style={[styles.scRow, { borderColor: c.border, backgroundColor: c.background }]}>
                        {editingId === s.id ? (
                          <View style={{ flex: 1, gap: 6 }}>
                            <TextInput
                              style={[styles.scInput, { color: c.foreground, borderColor: "#38bdf8", backgroundColor: c.secondary }]}
                              value={editLabel}
                              onChangeText={setEditLabel}
                              autoFocus
                              autoCapitalize="sentences"
                            />
                            <TextInput
                              style={[styles.scInput, styles.scTextArea, { color: c.foreground, borderColor: "#38bdf8", backgroundColor: c.secondary }]}
                              value={editText}
                              onChangeText={setEditText}
                              multiline
                              numberOfLines={3}
                              autoCapitalize="sentences"
                            />
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <TouchableOpacity
                                style={[styles.scAddBtn, { backgroundColor: "#022c22", borderColor: "#064e3b", flex: 1 }]}
                                onPress={() => commitEdit(s.id)}
                              >
                                <Feather name="check" size={13} color="#34d399" />
                                <Text style={[styles.keyBtnText, { color: "#34d399" }]}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.scAddBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
                                onPress={() => setEditingId(null)}
                              >
                                <Feather name="x" size={13} color={c.mutedForeground} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.scLabel, { color: c.foreground }]}>{s.label}</Text>
                              <Text style={[styles.scText, { color: c.mutedForeground }]} numberOfLines={1}>{s.text}</Text>
                            </View>
                            <TouchableOpacity onPress={() => toggleFav(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={{ fontSize: 16, color: scFavs.includes(s.id) ? "#a78bfa" : c.muted }}>
                                {scFavs.includes(s.id) ? "\u2605" : "\u2606"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => startEdit(s)} style={styles.scIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Feather name="edit-2" size={13} color="#38bdf8" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                Alert.alert("Delete Shortcut", `Delete "${s.label}"?`, [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Delete", style: "destructive", onPress: () => deleteSc(s.id) },
                                ])
                              }
                              style={styles.scIconBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="trash-2" size={13} color="#f87171" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Built-in shortcuts */}
                <View style={styles.scSection}>
                  <Text style={[styles.scSectionTitle, { color: c.mutedForeground }]}>
                    Built-in ({TEXT_SHORTCUTS.filter((s) => !scHidden.includes(s.id)).length})
                  </Text>
                  {TEXT_SHORTCUTS.filter((s) => !scHidden.includes(s.id)).map((s) => {
                    const effective = scOverrides[s.id] ? { ...s, ...scOverrides[s.id] } : s;
                    const isEditing = editingBuiltinId === s.id;
                    return (
                      <View key={s.id} style={[styles.scRow, { borderColor: c.border, backgroundColor: c.background }]}>
                        {isEditing ? (
                          <View style={{ flex: 1, gap: 6 }}>
                            <TextInput
                              style={[styles.scInput, { color: c.foreground, borderColor: "#38bdf8", backgroundColor: c.secondary }]}
                              value={editBuiltinLabel}
                              onChangeText={setEditBuiltinLabel}
                              autoFocus
                              autoCapitalize="sentences"
                            />
                            <TextInput
                              style={[styles.scInput, styles.scTextArea, { color: c.foreground, borderColor: "#38bdf8", backgroundColor: c.secondary }]}
                              value={editBuiltinText}
                              onChangeText={setEditBuiltinText}
                              multiline
                              numberOfLines={3}
                              autoCapitalize="sentences"
                            />
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <TouchableOpacity
                                style={[styles.scAddBtn, { backgroundColor: "#022c22", borderColor: "#064e3b", flex: 1 }]}
                                onPress={() => commitBuiltinEdit(s.id)}
                              >
                                <Feather name="check" size={13} color="#34d399" />
                                <Text style={[styles.keyBtnText, { color: "#34d399" }]}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.scAddBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
                                onPress={() => setEditingBuiltinId(null)}
                              >
                                <Feather name="x" size={13} color={c.mutedForeground} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Text style={[styles.scLabel, { color: c.foreground }]}>{effective.label}</Text>
                                {scOverrides[s.id] && (
                                  <Text style={{ fontSize: 9, color: "#f59e0b", fontWeight: "700" }}>EDITED</Text>
                                )}
                              </View>
                              <Text style={[styles.scText, { color: c.mutedForeground }]} numberOfLines={1}>{effective.text}</Text>
                            </View>
                            {scOverrides[s.id] && (
                              <TouchableOpacity
                                onPress={() => { const next = { ...scOverrides }; delete next[s.id]; saveOverrides(next); }}
                                style={styles.scIconBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="rotate-ccw" size={11} color="#78716c" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => toggleFav(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={{ fontSize: 16, color: scFavs.includes(s.id) ? "#a78bfa" : c.muted }}>
                                {scFavs.includes(s.id) ? "\u2605" : "\u2606"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => startEditBuiltin(s)} style={styles.scIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Feather name="edit-2" size={13} color="#38bdf8" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                Alert.alert("Hide Shortcut", `Hide "${effective.label}" from the list?`, [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Hide", style: "destructive", onPress: () => saveHidden([...scHidden, s.id]) },
                                ])
                              }
                              style={styles.scIconBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="eye-off" size={13} color="#f87171" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    );
                  })}
                  {/* Restore hidden built-ins */}
                  {scHidden.length > 0 && (
                    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
                      <Text style={[styles.scSectionTitle, { color: "#78716c" }]}>Hidden ({scHidden.length}) — tap to restore</Text>
                      {TEXT_SHORTCUTS.filter((s) => scHidden.includes(s.id)).map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.scRow, { borderColor: c.border, backgroundColor: c.background, opacity: 0.55 }]}
                          onPress={() => saveHidden(scHidden.filter((id) => id !== s.id))}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.scLabel, { color: c.mutedForeground }]}>{s.label}</Text>
                          </View>
                          <Feather name="eye" size={13} color="#78716c" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Cloud Sync */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="cloud" size={15} color={c.mutedForeground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Cloud Sync</Text>
              {syncStatus === "success" && (
                <View style={styles.syncBadge}>
                  <Feather name="check" size={10} color="#34d399" />
                  <Text style={styles.syncBadgeText}>Synced</Text>
                </View>
              )}
              {(syncStatus === "queued" || (syncStatus === "idle" && pendingSyncCount > 0)) && (
                <View style={[styles.syncBadge, { backgroundColor: "#1c1917", borderColor: "#78350f" }]}>
                  <Feather name="clock" size={10} color="#fbbf24" />
                  <Text style={[styles.syncBadgeText, { color: "#fbbf24" }]}>
                    {pendingSyncCount > 0 ? `${pendingSyncCount} queued` : "Queued"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardDesc, { color: c.mutedForeground }]}>
              Uploads defect records, NBI ratings, redlined PDF, and photos. When offline, data is queued and uploads automatically when connectivity returns.
            </Text>
            {pendingSyncCount > 0 && syncStatus !== "syncing" && (
              <View style={[styles.syncErrorBox, { backgroundColor: "#1c1917", borderColor: "#78350f" }]}>
                <Feather name="wifi-off" size={13} color="#fbbf24" />
                <Text style={[styles.syncErrorText, { color: "#fde68a" }]}>
                  {pendingSyncCount} inspection{pendingSyncCount !== 1 ? "s" : ""} queued — will sync automatically when online.
                </Text>
              </View>
            )}
            {lastSynced && syncStatus !== "error" && syncStatus !== "validation_error" && syncStatus !== "queued" && pendingSyncCount === 0 && (
              <View style={styles.syncMeta}>
                <Feather name="clock" size={11} color="#475569" />
                <Text style={[styles.syncMetaText, { color: "#475569" }]}>
                  Last synced {formatRelativeTime(lastSynced)}
                </Text>
              </View>
            )}
            {(syncStatus === "error" || syncStatus === "validation_error") && (
              <View style={[styles.syncErrorBox, { backgroundColor: "#1f0a0a", borderColor: "#7f1d1d" }]}>
                <Feather name="alert-circle" size={13} color="#f87171" />
                <Text style={styles.syncErrorText}>
                  {syncError}{syncStatus === "error" ? " Queued for retry." : ""}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.syncBtn,
                {
                  backgroundColor:
                    syncStatus === "success" ? "#022c22"
                    : syncStatus === "queued" ? "#1c1917"
                    : "#0c4a6e",
                  borderColor:
                    syncStatus === "error" || syncStatus === "validation_error" ? "#7f1d1d"
                    : syncStatus === "success" ? "#064e3b"
                    : syncStatus === "queued" ? "#78350f"
                    : "#0284c7",
                  opacity: syncStatus === "syncing" ? 0.6 : 1,
                },
              ]}
              onPress={handleSync}
              disabled={syncStatus === "syncing"}
            >
              {syncStatus === "syncing" ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : (
                <Feather
                  name={
                    syncStatus === "success" ? "check-circle"
                    : syncStatus === "validation_error" ? "alert-circle"
                    : syncStatus === "error" ? "refresh-cw"
                    : syncStatus === "queued" ? "clock"
                    : "upload"
                  }
                  size={16}
                  color={
                    syncStatus === "success" ? "#34d399"
                    : syncStatus === "error" || syncStatus === "validation_error" ? "#f87171"
                    : syncStatus === "queued" ? "#fbbf24"
                    : "#38bdf8"
                  }
                />
              )}
              <Text style={[
                styles.syncBtnText,
                {
                  color:
                    syncStatus === "success" ? "#34d399"
                    : syncStatus === "error" || syncStatus === "validation_error" ? "#fca5a5"
                    : syncStatus === "queued" ? "#fde68a"
                    : "#f8fafc",
                },
              ]}>
                {syncStatus === "syncing" ? "Syncing…"
                  : syncStatus === "success" ? "Synced!"
                  : syncStatus === "validation_error" ? "Correct Date to Sync"
                  : syncStatus === "error" ? "Retry Sync"
                  : syncStatus === "queued" ? "Queued — tap to retry"
                  : "Sync to Cloud"}
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
  assignmentGroup: { gap: 8 },
  assignmentBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  assignmentIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
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
  matLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 },
  matRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  matChip: {
    borderRadius: 8,
    borderWidth: 1.5,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  matChipText: { fontSize: 12, fontWeight: "700" },
  photoToggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: "center", paddingHorizontal: 2 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
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
  buildSummaryMat: { fontSize: 10, fontWeight: "600", marginTop: 1 },
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
  clearDivider: { borderTopWidth: 1, marginVertical: 2 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#022c22",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginLeft: "auto" as const,
  },
  syncBadgeText: { fontSize: 10, fontWeight: "700" as const, color: "#34d399" },
  syncMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  syncMetaText: { fontSize: 11, fontWeight: "500" as const },
  syncErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  syncErrorText: { fontSize: 12, fontWeight: "500" as const, color: "#fca5a5", flex: 1, lineHeight: 17 },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncBtnText: { fontSize: 13, fontWeight: "800" as const, textTransform: "uppercase" as const },
  keyRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  keyInput: { flex: 1, fontSize: 12, fontWeight: "600" as const, paddingVertical: 10 },
  keyEye: { padding: 4 },
  keyActions: { flexDirection: "row" as const, gap: 8 },
  keyBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  keyBtnText: { fontSize: 12, fontWeight: "800" as const, textTransform: "uppercase" as const },
  scAddForm: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  scSection: { gap: 4 },
  scSectionTitle: { fontSize: 10, fontWeight: "800" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  scRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  scLabel: { fontSize: 12, fontWeight: "700" as const },
  scText: { fontSize: 10, fontWeight: "500" as const, marginTop: 1 },
  scIconBtn: { padding: 2 },
  scInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: "500" as const,
  },
  scTextArea: { minHeight: 60, textAlignVertical: "top" as const },
  scAddBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});
