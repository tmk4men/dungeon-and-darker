// ============================================================
// map.js — ダンジョン生成（部屋グリッド＋通路＋扉＋光源＋湧き）
// ============================================================
const T_WALL = 0, T_FLOOR = 1, T_DOOR = 2, T_DOOROPEN = 3;

// バイオーム（見た目テーマ）
const THEMES = {
  crypt:   { name: '古城の地下', floorA: '#26242c', floorB: '#2c2a33', wallTop: '#4a4754', wallTopHi: '#54515f', wallFaceA: '#3a3742', wallFaceB: '#1c1a22', lightCol: '#ffae5b' },
  cave:    { name: '洞窟', floorA: '#2a2620', floorB: '#302b22', wallTop: '#4a4038', wallTopHi: '#564a40', wallFaceA: '#3a3026', wallFaceB: '#1e1812', lightCol: '#ffcf7a' },
  inferno: { name: '溶岩窟', floorA: '#2c1e1e', floorB: '#321f1f', wallTop: '#4e3232', wallTopHi: '#5e3a3a', wallFaceA: '#402424', wallFaceB: '#221212', lightCol: '#ff7a3c' },
  ice:     { name: '氷窟', floorA: '#222a30', floorB: '#26303a', wallTop: '#46545f', wallTopHi: '#536470', wallFaceA: '#36424c', wallFaceB: '#161e24', lightCol: '#9fd8ff' },
};
function pickTheme(floor) {
  if (floor === 1) return 'crypt';
  if (floor === 2) return choice(['cave', 'ice']);
  if (floor === 3) return 'inferno';
  return choice(Object.keys(THEMES));
}

function genDungeon(floor, derived) {
  const cols = 4, rows = 3;
  const cellW = 17, cellH = 15;
  const W = cols * cellW, H = rows * cellH;
  const tiles = new Uint8Array(W * H); // 0=wall

  const idx = (x, y) => y * W + x;
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T_WALL : tiles[idx(x, y)];
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[idx(x, y)] = v; };

  const rooms = [];
  const grid = [];

  // --- 各セルに部屋を配置 ---
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const ox = cx * cellW, oy = cy * cellH;
      const rw = randInt(7, cellW - 4);
      const rh = randInt(6, cellH - 4);
      const rx = ox + randInt(2, cellW - rw - 2);
      const ry = oy + randInt(2, cellH - rh - 2);
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) set(x, y, T_FLOOR);
      const lit = chance(0.45);
      const room = {
        id: rooms.length, cx, cy,
        x: rx, y: ry, w: rw, h: rh,
        ccx: rx + (rw >> 1), ccy: ry + (rh >> 1),
        revealed: false, lit, ambient: lit ? 0.5 : 0.92, lights: [],
      };
      grid[cy * cols + cx] = room;
      rooms.push(room);
    }
  }

  // --- 通路カーブ ---
  const carveCorridor = (ax, ay, bx, by) => {
    const hFirst = chance(0.5);
    const stepX = ax < bx ? 1 : -1, stepY = ay < by ? 1 : -1;
    const carveCell = (x, y) => { if (get(x, y) === T_WALL) set(x, y, T_FLOOR); };
    if (hFirst) {
      for (let x = ax; x !== bx + stepX; x += stepX) { carveCell(x, ay); carveCell(x, ay + 1); }
      for (let y = ay; y !== by + stepY; y += stepY) { carveCell(bx, y); carveCell(bx + 1, y); }
    } else {
      for (let y = ay; y !== by + stepY; y += stepY) { carveCell(ax, y); carveCell(ax + 1, y); }
      for (let x = ax; x !== bx + stepX; x += stepX) { carveCell(x, by); carveCell(x, by + 1); }
    }
  };

  // --- 隣接セルを全域木＋ループで接続 ---
  const parent = grid.map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const edges = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    if (cx < cols - 1) edges.push([cy * cols + cx, cy * cols + cx + 1]);
    if (cy < rows - 1) edges.push([cy * cols + cx, (cy + 1) * cols + cx]);
  }
  shuffle(edges);
  for (const [a, b] of edges) {
    const extra = chance(0.28);
    if (find(a) !== find(b) || extra) {
      parent[find(a)] = find(b);
      const ra = grid[a], rb = grid[b];
      carveCorridor(ra.ccx, ra.ccy, rb.ccx, rb.ccy);
    }
  }

  // --- 扉：各部屋の外周リングにできた床＝出入口 → 扉に ---
  for (const r of rooms) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      for (let y = r.y - 1; y <= r.y + r.h; y++) {
        const onRing = (x === r.x - 1 || x === r.x + r.w || y === r.y - 1 || y === r.y + r.h);
        const inside = (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
        if (onRing && !inside && get(x, y) === T_FLOOR) set(x, y, T_DOOR);
      }
    }
  }

  // --- 光源（ライト部屋） ---
  const lights = [];
  for (const r of rooms) {
    if (!r.lit) continue;
    const n = randInt(1, 2);
    for (let i = 0; i < n; i++) {
      const lx = (r.x + randInt(1, r.w - 2) + 0.5) * CONFIG.TILE;
      const ly = (r.y + randInt(1, r.h - 2) + 0.5) * CONFIG.TILE;
      const l = { x: lx, y: ly, radius: rand(130, 200), color: choice(['#ffae5b', '#ffd27a', '#ff9b50']), flick: rand(0, TAU) };
      r.lights.push(l); lights.push(l);
    }
  }

  // --- 出撃地点と複数の脱出ポータル ---
  const start = rooms[0];
  start.revealed = true;
  const distOf = r => Math.abs(r.cx - start.cx) + Math.abs(r.cy - start.cy);
  const sorted = rooms.filter(r => r !== start).sort((a, b) => distOf(b) - distOf(a));
  const mainRoom = sorted[0];
  const bonusRoom = sorted.find(r => r !== mainRoom) || mainRoom;
  const portals = [
    { x: (mainRoom.ccx + 0.5) * CONFIG.TILE, y: (mainRoom.ccy + 0.5) * CONFIG.TILE, r: 30, room: mainRoom, bonus: false, openAt: 0, id: 0 },
  ];
  if (bonusRoom !== mainRoom) {
    portals.push({ x: (bonusRoom.ccx + 0.5) * CONFIG.TILE, y: (bonusRoom.ccy + 0.5) * CONFIG.TILE, r: 30, room: bonusRoom, bonus: true, openAt: 22, id: 1 });
  }
  const portal = portals[0]; // ゾーン中心などの互換用（安全な脱出口）
  const portalRoom = mainRoom;
  const bossRoom = (bonusRoom !== mainRoom) ? bonusRoom : mainRoom; // ボスは報酬ポータルを守る

  // --- 湧き：敵・宝箱・地上アイテム ---
  const enemySpawns = [];
  const chests = [];
  const groundItems = [];
  const floorTypes = floorEnemyPool(floor);

  for (const r of rooms) {
    if (r === start) continue;
    // 敵
    let count = randInt(0, 1 + Math.min(floor, 3));
    if (r === bossRoom && floor >= 2) {
      // ボス部屋（報酬ポータルを守る）
      const bossPool = floor >= 3 ? ['ogre', 'necromancer', 'lich'] : ['lich', 'necromancer'];
      enemySpawns.push({ type: choice(bossPool), x: (r.ccx + 0.5) * CONFIG.TILE, y: (r.ccy + 0.5) * CONFIG.TILE });
      count = Math.max(0, count - 2);
    }
    for (let i = 0; i < count; i++) {
      const type = weightedPick(floorTypes);
      enemySpawns.push({
        type,
        x: (r.x + randInt(1, r.w - 2) + 0.5) * CONFIG.TILE,
        y: (r.y + randInt(1, r.h - 2) + 0.5) * CONFIG.TILE,
      });
    }
    // 宝箱
    if (chance(0.7)) {
      chests.push({
        x: (r.x + randInt(1, r.w - 2) + 0.5) * CONFIG.TILE,
        y: (r.y + randInt(1, r.h - 2) + 0.5) * CONFIG.TILE,
        opened: false, r: 18,
        loot: 1 + randInt(0, 2),
      });
    }
    // 地上アイテム（ポーション等）
    if (chance(0.5)) {
      groundItems.push({
        x: (r.x + randInt(1, r.w - 2) + 0.5) * CONFIG.TILE,
        y: (r.y + randInt(1, r.h - 2) + 0.5) * CONFIG.TILE,
        item: randomLoot(floor, derived ? derived.attr.LUCK : 8, { kind: chance(0.6) ? 'potion' : undefined }),
      });
    }
  }

  // --- トラップ ---
  const traps = [];
  const trapCount = 3 + floor * 2;
  for (let i = 0; i < trapCount; i++) {
    // 床タイルをランダムに選ぶ（開始部屋以外）
    let tx, ty, tries = 0;
    do {
      const r = rooms[randInt(1, rooms.length - 1)];
      tx = r.x + randInt(1, r.w - 2); ty = r.y + randInt(1, r.h - 2);
      tries++;
    } while ((get(tx, ty) !== T_FLOOR) && tries < 20);
    if (get(tx, ty) !== T_FLOOR) continue;
    const cx = (tx + 0.5) * CONFIG.TILE, cy = (ty + 0.5) * CONFIG.TILE;
    if (chance(0.65)) {
      traps.push({ type: 'spike', x: cx, y: cy, tx, ty, phase: rand(0, 2.4), period: 2.4, armed: false, dmg: 10 + floor * 6 });
    } else {
      traps.push({ type: 'dart', x: cx, y: cy, tx, ty, dir: choice([0, Math.PI / 2, Math.PI, -Math.PI / 2]), cd: rand(0, 2.4), dmg: 8 + floor * 5 });
    }
  }

  // --- 特殊部屋：祭壇（生贄）と聖域（恩恵ガチャ） ---
  const altars = [];
  const altarRooms = shuffle(rooms.filter(r => r !== start && r !== mainRoom && r !== bossRoom));
  if (altarRooms[0]) altars.push({ type: 'sacrifice', x: (altarRooms[0].ccx + 0.5) * CONFIG.TILE, y: (altarRooms[0].ccy + 0.5) * CONFIG.TILE, used: false, r: 24 });
  if (altarRooms[1]) altars.push({ type: 'shrine', x: (altarRooms[1].ccx + 0.5) * CONFIG.TILE, y: (altarRooms[1].ccy + 0.5) * CONFIG.TILE, used: false, r: 24 });

  // --- ライバル冒険者（PvPvE風味） ---
  if (chance(0.6)) {
    const cand = shuffle(rooms.filter(r => r !== start && r !== bossRoom));
    if (cand[0]) enemySpawns.push({ type: 'rival', x: (cand[0].ccx + 0.5) * CONFIG.TILE, y: (cand[0].ccy + 0.5) * CONFIG.TILE });
  }

  const themeKey = pickTheme(floor);
  const theme = THEMES[themeKey];

  return {
    floor, W, H, tiles, rooms, lights, portal, portals, traps, altars, theme, themeKey,
    get, set,
    startX: (start.ccx + 0.5) * CONFIG.TILE,
    startY: (start.ccy + 0.5) * CONFIG.TILE,
    enemySpawns, chests, groundItems,
    pxW: W * CONFIG.TILE, pxH: H * CONFIG.TILE,
  };
}

function floorEnemyPool(floor) {
  const pool = [
    { item: 'skeleton', weight: 10 },
    { item: 'bat', weight: 8 },
    { item: 'slime', weight: 7 },
    { item: 'spider', weight: 6 },
    { item: 'goblin', weight: 6 + floor },
    { item: 'imp', weight: 4 + floor },
    { item: 'skel_archer', weight: 5 + floor },
    { item: 'zombie', weight: 4 + floor },
    { item: 'wraith', weight: 2 + floor * 1.4 },
    { item: 'warlock', weight: 2 + floor * 1.3 },
    { item: 'skel_knight', weight: 1 + floor * 1.6 },
  ];
  return pool;
}

// 座標がソリッド（壁 or 閉扉）か
function isSolidAt(dgn, px, py) {
  const tx = Math.floor(px / CONFIG.TILE), ty = Math.floor(py / CONFIG.TILE);
  const t = dgn.get(tx, ty);
  return t === T_WALL || t === T_DOOR;
}
// 視界を遮るか（壁 or 閉扉）
function isOpaqueAt(dgn, tx, ty) {
  const t = dgn.get(tx, ty);
  return t === T_WALL || t === T_DOOR;
}
// 座標を含む部屋
function roomAt(dgn, px, py) {
  const tx = Math.floor(px / CONFIG.TILE), ty = Math.floor(py / CONFIG.TILE);
  for (const r of dgn.rooms) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
  }
  return null;
}
