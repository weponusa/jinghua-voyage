"""Build five local, metre-scale spatial landmarks and validate the exported GLBs."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from common import export_glb, finish_model, mesh_stats, reimport_glb, render_views, setup_studio
from cloud_gate import build_cloud_gate
from twin_screen import build_twin_screen
from banquet_house import build_banquet_house
from academy_hall import build_academy_hall
from library_tower import build_library_tower


ASSETS = {
    "cloud_gate": dict(builder=build_cloud_gate, dimensions=(7.0, None, 6.0), height=6.0, hero=(8.5, -13.0, 8.0), target=(0, 0, 2.9), scale=9.2, front=8.2),
    "twin_screen": dict(builder=build_twin_screen, dimensions=(7.0, None, 4.5), height=4.5, hero=(8.5, -13.0, 7.2), target=(0, 0, 2.15), scale=9.0, front=8.2),
    "banquet_house": dict(builder=build_banquet_house, dimensions=(9.0, 6.0, 5.5), height=5.5, hero=(11.5, -15.5, 10.0), target=(0, 0, 2.35), scale=12.0, front=11.0),
    "academy_hall": dict(builder=build_academy_hall, dimensions=(10.0, 6.0, 5.0), height=5.0, hero=(12.5, -16.5, 9.0), target=(0, 0, 2.25), scale=12.8, front=11.8),
    "library_tower": dict(builder=build_library_tower, dimensions=(7.0, 5.0, 7.0), height=7.0, hero=(10.0, -14.0, 11.0), target=(0, 0, 3.35), scale=10.2, front=9.2),
}


def fit_dimensions(obj, targets):
    bounds = [Vector(corner) for corner in obj.bound_box]
    low = [min(v[i] for v in bounds) for i in range(3)]
    high = [max(v[i] for v in bounds) for i in range(3)]
    scales = [targets[i] / (high[i] - low[i]) if targets[i] else 1.0 for i in range(3)]
    for vertex in obj.data.vertices:
        for i in range(3):
            vertex.co[i] *= scales[i]
    obj.data.update()


def build_one(name, render=True):
    cfg = ASSETS[name]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cfg["builder"]()
    model = finish_model(name)
    fit_dimensions(model, cfg["dimensions"])
    path = ROOT / "assets" / "source-models" / "props" / f"{name}.glb"
    export_glb(model, path)
    imported = reimport_glb(path)
    stats = mesh_stats(imported)
    if abs(stats["min_z"]) > 0.002:
        raise RuntimeError(f"{name}: base is not at exported y=0: {stats['min_z']}")
    for axis, target in enumerate(cfg["dimensions"]):
        if target and abs(stats["dimensions_xyz"][axis] - target) > 0.015:
            raise RuntimeError(f"{name}: dimension {axis}={stats['dimensions_xyz'][axis]} expected {target}")
    preview = ROOT / "shots" / "spatial-landmarks" / f"{name}-preview.png"
    if render:
        camera = setup_studio(cfg["height"], cfg["front"], cfg["hero"], cfg["target"])
        render_views(preview, camera, cfg["hero"], cfg["target"], cfg["scale"], cfg["front"], cfg["height"])
    report = {
        "name": name,
        "source_glb": str(path),
        "source_bytes": path.stat().st_size,
        "vertices": stats["vertices"],
        "triangles": stats["triangles"],
        "dimensions_xyz_m": [round(v, 3) for v in stats["dimensions_xyz"]],
        "min_z": round(stats["min_z"], 5),
        "materials": sum(len(obj.data.materials) for obj in imported),
        "preview": str(preview) if render else None,
    }
    print("LANDMARK_REPORT " + json.dumps(report, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["all", *ASSETS], default="all")
    parser.add_argument("--no-render", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    names = list(ASSETS) if args.only == "all" else [args.only]
    reports = [build_one(name, not args.no_render) for name in names]
    print("LANDMARKS_COMPLETE " + json.dumps(reports, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
