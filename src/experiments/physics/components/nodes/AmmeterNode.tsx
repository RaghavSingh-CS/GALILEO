import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export function AmmeterNode({ id, data }: NodeProps) {
  // Reading comes from SimulationResult injected into node.data
  const reading = typeof data?.reading === 'number' ? data.reading.toFixed(3) : '---';

  let borderClass = 'border-blue-500';
  if (data?.highlight === 'error') borderClass = 'border-red-500 shadow-red-500/50';
  else if (data?.highlight === 'warning') borderClass = 'border-amber-500 shadow-amber-500/50';

  return (
    <div className={`bg-slate-800 border-2 ${borderClass} rounded-full w-24 h-24 text-white flex flex-col items-center justify-center shadow-lg relative`}>
      {typeof data?.label === 'string' ? (
        <div className="absolute -top-6 text-xs font-semibold text-slate-300 whitespace-nowrap">
          {data.label}
        </div>
      ) : null}
      <Handle 
        type="source" 
        position={Position.Left} 
        id={`${id}:in`} 
        className="w-3 h-3 bg-blue-400 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" 
      />
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-300">in</div>

      <div className="font-bold text-xl text-blue-400">A</div>
      <div className="font-mono text-sm bg-slate-900 px-2 py-0.5 rounded mt-1">
        {reading} A
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        id={`${id}:out`} 
        className="w-3 h-3 bg-blue-400 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" 
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-300">out</div>
    </div>
  );
}
