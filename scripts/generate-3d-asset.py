#!/usr/bin/env python3
"""Run the installed WorkBuddy image/text-to-3D generator and download one asset."""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import requests

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = Path("/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/buddy-multimodal-generation/scripts/buddy-multimodal-generation.py")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("--category", choices=["chars", "props"], required=True)
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--prompt", default="")
    parser.add_argument("--faces", type=int, default=60000)
    parser.add_argument("--token", required=True)
    args = parser.parse_args()
    if not GENERATOR.is_file():
        raise SystemExit("Installed 3D generator was not found")
    command = [sys.executable, str(GENERATOR), "3d"]
    if args.prompt:
        command.append(args.prompt)
    if args.reference:
        command += ["--image-base64", base64.b64encode(args.reference.read_bytes()).decode("ascii")]
    command += ["--enable-pbr", "--face-count", str(args.faces), "--token", args.token]
    result = subprocess.run(command, text=True, capture_output=True, timeout=900)
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    if result.returncode:
        print(result.stdout, file=sys.stderr, end="")
        raise SystemExit(result.returncode)
    payload = json.loads(result.stdout)
    if payload.get("status") != "DONE":
        raise SystemExit(f"Generation did not finish: {payload.get('status')}")
    files = payload.get("raw_result", {}).get("ResultFile3Ds", [])
    glb = next((item for item in files if item.get("Type") == "GLB"), None)
    if not glb:
        raise SystemExit("Generation finished without a GLB")
    destination = ROOT / "assets" / "source-models" / args.category / f"{args.name}.glb"
    preview = ROOT / "shots" / "models" / f"{args.name}-preview.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.parent.mkdir(parents=True, exist_ok=True)
    for url, path in [(glb["Url"], destination), (glb.get("PreviewImageUrl"), preview)]:
        if not url:
            continue
        response = requests.get(url, timeout=180)
        response.raise_for_status()
        path.write_bytes(response.content)
    print(json.dumps({"name": args.name, "glb": str(destination), "preview": str(preview), "bytes": destination.stat().st_size}, ensure_ascii=False))

if __name__ == "__main__":
    main()
