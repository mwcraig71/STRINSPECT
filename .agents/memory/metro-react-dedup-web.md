---
name: Metro react dedup for Expo web
description: Why react/react-dom must be aliased in metro.config.js for the Expo apps in this pnpm monorepo
---

# Expo web "Invalid hook call" → dedupe React in metro.config.js

Adding a library that ships its own web implementation (e.g. `react-native-svg`) and uses
React hooks can throw "Invalid hook call ... more than one copy of React" **only on the web
bundle** in this pnpm monorepo — even though `pnpm` keeps a single physical `react`.

**Why:** pnpm's symlinked layout lets a dependency resolve its *own* `react` symlink, which
Metro's web bundler treats as a distinct module instance. Two React instances → hooks break.
Native is unaffected (no react-dom; native renderer).

**How to apply:** in the artifact's `metro.config.js`, set
`config.resolver.extraNodeModules.react` / `react-dom` to a single resolved path via
`path.dirname(require.resolve("react/package.json"))`. Restart the Expo workflow (Metro must
re-read its config). Apply the same fix to any other Expo artifact that hits this on web.

Note: on `react-native-web`, `<Modal>` children mount even when `visible={false}`, so a faulty
child component crashes on page load before any interaction — don't assume the modal must be
opened to reproduce.

Troubleshooting heuristic: if an Expo component throws "Invalid hook call" on web *after* the
metro alias is already in place, try switching namespace hook calls (`React.useState(...)`) to
named imports (`import { useState } from "react"`). This resolved it at least once here; prefer
named hook imports in this repo's Expo components as a precaution.
