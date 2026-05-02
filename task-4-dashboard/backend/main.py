from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.proxy_routes import router as proxy_router


app = FastAPI(title="GoT Proxy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proxy_router)
