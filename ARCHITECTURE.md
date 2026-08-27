# Architecture Overview

GALILEO Lab is structured as a modern React Single Page Application (SPA) with a lightweight Express backend proxy for handling AI requests.

## Directory Structure

- `/src`: Contains the React frontend code.
  - `/views`: High-level page components (`Dashboard`, `Workspace`, `SettingsView`, etc.).
  - `/stores`: Zustand stores for global state management (`experiment.ts`, `history.ts`, `navigation.ts`, `settings.ts`).
  - `/experiments`: Logic and types for different scientific experiments (e.g., `/physics`, `/chemistry`).
  - `/panels`: Reusable UI panels and modals.
  - `/lib`: Utility functions and helpers.
- `/server`: Contains the Express server (`proxy.ts`) which securely interacts with the Google Gemini API.

## Core Concepts

### State Management (Zustand)
The application relies heavily on Zustand for decoupled, scalable state management:
- **Navigation Store:** Manages the active view and UI panel states (e.g., settings, library, active experiment).
- **Settings Store:** Manages user preferences like AI verbosity, chart curve types, and instrument tolerances.
- **Experiment Store:** Manages the active experiment's data, inputs, and real-time readings.
- **History Store:** Persists user experiments and results.

### Workspace & Experiments
The `Workspace` view is the core of the application, dynamically rendering different experiments based on the `registry.ts` in `/experiments`. Experiments define their inputs, variables, and formulas for calculating outcomes.


### AI Integration
The Express server acts as a proxy to the Gemini API (`@google/genai`). The frontend communicates with this proxy rather than exposing the API key directly in the browser. The `settings.ts` store controls how verbose or pedagogical the AI responses are.

### Styling
Tailwind CSS is used for all styling, providing a highly customizable and responsive design system. The application features a dark-themed, scientific aesthetic ("GALILEO Lab").

---

## Project Timestamp Ledger
*This section acts as a chronological record of architectural changes and major updates, specifically to provide context for AI assistants and developers.*

- **[Initial State]:** GALILEO Lab project established. Built as a React SPA (Vite/TypeScript/Tailwind CSS) with an Express backend proxy. Core features include physics/chemistry simulations (Ohm's Law, Titration), real-time Recharts graphing, Zustand global state management, and an integrated Gemini AI assistant.
- **[2026-08-23 18:44]:** Established the `ARCHITECTURE.md` documentation, generated project `README.md`, and implemented a contextual "Close (X)" button in the Settings tab using `useNavigationStore` state tracking.
- **[2026-08-25 18:12]:** Integrated the chemistry engine package into the titration experiment. The app now uses the formal chemistry simulation modules under `src/experiments/chemistry/` for Mohr's salt preparation and permanganate titration, replacing the earlier placeholder stoichiometric pH approximation. The experiment contract in `src/experiments/types.ts` was restored and the registry wiring in `src/experiments/registry.ts` was aligned to the actual engine implementation. The build was validated with `npm run build` and completed successfully after fixing the import/export mismatch between preparation and permanganate modules.
- **[2026-08-25 18:20]:** Documented the project's current state as a state-based chemistry simulation pipeline rather than a simple calculator: experiment engines still return `SimulationResult` objects for the UI, but the chemistry engine now models preparation validity, titration phase transitions, reagent delivery, and reaction usability. The overall app structure remains SPA + Zustand + proxy-based AI, but the chemistry domain logic has become substantially more realistic and app-integrated.
- **[2026-08-25 20:30] (Phases 0-10 Complete):** Executed complete end-to-end integration of the GALILEO platform spanning 10 development phases. Key milestones include:
  - **Phases 0-7 (Foundation & Chemistry):** Built the React SPA/Zustand architecture, implemented the proxy-based Gemini AI integration, and established the state-based chemistry simulation engine (Mohr's salt & titration).
  - **Phase 8 (Physics Core):** Built the robust physics deterministic MNA solver to handle complex DC circuits.
  - **Phase 9 (Pedagogical Verifiers):** Hardened the physics engine with strict pedagogical rules (Ohm's Law, Series/Parallel) and a "Red Team" audit to prevent cheating or invalid topologies.
  - **Phase 10 (Frontend Integration & Stabilization):** Finalized UI/UX, routing, dynamic titration visual feedback (HSL phenolphthalein color matching), resolved all UI integration issues, and strictly enforced the `SimulationResult` engine contracts across the frontend. Validated with 0-error strict linting.
- **[2026-08-26 14:00]: React Flow Circuit Sandbox:** Completely refactored the physics frontend to use `@xyflow/react` for visual, node-based circuit construction.
  - Introduced `CircuitSandbox.tsx` as the core physics UI, bridging React Flow state with the underlying MNA physics solver.
  - Replaced legacy global sliders with localized component-level editing (e.g., Battery voltage, Resistor resistance) directly inside the custom node components (`BatteryNode.tsx`, `ResistorNode.tsx`).
  - Added robust UI feedback: per-node highlighting (red/amber outlines for errors/warnings) driven by real-time simulation evaluation and dynamic V-I graph recording by explicitly selecting Ammeters/Voltmeters via the Calibration Panel.
- **[2026-08-26 20:00]: Circuit Sandbox UX & Telemetry Fixes:** Improved the UX of the visual Circuit Sandbox and resolved critical data-flow bugs.
  - Wire interaction UX: orthogonal (step-edge) wire routing, enlarged terminal hitboxes, stronger snap radius (`connectionRadius={40}`), and symmetrical bidirectional connections (`ConnectionMode.Loose`, all handles as `type="source"`).
  - Fixed meter reading desync: rewired terminal-connectivity checks to use `circuitState.wires` instead of raw React Flow edges; unified Workspace telemetry to read directly from canvas node `data.reading` so meters and telemetry always agree.
  - UI polish: removed redundant "Save Run" button from observations header, removed debug Conductance/Power bar from sandbox footer, widened meter-selection dropdowns for comfortable label fit.
- **[2026-08-26 22:27]: Chemistry Titration Experiments:** Added and integrated two runnable titration experiments: Mohr's salt versus potassium permanganate and oxalic acid versus potassium permanganate. Both use the state-based preparation and permanganate titration engines, expose experiment-specific apparatus controls, support automated titration sweeps, and are registered in the shared experiment workspace.
- **[2026-08-27]: Frontend Integration Audit & Physics Sandbox Completion:** Retested the merged Physics and Chemistry work from `frontend` on the isolated `codex/frontend-integration-debug` branch and reconciled documentation with the active root application.
  - The active Physics path is now explicitly `React/React Flow -> circuitAdapter.ts -> deterministic Physics engine`; React Flow types remain outside the engine.
  - Completed Battery, Resistor, Variable Resistor, Switch, Ammeter, and Voltmeter palette/node support; added stable click placement alongside drag/drop, terminal wiring/removal, live readings, and engine-driven validation.
  - Fixed stale React Flow edge capture during component edits and debounced simulation updates so rapid mutations resolve against the latest graph.
  - Removed stochastic measurement perturbation and the solver's global GMIN leakage. Scientific outputs are deterministic, high-resistance results retain accuracy, and power/KCL invariants no longer include artificial shunt loss.
  - Hardened experiment verifiers against partial-network voltmeter placement, branch-only ammeters, and otherwise-unmapped core validation failures.
  - Exposed Series/Parallel Resistance in Dashboard, New Experiment, and Library flows; completed topology-aware observations, analysis, chart labels, and CSV output.
  - The active root Chemistry adapters remain backed by the merged state-machine engines. Random UI-wrapper noise was removed to preserve the deterministic simulation contract; the standalone sibling package under `frontend/` remains byte-compatible and independently tested.
  - Remaining structural debt: the legacy Zustand circuit renderer/store path and registry `compute()` wrappers coexist with the active local React Flow sandbox, and the generic `SimulationResult` frontend type is still weakly typed.
- **[2026-08-27]: Phase 1 Integration Review & Physics Red-Team Checkpoint:** Audited the `frontend` integration state against repository documentation and the local-only `.agents/` and `.context/` guidance stored in the primary checkout.
  - **Decision/change:** Added independent regression coverage for malformed public-verifier inputs, extreme finite numeric inputs, repeated deterministic solves, and documented `in-progress` behavior. Hardened both pedagogical verifiers so malformed runtime payloads return stable `unusable` / `INVALID_CIRCUIT` results instead of throwing before the core integrity boundary. Reconciled application-layer Physics imports with the required public `engines/physics/index.ts` facade and restored `in-progress` for complete apparatus sets with transient floating/dangling wiring while keeping fully wired invalid placements `unusable`.
  - **Rationale:** React Flow and persisted state can be incomplete or malformed at runtime. Every exported engine boundary must contain those states deterministically and must never delegate scientific truth to AI.
  - **Files modified:** `src/engines/physics/experiments/ohms-law.ts`, `src/engines/physics/experiments/series-parallel.ts`, and `src/engines/physics/experiments/__tests__/phase1-checkpoint.test.ts`.
  - **Scientific/system assumptions:** The engine remains deterministic, DC-only, linear, and ideal-component based. The review did not add measurement noise, GMIN leakage, or sandbox behavior.
  - **Verification:** Physics-focused tests passed (15 files, 159 tests); the complete root suite passed (45 files, 726 tests); standalone Chemistry passed (14 files, 282 tests); typecheck and production build passed; lint completed with pre-existing warnings.
  - **Remaining divergence:** Local React Flow ownership conflicts with the documented Zustand bridge, and Chemistry UI adapters independently assume `0.02 M` KMnO4 while named engine truth uses `0.01 M`.
  - **Next step:** Stop at the Phase 1 checkpoint for review before changing sandbox/state architecture or Chemistry integration behavior.
- **[2026-08-27]: Post-Review Physics Adapter Reconciliation:** Continued after the Phase 1 review with one narrowly scoped Physics frontend fix; no state-ownership or Chemistry migration was attempted.
  - **Decision/change:** Made React Flow duplicate-wire detection node-and-handle aware so repeated handle labels on different components remain connectable.
  - **Rationale:** React Flow handle names are component-local rather than globally unique; comparing handle labels alone incorrectly rejects valid wires between other component pairs.
  - **Files modified:** `src/experiments/physics/circuitAdapter.ts`, `src/experiments/physics/components/CircuitSandbox.tsx`, and `src/experiments/physics/circuitAdapter.test.ts`.
  - **Scientific/system assumptions:** No Chemistry engine or experiment behavior changes are retained. Circuit-state ownership and saved-session behavior remain unchanged.
  - **Verification:** The complete root suite passed (45 files, 731 tests), including the added verifier and frontend-adapter regressions; standalone Chemistry passed unchanged (14 files, 282 tests); typecheck and production build passed; lint completed with pre-existing warnings only.
  - **Remaining divergence:** Local React Flow state still differs from the documented Zustand bridge, and the Chemistry UI/engine molarity divergence remains deliberately out of scope for this checkpoint.
  - **Next step:** Decide circuit-state persistence ownership and saved-session compatibility before migrating local React Flow state or removing the legacy path.
