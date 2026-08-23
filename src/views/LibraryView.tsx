import { useState } from "react";
import { useNavigationStore } from "@/stores/navigation";

export default function LibraryView() {
  const goToDashboard = useNavigationStore((s) => s.goToDashboard);
  const goToMyExperiments = useNavigationStore((s) => s.goToMyExperiments);
  const goToSettings = useNavigationStore((s) => s.goToSettings);
  const openExperiment = useNavigationStore((s) => s.openExperiment);
  const openNewExpModal = useNavigationStore((s) => s.openNewExpModal);

  const [activeSubject, setActiveSubject] = useState<string>("all");
  const [search, setSearch] = useState("");

  const documents = [
    {
      id: "doc-1",
      name: "Ohms_Law_Circuit_Fundamentals_Manual.pdf",
      subject: "Physics",
      type: "Lab Manual",
      modified: "2026-08-20",
      size: "2.4 MB",
      experimentId: "ohms-law",
      desc: "Complete guide to DC circuits, voltage-current linear relationships, and resistor calibration.",
    },
    {
      id: "doc-2",
      name: "Acid_Base_Titration_Phenolphthalein_Protocol.pdf",
      subject: "Chemistry",
      type: "Protocol Guide",
      modified: "2026-08-18",
      size: "1.8 MB",
      experimentId: "titration-analysis",
      desc: "Standard 0.1M HCl vs NaOH neutralization procedure, equivalence point detection, and pH curve analysis.",
    },
  ];

  const filtered = documents.filter((doc) => {
    const matchesSubject =
      activeSubject === "all" || doc.subject.toLowerCase() === activeSubject.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.desc.toLowerCase().includes(search.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="h-screen w-screen flex bg-[#131313] text-[#e5e2e1] font-body-md overflow-hidden selection:bg-[#8da399] selection:text-[#263932]">
      {/* ── Left Sidebar Navigation ── */}
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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#404b4b] text-[#afbbba] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                menu_book
              </span>
              <span className="font-body-md text-sm font-medium">Library</span>
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
            Library Vault · Online
          </div>
        </div>
      </nav>

      {/* ── Main Library Content Area ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#131313] p-8 md:p-10 overflow-y-auto relative">
        <div className="max-w-6xl mx-auto w-full">
          <div className="mb-8">
            <h2 className="font-headline-lg text-3xl font-semibold text-[#e5e2e1]">
              Laboratory Library & Manuals
            </h2>
            <p className="font-body-md text-sm text-[#c2c8c4] mt-1">
              Scientific reference manuals, experiment procedures, and equipment guidelines.
            </p>
          </div>

          {/* Search Toolbar */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c8c4] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lab manuals, procedures, or subjects..."
                className="w-full bg-[#1c1b1b] border border-[#424845] rounded-lg pl-9 pr-4 py-2.5 text-xs text-[#e5e2e1] focus:border-[#8da399] outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: "all", label: "All Subjects" },
                { id: "physics", label: "Physics" },
                { id: "chemistry", label: "Chemistry" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubject(sub.id)}
                  className={`font-label-caps text-xs px-3.5 py-2 rounded-lg border transition-all cursor-pointer ${
                    activeSubject === sub.id
                      ? "bg-[#20201f] border-[#8da399] text-[#8da399]"
                      : "bg-[#1c1b1b] border-[#424845] text-[#c2c8c4] hover:bg-[#2a2a2a]"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-[#1c1b1b] border border-[#424845] rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1fr_140px_140px_100px_120px] gap-4 px-6 py-3 border-b border-[#424845] text-[#c2c8c4] font-label-caps text-[11px] bg-[#20201f]">
              <div>Document Title</div>
              <div>Subject</div>
              <div>Type</div>
              <div>Size</div>
              <div className="text-right">Action</div>
            </div>

            <div className="divide-y divide-[#424845]/40">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-[1fr_140px_140px_100px_120px] gap-4 px-6 py-4 items-center hover:bg-[#20201f]/70 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-[#8da399] text-[20px]">
                      description
                    </span>
                    <div>
                      <div className="font-headline-sm text-sm text-[#e5e2e1] font-semibold truncate">
                        {doc.name}
                      </div>
                      <div className="font-body-md text-xs text-[#c2c8c4] truncate mt-0.5">
                        {doc.desc}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="px-2 py-0.5 rounded bg-[#131313] text-[#8da399] text-[10px] font-label-caps border border-[#424845]">
                      {doc.subject}
                    </span>
                  </div>

                  <div className="font-data-mono text-xs text-[#c2c8c4]">
                    {doc.type}
                  </div>

                  <div className="font-data-mono text-xs text-[#c2c8c4]">
                    {doc.size}
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => openExperiment(doc.experimentId)}
                      className="btn-secondary text-[11px] py-1 px-3 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Lab</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
