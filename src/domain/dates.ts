import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(): ISODate {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUTC(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

/** Días desde a hasta b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function weekday(s: ISODate): number {
  return parseISO(s).getUTCDay();
}

/** Próximo 1 o 16 del mes (inicio de quincena), a partir de mañana. */
export function nextQuincenaStart(from: ISODate): ISODate {
  let d = addDays(from, 1);
  for (let i = 0; i < 40; i++) {
    const day = Number(d.slice(8, 10));
    if (day === 1 || day === 16) return d;
    d = addDays(d, 1);
  }
  return addDays(from, 15);
}

const fmt = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function fmtDate(s: ISODate): string {
  return fmt.format(parseISO(s)).replace(/\./g, '');
}

export function relDays(from: ISODate, to: ISODate): string {
  const n = diffDays(from, to);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n < 0) return `hace ${-n} días`;
  return `en ${n} días`;
}

export const WEEKDAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
