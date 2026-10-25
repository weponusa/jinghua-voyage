"""Graceful garden willow with attached, leaf-covered arches and layered hanging curtains."""
import math
import random

import bpy
from mathutils import Vector

from botanical_common import LeafBatch, radial_roots, sample_path, smooth_path, tapered_tube
from common import material


def build_willow():
    rng = random.Random(283)
    bark = material("Willow | silver-brown bark", "625844", 0.94)
    ridge = material("Willow | pale bark ridges", "8C7C61", 0.91)
    dark = material("Willow | bark fissures", "393D30", 0.96)
    twig_mat = material("Willow | flexible olive twigs", "596743", 0.92)
    leaf_mats = [
        material("Willow leaves | deep olive", "3E6041", 0.93),
        material("Willow leaves | willow green", "64834E", 0.91),
        material("Willow leaves | pale sage", "8DA164", 0.89),
        material("Willow leaves | sunlit tips", "AAB574", 0.87),
    ]

    trunk_controls = [(0, 0, 0), (-0.06, 0.03, 0.55), (0.08, 0.02, 1.25), (0.02, -0.05, 2.05), (-0.13, -0.02, 2.85), (0.02, 0.06, 3.55), (0.12, 0.08, 4.15)]
    radii = [0.30, 0.26, 0.22, 0.18, 0.14, 0.095, 0.035]
    points, widths = smooth_path(trunk_controls, radii, 4)
    tapered_tube("Curving willow trunk", points, widths, bark, 12, irregularity=0.09)
    radial_roots(bark, 0.70, 7, 82)
    for i in range(7):
        angle = math.tau * i / 7
        ridge_points = [p + Vector((math.cos(angle + 0.035 * math.sin(p.z * 5)) * r * 0.88, math.sin(angle + 0.035 * math.sin(p.z * 5)) * r * 0.88, 0)) for p, r in zip(points[:-2], widths[:-2])]
        tapered_tube("Willow flowing bark ridge", ridge_points, [0.010] * len(ridge_points), ridge if i % 2 else dark, 5, irregularity=0.08)

    foliage = LeafBatch()
    branch_count = 16
    for index in range(branch_count):
        angle = math.tau * index / branch_count + rng.uniform(-0.17, 0.17)
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        tangent = Vector((-math.sin(angle), math.cos(angle), 0))
        base_z = 2.12 + (index % 5) * 0.20
        length = rng.uniform(1.38, 1.98)
        end_z = rng.uniform(4.0, 4.65)
        start = min(points, key=lambda point: abs(point.z - base_z)).copy()
        end = start + radial * length + Vector((0, 0, end_z - start.z))
        controls = [start, start + radial * length * 0.30 + Vector((0, 0, 0.70)), start + radial * length * 0.72 + tangent * rng.uniform(-0.10, 0.10) + Vector((0, 0, end_z - start.z + 0.26)), end]
        branch_points, branch_widths = smooth_path(controls, [0.088, 0.058, 0.025, 0.007], 4)
        tapered_tube("Rising willow umbrella bough", branch_points, branch_widths, bark, 8, irregularity=0.07)

        # Short leafy growth clothes the arch itself, including its formerly bare tip.
        for leaf_index in range(26):
            t = 0.28 + 0.71 * leaf_index / 25
            sample = sample_path(branch_points, t)
            side_sign = 1 if leaf_index % 2 else -1
            leaf_start = sample + tangent * side_sign * 0.012
            direction = (tangent * side_sign * rng.uniform(0.45, 0.85) + radial * rng.uniform(0.20, 0.55) + Vector((0, 0, rng.uniform(-0.60, 0.10)))).normalized()
            leaf_end = leaf_start + direction * rng.uniform(0.20, 0.30)
            foliage.add(leaf_start, leaf_end, rng.uniform(0.046, 0.066), radial + Vector((0, 0, 0.45)), rng.choices(range(4), [2, 5, 4, 1])[0], detailed=True, curl=rng.uniform(-0.025, 0.035))

        # Side sprays break the umbrella ribs into softer, irregular layers.
        for spray, t in enumerate((0.48, 0.68, 0.86)):
            origin = sample_path(branch_points, t)
            side_sign = 1 if (index + spray) % 2 else -1
            spray_end = origin + tangent * side_sign * rng.uniform(0.30, 0.52) + radial * rng.uniform(0.15, 0.32) + Vector((0, 0, rng.uniform(-0.14, 0.12)))
            spray_points, spray_widths = smooth_path([origin, origin.lerp(spray_end, 0.55) + Vector((0, 0, 0.09)), spray_end], [0.014, 0.008, 0.0018], 3)
            tapered_tube("Leafy willow side spray", spray_points, spray_widths, twig_mat, 5)
            for node in range(6):
                sample = sample_path(spray_points, 0.18 + node * 0.15)
                for sign in (-1, 1):
                    direction = (radial * sign * 0.65 + tangent * side_sign * 0.35 + Vector((0, 0, -0.50))).normalized()
                    leaf_end = sample + direction * rng.uniform(0.20, 0.29)
                    foliage.add(sample, leaf_end, rng.uniform(0.045, 0.064), tangent + Vector((0, 0, 0.4)), rng.choices(range(4), [2, 5, 4, 1])[0], detailed=True, curl=rng.uniform(-0.02, 0.03))

        for hanging in range(7):
            fraction = 0.36 + hanging * 0.098
            origin = sample_path(branch_points, fraction)
            drop = rng.uniform(1.35, 2.40) * (0.90 + fraction * 0.14)
            tip = origin + radial * rng.uniform(0.10, 0.34) + tangent * rng.uniform(-0.18, 0.18) + Vector((0, 0, -drop))
            tip.z = max(1.05 + rng.uniform(0, 0.16), tip.z)
            actual_drop = origin.z - tip.z
            twig_controls = [origin, origin + radial * 0.09 + Vector((0, 0, -actual_drop * 0.26)), tip - radial * 0.04 + Vector((0, 0, actual_drop * 0.27)), tip]
            twig_points, twig_widths = smooth_path(twig_controls, [0.008, 0.006, 0.0038, 0.0014], 3)
            tapered_tube("Drooping willow switch", twig_points, twig_widths, twig_mat, 4)
            for node in range(15):
                t = 0.06 + 0.90 * node / 14
                sample = sample_path(twig_points, t)
                for side_sign in (-1, 1):
                    leaf_start = sample + tangent * side_sign * 0.007
                    direction = tangent * side_sign * rng.uniform(0.28, 0.62) + radial * rng.uniform(0.10, 0.38) + Vector((0, 0, -1))
                    direction.normalize()
                    leaf_end = leaf_start + direction * rng.uniform(0.20, 0.31)
                    foliage.add(leaf_start, leaf_end, rng.uniform(0.042, 0.064), radial + Vector((0, 0, 0.40)), rng.choices(range(4), [2, 5, 4, 1])[0], detailed=True, curl=rng.uniform(-0.025, 0.035))

    # Fine new growth rounds the leader without a rigid candelabra silhouette.
    for i in range(9):
        angle = math.tau * i / 9 + rng.uniform(-0.16, 0.16)
        start = min(points, key=lambda point: abs(point.z - 3.95)).copy()
        end = Vector((0.68 * math.cos(angle), 0.68 * math.sin(angle), 4.62 + rng.uniform(-0.08, 0.22)))
        shoot_points, shoot_widths = smooth_path([start, start.lerp(end, 0.55) + Vector((0, 0, 0.20)), end], [0.027, 0.013, 0.002], 3)
        tapered_tube("Willow leader shoot", shoot_points, shoot_widths, twig_mat, 5)
        for j in range(12):
            sample = sample_path(shoot_points, 0.18 + j * 0.068)
            leaf_angle = angle + (0.65 if j % 2 else -0.65)
            leaf_end = sample + Vector((math.cos(leaf_angle) * 0.27, math.sin(leaf_angle) * 0.27, -0.08))
            foliage.add(sample, leaf_end, 0.056, (0, 0, 1), rng.randrange(1, 4), detailed=True, curl=0.025)
    foliage.finish("Layered willow leaves and attached hanging curtains", leaf_mats)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
