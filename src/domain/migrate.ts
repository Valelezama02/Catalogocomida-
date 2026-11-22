import { addDays } from './dates';
import { seedProducts } from './seed';
import type { AppState, Movement, Product, Receipt } from './types';

/**
 * Pasa los datos guardados al formato actual (v2):
 * - productos en unidades prácticas (bolsas, cajas, paquetes…)
 * - las carnes se guardan congeladas
 * Cada producto, movimiento y factura se marca con v = 2, así nunca se convierte dos veces
 * (aunque lleguen datos viejos desde otro celular).
 */

const SPECIAL_FACTOR: Record<string, number> = { ajo: 1 / 50 }; // de gramos a cabezas (~50 g)

let seedCache: Map<string, Product> | null = null;
const seedMap = () => (seedCache ??= new Map(seedProducts().map((p) => [p.id, p])));

function migrateProduct(p: Product): Product {
  if (p.v === 2) return p;
  const seed = seedMap().get(p.id);
  if (!seed) {
    // producto creado por la familia: se deja igual
    return { ...p, auto: p.auto ?? false, countName: p.countName ?? (p.unit === 'und' ? 'unidad' : undefined), v: 2 };
  }
  const changed = p.unit !== seed.unit || p.packageSize !== seed.packageSize;
  const factor = !changed ? 1 : (SPECIAL_FACTOR[p.id] ?? (seed.unit === 'und' && seed.packageSize === 1 ? 1 / p.packageSize : 1));
  return {
    ...seed,
    name: p.name, // por si le cambiaron el nombre
    keywords: Array.from(new Set([...seed.keywords, ...(p.keywords ?? [])])),
    active: p.active,
    legacyFactor: factor,
    v: 2,
  };
}

function migrateMovement(m: Movement, byId: Map<string, Product>): Movement {
  if (m.v === 2) return m;
  const p = byId.get(m.productId);
  if (!p) return m; // el producto todavía no llegó; se convierte después
  const f = p.legacyFactor ?? 1;
  const out: Movement = { ...m, qty: m.qty * f, by: undefined, v: 2 };
  // las carnes se guardan congeladas: su vencimiento es el del congelador
  if (m.type === 'compra' && p.location === 'congelador' && m.location !== 'congelador') {
    out.location = 'congelador';
    out.expiry = addDays(m.date, p.freezerDays ?? p.shelfLifeDays);
  }
  return out;
}

function migrateReceipt(r: Receipt, byId: Map<string, Product>): Receipt {
  if (r.v === 2) return r;
  if (r.lines.some((l) => l.productId && !byId.has(l.productId))) return r;
  return {
    ...r,
    v: 2,
    lines: r.lines.map((l) => {
      const p = l.productId ? byId.get(l.productId) : undefined;
      if (!p) return l;
      const f = p.legacyFactor ?? 1;
      const line = { ...l, qty: l.qty * f };
      if (p.location === 'congelador' && l.location !== 'congelador') {
        line.location = 'congelador';
        line.expiry = addDays(r.date, p.freezerDays ?? p.shelfLifeDays);
      }
      return line;
    }),
  };
}

export function needsMigration(s: AppState): boolean {
  return (
    s.version !== 2 ||
    !s.list ||
    !s.notes ||
    s.products.some((p) => p.v !== 2) ||
    s.movements.some((m) => m.v !== 2) ||
    s.receipts.some((r) => r.v !== 2)
  );
}

export function migrate(s: AppState): AppState {
  if (!needsMigration(s)) return s;
  const products = s.products.map(migrateProduct);
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    ...s,
    version: 2,
    products,
    movements: s.movements.map((m) => migrateMovement(m, byId)),
    receipts: s.receipts.map((r) => migrateReceipt(r, byId)),
    list: s.list ?? [],
    notes: s.notes ?? [],
  };
}
