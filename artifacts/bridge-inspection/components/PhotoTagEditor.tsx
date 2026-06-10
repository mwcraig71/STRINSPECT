import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const DIRECTIONS = ["N", "S", "E", "W"] as const;
const SUBJECTS = [
  "Roadway",
  "Abutment",
  "Bent",
  "Pile Cap",
  "Girder",
  "Superstructure",
  "Substructure",
  "Deck",
  "Barrier",
  "Rail",
  "Guard Rail",
  "Load Posting Sign",
  "Superstructure Underside",
  "Under View",
  "Upstream View",
  "Downstream View",
] as const;

interface Props {
  directionTags: string[];
  subjectTags: string[];
  onDirectionChange: (tags: string[]) => void;
  onSubjectChange: (tags: string[]) => void;
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

export function PhotoTagEditor({ directionTags, subjectTags, onDirectionChange, onSubjectChange }: Props) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.groupLabel, { color: c.mutedForeground }]}>Looking</Text>
      <View style={styles.chipRow}>
        {DIRECTIONS.map((d) => {
          const active = directionTags.includes(d);
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.chip,
                { borderColor: active ? "#38bdf8" : c.border, backgroundColor: active ? "#0f172a" : c.background },
              ]}
              onPress={() => onDirectionChange(toggle(directionTags, d))}
            >
              <Text style={[styles.chipText, { color: active ? "#38bdf8" : c.mutedForeground }]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.groupLabel, { color: c.mutedForeground, marginTop: 10 }]}>Component</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
        <View style={styles.chipRow}>
          {SUBJECTS.map((s) => {
            const active = subjectTags.includes(s);
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  { borderColor: active ? "#a78bfa" : c.border, backgroundColor: active ? "#1e1b4b" : c.background },
                ]}
                onPress={() => onSubjectChange(toggle(subjectTags, s))}
              >
                <Text style={[styles.chipText, { color: active ? "#a78bfa" : c.mutedForeground }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 2 },
  groupLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  subjectScroll: { marginHorizontal: -2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
});
