import { validateChemistryConfiguration, validateChemistryState } from '../core';
import type {
  ApparatusId,
  ChemistryConfiguration,
  ChemistryMessage,
} from '../core';
import type { VolumetricConfiguration, VolumetricState } from '../volumetric';
import type {
  PermanganateReactionProgress,
  PermanganateTitrationConfiguration,
} from './types';

export type PermanganateMessageCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_CHEMISTRY_STATE'
  | 'INVALID_REACTION_PROGRESS'
  | 'INCONSISTENT_REACTION_PROGRESS';

export function permanganateMessage(
  code: PermanganateMessageCode,
  message: string,
  apparatusIds: readonly ApparatusId[] = [],
): ChemistryMessage {
  return {
    code,
    severity: 'error',
    message,
    ...(apparatusIds.length > 0 ? { apparatusIds } : {}),
  };
}

export function validatePermanganateConfiguration(
  configuration: PermanganateTitrationConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
): ChemistryMessage[] {
  if (validateChemistryConfiguration(chemistryConfiguration).length > 0
    || typeof configuration.titrantMaterialId !== 'string'
    || configuration.titrantMaterialId.trim().length === 0
    || !(configuration.titrantMaterialId in chemistryConfiguration.materials)
    || !Number.isFinite(configuration.endpointExcessAllowanceMol)
    || configuration.endpointExcessAllowanceMol < 0) {
    return [permanganateMessage(
      'INVALID_CONFIGURATION',
      'The permanganate configuration must reference a known titrant material and a finite nonnegative endpoint allowance.',
    )];
  }

  return [];
}

export function validatePermanganateAssessmentInput(
  configuration: PermanganateTitrationConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
  volumetricConfiguration: VolumetricConfiguration,
  volumetricState: VolumetricState,
  progress: PermanganateReactionProgress,
): ChemistryMessage[] {
  const configurationIssues = validatePermanganateConfiguration(
    configuration,
    chemistryConfiguration,
  );
  if (configurationIssues.length > 0) return configurationIssues;

  if (validateChemistryState(
    volumetricState.chemistryState,
    chemistryConfiguration,
  ).length > 0
    || !(volumetricConfiguration.deliveryTargetApparatusId
      in volumetricState.chemistryState.vessels)) {
    return [permanganateMessage(
      'INVALID_CHEMISTRY_STATE',
      'The composed Chemistry state or delivery target is invalid.',
      [volumetricConfiguration.deliveryTargetApparatusId],
    )];
  }

  if (!Number.isFinite(progress.consumedPermanganateMol)
    || progress.consumedPermanganateMol < 0
    || !Number.isFinite(progress.remainingReactiveCapacityMol)
    || progress.remainingReactiveCapacityMol < 0) {
    return [permanganateMessage(
      'INVALID_REACTION_PROGRESS',
      'Named reaction progress values must be finite and nonnegative.',
    )];
  }

  return [];
}
