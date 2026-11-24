// news-image-20261124: Tuesday 24 November 2026 world news in one image.
// Node 22, standard library only. Software pixel renderer -> PNG.
// Deterministic: the output is a pure function of the constants below.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------- PNG encoder ----------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(px: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3;
      const d = y * stride + 1 + x * 3;
      raw[d] = px[s];
      raw[d + 1] = px[s + 1];
      raw[d + 2] = px[s + 2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- canvas ----------
const PX = new Uint8Array(W * H * 3);
type RGB = [number, number, number];
let CLIP: [number, number, number, number] | null = null;
function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (CLIP && (x < CLIP[0] || y < CLIP[1] || x >= CLIP[2] || y >= CLIP[3])) return;
  const i = (y * W + x) * 3;
  PX[i] = c[0];
  PX[i + 1] = c[1];
  PX[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++)
    for (let xx = cx - r; xx <= cx + r; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPx(xx, yy, c);
    }
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) setPx(x + a, y + b, c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.max(0, Math.min(x0, x1, x2));
  const maxX = Math.min(W - 1, Math.max(x0, x1, x2));
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const w1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) setPx(x, y, c);
    }
}

// ---------- 5x7 bitmap font (uppercase set) ----------
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
};
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = GLYPHS[up[i]] || GLYPHS[" "];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") rect(x + i * 6 * scale + col * scale, y + r * scale, scale, scale, c);
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(Math.round(cx - textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- palette ----------
const PAPER: RGB = [243, 238, 226];
const INK: RGB = [22, 24, 30];
const NAVY: RGB = [18, 32, 64];
const GOLD: RGB = [196, 148, 32];
const RED: RGB = [178, 34, 40];
const GREY: RGB = [96, 100, 110];
const LGREY: RGB = [206, 200, 186];
const SKY: RGB = [148, 178, 214];
const SEA: RGB = [64, 110, 158];
const SAND: RGB = [216, 188, 138];
const GREEN: RGB = [74, 128, 74];
const ORANGE: RGB = [226, 122, 40];
const TEAL: RGB = [38, 128, 128];

// ---------- scenes (drawn inside a panel box) ----------
type Scene = (x: number, y: number, w: number, h: number) => void;

const sceneBlackout: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [26, 30, 48]);
  // dark tower blocks, a few lit windows
  const bw = Math.floor(w / 6);
  for (let i = 0; i < 6; i++) {
    const bh = Math.floor(h * (0.45 + ((i * 37) % 30) / 100));
    rect(x + i * bw + 3, y + h - bh, bw - 6, bh, [12, 14, 24]);
    for (let wy = y + h - bh + 8; wy < y + h - 10; wy += 13)
      for (let wx = x + i * bw + 8; wx < x + (i + 1) * bw - 10; wx += 11)
        if ((wx * 7 + wy * 13) % 9 === 0) rect(wx, wy, 5, 6, [240, 196, 92]);
  }
  // burst + smoke over the skyline
  circle(x + Math.floor(w * 0.72), y + Math.floor(h * 0.26), 11, ORANGE);
  circle(x + Math.floor(w * 0.72), y + Math.floor(h * 0.26), 5, [250, 210, 110]);
  for (let i = 0; i < 5; i++) circle(x + Math.floor(w * 0.72) + i * 8 - 6, y + Math.floor(h * 0.26) - 10 - i * 3, 6 + i, [70, 72, 84]);
  // crossed-out power plug sign: a bolt in a red ring
  circle(x + Math.floor(w * 0.16), y + Math.floor(h * 0.24), 15, PAPER);
  circle(x + Math.floor(w * 0.16), y + Math.floor(h * 0.24), 12, RED);
  const bx = x + Math.floor(w * 0.16);
  const by = y + Math.floor(h * 0.24);
  tri(bx + 2, by - 8, bx - 5, by + 2, bx, by + 2, [250, 220, 90]);
  tri(bx, by + 0, bx - 2, by + 9, bx + 5, by - 1, [250, 220, 90]);
  line(bx - 9, by + 9, bx + 9, by - 9, PAPER, 3);
};

const sceneArena: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [196, 206, 220]);
  rect(x, y + h - Math.floor(h * 0.22), w, Math.floor(h * 0.22), [120, 124, 132]);
  // arena bowl
  const aw = Math.floor(w * 0.62);
  const ax = x + Math.floor(w * 0.08);
  const ay = y + Math.floor(h * 0.18);
  rect(ax, ay, aw, Math.floor(h * 0.5), [88, 96, 116]);
  rect(ax + 8, ay + 8, aw - 16, Math.floor(h * 0.5) - 16, [150, 60, 60]);
  rect(ax + 20, ay + 18, aw - 40, Math.floor(h * 0.5) - 36, [52, 120, 74]);
  for (let i = 0; i < 26; i++) circle(ax + 14 + ((i * 53) % (aw - 28)), ay + 12 + ((i * 29) % (Math.floor(h * 0.5) - 24)), 2, [240, 230, 200]);
  // gas cloud drifting out
  for (let i = 0; i < 6; i++) circle(x + Math.floor(w * 0.68) + i * 8, y + Math.floor(h * 0.2) + (i % 3) * 7, 10 + (i % 3) * 4, [168, 178, 150]);
  // crowd streaming to the exits
  for (let i = 0; i < 16; i++) {
    const px = x + Math.floor(w * 0.3) + ((i * 41) % Math.floor(w * 0.6));
    const py = y + h - Math.floor(h * 0.2) + (i % 3) * 6;
    circle(px, py - 6, 3, [40, 40, 48]);
    rect(px - 2, py - 3, 4, 8, i % 2 ? RED : NAVY);
  }
  // warning triangle
  const tx = x + Math.floor(w * 0.86);
  const ty = y + Math.floor(h * 0.52);
  tri(tx, ty - 14, tx - 13, ty + 10, tx + 13, ty + 10, [244, 196, 48]);
  drawText(tx - 2, ty - 6, "!", 2, INK);
};

const sceneFire: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [58, 50, 52]);
  // factory silhouette
  rect(x + Math.floor(w * 0.08), y + Math.floor(h * 0.42), Math.floor(w * 0.6), Math.floor(h * 0.44), [30, 28, 32]);
  tri(x + Math.floor(w * 0.08), y + Math.floor(h * 0.42), x + Math.floor(w * 0.38), y + Math.floor(h * 0.28), x + Math.floor(w * 0.68), y + Math.floor(h * 0.42), [30, 28, 32]);
  rect(x + Math.floor(w * 0.72), y + Math.floor(h * 0.2), 12, Math.floor(h * 0.66), [30, 28, 32]);
  // flames
  for (let i = 0; i < 9; i++) {
    const fx = x + Math.floor(w * 0.14) + i * Math.floor(w * 0.07);
    const fh = 18 + ((i * 31) % 22);
    tri(fx, y + Math.floor(h * 0.44), fx + 7, y + Math.floor(h * 0.44) - fh, fx + 14, y + Math.floor(h * 0.44), ORANGE);
    tri(fx + 3, y + Math.floor(h * 0.44), fx + 7, y + Math.floor(h * 0.44) - Math.floor(fh * 0.6), fx + 11, y + Math.floor(h * 0.44), [250, 200, 80]);
  }
  for (let i = 0; i < 6; i++) circle(x + Math.floor(w * 0.3) + i * 13, y + Math.floor(h * 0.16) - (i % 2) * 6, 9 + (i % 3) * 3, [96, 90, 92]);
  // firefighters + hose arc
  for (let i = 0; i < 3; i++) {
    const px = x + Math.floor(w * 0.76) + i * 12;
    const py = y + Math.floor(h * 0.82);
    circle(px, py - 8, 3, [240, 200, 90]);
    rect(px - 2, py - 5, 5, 9, [210, 160, 40]);
  }
  line(x + Math.floor(w * 0.76), y + Math.floor(h * 0.74), x + Math.floor(w * 0.4), y + Math.floor(h * 0.4), SKY, 2);
};

const sceneCapitol: Scene = (x, y, w, h) => {
  rect(x, y, w, h, SKY);
  rect(x, y + h - Math.floor(h * 0.2), w, Math.floor(h * 0.2), [140, 146, 140]);
  const bw = Math.floor(w * 0.56);
  const bx = x + Math.floor((w - bw) / 2);
  const by = y + Math.floor(h * 0.34);
  rect(bx, by, bw, Math.floor(h * 0.46), [226, 222, 210]);
  tri(bx - 6, by, bx + Math.floor(bw / 2), by - Math.floor(h * 0.2), bx + bw + 6, by, NAVY);
  for (let i = 0; i < 5; i++) rect(bx + 10 + i * Math.floor(bw / 5), by + 10, 7, Math.floor(h * 0.32), [120, 140, 170]);
  rect(bx + Math.floor(bw / 2) - 6, by + Math.floor(h * 0.2), 12, Math.floor(h * 0.26), [110, 74, 44]);
  // two flags
  line(x + Math.floor(w * 0.14), y + Math.floor(h * 0.2), x + Math.floor(w * 0.14), y + Math.floor(h * 0.8), INK, 2);
  rect(x + Math.floor(w * 0.14), y + Math.floor(h * 0.2), 22, 13, [240, 240, 240]);
  circle(x + Math.floor(w * 0.14) + 11, y + Math.floor(h * 0.2) + 6, 4, RED);
  line(x + Math.floor(w * 0.86), y + Math.floor(h * 0.2), x + Math.floor(w * 0.86), y + Math.floor(h * 0.8), INK, 2);
  rect(x + Math.floor(w * 0.86) - 22, y + Math.floor(h * 0.2), 22, 13, TEAL);
};

const sceneDesert: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [232, 200, 140]);
  rect(x, y, w, Math.floor(h * 0.4), [206, 170, 120]);
  circle(x + Math.floor(w * 0.82), y + Math.floor(h * 0.18), 10, [250, 220, 120]);
  // ridge + cactus
  tri(x, y + Math.floor(h * 0.4), x + Math.floor(w * 0.4), y + Math.floor(h * 0.14), x + Math.floor(w * 0.8), y + Math.floor(h * 0.4), [186, 148, 102]);
  rect(x + Math.floor(w * 0.1), y + Math.floor(h * 0.5), 5, 22, GREEN);
  rect(x + Math.floor(w * 0.1) - 6, y + Math.floor(h * 0.56), 6, 4, GREEN);
  rect(x + Math.floor(w * 0.1) + 5, y + Math.floor(h * 0.6), 6, 4, GREEN);
  // patrol vehicles
  for (let i = 0; i < 2; i++) {
    const vx = x + Math.floor(w * 0.34) + i * Math.floor(w * 0.3);
    const vy = y + Math.floor(h * 0.72);
    rect(vx, vy, 34, 10, [70, 84, 60]);
    rect(vx + 7, vy - 7, 18, 7, [70, 84, 60]);
    circle(vx + 8, vy + 11, 4, INK);
    circle(vx + 26, vy + 11, 4, INK);
  }
  // dust
  for (let i = 0; i < 5; i++) circle(x + Math.floor(w * 0.3) + i * 16, y + Math.floor(h * 0.66) - (i % 2) * 5, 6 + (i % 3) * 2, [222, 190, 128]);
};

const sceneMine: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [196, 178, 148]);
  // rubble field
  for (let i = 0; i < 14; i++) {
    const rx = x + 8 + ((i * 47) % (w - 24));
    const ry = y + Math.floor(h * 0.3) + ((i * 31) % Math.floor(h * 0.55));
    tri(rx, ry, rx + 8, ry - 7, rx + 16, ry, [150, 134, 108]);
  }
  // warning sign: skull-free triangle with burst
  const sx = x + Math.floor(w * 0.5);
  const sy = y + Math.floor(h * 0.42);
  rect(sx - 2, sy, 4, Math.floor(h * 0.4), [110, 74, 44]);
  tri(sx, sy - 26, sx - 22, sy + 12, sx + 22, sy + 12, [244, 196, 48]);
  tri(sx, sy - 26, sx - 22, sy + 12, sx + 22, sy + 12, [244, 196, 48]);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(sx, sy - 6, sx + Math.round(Math.cos(a) * 8), sy - 6 + Math.round(Math.sin(a) * 8), RED, 2);
  }
  // broken wall line
  rect(x + 6, y + Math.floor(h * 0.82), Math.floor(w * 0.4), 8, [160, 146, 118]);
  rect(x + Math.floor(w * 0.55), y + Math.floor(h * 0.86), Math.floor(w * 0.38), 8, [160, 146, 118]);
};

const sceneStage: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [44, 36, 64]);
  // curtains
  for (let i = 0; i < 6; i++) rect(x + i * 8, y, 5, h, [120, 40, 60]);
  for (let i = 0; i < 6; i++) rect(x + w - 8 - i * 8, y, 5, h, [120, 40, 60]);
  // spotlight cone
  tri(x + Math.floor(w * 0.5) - 6, y + 4, x + Math.floor(w * 0.5) + 6, y + 4, x + Math.floor(w * 0.5) + 30, y + h - 14, [250, 240, 200]);
  tri(x + Math.floor(w * 0.5) - 6, y + 4, x + Math.floor(w * 0.5) + 6, y + 4, x + Math.floor(w * 0.5) - 30, y + h - 14, [240, 230, 190]);
  // singer silhouette
  const cx = x + Math.floor(w * 0.5);
  const cy = y + Math.floor(h * 0.52);
  circle(cx, cy - 14, 7, [240, 214, 180]);
  rect(cx - 6, cy - 7, 12, 24, [200, 60, 90]);
  line(cx + 6, cy, cx + 18, cy - 8, [240, 214, 180], 3);
  line(cx + 18, cy - 8, cx + 20, cy - 18, INK, 2);
  circle(cx + 20, cy - 20, 4, INK);
  rect(x, y + h - 12, w, 12, [24, 20, 34]);
  // barred window motif at the side
  rect(x + Math.floor(w * 0.78), y + Math.floor(h * 0.16), 26, 30, [16, 14, 24]);
  for (let i = 0; i < 4; i++) rect(x + Math.floor(w * 0.78) + 4 + i * 6, y + Math.floor(h * 0.16), 2, 30, [150, 150, 160]);
};

const sceneCourt: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [206, 200, 186]);
  const bw = Math.floor(w * 0.7);
  const bx = x + Math.floor((w - bw) / 2);
  const by = y + Math.floor(h * 0.3);
  tri(bx - 8, by, bx + Math.floor(bw / 2), by - Math.floor(h * 0.18), bx + bw + 8, by, GREY);
  rect(bx, by, bw, 8, GREY);
  for (let i = 0; i < 4; i++) rect(bx + 8 + i * Math.floor(bw / 4), by + 8, 8, Math.floor(h * 0.4), [236, 232, 220]);
  rect(bx, by + 8 + Math.floor(h * 0.4), bw, 8, GREY);
  // scales
  const sx = x + Math.floor(w * 0.5);
  const sy = y + Math.floor(h * 0.2);
  line(sx, sy - 10, sx, sy + 8, INK, 2);
  line(sx - 14, sy - 8, sx + 14, sy - 8, INK, 2);
  tri(sx - 14, sy - 8, sx - 20, sy + 2, sx - 8, sy + 2, GOLD);
  tri(sx + 14, sy - 8, sx + 8, sy + 2, sx + 20, sy + 2, GOLD);
  // gavel
  rect(x + Math.floor(w * 0.16), y + Math.floor(h * 0.72), 22, 6, [110, 74, 44]);
  line(x + Math.floor(w * 0.16) + 18, y + Math.floor(h * 0.72), x + Math.floor(w * 0.16) + 30, y + Math.floor(h * 0.6), [110, 74, 44], 3);
  rect(x + Math.floor(w * 0.16) + 26, y + Math.floor(h * 0.54), 12, 7, [110, 74, 44]);
};

const sceneRuins: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [206, 196, 178]);
  // shattered blocks
  rect(x + Math.floor(w * 0.06), y + Math.floor(h * 0.3), Math.floor(w * 0.3), Math.floor(h * 0.56), [168, 158, 142]);
  rect(x + Math.floor(w * 0.42), y + Math.floor(h * 0.18), Math.floor(w * 0.24), Math.floor(h * 0.68), [178, 168, 150]);
  rect(x + Math.floor(w * 0.72), y + Math.floor(h * 0.38), Math.floor(w * 0.22), Math.floor(h * 0.48), [160, 150, 134]);
  for (let i = 0; i < 12; i++) rect(x + 10 + ((i * 37) % (w - 20)), y + Math.floor(h * 0.86), 8 + (i % 3) * 5, 5, [140, 130, 114]);
  for (let i = 0; i < 7; i++) rect(x + Math.floor(w * 0.46) + (i % 3) * 12, y + Math.floor(h * 0.26) + Math.floor(i / 3) * 16, 7, 9, [70, 66, 60]);
  // contaminated water pool with warning marks
  rect(x + Math.floor(w * 0.1), y + Math.floor(h * 0.9), Math.floor(w * 0.8), Math.floor(h * 0.08), [110, 128, 96]);
  for (let i = 0; i < 4; i++) circle(x + Math.floor(w * 0.2) + i * Math.floor(w * 0.18), y + Math.floor(h * 0.93), 3, [70, 92, 58]);
  // test vial
  rect(x + Math.floor(w * 0.84), y + Math.floor(h * 0.1), 8, 22, [230, 236, 240]);
  rect(x + Math.floor(w * 0.84), y + Math.floor(h * 0.1) + 12, 8, 10, [150, 170, 90]);
};

const sceneScroll: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [206, 188, 152]);
  // parchment
  const pw = Math.floor(w * 0.62);
  const px = x + Math.floor((w - pw) / 2);
  const py = y + Math.floor(h * 0.14);
  rect(px, py, pw, Math.floor(h * 0.66), [246, 240, 222]);
  circle(px, py, 8, [226, 204, 160]);
  circle(px + pw, py, 8, [226, 204, 160]);
  circle(px, py + Math.floor(h * 0.66), 8, [226, 204, 160]);
  circle(px + pw, py + Math.floor(h * 0.66), 8, [226, 204, 160]);
  for (let i = 0; i < 5; i++) rect(px + 12, py + 12 + i * 11, pw - 24 - (i % 2) * 18, 3, [150, 142, 124]);
  // quill
  tri(x + Math.floor(w * 0.72), y + Math.floor(h * 0.6), x + Math.floor(w * 0.88), y + Math.floor(h * 0.3), x + Math.floor(w * 0.8), y + Math.floor(h * 0.62), [240, 240, 244]);
  line(x + Math.floor(w * 0.74), y + Math.floor(h * 0.6), x + Math.floor(w * 0.86), y + Math.floor(h * 0.34), GREY, 1);
  // two doves of peace
  circle(x + Math.floor(w * 0.14), y + Math.floor(h * 0.24), 5, [250, 250, 250]);
  tri(x + Math.floor(w * 0.14) - 12, y + Math.floor(h * 0.24), x + Math.floor(w * 0.14), y + Math.floor(h * 0.2), x + Math.floor(w * 0.14), y + Math.floor(h * 0.28), [250, 250, 250]);
  circle(x + Math.floor(w * 0.86), y + Math.floor(h * 0.14), 4, [250, 250, 250]);
  tri(x + Math.floor(w * 0.86) - 10, y + Math.floor(h * 0.14), x + Math.floor(w * 0.86), y + Math.floor(h * 0.11), x + Math.floor(w * 0.86), y + Math.floor(h * 0.17), [250, 250, 250]);
};

const sceneTrain: Scene = (x, y, w, h) => {
  rect(x, y, w, h, SKY);
  rect(x, y + Math.floor(h * 0.66), w, Math.floor(h * 0.34), [150, 148, 138]);
  // hills
  tri(x, y + Math.floor(h * 0.66), x + Math.floor(w * 0.4), y + Math.floor(h * 0.3), x + Math.floor(w * 0.75), y + Math.floor(h * 0.66), [110, 140, 100]);
  // train body
  const ty = y + Math.floor(h * 0.52);
  rect(x + Math.floor(w * 0.06), ty, Math.floor(w * 0.8), Math.floor(h * 0.2), [196, 60, 52]);
  rect(x + Math.floor(w * 0.06), ty, Math.floor(w * 0.8), 6, [240, 240, 240]);
  tri(x + Math.floor(w * 0.86), ty, x + Math.floor(w * 0.97), ty + Math.floor(h * 0.1), x + Math.floor(w * 0.86), ty + Math.floor(h * 0.2), [160, 48, 44]);
  for (let i = 0; i < 6; i++) rect(x + Math.floor(w * 0.1) + i * Math.floor(w * 0.12), ty + 9, 12, 8, [220, 236, 250]);
  for (let i = 0; i < 5; i++) circle(x + Math.floor(w * 0.14) + i * Math.floor(w * 0.16), ty + Math.floor(h * 0.22), 5, INK);
  // track + sleepers
  line(x, ty + Math.floor(h * 0.26), x + w, ty + Math.floor(h * 0.26), INK, 2);
  for (let i = 0; i < 9; i++) rect(x + 6 + i * Math.floor(w / 8), ty + Math.floor(h * 0.26), 4, 6, [110, 74, 44]);
  // garland flags at the front
  for (let i = 0; i < 4; i++) tri(x + Math.floor(w * 0.8) + i * 6, ty - 8, x + Math.floor(w * 0.8) + i * 6 + 5, ty - 8, x + Math.floor(w * 0.8) + i * 6 + 2, ty - 2, i % 2 ? ORANGE : GREEN);
};

const sceneMissile: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [188, 198, 214]);
  // office block
  rect(x + Math.floor(w * 0.08), y + Math.floor(h * 0.24), Math.floor(w * 0.4), Math.floor(h * 0.62), [150, 156, 168]);
  for (let r = 0; r < 4; r++) for (let cix = 0; cix < 3; cix++) rect(x + Math.floor(w * 0.12) + cix * 14, y + Math.floor(h * 0.3) + r * 13, 8, 8, [220, 232, 244]);
  // red flag with star
  line(x + Math.floor(w * 0.68), y + Math.floor(h * 0.14), x + Math.floor(w * 0.68), y + Math.floor(h * 0.86), INK, 2);
  rect(x + Math.floor(w * 0.68), y + Math.floor(h * 0.14), 30, 19, RED);
  circle(x + Math.floor(w * 0.68) + 9, y + Math.floor(h * 0.14) + 9, 4, [250, 220, 90]);
  circle(x + Math.floor(w * 0.68) + 20, y + Math.floor(h * 0.14) + 5, 2, [250, 220, 90]);
  circle(x + Math.floor(w * 0.68) + 22, y + Math.floor(h * 0.14) + 11, 2, [250, 220, 90]);
  // envelope being closed
  rect(x + Math.floor(w * 0.56), y + Math.floor(h * 0.56), 34, 22, [246, 244, 236]);
  line(x + Math.floor(w * 0.56), y + Math.floor(h * 0.56), x + Math.floor(w * 0.56) + 17, y + Math.floor(h * 0.56) + 11, GREY, 1);
  line(x + Math.floor(w * 0.56) + 34, y + Math.floor(h * 0.56), x + Math.floor(w * 0.56) + 17, y + Math.floor(h * 0.56) + 11, GREY, 1);
  circle(x + Math.floor(w * 0.56) + 17, y + Math.floor(h * 0.56) + 12, 4, RED);
};

const sceneDeal: Scene = (x, y, w, h) => {
  rect(x, y, w, h, [196, 214, 228]);
  // skyline
  const bw = Math.floor(w / 5);
  for (let i = 0; i < 5; i++) {
    const bh = Math.floor(h * (0.34 + ((i * 29) % 26) / 100));
    rect(x + i * bw + 3, y + h - bh - Math.floor(h * 0.16), bw - 6, bh, [110, 130, 156]);
    for (let wy = y + h - bh - Math.floor(h * 0.16) + 7; wy < y + h - Math.floor(h * 0.16) - 8; wy += 11)
      for (let wx = x + i * bw + 8; wx < x + (i + 1) * bw - 9; wx += 10) rect(wx, wy, 4, 5, [240, 226, 150]);
  }
  rect(x, y + h - Math.floor(h * 0.16), w, Math.floor(h * 0.16), [90, 110, 130]);
  // rising chart card
  rect(x + Math.floor(w * 0.3), y + Math.floor(h * 0.1), Math.floor(w * 0.4), Math.floor(h * 0.3), [250, 250, 248]);
  const pts: Array<[number, number]> = [[0.06, 0.32], [0.14, 0.26], [0.22, 0.28], [0.3, 0.16], [0.36, 0.08]];
  for (let i = 0; i < pts.length - 1; i++)
    line(x + Math.floor(w * (0.3 + pts[i][0])), y + Math.floor(h * (0.1 + pts[i][1])), x + Math.floor(w * (0.3 + pts[i + 1][0])), y + Math.floor(h * (0.1 + pts[i + 1][1])), GREEN, 2);
  tri(x + Math.floor(w * 0.66), y + Math.floor(h * 0.16), x + Math.floor(w * 0.7), y + Math.floor(h * 0.2), x + Math.floor(w * 0.62), y + Math.floor(h * 0.2), GREEN);
  // dollar coin
  circle(x + Math.floor(w * 0.14), y + Math.floor(h * 0.2), 11, GOLD);
  drawText(x + Math.floor(w * 0.14) - 4, y + Math.floor(h * 0.2) - 5, "$", 2, [120, 84, 10]);
};

// ---------- the day's stories (all first reported Tue 24 Nov 2026) ----------
interface Panel {
  n: number;
  scene: Scene;
  badge: string;
  head: string;
  sum: string;
}
const LEADS: Panel[] = [
  { n: 1, scene: sceneBlackout, badge: "REPORTED", head: "ODESA STRUCK: POWER, HEAT AND WATER CUT", sum: "Russian strikes on Odesa leave the port city without power, heat or water as repair crews race to restore supplies." },
  { n: 2, scene: sceneArena, badge: "REPORTED", head: "12,000 EVACUATED FROM MANCHESTER CONCERT", sum: "Police clear a packed Manchester concert venue after an unknown substance is released; fans stream to the exits." },
  { n: 3, scene: sceneFire, badge: "OFFICIAL", head: "INDONESIA FACTORY BLAZE TOLL RISES TO 24", sum: "Indonesia says 24 workers died in the Banten sweets-factory fire, and rescuers still search for dozens missing." },
];
const PANELS: Panel[] = [
  { n: 4, scene: sceneCapitol, badge: "REPORTED", head: "SEOUL NAMES NEW FOREIGN MINISTER, SPY CHIEF", sum: "South Korea's president nominates a new foreign minister and intelligence chief amid US worries." },
  { n: 5, scene: sceneDesert, badge: "OFFICIAL", head: "16 KILLED AS MEXICO CAPTURES CARTEL BOSS", sum: "Mexican forces kill 16 suspected cartel gunmen while capturing the leader known as El Chapo Isidro." },
  { n: 6, scene: sceneMine, badge: "REPORTED", head: "LANDMINE KILLS FIVE CHILDREN IN SYRIA", sum: "A landmine blast in northwestern Syria kills five children, a reminder of the war's buried toll." },
  { n: 7, scene: sceneStage, badge: "REPORTED", head: "IRANIAN SINGER LASHED FOR HIJAB-FREE SHOW", sum: "An Iranian singer and four of her team each receive 74 lashes for performing without a hijab." },
  { n: 8, scene: sceneCourt, badge: "REPORTED", head: "BANGLADESH VOWS TO ARREST HASINA", sum: "Bangladesh says ex-PM Sheikh Hasina will be arrested if she returns from exile in India." },
  { n: 9, scene: sceneRuins, badge: "REPORTED", head: "GAZA'S LAND AND WATER POISONED, STUDY SAYS", sum: "An Oxfam-backed analysis finds toxic contamination across Gaza threatening health for decades." },
  { n: 10, scene: sceneScroll, badge: "REPORTED", head: "ARMENIA DRAFTS NEW CONSTITUTION FOR PEACE", sum: "Armenia proposes a new constitution to advance its peace negotiations with Azerbaijan." },
  { n: 11, scene: sceneTrain, badge: "OFFICIAL", head: "INDIA-NEPAL EXPRESS TRAIN FLAGGED OFF", sum: "Modi and Nepal's PM flag off the Saryu-Kamala Express linking Ayodhya with Janakpur Dham." },
  { n: 12, scene: sceneMissile, badge: "REPORTED", head: "NORTH KOREA MAY CLOSE SWISS OFFICE", sum: "Pyongyang condemns Swiss sanctions on a children's camp and may shut the Swiss office, KCNA says." },
  { n: 13, scene: sceneDeal, badge: "OFFICIAL", head: "AUSTRALIANSUPER BACKS $2.53BN TAKEOVER", sum: "Australia's biggest pension fund backs Brookfield's $2.53 billion bid for Reliance Worldwide." },
];
const ALSO: string[] = [
  "14 EU: RUSSIA FLOATS RENEWED TALKS WITH US AND UKRAINE",
  "15 EU: DENMARK SCHOOL BOMB ALERTS PROVE UNFOUNDED",
  "16 EU: ESTONIA REJECTS RUSSIAN AIRSPACE CLAIM",
  "17 EU: BALTIC TRIO SET NEW MEASURES AGAINST RUSSIA",
  "18 EU: EU ACADEMY PLATFORM HIT BY CYBER INCIDENT",
  "19 EU: FERRARI UNVEILS 296 CHALLENGE STRADALE",
  "20 EU: RAYA RULED OUT OF ARSENAL'S DORTMUND CLASH",
  "21 AP: CHINA SETS 2030 ELDERLY-CARE, CHILDCARE TARGETS",
  "22 AP: MYANMAR JUNTA CALLS ASEAN RULING UNFAIR",
  "23 AP: TALIBAN ERASE WOMEN'S NAMES IN BALKH PAPERS",
  "24 AP: SPICEJET PILOTS PLEAD FOR A RESCUE",
  "25 AP: INDIA'S OIL IMPORT BILL JUMPS 60 PERCENT",
  "26 AP: PANT'S 128 SETS A WICKETKEEPER RECORD",
  "27 AM: CANADA AND QATAR TO SIGN INVESTMENT PACT",
  "28 AM: PANAMA REOPENS COBRE PANAMA MINE TALKS",
  "29 AM: TRUMP'S KIM OUTREACH IGNORED, WSJ REPORTS",
  "30 ME: FRANCE CONDEMNS SETTLER ATTACKS IN WEST BANK",
  "31 AF: SUDAN'S WOMEN BEAR THE WAR'S BURDEN ALONE",
  "32 OC: VICTORIA VOTE PUTS HANSON TO THE TEST",
  "33 WORLD: COP31 FALLOUT, FOSSIL-FUEL RIFT OUTLIVES SUMMIT",
];

// ---------- composition ----------
function badgeTag(x: number, y: number, label: string): void {
  const w = textWidth(label, 1) + 8;
  rect(x, y, w, 11, label === "OFFICIAL" ? GOLD : LGREY);
  drawText(x + 4, y + 2, label, 1, INK);
}
function numBadge(x: number, y: number, n: number): void {
  circle(x, y, 10, GOLD);
  const s = String(n);
  drawText(x - Math.floor(textWidth(s, 1) / 2), y - 3, s, 1, INK);
}
function panelBox(p: Panel, x: number, y: number, w: number, h: number, sceneH: number, headScale: number): void {
  rect(x, y, w, h, [252, 250, 244]);
  rect(x, y, w, 2, INK);
  rect(x, y + h - 2, w, 2, INK);
  rect(x, y, 2, h, INK);
  rect(x + w - 2, y, 2, h, INK);
  CLIP = [x + 3, y + 3, x + w - 3, y + 3 + sceneH];
  p.scene(x + 3, y + 3, w - 6, sceneH);
  CLIP = null;
  numBadge(x + 14, y + 14, p.n);
  badgeTag(x + w - textWidth(p.badge, 1) - 14, y + 6, p.badge);
  let ty = y + sceneH + 10;
  for (const ln of wrapText(p.head, headScale, w - 14)) {
    drawText(x + 7, ty, ln, headScale, INK);
    ty += 8 * headScale + 2;
  }
  ty += 2;
  for (const ln of wrapText(p.sum, 1, w - 14)) {
    drawText(x + 7, ty, ln, 1, GREY);
    ty += 9;
  }
}

function compose(): void {
  rect(0, 0, W, H, PAPER);
  // masthead
  drawTextCentered(512, 10, "THE WORLD IN ONE IMAGE", 2, GREY);
  drawTextCentered(512, 28, "24 NOVEMBER 2026", 9, NAVY);
  drawTextCentered(512, 98, "TUESDAY - ALL TIMES UTC - 33 STORIES, 7 REGIONS", 2, INK);
  rect(12, 120, 1000, 3, GOLD);
  // stats strip
  rect(12, 128, 1000, 46, NAVY);
  const stats: Array<[string, string]> = [
    ["12,000", "EVACUATED - MANCHESTER"],
    ["24", "DEAD IN BANTEN BLAZE"],
    ["5", "CHILDREN KILLED BY MINE"],
    ["16", "KILLED IN CARTEL RAID"],
    ["74", "LASHES FOR A SINGER"],
  ];
  stats.forEach(([num, lab], i) => {
    const cx = 112 + i * 200;
    drawTextCentered(cx, 134, num, 3, GOLD);
    drawTextCentered(cx, 160, lab, 1, [240, 238, 230]);
  });
  // region bar
  rect(12, 180, 1000, 16, LGREY);
  drawTextCentered(512, 184, "EUROPE 10 - ASIA-PACIFIC 11 - AMERICAS 4 - MIDDLE EAST 4 - AFRICA 1 - OCEANIA 2 - WORLD 1", 1, INK);
  // leads
  LEADS.forEach((p, i) => panelBox(p, 12 + i * 338, 204, 328, 208, 96, 2));
  // panels, two rows of five
  PANELS.forEach((p, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    panelBox(p, 12 + col * 202, 422 + row * 158, 194, 150, 58, 1);
  });
  // map strip
  const my = 748;
  rect(12, my, 1000, 64, SEA);
  drawText(22, my + 6, "WHERE IT HAPPENED", 1, [240, 238, 230]);
  const land: RGB = [196, 216, 188];
  // rough continents
  rect(70, my + 16, 130, 22, land); rect(120, my + 38, 60, 16, land);
  rect(452, my + 12, 90, 18, land); rect(478, my + 32, 66, 24, land);
  rect(560, my + 12, 220, 24, land); rect(640, my + 36, 90, 14, land);
  rect(838, my + 40, 90, 14, land);
  const pins: Array<[number, number, number]> = [
    [520, 18, 1], [478, 14, 2], [712, 44, 3], [742, 18, 4], [128, 30, 5],
    [540, 30, 6], [566, 28, 7], [668, 32, 8], [548, 34, 9], [556, 20, 10],
    [676, 30, 11], [756, 16, 12], [884, 44, 13],
  ];
  for (const [px, py, n] of pins) {
    circle(12 + px, my + py, 7, GOLD);
    const s = String(n);
    drawText(12 + px - Math.floor(textWidth(s, 1) / 2), my + py - 3, s, 1, INK);
  }
  // also on the front page
  drawText(12, 824, "ALSO ON THE FRONT PAGE", 2, NAVY);
  ALSO.forEach((s, i) => {
    const col = Math.floor(i / 10);
    const row = i % 10;
    drawText(12 + col * 505, 848 + row * 11, s, 1, INK);
  });
  // date check footer
  rect(12, 968, 1000, 44, NAVY);
  drawText(22, 974, "DATE CHECK: EVERY STORY ABOVE WAS FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026.", 1, [240, 238, 230]);
  drawText(22, 986, "NOT THIS DAY: NVIDIA +31% RALLY (MON 23 NOV) - COP31 DEAL COLLAPSE (22-23 NOV) - MERKURY SINKING (22 NOV)", 1, GOLD);
  drawText(22, 998, "- VANUATU M6.5 QUAKE (23 NOV) - ASIA AI STOCK ROUT (23 NOV). SOURCES: REUTERS, AP VIA PRESS ROUND-UPS, KCNA.", 1, GOLD);
}

compose();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
const png = encodePng(PX, W, H);
writeFileSync(join(outDir, "entry.png"), png);
console.log("entry.png bytes:", png.length);
