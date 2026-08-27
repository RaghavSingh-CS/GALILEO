import type { ChemistryConfiguration } from '../core';
import type { VolumetricConfiguration, VolumetricState } from '../volumetric';
import type {
  PermanganateAssessmentResult,
  PermanganateIndicatorState,
  PermanganateReactionProgress,
  PermanganateTitrationConfiguration,
} from './types';
import {
  permanganateMessage,
  validatePermanganateAssessmentInput,
} from './validation';

export function derivePermanganateIndicatorState(
  excessPermanganateMol: number,
  endpointExcessAllowanceMol: number,
): PermanganateIndicatorState {
  if (excessPermanganateMol <= 0) return 'decolorized';
  if (excessPermanganateMol <= endpointExcessAllowanceMol) return 'endpoint';
  return 'overshot';
}

export function derivePermanganateTrialAssessment(
  configuration: PermanganateTitrationConfiguration,
  chemistryConfiguration: ChemistryConfiguration,
  volumetricConfiguration: VolumetricConfiguration,
  volumetricState: VolumetricState,
  progress: PermanganateReactionProgress,
): PermanganateAssessmentResult {
  const issues = validatePermanganateAssessmentInput(
    configuration,
    chemistryConfiguration,
    volumetricConfiguration,
    volumetricState,
    progress,
  );
  if (issues.length > 0) {
    return { outcome: 'BLOCKED', assessment: null, messages: issues };
  }

  const target = volumetricState.chemistryState.vessels[
    volumetricConfiguration.deliveryTargetApparatusId
  ]!;
  const actualPermanganateMol = target.contents.dissolvedAmountsMol[
    configuration.titrantMaterialId
  ] ?? 0;
  const excessPermanganateMol = actualPermanganateMol
    - progress.consumedPermanganateMol;

  if (excessPermanganateMol < 0
    || (progress.remainingReactiveCapacityMol > 0
      && excessPermanganateMol > 0)) {
    return {
      outcome: 'BLOCKED',
      assessment: null,
      messages: [permanganateMessage(
        'INCONSISTENT_REACTION_PROGRESS',
        'Named reaction progress is inconsistent with actual permanganate inventory.',
        [volumetricConfiguration.deliveryTargetApparatusId],
      )],
    };
  }

  const indicatorState = derivePermanganateIndicatorState(
    excessPermanganateMol,
    configuration.endpointExcessAllowanceMol,
  );

  return {
    outcome: 'VALID',
    assessment: {
      actualPermanganateMol,
      consumedPermanganateMol: progress.consumedPermanganateMol,
      excessPermanganateMol,
      remainingReactiveCapacityMol: progress.remainingReactiveCapacityMol,
      equivalenceSatisfied: progress.remainingReactiveCapacityMol === 0,
      indicatorState,
      trialAssessment: indicatorState === 'decolorized'
        ? 'before-endpoint'
        : indicatorState,
    },
    messages: [],
  };
}
