import { describe, expect, it } from 'vitest';
import type { PreparationAction, PreparationState } from '../preparation';
import {
  applyOxalicAcidPreparationAction,
  createOxalicAcidPreparation,
  OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  OXALIC_ACID_PREPARATION_SPEC,
} from '../preparation/named';
import {
  addOxalicAcidTitrationAcid,
  applyOxalicAcidTitrationDelivery,
  completeOxalicAcidTitration,
  createOxalicAcidTitration,
  deriveOxalicAcidReactionProgress,
  deriveOxalicAcidTitrationResult,
  heatOxalicAcidTitration,
  MOHRS_SALT_TITRATION_SPEC,
  OXALIC_ACID_TITRATION_SPEC,
  OXALIC_TITRATION_FLASK_ID,
  POTASSIUM_PERMANGANATE_MATERIAL_ID,
  prepareOxalicAcidTitrationAliquot,
  PROTOTYPE_ENDPOINT_EXCESS_ALLOWANCE_MOL,
  PROTOTYPE_PERMANGANATE_MOLARITY_MOL_PER_L,
  startOxalicAcidTitration,
  SULFURIC_ACID_MATERIAL_ID,
} from '../permanganate/named';
import type { OxalicAcidTitrationState } from '../permanganate/named';

function applyPreparation(
  state: PreparationState,
  action: PreparationAction,
): PreparationState {
  const result = applyOxalicAcidPreparationAction(state, action);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function preparation(
  massG: number = OXALIC_ACID_PREPARATION_SPEC.targetMassG,
  finalVolumeL: number = OXALIC_ACID_PREPARATION_SPEC.targetVolumeL,
  mix = true,
): PreparationState {
  let state = createOxalicAcidPreparation().state;
  state = applyPreparation(state, {
    type: 'add-material',
    materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
    measuredMassG: massG,
  });
  state = applyPreparation(state, {
    type: 'add-external-solvent-volume', volumeL: 0.1,
  });
  if (mix) state = applyPreparation(state, { type: 'mix' });
  state = applyPreparation(state, {
    type: 'add-external-solvent-volume', volumeL: finalVolumeL - 0.1,
  });
  return applyPreparation(state, { type: 'complete-preparation' });
}

function setup(
  source = preparation(),
  options: { acid?: boolean; temperatureC?: number; initialReadingMl?: number } = {},
): OxalicAcidTitrationState {
  let state = createOxalicAcidTitration(source).state;
  state = prepareOxalicAcidTitrationAliquot(state).state;
  if (options.acid !== false) state = addOxalicAcidTitrationAcid(state).state;
  if (options.temperatureC !== undefined) {
    const heated = heatOxalicAcidTitration(state, options.temperatureC);
    expect(heated.outcome).toBe('VALID');
    state = heated.state;
  }
  const started = startOxalicAcidTitration(
    state,
    options.initialReadingMl ?? 1.2,
  );
  expect(started.outcome).toBe('VALID');
  return started.state;
}

function deliver(
  state: OxalicAcidTitrationState,
  volumeMl: number,
): OxalicAcidTitrationState {
  const result = applyOxalicAcidTitrationDelivery(state, volumeMl);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

describe('named oxalic-acid titration configuration', () => {
  it('uses the NCERT setup and shared GALILEO permanganate assumptions', () => {
    expect(OXALIC_ACID_TITRATION_SPEC).toMatchObject({
      aliquotVolumeMl: 10,
      nominalStandardMolarityMolPerL: 0.1,
      acidVolumeL: 0.005,
      acidMolarityMolPerL: 1,
      minimumReactionTemperatureC: 50,
      maximumReactionTemperatureC: 60,
      permanganatePerReactiveOxalateRatio: 0.4,
    });
    expect(OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL)
      .toBe(PROTOTYPE_PERMANGANATE_MOLARITY_MOL_PER_L);
    expect(OXALIC_ACID_TITRATION_SPEC.endpointExcessAllowanceMol)
      .toBe(PROTOTYPE_ENDPOINT_EXCESS_ALLOWANCE_MOL);
    expect(MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL)
      .toBe(PROTOTYPE_PERMANGANATE_MOLARITY_MOL_PER_L);
  });
});

describe('named oxalic reaction progress and observations', () => {
  it('maps the actual correct aliquot to 0.001 mol substrate and 0.0004 mol capacity', () => {
    const state = setup(preparation(), { temperatureC: 55 });
    const result = deriveOxalicAcidTitrationResult(state);
    expect(result.availableReactiveOxalateMol).toBeCloseTo(0.001, 15);
    expect(result.reactionProgress?.remainingReactiveCapacityMol)
      .toBeCloseTo(0.0004, 15);
  });

  it('derives limited, equivalent, and excess reaction progress from actual inventory', () => {
    const partial = deriveOxalicAcidTitrationResult(deliver(
      setup(preparation(), { temperatureC: 55 }), 20,
    ));
    expect(partial.reactionProgress?.consumedPermanganateMol)
      .toBeCloseTo(0.0002, 15);
    expect(partial.reactionProgress?.remainingReactiveCapacityMol)
      .toBeCloseTo(0.0002, 15);

    const equivalentState = deliver(setup(preparation(), { temperatureC: 55 }), 40);
    const equivalent = deriveOxalicAcidTitrationResult(equivalentState);
    expect(equivalent.reactionProgress?.consumedPermanganateMol)
      .toBeCloseTo(0.0004, 15);
    expect(equivalent.reactionProgress?.remainingReactiveCapacityMol)
      .toBeCloseTo(0, 15);
    expect(equivalent.permanganateAssessment?.indicatorState).toBe('decolorized');

    const excess = deriveOxalicAcidTitrationResult(deliver(
      setup(preparation(), { temperatureC: 55 }), 40.1,
    ));
    expect(excess.reactionProgress?.consumedPermanganateMol)
      .toBeCloseTo(0.0004, 15);
    expect(excess.permanganateAssessment?.excessPermanganateMol)
      .toBeCloseTo(0.000001, 15);
    expect(excess.permanganateAssessment?.indicatorState).toBe('overshot');
  });

  it('derives CO2 without adding gas inventory to ChemistryState', () => {
    const empty = deriveOxalicAcidTitrationResult(
      setup(preparation(), { temperatureC: 55 }),
    );
    expect(empty.generatedCo2Mol).toBe(0);
    expect(empty.co2EvolutionExpected).toBe(false);

    const partial = deriveOxalicAcidTitrationResult(deliver(
      setup(preparation(), { temperatureC: 55 }), 20,
    ));
    expect(partial.generatedCo2Mol).toBeCloseTo(0.001, 15);

    const exact = deriveOxalicAcidTitrationResult(deliver(
      setup(preparation(), { temperatureC: 55 }), 40,
    ));
    expect(exact.generatedCo2Mol).toBeCloseTo(0.002, 15);
    expect(exact.co2EvolutionExpected).toBe(true);
    expect(exact.reactionProgress!.consumedPermanganateMol * 5)
      .toBeCloseTo(exact.generatedCo2Mol, 15);
    expect('carbon-dioxide' in exact).toBe(false);
  });
});

describe('named oxalic temperature and acid prerequisites', () => {
  it.each([
    [49.9, false, 'TEMPERATURE_TOO_LOW'],
    [50, true, null],
    [55, true, null],
    [60, true, null],
    [60.1, false, 'TEMPERATURE_TOO_HIGH'],
  ] as const)('classifies current flask temperature %s °C', (temperature, supported, issue) => {
    const state = setup(preparation(), { temperatureC: temperature });
    const result = deriveOxalicAcidTitrationResult(state);
    expect(result.reactionSupported).toBe(supported);
    if (issue) expect(result.issues).toContain(issue);
  });

  it('delegates heating to core and stores no separate heated flag', () => {
    let state = createOxalicAcidTitration(preparation()).state;
    state = prepareOxalicAcidTitrationAliquot(state).state;
    state = addOxalicAcidTitrationAcid(state).state;
    const beforeContents = state.volumetric.chemistryState
      .vessels[OXALIC_TITRATION_FLASK_ID]!.contents;
    const heated = heatOxalicAcidTitration(state, 55);
    expect(heated.outcome).toBe('VALID');
    expect(heated.state.volumetric.chemistryState
      .vessels[OXALIC_TITRATION_FLASK_ID]!.temperatureC).toBe(55);
    expect(heated.state.volumetric.chemistryState
      .vessels[OXALIC_TITRATION_FLASK_ID]!.contents).toBe(beforeContents);
    expect('wasHeated' in heated.state).toBe(false);
  });

  it('makes missing or insufficient acid unusable without blocking delivery', () => {
    const missing = deliver(setup(preparation(), {
      acid: false, temperatureC: 55,
    }), 40.01);
    const missingResult = deriveOxalicAcidTitrationResult(missing);
    expect(missingResult.usability).toBe('unusable');
    expect(missingResult.issues).toContain('ACID_MEDIUM_INSUFFICIENT');
    expect(missing.volumetric.chemistryState.vessels[OXALIC_TITRATION_FLASK_ID]!
      .contents.dissolvedAmountsMol[POTASSIUM_PERMANGANATE_MATERIAL_ID])
      .toBeGreaterThan(0);

    const base = setup(preparation(), { temperatureC: 55 });
    const flask = base.volumetric.chemistryState.vessels[OXALIC_TITRATION_FLASK_ID]!;
    const insufficient: OxalicAcidTitrationState = {
      ...base,
      volumetric: {
        ...base.volumetric,
        chemistryState: {
          ...base.volumetric.chemistryState,
          vessels: {
            ...base.volumetric.chemistryState.vessels,
            [OXALIC_TITRATION_FLASK_ID]: {
              ...flask,
              contents: {
                ...flask.contents,
                dissolvedAmountsMol: {
                  ...flask.contents.dissolvedAmountsMol,
                  [SULFURIC_ACID_MATERIAL_ID]: 0.004999,
                },
              },
            },
          },
        },
      },
    };
    expect(deriveOxalicAcidTitrationResult(insufficient).reactionSupported).toBe(false);
  });

  it('gives scientific prerequisites precedence over endpoint appearance', () => {
    const unsupported = completeOxalicAcidTitration(deliver(
      setup(preparation(), { acid: false, temperatureC: 25 }), 40.1,
    )).state;
    const result = deriveOxalicAcidTitrationResult(unsupported);
    expect(result.usability).toBe('unusable');
    expect(result.permanganateAssessment).toBeNull();
    expect(result.issues).toEqual([
      'ACID_MEDIUM_INSUFFICIENT', 'TEMPERATURE_TOO_LOW',
    ]);
  });
});

describe('named oxalic full workflow and error propagation', () => {
  it('supports incremental endpoint observation and a usable learner result', () => {
    let state = setup(preparation(), { temperatureC: 55, initialReadingMl: 2.3 });
    state = deliver(state, 30);
    expect(deriveOxalicAcidTitrationResult(state)
      .permanganateAssessment?.indicatorState).toBe('decolorized');
    state = deliver(state, 10);
    expect(deriveOxalicAcidTitrationResult(state)
      .permanganateAssessment?.indicatorState).toBe('decolorized');
    state = deliver(state, 0.01);
    expect(deriveOxalicAcidTitrationResult(state)
      .permanganateAssessment?.indicatorState).toBe('endpoint');
    expect(state.volumetric.trial.status).toBe('in-progress');
    state = completeOxalicAcidTitration(state).state;
    const result = deriveOxalicAcidTitrationResult(state);
    expect(result.usability).toBe('usable');
    expect(result.calculatedTitrantMolarityMolPerL).toBeCloseTo(0.01, 4);
  });

  it('propagates an off-target standard into shifted chemistry and learner error', () => {
    let state = setup(preparation(3.0), { temperatureC: 55 });
    const reactive = deriveOxalicAcidTitrationResult(state)
      .availableReactiveOxalateMol;
    expect(reactive).not.toBeCloseTo(0.001, 8);
    const endpointMl = (reactive * 2 / 5)
      / OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL * 1000;
    expect(endpointMl).not.toBeCloseTo(40, 5);
    state = deliver(state, endpointMl + 0.01);
    state = completeOxalicAcidTitration(state).state;
    const result = deriveOxalicAcidTitrationResult(state);
    expect(result.usability).toBe('usable');
    expect(result.calculatedTitrantMolarityMolPerL).not.toBeCloseTo(
      result.actualTitrantMolarityMolPerL,
      5,
    );
  });

  it('rejects unusable preparation, early completion, and overshoot', () => {
    const unusable = deriveOxalicAcidTitrationResult(setup(
      preparation(3.15, 0.25, false), { temperatureC: 55 },
    ));
    expect(unusable.usability).toBe('unusable');
    expect(unusable.issues).toContain('SOURCE_PREPARATION_UNUSABLE');

    const early = completeOxalicAcidTitration(deliver(
      setup(preparation(), { temperatureC: 55 }), 39,
    )).state;
    expect(deriveOxalicAcidTitrationResult(early)).toMatchObject({
      usability: 'stopped-early', calculatedTitrantMolarityMolPerL: null,
    });

    const overshot = completeOxalicAcidTitration(deliver(
      setup(preparation(), { temperatureC: 55 }), 40.1,
    )).state;
    expect(deriveOxalicAcidTitrationResult(overshot)).toMatchObject({
      usability: 'overshot', calculatedTitrantMolarityMolPerL: null,
    });
  });

  it('keeps delivery and result derivation immutable', () => {
    const state = setup(preparation(), { temperatureC: 55 });
    const before = JSON.stringify(state);
    const next = deliver(state, 1);
    expect(JSON.stringify(state)).toBe(before);
    const nextBefore = JSON.stringify(next);
    deriveOxalicAcidReactionProgress(next);
    deriveOxalicAcidTitrationResult(next);
    expect(JSON.stringify(next)).toBe(nextBefore);
  });
});
