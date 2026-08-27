import type { ExperimentConfig } from "../../types";

export const seriesParallelConfig: ExperimentConfig = {
  id: "series-parallel",
  title: "Series and Parallel Circuits",
  subject: "physics",
  description: "Investigate equivalent resistance in series and parallel circuit configurations.",
  aim: "Determine how the total equivalent resistance of a circuit changes when resistors are connected in series versus parallel.",
  apparatus: [],
  procedure: [
    "1. Connect two or more resistors in a series circuit with the DC power supply.",
    "2. Connect the ammeter in series and voltmeter in parallel to measure total current and voltage.",
    "3. Record the equivalent resistance and confirm it is the sum of individual resistances.",
    "4. Reconfigure the resistors into a parallel circuit.",
    "5. Measure the total current and confirm the equivalent resistance decreases.",
  ],
};
