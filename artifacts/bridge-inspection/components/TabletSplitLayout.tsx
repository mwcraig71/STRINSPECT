import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PanResponder,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { useIsTablet } from "@/hooks/useIsTablet";
import { useInspection } from "@/context/InspectionContext";
import { PdfReadOnlyPanel } from "./PdfReadOnlyPanel";

interface Props {
  children: React.ReactNode;
}

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.82;
const DEFAULT_RATIO = 0.45;

export function TabletSplitLayout({ children }: Props) {
  const isTablet = useIsTablet();
  const { importedPdfPath, importFromPdf, pdfAnnotations, setPdfAnnotations } = useInspection();
  const [pdfExpanded, setPdfExpanded] = useState(false);
  const [splitRatio, setSplitRatioState] = useState(DEFAULT_RATIO);
  const splitRatioRef = useRef(DEFAULT_RATIO);
  const totalWidthRef = useRef(0);
  const dragStartRatioRef = useRef(DEFAULT_RATIO);

  const setSplitRatio = (v: number) => {
    splitRatioRef.current = v;
    setSplitRatioState(v);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRatioRef.current = splitRatioRef.current;
      },
      onPanResponderMove: (_, gs) => {
        if (totalWidthRef.current === 0) return;
        const next = Math.max(MIN_RATIO, Math.min(MAX_RATIO,
          dragStartRatioRef.current + gs.dx / totalWidthRef.current,
        ));
        splitRatioRef.current = next;
        setSplitRatioState(next);
      },
      onPanResponderRelease: (_, gs) => {
        if (totalWidthRef.current === 0) return;
        const next = Math.max(MIN_RATIO, Math.min(MAX_RATIO,
          dragStartRatioRef.current + gs.dx / totalWidthRef.current,
        ));
        splitRatioRef.current = next;
        setSplitRatioState(next);
      },
    }),
  ).current;

  const handleImportPress = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await importFromPdf({ uri: asset.uri, name: asset.name ?? "report.pdf" });
      }
    } catch (_) {}
  }, [importFromPdf]);

  if (!isTablet) {
    return <>{children}</>;
  }

  const pdfFlex = pdfExpanded ? 1 : splitRatio;
  const inspFlex = pdfExpanded ? 0 : 1 - splitRatio;

  return (
    <View
      style={styles.root}
      onLayout={(e) => { totalWidthRef.current = e.nativeEvent.layout.width; }}
    >
      {/* ── PDF panel ── */}
      <View style={[styles.pdfPanel, { flex: pdfFlex }]}>
        {/* Panel header */}
        <View style={styles.panelHeader}>
          <Feather name="file-text" size={13} color="#94a3b8" />
          <Text style={styles.panelTitle} numberOfLines={1}>
            Previous Report
          </Text>
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => setPdfExpanded((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={pdfExpanded ? "minimize-2" : "maximize-2"}
              size={14}
              color="#94a3b8"
            />
          </TouchableOpacity>
        </View>
        {/* PDF viewer */}
        <PdfReadOnlyPanel
          pdfPath={importedPdfPath}
          style={styles.pdfViewer}
          onImportPress={handleImportPress}
          annotations={pdfAnnotations}
          onAnnotationsSave={setPdfAnnotations}
        />
      </View>

      {/* ── Draggable divider ── */}
      {!pdfExpanded && (
        <View
          style={[
            styles.dividerContainer,
            Platform.OS === "web" && ({ cursor: "col-resize" } as never),
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.dividerTrack} />
          <View style={styles.dividerGrip}>
            <View style={styles.gripDot} />
            <View style={styles.gripDot} />
            <View style={styles.gripDot} />
            <View style={styles.gripDot} />
            <View style={styles.gripDot} />
          </View>
          <View style={styles.dividerTrack} />
        </View>
      )}

      {/* ── Inspection panel ── */}
      <View
        style={[
          styles.inspectionPanel,
          { flex: inspFlex },
          pdfExpanded && styles.inspectionPanelHidden,
        ]}
        pointerEvents={pdfExpanded ? "none" : "auto"}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0f172a",
  },
  pdfPanel: {
    minWidth: 0,
    backgroundColor: "#0f172a",
  },
  panelHeader: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 7,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  panelTitle: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expandBtn: {
    padding: 4,
  },
  pdfViewer: {
    flex: 1,
  },
  dividerContainer: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    zIndex: 10,
  },
  dividerTrack: {
    flex: 1,
    width: 2,
    backgroundColor: "#1e293b",
    borderRadius: 1,
  },
  dividerGrip: {
    paddingVertical: 10,
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    paddingHorizontal: 5,
    marginVertical: 2,
  },
  gripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#475569",
  },
  inspectionPanel: {
    minWidth: 0,
  },
  inspectionPanelHidden: {
    flex: 0,
  },
});
