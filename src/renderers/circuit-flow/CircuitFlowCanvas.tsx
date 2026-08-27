import { useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Panel,
  Handle,
  Position
} from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useExperimentStore } from '@/stores/experiment';

function ComponentNode({ data, isConnectable, type }: NodeProps) {
  const isBattery = type === 'battery';
  const isResistor = type === 'resistor';
  const isAmmeter = type === 'ammeter';
  const label = isBattery ? 'Battery' : isResistor ? 'Resistor' : isAmmeter ? 'Ammeter' : type;

  return (
    <div className="bg-[#20201f] border border-[#333333] rounded-lg p-3 min-w-[100px] text-center shadow-lg relative text-[#c2c8c4] font-label-caps text-[10px]">
      <Handle
        type="target"
        position={Position.Left}
        id={isBattery ? 'positive' : isAmmeter ? 'in' : 'a'}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-[#8da399]"
      />
      
      <div className="mb-1 text-[#8da399] font-bold">{label}</div>
      {isBattery && <div className="font-data-mono text-sm">{String(data.voltage)}V</div>}
      {isResistor && <div className="font-data-mono text-sm">{String(data.resistance)}Ω</div>}
      
      <Handle
        type="source"
        position={Position.Right}
        id={isBattery ? 'negative' : isAmmeter ? 'out' : 'b'}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-[#8da399]"
      />
    </div>
  );
}

const nodeTypes = {
  battery: ComponentNode,
  resistor: ComponentNode,
  ammeter: ComponentNode,
  voltmeter: ComponentNode,
};

export default function CircuitFlowCanvas() {
  const nodes = useExperimentStore((s) => s.nodes);
  const edges = useExperimentStore((s) => s.edges);
  const onNodesChange = useExperimentStore((s) => s.onNodesChange);
  const onEdgesChange = useExperimentStore((s) => s.onEdgesChange);
  const onConnect = useExperimentStore((s) => s.onConnect);
  const setNodes = useExperimentStore((s) => s.setNodes);
  const setEdges = useExperimentStore((s) => s.setEdges);
  const validationMessages = useExperimentStore((s) => s.validationMessages);

  // Initialize a default circuit if empty
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes([
        { id: 'bat1', type: 'battery', position: { x: 50, y: 100 }, data: { voltage: 5 } },
        { id: 'amm1', type: 'ammeter', position: { x: 250, y: 100 }, data: {} },
        { id: 'res1', type: 'resistor', position: { x: 450, y: 100 }, data: { resistance: 100 } }
      ]);
      setEdges([
        { id: 'e1', source: 'bat1', sourceHandle: 'negative', target: 'amm1', targetHandle: 'in' },
        { id: 'e2', source: 'amm1', sourceHandle: 'out', target: 'res1', targetHandle: 'a' },
        { id: 'e3', source: 'res1', sourceHandle: 'b', target: 'bat1', targetHandle: 'positive' }
      ]);
    }
  }, [nodes.length, setNodes, setEdges]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#424845" gap={24} />
        <Controls className="bg-[#1c1b1b] border-[#424845] fill-[#e5e2e1]" />
        
        <Panel position="top-right" className="flex flex-col gap-2 p-2 max-w-[300px]">
          {validationMessages.map((msg, i) => (
            <div key={i} className="bg-[#404b4b] border border-[#8da399] text-[#e5e2e1] px-3 py-1.5 rounded-lg text-xs shadow-lg">
              {msg}
            </div>
          ))}
        </Panel>
      </ReactFlow>
    </div>
  );
}
