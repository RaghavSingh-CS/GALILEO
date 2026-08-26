import { isFiniteNumber, isNonNegativeNumber, isPositiveNumber } from './numeric';
import { APPARATUS_KINDS } from './types';
import type {
  ApparatusId,
  ChemistryConfiguration,
  ChemistryState,
  MaterialId,
} from './types';

export type StateValidationCode =
  | 'EMPTY_APPARATUS_ID'
  | 'INVALID_APPARATUS_KIND'
  | 'INVALID_CAPACITY'
  | 'INVALID_HEATING_CAPABILITY'
  | 'EMPTY_MATERIAL_ID'
  | 'EMPTY_MATERIAL_NAME'
  | 'INVALID_MOLAR_MASS'
  | 'UNKNOWN_APPARATUS'
  | 'MISSING_VESSEL'
  | 'INVALID_VOLUME'
  | 'CAPACITY_EXCEEDED'
  | 'INVALID_TEMPERATURE'
  | 'UNKNOWN_MATERIAL'
  | 'INVALID_MATERIAL_AMOUNT';

export interface StateValidationIssue {
  readonly code: StateValidationCode;
  readonly path: string;
  readonly message: string;
  readonly apparatusId?: ApparatusId;
  readonly materialId?: MaterialId;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

const APPARATUS_KIND_SET: ReadonlySet<string> = new Set(APPARATUS_KINDS);

export function validateChemistryConfiguration(
  configuration: ChemistryConfiguration,
): StateValidationIssue[] {
  const issues: StateValidationIssue[] = [];

  for (const [apparatusId, apparatus] of Object.entries(configuration.apparatus)) {
    if (!hasText(apparatusId)) {
      issues.push({
        code: 'EMPTY_APPARATUS_ID',
        path: `apparatus.${apparatusId}`,
        message: 'Apparatus record keys must not be empty.',
        apparatusId,
      });
    }

    if (!isPositiveNumber(apparatus.capacityL)) {
      issues.push({
        code: 'INVALID_CAPACITY',
        path: `apparatus.${apparatusId}.capacityL`,
        message: 'Apparatus capacity must be finite and positive.',
        apparatusId,
      });
    }

    if (!APPARATUS_KIND_SET.has(apparatus.kind)) {
      issues.push({
        code: 'INVALID_APPARATUS_KIND',
        path: `apparatus.${apparatusId}.kind`,
        message: 'Apparatus kind must be a supported Chemistry core kind.',
        apparatusId,
      });
    }

    if (typeof apparatus.supportsHeating !== 'boolean') {
      issues.push({
        code: 'INVALID_HEATING_CAPABILITY',
        path: `apparatus.${apparatusId}.supportsHeating`,
        message: 'Heating capability must be a boolean.',
        apparatusId,
      });
    }
  }

  for (const [materialId, material] of Object.entries(configuration.materials)) {
    if (!hasText(materialId)) {
      issues.push({
        code: 'EMPTY_MATERIAL_ID',
        path: `materials.${materialId}`,
        message: 'Material record keys must not be empty.',
        materialId,
      });
    }

    if (!hasText(material.name)) {
      issues.push({
        code: 'EMPTY_MATERIAL_NAME',
        path: `materials.${materialId}.name`,
        message: 'Material names must not be empty.',
        materialId,
      });
    }

    if (!isPositiveNumber(material.molarMassGPerMol)) {
      issues.push({
        code: 'INVALID_MOLAR_MASS',
        path: `materials.${materialId}.molarMassGPerMol`,
        message: 'Molar mass must be finite and positive.',
        materialId,
      });
    }
  }

  return issues;
}

function validateMaterialAmounts(
  amounts: Readonly<Record<MaterialId, number>>,
  path: string,
  apparatusId: ApparatusId,
  configuration: ChemistryConfiguration,
): StateValidationIssue[] {
  const issues: StateValidationIssue[] = [];

  for (const [materialId, amountMol] of Object.entries(amounts)) {
    if (!hasText(materialId)) {
      issues.push({
        code: 'EMPTY_MATERIAL_ID',
        path: `${path}.${materialId}`,
        message: 'Material amount record keys must not be empty.',
        apparatusId,
        materialId,
      });
    } else if (!(materialId in configuration.materials)) {
      issues.push({
        code: 'UNKNOWN_MATERIAL',
        path: `${path}.${materialId}`,
        message: 'Material amounts must reference configured materials.',
        apparatusId,
        materialId,
      });
    }

    if (!isNonNegativeNumber(amountMol)) {
      issues.push({
        code: 'INVALID_MATERIAL_AMOUNT',
        path: `${path}.${materialId}`,
        message: 'Material amounts must be finite and nonnegative.',
        apparatusId,
        materialId,
      });
    }
  }

  return issues;
}

export function validateChemistryState(
  state: ChemistryState,
  configuration: ChemistryConfiguration,
): StateValidationIssue[] {
  const issues = validateChemistryConfiguration(configuration);

  for (const apparatusId of Object.keys(configuration.apparatus)) {
    if (!(apparatusId in state.vessels)) {
      issues.push({
        code: 'MISSING_VESSEL',
        path: `vessels.${apparatusId}`,
        message: 'Configured apparatus must have corresponding vessel state.',
        apparatusId,
      });
    }
  }

  for (const [apparatusId, vessel] of Object.entries(state.vessels)) {
    const apparatus = configuration.apparatus[apparatusId];

    if (!hasText(apparatusId)) {
      issues.push({
        code: 'EMPTY_APPARATUS_ID',
        path: `vessels.${apparatusId}`,
        message: 'Vessel record keys must not be empty.',
        apparatusId,
      });
    }

    if (!apparatus) {
      issues.push({
        code: 'UNKNOWN_APPARATUS',
        path: `vessels.${apparatusId}`,
        message: 'Vessel state must reference configured apparatus.',
        apparatusId,
      });
    }

    if (!isNonNegativeNumber(vessel.contents.volumeL)) {
      issues.push({
        code: 'INVALID_VOLUME',
        path: `vessels.${apparatusId}.contents.volumeL`,
        message: 'Liquid volume must be finite and nonnegative.',
        apparatusId,
      });
    } else if (apparatus && isPositiveNumber(apparatus.capacityL)
      && vessel.contents.volumeL > apparatus.capacityL) {
      issues.push({
        code: 'CAPACITY_EXCEEDED',
        path: `vessels.${apparatusId}.contents.volumeL`,
        message: 'Liquid volume must not exceed apparatus capacity.',
        apparatusId,
      });
    }

    if (!isFiniteNumber(vessel.temperatureC)) {
      issues.push({
        code: 'INVALID_TEMPERATURE',
        path: `vessels.${apparatusId}.temperatureC`,
        message: 'Temperature must be finite.',
        apparatusId,
      });
    }

    issues.push(...validateMaterialAmounts(
      vessel.contents.dissolvedAmountsMol,
      `vessels.${apparatusId}.contents.dissolvedAmountsMol`,
      apparatusId,
      configuration,
    ));
    issues.push(...validateMaterialAmounts(
      vessel.contents.undissolvedAmountsMol,
      `vessels.${apparatusId}.contents.undissolvedAmountsMol`,
      apparatusId,
      configuration,
    ));
  }

  return issues;
}

export function isChemistryStateValid(
  state: ChemistryState,
  configuration: ChemistryConfiguration,
): boolean {
  return validateChemistryState(state, configuration).length === 0;
}
