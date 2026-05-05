from threading import Lock
from time import time
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import requests
from fastapi import APIRouter, HTTPException, Query


router = APIRouter()
HOUSES_API_URL = "https://anapioficeandfire.com/api/houses"
CHARACTERS_API_URL = "https://anapioficeandfire.com/api/characters"
RAVENS_ERROR = "The Ravens are tired. GoT API is down or rate-limited."
PAGE_CACHE_TTL_SECONDS = 300
_page_cache_lock = Lock()
_page_cache: dict[str, dict[str, Any]] = {}


def _raven_exception():
    return HTTPException(status_code=503, detail=RAVENS_ERROR)


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _to_string(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _normalize_culture(value: str | None) -> str:
    normalized = _normalize(value)
    return "dornish" if normalized in {"dornish", "dornishmen"} else normalized


def _parse_last_page(links: dict[str, Any], fallback_page: int) -> int:
    last_link = links.get("last", {}).get("url")
    if not last_link:
        return fallback_page

    try:
        query_values = parse_qs(urlparse(last_link).query)
        last_page_value = query_values.get("page", [str(fallback_page)])[0]
        parsed_last_page = int(last_page_value)
        return parsed_last_page if parsed_last_page >= 1 else fallback_page
    except (TypeError, ValueError):
        return fallback_page


def _to_query_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _build_cache_key(resource_url: str, params: dict[str, Any]) -> str:
    sorted_params = sorted((key, _to_query_value(value)) for key, value in params.items())
    encoded = urlencode(sorted_params)
    return f"{resource_url}?{encoded}" if encoded else resource_url


def _fetch_page_with_cache(
    resource_url: str,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    cache_key = _build_cache_key(resource_url, params)
    now = time()

    with _page_cache_lock:
        cached_entry = _page_cache.get(cache_key)
        if cached_entry and (now - cached_entry["fetched_at"]) < PAGE_CACHE_TTL_SECONDS:
            return cached_entry["items"], cached_entry["links"]

    try:
        response = requests.get(resource_url, params=params, timeout=10)

        if response.status_code == 429:
            raise _raven_exception()

        response.raise_for_status()
        payload = response.json()
    except requests.RequestException:
        raise _raven_exception()

    items = payload if isinstance(payload, list) else []
    links = response.links

    with _page_cache_lock:
        _page_cache[cache_key] = {
            "items": items,
            "links": links,
            "fetched_at": now,
        }

    return items, links


def _extract_total_pages(links: dict[str, Any], current_page: int) -> int:
    return max(_parse_last_page(links, current_page), 1)


def _get_total_items_for_query(
    resource_url: str,
    request_params: dict[str, Any],
    current_items: list[dict[str, Any]],
    current_page: int,
    page_size: int,
    total_pages: int,
) -> int:
    if total_pages <= 0:
        return 0

    if total_pages == current_page:
        last_page_items = current_items
    else:
        last_page_params = {**request_params, "page": total_pages, "pageSize": page_size}
        last_page_items, _ = _fetch_page_with_cache(resource_url, last_page_params)

    return ((total_pages - 1) * page_size) + len(last_page_items)


@router.get("/api/houses")
def get_houses(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50, alias="pageSize"),
    region: str = Query("", max_length=100),
    is_extinct: bool | None = Query(None, alias="isExtinct"),
    search: str = Query("", max_length=100),
):
    request_params: dict[str, Any] = {"page": page, "pageSize": page_size}
    normalized_region = _normalize(region)
    normalized_search = _normalize(search)

    if normalized_region:
        request_params["region"] = normalized_region

    if is_extinct is not None:
        request_params["hasDiedOut"] = _to_query_value(is_extinct)

    if normalized_search:
        request_params["name"] = normalized_search

    page_items, links = _fetch_page_with_cache(HOUSES_API_URL, request_params)

    if normalized_search and not page_items:
        words_params = {**request_params}
        words_params.pop("name", None)
        words_params["words"] = normalized_search
        page_items, links = _fetch_page_with_cache(HOUSES_API_URL, words_params)
        request_params = words_params

    total_pages = _extract_total_pages(links, page)
    clamped_page = min(page, total_pages)

    if clamped_page != page:
        request_params["page"] = clamped_page
        page_items, links = _fetch_page_with_cache(HOUSES_API_URL, request_params)
        total_pages = _extract_total_pages(links, clamped_page)

    total_filtered_items = _get_total_items_for_query(
        HOUSES_API_URL,
        request_params,
        page_items,
        clamped_page,
        page_size,
        total_pages,
    )

    return {
        "items": page_items,
        "page": clamped_page,
        "page_size": page_size,
        "total_items": total_filtered_items,
        "total_filtered_items": total_filtered_items,
        "total_pages": total_pages,
        "has_next": clamped_page < total_pages,
        "has_previous": clamped_page > 1,
    }


@router.get("/api/characters")
def get_characters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50, alias="pageSize"),
    name: str = Query("", max_length=100),
    gender: str = Query("all", max_length=20),
    culture: str = Query("", max_length=100),
    cultures: str = Query("", max_length=400),
    born: str = Query("", max_length=100),
    died: str = Query("", max_length=100),
    status: str = Query("all", pattern="^(all|alive|deceased)$"),
):
    normalized_name = _normalize(name)
    normalized_gender = _normalize(gender)
    normalized_culture = _normalize(culture)
    normalized_cultures = [value.strip() for value in cultures.split(",") if value.strip()]
    normalized_cultures = [_normalize_culture(value) for value in normalized_cultures]
    normalized_cultures = list(dict.fromkeys(normalized_cultures))
    normalized_born = _normalize(born)
    normalized_died = _normalize(died)
    normalized_status = _normalize(status)
    canonical_single_culture = ""
    if len(normalized_cultures) == 1:
        canonical_single_culture = normalized_cultures[0]
    elif normalized_culture:
        canonical_single_culture = _normalize_culture(normalized_culture)

    request_params: dict[str, Any] = {"page": page, "pageSize": page_size}

    if normalized_name:
        request_params["name"] = normalized_name

    if normalized_gender and normalized_gender != "all":
        request_params["gender"] = normalized_gender

    # Upstream supports one culture value; multi-select uses local hybrid filtering.
    if canonical_single_culture and canonical_single_culture != "dornish":
        request_params["culture"] = canonical_single_culture
    elif canonical_single_culture == "dornish":
        request_params["culture"] = "Dornish"

    if normalized_born:
        request_params["born"] = normalized_born

    if normalized_died:
        request_params["died"] = normalized_died

    if normalized_status == "alive":
        request_params["isAlive"] = "true"
    elif normalized_status == "deceased":
        request_params["isAlive"] = "false"

    page_items, links = _fetch_page_with_cache(CHARACTERS_API_URL, request_params)
    total_pages = _extract_total_pages(links, page)
    clamped_page = min(page, total_pages)

    if clamped_page != page:
        request_params["page"] = clamped_page
        page_items, links = _fetch_page_with_cache(CHARACTERS_API_URL, request_params)
        total_pages = _extract_total_pages(links, clamped_page)

    upstream_page_items = page_items

    # Hybrid filters for metadata that is not natively supported as multi-value query.
    if normalized_cultures:
        page_items = [
            character
            for character in page_items
            if _normalize_culture(_to_string(character.get("culture"))) in normalized_cultures
        ]

    total_items = _get_total_items_for_query(
        CHARACTERS_API_URL,
        request_params,
        upstream_page_items,
        clamped_page,
        page_size,
        total_pages,
    )
    total_filtered_items = total_items

    return {
        "items": page_items,
        "page": clamped_page,
        "page_size": page_size,
        "total_items": total_items,
        "total_filtered_items": total_filtered_items,
        "total_pages": total_pages,
        "has_next": clamped_page < total_pages,
        "has_previous": clamped_page > 1,
    }
