export type ISODate = string; // YYYY-MM-DD

export type Unit = 'g' | 'ml' | 'und';
export type Location = 'nevera' | 'congelador' | 'despensa' | 'aseo' | 'bebe';

export const CATEGORIES = [
  'Frutas y verduras',
  'Carnes y pescado',
  'Lácteos y huevos',
  'Panadería y desayuno',
  'Granos y despensa',
  'Aseo hogar',
  'Aseo personal',
  'Bebé',
  'Otros',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LOCATIONS: { id: Location; label: string }[] = [
  { id: 'nevera', label: 'Nevera' },
  { id: 'congelador', label: 'Congelador' },
  { id: 'despensa', label: 'Despensa' },
  { id: 'aseo', label: 'Aseo' },
  { id: 'bebe', label: 'Cosas de Gracia' },
];

/**
 * Cómo se gasta un producto (reglas fijas, sin IA):
 * - porcion:     qty por porción cocinada (almuerzo/cena) × share (fracción de comidas que lo llevan)
 * - desayuno:    qty por desayuno × share
 * - personaDia:  qty por persona-día en casa (ponderado por personalFactor)
 * - hogarSemana: qty por semana, fija
 * - bebeDia:     qty por día de la bebé en casa
 * - manual:      no se estima; solo cuenta lo que se anota
 */
export type RuleType = 'porcion' | 'desayuno' | 'personaDia' | 'hogarSemana' | 'bebeDia' | 'manual';

export interface ConsumptionRule {
  type: RuleType;
  qty: number;
  share?: number;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  location: Location;
  unit: Unit;
  countName?: string; // si unit = 'und': en qué se cuenta (bolsa, paquete, huevo…)
  auto: boolean; // true: se descuenta solo según la regla; false: solo cuando alguien anota
  packageSize: number; // en la unidad base
  packageLabel: string; // ej. "cubeta x30"
  shelfLifeDays: number; // en su lugar por defecto
  freezerDays?: number; // si se puede congelar
  rule: ConsumptionRule;
  safetyDays: number; // colchón de seguridad
  substituteId?: string; // con qué se reemplaza si no alcanza a durar
  keywords: string[]; // otros nombres (para leer facturas)
  active: boolean;
  v?: number; // versión del formato de unidades (2 = actual)
  legacyFactor?: number; // para convertir datos viejos a la unidad nueva
}

export type PersonType = 'residente' | 'empleada' | 'bebe';

export interface Person {
  id: string;
  name: string;
  type: PersonType;
  days: number[]; // 0 = domingo … 6 = sábado
  meals: { desayuno: boolean; almuerzo: boolean; cena: boolean };
  personalFactor: number; // peso en aseo personal (1 = todo el día en casa)
  portionFactor: number; // tamaño de porción (1 = adulto)
  active: boolean;
}

export type MovementType = 'compra' | 'uso' | 'conteo' | 'descarte' | 'congelar';

export interface Movement {
  id: string;
  productId: string;
  type: MovementType;
  qty: number; // unidad base del producto
  date: ISODate;
  createdAt: string; // ISO datetime, para ordenar
  by?: string; // personId de quien anotó
  location?: Location; // compras
  expiry?: ISODate; // compras: vencimiento (editable)
  receiptId?: string;
  v?: number;
}

export interface ReceiptLine {
  id: string;
  raw?: string;
  productId?: string;
  qty: number;
  location: Location;
  expiry: ISODate;
  price?: number;
}

export interface Receipt {
  id: string;
  date: ISODate;
  store: string;
  source: 'foto' | 'manual';
  lines: ReceiptLine[];
  createdAt: string;
  by?: string;
  v?: number;
}

/** Respuestas del cuestionario antes de cada mercado. */
export interface QuincenaPlan {
  id: string;
  start: ISODate; // día del mercado
  end: ISODate; // día del siguiente mercado (exclusivo)
  absentDays: Record<string, number>; // personId → días que NO va a estar
  sundayOut: number; // 0 = comen en casa, 0.5 = a veces fuera, 1 = siempre fuera
  meals: { desayuno: boolean; almuerzo: boolean; cena: boolean };
  guestMeals: number; // comidas extra de invitados en toda la quincena
  createdAt: string;
}

export interface Settings {
  sundayOut: number;
  quincenaDays: number;
  nextMarket: ISODate;
}

/** Algo que hace falta comprar (lo anotan las personas de la casa). */
export interface ListItem {
  id: string;
  productId?: string;
  text: string; // nombre (del catálogo o libre)
  qty?: number; // en la unidad del producto
  qtyText?: string; // cantidad libre si no es del catálogo
  note?: string;
  by?: string; // nombre de quien lo pidió
  checked: boolean;
  createdAt: string;
}

/** Nota para la casa. */
export interface Note {
  id: string;
  text: string;
  by?: string;
  done: boolean;
  createdAt: string;
}

export interface AppState {
  version: number;
  people: Person[];
  products: Product[];
  movements: Movement[];
  receipts: Receipt[];
  aliases: Record<string, string>; // texto normalizado de factura → productId
  plans: QuincenaPlan[];
  checked: Record<string, boolean>; // (formato viejo, ya no se usa)
  list: ListItem[];
  notes: Note[];
  settings: Settings;
}
