import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { useIsTablet } from "@/hooks/useIsTablet";
import { useInspection } from "@/context/InspectionContext";
import { PdfReadOnlyPanel } from "./PdfReadOnlyPanel";

interface Props {
  children: React.ReactNode;
}

export function TabletSplitLayout({ children }: Props) {
  const isTablet = useIsTablet();
  const { importedPdfPath, importFromPdf, pdfAnnotations, setPdfAnnotations } = useInspection();
  const [pdfExpanded, setPdfExpanded] = useState(false);

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

  return (
    <View style={styles.root}>
      {/* ── PDF panel ── */}
      <View style={[styles.pdfPanel, pdfExpanded && styles.pdfPanelExpanded]}>
        {/* Panel header */}
        <View style={styles.panelHeader}>
          <Feather name="file-text" size={13} color="#94a3b8" />
          <Text style={styles.panelTitle} numberOfLines={1}>
            {importedPdfPath ? "Previous Report" : "Previous Report"}
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

      {/* ── Divider ── */}
      {!pdfExpanded && <View style={styles.divider} />}

      {/* ── Inspection panel ── */}
      <View
        style={[
          styles.inspectionPanel,
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
    flex: 0.5,
    minWidth: 0,
    backgroundColor: "#0f172a",
  },
  pdfPanelExpanded: {
    flex: 1,
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
  divider: {
    width: 1,
    backgroundColor: "#1e293b",
  },
  inspectionPanel: {
    flex: 0.5,
    minWidth: 0,
    overflow: "hidden",
  },
  inspectionPanelHidden: {
    flex: 0,
  },
});
