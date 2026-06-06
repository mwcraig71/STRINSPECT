import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { resizePhoto } from "@/lib/photoUtils";
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
import { CifData, PhotoItem, useInspection } from "@/context/InspectionContext";

export function CIFModal() {
  const colors = useColors();
  const { showCIFModal, setShowCIFModal, cifData, setCifData, completeCIF, imageSize, dateStampEnabled } =
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
      const capturedAt = new Date().toISOString();
      const newPhotos: PhotoItem[] = await Promise.all(
        result.assets.map(async (a) => ({
          uri: await resizePhoto(a.uri, imageSize, a.width, a.height),
          description: "",
          capturedAt,
        }))
      );
      setCifData({ ...cifData, photos: [...cifData.photos, ...newPhotos] });
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
      const asset = result.assets[0];
      const uri = await resizePhoto(asset.uri, imageSize, asset.width, asset.height);
      const newPhoto: PhotoItem = { uri, description: "", capturedAt: new Date().toISOString() };
      setCifData({ ...cifData, photos: [...cifData.photos, newPhoto] });
    }
  };

  const updatePhotoDesc = (idx: number, desc: string) => {
    const updated = [...cifData.photos];
    updated[idx] = { ...updated[idx], description: desc };
    setCifData({ ...cifData, photos: updated });
  };

  const removePhoto = (idx: number) => {
    setCifData({
      ...cifData,
      photos: cifData.photos.filter((_, i) => i !== idx),
    });
  };

  const handleComplete = () => {
    if (!cifData.phoneNotified || !cifData.assetWiseLogged) {
      Alert.alert(
        "Safety Protocol Required",
        "Verification of immediate safety protocol execution is mandatory before finalizing the CIF."
      );
      return;
    }
    completeCIF();
  };

  const canComplete = cifData.phoneNotified && cifData.assetWiseLogged;

  return (
    <Modal
      visible={showCIFModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!cifData.phoneNotified || !cifData.assetWiseLogged) {
          Alert.alert(
            "Cannot Close",
            "Complete the Safety Protocol Verification before closing this Critical Inspection Finding."
          );
          return;
        }
        setShowCIFModal(false);
      }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: "#dc2626" }]}>
          <View style={styles.headerLeft}>
            <Feather name="alert-triangle" size={28} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Critical Inspection Finding</Text>
              <Text style={styles.headerSubtitle}>Form 2598 Implementation</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (!cifData.phoneNotified || !cifData.assetWiseLogged) {
                Alert.alert(
                  "Cannot Close",
                  "Complete the Safety Protocol Verification before closing this Critical Inspection Finding."
                );
                return;
              }
              setShowCIFModal(false);
            }}
            style={[styles.closeBtn, (!cifData.phoneNotified || !cifData.assetWiseLogged) && styles.closeBtnLocked]}
          >
            <Feather name={(!cifData.phoneNotified || !cifData.assetWiseLogged) ? "lock" : "x"} size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Structure Info */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Structure No.</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{cifData.structureNumber}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Inspection Date</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{cifData.inspectionDate}</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FINDINGS / REASON FOR CIF</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: "#fef9c3", borderColor: colors.border, color: colors.foreground }]}
                multiline
                numberOfLines={4}
                value={cifData.findings}
                onChangeText={(t) => setCifData({ ...cifData, findings: t })}
                placeholder="Describe findings..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INSPECTOR&apos;S RECOMMENDATION</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: "#fef9c3", borderColor: colors.border, color: colors.foreground }]}
                multiline
                numberOfLines={4}
                value={cifData.recommendation}
                onChangeText={(t) => setCifData({ ...cifData, recommendation: t })}
                placeholder="Specify remedial strategies..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Photos */}
            <View style={styles.fieldGroup}>
              <View style={styles.photoHeader}>
                <Text style={[styles.fieldLabel, { color: "#dc2626" }]}>SAFETY EVIDENCE MEDIA</Text>
                <View style={styles.photoButtons}>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: colors.secondary }]}
                    onPress={addPhoto}
                  >
                    <Feather name="image" size={14} color={colors.foreground} />
                    <Text style={[styles.photoBtnText, { color: colors.foreground }]}>Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: "#dc2626" }]}
                    onPress={capturePhoto}
                  >
                    <Feather name="camera" size={14} color="#fff" />
                    <Text style={[styles.photoBtnText, { color: "#fff" }]}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {cifData.photos.map((p, idx) => (
                <View key={idx} style={[styles.photoRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
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

            {/* Safety Protocol */}
            <View style={[styles.safetyBox, { borderColor: "#dc2626", backgroundColor: "#fef2f2" }]}>
              <Text style={[styles.safetyTitle, { color: "#dc2626" }]}>SAFETY PROTOCOL VERIFICATION</Text>
              <Pressable
                style={styles.checkRow}
                onPress={() => setCifData({ ...cifData, phoneNotified: !cifData.phoneNotified })}
              >
                <View style={[styles.checkbox, cifData.phoneNotified && { backgroundColor: "#dc2626", borderColor: "#dc2626" }, { borderColor: colors.border }]}>
                  {cifData.phoneNotified && <Feather name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkText, { color: colors.foreground }]}>
                  Immediate Phone Notification to District Bridge Office Complete
                </Text>
              </Pressable>
              <Pressable
                style={styles.checkRow}
                onPress={() => setCifData({ ...cifData, assetWiseLogged: !cifData.assetWiseLogged })}
              >
                <View style={[styles.checkbox, cifData.assetWiseLogged && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.border }]}>
                  {cifData.assetWiseLogged && <Feather name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkText, { color: colors.foreground }]}>
                  AssetWise FUA Transitioned to &quot;District Bridge Review&quot;
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
              canComplete ? { backgroundColor: "#dc2626" } : { backgroundColor: colors.muted },
            ]}
            onPress={handleComplete}
          >
            <Feather name="shield" size={18} color={canComplete ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.finalizeBtnText, { color: canComplete ? "#fff" : colors.mutedForeground }]}>
              Finalize CIF Safety Record
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
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  closeBtn: { padding: 8, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.2)" },
  closeBtnLocked: { backgroundColor: "rgba(0,0,0,0.4)" },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  infoRow: { flexDirection: "row", gap: 16 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: "800" },
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
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoButtons: { flexDirection: "row", gap: 8 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  photoBtnText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, borderWidth: 1 },
  dateStampBadge: { position: "absolute", bottom: 3, right: 3, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  dateStampText: { fontSize: 7, color: "#fff", fontWeight: "700" },
  photoThumb: { width: 56, height: 56, borderRadius: 8 },
  photoDetails: { flex: 1 },
  photoInput: { borderWidth: 1, borderRadius: 6, padding: 6, fontSize: 11 },
  safetyBox: { borderWidth: 2, borderRadius: 12, padding: 14, gap: 10 },
  safetyTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { fontSize: 11, fontWeight: "700", flex: 1, textTransform: "uppercase" },
  footer: { padding: 16, borderTopWidth: 1 },
  finalizeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  finalizeBtnText: { fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
});
