import { describe, expect, it } from 'vitest';
import {
  applyMohrsSaltPreparationAction,
  createMohrsSaltPreparation,
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  MOHRS_SALT_PREPARATION_SPEC,
} from '../preparation/named';
import type {
  MohrsSaltPreparationAction,
  MohrsSaltPreparationState,
} from '../preparation/named';
import {
  addMohrsSaltTitrationAcid,
  applyMohrsSaltTitrationDelivery,
  completeMohrsSaltTitration,
  createMohrsSaltTitration,
  deriveMohrsSaltReactionProgress,
  deriveMohrsSaltTitrationResult,
  MOHRS_SALT_TITRATION_SPEC,
  MOHRS_TITRATION_ACID_SOURCE_ID,
  MOHRS_TITRATION_BURETTE_ID,
  MOHRS_TITRATION_FLASK_ID,
  POTASSIUM_PERMANGANATE_MATERIAL_ID,
  prepareMohrsSaltTitrationAliquot,
  startMohrsSaltTitration,
  SULFURIC_ACID_MATERIAL_ID,
} from '../permanganate/named';
import type { MohrsSaltTitrationState } from '../permanganate/named';

function applyPreparation(
  state: MohrsSaltPreparationState,
  action: MohrsSaltPreparationAction,
): MohrsSaltPreparationState {
  const result = applyMohrsSaltPreparationAction(state, action);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

function preparation(
  massG: number = MOHRS_SALT_PREPARATION_SPEC.targetMassG,
  finalVolumeL: number = MOHRS_SALT_PREPARATION_SPEC.targetVolumeL,
  acidified = true,
): MohrsSaltPreparationState {
  let state = createMohrsSaltPreparation().state;
  state = applyPreparation(state, {
    type: 'add-material',
    materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
    measuredMassG: massG,
  });
  state = applyPreparation(state, {
    type: 'add-external-solvent-volume', volumeL: 0.1,
  });
  state = applyPreparation(state, { type: 'mix' });
  if (acidified) {
    state = applyPreparation(state, { type: 'acidify-with-dilute-sulfuric-acid' });
  }
  state = applyPreparation(state, {
    type: 'add-external-solvent-volume', volumeL: finalVolumeL - 0.1,
  });
  return applyPreparation(state, { type: 'complete-preparation' });
}

function setup(
  source = preparation(),
  acid = true,
  initialReadingMl = 1.2,
): MohrsSaltTitrationState {
  let state = createMohrsSaltTitration(source).state;
  state = prepareMohrsSaltTitrationAliquot(state).state;
  if (acid) state = addMohrsSaltTitrationAcid(state).state;
  const started = startMohrsSaltTitration(state, initialReadingMl);
  expect(started.outcome).toBe('VALID');
  return started.state;
}

function deliver(
  state: MohrsSaltTitrationState,
  volumeMl: number,
): MohrsSaltTitrationState {
  const result = applyMohrsSaltTitrationDelivery(state, volumeMl);
  expect(result.outcome).toBe('VALID');
  return result.state;
}

describe("named Mohr's-salt titration configuration", () => {
  it('centralizes the NCERT setup and GALILEO simulation assumptions', () => {
    expect(MOHRS_SALT_TITRATION_SPEC).toMatchObject({
      aliquotVolumeMl: 10,
      nominalStandardMolarityMolPerL: 0.05,
      acidVolumeL: 0.005,
      acidMolarityMolPerL: 1,
      requiredSulfuricAcidMol: 0.005,
      actualTitrantMolarityMolPerL: 0.01,
      permanganateToReactiveIronRatio: 0.2,
      endpointExcessAllowanceMol: 0.0000005,
    });
    expect(MOHRS_SALT_TITRATION_SPEC.endpointExcessAllowanceMol).toBeCloseTo(
      0.00005 * MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL,
      15,
    );
  });
});

describe("named Mohr's-salt reaction and workflow", () => {
  it('creates real titrant and acid inventories and transfers the actual aliquot', () => {
    let state = createMohrsSaltTitration(preparation()).state;
    const initial = state.volumetric.chemistryState;
    expect(initial.vessels[MOHRS_TITRATION_BURETTE_ID]!.contents
      .dissolvedAmountsMol[POTASSIUM_PERMANGANATE_MATERIAL_ID]).toBe(0.0005);
    expect(initial.vessels[MOHRS_TITRATION_ACID_SOURCE_ID]!.contents
      .dissolvedAmountsMol[SULFURIC_ACID_MATERIAL_ID]).toBe(0.005);
    state = prepareMohrsSaltTitrationAliquot(state).state;
    expect(state.volumetric.chemistryState.vessels[MOHRS_TITRATION_FLASK_ID]!
      .contents.dissolvedAmountsMol[MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID])
      .toBeCloseTo(0.0005, 15);
    state = addMohrsSaltTitrationAcid(state).state;
    expect(state.volumetric.chemistryState.vessels[MOHRS_TITRATION_FLASK_ID]!
      .contents.dissolvedAmountsMol[SULFURIC_ACID_MATERIAL_ID]).toBe(0.005);
  });

  it('derives the 1:5 reaction from actual inventory at limiting conditions', () => {
    const before = deriveMohrsSaltReactionProgress(setup());
    expect(before.consumedPermanganateMol).toBe(0);
    expect(before.remainingReactiveCapacityMol).toBeCloseTo(0.0001, 15);

    const limited = deriveMohrsSaltReactionProgress(deliver(setup(), 4));
    expect(limited.consumedPermanganateMol).toBeCloseTo(0.00004, 15);
    expect(limited.remainingReactiveCapacityMol).toBeCloseTo(0.00006, 15);

    const equivalent = deriveMohrsSaltReactionProgress(deliver(setup(), 10));
    expect(equivalent.consumedPermanganateMol).toBeCloseTo(0.0001, 15);
    expect(equivalent.remainingReactiveCapacityMol).toBeCloseTo(0, 15);

    const ironLimited = deriveMohrsSaltTitrationResult(deliver(setup(), 10.1));
    expect(ironLimited.reactionProgress?.consumedPermanganateMol)
      .toBeCloseTo(0.0001, 15);
    expect(ironLimited.permanganateAssessment?.excessPermanganateMol)
      .toBeCloseTo(0.000001, 15);
  });

  it('supports incremental delivery, endpoint observation, overshoot, and independent completion', () => {
    let state = setup(preparation(), true, 2.4);
    state = deliver(state, 8);
    expect(deriveMohrsSaltTitrationResult(state).permanganateAssessment?.indicatorState)
      .toBe('decolorized');
    state = deliver(state, 2);
    expect(deriveMohrsSaltTitrationResult(state).permanganateAssessment?.indicatorState)
      .toBe('decolorized');
    state = deliver(state, 0.01);
    const endpoint = deriveMohrsSaltTitrationResult(state);
    expect(endpoint.permanganateAssessment?.indicatorState).toBe('endpoint');
    expect(state.volumetric.trial.status).toBe('in-progress');
    state = deliver(state, 0.05);
    expect(deriveMohrsSaltTitrationResult(state).permanganateAssessment?.indicatorState)
      .toBe('overshot');
    expect(completeMohrsSaltTitration(state).state.volumetric.trial.status)
      .toBe('completed');
  });
});

describe("named Mohr's-salt scientific usability", () => {
  it('keeps missing acid physically deliverable but scientifically unusable', () => {
    const state = deliver(setup(preparation(), false), 10.01);
    const result = deriveMohrsSaltTitrationResult(state);
    expect(state.volumetric.chemistryState.vessels[MOHRS_TITRATION_FLASK_ID]!
      .contents.dissolvedAmountsMol[POTASSIUM_PERMANGANATE_MATERIAL_ID])
      .toBeGreaterThan(0);
    expect(result.reactionSupported).toBe(false);
    expect(result.usability).toBe('unusable');
    expect(result.issues).toContain('ACID_MEDIUM_INSUFFICIENT');
    expect(result.reactionProgress).toBeNull();
  });

  it('treats quantitatively insufficient acid inventory as unusable', () => {
    const base = setup();
    const flask = base.volumetric.chemistryState.vessels[MOHRS_TITRATION_FLASK_ID]!;
    const insufficient: MohrsSaltTitrationState = {
      ...base,
      volumetric: {
        ...base.volumetric,
        chemistryState: {
          ...base.volumetric.chemistryState,
          vessels: {
            ...base.volumetric.chemistryState.vessels,
            [MOHRS_TITRATION_FLASK_ID]: {
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
    expect(deriveMohrsSaltTitrationResult(insufficient).reactionSupported).toBe(false);
  });

  it('rejects an unusable source preparation but allows off-target propagation', () => {
    const unusable = deriveMohrsSaltTitrationResult(setup(preparation(4.9, 0.25, false)));
    expect(unusable.usability).toBe('unusable');
    expect(unusable.issues).toContain('SOURCE_PREPARATION_UNUSABLE');

    const offTargetSource = preparation(4.8);
    let offTarget = setup(offTargetSource);
    const actualReactiveIron = deriveMohrsSaltTitrationResult(offTarget)
      .availableReactiveIronMol;
    expect(actualReactiveIron).not.toBeCloseTo(0.0005, 8);
    const actualEndpointMl = (actualReactiveIron / 5)
      / MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL * 1000;
    offTarget = deliver(offTarget, actualEndpointMl + 0.01);
    offTarget = completeMohrsSaltTitration(offTarget).state;
    const result = deriveMohrsSaltTitrationResult(offTarget);
    expect(result.usability).toBe('usable');
    expect(result.calculatedTitrantMolarityMolPerL).not.toBeCloseTo(
      result.actualTitrantMolarityMolPerL,
      5,
    );
  });

  it('accepts only a completed endpoint trial for learner calculation', () => {
    const activeEndpoint = deliver(setup(), 10.01);
    expect(deriveMohrsSaltTitrationResult(activeEndpoint).usability).toBe('in-progress');
    const completedEndpoint = completeMohrsSaltTitration(activeEndpoint).state;
    const accepted = deriveMohrsSaltTitrationResult(completedEndpoint);
    expect(accepted.usability).toBe('usable');
    expect(accepted.calculatedTitrantMolarityMolPerL).toBeCloseTo(0.01, 4);

    const early = completeMohrsSaltTitration(deliver(setup(), 9)).state;
    expect(deriveMohrsSaltTitrationResult(early)).toMatchObject({
      usability: 'stopped-early', calculatedTitrantMolarityMolPerL: null,
    });
    const overshot = completeMohrsSaltTitration(deliver(setup(), 10.1)).state;
    expect(deriveMohrsSaltTitrationResult(overshot)).toMatchObject({
      usability: 'overshot', calculatedTitrantMolarityMolPerL: null,
    });
  });

  it('preserves prior states during delivery and derivation', () => {
    const state = setup();
    const before = JSON.stringify(state);
    const next = deliver(state, 1);
    expect(JSON.stringify(state)).toBe(before);
    const nextBefore = JSON.stringify(next);
    deriveMohrsSaltTitrationResult(next);
    expect(JSON.stringify(next)).toBe(nextBefore);
  });
});
