import { describe, expect, it } from 'vitest';
import { heatVessel } from '../core';
import type {
  ChemistryConfiguration,
  ChemistryState,
  HeatAction,
} from '../core';

const configuration: ChemistryConfiguration = {
  materials: {
    solute: { name: 'Generic solute', molarMassGPerMol: 100 },
  },
  apparatus: {
    heatable: { kind: 'beaker', capacityL: 0.2, supportsHeating: true },
    unsupported: { kind: 'volumetric-flask', capacityL: 0.1, supportsHeating: false },
    unrelated: { kind: 'conical-flask', capacityL: 0.15, supportsHeating: false },
  },
};

function makeState(temperatureC = 25): ChemistryState {
  return {
    vessels: {
      heatable: {
        temperatureC,
        contents: {
          volumeL: 0.1,
          dissolvedAmountsMol: { solute: 0.01 },
          undissolvedAmountsMol: { solute: 0.002 },
        },
      },
      unsupported: {
        temperatureC: 25,
        contents: {
          volumeL: 0.05,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
      unrelated: {
        temperatureC: 20,
        contents: {
          volumeL: 0,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
    },
  };
}

function heatAction(overrides: Partial<HeatAction> = {}): HeatAction {
  return {
    type: 'heat',
    apparatusId: 'heatable',
    targetTemperatureC: 55,
    ...overrides,
  };
}

describe('heatVessel', () => {
  it('sets an exact higher target and changes only vessel temperature', () => {
    const state = makeState();
    const vessel = state.vessels.heatable!;
    const contents = vessel.contents;
    const dissolved = contents.dissolvedAmountsMol;
    const undissolved = contents.undissolvedAmountsMol;
    const unrelated = state.vessels.unrelated;
    const result = heatVessel(configuration, state, heatAction());

    expect(result.outcome).toBe('VALID');
    expect(result.messages).toEqual([]);
    expect(result.state).not.toBe(state);
    expect(result.state.vessels.heatable).not.toBe(vessel);
    expect(result.state.vessels.heatable!.temperatureC).toBe(55);
    expect(result.state.vessels.heatable!.contents).toBe(contents);
    expect(result.state.vessels.heatable!.contents.volumeL).toBe(0.1);
    expect(result.state.vessels.heatable!.contents.dissolvedAmountsMol).toBe(dissolved);
    expect(result.state.vessels.heatable!.contents.undissolvedAmountsMol).toBe(undissolved);
    expect(result.state.vessels.unrelated).toBe(unrelated);
  });

  it('does not mutate state or configuration', () => {
    const state = makeState();
    const stateBefore = JSON.stringify(state);
    const configurationBefore = JSON.stringify(configuration);
    heatVessel(configuration, state, heatAction());
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(configuration)).toBe(configurationBefore);
  });

  it('returns a valid original-reference no-op at the current temperature', () => {
    const state = makeState();
    const result = heatVessel(configuration, state, heatAction({ targetTemperatureC: 25 }));
    expect(result.outcome).toBe('VALID');
    expect(result.messages).toEqual([]);
    expect(result.state).toBe(state);
  });

  it('blocks a target below current temperature atomically', () => {
    const state = makeState();
    const result = heatVessel(configuration, state, heatAction({ targetTemperatureC: 24 }));
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('TARGET_BELOW_CURRENT_TEMPERATURE');
    expect(result.state).toBe(state);
  });

  it('blocks apparatus that does not support heating', () => {
    const state = makeState();
    const result = heatVessel(configuration, state, heatAction({ apparatusId: 'unsupported' }));
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('HEATING_NOT_SUPPORTED');
    expect(result.state).toBe(state);
  });

  it('blocks an unknown apparatus reference', () => {
    const state = makeState();
    const result = heatVessel(configuration, state, heatAction({ apparatusId: 'missing' }));
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('UNKNOWN_APPARATUS');
    expect(result.state).toBe(state);
  });

  it('rejects a configured vessel missing from state at the invariant boundary', () => {
    const state = makeState();
    const malformed: ChemistryState = {
      vessels: {
        unsupported: state.vessels.unsupported!,
        unrelated: state.vessels.unrelated!,
      },
    };
    const result = heatVessel(configuration, malformed, heatAction());
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_STATE');
    expect(result.state).toBe(malformed);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'blocks non-finite target temperature %s',
    (targetTemperatureC) => {
      const state = makeState();
      const result = heatVessel(
        configuration,
        state,
        heatAction({ targetTemperatureC }),
      );
      expect(result.outcome).toBe('BLOCKED');
      expect(result.messages[0]!.code).toBe('INVALID_TARGET_TEMPERATURE');
      expect(result.state).toBe(state);
    },
  );

  it('rejects malformed configuration before action-specific checks', () => {
    const malformed: ChemistryConfiguration = {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        heatable: { ...configuration.apparatus.heatable!, capacityL: Number.NaN },
      },
    };
    const state = makeState();
    const result = heatVessel(malformed, state, heatAction());
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_CONFIGURATION');
    expect(result.state).toBe(state);
  });

  it('rejects malformed Chemistry state before action-specific checks', () => {
    const state = makeState();
    const malformed: ChemistryState = {
      ...state,
      vessels: {
        ...state.vessels,
        heatable: { ...state.vessels.heatable!, temperatureC: Number.NaN },
      },
    };
    const result = heatVessel(configuration, malformed, heatAction());
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_STATE');
    expect(result.state).toBe(malformed);
  });

  it('allows negative Celsius heating when the target is higher', () => {
    const state = makeState(-20);
    const result = heatVessel(
      configuration,
      state,
      heatAction({ targetTemperatureC: -10 }),
    );
    expect(result.outcome).toBe('VALID');
    expect(result.state.vessels.heatable!.temperatureC).toBe(-10);
  });

  it('allows a very large finite target without inventing a universal maximum', () => {
    const state = makeState();
    const result = heatVessel(
      configuration,
      state,
      heatAction({ targetTemperatureC: Number.MAX_VALUE }),
    );
    expect(result.outcome).toBe('VALID');
    expect(result.state.vessels.heatable!.temperatureC).toBe(Number.MAX_VALUE);
  });
});
