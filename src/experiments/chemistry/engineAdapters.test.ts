import { describe, expect, it } from 'vitest';
import { oxalicAcidEngine } from './oxalic-acid/engine';
import { mohrsSaltEngine } from './mohrs-salt/engine';

describe('chemistry frontend engine adapters', () => {
  const inputs = {
    volumeAdded: 7.5,
    flaskTemperature: 55,
    aliquotVolume: 10,
  };

  it.each([
    ['oxalic acid', oxalicAcidEngine],
    ["Mohr's salt", mohrsSaltEngine],
  ])('%s remains deterministic when sensor-noise settings are enabled', (_name, engine) => {
    const readings = Array.from({ length: 5 }, () => engine.compute(inputs, { noiseFraction: 0.02 }));

    expect(readings.every(reading => JSON.stringify(reading) === JSON.stringify(readings[0]))).toBe(true);
    expect(readings[0].volAdded).toBe(7.5);
    expect(readings[0].totalVol).toBe(22.5);
  });

  it('uses named oxalic-acid truth for concentration, fixed aliquot, endpoint, and temperature validity', () => {
    const before = oxalicAcidEngine.compute({ volumeAdded: 40, flaskTemperature: 55, aliquotVolume: 25 });
    const endpoint = oxalicAcidEngine.compute({ volumeAdded: 40.05, flaskTemperature: 55, aliquotVolume: 25 });
    const overshot = oxalicAcidEngine.compute({ volumeAdded: 40.1, flaskTemperature: 55 });

    expect(before.equivalenceVolume).toBeCloseTo(40, 10);
    expect(before.endpointVolume).toBeCloseTo(40.05, 10);
    expect(before.totalVol).toBeCloseTo(55, 10);
    expect(endpoint.actualTitrantMolarity).toBe(0.01);
    expect(endpoint.assessment).toBe('endpoint');
    expect(endpoint.usability).toBe('usable');
    expect(endpoint.calculatedTitrantMolarity).toBeCloseTo(0.01, 4);
    expect(overshot.assessment).toBe('overshot');
    expect(overshot.usability).toBe('overshot');
    expect(overshot.calculatedTitrantMolarity).toBeNull();

    for (const temperature of [49.9, 60.1]) {
      const invalid = oxalicAcidEngine.compute({ volumeAdded: 40.05, flaskTemperature: temperature });
      expect(invalid.reactionSupported).toBe(false);
      expect(invalid.canCapture).toBe(false);
      expect(invalid.canSweep).toBe(false);
      expect(invalid.issueCodes).toContain(temperature < 50 ? 'TEMPERATURE_TOO_LOW' : 'TEMPERATURE_TOO_HIGH');
    }
    for (const temperature of [50, 55, 60]) {
      expect(oxalicAcidEngine.compute({ volumeAdded: 0, flaskTemperature: temperature }).reactionSupported).toBe(true);
    }
  });

  it("uses named Mohr's-salt truth for concentration, fixed aliquot, endpoint, and overshoot", () => {
    const before = mohrsSaltEngine.compute({ volumeAdded: 10, aliquotVolume: 25 });
    const endpoint = mohrsSaltEngine.compute({ volumeAdded: 10.05, aliquotVolume: 25 });
    const overshot = mohrsSaltEngine.compute({ volumeAdded: 10.1 });

    expect(before.equivalenceVolume).toBeCloseTo(10, 10);
    expect(before.endpointVolume).toBeCloseTo(10.05, 10);
    expect(before.totalVol).toBeCloseTo(25, 10);
    expect(endpoint.actualTitrantMolarity).toBe(0.01);
    expect(endpoint.assessment).toBe('endpoint');
    expect(endpoint.usability).toBe('usable');
    expect(endpoint.calculatedTitrantMolarity).toBeCloseTo(0.01, 4);
    expect(overshot.assessment).toBe('overshot');
    expect(overshot.usability).toBe('overshot');
    expect(overshot.calculatedTitrantMolarity).toBeNull();
  });
});
