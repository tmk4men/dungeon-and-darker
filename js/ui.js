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

  // ゲーム内モーダル確認（ブラウザの confirm を使わない）
  confirm(message, onYes, yesLabel = 'はい', noLabel = 'やめる') {
    const app = document.getElementById('app');
    let m = document.getElementById('modal');
    if (!m) { m = document.createElement('div'); m.id = 'modal'; if (app && app.appendChild) app.appendChild(m); }
    m.innerHTML = `<div class="modal-box"><div class="modal-msg">${message}</div><div class="modal-btns"><button class="btn modal-no">${noLabel}</button><button class="btn modal-yes">${yesLabel}</button></div></div>`;
    m.style.display = 'flex';
    const yes = m.querySelector ? m.querySelector('.modal-yes') : null;
    const no = m.querySelector ? m.querySelector('.modal-no') : null;
    const close = () => { m.style.display = 'none'; m.innerHTML = ''; };
    if (yes && no) {
      yes.addEventListener('click', () => { Audio2.play && Audio2.play('ui'); close(); onYes && onYes(); });
      no.addEventListener('click', () => { Audio2.play && Audio2.play('ui'); close(); });
    } else { close(); onYes && onYes(); }
  },
  panel(html) { this.root.style.display = 'flex'; this.root.style.overflowY = ''; this.root.classList.remove('locked'); this.root.innerHTML = html; },

  gold(n) {
    const u = (typeof Sprites !== 'undefined') ? Sprites.coinURL() : '';
    return `<span class="gold-amt">${u ? `<img class="coin-i" src="${u}" alt="">` : ''}${fmt(n)}</span>`;
  },

  rarityTag(it) {
    const r = RARITY[it.rarity];
    const url = (typeof Sprites !== 'undefined') ? Sprites.iconURL(it) : '';
    const icon = url ? `<img class="item-icon" src="${url}" style="--rc:${r.color}" alt="">` : '';
    return `<span class="item-line">${icon}<span class="rar" style="color:${r.color}">${itemDisplayName(it)}</span></span>`;
  },

  // -------- スタート画面 --------
  showStart(hasSave) {
    this.hud.style.display = 'none';
    this.panel(`<div class="start-screen">
      <div class="start-wheel"><span></span><span></span><span></span></div>
      <div class="start-mark">六道輪廻</div>
      <h1 class="title start-title">輪廻 <span>R I N N E</span></h1>
      <p class="subtitle">巡り、堕ち、また還る。<br>六道・十界をさまよう、ドット絵のエクストラクション型ダンジョン。</p>
      <button class="btn big startbtn">${hasSave ? '修行を続ける' : '門を入る'}</button>
      <div class="start-foot">死ねば全てを失い、また人間界へ還る</div>
    </div>`);
    // スタート画面は1画面固定（スクロールさせない）
    this.root.style.overflowY = 'hidden';
    this.root.classList.add('locked');
    const sb = this.root.querySelector('.startbtn');
    if (sb) sb.addEventListener('click', () => { Audio2.play && Audio2.play('ui'); Game.startGame(); });
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
      <h1 class="title">輪廻 <span>RINNE</span></h1>
      <p class="subtitle">修行の道を選んでダンジョンへ挑め。生きて還れば戦利品はキミのもの。死ねば全てを失う。</p>
      <div class="class-grid">${cards}</div>
    </div>`);
    this.root.querySelectorAll('.class-card').forEach(card => {
      card.querySelector('.pick').addEventListener('click', () => Game.createCharacter(card.dataset.cls));
    });
  },

  // -------- 伽藍（拠点） --------
  showTown(tab) {
    this.hud.style.display = 'none';
    const p = Game.profile;
    // 初回（道を未だ選んでいない）は「道」タブのみ
    if (!p) {
      this.panel(`<div class="town">
        <div class="town-top"><div class="town-title brand">輪廻 <span>RINNE</span></div><div class="town-gold subtle">― 巡り、堕ち、また還る ―</div></div>
        <div class="town-nav"><button class="tnav on">修行の道を選べ</button></div>
        <div class="town-body">${this.tabClass(null)}</div>
      </div>`);
      this.bindTab('class');
      return;
    }
    tab = tab || 'status';
    const d = computeDerived(p);
    Game.derived = d;
    const cls = CLASSES[p.classId];
    const nav = ['status', 'virtue', 'class', 'skill', 'equip', 'forge', 'stash', 'shop', 'bounty', 'deploy'];
    const navName = { status: '己', virtue: '徳', class: '職業', skill: 'スキル', equip: '装備', forge: '鍛冶', stash: '倉庫', shop: 'ショップ', bounty: '請願', deploy: '出発' };
    let body = '';
    if (tab === 'status') body = this.tabStatus(p, d, cls);
    else if (tab === 'virtue') body = this.tabVirtue(p, d);
    else if (tab === 'class') body = this.tabClass(p);
    else if (tab === 'skill') body = this.tabSkill(p, d);
    else if (tab === 'equip') body = this.tabEquip(p, d);
    else if (tab === 'forge') body = this.tabForge(p, d);
    else if (tab === 'stash') body = this.tabStash(p, d);
    else if (tab === 'shop') body = this.tabShop(p, d);
    else if (tab === 'bounty') body = this.tabBounty(p, d);
    else if (tab === 'deploy') body = this.tabDeploy(p, d);

    this.panel(`<div class="town">
      <div class="town-top">
        <div class="town-title">伽藍 ― <b style="color:${cls.color}">${cls.name}</b> <span class="lvl">Lv.${p.level}</span></div>
        <div class="town-gold">${this.gold(p.gold)}</div>
      </div>
      <div class="town-nav">${nav.map(n => `<button class="tnav ${n === tab ? 'on' : ''}" data-t="${n}">${navName[n]}</button>`).join('')}</div>
      <div class="town-body">${body}</div>
    </div>`);
    this.root.querySelectorAll('.tnav').forEach(b => b.addEventListener('click', () => this.showTown(b.dataset.t)));
    this.bindTab(tab);
  },

  // -------- 道（職業選択／変更）--------
  tabClass(p) {
    let cards = '';
    for (const id in CLASSES) {
      const c = CLASSES[id];
      const wt = WEAPON_TYPES[c.weapon];
      const cur = p && p.classId === id;
      cards += `<div class="class-card ${cur ? 'cur' : ''}" style="--ac:${c.color}">
        <canvas class="cc-av" width="64" height="72" data-cls="${id}"></canvas>
        <div class="cc-name">${c.name}</div>
        <div class="cc-weap">得物：${(CLASS_WEAPONS[id] || [c.weapon]).map(w => WEAPON_TYPES[w].name).join('・')}</div>
        <div class="cc-blurb">${c.blurb}</div>
        <div class="cc-stats">${ATTRS.map(a => `<span>${a.name}${c.base[a.key]}</span>`).join('')}</div>
        <div class="cc-skills">${c.skills.map(s => `${SKILLS[s].icon} ${SKILLS[s].name}`).join('・')}</div>
        <button class="btn pick" data-cls="${id}">${cur ? '今この道にあり' : (p ? 'この道へ改める' : 'この道を歩む')}</button>
      </div>`;
    }
    return `<div class="class-tab">
      ${p ? '' : '<p class="subtitle">六道・十界をさまよう修行の旅。死ねば全てを失い、また人間界へ還る。歩む道を選べ。</p>'}
      <div class="class-grid">${cards}</div>
    </div>`;
  },

  tabStatus(p, d, cls) {
    const xpNeed = xpForLevel(p.level);
    const attrRows = ATTRS.map(a => `<div class="attr-row" title="${a.desc}">
        <div class="attr-info"><b>${a.name}</b><span class="ak">${a.key}</span></div>
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
      ['視界', d.hasTorch ? '広い' : '狭い'],
    ].map(r => `<div class="drow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    const eqNames = Object.values(p.equipment).filter(Boolean).map(it => this.rarityTag(it)).join('、') || '—';
    // 戦型（武器の型）と装束（防具セット）
    const wkey = p.equipment.weapon ? p.equipment.weapon.wtype : CLASSES[p.classId].weapon;
    const trait = WEAPON_TRAITS[wkey];
    const sb = setBonusStats(p.equipment);
    const setHtml = sb.active.length
      ? sb.active.map(a => `<div class="drow"><span style="color:var(--gold-bright)">${a.name}</span><b>${a.tier >= 3 ? '三' : '二'}揃え（${a.count}/3）</b></div>`).join('')
      : '<div class="muted">装束セット効果なし（同じ装束を2点以上で発動）</div>';
    const synHtml = SYNERGIES.map(s => `<div class="syn"><b>${s.name}</b><span>${s.desc}</span></div>`).join('');
    const buildCard = `<div class="card"><h3>戦型と装束</h3>
        <div class="drow"><span>得物の型</span><b>${trait ? trait.name : '—'}</b></div>
        ${trait ? `<div class="muted" style="margin:1px 0 9px">${trait.desc}</div>` : ''}
        ${setHtml}
        <div class="syn-head">状態シナジー</div><div class="syn-list">${synHtml}</div>
      </div>`;
    return `<div class="cols">
      <div class="col">
        <div class="card char-card">
          <div class="avatar-frame"><canvas id="avatarCanvas" width="84" height="96" class="avatar"></canvas></div>
          <div class="char-meta">
            <div class="char-name" style="color:${cls.color}">${cls.name}</div>
            <div class="char-sub">Lv.${p.level} ・ 得物 ${WEAPON_TYPES[cls.weapon].name}</div>
            <div class="char-flavor">${cls.blurb}</div>
            <div class="char-rec">脱出 ${p.runStats.extracts}　頓死 ${p.runStats.deaths}　調伏 ${p.runStats.kills}</div>
            <div class="char-rec">転生 ${p.rebirths || 0}　徳 ${p.merit || 0}${(p.rebirths || 0) > 0 ? `　<span style="color:var(--gold-bright)">魔威 +${Math.round((p.rebirths || 0) * REBIRTH.enemyScale * 100)}%</span>` : ''}</div>
          </div>
        </div>
        <div class="card">
          <div class="lvbox">Lv.${p.level} <div class="xpbar"><div style="width:${Math.min(100, p.xp / xpNeed * 100)}%"></div></div><span>${p.xp}/${xpNeed}</span></div>
          <div class="points">割り振りポイント：<b class="${p.points > 0 ? 'hot' : ''}">${p.points}</b></div>
          <div class="attr-grid">${attrRows}</div>
        </div>
      </div>
      <div class="col">
        <div class="card"><h3>派生ステータス</h3><div class="drow-grid">${derivedRows}</div></div>
        ${buildCard}
        <div class="card"><h3>実績（${Object.keys(p.achievements || {}).length}/${Object.keys(ACHIEVEMENTS).length}）</h3>
          <div class="ach-chips">${Object.keys(ACHIEVEMENTS).map(id => { const a = ACHIEVEMENTS[id]; const got = p.achievements && p.achievements[id]; return `<span class="ach-chip ${got ? 'got' : ''}" title="${a.desc}">${got ? '◆' : '◇'} ${a.name}</span>`; }).join('')}</div>
        </div>
      </div>
    </div>`;
  },

  // -------- 徳（解脱で得た永続パッシブ） --------
  tabVirtue(p, d) {
    const merit = p.merit || 0, reb = p.rebirths || 0;
    const rows = VIRTUE_ORDER.map(id => {
      const v = VIRTUES[id]; const lv = virtueLv(p, id); const maxed = lv >= v.max;
      return `<div class="inv-row">
        <div><span class="rar" style="color:var(--gold-bright)">${v.name}</span> <span class="slot-tag">${lv}/${v.max}</span>
          <div class="eq-stat">${v.desc}（現在 +${lv}段）</div></div>
        ${maxed ? '<span class="muted">極</span>' : `<button class="btn sm vbuy ${merit >= 1 ? '' : 'poor'}" data-v="${id}">徳1で授かる</button>`}
      </div>`;
    }).join('');
    return `<div class="card">
        <h3>輪廻と解脱</h3>
        <div class="virtue-meta">
          <div class="vm"><span>転生</span><b>${reb}</b></div>
          <div class="vm"><span>徳</span><b class="${merit > 0 ? 'hot' : ''}">${merit}</b></div>
        </div>
        <p class="muted">業（殺生）を抑えて深層（第${LIBERATION.floor}層以降）に至り、<b>解脱門（報酬ポータル）</b>をくぐると転生し「徳」を授かる。徳は転生しても永遠に積み上がる。</p>
      </div>
      <div class="card"><h3>徳を授かる</h3>${rows}</div>`;
  },

  tabBounty(p, d) {
    if (!p.bounties) p.bounties = [];
    const rows = p.bounties.map(b => {
      const pct = clamp(b.progress / b.target * 100, 0, 100);
      return `<div class="card" style="margin-bottom:8px">
        <div class="brow"><b>${b.label}</b><span class="val">報酬 ${this.gold(b.reward)}</span></div>
        <div class="xpbar" style="margin:8px 0"><div style="width:${pct}%"></div></div>
        <div class="brow"><span class="muted">${Math.min(b.progress, b.target)} / ${b.target}</span>
          ${b.done && !b.claimed ? `<button class="btn sm claim" data-id="${b.id}">報酬を受け取る</button>` : b.claimed ? '<span class="muted">受取済</span>' : '<span class="muted">進行中…</span>'}</div>
      </div>`;
    }).join('');
    return `<div class="card"><h3>依頼</h3></div>${rows}`;
  },

  tabSkill(p, d) {
    if (!p.loadout || !p.loadout.length) p.loadout = (CLASS_SKILL_POOL[p.classId] || CLASSES[p.classId].skills).slice(0, 3);
    const pool = CLASS_SKILL_POOL[p.classId] || CLASSES[p.classId].skills;
    const cards = pool.map(sid => {
      const s = SKILLS[sid]; const on = p.loadout.includes(sid);
      return `<div class="skill-card ${on ? 'on' : ''}">
        <div class="sc-top"><span class="sc-ic">${(typeof Sprites !== 'undefined' && Sprites.skillURL(sid)) ? `<img class="sk-i" src="${Sprites.skillURL(sid)}">` : s.icon}</span><b>${s.name}</b></div>
        <div class="sc-meta">${s.mp} MP ・ CD ${s.cd}s ・ ${s.scaling ? STAT_NAMES[s.scaling] + '依存' : '補助'}</div>
        <div class="sc-desc">${s.desc}</div>
        <button class="btn sm skilltoggle" data-sid="${sid}" ${!on && p.loadout.length >= 3 ? 'disabled' : ''}>${on ? '装備中（外す）' : '装備する'}</button>
      </div>`;
    }).join('');
    return `<div class="card"><h3>スキル選択 — 3つまで装備（現在 ${p.loadout.length}/3）</h3>
      <div class="skill-grid">${cards}</div></div>`;
  },

  tabForge(p, d) {
    const items = [];
    for (const slot in p.equipment) if (p.equipment[slot]) items.push({ it: p.equipment[slot], where: '装備中' });
    for (const it of stashItems(p)) if (canUpgrade(it) || canEnchant(it)) items.push({ it, where: '倉庫' });
    if (!items.length) return `<div class="card"><div class="muted">強化できる装備がありません。武器・防具を入手しましょう。</div></div>`;
    const rows = items.map(({ it, where }) => {
      const upOk = canUpgrade(it), enOk = canEnchant(it);
      return `<div class="inv-row">
        <div>${this.rarityTag(it)} <span class="slot-tag">${where}</span><div class="eq-stat">${statLine(it.stats)}</div></div>
        <div class="inv-act">
          ${upOk ? `<button class="btn sm upg ${p.gold >= upgradeCost(it) ? '' : 'poor'}" data-uid="${it.uid}">強化+${(it.upgrade || 0) + 1}（${this.gold(upgradeCost(it))}）</button>` : `<span class="muted">強化MAX</span>`}
          ${enOk ? `<button class="btn sm ench ${p.gold >= enchantCost(it) ? '' : 'poor'}" data-uid="${it.uid}">エンチャント（${this.gold(enchantCost(it))}）</button>` : ''}
        </div></div>`;
    }).join('');
    return `<div class="card"><h3>鍛冶屋 — 強化／エンチャント</h3>${rows}</div>`;
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
    const equippable = stashItems(p).filter(it => ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot));
    const list = equippable.length ? equippable.map(it => {
      const ok = canEquipItem(p.classId, it);
      return `<div class="inv-row${ok ? '' : ' lockrow'}">
        <div>${this.rarityTag(it)} <span class="slot-tag">${SLOT_NAMES[it.slot]}</span>${ok ? '' : '<span class="slot-tag lock">職業外</span>'}
          <div class="eq-stat">${statLine(it.stats)}</div>
          <div class="cmp-line">${ok ? compareLine(it, p.equipment[it.slot]) : '<span class="cmp down">' + CLASSES[p.classId].name + 'は扱えない武器</span>'}</div></div>
        ${ok ? `<button class="btn sm equip" data-uid="${it.uid}">装備</button>` : '<button class="btn sm" disabled>不可</button>'}
      </div>`;
    }).join('') : '<div class="muted">倉庫に装備品はありません</div>';
    return `<div class="cols">
      <div class="col"><div class="card"><h3>装備中（ダンジョンへ持ち込む＝死亡でロスト）</h3>${slotHtml}${potHtml}</div></div>
      <div class="col"><div class="card"><h3>倉庫の装備品</h3>${list}</div></div>
    </div>`;
  },

  tabStash(p, d) {
    const bag = p.stash; const ic = (it) => { const u = Sprites.iconURL(it); return u ? `<img class="bag-ic" src="${u}" alt="">` : ''; };
    let cells = '';
    for (let y = 0; y < bag.h; y++) for (let x = 0; x < bag.w; x++) cells += `<div class="bag-cell" data-x="${x}" data-y="${y}" style="grid-column:${x + 1};grid-row:${y + 1}"></div>`;
    let items = '';
    for (let k = 0; k < bag.items.length; k++) { const e = bag.items[k]; const selc = (this.stashSel === e) ? 'sel' : ''; items += `<div class="bag-item ${selc}" data-k="${k}" style="grid-column:${e.x + 1}/span ${e.w};grid-row:${e.y + 1}/span ${e.h};--rc:${RARITY[e.item.rarity].color}">${ic(e.item)}</div>`; }
    const sel = this.stashSel && bag.items.includes(this.stashSel) ? this.stashSel : null;
    let act = '';
    if (sel) {
      const it = sel.item; const eq = ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot);
      act = `<div class="bag-actions">${this.rarityTag(it)}
        ${sel.w !== sel.h ? '<button class="btn sm srot">回転</button>' : ''}
        ${eq ? (canEquipItem(p.classId, it) ? '<button class="btn sm sequip">装備</button>' : '<button class="btn sm" disabled>職業外</button>') : ''}
        ${it.slot === 'potion' ? '<button class="btn sm stopot">薬枠へ</button>' : ''}
        <button class="btn sm ssell">売却 ${this.gold(Math.round(it.value * 0.6))}</button></div>`;
    }
    return `<div class="card"><h3>倉庫</h3>
      <div class="bag-grid stash-grid" style="grid-template-columns:repeat(${bag.w},1fr);grid-template-rows:repeat(${bag.h},1fr);aspect-ratio:${bag.w}/${bag.h}">${cells}${items}</div>${act}</div>`;
  },

  tabShop(p, d) {
    if (!this.shopStock) this.refreshShop();
    const buy = this.shopStock.map(it => `<div class="inv-row">
      <div>${this.rarityTag(it)} <span class="slot-tag">${SLOT_NAMES[it.slot] || (it.slot === 'potion' ? 'ポーション' : '財宝')}</span>
        <div class="eq-stat">${it.potion ? (it.potion.hp ? 'HP+' + it.potion.hp : '') + (it.potion.mp ? ' MP+' + it.potion.mp : '') : statLine(it.stats)}</div></div>
      <button class="btn sm buy" data-uid="${it.uid}">${this.gold(this.buyPrice(it))} 購入</button>
    </div>`).join('');
    const ss = stashItems(p);
    const sellList = ss.length ? ss.map(it => `<div class="inv-row">
      <div>${this.rarityTag(it)}</div>
      <button class="btn sm danger sell" data-uid="${it.uid}">${this.gold(Math.round(it.value * 0.6))} 売却</button>
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
        <p class="warn">死亡で持ち込み品は全ロスト。脱出して持ち帰れ。</p>
      </div></div>
      <div class="col"><div class="card">
        <h3>出撃</h3>
        <button class="btn big enterdungeon">ダンジョンへ潜入</button>
        <p class="muted">下り階段で深く潜るほど強敵・高レア・高報酬。</p>
      </div></div>
    </div>`;
  },

  drawAvatarTo(cv, classId) {
    if (!cv || !cv.getContext || typeof Sprites === 'undefined') return;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const spr = Sprites.player(classId);
    const sc = Math.max(1, Math.floor(Math.min(cv.width / spr._w, cv.height / spr._h)));
    const w = spr._w * sc, h = spr._h * sc;
    ctx.drawImage(spr, Math.floor((cv.width - w) / 2), Math.floor((cv.height - h) / 2), w, h);
  },

  bindTab(tab) {
    const p = Game.profile;
    const reload = () => { saveProfile(p); this.showTown(tab); };
    // 道（職業）選択＋アバター描画
    this.root.querySelectorAll('.cc-av').forEach(cv => this.drawAvatarTo(cv, cv.dataset.cls));
    this.root.querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => Game.chooseClass(b.dataset.cls)));
    const av = this.root.querySelector('#avatarCanvas');
    if (av && p) this.drawAvatarTo(av, p.classId);
    // ステータス＋
    this.root.querySelectorAll('.plus').forEach(b => b.addEventListener('click', () => {
      if (p.points > 0) { p.baseAttrs[b.dataset.a]++; p.points--; reload(); }
    }));
    // 装備
    this.root.querySelectorAll('.equip').forEach(b => b.addEventListener('click', () => { this.equipItem(+b.dataset.uid); reload(); }));
    this.root.querySelectorAll('.unequip').forEach(b => b.addEventListener('click', () => {
      const s = b.dataset.slot; if (p.equipment[s]) { stashAddItem(p, p.equipment[s]); p.equipment[s] = null; } reload();
    }));
    this.root.querySelectorAll('.potoff').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i; if (p.potions[i]) { stashAddItem(p, p.potions[i]); p.potions[i] = null; } reload();
    }));
    this.root.querySelectorAll('.topotion').forEach(b => b.addEventListener('click', () => {
      const it = stashItems(p).find(x => x.uid === +b.dataset.uid);
      const slot = p.potions.findIndex(x => !x);
      if (it && slot >= 0) { p.potions[slot] = it; stashRemoveItem(p, it); }
      reload();
    }));
    // 売却
    this.root.querySelectorAll('.sell').forEach(b => b.addEventListener('click', () => {
      const it = stashItems(p).find(x => x.uid === +b.dataset.uid);
      if (it) { p.gold += Math.round(it.value * 0.6); stashRemoveItem(p, it); }
      reload();
    }));
    // 購入
    this.root.querySelectorAll('.buy').forEach(b => b.addEventListener('click', () => {
      const it = this.shopStock.find(x => x.uid === +b.dataset.uid);
      if (it && p.gold >= this.buyPrice(it)) { p.gold -= this.buyPrice(it); stashAddItem(p, it); this.shopStock = this.shopStock.filter(x => x.uid !== it.uid); reload(); }
      else this.toast('ゴールドが足りない');
    }));
    this.root.querySelectorAll('.refresh').forEach(b => b.addEventListener('click', () => { this.refreshShop(); reload(); }));
    // 倉庫グリッド（ドラッグ整理・選択・操作）
    const sg = this.root.querySelector('.stash-grid');
    if (sg) this.attachGridDrag(sg, p.stash, { move: (e, x, y) => stashMove(p, e, x, y), select: (e) => { this.stashSel = e; reload(); }, refresh: reload });
    const ssel = (this.stashSel && p.stash.items.includes(this.stashSel)) ? this.stashSel : null;
    const SA = (cls, fn) => { const el = this.root.querySelector(cls); if (el) el.addEventListener('click', () => { fn(); reload(); }); };
    SA('.srot', () => { if (ssel) stashRotate(p, ssel); });
    SA('.sequip', () => { if (ssel) { const it = ssel.item; if (!canEquipItem(p.classId, it)) { this.toast(CLASSES[p.classId].name + 'はこの武器を扱えない'); return; } const slot = it.slot; stashRemoveItem(p, it); if (p.equipment[slot]) stashAddItem(p, p.equipment[slot]); p.equipment[slot] = it; this.stashSel = null; } });
    SA('.stopot', () => { if (ssel) { const slot = p.potions.findIndex(x => !x); if (slot < 0) { this.toast('ポーション枠が満杯'); return; } p.potions[slot] = ssel.item; stashRemoveItem(p, ssel.item); this.stashSel = null; } });
    SA('.ssell', () => { if (ssel) { p.gold += Math.round(ssel.item.value * 0.6); stashRemoveItem(p, ssel.item); this.stashSel = null; Audio2.play && Audio2.play('coin'); } });
    // スキル選択
    this.root.querySelectorAll('.skilltoggle').forEach(b => b.addEventListener('click', () => {
      const sid = b.dataset.sid;
      if (!p.loadout) p.loadout = [];
      if (p.loadout.includes(sid)) p.loadout = p.loadout.filter(x => x !== sid);
      else if (p.loadout.length < 3) p.loadout.push(sid);
      Audio2.play && Audio2.play('select');
      reload();
    }));
    // 鍛冶：強化／エンチャント
    const findItem = (uid) => {
      for (const slot in p.equipment) if (p.equipment[slot] && p.equipment[slot].uid === uid) return p.equipment[slot];
      return stashItems(p).find(x => x.uid === uid);
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
        this.toast('報酬 ' + fmt(bt.reward) + ' を受け取った');
        reload();
      }
    }));
    // 徳を授かる
    this.root.querySelectorAll('.vbuy').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.v, v = VIRTUES[id]; const lv = virtueLv(p, id);
      if ((p.merit || 0) < 1) { this.toast('徳が足りない（解脱で得る）'); return; }
      if (lv >= v.max) return;
      if (!p.virtues) p.virtues = {};
      p.virtues[id] = lv + 1; p.merit -= 1;
      Audio2.play && Audio2.play('levelup');
      reload();
    }));
    // 出撃
    this.root.querySelectorAll('.enterdungeon').forEach(b => b.addEventListener('click', () => { this.hideAll(); Game.enterDungeon(); }));
  },

  equipItem(uid) {
    const p = Game.profile;
    const it = stashItems(p).find(x => x.uid === uid);
    if (!it) return;
    if (!canEquipItem(p.classId, it)) { this.toast(CLASSES[p.classId].name + 'はこの武器を扱えない'); return; }
    const slot = it.slot;
    stashRemoveItem(p, it);
    if (p.equipment[slot]) stashAddItem(p, p.equipment[slot]);
    p.equipment[slot] = it;
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
    // 右スティックの周囲に弧状配置：通常→スキル→ポーション
    const nodes = [{ kind: 'normal' }];
    p.skills.forEach((sid, i) => nodes.push({ kind: 'skill', sid, i }));
    p.potions.forEach((it, i) => nodes.push({ kind: 'pot', it, i }));
    const n = nodes.length;
    // 上→左→左下の弧のみに配置。右下（親指で攻撃ドラッグを始める領域）は空けてスティック入力を奪わない
    const A0 = 82, A1 = 212;
    const place = (idx) => {
      const th = (n <= 1 ? (A0 + A1) / 2 : A0 + (A1 - A0) * idx / (n - 1)) * Math.PI / 180;
      return `left:calc(var(--skr) * ${Math.cos(th).toFixed(4)});top:calc(var(--skr) * ${(-Math.sin(th)).toFixed(4)});`;
    };
    let html = '';
    nodes.forEach((nd, idx) => {
      const pos = place(idx);
      if (nd.kind === 'normal') {
        html += `<button class="skbtn ${game.selectedSkill === -1 ? 'sel' : ''}" data-sk="-1" style="${pos}">
          <div class="skic">${game.derived.wtype.kind === 'magic' ? '杖' : game.derived.wtype.kind === 'ranged' ? '弓' : '剣'}</div>
          <div class="sklbl">通常</div></button>`;
      } else if (nd.kind === 'skill') {
        const s = SKILLS[nd.sid]; const cd = p.skillCd[nd.i]; const noMp = p.mp < s.mp;
        const su = (typeof Sprites !== 'undefined') ? Sprites.skillURL(nd.sid) : '';
        html += `<button class="skbtn ${game.selectedSkill === nd.i ? 'sel' : ''} ${cd > 0 || noMp ? 'dis' : ''}" data-sk="${nd.i}" style="${pos}">
          <div class="skic">${su ? `<img class="sk-i" src="${su}">` : s.icon}</div>
          <div class="sklbl">${s.name}</div>
          <div class="skmp">${s.mp}MP</div>
          ${cd > 0 ? `<div class="skcd">${cd.toFixed(1)}</div>` : ''}
        </button>`;
      } else {
        const it = nd.it; const purl = it && typeof Sprites !== 'undefined' ? Sprites.iconURL(it) : '';
        html += `<button class="potbtn ${it ? '' : 'empty'}" data-pot="${nd.i}" style="${pos}">
          ${it ? `${purl ? `<img class="potic-img" src="${purl}" alt="">` : `<div class="potic">${it.potion && it.potion.mp ? 'MP' : 'HP'}</div>`}<div class="potlbl">${it.name.replace('ポーション', '')}</div>` : '<div class="potic">＋</div>'}
        </button>`;
      }
    });
    document.getElementById('skillbar').innerHTML = html;
    // pointerdown で即時反応（左スティックで移動中＝マルチタッチでも確実に効く）
    document.querySelectorAll('#skillbar .skbtn').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); Game.selectSkill(+b.dataset.sk); }));
    document.querySelectorAll('#skillbar .potbtn').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); Game.usePotion(+b.dataset.pot); }));
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
    if (info) {
      const cu = (typeof Sprites !== 'undefined') ? Sprites.coinURL() : '';
      const html = `${realmName(game.floor)}　戦利品 ${game.run.bag.items.length}　${cu ? `<img class="coin-i" src="${cu}">` : '金'}${game.run.gold}`;
      if (this._lastRun !== html) { info.innerHTML = html; this._lastRun = html; }
    }
    const bb = document.getElementById('bagbtn');
    if (bb && game.run) {
      const bi = bb.querySelector('.bag-ic');
      if (bi && typeof Sprites !== 'undefined' && Sprites.bagURL() && !this._bagIcon) { bi.innerHTML = `<img class="bag-ic-img" src="${Sprites.bagURL()}" alt="">`; this._bagIcon = true; }
      const ct = bb.querySelector('.bag-ct'); if (ct) ct.textContent = bagFreeCells(game.run.bag) + 'マス';
    }
    const tb = document.getElementById('torchbtn');
    if (tb) {
      const hasTorch = game.profile && game.profile.equipment && game.profile.equipment.torch;
      tb.style.display = hasTorch ? 'flex' : 'none';
      tb.classList.toggle('thrown', !!game.torchThrown);
      const st = tb.querySelector('.torch-st'); if (st) st.textContent = game.torchThrown ? '投擲中' : '投げる';
    }
    const ib = document.getElementById('interactbtn');
    if (ib) {
      const channeling = game.channel && game.channel.kind;
      if (game.nearStairs) { ib.style.display = 'block'; ib.textContent = '降りる'; ib.classList.remove('go'); }
      else if (game.nearOpenChest) { ib.style.display = 'block'; ib.textContent = '宝箱を見る'; ib.classList.remove('go'); }
      else if (game.nearAltar) { ib.style.display = 'block'; ib.textContent = (game.nearAltar.type === 'sacrifice' ? '捧げる' : '祈る'); ib.classList.remove('go'); }
      else if (game.channelTarget) { ib.style.display = 'block'; ib.textContent = channeling ? '開錠中…' : (game.channelTarget.kind === 'chest' ? '宝箱を開ける' : '扉を開ける'); ib.classList.toggle('go', !!channeling); }
      else ib.style.display = 'none';
    }
    const ki = document.getElementById('karmainfo');
    if (ki && game.run) {
      const tier = Math.min(3, Math.floor(game.run.karma / 15));
      if (tier > 0) { ki.style.display = 'block'; ki.textContent = '業 ' + '●'.repeat(tier) + '○'.repeat(3 - tier) + ` 獄卒+${tier * 12}%`; }
      else ki.style.display = 'none';
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

  // グリッドのドラッグ移動（回転表示でも document.elementsFromPoint で正しく判定）
  attachGridDrag(grid, bag, opts) {
    if (!grid || !grid.querySelectorAll) return;
    const items = Array.from(grid.querySelectorAll('.bag-item'));
    const cellAt = (x, y) => {
      const els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
      for (const el of els) if (el && el.classList && el.classList.contains('bag-cell')) return el;
      return null;
    };
    const clearHi = () => grid.querySelectorAll('.bag-cell').forEach(c => c.classList.remove('drop', 'bad'));
    let drag = null;
    const end = (refresh) => { if (drag && drag.el) drag.el.classList.remove('dragging'); items.forEach(it => it.style.pointerEvents = ''); clearHi(); drag = null; if (refresh) opts.refresh(); };
    items.forEach(el => {
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        const entry = bag.items[+el.dataset.k]; if (!entry) return;
        drag = { entry, el, sx: ev.clientX, sy: ev.clientY, moved: false };
        el.classList.add('dragging');
        items.forEach(it => it.style.pointerEvents = 'none');
        el.setPointerCapture && el.setPointerCapture(ev.pointerId);
      });
      el.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 8) drag.moved = true;
        if (!drag.moved) return;
        clearHi();
        const c = cellAt(ev.clientX, ev.clientY); if (!c) return;
        const tx = +c.dataset.x, ty = +c.dataset.y, e = drag.entry;
        const ok = bagFits(bag, tx, ty, e.w, e.h, e);
        for (let dy = 0; dy < e.h; dy++) for (let dx = 0; dx < e.w; dx++) { const cc = grid.querySelector(`.bag-cell[data-x="${tx + dx}"][data-y="${ty + dy}"]`); if (cc) cc.classList.add(ok ? 'drop' : 'bad'); }
      });
      el.addEventListener('pointerup', (ev) => {
        if (!drag) return;
        if (drag.moved) { const c = cellAt(ev.clientX, ev.clientY); if (c) opts.move(drag.entry, +c.dataset.x, +c.dataset.y); end(true); }
        else { const e = drag.entry; end(false); opts.select(e); }
      });
      el.addEventListener('pointercancel', () => { if (drag) end(true); });
    });
  },

  // -------- バッグ（マス制・多マス占有／ダンジョン中） --------
  showBag(game) {
    this.hud.style.display = 'none';
    const p = Game.profile;
    const bag = game.run.bag;
    const free = bagFreeCells(bag);
    const ic = (it) => { const u = Sprites.iconURL(it); return u ? `<img class="bag-ic" src="${u}" alt="">` : ''; };

    // 取得元
    const chest = game.bagChest;
    let srcTitle, src;
    if (chest && chest.contents && chest.contents.length) { srcTitle = '宝箱の中身'; src = chest.contents.map(it => ({ from: 'chest', item: it })); }
    else { srcTitle = '足元の戦利品'; src = game.groundItems.filter(g => dist(game.player.x, game.player.y, g.x, g.y) < 120).map(g => ({ from: 'ground', item: g.item })); }
    this._bagSrc = src;
    const srcHtml = src.length
      ? src.map((s, i) => `<div class="loot-row">${this.rarityTag(s.item)}<span class="sz">${itemSize(s.item)[0]}×${itemSize(s.item)[1]}</span><button class="btn sm take" data-i="${i}">拾う</button></div>`).join('') + (src.length > 1 ? '<button class="btn sm takeall">入る分だけ拾う</button>' : '')
      : '<div class="muted">なし</div>';

    let cells = '';
    for (let y = 0; y < bag.h; y++) for (let x = 0; x < bag.w; x++) cells += `<div class="bag-cell" data-x="${x}" data-y="${y}" style="grid-column:${x + 1};grid-row:${y + 1}"></div>`;
    let items = '';
    for (let k = 0; k < bag.items.length; k++) {
      const e = bag.items[k]; const selc = (this.bagSel === e) ? 'sel' : '';
      items += `<div class="bag-item ${selc}" data-k="${k}" style="grid-column:${e.x + 1}/span ${e.w};grid-row:${e.y + 1}/span ${e.h};--rc:${RARITY[e.item.rarity].color}">${ic(e.item)}</div>`;
    }

    let actHtml = '';
    const sel = this.bagSel;
    if (sel && bag.items.includes(sel)) {
      const it = sel.item;
      const eq = ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot);
      actHtml = `<div class="bag-actions">${this.rarityTag(it)}
        ${sel.w !== sel.h ? '<button class="btn sm brot">回転</button>' : ''}
        ${eq ? (canEquipItem(p.classId, it) ? '<button class="btn sm bequip">装備</button>' : '<button class="btn sm" disabled>職業外</button>') : ''}
        ${it.slot === 'potion' ? '<button class="btn sm buse">使う</button><button class="btn sm bslot">薬枠へ</button>' : ''}
        <button class="btn sm danger bdrop">捨てる</button></div>`;
    }

    const eqHtml = ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].map(s => {
      const it = p.equipment[s];
      return `<div class="eqrow ${it ? '' : 'empty'}" data-slot="${s}"><span class="eqlbl">${SLOT_NAMES[s]}</span>${it ? this.rarityTag(it) : '<span class="muted">—</span>'}${it ? '<button class="btn sm unequip">外す</button>' : ''}</div>`;
    }).join('');

    this.panel(`<div class="bag-screen">
      <div class="bag-top"><b>持ち物</b><span class="muted">空き ${free}マス${chest ? '　（宝箱を開封中）' : ''}</span><button class="btn sm bagclose">閉じる</button></div>
      <div class="bag-cols">
        <div class="bag-pane loot-pane"><h3>${srcTitle}</h3>${srcHtml}</div>
        <div class="bag-pane mine-pane">
          <h3>バッグ</h3>
          <div class="bag-grid" style="grid-template-columns:repeat(${bag.w},1fr);grid-template-rows:repeat(${bag.h},1fr);aspect-ratio:${bag.w}/${bag.h}">${cells}${items}</div>
          ${actHtml}
          <h3 class="eq-sub">装備</h3>
          <div class="eqgrid">${eqHtml}</div>
        </div>
      </div>
    </div>`);

    const refresh = () => this.showBag(game);
    const bc = this.root.querySelector('.bagclose'); if (bc) bc.addEventListener('click', () => { this.bagSel = null; Game.closeBag(); });
    this.root.querySelectorAll('.take').forEach(b => b.addEventListener('click', () => { const s = this._bagSrc[+b.dataset.i]; if (s) Game.takeLoot(s.from === 'chest' ? game.bagChest : 'ground', s.item); this.bagSel = null; refresh(); }));
    const ta = this.root.querySelector('.takeall'); if (ta) ta.addEventListener('click', () => { for (const s of this._bagSrc.slice()) Game.takeLoot(s.from === 'chest' ? game.bagChest : 'ground', s.item); this.bagSel = null; refresh(); });
    this.attachGridDrag(this.root.querySelector('.bag-grid'), bag, { move: (e, x, y) => Game.bagMove(e, x, y), select: (e) => { this.bagSel = e; refresh(); }, refresh });
    const A = (cls, fn) => { const el = this.root.querySelector(cls); if (el) el.addEventListener('click', () => { fn(); refresh(); }); };
    A('.brot', () => { Game.bagRotate(sel); });
    A('.bequip', () => { Game.bagEquip(sel); this.bagSel = null; });
    A('.buse', () => { Game.bagUse(sel); this.bagSel = null; });
    A('.bslot', () => { Game.bagToPotionSlot(sel); this.bagSel = null; });
    A('.bdrop', () => { Game.bagDrop(sel); this.bagSel = null; });
    this.root.querySelectorAll('.unequip').forEach(b => b.addEventListener('click', () => { Game.bagUnequip(b.closest('.eqrow').dataset.slot); refresh(); }));
  },

  showExtract(prog, bonus, liberated) {
    const el = document.getElementById('extract');
    if (!el) return;
    if (prog <= 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const label = liberated ? '解脱の門をくぐる…' : bonus ? '報酬ポータルで脱出中…' : '脱出中…';
    const barBg = liberated ? 'background:linear-gradient(90deg,#ffe6a8,#ffffff)' : bonus ? 'background:linear-gradient(90deg,#ffce6b,#fff0c8)' : '';
    el.innerHTML = `<div class="exlabel ${liberated ? 'liber' : ''}">${label}</div><div class="exbar"><div style="width:${prog * 100}%;${barBg}"></div></div>`;
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
    const lib = win && data.liberated;
    this.panel(`<div class="screen result ${lib ? 'liberated' : win ? 'win' : 'lose'}">
      ${!win || lib ? '<div class="samsara"><span></span><span></span><span></span></div>' : ''}
      <h1 class="res-title">${lib ? '解脱' : win ? '生還' : '輪廻'}</h1>
      <p class="subtitle">${lib ? '業を断ち、六道の輪より抜け出た。徳を携え、新たな生へと転生する。' : win ? realmName(Game.floor) + 'より戦利品を持ち帰った。' : '持ち込んだ全てを失い、再び人間界へ還る。だが業（カルマ）は経験として残る。'}</p>
      <div class="res-stats">
        <div><span>撃破数</span><b>${data.kills}</b></div>
        <div><span>獲得</span><b>${win ? '+' + this.gold(data.gold) : '0'}</b></div>
        <div><span>獲得EXP</span><b>+${data.xp}</b></div>
        ${data.leveled ? `<div><span>レベルUP</span><b class="hot">+${data.leveled}</b></div>` : ''}
        ${lib ? `<div><span>授かった徳</span><b class="hot">+${data.meritGain}</b></div><div><span>転生</span><b class="hot">${data.rebirths}</b></div>` : ''}
      </div>
      <div class="card"><h3>${win ? '持ち帰った戦利品' : '失われた戦利品'}</h3>${lootHtml}</div>
      ${lostHtml}
      <button class="btn big totown">${lib ? '転生する' : '伽藍へ還る'}</button>
    </div>`);
    const tt = this.root.querySelector('.totown'); if (tt) tt.addEventListener('click', () => Game.goTown());
  },
};
