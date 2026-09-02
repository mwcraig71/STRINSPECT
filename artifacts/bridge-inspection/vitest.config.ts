import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests cover the pure PDF parsers only (utils/**). React Native itself is
// stubbed so the parser modules can be imported in Node.
export default defineConfig({
  resolve: {
    alias: {
      "react-native": path.resolve(__dirname, "utils/__tests__/stubs/react-native.ts"),
      "@": __dirname,
    },
  },
  test: {
    include: ["utils/**/*.test.ts"],
    environment: "node",
  },
});
