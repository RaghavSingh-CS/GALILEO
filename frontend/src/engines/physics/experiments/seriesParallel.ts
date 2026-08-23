import { ExperimentDefinition } from '../circuits/types';

export const seriesParallelExperiment: ExperimentDefinition = {
  id: 'series-parallel',
  title: "Series and Parallel Resistances",
  objective: "Verify the equivalent resistance of resistors connected in series and parallel combinations.",
  apparatus: ['battery', 'resistor', 'resistor', 'resistor', 'ammeter', 'voltmeter', 'switch'],
  instructions: [
    "For the Series circuit, connect three resistors end-to-end with the battery and switch.",
    "Measure the total current using the ammeter and voltage across each resistor using the voltmeter.",
    "For the Parallel circuit, connect the resistors across the same two nodes.",
    "Measure the total current and branch currents."
  ]
};
