import { AppIcon as Feather } from "@/components/AppIcon";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface SyncToastProps {
  visible: boolean;
  message?: string;
}

export function SyncToast({ visible, message = "Synced to cloud" }: SyncToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 380, useNativeDriver: true }),
      ]).start();
    }, 2600);
    return () => clearTimeout(timer);
  }, [visible, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.pill}>
        <Feather name="cloud" size={13} color="#34d399" style={styles.icon} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f2a1e",
    borderColor: "#064e3b",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  icon: {
    marginRight: 2,
  },
  text: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
