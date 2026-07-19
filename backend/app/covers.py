"""Cover image resize/compress helpers."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageOps

COVER_MAX_EDGE = 800
JPEG_QUALITY = 85
WEBP_QUALITY = 85


def _normalized_rgb(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.getchannel("A") if "A" in image.getbands() else None
        background.paste(image.convert("RGBA"), mask=alpha)
        return background
    if image.mode == "P":
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _resize_long_edge(image: Image.Image, max_edge: int = COVER_MAX_EDGE) -> Image.Image:
    width, height = image.size
    long_edge = max(width, height)
    if long_edge <= max_edge:
        return image
    scale = max_edge / float(long_edge)
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def _encode(image: Image.Image, suffix: str) -> bytes:
    out = io.BytesIO()
    suffix = suffix.lower()
    if suffix == ".png":
        if image.mode not in {"RGB", "RGBA", "L", "LA", "P"}:
            image = image.convert("RGBA")
        image.save(out, format="PNG", optimize=True)
    elif suffix == ".webp":
        if image.mode not in {"RGB", "RGBA"}:
            image = _normalized_rgb(image)
        image.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    else:
        rgb = _normalized_rgb(image)
        rgb.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


def process_cover_bytes(
    data: bytes,
    *,
    content_type: str | None = None,
    source_suffix: str | None = None,
    max_edge: int = COVER_MAX_EDGE,
    keep_suffix: bool = False,
) -> tuple[bytes, str]:
    """
    Resize/compress a cover image.

    Returns (bytes, suffix) where suffix includes the leading dot (.jpg / .png / .webp).
    New uploads default to JPEG (smaller). Migration can keep the existing suffix.
    """
    suffix = (source_suffix or "").lower()
    if suffix == ".jpeg":
        suffix = ".jpg"
    ctype = (content_type or "").lower()

    with Image.open(io.BytesIO(data)) as image:
        image.load()
        image = ImageOps.exif_transpose(image)
        resized = _resize_long_edge(image, max_edge=max_edge)

        if keep_suffix and suffix in {".jpg", ".png", ".webp"}:
            out_suffix = suffix
        elif ctype == "image/png" or suffix == ".png":
            # Prefer JPEG for opaque covers; keep PNG only when alpha is present.
            if "A" in resized.getbands() or resized.mode in {"RGBA", "LA", "P"}:
                out_suffix = ".png"
            else:
                out_suffix = ".jpg"
        elif ctype == "image/webp" or suffix == ".webp":
            out_suffix = ".webp"
        else:
            out_suffix = ".jpg"

        return _encode(resized, out_suffix), out_suffix


def compress_cover_file(path: Path, *, max_edge: int = COVER_MAX_EDGE) -> tuple[bool, int]:
    """
    Rewrite an on-disk cover in place (same filename/suffix) if compression helps.

    Returns (changed, bytes_saved).
    """
    if not path.is_file():
        return False, 0

    original = path.read_bytes()
    before = len(original)
    try:
        with Image.open(io.BytesIO(original)) as image:
            long_edge = max(image.size)
        processed, _out_suffix = process_cover_bytes(
            original,
            source_suffix=path.suffix,
            max_edge=max_edge,
            keep_suffix=True,
        )
    except Exception:
        return False, 0

    if long_edge <= max_edge and len(processed) >= before * 0.95:
        return False, 0

    path.write_bytes(processed)
    return True, max(0, before - len(processed))


def compress_covers_tree(root: Path, *, max_edge: int = COVER_MAX_EDGE) -> tuple[int, int, int]:
    """
    Compress cover.* files under an uploads root.

    Returns (files_seen, files_changed, bytes_saved).
    """
    if not root.is_dir():
        return 0, 0, 0

    seen = 0
    changed = 0
    saved = 0
    for path in sorted(root.rglob("cover.*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        seen += 1
        did_change, delta = compress_cover_file(path, max_edge=max_edge)
        if did_change:
            changed += 1
            saved += delta
    return seen, changed, saved
