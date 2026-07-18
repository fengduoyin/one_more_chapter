"""Portable desktop entrypoint: SQLite + local static UI + native window.

Repo mode:

    ./scripts/run_portable.sh
    python -m backend.app.desktop

Frozen (PyInstaller) mode: double-click ReadingLibrary / ReadingLibrary.exe

By default opens a native window via pywebview. Set READING_LIBRARY_BROWSER=1
to force the system browser instead (useful in Docker / headless environments).
"""

from __future__ import annotations

import os
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False)) and hasattr(sys, "_MEIPASS")


def app_dir() -> Path:
    """Writable install/portable folder (next to the executable when frozen)."""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def resource_dir() -> Path:
    """Bundled read-only resources (frontend dist, etc.)."""
    if is_frozen():
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return app_dir()


def configure_portable_env(root: Path | None = None) -> Path:
    """Set env vars before importing the rest of the app."""
    root = (root or app_dir()).resolve()
    resources = resource_dir().resolve()

    if is_frozen():
        data_dir = root / "data"
        uploads_dir = root / "uploads"
        static_dir = resources / "frontend" / "dist"
    else:
        data_dir = root / "portable" / "data"
        uploads_dir = root / "portable" / "uploads"
        static_dir = resources / "frontend" / "dist"

    data_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    os.environ.setdefault("SQLITE_PATH", str(data_dir / "reading_library.db"))
    os.environ.setdefault("UPLOADS_DIR", str(uploads_dir))
    os.environ.setdefault("STATIC_DIR", str(static_dir))
    os.environ.setdefault("APP_HOST", "127.0.0.1")
    os.environ.setdefault("APP_PORT", "3050")
    return root


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def ensure_windowed_stdio(log_path: Path | None = None) -> None:
    """PyInstaller windowed builds set stdout/stderr to None; uvicorn needs real streams."""
    if sys.stdout is not None and sys.stderr is not None:
        return
    if log_path is None:
        log_path = app_dir() / "data" / "app.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    stream = open(log_path, "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = stream  # type: ignore[assignment]
    if sys.stderr is None:
        sys.stderr = stream  # type: ignore[assignment]


def unblock_windows_zone_identifiers(root: Path | None = None) -> None:
    """Remove Mark-of-the-Web so pythonnet / WebView2 DLLs can load after ZIP extract."""
    if sys.platform != "win32":
        return
    root = (root or app_dir()).resolve()
    try:
        import subprocess

        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "Get-ChildItem -LiteralPath "
                + str(root).replace("'", "''")
                + " -Recurse -Force -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue",
            ],
            check=False,
            creationflags=flags,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Unblock-File skipped: {exc}", flush=True)


def _notify_user(title: str, message: str) -> None:
    print(f"{title}: {message}", flush=True)
    if sys.platform != "win32":
        return
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, message[:1500], title, 0x30)
    except Exception:
        pass


def _window_state_path(root: Path) -> Path:
    return root / "data" / "window.json"


def _load_window_state(root: Path) -> dict:
    defaults = {
        "width": 1280,
        "height": 840,
        "x": None,
        "y": None,
        "maximized": False,
    }
    path = _window_state_path(root)
    if not path.exists():
        return defaults
    try:
        import json

        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return defaults
        width = int(raw.get("width", defaults["width"]))
        height = int(raw.get("height", defaults["height"]))
        x = raw.get("x", None)
        y = raw.get("y", None)
        return {
            "width": max(960, width),
            "height": max(640, height),
            "x": int(x) if x is not None else None,
            "y": int(y) if y is not None else None,
            "maximized": bool(raw.get("maximized", False)),
        }
    except Exception as exc:  # noqa: BLE001
        print(f"Could not load window state: {exc}", flush=True)
        return defaults


def _save_window_state(root: Path, state: dict) -> None:
    path = _window_state_path(root)
    try:
        import json

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"Could not save window state: {exc}", flush=True)


def _attach_window_state_persistence(window, root: Path, initial: dict) -> None:
    """Remember size/position between launches."""
    state = {
        "width": int(initial["width"]),
        "height": int(initial["height"]),
        "x": initial.get("x"),
        "y": initial.get("y"),
        "maximized": bool(initial.get("maximized", False)),
    }
    save_timer: threading.Timer | None = None
    lock = threading.Lock()

    def flush() -> None:
        nonlocal save_timer
        with lock:
            save_timer = None
            snapshot = dict(state)
        _save_window_state(root, snapshot)

    def schedule_save() -> None:
        nonlocal save_timer
        with lock:
            if save_timer is not None:
                save_timer.cancel()
            save_timer = threading.Timer(0.35, flush)
            save_timer.daemon = True
            save_timer.start()

    def on_resized(width: int | None = None, height: int | None = None) -> None:
        if state["maximized"]:
            return
        state["width"] = int(width if width is not None else window.width)
        state["height"] = int(height if height is not None else window.height)
        schedule_save()

    def on_moved() -> None:
        if state["maximized"]:
            return
        state["x"] = int(window.x) if window.x is not None else None
        state["y"] = int(window.y) if window.y is not None else None
        schedule_save()

    def on_maximized() -> None:
        state["maximized"] = True
        schedule_save()

    def on_restored() -> None:
        state["maximized"] = False
        state["width"] = int(window.width)
        state["height"] = int(window.height)
        state["x"] = int(window.x) if window.x is not None else None
        state["y"] = int(window.y) if window.y is not None else None
        schedule_save()

    def on_closing() -> None:
        if not state["maximized"]:
            state["width"] = int(window.width)
            state["height"] = int(window.height)
            state["x"] = int(window.x) if window.x is not None else None
            state["y"] = int(window.y) if window.y is not None else None
        flush()

    window.events.resized += on_resized
    window.events.moved += on_moved
    window.events.maximized += on_maximized
    window.events.restored += on_restored
    window.events.closing += on_closing


# Avoid uvicorn.DefaultFormatter (calls sys.stdout.isatty()) in windowed builds.
_SAFE_UVICORN_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": "%(levelname)s:     %(message)s"},
        "access": {"format": "%(levelname)s:     %(message)s"},
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
    },
}


def _wait_for_server(url: str, timeout_s: float = 30.0) -> None:
    health = url.rstrip("/") + "/health"
    deadline = time.time() + timeout_s
    last_error = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=1.0) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = str(exc)
        time.sleep(0.15)
    raise SystemExit(f"Server did not become ready at {health}: {last_error}")


def _run_uvicorn(app, host: str, port: int):
    import uvicorn

    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info",
        log_config=_SAFE_UVICORN_LOG_CONFIG,
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, name="uvicorn", daemon=True)
    thread.start()
    return server, thread


def _stop_uvicorn(server) -> None:
    server.should_exit = True


def _open_native_window(url: str, root: Path) -> bool:
    """Open pywebview window. Returns False if native UI is unavailable."""
    import traceback

    try:
        import clr  # noqa: F401 — required by Windows pywebview backends
        import webview
    except Exception as exc:  # noqa: BLE001 — missing optional GUI stack
        details = traceback.format_exc()
        print(details, flush=True)
        _notify_user(
            "Reading Library",
            "Не удалось загрузить компонент окна (pywebview/pythonnet).\n\n"
            f"{exc}\n\n"
            "Запустите через Start.bat или разблокируйте файлы в свойствах ZIP.\n"
            "Подробности: data\\app.log",
        )
        return False

    try:
        geometry = _load_window_state(root)
        storage_path = root / "data" / "webview"
        storage_path.mkdir(parents=True, exist_ok=True)

        window = webview.create_window(
            "Reading Library",
            url,
            width=geometry["width"],
            height=geometry["height"],
            x=geometry["x"],
            y=geometry["y"],
            maximized=geometry["maximized"],
            min_size=(960, 640),
            background_color="#111111",
        )
        _attach_window_state_persistence(window, root, geometry)

        # Persist theme/locale localStorage across launches (private_mode defaults to True).
        start_kwargs = {
            "private_mode": False,
            "storage_path": str(storage_path),
        }
        try:
            webview.start(gui="edgechromium", **start_kwargs)
        except Exception:
            webview.start(**start_kwargs)
        return True
    except Exception as exc:  # noqa: BLE001 — headless / missing WebView runtime
        details = traceback.format_exc()
        print(details, flush=True)
        _notify_user(
            "Reading Library",
            "Не удалось открыть нативное окно.\n\n"
            f"{exc}\n\n"
            "Нужен Microsoft Edge WebView2 Runtime.\n"
            "Запустите через Start.bat. Подробности: data\\app.log\n"
            "Сейчас откроется обычный браузер.",
        )
        return False


def main() -> None:
    root = configure_portable_env()
    ensure_windowed_stdio(root / "data" / "app.log")
    os.chdir(root)

    # Imports after env configuration — settings/engine read env at import time.
    from backend.app.bootstrap import ensure_schema
    from backend.app.main import app
    from backend.app.settings import settings

    if not Path(settings.static_dir).joinpath("index.html").exists():
        raise SystemExit(
            f"Frontend build not found at {settings.static_dir}. "
            "Run: cd frontend && npm ci && npm run build"
        )

    ensure_schema()

    host = settings.app_host
    port = settings.app_port
    open_host = "127.0.0.1" if host in {"0.0.0.0", "::", "[::]"} else host
    url = f"http://{open_host}:{port}"

    print(f"Reading Library (portable) → {url}", flush=True)
    print(f"Database: {settings.sqlite_path}", flush=True)
    print(f"Uploads:  {settings.uploads_dir}", flush=True)

    server, _thread = _run_uvicorn(app, host, port)
    try:
        _wait_for_server(url)

        force_browser = _env_flag("READING_LIBRARY_BROWSER")
        used_native = False
        if not force_browser:
            used_native = _open_native_window(url, root)

        if not used_native:
            print("Opening system browser. Close this window / press Ctrl+C to stop.", flush=True)
            try:
                webbrowser.open(url)
            except Exception:
                pass
            try:
                while not server.should_exit:
                    time.sleep(0.5)
            except KeyboardInterrupt:
                print("\nStopping…")
    finally:
        _stop_uvicorn(server)
        time.sleep(0.2)


if __name__ == "__main__":
    if is_frozen():
        from multiprocessing import freeze_support

        freeze_support()
    main()
