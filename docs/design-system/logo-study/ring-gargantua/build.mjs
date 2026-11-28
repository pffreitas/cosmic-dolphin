/**
 * Rebuilds the Gargantua Ring from the hand-edited reference (reference/ring-colour-ref.svg) with exact geometry.
 *
 *   PAPER_DIR=<dir with node_modules/paper + paperjs-offset> node docs/design-system/logo-study/ring-gargantua/build.mjs
 *
 * Construction (all in the reference's 780×750 viewBox):
 *  - Ring: a true annulus (circles fitted to the traced ring), cut by the band and cleared around the dolphin.
 *  - Band: ONE straight dark strip at 30°, so both cuts in the ring and every straight spike edge are collinear.
 *  - Spikes, point-symmetric across the band: on each side a flare on one side of the band, and on the other a
 *    short outer needle whose straight edge carries on through the ring as a needle to the centre. Each curved edge leaves its circle tangentially (G1) and lands on the band
 *    edge in a sharp point.
 * The dolphin path is kept as drawn in the reference, except that its tail tip now stops on the band's upper edge.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const req = createRequire(path.join(process.env.PAPER_DIR ?? here, 'package.json'));
const paper = req('paper');
const { PaperOffset } = req('paperjs-offset');
const sharp = createRequire(path.join(root, 'apps/mobile/package.json'))('sharp');
paper.setup(new paper.Size(1200, 1200));
const { Point, Path, CompoundPath } = paper;

// ── Parameters ────────────────────────────────────────────────────────────────────────────────────────
const P = {
  C: new Point(392.3, 396.9), // ring centre (fit to the reference ring)
  Ro: 295.7, // outer radius
  Ri: 231, // inner radius
  angle: 30, // band angle, degrees above horizontal
  bandOffset: 34, // band distance below-right of the ring centre (reference: 34)
  g: 10, // band width
  clear: 16, // clearance between the ring/spikes and the dolphin
  // tip: distance along the band from O. base: degrees along the circle from where the band edge meets it.
  // hOut: tangent handle at the base, as a share of the base's distance from the band (below 1, the edge never crosses it).
  // hIn: handle at the tip, as a share of the base-to-tip distance.
  flare: { tip: 465, base: 22, tipAngle: 2.5, hOut: 0.9, hIn: 0.5 },
  outer: { tip: 400, base: 9, tipAngle: 1.2, hOut: 0.85, hIn: 0.55 }, // short needle on the other side of the band
  inner: { on: 1, tip: 6, width: 18, bow: 5, hOut: 0.4, hIn: 0.45 }, // needle across the hole, continuing the short needle's edge
  // Gargantua explorations (off in the baseline):
  disk: { on: 0, length: 500, thick: 14, gap: 4.5 }, // bright flat disk crossing the shadow, framed by dark gaps (replaces the band)
  photon: { on: 0, r: 200, w: 5 }, // thin photon ring inside the shadow
  ecc: 0, // inner circle shift along the band normal: negative = heavier upper arch (as the lensed far side of the disk)
  mirror: 0, // 1 = both flares on the same side of the disk (the film's shoulders) instead of point-symmetric
};
const merge = (o, x) => { for (const [k, v] of Object.entries(x)) (v && typeof v === 'object' && !Array.isArray(v)) ? merge(o[k], v) : (o[k] = v); };
if (process.env.VARIANT) merge(P, JSON.parse(process.env.VARIANT));
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('P_')) { // P_flare_tip=480 style overrides
  const keys = k.slice(2).split('_'); let o = P; while (keys.length > 1) o = o[keys.shift()]; o[keys[0]] = +v;
}
const outDir = process.env.OUT ? path.resolve(process.env.OUT) : here;
await mkdir(outDir, { recursive: true });

// Band frame: d along the band (up-right), n normal (up-left, towards the ring centre).
const a = (P.angle * Math.PI) / 180;
const d = new Point(Math.cos(a), -Math.sin(a));
const n = new Point(-Math.sin(a), -Math.cos(a));
const O = P.C.subtract(n.multiply(P.bandOffset)); // origin on the band centreline
const at = (u, v) => O.add(d.multiply(u)).add(n.multiply(v));
const Rm = (P.Ro + P.Ri) / 2;
const Ci = P.C.add(n.multiply(P.ecc)); // inner circle centre

// The cut that separates the disk plane from the halo: a straight band, or (disk mode) a parabolic lens that frames the disk.
const D = P.disk;
const lens = (U, H) => { // |v| <= H (1 - (u/U)^2), as two exact parabolic cubics
  const p = new Path({ insert: false });
  p.add(new paper.Segment(at(-U, 0), null, null));
  p.cubicCurveTo(at(-U / 3, (4 * H) / 3), at(U / 3, (4 * H) / 3), at(U, 0));
  p.cubicCurveTo(at(U / 3, (-4 * H) / 3), at(-U / 3, (-4 * H) / 3), at(-U, 0));
  p.closePath();
  return p;
};
const gapU = D.length + 40, gapH = D.thick / 2 + D.gap;
const edgeV = (u) => (D.on ? Math.max(0, gapH * (1 - (u / gapU) ** 2)) : P.g / 2); // the cut's half-height at u
const edgeSlope = (u) => (D.on ? (-2 * gapH * u) / gapU ** 2 : 0);

// Circle point at angle psi (deg) measured from the band direction around C, on side s (+1 right, -1 left), w = +1 above band.
const onCircle = (R, s, psiDeg, w) => { const p = (psiDeg * Math.PI) / 180; return P.C.add(d.multiply(s * R * Math.cos(p))).add(n.multiply(w * R * Math.sin(p))); };
// Where the band edge line v = ve crosses circle R on side s.
const cross = (R, s, ve, c = P.C) => { const off = c.subtract(O); const vc = ve - off.dot(n); const u = Math.sqrt(R * R - vc * vc); return c.add(d.multiply(s * u)).add(n.multiply(vc)); };
const angleOf = (pt) => { const r = pt.subtract(P.C); return Math.atan2(r.dot(n), r.dot(d)); };
const circlePt = (R, th) => P.C.add(d.multiply(R * Math.cos(th))).add(n.multiply(R * Math.sin(th)));

/**
 * A spike: tip on the band edge (v = ve) at u = tipU; curved edge from base B on circle Rb, tangent there,
 * landing on the tip at tipAngle off the band. Closed through the ring's mid-line so it merges with the ring.
 */
function spike({ s, w, Rb, baseDeg, tipU, tipAngle, hOut, hIn }) {
  const ve = w * edgeV(tipU);
  const T = at(tipU, ve);
  const thX = angleOf(cross(Rb, s, w * edgeV(s * 250)));
  const B = circlePt(Rb, thX + w * s * (baseDeg * Math.PI) / 180); // move along the circle away from the band
  // tangent at B, pointing towards the band
  const r = B.subtract(P.C).normalize();
  let t = new Point(-r.y, r.x);
  if (t.dot(cross(Rb, s, ve).subtract(B)) < 0) t = t.multiply(-1);
  // arrival direction at the tip: along the cut edge's tangent, tilted towards the cut
  const tangent = d.add(n.multiply(w * edgeSlope(tipU))).normalize();
  const toward = T.subtract(B).dot(d) > 0 ? tangent : tangent.multiply(-1);
  const ta = (tipAngle * Math.PI) / 180;
  const arrive = toward.multiply(Math.cos(ta)).add(n.multiply(-w * Math.sin(ta))).normalize();
  const L = T.getDistance(B);
  const path = new Path();
  const fromBand = Math.abs(B.subtract(T).dot(n));
  path.add(new paper.Segment(B, null, t.multiply(hOut * fromBand)));
  path.add(new paper.Segment(T, arrive.multiply(-hIn * L), null));
  // back along the centreline (the cut trims it to the exact edge), around the ring's mid-line to the base angle, out to B
  path.lineTo(at(tipU, 0));
  const E = cross(Rm, s, 0);
  path.lineTo(E);
  const thE = angleOf(E), thB = angleOf(B);
  let dth = thB - thE; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
  path.arcTo(circlePt(Rm, thE + dth / 2), circlePt(Rm, thB));
  path.lineTo(B);
  path.closePath();
  return { path, B, T };
}

// The dolphin, as drawn in the reference. Its tail ends exactly on the band's upper edge (it rises out of the disk),
// and the halo keeps the ring and spikes clear of it everywhere above the band.
const ref = await readFile(path.join(here, 'reference/ring-colour-ref.svg'), 'utf8');
const dolphinD = [...ref.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])[5];
const drawn = new CompoundPath(dolphinD); drawn.translate(new Point(47 - 158, -3 - 140));
const halfPlane = (v0, v1) => { const r = new Path([at(-900, v0), at(900, v0), at(900, v1), at(-900, v1)]); r.closed = true; return r; };
const cut = D.on ? lens(gapU, gapH) : halfPlane(-P.g / 2, P.g / 2);
const belowCut = halfPlane(-900, 0).unite(cut);
const aboveBand = new Path.Rectangle({ point: [-2000, -2000], size: [4000, 4000], insert: false }).subtract(belowCut);
const dolphin = drawn.intersect(aboveBand);
const body = (dolphin.children ? dolphin.children[0] : dolphin).clone({ insert: false });
if (!body.clockwise) body.reverse(); // the offset plugin grows clockwise paths
const halo = PaperOffset.offset(body, P.clear, { join: 'round', insert: false }).intersect(aboveBand);
const innerCircle = new Path.Circle(Ci, P.Ri);

/**
 * Inner needle: from the inner circle at `width` off the band edge, tapering to a point on the band edge near O.
 */
function needle({ s, w, tip, width, bow, hOut, hIn }) {
  const ve = w * (P.g / 2);
  const I = at(-s * tip, ve);
  const B = cross(P.Ri, s, ve + w * width, Ci);
  const chord = I.subtract(B), L = chord.length, dir = chord.normalize();
  // leave B tilted towards the band, so the edge bows in and the point stays long and fine
  const outDir = dir.add(n.multiply(-w * Math.tan((bow * Math.PI) / 180))).normalize();
  const path = new Path();
  path.add(new paper.Segment(B, null, outDir.multiply(hOut * L)));
  path.add(new paper.Segment(I, d.multiply(s * hIn * L), null));
  const E = cross(Rm, s, ve);
  path.lineTo(E);
  const thE = angleOf(E), thB = angleOf(B);
  path.arcTo(circlePt(Rm, (thE + thB) / 2), circlePt(Rm, thB));
  path.lineTo(B);
  path.closePath();
  return { path, B, T: I };
}

const parts = [];
for (const s of [1, -1]) {
  const w = P.mirror ? -1 : -s; // baseline: right flare below the band, left flare above (point symmetry)
  parts.push(spike({ s, w, Rb: P.Ro, baseDeg: P.flare.base, tipU: s * P.flare.tip, ...P.flare }));
  if (P.outer.on ?? 1) parts.push(spike({ s, w: -w, Rb: P.Ro, baseDeg: P.outer.base, tipU: s * P.outer.tip, ...P.outer }));
  if (P.inner.on && !D.on) parts.push(needle({ s, w: -w, ...P.inner }));
}

// ── Boolean assembly ─────────────────────────────────────────────────────────────────────────────────
let hole = new Path.Circle(P.C, P.Ro).subtract(innerCircle);
for (const p of parts) hole = hole.unite(p.path);
if (P.photon.on) hole = hole.unite(new Path.Circle(Ci, P.photon.r + P.photon.w / 2).subtract(new Path.Circle(Ci, P.photon.r - P.photon.w / 2)));
hole = hole.subtract(cut).subtract(halo);
if (D.on) hole = hole.unite(lens(D.length, D.thick / 2));

// drop slivers (anything much smaller than the smallest spike)
const pieces = (hole.children ?? [hole]).slice();
const kept = pieces.filter((c) => Math.abs(c.area) > 400 || c.clockwise !== pieces[0].clockwise);
const dropped = pieces.length - kept.length;
const blackHole = new CompoundPath({ children: kept.map((c) => c.clone({ insert: false })) });
blackHole.reorient(true, true);

// ── Output ───────────────────────────────────────────────────────────────────────────────────────────
const fmt = (p) => p.pathData.replace(/-?\d*\.\d+/g, (v) => String(+(+v).toFixed(2)));
const holeD = fmt(blackHole);
const dolD = fmt(dolphin);
// Canvas: the art's bounds plus an even margin (the reference's 780×750 frame clipped the right spike's tip).
const art = blackHole.bounds.unite(dolphin.bounds);
const pad = 24;
const vb = [Math.floor(art.x - pad), Math.floor(art.y - pad), 0, 0];
vb[2] = Math.ceil(art.right + pad) - vb[0]; vb[3] = Math.ceil(art.bottom + pad) - vb[1];
const VB = vb.join(' ');
const grad = `<linearGradient id="cd-ring-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="701.4" x2="0" y2="49">
      <stop offset="0" stop-color="#B04AF4"/><stop offset=".25" stop-color="#764CF7"/><stop offset=".5" stop-color="#447AF9"/><stop offset=".75" stop-color="#29B0F4"/><stop offset="1" stop-color="#17C4DF"/>
    </linearGradient>`;
const doc = ({ fill, bg = '', defs = '', note }) => `<?xml version="1.0" encoding="UTF-8"?>
<!-- Cosmic Dolphin · Gargantua Ring · ${note}. Built by logo-study/ring-gargantua/build.mjs: true circles, one 30° band, tangent spikes. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}" width="${vb[2]}" height="${vb[3]}">
  <title>Cosmic Dolphin</title>
  <defs>
    ${grad}${defs}
  </defs>${bg}
  <g id="mark">
    <path id="black-hole" d="${holeD}" fill="${fill}"/>
    <path id="dolphin" d="${dolD}" fill="${fill}"/>
  </g>
</svg>
`;
const plum = `\n    <linearGradient id="cd-plum" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#34162F"/><stop offset=".48" stop-color="#160D1B"/><stop offset="1" stop-color="#050509"/></linearGradient>`;
const files = {
  'gargantua-colour.svg': doc({ fill: 'url(#cd-ring-gradient)', note: 'colour, transparent background' }),
  'gargantua-colour-on-plum.svg': doc({ fill: 'url(#cd-ring-gradient)', note: 'colour on Plum', defs: plum, bg: `\n  <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#cd-plum)"/>` }),
  'gargantua-mono.svg': doc({ fill: 'currentColor', note: 'one colour, inherits currentColor' }),
  'gargantua-charcoal.svg': doc({ fill: '#2B2B2B', note: 'one colour, charcoal' }),
  'gargantua-white.svg': doc({ fill: '#FFFFFF', note: 'one colour, white' }),
};
for (const [name, content] of Object.entries(files)) await writeFile(path.join(outDir, name), content);

// Construction sheet: the primitives and guides, unclipped, for editing the geometry by hand.
const stroke = (p, c, wdt = 1.5, dash = '') => `<path d="${fmt(p)}" fill="none" stroke="${c}" stroke-width="${wdt}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const line = (p, q, c, dash = '') => `<line x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${q.x.toFixed(2)}" y2="${q.y.toFixed(2)}" stroke="${c}" stroke-width="1"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const dot = (p, c) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="4" fill="${c}"/>`;
const handles = parts.flatMap(({ path: p }) => p.segments.slice(0, 2).flatMap((sg) => [sg.handleIn, sg.handleOut].filter((h) => h.length > 0).map((h) => line(sg.point, sg.point.add(h), '#F5A524') + dot(sg.point.add(h), '#F5A524'))));
const construction = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}" width="${vb[2] * 2}" height="${vb[3] * 2}">
  <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#0E0A12"/>
  <path d="${holeD}" fill="#3A2F52"/><path d="${dolD}" fill="#2A2238"/>
  <g id="guides">
    <circle cx="${P.C.x}" cy="${P.C.y}" r="${P.Ro}" fill="none" stroke="#7DD3FC" stroke-width="1" stroke-dasharray="4 4"/>
    <circle cx="${Ci.x}" cy="${Ci.y}" r="${P.Ri}" fill="none" stroke="#7DD3FC" stroke-width="1" stroke-dasharray="4 4"/>
    ${line(at(-560, 0), at(560, 0), '#F472B6', '6 4')}
    ${line(at(-560, P.g / 2), at(560, P.g / 2), '#F472B6')}${line(at(-560, -P.g / 2), at(560, -P.g / 2), '#F472B6')}
    ${dot(P.C, '#7DD3FC')}${dot(O, '#F472B6')}
  </g>
  <g id="spikes">${parts.map((p) => stroke(p.path, '#A3E635', 1.2)).join('')}</g>
  <g id="handles">${handles.join('')}${parts.map((p) => dot(p.B, '#A3E635') + dot(p.T, '#A3E635')).join('')}</g>
</svg>
`;
await writeFile(path.join(outDir, 'construction.svg'), construction);
if (process.env.DEBUG) {
  const cols = ['#ff4d4d', '#4dff88', '#4da6ff', '#ffd24d', '#ff4dff', '#4dffff'];
  const dbg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}" width="1560" height="1500"><rect width="780" height="750" fill="#111"/>${parts.map((p, i) => `<path d="${fmt(p.path)}" fill="${cols[i]}" fill-opacity=".45" stroke="${cols[i]}"/>`).join('')}<path d="${fmt(halo)}" fill="none" stroke="#fff"/></svg>`;
  await sharp(Buffer.from(dbg)).png().toFile(process.env.DEBUG);
}

// Previews + a comparison against the reference.
await mkdir(path.join(outDir, 'preview'), { recursive: true });
await sharp(Buffer.from(files['gargantua-colour-on-plum.svg'])).resize(1200).png().toFile(path.join(outDir, 'preview/gargantua-colour-on-plum.png'));
await sharp(Buffer.from(files['gargantua-charcoal.svg'])).resize(1200).flatten({ background: '#F8F7F5' }).png().toFile(path.join(outDir, 'preview/gargantua-charcoal.png'));
await sharp(Buffer.from(construction)).png().toFile(path.join(outDir, 'preview/construction.png'));
const refFixed = ref.replace('width="100%" height="100%"', 'width="780" height="750"');
const refPng = await sharp(Buffer.from(refFixed)).resize(1200).flatten({ background: '#160D1B' }).png().toBuffer();
const outline = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 750" width="1200" height="${Math.round(1200 * 750 / 780)}"><path d="${holeD}" fill="none" stroke="#FFFFFF" stroke-width="1.4"/></svg>`;
await sharp(refPng).composite([{ input: Buffer.from(outline) }]).jpeg({ quality: 85 }).toFile(path.join(outDir, 'preview/compare-on-reference.jpg'));

console.log({ viewBox: VB, pieces: pieces.length, dropped, nodes: blackHole.children.reduce((s, c) => s + c.segments.length, 0), O: O.toString() });
