# Physics Development Ledger

## Purpose

This committed ledger records meaningful Physics architecture and implementation work so that teammates, maintainers, and future coding agents can reconstruct what changed and why. It records scientific assumptions, affected contracts, verification, known limitations, and next steps rather than duplicating commit messages.

This document is separate from private review ledgers stored outside the repository.

## Entry requirements

Every meaningful implementation task must append an entry containing:

- Timestamp
- Decision/change
- Rationale
- Files added/modified
- Interfaces/contracts affected
- Scientific assumptions
- Tests/verification performed
- Known limitations
- Pending/next steps

## Entries

### 2026-08-23 15:50:00 +05:30 — Physics Engine Core Implementation (Phase 1)

**Decision/change**

Implemented a comprehensive validation engine (`validator.ts`) to enforce universal physical constraints on DC circuit topologies (detecting short circuits, open loops, missing voltage sources, and floating subgraphs). Built a deterministic solver backend (`solver.ts`) using Modified Nodal Analysis (MNA), alongside a Graph Builder (`graph.ts`) using a Union-Find algorithm. Added accurate conventional current and voltage derivations (`measurements.ts`).

**Rationale**

A deterministic solver ensures that physical behaviors are accurate without relying on hallucination-prone LLM math. A two-stage pipeline separates general physics rules from specialized experiment sub-engines (like Ohm's Law verifiers), allowing the UI to receive pedagogical `ValidationMessage` feedback instead of raw math exceptions.

**Files added/modified**

- `frontend/src/engines/physics/circuits/graph.ts`
- `frontend/src/engines/physics/circuits/measurements.ts`
- `frontend/src/engines/physics/circuits/solver.ts`
- `frontend/src/engines/physics/circuits/validator.ts`
- `frontend/src/engines/physics/circuits/__tests__/*.test.ts`

**Interfaces/contracts affected**

- Established `solveCircuit` as the primary integration boundary for the frontend.
- `ValidationMessage` array established as the standard error-reporting mechanism instead of `throw`.

**Scientific assumptions**

- Ideal wire resistance is exactly 0 ohms.
- Complex edge cases (e.g., parallel batteries causing perfectly singular matrices) are shelved to `.context/qa-audit-v3-shelved.md` until explicitly required by the UI.

**Tests/verification performed**

- Wrote 21 strict unit/integration tests guaranteeing sign conventions and solver safety against degenerate topologies.

**Known limitations**

- Does not support AC circuits or non-linear components (diodes/transistors).
- Shelved extreme mathematical edge cases (parallel ideal batteries).

**Pending/next steps**

- Transition into Phase 8-9: Implement `verifier.ts` to bridge the gap between raw physics output and specialized pedagogical experiment rules.

### 2026-08-24 20:00:00 +05:30 — Physics Engine Hardening & Experiment Preparation (Phase 8)

**Decision/change**

Implemented comprehensive runtime input validation (`integrity.ts`) guarding against duplicate IDs, self-wires, and malformed JSON payloads. Upgraded graph traversal (`validator.ts`, `graph.ts`) to handle voltmeter isolation, complex short-circuit chains (PHY-007), and floating/half-connected components without crashing (PHY-023). Stripped all `ExperimentDefinition` metadata from the core solver types.

**Rationale**

The engine must safely reject untrusted, malformed state coming from the UI/React Flow adapter without crashing. Stripping `ExperimentDefinition` from the core ensures the physics engine isn't bloated with UI metadata, aligning with the Chemistry engine's strict separation between core engine math and specialized named verifiers.

**Files added/modified**

- `frontend/src/engines/physics/circuits/integrity.ts`
- `frontend/src/engines/physics/circuits/graph.ts`
- `frontend/src/engines/physics/circuits/validator.ts`
- `frontend/src/engines/physics/circuits/types.ts`
- `frontend/src/engines/physics/circuits/__tests__/*.test.ts`
- (Deleted) `frontend/src/engines/physics/experiments/ohmsLaw.ts`
- (Deleted) `frontend/src/engines/physics/experiments/seriesParallel.ts`

**Interfaces/contracts affected**

- `solveCircuit` (in `index.ts`) is fully guaranteed to be a non-throwing public boundary.
- Removed `ExperimentDefinition` from core physics interfaces.

**Scientific assumptions**

- Voltmeters have infinite ideal resistance and therefore do not conductively connect isolated subgraphs (PHY-008).
- Floating dead-end branches mathematically resolve to `0A` and `0V` without breaking the active parts of the circuit.

**Tests/verification performed**

- Expanded test suite to 58 unit and integration tests.
- Graceful degradation proven via integration tests mathematically solving half-connected floating components to 0A/0V.
- `npm run typecheck` verified 0 errors across the engine.

**Known limitations**

- The engine lacked Ohm's Law and Series/Parallel experiment definitions temporarily before Phase 9.

**Pending/next steps**

- None for Phase 8.

### 2026-08-25 02:40:00 +05:30 — Physics Engine Red Team Audit & Pedagogical Verifiers (Phase 9)

**Decision/change**

Implemented the `ohms-law.ts` and `series-parallel.ts` pedagogical verifiers. Conducted an exhaustive "Red Team" security audit and E2E simulation testing (`user-flow.test.ts`), hardening the verifiers to strictly enforce exact component counts and reject extraneous components to seal cheat loopholes. Established `index.ts` as the strict public facade, shielding internal engine logic from external adapters.

**Rationale**

The engine must safely evaluate educational laboratory tasks, meaning mathematically valid physical circuits (e.g., adding 5 extra batteries) must still be rejected if they violate the pedagogical parameters of the specific lab. An E2E test suite ensures the engine correctly processes incremental, incomplete UI states (like dangling wires) exactly as the user creates them, without crashing. 

**Files added/modified**

- `frontend/src/engines/physics/experiments/ohms-law.ts`
- `frontend/src/engines/physics/experiments/series-parallel.ts`
- `frontend/src/engines/physics/experiments/types.ts`
- `frontend/src/engines/physics/experiments/__tests__/user-flow.test.ts`
- `frontend/src/engines/physics/index.ts`

**Interfaces/contracts affected**

- `verifyOhmsLawExperiment` and `verifySeriesParallelExperiment` added to the public `index.ts` API.
- Replaced the deprecated `TOO_MANY_COMPONENTS` with `EXTRANEOUS_COMPONENTS` in the unified types.

**Scientific assumptions**

- None new. Pedagogical verifiers defer all math and topological rules to the core `solveCircuit` pipeline.

**Tests/verification performed**

- 67 strict unit/integration tests passing.
- Custom `user-flow.test.ts` E2E simulator successfully executes a multi-step user interaction (dropping a battery, leaving dangling wires, successfully wiring the lab, and maliciously adding extra batteries).
- TypeScript composite typecheck (`tsc -b`) enforces 0 errors across the entire module.

**Known limitations**

- The engine is fully completed for V1 requirements (DC resistive circuits).

**Pending/next steps**

- The Physics Engine is simulation ready. Next step is for the UI Team to build an adapter to map the React Flow graph state into our `CircuitState` format and consume the pedagogical verifier outputs.

### 2026-08-25 20:20:00 +05:30 — Frontend Engine Integration & UI Hardening (Phase 10)

**Decision/change**

Integrated the physics and chemistry engines into the frontend shell, implemented robust hash-based routing, and resolved all 24 UI/UX and engine-integration audit issues. Titration logic was refactored to read dynamic equivalence and stoichiometric states from the chemistry engine rather than hardcoded UI values. The titration visual feedback now accurately models phenolphthalein behavior using an HSL color transition to correctly darken past the equivalence point.

**Rationale**

The frontend needed to be strictly decoupled from hardcoded scientific assumptions and solely rely on the engine contracts (`SimulationResult` and `ValidationMessage`). The UI state (Zustand) is now the single source of truth for topology, ensuring React Flow and the Physics Engine cannot diverge.

**Files added/modified**

- `frontend/src/views/Workspace.tsx`
- `frontend/src/panels/GalileoChat.tsx`
- `frontend/src/panels/Modals.tsx`
- `frontend/src/experiments/chemistry/titration-analysis/engine.ts`
- `frontend/src/experiments/chemistry/titration-analysis/config.ts`
- `frontend/src/experiments/types.ts`
- `frontend/src/stores/experiment.ts`
- `frontend/src/stores/history.ts`

**Interfaces/contracts affected**

- Widened `SimulationResult` to accept dynamic boolean state flags (`isNearEquivalence`, `isNeutralized`).
- Updated `SaveExperimentModal` to properly accept and persist user-written notes from the Workspace.

**Scientific assumptions**

- Phenolphthalein behavior transitions from light pink to dark magenta when excess titrant is added past equivalence in a base-in-acid/acid-in-base scenario.

**Tests/verification performed**

- `npm run build` succeeds cleanly.
- `oxlint` linting passes with zero errors.
- Visual QA confirms titration colors darken correctly and equivalence warnings trigger dynamically.

**Known limitations**

- Auto-run sweep progression is functionally correct for the demo but still lives in `Workspace.tsx` rather than adapter-owned run plans.

**Pending/next steps**

- Project is ready for deployment / E2E user testing.
