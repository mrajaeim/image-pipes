"""Image Pipeline Playground FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as api_router
from app.nodes import register_builtin_nodes
from app.nodes.user_script import register_user_scripts
from app.websocket import router as ws_router

register_builtin_nodes()
register_user_scripts()

app = FastAPI(
    title="Image Pipeline Playground",
    version="0.1.0",
    description="OpenCV DAG execution API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _maybe_mount_frontend() -> None:
    from app.services.static import mount_frontend

    mount_frontend(app)


_maybe_mount_frontend()
