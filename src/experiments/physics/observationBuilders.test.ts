import { describe, expect, it } from "vitest";
import { buildOhmsLawObservation } from "./observationBuilders";

describe("physics observation unit boundary", () => {
  it("preserves the 14 V / 97 ohm reference in SI and derives display values once", () => {
    const currentA = 14 / 97;
    const observation = buildOhmsLawObservation(14, currentA, "usable");

    expect(observation.inputs.resistance).toBeCloseTo(97, 10);
    expect(observation.outputs.currentA).toBeCloseTo(0.1443298969, 9);
    expect(observation.outputs.current).toBeCloseTo(144.3298969, 6);
    expect(observation.outputs.powerW).toBeCloseTo(2.0206185567, 9);
    expect(observation.outputs.power).toBeCloseTo(2020.6185567, 6);
  });
});
