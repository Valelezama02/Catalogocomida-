import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FamilyGate } from './state/family';
import { StoreProvider } from './state/store';
import { supabase } from './sync/client';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabase ? (
      <FamilyGate>
        {(cloud, personId, setPersonId) => (
          <StoreProvider key={cloud.familyId} cloud={cloud} personId={personId} onPersonChange={setPersonId}>
            <App />
          </StoreProvider>
        )}
      </FamilyGate>
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
