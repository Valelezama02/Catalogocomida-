import { useMemo, useState } from 'react';
import type { Nav } from '../App';
import { ExpiryBadge } from '../components';
import { fmtDate } from '../domain/dates';
import { fmtQty, UNIT_LABEL } from '../domain/format';
import { normalize } from '../domain/receipt';
import { CATEGORIES } from '../domain/types';
import { useStore } from '../state/store';

export default function Inventory({ nav }: { nav: Nav }) {
  const { state, statuses, today } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [counting, setCounting] = useState(false);

  const list = useMemo(() => {
    const nq = normalize(q);
    return state.products
      .filter((p) => p.active && (!cat || p.category === cat))
      .filter((p) => !nq || normalize([p.name, ...p.keywords].join(' ')).includes(nq))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [state.products, q, cat]);

  if (counting) return <QuickCount onDone={() => setCounting(false)} />;

  return (
    <div className="screen">
      <div className="row between">
        <h1>Qué hay</h1>
        <button className="secondary" onClick={() => setCounting(true)}>
          Conteo rápido
        </button>
      </div>
      <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll">
        <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>
          Todo
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      {CATEGORIES.filter((c) => !cat || c === cat).map((c) => {
        const items = list.filter((p) => p.category === c);
        if (!items.length) return null;
        return (
          <div key={c}>
            <div className="group">{c}</div>
            <ul className="inv">
              {items.map((p) => {
                const st = statuses[p.id];
                const firstLot = st?.lots.find((l) => l.qty > 0);
                return (
                  <li key={p.id} onClick={() => nav.openProduct(p.id)}>
                    <div>
                      <div className="name">{p.name}</div>
                      <div className="muted small">
                        {!st?.hasData
                          ? 'Sin datos todavía'
                          : st.runOut
                            ? `Alcanza hasta ~${fmtDate(st.runOut)}`
                            : p.rule.type === 'manual'
                              ? 'Solo lo anotado'
                              : 'Alcanza más de 2 meses'}
                      </div>
                    </div>
                    <div className="right">
                      <div className={`qty ${st?.hasData && st.usableQty <= 0 ? 'zero' : ''}`}>{st?.hasData ? fmtQty(st.usableQty, p) : '—'}</div>
                      {firstLot && p.shelfLifeDays < 60 && <ExpiryBadge expiry={firstLot.expiry} today={today} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function QuickCount({ onDone }: { onDone: () => void }) {
  const { state, statuses, addMovements, today } = useStore();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const filled = Object.entries(vals).filter(([, v]) => v !== '' && !isNaN(Number(v)));

  const save = () => {
    addMovements(filled.map(([productId, v]) => ({ productId, type: 'conteo' as const, qty: Number(v), date: today })));
    onDone();
  };

  return (
    <div className="screen">
      <div className="row between">
        <h1>Conteo rápido</h1>
        <button className="secondary" onClick={onDone}>
          Cancelar
        </button>
      </div>
      <p className="muted">
        Escribe cuánto hay <b>ahora</b> de cada cosa (deja vacío lo que no quieras contar). Si no hay nada, pon 0. Cada conteo hace que la app aprenda cuánto gasta la casa de verdad.
      </p>
      <div className="chips scroll">
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <ul className="countlist">
        {state.products
          .filter((p) => p.active && p.category === cat)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((p) => (
            <li key={p.id}>
              <div>
                <div className="name">{p.name}</div>
                <div className="muted small">
                  en {UNIT_LABEL[p.unit]} · 1 {p.packageLabel} = {fmtQty(p.packageSize, p)}
                  {statuses[p.id]?.hasData ? ` · la app cree que hay ${fmtQty(statuses[p.id].qty, p)}` : ''}
                </div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="—"
                value={vals[p.id] ?? ''}
                onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })}
              />
            </li>
          ))}
      </ul>
      <div className="sticky">
        <button className="primary wide" disabled={!filled.length} onClick={save}>
          Guardar {filled.length} conteo{filled.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}
