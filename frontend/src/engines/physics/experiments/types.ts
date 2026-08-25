export type ExperimentUsability = 'usable' | 'unusable' | 'in-progress';

export type OhmsLawIssueCode = 
  | 'MISSING_BATTERY' 
  | 'MISSING_RESISTOR' 
  | 'MISSING_AMMETER' 
  | 'MISSING_VOLTMETER' 
  | 'EXTRANEOUS_COMPONENTS' 
  | 'AMMETER_NOT_IN_SERIES' 
  | 'VOLTMETER_NOT_IN_PARALLEL' 
  | 'CIRCUIT_NOT_CLOSED'
  | 'SHORT_CIRCUIT';

export interface OhmsLawResult {
  usability: ExperimentUsability;
  issues: OhmsLawIssueCode[];
  voltageReadingV: number | null;
  currentReadingA: number | null;
}

export type SeriesParallelIssueCode = 
  | 'MISSING_BATTERY' 
  | 'MISSING_RESISTORS'
  | 'MISSING_AMMETER' 
  | 'MISSING_VOLTMETER'
  | 'EXTRANEOUS_COMPONENTS'
  | 'NOT_PURE_SERIES_OR_PARALLEL'
  | 'CIRCUIT_NOT_CLOSED'
  | 'SHORT_CIRCUIT'
  | 'VOLTMETER_MISPLACED';

export interface SeriesParallelResult {
  usability: ExperimentUsability;
  configuration: 'series' | 'parallel' | 'mixed' | 'unknown';
  issues: SeriesParallelIssueCode[];
  equivalentResistanceOhms: number | null;
  totalVoltageV: number | null;
  totalCurrentA: number | null;
}
