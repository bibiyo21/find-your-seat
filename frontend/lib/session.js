// Server-side helper used by getServerSideProps to check the admin session
// by talking directly to the Express API (not through the rewrite, since
// this runs on the Next.js server itself, not in the browser).
export const API_URL = process.env.API_URL || "http://localhost:3001";

export async function getSession(req) {
  try {
    const r = await fetch(`${API_URL}/api/session`, {
      headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
    });
    if (!r.ok) return { authenticated: false };
    return await r.json();
  } catch {
    return { authenticated: false };
  }
}
