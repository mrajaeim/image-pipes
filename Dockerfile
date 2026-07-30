# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS runtime
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY backend/ /app/backend/
WORKDIR /app/backend
RUN uv sync --frozen --no-dev
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
ENV IMAGE_PIPES_CACHE_DIR=/app/backend/cache
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
