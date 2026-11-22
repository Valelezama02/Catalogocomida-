import { useEffect, useState } from 'react';
import { Section } from '../components';
import { useFamily } from '../state/family';
import { friendlyError } from '../sync/client';

export default function FamilySection() {
  const fam = useFamily();
  const [msg, setMsg] = useState<string | null>(null);
  const reload = fam?.reloadMembers;
  useEffect(() => {
    reload?.();
  }, [reload]);

  if (!fam)
    return (
      <Section title="Grupo familiar">
        <p className="muted small">Esta versión guarda los datos solo en este celular.</p>
      </Section>
    );

  const { membership, members, session } = fam;
  const isAdmin = membership.role === 'admin';
  const run = async (fn: () => Promise<void>) => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(friendlyError(e));
    }
  };

  const shareCode = async () => {
    const text = `Únete a la Despensa de ${membership.familyName}: abre ${window.location.origin}, crea tu cuenta y escribe el código ${membership.joinCode}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setMsg('Invitación copiada.');
      }
    } catch {
      /* cancelado */
    }
  };

  return (
    <Section title={`Grupo familiar · ${membership.familyName}`}>
      <p className="muted small">Código para que los demás se unan:</p>
      <div className="codebox">{membership.joinCode}</div>
      <div className="actions2">
        <button className="secondary" onClick={shareCode}>
          Compartir invitación
        </button>
        {isAdmin && (
          <button
            className="secondary"
            onClick={() => {
              if (confirm('¿Cambiar el código? El código viejo deja de servir (los que ya entraron siguen dentro).')) run(fam.regenerateCode);
            }}
          >
            Cambiar código
          </button>
        )}
      </div>

      <div className="group">Miembros ({members.length})</div>
      <ul className="history">
        {members.map((m) => {
          const me = m.user_id === session.user.id;
          return (
            <li key={m.user_id}>
              <span>
                <b>{m.display_name}</b>
                {m.role === 'admin' && <span className="tag">admin</span>}
                {me && <span className="tag">tú</span>}
                <br />
                <span className="muted small">
                  {m.email}
                </span>
              </span>
              {isAdmin && !me && (
                <span className="col">
                  <button
                    className="link"
                    onClick={() => run(() => fam.setRole(m.user_id, m.role === 'admin' ? 'member' : 'admin'))}
                  >
                    {m.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                  </button>
                  <button
                    className="link danger"
                    onClick={() => {
                      if (confirm(`¿Sacar a ${m.display_name} de la familia?`)) run(() => fam.removeMember(m.user_id));
                    }}
                  >
                    Sacar
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {msg && <div className="note">{msg}</div>}
      <p className="muted small">
        Si alguien olvida su contraseña, en la pantalla de entrar está “Olvidé mi contraseña”. Si el correo no le llega, sácalo de la familia y que se registre con otro correo.
      </p>
      <div>
        <button
          className="secondary wide danger"
          onClick={() => {
            if (confirm('¿Cerrar sesión en este celular?')) fam.signOut();
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </Section>
  );
}
