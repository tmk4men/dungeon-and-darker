// ============================================================
// items.js — アイテム生成・集計
// ============================================================
function baseById(id) { return ITEM_BASES.find(b => b.id === id); }

// レアリティを幸運込みで抽選
function rollRarity(luck = 0, floor = 0) {
  const entries = RARITY_ORDER.map((k, i) => {
    let w = RARITY[k].weight;
    // 幸運で上位レアの重みを底上げ、下位を圧縮
    if (i >= 2) w *= (1 + luck * 0.03 + floor * 0.12);
    if (i <= 1) w *= 1 / (1 + luck * 0.015);
    return { item: k, weight: w };
  });
  return weightedPick(entries);
}

// アイテムインスタンス生成
function createItem(baseId, rarityKey) {
  const base = baseById(baseId);
  if (!base) return null;
  const rk = rarityKey || 'common';
  const r = RARITY[rk];
  const it = {
    uid: uid(), baseId, name: base.name, slot: base.slot, wtype: base.wtype,
    rarity: rk, stats: {}, value: base.value, potion: base.potion ? { ...base.potion } : null,
    affixNames: [], upgrade: 0, enchants: 0,
  };
  // 基礎ステータスをレアリティ倍率で
  if (base.stats) for (const k in base.stats) {
    let v = base.stats[k] * r.mult;
    v = (k === 'crit') ? Math.round(v * 1000) / 1000 : Math.round(v);
    if (v !== 0) it.stats[k] = v;
  }
  // アフィックス付与（装備のみ）
  if (['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(base.slot)) {
    const pool = shuffle(AFFIXES.slice());
    for (let i = 0; i < r.affixes && i < pool.length; i++) {
      const af = pool[i];
      it.affixNames.push(af.name);
      for (const k in af.stats) it.stats[k] = (it.stats[k] || 0) + af.stats[k];
    }
    // レジェンダリは固有効果を1つ付与
    if (rk === 'legendary') {
      const uq = choice(UNIQUE_AFFIXES);
      it.affixNames.unshift(uq.name);
      it.unique = uq.name;
      for (const k in uq.stats) it.stats[k] = (it.stats[k] || 0) + uq.stats[k];
    }
  }
  // 売却価値（レア＆アフィックスで増加）
  it.value = Math.round(base.value * (0.6 + r.mult * 0.7) * (1 + it.affixNames.length * 0.25));
  return it;
}

function itemDisplayName(it) {
  if (!it) return '';
  const up = it.upgrade ? ` +${it.upgrade}` : '';
  return it.name + up + (it.affixNames.length ? ' ' + it.affixNames.join('') : '');
}

// 強化可能か（武器・防具のみ、最大+5）
function canUpgrade(it) {
  return it && ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot) && (it.upgrade || 0) < 5;
}
function upgradeCost(it) { return Math.round((it.value + 20) * ((it.upgrade || 0) + 1) * 1.4); }
function upgradeItem(it) {
  if (!canUpgrade(it)) return false;
  it.upgrade = (it.upgrade || 0) + 1;
  // 数値ステータスを底上げ（+1ごとに約12%）
  for (const k in it.stats) {
    if (k === 'crit' || k === 'lifesteal') it.stats[k] = Math.round((it.stats[k] * 1.1) * 1000) / 1000;
    else it.stats[k] = it.stats[k] >= 0 ? Math.ceil(it.stats[k] * 1.12 + 0.5) : Math.floor(it.stats[k] * 1.12);
  }
  it.value = Math.round(it.value * 1.3);
  return true;
}

// エンチャント可能か（最大+2個の追加アフィックス）
function canEnchant(it) {
  return it && ['weapon', 'head', 'chest', 'hands', 'legs', 'ring', 'torch'].includes(it.slot) && (it.enchants || 0) < 2;
}
function enchantCost(it) { return Math.round((it.value + 40) * ((it.enchants || 0) + 1) * 1.8); }
function enchantItem(it) {
  if (!canEnchant(it)) return false;
  const af = choice(AFFIXES);
  it.affixNames.push(af.name);
  for (const k in af.stats) it.stats[k] = (it.stats[k] || 0) + af.stats[k];
  it.enchants = (it.enchants || 0) + 1;
  it.value = Math.round(it.value * 1.35);
  return true;
}

// ランダムなドロップ品（階層と幸運で質が変動）
function randomLoot(floor, luck, opts = {}) {
  // 種別の重み
  const kindPool = [
    { item: 'weapon', weight: 14 },
    { item: 'armor', weight: 26 },
    { item: 'ring', weight: 8 },
    { item: 'potion', weight: 24 },
    { item: 'treasure', weight: 14 },
    { item: 'torch', weight: 5 },
  ];
  const kind = opts.kind || weightedPick(kindPool);
  let pool;
  if (kind === 'weapon') pool = ITEM_BASES.filter(b => b.slot === 'weapon');
  else if (kind === 'armor') pool = ITEM_BASES.filter(b => ['head', 'chest', 'hands', 'legs'].includes(b.slot));
  else if (kind === 'ring') pool = ITEM_BASES.filter(b => b.slot === 'ring');
  else if (kind === 'potion') pool = ITEM_BASES.filter(b => b.slot === 'potion');
  else if (kind === 'torch') pool = ITEM_BASES.filter(b => b.slot === 'torch');
  else pool = ITEM_BASES.filter(b => b.slot === 'treasure');

  const base = choice(pool);
  if (base.slot === 'potion' || base.slot === 'treasure') {
    return createItem(base.id, 'common');
  }
  if (base.slot === 'torch') return createItem(base.id, 'common');
  return createItem(base.id, rollRarity(luck, floor));
}

// 装備セットから派生ステータス補正を合算
function sumEquipStats(equipment) {
  const sum = {};
  for (const slot in equipment) {
    const it = equipment[slot];
    if (!it || !it.stats) continue;
    for (const k in it.stats) sum[k] = (sum[k] || 0) + it.stats[k];
  }
  return sum;
}
