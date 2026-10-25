"""Five high-detail regional trees for distinct kingdom silhouettes (local, offline)."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from botanical_common import LeafBatch, radial_roots, smooth_path, tapered_tube
from common import export_glb, finish_model, material, mesh_stats, reimport_glb, render_views, setup_studio

CONFIGS = {
    "stern_cypress": dict(seed=301, branches=12, leaves=185, height=5.8, spread=0.82, trunk=0.22, lean=0.10,
                          colors=["263D31", "3E5140", "68705A", "899074"], leaf=[0.18, 0.31], width=[0.035, 0.070], narrow=True),
    "amber_tree": dict(seed=401, branches=9, leaves=230, height=5.1, spread=1.65, trunk=0.38, lean=0.42,
                       colors=["6A4527", "995B2F", "C1833F", "D6A95B"], leaf=[0.23, 0.39], width=[0.10, 0.17], narrow=False),
    "scholar_oak": dict(seed=501, branches=12, leaves=250, height=5.4, spread=1.85, trunk=0.34, lean=0.28,
                        colors=["385848", "58745B", "809578", "A5B297"], leaf=[0.24, 0.40], width=[0.11, 0.18], narrow=False),
    "fairy_tree": dict(seed=601, branches=11, leaves=225, height=5.7, spread=1.55, trunk=0.25, lean=0.52,
                       colors=["805A68", "B57D8D", "D8A6B2", "EAC8CE"], leaf=[0.21, 0.36], width=[0.075, 0.14], narrow=False),
}


def build_broadleaf(name):
    cfg = CONFIGS[name]
    rng = random.Random(cfg["seed"])
    bark = material(f"{name} | fissured bark", "554334", 0.94)
    ridge = material(f"{name} | raised bark", "80664B", 0.91)
    leaves = [material(f"{name} | leaf {i}", color, 0.90) for i, color in enumerate(cfg["colors"])]
    height, spread, lean = cfg["height"], cfg["spread"], cfg["lean"]
    controls = [(0, 0, 0), (0.04, 0, height * 0.14), (-lean * 0.35, 0.04, height * 0.34),
                (lean * 0.32, -0.05, height * 0.55), (lean * 0.68, 0.08, height * 0.77), (lean, 0.04, height * 0.96)]
    radii = [cfg["trunk"], cfg["trunk"] * 0.84, cfg["trunk"] * 0.66, cfg["trunk"] * 0.44, cfg["trunk"] * 0.24, 0.025]
    trunk, widths = smooth_path(controls, radii, 4)
    tapered_tube("Continuous regional trunk", trunk, widths, bark, 12, irregularity=0.11)
    radial_roots(bark, cfg["trunk"] * 2.7, 8, cfg["seed"])
    for i in range(7):
        angle = math.tau * i / 7
        ridge_points = [p + Vector((math.cos(angle) * r * 0.90, math.sin(angle) * r * 0.90, 0)) for p, r in zip(trunk[:-3], widths[:-3])]
        tapered_tube("Raised bark ribbon", ridge_points, [0.012] * len(ridge_points), ridge, 5)
    foliage = LeafBatch()
    crowns = []
    for index in range(cfg["branches"]):
        t = index / max(1, cfg["branches"] - 1)
        z = height * (0.36 + 0.56 * t)
        angle = index * 2.399 + rng.uniform(-0.25, 0.25)
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        start = min(trunk, key=lambda p: abs(p.z - z)).copy()
        if cfg["narrow"]:
            length = spread * (1.10 - 0.64 * t) * rng.uniform(0.85, 1.12)
            rise = height * 0.10
        else:
            length = spread * (0.80 + 0.25 * math.sin(t * math.pi)) * rng.uniform(0.82, 1.10)
            rise = height * rng.uniform(0.07, 0.15)
        end = start + radial * length + Vector((0, 0, rise))
        points, widths = smooth_path([start, start + radial * length * 0.38 + Vector((0, 0, -0.06)), start + radial * length * 0.75 + Vector((0, 0, rise * 0.45)), end],
                                     [cfg["trunk"] * 0.34, cfg["trunk"] * 0.22, 0.035, 0.009], 4)
        tapered_tube("Sweeping leafy bough", points, widths, bark, 8, irregularity=0.08)
        crowns.append((end, angle, t, length))
    crowns.append((Vector((lean, 0.04, height)), 0.3, 1.0, spread * 0.55))
    for center, angle, t, length in crowns:
        if cfg["narrow"]:
            rx, ry, rz = 0.45 + length * 0.22, 0.42 + length * 0.18, 0.54
        else:
            rx, ry, rz = 0.68 + length * 0.28, 0.60 + length * 0.23, 0.46 + length * 0.08
        for leaf in range(cfg["leaves"]):
            theta = rng.uniform(0, math.tau)
            u = rng.uniform(-1, 1)
            radius = rng.random() ** 0.38
            ring = math.sqrt(1 - u * u)
            local = Vector((rx * radius * ring * math.cos(theta), ry * radius * ring * math.sin(theta), rz * radius * u))
            base = center + local
            direction = Vector((local.x / rx, local.y / ry, rng.uniform(0.15, 0.85))).normalized()
            direction += Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), rng.uniform(-0.12, 0.22)))
            direction.normalize()
            leaf_length = rng.uniform(*cfg["leaf"])
            palette = [1, 1, 2, 2, 3] if radius > 0.70 else [0, 1, 1, 2]
            foliage.add(base, base + direction * leaf_length, rng.uniform(*cfg["width"]), direction.cross(Vector((0, 0, 1))), rng.choice(palette), detailed=True, curl=0.025)
    foliage.finish(f"{name} | individually folded leaves", leaves)


def build_sky_palm():
    rng = random.Random(701)
    bark = material("Sky palm | ringed umber bark", "69513B", 0.91)
    ridge = material("Sky palm | pale trunk rings", "9B805B", 0.88)
    greens = [material(f"Sky palm | frond {i}", c, 0.88) for i, c in enumerate(["315C4D", "477865", "72A086", "A2BDA0"])]
    controls = [(0, 0, 0), (0.08, 0.02, 0.8), (-0.10, 0.06, 1.8), (-0.36, 0.10, 3.0), (-0.62, 0.15, 4.3), (-0.55, 0.18, 5.7), (-0.25, 0.18, 6.5)]
    trunk, widths = smooth_path(controls, [0.27, 0.25, 0.22, 0.19, 0.16, 0.13, 0.10], 4)
    tapered_tube("Bent towering palm trunk", trunk, widths, bark, 12, irregularity=0.05)
    radial_roots(bark, 0.72, 8, 702)
    for i in range(28):
        z = 0.25 + i * 0.205
        closest = min(range(len(trunk)), key=lambda i: abs(trunk[i].z - z))
        p = trunk[closest]
        r = widths[closest] * 1.04
        points = [p + Vector((math.cos(math.tau * j / 24) * r, math.sin(math.tau * j / 24) * r, 0)) for j in range(25)]
        tapered_tube("Palm trunk growth ring", points, [0.018] * len(points), ridge, 5)
    foliage = LeafBatch()
    crown = Vector(controls[-1])
    for frond in range(15):
        angle = math.tau * frond / 15 + rng.uniform(-0.12, 0.12)
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        tangent = Vector((-math.sin(angle), math.cos(angle), 0))
        length = rng.uniform(1.65, 2.30)
        rise = 0.60 if frond % 3 else 1.05
        controls = [crown, crown + radial * length * 0.30 + Vector((0, 0, rise)), crown + radial * length * 0.74 + Vector((0, 0, rise * 0.45)), crown + radial * length + Vector((0, 0, -0.40))]
        points, widths = smooth_path(controls, [0.035, 0.026, 0.016, 0.004], 5)
        tapered_tube("Arched palm frond rib", points, widths, greens[1], 6)
        for step in range(2, 16):
            t = step / 16
            pos = min(points, key=lambda p: abs((p - crown).length - length * t * 0.72))
            for side in (-1, 1):
                leaflet_length = (0.34 + 0.50 * math.sin(t * math.pi)) * rng.uniform(0.88, 1.14)
                end = pos + tangent * side * leaflet_length + radial * 0.20 + Vector((0, 0, -0.18 - 0.16 * t))
                foliage.add(pos, end, 0.075 + 0.035 * math.sin(t * math.pi), radial, rng.choice([0, 1, 1, 2, 2, 3]), detailed=True, curl=0.035)
    foliage.finish("Sky palm | folded individual leaflets", greens)


ASSETS = {
    "sky_palm": dict(builder=build_sky_palm, height=7.2),
    "stern_cypress": dict(builder=lambda: build_broadleaf("stern_cypress"), height=6.2),
    "amber_tree": dict(builder=lambda: build_broadleaf("amber_tree"), height=5.5),
    "scholar_oak": dict(builder=lambda: build_broadleaf("scholar_oak"), height=5.8),
    "fairy_tree": dict(builder=lambda: build_broadleaf("fairy_tree"), height=6.1),
}


def build_one(name, render=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ASSETS[name]["builder"]()
    model = finish_model(name)
    path = ROOT / "assets" / "source-models" / "props" / f"{name}.glb"
    export_glb(model, path)
    stats = mesh_stats(reimport_glb(path))
    if abs(stats["min_z"]) > 0.002:
        raise RuntimeError(f"{name}: invalid ground alignment {stats['min_z']}")
    preview = ROOT / "shots" / "regional-trees" / f"{name}-preview.png"
    if render:
        height = stats["dimensions_xyz"][2]
        target = (0, 0, height * 0.50)
        camera = setup_studio(height, height * 1.18, (height * 1.25, -height * 1.8, height), target)
        render_views(preview, camera, (height * 1.25, -height * 1.8, height), target, height * 1.22, height * 1.18, height)
    report = {"name": name, "bytes": path.stat().st_size, **stats, "preview": str(preview) if render else None}
    print("REGIONAL_TREE " + json.dumps(report), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["all", *ASSETS], default="all")
    parser.add_argument("--no-render", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    for name in (list(ASSETS) if args.only == "all" else [args.only]):
        build_one(name, not args.no_render)


if __name__ == "__main__":
    main()
