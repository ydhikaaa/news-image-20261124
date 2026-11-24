// news-image-20261124 — "The World In One Image"
// Draws a 1024x1024 broadsheet front page for Tuesday 24 November 2026 on a
// software pixel buffer and writes it as a PNG. Node 22, standard library
// only, fully deterministic (seeded scatter, no clock, no network).

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
const NAVY_DEEP = [11, 22, 46];
const GOLD = [206, 158, 40];
const GOLD_PALE = [233, 224, 198];
const RED = [176, 32, 40];
const INK = [38, 38, 40];
const GREY = [96, 94, 88];
const TAG_GREY = [216, 215, 208];
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

// A simple standing figure: head, torso, legs.
function person(x, y, s, c) {
  circle(x, y - 6 * s, 2.6 * s, c);
  line(x, y - 3.4 * s, x, y + 1.5 * s, c, 1.6 * s);
  line(x, y + 1.5 * s, x - 2.2 * s, y + 6 * s, c, 1.4 * s);
  line(x, y + 1.5 * s, x + 2.2 * s, y + 6 * s, c, 1.4 * s);
  line(x, y - 2 * s, x - 2.6 * s, y + 0.6 * s, c, 1.2 * s);
  line(x, y - 2 * s, x + 2.6 * s, y + 0.6 * s, c, 1.2 * s);
}

function warnTriangle(x, y, s, fill, edge) {
  tri(x, y + s, x + s / 2, y, x + s, y + s, edge);
  tri(x + 3, y + s - 2, x + s / 2, y + 4, x + s - 3, y + s - 2, fill);
  drawTextCentered(x + s / 2, y + s - 10, "!", 1, NAVY, true);
}

// ------------------------------------------------------------------ scenes -
// Every scene paints inside the box (x, y, w, h); the caller sets the clip
// to exactly that box before calling.
const SKY_DAY = [172, 202, 232];

function sceneOdesa(x, y, w, h) {
  rect(x, y, w, h, [22, 30, 56]); // night sky
  rect(x, y + h - 14, w, 14, [10, 13, 26]); // ground
  const r = rng(101);
  const towers = [0.04, 0.16, 0.30, 0.55, 0.68, 0.82];
  for (let i = 0; i < towers.length; i++) {
    const tw = 26 + Math.floor(r() * 16);
    const tx = x + towers[i] * w;
    const th = h * (0.45 + r() * 0.3);
    rect(tx, y + h - 14 - th, tw, th, [12, 16, 32]);
    for (let wy = y + h - 14 - th + 5; wy < y + h - 20; wy += 8) {
      for (let wx = tx + 4; wx < tx + tw - 4; wx += 7) {
        if (r() < 0.16) rect(wx, wy, 3, 4, [250, 205, 92]); // few lit windows
      }
    }
  }
  // Blast: concentric burst with smoke above.
  const bx = x + w * 0.44;
  const by = y + h * 0.52;
  circle(bx, by, 17, [238, 116, 30]);
  circle(bx, by, 11, [250, 176, 52]);
  circle(bx, by, 5, [255, 240, 200]);
  circle(bx - 8, by - 22, 9, [104, 104, 112]);
  circle(bx + 4, by - 30, 12, [88, 88, 98]);
  circle(bx + 14, by - 20, 8, [116, 116, 124]);
  // No-power sign: gold bolt on a dark plaque with a red slash.
  const sx = x + w * 0.06;
  const sy = y + h - 42;
  rect(sx, sy, 26, 30, [30, 30, 36]);
  poly(
    [
      [sx + 14, sy + 3],
      [sx + 21, sy + 3],
      [sx + 16, sy + 12],
      [sx + 21, sy + 12],
      [sx + 10, sy + 27],
      [sx + 13, sy + 15],
      [sx + 8, sy + 15],
    ],
    GOLD
  );
  line(sx + 3, sy + 27, sx + 23, sy + 3, RED, 2.4);
}

function sceneArena(x, y, w, h) {
  rect(x, y, w, h, [198, 207, 216]);
  // Arena bowl.
  ellipse(x + w * 0.42, y + h * 0.58, w * 0.34, h * 0.34, [148, 92, 108]);
  ellipse(x + w * 0.42, y + h * 0.55, w * 0.29, h * 0.27, [214, 196, 178]);
  ellipse(x + w * 0.42, y + h * 0.57, w * 0.19, h * 0.17, [120, 158, 110]);
  // Crowd dots streaming out to the right-hand exits.
  const r = rng(202);
  for (let i = 0; i < 90; i++) {
    const t = r();
    const dx = x + w * (0.55 + t * 0.42);
    const dy = y + h * (0.30 + r() * 0.55);
    circle(dx, dy, 1.6, [58, 58, 70]);
  }
  for (let i = 0; i < 40; i++) {
    const dx = x + w * (0.16 + r() * 0.5);
    const dy = y + h * (0.34 + r() * 0.4);
    circle(dx, dy, 1.5, [70, 66, 76]);
  }
  // Unknown-substance cloud over the bowl.
  circle(x + w * 0.30, y + h * 0.34, 15, [168, 190, 168]);
  circle(x + w * 0.40, y + h * 0.28, 19, [178, 198, 178]);
  circle(x + w * 0.50, y + h * 0.35, 14, [160, 184, 160]);
  circle(x + w * 0.40, y + h * 0.40, 16, [186, 204, 186]);
  warnTriangle(x + 10, y + h - 34, 24, [250, 205, 60], NAVY);
}

function sceneFactory(x, y, w, h) {
  rect(x, y, w, h, [74, 84, 106]); // dusk sky
  rect(x, y + h - 12, w, 12, [40, 40, 46]); // ground
  const bx = x + w * 0.10;
  const bw = w * 0.56;
  const by = y + h - 12;
  rect(bx, by - 40, bw, 40, [28, 28, 36]); // factory block
  for (let i = 0; i < 4; i++) {
    tri(bx + i * (bw / 4), by - 40, bx + (i + 0.5) * (bw / 4), by - 54, bx + (i + 1) * (bw / 4), by - 40, [28, 28, 36]);
  }
  rect(bx + bw - 16, by - 78, 10, 40, [28, 28, 36]); // chimney
  for (let i = 0; i < 6; i++) rect(bx + 8 + i * 16, by - 32, 9, 10, [250, 205, 92]);
  // Flames along the roofline and base.
  const flame = (fx, fs) => {
    tri(fx - fs, by - 40, fx, by - 40 - fs * 2.2, fx + fs, by - 40, [238, 116, 30]);
    tri(fx - fs * 0.55, by - 40, fx, by - 40 - fs * 1.4, fx + fs * 0.55, by - 40, [250, 190, 60]);
  };
  flame(bx + bw * 0.25, 9);
  flame(bx + bw * 0.52, 12);
  flame(bx + bw * 0.78, 8);
  tri(bx + 6, by, bx + 14, by - 22, bx + 22, by, [238, 116, 30]);
  // Smoke.
  circle(bx + bw - 11, by - 88, 8, [120, 120, 128]);
  circle(bx + bw + 2, by - 90, 10, [104, 104, 114]);
  circle(bx + bw * 0.5, by - 66, 10, [96, 96, 106]);
  circle(bx + bw * 0.62, by - 74, 13, [110, 110, 118]);
  // Firefighters with a hose arc.
  person(x + w * 0.80, by - 16, 1.5, [16, 16, 20]);
  person(x + w * 0.87, by - 16, 1.5, [16, 16, 20]);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const hx = x + w * 0.84 - t * w * 0.30;
    const hy = by - 22 - Math.sin(t * Math.PI) * 22 + t * 10;
    circle(hx, hy, 1.5, [196, 226, 250]);
  }
}

function sceneSeoul(x, y, w, h) {
  rect(x, y, w, h, SKY_DAY);
  rect(x, y + h - 10, w, 10, [140, 150, 140]);
  const bx = x + w * 0.22;
  const bw = w * 0.56;
  const by = y + h - 10;
  tri(bx - 8, by - 44, bx + bw / 2, by - 62, bx + bw + 8, by - 44, NAVY);
  rect(bx, by - 44, bw, 34, [242, 240, 232]);
  for (let i = 0; i < 5; i++) rect(bx + 8 + i * (bw / 5), by - 40, 5, 28, [178, 182, 190]);
  rect(bx - 4, by - 10, bw + 8, 4, [200, 198, 188]);
  // Two flags on poles in front.
  const flag = (fx, draw) => {
    line(fx, by, fx, by - 58, [60, 60, 66], 2);
    draw(fx);
  };
  flag(x + w * 0.10, (fx) => {
    rect(fx + 1, by - 58, 30, 19, [250, 250, 248]);
    circle(fx + 16, by - 48, 6, RED);
    circle(fx + 16, by - 48, 3, [40, 80, 170]);
  });
  flag(x + w * 0.86, (fx) => {
    rect(fx + 1, by - 58, 30, 19, [40, 80, 170]);
    rect(fx + 1, by - 52, 30, 4, [250, 250, 248]);
    rect(fx + 1, by - 45, 30, 4, RED);
  });
}

function sceneMexico(x, y, w, h) {
  rect(x, y, w, h, [243, 214, 152]);
  circle(x + w * 0.82, y + h * 0.24, 13, [250, 196, 60]);
  rect(x, y + h * 0.62, w, h * 0.38, [226, 192, 122]); // sand
  // Cactus.
  const cx = x + w * 0.08;
  const cy = y + h * 0.94;
  rect(cx, cy - 44, 8, 44, [52, 128, 66]);
  rect(cx - 10, cy - 34, 6, 16, [52, 128, 66]);
  rect(cx - 10, cy - 20, 12, 5, [52, 128, 66]);
  rect(cx + 6, cy - 40, 6, 20, [52, 128, 66]);
  rect(cx + 4, cy - 22, 12, 5, [52, 128, 66]);
  // Patrol vehicles.
  const truck = (tx, ty, s) => {
    rect(tx, ty - 14 * s, 44 * s, 11 * s, [44, 48, 54]);
    rect(tx + 26 * s, ty - 21 * s, 14 * s, 8 * s, [44, 48, 54]);
    rect(tx + 28 * s, ty - 19 * s, 9 * s, 5 * s, [170, 205, 230]);
    circle(tx + 10 * s, ty - 2 * s, 4.4 * s, [18, 18, 20]);
    circle(tx + 34 * s, ty - 2 * s, 4.4 * s, [18, 18, 20]);
  };
  truck(x + w * 0.30, y + h * 0.88, 1);
  truck(x + w * 0.60, y + h * 0.80, 0.8);
  // Dust clouds.
  circle(x + w * 0.26, y + h * 0.82, 8, [238, 216, 168]);
  circle(x + w * 0.56, y + h * 0.74, 6, [238, 216, 168]);
  circle(x + w * 0.20, y + h * 0.88, 6, [240, 222, 178]);
}

function sceneSyria(x, y, w, h) {
  rect(x, y, w, h, [204, 188, 162]);
  rect(x, y + h * 0.66, w, h * 0.34, [188, 170, 140]);
  const r = rng(606);
  for (let i = 0; i < 26; i++) {
    const gx = x + r() * w;
    const gy = y + h * (0.62 + r() * 0.32);
    const s = 4 + r() * 9;
    tri(gx, gy, gx + s, gy - s * 0.7, gx + s * 1.7, gy, [128, 122, 110]);
  }
  // Cracked ground.
  line(x + w * 0.08, y + h * 0.86, x + w * 0.30, y + h * 0.80, [110, 98, 80], 1.4);
  line(x + w * 0.30, y + h * 0.80, x + w * 0.44, y + h * 0.88, [110, 98, 80], 1.4);
  line(x + w * 0.62, y + h * 0.92, x + w * 0.84, y + h * 0.84, [110, 98, 80], 1.4);
  // Mine warning sign on a post.
  const sx = x + w * 0.60;
  line(sx + 17, y + h * 0.92, sx + 17, y + h * 0.34, [70, 62, 52], 3);
  warnTriangle(sx, y + h * 0.16, 34, [250, 250, 246], RED);
}

function sceneSinger(x, y, w, h) {
  rect(x, y, w, h, [42, 32, 54]);
  // Spotlight cone.
  tri(x + w * 0.44, y, x + w * 0.56, y, x + w * 0.68, y + h, [238, 228, 178]);
  tri(x + w * 0.47, y, x + w * 0.53, y, x + w * 0.62, y + h, [246, 238, 200]);
  rect(x, y + h - 8, w, 8, [24, 18, 34]); // stage floor
  // Curtains.
  for (const side of [0, 1]) {
    const cx0 = side === 0 ? x : x + w - 26;
    rect(cx0, y, 26, h, [150, 30, 44]);
    for (let i = 1; i < 4; i++) rect(cx0 + i * 7, y, 2, h, [116, 22, 36]);
  }
  // Singer silhouette in the light.
  const sx = x + w * 0.56;
  const sy = y + h - 8;
  circle(sx, sy - 42, 6, [16, 12, 22]);
  tri(sx - 11, sy, sx, sy - 38, sx + 11, sy, [16, 12, 22]);
  line(sx + 4, sy - 30, sx + 13, sy - 36, [16, 12, 22], 2); // raised arm
  circle(sx + 14, sy - 37, 2.4, [16, 12, 22]); // microphone
  // Barred window at the side.
  const wx = x + w * 0.80;
  const wy = y + h * 0.16;
  rect(wx, wy, 26, 34, [120, 128, 140]);
  for (let i = 0; i < 4; i++) rect(wx + 3 + i * 6, wy, 2.4, 34, [52, 56, 66]);
  rect(wx, wy, 26, 3, [52, 56, 66]);
  rect(wx, wy + 31, 26, 3, [52, 56, 66]);
}

function sceneCourt(x, y, w, h) {
  rect(x, y, w, h, [212, 206, 190]);
  const bx = x + w * 0.10;
  const bw = w * 0.52;
  const by = y + h - 8;
  tri(bx - 6, by - 52, bx + bw / 2, by - 68, bx + bw + 6, by - 52, [150, 144, 128]);
  rect(bx, by - 52, bw, 6, [168, 162, 144]);
  for (let i = 0; i < 4; i++) rect(bx + 8 + i * (bw / 4), by - 46, 7, 34, [238, 234, 220]);
  rect(bx - 4, by - 12, bw + 8, 4, [168, 162, 144]);
  rect(bx - 8, by - 6, bw + 16, 3, [150, 144, 128]);
  // Scales of justice in front.
  const sx = x + w * 0.76;
  const sy = y + h - 8;
  line(sx, sy, sx, sy - 52, [90, 78, 40], 2.4);
  line(sx - 18, sy - 50, sx + 18, sy - 50, [90, 78, 40], 2.4);
  for (const sgn of [-1, 1]) {
    line(sx + sgn * 18, sy - 50, sx + sgn * 24, sy - 36, [90, 78, 40], 1.2);
    line(sx + sgn * 18, sy - 50, sx + sgn * 12, sy - 36, [90, 78, 40], 1.2);
    tri(sx + sgn * 18 - 8, sy - 36, sx + sgn * 18 + 8, sy - 36, sx + sgn * 18, sy - 30, GOLD);
  }
  circle(sx, sy - 55, 3, GOLD);
  rect(sx - 10, sy - 2, 20, 3, [110, 96, 58]); // plinth under the scales
}

function sceneGaza(x, y, w, h) {
  rect(x, y, w, h, [192, 182, 160]);
  // Ruined blocks.
  const ruin = (rx, ry, rw, rh, tilt) => {
    rect(rx, ry, rw, rh, [128, 122, 110]);
    rect(rx + 4, ry + 6, 8, 9, [92, 88, 80]);
    rect(rx + rw - 13, ry + 14, 8, 9, [92, 88, 80]);
    tri(rx + rw, ry, rx + rw + tilt, ry + 12, rx + rw, ry + 14, [192, 182, 160]);
  };
  ruin(x + w * 0.06, y + h * 0.22, 40, h * 0.52, 8);
  ruin(x + w * 0.30, y + h * 0.34, 34, h * 0.40, -7);
  ruin(x + w * 0.50, y + h * 0.18, 44, h * 0.56, 10);
  rect(x, y + h * 0.74, w, 3, [150, 142, 126]);
  // Contaminated pool.
  ellipse(x + w * 0.30, y + h * 0.86, w * 0.20, h * 0.10, [86, 156, 78]);
  ellipse(x + w * 0.30, y + h * 0.85, w * 0.15, h * 0.06, [104, 178, 94]);
  circle(x + w * 0.24, y + h * 0.85, 2.4, [60, 120, 54]);
  circle(x + w * 0.36, y + h * 0.88, 2, [60, 120, 54]);
  // Test vial.
  const vx = x + w * 0.80;
  const vy = y + h * 0.30;
  rect(vx, vy, 13, 40, [240, 242, 240]);
  rect(vx, vy + 22, 13, 18, [86, 170, 84]);
  rect(vx - 2, vy - 5, 17, 5, [150, 60, 60]);
  circle(vx + 4, vy + 28, 1.8, [220, 245, 220]);
  circle(vx + 9, vy + 33, 1.5, [220, 245, 220]);
  line(vx + 6, vy + 40, vx + 6, vy + 50, [90, 90, 90], 2);
  rect(vx - 4, vy + 50, 21, 4, [90, 90, 90]);
}

function sceneArmenia(x, y, w, h) {
  rect(x, y, w, h, [236, 226, 196]);
  // Parchment scroll.
  const sx = x + w * 0.16;
  const sy = y + h * 0.24;
  const sw = w * 0.52;
  const sh = h * 0.58;
  rect(sx, sy, sw, sh, [250, 242, 216]);
  circle(sx, sy + sh / 2, 9, [226, 208, 168]);
  circle(sx + sw, sy + sh / 2, 9, [226, 208, 168]);
  circle(sx, sy + sh / 2, 4.4, [200, 178, 130]);
  circle(sx + sw, sy + sh / 2, 4.4, [200, 178, 130]);
  for (let i = 0; i < 4; i++) rect(sx + 12, sy + 9 + i * 9, sw - 24, 2.4, [168, 158, 132]);
  rect(sx + 12, sy + 9 + 4 * 9, sw - 44, 2.4, [168, 158, 132]);
  // Quill resting on the scroll.
  const qx = sx + sw - 16;
  const qy = sy + sh - 8;
  poly(
    [
      [qx, qy],
      [qx + 16, qy - 22],
      [qx + 20, qy - 12],
      [qx + 8, qy + 2],
    ],
    [252, 252, 250]
  );
  line(qx, qy, qx + 17, qy - 19, [150, 148, 140], 1.2);
  // Two doves above.
  const dove = (dx, dy, s) => {
    ellipse(dx, dy, 11 * s, 5.5 * s, [252, 252, 250]);
    circle(dx + 10 * s, dy - 3.4 * s, 3.6 * s, [252, 252, 250]);
    tri(dx - 2 * s, dy - 2 * s, dx - 10 * s, dy - 10 * s, dx + 4 * s, dy - 4 * s, [240, 240, 236]);
    tri(dx - 11 * s, dy, dx - 17 * s, dy - 4 * s, dx - 10 * s, dy + 3 * s, [240, 240, 236]);
    circle(dx + 11.4 * s, dy - 3.8 * s, 0.9 * s, NAVY);
  };
  dove(x + w * 0.16, y + h * 0.18, 0.9);
  dove(x + w * 0.82, y + h * 0.14, 0.75);
}

function sceneTrain(x, y, w, h) {
  rect(x, y, w, h, [176, 206, 236]);
  tri(x - 10, y + h * 0.66, x + w * 0.30, y + h * 0.16, x + w * 0.62, y + h * 0.66, [96, 156, 96]);
  tri(x + w * 0.42, y + h * 0.66, x + w * 0.72, y + h * 0.26, x + w + 10, y + h * 0.66, [110, 168, 104]);
  rect(x, y + h * 0.66, w, h * 0.34, [150, 146, 128]); // ground
  // Track.
  line(x, y + h * 0.86, x + w, y + h * 0.86, [70, 70, 74], 2);
  line(x, y + h * 0.93, x + w, y + h * 0.93, [70, 70, 74], 2);
  for (let tx = x + 6; tx < x + w; tx += 14) rect(tx, y + h * 0.85, 3, h * 0.09, [110, 88, 60]);
  // Train.
  const tx = x + w * 0.10;
  const ty = y + h * 0.86;
  const tw = w * 0.72;
  rect(tx, ty - 34, tw, 30, [196, 40, 44]);
  rect(tx, ty - 34, tw, 6, [150, 28, 32]);
  rect(tx + tw - 16, ty - 40, 14, 36, [170, 34, 38]); // cab end
  for (let i = 0; i < 6; i++) rect(tx + 8 + i * (tw / 6.4), ty - 28, 12, 10, [206, 232, 246]);
  rect(tx + 4, ty - 12, tw - 8, 3, [250, 205, 92]);
  circle(tx + 16, ty - 2, 5, [26, 26, 30]);
  circle(tx + 40, ty - 2, 5, [26, 26, 30]);
  circle(tx + tw - 24, ty - 2, 5, [26, 26, 30]);
  circle(tx + tw - 48, ty - 2, 5, [26, 26, 30]);
  // Ceremony flags on the front.
  line(tx + tw - 9, ty - 40, tx + tw - 9, ty - 56, [60, 60, 66], 1.6);
  tri(tx + tw - 9, ty - 56, tx + tw - 9, ty - 48, tx + tw + 3, ty - 52, [250, 140, 40]);
  tri(tx + tw - 9, ty - 56, tx + tw - 9, ty - 48, tx + tw - 21, ty - 52, [40, 140, 70]);
}

function sceneNK(x, y, w, h) {
  rect(x, y, w, h, [202, 202, 208]);
  const bx = x + w * 0.14;
  const bw = w * 0.52;
  const by = y + h - 8;
  rect(bx, by - 44, bw, 44, [122, 122, 136]);
  const r = rng(1212);
  for (let wy = by - 39; wy < by - 6; wy += 9) {
    for (let wx = bx + 6; wx < bx + bw - 8; wx += 11) {
      rect(wx, wy, 6, 5.4, r() < 0.4 ? [250, 220, 130] : [168, 174, 188]);
    }
  }
  // Flag on the roof: red field, gold star. Kept inside the scene box even
  // at the small panel height (pole top at by-62, building top at by-44).
  line(bx + bw / 2, by - 44, bx + bw / 2, by - 62, [50, 50, 56], 2);
  rect(bx + bw / 2 + 1, by - 62, 30, 17, [206, 36, 44]);
  star(bx + bw / 2 + 16, by - 53.5, 5, 2.1, GOLD);
  // Sealed envelope in front.
  const ex = x + w * 0.74;
  const ey = y + h * 0.52;
  rect(ex, ey, 40, 28, [250, 248, 240]);
  line(ex, ey, ex + 20, ey + 13, [188, 184, 172], 1.4);
  line(ex + 40, ey, ex + 20, ey + 13, [188, 184, 172], 1.4);
  circle(ex + 20, ey + 15, 5.4, RED);
  star(ex + 20, ey + 15, 3, 1.3, [250, 240, 220]);
}

function sceneAus(x, y, w, h) {
  rect(x, y, w, h, [202, 216, 236]);
  // Skyline.
  const r = rng(1313);
  let sx = x + 4;
  while (sx < x + w - 16) {
    const bw = 16 + Math.floor(r() * 14);
    const bh = h * (0.34 + r() * 0.30);
    rect(sx, y + h - bh, bw, bh, [88, 102, 128]);
    for (let wy = y + h - bh + 5; wy < y + h - 6; wy += 7) {
      for (let wx = sx + 3; wx < sx + bw - 4; wx += 6) {
        if (r() < 0.5) rect(wx, wy, 3, 3.4, [250, 224, 130]);
      }
    }
    sx += bw + 4;
  }
  // Rising chart card.
  const cx = x + w * 0.30;
  const cy = y + h * 0.16;
  const cw = w * 0.40;
  const chh = h * 0.52;
  rect(cx - 2, cy - 2, cw + 4, chh + 4, NAVY);
  rect(cx, cy, cw, chh, [252, 252, 250]);
  const pts = [
    [cx + 6, cy + chh - 7],
    [cx + cw * 0.3, cy + chh * 0.62],
    [cx + cw * 0.52, cy + chh * 0.70],
    [cx + cw * 0.76, cy + chh * 0.34],
    [cx + cw - 8, cy + 8],
  ];
  for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], [36, 150, 70], 2.2);
  tri(cx + cw - 16, cy + 6, cx + cw - 4, cy + 6, cx + cw - 5, cy + 16, [36, 150, 70]);
  // Gold dollar coin.
  const gx = x + w * 0.85;
  const gy = y + h * 0.40;
  circle(gx, gy, 16, [188, 140, 30]);
  circle(gx, gy, 13.5, GOLD);
  drawTextCentered(gx, gy - 7, "$", 2, NAVY, true);
}

const SCENES = [
  sceneOdesa,
  sceneArena,
  sceneFactory,
  sceneSeoul,
  sceneMexico,
  sceneSyria,
  sceneSinger,
  sceneCourt,
  sceneGaza,
  sceneArmenia,
  sceneTrain,
  sceneNK,
  sceneAus,
];

// ----------------------------------------------------------------- stories -
const LEADS = [
  {
    n: 1,
    tag: "REPORTED",
    head: "ODESA STRUCK: POWER, HEAT AND WATER CUT",
    sum: "Russian strikes on Odesa leave the port city without power, heat or water as repair crews race to restore supplies.",
  },
  {
    n: 2,
    tag: "REPORTED",
    head: "12,000 EVACUATED FROM MANCHESTER CONCERT",
    sum: "Police clear a packed Manchester concert venue after an unknown substance is released; fans stream to the exits.",
  },
  {
    n: 3,
    tag: "OFFICIAL",
    head: "INDONESIA FACTORY BLAZE TOLL RISES TO 24",
    sum: "Indonesia says 24 workers died in the Banten sweets-factory fire, and rescuers still search for dozens missing.",
  },
];

const PANELS = [
  {
    n: 4,
    tag: "REPORTED",
    head: "SEOUL NAMES NEW FOREIGN MINISTER, SPY CHIEF",
    sum: "South Korea's president nominates a new foreign minister and intelligence chief amid US worries.",
  },
  {
    n: 5,
    tag: "OFFICIAL",
    head: "16 KILLED AS MEXICO CAPTURES CARTEL BOSS",
    sum: "Mexican forces kill 16 suspected cartel gunmen while capturing the leader known as El Chapo Isidro.",
  },
  {
    n: 6,
    tag: "REPORTED",
    head: "LANDMINE KILLS FIVE CHILDREN IN SYRIA",
    sum: "A landmine blast in northwestern Syria kills five children, a reminder of the war's buried toll.",
  },
  {
    n: 7,
    tag: "REPORTED",
    head: "IRANIAN SINGER LASHED FOR HIJAB-FREE SHOW",
    sum: "An Iranian singer and four of her team each receive 74 lashes for performing without a hijab.",
  },
  {
    n: 8,
    tag: "REPORTED",
    head: "BANGLADESH VOWS TO ARREST HASINA",
    sum: "Bangladesh says ex-PM Sheikh Hasina will be arrested if she returns from exile in India.",
  },
  {
    n: 9,
    tag: "REPORTED",
    head: "GAZA'S LAND AND WATER POISONED, STUDY SAYS",
    sum: "An Oxfam-backed analysis finds toxic contamination across Gaza threatening health for decades.",
  },
  {
    n: 10,
    tag: "REPORTED",
    head: "ARMENIA DRAFTS NEW CONSTITUTION FOR PEACE",
    sum: "Armenia proposes a new constitution to advance its peace negotiations with Azerbaijan.",
  },
  {
    n: 11,
    tag: "OFFICIAL",
    head: "INDIA-NEPAL EXPRESS TRAIN FLAGGED OFF",
    sum: "Modi and Nepal's PM flag off the Saryu-Kamala Express linking Ayodhya with Janakpur Dham.",
  },
  {
    n: 12,
    tag: "REPORTED",
    head: "NORTH KOREA MAY CLOSE SWISS OFFICE",
    sum: "Pyongyang condemns Swiss sanctions on a children's camp and may shut the Swiss office, KCNA says.",
  },
  {
    n: 13,
    tag: "OFFICIAL",
    head: "AUSTRALIANSUPER BACKS $2.53BN TAKEOVER",
    sum: "Australia's biggest pension fund backs Brookfield's $2.53 billion bid for Reliance Worldwide.",
  },
];

const ALSO = [
  "EU: RUSSIA FLOATS RENEWED TALKS WITH US AND UKRAINE",
  "EU: DENMARK SCHOOL BOMB ALERTS PROVE UNFOUNDED",
  "EU: ESTONIA REJECTS RUSSIAN AIRSPACE CLAIM",
  "EU: BALTIC TRIO SET NEW MEASURES AGAINST RUSSIA",
  "EU: EU ACADEMY PLATFORM HIT BY CYBER INCIDENT",
  "EU: FERRARI UNVEILS 296 CHALLENGE STRADALE",
  "EU: RAYA RULED OUT OF ARSENAL'S DORTMUND CLASH",
  "AP: CHINA SETS 2030 ELDERLY-CARE, CHILDCARE TARGETS",
  "AP: MYANMAR JUNTA CALLS ASEAN RULING UNFAIR",
  "AP: TALIBAN ERASE WOMEN'S NAMES IN BALKH PAPERS",
  "AP: SPICEJET PILOTS PLEAD FOR A RESCUE",
  "AP: INDIA'S OIL IMPORT BILL JUMPS 60 PERCENT",
  "AP: PANT'S 128 SETS A WICKETKEEPER RECORD",
  "AM: CANADA AND QATAR TO SIGN INVESTMENT PACT",
  "AM: PANAMA REOPENS COBRE PANAMA MINE TALKS",
  "AM: TRUMP'S KIM OUTREACH IGNORED, WSJ REPORTS",
  "ME: FRANCE CONDEMNS SETTLER ATTACKS IN WEST BANK",
  "AF: SUDAN'S WOMEN BEAR THE WAR'S BURDEN ALONE",
  "OC: VICTORIA VOTE PUTS HANSON TO THE TEST",
  "WORLD: COP31 FALLOUT, FOSSIL-FUEL RIFT OUTLIVES SUMMIT",
];

// ------------------------------------------------------------------ panels -
function drawPanel(x, y, w, h, story, lead) {
  rect(x, y, w, h, NAVY);
  rect(x + 2, y + 2, w - 4, h - 4, PANEL_BG);
  const pad = lead ? 7 : 5;
  const sx = x + 2 + pad;
  const sy = y + 2 + pad;
  const sw = w - 4 - pad * 2;
  const sh = lead ? 108 : 70;

  // Scene, hard-clipped to its own box, with a thin navy frame.
  rect(sx - 1, sy - 1, sw + 2, sh + 2, NAVY);
  setClip(sx, sy, sw, sh);
  SCENES[story.n - 1](sx, sy, sw, sh);
  resetClip();

  // Gold number badge, top-left over the scene.
  const br = lead ? 13 : 10;
  const bcx = sx + br + 2;
  const bcy = sy + br + 2;
  circle(bcx, bcy, br + 1.6, NAVY);
  circle(bcx, bcy, br, GOLD);
  const bScale = lead ? 2 : 1;
  const numStr = String(story.n);
  drawText(bcx - textWidth(numStr, bScale) / 2, bcy - (7 * bScale) / 2, numStr, bScale, NAVY, true);

  // Source tag, top-right over the scene.
  const tagW = textWidth(story.tag, 1) + 8;
  const tagX = sx + sw - tagW - 3;
  const tagY = sy + 3;
  if (story.tag === "OFFICIAL") {
    rect(tagX, tagY, tagW, 13, GOLD);
    drawText(tagX + 4, tagY + 3, story.tag, 1, NAVY, true);
  } else {
    rect(tagX, tagY, tagW, 13, TAG_GREY);
    drawText(tagX + 4, tagY + 3, story.tag, 1, [70, 70, 70], true);
  }

  // Headline.
  const hScale = lead ? 2 : 1;
  let cy = sy + sh + (lead ? 9 : 7);
  const hLines = wrapText(story.head, sw, hScale);
  for (const ln of hLines) {
    drawText(sx, cy, ln, hScale, NAVY, true);
    cy += 7 * hScale + 3;
  }

  // Summary.
  cy += lead ? 3 : 2;
  const sLines = wrapText(story.sum, sw, 1);
  for (const ln of sLines) {
    drawText(sx, cy, ln, 1, GREY, false);
    cy += 10;
  }
}

// -------------------------------------------------------------------- page -
function drawPage() {
  rect(0, 0, W, H, PAPER);
  const MX = 24;
  const CW = W - MX * 2; // 976

  // Masthead.
  drawTextCentered(W / 2, 16, "THE WORLD IN ONE IMAGE", 2, RED, true);
  drawTextCentered(W / 2, 36, "24 NOVEMBER 2026", 7, NAVY, true);
  drawTextCentered(W / 2, 92, "TUESDAY - ALL TIMES UTC - 33 STORIES, 7 REGIONS", 2, GREY, false);
  rect(MX, 112, CW, 4, GOLD);
  rect(MX, 119, CW, 2, NAVY);

  // Stats strip: five navy cells, big gold numeral over a small label.
  const stats = [
    ["12,000", "EVACUATED - MANCHESTER"],
    ["24", "DEAD IN BANTEN BLAZE"],
    ["5", "CHILDREN KILLED BY MINE"],
    ["16", "KILLED IN CARTEL RAID"],
    ["74", "LASHES FOR A SINGER"],
  ];
  rect(MX, 124, CW, 52, NAVY);
  const cellW = CW / 5;
  for (let i = 0; i < 5; i++) {
    const ccx = MX + cellW * i + cellW / 2;
    drawTextCentered(ccx, 130, stats[i][0], 4, GOLD, true);
    drawTextCentered(ccx, 162, stats[i][1], 1, [238, 236, 228], false);
    if (i > 0) rect(MX + cellW * i - 0.5, 131, 1, 38, [150, 122, 52]);
  }

  // Region bar.
  rect(MX, 182, CW, 20, GOLD_PALE);
  rect(MX, 182, CW, 1, NAVY);
  rect(MX, 201, CW, 1, NAVY);
  drawTextCentered(
    W / 2,
    188,
    "EUROPE 10 - ASIA-PACIFIC 11 - AMERICAS 4 - MIDDLE EAST 4 - AFRICA 1 - OCEANIA 2 - WORLD 1",
    1,
    NAVY,
    true
  );

  // Lead panels.
  const leadW = 318;
  for (let i = 0; i < 3; i++) {
    drawPanel(MX + i * (leadW + 11), 208, leadW, 208, LEADS[i], true);
  }

  // Ten panels in two rows of five.
  const panW = 187;
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    drawPanel(MX + col * (panW + 10), 424 + row * 166, panW, 158, PANELS[i], false);
  }

  // Map strip.
  const mapY = 754;
  rect(MX, mapY, CW, 92, SEA);
  rect(MX, mapY, CW, 2, NAVY);
  rect(MX, mapY + 90, CW, 2, NAVY);
  rect(MX, mapY, 2, 92, NAVY);
  rect(MX + CW - 2, mapY, 2, 92, NAVY);
  ellipse(180, 784, 95, 26, LAND); // North America
  ellipse(262, 820, 40, 18, LAND); // South America
  ellipse(478, 772, 56, 15, LAND); // Europe
  ellipse(520, 806, 46, 28, LAND); // Africa
  ellipse(700, 780, 145, 30, LAND); // Asia
  ellipse(788, 812, 42, 10, LAND); // South-East Asia
  ellipse(866, 820, 46, 13, LAND); // Australia
  // Title drawn after the continents so the landmass can never cover it.
  drawText(MX + 12, mapY + 8, "WHERE IT HAPPENED", 2, NAVY, true);
  const pins = [
    [522, 776], // 1 Odesa
    [462, 764], // 2 Manchester
    [788, 814], // 3 Banten
    [834, 778], // 4 Seoul
    [168, 792], // 5 Mexico
    [552, 784], // 6 Syria
    [582, 790], // 7 Iran
    [742, 792], // 8 Bangladesh
    [536, 796], // 9 Gaza
    [570, 772], // 10 Armenia
    [716, 790], // 11 India-Nepal
    [848, 762], // 12 North Korea
    [868, 820], // 13 Australia
  ];
  for (let i = 0; i < pins.length; i++) {
    const [pxx, pyy] = pins[i];
    circle(pxx, pyy, 8, NAVY);
    circle(pxx, pyy, 6.8, GOLD);
    const ns = String(i + 1);
    drawText(pxx - textWidth(ns, 1) / 2, pyy - 3.5, ns, 1, NAVY, true);
  }

  // Also on the front page: twenty items in two columns.
  drawText(MX, 852, "ALSO ON THE FRONT PAGE", 2, NAVY, true);
  rect(MX, 870, CW, 2, GOLD);
  for (let i = 0; i < 20; i++) {
    const colX = i < 10 ? MX : MX + 488;
    const iy = 876 + (i % 10) * 10;
    drawText(colX, iy, String(14 + i), 1, RED, true);
    drawText(colX + 18, iy, ALSO[i], 1, INK, false);
  }

  // Footer.
  rect(MX, 978, CW, 40, NAVY);
  drawTextCentered(W / 2, 983, "DATE CHECK: EVERY STORY ABOVE WAS FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026.", 1, GOLD, true);
  drawTextCentered(
    W / 2,
    995,
    "NOT THIS DAY: NVIDIA +31% RALLY (MON 23 NOV) - COP31 DEAL COLLAPSE (22-23 NOV) - MERKURY SINKING (22 NOV)",
    1,
    [238, 236, 228],
    false
  );
  drawTextCentered(
    W / 2,
    1007,
    "- VANUATU M6.5 QUAKE (23 NOV) - ASIA AI STOCK ROUT (23 NOV). SOURCES: REUTERS, AP VIA PRESS ROUND-UPS, KCNA.",
    1,
    [238, 236, 228],
    false
  );
}

// --------------------------------------------------------------------- main -
drawPage();
const png = encodePNG();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), png);
console.log("entry.png bytes:", png.length);
