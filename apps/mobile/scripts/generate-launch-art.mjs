import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sharp from "sharp";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const mobile = join(repo, "apps/mobile");
const launch = join(mobile, "assets/images/launch");
const master = join(repo, "docs/design-system/logo-study/ring-gargantua/gargantua-colour.svg");
const ios = join(mobile, "ios/CosmicDolphin/Images.xcassets/SplashScreenLegacy.imageset");
const android = join(mobile, "android/app/src/main/res");

const rasterize = (width) => sharp(master, { density: 144 }).resize(width).png().toBuffer();
for (const density of [1, 2, 3]) {
  const suffix = density === 1 ? "" : `@${density}x`;
  const image = await rasterize(144 * density);
  await sharp(image).toFile(join(launch, `mark${suffix}.png`));
  await sharp(image).toFile(join(ios, `image${suffix}.png`));
}
for (const [qualifier, density] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const extent = 288 * density;
  const mark = await rasterize(144 * density);
  const { height: markHeight } = await sharp(mark).metadata();
  await sharp({ create: { width: extent, height: extent, channels: 4, background: "transparent" } })
    .composite([{ input: mark, left: extent / 4, top: Math.round((extent - markHeight) / 2) }])
    .png().toFile(join(android, `drawable-${qualifier}/splashscreen_logo.png`));
}
