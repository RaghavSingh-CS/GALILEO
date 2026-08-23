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
