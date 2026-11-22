import type { Nav } from '../App';
import { Section } from '../components';
import { diffDays, fmtDate } from '../domain/dates';
import { InstallBanner } from '../install';
import { useStore } from '../state/store';

export default function Home({ nav }: { nav: Nav }) {
  const { state, alerts, today, author, addMovements } = useStore();
  const next = state.settings.nextMarket;
  const days = diffDays(today, next);
  const empty = state.movements.length === 0;
  const red = alerts.filter((a) => a.level === 'rojo');
  const orange = alerts.filter((a) => a.level === 'naranja');
  const notes = state.notes.filter((n) => !n.done).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const listCount = state.list.filter((i) => !i.checked).length;

  return (
    <div className="screen">
      <h1>{author ? `Hola, ${author}` : 'Hola'}</h1>
      <InstallBanner />

      <div className="hero" onClick={() => nav.go('mercado')}>
        <div className="muted small">Próximo mercado</div>
        <div className="heronum">{days <= 0 ? (days === 0 ? '¡Es hoy!' : `Atrasado ${-days} días`) : `en ${days} ${days === 1 ? 'día' : 'días'}`}</div>
        <div>
          {fmtDate(next)} · {listCount} {listCount === 1 ? 'cosa' : 'cosas'} en la lista
        </div>
        <button className="primary">Ver la lista</button>
      </div>

      {empty && (
        <Section title="Para empezar">
          <ol className="steps">
            <li>
              <b>Haz un conteo rápido</b> de lo que hay hoy en la casa. <button className="link" onClick={() => nav.go('inventario')}>Ir al conteo →</button>
            </li>
            <li>
              <b>Durante la quincena</b>, cada quien agrega en <b>Mercado</b> lo que hace falta.
            </li>
            <li>
              <b>Después del mercado</b>, escanea la factura.
            </li>
          </ol>
        </Section>
      )}

      <div className="actions3">
        <button className="big" onClick={() => nav.go('anotar')}>
          ✏️
          <br />
          Anotar
        </button>
        <button className="big" onClick={() => nav.go('facturas')}>
          🧾
          <br />
          Factura
        </button>
        <button className="big" onClick={() => nav.go('notas')}>
          📝
          <br />
          Notas
        </button>
      </div>

      {red.length + orange.length > 0 && (
        <Section title={`⚠️ Se va a dañar (${red.length + orange.length})`}>
          <ul className="alerts">
            {[...red, ...orange].map((a, i) => (
              <li key={i}>
                <div onClick={() => nav.openProduct(a.productId)}>
                  {a.level === 'rojo' ? '🔴 ' : '🟠 '}
                  {a.text}
                </div>
                {a.kind === 'vencido' && (
                  <div className="row">
                    <button className="chip" onClick={() => addMovements([{ productId: a.productId, type: 'uso', qty: a.qty, date: today }])}>
                      Ya se usó
                    </button>
                    <button className="chip" onClick={() => addMovements([{ productId: a.productId, type: 'descarte', qty: a.qty, date: today }])}>
                      Se botó
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {notes.length > 0 && (
        <Section title={`📝 Notas de la casa (${notes.length})`} right={<button className="link" onClick={() => nav.go('notas')}>Ver todas</button>}>
          <ul className="alerts">
            {notes.slice(0, 3).map((n) => (
              <li key={n.id} onClick={() => nav.go('notas')}>
                {n.text}
                {n.by && <span className="muted small"> — {n.by}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!empty && alerts.length === 0 && <p className="muted center">Nada por dañarse. 🎉</p>}
    </div>
  );
}
