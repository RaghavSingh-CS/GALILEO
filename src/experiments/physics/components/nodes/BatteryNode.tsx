import { useRef, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export function BatteryNode({ id, data }: NodeProps) {
  const voltage = typeof data?.voltage === 'number' ? data.voltage : 5;
  const valRef = useRef(voltage);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    valRef.current = voltage;
  }, [voltage]);

  useEffect(() => {
    document.addEventListener('pointerup', stop);
    return () => document.removeEventListener('pointerup', stop);
  }, [stop]);

  const startChange = (delta: number) => {
    if (intervalRef.current) return;
    const step = () => {
      const nextVal = Math.max(0, valRef.current + delta);
      if (data?.onChange) {
        // @ts-ignore
        data.onChange(id, 'voltage', nextVal);
      }
    };
    step(); // Immediate
    intervalRef.current = setInterval(step, 100);
  };

  const handleVoltageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVal = parseFloat(e.target.value);
    if (!isNaN(newVal) && data?.onChange) {
      // @ts-ignore
      data.onChange(id, 'voltage', newVal);
    }
  };

  let borderClass = 'border-yellow-500';
  if (data?.highlight === 'error') borderClass = 'border-red-500 shadow-red-500/50';
  else if (data?.highlight === 'warning') borderClass = 'border-amber-500 shadow-amber-500/50';

  return (
    <div className={`bg-slate-800 border-2 ${borderClass} rounded-lg p-3 w-40 text-white flex flex-col items-center shadow-lg relative`}>
      {/* Positive Terminal (Top/Left) */}
      <Handle 
        type="source" 
        position={Position.Left} 
        id={`${id}:positive`} 
        className="w-3 h-3 bg-red-500 border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" 
      />
      <div className="absolute left-1 top-1 text-xs text-red-400 font-bold">+</div>

      <div className="font-semibold text-sm mb-2 text-yellow-400">Battery</div>
      
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded">
        <button 
          onPointerDown={(e) => { e.stopPropagation(); startChange(-1); }}
          onPointerLeave={stop}
          className="w-5 h-5 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-xs select-none"
        >
          -
        </button>
        <input 
          type="text" 
          className="w-10 bg-transparent text-center outline-none text-white font-mono"
          value={voltage} 
          onChange={handleVoltageChange} 
          onDoubleClick={(e) => e.stopPropagation()}
        />
        <button 
          onPointerDown={(e) => { e.stopPropagation(); startChange(1); }}
          onPointerLeave={stop}
          className="w-5 h-5 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-xs select-none"
        >
          +
        </button>
        <span className="text-gray-400 font-mono text-xs">V</span>
      </div>

      {/* Negative Terminal (Bottom/Right) */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id={`${id}:negative`} 
        className="w-3 h-3 bg-black border-2 border-white after:content-[''] after:absolute after:-inset-4 after:bg-transparent" 
      />
      <div className="absolute right-1 bottom-1 text-xs text-gray-400 font-bold">-</div>
    </div>
  );
}
