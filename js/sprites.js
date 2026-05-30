// ============================================================
// sprites.js — ドット絵スプライト（手描きビットマップ＋パレット）
//   キー: O輪郭 M主色 D影 H光 S肌 s肌影 E目 A金 W骨/牙 w骨影 f血/口 G光彩
// ============================================================
const Sprites = {
  cache: {},

  palette(col) {
    return {
      '.': null,
      'O': '#140d07',
      'M': col,
      'D': shade(col, -0.4),
      'H': shade(col, 0.34),
      'S': '#e8c79c', 's': '#c39a6e', 'E': '#1c120a',
      'A': '#d8b15a', 'a': '#9c7f38',
      'W': '#ece9dc', 'w': '#9a978a', 'f': '#b83038', 'G': '#fff3c0',
      'k': '#2a2330', 'x': '#34303f', 'r': '#c23a2c', 'B': '#7fb2e8',
    };
  },

  // 行幅は自動でパディング（最大幅に揃える）
  make(key, rows, col) {
    const ck = key + '|' + col;
    if (this.cache[ck]) return this.cache[ck];
    const pal = this.palette(col);
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const color = pal[row[x]];
        if (color) { c.fillStyle = color; c.fillRect(x, y, 1, 1); }
      }
    }
    cv._w = w; cv._h = h;
    this.cache[ck] = cv;
    return cv;
  },

  // 職業ごとのスプライト
  player(classId) {
    const cls = CLASSES[classId];
    if (!cls) return this.make('monk', SPR.monk, classId || '#d9c27a');
    const tmpl = CLASS_SPRITE[classId] || 'monk';
    return this.make(tmpl, SPR[tmpl], cls.color);
  },

  enemy(type) {
    const def = ENEMIES[type];
    const m = ENEMY_SPRITE[type] || { t: 'demon' };
    return this.make(m.t, SPR[m.t], def.color);
  },

  templateOf(type) { return (ENEMY_SPRITE[type] || { t: 'demon' }).t; },
  get(tmpl, col) { return this.make(tmpl, SPR[tmpl], col); },

  // アイテムアイコン（常に16x16の中央へ＝並びが揃う）
  makeIcon(key) {
    const ck = 'ic|' + key;
    if (this.cache[ck]) return this.cache[ck];
    const rows = ICONS[key] || ICONS.coin;
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const S = 16, ox = Math.floor((S - w) / 2), oy = Math.floor((S - h) / 2);
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) { const col = ICON_PAL[row[x]]; if (col) { c.fillStyle = col; c.fillRect(x + ox, y + oy, 1, 1); } }
    }
    cv._w = S; cv._h = S; this.cache[ck] = cv; return cv;
  },

  // realm別タイル（16px低解像度→拡大でドット感。床3種＋壁上面）
  realmTiles(theme) {
    const ck = 'tiles|' + theme.name;
    if (this.cache[ck]) return this.cache[ck];
    const S = 16;
    const seeded = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
    const mk = (base, base2, seed, isWall) => {
      const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const c = cv.getContext('2d');
      const rnd = seeded(seed);
      c.fillStyle = base; c.fillRect(0, 0, S, S);
      // 石積み（互い違いの目地）
      c.fillStyle = base2;
      c.fillRect(1, 1, S - 2, 6); c.fillRect(1, 9, 6, 6); c.fillRect(9, 9, 6, 6);
      c.fillStyle = 'rgba(0,0,0,0.32)';
      c.fillRect(0, 0, S, 1); c.fillRect(0, 8, S, 1); c.fillRect(0, 15, S, 1);
      c.fillRect(0, 0, 1, 8); c.fillRect(8, 0, 1, 8); c.fillRect(4, 8, 1, 8); c.fillRect(12, 8, 1, 8);
      // ノイズ
      for (let i = 0; i < 16; i++) { const x = (rnd() * S) | 0, y = (rnd() * S) | 0; c.fillStyle = rnd() > 0.55 ? 'rgba(255,250,235,0.06)' : 'rgba(0,0,0,0.14)'; c.fillRect(x, y, 1, 1); }
      // realmアクセント
      const at = theme.accentType;
      if (at === 'lava' && !isWall) { for (let i = 0; i < 6; i++) { const x = (rnd() * S) | 0, y = (rnd() * S) | 0; c.fillStyle = rnd() > 0.5 ? '#ff7a3c' : '#b83518'; c.fillRect(x, y, 1, 1); } }
      else if (at === 'frost') { for (let i = 0; i < 7; i++) { const x = (rnd() * S) | 0, y = (rnd() * S) | 0; c.fillStyle = 'rgba(207,234,255,0.55)'; c.fillRect(x, y, 1, 1); } }
      else if (at === 'earth') { for (let i = 0; i < 5; i++) { const x = (rnd() * S) | 0, y = (rnd() * S) | 0; c.fillStyle = 'rgba(120,90,50,0.4)'; c.fillRect(x, y, 1, 1); } }
      cv._w = S; cv._h = S; return cv;
    };
    const res = {
      floors: [mk(theme.floorA, theme.floorB, 7, false), mk(theme.floorB, theme.floorA, 31, false), mk(theme.floorA, theme.floorB, 53, false)],
      wallTop: mk(theme.wallTop, theme.wallTopHi, 101, true),
    };
    this.cache[ck] = res; return res;
  },
  iconCanvas(item) { return this.makeIcon(iconKey(item)); },
  coinURL() {
    if (this._coinURL !== undefined) return this._coinURL;
    const cv = this.makeIcon('coin'); let u = '';
    try { if (cv.toDataURL) u = cv.toDataURL(); } catch (e) { u = ''; }
    this._coinURL = u; return u;
  },
  iconURL(item) {
    const key = iconKey(item), ck = 'url|' + key;
    this._urls = this._urls || {};
    if (this._urls[ck] !== undefined) return this._urls[ck];
    const cv = this.makeIcon(key); let url = '';
    try { if (cv.toDataURL) url = cv.toDataURL(); } catch (e) { url = ''; }
    this._urls[ck] = url; return url;
  },

  // 被弾点滅用の白シルエット（テンプレ単位でキャッシュ）
  flash(tmpl) {
    const ck = 'flash|' + tmpl;
    if (this.cache[ck]) return this.cache[ck];
    const rows = SPR[tmpl], h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (rows[y][x] !== '.') { c.fillStyle = '#fff'; c.fillRect(x, y, 1, 1); }
    }
    cv._w = w; cv._h = h; this.cache[ck] = cv; return cv;
  },
};

// --- ビットマップ定義（16幅基準） ---
const SPR = {
  // 修行者（プレイヤー／ライバル）16x18
  monk: [
    '................',
    '......OOOO......',
    '.....OSSSSO.....',
    '.....OSssSO.....',
    '.....OEsSEO.....',
    '.....OSSSSO.....',
    '......OOOO......',
    '....OMMMMMMO....',
    '...OMHMMMMMMO...',
    '...OMMMMMMMMO...',
    '...OAAAAAAAAO...',
    '...OMMMMMMMMO...',
    '..OMMMMDMMMMMO..',
    '..OMMMMDMMMMMO..',
    '..OMMMMDMMMMMO..',
    '..OMMMMDMMMMMO..',
    '..ODDDDDDDDDDO..',
    '...OOOOOOOOOO...',
  ],
  // 鬼（小鬼・阿修羅・武者の骸 等）16x16
  demon: [
    '................',
    '..O..........O..',
    '..OA........AO..',
    '...OA......AO...',
    '...OMMMMMMMMO...',
    '..OMEMMMMMMEMO..',
    '..OMMMMMMMMMMO..',
    '..OMWMMMMMMWMO..',
    '..OMMMffffMMMO..',
    '...OMMMMMMMMO...',
    '..OMMMMMMMMMMO..',
    '.OMDMMMMMMMMDMO.',
    '.OMMMMMMMMMMMMO.',
    '..OMMO....OMMO..',
    '..ODDO....ODDO..',
    '...OO......OO...',
  ],
  // 骸骨（亡者・髑髏の射手・骸骨武者・閻魔）16x16
  skele: [
    '................',
    '......OOOO......',
    '.....OWWWWO.....',
    '....OWWWWWWO....',
    '....OWEWWEWO....',
    '....OWWWWWWO....',
    '....OWfWfWWO....',
    '.....OWWWWO.....',
    '......OWWO......',
    '....OWWWWWWO....',
    '...OWwWWWWwWO...',
    '...OWWwWWwWWO...',
    '...OWWWWWWWWO...',
    '....OWO..OWO....',
    '....OWO..OWO....',
    '....OWO..OWO....',
  ],
  // 餓鬼・怨霊（浮遊・痩躯）16x16
  wisp: [
    '................',
    '.....OOOO.......',
    '....OMMMMO......',
    '....OMEEMO......',
    '....OMMMMO......',
    '....OMffMO......',
    '...OMMMMMMO.....',
    '..OMMMMMMMMO....',
    '.OMMMMMMMMMMO...',
    '.OMMDMMMMDMMO...',
    '.OMMMMMMMMMMO...',
    '..OMMMMMMMMO....',
    '...OMMMMMMO.....',
    '....OMMMMO......',
    '.....OMMO.......',
    '......OO........',
  ],
  // 不浄の塊（スライム）14x12
  slime: [
    '..............',
    '....OOOOOO....',
    '..OMMMMMMMMO..',
    '.OMHMMMMMMMMO.',
    '.OMMMMMMMMMMO.',
    'OMMEMMMMEMMMMO',
    'OMMMMMMMMMMMMO',
    'OMMMMffMMMMMMO',
    'OMMMMMMMMMMMMO',
    '.OMMMMMMMMMMO.',
    '..ODDDDDDDDO..',
    '...OOOOOOOO...',
  ],
  // 冥蝙蝠（コウモリ）14x10
  bat: [
    '..............',
    'OO..OOOO..OO..',
    'OMOOMMMMOOMO..',
    'OMMMMEEMMMMMO.',
    '.OMMMMMMMMMO..',
    '..OMMffMMMO...',
    '...OMMMMMO....',
    '....OMMMO.....',
    '.....OMO......',
    '......O.......',
  ],
  // 土蜘蛛（クモ）16x12
  spider: [
    '................',
    'O..O......O..O..',
    '.OO.O....O.OO...',
    '..OOMMMMMMOO....',
    '.OMMEMMMMEMMO...',
    'OMMMMMMMMMMMMO..',
    '.OMMMMMMMMMMO...',
    '..OOMMMMMMOO....',
    '.OO.O....O.OO...',
    'O..O......O..O..',
    '................',
    '................',
  ],
  // 大鬼（牛頭・馬頭・ボス）20x20
  ogre: [
    '....................',
    '..OO............OO..',
    '..OAO..........OAO..',
    '...OAO........OAO...',
    '...OMMMMMMMMMMMMO...',
    '..OMMMMMMMMMMMMMMO..',
    '..OMEEMMMMMMMMEEMO..',
    '..OMMMMMMMMMMMMMMO..',
    '..OMMWWMMMMMMWWMMO..',
    '..OMMMMMffffMMMMMO..',
    '..OMMMMMMMMMMMMMMO..',
    '.OMMMMMMMMMMMMMMMMO.',
    'OMDMMMMMMMMMMMMMMDMO',
    'OMMMMMMMMMMMMMMMMMMO',
    'OMMMMMMMMMMMMMMMMMMO',
    '.OMMMMMO....OMMMMMO.',
    '..OMMMO......OMMMO..',
    '..ODDDO......ODDDO..',
    '...OOO........OOO...',
    '....................',
  ],
};

// --- アイテムアイコン ---
const ICON_PAL = {
  '.': null, 'O': '#120d08',
  'i': '#aab0bc', 'I': '#e8edf4', 'd': '#767c88',
  'w': '#8a5a30', 'W': '#aa723f', 'l': '#7a5232', 'L': '#9c6d42',
  'g': '#caa24c', 'G': '#f2d98a',
  'r': '#b6322c', 'R': '#e8665a', 'b': '#3f7fc4', 'B': '#80b2e8',
  'p': '#8a4fc6', 'P': '#c79bf0', 'e': '#6fae8a', 's': '#cfc6b4', 'k': '#d8b48a',
};
const ICONS = {
  blade: ['.......O........', '......OIO.......', '......OIO.......', '......OIO.......', '......OIO.......', '......OIO.......', '.....OOIOO......', '...OGGGGGGGO....', '......OwO.......', '......OwO.......', '......OWO.......', '.....OGGGO.....', '......OOO.......'],
  hammer: ['...OOOOOOO...', '..OiIIIIIIO..', '..OiIIIIIIO..', '..OiIIIIIIO..', '..OOOOwOOOO..', '.....OwO.....', '.....OwO.....', '.....OwO.....', '.....OwO.....', '.....OWO.....', '.....OOO.....'],
  bow: ['....OG......', '...OGGO.....', '..OGO.s.....', '..OG..s.....', '.OG...s.....', '.OG...s.....', '.OG...s.....', '..OG..s.....', '..OGO.s.....', '...OGGO.....', '....OG......'],
  staff: ['......OPO......', '.....OPPPO.....', '.....OPpPO.....', '......OPO......', '......OwO......', '......OwO......', '......OwO......', '......OwO......', '......OwO......', '.....OWO.......', '.....OO........'],
  helm: ['....OOOOOO....', '...OiIIIIiO...', '..OiIIIIIIiO..', '..OiIddddIiO..', '..OiIddddIiO..', '..OiIIIIIIiO..', '..OiIIIIIIiO..', '...OiIIIIiO...', '....OOOOOO....'],
  chest: ['..OOO..OOO..', '.OiIIOOIIiO.', 'OiIIIIIIIIIO', 'OiIIIddIIIIO', 'OiIIIddIIIIO', 'OiIIIIIIIIIO', 'OiIIIIIIIIIO', '.OiIIIIIIiO.', '..OiIIIIiO..', '...OOOOOO...'],
  glove: ['...OO.OO....', '..OiIOiIO...', '..OiIIIIO...', '.OiIIIIIIO..', 'OiIIIIIIIIO.', 'OiIIIIIIIIO.', 'OiIIddIIIIO.', '.OiIIIIIIO..', '..OOOOOOO...'],
  boot: ['...OOO......', '..OlLLO.....', '..OlLLO.....', '..OlLLO.....', '..OlLLO.....', '..OlLLOOOO..', '..OlLLLLLLO.', '.OllLLLLLLLO', '.OOOOOOOOOOO'],
  ring: ['....OGGGO....', '...OG...GO...', '..OG.OpO.GO..', '..OG.OPO.GO..', '..OG.OOO.GO..', '...OG...GO...', '....OGGGO....'],
  torch: ['......Or......', '.....OrRrO....', '.....ORrRO....', '......OrO.....', '......OwO.....', '......OwO.....', '......OwO.....', '......OwO.....', '......OWO.....'],
  potionR: ['.....OO.....', '.....OsO....', '....OssO....', '...ORRRRO...', '..ORRRRRRO..', '..ORrRRRRO..', '..ORRRRRRO..', '...ORRRRO...', '....OOOO....'],
  potionB: ['.....OO.....', '.....OsO....', '....OssO....', '...OBBBBO...', '..OBBBBBBO..', '..OBbBBBBO..', '..OBBBBBBO..', '...OBBBBO...', '....OOOO....'],
  coin: ['...OGGGGO...', '..OGGGGGGO..', '.OGGgGGgGGO.', '.OGgGGGGgGO.', '.OGGgGGgGGO.', '..OGGGGGGO..', '...OGGGGO...'],
  gem: ['....OOOO....', '...OpPPpO...', '..OpPPPPpO..', '.OpPPPPPPpO.', '..OpPPPPpO..', '...OpPPpO...', '....OppO....', '.....OO.....'],
  crown: ['..O..O..O...', '..O..O..O...', '.OGOGOGOGO..', '.OGgGGgGGO..', '.OGGGGGGGO..', '.OOOOOOOOO..'],
};
function iconKey(it) {
  if (!it) return 'coin';
  if (it.slot === 'weapon') {
    const w = it.wtype;
    if (['sword', 'dagger', 'spear'].includes(w)) return 'blade';
    if (['hammer', 'mace', 'flail'].includes(w)) return 'hammer';
    if (w === 'bow') return 'bow';
    return 'staff';
  }
  if (it.slot === 'head') return 'helm';
  if (it.slot === 'chest') return 'chest';
  if (it.slot === 'hands') return 'glove';
  if (it.slot === 'legs') return 'boot';
  if (it.slot === 'ring') return 'ring';
  if (it.slot === 'torch') return 'torch';
  if (it.slot === 'potion') return (it.potion && it.potion.mp) ? 'potionB' : 'potionR';
  if (it.slot === 'treasure') { if (it.baseId === 'tr_crown') return 'crown'; if (it.baseId === 'tr_gem') return 'gem'; return 'coin'; }
  return 'coin';
}

// --- 職業別スプライト（頭部・装束で描き分け） ---
const CLASS_SPRITE = { fighter: 'c_fighter', barbarian: 'c_barb', ranger: 'c_ranger', rogue: 'c_rogue', cleric: 'c_cleric', mage: 'c_mage' };
Object.assign(SPR, {
  // 武僧：剃髪・数珠・袈裟
  c_fighter: [
    '......OOOO......',
    '.....OSSSSO.....',
    '.....OSssSO.....',
    '.....sSEsES.....',
    '.....OSssSO.....',
    '......OOOO......',
    '....OMMHHMMO....',
    '...OMMMMMMMMO...',
    '...OAMAMAMAMO...',
    '...OMMMMMMMMO...',
    '...OAAAAAAAAO...',
    '..OMMMMDDMMMMO..',
    '..OMHMMDDMMMMO..',
    '..OMMMMDDMMMMO..',
    '..OMMMMDDMMMMO..',
    '..ODDDDDDDDDDO..',
    '...OO....OO.....',
  ],
  // 金剛：髻・上半身裸・赤褌
  c_barb: [
    '.......kk.......',
    '......OkkO......',
    '.....OSSSSO.....',
    '.....SSEEsS.....',
    '.....OSssSO.....',
    '......OOOO......',
    '...OSSMMMMSSO...',
    '..OSSSMMMMSSSO..',
    '..OSSSMMMMSSSO..',
    '..OSAAAAAAAASO..',
    '..OSSMMMMMMSSO..',
    '..OSSMMMMMMSSO..',
    '..OSSDDDDDDSSO..',
    '...OSSO..OSSO...',
    '...OSSO..OSSO...',
    '...OOOO..OOOO...',
  ],
  // 修験者：頭襟＋兜巾（ずきん）
  c_ranger: [
    '......OAO.......',
    '.....OkkkkO.....',
    '....OkSSSSkO....',
    '....kSEsEsk.....',
    '....OkSSSSk.....',
    '.....OOOOO......',
    '...OMMMMMMMO....',
    '..OMMHMMMMMMO...',
    '..OMMMMMMMMMO...',
    '..OAAAAAAAAAO...',
    '..OMMMMMMMMMO...',
    '.OMMMMDDMMMMMO..',
    '.OMHMMDDMMMMMO..',
    '..OMMMMMMMMMO...',
    '..ODDDDDDDDO....',
    '..OO....OO......',
  ],
  // 夜叉：頭巾＋覆面・双眸が光る
  c_rogue: [
    '.....OOOOO.....',
    '....OxxxxxO....',
    '...OxSSSSSxO...',
    '...xSrEErSx....',
    '...OxxxxxxxO...',
    '....OOOOOOO....',
    '...OMMMMMMMO...',
    '..OMxMMMMxMMO..',
    '..OMMMMMMMMMO..',
    '..OAAAAAAAO....',
    '..OMMMMMMMMMO..',
    '.OMMMMDDMMMMMO.',
    '.OMxMMDDMMxMMO.',
    '..OMMMMMMMMMO..',
    '..ODDDDDDDDO...',
    '..OO....OO.....',
  ],
  // 法師：網代笠・白い袈裟襷
  c_cleric: [
    '...OOOOOOOO....',
    '..OAAAAAAAAO...',
    '..OaAAAAAAaO...',
    '...kSSSSSSk....',
    '...kSEsEsSk....',
    '....OSSSSO.....',
    '...OMMMMMMMO...',
    '..OMMHMMMMMMO..',
    '..OWWWWWWWWWO..',
    '..OMMMMMMMMMO..',
    '..OAAAAAAAAAO..',
    '.OMMMMDDMMMMMO.',
    '.OMMHMDDMMMMMO.',
    '..OMMMMMMMMMO..',
    '..ODDDDDDDDDO..',
    '...OO....OO....',
  ],
  // 陰陽師：立烏帽子・水干の広袖
  c_mage: [
    '......Okkk......',
    '......Okkk......',
    '.....OkkkO.....',
    '.....OSSSSO....',
    '.....SSEsES....',
    '.....OSssSO....',
    '......OOOO.....',
    '...OMMMMMMMO...',
    '..OMMHMMMMMMO..',
    '.OMMMMMMMMMMMO.',
    '.OMAAAAAAAAMMO.',
    'OMMMMMMMMMMMMMO',
    'OMMMDDDDDDMMMMO',
    '.OMMMMMMMMMMMO.',
    '..OMMMMMMMMMO..',
    '..ODDDDDDDDDO..',
    '...OO....OO....',
  ],
});

// 敵・ボスの専用スプライト
Object.assign(SPR, {
  // 亡者（屍鬼・腕を広げる）
  zombie: [
    '.....OOOO.......',
    '....OMMMMO......',
    '....OMEsEO......',
    '....OMMMMO......',
    '....OMffMO......',
    '...OMMMMMMO.....',
    '.OOMMMMMMMMOO...',
    'OMMOMMMMMMOMMO..',
    'OMMOMMMMMMOMMO..',
    '..OMMMMMMMMO....',
    '..OMMDDDDMMO....',
    '..OMMO..OMMO....',
    '..OMMO..OMMO....',
    '..ODDO..ODDO....',
    '..OOO....OOO....',
  ],
  // 邪法の亡霊（兜巾の呪術者・足は霊体）
  warlock_g: [
    '.....OOOO......',
    '....OxxxxO.....',
    '...OxMMMMxO....',
    '...xMMEEMMx....',
    '...OxMMMMxO....',
    '....OMMMMO.....',
    '...OMMMMMMO....',
    '..OMMMMMMMMO...',
    '.OMMMMMMMMMMO..',
    '.OMMxMMMMxMMO..',
    '.OMMMMMMMMMMO..',
    '..OMMMMMMMMO...',
    '...OMMMMMMO....',
    '....OMMMMO.....',
    '.....OMMO......',
    '......OO.......',
  ],
  // 骸の射手（弓を構える）
  skele_arch: [
    '.....OOOO...G..',
    '....OWWWWO.OGO.',
    '...OWEWWEWGGO..',
    '...OWWWWWWGGO..',
    '...OWfWfWWGO...',
    '....OWWWWGGO...',
    '.....OWWGGO....',
    '....OWWWWGO....',
    '...OWwWWwWO....',
    '...OWWWWWWO....',
    '...OWWWWWWO....',
    '....OWO.OWO....',
    '....OWO.OWO....',
    '....OWO.OWO....',
  ],
  // 骸骨武者（角兜・肩当て）
  skele_kn: [
    '...A......A....',
    '...OAOOOOAO....',
    '...OWWWWWWO....',
    '...OWEWWEWO....',
    '...OWWWWWWO....',
    '....OWWWWO.....',
    '..OiOWWWWOiO...',
    '..OiWWWWWWiO...',
    '...OWWWWWWO....',
    '...OWwWWwWO....',
    '...OWWWWWWO....',
    '...OWWWWWWO....',
    '....OWO.OWO....',
    '....OWO.OWO....',
    '....OWO.OWO....',
  ],
  // 【ボス】牛頭鬼（22）
  boss_gozu: [
    '......................',
    '..A................A..',
    '..OA..............AO..',
    '...OAA..........AAO...',
    '....OAA........AAO....',
    '....OMMMMMMMMMMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '...OMMEEMMMMMMEEMMO...',
    '...OMMMMMMMMMMMMMMO...',
    '...OMMMWWMMMMWWMMMO...',
    '...OMMMMMrrrrMMMMMO...',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMMMMMMMMMMMMMMMO..',
    '.OMDMMMMMMMMMMMMMMDMO.',
    '.OMMMMMMMMMMMMMMMMMMO.',
    '.OMMMMMMMMMMMMMMMMMMO.',
    '..OMMMMMO....OMMMMMO..',
    '..OMMMMO......OMMMMO..',
    '..ODDDDO......ODDDDO..',
    '...OOOO........OOOO...',
  ],
  // 【ボス】馬頭鬼（22）
  boss_mezu: [
    '......................',
    '.......k....k.........',
    '......OkO..OkO........',
    '......OMMMMMMMO.......',
    '......OMMMMMMMO.......',
    '......OMEMMMEMO.......',
    '......OMMMMMMMO.......',
    '.....kOMMMMMMMOk......',
    '.....kOMMrrMMMOk......',
    '.....kOMMMMMMMOk......',
    '....OMMMMMMMMMMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMDMMMMMMMMMMMMDMO..',
    '..OMMMMMMMMMMMMMMMMO..',
    '..OMMMMMMMMMMMMMMMMO..',
    '...OMMMMO....OMMMMO...',
    '...OMMMO......OMMMO...',
    '...ODDDO......ODDDO...',
    '....OOO........OOO....',
  ],
  // 【ボス】閻魔大王（22）
  boss_enma: [
    '......................',
    '.......OAAAAO.........',
    '.......OAAAAO.........',
    '.......OkkkkO.........',
    '......OMMMMMMO........',
    '......OMEMMEMO........',
    '......OMMMMMMO........',
    '......OMrffrMO........',
    '......OkkkkkkO........',
    '.......OkkkkO.........',
    '....OMMMMMMMMMMO......',
    '...OMMMMMMMMMMMMO.....',
    '..OMAAAAAAAAAAAAMO....',
    '..OMMMMMMMMMMMMMMMO...',
    '.OMDMMMMMMMMMMMMMMDMO.',
    '.OMMMMMMMMMMMMMMMMMMO.',
    '..OMMMMMMMMMMMMMMMMO..',
    '..OMMMMO....OMMMMO....',
    '..ODDDDO....ODDDDO....',
    '...OOOO......OOOO.....',
  ],
});

// 敵タイプ → スプライト種別
const ENEMY_SPRITE = {
  skeleton: { t: 'skele' }, skel_archer: { t: 'skele_arch' }, skel_knight: { t: 'skele_kn' },
  zombie: { t: 'zombie' }, wraith: { t: 'wisp' }, warlock: { t: 'warlock_g' },
  slime: { t: 'slime' }, bat: { t: 'bat' }, spider: { t: 'spider' },
  goblin: { t: 'demon' }, imp: { t: 'demon' },
  lich: { t: 'boss_enma' }, ogre: { t: 'boss_gozu' }, necromancer: { t: 'boss_mezu' },
  rival: { t: 'monk' },
};
