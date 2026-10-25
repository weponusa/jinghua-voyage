"""Gnarled Chinese pine with open, many-lobed crowns and dense modeled needle tufts."""
import math
import random

import bpy
from mathutils import Vector

from botanical_common import LeafBatch, radial_roots, sample_path, smooth_path, tapered_tube
from common import lathe, material


def build_chinese_pine():
    rng = random.Random(191)
    bark = material("Pine | warm fissured bark", "574233", 0.94)
    bark_light = material("Pine | worn bark ridges", "826247", 0.91)
    bark_dark = material("Pine | deep bark fissures", "312C25", 0.96)
    needles = [
        material("Pine needles | deep jade", "233F32", 0.94),
        material("Pine needles | pine green", "365D42", 0.92),
        material("Pine needles | sage lights", "5C7B50", 0.90),
        material("Pine needles | golden tips", "81915F", 0.88),
    ]
    cone_mat = material("Pine | small umber cones", "73513A", 0.94)

    trunk_controls = [(0, 0, 0), (0.07, 0.015, 0.55), (-0.10, 0.04, 1.25), (0.02, 0, 2.05), (0.20, 0.035, 2.85), (0.08, 0.08, 3.65), (0.30, 0.10, 4.42), (0.24, 0.12, 5.16)]
    trunk_radii = [0.28, 0.235, 0.205, 0.17, 0.135, 0.095, 0.055, 0.018]
    trunk_points, trunk_widths = smooth_path(trunk_controls, trunk_radii, 4)
    tapered_tube("Gnarled continuous pine trunk", trunk_points, trunk_widths, bark, 12, irregularity=0.10)
    radial_roots(bark, 0.72, 8, 12)
    for i in range(9):
        angle = math.tau * i / 9
        ridge_points = [p + Vector((math.cos(angle + 0.04 * math.sin(p.z * 4)) * r * 0.88, math.sin(angle + 0.04 * math.sin(p.z * 4)) * r * 0.88, 0)) for p, r in zip(trunk_points[:-3], trunk_widths[:-3])]
        tapered_tube("Long sculpted pine bark ridge", ridge_points, [0.009 + 0.003 * math.sin(i * 2.1) for _ in ridge_points], bark_light if i % 3 else bark_dark, 5, irregularity=0.08)

    foliage = LeafBatch()
    specs = [
        (2.08, -2.70, 1.55, 0.30), (2.46, 0.42, 1.67, 0.37),
        (2.82, 2.00, 1.50, 0.30), (3.13, -0.66, 1.69, 0.38),
        (3.52, 2.82, 1.43, 0.34), (3.79, 0.96, 1.39, 0.36),
        (4.09, -1.75, 1.20, 0.34), (4.38, 0.16, 1.12, 0.38),
        (4.66, 2.24, 0.88, 0.32), (4.91, -0.76, 0.74, 0.31),
    ]
    crown_centers = []
    for index, (z, angle, length, rise) in enumerate(specs):
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        tangent = Vector((-math.sin(angle), math.cos(angle), 0))
        start = min(trunk_points, key=lambda point: abs(point.z - z)).copy()
        end = start + radial * length + Vector((0, 0, rise))
        controls = [start, start + radial * length * 0.32 + Vector((0, 0, -0.02)), start + radial * length * 0.72 + tangent * (0.09 if index % 2 else -0.07) + Vector((0, 0, rise * 0.40)), end]
        base_radius = max(0.052, 0.123 - z * 0.014)
        points, widths = smooth_path(controls, [base_radius, base_radius * 0.72, 0.034, 0.010], 4)
        tapered_tube("Sweeping pine bough", points, widths, bark, 8, irregularity=0.08)
        crown_centers.append((end, length, angle, index))

        # Unequal forks disappear into the needle masses instead of ending in flat disks.
        for fork in (-1, 0, 1):
            fork_end = end + tangent * fork * rng.uniform(0.27, 0.43) + radial * rng.uniform(-0.08, 0.20) + Vector((0, 0, rng.uniform(0.09, 0.22)))
            fork_start = sample_path(points, 0.64 + 0.08 * (fork + 1))
            fork_points, fork_widths = smooth_path([fork_start, fork_start.lerp(fork_end, 0.55) + Vector((0, 0, 0.06)), fork_end], [0.030, 0.018, 0.004], 3)
            tapered_tube("Unequal pine crown fork", fork_points, fork_widths, bark, 6, irregularity=0.06)
        if index % 2 == 0:
            lathe("Small ridged pine cone", [(0.018, 0), (0.052, 0.025), (0.066, 0.07), (0.055, 0.12), (0.025, 0.17), (0.006, 0.19)], cone_mat, 12, center=(end.x, end.y, end.z - 0.24), closed=False, cap_ends=True)

    crown_centers.append((Vector((0.25, 0.10, 5.22)), 0.82, 0.3, 10))
    for center, length, angle, index in crown_centers:
        rx = 0.64 + min(length, 1.5) * 0.18
        ry = 0.49 + min(length, 1.5) * 0.11
        rz = 0.25 if index < 8 else 0.29
        cosine, sine = math.cos(angle), math.sin(angle)
        for tuft in range(54):
            theta = rng.uniform(0, math.tau)
            radius = math.sqrt(rng.random())
            lx, ly = rx * radius * math.cos(theta), ry * radius * math.sin(theta)
            underside = tuft % 5 == 0
            height = (-0.38 if underside else 1.0) * rz * math.sqrt(max(0.0, 1 - radius * radius))
            local = Vector((lx, ly, height + rng.uniform(-0.055, 0.055)))
            base = center + Vector((lx * cosine - ly * sine, lx * sine + ly * cosine, local.z))
            surface = Vector((lx / rx, ly / ry, (-0.45 if underside else 0.65) * (1 - radius * 0.55)))
            axis = (surface + Vector((0, 0, 0.32 if index == 10 else 0.18))).normalized()
            reference = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((0, 1, 0))
            u = axis.cross(reference).normalized()
            v = axis.cross(u).normalized()
            tuft_length = rng.uniform(0.20, 0.29) * (1.10 if index == 10 else 1.0)
            for needle in range(15):
                phi = math.tau * needle / 15 + rng.uniform(-0.16, 0.16)
                spread = rng.uniform(0.48, 1.02) if needle < 11 else rng.uniform(0.90, 1.28)
                fan = u * math.cos(phi) + v * math.sin(phi)
                direction = (axis * math.cos(spread) + fan * math.sin(spread)).normalized()
                needle_length = tuft_length * rng.uniform(0.82, 1.25)
                start = base + axis * rng.uniform(-0.025, 0.025) + fan * 0.008
                if radius > 0.78:
                    palette = [1, 1, 2, 2, 3]
                elif underside:
                    palette = [0, 0, 1, 1]
                else:
                    palette = [0, 0, 1, 1, 2]
                foliage.add(start, start + direction * needle_length, rng.uniform(0.016, 0.024), fan, rng.choice(palette))
    foliage.finish("Dense layered pine needle rosettes", needles)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
