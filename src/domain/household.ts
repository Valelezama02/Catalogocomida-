import { diffDays, weekday, addDays } from './dates';
import type { ISODate, Person, Product, QuincenaPlan, Settings } from './types';

export interface DayContext {
  breakfasts: number; // desayunos servidos (sin la bebé)
  portions: number; // porciones de almuerzo + cena (la bebé cuenta según su portionFactor)
  personDays: number; // persona-días ponderados (aseo personal)
  babyDays: number; // días de bebé en casa
}

export function planFor(date: ISODate, plans: QuincenaPlan[]): QuincenaPlan | undefined {
  // el plan más reciente que cubra la fecha
  let best: QuincenaPlan | undefined;
  for (const p of plans) {
    if (p.start <= date && date < p.end && (!best || p.createdAt > best.createdAt)) best = p;
  }
  return best;
}

function scheduledDays(person: Person, plan: QuincenaPlan): number {
  const n = diffDays(plan.start, plan.end);
  let c = 0;
  for (let i = 0; i < n; i++) if (person.days.includes(weekday(addDays(plan.start, i)))) c++;
  return c;
}

export function presenceFactor(person: Person, plan?: QuincenaPlan): number {
  if (!plan) return 1;
  const absent = plan.absentDays[person.id] ?? 0;
  if (absent <= 0) return 1;
  const sched = scheduledDays(person, plan);
  if (sched <= 0) return 0;
  return Math.max(0, 1 - absent / sched);
}

export function dayContext(date: ISODate, people: Person[], settings: Settings, plan?: QuincenaPlan): DayContext {
  const wd = weekday(date);
  const meals = plan?.meals ?? { desayuno: true, almuerzo: true, cena: true };
  const sundayOut = plan ? plan.sundayOut : settings.sundayOut;
  const ctx: DayContext = { breakfasts: 0, portions: 0, personDays: 0, babyDays: 0 };

  for (const p of people) {
    if (!p.active || !p.days.includes(wd)) continue;
    const f = presenceFactor(p, plan);
    if (f <= 0) continue;
    if (p.type === 'bebe') ctx.babyDays += f;
    ctx.personDays += f * p.personalFactor;
    if (p.type !== 'bebe' && p.meals.desayuno && meals.desayuno) ctx.breakfasts += f;
    let lunchDinner = 0;
    if (p.meals.almuerzo && meals.almuerzo) lunchDinner++;
    if (p.meals.cena && meals.cena) lunchDinner++;
    if (wd === 0) lunchDinner *= 1 - sundayOut;
    ctx.portions += f * lunchDinner * p.portionFactor;
  }

  if (plan && plan.guestMeals > 0) {
    const n = Math.max(1, diffDays(plan.start, plan.end));
    ctx.portions += plan.guestMeals / n;
  }
  return ctx;
}

/** Consumo base de un día según la regla (sin calibración). */
export function ruleDemand(product: Product, ctx: DayContext): number {
  const r = product.rule;
  const share = r.share ?? 1;
  switch (r.type) {
    case 'porcion':
      return r.qty * share * ctx.portions;
    case 'desayuno':
      return r.qty * share * ctx.breakfasts;
    case 'personaDia':
      return r.qty * ctx.personDays;
    case 'hogarSemana':
      return r.qty / 7;
    case 'bebeDia':
      return r.qty * ctx.babyDays;
    default:
      return 0;
  }
}

/** Calculadora con caché de contexto por día. */
export class Calc {
  private cache = new Map<ISODate, DayContext>();
  constructor(
    private people: Person[],
    private settings: Settings,
    private plans: QuincenaPlan[],
    private forcePlan?: QuincenaPlan,
  ) {}

  ctx(date: ISODate): DayContext {
    let c = this.cache.get(date);
    if (!c) {
      const plan =
        this.forcePlan && this.forcePlan.start <= date && date < this.forcePlan.end
          ? this.forcePlan
          : planFor(date, this.plans);
      c = dayContext(date, this.people, this.settings, plan);
      this.cache.set(date, c);
    }
    return c;
  }

  base(product: Product, date: ISODate): number {
    return ruleDemand(product, this.ctx(date));
  }

  withPlan(plan: QuincenaPlan): Calc {
    return new Calc(this.people, this.settings, this.plans, plan);
  }
}
