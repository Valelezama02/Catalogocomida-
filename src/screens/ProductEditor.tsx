import { useState } from 'react';
import { RULE_LABEL, UNIT_LABEL } from '../domain/format';
import { CATEGORIES, LOCATIONS, type Product, type RuleType, type Unit } from '../domain/types';
import { uid, useStore } from '../state/store';

export function newProduct(name = ''): Product {
  return {
    id: uid(),
    name,
    category: 'Otros',
    location: 'despensa',
    unit: 'und',
    packageSize: 1,
    packageLabel: 'unidad',
    shelfLifeDays: 30,
    rule: { type: 'manual', qty: 0 },
    safetyDays: 3,
    keywords: [],
    active: true,
  };
}

export function ProductEditor({ product, onDone }: { product: Product; onDone: () => void }) {
  const { state, update } = useStore();
  const [p, setP] = useState<Product>(product);
  const [kw, setKw] = useState(product.keywords.join(', '));
  const isNew = !state.products.some((x) => x.id === product.id);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP({ ...p, [k]: v });
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const hasShare = p.rule.type === 'porcion' || p.rule.type === 'desayuno';

  const save = () => {
    const final: Product = { ...p, name: p.name.trim() || 'Sin nombre', keywords: kw.split(',').map((s) => s.trim()).filter(Boolean) };
    update((s) => ({ ...s, products: isNew ? [...s.products, final] : s.products.map((x) => (x.id === final.id ? final : x)) }));
    onDone();
  };

  return (
    <div className="screen">
      <div className="row between">
        <h1>{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
        <button className="secondary" onClick={onDone}>
          Cancelar
        </button>
      </div>
      <div className="form">
        <label className="field">
          <span>Nombre</span>
          <input value={p.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="row2">
          <label className="field">
            <span>Categoría</span>
            <select value={p.category} onChange={(e) => set('category', e.target.value as Product['category'])}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Dónde se guarda</span>
            <select value={p.location} onChange={(e) => set('location', e.target.value as Product['location'])}>
              {LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span>Unidad</span>
            <select value={p.unit} onChange={(e) => set('unit', e.target.value as Unit)}>
              {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Presentación ({p.unit})</span>
            <input type="number" inputMode="decimal" value={p.packageSize} onChange={(e) => set('packageSize', Math.max(0.001, num(e.target.value)))} />
          </label>
        </div>
        <label className="field">
          <span>Nombre de la presentación</span>
          <input value={p.packageLabel} placeholder="ej. bolsa 5 kg" onChange={(e) => set('packageLabel', e.target.value)} />
        </label>
        <div className="row2">
          <label className="field">
            <span>Dura (días) en {LOCATIONS.find((l) => l.id === p.location)?.label.toLowerCase()}</span>
            <input type="number" inputMode="numeric" value={p.shelfLifeDays} onChange={(e) => set('shelfLifeDays', num(e.target.value))} />
          </label>
          <label className="field">
            <span>Dura congelado (días)</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="no se congela"
              value={p.freezerDays ?? ''}
              onChange={(e) => set('freezerDays', e.target.value === '' ? undefined : num(e.target.value))}
            />
          </label>
        </div>

        <fieldset>
          <legend>Cómo se gasta</legend>
          <label className="field">
            <span>Regla</span>
            <select value={p.rule.type} onChange={(e) => set('rule', { ...p.rule, type: e.target.value as RuleType })}>
              {(Object.keys(RULE_LABEL) as RuleType[]).map((r) => (
                <option key={r} value={r}>
                  {RULE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          {p.rule.type !== 'manual' && (
            <div className="row2">
              <label className="field">
                <span>Cantidad ({p.unit})</span>
                <input type="number" inputMode="decimal" value={p.rule.qty} onChange={(e) => set('rule', { ...p.rule, qty: num(e.target.value) })} />
              </label>
              {hasShare && (
                <label className="field">
                  <span>% de comidas que lo llevan</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={Math.round((p.rule.share ?? 1) * 100)}
                    onChange={(e) => set('rule', { ...p.rule, share: Math.min(100, num(e.target.value)) / 100 })}
                  />
                </label>
              )}
            </div>
          )}
        </fieldset>

        <div className="row2">
          <label className="field">
            <span>Colchón (días extra)</span>
            <input type="number" inputMode="numeric" value={p.safetyDays} onChange={(e) => set('safetyDays', num(e.target.value))} />
          </label>
          <label className="field">
            <span>Si no alcanza a durar, reemplazar con</span>
            <select value={p.substituteId ?? ''} onChange={(e) => set('substituteId', e.target.value || undefined)}>
              <option value="">—</option>
              {state.products
                .filter((x) => x.active && x.id !== p.id)
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Otros nombres (como sale en la factura, separados por coma)</span>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ej. huevo aa, huevo rojo" />
        </label>

        <button className="primary wide" onClick={save}>
          Guardar
        </button>
        {!isNew && (
          <button
            className="secondary wide danger"
            onClick={() => {
              if (!confirm(`¿Quitar "${p.name}" del catálogo? El historial se conserva.`)) return;
              update((s) => ({ ...s, products: s.products.map((x) => (x.id === p.id ? { ...x, active: false } : x)) }));
              onDone();
            }}
          >
            Quitar del catálogo
          </button>
        )}
      </div>
    </div>
  );
}
