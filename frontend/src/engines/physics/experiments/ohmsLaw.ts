import { ExperimentDefinition } from '../circuits/types';

export const ohmsLawExperiment: ExperimentDefinition = {
  id: 'ohms-law',
  title: "Ohm's Law Verification",
  objective: "Verify Ohm's Law (V = IR) by measuring the current through a resistor for different voltages.",
  apparatus: ['battery', 'resistor', 'ammeter', 'voltmeter', 'switch'],
  instructions: [
    "Connect the battery, switch, ammeter, and resistor in series.",
    "Connect the voltmeter in parallel across the resistor.",
    "Close the switch to complete the circuit.",
    "Record the voltage and current readings.",
    "Change the battery voltage (if adjustable) or resistor value and repeat."
  ]
};
