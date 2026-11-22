import { useRef, useState } from 'react';
import { Section } from '../components';
import { fmtDate } from '../domain/dates';
import { defaultExpiry } from '../domain/engine';
import { fmtQty, UNIT_LABEL } from '../domain/format';
import { aliasKey, baseQty, matchProduct, parseReceiptText, type ParsedLine } from '../domain/receipt';
import { LOCATIONS, type Location, type Receipt } from '../domain/types';
import { recognizeReceipt } from '../ocr';
import { uid, useStore } from '../state/store';
import { newProduct } from './ProductEditor';

interface DraftLine {
  key: string;
  raw?: string;
  parsed?: ParsedLine;
  productId?: string;
  qty: string;
  location: Location;
  expiry: string;
  price?: number;
}

interface Draft {
  id: string;
  date: string;
  store: string;
  source: 'foto' | 'manual';
  lines: DraftLine[];
  isNew: boolean;
}

export default function Receipts() {
  const { state, today, update } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ocr, setOcr] = useState<{ p: number; s: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lineFromParsed = (pl: ParsedLine, date: string): DraftLine => {
    const p = matchProduct(pl.description, state.products, state.aliases);
    return {
      key: uid(),
      raw: pl.description,
      parsed: pl,
      productId: p?.id,
      qty: p ? String(baseQty(pl, p)) : '',
      location: p?.location ?? 'despensa',
      expiry: p ? defaultExpiry(p, date) : date,
      price: pl.price,
    };
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    try {
      const text = await recognizeReceipt(f, (p, s) => setOcr({ p, s }));
      const parsed = parseReceiptText(text);
      setDraft({ id: uid(), date: today, store: guessStore(text), source: 'foto', isNew: true, lines: parsed.map((pl) => lineFromParsed(pl, today)) });
      if (!parsed.length) setErr('No se encontraron productos en la foto. Intenta con más luz y la factura bien estirada, o agrégalos a mano.');
    } catch (e) {
      setErr('No se pudo leer la foto (¿hay internet? la primera vez se descarga el lector). Puedes registrar la factura a mano.');
      console.error(e);
    } finally {
      setOcr(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openExisting = (r: Receipt) =>
    setDraft({
      id: r.id,
      date: r.date,
      store: r.store,
      source: r.source,
      isNew: false,
      lines: r.lines.map((l) => ({ key: l.id, raw: l.raw, productId: l.productId, qty: String(l.qty), location: l.location, expiry: l.expiry, price: l.price })),
    });

  if (draft) return <ReceiptEditor draft={draft} setDraft={setDraft} onClose={() => setDraft(null)} />;

  const receipts = [...state.receipts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="screen">
      <h1>Facturas</h1>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="actions2">
        <button className="big" disabled={!!ocr} onClick={() => fileRef.current?.click()}>
          📷
          <br />
          Escanear factura
        </button>
        <button className="big" disabled={!!ocr} onClick={() => setDraft({ id: uid(), date: today, store: '', source: 'manual', isNew: true, lines: [] })}>
          ✍️
          <br />
          Sin factura / a mano
        </button>
      </div>
      {ocr && (
        <div className="card">
          <div>{ocr.s}</div>
          <progress value={ocr.p} max={1} />
        </div>
      )}
      {err && <div className="card warnbox">{err}</div>}
      <p className="muted small">
        Consejo: foto de día o con buena luz, la factura estirada y completa. Si es muy larga, toma varias fotos y agrégalas a la misma compra (botón “Agregar otra foto”).
      </p>

      <Section title="Compras registradas">
        {receipts.length === 0 ? (
          <p className="muted">Todavía no hay compras.</p>
        ) : (
          <ul className="history">
            {receipts.map((r) => (
              <li key={r.id} onClick={() => openExisting(r)}>
                <span>
                  <b>{fmtDate(r.date)}</b> · {r.store || (r.source === 'manual' ? 'Sin factura' : 'Factura')}
                  <span className="muted small"> · {r.lines.length} productos</span>
                </span>
                <span className="link">Editar</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {receipts.length > 0 && (
        <button
          className="link danger"
          onClick={() => {
            if (confirm('¿Borrar todas las compras registradas? Esto quita también su inventario.')) update((s) => ({ ...s, receipts: [], movements: s.movements.filter((m) => !m.receiptId) }));
          }}
        >
          Borrar todas las compras
        </button>
      )}
    </div>
  );
}

function guessStore(text: string): string {
  const t = text.toUpperCase();
  const stores = ['EXITO', 'CARULLA', 'JUMBO', 'OLIMPICA', 'D1', 'ARA', 'ISIMO', 'MAKRO', 'PRICESMART', 'METRO', 'SURTIMAX', 'COLSUBSIDIO', 'CAFAM', 'LA 14', 'ALKOSTO', 'EURO', 'CONSUMO'];
  const hit = stores.find((s) => new RegExp(`\\b${s}\\b`).test(t));
  return hit ? hit.charAt(0) + hit.slice(1).toLowerCase() : '';
}

function ReceiptEditor({ draft, setDraft, onClose }: { draft: Draft; setDraft: (d: Draft) => void; onClose: () => void }) {
  const { state, update, user, today } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocr, setOcr] = useState<{ p: number; s: string } | null>(null);
  const products = state.products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const setLine = (key: string, patch: Partial<DraftLine>) => setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  const chooseProduct = (l: DraftLine, productId: string) => {
    let pid = productId;
    if (productId === '__new__') {
      const name = prompt('Nombre del producto nuevo', l.raw ? l.raw.toLowerCase() : '');
      if (!name) return;
      const np = newProduct(name.charAt(0).toUpperCase() + name.slice(1));
      update((s) => ({ ...s, products: [...s.products, np] }));
      pid = np.id;
      setLine(l.key, { productId: pid, qty: l.parsed ? String(l.parsed.count) : '1', location: np.location, expiry: defaultExpiry(np, draft.date) });
      return;
    }
    const p = state.products.find((x) => x.id === pid);
    if (!p) return setLine(l.key, { productId: undefined });
    setLine(l.key, { productId: pid, qty: String(l.parsed ? baseQty(l.parsed, p) : p.packageSize), location: p.location, expiry: defaultExpiry(p, draft.date) });
  };

  const addPhoto = async (f?: File) => {
    if (!f) return;
    try {
      const text = await recognizeReceipt(f, (p, s) => setOcr({ p, s }));
      const extra = parseReceiptText(text).map((pl) => {
        const p = matchProduct(pl.description, state.products, state.aliases);
        return { key: uid(), raw: pl.description, parsed: pl, productId: p?.id, qty: p ? String(baseQty(pl, p)) : '', location: p?.location ?? 'despensa', expiry: p ? defaultExpiry(p, draft.date) : draft.date, price: pl.price } as DraftLine;
      });
      setDraft({ ...draft, lines: [...draft.lines, ...extra] });
    } catch {
      alert('No se pudo leer la foto.');
    } finally {
      setOcr(null);
    }
  };

  const valid = draft.lines.filter((l) => l.productId && Number(l.qty) > 0);
  const unmatched = draft.lines.length - valid.length;

  const save = () => {
    const receipt: Receipt = {
      id: draft.id,
      date: draft.date,
      store: draft.store.trim(),
      source: draft.source,
      by: user ?? undefined,
      createdAt: new Date().toISOString(),
      lines: valid.map((l) => ({ id: l.key, raw: l.raw, productId: l.productId, qty: Number(l.qty), location: l.location, expiry: l.expiry, price: l.price })),
    };
    const now = new Date().toISOString();
    update((s) => {
      const aliases = { ...s.aliases };
      for (const l of valid) if (l.raw && l.productId) aliases[aliasKey(l.raw)] = l.productId;
      return {
        ...s,
        aliases,
        receipts: [...s.receipts.filter((r) => r.id !== receipt.id), receipt],
        movements: [
          ...s.movements.filter((m) => m.receiptId !== receipt.id),
          ...receipt.lines.map((l) => ({ id: uid(), productId: l.productId!, type: 'compra' as const, qty: l.qty, date: receipt.date, createdAt: now, by: user ?? undefined, location: l.location, expiry: l.expiry, receiptId: receipt.id })),
        ],
      };
    });
    onClose();
  };

  return (
    <div className="screen">
      <div className="row between">
        <h1>{draft.isNew ? 'Revisar compra' : 'Editar compra'}</h1>
        <button className="secondary" onClick={onClose}>
          Cancelar
        </button>
      </div>
      <p className="muted small">Revisa cada línea: producto, cantidad, dónde se guarda y cuándo se vence. Lo que no tenga producto elegido no se guarda.</p>
      <div className="row2">
        <label className="field">
          <span>Fecha de compra</span>
          <input type="date" value={draft.date} max={today} onChange={(e) => setDraft({ ...draft, date: e.target.value || today })} />
        </label>
        <label className="field">
          <span>Tienda</span>
          <input value={draft.store} placeholder="ej. Éxito" onChange={(e) => setDraft({ ...draft, store: e.target.value })} />
        </label>
      </div>

      <ul className="rlines">
        {draft.lines.map((l) => {
          const p = state.products.find((x) => x.id === l.productId);
          return (
            <li key={l.key} className={p ? '' : 'unmatched'}>
              {l.raw && <div className="raw">“{l.raw}”{l.price ? ` · $${l.price.toLocaleString('es-CO')}` : ''}</div>}
              <select value={l.productId ?? ''} onChange={(e) => chooseProduct(l, e.target.value)}>
                <option value="">— Elegir producto —</option>
                {products.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
                <option value="__new__">➕ Crear producto nuevo…</option>
              </select>
              {p && (
                <div className="rgrid">
                  <label className="field">
                    <span>Cantidad ({UNIT_LABEL[p.unit]})</span>
                    <input type="number" inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                    {Number(l.qty) > 0 && <small className="muted">= {fmtQty(Number(l.qty), p)}</small>}
                  </label>
                  <label className="field">
                    <span>Dónde</span>
                    <select
                      value={l.location}
                      onChange={(e) => {
                        const loc = e.target.value as Location;
                        setLine(l.key, { location: loc, expiry: defaultExpiry(p, draft.date, loc) });
                      }}
                    >
                      {LOCATIONS.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Se vence</span>
                    <input type="date" value={l.expiry} onChange={(e) => setLine(l.key, { expiry: e.target.value })} />
                  </label>
                </div>
              )}
              <button className="link danger" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((x) => x.key !== l.key) })}>
                Quitar línea
              </button>
            </li>
          );
        })}
      </ul>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addPhoto(e.target.files?.[0])} />
      {ocr && (
        <div className="card">
          <div>{ocr.s}</div>
          <progress value={ocr.p} max={1} />
        </div>
      )}
      <div className="actions2">
        <button className="secondary" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { key: uid(), qty: '', location: 'despensa', expiry: draft.date }] })}>
          + Agregar producto
        </button>
        <button className="secondary" disabled={!!ocr} onClick={() => fileRef.current?.click()}>
          📷 Agregar otra foto
        </button>
      </div>

      <div className="sticky">
        {unmatched > 0 && <div className="muted small center">{unmatched} línea(s) sin producto no se guardarán.</div>}
        <button className="primary wide" disabled={!valid.length} onClick={save}>
          Guardar {valid.length} producto{valid.length === 1 ? '' : 's'}
        </button>
        {!draft.isNew && (
          <button
            className="link danger wide"
            onClick={() => {
              if (!confirm('¿Borrar esta compra?')) return;
              update((s) => ({ ...s, receipts: s.receipts.filter((r) => r.id !== draft.id), movements: s.movements.filter((m) => m.receiptId !== draft.id) }));
              onClose();
            }}
          >
            Borrar esta compra
          </button>
        )}
      </div>
    </div>
  );
}
