import { Landing } from './pages/Landing';
import { DApp } from './pages/DApp';
import { About } from './pages/About';
import { ActivityListener } from './components/features/ActivityListener';
import { useNavigationStore } from './store/useNavigationStore';

function App() {
  const { currentView, setView } = useNavigationStore();

  return (
    <>
      <ActivityListener />
      {currentView === 'landing' ? (
        <Landing onEnter={() => setView('dapp')} onAbout={() => setView('about')} />
      ) : currentView === 'about' ? (
        <About />
      ) : (
        <DApp />
      )}
    </>
  );
}

export default App;
