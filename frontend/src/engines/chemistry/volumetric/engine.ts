import {
  isAtMostWithinFloatingPointTolerance,
  snapToBoundaryIfNumericallyEqual,
  transferLiquid,
} from '../core';
import type { ChemistryConfiguration, ChemistryState } from '../core';
import { mlToL } from './numeric';
import {
  getMaximumBuretteReadingMl,
  validateVolumetricState,
  volumetricMessage,
} from './validation';
import type {
  VolumetricActionResult,
  VolumetricConfiguration,
  VolumetricState,
} from './types';

export function createVolumetricState(
  chemistryState: ChemistryState,
): VolumetricState {
  return {
    chemistryState,
    trial: {
      status: 'not-started',
      initialBuretteReadingMl: null,
      currentBuretteReadingMl: null,
    },
  };
}

function blocked(
  state: VolumetricState,
  messages: VolumetricActionResult['messages'],
): VolumetricActionResult {
  return { outcome: 'BLOCKED', state, messages };
}

export function startVolumetricTrial(
  configuration: VolumetricConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
  state: VolumetricState,
  initialReadingMl: number,
): VolumetricActionResult {
  const issues = validateVolumetricState(
    configuration,
    chemistryConfiguration,
    state,
  );
  if (issues.length > 0) return blocked(state, issues);
  if (state.trial.status !== 'not-started') {
    return blocked(state, [volumetricMessage(
      'TRIAL_ALREADY_STARTED',
      'Create a new trial state before starting another trial.',
    )]);
  }

  const maximum = getMaximumBuretteReadingMl(
    configuration,
    chemistryConfiguration,
  )!;
  if (!Number.isFinite(initialReadingMl) || initialReadingMl < 0) {
    return blocked(state, [volumetricMessage(
      'INVALID_READING',
      'The initial burette reading must be finite and nonnegative.',
      [configuration.buretteApparatusId],
    )]);
  }
  if (!isAtMostWithinFloatingPointTolerance(initialReadingMl, maximum)) {
    return blocked(state, [volumetricMessage(
      'READING_OUT_OF_RANGE',
      'The initial burette reading exceeds the configured burette capacity.',
      [configuration.buretteApparatusId],
    )]);
  }
  const reading = snapToBoundaryIfNumericallyEqual(initialReadingMl, maximum);

  return {
    outcome: 'VALID',
    state: {
      chemistryState: state.chemistryState,
      trial: {
        status: 'in-progress',
        initialBuretteReadingMl: reading,
        currentBuretteReadingMl: reading,
      },
    },
    messages: [],
  };
}

export function deliverFromBurette(
  configuration: VolumetricConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
  state: VolumetricState,
  deliveryVolumeMl: number,
): VolumetricActionResult {
  const issues = validateVolumetricState(
    configuration,
    chemistryConfiguration,
    state,
  );
  if (issues.length > 0) return blocked(state, issues);
  if (state.trial.status === 'not-started') {
    return blocked(state, [volumetricMessage(
      'TRIAL_NOT_STARTED',
      'A volumetric trial must be active before delivery.',
    )]);
  }
  if (state.trial.status === 'completed') {
    return blocked(state, [volumetricMessage(
      'TRIAL_ALREADY_COMPLETED',
      'A completed trial cannot accept further delivery.',
    )]);
  }
  if (!Number.isFinite(deliveryVolumeMl) || deliveryVolumeMl <= 0) {
    return blocked(state, [volumetricMessage(
      'INVALID_DELIVERY_VOLUME',
      'Delivery volume must be finite and positive.',
      [configuration.buretteApparatusId],
    )]);
  }

  const maximum = getMaximumBuretteReadingMl(
    configuration,
    chemistryConfiguration,
  )!;
  const rawReading = state.trial.currentBuretteReadingMl! + deliveryVolumeMl;
  if (!Number.isFinite(rawReading)
    || !isAtMostWithinFloatingPointTolerance(rawReading, maximum)) {
    return blocked(state, [volumetricMessage(
      'BURETTE_LIMIT_EXCEEDED',
      'Delivery would advance the reading beyond the burette limit.',
      [configuration.buretteApparatusId],
    )]);
  }

  const transferResult = transferLiquid(
    chemistryConfiguration,
    state.chemistryState,
    {
      type: 'transfer-liquid',
      sourceApparatusId: configuration.buretteApparatusId,
      targetApparatusId: configuration.deliveryTargetApparatusId,
      volumeL: mlToL(deliveryVolumeMl),
    },
  );
  if (transferResult.outcome === 'BLOCKED') {
    return blocked(state, [
      volumetricMessage(
        'TRANSFER_FAILED',
        'The Chemistry core rejected the requested burette transfer.',
        [configuration.buretteApparatusId, configuration.deliveryTargetApparatusId],
      ),
      ...transferResult.messages,
    ]);
  }

  return {
    outcome: transferResult.outcome,
    state: {
      chemistryState: transferResult.state,
      trial: {
        ...state.trial,
        currentBuretteReadingMl: snapToBoundaryIfNumericallyEqual(
          rawReading,
          maximum,
        ),
      },
    },
    messages: transferResult.messages,
  };
}

export function completeVolumetricTrial(
  configuration: VolumetricConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
  state: VolumetricState,
): VolumetricActionResult {
  const issues = validateVolumetricState(
    configuration,
    chemistryConfiguration,
    state,
  );
  if (issues.length > 0) return blocked(state, issues);
  if (state.trial.status === 'not-started') {
    return blocked(state, [volumetricMessage(
      'TRIAL_NOT_STARTED',
      'A trial must be active before it can be completed.',
    )]);
  }
  if (state.trial.status === 'completed') {
    return blocked(state, [volumetricMessage(
      'TRIAL_ALREADY_COMPLETED',
      'The trial is already completed.',
    )]);
  }

  return {
    outcome: 'VALID',
    state: {
      chemistryState: state.chemistryState,
      trial: { ...state.trial, status: 'completed' },
    },
    messages: [],
  };
}
