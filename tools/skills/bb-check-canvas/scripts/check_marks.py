"""Measure unique, solid rectangular fiducials in a synthetic exported PNG."""

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops


def measure(image, rgb, expected, tolerance):
    mask = Image.new("L", image.size, 255)
    for channel, value in zip("RGBA", (*rgb, 255)):
        matches = image.getchannel(channel).point([255 if i == value else 0 for i in range(256)])
        mask = ImageChops.darker(mask, matches)

    bounds = mask.getbbox()
    if bounds is None:
        return {"ok": False, "reason": "missing opaque marker"}
    left, top, right, bottom = bounds
    if mask.crop(bounds).getextrema()[0] != 255:
        return {"ok": False, "reason": "marker does not form one solid rectangle"}

    # Pillow bounds exclude the right and bottom edges. Report pixel indices.
    center = [(left + right - 1) / 2, (top + bottom - 1) / 2]
    delta = [actual - target for actual, target in zip(center, expected)]
    return {"center": center, "delta": delta, "ok": max(map(abs, delta)) <= tolerance}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("png", type=Path)
    parser.add_argument("--size", nargs=2, type=int, required=True, metavar=("WIDTH", "HEIGHT"))
    parser.add_argument("--mark", nargs=3, action="append", required=True, metavar=("RRGGBB", "X", "Y"))
    parser.add_argument("--tolerance", type=float, default=0, help="maximum error per axis in pixels")
    args = parser.parse_args()
    width, height = args.size
    if min(args.size) < 1 or not math.isfinite(args.tolerance) or args.tolerance < 0:
        parser.error("expected positive dimensions and a finite, nonnegative tolerance")
    marks = {}
    for color, x, y in args.mark:
        color = color.removeprefix("#").upper()
        if len(color) != 6 or any(c not in "0123456789ABCDEF" for c in color) or color in marks:
            parser.error("each mark needs its own six-digit RGB color")
        try:
            point = (float(x), float(y))
        except ValueError:
            parser.error("expected numeric marker coordinates")
        if not (0 <= point[0] < width and 0 <= point[1] < height):
            parser.error("expected marker coordinates within the target image")
        marks[color] = point

    try:
        with Image.open(args.png, formats=["PNG"]) as src:
            if src.is_animated:
                parser.error("expected one static PNG")
            image = src.convert("RGBA")
    except (OSError, Image.DecompressionBombError) as exc:
        parser.error(str(exc))

    results = {}
    for color, expected in marks.items():
        result = measure(image, bytes.fromhex(color), expected, args.tolerance)
        results[color] = {"expected": expected, **result}
    ok = image.size == (width, height) and all(result["ok"] for result in results.values())
    print(json.dumps({"size": image.size, "expected_size": args.size, "marks": results, "ok": ok}))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
