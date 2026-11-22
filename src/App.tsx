import { useState } from 'react';
import { useStore } from './state/store';
import Home from './screens/Home';
import Inventory from './screens/Inventory';
import LogUse from './screens/LogUse';
import Receipts from './screens/Receipts';
import Market from './screens/Market';
import Settings from './screens/Settings';
import ProductDetail from './screens/ProductDetail';

export type Tab = 'inicio' | 'inventario' | 'anotar' | 'facturas' | 'mercado' | 'ajustes';

export interface Nav {
  go: (t: Tab) => void;
  openProduct: (id: string) => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'inventario', label: 'Qué hay', icon: '📦' },
  { id: 'anotar', label: 'Anotar', icon: '✏️' },
  { id: 'facturas', label: 'Facturas', icon: '🧾' },
  { id: 'mercado', label: 'Mercado', icon: '🛒' },
];

function WhoAmI() {
  const { state, setUser } = useStore();
  return (
    <div className="screen whoami">
      <h1>¿Quién eres?</h1>
      <p className="muted">Así la app sabe quién anota cada cosa. Se pregunta una sola vez en este celular.</p>
      <div className="grid2">
        {state.people
          .filter((p) => p.active && p.type !== 'bebe')
          .map((p) => (
            <button key={p.id} className="big" onClick={() => setUser(p.id)}>
              {p.name}
            </button>
          ))}
      </div>
      <p className="muted small">Los nombres se cambian en Ajustes → Personas.</p>
    </div>
  );
}

export default function App() {
  const { state, user, setUser } = useStore();
  const [tab, setTab] = useState<Tab>('inicio');
  const [productId, setProductId] = useState<string | null>(null);

  const me = state.people.find((p) => p.id === user);
  if (!me) return <WhoAmI />;

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
  else screen = <Settings nav={nav} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => nav.go('inicio')}>
          Despensa
        </div>
        <button className="chip" onClick={() => setUser(null)} title="Cambiar persona">
          👤 {me.name}
        </button>
        <button className={`icon ${tab === 'ajustes' && !productId ? 'on' : ''}`} onClick={() => nav.go('ajustes')} aria-label="Ajustes">
          ⚙️
        </button>
      </header>
      <main>{screen}</main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id && !productId ? 'on' : ''} onClick={() => nav.go(t.id)}>
            <span className="ti">{t.icon}</span>
            <span className="tl">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
