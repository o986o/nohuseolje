"""
한국형 은퇴 금융 운영 플랫폼 — FastAPI 메인 앱
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.api.routes import simulation

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB 선택적 연결 — 없어도 시뮬레이션 API는 동작
    try:
        from app.db.database import create_tables
        await create_tables()
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulation.router, prefix="/api/v1")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": settings.app_version, "policy_year": settings.active_policy_year}


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/api/docs",
    }
