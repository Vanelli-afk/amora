export class CircuitOpenError extends Error {}

type Options = { failures?: number; cooldownMs?: number; maxConcurrent?: number; now?: () => number };

/**
 * Protege o app de um serviço externo lento: depois de falhas seguidas, recusa na hora durante
 * um tempo, em vez de prender cada requisição até o timeout. Passado esse tempo, uma única
 * chamada testa se o serviço voltou.
 */
export function createBreaker({ failures = 3, cooldownMs = 60_000, maxConcurrent = 8, now = Date.now }: Options = {}) {
  let consecutive = 0;
  let openUntil = 0;
  let probing = false;
  let inFlight = 0;

  return async function run<T>(call: () => Promise<T>): Promise<T> {
    const isOpen = consecutive >= failures;
    if (isOpen && (now() < openUntil || probing)) throw new CircuitOpenError();
    if (inFlight >= maxConcurrent) throw new CircuitOpenError();

    const probe = isOpen;
    if (probe) probing = true;
    inFlight += 1;
    try {
      const result = await call();
      consecutive = 0;
      return result;
    } catch (error) {
      consecutive += 1;
      if (consecutive >= failures) openUntil = now() + cooldownMs;
      throw error;
    } finally {
      inFlight -= 1;
      if (probe) probing = false;
    }
  };
}
