"""Wuchang wealthy banquet house: enclosed formal hall, broad eaves and set feast."""
import math

import bpy

from common import box, curve, cylinder, lathe, material, sphere, torus
from landmarks_common import geometric_plaque, hip_roof, lattice_panel, stone_steps, stool, table


def lantern(x, y, red, gold):
    curve("Banquet lantern | suspension", [(x, y, 3.65), (x, y, 3.35)], 0.014, gold)
    lathe("Banquet lantern | ribbed silk body", [(0.15, 0), (0.26, 0.10), (0.29, 0.30), (0.25, 0.51), (0.14, 0.60)], red, 32, (x, y, 2.78), False, True)
    for z, r in ((2.78, 0.15), (3.38, 0.14)):
        cylinder("Banquet lantern | cap", (x, y, z), r + 0.025, 0.055, gold, 24, 0.008)
    for i in range(8):
        a = math.tau * i / 8
        curve("Banquet lantern | rib", [(x + r * math.cos(a), y + r * math.sin(a), z) for r, z in ((0.16, 2.79), (0.275, 2.96), (0.275, 3.20), (0.15, 3.37))], 0.010, gold, smooth=True)
    for dx in (-0.025, 0, 0.025):
        curve("Banquet lantern | tassel", [(x + dx, y, 2.75), (x + dx * 1.4, y, 2.52)], 0.007, red)


def build_banquet_house():
    wood = material("Banquet House | polished rosewood", "6D352A", 0.38)
    wood_edge = material("Banquet House | warm carved wood edges", "A36943", 0.43)
    dark = material("Banquet House | dark recessed timber", "342824", 0.66)
    plaster = material("Banquet House | warm silk plaster", "D6C5A4", 0.88)
    stone = material("Banquet House | granite foundation", "8B8B7E", 0.86)
    gold = material("Banquet House | muted brass", "C5A05B", 0.34, 0.58)
    tile = material("Banquet House | blue charcoal glazed tile", "364B4C", 0.52)
    tile_edge = material("Banquet House | glazed tile highlights", "5E7370", 0.48)
    red = material("Banquet House | vermilion silk", "AF4534", 0.54, emission=0.06)
    celadon = material("Banquet House | celadon feast ware", "A9C7B4", 0.27)
    food = material("Banquet House | golden banquet dishes", "C99045", 0.64)

    box("Banquet hall | raised stone platform", (0, 0, 0.17), (8.35, 5.05, 0.34), stone, 0.045)
    box("Banquet hall | polished interior floor", (0, 0, 0.365), (7.95, 4.70, 0.09), wood_edge, 0.018)
    for x in range(-3, 4):
        box("Banquet hall | floor board joint", (x, 0, 0.416), (0.018, 4.55, 0.012), dark, 0)
    stone_steps("Banquet hall entry", 3.65, -2.35, 0.34, stone, 3)

    # Complete rear and side enclosure, with an open formal front entrance.
    box("Banquet hall | rear plaster wall", (0, 2.08, 2.12), (7.85, 0.22, 3.46), plaster, 0.025)
    for sx in (-1, 1):
        box("Banquet hall | side plaster wall", (sx * 3.90, 0, 2.12), (0.22, 4.25, 3.46), plaster, 0.025)
        box("Banquet hall | side timber dado", (sx * 3.77, 0, 0.94), (0.09, 4.10, 1.05), wood, 0.015)
        lattice_panel("Banquet hall | side lattice window", (sx * 4.03, 0.10, 2.45), 2.25, 1.35, wood, dark, "side" if sx < 0 else "side_reverse", True)
        box("Banquet hall | front enclosed window bay", (sx * 2.86, -2.06, 2.10), (2.02, 0.22, 3.40), plaster, 0.025)
        box("Banquet hall | front carved dado", (sx * 2.86, -2.20, 0.94), (1.98, 0.10, 1.00), wood, 0.018)
        lattice_panel("Banquet hall | front lattice window", (sx * 2.86, -2.20, 2.39), 1.66, 1.52, wood_edge, dark, "front", True)
        # Open door leaves sit along the entrance reveals, not across the passage.
        door = box("Banquet hall | open rosewood door", (sx * 1.70, -1.49, 1.76), (1.18, 0.13, 2.66), wood, 0.025, (0, 0, math.pi / 2))
        for z in (0.70, 1.35, 2.10, 2.80):
            for yy in (-1.88, -1.55, -1.22):
                sphere("Banquet hall | gilded door stud", (sx * 1.61, yy, z), (0.035, 0.035, 0.035), gold, 12, 8)
        torus("Banquet hall | door ring handle", (sx * 1.60, -1.23, 1.55), 0.09, 0.017, gold, (0, math.pi / 2, 0), 24, 8)

    for x in (-4.00, -1.78, 1.78, 4.00):
        box("Banquet hall | front column stone shoe", (x, -2.14, 0.51), (0.48, 0.48, 0.22), stone, 0.035)
        cylinder("Banquet hall | round rosewood column", (x, -2.14, 2.18), 0.15, 3.22, wood, 20, 0.015)
        for z in (0.69, 3.60):
            box("Banquet hall | column collar", (x, -2.14, z), (0.37, 0.37, 0.11), gold if z < 1 else wood_edge, 0.018)
        for sx in (-1, 1):
            curve("Banquet hall | curved bracket arm", [(x, -2.14, 3.36), (x + sx * 0.24, -2.14, 3.64), (x + sx * 0.52, -2.14, 3.72)], 0.075, wood, smooth=True)
    for y in (-2.14, 2.12):
        box("Banquet hall | main crossbeam", (0, y, 3.70), (8.12, 0.25, 0.28), wood, 0.028)
        box("Banquet hall | gilt beam bead", (0, y - 0.14, 3.70), (7.85, 0.035, 0.045), gold, 0.008)
    for x in (-3.9, 3.9):
        box("Banquet hall | side top beam", (x, 0, 3.70), (0.24, 4.35, 0.28), wood, 0.025)
    box("Banquet hall | entrance lintel", (0, -2.16, 3.30), (3.45, 0.24, 0.26), wood, 0.025)
    geometric_plaque("Banquet hall | prosperity plaque", (0, -2.34, 3.55), 1.80, dark, gold, "ingot")

    # A visible, fully set banquet distinguishes the interior from a pavilion.
    table("Banquet hall | central feast table", (0, -0.10, 0.41), 3.20, 1.35, 0.78, wood, wood_edge)
    for x in (-1.08, -0.36, 0.36, 1.08):
        for y in (-1.13, 0.93):
            stool("Banquet hall | dining stool", (x, y, 0.41), wood, red)
            lathe("Banquet hall | celadon plate", [(0.02, 0), (0.18, 0.015), (0.22, 0.045), (0.20, 0.065), (0.03, 0.035)], celadon, 24, (x, -0.10 + (-0.43 if y < 0 else 0.43), 1.33), False, True)
            cylinder("Banquet hall | wine cup", (x + 0.19, -0.10 + (-0.30 if y < 0 else 0.30), 1.40), 0.055, 0.12, gold, 16, 0.006)
    for x, r in ((-0.73, 0.30), (0, 0.38), (0.73, 0.30)):
        lathe("Banquet hall | large serving dish", [(0.03, 0), (r, 0.04), (r * 1.08, 0.10), (r * 0.85, 0.12)], celadon, 28, (x, -0.10, 1.34), False, True)
        for i in range(5):
            a = math.tau * i / 5
            sphere("Banquet hall | sculpted food", (x + 0.14 * math.cos(a), -0.10 + 0.14 * math.sin(a), 1.49), (0.10, 0.08, 0.065), food, 16, 8)
    for sx in (-1, 1):
        table("Banquet hall | side serving table", (sx * 2.85, 1.25, 0.41), 1.40, 0.60, 0.90, wood, wood_edge)
        lantern(sx * 2.35, -0.95, red, gold)
    lattice_panel("Banquet hall | rear decorative screen", (0, 1.93, 2.16), 3.45, 2.25, wood, dark, "front", True)

    hip_roof("Banquet hall broad hip roof", 9.0, 6.0, 4.10, 1.05, tile, tile_edge, dark, ridge=1.65, spacing=0.26)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
