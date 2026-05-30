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
  spear:  { name: 'スピア',  kind: 'melee',  range: 116, arc: 0.85, base: 11, speed: 0.5, scaling: 'STR', crit: 0.07, color: '#d8d2c0' },
  tome:   { name: '魔導書',  kind: 'magic',  range: 500, base: 10, speed: 0.55, projSpeed: 440, scaling: 'WILL', crit: 0.05, color: '#c77dff' },
  flail:  { name: 'フレイル', kind: 'melee', range: 86, arc: 1.7, base: 13, speed: 0.6, scaling: 'STR', crit: 0.05, knock: 180, color: '#e6cf8a' },
};

// --- スキル定義 ---
// kind: projectile / melee / heal / buff / dash / nova
const SKILLS = {
  // ファイター
  slash_wave:  { name: '斬撃波', icon: '斬', mp: 8,  cd: 2.2, kind: 'projectile', scaling: 'STR', dmg: 1.3, projSpeed: 540, radius: 16, color: '#bfe3ff', pierce: 2, desc: '前方へ斬撃の衝撃波' },
  shield_wall: { name: '守りの構え', icon: '盾', mp: 12, cd: 9, kind: 'buff', stat: 'defense', mult: 1.8, dur: 5, color: '#ffd479', desc: '5秒間 防御大幅UP' },
  // バーバリアン
  whirlwind:   { name: '旋風', icon: '旋', mp: 14, cd: 5, kind: 'nova', scaling: 'STR', dmg: 1.4, radius: 120, color: '#ff8a5b', knock: 260, desc: '周囲を巻き込む回転攻撃' },
  reckless:    { name: '狂戦', icon: '狂', mp: 10, cd: 10, kind: 'buff', stat: 'patk', mult: 1.6, dur: 6, color: '#ff5b5b', desc: '6秒間 攻撃UP（防御は下がる）', selfDef: 0.7 },
  // レンジャー
  multishot:   { name: 'マルチショット', icon: '矢', mp: 12, cd: 3, kind: 'projectile', scaling: 'DEX', dmg: 0.7, projSpeed: 640, radius: 8, color: '#ffe08a', count: 5, spread: 0.5, desc: '扇状に5本の矢' },
  piercing:    { name: '貫通射撃', icon: '貫', mp: 10, cd: 2.5, kind: 'projectile', scaling: 'DEX', dmg: 1.7, projSpeed: 820, radius: 9, color: '#9be8ff', pierce: 99, desc: '敵を貫く高速の一矢' },
  // ローグ
  dash_strike: { name: 'シャドウダッシュ', icon: '影', mp: 8, cd: 3, kind: 'dash', dist: 180, dmg: 1.5, scaling: 'STR', radius: 40, color: '#9b7bff', desc: '高速で踏み込み斬撃' },
  poison_dart: { name: '毒の刃', icon: '毒', mp: 9, cd: 2.5, kind: 'projectile', scaling: 'DEX', dmg: 0.8, projSpeed: 560, radius: 8, color: '#7fe07f', dot: { dmg: 4, dur: 4 }, desc: '毒を付与する投擲' },
  // クレリック
  heal:        { name: 'ヒール', icon: '癒', mp: 14, cd: 4, kind: 'heal', scaling: 'WIS', amount: 28, color: '#aaffcc', desc: 'HPを回復' },
  smite:       { name: 'スマイト', icon: '聖', mp: 12, cd: 2.6, kind: 'projectile', scaling: 'WILL', dmg: 1.5, projSpeed: 500, radius: 18, color: '#fff1a6', holy: true, desc: '聖なる光の弾（アンデッド特効）' },
  // メイジ
  firebolt:    { name: 'ファイアボルト', icon: '炎', mp: 8, cd: 1.4, kind: 'projectile', scaling: 'WILL', dmg: 1.4, projSpeed: 520, radius: 16, color: '#ff7a3c', explode: 46, desc: '着弾で爆発する火球' },
  frost_nova:  { name: 'フロストノヴァ', icon: '氷', mp: 16, cd: 6, kind: 'nova', scaling: 'WILL', dmg: 1.1, radius: 150, color: '#9fe0ff', slow: { mult: 0.4, dur: 3 }, desc: '周囲を凍結させ鈍足化' },
  // パラディン
  shield_bash: { name: 'シールドバッシュ', icon: '打', mp: 10, cd: 4, kind: 'melee', scaling: 'STR', dmg: 1.2, range: 88, arc: 1.8, color: '#ffe08a', stun: 1.3, knock: 240, desc: '敵を殴打してスタン＋ノックバック' },
  // ウォーロック
  life_drain:  { name: 'ライフドレイン', icon: '吸', mp: 12, cd: 2.4, kind: 'projectile', scaling: 'WILL', dmg: 1.3, projSpeed: 460, radius: 16, color: '#c43b6e', lifesteal: 0.5, desc: '与ダメージの半分を吸収' },
  curse_nova:  { name: 'カースノヴァ', icon: '呪', mp: 16, cd: 6, kind: 'nova', scaling: 'WILL', dmg: 1.0, radius: 150, color: '#9b4dff', dot: { dmg: 5, dur: 4 }, slow: { mult: 0.55, dur: 2 }, desc: '周囲に呪い（継続毒＋鈍足）' },
  // ランサー
  charge:      { name: 'チャージ', icon: '突', mp: 8, cd: 3, kind: 'dash', dist: 210, dmg: 1.6, scaling: 'STR', radius: 44, color: '#bfe3ff', knock: 160, desc: '突進して薙ぎ払う' },
  impale:      { name: 'インペイル', icon: '刺', mp: 11, cd: 2.6, kind: 'projectile', scaling: 'DEX', dmg: 1.7, projSpeed: 760, radius: 11, color: '#ffd479', pierce: 99, desc: '敵を貫く高速の刺突' },

  // --- 拡張プール用スキル ---
  cleave:      { name: 'クリーブ', icon: '斧', mp: 9, cd: 2.4, kind: 'melee', scaling: 'STR', dmg: 1.5, range: 96, arc: 2.4, color: '#ffd0a0', knock: 120, desc: '広範囲を薙ぎ払う' },
  rally:       { name: 'ラリー', icon: '鼓', mp: 12, cd: 10, kind: 'buff', stat: 'patk', mult: 1.4, dur: 8, color: '#ffe08a', desc: '8秒間 攻撃UP' },
  leap:        { name: 'リープスマッシュ', icon: '跳', mp: 14, cd: 5, kind: 'dash', dist: 200, dmg: 1.6, scaling: 'STR', radius: 70, color: '#ff8a5b', knock: 220, desc: '跳躍して着地点に衝撃' },
  warcry:      { name: 'ウォークライ', icon: '喊', mp: 12, cd: 11, kind: 'buff', stat: 'defense', mult: 1.6, dur: 7, color: '#ffce6b', selfDef: 1, desc: '7秒間 防御UP＋恐慌' },
  volley:      { name: 'ヴォレイ', icon: '雨', mp: 14, cd: 4, kind: 'projectile', scaling: 'DEX', dmg: 0.6, projSpeed: 600, radius: 7, color: '#ffe08a', count: 7, spread: 0.7, desc: '7本の矢を扇状に乱射' },
  fan_knives:  { name: 'ファンナイフ', icon: '扇', mp: 10, cd: 3, kind: 'projectile', scaling: 'DEX', dmg: 0.7, projSpeed: 620, radius: 7, color: '#e6e6e6', count: 5, spread: 1.0, desc: '短剣を扇状に投擲' },
  smoke:       { name: 'スモーク', icon: '煙', mp: 10, cd: 9, kind: 'buff', stat: 'speed', mult: 1.5, dur: 5, color: '#cfcfe0', desc: '5秒間 高速移動' },
  bless:       { name: 'ブレス', icon: '祝', mp: 12, cd: 10, kind: 'buff', stat: 'patk', mult: 1.35, dur: 9, color: '#fff1a6', desc: '9秒間 攻撃UP' },
  holy_nova:   { name: 'ホーリーノヴァ', icon: '光', mp: 16, cd: 6, kind: 'nova', scaling: 'WIS', dmg: 1.2, radius: 150, color: '#fff1a6', holy: true, desc: '聖光で周囲を浄化（アンデッド特効）' },
  arcane_orb:  { name: 'アーケインオーブ', icon: '球', mp: 12, cd: 2, kind: 'projectile', scaling: 'WILL', dmg: 1.6, projSpeed: 360, radius: 14, color: '#7f9fff', pierce: 99, desc: 'ゆっくり進む貫通の魔力球' },
  blink:       { name: 'ブリンク', icon: '瞬', mp: 8, cd: 4, kind: 'dash', dist: 240, dmg: 0.6, scaling: 'WILL', radius: 30, color: '#9fd0ff', desc: '瞬間移動で間合いを取る' },
  shadow_bolt: { name: 'シャドウボルト', icon: '闇', mp: 9, cd: 1.6, kind: 'projectile', scaling: 'WILL', dmg: 1.4, projSpeed: 480, radius: 14, color: '#9b4dff', desc: '闇の弾を放つ' },
  sweep:       { name: 'スイープ', icon: '薙', mp: 10, cd: 2.6, kind: 'melee', scaling: 'STR', dmg: 1.4, range: 124, arc: 1.4, color: '#d8d2c0', knock: 100, desc: '槍で遠く広く薙ぐ' },
};

// 各職業のスキルプール（タウンで2つ選んで装備）
const CLASS_SKILL_POOL = {
  fighter:   ['slash_wave', 'shield_wall', 'cleave', 'rally'],
  barbarian: ['whirlwind', 'reckless', 'leap', 'warcry'],
  ranger:    ['multishot', 'piercing', 'volley', 'smoke'],
  rogue:     ['dash_strike', 'poison_dart', 'fan_knives', 'smoke'],
  cleric:    ['heal', 'smite', 'bless', 'holy_nova'],
  mage:      ['firebolt', 'frost_nova', 'arcane_orb', 'blink'],
  paladin:   ['shield_bash', 'smite', 'heal', 'holy_nova'],
  warlock:   ['life_drain', 'curse_nova', 'shadow_bolt', 'bless'],
  lancer:    ['charge', 'impale', 'sweep', 'leap'],
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
  paladin: {
    name: 'パラディン', color: '#f0e2a8', weapon: 'flail', blurb: '重装の聖騎士。スタンと聖法で前線を支配。',
    base: { STR: 14, VIG: 15, AGI: 7, DEX: 8, WILL: 9, WIS: 12, LUCK: 7 },
    skills: ['shield_bash', 'smite'],
  },
  warlock: {
    name: 'ウォーロック', color: '#a05bd6', weapon: 'tome', blurb: '闇の魔導士。吸命と呪いで粘り強く削る。',
    base: { STR: 8, VIG: 11, AGI: 9, DEX: 8, WILL: 16, WIS: 11, LUCK: 9 },
    skills: ['life_drain', 'curse_nova'],
  },
  lancer: {
    name: 'ランサー', color: '#5ab0a0', weapon: 'spear', blurb: '間合いの長い槍使い。突進と刺突で制圧。',
    base: { STR: 13, VIG: 12, AGI: 13, DEX: 13, WILL: 7, WIS: 7, LUCK: 9 },
    skills: ['charge', 'impale'],
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
  { id: 'w_spear', name: 'ウォースピア', slot: 'weapon', wtype: 'spear', value: 44, stats: { patk: 8, DEX: 1 } },
  { id: 'w_tome', name: 'カースグリモア', slot: 'weapon', wtype: 'tome', value: 48, stats: { matk: 9, WILL: 2 } },
  { id: 'w_flail', name: 'ホーリーフレイル', slot: 'weapon', wtype: 'flail', value: 50, stats: { patk: 11, WIS: 1 } },
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
  { name: 'の吸血', stats: { lifesteal: 0.04 } },
];

// レジェンダリ固有効果（強力・1つ付与）
const UNIQUE_AFFIXES = [
  { name: '【吸血鬼】', stats: { lifesteal: 0.09 } },
  { name: '【疾風】', stats: { AGI: 5 } },
  { name: '【巨人】', stats: { STR: 5, hpmax: 35 } },
  { name: '【賢者】', stats: { WILL: 5, mpmax: 25 } },
  { name: '【処刑人】', stats: { crit: 0.1 } },
  { name: '【守護神】', stats: { defense: 8, hpmax: 25 } },
  { name: '【幸運】', stats: { LUCK: 6 } },
];

// --- 実績 ---
const ACHIEVEMENTS = {
  first_extract: { name: '生還者', desc: '初めてダンジョンから脱出する' },
  boss_slayer: { name: 'ボスキラー', desc: 'ボスを討伐する' },
  legendary: { name: '伝説の発見', desc: 'レジェンダリ装備を入手する' },
  lvl10: { name: '熟練者', desc: 'レベル10に到達する' },
  rich: { name: '富豪', desc: '所持ゴールド1000以上' },
  elite10: { name: 'エリートハンター', desc: 'エリートを通算10体討伐' },
  deep: { name: '深層探索者', desc: '第3層に到達する' },
  rival_slayer: { name: '果たし合い', desc: 'ライバル冒険者を討伐する' },
};

// --- 依頼（バウンティ）生成 ---
function generateBounties() {
  const pool = [
    () => ({ type: 'kills', target: randInt(15, 30), desc: '敵を{n}体討伐する', reward: 130 }),
    () => ({ type: 'extract', target: randInt(2, 4), desc: '{n}回 脱出に成功する', reward: 160 }),
    () => ({ type: 'boss', target: 1, desc: 'ボスを討伐する', reward: 220 }),
    () => ({ type: 'floor', target: 3, desc: '第3層に到達する', reward: 190 }),
    () => ({ type: 'rarity', target: 1, desc: 'レア以上の装備を持ち帰る', reward: 170 }),
    () => ({ type: 'elite', target: randInt(3, 6), desc: 'エリートを{n}体討伐する', reward: 180 }),
    () => ({ type: 'rival', target: 1, desc: 'ライバル冒険者を討伐する', reward: 240 }),
  ];
  return shuffle(pool.slice()).slice(0, 3).map(f => {
    const b = f(); b.progress = 0; b.done = false; b.claimed = false; b.id = uid();
    b.label = b.desc.replace('{n}', b.target);
    return b;
  });
}

// --- エリート修飾子 ---
const ELITE_MODS = [
  { name: '迅速の', color: '#7fe0ff', hp: 1.2, atk: 1.0, speed: 1.45, size: 0.95 },
  { name: '巨躯の', color: '#ff9a5b', hp: 2.0, atk: 1.4, speed: 0.85, size: 1.4 },
  { name: '灼熱の', color: '#ff5b3c', hp: 1.3, atk: 1.1, speed: 1.0, size: 1.05, onHit: { dot: { dmg: 5, dur: 3 } } },
  { name: '猛毒の', color: '#7fe07f', hp: 1.3, atk: 1.0, speed: 1.0, size: 1.05, onHit: { slow: { mult: 0.5, dur: 2.5 }, dot: { dmg: 3, dur: 4 } } },
  { name: '再生の', color: '#5fe0c0', hp: 1.6, atk: 1.1, speed: 0.95, size: 1.1, regen: 0.02 },
  { name: '魔導の', color: '#c77dff', hp: 1.3, atk: 1.5, speed: 1.0, size: 1.0 },
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
  spider:     { name: '大蜘蛛', hp: 32, atk: 9, def: 2, speed: 104, r: 14, behavior: 'melee', range: 44, sight: 360, color: '#6b4a6b', xp: 15, web: true, gold: [3, 9] },
  skel_knight:{ name: 'スケルトン騎士', hp: 96, atk: 17, def: 9, speed: 70, r: 16, behavior: 'melee', range: 52, sight: 400, color: '#b9c0cc', xp: 30, undead: true, gold: [10, 26] },
  imp:        { name: 'インプ', hp: 18, atk: 11, def: 1, speed: 116, r: 11, behavior: 'ranged', range: 380, sight: 420, projSpeed: 420, color: '#e0593c', xp: 14, magic: true, gold: [4, 12] },
  wraith:     { name: '幽鬼', hp: 42, atk: 15, def: 3, speed: 122, r: 14, behavior: 'ranged', range: 420, sight: 480, projSpeed: 360, color: '#7fb0c0', xp: 24, undead: true, magic: true, gold: [6, 18] },
  // ボス
  lich:       { name: '【ボス】リッチ王', hp: 360, atk: 22, def: 8, speed: 70, r: 22, behavior: 'ranged', range: 520, sight: 700, projSpeed: 380, color: '#caa6ff', xp: 160, undead: true, boss: true, gold: [120, 240] },
  ogre:       { name: '【ボス】オーガ', hp: 480, atk: 28, def: 10, speed: 84, r: 26, behavior: 'melee', range: 70, sight: 600, color: '#a05a3a', xp: 180, boss: true, gold: [140, 280] },
  necromancer:{ name: '【ボス】ネクロマンサー', hp: 420, atk: 20, def: 7, speed: 66, r: 22, behavior: 'ranged', range: 500, sight: 720, projSpeed: 360, color: '#7d5bd6', xp: 200, undead: true, boss: true, summon: true, gold: [150, 300] },
  // ライバル冒険者（PvPvE風味：徘徊し、敵と戦い戦利品を奪い合う）
  rival:      { name: 'ライバル冒険者', hp: 130, atk: 17, def: 6, speed: 122, r: 14, behavior: 'rival', range: 380, sight: 520, projSpeed: 560, color: '#d0d0d0', xp: 90, rival: true, gold: [30, 70] },
};
