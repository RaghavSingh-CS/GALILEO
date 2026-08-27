import type { ExperimentConfig } from "../../types";

export const mohrsSaltConfig: ExperimentConfig = {
  id: "mohrs-salt-titration",
  title: "Mohr's Salt vs Potassium Permanganate",
  subject: "chemistry",
  description:
    "Standardize a potassium permanganate solution by titrating it against a standard solution of Mohr's salt.",
  aim: "Determine the exact molarity of a KMnO₄ solution by titrating it against a standard 0.05M Mohr's salt solution. The reaction is self-indicating and does not require heating.",
  apparatus: [
    {
      id: "volumeAdded",
      label: "Titrant Added (KMnO₄)",
      unit: "mL",
      min: 0,
      max: 50,
      step: 0.05,
      default: 0,
    },
    {
      id: "flowRate",
      label: "Titrant Flow Rate",
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
      id: "aliquotVolume",
      label: "Mohr's Salt Aliquot Vol",
      unit: "mL",
      min: 10,
      max: 10,
      step: 1,
      default: 10,
    }
  ],
  procedure: [
    "Prepare a standard 0.05M solution of Mohr's salt in a 250 mL volumetric flask, adding dilute sulfuric acid to prevent hydrolysis.",
    "Pipette 10.0 mL of this standard Mohr's salt solution into a conical flask.",
    "Add 5.0 mL of dilute sulfuric acid to the conical flask to provide an acidic medium.",
    "Fill the burette with the unknown KMnO₄ solution.",
    "Titrate the Mohr's salt solution with KMnO₄ until a permanent pale pink color is obtained.",
    "Calculate the exact molarity using the reaction stoichiometry (1 mole KMnO₄ per 5 moles Fe²⁺).",
  ],
};
