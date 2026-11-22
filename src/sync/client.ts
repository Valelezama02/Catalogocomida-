import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** null si la app no está conectada a la nube (funciona solo en este celular). */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/already registered|already exists/i, 'Ese correo ya tiene cuenta. Entra con “Ya tengo cuenta”.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'Ese correo no es válido.'],
  [/email not confirmed/i, 'Falta confirmar el correo. Pídele a la administradora que revise la configuración.'],
  [/rate limit|too many/i, 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.'],
  [/failed to fetch|network/i, 'No hay conexión a internet.'],
];

export function friendlyError(e: unknown): string {
  const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  for (const [re, text] of MESSAGES) if (re.test(msg)) return text;
  return msg;
}
