import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigationStore } from "@/stores/navigation";
import { useExperimentStore } from "@/stores/experiment";
import { useSettingsStore } from "@/stores/settings";
import { getExperiment, getAllExperiments } from "@/experiments/registry";
import { analyzeOhmsLaw } from "@/experiments/physics/ohmsLawAnalysis";
import { CircuitSandbox } from '@/experiments/physics/components/CircuitSandbox';
import { ValidationPanel } from '@/experiments/physics/components/ValidationPanel';
import type { Node } from '@xyflow/react';
import type { SimulationResult } from '@/engines/physics/circuits/types';
import type { OhmsLawIssueCode, SeriesParallelIssueCode, ExperimentUsability } from '@/engines/physics/experiments/types';
import GalileoChat from "@/panels/GalileoChat";
import { SaveExperimentModal } from "@/panels/Modals";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DragType = "apparatus" | "observations" | "chat" | "tableHeight" | null;

export default function Workspace() {
  const experimentId = useNavigationStore((s) => s.activeExperimentId);
  const goToDashboard = useNavigationStore((s) => s.goToDashboard);
  const goToSettings = useNavigationStore((s) => s.goToSettings);
  const galileoPanelOpen = useNavigationStore((s) => s.galileoPanelOpen);
  const toggleGalileoPanel = useNavigationStore((s) => s.toggleGalileoPanel);

  const apparatusValues = useExperimentStore((s) => s.apparatusValues);
  const setApparatusValue = useExperimentStore((s) => s.setApparatusValue);
  const initApparatus = useExperimentStore((s) => s.initApparatus);
  const observations = useExperimentStore((s) => s.observations);
  const addObservation = useExperimentStore((s) => s.addObservation);
  const startSession = useExperimentStore((s) => s.startSession);

  const graphLineType = useSettingsStore((s) => s.graphLineType);
  const getSweepIntervalMs = useSettingsStore((s) => s.getSweepIntervalMs);
  const liveCircuitCurrent = useExperimentStore((s) => s.liveCircuitCurrent);
  const sessionStatus = useExperimentStore((s) => s.sessionStatus);
  const setSessionStatus = useExperimentStore((s) => s.setSessionStatus);
  const chatContextKey = useExperimentStore((s) => s.chatContextKey);
  const notes = useExperimentStore((s) => s.notes);
  const setNotes = useExperimentStore((s) => s.setNotes);
  const validationMessages = useExperimentStore((s) => s.validationMessages);
  const [activeTab, setActiveTab] = useState<"schematic" | "procedure">("schematic");
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  // ── Resizable Panel Dimensions (Pixels) ──
  const [apparatusWidth, setApparatusWidth] = useState(280);
  const [obsWidth, setObsWidth] = useState(360);
  // Sandbox state synced from CircuitSandbox
  const [sandboxNodes, setSandboxNodes] = useState<Node[]>([]);
  const [sandboxSimResult, setSandboxSimResult] = useState<SimulationResult | null>(null);
  const [sandboxIssues, setSandboxIssues] = useState<(OhmsLawIssueCode | SeriesParallelIssueCode)[]>([]);
  const [sandboxUsability, setSandboxUsability] = useState<ExperimentUsability>('usable');

  const [selectedAmmeterId, setSelectedAmmeterId] = useState<string | null>(null);
  const [selectedVoltmeterId, setSelectedVoltmeterId] = useState<string | null>(null);

  // Auto-assign meters
  useEffect(() => {
    const ammeters = sandboxNodes.filter(n => n.type === 'ammeter');
    const voltmeters = sandboxNodes.filter(n => n.type === 'voltmeter');

    // If selected meter deleted, clear it
    if (selectedAmmeterId && !ammeters.some(a => a.id === selectedAmmeterId)) {
      setSelectedAmmeterId(null);
    }
    if (selectedVoltmeterId && !voltmeters.some(v => v.id === selectedVoltmeterId)) {
      setSelectedVoltmeterId(null);
    }

    // If exactly one exists and none selected, auto-select
    if (ammeters.length === 1 && !selectedAmmeterId) {
      setSelectedAmmeterId(ammeters[0].id);
    }
    if (voltmeters.length === 1 && !selectedVoltmeterId) {
      setSelectedVoltmeterId(voltmeters[0].id);
    }
  }, [sandboxNodes, selectedAmmeterId, selectedVoltmeterId]);

  const [chatWidth, setChatWidth] = useState(320);
  const [obsTableHeight, setObsTableHeight] = useState(190);

  // Active dragging state
  const [activeDrag, setActiveDrag] = useState<DragType>(null);

  const dragInfo = useRef<{
    type: DragType;
    startX: number;
    startY: number;
    startDim: number;
    containerWidth: number;
  }>({
    type: null,
    startX: 0,
    startY: 0,
    startDim: 0,
    containerWidth: window.innerWidth,
  });

  const rafId = useRef<number | null>(null);

  const allExperiments = getAllExperiments();
  const activeExpId = experimentId || "ohms-law";
  const entry = getExperiment(activeExpId) || allExperiments[0];
  const config = entry.config;

  useEffect(() => {
    if (!entry) return;
    const paramIds = entry.config.apparatus.map((p) => p.id);
    if (paramIds.length === 0) return;
    
    const hasMatchingParams =
      Object.keys(apparatusValues).length > 0 &&
      paramIds.some((id) => id in apparatusValues);

    if (!hasMatchingParams) {
      const defaults: Record<string, number> = {};
      for (const param of entry.config.apparatus) {
        defaults[param.id] = param.default;
      }
      initApparatus(defaults);
    }
  }, [activeExpId, entry, initApparatus, apparatusValues]);

  // Window resize listener
  useEffect(() => {
    const handleWindowResize = () => {
      const winW = window.innerWidth;
      const minCenter = 180;
      const splitters = 30;

      if (galileoPanelOpen) {
        const availableForChat = winW - apparatusWidth - obsWidth - minCenter - splitters;
        if (availableForChat > 220 && chatWidth > availableForChat) {
          setChatWidth(Math.max(220, availableForChat));
        }
      }
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [apparatusWidth, obsWidth, chatWidth, galileoPanelOpen]);

  // Compute live engine outputs (memoized so reading matches display)
  const noiseFraction = useSettingsStore((s) => s.getNoiseFraction());
  const liveResult = useMemo(() => {
    return entry && Object.keys(apparatusValues).length > 0
      ? entry.engine.compute(apparatusValues, { noiseFraction })
      : null;
  }, [entry, apparatusValues, noiseFraction]);

  const isCircuit = entry?.config.subject === 'physics';

  const handleTakeReading = () => {
    if (!entry) return;

    if (isCircuit) {
      if (!selectedAmmeterId || !selectedVoltmeterId || !sandboxSimResult) return;
      const vReading = sandboxSimResult.readings.find(r => r.componentId === selectedVoltmeterId)?.value ?? 0;
      const iReading = sandboxSimResult.readings.find(r => r.componentId === selectedAmmeterId)?.value ?? 0;
      // Record specifically for V-I graph
      addObservation({ voltage: vReading, resistance: 0 }, { current: iReading });
    } else {
      if (!liveResult) return;
      addObservation(apparatusValues, liveResult);
    }
  };

  // Determine if capture is allowed
  const canCapture = isCircuit 
    ? (selectedAmmeterId !== null && selectedVoltmeterId !== null)
    : (sessionStatus !== "invalid");

  const handleReset = () => {
    if (!entry) return;
    const defaults: Record<string, number> = {};
    for (const param of entry.config.apparatus) {
      defaults[param.id] = param.default;
    }
    startSession(activeExpId, defaults);
  };

  // Automated sweep for Titration with configurable speed
  useEffect(() => {
    if (sessionStatus !== "running" || !entry) return;
    const intervalMs = getSweepIntervalMs();

    if (entry.config.id === "oxalic-acid-titration" || entry.config.id === "mohrs-salt-titration") {
      const maxVolume = entry.config.apparatus.find((param) => param.id === "volumeAdded")?.max ?? 100;
      const interval = setInterval(() => {
        const currentVol = apparatusValues.volumeAdded ?? 0;
        const rate = apparatusValues.flowRate ?? 0.5;
        if (currentVol >= maxVolume) {
          setSessionStatus("complete");
          return;
        }
        const nextVol = Math.min(maxVolume, Math.round((currentVol + rate * 2) * 10) / 10);
        setApparatusValue("volumeAdded", nextVol);
        const newVals = { ...apparatusValues, volumeAdded: nextVol };
        const outputs = entry.engine.compute(newVals, { noiseFraction });
        addObservation(newVals, outputs);
      }, intervalMs);
      return () => clearInterval(interval);
    }
  }, [sessionStatus, apparatusValues, entry, addObservation, setApparatusValue, getSweepIntervalMs, noiseFraction, setSessionStatus]);



  // Chart data formatting
  const chartData = useMemo(() => {
    const isCircuit = entry?.config.subject === "physics";
    let data;
    if (isCircuit) {
      data = observations.map((obs, i) => ({
        index: i + 1,
        x: obs.inputs.voltage ?? 0,
        y: obs.outputs.current ?? 0,
        power: obs.outputs.power ?? 0,
      }));
    } else {
      data = observations.map((obs, i) => ({
        index: i + 1,
        x: obs.inputs.volumeAdded ?? 0,
        y: obs.outputs.colorIntensity ?? 0,
      }));
    }
    return data.sort((a, b) => a.x - b.x);
  }, [observations, entry?.config.subject]);

  // Computed statistical results
  const computedStats = useMemo(() => {
    if (observations.length < 2) return null;

    if (activeExpId === "ohms-law") {
      return analyzeOhmsLaw(observations, apparatusValues.resistance ?? 100);
    } else {
      const vAnalyte = apparatusValues.aliquotVolume ?? 10;
      const calculatedMURL = 0.02; // Roughly simulated KMnO4 molarity
      return {
        label1: "KMnO₄ Molarity",
        val1: `${calculatedMURL.toFixed(4)} M`,
        label2: "Equivalence Vol",
        val2: `${(vAnalyte).toFixed(1)} mL`,
        summary: `Equivalence: ${(vAnalyte).toFixed(1)} mL · Molarity: ${calculatedMURL.toFixed(4)} M KMnO₄`,
      };
    }
  }, [observations, apparatusValues, activeExpId]);

  const exportCSV = () => {
    if (observations.length === 0) return;
    const isCircuit = entry.config.subject === "physics";
    const headers = isCircuit
      ? "ID,Voltage(V),Resistance(Ohms),Current(mA),Power(mW)\n"
      : "ID,Titrant(mL),ColorIntensity,TotalVol(mL)\n";

    const rows = observations
      .map((obs) => {
        if (isCircuit) {
          return `${obs.id},${obs.inputs.voltage ?? 0},${
            obs.inputs.resistance ?? 100
          },${obs.outputs.current ?? 0},${obs.outputs.power ?? 0}`;
        }
        return `${obs.id},${obs.inputs.volumeAdded ?? 0},${
          obs.outputs.colorIntensity ?? 0
        },${obs.outputs.totalVol ?? (obs.inputs.aliquotVolume ?? 10) + 5}`;
      })
      .join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `galileo_${entry.config.id}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startDrag = (type: DragType, initialDim: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragInfo.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startDim: initialDim,
      containerWidth: window.innerWidth,
    };
    setActiveDrag(type);
  };

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (!dragInfo.current.type) return;

      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        const { type, startX, startY, startDim } = dragInfo.current;
        const winW = window.innerWidth;
        setIsLargeScreen(winW >= 1024);
        const minCenter = 180;
        const splittersWidth = 30;

        if (type === "apparatus") {
          const delta = e.clientX - startX;
          const currentOther = obsWidth + (galileoPanelOpen ? chatWidth : 0);
          const maxAllowed = Math.max(180, winW - currentOther - minCenter - splittersWidth);
          const newWidth = Math.max(180, Math.min(maxAllowed, startDim + delta));
          setApparatusWidth(newWidth);
        } else if (type === "observations") {
          const delta = startX - e.clientX;
          const currentOther = apparatusWidth + (galileoPanelOpen ? chatWidth : 0);
          const maxAllowed = Math.max(220, winW - currentOther - minCenter - splittersWidth);
          const newWidth = Math.max(220, Math.min(maxAllowed, startDim + delta));
          setObsWidth(newWidth);
        } else if (type === "chat") {
          const delta = startX - e.clientX;
          const currentOther = apparatusWidth + obsWidth;
          const maxAllowed = Math.max(220, winW - currentOther - minCenter - splittersWidth);
          const newWidth = Math.max(220, Math.min(maxAllowed, startDim + delta));
          setChatWidth(newWidth);
        } else if (type === "tableHeight") {
          const delta = e.clientY - startY;
          const newHeight = Math.max(80, Math.min(380, startDim + delta));
          setObsTableHeight(newHeight);
        }
      });
    };

    const handlePointerUp = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      dragInfo.current.type = null;
      setActiveDrag(null);
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [activeDrag, apparatusWidth, obsWidth, chatWidth, galileoPanelOpen]);

  const currentVoltage = apparatusValues.voltage ?? 5;
  const liveCurrent = isCircuit ? liveCircuitCurrent : (liveResult?.current ?? 0);

  const titrantVol = apparatusValues.volumeAdded ?? 0;
  const stirrerRPM = apparatusValues.stirrerSpeed ?? 300;
  const liveColorIntensity = liveResult?.colorIntensity ?? 0;
  const analyteVol = apparatusValues.aliquotVolume ?? 10;
  const isNearEquivalence = liveResult?.isNearEquivalence ?? false;
  const isNeutralized = liveResult?.isNeutralized ?? (titrantVol >= analyteVol);

  return (
    <div className="h-screen w-screen max-w-full flex flex-col bg-[#131313] text-[#e5e2e1] overflow-hidden selection:bg-[#8da399] selection:text-[#263932]">
      {/* Save Experiment Modal */}
      <SaveExperimentModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        experimentId={activeExpId}
        experimentTitle={entry.config.title}
        subject={entry.config.subject}
        apparatusValues={apparatusValues}
        observations={observations}
        summaryResult={computedStats?.summary}
        initialNotes={notes}
        onSuccess={() => {
          setSaveSuccessToast(true);
          setTimeout(() => setSaveSuccessToast(false), 2500);
        }}
      />

      {/* Toast Notification */}
      {saveSuccessToast && (
        <div className="fixed top-16 right-8 bg-[#20201f] border border-[#8da399] text-[#e5e2e1] px-4 py-2.5 rounded-lg shadow-2xl z-50 flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[#8da399] text-[18px]">bookmark_added</span>
          <span className="font-data-mono text-xs">Run Saved to "My Experiments"!</span>
        </div>
      )}

      {/* ── Transparent Drag Overlay ── */}
      {activeDrag && (
        <div
          className={`fixed inset-0 z-50 ${
            activeDrag === "tableHeight" ? "cursor-row-resize" : "cursor-col-resize"
          }`}
          style={{ userSelect: "none" }}
        />
      )}

      {/* ── Top Shell Header ── */}
      <header className="h-14 border-b border-[#424845] bg-[#131313] flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex items-center gap-2 font-headline-md text-lg font-bold text-[#b5ccc1] hover:text-[#d1e8dd] transition-colors cursor-pointer group"
          >
            <span className="material-symbols-outlined text-[20px] text-[#8da399] group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            <span>GALILEO</span>
          </button>

          <div className="h-5 w-px bg-[#424845]" />

          <div className="flex items-center gap-3">
            <span className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">
              {config.title}
            </span>
            <span className="font-label-caps text-[10px] px-2 py-0.5 rounded bg-[#20201f] text-[#c2c8c4] border border-[#424845]/50 uppercase">
              {config.subject}
            </span>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary text-[11px] py-1.5 px-3 cursor-pointer"
            title="Reset apparatus to standard defaults"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Reset
          </button>

          <button
            type="button"
            onClick={() => setSaveModalOpen(true)}
            className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 cursor-pointer hover:border-[#8da399] hover:text-[#8da399]"
            title="Store this experiment run in My Experiments archive"
          >
            <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
            <span>Save</span>
          </button>

          <button
            type="button"
            onClick={goToSettings}
            aria-label="Laboratory Settings"
            className="text-[#c2c8c4] hover:text-[#e5e2e1] p-1.5 rounded hover:bg-[#2a2a2a] cursor-pointer"
            title="Laboratory Settings & Noise"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>

          <div className="h-5 w-px bg-[#424845]" />

          <button
            type="button"
            onClick={toggleGalileoPanel}
            className={`btn-secondary text-[11px] py-1.5 px-3.5 flex items-center gap-1.5 transition-all cursor-pointer ${
              galileoPanelOpen
                ? "bg-[#8da399]/20 border-[#8da399] text-[#8da399]"
                : "text-[#c2c8c4]"
            }`}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: galileoPanelOpen ? "'FILL' 1" : "'FILL' 0" }}
            >
              smart_toy
            </span>
            Ask GALILEO
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body with Dynamic Clamped Columns ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden w-full max-w-full">
        {/* ── 1. Left Panel: Apparatus Controls ── */}
        <aside
          style={{ width: isLargeScreen ? `${apparatusWidth}px` : '100%' }}
          className="shrink-0 bg-[#1c1b1b] flex flex-col lg:overflow-y-auto p-5 gap-6 border-b lg:border-b-0 lg:border-r border-[#424845]/50 min-w-0"
        >
          <div className="border-b border-[#424845] pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">
                Apparatus Controls
              </h2>
              <p className="font-body-md text-xs text-[#c2c8c4]">
                {isCircuit ? "Circuit calibration" : "Titration parameters"}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#8da399] pulse-live" />
          </div>

          {/* Dynamic Sliders */}
          <div className="flex flex-col gap-6">
            {config.apparatus.map((param) => {
              const val = apparatusValues[param.id] ?? param.default;
              return (
                <div key={param.id} className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <label className="font-label-caps text-[11px] text-[#e5e2e1] uppercase tracking-wider">
                      {param.label}
                    </label>
                    <div className="readout text-sm py-0.5 px-2.5 min-w-[75px]">
                      {val.toFixed(param.step < 1 ? 1 : 0)}
                      <span className="readout-unit">{param.unit}</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={val}
                    onChange={(e) =>
                      setApparatusValue(param.id, parseFloat(e.target.value))
                    }
                  />

                  <div className="flex justify-between font-data-mono text-[10px] text-[#c2c8c4]">
                    <span>
                      {param.min} {param.unit}
                    </span>
                    <span>
                      {param.max} {param.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!isCircuit && (
            <button
              type="button"
              onClick={() => {
                const currentVol = apparatusValues.volumeAdded ?? 0;
                const rate = apparatusValues.flowRate ?? 0.5;
                setApparatusValue("volumeAdded", Math.min(50, currentVol + rate));
              }}
              className="mt-2 w-full font-label-caps text-[11px] py-2.5 rounded bg-[#2a2a2a] hover:bg-[#353535] text-[#e5e2e1] border border-[#424845]/50 flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">water_drop</span>
              Add {apparatusValues.flowRate ?? 0.5} mL Titrant
            </button>
          )}

          {/* Auto Simulation Sweep */}
          {!isCircuit && (
            <div className="bg-[#20201f] border border-[#424845] rounded-lg p-3.5 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-label-caps text-[10px] text-[#c2c8c4]">
                  CONTINUOUS TITRATION
                </span>
                <span className="font-data-mono text-[10px] text-[#8da399]">
                  {sessionStatus.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                disabled={sessionStatus === "invalid"}
                onClick={() =>
                  setSessionStatus(sessionStatus === "running" ? "paused" : "running")
                }
                className={`w-full py-2 rounded text-xs font-label-caps flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  sessionStatus === "invalid"
                    ? "bg-[#353535] text-[#8c8c8c] border border-[#424845] cursor-not-allowed opacity-50"
                    : sessionStatus === "running"
                    ? "bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/30 hover:bg-[#690005]"
                    : "bg-[#353535] hover:bg-[#424845] text-[#e5e2e1] border border-[#424845]"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {sessionStatus === "running" ? "pause" : "fast_forward"}
                </span>
                {sessionStatus === "running"
                  ? "Pause Simulation"
                  : "Continuous Flow Simulation"}
              </button>
            </div>
          )}

          {/* Real-time Telemetry Card */}
          <div className="bg-[#20201f] border border-[#424845] rounded-lg p-4 flex flex-col gap-3">
            <span className="font-label-caps text-[10px] text-[#8da399] tracking-wider font-semibold">
              LIVE SENSOR TELEMETRY
            </span>
            <div className="grid grid-cols-2 gap-3">
              {isCircuit ? (
                <>
                  <div className="bg-[#131313] border border-[#333333] p-2.5 rounded">
                    <div className="font-label-caps text-[9px] text-[#c2c8c4] mb-1">
                      VOLTAGE (V)
                    </div>
                    <div className="font-data-mono text-base text-[#b5ccc1] font-semibold">
                      {(() => {
                        const r = selectedVoltmeterId ? sandboxNodes.find(n => n.id === selectedVoltmeterId)?.data?.reading : undefined;
                        return typeof r === 'number' ? (
                          <>
                            {r.toFixed(2)}
                            <span className="text-[10px] text-[#c2c8c4] ml-1">V</span>
                          </>
                        ) : '—';
                      })()}
                    </div>
                  </div>
                  <div className="bg-[#131313] border border-[#333333] p-2.5 rounded">
                    <div className="font-label-caps text-[9px] text-[#c2c8c4] mb-1">
                      CURRENT (I)
                    </div>
                    <div className="font-data-mono text-base text-[#b5ccc1] font-semibold">
                      {(() => {
                        const r = selectedAmmeterId ? sandboxNodes.find(n => n.id === selectedAmmeterId)?.data?.reading : undefined;
                        return typeof r === 'number' ? (
                          <>
                            {r.toFixed(3)}
                            <span className="text-[10px] text-[#c2c8c4] ml-1">A</span>
                          </>
                        ) : '—';
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#131313] border border-[#333333] p-2.5 rounded">
                    <div className="font-label-caps text-[9px] text-[#c2c8c4] mb-1">
                      COLOR INTENSITY
                    </div>
                    <div className="font-data-mono text-base text-[#b5ccc1] font-semibold">
                      {(liveColorIntensity * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-[#131313] border border-[#333333] p-2.5 rounded">
                    <div className="font-label-caps text-[9px] text-[#c2c8c4] mb-1">
                      TITRANT (KMnO₄)
                    </div>
                    <div className="font-data-mono text-base text-[#bdc9c8] font-semibold">
                      {titrantVol.toFixed(1)}
                      <span className="text-[10px] text-[#c2c8c4] ml-1">mL</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Validation Message UI is now managed below in ValidationPanel / circuit-specific */}
          {!isCircuit && sessionStatus === "invalid" && validationMessages && validationMessages.length > 0 && (
            <div className="bg-[#4a1919] border border-[#ffb4ab] rounded p-2.5 flex flex-col gap-1.5 mt-2 shadow-inner">
              <div className="flex items-center gap-1.5 font-label-caps text-[10px] text-[#ffb4ab] font-bold">
                <span className="material-symbols-outlined text-[14px]">error</span>
                SYSTEM FAULT PREVENTS MEASUREMENT
              </div>
              <ul className="text-xs text-[#e5e2e1] list-disc list-inside space-y-1">
                {validationMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {isCircuit && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="border border-[#424845] bg-[#20201f] rounded-lg p-3 relative shadow-inner">
                <h3 className="text-[10px] font-semibold text-[#c2c8c4] mb-2 font-label-caps tracking-wider">RECORDING METERS</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#8da399]">Voltage Source</span>
                    <select 
                      className="bg-[#131313] border border-[#333333] text-[#e5e2e1] p-1 rounded font-data-mono text-[11px] w-44"
                      value={selectedVoltmeterId ?? ""}
                      onChange={e => setSelectedVoltmeterId(e.target.value)}
                    >
                      <option value="" disabled>Select Voltmeter...</option>
                      {sandboxNodes.filter(n => n.type === 'voltmeter').map(n => (
                        <option key={n.id} value={n.id}>
                          {n.data?.label as string || 'Voltmeter'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="text-[#8da399]">Current Source</span>
                    <select 
                      className="bg-[#131313] border border-[#333333] text-[#e5e2e1] p-1 rounded font-data-mono text-[11px] w-44"
                      value={selectedAmmeterId ?? ""}
                      onChange={e => setSelectedAmmeterId(e.target.value)}
                    >
                      <option value="" disabled>Select Ammeter...</option>
                      {sandboxNodes.filter(n => n.type === 'ammeter').map(n => (
                        <option key={n.id} value={n.id}>
                          {n.data?.label as string || 'Ammeter'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <ValidationPanel 
                  issues={sandboxIssues} 
                  usability={sandboxUsability} 
                />
              </div>
            </div>
          )}

          {/* Primary Take Reading Action Button */}
          <button
            type="button"
            onClick={handleTakeReading}
            disabled={!canCapture}
            className={`mt-auto w-full font-label-caps text-xs py-3.5 rounded-lg transition-all flex justify-center items-center gap-2 font-bold shadow-lg border ${
              !canCapture
                ? "bg-[#353535] text-[#8c8c8c] border-[#424845] cursor-not-allowed opacity-50"
                : "bg-[#8da399] hover:bg-[#b5ccc1] text-[#21342d] cursor-pointer active:scale-95 border-[#8da399]"
            }`}
            title={
              !canCapture && isCircuit 
                ? "Add and select a voltmeter and ammeter to record readings" 
                : "Record current physical measurement into observations table"
            }
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Take Reading
          </button>
          
          {!canCapture && isCircuit && (
            <div className="text-[10px] text-amber-400 text-center mt-1">
              Add and select a voltmeter and ammeter to record readings
            </div>
          )}
        </aside>

        {/* ── Drag Handle: Apparatus Resizer ── */}
        {isLargeScreen && (
          <div
            onMouseDown={(e) => startDrag("apparatus", apparatusWidth, e)}
            className={`w-2 hover:w-2 bg-[#131313] hover:bg-[#8da399]/20 active:bg-[#8da399]/40 cursor-col-resize transition-colors shrink-0 z-20 flex items-center justify-center relative group ${
              activeDrag === "apparatus" ? "bg-[#8da399]/30" : ""
            }`}
            title="Drag to resize Apparatus Controls panel"
          >
            <div
              className={`w-0.5 h-full transition-colors ${
                activeDrag === "apparatus"
                  ? "bg-[#8da399]"
                  : "bg-[#424845] group-hover:bg-[#8da399]"
              }`}
            />
            <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#353535] group-hover:bg-[#8da399] rounded-full flex flex-col justify-center items-center gap-0.5 shadow-sm pointer-events-none">
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
            </div>
          </div>
        )}

        {/* ── 2. Center Panel: Canvas / Schematic ── */}
        <section className="flex-1 flex flex-col min-w-[200px] bg-[#131313] relative border-b lg:border-b-0">
          <div className="h-10 border-b border-[#424845] bg-[#1c1b1b] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("schematic")}
                className={`font-label-caps text-[11px] px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "schematic"
                    ? "bg-[#353535] text-[#b5ccc1]"
                    : "text-[#c2c8c4] hover:text-[#e5e2e1]"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isCircuit ? "electrical_services" : "science"}
                </span>
                {isCircuit ? "Live Circuit Schematic" : "Live Titration Apparatus"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("procedure")}
                className={`font-label-caps text-[11px] px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "procedure"
                    ? "bg-[#353535] text-[#b5ccc1]"
                    : "text-[#c2c8c4] hover:text-[#e5e2e1]"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">menu_book</span>
                Procedure & Aim
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#8da399] pulse-live" />
              <span className="font-label-caps text-[10px] text-[#8da399]">
                {sessionStatus === "running" ? "SYSTEM ACTIVE" : sessionStatus === "invalid" ? "SYSTEM FAULT" : "SYSTEM READY"}
              </span>
            </div>
          </div>

          {/* Canvas Content */}
          {activeTab === "schematic" ? (
            <div className="flex-1 relative bg-[#131313] flex flex-col items-center justify-center p-6 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(66,72,69,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(66,72,69,0.15)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Schematic 1: Circuit Bench */}
              {isCircuit ? (
                <div className="relative w-full h-full bg-[#1c1b1b]/80 border border-[#424845] rounded-xl p-0 shadow-2xl backdrop-blur-sm z-10 overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center border-b border-[#424845]/50 p-2 shrink-0 bg-[#20201f]">
                    <span className="font-label-caps text-[10px] text-[#c2c8c4]">
                      DC CIRCUIT BENCH · CLOSED LOOP
                    </span>
                    <span className="font-data-mono text-[10px] text-[#8da399]">
                      I = {liveCurrent.toFixed(2)} mA @ {currentVoltage}V
                    </span>
                  </div>

                  <div className="flex-1 w-full h-full">
                    <CircuitSandbox 
                      key={chatContextKey}
                      experimentType={activeExpId as 'ohms-law' | 'series-parallel'} 
                      onSimulationUpdate={(nodes, simResult, issues, usability) => {
                        setSandboxNodes(nodes);
                        setSandboxSimResult(simResult);
                        setSandboxIssues(issues);
                        setSandboxUsability(usability);
                      }}
                    />
                  </div>

                </div>
              ) : (
                /* Schematic 2: Titration Glassware Apparatus */
                <div className="relative w-full max-w-lg h-96 flex flex-col items-center justify-center z-10">
                  {isNearEquivalence && (
                    <div className="absolute top-2 left-2 bg-[#404b4b] border border-[#8da399] text-[#e5e2e1] px-3 py-1.5 rounded-lg flex items-center gap-2 z-30 shadow-lg animate-pulse">
                      <span className="material-symbols-outlined text-[#8da399] text-[16px]">warning</span>
                      <span className="font-label-caps text-[10px]">APPROACHING EQUIVALENCE POINT</span>
                    </div>
                  )}

                  <div className="absolute top-2 right-2 bg-[#20201f]/90 border border-[#424845] rounded-lg p-3 flex flex-col gap-2 shadow-xl backdrop-blur-sm z-30">
                    <div>
                      <span className="font-label-caps text-[9px] text-[#c2c8c4] block">KMnO₄ COLOR</span>
                      <span className="font-data-mono text-xl text-[#b5ccc1] font-bold">{(liveColorIntensity * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-px bg-[#424845]" />
                    <div>
                      <span className="font-label-caps text-[9px] text-[#c2c8c4] block">TITRANT ADDED</span>
                      <span className="font-data-mono text-sm text-[#8da399] font-semibold">{titrantVol.toFixed(1)} mL</span>
                    </div>
                  </div>

                  {/* Buret Container */}
                  <div className="relative flex flex-col items-center">
                    <div className="absolute -left-7 top-4 h-36 flex flex-col justify-between items-end font-data-mono text-[9px] text-[#c2c8c4]/70">
                      <span>0</span>
                      <span>10</span>
                      <span>20</span>
                      <span>30</span>
                      <span>40</span>
                      <span>50</span>
                    </div>

                    <div className="w-7 h-36 border-2 border-[#424845] rounded-t-sm relative bg-[#20201f] overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 w-full bg-[#353535] transition-all duration-300 ease-linear"
                        style={{ height: `${Math.max(5, 100 - (titrantVol / 50) * 100)}%` }}
                      />
                      <div className="absolute inset-0 flex flex-col justify-between py-1.5 opacity-40">
                        <div className="w-2 border-b border-[#e5e2e1]" />
                        <div className="w-full border-b border-[#e5e2e1]" />
                        <div className="w-2 border-b border-[#e5e2e1]" />
                        <div className="w-full border-b border-[#e5e2e1]" />
                        <div className="w-2 border-b border-[#e5e2e1]" />
                      </div>
                    </div>

                    <div className="w-10 h-5 border-2 border-[#424845] flex items-center justify-center relative z-20 bg-[#131313]">
                      <div
                        className="w-3.5 h-1.5 bg-[#8da399] rounded-sm transition-transform duration-300"
                        style={{ transform: sessionStatus === "running" ? "rotate(90deg)" : "rotate(0deg)" }}
                      />
                    </div>

                    <div className="w-2 h-10 relative overflow-hidden flex justify-center">
                      {sessionStatus === "running" && (
                        <div className="w-1.5 h-1.5 bg-[#8da399] rounded-full animate-bounce mt-1" />
                      )}
                    </div>

                    <div className="w-28 h-20 border-2 border-[#424845] rounded-b-2xl rounded-t-sm relative flex items-end justify-center overflow-hidden bg-[#1c1b1b] z-10 shadow-lg">
                      <div
                        className="w-full transition-all duration-500 ease-linear"
                        style={{ 
                          height: `${Math.min(80, 30 + (titrantVol / 100) * 40)}%`,
                          backgroundColor: isNeutralized 
                            ? `hsl(330, ${Math.min(100, 60 + ((titrantVol - analyteVol) / 10) * 40)}%, ${Math.max(30, 80 - ((titrantVol - analyteVol) / 10) * 50)}%)`
                            : "rgba(229, 226, 225, 0.1)"
                        }}
                      />
                      <div
                        className="absolute bottom-1.5 w-6 h-1.5 bg-[#e5e2e1] rounded-full shadow-sm"
                        style={{
                          animation: stirrerRPM > 0 ? `spin ${Math.max(0.1, 1000 / stirrerRPM)}s linear infinite` : "none",
                        }}
                      />
                    </div>

                    <div className="w-40 h-7 border-2 border-[#424845] rounded-sm bg-[#20201f] flex items-center justify-around px-4 shadow-md">
                      <div className="w-3 h-3 rounded-full border border-[#8da399] bg-[#131313]" />
                      <div className="w-3 h-3 rounded-full border border-[#424845] bg-[#131313]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#20201f]/95 backdrop-blur-[12px] border border-[#424845] rounded-full px-4 py-1.5 flex items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)] z-20">
                <button
                  type="button"
                  onClick={handleTakeReading}
                  className="text-[#e5e2e1] hover:text-[#8da399] transition-colors flex items-center gap-1.5 font-label-caps text-[11px] cursor-pointer"
                  title="Take observation point"
                >
                  <span
                    className="material-symbols-outlined text-[18px] text-[#8da399]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                  Capture
                </button>
                <div className="w-px h-4 bg-[#424845]" />
                <button
                  type="button"
                  onClick={() => setSessionStatus(sessionStatus === "running" ? "paused" : "running")}
                  className="text-[#c2c8c4] hover:text-[#e5e2e1] transition-colors flex items-center gap-1 font-label-caps text-[11px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {sessionStatus === "running" ? "pause" : "fast_forward"}
                  </span>
                  {sessionStatus === "running" ? "Pause" : "Sweep"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[#c2c8c4] hover:text-[#e5e2e1] transition-colors flex items-center gap-1 font-label-caps text-[11px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  Reset
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-[#1c1b1b] p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="font-label-caps text-xs text-[#8da399] tracking-wider mb-2 font-semibold">
                  AIM & OBJECTIVE
                </h3>
                <p className="font-body-md text-sm text-[#e5e2e1] leading-relaxed max-w-3xl">
                  {config.aim}
                </p>
              </div>

              <div className="border-t border-[#424845] pt-4">
                <h3 className="font-label-caps text-xs text-[#8da399] tracking-wider mb-3 font-semibold">
                  STEP-BY-STEP PROCEDURE
                </h3>
                <ol className="space-y-3 max-w-3xl">
                  {config.procedure.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-[#c2c8c4]">
                      <span className="font-data-mono text-xs text-[#8da399] bg-[#20201f] px-2 py-0.5 rounded border border-[#424845] h-fit">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>

        {/* ── Drag Handle: Observations Resizer ── */}
        {isLargeScreen && (
          <div
            onMouseDown={(e) => startDrag("observations", obsWidth, e)}
            className={`w-2 hover:w-2 bg-[#131313] hover:bg-[#8da399]/20 active:bg-[#8da399]/40 cursor-col-resize transition-colors shrink-0 z-20 flex items-center justify-center relative group ${
              activeDrag === "observations" ? "bg-[#8da399]/30" : ""
            }`}
            title="Drag to resize Observations panel"
          >
            <div
              className={`w-0.5 h-full transition-colors ${
                activeDrag === "observations"
                  ? "bg-[#8da399]"
                  : "bg-[#424845] group-hover:bg-[#8da399]"
              }`}
            />
            <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#353535] group-hover:bg-[#8da399] rounded-full flex flex-col justify-center items-center gap-0.5 shadow-sm pointer-events-none">
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
            </div>
          </div>
        )}

        {/* ── 3. Right Panel: Observation Table & Real-Time Graph ── */}
        <aside
          style={{ width: isLargeScreen ? `${obsWidth}px` : '100%' }}
          className="shrink-0 bg-[#1c1b1b] flex flex-col lg:overflow-hidden min-w-0"
        >
          {/* Header */}
          <div className="p-3 border-b border-[#424845] bg-[#20201f] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">
                Observations
              </span>
              <span className="font-data-mono text-[10px] text-[#8da399] bg-[#131313] px-2 py-0.5 rounded border border-[#424845]">
                {observations.length} {observations.length === 1 ? "point" : "points"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">

              <button
                type="button"
                onClick={exportCSV}
                disabled={observations.length === 0}
                aria-label="Export CSV"
                className="text-[#c2c8c4] hover:text-[#8da399] transition-colors p-1 rounded hover:bg-[#353535] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Export CSV"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
          </div>

          {/* Observations Table */}
          <div
            style={{ height: `${obsTableHeight}px` }}
            className="overflow-y-auto shrink-0"
          >
            {observations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#c2c8c4]/60 gap-2 font-data-mono text-xs p-4">
                <span className="material-symbols-outlined text-2xl text-[#8da399]/40">
                  analytics
                </span>
                <span>Adjust parameters & click "Take Reading"</span>
              </div>
            ) : (
              <table className="w-full text-left font-data-mono text-xs">
                <thead className="bg-[#20201f] sticky top-0 border-b border-[#424845] text-[#c2c8c4] font-label-caps text-[10px]">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    {config.apparatus.map((app) => (
                      <th key={`input-${app.id}`} className="p-2 text-right">
                        {app.label} ({app.unit})
                      </th>
                    ))}
                    {entry.engine.outputColumns.map((col) => (
                      <th key={`output-${col.key}`} className="p-2 text-right">
                        {col.label} {col.unit ? `(${col.unit})` : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#424845]/40 text-[#e5e2e1]">
                  {observations.map((obs) => (
                    <tr
                      key={obs.id}
                      className="hover:bg-[#8da399]/5 transition-colors"
                    >
                      <td className="p-2 text-center text-[#c2c8c4]">{obs.id}</td>
                      {config.apparatus.map((app) => (
                        <td key={`input-${obs.id}-${app.id}`} className="p-2 text-right text-[#b5ccc1]">
                          {(obs.inputs[app.id] ?? 0).toFixed(1)}
                        </td>
                      ))}
                      {entry.engine.outputColumns.map((col) => (
                        <td key={`output-${obs.id}-${col.key}`} className="p-2 text-right text-[#8da399]">
                          {(obs.outputs[col.key] ?? 0).toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Vertical Drag Handle */}
          <div
            onMouseDown={(e) => startDrag("tableHeight", obsTableHeight, e)}
            className={`h-2 hover:h-2 bg-[#131313] hover:bg-[#8da399]/20 active:bg-[#8da399]/40 cursor-row-resize transition-colors shrink-0 z-20 flex flex-col items-center justify-center relative group ${
              activeDrag === "tableHeight" ? "bg-[#8da399]/30" : ""
            }`}
            title="Drag to resize Observations Table / Graph heights"
          >
            <div
              className={`h-0.5 w-full transition-colors ${
                activeDrag === "tableHeight"
                  ? "bg-[#8da399]"
                  : "bg-[#424845] group-hover:bg-[#8da399]"
              }`}
            />
            <div className="absolute left-1/2 -translate-x-1/2 h-1.5 w-6 bg-[#353535] group-hover:bg-[#8da399] rounded-full flex justify-center items-center gap-0.5 shadow-sm pointer-events-none">
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
            </div>
          </div>

          {/* Computed Results Card */}
          <div className="p-3 border-b border-[#424845] bg-[#20201f] shrink-0">
            <div className="font-label-caps text-[10px] text-[#8da399] mb-1.5 font-semibold uppercase">
              {isCircuit ? "COMPUTED OHMIC FIT" : "TITRATION ANALYSIS RESULTS"}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-data-mono">
              <div className="bg-[#131313] p-1.5 rounded border border-[#333333]">
                <div className="text-[9px] text-[#c2c8c4] uppercase">
                  {computedStats?.label1 || (isCircuit ? "Calculated Slope R" : "Analyte Molarity")}
                </div>
                <div className="text-sm text-[#e5e2e1] font-semibold mt-0.5">
                  {computedStats?.val1 || "--"}
                </div>
              </div>
              <div className="bg-[#131313] p-1.5 rounded border border-[#333333]">
                <div className="text-[9px] text-[#c2c8c4] uppercase">
                  {computedStats?.label2 || (isCircuit ? "Experimental Error" : "Equivalence Vol")}
                </div>
                <div className="text-sm text-[#b5ccc1] font-semibold mt-0.5">
                  {computedStats?.val2 || "--"}
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Recharts Plot with Configurable Line Type */}
          <div className="flex-1 p-3 flex flex-col bg-[#131313] min-h-[140px] overflow-hidden">
            <div className="flex justify-between items-center mb-1 shrink-0">
              <span className="font-label-caps text-[10px] text-[#c2c8c4]">
                {isCircuit ? "V-I CHARACTERISTIC PLOT" : "COLOR INTENSITY CURVE"}
              </span>
              <span className="font-data-mono text-[9px] text-[#8da399]">
                {graphLineType} line style
              </span>
            </div>

            <div className="flex-1 w-full min-h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 15, bottom: 5, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis
                    dataKey="x"
                    name={isCircuit ? "Voltage (V)" : "Volume Added (mL)"}
                    unit={isCircuit ? "V" : "mL"}
                    stroke="#424845"
                    tick={{
                      fontSize: 10,
                      fontFamily: "JetBrains Mono",
                      fill: "#c2c8c4",
                    }}
                  />
                  <YAxis
                    dataKey="y"
                    name={isCircuit ? "Current (mA)" : "Color"}
                    unit={isCircuit ? "mA" : ""}
                    domain={isCircuit ? [0, "auto"] : [0, 1]}
                    stroke="#424845"
                    tick={{
                      fontSize: 10,
                      fontFamily: "JetBrains Mono",
                      fill: "#c2c8c4",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1b1b",
                      borderColor: "#424845",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono",
                      color: "#e5e2e1",
                    }}
                  />
                  <Line
                    type={graphLineType}
                    dataKey="y"
                    stroke="#8da399"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      fill: "#8da399",
                      stroke: "#131313",
                      strokeWidth: 1,
                    }}
                    activeDot={{ r: 5, fill: "#b5ccc1" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Experiment Notes ── */}
          <div className="flex-1 min-h-[100px] bg-[#1a1a1a] border-t border-[#424845] p-3 flex flex-col shrink-0">
            <h4 className="text-xs font-label-caps text-[#c2c8c4] mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">edit_note</span>
              Experiment Notes
            </h4>
            <textarea
              className="w-full flex-1 bg-[#131313] border border-[#424845]/60 rounded-md p-2 text-sm text-[#e5e2e1] resize-none focus:outline-none focus:border-[#8da399] font-body-md placeholder-[#c2c8c4]/40"
              placeholder="Record your observations, hypotheses, and conclusions here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </aside>

        {/* ── 4. Far Right Panel: Docked Ask GALILEO AI Assistant ── */}
        {galileoPanelOpen && (
          <>
            <div
              onMouseDown={(e) => startDrag("chat", chatWidth, e)}
              className={`w-2 hover:w-2 bg-[#131313] hover:bg-[#8da399]/20 active:bg-[#8da399]/40 cursor-col-resize transition-colors shrink-0 z-20 flex items-center justify-center relative group ${
                activeDrag === "chat" ? "bg-[#8da399]/30" : ""
              }`}
              title="Drag to resize Ask GALILEO Assistant panel"
            >
              <div
                className={`w-0.5 h-full transition-colors ${
                  activeDrag === "chat"
                    ? "bg-[#8da399]"
                    : "bg-[#424845] group-hover:bg-[#8da399]"
                }`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#353535] group-hover:bg-[#8da399] rounded-full flex flex-col justify-center items-center gap-0.5 shadow-sm pointer-events-none">
                <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
                <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
                <div className="w-0.5 h-0.5 bg-[#e5e2e1] rounded-full" />
              </div>
            </div>

            <aside
              style={{ width: `${chatWidth}px` }}
              className="shrink-0 h-full z-20 animate-in slide-in-from-right duration-200 flex flex-col min-w-0 max-w-full overflow-hidden"
            >
              <GalileoChat />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
