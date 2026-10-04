# Engineering explanation

## One-minute explanation

ProbePlan converts a declared small pin inventory into a complete manual connectivity record. Every pin must belong to exactly one net or be explicitly isolated. For each unordered pair, the compiler asks only whether both pins have the same declared net. It generates n(n−1)/2 cases, at most 496 for 32 pins.

The interesting engineering work is the boundary around that simple algorithm: rejecting ambiguous input, preserving deterministic identity, invalidating stale records, keeping unsafe claims out of the workflow, and testing the output independently.

## Decisions worth discussing in an interview

1. **Complete accounting before generation.** A missing pin is an input error, not an implied unused pin. Duplicate declarations, double assignments, empty nets, and references to absent pins are rejected
2. **Exact binding, not a fragile fingerprint.** The canonical map string is compared exactly. A short display code is merely a reference. Even metadata changes invalidate records to avoid relabelling old evidence silently
3. **Staged edits.** The last compiled plan remains visible during editing, but result controls and exports lock immediately. Invalid edits never overwrite the valid session. Applying a change is explicit and resets all records
4. **Conservative completeness.** The checklist contains both expected connections and expected non-connections. There is no reduced practical check set and no assertion that mathematical graph coverage proves physical quality
5. **Interchange safety.** Strict duplicate-key JSON parsing precedes schema validation. Versioned session import checks complete pair coverage. HTML/XML escaping and formula-protected CSV are applied at the format boundary
6. **Independent verification.** The oracle constructs mathematical partitions independently, then examines all intended-vs-actual partition combinations for up to seven pins. Separate adversarial tests cover strings, IDs, schema versions, stale bindings, and maximum sessions
7. **Minimal distribution.** The actual app has zero runtime dependencies, no analytics, no remote fonts, and no application network requests. Browser tooling is development-only

## Complexity and bounds

- Input validation: linear in the inventory and assignments, plus bounded sorting
- Pair generation: O(n²) time and space; maximum 496 pairs
- Export: O(n² + total note length)
- Import: at most 1,000,000 UTF-8 bytes, with depth limit 20
- The UI revalidates sessions before record mutation and export. At this deliberately small scale, redundancy is preferable to carrying untrusted state across boundaries

## What the oracle proves

For an ideal model where connection is an equivalence relation over pins, two different partitions differ on at least one unordered pair. Listing all pairs therefore distinguishes the model partitions. The test oracle confirms this through seven pins and checks all-pairs enumeration through the 32-pin boundary.

It does not model meter thresholds, resistances, directionality, timing, intermittent contact, fixture errors, instrument safety, or actual assembly behavior. Those are outside the product.

## Failure modes and recovery

- Invalid draft: retain the old compiled map, lock writes/exports, show the validation error
- Changed map: explicit confirmation; reset all records and notes
- Stale imported binding: reject rather than “repair” and imply trustworthy carryover
- Interrupted replacement/reset: cancel or Escape preserves the current work
- Unavailable browser storage: show an error and retain JSON download capability
- Unknown schema version: reject; there is no silent migration
- Modified JSON with a correctly recomputed binding: accepted as user-supplied records; this is not a secure audit system

## Japanese interview summary

アルゴリズム自体は、n個のピンからn(n−1)/2個のペアを列挙するシンプルなものです。工夫したのは、入力漏れを黙って補完しないこと、記録を正確なマップに結びつけること、編集時に古い結果が残らないこと、形式ごとの出力エスケープ、そして別実装のオラクルによる検証です。実物の測定や安全認証とは明確に分けています。
