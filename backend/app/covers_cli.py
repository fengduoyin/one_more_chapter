"""CLI: compress on-disk book covers to COVER_MAX_EDGE."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from backend.app.covers import COVER_MAX_EDGE, compress_covers_tree


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compress book cover images")
    parser.add_argument(
        "roots",
        nargs="*",
        type=Path,
        help="Upload roots to scan (default: data/uploads + portable/uploads)",
    )
    parser.add_argument("--max-edge", type=int, default=COVER_MAX_EDGE)
    args = parser.parse_args(argv)

    roots = list(args.roots)
    if not roots:
        candidates = [Path("data/uploads"), Path("portable/uploads")]
        seen: set[Path] = set()
        for path in candidates:
            resolved = path.resolve()
            if resolved in seen or not path.is_dir():
                continue
            seen.add(resolved)
            roots.append(path)

    if not roots:
        print("No upload directories found.", file=sys.stderr)
        return 1

    total_seen = total_changed = total_saved = 0
    for root in roots:
        seen, changed, saved = compress_covers_tree(root, max_edge=args.max_edge)
        print(f"{root}: scanned={seen} changed={changed} saved={saved // 1024} KiB")
        total_seen += seen
        total_changed += changed
        total_saved += saved

    print(
        f"Total: scanned={total_seen} changed={total_changed} "
        f"saved={total_saved / (1024 * 1024):.1f} MiB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
