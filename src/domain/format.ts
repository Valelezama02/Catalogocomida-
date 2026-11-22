import type { ConsumptionRule, Product, Unit } from './types';

function num(x: number): string {
  const r = Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x);
  return r.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

export function plural(name: string): string {
  if (/ón$/.test(name)) return name.replace(/ón$/, 'ones');
  if (/[aeiouáéíóú]$/i.test(name)) return name + 's';
  if (/z$/.test(name)) return name.replace(/z$/, 'ces');
  return name + 'es';
}

/** Redondea a medios para paquetes ("más o menos cuántas bolsas") y a enteros para piezas. */
function countText(q: number, name: string, halves: boolean): string {
  const r = halves ? Math.round(q * 2) / 2 : Math.round(q);
  if (r === 0 && q > 0.01) return `casi nada`;
  const whole = Math.floor(r);
  const half = r - whole >= 0.5;
  const n = half ? (whole === 0 ? '½' : `${whole}½`) : String(whole);
  return `${n} ${r === 1 ? name : plural(name)}`;
}

export function fmtUnitQty(q: number, unit: Unit, countName = 'unidad', halves = false): string {
  if (unit === 'g') return q >= 1000 ? `${num(q / 1000)} kg` : `${num(q)} g`;
  if (unit === 'ml') return q >= 1000 ? `${num(q / 1000)} L` : `${num(q)} ml`;
  return countText(q, countName, halves);
}

export const fmtQty = (q: number, p: Product) => fmtUnitQty(q, p.unit, p.countName, p.packageSize === 1);

/** Nombre de la unidad para los formularios ("bolsas", "gramos"…). */
export function unitWord(p: Product): string {
  if (p.unit === 'und') return plural(p.countName ?? 'unidad');
  return UNIT_LABEL[p.unit];
}

/** Cantidad exacta para la regla (sin redondear). */
function exact(q: number, p: Product): string {
  if (p.unit !== 'und') return fmtUnitQty(q, p.unit);
  const r = Math.round(q * 100) / 100;
  return `${r.toLocaleString('es-CO')} ${r === 1 ? p.countName ?? 'unidad' : plural(p.countName ?? 'unidad')}`;
}

export const UNIT_LABEL: Record<Unit, string> = { g: 'gramos', ml: 'mililitros', und: 'unidades' };

export const RULE_LABEL: Record<ConsumptionRule['type'], string> = {
  porcion: 'Por porción (almuerzo/cena)',
  desayuno: 'Por desayuno',
  personaDia: 'Por persona al día',
  hogarSemana: 'Fijo por semana (toda la casa)',
  bebeDia: 'Por día de Gracia',
  manual: 'Solo lo que se anote',
};

export function describeRule(p: Product): string {
  const r = p.rule;
  const q = exact(r.qty, p);
  const what = r.type === 'desayuno' ? 'los desayunos' : 'las comidas';
  const sh = r.share != null && r.share < 1 ? `, en ${Math.round(r.share * 100)}% de ${what}` : '';
  switch (r.type) {
    case 'porcion':
      return `${q} por porción${sh}`;
    case 'desayuno':
      return `${q} por desayuno${sh}`;
    case 'personaDia':
      return `${q} por persona al día`;
    case 'hogarSemana':
      return `${q} por semana para toda la casa`;
    case 'bebeDia':
      return `${q} al día para Gracia`;
    default:
      return 'Solo se descuenta lo que se anote';
  }
}

export function quickAmounts(p: Product): number[] {
  if (p.unit === 'und') {
    if (p.packageSize === 1) return [0.5, 1, 2, 3];
    if (p.packageSize >= 20) return [1, 2, 3, 6, 12];
    return [1, 2, 3, 5];
  }
  if (p.packageSize >= 2000) return [100, 250, 500, 1000];
  if (p.packageSize >= 500) return [50, 100, 250, 500];
  return [10, 25, 50, 100];
}
