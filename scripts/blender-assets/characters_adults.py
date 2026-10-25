"""Build four distinct adult GLBs locally with Blender.

Usage: Blender --background --python characters_adults.py -- --only all
All geometry is modeled locally. Only the packed PBR head UVs are reused from
assets/source-models/chars/official.glb; no online generation service is used.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import struct
import sys

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from common import box, curve, cylinder, export_glb, finish_model, lathe, material, mesh_stats, reimport_glb, render_views, setup_studio, sphere, torus
from adult_common import (
    add_goatee, add_hand, add_moustache, add_shoes, band, cloth, elliptical_rings,
    frustum, import_textured_head, partial_headcloth, ribbon, tube_path,
)

SOURCE_HEAD = ROOT / "assets" / "source-models" / "chars" / "official.glb"
OUT_DIR = ROOT / "assets" / "source-models" / "chars"
SHOT_DIR = ROOT / "shots" / "character-models"


def collars(base_z, rx, ry, inner, trim, spread=0.105, lower_z=1.14):
    band("Inner standing collar", base_z + 0.005, 0.082, 0.072, 0.110, inner)
    ribbon("Left crossing collar", (-spread, -ry, base_z - 0.035), (0.052, -ry - 0.018, lower_z), 0.052, trim)
    ribbon("Right crossing collar", (spread, -ry - 0.003, base_z - 0.035), (-0.050, -ry - 0.022, lower_z + 0.025), 0.045, inner)


def sleeve_with_cuff(name, points, radii, cloth_mat, cuff_mat, skin, hand_scale=1.0):
    tube_path(name, points, cloth_mat, 28)
    end = points[-1]
    previous = points[-2]
    from mathutils import Vector
    direction = (Vector(end[0]) - Vector(previous[0])).normalized()
    cuff_start = Vector(end[0]) - direction * 0.045
    cuff_end = Vector(end[0]) + direction * 0.010
    frustum("Contrasting sewn sleeve cuff", cuff_start, cuff_end, end[1] * 1.015, end[1] * 1.01, cuff_mat, end[2] / end[1], 28)
    add_hand("Visible hand", Vector(end[0]) + direction * 0.015, skin, hand_scale)


def build_liangmian():
    robe = cloth("Liangmian | deep petrol woven silk", "294C50")
    robe_light = cloth("Liangmian | worn teal cuff facings", "527477")
    inner = cloth("Liangmian | ash linen inner robe", "C4C2AF")
    dark = cloth("Liangmian | charcoal浩然巾", "303B3C")
    dark_edge = cloth("Liangmian | headcloth stitched edge", "63706B")
    belt_mat = cloth("Liangmian | dark leather belt", "35352E", 0.62)
    shoe = cloth("Liangmian | black cloth shoes", "202725", 0.82)
    sole = material("Liangmian | layered sole", "474940", 0.9)
    skin = material("Liangmian | warm skin", "DFC0AB", 0.63)
    metal = material("Liangmian | muted bronze buckle", "9B895A", 0.4, 0.55)

    add_shoes((-0.105, 0.105), shoe, sole, size=0.95)
    elliptical_rings("Lean long robe with modeled vertical folds", [
        (0.105, 0.282, 0.178), (0.19, 0.286, 0.180), (0.53, 0.260, 0.166),
        (0.91, 0.220, 0.150), (1.08, 0.207, 0.145), (1.28, 0.235, 0.157),
        (1.39, 0.255, 0.160), (1.46, 0.105, 0.090),
    ], robe, 56, folds=0.024)
    band("Woven hem facing", 0.145, 0.287, 0.183, 0.045, robe_light)
    band("Narrow waist belt", 1.035, 0.218, 0.155, 0.050, belt_mat)
    box("Small bronze belt buckle", (0, -0.164, 1.035), (0.067, 0.018, 0.043), metal, 0.007)
    collars(1.475, 0.105, 0.153, inner, robe_light, lower_z=1.17)
    for side in (-1, 1):
        points = [
            ((side * 0.175, 0.0, 1.335), 0.105, 0.112),
            ((side * 0.330, -0.008, 1.19), 0.130, 0.125),
            ((side * 0.380, -0.045, 0.985), 0.120, 0.110),
        ]
        sleeve_with_cuff("Liangmian tailored sleeve", points, None, robe, robe_light, skin, 0.93)
    curve("Robe front seam", [(0.012, -0.180, 0.18), (0.008, -0.166, 0.58), (0.0, -0.153, 0.98)], 0.004, robe_light, smooth=True)

    base = 1.45
    import_textured_head(SOURCE_HEAD, base, 0.98, 1.0)
    partial_headcloth("浩然巾 open rear headcloth", base, 0.113, 0.103, 0.168, 0.238, dark, gap=0.86)
    sphere("浩然巾 soft top only", (0, 0.005, base + 0.241), (0.106, 0.094, 0.044), dark, 32, 12)
    curve("浩然巾 front stitched band", [(-0.105, -0.047, base + 0.184), (-0.065, -0.092, base + 0.180), (0, -0.105, base + 0.178), (0.065, -0.092, base + 0.180), (0.105, -0.047, base + 0.184)], 0.005, dark_edge, smooth=True)
    for side in (-1, 1):
        curve("浩然巾 side tie", [(side * 0.100, 0.050, base + 0.175), (side * 0.115, 0.068, base + 0.070), (side * 0.103, 0.076, base - 0.040)], 0.012, dark, smooth=True)
        sphere("浩然巾 tie end", (side * 0.103, 0.076, base - 0.043), (0.015, 0.010, 0.024), dark_edge, 16, 8)
    # No mesh crosses the rear-center channel: the chapter's hidden rear face remains unobstructed.


def build_miser():
    robe = cloth("Miser | heavy oxblood brocade", "713A32")
    robe_alt = cloth("Miser | bronze satin facings", "A2713F")
    inner = cloth("Miser | ochre inner collar", "D1B783")
    belt_mat = cloth("Miser | broad dark waist sash", "44382A")
    shoe = cloth("Miser | velvet shoes", "282520")
    sole = material("Miser | shoe soles", "514A3D", 0.88)
    skin = material("Miser | warm skin", "DFC0AB", 0.63)
    gold = material("Miser | old gold fittings", "C19A4A", 0.35, 0.63)
    hair = material("Miser | dark moustache", "352A25", 0.83)
    pouch_mat = cloth("Miser | money pouch umber silk", "806034")

    add_shoes((-0.13, 0.13), shoe, sole, size=1.08)
    elliptical_rings("Stout wide robe and rounded belly", [
        (0.105, 0.365, 0.232), (0.20, 0.370, 0.237), (0.55, 0.340, 0.230),
        (0.88, 0.315, 0.238, -0.010), (1.10, 0.343, 0.275, -0.018),
        (1.26, 0.325, 0.243, -0.008), (1.36, 0.310, 0.185), (1.415, 0.108, 0.088),
    ], robe, 64, folds=0.018)
    band("Broad satin hem", 0.15, 0.371, 0.240, 0.060, robe_alt)
    band("Wide money sash", 1.035, 0.348, 0.280, 0.085, belt_mat, cy=-0.012)
    box("Gold sash clasp", (0, -0.282, 1.04), (0.095, 0.022, 0.061), gold, 0.012)
    collars(1.425, 0.11, 0.178, inner, robe_alt, spread=0.12, lower_z=1.16)
    for side in (-1, 1):
        points = [
            ((side * 0.225, 0.0, 1.275), 0.120, 0.130),
            ((side * 0.400, -0.005, 1.135), 0.165, 0.155),
            ((side * 0.460, -0.055, 0.925), 0.165, 0.150),
        ]
        sleeve_with_cuff("Miser very wide sleeve", points, None, robe, robe_alt, skin, 1.06)
    for side in (-1, 1):
        for offset in (0.0, 0.065):
            x = side * (0.11 + offset)
            curve("Brocade hem cloud scroll", [(x - side * 0.05, -0.231, 0.24), (x, -0.238, 0.285), (x + side * 0.05, -0.230, 0.245), (x, -0.233, 0.220)], 0.006, robe_alt, smooth=True)

    lathe("Drawstring money pouch", [
        (0.035, 0.685), (0.090, 0.71), (0.115, 0.78), (0.095, 0.855), (0.042, 0.90), (0.038, 0.915),
    ], pouch_mat, 36, center=(0.395, -0.040, 0), closed=False, cap_ends=True)
    torus("Money pouch gathered neck", (0.395, -0.040, 0.895), 0.044, 0.010, gold, major_segments=32)
    curve("Money pouch suspension cord", [(0.29, -0.18, 1.055), (0.37, -0.12, 0.97), (0.395, -0.04, 0.91)], 0.009, belt_mat, smooth=True)
    for side in (-1, 1):
        curve("Money pouch drawstring end", [(0.395, -0.085, 0.89), (0.395 + side * 0.032, -0.10, 0.81), (0.395 + side * 0.045, -0.10, 0.77)], 0.006, gold, smooth=True)
    for x, z in ((0.37, 0.79), (0.42, 0.76), (0.40, 0.83)):
        cylinder("Pouch embroidered coin", (x, -0.145, z), 0.020, 0.006, gold, 20, 0, (math.pi / 2, 0, 0))
        box("Coin square center", (x, -0.150, z), (0.009, 0.004, 0.009), belt_mat, 0)

    base = 1.40
    import_textured_head(SOURCE_HEAD, base, 1.08, 0.97)
    cylinder("Miser round wealth cap", (0, 0.008, base + 0.236), 0.111, 0.116, belt_mat, 40, 0.014).scale.y = 0.88
    band("Wealth cap lower gold band", base + 0.188, 0.114, 0.102, 0.025, gold)
    sphere("Wealth cap soft crown", (0, 0.008, base + 0.293), (0.105, 0.091, 0.028), belt_mat, 32, 10)
    sphere("Wealth cap front gold boss", (0, -0.105, base + 0.218), (0.026, 0.010, 0.031), gold, 24, 12)
    add_moustache(base, hair, curled=True)


def build_servant():
    tunic = cloth("Servant | durable slate blue short tunic", "4D6263")
    cuffs = cloth("Servant | reinforced pale cuffs", "899795")
    pants = cloth("Servant | charcoal cotton trousers", "3B4240")
    inner = cloth("Servant | unbleached inner linen", "C8C1AA")
    belt_mat = cloth("Servant | brown waist binding", "66513A")
    shoe = cloth("Servant | work shoes", "292D2A")
    sole = material("Servant | thick work sole", "4F5148", 0.9)
    skin = material("Servant | warm skin", "DFC0AB", 0.65)
    hair = cloth("Servant | black hair and headwrap", "252B29", 0.84)

    add_shoes((-0.105, 0.105), shoe, sole, size=0.96)
    for x in (-0.105, 0.105):
        lathe("Separate tapered trouser leg", [(0.067, 0.125), (0.072, 0.20), (0.084, 0.50), (0.102, 0.83), (0.105, 0.96)], pants, 28, center=(x, 0, 0), closed=False, cap_ends=True)
        band("Trouser ankle binding", 0.175, 0.073, 0.073, 0.052, cuffs).location.x = x
    elliptical_rings("Short working tunic above knees", [
        (0.61, 0.245, 0.158), (0.68, 0.247, 0.160), (0.93, 0.211, 0.145),
        (1.06, 0.200, 0.140), (1.28, 0.226, 0.150), (1.39, 0.235, 0.148), (1.445, 0.090, 0.077),
    ], tunic, 48, folds=0.018)
    band("Short tunic hem stitching", 0.645, 0.249, 0.163, 0.030, cuffs)
    band("Practical waist belt", 1.005, 0.214, 0.153, 0.054, belt_mat)
    box("Plain belt knot", (0.035, -0.163, 1.005), (0.058, 0.026, 0.046), belt_mat, 0.009, (0, 0, 0.20))
    ribbon("Short sash end one", (0.025, -0.172, 0.99), (0.075, -0.179, 0.82), 0.032, belt_mat)
    ribbon("Short sash end two", (0.055, -0.171, 0.99), (0.018, -0.179, 0.86), 0.029, belt_mat)
    collars(1.455, 0.09, 0.145, inner, cuffs, spread=0.09, lower_z=1.20)
    for side in (-1, 1):
        tube_path("Short tunic sleeve", [
            ((side * 0.170, 0, 1.325), 0.090, 0.098),
            ((side * 0.280, -0.004, 1.19), 0.096, 0.095),
            ((side * 0.315, -0.018, 1.125), 0.090, 0.088),
        ], tunic, 28)
        frustum("Visible sewn short sleeve cuff", (side * 0.303, -0.012, 1.155), (side * 0.322, -0.022, 1.105), 0.094, 0.091, cuffs, 0.96, 28)
        frustum("Bare forearm", (side * 0.322, -0.022, 1.11), (side * 0.348, -0.045, 0.955), 0.052, 0.040, skin, 0.88, 24)
        band_obj = frustum("Wrist cloth binding", (side * 0.343, -0.041, 0.987), (side * 0.349, -0.046, 0.951), 0.045, 0.044, cuffs, 0.90, 24)
        add_hand("Servant hand", (side * 0.350, -0.048, 0.950), skin, 0.90)
    ribbon("Tucked wiping cloth", (-0.185, -0.10, 1.015), (-0.230, -0.135, 0.76), 0.070, inner)

    base = 1.45
    import_textured_head(SOURCE_HEAD, base, 0.94, 1.01)
    sphere("Servant close hair cap", (0, 0.010, base + 0.226), (0.105, 0.093, 0.059), hair, 32, 12)
    band("Servant plain headwrap", base + 0.182, 0.107, 0.096, 0.034, tunic)
    sphere("Servant small hair bun", (0, 0.038, base + 0.292), (0.054, 0.048, 0.050), hair, 24, 12)
    curve("Headwrap knot", [(-0.04, 0.089, base + 0.183), (0, 0.105, base + 0.170), (0.04, 0.089, base + 0.183)], 0.009, tunic, smooth=True)


def build_scholar():
    robe = cloth("Scholar | ivory white scholar robe", "D9D8CA")
    robe_shadow = cloth("Scholar | pearl grey robe facings", "9DA9A5")
    inner = cloth("Scholar | warm white inner silk", "EEE8D7")
    belt_mat = cloth("Scholar | muted slate sash", "657574")
    shoe = cloth("Scholar | black scholar shoes", "252A28")
    sole = material("Scholar | shoe soles", "51534C", 0.9)
    skin = material("Scholar | warm skin", "DFC0AB", 0.63)
    cap = cloth("Scholar | black儒冠 lacquered cloth", "252C2C", 0.56)
    hair = material("Scholar | dark goatee", "403B34", 0.85)
    paper = material("Scholar | rolled rice paper", "E7D9B7", 0.88)
    wood = material("Scholar | scroll rosewood rollers", "674733", 0.54)
    ink = material("Scholar | faded ink rules", "777465", 0.86)
    jade = material("Scholar | pale jade pendant", "8EB8A3", 0.28)

    add_shoes((-0.105, 0.105), shoe, sole, size=0.98)
    elliptical_rings("Long white scholar robe with vertical folds", [
        (0.105, 0.300, 0.184), (0.18, 0.305, 0.187), (0.55, 0.270, 0.168),
        (0.95, 0.219, 0.145), (1.13, 0.208, 0.145), (1.35, 0.240, 0.155),
        (1.46, 0.245, 0.155), (1.515, 0.093, 0.079),
    ], robe, 56, folds=0.022)
    band("Pearl grey hem facing", 0.145, 0.306, 0.190, 0.048, robe_shadow)
    band("Scholar waist sash", 1.085, 0.219, 0.153, 0.052, belt_mat)
    collars(1.525, 0.10, 0.148, inner, robe_shadow, spread=0.10, lower_z=1.20)
    sleeve_with_cuff("Scholar lowered left sleeve", [
        ((-0.170, 0, 1.375), 0.095, 0.110), ((-0.32, -0.015, 1.22), 0.150, 0.140), ((-0.39, -0.065, 1.005), 0.158, 0.140),
    ], None, robe, robe_shadow, skin, 0.95)
    sleeve_with_cuff("Scholar scroll holding sleeve", [
        ((0.170, 0, 1.375), 0.095, 0.110), ((0.32, -0.08, 1.26), 0.145, 0.140), ((0.325, -0.245, 1.14), 0.145, 0.130),
    ], None, robe, robe_shadow, skin, 0.95)
    sphere("Scholar jade sash pendant", (-0.075, -0.172, 0.985), (0.027, 0.012, 0.049), jade, 24, 12)
    curve("Pendant silk suspension", [(-0.075, -0.16, 1.08), (-0.075, -0.17, 1.02)], 0.005, belt_mat)

    # A true open handscroll: paper sheet, two paper rolls and projecting wooden shafts.
    box("Unrolled handscroll paper", (0.105, -0.283, 1.047), (0.292, 0.012, 0.168), paper, 0.003)
    for x in (-0.047, 0.257):
        cylinder("Rolled handscroll edge", (x, -0.283, 1.130), 0.026, 0.060, paper, 28, 0.003, (0, math.pi / 2, 0))
        cylinder("Rosewood scroll shaft", (x, -0.283, 1.130), 0.011, 0.088, wood, 24, 0.003, (0, math.pi / 2, 0))
    for x in (0.015, 0.065, 0.115, 0.165):
        curve("Subtle blank scroll guide rule", [(x, -0.291, 1.105), (x, -0.291, 1.005)], 0.0018, ink)

    base = 1.49
    import_textured_head(SOURCE_HEAD, base, 0.96, 1.02)
    band("儒冠 lower fitted band", base + 0.184, 0.108, 0.098, 0.042, cap)
    box("儒冠 tall squared crown", (0, 0.012, base + 0.256), (0.190, 0.158, 0.118), cap, 0.017)
    box("儒冠 flat upper ledge", (0, 0.012, base + 0.319), (0.204, 0.170, 0.022), cap, 0.008)
    box("儒冠 front modest inlay", (0, -0.092, base + 0.210), (0.042, 0.009, 0.031), robe_shadow, 0.005)
    for side in (-1, 1):
        ribbon("儒冠 rear ribbon", (side * 0.065, 0.088, base + 0.22), (side * 0.085, 0.105, base - 0.015), 0.032, cap)
    add_goatee(base, hair, long=False)


BUILDERS = {
    "liangmian": build_liangmian,
    "miser": build_miser,
    "servant": build_servant,
    "scholar": build_scholar,
}


def build_one(name: str, render=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    BUILDERS[name]()
    model = finish_model(name)
    model["character_role"] = name
    model["source_policy"] = "Local Blender modeling; packed local PBR head textures; no online generation"
    if name == "liangmian":
        model["rear_face_access"] = "Rear-center vertical channel open through浩然巾; no rear sealing geometry"
        model["rear_face_socket_blender_xyz"] = [0.0, 0.115, 1.58]
    glb_path = OUT_DIR / f"{name}.glb"
    export_glb(model, glb_path)

    imported = reimport_glb(glb_path)
    stats = mesh_stats(imported)
    if abs(stats["min_z"]) > 0.002:
        raise RuntimeError(f"{name}: base is not at glTF y=0 / Blender z=0: {stats['min_z']}")
    if stats["triangles"] > 60000:
        raise RuntimeError(f"{name}: triangle budget exceeded: {stats['triangles']}")
    if not imported or any(len(obj.data.materials) == 0 for obj in imported):
        raise RuntimeError(f"{name}: missing mesh or PBR material")
    height = stats["dimensions_xyz"][2]
    preview = SHOT_DIR / f"{name}-preview.png"
    if render:
        camera = setup_studio(height, height * 1.16, (2.75, -4.1, 2.35), (0, 0, height * 0.51))
        render_views(preview, camera, (2.75, -4.1, 2.35), (0, 0, height * 0.51), height * 1.20, height * 1.16, height)
    raw_glb = glb_path.read_bytes()
    json_size = struct.unpack_from("<I", raw_glb, 12)[0]
    gltf_doc = json.loads(raw_glb[20:20 + json_size])
    embedded_images = [image.get("name", f"image_{index}") for index, image in enumerate(gltf_doc.get("images", []))]
    report = {
        "name": name,
        "glb": str(glb_path),
        "bytes": glb_path.stat().st_size,
        **stats,
        "dimensions_gltf_xyz": [stats["dimensions_xyz"][0], stats["dimensions_xyz"][2], stats["dimensions_xyz"][1]],
        "preview": str(preview) if render else None,
        "four_view": str(SHOT_DIR / f"{name}-four-view.png") if render else None,
        "materials": sum(len(obj.data.materials) for obj in imported),
        "embedded_images": embedded_images,
    }
    print("ADULT_ASSET_REPORT " + json.dumps(report, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["all", *BUILDERS], default="all")
    parser.add_argument("--no-render", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    names = list(BUILDERS) if args.only == "all" else [args.only]
    reports = [build_one(name, not args.no_render) for name in names]
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = SHOT_DIR / "adult-character-report.json"
    report_path.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    print("ADULT_BUILD_COMPLETE " + json.dumps(reports, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
