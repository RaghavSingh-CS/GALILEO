import {
  isAtMostWithinFloatingPointTolerance,
  validateChemistryConfiguration,
  validateChemistryState,
} from '../core';
import type { ChemistryConfiguration, ChemistryState } from '../core';
import type { PreparationDefinition, PreparationState } from './types';

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isPreparationDefinitionValid(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
): boolean {
  const apparatus = configuration.apparatus[definition.vesselId];
  return definition.preparationId.trim().length > 0
    && Boolean(apparatus)
    && Boolean(configuration.materials[definition.targetMaterialId])
    && (definition.dissolutionMode === 'unsupported'
      || definition.dissolutionMode === 'complete-on-mix')
    && Number.isFinite(definition.targetMassG)
    && definition.targetMassG > 0
    && isFiniteNonNegative(definition.massToleranceG)
    && Number.isFinite(definition.targetVolumeL)
    && definition.targetVolumeL > 0
    && isFiniteNonNegative(definition.volumeToleranceL)
    && isAtMostWithinFloatingPointTolerance(
      definition.targetVolumeL,
      apparatus!.capacityL,
    );
}

export function preparationInputIssue(
  definition: PreparationDefinition,
  configuration: ChemistryConfiguration,
  state: ChemistryState,
): 'INVALID_PREPARATION_DEFINITION' | 'INVALID_CONFIGURATION' | 'INVALID_STATE' | null {
  if (validateChemistryConfiguration(configuration).length > 0) {
    return 'INVALID_CONFIGURATION';
  }
  if (!isPreparationDefinitionValid(definition, configuration)) {
    return 'INVALID_PREPARATION_DEFINITION';
  }
  if (validateChemistryState(state, configuration).length > 0) {
    return 'INVALID_STATE';
  }
  return null;
}

export function isPreparationStateValid(
  state: PreparationState,
  configuration: ChemistryConfiguration,
): boolean {
  return (state.lifecycle === 'in-progress' || state.lifecycle === 'complete')
    && Object.entries(state.measuredMassesG).every(([materialId, massG]) => (
      Boolean(configuration.materials[materialId])
      && Number.isFinite(massG)
      && massG >= 0
    ));
}
