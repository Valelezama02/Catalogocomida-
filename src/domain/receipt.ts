import type { Product, Unit } from './types';

/**
 * Lectura de facturas físicas (texto que sale del OCR) con reglas fijas.
 * No adivina con IA: separa líneas, busca precio al final, cantidades y tamaños,
 * y empareja con el catálogo por palabras. Siempre hay pantalla de revisión.
 */

export interface ParsedLine {
  raw: string;
  description: string;
  count: number; // unidades compradas
  weightKg?: number; // si se vendió al peso
  sizeQty?: number; // tamaño del paquete leído en la descripción (unidad base)
  sizeUnit?: Unit;
  price?: number;
}

const SKIP =
  /\b(SUB ?TOTAL|TOTAL|IVA|NIT|CAMBIO|EFECTIVO|TARJETA|FACTURA|CAJER[OA]|FECHA|HORA|DIRECCION|RESOLUCION|GRACIAS|CLIENTE|TEL|TELEFONO|DEBITO|CREDITO|DESCUENTOS?|AHORRO|PUNTOS|REDEBAN|DATAFONO|RECIBIDO|BASE|IMPUESTOS?|CUFE|AUTORIZA|PREFIJO|PAGO|ITEMS|ARTICULOS|TIQUETE|VENTA|REGIMEN|NRO|NUMERO|VR|VALOR|CANT|DESCRIPCION|PRECIO|SALDO|DEVUELTA|VISA|MASTERCARD|APROBADO|COMPROBANTE|WWW|COM)\b/;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'para', 'por', 'und', 'un', 'kg', 'gr', 'grs', 'ml', 'lt', 'lts', 'x', 'en', 'y', 'cc', 'pague', 'lleve', 'oferta', 'precio', 'especial']);

function stem(t: string): string {
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t))
    .map(stem);
}

/** Clave para el diccionario de equivalencias (texto de factura → producto). */
export function aliasKey(description: string): string {
  return tokens(description).join(' ');
}

function parseNumber(s: string): number {
  // "1,250" o "1.250" con KG → 1.25 ; precios "15.900" → 15900 (se maneja aparte)
  return Number(s.replace(',', '.'));
}

function parsePrice(s: string): number {
  return Number(s.replace(/[$\s.,]/g, ''));
}

const PRICE_END = /(\$?\s?\d{1,3}(?:[.,]\d{3})+|\$?\s?\d{4,7})\s*[A-Z*]?\s*$/;
const QTY_LINE = /^(\d+(?:[.,]\d+)?)\s*(KG|KGS|KL|UN|UND|UNID|X|\*)\b/;
const SIZE = /(\d+(?:[.,]\d+)?)\s*(KG|KGS|KILO|K|GR|GRS|GRAMOS|G|ML|CC|LT|LTS|L|LITRO|LITROS)\b/;
const PACK = /\bX\s?(\d{1,3})\b/;

function readSize(desc: string): { sizeQty?: number; sizeUnit?: Unit } {
  const m = desc.match(SIZE);
  if (m) {
    const n = parseNumber(m[1]);
    const u = m[2];
    if (['KG', 'KGS', 'KILO', 'K'].includes(u)) return { sizeQty: n * 1000, sizeUnit: 'g' };
    if (['GR', 'GRS', 'GRAMOS', 'G'].includes(u)) return { sizeQty: n, sizeUnit: 'g' };
    if (['ML', 'CC'].includes(u)) return { sizeQty: n, sizeUnit: 'ml' };
    return { sizeQty: n * 1000, sizeUnit: 'ml' };
  }
  const pk = desc.match(PACK);
  if (pk) return { sizeQty: Number(pk[1]), sizeUnit: 'und' };
  return {};
}

export function parseReceiptText(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  let pending: { count: number; weightKg?: number } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw) continue;
    const up = raw
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
    if (SKIP.test(up)) {
      pending = null;
      continue;
    }

    let line = up.replace(/^\d{6,14}\s+/, ''); // código de barras al inicio
    const letters = line.replace(/[^A-Z]/g, '');

    // Línea solo de cantidad: "2 X 3.450" o "1,250 KG X 12.990"
    const q = line.match(QTY_LINE);
    if (q && letters.replace(/^(KG|KGS|KL|UN|UND|UNID)?X?/, '').length < 3) {
      const n = parseNumber(q[1]);
      pending = q[2].startsWith('K') ? { count: 1, weightKg: n } : { count: Math.max(1, Math.round(n)) };
      continue;
    }
    if (letters.length < 3) continue;

    let price: number | undefined;
    const pm = line.match(PRICE_END);
    if (pm) {
      price = parsePrice(pm[1]);
      line = line.slice(0, pm.index).trim();
    } else {
      continue; // sin precio no se considera línea de producto
    }

    let count = 1;
    let weightKg: number | undefined;
    // cantidad al inicio: "2 X ARROZ" / "2 ARROZ"
    const lead = line.match(/^(\d{1,2})\s*(?:X|\*)?\s+(?=[A-Z])/);
    if (lead) {
      count = Number(lead[1]);
      line = line.slice(lead[0].length);
    }
    // peso en la misma línea: "1,250 KG"
    const w = line.match(/(\d+[.,]\d+)\s*KG\b/);
    if (w && !lead) {
      weightKg = parseNumber(w[1]);
      line = line.replace(w[0], ' ').trim();
    }
    if (pending) {
      count = pending.count;
      weightKg = pending.weightKg ?? weightKg;
      pending = null;
    }
    const description = line.replace(/\s+/g, ' ').trim();
    if (description.replace(/[^A-Z]/g, '').length < 3) continue;
    out.push({ raw, description, count, weightKg, ...readSize(description), price });
  }
  return out;
}

function scoreName(dt: string[], name: string): number {
  const nt = tokens(name);
  if (nt.length === 0) return 0;
  let hit = 0;
  for (const t of nt) {
    if (dt.some((d) => d === t || (t.length >= 5 && d.length >= 5 && d.slice(0, 5) === t.slice(0, 5)))) hit++;
  }
  return hit === 0 ? 0 : hit / nt.length + hit * 0.01;
}

export function matchProduct(description: string, products: Product[], aliases: Record<string, string>): Product | undefined {
  const key = aliasKey(description);
  if (aliases[key]) {
    const p = products.find((x) => x.id === aliases[key] && x.active);
    if (p) return p;
  }
  const dt = tokens(description);
  let best: Product | undefined;
  let bestScore = 0;
  for (const p of products) {
    if (!p.active) continue;
    for (const n of [p.name, ...p.keywords]) {
      const s = scoreName(dt, n);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

/** Cantidad comprada en la unidad base del producto. */
export function baseQty(line: Pick<ParsedLine, 'count' | 'weightKg' | 'sizeQty' | 'sizeUnit'>, product: Product): number {
  if (line.weightKg != null) {
    if (product.unit === 'und') return line.count;
    return Math.round(line.weightKg * 1000);
  }
  if (line.sizeQty && line.sizeUnit === product.unit) return line.count * line.sizeQty;
  return line.count * product.packageSize;
}
