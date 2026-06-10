import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoTagEditor } from "@/components/PhotoTagEditor";
import { useColors } from "@/hooks/useColors";
import { StandardPhotoSlot, useInspection } from "@/context/InspectionContext";

export default function PhotosScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { standardPhotos, setStandardPhotoSlot, standardPhotosComplete, structureNumber } = useInspection();
  const [previewSlot, setPreviewSlot] = useState<StandardPhotoSlot | null>(null);

  const capturePhoto = async (slot: StandardPhotoSlot) => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Camera not available in web preview.");
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      let heading: number | null = null;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const h = await Location.getHeadingAsync();
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (raw >= 0) heading = Math.round(raw);
        }
      } catch {}
      const uri = result.assets[0].uri;
      const directionTags: string[] = [];
      if (heading !== null) {
        if (heading >= 315 || heading < 45) directionTags.push("N");
        else if (heading >= 45 && heading < 135) directionTags.push("E");
        else if (heading >= 135 && heading < 225) directionTags.push("S");
        else directionTags.push("W");
      }
      setStandardPhotoSlot(slot.slotId, {
        photoUri: uri,
        capturedAt: new Date().toISOString(),
        directionTags,
      });
    }
  };

  const pickPhoto = async (slot: StandardPhotoSlot) => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Photo library not supported in web preview. Use camera.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setStandardPhotoSlot(slot.slotId, {
        photoUri: result.assets[0].uri,
        capturedAt: new Date().toISOString(),
      });
    }
  };

  const removePhoto = (slotId: string) => {
    Alert.alert("Remove Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setStandardPhotoSlot(slotId, { photoUri: undefined, capturedAt: undefined, directionTags: [], subjectTags: [] }) },
    ]);
  };

  const capturedCount = standardPhotos.filter((s) => !!s.photoUri).length;
  const total = standardPhotos.length;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Feather name="camera" size={16} color="#38bdf8" />
            <Text style={styles.headerTitle}>Standard Photos</Text>
            {structureNumber ? (
              <Text style={styles.headerSub}>{structureNumber}</Text>
            ) : null}
          </View>
          <View style={[styles.progressBadge, { backgroundColor: standardPhotosComplete ? "#052e16" : "#1c1917", borderColor: standardPhotosComplete ? "#10b981" : "#78716c" }]}>
            <Feather name={standardPhotosComplete ? "check-circle" : "camera"} size={12} color={standardPhotosComplete ? "#34d399" : "#78716c"} />
            <Text style={[styles.progressText, { color: standardPhotosComplete ? "#34d399" : "#a8a29e" }]}>
              {capturedCount}/{total}
            </Text>
          </View>
        </View>
        {!structureNumber && (
          <TouchableOpacity onPress={() => router.navigate("/(tabs)/bridges")} style={styles.noBridgeBanner}>
            <Feather name="alert-circle" size={13} color="#f59e0b" />
            <Text style={styles.noBridgeText}>No bridge selected — go to Bridges tab</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {!standardPhotosComplete && (
          <View style={[styles.reminderBanner, { backgroundColor: "#1c1917", borderColor: "#78716c" }]}>
            <Feather name="info" size={14} color="#f59e0b" />
            <Text style={styles.reminderText}>
              {total - capturedCount} required photo{total - capturedCount !== 1 ? "s" : ""} still needed before leaving the bridge
            </Text>
          </View>
        )}

        {standardPhotos.map((slot) => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            colors={c}
            onCapture={() => capturePhoto(slot)}
            onPick={() => pickPhoto(slot)}
            onRemove={() => removePhoto(slot.slotId)}
            onPreview={() => setPreviewSlot(slot)}
            onTagsChange={(directionTags, subjectTags) =>
              setStandardPhotoSlot(slot.slotId, { directionTags, subjectTags })
            }
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {previewSlot && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewSlot(null)}>
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewSlot(null)}>
            <Pressable style={[styles.previewCard, { backgroundColor: c.card }]} onPress={() => {}}>
              <View style={styles.previewHeader}>
                <Text style={[styles.previewTitle, { color: c.foreground }]}>{previewSlot.label}</Text>
                <TouchableOpacity onPress={() => setPreviewSlot(null)} style={{ padding: 4 }}>
                  <Feather name="x" size={20} color={c.mutedForeground} />
                </TouchableOpacity>
              </View>
              {previewSlot.photoUri && (
                <Image source={{ uri: previewSlot.photoUri }} style={styles.previewImage} resizeMode="contain" />
              )}
              <View style={styles.previewTags}>
                <PhotoTagEditor
                  directionTags={previewSlot.directionTags}
                  subjectTags={previewSlot.subjectTags}
                  onDirectionChange={(tags) => {
                    setStandardPhotoSlot(previewSlot.slotId, { directionTags: tags });
                    setPreviewSlot((p) => p ? { ...p, directionTags: tags } : p);
                  }}
                  onSubjectChange={(tags) => {
                    setStandardPhotoSlot(previewSlot.slotId, { subjectTags: tags });
                    setPreviewSlot((p) => p ? { ...p, subjectTags: tags } : p);
                  }}
                />
              </View>
              {previewSlot.capturedAt && (
                <Text style={[styles.previewMeta, { color: c.mutedForeground }]}>
                  {new Date(previewSlot.capturedAt).toLocaleString("en-US")}
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

interface SlotCardProps {
  slot: StandardPhotoSlot;
  colors: ReturnType<typeof useColors>;
  onCapture: () => void;
  onPick: () => void;
  onRemove: () => void;
  onPreview: () => void;
  onTagsChange: (directionTags: string[], subjectTags: string[]) => void;
}

function SlotCard({ slot, colors: c, onCapture, onPick, onRemove, onPreview, onTagsChange }: SlotCardProps) {
  const captured = !!slot.photoUri;
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: captured ? "#10b981" : c.border, borderWidth: captured ? 1.5 : 1 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={[styles.statusDot, { backgroundColor: captured ? "#10b981" : "#475569" }]} />
          <Text style={[styles.slotLabel, { color: c.foreground }]}>{slot.label}</Text>
        </View>
        {captured && (
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Feather name="trash-2" size={14} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      {captured ? (
        <TouchableOpacity onPress={onPreview} activeOpacity={0.85}>
          <Image source={{ uri: slot.photoUri }} style={styles.thumbnail} resizeMode="cover" />
          {(slot.directionTags.length > 0 || slot.subjectTags.length > 0) && (
            <View style={styles.tagRow}>
              {slot.directionTags.map((t) => (
                <View key={t} style={[styles.tagChip, { backgroundColor: "#0f172a", borderColor: "#38bdf8" }]}>
                  <Text style={[styles.tagChipText, { color: "#38bdf8" }]}>{t}</Text>
                </View>
              ))}
              {slot.subjectTags.map((t) => (
                <View key={t} style={[styles.tagChip, { backgroundColor: "#1e1b4b", borderColor: "#a78bfa" }]}>
                  <Text style={[styles.tagChipText, { color: "#a78bfa" }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.expandHint}>
            <Feather name="maximize-2" size={11} color="#94a3b8" />
            <Text style={styles.expandHintText}>Tap to edit tags</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.emptyArea}>
          <View style={[styles.emptyIcon, { backgroundColor: c.background }]}>
            <Feather name="camera-off" size={28} color="#475569" />
          </View>
          <Text style={[styles.emptyLabel, { color: c.mutedForeground }]}>Photo not captured</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.captureBtn, { backgroundColor: "#0284c7" }]} onPress={onCapture}>
              <Feather name="camera" size={14} color="#fff" />
              <Text style={styles.captureBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.captureBtn, { backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1 }]} onPress={onPick}>
              <Feather name="image" size={14} color="#94a3b8" />
              <Text style={[styles.captureBtnText, { color: "#94a3b8" }]}>Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "700" },
  headerSub: { color: "#94a3b8", fontSize: 11 },
  progressBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  progressText: { fontSize: 12, fontWeight: "600" },
  noBridgeBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  noBridgeText: { color: "#f59e0b", fontSize: 12 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 12 },
  reminderBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  reminderText: { color: "#d6d3d1", fontSize: 13, flex: 1 },
  card: { borderRadius: 12, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  slotLabel: { fontSize: 14, fontWeight: "600" },
  removeBtn: { padding: 4 },
  thumbnail: { width: "100%", height: 180 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 10, paddingTop: 8 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  tagChipText: { fontSize: 11, fontWeight: "500" },
  expandHint: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  expandHintText: { color: "#64748b", fontSize: 11 },
  emptyArea: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16, gap: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  emptyLabel: { fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  captureBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  captureBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 16 },
  previewCard: { width: "100%", maxWidth: 520, borderRadius: 16, overflow: "hidden" },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  previewTitle: { fontSize: 15, fontWeight: "700" },
  previewImage: { width: "100%", height: 280 },
  previewTags: { padding: 14 },
  previewMeta: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 11 },
});
