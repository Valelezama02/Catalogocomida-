import { addDays, diffDays } from './dates';
import { Calc } from './household';
import type { AppState, ISODate, Location, Movement, Product, QuincenaPlan } from './types';

const EPS = 1e-6;

export interface Lot {
  qty: number;
  expiry: ISODate;
  location: Location;
  purchased: ISODate;
}

export interface ProductStatus {
  productId: string;
  hasData: boolean;
  qty: number; // lo que hay según lo anotado (incluye vencidos sin confirmar)
  usableQty: number; // sin vencer
  lots: Lot[];
  estLots: Lot[]; // lo que probablemente hay (para sugerir la lista del mercado)
  estQty: number;
  lastUpdate?: ISODate; // último dato anotado (compra, uso, conteo…)
  calibration: number; // factor aprendido con los conteos (1 = la regla tal cual)
  lastCount?: ISODate;
  dailyRate: number; // consumo estimado hoy (ya calibrado)
  runOut: ISODate | null; // día estimado en que se acaba (proyección 60 días)
}

export function shelfFor(product: Product, location: Location): number {
  if (location === 'congelador') return product.freezerDays ?? product.shelfLifeDays;
  return product.shelfLifeDays;
}

export function defaultExpiry(product: Product, date: ISODate, location: Location = product.location): ISODate {
  return addDays(date, shelfFor(product, location));
}

/** Saca qty de los lotes, primero lo que se vence antes (FIFO por vencimiento). */
export function takeFIFO(lots: Lot[], qty: number, filter?: (l: Lot) => boolean): number {
  if (qty <= EPS) return 0;
  const sorted = lots.filter((l) => l.qty > EPS && (!filter || filter(l))).sort((a, b) => (a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0));
  let left = qty;
  for (const l of sorted) {
    const t = Math.min(l.qty, left);
    l.qty -= t;
    left -= t;
    if (left <= EPS) break;
  }
  for (let i = lots.length - 1; i >= 0; i--) if (lots[i].qty <= EPS) lots.splice(i, 1);
  return qty - Math.max(0, left);
}

const sumLots = (lots: Lot[]) => lots.reduce((s, l) => s + l.qty, 0);

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/**
 * Reproduce la historia de un producto día por día hasta `to`.
 *
 * mode = 'anotado' (lo que se muestra en "Qué hay"):
 *   - lo que alguien anota SIEMPRE se descuenta
 *   - si el producto es automático (aseo, despensa, bebé), además se descuenta solo cada día
 * mode = 'estimado' (solo para sugerir la lista del mercado):
 *   - en lo fresco, entre conteos se descuenta lo anotado o lo estimado, lo que sea mayor
 */
export function simulateProduct(product: Product, movements: Movement[], to: ISODate, calc: Calc, mode: 'anotado' | 'estimado' = 'anotado') {
  const evs = movements
    .filter((m) => m.productId === product.id)
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1));
  const lots: Lot[] = [];
  let calibration = 1;
  let lastCount: ISODate | undefined;
  if (evs.length === 0) return { lots, calibration, lastCount, lastUpdate: undefined as ISODate | undefined, hasData: false };
  const lastUpdate = evs[evs.length - 1].date;

  let cumLogged = 0;
  let cumEst = 0;
  let cumBase = 0;
  let applied = 0;
  let anchor = evs[0].date;
  let i = 0;
  const start = evs[0].date;
  const days = diffDays(start, to);

  const settle = () => {
    let target: number;
    if (product.auto) target = cumLogged + cumEst;
    else if (mode === 'anotado') target = cumLogged;
    else target = Math.max(cumLogged, cumEst);
    if (target - applied > EPS) {
      takeFIFO(lots, target - applied);
      applied = target;
    }
  };

  for (let k = 0; k <= days; k++) {
    const d = addDays(start, k);
    // lo estimado del día cuenta desde que empieza el día
    const base = calc.base(product, d);
    cumBase += base;
    cumEst += base * calibration;
    // luego, todo lo anotado, en el orden en que se anotó
    while (i < evs.length && evs[i].date <= d) {
      const m = evs[i++];
      switch (m.type) {
        case 'compra': {
          const loc = m.location ?? product.location;
          lots.push({ qty: m.qty, expiry: m.expiry ?? defaultExpiry(product, d, loc), location: loc, purchased: d });
          break;
        }
        case 'uso':
          cumLogged += m.qty;
          settle();
          break;
        case 'descarte':
          takeFIFO(lots, m.qty);
          break;
        case 'congelar': {
          const moved = takeFIFO(lots, m.qty, (l) => l.location !== 'congelador');
          if (moved > EPS) lots.push({ qty: moved, expiry: addDays(d, product.freezerDays ?? 90), location: 'congelador', purchased: d });
          break;
        }
        case 'conteo': {
          // el conteo es la verdad en ese momento y sirve para aprender cuánto se gasta
          settle();
          const current = sumLots(lots);
          const actual = applied + (current - m.qty);
          if (mode === 'estimado' && cumBase > EPS && diffDays(anchor, d) >= 3 && actual >= 0) {
            calibration = 0.6 * calibration + 0.4 * clamp(actual / cumBase, 0.3, 3);
          }
          if (current > m.qty) takeFIFO(lots, current - m.qty);
          else if (m.qty > current) lots.push({ qty: m.qty - current, expiry: defaultExpiry(product, d), location: product.location, purchased: d });
          cumLogged = cumEst = cumBase = applied = 0;
          anchor = d;
          lastCount = d;
          break;
        }
      }
    }
    settle();
  }
  return { lots, calibration, lastCount, lastUpdate, hasData: true };
}

/**
 * Proyecta hacia el futuro desde `from` durante `days` días.
 * Lo que se vence antes de usarse se pierde (wasted).
 */
export function project(
  startLots: Lot[],
  product: Product,
  calibration: number,
  from: ISODate,
  days: number,
  calc: Calc,
  extra?: (d: ISODate) => number,
) {
  const lots = startLots.map((l) => ({ ...l }));
  const uncovered: number[] = [];
  const demand: number[] = [];
  let runOut: ISODate | null = null;
  let wasted = 0;
  for (let k = 0; k < days; k++) {
    const d = addDays(from, k);
    for (const l of lots) {
      if (l.expiry < d && l.qty > EPS) {
        wasted += l.qty;
        l.qty = 0;
      }
    }
    const need = calc.base(product, d) * calibration + (extra ? extra(d) : 0);
    const got = takeFIFO(lots, need);
    const miss = need - got;
    demand.push(need);
    uncovered.push(miss > EPS ? miss : 0);
    if (miss > EPS && runOut === null) runOut = d;
  }
  return { lots: lots.filter((l) => l.qty > EPS), uncovered, demand, runOut, wasted };
}

export function productStatus(product: Product, state: AppState, today: ISODate, calc: Calc): ProductStatus {
  const sim = simulateProduct(product, state.movements, today, calc, 'anotado');
  const est = product.auto ? sim : simulateProduct(product, state.movements, today, calc, 'estimado');
  const usable = sim.lots.filter((l) => l.expiry >= today);
  const proj = project(est.lots, product, est.calibration, addDays(today, 1), 60, calc);
  return {
    productId: product.id,
    hasData: sim.hasData,
    qty: sumLots(sim.lots),
    usableQty: sumLots(usable),
    lots: sim.lots.sort((a, b) => (a.expiry < b.expiry ? -1 : 1)),
    estLots: est.lots,
    estQty: sumLots(est.lots.filter((l) => l.expiry >= today)),
    lastUpdate: sim.lastUpdate,
    calibration: est.calibration,
    lastCount: sim.lastCount,
    dailyRate: calc.base(product, today) * est.calibration,
    runOut: product.rule.type === 'manual' ? null : proj.runOut,
  };
}

export function computeStatuses(state: AppState, today: ISODate, calc: Calc): Record<string, ProductStatus> {
  const out: Record<string, ProductStatus> = {};
  for (const p of state.products) if (p.active) out[p.id] = productStatus(p, state, today, calc);
  return out;
}

// ───────────────────────── Lista de mercado ─────────────────────────

export interface ShoppingItem {
  product: Product;
  need: number; // consumo proyectado de la quincena (+ colchón)
  have: number; // lo que habrá el día del mercado (sin vencer)
  buy: number; // cantidad a comprar (unidad base)
  packages: number;
  freeze: number; // cuánto congelar al llegar
  wasted: number; // lo que hay pero se va a vencer sin usarse
  coveredUntil?: ISODate; // si no alcanza a durar toda la quincena
  notes: string[];
}

export function buildShoppingList(
  state: AppState,
  statuses: Record<string, ProductStatus>,
  plan: QuincenaPlan,
  today: ISODate,
  baseCalc: Calc,
  fmtQty: (q: number, p: Product) => string,
  fmtDay: (d: ISODate) => string,
): ShoppingItem[] {
  const calc = baseCalc.withPlan(plan);
  const S = plan.start < today ? today : plan.start;
  const periodDays = Math.max(1, diffDays(S, plan.end));
  const products = state.products.filter((p) => p.active);
  const byId = new Map(products.map((p) => [p.id, p]));
  const isSubstitute = new Set(products.map((p) => p.substituteId).filter(Boolean) as string[]);
  const ordered = [...products.filter((p) => !isSubstitute.has(p.id)), ...products.filter((p) => isSubstitute.has(p.id))];
  const gaps = new Map<string, { days: Set<ISODate>; from: string[] }>();
  const items: ShoppingItem[] = [];

  for (const p of ordered) {
    const st = statuses[p.id];
    const calib = st?.calibration ?? 1;
    const lotsNow = st?.estLots ?? [];
    const preDays = Math.max(0, diffDays(today, S) - 1);
    const pre = preDays > 0 ? project(lotsNow, p, calib, addDays(today, 1), preDays, calc) : { lots: lotsNow };
    const lotsAtS = pre.lots.filter((l) => l.expiry >= S);
    const have = sumLots(lotsAtS);

    const gap = gaps.get(p.id);
    const extra = gap ? (d: ISODate) => (gap.days.has(d) ? calc.base(p, d) * calib : 0) : undefined;
    const total = periodDays + p.safetyDays;
    const per = project(lotsAtS, p, calib, S, total, calc, extra);
    const need = per.demand.reduce((a, b) => a + b, 0);
    const shortfall = per.uncovered.reduce((a, b) => a + b, 0);
    const notes: string[] = [];
    if (gap) notes.push(`Incluye lo necesario para reemplazar ${gap.from.join(', ')} cuando se acabe.`);
    if (per.wasted > EPS) notes.push(`Ojo: ≈${fmtQty(per.wasted, p)} de lo que hay se vence antes de usarse.`);

    let buy = 0;
    let freeze = 0;
    let coveredUntil: ISODate | undefined;
    if (shortfall > EPS) {
      const shelf = shelfFor(p, p.location);
      let fresh = 0;
      let late = 0;
      const lateDays: ISODate[] = [];
      per.uncovered.forEach((u, k) => {
        if (k <= shelf) fresh += u;
        else {
          late += u;
          if (u > EPS) lateDays.push(addDays(S, k));
        }
      });
      if (late > EPS) {
        if (p.freezerDays) {
          buy = fresh + late;
          freeze = late;
          notes.push(`Dura ~${shelf} días en ${p.location}: al llegar, porcionar y congelar ≈${fmtQty(late, p)}.`);
        } else {
          buy = fresh;
          coveredUntil = addDays(S, shelf);
          const sub = p.substituteId ? byId.get(p.substituteId) : undefined;
          if (sub) {
            const g = gaps.get(sub.id) ?? { days: new Set<ISODate>(), from: [] };
            lateDays.forEach((d) => g.days.add(d));
            g.from.push(p.name);
            gaps.set(sub.id, g);
            notes.push(`Dura ~${shelf} días: alcanza hasta el ${fmtDay(coveredUntil)}. Después se reemplaza con ${sub.name} (ya sumado en la lista).`);
          } else {
            notes.push(`Dura ~${shelf} días: alcanza hasta el ${fmtDay(coveredUntil)}. Comprar en distintos puntos de maduración y usarlo los primeros días.`);
          }
        }
      } else {
        buy = shortfall;
      }
      if (p.location === 'congelador' && p.category === 'Carnes y pescado') {
        freeze = buy;
        notes.push('Al llegar, porcionar y congelar.');
      }
    }
    const packages = buy > EPS ? Math.ceil(buy / p.packageSize - 1e-9) : 0;
    items.push({ product: p, need, have, buy, packages, freeze, wasted: per.wasted, coveredUntil, notes });
  }
  return items;
}

// ───────────────────────── Alertas ─────────────────────────

export interface Alert {
  level: 'rojo' | 'naranja';
  productId: string;
  kind: 'vencido' | 'porVencer';
  text: string;
  date: ISODate;
  qty: number;
}

/** Solo avisa lo que se va a dañar (o ya se dañó). Lo congelado y lo que dura meses no molesta. */
export function computeAlerts(
  state: AppState,
  statuses: Record<string, ProductStatus>,
  today: ISODate,
  fmtQty: (q: number, p: Product) => string,
  fmtDay: (d: ISODate) => string,
): Alert[] {
  const out: Alert[] = [];
  for (const p of state.products) {
    const st = statuses[p.id];
    if (!p.active || !st || !st.hasData) continue;
    for (const l of st.lots) {
      if (l.location === 'congelador' && diffDays(today, l.expiry) > 2) continue;
      if (shelfFor(p, l.location) > 60) continue; // no perecedero
      if (l.qty < (p.packageSize === 1 ? 0.25 : 0.05 * p.packageSize)) continue; // casi nada
      const dd = diffDays(today, l.expiry);
      if (dd < 0) {
        out.push({ level: 'rojo', kind: 'vencido', productId: p.id, date: l.expiry, qty: l.qty, text: `${p.name}: ≈${fmtQty(l.qty, p)} se venció el ${fmtDay(l.expiry)}.` });
      } else if (dd <= 2) {
        const when = dd === 0 ? 'hoy' : dd === 1 ? 'mañana' : 'en 2 días';
        const tip = p.freezerDays && l.location !== 'congelador' ? ' Cocinar o congelar.' : ' Usar ya.';
        out.push({ level: 'naranja', kind: 'porVencer', productId: p.id, date: l.expiry, qty: l.qty, text: `${p.name}: ≈${fmtQty(l.qty, p)} se vence ${when}.${tip}` });
      }
    }
  }
  const rank = { rojo: 0, naranja: 1 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || (a.date < b.date ? -1 : 1));
}
