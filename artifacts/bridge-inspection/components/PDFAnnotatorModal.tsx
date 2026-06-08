import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { getPdfAnnotatorHtml } from "./pdfAnnotatorHtml";

const HTML = getPdfAnnotatorHtml();

interface Props {
  visible: boolean;
  pdfPath: string | null;
  annotations: unknown[] | null;
  onSave: (annotations: unknown[]) => void;
  onClose: () => void;
}

export default function PDFAnnotatorModal({ visible, pdfPath, annotations, onSave, onClose }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      // Force a fresh WebView document on every open so the annotator's
      // one-shot init guard starts clean (otherwise reopening with a
      // different PDF would be ignored).
      setSessionKey((k) => k + 1);
    } else {
      setReady(false);
      setLoadError(null);
      injectedRef.current = false;
    }
  }, [visible]);

  const injectPdf = useCallback(async () => {
    if (injectedRef.current || !pdfPath) return;
    injectedRef.current = true;

    try {
      let base64Uri: string;
      if (Platform.OS === "web") {
        setLoadError("PDF annotation is not available in the web browser.");
        return;
      }

      const FileSystem = await import("expo-file-system/legacy");
      const info = await FileSystem.getInfoAsync(pdfPath);
      if (!info.exists) {
        setLoadError("PDF file not found on device. Please re-import the PDF.");
        return;
      }

      const b64 = await FileSystem.readAsStringAsync(pdfPath, { encoding: FileSystem.EncodingType.Base64 });
      base64Uri = "data:application/pdf;base64," + b64;

      // Filter out _meta entries (pageDimensions bookkeeping) before sending to annotator
      const existingAnnotations = (annotations ?? []).filter(
        (a) => (a as { type?: string } | null)?.type !== "_meta",
      );
      const msg = JSON.stringify({ type: "init", pdfBase64: base64Uri, annotations: existingAnnotations });
      const js = `
        (function() {
          var e = new MessageEvent('message', { data: ${JSON.stringify(msg)} });
          window.dispatchEvent(e);
          document.dispatchEvent(e);
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load PDF";
      setLoadError(msg);
    }
  }, [pdfPath, annotations]);

  const onWebViewLoad = useCallback(() => {
    setReady(true);
    injectPdf();
  }, [injectPdf]);

  const exportText = useCallback(async (text: string) => {
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const Sharing = await import("expo-sharing");
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) {
        Alert.alert("Export Failed", "No writable storage location is available.");
        return;
      }
      const fileUri = `${dir}annotations-${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          UTI: "public.plain-text",
          dialogTitle: "Export Annotation Text",
        });
      } else {
        Alert.alert("Exported", `Text saved to:\n${fileUri}`);
      }
    } catch (err) {
      Alert.alert(
        "Export Failed",
        err instanceof Error ? err.message : "Could not export text.",
      );
    }
  }, []);

  const onMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as {
        type: string;
        annotations?: unknown[];
        pageDimensions?: Record<string, { w: number; h: number }>;
        text?: string;
      };
      if (data.type === "save") {
        const saved = Array.isArray(data.annotations) ? data.annotations : [];
        // Prepend _meta entry so web viewer can look up per-page canvas dimensions
        const meta = { type: "_meta", pageDimensions: data.pageDimensions ?? {} };
        onSave([meta, ...saved]);
        Alert.alert("Saved", "Annotations saved.");
      } else if (data.type === "close") {
        onClose();
      } else if (data.type === "confirm-close") {
        Alert.alert(
          "Unsaved Annotations",
          "You have unsaved changes. Discard them and close?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: onClose },
          ],
        );
      } else if (data.type === "export-text") {
        exportText(data.text ?? "");
      } else if (data.type === "export-empty") {
        Alert.alert("Nothing to Export", "There is no typed text to export yet.");
      }
    } catch {}
  }, [onSave, onClose, exportText]);

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {loadError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Cannot Open PDF</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {!ready && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>Opening annotator…</Text>
              </View>
            )}
            <WebView
              key={sessionKey}
              ref={webViewRef}
              style={styles.webview}
              source={{ html: HTML }}
              javaScriptEnabled
              originWhitelist={["*"]}
              allowFileAccess
              onLoad={onWebViewLoad}
              onMessage={onMessage}
              onError={(e) => setLoadError(e.nativeEvent.description || "WebView error")}
              scrollEnabled={false}
              keyboardDisplayRequiresUserAction={false}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 10,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  } as never,
  loadingText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    color: "#f87171",
    fontSize: 17,
    fontWeight: "800",
  },
  errorText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  closeBtn: {
    marginTop: 8,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  closeBtnText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
});
