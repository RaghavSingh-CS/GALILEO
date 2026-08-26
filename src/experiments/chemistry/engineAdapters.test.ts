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
});
