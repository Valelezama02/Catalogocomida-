import { describe, expect, it } from 'vitest';
import { addDays, weekday } from './dates';
import { buildShoppingList, computeStatuses, simulateProduct } from './engine';
import { fmtQty } from './format';
import { Calc, dayContext } from './household';
import { aliasKey, baseQty, matchProduct, parseReceiptText } from './receipt';
import { createInitialState } from './seed';
import type { AppState, Movement, QuincenaPlan } from './types';

const MONDAY = '2026-11-23';
const base = () => createInitialState(MONDAY);
let n = 0;
const mv = (m: Omit<Movement, 'id' | 'createdAt'>): Movement => ({ id: `m${n++}`, createdAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}`, ...m });
const prod = (s: AppState, id: string) => s.products.find((p) => p.id === id)!;

describe('contexto del día', () => {
  it('cuenta porciones según quién está', () => {
    const s = base();
    expect(weekday(MONDAY)).toBe(1);
    const mon = dayContext(MONDAY, s.people, s.settings);
    // 4 residentes × 2 (almuerzo+cena) + Érica 1 + Gracia 0.8
    expect(mon.portions).toBeCloseTo(9.8);
    expect(mon.breakfasts).toBe(5);
    const tue = dayContext(addDays(MONDAY, 1), s.people, s.settings);
    expect(tue.portions).toBeCloseTo(10.8);
    expect(tue.breakfasts).toBe(6);
    const sun = dayContext(addDays(MONDAY, 6), s.people, s.settings);
    // domingo "a veces fuera" (0.5): (8 + 0.8) × 0.5
    expect(sun.portions).toBeCloseTo(4.4);
    expect(sun.breakfasts).toBe(4);
  });

  it('el cuestionario cambia el cálculo (domingo siempre fuera, ausencias)', () => {
    const s = base();
    const plan: QuincenaPlan = { id: 'q', start: MONDAY, end: addDays(MONDAY, 14), absentDays: { tati: 10 }, sundayOut: 1, meals: { desayuno: true, almuerzo: true, cena: true }, guestMeals: 0, createdAt: 'x' };
    expect(dayContext(addDays(MONDAY, 6), s.people, s.settings, plan).portions).toBe(0);
    // Tati tiene 10 días programados en 14 días → ausente todos
    expect(dayContext(addDays(MONDAY, 1), s.people, s.settings, plan).breakfasts).toBe(5);
  });
});

describe('inventario', () => {
  it('descuenta lo estimado si nadie anota (jabón de manos)', () => {
    const s = base();
    const p = prod(s, 'jabon-manos');
    s.movements = [mv({ productId: p.id, type: 'compra', qty: 1000, date: MONDAY })];
    const calc = new Calc(s.people, s.settings, s.plans);
    const sim = simulateProduct(p, s.movements, addDays(MONDAY, 6), calc);
    const left = sim.lots.reduce((a, l) => a + l.qty, 0);
    // ~ 5 ml × ~5.7 persona-días × 7 días ≈ 200 ml
    expect(1000 - left).toBeGreaterThan(170);
    expect(1000 - left).toBeLessThan(230);
  });

  it('usa lo anotado cuando es mayor que lo estimado y no cuenta doble', () => {
    const s = base();
    const p = prod(s, 'huevos');
    s.movements = [
      mv({ productId: p.id, type: 'compra', qty: 30, date: MONDAY }),
      mv({ productId: p.id, type: 'uso', qty: 12, date: MONDAY }),
    ];
    const calc = new Calc(s.people, s.settings, s.plans);
    const sim = simulateProduct(p, s.movements, MONDAY, calc);
    expect(sim.lots[0].qty).toBeCloseTo(18);
  });

  it('el conteo corrige el stock y calibra la regla', () => {
    const s = base();
    const p = prod(s, 'huevos');
    s.movements = [
      mv({ productId: p.id, type: 'conteo', qty: 60, date: MONDAY }),
      mv({ productId: p.id, type: 'conteo', qty: 20, date: addDays(MONDAY, 7) }),
    ];
    const calc = new Calc(s.people, s.settings, s.plans);
    const sim = simulateProduct(p, s.movements, addDays(MONDAY, 7), calc);
    expect(sim.lots.reduce((a, l) => a + l.qty, 0)).toBeCloseTo(20);
    // se gastaron 40 en 7 días, la regla estimaba ~38×1.05 ≈ 40 → calibración ~1
    expect(sim.calibration).toBeGreaterThan(0.9);
    expect(sim.calibration).toBeLessThan(1.15);
  });
});

describe('lista de mercado', () => {
  const plan = (s: AppState): QuincenaPlan => ({ id: 'q1', start: MONDAY, end: addDays(MONDAY, 15), absentDays: {}, sundayOut: s.settings.sundayOut, meals: { desayuno: true, almuerzo: true, cena: true }, guestMeals: 0, createdAt: 'x' });

  it('pide lo que falta redondeando a la presentación', () => {
    const s = base();
    const calc = new Calc(s.people, s.settings, s.plans);
    const statuses = computeStatuses(s, MONDAY, calc);
    const list = buildShoppingList(s, statuses, plan(s), MONDAY, calc, fmtQty, (d) => d);
    const eggs = list.find((i) => i.product.id === 'huevos')!;
    // ~81 desayunos × 1.5 × 0.7 ≈ 85 + colchón → 4 cubetas
    expect(eggs.packages).toBeGreaterThanOrEqual(3);
    expect(eggs.packages).toBeLessThanOrEqual(4);
    const rice = list.find((i) => i.product.id === 'arroz')!;
    expect(rice.packages).toBe(2);
  });

  it('perecedero congelable: compra todo y dice cuánto congelar', () => {
    const s = base();
    const calc = new Calc(s.people, s.settings, s.plans);
    const list = buildShoppingList(s, computeStatuses(s, MONDAY, calc), plan(s), MONDAY, calc, fmtQty, (d) => d);
    const chicken = list.find((i) => i.product.id === 'pechuga')!;
    expect(chicken.freeze).toBeGreaterThan(0);
    expect(chicken.freeze).toBeLessThan(chicken.buy);
    expect(chicken.notes.join(' ')).toContain('congelar');
  });

  it('perecedero no congelable con sustituto: lo pasa al sustituto', () => {
    const s = base();
    const calc = new Calc(s.people, s.settings, s.plans);
    const list = buildShoppingList(s, computeStatuses(s, MONDAY, calc), plan(s), MONDAY, calc, fmtQty, (d) => d);
    const lettuce = list.find((i) => i.product.id === 'lechuga')!;
    expect(lettuce.coveredUntil).toBe(addDays(MONDAY, 6));
    const cabbage = list.find((i) => i.product.id === 'repollo')!;
    expect(cabbage.notes.join(' ')).toContain('Lechuga');
  });

  it('no pide lo que ya alcanza', () => {
    const s = base();
    s.movements = [mv({ productId: 'sal', type: 'conteo', qty: 3000, date: MONDAY })];
    const calc = new Calc(s.people, s.settings, s.plans);
    const list = buildShoppingList(s, computeStatuses(s, MONDAY, calc), plan(s), MONDAY, calc, fmtQty, (d) => d);
    expect(list.find((i) => i.product.id === 'sal')!.packages).toBe(0);
  });
});

describe('facturas', () => {
  const text = `ALMACENES EXITO S.A.
NIT 890.900.608-9
FACTURA ELECTRONICA DE VENTA
7702001041831 HUEVO AA ROJO X30 KIKES   15.900 A
ARROZ DIANA 5000 GR        18.900
1,250 KG X 12.990
PECHUGA POLLO MARINADA     16.238
2 X 3.450
LECHE ENTERA 1100 ML ALQUERIA    6.900
JABON LIQUIDO MANOS 500ML  9.800
SUBTOTAL 67.738
TOTAL 67.738
EFECTIVO 70.000`;

  it('lee líneas, cantidades, pesos y tamaños', () => {
    const lines = parseReceiptText(text);
    expect(lines.map((l) => l.description)).toEqual([
      'HUEVO AA ROJO X30 KIKES',
      'ARROZ DIANA 5000 GR',
      'PECHUGA POLLO MARINADA',
      'LECHE ENTERA 1100 ML ALQUERIA',
      'JABON LIQUIDO MANOS 500ML',
    ]);
    expect(lines[2].weightKg).toBeCloseTo(1.25);
    expect(lines[3].count).toBe(2);
    expect(lines[0].price).toBe(15900);
  });

  it('empareja con el catálogo y calcula la cantidad', () => {
    const s = base();
    const lines = parseReceiptText(text);
    const ids = lines.map((l) => matchProduct(l.description, s.products, s.aliases)?.id);
    expect(ids).toEqual(['huevos', 'arroz', 'pechuga', 'leche', 'jabon-manos']);
    expect(baseQty(lines[0], prod(s, 'huevos'))).toBe(30);
    expect(baseQty(lines[2], prod(s, 'pechuga'))).toBe(1250);
    expect(baseQty(lines[3], prod(s, 'leche'))).toBe(2200);
  });

  it('el diccionario de equivalencias tiene prioridad', () => {
    const s = base();
    s.aliases[aliasKey('LECHE ENTERA 1100 ML ALQUERIA')] = 'leche-gracia';
    expect(matchProduct('LECHE ENTERA 1100 ML ALQUERIA', s.products, s.aliases)?.id).toBe('leche-gracia');
  });
});
