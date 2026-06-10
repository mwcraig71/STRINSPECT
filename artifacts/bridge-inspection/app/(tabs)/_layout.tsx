import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { InspectionProvider, useInspection } from "@/context/InspectionContext";
import { SyncToast } from "@/components/SyncToast";
import { useAutoSync } from "@/hooks/useAutoSync";
import { TabletSplitLayout } from "@/components/TabletSplitLayout";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="bridges">
        <Icon sf={{ default: "square.stack", selected: "square.stack.fill" }} />
        <Label>Bridges</Label>
      </NativeTabs.Trigger>
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
      <NativeTabs.Trigger name="photos">
        <Icon sf={{ default: "camera", selected: "camera.fill" }} />
        <Label>Photos</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}


function ClassicTabLayoutWithSync({ pendingCount, missingPhotoCount }: { pendingCount: number; missingPhotoCount: number }) {
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
        name="bridges"
        options={{
          title: "Bridges",
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#f59e0b", fontSize: 10 },
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.stack" tintColor={color} size={22} />
            ) : (
              <Feather name="layers" size={21} color={color} />
            ),
        }}
      />
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
              <Feather name="list" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: "Photos",
          tabBarBadge: missingPhotoCount > 0 ? missingPhotoCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#f59e0b", fontSize: 10 },
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="camera" tintColor={color} size={22} />
            ) : (
              <Feather name="camera" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

function TabContent() {
  const { toastVisible, toastKey, pendingCount } = useAutoSync();
  const { standardPhotos } = useInspection();
  const missingPhotoCount = standardPhotos.filter((s) => !s.photoUri).length;
  const tabNav = isLiquidGlassAvailable()
    ? <NativeTabLayout />
    : <ClassicTabLayoutWithSync pendingCount={pendingCount} missingPhotoCount={missingPhotoCount} />;
  return (
    <TabletSplitLayout>
      <View style={{ flex: 1 }}>
        {tabNav}
        <SyncToast key={toastKey} visible={toastVisible} message="Auto-synced to cloud" />
      </View>
    </TabletSplitLayout>
  );
}

export default function TabLayout() {
  return (
    <InspectionProvider>
      <TabContent />
    </InspectionProvider>
  );
}
