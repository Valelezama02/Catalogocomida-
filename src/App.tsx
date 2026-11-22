import { useState } from 'react';
import { useStore } from './state/store';
import Home from './screens/Home';
import Inventory from './screens/Inventory';
import LogUse from './screens/LogUse';
import Receipts from './screens/Receipts';
import Market from './screens/Market';
import Notes from './screens/Notes';
import Settings from './screens/Settings';
import ProductDetail from './screens/ProductDetail';

export type Tab = 'inicio' | 'inventario' | 'anotar' | 'facturas' | 'mercado' | 'notas' | 'ajustes';

export interface Nav {
  go: (t: Tab) => void;
  openProduct: (id: string) => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'inventario', label: 'Qué hay', icon: '📦' },
  { id: 'anotar', label: 'Anotar', icon: '✏️' },
  { id: 'mercado', label: 'Mercado', icon: '🛒' },
  { id: 'notas', label: 'Notas', icon: '📝' },
];

const SYNC_LABEL: Record<string, string> = { cargando: 'Cargando…', ok: 'Al día', subiendo: 'Guardando…', 'sin-conexion': 'Sin conexión: se guarda al volver' };

export default function App() {
  const { state, cloud, sync, author } = useStore();
  const [tab, setTab] = useState<Tab>('inicio');
  const [productId, setProductId] = useState<string | null>(null);

  if (!sync.ready)
    return (
      <div className="screen whoami center">
        <div className="brand big-brand">Despensa</div>
        <p className="muted">{sync.status === 'sin-conexion' ? 'No hay conexión. Conéctate a internet para bajar los datos de la familia.' : 'Bajando los datos de la familia…'}</p>
      </div>
    );

  const nav: Nav = {
    go: (t) => {
      setProductId(null);
      setTab(t);
      window.scrollTo(0, 0);
    },
    openProduct: (id) => {
      setProductId(id);
      window.scrollTo(0, 0);
    },
  };

  let screen;
  if (productId) screen = <ProductDetail id={productId} onBack={() => setProductId(null)} />;
  else if (tab === 'inicio') screen = <Home nav={nav} />;
  else if (tab === 'inventario') screen = <Inventory nav={nav} />;
  else if (tab === 'anotar') screen = <LogUse nav={nav} />;
  else if (tab === 'facturas') screen = <Receipts />;
  else if (tab === 'mercado') screen = <Market nav={nav} />;
  else if (tab === 'notas') screen = <Notes />;
  else screen = <Settings nav={nav} />;

  const pendingNotes = state.notes.filter((n) => !n.done).length;
  const pendingList = state.list.filter((i) => !i.checked).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => nav.go('inicio')}>
          Despensa
        </div>
        {cloud && <span className={`dot ${sync.status}`} title={SYNC_LABEL[sync.status]} onClick={() => sync.syncNow()} />}
        {author && (
          <button className="chip" onClick={() => nav.go('ajustes')}>
            👤 {author}
          </button>
        )}
        <button className={`icon ${tab === 'ajustes' && !productId ? 'on' : ''}`} onClick={() => nav.go('ajustes')} aria-label="Ajustes">
          ⚙️
        </button>
      </header>
      {sync.needsDbUpdate && (
        <div className="dbwarn">Falta un paso en Supabase para guardar notas y la lista del mercado en la nube (ver mensaje de configuración). Mientras tanto se guardan en este celular.</div>
      )}
      <main>{screen}</main>
      <nav className="tabbar">
        {TABS.map((t) => {
          const badge = t.id === 'notas' ? pendingNotes : t.id === 'mercado' ? pendingList : 0;
          return (
            <button key={t.id} className={tab === t.id && !productId ? 'on' : ''} onClick={() => nav.go(t.id)}>
              <span className="ti">
                {t.icon}
                {badge > 0 && <span className="badgenum">{badge}</span>}
              </span>
              <span className="tl">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
