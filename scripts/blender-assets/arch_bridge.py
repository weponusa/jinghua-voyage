"""Nine-metre garden bridge with a solid barrel arch, paved camber and open balustrades."""
import math

import bpy

from common import beam, box, curve, extrude_xz, lathe, material, mesh, torus

HALF_SPAN = 3.75
BRIDGE_WIDTH = 2.05
RAIL_Y = 1.075


def deck_z(x):
    return 0.40 + 1.15 * max(0.0, 1.0 - (x / HALF_SPAN) ** 2) ** 0.65


def arch_z(x, outer=False):
    rise = 1.34 if outer else 1.05
    return 0.055 + rise * math.sqrt(max(0.0, 1.0 - (x / HALF_SPAN) ** 2))


def structural_barrel(mat):
    vertices = []
    sections = 72
    for i in range(sections + 1):
        x = -HALF_SPAN + 2 * HALF_SPAN * i / sections
        low, high = arch_z(x), deck_z(x)
        vertices += [(x, -BRIDGE_WIDTH / 2, low), (x, BRIDGE_WIDTH / 2, low), (x, BRIDGE_WIDTH / 2, high), (x, -BRIDGE_WIDTH / 2, high)]
    faces = []
    for i in range(sections):
        a, b = i * 4, (i + 1) * 4
        faces += [(a + 1, b + 1, b, a), (a + 2, b + 2, b + 1, a + 1), (a + 3, b + 3, b + 2, a + 2), (a, b, b + 3, a + 3)]
    faces += [(3, 2, 1, 0), tuple(sections * 4 + j for j in range(4))]
    return mesh("Continuous load-bearing stone barrel", vertices, faces, mat)


def wedge_stone(name, theta0, theta1, y, mat):
    outline = []
    steps = 3
    for i in range(steps + 1):
        theta = theta0 + (theta1 - theta0) * i / steps
        x = HALF_SPAN * math.cos(theta)
        outline.append((x, arch_z(x)))
    for i in range(steps, -1, -1):
        theta = theta0 + (theta1 - theta0) * i / steps
        x = HALF_SPAN * math.cos(theta)
        outline.append((x, arch_z(x, True)))
    return extrude_xz(name, outline, y, 0.075, mat, 0.007)


def spandrel_block(name, x0, x1, y, mat):
    outline = []
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        outline.append((x, arch_z(x, True) + 0.012))
    for i in range(4, -1, -1):
        x = x0 + (x1 - x0) * i / 4
        outline.append((x, deck_z(x) - 0.012))
    return extrude_xz(name, outline, y, 0.07, mat, 0.006)


def paving_block(name, x0, x1, y0, y1, mat):
    vertices = []
    for z_offset in (-0.045, 0.026):
        vertices += [(x0, y0, deck_z(x0) + z_offset), (x1, y0, deck_z(x1) + z_offset), (x1, y1, deck_z(x1) + z_offset), (x0, y1, deck_z(x0) + z_offset)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh(name, vertices, faces, mat, 0.008)


def stone_post(x, y, base, mats):
    stone, light, dark = mats
    box("Balustrade post plinth", (x, y, base + 0.055), (0.25, 0.25, 0.11), dark, 0.018)
    box("Balustrade square post", (x, y, base + 0.38), (0.155, 0.155, 0.59), stone, 0.018)
    box("Post carved collar", (x, y, base + 0.68), (0.225, 0.225, 0.095), light, 0.016)
    box("Post collar shadow line", (x, y, base + 0.645), (0.19, 0.19, 0.025), dark, 0.005)
    lathe("Lotus-bud stone finial", [(0.088, 0), (0.105, 0.035), (0.075, 0.105), (0.043, 0.17), (0.006, 0.205)], light, 16, center=(x, y, base + 0.725), closed=False, cap_ends=True)


def railing_segment(x0, x1, y, mats):
    stone, light, dark = mats
    z0, z1 = deck_z(x0), deck_z(x1)
    beam("Sloping upper stone handrail", (x0, y, z0 + 0.655), (x1, y, z1 + 0.655), 0.13, 0.13, light, 0.014)
    beam("Sloping lower stone rail", (x0, y, z0 + 0.225), (x1, y, z1 + 0.225), 0.105, 0.105, stone, 0.012)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2 + 0.435
    # Open diamond panel and circular medallion, all actual stone geometry.
    points = [(cx - 0.19, y, cz), (cx, y, cz + 0.135), (cx + 0.19, y, cz), (cx, y, cz - 0.135)]
    curve("Openwork diamond balustrade panel", points, 0.023, stone, cyclic=True)
    torus("Openwork circular stone medallion", (cx, y, cz), 0.066, 0.019, light, (math.pi / 2, 0, 0), 24, 6)


def build_arch_bridge():
    stone = material("Bridge | warm grey limestone", "929B8D", 0.84)
    light = material("Bridge | worn pale stone edges", "B4B7A4", 0.78)
    dark = material("Bridge | aged recessed stone", "66746B", 0.9)
    stone_alt = material("Bridge | soft moss-grey blocks", "7F8C80", 0.87)
    deck_mat = material("Bridge | foot-worn paving", "A7AA98", 0.82)
    mortar = material("Bridge | deep masonry joints", "4E5A53", 0.95)
    mats = (stone, light, dark)

    structural_barrel(stone_alt)
    # Both elevations receive individually separated voussoirs and spandrel masonry.
    for y in (-1.06, 1.06):
        for i in range(29):
            gap = 0.0028
            theta0 = math.pi * i / 29 + gap
            theta1 = math.pi * (i + 1) / 29 - gap
            wedge_stone("Individual radial arch voussoir", theta0, theta1, y, light if i == 14 else (stone if i % 3 else stone_alt))
        for i in range(20):
            x0 = -HALF_SPAN + 2 * HALF_SPAN * i / 20 + 0.009
            x1 = -HALF_SPAN + 2 * HALF_SPAN * (i + 1) / 20 - 0.009
            spandrel_block("Coursed spandrel stone", x0, x1, y, stone if i % 4 else stone_alt)
    # Slightly proud central keystones.
    for y in (-1.105, 1.105):
        wedge_stone("Pale central arch keystone", math.pi / 2 - 0.047, math.pi / 2 + 0.047, y, light)

    # Complete cambered walking surface with separately modeled staggered pavers.
    rows, columns = 30, 4
    for i in range(rows):
        x0 = -HALF_SPAN + 2 * HALF_SPAN * i / rows + 0.008
        x1 = -HALF_SPAN + 2 * HALF_SPAN * (i + 1) / rows - 0.008
        for j in range(columns):
            y0 = -0.99 + 1.98 * j / columns + 0.008
            y1 = -0.99 + 1.98 * (j + 1) / columns - 0.008
            paving_block("Cambered walkway paver", x0, x1, y0, y1, deck_mat if (i + j) % 5 else stone)

    # Four broad approach steps at either end, bringing the total length to exactly 9 m.
    step_depth = 0.75 / 4
    for side in (-1, 1):
        for i in range(4):
            near = HALF_SPAN + i * step_depth
            far = near + step_depth
            top = 0.40 - i * 0.10
            center_x = side * (near + far) / 2
            box("Garden bridge approach step", (center_x, 0, top / 2), (step_depth + 0.006, 2.23, top), light if i % 2 else stone, 0.014)
            # Thin nosing makes each tread legible in grazing light.
            box("Step rounded nosing", (side * (far - 0.018), 0, top - 0.01), (0.04, 2.25, 0.04), light, 0.009)

    # Main balustrades and extended stair-end newels.
    xs = [-3.65 + 7.30 * i / 8 for i in range(9)]
    for y in (-RAIL_Y, RAIL_Y):
        for x in xs:
            stone_post(x, y, deck_z(x), mats)
        for x0, x1 in zip(xs, xs[1:]):
            railing_segment(x0, x1, y, mats)
        for side in (-1, 1):
            outer_x = side * 4.375
            stone_post(outer_x, y, 0.10, mats)
            inner_x = side * 3.65
            # Handrails continue down the approach rather than stopping abruptly.
            beam("Approach upper handrail", (inner_x, y, deck_z(inner_x) + 0.655), (outer_x, y, 0.755), 0.13, 0.13, light, 0.014)
            beam("Approach lower handrail", (inner_x, y, deck_z(inner_x) + 0.225), (outer_x, y, 0.325), 0.105, 0.105, stone, 0.012)

    # Fine intrados joints make the underside deliberately finished, not an open shell.
    for i in range(1, 20):
        x = -HALF_SPAN + 2 * HALF_SPAN * i / 20
        z = arch_z(x) - 0.006
        curve("Barrel underside transverse joint", [(x, -1.0, z), (x, 0, z), (x, 1.0, z)], 0.005, mortar)
    for y in (-0.50, 0, 0.50):
        points = []
        for i in range(65):
            x = -HALF_SPAN + 2 * HALF_SPAN * i / 64
            points.append((x, y, arch_z(x) - 0.006))
        curve("Barrel underside longitudinal joint", points, 0.004, mortar)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
