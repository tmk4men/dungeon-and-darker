// ============================================================
// data.js — 職業 / スキル / 武器 / アイテム / 敵 のデータベース
// ============================================================

// --- 武器カテゴリ（標準武器のノーマル攻撃を定義） ---
// scaling: どの一次ステータスでダメージが伸びるか
const WEAPON_TYPES = {
  sword:  { name: '剣',     kind: 'melee',  range: 78,  arc: 1.5, base: 9,  speed: 0.42, scaling: 'STR', crit: 0.05, color: '#dfe6ee' },
  hammer: { name: 'ウォーハンマー', kind: 'melee', range: 78, arc: 1.9, base: 15, speed: 0.72, scaling: 'STR', crit: 0.04, knock: 220, color: '#c9a06a' },
  dagger: { name: '短剣',   kind: 'melee',  range: 56,  arc: 1.2, base: 6,  speed: 0.26, scaling: 'STR', crit: 0.18, color: '#e6e6e6' },
  mace:   { name: 'メイス', kind: 'melee',  range: 70,  arc: 1.5, base: 11, speed: 0.5,  scaling: 'STR', crit: 0.05, color: '#d9c27a' },
  bow:    { name: '弓',     kind: 'ranged', range: 560, base: 8,  speed: 0.46, projSpeed: 620, scaling: 'DEX', crit: 0.1, color: '#caa15a' },
  staff:  { name: '魔法の杖', kind: 'magic', range: 520, base: 9, speed: 0.5, projSpeed: 480, scaling: 'WILL', crit: 0.06, color: '#7fd3ff' },
};

// --- スキル定義 ---
// kind: projectile / melee / heal / buff / dash / nova
const SKILLS = {
  // ファイター
  slash_wave:  { name: '斬撃波', icon: '🌀', mp: 8,  cd: 2.2, kind: 'projectile', scaling: 'STR', dmg: 1.3, projSpeed: 540, radius: 16, color: '#bfe3ff', pierce: 2, desc: '前方へ斬撃の衝撃波' },
  shield_wall: { name: '守りの構え', icon: '🛡️', mp: 12, cd: 9, kind: 'buff', stat: 'defense', mult: 1.8, dur: 5, color: '#ffd479', desc: '5秒間 防御大幅UP' },
  // バーバリアン
  whirlwind:   { name: '旋風', icon: '💨', mp: 14, cd: 5, kind: 'nova', scaling: 'STR', dmg: 1.4, radius: 120, color: '#ff8a5b', knock: 260, desc: '周囲を巻き込む回転攻撃' },
  reckless:    { name: '狂戦', icon: '🔥', mp: 10, cd: 10, kind: 'buff', stat: 'patk', mult: 1.6, dur: 6, color: '#ff5b5b', desc: '6秒間 攻撃UP（防御は下がる）', selfDef: 0.7 },
  // レンジャー
  multishot:   { name: 'マルチショット', icon: '🏹', mp: 12, cd: 3, kind: 'projectile', scaling: 'DEX', dmg: 0.7, projSpeed: 640, radius: 8, color: '#ffe08a', count: 5, spread: 0.5, desc: '扇状に5本の矢' },
  piercing:    { name: '貫通射撃', icon: '➶', mp: 10, cd: 2.5, kind: 'projectile', scaling: 'DEX', dmg: 1.7, projSpeed: 820, radius: 9, color: '#9be8ff', pierce: 99, desc: '敵を貫く高速の一矢' },
  // ローグ
  dash_strike: { name: 'シャドウダッシュ', icon: '🌑', mp: 8, cd: 3, kind: 'dash', dist: 180, dmg: 1.5, scaling: 'STR', radius: 40, color: '#9b7bff', desc: '高速で踏み込み斬撃' },
  poison_dart: { name: '毒の刃', icon: '☠️', mp: 9, cd: 2.5, kind: 'projectile', scaling: 'DEX', dmg: 0.8, projSpeed: 560, radius: 8, color: '#7fe07f', dot: { dmg: 4, dur: 4 }, desc: '毒を付与する投擲' },
  // クレリック
  heal:        { name: 'ヒール', icon: '✨', mp: 14, cd: 4, kind: 'heal', scaling: 'WIS', amount: 28, color: '#aaffcc', desc: 'HPを回復' },
  smite:       { name: 'スマイト', icon: '⚡', mp: 12, cd: 2.6, kind: 'projectile', scaling: 'WILL', dmg: 1.5, projSpeed: 500, radius: 18, color: '#fff1a6', holy: true, desc: '聖なる光の弾（アンデッド特効）' },
  // メイジ
  firebolt:    { name: 'ファイアボルト', icon: '🔥', mp: 8, cd: 1.4, kind: 'projectile', scaling: 'WILL', dmg: 1.4, projSpeed: 520, radius: 16, color: '#ff7a3c', explode: 46, desc: '着弾で爆発する火球' },
  frost_nova:  { name: 'フロストノヴァ', icon: '❄️', mp: 16, cd: 6, kind: 'nova', scaling: 'WILL', dmg: 1.1, radius: 150, color: '#9fe0ff', slow: { mult: 0.4, dur: 3 }, desc: '周囲を凍結させ鈍足化' },
};

// --- 職業 ---
const CLASSES = {
  fighter: {
    name: 'ファイター', color: '#d9c27a', weapon: 'sword', blurb: 'バランス型の近接万能職。扱いやすい。',
    base: { STR: 14, VIG: 13, AGI: 10, DEX: 10, WILL: 7, WIS: 8, LUCK: 8 },
    skills: ['slash_wave', 'shield_wall'],
  },
  barbarian: {
    name: 'バーバリアン', color: '#c0683a', weapon: 'hammer', blurb: '高HP高火力・低速の脳筋。一撃が重い。',
    base: { STR: 17, VIG: 16, AGI: 7, DEX: 8, WILL: 5, WIS: 6, LUCK: 8 },
    skills: ['whirlwind', 'reckless'],
  },
  ranger: {
    name: 'レンジャー', color: '#6fae5a', weapon: 'bow', blurb: '遠距離物理。カイトで安全に削る。',
    base: { STR: 9, VIG: 10, AGI: 13, DEX: 16, WILL: 7, WIS: 8, LUCK: 9 },
    skills: ['multishot', 'piercing'],
  },
  rogue: {
    name: 'ローグ', color: '#7b6bb0', weapon: 'dagger', blurb: '高速・会心特化の暗殺者。背後から刺す。',
    base: { STR: 11, VIG: 9, AGI: 16, DEX: 14, WILL: 7, WIS: 7, LUCK: 12 },
    skills: ['dash_strike', 'poison_dart'],
  },
  cleric: {
    name: 'クレリック', color: '#e7d9a0', weapon: 'mace', blurb: '回復と聖法。粘り強く対アンデッド。',
    base: { STR: 12, VIG: 13, AGI: 8, DEX: 8, WILL: 11, WIS: 14, LUCK: 8 },
    skills: ['heal', 'smite'],
  },
  mage: {
    name: 'メイジ', color: '#6aa9ff', weapon: 'staff', blurb: '高火力魔法・低耐久。MP管理が鍵。',
    base: { STR: 7, VIG: 8, AGI: 9, DEX: 8, WILL: 18, WIS: 12, LUCK: 9 },
    skills: ['firebolt', 'frost_nova'],
  },
};

// --- アイテムベース ---
// slot: weapon/head/chest/hands/legs/ring/torch/potion/treasure
const ITEM_BASES = [
  // 武器（職業の標準カテゴリに対応）
  { id: 'w_sword', name: 'ロングソード', slot: 'weapon', wtype: 'sword', value: 40, stats: { patk: 6 } },
  { id: 'w_hammer', name: 'ウォーハンマー', slot: 'weapon', wtype: 'hammer', value: 48, stats: { patk: 10 } },
  { id: 'w_dagger', name: 'ダガー', slot: 'weapon', wtype: 'dagger', value: 32, stats: { patk: 4, crit: 0.04 } },
  { id: 'w_mace', name: 'ホーリーメイス', slot: 'weapon', wtype: 'mace', value: 44, stats: { patk: 7 } },
  { id: 'w_bow', name: 'ハンターボウ', slot: 'weapon', wtype: 'bow', value: 42, stats: { patk: 6, DEX: 2 } },
  { id: 'w_staff', name: 'アーケインスタッフ', slot: 'weapon', wtype: 'staff', value: 46, stats: { matk: 8, WILL: 2 } },
  // 防具
  { id: 'a_helm', name: 'アイアンヘルム', slot: 'head', value: 22, stats: { defense: 4, VIG: 1 } },
  { id: 'a_hood', name: 'レザーフード', slot: 'head', value: 16, stats: { defense: 2, AGI: 1 } },
  { id: 'a_plate', name: 'プレートメイル', slot: 'chest', value: 40, stats: { defense: 9, AGI: -1 } },
  { id: 'a_robe', name: 'ローブ', slot: 'chest', value: 30, stats: { defense: 3, WILL: 2, mpmax: 10 } },
  { id: 'a_tunic', name: 'レザーチュニック', slot: 'chest', value: 26, stats: { defense: 5, AGI: 1 } },
  { id: 'a_gloves', name: 'ガントレット', slot: 'hands', value: 18, stats: { defense: 3, STR: 1 } },
  { id: 'a_greaves', name: 'グリーヴ', slot: 'legs', value: 20, stats: { defense: 4, AGI: 1 } },
  // 装飾
  { id: 'r_ring', name: '銀の指輪', slot: 'ring', value: 28, stats: { LUCK: 2 } },
  { id: 'r_amulet', name: '魔力の護符', slot: 'ring', value: 34, stats: { WILL: 2, mpmax: 8 } },
  // トーチ
  { id: 't_torch', name: 'トーチ', slot: 'torch', value: 10, stats: {} },
  // 消費
  { id: 'p_hp', name: 'HPポーション', slot: 'potion', value: 16, potion: { hp: 60 } },
  { id: 'p_hp_l', name: '大HPポーション', slot: 'potion', value: 34, potion: { hp: 140 } },
  { id: 'p_mp', name: 'MPポーション', slot: 'potion', value: 16, potion: { mp: 50 } },
  { id: 'p_mp_l', name: '大MPポーション', slot: 'potion', value: 34, potion: { mp: 120 } },
  // 財宝（売却専用）
  { id: 'tr_coin', name: '金貨の袋', slot: 'treasure', value: 60, stats: {} },
  { id: 'tr_gem', name: 'ルビー', slot: 'treasure', value: 120, stats: {} },
  { id: 'tr_goblet', name: '黄金の杯', slot: 'treasure', value: 200, stats: {} },
  { id: 'tr_crown', name: '王の宝冠', slot: 'treasure', value: 450, stats: {} },
];

// アフィックス（接頭/接尾でステータス付与）
const AFFIXES = [
  { name: 'の力', stats: { STR: 2 } }, { name: 'の活力', stats: { VIG: 2 } },
  { name: 'の俊敏', stats: { AGI: 2 } }, { name: 'の精密', stats: { DEX: 2 } },
  { name: 'の知性', stats: { WILL: 2 } }, { name: 'の信仰', stats: { WIS: 2 } },
  { name: 'の幸運', stats: { LUCK: 2 } }, { name: 'の守護', stats: { defense: 3 } },
  { name: 'の鋭さ', stats: { patk: 3 } }, { name: 'の魔導', stats: { matk: 3 } },
  { name: 'の致命', stats: { crit: 0.05 } }, { name: 'の生命', stats: { hpmax: 18 } },
];

// --- 敵 ---
// behavior: melee / ranged ; speed: px/s
const ENEMIES = {
  skeleton:   { name: 'スケルトン', hp: 34, atk: 9, def: 3, speed: 78, r: 14, behavior: 'melee', range: 48, sight: 360, color: '#dfe2e6', xp: 14, undead: true, gold: [2, 8] },
  skel_archer:{ name: 'スケルトン弓兵', hp: 26, atk: 11, def: 2, speed: 64, r: 14, behavior: 'ranged', range: 420, sight: 460, projSpeed: 360, color: '#c9d6c0', xp: 18, undead: true, gold: [3, 10] },
  zombie:     { name: 'ゾンビ', hp: 70, atk: 13, def: 4, speed: 42, r: 16, behavior: 'melee', range: 50, sight: 300, color: '#7c9a6b', xp: 20, undead: true, gold: [2, 7] },
  slime:      { name: 'スライム', hp: 28, atk: 7, def: 1, speed: 56, r: 15, behavior: 'melee', range: 44, sight: 280, color: '#5fd3c0', xp: 10, split: true, gold: [1, 5] },
  bat:        { name: 'コウモリ', hp: 16, atk: 6, def: 0, speed: 130, r: 11, behavior: 'melee', range: 36, sight: 340, color: '#6b5b8a', xp: 9, gold: [1, 4] },
  goblin:     { name: 'ゴブリン', hp: 40, atk: 12, def: 3, speed: 92, r: 14, behavior: 'melee', range: 46, sight: 380, color: '#7faf55', xp: 16, gold: [4, 14] },
  warlock:    { name: 'ダークメイジ', hp: 44, atk: 16, def: 3, speed: 60, r: 14, behavior: 'ranged', range: 480, sight: 500, projSpeed: 320, color: '#b061ff', xp: 26, magic: true, gold: [8, 22] },
  // ボス
  lich:       { name: '【ボス】リッチ王', hp: 360, atk: 22, def: 8, speed: 70, r: 22, behavior: 'ranged', range: 520, sight: 700, projSpeed: 380, color: '#caa6ff', xp: 160, undead: true, boss: true, gold: [120, 240] },
  ogre:       { name: '【ボス】オーガ', hp: 480, atk: 28, def: 10, speed: 84, r: 26, behavior: 'melee', range: 70, sight: 600, color: '#a05a3a', xp: 180, boss: true, gold: [140, 280] },
};
