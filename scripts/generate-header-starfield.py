#!/usr/bin/env python3
"""Crop the existing Meshy artwork into identical compact masthead plates."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/header-starfield/starfield-source.png'
SIZE = (1600, 480)
plate = ImageOps.fit(Image.open(SOURCE).convert('RGB'), SIZE, centering=(0.5, 0.4))
outputs = []
for folder in [ROOT / 'apps/mobile/assets/images', ROOT / 'apps/web/public/images']:
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / 'header-starfield.webp'
    plate.save(output, quality=88, method=6)
    outputs.append(output)
    # This task's rejected feathered-edge asset is no longer consumed.
    (folder / 'header-starfield-mask.png').unlink(missing_ok=True)
manifest = {
    'source': str(SOURCE.relative_to(ROOT)),
    'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'size': SIZE,
    'composition': 'opaque dark masthead with semantic 24px bottom corners; flat reading surface',
    'outputs': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs},
}
(ROOT / 'assets/header-starfield/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'size': SIZE, 'outputs': list(manifest['outputs'])}))
