"""Bake original Cathedral of the Eight materials; Python + NumPy + Pillow.
Run: python scripts/bake-cathedral.py. Deterministic, no downloaded source art.
Normals use periodic height derivatives and tangent-space OpenGL +Y.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "public/environments/cathedral"
RNG = np.random.default_rng(802146)
N = 1024
Y, X = np.mgrid[:N, :N].astype(np.float32) / N


def noise(frequency):
    fy = np.fft.fftfreq(N)[:, None] * N / frequency
    fx = np.fft.rfftfreq(N)[None, :] * N / frequency
    spectrum = np.fft.rfft2(RNG.standard_normal((N, N)))
    field = np.fft.irfft2(spectrum * np.exp(-(fx * fx + fy * fy) / 2), s=(N, N))
    return field / (field.std() + 1e-8)


def material(name, rgb, height, strength):
    Image.fromarray(np.uint8(np.clip(rgb, 0, 255))).save(OUT / f"{name}-color.webp", quality=93, method=6)
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    normal = np.stack((-dx, dy, np.ones_like(dx)), -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    Image.fromarray(np.uint8(np.clip(normal * 127.5 + 127.5, 0, 255))).save(OUT / f"{name}-normal.webp", quality=93, method=6)


def surfaces():
    broad, medium, grain = noise(4), noise(28), noise(230)
    row = np.floor(Y * 4)
    ux = (X * 2 + (row % 2) * .5) % 1
    uy = (Y * 4) % 1
    edge = np.minimum(np.minimum(ux, 1 - ux), np.minimum(uy, 1 - uy))
    mortar = np.clip((.018 - edge) / .013, 0, 1)
    pits = np.clip(grain - 1.4, 0, 2)
    variation = broad * 6 + medium * 3 + grain * 2 - mortar * 27 - pits * 9
    rgb = np.array([157, 147, 125]) + variation[..., None]
    material("stone", rgb, broad * .12 + medium * .08 + grain * .025 - mortar * .7 - pits * .1, 2.5)
    vein = np.exp(-np.abs(np.sin((X * 5 + Y * 3) * math.tau + broad * 1.4 + medium * .08)) * 23)
    ux, uy = X * 4 % 1, Y * 4 % 1
    seams = (np.minimum(np.minimum(ux, 1 - ux), np.minimum(uy, 1 - uy)) < .012).astype(float)
    checker = (np.floor(X * 4) + np.floor(Y * 4)) % 2
    variation = broad * 5 + medium * 2 + grain - vein * 12 - seams * 36 - checker * 14
    material("floor", np.array([140, 139, 125]) + variation[..., None], medium * .04 - seams * .4 - vein * .03, 2)
    # Ornamental bronze-bound timber: bevels and embossed scrolls share a height map.
    image = Image.new("RGB", (N, N), (35, 32, 27))
    relief = Image.new("L", (N, N), 70)
    d, h = ImageDraw.Draw(image), ImageDraw.Draw(relief)
    for cx in (256, 768):
        for cy in (165, 510, 855):
            rect = (cx - 207, cy - 140, cx + 207, cy + 140)
            for inset, col, level in ((0, "#746342", 180), (8, "#282722", 90), (17, "#544b36", 140), (22, "#201f1c", 65)):
                box = tuple(v + (inset if i < 2 else -inset) for i, v in enumerate(rect))
                d.rounded_rectangle(box, radius=50, fill=col)
                h.rounded_rectangle(box, radius=50, fill=level)
            for k in range(8):
                a = k * math.tau / 8
                pts = []
                for t in np.linspace(0, math.tau * 1.35, 100):
                    r = 2 + t * 7
                    px, py = math.cos(t) * r + 68, math.sin(t) * r
                    pts.append((cx + math.cos(a) * px - math.sin(a) * py, cy + (math.sin(a) * px + math.cos(a) * py) * .65))
                d.line(pts, fill="#877047", width=4)
                h.line(pts, fill=170, width=5)
            d.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), fill="#95805a", outline="#161a18", width=4)
            h.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), fill=210)
    for x in (17, 495, 512, 529, 1007):
        d.line((x, 0, x, N), fill="#807150", width=5)
        h.line((x, 0, x, N), fill=175, width=5)
        for y in range(20, N, 55):
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#bd9a59")
    rgb = np.asarray(image).astype(float) + (broad * 3 + grain * 1.4)[..., None]
    height = np.asarray(relief.filter(ImageFilter.GaussianBlur(1))).astype(float) / 255 + grain * .008
    material("door", rgb, height, 4)


PALETTE = ["#ecd5a1", "#e3c483", "#f8e8bc", "#cfaa68", "#e8d9b1", "#882f35", "#447d7e", "#d4bb88"]


def glass():
    # High-resolution leadwork, eight petals, jewel borders and nested mandalas.
    size, c = 2048, 1024
    image = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(image)
    def pt(r, a):
        return (c + math.cos(a) * r, c + math.sin(a) * r)
    def cell(points, color, width=6):
        d.polygon(points, fill=color)
        d.line(points + [points[0]], fill="#343932", width=width, joint="curve")
    def ring(inner, outer, count, phase=0):
        for i in range(count):
            a, b = i * math.tau / count + phase, (i + 1) * math.tau / count + phase
            pts = [pt(outer, t) for t in np.linspace(a, b, 9)] + [pt(inner, t) for t in np.linspace(b, a, 9)]
            color = PALETTE[(i * 3 + int(inner)) % len(PALETTE)]
            cell(pts, color, 5)
    d.ellipse((28, 28, size - 28, size - 28), fill="#b29d69", outline="#292f29", width=18)
    ring(925, 978, 64)
    ring(861, 914, 32, math.pi / 32)
    # Leaded mosaic fills the spaces between the eight principal petals.
    for band, (inner, outer) in enumerate(((230, 330), (338, 446), (454, 562), (570, 678), (686, 794), (802, 858))):
        for sector in range(64):
            a = sector * math.tau / 64
            b = (sector + 1) * math.tau / 64
            mid = (a + b) / 2
            color = PALETTE[5 + (sector // 8) % 2] if band in (1, 4) and sector % 4 == 0 else PALETTE[(sector + band) % 5]
            cell([pt(inner, a), pt(outer, a), pt(outer, b), pt(inner, b)], color, 5)
            if sector % 2 == 0:
                radius = (inner + outer) / 2
                cell([pt(radius - 23, mid), pt(radius, mid + .025), pt(radius + 23, mid), pt(radius, mid - .025)], "#be9255", 3)
    for i in range(8):
        angle = i * math.tau / 8 - math.pi / 2
        # Each petal subdivides into a pair of jewel-tipped lancets.
        for side in (-1, 1):
            axis = angle + side * .125
            for j, (r0, r1) in enumerate(((215, 400), (400, 585), (585, 760), (760, 850))):
                spread = (.063, .089, .086, .047)[j]
                cell([pt(r0, axis - spread * .8), pt(r1, axis - spread), pt(r1 + 33, axis), pt(r1, axis + spread), pt(r0, axis + spread * .8)], PALETTE[(i + j) % 5], 11)
                mid = (r0 + r1) / 2
                cell([pt(mid - 41, axis), pt(mid, axis + .047), pt(mid + 41, axis), pt(mid, axis - .047)], PALETTE[5 + (i + j) % 2], 6)
                # Floral filigree within each petal panel.
                px, py = pt(mid, axis)
                for k in range(4):
                    a = axis + k * math.pi / 2
                    cx, cy = px + math.cos(a) * 27, py + math.sin(a) * 27
                    d.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), outline="#6d6349", width=4)
        for r in (330, 535, 730):
            axis = angle + math.pi / 8
            cell([pt(r - 52, axis), pt(r, axis + .045), pt(r + 52, axis), pt(r, axis - .045)], "#a97c4d", 7)
        # Quatrefoils in the outer lobes.
        cx, cy = pt(833, angle)
        for k in range(4):
            a = k * math.pi / 2
            px, py = cx + math.cos(a) * 29, cy + math.sin(a) * 29
            d.ellipse((px - 31, py - 31, px + 31, py + 31), fill=PALETTE[i % 5], outline="#424339", width=6)
        d.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), fill="#842e35", outline="#383b30", width=4)
    ring(177, 222, 32)
    ring(119, 169, 16)
    star = [pt(110 if i % 2 == 0 else 47, i * math.pi / 8) for i in range(16)]
    d.ellipse((c - 119, c - 119, c + 119, c + 119), fill="#8d3336", outline="#35392e", width=8)
    cell(star, "#ecd396", 5)
    d.ellipse((c - 27, c - 27, c + 27, c + 27), fill="#e6b766", outline="#3c3e32", width=5)
    texture_glass(image).save(OUT / "rose.png", optimize=True)
    # Tall windows use a pointed silhouette, multiple lights and saint-like geometric emblems.
    w, hh, aa = 512, 1024, 2
    image = Image.new("RGBA", (w * aa, hh * aa))
    d = ImageDraw.Draw(image)
    shape = [(36, 1008), (36, 240), (55, 167), (111, 92), (256, 12), (401, 92), (457, 167), (476, 240), (476, 1008)]
    d.polygon([(x * aa, y * aa) for x, y in shape], fill="#414638")
    for column in range(3):
        left = (49 + column * 141) * aa
        for row in range(9):
            top = (220 + row * 86) * aa
            box = (left, top, left + 127 * aa, top + 77 * aa)
            d.rectangle(box, fill=PALETTE[(row + column * 2) % 5], outline="#302f2a", width=4 * aa)
            cx, cy = left + 63 * aa, top + 38 * aa
            d.polygon([(cx, cy - 27 * aa), (cx + 22 * aa, cy), (cx, cy + 27 * aa), (cx - 22 * aa, cy)], fill=PALETTE[5 + row % 2], outline="#4b4634", width=3 * aa)
    for radius, color in ((85, "#bd985e"), (66, "#79373b"), (48, "#e4d4a0"), (20, "#488487")):
        d.ellipse(((256 - radius) * aa, (137 - radius) * aa, (256 + radius) * aa, (137 + radius) * aa), fill=color, outline="#34382d", width=5 * aa)
    image = image.resize((w, hh), Image.Resampling.LANCZOS)
    texture_glass(image).save(OUT / "lancet.png", optimize=True)


def texture_glass(image):
    rgba = np.asarray(image).copy()
    h, w = rgba.shape[:2]
    # Small irregularities retain the light/dark lead contrast; not flat vector glass.
    cloud = Image.fromarray(RNG.integers(0, 255, (max(2, h // 32), max(2, w // 32)), dtype=np.uint8))
    cloud = np.asarray(cloud.resize((w, h), Image.Resampling.BICUBIC)).astype(float)
    factor = .88 + cloud / 255 * .18 + RNG.normal(0, .015, (h, w))
    rgba[..., :3] = np.uint8(np.clip(rgba[..., :3] * factor[..., None], 0, 255))
    return Image.fromarray(rgba)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    surfaces()
    glass()
    for path in sorted(OUT.iterdir()):
        print(f"{path.name}: {path.stat().st_size:,} bytes")
