import "./index.css";
import { useNavigationStore } from "@/stores/navigation";
import Dashboard from "@/views/Dashboard";
import Workspace from "@/views/Workspace";
import MyExperimentsView from "@/views/MyExperimentsView";
import LibraryView from "@/views/LibraryView";
import SettingsView from "@/views/SettingsView";
import { NewExperimentModal } from "@/panels/Modals";

function App() {
  const activeView = useNavigationStore((s) => s.activeView);
  const isNewExpModalOpen = useNavigationStore((s) => s.isNewExpModalOpen);
  const closeNewExpModal = useNavigationStore((s) => s.closeNewExpModal);

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
      {renderView()}
    </>
  );
}

export default App;
