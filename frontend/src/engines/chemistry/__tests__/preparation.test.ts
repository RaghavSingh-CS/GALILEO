import { describe, expect, it } from 'vitest';
import { floatingPointTolerance } from '../core';
import type { ChemistryConfiguration, ChemistryState } from '../core';
import {
  applyPreparationAction,
  createPreparation,
  derivePreparationResult,
  isPreparationDefinitionValid,
} from '../preparation';
import type {
  PreparationAction,
  PreparationDefinition,
  PreparationState,
} from '../preparation';

const configuration: ChemistryConfiguration = {
  materials: {
    standard: { name: 'Generic standard material', molarMassGPerMol: 100 },
    wrong: { name: 'Different configured material', molarMassGPerMol: 50 },
  },
  apparatus: {
    preparation: { kind: 'volumetric-flask', capacityL: 0.5, supportsHeating: false },
    unrelated: { kind: 'beaker', capacityL: 0.2, supportsHeating: false },
  },
};

const definition: PreparationDefinition = {
  preparationId: 'generic-standard',
  vesselId: 'preparation',
  targetMaterialId: 'standard',
  dissolutionMode: 'complete-on-mix',
  targetMassG: 10,
  massToleranceG: 0.01,
  targetVolumeL: 0.5,
  volumeToleranceL: 0.001,
};

function chemistryState(): ChemistryState {
  return {
    vessels: {
      preparation: {
        temperatureC: 25,
        contents: {
          volumeL: 0,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
      unrelated: {
        temperatureC: 30,
        contents: {
          volumeL: 0.1,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
    },
  };
}

function create(
  selectedDefinition = definition,
  selectedConfiguration = configuration,
  selectedState = chemistryState(),
): PreparationState {
  const result = createPreparation(selectedDefinition, selectedConfiguration, selectedState);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function apply(
  state: PreparationState,
  action: PreparationAction,
  selectedDefinition = definition,
  selectedConfiguration = configuration,
): PreparationState {
  const result = applyPreparationAction(
    selectedDefinition,
    selectedConfiguration,
    state,
    action,
  );
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function prepare(
  massG = 10,
  volumeL = 0.5,
  selectedDefinition = definition,
): PreparationState {
  let state = create(selectedDefinition);
  state = apply(state, { type: 'add-material', materialId: 'standard', measuredMassG: massG }, selectedDefinition);
  state = apply(state, { type: 'add-external-solvent-volume', volumeL }, selectedDefinition);
  state = apply(state, { type: 'mix' }, selectedDefinition);
  return state;
}

describe('preparation creation and validation', () => {
  it('creates in-progress history without changing scientific state', () => {
    const scientific = chemistryState();
    const result = createPreparation(definition, configuration, scientific);
    expect(result.outcome).toBe('VALID');
    expect(result.state.lifecycle).toBe('in-progress');
    expect(result.state.measuredMassesG).toEqual({});
    expect(result.state.chemistryState).toBe(scientific);
    expect(definition.targetMassG).toBe(10);
    expect(result.state.chemistryState.vessels.preparation!.contents.volumeL).toBe(0);
  });

  it.each([
    ['unknown vessel', { ...definition, vesselId: 'missing' }],
    ['unknown material', { ...definition, targetMaterialId: 'missing' }],
    ['empty preparation ID', { ...definition, preparationId: '' }],
    ['invalid target mass', { ...definition, targetMassG: 0 }],
    ['invalid mass tolerance', { ...definition, massToleranceG: Number.NaN }],
    ['negative mass tolerance', { ...definition, massToleranceG: -1 }],
    ['infinite mass tolerance', {
      ...definition, massToleranceG: Number.POSITIVE_INFINITY,
    }],
    ['invalid target volume', { ...definition, targetVolumeL: Number.POSITIVE_INFINITY }],
    ['negative volume tolerance', { ...definition, volumeToleranceL: -1 }],
    ['infinite volume tolerance', {
      ...definition, volumeToleranceL: Number.POSITIVE_INFINITY,
    }],
    ['target beyond capacity', { ...definition, targetVolumeL: 0.6 }],
    ['unsupported dissolution literal', {
      ...definition,
      dissolutionMode: 'partial' as never,
    }],
  ] as const)('rejects %s', (_, invalidDefinition) => {
    expect(isPreparationDefinitionValid(invalidDefinition, configuration)).toBe(false);
    const result = createPreparation(invalidDefinition, configuration, chemistryState());
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_PREPARATION_DEFINITION');
  });

  it('rejects malformed Chemistry configuration and state safely', () => {
    const invalidConfiguration: ChemistryConfiguration = {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        preparation: { ...configuration.apparatus.preparation!, capacityL: Number.NaN },
      },
    };
    const invalidState: ChemistryState = {
      ...chemistryState(),
      vessels: {
        ...chemistryState().vessels,
        preparation: {
          ...chemistryState().vessels.preparation!,
          contents: {
            ...chemistryState().vessels.preparation!.contents,
            dissolvedAmountsMol: { standard: -1 },
          },
        },
      },
    };
    expect(createPreparation(definition, invalidConfiguration, chemistryState())
      .messages[0]!.code).toBe('INVALID_CONFIGURATION');
    expect(createPreparation(definition, configuration, invalidState)
      .messages[0]!.code).toBe('INVALID_STATE');
  });
});

describe('material history and bounded dissolution', () => {
  it('preserves measured mass as history and moles as scientific inventory', () => {
    const state = apply(create(), {
      type: 'add-material', materialId: 'standard', measuredMassG: 12,
    });
    expect(state.measuredMassesG.standard).toBe(12);
    expect(state.chemistryState.vessels.preparation!.contents.undissolvedAmountsMol.standard)
      .toBe(0.12);
  });

  it('accumulates repeated measured masses and actual inventory', () => {
    let state = apply(create(), {
      type: 'add-material', materialId: 'standard', measuredMassG: 4,
    });
    state = apply(state, {
      type: 'add-material', materialId: 'standard', measuredMassG: 6,
    });
    expect(state.measuredMassesG.standard).toBe(10);
    expect(state.chemistryState.vessels.preparation!.contents.undissolvedAmountsMol.standard)
      .toBe(0.1);
  });

  it('moves only the supported target from undissolved to dissolved', () => {
    let state = apply(create(), {
      type: 'add-material', materialId: 'standard', measuredMassG: 10,
    });
    state = apply(state, { type: 'add-material', materialId: 'wrong', measuredMassG: 1 });
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.4 });
    const beforeVolume = state.chemistryState.vessels.preparation!.contents.volumeL;
    const beforeTotal = 0.1;
    state = apply(state, { type: 'mix' });
    const contents = state.chemistryState.vessels.preparation!.contents;
    expect(contents.dissolvedAmountsMol.standard).toBe(beforeTotal);
    expect(contents.undissolvedAmountsMol.standard).toBeUndefined();
    expect(contents.undissolvedAmountsMol.wrong).toBe(0.02);
    expect(contents.dissolvedAmountsMol.wrong).toBeUndefined();
    expect(contents.volumeL).toBe(beforeVolume);
  });

  it('accumulates into existing dissolved target inventory conservatively', () => {
    const scientific = chemistryState();
    const vessel = scientific.vessels.preparation!;
    const seeded: ChemistryState = {
      ...scientific,
      vessels: {
        ...scientific.vessels,
        preparation: {
          ...vessel,
          contents: {
            volumeL: 0.1,
            dissolvedAmountsMol: { standard: 0.02 },
            undissolvedAmountsMol: { standard: 0.03 },
          },
        },
      },
    };
    const mixed = apply(create(definition, configuration, seeded), { type: 'mix' });
    expect(mixed.chemistryState.vessels.preparation!.contents.dissolvedAmountsMol.standard)
      .toBe(0.05);
    expect(mixed.chemistryState.vessels.preparation!.contents.undissolvedAmountsMol)
      .toEqual({});
  });

  it('blocks dissolution without solvent or model support', () => {
    const withMaterial = apply(create(), {
      type: 'add-material', materialId: 'standard', measuredMassG: 10,
    });
    const withoutSolvent = applyPreparationAction(
      definition, configuration, withMaterial, { type: 'mix' },
    );
    const unsupportedDefinition: PreparationDefinition = {
      ...definition,
      dissolutionMode: 'unsupported',
    };
    const withSolvent = apply(withMaterial, {
      type: 'add-external-solvent-volume', volumeL: 0.1,
    });
    const unsupported = applyPreparationAction(
      unsupportedDefinition, configuration, withSolvent, { type: 'mix' },
    );
    expect(withoutSolvent.messages[0]!.code).toBe('SOLVENT_REQUIRED');
    expect(withoutSolvent.state).toBe(withMaterial);
    expect(unsupported.messages[0]!.code).toBe('DISSOLUTION_UNSUPPORTED');
    expect(unsupported.state).toBe(withSolvent);
  });

  it('is stable and idempotent when mixed repeatedly', () => {
    const once = prepare();
    const twice = applyPreparationAction(
      definition, configuration, once, { type: 'mix' },
    );
    expect(twice.outcome).toBe('VALID');
    expect(twice.state).toBe(once);
  });
});

describe('bulk solvent and precision', () => {
  it('adds bulk volume without manufacturing solvent material', () => {
    const initial = create();
    const unrelated = initial.chemistryState.vessels.unrelated;
    const next = apply(initial, { type: 'add-external-solvent-volume', volumeL: 0.2 });
    const vessel = next.chemistryState.vessels.preparation!;
    expect(vessel.contents.volumeL).toBe(0.2);
    expect(vessel.contents.dissolvedAmountsMol.water).toBeUndefined();
    expect(vessel.contents.undissolvedAmountsMol.water).toBeUndefined();
    expect(vessel.temperatureC).toBe(25);
    expect(next.chemistryState.vessels.unrelated).toBe(unrelated);
  });

  it.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'blocks invalid external solvent volume %s atomically',
    (volumeL) => {
      const state = create();
      const result = applyPreparationAction(definition, configuration, state, {
        type: 'add-external-solvent-volume', volumeL,
      });
      expect(result.outcome).toBe('BLOCKED');
      expect(result.messages[0]!.code).toBe('INVALID_SOLVENT_VOLUME');
      expect(result.state).toBe(state);
    },
  );

  it('accumulates repeated external additions without changing material inventory', () => {
    let state = apply(create(), {
      type: 'add-material', materialId: 'standard', measuredMassG: 10,
    });
    const dissolved = state.chemistryState.vessels.preparation!.contents.dissolvedAmountsMol;
    const undissolved = state.chemistryState.vessels.preparation!.contents.undissolvedAmountsMol;
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.1 });
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.2 });
    const contents = state.chemistryState.vessels.preparation!.contents;
    expect(contents.volumeL).toBe(0.30000000000000004);
    expect(contents.dissolvedAmountsMol).toEqual(dissolved);
    expect(contents.undissolvedAmountsMol).toEqual(undissolved);
    expect(state.chemistryState.vessels.preparation!.temperatureC).toBe(25);
  });

  it('accepts and canonicalizes a floating-point exact-capacity fill', () => {
    const smallConfiguration: ChemistryConfiguration = {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        preparation: { ...configuration.apparatus.preparation!, capacityL: 0.3 },
      },
    };
    const smallDefinition = { ...definition, targetVolumeL: 0.3 };
    let state = create(smallDefinition, smallConfiguration);
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.1 }, smallDefinition, smallConfiguration);
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.2 }, smallDefinition, smallConfiguration);
    expect(state.chemistryState.vessels.preparation!.contents.volumeL).toBe(0.3);
  });

  it('blocks genuine overflow and preserves the exact original state', () => {
    const state = apply(create(), { type: 'add-external-solvent-volume', volumeL: 0.49 });
    const result = applyPreparationAction(
      definition, configuration, state, { type: 'add-external-solvent-volume', volumeL: 0.02 },
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('DESTINATION_CAPACITY_EXCEEDED');
    expect(result.state).toBe(state);
  });

  it('accepts only numerical-scale capacity excess and blocks the next boundary', () => {
    const tolerance = floatingPointTolerance(0.5, 0.5);
    const state = create();
    const within = applyPreparationAction(definition, configuration, state, {
      type: 'add-external-solvent-volume',
      volumeL: 0.5 + tolerance / 2,
    });
    expect(within.outcome).toBe('VALID');
    expect(within.state.chemistryState.vessels.preparation!.contents.volumeL).toBe(0.5);
    expect(Math.abs(0.5 + tolerance / 2
      - within.state.chemistryState.vessels.preparation!.contents.volumeL))
      .toBeLessThanOrEqual(tolerance);

    const beyond = applyPreparationAction(definition, configuration, state, {
      type: 'add-external-solvent-volume',
      volumeL: 0.5 + tolerance * 2,
    });
    expect(beyond.outcome).toBe('BLOCKED');
    expect(beyond.messages[0]!.code).toBe('DESTINATION_CAPACITY_EXCEEDED');
    expect(beyond.state).toBe(state);
  });

  it('keeps experimental tolerance distinct from numeric capacity tolerance', () => {
    const tolerant = { ...definition, volumeToleranceL: 0.01 };
    let state = prepare(10, 0.495, tolerant);
    state = apply(state, { type: 'complete-preparation' }, tolerant);
    expect(derivePreparationResult(tolerant, configuration, state).validity).toBe('on-target');
  });

  it('does not let numerical tolerance rescue zero volume tolerance', () => {
    const exactDefinition = {
      ...definition,
      targetMassG: 10,
      massToleranceG: 0,
      targetVolumeL: 0.3,
      volumeToleranceL: 0,
    };
    let state = prepare(10, 0.1, exactDefinition);
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.2 }, exactDefinition);
    state = apply(state, { type: 'complete-preparation' }, exactDefinition);
    expect(state.chemistryState.vessels.preparation!.contents.volumeL)
      .toBe(0.30000000000000004);
    expect(derivePreparationResult(exactDefinition, configuration, state).validity)
      .toBe('off-target');
    expect(derivePreparationResult(exactDefinition, configuration, state).issues)
      .toContain('VOLUME_OFF_TARGET');
  });

  it('does not let numerical tolerance rescue zero mass tolerance', () => {
    const exactDefinition = { ...definition, massToleranceG: 0 };
    const numericDifference = floatingPointTolerance(10, 10) / 2;
    let state = prepare(10 + numericDifference, 0.5, exactDefinition);
    state = apply(state, { type: 'complete-preparation' }, exactDefinition);
    const result = derivePreparationResult(exactDefinition, configuration, state);
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('MASS_OFF_TARGET');
  });
});

describe('completion and actual result derivation', () => {
  it('classifies correct mass, volume, and dissolution as on-target', () => {
    const completed = apply(prepare(), { type: 'complete-preparation' });
    const result = derivePreparationResult(definition, configuration, completed);
    expect(result.validity).toBe('on-target');
    expect(result.issues).toEqual([]);
    expect(result.actualMassEquivalentG).toBe(10);
    expect(result.actualVolumeL).toBe(0.5);
    expect(result.actualConcentrationMolPerL).toBe(0.2);
  });

  it.each([
    ['wrong mass', 8, 0.5, ['MASS_OFF_TARGET']],
    ['high mass', 12, 0.5, ['MASS_OFF_TARGET']],
    ['wrong volume', 10, 0.4, ['VOLUME_OFF_TARGET']],
    ['wrong mass and volume', 8, 0.4, ['MASS_OFF_TARGET', 'VOLUME_OFF_TARGET']],
  ] as const)('classifies %s as off-target', (_, massG, volumeL, issues) => {
    const completed = apply(prepare(massG, volumeL), { type: 'complete-preparation' });
    const result = derivePreparationResult(definition, configuration, completed);
    expect(result.validity).toBe('off-target');
    expect(result.issues).toEqual(issues);
    expect(result.actualConcentrationMolPerL).toBe((massG / 100) / volumeL);
  });

  it('does not use target values to calculate actual concentration', () => {
    const alternateTarget = { ...definition, targetMassG: 20, targetVolumeL: 0.45 };
    const completed = apply(prepare(8, 0.4, alternateTarget), {
      type: 'complete-preparation',
    }, alternateTarget);
    expect(derivePreparationResult(alternateTarget, configuration, completed)
      .actualConcentrationMolPerL).toBeCloseTo(0.2, 15);
  });

  it('classifies wrong material as unusable without removing it', () => {
    let state = prepare();
    state = apply(state, { type: 'add-material', materialId: 'wrong', measuredMassG: 1 });
    state = apply(state, { type: 'complete-preparation' });
    const result = derivePreparationResult(definition, configuration, state);
    expect(result.validity).toBe('unusable');
    expect(result.issues).toContain('WRONG_MATERIAL_PRESENT');
    expect(state.chemistryState.vessels.preparation!.contents.undissolvedAmountsMol.wrong)
      .toBe(0.02);
    expect(result.actualConcentrationMolPerL).toBeNull();
  });

  it('classifies an already-dissolved contaminant as unusable', () => {
    const state = prepare();
    const vessel = state.chemistryState.vessels.preparation!;
    const contaminated: PreparationState = {
      ...state,
      chemistryState: {
        ...state.chemistryState,
        vessels: {
          ...state.chemistryState.vessels,
          preparation: {
            ...vessel,
            contents: {
              ...vessel.contents,
              dissolvedAmountsMol: {
                ...vessel.contents.dissolvedAmountsMol,
                wrong: 0.001,
              },
            },
          },
        },
      },
      lifecycle: 'complete',
    };
    const result = derivePreparationResult(definition, configuration, contaminated);
    expect(result.validity).toBe('unusable');
    expect(result.issues).toContain('WRONG_MATERIAL_PRESENT');
    expect(contaminated.chemistryState.vessels.preparation!
      .contents.dissolvedAmountsMol.wrong).toBe(0.001);
  });

  it('classifies a genuinely high final volume as off-target', () => {
    const lowerTarget = { ...definition, targetVolumeL: 0.4 };
    let state = prepare(10, 0.5, lowerTarget);
    state = apply(state, { type: 'complete-preparation' }, lowerTarget);
    const result = derivePreparationResult(lowerTarget, configuration, state);
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('VOLUME_OFF_TARGET');
  });

  it('uses actual inventory rather than inconsistent measured-mass history', () => {
    const scientificallyCorrect = prepare();
    const inconsistentHistory: PreparationState = {
      ...scientificallyCorrect,
      measuredMassesG: { standard: 1 },
      lifecycle: 'complete',
    };
    const result = derivePreparationResult(
      definition, configuration, inconsistentHistory,
    );
    expect(result.actualMassEquivalentG).toBe(10);
    expect(result.validity).toBe('on-target');
  });

  it('returns unusable INVALID_INPUT for malformed derivation input', () => {
    const state: PreparationState = {
      ...create(),
      measuredMassesG: { missing: Number.NaN },
    };
    expect(derivePreparationResult(definition, configuration, state)).toEqual({
      validity: 'unusable',
      issues: ['INVALID_INPUT'],
      actualConcentrationMolPerL: null,
      actualMassEquivalentG: null,
      actualVolumeL: null,
    });
  });

  it('classifies undissolved target, missing target, and zero volume as unusable', () => {
    let undissolved = apply(create(), {
      type: 'add-material', materialId: 'standard', measuredMassG: 10,
    });
    undissolved = apply(undissolved, { type: 'add-external-solvent-volume', volumeL: 0.5 });
    undissolved = apply(undissolved, { type: 'complete-preparation' });
    const emptyComplete = apply(create(), { type: 'complete-preparation' });
    expect(derivePreparationResult(definition, configuration, undissolved).issues)
      .toContain('TARGET_MATERIAL_UNDISSOLVED');
    const emptyResult = derivePreparationResult(definition, configuration, emptyComplete);
    expect(emptyResult.validity).toBe('unusable');
    expect(emptyResult.issues).toContain('ZERO_VOLUME');
    expect(emptyResult.issues).toContain('TARGET_MATERIAL_MISSING');
    expect(emptyResult.actualConcentrationMolPerL).toBeNull();
  });

  it('keeps incomplete preparation in-progress', () => {
    const state = prepare();
    expect(derivePreparationResult(definition, configuration, state).validity)
      .toBe('in-progress');
  });

  it('blocks actions after completion', () => {
    const completed = apply(prepare(), { type: 'complete-preparation' });
    const result = applyPreparationAction(
      definition,
      configuration,
      completed,
      { type: 'add-external-solvent-volume', volumeL: 0.001 },
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('PREPARATION_ALREADY_COMPLETE');
    expect(result.state).toBe(completed);
  });

  it('rejects malformed preparation history atomically', () => {
    const state: PreparationState = {
      ...create(),
      measuredMassesG: { missing: Number.NaN },
    };
    const result = applyPreparationAction(
      definition,
      configuration,
      state,
      { type: 'add-external-solvent-volume', volumeL: 0.1 },
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_STATE');
    expect(result.state).toBe(state);
  });

  it('does not mutate preparation, Chemistry state, or definition', () => {
    const state = create();
    const scientific = state.chemistryState;
    const vessel = scientific.vessels.preparation;
    const definitionBefore = JSON.stringify(definition);
    const next = apply(state, {
      type: 'add-material', materialId: 'standard', measuredMassG: 10,
    });
    expect(state.chemistryState).toBe(scientific);
    expect(state.chemistryState.vessels.preparation).toBe(vessel);
    expect(next).not.toBe(state);
    expect(next.chemistryState.vessels.unrelated).toBe(scientific.vessels.unrelated);
    expect(JSON.stringify(definition)).toBe(definitionBefore);
  });
});
