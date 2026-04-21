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
  ENVIRONMENTS,
  INSPECTION_TYPES,
  NOMENCLATURES,
  PhotoItem,
  SNBI_ELEMENTS,
  useInspection,
} from "@/context/InspectionContext";
import { DefectCard } from "@/components/DefectCard";
import { CIFModal } from "@/components/CIFModal";
import { FUAModal } from "@/components/FUAModal";
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
    nomenclature,
    setNomenclature,
    inspectionType,
    setInspectionType,
    editId,
    setEditId,
    currentLocation,
    setCurrentLocation,
    element,
    setElement,
    environment,
    setEnvironment,
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
    simulateLegacyImport,
    parsingActive,
  } = useInspection();

  const NOM = NOMENCLATURES;
  const INSP = INSPECTION_TYPES;

  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [elementPickerOpen, setElementPickerOpen] = useState(false);
  const [defectPickerOpen, setDefectPickerOpen] = useState(false);
  const [envPickerOpen, setEnvPickerOpen] = useState(false);
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
        <View style={styles.headerTop}>
          <View style={styles.headerTitle}>
            <Feather name="activity" size={20} color="#38bdf8" />
            <Text style={styles.headerTitleText}>Bridge Inspection</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: "#1e293b" }]}
              onPress={simulateLegacyImport}
              disabled={parsingActive}
            >
              {parsingActive ? (
                <Feather name="loader" size={12} color="#94a3b8" />
              ) : (
                <Feather name="upload" size={12} color="#94a3b8" />
              )}
              <Text style={styles.importBtnText}>Import</Text>
            </TouchableOpacity>
            <View style={[styles.nomToggle, { backgroundColor: "#1e293b" }]}>
              <TouchableOpacity
                style={[styles.nomBtn, nomenclature === NOM.TXDOT && styles.nomBtnActive]}
                onPress={() => setNomenclature(NOM.TXDOT)}
              >
                <Text style={[styles.nomBtnText, nomenclature === NOM.TXDOT && styles.nomBtnTextActive]}>TX</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nomBtn, nomenclature === NOM.NCDOT && styles.nomBtnActive]}
                onPress={() => setNomenclature(NOM.NCDOT)}
              >
                <Text style={[styles.nomBtnText, nomenclature === NOM.NCDOT && styles.nomBtnTextActive]}>NC</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.moduleToggle,
            inspectionType === INSP.TOPSIDE
              ? { backgroundColor: "#0284c7", borderColor: "#0ea5e9" }
              : { backgroundColor: "#1e293b", borderColor: "#334155" },
          ]}
          onPress={() => setInspectionType(inspectionType === INSP.TOPSIDE ? INSP.UNDERSIDE : INSP.TOPSIDE)}
        >
          <Feather name="refresh-cw" size={14} color={inspectionType === INSP.TOPSIDE ? "#fff" : "#38bdf8"} />
          <Text style={[styles.moduleToggleText, { color: inspectionType === INSP.TOPSIDE ? "#fff" : "#38bdf8" }]}>
            Active Module: {inspectionType}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* ── Location ── */}
        <View style={[styles.section, { backgroundColor: c.card, borderTopColor: c.headerBg }]}>
          <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Structural Stationing</Text>
          <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Support / Span Designation</Text>
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
            <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>SNBI Data Acquisition</Text>
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
            <ScrollView style={[styles.dropdownList, { borderColor: c.border }]} nestedScrollEnabled>
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
          )}

          {/* Defect + CS row */}
          <View style={styles.twoCol}>
            <View style={styles.colLeft}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Active Defect Mode</Text>
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

          {/* Environment */}
          <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Environment</Text>
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: c.background, borderColor: c.border }]}
            onPress={() => setEnvPickerOpen(!envPickerOpen)}
          >
            <Text style={[styles.pickerValue, { color: c.foreground }]}>
              {ENVIRONMENTS.find((e) => e.id === environment)?.name || "Select..."}
            </Text>
            <Feather name={envPickerOpen ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
          </TouchableOpacity>
          {envPickerOpen && (
            <View style={[styles.dropdownList, { borderColor: c.border }]}>
              {ENVIRONMENTS.map((env) => (
                <TouchableOpacity
                  key={env.id}
                  style={[
                    styles.dropdownItem,
                    environment === env.id && { backgroundColor: c.primary + "20" },
                    { borderBottomColor: c.border },
                  ]}
                  onPress={() => {
                    setEnvironment(env.id);
                    setEnvPickerOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: environment === env.id ? c.primary : c.foreground }]}>
                    {env.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Notes */}
          <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Defect Notes</Text>
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
              <View style={styles.photoSectionLeft}>
                <Feather name="image" size={14} color={c.mutedForeground} />
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Diagnostic Media</Text>
              </View>
              <View style={styles.photoBtns}>
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: c.secondary }]}
                  onPress={addPhoto}
                >
                  <Feather name="image" size={13} color={c.foreground} />
                  <Text style={[styles.photoBtnText, { color: c.foreground }]}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: c.primary }]}
                  onPress={capturePhoto}
                >
                  <Feather name="camera" size={13} color="#fff" />
                  <Text style={[styles.photoBtnText, { color: "#fff" }]}>Capture</Text>
                </TouchableOpacity>
              </View>
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
          <View style={styles.twoCol}>
            <Pressable
              style={[
                styles.flagCard,
                isCritical
                  ? { backgroundColor: "#fef2f2", borderColor: "#dc2626" }
                  : { backgroundColor: c.secondary, borderColor: c.border },
              ]}
              onPress={() => {
                setIsCritical(!isCritical);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.checkbox, isCritical && { backgroundColor: "#dc2626", borderColor: "#dc2626" }, { borderColor: c.border }]}>
                {isCritical && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={[styles.flagLabel, { color: isCritical ? "#dc2626" : c.mutedForeground }]}>
                Critical Finding
              </Text>
              {isCritical && <Feather name="alert-triangle" size={18} color="#dc2626" />}
            </Pressable>
            <Pressable
              style={[
                styles.flagCard,
                isMaintenance
                  ? { backgroundColor: "#eff6ff", borderColor: c.primary }
                  : { backgroundColor: c.secondary, borderColor: c.border },
              ]}
              onPress={() => {
                setIsMaintenance(!isMaintenance);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.checkbox, isMaintenance && { backgroundColor: c.primary, borderColor: c.primary }, { borderColor: c.border }]}>
                {isMaintenance && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={[styles.flagLabel, { color: isMaintenance ? c.primary : c.mutedForeground }]}>
                Maintenance Req
              </Text>
              {isMaintenance && <Feather name="tool" size={18} color={c.primary} />}
            </Pressable>
          </View>
        </View>

        {/* ── Save Button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: c.headerBg }]}
          onPress={onSave}
          testID="save-button"
        >
          <Feather name="save" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>
            {editId ? "UPDATE RECORD" : "COMMIT LOG"}
          </Text>
        </TouchableOpacity>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appHeader: {
    paddingTop: Platform.OS === "web" ? 67 : 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitleText: { fontSize: 18, fontWeight: "900", color: "#f8fafc", letterSpacing: -0.5, textTransform: "uppercase" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  importBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  importBtnText: { fontSize: 9, fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" },
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
    padding: 12,
  },
  pickerValue: { fontSize: 14, fontWeight: "800", flex: 1 },
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
  dropdownItemSub: { fontSize: 10, fontWeight: "600" },
  twoCol: { flexDirection: "row", gap: 10 },
  colLeft: { flex: 1, gap: 4 },
  colRight: { flex: 1, gap: 4 },
  csGrid: { flexDirection: "row", gap: 4 },
  csBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  csBtnText: { fontSize: 9, fontWeight: "900" },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15, fontWeight: "800" },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    fontWeight: "600",
    minHeight: 80,
    textAlignVertical: "top",
  },
  photoSection: { gap: 8 },
  photoSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photoSectionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  photoBtns: { flexDirection: "row", gap: 8 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  photoBtnText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 10, borderWidth: 1 },
  photoThumb: { width: 50, height: 50, borderRadius: 8 },
  photoInfo: { flex: 1 },
  photoInput: { borderWidth: 1, borderRadius: 6, padding: 6, fontSize: 11 },
  flagCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  flagLabel: { flex: 1, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
