# GALILEO Architecture

## Core

Browser-first shared virtual laboratory platform.

### Frontend
- TypeScript
- React
- Vite
- Tailwind CSS
- Zustand
- Zod

### Interaction
- @xyflow/react — circuit diagrams and wiring
- react-konva / Konva — general Physics/Chemistry apparatus
- SVG — apparatus and circuit graphics

### Simulation
- Deterministic Physics Engine
  - Circuits
  - Mechanics
  - Optics
  - future modules
- Deterministic Chemistry Engine
  - Reactions
  - Stoichiometry
  - Titration/pH
  - future modules
- math.js for numerical mathematics

### Experiment Layer
- Reusable experiment definitions
- Measurements and observations
- Recharts for graphs
- Local persistence first

### Optional Platform Backend
- Python + FastAPI
- PostgreSQL / Supabase
- LLM API

## Architectural Rules

1. LabState is the source of truth.
2. Renderers do not own simulation state.
3. Physics and Chemistry engines are deterministic.
4. AI never provides simulation ground truth.
5. React Flow and Konva are interaction/rendering adapters only.
6. Experiments sit above simulation engines.
7. Core simulations must not require the backend.
8. Exam mode, teacher mode, assessment, analytics, LMS and AI are extensions, not core dependencies.
9. Extensions communicate through generic simulation, experiment, observation, session and event interfaces.
10. New subjects should be addable without rewriting the shared lab core.
