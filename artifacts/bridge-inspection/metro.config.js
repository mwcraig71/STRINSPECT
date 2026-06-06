const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force a single physical copy of React / React DOM across the bundle.
// In a pnpm monorepo, packages like react-native-svg can resolve their own
// symlinked copy of React on web, producing two React instances and an
// "Invalid hook call" error. Aliasing to one resolved path prevents this.
const reactPath = path.dirname(require.resolve("react/package.json"));
const reactDomPath = path.dirname(require.resolve("react-dom/package.json"));
const imageManipulatorPath = path.dirname(require.resolve("expo-image-manipulator/package.json"));

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: reactPath,
  "react-dom": reactDomPath,
  "expo-image-manipulator": imageManipulatorPath,
};

// Allow bundling PDF documents (e.g. the safety plan) as static assets.
config.resolver.assetExts = [...config.resolver.assetExts, "pdf"];

module.exports = config;
