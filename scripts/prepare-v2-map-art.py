from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shots" / "map-reference-2026-10-25"
OUT = ROOT / "public" / "interface"
TINTS = {
    "shushi": (214, 211, 190),
    "qishe": (235, 205, 164),
    "nver": (226, 207, 202),
}

for map_id, tint in TINTS.items():
    source = Image.open(SOURCE / f"{map_id}.png").convert("RGB")
    # Keep the real north-up geometry and full-map coordinates. Only the paint treatment changes.
    painted = source.filter(ImageFilter.GaussianBlur(0.45))
    painted = ImageEnhance.Color(painted).enhance(0.78)
    painted = ImageEnhance.Contrast(painted).enhance(0.94)
    wash = Image.new("RGB", painted.size, tint)
    painted = Image.blend(painted, wash, 0.09)
    painted = painted.filter(ImageFilter.UnsharpMask(radius=1.2, percent=48, threshold=5))
    painted.save(OUT / f"map-{map_id}.webp", "WEBP", quality=91, method=6)

    mini = painted.resize((256, 256), Image.Resampling.LANCZOS)
    mini = ImageEnhance.Contrast(mini).enhance(1.05)
    mini.save(OUT / f"mini-{map_id}.webp", "WEBP", quality=85, method=6)
    print(f"{map_id}: real {source.size} -> painted map + 256px HUD thumbnail")
