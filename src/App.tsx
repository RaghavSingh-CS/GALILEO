import "./index.css";
import { useNavigationStore } from "@/stores/navigation";
import Dashboard from "@/views/Dashboard";
import Workspace from "@/views/Workspace";
import MyExperimentsView from "@/views/MyExperimentsView";
import LibraryView from "@/views/LibraryView";
import SettingsView from "@/views/SettingsView";
import { NewExperimentModal } from "@/panels/Modals";
import MobileNav from "@/components/MobileNav";
import { useEffect } from "react";

function App() {
  const activeView = useNavigationStore((s) => s.activeView);
  const activeExperimentId = useNavigationStore((s) => s.activeExperimentId);
  const isNewExpModalOpen = useNavigationStore((s) => s.isNewExpModalOpen);
  const closeNewExpModal = useNavigationStore((s) => s.closeNewExpModal);

  // Sync state -> hash
  useEffect(() => {
    if (activeView === "workspace" && activeExperimentId) {
      window.location.hash = `/workspace/${activeExperimentId}`;
    } else {
      window.location.hash = `/${activeView}`;
    }
  }, [activeView, activeExperimentId]);

  // Sync hash -> state on mount and hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      const parts = hash.split("/");
      const view = parts[0];
      if (view === "workspace" && parts[1]) {
        useNavigationStore.getState().openExperiment(parts[1]);
      } else if (view && ["dashboard", "my-experiments", "library", "settings"].includes(view)) {
        useNavigationStore.getState().setActiveView(view as any);
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case "workspace":
        return <Workspace />;
      case "my-experiments":
        return <MyExperimentsView />;
      case "library":
        return <LibraryView />;
      case "settings":
        return <SettingsView />;
      case "dashboard":
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <NewExperimentModal isOpen={isNewExpModalOpen} onClose={closeNewExpModal} />
      {activeView !== "workspace" && <MobileNav />}
      {renderView()}
    </>
  );
}

export default App;
