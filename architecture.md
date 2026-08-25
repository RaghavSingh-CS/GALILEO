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
- **[2026-08-25 18:12]:** Integrated the chemistry engine package into the titration experiment. The app now uses the formal chemistry simulation modules under `src/experiments/chemistry/` for Mohr’s salt preparation and permanganate titration, replacing the earlier placeholder stoichiometric pH approximation. The experiment contract in `src/experiments/types.ts` was restored and the registry wiring in `src/experiments/registry.ts` was aligned to the actual engine implementation. The build was validated with `npm run build` and completed successfully after fixing the import/export mismatch between preparation and permanganate modules.
- **[2026-08-25 18:20]:** Documented the project’s current state as a state-based chemistry simulation pipeline rather than a simple calculator: experiment engines still return `SimulationResult` objects for the UI, but the chemistry engine now models preparation validity, titration phase transitions, reagent delivery, and reaction usability. The overall app structure remains SPA + Zustand + proxy-based AI, but the chemistry domain logic has become substantially more realistic and app-integrated.
- **[2026-08-25 20:30] (Phases 0-10 Frontend & Engine Integration):** Executed complete end-to-end integration of the GALILEO platform to deployment readiness. Built a robust dual-engine simulation backend (Physics deterministic MNA solver and Chemistry stoichiometric tracking). Hardened UI state management to rely entirely on engine contracts (`SimulationResult` and `ValidationMessage`) without hardcoding scientific constants. Enforced exact pedagogical verifiers (Ohm's Law, Series/Parallel). Validated robust topological edge cases (e.g., floating dead-ends resolving to 0V/0A). Resolved all UI layout, accessibility, routing, and chemistry state UI bugs (e.g., titration dynamic HSL phenolphthalein color matching equivalence). Verified build stability with 67 integration tests and a 0-error `oxlint` strict linting pass.
