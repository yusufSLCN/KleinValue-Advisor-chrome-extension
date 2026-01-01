#!/usr/bin/env python3
"""Utility for preparing Chrome Web Store screenshots.

Usage:
    python dev/resize_screenshots.py --input screenshots --output screenshots/store

- Processes up to the first N (default 5) PNG/JPG files in the input directory.
- Produces letterboxed (non-cropped) versions in the required 1280x800 and 640x400 sizes.
- Saves 24-bit PNGs (RGB, no alpha) named <original>-<width>x<height>.png in the output directory.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

from PIL import Image

# Accepted Chrome Web Store sizes (width, height)
TARGET_SIZES: Sequence[Tuple[int, int]] = ((1280, 800),)
BACKGROUND_COLOR = (8, 12, 20)  # deep navy that blends with extension UI


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        default="screenshots",
        help="Directory containing raw screenshots (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        default="screenshots/store",
        help="Directory for resized exports (default: %(default)s)",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=5,
        help="Maximum number of screenshots to process (default: %(default)s)",
    )
    parser.add_argument(
        "--formats",
        nargs="*",
        choices=("png", "jpg", "jpeg"),
        default=("png", "jpg", "jpeg"),
        help="File extensions to include (default: png jpg jpeg)",
    )
    return parser.parse_args()


def collect_images(folder: Path, patterns: Iterable[str]) -> List[Path]:
    files: List[Path] = []
    for pattern in patterns:
        files.extend(sorted(folder.glob(pattern)))
    return files


def resize_letterbox(image: Image.Image, target_size: Tuple[int, int]) -> Image.Image:
    width, height = image.size
    target_w, target_h = target_size
    image = image.convert("RGB")

    scale = min(target_w / width, target_h / height)
    new_size = (int(round(width * scale)), int(round(height * scale)))
    resized = image.resize(new_size, Image.LANCZOS)

    canvas = Image.new("RGB", target_size, BACKGROUND_COLOR)
    offset_x = max((target_w - resized.width) // 2, 0)
    offset_y = max((target_h - resized.height) // 2, 0)
    canvas.paste(resized, (offset_x, offset_y))
    return canvas


def export_image(src: Path, dest_folder: Path, target_size: Tuple[int, int]) -> Path:
    target_w, target_h = target_size
    stem = src.stem.replace(" ", "-")
    output_path = dest_folder / f"{stem}-{target_w}x{target_h}.png"

    with Image.open(src) as img:
        processed = resize_letterbox(img, target_size)
        processed.save(output_path, format="PNG", optimize=True)

    return output_path


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        raise SystemExit(f"Input directory not found: {input_dir}")

    patterns = [f"*.{ext.lower()}" for ext in args.formats]
    candidates = collect_images(input_dir, patterns)

    if not candidates:
        raise SystemExit("No screenshots found. Accepted extensions: " + ", ".join(args.formats))

    selected = candidates[: max(args.max, 1)]
    print(f"Processing {len(selected)} screenshot(s) from {input_dir} → {output_dir}")

    for src in selected:
        for size in TARGET_SIZES:
            output_path = export_image(src, output_dir, size)
            print(f"  ✓ {src.name} → {output_path.name}")

    print("Done. Upload these files to the Chrome Web Store listing.")


if __name__ == "__main__":
    main()
