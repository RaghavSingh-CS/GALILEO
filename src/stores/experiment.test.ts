import { describe, it, expect, beforeEach } from 'vitest';
import { useExperimentStore } from './experiment';
import { getExperiment } from '../experiments/registry';

describe('Experiment Store - Session Isolation', () => {
  beforeEach(() => {
    // Reset store before each test
    useExperimentStore.setState({
      observations: [],
      apparatusValues: {},
      sessionStatus: 'idle',
      chatContextKey: 0
    });
  });

  it('UI-019: switches from Ohms Law to Titration cleanly without state leakage', () => {
    const store = useExperimentStore.getState();

    // 1. Launch Ohm's Law
    const ohmsLaw = getExperiment('ohms-law')!;
    const ohmsDefaults: Record<string, number> = {};
    ohmsLaw.config.apparatus.forEach(p => ohmsDefaults[p.id] = p.default);
    store.startSession('ohms-law', ohmsDefaults);

    // 2. Modify state and record observations
    useExperimentStore.getState().setApparatusValue('voltage', 12.5);
    useExperimentStore.getState().addObservation(
      { voltage: 12.5, resistance: 100 }, 
      { current: 125, power: 1562.5 }
    );

    const activeState = useExperimentStore.getState();
    expect(activeState.apparatusValues.voltage).toBe(12.5);
    expect(activeState.observations.length).toBe(1);

    // 3. Switch to Titration WITHOUT manually resetting
    const titration = getExperiment('oxalic-acid-titration')!;
    const titrDefaults: Record<string, number> = {};
    titration.config.apparatus.forEach(p => titrDefaults[p.id] = p.default);
    
    // startSession is the unified launch action for fresh launches
    useExperimentStore.getState().startSession('oxalic-acid-titration', titrDefaults);

    // 4. Confirm titration starts with empty apparatus/observations, not leftover Ohm data
    const finalState = useExperimentStore.getState();
    
    // Ohm's law specific state should not exist
    expect(finalState.apparatusValues.voltage).toBeUndefined();
    
    // Titration defaults should exist
    expect(finalState.apparatusValues.volumeAdded).toBe(0);
    
    // Observations should be completely cleared
    expect(finalState.observations.length).toBe(0);
  });
});
