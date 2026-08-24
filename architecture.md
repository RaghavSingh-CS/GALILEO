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

- The engine now lacks Ohm's Law and Series/Parallel experiment definitions entirely since they were deleted instead of refactored.

**Pending/next steps**

- Implement the actual Ohm's Law and Series/Parallel verifiers (Phase 9) inside `engines/physics/experiments` to provide a robust facade for the frontend UI.
