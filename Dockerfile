# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgomp1 \
    libgl1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /usr/local/bin/uv

COPY backend/pyproject.toml backend/uv.lock ./backend/
COPY backend/app ./backend/app
COPY backend/examples ./backend/examples
COPY backend/run_server.py ./backend/run_server.py

WORKDIR /app/backend

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/backend/.venv

RUN uv sync --frozen --no-dev \
  && mkdir -p cache uploads outputs

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV IMAGE_PIPES_HOST=0.0.0.0 \
    IMAGE_PIPES_PORT=8000 \
    IMAGE_PIPES_DATA_DIR=/app/backend \
    IMAGE_PIPES_FRONTEND_DIST=/app/frontend/dist \
    IMAGE_PIPES_LOG_LEVEL=warning \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["uv", "run", "python", "run_server.py"]
