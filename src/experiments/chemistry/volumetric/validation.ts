import {
  isAtMostWithinFloatingPointTolerance,
  validateChemistryConfiguration,
  validateChemistryState,
} from '../core';
import type {
  ApparatusId,
  ChemistryConfiguration,
  ChemistryMessage,
} from '../core';
import { lToMl } from './numeric';
import type {
  VolumetricConfiguration,
  VolumetricState,
  VolumetricTrialState,
} from './types';

export type VolumetricMessageCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_CHEMISTRY_STATE'
  | 'INVALID_TRIAL_STATE'
  | 'TRIAL_ALREADY_STARTED'
  | 'TRIAL_NOT_STARTED'
  | 'TRIAL_ALREADY_COMPLETED'
  | 'INVALID_READING'
  | 'READING_OUT_OF_RANGE'
  | 'INVALID_DELIVERY_VOLUME'
  | 'BURETTE_LIMIT_EXCEEDED'
  | 'TRANSFER_FAILED';

export function volumetricMessage(
  code: VolumetricMessageCode,
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getMaximumBuretteReadingMl(
  configuration: VolumetricConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
): number | null {
  const apparatus = chemistryConfiguration.apparatus[
    configuration.buretteApparatusId
  ];
  return apparatus?.kind === 'burette' ? lToMl(apparatus.capacityL) : null;
}

export function validateVolumetricConfiguration(
  configuration: VolumetricConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
): ChemistryMessage[] {
  if (validateChemistryConfiguration(chemistryConfiguration).length > 0
    || !hasText(configuration.buretteApparatusId)
    || !hasText(configuration.deliveryTargetApparatusId)
    || configuration.buretteApparatusId
      === configuration.deliveryTargetApparatusId) {
    return [volumetricMessage(
      'INVALID_CONFIGURATION',
      'The volumetric configuration is invalid.',
    )];
  }

  const burette = chemistryConfiguration.apparatus[
    configuration.buretteApparatusId
  ];
  const target = chemistryConfiguration.apparatus[
    configuration.deliveryTargetApparatusId
  ];
  if (!burette || burette.kind !== 'burette' || !target) {
    return [volumetricMessage(
      'INVALID_CONFIGURATION',
      'The volumetric configuration must reference a burette and a delivery target.',
      [configuration.buretteApparatusId, configuration.deliveryTargetApparatusId],
    )];
  }

  return [];
}

export function validateVolumetricTrial(
  trial: VolumetricTrialState,
  maximumReadingMl: number,
): ChemistryMessage[] {
  if (!['not-started', 'in-progress', 'completed'].includes(trial.status)) {
    return [volumetricMessage(
      'INVALID_TRIAL_STATE',
      'The trial lifecycle status is invalid.',
    )];
  }

  if (trial.status === 'not-started') {
    return trial.initialBuretteReadingMl === null
      && trial.currentBuretteReadingMl === null
      ? []
      : [volumetricMessage(
        'INVALID_TRIAL_STATE',
        'A trial that has not started cannot contain readings.',
      )];
  }

  const initial = trial.initialBuretteReadingMl;
  const current = trial.currentBuretteReadingMl;
  if (initial === null || current === null
    || !Number.isFinite(initial) || !Number.isFinite(current)
    || initial < 0 || current < initial
    || !isAtMostWithinFloatingPointTolerance(current, maximumReadingMl)) {
    return [volumetricMessage(
      'INVALID_TRIAL_STATE',
      'Started trial readings must be finite, ordered, nonnegative, and within the burette range.',
    )];
  }

  return [];
}

export function validateVolumetricState(
  configuration: VolumetricConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
  state: VolumetricState,
): ChemistryMessage[] {
  const configurationIssues = validateVolumetricConfiguration(
    configuration,
    chemistryConfiguration,
  );
  if (configurationIssues.length > 0) {
    return configurationIssues;
  }
  if (validateChemistryState(
    state.chemistryState,
    chemistryConfiguration,
  ).length > 0) {
    return [volumetricMessage(
      'INVALID_CHEMISTRY_STATE',
      'The Chemistry state is invalid for the supplied configuration.',
    )];
  }

  return validateVolumetricTrial(
    state.trial,
    getMaximumBuretteReadingMl(configuration, chemistryConfiguration)!,
  );
}
