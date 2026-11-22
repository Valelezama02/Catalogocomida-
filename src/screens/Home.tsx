import type { Nav } from '../App';
import { Section } from '../components';
import { diffDays, fmtDate } from '../domain/dates';
import { useStore } from '../state/store';

export default function Home({ nav }: { nav: Nav }) {
  const { state, alerts, today, user } = useStore();
  const me = state.people.find((p) => p.id === user);
  const next = state.settings.nextMarket;
  const days = diffDays(today, next);
  const empty = state.movements.length === 0;
  const red = alerts.filter((a) => a.level === 'rojo');
  const orange = alerts.filter((a) => a.level === 'naranja');
  const yellow = alerts.filter((a) => a.level === 'amarillo');

  return (
    <div className="screen">
      <h1>Hola, {me?.name}</h1>

      <div className="hero" onClick={() => nav.go('mercado')}>
        <div className="muted small">Próximo mercado</div>
        <div className="heronum">{days <= 0 ? (days === 0 ? '¡Es hoy!' : `Atrasado ${-days} días`) : `en ${days} ${days === 1 ? 'día' : 'días'}`}</div>
        <div>{fmtDate(next)}</div>
        <button className="primary">Preparar la lista</button>
      </div>

      {empty && (
        <Section title="Para empezar">
          <ol className="steps">
            <li>
              <b>Revisa las personas y horarios</b> en Ajustes (ya están Rosita, Tati, Érica y Gracia; cambia los nombres de los adultos).
            </li>
            <li>
              <b>Haz un conteo rápido</b> de lo que hay hoy en la casa. <button className="link" onClick={() => nav.go('inventario')}>Ir al conteo →</button>
            </li>
            <li>
              <b>El día del mercado</b>, genera la lista y después escanea la factura.
            </li>
          </ol>
        </Section>
      )}

      <div className="actions3">
        <button className="big" onClick={() => nav.go('anotar')}>
          ✏️<br />Anotar uso
        </button>
        <button className="big" onClick={() => nav.go('facturas')}>
          🧾<br />Factura
        </button>
        <button className="big" onClick={() => nav.go('inventario')}>
          📦<br />Qué hay
        </button>
      </div>

      {red.length > 0 && (
        <Section title={`🔴 Revisar ya (${red.length})`}>
          <AlertList items={red} nav={nav} />
        </Section>
      )}
      {orange.length > 0 && (
        <Section title={`🟠 Atención (${orange.length})`}>
          <AlertList items={orange} nav={nav} />
        </Section>
      )}
      {yellow.length > 0 && (
        <Section title={`🟡 Se acabó (${yellow.length})`}>
          <AlertList items={yellow} nav={nav} />
        </Section>
      )}
      {!empty && alerts.length === 0 && <p className="muted center">Todo en orden: nada por vencer y todo alcanza hasta el mercado. 🎉</p>}
    </div>
  );
}

function AlertList({ items, nav }: { items: { productId: string; text: string }[]; nav: Nav }) {
  return (
    <ul className="alerts">
      {items.map((a, i) => (
        <li key={i} onClick={() => nav.openProduct(a.productId)}>
          {a.text}
        </li>
      ))}
    </ul>
  );
}
