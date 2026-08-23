import {
  getMolarConcentration,
  validateChemistryConfiguration,
  validateChemistryState,
} from '../core';
import type { ChemistryConfiguration, MaterialId } from '../core';
import type {
  PreparationDefinition,
  PreparationIssueCode,
  PreparationResult,
  PreparationState,
} from './types';
import { isPreparationDefinitionValid, isPreparationStateValid } from './validation';

function withinExperimentalTolerance(
  actual: number,
  target: number,
  tolerance: number,
): boolean {
  return Math.abs(actual - target) <= tolerance;
}

function presentMaterialIds(
  dissolved: Readonly<Record<MaterialId, number>>,
  undissolved: Readonly<Record<MaterialId, number>>,
): MaterialId[] {
  return [...new Set([...Object.keys(dissolved), ...Object.keys(undissolved)])]
    .filter((id) => (dissolved[id] ?? 0) > 0 || (undissolved[id] ?? 0) > 0);
}

export function derivePreparationResult(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
  state: PreparationState,
): PreparationResult {
  if (validateChemistryConfiguration(configuration).length > 0
    || !isPreparationDefinitionValid(definition, configuration)
    || !isPreparationStateValid(state, configuration)
    || validateChemistryState(state.chemistryState, configuration).length > 0) {
    return {
      validity: 'unusable',
      issues: ['INVALID_INPUT'],
      actualConcentrationMolPerL: null,
      actualMassEquivalentG: null,
      actualVolumeL: null,
    };
  }

  const vessel = state.chemistryState.vessels[definition.vesselId]!;
  const targetMaterial = configuration.materials[definition.targetMaterialId]!;
  const dissolved = vessel.contents.dissolvedAmountsMol[definition.targetMaterialId] ?? 0;
  const undissolved = vessel.contents.undissolvedAmountsMol[definition.targetMaterialId] ?? 0;
  const actualMassEquivalentG = (dissolved + undissolved)
    * targetMaterial.molarMassGPerMol;
  const wrongMaterialPresent = presentMaterialIds(
    vessel.contents.dissolvedAmountsMol,
    vessel.contents.undissolvedAmountsMol,
  ).some((id) => id !== definition.targetMaterialId);
  const usable = vessel.contents.volumeL > 0
    && dissolved > 0
    && undissolved === 0
    && !wrongMaterialPresent;
  const actualConcentrationMolPerL = usable
    ? getMolarConcentration(vessel.contents, definition.targetMaterialId)
    : null;

  if (state.lifecycle === 'in-progress') {
    return {
      validity: 'in-progress',
      issues: [],
      actualConcentrationMolPerL,
      actualMassEquivalentG,
      actualVolumeL: vessel.contents.volumeL,
    };
  }

  const unusableIssues: PreparationIssueCode[] = [];
  if (wrongMaterialPresent) unusableIssues.push('WRONG_MATERIAL_PRESENT');
  if (vessel.contents.volumeL === 0) unusableIssues.push('ZERO_VOLUME');
  if (undissolved > 0) unusableIssues.push('TARGET_MATERIAL_UNDISSOLVED');
  if (dissolved === 0) unusableIssues.push('TARGET_MATERIAL_MISSING');
  if (unusableIssues.length > 0) {
    return {
      validity: 'unusable',
      issues: unusableIssues,
      actualConcentrationMolPerL: null,
      actualMassEquivalentG,
      actualVolumeL: vessel.contents.volumeL,
    };
  }

  const issues: PreparationIssueCode[] = [];
  if (!withinExperimentalTolerance(
    actualMassEquivalentG,
    definition.targetMassG,
    definition.massToleranceG,
  )) issues.push('MASS_OFF_TARGET');
  if (!withinExperimentalTolerance(
    vessel.contents.volumeL,
    definition.targetVolumeL,
    definition.volumeToleranceL,
  )) issues.push('VOLUME_OFF_TARGET');
  return {
    validity: issues.length === 0 ? 'on-target' : 'off-target',
    issues,
    actualConcentrationMolPerL,
    actualMassEquivalentG,
    actualVolumeL: vessel.contents.volumeL,
  };
}
