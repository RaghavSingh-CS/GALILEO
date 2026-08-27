import { describe, expect, it } from 'vitest';
import type { ChemistryConfiguration, ChemistryState } from '../core';
import {
  completeVolumetricTrial,
  createVolumetricState,
  deliverFromBurette,
  getDeliveredVolumeMl,
  lToMl,
  mlToL,
  startVolumetricTrial,
} from '../volumetric';
import type { VolumetricConfiguration, VolumetricState } from '../volumetric';

const chemistryConfiguration: ChemistryConfiguration = {
  materials: {
    solute: { name: 'Generic dissolved solute', molarMassGPerMol: 100 },
    solid: { name: 'Generic undissolved solid', molarMassGPerMol: 50 },
  },
  apparatus: {
    burette: { kind: 'burette', capacityL: 0.05, supportsHeating: false },
    receiver: { kind: 'conical-flask', capacityL: 0.25, supportsHeating: true },
    untouched: { kind: 'beaker', capacityL: 0.1, supportsHeating: false },
  },
};

const configuration: VolumetricConfiguration = {
  buretteApparatusId: 'burette',
  deliveryTargetApparatusId: 'receiver',
};

function chemistryState(overrides: { sourceVolumeL?: number; targetVolumeL?: number } = {}): ChemistryState {
  return {
    vessels: {
      burette: {
        temperatureC: 25,
        contents: {
          volumeL: overrides.sourceVolumeL ?? 0.05,
          dissolvedAmountsMol: { solute: 0.005 },
          undissolvedAmountsMol: { solid: 0.002 },
        },
      },
      receiver: {
        temperatureC: 25,
        contents: {
          volumeL: overrides.targetVolumeL ?? 0.02,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
      untouched: {
        temperatureC: 25,
        contents: { volumeL: 0, dissolvedAmountsMol: {}, undissolvedAmountsMol: {} },
      },
    },
  };
}

function started(initialReadingMl = 0, state = chemistryState()): VolumetricState {
  const result = startVolumetricTrial(
    configuration,
    chemistryConfiguration,
    createVolumetricState(state),
    initialReadingMl,
  );
  expect(result.outcome).toBe('VALID');
  return result.state;
}

describe('generic volumetric trial', () => {
  it.each([0, 1.2, 50])('starts at a valid initial reading of %s mL', (reading) => {
    const source = chemistryState();
    const result = startVolumetricTrial(
      configuration,
      chemistryConfiguration,
      createVolumetricState(source),
      reading,
    );
    expect(result.outcome).toBe('VALID');
    expect(result.state.chemistryState).toBe(source);
    expect(result.state.trial).toEqual({
      status: 'in-progress',
      initialBuretteReadingMl: reading,
      currentBuretteReadingMl: reading,
    });
    expect(getDeliveredVolumeMl(result.state.trial)).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'blocks invalid initial reading %s atomically',
    (reading) => {
      const state = createVolumetricState(chemistryState());
      const result = startVolumetricTrial(
        configuration, chemistryConfiguration, state, reading,
      );
      expect(result.outcome).toBe('BLOCKED');
      expect(result.state).toBe(state);
      expect(result.messages[0]!.code).toBe('INVALID_READING');
    },
  );

  it('blocks an initial reading beyond the core burette capacity', () => {
    const state = createVolumetricState(chemistryState());
    const result = startVolumetricTrial(
      configuration, chemistryConfiguration, state, 50.001,
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.state).toBe(state);
    expect(result.messages[0]!.code).toBe('READING_OUT_OF_RANGE');
  });

  it.each([
    ['invalid lifecycle', { status: 'invalid', initialBuretteReadingMl: 0, currentBuretteReadingMl: 0 }],
    ['decreasing reading', { status: 'in-progress', initialBuretteReadingMl: 2, currentBuretteReadingMl: 1 }],
  ] as const)('blocks a malformed trial with %s', (_, trial) => {
    const malformed = {
      chemistryState: chemistryState(),
      trial,
    } as unknown as VolumetricState;
    const result = deliverFromBurette(
      configuration, chemistryConfiguration, malformed, 1,
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.state).toBe(malformed);
    expect(result.messages[0]!.code).toBe('INVALID_TRIAL_STATE');
  });

  it('supports a nonzero initial reading and derives delivered volume', () => {
    const state = started(1.2);
    const result = deliverFromBurette(
      configuration, chemistryConfiguration, state, 12.6,
    );
    expect(result.outcome).toBe('VALID');
    expect(result.state.trial.currentBuretteReadingMl).toBeCloseTo(13.8, 12);
    expect(getDeliveredVolumeMl(result.state.trial)).toBeCloseTo(12.6, 12);
  });

  it('moves liquid and dissolved inventory through Chemistry core only', () => {
    const state = started();
    const untouched = state.chemistryState.vessels.untouched;
    const result = deliverFromBurette(
      configuration, chemistryConfiguration, state, 10,
    );
    const source = result.state.chemistryState.vessels.burette!.contents;
    const target = result.state.chemistryState.vessels.receiver!.contents;
    expect(source.volumeL).toBeCloseTo(0.04, 15);
    expect(target.volumeL).toBeCloseTo(0.03, 15);
    expect(source.dissolvedAmountsMol.solute).toBeCloseTo(0.004, 15);
    expect(target.dissolvedAmountsMol.solute).toBeCloseTo(0.001, 15);
    expect(source.undissolvedAmountsMol.solid).toBe(0.002);
    expect(result.state.chemistryState.vessels.untouched).toBe(untouched);
  });

  it('accumulates repeated mechanical deliveries without storing a redundant total', () => {
    const first = deliverFromBurette(
      configuration, chemistryConfiguration, started(2), 4,
    );
    const second = deliverFromBurette(
      configuration, chemistryConfiguration, first.state, 6,
    );
    expect(second.state.trial.currentBuretteReadingMl).toBe(12);
    expect(getDeliveredVolumeMl(second.state.trial)).toBe(10);
    expect('deliveredVolumeMl' in second.state.trial).toBe(false);
  });

  it('allows delivery to the exact burette limit and blocks beyond it', () => {
    const exact = deliverFromBurette(
      configuration, chemistryConfiguration, started(40), 10,
    );
    expect(exact.outcome).toBe('VALID');
    expect(exact.state.trial.currentBuretteReadingMl).toBe(50);
    const beyond = deliverFromBurette(
      configuration, chemistryConfiguration, started(40), 10.001,
    );
    expect(beyond.outcome).toBe('BLOCKED');
    expect(beyond.messages[0]!.code).toBe('BURETTE_LIMIT_EXCEEDED');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'blocks invalid delivery %s atomically',
    (delivery) => {
      const state = started();
      const result = deliverFromBurette(
        configuration, chemistryConfiguration, state, delivery,
      );
      expect(result.outcome).toBe('BLOCKED');
      expect(result.state).toBe(state);
      expect(result.messages[0]!.code).toBe('INVALID_DELIVERY_VOLUME');
    },
  );

  it.each([
    ['insufficient source', chemistryState({ sourceVolumeL: 0.005 }), 10, 'INSUFFICIENT_SOURCE_VOLUME'],
    ['destination overflow', chemistryState({ targetVolumeL: 0.249 }), 2, 'DESTINATION_CAPACITY_EXCEEDED'],
  ] as const)('keeps readings and Chemistry state atomic on %s', (_, coreState, delivery, coreCode) => {
    const state = started(0, coreState);
    const result = deliverFromBurette(
      configuration, chemistryConfiguration, state, delivery,
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.state).toBe(state);
    expect(result.state.chemistryState).toBe(coreState);
    expect(result.messages.map(({ code }) => code)).toEqual(['TRANSFER_FAILED', coreCode]);
  });

  it('does not move Chemistry inventory when reading validation fails', () => {
    const state = started(49);
    const result = deliverFromBurette(
      configuration, chemistryConfiguration, state, 2,
    );
    expect(result.state).toBe(state);
    expect(result.state.chemistryState).toBe(state.chemistryState);
  });

  it('completes mechanically without changing Chemistry state or asserting validity', () => {
    const state = started(3);
    const result = completeVolumetricTrial(
      configuration, chemistryConfiguration, state,
    );
    expect(result.outcome).toBe('VALID');
    expect(result.state.chemistryState).toBe(state.chemistryState);
    expect(result.state.trial.status).toBe('completed');
    expect(Object.keys(result.state.trial).sort()).toEqual([
      'currentBuretteReadingMl', 'initialBuretteReadingMl', 'status',
    ]);
  });

  it('blocks delivery into a completed trial with exact state preservation', () => {
    const completed = completeVolumetricTrial(
      configuration, chemistryConfiguration, started(),
    ).state;
    const result = deliverFromBurette(
      configuration, chemistryConfiguration, completed, 1,
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.state).toBe(completed);
    expect(result.messages[0]!.code).toBe('TRIAL_ALREADY_COMPLETED');
  });

  it('supports repeats by creating a fresh trial around the retained Chemistry state', () => {
    const completed = completeVolumetricTrial(
      configuration, chemistryConfiguration, started(1),
    ).state;
    const fresh = createVolumetricState(completed.chemistryState);
    const repeated = startVolumetricTrial(
      configuration, chemistryConfiguration, fresh, 14.5,
    );
    expect(repeated.outcome).toBe('VALID');
    expect(repeated.state.trial.initialBuretteReadingMl).toBe(14.5);
  });

  it('uses exact, explicit litre/millilitre conversions', () => {
    expect(mlToL(25)).toBe(0.025);
    expect(lToMl(0.05)).toBe(50);
  });
});
