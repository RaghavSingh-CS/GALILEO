import { useNavigationStore } from "@/stores/navigation";
import { useExperimentStore } from "@/stores/experiment";
import { useEffect, useState } from "react";
import { getExperiment } from "@/experiments/registry";

interface ExperimentCardProps {
  id: string;
  title: string;
  subject: string;
  category: string;
  icon: string;
  description: string;
  onStart: () => void;
}

function ExperimentCard({
  title,
  description,
  category,
  icon,
  onStart,
}: ExperimentCardProps) {
  return (
    <article className="bg-[#1c1b1b] border border-[#424845] rounded-xl p-6 flex flex-col hover:border-[#8da399] transition-all duration-300 group relative overflow-hidden shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      {/* Background radial accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#8da399]/5 rounded-bl-full pointer-events-none group-hover:bg-[#8da399]/10 transition-colors" />

      {/* Top row */}
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#353535] flex items-center justify-center border border-[#424845]/50 group-hover:bg-[#2a2a2a] transition-colors">
          <span className="material-symbols-outlined text-[#b5ccc1]">{icon}</span>
        </div>
        <span className="bg-[#20201f] text-[#c2c8c4] font-label-caps text-[10px] px-2.5 py-1 rounded border border-[#424845]/30 tracking-wider">
          {category}
        </span>
      </div>

      {/* Title & description */}
      <h4 className="font-headline-sm text-lg text-[#e5e2e1] mb-2 group-hover:text-[#d1e8dd] transition-colors">
        {title}
      </h4>
      <p className="font-body-md text-sm text-[#c2c8c4] flex-1 mb-6 leading-relaxed">
        {description}
      </p>

      {/* Bottom action button */}
      <div className="flex justify-end items-center pt-4 border-t border-[#424845]/30">
        <button
          type="button"
          onClick={onStart}
          className="bg-[#8da399] text-[#21342d] hover:bg-[#b5ccc1] font-label-caps text-[11px] px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
        >
          <span>START LAB</span>
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
        </button>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const openExperiment = useNavigationStore((s) => s.openExperiment);
  const startSession = useExperimentStore((s) => s.startSession);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/galileo/health")
      .then((res) => res.json())
      .then((data) => setAiConnected(data.status === "connected"))
      .catch(() => setAiConnected(false));
  }, []);

  const goToMyExperiments = useNavigationStore((s) => s.goToMyExperiments);
  const goToLibrary = useNavigationStore((s) => s.goToLibrary);
  const goToSettings = useNavigationStore((s) => s.goToSettings);
  const openNewExpModal = useNavigationStore((s) => s.openNewExpModal);

  const ohmsLaw = getExperiment("ohms-law");
  const seriesParallel = getExperiment("series-parallel");
  const oxalicAcid = getExperiment("oxalic-acid-titration");
  const mohrsSalt = getExperiment("mohrs-salt-titration");

  const handleStart = (id: string) => {
    const entry = getExperiment(id);
    if (entry) {
      const defaults: Record<string, number> = {};
      for (const param of entry.config.apparatus) {
        defaults[param.id] = param.default;
      }
      startSession(id, defaults);
    }
    openExperiment(id);
  };

  return (
    <div className="h-screen w-screen flex bg-[#131313] text-[#e5e2e1] font-body-md overflow-hidden selection:bg-[#8da399] selection:text-[#263932]">

      {/* ── Left Side Navigation ── */}
      <nav className="hidden md:flex flex-col h-screen p-3 bg-[#1c1b1b] border-r border-[#424845] w-64 shrink-0 shadow-none z-10 relative">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6 px-2 mt-2">
          <div className="w-8 h-8 rounded bg-[#8da399] flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[#263932] text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              science
            </span>
          </div>
          <div>
            <h1 className="font-headline-sm text-base font-semibold text-[#e5e2e1] tracking-tight">
              GALILEO Lab
            </h1>
            <p className="font-label-caps text-[10px] text-[#c2c8c4]">
              Precision Workspace
            </p>
          </div>
        </div>

        {/* New Experiment CTA */}
        <button
          type="button"
          onClick={openNewExpModal}
          className="w-full bg-[#8da399] text-[#21342d] font-label-caps text-xs py-2.5 rounded mb-6 hover:bg-[#b5ccc1] transition-all flex items-center justify-center gap-2 border border-[#8da399] shadow-sm font-semibold cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Experiment
        </button>

        {/* Navigation list */}
        <ul className="flex-1 space-y-1">
          <li>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#404b4b] text-[#afbbba] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                dashboard
              </span>
              <span className="font-body-md text-sm font-medium">Dashboard</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={goToMyExperiments}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#c2c8c4] hover:bg-[#353535] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] group-hover:text-[#b5ccc1] transition-colors">
                science
              </span>
              <span className="font-body-md text-sm">My Experiments</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={goToLibrary}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#c2c8c4] hover:bg-[#353535] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] group-hover:text-[#b5ccc1] transition-colors">
                menu_book
              </span>
              <span className="font-body-md text-sm">Library</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={goToSettings}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#c2c8c4] hover:bg-[#353535] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] group-hover:text-[#b5ccc1] transition-colors">
                settings
              </span>
              <span className="font-body-md text-sm">Settings</span>
            </button>
          </li>
        </ul>

        {/* Bottom meta */}
        <div className="mt-auto border-t border-[#424845]/50 pt-4 space-y-1">
          <div className="px-3 py-2 text-xs font-data-mono text-[#8c928e] flex items-center gap-2">
            {aiConnected === true ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#8da399] animate-pulse" />
                v0.1.0 · Connected
              </>
            ) : aiConnected === false ? (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500" />
                v0.1.0 · Disconnected
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                v0.1.0 · Checking...
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-y-auto bg-[#131313] p-8 md:p-10 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8da399]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[#404b4b]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header without req compute / status clutter */}
          <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="font-headline-lg text-3xl text-[#e5e2e1] mb-2 font-semibold">
                Active Experiments
              </h2>
              <p className="font-body-lg text-base text-[#c2c8c4] max-w-2xl">
                Select a virtual laboratory module to calibrate apparatus parameters and conduct simulations.
              </p>
            </div>
          </header>

          {/* Physics Group */}
          <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <h3 className="font-headline-md text-xl text-[#e5e2e1] font-semibold">
                Physics
              </h3>
              <div className="flex-1 h-px bg-[#424845]/50" />
              <span className="font-data-mono text-xs text-[#c2c8c4] bg-[#20201f] px-2.5 py-1 rounded border border-[#424845]/40">
                02 MODULES
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ExperimentCard
                id="ohms-law"
                title={ohmsLaw?.config.title || "Ohm's Law"}
                subject="physics"
                category="ELECTROMAGNETISM"
                icon="electrical_services"
                description={
                  ohmsLaw?.config.description ||
                  "Verify the linear relationship between voltage and current across a resistor at constant resistance."
                }
                onStart={() => handleStart("ohms-law")}
              />
              <ExperimentCard
                id="series-parallel"
                title={seriesParallel?.config.title || "Series and Parallel Circuits"}
                subject="physics"
                category="ELECTROMAGNETISM"
                icon="account_tree"
                description={
                  seriesParallel?.config.description ||
                  "Investigate equivalent resistance in series and parallel resistor networks."
                }
                onStart={() => handleStart("series-parallel")}
              />
            </div>
          </section>

          {/* Chemistry Group (Only Titration Analysis) */}
          <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <h3 className="font-headline-md text-xl text-[#e5e2e1] font-semibold">
                Chemistry
              </h3>
              <div className="flex-1 h-px bg-[#424845]/50" />
              <span className="font-data-mono text-xs text-[#c2c8c4] bg-[#20201f] px-2.5 py-1 rounded border border-[#424845]/40">
                02 MODULES
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ExperimentCard
                id="oxalic-acid-titration"
                title={oxalicAcid?.config.title || "Oxalic Acid Titration"}
                subject="chemistry"
                category="QUANTITATIVE"
                icon="science"
                description={
                  oxalicAcid?.config.description ||
                  "Standardize a potassium permanganate solution by titrating it against a hot standard solution of oxalic acid."
                }
                onStart={() => handleStart("oxalic-acid-titration")}
              />
              <ExperimentCard
                id="mohrs-salt-titration"
                title={mohrsSalt?.config.title || "Mohr's Salt Titration"}
                subject="chemistry"
                category="QUANTITATIVE"
                icon="biotech"
                description={
                  mohrsSalt?.config.description ||
                  "Standardize a potassium permanganate solution by titrating it against a standard solution of Mohr's salt."
                }
                onStart={() => handleStart("mohrs-salt-titration")}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
