"""Shared hand-modelled Chinese architectural details for the five spatial landmarks."""
import math

import bpy

from common import beam, box, curve, cylinder, lathe, material, mesh, sphere, torus


def hip_roof(name, width, depth, eave_z, rise, tile, tile_edge, wood, ridge=None, spacing=0.28):
    """Curved hip roof with real thickness, tile ribs, hip caps and raised corners."""
    half_w, half_d = width / 2, depth / 2
    ridge_half = ridge if ridge is not None else max(0.28, (width - depth) * 0.43)
    ridge_half = min(ridge_half, half_w * 0.72)
    rows, cols = 10, 32

    def point(side, u, v, end=False):
        x = side * (ridge_half * (1 - v) + half_w * v) if end else (ridge_half * (1 - v) + half_w * v) * u
        y = side * half_d * v * u if end else side * half_d * v
        z = eave_z + rise * (1 - v) ** 1.42 + 0.13 * v ** 5 + 0.20 * abs(u) ** 7 * v ** 3
        return (x, y, z)

    for end in (False, True):
        sides = (-1, 1) if not end else (-1, 1)
        for side in sides:
            vertices = []
            for j in range(rows + 1):
                v = j / rows
                for i in range(cols + 1):
                    u = -1 + 2 * i / cols
                    vertices.append(point(side, u, v, end))
            faces = []
            for j in range(rows):
                for i in range(cols):
                    a = j * (cols + 1) + i
                    face = (a, a + 1, a + cols + 2, a + cols + 1)
                    if end or side < 0:
                        face = tuple(reversed(face))
                    faces.append(face)
            roof = mesh(f"{name} | curved tile slope", vertices, faces, tile, smooth=True)
            roof.data.materials.append(wood)
            solid = roof.modifiers.new("Solid roof and visible timber soffit", "SOLIDIFY")
            solid.thickness = 0.105
            solid.offset = -1
            solid.material_offset = 1
            solid.material_offset_rim = 1
            # Long raised tile channels follow the curved slopes.
            count = max(5, int((depth if end else width) / spacing))
            for i in range(count + 1):
                u = -0.97 + 1.94 * i / count
                points = [point(side, u, 0.035 + 0.965 * j / 12, end) for j in range(13)]
                points = [(x, y, z + 0.028) for x, y, z in points]
                curve(f"{name} | rounded tile channel", points, 0.021, tile_edge)
            # Horizontal courses remain legible without noisy texture maps.
            for j in range(2, 10, 2):
                v = j / 10
                points = [point(side, -0.98 + 1.96 * i / 24, v, end) for i in range(25)]
                points = [(x, y, z + 0.016) for x, y, z in points]
                curve(f"{name} | tile course", points, 0.009, tile_edge)
            edge = [point(side, -1 + 2 * i / 32, 1, end) for i in range(33)]
            curve(f"{name} | deep eave fascia", edge, 0.072, wood)
            curve(f"{name} | pale tile eave lip", [(x, y, z + 0.048) for x, y, z in edge], 0.035, tile_edge)

    # Four diagonal hip caps cover all slope junctions.
    for sx in (-1, 1):
        for sy in (-1, 1):
            points = []
            for j in range(17):
                v = j / 16
                x = sx * (ridge_half * (1 - v) + half_w * v)
                y = sy * half_d * v
                z = eave_z + rise * (1 - v) ** 1.42 + 0.13 * v ** 5 + 0.20 * v ** 3
                points.append((x, y, z + 0.07))
            curve(f"{name} | raised hip ridge", points, 0.065, tile_edge)
            x, y, z = points[-1]
            curve(f"{name} | corner swallow tail", [(x - sx * 0.28, y - sy * 0.18, z - 0.02), (x, y, z + 0.02), (x + sx * 0.16, y + sy * 0.12, z + 0.20)], 0.047, tile_edge, smooth=True)

    beam(f"{name} | main ridge", (-ridge_half - 0.15, 0, eave_z + rise + 0.075), (ridge_half + 0.15, 0, eave_z + rise + 0.075), 0.17, 0.17, tile_edge, 0.035)
    for side in (-1, 1):
        x = side * (ridge_half + 0.18)
        curve(f"{name} | ridge end scroll", [(x - side * 0.20, 0, eave_z + rise + 0.04), (x, 0, eave_z + rise + 0.13), (x + side * 0.08, 0, eave_z + rise + 0.34)], 0.065, tile_edge, smooth=True)


def lattice_panel(name, center, width, height, wood, inset, orientation="front", dense=False):
    """Opaque backed wooden lattice; orientation front/back is XZ, side is YZ."""
    x, y, z = center
    side = orientation.startswith("side")
    side_sign = -1 if orientation == "side_reverse" else 1

    def part(label, u, v, w, h, mat, depth=0.065, offset=0):
        dims = (w, depth, h) if not side else (depth, w, h)
        loc = (x + u, y + offset, z + v) if not side else (x + side_sign * offset, y + u, z + v)
        return box(f"{name} | {label}", loc, dims, mat, min(0.009, depth / 5))

    part("recessed solid backing", 0, 0, width, height, inset, 0.045, 0.035)
    for u in (-width / 2, width / 2):
        part("outer stile", u, 0, 0.075, height + 0.09, wood, 0.09, -0.015)
    for v in (-height / 2, height / 2):
        part("outer rail", 0, v, width + 0.08, 0.075, wood, 0.09, -0.015)
    verticals = 5 if dense else 3
    for i in range(1, verticals + 1):
        u = -width / 2 + width * i / (verticals + 1)
        part("vertical lattice", u, 0, 0.035, height, wood, 0.07, -0.045)
    for i in range(1, 4):
        v = -height / 2 + height * i / 4
        part("horizontal lattice", 0, v, width, 0.035, wood, 0.07, -0.045)
    # A strong central diamond reads at gameplay distance.
    points_local = [(0, height * 0.29), (width * 0.27, 0), (0, -height * 0.29), (-width * 0.27, 0)]
    points = [(x + u, y - 0.09, z + v) for u, v in points_local] if not side else [(x - 0.09 * side_sign, y + u, z + v) for u, v in points_local]
    curve(f"{name} | central diamond", points, 0.025, wood, cyclic=True)


def bookshelf(name, center, width, height, wood, dark, paper, accent=None, orientation="front"):
    x, y, z = center
    side = orientation == "side"

    def part(label, u, v, w, h, d, mat, offset=0):
        loc = (x + u, y + offset, z + v) if not side else (x + offset, y + u, z + v)
        dims = (w, d, h) if not side else (d, w, h)
        return box(f"{name} | {label}", loc, dims, mat, 0.008)

    part("back", 0, height / 2, width, height, 0.09, dark, 0.15)
    for u in (-width / 2, width / 2):
        part("side", u, height / 2, 0.09, height + 0.08, 0.42, wood)
    shelves = 4
    for j in range(shelves + 1):
        v = height * j / shelves
        part("shelf", 0, v, width + 0.12, 0.075, 0.46, wood)
        if j == shelves:
            continue
        for i in range(max(4, int(width / 0.17))):
            u = -width * 0.43 + i * width * 0.86 / max(1, int(width / 0.17) - 1)
            h = height / shelves * (0.56 + 0.15 * ((i + j) % 3))
            mat = paper if (i + j) % 4 else (accent or dark)
            part("bound volume", u, v + 0.07 + h / 2, 0.10, h, 0.24, mat, -0.09)
            part("book spine band", u, v + 0.11, 0.105, 0.025, 0.255, wood, -0.095)


def table(name, center, width, depth, height, wood, edge):
    x, y, z = center
    box(f"{name} | top", (x, y, z + height), (width, depth, 0.12), wood, 0.035)
    box(f"{name} | top inset", (x, y, z + height + 0.067), (width - 0.12, depth - 0.12, 0.025), edge, 0.012)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"{name} | leg", (x + sx * (width / 2 - 0.15), y + sy * (depth / 2 - 0.13), z + height / 2), (0.12, 0.12, height), wood, 0.018)
    box(f"{name} | front apron", (x, y - depth / 2 + 0.10, z + height - 0.17), (width - 0.20, 0.09, 0.25), wood, 0.014)


def stool(name, center, wood, cushion=None):
    x, y, z = center
    cylinder(f"{name} | round seat", (x, y, z + 0.46), 0.25, 0.09, cushion or wood, 24, 0.018)
    for i in range(4):
        a = math.tau * (i + 0.5) / 4
        px, py = x + 0.16 * math.cos(a), y + 0.16 * math.sin(a)
        beam(f"{name} | splayed leg", (px, py, z + 0.43), (x + 0.21 * math.cos(a), y + 0.21 * math.sin(a), z + 0.03), 0.055, 0.055, wood)


def scroll(name, center, length, paper, wood, horizontal=True):
    x, y, z = center
    rotation = (0, math.pi / 2, 0) if horizontal else (math.pi / 2, 0, 0)
    cylinder(f"{name} | rolled paper", (x, y, z), 0.055, length, paper, 20, 0.004, rotation)
    for side in (-1, 1):
        loc = (x + side * length / 2, y, z) if horizontal else (x, y + side * length / 2, z)
        cylinder(f"{name} | wooden roller", loc, 0.068, 0.035, wood, 20, 0.004, rotation)


def geometric_plaque(name, center, width, wood, gold, icon="diamond"):
    x, y, z = center
    box(f"{name} | framed board", (x, y, z), (width, 0.15, 0.55), wood, 0.035)
    for zz in (-0.225, 0.225):
        box(f"{name} | gilt border", (x, y - 0.083, z + zz), (width - 0.12, 0.025, 0.025), gold, 0.005)
    for xx in (-width / 2 + 0.075, width / 2 - 0.075):
        box(f"{name} | gilt border", (x + xx, y - 0.083, z), (0.025, 0.025, 0.46), gold, 0.005)
    if icon == "book":
        for side in (-1, 1):
            curve(f"{name} | open book emblem", [(x, y - 0.105, z - 0.13), (x + side * 0.28, y - 0.105, z - 0.07), (x + side * 0.28, y - 0.105, z + 0.15), (x, y - 0.105, z + 0.08)], 0.025, gold)
    elif icon == "ingot":
        curve(f"{name} | ingot emblem", [(x - 0.32, y - 0.105, z + 0.08), (x - 0.20, y - 0.105, z - 0.10), (x + 0.20, y - 0.105, z - 0.10), (x + 0.32, y - 0.105, z + 0.08)], 0.035, gold, smooth=True)
        box(f"{name} | ingot crown", (x, y - 0.11, z + 0.08), (0.27, 0.05, 0.13), gold, 0.025)
    else:
        curve(f"{name} | geometric seal", [(x - 0.20, y - 0.105, z), (x, y - 0.105, z + 0.17), (x + 0.20, y - 0.105, z), (x, y - 0.105, z - 0.17)], 0.028, gold, cyclic=True)


def stone_steps(name, width, front_y, top_z, stone, count=3):
    for i in range(count):
        height = top_z * (count - i) / count
        depth = 0.34 * (i + 1)
        box(f"{name} | tread {i + 1}", (0, front_y - depth / 2 + 0.12, height / 2), (width + 0.16 * i, depth, height), stone, 0.018)
