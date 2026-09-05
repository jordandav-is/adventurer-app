"""Bake original, seamless woodland materials and alpha-cutout botanical studies.

Requires Python, NumPy and Pillow. No downloads or source photographs are used.
Run from any directory: python scripts/bake-woodland.py
Height derivatives use periodic boundaries; normals are tangent-space OpenGL +Y.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024
SPRITE = 512
AA = 3
OUT = Path(__file__).resolve().parents[1] / "public/environments/woodland"
RNG = np.random.default_rng(410729)
Y, X = np.mgrid[:SIZE, :SIZE].astype(np.float32)
X /= SIZE
Y /= SIZE
FY = np.fft.fftfreq(SIZE)[:, None]
FX = np.fft.rfftfreq(SIZE)[None, :]


def noise(frequency, stretch=1.0):
    """Periodic, band-limited random field, expressed in cycles per tile."""
    spectrum = np.fft.rfft2(RNG.standard_normal((SIZE, SIZE)))
    radius = (FX * SIZE / frequency) ** 2 + (FY * SIZE * stretch / frequency) ** 2
    spectrum *= np.exp(-radius * 0.5)
    field = np.fft.irfft2(spectrum, s=(SIZE, SIZE)).astype(np.float32)
    return (field - field.mean()) / (field.std() + 1e-8)


def smoothstep(lo, hi, values):
    t = np.clip((values - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def color_mix(base, color, mask):
    return base * (1 - mask[..., None]) + np.asarray(color) * mask[..., None]


def cells(count, warp_x, warp_y, elongation=1):
    first = np.full((SIZE, SIZE), 10.0, dtype=np.float32)
    second = first.copy()
    for px, py in RNG.random((count, 2)):
        dx = (X + warp_x - px + 0.5) % 1 - 0.5
        dy = ((Y + warp_y - py + 0.5) % 1 - 0.5) / elongation
        distance = np.sqrt(dx * dx + dy * dy)
        second = np.minimum(second, np.maximum(first, distance))
        first = np.minimum(first, distance)
    return first, second - first


def save_material(name, rgb, height, relief):
    image = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)), "RGB")
    image.save(OUT / f"{name}-color.webp", quality=94, method=6)
    # Image rows descend, whereas OpenGL tangent V ascends.
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * relief
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * relief
    normals = np.stack((-dx, dy, np.ones_like(dx)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    # High-quality WebP keeps fine tangent detail without multi-megabyte maps.
    Image.fromarray(np.uint8(np.clip(normals * 127.5 + 127.5, 0, 255)), "RGB").save(
        OUT / f"{name}-normal.webp", quality=92, method=6
    )


def stone():
    broad, medium, grain = noise(3), noise(24), noise(180)
    fine = noise(340)
    warp_x, warp_y = noise(5) * 0.004, noise(6) * 0.004
    _, edge = cells(48, warp_x, warp_y)
    # Weathering interrupts hairline fractures instead of outlining every plate.
    cracks = 1 - smoothstep(0.00015, 0.0011, edge + noise(70) * 0.0003)
    cracks *= smoothstep(-0.3, 0.9, noise(13))
    crack_banks = (1 - smoothstep(0.001, 0.005, edge)) * 0.4
    pits = smoothstep(1.1, 2.2, noise(120)) * smoothstep(-0.8, 0.7, medium)
    micropits = smoothstep(1.25, 2.3, fine)
    bedding = np.sin(Y * math.tau * 19 + broad * 0.9 + medium * 0.2)
    mineral = noise(48)
    rgb = np.empty((SIZE, SIZE, 3), dtype=np.float32)
    rgb[:] = [139, 140, 134]
    rgb += (broad * 5 + medium * 6 + grain * 4 + fine * 2 + bedding * 2.5)[..., None]
    rgb += mineral[..., None] * np.array([2.3, 2.0, 1.4])
    rgb -= (cracks * 19 + crack_banks * 7 + pits * 19 + micropits * 11)[..., None]
    lichen_field = noise(30) + noise(90) * 0.48 + grain * 0.2
    lichen = smoothstep(1.0, 1.6, lichen_field)
    lichen *= 0.6 + 0.4 * smoothstep(-1, 1, fine)
    lichen_rgb = np.array([150, 152, 122]) + grain[..., None] * np.array([7, 8, 5])
    rgb = rgb * (1 - lichen[..., None] * 0.45) + lichen_rgb * lichen[..., None] * 0.45
    dark_lichen = smoothstep(1.3, 2.0, noise(43) + grain * 0.28) * (1 - lichen)
    rgb = color_mix(rgb, [101, 110, 82], dark_lichen * 0.32)
    height = medium * 0.06 + grain * 0.024 + fine * 0.009 + broad * 0.12 + bedding * 0.016
    height -= cracks * 0.08 + crack_banks * 0.04 + pits * 0.1 + micropits * 0.025
    height += lichen * (0.022 + grain * 0.007)
    save_material("stone", rgb, height, 3.5)


def ground():
    broad, clump, grain, fine = noise(4), noise(28), noise(180), noise(380)
    rgb = np.zeros((SIZE, SIZE, 3), dtype=np.float32) + [58, 48, 31]
    rgb += (broad * 5 + clump * 5 + grain * 4 + fine * 1.5)[..., None]
    moss = smoothstep(-0.2, 0.8, noise(6) + clump * 0.27 + grain * 0.12)
    moss_color = np.array([66, 77, 33]) + (clump * 7 + grain * 5)[..., None]
    rgb = rgb * (1 - moss[..., None]) + moss_color * moss[..., None]
    height = broad * 0.16 + clump * 0.055 + grain * 0.032 + fine * 0.013 + moss * 0.07
    # Raster overlays are repeated at tile boundaries, including their height field.
    canvas = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)), "RGB")
    hcanvas = Image.fromarray(np.uint8(np.clip(height * 65 + 110, 0, 255)), "L")
    draw, hd = ImageDraw.Draw(canvas), ImageDraw.Draw(hcanvas)
    for _ in range(2300):
        px, py = RNG.uniform(0, SIZE, 2)
        radius = RNG.uniform(0.6, 4.8)
        tone = float(RNG.uniform(50, 114))
        polygon = []
        for angle in np.linspace(0, math.tau, 7, endpoint=False):
            r = radius * RNG.uniform(0.6, 1.25)
            polygon.append((px + math.cos(angle) * r, py + math.sin(angle) * r * 0.65))
        for ox in (-SIZE, 0, SIZE):
            for oy in (-SIZE, 0, SIZE):
                points = [(x + ox, y + oy) for x, y in polygon]
                draw.polygon(points, fill=(int(tone), int(tone * 0.95), int(tone * 0.78)))
                hd.polygon(points, fill=139)
                draw.line([points[0], points[1], points[2]], fill=(int(tone + 15), int(tone + 12), int(tone)), width=1)
    for _ in range(340):
        px, py = RNG.uniform(0, SIZE, 2)
        length, angle = RNG.uniform(6, 29), RNG.uniform(0, math.tau)
        width = length * RNG.uniform(0.13, 0.32)
        ux, uy = math.cos(angle), math.sin(angle)
        points = [(px - ux * length / 2, py - uy * length / 2),
                  (px - uy * width, py + ux * width),
                  (px + ux * length / 2, py + uy * length / 2),
                  (px + uy * width * 0.8, py - ux * width * 0.8)]
        tone = RNG.uniform(0.65, 1.25)
        color = tuple(int(v * tone) for v in (94, 65, 30))
        for ox in (-SIZE, 0, SIZE):
            for oy in (-SIZE, 0, SIZE):
                p = [(x + ox, y + oy) for x, y in points]
                draw.polygon(p, fill=color)
                draw.line([p[0], p[2]], fill=(49, 39, 22), width=1)
                hd.polygon(p, fill=132)
    save_material("ground", np.asarray(canvas), (np.asarray(hcanvas, dtype=np.float32) - 110) / 65, 2.6)


def bark():
    long = noise(11, stretch=9)
    wave = X * math.tau * 22 + noise(4, stretch=3) * 2.2 + long * 0.5
    furrow = (0.5 + 0.5 * np.cos(wave)) ** 11
    small_furrow = (0.5 + 0.5 * np.sin(X * math.tau * 65 + long * 3)) ** 17
    plate, gap = cells(100, noise(5) * 0.006, noise(4) * 0.02, elongation=4)
    scales = 1 - smoothstep(0.0005, 0.003, gap)
    grain, fine = noise(170, stretch=4), noise(380)
    broad = noise(4)
    rgb = np.zeros((SIZE, SIZE, 3), dtype=np.float32) + [89, 76, 57]
    rgb += (long * 10 + broad * 8 + grain * 5 + fine * 2)[..., None]
    rgb -= (furrow * 46 + small_furrow * 17 + scales * 15)[..., None]
    light_side = np.sin(wave) * (1 - furrow)
    rgb += light_side[..., None] * np.array([10, 9, 7])
    moss = smoothstep(1.0, 1.8, noise(7) + grain * 0.15) * (1 - furrow)
    rgb = color_mix(rgb, [78, 91, 47], moss * 0.75)
    lichens = smoothstep(1.4, 1.9, noise(21) + fine * 0.2)
    rgb = color_mix(rgb, [138, 143, 115], lichens * 0.54)
    height = long * 0.075 + grain * 0.027 + fine * 0.007 - furrow * 0.34 - small_furrow * 0.065 - scales * 0.06
    save_material("bark", rgb, height, 3.8)


class Botanical:
    def __init__(self):
        self.image = Image.new("RGBA", (SPRITE * AA, SPRITE * AA))
        self.draw = ImageDraw.Draw(self.image)

    def line(self, points, color, width=1):
        self.draw.line([(round(x * AA), round(y * AA)) for x, y in points], fill=color, width=max(1, round(width * AA)), joint="curve")

    def polygon(self, points, color):
        self.draw.polygon([(round(x * AA), round(y * AA)) for x, y in points], fill=color)

    def leaf(self, start, tip, width, color, serration=0.05):
        x, y = start
        dx, dy = tip[0] - x, tip[1] - y
        length = math.hypot(dx, dy)
        if length < 0.1:
            return
        nx, ny = -dy / length, dx / length
        bend = RNG.uniform(-0.12, 0.12) * length
        outline = []
        for side in (1, -1):
            steps = np.linspace(0, 1, 19)
            if side == -1:
                steps = steps[::-1]
            for i, t in enumerate(steps):
                fullness = math.sin(math.pi * t) ** 0.78
                edge = 1 - serration * (i % 2) + RNG.uniform(-0.035, 0.035)
                offset = side * width * fullness * edge + bend * math.sin(math.pi * t)
                outline.append((x + dx * t + nx * offset, y + dy * t + ny * offset))
        self.polygon(outline, (*color, 255))
        vein = [(x + dx * t + nx * bend * math.sin(math.pi * t), y + dy * t + ny * bend * math.sin(math.pi * t)) for t in np.linspace(0, 1, 12)]
        half = outline[:19] + vein[::-1]
        self.polygon(half, (*[min(255, int(c * 1.13)) for c in color], 255))
        vein_color = (*[min(255, int(c * 1.25 + 7)) for c in color], 255)
        self.line(vein, vein_color, 0.48 if width < 7 else 0.7)
        for t in np.linspace(0.22, 0.8, 6):
            center = (x + dx * t + nx * bend * math.sin(math.pi * t), y + dy * t + ny * bend * math.sin(math.pi * t))
            for side in (-1, 1):
                tt = min(0.97, t + 0.12)
                offset = bend * math.sin(math.pi * tt) + side * width * math.sin(math.pi * tt) ** 0.78 * 0.85
                self.line([center, (x + dx * tt + nx * offset, y + dy * tt + ny * offset)], vein_color, 0.26)
        if width > 6:
            for _ in range(14):
                t = RNG.uniform(0.17, 0.87)
                offset = bend * math.sin(math.pi * t) + RNG.uniform(-0.7, 0.7) * width * math.sin(math.pi * t)
                p = (x + dx * t + nx * offset, y + dy * t + ny * offset)
                shade = (*[max(0, int(c * RNG.uniform(0.7, 0.9))) for c in color], 230)
                self.line([p, (p[0] + 0.5, p[1] + 0.7)], shade, 0.6)

    def save(self, name):
        # Pillow's RGBA resize filters premultiplied alpha, preventing dark fringes.
        self.image.resize((SPRITE, SPRITE), Image.Resampling.LANCZOS).save(OUT / f"{name}.png", optimize=True)


def curve(base, tip, bend, count=70):
    return [(base[0] + (tip[0] - base[0]) * t + bend * math.sin(math.pi * t),
             base[1] + (tip[1] - base[1]) * t) for t in np.linspace(0, 1, count)]


def leaves():
    plant = Botanical()
    stems = [((256, 508), (250, 40), 10), ((255, 465), (97, 161), -13),
             ((258, 410), (405, 114), 18), ((256, 343), (154, 71), -9),
             ((258, 488), (394, 280), 19)]
    for base, tip, bend in stems:
        path = curve(base, tip, bend)
        plant.line(path, (68, 61, 28, 255), 2.3)
        plant.line([(x - 0.45, y) for x, y in path], (150, 139, 66, 255), 0.7)
        for index in range(12, 67, 7):
            x, y = path[index]
            tx, ty = path[min(index + 2, 69)]
            vx, vy = tx - x, ty - y
            norm = math.hypot(vx, vy)
            vx, vy = vx / norm, vy / norm
            for side in (-1, 1):
                length = RNG.uniform(41, 65) * (1 - index / 160)
                direction = (vx * 0.65 - vy * side * 0.78, vy * 0.65 + vx * side * 0.78)
                end = (x + direction[0] * length, y + direction[1] * length)
                gold = RNG.uniform(0, 1)
                color = (int(91 + gold * 61), int(108 + gold * 27), int(37 + gold * 15))
                plant.leaf((x, y), end, length * RNG.uniform(0.19, 0.26), color, 0.1)
        plant.leaf(path[-9], (tip[0], tip[1] - 23), 9, (134, 143, 50), 0.1)
    plant.save("leaves")


def fern():
    plant = Botanical()
    fronds = [((257, 507), (47, 319), -37), ((252, 506), (463, 331), 36),
              ((254, 505), (80, 165), -33), ((258, 506), (426, 175), 40),
              ((253, 507), (142, 65), -29), ((257, 507), (356, 67), 36),
              ((254, 508), (246, 28), -9), ((254, 508), (193, 163), -36),
              ((258, 508), (309, 137), 31)]
    for number, (base, tip, bend) in enumerate(fronds):
        path = curve(base, tip, bend, 100)
        plant.line(path, (78, 96, 37, 255), 2.1)
        plant.line([(x - 0.5, y) for x, y in path], (139, 158, 68, 255), 0.7)
        for index in range(20, 98, 3):
            x, y = path[index]
            tx, ty = path[min(99, index + 1)]
            vx, vy = tx - x, ty - y
            norm = math.hypot(vx, vy)
            vx, vy = vx / norm, vy / norm
            envelope = math.sin(math.pi * (index - 7) / 94) ** 0.72
            length = (29 if number < 2 else 43) * envelope * RNG.uniform(0.87, 1.12)
            for side in (-1, 1):
                direction = (vx * 0.42 - vy * side * 0.9, vy * 0.42 + vx * side * 0.9)
                end = (x + direction[0] * length, y + direction[1] * length)
                light = RNG.uniform(0.83, 1.19)
                color = tuple(int(c * light) for c in (74 + number * 3, 104 + number * 3, 39))
                plant.leaf((x, y), end, max(0.6, length * 0.11), color, 0.27)
    plant.save("fern")


def flowers():
    plant = Botanical()
    for i in range(29):
        tip = (float(RNG.uniform(76, 439)), float(RNG.uniform(40, 276)))
        base = (float(RNG.uniform(238, 274)), 508)
        bend = float(RNG.uniform(-24, 24))
        path = curve(base, tip, bend, 90)
        plant.line(path, (64, 66, 35, 255), 1.6)
        plant.line([(x - 0.4, y) for x, y in path], (111, 115, 61, 255), 0.55)
        for index in range(10, 86, 3):
            x, y = path[index]
            for side in (-1, 1):
                reach = RNG.uniform(6, 13) * (1 - index / 150)
                plant.leaf((x, y), (x + side * reach, y - reach * 1.1), reach * 0.16,
                           (int(RNG.uniform(63, 95)), int(RNG.uniform(88, 125)), 43), 0.02)
        # Small branched racemes carry many asymmetric, downward-facing bells.
        for index in range(43, 90, 3):
            x, y = path[index]
            taper = (90 - index) / 47
            for side in (-1, 1):
                bx, by = x + side * RNG.uniform(2, 8) * (0.3 + taper), y + RNG.uniform(-2, 2)
                plant.line([(x, y), (bx, by + 2)], (112, 85, 75, 255), 0.55)
                radius = float(RNG.uniform(1.8, 3.0))
                shade = float(RNG.uniform(0.82, 1.2))
                dark = tuple(min(255, int(c * shade)) for c in (111, 65, 113))
                bright = tuple(min(255, int(c * shade)) for c in (180, 113, 177))
                plant.polygon([(bx, by - radius), (bx - radius * 0.65, by - radius * 0.6),
                               (bx - radius, by + radius * 0.75), (bx - radius * 0.7, by + radius * 1.3),
                               (bx, by + radius), (bx + radius * 0.7, by + radius * 1.3),
                               (bx + radius, by + radius * 0.4), (bx + radius * 0.4, by - radius)], (*dark, 255))
                plant.line([(bx - radius * 0.4, by - radius * 0.5), (bx - radius * 0.6, by + radius * 0.7)], (*bright, 255), 1.0)
                plant.line([(bx - radius * 0.6, by + radius), (bx, by + radius * 0.8), (bx + radius * 0.7, by + radius * 1.1)], (208, 151, 195, 255), 0.7)
                plant.line([(bx, by + radius), (bx + 0.2, by + radius * 1.6)], (203, 177, 126, 255), 0.4)
    plant.save("flowers")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stone()
    ground()
    bark()
    leaves()
    fern()
    flowers()
    for path in sorted(OUT.iterdir()):
        if path.suffix in {".webp", ".png"}:
            with Image.open(path) as image:
                print(f"{path.name}: {image.width}x{image.height} {image.mode}, {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
