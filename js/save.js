// ============================================================
// save.js — プロフィール管理・ステータス計算・永続化
// ============================================================
const SAVE_KEY = 'dad_save_v1';

function newProfile(classId) {
  const cls = CLASSES[classId];
  const p = {
    version: 1,
    classId,
    gold: 80,
    level: 1, xp: 0, points: 0,
    loadout: (CLASS_SKILL_POOL[classId] || cls.skills).slice(0, 3), // 装備スキル（最大3）
    baseAttrs: { ...cls.base },          // 職業基礎＋レベルで割り振った分
    equipment: { weapon: null, head: null, chest: null, hands: null, legs: null, ring: null, torch: null },
    potions: new Array(CONFIG.POTION_SLOTS).fill(null),
    stash: newStash(),
    runStats: { runs: 0, extracts: 0, deaths: 0, kills: 0, gold: 0, elites: 0 },
    achievements: {},
    bounties: [],
    rebirths: 0,        // 転生（解脱）回数 = NG+
    merit: 0,           // 徳ポイント（解脱で獲得）
    virtues: {},        // 購入した徳（id→段数）
  };
  // 初期装備：職業の標準武器＋トーチ＋ポーション
  const wmap = { sword: 'w_sword', hammer: 'w_hammer', dagger: 'w_dagger', mace: 'w_mace', bow: 'w_bow', staff: 'w_staff', spear: 'w_spear', tome: 'w_tome', flail: 'w_flail' };
  p.equipment.weapon = createItem(wmap[cls.weapon], 'common');
  p.equipment.torch = createItem('t_torch', 'common');
  p.equipment.chest = createItem(['staff', 'tome'].includes(cls.weapon) ? 'a_robe' : 'a_tunic', 'common');
  p.potions[0] = createItem('p_hp', 'common');
  if (['mage', 'cleric'].includes(classId)) p.potions[1] = createItem('p_mp', 'common');
  bagAddItem(p.stash, createItem('p_hp', 'common'));
  return p;
}

function xpForLevel(lv) { return Math.round(CONFIG.XP_BASE * Math.pow(CONFIG.XP_GROWTH, lv - 1)); }

function grantXP(p, amount) {
  p.xp += amount;
  let leveled = 0;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    p.points += CONFIG.POINTS_PER_LEVEL;
    leveled++;
  }
  return leveled;
}

// プロフィールから派生ステータスを計算
function computeDerived(p) {
  const cls = CLASSES[p.classId];
  const equip = sumEquipStats(p.equipment);
  // 徳（永続パッシブ）
  const vVit = virtueLv(p, 'vitality'), vSwift = virtueLv(p, 'swift'), vEnd = virtueLv(p, 'endure'), vFor = virtueLv(p, 'fortune');
  // 一次ステータス = 基礎割り振り + 装備補正 + 徳（福徳=幸運）
  const attr = {};
  for (const a of ATTRS) attr[a.key] = (p.baseAttrs[a.key] || 0) + (equip[a.key] || 0);
  attr.LUCK += vFor * 3;

  const weapon = p.equipment.weapon;
  const wtype = weapon ? WEAPON_TYPES[weapon.wtype] : WEAPON_TYPES[cls.weapon];

  // 重量 → 移動速度。STRで許容重量が増え、超過すると減速。
  const weight = sumWeight(p.equipment);
  const weightCap = 14 + attr.STR * 0.9;
  const over = Math.max(0, weight - weightCap);
  const encPenalty = clamp(over * 0.04, 0, 0.55);

  const d = {
    attr,
    wtype, weaponItem: weapon,
    weight, weightCap, encPenalty, encumbered: over > 0,
    hpmax: Math.round((60 + attr.VIG * 8 + (equip.hpmax || 0)) * (1 + vVit * 0.08)),
    mpmax: Math.round(36 + attr.WILL * 4 + attr.WIS * 2 + (equip.mpmax || 0)),
    patkFlat: (equip.patk || 0),
    matkFlat: (equip.matk || 0),
    defense: Math.round(attr.VIG * 0.3 + (equip.defense || 0)),
    speed: 130 * (1 + attr.AGI * 0.02) * (1 - encPenalty) * (1 + vSwift * 0.04),
    damageReduce: clamp(vEnd * 0.05, 0, 0.4),
    atkSpeedMult: 1 / (1 + attr.AGI * 0.022),
    crit: clamp((wtype.crit || 0) + attr.DEX * 0.004 + attr.LUCK * 0.003 + (equip.crit || 0), 0, 0.75),
    critDmg: 1.5 + attr.LUCK * 0.02,
    dodge: clamp(attr.AGI * 0.004, 0, 0.4),
    mpregen: 3.2 + attr.WIS * 0.26,
    healPow: 1 + attr.WIS * 0.05,
    magicResist: clamp(attr.WIS * 0.006, 0, 0.5),
    lifesteal: equip.lifesteal || 0,
    hasTorch: !!p.equipment.torch,
  };
  d.vision = (d.hasTorch ? CONFIG.TORCH_VISION : CONFIG.BASE_VISION);
  return d;
}

// 攻撃力（scaling属性で伸びる威力）
function attackPower(d, scaling) {
  const wt = d.wtype;
  const attrV = d.attr[scaling] || 0;
  if (scaling === 'WILL') return (wt.base + d.matkFlat) * (1 + attrV * 0.06);
  return (wt.base + d.patkFlat) * (1 + attrV * 0.055);
}

// 永続化
function saveProfile(p) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) { console.warn('save failed', e); }
}
function loadProfile() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function deleteProfile() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
