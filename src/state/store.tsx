import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmtDate, todayISO } from '../domain/dates';
import { computeAlerts, computeStatuses, type Alert, type ProductStatus } from '../domain/engine';
import { fmtQty } from '../domain/format';
import { Calc } from '../domain/household';
import { createInitialState } from '../domain/seed';
import type { AppState, Movement } from '../domain/types';
import { useCloudSync, type CloudInfo, type SyncStatus } from '../sync/useCloudSync';

const LOCAL_KEY = 'catalogo-comida:v1';
const USER_KEY = 'catalogo-comida:usuario';

function emptyState(): AppState {
  return { ...createInitialState(), people: [], products: [] };
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(KEY: string): AppState | null {
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
  cloud?: CloudInfo;
  sync: { status: SyncStatus; ready: boolean; syncNow: () => Promise<void> };
}

const Ctx = createContext<Store | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Si viene, los datos se comparten con la familia en la nube. */
  cloud?: CloudInfo;
  personId?: string | null;
  onPersonChange?: (id: string | null) => void;
}

export function StoreProvider({ children, cloud, personId, onPersonChange }: ProviderProps) {
  const KEY = cloud ? `despensa:familia:${cloud.familyId}` : LOCAL_KEY;
  // Al crear una familia se parte de lo que ya había en este celular
  const [state, setState] = useState<AppState>(() => load(KEY) ?? load(LOCAL_KEY) ?? createInitialState());
  const [localUser, setUserState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(USER_KEY);
    } catch {
      return null;
    }
  });
  const user = cloud ? (personId ?? null) : localUser;
  const today = todayISO();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* sin almacenamiento: la app sigue funcionando en memoria */
    }
  }, [state, KEY]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const sync = useCloudSync(cloud, state, update, emptyState);

  const setUser = useCallback((id: string | null) => {
    if (cloud) {
      onPersonChange?.(id);
      return;
    }
    setUserState(id);
    try {
      if (id) localStorage.setItem(USER_KEY, id);
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* ignorar */
    }
  }, [cloud, onPersonChange]);

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

  const value: Store = { state, update, today, user, setUser, addMovements, cloud, sync, ...derived };
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
