import { describe, expect, it } from 'vitest';
import { addMaterial, floatingPointTolerance, transferLiquid } from '../core';
import type {
  AddMaterialAction,
  ChemistryConfiguration,
  ChemistryState,
  MaterialId,
  TransferLiquidAction,
} from '../core';

const configuration: ChemistryConfiguration = {
  materials: {
    oxalic: { name: 'Oxalic acid dihydrate', molarMassGPerMol: 126.07 },
    marker: { name: 'Tracked marker', molarMassGPerMol: 50 },
    other: { name: 'Other material', molarMassGPerMol: 100 },
  },
  apparatus: {
    source: { kind: 'beaker', capacityL: 0.2, supportsHeating: true },
    target: { kind: 'volumetric-flask', capacityL: 0.1, supportsHeating: false },
    untouched: { kind: 'beaker', capacityL: 0.05, supportsHeating: false },
  },
};

function makeState(): ChemistryState {
  return {
    vessels: {
      source: {
        temperatureC: 25,
        contents: {
          volumeL: 0.1,
          dissolvedAmountsMol: { oxalic: 0.01, marker: 0.002 },
          undissolvedAmountsMol: { other: 0.003 },
        },
      },
      target: {
        temperatureC: 25,
        contents: {
          volumeL: 0.02,
          dissolvedAmountsMol: { oxalic: 0.001, other: 0.004 },
          undissolvedAmountsMol: { marker: 0.005 },
        },
      },
      untouched: {
        temperatureC: 25,
        contents: {
          volumeL: 0,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
    },
  };
}

function amountTotal(
  state: ChemistryState,
  materialId: MaterialId,
): number {
  return Object.values(state.vessels).reduce(
    (total, vessel) => total + (vessel.contents.dissolvedAmountsMol[materialId] ?? 0),
    0,
  );
}

function transferAction(overrides: Partial<TransferLiquidAction> = {}): TransferLiquidAction {
  return {
    type: 'transfer-liquid',
    sourceApparatusId: 'source',
    targetApparatusId: 'target',
    volumeL: 0.025,
    ...overrides,
  };
}

describe('addMaterial', () => {
  it('adds a molar quantity to undissolved inventory only', () => {
    const state = makeState();
    const result = addMaterial(configuration, state, {
      type: 'add-material',
      targetApparatusId: 'target',
      materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: 0.01 },
    });
    const target = result.state.vessels.target!;

    expect(result.outcome).toBe('VALID');
    expect(target.contents.undissolvedAmountsMol.oxalic).toBe(0.01);
    expect(target.contents.dissolvedAmountsMol).toEqual({ oxalic: 0.001, other: 0.004 });
    expect(target.contents.volumeL).toBe(0.02);
  });

  it('converts measured mass to moles using configured molar mass', () => {
    const state = makeState();
    const result = addMaterial(configuration, state, {
      type: 'add-material',
      targetApparatusId: 'target',
      materialId: 'oxalic',
      quantity: { kind: 'mass', massG: 1.2607 },
    });

    expect(result.state.vessels.target!.contents.undissolvedAmountsMol.oxalic)
      .toBeCloseTo(0.01, 12);
  });

  it('accumulates existing undissolved material', () => {
    const state = makeState();
    const result = addMaterial(configuration, state, {
      type: 'add-material',
      targetApparatusId: 'source',
      materialId: 'other',
      quantity: { kind: 'amount', amountMol: 0.002 },
    });
    expect(result.state.vessels.source!.contents.undissolvedAmountsMol.other)
      .toBe(0.005);
  });

  it('adds a different configured material without disturbing existing inventory', () => {
    const state = makeState();
    const result = addMaterial(configuration, state, {
      type: 'add-material',
      targetApparatusId: 'target',
      materialId: 'other',
      quantity: { kind: 'amount', amountMol: 0.002 },
    });
    expect(result.state.vessels.target!.contents.undissolvedAmountsMol)
      .toEqual({ marker: 0.005, other: 0.002 });
  });

  it.each([
    { kind: 'amount', amountMol: 0 },
    { kind: 'amount', amountMol: -1 },
    { kind: 'amount', amountMol: Number.NaN },
    { kind: 'amount', amountMol: Number.POSITIVE_INFINITY },
    { kind: 'amount', amountMol: Number.NEGATIVE_INFINITY },
    { kind: 'mass', massG: 0 },
    { kind: 'mass', massG: -1 },
    { kind: 'mass', massG: Number.NaN },
    { kind: 'mass', massG: Number.POSITIVE_INFINITY },
    { kind: 'mass', massG: Number.NEGATIVE_INFINITY },
  ] satisfies AddMaterialAction['quantity'][])(
    'blocks invalid quantity $kind',
    (quantity) => {
      const state = makeState();
      const result = addMaterial(configuration, state, {
        type: 'add-material',
        targetApparatusId: 'target',
        materialId: 'oxalic',
        quantity,
      });
      expect(result.outcome).toBe('BLOCKED');
      expect(result.state).toBe(state);
      expect(result.messages[0]!.code).toBe('INVALID_AMOUNT');
    },
  );

  it('blocks unknown material and unknown apparatus', () => {
    const state = makeState();
    const unknownMaterial = addMaterial(configuration, state, {
      type: 'add-material', targetApparatusId: 'target', materialId: 'missing',
      quantity: { kind: 'amount', amountMol: 1 },
    });
    const unknownApparatus = addMaterial(configuration, state, {
      type: 'add-material', targetApparatusId: 'missing', materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: 1 },
    });
    expect(unknownMaterial.messages[0]!.code).toBe('UNKNOWN_MATERIAL');
    expect(unknownApparatus.messages[0]!.code).toBe('UNKNOWN_APPARATUS');
    expect(unknownMaterial.state).toBe(state);
    expect(unknownApparatus.state).toBe(state);
  });

  it('blocks configured apparatus with missing vessel state', () => {
    const state = makeState();
    const malformed: ChemistryState = {
      vessels: { source: state.vessels.source!, target: state.vessels.target! },
    };
    const result = addMaterial(configuration, malformed, {
      type: 'add-material', targetApparatusId: 'untouched', materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: 1 },
    });
    expect(result.messages[0]!.code).toBe('INVALID_STATE');
    expect(result.state).toBe(malformed);
  });

  it.each([
    ['negative dissolved amount', { oxalic: -1 }],
    ['NaN dissolved amount', { oxalic: Number.NaN }],
    ['infinite dissolved amount', { oxalic: Number.POSITIVE_INFINITY }],
    ['unknown existing material', { missing: 0.01 }],
  ] as const)('rejects malformed existing state with %s', (_, dissolvedAmountsMol) => {
    const state = makeState();
    const target = state.vessels.target!;
    const malformed: ChemistryState = {
      ...state,
      vessels: {
        ...state.vessels,
        target: { ...target, contents: { ...target.contents, dissolvedAmountsMol } },
      },
    };
    const originalRecord = malformed.vessels.target!.contents.dissolvedAmountsMol;
    const before = { ...originalRecord };
    const result = addMaterial(configuration, malformed, {
      type: 'add-material', targetApparatusId: 'target', materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: 0.01 },
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_STATE');
    expect(result.state).toBe(malformed);
    expect(malformed.vessels.target!.contents.dissolvedAmountsMol).toBe(originalRecord);
    expect(malformed.vessels.target!.contents.dissolvedAmountsMol).toEqual(before);
  });

  it.each([
    ['invalid capacity', {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        target: { ...configuration.apparatus.target!, capacityL: Number.NaN },
      },
    }],
    ['invalid molar mass', {
      ...configuration,
      materials: {
        ...configuration.materials,
        oxalic: { ...configuration.materials.oxalic!, molarMassGPerMol: Number.NaN },
      },
    }],
  ] as const)('rejects %s before material addition', (_, malformedConfiguration) => {
    const state = makeState();
    const before = JSON.stringify(state);
    const result = addMaterial(malformedConfiguration, state, {
      type: 'add-material', targetApparatusId: 'target', materialId: 'oxalic',
      quantity: { kind: 'mass', massG: 1 },
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_CONFIGURATION');
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('blocks a non-finite accumulated material amount atomically', () => {
    const state = makeState();
    const target = state.vessels.target!;
    const largeState: ChemistryState = {
      ...state,
      vessels: {
        ...state.vessels,
        target: {
          ...target,
          contents: {
            ...target.contents,
            undissolvedAmountsMol: { ...target.contents.undissolvedAmountsMol, oxalic: Number.MAX_VALUE },
          },
        },
      },
    };
    const originalRecord = largeState.vessels.target!.contents.undissolvedAmountsMol;
    const result = addMaterial(configuration, largeState, {
      type: 'add-material', targetApparatusId: 'target', materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: Number.MAX_VALUE },
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_RESULTING_STATE');
    expect(result.state).toBe(largeState);
    expect(largeState.vessels.target!.contents.undissolvedAmountsMol).toBe(originalRecord);
    expect(largeState.vessels.target!.contents.undissolvedAmountsMol.oxalic)
      .toBe(Number.MAX_VALUE);
  });

  it('canonicalizes exact zero and -0 but retains tiny positive amounts', () => {
    const state = makeState();
    const target = state.vessels.target!;
    const withZeros: ChemistryState = {
      ...state,
      vessels: {
        ...state.vessels,
        target: {
          ...target,
          contents: {
            ...target.contents,
            dissolvedAmountsMol: { oxalic: 0, marker: -0, other: 1e-15 },
          },
        },
      },
    };
    const result = addMaterial(configuration, withZeros, {
      type: 'add-material', targetApparatusId: 'target', materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: 0.01 },
    });
    expect(result.state.vessels.target!.contents.dissolvedAmountsMol)
      .toEqual({ other: 1e-15 });
  });

  it('does not mutate state or configuration and preserves unaffected vessel references', () => {
    const state = makeState();
    const stateBefore = JSON.stringify(state);
    const configBefore = JSON.stringify(configuration);
    const result = addMaterial(configuration, state, {
      type: 'add-material', targetApparatusId: 'target', materialId: 'oxalic',
      quantity: { kind: 'amount', amountMol: 0.01 },
    });
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(configuration)).toBe(configBefore);
    expect(result.state.vessels.source).toBe(state.vessels.source);
    expect(result.state.vessels.untouched).toBe(state.vessels.untouched);
  });
});

describe('transferLiquid', () => {
  it('moves volume and dissolved materials proportionally into existing inventories', () => {
    const state = makeState();
    const result = transferLiquid(configuration, state, transferAction());
    const source = result.state.vessels.source!.contents;
    const target = result.state.vessels.target!.contents;

    expect(result.outcome).toBe('VALID');
    expect(source.volumeL).toBeCloseTo(0.075, 15);
    expect(target.volumeL).toBeCloseTo(0.045, 15);
    expect(source.dissolvedAmountsMol.oxalic).toBeCloseTo(0.0075, 15);
    expect(source.dissolvedAmountsMol.marker).toBeCloseTo(0.0015, 15);
    expect(target.dissolvedAmountsMol.oxalic).toBeCloseTo(0.0035, 15);
    expect(target.dissolvedAmountsMol.marker).toBeCloseTo(0.0005, 15);
    expect(target.dissolvedAmountsMol.other).toBe(0.004);
  });

  it('leaves both undissolved inventories scientifically unchanged', () => {
    const state = makeState();
    const result = transferLiquid(configuration, state, transferAction());
    expect(result.state.vessels.source!.contents.undissolvedAmountsMol)
      .toEqual({ other: 0.003 });
    expect(result.state.vessels.target!.contents.undissolvedAmountsMol)
      .toEqual({ marker: 0.005 });
  });

  it('conserves liquid volume and every dissolved material', () => {
    const state = makeState();
    const volumeBefore = state.vessels.source!.contents.volumeL
      + state.vessels.target!.contents.volumeL;
    const totalsBefore = Object.fromEntries(
      ['oxalic', 'marker', 'other'].map((id) => [id, amountTotal(state, id)]),
    );
    const result = transferLiquid(configuration, state, transferAction());
    const volumeAfter = result.state.vessels.source!.contents.volumeL
      + result.state.vessels.target!.contents.volumeL;

    expect(volumeAfter).toBeCloseTo(volumeBefore, 15);
    for (const [materialId, total] of Object.entries(totalsBefore)) {
      expect(amountTotal(result.state, materialId)).toBeCloseTo(total, 15);
    }
  });

  it('performs an exact full transfer with canonical empty source dissolved inventory', () => {
    const state = makeState();
    const fullTransferConfiguration: ChemistryConfiguration = {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        target: { ...configuration.apparatus.target!, capacityL: 0.2 },
      },
    };
    const result = transferLiquid(fullTransferConfiguration, state, transferAction({ volumeL: 0.1 }));
    expect(result.outcome).toBe('VALID');
    expect(result.state.vessels.source!.contents.volumeL).toBe(0);
    expect(result.state.vessels.source!.contents.dissolvedAmountsMol).toEqual({});
    expect(result.state.vessels.target!.contents.volumeL).toBeCloseTo(0.12, 15);
    expect(result.state.vessels.target!.contents.dissolvedAmountsMol).toEqual({
      oxalic: 0.011,
      marker: 0.002,
      other: 0.004,
    });
    expect(result.state.vessels.source!.contents.undissolvedAmountsMol).toEqual({ other: 0.003 });
    expect(result.state.vessels.target!.contents.undissolvedAmountsMol).toEqual({ marker: 0.005 });
    expect(amountTotal(result.state, 'oxalic')).toBe(amountTotal(state, 'oxalic'));
    expect(amountTotal(result.state, 'marker')).toBe(amountTotal(state, 'marker'));
    expect(amountTotal(result.state, 'other')).toBe(amountTotal(state, 'other'));
  });

  it('allows the exact destination-capacity boundary', () => {
    const state = makeState();
    const result = transferLiquid(configuration, state, transferAction({ volumeL: 0.08 }));
    expect(result.outcome).toBe('VALID');
    expect(result.state.vessels.target!.contents.volumeL).toBe(0.1);
  });

  it('accepts a decimal exact-capacity boundary affected by binary floating point', () => {
    const state = makeState();
    const decimalConfiguration: ChemistryConfiguration = {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        target: { ...configuration.apparatus.target!, capacityL: 0.3 },
      },
    };
    const decimalState: ChemistryState = {
      ...state,
      vessels: {
        ...state.vessels,
        source: {
          ...state.vessels.source!,
          contents: { ...state.vessels.source!.contents, volumeL: 0.2 },
        },
        target: {
          ...state.vessels.target!,
          contents: { ...state.vessels.target!.contents, volumeL: 0.1 },
        },
      },
    };
    const exact = transferLiquid(
      decimalConfiguration,
      decimalState,
      transferAction({ volumeL: 0.2 }),
    );
    expect(exact.outcome).toBe('VALID');
    expect(exact.state.vessels.target!.contents.volumeL).toBe(0.3);
    const volumeBefore = 0.2 + 0.1;
    const volumeAfter = exact.state.vessels.source!.contents.volumeL
      + exact.state.vessels.target!.contents.volumeL;
    expect(Math.abs(volumeAfter - volumeBefore)).toBeLessThanOrEqual(
      floatingPointTolerance(volumeAfter, volumeBefore),
    );
  });

  it.each([0, -0.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'blocks invalid transfer volume %s',
    (volumeL) => {
      const state = makeState();
      const result = transferLiquid(configuration, state, transferAction({ volumeL }));
      expect(result.outcome).toBe('BLOCKED');
      expect(result.state).toBe(state);
      expect(result.messages[0]!.code).toBe('INVALID_TRANSFER_VOLUME');
    },
  );

  it('blocks insufficient source volume and destination overflow', () => {
    const state = makeState();
    const insufficient = transferLiquid(
      { ...configuration, apparatus: { ...configuration.apparatus,
        target: { ...configuration.apparatus.target!, capacityL: 1 } } },
      state,
      transferAction({ volumeL: 0.100001 }),
    );
    const overflow = transferLiquid(configuration, state, transferAction({ volumeL: 0.081 }));
    expect(insufficient.messages[0]!.code).toBe('INSUFFICIENT_SOURCE_VOLUME');
    expect(overflow.messages[0]!.code).toBe('DESTINATION_CAPACITY_EXCEEDED');
    expect(insufficient.state).toBe(state);
    expect(overflow.state).toBe(state);
  });

  it('blocks same source and destination', () => {
    const state = makeState();
    const result = transferLiquid(configuration, state, transferAction({
      targetApparatusId: 'source',
    }));
    expect(result.messages[0]!.code).toBe('SAME_SOURCE_DESTINATION');
    expect(result.state).toBe(state);
  });

  it('blocks unknown or missing source and destination references', () => {
    const state = makeState();
    const unknownSource = transferLiquid(configuration, state, transferAction({
      sourceApparatusId: 'missing',
    }));
    const unknownTarget = transferLiquid(configuration, state, transferAction({
      targetApparatusId: 'missing',
    }));
    const missingState: ChemistryState = {
      vessels: { source: state.vessels.source!, untouched: state.vessels.untouched! },
    };
    const missingTarget = transferLiquid(configuration, missingState, transferAction());
    expect(unknownSource.messages[0]!.code).toBe('UNKNOWN_APPARATUS');
    expect(unknownTarget.messages[0]!.code).toBe('UNKNOWN_APPARATUS');
    expect(missingTarget.messages[0]!.code).toBe('INVALID_STATE');
  });

  it('blocks a missing source vessel through operation-boundary validation', () => {
    const state = makeState();
    const malformed: ChemistryState = {
      vessels: { target: state.vessels.target!, untouched: state.vessels.untouched! },
    };
    const result = transferLiquid(configuration, malformed, transferAction());
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_STATE');
    expect(result.state).toBe(malformed);
  });

  it.each([
    ['invalid source dissolved inventory', 'source', 'dissolvedAmountsMol', { oxalic: -1 }],
    ['invalid destination dissolved inventory', 'target', 'dissolvedAmountsMol', { oxalic: Number.NaN }],
    ['invalid undissolved inventory', 'source', 'undissolvedAmountsMol', { other: -1 }],
    ['unknown existing material', 'target', 'undissolvedAmountsMol', { missing: 0.01 }],
  ] as const)(
    'rejects %s before transfer',
    (_, vesselId, recordName, amounts) => {
      const state = makeState();
      const vessel = state.vessels[vesselId]!;
      const malformed: ChemistryState = {
        ...state,
        vessels: {
          ...state.vessels,
          [vesselId]: {
            ...vessel,
            contents: { ...vessel.contents, [recordName]: amounts },
          },
        },
      };
      const originalRecord = malformed.vessels[vesselId]!.contents[recordName];
      const before = { ...originalRecord };
      const result = transferLiquid(configuration, malformed, transferAction());
      expect(result.outcome).toBe('BLOCKED');
      expect(result.messages[0]!.code).toBe('INVALID_STATE');
      expect(result.state).toBe(malformed);
      expect(malformed.vessels[vesselId]!.contents[recordName]).toBe(originalRecord);
      expect(malformed.vessels[vesselId]!.contents[recordName]).toEqual(before);
    },
  );

  it('rejects an invalid destination capacity before transfer', () => {
    const state = makeState();
    const malformedConfiguration: ChemistryConfiguration = {
      ...configuration,
      apparatus: {
        ...configuration.apparatus,
        target: { ...configuration.apparatus.target!, capacityL: Number.NaN },
      },
    };
    const before = JSON.stringify(state);
    const result = transferLiquid(malformedConfiguration, state, transferAction());
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('INVALID_CONFIGURATION');
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('canonicalizes exact zeros while retaining tiny positive material amounts', () => {
    const state = makeState();
    const source = state.vessels.source!;
    const withZeros: ChemistryState = {
      ...state,
      vessels: {
        ...state.vessels,
        source: {
          ...source,
          contents: {
            ...source.contents,
            dissolvedAmountsMol: { oxalic: 0.01, marker: -0, other: 1e-15 },
          },
        },
      },
    };
    const result = transferLiquid(configuration, withZeros, transferAction());
    expect(result.state.vessels.source!.contents.dissolvedAmountsMol.marker).toBeUndefined();
    expect(result.state.vessels.source!.contents.dissolvedAmountsMol.other).toBeCloseTo(7.5e-16, 15);
  });

  it('does not manufacture a bulk-solvent material entry', () => {
    const result = transferLiquid(configuration, makeState(), transferAction());
    expect(result.state.vessels.target!.contents.dissolvedAmountsMol.water).toBeUndefined();
  });

  it('does not mutate inputs and preserves unrelated vessel references', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const configBefore = JSON.stringify(configuration);
    const sourceContents = state.vessels.source!.contents;
    const targetContents = state.vessels.target!.contents;
    const sourceDissolved = sourceContents.dissolvedAmountsMol;
    const sourceUndissolved = sourceContents.undissolvedAmountsMol;
    const targetDissolved = targetContents.dissolvedAmountsMol;
    const targetUndissolved = targetContents.undissolvedAmountsMol;
    const result = transferLiquid(configuration, state, transferAction());
    expect(JSON.stringify(state)).toBe(before);
    expect(JSON.stringify(configuration)).toBe(configBefore);
    expect(result.state.vessels.untouched).toBe(state.vessels.untouched);
    expect(result.state.vessels.source).not.toBe(state.vessels.source);
    expect(result.state.vessels.target).not.toBe(state.vessels.target);
    expect(state.vessels.source!.contents).toBe(sourceContents);
    expect(state.vessels.target!.contents).toBe(targetContents);
    expect(state.vessels.source!.contents.dissolvedAmountsMol).toBe(sourceDissolved);
    expect(state.vessels.source!.contents.undissolvedAmountsMol).toBe(sourceUndissolved);
    expect(state.vessels.target!.contents.dissolvedAmountsMol).toBe(targetDissolved);
    expect(state.vessels.target!.contents.undissolvedAmountsMol).toBe(targetUndissolved);
    expect(result.state.vessels.source!.temperatureC).toBe(state.vessels.source!.temperatureC);
    expect(result.state.vessels.target!.temperatureC).toBe(state.vessels.target!.temperatureC);
  });
});
