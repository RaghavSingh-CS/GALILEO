import { describe, expect, it } from 'vitest';
import {
  isChemistryStateValid,
  validateChemistryConfiguration,
  validateChemistryState,
} from '../core';
import type {
  ChemistryConfiguration,
  ChemistryState,
  StateValidationCode,
} from '../core';

const configuration: ChemistryConfiguration = {
  materials: {
    oxalicMaterial: {
      name: 'Oxalic acid dihydrate',
      molarMassGPerMol: 126.07,
    },
  },
  apparatus: {
    flask: {
      kind: 'volumetric-flask',
      capacityL: 0.1,
      supportsHeating: false,
    },
  },
};

const validSolutionState: ChemistryState = {
  vessels: {
    flask: {
      temperatureC: 25,
      contents: {
        volumeL: 0.1,
        dissolvedAmountsMol: { oxalicMaterial: 0.01 },
        undissolvedAmountsMol: {},
      },
    },
  },
};

type DeepMutable<T> = T extends object
  ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
  : T;

function cloneMutable<T>(value: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepMutable<T>;
}

function withState(change: (draft: DeepMutable<ChemistryState>) => void): ChemistryState {
  const draft = cloneMutable(validSolutionState);
  change(draft);
  return draft;
}

function withConfiguration(
  change: (draft: DeepMutable<ChemistryConfiguration>) => void,
): ChemistryConfiguration {
  const draft = cloneMutable(configuration);
  change(draft);
  return draft;
}

function codesFor(
  state: ChemistryState,
  config: ChemistryConfiguration = configuration,
): StateValidationCode[] {
  return validateChemistryState(state, config).map((issue) => issue.code);
}

describe('Chemistry configuration validation', () => {
  it('accepts valid definitions and round-trips configuration through JSON', () => {
    const serialized = JSON.stringify(configuration);
    expect(validateChemistryConfiguration(configuration)).toEqual([]);
    expect(JSON.parse(serialized)).toEqual(configuration);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid capacity %s',
    (capacityL) => {
      const config = withConfiguration((draft) => {
        draft.apparatus.flask!.capacityL = capacityL;
      });
      expect(validateChemistryConfiguration(config).map((issue) => issue.code))
        .toContain('INVALID_CAPACITY');
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid molar mass %s',
    (molarMassGPerMol) => {
      const config = withConfiguration((draft) => {
        draft.materials.oxalicMaterial!.molarMassGPerMol = molarMassGPerMol;
      });
      expect(validateChemistryConfiguration(config).map((issue) => issue.code))
        .toContain('INVALID_MOLAR_MASS');
    },
  );

  it('rejects empty apparatus and material record keys', () => {
    const config = withConfiguration((draft) => {
      draft.apparatus[''] = draft.apparatus.flask!;
      delete draft.apparatus.flask;
      draft.materials[''] = draft.materials.oxalicMaterial!;
      delete draft.materials.oxalicMaterial;
    });
    const codes = validateChemistryConfiguration(config).map((issue) => issue.code);
    expect(codes).toContain('EMPTY_APPARATUS_ID');
    expect(codes).toContain('EMPTY_MATERIAL_ID');
  });

  it('rejects empty material names', () => {
    const config = withConfiguration((draft) => {
      draft.materials.oxalicMaterial!.name = ' ';
    });
    expect(validateChemistryConfiguration(config).map((issue) => issue.code))
      .toContain('EMPTY_MATERIAL_NAME');
  });

  it('rejects malformed apparatus kind and heating capability', () => {
    const config = withConfiguration((draft) => {
      draft.apparatus.flask!.kind = 'test-tube' as 'beaker';
      draft.apparatus.flask!.supportsHeating = 'yes' as unknown as boolean;
    });
    const codes = validateChemistryConfiguration(config).map((issue) => issue.code);
    expect(codes).toContain('INVALID_APPARATUS_KIND');
    expect(codes).toContain('INVALID_HEATING_CAPABILITY');
  });
});

describe('Chemistry state validation', () => {
  it('accepts a dissolved solution at the exact capacity boundary', () => {
    expect(validateChemistryState(validSolutionState, configuration)).toEqual([]);
    expect(isChemistryStateValid(validSolutionState, configuration)).toBe(true);
  });

  it('represents bulk solvent by volume without requiring water material', () => {
    const contents = validSolutionState.vessels.flask!.contents;
    expect(contents.volumeL).toBe(0.1);
    expect(contents.dissolvedAmountsMol).toEqual({ oxalicMaterial: 0.01 });
    expect('water' in contents.dissolvedAmountsMol).toBe(false);
  });

  it('accepts an empty vessel with empty dissolved and undissolved records', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents = {
        volumeL: 0,
        dissolvedAmountsMol: {},
        undissolvedAmountsMol: {},
      };
    });
    expect(validateChemistryState(state, configuration)).toEqual([]);
  });

  it('accepts solid alone before solvent is added', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents = {
        volumeL: 0,
        dissolvedAmountsMol: {},
        undissolvedAmountsMol: { oxalicMaterial: 0.01 },
      };
    });
    expect(validateChemistryState(state, configuration)).toEqual([]);
  });

  it('accepts liquid with material still undissolved', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents = {
        volumeL: 0.05,
        dissolvedAmountsMol: {},
        undissolvedAmountsMol: { oxalicMaterial: 0.01 },
      };
    });
    expect(validateChemistryState(state, configuration)).toEqual([]);
  });

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid volume %s',
    (volumeL) => {
      const state = withState((draft) => {
        draft.vessels.flask!.contents.volumeL = volumeL;
      });
      expect(codesFor(state)).toContain('INVALID_VOLUME');
    },
  );

  it('rejects volume above capacity', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents.volumeL = 0.100001;
    });
    expect(codesFor(state)).toContain('CAPACITY_EXCEEDED');
  });

  it.each([-0.01, Number.NaN, Number.NEGATIVE_INFINITY])(
    'rejects invalid dissolved material amount %s',
    (amountMol) => {
      const state = withState((draft) => {
        draft.vessels.flask!.contents.dissolvedAmountsMol.oxalicMaterial = amountMol;
      });
      expect(codesFor(state)).toContain('INVALID_MATERIAL_AMOUNT');
    },
  );

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid undissolved material amount %s',
    (amountMol) => {
      const state = withState((draft) => {
        draft.vessels.flask!.contents.undissolvedAmountsMol.oxalicMaterial = amountMol;
      });
      expect(codesFor(state)).toContain('INVALID_MATERIAL_AMOUNT');
    },
  );

  it('rejects unknown material in either amount record', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents.dissolvedAmountsMol.unknown = 0.1;
      draft.vessels.flask!.contents.undissolvedAmountsMol.unknown = 0.1;
    });
    expect(codesFor(state).filter((code) => code === 'UNKNOWN_MATERIAL')).toHaveLength(2);
  });

  it('rejects empty material keys in either amount record', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents.dissolvedAmountsMol[''] = 0.1;
      draft.vessels.flask!.contents.undissolvedAmountsMol[''] = 0.1;
    });
    expect(codesFor(state).filter((code) => code === 'EMPTY_MATERIAL_ID')).toHaveLength(2);
  });

  it('accepts exact zero amounts in either record', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.contents.dissolvedAmountsMol.oxalicMaterial = 0;
      draft.vessels.flask!.contents.undissolvedAmountsMol.oxalicMaterial = 0;
    });
    expect(validateChemistryState(state, configuration)).toEqual([]);
  });

  it('rejects non-finite temperature', () => {
    const state = withState((draft) => {
      draft.vessels.flask!.temperatureC = Number.NaN;
    });
    expect(codesFor(state)).toContain('INVALID_TEMPERATURE');
  });

  it('rejects missing, unknown, and empty apparatus record keys', () => {
    const missing: ChemistryState = { vessels: {} };
    const unknown = withState((draft) => {
      draft.vessels.extra = cloneMutable(draft.vessels.flask!);
    });
    const empty = withState((draft) => {
      draft.vessels[''] = cloneMutable(draft.vessels.flask!);
    });
    expect(codesFor(missing)).toContain('MISSING_VESSEL');
    expect(codesFor(unknown)).toContain('UNKNOWN_APPARATUS');
    expect(codesFor(empty)).toContain('EMPTY_APPARATUS_ID');
  });

  it('round-trips state through JSON and validation does not mutate it', () => {
    const before = JSON.stringify(validSolutionState);
    const serialized = JSON.parse(before) as ChemistryState;
    expect(validateChemistryState(validSolutionState, configuration)).toEqual([]);
    expect(JSON.stringify(validSolutionState)).toBe(before);
    expect(serialized).toEqual(validSolutionState);
  });
});
