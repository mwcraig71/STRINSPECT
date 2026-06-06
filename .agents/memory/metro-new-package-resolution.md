---
name: Metro pnpm symlink resolution for new Expo packages
description: When a new package is installed via pnpm in the bridge-inspection artifact, Metro may fail to resolve it despite a valid node_modules symlink.
---

## The rule
Any new Expo/RN package added with `pnpm add` in `artifacts/bridge-inspection` must be explicitly aliased in `metro.config.js` under `config.resolver.extraNodeModules` pointing to its resolved physical path.

## Why
pnpm uses a virtual store (`node_modules/.pnpm/...`) and creates symlinks in the local `node_modules`. Metro bundler does not reliably follow these symlinks when resolving modules, producing "Unable to resolve module" errors even though the symlink exists.

## How to apply
After installing `some-new-package`, add to `metro.config.js`:
```js
const newPkgPath = path.dirname(require.resolve("some-new-package/package.json"));
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "some-new-package": newPkgPath,
};
```
This applies to `expo-image-manipulator` (confirmed failing without this fix) and should be assumed for any future package installs.
