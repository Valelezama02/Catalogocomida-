import { useEffect, useState } from 'react';

/** Evento de Chrome/Android para ofrecer instalar la app. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallBanner() {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('despensa:instalar-oculto') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (isStandalone() || hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem('despensa:instalar-oculto', '1');
    } catch {
      /* ignorar */
    }
  };

  if (deferred)
    return (
      <div className="card installbox">
        <div>
          <b>📲 Instala Despensa en tu celular</b>
          <div className="muted small">Queda con su ícono en la pantalla de inicio, como cualquier app.</div>
        </div>
        <div className="actions2">
          <button
            className="primary"
            onClick={async () => {
              await deferred?.prompt();
              deferred = null;
              force((n) => n + 1);
            }}
          >
            Instalar
          </button>
          <button className="secondary" onClick={hide}>
            Ahora no
          </button>
        </div>
      </div>
    );

  if (isIOS())
    return (
      <div className="card installbox">
        <b>📲 Instala Despensa en tu iPhone</b>
        <ol className="steps small">
          <li>
            Abre este enlace en <b>Safari</b>.
          </li>
          <li>
            Toca el botón <b>Compartir</b> (el cuadrito con la flecha ⬆️).
          </li>
          <li>
            Elige <b>“Agregar a inicio”</b> y luego <b>Agregar</b>.
          </li>
        </ol>
        <button className="link" onClick={hide}>
          Ya lo hice
        </button>
      </div>
    );

  return null;
}
