import {
  addMaterial,
  isAtMostWithinFloatingPointTolerance,
  snapToBoundaryIfNumericallyEqual,
} from '../core';
import type {
  ChemistryConfiguration,
  ChemistryMessage,
  MaterialId,
  VesselState,
} from '../core';
import type {
  PreparationAction,
  PreparationActionResult,
  PreparationDefinition,
  PreparationMessageCode,
  PreparationState,
} from './types';
import { isPreparationStateValid, preparationInputIssue } from './validation';

function message(
  code: PreparationMessageCode,
  text: string,
  definition: PreparationDefinition,
): ChemistryMessage {
  return {
    code,
    severity: 'error',
    message: text,
    apparatusIds: [definition.vesselId],
    materialIds: [definition.targetMaterialId],
  };
}

function blocked(
  state: PreparationState,
  definition: PreparationDefinition,
  code: PreparationMessageCode,
  text: string,
): PreparationActionResult {
  return { outcome: 'BLOCKED', state, messages: [message(code, text, definition)] };
}

function valid(state: PreparationState): PreparationActionResult {
  return { outcome: 'VALID', state, messages: [] };
}

export function createPreparation(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
  chemistryState: PreparationState['chemistryState'],
): PreparationActionResult {
  const initial: PreparationState = {
    chemistryState,
    lifecycle: 'in-progress',
    measuredMassesG: {},
  };
  const issue = preparationInputIssue(definition, configuration, chemistryState);
  return issue
    ? blocked(initial, definition, issue, 'Preparation input is invalid.')
    : valid(initial);
}

function replaceVessel(
  state: PreparationState,
  vesselId: string,
  vessel: VesselState,
): PreparationState {
  return {
    ...state,
    chemistryState: {
      ...state.chemistryState,
      vessels: { ...state.chemistryState.vessels, [vesselId]: vessel },
    },
  };
}

function applyAddMaterial(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
  state: PreparationState,
  materialId: MaterialId,
  measuredMassG: number,
): PreparationActionResult {
  const coreResult = addMaterial(configuration, state.chemistryState, {
    type: 'add-material',
    targetApparatusId: definition.vesselId,
    materialId,
    quantity: { kind: 'mass', massG: measuredMassG },
  });
  if (coreResult.outcome === 'BLOCKED') {
    return { outcome: 'BLOCKED', state, messages: coreResult.messages };
  }
  const previousMassG = state.measuredMassesG[materialId] ?? 0;
  const nextMassG = previousMassG + measuredMassG;
  if (!Number.isFinite(nextMassG)) {
    return blocked(
      state,
      definition,
      'INVALID_RESULTING_STATE',
      'Measured-mass history would become invalid.',
    );
  }
  return valid({
    ...state,
    chemistryState: coreResult.state,
    measuredMassesG: { ...state.measuredMassesG, [materialId]: nextMassG },
  });
}

function applySolventVolume(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
  state: PreparationState,
  volumeL: number,
): PreparationActionResult {
  if (!Number.isFinite(volumeL) || volumeL <= 0) {
    return blocked(state, definition, 'INVALID_SOLVENT_VOLUME',
      'Solvent volume must be finite and positive.');
  }
  const vessel = state.chemistryState.vessels[definition.vesselId]!;
  const apparatus = configuration.apparatus[definition.vesselId]!;
  const rawVolumeL = vessel.contents.volumeL + volumeL;
  if (!Number.isFinite(rawVolumeL)
    || !isAtMostWithinFloatingPointTolerance(rawVolumeL, apparatus.capacityL)) {
    return blocked(state, definition, 'DESTINATION_CAPACITY_EXCEEDED',
      'Solvent addition would exceed vessel capacity.');
  }
  const nextVolumeL = snapToBoundaryIfNumericallyEqual(rawVolumeL, apparatus.capacityL);
  return valid(replaceVessel(state, definition.vesselId, {
    ...vessel,
    contents: { ...vessel.contents, volumeL: nextVolumeL },
  }));
}

function applyMix(
  definition: PreparationDefinition,
  state: PreparationState,
): PreparationActionResult {
  if (definition.dissolutionMode === 'unsupported') {
    return blocked(state, definition, 'DISSOLUTION_UNSUPPORTED',
      'This preparation definition does not support dissolution.');
  }
  const vessel = state.chemistryState.vessels[definition.vesselId]!;
  if (vessel.contents.volumeL === 0) {
    return blocked(state, definition, 'SOLVENT_REQUIRED',
      'Dissolution requires a positive bulk liquid volume.');
  }
  const undissolved = vessel.contents.undissolvedAmountsMol[definition.targetMaterialId] ?? 0;
  if (undissolved === 0) {
    return valid(state);
  }
  const dissolved = vessel.contents.dissolvedAmountsMol[definition.targetMaterialId] ?? 0;
  const nextDissolved = dissolved + undissolved;
  if (!Number.isFinite(nextDissolved)) {
    return blocked(state, definition, 'INVALID_RESULTING_STATE',
      'Dissolution would produce an invalid material amount.');
  }
  const nextUndissolved = { ...vessel.contents.undissolvedAmountsMol };
  delete nextUndissolved[definition.targetMaterialId];
  return valid(replaceVessel(state, definition.vesselId, {
    ...vessel,
    contents: {
      ...vessel.contents,
      dissolvedAmountsMol: {
        ...vessel.contents.dissolvedAmountsMol,
        [definition.targetMaterialId]: nextDissolved,
      },
      undissolvedAmountsMol: nextUndissolved,
    },
  }));
}

export function applyPreparationAction(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
  state: PreparationState,
  action: PreparationAction,
): PreparationActionResult {
  const issue = preparationInputIssue(definition, configuration, state.chemistryState);
  if (issue) {
    return blocked(state, definition, issue, 'Preparation input is invalid.');
  }
  if (!isPreparationStateValid(state, configuration)) {
    return blocked(state, definition, 'INVALID_STATE',
      'Preparation history or lifecycle is invalid.');
  }
  if (state.lifecycle === 'complete') {
    return blocked(state, definition, 'PREPARATION_ALREADY_COMPLETE',
      'A completed preparation cannot be changed.');
  }
  switch (action.type) {
    case 'add-material':
      return applyAddMaterial(
        definition,
        configuration,
        state,
        action.materialId,
        action.measuredMassG,
      );
    case 'add-external-solvent-volume':
      return applySolventVolume(definition, configuration, state, action.volumeL);
    case 'mix':
      return applyMix(definition, state);
    case 'complete-preparation':
      return valid({ ...state, lifecycle: 'complete' });
  }
}
