import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import { getPdfExtractorHtml } from "./pdfExtractorHtml";
import { registerPdfExtractor, type PdfExtractorSource } from "./pdfExtractorBridge";

const HTML = getPdfExtractorHtml();
const EXTRACT_TIMEOUT_MS = 180_000;

interface Job {
  id: number;
  source: PdfExtractorSource;
}

interface Pending {
  resolve: (pages: string[][]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// Always-mounted, invisible host that owns a single headless WebView used to run
// pdf.js text extraction on native (Android/iOS). It exposes its extraction
// implementation through pdfExtractorBridge so the parser can await results.
// The WebView is mounted only while a job is active and torn down afterwards.
export default function PdfTextExtractorHost() {
  const webViewRef = useRef<WebView>(null);
  const pendingRef = useRef<Pending | null>(null);
  const jobRef = useRef<Job | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const finish = useCallback(() => {
    pendingRef.current = null;
    jobRef.current = null;
    setJob(null);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    registerPdfExtractor(
      (source: PdfExtractorSource) =>
        new Promise<string[][]>((resolve, reject) => {
          if (pendingRef.current) {
            reject(new Error("Another PDF is already being read. Please wait."));
            return;
          }
          const timer = setTimeout(() => {
            finish();
            reject(new Error("Reading the PDF timed out. Please try again."));
          }, EXTRACT_TIMEOUT_MS);
          pendingRef.current = { resolve, reject, timer };
          const next: Job = { id: Date.now(), source };
          jobRef.current = next;
          setJob(next);
        }),
    );

    return () => {
      registerPdfExtractor(null);
      const p = pendingRef.current;
      if (p) {
        clearTimeout(p.timer);
        p.reject(new Error("PDF reader was torn down."));
      }
      pendingRef.current = null;
    };
  }, [finish]);

  const onLoad = useCallback(() => {
    const current = jobRef.current;
    if (!current) return;
    // Deliver the PDF over the WebView's data channel rather than eval'ing a
    // multi-MB JS string. The job id correlates the response so a late result
    // from a torn-down job can never resolve a newer one.
    const msg = JSON.stringify({
      type: "extract",
      id: current.id,
      pdfUri:
        "uri" in current.source
          ? current.source.uri
          : "data:application/pdf;base64," + current.source.base64,
    });
    webViewRef.current?.postMessage(msg);
  }, []);

  const onMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      let data: { type: string; id?: number; pages?: string[][]; message?: string };
      try {
        data = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      // Ignore anything that isn't a response for the job currently in flight
      // (stale/late results from a previous, torn-down job).
      const current = jobRef.current;
      if (
        (data.type === "extract-result" || data.type === "extract-error") &&
        (!current || data.id !== current.id)
      ) {
        return;
      }
      const p = pendingRef.current;
      if (data.type === "extract-result") {
        if (p) {
          clearTimeout(p.timer);
          p.resolve(Array.isArray(data.pages) ? data.pages : []);
        }
        finish();
      } else if (data.type === "extract-error") {
        if (p) {
          clearTimeout(p.timer);
          p.reject(new Error(data.message || "Could not read the PDF."));
        }
        finish();
      }
    },
    [finish],
  );

  const onError = useCallback(
    (e: { nativeEvent: { description?: string } }) => {
      const p = pendingRef.current;
      if (p) {
        clearTimeout(p.timer);
        p.reject(new Error(e.nativeEvent.description || "PDF reader failed to load."));
      }
      finish();
    },
    [finish],
  );

  if (Platform.OS === "web" || !job) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        key={job.id}
        ref={webViewRef}
        source={{ html: HTML }}
        javaScriptEnabled
        originWhitelist={["*"]}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onLoad={onLoad}
        onMessage={onMessage}
        onError={onError}
      />
    </View>
  );
}

const styles = {
  hidden: {
    position: "absolute" as const,
    width: 1,
    height: 1,
    left: -1000,
    top: -1000,
    opacity: 0,
  },
};
