# GALILEO Lab — Project Context

**Target Audience:** Planning models, AI assistants, and new developers.
**Purpose:** This document provides a high-level summary of the GALILEO Lab project, its architecture, its technologies, and its current state to assist with future planning and development tasks.

---

## 1. Project Overview

GALILEO Lab is an interactive educational platform featuring real-time, deterministic scientific simulations. It acts as a virtual laboratory where students can construct experiments, take physical measurements, and see live graphing of their observations (e.g., V-I characteristic curves, titration pH curves) while receiving pedagogical feedback from an integrated AI.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4.
- **State Management:** Zustand (for global application state) and local React state.
- **Visual Node Editor:** `@xyflow/react` (React Flow) for physics circuit construction.
- **Backend:** A lightweight Express server (`/server/proxy.ts`) serving as a secure proxy for the Google Gemini API (`@google/genai`).
- **Graphing:** `recharts` for dynamic, real-time data plotting.
- **Math/Physics Engine:** Custom deterministic MNA (Modified Nodal Analysis) solver built on `mathjs` for DC circuits, alongside a state-based chemistry solver.

## 2. Directory Structure

- `/src` — Core React frontend codebase.
  - `/views` — High-level layout components (e.g., `Workspace.tsx`, `Dashboard.tsx`).
  - `/stores` — Zustand stores (`experiment.ts`, `settings.ts`, `navigation.ts`).
  - `/experiments` — The domain-specific scientific logic and engines.
    - `/physics` — Contains the deterministic MNA solver, Ohm's law/Series-Parallel verification rules, and the `CircuitSandbox` (React Flow) components.
    - `/chemistry` — Contains the state-based chemistry engine for Mohr's salt preparation and titration modeling.
  - `/panels` — Reusable UI panels (e.g., Calibration panels, Galileo Chat).
- `/server` — Express backend for AI proxying.

## 3. Key Architectural Patterns

1. **State Isolation:** The application strictly separates pure domain logic (the physics/chemistry simulation engines) from the UI layer. The engines consume `CircuitState` or `ChemistryState` objects and return deterministic `SimulationResult` outputs.
2. **Experiment Registry:** The application is highly extensible. New labs are registered in `src/experiments/registry.ts`. Each experiment defines its UI configuration, required data columns, and the engine to compute live results.
3. **The Circuit Sandbox (Physics):** 
   - A major feature is the interactive circuit builder powered by React Flow (`src/experiments/physics/components/CircuitSandbox.tsx`).
   - The sandbox maintains a visual graph of custom nodes (`BatteryNode`, `ResistorNode`, `AmmeterNode`, `VoltmeterNode`) connected by straight edges.
   - The sandbox continuously adapts the React Flow graph into a `CircuitState`, runs the `solveCircuit` MNA engine, and pushes readings and validation messages back into the node data to render localized UI feedback (like glowing red error outlines on miswired components).
4. **Pedagogical Verification:** The physics engines enforce strict rules. The UI leverages the engine's `verifyOhmsLawExperiment` output to prevent students from recording data if their circuit is broken, short-circuited, or pedagogically unsound.

## 4. Current State & Recent Changes

The project is currently stable and fully integrated. Recent major refactors include:
- **Chemistry Engine Stabilization:** Migrated titration from placeholder math to a rigorous state-based pipeline modeling reagent delivery and phase transitions.
- **React Flow Physics Refactor:** 
  - Replaced legacy global sliders with localized component-level editing directly inside the custom circuit nodes.
  - Moved the `ValidationPanel` to the global `Workspace.tsx` Calibration sidebar to unify experiment feedback.
  - Introduced explicit meter assignment: The UI dynamically detects active Ammeters/Voltmeters from the `CircuitSandbox` and allows the user to bind them to the V-I recording action.

## 5. Available Commands
- `npm run dev` — Starts both the Vite frontend and the Express backend concurrently.
- `npm run build` — Runs `tsc -b` for strict type checking and `vite build`.
- `npm run lint` — Runs `oxlint` for lightning-fast strict linting.
