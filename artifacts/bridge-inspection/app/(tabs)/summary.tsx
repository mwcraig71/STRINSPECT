import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useInspection } from "@/context/InspectionContext";
import colors from "@/constants/colors";

const CS_COLORS = {
  CS1: colors.light.cs1,
  CS2: colors.light.cs2,
  CS3: colors.light.cs3,
  CS4: colors.light.cs4,
};

export default function SummaryScreen() {
  const c = useColors();
  const { elementSummary, maintenanceSummary, criticalFindingsSummary } = useInspection();

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg }]}>
        <View style={styles.headerInner}>
          <Feather name="layers" size={20} color="#38bdf8" />
          <Text style={styles.headerTitle}>Structural Summary</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* ── Structural Analysis Matrix ── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Feather name="bar-chart-2" size={20} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Structural Analysis Matrix</Text>
            </View>
          </View>
          {/* Column headers */}
          <View style={[styles.tableHeader, { borderBottomColor: c.border, backgroundColor: c.background }]}>
            <Text style={[styles.colElement, styles.colHeader, { color: c.mutedForeground }]}>Element</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS1 }]}>CS1</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS2 }]}>CS2</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS3 }]}>CS3</Text>
            <Text style={[styles.colCS, styles.colHeader, { color: CS_COLORS.CS4 }]}>CS4</Text>
            <Text style={[styles.colTotal, styles.colHeader, { color: c.foreground }]}>Total</Text>
          </View>
          {elementSummary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No defects logged yet</Text>
            </View>
          ) : (
            elementSummary.map((row, idx) => (
              <View
                key={row.name}
                style={[
                  styles.tableRow,
                  { borderBottomColor: c.border },
                  idx % 2 === 1 && { backgroundColor: c.background },
                ]}
              >
                <View style={styles.colElement}>
                  <Text style={[styles.elementName, { color: c.foreground }]}>{row.name}</Text>
                  <Text style={[styles.elementUnit, { color: c.mutedForeground }]}>{row.unit}</Text>
                </View>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS1 > 0 ? CS_COLORS.CS1 : c.mutedForeground }]}>
                  {row.CS1 > 0 ? row.CS1 : "—"}
                </Text>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS2 > 0 ? CS_COLORS.CS2 : c.mutedForeground }]}>
                  {row.CS2 > 0 ? row.CS2 : "—"}
                </Text>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS3 > 0 ? CS_COLORS.CS3 : c.mutedForeground }]}>
                  {row.CS3 > 0 ? row.CS3 : "—"}
                </Text>
                <Text style={[styles.colCS, styles.cellValue, { color: row.CS4 > 0 ? CS_COLORS.CS4 : c.mutedForeground }]}>
                  {row.CS4 > 0 ? row.CS4 : "—"}
                </Text>
                <Text style={[styles.colTotal, styles.cellTotal, { color: c.foreground }]}>{row.total}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Maintenance Plan Summary ── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.primary, borderWidth: 2 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Feather name="tool" size={20} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.primary }]}>Maintenance Plan Summary</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.countBadgeText}>{maintenanceSummary.length} Items</Text>
            </View>
          </View>
          <View style={[styles.tableHeader, { borderBottomColor: "#bfdbfe", backgroundColor: "#eff6ff" }]}>
            <Text style={[styles.colLocation, styles.colHeader, { color: c.primary }]}>Location / Element</Text>
            <Text style={[styles.colDesc, styles.colHeader, { color: c.primary }]}>Defect Description</Text>
            <Text style={[styles.colQtyRight, styles.colHeader, { color: c.primary }]}>Qty</Text>
          </View>
          {maintenanceSummary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: c.mutedForeground, fontStyle: "italic" }]}>
                No Maintenance Tasks Cataloged
              </Text>
            </View>
          ) : (
            maintenanceSummary.map((d, idx) => (
              <View
                key={d.id}
                style={[
                  styles.tableRow,
                  { borderBottomColor: "#bfdbfe" },
                  idx % 2 === 1 && { backgroundColor: "#f0f9ff" },
                ]}
              >
                <View style={styles.colLocation}>
                  <Text style={[styles.locationText, { color: c.foreground }]}>{d.location}</Text>
                  <Text style={[styles.elementSmall, { color: c.primary }]}>{d.element}</Text>
                </View>
                <View style={styles.colDesc}>
                  <Text style={[styles.defectName, { color: c.foreground }]}>{d.defect}</Text>
                  {d.locationDesc ? (
                    <Text style={[styles.defectNote, { color: c.mutedForeground }]} numberOfLines={2}>
                      {d.locationDesc}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.colQtyRight, styles.qtyText, { color: c.primary }]}>
                  {d.maintenanceQuantityValue || d.quantityValue}
                  {"\n"}
                  <Text style={{ fontSize: 9 }}>{d.quantity.split(" ")[1]}</Text>
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Critical Finding Summary ── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: "#dc2626", borderWidth: 2 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Feather name="shield-alert" size={20} color="#dc2626" />
              <Text style={[styles.cardTitle, { color: "#dc2626" }]}>Critical Finding Summary</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: "#dc2626" }]}>
              <Text style={styles.countBadgeText}>{criticalFindingsSummary.length} Active</Text>
            </View>
          </View>
          <View style={[styles.tableHeader, { borderBottomColor: "#fecaca", backgroundColor: "#fef2f2" }]}>
            <Text style={[styles.colLocation, styles.colHeader, { color: "#dc2626" }]}>Location / Element</Text>
            <Text style={[styles.colDesc, styles.colHeader, { color: "#dc2626" }]}>Structural Write-up</Text>
            <Text style={[styles.colQtyRight, styles.colHeader, { color: "#dc2626" }]}>Qty</Text>
          </View>
          {criticalFindingsSummary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: c.mutedForeground, fontStyle: "italic" }]}>
                No Critical Deficiencies Reported
              </Text>
            </View>
          ) : (
            criticalFindingsSummary.map((d, idx) => (
              <View
                key={d.id}
                style={[
                  styles.tableRow,
                  { borderBottomColor: "#fecaca" },
                  idx % 2 === 1 && { backgroundColor: "#fff5f5" },
                ]}
              >
                <View style={styles.colLocation}>
                  <Text style={[styles.locationText, { color: c.foreground }]}>{d.location}</Text>
                  <Text style={[styles.elementSmall, { color: "#dc2626" }]}>{d.element}</Text>
                </View>
                <View style={styles.colDesc}>
                  <Text style={[styles.defectName, { color: c.foreground }]}>{d.defect}</Text>
                  {d.locationDesc ? (
                    <Text style={[styles.defectNote, { color: c.mutedForeground }]} numberOfLines={2}>
                      {d.locationDesc}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.colQtyRight, styles.qtyText, { color: "#dc2626" }]}>
                  {d.quantityValue}
                  {"\n"}
                  <Text style={{ fontSize: 9 }}>{d.quantity.split(" ")[1]}</Text>
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "web" ? 67 : 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#f8fafc", textTransform: "uppercase" },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5, flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff", textTransform: "uppercase" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  colHeader: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  colElement: { flex: 2.5, paddingRight: 8 },
  colCS: { flex: 1, textAlign: "center" },
  colTotal: { flex: 1, textAlign: "right" },
  colLocation: { flex: 1.5, paddingRight: 8 },
  colDesc: { flex: 2.5, paddingRight: 8 },
  colQtyRight: { width: 50, textAlign: "right" },
  elementName: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  elementUnit: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  cellValue: { fontWeight: "900", fontSize: 14 },
  cellTotal: { fontWeight: "900", fontSize: 14 },
  locationText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  elementSmall: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  defectName: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  defectNote: { fontSize: 10, fontStyle: "italic", marginTop: 2 },
  qtyText: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  emptyRow: { padding: 28, alignItems: "center" },
  emptyText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
});
