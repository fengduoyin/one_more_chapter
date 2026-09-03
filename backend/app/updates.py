"""Look up the latest GitHub release for a footer update hint."""

from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request

from backend.app.version import (
    GITHUB_REPO,
    current_version,
    format_tag,
    is_newer,
    normalize_version,
)

_CACHE_TTL_S = 60 * 60
_FAIL_TTL_S = 120
_FETCH_TIMEOUT_S = 2.5
_lock = threading.Lock()
_cache: dict | None = None
_cache_at = 0.0

_RELEASES_LATEST = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
_RELEASES_PAGE = f"https://github.com/{GITHUB_REPO}/releases/latest"


def _empty_latest() -> dict:
    return {"version": "", "url": _RELEASES_PAGE}


def fetch_latest_release(timeout: float = _FETCH_TIMEOUT_S) -> dict:
    request = urllib.request.Request(
        _RELEASES_LATEST,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "one-more-chapter",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        return _empty_latest()

    if not isinstance(payload, dict):
        return _empty_latest()
    tag = normalize_version(str(payload.get("tag_name") or ""))
    url = str(payload.get("html_url") or "").strip() or _RELEASES_PAGE
    return {"version": tag, "url": url}


def peek_latest_release() -> dict:
    with _lock:
        if _cache is not None:
            return dict(_cache)
        return _empty_latest()


def latest_release(force: bool = False) -> dict:
    global _cache, _cache_at
    now = time.monotonic()
    with _lock:
        if not force and _cache is not None:
            ttl = _CACHE_TTL_S if _cache.get("version") else _FAIL_TTL_S
            if (now - _cache_at) < ttl:
                return dict(_cache)
    latest = fetch_latest_release()
    with _lock:
        _cache = latest
        _cache_at = time.monotonic()
        return dict(latest)


def version_payload() -> dict:
    current = current_version()
    latest = peek_latest_release()
    latest_version = latest.get("version") or ""
    update_available = bool(latest_version) and is_newer(latest_version, current)
    return {
        "current_version": current,
        "current_label": format_tag(current),
        "latest_version": latest_version,
        "latest_label": format_tag(latest_version) if latest_version else "",
        "update_available": update_available,
        "release_url": latest.get("url") or _RELEASES_PAGE,
    }


def warm_latest_release() -> None:
    thread = threading.Thread(target=latest_release, name="github-release-check", daemon=True)
    thread.start()
