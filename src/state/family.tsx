import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { friendlyError, supabase } from '../sync/client';
import type { CloudInfo } from '../sync/useCloudSync';

export interface Membership {
  familyId: string;
  familyName: string;
  joinCode: string;
  role: 'admin' | 'member';
  personId: string | null;
  displayName: string;
}

export interface MemberRow {
  user_id: string;
  display_name: string;
  email: string | null;
  person_id: string | null;
  role: 'admin' | 'member';
}

interface FamilyCtx {
  session: Session;
  membership: Membership;
  members: MemberRow[];
  reloadMembers: () => Promise<void>;
  setPersonId: (id: string | null) => Promise<void>;
  regenerateCode: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  setRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  leaveFamily: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<FamilyCtx | null>(null);

/** null cuando la app funciona sin nube. */
export const useFamily = () => useContext(Ctx);

const sb = () => supabase!;

async function loadMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await sb()
    .from('members')
    .select('family_id, role, person_id, display_name, families(name, join_code)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  const m = data?.[0] as unknown as
    | { family_id: string; role: 'admin' | 'member'; person_id: string | null; display_name: string; families: { name: string; join_code: string } }
    | undefined;
  if (!m) return null;
  return { familyId: m.family_id, familyName: m.families.name, joinCode: m.families.join_code, role: m.role, personId: m.person_id, displayName: m.display_name };
}

export function FamilyGate({ children }: { children: (cloud: CloudInfo, personId: string | null, setPersonId: (id: string | null) => void) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [localPerson, setLocalPerson] = useState<string | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    sb()
      .auth.getSession()
      .then(({ data }) => setSession(data.session));
    const { data: sub } = sb().auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      setErr(null);
      setMembership(await loadMembership(uid));
    } catch (e) {
      setErr(friendlyError(e));
    }
  }, [uid]);

  useEffect(() => {
    setMembership(undefined);
    setLocalPerson(undefined);
    if (uid) refresh();
  }, [uid, refresh]);

  const reqSeq = useRef(0);
  const reloadMembers = useCallback(async () => {
    if (!membership) return;
    const seq = ++reqSeq.current;
    const { data } = await sb().from('members').select('user_id, display_name, email, person_id, role').eq('family_id', membership.familyId).order('joined_at');
    if (seq === reqSeq.current) setMembers((data as MemberRow[]) ?? []); // descarta respuestas viejas
  }, [membership]);

  useEffect(() => {
    reloadMembers();
  }, [reloadMembers]);

  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  if (session === undefined) return <Splash text="Cargando…" />;
  if (!session) return <AuthScreen />;
  if (err) return <Splash text={err} retry={refresh} />;
  if (membership === undefined) return <Splash text="Buscando tu familia…" />;
  if (!membership) return <FamilyScreen session={session} onDone={refresh} />;

  const personId = localPerson === undefined ? membership.personId : localPerson;

  const setPersonId = async (id: string | null) => {
    if (!id) {
      setLocalPerson(null); // solo muestra la pantalla para escoger perfil
      return;
    }
    // se ve al instante; se guarda en la nube por detrás
    reqSeq.current++; // cualquier lista pedida antes ya no sirve
    setMembers((ms) => ms.map((m) => (m.user_id === session.user.id ? { ...m, person_id: id } : m)));
    setMembership({ ...membership, personId: id });
    setLocalPerson(undefined);
    const { error } = await sb().from('members').update({ person_id: id }).eq('family_id', membership.familyId).eq('user_id', session.user.id);
    if (error) console.warn('No se pudo guardar el perfil', error);
  };

  const ctx: FamilyCtx = {
    session,
    membership,
    members,
    reloadMembers,
    setPersonId,
    regenerateCode: async () => {
      const { data, error } = await sb().rpc('regenerate_join_code', { fid: membership.familyId });
      if (error) throw error;
      setMembership({ ...membership, joinCode: data as string });
    },
    removeMember: async (userId) => {
      const { error } = await sb().rpc('remove_member', { fid: membership.familyId, uid: userId });
      if (error) throw error;
      await reloadMembers();
    },
    setRole: async (userId, role) => {
      const { error } = await sb().rpc('set_member_role', { fid: membership.familyId, uid: userId, p_role: role });
      if (error) throw error;
      await reloadMembers();
    },
    leaveFamily: async () => {
      await sb().from('members').delete().eq('family_id', membership.familyId).eq('user_id', session.user.id);
      await refresh();
    },
    signOut: async () => {
      await sb().auth.signOut();
    },
  };

  const cloud: CloudInfo = { client: sb(), familyId: membership.familyId, isAdmin: membership.role === 'admin' };
  return <Ctx.Provider value={ctx}>{children(cloud, personId, setPersonId)}</Ctx.Provider>;
}

function Splash({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="screen whoami center">
      <div className="brand big-brand">Despensa</div>
      <p className="muted">{text}</p>
      {retry && (
        <button className="primary" onClick={retry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'nueva' | 'entrar' | 'olvido'>('nueva');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'nueva') {
        const { data, error } = await sb().auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: 'Cuenta creada. Revisa tu correo para confirmarla y luego entra.' });
      } else if (mode === 'entrar') {
        const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
        const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg({ ok: true, text: 'Te mandamos un correo con un enlace para crear una contraseña nueva. Ábrelo en este mismo celular.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen whoami">
      <div className="brand big-brand">Despensa</div>
      <p className="muted">El mercado de la quincena, sin que falte nada ni se dañe nada.</p>
      <div className="seg">
        <button className={mode === 'nueva' ? 'on' : ''} onClick={() => setMode('nueva')}>
          Crear cuenta
        </button>
        <button className={mode === 'entrar' ? 'on' : ''} onClick={() => setMode('entrar')}>
          Ya tengo cuenta
        </button>
      </div>
      <form className="card form" onSubmit={submit}>
        {mode === 'nueva' && (
          <label className="field">
            <span>Tu nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
        </label>
        {mode !== 'olvido' && (
          <label className="field">
            <span>Contraseña {mode === 'nueva' && '(mínimo 6 caracteres)'}</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete={mode === 'nueva' ? 'new-password' : 'current-password'} />
          </label>
        )}
        {msg && <div className={msg.ok ? 'toast' : 'note'}>{msg.text}</div>}
        <button className="primary wide" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'nueva' ? 'Crear cuenta' : mode === 'entrar' ? 'Entrar' : 'Mandar enlace'}
        </button>
        {mode === 'entrar' && (
          <button type="button" className="link wide" onClick={() => setMode('olvido')}>
            Olvidé mi contraseña
          </button>
        )}
        {mode === 'olvido' && (
          <button type="button" className="link wide" onClick={() => setMode('entrar')}>
            Volver
          </button>
        )}
      </form>
    </div>
  );
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="screen whoami">
      <h1>Nueva contraseña</h1>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await sb().auth.updateUser({ password: pw });
          if (error) setMsg(friendlyError(error));
          else onDone();
        }}
      >
        <label className="field">
          <span>Contraseña nueva (mínimo 6 caracteres)</span>
          <input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </label>
        {msg && <div className="note">{msg}</div>}
        <button className="primary wide">Guardar</button>
      </form>
    </div>
  );
}

function FamilyScreen({ session, onDone }: { session: Session; onDone: () => void }) {
  const [mode, setMode] = useState<'unirme' | 'crear'>('unirme');
  const [code, setCode] = useState('');
  const [house, setHouse] = useState('Mi casa');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const name = (session.user.user_metadata?.name as string | undefined) || session.user.email?.split('@')[0] || 'Sin nombre';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } =
        mode === 'crear'
          ? await sb().rpc('create_family', { p_name: house, p_display_name: name, p_person_id: null })
          : await sb().rpc('join_family', { p_code: code.trim().toUpperCase(), p_display_name: name, p_person_id: null });
      if (error) throw error;
      onDone();
    } catch (e) {
      setMsg(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen whoami">
      <h1>Hola, {name}</h1>
      <p className="muted">Ahora únete a la familia con el código que te pasaron, o crea la familia si eres la primera persona.</p>
      <div className="seg">
        <button className={mode === 'unirme' ? 'on' : ''} onClick={() => setMode('unirme')}>
          Tengo un código
        </button>
        <button className={mode === 'crear' ? 'on' : ''} onClick={() => setMode('crear')}>
          Crear familia
        </button>
      </div>
      <form className="card form" onSubmit={submit}>
        {mode === 'unirme' ? (
          <label className="field">
            <span>Código de la familia (ej. K7P-4QX)</span>
            <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required autoCapitalize="characters" autoComplete="off" />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Nombre de la casa</span>
              <input value={house} onChange={(e) => setHouse(e.target.value)} required />
            </label>
            <p className="muted small">Quedarás como administradora. La app te dará un código para que los demás se unan.</p>
          </>
        )}
        {msg && <div className="note">{msg}</div>}
        <button className="primary wide" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'unirme' ? 'Unirme' : 'Crear familia'}
        </button>
      </form>
      <button className="link wide" onClick={() => sb().auth.signOut()}>
        Salir ({session.user.email})
      </button>
    </div>
  );
}
