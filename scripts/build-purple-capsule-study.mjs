/** Refine the selected capsule direction with three purple/black finishes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'assets/branding');
const require = createRequire(path.join(root, 'apps/mobile/package.json'));
const sharp = require('sharp');
let html = await readFile(path.join(brand, 'dark-backdrop-study.html'), 'utf8');
const palettes = {
  tile: { title: 'Black violet', description: 'Deep violet at the upper left fades into near-black. The gentle purple lift sits behind the dolphin, while the name stays crisp on the darker end. Recommended.' },
  capsule: { title: 'Indigo night', description: 'A cooler indigo-purple fades into black. Slightly quieter and closer to the existing midnight background, with the same finish on every capsule and icon.' },
  panel: { title: 'Plum shadow', description: 'A muted plum fades into black. A warmer, richer option with a more visible purple cast, kept dark enough to support the violet orbit.' },
};
const css = `
.study{--capsule-bg:linear-gradient(125deg,#29153c 0%,#100b1c 48%,#030408 100%);--capsule-edge:#3d2b52}
.study[data-palette=capsule]{--capsule-bg:linear-gradient(125deg,#211b43 0%,#0a0a19 48%,#030409 100%);--capsule-edge:#363052}
.study[data-palette=panel]{--capsule-bg:linear-gradient(125deg,#34162f 0%,#160d1b 48%,#050509 100%);--capsule-edge:#49273e}
.study[data-direction=capsule] .brand,.study[data-direction=capsule] .launch-lockup{background:var(--capsule-bg);border-color:var(--capsule-edge)}
.study .micro-header .mark{background:var(--capsule-bg);border-color:var(--capsule-edge)}
.study .launcher{background-image:var(--art),var(--capsule-bg);background-size:86% 86%,cover;background-position:center;background-repeat:no-repeat;border-color:var(--capsule-edge)}
.controls{position:sticky;top:0;z-index:10;background:var(--background,#fff);padding:8px 0}
`;
html = html
  .replace('<title>Cosmic Dolphin — dark backdrop explorations</title>', '<title>Cosmic Dolphin — purple-black capsules</title>')
  .replace('<h1>A dark home for the logo</h1>', '<h1>Purple-black capsules</h1>')
  .replace('Three backdrop systems, using the same teal dolphin and luminous violet orbit. The application can stay light; the logo always sits on midnight navy.', 'The selected dark capsule, refined with three subtle purple-to-black finishes. The same background treatment carries through headers, splash plaques, and icons in both application themes.')
  .replace('aria-label="Backdrop design"', 'aria-label="Capsule gradient finish"')
  .replace('Permanent navy across OS themes', 'Same gradient across OS themes')
  .replace('data-choice="tile">Compact tile', 'data-choice="tile">Black violet')
  .replace('data-choice="capsule">Logo capsule', 'data-choice="capsule">Indigo night')
  .replace('data-choice="panel">Dark brand panel', 'data-choice="panel">Plum shadow')
  .replace('</style>', css + '</style>')
  .replace(/const options=.*?;\nconst study/, 'const options=' + JSON.stringify(palettes) + ';\nconst study')
  .replace('study.dataset.direction=choice;', "study.dataset.direction='capsule';study.dataset.palette=choice;")
  .replace('public web header, signed-in sidebar, compact rail and toolbar, mobile top bar, web and mobile sign-in, footer, native splash, web launch/loading, iOS and Android launcher icons, browser favicon, and PWA/touch icon. These are placement concepts using the existing artwork; product navigation is illustrative.', 'public web header, signed-in sidebar, compact rail and toolbar, mobile top bar, web and mobile sign-in, footer, native splash, web launch/loading, iOS and Android launcher icons, browser favicon, and PWA/touch icon. The approved dolphin shape and colors are preserved; only its backing surface changes. Product navigation is illustrative.')
  .replace('<strong>Recommended starting point:</strong> compact tiles for headers and sign-in, with the full midnight splash from the dark-panel direction. This preserves the light interface while giving the logo a consistent dark setting.', '<strong>Recommended finish:</strong> Black violet. Keep the gradient gentle, preserve breathing room around the orbit, and use a fine purple edge to define the capsule against dark application surfaces.');
await writeFile(path.join(brand, 'purple-black-capsule-study.html'), html);

// T3 inlines local images/fonts; keep its tool payload small without base64.
const mark = html.match(/--art:url\(([^)]+)\)/)?.[1];
const icon = html.match(/--icon:url\(([^)]+)\)/)?.[1];
let preview = html.replace(mark, path.join(brand, 'cosmic-dolphin-master.png')).replace(icon, path.join(brand, 'icon-dark.png'));
let fontIndex = 0;
preview = preview.replace(/data:font\/ttf;base64,[A-Za-z0-9+/=]+/g, () => path.join(root, `apps/mobile/assets/fonts/Inter-${fontIndex++ === 0 ? 400 : 600}.ttf`));
await writeFile('/tmp/cosmic-purple-capsule-preview.html', preview);
// Reviewable PNG exports of each finish, derived from the existing mark.
const output = path.join(brand, 'purple-black-capsule');
await mkdir(output, { recursive: true });
const finishes = {
  'black-violet': ['#29153c', '#100b1c', '#030408', '#3d2b52'],
  'indigo-night': ['#211b43', '#0a0a19', '#030409', '#363052'],
  'plum-shadow': ['#34162f', '#160d1b', '#050509', '#49273e'],
};
function background(width, height, radius, colors, edge = true) {
  const [a,b,c,line] = colors;
  const x = Math.sin(125 * Math.PI / 180), y = -Math.cos(125 * Math.PI / 180);
  const length = width * x + height * y;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${width/2-length*x/2}" y1="${height/2-length*y/2}" x2="${width/2+length*x/2}" y2="${height/2+length*y/2}"><stop stop-color="${a}"/><stop offset=".48" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect x=".5" y=".5" width="${width-1}" height="${height-1}" rx="${radius}" fill="url(#g)" ${edge ? `stroke="${line}"` : ''}/></svg>`);
}
const master = path.join(brand, 'cosmic-dolphin-master.png');
const word = await sharp({text:{text:'<span foreground="#F4F3FC">Cosmic Dolphin</span>',font:'Inter SemiBold 58',fontfile:path.join(root,'apps/mobile/assets/fonts/Inter-600.ttf'),rgba:true,dpi:72}}).png().toBuffer();
const wm = await sharp(word).metadata();
for (const [name,colors] of Object.entries(finishes)) {
  const headerWidth = 216 + wm.width + 28;
  await sharp(background(headerWidth,208,104,colors)).composite([
    {input:await sharp(master).resize(176).png().toBuffer(),left:16,top:16},
    {input:word,left:216,top:Math.round((208-wm.height)/2)},
  ]).png().toFile(path.join(output,`header-${name}.png`));
  await sharp(background(256,256,64,colors)).composite([{input:await sharp(master).resize(220).png().toBuffer(),left:18,top:18}]).png().toFile(path.join(output,`tile-${name}.png`));
  await sharp(background(1024,1024,0,colors,false)).flatten({background:colors[2]}).composite([{input:await sharp(master).resize(800).png().toBuffer(),left:112,top:112}]).removeAlpha().png().toFile(path.join(output,`icon-${name}.png`));
}
const plaqueWord = await sharp(word).resize({width:540,withoutEnlargement:true}).png().toBuffer();
const pw = await sharp(plaqueWord).metadata();
const plaque = await sharp(background(800,860,112,finishes['black-violet'])).composite([
  {input:await sharp(master).resize(560).png().toBuffer(),left:120,top:52},
  {input:plaqueWord,left:Math.round((800-pw.width)/2),top:700},
]).png().toBuffer();
await writeFile(path.join(output,'splash-plaque-black-violet.png'),plaque);
for(const [theme,color] of Object.entries({light:'#FFFFFF',dark:'#14121C'})) {
  await sharp({create:{width:1290,height:2796,channels:3,background:color}}).composite([{input:plaque,left:245,top:968}]).png().toFile(path.join(output,`splash-${theme}-black-violet.png`));
}
console.log('Created assets/branding/purple-black-capsule-study.html.');
