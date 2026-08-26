import React, { useState, useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges,
  addEdge,
  ReactFlowProvider,
  ConnectionMode
} from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BatteryNode } from './nodes/BatteryNode';
import { ResistorNode } from './nodes/ResistorNode';
import { AmmeterNode } from './nodes/AmmeterNode';
import { VoltmeterNode } from './nodes/VoltmeterNode';
import { Palette } from './Palette';
import { buildCircuitState } from '../circuitAdapter';
import { 
  solveCircuit, 
  verifyOhmsLawExperiment, 
  verifySeriesParallelExperiment 
} from '../../../engines/physics';
import type { ComponentReading, SimulationResult } from '../../../engines/physics/circuits/types';
import type { 
  OhmsLawIssueCode, 
  SeriesParallelIssueCode, 
  ExperimentUsability 
} from '../../../engines/physics/experiments/types';

const nodeTypes = {
  battery: BatteryNode,
  resistor: ResistorNode,
  ammeter: AmmeterNode,
  voltmeter: VoltmeterNode,
};

export interface CircuitSandboxProps {
  experimentType: 'ohms-law' | 'series-parallel';
  onSimulationUpdate?: (
    nodes: Node[],
    simResult: SimulationResult,
    issues: (OhmsLawIssueCode | SeriesParallelIssueCode)[],
    usability: ExperimentUsability
  ) => void;
}

function CircuitSandboxContent({ experimentType, onSimulationUpdate }: CircuitSandboxProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Re-run simulation when nodes/edges change
  const runSimulation = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    // 1. Build the state
    const circuitState = buildCircuitState(currentNodes, currentEdges);

    // 2. Solve the circuit
    const simResult = solveCircuit(circuitState);

    // 3. Verify experiment
    let expIssues: (OhmsLawIssueCode | SeriesParallelIssueCode)[] = [];
    let expUsability: ExperimentUsability = 'usable';

    if (experimentType === 'ohms-law') {
      const res = verifyOhmsLawExperiment(circuitState);
      expIssues = res.issues;
      expUsability = res.usability;
    } else {
      const res = verifySeriesParallelExperiment(circuitState);
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

    setNodes(updatedNodes);

    if (onSimulationUpdate) {
      onSimulationUpdate(updatedNodes, simResult, expIssues, expUsability);
    }

  }, [experimentType, onSimulationUpdate]);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);
      
      // Look for deleted nodes to clean up edges
      const deletedIds = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
      if (deletedIds.size > 0) {
        setEdges(eds => {
          const nextEdges = eds.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target));
          setTimeout(() => runSimulation(nextNodes, nextEdges), 50);
          return nextEdges;
        });
      } else {
        setTimeout(() => runSimulation(nextNodes, edges), 50);
      }
      
      return nextNodes;
    });
  }, [edges, runSimulation]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds);
      setTimeout(() => runSimulation(nodes, nextEdges), 50);
      return nextEdges;
    });
  }, [nodes, runSimulation]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const nextEdges = addEdge({ ...connection, type: 'step' }, eds);
      setTimeout(() => runSimulation(nodes, nextEdges), 50);
      return nextEdges;
    });
  }, [nodes, runSimulation]);

  const onNodeDataChange = useCallback((nodeId: string, key: string, value: any) => {
    setNodes((nds) => {
      const nextNodes = nds.map(node => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, [key]: value } };
        }
        return node;
      });
      setTimeout(() => runSimulation(nextNodes, edges), 50);
      return nextNodes;
    });
  }, [edges, runSimulation]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;

    // A simple position estimate since we aren't using useReactFlow().screenToFlowPosition
    const position = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position,
      data: { onChange: onNodeDataChange },
    };

    if (type === 'battery') newNode.data.voltage = 5;
    if (type === 'resistor') newNode.data.resistance = 100;

    setNodes((nds) => {
      const count = nds.filter(n => n.type === type).length + 1;
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      newNode.data.label = `${typeName} ${count}`;

      const nextNodes = nds.concat(newNode);
      setTimeout(() => runSimulation(nextNodes, edges), 50);
      return nextNodes;
    });
  }, [onNodeDataChange, edges, runSimulation]);

  return (
    <div className="w-full h-full flex bg-slate-950 font-sans" ref={containerRef}>
      <Palette />
      
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
          fitView
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
