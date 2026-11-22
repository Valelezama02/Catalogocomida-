import { useState } from 'react';
import { diffDays, todayISO } from '../domain/dates';
import type { Note } from '../domain/types';
import { uid, useStore } from '../state/store';

function when(createdAt: string): string {
  const d = createdAt.slice(0, 10);
  const n = diffDays(d, todayISO());
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  return `hace ${n} días`;
}

export default function Notes() {
  const { state, update, author } = useStore();
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const notes = [...state.notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pending = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    const note: Note = { id: uid(), text: t, by: author, done: false, createdAt: new Date().toISOString() };
    update((s) => ({ ...s, notes: [...s.notes, note] }));
    setText('');
  };
  const set = (id: string, patch: Partial<Note>) => update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  const remove = (id: string) => update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));

  const Item = ({ n }: { n: Note }) => (
    <li className={n.done ? 'done' : ''}>
      <button className={`check ${n.done ? 'on' : ''}`} onClick={() => set(n.id, { done: !n.done })} aria-label="Listo">
        {n.done ? '✓' : ''}
      </button>
      <div className="grow">
        <div className="notetext">{n.text}</div>
        <div className="muted small">
          {n.by ? `${n.by} · ` : ''}
          {when(n.createdAt)}
        </div>
      </div>
      <button className="link danger" onClick={() => confirm('¿Borrar esta nota?') && remove(n.id)}>
        ✕
      </button>
    </li>
  );

  return (
    <div className="screen">
      <h1>Notas de la casa</h1>
      <p className="muted small">Para avisarle algo a los demás: “se acabó el gas”, “Gracia ya usa pañal talla 5”, “mañana no vengo”…</p>
      <div className="card form">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe una nota…" rows={3} />
        <button className="primary wide" disabled={!text.trim()} onClick={add}>
          Publicar nota
        </button>
      </div>

      {pending.length === 0 ? <p className="muted center">No hay notas pendientes.</p> : <ul className="notes">{pending.map((n) => <Item key={n.id} n={n} />)}</ul>}

      {done.length > 0 && (
        <>
          <button className="link" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Ocultar' : 'Ver'} notas resueltas ({done.length})
          </button>
          {showDone && <ul className="notes">{done.map((n) => <Item key={n.id} n={n} />)}</ul>}
        </>
      )}
    </div>
  );
}
