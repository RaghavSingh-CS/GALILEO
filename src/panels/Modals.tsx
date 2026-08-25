import { useState, useEffect } from "react";
import { useNavigationStore } from "@/stores/navigation";
import { useExperimentStore } from "@/stores/experiment";
import { useHistoryStore } from "@/stores/history";
import { getExperiment } from "@/experiments/registry";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── 1. New Experiment Modal ──
export function NewExperimentModal({ isOpen, onClose }: ModalProps) {
  const openExperiment = useNavigationStore((s) => s.openExperiment);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<"physics" | "chemistry">("physics");
  const [template, setTemplate] = useState("ohms-law");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setSubject("physics");
      setTemplate("ohms-law");
    }
  }, [isOpen]);

  const handleSubjectChange = (newSubject: "physics" | "chemistry") => {
    setSubject(newSubject);
    if (newSubject === "physics") {
      setTemplate("ohms-law");
    } else if (newSubject === "chemistry") {
      setTemplate("titration-analysis");
    }
  };

  const handleTemplateChange = (newTemplate: string) => {
    setTemplate(newTemplate);
    if (newTemplate === "ohms-law") {
      setSubject("physics");
    } else if (newTemplate === "titration-analysis") {
      setSubject("chemistry");
    }
  };

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = getExperiment(template);
    if (entry) {
      const defaults: Record<string, number> = {};
      for (const param of entry.config.apparatus) {
        defaults[param.id] = param.default;
      }
      useExperimentStore.getState().startSession(template, defaults);
    }
    openExperiment(template);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-[#e5e2e1]">
        {/* Header */}
        <div className="p-4 border-b border-[#424845] bg-[#20201f] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
              <span className="material-symbols-outlined text-[#8da399] text-[18px]">add_circle</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
                Start New Experiment
              </h3>
              <p className="font-data-mono text-[11px] text-[#c2c8c4]">
                Configure and initialize virtual workbench
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c2c8c4] hover:text-[#e5e2e1] p-1 rounded hover:bg-[#353535] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4 font-body-md text-sm">
          <div>
            <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
              Experiment Session Label (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Resistance vs Temperature Study or Standard Run"
              className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] placeholder:text-[#c2c8c4]/40 focus:border-[#8da399] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
                Discipline / Subject
              </label>
              <select
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value as "physics" | "chemistry")}
                className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none font-data-mono text-xs cursor-pointer"
              >
                <option value="physics">Physics (Electromagnetism)</option>
                <option value="chemistry">Chemistry (Quantitative)</option>
              </select>
            </div>

            <div>
              <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
                Experiment Template
              </label>
              <select
                value={template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none font-data-mono text-xs cursor-pointer"
              >
                {subject === "physics" ? (
                  <option value="ohms-law">Circuit Fundamentals (Ohm's Law)</option>
                ) : (
                  <option value="titration-analysis">Titration Analysis (Acid-Base)</option>
                )}
              </select>
            </div>
          </div>

          <div className="bg-[#20201f] border border-[#424845] rounded-lg p-3 text-xs text-[#c2c8c4] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8da399] text-[18px]">info</span>
            <span>
              Launches an interactive simulated laboratory with real-time physical telemetry, plotting, and AI Assistant integration.
            </span>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#424845]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs px-4 py-2 shadow cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              Launch Workbench
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 2. Save Experiment to "My Experiments" Modal ──
interface SaveExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  experimentId: string;
  experimentTitle: string;
  subject: "physics" | "chemistry" | "biology";
  apparatusValues: Record<string, number>;
  observations: any[];
  summaryResult?: string;
  initialNotes?: string;
  onSuccess?: () => void;
}

export function SaveExperimentModal({
  isOpen,
  onClose,
  experimentId,
  experimentTitle,
  subject,
  apparatusValues,
  observations,
  summaryResult,
  initialNotes = "",
  onSuccess,
}: SaveExperimentModalProps) {
  const saveSession = useHistoryStore((s) => s.saveSession);
  const [customTitle, setCustomTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Syncing state on open
      setCustomTitle(`${experimentTitle} Run`);
      setNotes(initialNotes);
    }
  }, [isOpen, experimentTitle, initialNotes]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = customTitle.trim() || `${experimentTitle} Session`;
    const finalSummary =
      summaryResult ||
      (observations.length > 0
        ? `${observations.length} readings recorded`
        : `Calibrated setup with ${Object.keys(apparatusValues).length} apparatus parameters`);

    saveSession({
      experimentId,
      title: finalTitle,
      subject,
      apparatusValues: { ...apparatusValues },
      observations: [...observations],
      readingsCount: observations.length,
      summaryResult: finalSummary,
      notes: notes.trim(),
    });

    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-[#e5e2e1]">
        {/* Header */}
        <div className="p-4 border-b border-[#424845] bg-[#20201f] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
              <span className="material-symbols-outlined text-[#8da399] text-[18px]">bookmark_add</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
                Store to "My Experiments"
              </h3>
              <p className="font-data-mono text-[11px] text-[#c2c8c4]">
                Archive this experiment session & live telemetry
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c2c8c4] hover:text-[#e5e2e1] p-1 rounded hover:bg-[#353535] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4 font-body-md text-sm">
          <div>
            <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
              Session Title
            </label>
            <input
              type="text"
              required
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Ohm's Law Run #1 (100Ω Calibration)"
              className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none"
            />
          </div>

          <div>
            <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
              Researcher Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Conducted with standard 1.5% meter noise setting"
              className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] placeholder:text-[#c2c8c4]/40 focus:border-[#8da399] outline-none resize-none text-xs"
            />
          </div>

          {/* Telemetry Summary Box */}
          <div className="bg-[#20201f] border border-[#424845] rounded-lg p-3.5 flex flex-col gap-2 font-data-mono text-xs text-[#c2c8c4]">
            <div className="flex justify-between items-center text-[#8da399] font-label-caps text-[10px]">
              <span>SESSION SNAPSHOT</span>
              <span className="uppercase">{subject}</span>
            </div>
            <div className="flex justify-between">
              <span>Observations Recorded:</span>
              <span className="text-[#e5e2e1] font-semibold">{observations.length} data points</span>
            </div>
            <div className="flex justify-between">
              <span>Apparatus Parameters:</span>
              <span className="text-[#b5ccc1]">{Object.keys(apparatusValues).length} calibrated values</span>
            </div>
            {summaryResult && (
              <div className="pt-2 border-t border-[#424845]/50 text-[11px] text-[#b5ccc1]">
                {summaryResult}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#424845]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs px-4 py-2 shadow flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              Save to Archive
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 2. Library Modal ──
export function LibraryModal({ isOpen, onClose }: ModalProps) {
  const openExperiment = useNavigationStore((s) => s.openExperiment);
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const libraryItems = [
    {
      id: "ohms-law",
      title: "Ohm's Law & Circuit Conductance Manual",
      subject: "Physics",
      equations: "V = I × R · P = V × I",
      desc: "Comprehensive manual on voltage drops, linear resistance curves, and internal source dissipation.",
      experimentId: "ohms-law",
    },
    {
      id: "titration-analysis",
      title: "Acid-Base Titration & Neutralization Protocol",
      subject: "Chemistry",
      equations: "M₁V₁ = M₂V₂ · pH = -log[H⁺]",
      desc: "Standard neutralization curves using 0.1M HCl and 0.1M NaOH with phenolphthalein indicator endpoint analysis.",
      experimentId: "titration-analysis",
    },
  ];

  const filtered = libraryItems.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-[#e5e2e1]">
        {/* Header */}
        <div className="p-4 border-b border-[#424845] bg-[#20201f] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
              <span className="material-symbols-outlined text-[#8da399] text-[18px]">menu_book</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
                GALILEO Lab Library
              </h3>
              <p className="font-data-mono text-[11px] text-[#c2c8c4]">
                Scientific reference manuals & equations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c2c8c4] hover:text-[#e5e2e1] p-1 rounded hover:bg-[#353535] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#424845] bg-[#1a1a1a]">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined text-[#c2c8c4] absolute left-3 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference guides, formulas, or subjects..."
              className="w-full bg-[#131313] border border-[#333333] rounded pl-9 pr-3 py-1.5 text-xs text-[#e5e2e1] focus:border-[#8da399] outline-none"
            />
          </div>
        </div>

        {/* List of library resources */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-[#20201f] border border-[#333333] rounded-lg p-4 flex flex-col gap-2 hover:border-[#8da399]/60 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-label-caps text-[10px] text-[#8da399] bg-[#131313] px-2 py-0.5 rounded border border-[#424845] mr-2">
                    {item.subject}
                  </span>
                  <span className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">
                    {item.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openExperiment(item.experimentId);
                    onClose();
                  }}
                  className="btn-secondary text-[10px] py-1 px-2.5"
                >
                  Launch Lab
                </button>
              </div>

              <p className="font-body-md text-xs text-[#c2c8c4] leading-relaxed">
                {item.desc}
              </p>

              <div className="bg-[#131313] px-2.5 py-1.5 rounded border border-[#333333] font-data-mono text-[11px] text-[#b5ccc1] flex items-center gap-2">
                <span className="text-[9px] uppercase font-label-caps text-[#c2c8c4]">Formulas:</span>
                <span>{item.equations}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 3. Settings Modal ──
export function SettingsModal({ isOpen, onClose }: ModalProps) {
  const [noiseLevel, setNoiseLevel] = useState("realistic");
  const [themeMode, setThemeMode] = useState("dark");
  const [telemetryRate, setTelemetryRate] = useState("60fps");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-[#e5e2e1]">
        {/* Header */}
        <div className="p-4 border-b border-[#424845] bg-[#20201f] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
              <span className="material-symbols-outlined text-[#8da399] text-[18px]">settings</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
                Laboratory Settings
              </h3>
              <p className="font-data-mono text-[11px] text-[#c2c8c4]">
                Simulation engine & display configuration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c2c8c4] hover:text-[#e5e2e1] p-1 rounded hover:bg-[#353535] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Settings options */}
        <div className="p-5 flex flex-col gap-4 font-body-md text-sm">
          <div>
            <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
              Gaussian Sensor Noise (Physics / Chemistry)
            </label>
            <select
              value={noiseLevel}
              onChange={(e) => setNoiseLevel(e.target.value)}
              className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none font-data-mono text-xs"
            >
              <option value="realistic">Realistic Instrumental Noise (±1.5% Gaussian)</option>
              <option value="high">High Perturbation (±5.0% Noise)</option>
              <option value="ideal">Idealized (Zero Noise / Pure Equation)</option>
            </select>
          </div>

          <div>
            <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
              Telemetry Sampling Rate
            </label>
            <select
              value={telemetryRate}
              onChange={(e) => setTelemetryRate(e.target.value)}
              className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none font-data-mono text-xs"
            >
              <option value="60fps">High-Precision (60Hz / 60 FPS)</option>
              <option value="30fps">Standard (30Hz)</option>
              <option value="power-saver">Eco Mode (15Hz)</option>
            </select>
          </div>

          <div>
            <label className="block font-label-caps text-[11px] text-[#c2c8c4] mb-1.5 uppercase">
              Theme Palette
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setThemeMode("dark")}
                className={`p-2.5 rounded border text-xs font-label-caps flex items-center justify-center gap-2 cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-[#20201f] border-[#8da399] text-[#8da399]"
                    : "bg-[#131313] border-[#333333] text-[#c2c8c4]"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#8da399]" />
                Galileo Lab Dark
              </button>
              <button
                type="button"
                onClick={() => setThemeMode("oled")}
                className={`p-2.5 rounded border text-xs font-label-caps flex items-center justify-center gap-2 cursor-pointer ${
                  themeMode === "oled"
                    ? "bg-[#20201f] border-[#8da399] text-[#8da399]"
                    : "bg-[#131313] border-[#333333] text-[#c2c8c4]"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#0e0e0e] border border-[#424845]" />
                OLED Obsidian
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[#424845]">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary text-xs px-4 py-2"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
