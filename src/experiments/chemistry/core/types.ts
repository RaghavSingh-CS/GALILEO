export type ApparatusId = string;
export type MaterialId = string;

export interface ChemicalMaterialDefinition {
  readonly name: string;
  readonly molarMassGPerMol: number;
}

export const APPARATUS_KINDS = [
  'beaker',
  'burette',
  'conical-flask',
  'volumetric-flask',
  'volumetric-pipette',
] as const;

export type ApparatusKind = (typeof APPARATUS_KINDS)[number];

export interface ApparatusDefinition {
  readonly kind: ApparatusKind;
  readonly capacityL: number;
  readonly supportsHeating: boolean;
}

export interface ChemistryConfiguration {
  readonly materials: Readonly<Record<MaterialId, ChemicalMaterialDefinition>>;
  readonly apparatus: Readonly<Record<ApparatusId, ApparatusDefinition>>;
}

export interface MixtureState {
  readonly volumeL: number;
  readonly dissolvedAmountsMol: Readonly<Record<MaterialId, number>>;
  readonly undissolvedAmountsMol: Readonly<Record<MaterialId, number>>;
}

export interface VesselState {
  readonly contents: MixtureState;
  readonly temperatureC: number;
}

export interface ChemistryState {
  readonly vessels: Readonly<Record<ApparatusId, VesselState>>;
}

export type MaterialQuantity =
  | { readonly kind: 'mass'; readonly massG: number }
  | { readonly kind: 'amount'; readonly amountMol: number };

export interface AddMaterialAction {
  readonly type: 'add-material';
  readonly targetApparatusId: ApparatusId;
  readonly materialId: MaterialId;
  readonly quantity: MaterialQuantity;
}

export interface TransferLiquidAction {
  readonly type: 'transfer-liquid';
  readonly sourceApparatusId: ApparatusId;
  readonly targetApparatusId: ApparatusId;
  readonly volumeL: number;
}

export interface HeatAction {
  readonly type: 'heat';
  readonly apparatusId: ApparatusId;
  readonly targetTemperatureC: number;
}

export type CoreAction =
  | AddMaterialAction
  | TransferLiquidAction
  | {
      readonly type: 'mix';
      readonly apparatusId: ApparatusId;
    }
  | HeatAction;

export type ActionOutcome = 'VALID' | 'WARNING' | 'BLOCKED';
export type MessageSeverity = 'info' | 'warning' | 'error';

export interface ChemistryMessage {
  readonly code: string;
  readonly severity: MessageSeverity;
  readonly message: string;
  readonly apparatusIds?: readonly ApparatusId[];
  readonly materialIds?: readonly MaterialId[];
}

export interface CoreActionResult {
  readonly outcome: ActionOutcome;
  readonly state: ChemistryState;
  readonly messages: readonly ChemistryMessage[];
}
