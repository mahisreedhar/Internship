import asyncio
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

POKEAPI_BASE = "https://pokeapi.co/api/v2"
MASTER_INDEX_URL = f"{POKEAPI_BASE}/pokemon?limit=1300"

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

# In-memory master index — populated once at startup, never mutated afterward
_master_pokemon_index: list[dict[str, str]] = []


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


async def load_master_index() -> None:
    global _master_pokemon_index
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(MASTER_INDEX_URL)
        response.raise_for_status()
        _master_pokemon_index = response.json()["results"]


@router.get("/api/pokemon")
async def get_pokemon(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50, alias="pageSize"),
    search: str = Query("", max_length=100),
    generation: int = Query(0, ge=0, le=9),
):
    if not _master_pokemon_index:
        raise HTTPException(
            status_code=503,
            detail="Pokédex index not yet loaded. Please retry in a moment.",
        )

    filtered: list[dict[str, str]] = _master_pokemon_index

    # Generation filter — restrict to National Dex ID range
    if generation in GENERATION_RANGES:
        low, high = GENERATION_RANGES[generation]
        filtered = [
            p for p in filtered
            if low <= _extract_id_from_url(p["url"]) <= high
        ]

    # Fuzzy name search (lowercase substring match)
    if search.strip():
        term = search.strip().lower()
        filtered = [p for p in filtered if term in p["name"].lower()]

    total_items = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    page_slice = filtered[start:end]

    # Concurrent hydration — fetch rich detail for exactly the current page slice
    async with httpx.AsyncClient(timeout=15) as client:
        responses = await asyncio.gather(
            *[client.get(p["url"]) for p in page_slice],
            return_exceptions=True,
        )

    items: list[dict[str, Any]] = []
    for result in responses:
        if isinstance(result, Exception):
            continue
        if result.status_code == 200:
            items.append(_shape_pokemon(result.json()))

    return {
        "items": items,
        "total_items": total_items,
        "page": page,
        "page_size": page_size,
    }
