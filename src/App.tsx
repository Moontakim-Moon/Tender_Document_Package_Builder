import './index.css';
import { AppProvider } from './store/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SetupStep } from './components/SetupStep';
import { UploadStep } from './components/UploadStep';
import { MatchStep } from './components/MatchStep';
import { ValidateStep } from './components/ValidateStep';
import { ReviewStep } from './components/ReviewStep';
import { GenerateStep } from './components/GenerateStep';
import { DuplicateDetector } from './components/DuplicateDetector';
import { useAppContext } from './store/AppContext';

function AppContent() {
  const { state } = useAppContext();

  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="app-main" id="main-content" role="main" aria-label="Main content">
          {state.currentStep === 'setup' && <SetupStep />}
          {state.currentStep === 'upload' && <UploadStep />}
          {state.currentStep === 'match' && <MatchStep />}
          {state.currentStep === 'validate' && <ValidateStep />}
          {state.currentStep === 'review' && <ReviewStep />}
          {state.currentStep === 'generate' && <GenerateStep />}
        </main>
      </div>
      {/* Invisible utility component for duplicate detection */}
      <DuplicateDetector />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
