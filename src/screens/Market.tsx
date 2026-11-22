import { useMemo, useState } from 'react';
import type { Nav } from '../App';
import { addDays, diffDays, fmtDate } from '../domain/dates';
import { buildShoppingList } from '../domain/engine';
import { fmtQty } from '../domain/format';
import { CATEGORIES, type QuincenaPlan } from '../domain/types';
import { uid, useStore } from '../state/store';

export default function Market({ nav }: { nav: Nav }) {
  const { state } = useStore();
  const next = state.settings.nextMarket;
  const plan = [...state.plans].filter((p) => p.start === next).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const [editing, setEditing] = useState(false);

  if (!plan || editing) return <Questionnaire existing={plan} onDone={() => setEditing(false)} />;
  return <ShoppingList plan={plan} onEdit={() => setEditing(true)} nav={nav} />;
}

const SUNDAY_OPTS = [
  { v: 0, label: 'Comemos en casa' },
  { v: 0.5, label: 'A veces salimos o pedimos' },
  { v: 1, label: 'Siempre salimos o pedimos' },
];

function Questionnaire({ existing, onDone }: { existing?: QuincenaPlan; onDone: () => void }) {
  const { state, update } = useStore();
  const [start, setStart] = useState(existing?.start ?? state.settings.nextMarket);
  const [end, setEnd] = useState(existing?.end ?? addDays(state.settings.nextMarket, state.settings.quincenaDays));
  const [absent, setAbsent] = useState<Record<string, number>>(existing?.absentDays ?? {});
  const [sundayOut, setSundayOut] = useState(existing?.sundayOut ?? state.settings.sundayOut);
  const [meals, setMeals] = useState(existing?.meals ?? { desayuno: true, almuerzo: true, cena: true });
  const [guests, setGuests] = useState(existing?.guestMeals ?? 0);
  const days = Math.max(1, diffDays(start, end));

  const save = () => {
    const plan: QuincenaPlan = { id: existing?.id ?? uid(), start, end, absentDays: absent, sundayOut, meals, guestMeals: guests, createdAt: new Date().toISOString() };
    update((s) => ({ ...s, settings: { ...s.settings, nextMarket: start }, plans: [...s.plans.filter((p) => p.id !== plan.id), plan] }));
    onDone();
  };

  return (
    <div className="screen">
      <h1>Antes de hacer la lista</h1>
      <p className="muted">Responde estas preguntas para esta quincena. Con eso la app calcula cuánto comprar.</p>

      <div className="card form">
        <h2>1. ¿Cuándo?</h2>
        <div className="row2">
          <label className="field">
            <span>Día del mercado</span>
            <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Próximo mercado</span>
            <input type="date" value={end} min={addDays(start, 1)} onChange={(e) => e.target.value && setEnd(e.target.value)} />
          </label>
        </div>
        <p className="muted small">Son {days} días.</p>
      </div>

      <div className="card form">
        <h2>2. ¿Quiénes van a estar?</h2>
        <p className="muted small">Si alguien viaja o no viene algunos días, escribe cuántos días no va a estar.</p>
        <ul className="countlist">
          {state.people
            .filter((p) => p.active)
            .map((p) => (
              <li key={p.id}>
                <div>
                  <div className="name">{p.name}</div>
                  <div className="muted small">{p.type === 'empleada' ? 'Desayuno y almuerzo' : p.type === 'bebe' ? 'Menú propio' : 'Todas las comidas'}</div>
                </div>
                <label className="inline">
                  <input type="number" inputMode="numeric" min="0" max={days} value={absent[p.id] ?? 0} onChange={(e) => setAbsent({ ...absent, [p.id]: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="muted small">días fuera</span>
                </label>
              </li>
            ))}
        </ul>
      </div>

      <div className="card form">
        <h2>3. ¿Qué comidas se hacen en casa?</h2>
        <div className="chips">
          {(['desayuno', 'almuerzo', 'cena'] as const).map((m) => (
            <button key={m} className={`chip ${meals[m] ? 'on' : ''}`} onClick={() => setMeals({ ...meals, [m]: !meals[m] })}>
              {meals[m] ? '✓ ' : ''}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <p className="muted small">La cena es lo mismo que el almuerzo, así que se cocina una sola vez al día.</p>
      </div>

      <div className="card form">
        <h2>4. ¿Y los domingos?</h2>
        <div className="seg vertical">
          {SUNDAY_OPTS.map((o) => (
            <button key={o.v} className={sundayOut === o.v ? 'on' : ''} onClick={() => setSundayOut(o.v)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="muted small">“A veces” cuenta medio domingo, para no quedarse cortos.</p>
      </div>

      <div className="card form">
        <h2>5. ¿Visitas?</h2>
        <label className="field">
          <span>Comidas extra para invitados en toda la quincena (ej. 4 invitados a un almuerzo = 4)</span>
          <input type="number" inputMode="numeric" min="0" value={guests} onChange={(e) => setGuests(Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </div>

      <div className="sticky">
        <button className="primary wide" onClick={save}>
          Generar lista del mercado
        </button>
        {existing && (
          <button className="link wide" onClick={onDone}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function ShoppingList({ plan, onEdit, nav }: { plan: QuincenaPlan; onEdit: () => void; nav: Nav }) {
  const { state, statuses, today, calc, update } = useStore();
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => buildShoppingList(state, statuses, plan, today, calc, fmtQty, fmtDate), [state, statuses, plan, today, calc]);
  const toBuy = items.filter((i) => i.packages > 0);
  const enough = items.filter((i) => i.packages === 0 && i.need > 0);
  const key = (id: string) => `${plan.id}:${id}`;
  const done = toBuy.filter((i) => state.checked[key(i.product.id)]).length;
  const toFreeze = toBuy.filter((i) => i.freeze > 0);

  const toggle = (id: string) => update((s) => ({ ...s, checked: { ...s.checked, [key(id)]: !s.checked[key(id)] } }));

  const finish = () => {
    if (!confirm('¿Terminaste el mercado? Ahora registra la factura para cargar lo que se compró.')) return;
    update((s) => ({ ...s, settings: { ...s.settings, nextMarket: plan.end } }));
    nav.go('facturas');
  };

  const share = async () => {
    const lines: string[] = [`Mercado ${fmtDate(plan.start)}`];
    for (const c of CATEGORIES) {
      const its = toBuy.filter((i) => i.product.category === c);
      if (!its.length) continue;
      lines.push('', `*${c}*`);
      for (const i of its) lines.push(`- ${i.product.name}: ${i.packages} × ${i.product.packageLabel}`);
    }
    const text = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        alert('Lista copiada.');
      }
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="screen">
      <div className="row between">
        <h1>Lista del mercado</h1>
        <button className="secondary" onClick={onEdit}>
          Cambiar respuestas
        </button>
      </div>
      <p className="muted small">
        Para {fmtDate(plan.start)} → {fmtDate(plan.end)} ({diffDays(plan.start, plan.end)} días + colchón). {done}/{toBuy.length} en el carrito.
      </p>

      {toFreeze.length > 0 && (
        <div className="card infobox">
          <b>❄️ Al llegar del mercado, congelar:</b>
          <ul>
            {toFreeze.map((i) => (
              <li key={i.product.id}>
                {i.product.name}: ≈{fmtQty(i.freeze, i.product)}
              </li>
            ))}
          </ul>
          <span className="muted small">Así dura toda la quincena sin volver a comprar.</span>
        </div>
      )}

      {CATEGORIES.map((c) => {
        const its = toBuy.filter((i) => i.product.category === c);
        if (!its.length) return null;
        return (
          <div key={c}>
            <div className="group">{c}</div>
            <ul className="shop">
              {its.map((i) => {
                const on = !!state.checked[key(i.product.id)];
                return (
                  <li key={i.product.id} className={on ? 'done' : ''} onClick={() => toggle(i.product.id)}>
                    <span className={`check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
                    <div className="grow">
                      <div className="name">
                        {i.product.name} <b>· {i.packages} × {i.product.packageLabel}</b>
                      </div>
                      <div className="muted small">
                        Se van a usar ≈{fmtQty(i.need, i.product)} · hay {fmtQty(i.have, i.product)} · comprar ≈{fmtQty(i.buy, i.product)}
                      </div>
                      {i.notes.map((n, k) => (
                        <div key={k} className="note">
                          {n}
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <button className="link" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Ocultar' : 'Ver'} lo que ya alcanza ({enough.length})
      </button>
      {showAll && (
        <ul className="history">
          {enough.map((i) => (
            <li key={i.product.id}>
              <span>
                {i.product.name} <span className="muted small">· hay {fmtQty(i.have, i.product)}, se usan ≈{fmtQty(i.need, i.product)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky">
        <div className="actions2">
          <button className="secondary" onClick={share}>
            Compartir lista
          </button>
          <button className="primary" onClick={finish}>
            Terminé el mercado
          </button>
        </div>
      </div>
    </div>
  );
}
