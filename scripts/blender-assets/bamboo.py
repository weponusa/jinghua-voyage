"""A small bamboo grove with jointed culms, arched twigs and curved lanceolate leaves."""
import math
import random

import bpy
from mathutils import Vector

from botanical_common import LeafBatch, sample_path, smooth_path, tapered_tube
from common import lathe, material, torus


def build_bamboo():
    rng = random.Random(377)
    culm_mats = [
        material("Bamboo | deep jade culm", "3B684B", 0.82),
        material("Bamboo | fresh green culm", "567E50", 0.80),
        material("Bamboo | older olive culm", "77894F", 0.84),
    ]
    node_mat = material("Bamboo | pale raised nodes", "9CA369", 0.86)
    branch_mat = material("Bamboo | slender branches", "4C6B43", 0.89)
    leaf_mats = [
        material("Bamboo leaves | forest jade", "2C573E", 0.93),
        material("Bamboo leaves | bamboo green", "487443", 0.91),
        material("Bamboo leaves | soft sage", "6F8E53", 0.89),
        material("Bamboo leaves | pale new growth", "9BA765", 0.87),
    ]
    foliage = LeafBatch()

    for culm in range(9):
        base_angle = math.tau * culm / 9 + rng.uniform(-0.2, 0.2)
        base_radius = 0.16 if culm == 0 else rng.uniform(0.20, 0.43)
        base = Vector((math.cos(base_angle) * base_radius, math.sin(base_angle) * base_radius, 0))
        height = 4.45 if culm == 0 else rng.uniform(3.35, 4.45)
        lean_angle = base_angle + rng.uniform(-0.7, 0.7)
        lean = Vector((math.cos(lean_angle), math.sin(lean_angle), 0)) * rng.uniform(0.20, 0.58)
        radius = rng.uniform(0.043, 0.058)

        def at(z):
            return base + lean * (z / height) ** 1.35 + Vector((0.025 * math.sin(z * 1.7 + culm), 0.018 * math.sin(z * 2 + culm), z))

        controls = [at(height * i / 5) for i in range(6)]
        widths = [radius * (1 - 0.48 * (i / 5)) for i in range(6)]
        points, tube_widths = smooth_path(controls, widths, 3)
        tapered_tube("Tapered living bamboo culm", points, tube_widths, culm_mats[culm % 3], 10, irregularity=0.025)
        node_count = int(height / 0.38)
        node_levels = []
        for node in range(1, node_count + 1):
            z = height * node / (node_count + 1)
            center = at(z)
            node_levels.append(z)
            tangent = (at(min(height, z + 0.02)) - at(max(0, z - 0.02))).normalized()
            ring_radius = radius * (1 - 0.48 * z / height)
            torus("Raised bamboo node ring", center, ring_radius + 0.002, 0.0055, node_mat, tangent.to_track_quat("Z", "Y").to_euler(), 12, 4)

        branch_levels = [z for z in node_levels if z > height * 0.43][-4:]
        for level, z in enumerate(branch_levels):
            for side in range(2):
                angle = base_angle + level * 1.93 + side * math.pi + rng.uniform(-0.38, 0.38)
                direction = Vector((math.cos(angle), math.sin(angle), 0))
                sideways = Vector((-math.sin(angle), math.cos(angle), 0))
                start = at(z)
                length = rng.uniform(0.52, 0.88) * (0.90 + 0.10 * z / height)
                end = start + direction * length + sideways * rng.uniform(-0.10, 0.10) + Vector((0, 0, rng.uniform(0.02, 0.20)))
                middle = start.lerp(end, 0.52) + Vector((0, 0, rng.uniform(0.10, 0.17)))
                branch_points, branch_widths = smooth_path([start, middle, end], [0.012, 0.007, 0.0016], 3)
                tapered_tube("Arched bamboo leaf branch", branch_points, branch_widths, branch_mat, 5)
                for leaf_node in range(10):
                    t = 0.16 + 0.80 * leaf_node / 9 + rng.uniform(-0.018, 0.018)
                    origin = sample_path(branch_points, t)
                    for sign in (-1, 1):
                        leaf_direction = (sideways * sign * rng.uniform(0.60, 0.96) + direction * rng.uniform(0.25, 0.55) + Vector((0, 0, rng.uniform(-0.48, 0.14)))).normalized()
                        leaf_length = rng.uniform(0.23, 0.36)
                        leaf_end = origin + leaf_direction * leaf_length
                        normal = (direction * rng.uniform(-0.35, 0.35) + Vector((0, 0, 1))).normalized()
                        foliage.add(origin, leaf_end, rng.uniform(0.046, 0.072), normal, rng.choices(range(4), [2, 6, 5, 1])[0], detailed=True, curl=rng.uniform(-0.035, 0.045))
                # An uneven terminal fan softens the end of every woody twig.
                for fan in (-2, -1, 0, 1, 2):
                    leaf_direction = (direction + sideways * fan * 0.29 + Vector((0, 0, -0.20 - 0.035 * abs(fan)))).normalized()
                    foliage.add(end, end + leaf_direction * rng.uniform(0.24, 0.35), rng.uniform(0.047, 0.067), sideways * 0.25 + Vector((0, 0, 1)), rng.choices(range(4), [1, 5, 5, 2])[0], detailed=True, curl=rng.uniform(-0.025, 0.04))

    for i, (x, y, height) in enumerate([(-0.40, 0.20, 0.48), (0.36, 0.26, 0.38), (0.15, -0.40, 0.56)]):
        lathe("Young tapered bamboo shoot", [(0.065, 0), (0.075, 0.06), (0.052, height * 0.55), (0.025, height * 0.85), (0.004, height)], culm_mats[i], 12, center=(x, y, 0), closed=False, cap_ends=True)
        for z in (height * 0.28, height * 0.55, height * 0.78):
            torus("Shoot node band", (x, y, z), 0.055 * (1 - z / height) + 0.015, 0.005, node_mat, major_segments=12, minor_segments=4)
    foliage.finish("Curved layered bamboo leaf fans", leaf_mats)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
