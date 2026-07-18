# Reading Library

A minimalist reading diary: track books, daily check-ins, reading goals, calendar streaks, and statistics — fully self-hostable with Docker.

> Inspired in spirit by self-hosted reading tools such as [KoInsight](https://github.com/georgesg/koinsight). Reading Library, however, is a standalone diary (library, goals, calendar, stats) rather than a KOReader sync dashboard.

## Features

- **Library** — add and filter books, upload covers, update progress, finish or abandon, delete with confirmation
- **Goals** — monthly or yearly targets for books finished or words read
- **Calendar** — daily check-ins, reading streaks, finished-book markers
- **Statistics** — period summaries, reading heatmap, monthly charts
- **i18n** — Russian and English
- **Themes** — dark (default) and light

The `review` field remains in the database and API but is not shown in the UI.

## Installation



### Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

You do **not** need a pre-installed PostgreSQL: Compose starts a dedicated database container by default.

### Quick start

```bash
git clone <your-repo-url> reading_library
cd reading_library
cp .env.example .env
```

> **Sensitive credentials — set them yourself**
>
> Before the first start, open `.env` and **replace** the example `DB_USER` / `DB_PASSWORD` with your own values.
> The strings in `.env.example`, `docker-compose.yml`, and this README are **examples only**.
> Do not commit `.env` and do not reuse the sample password in any shared environment.

Then start the stack:

```bash
docker compose up --build
```

Open [http://localhost:3050](http://localhost:3050).

Data for the bundled Postgres lives in the Docker volume `reading_library_pgdata`. Cover uploads are stored under `backend/uploads/` (gitignored).

### Portable (SQLite, no Docker)

For a local “double-click style” run without PostgreSQL:

1. Build the frontend once (or reuse `frontend/dist` from a Docker build).
2. Migrate existing Postgres data (optional but recommended for testing):

```bash
./scripts/migrate_to_portable.sh
```

3. Start the portable app:

```bash
./scripts/run_portable.sh
```

This opens a native desktop window at [http://127.0.0.1:3050](http://127.0.0.1:3050) (pywebview).  
Set `READING_LIBRARY_BROWSER=1` to use the system browser instead. Data lives in `portable/data/reading_library.db` and covers in `portable/uploads/`.

If port 3050 is already used by Docker Compose, stop that stack first or run `APP_PORT=3051 ./scripts/run_portable.sh`.

On hosts with Python 3.14+ (where pinned wheels may be unavailable), the scripts automatically fall back to the existing `reading-library-app` Docker image while still using the local SQLite files under `portable/`.

| Variable       | Example                               | Description                |
| -------------- | ------------------------------------- | -------------------------- |
| `DB_ENGINE`    | `sqlite`                              | Use SQLite instead of Postgres |
| `SQLITE_PATH`  | `portable/data/reading_library.db`    | SQLite file path           |

#### Pack a distributable ZIP (Linux)

```bash
./scripts/build_portable.sh
# optional: bake in your current library data
INCLUDE_DATA=1 ./scripts/build_portable.sh
```

Output: `dist/ReadingLibrary-portable/` and `dist/ReadingLibrary-portable-linux-x64-YYYYMMDD.zip`.

#### Pack a distributable ZIP (Windows)

From WSL/Linux (Wine in Docker — produces a real `.exe`):

```bash
./scripts/build_portable_windows.sh
INCLUDE_DATA=1 ./scripts/build_portable_windows.sh
```

On a Windows machine (PowerShell):

```powershell
.\scripts\build_portable.ps1
.\scripts\build_portable.ps1 -IncludeData
```

Output: `dist/ReadingLibrary-portable-win64/` and `dist/ReadingLibrary-portable-win64-YYYYMMDD.zip`.

Recipients unpack the folder and run `ReadingLibrary.exe` (or `Start.bat`). Windows SmartScreen may warn about an unsigned app.

CI: workflow `.github/workflows/build-portable-windows.yml` (manual dispatch or version tags).

### Example Compose services

Default layout (application + Postgres). Secrets come from your `.env` file — not from hardcoded real credentials:

```yaml
name: reading-library
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME:-reading_library}
      POSTGRES_USER: ${DB_USER:?Set DB_USER in .env}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Set DB_PASSWORD in .env}
    volumes:
      - reading_library_pgdata:/var/lib/postgresql/data
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3050:3050"
    environment:
      DB_HOST: db
      DB_NAME: ${DB_NAME:-reading_library}
      DB_USER: ${DB_USER:?Set DB_USER in .env}
      DB_PASSWORD: ${DB_PASSWORD:?Set DB_PASSWORD in .env}
    depends_on:
      db:
        condition: service_healthy
```

See the full `docker-compose.yml` in the repository for healthchecks and volume mounts.

## Configuration

Reading Library is configured with environment variables (typically via `.env`):


| Variable      | Example (not a real secret)                        | Description                     |
| ------------- | -------------------------------------------------- | ------------------------------- |
| `DB_NAME`     | `reading_library`                                  | Database name                   |
| `DB_USER`     | `example_user`                                     | **Sensitive — set your own**    |
| `DB_PASSWORD` | `example_password`                                 | **Sensitive — set your own**    |
| `DB_HOST`     | `db` (bundled) / `host.docker.internal` (external) | PostgreSQL host                 |
| `DB_PORT`     | `5432`                                             | PostgreSQL port                 |
| `APP_HOST`    | `0.0.0.0`                                          | Bind address                    |
| `APP_PORT`    | `3050`                                             | HTTP port                       |
| `UPLOADS_DIR` | `backend/uploads`                                  | Cover image storage             |
| `STATIC_DIR`  | `frontend/dist`                                    | Built frontend assets (Compose) |


Compose **refuses to start** if `DB_USER` or `DB_PASSWORD` are missing from the environment / `.env`.

## Use your own PostgreSQL

If you already run PostgreSQL (for example on the host at `localhost:5432`), skip the bundled `db` service:

1. Create the database and role yourself (names must match `.env`).
2. Put matching credentials in `.env`, and set `DB_HOST=host.docker.internal` (or your DB hostname).
3. Start with the override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up --build
```

On Linux, `extra_hosts: host.docker.internal:host-gateway` is included in that override so the app container can reach the host.

## Development

Code is mounted into the `app` container:

- **Backend** — uvicorn `--reload` picks up Python changes
- **Frontend** — rebuilt on container start (`npm run build` in the entrypoint)

Restart after frontend changes:

```bash
docker compose restart app
```

Rebuild the image only when `backend/requirements.txt` or `frontend/package.json` / lockfile change:

```bash
docker compose up --build
```

Manual frontend rebuild inside the container:

```bash
docker compose exec app sh -c 'cd /app/frontend && npm run build'
```

Database migrations run automatically on startup (`alembic upgrade head`).

## Production-like image

```bash
cp .env.example .env   # set your own DB_USER / DB_PASSWORD
docker compose up --build -d
```

Or build the single runtime image and point it at any reachable Postgres (bundled Compose `db` hostname, or an external host):

```bash
docker build -t reading-library .
docker run --rm -p 3050:3050 \
  -e DB_HOST=... \
  -e DB_PORT=5432 \
  -e DB_NAME=reading_library \
  -e DB_USER=... \
  -e DB_PASSWORD=... \
  reading-library
```

> Pass real secrets via your environment or a secrets manager — never bake them into the image or commit them to git.



## API overview


| Prefix          | Endpoints                                                               |
| --------------- | ----------------------------------------------------------------------- |
| `GET /health`   | Health check                                                            |
| `/api/books`    | CRUD, cover upload, progress, finish, abandon                           |
| `/api/checkins` | List / create / update / delete daily check-ins                         |
| `/api/goals`    | CRUD reading goals                                                      |
| `/api/stats`    | Summary, goal progress, finished list, analytics, charts, check-in days |


Check-ins with `words_delta = 0` may receive **estimated** word counts from book progress and reading minutes (`backend/app/utils.py`).

## Project layout

```
backend/
  app/            # FastAPI application
  alembic/        # Database migrations
  uploads/        # Cover images (gitignored)
frontend/
  src/            # React UI
docker-compose.yml
docker-compose.external-db.yml
.env.example
Dockerfile.dev
```



## Stack


| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Backend  | FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Frontend | React, Vite (SPA served by FastAPI)      |
| Runtime  | Docker Compose on port **3050**          |


