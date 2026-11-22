import type { AppState } from '../domain/types';

/**
 * Los datos de la casa viajan a la nube como registros sueltos (uno por producto,
 * por movimiento, por factura…). Así, si dos personas anotan al mismo tiempo,
 * no se pisan: cada quien cambia solo sus registros.
 */

export type Kind = 'product' | 'person' | 'movement' | 'receipt' | 'plan' | 'alias' | 'settings' | 'checked';

export interface Rec {
  kind: Kind;
  id: string;
  data: unknown;
}

export interface RemoteRec extends Rec {
  deleted: boolean;
  updated_at?: string;
}

export const recKey = (kind: string, id: string) => `${kind}:${id}`;

/** JSON con llaves ordenadas (Postgres reordena las llaves de jsonb). */
export function stable(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

export function toRecords(s: AppState): Map<string, Rec> {
  const m = new Map<string, Rec>();
  const put = (kind: Kind, id: string, data: unknown) => m.set(recKey(kind, id), { kind, id, data });
  s.products.forEach((p) => put('product', p.id, p));
  s.people.forEach((p) => put('person', p.id, p));
  s.movements.forEach((x) => put('movement', x.id, x));
  s.receipts.forEach((x) => put('receipt', x.id, x));
  s.plans.forEach((x) => put('plan', x.id, x));
  Object.entries(s.aliases).forEach(([k, v]) => put('alias', k, v));
  Object.entries(s.checked).forEach(([k, v]) => v && put('checked', k, true));
  put('settings', 'main', s.settings);
  return m;
}

/** Qué hay que subir: lo nuevo o cambiado, y lo que se borró. */
export function diffRecords(current: Map<string, Rec>, synced: Record<string, string>) {
  const upserts: Rec[] = [];
  const deletes: Rec[] = [];
  for (const [k, r] of current) if (synced[k] !== stable(r.data)) upserts.push(r);
  for (const k of Object.keys(synced)) {
    if (!current.has(k)) {
      const i = k.indexOf(':');
      deletes.push({ kind: k.slice(0, i) as Kind, id: k.slice(i + 1), data: null });
    }
  }
  return { upserts, deletes };
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

/** Aplica registros que llegan de la nube al estado local. */
export function applyRecords(s: AppState, recs: RemoteRec[]): AppState {
  if (!recs.length) return s;
  let st = s;
  const aliases = { ...s.aliases };
  const checked = { ...s.checked };
  let touchedAliases = false;
  let touchedChecked = false;
  for (const r of recs) {
    const del = r.deleted || r.data == null;
    switch (r.kind) {
      case 'product':
        st = { ...st, products: del ? st.products.filter((x) => x.id !== r.id) : upsertById(st.products, r.data as AppState['products'][number]) };
        break;
      case 'person':
        st = { ...st, people: del ? st.people.filter((x) => x.id !== r.id) : upsertById(st.people, r.data as AppState['people'][number]) };
        break;
      case 'movement':
        st = { ...st, movements: del ? st.movements.filter((x) => x.id !== r.id) : upsertById(st.movements, r.data as AppState['movements'][number]) };
        break;
      case 'receipt':
        st = { ...st, receipts: del ? st.receipts.filter((x) => x.id !== r.id) : upsertById(st.receipts, r.data as AppState['receipts'][number]) };
        break;
      case 'plan':
        st = { ...st, plans: del ? st.plans.filter((x) => x.id !== r.id) : upsertById(st.plans, r.data as AppState['plans'][number]) };
        break;
      case 'alias':
        touchedAliases = true;
        if (del) delete aliases[r.id];
        else aliases[r.id] = r.data as string;
        break;
      case 'checked':
        touchedChecked = true;
        if (del) delete checked[r.id];
        else checked[r.id] = true;
        break;
      case 'settings':
        if (!del) st = { ...st, settings: { ...st.settings, ...(r.data as AppState['settings']) } };
        break;
    }
  }
  if (touchedAliases) st = { ...st, aliases };
  if (touchedChecked) st = { ...st, checked };
  return st;
}
