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

### 2026-08-23 16:51:50 +05:30 — Stage 2 generic Chemistry domain foundation

**Decision/change**

Introduced the experiment-agnostic Chemistry domain foundation: stable material and apparatus definitions, mutable scientific vessel state expressed as readonly serializable data, generic future action contracts, action outcomes/messages, numeric guards, and structured configuration/state invariant validation.

Canonical property units are explicit: amount in `amountMol`, liquid volume in `volumeL`, mass in `massG`, temperature in `temperatureC`, molar mass in `molarMassGPerMol`, and capacity in `capacityL`. Concentration is not stored and will be derived later from amount and volume without rounding core state.

**Rationale**

Plain objects and readonly `Record` collections are JSON-friendly, deterministic, easy to inspect, and suitable for later immutable transitions. Record keys are the canonical material, apparatus, and vessel IDs; nested IDs are deliberately absent. Stable chemical/apparatus definitions are held in `ChemistryConfiguration`, while current dissolved and undissolved amounts, bulk liquid volume, and temperature are held in `ChemistryState`.

Every vessel uses one coherent contents representation. Empty vessels use zero volume and empty amount records; weighed solid is stored in `undissolvedAmountsMol`; transferable solution material is stored in `dissolvedAmountsMol`. This avoids nullable contents while not conflating mixing, dissolution, or transferability.

**Files added/modified**

- `frontend/src/engines/chemistry/core/types.ts`
- `frontend/src/engines/chemistry/core/numeric.ts`
- `frontend/src/engines/chemistry/core/validation.ts`
- `frontend/src/engines/chemistry/core/index.ts`
- `frontend/src/engines/chemistry/index.ts`
- `frontend/src/engines/chemistry/__tests__/numeric.test.ts`
- `frontend/src/engines/chemistry/__tests__/validation.test.ts`
- `frontend/src/engines/chemistry/__tests__/contracts.test.ts`
- Removed `frontend/src/engines/chemistry/core/.gitkeep`
- Removed `frontend/src/engines/chemistry/__tests__/.gitkeep`
- `docs/chemistry/DEVELOPMENT_LEDGER.md`

**Interfaces/contracts affected**

- Added lightweight `ApparatusId` and `MaterialId` aliases.
- Added immutable `ChemicalMaterialDefinition`, `ApparatusDefinition`, and `ChemistryConfiguration` contracts.
- Added `MixtureState`, `VesselState`, and `ChemistryState` as mutable-domain-state shapes represented with readonly TypeScript properties. Mixture state separates dissolved from undissolved molar amounts.
- Added future `CoreAction` discriminants for `add-material`, `transfer-liquid`, `mix`, and `heat`; no behavior executes these actions in Stage 2.
- Added `ActionOutcome` with `VALID`, `WARNING`, and `BLOCKED`, plus UI-neutral `ChemistryMessage` and `CoreActionResult` contracts.
- Added structured `StateValidationIssue` results and non-throwing configuration/state validation APIs suitable for typed persisted or adapter-provided data.
- Exported stable contracts and validation entry points through the Chemistry public barrels. Numeric helper implementation remains internal to the core until another layer needs it.

Action outcome remains distinct from future preparation or trial validity. The core contains no reset, repeat, trial, titrant, endpoint, equivalence, or named-experiment action.

**Scientific assumptions**

- Chemical definitions use a finite positive molar mass in g/mol; mutable mixtures reference definitions by material ID rather than duplicating metadata.
- Dissolved and undissolved material records store nonnegative finite molar amounts. Zero is valid during validation; successful future operation outputs will omit exact-zero entries. No near-zero tolerance normalization is performed.
- Liquid volume is finite and nonnegative and may equal, but not exceed, configured apparatus capacity.
- `volumeL` is total bulk liquid volume. Bulk solvent water is not normally duplicated in material amount records unless a bounded future calculation explicitly needs its chemical amount.
- Apparatus capacity is stable configuration and must be finite and positive.
- Vessel temperature must be finite. Stage 2 imposes no experiment-specific temperature range.
- Generic `mix` remains an action contract but has no generic homogeneity flag and does not imply that every material dissolves.
- No scientific values are rounded in core state.

**Tests/verification performed**

- `npm run typecheck`: passed under strict TypeScript with ES2023 libraries and no DOM globals.
- `npm test`: 3 test files passed, 41 tests passed after the linked Stage 2 correction below.
- Numeric tests cover finite, NaN, positive/negative infinity, negative, zero, nonnegative, and positive-only behavior.
- Validation tests cover valid/empty vessels, solid-only and liquid-plus-undissolved contents, dissolved solutions, the bulk-solvent policy, exact capacity, invalid capacity, overflow, invalid volume, invalid temperature, malformed IDs, unknown materials/apparatus, invalid molar amounts, malformed apparatus metadata, natural JSON serialization, and validation immutability.
- Contract tests exercise every generic action discriminant and the outcome/message result shape without implementing action behavior.

**Known limitations**

- Validation accepts typed `ChemistryState` and `ChemistryConfiguration`; a full schema parser for completely untyped external input is not introduced.
- Detailed scientific observations are deferred until the first stage that produces concrete observations. No speculative observation ontology was added.
- No floating-point residue normalization exists. A tolerance may be introduced only with a concrete later operation and documented scale.
- Apparatus kinds are intentionally limited to the five approved engine-relevant vessels. Balance mechanics and visual/support apparatus remain outside core state.
- `MixtureState` distinguishes only dissolved from undissolved inventory; it does not model a general phase system, precipitation objects, gas containment, activity, or molecular structure.

**Pending/next steps**

Stop for Stage 2 review. With approval, Stage 3 may implement generic material addition, liquid transfer, mixing, and derived quantity behavior using these contracts and invariants. It must not introduce named preparation or titration chemistry into the core.

#### Linked Stage 2 correction — 2026-08-23 17:04:51 +05:30

**Decision/change**

Corrected the Stage 2 domain model before Stage 3 dependencies were introduced. Removed nested IDs from material definitions, apparatus definitions, and vessel state; record keys are now canonical identity. Renamed species terminology to material terminology so actual weighed hydrate/reagent identities can be configured by name and molar mass without a chemical ontology.

Replaced the single component map and generic homogeneity flag with `dissolvedAmountsMol` and `undissolvedAmountsMol`. Bulk liquid `volumeL` is independent of tracked chemical amounts, and solvent water is not recorded merely to account for solution volume. A generic `mix` action remains declared but does not itself assert homogeneity or universal dissolution.

**Rationale**

Nested IDs duplicated record identity and would have required every immutable operation to keep multiple values synchronized. The former homogeneity flag could not distinguish dissolved solute from solid still present and could have caused proportional liquid transfer to move undissolved material. The corrected representation supports standard-solution preparation and later liquid transfer without introducing phase simulation or solubility tables.

**Files added/modified**

- `frontend/src/engines/chemistry/core/types.ts`
- `frontend/src/engines/chemistry/core/validation.ts`
- `frontend/src/engines/chemistry/core/index.ts`
- `frontend/src/engines/chemistry/__tests__/numeric.test.ts`
- `frontend/src/engines/chemistry/__tests__/validation.test.ts`
- `frontend/src/engines/chemistry/__tests__/contracts.test.ts`
- `docs/chemistry/DEVELOPMENT_LEDGER.md`

**Interfaces/contracts affected**

- `SpeciesId` became `MaterialId`; `ChemicalSpeciesDefinition` became `ChemicalMaterialDefinition`.
- `ChemistryConfiguration.species` became `materials`.
- `CoreAction.add-material` and `ChemistryMessage` now reference material IDs.
- Apparatus, material, and vessel nested `id` properties were removed.
- `MixtureState.components` and `homogeneity` were replaced by dissolved and undissolved molar-amount records.
- The apparatus-kind runtime list is now the canonical constant from which `ApparatusKind` is derived.

**Scientific assumptions**

- Weighed solid will later enter undissolved inventory; mass will be converted to mol using the configured actual material molar mass.
- Dissolution will move bounded amounts from undissolved to dissolved inventory under preparation behavior, not through a universal solubility model.
- Only dissolved inventory will later be eligible for proportional liquid transfer.
- Exact zero is accepted as valid input state. Successful future operations will omit exact-zero entries, and missing lookups will mean zero. No generic near-zero tolerance exists.

**Tests/verification performed**

- `npm run typecheck`: passed.
- `npm test`: 3 files passed, 41 tests passed.
- Added coverage for both amount records, solid-before-solvent, liquid with undissolved material, bulk-solvent representation, material references, molar-mass bounds, negative zero, configuration/state JSON round trips, and validation nonmutation.

**Known limitations**

- No operations, dissolution behavior, proportional transfer, or zero-entry normalization is implemented in Stage 2.
- Arbitrary unknown JSON parsing remains deferred until an external persistence/UI boundary exists.

**Pending/next steps**

Stop for review. Stage 3 may use the corrected material inventories to implement generic operations, while leaving named preparation and titration behavior to their approved higher layers.

### Stage 3 — Generic material addition, liquid transfer, and derived concentration — 2026-08-23 17:14:37 +05:30

**Scope and decisions**

- Added immutable `addMaterial` and `transferLiquid` core operations plus the pure `getMolarConcentration` derived helper. They are exported from the low-level core module but are not yet exposed through the Chemistry subsystem façade.
- Material addition accepts mol or mass input. Mass is converted with the configured actual material molar mass, and all added material enters undissolved inventory. Addition does not change liquid volume, imply dissolution, or model solid displacement.
- Liquid transfer moves bulk liquid volume and every dissolved material proportionally. Undissolved inventory remains in its original vessel. Bulk solvent is represented by volume and is not manufactured as a material record.
- Molar concentration is derived as dissolved amount divided by bulk liquid volume. Missing dissolved material means zero; zero liquid volume returns `null` rather than infinity or an invented value.
- Successful outputs omit exact-zero and negative-zero inventory entries while retaining nonzero values without tolerance-based truncation or rounding.
- Blocked operations are atomic and return the original state reference. Successful operations preserve input objects, conserve transferred volume and dissolved material, and retain unrelated vessel references.
- Every core operation now validates the supplied configuration first and then validates the supplied state against it before action-specific checks. Invalid configuration or state produces a concise `BLOCKED` result with the exact original state reference, so operations no longer rely on an undocumented prevalidated-input assumption.

**Files added/modified**

- `frontend/src/engines/chemistry/core/operations.ts`
- `frontend/src/engines/chemistry/core/derived.ts`
- `frontend/src/engines/chemistry/core/types.ts`
- `frontend/src/engines/chemistry/core/index.ts`
- `frontend/src/engines/chemistry/index.ts`
- `frontend/src/engines/chemistry/__tests__/operations.test.ts`
- `frontend/src/engines/chemistry/__tests__/derived.test.ts`
- `docs/chemistry/DEVELOPMENT_LEDGER.md`

**Tests and verification**

- Added coverage for mol and mass addition, invalid inputs and references, malformed configuration/state rejection at the operation boundary, negative infinity, accumulated-amount overflow, exact-zero canonicalization, capacity and source-volume boundaries, full and partial multi-material transfer, destination accumulation, undissolved preservation, temperature preservation, conservation, nested-record immutability, stable blocked outcomes, bulk-solvent policy, and concentration edge cases.
- `npm run typecheck`: passed under the DOM-free ES2023 TypeScript configuration.
- `npm test`: 5 test files passed, 92 tests passed.
- `git diff --check`: passed. The Stage 3 source scan found no React/UI dependency or preparation, titration, or reaction behavior.

**Known limitations and deferred work**

- Transfer preserves the source's previous temperature and the destination's previous temperature independently. This is a bounded Stage 3 assumption; no thermal equilibration is modeled, and temperature/mixing/heating semantics must be resolved before temperature-dependent chemistry relies on transfer results.
- Binary floating-point can make a mathematically exact decimal capacity boundary such as `0.1 + 0.2` appear slightly greater than `0.3`. Stage 3 does not add an epsilon or silently round inputs; the final policy is deferred until volumetric measurement precision and experimental action granularity are defined.
- Generic `mix` and `heat` action contracts remain unimplemented. Dissolution, standard-solution preparation, named experiments, titration, reactions, endpoint/equivalence behavior, UI, and runtime integration remain deferred to approved later stages.

**Pending/next steps**

Stop for Stage 3 review. Stage 4 should resolve the approved preparation/mixing boundary and temperature semantics before building higher-level workflows on these generic primitives.

### Stage 4 — Generic solution-preparation mechanics — 2026-08-23 17:34:39 +05:30

**Scope and architecture**

- Added a separate preparation layer with definition, session history, actions, validation, immutable transitions, and derived result classification. It composes `ChemistryState`; it does not copy vessel inventory, volume, or temperature into preparation state.
- Preparation remains free-form within physical constraints. Measured mass and actual volume are never replaced with target values. A physically valid wrong mass, wrong volume, or configured wrong material is preserved so later classification describes what the student actually prepared.
- `PreparationState.measuredMassesG` is procedural history. Molar amounts in `ChemistryState` remain scientific inventory and the source of truth for actual mass-equivalent and concentration derivation.
- The preparation lifecycle is `in-progress` or `complete`. Derived validity is independently classified as `in-progress`, `on-target`, `off-target`, or `unusable`; action outcome remains the separate core `VALID`/`WARNING`/`BLOCKED` concept.

**Scientific and transition decisions**

- `add-material` delegates mass conversion and undissolved addition to core `addMaterial`, while recording the actual measured mass by material ID. Configured wrong material is allowed physically and remains present; a completed preparation containing it is `unusable`.
- A narrow preparation-only `add-external-solvent-volume` action explicitly adds bulk solvent from a reservoir outside the modeled apparatus system. It creates no water or solvent moles, requires no fake source vessel, enforces capacity, and preserves temperature and every tracked material amount. Provenance-sensitive movement continues to use core `transferLiquid`.
- Preparation `mix` uses the definition's explicit `dissolutionMode`. `complete-on-mix` moves all undissolved target material into its dissolved inventory when positive bulk liquid exists; `unsupported` blocks this transition. This bounded rule conserves amount, changes no volume or temperature, and never dissolves other materials generically.
- Completion records the student's chosen current volume; it does not dilute automatically to `targetVolumeL` or correct mass. A completed fully dissolved target-only solution is `on-target` when actual mass-equivalent and volume fall within definition tolerances, otherwise `off-target`. Wrong material, zero volume, missing target material, or remaining target material undissolved makes it `unusable`.
- Actual concentration is derived only from dissolved target amount divided by actual bulk liquid volume. Target mass and target volume do not enter this calculation. Unusable preparations expose concentration as unavailable (`null`).

**Precision policy**

- Numerical tolerance and experimental tolerance are separate. Core numeric helpers use `8 * Number.EPSILON` scaled to operand magnitude solely to absorb IEEE-754 representation noise. Computed capacity results numerically equal to the boundary are snapped to that boundary; genuine overflow remains blocked and scientific values are not globally rounded.
- Preparation definitions explicitly provide `massToleranceG` and `volumeToleranceL` in physical units. These configured values alone determine experimental on-target/off-target classification; zero means exact comparison. The IEEE helper is not used by preparation validity.
- Core `transferLiquid` now uses the same narrow capacity-boundary policy, resolving the documented Stage 3 `0.1 + 0.2` concern.

**Temperature model**

- Preparation addition, dissolution, and completion preserve vessel temperature. Dissolution heat, thermal equilibration, weighted source temperatures, and generic heating remain outside Stage 4. Temperature-dependent chemistry must not rely on these simplified transitions until a later bounded model defines it.

**Files added/modified/deleted**

- Added `frontend/src/engines/chemistry/preparation/types.ts`.
- Added `frontend/src/engines/chemistry/preparation/validation.ts`.
- Added `frontend/src/engines/chemistry/preparation/engine.ts`.
- Added `frontend/src/engines/chemistry/preparation/derived.ts`.
- Added `frontend/src/engines/chemistry/preparation/index.ts`.
- Added `frontend/src/engines/chemistry/__tests__/preparation.test.ts`.
- Modified `frontend/src/engines/chemistry/core/numeric.ts`.
- Modified `frontend/src/engines/chemistry/core/operations.ts`.
- Modified `frontend/src/engines/chemistry/core/index.ts`.
- Modified `frontend/src/engines/chemistry/__tests__/operations.test.ts`.
- Modified `docs/chemistry/DEVELOPMENT_LEDGER.md`.
- Removed the obsolete `frontend/src/engines/chemistry/preparation/.gitkeep` placeholder.

**Tests and verification**

- Added generic coverage for definition/session creation, measured-mass history, molar inventory, repeated additions, target-only dissolution, conservation, wrong-material preservation, solvent requirements, unsupported dissolution, bulk volume, capacity boundaries, genuine overflow, actual concentration, lifecycle and validity classifications, experimental versus numerical tolerance, malformed inputs, immutability, structural sharing, and post-completion blocking.
- `npm run typecheck`: passed.
- `npm test`: 6 test files passed, 124 tests passed.
- `git diff --check`: passed. Source scans found no React, Zustand, Konva, React Flow, DOM, UI, named-standard, titration, or reaction logic in the Stage 4 implementation.

**Known limitations and deferred work**

- The bounded model dissolves the definition's complete target inventory when mixed with positive bulk liquid; it has no solubility limit, dissolution rate, molecular solvent model, or heat-of-solution behavior.
- Bulk solvent addition does not record a source vessel or solvent identity. Workflows needing source-liquid provenance can compose core `transferLiquid` later.
- No spill, meniscus, balance, reset/repeat, universal workflow engine, or thermal model is introduced.
- Named standard-solution definitions, including oxalic-acid and Mohr's-salt preparations, are explicitly deferred. Heating, titration, reactions, endpoints, and equivalence behavior remain unimplemented.

**Pending/next steps**

Stop for Stage 4 review before adding any named standard-solution preparation definition.

#### Linked Stage 4 pre-commit correction — 2026-08-23 17:43:50 +05:30

**Decision/change**

- Removed IEEE-754 numerical tolerance from mass and volume target classification. Experimental validity now uses only `abs(actual - target) <= configuredTolerance`.
- Replaced ambiguous `dissolutionSupported` with `dissolutionMode: 'unsupported' | 'complete-on-mix'`, making complete instantaneous target-only dissolution an explicit bounded model choice.
- Renamed the solvent action to `add-external-solvent-volume`, explicitly identifying the solvent reservoir as outside the modeled apparatus boundary. The action still changes only bulk volume and preserves temperature and material inventory.
- Retained actual target inventory converted through configured molar mass as the authority for mass classification. Accumulated measured-mass history remains non-authoritative procedural history.
- Retained the closed lifecycle: every preparation action after completion is blocked with the exact original state.

**Tests and verification**

- Added coverage for exact zero experimental tolerances, nonzero physical tolerances, malformed tolerances and dissolution modes, repeated/idempotent mixing, dissolved contamination, high mass and volume, inconsistent history, malformed derivation input, every invalid external-solvent numeric input, repeated external additions, inventory/temperature preservation, and capacity excess immediately inside and outside numerical tolerance.
- `npm run typecheck`: passed. `npm test`: 6 files and 142 tests passed. `git diff --check`: passed. Source scans found no stale action/field names, UI dependencies, named preparation, heating, titration, or reaction behavior; the old field name remains only in this correction history.

### Stage 5 — Named standard oxalic-acid preparation — 2026-08-23 17:52:43 +05:30

**Scientific scope and configuration**

- Added the NCERT/CBSE Class XII standard-solution preparation for hydrated crystalline oxalic acid, represented by the canonical material ID `oxalic-acid-dihydrate` and display name `Oxalic acid dihydrate`.
- The weighed reagent is the dihydrate `(COOH)2·2H2O` represented by identity and molar mass only. Its configured molar mass is `126 g/mol`; no anhydrous substitution, formula parser, hydrate dissociation, or separate water-of-crystallization inventory was introduced.
- The named target is `0.1 mol/L` at the `0.250 L` calibration mark. The single configured target mass is `3.15 g`, from `0.1 mol/L × 0.250 L × 126 g/mol`.
- The named module supplies the material, apparatus, preparation definition, constants, initial scientific state, and narrow create/apply/derive facade. It delegates every transition and classification to the generic core and preparation layers and adds no new preparation mechanics.

**Prototype experimental assumptions**

- `massToleranceG` is `0.01 g` and `volumeToleranceL` is `0.001 L` (1 mL). These are explicit GALILEO prototype classification assumptions reflecting plausible simulation granularity; they are not official CBSE/NCERT tolerances or marking rules.
- Named validity uses only these configured physical tolerances. IEEE-754 numerical tolerance remains restricted to arithmetic capacity handling and does not alter experimental classification.
- `dissolutionMode` is `complete-on-mix`: after positive bulk solvent exists, mixing moves all target dihydrate inventory from undissolved to dissolved. This is the bounded generic preparation assumption, not a solubility or hydrate-reaction model.

**Actual-state and error propagation**

- The named facade never inserts target values into scientific state. Low/high mass, low/high final volume, repeated external-solvent additions, premature completion, and configured contamination remain represented exactly as performed within physical and lifecycle limits.
- Actual concentration continues to derive exclusively from actual dissolved dihydrate amount divided by actual bulk liquid volume. Measured-mass history remains procedural and cannot override molar inventory when validity is derived.
- Wrong but usable quantities classify `off-target`; wrong material, contamination, or target remaining undissolved at completion classify `unusable`. Attempts beyond modeled capacity are blocked atomically.

**Volumetric flask mark and capacity decision**

- The preparation definition retains `targetVolumeL: 0.250` as the calibration mark. The configured volumetric-flask `capacityL` is a bounded `0.300 L` GALILEO sandbox maximum so a student can over-dilute beyond the mark and still produce an off-target scientific state.
- `0.300 L` is not asserted to be the physical maximum of a real 250 mL flask. It is a prototype modeling boundary chosen to preserve meaningful over-mark error behavior without adding spill simulation.

**Files added/modified**

- Added `frontend/src/engines/chemistry/preparation/named/oxalic-acid.ts`.
- Added `frontend/src/engines/chemistry/preparation/named/index.ts`.
- Added `frontend/src/engines/chemistry/__tests__/oxalic-acid-preparation.test.ts`.
- Modified `docs/chemistry/DEVELOPMENT_LEDGER.md`.

**Tests and verification**

- Added named coverage for authoritative constants, dihydrate identity, molar-mass calculation, definition wiring, calibration-mark/capacity separation, correct preparation, staged solvent addition and dissolution, low/high mass, below/above-mark volume, actual concentration, capacity blocking, premature completion, contamination preservation, inventory authority, prototype tolerance behavior, and immutability.
- `npm run typecheck`: passed. `npm test`: 7 files and 157 tests passed. `git diff --check` and new-file whitespace checks passed. Source scans found no Mohr's-salt, titration, redox/reaction, heating, UI, or browser-runtime implementation in Stage 5.

**Known limitations and deferred work**

- The named preparation uses the generic complete-on-mix assumption and does not model dissolution rate, saturation, heat of solution, transfer losses, meniscus optics, balance mechanics, or spill behavior.
- The engine-side named module contains scientific configuration and behavior only. Objective, apparatus presentation, procedure, and guidance metadata remain deferred to the experiment layer.
- Mohr's-salt preparation, standardization context, volumetric trials, permanganate redox chemistry, heating, titration, endpoints, equivalence behavior, UI integration, and experiment registries remain explicitly unimplemented.

**Pending/next steps**

Stop for Stage 5 review before implementing any Mohr's-salt preparation or volumetric/titration behavior.

#### Linked Stage 5 tolerance-boundary correction — 2026-08-23 17:59:46 +05:30

**Problem and correction**

- Raw IEEE-754 subtraction made inclusive decimal experimental boundaries appear slightly larger than their configured physical tolerances. For example, `3.16 - 3.15` and `0.251 - 0.250` are not represented as exact decimal differences.
- Added preparation-only `isWithinExperimentalTolerance`. For a positive configured tolerance it infers the base-10 measurement scale expressed by that tolerance, scales actual, target, and tolerance numerically, and compares the resulting difference at that physical measurement scale. A zero tolerance retains exact `actual === target` semantics.
- This helper is solely an experimental classification policy. It does not call or reuse the core IEEE arithmetic tolerance, mutate or round stored `ChemistryState`, normalize inventory, or round concentration calculations.

**Boundary behavior and verification**

- With `0.01 g`, both `3.14 g` and `3.16 g` are inclusively on-target; `3.1399 g` and `3.1601 g` are off-target.
- With `0.001 L`, both `0.249 L` and `0.251 L` are inclusively on-target; `0.2489 L` and `0.2511 L` are off-target.
- Added generic helper coverage for zero, `0.01`, and `0.001` tolerances plus named oxalic-acid boundary regressions.
- `npm run typecheck`: passed. `npm test`: 7 files and 166 tests passed. `git diff --check` and new-file whitespace checks passed. Preparation classification contains no call to the core IEEE helper, and source scans found no Mohr's-salt, titration, heating, reaction, or UI behavior in this correction.

### Stage 6 — Named Mohr's-salt standard preparation — 2026-08-23 18:06:57 +05:30

**Scientific scope and configuration**

- Added the NCERT Class XII ferrous ammonium sulphate quantitative-analysis preparation as the named material `mohrs-salt-hexahydrate`, displayed as `Mohr's salt hexahydrate` and documented by formula `(NH4)2Fe(SO4)2·6H2O` (conventionally also written `FeSO4·(NH4)2SO4·6H2O`).
- The school-practical molar mass is `392 g/mol`. The named target is `0.05 mol/L` at `0.250 L`, giving `targetMassG: 4.90` from `0.05 × 0.250 × 392`. The 0.1 M/9.8 g alternative is not used for this workflow.
- The preparation reuses generic `complete-on-mix`, the corrected experimental measurement comparison, `0.01 g` and `0.001 L` GALILEO prototype tolerances, and the existing `0.250 L` mark / `0.300 L` sandbox-capacity convention. Neither the tolerances nor 0.300 L are claimed as official curriculum values or real flask maximums.

**Named acidification condition**

- The NCERT procedure's dropwise dilute sulfuric-acid conditioning is represented by `MohrsSaltPreparationState.acidificationPerformed`, composed around the generic `PreparationState`. No Mohr-specific field or action was added to Chemistry Core or generic preparation types.
- The named-only `acidify-with-dilute-sulfuric-acid` action records that the required conditioning step occurred. It creates no H2SO4 material amount, invents no acid volume, changes no bulk volume, target amount, temperature, dissolved concentration, or generic preparation history, and performs no acid dissociation, hydrolysis, oxidation, or reaction calculation.
- Acidification may occur before or after bounded dissolution while preparation remains in progress. Repetition is a stable valid no-op. Every action, including acidification, is blocked after completion with the exact original named state.
- A completed otherwise usable preparation without acidification is composed to `unusable` with `REQUIRED_ACIDIFICATION_MISSING`. Its mathematical dissolved concentration remains available and unchanged; the bounded model makes no claim about a specifically calculated degradation product or composition.

**Validity and actual-state propagation**

- Generic preparation remains authoritative for in-progress/on-target/off-target/unusable mass, volume, dissolution, contamination, and lifecycle classification. The named layer does not duplicate these calculations; it adds only the completed acidification requirement.
- Correct acidified preparation contains `4.90 / 392 = 0.0125 mol` in `0.250 L`, deriving `0.05 mol/L`. Wrong mass or actual volume propagates to off-target concentration, while contamination or undissolved target remains unusable. No values are auto-corrected.

**Files added/modified**

- Added `frontend/src/engines/chemistry/preparation/named/mohrs-salt.ts`.
- Added `frontend/src/engines/chemistry/__tests__/mohrs-salt-preparation.test.ts`.
- Modified `frontend/src/engines/chemistry/preparation/named/index.ts`.
- Modified `frontend/src/engines/chemistry/preparation/numeric.ts` to canonicalize only integer-scale decimal conversion noise exposed by the 4.89 g boundary; this does not widen configured experimental tolerance.
- Modified `docs/chemistry/DEVELOPMENT_LEDGER.md`.

**Tests and verification**

- Added named coverage for material/formula identity, all target constants, definition wiring, correct preparation, bounded dissolution, acidification performed/omitted, concentration independence, idempotence, lifecycle closure, low/high mass and volume, over-mark and over-capacity behavior, undissolved completion, contamination, exact experimental boundaries, and nested immutability.
- `npm run typecheck`: passed. `npm test`: 8 files and 189 tests passed. `git diff --check` and new-file whitespace checks passed. Explicit generic-core/preparation scans found no Mohr-specific state, action, acidification, or sulfuric-acid reference; Stage 6 source scans found no titration, permanganate reaction, heating, endpoint, UI, or browser dependency behavior.

**Known limitations and deferred work**

- Acidification is an intentionally unquantified named procedural/scientific condition. Exact sulfuric-acid volume or amount, pH, equilibria, hydrolysis, Fe2+ oxidation, and resulting chemical species are not modeled.
- Complete-on-mix remains a bounded school-lab dissolution assumption without solubility, saturation, rate, or temperature behavior.
- Titration trials, permanganate redox chemistry, heating, endpoint/equivalence behavior, experiment guidance, UI integration, and registries remain unimplemented.

**Pending/next steps**

Stop for Stage 6 review before introducing any volumetric/titration behavior.

### Stage 7 — Generic vessel heating — 2026-08-23 18:12:41 +05:30

**Scope and API**

- Added the focused low-level core operation `heatVessel(configuration, state, action)` and extracted the existing inline heat action contract into the named `HeatAction` type. Both are exported only from the low-level Chemistry core barrel; the subject facade and preparation layers remain unchanged.
- `VesselState.temperatureC` remains the sole temperature source of truth. Successful heating replaces only the affected vessel, preserves its `contents` reference exactly, changes only `temperatureC`, and retains unrelated vessel references.

**Validation and transition semantics**

- Heating follows the existing core operation boundary: validate `ChemistryConfiguration`, then `ChemistryState`, then action references and numerics. Malformed input, unknown/missing apparatus state, non-finite target, or unsupported heating returns `BLOCKED` with the exact original state.
- `supportsHeating` is required. Stable codes added are `HEATING_NOT_SUPPORTED`, `INVALID_TARGET_TEMPERATURE`, and `TARGET_BELOW_CURRENT_TEMPERATURE`; existing invariant/reference codes are reused where appropriate.
- Heat is semantically directional. A target below current temperature is blocked because cooling is not implemented. A target exactly equal to current temperature is a deterministic `VALID` no-op returning the original state reference. A higher finite target is stored exactly without rounding.
- Negative Celsius values are not rejected based on sign: heating from a lower negative temperature to a higher negative temperature is valid. Very large finite targets are also accepted because the current apparatus definition has no modeled maximum-temperature field and Stage 7 does not invent universal chemical or glassware limits.

**Bounded thermal model**

- Heating directly sets vessel temperature state. No duration, heater power, flame, heat capacity, thermal energy, heat loss, cooling, phase change, or temperature-dependent reaction behavior is modeled.
- `transferLiquid` remains unchanged: source and destination retain their prior vessel temperatures and no energy balance or weighted thermal equilibration is performed. This is an explicit prototype abstraction, not detailed physical heat-transfer simulation.
- Standard-solution preparation and named oxalic/Mohr validity remain temperature-independent. Future named experiments may interpret current vessel temperature, but no named temperature requirement exists in core.

**Files added/modified**

- Added `frontend/src/engines/chemistry/__tests__/heating.test.ts`.
- Modified `frontend/src/engines/chemistry/core/types.ts`.
- Modified `frontend/src/engines/chemistry/core/operations.ts`.
- Modified `frontend/src/engines/chemistry/core/index.ts`.
- Modified `docs/chemistry/DEVELOPMENT_LEDGER.md`.

**Tests and verification**

- Added coverage for successful heating, exact target storage, contents/reference preservation, immutability, equality no-op, lower-target rejection, unsupported/unknown/missing apparatus, all non-finite targets, malformed configuration/state, negative-Celsius heating, and very large finite targets.
- `npm run typecheck`: passed. `npm test`: 9 files and 203 tests passed. `git diff --check` and new-file whitespace checks passed. Source scans found no named reagent/titration, permanganate, reaction, kinetics, endpoint, UI, or browser dependency behavior in Stage 7.

**Known limitations and deferred work**

- No generic maximum temperature is modeled. Named layers must impose useful/safe ranges if their bounded experiment requires them; actual apparatus thermal ratings are not claimed.
- Cooling, thermal equilibration, temperature history, observation ontology, kinetics, reactions, titration, endpoints, and UI integration remain unimplemented.

**Pending/next steps**

Stop for Stage 7 review. The next approved stage may introduce generic volumetric/titration mechanics without embedding named permanganate chemistry into core.

### Stage 8 — Generic volumetric mechanics — 2026-08-23 18:21:00 +05:30

**Boundary and state design**

- Added a reusable volumetric layer that records instrument readings and trial lifecycle while delegating actual liquid/material movement to Chemistry core. It contains no reaction, reagent, endpoint, equivalence, or scientific trial-quality interpretation.
- `VolumetricTrialState` stores only lifecycle status plus initial/current burette readings in millilitres. Delivered volume is derived as current minus initial, avoiding a third mutually derivable stored value. Arbitrary valid initial readings are supported, including nonzero starts between repeated trials.
- Trial state remains separate from `ChemistryState`, `VesselState`, and `MixtureState`. `VolumetricState` composes Chemistry state with one current trial solely to make delivery transitions atomic and JSON-friendly.

**Burette and unit integration**

- `VolumetricConfiguration` references the configured burette and delivery-target apparatus IDs. The burette's existing core `ApparatusDefinition.capacityL` is the single physical/range source of truth; the volumetric layer converts it to the maximum displayed reading in mL and does not duplicate a `maxReadingMl` value.
- Actual burette contents, dissolved inventory, and undissolved inventory remain solely in its core vessel state. `deliverFromBurette` validates the reading transition before calling core `transferLiquid`; a rejected reading leaves Chemistry state untouched, and a rejected core transfer leaves the reading untouched with the exact original composite state reference.
- Chemistry core volume remains litres and displayed volumetric readings remain millilitres. `mlToL` and `lToMl` provide the explicit `1 mL = 0.001 L` conversion without measurement rounding or instrument-resolution snapping.

**Lifecycle and APIs**

- Added `createVolumetricState`, `startVolumetricTrial`, `deliverFromBurette`, `completeVolumetricTrial`, and `getDeliveredVolumeMl`, plus focused configuration/state validation and unit helpers.
- Completion means only that the learner ended mechanical delivery. It freezes readings and blocks later delivery; it does not assert endpoint, equivalence, concordance, overshoot, validity, or usability.
- Repeat/history management is intentionally external: callers retain a completed trial if desired, wrap the retained Chemistry state in a fresh `createVolumetricState`, and start at any valid new burette reading. No trial arrays, averaging, or concordance logic were introduced.

**Measured aliquot decision**

- No separate pipette or measured-transfer operation was added. Existing core `transferLiquid`, combined with `mlToL`, already enforces positive finite volume, source availability, destination capacity, proportional dissolved-material movement, undissolved-material retention, immutability, and atomic failure. A duplicate wrapper would add no instrument state or mechanics at this stage.

**Files and verification**

- Added `frontend/src/engines/chemistry/volumetric/{types,validation,engine,derived,numeric,index}.ts` and replaced the directory placeholder.
- Added `frontend/src/engines/chemistry/__tests__/volumetric.test.ts` covering zero/arbitrary/nonzero trial starts, invalid readings, derived delivery, repeated delivery, exact and exceeded range, invalid delivery values, core inventory/proportional transfer behavior, undissolved retention, source/destination atomic failures, completion, post-completion blocking, repeats, structural sharing, and explicit unit conversion.
- `npm run typecheck`: passed. `npm test`: 10 files and 229 tests passed.

**Assumptions, limitations, and next stage**

- A core burette vessel is assumed to have been filled through ordinary core composition before delivery. Filling technique, meniscus reading, droplets, rinsing, precision increments, and refill behavior are not simulated.
- One configuration targets one receiving apparatus during a trial. Higher layers may compose generic measured aliquot transfer and burette delivery around their own apparatus topology without changing this layer.
- The mechanical API can be reused unchanged for Mohr's-salt/permanganate, oxalic-acid/permanganate, or future acid-base trials because it knows only apparatus IDs, volumes, readings, and lifecycle. Stage 9 may add named scientific interpretation above this boundary without moving it into generic volumetric code.

### Stage 9 — Shared permanganate observation semantics — 2026-08-23 18:28:00 +05:30

**Purpose and architectural boundary**

- Added a narrow shared permanganate specialization because both approved named titration families use dissolved permanganate as a self-indicating titrant. The layer derives persistent-excess observations while reusing Stage 8 volumetric state unchanged.
- Stage 9 is pure derivation: it performs no liquid transfer, burette transition, reaction mutation, trial completion, or ChemistryState update. Actual dissolved titrant inventory is read from the volumetric delivery-target vessel in `ChemistryState`; readings and delivered volume remain exclusively owned by the generic volumetric layer.
- No extra shared state was introduced. Endpoint, overshoot, excess, equivalence satisfaction, and trial assessment are returned derived values rather than persisted flags or counters.

**Named-reaction boundary**

- Future named reaction engines provide `PermanganateReactionProgress`, containing only `consumedPermanganateMol` and `remainingReactiveCapacityMol`. This layer does not calculate either fact, any reaction equation, coefficient, analyte identity, acid prerequisite, temperature prerequisite, or final concentration.
- Shared derivation obtains actual dissolved permanganate from ChemistryState, calculates excess as actual minus named-consumed inventory, and rejects impossible progress such as consumption beyond actual inventory or simultaneous positive excess and remaining reactive capacity.
- This contract lets different named reactions calculate their own chemically honest capacity while sharing the same self-indicator semantics. ChemistryState is not mutated with invented reacted species or a second reduced-inventory counter before a named reaction model exists.

**Equivalence, endpoint, and overshoot**

- Equivalence and endpoint remain distinct. Zero remaining named reactive capacity means equivalence is satisfied, but zero permanganate excess remains `decolorized` / `before-endpoint` because no persistent positive self-indicator excess exists.
- A positive excess up to and including the configured allowance derives `endpoint`. Excess above the allowance derives `overshot`. Remaining reactive capacity with no excess derives `decolorized` / `before-endpoint`.
- Observation never automatically completes a volumetric trial. The learner may stop before endpoint, at endpoint, or after overshoot, and may continue delivering after first observing endpoint until the generic trial is mechanically completed.

**Threshold policy and configuration**

- `PermanganateTitrationConfiguration` requires a configured titrant material ID and `endpointExcessAllowanceMol`. The material must exist and the allowance must be finite and nonnegative.
- Stage 9 defines no numeric endpoint allowance. Future named prototype configurations must choose and document their value as a GALILEO simulation assumption, not an official NCERT/CBSE numeric interpretation of faint permanent pink.
- The shared implementation does not require solid permanganate weighing or molar mass. Test fixtures include an ordinary core material definition only because ChemistryConfiguration requires configured material identity.

**Files, APIs, and verification**

- Added `frontend/src/engines/chemistry/permanganate/{types,validation,derived,index}.ts`.
- Added `frontend/src/engines/chemistry/__tests__/permanganate.test.ts`.
- Public APIs are `derivePermanganateIndicatorState`, `derivePermanganateTrialAssessment`, `validatePermanganateConfiguration`, and `validatePermanganateAssessmentInput`, with focused configuration, progress, indicator, assessment, and result contracts.
- Tests cover known/missing material configuration, zero and invalid allowances, invalid/inconsistent reaction progress, remaining capacity, exact equivalence, positive endpoint excess, inclusive allowance, overshoot, active/completed mechanical trials, non-completion, immutability, and absence of duplicated volumetric state.
- `npm run typecheck`: passed. `npm test`: 11 files and 250 tests passed.

**Limitations and next stage**

- The model intentionally has no colour intensity, persistence timing, fading, droplet mechanics, generic indicator chemistry, reaction products, acidic-medium validation, or reaction-state transition.
- A zero configured allowance is structurally valid but makes every positive excess overshot; named definitions wanting an observable endpoint band should configure a positive allowance.
- The next named Mohr's-salt titration stage must derive reaction progress from actual analyte/titrant state, define its own acidic-medium and stoichiometric rules, choose and disclaim its endpoint allowance, and preserve the separation between reaction assessment, shared observation, and mechanical completion.

### Stage 10 — Named Mohr's-salt permanganate titration — 2026-08-23 18:36:00 +05:30

**Scientific workflow and named boundary**

- Added the first named reaction/titration engine for permanganate against standard ferrous ammonium sulphate (Mohr's-salt) solution in sulphuric-acid medium. The bounded NCERT workflow uses a `10 mL` aliquot of nominal `0.05 mol/L` standard and approximately `5 mL` of `1.0 mol/L` sulphuric acid in the conical flask.
- The named reaction is `MnO4- + 5 Fe2+ + 8 H+ → Mn2+ + 5 Fe3+ + 4 H2O`. Its `1:5` permanganate/reactive-iron stoichiometry and the mapping `1 mol dissolved Mohr's salt → 1 mol reactive Fe2+` exist only in the named Mohr engine.
- No heating prerequisite or temperature threshold is applied. Air oxidation, kinetics, pH, acid equilibria, ionic strength, alternative products, and reaction-product inventories remain outside this bounded model.

**Actual-state setup and acid model**

- `createMohrsSaltTitration` composes the completed preparation vessel with a named burette, conical flask, and acid-source vessel. `prepareMohrsSaltTitrationAliquot` delegates the actual `10 mL` move to core `transferLiquid` through `mlToL(10)`; it never creates nominal analyte moles.
- The titration acid addition is separate from the Stage 6 preparation-conditioning flag. The acid source contains actual dissolved `sulfuric-acid` inventory: `0.005 L × 1.0 mol/L = 0.005 mol`. The named bounded criterion requires at least `0.005 mol` in the trial flask. It does not model dissociation or claim that this is a general acid-reaction engine.
- Missing or insufficient titration acid does not block physically possible burette delivery. It makes intended quantitative reaction interpretation unsupported and the named result unusable, while preserving all transferred inventory.

**Reaction progress and reuse**

- Reaction progress is derived without mutating raw reactants or inventing products. Actual reactive iron is the dissolved Mohr-salt amount currently transferred into the trial flask. Maximum consumable permanganate is actual reactive iron divided by five; consumption is the lesser of actual delivered permanganate and that capacity, and remaining capacity is the positive remainder.
- Stage 8 remains responsible for arbitrary initial readings, incremental delivery, actual liquid/material transfer, completion, immutability, and range validation. Stage 9 remains responsible for decolorized/endpoint/overshot classification. The named layer neither duplicates nor forks those mechanics.
- Off-target but chemically usable preparation proceeds using its actual aliquot inventory. Unusable preparation provenance, including omitted preparation conditioning or unusable generic preparation state, makes the named quantitative result unusable rather than auto-correcting it.

**Hidden titrant truth, endpoint assumption, and learner result**

- The prototype burette is filled with `0.050 L` of internally configured `0.01 mol/L` KMnO4. This is hidden simulation truth, not a learner-known value or an NCERT-prescribed unknown concentration. For a correct aliquot, actual `0.0005 mol Fe2+` gives a derived `0.0001 mol` permanganate capacity and approximately `10 mL` equivalence scale.
- The named endpoint allowance is `5×10^-7 mol`, corresponding to `0.05 mL` of the prototype `0.01 mol/L` titrant. It is a deterministic GALILEO display/simulation assumption for slight persistent excess, not an official NCERT/CBSE definition of permanent light pink.
- A learner-calculated result is returned only for a mechanically completed endpoint trial and uses the intended standard assumption: `(0.05 mol/L × 0.010 L) / (5 × recorded titre L)`. It does not silently substitute actual off-target analyte concentration. Consequently a wrongly prepared but chemically usable standard changes actual equivalence while producing a learner result that differs from hidden actual titrant truth for the correct educational reason.

**Usability, files, and verification**

- Named usability is `in-progress`, `usable`, `overshot`, `stopped-early`, or `unusable`. Only an acid-supported, non-unusable source completed at shared endpoint is accepted as `usable`; early, overshot, missing-acid, and unusable-source trials return no learner concentration.
- Added `frontend/src/engines/chemistry/permanganate/named/mohrs-salt.ts` and its named barrel, plus `frontend/src/engines/chemistry/__tests__/mohrs-salt-titration.test.ts`.
- Added focused facade APIs for creation, aliquot transfer, acid transfer, start, incremental delivery, completion, reaction-progress derivation, and named result derivation.
- Tests cover centralized constants, actual setup inventories, actual aliquot transfer, correct `0.0005 mol` reactive iron and `0.0001 mol` capacity, limiting conditions, incremental readings, equivalence/endpoint/overshoot, independent completion, missing/insufficient acid, unusable preparation, off-target propagation, hidden versus learner result, acceptance rules, and immutability.
- `npm run typecheck`: passed. `npm test`: 12 files and 259 tests passed.

**Limitations and next stage**

- Reaction progress is an instantaneous derived interpretation of transferred starting inventory. No products, rate, mixing delay, acid consumption, air oxidation, colour intensity, persistence time, or concordance/averaging are modeled.
- The named factory currently uses the canonical Mohr preparation configuration and fixed prototype apparatus. Higher experiment composition may expose controlled setup variants later without moving named chemistry into shared layers.
- The next oxalic-acid titration must supply its own stoichiometry, temperature prerequisite, acid policy, and reaction progress while reusing generic volumetric and shared permanganate observation unchanged.

### Stage 11 — Named oxalic-acid permanganate titration — 2026-08-23 18:44:00 +05:30

**Scientific workflow and named boundary**

- Added the NCERT Class XII named titration of a `10 mL` nominal `0.1 mol/L` oxalic-acid standard against permanganate after adding approximately `5 mL` of `1.0 mol/L` sulphuric acid and heating the trial mixture to `50–60 °C`.
- The named equation is `2 MnO4- + 5 C2O4^2- + 16 H+ → 2 Mn2+ + 10 CO2 + 8 H2O`. Only this named engine contains the `2:5` permanganate/oxalate stoichiometry and the bounded mapping `1 mol dissolved oxalic-acid dihydrate → 1 mol reactive oxalate-equivalent substrate`.
- Generic core, volumetric mechanics, and shared permanganate observation remain unchanged. No general dissociation/species ontology, generic reaction engine, kinetics, autocatalysis, catalyst buildup, induction period, or product-state mutation was introduced.

**Actual aliquot, acid, and temperature models**

- The aliquot helper delegates an actual `10 mL` transfer from the prepared source vessel through core `transferLiquid` and `mlToL`. Actual dissolved oxalic-acid-dihydrate inventory in the receiving flask—not `0.1 × 0.010`—is the reaction authority.
- The acid source contains actual `0.005 mol` dissolved sulphuric acid in `0.005 L`. At least that amount must be present in the trial flask. Missing/insufficient acid preserves physical delivery but makes intended reaction interpretation unsupported; no alternative products are invented.
- `heatOxalicAcidTitration` is a thin immutable wrapper around core `heatVessel`. The current flask temperature is the only authority: `50.0–60.0 °C` inclusive is supported, below 50 gives `TEMPERATURE_TOO_LOW`, and above 60 gives `TEMPERATURE_TOO_HIGH`. There is no `wasHeated` flag, numerical widening, cooling model, or rate calculation.

**Reaction progress and CO2 observation**

- Pure progress derives capacity as actual reactive oxalate multiplied by `2/5`, consumed permanganate as the lesser of actual delivered inventory and capacity, and remaining capacity as the positive difference. Shared Stage 9 derives excess, decolorized state, endpoint, and overshoot.
- For the correct aliquot, tests derive `0.001 mol` substrate and `0.0004 mol` permanganate capacity; neither is hard-coded in production.
- `generatedCo2Mol` is a named pure observation equal to consumed permanganate multiplied by five, with `co2EvolutionExpected` derived from positivity. No gas material, gas volume, bubbles, pressure, or ChemistryState mutation is added.

**Shared prototype assumptions and learner calculation**

- Extracted only the now-genuinely-shared named prototype constants into `permanganate/named/prototype.ts`: hidden actual KMnO4 concentration `0.01 mol/L` and endpoint allowance `5×10^-7 mol` (equivalent to `0.05 mL` of prototype titrant), plus common material IDs. The Mohr named API retains its prior exported material identities and behavior.
- Both values remain GALILEO simulation/display assumptions, not learner-known answers or official NCERT/CBSE values. The correct oxalic trial has an approximately `40 mL` equivalence scale within the 50 mL burette.
- Learner calculation is returned only for a completed supported endpoint trial and uses `(2 × nominal 0.1 mol/L × 0.010 L) / (5 × actual recorded titre L)`. Hidden actual titrant truth remains separate. Off-target usable preparation shifts actual endpoint through real inventory while the nominal textbook calculation becomes wrong, demonstrating error propagation without auto-correction.

**Usability precedence, files, and verification**

- Scientific invalidity dominates observable/mechanical classification: unusable source, insufficient acid, or out-of-range current temperature produces `unusable` and no shared endpoint or learner result. Otherwise an active trial is `in-progress`; completed shared endpoint is `usable`, shared overshoot is `overshot`, and completion while decolorized is `stopped-early`.
- Added `frontend/src/engines/chemistry/permanganate/named/oxalic-acid.ts`, `frontend/src/engines/chemistry/permanganate/named/prototype.ts`, and `frontend/src/engines/chemistry/__tests__/oxalic-acid-titration.test.ts`; updated the named barrel and Mohr module to consume shared prototype constants.
- Added facade APIs for creation, actual aliquot/acid transfer, heating, trial start, incremental delivery, completion, reaction-progress derivation, and named result derivation.
- Tests cover constants, sharing, correct capacity, limiting conditions, equivalence, endpoint/overshoot, CO2 derivation, all temperature boundaries, core heating delegation, acid conditions, precedence, full incremental workflow, off-target propagation, unusable preparation, early completion, overshoot, and immutability.
- `npm run typecheck`: passed. `npm test`: 13 files and 275 tests passed.

**Limitations and next stage**

- The supported reaction is an instantaneous derived interpretation when acid and current temperature prerequisites are satisfied. No duration, cooling, heat loss, acid consumption, reaction products, gas behavior, colour persistence, kinetics, or autocatalysis is modeled.
- Single-trial results only are supported; concordance, averaging, experiment/UI composition, and learner-facing hiding of simulation truth remain integration work.
- Final Chemistry integration should review named-factory configuration extensibility, facade exposure, result presentation boundaries, and whether a small isolated concordance stage is later justified without changing the engines completed here.
