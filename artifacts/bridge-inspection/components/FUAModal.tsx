import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React from "react";
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
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { PhotoItem, useInspection } from "@/context/InspectionContext";

const PRIORITY_OPTIONS = [
  { value: "Level 1", label: "Level 1 (30 Days)" },
  { value: "Level 2", label: "Level 2 (6 Months)" },
  { value: "Level 3", label: "Level 3 (24 Months)" },
  { value: "Level 4", label: "Level 4 (No Timeframe)" },
];

export function FUAModal() {
  const colors = useColors();
  const { showFUAModal, setShowFUAModal, fuaData, setFuaData, completeFUA } =
    useInspection();

  const addPhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Photo capture not available on web preview.");
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
      setFuaData({ ...fuaData, photos: [...fuaData.photos, ...newPhotos] });
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
      const newPhoto: PhotoItem = { uri: result.assets[0].uri, description: "" };
      setFuaData({ ...fuaData, photos: [...fuaData.photos, newPhoto] });
    }
  };

  const updatePhotoDesc = (idx: number, desc: string) => {
    const updated = [...fuaData.photos];
    updated[idx] = { ...updated[idx], description: desc };
    setFuaData({ ...fuaData, photos: updated });
  };

  const removePhoto = (idx: number) => {
    setFuaData({ ...fuaData, photos: fuaData.photos.filter((_, i) => i !== idx) });
  };

  const handleComplete = () => {
    if (
      (fuaData.priority === "Level 1" || fuaData.priority === "Level 2") &&
      !fuaData.phoneNotified
    ) {
      Alert.alert(
        "Phone Notification Required",
        "Priority Levels 1 & 2 require immediate phone notification."
      );
      return;
    }
    if (!fuaData.assetWiseLogged) {
      Alert.alert(
        "AssetWise Confirmation Required",
        "AssetWise synchronization must be confirmed."
      );
      return;
    }
    completeFUA();
  };

  const needsPhone =
    fuaData.priority === "Level 1" || fuaData.priority === "Level 2";
  const canComplete = needsPhone
    ? fuaData.phoneNotified && fuaData.assetWiseLogged
    : fuaData.assetWiseLogged;

  return (
    <Modal
      visible={showFUAModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFUAModal(false)}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerLeft}>
            <Feather name="tool" size={28} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Maintenance Follow-Up Action</Text>
              <Text style={styles.headerSubtitle}>AssetWise Maintenance Module Sync</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowFUAModal(false)} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Priority */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PRIORITY LEVEL (REC TYPE)</Text>
              <View style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.priorityBtn,
                      fuaData.priority === opt.value
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                    onPress={() => setFuaData({ ...fuaData, priority: opt.value })}
                  >
                    <Text
                      style={[
                        styles.priorityBtnText,
                        { color: fuaData.priority === opt.value ? "#fff" : colors.mutedForeground },
                      ]}
                    >
                      {opt.value}
                    </Text>
                    <Text
                      style={[
                        styles.priorityBtnSub,
                        { color: fuaData.priority === opt.value ? "rgba(255,255,255,0.8)" : colors.mutedForeground },
                      ]}
                    >
                      {opt.label.split("(")[1]?.replace(")", "") || ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Previously recommended */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PREVIOUSLY RECOMMENDED?</Text>
              <View style={styles.toggleRow}>
                {["N", "Y"].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.toggleBtn,
                      fuaData.previouslyRecommended === opt
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                    onPress={() => setFuaData({ ...fuaData, previouslyRecommended: opt })}
                  >
                    <Text style={{ color: fuaData.previouslyRecommended === opt ? "#fff" : colors.mutedForeground, fontWeight: "800", fontSize: 13 }}>
                      {opt === "N" ? "No" : "Yes"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION OF ISSUE</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                multiline
                numberOfLines={4}
                value={fuaData.description}
                onChangeText={(t) => setFuaData({ ...fuaData, description: t })}
                placeholder="Describe the maintenance issue..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>REMEDIAL RECOMMENDATION</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                multiline
                numberOfLines={4}
                value={fuaData.recommendation}
                onChangeText={(t) => setFuaData({ ...fuaData, recommendation: t })}
                placeholder="Specify remedial action..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Photos */}
            <View style={styles.fieldGroup}>
              <View style={styles.photoHeader}>
                <Text style={[styles.fieldLabel, { color: colors.primary }]}>REMEDIAL EVIDENCE MANIFEST</Text>
                <View style={styles.photoButtons}>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: colors.secondary }]}
                    onPress={addPhoto}
                  >
                    <Feather name="image" size={14} color={colors.foreground} />
                    <Text style={[styles.photoBtnText, { color: colors.foreground }]}>Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: colors.primary }]}
                    onPress={capturePhoto}
                  >
                    <Feather name="camera" size={14} color="#fff" />
                    <Text style={[styles.photoBtnText, { color: "#fff" }]}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {fuaData.photos.map((p, idx) => (
                <View key={idx} style={[styles.photoRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  <View style={styles.photoDetails}>
                    <TextInput
                      style={[styles.photoInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                      value={p.description}
                      onChangeText={(t) => updatePhotoDesc(idx, t)}
                      placeholder="Photo description..."
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <TouchableOpacity onPress={() => removePhoto(idx)}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Phone notification for Level 1 / 2 */}
            {needsPhone && (
              <View style={[styles.urgentBox, { borderColor: "#d97706", backgroundColor: "#fffbeb" }]}>
                <View style={styles.urgentHeader}>
                  <Feather name="phone" size={14} color="#d97706" />
                  <Text style={[styles.urgentTitle, { color: "#d97706" }]}>URGENT NOTIFICATION REQUIRED</Text>
                </View>
                <Pressable
                  style={styles.checkRow}
                  onPress={() => setFuaData({ ...fuaData, phoneNotified: !fuaData.phoneNotified })}
                >
                  <View style={[styles.checkbox, fuaData.phoneNotified && { backgroundColor: "#d97706", borderColor: "#d97706" }, { borderColor: "#d97706" }]}>
                    {fuaData.phoneNotified && <Feather name="check" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.checkText, { color: "#92400e" }]}>
                    Confirmed: District Phone Notification Logged
                  </Text>
                </Pressable>
              </View>
            )}

            {/* AssetWise */}
            <View style={[styles.safetyBox, { borderColor: colors.primary, backgroundColor: "#eff6ff" }]}>
              <Pressable
                style={styles.checkRow}
                onPress={() => setFuaData({ ...fuaData, assetWiseLogged: !fuaData.assetWiseLogged })}
              >
                <View style={[styles.checkbox, fuaData.assetWiseLogged && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.border }]}>
                  {fuaData.assetWiseLogged && <Feather name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkText, { color: colors.foreground }]}>
                  AssetWise FUA Synchronization Confirmed — Work Order Created
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.finalizeBtn,
              canComplete ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted },
            ]}
            onPress={handleComplete}
          >
            <Feather name="check-circle" size={18} color={canComplete ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.finalizeBtnText, { color: canComplete ? "#fff" : colors.mutedForeground }]}>
              Finalize Maintenance Record
            </Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  closeBtn: { padding: 8, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.2)" },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontWeight: "600",
    minHeight: 80,
    textAlignVertical: "top",
  },
  priorityRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  priorityBtn: {
    flex: 1,
    minWidth: "45%",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  priorityBtnText: { fontSize: 13, fontWeight: "900" },
  priorityBtnSub: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoButtons: { flexDirection: "row", gap: 8 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  photoBtnText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, borderWidth: 1 },
  photoThumb: { width: 56, height: 56, borderRadius: 8 },
  photoDetails: { flex: 1 },
  photoInput: { borderWidth: 1, borderRadius: 6, padding: 6, fontSize: 11 },
  urgentBox: { borderWidth: 2, borderRadius: 12, padding: 14, gap: 10 },
  urgentHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  urgentTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  safetyBox: { borderWidth: 1, borderRadius: 12, padding: 14 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { fontSize: 11, fontWeight: "700", flex: 1, textTransform: "uppercase" },
  footer: { padding: 16, borderTopWidth: 1 },
  finalizeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  finalizeBtnText: { fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
});
