import type { DragEvent } from 'react';

const COMPONENTS = [
  { type: 'battery', label: 'Battery', detail: 'DC Source', symbol: 'battery_charging_full', color: 'text-yellow-500' },
  { type: 'resistor', label: 'Resistor', detail: 'Fixed Load', symbol: 'timeline', color: 'text-orange-500' },
  { type: 'variable_resistor', label: 'Variable Resistor', detail: 'Adjustable Load', symbol: 'tune', color: 'text-cyan-400' },
  { type: 'switch', label: 'Switch', detail: 'Open / Closed', symbol: 'toggle_on', color: 'text-green-400' },
  { type: 'ammeter', label: 'Ammeter', detail: 'Current', symbol: 'A', color: 'text-blue-400' },
  { type: 'voltmeter', label: 'Voltmeter', detail: 'Voltage', symbol: 'V', color: 'text-purple-400' },
] as const;

export type PaletteComponentType = (typeof COMPONENTS)[number]['type'];

interface PaletteProps {
  onAddComponent?: (type: PaletteComponentType) => void;
}

export function Palette({ onAddComponent }: PaletteProps) {
  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="bg-[#1c1b1b] border-r border-[#424845] w-52 p-4 flex flex-col gap-4 z-20 shadow-lg overflow-y-auto">
      <div className="border-b border-[#424845] pb-3">
        <h2 className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">Components</h2>
        <p className="font-body-md text-[10px] text-[#c2c8c4]">Drag or click to add</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {COMPONENTS.map((component) => (
          <button
            type="button"
            key={component.type}
            className="bg-[#20201f] border border-[#424845] rounded-lg p-3 text-[#e5e2e1] cursor-grab hover:bg-[#2a2a2a] hover:border-[#8da399] transition-all flex items-center gap-3 shadow-sm group"
            onDragStart={(event) => onDragStart(event, component.type)}
            onClick={() => onAddComponent?.(component.type)}
            draggable
          >
            <div className="w-8 h-8 rounded bg-[#353535] group-hover:bg-[#8da399]/20 flex items-center justify-center">
              {component.symbol.length === 1 ? (
                <span className={`font-bold text-sm ${component.color}`}>{component.symbol}</span>
              ) : (
                <span className={`material-symbols-outlined text-[18px] ${component.color}`}>{component.symbol}</span>
              )}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="font-label-caps text-xs truncate">{component.label}</span>
              <span className="font-data-mono text-[10px] text-[#8da399] truncate">{component.detail}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
