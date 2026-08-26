import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges,
  addEdge,
  ReactFlowProvider,
  ConnectionMode,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BatteryNode } from './nodes/BatteryNode';
import { ResistorNode } from './nodes/ResistorNode';
import { AmmeterNode } from './nodes/AmmeterNode';
import { VoltmeterNode } from './nodes/VoltmeterNode';
import { VariableResistorNode } from './nodes/VariableResistorNode';
import { SwitchNode } from './nodes/SwitchNode';
import { Palette } from './Palette';
import type { PaletteComponentType } from './Palette';
import { buildCircuitState } from '../circuitAdapter';
import { 
  solveCircuit, 
  verifyOhmsLawExperiment, 
  verifySeriesParallelExperiment 
} from '../../../engines/physics';
import type { ComponentReading, SimulationResult } from '../../../engines/physics/circuits/types';
import type { 
  OhmsLawIssueCode, 
  OhmsLawResult,
  SeriesParallelIssueCode, 
  SeriesParallelResult,
  ExperimentUsability 
} from '../../../engines/physics/experiments/types';

const nodeTypes = {
  battery: BatteryNode,
  resistor: ResistorNode,
  variable_resistor: VariableResistorNode,
  switch: SwitchNode,
  ammeter: AmmeterNode,
  voltmeter: VoltmeterNode,
};

export interface CircuitSandboxProps {
  experimentType: 'ohms-law' | 'series-parallel';
  onSimulationUpdate?: (
    nodes: Node[],
    simResult: SimulationResult,
    issues: (OhmsLawIssueCode | SeriesParallelIssueCode)[],
    usability: ExperimentUsability,
    experimentResult: OhmsLawResult | SeriesParallelResult,
  ) => void;
}

function CircuitSandboxContent({ experimentType, onSimulationUpdate }: CircuitSandboxProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const simulationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Re-run simulation when nodes/edges change
  const runSimulation = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    // 1. Build the state
    const circuitState = buildCircuitState(currentNodes, currentEdges);

    // 2. Solve the circuit
    const simResult = solveCircuit(circuitState);

    // 3. Verify experiment
    let expIssues: (OhmsLawIssueCode | SeriesParallelIssueCode)[] = [];
    let expUsability: ExperimentUsability = 'usable';
    let experimentResult: OhmsLawResult | SeriesParallelResult;

    if (experimentType === 'ohms-law') {
      const res = verifyOhmsLawExperiment(circuitState);
      experimentResult = res;
      expIssues = res.issues;
      expUsability = res.usability;
    } else {
      const res = verifySeriesParallelExperiment(circuitState);
      experimentResult = res;
      expIssues = res.issues;
      expUsability = res.usability;
    }

    // 4. Update state for the UI
    // (State pushed to parent via callback)

    // 5. Apply readings back into node data to re-render Ammeters/Voltmeters
    const updatedNodes = currentNodes.map((node) => {
      const reading = simResult.readings.find((r: ComponentReading) => r.componentId === node.id);
      
      const nodeValidations = simResult.validation.filter(v => v.componentIds?.includes(node.id));
      const isError = nodeValidations.some(v => v.severity === 'error');
      const isWarning = nodeValidations.some(v => v.severity === 'warning');
      const highlight = isError ? 'error' : (isWarning ? 'warning' : null);

      let readingValue = reading ? reading.value : null;

      if (node.type === 'voltmeter' || node.type === 'ammeter') {
        const h1 = node.type === 'voltmeter' ? 'positive' : 'in';
        const h2 = node.type === 'voltmeter' ? 'negative' : 'out';

        const hasH1 = circuitState.wires.some(w => w.sourceTerminalId === `${node.id}:${h1}` || w.targetTerminalId === `${node.id}:${h1}`);
        const hasH2 = circuitState.wires.some(w => w.sourceTerminalId === `${node.id}:${h2}` || w.targetTerminalId === `${node.id}:${h2}`);

        if (!hasH1 || !hasH2) {
          readingValue = null;
        }
      }

      return {
        ...node,
        data: { 
          ...node.data, 
          reading: readingValue,
          highlight
        }
      };
    });

    nodesRef.current = updatedNodes;
    setNodes(updatedNodes);

    if (onSimulationUpdate) {
      onSimulationUpdate(updatedNodes, simResult, expIssues, expUsability, experimentResult);
    }

  }, [experimentType, onSimulationUpdate]);

  const scheduleSimulation = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
    simulationTimerRef.current = setTimeout(() => {
      runSimulation(nodesRef.current, edgesRef.current);
      simulationTimerRef.current = null;
    }, 50);
  }, [runSimulation]);

  useEffect(() => () => {
    if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);
      nodesRef.current = nextNodes;
      
      // Look for deleted nodes to clean up edges
      const deletedIds = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
      if (deletedIds.size > 0) {
        setEdges(eds => {
          const nextEdges = eds.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target));
          edgesRef.current = nextEdges;
          scheduleSimulation(nextNodes, nextEdges);
          return nextEdges;
        });
      } else {
        scheduleSimulation(nextNodes, edgesRef.current);
      }
      
      return nextNodes;
    });
  }, [scheduleSimulation]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds);
      edgesRef.current = nextEdges;
      scheduleSimulation(nodesRef.current, nextEdges);
      return nextEdges;
    });
  }, [scheduleSimulation]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      if (!connection.sourceHandle || !connection.targetHandle) return eds;
      if (connection.source === connection.target) return eds;
      const duplicate = eds.some((edge) => (
        (edge.sourceHandle === connection.sourceHandle && edge.targetHandle === connection.targetHandle)
        || (edge.sourceHandle === connection.targetHandle && edge.targetHandle === connection.sourceHandle)
      ));
      if (duplicate) return eds;
      const nextEdges = addEdge({ ...connection, type: 'step' }, eds);
      edgesRef.current = nextEdges;
      scheduleSimulation(nodesRef.current, nextEdges);
      return nextEdges;
    });
  }, [scheduleSimulation]);

  const onNodeDataChange = useCallback((nodeId: string, key: string, value: unknown) => {
    setNodes((nds) => {
      const nextNodes = nds.map(node => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, [key]: value } };
        }
        return node;
      });
      nodesRef.current = nextNodes;
      scheduleSimulation(nextNodes, edgesRef.current);
      return nextNodes;
    });
  }, [scheduleSimulation]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const addComponent = useCallback((type: PaletteComponentType, position: { x: number; y: number }) => {
    const newNode: Node = {
      id: `${type}_${crypto.randomUUID()}`,
      type,
      position,
      data: { onChange: onNodeDataChange },
    };

    if (type === 'battery') newNode.data.voltage = 5;
    if (type === 'resistor') newNode.data.resistance = 100;
    if (type === 'variable_resistor') {
      newNode.data.minResistance = 1;
      newNode.data.maxResistance = 1000;
      newNode.data.resistance = 100;
    }
    if (type === 'switch') newNode.data.closed = false;

    setNodes((nds) => {
      const count = nds.filter(n => n.type === type).length + 1;
      const typeName = type.replace('_', ' ').replace(/^./, character => character.toUpperCase());
      newNode.data.label = `${typeName} ${count}`;

      const nextNodes = nds.concat(newNode);
      nodesRef.current = nextNodes;
      scheduleSimulation(nextNodes, edgesRef.current);
      return nextNodes;
    });
  }, [onNodeDataChange, scheduleSimulation]);

  const addComponentFromPalette = useCallback((type: PaletteComponentType) => {
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    const column = nodes.length % 2;
    const row = Math.floor(nodes.length / 2);
    addComponent(type, screenToFlowPosition({
      x: column === 0 ? bounds.left + 24 : bounds.right - 184,
      y: bounds.top + 36 + row * 150,
    }));
  }, [addComponent, nodes.length, screenToFlowPosition]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (!Object.hasOwn(nodeTypes, type)) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    addComponent(type as PaletteComponentType, position);
  }, [addComponent, screenToFlowPosition]);

  return (
    <div className="w-full h-full flex bg-slate-950 font-sans" ref={containerRef}>
      <Palette onAddComponent={addComponentFromPalette} />
      
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onDragOver={onDragOver}
          onDrop={onDrop}
          defaultEdgeOptions={{ type: 'step' }}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={40}
          className="bg-slate-900"
        >
          <Background color="#334155" gap={24} />
          <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
        </ReactFlow>
      </div>
    </div>
  );
}

export function CircuitSandbox(props: CircuitSandboxProps) {
  return (
    <ReactFlowProvider>
      <CircuitSandboxContent {...props} />
    </ReactFlowProvider>
  );
}
