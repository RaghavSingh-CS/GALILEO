import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export function SwitchNode({ id, data }: NodeProps) {
  const closed = data.closed === true;
  const onToggle = () => {
    if (typeof data.onChange === 'function') data.onChange(id, 'closed', !closed);
  };
  const border = data.highlight === 'error'
    ? 'border-red-500'
    : data.highlight === 'warning' ? 'border-amber-500' : closed ? 'border-green-500' : 'border-slate-500';

  return (
    <div className={`bg-slate-800 border-2 ${border} rounded-lg p-3 w-36 text-white flex flex-col items-center shadow-lg relative`}>
      <Handle type="source" position={Position.Left} id={`${id}:a`} className="w-3 h-3 bg-slate-300 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" />
      <div className="font-semibold text-sm text-slate-200">Switch</div>
      <button type="button" onClick={onToggle} onPointerDown={(event) => event.stopPropagation()} className={`mt-2 px-3 py-1 rounded text-xs font-bold ${closed ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 text-slate-300'}`}>
        {closed ? 'CLOSED' : 'OPEN'}
      </button>
      <Handle type="source" position={Position.Right} id={`${id}:b`} className="w-3 h-3 bg-slate-300 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" />
    </div>
  );
}
