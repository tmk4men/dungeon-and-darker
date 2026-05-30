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
    affixNames: [],
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
  }
  // 売却価値（レア＆アフィックスで増加）
  it.value = Math.round(base.value * (0.6 + r.mult * 0.7) * (1 + it.affixNames.length * 0.25));
  return it;
}

function itemDisplayName(it) {
  if (!it) return '';
  return it.name + (it.affixNames.length ? ' ' + it.affixNames.join('') : '');
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
