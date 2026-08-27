import type {
  ActionOutcome,
  ApparatusId,
  ChemistryMessage,
  ChemistryState,
} from '../core';

export type VolumetricTrialStatus =
  | 'not-started'
  | 'in-progress'
  | 'completed';

export interface VolumetricTrialState {
  readonly status: VolumetricTrialStatus;
  readonly initialBuretteReadingMl: number | null;
  readonly currentBuretteReadingMl: number | null;
}

export interface VolumetricConfiguration {
  readonly buretteApparatusId: ApparatusId;
  readonly deliveryTargetApparatusId: ApparatusId;
}

export interface VolumetricState {
  readonly chemistryState: ChemistryState;
  readonly trial: VolumetricTrialState;
}

export interface VolumetricActionResult {
  readonly outcome: ActionOutcome;
  readonly state: VolumetricState;
  readonly messages: readonly ChemistryMessage[];
}
