import { nextQuincenaStart, todayISO } from './dates';
import type { AppState, Category, Location, Person, Product, RuleType, Unit } from './types';

type Opts = { freezerDays?: number; safetyDays?: number; substituteId?: string; keywords?: string[] };

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
  return {
    id,
    name,
    category,
    location,
    unit,
    packageSize,
    packageLabel,
    shelfLifeDays,
    freezerDays: o.freezerDays,
    rule: { type: rule[0], qty: rule[1], share: rule[2] },
    safetyDays: o.safetyDays ?? 3,
    substituteId: o.substituteId,
    keywords: o.keywords ?? [],
    active: true,
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
    p('platano-verde', 'Plátano verde', FV, 'despensa', 'und', 1, 'unidad', 10, ['porcion', 0.3, 0.2], { keywords: ['platano harton', 'platano verde'] }),
    p('platano-maduro', 'Plátano maduro', FV, 'despensa', 'und', 1, 'unidad', 6, ['porcion', 0.3, 0.25], { substituteId: 'platano-verde', keywords: ['platano maduro'] }),
    p('yuca', 'Yuca', FV, 'despensa', 'g', 1000, 'kg', 5, ['porcion', 100, 0.1], { freezerDays: 120 }),
    p('cebolla', 'Cebolla cabezona', FV, 'despensa', 'g', 1000, 'kg', 30, ['porcion', 25, 0.8], { keywords: ['cebolla blanca', 'cebolla roja', 'cebolla cabezona'] }),
    p('cebolla-larga', 'Cebolla larga', FV, 'nevera', 'g', 250, 'atado', 10, ['porcion', 10, 0.5], { substituteId: 'cebolla', keywords: ['cebolla junca', 'cebolla larga'] }),
    p('tomate', 'Tomate chonto', FV, 'nevera', 'g', 1000, 'kg', 10, ['porcion', 40, 0.7], { freezerDays: 90, keywords: ['tomate chonto', 'tomate larga vida', 'tomate'] }),
    p('ajo', 'Ajo', FV, 'despensa', 'g', 250, 'malla', 60, ['porcion', 3, 0.8]),
    p('zanahoria', 'Zanahoria', FV, 'nevera', 'g', 1000, 'kg', 25, ['porcion', 30, 0.4]),
    p('lechuga', 'Lechuga', FV, 'nevera', 'und', 1, 'unidad', 6, ['porcion', 0.08, 0.3], { substituteId: 'repollo', keywords: ['lechuga crespa', 'lechuga batavia'] }),
    p('repollo', 'Repollo', FV, 'nevera', 'und', 1, 'unidad', 21, ['porcion', 0.06, 0.15]),
    p('aguacate', 'Aguacate', FV, 'despensa', 'und', 1, 'unidad', 6, ['porcion', 0.25, 0.35], { keywords: ['aguacate hass', 'aguacate papelillo'] }),
    p('limon', 'Limón', FV, 'nevera', 'und', 10, 'bolsa x10', 20, ['porcion', 0.2, 0.5], { keywords: ['limon tahiti', 'limon'] }),
    p('brocoli', 'Brócoli', FV, 'nevera', 'g', 500, 'unidad (~500 g)', 7, ['porcion', 60, 0.15], { freezerDays: 180 }),
    p('ahuyama', 'Ahuyama', FV, 'despensa', 'g', 1000, 'kg', 30, ['porcion', 60, 0.1]),
    p('pepino', 'Pepino', FV, 'nevera', 'und', 1, 'unidad', 10, ['porcion', 0.1, 0.15], { substituteId: 'zanahoria' }),
    p('cilantro', 'Cilantro', FV, 'nevera', 'g', 50, 'atado', 7, ['porcion', 2, 0.5], { freezerDays: 90 }),
    p('banano', 'Banano', FV, 'despensa', 'und', 1, 'unidad', 6, ['personaDia', 0.35], { substituteId: 'manzana' }),
    p('manzana', 'Manzana', FV, 'nevera', 'und', 1, 'unidad', 25, ['personaDia', 0.2]),
    p('naranja', 'Naranja (jugo)', FV, 'nevera', 'und', 12, 'bolsa x12', 20, ['desayuno', 1, 0.4], { keywords: ['naranja tangelo', 'naranja valencia', 'naranja'] }),
    p('fresa', 'Fresas', FV, 'nevera', 'g', 500, 'caja 500 g', 5, ['personaDia', 10], { freezerDays: 180 }),
    p('mango', 'Mango', FV, 'despensa', 'und', 1, 'unidad', 7, ['personaDia', 0.12], { substituteId: 'manzana' }),
    p('papaya', 'Papaya', FV, 'despensa', 'und', 1, 'unidad', 7, ['desayuno', 0.08, 0.5], { substituteId: 'manzana' }),
    p('pulpa', 'Pulpa de fruta (jugos)', FV, 'congelador', 'g', 500, 'bolsa 500 g', 180, ['porcion', 40, 0.8], { keywords: ['pulpa'] }),

    // Carnes y pescado
    p('pechuga', 'Pechuga de pollo', CP, 'nevera', 'g', 1000, 'kg', 2, ['porcion', 150, 0.25], { freezerDays: 180, keywords: ['pechuga'] }),
    p('pollo-presas', 'Pollo en presas', CP, 'nevera', 'g', 1000, 'kg', 2, ['porcion', 200, 0.1], { freezerDays: 180, keywords: ['pernil pollo', 'muslo pollo', 'alas pollo', 'pollo entero'] }),
    p('carne-molida', 'Carne molida', CP, 'nevera', 'g', 500, '500 g', 2, ['porcion', 120, 0.15], { freezerDays: 120, keywords: ['carne molida', 'molida'] }),
    p('carne-res', 'Carne de res', CP, 'nevera', 'g', 1000, 'kg', 3, ['porcion', 150, 0.15], { freezerDays: 180, keywords: ['sobrebarriga', 'bola negra', 'solomito', 'punta anca', 'murillo', 'carne res'] }),
    p('cerdo', 'Cerdo', CP, 'nevera', 'g', 1000, 'kg', 3, ['porcion', 150, 0.12], { freezerDays: 180, keywords: ['lomo cerdo', 'costilla cerdo', 'chuleta', 'cerdo'] }),
    p('pescado', 'Pescado (filete)', CP, 'nevera', 'g', 500, '500 g', 1, ['porcion', 150, 0.1], { freezerDays: 120, keywords: ['tilapia', 'basa', 'salmon', 'mojarra', 'filete pescado'] }),
    p('jamon', 'Jamón', CP, 'nevera', 'g', 250, 'paquete 250 g', 7, ['desayuno', 20, 0.2], { freezerDays: 60 }),

    // Lácteos y huevos
    p('huevos', 'Huevos', LH, 'despensa', 'und', 30, 'cubeta x30', 25, ['desayuno', 1.5, 0.7], { keywords: ['huevo'] }),
    p('leche', 'Leche entera', LH, 'despensa', 'ml', 1100, 'bolsa 1,1 L', 90, ['desayuno', 150, 0.8], { keywords: ['leche entera', 'leche uht', 'leche larga vida'] }),
    p('queso-campesino', 'Queso campesino', LH, 'nevera', 'g', 500, '500 g', 7, ['desayuno', 30, 0.4], { freezerDays: 60, keywords: ['queso campesino', 'queso costeno', 'cuajada'] }),
    p('queso-tajado', 'Queso tajado', LH, 'nevera', 'g', 250, 'paquete 250 g', 15, ['desayuno', 20, 0.3], { keywords: ['queso tajado', 'queso mozzarella', 'queso sabana'] }),
    p('mantequilla', 'Mantequilla', LH, 'nevera', 'g', 250, 'barra 250 g', 60, ['desayuno', 5, 0.6], { keywords: ['margarina'] }),
    p('yogurt', 'Yogurt / kumis', LH, 'nevera', 'ml', 1000, 'garrafa 1 L', 15, ['personaDia', 30], { keywords: ['kumis', 'yogur'] }),

    // Panadería y desayuno
    p('arepas', 'Arepas', PD, 'nevera', 'und', 10, 'paquete x10', 10, ['desayuno', 1.2, 0.6], { freezerDays: 60, keywords: ['arepa'] }),
    p('pan', 'Pan tajado', PD, 'despensa', 'und', 20, 'bolsa (~20 tajadas)', 7, ['desayuno', 2, 0.3], { freezerDays: 60, keywords: ['pan tajado', 'pan blanco', 'pan integral'] }),
    p('cafe', 'Café', PD, 'despensa', 'g', 500, 'bolsa 500 g', 180, ['desayuno', 10, 0.8]),
    p('chocolate', 'Chocolate de mesa', PD, 'despensa', 'g', 500, 'pastilla 500 g', 365, ['desayuno', 20, 0.2]),
    p('avena', 'Avena', PD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['desayuno', 30, 0.2]),
    p('azucar', 'Azúcar', PD, 'despensa', 'g', 2500, 'bolsa 2,5 kg', 730, ['desayuno', 12, 1]),
    p('galletas', 'Galletas / mecato', PD, 'despensa', 'und', 12, 'paquete x12', 90, ['hogarSemana', 8], { keywords: ['galleta'] }),

    // Granos y despensa
    p('arroz', 'Arroz', GD, 'despensa', 'g', 5000, 'bolsa 5 kg', 365, ['porcion', 70, 0.75]),
    p('frijol', 'Fríjol', GD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['porcion', 60, 0.12], { keywords: ['frijol cargamanto', 'frijoles'] }),
    p('lenteja', 'Lentejas', GD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['porcion', 50, 0.1]),
    p('garbanzo', 'Garbanzos', GD, 'despensa', 'g', 500, 'bolsa 500 g', 365, ['porcion', 50, 0.05]),
    p('pasta', 'Pasta', GD, 'despensa', 'g', 500, 'paquete 500 g', 365, ['porcion', 80, 0.12], { keywords: ['espagueti', 'spaghetti', 'macarron', 'tornillo', 'fideo'] }),
    p('aceite', 'Aceite', GD, 'despensa', 'ml', 3000, 'garrafa 3 L', 365, ['porcion', 10, 1]),
    p('sal', 'Sal', GD, 'despensa', 'g', 1000, 'bolsa 1 kg', 730, ['hogarSemana', 100]),
    p('atun', 'Atún en lata', GD, 'despensa', 'und', 1, 'lata', 730, ['porcion', 0.33, 0.05]),
    p('salsa-tomate', 'Salsa de tomate', GD, 'despensa', 'g', 400, 'frasco 400 g', 180, ['hogarSemana', 100]),
    p('condimentos', 'Condimentos (comino, color, caldo)', GD, 'despensa', 'g', 100, 'paquete', 365, ['hogarSemana', 30], { keywords: ['comino', 'color', 'caldo', 'triguisar', 'sazonador', 'pimienta'] }),

    // Aseo hogar
    p('detergente', 'Detergente para ropa', AH, 'aseo', 'g', 3000, 'bolsa 3 kg', 730, ['hogarSemana', 1200], { keywords: ['detergente polvo', 'detergente liquido'] }),
    p('suavizante', 'Suavizante', AH, 'aseo', 'ml', 1000, '1 L', 730, ['hogarSemana', 400]),
    p('lavaloza', 'Lavaloza', AH, 'aseo', 'g', 500, 'crema 500 g', 730, ['porcion', 2, 1], { keywords: ['lavaloza crema', 'loza'] }),
    p('esponja', 'Esponjas', AH, 'aseo', 'und', 3, 'paquete x3', 730, ['hogarSemana', 1]),
    p('cloro', 'Blanqueador (cloro)', AH, 'aseo', 'ml', 1000, '1 L', 365, ['hogarSemana', 500], { keywords: ['blanqueador', 'limpido', 'cloro'] }),
    p('limpiapisos', 'Limpiador de pisos', AH, 'aseo', 'ml', 1000, '1 L', 730, ['hogarSemana', 400], { keywords: ['limpiador pisos', 'limpia pisos', 'desinfectante'] }),
    p('bolsas-basura', 'Bolsas de basura', AH, 'aseo', 'und', 10, 'paquete x10', 730, ['hogarSemana', 7], { keywords: ['bolsa basura'] }),
    p('toallas-cocina', 'Toallas de cocina', AH, 'aseo', 'und', 3, 'paquete x3 rollos', 730, ['hogarSemana', 1.5], { keywords: ['toalla cocina', 'servilleta'] }),

    // Aseo personal
    p('jabon-manos', 'Jabón de manos', AP, 'aseo', 'ml', 500, 'frasco 500 ml', 730, ['personaDia', 5], { keywords: ['jabon liquido', 'jabon manos', 'antibacterial'] }),
    p('papel-higienico', 'Papel higiénico', AP, 'aseo', 'und', 12, 'paquete x12 rollos', 730, ['personaDia', 0.25], { keywords: ['papel higienico'] }),
    p('crema-dental', 'Crema dental', AP, 'aseo', 'g', 100, 'tubo 100 g', 730, ['personaDia', 1.2], { keywords: ['crema dental', 'pasta dental'] }),
    p('jabon-bano', 'Jabón de baño', AP, 'aseo', 'und', 3, 'paquete x3 barras', 730, ['personaDia', 0.04], { keywords: ['jabon barra', 'jabon tocador'] }),
    p('shampoo', 'Shampoo', AP, 'aseo', 'ml', 400, 'frasco 400 ml', 730, ['personaDia', 8], { keywords: ['champu'] }),

    // Bebé
    p('panales', 'Pañales Gracia', BB, 'bebe', 'und', 50, 'paquete x50', 730, ['bebeDia', 5], { keywords: ['panal', 'panales'] }),
    p('panitos', 'Pañitos húmedos', BB, 'bebe', 'und', 100, 'paquete x100', 365, ['bebeDia', 12], { keywords: ['panitos', 'toallitas humedas'] }),
    p('leche-gracia', 'Leche Gracia', BB, 'despensa', 'ml', 1100, 'bolsa 1,1 L', 90, ['bebeDia', 450]),
    p('yogurt-gracia', 'Yogurt Gracia', BB, 'nevera', 'und', 6, 'paquete x6', 20, ['bebeDia', 1], { keywords: ['yogurt bebe'] }),
    p('compota', 'Compotas', BB, 'bebe', 'und', 1, 'unidad', 365, ['bebeDia', 0.5]),
    p('crema-panal', 'Crema antipañalitis', BB, 'bebe', 'g', 110, 'tubo 110 g', 730, ['bebeDia', 2], { keywords: ['antipanalitis'] }),
    p('shampoo-bebe', 'Shampoo bebé', BB, 'bebe', 'ml', 400, 'frasco 400 ml', 730, ['bebeDia', 5], { keywords: ['shampoo bebe'] }),
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
    version: 1,
    people: seedPeople(),
    products: seedProducts(),
    movements: [],
    receipts: [],
    aliases: {},
    plans: [],
    checked: {},
    settings: { sundayOut: 0.5, quincenaDays: 15, nextMarket: nextQuincenaStart(today) },
  };
}
