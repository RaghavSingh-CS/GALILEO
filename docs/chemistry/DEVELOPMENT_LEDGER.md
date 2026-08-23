# Chemistry Development Ledger

## Purpose

This committed ledger records meaningful Chemistry architecture and implementation work so that teammates, maintainers, and future coding agents can reconstruct what changed and why. It records scientific assumptions, affected contracts, verification, known limitations, and next steps rather than duplicating commit messages.

This document is separate from private review ledgers stored outside the repository.

## Scope

The approved prototype scope is CBSE Class XII permanganate volumetric analysis:

- preparation of a standard oxalic-acid solution;
- preparation of a ferrous ammonium sulphate (Mohr's salt) solution;
- titration of KMnO4 against standard oxalic acid in sulfuric-acid medium;
- titration of KMnO4 against Mohr's salt in sulfuric-acid medium;
- scientifically meaningful mistakes, malformed trials, reset, and repeat-trial behavior.

Standard-solution preparation is required prototype behavior. The engine will model measured mass, molar-mass conversion, amount of substance, material addition, solvent addition, dissolution/mixing, quantitative transfer where required, volumetric dilution, derived concentration, and preparation validity.

The modeling boundary excludes physical balance mechanics, pan or scoop motion, individual drops, glass wetting, meniscus optics, uncertainty propagation, and laboratory-grade weighing-error simulation. Those are visual or advanced measurement concerns, not Chemistry domain state.

The generic Chemistry core must remain independent of React, Zustand, Konva, SVG, DOM, renderer coordinates, animations, CSS, and AI-generated scientific truth. Experiment procedure and guidance belong under `frontend/src/experiments/chemistry/`; scientific behavior belongs under `frontend/src/engines/chemistry/`.

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

### 2026-08-23 16:36:38 +05:30 — Stage 1 provisional Chemistry development scaffolding

**Decision/change**

Established minimal, provisional TypeScript and Vitest development scaffolding and the approved Chemistry directory boundaries. Standard-solution preparation is explicitly included in the implementation scope alongside both permanganate titrations.

Stage 1 review corrections made the default test command tolerate the intentional zero-test scaffold, explicitly excluded DOM libraries from Chemistry TypeScript compilation, and removed the inherited generic `titration` placeholders in favor of the approved `volumetric` engine layer and named experiment directories.

The approved scientific layering is:

1. Generic Chemistry core for apparatus capabilities, containment, material/species amounts, liquid volume, capacity, transfers, mixing, bounded heating, derived quantities, and invariant validation.
2. Small solution-preparation mechanics composed from core actions; named oxalic-acid and Mohr's-salt preparations remain experiment-specific rather than generic core concepts.
3. Reusable volumetric-analysis mechanics for delivery, trial readings, equivalence progress, endpoint/overshoot classification, and repeat-trial state.
4. Permanganate experiment behavior for reaction stoichiometry, sulfuric-acid requirements, heating conditions, self-indication, observations, and quantitative results.

**Rationale**

The structure keeps reusable laboratory state independent of titration assumptions while avoiding a universal workflow or reaction framework. Plain TypeScript and a UI-free test runner are sufficient for independent Chemistry development. Shared-looking frontend configuration is provisional branch infrastructure and will be reconciled with Physics and UI/UX during integration.

Preparation and titration will form one coherent state chain. Incorrect mass, material, dilution, or preparation procedure will not be silently corrected; the resulting solution state will propagate into titration and may invalidate the quantitative result.

**Files added/modified**

- `frontend/package.json`
- `frontend/package-lock.json` (generated during tooling installation)
- `frontend/.gitignore`
- `frontend/tsconfig.json`
- `frontend/src/engines/chemistry/index.ts`
- Chemistry engine directory placeholders for `core`, `preparation`, `volumetric`, `permanganate`, and tests
- Chemistry experiment directory placeholders for both approved experiments
- Removed the inherited empty `frontend/src/engines/chemistry/titration/` and `frontend/src/experiments/chemistry/titration/` placeholders
- `docs/chemistry/DEVELOPMENT_LEDGER.md`

**Interfaces/contracts affected**

No scientific interfaces are implemented in Stage 1. The empty Chemistry public module establishes only the future export boundary. Planned public semantics remain immutable action transitions returning `VALID`, `WARNING`, or `BLOCKED` outcomes, typed next state, messages, and observations.

**Scientific assumptions**

- Fundamental stored quantities will include amount in mol, volume in L, measured preparation mass in g where required, and temperature in degrees Celsius.
- Mass is an input measurement; amount is derived from configured molar mass. Concentration and strength are derived rather than independently writable.
- Oxalic-acid titration uses the acidic permanganate/oxalate stoichiometry, requires sulfuric-acid medium, and uses bounded warm-condition behavior rather than thermal physics or reaction kinetics.
- Mohr's-salt titration uses the acidic permanganate/Fe2+ stoichiometry and proceeds at room temperature under the supported model.
- KMnO4 is a self-indicator; equivalence, a small persistent endpoint excess, and overshoot are distinct states.
- No spill behavior is modeled; capacity overflow will be blocked.

**Tests/verification performed**

- `npm install`: completed successfully; 45 packages added, 46 packages audited, and 0 vulnerabilities reported.
- `npm run typecheck`: passed using TypeScript 6.0.2 with no emitted files.
- `npm test`: passed using Vitest 4.1.11 with the Stage 1 `--passWithNoTests` default and confirmed the test runner starts correctly. No scientific tests exist in Stage 1 by design.
- TypeScript compilation explicitly uses only the ES2023 library; DOM/browser globals are excluded from the Chemistry development environment.
- Scientific behavior and scientific tests begin only in later approved stages.

**Known limitations**

- No Chemistry behavior or scientific domain type is implemented in Stage 1.
- Tooling configuration and lockfile are provisional and not the final shared GALILEO frontend configuration.
- No UI adapter, persistence, renderer, or shared cross-subject engine abstraction is introduced.
- Detailed kinetic, thermal, meniscus, spill, measurement-uncertainty, and universal reaction behavior remain deliberately outside scope.

**Pending/next steps**

Stop for review after tooling verification. With further approval, Stage 2 will define generic Chemistry state, types, numerical invariants, and their tests without implementing named experiment procedures in the core.
