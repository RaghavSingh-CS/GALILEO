import { useState } from "react";
import { useNavigationStore } from "@/stores/navigation";
import { useHistoryStore, type ConductedExperimentSession } from "@/stores/history";
import { useExperimentStore } from "@/stores/experiment";

export default function MyExperimentsView() {
  const goToDashboard = useNavigationStore((s) => s.goToDashboard);
  const goToLibrary = useNavigationStore((s) => s.goToLibrary);
  const goToSettings = useNavigationStore((s) => s.goToSettings);
  const openExperiment = useNavigationStore((s) => s.openExperiment);
  const openNewExpModal = useNavigationStore((s) => s.openNewExpModal);
  const loadSession = useExperimentStore((s) => s.loadSession);

  const { sessions, deleteSession, clearAll } = useHistoryStore();
  const [filter, setFilter] = useState<"all" | "physics" | "chemistry">("all");
  const [search, setSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteToast, setDeleteToast] = useState(false);

  const filteredSessions = sessions.filter((s) => {
    const matchesFilter = filter === "all" || s.subject === filter;
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.summaryResult.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleConfirmDelete = (id: string) => {
    deleteSession(id);
    setDeleteConfirmId(null);
    setDeleteToast(true);
    setTimeout(() => setDeleteToast(false), 2500);
  };

  const handleConfirmClearAll = () => {
    clearAll();
    setClearConfirmOpen(false);
    setDeleteToast(true);
    setTimeout(() => setDeleteToast(false), 2500);
  };

  const handleResumeSession = (session: ConductedExperimentSession) => {
    // Pre-populate experiment store with this session's readings and apparatus settings
    loadSession(session.experimentId, session.apparatusValues, session.observations, session.notes || "");
    // Open the workspace with this experiment ID
    openExperiment(session.experimentId);
  };

  const handleExportCSV = (session: ConductedExperimentSession) => {
    if (session.observations.length === 0) return;
    const isOhms = session.experimentId === "ohms-law";
    const headers = isOhms
      ? ["Reading #", "Voltage (V)", "Resistance (Ω)", "Current (mA)", "Power (mW)"]
      : ["Reading #", "Titrant Added (mL)", "Analyte Vol (mL)", "Sensor pH"];

    const rows = session.observations.map((obs) =>
      isOhms
        ? [
            obs.id,
            obs.inputs.voltage ?? 0,
            obs.inputs.resistance ?? 0,
            obs.outputs.current ?? 0,
            obs.outputs.power ?? 0,
          ]
        : [
            obs.id,
            obs.inputs.volumeAdded ?? 0,
            obs.inputs.analyteVolume ?? 25,
            obs.outputs.ph ?? 7,
          ]
    );

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `galileo_${session.id}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-screen w-screen flex bg-[#131313] text-[#e5e2e1] font-body-md overflow-hidden selection:bg-[#8da399] selection:text-[#263932]">
      {/* ── Left Sidebar Navigation (Stitch Design) ── */}
      <nav className="hidden md:flex flex-col h-screen p-3 bg-[#1c1b1b] border-r border-[#424845] w-64 shrink-0 z-10">
        <div className="flex items-center gap-3 mb-6 px-2 mt-2">
          <div className="w-8 h-8 rounded bg-[#8da399] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#263932] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              science
            </span>
          </div>
          <div>
            <h1 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
              GALILEO Lab
            </h1>
            <p className="font-label-caps text-[10px] text-[#c2c8c4]">
              Precision Workspace
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openNewExpModal}
          className="w-full bg-[#8da399] text-[#21342d] font-label-caps text-xs py-2.5 rounded mb-6 hover:bg-[#b5ccc1] transition-all flex items-center justify-center gap-2 border border-[#8da399] shadow-sm font-semibold cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Experiment
        </button>

        <ul className="flex-1 space-y-1">
          <li>
            <button
              type="button"
              onClick={goToDashboard}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#c2c8c4] hover:bg-[#353535] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] group-hover:text-[#b5ccc1] transition-colors">
                dashboard
              </span>
              <span className="font-body-md text-sm">Dashboard</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#404b4b] text-[#afbbba] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                science
              </span>
              <span className="font-body-md text-sm font-medium">My Experiments</span>
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

        <div className="mt-auto border-t border-[#424845]/50 pt-4 space-y-1">
          <div className="px-3 py-2 text-xs font-data-mono text-[#8c928e] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8da399]" />
            {sessions.length} Recorded Runs
          </div>
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#131313] p-8 md:p-10 overflow-y-auto relative">
        {/* Toast */}
        {deleteToast && (
          <div className="fixed top-6 right-6 bg-[#20201f] border border-[#ffb4ab]/40 text-[#ffdad6] px-4 py-2.5 rounded-lg shadow-xl z-50 flex items-center gap-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-[#ffb4ab] text-[18px]">delete</span>
            <span className="font-data-mono text-xs">Experiment record removed from archive</span>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col gap-4 text-[#e5e2e1]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#93000a]/20 border border-[#ffb4ab]/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#ffb4ab] text-xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
                    Delete Experiment Run?
                  </h3>
                  <p className="font-body-md text-xs text-[#c2c8c4] mt-0.5">
                    This will permanently delete this session and its recorded telemetry readings.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#424845]">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(deleteConfirmId)}
                  className="bg-[#93000a] hover:bg-[#ba1a1a] text-[#ffdad6] font-label-caps text-xs px-4 py-2 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation Modal */}
        {clearConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col gap-4 text-[#e5e2e1]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#93000a]/20 border border-[#ffb4ab]/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#ffb4ab] text-xl">warning</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1]">
                    Clear Entire Archive?
                  </h3>
                  <p className="font-body-md text-xs text-[#c2c8c4] mt-0.5">
                    All {sessions.length} saved experiment runs will be permanently removed.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#424845]">
                <button
                  type="button"
                  onClick={() => setClearConfirmOpen(false)}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  className="bg-[#93000a] hover:bg-[#ba1a1a] text-[#ffdad6] font-label-caps text-xs px-4 py-2 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  Clear Everything
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="font-headline-lg text-3xl font-semibold text-[#e5e2e1]">
                Conducted Experiments
              </h2>
              <p className="font-body-md text-sm text-[#c2c8c4] mt-1">
                Archive of previously conducted simulations, telemetry observations, and calculated parameters.
              </p>
            </div>

            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                className="text-xs font-label-caps text-[#c2c8c4] hover:text-[#ffdad6] p-2 rounded hover:bg-[#93000a]/20 border border-[#424845] transition-colors cursor-pointer flex items-center gap-1.5"
                title="Clear all stored experiment history"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Clear History
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c8c4] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search experiments by title, notes, or results..."
                className="w-full bg-[#1c1b1b] border border-[#424845] rounded-lg pl-9 pr-4 py-2.5 text-xs text-[#e5e2e1] focus:border-[#8da399] outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              {(["all", "physics", "chemistry"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`font-label-caps text-xs px-3.5 py-2 rounded-lg border transition-all cursor-pointer capitalize ${
                    filter === f
                      ? "bg-[#20201f] border-[#8da399] text-[#8da399]"
                      : "bg-[#1c1b1b] border-[#424845] text-[#c2c8c4] hover:bg-[#2a2a2a]"
                  }`}
                >
                  {f === "all" ? "All Disciplines" : f}
                </button>
              ))}
            </div>
          </div>

          {/* List of Experiment Runs */}
          {filteredSessions.length === 0 ? (
            <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#20201f] border border-[#424845] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#8da399] text-3xl">science</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-base text-[#e5e2e1] font-semibold mb-1">
                  No Conducted Experiments Found
                </h3>
                <p className="font-body-md text-xs text-[#c2c8c4] max-w-sm">
                  Run simulations and save readings in Ohm's Law or Titration Analysis to build your laboratory archive.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => openExperiment("ohms-law")}
                  className="btn-primary text-xs px-4 py-2 cursor-pointer"
                >
                  Launch Ohm's Law
                </button>
                <button
                  type="button"
                  onClick={() => openExperiment("titration-analysis")}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                >
                  Launch Titration Analysis
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <article
                  key={session.id}
                  className="bg-[#1c1b1b] border border-[#424845] rounded-xl p-5 hover:border-[#8da399]/60 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#20201f] border border-[#333333] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#8da399]">
                        {session.subject === "physics" ? "electrical_services" : "science"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-label-caps text-[9px] text-[#8da399] bg-[#131313] px-2 py-0.5 rounded border border-[#424845] uppercase">
                          {session.subject}
                        </span>
                        <span className="font-data-mono text-[11px] text-[#c2c8c4]">
                          {session.date}
                        </span>
                      </div>

                      <h3 className="font-headline-sm text-base font-semibold text-[#e5e2e1] group-hover:text-[#d1e8dd] transition-colors">
                        {session.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 mt-2 font-data-mono text-xs text-[#c2c8c4]">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#8da399]">
                            analytics
                          </span>
                          {session.readingsCount} Readings Recorded
                        </span>
                        <span className="text-[#424845]">·</span>
                        <span className="text-[#b5ccc1] bg-[#131313] px-2 py-0.5 rounded border border-[#333333]">
                          {session.summaryResult}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportCSV(session)}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                      title="Export CSV dataset"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      CSV
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResumeSession(session)}
                      className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow cursor-pointer"
                      title="Load this experiment session into Workspace"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      Review & Resume
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(session.id)}
                      className="text-[#c2c8c4] hover:text-[#ffdad6] p-1.5 rounded hover:bg-[#93000a]/20 transition-colors cursor-pointer"
                      title="Delete this run from archive"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
