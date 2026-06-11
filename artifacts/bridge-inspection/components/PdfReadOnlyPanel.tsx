import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { getPdfReadOnlyHtml } from "./pdfReadOnlyHtml";
import { TEXT_SHORTCUTS } from "@/data/textShortcuts";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SC_FAVORITES_KEY = "@bridge_sc_favorites";

const HTML = getPdfReadOnlyHtml();

interface Props {
  pdfPath: string | null;
  style?: object;
  onImportPress?: () => void;
  annotations?: unknown[] | null;
  onAnnotationsSave?: (anns: unknown[]) => void;
}

export function PdfReadOnlyPanel({ pdfPath, style, onImportPress, annotations, onAnnotationsSave }: Props) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [scFavorites, setScFavorites] = useState<string[]>([]);
  const injectedRef = useRef(false);
  const webViewRef = useRef<import("react-native-webview").WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onAnnotationsSaveRef = useRef(onAnnotationsSave);
  onAnnotationsSaveRef.current = onAnnotationsSave;

  useEffect(() => {
    AsyncStorage.getItem(SC_FAVORITES_KEY).then((raw) => {
      if (raw) { try { setScFavorites(JSON.parse(raw)); } catch {} }
    });
  }, []);

  useEffect(() => {
    setSessionKey((k) => k + 1);
    setReady(false);
    setLoadError(null);
    injectedRef.current = false;
  }, [pdfPath]);

  // ── Web: listen for save messages posted back from the srcdoc iframe ──
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: MessageEvent) => {
      if (e.source !== (iframeRef.current as HTMLIFrameElement | null)?.contentWindow) return;
      let data: { type?: string; annotations?: unknown[] } | null = null;
      try { data = JSON.parse(e.data as string); } catch { return; }
      if (data?.type === "save" && onAnnotationsSaveRef.current) {
        onAnnotationsSaveRef.current(data.annotations ?? []);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Native: read file via expo-file-system and inject as base64 ──
  const injectPdf = useCallback(async () => {
    if (injectedRef.current || !pdfPath) return;
    injectedRef.current = true;
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const info = await FileSystem.getInfoAsync(pdfPath);
      if (!info.exists) {
        setLoadError("PDF file not found. Please re-import the report.");
        return;
      }
      const b64 = await FileSystem.readAsStringAsync(pdfPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const base64Uri = "data:application/pdf;base64," + b64;
      const existingAnns = (annotations ?? []).filter(
        (a) => (a as { type?: string } | null)?.type !== "_meta",
      );
      const savedFavs = await AsyncStorage.getItem(SC_FAVORITES_KEY).catch(() => null);
      const favIds: string[] = savedFavs ? JSON.parse(savedFavs) : scFavorites;
      const msg = JSON.stringify({ type: "init", pdfBase64: base64Uri, annotations: existingAnns, shortcuts: TEXT_SHORTCUTS, scFavorites: favIds });
      const js = `(function(){var e=new MessageEvent('message',{data:${JSON.stringify(msg)}});window.dispatchEvent(e);document.dispatchEvent(e);})();true;`;
      webViewRef.current?.injectJavaScript(js);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  }, [pdfPath, annotations, scFavorites]);

  const onWebViewLoad = useCallback(() => {
    setReady(true);
    injectPdf();
  }, [injectPdf]);

  // ── Web: fetch the blob/data URL and postMessage base64 into the srcdoc iframe ──
  const injectPdfWeb = useCallback(async () => {
    if (injectedRef.current || !pdfPath) return;
    injectedRef.current = true;
    try {
      const resp = await fetch(pdfPath);
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      const existingAnns = (annotations ?? []).filter(
        (a) => (a as { type?: string } | null)?.type !== "_meta",
      );
      const savedFavs = await AsyncStorage.getItem(SC_FAVORITES_KEY).catch(() => null);
      const favIds: string[] = savedFavs ? JSON.parse(savedFavs) : scFavorites;
      const msg = JSON.stringify({ type: "init", pdfBase64: dataUrl, annotations: existingAnns, shortcuts: TEXT_SHORTCUTS, scFavorites: favIds });
      (iframeRef.current as HTMLIFrameElement | null)?.contentWindow?.postMessage(msg, "*");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  }, [pdfPath, annotations, scFavorites]);

  const onWebIframeLoad = useCallback(() => {
    setReady(true);
    injectPdfWeb();
  }, [injectPdfWeb]);

  // ── Web branch ──
  if (Platform.OS === "web") {
    if (!pdfPath) {
      return (
        <View style={[styles.emptyPanel, style]}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Feather name="file-text" size={40} color="#38bdf8" />
            </View>
            <Text style={styles.emptyTitle}>Previous Report</Text>
            <Text style={styles.emptyBody}>
              Import a prior inspection PDF to compare it side-by-side with the
              current inspection.
            </Text>
            {onImportPress && (
              <TouchableOpacity style={styles.importBtnLarge} onPress={onImportPress}>
                <Feather name="upload-cloud" size={18} color="#fff" />
                <Text style={styles.importBtnLargeText}>Import Previous Report</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }
    // Use srcdoc + postMessage so pdf.js renders the PDF — avoids Chrome's
    // blob-URL-in-nested-iframe block that fires when the canvas preview
    // embeds the Expo web app in its own iframe.
    return (
      <View style={[styles.root, style, { position: "relative" } as never]}>
        {!ready && !loadError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>Loading report...</Text>
          </View>
        )}
        {loadError ? (
          <View style={styles.placeholder}>
            <Feather name="alert-triangle" size={28} color="#f87171" />
            <Text style={[styles.placeholderTitle, { color: "#f87171" }]}>
              Cannot Open PDF
            </Text>
            <Text style={styles.placeholderBody}>{loadError}</Text>
          </View>
        ) : (
          React.createElement("iframe", {
            key: sessionKey,
            ref: iframeRef,
            srcdoc: HTML,
            onLoad: onWebIframeLoad,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
              background: "#0f172a",
            },
          } as React.HTMLAttributes<HTMLIFrameElement> & { srcdoc: string; ref: React.Ref<HTMLIFrameElement> })
        )}
      </View>
    );
  }

  // ── Native branch ──
  if (!pdfPath) {
    return (
      <View style={[styles.placeholder, style]}>
        <Feather name="file-text" size={32} color="#475569" />
        <Text style={styles.placeholderTitle}>No Report Imported</Text>
        <Text style={styles.placeholderBody}>
          Import a previous inspection report to compare it side-by-side with
          the current inspection.
        </Text>
        {onImportPress && (
          <TouchableOpacity style={styles.importBtn} onPress={onImportPress}>
            <Feather name="upload" size={14} color="#0f172a" />
            <Text style={styles.importBtnText}>Import Previous Report</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;

  return (
    <View style={[styles.root, style]}>
      {loadError ? (
        <View style={styles.placeholder}>
          <Feather name="alert-triangle" size={28} color="#f87171" />
          <Text style={[styles.placeholderTitle, { color: "#f87171" }]}>
            Cannot Open PDF
          </Text>
          <Text style={styles.placeholderBody}>{loadError}</Text>
        </View>
      ) : (
        <>
          {!ready && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loadingText}>Loading report...</Text>
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
            scrollEnabled={false}
            onLoad={onWebViewLoad}
            onMessage={(event: { nativeEvent: { data: string } }) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data?.type === "save" && onAnnotationsSaveRef.current) {
                  onAnnotationsSaveRef.current(data.annotations ?? []);
                }
              } catch {}
            }}
            onError={(e: { nativeEvent: { description: string } }) =>
              setLoadError(e.nativeEvent.description || "WebView error")
            }
          />
        </>
      )}
    </View>
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
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    backgroundColor: "#0f172a",
  },
  placeholderTitle: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  placeholderBody: {
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  } as never,
  loadingText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#38bdf8",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  importBtnText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    padding: 24,
  },
  emptyCard: {
    alignItems: "center",
    gap: 16,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 36,
    maxWidth: 340,
    width: "100%" as never,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#334155",
    marginBottom: 4,
  },
  emptyTitle: {
    color: "#f1f5f9",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  emptyBody: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  importBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  importBtnLargeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
