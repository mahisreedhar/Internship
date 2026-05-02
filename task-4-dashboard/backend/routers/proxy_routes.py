import requests
from fastapi import APIRouter, HTTPException


router = APIRouter()


@router.get("/api/houses")
def get_houses(page: int = 1):
    url = f"https://anapioficeandfire.com/api/houses?page={page}&pageSize=10"

    try:
        response = requests.get(url, timeout=10)

        if response.status_code == 429:
            raise HTTPException(
                status_code=503,
                detail="The Ravens are tired. GoT API is down or rate-limited.",
            )

        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        raise HTTPException(
            status_code=503,
            detail="The Ravens are tired. GoT API is down or rate-limited.",
        )
