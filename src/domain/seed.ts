import { nextQuincenaStart, todayISO } from './dates';
import type { AppState, Category, Location, Person, Product, RuleType, Unit } from './types';

type Opts = {
  freezerDays?: number;
  safetyDays?: number;
  substituteId?: string;
  keywords?: string[];
  /** contar en paquetes: la cantidad pasa a "1 = una presentación" (ej. 'bolsa') */
  count?: string;
  /** nombre de la unidad cuando ya se cuenta por piezas (ej. 'huevo') */
  cn?: string;
  auto?: boolean;
};

/** Se descuentan solos (nadie anota cuándo usa jabón o sal). Lo fresco solo cambia cuando alguien anota. */
const AUTO_CATEGORIES: Category[] = ['Granos y despensa', 'Aseo hogar', 'Aseo personal', 'Bebé'];

function p(
  id: string,
  name: string,
  category: Category,
  location: Location,
  unit: Unit,
  packageSize: number,
  packageLabel: string,
  shelfLifeDays: number,
  rule: [RuleType, number, number?],
  o: Opts = {},
): Product {
  let u = unit;
  let size = packageSize;
  let qty = rule[1];
  let countName = o.cn ?? (unit === 'und' ? 'unidad' : undefined);
  if (o.count) {
    qty = rule[1] / packageSize;
    size = 1;
    u = 'und';
    countName = o.count;
  }
  return {
    id,
    name,
    category,
    location,
    unit: u,
    countName,
    auto: o.auto ?? AUTO_CATEGORIES.includes(category),
    packageSize: size,
    packageLabel,
    shelfLifeDays,
    freezerDays: o.freezerDays,
    rule: { type: rule[0], qty: Math.round(qty * 10000) / 10000, share: rule[2] },
    safetyDays: o.safetyDays ?? 3,
    substituteId: o.substituteId,
    keywords: o.keywords ?? [],
    active: true,
    v: 2,
  };
}

const FV: Category = 'Frutas y verduras';
const CP: Category = 'Carnes y pescado';
const LH: Category = 'Lácteos y huevos';
const PD: Category = 'Panadería y desayuno';
const GD: Category = 'Granos y despensa';
const AH: Category = 'Aseo hogar';
const AP: Category = 'Aseo personal';
const BB: Category = 'Bebé';

/**
 * Valores de arranque: son estimados razonables y se ajustan solos con los conteos.
 * porcion: cantidad por porción × fracción de comidas que lo llevan.
 */
export function seedProducts(): Product[] {
  return [
    // Frutas y verduras
    p('papa', 'Papa pastusa', FV, 'despensa', 'g', 2500, 'bolsa 2,5 kg', 21, ['porcion', 120, 0.35], { keywords: ['papa pastusa', 'papa sabanera', 'papa'] }),
    p('papa-criolla', 'Papa criolla', FV, 'nevera', 'g', 1000, 'bolsa 1 kg', 10, ['porcion', 80, 0.1], { substituteId: 'papa' }),
    p('platano-verde', 'Plátano verde', FV, 'despensa', 'und', 1, 'unidad', 10, ['porcion', 0.3, 0.2], { cn: 'plátano', keywords: ['platano harton', 'platano verde'] }),
    p('platano-maduro', 'Plátano maduro', FV, 'despensa', 'und', 1, 'unidad', 6, ['porcion', 0.3, 0.25], { cn: 'plátano', substituteId: 'platano-verde', keywords: ['platano maduro'] }),
    p('yuca', 'Yuca', FV, 'despensa', 'g', 1000, 'kg', 5, ['porcion', 100, 0.1], { freezerDays: 120 }),
    p('cebolla', 'Cebolla cabezona', FV, 'despensa', 'g', 1000, 'kg', 30, ['porcion', 25, 0.8], { keywords: ['cebolla blanca', 'cebolla roja', 'cebolla cabezona'] }),
    p('cebolla-larga', 'Cebolla larga', FV, 'nevera', 'g', 250, 'atado', 10, ['porcion', 10, 0.5], { count: 'atado', substituteId: 'cebolla', keywords: ['cebolla junca', 'cebolla larga'] }),
    p('tomate', 'Tomate chonto', FV, 'nevera', 'g', 1000, 'kg', 10, ['porcion', 40, 0.7], { freezerDays: 90, keywords: ['tomate chonto', 'tomate larga vida', 'tomate'] }),
    p('ajo', 'Ajo', FV, 'despensa', 'und', 1, 'cabeza', 60, ['porcion', 0.06, 0.8], { cn: 'cabeza' }),
    p('zanahoria', 'Zanahoria', FV, 'nevera', 'g', 1000, 'kg', 25, ['porcion', 30, 0.4]),
    p('lechuga', 'Lechuga', FV, 'nevera', 'und', 1, 'unidad', 6, ['porcion', 0.08, 0.3], { cn: 'lechuga', substituteId: 'repollo', keywords: ['lechuga crespa', 'lechuga batavia'] }),
    p('repollo', 'Repollo', FV, 'nevera', 'und', 1, 'unidad', 21, ['porcion', 0.06, 0.15], { cn: 'repollo' }),
    p('aguacate', 'Aguacate', FV, 'despensa', 'und', 1, 'unidad', 6, ['porcion', 0.25, 0.35], { cn: 'aguacate', keywords: ['aguacate hass', 'aguacate papelillo'] }),
    p('limon', 'Limón', FV, 'nevera', 'und', 10, 'bolsa x10', 20, ['porcion', 0.2, 0.5], { cn: 'limón', keywords: ['limon tahiti', 'limon'] }),
    p('brocoli', 'Brócoli', FV, 'nevera', 'g', 500, 'unidad (~500 g)', 7, ['porcion', 60, 0.15], { count: 'unidad', freezerDays: 180 }),
    p('ahuyama', 'Ahuyama', FV, 'despensa', 'g', 1000, 'kg', 30, ['porcion', 60, 0.1]),
    p('pepino', 'Pepino', FV, 'nevera', 'und', 1, 'unidad', 10, ['porcion', 0.1, 0.15], { cn: 'pepino', substituteId: 'zanahoria' }),
    p('cilantro', 'Cilantro', FV, 'nevera', 'g', 50, 'atado', 7, ['porcion', 2, 0.5], { count: 'atado', freezerDays: 90 }),
    p('banano', 'Banano', FV, 'despensa', 'und', 1, 'unidad', 6, ['personaDia', 0.35], { cn: 'banano', substituteId: 'manzana' }),
    p('manzana', 'Manzana', FV, 'nevera', 'und', 1, 'unidad', 25, ['personaDia', 0.2], { cn: 'manzana' }),
    p('naranja', 'Naranja (jugo)', FV, 'nevera', 'und', 12, 'bolsa x12', 20, ['desayuno', 1, 0.4], { cn: 'naranja', keywords: ['naranja tangelo', 'naranja valencia', 'naranja'] }),
    p('fresa', 'Fresas', FV, 'nevera', 'g', 500, 'caja 500 g', 5, ['personaDia', 10], { count: 'caja', freezerDays: 180 }),
    p('mango', 'Mango', FV, 'despensa', 'und', 1, 'unidad', 7, ['personaDia', 0.12], { cn: 'mango', substituteId: 'manzana' }),
    p('papaya', 'Papaya', FV, 'despensa', 'und', 1, 'unidad', 7, ['desayuno', 0.08, 0.5], { cn: 'papaya', substituteId: 'manzana' }),
    p('pulpa', 'Pulpa de fruta (jugos)', FV, 'congelador', 'g', 500, 'bolsa 500 g', 180, ['porcion', 40, 0.8], { count: 'bolsa', keywords: ['pulpa'] }),

    // Carnes y pescado
    p('pechuga', 'Pechuga de pollo', CP, 'congelador', 'g', 1000, 'kg', 180, ['porcion', 150, 0.25], { freezerDays: 180, keywords: ['pechuga'] }),
    p('pollo-presas', 'Pollo en presas', CP, 'congelador', 'g', 1000, 'kg', 180, ['porcion', 200, 0.1], { freezerDays: 180, keywords: ['pernil pollo', 'muslo pollo', 'alas pollo', 'pollo entero'] }),
    p('carne-molida', 'Carne molida', CP, 'congelador', 'g', 500, '500 g', 120, ['porcion', 120, 0.15], { freezerDays: 120, keywords: ['carne molida', 'molida'] }),
    p('carne-res', 'Carne de res', CP, 'congelador', 'g', 1000, 'kg', 180, ['porcion', 150, 0.15], { freezerDays: 180, keywords: ['sobrebarriga', 'bola negra', 'solomito', 'punta anca', 'murillo', 'carne res'] }),
    p('cerdo', 'Cerdo', CP, 'congelador', 'g', 1000, 'kg', 180, ['porcion', 150, 0.12], { freezerDays: 180, keywords: ['lomo cerdo', 'costilla cerdo', 'chuleta', 'cerdo'] }),
    p('pescado', 'Pescado (filete)', CP, 'congelador', 'g', 500, '500 g', 120, ['porcion', 150, 0.1], { freezerDays: 120, keywords: ['tilapia', 'basa', 'salmon', 'mojarra', 'filete pescado'] }),
    p('jamon', 'Jamón', CP, 'nevera', 'g', 250, 'paquete 250 g', 7, ['desayuno', 20, 0.2], { count: 'paquete', freezerDays: 60 }),

    // Lácteos y huevos
    p('huevos', 'Huevos', LH, 'despensa', 'und', 30, 'cubeta x30', 25, ['desayuno', 1.5, 0.7], { cn: 'huevo', keywords: ['huevo'] }),
    p('leche', 'Leche entera', LH, 'despensa', 'ml', 1100, 'bolsa 1,1 L', 90, ['desayuno', 150, 0.8], { count: 'bolsa', keywords: ['leche entera', 'leche uht', 'leche larga vida'] }),
    p('queso-campesino', 'Queso campesino', LH, 'nevera', 'g', 500, 'unidad ~500 g', 7, ['desayuno', 30, 0.4], { count: 'unidad', freezerDays: 60, keywords: ['queso campesino', 'queso costeno', 'cuajada'] }),
    p('queso-tajado', 'Queso tajado', LH, 'nevera', 'g', 250, 'paquete 250 g', 15, ['desayuno', 20, 0.3], { count: 'paquete', keywords: ['queso tajado', 'queso mozzarella', 'queso sabana'] }),
    p('mantequilla', 'Mantequilla', LH, 'nevera', 'g', 250, 'barra 250 g', 60, ['desayuno', 5, 0.6], { count: 'barra', keywords: ['margarina'] }),
    p('yogurt', 'Yogurt / kumis', LH, 'nevera', 'ml', 1000, 'garrafa 1 L', 15, ['personaDia', 30], { count: 'garrafa', keywords: ['kumis', 'yogur'] }),

    // Panadería y desayuno
    p('arepas', 'Arepas', PD, 'nevera', 'und', 10, 'paquete x10', 10, ['desayuno', 1.2, 0.6], { cn: 'arepa', freezerDays: 60, keywords: ['arepa'] }),
    p('pan', 'Pan tajado', PD, 'despensa', 'und', 20, 'bolsa (~20 tajadas)', 7, ['desayuno', 2, 0.3], { count: 'bolsa', freezerDays: 60, keywords: ['pan tajado', 'pan blanco', 'pan integral'] }),
    p('cafe', 'Café', PD, 'despensa', 'g', 500, 'bolsa 500 g', 180, ['desayuno', 10, 0.8], { count: 'bolsa', auto: true }),
    p('chocolate', 'Chocolate de mesa', PD, 'despensa', 'g', 500, 'paquete 500 g', 365, ['desayuno', 20, 0.2], { count: 'paquete', auto: true }),
    p('avena', 'Avena', PD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['desayuno', 30, 0.2], { count: 'bolsa', auto: true }),
    p('azucar', 'Azúcar', PD, 'despensa', 'g', 2500, 'bolsa 2,5 kg', 730, ['desayuno', 12, 1], { count: 'bolsa', auto: true }),
    p('galletas', 'Galletas / mecato', PD, 'despensa', 'und', 12, 'paquete x12', 90, ['hogarSemana', 8], { count: 'paquete', keywords: ['galleta'] }),

    // Granos y despensa
    p('arroz', 'Arroz', GD, 'despensa', 'g', 5000, 'bolsa 5 kg', 365, ['porcion', 70, 0.75], { count: 'bolsa' }),
    p('frijol', 'Fríjol', GD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['porcion', 60, 0.12], { count: 'bolsa', keywords: ['frijol cargamanto', 'frijoles'] }),
    p('lenteja', 'Lentejas', GD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['porcion', 50, 0.1], { count: 'bolsa' }),
    p('garbanzo', 'Garbanzos', GD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['porcion', 50, 0.05], { count: 'bolsa' }),
    p('pasta', 'Pasta', GD, 'despensa', 'g', 500, 'caja 500 g', 365, ['porcion', 80, 0.12], { count: 'caja', keywords: ['espagueti', 'spaghetti', 'macarron', 'tornillo', 'fideo'] }),
    p('aceite', 'Aceite', GD, 'despensa', 'ml', 3000, 'garrafa 3 L', 365, ['porcion', 10, 1], { count: 'garrafa' }),
    p('sal', 'Sal', GD, 'despensa', 'g', 1000, 'bolsa 1 kg', 730, ['hogarSemana', 100], { count: 'bolsa' }),
    p('atun', 'Atún en lata', GD, 'despensa', 'und', 1, 'lata', 730, ['porcion', 0.33, 0.05], { cn: 'lata' }),
    p('salsa-tomate', 'Salsa de tomate', GD, 'despensa', 'g', 400, 'frasco 400 g', 180, ['hogarSemana', 100], { count: 'frasco' }),
    p('condimentos', 'Condimentos (comino, color, caldo)', GD, 'despensa', 'g', 100, 'paquete', 365, ['hogarSemana', 30], { count: 'paquete', keywords: ['comino', 'color', 'caldo', 'triguisar', 'sazonador', 'pimienta'] }),

    // Aseo hogar
    p('detergente', 'Detergente para ropa', AH, 'aseo', 'g', 3000, 'bolsa 3 kg', 730, ['hogarSemana', 1200], { count: 'bolsa', keywords: ['detergente polvo', 'detergente liquido'] }),
    p('suavizante', 'Suavizante', AH, 'aseo', 'ml', 1000, 'botella 1 L', 730, ['hogarSemana', 400], { count: 'botella' }),
    p('lavaloza', 'Lavaloza', AH, 'aseo', 'g', 500, 'tarro 500 g', 730, ['porcion', 2, 1], { count: 'tarro', keywords: ['lavaloza crema', 'loza'] }),
    p('esponja', 'Esponjas', AH, 'aseo', 'und', 3, 'paquete x3', 730, ['hogarSemana', 1], { cn: 'esponja' }),
    p('cloro', 'Blanqueador (cloro)', AH, 'aseo', 'ml', 1000, 'botella 1 L', 365, ['hogarSemana', 500], { count: 'botella', keywords: ['blanqueador', 'limpido', 'cloro'] }),
    p('limpiapisos', 'Limpiador de pisos', AH, 'aseo', 'ml', 1000, 'botella 1 L', 730, ['hogarSemana', 400], { count: 'botella', keywords: ['limpiador pisos', 'limpia pisos', 'desinfectante'] }),
    p('bolsas-basura', 'Bolsas de basura', AH, 'aseo', 'und', 10, 'paquete x10', 730, ['hogarSemana', 7], { cn: 'bolsa', keywords: ['bolsa basura'] }),
    p('toallas-cocina', 'Toallas de cocina', AH, 'aseo', 'und', 3, 'paquete x3 rollos', 730, ['hogarSemana', 1.5], { cn: 'rollo', keywords: ['toalla cocina', 'servilleta'] }),

    // Aseo personal
    p('jabon-manos', 'Jabón de manos', AP, 'aseo', 'ml', 500, 'frasco 500 ml', 730, ['personaDia', 5], { count: 'frasco', keywords: ['jabon liquido', 'jabon manos', 'antibacterial'] }),
    p('papel-higienico', 'Papel higiénico', AP, 'aseo', 'und', 12, 'paquete x12 rollos', 730, ['personaDia', 0.25], { cn: 'rollo', keywords: ['papel higienico'] }),
    p('crema-dental', 'Crema dental', AP, 'aseo', 'g', 100, 'tubo 100 g', 730, ['personaDia', 1.2], { count: 'tubo', keywords: ['crema dental', 'pasta dental'] }),
    p('jabon-bano', 'Jabón de baño', AP, 'aseo', 'und', 3, 'paquete x3 barras', 730, ['personaDia', 0.04], { cn: 'barra', keywords: ['jabon barra', 'jabon tocador'] }),
    p('shampoo', 'Shampoo', AP, 'aseo', 'ml', 400, 'frasco 400 ml', 730, ['personaDia', 8], { count: 'frasco', keywords: ['champu'] }),

    // Bebé
    p('panales', 'Pañales Gracia', BB, 'bebe', 'und', 50, 'paquete x50', 730, ['bebeDia', 5], { count: 'paquete', keywords: ['panal', 'panales'] }),
    p('panitos', 'Pañitos húmedos', BB, 'bebe', 'und', 100, 'paquete x100', 365, ['bebeDia', 12], { count: 'paquete', keywords: ['panitos', 'toallitas humedas'] }),
    p('leche-gracia', 'Leche Gracia', BB, 'despensa', 'ml', 1100, 'bolsa 1,1 L', 90, ['bebeDia', 450], { count: 'bolsa' }),
    p('yogurt-gracia', 'Yogurt Gracia', BB, 'nevera', 'und', 6, 'paquete x6', 20, ['bebeDia', 1], { cn: 'yogurt', keywords: ['yogurt bebe'] }),
    p('compota', 'Compotas', BB, 'bebe', 'und', 1, 'unidad', 365, ['bebeDia', 0.5], { cn: 'compota' }),
    p('crema-panal', 'Crema antipañalitis', BB, 'bebe', 'g', 110, 'tubo 110 g', 730, ['bebeDia', 2], { count: 'tubo', keywords: ['antipanalitis'] }),
    p('shampoo-bebe', 'Shampoo bebé', BB, 'bebe', 'ml', 400, 'frasco 400 ml', 730, ['bebeDia', 5], { count: 'frasco', keywords: ['shampoo bebe'] }),
  ];
}

const ALL = [0, 1, 2, 3, 4, 5, 6];
const M3 = { desayuno: true, almuerzo: true, cena: true };
const M2 = { desayuno: true, almuerzo: true, cena: false };

export function seedPeople(): Person[] {
  const res = (id: string, name: string): Person => ({ id, name, type: 'residente', days: ALL, meals: M3, personalFactor: 1, portionFactor: 1, active: true });
  return [
    res('adulto-1', 'Adulto 1'),
    res('adulto-2', 'Adulto 2'),
    res('adulto-3', 'Adulto 3'),
    res('rosita', 'Rosita'),
    { id: 'tati', name: 'Tati', type: 'empleada', days: [2, 3, 4, 5, 6], meals: M2, personalFactor: 0.5, portionFactor: 1, active: true },
    { id: 'erica', name: 'Érica', type: 'empleada', days: [1, 2, 3, 4, 5], meals: M2, personalFactor: 0.5, portionFactor: 1, active: true },
    { id: 'gracia', name: 'Gracia', type: 'bebe', days: ALL, meals: { desayuno: false, almuerzo: true, cena: true }, personalFactor: 1, portionFactor: 0.4, active: true },
  ];
}

export function createInitialState(today = todayISO()): AppState {
  return {
    version: 2,
    people: seedPeople(),
    products: seedProducts(),
    movements: [],
    receipts: [],
    aliases: {},
    plans: [],
    checked: {},
    list: [],
    notes: [],
    settings: { sundayOut: 0.5, quincenaDays: 15, nextMarket: nextQuincenaStart(today) },
  };
}
