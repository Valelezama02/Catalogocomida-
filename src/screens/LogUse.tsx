import { useState } from 'react';
import type { Nav } from '../App';
import { ProductPicker, QtyField } from '../components';
import { fmtDate } from '../domain/dates';
import { fmtQty } from '../domain/format';
import type { MovementType } from '../domain/types';
import { useStore } from '../state/store';

type Mode = 'uso' | 'conteo' | 'descarte';

const MODES: { id: Mode; label: string; help: string }[] = [
  { id: 'uso', label: 'Usé', help: 'Lo que se cocinó o se gastó. Se descuenta de una vez.' },
  { id: 'conteo', label: 'Hay ahora', help: 'Cuánto hay en este momento (más o menos). Corrige el inventario.' },
  { id: 'descarte', label: 'Se dañó', help: 'Lo que se botó. Sirve para comprar menos de eso.' },
];

export const MOVE_LABEL: Record<MovementType, string> = { compra: 'Compra', uso: 'Se usó', descarte: 'Se dañó', conteo: 'Había', congelar: 'Se congeló' };

export function ActionForm({ productId, mode, onSaved }: { productId: string; mode: MovementType; onSaved?: () => void }) {
  const { state, addMovements, today } = useStore();
  const p = state.products.find((x) => x.id === productId)!;
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(today);
  const n = Number(qty);
  const ok = qty !== '' && !isNaN(n) && (mode === 'conteo' ? n >= 0 : n > 0);
  return (
    <div className="actionform">
      <QtyField product={p} value={qty} onChange={setQty} />
      <label className="field">
        <span>Fecha</span>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
      </label>
      <button
        className="primary wide"
        disabled={!ok}
        onClick={() => {
          addMovements([{ productId, type: mode, qty: n, date }]);
          setQty('');
          onSaved?.();
        }}
      >
        Guardar
      </button>
    </div>
  );
}

export default function LogUse({ nav }: { nav: Nav }) {
  const { state, update } = useStore();
  const [mode, setMode] = useState<Mode>('uso');
  const [pid, setPid] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const product = state.products.find((p) => p.id === pid);
  const recent = [...state.movements]
    .filter((m) => m.type !== 'compra')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 15);

  return (
    <div className="screen">
      <h1>Anotar</h1>
      <div className="seg">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? 'on' : ''}
            onClick={() => {
              setMode(m.id);
              setPid(null);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {MODES.find((m) => m.id === mode)!.help}
        {mode === 'uso' && ' Lo de aseo, despensa y de Gracia no hace falta anotarlo: se descuenta solo.'}
      </p>

      {saved && <div className="toast">✓ {saved}</div>}

      {product ? (
        <div className="card">
          <div className="cardhead">
            <h2>
              {MODES.find((m) => m.id === mode)!.label}: {product.name}
            </h2>
            <button className="link" onClick={() => setPid(null)}>
              Cambiar
            </button>
          </div>
          <ActionForm
            productId={product.id}
            mode={mode}
            onSaved={() => {
              setSaved(`${product.name} anotado`);
              setPid(null);
              setTimeout(() => setSaved(null), 2500);
            }}
          />
        </div>
      ) : (
        <ProductPicker onPick={setPid} filter={mode === 'uso' ? (p) => !p.auto : undefined} />
      )}

      {recent.length > 0 && (
        <>
          <div className="group">Últimos anotados</div>
          <ul className="history">
            {recent.map((m) => {
              const p = state.products.find((x) => x.id === m.productId);
              if (!p) return null;
              return (
                <li key={m.id}>
                  <span onClick={() => nav.openProduct(p.id)}>
                    <b>{MOVE_LABEL[m.type]}</b> {fmtQty(m.qty, p)} de {p.name}
                    <span className="muted small"> · {fmtDate(m.date)}</span>
                  </span>
                  <button className="link danger" onClick={() => update((s) => ({ ...s, movements: s.movements.filter((x) => x.id !== m.id) }))}>
                    Deshacer
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
