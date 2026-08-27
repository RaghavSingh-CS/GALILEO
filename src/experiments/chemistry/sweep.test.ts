import { describe, expect, it } from "vitest";
import { nextTitrationSweepVolume, shouldStopTitrationSweep } from "./sweep";

describe("Chemistry sweep endpoint control", () => {
  it.each([
    ["oxalic acid", 39.5, 0.5, 40.05],
    ["Mohr's salt", 9.5, 0.5, 10.05],
  ])("clamps %s flow to the named-engine endpoint instead of sweeping past it", (_name, current, rate, endpoint) => {
    expect(nextTitrationSweepVolume(current, rate, endpoint)).toBe(endpoint);
  });

  it("stops for endpoint, overshoot, or a scientifically unsupported reaction", () => {
    expect(shouldStopTitrationSweep({ assessment: "endpoint" })).toBe(true);
    expect(shouldStopTitrationSweep({ assessment: "overshot" })).toBe(true);
    expect(shouldStopTitrationSweep({ reactionSupported: false })).toBe(true);
    expect(shouldStopTitrationSweep({ assessment: "before-endpoint", reactionSupported: true, canSweep: true })).toBe(false);
  });
});
