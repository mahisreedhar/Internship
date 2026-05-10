const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/$/, "");

function buildUrl(pathWithQuery) {
  if (API_BASE) {
    return `${API_BASE}${pathWithQuery}`;
  }
  return pathWithQuery;
}

export async function fetchPokemon({
  page = 1,
  pageSize = 20,
  search = "",
  generation = 0,
  types = [],
  minId,
  maxId,
} = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (generation > 0) {
    params.set("generation", String(generation));
  }

  if (Array.isArray(types) && types.length > 0) {
    params.set("types", types.join(","));
  }

  if (Number.isFinite(minId)) {
    params.set("minId", String(minId));
  }

  if (Number.isFinite(maxId)) {
    params.set("maxId", String(maxId));
  }

  let response;
  try {
    response = await fetch(buildUrl(`/api/pokemon?${params}`));
  } catch {
    const err = new Error("Cannot reach the Pokemon API server. Is the backend running?");
    err.status = 503;
    throw err;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const err = new Error(payload?.detail || `API error (HTTP ${response.status})`);
    err.status = response.status;
    throw err;
  }

  return response.json();
  // { items, total_items, page, page_size }
}
