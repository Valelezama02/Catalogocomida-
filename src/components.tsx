import { useMemo, useState } from 'react';
import { diffDays, fmtDate } from './domain/dates';
import { fmtQty, quickAmounts, unitWord } from './domain/format';
import { normalize } from './domain/receipt';
import { CATEGORIES, type Product } from './domain/types';
import { useStore } from './state/store';

export function ProductPicker({ onPick, filter }: { onPick: (id: string) => void; filter?: (p: Product) => boolean }) {
  const { state, statuses } = useStore();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const nq = normalize(q);
    return state.products
      .filter((p) => p.active && (!filter || filter(p)))
      .filter((p) => !nq || normalize([p.name, ...p.keywords].join(' ')).includes(nq))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [state.products, q, filter]);

  return (
    <div className="picker">
      <input className="search" placeholder="Buscar producto… (ej. huevos)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {CATEGORIES.map((cat) => {
        const items = list.filter((p) => p.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="group">{cat}</div>
            <div className="pickgrid">
              {items.map((p) => (
                <button key={p.id} className="pick" onClick={() => onPick(p.id)}>
                  <span>{p.name}</span>
                  <span className="muted small">{statuses[p.id]?.hasData ? `hay ≈${fmtQty(statuses[p.id].usableQty, p)}` : 'sin datos'}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!list.length && <p className="muted">No hay productos con ese nombre. Puedes crearlo en Ajustes → Productos.</p>}
    </div>
  );
}

export function QtyField({ product, value, onChange }: { product: Product; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="chips">
        {quickAmounts(product).map((a) => (
          <button key={a} className={`chip ${Number(value) === a ? 'on' : ''}`} onClick={() => onChange(String(a))}>
            {fmtQty(a, product)}
          </button>
        ))}
        {product.packageSize > 1 && (
          <button className="chip" onClick={() => onChange(String(product.packageSize))}>
            1 {product.packageLabel}
          </button>
        )}
      </div>
      <label className="field">
        <span>Cantidad en {unitWord(product)}</span>
        <input type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function ExpiryBadge({ expiry, today }: { expiry: string; today: string }) {
  const d = diffDays(today, expiry);
  const cls = d < 0 ? 'bad' : d <= 2 ? 'warn' : d <= 5 ? 'soon' : 'ok';
  const text = d < 0 ? `venció ${fmtDate(expiry)}` : d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : `vence ${fmtDate(expiry)}`;
  return <span className={`badge ${cls}`}>{text}</span>;
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="cardhead">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
