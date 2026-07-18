FROM node:22-bookworm-slim AS frontend_build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_HOST=0.0.0.0 \
    APP_PORT=3050 \
    SQLITE_PATH=/data/reading_library.db \
    UPLOADS_DIR=/data/uploads \
    STATIC_DIR=backend/static

RUN useradd -m appuser \
    && mkdir -p /data/uploads \
    && chown -R appuser:appuser /data

COPY backend/ ./backend/
COPY --from=frontend_build /app/frontend/dist ./backend/static/

RUN pip install --no-cache-dir -r backend/requirements.txt \
    && chown -R appuser:appuser /app

EXPOSE 3050
USER appuser

CMD ["python", "-m", "backend.app.main"]
