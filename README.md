# One More Chapter

A minimalist reading diary: track books, daily check-ins, reading goals, calendar streaks, and statistics — fully self-hostable with Docker, or as a Windows portable app.

> Inspired in spirit by self-hosted reading tools such as [KoInsight](https://github.com/georgesg/koinsight). One More Chapter, however, is a standalone diary (library, goals, calendar, stats) rather than a KOReader sync dashboard.

## Features

- **Library** — add and filter books, upload covers, update progress, finish or abandon, delete with confirmation
- **Goals** — monthly or yearly targets for books finished or words read
- **Calendar** — daily check-ins, reading streaks, finished-book markers
- **Statistics** — period summaries, reading heatmap, monthly charts
- **i18n** — Russian and English
- **Themes** — dark (default) and light

The `review` field remains in the database and API but is not shown in the UI.

## Installation

### Option A — Docker (self-host)

#### Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

No separate database server is required: the app uses SQLite. Data is stored under `./data/` on the host.

#### Quick start

```bash
git clone <your-repo-url> one_more_chapter
cd one_more_chapter
cp .env.example .env   # optional — defaults work out of the box
docker compose up --build
```

Open [http://localhost:3050](http://localhost:3050).

| Path | Contents |
| ---- | -------- |
| `data/ocm_db.db` | SQLite database |
| `data/uploads/` | Cover images |

Backup tip: copy the whole `data/` folder.

### Option B — Windows portable (pywebview)

Download a release ZIP (or build it yourself — see below), unpack anywhere, and run `Start.bat` or `One More Chapter.exe`.

- No Docker or Python install required on the target machine
- Data lives next to the executable (`data/`, `uploads/`)
- Windows needs WebView2 (usually preinstalled with Edge). SmartScreen may warn about an unsigned app

CI builds: workflow `.github/workflows/build-portable-windows.yml` (manual dispatch or version tags `v*`).

#### Build the Windows ZIP yourself

From WSL/Linux (Wine in Docker — produces a real `.exe`):

```bash
./scripts/build_portable_windows.sh
INCLUDE_DATA=1 ./scripts/build_portable_windows.sh
```

With `INCLUDE_DATA=1`, the script copies the library from `data/` (Docker self-host) if present, otherwise from `portable/data/` (and the matching `uploads/`).

On a Windows machine (PowerShell):

```powershell
.\scripts\build_portable.ps1
.\scripts\build_portable.ps1 -IncludeData
```

Output: `dist/OneMoreChapter-portable-win64/` and `dist/OneMoreChapter-portable-win64-YYYYMMDD.zip`.

## Configuration

Environment variables (optional `.env` for Compose):

| Variable      | Default                     | Description              |
| ------------- | --------------------------- | ------------------------ |
| `SQLITE_PATH` | `/data/ocm_db.db`           | SQLite file (in Compose) |
| `UPLOADS_DIR` | `/data/uploads`             | Cover image storage      |
| `STATIC_DIR`  | `frontend/dist`             | Built frontend assets    |
| `APP_HOST`    | `0.0.0.0`                   | Bind address             |
| `APP_PORT`    | `3050`                      | HTTP port                |

## Development

Code is mounted into the `app` container:

- **Backend** — uvicorn `--reload` picks up Python changes
- **Frontend** — rebuilt on container start (`npm run build` in the entrypoint)

Restart after frontend changes:

```bash
docker compose restart app
```

Rebuild the image when `backend/requirements.txt` or `frontend/package.json` / lockfile change:

```bash
docker compose up --build
```

Manual frontend rebuild inside the container:

```bash
docker compose exec app sh -c 'cd /app/frontend && npm run build'
```

Schema is created automatically on startup (`create_all`).

### Local portable run (dev)

From the repo (native window via pywebview):

```bash
./scripts/run_portable.sh
```

Data: `portable/data/ocm_db.db`, covers: `portable/uploads/`.

If port 3050 is already used by Docker Compose, stop that stack or run `APP_PORT=3051 ./scripts/run_portable.sh`.

## Production-like image

```bash
docker compose up --build -d
```

Or build the single runtime image:

```bash
docker build -t one-more-chapter .
docker run --rm -p 3050:3050 \
  -v "$(pwd)/data:/data" \
  one-more-chapter
```

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
frontend/
  src/            # React UI
packaging/        # Windows portable (PyInstaller)
portable/         # Local portable data (dev, gitignored contents)
data/             # Docker self-host data (gitignored contents)
scripts/
docker-compose.yml
Dockerfile
Dockerfile.dev
.env.example
```

## Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Backend  | FastAPI, SQLAlchemy, SQLite         |
| Frontend | React, Vite (SPA served by FastAPI) |
| Fonts    | Open Sans (self-hosted, OFL) |
| Desktop  | pywebview (Windows portable)        |
| Runtime  | Docker Compose on port **3050**     |
