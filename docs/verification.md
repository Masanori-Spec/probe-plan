# Verification scope

## Executed locally

As of 2026-10-04:

- Node.js v24.19.0
- `npm run check`: passed
- 94 / 94 Node tests: passed, including 62 independently authored oracle/adversarial tests
- 813,296 ideal partition comparisons through seven pins
- 32-pin / 496-pair maximum boundary
- A 554,605-byte Unicode/escape-heavy session round-trip
- Duplicate/missing/unused pin accounting; strict JSON; unknown schema/fields; exact stale-binding rejection
- All four export validation boundaries, markup escaping, CSV formula protection, deterministic serialization, and wide ASCII / CJK SVG label fitting
- Syntax checks for source, scripts, and browser test code
- Source guard for application network calls
- Sparse-array rejection and SVG accessible-ID / wide-label regressions
- Seven DOM-stub event/state tests, including superseded imports across sample, record, reset and restore flows
- Static distribution build

## Authored, not yet executed

`tests/browser/browser-test.mjs` is authored for a sandbox-enabled Chromium environment. The development environment's local browser restrictions were respected; no browser bypass was attempted.

Its scenarios cover:

- Japanese and English desktop views; 768 / 390 / 320-pixel viewport screenshots and horizontal-overflow assertions
- Keyboard skip link, unique accessible IDs, result-filter focus movement, and modal Escape cancellation
- Scope gate; pass/fail/skipped entries and notes; status filters and empty search results
- Actual JSON/HTML/CSV/SVG downloads and session reimport
- HTML print-mode screenshot and generated PDF; explicit partial-screen print warning with scope retained; wide ASCII/CJK SVG bounds
- Changed-map locking and invalidation; unchanged recompilation
- Invalid JSON/table inputs and preservation of previous records
- Repeated add/remove, repeated import of the same filename, replacement/reset cancellation
- Explicit device save/reload/restore/delete and storage-error recovery
- Maximum 496-pair plan
- No external application requests or uncaught page errors

These are **planned assertions, not observed passes** until the workflow runs successfully for the exact published commit. Browser screenshots and print pagination still require review. The browser artifacts are intentionally not fabricated or included as pre-passed evidence.

## CI configuration

`.github/workflows/verify.yml` defines:

- Model jobs: Node 22 and 24, UTC and Asia/Tokyo
- Browser job: Ubuntu 22.04, Playwright 1.56.0, Chromium sandbox explicitly enabled
- Artifact upload: `tests/browser/artifacts/`, including `results.json`, screenshots, actual exports, and print PDF

No paid service, credentials, hardware, or external application data is required. CI uses read-only repository permission. No workflow is marked successful merely because it has been authored.
