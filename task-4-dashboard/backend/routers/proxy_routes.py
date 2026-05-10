import asyncio
import json
from typing import Any
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

try:
    import httpx
except ModuleNotFoundError:  # pragma: no cover - fallback for mismatched virtualenvs
    httpx = None

router = APIRouter()

POKEAPI_BASE = "https://pokeapi.co/api/v2"
MASTER_INDEX_URL = f"{POKEAPI_BASE}/pokemon?limit=1300"
TYPE_URL_TEMPLATE = f"{POKEAPI_BASE}/type/{{type_name}}"
POKEMON_TYPES = {
    "normal",
    "fire",
    "water",
    "electric",
    "grass",
    "ice",
    "fighting",
    "poison",
    "ground",
    "flying",
    "psychic",
    "bug",
    "rock",
    "ghost",
    "dragon",
    "dark",
    "steel",
    "fairy",
}

# Generation ID boundaries (National Dex ranges)
GENERATION_RANGES: dict[int, tuple[int, int]] = {
    1: (1, 151),
    2: (152, 251),
    3: (252, 386),
    4: (387, 493),
    5: (494, 649),
    6: (650, 721),
    7: (722, 809),
    8: (810, 905),
    9: (906, 1025),
}

# In-memory master index, populated once at startup.
_master_pokemon_index: list[dict[str, Any]] = []
_type_to_ids_cache: dict[str, set[int]] = {}


def _extract_id_from_url(url: str) -> int:
    return int(url.rstrip("/").rsplit("/", 1)[-1])


def _shape_pokemon(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": data["id"],
        "name": data["name"].capitalize(),
        "image": (
            (data.get("sprites") or {})
            .get("other", {})
            .get("official-artwork", {})
            .get("front_default")
        ),
        "types": [t["type"]["name"] for t in data.get("types", [])],
        "weight": data.get("weight"),
        "height": data.get("height"),
    }


def _fetch_json_sync(url: str, timeout: float) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": "pokedex-dashboard/1.0"})
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


async def _fetch_json(url: str, timeout: float) -> dict[str, Any]:
    if httpx is not None:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

    return await asyncio.to_thread(_fetch_json_sync, url, timeout)


def _parse_types_filter(raw_types: str) -> list[str]:
    if not raw_types.strip():
        return []

    requested = {entry.strip().lower() for entry in raw_types.split(",") if entry.strip()}
    unknown = sorted(requested - POKEMON_TYPES)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Invalid type filter(s): {', '.join(unknown)}")

    return sorted(requested)


async def _load_type_ids(type_name: str) -> set[int]:
    cached = _type_to_ids_cache.get(type_name)
    if cached is not None:
        return cached

    payload = await _fetch_json(TYPE_URL_TEMPLATE.format(type_name=type_name), timeout=20)
    pokemon_rows = payload.get("pokemon", [])
    ids = {
        _extract_id_from_url(item["pokemon"]["url"])
        for item in pokemon_rows
        if item.get("pokemon", {}).get("url")
    }
    _type_to_ids_cache[type_name] = ids
    return ids


async def load_master_index() -> None:
    global _master_pokemon_index

    payload = await _fetch_json(MASTER_INDEX_URL, timeout=20)
    _master_pokemon_index = [
        {
            "id": _extract_id_from_url(entry["url"]),
            "name": entry["name"],
            "url": entry["url"],
        }
        for entry in payload["results"]
    ]


async def _hydrate_page(page_slice: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    if httpx is not None:
        async with httpx.AsyncClient(timeout=15) as client:
            responses = await asyncio.gather(
                *[client.get(p["url"]) for p in page_slice],
                return_exceptions=True,
            )

        for result in responses:
            if isinstance(result, Exception):
                continue
            if result.status_code == 200:
                items.append(_shape_pokemon(result.json()))
    else:
        responses = await asyncio.gather(
            *[asyncio.to_thread(_fetch_json_sync, p["url"], 15) for p in page_slice],
            return_exceptions=True,
        )

        for result in responses:
            if isinstance(result, Exception):
                continue
            items.append(_shape_pokemon(result))

    return items


@router.get("/api/pokemon")
async def get_pokemon(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50, alias="pageSize"),
    search: str = Query("", max_length=100),
    generation: int = Query(0, ge=0, le=9),
    types: str = Query("", max_length=200),
    min_id: int = Query(1, ge=1, le=1025, alias="minId"),
    max_id: int = Query(1025, ge=1, le=1025, alias="maxId"),
):
    if not _master_pokemon_index:
        raise HTTPException(
            status_code=503,
            detail="Pokedex index is not available yet. Please retry in a moment.",
        )

    if min_id > max_id:
        raise HTTPException(status_code=422, detail="minId cannot be greater than maxId.")

    filtered: list[dict[str, Any]] = _master_pokemon_index

    # Generation filter, restrict to National Dex ID range.
    if generation in GENERATION_RANGES:
        low, high = GENERATION_RANGES[generation]
        filtered = [p for p in filtered if low <= p["id"] <= high]

    # Fuzzy name search (lowercase substring match).
    if search.strip():
        term = search.strip().lower()
        filtered = [p for p in filtered if term in p["name"].lower()]

    # Dex ID range metadata filter.
    filtered = [p for p in filtered if min_id <= p["id"] <= max_id]

    # Type checkbox filter (OR across selected types).
    selected_types = _parse_types_filter(types)
    if selected_types:
        type_id_sets = await asyncio.gather(*[_load_type_ids(type_name) for type_name in selected_types])
        allowed_ids = set().union(*type_id_sets)
        filtered = [p for p in filtered if p["id"] in allowed_ids]

    total_items = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    page_slice = filtered[start:end]

    items = await _hydrate_page(page_slice)

    return {
        "items": items,
        "total_items": total_items,
        "page": page,
        "page_size": page_size,
    }
