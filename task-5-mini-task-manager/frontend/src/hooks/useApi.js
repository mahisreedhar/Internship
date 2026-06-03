/**
 * ARCHITECTURAL NOTE — Centralised API Client
 * ============================================
 * All HTTP calls funnel through this single module. Benefits:
 *
 * 1. CREDENTIALS: `credentials: 'include'` is set in one place.
 *    Without it the browser strips the HttpOnly cookie from cross-origin
 *    requests (even with Vite's proxy). Centralising this means a developer
 *    can never accidentally forget it on a new endpoint.
 *
 * 2. ERROR SHAPE: The backend always returns `{ "detail": "..." }` on error.
 *    We parse that here and throw a plain `{ status, message }` object so
 *    every component gets the same error shape regardless of HTTP status.
 *
 * 3. 204 HANDLING: DELETE responses return 204 No Content — calling
 *    `.json()` on them throws. The null-guard handles this cleanly.
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    // eslint-disable-next-line no-throw-literal
    throw { status: res.status, message: err.detail || 'Request failed' };
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  // PATCH is used for the dedicated RBAC status endpoint:
  // PATCH /tasks/{id}/status enforces Rule A (owner) + Rule B (assignee) server-side.
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
