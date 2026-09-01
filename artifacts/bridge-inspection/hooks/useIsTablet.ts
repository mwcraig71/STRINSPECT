import { Dimensions, Platform, useWindowDimensions } from "react-native";

export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  // On web, screen dimensions describe the monitor rather than the app
  // viewport, so use the viewport-only test to preserve responsive browser UI.
  if (Platform.OS === "web") {
    return Math.min(width, height) >= 600;
  }

  const screen = Dimensions.get("screen");
  // Prefer the full screen dimensions as Android's window dimensions can be
  // shortened by status/navigation bars. This lets a 1920x1200 @ 320 dpi
  // tablet (960x600 dp) qualify while phones rotated to landscape do not.
  return Math.min(width, height) >= 600 || Math.min(screen.width, screen.height) >= 600;
}
