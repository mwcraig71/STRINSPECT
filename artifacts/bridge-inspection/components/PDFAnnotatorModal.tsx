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
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPdfAnnotatorHtml } from "./pdfAnnotatorHtml";
import { SC_FAVORITES_KEY, CUSTOM_SHORTCUTS_KEY, SC_OVERRIDES_KEY, SC_HIDDEN_KEY, mergeShortcuts } from "@/data/textShortcuts";

const HTML = getPdfAnnotatorHtml();

interface Props {
  visible: boolean;
  pdfPath: string | null;
  annotations: unknown[] | null;
  onSave: (annotations: unknown[]) => void;
  onClose: () => void;
}

export default function PDFAnnotatorModal({ visible, pdfPath, annotations, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const injectedRef = useRef(false);
  const [scFavorites, setScFavorites] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SC_FAVORITES_KEY).then((raw) => {
      if (raw) {
        try { setScFavorites(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    if (visible) {
      setSessionKey((k) => k + 1);
    } else {
      setReady(false);
      setLoadError(null);
      injectedRef.current = false;
    }
  }, [visible]);

  // `pdfSource` is either a data: URI (web) or a local file:// URI (native). The
  // WebView fetches the file itself, so a 200 MB report is never copied
  // through React Native memory as base64.
  const buildInitMsg = useCallback(async (pdfSource: string): Promise<string> => {
    const existingAnnotations = (annotations ?? []).filter(
      (a) => (a as { type?: string } | null)?.type !== "_meta",
    );
    const savedFavs = await AsyncStorage.getItem(SC_FAVORITES_KEY).catch(() => null);
    const favIds: string[] = savedFavs ? JSON.parse(savedFavs) : scFavorites;
    const customRaw = await AsyncStorage.getItem(CUSTOM_SHORTCUTS_KEY).catch(() => null);
    const overridesRaw = await AsyncStorage.getItem(SC_OVERRIDES_KEY).catch(() => null);
    const hiddenRaw = await AsyncStorage.getItem(SC_HIDDEN_KEY).catch(() => null);
    return JSON.stringify({
      type: "init",
      pdfUri: pdfSource,
      annotations: existingAnnotations,
      shortcuts: mergeShortcuts(customRaw, overridesRaw, hiddenRaw),
      scFavorites: favIds,
    });
  }, [annotations, scFavorites]);

  const injectPdf = useCallback(async () => {
    if (injectedRef.current || !pdfPath) return;
    injectedRef.current = true;

    try {
      if (Platform.OS === "web") {
        let dataUrl: string;
        if (pdfPath.startsWith("data:")) {
          dataUrl = pdfPath;
        } else {
          const resp = await fetch(pdfPath);
          const blob = await resp.blob();
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Read failed"));
            reader.readAsDataURL(blob);
          });
        }
        const msg = await buildInitMsg(dataUrl);
        iframeRef.current?.contentWindow?.postMessage(msg, "*");
        return;
      }

      const FileSystem = await import("expo-file-system/legacy");
      const info = await FileSystem.getInfoAsync(pdfPath);
      if (!info.exists) {
        setLoadError("PDF file not found on device. Please re-import the PDF.");
        return;
      }

      const source = /^file:/i.test(pdfPath)
        ? pdfPath
        : "data:application/pdf;base64," + (await FileSystem.readAsStringAsync(pdfPath, { encoding: FileSystem.EncodingType.Base64 }));
      const msg = await buildInitMsg(source);
      const msgJson = JSON.stringify(msg);
      const js = "(function(){var e=new MessageEvent('message',{data:" + msgJson + "});window.dispatchEvent(e);document.dispatchEvent(e);})();true;";
      webViewRef.current?.injectJavaScript(js);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load PDF";
      setLoadError(msg);
    }
  }, [pdfPath, buildInitMsg]);

  const pickWebFile = useCallback(() => {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      injectedRef.current = false;
      setLoadError(null);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const msg = await buildInitMsg(dataUrl);
          iframeRef.current?.contentWindow?.postMessage(msg, "*");
        } catch {}
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [buildInitMsg]);

  const onIframeLoad = useCallback(() => {
    setReady(true);
    injectPdf();
  }, [injectPdf]);

  const onWebViewLoad = useCallback(() => {
    setReady(true);
    injectPdf();
  }, [injectPdf]);

  const exportText = useCallback(async (text: string) => {
    if (Platform.OS === "web") {
      if (typeof document !== "undefined") {
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "annotations.txt";
        a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }
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

  const handleMsgData = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw) as {
        type: string;
        annotations?: unknown[];
        pageDimensions?: Record<string, { w: number; h: number }>;
        text?: string;
        ids?: string[];
      };
      if (data.type === "sc-favorites") {
        const ids = Array.isArray(data.ids) ? data.ids : [];
        setScFavorites(ids);
        AsyncStorage.setItem(SC_FAVORITES_KEY, JSON.stringify(ids)).catch(() => {});
        return;
      }
      if (data.type === "save") {
        const saved = Array.isArray(data.annotations) ? data.annotations : [];
        const meta = { type: "_meta", pageDimensions: data.pageDimensions ?? {} };
        onSave([meta, ...saved]);
        Alert.alert("Saved", "Annotations saved.");
      } else if (data.type === "close") {
        onClose();
      } else if (data.type === "confirm-close") {
        if (Platform.OS === "web") {
          if (typeof window !== "undefined" && window.confirm("Discard unsaved annotations and close?")) {
            onClose();
          }
        } else {
          Alert.alert(
            "Unsaved Annotations",
            "You have unsaved changes. Discard them and close?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Discard", style: "destructive", onPress: onClose },
            ],
          );
        }
      } else if (data.type === "export-text") {
        exportText(data.text ?? "");
      } else if (data.type === "export-empty") {
        Alert.alert("Nothing to Export", "There is no typed text to export yet.");
      }
    } catch {}
  }, [onSave, onClose, exportText]);

  const onMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    handleMsgData(e.nativeEvent.data);
  }, [handleMsgData]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const handler = (e: MessageEvent) => {
      if (typeof e.data === "string") handleMsgData(e.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [visible, handleMsgData]);

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View
          style={[
            styles.root,
            Platform.OS !== "web" && {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {React.createElement("iframe", {
            key: sessionKey,
            ref: iframeRef,
            srcDoc: HTML,
            style: { width: "100%", height: "100%", border: "none" },
            onLoad: onIframeLoad,
          })}
          {!ready && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loadingText}>Opening annotator…</Text>
            </View>
          )}
          {ready && !pdfPath && !loadError && (
            <View style={styles.webPickOverlay}>
              <Feather name="file-text" size={40} color="#38bdf8" />
              <Text style={styles.webPickTitle}>No PDF imported</Text>
              <Text style={styles.webPickSub}>
                Pick a PDF from your computer to annotate it, or import one via the Bridges tab first.
              </Text>
              <TouchableOpacity style={styles.webPickBtn} onPress={pickWebFile}>
                <Feather name="upload" size={16} color="#fff" />
                <Text style={styles.closeBtnText}>Choose PDF File</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.webPickBtn, { backgroundColor: "#334155", marginTop: 4 }]} onPress={onClose}>
                <Text style={styles.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          {loadError && (
            <View style={styles.webPickOverlay}>
              <Feather name="alert-circle" size={36} color="#f87171" />
              <Text style={styles.errorTitle}>{loadError}</Text>
              <TouchableOpacity style={styles.webPickBtn} onPress={pickWebFile}>
                <Feather name="upload" size={16} color="#fff" />
                <Text style={styles.closeBtnText}>Choose PDF File</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.webPickBtn, { backgroundColor: "#334155", marginTop: 4 }]} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      navigationBarTranslucent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
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
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
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
    textAlign: "center",
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
  webPickOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    backgroundColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  } as never,
  webPickTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
  },
  webPickSub: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 360,
  },
  webPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
    marginTop: 8,
  },
});
