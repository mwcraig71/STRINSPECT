import * as ImageManipulator from "expo-image-manipulator";

export const IMAGE_SIZE_OPTIONS = [
  { key: "original", label: "Original" },
  { key: "4x6", label: '4"×6"' },
  { key: "5x7", label: '5"×7"' },
  { key: "8x10", label: '8"×10"' },
] as const;

const IMAGE_SIZE_PX: Record<string, number | null> = {
  original: null,
  "4x6": 1800,
  "5x7": 2100,
  "8x10": 3000,
};

export async function resizePhoto(
  uri: string,
  size: string,
  origWidth = 0,
  origHeight = 0
): Promise<string> {
  const maxPx = IMAGE_SIZE_PX[size];
  if (!maxPx) return uri;

  const longer = Math.max(origWidth, origHeight);
  if (longer > 0 && longer <= maxPx) return uri;

  const isLandscape = origWidth === 0 || origWidth >= origHeight;
  const resizeOp = isLandscape
    ? { resize: { width: maxPx } }
    : { resize: { height: maxPx } };

  try {
    const result = await ImageManipulator.manipulateAsync(uri, [resizeOp], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch {
    return uri;
  }
}
