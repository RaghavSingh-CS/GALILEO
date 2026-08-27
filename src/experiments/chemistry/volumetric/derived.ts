import type { VolumetricTrialState } from './types';

export function getDeliveredVolumeMl(trial: VolumetricTrialState): number {
  if (trial.initialBuretteReadingMl === null
    || trial.currentBuretteReadingMl === null) {
    return 0;
  }

  return trial.currentBuretteReadingMl - trial.initialBuretteReadingMl;
}
