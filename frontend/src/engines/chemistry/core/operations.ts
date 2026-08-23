import { isFiniteNumber, isPositiveNumber } from './numeric';
import {
  validateChemistryConfiguration,
  validateChemistryState,
} from './validation';
import type {
  AddMaterialAction,
  ApparatusId,
  ChemistryConfiguration,
  ChemistryMessage,
  ChemistryState,
  CoreActionResult,
  MaterialId,
  TransferLiquidAction,
  VesselState,
} from './types';

export type CoreOperationMessageCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_STATE'
  | 'UNKNOWN_APPARATUS'
  | 'MISSING_VESSEL_STATE'
  | 'UNKNOWN_MATERIAL'
  | 'INVALID_AMOUNT'
  | 'INVALID_MOLAR_MASS'
  | 'INVALID_TRANSFER_VOLUME'
  | 'SAME_SOURCE_DESTINATION'
  | 'INSUFFICIENT_SOURCE_VOLUME'
  | 'DESTINATION_CAPACITY_EXCEEDED'
  | 'INVALID_RESULTING_STATE';

function operationMessage(
  code: CoreOperationMessageCode,
  text: string,
  apparatusIds: readonly ApparatusId[] = [],
  materialIds: readonly MaterialId[] = [],
): ChemistryMessage {
  return {
    code,
    severity: 'error',
    message: text,
    ...(apparatusIds.length > 0 ? { apparatusIds } : {}),
    ...(materialIds.length > 0 ? { materialIds } : {}),
  };
}

function blocked(state: ChemistryState, issue: ChemistryMessage): CoreActionResult {
  return { outcome: 'BLOCKED', state, messages: [issue] };
}

function validateOperationInput(
  configuration: ChemistryConfiguration,
  state: ChemistryState,
): ChemistryMessage | null {
  if (validateChemistryConfiguration(configuration).length > 0) {
    return operationMessage(
      'INVALID_CONFIGURATION',
      'The Chemistry configuration is invalid.',
    );
  }

  if (validateChemistryState(state, configuration).length > 0) {
    return operationMessage(
      'INVALID_STATE',
      'The Chemistry state is invalid for the supplied configuration.',
    );
  }

  return null;
}

function canonicalizeAmounts(
  amounts: Readonly<Record<MaterialId, number>>,
): Readonly<Record<MaterialId, number>> {
  const canonical: Record<MaterialId, number> = {};
  for (const [materialId, amountMol] of Object.entries(amounts)) {
    if (amountMol !== 0) {
      canonical[materialId] = amountMol;
    }
  }
  return canonical;
}

function withVessel(
  state: ChemistryState,
  apparatusId: ApparatusId,
  vessel: VesselState,
): ChemistryState {
  return {
    ...state,
    vessels: { ...state.vessels, [apparatusId]: vessel },
  };
}

export function addMaterial(
  configuration: ChemistryConfiguration,
  state: ChemistryState,
  action: AddMaterialAction,
): CoreActionResult {
  const inputIssue = validateOperationInput(configuration, state);
  if (inputIssue) {
    return blocked(state, inputIssue);
  }

  if (!configuration.apparatus[action.targetApparatusId]) {
    return blocked(state, operationMessage(
      'UNKNOWN_APPARATUS',
      'The destination apparatus is not configured.',
      [action.targetApparatusId],
    ));
  }

  const vessel = state.vessels[action.targetApparatusId];
  if (!vessel) {
    return blocked(state, operationMessage(
      'MISSING_VESSEL_STATE',
      'The destination apparatus has no vessel state.',
      [action.targetApparatusId],
    ));
  }

  const material = configuration.materials[action.materialId];
  if (!material) {
    return blocked(state, operationMessage(
      'UNKNOWN_MATERIAL',
      'The material is not configured.',
      [action.targetApparatusId],
      [action.materialId],
    ));
  }

  let amountMol: number;
  if (action.quantity.kind === 'mass') {
    if (!isPositiveNumber(action.quantity.massG)) {
      return blocked(state, operationMessage(
        'INVALID_AMOUNT',
        'Material mass must be finite and positive.',
        [action.targetApparatusId],
        [action.materialId],
      ));
    }
    if (!isPositiveNumber(material.molarMassGPerMol)) {
      return blocked(state, operationMessage(
        'INVALID_MOLAR_MASS',
        'Mass cannot be converted using an invalid molar mass.',
        [action.targetApparatusId],
        [action.materialId],
      ));
    }
    amountMol = action.quantity.massG / material.molarMassGPerMol;
  } else {
    amountMol = action.quantity.amountMol;
  }

  if (!isPositiveNumber(amountMol)) {
    return blocked(state, operationMessage(
      'INVALID_AMOUNT',
      'Material amount must be finite and positive.',
      [action.targetApparatusId],
      [action.materialId],
    ));
  }

  const previousAmount = vessel.contents.undissolvedAmountsMol[action.materialId] ?? 0;
  const nextAmount = previousAmount + amountMol;
  if (!isFiniteNumber(nextAmount) || nextAmount <= 0) {
    return blocked(state, operationMessage(
      'INVALID_RESULTING_STATE',
      'Material addition would produce an invalid molar amount.',
      [action.targetApparatusId],
      [action.materialId],
    ));
  }

  const nextVessel: VesselState = {
    ...vessel,
    contents: {
      ...vessel.contents,
      dissolvedAmountsMol: canonicalizeAmounts(vessel.contents.dissolvedAmountsMol),
      undissolvedAmountsMol: canonicalizeAmounts({
        ...vessel.contents.undissolvedAmountsMol,
        [action.materialId]: nextAmount,
      }),
    },
  };

  return {
    outcome: 'VALID',
    state: withVessel(state, action.targetApparatusId, nextVessel),
    messages: [],
  };
}

export function transferLiquid(
  configuration: ChemistryConfiguration,
  state: ChemistryState,
  action: TransferLiquidAction,
): CoreActionResult {
  const inputIssue = validateOperationInput(configuration, state);
  if (inputIssue) {
    return blocked(state, inputIssue);
  }

  if (action.sourceApparatusId === action.targetApparatusId) {
    return blocked(state, operationMessage(
      'SAME_SOURCE_DESTINATION',
      'Liquid transfer requires different source and destination apparatus.',
      [action.sourceApparatusId],
    ));
  }

  if (!configuration.apparatus[action.sourceApparatusId]) {
    return blocked(state, operationMessage(
      'UNKNOWN_APPARATUS',
      'The source apparatus is not configured.',
      [action.sourceApparatusId],
    ));
  }
  const targetApparatus = configuration.apparatus[action.targetApparatusId];
  if (!targetApparatus) {
    return blocked(state, operationMessage(
      'UNKNOWN_APPARATUS',
      'The destination apparatus is not configured.',
      [action.targetApparatusId],
    ));
  }

  const source = state.vessels[action.sourceApparatusId];
  const target = state.vessels[action.targetApparatusId];
  if (!source) {
    return blocked(state, operationMessage(
      'MISSING_VESSEL_STATE',
      'The source apparatus has no vessel state.',
      [action.sourceApparatusId],
    ));
  }
  if (!target) {
    return blocked(state, operationMessage(
      'MISSING_VESSEL_STATE',
      'The destination apparatus has no vessel state.',
      [action.targetApparatusId],
    ));
  }

  if (!isPositiveNumber(action.volumeL)) {
    return blocked(state, operationMessage(
      'INVALID_TRANSFER_VOLUME',
      'Transfer volume must be finite and positive.',
      [action.sourceApparatusId, action.targetApparatusId],
    ));
  }
  if (!isFiniteNumber(source.contents.volumeL)
    || action.volumeL > source.contents.volumeL) {
    return blocked(state, operationMessage(
      'INSUFFICIENT_SOURCE_VOLUME',
      'The source does not contain enough liquid for this transfer.',
      [action.sourceApparatusId],
    ));
  }

  const targetVolumeL = target.contents.volumeL + action.volumeL;
  if (!isFiniteNumber(targetVolumeL)
    || targetVolumeL > targetApparatus.capacityL) {
    return blocked(state, operationMessage(
      'DESTINATION_CAPACITY_EXCEEDED',
      'The transfer would exceed destination capacity.',
      [action.targetApparatusId],
    ));
  }

  const isFullTransfer = action.volumeL === source.contents.volumeL;
  const fraction = action.volumeL / source.contents.volumeL;
  const nextSourceDissolved: Record<MaterialId, number> = {};
  const nextTargetDissolved: Record<MaterialId, number> = {
    ...target.contents.dissolvedAmountsMol,
  };

  for (const [materialId, sourceAmountMol] of Object.entries(
    source.contents.dissolvedAmountsMol,
  )) {
    const transferredAmountMol = isFullTransfer
      ? sourceAmountMol
      : sourceAmountMol * fraction;
    const remainingAmountMol = isFullTransfer
      ? 0
      : sourceAmountMol - transferredAmountMol;
    const targetAmountMol = (nextTargetDissolved[materialId] ?? 0)
      + transferredAmountMol;

    if (!isFiniteNumber(remainingAmountMol)
      || remainingAmountMol < 0
      || !isFiniteNumber(targetAmountMol)
      || targetAmountMol < 0) {
      return blocked(state, operationMessage(
        'INVALID_RESULTING_STATE',
        'Liquid transfer would produce an invalid material amount.',
        [action.sourceApparatusId, action.targetApparatusId],
        [materialId],
      ));
    }

    nextSourceDissolved[materialId] = remainingAmountMol;
    nextTargetDissolved[materialId] = targetAmountMol;
  }

  const nextSource: VesselState = {
    ...source,
    contents: {
      volumeL: isFullTransfer ? 0 : source.contents.volumeL - action.volumeL,
      dissolvedAmountsMol: isFullTransfer
        ? {}
        : canonicalizeAmounts(nextSourceDissolved),
      undissolvedAmountsMol: canonicalizeAmounts(source.contents.undissolvedAmountsMol),
    },
  };
  const nextTarget: VesselState = {
    ...target,
    contents: {
      volumeL: targetVolumeL,
      dissolvedAmountsMol: canonicalizeAmounts(nextTargetDissolved),
      undissolvedAmountsMol: canonicalizeAmounts(target.contents.undissolvedAmountsMol),
    },
  };

  return {
    outcome: 'VALID',
    state: {
      ...state,
      vessels: {
        ...state.vessels,
        [action.sourceApparatusId]: nextSource,
        [action.targetApparatusId]: nextTarget,
      },
    },
    messages: [],
  };
}
