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
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Elements</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nbi">
        <Icon sf={{ default: "star", selected: "star.fill" }} />
        <Label>Ratings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="photos">
        <Icon sf={{ default: "camera", selected: "camera.fill" }} />
        <Label>Photos</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="summary">
        <Icon sf={{ default: "clipboard", selected: "clipboard.fill" }} />
        <Label>Summary</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout({ missingPhotoCount }: { missingPhotoCount: number }) {
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
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Elements",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.grid.2x2" tintColor={color} size={22} />
            ) : (
              <Feather name="layers" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="nbi"
        options={{
          title: "Ratings",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="star" tintColor={color} size={22} />
            ) : (
              <Feather name="star" size={21} color={color} />
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
      <Tabs.Screen
        name="summary"
        options={{
          title: "Summary",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clipboard" tintColor={color} size={22} />
            ) : (
              <Feather name="clipboard" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

function TabContent() {
  const { toastVisible, toastKey } = useAutoSync();
  const { standardPhotos } = useInspection();
  const missingPhotoCount = standardPhotos.filter((s) => !s.photoUri).length;

  const tabNav = Platform.OS === "ios" && isLiquidGlassAvailable()
    ? <NativeTabLayout />
    : <ClassicTabLayout missingPhotoCount={missingPhotoCount} />;
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
