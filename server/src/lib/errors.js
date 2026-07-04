// Used on every unexpected (500) error path across the API. Logs the
// real error server-side for debugging, but never sends Postgres/
// Supabase internals (table names, query structure) back to the
// client — only routes' own deliberate validation messages (400s,
// 403s, 404s with custom text) are safe to expose as-is.
export function sendServerError(res, error, context) {
  console.error(`[${context}]`, error.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}