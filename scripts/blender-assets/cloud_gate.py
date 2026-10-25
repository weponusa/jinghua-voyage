"""Daren Cloud Gate: pierced jade cloud-work, twin piers and a levitating halo."""
import math

import bpy

from common import box, curve, cylinder, lathe, material, sphere, torus


def cloud_scroll(name, cx, cy, cz, size, mat, flip=1, radius=0.055):
    points = [
        (-0.72, -0.05), (-0.52, 0.07), (-0.24, 0.08), (-0.10, 0.25),
        (0.13, 0.29), (0.31, 0.15), (0.24, -0.01), (0.04, -0.02),
        (-0.03, 0.10), (0.08, 0.14), (0.40, -0.10), (0.72, -0.04),
    ]
    curve(name, [(cx + flip * size * x, cy, cz + size * z) for x, z in points], radius, mat, smooth=True)


def build_cloud_gate():
    jade = material("Cloud Gate | pale celadon jade", "B8D8CA", 0.28, 0.08)
    ivory = material("Cloud Gate | luminous white nephrite", "E7E8D8", 0.32, 0.03)
    shade = material("Cloud Gate | recessed jade", "719F96", 0.48, 0.05)
    gold = material("Cloud Gate | brushed pale gold", "D7BC78", 0.30, 0.62)
    pearl = material("Cloud Gate | warm cloud pearl", "F4E9C9", 0.22, 0.16, emission=0.10)

    for sx in (-1, 1):
        x = sx * 2.35
        box("Cloud pier | broad floating-foot plinth", (x, 0, 0.10), (1.10, 1.02, 0.20), shade, 0.075)
        box("Cloud pier | white jade foundation", (x, 0, 0.28), (0.90, 0.86, 0.22), ivory, 0.065)
        lathe("Cloud pier | lotus pedestal", [(0.43, 0), (0.46, 0.08), (0.36, 0.18), (0.32, 0.27)], jade, 32, (x, 0, 0.39), False, True)
        # Slightly tapered octagonal piers preserve a clear 3.9 m passage.
        lathe("Cloud pier | octagonal jade shaft", [(0.32, 0), (0.30, 0.30), (0.265, 2.75), (0.31, 3.15)], jade, 8, (x, 0, 0.65), False, True)
        for yy in (-0.28, 0.28):
            box("Cloud pier | long recessed flute", (x, yy, 2.18), (0.13, 0.035, 2.56), shade, 0.035)
            box("Cloud pier | inner gold thread", (x, yy * 1.04, 2.18), (0.025, 0.025, 2.30), gold, 0.008)
        for z in (0.74, 1.00, 3.48, 3.76):
            box("Cloud pier | layered collar", (x, 0, z), (0.74, 0.72, 0.12), ivory if z < 2 else gold, 0.035)
        # Wind-bent brackets and cloud clusters replace any conventional roof.
        for z, size in ((1.25, 0.68), (2.65, 0.76), (3.70, 0.88)):
            for yy in (-0.34, 0.34):
                cloud_scroll("Pier | carved auspicious cloud", x + sx * 0.16, yy, z, size, ivory, sx, 0.075)
                cloud_scroll("Pier | gold cloud vein", x + sx * 0.16, yy * 1.06, z - 0.07, size * 0.90, gold, sx, 0.018)
        for z, spread in ((3.95, 0.63), (4.28, 0.93)):
            cloud_scroll("Crown | outward flying cloud", sx * 2.67, 0, z, spread, jade, sx, 0.13)
            cloud_scroll("Crown | pale upper cloud layer", sx * 2.75, 0.04, z + 0.13, spread * 0.82, ivory, sx, 0.075)
        sphere("Crown | cloud tip pearl", (sx * 3.34, 0, 4.42), (0.15, 0.20, 0.13), pearl, 24, 12)

    # Three open, layered cloud lintels: no wall, tiles, or solid paifang signboard.
    for z, radius, mat in ((3.92, 0.13, shade), (4.16, 0.14, jade), (4.40, 0.09, ivory)):
        points = [(-2.22, 0, z), (-1.45, 0, z + 0.13), (-0.65, 0, z + 0.03), (0, 0, z + 0.12), (0.65, 0, z + 0.03), (1.45, 0, z + 0.13), (2.22, 0, z)]
        curve("Open crown | layered cloud lintel", points, radius, mat, smooth=True)
        for yy in (-0.13, 0.13):
            curve("Open crown | fine gold cloud edge", [(x, yy, zz + 0.06) for x, _, zz in points], 0.018, gold, smooth=True)

    # The floating vertical halo is entirely above the walk-through opening.
    torus("Levitating cloud halo | outer jade ring", (0, 0, 4.94), 0.84, 0.105, jade, (math.pi / 2, 0, 0), 64, 10)
    torus("Levitating cloud halo | inner gold orbit", (0, -0.025, 4.94), 0.68, 0.027, gold, (math.pi / 2, 0, 0), 56, 8)
    torus("Levitating cloud halo | offset outer orbit", (0, 0.14, 4.94), 0.96, 0.026, gold, (math.pi / 2, 0, 0), 64, 6)
    for i in range(7):
        angle = math.tau * i / 7
        x, z = 0.84 * math.cos(angle), 4.94 + 0.84 * math.sin(angle)
        sphere("Halo | inlaid cloud pearl", (x, -0.10, z), (0.055, 0.045, 0.055), pearl, 16, 8)
    sphere("Halo | zenith suspension pearl", (0, 0, 5.90), (0.10, 0.10, 0.10), pearl, 24, 12)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
