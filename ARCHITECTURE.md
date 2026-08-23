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

### Simulation Pacing & Timed Steps
Experiments support "Continuous Auto-Sweep" or timed step data collection. The pacing of these timed steps (e.g., fast, standard, slow) is controlled by the `settings.ts` store and executed within the experiment engine. This allows simulated physics and chemistry variables to update over time, simulating real-world sensor data collection.

### AI Integration
The Express server acts as a proxy to the Gemini API (`@google/genai`). The frontend communicates with this proxy rather than exposing the API key directly in the browser. The `settings.ts` store controls how verbose or pedagogical the AI responses are.

### Styling
Tailwind CSS is used for all styling, providing a highly customizable and responsive design system. The application features a dark-themed, scientific aesthetic ("GALILEO Lab").
