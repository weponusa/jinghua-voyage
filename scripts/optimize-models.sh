#!/usr/bin/env bash
# Build web-ready models from generated source GLBs.
# Output uses WebP textures and meshopt geometry, decoded by three's MeshoptDecoder.
set -euo pipefail
cd "$(dirname "$0")/.."
GT="npx -y @gltf-transform/cli@4"
for src in assets/source-models/*/*.glb; do
  rel="${src#assets/source-models/}"
  out="assets/models/$rel"
  mkdir -p "$(dirname "$out")"
  if [[ -f "$out" && "$out" -nt "$src" ]]; then continue; fi
  size=512
  [[ "$rel" == chars/* || "$rel" == props/junk_ship.glb || "$rel" == props/pavilion.glb || "$rel" == props/paifang.glb || "$rel" == props/market_stall.glb || "$rel" == props/house.glb || "$rel" == props/mirror_terrace.glb ]] && size=1024
  palette=true
  # Liangmian recolours named robe materials per NPC; a merged palette would erase those names.
  [[ "$rel" == chars/liangmian.glb ]] && palette=false
  echo "optimize $rel (${size}px, palette=$palette)"
  $GT optimize "$src" "$out" --compress meshopt --texture-compress webp --texture-size "$size" --simplify false --palette "$palette" >/dev/null
done
ls -la assets/models/chars assets/models/props 2>/dev/null || true
