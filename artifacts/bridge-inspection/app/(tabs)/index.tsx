import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { resizePhoto } from "@/lib/photoUtils";
import * as Location from "expo-location";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lookupCS } from "@/data/csDescriptions";
import { useIsTablet } from "@/hooks/useIsTablet";

import { useColors } from "@/hooks/useColors";
import { effectiveZone, isInZone, sortForUnderwater, ZONE_FILTERS } from "@/utils/elementZones";
import {
  DEFECTS_BY_ELEMENT,
  INSPECTION_TYPES,
  NOMENCLATURES,
  SNBI_ELEMENTS,
  PhotoItem,
  ConditionState,
  getConditionQuantities,
  getTotalConditionQuantity,
  getWorstConditionState,
  useInspection,
} from "@/context/InspectionContext";

import { DefectCard } from "@/components/DefectCard";
import { CIFModal } from "@/components/CIFModal";
import { FUAModal } from "@/components/FUAModal";
import { UnderclearanceModal } from "@/components/UnderclearanceModal";
import { ChannelModal } from "@/components/ChannelModal";
import { DailySafetyBriefingModal } from "@/components/DailySafetyBriefingModal";
import { SnbiModal } from "@/components/SnbiModal";
import { SteelPipePileModal } from "@/components/SteelPipePileModal";
import { SettingsModal } from "@/components/SettingsModal";
import { SpeechToTextButton } from "@/components/SpeechToTextButton";
import colors from "@/constants/colors";

const CS_OPTIONS = ["CS1", "CS2", "CS3", "CS4"] as const;

const TOPSIDE_CATS = new Set(["Deck", "Railing", "Joint"]);
const UNDERSIDE_CATS = new Set(["Superstructure", "Substructure", "Bearing"]);

const ELEMENT_CATEGORY_BY_ID: Record<string, string> = Object.fromEntries(
  SNBI_ELEMENTS.map((el) => [el.id, el.category])
);
const CS_COLORS: Record<string, string> = {
  CS1: colors.light.cs1,
  CS2: colors.light.cs2,
  CS3: colors.light.cs3,
  CS4: colors.light.cs4,
};

export default function InspectionScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTabletLayout = useIsTablet();
  const {
    inspectionType,
    setInspectionType,
    editId,
    setEditId,
    currentLocation,
    setCurrentLocation,
    element,
    setElement,
    defect,
    setDefect,
    conditionQuantities,
    setConditionQuantities,
    quantity,
    setQuantity,
    maintenanceQuantity,
    setMaintenanceQuantity,
    locationDesc,
    setLocationDesc,
    isCritical,
    setIsCritical,
    isMaintenance,
    setIsMaintenance,
    photos,
    setPhotos,
    locationSequence,
    filteredElements,
    elementSearch,
    setElementSearch,
    elementZoneFilter,
    setElementZoneFilter,
    includeUndersideUnderwater,
    setIncludeUndersideUnderwater,
    zoneOptions,
    activeElementIds,
    setActiveElementIds,
    resetElementFilters,
    sessionManifest,
    legacyManifest,
    savedDefects,
    setSavedDefects,
    handleSave,
    startEdit,
    sortCriteria,
    setSortCriteria,
    filterType,
    setFilterType,
    rangeMin,
    setRangeMin,
    rangeMax,
    setRangeMax,
    syncToCurrentLoc,
    setSyncToCurrentLoc,
    structureNumber,
    setStructureNumber,
    nomenclature,
    setShowUnderclearanceModal,
    setShowChannelModal,
    setShowDailySafetyModal,
    setShowSnbiModal,
    setShowSteelPipePileModal,
    imageSize,
    dateStampEnabled,
    hasUnsyncedChanges,
    setLastPhotoSource,
  } = useInspection();
  const router = useRouter();

  const scrollRef = React.useRef<ScrollView>(null);

  const handleEdit = React.useCallback(
    (record: Parameters<typeof startEdit>[0]) => {
      startEdit(record);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    [startEdit],
  );

  const { focus, focusTs } = useLocalSearchParams<{ focus?: string; focusTs?: string }>();
  const handledFocusRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    // focusTs is a per-tap nonce; resolve each deep-link once, but keep manifests
    // in deps so a link that arrives before data is ready still resolves on load.
    const nonce = focusTs ?? focus;
    if (!focus || !nonce || handledFocusRef.current === nonce) return;
    const target =
      sessionManifest.find((d) => d.id === focus) ?? legacyManifest.find((d) => d.id === focus);
    if (target) {
      startEdit(target);
      handledFocusRef.current = nonce;
    }
  }, [focus, focusTs, sessionManifest, legacyManifest, startEdit]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [csHelpVisible, setCsHelpVisible] = useState(false);
  const [csHelpHighlight, setCsHelpHighlight] = useState<string>("");
  const isTxDot = nomenclature === NOMENCLATURES.TXDOT;
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [elementPickerOpen, setElementPickerOpen] = useState(false);
  const [defectPickerOpen, setDefectPickerOpen] = useState(false);
  const [severityPickerOpen, setSeverityPickerOpen] = useState(false);
  const [editingShortlist, setEditingShortlist] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showLegacyCS1, setShowLegacyCS1] = useState(false);
  const [showAllLegacySides, setShowAllLegacySides] = useState(false);

  const leaveInspection = React.useCallback(() => {
    const goToBridges = () => router.navigate("/bridges");
    if (hasUnsyncedChanges) {
      const message = "You have data that hasn't been submitted. Leaving this inspection will keep it as the active draft.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm(message)) {
          goToBridges();
        }
        return;
      }
      Alert.alert(
        "Unsubmitted Changes",
        message,
        [
          { text: "Stay Here", style: "cancel" },
          { text: "Go to Bridges", onPress: goToBridges },
        ],
      );
    } else {
      goToBridges();
    }
  }, [hasUnsyncedChanges, router]);

  const startAnotherInspection = React.useCallback(() => {
    router.navigate({
      pathname: "/bridges",
      params: { newInspection: Date.now().toString() },
    });
  }, [router]);
  const addPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setLastPhotoSource("library");
      const capturedAt = new Date().toISOString();
      const newPhotos: PhotoItem[] = await Promise.all(
        result.assets.map(async (a, index) => ({
          uri: await resizePhoto(a.uri, imageSize, a.width, a.height),
          description: "",
          photoId: `draft_photo_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          capturedAt,
          source: "library",
          fileName: a.fileName ?? undefined,
          directionTags: [],
          subjectTags: [],
        }))
      );
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const capturePhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Camera not available on web preview.");
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setLastPhotoSource("camera");
      let heading: number | null = null;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const h = await Location.getHeadingAsync();
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (raw >= 0) heading = Math.round(raw);
        }
      } catch {}
      const asset = result.assets[0];
      const uri = await resizePhoto(asset.uri, imageSize, asset.width, asset.height);
       setPhotos([...photos, {
         uri,
         description: "",
         photoId: `draft_photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
         heading,
         capturedAt: new Date().toISOString(),
         source: "camera",
         fileName: asset.fileName ?? undefined,
         directionTags: [],
         subjectTags: [],
       }]);
    }
  };

  const updatePhotoDesc = (idx: number, desc: string) => {
    const updated = [...photos];
    updated[idx] = { ...updated[idx], description: desc };
    setPhotos(updated);
  };

  const removePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const onSave = () => {
    const hasConditionQuantity = Object.values(conditionQuantities).some(
      (value) => (parseFloat(value || "") || 0) > 0
    );
    if (!element || !defect || !hasConditionQuantity) {
      Alert.alert("Missing Fields", "Please fill in element, defect, and quantity.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleSave();
  };

  const cancelEdit = () => {
    setEditId(null);
    setConditionQuantities({});
    setQuantity("");
    setMaintenanceQuantity("");
    setLocationDesc("");
    setIsCritical(false);
    setIsMaintenance(false);
    setPhotos([]);
  };

  const availableDefects = element ? DEFECTS_BY_ELEMENT[element.id] || [] : [];
  // Shortlist editing lists the whole catalog for the chosen zone (no
  // location/structure-type narrowing) so any element can be starred.
  const shortlistElements = React.useMemo(() => {
    const query = elementSearch.trim().toLowerCase();
    const zone = effectiveZone(elementZoneFilter, inspectionType);
    const list = SNBI_ELEMENTS.filter((item) => {
      const inZone = !!query || isInZone(item, zone, zoneOptions);
      return inZone && (!query
        || `${item.id} ${item.name} ${item.category} ${item.material}`.toLowerCase().includes(query));
    });
    return zone === "Underwater" && !query ? sortForUnderwater(list, zoneOptions) : list;
  }, [elementSearch, elementZoneFilter, inspectionType, zoneOptions]);
  const underwaterZoneActive = effectiveZone(elementZoneFilter, inspectionType) === "Underwater";
  const displayedElements = editingShortlist ? shortlistElements : filteredElements;

  const applyConditionQuantitiesToLoggedDefects = () => {
    if (!element) return;
    const values = (["CS1", "CS2", "CS3", "CS4"] as ConditionState[])
      .map((state) => ({ state, value: conditionQuantities[state]?.trim() || "" }))
      .filter(({ value }) => value && (parseFloat(value) || 0) > 0);
    if (values.length === 0) {
      Alert.alert("Enter a Quantity", "Enter at least one condition quantity before applying it.");
      return;
    }
    const matches = savedDefects.filter(
      (record) => record.location === currentLocation && record.elementId === element.id
    );
    if (matches.length === 0) {
      Alert.alert("No Logged Defects", "Save a defect for this element and location before bulk-applying a state.");
      return;
    }
    const apply = () => {
      setSavedDefects(savedDefects.map((record) => {
        if (record.location !== currentLocation || record.elementId !== element.id) return record;
        const nextQuantities = { ...getConditionQuantities(record) };
        for (const { state, value } of values) nextQuantities[state] = value;
        const total = (["CS1", "CS2", "CS3", "CS4"] as ConditionState[])
          .reduce((sum, key) => sum + (parseFloat(nextQuantities[key] || "") || 0), 0);
        const previousTotal = getTotalConditionQuantity(record);
        const maintenanceWasDerived = !record.maintenanceQuantityValue
          || (parseFloat(record.maintenanceQuantityValue) || 0) === previousTotal;
        const unit = record.quantityValue
          ? record.quantity.replace(record.quantityValue, "").trim()
          : defect?.unit || "ea";
        return {
          ...record,
          conditionQuantities: nextQuantities,
          cs: getWorstConditionState(nextQuantities),
          quantityValue: String(total),
          maintenanceQuantityValue: maintenanceWasDerived
            ? String(total)
            : record.maintenanceQuantityValue,
          quantity: `${total} ${unit || "ea"}`,
        };
      }));
    };
    const appliedValues = values.map(({ state, value }) => `${state} = ${value}`).join(", ");
    const message = `Apply ${appliedValues} to ${matches.length} logged defect${matches.length === 1 ? "" : "s"} for this element at ${currentLocation}?`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) apply();
    } else {
      Alert.alert("Apply Quantities to Matching Defects", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Apply", onPress: apply },
      ]);
    }
  };

  const filteredLegacyManifest = React.useMemo(() => {
    return legacyManifest.filter((d) => {
      if (!showLegacyCS1 && d.cs === "CS1") return false;
      if (!showAllLegacySides) {
        const cat = ELEMENT_CATEGORY_BY_ID[d.elementId];
        if (inspectionType === INSPECTION_TYPES.TOPSIDE && cat && UNDERSIDE_CATS.has(cat)) return false;
        if (inspectionType === INSPECTION_TYPES.UNDERSIDE && cat && TOPSIDE_CATS.has(cat)) return false;
      }
      return true;
    });
  }, [legacyManifest, showLegacyCS1, showAllLegacySides, inspectionType]);

  const legacyCS1Count = React.useMemo(
    () => legacyManifest.filter((d) => d.cs === "CS1").length,
    [legacyManifest]
  );

  const legacyHiddenBySide = React.useMemo(() => {
    if (showAllLegacySides) return 0;
    return legacyManifest.filter((d) => {
      const cat = ELEMENT_CATEGORY_BY_ID[d.elementId];
      if (inspectionType === INSPECTION_TYPES.TOPSIDE && cat && UNDERSIDE_CATS.has(cat)) return true;
      if (inspectionType === INSPECTION_TYPES.UNDERSIDE && cat && TOPSIDE_CATS.has(cat)) return true;
      return false;
    }).length;
  }, [legacyManifest, showAllLegacySides, inspectionType]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* ── App Header ── */}
      <View style={[styles.appHeader, { backgroundColor: c.headerBg, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitle}>
            <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setModuleMenuOpen((v) => !v)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="menu" size={18} color="#e2e8f0" />
              </TouchableOpacity>
            <Feather name="activity" size={16} color="#38bdf8" />
            <View>
              <Text style={styles.headerTitleText}>Bridge Elements</Text>
              <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 1 }}>
                {structureNumber ? structureNumber : "No bridge selected — go to Bridges tab"}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.moduleToggleHeaderBtn,
                {
                  backgroundColor:
                    inspectionType === INSPECTION_TYPES.TOPSIDE
                      ? "#0284c7"
                      : inspectionType === INSPECTION_TYPES.UNDERWATER
                        ? "#0369a1"
                        : "#0f172a",
                },
              ]}
              onPress={() => setModeMenuOpen(true)}
            >
              <Feather
                name={
                  inspectionType === INSPECTION_TYPES.TOPSIDE
                    ? "arrow-up"
                    : inspectionType === INSPECTION_TYPES.UNDERWATER
                      ? "droplet"
                      : "arrow-down"
                }
                size={12}
                color={inspectionType === INSPECTION_TYPES.TOPSIDE ? "#fff" : "#38bdf8"}
              />
              <Text style={[
                styles.moduleToggleHeaderText,
                { color: inspectionType === INSPECTION_TYPES.TOPSIDE ? "#fff" : "#38bdf8" },
              ]}>
                {inspectionType}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gearBtn}
              onPress={() => setSettingsOpen(true)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="settings" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerQuickActions}>
          <TouchableOpacity
            style={styles.headerQuickAction}
            onPress={leaveInspection}
            accessibilityRole="button"
            accessibilityLabel="Back to Bridges"
          >
            <Feather name="arrow-left" size={14} color="#38bdf8" />
            <Text style={styles.headerQuickActionText}>Bridges</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerQuickAction}
            onPress={startAnotherInspection}
            accessibilityRole="button"
            accessibilityLabel="Start a new inspection"
          >
            <Feather name="plus" size={14} color="#38bdf8" />
            <Text style={styles.headerQuickActionText}>New Inspection</Text>
          </TouchableOpacity>
        </View>
      </View>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ── CS Condition State Help Modal (long-press on CS button) ── */}
      <Modal
        visible={csHelpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCsHelpVisible(false)}
      >
        <Pressable style={styles.csHelpBackdrop} onPress={() => setCsHelpVisible(false)}>
          <Pressable
            style={[styles.csHelpCard, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={styles.csHelpHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.csHelpTitle, { color: c.foreground }]}>Condition State Guide</Text>
                {element && defect ? (
                  <Text style={[styles.csHelpSubtitle, { color: c.mutedForeground }]} numberOfLines={1}>
                    {element.name} · {defect.name}
                  </Text>
                ) : (
                  <Text style={[styles.csHelpSubtitle, { color: c.mutedForeground }]}>
                    Select an element and defect to see AASHTO descriptions.
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setCsHelpVisible(false)} style={{ padding: 4 }}>
                <Feather name="x" size={18} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* CS rows */}
            {CS_OPTIONS.map((cs) => {
              const csDesc = element && defect
                ? lookupCS(defect.id, element.material, element.id)
                : null;
              const csKey = cs.toLowerCase() as "cs1" | "cs2" | "cs3" | "cs4";
              const descText = csDesc ? csDesc[csKey] : "No AASHTO description available for this defect.";
              const isHighlighted = cs === csHelpHighlight;
              return (
                <View
                  key={cs}
                  style={[
                    styles.csHelpRow,
                    isHighlighted && { backgroundColor: CS_COLORS[cs] + "18", borderColor: CS_COLORS[cs], borderWidth: 1.5, borderRadius: 10 },
                  ]}
                >
                  <View style={[styles.csHelpBadge, { backgroundColor: CS_COLORS[cs] }]}>
                    <Text style={styles.csHelpBadgeText}>{cs}</Text>
                  </View>
                  <Text style={[styles.csHelpDesc, { color: isHighlighted ? c.foreground : c.mutedForeground }]}>
                    {descText}
                  </Text>
                </View>
              );
            })}

            <Text style={[styles.csHelpHint, { color: c.mutedForeground }]}>
              Long-press any CS button to see these definitions · Source: AASHTO MBEI 2019
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── TxDOT module menu (hamburger dropdown) ── */}
      <Modal
        visible={moduleMenuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setModuleMenuOpen(false)}
      >
        <>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setModuleMenuOpen(false)}
        />
          <View style={[styles.menuDropdown, { backgroundColor: c.card, borderColor: c.border, left: isTabletLayout ? Math.round(screenWidth / 2) + 12 : 12 }]}>
            <Text style={[styles.menuHeading, { color: c.mutedForeground }]}>General</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setModuleMenuOpen(false);
                setSettingsOpen(true);
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#334155" }]}>
                <Feather name="settings" size={15} color="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuItemTitle, { color: c.foreground }]}>Inspection Settings</Text>
                <Text style={[styles.menuItemSub, { color: c.mutedForeground }]}>Type · Structure · Import PDF</Text>
              </View>
              <Feather name="chevron-right" size={16} color={c.mutedForeground} />
            </TouchableOpacity>
            {isTxDot && (
              <>
                <View style={[styles.menuDivider, { backgroundColor: c.border }]} />
                <Text style={[styles.menuHeading, { color: c.mutedForeground }]}>TxDOT Forms</Text>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setModuleMenuOpen(false);
                    setShowDailySafetyModal(true);
                  }}
                >
                  <View style={[styles.menuIcon, { backgroundColor: "#b91c1c" }]}>
                    <Feather name="shield" size={15} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: c.foreground }]}>Daily Safety Briefing</Text>
                    <Text style={[styles.menuItemSub, { color: c.mutedForeground }]}>Risk Assessment & Sign-Off</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                </TouchableOpacity>
                <View style={[styles.menuDivider, { backgroundColor: c.border }]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setModuleMenuOpen(false);
                    setShowChannelModal(true);
                  }}
                >
                  <View style={[styles.menuIcon, { backgroundColor: "#0369a1" }]}>
                    <Feather name="activity" size={15} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: c.foreground }]}>Channel Cross-Section</Text>
                    <Text style={[styles.menuItemSub, { color: c.mutedForeground }]}>Form 2600</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                </TouchableOpacity>
                <View style={[styles.menuDivider, { backgroundColor: c.border }]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setModuleMenuOpen(false);
                    setShowUnderclearanceModal(true);
                  }}
                >
                  <View style={[styles.menuIcon, { backgroundColor: "#0f766e" }]}>
                    <Feather name="minimize-2" size={15} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: c.foreground }]}>Underclearance Record</Text>
                    <Text style={[styles.menuItemSub, { color: c.mutedForeground }]}>Form 2601</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                </TouchableOpacity>
                <View style={[styles.menuDivider, { backgroundColor: c.border }]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setModuleMenuOpen(false);
                    setShowSnbiModal(true);
                  }}
                >
                  <View style={[styles.menuIcon, { backgroundColor: "#6d28d9" }]}>
                    <Feather name="clipboard" size={15} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: c.foreground }]}>Condition Ratings</Text>
                    <Text style={[styles.menuItemSub, { color: c.mutedForeground }]}>SNBI Field Collection</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      </Modal>

      {/* ── Inspection mode picker ── */}
      <Modal
        visible={modeMenuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setModeMenuOpen(false)}
      >
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setModeMenuOpen(false)} />
          <View
            style={[
              styles.modeDropdown,
              {
                backgroundColor: c.card,
                borderColor: c.border,
                right: isTabletLayout ? 12 : 10,
              },
            ]}
          >
            <Text style={[styles.menuHeading, { color: c.mutedForeground }]}>Inspection Mode</Text>
            <Text style={[styles.modeHint, { color: c.mutedForeground }]}>
              Choose the work area you are documenting.
            </Text>
            {[
              { type: INSPECTION_TYPES.TOPSIDE, icon: "arrow-up" as const, sub: "Deck, rails, and roadway" },
              { type: INSPECTION_TYPES.UNDERSIDE, icon: "arrow-down" as const, sub: "Superstructure and supports" },
              { type: INSPECTION_TYPES.UNDERWATER, icon: "droplet" as const, sub: "SCDOT underwater inspection" },
            ].map((option) => {
              const active = inspectionType === option.type;
              const unavailable = option.type === INSPECTION_TYPES.UNDERWATER && nomenclature !== NOMENCLATURES.SCDOT;
              return (
                <TouchableOpacity
                  key={option.type}
                  disabled={unavailable}
                  style={[
                    styles.modeOption,
                    {
                      backgroundColor: active ? "rgba(2,132,199,0.14)" : "transparent",
                      borderColor: active ? "#0284c7" : c.border,
                      opacity: unavailable ? 0.45 : 1,
                    },
                  ]}
                  onPress={() => {
                    setInspectionType(option.type);
                    setModeMenuOpen(false);
                  }}
                >
                  <View style={[styles.modeOptionIcon, { backgroundColor: active ? "#0284c7" : c.secondary }]}>
                    <Feather name={option.icon} size={15} color={active ? "#fff" : c.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeOptionTitle, { color: c.foreground }]}>{option.type}</Text>
                    <Text style={[styles.modeOptionSub, { color: c.mutedForeground }]}>
                      {unavailable ? "Select South Carolina (SCDOT) first" : option.sub}
                    </Text>
                  </View>
                  {active && <Feather name="check" size={17} color="#0284c7" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      </Modal>

      <KeyboardAwareScrollViewCompat
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* ── Location ── */}
        <View style={[styles.section, { backgroundColor: c.card, borderTopColor: c.headerBg }]}>
          <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Location</Text>
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: c.background, borderColor: c.border }]}
            onPress={() => setLocationPickerOpen(!locationPickerOpen)}
          >
            <Text style={[styles.pickerValue, { color: c.foreground }]}>{currentLocation || "Select location..."}</Text>
            <Feather name={locationPickerOpen ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
          </TouchableOpacity>
          {locationPickerOpen && (
            <ScrollView style={[styles.dropdownList, { borderColor: c.border }]} nestedScrollEnabled>
              {locationSequence.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.dropdownItem,
                    currentLocation === loc && { backgroundColor: c.primary + "20" },
                    { borderBottomColor: c.border },
                  ]}
                  onPress={() => {
                    setCurrentLocation(loc);
                    setLocationPickerOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: currentLocation === loc ? c.primary : c.foreground }]}>
                    {loc}
                  </Text>
                  {currentLocation === loc && <Feather name="check" size={14} color={c.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── SNBI Data Acquisition ── */}
        <View style={[styles.section, { backgroundColor: c.card, borderTopColor: c.primary }]}>
          {editId && (
            <View style={styles.editBanner}>
              <Feather name="edit-2" size={12} color="#fff" />
              <Text style={styles.editBannerText}>Modifying Record</Text>
              <TouchableOpacity onPress={cancelEdit} style={styles.cancelEditBtn}>
                <Feather name="x" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.sectionHeader}>
            <Feather name="file-text" size={14} color={c.mutedForeground} />
             <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Elements</Text>
          </View>

          {/* Element */}
           <View style={styles.elementFilterHeader}>
             <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Element</Text>
             <TouchableOpacity
               onPress={resetElementFilters}
               accessibilityRole="button"
               accessibilityLabel="Reset element filters and shortlist"
             >
               <Text style={[styles.resetFilterText, { color: c.primary }]}>Reset</Text>
             </TouchableOpacity>
           </View>
           <View style={styles.zoneFilterRow}>
             {ZONE_FILTERS.map((zone) => (
               <TouchableOpacity
                 key={zone}
                 accessibilityRole="button"
                 accessibilityState={{ selected: elementZoneFilter === zone }}
                 style={[
                   styles.zoneFilterBtn,
                   elementZoneFilter === zone
                     ? { backgroundColor: c.primary, borderColor: c.primary }
                     : { backgroundColor: c.secondary, borderColor: c.border },
                 ]}
                 onPress={() => setElementZoneFilter(zone)}
               >
                 <Text style={[styles.zoneFilterText, { color: elementZoneFilter === zone ? "#fff" : c.mutedForeground }]}>
                   {zone}
                 </Text>
               </TouchableOpacity>
             ))}
             <TouchableOpacity
               accessibilityRole="button"
               accessibilityState={{ expanded: editingShortlist }}
               style={[
                 styles.zoneFilterBtn,
                 editingShortlist
                   ? { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }
                   : { backgroundColor: c.secondary, borderColor: c.border },
               ]}
               onPress={() => {
                 setEditingShortlist((value) => !value);
                 setElementPickerOpen(true);
               }}
             >
               <Feather name="star" size={11} color={editingShortlist ? "#fff" : c.mutedForeground} />
               <Text style={[styles.zoneFilterText, { color: editingShortlist ? "#fff" : c.mutedForeground }]}>
                 {editingShortlist ? "Done" : `Shortlist${activeElementIds.length ? ` (${activeElementIds.length})` : ""}`}
               </Text>
             </TouchableOpacity>
           </View>
           {underwaterZoneActive && (
             <TouchableOpacity
               accessibilityRole="switch"
               accessibilityState={{ checked: includeUndersideUnderwater }}
               accessibilityLabel="Include underside elements in the underwater list"
               style={[
                 styles.zoneToggle,
                 includeUndersideUnderwater
                   ? { backgroundColor: c.primary, borderColor: c.primary }
                   : { backgroundColor: c.secondary, borderColor: c.border },
               ]}
               onPress={() => setIncludeUndersideUnderwater(!includeUndersideUnderwater)}
             >
               <Feather
                 name={includeUndersideUnderwater ? "check-square" : "square"}
                 size={12}
                 color={includeUndersideUnderwater ? "#fff" : c.mutedForeground}
               />
               <Text style={[styles.zoneFilterText, { color: includeUndersideUnderwater ? "#fff" : c.mutedForeground }]}>
                 {zoneOptions.culvertStructure ? "Include underside elements" : "Include underside elements (girders, bearings, deck)"}
               </Text>
             </TouchableOpacity>
           )}
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: c.background, borderColor: c.border }]}
            onPress={() => setElementPickerOpen(!elementPickerOpen)}
          >
            <Text style={[styles.pickerValue, { color: c.primary, fontWeight: "800" }]}>
              {element ? `${element.id} - ${element.name}` : "Select element..."}
            </Text>
            <Feather name={elementPickerOpen ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
          </TouchableOpacity>
          {elementPickerOpen && (
            <View style={[styles.dropdownPanel, { borderColor: c.border, backgroundColor: c.background }]}>
              <View style={[styles.elementSearchRow, { backgroundColor: c.background, borderBottomColor: c.border }]}>
                <Feather name="search" size={14} color={c.mutedForeground} />
                <TextInput
                  style={[styles.elementSearchInput, { color: c.foreground }]}
                  placeholder="Search all elements by name or #..."
                  placeholderTextColor={c.mutedForeground}
                  value={elementSearch}
                  onChangeText={setElementSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {elementSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setElementSearch("")} hitSlop={8}>
                    <Feather name="x" size={14} color={c.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.elementSearchHint, { color: c.mutedForeground, borderBottomColor: c.border }]}>
                {elementSearch.trim().length > 0
                  ? `${displayedElements.length} match${displayedElements.length === 1 ? "" : "es"}`
                  : editingShortlist
                    ? "Tap stars to maintain this bridge's active elements"
                    : activeElementIds.length > 0
                      ? `${displayedElements.length} active element${displayedElements.length === 1 ? "" : "s"}`
                      : `${displayedElements.length} common element${displayedElements.length === 1 ? "" : "s"} · search to find more`}
              </Text>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
               {displayedElements.length === 0 && (
                <Text style={[styles.dropdownEmpty, { color: c.mutedForeground }]}>
                  No elements match. Try a different search.
                </Text>
              )}
               {displayedElements.map((el) => (
                <TouchableOpacity
                  key={el.id}
                  style={[
                    styles.dropdownItem,
                    element?.id === el.id && { backgroundColor: c.primary + "20" },
                    { borderBottomColor: c.border },
                  ]}
                   accessibilityRole="button"
                   accessibilityLabel={editingShortlist
                     ? `${activeElementIds.includes(el.id) ? "Remove" : "Add"} ${el.id} ${el.name} ${activeElementIds.includes(el.id) ? "from" : "to"} shortlist`
                     : `Select element ${el.id} ${el.name}`}
                   onPress={() => {
                     if (editingShortlist) {
                       setActiveElementIds(
                         activeElementIds.includes(el.id)
                           ? activeElementIds.filter((id) => id !== el.id)
                           : [...activeElementIds, el.id]
                       );
                     } else {
                       setElement(el);
                       setElementPickerOpen(false);
                     }
                   }}
                >
                  <Text style={[styles.dropdownItemText, { color: element?.id === el.id ? c.primary : c.foreground }]}>
                    {el.id} - {el.name}
                  </Text>
                  <Text style={[styles.dropdownItemSub, { color: c.mutedForeground }]}>{el.category}</Text>
                   {editingShortlist && (
                     <Feather
                       name="star"
                       size={15}
                       color={activeElementIds.includes(el.id) ? "#f59e0b" : c.mutedForeground}
                     />
                   )}
                </TouchableOpacity>
              ))}
              </ScrollView>
            </View>
          )}

          {/* Element 900 — custom Steel Pipe Pile remaining-section form */}
          {element?.id === "900" && (
            <TouchableOpacity
              style={[styles.sppFormBtn, { backgroundColor: "#fff7ed", borderColor: "#fdba74" }]}
              onPress={() => setShowSteelPipePileModal(true)}
            >
              <Feather name="git-commit" size={16} color="#b45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sppFormBtnTitle}>Remaining Section Measurements</Text>
                <Text style={styles.sppFormBtnSub}>Steel Pipe Pile field form</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#b45309" />
            </TouchableOpacity>
          )}

          {/* Defect */}
          <View>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Defect Type</Text>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: c.secondary, borderColor: c.border }]}
                onPress={() => setDefectPickerOpen(!defectPickerOpen)}
              >
                <Text style={[styles.pickerValue, { color: c.foreground, fontSize: 12 }]} numberOfLines={1}>
                  {defect?.name || "Select..."}
                </Text>
                <Feather name={defectPickerOpen ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
              </TouchableOpacity>
              {defectPickerOpen && (
                <ScrollView
                  style={[styles.dropdownList, { borderColor: c.border }]}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {availableDefects.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.dropdownItem,
                        defect?.id === d.id && { backgroundColor: c.primary + "20" },
                        { borderBottomColor: c.border },
                      ]}
                      onPress={() => {
                        setDefect(d);
                        setDefectPickerOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: defect?.id === d.id ? c.primary : c.foreground }]}>
                        {d.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
          </View>

          {/* Condition-state quantity matrix */}
          <View style={[styles.csMatrix, { borderColor: c.border, backgroundColor: c.background }]}>
            <View style={styles.csMatrixTitleRow}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                Condition Quantities ({defect?.unit || "ea"})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCsHelpHighlight("CS2");
                  setCsHelpVisible(true);
                }}
                accessibilityLabel="Open condition state guide"
              >
                <Feather name="help-circle" size={15} color={c.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.csMatrixRow}>
              {(["CS2", "CS3", "CS4"] as ConditionState[]).map((cs) => (
                <View key={cs} style={styles.csMatrixCol}>
                  <View style={[styles.csMatrixHeader, { backgroundColor: CS_COLORS[cs] }]}>
                    <Text style={styles.csMatrixHeaderText}>{cs}</Text>
                  </View>
                  <TextInput
                    style={[styles.csMatrixInput, { borderColor: CS_COLORS[cs], color: c.foreground, backgroundColor: c.card }]}
                    value={conditionQuantities[cs] || ""}
                    onChangeText={(value) => setConditionQuantities({ ...conditionQuantities, [cs]: value })}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={c.mutedForeground}
                    accessibilityLabel={`${cs} quantity`}
                  />
                </View>
              ))}
            </View>
            <View style={styles.legacyCs1Row}>
                <Text style={[styles.fieldLabel, { color: CS_COLORS.CS1 }]}>CS1 Quantity</Text>
                <TextInput
                  style={[styles.legacyCs1Input, { borderColor: CS_COLORS.CS1, color: c.foreground, backgroundColor: c.card }]}
                  value={conditionQuantities.CS1 || ""}
                  onChangeText={(value) => setConditionQuantities({ ...conditionQuantities, CS1: value })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={c.mutedForeground}
                  accessibilityLabel="CS1 quantity"
                />
              </View>
          </View>
          <TouchableOpacity
            style={[styles.bulkApplyAllBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
            onPress={applyConditionQuantitiesToLoggedDefects}
            accessibilityRole="button"
            accessibilityLabel="Apply quantities to matching logged defects"
          >
            <Feather name="copy" size={14} color={c.primary} />
            <Text style={[styles.bulkApplyAllText, { color: c.primary }]}>
              Apply quantities to matching logged defects
            </Text>
          </TouchableOpacity>

          {/* Maintenance Qty */}
          <View style={styles.twoCol}>
            <View style={styles.colLeft}>
              <Text style={[styles.matrixHint, { color: c.mutedForeground }]}>
                Enter quantities for this defect. Save Defect records them here; the secondary action above is only for bulk-editing matching logged defects.
              </Text>
            </View>
            <View style={styles.colRight}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Maint Qty (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }]}
                value={maintenanceQuantity}
                onChangeText={setMaintenanceQuantity}
                keyboardType="numeric"
                placeholder={String(Object.values(conditionQuantities).reduce((sum, value) => sum + (parseFloat(value || "") || 0), 0)) || "Override..."}
                placeholderTextColor="#93c5fd"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.notesLabelRow}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Location and size</Text>
            {Platform.OS !== "web" && (
              <SpeechToTextButton
                onResult={(text) => setLocationDesc(locationDesc ? `${locationDesc} ${text}` : text)}
              />
            )}
          </View>
          <TextInput
            style={[styles.textArea, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
            value={locationDesc}
            onChangeText={setLocationDesc}
            multiline
            numberOfLines={4}
            placeholder="Record structural anomalies..."
            placeholderTextColor={c.mutedForeground}
          />

          {/* Photos */}
          <View style={styles.photoSection}>
            <View style={styles.photoSectionHeader}>
              <Feather name="image" size={14} color={c.mutedForeground} />
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Photos</Text>
            </View>
            <View style={styles.photoBtns}>
              <TouchableOpacity
                style={[styles.photoBtnLarge, { backgroundColor: c.secondary, borderColor: c.border }]}
                onPress={addPhoto}
              >
                <Feather name="image" size={18} color={c.foreground} />
                <Text style={[styles.photoBtnLargeText, { color: c.foreground }]}>Library</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtnLarge, { backgroundColor: c.primary, borderColor: c.primary }]}
                onPress={capturePhoto}
              >
                <Feather name="camera" size={18} color="#fff" />
                <Text style={[styles.photoBtnLargeText, { color: "#fff" }]}>Capture</Text>
              </TouchableOpacity>
            </View>
            {photos.map((p, idx) => (
              <View key={idx} style={[styles.photoRow, { backgroundColor: c.secondary, borderColor: c.border }]}>
                <View style={{ position: "relative" }}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  {dateStampEnabled && p.capturedAt && (
                    <View style={styles.dateStampBadge}>
                      <Text style={styles.dateStampText}>
                        {new Date(p.capturedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.photoInfo}>
                  <TextInput
                    style={[styles.photoInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                    value={p.description}
                    onChangeText={(t) => updatePhotoDesc(idx, t)}
                    placeholder="Photo description..."
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>
                <TouchableOpacity onPress={() => removePhoto(idx)}>
                  <Feather name="x" size={18} color={c.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Defect severity */}
          <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Defect Severity</Text>
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: c.secondary, borderColor: c.border }]}
            onPress={() => setSeverityPickerOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel="Defect severity"
            accessibilityState={{ expanded: severityPickerOpen }}
          >
            <Text style={[styles.pickerValue, { color: isCritical ? "#dc2626" : isMaintenance ? c.primary : c.foreground }]}>
              {isCritical ? "Critical" : isMaintenance ? "Maintenance" : "Standard"}
            </Text>
            <Feather name={severityPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
          </TouchableOpacity>
          {severityPickerOpen && (
            <View style={[styles.dropdownList, { borderColor: c.border }]}>
              {[
                { label: "Standard", critical: false, maintenance: false },
                { label: "Maintenance", critical: false, maintenance: true },
                { label: "Critical", critical: true, maintenance: false },
              ].map((option) => {
                const selected = option.critical === isCritical && option.maintenance === isMaintenance;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.dropdownItem,
                      selected && { backgroundColor: c.primary + "20" },
                      { borderBottomColor: c.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setIsCritical(option.critical);
                      setIsMaintenance(option.maintenance);
                      setSeverityPickerOpen(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: selected ? c.primary : c.foreground }]}>
                      {option.label}
                    </Text>
                    {selected && <Feather name="check" size={14} color={c.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Commit ── */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: c.headerBg }]}
            onPress={onSave}
            testID="save-button"
            accessibilityRole="button"
            accessibilityLabel={editId ? "Save Defect" : "Enter Defect"}
          >
            <Feather name="save" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>
              {editId ? "SAVE DEFECT" : "ENTER DEFECT"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Filters ── */}
        <View style={[styles.section, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.sectionLabel, { color: c.foreground }]}>Filter</Text>
            <View style={styles.filterHeaderRight}>
              <TouchableOpacity
                style={[
                  styles.syncBtn,
                  syncToCurrentLoc ? { backgroundColor: c.primary } : { backgroundColor: c.secondary },
                ]}
                onPress={() => setSyncToCurrentLoc(!syncToCurrentLoc)}
              >
                <Feather name="crosshair" size={12} color={syncToCurrentLoc ? "#fff" : c.mutedForeground} />
                <Text style={[styles.syncBtnText, { color: syncToCurrentLoc ? "#fff" : c.mutedForeground }]}>
                  {syncToCurrentLoc ? "Locked" : "All Stations"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltersOpen(!filtersOpen)}>
                <Feather name={filtersOpen ? "chevron-up" : "sliders"} size={18} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
          {!syncToCurrentLoc && filtersOpen && (
            <View style={styles.filterBody}>
              <View style={styles.filterField}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Station Type</Text>
                <View style={styles.filterTypeRow}>
                  {["All", "Span", "Bent", "Joint"].map((ft) => (
                    <TouchableOpacity
                      key={ft}
                      style={[
                        styles.filterTypeBtn,
                        filterType === ft ? { backgroundColor: c.primary } : { backgroundColor: c.secondary, borderColor: c.border },
                      ]}
                      onPress={() => setFilterType(ft)}
                    >
                      <Text style={[styles.filterTypeBtnText, { color: filterType === ft ? "#fff" : c.mutedForeground }]}>{ft}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.twoCol}>
                <View style={styles.colLeft}>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Min #</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                    value={rangeMin}
                    onChangeText={setRangeMin}
                    keyboardType="numeric"
                    placeholder="Min"
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>
                <View style={styles.colRight}>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Max #</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                    value={rangeMax}
                    onChangeText={setRangeMax}
                    keyboardType="numeric"
                    placeholder="Max"
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>
              </View>
              <View style={styles.filterField}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Sort</Text>
                <View style={styles.filterTypeRow}>
                  {["location", "severity", "element"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.filterTypeBtn,
                        sortCriteria === s ? { backgroundColor: c.primary } : { backgroundColor: c.secondary, borderColor: c.border },
                      ]}
                      onPress={() => setSortCriteria(s)}
                    >
                      <Text style={[styles.filterTypeBtnText, { color: sortCriteria === s ? "#fff" : c.mutedForeground }]}>
                        {s === "location" ? "Longitudinal" : s === "severity" ? "CS Severity" : "Element"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Session Manifest ── */}
        <View style={styles.manifestSection}>
          <View style={styles.manifestHeader}>
            <Feather name="zap" size={14} color={c.primary} />
            <Text style={[styles.manifestTitle, { color: c.primary }]}>
              Active Session Acquisitions ({sessionManifest.length})
            </Text>
          </View>
          {sessionManifest.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="clipboard" size={24} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No defects logged this session</Text>
            </View>
          ) : (
            sessionManifest.map((d) => (
              <DefectCard
                key={d.id}
                record={d}
                onEdit={() => handleEdit(d)}
              />
            ))
          )}
        </View>

        {/* ── Legacy Manifest ── */}
        {legacyManifest.length > 0 && (
          <View style={[styles.manifestSection, { opacity: 0.9 }]}>
            <View style={styles.manifestHeader}>
              <Feather name="clock" size={14} color={c.mutedForeground} />
              <Text style={[styles.manifestTitle, { color: c.mutedForeground, flex: 1 }]}>
                Previous Defects ({filteredLegacyManifest.length}/{legacyManifest.length})
              </Text>
            </View>

            {/* Filter toggles */}
            <View style={styles.legacyFilterRow}>
              {/* CS1 toggle */}
              <TouchableOpacity
                style={[
                  styles.legacyFilterBtn,
                  showLegacyCS1
                    ? { backgroundColor: colors.light.cs1 + "30", borderColor: colors.light.cs1 }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setShowLegacyCS1(!showLegacyCS1)}
              >
                <View style={[styles.legacyFilterDot, { backgroundColor: colors.light.cs1 }]} />
                <Text style={[styles.legacyFilterText, { color: showLegacyCS1 ? colors.light.cs1 : c.mutedForeground }]}>
                  {showLegacyCS1 ? "CS1 Shown" : `CS1 Hidden${legacyCS1Count > 0 ? ` (${legacyCS1Count})` : ""}`}
                </Text>
              </TouchableOpacity>

              {/* Side filter toggle */}
              <TouchableOpacity
                style={[
                  styles.legacyFilterBtn,
                  showAllLegacySides
                    ? { backgroundColor: c.primary + "20", borderColor: c.primary }
                    : { backgroundColor: c.secondary, borderColor: c.border },
                ]}
                onPress={() => setShowAllLegacySides(!showAllLegacySides)}
              >
                <Feather
                  name={showAllLegacySides ? "layers" : (inspectionType === INSPECTION_TYPES.TOPSIDE ? "arrow-up" : "arrow-down")}
                  size={11}
                  color={showAllLegacySides ? c.primary : c.mutedForeground}
                />
                <Text style={[styles.legacyFilterText, { color: showAllLegacySides ? c.primary : c.mutedForeground }]}>
                  {showAllLegacySides
                    ? "All Sides"
                    : `${inspectionType} Only${legacyHiddenBySide > 0 ? ` (${legacyHiddenBySide} hidden)` : ""}`}
                </Text>
              </TouchableOpacity>
            </View>

            {filteredLegacyManifest.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
                <Feather name="filter" size={20} color={c.mutedForeground} />
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  All previous defects are hidden by current filters
                </Text>
              </View>
            ) : (
              filteredLegacyManifest.map((d) => (
                <DefectCard
                  key={d.id}
                  record={d}
                  isLegacy
                  onEdit={() => handleEdit(d)}
                />
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </KeyboardAwareScrollViewCompat>

      <CIFModal />
      <FUAModal />
      <UnderclearanceModal inline={isTabletLayout} />
      <ChannelModal inline={isTabletLayout} />
      <DailySafetyBriefingModal inline={isTabletLayout} />
      <SnbiModal inline={isTabletLayout} />
      <SteelPipePileModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appHeader: {
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerQuickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  headerQuickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0c1a2e",
    borderColor: "#0369a1",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  headerQuickActionText: {
    color: "#bae6fd",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  moduleToggleHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  moduleToggleHeaderText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  gearBtn: { padding: 8, borderRadius: 10 },
  menuBtn: { padding: 4, borderRadius: 8, backgroundColor: "#1e293b" },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  menuDropdown: {
    position: "absolute",
    top: 92,
    left: 12,
    width: 270,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    zIndex: 21,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  menuHeading: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  menuIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  menuItemTitle: { fontSize: 13, fontWeight: "800" },
  menuItemSub: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  modeDropdown: {
    position: "absolute",
    top: 92,
    width: 286,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    zIndex: 21,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modeHint: { fontSize: 11, lineHeight: 16, paddingHorizontal: 8, paddingBottom: 8 },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 5,
  },
  modeOptionIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  modeOptionTitle: { fontSize: 13, fontWeight: "800" },
  modeOptionSub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 12 },
  section: {
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  elementFilterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resetFilterText: { fontSize: 11, fontWeight: "800" },
  zoneFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  zoneFilterBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  zoneFilterText: { fontSize: 10, fontWeight: "800" },
  zoneToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  notesLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
  },
  pickerValue: { fontSize: 13, fontWeight: "800", flex: 1 },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownPanel: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  elementSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  elementSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    padding: 0,
  },
  elementSearchHint: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  dropdownEmpty: {
    fontSize: 12,
    fontWeight: "600",
    padding: 16,
    textAlign: "center",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: { fontSize: 13, fontWeight: "700" },
  dropdownItemSub: { fontSize: 10, fontWeight: "600" },
  sppFormBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  sppFormBtnTitle: { fontSize: 13, fontWeight: "800", color: "#9a3412" },
  sppFormBtnSub: { fontSize: 10, fontWeight: "600", color: "#c2730a", marginTop: 1 },
  twoCol: { flexDirection: "row", gap: 10 },
  colLeft: { flex: 1, gap: 4 },
  colRight: { flex: 1, gap: 4 },
  csGrid: { flexDirection: "row", gap: 4 },
  csBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  csBtnText: { fontSize: 9, fontWeight: "900" },
  csMatrix: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  csMatrixTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  csMatrixRow: { flexDirection: "row", gap: 8 },
  csMatrixCol: { flex: 1, gap: 5 },
  csMatrixHeader: { borderRadius: 6, paddingVertical: 4, alignItems: "center" },
  csMatrixHeaderText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  csMatrixInput: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, textAlign: "center", fontSize: 14, fontWeight: "800" },
  bulkApplyAllBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  bulkApplyAllText: { fontSize: 11, fontWeight: "800" },
  legacyCs1Row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 4 },
  legacyCs1Input: { width: 90, borderWidth: 1, borderRadius: 8, padding: 7, textAlign: "center", fontWeight: "800" },
  matrixHint: { fontSize: 10, lineHeight: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 8, fontSize: 14, fontWeight: "800" },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    fontSize: 12,
    fontWeight: "600",
    minHeight: 52,
    textAlignVertical: "top",
  },
  photoSection: { gap: 8 },
  photoSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  photoBtns: { flexDirection: "row", gap: 8 },
  photoBtnLarge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  photoBtnLargeText: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 10, borderWidth: 1 },
  photoThumb: { width: 50, height: 50, borderRadius: 8 },
  dateStampBadge: { position: "absolute", bottom: 3, right: 3, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  dateStampText: { fontSize: 7, color: "#fff", fontWeight: "700" },
  photoInfo: { flex: 1 },
  photoInput: { borderWidth: 1, borderRadius: 6, padding: 6, fontSize: 11 },
  flagRow: { flexDirection: "row", gap: 8 },
  flagPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  flagPillText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
  },
  saveBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", letterSpacing: 1.5 },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0284c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  editBannerText: { fontSize: 10, fontWeight: "900", color: "#fff", textTransform: "uppercase" },
  cancelEditBtn: { marginLeft: 4 },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  syncBtnText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  filterBody: { gap: 10 },
  filterField: { gap: 4 },
  filterTypeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterTypeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  filterTypeBtnText: { fontSize: 11, fontWeight: "800" },
  manifestSection: { gap: 4 },
  manifestHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 2, marginBottom: 2 },
  manifestTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  legacyFilterRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  legacyFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  legacyFilterDot: { width: 7, height: 7, borderRadius: 4 },
  legacyFilterText: { fontSize: 10, fontWeight: "800", flex: 1 },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 13, fontWeight: "600" },
  // ── CS Help Modal ──────────────────────────────────────────────────────────
  csHelpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  csHelpCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  csHelpHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  csHelpTitle: { fontSize: 15, fontWeight: "900" },
  csHelpSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  csHelpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  csHelpBadge: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  csHelpBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff" },
  csHelpDesc: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  csHelpHint: { fontSize: 9, fontWeight: "600", textAlign: "center", marginTop: 4 },
});
