import { describe, expect, it } from 'vitest';
import { createInitialState } from '../domain/seed';
import { applyRecords, diffRecords, recKey, stable, toRecords, type RemoteRec } from './records';

describe('sincronización por registros', () => {
  it('stable ignora el orden de las llaves', () => {
    expect(stable({ b: 1, a: { d: 2, c: [1, { y: 1, x: 2 }] } })).toBe(stable({ a: { c: [1, { x: 2, y: 1 }], d: 2 }, b: 1 }));
  });

  it('sube todo la primera vez y nada si no hubo cambios', () => {
    const s = createInitialState('2026-11-23');
    const cur = toRecords(s);
    const first = diffRecords(cur, {});
    expect(first.upserts.length).toBe(cur.size);
    const synced: Record<string, string> = {};
    for (const [k, r] of cur) synced[k] = stable(r.data);
    expect(diffRecords(toRecords(s), synced)).toEqual({ upserts: [], deletes: [] });
  });

  it('detecta cambios y borrados', () => {
    const s = createInitialState('2026-11-23');
    s.movements.push({ id: 'm1', productId: 'huevos', type: 'uso', qty: 6, date: '2026-11-23', createdAt: 'x' });
    const synced: Record<string, string> = {};
    for (const [k, r] of toRecords(s)) synced[k] = stable(r.data);
    const s2 = { ...s, movements: [], products: s.products.map((p) => (p.id === 'arroz' ? { ...p, safetyDays: 5 } : p)) };
    const d = diffRecords(toRecords(s2), synced);
    expect(d.upserts.map((r) => recKey(r.kind, r.id))).toEqual(['product:arroz']);
    expect(d.deletes.map((r) => recKey(r.kind, r.id))).toEqual(['movement:m1']);
  });

  it('aplica lo que llega de la nube', () => {
    const s = createInitialState('2026-11-23');
    const recs: RemoteRec[] = [
      { kind: 'movement', id: 'm9', data: { id: 'm9', productId: 'huevos', type: 'uso', qty: 3, date: '2026-11-23', createdAt: 'x', by: 'tati' }, deleted: false },
      { kind: 'person', id: 'adulto-1', data: { ...s.people[0], name: 'Valeria' }, deleted: false },
      { kind: 'product', id: 'sal', data: null, deleted: true },
      { kind: 'alias', id: 'huevo kike', data: 'huevos', deleted: false },
      { kind: 'checked', id: 'q1:arroz', data: true, deleted: false },
      { kind: 'settings', id: 'main', data: { ...s.settings, sundayOut: 1 }, deleted: false },
    ];
    const out = applyRecords(s, recs);
    expect(out.movements).toHaveLength(1);
    expect(out.people[0].name).toBe('Valeria');
    expect(out.people).toHaveLength(s.people.length);
    expect(out.products.find((p) => p.id === 'sal')).toBeUndefined();
    expect(out.aliases['huevo kike']).toBe('huevos');
    expect(out.checked['q1:arroz']).toBe(true);
    expect(out.settings.sundayOut).toBe(1);
  });
});
