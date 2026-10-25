"""Local modeling helpers for the four adult chapter-one characters."""
from __future__ import annotations

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

from common import curve, material, mesh, sphere


def cloth(name: str, color: str, roughness: float = 0.76):
    mat = material(name, color, roughness)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.16
    return mat


def elliptical_rings(name, profile, mat, segments=48, folds=0.0, cap_start=True, cap_end=True, cyclic=False):
    """Profile entries are (z, x_radius, y_radius[, y_center])."""
    vertices = []
    for ring_index, entry in enumerate(profile):
        z, rx, ry = entry[:3]
        cy = entry[3] if len(entry) > 3 else 0.0
        for i in range(segments):
            angle = math.tau * i / segments
            fold = 1.0 + folds * math.cos(angle * 12) * (1.0 - ring_index / max(1, len(profile) - 1) * 0.55)
            vertices.append((rx * math.sin(angle) * fold, cy - ry * math.cos(angle) * fold, z))
    faces = []
    links = len(profile) if cyclic else len(profile) - 1
    for j in range(links):
        nj = (j + 1) % len(profile)
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((j * segments + i, j * segments + ni, nj * segments + ni, nj * segments + i))
    if not cyclic:
        if cap_start:
            faces.append(tuple(reversed(range(segments))))
        if cap_end:
            faces.append(tuple((len(profile) - 1) * segments + i for i in range(segments)))
    return mesh(name, vertices, faces, mat, smooth=True)


def band(name, z, rx, ry, height, mat, cy=0.0, segments=48):
    return elliptical_rings(name, [
        (z - height / 2, rx, ry, cy),
        (z + height / 2, rx, ry, cy),
        (z + height / 2, rx - 0.008, ry - 0.008, cy),
        (z - height / 2, rx - 0.008, ry - 0.008, cy),
    ], mat, segments, cyclic=True)


def tube_path(name, rings, mat, segments=24, cap_start=True, cap_end=True):
    """Rings are (center, in_plane_radius, depth_radius), with depth along world Y."""
    centers = [Vector(ring[0]) for ring in rings]
    vertices = []
    for index, (center, radius, depth) in enumerate(rings):
        if index == 0:
            tangent = centers[1] - centers[0]
        elif index == len(rings) - 1:
            tangent = centers[-1] - centers[-2]
        else:
            tangent = centers[index + 1] - centers[index - 1]
        tangent.normalize()
        depth_axis = Vector((0, 1, 0))
        side_axis = depth_axis.cross(tangent).normalized()
        depth_axis = tangent.cross(side_axis).normalized()
        center = Vector(center)
        for i in range(segments):
            angle = math.tau * i / segments
            point = center + side_axis * (math.cos(angle) * radius) + depth_axis * (math.sin(angle) * depth)
            vertices.append(tuple(point))
    faces = []
    for j in range(len(rings) - 1):
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((j * segments + i, j * segments + ni, (j + 1) * segments + ni, (j + 1) * segments + i))
    if cap_start:
        faces.append(tuple(reversed(range(segments))))
    if cap_end:
        faces.append(tuple((len(rings) - 1) * segments + i for i in range(segments)))
    return mesh(name, vertices, faces, mat, smooth=True)


def frustum(name, start, end, start_radius, end_radius, mat, depth_ratio=1.0, segments=24):
    return tube_path(name, [(start, start_radius, start_radius * depth_ratio), (end, end_radius, end_radius * depth_ratio)], mat, segments)


def ribbon(name, start, end, width, mat, thickness=0.009):
    a, b = Vector(start), Vector(end)
    direction = (b - a).normalized()
    side = direction.cross(Vector((0, 1, 0))).normalized() * width / 2
    obj = mesh(name, [tuple(a - side), tuple(a + side), tuple(b + side), tuple(b - side)], [(0, 1, 2, 3)], mat)
    solid = obj.modifiers.new("Woven collar thickness", "SOLIDIFY")
    solid.thickness = thickness
    bevel = obj.modifiers.new("Soft cloth edges", "BEVEL")
    bevel.width = 0.004
    bevel.segments = 2
    return obj


def add_shoes(x_positions, mat, sole_mat, y=0.0, size=1.0):
    for x in x_positions:
        sphere("Cloth shoe upper", (x, y - 0.045 * size, 0.068 * size), (0.072 * size, 0.135 * size, 0.061 * size), mat, 24, 12)
        sphere("Upturned cloth shoe toe", (x, y - 0.151 * size, 0.073 * size), (0.071 * size, 0.055 * size, 0.048 * size), mat, 20, 10)
        sphere("Low stitched shoe sole", (x, y - 0.047 * size, 0.024 * size), (0.075 * size, 0.139 * size, 0.023 * size), sole_mat, 24, 8)


def add_hand(name, wrist, skin, scale=1.0, direction=(0, 0, -1), spread=1.0):
    wrist = Vector(wrist)
    direction = Vector(direction).normalized()
    palm = wrist + direction * (0.048 * scale)
    hand = sphere(f"{name} palm", palm, (0.043 * scale * spread, 0.027 * scale, 0.061 * scale), skin, 20, 12)
    if abs(direction.z) > 0.85:
        for index, xoff in enumerate((-0.026, -0.009, 0.009, 0.026)):
            length = (0.048, 0.060, 0.056, 0.043)[index] * scale
            center = palm + Vector((xoff * scale * spread, -0.003 * scale, -0.043 * scale - length * 0.30))
            sphere(f"{name} finger {index + 1}", center, (0.010 * scale, 0.012 * scale, length * 0.62), skin, 12, 8)
        sphere(f"{name} thumb", palm + Vector((0.043 * scale, -0.008 * scale, 0.003 * scale)), (0.017 * scale, 0.018 * scale, 0.036 * scale), skin, 16, 8).rotation_euler[1] = -0.45
    return hand


def import_textured_head(source: Path, base_z: float, scale_xy=1.0, scale_z=1.0):
    """Reuse only the local official source head; no network or generation service."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]
    if len(imported) != 1:
        raise RuntimeError("Expected one local source head mesh")
    obj = imported[0]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = []
    for vert in bm.verts:
        x, y, z = vert.co
        if z < 0.92 or z > 1.055:
            doomed.append(vert)
        elif abs(x) > 0.074 and z > 1.025:  # Remove the official hat and upper wing roots.
            doomed.append(vert)
        elif abs(x) > 0.100 and z > 0.960:  # Remove every long official hat-wing fragment.
            doomed.append(vert)
        elif z < 0.978 and y > 0.012:  # Remove the source's red back collar, keep the rear skull intact.
            doomed.append(vert)
        elif z < 0.946 and abs(x) > 0.066:  # Remove the red shoulder remnants.
            doomed.append(vert)
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    factor = 1.48
    for vert in obj.data.vertices:
        vert.co.x *= factor * scale_xy
        vert.co.y *= factor * scale_xy
        vert.co.z = (vert.co.z - 0.92) * factor * scale_z + base_z
    obj.data.update()
    obj.name = "Reused local sculpted head with PBR UVs"
    for image in bpy.data.images:
        if image.source == "FILE" and image.size[0] > 1024:
            image.scale(1024, 1024)
            image.pack()
    return obj


def add_moustache(base_z, mat, curled=False):
    y = -0.127
    for side in (-1, 1):
        points = [
            (side * 0.004, y, base_z + 0.091),
            (side * 0.025, y - 0.002, base_z + 0.088),
            (side * 0.047, y + 0.005, base_z + 0.080),
        ]
        if curled:
            points += [(side * 0.063, y + 0.012, base_z + 0.089), (side * 0.055, y + 0.012, base_z + 0.099)]
        curve("Modeled moustache", points, 0.0055, mat, smooth=True)


def add_goatee(base_z, mat, long=False):
    length = 0.115 if long else 0.070
    sphere("Goatee root", (0, -0.105, base_z + 0.034), (0.034, 0.018, 0.027), mat, 20, 10)
    for x in (-0.018, 0.0, 0.018):
        curve("Goatee strand", [(x, -0.11, base_z + 0.035), (x * 0.55, -0.113, base_z + 0.035 - length)], 0.007, mat, smooth=True)


def partial_headcloth(name, base_z, rx, ry, low, high, mat, gap=0.70, segments=40):
    """Open at the rear center (+Y); front is -Y."""
    vertices = []
    angles = [-math.pi + gap / 2 + (math.tau - gap) * i / segments for i in range(segments + 1)]
    rows = [(low, 1.0), (high, 0.97), (high + 0.012, 0.91)]
    for z, scale in rows:
        for angle in angles:
            vertices.append((rx * scale * math.sin(angle), -ry * scale * math.cos(angle), base_z + z))
    faces = []
    stride = len(angles)
    for row in range(len(rows) - 1):
        for i in range(segments):
            faces.append((row * stride + i, row * stride + i + 1, (row + 1) * stride + i + 1, (row + 1) * stride + i))
    obj = mesh(name, vertices, faces, mat, smooth=True)
    solid = obj.modifiers.new("Headcloth fabric thickness", "SOLIDIFY")
    solid.thickness = 0.007
    return obj
