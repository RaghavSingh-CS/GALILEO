import type { ExperimentConfig } from "../../types";

export const oxalicAcidConfig: ExperimentConfig = {
  id: "oxalic-acid-titration",
  title: "Oxalic Acid vs Potassium Permanganate",
  subject: "chemistry",
  description:
    "Standardize a potassium permanganate solution by titrating it against a hot standard solution of oxalic acid.",
  aim: "Determine the exact molarity of a KMnO₄ solution by titrating it against a standard 0.1M oxalic acid solution at 50-60°C. The reaction is self-indicating.",
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
      id: "flaskTemperature",
      label: "Flask Temp (Water Bath)",
      unit: "°C",
      min: 25,
      max: 90,
      step: 5,
      default: 55,
    },
    {
      id: "aliquotVolume",
      label: "Oxalic Acid Aliquot Vol",
      unit: "mL",
      min: 10,
      max: 10,
      step: 1,
      default: 10,
    }
  ],
  procedure: [
    "Prepare a standard 0.1M solution of oxalic acid dihydrate in a 250 mL volumetric flask.",
    "Pipette 10.0 mL of this standard oxalic acid solution into a conical flask.",
    "Add 5.0 mL of dilute sulfuric acid to the conical flask to provide an acidic medium.",
    "Heat the contents of the flask to 50-60°C on a water bath.",
    "Fill the burette with the unknown KMnO₄ solution.",
    "Titrate the hot oxalic acid solution with KMnO₄ until a permanent pale pink color is obtained.",
    "Calculate the exact molarity using the reaction stoichiometry (2 moles KMnO₄ per 5 moles oxalic acid).",
  ],
};
