import type { ConsumptionRule, Product, Unit } from './types';

function num(x: number): string {
  const r = Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x);
  return r.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

export function fmtUnitQty(q: number, unit: Unit): string {
  if (unit === 'g') return q >= 1000 ? `${num(q / 1000)} kg` : `${num(q)} g`;
  if (unit === 'ml') return q >= 1000 ? `${num(q / 1000)} L` : `${num(q)} ml`;
  return `${num(q)} und`;
}

export const fmtQty = (q: number, p: Product) => fmtUnitQty(q, p.unit);

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
  const q = fmtUnitQty(r.qty, p.unit);
  const sh = r.share != null && r.share < 1 ? `, en ${Math.round(r.share * 100)}% de las comidas` : '';
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
    if (p.packageSize >= 20) return [1, 2, 3, 6, 12];
    return [1, 2, 3, 5];
  }
  if (p.packageSize >= 2000) return [100, 250, 500, 1000];
  if (p.packageSize >= 500) return [50, 100, 250, 500];
  return [10, 25, 50, 100];
}
