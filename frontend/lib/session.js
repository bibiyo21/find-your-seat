// Server-side helper used by getServerSideProps to check the admin session.
//
// This verifies the cookie's HMAC signature + expiry directly, in-process,
// instead of making a network call to the Express API (server.js). An
// earlier version fetched `${VERCEL_URL}/api/session` from here, but that's
// a serverless function calling its own public deployment URL — VERCEL_URL
// is the deployment-specific host, not the custom/production domain the
// cookie was set for, and self-fetches like that are a common source of
// flaky failures on Vercel (deployment protection, extra DNS/TLS latency).
// Verifying locally needs only SESSION_SECRET, which must be set for this
// same scheme to match server.js's (see AUTH_COOKIE/signAuthCookie there —
// keep this in sync with it).
//
// This check is optimistic on purpose: it doesn't know about server-side
// logout revocation (that lives in Mongo, checked by server.js). It only
// decides whether to render the dashboard shell or redirect to /login;
// every real data request still goes through the API's requireAuth, which
// is the actual authority and does enforce revocation. A user who just
// logged out but still has an unexpired cookie would briefly see the
// dashboard shell before its data fetches 401 and bounce them to /login
// (frontend/lib/api.js already does that) — never real admin data.
import crypto from "crypto";

const AUTH_COOKIE = "admin_auth";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function getSession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return { authenticated: false };

  const value = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (!value) return { authenticated: false };

  const [payload, sig] = value.split(".");
  if (!payload || !sig) return { authenticated: false };

  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { authenticated: false };
  }

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return { authenticated: typeof exp === "number" && Date.now() < exp };
  } catch {
    return { authenticated: false };
  }
}
