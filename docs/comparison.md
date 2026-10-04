# Research and positioning

Sources reviewed on 2026-10-04. These are documentation-based comparisons, not hands-on product evaluations. Product capabilities can change. This is a scoped portfolio project; no novelty or market-demand conclusion follows from this comparison.

## Established alternatives

### WireViz

[Official repository](https://github.com/wireviz/WireViz)

WireViz documents wiring harnesses using structured input and generates diagrams and bills of materials. Its documented outputs include SVG, PNG, HTML, and tab-separated BOM files. That makes it a strong reference for communicating wiring design.

ProbePlan’s selected focus is smaller: an explicit pin inventory becomes a full manual pair checklist, with expected connections and non-connections plus map-bound handwritten-style records. ProbePlan does not replace WireViz’s diagram/BOM workflow and does not implement or bundle WireViz.

### NodeLoop Cable Harness Diagram Generator

[Official tool](https://nodeloop.org/tools/cable-harness-gen/)

NodeLoop describes a browser interface for YAML-based harness diagrams with SVG export and identifies WireViz as its underlying project. Its examples and resources support visual harness documentation.

ProbePlan uses a pin-to-net model and emphasizes complete pair accounting, manual state, invalidation after edits, and portable record exports. This is a workflow emphasis, not a claim that a comparable feature is absent from every other product.

### CAMI Research CableEye

[Official continuity test systems page](https://www.camiresearch.com/cable-testers/cable-continuity-tester.html)

CAMI documents hardware-based continuity systems and model-dependent resistance and other measurement capabilities, with graphical displays and printable reports. Those systems actually test connected assemblies.

ProbePlan is not an alternative to measurement hardware. It neither acquires readings nor declares a cable physically compliant. Its “pass/fail” fields are user-entered records only.

## Why the safety boundary is explicit

[Fluke’s continuity explanation](https://www.fluke.com/en-us/learn/blog/electrical/what-is-continuity) describes continuity checks in relation to resistance, notes that audible indication varies by meter, and says voltage must not be present during continuity testing.

[Cirris’s resistance-threshold guidelines](https://cirris.com/guidelines-for-setting-resistance-test-thresholds/) distinguish intended connections from unintended connections and discuss instrument thresholds. These sources show why abstract same-net logic does not determine practical electrical pass/fail criteria.

ProbePlan therefore provides no threshold recommendation, no instructions for energized equipment, and no inferred physical result. The user must supply the expected map and use appropriate equipment documentation and qualified judgment outside this application. Only isolated, disconnected wire-only passive assemblies are in scope; components, batteries, mains, and safety-critical applications are excluded.

## Hypothesis to validate, not a demand claim

The proposed usefulness is reducing transcription and omission errors when a person already has an explicit small wire-only map and needs a portable manual record. A future usability study could ask whether users correctly account for all pins, distinguish expected non-connections, notice invalidated results, and resume from JSON without re-entry. No such study or customer validation has been performed.
