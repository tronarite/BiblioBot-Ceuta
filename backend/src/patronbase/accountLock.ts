const locks = new Map<string, Promise<void>>();

/**
 * Serializa las operaciones que tocan la cesta/sesión de una misma cuenta PatronBase,
 * para que una reserva manual y el motor de programaciones nunca se pisen.
 */
export async function withAccountLock<T>(accountKey: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(accountKey) ?? Promise.resolve();

  let resolveNext: () => void;
  const next = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  const chained = previous.then(() => next);
  locks.set(accountKey, chained);

  await previous;
  try {
    return await fn();
  } finally {
    resolveNext!();
    if (locks.get(accountKey) === chained) {
      locks.delete(accountKey);
    }
  }
}
