import { useState } from 'react';
import { useFamily } from './state/family';
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
  const { state, setUser, cloud } = useStore();
  const fam = useFamily();
  const takenBy = (pid: string) => fam?.members.find((m) => m.person_id === pid && m.user_id !== fam.session.user.id)?.display_name;
  return (
    <div className="screen whoami">
      <h1>¿Quién eres en la casa?</h1>
      <p className="muted">
        {cloud
          ? 'Elige tu perfil. Así la app sabe quién anota cada cosa y cuenta bien tus días y comidas.'
          : 'Así la app sabe quién anota cada cosa. Se pregunta una sola vez en este celular.'}
      </p>
      <div className="grid2">
        {state.people
          .filter((p) => p.active && p.type !== 'bebe')
          .map((p) => (
            <button key={p.id} className="big" onClick={() => setUser(p.id)}>
              {p.name}
              {takenBy(p.id) && <div className="muted small">ya lo eligió {takenBy(p.id)}</div>}
            </button>
          ))}
      </div>
      <p className="muted small">
        {state.people.length === 0 ? 'Todavía no hay perfiles en esta familia.' : 'Los nombres se cambian en Ajustes → Personas.'}
      </p>
    </div>
  );
}

const SYNC_LABEL: Record<string, string> = { cargando: 'Cargando…', ok: 'Al día', subiendo: 'Guardando…', 'sin-conexion': 'Sin conexión: se guarda al volver' };

export default function App() {
  const { state, user, setUser, cloud, sync } = useStore();
  const [tab, setTab] = useState<Tab>('inicio');
  const [productId, setProductId] = useState<string | null>(null);

  if (!sync.ready)
    return (
      <div className="screen whoami center">
        <div className="brand big-brand">Despensa</div>
        <p className="muted">{sync.status === 'sin-conexion' ? 'No hay conexión. Conéctate a internet para bajar los datos de la familia.' : 'Bajando los datos de la familia…'}</p>
      </div>
    );

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
        {cloud && <span className={`dot ${sync.status}`} title={SYNC_LABEL[sync.status]} onClick={() => sync.syncNow()} />}
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
