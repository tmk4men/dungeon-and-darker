// ============================================================
// input.js — 仮想ジョイスティック2本＋キーボード
// ============================================================
const Input = {
  canvas: null,
  enabled: false,
  move: { x: 0, y: 0 },
  aimVec: { x: 0, y: 0, len: 0, active: false, ang: 0 },
  fireCallback: null,        // (ang) => {}
  aimChange: null,           // (ang)=>{} 連続狙い用
  dodgeCallback: null,       // 移動スティックのダブルタップで回避
  _lastLeftDown: -1e9,
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  R: 70,                     // スティック半径(px)

  left: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
  right: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 },

  init(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', e => {
      const p = this.clientToLogical(e);
      this.mouse.x = p.x; this.mouse.y = p.y;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  clientToLogical(e) {
    const W = window.innerWidth, H = window.innerHeight;
    // 縦持ち時は #app が rotate(-90deg)/origin left top/top:100% で横画面化されている
    if (H > W) {
      return { x: (H - e.clientY) / H * CONFIG.VIEW_W, y: e.clientX / W * CONFIG.VIEW_H };
    }
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * CONFIG.VIEW_W, y: (e.clientY - r.top) / r.height * CONFIG.VIEW_H };
  },

  onDown(e) {
    if (!this.enabled) return;
    const p = this.clientToLogical(e);
    const isLeft = p.x < CONFIG.VIEW_W * 0.46;
    if (isLeft && this.left.id === null) {
      this.left.id = e.pointerId; this.left.ox = p.x; this.left.oy = p.y; this.left.dx = 0; this.left.dy = 0;
      // ダブルタップで回避
      const now = performance.now();
      if (now - this._lastLeftDown < 280 && this.dodgeCallback) this.dodgeCallback();
      this._lastLeftDown = now;
    } else if (!isLeft && this.right.id === null) {
      this.right.id = e.pointerId; this.right.ox = p.x; this.right.oy = p.y; this.right.dx = 0; this.right.dy = 0;
      this.aimVec.active = true;
    }
  },

  onMove(e) {
    if (!this.enabled) return;
    const p = this.clientToLogical(e);
    if (e.pointerId === this.left.id) {
      this.left.dx = p.x - this.left.ox; this.left.dy = p.y - this.left.oy;
      this.clampStick(this.left);
    } else if (e.pointerId === this.right.id) {
      this.right.dx = p.x - this.right.ox; this.right.dy = p.y - this.right.oy;
      this.clampStick(this.right);
      const l = len(this.right.dx, this.right.dy);
      if (l > 8) { this.aimVec.ang = angleOf(this.right.dx, this.right.dy); if (this.aimChange) this.aimChange(this.aimVec.ang); }
    }
  },

  clampStick(s) {
    const l = len(s.dx, s.dy);
    if (l > this.R) { s.dx = s.dx / l * this.R; s.dy = s.dy / l * this.R; }
  },

  onUp(e) {
    if (e.pointerId === this.left.id) { this.left.id = null; this.left.dx = 0; this.left.dy = 0; }
    else if (e.pointerId === this.right.id) {
      const l = len(this.right.dx, this.right.dy);
      const ang = l > 8 ? angleOf(this.right.dx, this.right.dy) : null;
      this.right.id = null; this.right.dx = 0; this.right.dy = 0; this.aimVec.active = false;
      if (this.fireCallback) this.fireCallback(ang);
    }
  },

  // 毎フレーム移動入力を更新
  poll() {
    // タッチ移動
    let mx = 0, my = 0;
    if (this.left.id !== null) { mx = this.left.dx / this.R; my = this.left.dy / this.R; }
    // キーボード
    if (this.keys['w'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) my += 1;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;
    const l = len(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    this.move.x = mx; this.move.y = my;
    // 右スティックの現在ベクトル
    this.aimVec.len = len(this.right.dx, this.right.dy) / this.R;
    this.aimVec.x = this.right.dx; this.aimVec.y = this.right.dy;
  },

  // 定位置（タッチしていない時に表示するベースの中心）
  homePos() {
    return {
      left: { x: CONFIG.VIEW_W * 0.13, y: CONFIG.VIEW_H * 0.75 },
      right: { x: CONFIG.VIEW_W * 0.87, y: CONFIG.VIEW_H * 0.75 },
    };
  },

  drawSticks(ctx) {
    const home = this.homePos();
    // 非アクティブ時はベースを薄く常時表示（スティックの存在を明示）
    const drawBase = (cx, cy, color, label) => {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, this.R, 0, TAU); ctx.stroke();
      ctx.fillStyle = color; ctx.globalAlpha = 0.16;
      ctx.beginPath(); ctx.arc(cx, cy, this.R * 0.42, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = color;
      ctx.font = 'bold 16px "Shippori Mincho B1", serif'; ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + this.R + 22);
      ctx.restore();
    };
    const drawStick = (s, color) => {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.ox, s.oy, this.R, 0, TAU); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(s.ox + s.dx, s.oy + s.dy, this.R * 0.42, 0, TAU); ctx.fill();
      ctx.restore();
    };
    if (this.left.id === null) drawBase(home.left.x, home.left.y, '#7fbfff', '移動'); else drawStick(this.left, '#7fbfff');
    if (this.right.id === null) drawBase(home.right.x, home.right.y, '#ff9f6b', '攻撃'); else drawStick(this.right, '#ff9f6b');
    // 右スティック：照準ライン
    if (this.right.id !== null && this.aimVec.len > 0.12) {
      ctx.save(); ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffce6b'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(CONFIG.VIEW_W / 2, CONFIG.VIEW_H / 2);
      ctx.lineTo(CONFIG.VIEW_W / 2 + Math.cos(this.aimVec.ang) * 220, CONFIG.VIEW_H / 2 + Math.sin(this.aimVec.ang) * 220);
      ctx.stroke(); ctx.restore();
    }
  },

  reset() {
    this.left.id = null; this.right.id = null;
    this.left.dx = this.left.dy = this.right.dx = this.right.dy = 0;
    this.move.x = this.move.y = 0; this.aimVec.active = false;
  },
};
