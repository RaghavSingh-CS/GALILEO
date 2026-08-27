import {
  validateChemistryConfiguration,
  validateChemistryState,
} from '../../core';
import type {
  ActionOutcome,
  ChemistryConfiguration,
  ChemistryMessage,
  ChemistryState,
} from '../../core';
import {
  applyPreparationAction,
  createPreparation,
  derivePreparationResult,
  isPreparationDefinitionValid,
  isPreparationStateValid,
} from '..';
import type {
  PreparationAction,
  PreparationDefinition,
  PreparationIssueCode,
  PreparationResult,
  PreparationState,
  PreparationValidity,
} from '..';

export const MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID = 'mohrs-salt-hexahydrate';
export const MOHRS_SALT_PREPARATION_VESSEL_ID = 'mohrs-salt-volumetric-flask';

export const MOHRS_SALT_PREPARATION_SPEC = {
  formula: '(NH4)2Fe(SO4)2·6H2O',
  targetMolarityMolPerL: 0.05,
  targetVolumeL: 0.250,
  molarMassGPerMol: 392,
  targetMassG: 4.90,
  massToleranceG: 0.01,
  volumeToleranceL: 0.001,
  /** GALILEO sandbox limit, not a claimed real flask maximum. */
  modeledCapacityL: 0.300,
} as const;

export const MOHRS_SALT_PREPARATION_CONFIGURATION: ChemistryConfiguration = {
  materials: {
    [MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID]: {
      name: "Mohr's salt hexahydrate",
      molarMassGPerMol: MOHRS_SALT_PREPARATION_SPEC.molarMassGPerMol,
    },
  },
  apparatus: {
    [MOHRS_SALT_PREPARATION_VESSEL_ID]: {
      kind: 'volumetric-flask',
      capacityL: MOHRS_SALT_PREPARATION_SPEC.modeledCapacityL,
      supportsHeating: false,
    },
  },
};

export const MOHRS_SALT_PREPARATION_DEFINITION: PreparationDefinition = {
  preparationId: 'standard-mohrs-salt-hexahydrate-0.05m-250ml',
  vesselId: MOHRS_SALT_PREPARATION_VESSEL_ID,
  targetMaterialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  dissolutionMode: 'complete-on-mix',
  targetMassG: MOHRS_SALT_PREPARATION_SPEC.targetMassG,
  massToleranceG: MOHRS_SALT_PREPARATION_SPEC.massToleranceG,
  targetVolumeL: MOHRS_SALT_PREPARATION_SPEC.targetVolumeL,
  volumeToleranceL: MOHRS_SALT_PREPARATION_SPEC.volumeToleranceL,
};

export interface MohrsSaltPreparationState {
  readonly preparation: PreparationState;
  readonly acidificationPerformed: boolean;
}

export type MohrsSaltPreparationAction =
  | PreparationAction
  | { readonly type: 'acidify-with-dilute-sulfuric-acid' };

export type MohrsSaltPreparationIssueCode =
  | PreparationIssueCode
  | 'REQUIRED_ACIDIFICATION_MISSING';

export interface MohrsSaltPreparationResult {
  readonly validity: PreparationValidity;
  readonly issues: readonly MohrsSaltPreparationIssueCode[];
  readonly actualConcentrationMolPerL: number | null;
  readonly actualMassEquivalentG: number | null;
  readonly actualVolumeL: number | null;
  readonly acidificationPerformed: boolean;
}

export interface MohrsSaltPreparationActionResult {
  readonly outcome: ActionOutcome;
  readonly state: MohrsSaltPreparationState;
  readonly messages: readonly ChemistryMessage[];
}

function initialChemistryState(): ChemistryState {
  return {
    vessels: {
      [MOHRS_SALT_PREPARATION_VESSEL_ID]: {
        temperatureC: 25,
        contents: {
          volumeL: 0,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
    },
  };
}

function namedMessage(code: string, message: string): ChemistryMessage {
  return {
    code,
    severity: 'error',
    message,
    apparatusIds: [MOHRS_SALT_PREPARATION_VESSEL_ID],
    materialIds: [MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID],
  };
}

function isNamedInputValid(
  state: MohrsSaltPreparationState,
  configuration: ChemistryConfiguration,
): boolean {
  return typeof state.acidificationPerformed === 'boolean'
    && validateChemistryConfiguration(configuration).length === 0
    && isPreparationDefinitionValid(MOHRS_SALT_PREPARATION_DEFINITION, configuration)
    && isPreparationStateValid(state.preparation, configuration)
    && validateChemistryState(state.preparation.chemistryState, configuration).length === 0;
}

export function createMohrsSaltPreparation(
  configuration: ChemistryConfiguration = MOHRS_SALT_PREPARATION_CONFIGURATION,
): MohrsSaltPreparationActionResult {
  const generic = createPreparation(
    MOHRS_SALT_PREPARATION_DEFINITION,
    configuration,
    initialChemistryState(),
  );
  return {
    outcome: generic.outcome,
    state: { preparation: generic.state, acidificationPerformed: false },
    messages: generic.messages,
  };
}

export function applyMohrsSaltPreparationAction(
  state: MohrsSaltPreparationState,
  action: MohrsSaltPreparationAction,
  configuration: ChemistryConfiguration = MOHRS_SALT_PREPARATION_CONFIGURATION,
): MohrsSaltPreparationActionResult {
  if (!isNamedInputValid(state, configuration)) {
    return {
      outcome: 'BLOCKED',
      state,
      messages: [namedMessage('INVALID_STATE', 'The Mohr\'s-salt preparation input is invalid.')],
    };
  }

  if (state.preparation.lifecycle === 'complete') {
    return {
      outcome: 'BLOCKED',
      state,
      messages: [namedMessage(
        'PREPARATION_ALREADY_COMPLETE',
        'A completed preparation cannot be changed.',
      )],
    };
  }

  if (action.type === 'acidify-with-dilute-sulfuric-acid') {
    return state.acidificationPerformed
      ? { outcome: 'VALID', state, messages: [] }
      : {
          outcome: 'VALID',
          state: { ...state, acidificationPerformed: true },
          messages: [],
        };
  }

  const generic = applyPreparationAction(
    MOHRS_SALT_PREPARATION_DEFINITION,
    configuration,
    state.preparation,
    action,
  );
  return generic.outcome === 'BLOCKED'
    ? { outcome: 'BLOCKED', state, messages: generic.messages }
    : {
        outcome: generic.outcome,
        state: { ...state, preparation: generic.state },
        messages: generic.messages,
      };
}

export function deriveMohrsSaltPreparationResult(
  state: MohrsSaltPreparationState,
  configuration: ChemistryConfiguration = MOHRS_SALT_PREPARATION_CONFIGURATION,
): MohrsSaltPreparationResult {
  if (!isNamedInputValid(state, configuration)) {
    return {
      validity: 'unusable',
      issues: ['INVALID_INPUT'],
      actualConcentrationMolPerL: null,
      actualMassEquivalentG: null,
      actualVolumeL: null,
      acidificationPerformed: state.acidificationPerformed === true,
    };
  }

  const generic: PreparationResult = derivePreparationResult(
    MOHRS_SALT_PREPARATION_DEFINITION,
    configuration,
    state.preparation,
  );

  if (generic.validity === 'unusable'
    || generic.validity === 'in-progress'
    || state.acidificationPerformed) {
    return { ...generic, acidificationPerformed: state.acidificationPerformed };
  }

  return {
    ...generic,
    validity: 'unusable',
    issues: [...generic.issues, 'REQUIRED_ACIDIFICATION_MISSING'],
    acidificationPerformed: false,
  };
}
