"""Wood-and-clay charcoal stove with a genuinely open firebox and filled bronze pot."""
import math
import random

from common import (
    arch_cutter, apply_boolean, beam, bevel, box, curve, cylinder, extrude_xz,
    lathe, material, mesh, sphere, torus,
)


def build_food_stove():
    random.seed(17)
    wood = material("Stove | smoked jujube wood", "56372B", 0.58)
    wood_light = material("Stove | rubbed wood edges", "8A5A3B", 0.52)
    wood_dark = material("Stove | recessed carved wood", "2D211D", 0.72)
    bronze = material("Stove | aged brass fittings", "B18A4A", 0.36, 0.68)
    bronze_dark = material("Stove | blackened bronze pot", "343B36", 0.34, 0.72)
    clay = material("Stove | honey terracotta", "A95F3F", 0.78)
    clay_light = material("Stove | worn ceramic edges", "CF8B60", 0.72)
    glaze = material("Stove | celadon glazed band", "416C63", 0.28)
    soot = material("Stove | firebox soot", "171816", 0.94)
    coal = material("Stove | charcoal", "292622", 0.9)
    ember = material("Stove | living embers", "F07825", 0.6, emission=1.8)
    broth = material("Stove | amber broth", "755027", 0.2)
    tofu = material("Stove | ivory tofu", "E8D6A5", 0.68)
    greens = material("Stove | scallion greens", "638B48", 0.62)

    # Splayed feet, stretchers and a mortise-and-tenon wooden cradle.
    for x in (-0.42, 0.42):
        for y in (-0.29, 0.29):
            box("Carved square foot", (x, y, 0.065), (0.205, 0.185, 0.13), wood_dark, 0.025)
            box("Foot brass shoe", (x, y, 0.035), (0.212, 0.192, 0.035), bronze, 0.009)
            leg = box("Tapered stove leg", (x, y, 0.345), (0.135, 0.135, 0.50), wood, 0.022)
            leg.rotation_euler[1] = -0.035 if x > 0 else 0.035
            box("Upper leg collar", (x, y, 0.555), (0.165, 0.16, 0.09), bronze, 0.012)
            for offset in (-0.026, 0.024):
                curve("Hand-cut leg grain", [(x + offset, y - 0.069, 0.14), (x + offset * 0.8, y - 0.07, 0.31), (x + offset, y - 0.069, 0.49)], 0.0025, wood_light, smooth=True)
        box("Side lower stretcher", (x, 0, 0.205), (0.075, 0.62, 0.075), wood, 0.014)
        box("Side upper rail", (x, 0, 0.52), (0.10, 0.69, 0.16), wood, 0.018)
    for y in (-0.31, 0.31):
        box("Front and rear apron", (0, y, 0.49), (0.91, 0.09, 0.22), wood, 0.022)
        box("Apron recessed field", (0, y + (-0.047 if y < 0 else 0.047), 0.49), (0.59, 0.018, 0.125), wood_dark, 0.012)
        box("Apron inset panel", (0, y + (-0.059 if y < 0 else 0.059), 0.49), (0.54, 0.015, 0.09), wood_light, 0.009)
        for sign in (-1, 1):
            curve("Carved apron cloud", [(sign * 0.04, y + (-0.07 if y < 0 else 0.07), 0.49), (sign * 0.13, y + (-0.07 if y < 0 else 0.07), 0.535), (sign * 0.22, y + (-0.07 if y < 0 else 0.07), 0.49), (sign * 0.13, y + (-0.07 if y < 0 else 0.07), 0.45)], 0.009, bronze, smooth=True)
    for x in (-0.43, 0.43):
        for y in (-0.30, 0.30):
            # Small curved-looking knee braces under the ceramic bowl.
            beam("Corner knee brace", (x, y, 0.42), (x * 0.78, y * 0.82, 0.65), 0.065, 0.065, wood_dark, 0.012)

    # Rounded ceramic combustion chamber, with an actual arched opening cut through it.
    body = lathe("Terracotta combustion chamber", [
        (0.34, 0.55), (0.43, 0.58), (0.465, 0.69),
        (0.465, 0.87), (0.425, 1.035), (0.345, 1.065),
    ], clay, segments=56, closed=False, cap_ends=True)
    cutter = arch_cutter("Arched firebox cutting tool", 0.43, 0.605, 0.765, -0.75, 0.12)
    apply_boolean(body, cutter)
    bevel(body, 0.008, 2)
    lathe("Celadon shoulder band", [(0.443, 0.963), (0.457, 0.973), (0.452, 1.005), (0.435, 1.015)], glaze, segments=56)
    torus("Lower rolled clay bead", (0, 0, 0.60), 0.427, 0.022, clay_light)
    torus("Upper celadon lip", (0, 0, 1.045), 0.382, 0.026, glaze)
    for i in range(18):
        a = math.tau * i / 18
        sphere("Ceramic band stud", (0.452 * math.cos(a), 0.452 * math.sin(a), 0.99), (0.018, 0.018, 0.014), bronze, 16, 8)
    # Arch bead follows the opening rather than covering it with a flat decal.
    arch_points = [(-0.228, -0.463, 0.61), (-0.228, -0.463, 0.765)]
    for i in range(17):
        a = math.pi - math.pi * i / 16
        arch_points.append((0.228 * math.cos(a), -0.463, 0.765 + 0.228 * math.sin(a)))
    arch_points.append((0.228, -0.463, 0.61))
    curve("Firebox raised arch bead", arch_points, 0.021, clay_light)
    fireback = arch_cutter("Soot-black arched fireback", 0.405, 0.615, 0.76, 0.075, 0.10)
    fireback.data.materials.append(soot)
    box("Firebox grate", (0, -0.08, 0.625), (0.43, 0.46, 0.035), bronze_dark, 0.008)
    for i in range(5):
        box("Grate slot", (-0.15 + i * 0.075, -0.10, 0.647), (0.025, 0.34, 0.015), soot, 0.004)
    beam("Charred firewood", (-0.19, -0.26, 0.68), (0.16, 0.02, 0.72), 0.065, 0.06, coal, 0.018)
    beam("Crossed charred firewood", (0.18, -0.25, 0.68), (-0.13, 0.03, 0.73), 0.06, 0.055, coal, 0.015)
    for x, height in [(-0.105, 0.77), (0.0, 0.86), (0.11, 0.79)]:
        lathe("Small stylized fire flame", [(0.008, 0.675), (0.042, 0.71), (0.034, height - 0.05), (0.003, height)], ember, 16, center=(x, -0.19, 0), closed=False, cap_ends=True)
    for i in range(9):
        sphere("Glowing coal", (random.uniform(-0.16, 0.16), random.uniform(-0.24, 0.015), random.uniform(0.69, 0.73)), (0.04, 0.032, 0.025), ember, 12, 8)
    # A restrained ash lip and side carrying handles.
    box("Ash lip", (0, -0.465, 0.593), (0.51, 0.10, 0.045), bronze_dark, 0.012)
    for side in (-1, 1):
        torus("Stove side carrying ring", (side * 0.47, 0, 0.82), 0.09, 0.016, bronze, (0, math.pi / 2, 0), 32, 8)

    # Spun bronze pot: outer wall, inner wall and bottom are a single closed section.
    lathe("Open hammered bronze hot pot", [
        (0.235, 1.055), (0.325, 1.09), (0.39, 1.20), (0.425, 1.40),
        (0.42, 1.46), (0.392, 1.46), (0.385, 1.39), (0.35, 1.22), (0.245, 1.12),
    ], bronze_dark, segments=64)
    torus("Pot polished rolled rim", (0, 0, 1.455), 0.408, 0.022, bronze, major_segments=56)
    torus("Pot lower chased band", (0, 0, 1.16), 0.367, 0.012, bronze, major_segments=48)
    for side in (-1, 1):
        sphere("Pot handle boss", (side * 0.402, 0, 1.345), (0.045, 0.075, 0.045), bronze, 20, 10)
        torus("Pot loop handle", (side * 0.475, 0, 1.33), 0.105, 0.019, bronze, (0, math.pi / 2, 0), 36, 8)
    cylinder("Visible hot broth", (0, 0, 1.413), 0.374, 0.012, broth, 56, 0)
    for i, (x, y, angle) in enumerate([(-0.16, -0.10, 0.3), (0.09, -0.16, -0.4), (0.18, 0.07, 0.7), (-0.05, 0.13, -0.2), (-0.22, 0.08, 0.5)]):
        box("Tofu in simmering pot", (x, y, 1.43 + (i % 2) * 0.006), (0.085, 0.06, 0.033), tofu, 0.008, (0, 0, angle))
    for x, y in [(-0.09, -0.19), (0.13, -0.04), (0.02, 0.21), (-0.20, -0.02), (0.23, 0.13)]:
        torus("Scallion ring", (x, y, 1.44), 0.027, 0.007, greens, major_segments=16, minor_segments=6)
    return [obj for obj in __import__("bpy").context.scene.objects if obj.type in {"MESH", "CURVE"}]
