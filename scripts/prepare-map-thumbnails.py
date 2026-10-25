from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
INTERFACE = ROOT / "public" / "interface"
HUB_SOURCE = ROOT / "assets" / "generated-2026-10-25" / "interface" / "map-hub-clean.png"
MAP_IDS = ["hub", "junzi", "daren", "liangmian", "wuchang", "baimin", "heichi", "penglai"]


def save_webp(image: Image.Image, path: Path, quality: int) -> None:
    image.convert("RGB").save(path, "WEBP", quality=quality, method=6)


# The generator returned 704px width. Match the real 14:30 navigation bounds exactly.
hub = Image.open(HUB_SOURCE).convert("RGB").resize((716, 1536), Image.Resampling.LANCZOS)
save_webp(hub, INTERFACE / "map-hub.webp", 90)

for map_id in MAP_IDS:
    source = Image.open(INTERFACE / f"map-{map_id}.webp").convert("RGB")
    # Dedicated HUD assets: quieter colour and simplified fine detail, not a browser-side shrink.
    size = (112, 240) if map_id == "hub" else (256, 256)
    thumb = source.resize(size, Image.Resampling.LANCZOS)
    thumb = ImageEnhance.Color(thumb).enhance(0.90)
    thumb = ImageEnhance.Contrast(thumb).enhance(1.07)
    thumb = thumb.filter(ImageFilter.UnsharpMask(radius=0.7, percent=75, threshold=4))
    save_webp(thumb, INTERFACE / f"mini-{map_id}.webp", 84)
    print(f"{map_id}: {source.size} -> {thumb.size}")
