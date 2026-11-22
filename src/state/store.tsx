import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmtDate, todayISO } from '../domain/dates';
import { computeAlerts, computeStatuses, type Alert, type ProductStatus } from '../domain/engine';
import { fmtQty } from '../domain/format';
import { Calc } from '../domain/household';
import { createInitialState } from '../domain/seed';
import type { AppState, Movement } from '../domain/types';

const KEY = 'catalogo-comida:v1';
const USER_KEY = 'catalogo-comida:usuario';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AppState;
    return s && s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

interface Store {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  today: string;
  calc: Calc;
  statuses: Record<string, ProductStatus>;
  alerts: Alert[];
  user: string | null;
  setUser: (id: string | null) => void;
  addMovements: (ms: Omit<Movement, 'id' | 'createdAt' | 'by'>[]) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => load() ?? createInitialState());
  const [user, setUserState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(USER_KEY);
    } catch {
      return null;
    }
  });
  const today = todayISO();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* sin almacenamiento: la app sigue funcionando en memoria */
    }
  }, [state]);

  const setUser = useCallback((id: string | null) => {
    setUserState(id);
    try {
      if (id) localStorage.setItem(USER_KEY, id);
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* ignorar */
    }
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const addMovements = useCallback(
    (ms: Omit<Movement, 'id' | 'createdAt' | 'by'>[]) => {
      const now = new Date().toISOString();
      setState((s) => ({ ...s, movements: [...s.movements, ...ms.map((m) => ({ ...m, id: uid(), createdAt: now, by: user ?? undefined }))] }));
    },
    [user],
  );

  const derived = useMemo(() => {
    const calc = new Calc(state.people, state.settings, state.plans);
    const statuses = computeStatuses(state, today, calc);
    const alerts = computeAlerts(state, statuses, today, fmtQty, fmtDate);
    return { calc, statuses, alerts };
  }, [state, today]);

  const value: Store = { state, update, today, user, setUser, addMovements, ...derived };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider faltante');
  return s;
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function resetState(): AppState {
  return createInitialState();
}
