import { useEffect } from 'react';
import { FileUploader } from './components/FileUploader/FileUploader';
import { Dashboard } from './components/Dashboard/Dashboard';
import { useUIStore } from './stores/uiStore';
import { useChatStore } from './stores/chatStore';
import { useTheme } from './hooks/useTheme';

function App() {
  const { activeView, setActiveView } = useUIStore();
  const { rawMessages } = useChatStore();
  useTheme();

  useEffect(() => {
    // Switch to dashboard view when data is loaded
    if (rawMessages.length > 0 && activeView === 'upload') {
      setActiveView('dashboard');
    }
  }, [rawMessages.length, activeView, setActiveView]);

  return (
    <>
      {activeView === 'upload' && <FileUploader />}
      {activeView === 'dashboard' && <Dashboard />}
    </>
  );
}

export default App;