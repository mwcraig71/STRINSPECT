import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { SketchStroke } from "@/context/InspectionContext";

const PEN_COLORS = ["#0f172a", "#dc2626", "#2563eb", "#16a34a"];
const PEN_WIDTHS = [2, 4, 6];

type Point = { x: number; y: number };

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    // dot
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

const MIN_POINT_DISTANCE = 2; // px; skip points closer than this to decimate

export function SketchPad({
  strokes,
  onChange,
  onDrawStateChange,
  height = 280,
}: {
  strokes: SketchStroke[];
  onChange: (strokes: SketchStroke[]) => void;
  onDrawStateChange?: (drawing: boolean) => void;
  height?: number;
}) {
  const c = useColors();
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [width, setWidth] = useState(PEN_WIDTHS[1]);
  const [current, setCurrent] = useState<Point[]>([]);

  // Refs so the PanResponder closure always sees the latest values.
  const currentRef = useRef<Point[]>([]);
  const strokesRef = useRef<SketchStroke[]>(strokes);
  strokesRef.current = strokes;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(width);
  widthRef.current = width;

  const commitStroke = useCallback(() => {
    const pts = currentRef.current;
    if (pts.length > 0) {
      const stroke: SketchStroke = {
        d: pointsToPath(pts),
        color: colorRef.current,
        width: widthRef.current,
      };
      onChange([...strokesRef.current, stroke]);
    }
    currentRef.current = [];
    setCurrent([]);
    onDrawStateChange?.(false);
  }, [onChange, onDrawStateChange]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          onDrawStateChange?.(true);
          const { locationX, locationY } = e.nativeEvent;
          const pts = [{ x: locationX, y: locationY }];
          currentRef.current = pts;
          setCurrent(pts);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          const last = currentRef.current[currentRef.current.length - 1];
          // Decimate: ignore points too close to the previous one.
          if (last) {
            const dx = locationX - last.x;
            const dy = locationY - last.y;
            if (dx * dx + dy * dy < MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) return;
          }
          const pts = [...currentRef.current, { x: locationX, y: locationY }];
          currentRef.current = pts;
          setCurrent(pts);
        },
        onPanResponderRelease: commitStroke,
        onPanResponderTerminate: commitStroke,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, onDrawStateChange]
  );

  const undo = () => {
    if (strokes.length === 0) return;
    onChange(strokes.slice(0, -1));
  };

  const clear = () => {
    if (strokes.length === 0) return;
    onChange([]);
  };

  return (
    <View style={styles.wrap}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolGroup}>
          {PEN_COLORS.map((col) => (
            <TouchableOpacity
              key={col}
              onPress={() => setColor(col)}
              style={[
                styles.swatch,
                { backgroundColor: col },
                color === col && styles.swatchActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.toolGroup}>
          {PEN_WIDTHS.map((w) => (
            <TouchableOpacity
              key={w}
              onPress={() => setWidth(w)}
              style={[
                styles.widthBtn,
                { borderColor: c.border },
                width === w && { borderColor: c.foreground, backgroundColor: c.secondary },
              ]}
            >
              <View style={{ width: w * 2, height: w, borderRadius: w, backgroundColor: c.foreground }} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.toolGroup}>
          <TouchableOpacity onPress={undo} style={[styles.actionBtn, { borderColor: c.border }]}>
            <Feather name="corner-up-left" size={16} color={c.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={clear} style={[styles.actionBtn, { borderColor: c.border }]}>
            <Feather name="trash-2" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <View
        style={[styles.canvas, { height, borderColor: c.border, backgroundColor: "#ffffff" }]}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {strokes.map((s, i) => (
            <Path
              key={i}
              d={s.d}
              stroke={s.color}
              strokeWidth={s.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {current.length > 0 && (
            <Path
              d={pointsToPath(current)}
              stroke={color}
              strokeWidth={width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
        {strokes.length === 0 && current.length === 0 && (
          <View pointerEvents="none" style={styles.placeholder}>
            <Feather name="edit-3" size={22} color="#cbd5e1" />
            <Text style={styles.placeholderText}>Draw the vertical clearance sketch</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  toolGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: "#94a3b8" },
  widthBtn: { width: 30, height: 28, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionBtn: { width: 30, height: 28, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  canvas: { borderWidth: 1, borderRadius: 10, overflow: "hidden", position: "relative" },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 6 },
  placeholderText: { fontSize: 11, color: "#cbd5e1", fontWeight: "700" },
});
