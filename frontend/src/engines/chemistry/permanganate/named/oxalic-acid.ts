import { heatVessel, transferLiquid } from '../../core';
import type {
  ActionOutcome,
  ChemistryConfiguration,
  ChemistryMessage,
  ChemistryState,
} from '../../core';
import type {
  PreparationIssueCode,
  PreparationState,
  PreparationValidity,
} from '../../preparation';
import {
  OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  OXALIC_ACID_PREPARATION_CONFIGURATION,
  OXALIC_ACID_PREPARATION_SPEC,
  OXALIC_ACID_PREPARATION_VESSEL_ID,
  deriveOxalicAcidPreparationResult,
} from '../../preparation/named/oxalic-acid';
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
import {
  POTASSIUM_PERMANGANATE_MATERIAL_ID,
  PROTOTYPE_ENDPOINT_EXCESS_ALLOWANCE_MOL,
  PROTOTYPE_PERMANGANATE_MOLARITY_MOL_PER_L,
  SULFURIC_ACID_MATERIAL_ID,
} from './prototype';

export const OXALIC_TITRATION_BURETTE_ID = 'oxalic-titration-burette';
export const OXALIC_TITRATION_FLASK_ID = 'oxalic-titration-conical-flask';
export const OXALIC_TITRATION_ACID_SOURCE_ID = 'oxalic-titration-acid-source';

export const OXALIC_ACID_TITRATION_SPEC = {
  aliquotVolumeMl: 10,
  nominalStandardMolarityMolPerL:
    OXALIC_ACID_PREPARATION_SPEC.targetMolarityMolPerL,
  acidVolumeL: 0.005,
  acidMolarityMolPerL: 1,
  requiredSulfuricAcidMol: 0.005,
  minimumReactionTemperatureC: 50,
  maximumReactionTemperatureC: 60,
  actualTitrantMolarityMolPerL:
    PROTOTYPE_PERMANGANATE_MOLARITY_MOL_PER_L,
  buretteFillVolumeL: 0.05,
  permanganatePerReactiveOxalateRatio: 2 / 5,
  endpointExcessAllowanceMol: PROTOTYPE_ENDPOINT_EXCESS_ALLOWANCE_MOL,
} as const;

export const OXALIC_ACID_TITRATION_CONFIGURATION: ChemistryConfiguration = {
  materials: {
    ...OXALIC_ACID_PREPARATION_CONFIGURATION.materials,
    [POTASSIUM_PERMANGANATE_MATERIAL_ID]: {
      name: 'Potassium permanganate', molarMassGPerMol: 158.034,
    },
    [SULFURIC_ACID_MATERIAL_ID]: {
      name: 'Sulfuric acid', molarMassGPerMol: 98.079,
    },
  },
  apparatus: {
    ...OXALIC_ACID_PREPARATION_CONFIGURATION.apparatus,
    [OXALIC_TITRATION_BURETTE_ID]: {
      kind: 'burette', capacityL: 0.05, supportsHeating: false,
    },
    [OXALIC_TITRATION_FLASK_ID]: {
      kind: 'conical-flask', capacityL: 0.25, supportsHeating: true,
    },
    [OXALIC_TITRATION_ACID_SOURCE_ID]: {
      kind: 'beaker', capacityL: 0.005, supportsHeating: false,
    },
  },
};

export const OXALIC_ACID_VOLUMETRIC_CONFIGURATION: VolumetricConfiguration = {
  buretteApparatusId: OXALIC_TITRATION_BURETTE_ID,
  deliveryTargetApparatusId: OXALIC_TITRATION_FLASK_ID,
};

export const OXALIC_ACID_PERMANGANATE_CONFIGURATION:
PermanganateTitrationConfiguration = {
  titrantMaterialId: POTASSIUM_PERMANGANATE_MATERIAL_ID,
  endpointExcessAllowanceMol:
    OXALIC_ACID_TITRATION_SPEC.endpointExcessAllowanceMol,
};

export interface OxalicAcidTitrationState {
  readonly volumetric: VolumetricState;
  readonly sourcePreparationValidity: PreparationValidity;
  readonly sourcePreparationIssues: readonly PreparationIssueCode[];
}

export interface OxalicAcidTitrationActionResult {
  readonly outcome: ActionOutcome;
  readonly state: OxalicAcidTitrationState;
  readonly messages: readonly ChemistryMessage[];
}

export type OxalicAcidTrialUsability =
  | 'in-progress'
  | 'usable'
  | 'overshot'
  | 'stopped-early'
  | 'unusable';

export type OxalicAcidTitrationIssueCode =
  | 'SOURCE_PREPARATION_UNUSABLE'
  | 'ACID_MEDIUM_INSUFFICIENT'
  | 'TEMPERATURE_TOO_LOW'
  | 'TEMPERATURE_TOO_HIGH'
  | 'TRIAL_NOT_AT_ENDPOINT';

export interface OxalicAcidTitrationResult {
  readonly reactionSupported: boolean;
  readonly availableReactiveOxalateMol: number;
  readonly reactionProgress: PermanganateReactionProgress | null;
  readonly generatedCo2Mol: number;
  readonly co2EvolutionExpected: boolean;
  readonly permanganateAssessment: PermanganateAssessment | null;
  readonly deliveredVolumeMl: number;
  readonly actualTitrantMolarityMolPerL: number;
  readonly calculatedTitrantMolarityMolPerL: number | null;
  readonly usability: OxalicAcidTrialUsability;
  readonly issues: readonly OxalicAcidTitrationIssueCode[];
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
  state: OxalicAcidTitrationState,
  result: { readonly outcome: ActionOutcome; readonly state: VolumetricState;
    readonly messages: readonly ChemistryMessage[] },
): OxalicAcidTitrationActionResult {
  return result.outcome === 'BLOCKED'
    ? { outcome: 'BLOCKED', state, messages: result.messages }
    : {
        outcome: result.outcome,
        state: { ...state, volumetric: result.state },
        messages: result.messages,
      };
}

export function createOxalicAcidTitration(
  sourcePreparation: PreparationState,
): OxalicAcidTitrationActionResult {
  const sourceResult = deriveOxalicAcidPreparationResult(sourcePreparation);
  const sourceVessel = sourcePreparation.chemistryState.vessels[
    OXALIC_ACID_PREPARATION_VESSEL_ID
  ];
  if (!sourceVessel) {
    return {
      outcome: 'BLOCKED',
      state: {
        volumetric: createVolumetricState({ vessels: {} }),
        sourcePreparationValidity: 'unusable',
        sourcePreparationIssues: ['INVALID_INPUT'],
      },
      messages: [namedMessage('INVALID_SOURCE_PREPARATION', 'The source preparation is invalid.')],
    };
  }

  const chemistryState: ChemistryState = {
    vessels: {
      [OXALIC_ACID_PREPARATION_VESSEL_ID]: sourceVessel,
      [OXALIC_TITRATION_BURETTE_ID]: vessel(
        OXALIC_ACID_TITRATION_SPEC.buretteFillVolumeL,
        {
          [POTASSIUM_PERMANGANATE_MATERIAL_ID]:
            OXALIC_ACID_TITRATION_SPEC.buretteFillVolumeL
            * OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL,
        },
      ),
      [OXALIC_TITRATION_FLASK_ID]: vessel(0),
      [OXALIC_TITRATION_ACID_SOURCE_ID]: vessel(
        OXALIC_ACID_TITRATION_SPEC.acidVolumeL,
        { [SULFURIC_ACID_MATERIAL_ID]: OXALIC_ACID_TITRATION_SPEC.requiredSulfuricAcidMol },
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

function setupTransfer(
  state: OxalicAcidTitrationState,
  sourceApparatusId: string,
  volumeL: number,
): OxalicAcidTitrationActionResult {
  const result = transferLiquid(
    OXALIC_ACID_TITRATION_CONFIGURATION,
    state.volumetric.chemistryState,
    {
      type: 'transfer-liquid', sourceApparatusId,
      targetApparatusId: OXALIC_TITRATION_FLASK_ID, volumeL,
    },
  );
  return result.outcome === 'BLOCKED'
    ? { outcome: 'BLOCKED', state, messages: result.messages }
    : {
        outcome: result.outcome,
        state: {
          ...state,
          volumetric: { ...state.volumetric, chemistryState: result.state },
        },
        messages: result.messages,
      };
}

export function prepareOxalicAcidTitrationAliquot(
  state: OxalicAcidTitrationState,
): OxalicAcidTitrationActionResult {
  return setupTransfer(
    state,
    OXALIC_ACID_PREPARATION_VESSEL_ID,
    mlToL(OXALIC_ACID_TITRATION_SPEC.aliquotVolumeMl),
  );
}

export function addOxalicAcidTitrationAcid(
  state: OxalicAcidTitrationState,
): OxalicAcidTitrationActionResult {
  return setupTransfer(
    state,
    OXALIC_TITRATION_ACID_SOURCE_ID,
    OXALIC_ACID_TITRATION_SPEC.acidVolumeL,
  );
}

export function heatOxalicAcidTitration(
  state: OxalicAcidTitrationState,
  targetTemperatureC: number,
): OxalicAcidTitrationActionResult {
  const result = heatVessel(
    OXALIC_ACID_TITRATION_CONFIGURATION,
    state.volumetric.chemistryState,
    {
      type: 'heat', apparatusId: OXALIC_TITRATION_FLASK_ID,
      targetTemperatureC,
    },
  );
  return result.outcome === 'BLOCKED'
    ? { outcome: 'BLOCKED', state, messages: result.messages }
    : {
        outcome: result.outcome,
        state: {
          ...state,
          volumetric: { ...state.volumetric, chemistryState: result.state },
        },
        messages: result.messages,
      };
}

export function startOxalicAcidTitration(
  state: OxalicAcidTitrationState,
  initialReadingMl: number,
): OxalicAcidTitrationActionResult {
  return wrapVolumetric(state, startVolumetricTrial(
    OXALIC_ACID_VOLUMETRIC_CONFIGURATION,
    OXALIC_ACID_TITRATION_CONFIGURATION,
    state.volumetric,
    initialReadingMl,
  ));
}

export function applyOxalicAcidTitrationDelivery(
  state: OxalicAcidTitrationState,
  deliveryVolumeMl: number,
): OxalicAcidTitrationActionResult {
  return wrapVolumetric(state, deliverFromBurette(
    OXALIC_ACID_VOLUMETRIC_CONFIGURATION,
    OXALIC_ACID_TITRATION_CONFIGURATION,
    state.volumetric,
    deliveryVolumeMl,
  ));
}

export function completeOxalicAcidTitration(
  state: OxalicAcidTitrationState,
): OxalicAcidTitrationActionResult {
  return wrapVolumetric(state, completeVolumetricTrial(
    OXALIC_ACID_VOLUMETRIC_CONFIGURATION,
    OXALIC_ACID_TITRATION_CONFIGURATION,
    state.volumetric,
  ));
}

export function deriveOxalicAcidReactionProgress(
  state: OxalicAcidTitrationState,
): PermanganateReactionProgress {
  const contents = state.volumetric.chemistryState.vessels[
    OXALIC_TITRATION_FLASK_ID
  ]!.contents;
  const oxalate = contents.dissolvedAmountsMol[
    OXALIC_ACID_DIHYDRATE_MATERIAL_ID
  ] ?? 0;
  const permanganate = contents.dissolvedAmountsMol[
    POTASSIUM_PERMANGANATE_MATERIAL_ID
  ] ?? 0;
  const capacity = oxalate
    * OXALIC_ACID_TITRATION_SPEC.permanganatePerReactiveOxalateRatio;
  return {
    consumedPermanganateMol: Math.min(permanganate, capacity),
    remainingReactiveCapacityMol: Math.max(capacity - permanganate, 0),
  };
}

export function deriveOxalicAcidTitrationResult(
  state: OxalicAcidTitrationState,
): OxalicAcidTitrationResult {
  const flask = state.volumetric.chemistryState.vessels[
    OXALIC_TITRATION_FLASK_ID
  ]!;
  const contents = flask.contents;
  const availableReactiveOxalateMol = contents.dissolvedAmountsMol[
    OXALIC_ACID_DIHYDRATE_MATERIAL_ID
  ] ?? 0;
  const sulfuricAcidMol = contents.dissolvedAmountsMol[
    SULFURIC_ACID_MATERIAL_ID
  ] ?? 0;
  const sourceUsable = state.sourcePreparationValidity === 'on-target'
    || state.sourcePreparationValidity === 'off-target';
  const acidSupported = sulfuricAcidMol
    >= OXALIC_ACID_TITRATION_SPEC.requiredSulfuricAcidMol;
  const temperatureLow = flask.temperatureC
    < OXALIC_ACID_TITRATION_SPEC.minimumReactionTemperatureC;
  const temperatureHigh = flask.temperatureC
    > OXALIC_ACID_TITRATION_SPEC.maximumReactionTemperatureC;
  const reactionSupported = sourceUsable && acidSupported
    && !temperatureLow && !temperatureHigh
    && availableReactiveOxalateMol > 0;
  const deliveredVolumeMl = getDeliveredVolumeMl(state.volumetric.trial);
  const issues: OxalicAcidTitrationIssueCode[] = [];
  if (!sourceUsable) issues.push('SOURCE_PREPARATION_UNUSABLE');
  if (!acidSupported) issues.push('ACID_MEDIUM_INSUFFICIENT');
  if (temperatureLow) issues.push('TEMPERATURE_TOO_LOW');
  if (temperatureHigh) issues.push('TEMPERATURE_TOO_HIGH');

  if (!reactionSupported) {
    return {
      reactionSupported,
      availableReactiveOxalateMol,
      reactionProgress: null,
      generatedCo2Mol: 0,
      co2EvolutionExpected: false,
      permanganateAssessment: null,
      deliveredVolumeMl,
      actualTitrantMolarityMolPerL:
        OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL,
      calculatedTitrantMolarityMolPerL: null,
      usability: 'unusable',
      issues,
    };
  }

  const reactionProgress = deriveOxalicAcidReactionProgress(state);
  const shared = derivePermanganateTrialAssessment(
    OXALIC_ACID_PERMANGANATE_CONFIGURATION,
    OXALIC_ACID_TITRATION_CONFIGURATION,
    OXALIC_ACID_VOLUMETRIC_CONFIGURATION,
    state.volumetric,
    reactionProgress,
  );
  const assessment = shared.assessment;
  const generatedCo2Mol = reactionProgress.consumedPermanganateMol * 5;
  const completed = state.volumetric.trial.status === 'completed';
  let usability: OxalicAcidTrialUsability = 'in-progress';
  if (completed && assessment?.trialAssessment === 'endpoint') usability = 'usable';
  else if (completed && assessment?.trialAssessment === 'overshot') usability = 'overshot';
  else if (completed) {
    usability = 'stopped-early';
    issues.push('TRIAL_NOT_AT_ENDPOINT');
  }
  const calculated = usability === 'usable' && deliveredVolumeMl > 0
    ? (2 * OXALIC_ACID_TITRATION_SPEC.nominalStandardMolarityMolPerL
      * mlToL(OXALIC_ACID_TITRATION_SPEC.aliquotVolumeMl))
      / (5 * mlToL(deliveredVolumeMl))
    : null;

  return {
    reactionSupported,
    availableReactiveOxalateMol,
    reactionProgress,
    generatedCo2Mol,
    co2EvolutionExpected: generatedCo2Mol > 0,
    permanganateAssessment: assessment,
    deliveredVolumeMl,
    actualTitrantMolarityMolPerL:
      OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL,
    calculatedTitrantMolarityMolPerL: calculated,
    usability,
    issues,
  };
}
