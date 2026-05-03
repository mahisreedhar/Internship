from math import ceil

import requests
from fastapi import APIRouter, HTTPException, Query


router = APIRouter()
THRONES_API_URL = "https://thronesapi.com/api/v2/Characters"
RAVENS_ERROR = "The Ravens are tired. GoT API is down or rate-limited."


def _raven_exception():
    return HTTPException(status_code=503, detail=RAVENS_ERROR)


@router.get("/api/houses")
def get_houses(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50, alias="pageSize"),
):
    url = f"https://anapioficeandfire.com/api/houses?page={page}&pageSize={page_size}"

    try:
        response = requests.get(url, timeout=10)

        if response.status_code == 429:
            raise _raven_exception()

        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        raise _raven_exception()


@router.get("/api/characters")
def get_characters(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=25),
    search: str = Query("", max_length=100),
):
    try:
        response = requests.get(THRONES_API_URL, timeout=10)

        if response.status_code == 429:
            raise _raven_exception()

        response.raise_for_status()
        characters = response.json()
    except requests.RequestException:
        raise _raven_exception()

    normalized_query = search.strip().lower()
    if normalized_query:
        characters = [
            character
            for character in characters
            if normalized_query in (character.get("fullName") or "").lower()
        ]

    total_items = len(characters)
    total_pages = ceil(total_items / page_size) if total_items > 0 else 1
    start = (page - 1) * page_size
    end = start + page_size
    page_items = characters[start:end] if start < total_items else []

    return {
        "items": page_items,
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }
