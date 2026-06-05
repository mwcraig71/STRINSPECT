import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

import { useInspection } from "@/context/InspectionContext";

export function useAutoSync() {
  const { syncSession, hasUnsyncedChanges } = useInspection();

  const [toastVisible, setToastVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isSyncingRef = useRef(false);
  const hasUnsyncedRef = useRef(hasUnsyncedChanges);
  const syncRef = useRef(syncSession);

  useEffect(() => { hasUnsyncedRef.current = hasUnsyncedChanges; }, [hasUnsyncedChanges]);
  useEffect(() => { syncRef.current = syncSession; }, [syncSession]);

  const showToast = useCallback(() => {
    setToastKey((k) => k + 1);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3200);
  }, []);

  const tryAutoSync = useCallback(async () => {
    if (isSyncingRef.current || !hasUnsyncedRef.current) return;
    try {
      const state = await Network.getNetworkStateAsync();
      if (!state.isConnected) return;
      isSyncingRef.current = true;
      await syncRef.current();
      showToast();
    } catch {
      // Silent — user can still sync manually via Settings
    } finally {
      isSyncingRef.current = false;
    }
  }, [showToast]);

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

  return { toastVisible, toastKey };
}
