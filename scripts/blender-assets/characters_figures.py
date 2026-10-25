"""Local procedural character modeling for the four chapter-one supporting figures."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "blender-assets"))
from common import (  # noqa: E402
    assign, box, curve, cylinder, export_glb, finish_model, look_at, rgb,
    mesh, mesh_stats, reimport_glb, render_views, sphere, torus,
)

OUT = ROOT / "assets" / "source-models" / "chars"
SHOTS = ROOT / "shots" / "character-refine-final"


def material(name, color, roughness=.55, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgb(color)
    nodes = mat.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    output = next((n for n in nodes if n.type == "OUTPUT_MATERIAL"), None)
    if output is None:
        output = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = rgb(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def woven_material(name, color, roughness=.82, motif="diamond"):
    """Deterministic packed textile: fine warp/weft plus a restrained woven motif."""
    import numpy as np

    mat = material(name, color, roughness)
    size = 256
    yy, xx = np.mgrid[0:size, 0:size]
    base = np.array([int(color[i:i+2], 16) / 255 for i in (0, 2, 4)])
    warp = np.where(xx % 8 < 3, 1.025, .975)
    weft = np.where(yy % 8 < 3, 1.018, .982)
    interlace = np.where(((xx // 4) + (yy // 4)) % 2 == 0, warp, weft)
    mx, my = xx % 64, yy % 64
    if motif == "diamond":
        distance = np.abs(mx - 31.5) + np.abs(my - 31.5)
        pattern = np.where((distance > 18) & (distance < 21), 1.10, 1.0)
        pattern *= np.where(distance < 3, .91, 1.0)
    else:
        dx = np.minimum(np.abs(mx - 16), np.abs(mx - 48))
        dy = np.minimum(np.abs(my - 16), np.abs(my - 48))
        pattern = np.where((dx < 1.5) & (dy < 12), 1.075, 1.0)
        pattern *= np.where((dy < 1.5) & (dx < 12), .94, 1.0)
    shade = np.clip(interlace * pattern, .82, 1.14)
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = np.clip(base[None, None, :] * shade[:, :, None], 0, 1)
    image = bpy.data.images.new(f"{name} | procedural weave", width=size, height=size, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    nodes = mat.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Packed procedural woven silk"
    texture.image = image
    texture.extension = "REPEAT"
    texture.interpolation = "Linear"
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    mat.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.materials):
        bpy.data.materials.remove(data)


def palette():
    return {
        "ink": material("Ink | warm black", "211C1A", .72),
        "hair": material("Hair | blue-black satin", "17191D", .38),
        "hair_grey": material("Hair | silver ash", "8E9290", .58),
        "hair_grey_dark": material("Hair | ash shadow", "5D625F", .62),
        "ivory": material("Cloth | unbleached silk", "E5D9BC", .82),
        "paper": material("Paper | mulberry cream", "E7D9B5", .9),
        "wood": material("Wood | polished jujube", "66432D", .48),
        "wood_light": material("Wood | boxwood", "A57B49", .57),
        "gold": material("Metal | antique gold", "C99B45", .3, .72),
        "silver": material("Metal | old silver", "AAB7B9", .32, .68),
        "jade": material("Stone | celadon jade", "6D9B87", .28),
        "cord": material("Cord | madder red", "8F302D", .8),
    }


def ring_form(name, profiles, mat, sides=32, pleat=0.0, cap=True, pleat_count=12):
    """Profiles are (z, center_x, center_y, radius_x, radius_y)."""
    vertices = []
    for j, (z, cx, cy, rx, ry) in enumerate(profiles):
        falloff = math.sin((j / max(1, len(profiles) - 1)) * math.pi / 2)
        for i in range(sides):
            a = math.tau * i / sides
            fold = 1 + pleat * (.78 * math.cos(a * pleat_count) + .22 * math.cos(a * pleat_count * 2)) * falloff
            vertices.append((cx + rx * math.cos(a) * fold, cy + ry * math.sin(a) * fold, z))
    faces = []
    for j in range(len(profiles) - 1):
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((j * sides + i, j * sides + ni, (j + 1) * sides + ni, (j + 1) * sides + i))
    if cap:
        faces += [tuple(reversed(range(sides))), tuple((len(profiles) - 1) * sides + i for i in range(sides))]
    obj = mesh(name, vertices, faces, mat, smooth=True)
    uv = obj.data.uv_layers.new(name="Tailored cloth UV")
    for polygon in obj.data.polygons:
        indices = [obj.data.loops[li].vertex_index % sides for li in polygon.loop_indices]
        seam = max(indices) - min(indices) > sides // 2
        for li in polygon.loop_indices:
            vi = obj.data.loops[li].vertex_index
            j, i = divmod(vi, sides)
            if seam and i == 0:
                i = sides
            uv.data[li].uv = (i / sides * 2.0, vertices[vi][2] * 2.6)
    return obj


def tube(name, points, radii, mat, sides=12):
    points = [Vector(p) for p in points]
    vertices = []
    for j, (point, radius) in enumerate(zip(points, radii)):
        tangent = points[min(j + 1, len(points) - 1)] - points[max(0, j - 1)]
        tangent.normalize()
        ref = Vector((0, 1, 0)) if abs(tangent.y) < .92 else Vector((1, 0, 0))
        u = tangent.cross(ref).normalized()
        v = tangent.cross(u).normalized()
        rx, ry = (radius, radius) if isinstance(radius, (int, float)) else radius
        for i in range(sides):
            a = math.tau * i / sides
            vertices.append(tuple(point + u * (math.cos(a) * rx) + v * (math.sin(a) * ry)))
    faces = []
    for j in range(len(points) - 1):
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((j * sides + i, j * sides + ni, (j + 1) * sides + ni, (j + 1) * sides + i))
    faces += [tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + i for i in range(sides))]
    obj = mesh(name, vertices, faces, mat, smooth=True)
    lengths = [0.0]
    for j in range(1, len(points)):
        lengths.append(lengths[-1] + (points[j] - points[j-1]).length)
    uv = obj.data.uv_layers.new(name="Tailored cloth UV")
    for polygon in obj.data.polygons:
        indices = [obj.data.loops[li].vertex_index % sides for li in polygon.loop_indices]
        seam = max(indices) - min(indices) > sides // 2
        for li in polygon.loop_indices:
            vi = obj.data.loops[li].vertex_index
            j, i = divmod(vi, sides)
            if seam and i == 0:
                i = sides
            uv.data[li].uv = (i / sides, lengths[j] * 3.2)
    return obj


def ribbon(name, points, width, mat):
    vertices = []
    vectors = [Vector(p) for p in points]
    for i, point in enumerate(vectors):
        tangent = vectors[min(i+1,len(vectors)-1)]-vectors[max(0,i-1)]
        side = Vector((tangent.z,0,-tangent.x)).normalized()*width/2
        vertices.extend([tuple(point-side),tuple(point+side)])
    faces = [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(len(points)-1)]
    obj = mesh(name, vertices, faces, mat, smooth=True)
    uv = obj.data.uv_layers.new(name="Tailored cloth UV")
    for polygon in obj.data.polygons:
        for li in polygon.loop_indices:
            vi = obj.data.loops[li].vertex_index
            uv.data[li].uv = ((vi % 2) * .42, (vi // 2) * .24)
    solid = obj.modifiers.new("Woven thickness", "SOLIDIFY")
    solid.thickness = .006
    return obj


def head_form(name, center, size, skin, age="adult"):
    cx, cy, cz = center
    rx, ry, rz = size
    profiles = [
        (cz-rz, cx, cy+.008, rx*.22, ry*.30),
        (cz-rz*.84, cx, cy+.003, rx*.63, ry*.66),
        (cz-rz*.56, cx, cy, rx*.91, ry*.87),
        (cz-rz*.16, cx, cy, rx, ry*.98),
        (cz+rz*.25, cx, cy, rx*1.01, ry),
        (cz+rz*.62, cx, cy+.005, rx*.91, ry*.91),
        (cz+rz*.87, cx, cy+.009, rx*.61, ry*.62),
        (cz+rz, cx, cy+.01, rx*.05, ry*.05),
    ]
    obj = ring_form(f"{name} | sculpted head", profiles, skin, 32)
    sub = obj.modifiers.new("Sculpt smoothing", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    for side in (-1, 1):
        sphere(f"{name} | ear", (cx+side*rx*.99, cy+.002, cz-rz*.03), (rx*.16, ry*.18, rz*.22), skin, 16, 10)
        sphere(f"{name} | ear concha", (cx+side*rx*1.04, cy-ry*.12, cz-rz*.03), (rx*.065, ry*.06, rz*.11), skin, 12, 8)
    front = cy-ry
    eye_z = cz+rz*.13
    eye_x = rx*.38
    white = material(f"{name} | warm eye white", "D7C7AE" if age == "elder" else "E6DCC8", .48)
    for side in (-1, 1):
        x = cx+side*eye_x
        sphere(f"{name} | eye", (x, front+.002, eye_z), (rx*.195, ry*.085, rz*.060), white, 20, 10)
        sphere(f"{name} | iris", (x, front-ry*.082, eye_z), (rx*.068, ry*.028, rz*.050), palette_cached["ink"], 16, 8)
        sphere(f"{name} | pupil glint", (x-rx*.014, front-ry*.11, eye_z+rz*.014), (rx*.014, ry*.010, rz*.012), white, 10, 6)
        lid = [(x-rx*.205, front-.003, eye_z), (x, front-.006, eye_z+rz*.063), (x+rx*.205, front-.003, eye_z)]
        curve(f"{name} | upper eyelid", lid, .0022, skin, smooth=True)
        brow_mat = palette_cached["hair_grey_dark"] if age == "elder" else palette_cached["hair"]
        curve(f"{name} | eyebrow", [(x-rx*.25, front+.006, eye_z+rz*.20), (x, front+.001, eye_z+rz*.24), (x+rx*.24, front+.006, eye_z+rz*.20)], .004 if age != "child" else .0032, brow_mat, smooth=True)
        if age == "elder":
            curve(f"{name} | eye crease", [(x+side*rx*.22, front+.005, eye_z-rz*.04), (x+side*rx*.37, front+.015, eye_z-rz*.065)], .0015, palette_cached["wrinkle"])
    sphere(f"{name} | nose bridge", (cx, front+.002, cz-rz*.01), (rx*.092, ry*.105, rz*.20), skin, 18, 12)
    sphere(f"{name} | nose tip", (cx, front-ry*.10, cz-rz*.14), (rx*.135, ry*.105, rz*.092), skin, 18, 10)
    for side in (-1, 1):
        sphere(f"{name} | nostril", (cx+side*rx*.077, front-ry*.19, cz-rz*.18), (rx*.026, ry*.018, rz*.017), palette_cached["nostril"], 10, 6)
    mouth_z = cz-rz*.42
    lip = palette_cached["lip_elder"] if age == "elder" else palette_cached["lip"]
    curve(f"{name} | upper lip", [(cx-rx*.23, front-.004, mouth_z), (cx, front-.009, mouth_z+rz*.025), (cx+rx*.23, front-.004, mouth_z)], .0032, lip, smooth=True)
    curve(f"{name} | lower lip", [(cx-rx*.20, front-.004, mouth_z-.002), (cx, front-.008, mouth_z-rz*.035), (cx+rx*.20, front-.004, mouth_z-.002)], .003, lip, smooth=True)
    if age == "heichi":
        box(f"{name} | naturally darkened teeth", (cx, front-.005, mouth_z-.001), (rx*.25, .005, rz*.025), palette_cached["teeth"], .001)
    if age == "elder":
        for dz in (.39, .49):
            curve(f"{name} | forehead line", [(cx-rx*.34, front+.014, cz+rz*dz), (cx, front+.005, cz+rz*(dz+.015)), (cx+rx*.34, front+.014, cz+rz*dz)], .0014, palette_cached["wrinkle"], smooth=True)
        for side in (-1, 1):
            curve(f"{name} | nasolabial fold", [(cx+side*rx*.17, front-.004, cz-rz*.21), (cx+side*rx*.25, front+.002, cz-rz*.38), (cx+side*rx*.23, front+.008, cz-rz*.51)], .0015, palette_cached["wrinkle"], smooth=True)
    return obj


def hair_cap(name, center, size, mat, front_line=1.10):
    cx, cy, cz = center
    rx, ry, rz = size
    segments, rings = 40, 12
    vertices = []
    for j in range(rings+1):
        t = j/rings
        for i in range(segments):
            a = math.tau*i/segments
            frontness = (math.cos(a)+1)/2
            boundary = 2.22-(2.22-front_line)*frontness**2
            theta = .015+(boundary-.015)*t
            vertices.append((cx+rx*1.035*math.sin(theta)*math.sin(a), cy-ry*1.035*math.sin(theta)*math.cos(a)+.008, cz+rz*1.035*math.cos(theta)+.005))
    faces = []
    for j in range(rings):
        for i in range(segments):
            ni = (i+1)%segments
            faces.append((j*segments+i, (j+1)*segments+i, (j+1)*segments+ni, j*segments+ni))
    return mesh(name, vertices, faces, mat, smooth=True)


def hand(name, wrist, direction, skin, scale=1.0, grip=False):
    wrist = Vector(wrist)
    d = Vector(direction).normalized()
    q = Vector((0, 0, -1)).rotation_difference(d)
    def tr(p):
        return tuple(wrist + q @ (Vector(p)*scale))
    palm = sphere(f"{name} | palm", tr((0, 0, -.035)), (.035*scale, .023*scale, .052*scale), skin, 16, 10)
    palm.rotation_euler = q.to_euler()
    if grip:
        for i in range(4):
            x = (i-1.5)*.014
            tube(f"{name} | curled finger", [tr((x, -.016, -.055)), tr((x, -.032, -.075)), tr((x, -.012, -.09))], [.008*scale]*3, skin, 8)
        tube(f"{name} | thumb", [tr((-.031, 0, -.03)), tr((-.041, -.023, -.06)), tr((-.02, -.034, -.068))], [.011*scale, .010*scale, .008*scale], skin, 8)
    else:
        for i in range(4):
            x = (i-1.5)*.016
            length = (.048, .063, .059, .044)[i]
            tube(f"{name} | finger", [tr((x, -.002, -.068)), tr((x, -.005, -.068-length*.55)), tr((x, -.012, -.068-length))], [.008*scale, .007*scale, .005*scale], skin, 8)
        tube(f"{name} | thumb", [tr((-.031, 0, -.028)), tr((-.05, -.006, -.055)), tr((-.048, -.016, -.075))], [.011*scale, .009*scale, .006*scale], skin, 8)


def shoe(name, center, width, length, mat, trim):
    x, y, z = center
    sphere(name, (x, y-length*.15, z), (width, length, .048), mat, 20, 10)
    curve(f"{name} | stitched welt", [(x-width*.75, y-length*.95, z-.016), (x, y-length*1.10, z-.023), (x+width*.75, y-length*.95, z-.016)], .005, trim, smooth=True)


def waist_band(name, z, rx, ry, mat, cy=0):
    return ring_form(name, [(z-.032, 0, cy, rx, ry), (z+.032, 0, cy, rx*.98, ry*.98)], mat, 40)


def collar(name, shoulder_z, waist_z, rx, front_y, mat, inner):
    ribbon(f"{name} | inner collar", [(-rx*.65, front_y+.014, shoulder_z), (-rx*.18, front_y-.004, shoulder_z-.07), (rx*.48, front_y-.006, waist_z)], .031, inner)
    ribbon(f"{name} | crossed collar", [(rx*.70, front_y, shoulder_z), (rx*.12, front_y-.016, shoulder_z-.085), (-rx*.47, front_y-.012, waist_z+.015)], .042, mat)
    curve(f"{name} | collar edge", [(rx*.70, front_y-.008, shoulder_z), (rx*.12, front_y-.025, shoulder_z-.085), (-rx*.47, front_y-.020, waist_z+.015)], .0025, palette_cached["gold"] if name.startswith("heichi") else inner, smooth=False)


def skirt_trim(name, z, rx, ry, mat, cy=0):
    ring_form(name, [(z-.018, 0, cy, rx, ry), (z+.018, 0, cy, rx, ry)], mat, 48, 0, False)


def build_granny():
    p = palette_cached
    skin = material("Granny | warm aged skin", "B88B6D", .68)
    jacket = woven_material("Granny | indigo cotton jacket", "3F5156", .88, "grid")
    jacket_dark = material("Granny | deep indigo trim", "26383E", .84)
    skirt = woven_material("Granny | sage grey skirt", "6B7061", .9, "grid")
    shawl = woven_material("Granny | woven umber shawl", "74584A", .92, "diamond")
    shoe_mat = material("Granny | cloth shoes", "34312C", .9)
    ring_form("granny | pleated long skirt", [(.10,0,.025,.24,.15),(.23,0,.025,.235,.15),(.56,0,.015,.18,.12),(.76,0,0,.135,.10)], skirt, 48, .055)
    skirt_trim("granny | skirt hem", .125, .254, .164, jacket_dark, .025)
    for x in (-.105, .105):
        shoe("granny | grounded cloth shoe", (x,-.025,.048), .069, .115, shoe_mat, jacket_dark)
    tube("granny | neck", [(0,-.075,1.15),(0,-.115,1.28)], [(.053,.048),(.05,.047)], skin, 16)
    ring_form("granny | stooped jacket torso", [(.70,0,0,.14,.105),(.87,0,-.015,.17,.12),(1.05,0,-.055,.185,.125),(1.17,0,-.085,.16,.10),(1.20,0,-.09,.10,.075)], jacket, 36)
    waist_band("granny | waist binding", .74, .15, .112, shawl)
    collar("granny", 1.17, .82, .17, -.187, shawl, p["ivory"])
    # A softer, multi-ring mantle follows the shoulders instead of making a flat cone.
    ring_form("granny | shoulder shawl", [(.995,0,-.05,.184,.129),(1.035,0,-.058,.188,.131),(1.085,0,-.069,.180,.126),(1.135,0,-.079,.159,.112),(1.18,0,-.087,.124,.087),(1.205,0,-.09,.098,.073)], shawl, 48, 0, False)
    skirt_trim("granny | shawl woven lower border", 1.012, .187, .132, jacket_dark, -.052)
    ribbon("granny | left shawl fall", [(-.116,-.190,1.12),(-.132,-.199,1.02),(-.137,-.188,.90),(-.132,-.174,.79)], .072, shawl)
    ribbon("granny | right shawl fall", [(.116,-.190,1.12),(.132,-.199,1.02),(.137,-.188,.91),(.132,-.174,.80)], .072, shawl)
    for side in (-1, 1):
        edge_x = side * .132
        curve("granny | shawl fall stitched edge", [(edge_x-side*.026,-.195,1.11),(edge_x-side*.026,-.204,1.01),(edge_x-side*.026,-.193,.90),(edge_x-side*.026,-.179,.805)], .0018, p["wood_light"], smooth=True)
        for z in (.823, .846, .869):
            curve("granny | shawl end woven bar", [(edge_x-side*.027,-.181,z),(edge_x+side*.027,-.181,z)], .0018, p["wood_light"])
        for z in (.94, 1.01, 1.075):
            curve("granny | shawl diamond embroidery", [(edge_x,-.204,z+.014),(edge_x+side*.010,-.205,z),(edge_x,-.204,z-.014),(edge_x-side*.010,-.205,z),(edge_x,-.204,z+.014)], .0015, p["wood_light"])
    for z in (.87,.97,1.07):
        sphere("granny | cloth knot button", (.015,-.196,z), (.014,.009,.014), jacket_dark, 12, 8)
    tube("granny | staff sleeve", [(.151,-.066,1.105),(.194,-.073,1.075),(.237,-.086,1.015),(.285,-.108,.965),(.32,-.115,.94)], [(.071,.067),(.073,.067),(.066,.060),(.055,.052),(.048,.045)], jacket, 24)
    tube("granny | resting sleeve", [(-.151,-.066,1.105),(-.197,-.085,1.065),(-.220,-.115,.995),(-.183,-.167,.925),(-.14,-.21,.88)], [(.071,.067),(.071,.064),(.064,.058),(.054,.050),(.047,.043)], jacket, 24)
    hand("granny | staff hand", (.34,-.125,.945), (.15,-.1,-1), skin, .83, True)
    hand("granny | resting hand", (-.14,-.21,.89), (.5,0,-1), skin, .82, False)
    curve("granny | short crooked staff", [(.39,-.13,.018),(.385,-.13,.38),(.375,-.13,.72),(.36,-.125,.93),(.32,-.12,1.00),(.28,-.12,.99)], .018, p["wood"], smooth=True)
    torus("granny | staff ferrule", (.39,-.13,.036), .018, .004, p["gold"], major_segments=20, minor_segments=6)
    head_center = (0,-.135,1.335)
    head_form("granny", head_center, (.104,.091,.127), skin, "elder")
    hair_cap("granny | silver hair cap", head_center, (.106,.094,.13), p["hair_grey"], 1.04)
    sphere("granny | coiled bun", (0,-.045,1.475), (.070,.058,.047), p["hair_grey"], 24, 14)
    for i in range(5):
        curve("granny | bun coil", [(-.052+i*.018,-.091,1.457),(-.048+i*.017,-.099,1.486),(-.035+i*.014,-.084,1.505)], .003, p["hair_grey_dark"], smooth=True)
    for side in (-1,1):
        curve("granny | combed side hair", [(side*.075,-.178,1.44),(side*.093,-.16,1.39),(side*.097,-.12,1.32)], .005, p["hair_grey_dark"], smooth=True)
    cylinder("granny | bun pin", (0,-.047,1.49), .006, .18, p["wood_light"], 16, .002, (0,math.pi/2,0))
    sphere("granny | pin end", (.094,-.047,1.49), (.015,.012,.012), p["jade"], 14, 8)
    # Small belt pouch, kept clear of the hand and staff.
    sphere("granny | belt pouch", (-.16,-.02,.68), (.06,.035,.075), shawl, 18, 10)
    curve("granny | pouch cord", [(-.15,-.025,.76),(-.18,-.04,.72),(-.17,-.045,.65)], .005, jacket_dark, smooth=True)


def build_child():
    p = palette_cached
    skin = material("Child | warm healthy skin", "C99270", .62)
    tunic = material("Child | teal short tunic", "397C7C", .82)
    trim = material("Child | saffron woven trim", "D09A43", .78)
    pants = material("Child | cropped indigo trousers", "36465B", .88)
    shoe_mat = material("Child | soft cloth shoes", "493B32", .86)
    for x in (-.074,.074):
        tube("child | trouser leg", [(x,0,.52),(x*1.06,.008,.30),(x*1.10,.005,.085)], [(.072,.068),(.061,.057),(.048,.045)], pants, 18)
        ring_form("child | bound trouser cuff", [(.08,x*1.1,.005,.049,.046),(.13,x*1.08,.005,.052,.049)], trim, 24)
        shoe("child | grounded shoe", (x*1.1,-.028,.05), .057, .093, shoe_mat, trim)
    tube("child | neck", [(0,0,.78),(0,-.005,.87)], [(.041,.039),(.041,.039)], skin, 16)
    ring_form("child | short tunic", [(.47,0,0,.145,.10),(.56,0,0,.14,.10),(.74,0,0,.145,.105),(.82,0,0,.105,.075)], tunic, 32)
    waist_band("child | cloth belt", .54, .145, .105, trim)
    collar("child", .805, .59, .135, -.113, trim, p["ivory"])
    ring_form("child | tunic hem", [(.465,0,0,.148,.104),(.49,0,0,.148,.104)], trim, 36, 0, False)
    for z in (.64,.72):
        curve("child | frog fastening", [(-.012,-.121,z),(.025,-.121,z),(.038,-.118,z+.009)], .004, trim)
    tube("child | raised sleeve", [(.125,0,.76),(.21,-.005,.83),(.255,-.025,.93)], [.066,.063,.041], tunic, 18)
    tube("child | spool sleeve", [(-.125,0,.76),(-.205,-.045,.67),(-.21,-.145,.59)], [.067,.061,.041], tunic, 18)
    hand("child | raised string hand", (.26,-.027,.945), (.25,0,1), skin, .66, True)
    hand("child | spool hand", (-.21,-.15,.60), (0,-.25,-1), skin, .66, True)
    # Functional kite-line spool with separate flanges, wound cord and loose line.
    cylinder("child | spool axle", (-.235,-.19,.565), .014, .13, p["wood_light"], 20, .003, (0,math.pi/2,0))
    cylinder("child | wound kite line", (-.235,-.19,.565), .035, .064, p["ivory"], 28, .002, (0,math.pi/2,0))
    for x in (-.282,-.188):
        cylinder("child | spool flange", (x,-.19,.565), .052, .012, p["wood"], 28, .004, (0,math.pi/2,0))
    curve("child | kite string between hands", [(-.235,-.225,.59),(-.13,-.25,.70),(.15,-.22,.78),(.275,-.04,1.02)], .0018, p["ivory"], smooth=True)
    curve("child | spool loose tail", [(-.24,-.225,.55),(-.28,-.24,.47),(-.25,-.23,.43)], .0018, p["ivory"], smooth=True)
    head_center = (0,-.008,.955)
    head_form("child", head_center, (.091,.082,.108), skin, "child")
    hair_cap("child | short black hair", head_center, (.093,.084,.111), p["hair"], 1.00)
    sphere("child | small topknot", (0,.008,1.076), (.044,.038,.035), p["hair"], 20, 12)
    torus("child | topknot red binding", (0,.008,1.058), .031, .006, p["cord"], major_segments=28, minor_segments=6)
    for side in (-1,1):
        curve("child | side hair lock", [(side*.07,-.071,1.025),(side*.083,-.05,.985),(side*.087,-.025,.96)], .007, p["hair"], smooth=True)
        curve("child | red hair tie", [(side*.025,.008,1.087),(side*.058,.006,1.11),(side*.07,.005,1.09)], .004, p["cord"], smooth=True)
    sphere("child | small side satchel", (.16,.015,.49), (.052,.033,.063), trim, 18, 10)
    curve("child | satchel strap", [(-.10,-.075,.80),(.02,-.115,.68),(.16,-.05,.52)], .009, p["wood"], smooth=False)


def book(name, center, cover_mat):
    x,y,z = center
    p = palette_cached
    for side in (-1,1):
        cover = box(f"{name} | cloth cover", (x+side*.064,y,z), (.126,.018,.185), cover_mat, .006)
        cover.rotation_euler.z = side*.09
        pages = box(f"{name} | page block", (x+side*.060,y-.012,z+.002), (.113,.014,.169), p["paper"], .003)
        pages.rotation_euler.z = side*.09
        for row in range(7):
            zz = z+.061-row*.019
            xx = x+side*.06
            curve(f"{name} | ink text", [(xx-.040,y-.022,zz),(xx+.036,y-.022,zz)], .00125, p["ink"])
    curve(f"{name} | stitched spine", [(x,y-.024,z-.088),(x,y-.024,z+.088)], .004, p["cord"])
    for zz in (z-.06,z,z+.06):
        torus(f"{name} | binding loop", (x,y-.025,zz), .008, .0018, p["ivory"], (math.pi/2,0,0), 16, 6)


def scroll(name, center, width, height):
    x,y,z = center
    p = palette_cached
    box(f"{name} | silk-backed paper", (x,y,z), (width,.012,height), p["paper"], .003)
    for zz in (z-height/2-.012,z+height/2+.012):
        cylinder(f"{name} | roller", (x,y,zz), .014, width+.065, p["wood"], 24, .003, (0,math.pi/2,0))
        for side in (-1,1):
            sphere(f"{name} | roller finial", (x+side*(width/2+.038),y,zz), (.019,.017,.017), p["gold"], 12, 8)
    for col in range(5):
        xx = x-width*.36+col*width*.18
        for row in range(7):
            zz = z+height*.35-row*height*.105
            curve(f"{name} | calligraphy", [(xx-.008,y-.008,zz+.006),(xx+.005,y-.009,zz),(xx-.004,y-.008,zz-.008)], .0018, p["ink"])
    box(f"{name} | vermilion seal", (x+width*.31,y-.009,z-height*.34), (.022,.003,.022), p["cord"], .001)


def build_heichi_red():
    p = palette_cached
    skin = material("Li Hongwei | warm honey skin", "BD9073", .56)
    dress = woven_material("Li Hongwei | madder crimson silk", "9B3E45", .72, "diamond")
    dress_dark = woven_material("Li Hongwei | oxblood dress shadow", "632D3B", .78, "grid")
    sleeve = woven_material("Li Hongwei | coral outer sleeves", "B85B55", .76, "diamond")
    trim = woven_material("Li Hongwei | deep teal brocade", "284F51", .68, "grid")
    shoe_mat = material("Li Hongwei | embroidered slippers", "4A2935", .78)
    for x in (-.09,.09):
        shoe("heichi_red | hidden toe", (x,-.02,.045), .062, .105, shoe_mat, trim)
    ring_form("heichi_red | twelve-gore pleated skirt", [(.09,0,.018,.258,.168),(.16,0,.018,.254,.166),(.25,0,.017,.241,.159),(.36,0,.015,.222,.148),(.48,0,.013,.201,.136),(.60,0,.011,.180,.124),(.72,0,.008,.159,.111),(.85,0,.004,.137,.098),(1.01,0,0,.115,.085)], dress, 96, .038, True, 16)
    skirt_trim("heichi_red | layered underskirt", .096, .259, .169, dress_dark, .018)
    skirt_trim("heichi_red | brocade skirt hem", .115, .280, .183, trim, .018)
    skirt_trim("heichi_red | gold hem line", .145, .275, .179, p["gold"], .018)
    for i in range(20):
        a = math.tau * i / 20
        center = Vector((.277*math.cos(a), .018+.181*math.sin(a), .126))
        tangent = Vector((-math.sin(a), math.cos(a), 0)).normalized() * .007
        up = Vector((0,0,.010))
        curve("heichi_red | hem woven diamond", [center+up,center+tangent,center-up,center-tangent,center+up], .0012, p["gold"])
    tube("heichi_red | neck", [(0,0,1.35),(0,0,1.46)], [(.047,.043),(.045,.043)], skin, 18)
    ring_form("heichi_red | high-waisted bodice", [(.96,0,0,.12,.088),(1.11,0,0,.13,.095),(1.28,0,0,.165,.112),(1.36,0,0,.105,.073)], sleeve, 36)
    waist_band("heichi_red | high waist sash", 1.01, .132, .098, trim)
    collar("heichi_red", 1.34, 1.05, .16, -.117, trim, p["ivory"])
    ribbon("heichi_red | long sash left", [(-.04,-.112,1.01),(-.055,-.125,.78),(-.046,-.14,.55)], .045, trim)
    ribbon("heichi_red | long sash right", [(.035,-.112,1.01),(.05,-.126,.76),(.065,-.14,.60)], .037, dress_dark)
    sphere("heichi_red | sash jade", (0,-.128,1.0), (.026,.012,.032), p["jade"], 18, 10)
    # Continuous tailored sleeve caps narrow into the cuffs without boxy vase-like peaks.
    tube("heichi_red | left bell sleeve", [(-.140,0,1.272),(-.176,-.014,1.240),(-.210,-.050,1.185),(-.226,-.105,1.120),(-.207,-.170,1.060),(-.17,-.225,1.020)], [(.058,.055),(.061,.057),(.067,.061),(.070,.063),(.058,.053),(.047,.043)], sleeve, 28)
    tube("heichi_red | right bell sleeve", [(.140,0,1.272),(.176,-.014,1.240),(.210,-.050,1.185),(.226,-.105,1.120),(.207,-.170,1.060),(.17,-.225,1.020)], [(.058,.055),(.061,.057),(.067,.061),(.070,.063),(.058,.053),(.047,.043)], sleeve, 28)
    for side in (-1,1):
        sphere("heichi_red | soft sleeve cap", (side*.140,0,1.272), (.059,.056,.058), sleeve, 24, 14)
        tube("heichi_red | brocade cuff", [(side*.185,-.200,1.040),(side*.165,-.230,1.018)], [(.051,.046),(.047,.042)], trim, 24)
        curve("heichi_red | sleeve restrained seam", [(side*.177,-.060,1.272),(side*.216,-.091,1.192),(side*.220,-.151,1.105),(side*.179,-.229,1.035)], .0016, dress_dark, smooth=True)
        hand("heichi_red | book hand", (side*.17,-.232,1.025), (-side*.35,-.1,-1), skin, .78, True)
    book("heichi_red | open anthology", (0,-.277,1.035), dress_dark)
    head_center = (0,-.005,1.535)
    head_form("heichi_red", head_center, (.103,.091,.13), skin, "heichi")
    hair_cap("heichi_red | swept hair", head_center, (.106,.094,.133), p["hair"], 1.00)
    sphere("heichi_red | high loop bun base", (0,.018,1.68), (.067,.052,.055), p["hair"], 24, 14)
    torus("heichi_red | upright loop bun", (0,.018,1.735), .053, .019, p["hair"], (math.pi/2,0,0), 32, 10)
    for side in (-1,1):
        curve("heichi_red | temple strand", [(side*.07,-.079,1.63),(side*.096,-.055,1.56),(side*.09,-.015,1.48)], .007, p["hair"], smooth=True)
        curve("heichi_red | swept crown strand", [(side*.018,-.085,1.645),(side*.055,-.065,1.675),(side*.07,-.02,1.67)], .0035, p["hair_grey_dark"], smooth=True)
    cylinder("heichi_red | gold hairpin", (0,.015,1.69), .005, .225, p["gold"], 16, .002, (0,math.pi/2,-.15))
    sphere("heichi_red | hairpin flower", (-.105,-.006,1.705), (.025,.014,.021), p["gold"], 16, 10)
    for i in range(3):
        curve("heichi_red | buyao chain", [(-.108,-.008,1.70),(-.115-i*.012,-.015,1.65),(-.112-i*.014,-.02,1.61-i*.012)], .0018, p["gold"], smooth=True)
        sphere("heichi_red | buyao pearl", (-.112-i*.014,-.02,1.605-i*.012), (.007,.006,.009), p["jade"], 12, 8)
    curve("heichi_red | bookmark tassel", [( .08,-.30,.96),(.09,-.31,.86),(.075,-.30,.79)], .004, p["cord"], smooth=True)


def build_heichi_purple():
    p = palette_cached
    skin = material("Lu Zixuan | warm bronze skin", "B78A70", .58)
    inner = woven_material("Lu Zixuan | pale lilac inner dress", "B7A5BA", .79, "grid")
    coat = woven_material("Lu Zixuan | purple beizi coat", "665075", .78, "diamond")
    coat_light = woven_material("Lu Zixuan | woven violet trim", "937C9D", .72, "grid")
    dark = material("Lu Zixuan | ink violet sash", "39374F", .78)
    shoe_mat = material("Lu Zixuan | violet slippers", "363141", .82)
    for x in (-.082,.082):
        shoe("heichi_purple | hidden toe", (x,-.015,.045), .058, .102, shoe_mat, coat_light)
    ring_form("heichi_purple | narrow pleated inner skirt", [(.09,0,.02,.215,.145),(.20,0,.02,.205,.14),(.72,0,.01,.14,.10),(1.02,0,0,.105,.08)], inner, 56, .045)
    skirt_trim("heichi_purple | inner hem", .12, .226, .156, coat_light, .02)
    tube("heichi_purple | neck", [(0,0,1.38),(0,0,1.49)], [(.044,.041),(.043,.04)], skin, 18)
    ring_form("heichi_purple | inner bodice", [(.96,0,0,.11,.083),(1.16,0,0,.125,.092),(1.33,0,0,.15,.103),(1.40,0,0,.095,.07)], inner, 34)
    collar("heichi_purple", 1.375, 1.07, .145, -.108, dark, p["ivory"])
    # Long open beizi panels create a straighter, narrower silhouette than Hongwei's ruqun.
    for side in (-1,1):
        ribbon("heichi_purple | long coat front", [(side*.13,-.09,1.37),(side*.15,-.118,1.20),(side*.15,-.13,.96),(side*.18,-.13,.68),(side*.20,-.10,.28)], .105, coat)
        curve("heichi_purple | coat woven edge", [(side*.082,-.105,1.36),(side*.098,-.135,1.17),(side*.10,-.145,.94),(side*.13,-.145,.65),(side*.15,-.115,.29)], .009, coat_light, smooth=False)
    ring_form("heichi_purple | back coat", [(.25,0,.08,.225,.090),(.72,0,.075,.17,.055),(1.15,0,.06,.16,.055),(1.37,0,.035,.15,.06)], coat, 48, .018, False)
    waist_band("heichi_purple | narrow sash", 1.03, .119, .091, dark)
    ribbon("heichi_purple | asymmetric sash fall", [(.055,-.105,1.03),(.08,-.14,.84),(.11,-.14,.62)], .04, dark)
    # Left arm carries a vertical handscroll; right hand holds a calligraphy brush.
    tube("heichi_purple | left fitted sleeve", [(-.14,0,1.33),(-.23,-.03,1.19),(-.245,-.15,1.07)], [.072,.068,.043], coat, 20)
    tube("heichi_purple | right fitted sleeve", [(.14,0,1.33),(.205,-.045,1.22),(.20,-.17,1.15)], [.072,.063,.042], coat, 20)
    for side,x,y,z in ((-1,-.245,-.155,1.075),(1,.20,-.175,1.155)):
        tube("heichi_purple | contrast cuff", [(x,y+.015,z+.025),(x,y-.01,z-.015)], [(.046,.042),(.043,.039)], coat_light, 18)
    hand("heichi_purple | scroll hand", (-.245,-.17,1.07), (-.1,0,-1), skin, .76, True)
    hand("heichi_purple | brush hand", (.20,-.185,1.155), (.25,0,-1), skin, .76, True)
    scroll("heichi_purple | poetry handscroll", (-.245,-.22,.885), .19, .34)
    tube("heichi_purple | brush bamboo handle", [(.17,-.21,1.02),(.205,-.21,1.15),(.27,-.20,1.34)], [.006,.007,.007], p["wood_light"], 12)
    tube("heichi_purple | brush dark tip", [(.17,-.21,1.02),(.158,-.21,.975)], [.006,.0015], p["hair"], 12)
    cylinder("heichi_purple | brush ferrule", (.17,-.21,1.025), .008, .023, p["gold"], 16, .002, (0,.25,0))
    head_center = (0,-.003,1.57)
    head_form("heichi_purple", head_center, (.098,.088,.132), skin, "heichi")
    hair_cap("heichi_purple | crown hair", head_center, (.101,.091,.135), p["hair"], 1.06)
    # Broad interlocking tresses have uneven roots, lateral waves and restrained colour shifts.
    hair_mid = material("Lu Zixuan | blue-black hair lights", "1D222B", .46)
    hair_low = material("Lu Zixuan | blue-black hair shadows", "14171D", .50)
    for i in range(7):
        x = (i-3)*.0315
        phase = i*.91
        drift = .010*math.sin(phase+.4)
        end_z = .950 + .026*(.5+.5*math.sin(phase))
        points = [
            (x*.68,.069+.003*math.cos(phase),1.622+.012*math.sin(phase)),
            (x*.84+drift*.4,.094,1.53),
            (x+drift,.112+.004*math.sin(phase),1.40),
            (x-drift*.75,.105+.006*math.cos(phase),1.25),
            (x+drift*.9,.113,1.10),
            (x*.94+drift*.5,.097,end_z),
        ]
        lock_mat = hair_mid if i in (1,4) else (hair_low if i in (2,5) else p["hair"])
        width = .027 + .003*math.sin(phase)
        tube("heichi_purple | waved back hair tress", points, [(.021,.015),(width,.016),(width*1.04,.015),(width,.013),(.022,.011),(.012,.007)], lock_mat, 16)
        if i % 2 == 0:
            highlight = [(px-.005,py+.013,pz) for px,py,pz in points[1:-1]]
            curve("heichi_purple | fine hair strand", highlight, .00055, hair_mid, smooth=True)
    sphere("heichi_purple | half-up bun", (0,.062,1.70), (.058,.047,.041), p["hair"], 22, 12)
    for side in (-1,1):
        points = []
        for i in range(9):
            t = i/8
            points.append((side*(.018+.07*t),-.072+.09*t,1.68-.19*t))
        curve("heichi_purple | braided crown", points, .010, p["hair"], smooth=False)
        for i in range(6):
            t = i/6
            sphere("heichi_purple | braid knot", (side*(.025+.06*t),-.068+.075*t,1.675-.16*t), (.013,.009,.011), p["hair"], 12, 8)
        curve("heichi_purple | face-framing lock", [(side*.075,-.068,1.65),(side*.095,-.04,1.54),(side*.087,-.005,1.43)], .007, p["hair"], smooth=True)
    box("heichi_purple | silver comb", (0,.026,1.723), (.11,.018,.022), p["silver"], .005)
    for i in range(7):
        x = (i-3)*.015
        cylinder("heichi_purple | comb tooth", (x,.025,1.704), .0022, .034, p["silver"], 10, .001)
    sphere("heichi_purple | comb amethyst", (0,.012,1.727), (.019,.009,.014), coat_light, 16, 10)
    # Inkstone at the belt, small enough not to compete with the scroll.
    box("heichi_purple | belt inkstone", (.135,-.035,.99), (.07,.032,.048), p["ink"], .008)
    box("heichi_purple | inkstone well", (.135,-.053,.99), (.043,.005,.023), dark, .005)


BUILDERS = {
    "granny": build_granny,
    "child": build_child,
    "heichi_red": build_heichi_red,
    "heichi_purple": build_heichi_purple,
}


def setup_studio(height):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.45
    world = bpy.data.worlds.new("Figure validation studio")
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg is None:
        bg = world.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (.72,.79,.78,1)
    bg.inputs["Strength"].default_value = .45
    world_output = next((n for n in world.node_tree.nodes if n.type == "OUTPUT_WORLD"), None)
    if world_output is None:
        world_output = world.node_tree.nodes.new("ShaderNodeOutputWorld")
    world.node_tree.links.new(bg.outputs["Background"],world_output.inputs["Surface"])
    scene.world = world
    ground_mat = material("STUDIO | limestone", "D8D3C3", .86)
    box("STUDIO_ONLY | ground", (0,0,-.035), (200,200,.06), ground_mat, 0)
    for name,location,energy,size,color in [
        ("Key",(-3,-4,height*2.7+2),850+height*220,4.0,(1,.87,.74)),
        ("Fill",(4,-1,height*1.5+1),650+height*120,3.5,(.75,.86,1)),
        ("Rim",(1,4,height*2.4+2),1000+height*180,3.0,(1,.91,.76)),
    ]:
        data = bpy.data.lights.new(name,"AREA")
        data.energy, data.shape, data.size, data.color = energy,"DISK",size,color
        obj = bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        obj.location = location
        look_at(obj,(0,0,height*.55))
    data = bpy.data.cameras.new("Validation camera")
    camera = bpy.data.objects.new("Validation camera",data)
    scene.collection.objects.link(camera)
    data.type = "ORTHO"
    scene.camera = camera
    return camera


def validate_and_render(name, glb_path):
    objects = reimport_glb(glb_path)
    stats = mesh_stats(objects)
    bounds = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    center_xy = [(min(v[i] for v in bounds)+max(v[i] for v in bounds))/2 for i in (0,1)]
    stats["horizontal_center_xy"] = center_xy
    stats["horizontal_center_pass"] = all(abs(v) < .0001 for v in center_xy)
    height = stats["dimensions_xyz"][2]
    camera = setup_studio(height)
    preview = SHOTS / f"{name}-preview.png"
    render_views(
        preview,camera,
        (height*1.65,-height*3.2,height*1.38),
        (0,0,height*.50),
        height*1.22,height*1.15,height,
    )
    stats.update({
        "file": str(glb_path),
        "preview": str(preview),
        "four_view": str(SHOTS / f"{name}-four-view.png"),
        "embedded_materials": True,
        "readback_from_final_glb": True,
        "triangle_budget_pass": stats["triangles"] <= 60000,
        "grounded_pass": abs(stats["min_z"]) < .0001,
    })
    print(f"FIGURE_STATS {name} {json.dumps(stats,ensure_ascii=False)}", flush=True)
    return stats


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    SHOTS.mkdir(parents=True,exist_ok=True)
    requested = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else list(BUILDERS)
    requested = [n for n in requested if n in BUILDERS]
    results = {}
    for name in requested:
        reset_scene()
        global palette_cached
        palette_cached = palette()
        if name == "granny":
            palette_cached.update({
                "wrinkle": material("Granny | fine wrinkle umber", "8E6653", .72),
                "nostril": material("Granny | nostril shadow", "684638", .75),
                "lip": material("Granny | lip", "965F58", .68),
                "lip_elder": material("Granny | muted lip", "875C52", .7),
                "teeth": palette_cached["ink"],
            })
        else:
            palette_cached.update({
                "wrinkle": material(f"{name} | crease", "795044", .7),
                "nostril": material(f"{name} | nostril shadow", "53362F", .74),
                "lip": material(f"{name} | natural lip", "75473F" if name.startswith("heichi") else "A86154", .58),
                "lip_elder": material(f"{name} | muted lip", "875C52", .7),
                "teeth": material(f"{name} | traditional dark teeth lacquer", "171512", .24),
            })
        BUILDERS[name]()
        obj = finish_model(name)
        obj["character"] = name
        obj["modeling"] = "Original offline procedural sculpt and tailored garments"
        obj["construction"] = "Local procedural hand modeling with deterministic packed textile textures"
        obj["front_axis"] = "glTF +Z"
        path = OUT / f"{name}.glb"
        export_glb(obj,path)
        results[name] = validate_and_render(name,path)
    report = SHOTS / "figure-validation.json"
    if report.exists():
        previous = json.loads(report.read_text(encoding="utf-8"))
        previous.update(results)
        results = previous
    report.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"FIGURE_REPORT {report}",flush=True)


if __name__ == "__main__":
    main()
