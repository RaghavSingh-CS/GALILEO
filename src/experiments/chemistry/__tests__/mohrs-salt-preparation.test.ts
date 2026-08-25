import { describe, expect, it } from 'vitest';
import type { ChemistryConfiguration } from '../core';
import type { PreparationAction } from '../preparation';
import {
  applyMohrsSaltPreparationAction,
  createMohrsSaltPreparation,
  deriveMohrsSaltPreparationResult,
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  MOHRS_SALT_PREPARATION_CONFIGURATION,
  MOHRS_SALT_PREPARATION_DEFINITION,
  MOHRS_SALT_PREPARATION_SPEC,
  MOHRS_SALT_PREPARATION_VESSEL_ID,
} from '../preparation/named';
import type {
  MohrsSaltPreparationAction,
  MohrsSaltPreparationState,
} from '../preparation/named';

function create(
  configuration = MOHRS_SALT_PREPARATION_CONFIGURATION,
): MohrsSaltPreparationState {
  const result = createMohrsSaltPreparation(configuration);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function apply(
  state: MohrsSaltPreparationState,
  action: MohrsSaltPreparationAction,
  configuration = MOHRS_SALT_PREPARATION_CONFIGURATION,
): MohrsSaltPreparationState {
  const result = applyMohrsSaltPreparationAction(state, action, configuration);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function completePreparation(
  massG: number = MOHRS_SALT_PREPARATION_SPEC.targetMassG,
  finalVolumeL: number = MOHRS_SALT_PREPARATION_SPEC.targetVolumeL,
  acidify = true,
): MohrsSaltPreparationState {
  let state = create();
  state = apply(state, {
    type: 'add-material',
    materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
    measuredMassG: massG,
  });
  state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.1 });
  state = apply(state, { type: 'mix' });
  if (acidify) {
    state = apply(state, { type: 'acidify-with-dilute-sulfuric-acid' });
  }
  state = apply(state, {
    type: 'add-external-solvent-volume',
    volumeL: finalVolumeL - 0.1,
  });
  return apply(state, { type: 'complete-preparation' });
}

describe("named Mohr's-salt constants", () => {
  it('uses the hexahydrate identity and NCERT preparation quantities', () => {
    const material = MOHRS_SALT_PREPARATION_CONFIGURATION
      .materials[MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID]!;
    expect(material.name).toBe("Mohr's salt hexahydrate");
    expect(MOHRS_SALT_PREPARATION_SPEC.formula).toBe('(NH4)2Fe(SO4)2·6H2O');
    expect(material.molarMassGPerMol).toBe(392);
    expect(MOHRS_SALT_PREPARATION_SPEC.targetMolarityMolPerL).toBe(0.05);
    expect(MOHRS_SALT_PREPARATION_SPEC.targetVolumeL).toBe(0.250);
    expect(MOHRS_SALT_PREPARATION_SPEC.targetMassG).toBe(4.90);
    expect(0.05 * 0.250 * 392).toBeCloseTo(4.90, 15);
  });

  it('uses complete-on-mix and prototype physical tolerances', () => {
    expect(MOHRS_SALT_PREPARATION_DEFINITION).toMatchObject({
      dissolutionMode: 'complete-on-mix',
      targetMassG: 4.90,
      massToleranceG: 0.01,
      targetVolumeL: 0.250,
      volumeToleranceL: 0.001,
    });
  });

  it('reuses the 250 mL mark and 300 mL sandbox capacity convention', () => {
    const apparatus = MOHRS_SALT_PREPARATION_CONFIGURATION
      .apparatus[MOHRS_SALT_PREPARATION_VESSEL_ID]!;
    expect(apparatus.kind).toBe('volumetric-flask');
    expect(apparatus.capacityL).toBe(0.300);
    expect(MOHRS_SALT_PREPARATION_DEFINITION.targetVolumeL).toBe(0.250);
  });
});

describe("named Mohr's-salt preparation behavior", () => {
  it('prepares an on-target acidified 250 mL 0.05 M solution', () => {
    const result = deriveMohrsSaltPreparationResult(completePreparation());
    expect(result.validity).toBe('on-target');
    expect(result.acidificationPerformed).toBe(true);
    expect(result.actualMassEquivalentG).toBeCloseTo(4.90, 15);
    expect(result.actualVolumeL).toBe(0.250);
    expect(result.actualConcentrationMolPerL).toBeCloseTo(0.05, 15);
  });

  it('keeps target material undissolved until mix then dissolves it completely', () => {
    let state = create();
    state = apply(state, {
      type: 'add-material',
      materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
      measuredMassG: 4.90,
    });
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.1 });
    const before = state.preparation.chemistryState.vessels
      [MOHRS_SALT_PREPARATION_VESSEL_ID]!.contents;
    expect(before.undissolvedAmountsMol[MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID])
      .toBeCloseTo(0.0125, 15);
    state = apply(state, { type: 'mix' });
    const after = state.preparation.chemistryState.vessels
      [MOHRS_SALT_PREPARATION_VESSEL_ID]!.contents;
    expect(after.dissolvedAmountsMol[MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID])
      .toBeCloseTo(0.0125, 15);
    expect(after.undissolvedAmountsMol[MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID])
      .toBeUndefined();
  });

  it('makes omitted acidification unusable without changing mathematical concentration', () => {
    const state = completePreparation(4.90, 0.250, false);
    const result = deriveMohrsSaltPreparationResult(state);
    expect(result.validity).toBe('unusable');
    expect(result.issues).toContain('REQUIRED_ACIDIFICATION_MISSING');
    expect(result.acidificationPerformed).toBe(false);
    expect(result.actualConcentrationMolPerL).toBeCloseTo(0.05, 15);
  });

  it('acidification changes only named condition and is idempotent', () => {
    const state = create();
    const preparation = state.preparation;
    const once = apply(state, { type: 'acidify-with-dilute-sulfuric-acid' });
    const twiceResult = applyMohrsSaltPreparationAction(
      once,
      { type: 'acidify-with-dilute-sulfuric-acid' },
    );
    expect(once.acidificationPerformed).toBe(true);
    expect(once.preparation).toBe(preparation);
    expect(twiceResult.outcome).toBe('VALID');
    expect(twiceResult.state).toBe(once);
  });

  it('allows acidification after dissolution and before completion', () => {
    let state = create();
    const actions: PreparationAction[] = [
      {
        type: 'add-material',
        materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
        measuredMassG: 4.90,
      },
      { type: 'add-external-solvent-volume', volumeL: 0.250 },
      { type: 'mix' },
    ];
    for (const action of actions) state = apply(state, action);
    state = apply(state, { type: 'acidify-with-dilute-sulfuric-acid' });
    state = apply(state, { type: 'complete-preparation' });
    expect(deriveMohrsSaltPreparationResult(state).validity).toBe('on-target');
  });

  it('blocks acidification after completion with the exact original state', () => {
    const completed = completePreparation();
    const result = applyMohrsSaltPreparationAction(
      completed,
      { type: 'acidify-with-dilute-sulfuric-acid' },
    );
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('PREPARATION_ALREADY_COMPLETE');
    expect(result.state).toBe(completed);
  });

  it.each([
    ['low mass', 4.7, 4.7 / 392 / 0.25],
    ['high mass', 5.1, 5.1 / 392 / 0.25],
  ] as const)('preserves %s and derives actual concentration', (_, massG, concentration) => {
    const result = deriveMohrsSaltPreparationResult(completePreparation(massG));
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('MASS_OFF_TARGET');
    expect(result.actualConcentrationMolPerL).toBeCloseTo(concentration, 15);
  });

  it.each([
    ['low volume', 0.240, 0.0125 / 0.240],
    ['over-mark volume', 0.260, 0.0125 / 0.260],
  ] as const)('preserves %s and derives actual concentration', (_, volumeL, concentration) => {
    const result = deriveMohrsSaltPreparationResult(
      completePreparation(4.90, volumeL),
    );
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('VOLUME_OFF_TARGET');
    expect(result.actualConcentrationMolPerL).toBeCloseTo(concentration, 15);
  });

  it('blocks volume beyond modeled capacity', () => {
    const state = create();
    const result = applyMohrsSaltPreparationAction(state, {
      type: 'add-external-solvent-volume', volumeL: 0.301,
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('DESTINATION_CAPACITY_EXCEEDED');
    expect(result.state).toBe(state);
  });

  it('classifies undissolved target at completion as unusable', () => {
    let state = create();
    state = apply(state, {
      type: 'add-material',
      materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
      measuredMassG: 4.90,
    });
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.250 });
    state = apply(state, { type: 'acidify-with-dilute-sulfuric-acid' });
    state = apply(state, { type: 'complete-preparation' });
    expect(deriveMohrsSaltPreparationResult(state).issues)
      .toContain('TARGET_MATERIAL_UNDISSOLVED');
  });

  it('preserves configured contamination and classifies it unusable', () => {
    const contaminantId = 'configured-contaminant';
    const extendedConfiguration: ChemistryConfiguration = {
      ...MOHRS_SALT_PREPARATION_CONFIGURATION,
      materials: {
        ...MOHRS_SALT_PREPARATION_CONFIGURATION.materials,
        [contaminantId]: { name: 'Configured contaminant', molarMassGPerMol: 50 },
      },
    };
    let state = create(extendedConfiguration);
    state = apply(state, {
      type: 'add-material', materialId: contaminantId, measuredMassG: 0.5,
    }, extendedConfiguration);
    state = apply(state, { type: 'complete-preparation' }, extendedConfiguration);
    const result = deriveMohrsSaltPreparationResult(state, extendedConfiguration);
    expect(result.validity).toBe('unusable');
    expect(result.issues).toContain('WRONG_MATERIAL_PRESENT');
    expect(state.preparation.chemistryState.vessels[MOHRS_SALT_PREPARATION_VESSEL_ID]!
      .contents.undissolvedAmountsMol[contaminantId]).toBe(0.01);
  });

  it.each([
    ['lower mass boundary', 4.89],
    ['upper mass boundary', 4.91],
  ] as const)('includes the %s', (_, massG) => {
    expect(deriveMohrsSaltPreparationResult(completePreparation(massG)).validity)
      .toBe('on-target');
  });

  it.each([
    ['below mass boundary', 4.8899],
    ['above mass boundary', 4.9101],
  ] as const)('excludes values %s', (_, massG) => {
    expect(deriveMohrsSaltPreparationResult(completePreparation(massG)).issues)
      .toContain('MASS_OFF_TARGET');
  });

  it.each([
    ['lower volume boundary', 0.249],
    ['upper volume boundary', 0.251],
  ] as const)('includes the %s', (_, volumeL) => {
    expect(deriveMohrsSaltPreparationResult(
      completePreparation(4.90, volumeL),
    ).validity).toBe('on-target');
  });

  it('does not mutate named or generic state during acidification', () => {
    const state = create();
    const preparation = state.preparation;
    const chemistry = preparation.chemistryState;
    const next = apply(state, { type: 'acidify-with-dilute-sulfuric-acid' });
    expect(state.acidificationPerformed).toBe(false);
    expect(state.preparation).toBe(preparation);
    expect(state.preparation.chemistryState).toBe(chemistry);
    expect(next).not.toBe(state);
    expect(next.preparation).toBe(preparation);
  });
});
