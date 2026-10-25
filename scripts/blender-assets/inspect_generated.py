"""Offline four-view inspection for newly generated GLBs; never replaces the source model."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "blender-assets"))
from common import mesh_stats, reimport_glb, render_views  # noqa: E402
from characters_figures import reset_scene, setup_studio  # noqa: E402


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1:]
    source = Path(args[0]).resolve()
    out = Path(args[1]).resolve()
    name = source.stem
    out.mkdir(parents=True, exist_ok=True)
    reset_scene()
    objects = reimport_glb(source)
    stats = mesh_stats(objects)
    bounds = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = [min(v[i] for v in bounds) for i in range(3)]
    high = [max(v[i] for v in bounds) for i in range(3)]
    height = high[2] - low[2]
    center = [(low[i] + high[i]) / 2 for i in range(3)]
    camera = setup_studio(height)
    preview = out / f"{name}-preview.png"
    render_views(
        preview,
        camera,
        (center[0] + height * 1.3, center[1] - height * 3.2, center[2] + height * .55),
        (center[0], center[1], center[2]),
        height * 1.15,
        height * 1.15,
        height,
    )
    stats.update({"source": str(source), "preview": str(preview), "four_view": str(out / f"{name}-four-view.png")})
    (out / f"{name}-inspection.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
