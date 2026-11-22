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
  packageSize: number; // en la unidad base
  packageLabel: string; // ej. "cubeta x30"
  shelfLifeDays: number; // en su lugar por defecto
  freezerDays?: number; // si se puede congelar
  rule: ConsumptionRule;
  safetyDays: number; // colchón de seguridad
  substituteId?: string; // con qué se reemplaza si no alcanza a durar
  keywords: string[]; // otros nombres (para leer facturas)
  active: boolean;
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

export interface AppState {
  version: 1;
  people: Person[];
  products: Product[];
  movements: Movement[];
  receipts: Receipt[];
  aliases: Record<string, string>; // texto normalizado de factura → productId
  plans: QuincenaPlan[];
  checked: Record<string, boolean>; // `${planId}:${productId}` → comprado
  settings: Settings;
}
