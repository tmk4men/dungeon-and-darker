// ============================================================
// utils.js — 数学/汎用ヘルパー
// ============================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const len = (x, y) => Math.hypot(x, y);
const angleOf = (x, y) => Math.atan2(y, x);

// 角度差（-PI..PI）
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
// a を b に向けて maxStep だけ回す
function rotateToward(a, b, maxStep) {
  const d = angDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

// 乱数（_rng は差し替え可能：デイリーは固定シードに）
let _rng = Math.random;
function rng() { return _rng(); }
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedRng(seed) { _rng = mulberry32(seed >>> 0); }
function unseedRng() { _rng = Math.random; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function rand(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + rng() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function chance(p) { return rng() < p; }
function choice(arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = randInt(0, i);[arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
// 重み付き抽選： items は {weight} を持つオブジェクト配列、または [key, weight] のマップ
function weightedPick(entries) {
  // entries: [{item, weight}]
  let total = 0;
  for (const e of entries) total += e.weight;
  let r = rng() * total;
  for (const e of entries) { r -= e.weight; if (r <= 0) return e.item; }
  return entries[entries.length - 1].item;
}

// AABB と 円
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return dist2(cx, cy, nx, ny) < r * r;
}

// 一意ID
let _uid = 1;
function uid() { return _uid++; }

// 数値整形
function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

// 16進カラーに alpha
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, amt) { // amt: -1..1 で明暗
  const h = hex.replace('#', '');
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
