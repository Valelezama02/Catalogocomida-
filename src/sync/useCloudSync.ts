import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../domain/types';
import { applyRecords, diffRecords, recKey, stable, toRecords, type RemoteRec } from './records';

export interface CloudInfo {
  client: SupabaseClient;
  familyId: string;
  isAdmin: boolean;
}

export type SyncStatus = 'cargando' | 'ok' | 'subiendo' | 'sin-conexion';

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignorar */
  }
};

/**
 * Mantiene el estado local y la nube iguales:
 * - al abrir: baja lo nuevo (o todo, la primera vez en este celular)
 * - cada cambio local: se sube en ~1 segundo
 * - cambios de otros: llegan en vivo
 */
export function useCloudSync(cloud: CloudInfo | undefined, state: AppState, setState: (fn: (s: AppState) => AppState) => void, emptyState: () => AppState) {
  const [status, setStatus] = useState<SyncStatus>(cloud ? 'cargando' : 'ok');
  const [ready, setReady] = useState(!cloud);
  const synced = useRef<Record<string, string>>({});
  const stateRef = useRef(state);
  stateRef.current = state;
  const pushing = useRef(false);
  const pushAgain = useRef(false);

  const fid = cloud?.familyId;
  const SYNCED_KEY = `despensa:synced:${fid}`;
  const PULLED_KEY = `despensa:pulled:${fid}`;

  const saveSynced = () => lsSet(SYNCED_KEY, JSON.stringify(synced.current));

  async function fetchSince(since: string | null): Promise<RemoteRec[]> {
    const out: RemoteRec[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      let q = cloud!.client.from('records').select('kind,id,data,deleted,updated_at').eq('family_id', fid!).order('updated_at', { ascending: true }).range(from, from + page - 1);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...(data as RemoteRec[]));
      if (!data || data.length < page) break;
    }
    return out;
  }

  function absorb(recs: RemoteRec[]) {
    if (!recs.length) return;
    for (const r of recs) {
      const k = recKey(r.kind, r.id);
      if (r.deleted || r.data == null) delete synced.current[k];
      else synced.current[k] = stable(r.data);
    }
    saveSynced();
    const last = recs[recs.length - 1].updated_at;
    if (last) {
      const prev = lsGet(PULLED_KEY);
      if (!prev || last > prev) lsSet(PULLED_KEY, last);
    }
    setState((s) => applyRecords(s, recs));
  }

  async function push() {
    if (!cloud) return;
    if (pushing.current) {
      pushAgain.current = true;
      return;
    }
    pushing.current = true;
    try {
      do {
        pushAgain.current = false;
        const { upserts, deletes } = diffRecords(toRecords(stateRef.current), synced.current);
        if (!upserts.length && !deletes.length) break;
        setStatus('subiendo');
        const rows = [
          ...upserts.map((r) => ({ family_id: fid, kind: r.kind, id: r.id, data: r.data, deleted: false })),
          ...deletes.map((r) => ({ family_id: fid, kind: r.kind, id: r.id, data: null, deleted: true })),
        ];
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await cloud.client.from('records').upsert(rows.slice(i, i + 500), { onConflict: 'family_id,kind,id' });
          if (error) throw error;
        }
        for (const r of upserts) synced.current[recKey(r.kind, r.id)] = stable(r.data);
        for (const r of deletes) delete synced.current[recKey(r.kind, r.id)];
        saveSynced();
      } while (pushAgain.current);
      setStatus('ok');
    } catch (e) {
      console.warn('No se pudo subir', e);
      setStatus('sin-conexion');
    } finally {
      pushing.current = false;
    }
  }

  async function pull() {
    if (!cloud) return;
    try {
      const prev = lsGet(PULLED_KEY);
      // margen de 2 minutos por si dos cambios se guardaron casi al mismo tiempo
      const since = prev ? new Date(new Date(prev).getTime() - 120000).toISOString() : null;
      absorb(await fetchSince(since));
      setStatus((s) => (s === 'sin-conexion' || s === 'cargando' ? 'ok' : s));
    } catch (e) {
      console.warn('No se pudo bajar', e);
      setStatus('sin-conexion');
    }
  }

  // Primera carga en este celular
  useEffect(() => {
    if (!cloud) return;
    let cancelled = false;
    (async () => {
      try {
        synced.current = JSON.parse(lsGet(SYNCED_KEY) ?? '{}');
      } catch {
        synced.current = {};
      }
      const firstTime = !lsGet(PULLED_KEY);
      try {
        if (firstTime) {
          const all = await fetchSince(null);
          if (cancelled) return;
          if (all.length === 0) {
            // familia nueva: se sube lo que hay en este celular (catálogo inicial o datos ya guardados)
            synced.current = {};
            lsSet(PULLED_KEY, new Date(0).toISOString());
            await push();
          } else {
            // familia existente: la nube manda
            synced.current = {};
            const base = emptyState();
            setState(() => base);
            stateRef.current = base;
            absorb(all);
            if (!lsGet(PULLED_KEY)) lsSet(PULLED_KEY, new Date(0).toISOString());
          }
        } else {
          await push();
          await pull();
        }
        if (!cancelled) {
          setStatus('ok');
          setReady(true);
        }
      } catch (e) {
        console.warn(e);
        if (!cancelled) {
          setStatus('sin-conexion');
          setReady(!firstTime); // sin internet: si ya hay datos guardados, se puede seguir usando
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  // Subir cambios locales (1 segundo después del último cambio)
  useEffect(() => {
    if (!cloud || !ready) return;
    const t = setTimeout(push, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready]);

  // Cambios de los demás en vivo + revisar al volver a la app
  useEffect(() => {
    if (!cloud || !ready) return;
    const ch = cloud.client
      .channel(`records-${fid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `family_id=eq.${fid}` }, (payload) => {
        const r = payload.new as RemoteRec | undefined;
        if (r && r.kind) absorb([r]);
      })
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') push().then(pull);
    };
    const onOnline = () => push().then(pull);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const iv = setInterval(pull, 60000);
    return () => {
      cloud.client.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, ready]);

  return { status, ready, syncNow: () => push().then(pull) };
}
