"""Shared geometry, materials, export and preview helpers for hand-built props."""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


def rgb(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def material(name: str, color: str, roughness=0.55, metallic=0.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgb(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgb(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = rgb(color)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def assign(obj, mat):
    if mat:
        obj.data.materials.append(mat)
    return obj


def bevel(obj, width=0.02, segments=2):
    if width <= 0:
        return obj
    mod = obj.modifiers.new("Hand-softened edges", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.harden_normals = True
    normal = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    normal.weight = 40
    return obj


def mesh(name, vertices, faces, mat=None, bevel_width=0.0, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    if smooth:
        for polygon in data.polygons:
            polygon.use_smooth = True
    if bevel_width:
        bevel(obj, bevel_width)
    return obj


def box(name, location, dimensions, mat, bevel_width=0.015, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_euler = rotation
    assign(obj, mat)
    bevel(obj, bevel_width)
    return obj


def cylinder(name, location, radius, depth, mat, vertices=32, bevel_width=0.008, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    assign(obj, mat)
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    bevel(obj, bevel_width)
    return obj


def sphere(name, location, scale, mat, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def torus(name, location, major_radius, minor_radius, mat, rotation=None, major_segments=40, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    assign(obj, mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def curve(name, points, radius, mat, cyclic=False, smooth=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 4
    data.bevel_depth = radius
    data.bevel_resolution = 1
    data.use_fill_caps = True
    if smooth:
        spline = data.splines.new("BEZIER")
        spline.bezier_points.add(len(points) - 1)
        for point, co in zip(spline.bezier_points, points):
            point.co = co
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"
    else:
        spline = data.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for point, co in zip(spline.points, points):
            point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    return obj


def beam(name, start, end, width, depth, mat, bevel_width=0.008):
    a, b = Vector(start), Vector(end)
    obj = box(name, (a + b) * 0.5, (width, depth, (b - a).length), mat, bevel_width)
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def lathe(name, profile, mat, segments=48, center=(0, 0, 0), closed=True, cap_ends=False):
    cx, cy, cz = center
    vertices = []
    for radius, z in profile:
        for i in range(segments):
            angle = math.tau * i / segments
            vertices.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle), cz + z))
    faces = []
    links = len(profile) if closed else len(profile) - 1
    for j in range(links):
        next_j = (j + 1) % len(profile)
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((j * segments + i, j * segments + ni, next_j * segments + ni, next_j * segments + i))
    if cap_ends and not closed:
        faces += [tuple(reversed(range(segments))), tuple((len(profile) - 1) * segments + i for i in range(segments))]
    return mesh(name, vertices, faces, mat, smooth=True)


def extrude_xz(name, outline, y, depth, mat, bevel_width=0.0):
    count = len(outline)
    vertices = [(x, y - depth / 2, z) for x, z in outline] + [(x, y + depth / 2, z) for x, z in outline]
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, count + i, count + j, j))
    return mesh(name, vertices, faces, mat, bevel_width)


def arch_cutter(name, width, bottom, spring, y_min, y_max):
    radius = width / 2
    outline = [(-radius, bottom), (radius, bottom), (radius, spring)]
    for i in range(1, 17):
        angle = math.pi * i / 16
        outline.append((radius * math.cos(angle), spring + radius * math.sin(angle)))
    return extrude_xz(name, outline, (y_min + y_max) / 2, y_max - y_min, None)


def apply_boolean(target, cutter):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new("True recessed opening", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def finish_model(name):
    for obj in list(bpy.context.scene.objects):
        if obj.type == "CURVE":
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_handbuilt_mesh"
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bounds = [Vector(corner) for corner in obj.bound_box]
    center_x = (min(v.x for v in bounds) + max(v.x for v in bounds)) / 2
    center_y = (min(v.y for v in bounds) + max(v.y for v in bounds)) / 2
    min_z = min(v.z for v in bounds)
    for vertex in obj.data.vertices:
        vertex.co.x -= center_x
        vertex.co.y -= center_y
        vertex.co.z -= min_z
    obj.data.update()
    obj["asset"] = name
    obj["construction"] = "Local procedural hand modeling; no online generation or image textures"
    obj["front"] = "Blender -Y / glTF +Z"
    return obj


def export_glb(obj, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=True,
    )


def reimport_glb(path: Path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    return objects


def mesh_stats(objects):
    vertices = sum(len(obj.data.vertices) for obj in objects)
    triangles = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    bounds = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = [min(v[i] for v in bounds) for i in range(3)]
    maximum = [max(v[i] for v in bounds) for i in range(3)]
    dimensions = [maximum[i] - minimum[i] for i in range(3)]
    return {"vertices": vertices, "triangles": triangles, "dimensions_xyz": dimensions, "min_z": minimum[2]}


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_studio(height: float, width: float, camera_position, target):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("Warm silk studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.72, 0.79, 0.78, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    scene.world = world
    ground_mat = material("Studio matte warm limestone", "D8D3C3", 0.86)
    ground = box("STUDIO_ONLY_ground", (0, 0, -0.035), (200, 200, 0.06), ground_mat, 0)
    ground.is_shadow_catcher = False
    for name, location, energy, size, color in [
        ("Key softbox", (-3, -4, height * 2.7 + 2), 850 + height * 220, 4.0, (1.0, 0.83, 0.67)),
        ("Fill softbox", (4, -1, height * 1.5 + 1), 600 + height * 120, 3.5, (0.73, 0.86, 1.0)),
        ("Rim softbox", (1, 4, height * 2.4 + 2), 1000 + height * 180, 3.0, (1.0, 0.91, 0.72)),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = location
        look_at(obj, (0, 0, height * 0.55))
    camera_data = bpy.data.cameras.new("Validation camera")
    camera = bpy.data.objects.new("Validation camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = camera_position
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = width
    camera_data.lens = 48
    look_at(camera, target)
    scene.camera = camera
    return camera


def render_views(path: Path, camera, hero_location, hero_target, hero_scale, front_scale, height):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1100
    camera.location = hero_location
    camera.data.ortho_scale = hero_scale
    look_at(camera, hero_target)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)

    views = [
        ((0, -12, height * 0.48), (0, 0, height * 0.48)),
        ((12, 0, height * 0.48), (0, 0, height * 0.48)),
        ((0, 12, height * 0.48), (0, 0, height * 0.48)),
        (hero_location, hero_target),
    ]
    tiles = []
    scene.render.resolution_x = 600
    scene.render.resolution_y = 600
    camera.data.ortho_scale = front_scale
    for index, (location, target) in enumerate(views):
        camera.location = location
        look_at(camera, target)
        temp = path.with_name(f".{path.stem}-view-{index}.png")
        scene.render.filepath = str(temp)
        bpy.ops.render.render(write_still=True)
        image = bpy.data.images.load(str(temp), check_existing=False)
        tiles.append(image)
    import numpy as np

    sheet = bpy.data.images.new("Four-view structural validation", width=1200, height=1200, alpha=True)
    canvas = np.zeros((1200 * 1200 * 4,), dtype=np.float32)
    canvas[:] = 1.0
    for index, image in enumerate(tiles):
        pixels = np.empty(600 * 600 * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        pixels = pixels.reshape((600, 600, 4))
        col, row = index % 2, 1 - index // 2
        tile = canvas.reshape((1200, 1200, 4))[row * 600:(row + 1) * 600, col * 600:(col + 1) * 600, :]
        tile[:] = pixels
        bpy.data.images.remove(image)
    sheet.pixels.foreach_set(canvas)
    sheet.filepath_raw = str(path.with_name(f"{path.stem.replace('-preview', '')}-four-view.png"))
    sheet.file_format = "PNG"
    sheet.save()
    for temp in path.parent.glob(f".{path.stem}-view-*.png"):
        temp.unlink()
