import React from 'react';

export function Palette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="bg-[#1c1b1b] border-r border-[#424845] w-56 p-4 flex flex-col gap-4 z-20 shadow-lg">
      <div className="border-b border-[#424845] pb-3 flex items-center justify-between">
        <div>
          <h2 className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">Components</h2>
          <p className="font-body-md text-[10px] text-[#c2c8c4]">Drag to schematic</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        <div 
          className="bg-[#20201f] border border-[#424845] rounded-lg p-3 text-[#e5e2e1] cursor-grab hover:bg-[#2a2a2a] hover:border-[#8da399] transition-all flex items-center gap-3 shadow-sm group"
          onDragStart={(event) => onDragStart(event, 'battery')}
          draggable
        >
          <div className="w-8 h-8 rounded bg-[#353535] group-hover:bg-[#8da399]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-yellow-500 text-[18px]">battery_charging_full</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-label-caps text-xs">Battery</span>
            <span className="font-data-mono text-[10px] text-[#8da399]">DC Source</span>
          </div>
        </div>
        
        <div 
          className="bg-[#20201f] border border-[#424845] rounded-lg p-3 text-[#e5e2e1] cursor-grab hover:bg-[#2a2a2a] hover:border-[#8da399] transition-all flex items-center gap-3 shadow-sm group"
          onDragStart={(event) => onDragStart(event, 'resistor')}
          draggable
        >
          <div className="w-8 h-8 rounded bg-[#353535] group-hover:bg-[#8da399]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-orange-500 text-[18px]">timeline</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-label-caps text-xs">Resistor</span>
            <span className="font-data-mono text-[10px] text-[#8da399]">Load</span>
          </div>
        </div>

        <div 
          className="bg-[#20201f] border border-[#424845] rounded-lg p-3 text-[#e5e2e1] cursor-grab hover:bg-[#2a2a2a] hover:border-[#8da399] transition-all flex items-center gap-3 shadow-sm group"
          onDragStart={(event) => onDragStart(event, 'ammeter')}
          draggable
        >
          <div className="w-8 h-8 rounded-full bg-[#353535] group-hover:bg-[#8da399]/20 flex items-center justify-center">
            <span className="font-bold text-blue-400 text-sm">A</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-label-caps text-xs">Ammeter</span>
            <span className="font-data-mono text-[10px] text-[#8da399]">Current</span>
          </div>
        </div>

        <div 
          className="bg-[#20201f] border border-[#424845] rounded-lg p-3 text-[#e5e2e1] cursor-grab hover:bg-[#2a2a2a] hover:border-[#8da399] transition-all flex items-center gap-3 shadow-sm group"
          onDragStart={(event) => onDragStart(event, 'voltmeter')}
          draggable
        >
          <div className="w-8 h-8 rounded-full bg-[#353535] group-hover:bg-[#8da399]/20 flex items-center justify-center">
            <span className="font-bold text-purple-400 text-sm">V</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-label-caps text-xs">Voltmeter</span>
            <span className="font-data-mono text-[10px] text-[#8da399]">Voltage</span>
          </div>
        </div>
      </div>
    </div>
  );
}
