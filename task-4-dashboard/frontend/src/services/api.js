const BFF_BASE = "http://localhost:8000";

export async function fetchPokemon({ page = 1, pageSize = 20, search = "", generation = 0 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (generation > 0) {
    params.set("generation", String(generation));
  }

  let response;
  try {
    response = await fetch(`${BFF_BASE}/api/pokemon?${params}`);
  } catch {
    const err = new Error("Cannot reach the Pokémon API server. Is the backend running?");
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
