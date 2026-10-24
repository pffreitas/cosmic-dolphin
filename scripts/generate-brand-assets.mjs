/** Production Plum shadow assets; source artwork and design tokens stay authoritative. */
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'apps/mobile/package.json'));
const sharp = require('sharp');
const brand = path.join(root, 'assets/branding');
const mobile = path.join(root, 'apps/mobile');
const web = path.join(root, 'apps/web');
const master = path.join(brand, 'cosmic-dolphin-master.png');
const tokens = JSON.parse(await readFile(path.join(root, 'docs/design-system/tokens.json'), 'utf8'));
const palette = tokens.color.light;
const foreground = palette['brand-fg'];
const fontfile = path.join(mobile, 'assets/fonts/Inter-600.ttf');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
await mkdir(path.join(web, 'public/brand'), { recursive: true });
async function save(file, data) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, data); }
async function canvas(width, height, layers, background = transparent) {
  return sharp({ create: { width, height, channels: 4, background } }).composite(layers).png().toBuffer();
}
async function mark(size) { return sharp(master).resize(size, size).png().toBuffer(); }
async function label(size) {
  return sharp({ text: { text: `<span foreground="${foreground}">Cosmic Dolphin</span>`, font: `Inter SemiBold ${size}`, fontfile, rgba: true, dpi: 72 } }).png().toBuffer();
}
// Match CSS's 125-degree gradient in user-space, at any aspect ratio.
function gradient(width, height, radius = 0, edge = false) {
  const x = Math.sin(125 * Math.PI / 180), y = -Math.cos(125 * Math.PI / 180);
  const length = width * x + height * y;
  const inset = edge ? .5 : 0;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${width/2-length*x/2}" y1="${height/2-length*y/2}" x2="${width/2+length*x/2}" y2="${height/2+length*y/2}"><stop stop-color="${palette['brand-plum']}"/><stop offset=".48" stop-color="${palette['brand-mid']}"/><stop offset="1" stop-color="${palette['brand-black']}"/></linearGradient></defs><rect x="${inset}" y="${inset}" width="${width-2*inset}" height="${height-2*inset}" rx="${radius}" fill="url(#g)" ${edge ? `stroke="${palette['brand-edge']}"` : ''}/></svg>`);
}
const iconBackground = await sharp(gradient(1024,1024)).removeAlpha().png().toBuffer();
const icon = await sharp(iconBackground).composite([{input:await mark(800),left:112,top:112}]).removeAlpha().png().toBuffer();
const tile = await sharp(gradient(256,256,64,true)).composite([{input:await mark(220),left:18,top:18}]).png().toBuffer();
const word = await label(88), wordSize = await sharp(word).metadata();
const headerWidth = 250 + wordSize.width + 32;
const header = await sharp(gradient(headerWidth,240,120,true)).composite([
  {input:await mark(224),left:8,top:8},
  {input:word,left:250,top:Math.round((240-wordSize.height)/2)},
]).png().toBuffer();
const splashWord = await label(62), sw = await sharp(splashWord).metadata();
const plaque = await sharp(gradient(800,860,112,true)).composite([
  {input:await mark(560),left:120,top:52},
  {input:splashWord,left:Math.round((800-sw.width)/2),top:700},
]).png().toBuffer();

await save(path.join(brand,'brand-tile.png'),tile);
await save(path.join(brand,'icon.png'),icon);
await save(path.join(brand,'gradient-background.png'),iconBackground);
await save(path.join(brand,'brand-style.json'),JSON.stringify({name:'Plum shadow',angle:125,locations:[0,.48,1],colors:[palette['brand-plum'],palette['brand-mid'],palette['brand-black']],edge:palette['brand-edge'],foreground},null,2)+'\n');
await save(path.join(brand,'header-capsule.png'),header);
await save(path.join(brand,'splash-plaque.png'),plaque);
await save(path.join(mobile,'assets/images/brand-tile.png'),tile);
await save(path.join(mobile,'assets/images/brand-gradient.png'),await sharp(gradient(1024,256)).removeAlpha().png().toBuffer());
await save(path.join(mobile,'assets/images/brand-mark.png'),await mark(192));
await save(path.join(mobile,'assets/images/adaptive-icon-background.png'),iconBackground);
await save(path.join(brand,'adaptive-background.png'),iconBackground);
await save(path.join(mobile,'assets/images/icon.png'),icon);
await save(path.join(mobile,'assets/images/splash-brand.png'),plaque);
await save(path.join(web,'public/brand/header-capsule.png'),header);
await save(path.join(web,'public/brand/tile.png'),tile);
for(const size of [128,256]) {
  const image=await sharp(master).resize(size).webp({quality:92,alphaQuality:100}).toBuffer();
  await save(path.join(web,`public/brand/mark-${size}.webp`),image);
  for(const theme of ['light','dark']) await save(path.join(web,`public/brand/mark-${theme}-${size}.webp`),image);
}
for(const theme of ['light','dark']) {
  await save(path.join(mobile,`assets/images/brand-mark-${theme}.png`),await mark(192));
  await save(path.join(brand,`icon-${theme}.png`),icon);
  await save(path.join(mobile,`assets/images/icon-${theme}.png`),icon);
  await save(path.join(brand,`header-${theme}.png`),header);
  await save(path.join(web,`public/brand/header-${theme}.png`),header);
  await save(path.join(brand,`splash-brand-${theme}.png`),plaque);
  await save(path.join(mobile,`assets/images/splash-brand-${theme}.png`),plaque);
  const splash=await canvas(1290,2796,[{input:plaque,left:245,top:968}],tokens.color[theme].bg);
  await save(path.join(brand,`splash-${theme}.png`),splash);
  await save(path.join(mobile,`assets/images/splash-${theme}.png`),splash);
  if(theme==='light') await save(path.join(mobile,'assets/images/splash.png'),splash);
  const ios=path.join(mobile,'ios/CosmicDolphin/Images.xcassets');
  await save(path.join(ios,`AppIcon.appiconset/${theme==='light'?'App-Icon-1024x1024@1x':'App-Icon-dark'}.png`),icon);
  for(const scale of [1,2,3]) {
    const filename=`${theme==='light'?'image':'image-dark'}${scale===1?'':`@${scale}x`}.png`;
    await save(path.join(ios,'SplashScreenLegacy.imageset',filename),await sharp(splash).resize(430*scale,932*scale).png().toBuffer());
  }
  await save(path.join(mobile,`android/app/src/main/res/drawable${theme==='dark'?'-night':''}-nodpi/splashscreen_full.png`),splash);
}
const adaptive=await canvas(1024,1024,[{input:await mark(620),left:202,top:202}]);
await save(path.join(mobile,'assets/images/adaptive-icon.png'),adaptive);
await save(path.join(brand,'adaptive-foreground.png'),adaptive);
for(const [density,scale] of Object.entries({mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4})) {
  const directory=path.join(mobile,`android/app/src/main/res/mipmap-${density}`);
  await sharp(adaptive).resize(Math.round(108*scale)).webp({lossless:true}).toFile(path.join(directory,'ic_launcher_foreground.webp'));
  await sharp(iconBackground).resize(Math.round(108*scale)).webp({lossless:true}).toFile(path.join(directory,'ic_launcher_background.webp'));
  for(const filename of ['ic_launcher.webp','ic_launcher_round.webp']) {
    const size=Math.round(48*scale);let image=sharp(icon).resize(size);
    if(filename.includes('round')) image=image.composite([{input:Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`),blend:'dest-in'}]);
    await image.webp({lossless:true}).toFile(path.join(directory,filename));
  }
  const size=Math.round(288*scale);
  const platformSplash=await canvas(size,size,[{input:await sharp(tile).resize(Math.round(size*.62)).png().toBuffer(),gravity:'centre'}]);
  for(const theme of ['light','dark']) await save(path.join(mobile,`android/app/src/main/res/drawable-${theme==='dark'?'night-':''}${density}/splashscreen_logo.png`),platformSplash);
}
const faviconImage=await sharp(icon).resize(64).png().toBuffer();
await save(path.join(mobile,'assets/images/favicon.png'),faviconImage);
await save(path.join(brand,'favicon.png'),faviconImage);
await sharp(icon).resize(180).png().toFile(path.join(web,'app/apple-icon.png'));
const favicon=(await sharp(icon).resize(64).png().toBuffer()).toString('base64');
await save(path.join(web,'app/icon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${favicon}"/></svg>\n`);
console.log('Plum shadow production assets generated for both themes and all platforms.');
