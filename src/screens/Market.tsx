import { useMemo, useState } from 'react';
import type { Nav } from '../App';
import { addDays, diffDays, fmtDate } from '../domain/dates';
import { buildShoppingList, type ShoppingItem } from '../domain/engine';
import { fmtQty } from '../domain/format';
import { normalize } from '../domain/receipt';
import { CATEGORIES, type ListItem, type Product, type QuincenaPlan } from '../domain/types';
import { uid, useStore } from '../state/store';

/** Cómo se muestra la cantidad de algo en la lista. */
function listQty(item: ListItem, p?: Product): string {
  if (!p) return item.qtyText ?? '';
  const q = item.qty ?? p.packageSize;
  if (p.unit === 'und' && p.packageSize > 1) {
    const packs = Math.round((q / p.packageSize) * 2) / 2;
    return `${packs.toLocaleString('es-CO')} × ${p.packageLabel}`;
  }
  return fmtQty(q, p);
}

export default function Market({ nav }: { nav: Nav }) {
  const { state, statuses, today, calc, update, author } = useStore();
  const [showPlan, setShowPlan] = useState(false);
  const [showSug, setShowSug] = useState(false);
  const next = state.settings.nextMarket;
  const byId = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products]);

  const plan: QuincenaPlan = useMemo(() => {
    const saved = [...state.plans].filter((p) => p.start === next).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return (
      saved ?? {
        id: 'auto',
        start: next,
        end: addDays(next, state.settings.quincenaDays),
        absentDays: {},
        sundayOut: state.settings.sundayOut,
        meals: { desayuno: true, almuerzo: true, cena: true },
        guestMeals: 0,
        createdAt: '',
      }
    );
  }, [state.plans, state.settings, next]);

  const suggestions = useMemo(() => buildShoppingList(state, statuses, plan, today, calc, fmtQty, fmtDate), [state, statuses, plan, today, calc]);
  const inList = new Set(state.list.filter((i) => !i.checked && i.productId).map((i) => i.productId));
  const sug = suggestions.filter((s) => s.packages > 0 && !inList.has(s.product.id));

  const list = state.list;
  const pending = list.filter((i) => !i.checked).length;

  const addItems = (items: ListItem[]) => update((s) => ({ ...s, list: [...s.list, ...items] }));
  const setItem = (id: string, patch: Partial<ListItem>) => update((s) => ({ ...s, list: s.list.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id: string) => update((s) => ({ ...s, list: s.list.filter((i) => i.id !== id) }));

  const fromSuggestion = (s: ShoppingItem): ListItem => ({
    id: uid(),
    productId: s.product.id,
    text: s.product.name,
    qty: s.packages * s.product.packageSize,
    note: s.notes.length ? s.notes.join(' ') : undefined,
    by: 'Sugerido por la app',
    checked: false,
    createdAt: new Date().toISOString(),
  });

  const finish = () => {
    const bought = list.filter((i) => i.checked).length;
    if (!confirm(`¿Terminaron el mercado? Se quitan de la lista las ${bought} cosas marcadas como compradas; lo que no se consiguió queda para la próxima. Después registra la factura.`)) return;
    update((s) => ({ ...s, list: s.list.filter((i) => !i.checked), settings: { ...s.settings, nextMarket: plan.end } }));
    nav.go('facturas');
  };

  const share = async () => {
    const lines: string[] = [`🛒 Mercado ${fmtDate(next)}`];
    for (const c of [...CATEGORIES]) {
      const its = list.filter((i) => !i.checked && (i.productId ? byId.get(i.productId)?.category : 'Otros') === c);
      if (!its.length) continue;
      lines.push('', `*${c}*`);
      for (const i of its) lines.push(`- ${i.text}${listQty(i, i.productId ? byId.get(i.productId) : undefined) ? `: ${listQty(i, i.productId ? byId.get(i.productId) : undefined)}` : ''}${i.note && i.by !== 'Sugerido por la app' ? ` (${i.note})` : ''}`);
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
      <h1>Lista del mercado</h1>
      <p className="muted small">
        Mercado del {fmtDate(next)} ({diffDays(today, next) > 0 ? `en ${diffDays(today, next)} días` : 'hoy'}).{' '}
        <button className="link" onClick={() => nav.go('ajustes')}>
          Cambiar fecha
        </button>
      </p>

      <AddForm author={author} onAdd={(i) => addItems([i])} />

      {pending === 0 && list.length === 0 ? (
        <p className="muted center">La lista está vacía. Agrega lo que haga falta, o usa las sugerencias de abajo.</p>
      ) : (
        [...CATEGORIES].map((c) => {
          const its = list.filter((i) => (i.productId ? byId.get(i.productId)?.category ?? 'Otros' : 'Otros') === c);
          if (!its.length) return null;
          return (
            <div key={c}>
              <div className="group">{c}</div>
              <ul className="shop">
                {its.map((i) => {
                  const p = i.productId ? byId.get(i.productId) : undefined;
                  const step = p ? p.packageSize : 0;
                  return (
                    <li key={i.id} className={i.checked ? 'done' : ''}>
                      <button className={`check ${i.checked ? 'on' : ''}`} onClick={() => setItem(i.id, { checked: !i.checked })} aria-label="Comprado">
                        {i.checked ? '✓' : ''}
                      </button>
                      <div className="grow">
                        <div className="name">
                          {i.text} {listQty(i, p) && <b>· {listQty(i, p)}</b>}
                        </div>
                        {i.note && <div className="note">{i.note}</div>}
                        {i.by && <div className="muted small">{i.by === 'Sugerido por la app' ? '💡 sugerido por la app' : `pidió ${i.by}`}</div>}
                      </div>
                      {p && !i.checked && (
                        <div className="stepper">
                          <button onClick={() => setItem(i.id, { qty: Math.max(step, (i.qty ?? step) - step) })}>−</button>
                          <button onClick={() => setItem(i.id, { qty: (i.qty ?? step) + step })}>+</button>
                        </div>
                      )}
                      <button className="link danger" onClick={() => removeItem(i.id)} aria-label="Quitar">
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}

      <div className="card">
        <div className="cardhead">
          <h2>💡 La app sugiere ({sug.length})</h2>
          <button className="link" onClick={() => setShowSug(!showSug)}>
            {showSug ? 'Ocultar' : 'Ver sugerencias'}
          </button>
        </div>
        <p className="muted small">
          Cálculo aproximado de lo que se va a necesitar hasta el {fmtDate(plan.end)}, según lo que hay y quiénes van a estar.{' '}
          <button className="link" onClick={() => setShowPlan(!showPlan)}>
            {showPlan ? 'Cerrar' : '¿Quiénes van a estar?'}
          </button>
        </p>
        {showPlan && <PlanForm plan={plan} onDone={() => setShowPlan(false)} />}
        {showSug && sug.length > 0 && (
          <>
            <button className="secondary wide" onClick={() => addItems(sug.map(fromSuggestion))}>
              Agregar todas a la lista
            </button>
            {[...CATEGORIES].map((c) => {
              const its = sug.filter((x) => x.product.category === c);
              if (!its.length) return null;
              return (
                <div key={c}>
                  <div className="group">{c}</div>
                  <ul className="sug">
                    {its.map((s) => (
                      <li key={s.product.id}>
                        <div className="grow">
                          <div className="name">
                            {s.product.name} <b>· {listQty({ id: '', text: '', checked: false, createdAt: '', qty: s.packages * s.product.packageSize }, s.product)}</b>
                          </div>
                          <div className="muted small">
                            Quedan ≈{fmtQty(s.have, s.product)} · en la quincena se usan ≈{fmtQty(s.need, s.product)}
                          </div>
                          {s.notes.map((n, k) => (
                            <div key={k} className="muted small">
                              ℹ️ {n}
                            </div>
                          ))}
                        </div>
                        <button className="chip" onClick={() => addItems([fromSuggestion(s)])}>
                          + Agregar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
        {showSug && sug.length === 0 && <p className="muted small">Nada más por sugerir. 👍</p>}
      </div>

      <div className="sticky">
        <div className="actions2">
          <button className="secondary" onClick={share} disabled={!pending}>
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

function AddForm({ author, onAdd }: { author?: string; onAdd: (i: ListItem) => void }) {
  const { state } = useStore();
  const [text, setText] = useState('');
  const [pid, setPid] = useState<string | null>(null);
  const [packs, setPacks] = useState(1);
  const [qtyText, setQtyText] = useState('');
  const [note, setNote] = useState('');
  const p = pid ? state.products.find((x) => x.id === pid) : undefined;

  const matches = useMemo(() => {
    const q = normalize(text);
    if (!q || p) return [];
    return state.products
      .filter((x) => x.active && normalize([x.name, ...x.keywords].join(' ')).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .slice(0, 6);
  }, [text, p, state.products]);

  const reset = () => {
    setText('');
    setPid(null);
    setPacks(1);
    setQtyText('');
    setNote('');
  };

  const submit = () => {
    const name = p ? p.name : text.trim();
    if (!name) return;
    onAdd({
      id: uid(),
      productId: p?.id,
      text: name,
      qty: p ? packs * p.packageSize : undefined,
      qtyText: p ? undefined : qtyText.trim() || undefined,
      note: note.trim() || undefined,
      by: author,
      checked: false,
      createdAt: new Date().toISOString(),
    });
    reset();
  };

  const packWord = p ? (p.unit === 'und' && p.packageSize === 1 ? fmtQty(packs, p) : p.unit === 'g' ? fmtQty(packs * p.packageSize, p) : `${packs} × ${p.packageLabel}`) : '';

  return (
    <div className="card form">
      <h2>¿Qué hace falta?</h2>
      {p ? (
        <div className="row between">
          <b>{p.name}</b>
          <button className="link" onClick={reset}>
            Cambiar
          </button>
        </div>
      ) : (
        <input className="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. leche, pañales, bombillo…" />
      )}
      {matches.length > 0 && (
        <div className="chips">
          {matches.map((m) => (
            <button key={m.id} className="chip" onClick={() => setPid(m.id)}>
              {m.name}
            </button>
          ))}
        </div>
      )}
      {p ? (
        <div className="row between">
          <span>Cantidad: {packWord}</span>
          <div className="stepper">
            <button onClick={() => setPacks(Math.max(p.unit === 'und' && p.packageSize === 1 ? 0.5 : 1, packs - (p.unit === 'und' && p.packageSize === 1 && packs <= 1 ? 0.5 : 1)))}>−</button>
            <button onClick={() => setPacks(packs < 1 ? 1 : packs + 1)}>+</button>
          </div>
        </div>
      ) : (
        text.trim() && (
          <label className="field">
            <span>Cantidad (opcional)</span>
            <input value={qtyText} onChange={(e) => setQtyText(e.target.value)} placeholder="ej. 2 paquetes" />
          </label>
        )
      )}
      {(p || text.trim()) && (
        <>
          <label className="field">
            <span>Nota (opcional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. la marca de siempre, talla 5…" />
          </label>
          <button className="primary wide" onClick={submit}>
            Agregar a la lista
          </button>
        </>
      )}
    </div>
  );
}

const SUNDAY_OPTS = [
  { v: 0, label: 'Comemos en casa' },
  { v: 0.5, label: 'A veces salimos o pedimos' },
  { v: 1, label: 'Siempre salimos o pedimos' },
];

function PlanForm({ plan, onDone }: { plan: QuincenaPlan; onDone: () => void }) {
  const { state, update } = useStore();
  const [absent, setAbsent] = useState<Record<string, number>>(plan.absentDays);
  const [sundayOut, setSundayOut] = useState(plan.sundayOut);
  const [guests, setGuests] = useState(plan.guestMeals);
  const days = Math.max(1, diffDays(plan.start, plan.end));

  const save = () => {
    const p: QuincenaPlan = { ...plan, id: plan.id === 'auto' ? uid() : plan.id, absentDays: absent, sundayOut, guestMeals: guests, createdAt: new Date().toISOString() };
    update((s) => ({ ...s, plans: [...s.plans.filter((x) => x.id !== p.id), p] }));
    onDone();
  };

  return (
    <div className="planform">
      <div className="group">Días que alguien no va a estar</div>
      <ul className="countlist">
        {state.people
          .filter((p) => p.active)
          .map((p) => (
            <li key={p.id}>
              <span className="name">{p.name}</span>
              <label className="inline">
                <input type="number" inputMode="numeric" min="0" max={days} value={absent[p.id] ?? 0} onChange={(e) => setAbsent({ ...absent, [p.id]: Math.max(0, Number(e.target.value) || 0) })} />
                <span className="muted small">días</span>
              </label>
            </li>
          ))}
      </ul>
      <div className="group">Domingos</div>
      <div className="seg vertical">
        {SUNDAY_OPTS.map((o) => (
          <button key={o.v} className={sundayOut === o.v ? 'on' : ''} onClick={() => setSundayOut(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Comidas extra para invitados en la quincena</span>
        <input type="number" inputMode="numeric" min="0" value={guests} onChange={(e) => setGuests(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <button className="primary wide" onClick={save}>
        Guardar y recalcular
      </button>
    </div>
  );
}
