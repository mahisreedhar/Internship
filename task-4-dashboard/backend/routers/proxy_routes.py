from math import ceil
from threading import Lock
from time import time
from typing import Any

import requests
from fastapi import APIRouter, HTTPException, Query


router = APIRouter()
HOUSES_API_URL = "https://anapioficeandfire.com/api/houses"
CHARACTERS_API_URL = "https://anapioficeandfire.com/api/characters"
RAVENS_ERROR = "The Ravens are tired. GoT API is down or rate-limited."
HOUSES_PAGE_SIZE = 50
HOUSES_CACHE_TTL_SECONDS = 300
HOUSES_MAX_PAGES = 200
CHARACTERS_PAGE_SIZE = 50
CHARACTERS_CACHE_TTL_SECONDS = 300
CHARACTERS_MAX_PAGES = 250
_houses_cache_lock = Lock()
_houses_cache: dict[str, Any] = {"items": [], "fetched_at": 0.0}
_characters_cache_lock = Lock()
_characters_cache: dict[str, Any] = {"items": [], "fetched_at": 0.0}


def _raven_exception():
    return HTTPException(status_code=503, detail=RAVENS_ERROR)


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _to_string(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _is_house_extinct(house: dict[str, Any]) -> bool:
    return bool((house.get("diedOut") or "").strip())


def _is_character_alive(character: dict[str, Any]) -> bool:
    return not bool(_to_string(character.get("died")).strip())


def _character_primary_name(character: dict[str, Any]) -> str:
    primary_name = _to_string(character.get("name")).strip()
    if primary_name:
        return primary_name

    aliases = character.get("aliases")
    if isinstance(aliases, list):
        for alias in aliases:
            alias_name = _to_string(alias).strip()
            if alias_name:
                return alias_name

    return "Unknown Soul"


def _character_aliases_text(character: dict[str, Any]) -> str:
    aliases = character.get("aliases")
    if not isinstance(aliases, list):
        return ""

    normalized_aliases = [_to_string(alias).strip() for alias in aliases]
    return " ".join(alias for alias in normalized_aliases if alias)


def _fetch_houses_page(page: int) -> list[dict[str, Any]]:
    try:
        response = requests.get(
            HOUSES_API_URL,
            params={"page": page, "pageSize": HOUSES_PAGE_SIZE},
            timeout=10,
        )

        if response.status_code == 429:
            raise _raven_exception()

        response.raise_for_status()
        payload = response.json()
    except requests.RequestException:
        raise _raven_exception()

    return payload if isinstance(payload, list) else []


def _get_all_houses() -> list[dict[str, Any]]:
    with _houses_cache_lock:
        now = time()
        cached_items = _houses_cache.get("items", [])
        fetched_at = _houses_cache.get("fetched_at", 0.0)
        if cached_items and (now - fetched_at) < HOUSES_CACHE_TTL_SECONDS:
            return cached_items

        aggregated_houses: list[dict[str, Any]] = []
        page = 1

        while page <= HOUSES_MAX_PAGES:
            page_items = _fetch_houses_page(page)
            if not page_items:
                break

            aggregated_houses.extend(page_items)

            if len(page_items) < HOUSES_PAGE_SIZE:
                break

            page += 1

        _houses_cache["items"] = aggregated_houses
        _houses_cache["fetched_at"] = now
        return aggregated_houses


def _fetch_characters_page(page: int) -> list[dict[str, Any]]:
    try:
        response = requests.get(
            CHARACTERS_API_URL,
            params={"page": page, "pageSize": CHARACTERS_PAGE_SIZE},
            timeout=10,
        )

        if response.status_code == 429:
            raise _raven_exception()

        response.raise_for_status()
        payload = response.json()
    except requests.RequestException:
        raise _raven_exception()

    return payload if isinstance(payload, list) else []


def _get_all_characters() -> list[dict[str, Any]]:
    with _characters_cache_lock:
        now = time()
        cached_items = _characters_cache.get("items", [])
        fetched_at = _characters_cache.get("fetched_at", 0.0)
        if cached_items and (now - fetched_at) < CHARACTERS_CACHE_TTL_SECONDS:
            return cached_items

        aggregated_characters: list[dict[str, Any]] = []
        page = 1

        while page <= CHARACTERS_MAX_PAGES:
            page_items = _fetch_characters_page(page)
            if not page_items:
                break

            aggregated_characters.extend(page_items)

            if len(page_items) < CHARACTERS_PAGE_SIZE:
                break

            page += 1

        _characters_cache["items"] = aggregated_characters
        _characters_cache["fetched_at"] = now
        return aggregated_characters


@router.get("/api/houses")
def get_houses(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50, alias="pageSize"),
    region: str = Query("", max_length=100),
    is_extinct: bool | None = Query(None, alias="isExtinct"),
    search: str = Query("", max_length=100),
):
    houses = _get_all_houses()
    filtered_houses = houses
    normalized_region = _normalize(region)
    normalized_search = _normalize(search)

    if normalized_region:
        filtered_houses = [
            house for house in filtered_houses if _normalize(house.get("region")) == normalized_region
        ]

    if is_extinct is not None:
        filtered_houses = [
            house for house in filtered_houses if _is_house_extinct(house) is is_extinct
        ]

    if normalized_search:
        filtered_houses = [
            house
            for house in filtered_houses
            if normalized_search in _normalize(house.get("name"))
            or normalized_search in _normalize(house.get("words"))
        ]

    total_filtered_items = len(filtered_houses)
    total_items = len(houses)
    total_pages = ceil(total_filtered_items / page_size) if total_filtered_items > 0 else 1
    clamped_page = min(page, total_pages)
    start = (clamped_page - 1) * page_size
    end = start + page_size
    page_items = filtered_houses[start:end] if start < total_filtered_items else []

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


@router.get("/api/characters")
def get_characters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50, alias="pageSize"),
    name: str = Query("", max_length=100),
    gender: str = Query("all", max_length=20),
    culture: str = Query("", max_length=100),
    aliases: str = Query("", max_length=100),
    born: str = Query("", max_length=100),
    died: str = Query("", max_length=100),
    status: str = Query("all", pattern="^(all|alive|deceased)$"),
):
    characters = _get_all_characters()
    filtered_characters = characters

    normalized_name = _normalize(name)
    normalized_gender = _normalize(gender)
    normalized_culture = _normalize(culture)
    normalized_aliases = _normalize(aliases)
    normalized_born = _normalize(born)
    normalized_died = _normalize(died)
    normalized_status = _normalize(status)

    if normalized_name:
        filtered_characters = [
            character
            for character in filtered_characters
            if normalized_name in _normalize(_character_primary_name(character))
        ]

    if normalized_gender and normalized_gender != "all":
        filtered_characters = [
            character
            for character in filtered_characters
            if _normalize(_to_string(character.get("gender"))) == normalized_gender
        ]

    if normalized_culture:
        filtered_characters = [
            character
            for character in filtered_characters
            if normalized_culture in _normalize(_to_string(character.get("culture")))
        ]

    if normalized_aliases:
        filtered_characters = [
            character
            for character in filtered_characters
            if normalized_aliases in _normalize(_character_aliases_text(character))
        ]

    if normalized_born:
        filtered_characters = [
            character
            for character in filtered_characters
            if normalized_born in _normalize(_to_string(character.get("born")))
        ]

    if normalized_died:
        filtered_characters = [
            character
            for character in filtered_characters
            if normalized_died in _normalize(_to_string(character.get("died")))
        ]

    if normalized_status == "alive":
        filtered_characters = [
            character for character in filtered_characters if _is_character_alive(character)
        ]
    elif normalized_status == "deceased":
        filtered_characters = [
            character for character in filtered_characters if not _is_character_alive(character)
        ]

    total_filtered_items = len(filtered_characters)
    total_items = len(characters)
    total_pages = ceil(total_filtered_items / page_size) if total_filtered_items > 0 else 1
    clamped_page = min(page, total_pages)
    start = (clamped_page - 1) * page_size
    end = start + page_size
    page_items = filtered_characters[start:end] if start < total_filtered_items else []

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
