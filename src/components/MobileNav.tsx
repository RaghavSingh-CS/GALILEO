import { useState } from "react";
import { useNavigationStore } from "@/stores/navigation";

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const activeView = useNavigationStore((s) => s.activeView);
  const setActiveView = useNavigationStore((s) => s.setActiveView);
  const openNewExpModal = useNavigationStore((s) => s.openNewExpModal);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "space_dashboard" },
    { id: "my-experiments", label: "My Experiments", icon: "science" },
    { id: "library", label: "Component Library", icon: "shelves" },
  ] as const;

  const navigate = (id: typeof activeView) => {
    setActiveView(id);
    setIsOpen(false);
  };

  const handleNewExperiment = () => {
    openNewExpModal();
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="fixed top-4 right-4 z-50 p-2 bg-[#1c1b1b] border border-[#424845] rounded-md text-[#e5e2e1] hover:bg-[#2a2a2a] shadow-md"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Menu */}
      <div
        className={`fixed inset-y-0 right-0 w-64 bg-[#1c1b1b] border-l border-[#424845] z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-[#424845] flex justify-between items-center bg-[#20201f]">
            <span className="font-headline-sm font-semibold text-[#e5e2e1]">GALILEO Menu</span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
              className="text-[#c2c8c4] hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <button
              onClick={handleNewExperiment}
              className="w-full bg-[#8da399] text-[#131313] py-2 px-3 flex items-center justify-center gap-2 rounded hover:bg-[#b5ccc1] font-semibold transition-colors mb-4"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Experiment
            </button>

            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                  activeView === item.id
                    ? "bg-[#8da399]/10 text-[#8da399]"
                    : "text-[#c2c8c4] hover:text-[#e5e2e1] hover:bg-[#2a2a2a]"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-[#424845]">
            <button
              onClick={() => navigate("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                activeView === "settings"
                  ? "bg-[#8da399]/10 text-[#8da399]"
                  : "text-[#c2c8c4] hover:text-[#e5e2e1] hover:bg-[#2a2a2a]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span className="font-medium text-sm">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
