import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const borderColor = record.isCritical
    ? "#dc2626"
    : record.isImported
    ? "#f97316"
    : record.isMaintenance
    ? c.primary
    : isLegacy && record.needsVerification
    ? "#d97706"
    : c.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: record.isCritical
            ? "#fff5f5"
            : record.isImported
            ? "#fff7ed"
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
            {record.isImported && (
              <View style={[styles.flagBadge, { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#f97316" }]}>
                <Feather name="download" size={10} color="#f97316" />
                <Text style={[styles.flagText, { color: "#f97316" }]}>Imported</Text>
              </View>
            )}
            {record.needsVerification && record.cs !== "CS1" && (
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
            <Text style={[styles.desc, { color: c.mutedForeground }]} numberOfLines={1}>
              {record.locationDesc}
            </Text>
          ) : null}
        </View>

        {confirmingDelete ? (
          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#fef2f2", borderColor: "#dc2626" }]}
              onPress={() => {
                setConfirmingDelete(false);
                deleteDefect(record.id);
              }}
            >
              <Feather name="trash-2" size={14} color="#dc2626" />
              <Text style={[styles.confirmText, { color: "#dc2626" }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
              onPress={() => setConfirmingDelete(false)}
            >
              <Text style={[styles.confirmText, { color: c.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actions}>
            {record.needsVerification && record.cs !== "CS1" && (
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
              onPress={() => setConfirmingDelete(true)}
            >
              <Feather name="trash-2" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 7, alignItems: "center" },
  thumb: { width: 32, height: 32, borderRadius: 6 },
  main: { flex: 1, gap: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  location: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  elementName: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  badges: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  csBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  csBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff" },
  qty: { fontSize: 9, fontWeight: "700" },
  flagBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  flagText: { fontSize: 9, fontWeight: "700" },
  photoCount: { flexDirection: "row", alignItems: "center", gap: 2 },
  photoCountText: { fontSize: 9, fontWeight: "700" },
  desc: { fontSize: 10, fontStyle: "italic" },
  actions: { gap: 4, alignItems: "center", flexDirection: "row" },
  actionBtn: { padding: 6, borderRadius: 8 },
  confirmRow: { gap: 4, alignItems: "center", flexDirection: "column" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmText: { fontSize: 11, fontWeight: "700" },
});
