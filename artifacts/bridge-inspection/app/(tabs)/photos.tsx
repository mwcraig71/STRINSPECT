import { AppIcon as Feather } from "@/components/AppIcon";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoTagEditor } from "@/components/PhotoTagEditor";
import { useColors } from "@/hooks/useColors";
import { resizePhoto } from "@/lib/photoUtils";
import { AdditionalPhoto, StandardPhotoSlot, useInspection } from "@/context/InspectionContext";

type PreviewTarget =
  | { kind: "standard"; slot: StandardPhotoSlot }
  | { kind: "extra"; slot: StandardPhotoSlot }
  | { kind: "additional"; slot: StandardPhotoSlot; index: number }
  | { kind: "defect"; defectId: string; photoId: string };

export default function PhotosScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    standardPhotos,
    setStandardPhotoSlot,
    standardPhotosComplete,
    addStandardPhotoAdditional,
    removeStandardPhotoAdditional,
    updateStandardPhotoAdditionalTags,
    structureNumber,
    extraPhotos,
    addExtraPhoto,
    setExtraPhotoSlot,
    removeExtraPhoto: deleteExtraSlotFromContext,
    savedDefects,
    updateDefectPhoto,
    removeDefectPhoto,
    lastPhotoSource,
    setLastPhotoSource,
    imageSize,
  } = useInspection();
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const defectPhotos = savedDefects.flatMap((record) =>
    (record.photos ?? []).map((photo, index) => ({
      defect: record,
      photo: {
        ...photo,
        photoId: photo.photoId || `${record.id}_${index}`,
        directionTags: photo.directionTags ?? [],
        subjectTags: photo.subjectTags ?? [],
      },
    }))
  );

  const pickPhotoResult = async (): Promise<{ uri: string; heading?: number } | null> => {
    if (Platform.OS === "web") {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return null;
      return { uri: result.assets[0].uri };
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return null;
    let heading: number | undefined;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const h = await Location.getHeadingAsync();
        const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (raw >= 0) heading = Math.round(raw);
      }
    } catch {}
    return { uri: result.assets[0].uri, heading };
  };

  const pickLibraryResult = async (): Promise<string | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return null;
    return result.assets[0].uri;
  };

  const confirm = (message: string, onConfirm: () => void) => {
    if (Platform.OS === "web") {
      onConfirm();
    } else {
      Alert.alert("Confirm", message, [
        { text: "Cancel", style: "cancel" },
        { text: "OK", onPress: onConfirm },
      ]);
    }
  };

  const headingToDirection = (heading: number): string => {
    if (heading >= 315 || heading < 45) return "N";
    if (heading >= 45 && heading < 135) return "E";
    if (heading >= 135 && heading < 225) return "S";
    return "W";
  };

  const capturePhoto = async (slot: StandardPhotoSlot) => {
    const res = await pickPhotoResult();
    if (!res) return;
    setLastPhotoSource(Platform.OS === "web" ? "library" : "camera");
    const directionTags: string[] = res.heading !== undefined ? [headingToDirection(res.heading)] : [];
    setStandardPhotoSlot(slot.slotId, {
      photoUri: res.uri,
      capturedAt: new Date().toISOString(),
      directionTags,
      notNeeded: false,
    });
  };

  const pickPhoto = async (slot: StandardPhotoSlot) => {
    const uri = await pickLibraryResult();
    if (!uri) return;
    setLastPhotoSource("library");
    setStandardPhotoSlot(slot.slotId, {
      photoUri: uri,
      capturedAt: new Date().toISOString(),
      notNeeded: false,
    });
  };

  const captureAdditionalPhoto = async (slot: StandardPhotoSlot) => {
    const res = await pickPhotoResult();
    if (!res) return;
    setLastPhotoSource(Platform.OS === "web" ? "library" : "camera");
    const directionTags: string[] = res.heading !== undefined ? [headingToDirection(res.heading)] : [];
    const photo: AdditionalPhoto = {
      uri: res.uri,
      capturedAt: new Date().toISOString(),
      directionTags,
      subjectTags: [],
    };
    addStandardPhotoAdditional(slot.slotId, photo);
  };

  const pickAdditionalPhoto = async (slot: StandardPhotoSlot) => {
    const uri = await pickLibraryResult();
    if (!uri) return;
    setLastPhotoSource("library");
    const photo: AdditionalPhoto = {
      uri,
      capturedAt: new Date().toISOString(),
      directionTags: [],
      subjectTags: [],
    };
    addStandardPhotoAdditional(slot.slotId, photo);
  };

  const removePhoto = (slotId: string) => {
    confirm("Remove the main photo for this slot?", () =>
      setStandardPhotoSlot(slotId, {
        photoUri: undefined,
        capturedAt: undefined,
        directionTags: [],
        subjectTags: [],
      })
    );
  };

  const removeAdditionalPhoto = (slotId: string, index: number) => {
    confirm("Remove this additional photo?", () =>
      removeStandardPhotoAdditional(slotId, index)
    );
  };

  const markNotNeeded = (slotId: string) => {
    confirm(
      "Mark as not needed? This waives the photo requirement and won't block sign-off. You can undo it later.",
      () => setStandardPhotoSlot(slotId, { notNeeded: true })
    );
  };

  const undoNotNeeded = (slotId: string) => {
    setStandardPhotoSlot(slotId, { notNeeded: false });
  };

  const captureExtraPhoto = async (slot: StandardPhotoSlot) => {
    const res = await pickPhotoResult();
    if (!res) return;
    setLastPhotoSource(Platform.OS === "web" ? "library" : "camera");
    const directionTags: string[] = res.heading !== undefined ? [headingToDirection(res.heading)] : [];
    setExtraPhotoSlot(slot.slotId, {
      photoUri: res.uri,
      capturedAt: new Date().toISOString(),
      directionTags,
    });
  };

  const pickExtraPhoto = async (slot: StandardPhotoSlot) => {
    const uri = await pickLibraryResult();
    if (!uri) return;
    setLastPhotoSource("library");
    setExtraPhotoSlot(slot.slotId, {
      photoUri: uri,
      capturedAt: new Date().toISOString(),
    });
  };

  const removeExtraPhoto = (slotId: string) => {
    confirm("Remove this photo?", () =>
      setExtraPhotoSlot(slotId, {
        photoUri: undefined,
        capturedAt: undefined,
        directionTags: [],
        subjectTags: [],
      })
    );
  };

  const deleteExtraSlot = (slotId: string) => {
    confirm("Delete this additional photo slot?", () =>
      deleteExtraSlotFromContext(slotId)
    );
  };

  const requiredCount = standardPhotos.filter((s) => !s.notNeeded).length;
  const capturedCount = standardPhotos.filter((s) => !!s.photoUri && !s.notNeeded).length;
  const waivedCount = standardPhotos.filter((s) => !!s.notNeeded).length;

  const getPreviewPhoto = (): { uri: string; directionTags: string[]; subjectTags: string[]; capturedAt?: string; label: string; note?: string } | null => {
    if (!previewTarget) return null;
    if (previewTarget.kind === "defect") {
      const record = savedDefects.find((candidate) => candidate.id === previewTarget.defectId);
      const photo = record?.photos.find((candidate, index) =>
        (candidate.photoId || `${record.id}_${index}`) === previewTarget.photoId
      );
      if (!record || !photo) return null;
      return {
        uri: photo.uri,
        directionTags: photo.directionTags ?? [],
        subjectTags: photo.subjectTags ?? [],
        capturedAt: photo.capturedAt,
        label: `${record.element} — ${record.defect}`,
        note: photo.description,
      };
    }
    const { kind, slot } = previewTarget;
    if (kind === "additional") {
      const p = slot.additionalPhotos?.[previewTarget.index];
      if (!p) return null;
      return { uri: p.uri, directionTags: p.directionTags, subjectTags: p.subjectTags, capturedAt: p.capturedAt, label: `${slot.label} — Additional ${previewTarget.index + 1}` };
    }
    if (!slot.photoUri) return null;
    if (kind === "extra") {
      return { uri: slot.photoUri, directionTags: slot.directionTags, subjectTags: slot.subjectTags, capturedAt: slot.capturedAt, label: slot.label, note: slot.note };
    }
    return { uri: slot.photoUri, directionTags: slot.directionTags, subjectTags: slot.subjectTags, capturedAt: slot.capturedAt, label: slot.label };
  };

  const handlePreviewDirectionChange = (tags: string[]) => {
    if (!previewTarget) return;
    if (previewTarget.kind === "defect") {
      updateDefectPhoto(previewTarget.defectId, previewTarget.photoId, { directionTags: tags });
      return;
    }
    const { kind, slot } = previewTarget;
    if (kind === "additional") {
      updateStandardPhotoAdditionalTags(slot.slotId, previewTarget.index, tags, slot.additionalPhotos?.[previewTarget.index]?.subjectTags ?? []);
      setPreviewTarget((p) => {
        if (!p || p.kind !== "additional") return p;
        const additionalPhotos = [...(slot.additionalPhotos ?? [])];
        if (additionalPhotos[p.index]) additionalPhotos[p.index] = { ...additionalPhotos[p.index], directionTags: tags };
        return { ...p, slot: { ...p.slot, additionalPhotos } };
      });
    } else if (kind === "extra") {
      setExtraPhotoSlot(slot.slotId, { directionTags: tags });
      setPreviewTarget((p) => !p || p.kind === "defect" ? p : { ...p, slot: { ...p.slot, directionTags: tags } });
    } else {
      setStandardPhotoSlot(slot.slotId, { directionTags: tags });
      setPreviewTarget((p) => !p || p.kind === "defect" ? p : { ...p, slot: { ...p.slot, directionTags: tags } });
    }
  };

  const handlePreviewSubjectChange = (tags: string[]) => {
    if (!previewTarget) return;
    if (previewTarget.kind === "defect") {
      updateDefectPhoto(previewTarget.defectId, previewTarget.photoId, { subjectTags: tags });
      return;
    }
    const { kind, slot } = previewTarget;
    if (kind === "additional") {
      updateStandardPhotoAdditionalTags(slot.slotId, previewTarget.index, slot.additionalPhotos?.[previewTarget.index]?.directionTags ?? [], tags);
      setPreviewTarget((p) => {
        if (!p || p.kind !== "additional") return p;
        const additionalPhotos = [...(slot.additionalPhotos ?? [])];
        if (additionalPhotos[p.index]) additionalPhotos[p.index] = { ...additionalPhotos[p.index], subjectTags: tags };
        return { ...p, slot: { ...p.slot, additionalPhotos } };
      });
    } else if (kind === "extra") {
      setExtraPhotoSlot(slot.slotId, { subjectTags: tags });
      setPreviewTarget((p) => !p || p.kind === "defect" ? p : { ...p, slot: { ...p.slot, subjectTags: tags } });
    } else {
      setStandardPhotoSlot(slot.slotId, { subjectTags: tags });
      setPreviewTarget((p) => !p || p.kind === "defect" ? p : { ...p, slot: { ...p.slot, subjectTags: tags } });
    }
  };

  const previewPhoto = getPreviewPhoto();

  const replaceDefectPhoto = async (source: "camera" | "library") => {
    if (!previewTarget || previewTarget.kind !== "defect") return;
    const actualSource = Platform.OS === "web" ? "library" : source;
    if (actualSource === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required.");
        return;
      }
    }
    const result = actualSource === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = await resizePhoto(asset.uri, imageSize, asset.width, asset.height);
    updateDefectPhoto(previewTarget.defectId, previewTarget.photoId, {
      uri,
      capturedAt: new Date().toISOString(),
      source: actualSource,
      fileName: asset.fileName ?? undefined,
    });
    setLastPhotoSource(actualSource);
  };

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
              {capturedCount}/{requiredCount}
              {waivedCount > 0 ? ` · ${waivedCount} waived` : ""}
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
              {standardPhotos.filter((s) => !s.photoUri && !s.notNeeded).length} required photo
              {standardPhotos.filter((s) => !s.photoUri && !s.notNeeded).length !== 1 ? "s" : ""} still needed before leaving the bridge
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
            onMarkNotNeeded={() => markNotNeeded(slot.slotId)}
            onUndoNotNeeded={() => undoNotNeeded(slot.slotId)}
            onPreview={() => setPreviewTarget({ kind: "standard", slot })}
            onCaptureAdditional={() => captureAdditionalPhoto(slot)}
            onPickAdditional={() => pickAdditionalPhoto(slot)}
            onRemoveAdditional={(i) => removeAdditionalPhoto(slot.slotId, i)}
            onPreviewAdditional={(i) => setPreviewTarget({ kind: "additional", slot, index: i })}
            onTagsChange={(directionTags, subjectTags) =>
              setStandardPhotoSlot(slot.slotId, { directionTags, subjectTags })
            }
          />
        ))}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Feather name="layers" size={14} color="#38bdf8" />
            <Text style={[styles.sectionHeaderText, { color: "#38bdf8" }]}>Element Inspection Photos</Text>
            {defectPhotos.length > 0 && (
              <View style={[styles.extraBadge, { backgroundColor: "#082f49" }]}>
                <Text style={[styles.extraBadgeText, { color: "#38bdf8" }]}>{defectPhotos.length}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.sourceHint, { color: c.mutedForeground }]}>
          Replacement source remembered: {lastPhotoSource === "camera" ? "Camera" : "Photo Library"}. Album/folder navigation remains controlled by your device.
        </Text>
        {defectPhotos.length === 0 ? (
          <View style={[styles.emptyExtraCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name="image" size={22} color="#475569" />
            <Text style={[styles.emptyExtraText, { color: c.mutedForeground }]}>
              Photos attached while recording element defects will appear here.
            </Text>
          </View>
        ) : (
          defectPhotos.map(({ defect: record, photo }) => (
            <View key={`${record.id}:${photo.photoId}`} style={[styles.defectPhotoCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <TouchableOpacity
                onPress={() => setPreviewTarget({ kind: "defect", defectId: record.id, photoId: photo.photoId! })}
                activeOpacity={0.85}
              >
                <Image source={{ uri: photo.uri }} style={styles.defectThumbnail} resizeMode="cover" />
              </TouchableOpacity>
              <View style={styles.defectPhotoInfo}>
                <Text style={[styles.defectContext, { color: c.foreground }]}>{record.element} — {record.defect}</Text>
                <Text style={[styles.defectLocation, { color: c.mutedForeground }]}>{record.location}</Text>
                {!!photo.description && (
                  <Text style={[styles.defectNote, { color: c.mutedForeground }]} numberOfLines={2}>{photo.description}</Text>
                )}
                <TouchableOpacity
                  style={styles.smallAction}
                  onPress={() => setPreviewTarget({ kind: "defect", defectId: record.id, photoId: photo.photoId! })}
                >
                  <Feather name="edit-3" size={12} color="#38bdf8" />
                  <Text style={styles.smallActionText}>Preview & edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Feather name="image" size={14} color="#a78bfa" />
            <Text style={styles.sectionHeaderText}>Additional Photos</Text>
            {extraPhotos.length > 0 && (
              <View style={[styles.extraBadge, { backgroundColor: "#1e1b4b" }]}>
                <Text style={styles.extraBadgeText}>{extraPhotos.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={addExtraPhoto}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.addPhotoBtnText}>Add Photo</Text>
          </TouchableOpacity>
        </View>

        {extraPhotos.length === 0 && (
          <View style={[styles.emptyExtraCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name="camera" size={22} color="#475569" />
            <Text style={[styles.emptyExtraText, { color: c.mutedForeground }]}>
              Tap "Add Photo" to capture additional photos for this inspection
            </Text>
          </View>
        )}

        {extraPhotos.map((slot) => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            colors={c}
            isExtra
            onCapture={() => captureExtraPhoto(slot)}
            onPick={() => pickExtraPhoto(slot)}
            onRemove={() => removeExtraPhoto(slot.slotId)}
            onDelete={() => deleteExtraSlot(slot.slotId)}
            onPreview={() => setPreviewTarget({ kind: "extra", slot })}
            onTagsChange={(directionTags, subjectTags) =>
              setExtraPhotoSlot(slot.slotId, { directionTags, subjectTags })
            }
            onNoteChange={(note) => setExtraPhotoSlot(slot.slotId, { note })}
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {previewPhoto && previewTarget && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewTarget(null)}>
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewTarget(null)}>
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={[styles.previewScrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              <Pressable style={[styles.previewCard, { backgroundColor: c.card }]} onPress={() => {}}>
                <View style={styles.previewHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.previewTitle, { color: c.foreground }]}>
                      {previewPhoto.note ? previewPhoto.note : previewPhoto.label}
                    </Text>
                    {previewPhoto.note ? (
                      <Text style={[styles.previewSubtitle, { color: c.mutedForeground }]}>{previewPhoto.label}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => setPreviewTarget(null)} style={{ padding: 4 }}>
                    <Feather name="x" size={20} color={c.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: previewPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
                <View style={styles.previewTags}>
                  <PhotoTagEditor
                    directionTags={previewPhoto.directionTags}
                    subjectTags={previewPhoto.subjectTags}
                    onDirectionChange={handlePreviewDirectionChange}
                    onSubjectChange={handlePreviewSubjectChange}
                  />
                  {previewTarget.kind === "defect" && (
                    <>
                      <Text style={[styles.previewNoteLabel, { color: c.mutedForeground }]}>Photo note</Text>
                      <TextInput
                        style={[styles.previewNoteInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
                        value={previewPhoto.note ?? ""}
                        onChangeText={(description) =>
                          updateDefectPhoto(previewTarget.defectId, previewTarget.photoId, { description })
                        }
                        placeholder="Add inspection photo notes..."
                        placeholderTextColor={c.mutedForeground}
                        multiline
                      />
                      <View style={styles.previewActions}>
                        <TouchableOpacity style={[styles.previewActionBtn, { backgroundColor: "#0284c7" }]} onPress={() => replaceDefectPhoto(Platform.OS === "web" ? "library" : lastPhotoSource)}>
                          <Feather name={Platform.OS !== "web" && lastPhotoSource === "camera" ? "camera" : "image"} size={13} color="#fff" />
                          <Text style={styles.previewActionText}>Replace with {Platform.OS !== "web" && lastPhotoSource === "camera" ? "Camera" : "Library"}</Text>
                        </TouchableOpacity>
                        {Platform.OS !== "web" && (
                          <TouchableOpacity
                            style={[styles.previewActionBtn, { backgroundColor: "#334155" }]}
                            onPress={() => replaceDefectPhoto(lastPhotoSource === "camera" ? "library" : "camera")}
                          >
                            <Text style={styles.previewActionText}>Other source</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.previewActionBtn, { backgroundColor: "#7f1d1d" }]}
                          onPress={() => confirm("Remove this photo from the linked defect?", () => {
                            removeDefectPhoto(previewTarget.defectId, previewTarget.photoId);
                            setPreviewTarget(null);
                          })}
                        >
                          <Feather name="trash-2" size={13} color="#fff" />
                          <Text style={styles.previewActionText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
                {previewPhoto.capturedAt && (
                  <Text style={[styles.previewMeta, { color: c.mutedForeground }]}>
                    {new Date(previewPhoto.capturedAt).toLocaleString("en-US")}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

interface SlotCardProps {
  slot: StandardPhotoSlot;
  colors: ReturnType<typeof useColors>;
  isExtra?: boolean;
  onCapture: () => void;
  onPick: () => void;
  onRemove: () => void;
  onDelete?: () => void;
  onMarkNotNeeded?: () => void;
  onUndoNotNeeded?: () => void;
  onPreview: () => void;
  onCaptureAdditional?: () => void;
  onPickAdditional?: () => void;
  onRemoveAdditional?: (index: number) => void;
  onPreviewAdditional?: (index: number) => void;
  onTagsChange: (directionTags: string[], subjectTags: string[]) => void;
  onNoteChange?: (note: string) => void;
}

function SlotCard({
  slot,
  colors: c,
  isExtra,
  onCapture,
  onPick,
  onRemove,
  onDelete,
  onMarkNotNeeded,
  onUndoNotNeeded,
  onPreview,
  onCaptureAdditional,
  onPickAdditional,
  onRemoveAdditional,
  onPreviewAdditional,
  onTagsChange,
  onNoteChange,
}: SlotCardProps) {
  const captured = !!slot.photoUri;
  const notNeeded = !!slot.notNeeded;
  const additionalPhotos = slot.additionalPhotos ?? [];

  const borderColor = notNeeded
    ? "#374151"
    : captured
    ? "#10b981"
    : isExtra
    ? "#4c1d95"
    : "#334155";

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor, borderWidth: captured || notNeeded ? 1.5 : 1 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={[styles.statusDot, {
            backgroundColor: notNeeded ? "#374151" : captured ? "#10b981" : isExtra ? "#7c3aed" : "#475569",
          }]} />
          <Text style={[styles.slotLabel, { color: notNeeded ? c.mutedForeground : c.foreground }]}>{slot.label}</Text>
          {notNeeded && (
            <View style={styles.waivedBadge}>
              <Text style={styles.waivedBadgeText}>Not needed</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          {captured && (
            <TouchableOpacity onPress={onRemove} style={styles.iconBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather name="trash-2" size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
          {isExtra && (
            <TouchableOpacity onPress={onDelete} style={styles.iconBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather name="x-circle" size={14} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isExtra && (
        <View style={styles.noteRow}>
          <Feather name="edit-3" size={12} color="#64748b" style={{ marginTop: 2 }} />
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note (e.g. Underside of Span 2 — active efflorescence)"
            placeholderTextColor="#475569"
            value={slot.note ?? ""}
            onChangeText={(text) => onNoteChange?.(text.slice(0, 80))}
            maxLength={80}
            returnKeyType="done"
          />
        </View>
      )}

      {notNeeded ? (
        <View style={styles.notNeededArea}>
          <Feather name="slash" size={24} color="#374151" />
          <Text style={[styles.notNeededText, { color: c.mutedForeground }]}>
            This photo has been marked as not needed
          </Text>
          <TouchableOpacity style={styles.undoBtn} onPress={onUndoNotNeeded}>
            <Feather name="rotate-ccw" size={13} color="#94a3b8" />
            <Text style={styles.undoBtnText}>Undo — require this photo</Text>
          </TouchableOpacity>
        </View>
      ) : captured ? (
        <>
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

          {additionalPhotos.length > 0 && (
            <View style={[styles.additionalSection, { borderTopColor: "#1e293b" }]}>
              <Text style={styles.additionalSectionLabel}>Additional photos ({additionalPhotos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.additionalScroll} contentContainerStyle={styles.additionalScrollContent}>
                {additionalPhotos.map((p, i) => (
                  <View key={i} style={styles.additionalThumbWrap}>
                    <TouchableOpacity onPress={() => onPreviewAdditional?.(i)} activeOpacity={0.8}>
                      <Image source={{ uri: p.uri }} style={styles.additionalThumb} resizeMode="cover" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.additionalRemoveBtn} onPress={() => onRemoveAdditional?.(i)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <Feather name="x" size={10} color="#fff" />
                    </TouchableOpacity>
                    {(p.directionTags.length > 0 || p.subjectTags.length > 0) && (
                      <View style={styles.additionalTagRow}>
                        {[...p.directionTags, ...p.subjectTags].slice(0, 2).map((t, ti) => (
                          <View key={ti} style={[styles.miniTagChip]}>
                            <Text style={styles.miniTagText}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {!isExtra && (
            <View style={[styles.addAnotherRow, { borderTopColor: "#1e293b" }]}>
              <TouchableOpacity style={styles.addAnotherBtn} onPress={onCaptureAdditional}>
                <Feather name="camera" size={13} color="#38bdf8" />
                <Text style={styles.addAnotherText}>Add another photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addAnotherBtn} onPress={onPickAdditional}>
                <Feather name="image" size={13} color="#64748b" />
                <Text style={[styles.addAnotherText, { color: "#64748b" }]}>From library</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
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
          {!isExtra && onMarkNotNeeded && (
            <TouchableOpacity style={styles.notNeededBtn} onPress={onMarkNotNeeded}>
              <Feather name="slash" size={13} color="#64748b" />
              <Text style={styles.notNeededBtnText}>Photo not needed</Text>
            </TouchableOpacity>
          )}
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
  cardActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  slotLabel: { fontSize: 14, fontWeight: "600" },
  iconBtn: { padding: 4 },
  waivedBadge: { backgroundColor: "#1f2937", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  waivedBadgeText: { color: "#6b7280", fontSize: 10, fontWeight: "600" },
  thumbnail: { width: "100%", height: 180 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 10, paddingTop: 8 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  tagChipText: { fontSize: 11, fontWeight: "500" },
  expandHint: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  expandHintText: { color: "#64748b", fontSize: 11 },
  additionalSection: { borderTopWidth: 1, paddingTop: 8, paddingBottom: 4 },
  additionalSectionLabel: { color: "#64748b", fontSize: 11, fontWeight: "600", paddingHorizontal: 12, marginBottom: 6 },
  additionalScroll: { maxHeight: 120 },
  additionalScrollContent: { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  additionalThumbWrap: { width: 88, position: "relative" },
  additionalThumb: { width: 88, height: 88, borderRadius: 8 },
  additionalRemoveBtn: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  additionalTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4 },
  miniTagChip: { backgroundColor: "#1e293b", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  miniTagText: { color: "#94a3b8", fontSize: 9, fontWeight: "500" },
  addAnotherRow: { borderTopWidth: 1, flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 16 },
  addAnotherBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  addAnotherText: { color: "#38bdf8", fontSize: 12, fontWeight: "600" },
  notNeededArea: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 16, gap: 8 },
  notNeededText: { fontSize: 12, textAlign: "center" },
  undoBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#334155" },
  undoBtnText: { color: "#94a3b8", fontSize: 12, fontWeight: "500" },
  emptyArea: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16, gap: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  emptyLabel: { fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  captureBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  captureBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  notNeededBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#334155" },
  notNeededBtnText: { color: "#64748b", fontSize: 12, fontWeight: "500" },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 16 },
  previewScroll: { width: "100%", maxWidth: 520, maxHeight: "100%" },
  previewScrollContent: { flexGrow: 1, justifyContent: "center" },
  previewCard: { width: "100%", maxWidth: 520, borderRadius: 16, overflow: "hidden" },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  previewTitle: { fontSize: 15, fontWeight: "700" },
  previewSubtitle: { fontSize: 11, marginTop: 2 },
  previewImage: { width: "100%", height: 280 },
  previewTags: { padding: 14 },
  previewMeta: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 11 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  noteInput: { flex: 1, color: "#e2e8f0", fontSize: 12, paddingVertical: 4, minWidth: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 4 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionHeaderText: { color: "#c4b5fd", fontSize: 14, fontWeight: "700" },
  extraBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  extraBadgeText: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#7c3aed", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addPhotoBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyExtraCard: { alignItems: "center", justifyContent: "center", gap: 10, padding: 24, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  emptyExtraText: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  sourceHint: { fontSize: 11, marginTop: -8, marginBottom: 2 },
  defectPhotoCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden", flexDirection: "row", minHeight: 118 },
  defectThumbnail: { width: 128, height: 118 },
  defectPhotoInfo: { flex: 1, padding: 12, minWidth: 0 },
  defectContext: { fontSize: 13, fontWeight: "700" },
  defectLocation: { fontSize: 11, marginTop: 3 },
  defectNote: { fontSize: 11, marginTop: 7, lineHeight: 15 },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  smallActionText: { color: "#38bdf8", fontSize: 11, fontWeight: "600" },
  previewNoteLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
  previewNoteInput: { minHeight: 64, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, textAlignVertical: "top" },
  previewActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  previewActionBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  previewActionText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
