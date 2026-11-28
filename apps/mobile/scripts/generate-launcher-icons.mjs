import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const mobile = join(repo, "apps/mobile");
const source = join(repo, "docs/design-system/logo-study/ring-gargantua");
const images = join(mobile, "assets/images");
const ios = join(mobile, "ios/CosmicDolphin/Images.xcassets/AppIcon.appiconset");
const android = join(mobile, "android/app/src/main/res");
const { color: { light: palette } } = JSON.parse(await readFile(join(repo, "docs/design-system/tokens.json"), "utf8"));

const size = 1024;
const background = await sharp(Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="plum" x2="1" y2="1">
      <stop stop-color="${palette["brand-plum"]}"/>
      <stop offset=".48" stop-color="${palette["brand-mid"]}"/>
      <stop offset="1" stop-color="${palette["brand-black"]}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#plum)"/>
  </svg>`)).removeAlpha().png().toBuffer();

async function mark(variant, width) {
  return sharp(join(source, `gargantua-${variant}.svg`), { density: 144 })
    .resize(width).png().toBuffer();
}

async function foreground(variant, width) {
  const ink = await mark(variant, width);
  return sharp({ create: { width: size, height: size, channels: 4, background: "transparent" } })
    .composite([{ input: ink, gravity: "centre" }]).png().toBuffer();
}

const icon = await sharp(background).composite([{ input: await mark("colour", 800), gravity: "centre" }])
  .removeAlpha().png().toBuffer();
// The Android layers are 108 dp. A 528 px frame leaves the actual ink inside the central 66 dp.
const adaptive = await foreground("colour", 528);
const monochrome = await foreground("white", 528);

for (const file of ["icon.png", "icon-light.png", "icon-dark.png"]) {
  await sharp(icon).toFile(join(images, file));
}
for (const file of ["App-Icon-1024x1024@1x.png", "App-Icon-dark.png"]) {
  await sharp(icon).toFile(join(ios, file));
}
// In-app placements share the same transparent mark.
const signature = await mark("colour", 192);
for (const file of ["brand-mark.png", "brand-mark-light.png", "brand-mark-dark.png"]) {
  await sharp(signature).toFile(join(images, file));
}
await sharp(icon).resize(64).png().toFile(join(images, "favicon.png"));
await sharp(background).toFile(join(images, "adaptive-icon-background.png"));
await sharp(adaptive).toFile(join(images, "adaptive-icon.png"));
await sharp(monochrome).toFile(join(images, "adaptive-icon-monochrome.png"));

for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const mipmap = join(android, `mipmap-${density}`);
  const layerSize = Math.round(108 * scale);
  for (const [name, pixels] of Object.entries({ foreground: adaptive, background, monochrome })) {
    await sharp(pixels).resize(layerSize).webp({ lossless: true })
      .toFile(join(mipmap, `ic_launcher_${name}.webp`));
  }
  const legacySize = Math.round(48 * scale);
  const legacy = await sharp(icon).resize(legacySize).png().toBuffer();
  await sharp(legacy).webp({ lossless: true }).toFile(join(mipmap, "ic_launcher.webp"));
  const circle = Buffer.from(`<svg width="${legacySize}" height="${legacySize}"><circle cx="50%" cy="50%" r="50%" fill="white"/></svg>`);
  await sharp(legacy).composite([{ input: circle, blend: "dest-in" }]).webp({ lossless: true })
    .toFile(join(mipmap, "ic_launcher_round.webp"));
}
