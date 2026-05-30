// ============================================================
// render.js — 描画（擬似3D壁 / 視界レイキャスト / 部屋フォグ）
// ============================================================
const Render = {
  canvas: null, ctx: null, light: null, lctx: null,
  scale: 1, ox: 0, oy: 0,        // 画面フィット用
  cam: { x: 0, y: 0 },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = CONFIG.VIEW_W * dpr;
    this.canvas.height = CONFIG.VIEW_H * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.light.width = CONFIG.VIEW_W;
    this.light.height = CONFIG.VIEW_H;
  },

  worldToScreen(x, y) { return { x: x - this.cam.x, y: y - this.cam.y }; },

  updateCamera(player, dgn) {
    const tx = player.x - CONFIG.VIEW_W / 2;
    const ty = player.y - CONFIG.VIEW_H / 2;
    this.cam.x = clamp(tx, 0, Math.max(0, dgn.pxW - CONFIG.VIEW_W));
    this.cam.y = clamp(ty, 0, Math.max(0, dgn.pxH - CONFIG.VIEW_H));
  },

  // ---- メイン描画 ----
  render(game) {
    const ctx = this.ctx, dgn = game.dgn, T = CONFIG.TILE;
    this.updateCamera(game.player, dgn);

    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    const minTx = Math.floor(this.cam.x / T) - 1, maxTx = Math.ceil((this.cam.x + CONFIG.VIEW_W) / T) + 1;
    const minTy = Math.floor(this.cam.y / T) - 1, maxTy = Math.ceil((this.cam.y + CONFIG.VIEW_H) / T) + 1;

    // --- 床 ---
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const t = dgn.get(tx, ty);
        if (t === T_WALL) continue;
        const s = this.worldToScreen(tx * T, ty * T);
        const even = (tx + ty) & 1;
        ctx.fillStyle = even ? '#26242c' : '#2c2a33';
        ctx.fillRect(s.x, s.y, T + 1, T + 1);
        // 目地
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(s.x, s.y, T + 1, 1.5);
        ctx.fillRect(s.x, s.y, 1.5, T + 1);
        if (t === T_DOOR || t === T_DOOROPEN) this.drawDoorFloor(ctx, s, t);
      }
    }

    // --- ポータル（脱出口） ---
    this.drawPortal(ctx, game);

    // --- トラップ ---
    if (game.traps) for (const tr of game.traps) this.drawTrap(ctx, tr);

    // --- 地上アイテム・宝箱 ---
    for (const g of game.groundItems) this.drawGroundItem(ctx, g);
    for (const c of game.chests) this.drawChest(ctx, c);

    // --- 壁（擬似3D・南向きに描画して重なり順を自然に） ---
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (dgn.get(tx, ty) !== T_WALL) continue;
        this.drawWall(ctx, dgn, tx, ty);
      }
    }

    // --- エンティティ（y順） ---
    const ents = [];
    for (const e of game.enemies) if (!e.dead) ents.push(e);
    ents.push(game.player);
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) (e === game.player) ? this.drawPlayer(ctx, e) : this.drawEnemy(ctx, e);

    // --- 投射物・パーティクル ---
    for (const p of game.projectiles) this.drawProjectile(ctx, p);
    for (const p of game.particles) this.drawParticle(ctx, p);

    // --- ダメージ数字 ---
    for (const d of game.floatTexts) this.drawFloatText(ctx, d);

    // --- ライティング ---
    this.drawLighting(game);

    // --- ゾーン収縮（闇の侵食）を最前面に ---
    if (game.zone) this.drawZone(game);
  },

  drawTrap(ctx, tr) {
    const s = this.worldToScreen(tr.x, tr.y), T = CONFIG.TILE;
    if (tr.type === 'spike') {
      // 床のプレート
      ctx.fillStyle = 'rgba(40,40,52,0.6)';
      ctx.fillRect(s.x - T * 0.4, s.y - T * 0.4, T * 0.8, T * 0.8);
      const warn = tr.phase < 0.4;
      const telegraph = tr.phase > tr.period - 0.45;
      if (warn) {
        ctx.fillStyle = '#cdd2d8';
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.moveTo(s.x + i * 12 - 4, s.y + j * 12 + 6);
          ctx.lineTo(s.x + i * 12, s.y + j * 12 - 8);
          ctx.lineTo(s.x + i * 12 + 4, s.y + j * 12 + 6);
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = telegraph ? 'rgba(255,80,60,0.5)' : 'rgba(120,40,40,0.35)';
        ctx.fillRect(s.x - T * 0.3, s.y - T * 0.3, T * 0.6, T * 0.6);
        // 穴
        ctx.fillStyle = '#15151c';
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(s.x + i * 12, s.y + j * 12, 2.2, 0, TAU); ctx.fill(); }
      }
    } else {
      // ダートトラップ（壁の発射口）
      ctx.fillStyle = 'rgba(60,50,40,0.7)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0c0c12';
      ctx.beginPath(); ctx.arc(s.x + Math.cos(tr.dir) * 3, s.y + Math.sin(tr.dir) * 3, 4, 0, TAU); ctx.fill();
    }
  },

  drawZone(game) {
    const z = game.zone;
    const s = this.worldToScreen(z.cx, z.cy);
    const ctx = this.ctx;
    ctx.save();
    // 画面全体から安全円を除いた領域を闇で塗る
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    ctx.arc(s.x, s.y, z.r, 0, TAU, true); // 逆回りで穴
    const pulse = 0.5 + Math.sin(game.time * 4) * 0.08;
    ctx.fillStyle = `rgba(60,12,90,${0.42 * pulse + 0.18})`;
    ctx.fill('evenodd');
    // 境界のリング
    ctx.beginPath(); ctx.arc(s.x, s.y, z.r, 0, TAU);
    ctx.strokeStyle = `rgba(180,90,255,${0.6 * pulse + 0.3})`;
    ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  },

  drawWall(ctx, dgn, tx, ty) {
    const T = CONFIG.TILE, H = CONFIG.WALL_H;
    const s = this.worldToScreen(tx * T, ty * T);
    const topY = s.y - H;
    const belowOpen = dgn.get(tx, ty + 1) !== T_WALL;
    // 影
    if (belowOpen) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(s.x - 2, s.y + T - 2, T + 4, 6);
    }
    // 前面
    if (belowOpen) {
      const g = ctx.createLinearGradient(0, topY + T, 0, s.y + T);
      g.addColorStop(0, '#3a3742');
      g.addColorStop(1, '#1c1a22');
      ctx.fillStyle = g;
      ctx.fillRect(s.x, topY + T, T + 1, H + 1);
    }
    // 上面
    ctx.fillStyle = '#4a4754';
    ctx.fillRect(s.x, topY, T + 1, T + 1);
    ctx.fillStyle = '#54515f';
    ctx.fillRect(s.x + 2, topY + 2, T - 3, T - 3);
    // 上面の溝
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(s.x, topY, T + 1, 2);
    ctx.fillRect(s.x, topY, 2, T + 1);
  },

  drawDoorFloor(ctx, s, t) {
    const T = CONFIG.TILE;
    ctx.fillStyle = t === T_DOOR ? '#5a3d22' : 'rgba(90,61,34,0.35)';
    ctx.fillRect(s.x + 3, s.y + 3, T - 6, T - 6);
    if (t === T_DOOR) {
      ctx.fillStyle = '#7a5430';
      ctx.fillRect(s.x + 5, s.y + 5, T - 10, T - 10);
      ctx.strokeStyle = '#3a2614';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 5, s.y + 5, T - 10, T - 10);
      ctx.fillStyle = '#d9b25a';
      ctx.beginPath(); ctx.arc(s.x + T - 12, s.y + T / 2, 2.5, 0, TAU); ctx.fill();
    }
  },

  drawPortal(ctx, game) {
    const s = this.worldToScreen(game.dgn.portal.x, game.dgn.portal.y);
    const t = game.time;
    const R = game.dgn.portal.r;
    ctx.save();
    ctx.translate(s.x, s.y);
    for (let i = 3; i >= 0; i--) {
      const rr = R * (0.5 + i * 0.22) + Math.sin(t * 3 + i) * 3;
      ctx.fillStyle = hexA('#7fd0ff', 0.12 + i * 0.05);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = hexA('#aee7ff', 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.7, t % TAU, t % TAU + 5); ctx.stroke();
    ctx.fillStyle = '#eaffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('脱出', 0, -R - 6);
    ctx.restore();
  },

  drawChest(ctx, c) {
    const s = this.worldToScreen(c.x, c.y);
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 10, 16, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c.opened ? '#6b4a28' : '#8a5a2c';
    ctx.fillRect(-14, -10, 28, 20);
    ctx.fillStyle = c.opened ? '#4a3018' : '#5a3a1c';
    ctx.fillRect(-14, -14, 28, 8);
    ctx.fillStyle = '#d9b25a';
    ctx.fillRect(-3, -6, 6, 8);
    if (!c.opened) {
      ctx.strokeStyle = hexA('#ffd27a', 0.6); ctx.lineWidth = 1.5;
      ctx.strokeRect(-14, -14, 28, 24);
    }
    ctx.restore();
  },

  drawGroundItem(ctx, g) {
    const s = this.worldToScreen(g.x, g.y);
    const col = RARITY[g.item.rarity] ? RARITY[g.item.rarity].color : '#fff';
    const t = performance.now() / 600;
    const yo = Math.sin(t + g.x) * 2;
    ctx.save(); ctx.translate(s.x, s.y + yo);
    ctx.fillStyle = hexA(col, 0.25);
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    if (g.item.slot === 'potion') {
      ctx.fillRect(-3, -6, 6, 10);
      ctx.fillStyle = '#ddd'; ctx.fillRect(-2, -8, 4, 3);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  drawPlayer(ctx, p) {
    const s = this.worldToScreen(p.x, p.y);
    const r = CONFIG.PLAYER_R;
    ctx.save(); ctx.translate(s.x, s.y);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r, r * 0.5, 0, 0, TAU); ctx.fill();
    // 体（高さ表現で少し上に）
    const by = -8;
    // 向き三角（武器側）
    const col = CLASSES[p.classId].color;
    ctx.rotate(p.facing);
    ctx.fillStyle = hexA(col, 0.9);
    ctx.beginPath();
    ctx.moveTo(r + 8, 0); ctx.lineTo(r - 2, -7); ctx.lineTo(r - 2, 7); ctx.closePath(); ctx.fill();
    ctx.rotate(-p.facing);
    // 胴体
    ctx.fillStyle = shade(col, -0.15);
    ctx.beginPath(); ctx.arc(0, by, r, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(col, 0.2);
    ctx.beginPath(); ctx.arc(0, by - 2, r - 4, 0, TAU); ctx.fill();
    // 頭
    ctx.fillStyle = '#f2d6b3';
    ctx.beginPath(); ctx.arc(0, by - 3, r - 6, 0, TAU); ctx.fill();
    // HPバー
    this.drawBar(ctx, -r, by - r - 8, r * 2, 4, p.hp / p.derived.hpmax, '#54e36b', '#3a0e0e');
    ctx.restore();
  },

  drawEnemy(ctx, e) {
    const def = ENEMIES[e.type];
    const s = this.worldToScreen(e.x, e.y);
    ctx.save(); ctx.translate(s.x, s.y);
    const r = def.r;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r, r * 0.5, 0, 0, TAU); ctx.fill();
    const by = -6;
    const hit = e.hitFlash > 0;
    ctx.fillStyle = hit ? '#ffffff' : shade(def.color, -0.1);
    ctx.beginPath(); ctx.arc(0, by, r, 0, TAU); ctx.fill();
    if (!hit) {
      ctx.fillStyle = shade(def.color, 0.18);
      ctx.beginPath(); ctx.arc(0, by - 2, r - 4, 0, TAU); ctx.fill();
    }
    // 目
    if (!hit) {
      ctx.fillStyle = def.boss ? '#ff3b3b' : '#ffe9a8';
      const ex = Math.cos(e.facing) * 3, ey = Math.sin(e.facing) * 3;
      ctx.beginPath(); ctx.arc(-3 + ex, by - 2 + ey, 1.8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3 + ex, by - 2 + ey, 1.8, 0, TAU); ctx.fill();
    }
    this.drawBar(ctx, -r, by - r - 7, r * 2, def.boss ? 6 : 4, e.hp / e.maxhp, def.boss ? '#ff6a4d' : '#e0574d', '#2a0808');
    if (def.boss) {
      ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(def.name, 0, by - r - 12);
    }
    ctx.restore();
  },

  drawProjectile(ctx, p) {
    const s = this.worldToScreen(p.x, p.y);
    ctx.save(); ctx.translate(s.x, s.y);
    // トレイル
    ctx.fillStyle = hexA(p.color, 0.25);
    ctx.beginPath(); ctx.arc(-Math.cos(p.ang) * 8, -Math.sin(p.ang) * 8, p.r * 0.9, 0, TAU); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  },

  drawParticle(ctx, p) {
    const s = this.worldToScreen(p.x, p.y);
    ctx.globalAlpha = clamp(p.life / p.maxlife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, p.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawFloatText(ctx, d) {
    const s = this.worldToScreen(d.x, d.y);
    ctx.globalAlpha = clamp(d.life / d.maxlife, 0, 1);
    ctx.font = `bold ${d.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(d.text, s.x, s.y);
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, s.x, s.y);
    ctx.globalAlpha = 1;
  },

  drawBar(ctx, x, y, w, h, ratio, fg, bg) {
    ratio = clamp(ratio, 0, 1);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg; ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  },

  // ---- ライティング ----
  drawLighting(game) {
    const lctx = this.lctx, T = CONFIG.TILE, dgn = game.dgn, p = game.player;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    // ベースの闇
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = 'rgba(2,2,6,0.95)';
    lctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    // 既に踏破した「明るい部屋」は記憶として薄く見える
    lctx.globalCompositeOperation = 'destination-out';
    for (const r of dgn.rooms) {
      if (!r.revealed || !r.lit) continue;
      this.carveRoom(lctx, r, r === game.playerRoom ? 0.95 : 0.6);
    }

    // 固定光源
    for (const l of dgn.lights) {
      const s = this.worldToScreen(l.x, l.y);
      if (s.x < -250 || s.x > CONFIG.VIEW_W + 250 || s.y < -250 || s.y > CONFIG.VIEW_H + 250) continue;
      const fl = 0.85 + Math.sin(game.time * 7 + l.flick) * 0.1;
      this.carveRadial(lctx, s.x, s.y, l.radius * fl, 1);
    }

    // プレイヤー視界ポリゴン（方向コーン＋トーチ）
    this.carveVisibility(lctx, game);

    // 未踏破の部屋は完全に隠す
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = 'rgba(2,2,6,1)';
    for (const r of dgn.rooms) {
      if (r.revealed) continue;
      const s = this.worldToScreen(r.x * T, r.y * T);
      lctx.fillRect(s.x - T, s.y - T - CONFIG.WALL_H, r.w * T + T * 2, r.h * T + T * 2 + CONFIG.WALL_H);
    }

    // 合成
    this.ctx.drawImage(this.light, 0, 0);
  },

  carveRoom(lctx, r, strength) {
    const T = CONFIG.TILE;
    const s = this.worldToScreen(r.x * T, r.y * T);
    const w = r.w * T, h = r.h * T;
    const g = lctx.createRadialGradient(s.x + w / 2, s.y + h / 2, Math.min(w, h) * 0.2,
      s.x + w / 2, s.y + h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.fillRect(s.x - T, s.y - T - CONFIG.WALL_H, w + T * 2, h + T * 2 + CONFIG.WALL_H);
  },

  carveRadial(lctx, sx, sy, radius, strength) {
    const g = lctx.createRadialGradient(sx, sy, radius * 0.15, sx, sy, radius);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.7, `rgba(0,0,0,${strength * 0.7})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(sx, sy, radius, 0, TAU); lctx.fill();
  },

  carveVisibility(lctx, game) {
    const dgn = game.dgn, p = game.player, T = CONFIG.TILE;
    const visPx = p.derived.vision * T;
    const backPx = CONFIG.BACK_GLOW * T;
    const coneHalf = (CONFIG.CONE_DEG * Math.PI / 180) / 2;
    const rays = 110;
    const ps = this.worldToScreen(p.x, p.y);
    const pts = [];
    for (let i = 0; i <= rays; i++) {
      const a = (i / rays) * TAU;
      const within = Math.abs(angDiff(p.facing, a)) <= coneHalf;
      const maxD = within ? visPx : backPx;
      const ca = Math.cos(a), sa = Math.sin(a);
      let d = 0; const step = T * 0.3;
      while (d < maxD) {
        const wx = p.x + ca * d, wy = p.y + sa * d;
        const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
        if (isOpaqueAt(dgn, tx, ty)) { d += step * 0.5; break; }
        d += step;
      }
      d = Math.min(d, maxD);
      pts.push({ x: ps.x + ca * d, y: ps.y + sa * d });
    }
    // ポリゴンをグラデで刳り抜く
    const g = lctx.createRadialGradient(ps.x, ps.y, 4, ps.x, ps.y, visPx);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.95)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) lctx.lineTo(pts[i].x, pts[i].y);
    lctx.closePath();
    lctx.fill();
  },
};
