/**
 * Caché ligera en localStorage para que el dashboard muestre al instante lo último que
 * se vio (disponibilidad, reservas) al volver a entrar o recargar, mientras se comprueba
 * en segundo plano si ha cambiado. Todo envuelto en try/catch: si localStorage falla
 * (modo privado, cuota llena…) simplemente no hay caché, sin romper nada.
 */
export function leerLocal<T>(clave: string): T | null {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function guardarLocal<T>(clave: string, valor: T): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin caché, no pasa nada */
  }
}

export function borrarLocalConPrefijo(prefijo: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefijo)) localStorage.removeItem(k);
    }
  } catch {
    /* nada */
  }
}
