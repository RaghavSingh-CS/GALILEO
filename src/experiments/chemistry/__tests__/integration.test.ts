import { describe, expect, it } from 'vitest';
import {
  addMohrsSaltTitrationAcid,
  addOxalicAcidTitrationAcid,
  applyMohrsSaltPreparationAction,
  applyMohrsSaltTitrationDelivery,
  applyOxalicAcidPreparationAction,
  applyOxalicAcidTitrationDelivery,
  completeMohrsSaltTitration,
  completeOxalicAcidTitration,
  createMohrsSaltPreparation,
  createMohrsSaltTitration,
  createNextMohrsSaltTitrationTrial,
  createNextOxalicAcidTitrationTrial,
  createOxalicAcidPreparation,
  createOxalicAcidTitration,
  deriveMohrsSaltPreparationResult,
  deriveMohrsSaltTitrationResult,
  deriveOxalicAcidPreparationResult,
  deriveOxalicAcidTitrationResult,
  heatOxalicAcidTitration,
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  prepareMohrsSaltTitrationAliquot,
  prepareOxalicAcidTitrationAliquot,
  startMohrsSaltTitration,
  startOxalicAcidTitration,
} from '..';
import type {
  MohrsSaltPreparationAction,
  MohrsSaltPreparationState,
  MohrsSaltTitrationState,
  PreparationAction,
  PreparationState,
  OxalicAcidTitrationState,
} from '..';

function oxalicPreparation(massG = 3.15): PreparationState {
  let state = createOxalicAcidPreparation().state;
  const actions: PreparationAction[] = [
    { type: 'add-material', materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID, measuredMassG: massG },
    { type: 'add-external-solvent-volume', volumeL: 0.1 },
    { type: 'mix' },
    { type: 'add-external-solvent-volume', volumeL: 0.15 },
    { type: 'complete-preparation' },
  ];
  for (const action of actions) {
    const result = applyOxalicAcidPreparationAction(state, action);
    expect(result.outcome).toBe('VALID');
    state = result.state;
  }
  return state;
}

function mohrsPreparation(massG = 4.9): MohrsSaltPreparationState {
  let state = createMohrsSaltPreparation().state;
  const actions: MohrsSaltPreparationAction[] = [
    { type: 'add-material', materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID, measuredMassG: massG },
    { type: 'add-external-solvent-volume', volumeL: 0.1 },
    { type: 'mix' },
    { type: 'acidify-with-dilute-sulfuric-acid' },
    { type: 'add-external-solvent-volume', volumeL: 0.15 },
    { type: 'complete-preparation' },
  ];
  for (const action of actions) {
    const result = applyMohrsSaltPreparationAction(state, action);
    expect(result.outcome).toBe('VALID');
    state = result.state;
  }
  return state;
}

function setupOxalic(source: PreparationState): OxalicAcidTitrationState {
  let state = createOxalicAcidTitration(source).state;
  state = prepareOxalicAcidTitrationAliquot(state).state;
  state = addOxalicAcidTitrationAcid(state).state;
  state = heatOxalicAcidTitration(state, 55).state;
  return startOxalicAcidTitration(state, 1.25).state;
}

function setupMohrs(source: MohrsSaltPreparationState): MohrsSaltTitrationState {
  let state = createMohrsSaltTitration(source).state;
  state = prepareMohrsSaltTitrationAliquot(state).state;
  state = addMohrsSaltTitrationAcid(state).state;
  return startMohrsSaltTitration(state, 2.1).state;
}

describe('public Chemistry integration facade', () => {
  it('runs the complete oxalic preparation and titration workflow', () => {
    const prepared = oxalicPreparation();
    const preparationResult = deriveOxalicAcidPreparationResult(prepared);
    expect(preparationResult.validity).toBe('on-target');
    expect(preparationResult.actualConcentrationMolPerL).toBeCloseTo(0.1, 15);
    let trial = setupOxalic(prepared);
    const before = JSON.stringify(trial);
    trial = applyOxalicAcidTitrationDelivery(trial, 30).state;
    trial = applyOxalicAcidTitrationDelivery(trial, 10).state;
    trial = applyOxalicAcidTitrationDelivery(trial, 0.01).state;
    expect(JSON.stringify(trial)).not.toBe(before);
    expect(deriveOxalicAcidTitrationResult(trial)
      .permanganateAssessment?.indicatorState).toBe('endpoint');
    trial = completeOxalicAcidTitration(trial).state;
    const result = deriveOxalicAcidTitrationResult(trial);
    expect(result.usability).toBe('usable');
    expect(result.reactionProgress?.consumedPermanganateMol).toBeCloseTo(0.0004, 15);
    expect(result.generatedCo2Mol).toBeCloseTo(0.002, 15);
    expect(result.calculatedTitrantMolarityMolPerL).toBeCloseTo(0.01, 4);
  });

  it("runs the complete Mohr's-salt preparation and titration workflow", () => {
    const prepared = mohrsPreparation();
    expect(deriveMohrsSaltPreparationResult(prepared)).toMatchObject({
      validity: 'on-target', actualConcentrationMolPerL: 0.05,
    });
    let trial = setupMohrs(prepared);
    trial = applyMohrsSaltTitrationDelivery(trial, 8).state;
    trial = applyMohrsSaltTitrationDelivery(trial, 2).state;
    trial = applyMohrsSaltTitrationDelivery(trial, 0.01).state;
    expect(deriveMohrsSaltTitrationResult(trial)
      .permanganateAssessment?.indicatorState).toBe('endpoint');
    trial = completeMohrsSaltTitration(trial).state;
    const result = deriveMohrsSaltTitrationResult(trial);
    expect(result.usability).toBe('usable');
    expect(result.reactionProgress?.consumedPermanganateMol).toBeCloseTo(0.0001, 15);
    expect(result.calculatedTitrantMolarityMolPerL).toBeCloseTo(0.01, 4);
  });

  it.each([
    ['oxalic', 3.0],
    ['mohr', 4.8],
  ] as const)('propagates an off-target %s preparation through the public workflow', (kind, mass) => {
    if (kind === 'oxalic') {
      let trial = setupOxalic(oxalicPreparation(mass));
      const reactive = deriveOxalicAcidTitrationResult(trial).availableReactiveOxalateMol;
      const endpointMl = (reactive * 2 / 5) / 0.01 * 1000;
      trial = applyOxalicAcidTitrationDelivery(trial, endpointMl + 0.01).state;
      trial = completeOxalicAcidTitration(trial).state;
      const result = deriveOxalicAcidTitrationResult(trial);
      expect(result.usability).toBe('usable');
      expect(result.calculatedTitrantMolarityMolPerL)
        .not.toBeCloseTo(result.actualTitrantMolarityMolPerL, 5);
    } else {
      let trial = setupMohrs(mohrsPreparation(mass));
      const reactive = deriveMohrsSaltTitrationResult(trial).availableReactiveIronMol;
      const endpointMl = (reactive / 5) / 0.01 * 1000;
      trial = applyMohrsSaltTitrationDelivery(trial, endpointMl + 0.01).state;
      trial = completeMohrsSaltTitration(trial).state;
      const result = deriveMohrsSaltTitrationResult(trial);
      expect(result.usability).toBe('usable');
      expect(result.calculatedTitrantMolarityMolPerL)
        .not.toBeCloseTo(result.actualTitrantMolarityMolPerL, 5);
    }
  });

  it('reports invalid scientific procedure through stable named reason codes', () => {
    let oxalic = createOxalicAcidTitration(oxalicPreparation()).state;
    oxalic = prepareOxalicAcidTitrationAliquot(oxalic).state;
    oxalic = startOxalicAcidTitration(oxalic, 0).state;
    oxalic = applyOxalicAcidTitrationDelivery(oxalic, 40.1).state;
    expect(deriveOxalicAcidTitrationResult(oxalic).issues).toEqual([
      'ACID_MEDIUM_INSUFFICIENT', 'TEMPERATURE_TOO_LOW',
    ]);

    let mohr = createMohrsSaltTitration(mohrsPreparation()).state;
    mohr = prepareMohrsSaltTitrationAliquot(mohr).state;
    mohr = startMohrsSaltTitration(mohr, 0).state;
    mohr = applyMohrsSaltTitrationDelivery(mohr, 10.1).state;
    expect(deriveMohrsSaltTitrationResult(mohr).issues)
      .toEqual(['ACID_MEDIUM_INSUFFICIENT']);
  });

  it('creates independent repeated trials from remaining prepared solutions', () => {
    let firstOxalic = setupOxalic(oxalicPreparation());
    firstOxalic = applyOxalicAcidTitrationDelivery(firstOxalic, 40.01).state;
    firstOxalic = completeOxalicAcidTitration(firstOxalic).state;
    const firstBefore = JSON.stringify(firstOxalic);
    let secondOxalic = createNextOxalicAcidTitrationTrial(firstOxalic).state;
    secondOxalic = prepareOxalicAcidTitrationAliquot(secondOxalic).state;
    secondOxalic = addOxalicAcidTitrationAcid(secondOxalic).state;
    secondOxalic = heatOxalicAcidTitration(secondOxalic, 55).state;
    secondOxalic = startOxalicAcidTitration(secondOxalic, 3).state;
    expect(secondOxalic.volumetric.trial.status).toBe('in-progress');
    expect(JSON.stringify(firstOxalic)).toBe(firstBefore);

    let firstMohr = setupMohrs(mohrsPreparation());
    firstMohr = applyMohrsSaltTitrationDelivery(firstMohr, 10.01).state;
    firstMohr = completeMohrsSaltTitration(firstMohr).state;
    const secondMohr = createNextMohrsSaltTitrationTrial(firstMohr).state;
    expect(secondMohr.volumetric.trial.status).toBe('not-started');
    expect(secondMohr.volumetric.chemistryState).not.toBe(
      firstMohr.volumetric.chemistryState,
    );
  });

  it('preserves completed state exactly when further delivery is blocked', () => {
    let trial = setupMohrs(mohrsPreparation());
    trial = completeMohrsSaltTitration(trial).state;
    const result = applyMohrsSaltTitrationDelivery(trial, 1);
    expect(result.outcome).toBe('BLOCKED');
    expect(result.state).toBe(trial);
  });
});
