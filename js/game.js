// ============================================================
// game.js — エンティティ / 戦闘 / AI / 状態管理 / メインループ
// ============================================================
const Game = {
  state: 'boot',           // boot / class_select / town / dungeon / result
  profile: null,
  derived: null,
  dgn: null,
  player: null,
  enemies: [], projectiles: [], particles: [], floatTexts: [], groundItems: [], chests: [],
  time: 0, lastT: 0,
  selectedSkill: -1,       // -1 = ノーマル攻撃
  floor: 1,
  playerRoom: null,
  run: null,
  extractT: 0,
  paused: false,
  hitStop: 0,
  shake: { t: 0, mag: 0 },
  msg: '', msgT: 0,

  // ---------- 起動 ----------
  boot() {
    Render.init(document.getElementById('game'));
    Input.init(document.getElementById('game'));
    UI.init();
    this.profile = loadProfile();
    this.goTown();
    this.lastT = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  // 修行の道（職業）を選ぶ／変える
  chooseClass(classId) {
    if (this.profile && this.profile.classId === classId) { this.goTown('status'); return; }
    if (this.profile) {
      UI.confirm('修行の道を改めますか？\nレベル・ステータス・装備は新たな道のものに改まります（所持金と倉庫は引き継ぎ）。',
        () => this.applyClass(classId), '改める', 'やめる');
      return;
    }
    this.applyClass(classId);
  },
  applyClass(classId) {
    if (this.profile) {
      const gold = this.profile.gold, stash = this.profile.stash, bounties = this.profile.bounties, ach = this.profile.achievements;
      this.profile = newProfile(classId);
      this.profile.gold = gold; this.profile.stash = stash; this.profile.bounties = bounties; this.profile.achievements = ach;
    } else {
      this.profile = newProfile(classId);
    }
    Audio2.play && Audio2.play('levelup');
    this.derived = computeDerived(this.profile);
    saveProfile(this.profile);
    this.goTown('status');
  },
  createCharacter(classId) { this.chooseClass(classId); },

  goTown(tab) {
    this.state = 'town';
    Input.enabled = false; Input.reset();
    Audio2.stopAmbient();
    if (this.profile) {
      // 破損/旧セーブの救済
      if (!CLASSES[this.profile.classId]) {
        this.profile.classId = REMOVED_CLASS_MAP[this.profile.classId] || 'fighter';
        this.profile.loadout = [...CLASSES[this.profile.classId].skills];
      }
      const cls = CLASSES[this.profile.classId];
      if (!this.profile.baseAttrs) this.profile.baseAttrs = { ...cls.base };
      if (!this.profile.equipment) this.profile.equipment = { weapon: null, head: null, chest: null, hands: null, legs: null, ring: null, torch: null };
      if (!Array.isArray(this.profile.potions)) this.profile.potions = new Array(CONFIG.POTION_SLOTS).fill(null);
      if (!Array.isArray(this.profile.stash)) this.profile.stash = [];
      if (!this.profile.runStats) this.profile.runStats = { runs: 0, extracts: 0, deaths: 0, kills: 0, gold: 0, elites: 0 };
      if (typeof this.profile.gold !== 'number') this.profile.gold = 0;
      if (!this.profile.level) { this.profile.level = 1; this.profile.xp = 0; this.profile.points = 0; }
      if (!this.profile.achievements) this.profile.achievements = {};
      if (!this.profile.bounties) this.profile.bounties = [];
      if (!this.profile.runStats.elites) this.profile.runStats.elites = 0;
      if (!this.profile.loadout) this.profile.loadout = [...CLASSES[this.profile.classId].skills];
      if (this.profile.bounties.length < 3) {
        const need = 3 - this.profile.bounties.length;
        this.profile.bounties.push(...generateBounties().slice(0, need));
      }
      try {
        this.derived = computeDerived(this.profile);
        saveProfile(this.profile);
      } catch (e) {
        console.warn('セーブ破損のためリセット', e);
        deleteProfile(); this.profile = null;
      }
    }
    UI.showTown(this.profile ? (tab || 'status') : 'class');
  },

  // ---------- ダンジョン突入（深度1から。階段で潜るほど難化＆高レア化） ----------
  enterDungeon() {
    this.floor = 1;
    this.derived = computeDerived(this.profile);
    this.run = { loot: [], kills: 0, gold: 0, startGold: this.profile.gold, karma: 0 };
    this.selectedSkill = -1;

    // プレイヤー生成（持ち込み装備のスナップショット）
    const d = this.derived;
    this.player = {
      x: 0, y: 0, vx: 0, vy: 0, facing: -Math.PI / 2,
      hp: d.hpmax, mp: d.mpmax, derived: d, classId: this.profile.classId,
      skillCd: [0, 0], attackCd: 0, potionCd: 0, invuln: 0, buffs: [], dead: false,
      slowT: 0, slowMul: 1, zoneTick: 0, dodgeCd: 0, dodgeT: 0, dodgeDir: 0, dotT: 0, dotDmg: 0, dotAcc: 0,
      skills: (this.profile.loadout && this.profile.loadout.length === 2) ? this.profile.loadout : CLASSES[this.profile.classId].skills,
      potions: this.profile.potions.map(p => p ? { ...p } : null),
    };

    this.buildLevel();

    this.state = 'dungeon';
    Input.enabled = true; Input.reset();
    Input.fireCallback = (ang) => this.onFire(ang);
    Input.aimChange = (ang) => { this.player.facing = ang; };
    UI.showHUD();
    UI.buildSkillBar(this);
    this.toast(realmName(this.floor) + 'へ踏み入る — 生きて還れ');
  },

  // 現在の深度でレベルを生成（プレイヤー状態は維持）
  buildLevel() {
    this.dgn = genDungeon(this.floor, this.derived);
    this.projectiles = []; this.particles = []; this.floatTexts = []; this.fx = []; this.aoes = []; this.extractT = 0;
    this.runTime = 0;
    this.enemies = this.dgn.enemySpawns.map(sp => this.makeEnemy(sp.type, sp.x, sp.y));
    this.groundItems = this.dgn.groundItems.slice();
    this.chests = this.dgn.chests.slice();
    this.traps = this.dgn.traps.slice();
    this.altars = this.dgn.altars.slice();
    this.stairs = this.dgn.stairs;
    this.nearAltar = null; this.nearStairs = null; this.channelTarget = null; this.interactHeld = false;
    this.player.x = this.dgn.startX; this.player.y = this.dgn.startY;
    this.player.dodgeT = 0; this.player.invuln = 0.6; // 到着直後の保護
    this.transitionT = 1.5; this.transitionName = realmName(this.floor);
    this.initZone();
    Audio2.init();
    Audio2.startAmbient(this.floor);
    Audio2.bell(this.floor);
  },

  // 階段で1つ深く潜る（難易度・レア度UP、装備/HP/戦利品は維持）
  descend() {
    this.floor++;
    this.player.derived = this.derived;
    this.buildLevel();
    Audio2.play('door');
    this.toast(realmName(this.floor) + 'へ堕ちた — 魔も宝も深まる');
  },

  makeEnemy(type, x, y, forceElite) {
    const def = ENEMIES[type];
    const sc = 1 + (this.floor - 1) * 0.16;
    const e = {
      type, x, y, vx: 0, vy: 0, facing: rand(0, TAU),
      maxhp: Math.round(def.hp * sc), hp: Math.round(def.hp * sc),
      atk: def.atk * sc, def: def.def, speed: def.speed,
      r: def.r, state: 'idle', atkCd: rand(0, 1), wanderT: 0, wanderAng: rand(0, TAU),
      hitFlash: 0, dead: false, slowT: 0, slowMul: 1, dotT: 0, dotDmg: 0, knockX: 0, knockY: 0,
      stunT: 0, summonCd: rand(4, 7), windT: 0, windMax: 0, pending: null, elite: null, regenT: 0,
      specialCd: def.boss ? rand(4, 6) : 0, special: null,
    };
    // ライバル冒険者：ランダムな職業を割り当て
    if (def.rival) {
      e.rival = true;
      e.rivalClass = choice(Object.keys(CLASSES));
      const cls = CLASSES[e.rivalClass];
      e.weaponKind = cls.weapon;
      e.color = cls.color;
    }
    // エリート抽選（ボス・ライバル以外）
    if (!def.boss && !def.rival && (forceElite || Math.random() < 0.1 + this.floor * 0.025)) {
      const mod = choice(ELITE_MODS);
      e.elite = mod;
      e.maxhp = Math.round(e.maxhp * mod.hp); e.hp = e.maxhp;
      e.atk *= mod.atk; e.speed *= mod.speed; e.r = Math.round(e.r * mod.size);
    }
    return e;
  },

  // ---------- メインループ ----------
  loop(t) {
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (dt > 0.05) dt = 0.05;
    this.time += dt;

    if (this.state === 'dungeon' && !this.paused) {
      // ヒットストップ：一瞬だけ更新を止めて打撃の重みを出す
      if (this.hitStop > 0) { this.hitStop -= dt; }
      else this.update(dt);
      if (this.shake.t > 0) this.shake.t -= dt;
      Render.render(this);
      Input.poll();
      Input.drawSticks(Render.ctx);
      UI.updateHUD(this);
    }
    if (this.msgT > 0) this.msgT -= dt;
    requestAnimationFrame(tt => this.loop(tt));
  },

  // ---------- 更新 ----------
  update(dt) {
    Input.poll();
    const p = this.player, d = p.derived;

    // バフ更新
    p.buffs = p.buffs.filter(b => (b.t -= dt) > 0);

    // 移動
    let sp = d.speed;
    for (const b of p.buffs) if (b.stat === 'speed') sp *= b.mult;
    if (p.slowT > 0) { p.slowT -= dt; sp *= p.slowMul; }
    if (p.dodgeT > 0) {
      // 回避ローリング中：高速で移動（無敵）
      p.dodgeT -= dt;
      const ds = d.speed * 3.4;
      const np = tryMove(this.dgn, p.x, p.y, CONFIG.PLAYER_R, Math.cos(p.dodgeDir) * ds * dt, Math.sin(p.dodgeDir) * ds * dt);
      p.x = np.x; p.y = np.y; p.facing = p.dodgeDir;
      p._moving = true; p.walkPhase = (p.walkPhase || 0) + dt * 24;
      this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 7, color: 'rgba(180,210,255,0.7)', life: 0.2, maxlife: 0.2 });
    } else {
      let mx = Input.move.x, my = Input.move.y;
      const ml = len(mx, my);
      if (ml > 0.05) {
        const np = tryMove(this.dgn, p.x, p.y, CONFIG.PLAYER_R, mx * sp * dt, my * sp * dt);
        p.x = np.x; p.y = np.y;
        if (!Input.aimVec.active) p.facing = angleOf(mx, my);
        p._moving = true; p.walkPhase = (p.walkPhase || 0) + dt * 16;
      } else p._moving = false;
    }

    // 足音
    if (p._moving && p.dodgeT <= 0) { p.stepT = (p.stepT || 0) - dt; if (p.stepT <= 0) { p.stepT = 0.32; Audio2.play('step'); } }
    // 継続ダメージ（プレイヤー）
    if (p.dotT > 0) {
      p.dotT -= dt; p.dotAcc += dt;
      if (p.dotAcc >= 0.5) { p.dotAcc = 0; this.hurtDot(p.dotDmg); }
    }

    // タイマー
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.potionCd = Math.max(0, p.potionCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.attackT = Math.max(0, (p.attackT || 0) - dt);
    p.skillCd[0] = Math.max(0, p.skillCd[0] - dt);
    p.skillCd[1] = Math.max(0, p.skillCd[1] - dt);
    p.mp = Math.min(d.mpmax, p.mp + d.mpregen * dt);

    // キーボード操作（スキル選択・ポーション・発射）
    this.handleKeys(dt);

    // 扉・宝箱は時間をかけて開ける（チャネル）／拾得・部屋リビール
    this.updateChannel(dt);
    this.playerRoom = roomAt(this.dgn, p.x, p.y);
    if (this.playerRoom && !this.playerRoom.revealed) this.playerRoom.revealed = true;
    this.updatePickups();
    this.updatePortal(dt);
    this.updateAltars();
    this.updateTraps(dt);
    this.runTime += dt;
    if (this.transitionT > 0) this.transitionT -= dt;
    this.updateZone(dt);

    // 敵
    for (const e of this.enemies) if (!e.dead) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter(e => !e.dead || e.deathT > 0);

    // 投射物・ボスAoE
    this.updateProjectiles(dt);
    this.updateAoes(dt);

    // 環境演出：火の粉・塵が漂う
    if (Math.random() < dt * 5) {
      const a = rand(0, TAU), dd = rand(50, 300);
      const warm = chance(0.35);
      this.particles.push({
        x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd,
        vx: rand(-5, 5), vy: rand(-16, -5), r: rand(0.8, 1.7),
        color: warm ? 'rgba(255,176,92,0.5)' : 'rgba(200,205,225,0.22)',
        life: rand(1.4, 2.6), maxlife: 2.6,
      });
    }
    // パーティクル・フロートテキスト
    for (const pa of this.particles) { pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vx *= 0.92; pa.vy *= 0.92; pa.life -= dt; }
    this.particles = this.particles.filter(pa => pa.life > 0);
    for (const f of this.floatTexts) { f.y += f.vy * dt; f.vy += 60 * dt; f.life -= dt; }
    this.floatTexts = this.floatTexts.filter(f => f.life > 0);
    if (this.fx) { for (const f of this.fx) f.life -= dt; this.fx = this.fx.filter(f => f.life > 0); }

    if (p.hp <= 0 && !p.dead) this.die();
  },

  handleKeys(dt) {
    const k = Input.keys;
    if (k['1']) this.selectSkill(0);
    if (k['2']) this.selectSkill(1);
    if (k['0'] || k['`']) this.selectSkill(-1);
    if (k['q']) { this.usePotion(0); k['q'] = false; }
    if (k['e']) { this.usePotion(1); k['e'] = false; }
    // 開ける/祈る/降りる：押した瞬間＋押している間
    if (k['f'] && !this._fDown) { this._fDown = true; this.onInteractDown(); }
    if (!k['f'] && this._fDown) { this._fDown = false; this.onInteractUp(); }
    // スペース or 左クリックでマウス方向に発射
    if (k[' ']) { k[' '] = false; const ang = angleOf(Input.mouse.x - CONFIG.VIEW_W / 2, Input.mouse.y - CONFIG.VIEW_H / 2); this.player.facing = ang; this.onFire(ang); }
  },

  // ---------- 発射（ノーマル or スキル） ----------
  onFire(ang) {
    const p = this.player;
    if (p.dead) return;
    if (ang === null) ang = p.facing;
    p.facing = ang;
    if (this.selectedSkill >= 0) {
      const sid = p.skills[this.selectedSkill];
      if (this.castSkill(sid, this.selectedSkill, ang)) return;
      // 撃てなければノーマルにフォールバックしない（合図のみ）
      return;
    }
    this.normalAttack(ang);
  },

  buffMul(stat) { let m = 1; for (const b of this.player.buffs) if (b.stat === stat) m *= b.mult; return m; },
  karmaTier() { return this.run ? clamp(Math.floor(this.run.karma / 15), 0, 3) : 0; },

  normalAttack(ang) {
    const p = this.player, d = p.derived, wt = d.wtype;
    if (p.attackCd > 0) return;
    p.attackCd = wt.speed * d.atkSpeedMult;
    p.attackT = 0.18;
    const power = attackPower(d, wt.scaling) * this.buffMul(wt.kind === 'magic' ? 'matk' : 'patk');
    if (wt.kind === 'melee') {
      this.meleeSwing(p.x, p.y, ang, wt.range, wt.arc, power, { crit: d.crit, critDmg: d.critDmg, knock: wt.knock || 0, color: wt.color });
      Audio2.play('swing');
    } else {
      // ranged/magic：投射
      this.spawnProjectile('player', p.x, p.y, ang, {
        speed: wt.projSpeed, dmg: power, r: wt.kind === 'magic' ? 9 : 7,
        color: wt.color, crit: d.crit, critDmg: d.critDmg, life: 1.2,
      });
      Audio2.play(wt.kind === 'magic' ? 'magic' : 'shoot');
    }
    this.muzzle(p.x, p.y, ang, wt.color);
  },

  castSkill(sid, slot, ang) {
    const p = this.player, d = p.derived, s = SKILLS[sid];
    if (p.skillCd[slot] > 0) { this.toast('クールダウン中'); return false; }
    if (p.mp < s.mp) { this.toast('MPが足りない'); return false; }
    p.mp -= s.mp; p.skillCd[slot] = s.cd; p.attackT = 0.18;
    const power = s.scaling ? attackPower(d, s.scaling) * s.dmg * this.buffMul(s.scaling === 'WILL' ? 'matk' : 'patk') : 0;
    const opt = { crit: d.crit, critDmg: d.critDmg, color: s.color, holy: s.holy, dot: s.dot, slow: s.slow, knock: s.knock || 0, lifesteal: s.lifesteal, stun: s.stun };
    Audio2.play(s.kind === 'heal' ? 'heal' : s.kind === 'buff' ? 'potion' : 'magic');

    if (s.kind === 'projectile') {
      const count = s.count || 1, spread = s.spread || 0;
      for (let i = 0; i < count; i++) {
        const a = ang + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0);
        this.spawnProjectile('player', p.x, p.y, a, {
          speed: s.projSpeed, dmg: power, r: s.radius || 10, color: s.color,
          pierce: s.pierce || 0, explode: s.explode, life: 1.6, ...opt,
        });
      }
    } else if (s.kind === 'melee') {
      this.meleeSwing(p.x, p.y, ang, s.range || 80, s.arc || 1.6, power, opt);
    } else if (s.kind === 'nova') {
      this.nova(p.x, p.y, s.radius, power, opt);
    } else if (s.kind === 'heal') {
      const amt = s.amount * d.healPow;
      p.hp = Math.min(d.hpmax, p.hp + amt);
      this.addFloat(p.x, p.y - 20, '+' + Math.round(amt), '#7dffa0', 18);
      this.burst(p.x, p.y, s.color, 14);
    } else if (s.kind === 'buff') {
      p.buffs.push({ stat: s.stat, mult: s.mult, t: s.dur });
      if (s.selfDef) p.buffs.push({ stat: 'defense', mult: s.selfDef, t: s.dur });
      this.addFloat(p.x, p.y - 20, s.name + '!', s.color, 16);
      this.burst(p.x, p.y, s.color, 12);
    } else if (s.kind === 'dash') {
      const nx = tryMove(this.dgn, p.x, p.y, CONFIG.PLAYER_R, Math.cos(ang) * s.dist, Math.sin(ang) * s.dist);
      // ダッシュ経路上にダメージ
      this.meleeSwing(nx.x, nx.y, ang, s.radius * 2, 2.2, power, opt);
      this.burst(p.x, p.y, s.color, 10);
      p.x = nx.x; p.y = nx.y; p.invuln = 0.25;
    }
    UI.buildSkillBar(this);
    return true;
  },

  meleeSwing(x, y, ang, range, arc, power, opt) {
    // 斬撃の弧
    this.spawnSlash(x, y, ang, arc, range, opt.color || '#e8eef6');
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dd = dist(x, y, e.x, e.y);
      if (dd > range + e.r) continue;
      const a = angleOf(e.x - x, e.y - y);
      if (Math.abs(angDiff(ang, a)) > arc / 2 + 0.2) continue;
      this.hitEnemy(e, power, ang, opt);
    }
  },

  nova(x, y, radius, power, opt) {
    this.burst(x, y, opt.color, 26, radius);
    this.spawnRing(x, y, 10, radius + 8, opt.color, 0.42, 5);
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (dist(x, y, e.x, e.y) <= radius + e.r) {
        const a = angleOf(e.x - x, e.y - y);
        this.hitEnemy(e, power, a, opt);
      }
    }
  },

  // ---------- 投射物 ----------
  spawnProjectile(owner, x, y, ang, o) {
    this.projectiles.push({
      owner, x, y, ang, vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed,
      r: o.r || 8, color: o.color || '#fff', dmg: o.dmg || 5,
      pierce: o.pierce || 0, hits: new Set(), explode: o.explode || 0,
      dot: o.dot, slow: o.slow, holy: o.holy, knock: o.knock || 0,
      lifesteal: o.lifesteal, stun: o.stun, onHit: o.onHit,
      crit: o.crit || 0, critDmg: o.critDmg || 1.5, life: o.life || 1.5, maxlife: o.life || 1.5,
    });
  },

  updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (isSolidAt(this.dgn, pr.x, pr.y)) { if (pr.explode) this.explode(pr); pr.life = 0; continue; }
      if (pr.owner === 'player') {
        for (const e of this.enemies) {
          if (e.dead || pr.hits.has(e)) continue;
          if (dist(pr.x, pr.y, e.x, e.y) <= pr.r + e.r) {
            pr.hits.add(e);
            this.hitEnemy(e, pr.dmg, pr.ang, pr);
            if (pr.explode) { this.explode(pr); pr.life = 0; break; }
            if (pr.pierce-- <= 0) { pr.life = 0; break; }
          }
        }
      } else {
        const p = this.player;
        if (!p.dead && p.invuln <= 0 && dist(pr.x, pr.y, p.x, p.y) <= pr.r + CONFIG.PLAYER_R) {
          this.hurtPlayer(pr.dmg, true);
          if (pr.onHit) this.applyOnHitToPlayer(pr.onHit);
          pr.life = 0;
        }
      }
    }
    this.projectiles = this.projectiles.filter(pr => pr.life > 0);
  },

  explode(pr) {
    this.burst(pr.x, pr.y, pr.color, 20, pr.explode);
    this.spawnRing(pr.x, pr.y, 4, pr.explode + 6, pr.color, 0.36, 4);
    for (const e of this.enemies) {
      if (e.dead || pr.hits.has(e)) continue;
      if (dist(pr.x, pr.y, e.x, e.y) <= pr.explode + e.r) this.hitEnemy(e, pr.dmg * 0.8, pr.ang, { ...pr, explode: 0 });
    }
  },

  // ---------- ダメージ ----------
  hitEnemy(e, power, ang, opt) {
    let dmg = power;
    const def = ENEMIES[e.type];
    if (opt.holy && def.undead) dmg *= 1.6;
    let crit = false;
    if (opt.crit && Math.random() < opt.crit) { crit = true; dmg *= (opt.critDmg || 1.5); }
    dmg = mitigate(dmg, e.def);
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hitFlash = 0.12;
    if (opt.dot) { e.dotT = opt.dot.dur; e.dotDmg = opt.dot.dmg; }
    if (opt.slow) { e.slowT = opt.slow.dur; e.slowMul = opt.slow.mult; }
    if (opt.knock) { e.knockX += Math.cos(ang) * opt.knock; e.knockY += Math.sin(ang) * opt.knock; }
    if (opt.stun) { e.stunT = Math.max(e.stunT, def.boss ? opt.stun * 0.4 : opt.stun); }
    const lifesteal = (opt.lifesteal || 0) + (this.player.derived.lifesteal || 0);
    if (lifesteal > 0) {
      const heal = dmg * lifesteal;
      this.player.hp = Math.min(this.player.derived.hpmax, this.player.hp + heal);
      if (heal >= 1) this.addFloat(this.player.x, this.player.y - 24, '+' + Math.round(heal), '#ff6ea0', 13);
    }
    this.addFloat(e.x, e.y - e.r - 6, '' + dmg, crit ? '#ffd24a' : '#ffffff', crit ? 22 : 15);
    this.spawnRing(e.x, e.y - e.r * 0.3, 2, e.r + (crit ? 12 : 6), crit ? '#ffd24a' : '#fff', crit ? 0.24 : 0.16, crit ? 3 : 2);
    if (crit) { this.burst(e.x, e.y, '#ffd24a', 6); this.hitStop = Math.max(this.hitStop, 0.05); this.addShake(4); }
    else this.hitStop = Math.max(this.hitStop, 0.02);
    Audio2.play(crit ? 'crit' : 'hit');
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true; e.deathT = 0;
    const def = ENEMIES[e.type];
    this.burst(e.x, e.y, e.elite ? e.elite.color : def.color, e.elite ? 24 : 16);
    Audio2.play(def.boss ? 'bossdie' : 'die');
    this.hitStop = Math.max(this.hitStop, def.boss ? 0.12 : 0.04);
    this.addShake(def.boss ? 16 : (e.elite ? 7 : 3));
    this.run.kills++;
    // 業（カルマ）：殺生で蓄積
    this.run.karma += def.boss ? 10 : (e.elite ? 3 : 1);
    // 実績・依頼
    this.progressBounty('kills', 1);
    if (def.boss) { this.unlockAch('boss_slayer'); this.progressBounty('boss', 1); }
    if (e.rival) { this.unlockAch('rival_slayer'); this.progressBounty('rival', 1); }
    if (e.elite) {
      this.profile.runStats.elites = (this.profile.runStats.elites || 0) + 1;
      if (this.profile.runStats.elites >= 10) this.unlockAch('elite10');
      this.progressBounty('elite', 1);
    }
    // ゴールド
    let g = randInt(def.gold[0], def.gold[1]);
    if (e.elite) g = Math.round(g * 2.2);
    if (e.rival) g = Math.round(g * 1.5) + 20;
    this.run.gold += g;
    // ドロップ
    const dropChance = def.boss ? 1 : (e.elite || e.rival ? 1 : 0.4);
    if (Math.random() < dropChance) {
      const n = def.boss ? 3 : (e.rival ? 3 : e.elite ? 2 : 1);
      const luckBonus = (def.boss ? 8 : e.rival ? 6 : e.elite ? 5 : 0) + this.karmaTier() * 2;
      for (let i = 0; i < n; i++) {
        this.groundItems.push({ x: e.x + rand(-14, 14), y: e.y + rand(-14, 14), item: randomLoot(this.floor + (e.elite || e.rival ? 1 : 0), this.derived.attr.LUCK + luckBonus) });
      }
    }
    // スライム分裂
    if (def.split && e.maxhp > 16) {
      for (let i = 0; i < 2; i++) {
        const c = this.makeEnemy('slime', e.x + rand(-12, 12), e.y + rand(-12, 12));
        c.maxhp = Math.round(e.maxhp * 0.45); c.hp = c.maxhp; c.r = Math.max(8, e.r - 4);
        this.enemies.push(c);
      }
    }
  },

  hurtPlayer(amount, magic) {
    const p = this.player, d = p.derived;
    if (p.dead || p.invuln > 0) return;
    if (Math.random() < d.dodge) { this.addFloat(p.x, p.y - 24, '回避', '#aef', 14); p.invuln = 0.15; return; }
    let dmg = amount * (1 + this.karmaTier() * 0.12); // 業が深いほど獄卒が強くなる
    if (magic) dmg *= (1 - d.magicResist);
    let defense = d.defense;
    for (const b of p.buffs) if (b.stat === 'defense') defense *= b.mult;
    dmg = mitigate(dmg, defense);
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg; p.invuln = 0.25;
    this.addFloat(p.x, p.y - 26, '-' + dmg, '#ff6a5a', 17);
    UI.flashDamage();
    this.addShake(7);
    Audio2.play('hurt');
  },

  // 継続ダメージ（無敵・回避を貫通）
  hurtDot(amount) {
    const p = this.player;
    if (p.dead) return;
    let dmg = Math.max(1, Math.round(amount * (1 - p.derived.magicResist * 0.5)));
    p.hp -= dmg;
    this.addFloat(p.x, p.y - 26, '-' + dmg, '#ff9a3c', 14);
  },

  addShake(mag) { if (mag > this.shake.mag || this.shake.t <= 0) this.shake.mag = mag; this.shake.t = Math.max(this.shake.t, 0.18); },

  // ---------- 敵AI ----------
  updateEnemy(e, dt) {
    const def = ENEMIES[e.type];
    const p = this.player;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.attackT = Math.max(0, (e.attackT || 0) - dt);
    if (def.boss) e.specialCd = Math.max(0, (e.specialCd || 0) - dt);
    e._moving = false;
    // ノックバック適用
    if (Math.abs(e.knockX) + Math.abs(e.knockY) > 1) {
      const np = tryMove(this.dgn, e.x, e.y, e.r, e.knockX * dt, e.knockY * dt);
      e.x = np.x; e.y = np.y; e.knockX *= 0.86; e.knockY *= 0.86;
    }
    // DoT
    if (e.dotT > 0) { e.dotT -= dt; e._dotAcc = (e._dotAcc || 0) + dt; if (e._dotAcc >= 0.5) { e._dotAcc = 0; e.hp -= e.dotDmg; this.addFloat(e.x, e.y - e.r, '' + e.dotDmg, '#7fe07f', 12); if (e.hp <= 0) { this.killEnemy(e); return; } } }
    // 再生エリート
    if (e.elite && e.elite.regen) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * e.elite.regen * dt * 60);
    // スロー
    let spd = e.speed;
    if (e.slowT > 0) { e.slowT -= dt; spd *= e.slowMul; }
    // スタン中は行動不能
    if (e.stunT > 0) { e.stunT -= dt; return; }

    // ライバル冒険者
    if (def.behavior === 'rival') { this.updateRival(e, def, dt, spd); return; }

    // 予備動作中：溜め切ったら攻撃実行（この間は動かない＝回避のチャンス）
    if (e.windT > 0) {
      e.windT -= dt;
      e.facing = rotateToward(e.facing, angleOf(p.x - e.x, p.y - e.y), 2.5 * dt);
      if (e.windT <= 0) this.executeAttack(e, def);
      return;
    }

    const dd = dist(e.x, e.y, p.x, p.y);
    const aggro = dd < def.sight && this.hasLoS(e.x, e.y, p.x, p.y);
    if (aggro) e.state = 'chase';

    if (e.state === 'chase') {
      e.facing = angleOf(p.x - e.x, p.y - e.y);
      // ボスの特殊技（予兆付き）
      if (def.boss && e.specialCd <= 0 && e.windT <= 0) { this.startSpecial(e, def); return; }
      if (def.behavior === 'ranged') {
        if (dd > def.range * 0.8) this.moveEnemy(e, e.facing, spd, dt);
        else if (dd < def.range * 0.45) this.moveEnemy(e, e.facing + Math.PI, spd * 0.7, dt);
        if (dd < def.range && e.atkCd <= 0 && this.hasLoS(e.x, e.y, p.x, p.y)) this.startWindup(e, def, def.boss ? 0.45 : 0.55);
      } else {
        if (dd > def.range) this.moveEnemy(e, e.facing, spd, dt);
        else if (e.atkCd <= 0) this.startWindup(e, def, def.boss ? 0.4 : 0.5);
      }
      if (dd > def.sight * 1.4) e.state = 'idle';
    } else {
      // 徘徊
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = rand(0.8, 2.2); e.wanderAng = rand(0, TAU); e.moving = chance(0.6); }
      if (e.moving) { this.moveEnemy(e, e.wanderAng, spd * 0.4, dt); e.facing = e.wanderAng; }
    }
    // ネクロマンサー：スケルトン召喚
    if (def.summon && e.state === 'chase') {
      e.summonCd -= dt;
      const alive = this.enemies.reduce((n, x) => n + (x.dead ? 0 : 1), 0);
      if (e.summonCd <= 0 && alive < 28) {
        e.summonCd = 7;
        this.toast('ネクロマンサーが死霊を呼んだ！');
        for (let i = 0; i < 2; i++) {
          const minion = this.makeEnemy(chance(0.5) ? 'skeleton' : 'skel_archer', e.x + rand(-40, 40), e.y + rand(-40, 40));
          minion.state = 'chase';
          this.enemies.push(minion);
        }
        this.burst(e.x, e.y, '#9b4dff', 18);
        Audio2.play('magic');
      }
    }
  },

  moveEnemy(e, ang, spd, dt) {
    const np = tryMove(this.dgn, e.x, e.y, e.r, Math.cos(ang) * spd * dt, Math.sin(ang) * spd * dt);
    e.x = np.x; e.y = np.y;
    e._moving = true; e.walkPhase = (e.walkPhase || 0) + dt * 13;
  },

  startWindup(e, def, time) {
    e.windT = time; e.windMax = time;
  },

  // ライバル冒険者AI：敵と戦い、プレイヤーが近いと襲う
  updateRival(e, def, dt, spd) {
    const p = this.player;
    let target = null, isPlayer = false;
    const ddp = dist(e.x, e.y, p.x, p.y);
    if (!p.dead && ddp < def.sight && this.hasLoS(e.x, e.y, p.x, p.y)) { target = p; isPlayer = true; }
    else {
      let best = 440;
      for (const m of this.enemies) {
        if (m === e || m.dead || m.type === 'rival') continue;
        const d = dist(e.x, e.y, m.x, m.y);
        if (d < best) { best = d; target = m; }
      }
    }
    if (!target) {
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = rand(0.6, 1.6); e.wanderAng = rand(0, TAU); e.moving = chance(0.7); }
      if (e.moving) { this.moveEnemy(e, e.wanderAng, spd * 0.5, dt); e.facing = e.wanderAng; }
      return;
    }
    e.facing = angleOf(target.x - e.x, target.y - e.y);
    const wk = WEAPON_TYPES[e.weaponKind] || WEAPON_TYPES.sword;
    const rng = wk.kind === 'melee' ? 58 : 360;
    const d2 = dist(e.x, e.y, target.x, target.y);
    const tr = isPlayer ? CONFIG.PLAYER_R : (target.r || 14);
    if (d2 > rng) this.moveEnemy(e, e.facing, spd, dt);
    else if (wk.kind !== 'melee' && d2 < rng * 0.5) this.moveEnemy(e, e.facing + Math.PI, spd * 0.7, dt);
    if (e.atkCd <= 0 && d2 < rng + tr + 8) {
      e.atkCd = 0.9;
      if (wk.kind === 'melee') {
        if (isPlayer) { this.hurtPlayer(e.atk, false); this.burst(p.x, p.y, '#ff8a6a', 6); }
        else this.rivalHitMonster(target, e.atk);
        Audio2.play('swing');
      } else {
        if (isPlayer) this.spawnProjectile('enemy', e.x, e.y, e.facing, { speed: wk.projSpeed || 520, dmg: e.atk, r: 8, color: e.color, life: 2 });
        else this.rivalHitMonster(target, e.atk);
        Audio2.play(wk.kind === 'magic' ? 'magic' : 'shoot');
      }
    }
  },

  rivalHitMonster(m, dmg) {
    const d = Math.max(1, Math.round(mitigate(dmg, m.def)));
    m.hp -= d; m.hitFlash = 0.1;
    this.addFloat(m.x, m.y - m.r, '' + d, '#bfbfbf', 11);
    if (m.hp <= 0 && !m.dead) { m.dead = true; m.deathT = 0; this.burst(m.x, m.y, ENEMIES[m.type].color, 12); }
  },

  // 実績・依頼
  unlockAch(id) {
    const p = this.profile;
    if (!p.achievements) p.achievements = {};
    if (p.achievements[id]) return;
    p.achievements[id] = true;
    p.gold += 50;
    this.toast('実績解除：' + ACHIEVEMENTS[id].name + '（+50G）');
    Audio2.play('levelup');
    saveProfile(p);
  },
  progressBounty(type, amt, setMax) {
    const p = this.profile;
    if (!p.bounties) return;
    for (const b of p.bounties) {
      if (b.type !== type || b.done) continue;
      if (setMax) b.progress = Math.max(b.progress, amt); else b.progress += amt;
      if (b.progress >= b.target) { b.done = true; this.toast('依頼達成：' + b.label + '（拠点で報酬受取）'); }
    }
  },

  startSpecial(e, def) {
    const map = { ogre: 'sweep', necromancer: 'aoe', lich: 'fan' };
    e.special = map[e.type] || 'fan';
    e.windT = 0.85; e.windMax = 0.85;
    e.specialCd = rand(7, 10);
    this.toast(def.name + ' が技を繰り出す');
    Audio2.play('zone');
  },

  bossSpecial(e, def, kind) {
    const p = this.player;
    e.atkCd = 1.4;
    if (kind === 'sweep') {
      const range = def.range + 100;
      this.spawnSlash(e.x, e.y, e.facing, 2.6, range, '#ff7a3c');
      this.addShake(12); Audio2.play('crit');
      if (dist(e.x, e.y, p.x, p.y) <= range && Math.abs(angDiff(e.facing, angleOf(p.x - e.x, p.y - e.y))) < 1.4) {
        this.hurtPlayer(e.atk * 1.4, false);
      }
    } else if (kind === 'aoe') {
      this.aoes.push({ x: p.x, y: p.y, r: 100, t: 1.0, maxt: 1.0, dmg: e.atk * 1.3, color: '#9b4dff' });
      Audio2.play('magic');
    } else { // fan：業火
      for (let i = -2; i <= 2; i++) this.spawnProjectile('enemy', e.x, e.y, e.facing + i * 0.28, { speed: def.projSpeed, dmg: e.atk * 0.85, r: 10, color: '#ff7a3c', life: 2.6 });
      Audio2.play('magic');
    }
  },

  updateAoes(dt) {
    if (!this.aoes) return;
    const p = this.player;
    for (const a of this.aoes) {
      a.t -= dt;
      if (a.t <= 0 && !a.done) {
        a.done = true;
        this.spawnRing(a.x, a.y, a.r * 0.4, a.r, a.color, 0.35, 4);
        this.burst(a.x, a.y, a.color, 20, a.r);
        this.addShake(8);
        if (!p.dead && dist(a.x, a.y, p.x, p.y) <= a.r) this.hurtPlayer(a.dmg, true);
      }
    }
    this.aoes = this.aoes.filter(a => a.t > -0.1);
  },

  executeAttack(e, def) {
    const p = this.player;
    e.attackT = 0.2;
    if (e.special) { const sp = e.special; e.special = null; this.bossSpecial(e, def, sp); return; }
    const onHit = e.elite && e.elite.onHit;
    if (def.behavior === 'ranged') {
      e.atkCd = 1.6;
      e.facing = angleOf(p.x - e.x, p.y - e.y);
      this.spawnProjectile('enemy', e.x, e.y, e.facing, {
        speed: def.projSpeed, dmg: e.atk, r: 8, color: def.magic ? '#c77dff' : '#cfcfcf', life: 2.2,
        onHit,
      });
      Audio2.play('shoot');
    } else {
      e.atkCd = 1.0;
      const dd = dist(e.x, e.y, p.x, p.y);
      if (dd <= def.range + CONFIG.PLAYER_R + 8) {
        this.hurtPlayer(e.atk, false);
        this.burst(p.x, p.y, '#ff8a6a', 6);
        if (def.web) { p.slowT = 2; p.slowMul = 0.55; this.addFloat(p.x, p.y - 30, '鈍足', '#b0d0a0', 13); }
        if (onHit) this.applyOnHitToPlayer(onHit);
      }
    }
  },

  applyOnHitToPlayer(onHit) {
    const p = this.player;
    if (onHit.slow) { p.slowT = Math.max(p.slowT, onHit.slow.dur); p.slowMul = onHit.slow.mult; }
    if (onHit.dot) { p.dotT = onHit.dot.dur; p.dotDmg = onHit.dot.dmg; this.addFloat(p.x, p.y - 30, '炎', '#ff7a3c', 14); }
  },

  // 回避ローリング
  dodge() {
    const p = this.player;
    if (p.dead || p.dodgeCd > 0 || p.dodgeT > 0) return;
    let dir;
    if (len(Input.move.x, Input.move.y) > 0.2) dir = angleOf(Input.move.x, Input.move.y);
    else dir = p.facing;
    p.dodgeT = 0.2; p.dodgeDir = dir; p.dodgeCd = 1.1; p.invuln = 0.32;
    this.burst(p.x, p.y, '#cfe3ff', 8);
    Audio2.play('swing');
  },

  hasLoS(x1, y1, x2, y2) {
    const T = CONFIG.TILE;
    const d = dist(x1, y1, x2, y2);
    const steps = Math.ceil(d / (T * 0.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = lerp(x1, x2, t), y = lerp(y1, y2, t);
      if (isSolidAt(this.dgn, x, y)) return false;
    }
    return true;
  },

  // ---------- 扉/宝箱（時間をかけて開ける）/ 拾得 / ポータル ----------
  updateChannel(dt) {
    const p = this.player, T = CONFIG.TILE;
    let target = null, best = 1e9;
    // 宝箱
    for (const c of this.chests) {
      if (c.opened) continue;
      const dd = dist(p.x, p.y, c.x, c.y);
      if (dd < c.r + CONFIG.PLAYER_R + 14 && dd < best) { best = dd; target = { key: 'c' + (c._id || (c._id = uid())), x: c.x, y: c.y, time: 1.6, kind: 'chest', obj: c, label: '開封中' }; }
    }
    // 扉（隣接の閉扉）
    const ptx = Math.floor(p.x / T), pty = Math.floor(p.y / T);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const tx = ptx + dx, ty = pty + dy;
      if (this.dgn.get(tx, ty) === T_DOOR) {
        const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T, dd = dist(p.x, p.y, cx, cy);
        if (dd < T * 1.05 && dd < best) { best = dd; target = { key: 'd' + tx + ',' + ty, x: cx, y: cy, time: 0.9, kind: 'door', tx, ty, label: '開錠中' }; }
      }
    }
    this.channelTarget = target;
    // 対象から離れたらキャンセル
    if (!target) { this.channel = null; this.interactHeld = false; return; }
    // ボタンを一度タッチで開錠開始 → あとは自動で進む（離れるまで）
    if (!this.interactHeld) { this.channel = null; return; }
    if (!this.channel || this.channel.key !== target.key) this.channel = { key: target.key, prog: 0, time: target.time, kind: target.kind, label: target.label };
    this.channel.x = target.x; this.channel.y = target.y;
    this.channel.prog += dt / this.channel.time;
    if (this.channel.prog >= 1) {
      if (target.kind === 'chest') this.openChest(target.obj);
      else this.openDoor(target.tx, target.ty);
      this.channel = null; this.interactHeld = false;
    }
  },

  openDoor(tx, ty) {
    this.dgn.set(tx, ty, T_DOOROPEN);
    for (const r of this.dgn.rooms) {
      if (tx >= r.x - 1 && tx <= r.x + r.w && ty >= r.y - 1 && ty <= r.y + r.h) r.revealed = true;
    }
    Audio2.play('door');
    this.toast('扉を開けた');
  },

  openChest(c) {
    c.opened = true;
    this.toast('宝箱を開けた');
    Audio2.play('chest');
    this.burst(c.x, c.y, '#ffd27a', 18);
    for (let i = 0; i < c.loot; i++) {
      this.groundItems.push({ x: c.x + rand(-18, 18), y: c.y + rand(-18, 18), item: randomLoot(this.floor, this.derived.attr.LUCK) });
    }
    if (chance(0.5)) this.run.gold += randInt(8, 30);
  },

  updatePickups() {
    const p = this.player;
    // 地上アイテム
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const g = this.groundItems[i];
      if (dist(p.x, p.y, g.x, g.y) < CONFIG.PLAYER_R + 14) {
        // ポーションは空きスロットへ
        let placed = false;
        if (g.item.slot === 'potion') {
          for (let s = 0; s < p.potions.length; s++) if (!p.potions[s]) { p.potions[s] = g.item; placed = true; UI.buildSkillBar(this); break; }
        }
        if (!placed) this.run.loot.push(g.item);
        if (g.item.rarity === 'legendary') this.unlockAch('legendary');
        const col = RARITY[g.item.rarity] ? RARITY[g.item.rarity].color : '#fff';
        this.addFloat(g.x, g.y - 14, itemDisplayName(g.item), col, 13);
        if (RARITY_ORDER.indexOf(g.item.rarity) >= 3) { this.spawnRing(g.x, g.y, 4, 32, col, 0.5, 3); this.burst(g.x, g.y, col, 8); }
        Audio2.play(RARITY_ORDER.indexOf(g.item.rarity) >= 3 ? 'coin' : 'ui');
        this.groundItems.splice(i, 1);
      }
    }
  },

  updatePortal(dt) {
    const p = this.player;
    let active = null;
    for (const portal of this.dgn.portals) {
      portal.open = this.runTime >= portal.openAt;
      if (portal.open && dist(p.x, p.y, portal.x, portal.y) < portal.r + CONFIG.PLAYER_R) { active = portal; break; }
    }
    if (active) {
      this.extractT += dt;
      UI.showExtract(clamp(this.extractT / 2.2, 0, 1), active.bonus);
      if (this.extractT >= 2.2) this.extract(active);
    } else {
      if (this.extractT > 0) UI.showExtract(0);
      this.extractT = 0;
    }
  },

  // 祭壇/聖域/階段の相互作用判定（近接時）
  updateAltars() {
    const p = this.player;
    this.nearAltar = null; this.nearStairs = null;
    for (const a of this.altars) {
      if (a.used) continue;
      if (dist(p.x, p.y, a.x, a.y) < a.r + CONFIG.PLAYER_R + 8) { this.nearAltar = a; break; }
    }
    if (this.stairs && dist(p.x, p.y, this.stairs.x, this.stairs.y) < this.stairs.r + CONFIG.PLAYER_R + 8) this.nearStairs = this.stairs;
  },

  // インタラクトボタン：押下（階段=降りる／祭壇=作法／扉・宝箱=押している間で開ける）
  onInteractDown() {
    if (this.nearStairs) { this.descend(); return; }
    const a = this.nearAltar;
    if (!(a && !a.used)) { this.interactHeld = true; return; }
    const p = this.player;
    if (a.type === 'sacrifice') {
      const cost = Math.floor(p.hp * 0.25);
      if (p.hp - cost < 1) { this.toast('HPが足りない（生贄に捧げられない）'); return; }
      p.hp -= cost;
      a.used = true;
      this.addFloat(p.x, p.y - 30, '-' + cost + ' HP', '#ff6a5a', 16);
      this.burst(a.x, a.y, '#ff5b6e', 24);
      for (let i = 0; i < 3; i++) this.groundItems.push({ x: a.x + rand(-26, 26), y: a.y + rand(-26, 26), item: randomLoot(this.floor + 1, this.derived.attr.LUCK + 6) });
      this.toast('生贄の祭壇：戦利品が現れた！');
      Audio2.play('chest');
    } else {
      a.used = true;
      this.burst(a.x, a.y, '#9fd0ff', 24);
      // 聖域は業（カルマ）を浄化する
      if (this.run.karma > 0) { this.run.karma = Math.max(0, this.run.karma - 18); this.addFloat(a.x, a.y - 26, '業を浄化', '#aef', 14); }
      if (Math.random() < 0.65) {
        const boon = choice([
          { stat: 'patk', mult: 1.3, name: '攻撃力上昇' },
          { stat: 'defense', mult: 1.4, name: '防御力上昇' },
          { stat: 'speed', mult: 1.3, name: '移動速度上昇' },
          { stat: 'matk', mult: 1.3, name: '魔力上昇' },
        ]);
        p.buffs.push({ stat: boon.stat, mult: boon.mult, t: 600 });
        this.toast('聖域の恩恵：' + boon.name + '（この探索の間）');
        Audio2.play('levelup');
      } else {
        const curse = choice([
          { stat: 'patk', mult: 0.8, name: '攻撃力低下' },
          { stat: 'defense', mult: 0.75, name: '防御力低下' },
        ]);
        p.buffs.push({ stat: curse.stat, mult: curse.mult, t: 90 });
        this.toast('呪い…：' + curse.name + '（しばらく）');
        Audio2.play('zone');
      }
    }
  },
  onInteractUp() { /* ワンタップ開錠：離すではなく対象から離れた時にキャンセル */ },

  // ---------- トラップ ----------
  updateTraps(dt) {
    const p = this.player, T = CONFIG.TILE;
    for (const tr of this.traps) {
      if (tr.type === 'spike') {
        const prev = tr.armed;
        tr.phase = (tr.phase + dt) % tr.period;
        // 0.0〜0.4 を「発動中」、その前0.35を予兆とする
        tr.armed = tr.phase < 0.4;
        if (tr.armed && !prev) {
          Audio2.play('trap');
          // 同タイルに居る者へダメージ
          if (!p.dead && Math.floor(p.x / T) === tr.tx && Math.floor(p.y / T) === tr.ty) this.hurtPlayer(tr.dmg, false);
          for (const e of this.enemies) if (!e.dead && Math.floor(e.x / T) === tr.tx && Math.floor(e.y / T) === tr.ty) this.hitEnemy(e, tr.dmg, 0, { crit: 0 });
          this.burst(tr.x, tr.y, '#cfcfcf', 8);
        }
      } else if (tr.type === 'dart') {
        tr.cd -= dt;
        if (tr.cd <= 0) {
          tr.cd = 2.6;
          // 発射方向にプレイヤーが概ね居る or 常時掃射
          this.spawnProjectile('enemy', tr.x, tr.y, tr.dir, { speed: 460, dmg: tr.dmg, r: 6, color: '#d8c08a', life: 1.6 });
          Audio2.play('shoot');
        }
      }
    }
  },

  // ---------- ゾーン収縮（闇の侵食） ----------
  initZone() {
    const dgn = this.dgn;
    const diag = Math.hypot(dgn.pxW, dgn.pxH);
    this.zone = {
      cx: dgn.portal.x, cy: dgn.portal.y,
      r: diag, r0: diag, minR: 260,
      grace: 62, shrinkDur: 84, dmg: 8 + this.floor * 4,
      warned: false,
    };
  },
  updateZone(dt) {
    const z = this.zone, p = this.player;
    const t = this.runTime;
    if (t < z.grace) { z.r = z.r0; }
    else {
      const k = clamp((t - z.grace) / z.shrinkDur, 0, 1);
      z.r = lerp(z.r0, z.minR, k);
      if (!z.warned) { z.warned = true; Audio2.play('zone'); this.toast('闇が侵食を始めた — 脱出を急げ'); }
    }
    // 圏外ダメージ
    if (!p.dead && dist(p.x, p.y, z.cx, z.cy) > z.r) {
      p.zoneTick = (p.zoneTick || 0) + dt;
      if (p.zoneTick >= 0.5) {
        p.zoneTick = 0;
        this.hurtPlayer(z.dmg, true);
        this.addFloat(p.x, p.y - 30, '闇', '#b06bff', 14);
      }
    } else p.zoneTick = 0;
  },

  // ---------- ポーション ----------
  usePotion(slot) {
    const p = this.player;
    if (p.potionCd > 0) return;
    const it = p.potions[slot];
    if (!it || !it.potion) return;
    if (it.potion.hp) { p.hp = Math.min(p.derived.hpmax, p.hp + it.potion.hp); this.addFloat(p.x, p.y - 22, '+' + it.potion.hp, '#7dffa0', 17); }
    if (it.potion.mp) { p.mp = Math.min(p.derived.mpmax, p.mp + it.potion.mp); this.addFloat(p.x, p.y - 22, '+' + it.potion.mp + ' MP', '#7db8ff', 17); }
    Audio2.play('potion');
    this.burst(p.x, p.y, it.potion.mp ? '#7db8ff' : '#7dffa0', 10);
    p.potions[slot] = null;
    p.potionCd = 0.6;
    UI.buildSkillBar(this);
  },

  selectSkill(i) {
    if (i >= 0 && i >= this.player.skills.length) return;
    this.selectedSkill = (this.selectedSkill === i) ? -1 : i;
    UI.buildSkillBar(this);
  },

  // ---------- 死亡 / 脱出 ----------
  die() {
    this.player.dead = true;
    this.state = 'result';
    Input.enabled = false;
    // ロスト：持ち込み装備＋ポーション＋取得品
    const lost = [];
    for (const slot in this.profile.equipment) { if (this.profile.equipment[slot]) { lost.push(this.profile.equipment[slot]); this.profile.equipment[slot] = null; } }
    for (let i = 0; i < this.profile.potions.length; i++) { if (this.profile.potions[i]) { lost.push(this.profile.potions[i]); this.profile.potions[i] = null; } }
    this.profile.runStats.deaths++;
    this.profile.runStats.runs++;
    this.profile.runStats.kills += this.run.kills;
    // 死亡時もEXPは半分だけ
    const xp = Math.round(this.run.kills * 6 + this.floor * 10);
    grantXP(this.profile, xp);
    saveProfile(this.profile);
    Audio2.stopAmbient();
    Audio2.play('death');
    UI.showResult(false, { kills: this.run.kills, gold: 0, xp, lost, loot: this.run.loot });
  },

  extract(portal) {
    this.state = 'result';
    Input.enabled = false;
    // 報酬ポータルはボーナス（ゴールド＋戦利品）
    if (portal && portal.bonus) {
      this.run.gold = Math.round(this.run.gold * 1.6 + 40);
      const extra = randomLoot(this.floor + 1, this.derived.attr.LUCK + 8);
      this.run.loot.push(extra);
      this.toast('報酬ポータルで脱出！ボーナス獲得');
    }
    // 取得品をストレージへ、ゴールド加算
    for (const it of this.run.loot) this.profile.stash.push(it);
    this.profile.gold += this.run.gold;
    // 道中で使用/取得したポーションの状態を反映
    this.profile.potions = this.player.potions.map(x => x || null);
    const xp = Math.round(this.run.kills * 10 + this.floor * 25 + this.run.loot.length * 5);
    const leveled = grantXP(this.profile, xp);
    // 実績・依頼
    this.unlockAch('first_extract');
    if (this.floor >= 3) this.unlockAch('deep');
    if (this.profile.gold >= 1000) this.unlockAch('rich');
    if (this.profile.level >= 10) this.unlockAch('lvl10');
    if (this.run.loot.some(it => it.rarity === 'legendary')) this.unlockAch('legendary');
    this.progressBounty('extract', 1);
    this.progressBounty('floor', this.floor, true);
    if (this.run.loot.some(it => RARITY_ORDER.indexOf(it.rarity) >= 3)) this.progressBounty('rarity', 1);
    this.profile.runStats.extracts++;
    this.profile.runStats.runs++;
    this.profile.runStats.kills += this.run.kills;
    this.profile.runStats.gold += this.run.gold;
    saveProfile(this.profile);
    this.burst(this.player.x, this.player.y, '#7fd0ff', 30);
    Audio2.stopAmbient();
    Audio2.play('extract');
    if (leveled) setTimeout(() => Audio2.play('levelup'), 500);
    UI.showResult(true, { kills: this.run.kills, gold: this.run.gold, xp, leveled, loot: this.run.loot });
  },

  abandon() {
    // 退却＝死亡扱い（持ち込みロスト）
    this.die();
  },

  // ---------- FX ----------
  // 斬撃の弧
  spawnSlash(x, y, ang, arc, range, color) {
    (this.fx = this.fx || []).push({ type: 'slash', x, y, ang, arc, range, color, life: 0.2, maxlife: 0.2 });
  },
  // 拡がるリング（着弾・爆発・衝撃）
  spawnRing(x, y, r0, r1, color, life = 0.3, width = 3) {
    (this.fx = this.fx || []).push({ type: 'ring', x, y, r0, r1, color, life, maxlife: life, width });
  },

  burst(x, y, color, n, spread = 30) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 40 + spread * 3);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(2, 5), color, life: rand(0.2, 0.5), maxlife: 0.5 });
    }
  },
  muzzle(x, y, ang, color) {
    for (let i = 0; i < 4; i++) {
      const a = ang + rand(-0.3, 0.3), s = rand(60, 160);
      this.particles.push({ x: x + Math.cos(ang) * 16, y: y + Math.sin(ang) * 16, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(2, 4), color, life: 0.2, maxlife: 0.2 });
    }
  },
  addFloat(x, y, text, color, size) {
    this.floatTexts.push({ x, y, text, color, size, vy: -40, life: 0.9, maxlife: 0.9 });
  },
  toast(msg) { this.msg = msg; this.msgT = 2.2; UI.toast(msg); },
};

// ---------- 衝突ヘルパー ----------
function solidCircle(dgn, x, y, r) {
  return isSolidAt(dgn, x - r, y) || isSolidAt(dgn, x + r, y) ||
    isSolidAt(dgn, x, y - r) || isSolidAt(dgn, x, y + r) ||
    isSolidAt(dgn, x - r * 0.7, y - r * 0.7) || isSolidAt(dgn, x + r * 0.7, y + r * 0.7) ||
    isSolidAt(dgn, x - r * 0.7, y + r * 0.7) || isSolidAt(dgn, x + r * 0.7, y - r * 0.7);
}
function tryMove(dgn, x, y, r, dx, dy) {
  let nx = x + dx;
  if (!solidCircle(dgn, nx, y, r)) x = nx;
  let ny = y + dy;
  if (!solidCircle(dgn, x, ny, r)) y = ny;
  return { x, y };
}
function mitigate(amount, defense) { return amount * (1 - defense / (defense + CONFIG.DEFENSE_K)); }

window.Game = Game;
window.addEventListener('load', () => Game.boot());
