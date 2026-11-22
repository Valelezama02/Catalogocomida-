import { useRef, useState } from 'react';
import type { Nav } from '../App';
import { Section } from '../components';
import { WEEKDAYS_SHORT } from '../domain/dates';
import { describeRule } from '../domain/format';
import { CATEGORIES, type AppState, type Person, type PersonType } from '../domain/types';
import { exportJSON, resetState, uid, useStore } from '../state/store';
import { newProduct, ProductEditor } from './ProductEditor';

const TYPE_LABEL: Record<PersonType, string> = { residente: 'Vive en la casa', empleada: 'Viene a trabajar', bebe: 'Bebé' };

export default function Settings({ nav }: { nav: Nav }) {
  const { state, update } = useStore();
  const [editProduct, setEditProduct] = useState<string | null>(null);
  const [newP, setNewP] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (newP) return <ProductEditor product={newProduct()} onDone={() => setNewP(false)} />;
  const ep = state.products.find((p) => p.id === editProduct);
  if (ep) return <ProductEditor product={ep} onDone={() => setEditProduct(null)} />;

  const setPerson = (id: string, patch: Partial<Person>) => update((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const s = JSON.parse(await f.text()) as AppState;
      if (s.version !== 1 || !Array.isArray(s.products)) throw new Error('formato');
      if (confirm('Esto reemplaza todos los datos de este celular. ¿Continuar?')) update(() => s);
    } catch {
      alert('El archivo no es una copia válida.');
    }
  };

  const download = () => {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `despensa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="screen">
      <h1>Ajustes</h1>

      <Section title="Personas de la casa">
        <p className="muted small">Días en la casa y comidas. Con esto se calcula cuánto se gasta.</p>
        {state.people
          .filter((p) => p.active)
          .map((p) => (
            <div key={p.id} className="person">
              <div className="row2">
                <label className="field">
                  <span>Nombre</span>
                  <input value={p.name} onChange={(e) => setPerson(p.id, { name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Tipo</span>
                  <select value={p.type} onChange={(e) => setPerson(p.id, { type: e.target.value as PersonType })}>
                    {(Object.keys(TYPE_LABEL) as PersonType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="chips">
                {WEEKDAYS_SHORT.map((d, i) => {
                  const on = p.days.includes(i);
                  return (
                    <button key={i} className={`chip day ${on ? 'on' : ''}`} onClick={() => setPerson(p.id, { days: on ? p.days.filter((x) => x !== i) : [...p.days, i].sort() })}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="chips">
                {(['desayuno', 'almuerzo', 'cena'] as const).map((m) => (
                  <button key={m} className={`chip ${p.meals[m] ? 'on' : ''}`} onClick={() => setPerson(p.id, { meals: { ...p.meals, [m]: !p.meals[m] } })}>
                    {p.meals[m] ? '✓ ' : ''}
                    {m}
                  </button>
                ))}
              </div>
              <div className="row2">
                <label className="field">
                  <span>Tamaño de porción (1 = adulto)</span>
                  <input type="number" step="0.1" inputMode="decimal" value={p.portionFactor} onChange={(e) => setPerson(p.id, { portionFactor: Number(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span>Aseo personal (1 = todo el día)</span>
                  <input type="number" step="0.1" inputMode="decimal" value={p.personalFactor} onChange={(e) => setPerson(p.id, { personalFactor: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <button
                className="link danger"
                onClick={() => {
                  if (confirm(`¿Quitar a ${p.name}?`)) setPerson(p.id, { active: false });
                }}
              >
                Quitar persona
              </button>
            </div>
          ))}
        <button
          className="secondary wide"
          onClick={() =>
            update((s) => ({
              ...s,
              people: [...s.people, { id: uid(), name: 'Nueva persona', type: 'residente', days: [0, 1, 2, 3, 4, 5, 6], meals: { desayuno: true, almuerzo: true, cena: true }, personalFactor: 1, portionFactor: 1, active: true }],
            }))
          }
        >
          + Agregar persona
        </button>
      </Section>

      <Section title="Mercado">
        <div className="row2">
          <label className="field">
            <span>Próximo mercado</span>
            <input type="date" value={state.settings.nextMarket} onChange={(e) => e.target.value && update((s) => ({ ...s, settings: { ...s.settings, nextMarket: e.target.value } }))} />
          </label>
          <label className="field">
            <span>Días entre mercados</span>
            <input
              type="number"
              inputMode="numeric"
              value={state.settings.quincenaDays}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, quincenaDays: Math.max(1, Number(e.target.value) || 15) } }))}
            />
          </label>
        </div>
        <label className="field">
          <span>Domingos (por defecto)</span>
          <select value={state.settings.sundayOut} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, sundayOut: Number(e.target.value) } }))}>
            <option value={0}>Comemos en casa</option>
            <option value={0.5}>A veces salimos o pedimos</option>
            <option value={1}>Siempre salimos o pedimos</option>
          </select>
        </label>
      </Section>

      <Section title={`Catálogo (${state.products.filter((p) => p.active).length} productos)`} right={<button className="secondary" onClick={() => setNewP(true)}>+ Nuevo</button>}>
        {CATEGORIES.map((c) => {
          const items = state.products.filter((p) => p.active && p.category === c).sort((a, b) => a.name.localeCompare(b.name, 'es'));
          if (!items.length) return null;
          return (
            <div key={c}>
              <div className="group">{c}</div>
              <ul className="history">
                {items.map((p) => (
                  <li key={p.id} onClick={() => setEditProduct(p.id)}>
                    <span>
                      {p.name} <span className="muted small">· {describeRule(p)}</span>
                    </span>
                    <span className="link">Editar</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Section>

      <Section title="Grupo familiar">
        <p className="muted small">
          Por ahora los datos se guardan en este celular. La próxima versión conecta a toda la casa en un mismo grupo para que cada quien anote desde su celular. Mientras tanto, puedes pasar los datos con una copia.
        </p>
      </Section>

      <Section title="Datos">
        <div className="actions2">
          <button className="secondary" onClick={download}>
            Descargar copia
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            Cargar copia
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        <button
          className="link danger"
          onClick={() => {
            if (confirm('¿Borrar TODO y empezar de cero?')) {
              update(() => resetState());
              nav.go('inicio');
            }
          }}
        >
          Borrar todo y empezar de cero
        </button>
      </Section>
    </div>
  );
}
