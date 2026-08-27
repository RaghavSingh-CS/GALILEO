import { create } from "zustand";
import type { Observation } from "@/experiments/types";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import { cleanStaleEdges, translateToCircuitState, translateValidationMessages } from "@/experiments/physics/circuitAdapter";
import { getExperiment } from "@/experiments/registry";
import { solveCircuit } from "@/engines/physics";

export type SessionStatus = 'idle' | 'running' | 'paused' | 'complete' | 'invalid' | 'error';

interface ExperimentSessionStore {
  // Visual LabState (React Flow)
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setCircuitGraph: (nodes: Node[], edges: Edge[]) => void;
  validationMessages: string[];
  
  // Physics Circuit State Output
  liveCircuitPower: number;
  liveCircuitCurrent: number;

  // Apparatus values keyed by param ID
  apparatusValues: Record<string, number>;
  setApparatusValue: (key: string, value: number) => void;
  initApparatus: (defaults: Record<string, number>) => void;

  // Observations log
  observations: Observation[];
  addObservation: (inputs: Record<string, number>, outputs: Record<string, any>) => void;
  readingAnalysisKey: number;
  requestReadingAnalysis: () => void;
  clearObservations: () => void;

  // Session lifecycle
  activeExperimentId: string;
  sessionStatus: SessionStatus;
  chatContextKey: number;
  observationCounter: number;
  notes: string;
  setNotes: (notes: string) => void;
  startSession: (experimentId: string, defaults: Record<string, number>) => void;
  startExperiment: () => void;
  pauseExperiment: () => void;
  setSessionStatus: (status: SessionStatus) => void;
  loadSession: (experimentId: string, apparatus: Record<string, number>, observations: Observation[], notes?: string, circuit?: { nodes: Node[]; edges: Edge[] }) => void;
}

export const useExperimentStore = create<ExperimentSessionStore>((set, get) => ({
  nodes: [],
  edges: [],
  validationMessages: [],
  liveCircuitPower: 0,
  liveCircuitCurrent: 0,
  apparatusValues: {},
  observations: [],
  readingAnalysisKey: 0,
  activeExperimentId: '',
  sessionStatus: 'idle',
  chatContextKey: Date.now(),
  observationCounter: 0,
  notes: '',
  setNotes: (notes) => set({ notes }),

  setNodes: (nodes) => {
    set({ nodes });
    get().onNodesChange([]); // trigger recalculation
  },
  
  setEdges: (edges) => {
    set({ edges });
    get().onNodesChange([]); // trigger recalculation
  },

  setCircuitGraph: (nodes, edges) => set({ nodes, edges }),

  onNodesChange: (changes) => {
    const state = get();
    const nextNodes = applyNodeChanges(changes, state.nodes);
    
    // Check for deletions to clean up edges (PHY-020)
    const deletedNodes = changes.filter(c => c.type === 'remove').map(c => state.nodes.find(n => n.id === (c as any).id)).filter(Boolean) as Node[];
    
    let nextEdges = state.edges;
    if (deletedNodes.length > 0) {
      nextEdges = cleanStaleEdges(nextEdges, deletedNodes);
    }
    
    set({ nodes: nextNodes, edges: nextEdges });
    
    // Recalculate circuit
    const circuitState = translateToCircuitState(nextNodes, nextEdges);
    // Apply apparatus values to the circuit state
    for (const comp of circuitState.components) {
      if (comp.type === 'battery' && 'voltage' in state.apparatusValues) {
        comp.voltage = state.apparatusValues.voltage;
      }
      if (comp.type === 'resistor' && 'resistance' in state.apparatusValues) {
        comp.resistance = state.apparatusValues.resistance;
      }
    }
    const result = solveCircuit(circuitState);
    
    let power = 0;
    let current = 0;
    if (result.success) {
      const batReading = result.branchData.find(b => b.type === 'battery');
      const resReading = result.branchData.find(b => b.type === 'resistor');
      if (batReading) power = Math.abs(batReading.voltage * batReading.current) * 1000;
      if (resReading) current = Math.abs(resReading.current) * 1000;
    }
    
    const isChemistry = getExperiment(state.activeExperimentId)?.config.subject === 'chemistry';
    const messages = isChemistry ? [] : translateValidationMessages(result.validation);
    let nextStatus = state.sessionStatus;
    if (messages.length > 0) {
      if (nextStatus === 'running' || nextStatus === 'idle') nextStatus = 'invalid';
    } else if (nextStatus === 'invalid') {
      nextStatus = 'idle';
    }

    set({ 
      validationMessages: messages,
      liveCircuitPower: power,
      liveCircuitCurrent: current,
      sessionStatus: nextStatus
    });
  },

  onEdgesChange: (changes) => {
    const state = get();
    const nextEdges = applyEdgeChanges(changes, state.edges);
    set({ edges: nextEdges });
    // Recalculate via onNodesChange trick
    get().onNodesChange([]);
  },

  onConnect: (connection) => {
    const state = get();
    const nextEdges = addEdge(connection, state.edges);
    set({ edges: nextEdges });
    get().onNodesChange([]);
  },



  setApparatusValue: (key, value) => {
    set((state) => ({
      apparatusValues: { ...state.apparatusValues, [key]: value },
    }));
    get().onNodesChange([]);
  },

  initApparatus: (defaults) => {
    set({ apparatusValues: { ...defaults } });
    get().onNodesChange([]);
  },

  addObservation: (inputs, outputs) => {
    const count = get().observationCounter + 1;
    const obs: Observation = {
      id: count,
      timestamp: Date.now(),
      inputs: { ...inputs },
      outputs: { ...outputs },
    };
    set((state) => ({
      observations: [...state.observations, obs],
      observationCounter: count,
    }));
  },

  requestReadingAnalysis: () => set((state) => ({ readingAnalysisKey: state.readingAnalysisKey + 1 })),

  clearObservations: () => set({ observations: [], observationCounter: 0 }),

  startSession: (experimentId, defaults) => {
    set({
      activeExperimentId: experimentId,
      sessionStatus: 'idle',
      chatContextKey: Date.now(),
      apparatusValues: { ...defaults },
      observations: [],
      readingAnalysisKey: 0,
      observationCounter: 0,
      validationMessages: [],
      liveCircuitPower: 0,
      liveCircuitCurrent: 0,
      notes: '',
      nodes: [],
      edges: [],
    });
  },

  startExperiment: () => set({ sessionStatus: 'running' }),

  pauseExperiment: () => set({ sessionStatus: 'paused' }),

  setSessionStatus: (status) => set({ sessionStatus: status }),

  loadSession: (experimentId, apparatus, observations, notes, circuit) =>
    set({
      activeExperimentId: experimentId,
      apparatusValues: { ...apparatus },
      observations: [...observations],
      observationCounter: observations.length,
      sessionStatus: 'idle',
      chatContextKey: Date.now(),
      notes,
      nodes: circuit?.nodes ? [...circuit.nodes] : [],
      edges: circuit?.edges ? [...circuit.edges] : [],
    }),
}));
