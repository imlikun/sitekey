#!/usr/bin/env python3
"""Render SiteKey app icons without external dependencies."""

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4

TOP = (113, 110, 245)
BOTTOM = (74, 66, 196)


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, width: int, height: int, rows: list[bytes]) -> None:
    raw = b"".join(b"\x00" + bytes(row) for row in rows)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(png)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def inside_rounded(x, y, size, radius):
    half = size / 2.0
    qx = abs(x - half) - (half - radius)
    qy = abs(y - half) - (half - radius)
    dx = max(qx, 0.0)
    dy = max(qy, 0.0)
    return math.hypot(dx, dy) - radius <= 0.0


def render(size: int) -> list[bytes]:
    scale = SUPERSAMPLE
    hi = size * scale
    radius = hi * 0.225
    center = hi * 0.5

    key_cy = hi * 0.405
    key_r = hi * 0.118
    stem_top = hi * 0.455
    stem_bottom = hi * 0.675
    half_top = hi * 0.043
    half_bottom = hi * 0.070

    pixels = bytearray(hi * hi * 4)

    for py in range(hi):
        y = py + 0.5
        for px in range(hi):
            x = px + 0.5
            index = (py * hi + px) * 4

            if not inside_rounded(x, y, hi, radius):
                continue

            t = (x / hi + y / hi) * 0.5
            color = lerp(TOP, BOTTOM, t)

            if y < hi * 0.52:
                lift = 0.11 * (1.0 - y / (hi * 0.52))
                color = lerp(color, (255, 255, 255), lift)

            inside_key = math.hypot(x - center, y - key_cy) <= key_r
            if not inside_key and stem_top <= y <= stem_bottom:
                ratio = (y - stem_top) / (stem_bottom - stem_top)
                half = half_top + (half_bottom - half_top) * ratio
                inside_key = abs(x - center) <= half

            if inside_key:
                color = (255, 255, 255)

            pixels[index] = color[0]
            pixels[index + 1] = color[1]
            pixels[index + 2] = color[2]
            pixels[index + 3] = 255

    rows: list[bytearray] = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            rs = gs = bs = total_alpha = 0
            for dy in range(scale):
                for dx in range(scale):
                    i = ((y * scale + dy) * hi + (x * scale + dx)) * 4
                    alpha = pixels[i + 3]
                    rs += pixels[i] * alpha
                    gs += pixels[i + 1] * alpha
                    bs += pixels[i + 2] * alpha
                    total_alpha += alpha
            alpha = total_alpha / (scale * scale)
            if total_alpha == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes(
                    (
                        round(rs / total_alpha),
                        round(gs / total_alpha),
                        round(bs / total_alpha),
                        round(alpha),
                    )
                )
        rows.append(row)
    return rows


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        rows = render(size)
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        write_png(path, size, size, rows)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
