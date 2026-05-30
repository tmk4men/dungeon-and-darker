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
      'D': shade(col, -0.38),
      'H': shade(col, 0.34),
      'S': '#e8c79c', 's': '#c39a6e', 'E': '#1c120a',
      'A': '#d8b15a', 'a': '#9c7f38',
      'W': '#ece9dc', 'w': '#9a978a', 'f': '#b83038', 'G': '#fff3c0',
    };
  },

  make(key, rows, col) {
    const ck = key + '|' + col;
    if (this.cache[ck]) return this.cache[ck];
    const pal = this.palette(col);
    const h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const color = pal[row[x]];
        if (color) { c.fillStyle = color; c.fillRect(x, y, 1, 1); }
      }
    }
    cv._w = w; cv._h = h;
    this.cache[ck] = cv;
    return cv;
  },

  player(col) { return this.make('monk', SPR.monk, col); },

  enemy(type) {
    const def = ENEMIES[type];
    const m = ENEMY_SPRITE[type] || { t: 'demon' };
    return this.make(m.t, SPR[m.t], def.color);
  },

  templateOf(type) { return (ENEMY_SPRITE[type] || { t: 'demon' }).t; },
  get(tmpl, col) { return this.make(tmpl, SPR[tmpl], col); },

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

// 敵タイプ → スプライト種別
const ENEMY_SPRITE = {
  skeleton: { t: 'skele' }, skel_archer: { t: 'skele' }, skel_knight: { t: 'skele' }, lich: { t: 'skele' },
  zombie: { t: 'wisp' }, wraith: { t: 'wisp' }, warlock: { t: 'wisp' },
  slime: { t: 'slime' }, bat: { t: 'bat' }, spider: { t: 'spider' },
  goblin: { t: 'demon' }, imp: { t: 'demon' },
  ogre: { t: 'ogre' }, necromancer: { t: 'ogre' },
  rival: { t: 'monk' },
};
