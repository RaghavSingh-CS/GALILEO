import { transferLiquid } from '../../core';
import type {
  ActionOutcome,
  ChemistryConfiguration,
  ChemistryMessage,
  ChemistryState,
} from '../../core';
import {
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  MOHRS_SALT_PREPARATION_CONFIGURATION,
  MOHRS_SALT_PREPARATION_SPEC,
  MOHRS_SALT_PREPARATION_VESSEL_ID,
  deriveMohrsSaltPreparationResult,
} from '../../preparation/named/mohrs-salt';
import type {
  MohrsSaltPreparationIssueCode,
  MohrsSaltPreparationState,
} from '../../preparation/named/mohrs-salt';
import type { PreparationValidity } from '../../preparation';
import {
  completeVolumetricTrial,
  createVolumetricState,
  deliverFromBurette,
  getDeliveredVolumeMl,
  mlToL,
  startVolumetricTrial,
} from '../../volumetric';
import type { VolumetricConfiguration, VolumetricState } from '../../volumetric';
import { derivePermanganateTrialAssessment } from '..';
import type {
  PermanganateAssessment,
  PermanganateReactionProgress,
  PermanganateTitrationConfiguration,
} from '..';

export const POTASSIUM_PERMANGANATE_MATERIAL_ID = 'potassium-permanganate';
export const SULFURIC_ACID_MATERIAL_ID = 'sulfuric-acid';
export const MOHRS_TITRATION_BURETTE_ID = 'mohrs-titration-burette';
export const MOHRS_TITRATION_FLASK_ID = 'mohrs-titration-conical-flask';
export const MOHRS_TITRATION_ACID_SOURCE_ID = 'mohrs-titration-acid-source';

export const MOHRS_SALT_TITRATION_SPEC = {
  aliquotVolumeMl: 10,
  nominalStandardMolarityMolPerL:
    MOHRS_SALT_PREPARATION_SPEC.targetMolarityMolPerL,
  acidVolumeL: 0.005,
  acidMolarityMolPerL: 1,
  requiredSulfuricAcidMol: 0.005,
  actualTitrantMolarityMolPerL: 0.01,
  buretteFillVolumeL: 0.05,
  permanganateToReactiveIronRatio: 1 / 5,
  /** GALILEO endpoint-display assumption: 0.05 mL of the prototype titrant. */
  endpointExcessAllowanceMol: 0.0000005,
} as const;

export const MOHRS_SALT_TITRATION_CONFIGURATION: ChemistryConfiguration = {
  materials: {
    ...MOHRS_SALT_PREPARATION_CONFIGURATION.materials,
    [POTASSIUM_PERMANGANATE_MATERIAL_ID]: {
      name: 'Potassium permanganate',
      molarMassGPerMol: 158.034,
    },
    [SULFURIC_ACID_MATERIAL_ID]: {
      name: 'Sulfuric acid',
      molarMassGPerMol: 98.079,
    },
  },
  apparatus: {
    ...MOHRS_SALT_PREPARATION_CONFIGURATION.apparatus,
    [MOHRS_TITRATION_BURETTE_ID]: {
      kind: 'burette', capacityL: 0.05, supportsHeating: false,
    },
    [MOHRS_TITRATION_FLASK_ID]: {
      kind: 'conical-flask', capacityL: 0.25, supportsHeating: true,
    },
    [MOHRS_TITRATION_ACID_SOURCE_ID]: {
      kind: 'beaker', capacityL: 0.005, supportsHeating: false,
    },
  },
};

export const MOHRS_SALT_VOLUMETRIC_CONFIGURATION: VolumetricConfiguration = {
  buretteApparatusId: MOHRS_TITRATION_BURETTE_ID,
  deliveryTargetApparatusId: MOHRS_TITRATION_FLASK_ID,
};

export const MOHRS_SALT_PERMANGANATE_CONFIGURATION:
PermanganateTitrationConfiguration = {
  titrantMaterialId: POTASSIUM_PERMANGANATE_MATERIAL_ID,
  endpointExcessAllowanceMol:
    MOHRS_SALT_TITRATION_SPEC.endpointExcessAllowanceMol,
};

export interface MohrsSaltTitrationState {
  readonly volumetric: VolumetricState;
  readonly sourcePreparationValidity: PreparationValidity;
  readonly sourcePreparationIssues: readonly MohrsSaltPreparationIssueCode[];
}

export interface MohrsSaltTitrationActionResult {
  readonly outcome: ActionOutcome;
  readonly state: MohrsSaltTitrationState;
  readonly messages: readonly ChemistryMessage[];
}

export type MohrsSaltTrialUsability =
  | 'in-progress'
  | 'usable'
  | 'overshot'
  | 'stopped-early'
  | 'unusable';

export type MohrsSaltTitrationIssueCode =
  | 'SOURCE_PREPARATION_UNUSABLE'
  | 'ACID_MEDIUM_INSUFFICIENT'
  | 'TRIAL_NOT_AT_ENDPOINT';

export interface MohrsSaltTitrationResult {
  readonly reactionSupported: boolean;
  readonly availableReactiveIronMol: number;
  readonly reactionProgress: PermanganateReactionProgress | null;
  readonly permanganateAssessment: PermanganateAssessment | null;
  readonly deliveredVolumeMl: number;
  readonly actualTitrantMolarityMolPerL: number;
  readonly calculatedTitrantMolarityMolPerL: number | null;
  readonly usability: MohrsSaltTrialUsability;
  readonly issues: readonly MohrsSaltTitrationIssueCode[];
}

function vessel(
  volumeL: number,
  dissolvedAmountsMol: Readonly<Record<string, number>> = {},
) {
  return {
    temperatureC: 25,
    contents: { volumeL, dissolvedAmountsMol, undissolvedAmountsMol: {} },
  } as const;
}

function namedMessage(code: string, message: string): ChemistryMessage {
  return { code, severity: 'error', message };
}

function wrapVolumetric(
  state: MohrsSaltTitrationState,
  result: { readonly outcome: ActionOutcome; readonly state: VolumetricState;
    readonly messages: readonly ChemistryMessage[] },
): MohrsSaltTitrationActionResult {
  return result.outcome === 'BLOCKED'
    ? { outcome: 'BLOCKED', state, messages: result.messages }
    : {
        outcome: result.outcome,
        state: { ...state, volumetric: result.state },
        messages: result.messages,
      };
}

export function createMohrsSaltTitration(
  sourcePreparation: MohrsSaltPreparationState,
): MohrsSaltTitrationActionResult {
  const sourceResult = deriveMohrsSaltPreparationResult(sourcePreparation);
  const sourceVessel = sourcePreparation.preparation.chemistryState.vessels[
    MOHRS_SALT_PREPARATION_VESSEL_ID
  ];
  if (!sourceVessel) {
    const empty = createVolumetricState({ vessels: {} });
    return {
      outcome: 'BLOCKED',
      state: {
        volumetric: empty,
        sourcePreparationValidity: 'unusable',
        sourcePreparationIssues: ['INVALID_INPUT'],
      },
      messages: [namedMessage('INVALID_SOURCE_PREPARATION', 'The source preparation is invalid.')],
    };
  }

  const chemistryState: ChemistryState = {
    vessels: {
      [MOHRS_SALT_PREPARATION_VESSEL_ID]: sourceVessel,
      [MOHRS_TITRATION_BURETTE_ID]: vessel(
        MOHRS_SALT_TITRATION_SPEC.buretteFillVolumeL,
        {
          [POTASSIUM_PERMANGANATE_MATERIAL_ID]:
            MOHRS_SALT_TITRATION_SPEC.buretteFillVolumeL
            * MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL,
        },
      ),
      [MOHRS_TITRATION_FLASK_ID]: vessel(0),
      [MOHRS_TITRATION_ACID_SOURCE_ID]: vessel(
        MOHRS_SALT_TITRATION_SPEC.acidVolumeL,
        {
          [SULFURIC_ACID_MATERIAL_ID]:
            MOHRS_SALT_TITRATION_SPEC.requiredSulfuricAcidMol,
        },
      ),
    },
  };

  return {
    outcome: 'VALID',
    state: {
      volumetric: createVolumetricState(chemistryState),
      sourcePreparationValidity: sourceResult.validity,
      sourcePreparationIssues: sourceResult.issues,
    },
    messages: [],
  };
}

function applySetupTransfer(
  state: MohrsSaltTitrationState,
  sourceApparatusId: string,
  volumeL: number,
): MohrsSaltTitrationActionResult {
  const result = transferLiquid(
    MOHRS_SALT_TITRATION_CONFIGURATION,
    state.volumetric.chemistryState,
    {
      type: 'transfer-liquid',
      sourceApparatusId,
      targetApparatusId: MOHRS_TITRATION_FLASK_ID,
      volumeL,
    },
  );
  return result.outcome === 'BLOCKED'
    ? { outcome: 'BLOCKED', state, messages: result.messages }
    : {
        outcome: result.outcome,
        state: {
          ...state,
          volumetric: {
            ...state.volumetric,
            chemistryState: result.state,
          },
        },
        messages: result.messages,
      };
}

export function prepareMohrsSaltTitrationAliquot(
  state: MohrsSaltTitrationState,
): MohrsSaltTitrationActionResult {
  return applySetupTransfer(
    state,
    MOHRS_SALT_PREPARATION_VESSEL_ID,
    mlToL(MOHRS_SALT_TITRATION_SPEC.aliquotVolumeMl),
  );
}

export function addMohrsSaltTitrationAcid(
  state: MohrsSaltTitrationState,
): MohrsSaltTitrationActionResult {
  return applySetupTransfer(
    state,
    MOHRS_TITRATION_ACID_SOURCE_ID,
    MOHRS_SALT_TITRATION_SPEC.acidVolumeL,
  );
}

export function startMohrsSaltTitration(
  state: MohrsSaltTitrationState,
  initialReadingMl: number,
): MohrsSaltTitrationActionResult {
  return wrapVolumetric(state, startVolumetricTrial(
    MOHRS_SALT_VOLUMETRIC_CONFIGURATION,
    MOHRS_SALT_TITRATION_CONFIGURATION,
    state.volumetric,
    initialReadingMl,
  ));
}

export function applyMohrsSaltTitrationDelivery(
  state: MohrsSaltTitrationState,
  deliveryVolumeMl: number,
): MohrsSaltTitrationActionResult {
  return wrapVolumetric(state, deliverFromBurette(
    MOHRS_SALT_VOLUMETRIC_CONFIGURATION,
    MOHRS_SALT_TITRATION_CONFIGURATION,
    state.volumetric,
    deliveryVolumeMl,
  ));
}

export function completeMohrsSaltTitration(
  state: MohrsSaltTitrationState,
): MohrsSaltTitrationActionResult {
  return wrapVolumetric(state, completeVolumetricTrial(
    MOHRS_SALT_VOLUMETRIC_CONFIGURATION,
    MOHRS_SALT_TITRATION_CONFIGURATION,
    state.volumetric,
  ));
}

export function deriveMohrsSaltReactionProgress(
  state: MohrsSaltTitrationState,
): PermanganateReactionProgress {
  const contents = state.volumetric.chemistryState.vessels[
    MOHRS_TITRATION_FLASK_ID
  ]!.contents;
  const availableReactiveIronMol = contents.dissolvedAmountsMol[
    MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID
  ] ?? 0;
  const availablePermanganateMol = contents.dissolvedAmountsMol[
    POTASSIUM_PERMANGANATE_MATERIAL_ID
  ] ?? 0;
  const capacity = availableReactiveIronMol
    * MOHRS_SALT_TITRATION_SPEC.permanganateToReactiveIronRatio;
  return {
    consumedPermanganateMol: Math.min(availablePermanganateMol, capacity),
    remainingReactiveCapacityMol: Math.max(capacity - availablePermanganateMol, 0),
  };
}

export function deriveMohrsSaltTitrationResult(
  state: MohrsSaltTitrationState,
): MohrsSaltTitrationResult {
  const contents = state.volumetric.chemistryState.vessels[
    MOHRS_TITRATION_FLASK_ID
  ]!.contents;
  const availableReactiveIronMol = contents.dissolvedAmountsMol[
    MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID
  ] ?? 0;
  const sulfuricAcidMol = contents.dissolvedAmountsMol[
    SULFURIC_ACID_MATERIAL_ID
  ] ?? 0;
  const sourceUsable = state.sourcePreparationValidity === 'on-target'
    || state.sourcePreparationValidity === 'off-target';
  const acidSupported = sulfuricAcidMol
    >= MOHRS_SALT_TITRATION_SPEC.requiredSulfuricAcidMol;
  const reactionSupported = sourceUsable && acidSupported
    && availableReactiveIronMol > 0;
  const deliveredVolumeMl = getDeliveredVolumeMl(state.volumetric.trial);
  const issues: MohrsSaltTitrationIssueCode[] = [];
  if (!sourceUsable) issues.push('SOURCE_PREPARATION_UNUSABLE');
  if (!acidSupported) issues.push('ACID_MEDIUM_INSUFFICIENT');

  if (!reactionSupported) {
    return {
      reactionSupported,
      availableReactiveIronMol,
      reactionProgress: null,
      permanganateAssessment: null,
      deliveredVolumeMl,
      actualTitrantMolarityMolPerL:
        MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL,
      calculatedTitrantMolarityMolPerL: null,
      usability: 'unusable',
      issues,
    };
  }

  const reactionProgress = deriveMohrsSaltReactionProgress(state);
  const shared = derivePermanganateTrialAssessment(
    MOHRS_SALT_PERMANGANATE_CONFIGURATION,
    MOHRS_SALT_TITRATION_CONFIGURATION,
    MOHRS_SALT_VOLUMETRIC_CONFIGURATION,
    state.volumetric,
    reactionProgress,
  );
  const assessment = shared.assessment;
  const completed = state.volumetric.trial.status === 'completed';
  let usability: MohrsSaltTrialUsability = 'in-progress';
  if (completed && assessment?.trialAssessment === 'endpoint') usability = 'usable';
  else if (completed && assessment?.trialAssessment === 'overshot') usability = 'overshot';
  else if (completed) {
    usability = 'stopped-early';
    issues.push('TRIAL_NOT_AT_ENDPOINT');
  }
  const calculated = usability === 'usable' && deliveredVolumeMl > 0
    ? (MOHRS_SALT_TITRATION_SPEC.nominalStandardMolarityMolPerL
      * mlToL(MOHRS_SALT_TITRATION_SPEC.aliquotVolumeMl))
      / (5 * mlToL(deliveredVolumeMl))
    : null;

  return {
    reactionSupported,
    availableReactiveIronMol,
    reactionProgress,
    permanganateAssessment: assessment,
    deliveredVolumeMl,
    actualTitrantMolarityMolPerL:
      MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL,
    calculatedTitrantMolarityMolPerL: calculated,
    usability,
    issues,
  };
}
