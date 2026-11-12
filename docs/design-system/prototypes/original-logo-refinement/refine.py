"""Non-generative retouch of the original Cosmic Dolphin artwork.

The source is never modified. Chromatic masks isolate violet portal light from
the cyan dolphin; all operations are recorded here for reproducible iteration.
Run from the repository root with Python + Pillow + NumPy.
"""
from pathlib import Path
import base64
import io
import json
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / "apps/mobile/assets/images/icon.png"
source = Image.open(SOURCE).convert("RGB")
pixels = np.asarray(source).astype(np.float32) / 255
r, g, b = np.moveaxis(pixels, -1, 0)


def smooth(low, high, a):
    t = np.clip((a - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def blur_mask(a, radius):
    im = Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255


# The original dolphin is cyan (green > red); the portal is violet (red > green).
# White portal highlights retain a slight magenta bias, unlike the dolphin belly.
violet = smooth(0.005, 0.065, r - g) * smooth(0.015, 0.10, b - g)
ring_mask = blur_mask(violet, 1.2)
brightness = pixels.max(axis=2)
floor = np.array([0.006, 0.010, 0.045], dtype=np.float32)

# Pull down low-energy secondary trails. The bright core is retained.
# A continuous rolloff avoids a visible threshold around the remaining ring.
trail_weight = ring_mask * (1 - smooth(0.25, 0.76, brightness))
result = floor + (pixels - floor) * (1 - 0.67 * trail_weight[..., None])

# Compress the brightest portal light, rather than darkening the whole image.
# Preserve dolphin highlights, eye catchlight, face and mouth.
highlight = ring_mask * smooth(0.64, 1.0, brightness)
result *= (1 - highlight[..., None] * np.array([0.09, 0.19, 0.025]))

# Subtle saturation/colour separation in the dolphin's midtones.
cyan = smooth(0.015, 0.13, g - r) * smooth(0.08, 0.22, b - r)
midtones = smooth(0.10, 0.30, brightness) * (1 - smooth(0.78, 1, brightness))
dolphin_mask = blur_mask(cyan * midtones, 1)
result[..., 0] *= 1 - 0.035 * dolphin_mask
result[..., 1] *= 1 + 0.025 * dolphin_mask
result[..., 2] *= 1 + 0.018 * dolphin_mask
retouched = Image.fromarray(np.uint8(np.clip(result, 0, 1) * 255))

# Sharpen only the dolphin, never the glowing trail textures.
sharp = np.asarray(retouched.filter(ImageFilter.UnsharpMask(radius=1.7, percent=85, threshold=4))).astype(float)
base = np.asarray(retouched).astype(float)
mix = (blur_mask(cyan, 1.5) * 0.55)[..., None]
retouched = Image.fromarray(np.uint8(np.clip(base * (1 - mix) + sharp * mix, 0, 255)))
retouched.save(OUT / "cosmic-dolphin-refined-1024.png", optimize=True)

# Compact artwork: same dolphin, a closer crop, less portal texture. Blur only
# the violet mask before downsampling, keeping its expression and fins intact.
compact_pixels = np.asarray(retouched).astype(float)
soft = np.asarray(retouched.filter(ImageFilter.GaussianBlur(3.2))).astype(float)
compact_pixels = compact_pixels * (1 - 0.62 * ring_mask[..., None]) + soft * (0.62 * ring_mask[..., None])
compact = Image.fromarray(np.uint8(np.clip(compact_pixels, 0, 255)))
compact = compact.crop((96, 96, 928, 928))

# Keep the compact export square for platform masking. The review applies its
# rounded contour in CSS. The full-size primary retains the original framing.
compact = compact.resize((512, 512), Image.Resampling.LANCZOS)
compact = compact.filter(ImageFilter.UnsharpMask(radius=0.65, percent=85, threshold=3))
compact.save(OUT / "cosmic-dolphin-compact-512.png", optimize=True)
for size in (16, 24, 32, 48, 64, 128, 192, 256):
    im = compact.resize((size, size), Image.Resampling.LANCZOS)
    im.save(OUT / f"cosmic-dolphin-{size}.png", optimize=True)

# A raster lockup is ready to review/share. It intentionally embeds no font file.
# Avenir Next is system-provided here; use a licensed font for editable deployment.
wordmark = Image.new("RGB", (1800, 560), (6, 9, 26))
art = retouched.resize((440, 440), Image.Resampling.LANCZOS)
rounded = Image.new("L", (440, 440), 0)
ImageDraw.Draw(rounded).rounded_rectangle((0, 0, 439, 439), radius=99, fill=255)
wordmark.paste(art, (65, 60), rounded)
draw = ImageDraw.Draw(wordmark)
font = ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', 134, index=2)


def tracked_text(text, x, y, color):
    for letter in text:
        draw.text((x, y), letter, font=font, fill=color, anchor='ls')
        x += draw.textlength(letter, font=font) - 5
    return x


x = tracked_text('cosmic', 560, 326, (243, 243, 255))
tracked_text('dolphin', x + 33, 326, (170, 181, 212))
wordmark.save(OUT / 'cosmic-dolphin-wordmark.png', optimize=True)


def data_uri(im):
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


template = (OUT / "review.template.html").read_text()
template = template.replace("__ORIGINAL__", data_uri(source))
template = template.replace("__REFINED__", data_uri(retouched))
template = template.replace("__COMPACT__", data_uri(compact))
template = template.replace("__WORDMARK__", data_uri(wordmark))
(OUT / "index.html").write_text(template)
print(json.dumps({"source": str(SOURCE), "review": str(OUT / "index.html"), "primary": str(OUT / "cosmic-dolphin-refined-1024.png"), "compact": str(OUT / "cosmic-dolphin-compact-512.png")}, indent=2))
