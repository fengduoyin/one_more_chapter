"""Installed app version.

The footer shows APP_VERSION. GitHub latest release is only used to hint that
an update exists; it never overwrites the version baked into a build.
"""

from __future__ import annotations

import re

# Bump this when assembling a new portable/Docker build.
APP_VERSION = "v1.2.0"
GITHUB_REPO = "fengduoyin/one_more_chapter"

_VERSION_RE = re.compile(r"[0-9]+")


def normalize_version(value: str | None) -> str:
    text = (value or "").strip()
    if text.lower().startswith("v"):
        text = text[1:].strip()
    return text


def format_tag(value: str | None) -> str:
    version = normalize_version(value)
    return f"v{version}" if version else ""


def version_tuple(value: str | None) -> tuple[int, ...]:
    parts = []
    for chunk in normalize_version(value).split("."):
        match = _VERSION_RE.search(chunk)
        parts.append(int(match.group(0)) if match else 0)
    return tuple(parts) or (0,)


def is_newer(latest: str | None, current: str | None) -> bool:
    left = version_tuple(latest)
    right = version_tuple(current)
    width = max(len(left), len(right))
    left += (0,) * (width - len(left))
    right += (0,) * (width - len(right))
    return left > right


def current_version() -> str:
    return normalize_version(APP_VERSION)
