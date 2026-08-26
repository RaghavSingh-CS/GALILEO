import { useCallback, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ChangeEvent } from 'react';
import type { NodeProps } from '@xyflow/react';

export function VariableResistorNode({ id, data }: NodeProps) {
  const minResistance = typeof data.minResistance === 'number' ? data.minResistance : 1;
  const maxResistance = typeof data.maxResistance === 'number' ? data.maxResistance : 1000;
  const resistance = typeof data.resistance === 'number' ? data.resistance : 100;
  const valueRef = useRef(resistance);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const update = (value: number) => {
    if (typeof data.onChange === 'function') {
      data.onChange(id, 'resistance', Math.min(maxResistance, Math.max(minResistance, value)));
    }
  };
  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);
  useEffect(() => {
    valueRef.current = resistance;
  }, [resistance]);
  useEffect(() => {
    document.addEventListener('pointerup', stop);
    return () => document.removeEventListener('pointerup', stop);
  }, [stop]);
  const startChange = (delta: number) => {
    if (intervalRef.current) return;
    const step = () => update(valueRef.current + delta);
    step();
    intervalRef.current = setInterval(step, 100);
  };
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) update(value);
  };
  const border = data.highlight === 'error'
    ? 'border-red-500'
    : data.highlight === 'warning' ? 'border-amber-500' : 'border-cyan-500';

  return (
    <div className={`bg-slate-800 border-2 ${border} rounded-lg p-3 w-44 text-white flex flex-col items-center shadow-lg relative`}>
      <Handle type="source" position={Position.Left} id={`${id}:a`} className="w-3 h-3 bg-cyan-400 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" />
      <div className="font-semibold text-sm mb-2 text-cyan-400">Variable Resistor</div>
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded">
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); startChange(-10); }} onPointerLeave={stop} className="w-5 h-5 bg-slate-700 rounded">−</button>
        <input type="number" min={minResistance} max={maxResistance} value={resistance} onChange={handleChange} onPointerDown={(event) => event.stopPropagation()} className="w-16 bg-transparent text-center outline-none font-mono" />
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); startChange(10); }} onPointerLeave={stop} className="w-5 h-5 bg-slate-700 rounded">+</button>
        <span className="text-gray-400 font-mono text-xs">Ω</span>
      </div>
      <Handle type="source" position={Position.Right} id={`${id}:b`} className="w-3 h-3 bg-cyan-400 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" />
    </div>
  );
}
