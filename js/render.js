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
    this.app = document.getElementById('app');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 80));
  },

  // 縦持ち時は #app を90°回転して横画面表示にする（座標補正は input.js 側）
  applyOrientation() {
    const app = this.app;
    if (!app) return;
    const W = window.innerWidth, H = window.innerHeight;
    if (H > W) {
      app.style.position = 'fixed'; app.style.top = '0'; app.style.left = '0';
      app.style.width = H + 'px'; app.style.height = W + 'px';
      app.style.transformOrigin = '0 0';
      app.style.transform = `translate(0px, ${H}px) rotate(-90deg)`;
    } else {
      app.style.position = ''; app.style.top = ''; app.style.left = '';
      app.style.width = ''; app.style.height = '';
      app.style.transformOrigin = ''; app.style.transform = '';
    }
  },

  resize() {
    this.applyOrientation();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // 縦持ち時は #app を90°回転して横画面表示する。
    // よって論理サイズは常に「実画面の長辺×短辺」=横長で計算する。
    let dw = window.innerWidth, dh = window.innerHeight;
    if (dh > dw) { const t = dw; dw = dh; dh = t; }
    const baseH = CONFIG.BASE_H;
    const aspect = clamp(dw / Math.max(1, dh), 1.0, 3.0);
    const W = Math.round(baseH * aspect);
    CONFIG.VIEW_W = W;
    CONFIG.VIEW_H = baseH;
    this.canvas.width = W * dpr;
    this.canvas.height = baseH * dpr;
    // 実際の表示サイズは回転後の #app（100%×100%）に追従させる
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.light.width = W;
    this.light.height = baseH;
  },

  worldToScreen(x, y) { return { x: x - this.cam.x, y: y - this.cam.y }; },

  updateCamera(player, dgn) {
    const tx = player.x - CONFIG.VIEW_W / 2;
    const ty = player.y - CONFIG.VIEW_H / 2;
    this.cam.x = clamp(tx, 0, Math.max(0, dgn.pxW - CONFIG.VIEW_W));
    this.cam.y = clamp(ty, 0, Math.max(0, dgn.pxH - CONFIG.VIEW_H));
  },

  // 安定した擬似乱数（タイル装飾用）
  hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967296; },

  // ---- メイン描画 ----
  render(game) {
    const ctx = this.ctx, dgn = game.dgn, T = CONFIG.TILE;
    this.theme = dgn.theme || THEMES.crypt;
    this.tiles = Sprites.realmTiles(this.theme);
    ctx.imageSmoothingEnabled = false;
    this.updateCamera(game.player, dgn);
    // 画面シェイク
    if (game.shake && game.shake.t > 0) {
      const m = game.shake.mag * (game.shake.t / 0.18);
      this.cam.x += (Math.random() - 0.5) * m;
      this.cam.y += (Math.random() - 0.5) * m;
    }

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
        const v = (this.hash(tx, ty) * 3) | 0;
        ctx.drawImage(this.tiles.floors[v] || this.tiles.floors[0], s.x, s.y, T + 1, T + 1);
        if (t === T_DOOR || t === T_DOOROPEN) this.drawDoorFloor(ctx, s, t);
      }
    }

    // --- ポータル（脱出口・複数） ---
    for (const portal of game.dgn.portals) this.drawPortal(ctx, game, portal);

    // --- 祭壇/聖域 ---
    if (game.altars) for (const a of game.altars) this.drawAltar(ctx, a, game);

    // --- 下り階段 ---
    if (game.stairs) this.drawStairs(ctx, game.stairs, game);

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
    for (const e of ents) (e === game.player) ? this.drawPlayer(ctx, e) : this.drawEnemy(ctx, e, game);

    // --- ボスAoE予告（地面に詠唱円） ---
    if (game.aoes) for (const a of game.aoes) this.drawAoe(ctx, a);
    // --- 攻撃エフェクト・投射物・パーティクル ---
    if (game.fx) for (const f of game.fx) this.drawFx(ctx, f);
    for (const p of game.projectiles) this.drawProjectile(ctx, p);
    for (const p of game.particles) this.drawParticle(ctx, p);

    // --- ダメージ数字 ---
    for (const d of game.floatTexts) this.drawFloatText(ctx, d);

    // --- ライティング ---
    this.drawLighting(game);

    // --- 業（カルマ）の紅蓮テイント ---
    if (game.run && game.run.karma > 0) this.drawKarma(game);

    // --- ゾーン収縮（闇の侵食）を最前面に ---
    if (game.zone) this.drawZone(game);

    // --- 開錠/開封チャネル ---
    if (game.channel) this.drawChannel(game.channel);

    // --- ミニマップ ---
    this.drawMinimap(game);

    // --- realm遷移演出（墨＋筆でrealm名） ---
    if (game.transitionT > 0) this.drawTransition(game);
  },

  drawTransition(game) {
    const dur = 1.5, k = clamp(game.transitionT / dur, 0, 1);
    const cover = Math.sin(k * Math.PI); // 0→1→0
    const ctx = this.ctx, W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
    ctx.save();
    ctx.fillStyle = `rgba(6,5,9,${0.94 * cover})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, cover * 1.3);
    // 後光
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H * 0.4);
    g.addColorStop(0, 'rgba(200,150,60,0.18)'); g.addColorStop(1, 'rgba(200,150,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // realm名（筆）
    ctx.fillStyle = '#ecd07e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(H * 0.17)}px "Yuji Syuku", "Shippori Mincho B1", serif`;
    ctx.fillText(game.transitionName, W / 2, H / 2 - H * 0.02);
    // 朱の下線
    ctx.strokeStyle = `rgba(200,64,47,${0.8 * cover})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2 - H * 0.16, H / 2 + H * 0.12); ctx.lineTo(W / 2 + H * 0.16, H / 2 + H * 0.12); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  },

  drawKarma(game) {
    const tier = clamp(Math.floor(game.run.karma / 15), 0, 3);
    if (tier <= 0) return;
    const ctx = this.ctx, W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
    const a = tier * 0.05;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(150,22,12,${a + 0.05})`);
    ctx.save();
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(120,16,10,${a * 0.45})`; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },

  drawChannel(ch) {
    const s = this.worldToScreen(ch.x, ch.y);
    const ctx = this.ctx;
    ctx.save(); ctx.translate(s.x, s.y - 30);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffce6b'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ch.prog, 0, 1)); ctx.stroke();
    ctx.fillStyle = '#ffe6a8'; ctx.font = 'bold 10px "Shippori Mincho B1", serif'; ctx.textAlign = 'center';
    ctx.fillText(ch.label, 0, -20);
    ctx.restore();
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
    const th = this.theme;
    // 前面
    if (belowOpen) {
      const g = ctx.createLinearGradient(0, topY + T, 0, s.y + T);
      g.addColorStop(0, th.wallFaceA);
      g.addColorStop(1, th.wallFaceB);
      ctx.fillStyle = g;
      ctx.fillRect(s.x, topY + T, T + 1, H + 1);
    }
    // 上面（ドット絵タイル）
    if (this.tiles) ctx.drawImage(this.tiles.wallTop, s.x, topY, T + 1, T + 1);
    else { ctx.fillStyle = th.wallTop; ctx.fillRect(s.x, topY, T + 1, T + 1); }
    // 上面の縁（立体感）
    ctx.fillStyle = 'rgba(255,240,210,0.06)'; ctx.fillRect(s.x, topY, T + 1, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(s.x, topY + T - 1, T + 1, 2);
    // 苔・罅（安定装飾）
    const hw = this.hash(tx * 7 + 3, ty * 7 + 5);
    if (hw > 0.85) { ctx.fillStyle = 'rgba(86,112,72,0.22)'; ctx.fillRect(s.x + 4 + hw * (T - 12), topY + 4 + ((hw * 19) % 1) * (T - 12), 5, 4); }
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

  drawPortal(ctx, game, portal) {
    const s = this.worldToScreen(portal.x, portal.y);
    const t = game.time;
    const R = portal.r;
    const open = game.runTime >= portal.openAt;
    const col = portal.bonus ? '#ffcf6b' : '#7fd0ff';
    const edge = portal.bonus ? '#ffe7a8' : '#aee7ff';
    ctx.save();
    ctx.translate(s.x, s.y);
    if (open) {
      for (let i = 3; i >= 0; i--) {
        const rr = R * (0.5 + i * 0.22) + Math.sin(t * 3 + i) * 3;
        ctx.fillStyle = hexA(col, 0.12 + i * 0.05);
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
      }
      ctx.shadowColor = edge; ctx.shadowBlur = 18;
      ctx.strokeStyle = hexA(edge, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.7, t % TAU, t % TAU + 5); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = portal.bonus ? '#fff0c8' : '#eaffff';
      ctx.font = 'bold 12px "Cinzel", serif'; ctx.textAlign = 'center';
      ctx.fillText(portal.bonus ? '報酬の脱出' : '脱出', 0, -R - 6);
    } else {
      // 未開放：暗くロック表示＋カウントダウン
      ctx.fillStyle = hexA(col, 0.12);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA('#888', 0.5); ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#cfcfd6'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('封 ' + Math.ceil(portal.openAt - game.runTime) + 's', 0, -R - 4);
    }
    ctx.restore();
  },

  drawStairs(ctx, st, game) {
    const s = this.worldToScreen(st.x, st.y);
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 18, 26, 8, 0, 0, TAU); ctx.fill();
    // 穴
    ctx.fillStyle = 'rgba(4,4,8,0.95)';
    ctx.fillRect(-22, -16, 44, 34);
    // 降りていく段
    for (let i = 0; i < 4; i++) {
      const w = 40 - i * 8;
      const c = 54 - i * 12;
      ctx.fillStyle = `rgb(${c},${c - 6},${c - 12})`;
      ctx.fillRect(-w / 2, -14 + i * 8, w, 7);
    }
    const gl = 0.4 + Math.sin(game.time * 3) * 0.2;
    ctx.strokeStyle = hexA('#9fd0ff', gl); ctx.lineWidth = 2;
    ctx.strokeRect(-22, -16, 44, 34);
    ctx.fillStyle = '#bfe0ff'; ctx.font = 'bold 11px "Cinzel", serif'; ctx.textAlign = 'center';
    ctx.fillText('下り階段', 0, -23);
    ctx.restore();
  },

  drawAltar(ctx, a, game) {
    const s = this.worldToScreen(a.x, a.y);
    const t = game.time;
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 12, 22, 8, 0, 0, TAU); ctx.fill();
    const col = a.type === 'sacrifice' ? '#c43b5e' : '#7fb0ff';
    // 台座
    ctx.fillStyle = a.used ? '#3a3640' : '#4a4654';
    ctx.fillRect(-16, -6, 32, 18);
    ctx.fillStyle = a.used ? '#2a2730' : '#565260';
    ctx.fillRect(-12, -16, 24, 12);
    if (!a.used) {
      const gl = 0.5 + Math.sin(t * 3) * 0.3;
      ctx.fillStyle = hexA(col, 0.2 * gl);
      ctx.beginPath(); ctx.arc(0, -14, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = col;
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(a.type === 'sacrifice' ? '血' : '聖', 0, -9);
      ctx.fillStyle = hexA(col, 0.9); ctx.font = 'bold 10px sans-serif';
      ctx.fillText(a.type === 'sacrifice' ? '生贄の祭壇' : '聖域', 0, -26);
    }
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
    const rare = RARITY_ORDER.indexOf(g.item.rarity) >= 3;
    ctx.save(); ctx.translate(s.x, s.y + yo);
    // 光柱（レア以上は強く）
    if (rare) {
      const beam = ctx.createLinearGradient(0, -36, 0, 4);
      beam.addColorStop(0, 'rgba(0,0,0,0)'); beam.addColorStop(1, hexA(col, 0.35));
      ctx.fillStyle = beam; ctx.fillRect(-5, -36, 10, 40);
    }
    ctx.fillStyle = hexA(col, rare ? 0.3 : 0.2);
    ctx.beginPath(); ctx.arc(0, 0, rare ? 15 : 12, 0, TAU); ctx.fill();
    // ドット絵アイコン
    const spr = Sprites.iconCanvas(g.item);
    const sc = (rare ? 22 : 19) / Math.max(spr._w, spr._h);
    const w = spr._w * sc, h = spr._h * sc;
    ctx.imageSmoothingEnabled = false;
    if (rare) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
    ctx.drawImage(spr, Math.round(-w / 2), Math.round(-h / 2), w, h);
    ctx.shadowBlur = 0;
    ctx.restore();
  },

  // ドット絵スプライトを足元基準で描画（bobY=上下アニメ）
  blitSprite(ctx, spr, r, bobY = 0) {
    const sc = (r * 2.7) / spr._w;
    const w = spr._w * sc, h = spr._h * sc;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, Math.round(-w / 2), Math.round(r * 0.5 - h + bobY), w, h);
    return r * 0.5 - h + bobY; // topY
  },
  // 歩行/攻撃アニメのオフセット
  animOffset(e) {
    const bob = e._moving ? -Math.abs(Math.sin(e.walkPhase || 0)) * 3 : Math.sin((performance.now() / 520) + (e.x || 0)) * 0.8;
    let lx = 0, ly = 0;
    if (e.attackT > 0) { const k = Math.sin((1 - e.attackT / 0.18) * Math.PI) * 7; lx = Math.cos(e.facing) * k; ly = Math.sin(e.facing) * k * 0.6; }
    return { bob, lx, ly };
  },
  facingMark(ctx, ang, r, col) {
    ctx.save(); ctx.translate(0, r * 0.1); ctx.rotate(ang);
    ctx.fillStyle = hexA(col, 0.9);
    ctx.beginPath(); ctx.moveTo(r + 7, 0); ctx.lineTo(r, -4); ctx.lineTo(r, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  drawPlayer(ctx, p) {
    const s = this.worldToScreen(p.x, p.y);
    const r = CONFIG.PLAYER_R;
    ctx.save(); ctx.translate(s.x, s.y);
    if (p.dodgeT > 0) ctx.globalAlpha = 0.55;
    else if (p.invuln > 0) ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 40) * 0.3;
    const col = CLASSES[p.classId].color;
    const an = this.animOffset(p);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.5, r, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(an.lx, an.ly);
    this.facingMark(ctx, p.facing, r, col);
    this.blitSprite(ctx, Sprites.player(p.classId), r, an.bob);
    ctx.restore();
    this.drawBar(ctx, -r, (r * 0.5 - 38) - 7, r * 2, 4, p.hp / p.derived.hpmax, '#7ad17a', '#3a0e0e');
    ctx.restore();
  },

  drawEnemy(ctx, e, game) {
    if (e.type === 'rival') return this.drawRival(ctx, e);
    const def = ENEMIES[e.type];
    const s = this.worldToScreen(e.x, e.y);
    const r = e.r;
    const t = performance.now() / 1000;

    // 予備動作テレゴラフ（攻撃の予兆＝回避の合図）
    if (e.windT > 0) {
      const prog = 1 - e.windT / e.windMax;
      ctx.save(); ctx.translate(s.x, s.y);
      if (def.behavior === 'ranged') {
        ctx.strokeStyle = `rgba(255,70,70,${0.3 + prog * 0.5})`;
        ctx.lineWidth = 2 + prog * 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(0, -6);
        ctx.lineTo(Math.cos(e.facing) * 460, Math.sin(e.facing) * 460 - 6); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = `rgba(255,60,60,${0.18 + prog * 0.4})`;
        ctx.beginPath(); ctx.moveTo(0, -6);
        ctx.arc(0, -6, (def.range + r) * (0.5 + prog * 0.5), e.facing - 0.8, e.facing + 0.8);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    ctx.save(); ctx.translate(s.x, s.y);
    // エリートのオーラ
    if (e.elite) {
      const pr = 0.6 + Math.sin(t * 5) * 0.25;
      ctx.strokeStyle = hexA(e.elite.color, pr);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -6, r + 4 + Math.sin(t * 4) * 1.5, 0, TAU); ctx.stroke();
      ctx.fillStyle = hexA(e.elite.color, 0.12);
      ctx.beginPath(); ctx.arc(0, -6, r + 6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.55, r, r * 0.45, 0, 0, TAU); ctx.fill();
    const hit = e.hitFlash > 0;
    const baseCol = e.elite ? e.elite.color : def.color;
    const an = this.animOffset(e);
    ctx.save(); ctx.translate(an.lx, an.ly);
    this.facingMark(ctx, e.facing, r, baseCol);
    const tmpl = Sprites.templateOf(e.type);
    if (hit) this.blitSprite(ctx, Sprites.flash(tmpl), r, an.bob);
    else this.blitSprite(ctx, Sprites.get(tmpl, baseCol), r, an.bob);
    ctx.restore();
    const topY = -r * 2.2;
    this.drawBar(ctx, -r, topY - 7, r * 2, def.boss ? 6 : 4, e.hp / e.maxhp, def.boss ? '#ff6a4d' : (e.elite ? hexA(e.elite.color, 1) : '#e0574d'), '#2a0808');
    if (def.boss) {
      ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 11px "Cinzel", serif'; ctx.textAlign = 'center';
      ctx.fillText(def.name, 0, topY - 11);
    } else if (e.elite) {
      ctx.fillStyle = e.elite.color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(e.elite.name + def.name, 0, topY - 10);
    }
    ctx.restore();
  },

  drawRival(ctx, e) {
    const s = this.worldToScreen(e.x, e.y);
    const r = e.r, col = e.color || '#ddd';
    const hit = e.hitFlash > 0;
    ctx.save(); ctx.translate(s.x, s.y);
    const an = this.animOffset(e);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.5, r, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(an.lx, an.ly);
    this.facingMark(ctx, e.facing, r, col);
    if (hit) this.blitSprite(ctx, Sprites.flash(CLASS_SPRITE[e.rivalClass] || 'monk'), r, an.bob); else this.blitSprite(ctx, Sprites.player(e.rivalClass), r, an.bob);
    ctx.restore();
    const topY = -r * 2.2;
    this.drawBar(ctx, -r, topY - 8, r * 2, 5, e.hp / e.maxhp, '#ff7ad0', '#3a0e2a');
    ctx.fillStyle = '#ff9fe0'; ctx.font = 'bold 10px "Shippori Mincho B1", serif'; ctx.textAlign = 'center';
    ctx.fillText(ENEMIES.rival.name, 0, topY - 11);
    ctx.restore();
  },

  // ミニマップ：全体は最初から描かれている（踏破で明るくなる）
  drawMinimap(game) {
    const dgn = game.dgn, ctx = this.ctx, T = CONFIG.TILE;
    const pad = 12, mw = 160, mh = Math.round(mw * dgn.pxH / dgn.pxW);
    const x0 = CONFIG.VIEW_W - mw - pad, y0 = 58;
    const sx = mw / dgn.pxW, sy = mh / dgn.pxH;
    const X = (wx) => x0 + wx * sx, Y = (wy) => y0 + wy * sy;
    ctx.save();
    // 巻物風の地（金二重枠＋四隅）
    ctx.fillStyle = 'rgba(10,9,14,0.82)'; ctx.fillRect(x0 - 6, y0 - 6, mw + 12, mh + 12);
    ctx.strokeStyle = 'rgba(199,162,76,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 - 6, y0 - 6, mw + 12, mh + 12);
    ctx.strokeStyle = 'rgba(199,162,76,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 3, y0 - 3, mw + 6, mh + 6);
    ctx.fillStyle = 'rgba(199,162,76,0.8)';
    for (const [cx, cy] of [[x0 - 6, y0 - 6], [x0 + mw + 6, y0 - 6], [x0 - 6, y0 + mh + 6], [x0 + mw + 6, y0 + mh + 6]]) ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    // 部屋（全表示・踏破で明るく）
    for (const r of dgn.rooms) {
      ctx.fillStyle = r.revealed ? 'rgba(150,140,120,0.62)' : 'rgba(80,76,92,0.32)';
      ctx.fillRect(X(r.x * T), Y(r.y * T), r.w * T * sx, r.h * T * sy);
      if (r === game.playerRoom) { ctx.strokeStyle = 'rgba(236,205,126,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(X(r.x * T), Y(r.y * T), r.w * T * sx, r.h * T * sy); }
    }
    // 脱出ポータル
    for (const p of dgn.portals) {
      const open = game.runTime >= p.openAt;
      ctx.fillStyle = p.bonus ? (open ? '#ffce6b' : 'rgba(255,206,107,0.45)') : (open ? '#7fd0ff' : 'rgba(127,208,255,0.45)');
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
    }
    // 下り階段
    if (game.stairs) { ctx.fillStyle = '#bfe0ff'; ctx.fillRect(X(game.stairs.x) - 2.5, Y(game.stairs.y) - 2.5, 5, 5); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.strokeRect(X(game.stairs.x) - 2.5, Y(game.stairs.y) - 2.5, 5, 5); }
    // 祭壇/聖域
    for (const a of (game.altars || [])) { if (a.used) continue; ctx.fillStyle = a.type === 'sacrifice' ? '#c8402f' : '#7fb0ff'; ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), 2, 0, TAU); ctx.fill(); }
    // ライバル（踏破部屋のみ）
    for (const e of game.enemies) {
      if (e.dead || e.type !== 'rival') continue;
      const rm = roomAt(dgn, e.x, e.y); if (!rm || !rm.revealed) continue;
      ctx.fillStyle = '#ff7ad0'; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 2.4, 0, TAU); ctx.fill();
    }
    // 自機（明滅）
    const pl = game.player, blink = 0.6 + Math.sin(game.time * 6) * 0.4;
    ctx.fillStyle = '#fff'; ctx.globalAlpha = blink;
    ctx.beginPath(); ctx.arc(X(pl.x), Y(pl.y), 2.8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    // 現在地の realm 名
    ctx.fillStyle = 'rgba(236,205,126,0.85)'; ctx.font = 'bold 9px "Shippori Mincho B1", serif'; ctx.textAlign = 'left';
    ctx.fillText(realmName(game.floor), x0 - 4, y0 - 9);
    ctx.restore();
  },

  drawProjectile(ctx, p) {
    const s = this.worldToScreen(p.x, p.y);
    ctx.save(); ctx.translate(s.x, s.y);
    // トレイル
    ctx.fillStyle = hexA(p.color, 0.22);
    ctx.beginPath(); ctx.arc(-Math.cos(p.ang) * 9, -Math.sin(p.ang) * 9, p.r * 1.0, 0, TAU); ctx.fill();
    ctx.fillStyle = hexA(p.color, 0.16);
    ctx.beginPath(); ctx.arc(-Math.cos(p.ang) * 16, -Math.sin(p.ang) * 16, p.r * 0.7, 0, TAU); ctx.fill();
    // 発光する弾
    ctx.shadowColor = p.color; ctx.shadowBlur = 14;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fffdf2';
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.42, 0, TAU); ctx.fill();
    ctx.restore();
  },

  drawParticle(ctx, p) {
    const s = this.worldToScreen(p.x, p.y);
    ctx.globalAlpha = clamp(p.life / p.maxlife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, p.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawAoe(ctx, a) {
    if (a.done) return;
    const s = this.worldToScreen(a.x, a.y);
    const fill = (1 - a.t / a.maxt);
    ctx.save();
    ctx.fillStyle = hexA(a.color, 0.12 + fill * 0.22);
    ctx.beginPath(); ctx.arc(s.x, s.y, a.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA(a.color, 0.5 + fill * 0.4); ctx.lineWidth = 2 + fill * 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, a.r, 0, TAU); ctx.stroke();
    // 詠唱の充填
    ctx.fillStyle = hexA(a.color, 0.28);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, a.r, -Math.PI / 2, -Math.PI / 2 + TAU * fill); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  drawFx(ctx, f) {
    const s = this.worldToScreen(f.x, f.y);
    const k = clamp(f.life / f.maxlife, 0, 1);
    if (f.type === 'slash') {
      const prog = 1 - k;
      const a0 = f.ang - f.arc / 2, a1 = f.ang + f.arc / 2;
      const a = a0 + (a1 - a0) * Math.min(1, prog * 1.7);
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.shadowColor = f.color; ctx.shadowBlur = 8;
      ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = 5 * k + 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, f.range * 0.68, a0, a); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = k * 0.5; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, f.range * 0.5, a0, a); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (f.type === 'ring') {
      const r = lerp(f.r0, f.r1, 1 - k);
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = (f.width || 3) * k + 0.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }
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

    // ベースの闇（暖かみのある漆黒）。世界は暗く、視界とトーチで照らす。
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = 'rgba(7,4,3,0.95)';
    lctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    // 踏破済みの「明るい部屋」は記憶として薄く見える
    lctx.globalCompositeOperation = 'destination-out';
    for (const r of dgn.rooms) {
      if (!r.revealed || !r.lit) continue;
      this.carveRoom(lctx, r, r === game.playerRoom ? 0.95 : 0.58);
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
    lctx.fillStyle = 'rgba(6,4,3,1)';
    for (const r of dgn.rooms) {
      if (r.revealed) continue;
      const s = this.worldToScreen(r.x * T, r.y * T);
      lctx.fillRect(s.x - T, s.y - T - CONFIG.WALL_H, r.w * T + T * 2, r.h * T + T * 2 + CONFIG.WALL_H);
    }

    // 合成
    this.ctx.drawImage(this.light, 0, 0);

    // 松明の暖色光（プレイヤー中心）
    const ps = this.worldToScreen(p.x, p.y);
    const warmR = (p.derived.hasTorch ? CONFIG.TORCH_VISION : CONFIG.BASE_VISION) * T * 0.75;
    const fl = 0.10 + Math.sin(game.time * 9) * 0.015;
    const wg = this.ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, warmR);
    wg.addColorStop(0, `rgba(255,176,92,${fl})`);
    wg.addColorStop(0.6, `rgba(255,150,70,${fl * 0.4})`);
    wg.addColorStop(1, 'rgba(255,140,60,0)');
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.fillStyle = wg;
    this.ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this.ctx.globalCompositeOperation = 'source-over';
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
