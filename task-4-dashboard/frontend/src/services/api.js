const PROXY_HOUSES_API_URL = "http://localhost:8000/api/houses";

export async function getWesterosHouses({ page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  let response;
  try {
    response = await fetch(`${PROXY_HOUSES_API_URL}?${params.toString()}`);
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
    const error = new Error(payload?.detail || `Failed to fetch houses (status: ${response.status})`);
    error.status = response.status;
    throw error;
  }

  return Array.isArray(payload) ? payload : [];
}
