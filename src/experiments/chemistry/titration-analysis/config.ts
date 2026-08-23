import type { ExperimentConfig } from "../../types";

export const titrationConfig: ExperimentConfig = {
  id: "titration-analysis",
  title: "Titration Analysis",
  subject: "chemistry",
  description:
    "Determine the concentration of an unknown basic solution by performing a simulated acid-base neutralization with automated pH curve tracking.",
  aim: "Determine the concentration (molarity) of an unknown basic solution (NaOH) by titrating it with a standard strong acid solution (0.1M HCl) using phenolphthalein indicator and recording the pH neutralization curve.",
  apparatus: [
    {
      id: "volumeAdded",
      label: "Titrant Added (HCl)",
      unit: "mL",
      min: 0,
      max: 50,
      step: 0.5,
      default: 0,
    },
    {
      id: "flowRate",
      label: "Acid Flow Rate",
      unit: "mL/s",
      min: 0.1,
      max: 2.0,
      step: 0.1,
      default: 0.5,
    },
    {
      id: "stirrerSpeed",
      label: "Stirrer Speed",
      unit: "RPM",
      min: 0,
      max: 800,
      step: 50,
      default: 300,
    },
    {
      id: "analyteVolume",
      label: "Initial Analyte Volume",
      unit: "mL",
      min: 10,
      max: 50,
      step: 5,
      default: 25,
    },
  ],
  procedure: [
    "Fill the buret with standard 0.1M hydrochloric acid (HCl) solution up to the 0.00 mL mark.",
    "Pipette exactly 25.00 mL of unknown NaOH solution into the clean Erlenmeyer flask.",
    "Add 2-3 drops of phenolphthalein indicator (solution turns bright magenta/pink).",
    "Turn on the magnetic stirrer (approx. 300 RPM) for continuous mixing.",
    "Adjust the acid flow rate and incrementally add HCl from the buret into the flask.",
    "Continuously record the sensor pH level as titrant is introduced.",
    "Observe the rapid pH drop near the equivalence point (25.00 mL) where the pink color sharply discharges to colorless (pH ~ 7.0).",
    "Calculate the exact molarity using the neutralization formula M₁V₁ = M₂V₂.",
  ],
};
