---
name: SCDOT PDF import
description: How SCDOT (AASHTOWare BrM) inspection reports are parsed, the "[elem, CSn, Qn]" note convention, and how to regenerate parser fixtures.
---

SCDOT reports are parsed by `utils/scdotParser.ts` (pure, fixture-tested) and adapted onto
`ParsedReport` in `utils/pdfParser.ts` (`parsePages` dispatches on `isScdotReport`). TxDOT keeps
its original parsers untouched; `utils/__tests__/pdfParser.test.ts` pins their output to
`__fixtures__/txdot-*.expected.json`.

**Format facts that drive the parser**
- Element rows: `241/3  Re Conc Culvert  96  ft  1  92  3  0` (id/env, unit column, CS1–4). Units
  `ft`, `ft²`, `each`; quantities may carry commas; name or unit can be bucketed onto a
  neighbouring line.
- Every defect sentence on the ELEMENT NOTES page ends in a tag: `[1190, CS2, Q88]`. Variants seen:
  `[3220, CS2, Q2415 and 3220, CS3, Q2415]`, `[1080, CS2, Q200 & CS3, Q40]` (wrapped across two
  lines), `[2320, CS2, Q10; CS3 Q5]`, `[CS4, Q3]` (no code — describes the parent element). Tag
  sums per (defect, CS) should equal the defect row; mismatches are surfaced as `warnings`, never
  auto-corrected (they are usually real inspector inconsistencies).
- Photo captions reuse the defect sentence verbatim → exact-match linking is possible.
- ~200 inventory fields use `(NNN) Label [B.X.NN]: value`, two columns per line. Values render
  0.3–1.3 pt off the label baseline so the 2 pt row bucketing sometimes splits them onto the line
  above or below; `parseFields` re-attaches those by type (date/number/code) and column history.
  Do NOT change the shared row bucketing to fix this — it perturbs TxDOT output (verified).
- Duplicate item numbers exist in the template ((631) twice) → second one is keyed
  `631_nav_channel_min_horiz_clearance`; `(SBI)` fields are keyed `SBI_<slug>`.
- Section 4 has 13 fixed headings; Streambed cross sections come as Inlet/Outlet blocks.

**Why:** the TxDOT regexes never fired on SCDOT text (0 elements, ~76 junk SNBI entries) and the
per-note tag is the only source of per-defect quantity + location + size.

**How to apply:** add a new SCDOT sample by dropping the PDF in `attached_assets/` and running
`pnpm --filter @workspace/bridge-inspection run fixtures:extract <pdf> utils/__fixtures__/scdot-<id>-<type>-<date>.pages.json`,
then extend the corpus test. Run `pnpm --filter @workspace/bridge-inspection test`.
Follow-up not done here: keep positional pdf.js items instead of flattened lines (would remove
the stray-value heuristics entirely), and derive SCDOT standard photo slots from the report's
own photo set.
