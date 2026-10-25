"""Liangmian two-faced spirit wall with a kind front and wrathful reverse relief."""
import math

import bpy

from common import box, curve, cylinder, extrude_xz, material, mesh, sphere, torus
from landmarks_common import hip_roof


def relief_face(side, face_mat, feature_mat, eye_mat, accent):
    """side=-1 is the gentle front; side=1 is the severe reverse."""
    y = side * 0.36
    kind = side < 0
    sphere("Kind face | warm rounded relief" if kind else "Wrathful face | long dark relief", (0, y, 2.03), (0.86 if kind else 0.79, 0.17, 1.00 if kind else 1.09), face_mat, 40, 24)
    for sx in (-1, 1):
        sphere("Relief | ear", (sx * 0.86, y, 2.04), (0.15, 0.11, 0.25), face_mat, 20, 12)
        # Large, sculpted eyebrows and eyelids remain readable from ten metres.
        if kind:
            brow = [(sx * 0.18, side * 0.535, 2.43), (sx * 0.39, side * 0.55, 2.51), (sx * 0.64, side * 0.515, 2.45)]
            eye_z = 2.29
        else:
            brow = [(sx * 0.16, side * 0.535, 2.35), (sx * 0.40, side * 0.55, 2.48), (sx * 0.66, side * 0.515, 2.57)]
            eye_z = 2.27
        curve("Relief | expressive eyebrow", brow, 0.060 if kind else 0.072, feature_mat, smooth=True)
        sphere("Relief | inlaid eye", (sx * 0.38, side * 0.545, eye_z), (0.16, 0.055, 0.075 if kind else 0.060), eye_mat, 24, 12)
        sphere("Relief | small eye glint", (sx * 0.38 - 0.025, side * 0.593, eye_z + 0.018), (0.026, 0.016, 0.026), accent, 12, 8)
        lid = [(sx * 0.19, side * 0.555, eye_z), (sx * 0.38, side * 0.572, eye_z + 0.095), (sx * 0.58, side * 0.535, eye_z)]
        curve("Relief | upper eyelid", lid, 0.026, feature_mat, smooth=True)
    sphere("Relief | sculpted nose", (0, side * 0.565, 2.03), (0.12, 0.16, 0.25), face_mat, 24, 16)
    for sx in (-1, 1):
        sphere("Relief | nostril", (sx * 0.07, side * 0.70, 1.95), (0.035, 0.025, 0.025), feature_mat, 16, 8)
    if kind:
        mouth = [(-0.34, side * 0.54, 1.69), (-0.17, side * 0.58, 1.60), (0, side * 0.59, 1.57), (0.17, side * 0.58, 1.60), (0.34, side * 0.54, 1.69)]
        curve("Kind face | smiling mouth", mouth, 0.047, feature_mat, smooth=True)
        sphere("Kind face | forehead pearl", (0, side * 0.53, 2.72), (0.095, 0.045, 0.095), accent, 20, 10)
    else:
        mouth = [(-0.36, side * 0.54, 1.58), (-0.17, side * 0.58, 1.69), (0, side * 0.59, 1.73), (0.17, side * 0.58, 1.69), (0.36, side * 0.54, 1.58)]
        curve("Wrathful face | deep frown", mouth, 0.055, feature_mat, smooth=True)
        for sx in (-1, 1):
            extrude_xz("Wrathful face | geometric fang", [(sx * 0.25 - 0.055, 1.65), (sx * 0.25 + 0.055, 1.65), (sx * 0.25, 1.49)], side * 0.585, 0.055, accent, 0.008)
        for z in (2.67, 2.81):
            curve("Wrathful face | forehead furrow", [(-0.25, side * 0.52, z), (0, side * 0.56, z - 0.055), (0.25, side * 0.52, z)], 0.026, feature_mat, smooth=True)


def build_twin_screen():
    warm_stone = material("Twin Screen | front warm limestone", "C8B998", 0.82)
    pale_wood = material("Twin Screen | front pale cedar", "B59165", 0.64)
    front_face = material("Twin Screen | kind ivory relief", "E2CFA7", 0.60)
    red = material("Twin Screen | reverse oxblood lacquer", "652D2B", 0.48)
    dark_red = material("Twin Screen | reverse recessed cinnabar", "361D21", 0.70)
    wrath = material("Twin Screen | dark bronze relief", "765046", 0.52, 0.20)
    feature = material("Twin Screen | carved dark features", "342C29", 0.70)
    eye = material("Twin Screen | obsidian eye inlay", "171D1B", 0.26)
    gold = material("Twin Screen | aged brass details", "B59555", 0.43, 0.48)
    tile = material("Twin Screen | charcoal ceramic tile", "424D4B", 0.68)
    tile_edge = material("Twin Screen | weathered tile edges", "68736B", 0.72)

    box("Screen | continuous stone footing", (0, 0, 0.13), (6.50, 0.92, 0.26), warm_stone, 0.045)
    box("Screen | recessed base course", (0, 0, 0.34), (6.12, 0.66, 0.16), feature, 0.025)
    box("Screen | full thickness wall", (0, 0, 1.96), (5.65, 0.48, 3.10), warm_stone, 0.035)
    box("Screen | reverse red plaster field", (0, 0.255, 1.98), (5.35, 0.09, 2.85), red, 0.018)
    box("Screen | front pale timber field", (0, -0.27, 1.98), (5.35, 0.09, 2.85), pale_wood, 0.018)
    # Framing is complete on both elevations.
    for side in (-1, 1):
        mat = warm_stone if side < 0 else dark_red
        yy = side * 0.335
        for x in (-2.60, 2.60):
            box("Screen | vertical panel frame", (x, yy, 1.99), (0.16, 0.12, 2.98), mat, 0.022)
        for z in (0.55, 3.43):
            box("Screen | horizontal panel frame", (0, yy, z), (5.36, 0.12, 0.16), mat, 0.022)
        torus("Screen | circular relief surround", (0, side * 0.35, 2.03), 1.25, 0.075, gold if side < 0 else dark_red, (math.pi / 2, 0, 0), 64, 10)
        for sx in (-1, 1):
            for z in (0.92, 3.05):
                x = sx * 1.90
                curve("Screen | corner ruyi carving", [(x - sx * 0.28, yy + side * 0.07, z), (x, yy + side * 0.08, z + 0.15), (x + sx * 0.28, yy + side * 0.07, z), (x, yy + side * 0.08, z - 0.15)], 0.035, gold, cyclic=True, smooth=True)
    relief_face(-1, front_face, feature, eye, gold)
    relief_face(1, wrath, dark_red, eye, gold)

    for sx in (-1, 1):
        x = sx * 3.00
        box("Screen | side pillar stone shoe", (x, 0, 0.29), (0.64, 0.80, 0.58), warm_stone, 0.035)
        box("Screen | side pillar", (x, 0, 1.99), (0.38, 0.58, 3.12), pale_wood, 0.025)
        for yy in (-0.31, 0.31):
            box("Screen | pillar raised bead", (x, yy, 2.0), (0.10, 0.035, 2.85), gold, 0.009)
        for z in (0.63, 3.38, 3.57):
            box("Screen | pillar collar", (x, 0, z), (0.56, 0.72, 0.12), feature if z < 1 else warm_stone, 0.024)
    hip_roof("Screen tiled crown", 7.0, 1.55, 3.72, 0.57, tile, tile_edge, feature, ridge=2.55, spacing=0.23)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
