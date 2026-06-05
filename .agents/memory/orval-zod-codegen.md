---
name: Orval zod codegen barrel conflict
description: How to configure orval's zod client output so it doesn't auto-generate/overwrite the workspace-root index.ts barrel.
---

## The problem
When orval's `zod` output is configured with `workspace: "<srcDir>"` and `mode: "split"`, orval generates and overwrites `<srcDir>/index.ts` as a barrel on every codegen run. Any manual edits to that file are lost. Using `clean: false` does not prevent it — orval appends rather than skips.

The generated barrel includes references to `./generated/api.schemas` (TypeScript interface types) which conflict with the Zod schema constants of the same name exported from `./generated/api.ts`. This causes `TS2308` duplicate-export errors on typecheck.

**Why:** Orval's split mode creates a workspace-root barrel as part of its output contract whenever `workspace` is set. The `schemas: { path: ... }` config adds a second types folder with identically-named exports.

## The fix
Use `mode: "single"` with an **absolute** `target` path pointing directly at the generated file. Remove `workspace` and `schemas` from the zod output config entirely.

```ts
// lib/api-spec/orval.config.ts
zod: {
  output: {
    target: path.resolve(apiZodSrc, "generated", "api.ts"),  // absolute path
    client: "zod",
    mode: "single",   // no barrel generated
    clean: false,     // only touches the single target file
    prettier: true,
    override: { ... },
  },
},
```

Then maintain `lib/api-zod/src/index.ts` manually with just:
```ts
export * from "./generated/api";
```

This file will NOT be touched by orval under this config.

**How to apply:** Any time you update the OpenAPI spec and need to regenerate the zod validators, ensure the orval config uses this pattern. If you see a barrel `index.ts` being regenerated, check whether `workspace` crept back into the zod output config.
