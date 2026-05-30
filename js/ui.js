// ============================================================
// ui.js — DOM UI（タウン / 育成 / 装備 / 倉庫 / ショップ / HUD / リザルト）
// ============================================================
const STAT_NAMES = {
  patk: '物理攻撃', matk: '魔法攻撃', defense: '防御', crit: '会心率', lifesteal: '吸血',
  hpmax: '最大HP', mpmax: '最大MP', STR: '筋力', VIG: '体力', AGI: '敏捷',
  DEX: '器用', WILL: '意志', WIS: '精神', LUCK: '幸運',
};
const SLOT_NAMES = { weapon: '武器', head: '頭', chest: '胴', hands: '手', legs: '脚', ring: '装飾', torch: 'トーチ' };

function statLine(stats) {
  const parts = [];
  for (const k in stats) {
    let v = stats[k];
    const nm = STAT_NAMES[k] || k;
    if (k === 'crit' || k === 'lifesteal') parts.push(`${nm} +${Math.round(v * 100)}%`);
    else parts.push(`${nm} ${v >= 0 ? '+' : ''}${v}`);
  }
  return parts.join(' / ');
}

// 装備差分（同スロットの現装備との比較）
function compareLine(it, equipped) {
  if (!equipped) return '<span class="cmp new">新規装備</span>';
  const keys = new Set([...Object.keys(it.stats), ...Object.keys(equipped.stats)]);
  const parts = [];
  for (const k of keys) {
    const a = it.stats[k] || 0, b = equipped.stats[k] || 0;
    const d = a - b;
    if (Math.abs(d) < 0.0001) continue;
    const pct = (k === 'crit' || k === 'lifesteal');
    const val = pct ? `${d > 0 ? '+' : ''}${Math.round(d * 100)}%` : `${d > 0 ? '+' : ''}${d}`;
    parts.push(`<span class="cmp ${d > 0 ? 'up' : 'down'}">${STAT_NAMES[k] || k} ${val}</span>`);
  }
  return parts.length ? parts.join(' ') : '<span class="cmp">変化なし</span>';
}

const UI = {
  root: null, hud: null, shopStock: null,

  init() {
    this.root = document.getElementById('overlay');
    this.hud = document.getElementById('hud');
  },

  hideAll() { this.root.innerHTML = ''; this.root.style.display = 'none'; this.hud.style.display = 'none'; },
  panel(html) { this.root.style.display = 'flex'; this.root.innerHTML = html; },

  rarityTag(it) {
    const r = RARITY[it.rarity];
    return `<span class="rar" style="color:${r.color}">${itemDisplayName(it)}</span>`;
  },

  // -------- 職業選択 --------
  showClassSelect() {
    this.hud.style.display = 'none';
    let cards = '';
    for (const id in CLASSES) {
      const c = CLASSES[id];
      const wt = WEAPON_TYPES[c.weapon];
      cards += `<div class="class-card" data-cls="${id}" style="--ac:${c.color}">
        <div class="cc-name">${c.name}</div>
        <div class="cc-weap">標準武器：${wt.name}</div>
        <div class="cc-blurb">${c.blurb}</div>
        <div class="cc-stats">${ATTRS.map(a => `<span>${a.name} ${c.base[a.key]}</span>`).join('')}</div>
        <div class="cc-skills">${c.skills.map(s => `${SKILLS[s].icon} ${SKILLS[s].name}`).join(' ・ ')}</div>
        <button class="btn pick">この職業で始める</button>
      </div>`;
    }
    this.panel(`<div class="screen">
      <h1 class="title">DUNGEON <span>&</span> DARKER</h1>
      <p class="subtitle">職業を選んでダンジョンへ挑め。生きて帰れば戦利品はキミのもの。死ねば全てを失う。</p>
      <div class="class-grid">${cards}</div>
    </div>`);
    this.root.querySelectorAll('.class-card').forEach(card => {
      card.querySelector('.pick').addEventListener('click', () => Game.createCharacter(card.dataset.cls));
    });
  },

  // -------- タウン（拠点） --------
  showTown(tab = 'status') {
    this.hud.style.display = 'none';
    const p = Game.profile, d = computeDerived(p);
    Game.derived = d;
    const cls = CLASSES[p.classId];
    const nav = ['status', 'skill', 'equip', 'forge', 'stash', 'shop', 'bounty', 'deploy'];
    const navName = { status: 'ステータス', skill: 'スキル', equip: '装備', forge: '鍛冶', stash: '倉庫', shop: 'ショップ', bounty: '依頼', deploy: '出撃' };
    let body = '';
    if (tab === 'status') body = this.tabStatus(p, d, cls);
    else if (tab === 'skill') body = this.tabSkill(p, d);
    else if (tab === 'equip') body = this.tabEquip(p, d);
    else if (tab === 'forge') body = this.tabForge(p, d);
    else if (tab === 'stash') body = this.tabStash(p, d);
    else if (tab === 'shop') body = this.tabShop(p, d);
    else if (tab === 'bounty') body = this.tabBounty(p, d);
    else if (tab === 'deploy') body = this.tabDeploy(p, d);

    this.panel(`<div class="town">
      <div class="town-top">
        <div class="town-title">拠点 — <b style="color:${cls.color}">${cls.name}</b> <span class="lvl">Lv.${p.level}</span></div>
        <div class="town-gold">${fmt(p.gold)} G</div>
      </div>
      <div class="town-nav">${nav.map(n => `<button class="tnav ${n === tab ? 'on' : ''}" data-t="${n}">${navName[n]}</button>`).join('')}</div>
      <div class="town-body">${body}</div>
    </div>`);
    this.root.querySelectorAll('.tnav').forEach(b => b.addEventListener('click', () => this.showTown(b.dataset.t)));
    this.bindTab(tab);
  },

  tabStatus(p, d, cls) {
    const xpNeed = xpForLevel(p.level);
    const attrRows = ATTRS.map(a => `<div class="attr-row">
        <div class="attr-info"><b>${a.name}</b><span class="ak">${a.key}</span><span class="ad">${a.desc}</span></div>
        <div class="attr-val">${p.baseAttrs[a.key]}</div>
        <button class="btn sm plus" data-a="${a.key}" ${p.points <= 0 ? 'disabled' : ''}>＋</button>
      </div>`).join('');
    const derivedRows = [
      ['最大HP', Math.round(d.hpmax)], ['最大MP', Math.round(d.mpmax)],
      ['物理攻撃力', d.wtype.base + d.patkFlat], ['魔法攻撃力', d.wtype.base + d.matkFlat],
      ['防御', d.defense], ['移動速度', Math.round(d.speed) + (d.encumbered ? ' 重量超過' : '')],
      ['重量', `${d.weight.toFixed(1)} / ${Math.round(d.weightCap)}`],
      ['会心率', Math.round(d.crit * 100) + '%'], ['会心ダメージ', Math.round(d.critDmg * 100) + '%'],
      ['回避', Math.round(d.dodge * 100) + '%'], ['吸血', Math.round(d.lifesteal * 100) + '%'],
      ['視界', d.hasTorch ? '広い(トーチ)' : '狭い'],
    ].map(r => `<div class="drow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    return `<div class="cols">
      <div class="col">
        <div class="card">
          <div class="lvbox">Lv.${p.level} <div class="xpbar"><div style="width:${Math.min(100, p.xp / xpNeed * 100)}%"></div></div><span>${p.xp}/${xpNeed} EXP</span></div>
          <div class="points">未割り振りポイント：<b class="${p.points > 0 ? 'hot' : ''}">${p.points}</b></div>
          ${attrRows}
        </div>
      </div>
      <div class="col">
        <div class="card"><h3>派生ステータス</h3>${derivedRows}</div>
        <div class="card"><h3>戦績</h3>
          <div class="drow"><span>潜入回数</span><b>${p.runStats.runs}</b></div>
          <div class="drow"><span>脱出成功</span><b>${p.runStats.extracts}</b></div>
          <div class="drow"><span>死亡</span><b>${p.runStats.deaths}</b></div>
          <div class="drow"><span>撃破数</span><b>${p.runStats.kills}</b></div>
        </div>
        <div class="card"><h3>実績（${Object.keys(p.achievements || {}).length}/${Object.keys(ACHIEVEMENTS).length}）</h3>
          ${Object.keys(ACHIEVEMENTS).map(id => { const a = ACHIEVEMENTS[id]; const got = p.achievements && p.achievements[id]; return `<div class="ach ${got ? 'got' : ''}"><b>${got ? '◆' : '◇'} ${a.name}</b><span>${a.desc}</span></div>`; }).join('')}
        </div>
      </div>
    </div>`;
  },

  tabBounty(p, d) {
    if (!p.bounties) p.bounties = [];
    const rows = p.bounties.map(b => {
      const pct = clamp(b.progress / b.target * 100, 0, 100);
      return `<div class="card" style="margin-bottom:8px">
        <div class="brow"><b>${b.label}</b><span class="val">報酬 ${fmt(b.reward)}G</span></div>
        <div class="xpbar" style="margin:8px 0"><div style="width:${pct}%"></div></div>
        <div class="brow"><span class="muted">${Math.min(b.progress, b.target)} / ${b.target}</span>
          ${b.done && !b.claimed ? `<button class="btn sm claim" data-id="${b.id}">報酬を受け取る</button>` : b.claimed ? '<span class="muted">受取済</span>' : '<span class="muted">進行中…</span>'}</div>
      </div>`;
    }).join('');
    return `<div class="card"><h3>依頼ボード</h3><p class="muted">ダンジョンでの成果は自動で記録されます。達成した依頼の報酬を受け取ると、新しい依頼に切り替わります。</p></div>${rows}`;
  },

  tabSkill(p, d) {
    if (!p.loadout) p.loadout = [...CLASSES[p.classId].skills];
    const pool = CLASS_SKILL_POOL[p.classId] || CLASSES[p.classId].skills;
    const cards = pool.map(sid => {
      const s = SKILLS[sid]; const on = p.loadout.includes(sid);
      return `<div class="skill-card ${on ? 'on' : ''}">
        <div class="sc-top"><span class="sc-ic">${s.icon}</span><b>${s.name}</b></div>
        <div class="sc-meta">${s.mp} MP ・ CD ${s.cd}s ・ ${s.scaling ? STAT_NAMES[s.scaling] + '依存' : '補助'}</div>
        <div class="sc-desc">${s.desc}</div>
        <button class="btn sm skilltoggle ${on ? '' : ''}" data-sid="${sid}" ${!on && p.loadout.length >= 2 ? 'disabled' : ''}>${on ? '装備中（外す）' : '装備する'}</button>
      </div>`;
    }).join('');
    return `<div class="card"><h3>スキル選択 — 2つまで装備（現在 ${p.loadout.length}/2）</h3>
      <p class="muted">ここで選んだ2つがダンジョンで使えます。スキル未選択時の右スティックは標準武器の通常攻撃です。</p>
      <div class="skill-grid">${cards}</div></div>`;
  },

  tabForge(p, d) {
    const items = [];
    for (const slot in p.equipment) if (p.equipment[slot]) items.push({ it: p.equipment[slot], where: '装備中' });
    for (const it of p.stash) if (canUpgrade(it) || canEnchant(it)) items.push({ it, where: '倉庫' });
    if (!items.length) return `<div class="card"><div class="muted">強化できる装備がありません。武器・防具を入手しましょう。</div></div>`;
    const rows = items.map(({ it, where }) => {
      const upOk = canUpgrade(it), enOk = canEnchant(it);
      return `<div class="inv-row">
        <div>${this.rarityTag(it)} <span class="slot-tag">${where}</span><div class="eq-stat">${statLine(it.stats)}</div></div>
        <div class="inv-act">
          ${upOk ? `<button class="btn sm upg ${p.gold >= upgradeCost(it) ? '' : 'poor'}" data-uid="${it.uid}">強化+${(it.upgrade || 0) + 1}（${fmt(upgradeCost(it))}G）</button>` : `<span class="muted">強化MAX</span>`}
          ${enOk ? `<button class="btn sm ench ${p.gold >= enchantCost(it) ? '' : 'poor'}" data-uid="${it.uid}">エンチャント（${fmt(enchantCost(it))}G）</button>` : ''}
        </div></div>`;
    }).join('');
    return `<div class="card"><h3>鍛冶屋 — 強化／エンチャント</h3>
      <p class="muted">強化（最大+5）で全ステータス上昇。エンチャント（最大2回）でランダムなステータスを付与。装備中の品もそのまま強化できます。</p>${rows}</div>`;
  },

  tabEquip(p, d) {
    const slots = ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'];
    const slotHtml = slots.map(s => {
      const it = p.equipment[s];
      return `<div class="eq-slot" data-slot="${s}">
        <div class="eq-name">${SLOT_NAMES[s]}</div>
        ${it ? `<div class="eq-item">${this.rarityTag(it)}<div class="eq-stat">${statLine(it.stats)}</div><button class="btn sm unequip" data-slot="${s}">外す</button></div>`
          : `<div class="eq-empty">— なし —</div>`}
      </div>`;
    }).join('');
    const potHtml = p.potions.map((it, i) => `<div class="eq-slot">
      <div class="eq-name">ポーション枠${i + 1}</div>
      ${it ? `<div class="eq-item">${this.rarityTag(it)}<button class="btn sm potoff" data-i="${i}">外す</button></div>` : `<div class="eq-empty">— なし —</div>`}
    </div>`).join('');
    // 装備可能な倉庫アイテム
    const equippable = p.stash.filter(it => ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot));
    const list = equippable.length ? equippable.map(it => `<div class="inv-row">
        <div>${this.rarityTag(it)} <span class="slot-tag">${SLOT_NAMES[it.slot]}</span>
          <div class="eq-stat">${statLine(it.stats)}</div>
          <div class="cmp-line">${compareLine(it, p.equipment[it.slot])}</div></div>
        <button class="btn sm equip" data-uid="${it.uid}">装備</button>
      </div>`).join('') : '<div class="muted">倉庫に装備品はありません</div>';
    return `<div class="cols">
      <div class="col"><div class="card"><h3>装備中（ダンジョンへ持ち込む＝死亡でロスト）</h3>${slotHtml}${potHtml}</div></div>
      <div class="col"><div class="card"><h3>倉庫の装備品</h3>${list}</div></div>
    </div>`;
  },

  tabStash(p, d) {
    if (!p.stash.length) return `<div class="card"><div class="muted">倉庫は空です。ダンジョンで戦利品を集めましょう。</div></div>`;
    const rows = p.stash.slice().sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).map(it => `<div class="inv-row">
      <div>${this.rarityTag(it)} <span class="slot-tag">${SLOT_NAMES[it.slot] || (it.slot === 'potion' ? 'ポーション' : '財宝')}</span>
        <div class="eq-stat">${it.potion ? (it.potion.hp ? 'HP+' + it.potion.hp : '') + (it.potion.mp ? ' MP+' + it.potion.mp : '') : statLine(it.stats)}</div></div>
      <div class="inv-act">
        <span class="val">${fmt(Math.round(it.value * 0.6))}G</span>
        ${['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot) ? `<button class="btn sm equip" data-uid="${it.uid}">装備</button>` : ''}
        ${it.slot === 'potion' ? `<button class="btn sm topotion" data-uid="${it.uid}">枠へ</button>` : ''}
        <button class="btn sm danger sell" data-uid="${it.uid}">売却</button>
      </div></div>`).join('');
    return `<div class="card"><h3>倉庫（安全に保管）</h3>${rows}</div>`;
  },

  tabShop(p, d) {
    if (!this.shopStock) this.refreshShop();
    const buy = this.shopStock.map(it => `<div class="inv-row">
      <div>${this.rarityTag(it)} <span class="slot-tag">${SLOT_NAMES[it.slot] || (it.slot === 'potion' ? 'ポーション' : '財宝')}</span>
        <div class="eq-stat">${it.potion ? (it.potion.hp ? 'HP+' + it.potion.hp : '') + (it.potion.mp ? ' MP+' + it.potion.mp : '') : statLine(it.stats)}</div></div>
      <button class="btn sm buy" data-uid="${it.uid}">${fmt(this.buyPrice(it))}G 購入</button>
    </div>`).join('');
    const sellList = p.stash.length ? p.stash.map(it => `<div class="inv-row">
      <div>${this.rarityTag(it)}</div>
      <button class="btn sm danger sell" data-uid="${it.uid}">${fmt(Math.round(it.value * 0.6))}G 売却</button>
    </div>`).join('') : '<div class="muted">売る物がありません</div>';
    return `<div class="cols">
      <div class="col"><div class="card"><h3>購入 <button class="btn sm refresh" style="float:right">入荷</button></h3>${buy}</div></div>
      <div class="col"><div class="card"><h3>売却（倉庫から）</h3>${sellList}</div></div>
    </div>`;
  },

  tabDeploy(p, d) {
    const eq = Object.values(p.equipment).filter(Boolean).map(it => this.rarityTag(it)).join('、') || 'なし';
    const pot = p.potions.filter(Boolean).map(it => it.name).join('、') || 'なし';
    const lo = (p.loadout || CLASSES[p.classId].skills).map(sid => `${SKILLS[sid].icon} ${SKILLS[sid].name}`).join('、') || 'なし';
    return `<div class="cols">
      <div class="col"><div class="card">
        <h3>出撃準備</h3>
        <p class="muted">装備スキル：${lo}</p>
        <p class="muted">持ち込む装備：${eq}</p>
        <p class="muted">ポーション：${pot}</p>
        <p class="warn">死亡すると持ち込んだ装備・ポーション・取得品は全て失われます。脱出ポータルから帰還して初めて戦利品が確定します。</p>
      </div></div>
      <div class="col"><div class="card">
        <h3>潜入する階層を選択</h3>
        <button class="btn big depth" data-f="1">第1層 — 浅層（易）</button>
        <button class="btn big depth" data-f="2">第2層 — 中層（中・ボス出現）</button>
        <button class="btn big depth" data-f="3">第3層 — 深層（難・強ボス）</button>
        <p class="muted" style="margin-top:10px">深いほど敵が強く、レア戦利品とゴールドが増えます。</p>
      </div></div>
    </div>`;
  },

  bindTab(tab) {
    const p = Game.profile;
    const reload = () => { saveProfile(p); this.showTown(tab); };
    // ステータス＋
    this.root.querySelectorAll('.plus').forEach(b => b.addEventListener('click', () => {
      if (p.points > 0) { p.baseAttrs[b.dataset.a]++; p.points--; reload(); }
    }));
    // 装備
    this.root.querySelectorAll('.equip').forEach(b => b.addEventListener('click', () => { this.equipItem(+b.dataset.uid); reload(); }));
    this.root.querySelectorAll('.unequip').forEach(b => b.addEventListener('click', () => {
      const s = b.dataset.slot; if (p.equipment[s]) { p.stash.push(p.equipment[s]); p.equipment[s] = null; } reload();
    }));
    this.root.querySelectorAll('.potoff').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i; if (p.potions[i]) { p.stash.push(p.potions[i]); p.potions[i] = null; } reload();
    }));
    this.root.querySelectorAll('.topotion').forEach(b => b.addEventListener('click', () => {
      const it = p.stash.find(x => x.uid === +b.dataset.uid);
      const slot = p.potions.findIndex(x => !x);
      if (it && slot >= 0) { p.potions[slot] = it; p.stash = p.stash.filter(x => x.uid !== it.uid); }
      reload();
    }));
    // 売却
    this.root.querySelectorAll('.sell').forEach(b => b.addEventListener('click', () => {
      const it = p.stash.find(x => x.uid === +b.dataset.uid);
      if (it) { p.gold += Math.round(it.value * 0.6); p.stash = p.stash.filter(x => x.uid !== it.uid); }
      reload();
    }));
    // 購入
    this.root.querySelectorAll('.buy').forEach(b => b.addEventListener('click', () => {
      const it = this.shopStock.find(x => x.uid === +b.dataset.uid);
      if (it && p.gold >= this.buyPrice(it)) { p.gold -= this.buyPrice(it); p.stash.push(it); this.shopStock = this.shopStock.filter(x => x.uid !== it.uid); reload(); }
      else this.toast('ゴールドが足りない');
    }));
    this.root.querySelectorAll('.refresh').forEach(b => b.addEventListener('click', () => { this.refreshShop(); reload(); }));
    // スキル選択
    this.root.querySelectorAll('.skilltoggle').forEach(b => b.addEventListener('click', () => {
      const sid = b.dataset.sid;
      if (!p.loadout) p.loadout = [...CLASSES[p.classId].skills];
      if (p.loadout.includes(sid)) p.loadout = p.loadout.filter(x => x !== sid);
      else if (p.loadout.length < 2) p.loadout.push(sid);
      Audio2.play && Audio2.play('select');
      reload();
    }));
    // 鍛冶：強化／エンチャント
    const findItem = (uid) => {
      for (const slot in p.equipment) if (p.equipment[slot] && p.equipment[slot].uid === uid) return p.equipment[slot];
      return p.stash.find(x => x.uid === uid);
    };
    this.root.querySelectorAll('.upg').forEach(b => b.addEventListener('click', () => {
      const it = findItem(+b.dataset.uid); if (!it) return;
      const cost = upgradeCost(it);
      if (p.gold < cost) { this.toast('ゴールドが足りない'); return; }
      if (upgradeItem(it)) { p.gold -= cost; Audio2.play && Audio2.play('chest'); reload(); }
    }));
    this.root.querySelectorAll('.ench').forEach(b => b.addEventListener('click', () => {
      const it = findItem(+b.dataset.uid); if (!it) return;
      const cost = enchantCost(it);
      if (p.gold < cost) { this.toast('ゴールドが足りない'); return; }
      if (enchantItem(it)) { p.gold -= cost; Audio2.play && Audio2.play('levelup'); reload(); }
    }));
    // 依頼の報酬受取（達成済→受取で新しい依頼に差し替え）
    this.root.querySelectorAll('.claim').forEach(b => b.addEventListener('click', () => {
      const id = +b.dataset.id;
      const idx = p.bounties.findIndex(x => x.id === id);
      if (idx < 0) return;
      const bt = p.bounties[idx];
      if (bt.done && !bt.claimed) {
        p.gold += bt.reward;
        p.bounties[idx] = generateBounties()[0];
        Audio2.play && Audio2.play('coin');
        this.toast('報酬 ' + fmt(bt.reward) + 'G を受け取った');
        reload();
      }
    }));
    // 出撃
    this.root.querySelectorAll('.depth').forEach(b => b.addEventListener('click', () => { this.hideAll(); Game.enterDungeon(+b.dataset.f); }));
  },

  equipItem(uid) {
    const p = Game.profile;
    const it = p.stash.find(x => x.uid === uid);
    if (!it) return;
    const slot = it.slot;
    if (p.equipment[slot]) p.stash.push(p.equipment[slot]);
    p.equipment[slot] = it;
    p.stash = p.stash.filter(x => x.uid !== uid);
  },

  buyPrice(it) { return Math.round(it.value * 2.2); },
  refreshShop() {
    this.shopStock = [];
    // 基本装備の常設
    ['w_sword', 'w_bow', 'w_staff', 'a_helm', 'a_plate', 'a_robe', 't_torch', 'p_hp', 'p_mp'].forEach(id => this.shopStock.push(createItem(id, 'common')));
    // ランダム入荷
    for (let i = 0; i < 4; i++) this.shopStock.push(randomLoot(2, 10));
  },

  // -------- HUD（ダンジョン） --------
  showHUD() { this.root.style.display = 'none'; this.root.innerHTML = ''; this.hud.style.display = 'block'; },

  buildSkillBar(game) {
    const p = game.player;
    let html = `<div class="skillrow">`;
    // ノーマル
    html += `<button class="skbtn ${game.selectedSkill === -1 ? 'sel' : ''}" data-sk="-1">
      <div class="skic">${game.derived.wtype.kind === 'magic' ? '杖' : game.derived.wtype.kind === 'ranged' ? '弓' : '剣'}</div>
      <div class="sklbl">通常</div></button>`;
    p.skills.forEach((sid, i) => {
      const s = SKILLS[sid];
      const cd = p.skillCd[i];
      const noMp = p.mp < s.mp;
      html += `<button class="skbtn ${game.selectedSkill === i ? 'sel' : ''} ${cd > 0 || noMp ? 'dis' : ''}" data-sk="${i}">
        <div class="skic">${s.icon}</div>
        <div class="sklbl">${s.name}</div>
        <div class="skmp">${s.mp}MP</div>
        ${cd > 0 ? `<div class="skcd">${cd.toFixed(1)}</div>` : ''}
      </button>`;
    });
    html += `</div><div class="potrow">`;
    p.potions.forEach((it, i) => {
      html += `<button class="potbtn ${it ? '' : 'empty'}" data-pot="${i}">
        ${it ? `<div class="potic">${it.potion && it.potion.mp ? 'MP' : 'HP'}</div><div class="potlbl">${it.name.replace('ポーション', '')}</div>` : '<div class="potic">＋</div>'}
      </button>`;
    });
    html += `</div>`;
    document.getElementById('skillbar').innerHTML = html;
    document.querySelectorAll('#skillbar .skbtn').forEach(b => b.addEventListener('click', () => Game.selectSkill(+b.dataset.sk)));
    document.querySelectorAll('#skillbar .potbtn').forEach(b => b.addEventListener('click', () => Game.usePotion(+b.dataset.pot)));
  },

  updateHUD(game) {
    const p = game.player, d = game.derived;
    const hb = document.getElementById('hpfill'), mb = document.getElementById('mpfill');
    if (hb) hb.style.width = clamp(p.hp / d.hpmax * 100, 0, 100) + '%';
    if (mb) mb.style.width = clamp(p.mp / d.mpmax * 100, 0, 100) + '%';
    const ht = document.getElementById('hptext'), mt = document.getElementById('mptext');
    if (ht) ht.textContent = `${Math.max(0, Math.round(p.hp))}/${Math.round(d.hpmax)}`;
    if (mt) mt.textContent = `${Math.round(p.mp)}/${Math.round(d.mpmax)}`;
    const info = document.getElementById('runinfo');
    if (info) info.textContent = `第${game.floor}層　撃破 ${game.run.kills}　戦利品 ${game.run.loot.length}　金 ${game.run.gold}`;
    const db = document.getElementById('dodgebtn');
    if (db) db.classList.toggle('cool', p.dodgeCd > 0);
    const ib = document.getElementById('interactbtn');
    if (ib) {
      if (game.nearAltar) { ib.style.display = 'block'; ib.textContent = (game.nearAltar.type === 'sacrifice' ? '捧げる' : '祈る'); }
      else ib.style.display = 'none';
    }
    const zi = document.getElementById('zoneinfo');
    if (zi && game.zone) {
      const t = game.runTime, z = game.zone;
      if (t < z.grace) { zi.textContent = `闇の侵食まで ${Math.ceil(z.grace - t)}秒`; zi.className = 'zoneinfo'; }
      else { zi.textContent = '闇が迫っている — 脱出せよ'; zi.className = 'zoneinfo warn'; }
    }
    // クールダウン表示更新（軽量に再描画）
    const bar = document.getElementById('skillbar');
    if (bar) {
      p.skills.forEach((sid, i) => {
        const btn = bar.querySelector(`.skbtn[data-sk="${i}"]`);
        if (!btn) return;
        const s = SKILLS[sid]; const cd = p.skillCd[i]; const noMp = p.mp < s.mp;
        btn.classList.toggle('dis', cd > 0 || noMp);
        btn.classList.toggle('sel', game.selectedSkill === i);
        let cdEl = btn.querySelector('.skcd');
        if (cd > 0) { if (!cdEl) { cdEl = document.createElement('div'); cdEl.className = 'skcd'; btn.appendChild(cdEl); } cdEl.textContent = cd.toFixed(1); }
        else if (cdEl) cdEl.remove();
      });
      const nb = bar.querySelector('.skbtn[data-sk="-1"]');
      if (nb) nb.classList.toggle('sel', game.selectedSkill === -1);
    }
  },

  showExtract(prog, bonus) {
    const el = document.getElementById('extract');
    if (!el) return;
    if (prog <= 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<div class="exlabel">${bonus ? '報酬ポータルで脱出中…' : '脱出中…'}</div><div class="exbar"><div style="width:${prog * 100}%;${bonus ? 'background:linear-gradient(90deg,#ffce6b,#fff0c8)' : ''}"></div></div>`;
  },

  flashDamage() {
    const f = document.getElementById('dmgflash');
    if (!f) return;
    f.style.opacity = '0.5';
    setTimeout(() => { f.style.opacity = '0'; }, 90);
  },

  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.opacity = '0'; }, 1800);
  },

  // -------- リザルト --------
  showResult(win, data) {
    this.hud.style.display = 'none';
    const lootHtml = data.loot.length ? data.loot.map(it => `<div class="res-item">${this.rarityTag(it)}</div>`).join('') : '<div class="muted">なし</div>';
    let lostHtml = '';
    if (!win && data.lost && data.lost.length) lostHtml = `<div class="card lost"><h3>失った物</h3>${data.lost.map(it => `<div class="res-item">${this.rarityTag(it)}</div>`).join('')}</div>`;
    this.panel(`<div class="screen result ${win ? 'win' : 'lose'}">
      <h1 class="res-title">${win ? '脱出成功' : '死亡'}</h1>
      <p class="subtitle">${win ? '戦利品を持ち帰った。' : '持ち込んだ全てを失った。だが経験は残る。'}</p>
      <div class="res-stats">
        <div><span>撃破数</span><b>${data.kills}</b></div>
        <div><span>獲得G</span><b>${win ? '+' + fmt(data.gold) : '0'}</b></div>
        <div><span>獲得EXP</span><b>+${data.xp}</b></div>
        ${data.leveled ? `<div><span>レベルUP</span><b class="hot">+${data.leveled}</b></div>` : ''}
      </div>
      <div class="card"><h3>${win ? '持ち帰った戦利品' : '失われた戦利品'}</h3>${lootHtml}</div>
      ${lostHtml}
      <button class="btn big totown">拠点へ戻る</button>
    </div>`);
    this.root.querySelector('.totown').addEventListener('click', () => Game.goTown());
  },
};
