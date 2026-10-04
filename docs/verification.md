# Verification scope

## Executed locally

As of 2026-10-04:

- Node.js v24.19.0
- `npm run check`: passed
- 95 / 95 Node tests: passed, including 62 independently authored oracle/adversarial tests
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

## Passed in hosted Chromium

[Hosted run 37170948046](https://github.com/Masanori-Spec/probe-plan/actions/runs/37170948046) passed all five jobs for source commit `5bb9c7e60bab2f0a8ace294054cc10d07d440446` on 2026-10-04. Four model jobs ran all 95 tests across Node 22/24 and UTC/Asia/Tokyo. The browser job passed all 16 scenarios with Chromium sandboxing enabled. The development environment's local browser restrictions were respected; no browser bypass was attempted.

The initial hosted attempt exposed an asynchronous test assertion race. Retrying state assertions and explicit dialog-closure checks fixed the harness without weakening expected states. A later run exposed long-label SVG width handling; long labels now retain all text using reduced font size plus explicit SVG textLength containment. The unchanged browser width limits pass, and measured font/bounds data is retained. Ordinary labels keep their original typography.

The executed scenarios cover:

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

All listed scenarios passed. Desktop Japanese/English and 320/390/768-pixel responsive screenshots were visually inspected with no overlapping controls or viewport overflow. The complete exported report renders on two A4 pages; the partial-screen print renders on one A4 page with its filtered/unapplied warning and scope limitation retained. Both PDFs were rendered and inspected. These are specified Chromium viewport/print checks, not physical-device, all-browser, or physical-printer certification.

The actual 21-pair sample JSON/CSV/HTML/SVG downloads were read back independently: all six expected connections and 15 expected non-connections matched the declared nets, records/notes matched, the HTML had all 21 rows, and HTML/SVG retained scope text without scripts or external assets. The separate maximum JSON contains all 496 unique pairs for 32 pins.

Evidence: [CI summary](evidence/ci-summary.json), [browser results](evidence/results.json), [download checks](evidence/download-verification.json), [wide-label measurements](evidence/wide-label-measurements.json), [Japanese desktop](evidence/desktop-ja.png), [English desktop](evidence/desktop-en.png), [390px mobile](evidence/mobile-390.png), [complete print PDF](evidence/print-report.pdf), and [partial-screen print PDF](evidence/partial-screen-print.pdf). Later documentation-only commits receive their own exact-head CI runs.

## CI configuration

`.github/workflows/verify.yml` defines:

- Model jobs: Node 22 and 24, UTC and Asia/Tokyo
- Browser job: Ubuntu 22.04, Playwright 1.56.0, Chromium sandbox explicitly enabled
- Artifact upload: `tests/browser/artifacts/`, including `results.json`, screenshots, actual exports, and print PDF

No paid service, credentials, hardware, or external application data is required. CI uses read-only repository permission. No workflow is marked successful merely because it has been authored.

## Not established

No physical measurements, electrical safety, fault-detection effectiveness, resistance thresholds, hardware compatibility, real-product pinouts, demand, novelty, or market value are established. Manual result entries are not measured evidence. No project license was added.
