import type { ExperimentConfig } from "../../types";

export const ohmsLawConfig: ExperimentConfig = {
  id: "ohms-law",
  title: "Ohm's Law",
  subject: "physics",
  description:
    "Verify the linear relationship between voltage and current across a resistor at constant resistance.",
  aim: "To verify Ohm's law by studying the relationship between the potential difference (V) across a resistor and the electric current (I) flowing through it, and to determine the resistance of the resistor from the V-I characteristic curve.",
  apparatus: [],
  procedure: [
    "Connect the ammeter in series and the voltmeter in parallel across the resistance wire in the circuit.",
    "Set the resistance to the desired value using the apparatus controls.",
    "Adjust the voltage source to the starting value.",
    "Record the ammeter reading (current) for the set voltage.",
    "Increment the voltage in steps and record the current at each step.",
    "Tabulate all readings of voltage (V) and current (I).",
    "Plot V vs I on a graph. A straight line through the origin confirms Ohm's law.",
    "Calculate resistance as the slope R = V / I and compare with the set value.",
  ],
};
