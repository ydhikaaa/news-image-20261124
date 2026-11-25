// news-image-20261124 — ROUND 2 — "The World In One Day"
// A 1024x1024 broadsheet front page for Tuesday 24 November 2026, drawn on a
// software pixel buffer and written as a PNG. Node 22, standard library
// only, fully deterministic (seeded scatter, no clock, no network).
// 40 stories, 7 regions, 13 illustrated hero panels, every story dated
// Tuesday 24 November 2026 (UTC); older stories are named in the DATE CHECK
// footer and deliberately left out.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas ---
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

const PAPER = [247, 241, 227];
const PANEL_BG = [255, 253, 246];
const NAVY = [18, 34, 66];
const GOLD = [206, 158, 40];
const GOLD_PALE = [233, 224, 198];
const RED = [176, 32, 40];
const INK = [38, 38, 40];
const GREY = [84, 82, 76];
const PALE = [238, 236, 228];
const SEA = [110, 164, 214];
const LAND = [238, 228, 196];

// Clip rectangle: every pixel write is tested against it, so a scene can
// never bleed outside its own panel box.
let clip = { x0: 0, y0: 0, x1: W, y1: H };
function setClip(x, y, w, h) {
  clip = {
    x0: Math.max(0, Math.floor(x)),
    y0: Math.max(0, Math.floor(y)),
    x1: Math.min(W, Math.ceil(x + w)),
    y1: Math.min(H, Math.ceil(y + h)),
  };
}
function resetClip() {
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}

function setPx(x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < clip.x0 || x >= clip.x1 || y < clip.y0 || y >= clip.y1) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

// ------------------------------------------------------------- PNG encoder -
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crcData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  out.writeUInt32BE(crc32(crcData), 8 + data.length);
  return out;
}

function encodePNG() {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 (truecolour RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const rowOff = y * (1 + W * 3);
    raw[rowOff] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, rowOff + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- font --
// Hand-rolled 5x7 bitmap font. Each glyph is 7 rows of 5 pixels.
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "....#", "....#", "....#", "....#", "#...#", ".###."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", ".#.#.", "..#..", "..#..", "..#..", ".#.#.", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "$": ["..#..", ".####", "#.#.#", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#.##", "#..##"],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
};

function textWidth(str, scale) {
  if (str.length === 0) return 0;
  return str.length * 6 * scale - scale;
}

function drawChar(x, y, ch, scale, c) {
  const g = FONT[ch] || FONT[" "];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "#") {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            setPx(x + col * scale + dx, y + r * scale + dy, c);
          }
        }
      }
    }
  }
}

function drawText(x, y, str, scale, c, bold) {
  const s = String(str).toUpperCase();
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    if (bold) drawChar(cx + 1, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx - scale;
}

function drawTextCentered(cx, y, str, scale, c, bold) {
  const w = textWidth(String(str).toUpperCase(), scale) + (bold ? 1 : 0);
  drawText(Math.round(cx - w / 2), y, str, scale, c, bold);
}

function wrapText(str, maxWidth, scale) {
  const words = String(str).toUpperCase().split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// -------------------------------------------------------------- primitives -
function rect(x, y, w, h, c) {
  const x0 = Math.max(Math.round(x), clip.x0);
  const y0 = Math.max(Math.round(y), clip.y0);
  const x1 = Math.min(Math.round(x + w), clip.x1);
  const y1 = Math.min(Math.round(y + h), clip.y1);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function circle(cx, cy, r, c) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(x, y, c);
    }
  }
}

function ellipse(cx, cy, rx, ry, c) {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const half = Math.floor(rx * Math.sqrt(t));
    rect(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

function line(x0, y0, x1, y1, c, wdt) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const r = Math.max(0.6, (wdt || 1) / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
  }
}

function tri(x0, y0, x1, y1, x2, y2, c) {
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) setPx(x, y, c);
    }
  }
}

// Even-odd scanline polygon fill (handles concave shapes like bolts/stars).
function poly(pts, c) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      rect(xs[i], y, xs[i + 1] - xs[i], 1, c);
    }
  }
}

function star(cx, cy, rOuter, rInner, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  poly(pts, c);
}

// Deterministic PRNG so scattered details are identical on every run.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ scenes -
// Every scene paints inside the box (x, y, w, h); the caller sets the clip
// to exactly that box before calling. All scenes are original vector art.

// 1 — Hormuz: a tanker threading the strait between cliffs, mines in the water.
function sceneHormuz(x, y, w, h) {
  rect(x, y, w, h * 0.42, [196, 216, 235]); // sky
  rect(x, y + h * 0.42, w, h * 0.58, [64, 110, 170]); // sea
  circle(x + w * 0.86, y + h * 0.16, 8, [250, 205, 92]); // sun
  poly([[x, y + h], [x, y + h * 0.30], [x + w * 0.20, y + h * 0.46], [x + w * 0.24, y + h]], [96, 88, 74]); // left cliff
  poly([[x + w, y + h], [x + w, y + h * 0.26], [x + w * 0.80, y + h * 0.44], [x + w * 0.76, y + h]], [88, 80, 68]); // right cliff
  // Tanker.
  const tx = x + w * 0.30;
  const ty = y + h * 0.60;
  const tw = w * 0.42;
  poly([[tx, ty], [tx + tw, ty], [tx + tw - 8, ty + 12], [tx + 8, ty + 12]], [40, 44, 54]);
  rect(tx, ty + 9, tw, 3, [176, 32, 40]);
  const boxCols = [[206, 120, 40], [52, 130, 90], [70, 110, 190], [206, 158, 40], [160, 70, 140], [90, 160, 200]];
  for (let i = 0; i < 6; i++) rect(tx + 6 + i * (tw - 34) / 5, ty - 9, 13, 9, boxCols[i]);
  rect(tx + tw - 22, ty - 20, 15, 20, [238, 236, 228]); // bridge tower
  rect(tx + tw - 19, ty - 17, 9, 4, [70, 110, 170]);
  line(tx + tw - 14, ty - 20, tx + tw - 14, ty - 30, [60, 60, 66], 1.6);
  circle(tx + tw - 22, ty - 34, 4, [150, 150, 156]);
  circle(tx + tw - 28, ty - 37, 5.4, [138, 138, 146]);
  // Mines: dark spiked balls in the water.
  const mine = (mx, my) => {
    circle(mx, my, 4.6, [26, 28, 34]);
    line(mx - 7, my, mx + 7, my, [26, 28, 34], 1.4);
    line(mx, my - 7, mx, my + 7, [26, 28, 34], 1.4);
    line(mx - 5, my - 5, mx + 5, my + 5, [26, 28, 34], 1.4);
    line(mx + 5, my - 5, mx - 5, my + 5, [26, 28, 34], 1.4);
  };
  mine(x + w * 0.30, y + h * 0.86);
  mine(x + w * 0.55, y + h * 0.92);
  mine(x + w * 0.72, y + h * 0.84);
  // Wake trailing the tanker, then wave dashes.
  for (let i = 0; i < 4; i++) rect(tx - 8 - i * 9, ty + 8 + (i % 2) * 2, 7, 1.6, [190, 216, 240]);
  for (let i = 0; i < 7; i++) rect(x + w * (0.08 + i * 0.13), y + h * (0.70 + (i % 2) * 0.09), 12, 1.6, [150, 190, 225]);
}

// 2 — Paris: a biotech lab — white institute block, cross sign, flask, molecule.
function sceneLab(x, y, w, h) {
  rect(x, y, w, h, [226, 235, 240]);
  rect(x, y + h - 8, w, 8, [178, 190, 196]);
  const bx = x + w * 0.08;
  const bw = w * 0.46;
  const by = y + h - 8;
  rect(bx, by - 46, bw, 46, [250, 250, 248]);
  rect(bx, by - 46, bw, 5, [52, 110, 180]);
  for (let i = 0; i < 3; i++) rect(bx + 8 + i * (bw / 3), by - 34, 12, 10, [170, 205, 230]);
  rect(bx + bw / 2 - 5, by - 14, 10, 14, [90, 100, 110]);
  // Blue cross sign on the roof.
  const cx = bx + bw / 2;
  rect(cx - 3, by - 62, 6, 16, [40, 90, 200]);
  rect(cx - 8, by - 57, 16, 6, [40, 90, 200]);
  // Flask with bubbling liquid.
  const fx = x + w * 0.70;
  const fy = by;
  rect(fx - 3, fy - 40, 6, 14, [200, 214, 220]);
  tri(fx - 16, fy, fx + 16, fy, fx + 3, fy - 27, [200, 214, 220]);
  tri(fx - 16, fy, fx + 3, fy - 27, fx - 3, fy - 27, [200, 214, 220]);
  poly([[fx - 11, fy - 1], [fx + 11, fy - 1], [fx + 3, fy - 16], [fx - 3, fy - 16]], [86, 180, 96]);
  circle(fx - 4, fy - 8, 2.2, [220, 245, 220]);
  circle(fx + 4, fy - 12, 1.8, [220, 245, 220]);
  circle(fx, fy - 5, 1.5, [220, 245, 220]);
  // Molecule, top right.
  const mols = [[0.86, 0.20], [0.94, 0.32], [0.80, 0.36]];
  line(x + w * mols[0][0], y + h * mols[0][1], x + w * mols[1][0], y + h * mols[1][1], [120, 130, 140], 1.6);
  line(x + w * mols[0][0], y + h * mols[0][1], x + w * mols[2][0], y + h * mols[2][1], [120, 130, 140], 1.6);
  circle(x + w * 0.86, y + h * 0.20, 5, [206, 90, 60]);
  circle(x + w * 0.94, y + h * 0.32, 4, [52, 110, 180]);
  circle(x + w * 0.80, y + h * 0.36, 3.4, [86, 180, 96]);
}

// 3 — Brussels: a satellite over the globe, night side.
function sceneSatellite(x, y, w, h) {
  rect(x, y, w, h, [10, 16, 34]);
  const r = rng(303);
  for (let i = 0; i < 42; i++) circle(x + r() * w, y + r() * h * 0.7, r() < 0.3 ? 1.5 : 0.9, [235, 238, 245]);
  // Globe rising from the bottom.
  circle(x + w * 0.5, y + h * 1.28, h * 0.98, [52, 110, 190]);
  ellipse(x + w * 0.36, y + h * 0.86, w * 0.10, h * 0.10, [86, 168, 96]);
  ellipse(x + w * 0.60, y + h * 0.94, w * 0.12, h * 0.09, [86, 168, 96]);
  ellipse(x + w * 0.72, y + h * 0.82, w * 0.06, h * 0.06, [86, 168, 96]);
  // Satellite.
  const sx = x + w * 0.50;
  const sy = y + h * 0.34;
  rect(sx - 26, sy - 7, 17, 14, [40, 80, 170]);
  rect(sx + 9, sy - 7, 17, 14, [40, 80, 170]);
  for (let i = 1; i < 3; i++) {
    line(sx - 26 + i * 6, sy - 7, sx - 26 + i * 6, sy + 7, [200, 214, 240], 0.8);
    line(sx + 9 + i * 6, sy - 7, sx + 9 + i * 6, sy + 7, [200, 214, 240], 0.8);
  }
  rect(sx - 8, sy - 6, 16, 12, [205, 208, 214]);
  rect(sx - 8, sy - 6, 16, 3, GOLD);
  line(sx, sy + 6, sx, sy + 13, [205, 208, 214], 1.6);
  circle(sx, sy + 16, 3.4, GOLD);
  // Signal dashes down to the globe.
  for (let i = 0; i < 4; i++) circle(sx - 6 + i * 4, sy + 24 + i * 5, 1.3, [250, 205, 92]);
  for (let i = 0; i < 4; i++) circle(sx + 8 - i * 3, sy + 24 + i * 5, 1.3, [250, 205, 92]);
}

// 4 — Moscow/Kyiv: drones over a map, one target ring.
function sceneDrones(x, y, w, h) {
  rect(x, y, w, h, [52, 64, 58]);
  for (let gx = x + 14; gx < x + w; gx += 14) rect(gx, y, 1, h, [44, 54, 48]);
  for (let gy = y + 12; gy < y + h; gy += 12) rect(x, gy, w, 1, [44, 54, 48]);
  poly([[x + w * 0.16, y + h * 0.66], [x + w * 0.30, y + h * 0.30], [x + w * 0.58, y + h * 0.18], [x + w * 0.82, y + h * 0.40], [x + w * 0.74, y + h * 0.78], [x + w * 0.40, y + h * 0.86]], [150, 160, 130]);
  // Target rings over a city dot.
  const tx = x + w * 0.60;
  const ty = y + h * 0.48;
  circle(tx, ty, 10, RED);
  circle(tx, ty, 7.6, [150, 160, 130]);
  circle(tx, ty, 4.4, RED);
  circle(tx, ty, 2, [250, 240, 220]);
  star(tx + 15, ty - 12, 7, 3, [250, 176, 52]);
  // Quadcopter drones.
  const drone = (dx, dy, s) => {
    line(dx - 8 * s, dy - 8 * s, dx + 8 * s, dy + 8 * s, [225, 226, 228], 1.6 * s);
    line(dx + 8 * s, dy - 8 * s, dx - 8 * s, dy + 8 * s, [225, 226, 228], 1.6 * s);
    for (const [ox, oy] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) circle(dx + ox * s, dy + oy * s, 2.6 * s, [225, 226, 228]);
    circle(dx, dy, 3 * s, [30, 32, 36]);
  };
  drone(x + w * 0.24, y + h * 0.30, 1);
  drone(x + w * 0.42, y + h * 0.62, 0.8);
  drone(x + w * 0.82, y + h * 0.24, 0.9);
  // Flight-path dots.
  const r = rng(404);
  for (let i = 0; i < 9; i++) circle(x + w * (0.26 + i * 0.045), y + h * (0.34 + Math.sin(i * 0.9) * 0.05), 1.2, [250, 205, 92]);
  void r;
}

// 5 — Kirkuk: pumpjacks over a desert oilfield.
function sceneOil(x, y, w, h) {
  rect(x, y, w, h * 0.62, [240, 214, 160]);
  rect(x, y + h * 0.62, w, h * 0.38, [226, 196, 140]);
  circle(x + w * 0.84, y + h * 0.18, 9, [250, 196, 60]);
  const jack = (jx, jy, s) => {
    const c = [60, 54, 48];
    tri(jx, jy, jx + 10 * s, jy, jx + 5 * s, jy - 16 * s, c);
    line(jx + 5 * s, jy - 16 * s, jx - 12 * s, jy - 21 * s, c, 3 * s);
    line(jx + 5 * s, jy - 16 * s, jx + 17 * s, jy - 13 * s, c, 3 * s);
    tri(jx + 17 * s, jy - 13 * s, jx + 21 * s, jy - 9 * s, jx + 16 * s, jy - 8 * s, c);
    line(jx - 12 * s, jy - 21 * s, jx - 12 * s, jy - 12 * s, c, 2 * s);
    rect(jx - 15 * s, jy - 4 * s, 9 * s, 4 * s, c);
  };
  jack(x + w * 0.28, y + h * 0.86, 1);
  jack(x + w * 0.66, y + h * 0.78, 0.72);
  // Pipeline across the sand.
  rect(x + w * 0.04, y + h * 0.90, w * 0.92, 4, [110, 100, 88]);
  for (let i = 0; i < 5; i++) rect(x + w * (0.10 + i * 0.19), y + h * 0.90, 3, 7, [110, 100, 88]);
  // Storage tanks.
  rect(x + w * 0.82, y + h * 0.66, 22, 16, [238, 236, 228]);
  ellipse(x + w * 0.82 + 11, y + h * 0.66, 11, 3, [210, 208, 198]);
}

// 6 — Kuala Lumpur: a navy ship and a plane carry people home.
function sceneShipPlane(x, y, w, h) {
  rect(x, y, w, h * 0.52, [190, 214, 238]); // sky
  rect(x, y + h * 0.52, w, h * 0.48, [70, 120, 180]); // sea
  for (let i = 0; i < 6; i++) rect(x + w * (0.06 + i * 0.16), y + h * (0.60 + (i % 2) * 0.14), 12, 1.6, [170, 205, 235]);
  // Plane silhouette, top centre-right, big enough to read at a glance.
  const px0 = x + w * 0.52;
  const py0 = y + h * 0.10;
  poly([[px0, py0 + 5], [px0 + 46, py0 + 11], [px0 + 60, py0 + 17], [px0 + 46, py0 + 20], [px0 + 5, py0 + 13]], [40, 46, 60]);
  tri(px0 + 22, py0 + 13, px0 + 34, py0 + 27, px0 + 40, py0 + 14, [40, 46, 60]);
  tri(px0 + 3, py0 + 6, px0 - 5, py0 - 4, px0 + 10, py0 + 8, [40, 46, 60]);
  for (let i = 0; i < 5; i++) circle(px0 - 10 - i * 8, py0 + 20 + i * 2.4, 1.4, [250, 250, 250]);
  // Navy ship.
  const sx = x + w * 0.10;
  const sy = y + h * 0.74;
  const sw = w * 0.56;
  poly([[sx, sy], [sx + sw, sy], [sx + sw - 10, sy + 12], [sx + 8, sy + 12]], [52, 60, 74]);
  rect(sx + 6, sy - 8, sw - 14, 8, [70, 78, 94]);
  rect(sx + sw * 0.40, sy - 20, 20, 12, [238, 236, 228]);
  rect(sx + sw * 0.40 + 4, sy - 17, 5, 4, [70, 110, 170]);
  rect(sx + sw * 0.40 + 12, sy - 17, 5, 4, [70, 110, 170]);
  line(sx + sw * 0.46, sy - 20, sx + sw * 0.46, sy - 30, [60, 60, 66], 1.4);
  tri(sx + sw * 0.46, sy - 30, sx + sw * 0.46, sy - 24, sx + sw * 0.46 + 9, sy - 27, RED);
  // People dots along the deck.
  const r = rng(606);
  for (let i = 0; i < 12; i++) circle(sx + 12 + r() * (sw - 24), sy - 11 + r() * 3, 1.7, [250, 220, 160]);
}

// 7 — Gaza: skyline at dusk, one burst over the rooftops.
function sceneGaza(x, y, w, h) {
  rect(x, y, w, h, [216, 196, 170]);
  rect(x, y + h * 0.78, w, h * 0.22, [120, 110, 96]);
  const heights = [0.52, 0.66, 0.44, 0.72, 0.56, 0.62, 0.48, 0.68];
  let bx = x + 2;
  for (let i = 0; i < heights.length; i++) {
    const bw = w / heights.length - 4;
    const bh = h * heights[i];
    rect(bx, y + h * 0.78 - bh, bw, bh, [70, 64, 58]);
    for (let wy = y + h * 0.78 - bh + 5; wy < y + h * 0.72; wy += 8) {
      rect(bx + 4, wy, 3.4, 4, [226, 210, 170]);
    }
    bx += bw + 4;
  }
  // Burst and smoke.
  const ex = x + w * 0.62;
  const ey = y + h * 0.20;
  star(ex, ey, 15, 6.5, [240, 150, 40]);
  circle(ex, ey, 5, [250, 214, 100]);
  circle(ex - 10, ey - 16, 7, [150, 146, 140]);
  circle(ex + 2, ey - 22, 9, [138, 134, 130]);
  circle(ex + 13, ey - 14, 6, [158, 154, 148]);
  // Medics' crescent sign on a low block.
  rect(x + w * 0.06, y + h * 0.60, 20, 14, [248, 246, 240]);
  circle(x + w * 0.06 + 10, y + h * 0.60 + 7, 4.6, RED);
  circle(x + w * 0.06 + 12, y + h * 0.60 + 7, 3.8, [248, 246, 240]);
}

// 8 — Ulleung: a fighter jet over a cone island, alert rings.
function sceneJet(x, y, w, h) {
  rect(x, y, w, h * 0.66, [170, 205, 235]); // sky
  rect(x, y + h * 0.66, w, h * 0.34, [70, 120, 180]); // sea
  // Island cone.
  poly([[x + w * 0.30, y + h * 0.86], [x + w * 0.50, y + h * 0.44], [x + w * 0.70, y + h * 0.86]], [96, 140, 84]);
  poly([[x + w * 0.44, y + h * 0.55], [x + w * 0.50, y + h * 0.44], [x + w * 0.56, y + h * 0.55]], [240, 240, 238]);
  // Shelter house on the shore.
  rect(x + w * 0.60, y + h * 0.76, 14, 9, [248, 246, 240]);
  tri(x + w * 0.60 - 2, y + h * 0.76, x + w * 0.60 + 7, y + h * 0.76 - 6, x + w * 0.60 + 16, y + h * 0.76, RED);
  // Jet silhouette.
  const jx = x + w * 0.16;
  const jy = y + h * 0.20;
  poly([[jx, jy + 6], [jx + 26, jy], [jx + 52, jy + 4], [jx + 58, jy + 7], [jx + 52, jy + 10], [jx + 24, jy + 11]], [40, 46, 60]);
  tri(jx + 24, jy + 9, jx + 34, jy + 19, jx + 40, jy + 9, [40, 46, 60]);
  tri(jx + 4, jy + 5, jx - 3, jy - 3, jx + 10, jy + 6, [40, 46, 60]);
  for (let i = 0; i < 4; i++) rect(jx - 10 - i * 8, jy + 5 + (i % 2), 5, 1.6, [240, 244, 248]);
  // Alert rings over the island.
  const ax = x + w * 0.82;
  const ay = y + h * 0.30;
  circle(ax, ay, 9, RED);
  circle(ax, ay, 6.8, [170, 205, 235]);
  circle(ax, ay, 4, RED);
  circle(ax, ay, 2.6, [170, 205, 235]);
  circle(ax, ay, 1.2, RED);
}

// 9 — Port Moresby: parliament, a ballot, and a big gold check.
function sceneParliament(x, y, w, h) {
  rect(x, y, w, h, [236, 230, 214]);
  rect(x, y + h - 8, w, 8, [206, 198, 176]);
  const bx = x + w * 0.08;
  const bw = w * 0.50;
  const by = y + h - 8;
  tri(bx - 5, by - 40, bx + bw / 2, by - 54, bx + bw + 5, by - 40, [150, 144, 128]);
  rect(bx, by - 40, bw, 5, [168, 162, 144]);
  for (let i = 0; i < 4; i++) rect(bx + 7 + i * (bw / 4), by - 35, 6, 26, [248, 244, 230]);
  rect(bx - 3, by - 9, bw + 6, 4, [168, 162, 144]);
  rect(bx - 6, by - 4, bw + 12, 3, [150, 144, 128]);
  // Ballot box with a paper going in.
  const qx = x + w * 0.66;
  const qy = y + h - 8;
  rect(qx, qy - 20, 26, 20, NAVY);
  rect(qx + 4, qy - 17, 18, 3, [10, 16, 30]);
  rect(qx + 8, qy - 30, 11, 12, [252, 250, 244]);
  rect(qx + 10, qy - 27, 7, 2, [150, 148, 140]);
  // Big gold check badge.
  const cx = x + w * 0.86;
  const cy = y + h * 0.30;
  circle(cx, cy, 13, NAVY);
  circle(cx, cy, 11, GOLD);
  line(cx - 6, cy, cx - 1.5, cy + 5, NAVY, 2.6);
  line(cx - 1.5, cy + 5, cx + 7, cy - 6, NAVY, 2.6);
}

// 10 — Cikande: the candy factory, flames along the roofline.
function sceneFire(x, y, w, h) {
  rect(x, y, w, h, [84, 90, 110]); // dusk sky
  rect(x, y + h - 10, w, 10, [40, 40, 46]); // ground
  const bx = x + w * 0.08;
  const bw = w * 0.62;
  const by = y + h - 10;
  rect(bx, by - 36, bw, 36, [28, 28, 36]);
  for (let i = 0; i < 4; i++) {
    tri(bx + i * (bw / 4), by - 36, bx + (i + 0.5) * (bw / 4), by - 48, bx + (i + 1) * (bw / 4), by - 36, [28, 28, 36]);
  }
  rect(bx + bw - 14, by - 68, 9, 32, [28, 28, 36]); // chimney
  for (let i = 0; i < 6; i++) rect(bx + 7 + i * (bw / 6.2), by - 28, 9, 9, [250, 205, 92]);
  const flame = (fx, fs, base) => {
    tri(fx - fs, base, fx, base - fs * 2.2, fx + fs, base, [238, 116, 30]);
    tri(fx - fs * 0.55, base, fx, base - fs * 1.4, fx + fs * 0.55, base, [250, 190, 60]);
  };
  flame(bx + bw * 0.22, 8, by - 38);
  flame(bx + bw * 0.50, 11, by - 40);
  flame(bx + bw * 0.76, 7, by - 38);
  flame(bx + 10, 6, by);
  // Smoke.
  circle(bx + bw - 10, by - 76, 7, [122, 122, 130]);
  circle(bx + bw + 2, by - 78, 9, [106, 106, 116]);
  circle(bx + bw * 0.52, by - 58, 9, [98, 98, 108]);
  circle(bx + bw * 0.64, by - 64, 11, [112, 112, 120]);
  // Rescue lights.
  rect(x + w * 0.80, by - 8, 16, 8, [52, 60, 74]);
  circle(x + w * 0.80 + 4, by - 10, 2.2, RED);
  circle(x + w * 0.80 + 12, by - 10, 2.2, [80, 140, 230]);
}

// 11 — New York / UN: a cracked heart over five candles.
function sceneHeart(x, y, w, h) {
  rect(x, y, w, h, [250, 244, 246]);
  const hx = x + w * 0.50;
  const hy = y + h * 0.16;
  circle(hx - 11, hy + 10, 12, [196, 40, 80]);
  circle(hx + 11, hy + 10, 12, [196, 40, 80]);
  tri(hx - 22, hy + 14, hx + 22, hy + 14, hx, hy + 44, [196, 40, 80]);
  // Crack down the middle.
  const crack = [[hx, hy + 2], [hx - 3, hy + 12], [hx + 2, hy + 20], [hx - 2, hy + 28], [hx + 1, hy + 38]];
  for (let i = 0; i + 1 < crack.length; i++) line(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], [96, 18, 44], 1.8);
  // Five candles for five women an hour.
  for (let i = 0; i < 5; i++) {
    const cx = x + w * (0.26 + i * 0.12);
    const cy = y + h - 6;
    rect(cx - 2.5, cy - 12, 5, 12, [252, 250, 246]);
    tri(cx - 2.4, cy - 12, cx, cy - 19, cx + 2.4, cy - 12, [250, 176, 52]);
    circle(cx, cy - 14.4, 1.3, [255, 240, 200]);
  }
  // Two small figures at the sides.
  const fig = (fx) => {
    circle(fx, y + h * 0.52, 4.4, [70, 60, 66]);
    line(fx, y + h * 0.52 + 4, fx, y + h * 0.52 + 14, [70, 60, 66], 2.8);
    line(fx, y + h * 0.52 + 14, fx - 4.4, y + h * 0.52 + 24, [70, 60, 66], 2.4);
    line(fx, y + h * 0.52 + 14, fx + 4.4, y + h * 0.52 + 24, [70, 60, 66], 2.4);
    line(fx, y + h * 0.52 + 7, fx - 5, y + h * 0.52 + 13, [70, 60, 66], 2);
    line(fx, y + h * 0.52 + 7, fx + 5, y + h * 0.52 + 13, [70, 60, 66], 2);
  };
  fig(x + w * 0.14);
  fig(x + w * 0.86);
}

// 12 — Dhaka: a plane coming home to a small house.
function scenePlaneHome(x, y, w, h) {
  rect(x, y, w, h, [186, 214, 240]);
  circle(x + w * 0.10, y + h * 0.18, 8, [250, 205, 92]);
  ellipse(x + w * 0.30, y + h * 0.16, 16, 5, [252, 252, 250]);
  ellipse(x + w * 0.86, y + h * 0.10, 13, 4, [252, 252, 250]);
  rect(x, y + h - 10, w, 10, [140, 170, 120]);
  // House, bottom right.
  const hx = x + w * 0.70;
  const hy = y + h - 10;
  rect(hx, hy - 20, 30, 20, [248, 244, 230]);
  tri(hx - 4, hy - 20, hx + 15, hy - 32, hx + 34, hy - 20, [176, 32, 40]);
  rect(hx + 12, hy - 12, 7, 12, [110, 84, 52]);
  rect(hx + 4, hy - 17, 6, 6, [250, 205, 92]);
  // Descending plane.
  const px0 = x + w * 0.10;
  const py0 = y + h * 0.30;
  poly([[px0, py0 + 4], [px0 + 38, py0 + 12], [px0 + 50, py0 + 18], [px0 + 40, py0 + 20], [px0 + 6, py0 + 13]], [40, 46, 60]);
  tri(px0 + 18, py0 + 14, px0 + 28, py0 + 27, px0 + 34, py0 + 15, [40, 46, 60]);
  tri(px0 + 3, py0 + 5, px0 - 4, py0 - 4, px0 + 9, py0 + 7, [40, 46, 60]);
  circle(px0 + 42, py0 + 16, 1.8, [250, 205, 92]);
  // Dashed descent path toward the house.
  for (let i = 0; i < 7; i++) circle(px0 + 58 + i * 13, py0 + 22 + i * 3.4, 1.3, [250, 250, 250]);
}

// 13 — Mexico City: a gavel over its block, flag colours at the corner.
function sceneGavel(x, y, w, h) {
  rect(x, y, w, h, [240, 232, 216]);
  rect(x, y + h - 12, w, 12, [150, 110, 70]); // desk
  // Flag tricolour, top left.
  rect(x + 8, y + 8, 8, 22, [38, 130, 76]);
  rect(x + 16, y + 8, 8, 22, [250, 250, 248]);
  rect(x + 24, y + 8, 8, 22, [196, 40, 44]);
  circle(x + 20, y + 19, 2.6, GOLD);
  // Gavel head: a clean diagonal band with two darker end caps, plus handle.
  const gx = x + w * 0.56;
  const gy = y + h * 0.34;
  poly([[gx - 24, gy - 6], [gx + 16, gy - 22], [gx + 24, gy - 10], [gx - 16, gy + 6]], [120, 84, 44]);
  poly([[gx - 24, gy - 6], [gx - 16, gy + 6], [gx - 22, gy + 9], [gx - 30, gy - 3]], [96, 66, 34]);
  poly([[gx + 16, gy - 22], [gx + 24, gy - 10], [gx + 30, gy - 13], [gx + 23, gy - 25]], [96, 66, 34]);
  rect(gx - 6, gy - 15, 5, 5, [170, 130, 84]);
  line(gx - 2, gy - 2, gx - 28, gy + 24, [120, 84, 44], 5);
  // Sound block.
  ellipse(x + w * 0.38, y + h - 14, 20, 5, [170, 130, 84]);
  ellipse(x + w * 0.38, y + h - 15.5, 20, 4, [186, 146, 96]);
  // Strike sparks.
  line(x + w * 0.30, y + h - 24, x + w * 0.26, y + h - 30, GOLD, 1.8);
  line(x + w * 0.38, y + h - 27, x + w * 0.38, y + h - 34, GOLD, 1.8);
  line(x + w * 0.46, y + h - 24, x + w * 0.50, y + h - 30, GOLD, 1.8);
}

const SCENES = [
  sceneHormuz,
  sceneLab,
  sceneSatellite,
  sceneDrones,
  sceneOil,
  sceneShipPlane,
  sceneGaza,
  sceneJet,
  sceneParliament,
  sceneFire,
  sceneHeart,
  scenePlaneHome,
  sceneGavel,
];

// ----------------------------------------------------------------- stories -
const BADGE_STYLE = {
  CLAIM: { bg: [176, 32, 40], fg: [255, 255, 255] },
  OFFICIAL: { bg: GOLD, fg: NAVY },
  REPORTED: { bg: [216, 215, 208], fg: [70, 70, 70] },
  CONFIRMED: { bg: [36, 130, 76], fg: [255, 255, 255] },
};

const HEROES = [
  {
    n: 1, loc: "HORMUZ - MIDDLE EAST", badge: "CLAIM",
    head: "IRAN: TANKERS HIT ITS MINES",
    body: "IRGC SAYS 2-3 TANKERS CAUGHT FIRE AFTER BREAKING STRAIT RULES; BRENT STAYS NEAR $69.",
    src: "IRNA VIA REUTERS",
  },
  {
    n: 2, loc: "PARIS - EUROPE", badge: "OFFICIAL",
    head: "SANOFI BUYS INSMED FOR $41BN",
    body: "SANOFI AGREES ITS BIGGEST DEAL IN YEARS: $175 A SHARE FOR INSMED'S LUNG DRUGS.",
    src: "SANOFI / PR NEWSWIRE",
  },
  {
    n: 3, loc: "BRUSSELS - EUROPE", badge: "REPORTED",
    head: "NATO VOWS TO DEFEND SPACE",
    body: "REPORTS: RUSSIA MAY ORBIT A NUCLEAR SATELLITE IN 60 DAYS. MOSCOW DISMISSES IT.",
    src: "NATO / GERMAN MEDIA",
  },
  {
    n: 4, loc: "MOSCOW/KYIV - EUROPE", badge: "REPORTED",
    head: "DRONE WAR: 699 DOWNED, POLAND ON ALERT",
    body: "RUSSIA: 699 UKRAINIAN DRONES DOWNED, 355 NEAR MOSCOW; A DRONE ENTERED POLISH AIRSPACE.",
    src: "FMT / FRANCE 24",
  },
  {
    n: 5, loc: "KIRKUK - MIDDLE EAST", badge: "REPORTED",
    head: "BAGHDAD SEIZES KURDISH OILFIELDS",
    body: "PM AL-ZAIDI PUTS KIRKUK'S FIELDS UNDER THE FEDERAL OIL MINISTRY, TAKES EXPORTS.",
    src: "AL JAZEERA",
  },
  {
    n: 6, loc: "KUALA LUMPUR - ASIA", badge: "OFFICIAL",
    head: "MALAYSIA TO SEND 6,500 ROHINGYA BACK",
    body: "ANWAR: 1,500 GO BY NAVY SHIP ON 6-7 DEC, 5,303 BY AIR, BACK TO MYANMAR.",
    src: "AL JAZEERA",
  },
  {
    n: 7, loc: "GAZA - MIDDLE EAST", badge: "REPORTED",
    head: "STRIKE KILLS HAMAS SECURITY CHIEF",
    body: "AN ISRAELI AIRSTRIKE KILLED NAEEM ABU NAHEL AND SIX OTHERS, MEDICS SAID.",
    src: "REUTERS",
  },
  {
    n: 8, loc: "ULLEUNG - ASIA", badge: "REPORTED",
    head: "RUSSIAN JET: ISLAND'S 3-MINUTE ALERT",
    body: "RUSSIAN JET ENTERED KOREA'S AIR ZONE; ULLEUNG SHELTER ALERT LIFTED AFTER 3 MINUTES.",
    src: "REUTERS / YONHAP",
  },
  {
    n: 9, loc: "PORT MORESBY - OCEANIA", badge: "REPORTED",
    head: "BOUGAINVILLE VOTE ON NATIONHOOD",
    body: "PNG MPS VOTE ON THE 2019 REFERENDUM: 97.7% CHOSE INDEPENDENCE; 89 OF 118 MPS NEEDED.",
    src: "THE CONVERSATION",
  },
  {
    n: 10, loc: "CIKANDE - ASIA", badge: "REPORTED",
    head: "FACTORY-FIRE TOLL RISES TO 26",
    body: "CANDY-FACTORY FIRE TOLL UP TO 26 DEAD, 8 STILL MISSING. BLAZE BEGAN SATURDAY.",
    src: "WIRES",
  },
  {
    n: 11, loc: "NEW YORK - WORLD", badge: "OFFICIAL",
    head: "47,000 WOMEN KILLED BY PARTNERS",
    body: "UN: FIVE WOMEN AN HOUR ARE KILLED BY PARTNERS OR RELATIVES; AFRICA WORST HIT.",
    src: "UNODC / UN WOMEN",
  },
  {
    n: 12, loc: "DHAKA - ASIA", badge: "REPORTED",
    head: "HASINA SAYS SHE WILL FLY HOME 16 DEC",
    body: "SENTENCED TO DEATH IN ABSENTIA; DHAKA SAYS RETURN ONLY BY EXTRADITION.",
    src: "HASINA SPOKESPERSON",
  },
  {
    n: 13, loc: "MEXICO CITY - AMERICAS", badge: "OFFICIAL",
    head: "MEXICO TO TRY 'EL CHAPO ISIDRO' AT HOME",
    body: "MEXICO TURNS DOWN US EXTRADITION FOR THE CAPTURED CARTEL BOSS; A US DRONE HELPED CATCH HIM.",
    src: "MEXICO AG",
  },
];

// Items 14-40. Region tags tally with the heroes to the bar totals:
// EUROPE 9 - MIDDLE EAST 4 - ASIA 12 - AMERICAS 7 - AFRICA 2 - OCEANIA 4 - WORLD 2.
const ALSO = [
  "KYIV - ZELENSKY URGES 4-WAY TALKS (EU)",
  "VILLAVICENCIO - CAR BOMB, 23 HURT (AM)",
  "BRUSSELS - EU CAPS CHINA HYBRID CARS (EU)",
  "SEOUL/TOKYO - CHIP STOCKS LIFT ASIA (AS)",
  "BEIJING - OFFICIAL SENTENCED: SPYING (AS)",
  "JAKARTA - TWO VP CANDIDATES NAMED (AS)",
  "GENEVA - WORLD CHESS TITLE OPENS (WO)",
  "DAKAR - SENEGAL RESTORED AFCON CHAMPS (AF)",
  "TAPLEJUNG - M5.6 QUAKE, NO CASUALTIES (AS)",
  "HONIARA - SOLOMONS END CHINA PACT (OC)",
  "BUDAPEST - MAGYAR TO MEET ZELENSKY (EU)",
  "PARIS - MACRON WEIGHS SPENDING CAP (EU)",
  "NANTERRE - NAHEL OFFICER: MURDER TRIAL (EU)",
  "ROME - WFP: WARS BLOCK AID FOR 7.3M (EU)",
  "TEHRAN - BLOCKADE 'IMPOSSIBLE' (ME)",
  "CANBERRA - TECH GIANTS WARNED FINES (OC)",
  "SINGAPORE - Q3 GDP +6.1%, OUTLOOK UP (AS)",
  "TAIPEI - STOCKS REBOUND FROM LOW (AS)",
  "JIUQUAN - PAKISTANI ASTRONAUT FIRST (AS)",
  "JAKARTA - EX-POLICE CHIEF: TREASON (AS)",
  "WASHINGTON - MEGASPEED BLACKLISTED (AM)",
  "WASHINGTON - TRUMP: FASTER EXECUTIONS (AM)",
  "PENNSYLVANIA - 9TH MEASLES DEATH (AM)",
  "HAVANA - WHO CHIEF VISITS HOSPITALS (AM)",
  "GALAPAGOS - FLOODS AMID EL NINO FEARS (AM)",
  "SOUTH AFRICA - DROUGHT WATER CURBS (AF)",
  "GOLD COAST - ENGLAND LEVEL T20 SERIES (OC)",
];

const NUMBERS = [
  ["699", "UKRAINE DRONES", "DOWNED, RUSSIA SAYS"],
  ["$41BN", "SANOFI CASH DEAL", "FOR INSMED"],
  ["6,500+", "ROHINGYA MALAYSIA", "WILL RETURN"],
  ["47,000", "WOMEN KILLED BY", "PARTNERS - UN SAYS"],
  ["26", "DEAD IN CIKANDE", "FACTORY FIRE"],
  ["3 MIN", "SEOUL SHELTER ALERT", "ULLEUNG ISLAND"],
];

const REGIONS = [
  ["EUROPE 9", 216, [31, 58, 110], [255, 255, 255]],
  ["MIDDLE EAST 4", 98, [176, 32, 40], [255, 255, 255]],
  ["ASIA 12", 286, [22, 105, 88], [255, 255, 255]],
  ["AMERICAS 7", 170, GOLD, NAVY],
  ["AFRICA 2", 54, [122, 74, 142], [255, 255, 255]],
  ["OCEANIA 4", 98, [52, 110, 180], [255, 255, 255]],
  ["WORLD 2", 54, [96, 94, 88], [255, 255, 255]],
];

const TIMELINE = [
  ["00:30", "ZELENSKY URGES TALKS"],
  ["01:04", "KOREA ADIZ JETS"],
  ["02:15", "NATO SPACE VOW"],
  ["02:30", "VILLAVICENCIO BOMB"],
  ["03:50", "HASINA RETURN PLAN"],
  ["06:51", "SANOFI DEAL"],
  ["07:52", "ULLEUNG ALERT"],
];

const TICKER = [
  "IRAN: TANKERS HIT ITS MINES",
  "SANOFI BUYS INSMED FOR $41BN",
  "DRONE WAR: 699 DOWNED",
];

// ------------------------------------------------------------------ panels -
function drawPanel(x, y, w, h, st) {
  rect(x, y, w, h, NAVY);
  rect(x + 2, y + 2, w - 4, h - 4, PANEL_BG);
  const sx = x + 7;
  const sy = y + 7;
  const sw = w - 14;
  const sceneH = h > 165 ? 76 : 68;

  // Scene, hard-clipped to its own box, with a thin navy frame.
  rect(sx - 1, sy - 1, sw + 2, sceneH + 2, NAVY);
  setClip(sx, sy, sw, sceneH);
  SCENES[st.n - 1](sx, sy, sw, sceneH);
  resetClip();

  // Gold number badge, top-left over the scene.
  circle(sx + 13, sy + 13, 11.6, NAVY);
  circle(sx + 13, sy + 13, 10, GOLD);
  const numStr = String(st.n);
  drawText(sx + 13 - textWidth(numStr, 1) / 2, sy + 9.5, numStr, 1, NAVY, true);

  // Certainty badge, top-right over the scene.
  const bs = BADGE_STYLE[st.badge];
  const bw2 = textWidth(st.badge, 1) + 8;
  const bx = sx + sw - bw2 - 3;
  rect(bx, sy + 3, bw2, 13, bs.bg);
  drawText(bx + 4, sy + 6, st.badge, 1, bs.fg, true);

  // Location + region line.
  let cy = sy + sceneH + 5;
  drawText(sx, cy, st.loc, 1, NAVY, true);
  cy += 11;

  // Headline.
  for (const ln of wrapText(st.head, sw, 1)) {
    drawText(sx, cy, ln, 1, NAVY, true);
    cy += 10;
  }

  // Body.
  cy += 2;
  for (const ln of wrapText(st.body, sw, 1)) {
    drawText(sx, cy, ln, 1, GREY, false);
    cy += 9;
  }

  // Named source, pinned to the panel foot.
  drawText(sx, y + h - 13, "SOURCE: " + st.src, 1, [140, 138, 130], false);
}

// -------------------------------------------------------------------- page -
function drawPage() {
  rect(0, 0, W, H, PAPER);
  const MX = 24;
  const CW = W - MX * 2; // 976

  // Masthead: kicker, giant date, counts subline.
  drawTextCentered(W / 2, 8, "THE WORLD IN ONE DAY", 2, RED, true);
  drawTextCentered(W / 2, 26, "TUESDAY 24 NOVEMBER 2026", 6, NAVY, true);
  drawTextCentered(W / 2, 74, "40 STORIES - 7 REGIONS - EVERY ONE DATED TUESDAY 24 NOVEMBER 2026", 2, GREY, false);
  rect(MX, 92, CW, 3, GOLD);
  rect(MX, 97, CW, 2, NAVY);

  // Red lead ticker with gold diamond separators.
  rect(MX, 103, CW, 20, RED);
  {
    const gap = 16;
    let total = -gap;
    for (const s of TICKER) total += textWidth(s, 1) + 1 + gap;
    let tx = Math.round((W - total) / 2);
    const ty = 109.5;
    TICKER.forEach((s, i) => {
      drawText(tx, ty, s, 1, [255, 255, 255], true);
      tx += textWidth(s, 1) + 1;
      if (i < TICKER.length - 1) {
        const dx = tx + gap / 2;
        poly([[dx, 108], [dx + 4, 113], [dx, 118], [dx - 4, 113]], GOLD);
        tx += gap;
      }
    });
  }

  // Big number strip: six navy cells, huge gold numerals, two-line captions.
  rect(MX, 127, CW, 58, NAVY);
  for (let i = 0; i < 6; i++) {
    const ccx = MX + (CW * (i + 0.5)) / 6;
    drawTextCentered(ccx, 133, NUMBERS[i][0], 4, GOLD, true);
    drawTextCentered(ccx, 164, NUMBERS[i][1], 1, PALE, false);
    drawTextCentered(ccx, 174, NUMBERS[i][2], 1, PALE, false);
    if (i > 0) rect(MX + (CW * i) / 6 - 0.5, 134, 1, 44, [150, 122, 52]);
  }

  // Region count bar: coloured segments, counts summing to 40.
  {
    let rx = MX;
    for (const [label, wdt, bg, fg] of REGIONS) {
      rect(rx, 189, wdt, 18, bg);
      drawTextCentered(rx + wdt / 2, 194.5, label, 1, fg, true);
      rx += wdt;
    }
  }

  // The day in UTC: seven timed beats.
  drawText(MX, 211, "THE DAY IN UTC", 1, RED, true);
  rect(MX, 221, CW, 1, GOLD);
  for (let i = 0; i < TIMELINE.length; i++) {
    const ccx = MX + (CW * (i + 0.5)) / TIMELINE.length;
    circle(ccx, 221, 2.2, RED);
    drawTextCentered(ccx, 226, TIMELINE[i][0], 2, NAVY, true);
    drawTextCentered(ccx, 242, TIMELINE[i][1], 1, GREY, false);
  }

  // Hero panels: rows of 5, 5 and 3.
  for (let i = 0; i < 5; i++) drawPanel(MX + i * 197, 257, 188, 172, HEROES[i]);
  for (let i = 0; i < 5; i++) drawPanel(MX + i * 197, 435, 188, 172, HEROES[5 + i]);
  for (let i = 0; i < 3; i++) drawPanel(MX + i * 328, 613, 319, 158, HEROES[10 + i]);

  // Map strip with numbered pins for the 13 heroes.
  drawText(MX, 776, "WHERE IT HAPPENED", 2, NAVY, true);
  const mapY = 792;
  rect(MX, mapY, CW, 54, SEA);
  rect(MX, mapY, CW, 2, NAVY);
  rect(MX, mapY + 52, CW, 2, NAVY);
  rect(MX, mapY, 2, 54, NAVY);
  rect(MX + CW - 2, mapY, 2, 54, NAVY);
  ellipse(190, 818, 100, 20, LAND); // North America
  ellipse(268, 834, 42, 12, LAND); // South America
  ellipse(486, 810, 58, 13, LAND); // Europe
  ellipse(528, 824, 48, 19, LAND); // Africa
  ellipse(706, 812, 150, 23, LAND); // Asia
  ellipse(792, 832, 44, 8, LAND); // South-East Asia
  ellipse(872, 834, 48, 10, LAND); // Australia
  const pins = [
    [596, 828], // 1 Hormuz
    [470, 812], // 2 Paris
    [496, 802], // 3 Brussels
    [552, 802], // 4 Moscow
    [566, 820], // 5 Kirkuk
    [794, 830], // 6 Kuala Lumpur
    [542, 832], // 7 Gaza
    [850, 808], // 8 Ulleung
    [914, 838], // 9 Port Moresby
    [768, 840], // 10 Cikande
    [216, 808], // 11 New York
    [744, 822], // 12 Dhaka
    [176, 824], // 13 Mexico City
  ];
  for (let i = 0; i < pins.length; i++) {
    const [pxx, pyy] = pins[i];
    circle(pxx, pyy, 8, NAVY);
    circle(pxx, pyy, 6.8, GOLD);
    const ns = String(i + 1);
    drawText(pxx - textWidth(ns, 1) / 2, pyy - 3.5, ns, 1, NAVY, true);
  }

  // Also on Tuesday: items 14-40 in three columns of nine.
  drawText(MX, 852, "ALSO ON TUESDAY 24 NOVEMBER", 2, NAVY, true);
  rect(MX, 868, CW, 2, GOLD);
  for (let i = 0; i < ALSO.length; i++) {
    const colX = MX + Math.floor(i / 9) * 325;
    const iy = 876 + (i % 9) * 10;
    drawText(colX, iy, String(14 + i), 1, RED, true);
    drawText(colX + 18, iy, ALSO[i], 1, INK, false);
  }

  // Footer: date check (what was left out, and why) + certainty legend.
  rect(MX, 967, CW, 2, RED);
  rect(MX, 970, CW, 50, NAVY);
  const fx = MX + 10;
  rect(fx, 973, 66, 11, RED);
  drawText(fx + 4, 975, "DATE CHECK", 1, [255, 255, 255], true);
  drawText(fx + 74, 975, "LEFT OUT, NOT TUESDAY 24 NOV: NVIDIA REHIRES HUANG + WALL ST RALLY (MON 23 NOV) - COP31 COLLAPSE (22-23 NOV)", 1, PALE, false);
  drawText(fx, 984, "- BANTEN BLAZE BEGAN SAT 21 NOV: ONLY TODAY'S TOLL RISE COUNTED - KH-101 MISSILES IN POLAND (FRI 20 NOV)", 1, PALE, false);
  drawText(fx, 993, "- VANUATU M6.5 QUAKE (MON 23 NOV) - MERKURY SINKING (22 NOV)", 1, PALE, false);
  drawText(fx, 1002, "REPORTED = WIRES - OFFICIAL = ON THE RECORD - CLAIM = ONE SIDE SAYS - CONFIRMED = 2+ OUTLETS", 1, GOLD, false);
  drawText(fx, 1011, "EVERY STORY HAPPENED OR WAS FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026 (UTC). ALL DRAWINGS ARE ORIGINAL VECTOR ART.", 1, GOLD, false);
}

// --------------------------------------------------------------------- main -
drawPage();
const png = encodePNG();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), png);
console.log("entry.png bytes:", png.length);
