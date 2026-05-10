from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.proxy_routes import load_master_index, router as proxy_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await load_master_index()
    yield


app = FastAPI(title="Pokémon BFF API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proxy_router)
