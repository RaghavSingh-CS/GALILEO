import { describe, expect, it } from 'vitest';
import type { ChemistryConfiguration, ChemistryState } from '../core';
import {
  derivePermanganateIndicatorState,
  derivePermanganateTrialAssessment,
  validatePermanganateConfiguration,
} from '../permanganate';
import type {
  PermanganateReactionProgress,
  PermanganateTitrationConfiguration,
} from '../permanganate';
import { createVolumetricState, startVolumetricTrial } from '../volumetric';
import type { VolumetricConfiguration, VolumetricState } from '../volumetric';

const chemistryConfiguration: ChemistryConfiguration = {
  materials: {
    'potassium-permanganate': {
      name: 'Potassium permanganate',
      molarMassGPerMol: 158.034,
    },
    analyte: { name: 'Unspecified analyte', molarMassGPerMol: 100 },
  },
  apparatus: {
    burette: { kind: 'burette', capacityL: 0.05, supportsHeating: false },
    receiver: { kind: 'conical-flask', capacityL: 0.25, supportsHeating: true },
  },
};

const volumetricConfiguration: VolumetricConfiguration = {
  buretteApparatusId: 'burette',
  deliveryTargetApparatusId: 'receiver',
};

const configuration: PermanganateTitrationConfiguration = {
  titrantMaterialId: 'potassium-permanganate',
  endpointExcessAllowanceMol: 0.000001,
};

function chemistryState(actualPermanganateMol: number): ChemistryState {
  return {
    vessels: {
      burette: {
        temperatureC: 25,
        contents: {
          volumeL: 0.03,
          dissolvedAmountsMol: { 'potassium-permanganate': 0.003 },
          undissolvedAmountsMol: {},
        },
      },
      receiver: {
        temperatureC: 25,
        contents: {
          volumeL: 0.05,
          dissolvedAmountsMol: {
            analyte: 0.01,
            ...(actualPermanganateMol > 0
              ? { 'potassium-permanganate': actualPermanganateMol }
              : {}),
          },
          undissolvedAmountsMol: {},
        },
      },
    },
  };
}

function volumetricState(
  actualPermanganateMol: number,
  status: 'in-progress' | 'completed' = 'in-progress',
): VolumetricState {
  const started = startVolumetricTrial(
    volumetricConfiguration,
    chemistryConfiguration,
    createVolumetricState(chemistryState(actualPermanganateMol)),
    1.2,
  ).state;
  return status === 'completed'
    ? { ...started, trial: { ...started.trial, status: 'completed' } }
    : started;
}

function assess(
  actualPermanganateMol: number,
  progress: PermanganateReactionProgress,
  status: 'in-progress' | 'completed' = 'in-progress',
) {
  return derivePermanganateTrialAssessment(
    configuration,
    chemistryConfiguration,
    volumetricConfiguration,
    volumetricState(actualPermanganateMol, status),
    progress,
  );
}

describe('shared permanganate configuration', () => {
  it('accepts a known titrant material and required nonnegative allowance', () => {
    expect(validatePermanganateConfiguration(
      configuration,
      chemistryConfiguration,
    )).toEqual([]);
    expect(validatePermanganateConfiguration(
      { ...configuration, endpointExcessAllowanceMol: 0 },
      chemistryConfiguration,
    )).toEqual([]);
  });

  it('rejects a missing titrant material reference', () => {
    const issues = validatePermanganateConfiguration(
      { ...configuration, titrantMaterialId: 'missing' },
      chemistryConfiguration,
    );
    expect(issues[0]!.code).toBe('INVALID_CONFIGURATION');
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid endpoint allowance %s',
    (endpointExcessAllowanceMol) => {
      const issues = validatePermanganateConfiguration(
        { ...configuration, endpointExcessAllowanceMol },
        chemistryConfiguration,
      );
      expect(issues[0]!.code).toBe('INVALID_CONFIGURATION');
    },
  );
});

describe('shared permanganate observation', () => {
  it('remains decolorized while named reaction capacity remains', () => {
    const result = assess(0.001, {
      consumedPermanganateMol: 0.001,
      remainingReactiveCapacityMol: 0.002,
    });
    expect(result.outcome).toBe('VALID');
    expect(result.assessment?.indicatorState).toBe('decolorized');
    expect(result.assessment?.trialAssessment).toBe('before-endpoint');
    expect(result.assessment?.equivalenceSatisfied).toBe(false);
  });

  it('does not call exact equivalence an observable endpoint', () => {
    const result = assess(0.001, {
      consumedPermanganateMol: 0.001,
      remainingReactiveCapacityMol: 0,
    });
    expect(result.assessment?.equivalenceSatisfied).toBe(true);
    expect(result.assessment?.excessPermanganateMol).toBe(0);
    expect(result.assessment?.indicatorState).toBe('decolorized');
    expect(result.assessment?.trialAssessment).toBe('before-endpoint');
  });

  it('classifies a tiny positive persistent excess within allowance as endpoint', () => {
    const result = assess(0.0010005, {
      consumedPermanganateMol: 0.001,
      remainingReactiveCapacityMol: 0,
    });
    expect(result.assessment?.excessPermanganateMol).toBeGreaterThan(0);
    expect(result.assessment?.indicatorState).toBe('endpoint');
  });

  it('uses an inclusive exact endpoint-allowance boundary', () => {
    expect(derivePermanganateIndicatorState(0.000001, 0.000001))
      .toBe('endpoint');
  });

  it('classifies positive excess above allowance as overshot', () => {
    const result = assess(0.001002, {
      consumedPermanganateMol: 0.001,
      remainingReactiveCapacityMol: 0,
    });
    expect(result.assessment?.indicatorState).toBe('overshot');
    expect(result.assessment?.trialAssessment).toBe('overshot');
  });

  it('blocks impossible named reaction progress', () => {
    const consumedBeyondInventory = assess(0.001, {
      consumedPermanganateMol: 0.002,
      remainingReactiveCapacityMol: 0,
    });
    const excessWhileCapacityRemains = assess(0.002, {
      consumedPermanganateMol: 0.001,
      remainingReactiveCapacityMol: 0.001,
    });
    expect(consumedBeyondInventory.outcome).toBe('BLOCKED');
    expect(excessWhileCapacityRemains.outcome).toBe('BLOCKED');
    expect(consumedBeyondInventory.messages[0]!.code)
      .toBe('INCONSISTENT_REACTION_PROGRESS');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'blocks invalid named progress value %s',
    (value) => {
      const result = assess(0, {
        consumedPermanganateMol: value,
        remainingReactiveCapacityMol: 0,
      });
      expect(result.outcome).toBe('BLOCKED');
      expect(result.messages[0]!.code).toBe('INVALID_REACTION_PROGRESS');
    },
  );
});

describe('mechanical independence and immutability', () => {
  it.each([
    ['before-endpoint', 0.001, 0.001, 0.001],
    ['endpoint', 0.0010005, 0.001, 0],
    ['overshot', 0.001002, 0.001, 0],
  ] as const)(
    'assesses a mechanically completed trial as %s',
    (expected, actual, consumed, remaining) => {
      const result = assess(actual, {
        consumedPermanganateMol: consumed,
        remainingReactiveCapacityMol: remaining,
      }, 'completed');
      expect(result.assessment?.trialAssessment).toBe(expected);
    },
  );

  it('does not complete an active trial at endpoint or overshoot', () => {
    for (const actual of [0.0010005, 0.001002]) {
      const state = volumetricState(actual);
      const before = JSON.stringify(state);
      const result = derivePermanganateTrialAssessment(
        configuration,
        chemistryConfiguration,
        volumetricConfiguration,
        state,
        { consumedPermanganateMol: 0.001, remainingReactiveCapacityMol: 0 },
      );
      expect(result.outcome).toBe('VALID');
      expect(state.trial.status).toBe('in-progress');
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('retains volumetric reading and delivered-volume ownership outside this layer', () => {
    const state = volumetricState(0.001);
    const trialBefore = state.trial;
    const result = derivePermanganateTrialAssessment(
      configuration,
      chemistryConfiguration,
      volumetricConfiguration,
      state,
      { consumedPermanganateMol: 0.001, remainingReactiveCapacityMol: 0 },
    );
    expect(result.outcome).toBe('VALID');
    expect(state.trial).toBe(trialBefore);
    expect('volumetric' in result).toBe(false);
    expect('deliveredVolumeMl' in result).toBe(false);
  });
});
