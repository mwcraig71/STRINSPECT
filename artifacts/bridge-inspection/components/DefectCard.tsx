import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { DefectRecord, useInspection } from "@/context/InspectionContext";
import colors from "@/constants/colors";

interface DefectCardProps {
  record: DefectRecord;
  isLegacy?: boolean;
  onEdit: () => void;
}

const CS_COLORS: Record<string, string> = {
  CS1: colors.light.cs1,
  CS2: colors.light.cs2,
  CS3: colors.light.cs3,
  CS4: colors.light.cs4,
};

export function DefectCard({ record, isLegacy, onEdit }: DefectCardProps) {
  const c = useColors();
  const { deleteDefect, verifyDefect } = useInspection();

  const borderColor = record.isCritical
    ? "#dc2626"
    : record.isMaintenance
    ? c.primary
    : isLegacy && record.needsVerification
    ? "#d97706"
    : c.border;

  const handleDelete = () => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this defect record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteDefect(record.id),
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: record.isCritical
            ? "#fff5f5"
            : record.isMaintenance
            ? "#eff6ff"
            : c.card,
          borderColor,
        },
      ]}
    >
      <View style={styles.row}>
        {record.photos.length > 0 && (
          <Image
            source={{ uri: record.photos[0].uri }}
            style={styles.thumb}
          />
        )}
        <View style={styles.main}>
          <View style={styles.topRow}>
            <Text style={[styles.location, { color: c.primary }]}>
              {record.location}
            </Text>
            <Text style={[styles.env, { color: c.mutedForeground }]}>
              ENV {record.environment}
            </Text>
          </View>
          <Text style={[styles.elementName, { color: c.foreground }]} numberOfLines={1}>
            {record.element}: {record.defect}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.csBadge, { backgroundColor: CS_COLORS[record.cs] || c.primary }]}>
              <Text style={styles.csBadgeText}>{record.cs}</Text>
            </View>
            <Text style={[styles.qty, { color: c.mutedForeground }]}>{record.quantity}</Text>
            {record.isCritical && (
              <View style={[styles.flagBadge, { backgroundColor: "#fef2f2" }]}>
                <Feather name="alert-triangle" size={11} color="#dc2626" />
                <Text style={[styles.flagText, { color: "#dc2626" }]}>Critical</Text>
              </View>
            )}
            {record.isMaintenance && (
              <View style={[styles.flagBadge, { backgroundColor: "#eff6ff" }]}>
                <Feather name="tool" size={11} color={c.primary} />
                <Text style={[styles.flagText, { color: c.primary }]}>Maint</Text>
              </View>
            )}
            {record.needsVerification && (
              <Feather name="shield" size={14} color="#d97706" />
            )}
            {record.photosCount > 0 && (
              <View style={styles.photoCount}>
                <Feather name="image" size={11} color={c.primary} />
                <Text style={[styles.photoCountText, { color: c.primary }]}>{record.photosCount}</Text>
              </View>
            )}
          </View>
          {record.locationDesc ? (
            <Text style={[styles.desc, { color: c.mutedForeground }]} numberOfLines={2}>
              {record.locationDesc}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          {record.needsVerification && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#dcfce7" }]}
              onPress={() => verifyDefect(record.id)}
            >
              <Feather name="check-circle" size={16} color="#059669" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: c.secondary }]}
            onPress={onEdit}
          >
            <Feather name="edit-2" size={16} color={c.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#fef2f2" }]}
            onPress={handleDelete}
          >
            <Feather name="trash-2" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  main: { flex: 1, gap: 3 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  location: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  env: { fontSize: 10, fontWeight: "600" },
  elementName: { fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  badges: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 },
  csBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  csBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  qty: { fontSize: 10, fontWeight: "700" },
  flagBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  flagText: { fontSize: 10, fontWeight: "700" },
  photoCount: { flexDirection: "row", alignItems: "center", gap: 3 },
  photoCountText: { fontSize: 10, fontWeight: "700" },
  desc: { fontSize: 11, fontStyle: "italic", marginTop: 2 },
  actions: { gap: 6, alignItems: "center" },
  actionBtn: { padding: 8, borderRadius: 10 },
});
