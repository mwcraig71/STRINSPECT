import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { InspectionProvider } from "@/context/InspectionContext";
import { SyncToast } from "@/components/SyncToast";
import { useAutoSync } from "@/hooks/useAutoSync";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Inspection</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nbi">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>NBI</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="summary">
        <Icon sf={{ default: "list.bullet.clipboard", selected: "list.bullet.clipboard.fill" }} />
        <Label>Summary</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inspection",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="doc.text" tintColor={color} size={22} />
            ) : (
              <Feather name="file-text" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="nbi"
        options={{
          title: "NBI",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: "Summary",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet.clipboard" tintColor={color} size={22} />
            ) : (
              <Feather name="layers" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

function TabContent() {
  const { toastVisible, toastKey } = useAutoSync();
  return (
    <View style={{ flex: 1 }}>
      {isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
      <SyncToast key={toastKey} visible={toastVisible} message="Auto-synced to cloud" />
    </View>
  );
}

export default function TabLayout() {
  return (
    <InspectionProvider>
      <TabContent />
    </InspectionProvider>
  );
}
