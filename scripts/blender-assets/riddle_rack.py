"""Three-metre lantern riddle rack with blank tags and modeled joinery."""
import math

import bpy

from common import beam, box, curve, cylinder, extrude_xz, lathe, material, sphere, torus


def lantern(x, palette):
    red, red_alt, gold, cord = palette
    profile = [(0.115, 1.985), (0.19, 2.025), (0.246, 2.15), (0.255, 2.31), (0.215, 2.455), (0.12, 2.51)]
    body = lathe("Ribbed red silk lantern", profile, red, 48, center=(x, 0, 0), closed=False, cap_ends=True)
    body.data.materials.append(red_alt)
    for polygon in body.data.polygons:
        segment = polygon.index % 48
        polygon.material_index = 1 if (segment // 4) % 2 else 0
    for i in range(12):
        angle = math.tau * i / 12
        points = [(x + (r + 0.006) * math.cos(angle), (r + 0.006) * math.sin(angle), z) for r, z in profile]
        curve("Lantern bamboo rib", points, 0.008, gold, smooth=True)
    for z, radius in [(2.025, 0.19), (2.15, 0.246), (2.31, 0.255), (2.455, 0.215)]:
        torus("Lantern horizontal stitched ring", (x, 0, z), radius + 0.003, 0.006, cord, major_segments=48, minor_segments=6)
    cylinder("Lantern lower carved cap", (x, 0, 1.978), 0.14, 0.055, gold, 32, 0.009)
    cylinder("Lantern upper carved cap", (x, 0, 2.522), 0.14, 0.055, gold, 32, 0.009)
    cylinder("Lantern top red crown", (x, 0, 2.558), 0.105, 0.035, red, 32, 0.007)
    torus("Lantern cap bead", (x, 0, 2.552), 0.108, 0.009, gold, major_segments=32)
    curve("Lantern suspension cord", [(x, 0, 2.575), (x, 0, 2.76)], 0.012, cord)
    torus("Suspension loop", (x, 0, 2.60), 0.035, 0.009, gold, (math.pi / 2, 0, 0), 24, 6)
    sphere("Lantern tassel knot", (x, 0, 1.902), (0.046, 0.046, 0.055), gold, 20, 10)
    curve("Riddle tag suspension", [(x, 0, 1.955), (x, 0, 1.50)], 0.009, cord)
    for i in range(9):
        angle = math.tau * i / 9
        curve("Silk lantern tassel", [(x + 0.027 * math.cos(angle), 0.027 * math.sin(angle), 1.88), (x + 0.038 * math.cos(angle), 0.038 * math.sin(angle), 1.72)], 0.0045, cord)


def blank_riddle_tag(x, paper, border, gold, cord):
    outline = [(-0.145, 1.47), (0.145, 1.47), (0.16, 1.445), (0.16, 1.105), (0.13, 1.08), (-0.13, 1.08), (-0.16, 1.105), (-0.16, 1.445)]
    extrude_xz("Blank thick paper riddle slip", [(px + x, pz) for px, pz in outline], -0.018, 0.018, paper, 0.005)
    torus("Riddle slip brass eyelet", (x, -0.032, 1.425), 0.018, 0.005, gold, (math.pi / 2, 0, 0), 20, 6)
    # Deliberately blank: only a fine decorative border, without glyphs or pseudo-writing.
    border_points = [(x - 0.125, -0.031, 1.385), (x + 0.125, -0.031, 1.385), (x + 0.125, -0.031, 1.135), (x - 0.125, -0.031, 1.135)]
    curve("Riddle slip cinnabar border", border_points, 0.0035, border, cyclic=True)
    sphere("Tag lower cord knot", (x, -0.01, 1.065), (0.022, 0.018, 0.025), border, 16, 8)
    for offset in (-0.016, 0, 0.016):
        curve("Tag red tassel strand", [(x + offset, -0.01, 1.045), (x + offset * 1.3, -0.015, 0.91)], 0.004, cord)


def build_riddle_rack():
    wood = material("Rack | oxblood lacquered elm", "632F29", 0.4)
    wood_edge = material("Rack | polished worn edges", "9B5C3E", 0.43)
    wood_dark = material("Rack | dark carved recess", "321D1B", 0.6)
    gold = material("Rack | mellow antique brass", "C5A259", 0.34, 0.62)
    red = material("Lantern | vermilion silk", "C93B32", 0.48, emission=0.18)
    red_alt = material("Lantern | warm silk panels", "E1533F", 0.52, emission=0.15)
    cord = material("Rack | deep red silk cord", "8E2526", 0.68)
    paper = material("Rack | blank warm rice paper", "E9DAB5", 0.88)
    border = material("Rack | cinnabar border", "B64736", 0.66)
    stone = material("Rack | stone foot pads", "777469", 0.82)

    for x in (-1.10, 1.10):
        box("Rack stone pad", (x, 0, 0.035), (0.56, 0.64, 0.07), stone, 0.025)
        box("Broad trestle foot", (x, 0, 0.12), (0.51, 0.56, 0.12), wood_dark, 0.026)
        box("Foot lacquer cap", (x, 0, 0.19), (0.39, 0.40, 0.07), wood_edge, 0.018)
        box("Main rack upright", (x, 0, 1.445), (0.145, 0.17, 2.49), wood, 0.022)
        box("Upright raised front bead", (x, -0.091, 1.48), (0.042, 0.022, 2.25), wood_edge, 0.009)
        for z in (0.27, 0.44, 2.45, 2.64):
            box("Upright brass collar", (x, 0, z), (0.174, 0.20, 0.055), gold, 0.008)
        side = 1 if x > 0 else -1
        beam("Top diagonal bracket", (x, 0, 2.27), (x - side * 0.35, 0, 2.68), 0.085, 0.12, wood, 0.016)
        beam("Foot inner knee brace", (x, 0, 0.52), (x - side * 0.22, 0, 0.22), 0.065, 0.09, wood, 0.012)
        for z, dims in [(2.61, (0.31, 0.30, 0.08)), (2.69, (0.43, 0.34, 0.07)), (2.75, (0.55, 0.30, 0.065))]:
            box("Layered dougong bracket", (x, 0, z), dims, wood_dark if z == 2.61 else wood, 0.015)
        sphere("Upright brass pin", (x, -0.111, 2.49), (0.022, 0.012, 0.022), gold, 16, 8)
    box("Low rack stretcher", (0, 0, 0.44), (2.25, 0.12, 0.12), wood, 0.018)
    box("Stretcher front bead", (0, -0.067, 0.46), (2.05, 0.02, 0.035), wood_edge, 0.007)

    outline = [
        (-1.44, 2.99), (-1.30, 2.875), (-0.80, 2.825), (0, 2.805), (0.80, 2.825), (1.30, 2.875), (1.44, 2.99),
        (1.38, 2.725), (0.88, 2.68), (0, 2.67), (-0.88, 2.68), (-1.38, 2.725),
    ]
    extrude_xz("Sweeping upturned lintel", outline, 0, 0.22, wood, 0.022)
    curve("Lintel gilded upper bead", [(x, -0.121, z - 0.025) for x, z in outline[:7]], 0.014, gold, smooth=True)
    curve("Lintel lower edge bead", [(-1.34, -0.121, 2.725), (-0.8, -0.121, 2.70), (0, -0.121, 2.69), (0.8, -0.121, 2.70), (1.34, -0.121, 2.725)], 0.012, wood_edge, smooth=True)
    for x in (-1.44, 1.44):
        sphere("Lintel end finial", (x, 0, 2.985), (0.048, 0.115, 0.042), gold, 24, 10)
    # Symmetric cloud scrolls leave the three lanterns visually distinct.
    for side in (-1, 1):
        for offset in (0.42, 0.80):
            x = side * offset
            points = [(x - side * 0.12, -0.126, 2.77), (x - side * 0.06, -0.128, 2.86), (x + side * 0.04, -0.128, 2.86), (x + side * 0.08, -0.128, 2.79), (x + side * 0.02, -0.128, 2.76)]
            curve("Carved lintel cloud scroll", points, 0.012, gold, smooth=True)

    palette = (red, red_alt, gold, cord)
    for x in (-0.77, 0, 0.77):
        lantern(x, palette)
        blank_riddle_tag(x, paper, border, gold, cord)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
