import { useState } from 'react';
import { ExpiryBadge, Section } from '../components';
import { fmtDate } from '../domain/dates';
import { describeRule, fmtQty } from '../domain/format';
import { LOCATIONS, type MovementType } from '../domain/types';
import { useStore } from '../state/store';
import { ActionForm, MOVE_LABEL } from './LogUse';
import { ProductEditor } from './ProductEditor';

export default function ProductDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, statuses, today, update } = useStore();
  const p = state.products.find((x) => x.id === id);
  const [mode, setMode] = useState<MovementType | null>(null);
  const [editing, setEditing] = useState(false);
  if (!p) return null;
  const st = statuses[id];
  const hist = state.movements.filter((m) => m.productId === id).sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
  const who = (pid?: string) => state.people.find((x) => x.id === pid)?.name ?? '';
  const loc = (l: string) => LOCATIONS.find((x) => x.id === l)?.label ?? l;

  if (editing) return <ProductEditor product={p} onDone={() => setEditing(false)} />;

  return (
    <div className="screen">
      <button className="link" onClick={onBack}>
        ← Volver
      </button>
      <h1>{p.name}</h1>
      <div className="stats">
        <div>
          <div className="muted small">Hay</div>
          <div className="statnum">{st?.hasData ? fmtQty(st.usableQty, p) : '—'}</div>
        </div>
        <div>
          <div className="muted small">Gasto estimado</div>
          <div className="statnum">{fmtQty(st?.dailyRate ?? 0, p)}/día</div>
        </div>
        <div>
          <div className="muted small">Alcanza hasta</div>
          <div className="statnum">{st?.hasData ? (st.runOut ? fmtDate(st.runOut) : '+2 meses') : '—'}</div>
        </div>
      </div>
      <p className="muted small">
        Regla: {describeRule(p)}.
        {st && Math.abs(st.calibration - 1) > 0.05 && ` Ajustada con los conteos: la casa gasta ${Math.round(st.calibration * 100)}% de lo que dice la regla.`}
        {st?.lastCount && ` Último conteo: ${fmtDate(st.lastCount)}.`}
      </p>

      <div className="seg">
        {(['uso', 'descarte', 'conteo', ...(p.freezerDays ? ['congelar'] : [])] as MovementType[]).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(mode === m ? null : m)}>
            {m === 'uso' ? 'Usé' : m === 'descarte' ? 'Se dañó' : m === 'conteo' ? 'Conté' : 'Congelé'}
          </button>
        ))}
      </div>
      {mode && (
        <div className="card">
          <ActionForm productId={id} mode={mode} onSaved={() => setMode(null)} />
        </div>
      )}

      {st && st.lots.length > 0 && (
        <Section title="Lotes y vencimientos">
          <ul className="lots">
            {st.lots.map((l, i) => (
              <li key={i}>
                <span>
                  {fmtQty(l.qty, p)} · {loc(l.location)} <span className="muted small">(comprado {fmtDate(l.purchased)})</span>
                </span>
                <ExpiryBadge expiry={l.expiry} today={today} />
              </li>
            ))}
          </ul>
          <p className="muted small">Para cambiar una fecha de vencimiento, edita la compra en Facturas.</p>
        </Section>
      )}

      <Section title="Historial">
        {hist.length === 0 ? (
          <p className="muted">Sin movimientos.</p>
        ) : (
          <ul className="history">
            {hist.slice(0, 40).map((m) => (
              <li key={m.id}>
                <span>
                  <b>{MOVE_LABEL[m.type]}</b> {fmtQty(m.qty, p)}
                  <span className="muted small">
                    {' '}
                    · {fmtDate(m.date)} {who(m.by) && `· ${who(m.by)}`}
                  </span>
                </span>
                {m.type !== 'compra' && (
                  <button className="link danger" onClick={() => update((s) => ({ ...s, movements: s.movements.filter((x) => x.id !== m.id) }))}>
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <button className="secondary wide" onClick={() => setEditing(true)}>
        Editar producto
      </button>
    </div>
  );
}
