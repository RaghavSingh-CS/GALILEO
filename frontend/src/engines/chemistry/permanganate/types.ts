import type { ChemistryMessage, MaterialId } from '../core';

export interface PermanganateTitrationConfiguration {
  readonly titrantMaterialId: MaterialId;
  readonly endpointExcessAllowanceMol: number;
}

/** Facts supplied by a future named reaction model, not calculated here. */
export interface PermanganateReactionProgress {
  readonly consumedPermanganateMol: number;
  readonly remainingReactiveCapacityMol: number;
}

export type PermanganateIndicatorState =
  | 'decolorized'
  | 'endpoint'
  | 'overshot';

export type PermanganateTrialAssessment =
  | 'before-endpoint'
  | 'endpoint'
  | 'overshot';

export interface PermanganateAssessment {
  readonly actualPermanganateMol: number;
  readonly consumedPermanganateMol: number;
  readonly excessPermanganateMol: number;
  readonly remainingReactiveCapacityMol: number;
  readonly equivalenceSatisfied: boolean;
  readonly indicatorState: PermanganateIndicatorState;
  readonly trialAssessment: PermanganateTrialAssessment;
}

export type PermanganateAssessmentResult =
  | {
      readonly outcome: 'VALID';
      readonly assessment: PermanganateAssessment;
      readonly messages: readonly [];
    }
  | {
      readonly outcome: 'BLOCKED';
      readonly assessment: null;
      readonly messages: readonly ChemistryMessage[];
    };
