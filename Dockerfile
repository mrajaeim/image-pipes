# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    libgl1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY backend/pyproject.toml backend/uv.lock backend/README.md* ./backend/
COPY backend/app ./backend/app
COPY backend/examples ./backend/examples
COPY backend/run_server.py ./backend/run_server.py

WORKDIR /app/backend
RUN uv sync --frozen --no-dev \
  && mkdir -p cache uploads outputs/downloads

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV IMAGE_PIPES_HOST=0.0.0.0 \
    IMAGE_PIPES_PORT=8000 \
    IMAGE_PIPES_DATA_DIR=/app/backend \
    IMAGE_PIPES_FRONTEND_DIST=/app/frontend/dist \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uv", "run", "python", "run_server.py"]
