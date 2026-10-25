"""Organic low-poly building blocks: tapered branches and folded lanceolate leaves."""
from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector

from common import mesh, sphere


def smooth_path(points, radii, steps=4):
    points = [Vector(p) for p in points]
    sampled, widths = [], []
    for i in range(len(points) - 1):
        p0 = points[max(0, i - 1)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(len(points) - 1, i + 2)]
        for j in range(steps):
            t = j / steps
            point = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
            sampled.append(point)
            widths.append(radii[i] * (1 - t) + radii[i + 1] * t)
    sampled.append(points[-1])
    widths.append(radii[-1])
    return sampled, widths


def sample_path(points, t):
    """Sample a modeled branch so attached growth never floats off its support."""
    points = [Vector(p) for p in points]
    position = max(0.0, min(1.0, t)) * (len(points) - 1)
    index = min(len(points) - 2, int(position))
    return points[index].lerp(points[index + 1], position - index)


def tapered_tube(name, points, radii, mat, sides=8, smooth=True, irregularity=0.0):
    points = [Vector(p) for p in points]
    vertices = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        reference = Vector((0, 0, 1)) if abs(tangent.z) < 0.92 else Vector((0, 1, 0))
        u = tangent.cross(reference).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            angle = math.tau * j / sides
            flute = 1 + irregularity * (0.65 * math.sin(angle * 3 + i * 0.31) + 0.35 * math.sin(angle * 5 - i * 0.47))
            vertices.append(point + radius * flute * (math.cos(angle) * u + math.sin(angle) * v))
    faces = []
    for i in range(len(points) - 1):
        for j in range(sides):
            nj = (j + 1) % sides
            faces.append((i * sides + j, i * sides + nj, (i + 1) * sides + nj, (i + 1) * sides + j))
    faces += [tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + j for j in range(sides))]
    return mesh(name, vertices, faces, mat, smooth=smooth)


class LeafBatch:
    """Batches folded leaves into one mesh while retaining a hand-painted palette."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.material_indices = []

    def add(self, start, end, width, normal=(0, 0, 1), material_index=0, detailed=False, curl=0.0):
        start, end = Vector(start), Vector(end)
        direction = (end - start).normalized()
        normal = Vector(normal).normalized()
        side = direction.cross(normal)
        if side.length < 0.01:
            side = direction.cross(Vector((0, 1, 0)))
        side.normalize()
        normal = side.cross(direction).normalized()
        offset = len(self.vertices)
        if detailed:
            # A shouldered lanceolate outline reads as a leaf, not a diamond spike.
            def at(t):
                return start.lerp(end, t) + normal * (math.sin(t * math.pi) * curl)

            self.vertices += [
                start,
                at(0.34) + side * width * 0.43,
                at(0.70) + side * width * 0.36,
                end,
                at(0.70) - side * width * 0.36,
                at(0.34) - side * width * 0.43,
                at(0.49) + normal * width * 0.17,
            ]
            self.faces += [(offset + i, offset + (i + 1) % 6, offset + 6) for i in range(6)]
            self.material_indices += [material_index] * 6
        else:
            middle = start.lerp(end, 0.44)
            ridge = start.lerp(end, 0.48) + normal * width * 0.18
            self.vertices += [start, middle + side * width * 0.5, end, middle - side * width * 0.5, ridge]
            self.faces += [(offset, offset + 1, offset + 4), (offset + 1, offset + 2, offset + 4), (offset + 2, offset + 3, offset + 4), (offset + 3, offset, offset + 4)]
            self.material_indices += [material_index] * 4

    def finish(self, name, materials):
        obj = mesh(name, self.vertices, self.faces)
        for mat in materials:
            obj.data.materials.append(mat)
        for polygon, index in zip(obj.data.polygons, self.material_indices):
            polygon.material_index = index
        return obj


def organic_crown_core(name, center, scale, mat, seed, rotation=0):
    rng = random.Random(seed)
    obj = sphere(name, center, scale, mat, 20, 10)
    for vertex in obj.data.vertices:
        vertex.co *= rng.uniform(0.91, 1.08)
    obj.rotation_euler[2] = rotation
    obj.data.update()
    return obj


def radial_roots(trunk_mat, radius=0.65, count=7, seed=4):
    rng = random.Random(seed)
    for i in range(count):
        angle = math.tau * i / count + rng.uniform(-0.16, 0.16)
        end = (math.cos(angle) * radius, math.sin(angle) * radius, 0.025)
        points, widths = smooth_path([(0, 0, 0.19), (end[0] * 0.45, end[1] * 0.45, 0.07), end], [0.13, 0.09, 0.015], 3)
        tapered_tube("Spreading exposed root", points, widths, trunk_mat, 8)


def bark_ribbon(name, points, offset, mat, radius=0.012):
    shifted = [(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]) for p in points]
    return tapered_tube(name, shifted, [radius] * len(shifted), mat, 5)
