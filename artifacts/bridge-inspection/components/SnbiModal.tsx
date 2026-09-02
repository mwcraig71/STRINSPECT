import { AppIcon as Feather } from "@/components/AppIcon";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  SnbiData,
  SnbiEquipment,
  SnbiRoadway,
  createSnbiRoadway,
  useInspection,
} from "@/context/InspectionContext";

const ACCENT = "#6d28d9";
const EQUIPMENT_OPTIONS: Exclude<SnbiEquipment, "">[] = [
  "Waders",
  "Boat",
  "Ladder",
  "D-Meter",
  "Other",
];

// Restrict free-text numeric entry to a fixed number of decimal places.
// decimals = 0 => integers only; decimals = N => at most N digits after the dot.
function sanitizeNumeric(text: string, decimals: number): string {
  let cleaned = text.replace(/[^0-9.]/g, "");
  // Collapse to a single decimal point (keep the first).
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  if (decimals === 0) {
    return cleaned.replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  return decPart !== undefined ? `${intPart}.${decPart.slice(0, decimals)}` : intPart;
}

export function SnbiModal({ inline = false }: { inline?: boolean }) {
  const c = useColors();
  const { showSnbiModal, setShowSnbiModal, snbiData, setSnbiData } = useInspection();
  const d = snbiData;

  const setField = <K extends keyof SnbiData>(field: K, value: SnbiData[K]) => {
    setSnbiData({ ...d, [field]: value });
  };

  const updateRoadway = (id: string, patch: Partial<SnbiRoadway>) => {
    setSnbiData({
      ...d,
      roadways: d.roadways.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addRoadway = () => {
    setSnbiData({ ...d, roadways: [...d.roadways, createSnbiRoadway()] });
  };

  const removeRoadway = (id: string) => {
    const remaining = d.roadways.filter((r) => r.id !== id);
    setSnbiData({ ...d, roadways: remaining.length ? remaining : [createSnbiRoadway()] });
  };

  const measure = (
    label: string,
    field: keyof SnbiData,
    unit: string,
    decimals: number = 1
  ) => (
    <View style={styles.measureRow}>
      <Text style={[styles.measureLabel, { color: c.foreground }]}>{label}</Text>
      <View style={styles.measureInputWrap}>
        <TextInput
          style={[styles.measureInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
          value={d[field] as string}
          onChangeText={(t) =>
            setField(field, sanitizeNumeric(t, decimals) as SnbiData[typeof field])
          }
          placeholder={decimals === 0 ? "0" : "0.0"}
          placeholderTextColor={c.mutedForeground}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.measureUnit, { color: c.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );

  const yesNo = (
    field: keyof SnbiData,
    value: string,
    options: readonly string[] = ["Yes", "No"]
  ) => (
    <View style={styles.toggleRow}>
      {options.map((opt) => {
        const sel = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.toggleBtn,
              sel
                ? { backgroundColor: ACCENT, borderColor: ACCENT }
                : { backgroundColor: c.secondary, borderColor: c.border },
            ]}
            onPress={() => setField(field, (sel ? "" : opt) as SnbiData[typeof field])}
          >
            <Text style={{ color: sel ? "#fff" : c.mutedForeground, fontWeight: "800", fontSize: 13 }}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (inline && !showSnbiModal) return null;
  const sheet = (
    <View style={inline ? [StyleSheet.absoluteFill, styles.container, { backgroundColor: c.background, zIndex: 999 }] : [styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: ACCENT }]}>
          <View style={styles.headerLeft}>
            <Feather name="clipboard" size={26} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>SNBI</Text>
              <Text style={styles.headerSubtitle}>Field Collection</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowSnbiModal(false)} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Sidewalk widths */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              Sidewalk Widths (one decimal place)
            </Text>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Left (ft.)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={d.sidewalkLeft}
                  onChangeText={(t) => setField("sidewalkLeft", sanitizeNumeric(t, 1))}
                  placeholder="0.0"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Right (ft.)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={d.sidewalkRight}
                  onChangeText={(t) => setField("sidewalkRight", sanitizeNumeric(t, 1))}
                  placeholder="0.0"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Lengths */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Lengths</Text>
            {measure("NBIS Bridge Length (nearest tenth)", "nbisBridgeLength", "ft")}
            {measure("Total Bridge Length (nearest tenth)", "totalBridgeLength", "ft")}
            {measure("Max Span Length (nearest tenth)", "maxSpanLength", "ft")}
            {measure("Min Span Length (nearest tenth)", "minSpanLength", "ft")}
          </View>

          {/* Measurement aids */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Measurement Components</Text>
            {measure("Abut. Brg. CL to Backwall Face (for Max/Min Span Length)", "abutBrgToBackwall", "in")}
            {measure("Backwall Face to Abut. Cap Face (for NBIS Bridge Length)", "backwallToCapFace", "in")}
            {measure("Backwall Thickness (for Total Bridge Length)", "backwallThickness", "in")}
          </View>

          {/* Culvert */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Culvert</Text>
            {measure("Bridge Height — Top of Headwall to Water/Bottom Slab (no decimal)", "culvertBridgeHeight", "ft", 0)}
            {measure("Interior Wall Thickness (for NBIS Bridge Length)", "culvertWallThickness", "in")}
          </View>

          {/* Steel superstructure fatigue */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              Steel Superstructure Fatigue Details
            </Text>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
              Are E/E' details present?
            </Text>
            {yesNo("fatigueDetailsPresent", d.fatigueDetailsPresent)}
          </View>

          {/* Condition ratings */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Condition Ratings</Text>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Scour</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={d.scourRating}
                  onChangeText={(t) => setField("scourRating", t)}
                  placeholder="—"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Railing Transitions</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={d.railingTransitionsRating}
                  onChangeText={(t) => setField("railingTransitionsRating", t)}
                  placeholder="—"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
            </View>
          </View>

          {/* Equipment required */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Equipment Required</Text>
            <Text style={[styles.cardHint, { color: c.mutedForeground }]}>Select all that apply</Text>
            <View style={styles.equipWrap}>
              {EQUIPMENT_OPTIONS.map((opt) => {
                const sel = d.equipmentRequired.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.equipBtn,
                      sel
                        ? { backgroundColor: ACCENT, borderColor: ACCENT }
                        : { backgroundColor: c.secondary, borderColor: c.border },
                    ]}
                    onPress={() => {
                      const next = sel
                        ? d.equipmentRequired.filter((e) => e !== opt)
                        : [...d.equipmentRequired, opt];
                      setSnbiData({
                        ...d,
                        equipmentRequired: next,
                        equipmentOtherText: next.includes("Other") ? d.equipmentOtherText : "",
                      });
                    }}
                  >
                    <Text style={{ color: sel ? "#fff" : c.foreground, fontWeight: "800", fontSize: 12 }}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {d.equipmentRequired.includes("Other") && (
              <TextInput
                style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                value={d.equipmentOtherText}
                onChangeText={(t) => setField("equipmentOtherText", t)}
                placeholder="Specify other equipment..."
                placeholderTextColor={c.mutedForeground}
              />
            )}
          </View>

          {/* Roadways table */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              Clear & Approach Roadway Widths / Lane Count
            </Text>
            <View style={styles.roadHeader}>
              <Text style={[styles.roadHeadName, { color: c.mutedForeground }]}>Roadway Name</Text>
              <Text style={[styles.roadHeadWidth, { color: c.mutedForeground }]}>Width</Text>
              <Text style={[styles.roadHeadLanes, { color: c.mutedForeground }]}>Lanes</Text>
              <View style={styles.roadHeadSpacer} />
            </View>
            {d.roadways.map((r) => (
              <View key={r.id} style={styles.roadRow}>
                <TextInput
                  style={[styles.roadName, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={r.name}
                  onChangeText={(t) => updateRoadway(r.id, { name: t })}
                  placeholder="Roadway..."
                  placeholderTextColor={c.mutedForeground}
                />
                <TextInput
                  style={[styles.roadWidth, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={r.width}
                  onChangeText={(t) => updateRoadway(r.id, { width: sanitizeNumeric(t, 1) })}
                  placeholder="ft"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.roadLanes, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
                  value={r.lanes}
                  onChangeText={(t) => updateRoadway(r.id, { lanes: sanitizeNumeric(t, 0) })}
                  placeholder="#"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  onPress={() => removeRoadway(r.id)}
                  style={styles.roadRemove}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={15} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={addRoadway}>
              <Feather name="plus" size={16} color={ACCENT} />
              <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Roadway</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: ACCENT }]}
            onPress={() => setShowSnbiModal(false)}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Save & Close</Text>
          </TouchableOpacity>
        </View>
    </View>
  );
  if (inline) return sheet;
  return (
    <Modal
      visible={showSnbiModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSnbiModal(false)}
    >
      {sheet}
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
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
  cardHint: { fontSize: 10, fontWeight: "700", marginTop: -6 },
  row: { flexDirection: "row", gap: 10 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  measureLabel: { flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  measureInputWrap: { flexDirection: "row", alignItems: "center", gap: 6, width: 120 },
  measureInput: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12, fontWeight: "700", textAlign: "right" },
  measureUnit: { width: 18, fontSize: 11, fontWeight: "800" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  equipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  equipBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center" },
  roadHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  roadHeadName: { flex: 1, fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  roadHeadWidth: { width: 56, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  roadHeadLanes: { width: 44, fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  roadHeadSpacer: { width: 24 },
  roadRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  roadName: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  roadWidth: { width: 56, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 7, fontSize: 11, fontWeight: "600", textAlign: "center" },
  roadLanes: { width: 44, borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 7, fontSize: 11, fontWeight: "600", textAlign: "center" },
  roadRemove: { width: 24, alignItems: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", marginTop: 4 },
  addBtnText: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 16, borderTopWidth: 1 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  doneBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
});
