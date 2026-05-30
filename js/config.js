// ============================================================
// config.js — グローバル定数・バランス設定
// ============================================================
const CONFIG = {
  // 論理解像度（横持ち）。縦(BASE_H)を基準にズームを一定化し、横は画面比で可変にする。
  BASE_H: 720,
  VIEW_W: 1280,
  VIEW_H: 720,

  TILE: 48,            // タイル1マスのピクセル
  WALL_H: 22,          // 擬似3D：壁の前面の高さ
  PLAYER_R: 14,        // プレイヤー当たり半径

  // 視界
  BASE_VISION: 2.4,    // トーチ無し基礎視界（タイル）
  TORCH_VISION: 6.2,   // トーチありの視界（タイル）
  CONE_DEG: 115,       // 前方視界コーンの角度
  BACK_GLOW: 1.3,      // 背後・足元のうっすら見える半径（タイル）

  // 経済・育成
  POINTS_PER_LEVEL: 3,
  XP_BASE: 100,        // Lv1→2 に必要なEXP
  XP_GROWTH: 1.35,

  // スロット
  POTION_SLOTS: 2,
  // バッグ（マス制インベントリ）
  BAG_W: 6, BAG_H: 4,

  // バランス
  DEFENSE_K: 60,       // ダメージ軽減の係数
};

// ステータス（一次パラメータ）定義
const ATTRS = [
  { key: 'STR',  name: '筋力',   desc: '近接物理ダメージ / 所持重量' },
  { key: 'VIG',  name: '体力',   desc: '最大HP' },
  { key: 'AGI',  name: '敏捷',   desc: '移動速度 / 攻撃速度 / 回避' },
  { key: 'DEX',  name: '器用',   desc: '遠隔物理 / 命中 / 会心率' },
  { key: 'WILL', name: '意志',   desc: '魔法ダメージ / 最大MP' },
  { key: 'WIS',  name: '精神',   desc: '回復力 / MP回復 / 魔法耐性' },
  { key: 'LUCK', name: '幸運',   desc: 'レア率 / 会心ダメージ' },
];

// レアリティ
const RARITY = {
  poor:      { name: 'ありふれた', color: '#9aa0a6', weight: 24, mult: 0.6, affixes: 0 },
  common:    { name: 'コモン',     color: '#e8eaed', weight: 40, mult: 1.0, affixes: 0 },
  uncommon:  { name: 'アンコモン', color: '#5fd35f', weight: 22, mult: 1.25, affixes: 1 },
  rare:      { name: 'レア',       color: '#4ea3ff', weight: 10, mult: 1.6, affixes: 2 },
  epic:      { name: 'エピック',   color: '#b061ff', weight: 3.5, mult: 2.1, affixes: 3 },
  legendary: { name: 'レジェンド', color: '#ff9f1c', weight: 0.8, mult: 2.8, affixes: 4 },
};
const RARITY_ORDER = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'];
