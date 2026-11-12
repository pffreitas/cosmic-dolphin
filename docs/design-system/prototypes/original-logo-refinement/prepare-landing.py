"""Export the reviewed identity at web-appropriate sizes; preserve source artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[3] / 'apps/web/public/images/landing/brand'
OUT.mkdir(parents=True, exist_ok=True)
Image.open(HERE / 'cosmic-dolphin-compact-512.png').resize((128, 128), Image.Resampling.LANCZOS).save(OUT / 'compact.webp', quality=95, method=6)
font = ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', 134, index=2)
# Light lettering only: the landing shows the wordmark on --cd-brand-ground.
for theme, primary, secondary in [
    ('dark', (243, 243, 255), (170, 181, 212)),
]:
    image = Image.new('RGBA', (1100, 180))
    draw = ImageDraw.Draw(image)
    x = 0
    for word, color in [('cosmic', primary), ('dolphin', secondary)]:
        for letter in word:
            draw.text((x, 132), letter, font=font, fill=(*color, 255), anchor='ls')
            x += draw.textlength(letter, font=font) - 5
        x += 33
    left, top, right, bottom = image.getbbox()
    image = image.crop((left - 4, top - 4, right + 4, bottom + 4))
    image.save(OUT / f'wordmark-{theme}.webp', lossless=True, method=6)
print(f'Exported landing-page identity to {OUT}')
