"""Build and validate the three local hand-modeled botanical assets."""
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
from chinese_pine import build_chinese_pine
from willow import build_willow
from bamboo import build_bamboo


ASSETS = {
    "chinese_pine": {"builder": build_chinese_pine, "height": 5.7, "hero_location": (7.5, -10.5, 6.4), "target": (0, 0, 2.75), "hero_scale": 6.65, "front_scale": 6.35},
    "willow": {"builder": build_willow, "height": 5.1, "hero_location": (7.2, -10.0, 6.0), "target": (0, 0, 2.50), "hero_scale": 6.35, "front_scale": 6.1},
    "bamboo": {"builder": build_bamboo, "height": 4.7, "hero_location": (5.4, -7.5, 4.8), "target": (0, 0, 2.25), "hero_scale": 5.55, "front_scale": 5.3},
}


def build_one(name, render=True):
    config = ASSETS[name]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    config["builder"]()
    model = finish_model(name)
    path = ROOT / "assets" / "source-models" / "props" / f"{name}.glb"
    export_glb(model, path)
    imported = reimport_glb(path)
    stats = mesh_stats(imported)
    if abs(stats["min_z"]) > 0.002:
        raise RuntimeError(f"{name}: plant base is not at glTF y=0")
    if render:
        camera = setup_studio(config["height"], config["front_scale"], config["hero_location"], config["target"])
        preview = ROOT / "shots" / "models" / f"{name}-preview.png"
        render_views(preview, camera, config["hero_location"], config["target"], config["hero_scale"], config["front_scale"], config["height"])
    report = {"name": name, "glb": str(path), "bytes": path.stat().st_size, **stats, "preview": str(ROOT / "shots" / "models" / f"{name}-preview.png") if render else None}
    print("PLANT_REPORT " + json.dumps(report, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["all", *ASSETS], default="all")
    parser.add_argument("--no-render", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    names = list(ASSETS) if args.only == "all" else [args.only]
    reports = [build_one(name, not args.no_render) for name in names]
    print("PLANTS_COMPLETE " + json.dumps(reports, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
