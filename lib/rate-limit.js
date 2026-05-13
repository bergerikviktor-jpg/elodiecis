/**
 * In-memory per-key rate limiter for brute-force protection.
 *
 * Failure-based design: only call `failure(key)` after a real verification
 * attempt fails. Successful attempts (or operations you don't want to count,
 * like malformed requests) should NOT touch the counter — `success(key)`
 * actively resets it.
 *
 * Caveats:
 * - State lives in module-level memory. It does NOT survive a server
 *   restart (e.g. `next dev` HMR rebuild) and is NOT shared across
 *   processes (e.g. Vercel serverless invocations are isolated).
 *   Swap for Redis / Upstash if you need distributed protection.
 * - Single-process Node is single-threaded so the Map mutations are safe
 *   without locks.
 */
export function createRateLimiter({
  maxFailures = 10,
  windowMs = 15 * 60 * 1000,
  lockoutMs = 15 * 60 * 1000,
} = {}) {
  /**
   * @type {Map<string, {
   *   failures: number;
   *   windowStart: number;
   *   lockedUntil?: number;
   * }>}
   */
  const store = new Map();
  let opCount = 0;

  function prune(now) {
    for (const [key, entry] of store) {
      const lockExpired = !entry.lockedUntil || entry.lockedUntil <= now;
      const windowExpired = entry.windowStart + windowMs <= now;
      if (lockExpired && windowExpired) store.delete(key);
    }
  }

  function maybePrune(now) {
    // Opportunistic — every 100 ops — to bound memory growth without
    // needing a setInterval (which doesn't survive serverless cold starts).
    if (++opCount % 100 === 0) prune(now);
  }

  return {
    /**
     * Check whether `key` is currently allowed to attempt.
     * Does NOT mutate state.
     * @returns {{ allowed: boolean; retryAfter: number }}
     *   `retryAfter` is seconds until the lock expires (0 when allowed).
     */
    check(key) {
      const now = Date.now();
      maybePrune(now);
      const entry = store.get(key);
      if (!entry) return { allowed: true, retryAfter: 0 };
      if (entry.lockedUntil && entry.lockedUntil > now) {
        return {
          allowed: false,
          retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
        };
      }
      return { allowed: true, retryAfter: 0 };
    },

    /**
     * Reset the counter for `key` after a successful attempt.
     */
    success(key) {
      store.delete(key);
    },

    /**
     * Record a failed attempt. Starts a new window if the previous one
     * has expired. If the failure count crosses `maxFailures`, the key
     * gets locked for `lockoutMs`.
     * @returns {{ locked: boolean; retryAfter: number; failuresRemaining: number }}
     */
    failure(key) {
      const now = Date.now();
      maybePrune(now);
      let entry = store.get(key);

      if (!entry || entry.windowStart + windowMs <= now) {
        entry = { failures: 0, windowStart: now };
        store.set(key, entry);
      }

      entry.failures += 1;

      if (entry.failures >= maxFailures) {
        entry.lockedUntil = now + lockoutMs;
        return {
          locked: true,
          retryAfter: Math.ceil(lockoutMs / 1000),
          failuresRemaining: 0,
        };
      }

      return {
        locked: false,
        retryAfter: 0,
        failuresRemaining: maxFailures - entry.failures,
      };
    },
  };
}
