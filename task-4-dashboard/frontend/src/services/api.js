const PROXY_CHARACTERS_API_URL = "http://localhost:8000/api/characters";

export async function getThronesCharacters({ page = 1, pageSize = 10, search = "" } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  let response;
  try {
    response = await fetch(`${PROXY_CHARACTERS_API_URL}?${params.toString()}`);
  } catch {
    const networkError = new Error("The Ravens are tired. GoT API is down or rate-limited.");
    networkError.status = 503;
    throw networkError;
  }
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.detail || `Failed to fetch Thrones characters (status: ${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}
