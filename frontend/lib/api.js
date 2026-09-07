// Thin fetch wrapper shared by every page. Requests are same-origin (Next.js
// rewrites /api/* to the Express backend, see next.config.js) so cookies are
// sent automatically and no CORS setup is needed.
export async function api(url, opt = {}) {
  const r = await fetch(url, opt);
  if (r.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Login required");
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || "Request failed");
  return j;
}
