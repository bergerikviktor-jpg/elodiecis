import crypto from "node:crypto";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Server-side access-code gate.
 *
 * The expected code lives in `process.env.ACCESS_CODE` (no NEXT_PUBLIC_
 * prefix so it is NEVER bundled to the client). The handler accepts a JSON
 * body `{ code: string }` and responds with `{ ok: true }` on match, HTTP
 * 401 on mismatch, or HTTP 429 if the caller has been rate-limited.
 *
 * Comparison is constant-time (`crypto.timingSafeEqual`) to neutralise
 * timing attacks against the secret.
 *
 * Brute-force protection: per-IP failure counter — 10 wrong attempts
 * within 15 min triggers a 15-min lockout. State is in-memory; see
 * `lib/rate-limit.js` for caveats.
 */

// Module-level singleton — persists across requests in the same process.
const limiter = createRateLimiter({
  maxFailures: 10,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
});

function getClientKey(request) {
  // Behind a proxy / CDN: x-forwarded-for is "<client>, <proxy>, ..." —
  // take the leftmost entry as the real client IP.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // Dev / direct connection: no proxy headers exist. Fall back to a UA
  // fingerprint so localhost still has SOME bucket for testing.
  return "unknown:" + (request.headers.get("user-agent") || "");
}

export async function POST(request) {
  const key = getClientKey(request);

  // 1) Rate-limit gate runs BEFORE any work — even reading the body —
  //    so a locked-out caller can't burn CPU on us.
  const status = limiter.check(key);
  if (!status.allowed) {
    return Response.json(
      { ok: false, error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(status.retryAfter) },
      }
    );
  }

  // 2) Server config check.
  const expected = process.env.ACCESS_CODE;
  if (!expected || typeof expected !== "string" || expected.length === 0) {
    return Response.json(
      { ok: false, error: "Access code not configured." },
      { status: 500 }
    );
  }

  // 3) Parse body. Malformed input does NOT count as a brute-force attempt
  //    (it never reaches the secret comparison) so we don't touch the limiter.
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const provided = body?.code;
  if (typeof provided !== "string" || provided.length === 0) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // 4) Constant-time comparison.
  if (!timingSafeEqualStrings(provided, expected)) {
    const result = limiter.failure(key);
    if (result.locked) {
      return Response.json(
        { ok: false, error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfter) },
        }
      );
    }
    return Response.json({ ok: false }, { status: 401 });
  }

  // 5) Success — wipe the counter so a typo earlier doesn't haunt the user.
  limiter.success(key);
  return Response.json({ ok: true });
}

function timingSafeEqualStrings(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  // crypto.timingSafeEqual requires equal-length buffers. Still run a
  // comparison so timing doesn't leak the length distinction.
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
