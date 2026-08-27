import { useState } from "react";
import { useNavigationStore } from "@/stores/navigation";
import {
  useSettingsStore,
  type NoiseLevel,
  type SweepSpeed,
  type GraphLineType,
  type AIVerbosity,
} from "@/stores/settings";

export default function SettingsView() {
  const goToDashboard = useNavigationStore((s) => s.goToDashboard);
  const goToMyExperiments = useNavigationStore((s) => s.goToMyExperiments);
  const goToLibrary = useNavigationStore((s) => s.goToLibrary);
  const openNewExpModal = useNavigationStore((s) => s.openNewExpModal);
  const goBackFromSettings = useNavigationStore((s) => s.goBackFromSettings);

  const {
    noiseLevel,
    setNoiseLevel,
    sweepSpeed,
    setSweepSpeed,
    graphLineType,
    setGraphLineType,
    aiVerbosity,
    setAiVerbosity,
    profile,
    updateProfile,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<"simulation" | "charts" | "ai" | "profile">("simulation");

  // Local form state
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [department, setDepartment] = useState(profile.department);
  const [saveToast, setSaveToast] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ firstName, lastName, email, department });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#404b4b] text-[#afbbba] transition-all active:scale-95 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                settings
              </span>
              <span className="font-body-md text-sm font-medium">Settings</span>
            </button>
          </li>
        </ul>

        <div className="mt-auto border-t border-[#424845]/50 pt-4 space-y-1">
          <div className="px-3 py-2 text-xs font-data-mono text-[#8c928e] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8da399] animate-pulse" />
            Config Node · Active
          </div>
        </div>
      </nav>

      {/* ── Main Settings Panel ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#131313] p-8 md:p-10 overflow-y-auto relative">
        {/* Toast */}
        {saveToast && (
          <div className="fixed top-6 right-6 bg-[#20201f] border border-[#8da399] text-[#e5e2e1] px-4 py-2.5 rounded-lg shadow-xl z-50 flex items-center gap-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-[#8da399] text-[18px]">check_circle</span>
            <span className="font-data-mono text-xs">Settings Updated & Saved!</span>
          </div>
        )}

        <div className="max-w-5xl mx-auto w-full">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="font-headline-lg text-3xl font-semibold text-[#e5e2e1]">
                Configuration & Parameters
              </h2>
              <p className="font-body-md text-sm text-[#c2c8c4] mt-1">
                Adjust simulation pacing, measurement tolerances, live graph curve styles, and AI assistant behavior.
              </p>
            </div>
            <button
              onClick={goBackFromSettings}
              className="w-10 h-10 rounded-full bg-[#1c1b1b] border border-[#424845] flex items-center justify-center text-[#c2c8c4] hover:bg-[#353535] hover:text-[#e5e2e1] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Settings Tabs & Content */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Section Selector Tab list */}
            <div className="w-full md:w-60 bg-[#1c1b1b] rounded-xl border border-[#424845] p-3 flex flex-col gap-1.5 shrink-0 h-fit">
              <button
                type="button"
                onClick={() => setActiveTab("simulation")}
                className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors cursor-pointer text-xs font-headline-sm ${
                  activeTab === "simulation"
                    ? "bg-[#2a2a2a] border-l-2 border-[#8da399] text-[#8da399]"
                    : "text-[#c2c8c4] hover:bg-[#20201f]"
                }`}
              >
                <span>Simulation & Pacing</span>
                <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("charts")}
                className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors cursor-pointer text-xs font-headline-sm ${
                  activeTab === "charts"
                    ? "bg-[#2a2a2a] border-l-2 border-[#8da399] text-[#8da399]"
                    : "text-[#c2c8c4] hover:bg-[#20201f]"
                }`}
              >
                <span>Plot Curve Fitting</span>
                <span className="material-symbols-outlined text-[18px]">show_chart</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors cursor-pointer text-xs font-headline-sm ${
                  activeTab === "ai"
                    ? "bg-[#2a2a2a] border-l-2 border-[#8da399] text-[#8da399]"
                    : "text-[#c2c8c4] hover:bg-[#20201f]"
                }`}
              >
                <span>Ask GALILEO Assistant</span>
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors cursor-pointer text-xs font-headline-sm ${
                  activeTab === "profile"
                    ? "bg-[#2a2a2a] border-l-2 border-[#8da399] text-[#8da399]"
                    : "text-[#c2c8c4] hover:bg-[#20201f]"
                }`}
              >
                <span>Researcher Profile</span>
                <span className="material-symbols-outlined text-[18px]">person</span>
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-[#1c1b1b] rounded-xl border border-[#424845] p-6 md:p-8">
              {/* TAB 1: Simulation & Pacing */}
              {activeTab === "simulation" && (
                <div className="space-y-6">
                  <div className="border-b border-[#424845] pb-4">
                    <h3 className="font-headline-md text-xl text-[#e5e2e1] font-semibold">
                      Simulation Engine & Meter Tolerances
                    </h3>
                    <p className="font-body-md text-xs text-[#c2c8c4] mt-1">
                      Controls physical sensor variation and auto-sweep speeds during Ohm's Law and Titration runs.
                    </p>
                  </div>

                  {/* Tolerance Setting */}
                  <div className="space-y-3">
                    <label className="block font-label-caps text-xs text-[#e5e2e1] uppercase">
                      Instrument Measurement Tolerance
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          id: "ideal" as NoiseLevel,
                          title: "Exact Theoretical (0% Error)",
                          desc: "Deterministic textbook formulas with zero instrument deviation.",
                        },
                        {
                          id: "realistic" as NoiseLevel,
                          title: "Standard Lab Precision (±1.5%)",
                          desc: "Standard physical meter tolerances for digital meters and titration observations.",
                        },
                        {
                          id: "high" as NoiseLevel,
                          title: "High Variance (±5.0%)",
                          desc: "Simulates variable equipment for experimental slope regression testing.",
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setNoiseLevel(item.id);
                            setSaveToast(true);
                            setTimeout(() => setSaveToast(false), 2000);
                          }}
                          className={`p-4 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            noiseLevel === item.id
                              ? "bg-[#20201f] border-[#8da399] ring-1 ring-[#8da399]"
                              : "bg-[#131313] border-[#333333] hover:border-[#424845]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">
                                {item.title}
                              </span>
                              {noiseLevel === item.id && (
                                <span className="w-2 h-2 rounded-full bg-[#8da399]" />
                              )}
                            </div>
                            <p className="text-xs text-[#c2c8c4] leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto Sweep Speed */}
                  <div className="space-y-3 pt-4 border-t border-[#424845]/50">
                    <label className="block font-label-caps text-xs text-[#e5e2e1] uppercase">
                      Continuous Auto-Sweep Speed
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "slow" as SweepSpeed, label: "Slow (1200ms)", desc: "Step-by-step observation" },
                        { id: "standard" as SweepSpeed, label: "Standard (700ms)", desc: "Optimal laboratory pace" },
                        { id: "fast" as SweepSpeed, label: "High-Speed (300ms)", desc: "Rapid curve synthesis" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSweepSpeed(item.id);
                            setSaveToast(true);
                            setTimeout(() => setSaveToast(false), 2000);
                          }}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                            sweepSpeed === item.id
                              ? "bg-[#20201f] border-[#8da399] ring-1 ring-[#8da399]"
                              : "bg-[#131313] border-[#333333] hover:border-[#424845]"
                          }`}
                        >
                          <div className="font-headline-sm text-xs font-semibold text-[#e5e2e1]">
                            {item.label}
                          </div>
                          <div className="font-body-md text-[11px] text-[#c2c8c4] mt-0.5">
                            {item.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Plot Curve Fitting */}
              {activeTab === "charts" && (
                <div className="space-y-6">
                  <div className="border-b border-[#424845] pb-4">
                    <h3 className="font-headline-md text-xl text-[#e5e2e1] font-semibold">
                      Live Graph Curve Fitting
                    </h3>
                    <p className="font-body-md text-xs text-[#c2c8c4] mt-1">
                      Choose how Recharts renders V-I characteristics and titration color-intensity curves in the Workspace.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block font-label-caps text-xs text-[#e5e2e1] uppercase">
                      Recharts Line Curve Style
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        {
                          id: "monotone" as GraphLineType,
                          title: "Monotone (Smoothed Spline)",
                          desc: "Curved spline fitting that smooths transitions between data points.",
                        },
                        {
                          id: "linear" as GraphLineType,
                          title: "Linear (Piecewise Segments)",
                          desc: "Connects consecutive observations directly with straight lines.",
                        },
                        {
                          id: "step" as GraphLineType,
                          title: "Step (Discrete Staircase)",
                          desc: "Shows discrete stepped intervals between sequential readings.",
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setGraphLineType(item.id);
                            setSaveToast(true);
                            setTimeout(() => setSaveToast(false), 2000);
                          }}
                          className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                            graphLineType === item.id
                              ? "bg-[#20201f] border-[#8da399] ring-1 ring-[#8da399]"
                              : "bg-[#131313] border-[#333333] hover:border-[#424845]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-headline-sm text-sm font-semibold text-[#e5e2e1]">
                              {item.title}
                            </span>
                            {graphLineType === item.id && (
                              <span className="w-2 h-2 rounded-full bg-[#8da399]" />
                            )}
                          </div>
                          <p className="text-xs text-[#c2c8c4] leading-relaxed">
                            {item.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Ask GALILEO Assistant */}
              {activeTab === "ai" && (
                <div className="space-y-6">
                  <div className="border-b border-[#424845] pb-4">
                    <h3 className="font-headline-md text-xl text-[#e5e2e1] font-semibold">
                      Ask GALILEO AI Response Mode
                    </h3>
                    <p className="font-body-md text-xs text-[#c2c8c4] mt-1">
                      Configure the explanation verbosity of the virtual AI assistant during experiments.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block font-label-caps text-xs text-[#e5e2e1] uppercase">
                      Explanation Verbosity & Depth
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        {
                          id: "concise" as AIVerbosity,
                          title: "Concise Scientific Briefing",
                          desc: "Direct answers, formulas, and quick error checks without long conversational filler.",
                        },
                        {
                          id: "detailed" as AIVerbosity,
                          title: "Pedagogical / Step-by-Step",
                          desc: "Full theoretical derivations, comprehensive rationale, and step-by-step guidance.",
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setAiVerbosity(item.id);
                            setSaveToast(true);
                            setTimeout(() => setSaveToast(false), 2000);
                          }}
                          className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                            aiVerbosity === item.id
                              ? "bg-[#20201f] border-[#8da399] ring-1 ring-[#8da399]"
                              : "bg-[#131313] border-[#333333] hover:border-[#424845]"
                          }`}
                        >
                          <div className="font-headline-sm text-sm font-semibold text-[#e5e2e1] mb-1">
                            {item.title}
                          </div>
                          <p className="text-xs text-[#c2c8c4] leading-relaxed">
                            {item.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Researcher Profile */}
              {activeTab === "profile" && (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="border-b border-[#424845] pb-4">
                    <h3 className="font-headline-md text-xl text-[#e5e2e1] font-semibold">
                      Profile Settings
                    </h3>
                    <p className="font-body-md text-xs text-[#c2c8c4] mt-1">
                      Update your researcher identity and institutional contact parameters.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-label-caps text-xs text-[#c2c8c4] mb-1.5 uppercase">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-label-caps text-xs text-[#c2c8c4] mb-1.5 uppercase">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-label-caps text-xs text-[#c2c8c4] mb-1.5 uppercase">
                        Institutional Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] font-data-mono text-xs focus:border-[#8da399] outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-label-caps text-xs text-[#c2c8c4] mb-1.5 uppercase">
                        Department & Laboratory Affiliation
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-[#131313] border border-[#333333] rounded px-3 py-2 text-[#e5e2e1] focus:border-[#8da399] outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[#424845]">
                    <button
                      type="submit"
                      className="btn-primary text-xs px-5 py-2.5 shadow cursor-pointer"
                    >
                      Save Profile Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
