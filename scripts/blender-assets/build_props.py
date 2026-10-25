"""Reproducible local build: Blender --background --python build_props.py -- --only all."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from common import export_glb, finish_model, mesh_stats, reimport_glb, render_views, setup_studio
from food_stove import build_food_stove
from riddle_rack import build_riddle_rack
from arch_bridge import build_arch_bridge


ASSETS = {
    "food_stove": {
        "builder": build_food_stove,
        "height": 1.48,
        "hero_location": (2.5, -3.5, 2.25),
        "target": (0, 0, 0.76),
        "hero_scale": 1.95,
        "front_scale": 1.85,
    },
    "riddle_rack": {
        "builder": build_riddle_rack,
        "height": 3.0,
        "hero_location": (4.0, -7.0, 3.7),
        "target": (0, 0, 1.48),
        "hero_scale": 3.72,
        "front_scale": 3.55,
    },
    "arch_bridge": {
        "builder": build_arch_bridge,
        "height": 2.5,
        "hero_location": (8.2, -11.5, 6.0),
        "target": (0, 0, 0.85),
        "hero_scale": 10.9,
        "front_scale": 10.2,
    },
}


def build_one(name, render=True):
    config = ASSETS[name]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    config["builder"]()
    model = finish_model(name)
    glb_path = ROOT / "assets" / "source-models" / "props" / f"{name}.glb"
    export_glb(model, glb_path)

    # Validate the actual deliverable, not merely the pre-export Blender scene.
    imported = reimport_glb(glb_path)
    stats = mesh_stats(imported)
    if abs(stats["min_z"]) > 0.002:
        raise RuntimeError(f"{name}: expected base at y=0 after glTF conversion, got Blender z={stats['min_z']}")
    if name == "arch_bridge" and not 8.95 <= stats["dimensions_xyz"][0] <= 9.05:
        raise RuntimeError(f"Bridge length outside specification: {stats['dimensions_xyz'][0]}")
    if name == "riddle_rack" and not 2.9 <= stats["dimensions_xyz"][2] <= 3.1:
        raise RuntimeError(f"Rack height outside specification: {stats['dimensions_xyz'][2]}")
    if name == "food_stove" and not 1.35 <= stats["dimensions_xyz"][2] <= 1.60:
        raise RuntimeError(f"Stove height outside specification: {stats['dimensions_xyz'][2]}")
    if render:
        camera = setup_studio(config["height"], config["front_scale"], config["hero_location"], config["target"])
        preview = ROOT / "shots" / "models" / f"{name}-preview.png"
        render_views(preview, camera, config["hero_location"], config["target"], config["hero_scale"], config["front_scale"], config["height"])
    report = {
        "name": name,
        "glb": str(glb_path),
        "bytes": glb_path.stat().st_size,
        **stats,
        "preview": str(ROOT / "shots" / "models" / f"{name}-preview.png") if render else None,
    }
    print("ASSET_REPORT " + json.dumps(report, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["all", *ASSETS], default="all")
    parser.add_argument("--no-render", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    names = list(ASSETS) if args.only == "all" else [args.only]
    reports = [build_one(name, not args.no_render) for name in names]
    print("BUILD_COMPLETE " + json.dumps(reports, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
