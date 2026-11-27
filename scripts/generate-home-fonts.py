"""Freeze the web Source Serif optical sizes for React Native, which lacks CSS opsz.
Run: uv run --with fonttools==4.60.1 --with brotli==1.1.0 scripts/generate-home-fonts.py
Requires a web dev/build output; selects its normal Latin Source Serif 4 subset.
"""
import hashlib
import json
from io import BytesIO
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent
candidates = []
for path in [*(root / "apps/web/.next/static/media").glob("*.woff2"),
             *(root / "apps/web/.next/dev/static/media").glob("*.woff2")]:
    font = TTFont(path)
    if font["name"].getDebugName(1) == "Source Serif 4" and not font["head"].macStyle & 2:
        cmap = font.getBestCmap()
        if all(code in cmap for code in (65, 97, 8212, 8217)):
            candidates.append(path)
if not candidates:
    raise SystemExit("Build/start web first: no normal Latin Source Serif 4 subset found")
# Latin core is the smallest normal subset carrying the Latin and punctuation probes.
source = min(candidates, key=lambda p: p.stat().st_size)
out = root / "apps/mobile/assets/fonts"
records = []
# Include the cuts used at iOS XXXL (23/17 scaling). Font size itself stays
# native-scalable; these files supply the corresponding optical shapes.
for size in (16, 17, 19, 20, 22, 23, 26, 27, 28, 34, 38, 46):
    font = TTFont(source)
    font = instantiateVariableFont(font, {"wght": 600, "opsz": size}, inplace=True)
    family = f"CosmicReading{size}"
    for record in font["name"].names:
        if record.nameID in (1, 3, 4, 6, 16):
            record.string = family.encode(record.getEncoding())
        elif record.nameID in (2, 17):
            record.string = "Regular".encode(record.getEncoding())
    font.flavor = None
    # Unique family per instance. Avoid synthetic weight selection by native font APIs.
    font["OS/2"].usWeightClass = 400
    font["OS/2"].fsSelection &= ~(1 << 5)
    font["OS/2"].fsSelection |= 1 << 6
    font["head"].macStyle &= ~1
    path = out / f"{family}.ttf"
    font.recalcTimestamp = False
    buffer = BytesIO()
    font.save(buffer)
    candidate = TTFont(BytesIO(buffer.getvalue()))
    unchanged = False
    if path.exists():
        previous = TTFont(path)
        # Compare compiled glyph/metrics/name tables; ignore only timestamps
        # and the checksum that incorporates them, preserving unchanged cuts.
        ignored = {"checkSumAdjustment", "created", "modified"}
        head = lambda f: {k: v for k, v in f["head"].__dict__.items() if k not in ignored}
        unchanged = head(candidate) == head(previous) and all(
            candidate.getTableData(key) == previous.getTableData(key)
            for key in candidate.keys() if key not in ("GlyphOrder", "head"))
    if not unchanged:
        path.write_bytes(buffer.getvalue())
    records.append({"file": path.name, "weightAxis": 600, "opticalSize": size,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
(out / "web-home-fonts.json").write_text(json.dumps({
    "source": "Source Serif 4, web normal Latin subset, SIL OFL (see LICENSES.txt)",
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "toolchain": {"fonttools": "4.60.1", "brotli": "1.1.0"}, "instances": records,
}, indent=2) + "\n")
print(f"Generated {len(records)} optical-size instances from {source.name}")
