import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import React, { useState } from "react";
import {
  Alert,
  Image,
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
  DEFECTS_BY_ELEMENT,
  INSPECTION_TYPES,
  NOMENCLATURES,
  PhotoItem,
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
import colors from "@/constants/colors";

const CS_OPTIONS = ["CS1", "CS2", "CS3", "CS4"] as const;
const CS_COLORS: Record<string, string> = {
  CS1: colors.light.cs1,
  CS2: colors.light.cs2,
  CS3: colors.light.cs3,
  CS4: colors.light.cs4,
};

export default function InspectionScreen() {
  const c = useColors();
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
    conditionState,
    setConditionState,
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
    sessionManifest,
    legacyManifest,
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
  } = useInspection();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const isTxDot = nomenclature === NOMENCLATURES.TXDOT;
  const [editingStructureNum, setEditingStructureNum] = useState(false);
  const [structureNumDraft, setStructureNumDraft] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [elementPickerOpen, setElementPickerOpen] = useState(false);
  const [defectPickerOpen, setDefectPickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const addPhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Photo library not supported in web preview. Use camera.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newPhotos: PhotoItem[] = result.assets.map((a) => ({
        uri: a.uri,
        description: "",
      }));
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
      setPhotos([...photos, { uri: result.assets[0].uri, description: "" }]);
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
    if (!element || !defect || !quantity) {
      Alert.alert("Missing Fields", "Please fill in element, defect, and quantity.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleSave();
  };

  const cancelEdit = () => {
    setEditId(null);
    setQuantity("");
    setMaintenanceQuantity("");
    setLocationDesc("");
    setIsCritical(false);
    setIsMaintenance(false);
    setPhotos([]);
  };

  const availableDefects = element ? DEFECTS_BY_ELEMENT[element.id] || [] : [];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* ── App Header ── */}
      <View style={[styles.appHeader, { backgroundColor: c.headerBg }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitle}>
            {isTxDot && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setModuleMenuOpen((v) => !v)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="menu" size={18} color="#e2e8f0" />
              </TouchableOpacity>
            )}
            <Feather name="activity" size={16} color="#38bdf8" />
            <View>
              <Text style={styles.headerTitleText}>Bridge Inspection</Text>
              {editingStructureNum ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <TextInput
                    style={{
                      color: "#f8fafc",
                      fontSize: 11,
                      backgroundColor: "#1e293b",
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      minWidth: 120,
                      borderWidth: 1,
                      borderColor: "#38bdf8",
                    }}
                    value={structureNumDraft}
                    onChangeText={setStructureNumDraft}
                    placeholder="Structure number..."
                    placeholderTextColor="#475569"
                    autoFocus
                    onSubmitEditing={() => {
                      setStructureNumber(structureNumDraft.trim());
                      setEditingStructureNum(false);
                    }}
                    onBlur={() => {
                      setStructureNumber(structureNumDraft.trim());
                      setEditingStructureNum(false);
                    }}
                    returnKeyType="done"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS === "ios") {
                      Alert.prompt(
                        "Structure Number",
                        "Enter the bridge structure number",
                        (text) => { if (text !== undefined) setStructureNumber(text.trim()); },
                        "plain-text",
                        structureNumber,
                      );
                    } else {
                      setStructureNumDraft(structureNumber);
                      setEditingStructureNum(true);
                    }
                  }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 1 }}>
                    {structureNumber ? structureNumber : "Tap to set structure number"}
                    {"  "}
                    <Feather name="edit-2" size={10} color="#475569" />
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.moduleToggleHeaderBtn,
                { backgroundColor: inspectionType === INSPECTION_TYPES.TOPSIDE ? "#0284c7" : "#0f172a" },
              ]}
              onPress={() => setInspectionType(
                inspectionType === INSPECTION_TYPES.TOPSIDE ? INSPECTION_TYPES.UNDERSIDE : INSPECTION_TYPES.TOPSIDE
              )}
            >
              <Feather
                name={inspectionType === INSPECTION_TYPES.TOPSIDE ? "arrow-up" : "arrow-down"}
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
            <TouchableOpacity style={[styles.gearBtn, { backgroundColor: "#1e293b" }]} onPress={() => setSettingsOpen(true)}>
              <Feather name="settings" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ── TxDOT module menu (hamburger dropdown) ── */}
      {isTxDot && moduleMenuOpen && (
        <>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setModuleMenuOpen(false)}
          />
          <View style={[styles.menuDropdown, { backgroundColor: c.card, borderColor: c.border }]}>
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
                <Text style={[styles.menuItemTitle, { color: c.foreground }]}>SNBI</Text>
                <Text style={[styles.menuItemSub, { color: c.mutedForeground }]}>Field Collection</Text>
              </View>
              <Feather name="chevron-right" size={16} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
        </>
      )}

      <KeyboardAwareScrollViewCompat
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
            <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Element Defect Data</Text>
          </View>

          {/* Element */}
          <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Element Selection</Text>
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
                  ? `${filteredElements.length} match${filteredElements.length === 1 ? "" : "es"}`
                  : `${filteredElements.length} common element${filteredElements.length === 1 ? "" : "s"} · search to find more`}
              </Text>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filteredElements.length === 0 && (
                <Text style={[styles.dropdownEmpty, { color: c.mutedForeground }]}>
                  No elements match. Try a different search.
                </Text>
              )}
              {filteredElements.map((el) => (
                <TouchableOpacity
                  key={el.id}
                  style={[
                    styles.dropdownItem,
                    element?.id === el.id && { backgroundColor: c.primary + "20" },
                    { borderBottomColor: c.border },
                  ]}
                  onPress={() => {
                    setElement(el);
                    setElementPickerOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: element?.id === el.id ? c.primary : c.foreground }]}>
                    {el.id} - {el.name}
                  </Text>
                  <Text style={[styles.dropdownItemSub, { color: c.mutedForeground }]}>{el.category}</Text>
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

          {/* Defect + CS row */}
          <View style={styles.twoCol}>
            <View style={styles.colLeft}>
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
                <View style={[styles.dropdownList, { borderColor: c.border }]}>
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
                </View>
              )}
            </View>
            <View style={styles.colRight}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Condition State</Text>
              <View style={styles.csGrid}>
                {CS_OPTIONS.map((cs) => (
                  <TouchableOpacity
                    key={cs}
                    style={[
                      styles.csBtn,
                      conditionState === cs
                        ? { backgroundColor: CS_COLORS[cs], borderColor: CS_COLORS[cs] }
                        : { backgroundColor: c.secondary, borderColor: c.border },
                    ]}
                    onPress={() => setConditionState(cs)}
                  >
                    <Text style={[styles.csBtnText, { color: conditionState === cs ? "#fff" : c.mutedForeground }]}>
                      {cs}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Qty + Maint Qty */}
          <View style={styles.twoCol}>
            <View style={[styles.colLeft]}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                Element Qty ({defect?.unit || "ea"})
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
            <View style={styles.colRight}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Maint Qty (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }]}
                value={maintenanceQuantity}
                onChangeText={setMaintenanceQuantity}
                keyboardType="numeric"
                placeholder={quantity || "Override..."}
                placeholderTextColor="#93c5fd"
              />
            </View>
          </View>

          {/* Notes */}
          <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Size and Location</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
            value={locationDesc}
            onChangeText={setLocationDesc}
            multiline
            numberOfLines={4}
            placeholder="Record structural anomalies..."
            placeholderTextColor={c.mutedForeground}
          />

          {/* ── Commit ── */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: c.headerBg }]}
            onPress={onSave}
            testID="save-button"
          >
            <Feather name="save" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>
              {editId ? "UPDATE RECORD" : "COMMIT LOG"}
            </Text>
          </TouchableOpacity>

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
                <Image source={{ uri: p.uri }} style={styles.photoThumb} />
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

          {/* Critical + Maintenance flags */}
          <View style={styles.flagRow}>
            <Pressable
              style={[
                styles.flagPill,
                isCritical
                  ? { backgroundColor: "#dc2626", borderColor: "#dc2626" }
                  : { backgroundColor: c.secondary, borderColor: c.border },
              ]}
              onPress={() => {
                setIsCritical(!isCritical);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather name="alert-triangle" size={13} color={isCritical ? "#fff" : c.mutedForeground} />
              <Text style={[styles.flagPillText, { color: isCritical ? "#fff" : c.mutedForeground }]}>Critical</Text>
            </Pressable>
            <Pressable
              style={[
                styles.flagPill,
                isMaintenance
                  ? { backgroundColor: c.primary, borderColor: c.primary }
                  : { backgroundColor: c.secondary, borderColor: c.border },
              ]}
              onPress={() => {
                setIsMaintenance(!isMaintenance);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather name="tool" size={13} color={isMaintenance ? "#fff" : c.mutedForeground} />
              <Text style={[styles.flagPillText, { color: isMaintenance ? "#fff" : c.mutedForeground }]}>Maintenance</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Filters ── */}
        <View style={[styles.section, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.sectionLabel, { color: c.foreground }]}>Station Filters</Text>
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
                onEdit={() => startEdit(d)}
              />
            ))
          )}
        </View>

        {/* ── Legacy Manifest ── */}
        {legacyManifest.length > 0 && (
          <View style={[styles.manifestSection, { opacity: 0.85 }]}>
            <View style={styles.manifestHeader}>
              <Feather name="clock" size={14} color={c.mutedForeground} />
              <Text style={[styles.manifestTitle, { color: c.mutedForeground }]}>
                Previous Reported Defects ({legacyManifest.length})
              </Text>
            </View>
            {legacyManifest.map((d) => (
              <DefectCard
                key={d.id}
                record={d}
                isLegacy
                onEdit={() => startEdit(d)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </KeyboardAwareScrollViewCompat>

      <CIFModal />
      <FUAModal />
      <UnderclearanceModal />
      <ChannelModal />
      <DailySafetyBriefingModal />
      <SnbiModal />
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
  manifestHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 2, marginBottom: 4 },
  manifestTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 13, fontWeight: "600" },
});
