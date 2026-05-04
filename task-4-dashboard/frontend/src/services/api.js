const PROXY_HOUSES_API_URL = "http://localhost:8000/api/houses";
const PROXY_CHARACTERS_API_URL = "http://localhost:8000/api/characters";

async function fetchProxyData(url, params, resourceName) {
  let response;
  try {
    response = await fetch(`${url}?${params.toString()}`);
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
    const error = new Error(payload?.detail || `Failed to fetch ${resourceName} (status: ${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function parsePaginatedPayload(payload, page, pageSize) {
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
  const currentPage = Number(payload?.page ?? page);
  const parsedPageSize = Number(payload?.page_size ?? payload?.pageSize ?? pageSize);
  const totalItems = Number(payload?.total_items ?? items.length);
  const totalFilteredItems = Number(payload?.total_filtered_items ?? items.length);
  const totalPages = Number(payload?.total_pages ?? 1);

  return {
    items,
    page: Number.isNaN(currentPage) ? page : currentPage,
    pageSize: Number.isNaN(parsedPageSize) ? pageSize : parsedPageSize,
    totalItems: Number.isNaN(totalItems) ? items.length : totalItems,
    totalFilteredItems: Number.isNaN(totalFilteredItems) ? items.length : totalFilteredItems,
    totalPages: Number.isNaN(totalPages) ? 1 : totalPages,
    hasNext: Boolean(payload?.has_next ?? payload?.hasNext ?? false),
    hasPrevious: Boolean(payload?.has_previous ?? payload?.hasPrevious ?? false),
  };
}

export async function getWesterosHouses({
  page = 1,
  pageSize = 10,
  region = "",
  isExtinct = null,
  search = "",
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const normalizedRegion = region.trim();
  if (normalizedRegion) {
    params.set("region", normalizedRegion);
  }

  if (typeof isExtinct === "boolean") {
    params.set("isExtinct", String(isExtinct));
  }

  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  const payload = await fetchProxyData(PROXY_HOUSES_API_URL, params, "houses");
  return parsePaginatedPayload(payload, page, pageSize);
}

export async function getWesterosCharacters({
  page = 1,
  pageSize = 20,
  name = "",
  gender = "all",
  culture = "",
  cultures = [],
  aliases = "",
  born = "",
  died = "",
  status = "all",
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const normalizedName = name.trim();
  if (normalizedName) {
    params.set("name", normalizedName);
  }

  const normalizedGender = gender.trim().toLowerCase();
  if (normalizedGender && normalizedGender !== "all") {
    params.set("gender", normalizedGender);
  }

  const normalizedCulture = culture.trim();
  if (normalizedCulture) {
    params.set("culture", normalizedCulture);
  }

  if (Array.isArray(cultures) && cultures.length) {
    const normalizedCultures = cultures
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
    if (normalizedCultures.length) {
      params.set("cultures", normalizedCultures.join(","));
    }
  }

  const normalizedAliases = aliases.trim();
  if (normalizedAliases) {
    params.set("aliases", normalizedAliases);
  }

  const normalizedBorn = born.trim();
  if (normalizedBorn) {
    params.set("born", normalizedBorn);
  }

  const normalizedDied = died.trim();
  if (normalizedDied) {
    params.set("died", normalizedDied);
  }

  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus && normalizedStatus !== "all") {
    params.set("status", normalizedStatus);
  }

  const payload = await fetchProxyData(PROXY_CHARACTERS_API_URL, params, "characters");
  return parsePaginatedPayload(payload, page, pageSize);
}
