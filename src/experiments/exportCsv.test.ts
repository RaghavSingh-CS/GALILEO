import { describe, expect, it } from "vitest";
import type { Observation } from "./types";
import { buildExperimentCsv } from "./exportCsv";

const base = { id: 1, timestamp: 1 };

describe("experiment-specific CSV export", () => {
  it("exports Ohm's Law in explicit SI units", () => {
    const observation: Observation = {
      ...base,
      inputs: { voltage: 14, resistance: 97 },
      outputs: { current: 144.3299, power: 2020.6186, currentA: 14 / 97, powerW: 196 / 97, validity: "usable" },
    };
    const csv = buildExperimentCsv("ohms-law", [observation]);
    expect(csv).toContain("Current (A)");
    expect(csv).toContain("Power (W)");
    expect(csv).toContain(String(14 / 97));
    expect(csv).not.toContain("pH");
  });

  it("exports series/parallel topology, SI totals, and stored component values", () => {
    const observation: Observation = {
      ...base,
      inputs: { voltage: 14 },
      outputs: {
        configuration: 1,
        voltage: 14,
        totalCurrentA: 0.1,
        equivalentResistanceOhms: 140,
        resistorValuesOhms: "40; 100",
        validity: "usable",
      },
    };
    const csv = buildExperimentCsv("series-parallel", [observation]);
    expect(csv).toContain("Series,14,0.1,140,40; 100,usable");
    expect(csv).not.toContain("pH");
  });

  it("exports only genuine oxalic-acid titration fields", () => {
    const observation: Observation = {
      ...base,
      inputs: { volumeAdded: 40.05, flaskTemperature: 55, aliquotVolume: 10 },
      outputs: {
        volAdded: 40.05,
        actualTitrantMolarity: 0.01,
        calculatedTitrantMolarity: 0.0099875,
        assessment: "endpoint",
        usability: "usable",
        issueCodes: [],
      },
    };
    const csv = buildExperimentCsv("oxalic-acid-titration", [observation]);
    expect(csv).toContain("40.05,0.01,0.0099875,endpoint,55,usable");
    expect(csv).not.toContain("pH");
  });

  it("exports only genuine Mohr's-salt titration fields", () => {
    const observation: Observation = {
      ...base,
      inputs: { volumeAdded: 10.05, aliquotVolume: 10 },
      outputs: {
        volAdded: 10.05,
        actualTitrantMolarity: 0.01,
        calculatedTitrantMolarity: 0.00995025,
        assessment: "endpoint",
        usability: "usable",
        issueCodes: [],
      },
    };
    const csv = buildExperimentCsv("mohrs-salt-titration", [observation]);
    expect(csv).toContain("10.05,0.01,0.00995025,endpoint,usable");
    expect(csv).not.toContain("pH");
  });
});
