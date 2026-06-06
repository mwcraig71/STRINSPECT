import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

import { useInspection } from "@/context/InspectionContext";
import { loadQueue, processQueueEntry, removeFromQueue } from "@/lib/offlineQueue";

function getApiConfig(): { apiUrl: string; apiKey: string | undefined } {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}:8080`
      : "");
  const apiKey = process.env.EXPO_PUBLIC_API_KEY;
  return { apiUrl, apiKey };
}

export function useAutoSync() {
  const { syncSession, hasUnsyncedChanges, pendingSyncCount } = useInspection();

  const [toastVisible, setToastVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isSyncingRef = useRef(false);
  const hasUnsyncedRef = useRef(hasUnsyncedChanges);
  const pendingRef = useRef(pendingSyncCount);
  const syncRef = useRef(syncSession);

  useEffect(() => { hasUnsyncedRef.current = hasUnsyncedChanges; }, [hasUnsyncedChanges]);
  useEffect(() => { pendingRef.current = pendingSyncCount; }, [pendingSyncCount]);
  useEffect(() => { syncRef.current = syncSession; }, [syncSession]);

  const showToast = useCallback(() => {
    setToastKey((k) => k + 1);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3200);
  }, []);

  const tryAutoSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    try {
      const state = await Network.getNetworkStateAsync();
      if (!state.isConnected) return;

      isSyncingRef.current = true;

      // 1. Process offline queue (bridges queued while offline)
      const { apiUrl, apiKey } = getApiConfig();
      const queue = await loadQueue();
      let queueSynced = false;
      for (const entry of queue) {
        try {
          await processQueueEntry(entry, apiUrl, apiKey);
          await removeFromQueue(entry.structureNumber);
          queueSynced = true;
        } catch {
          // Keep in queue — will retry next cycle
        }
      }

      // 2. Sync the active session if it has changes
      if (hasUnsyncedRef.current) {
        const result = await syncRef.current();
        if (result === "synced") queueSynced = true;
      }

      if (queueSynced) showToast();
    } catch {
      // Silent — user can manually sync via Settings
    } finally {
      isSyncingRef.current = false;
    }
  }, [showToast]);

  // Trigger on app returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const wasBackground = appStateRef.current.match(/inactive|background/);
        if (wasBackground && nextState === "active") {
          tryAutoSync();
        }
        appStateRef.current = nextState;
      }
    );
    return () => subscription.remove();
  }, [tryAutoSync]);

  // Poll every 15 s when there is anything pending
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingRef.current > 0 || hasUnsyncedRef.current) {
        tryAutoSync();
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [tryAutoSync]);

  // Attempt once on mount
  useEffect(() => {
    tryAutoSync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { toastVisible, toastKey, pendingCount: pendingSyncCount };
}
