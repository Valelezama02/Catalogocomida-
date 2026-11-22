import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmtDate, todayISO } from '../domain/dates';
import { computeAlerts, computeStatuses, type Alert, type ProductStatus } from '../domain/engine';
import { fmtQty } from '../domain/format';
import { Calc } from '../domain/household';
import { migrate } from '../domain/migrate';
import { createInitialState } from '../domain/seed';
import type { AppState, Movement } from '../domain/types';
import { useCloudSync, type CloudInfo, type SyncStatus } from '../sync/useCloudSync';

const LOCAL_KEY = 'catalogo-comida:v1';

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
    return s && (s.version === 1 || s.version === 2) ? migrate(s) : null;
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
  /** Nombre de quien usa este celular (para firmar notas y pedidos). */
  author?: string;
  addMovements: (ms: Omit<Movement, 'id' | 'createdAt' | 'by' | 'v'>[]) => void;
  cloud?: CloudInfo;
  sync: { status: SyncStatus; ready: boolean; needsDbUpdate: boolean; syncNow: () => Promise<void> };
}

const Ctx = createContext<Store | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Si viene, los datos se comparten con la familia en la nube. */
  cloud?: CloudInfo;
  author?: string;
}

export function StoreProvider({ children, cloud, author }: ProviderProps) {
  const KEY = cloud ? `despensa:familia:${cloud.familyId}` : LOCAL_KEY;
  // Al crear una familia se parte de lo que ya había en este celular
  const [state, setState] = useState<AppState>(() => load(KEY) ?? load(LOCAL_KEY) ?? createInitialState());
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

  const addMovements = useCallback(
    (ms: Omit<Movement, 'id' | 'createdAt' | 'by' | 'v'>[]) => {
      const now = new Date().toISOString();
      setState((s) => ({ ...s, movements: [...s.movements, ...ms.map((m) => ({ ...m, id: uid(), createdAt: now, v: 2 }))] }));
    },
    [],
  );

  const derived = useMemo(() => {
    const calc = new Calc(state.people, state.settings, state.plans);
    const statuses = computeStatuses(state, today, calc);
    const alerts = computeAlerts(state, statuses, today, fmtQty, fmtDate);
    return { calc, statuses, alerts };
  }, [state, today]);

  const value: Store = { state, update, today, author, addMovements, cloud, sync, ...derived };
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
