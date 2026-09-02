# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Bridge Inspection (mobile app)
- **Path**: `artifacts/bridge-inspection/`
- **Kind**: Expo (React Native) mobile app
- **Preview Path**: `/` (via REPLIT_EXPO_DEV_DOMAIN)
- **Description**: Field-ready bridge structural inspection tool, offline-first with AsyncStorage persistence
- **Key Features**:
  - SNBI defect logging with photos (expo-image-picker)
  - SNBI element catalog: 12, 38, 107, 108, 109, 113, 205, 215, 225, 226, 228, 234, 310, 311, 313, 321, 330, 331, 300, 304, 515
  - NBI ratings for items 58/59/60/61/65/36/71/72 (full TxDOT NBI sub-component set)
  - CIF (Critical Inspection Finding / Form 2598) modal with phone + AssetWise verification
  - FUA (Follow-Up Action) modal with priority levels (Level 1-4)
  - Critical/maintenance flags with automatic CIF/FUA workflow triggers
  - Texas (TxDOT) / North Carolina (NCDOT) nomenclature toggle
  - Topside / Underside inspection mode toggle
  - Location filters by station type and numeric range
  - Legacy defect verification workflow
  - Structural summary tables (element matrix, maintenance plan, critical findings)
  - CS color coding (CS1=green, CS2=blue, CS3=amber, CS4=red)
  - **PDF import**: Real client-side PDF parsing via pdfjs-dist. TxDOT: ELEMENTS table (element+defect rows → DefectRecord), NBI ratings (BRIDGE INSPECTION RECORD sections), structure number. SCDOT (BrM "Bridge Inspection Report"): `utils/scdotParser.ts` reads the header (Asset ID, structure number, team, date, weather), ~200 `(NNN)` inventory/condition fields, ELEMENT NOTES rows plus `[elem, CSn, Qn]`-tagged defect sentences (→ one DefectRecord each with location/size/description, remainder record for untagged quantity), Section 4 notes (→ SNBI sub-component comments), photo captions, streambed cross sections (→ ChannelData), procedures, equipment and sign-off. Parser notes (roll-up mismatches etc.) land in `ImportSummary.warnings`.
  - **Parser tests**: `pnpm --filter @workspace/bridge-inspection test` (vitest). Fixtures in `utils/__fixtures__` are generated with `scripts/extract-pages.mjs` using the app's exact text reconstruction; TxDOT output is pinned to `*.expected.json`.
  - Structure number: persisted field shown in Inspection tab header (tappable to edit); auto-fills CIF form
- **Persistence**: All data via @react-native-async-storage/async-storage (crash-safe, offline-first)
- **State**: React Context (InspectionContext) — single provider in (tabs)/_layout.tsx
- **Navigation**: expo-router tabs (NativeTabs with liquid glass on iOS 26+, classic Tabs fallback)
- **Theme**: Dark navy header (#0f172a) + cyan primary (#0284c7)
