import { describe, expect, it } from 'vitest';
import type { ChemistryConfiguration } from '../core';
import {
  applyPreparationAction,
  derivePreparationResult,
} from '../preparation';
import type { PreparationAction, PreparationState } from '../preparation';
import {
  applyOxalicAcidPreparationAction,
  createOxalicAcidPreparation,
  deriveOxalicAcidPreparationResult,
  OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  OXALIC_ACID_PREPARATION_CONFIGURATION,
  OXALIC_ACID_PREPARATION_DEFINITION,
  OXALIC_ACID_PREPARATION_SPEC,
  OXALIC_ACID_PREPARATION_VESSEL_ID,
} from '../preparation/named';

function create(): PreparationState {
  const result = createOxalicAcidPreparation();
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function apply(state: PreparationState, action: PreparationAction): PreparationState {
  const result = applyOxalicAcidPreparationAction(state, action);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function completePreparation(
  massG: number = OXALIC_ACID_PREPARATION_SPEC.targetMassG,
  finalVolumeL: number = OXALIC_ACID_PREPARATION_SPEC.targetVolumeL,
): PreparationState {
  let state = create();
  state = apply(state, {
    type: 'add-material',
    materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
    measuredMassG: massG,
  });
  state = apply(state, {
    type: 'add-external-solvent-volume',
    volumeL: finalVolumeL,
  });
  state = apply(state, { type: 'mix' });
  return apply(state, { type: 'complete-preparation' });
}

describe('named oxalic-acid preparation constants', () => {
  it('uses oxalic acid dihydrate with the authoritative bounded constants', () => {
    const material = OXALIC_ACID_PREPARATION_CONFIGURATION
      .materials[OXALIC_ACID_DIHYDRATE_MATERIAL_ID]!;
    expect(material.name).toBe('Oxalic acid dihydrate');
    expect(material.molarMassGPerMol).toBe(126);
    expect(OXALIC_ACID_PREPARATION_SPEC.targetMolarityMolPerL).toBe(0.1);
    expect(OXALIC_ACID_PREPARATION_SPEC.targetVolumeL).toBe(0.250);
    expect(OXALIC_ACID_PREPARATION_SPEC.targetMassG).toBe(3.15);
    expect(0.1 * 0.250 * 126).toBeCloseTo(3.15, 15);
  });

  it('configures the named definition without adding new mechanics', () => {
    expect(OXALIC_ACID_PREPARATION_DEFINITION).toMatchObject({
      targetMaterialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
      vesselId: OXALIC_ACID_PREPARATION_VESSEL_ID,
      dissolutionMode: 'complete-on-mix',
      targetMassG: 3.15,
      massToleranceG: 0.01,
      targetVolumeL: 0.250,
      volumeToleranceL: 0.001,
    });
  });

  it('separates the 250 mL mark from the modeled 300 mL sandbox capacity', () => {
    const apparatus = OXALIC_ACID_PREPARATION_CONFIGURATION
      .apparatus[OXALIC_ACID_PREPARATION_VESSEL_ID]!;
    expect(apparatus.kind).toBe('volumetric-flask');
    expect(apparatus.capacityL).toBe(0.300);
    expect(apparatus.capacityL).toBeGreaterThan(
      OXALIC_ACID_PREPARATION_DEFINITION.targetVolumeL,
    );
  });
});

describe('named oxalic-acid preparation behavior', () => {
  it('produces an on-target 250 mL 0.1 M preparation', () => {
    const completed = completePreparation();
    const result = deriveOxalicAcidPreparationResult(completed);
    expect(result.validity).toBe('on-target');
    expect(result.actualMassEquivalentG).toBe(3.15);
    expect(result.actualVolumeL).toBe(0.250);
    expect(result.actualConcentrationMolPerL).toBeCloseTo(0.1, 15);
  });

  it('supports solvent addition before and after bounded dissolution', () => {
    let state = create();
    state = apply(state, {
      type: 'add-material',
      materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
      measuredMassG: 3.15,
    });
    const beforeSolvent = state.chemistryState.vessels
      [OXALIC_ACID_PREPARATION_VESSEL_ID]!.contents;
    expect(beforeSolvent.undissolvedAmountsMol[OXALIC_ACID_DIHYDRATE_MATERIAL_ID])
      .toBeCloseTo(0.025, 15);
    expect(beforeSolvent.dissolvedAmountsMol[OXALIC_ACID_DIHYDRATE_MATERIAL_ID])
      .toBeUndefined();
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.1 });
    state = apply(state, { type: 'mix' });
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.15 });
    const contents = state.chemistryState.vessels
      [OXALIC_ACID_PREPARATION_VESSEL_ID]!.contents;
    expect(contents.dissolvedAmountsMol[OXALIC_ACID_DIHYDRATE_MATERIAL_ID])
      .toBeCloseTo(0.025, 15);
    expect(contents.undissolvedAmountsMol[OXALIC_ACID_DIHYDRATE_MATERIAL_ID])
      .toBeUndefined();
    expect(contents.volumeL).toBe(0.25);
  });

  it.each([
    ['low mass', 3, 3 / 126 / 0.25],
    ['high mass', 3.3, 3.3 / 126 / 0.25],
  ] as const)('preserves %s and derives its actual concentration', (_, massG, concentration) => {
    const result = deriveOxalicAcidPreparationResult(completePreparation(massG));
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('MASS_OFF_TARGET');
    expect(result.actualConcentrationMolPerL).toBeCloseTo(concentration, 15);
  });

  it.each([
    ['low volume', 0.240, 0.025 / 0.240],
    ['high over-mark volume', 0.260, 0.025 / 0.260],
  ] as const)('preserves %s and derives its actual concentration', (_, volumeL, concentration) => {
    const result = deriveOxalicAcidPreparationResult(
      completePreparation(3.15, volumeL),
    );
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('VOLUME_OFF_TARGET');
    expect(result.actualConcentrationMolPerL).toBeCloseTo(concentration, 15);
  });

  it('blocks attempts beyond the modeled flask capacity', () => {
    const state = create();
    const result = applyOxalicAcidPreparationAction(state, {
      type: 'add-external-solvent-volume', volumeL: 0.301,
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.messages[0]!.code).toBe('DESTINATION_CAPACITY_EXCEEDED');
    expect(result.state).toBe(state);
  });

  it('classifies completion before dissolution as unusable', () => {
    let state = create();
    state = apply(state, {
      type: 'add-material',
      materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
      measuredMassG: 3.15,
    });
    state = apply(state, { type: 'add-external-solvent-volume', volumeL: 0.250 });
    state = apply(state, { type: 'complete-preparation' });
    const result = deriveOxalicAcidPreparationResult(state);
    expect(result.validity).toBe('unusable');
    expect(result.issues).toContain('TARGET_MATERIAL_UNDISSOLVED');
    expect(result.actualConcentrationMolPerL).toBeNull();
  });

  it('classifies configured contamination as unusable and preserves it', () => {
    const contaminantId = 'configured-contaminant';
    const extendedConfiguration: ChemistryConfiguration = {
      ...OXALIC_ACID_PREPARATION_CONFIGURATION,
      materials: {
        ...OXALIC_ACID_PREPARATION_CONFIGURATION.materials,
        [contaminantId]: { name: 'Configured contaminant', molarMassGPerMol: 50 },
      },
    };
    let state = create();
    state = applyPreparationAction(
      OXALIC_ACID_PREPARATION_DEFINITION,
      extendedConfiguration,
      state,
      { type: 'add-material', materialId: contaminantId, measuredMassG: 0.5 },
    ).state;
    state = applyPreparationAction(
      OXALIC_ACID_PREPARATION_DEFINITION,
      extendedConfiguration,
      state,
      { type: 'complete-preparation' },
    ).state;
    const result = derivePreparationResult(
      OXALIC_ACID_PREPARATION_DEFINITION,
      extendedConfiguration,
      state,
    );
    expect(result.validity).toBe('unusable');
    expect(result.issues).toContain('WRONG_MATERIAL_PRESENT');
    expect(state.chemistryState.vessels[OXALIC_ACID_PREPARATION_VESSEL_ID]!
      .contents.undissolvedAmountsMol[contaminantId]).toBe(0.01);
  });

  it('uses actual inventory rather than measured-mass history', () => {
    const completed = completePreparation();
    const inconsistent: PreparationState = {
      ...completed,
      measuredMassesG: { [OXALIC_ACID_DIHYDRATE_MATERIAL_ID]: 1 },
    };
    expect(deriveOxalicAcidPreparationResult(inconsistent).validity).toBe('on-target');
  });

  it('applies prototype physical tolerances without IEEE classification tolerance', () => {
    expect(deriveOxalicAcidPreparationResult(completePreparation(3.159, 0.2509)).validity)
      .toBe('on-target');
    expect(deriveOxalicAcidPreparationResult(completePreparation(3.161, 0.250)).issues)
      .toContain('MASS_OFF_TARGET');
    expect(deriveOxalicAcidPreparationResult(completePreparation(3.15, 0.2511)).issues)
      .toContain('VOLUME_OFF_TARGET');
  });

  it.each([
    ['lower mass boundary', 3.14],
    ['upper mass boundary', 3.16],
  ] as const)('classifies the inclusive %s as on-target', (_, massG) => {
    expect(deriveOxalicAcidPreparationResult(
      completePreparation(massG, 0.250),
    ).validity).toBe('on-target');
  });

  it.each([
    ['below lower mass boundary', 3.1399],
    ['above upper mass boundary', 3.1601],
  ] as const)('classifies %s as off-target', (_, massG) => {
    const result = deriveOxalicAcidPreparationResult(
      completePreparation(massG, 0.250),
    );
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('MASS_OFF_TARGET');
  });

  it.each([
    ['lower volume boundary', 0.249],
    ['upper volume boundary', 0.251],
  ] as const)('classifies the inclusive %s as on-target', (_, volumeL) => {
    expect(deriveOxalicAcidPreparationResult(
      completePreparation(3.15, volumeL),
    ).validity).toBe('on-target');
  });

  it.each([
    ['below lower volume boundary', 0.2489],
    ['above upper volume boundary', 0.2511],
  ] as const)('classifies %s as off-target', (_, volumeL) => {
    const result = deriveOxalicAcidPreparationResult(
      completePreparation(3.15, volumeL),
    );
    expect(result.validity).toBe('off-target');
    expect(result.issues).toContain('VOLUME_OFF_TARGET');
  });

  it('does not mutate configuration or prior state', () => {
    const configurationBefore = JSON.stringify(OXALIC_ACID_PREPARATION_CONFIGURATION);
    const state = create();
    const vessel = state.chemistryState.vessels[OXALIC_ACID_PREPARATION_VESSEL_ID];
    const next = apply(state, {
      type: 'add-material',
      materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
      measuredMassG: 3.15,
    });
    expect(state.chemistryState.vessels[OXALIC_ACID_PREPARATION_VESSEL_ID])
      .toBe(vessel);
    expect(next).not.toBe(state);
    expect(JSON.stringify(OXALIC_ACID_PREPARATION_CONFIGURATION))
      .toBe(configurationBefore);
  });
});
