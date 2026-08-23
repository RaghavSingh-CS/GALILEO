# GALILEO Architecture Ledger

*This document serves as a timestamped ledger of architectural changes and implementation steps for this branch. It provides context for AIs and team members.*

---

## [2026-08-23 15:50:00] Physics Engine Core Implementation (Phase 1)
**Author**: Dhruv C (via AI Agent)
**Branch**: `feat/physics-engine-core`

### What was done:
- **General Rule Enforcer (`validator.ts`)**: Implemented a comprehensive validation engine to enforce universal physical constraints on any DC circuit topology. Detects short circuits, open loops, missing voltage sources, and handles disconnected/floating subgraphs.
- **Physics Solver (`solver.ts`) & Graph Builder (`graph.ts`)**: Built a deterministic backend using Modified Nodal Analysis (MNA). 
  - `graph.ts` uses a Union-Find algorithm to elegantly resolve complex wire networks and junctions into purely electrical nodes.
  - `solver.ts` translates these nodes and branches into an MNA conductance matrix and solves it via `math.lusolve`, completely independent of LLM math hallucinations.
- **Measurements (`measurements.ts`)**: Accurately derives conventional current directions and voltage drops for Recharts plotting and UI display.
- **Testing (`__tests__`)**: Wrote and passed 21 strict unit/integration tests to guarantee sign conventions and safety against degenerate topologies.

### Architectural Decisions:
- Adopted a two-stage pipeline: **General Physics Rule Enforcer** (completed) -> **Specialized Experiment Sub-Engine** (upcoming).
- Decided that the physics engine will never `throw` errors for malformed circuits; instead, it returns an array of pedagogical `ValidationMessage` objects for the frontend UI to display.
- Shelved extreme edge-case handling (e.g., parallel batteries causing singular matrices) to `.context/qa-audit-v3-shelved.md` until required by the UI team.

### Next Steps:
- Transition into Phase 8-9: Implement `verifier.ts` to bridge the gap between raw physics output and specialized pedagogical experiment rules (like verifying Ohm's Law apparatus).
