import React from "react";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";

type FeatherProps = React.ComponentProps<typeof Feather>;

const SVG_ACTION_ICONS = new Set([
  "save",
  "trash",
  "trash-2",
  "edit",
  "edit-2",
  "edit-3",
  "maximize",
  "maximize-2",
  "minimize",
  "minimize-2",
  "x",
  "x-circle",
]);

export function AppIcon({
  name,
  size = 24,
  color = "#000",
  style,
  ...rest
}: FeatherProps) {
  if (typeof name === "string" && SVG_ACTION_ICONS.has(name)) {
    const iconSize = typeof size === "number" ? size : 24;
    const strokeWidth = Math.max(1.7, iconSize / 11);

    return (
      <Svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style as never}
        accessibilityRole={rest.accessibilityLabel ? "image" : undefined}
        accessibilityLabel={rest.accessibilityLabel}
      >
        {name === "save" && (
          <>
            <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <Path d="M17 21v-8H7v8M7 3v5h8" />
          </>
        )}
        {(name === "trash" || name === "trash-2") && (
          <>
            <Path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" />
            <Path d="M10 11v6M14 11v6" />
          </>
        )}
        {(name === "edit" || name === "edit-2" || name === "edit-3") && (
          <>
            <Path d="M12 20h9" />
            <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </>
        )}
        {(name === "maximize" || name === "maximize-2") && (
          <Path d="M8 3H3v5M3 3l7 7M16 3h5v5m0-5-7 7M8 21H3v-5m0 5 7-7M16 21h5v-5m0 5-7-7" />
        )}
        {(name === "minimize" || name === "minimize-2") && (
          <Path d="M4 14h6v6M10 14l-7 7M20 10h-6V4m0 6 7-7M4 10h6V4m0 6L3 3M20 14h-6v6m0-6 7 7" />
        )}
        {name === "x" && <Path d="M18 6 6 18M6 6l12 12" />}
        {name === "x-circle" && (
          <>
            <Circle cx="12" cy="12" r="10" />
            <Path d="m15 9-6 6M9 9l6 6" />
          </>
        )}
      </Svg>
    );
  }

  return <Feather name={name} size={size} color={color} style={style} {...rest} />;
}