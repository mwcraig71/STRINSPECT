import { Feather } from "@expo/vector-icons";
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
  SteelPipePileData,
  SteelPipePileRow,
  createSteelPipePileRow,
  useInspection,
} from "@/context/InspectionContext";

const ACCENT = "#b45309"; // steel / rust amber

// Restrict free-text numeric entry to at most one decimal place.
function sanitizeNumeric(text: string): string {
  let cleaned = text.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  return decPart !== undefined ? `${intPart}.${decPart.slice(0, 1)}` : intPart;
}

type RowNumericField = Exclude<keyof SteelPipePileRow, "id" | "bent" | "pile" | "photo">;

const ROW_COLUMNS: { key: RowNumericField; label: string }[] = [
  { key: "lengthH", label: "H" },
  { key: "lengthY", label: "Y" },
  { key: "lengthX", label: "X" },
  { key: "outsideDiameter", label: "O.D." },
  { key: "pittingDepth", label: "Pitting" },
  { key: "wallSec1", label: "Wall 1" },
  { key: "wallSec2", label: "Wall 2" },
  { key: "wallSec3", label: "Wall 3" },
  { key: "wallSec4", label: "Wall 4" },
];

export function SteelPipePileModal() {
  const c = useColors();
  const {
    showSteelPipePileModal,
    setShowSteelPipePileModal,
    steelPipePileData,
    setSteelPipePileData,
  } = useInspection();
  const d = steelPipePileData;

  const setField = <K extends keyof SteelPipePileData>(field: K, value: SteelPipePileData[K]) => {
    setSteelPipePileData({ ...d, [field]: value });
  };

  const updateRow = (id: string, patch: Partial<SteelPipePileRow>) => {
    setSteelPipePileData({
      ...d,
      rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addRow = () => {
    setSteelPipePileData({ ...d, rows: [...d.rows, createSteelPipePileRow()] });
  };

  const removeRow = (id: string) => {
    const remaining = d.rows.filter((r) => r.id !== id);
    setSteelPipePileData({ ...d, rows: remaining.length ? remaining : [createSteelPipePileRow()] });
  };

  const headerField = (
    label: string,
    field: keyof SteelPipePileData,
    placeholder = ""
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
        value={d[field] as string}
        onChangeText={(t) => setField(field, t as SteelPipePileData[typeof field])}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
      />
    </View>
  );

  const refMeasure = (label: string, sub: string, field: keyof SteelPipePileData) => (
    <View style={styles.measureRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.measureLabel, { color: c.foreground }]}>{label}</Text>
        <Text style={[styles.measureSub, { color: c.mutedForeground }]}>{sub}</Text>
      </View>
      <View style={styles.measureInputWrap}>
        <TextInput
          style={[styles.measureInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.foreground }]}
          value={d[field] as string}
          onChangeText={(t) => setField(field, sanitizeNumeric(t) as SteelPipePileData[typeof field])}
          placeholder="0.0"
          placeholderTextColor={c.mutedForeground}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.measureUnit, { color: c.mutedForeground }]}>in</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={showSteelPipePileModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSteelPipePileModal(false)}
    >
      <View style={[styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: ACCENT }]}>
          <View style={styles.headerLeft}>
            <Feather name="git-commit" size={26} color="#fff" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Steel Pipe Pile</Text>
              <Text style={styles.headerSubtitle}>Remaining Section Measurements</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowSteelPipePileModal(false)} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Identification */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Identification</Text>
            {headerField("NBI Number", "nbiNumber")}
            {headerField("District and County", "districtCounty")}
            {headerField("Facility Carried", "facilityCarried")}
            {headerField("Feature Intersected", "featureIntersected")}
            {headerField("Measurement Taken By", "measurementTakenBy")}
            {headerField("Date", "date", "MM/DD/YYYY")}
          </View>

          {/* Reference field measurements */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              Field Measurements (inches)
            </Text>
            {refMeasure("A — Outside Diameter", "Outside diameter", "outsideDiameterRef")}
            {refMeasure("B — Inside Diameter", "Inside diameter", "insideDiameterRef")}
            {refMeasure("C — Wall Thickness", "Wall thickness", "wallThicknessRef")}
          </View>

          {/* Legend */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Length Definitions</Text>
            <Text style={[styles.legend, { color: c.mutedForeground }]}>
              <Text style={{ fontWeight: "900", color: c.foreground }}>H</Text> — Length of pile from ground to bottom of cap
            </Text>
            <Text style={[styles.legend, { color: c.mutedForeground }]}>
              <Text style={{ fontWeight: "900", color: c.foreground }}>Y</Text> — Length of pile from bottom of cap to location of section loss
            </Text>
            <Text style={[styles.legend, { color: c.mutedForeground }]}>
              <Text style={{ fontWeight: "900", color: c.foreground }}>X</Text> — Length of area of corrosion
            </Text>
            <Text style={[styles.note, { color: c.mutedForeground }]}>
              Measurement is at location of worst case section loss. Bent and pile number is per plans or inventory sketch.
            </Text>
          </View>

          {/* Pile rows */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Pile Measurements</Text>
            {d.rows.map((r, idx) => (
              <View
                key={r.id}
                style={[styles.pileBlock, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={styles.pileBlockHeader}>
                  <Text style={[styles.pileBlockTitle, { color: ACCENT }]}>Pile {idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => removeRow(r.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
                <View style={styles.row}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Bent (Plans/Sketch)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                      value={r.bent}
                      onChangeText={(t) => updateRow(r.id, { bent: t })}
                      placeholder="Bent"
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Pile (L to R)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                      value={r.pile}
                      onChangeText={(t) => updateRow(r.id, { pile: t })}
                      placeholder="#"
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>
                </View>
                <View style={styles.gridWrap}>
                  {ROW_COLUMNS.map((col) => (
                    <View key={col.key} style={styles.gridCell}>
                      <Text style={[styles.gridLabel, { color: c.mutedForeground }]}>{col.label}</Text>
                      <TextInput
                        style={[styles.gridInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                        value={r[col.key]}
                        onChangeText={(t) => updateRow(r.id, { [col.key]: sanitizeNumeric(t) })}
                        placeholder="—"
                        placeholderTextColor={c.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Photo Reference</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                    value={r.photo}
                    onChangeText={(t) => updateRow(r.id, { photo: t })}
                    placeholder="Photo number / note..."
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={addRow}>
              <Feather name="plus" size={16} color={ACCENT} />
              <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Pile</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: ACCENT }]}
            onPress={() => setShowSteelPipePileModal(false)}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Save & Close</Text>
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
  headerSubtitle: { fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  closeBtn: { padding: 8, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.2)" },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
  row: { flexDirection: "row", gap: 10 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  measureLabel: { fontSize: 12, fontWeight: "800" },
  measureSub: { fontSize: 9, fontWeight: "600", marginTop: 1 },
  measureInputWrap: { flexDirection: "row", alignItems: "center", gap: 6, width: 110 },
  measureInput: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12, fontWeight: "700", textAlign: "right" },
  measureUnit: { width: 16, fontSize: 11, fontWeight: "800" },
  legend: { fontSize: 11, fontWeight: "600", lineHeight: 16, marginTop: -4 },
  note: { fontSize: 10, fontWeight: "600", fontStyle: "italic", lineHeight: 15, marginTop: 2 },
  pileBlock: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  pileBlockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pileBlockTitle: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridCell: { width: "30%", gap: 4 },
  gridLabel: { fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  gridInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 7, fontSize: 12, fontWeight: "700", textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", marginTop: 4 },
  addBtnText: { fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { padding: 16, borderTopWidth: 1 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  doneBtnText: { fontSize: 14, fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
});
