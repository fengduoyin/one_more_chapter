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
    DB_HOST=db \
    DB_PORT=5432 \
    DB_NAME=reading_library
# DB_USER and DB_PASSWORD must be provided at runtime (e.g. via Compose `.env`).
# Do not bake real credentials into the image.

RUN useradd -m appuser

COPY backend/ ./backend/
COPY --from=frontend_build /app/frontend/dist ./backend/static/

RUN mkdir -p ./backend/uploads \
    && chown -R appuser:appuser ./backend

RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 3050
USER appuser

CMD ["bash", "-lc", "alembic -c backend/alembic.ini upgrade head && python -m backend.app.main"]

