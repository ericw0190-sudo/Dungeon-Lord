// ============================================================
//  DUNGEON LORD — game.js
//  All game logic lives here. index.html loads this script.
// ============================================================

// ── Constants ────────────────────────────────────────────────
const TILE = 40, GRID = 15;
const DW   = GRID * TILE;   // dungeon pixel width  (600)
const UW   = 220;            // UI panel width
const CW   = DW + UW;       // canvas total width   (820)
const CH   = 600;            // canvas height

// Tile type IDs
const T_FLOOR = 0, T_WALL = 1, T_HEART = 2, T_SOIL = 3, T_TRAP = 4;

// Trap definitions
const TRAP_TYPES = {
  groundSpikes: {
    name: 'Ground Spikes', shortName: 'SPIKES',
    color: '#886633', accentColor: '#ddaa55',
    baseCost: 10, upgradeBaseCost: 50, maxLevel: 5,
    cooldown: 1.5,
    baseEffect: 0.05, upgradeBoost: 0.01,
    durabilityAtLevel: lv => lv,
    effectDesc: lv => Math.round((0.05+(lv-1)*0.01)*100)+'% max HP dmg  Dur:'+lv+'/wave',
  },
  fartMushroom: {
    name: 'Fart Mushroom', shortName: 'SHROOM',
    color: '#447722', accentColor: '#88cc33',
    baseCost: 10, upgradeBaseCost: 200, maxLevel: 5,
    cooldown: 0,
    baseEffect: 1, upgradeBoost: 1,
    effectDesc: lv => { const sz = (1+(lv-1))*2+1; return sz+'x'+sz+' flee fog'; },
  },
  quicksand: {
    name: 'Quicksand', shortName: 'QSAND',
    color: '#b89020', accentColor: '#f0d060',
    baseCost: 80, upgradeBaseCost: 160, maxLevel: 3,
    baseDurability: 999, cooldown: 0,
    durabilityAtLevel: lv => 999,
    effectDesc: lv => '-'+(20+(lv-1)*5)+'% SPD + '+(lv)+'% maxHP/s  Dur:∞',
  },
  emberbolt: {
    name: 'Emberbolt Trap', shortName: 'EMBER',
    color: '#cc3300', accentColor: '#ff8833',
    baseCost: 250, upgradeBaseCost: 150, maxLevel: 3,
    cooldown: 0,
    fireRateAtLevel: lv => [1.0, 0.80, 0.65][lv - 1],
    effectDesc: lv => '10% maxHP + 5s burn  Rate:'+[1.0,0.80,0.65][lv-1]+'s',
  },
};

// ── Minion definitions ───────────────────────────────────────
const MINION_TYPES = {
  goblin: {
    name: 'Goblin Minion', shortName: 'GOB',
    color: '#4db533', accentColor: '#88ff44',
    baseCost: 50, foodPerLevel: 3, respawnTime: 60,
    upgradeFoodCost: lv => lv <= 4 ? [30, 60, 100, 150][lv - 1] : Math.round(150 * Math.pow(1.45, lv - 4)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [40,  65, 100, 150, 210][lv - 1],
      atk:       [8,   13,  20,  29,  40][lv - 1],
      speed:     [140, 164, 190, 216, 250][lv - 1],
      detectRng: [120, 160, 200, 260, 360][lv - 1],
      atkCdMax:  [1.5, 1.4, 1.3, 1.2, 1.0][lv - 1],
    }) : ({
      hp:        Math.round(210 + (lv - 5) * 66),
      atk:       Math.round(40  + (lv - 5) * 12),
      speed:     Math.min(380, Math.round(250 + (lv - 5) * 34)),
      detectRng: Math.min(600, Math.round(360 + (lv - 5) * 100)),
      atkCdMax:  Math.max(0.30, parseFloat((1.0 - (lv - 5) * 0.10).toFixed(2))),
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.goblin.statsAtLevel(lv);
      return 'HP:'+s.hp+' ATK:'+s.atk+' SPD:'+s.speed+'  Food:'+(lv*3)+'/min';
    },
  },
  giantSpider: {
    name: 'Giant Spider', shortName: 'SPD',
    color: '#888877', accentColor: '#ccccbb',
    baseCost: 300, foodPerLevel: 5, respawnTime: 90,
    upgradeFoodCost: lv => lv <= 4 ? [50, 100, 160, 230][lv - 1] : Math.round(230 * Math.pow(1.45, lv - 4)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [120, 180, 260, 360, 480][lv - 1],
      atk:       [18,  26,  36,  48,  62][lv - 1],
      speed:     [55,  62,  70,  78,  88][lv - 1],
      detectRng: [200, 240, 280, 340, 420][lv - 1],
      atkCdMax:  [1.2, 1.1, 1.0, 0.9, 0.8][lv - 1],
      webCdMax:  4.0,
      webRange:  [160, 160, 200, 200, 240][lv - 1],
    }) : ({
      hp:        Math.round(480 + (lv - 5) * 132),
      atk:       Math.round(62  + (lv - 5) * 15),
      speed:     Math.min(150, Math.round(88 + (lv - 5) * 10)),
      detectRng: Math.min(600, Math.round(420 + (lv - 5) * 80)),
      atkCdMax:  Math.max(0.40, parseFloat((0.8 - (lv - 5) * 0.10).toFixed(2))),
      webCdMax:  4.0,
      webRange:  Math.min(600, Math.round(240 + (lv - 5) * 40)),
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.giantSpider.statsAtLevel(lv);
      return 'HP:'+s.hp+' Bite:'+s.atk+' Web:4s  Food:'+(lv*5)+'/min';
    },
  },
  skeleton: {
    name: 'Skeleton', shortName: 'SKL',
    color: '#c8c8b0', accentColor: '#e8e8d0',
    baseCost: 100, foodPerLevel: 0, respawnTime: 10,
    upgradeFoodCost: lv => lv <= 2 ? [5, 10][lv - 1] : Math.round(10 * Math.pow(1.5, lv - 2)),
    statsAtLevel: lv => lv <= 3 ? ({
      hp:        [18,  28,  40 ][lv - 1],
      atk:       [3,   5,   8  ][lv - 1],
      speed:     [40,  45,  50 ][lv - 1],
      detectRng: [90,  110, 140][lv - 1],
      atkCdMax:  [2.0, 1.8, 1.6][lv - 1],
    }) : ({
      hp:        Math.round(40  + (lv - 3) * 14),
      atk:       Math.round(8   + (lv - 3) * 3),
      speed:     Math.min(80,  Math.round(50  + (lv - 3) * 5)),
      detectRng: Math.min(300, Math.round(140 + (lv - 3) * 30)),
      atkCdMax:  Math.max(0.80, parseFloat((1.6 - (lv - 3) * 0.20).toFixed(2))),
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.skeleton.statsAtLevel(lv);
      return 'HP:'+s.hp+' ATK:'+s.atk+' SPD:'+s.speed+'  Food: 0/min';
    },
  },
  goblinFarmer: {
    name: 'Mushroom Farmer', shortName: 'G-FRM',
    color: '#cc8833', accentColor: '#ffcc55',
    baseCost: 20, foodPerLevel: 0, respawnTime: 150,
    upgradeFoodCost: lv => lv <= 4 ? [30, 55, 90, 135][lv - 1] : Math.round(135 * Math.pow(1.45, lv - 4)),
    foodGenAtLevel: lv => lv <= 5 ? [10, 15, 22, 31, 44][lv - 1] : Math.round(44 * Math.pow(1.4, lv - 5)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [20, 28, 38, 50, 65][lv - 1],
      atk:       0, def: 0,
      speed:     [50, 55, 60, 65, 70][lv - 1],
      detectRng: 0,
      atkCdMax:  999,
    }) : ({
      hp:        Math.round(65 + (lv - 5) * 16),
      atk:       0, def: 0,
      speed:     Math.min(100, Math.round(70 + (lv - 5) * 5)),
      detectRng: 0, atkCdMax: 999,
    }),
    effectDesc: lv => {
      const gen = MINION_TYPES.goblinFarmer.foodGenAtLevel(lv);
      return 'Generates +'+gen+' food/min  No upkeep cost';
    },
  },
  goblinWarrior: {
    name: 'Goblin Warrior', shortName: 'G-WAR',
    color: '#8899bb', accentColor: '#ccddf0',
    baseCost: 120, foodPerLevel: 5, respawnTime: 75,
    upgradeFoodCost: lv => lv <= 4 ? [50, 90, 140, 200][lv - 1] : Math.round(200 * Math.pow(1.45, lv - 4)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [160, 240, 340, 460, 600][lv - 1],
      atk:       [12,  18,  26,  36,  48][lv - 1],
      def:       [6,   9,  13,  18,  24][lv - 1],
      speed:     [95, 106, 118, 132, 148][lv - 1],
      detectRng: [120, 160, 200, 260, 360][lv - 1],
      atkCdMax:  [1.6, 1.5, 1.4, 1.3, 1.1][lv - 1],
    }) : ({
      hp:        Math.round(600 + (lv - 5) * 160),
      atk:       Math.round(48  + (lv - 5) * 13),
      def:       Math.round(24  + (lv - 5) * 7),
      speed:     Math.min(240, Math.round(148 + (lv - 5) * 16)),
      detectRng: Math.min(600, Math.round(360 + (lv - 5) * 100)),
      atkCdMax:  Math.max(0.35, parseFloat((1.1 - (lv - 5) * 0.10).toFixed(2))),
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.goblinWarrior.statsAtLevel(lv);
      return 'HP:'+s.hp+' ATK:'+s.atk+' DEF:'+s.def+'  Food:'+(lv*5)+'/min';
    },
  },
  goblinArcher: {
    name: 'Goblin Archer', shortName: 'G-ARC',
    color: '#88cc44', accentColor: '#bbff66',
    baseCost: 160, foodPerLevel: 4, respawnTime: 50,
    upgradeFoodCost: lv => lv <= 4 ? [45, 80, 125, 180][lv - 1] : Math.round(180 * Math.pow(1.45, lv - 4)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [55,  85, 125, 175, 235][lv - 1],
      atk:       [18,  27,  39,  54,  72][lv - 1],
      def:       [0,   0,   1,   1,   2][lv - 1],
      speed:     [140, 155, 172, 190, 210][lv - 1],
      detectRng: [600, 600, 600, 600, 600][lv - 1],
      atkCdMax:  [1.0, 1.0, 1.0, 1.0, 1.0][lv - 1],
    }) : ({
      hp:        Math.round(235 + (lv - 5) * 66),
      atk:       Math.round(72  + (lv - 5) * 19),
      def:       Math.min(10, Math.round(2 + (lv - 5))),
      speed:     Math.min(320, Math.round(210 + (lv - 5) * 22)),
      detectRng: 600,
      atkCdMax:  1.0,
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.goblinArcher.statsAtLevel(lv);
      return 'HP:'+s.hp+' Arrow:'+s.atk+'/s  Poison 2s  Food:'+(lv*4)+'/min';
    },
  },
  goblinMage: {
    name: 'Goblin Mage', shortName: 'G-MGE',
    color: '#aa55ee', accentColor: '#dd88ff',
    baseCost: 200, foodPerLevel: 6, respawnTime: 65,
    upgradeFoodCost: lv => lv <= 4 ? [65, 120, 185, 260][lv - 1] : Math.round(260 * Math.pow(1.45, lv - 4)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [40,  62,  92, 130, 178][lv - 1],
      atk:       [28,  42,  62,  88, 120][lv - 1],
      def:       [0,   0,   0,   0,   0][lv - 1],
      speed:     [100, 112, 125, 140, 156][lv - 1],
      detectRng: [400, 400, 400, 400, 400][lv - 1],
      atkCdMax:  [1.5, 1.5, 1.5, 1.5, 1.5][lv - 1],
    }) : ({
      hp:        Math.round(178 + (lv - 5) * 52),
      atk:       Math.round(120 + (lv - 5) * 33),
      def:       0,
      speed:     Math.min(250, Math.round(156 + (lv - 5) * 16)),
      detectRng: 400,
      atkCdMax:  1.5,
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.goblinMage.statsAtLevel(lv);
      return 'HP:'+s.hp+' Bolt:'+s.atk+'/1.5s  Burn 2s  Food:'+(lv*6)+'/min';
    },
  },
  mimic: {
    name: 'Mimic', shortName: 'MMC',
    color: '#f0c030', accentColor: '#ffee88',
    baseCost: 400, foodPerLevel: 3, respawnTime: 120,
    upgradeFoodCost: lv => lv <= 4 ? [40, 80, 130, 190][lv - 1] : Math.round(190 * Math.pow(1.45, lv - 4)),
    statsAtLevel: lv => lv <= 5 ? ({
      hp:        [80,  120, 170, 230, 300][lv - 1],
      atk:       [22,  32,  44,  58,  75][lv - 1],
      speed:     [70,  80,  90, 105, 120][lv - 1],
      detectRng: [160, 200, 240, 300, 360][lv - 1],
      atkCdMax:  [1.0, 1.0, 0.9, 0.8, 0.7][lv - 1],
      lureRange: [200, 240, 280, 340, 400][lv - 1],
    }) : ({
      hp:        Math.round(300 + (lv - 5) * 77),
      atk:       Math.round(75  + (lv - 5) * 19),
      speed:     Math.min(200, Math.round(120 + (lv - 5) * 15)),
      detectRng: Math.min(600, Math.round(360 + (lv - 5) * 60)),
      atkCdMax:  Math.max(0.40, parseFloat((0.7 - (lv - 5) * 0.10).toFixed(2))),
      lureRange: Math.min(600, Math.round(400 + (lv - 5) * 60)),
    }),
    effectDesc: lv => {
      const s = MINION_TYPES.mimic.statsAtLevel(lv);
      return 'HP:'+s.hp+' ATK:'+s.atk+' Lure:'+s.lureRange+'px  Food:'+(lv*3)+'/min';
    },
  },
};

const MINION_SPRS = {
  mimicChest: {
    s: [
      [0,1,1,1,1,1,1,0],
      [1,2,2,2,2,2,2,1],
      [1,2,3,2,2,3,2,1],
      [1,1,1,1,1,1,1,1],
      [1,4,4,3,3,4,4,1],
      [1,4,4,4,4,4,4,1],
      [1,4,4,4,4,4,4,1],
      [0,1,1,1,1,1,1,0],
    ],
    c: { 1:'#3a1a05', 2:'#8b5020', 3:'#f0c030', 4:'#6b3010' },
  },
  mimic: {
    s: [
      [0,1,1,1,1,1,1,0],
      [1,1,2,1,1,2,1,1],
      [1,1,1,1,1,1,1,1],
      [1,3,3,3,3,3,3,1],
      [1,4,4,4,4,4,4,1],
      [1,3,4,3,4,3,4,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
    ],
    c: { 1:'#3a1a05', 2:'#ee1100', 3:'#eeeecc', 4:'#110000' },
  },
  giantSpider: {
    s: [
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [2,2,1,1,1,4,4,1,1,4,4,1,1,1,2,2],  // 4 eyes (cols 5,6,9,10) + leg pair A
      [0,2,1,1,1,1,4,1,1,4,1,1,1,1,2,0],  // 2 eyes (cols 6,9) + leg pair A
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,5,1,1,1,1,1,1,5,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [2,2,0,0,1,1,1,1,1,1,1,1,0,0,2,2],  // leg pair B
      [0,2,2,0,1,1,1,1,1,1,1,1,0,2,2,0],
      [0,0,2,1,1,3,1,1,1,1,3,1,1,2,0,0],  // fangs + B/C joint
      [0,2,2,0,1,1,1,1,1,1,1,1,0,2,2,0],  // leg pair C
      [2,2,0,0,1,1,1,1,1,1,1,1,0,0,2,2],
      [0,2,0,0,0,1,1,1,1,1,1,0,0,0,2,0],  // leg pair D
      [0,0,2,0,0,0,1,1,1,1,0,0,0,2,0,0],
      [0,0,0,2,0,0,0,1,1,0,0,0,2,0,0,0],
      [0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0],
    ],
    c: { 1:'#2e2e42', 2:'#555544', 3:'#dd2200', 4:'#3e3e55', 5:'#1a1a28' },
  },
  goblin: {
    s: [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [0,1,2,1,1,2,1,0],
      [1,1,1,3,3,1,1,1],
      [0,4,4,4,4,4,4,0],
      [1,0,4,4,4,4,0,5],
      [0,0,1,4,4,1,0,0],
      [0,0,1,0,0,1,0,0],
    ],
    c: { 1:'#4db533', 2:'#ee1100', 3:'#ccffaa', 4:'#7a4510', 5:'#cccccc' },
  },
  skeleton: {
    s: [
      [0,0,1,1,1,1,0,0],
      [0,1,2,1,1,2,1,0],
      [0,0,1,3,3,1,0,0],
      [0,0,0,1,1,0,0,0],
      [1,1,3,1,1,3,1,1],
      [0,0,3,1,1,3,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,0,0,1,0,0],
    ],
    c: { 1:'#d8d8c0', 2:'#101018', 3:'#a8a898' },
  },
  goblinFarmer: {
    s: [
      [0,0,5,5,5,5,0,0],
      [5,5,5,5,5,5,5,5],
      [0,1,1,1,1,1,1,0],
      [0,1,2,1,1,2,1,0],
      [1,1,1,3,3,1,1,6],
      [0,4,4,4,4,4,4,6],
      [0,4,1,4,4,1,0,6],
      [0,0,1,0,0,1,0,6],
    ],
    c: { 1:'#4db533', 2:'#ee1100', 3:'#ccffaa', 4:'#7a4510', 5:'#cc8833', 6:'#886622' },
  },
  goblinWarrior: {
    s: [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [0,1,2,1,1,2,1,0],
      [5,1,1,3,3,1,1,0],
      [5,4,4,4,4,4,4,0],
      [5,5,4,4,4,4,0,0],
      [0,0,4,1,1,4,0,0],
      [0,0,4,0,0,4,0,0],
    ],
    c: { 1:'#3d9e28', 2:'#ee1100', 3:'#bbff88', 4:'#aaaabc', 5:'#dde0f8' },
  },
  goblinArcher: {
    s: [
      [0,0,1,1,1,1,0,5],
      [0,1,1,1,1,1,1,5],
      [0,1,2,1,1,2,1,5],
      [1,1,1,3,3,1,5,0],
      [0,4,4,4,4,4,5,0],
      [1,0,4,4,4,4,5,0],
      [0,0,1,4,4,1,5,0],
      [0,0,1,0,0,1,0,5],
    ],
    c: { 1:'#4db533', 2:'#ee1100', 3:'#ccffaa', 4:'#7a4510', 5:'#9b6020' },
  },
  goblinMage: {
    s: [
      [0,5,5,5,5,5,5,0],
      [0,0,1,1,1,1,0,0],
      [0,1,2,1,1,2,1,0],
      [1,1,1,3,3,1,1,0],
      [0,4,4,4,4,4,4,6],
      [1,0,4,4,4,4,4,6],
      [0,0,4,4,4,4,0,6],
      [0,0,4,0,0,4,0,6],
    ],
    c: { 1:'#4db533', 2:'#ee1100', 3:'#ccffaa', 4:'#7733cc', 5:'#9933ee', 6:'#ccaa33' },
  },
};

// Sprite scale (each logical pixel → 4 canvas pixels)
const S = 4;

// Shop overlay bounds
const SX = 30, SY = 88, SW = 540, SH = 424;

// Skill menu overlay bounds
const SKMNX = 20, SKMNY = 40, SKMNW = 560, SKMNH = 548;
const SK_SLOT_W = 120, SK_SLOT_H = 78, SK_SLOT_GAP = 8;
const SK_CARD_W = 80,  SK_CARD_H = 50, SK_CARD_GAP = 8;

// ── Rank system ──────────────────────────────────────────────
/**
 * DUNGEON RANKS (index = dungeonRank value)
 * F=0  E=1  D=2  C=3  B=4  A=5  S=6  SS=7  SSS=8
 *
 * To unlock the next rank you spend SOUL_COST souls of the
 * current rank.  E–SSS are placeholders for now.
 */
const RANKS     = ['F','E','D','C','B','A','S','SS','SSS'];
const RCOL      = {
  F:'#aaaaaa', E:'#88dd44', D:'#44bbff', C:'#cc66ff',
  B:'#ffaa00', A:'#ff5544', S:'#ffee00', SS:'#ff88ff', SSS:'#ff3388'
};
const INFAMY_CAP = 100; // F-Infamy needed to auto rank-up to E

// ── Player leveling ───────────────────────────────────────────
const XP_BASE  = 100; // XP required for level 1 → 2
const XP_SCALE = 50;  // extra XP required each subsequent level
const LVL_HP   = 20;  // max HP gained per level
const LVL_DMG  = 5;   // attack damage gained per level
const LVL_DEF  = 2;   // flat damage reduction gained per level
const LVL_SPD  = 3;   // movement speed gained per level

// XP dropped when an adventurer of this rank is killed
const RANK_XP = {
  F:10, E:28, D:70, C:175, B:450, A:1100, S:2800, SS:7000, SSS:18000
};

// ── Adventurer classes ───────────────────────────────────────
/**
 * Each adventurer is one of five CLASSES.
 * Multipliers are applied on top of the base wave stats.
 *
 * hp   – health multiplier
 * dmg  – damage multiplier
 * spd  – speed multiplier
 */
const ADV_CLS = ['warrior','mage','ranger','rogue','cleric'];
const ADV_M   = {
  warrior: { hp:1.4,  dmg:1.3,  spd:0.85 },
  mage:    { hp:0.7,  dmg:1.6,  spd:0.90 },
  ranger:  { hp:0.9,  dmg:1.1,  spd:1.30 },
  rogue:   { hp:0.75, dmg:1.4,  spd:1.50 },
  cleric:  { hp:1.2,  dmg:0.7,  spd:0.80 },
};

// ── Skill registry ───────────────────────────────────────────
/**
 * Each skill entry:
 *   name:      string   – display name shown in menu (≤ 14 chars)
 *   shortName: string   – 3-5 char label for the HUD bar
 *   desc:      string   – one-line description
 *   cooldown:  number   – cooldown in seconds
 *   use(idx):  function – called when the player activates the skill
 *
 * Add new skills here.  Grant them via player.unlockedSkills.push(key).
 */
const SKILLS = {
  basicAttack: {
    name: 'Basic Attack', shortName: 'ATK',
    desc: 'Strike nearest enemy (100% ATK). 0.55s CD.',
    cooldown: 0.55, rank: 'base',
    tips: [
      'Automatically attacks the nearest enemy.',
      'Damage: 100% of your ATK stat.',
    ],
    use(idx) { attackNearest(); },
  },
  goblinFlurry: {
    name: 'Goblin Flurry', shortName: 'FLR',
    desc: '60% ATK cone hit. 0.3s CD.',
    cooldown: 0.3, rank: 'base',
    tips: [
      'Instantly strikes all enemies in a wide cone toward the cursor.',
      'Damage: 60% of your ATK stat per enemy hit.',
      'Same range as basic attack but covers a full cone area.',
      'Very fast — 0.3 second cooldown.',
    ],
    use(idx) { goblinFlurryAttack(); },
  },
  goblinSnatch: {
    name: 'Goblin Snatch', shortName: 'SNT',
    desc: '150% ATK cone + steal 5×LV coins/hit. 3s CD.',
    cooldown: 3, rank: 'base',
    tips: [
      'Swipes in a cone toward the cursor, hitting all enemies in range.',
      'Damage: 150% of your ATK stat per enemy hit.',
      'Steals coins from every enemy hit.',
      'Coin steal: 5 x your current level per hit.',
    ],
    use(idx) { goblinSnatchAttack(); },
  },
  goblinRace: {
    name: 'Goblin', shortName: 'GOBLN',
    desc: 'Greed: +10% coins/kill. Cowardly: <30% HP gives +25% SPD & -25% DPS. Comradery: Goblin minions cost 50% less.',
    cooldown: 0, rank: 'base',
    tips: [
      'GOBLIN GREED — Earn +10% bonus coins on every kill.',
      'COWARDLY — Below 30% HP: gain +25% move speed but deal -25% damage.',
      'COMRADERY — Goblin minions cost 50% less to purchase.',
    ],
    use() {},
  },
  slimeRace: {
    name: 'Slime', shortName: 'SLIME',
    desc: 'Slimy Regen: constant HP regen. Fatty Weakling: +50% HP / -50% ATK / -20% SPD. Amorphous: 15% less damage.',
    cooldown: 0, rank: 'base',
    tips: [
      'SLIMY REGEN — Continuously recover HP, even in combat (0.3%/s).',
      'FATTY WEAKLING — Base HP is 50% higher, base ATK is 50% lower, base SPD is 20% lower.',
      'AMORPHOUS — Take 15% less damage from all enemy attacks.',
    ],
    use() {},
  },
  slimeBalls: {
    name: 'Slime Balls', shortName: 'SLMB',
    desc: '80% ATK projectile. Slimes target (30% slow) for 1s. 0.5s CD.',
    cooldown: 0.5, rank: 'base',
    tips: [
      'Fires a slime ball toward the cursor.',
      'Travels up to 8 tiles before vanishing.',
      'Deals 80% of your ATK stat on hit.',
      'Applies Slimed: 30% slower move and attack speed for 1s.',
      'Replaces basic attack for the Slime Race.',
    ],
    use(idx) { slimeBallsAttack(idx); },
  },
  acidPuddles: {
    name: 'Acid Puddle', shortName: 'ACID',
    desc: 'Lob a green slime ball to cursor tile. Spawns 3s green puddle: Slimed 50% + Poison 2% HP/0.2s. 3s CD.',
    cooldown: 3, rank: 'base',
    tips: [
      'Launches a green slime ball toward the cursor tile, ignoring enemies on the way.',
      'Creates a 1-tile green puddle lasting 3 seconds when it lands.',
      'Puddle applies Slimed: 50% move and attack speed slow for 3s.',
      'Puddle applies Poison: 2% max HP every 0.2s for 1s.',
    ],
    use(idx) { acidPuddlesAttack(idx); },
  },
  cellDivision: {
    name: 'Cell Division', shortName: 'CELL',
    desc: 'Spawn 2 Slimys near you. Skeleton speed, 1 HP/ATK/DEF. On death leaves a 3s slime puddle. 20s CD.',
    cooldown: 20, rank: 'base',
    tips: [
      'Spawns 2 Slimy minions with random colors near you.',
      'Slimys move at skeleton speed and have 1 HP, 1 ATK, 1 DEF.',
      'Each Slimy chases adventurers within 10 tiles.',
      'On death each leaves a colored slime puddle matching its color for 3s.',
      'Puddle applies Slimed 50% slow for 3s and Poison 2% max HP/0.2s for 1s.',
      'Slimys vanish at wave end and cannot respawn once dead.',
    ],
    use(idx) { cellDivisionAttack(idx); },
  },
  spiritRace: {
    name: 'Spirit', shortName: 'SPRIT',
    desc: 'Soul Harvest: Heal 1% max HP per kill. Ethereal Veil: slow + 20% miss aura. Benevolent: -20% base ATK.',
    cooldown: 0, rank: 'base',
    tips: [
      'SOUL HARVEST — Heal 1% max HP whenever any adventurer dies.',
      'ETHEREAL VEIL — Adventurers within 2 tiles move 10% slower.',
      'ETHEREAL VEIL — Enemy attacks have a 20% chance to miss entirely.',
      'BENEVOLENT — Base ATK starts 20% lower than other races.',
      'HP REGEN — Slowly recover HP when out of combat.',
    ],
    use() {},
  },
  spiritSiphon: {
    name: 'Spirit Siphon', shortName: 'SIPH',
    desc: '80% ATK cone hit. 0.55s CD. Heals 5% of damage dealt.',
    cooldown: 0.55, rank: 'base',
    tips: [
      'Strikes all enemies in a cone toward the cursor.',
      'Damage: 80% of your ATK stat per enemy hit.',
      'Heals you for 5% of the total damage dealt.',
      'Replaces basic attack for the Spirit Race.',
    ],
    use(idx) { spiritSiphonAttack(); },
  },
  spectralGrasp: {
    name: 'Spectral Grasp', shortName: 'GRSP',
    desc: 'Ghostly hand pulls nearest adventurer 2 tiles toward you. Stuns 0.5s. 100% ATK dmg. 3s CD.',
    cooldown: 3, rank: 'base',
    tips: [
      'Reaches 4 tiles in front of the player toward the cursor.',
      'Pulls the nearest adventurer in that zone 2 tiles toward you.',
      'Stuns the target for 0.5 seconds.',
      'Deals 100% of your ATK stat as damage.',
      'Great for dragging enemies into traps.',
    ],
    use(idx) { spectralGraspAttack(idx); },
  },
  ghostlyWail: {
    name: 'Ghostly Wail', shortName: 'WAIL',
    desc: 'Cone fear toward cursor. 3 tile radius. No damage. Enemies flee 1.5s. 8s CD.',
    cooldown: 8, rank: 'base',
    tips: [
      'Releases a terrifying wail in a cone toward your cursor.',
      'Same cone width as Goblin Snatch — 100° arc.',
      '3 tile radius. Deals no damage.',
      'All enemies hit flee away from you for 1.5 seconds.',
      'Great for redirecting groups away from the Heart.',
    ],
    use(idx) { ghostlyWailAttack(idx); },
  },
  goblinEscape: {
    name: 'Goblin Maneuver', shortName: 'MNV',
    desc: 'Leap 3 tiles toward mouse. Invincible while leaping. +20% SPD for 0.5s after landing. 5s CD.',
    cooldown: 5, rank: 'base',
    tips: [
      'Instantly leap 3 tiles toward the cursor.',
      'You are invincible to all damage during the leap.',
      'Invincibility ends the moment the leap finishes.',
      'After landing: gain +20% move speed for 0.5 seconds.',
    ],
    use(idx) { goblinEscapeLeap(); },
  },

  fRankLeap: {
    name: '[F] Leap', shortName: 'LEAP',
    desc: 'Leap 2 tiles toward mouse. 5s CD.',
    cooldown: 5, rank: 'F',
    tips: [
      'Instantly leap 2 tiles toward the cursor.',
    ],
    use(idx) { playerLeapToMouse(); },
  },
  fRankBowMastery: {
    name: '[F] Bow Mastery', shortName: 'BOW',
    desc: 'Fire arrow toward mouse (150% ATK). 2s CD.',
    cooldown: 2, rank: 'F',
    tips: [
      'Fire an arrow projectile toward the cursor.',
      'Damage: 150% of your ATK stat on hit.',
    ],
    use(idx) { playerFireArrow(); },
  },
  fRankFranticCharge: {
    name: '[F] Frantic Charge', shortName: 'FRNCH',
    desc: 'Auto-run toward mouse for 0.5s at +10% SPD. Enemies hit take DPS dmg & knocked back 2 tiles. 5s CD.',
    cooldown: 5, rank: 'F',
    tips: [
      'Auto-run toward the cursor for 0.5 seconds.',
      'Move speed: +10% during the charge.',
      'Body-check enemies for 100% DPS damage.',
      'Knocks hit enemies back 2 tiles.',
      'Each enemy can only be hit once per charge.',
    ],
    use(idx) { startFranticCharge(idx); },
  },
  fRankSteelSkin: {
    name: '[F] Steel Skin', shortName: 'STLSK',
    desc: 'Passive: +5% ATK & DEF when equipped.',
    cooldown: 0, rank: 'F',
    tips: [
      'Passive bonus while this skill is equipped.',
      'ATK damage: +5%.',
      'DEF: +5%.',
    ],
    use() {},
  },
  fRankQuickFeet: {
    name: '[F] Quick Feet', shortName: 'QKFT',
    desc: '+40% move speed for 1s. 5s CD.',
    cooldown: 5, rank: 'F',
    tips: [
      'Instantly boost your move speed by 40% for 1 second.',
      'Dropped by F-rank rogues (10% chance).',
    ],
    use(idx) { quickFeetTimer = 1.0; },
  },
  sssHeavensWake: {
    name: "[SSS] Heaven's Wake", shortName: 'HVW',
    desc: "Cast 1s (80% slower while casting). Aims at cursor. Magic circle erupts with holy rain — 100% DPS dmg/0.2s for 5s. Hits all.",
    cooldown: 30, rank: 'SSS',
    tips: [
      'Cast time: 1 second. Movement is slowed 80% while casting.',
      'Using another skill cancels the cast.',
      'Summons holy rain at the cursor position.',
      'Damage: 100% of your DPS every 0.2 seconds.',
      'Rain duration: 5 seconds.',
      'Hits all enemies within the area.',
    ],
    use(idx) { startHeavensWake(idx); },
  },
  eFirebolt: {
    name: '[E] Firebolt', shortName: 'FBLT',
    desc: 'Cast 0.5s (80% slower while casting). Shoots a firebolt at cursor — 2× DPS direct + 0.5% enemy max HP burn/s for 2s. 4s CD.',
    cooldown: 4, rank: 'E',
    tips: [
      'Cast time: 0.5 seconds. Movement is slowed 80% while casting.',
      'Using another skill cancels the cast.',
      'Shoots a firebolt projectile toward the cursor.',
      'Direct hit damage: 200% of your DPS.',
      'Burns the target for 0.5% of their max HP per second.',
      'Burn duration: 2 seconds.',
    ],
    use(idx) { startFirebolt(idx); },
  },
  fLesserHeal: {
    name: '[F] Self Heal', shortName: 'SLHEAL',
    desc: 'Channel 2s (80% slower). Heals 2.5% max HP every 0.25s. Green magic circle on you while casting. 5s CD.',
    cooldown: 5, rank: 'F',
    tips: [
      'Channel for 2 seconds — movement slowed 80% while casting.',
      'Heals you for 2.5% of your max HP every 0.25 seconds (10 ticks = 25% total).',
      'Green magic circle pulses on you during the channel.',
      'Using another skill cancels the cast.',
    ],
    use(idx) { startSelfHeal(idx); },
  },
};

// ── Heaven's Wake constants ───────────────────────────────────
const HW_CAST_TIME = 1.0;
const HW_RAIN_TIME = 5.0;
const HW_FADE_TIME = 1.8;
const HW_RADIUS    = 1.5 * 40;  // 60px — 3-tile diameter circle
const HW_DMG_TICK  = 0.2;
const HW_DMG_MULT  = 1.0;  // damage per tick as multiple of player ATK

// ── Lesser Heal constants ─────────────────────────────────────
const LH_CAST_TIME  = 1.0;
const LH_HEAL_PCT   = 0.10;  // 10% of target max HP
const LH_HIT_RANGE  = 22;    // px — detection radius for friendly under cursor (legacy, unused)
const LH_AOE_RADIUS = TILE;   // 40px — radius of the 2×2 AoE heal circle

// ── Firebolt constants ────────────────────────────────────────
const FB_CAST_TIME  = 0.5;
const FB_SPEED      = 380;
const FB_DMG_MULT   = 2.0;   // direct damage as multiple of player ATK
const FB_BURN_PCT   = 0.005; // burn dmg per tick as fraction of enemy max HP
const FB_BURN_DUR   = 2.0;   // seconds burn lasts
const FB_BURN_TICK  = 1.0;   // seconds between burn ticks

const SKILL_RANK_COLOR = {
  base: '#ffffff',
  F:    '#999999',
  E:    '#ffffff',
  D:    '#44cc44',
  C:    '#4499ff',
  B:    '#aa55ff',
  A:    '#ff7722',
  S:    '#ff2266',
  SS:   '#ffee33',
  SSS:  '#ffc400',
};

function skillColor(key) {
  if (!key) return '#555566';
  const raceStarts = (player && player.race && RACES[player.race]) ? RACES[player.race].startSkills : [];
  if (raceStarts.includes(key)) return SKILL_RANK_COLOR.base;
  const sk = SKILLS[key];
  return (sk && SKILL_RANK_COLOR[sk.rank]) ? SKILL_RANK_COLOR[sk.rank] : '#555566';
}

// ── F-rank class pool (no mage until E-rank) ─────────────────
const F_CLS = ['warrior','ranger','rogue','cleric'];

// Per-class base stats, per-wave growth, and hard caps for F-rank
const F_STATS = {
  //           base               per wave            caps
  warrior: { hp:80,  dmg:12, spd:70,  hpW:18, dmgW:4, spdW:4,  maxHp:260, maxDmg:52, maxSpd:130 },
  ranger:  { hp:50,  dmg:10, spd:85,  hpW:12, dmgW:3, spdW:5,  maxHp:200, maxDmg:40, maxSpd:150 },
  rogue:   { hp:45,  dmg:14, spd:110, hpW:10, dmgW:4, spdW:6,  maxHp:170, maxDmg:48, maxSpd:180 },
  cleric:  { hp:60,  dmg:6,  spd:65,  hpW:15, dmgW:2, spdW:3,  maxHp:230, maxDmg:30, maxSpd:115 },
};

// ── Class sprites ────────────────────────────────────────────
/**
 * Each sprite is an 8×8 grid of palette indices.
 * 0 = transparent.  Colours live in the `.c` object.
 *
 * To add a new class:
 *   1. Push its name to ADV_CLS
 *   2. Add its multipliers to ADV_M
 *   3. Add a CSPR entry below
 */
const CSPR = {
  warrior: {
    s: [
      [0,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,1,2,1,1,2,1,0],
      [1,3,1,1,1,1,3,1],
      [0,1,4,4,4,1,0,5],
      [0,1,4,4,4,5,0,0],
      [0,1,1,0,0,1,1,0],
      [0,1,1,0,0,1,1,0],
    ],
    c: { 1:'#c0cce0', 2:'#1a1a33', 3:'#ddaa33', 4:'#2244bb', 5:'#ffdd44' }
  },
  mage: {
    s: [
      [0,0,1,1,0,0,0,0],
      [0,1,1,1,1,1,0,0],
      [0,0,2,2,2,0,0,5],
      [0,1,3,3,3,1,0,5],
      [0,1,3,4,3,1,0,5],
      [0,1,3,3,3,1,0,5],
      [0,0,1,3,1,0,0,0],
      [0,0,0,1,0,0,0,0],
    ],
    c: { 1:'#224488', 2:'#e8d4c4', 3:'#9944dd', 4:'#ffcc00', 5:'#886633' }
  },
  ranger: {
    s: [
      [0,1,1,1,1,0,0,0],
      [0,1,2,2,1,1,0,5],
      [0,1,2,2,2,1,0,5],
      [0,1,3,3,3,1,0,5],
      [0,1,3,3,3,1,5,0],
      [0,1,3,3,3,1,0,0],
      [0,0,1,3,1,0,0,0],
      [0,0,1,0,1,0,0,0],
    ],
    c: { 1:'#3a5c1a', 2:'#e0c090', 3:'#8b5e3c', 5:'#6b4226' }
  },
  rogue: {
    s: [
      [1,1,1,1,1,1,1,0],
      [1,1,2,1,1,2,1,0],
      [1,1,1,1,1,1,1,0],
      [1,1,3,3,3,3,1,1],
      [4,1,3,3,3,3,1,4],
      [0,1,3,3,3,3,1,0],
      [0,1,1,0,0,1,1,0],
      [0,1,0,0,0,0,1,0],
    ],
    c: { 1:'#3a3545', 2:'#ffee44', 3:'#44225a', 4:'#ccccdd' }
  },
  cleric: {
    s: [
      [0,1,1,1,1,1,0,0],
      [0,1,2,2,2,1,0,0],
      [0,0,1,2,2,1,0,0],
      [0,1,3,4,4,3,1,0],
      [0,1,4,3,3,4,1,0],
      [0,1,3,4,4,3,1,0],
      [0,1,3,3,3,3,1,0],
      [0,0,1,3,3,1,0,0],
    ],
    c: { 1:'#ddaa44', 2:'#e8c8a0', 3:'#eeeeff', 4:'#ffcc44' }
  },
};

// Hit-flash palette (all white)
const AHIT = { 1:'#fff', 2:'#fff', 3:'#fff', 4:'#fff', 5:'#fff' };

// ── Player sprite ────────────────────────────────────────────
const PSPR = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,2,2,1,1,0],
  [0,1,2,3,3,2,1,0],
  [1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,0],
  [1,4,1,1,1,1,4,1],
  [0,0,1,4,4,1,0,0],
  [0,0,4,0,0,4,0,0],
];
const PCOL = { 1:'#44cc44', 2:'#88ff88', 3:'#ffffff', 4:'#22aa22' };

// ── Race sprites ─────────────────────────────────────────────
const GOBLIN_SPR = [
  [1,0,0,1,1,0,0,1],
  [1,1,1,1,1,1,1,1],
  [0,1,2,1,1,2,1,0],
  [0,1,1,3,3,1,1,0],
  [0,0,4,4,4,4,0,0],
  [0,5,5,5,5,5,5,0],
  [0,5,6,5,5,6,5,0],
  [0,0,6,0,0,6,0,0],
];
const GOBLIN_COL = { 1:'#4db533', 2:'#cc2200', 3:'#3a8e22', 4:'#ffdd44', 5:'#8b5e14', 6:'#2a5e18' };

const SPIRIT_SPR = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,3,1,1,3,1,1],
  [0,1,0,1,1,0,1,0],
  [0,0,0,1,1,0,0,0],
];
const SPIRIT_COL = { 1:'#c8ddff', 2:'#44ffee', 3:'#88aaff' };

const SLIME_SPR = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,2,2,1,1,0],
  [1,1,1,1,1,1,1,1],
  [1,1,1,3,3,1,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,0,0,0,0,0],
];
const SLIME_COL = { 1:'#44ddaa', 2:'#0a5533', 3:'#88ffdd' };

const RACES = {
  goblin: {
    name: 'GOBLIN',
    color: '#4db533',
    desc: 'A cunning cave dweller.',
    traits: ['HP regen out of combat', '+10% coins per kill', 'Cowardly', 'Goblin minions cost 50% less', 'Agile: +20% base speed'],
    sprite: GOBLIN_SPR,
    sprColors: GOBLIN_COL,
    startSkills: ['goblinSnatch', 'goblinEscape'],
    comingSoon: false,
  },
  spirit: {
    name: 'SPIRIT',
    color: '#c8ddff',
    desc: 'An ethereal specter of the dungeon.',
    traits: ['Soul Harvest: +1% max HP on kill', 'Ethereal Veil: slow + 20% miss aura', 'Benevolent: -20% base ATK', 'HP regen out of combat'],
    sprite: SPIRIT_SPR,
    sprColors: SPIRIT_COL,
    startSkills: ['spectralGrasp', 'ghostlyWail'],
    comingSoon: false,
  },
  slime: {
    name: 'SLIME',
    color: '#44ddaa',
    desc: 'A resilient gelatinous blob.',
    traits: ['Slimy Regen: constant HP regen', 'Fatty Weakling: +50% HP / -50% ATK / -20% SPD', 'Amorphous: 15% less damage taken'],
    sprite: SLIME_SPR,
    sprColors: SLIME_COL,
    startSkills: ['acidPuddles', 'cellDivision'],
    comingSoon: false,
  },
};

// ── Heart of the Dungeon sprite ──────────────────────────────
const HSPR = [
  [0,1,1,0,0,1,1,0],
  [1,1,1,1,1,1,1,1],
  [1,2,1,1,1,1,2,1],
  [1,1,1,2,2,1,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0],
];

function foodShopItems() {
  return [
    { key:'cropTile', name:'DUNGEON SOIL', desc:'Converts a floor tile to soil', cost:100, have:ctInv, type:'tile' },
    { key:'goblinFarmer', name:'MUSHROOM FARMER', type:'minion',
      desc:'Place on Soil tiles. Generates food passively. Flees enemies. Very fragile. 150s respawn.',
      cost: MINION_TYPES.goblinFarmer.baseCost, food: MINION_TYPES.goblinFarmer.foodPerLevel,
      foodGen: MINION_TYPES.goblinFarmer.foodGenAtLevel(1),
      have: minionInventory.filter(m=>m.type==='goblinFarmer').length + placedMinions.filter(m=>m.type==='goblinFarmer').length },
  ];
}

// ── Canvas & context ─────────────────────────────────────────
const c   = document.getElementById('c');
const DPR = window.devicePixelRatio || 1;
let _gameScale = 1, _gameOx = 0, _gameOy = 0;

function resizeCanvas() {
  c.width  = Math.round(window.innerWidth  * DPR);
  c.height = Math.round(window.innerHeight * DPR);
  _gameScale = Math.min(window.innerWidth / CW, window.innerHeight / CH);
  _gameOx    = (window.innerWidth  - CW * _gameScale) / 2;
  _gameOy    = (window.innerHeight - CH * _gameScale) / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
c.setAttribute('tabindex','0');
const ctx = c.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── Global state ─────────────────────────────────────────────
let grid, player, adventurers, heart, particles, projectiles, slashAnims, flurryAnims, circleAnims, heavensWake, fireboltCast, lesserHealCast, selfHealCast, healAnims, franticCharge, goblinEscapeBoostTimer, lhAOEAnim, quickFeetTimer;
let spiritSiphonAnims, spectralGraspAnim, ghostlyWailAnim;
let slimePuddles, slimyMinions;
let screenShake;
let coins, food, wave, waveTarget, waveSpawned, waveDefeated, spawnTimer, waveTimer;
let gameState, placeMode, keys, mouse, flash, flashT, flashTop, flashTopT, focused;
let ctInv, shopOpen, shopTab, skillMenuOpen, pendingSkill, paused, pauseStart;
let invOpen, invTab;
let placedTraps, trapInventory, trapSlots, trapSlotUpgrades, trapContext;
let placedMinions, minionInventory, minionContext;
let soilContext;
let dungeonRank, fInfamy, fPartySize;
let hungerTimer, starveDrainTimer, starving;
let cam, worldRooms, worldCorridors, corridorInventory, dungeonRoomInventory;
let heartCarried, heartCarriedHp, heartCarriedMaxHp, heartEverPlaced;
let shopScrollY = 0, invScrollY = 0, skillScrollY = 0;
let emberboltDir = 'right';

// ── Init ─────────────────────────────────────────────────────
function init() {
  grid = Array.from({ length:GRID }, (_,y) =>
    Array.from({ length:GRID }, (_,x) =>
      (x===0||y===0||x===GRID-1||y===GRID-1) ? T_WALL : T_FLOOR
    )
  );
  grid[0][7] = T_FLOOR; // dungeon entrance

  player = {
    x:7*TILE+4, y:7*TILE+4, w:32, h:32,
    hp:150, maxHp:150,
    speed:165,
    atkDmg:30, atkRange:65, atkCd:0, atkCdMax:0.55,
    iframes:0, kbX:0, kbY:0,
    level:1, xp:0, xpNext:XP_BASE, def:0,
    slots:          [null, null, null, null, null, null],
    skillCds:       [0, 0, 0, 0, 0, 0],
    unlockedSkills: [],
    race:           null,
    raceSkill:      null,
    sprite:         null,
    sprColors:      null,
    combatTimer:    0,
  };

  heart       = null;
  adventurers = [];
  particles   = [];
  projectiles = [];
  slashAnims   = [];
  flurryAnims  = [];
  circleAnims  = [];
  heavensWake    = null;
  fireboltCast   = null;
  lesserHealCast = null;
  selfHealCast   = null;
  healAnims      = [];
  franticCharge  = null;
  goblinEscapeBoostTimer = 0;
  quickFeetTimer = 0;
  lhAOEAnim      = null;
  spiritSiphonAnims = [];
  spectralGraspAnim = null;
  ghostlyWailAnim   = null;
  slimePuddles      = [];
  slimyMinions      = [];
  screenShake       = { x: 0, y: 0, mag: 0, timer: 0 };

  coins       = 500;
  food        = 100;
  wave        = 1;
  waveTarget  = 0;
  waveSpawned = 0;
  waveDefeated= 0;
  spawnTimer  = 0;
  waveTimer   = 60;

  placeMode   = null;
  flash       = '';
  flashT      = 0;
  flashTop    = '';
  flashTopT   = 0;
  focused     = false;

  keys        = {};
  mouse       = { x:0, y:0 };

  ctInv       = 0;
  shopOpen      = false;
  shopTab       = 'traps';
  skillMenuOpen = false;
  pendingSkill  = null;
  paused        = false;
  pauseStart    = 0;

  placedTraps      = [];
  trapInventory    = [];
  trapSlots        = 20;
  trapSlotUpgrades = 0;
  trapContext      = null;
  soilContext      = null;

  placedMinions   = [];
  minionInventory = [];
  minionContext   = null;

  dungeonRank     = 0; // 0=F
  fInfamy         = 0;
  fPartySize      = 2; // F-rank party starts at 2, grows up to 6

  hungerTimer     = 60;
  starveDrainTimer = 1;
  starving         = false;

  cam              = { wx: 0, wy: 0, zoom: 1.0 };
  worldRooms       = [{ id: 0, wx: 0, wy: 0 }];
  worldCorridors   = [];
  corridorInventory    = 0;
  dungeonRoomInventory = 0;
  heartCarried      = false;
  heartCarriedHp    = 200;
  heartCarriedMaxHp = 200;
  heartEverPlaced   = false;

  invOpen  = false;
  invTab   = 'traps';

  gameState   = 'raceSelect';
}

// ── Race selection ────────────────────────────────────────────
function selectRace(raceName) {
  const race = RACES[raceName];
  if (!race || race.comingSoon) return;
  init(); // resets state; gameState becomes 'raceSelect', then overridden below
  player.race      = raceName;
  player.raceSkill = raceName === 'goblin' ? 'goblinRace' : raceName === 'spirit' ? 'spiritRace' : raceName === 'slime' ? 'slimeRace' : null;
  player.sprite    = race.sprite;
  player.sprColors = race.sprColors;
  if (raceName === 'goblin') { player.speed = Math.round(player.speed * 1.2); }
  if (raceName === 'spirit') player.atkDmg = Math.round(player.atkDmg * 0.8);
  if (raceName === 'slime') { player.maxHp = Math.round(player.maxHp * 1.5); player.hp = player.maxHp; player.atkDmg = Math.round(player.atkDmg * 0.5); player.speed = Math.round(player.speed * 0.8); }
  let slotIdx = 0;
  for (const sk of race.startSkills) {
    if (slotIdx < 4) player.slots[slotIdx++] = sk;
  }
  player.slots[4] = player.race === 'goblin' ? 'goblinFlurry' : player.race === 'spirit' ? 'spiritSiphon' : player.race === 'slime' ? 'slimeBalls' : 'basicAttack';
  gameState = 'build';
}

// ── Pause ────────────────────────────────────────────────────
function togglePause() {
  if (!focused || gameState === 'gameover' || gameState === 'raceSelect') return;
  if (paused) {
    paused = false;
  } else {
    pauseStart = Date.now();
    paused = true;
  }
}

// ── Raid ─────────────────────────────────────────────────────
function startRaid() {
  if (!heart || paused || gameState !== 'build' || heartCarried) return;
  trapContext = null;
  soilContext = null;
  waveTarget  = dungeonRank === 0 ? fPartySize : wave + 1;
  waveSpawned = 0;
  waveDefeated= 0;
  spawnTimer  = 1.5;
  waveTimer   = 60;
  gameState   = 'combat';
  showMsg('Wave ' + wave + ' incoming!  ' + waveTarget + ' adventurers!');
}

// ── Pathfinding (BFS) ────────────────────────────────────────
/**
 * Returns an array of [gx,gy] grid coords from (sx,sy) to (ex,ey),
 * or null if no path exists.
 * Treats T_WALL as impassable; all other tiles are walkable.
 */
function bfs(sx, sy, ex, ey, avoid = null) {
  if (sx===ex && sy===ey) return [];
  const q   = [[sx, sy, []]];
  const vis = new Set([sx+','+sy]);
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  while (q.length) {
    const [cx, cy, p] = q.shift();
    for (const [dx, dy] of dirs) {
      const nx=cx+dx, ny=cy+dy, k=nx+','+ny;
      if (vis.has(k)) continue;
      // Keep within a generous world bound
      if (nx < -32 || ny < -32 || nx > 48 || ny > 48) continue;
      // Avoid revealed quicksand when a set is provided
      if (avoid && avoid.has(k)) continue;
      // Check passability via world pixel centre of tile
      if (!isPassable(nx*TILE + TILE/2, ny*TILE + TILE/2)) continue;
      const np = [...p, [nx, ny]];
      if (nx===ex && ny===ey) return np;
      vis.add(k);
      q.push([nx, ny, np]);
    }
  }
  return null;
}

function getTrapAvoidSet() {
  const s = new Set();
  for (const t of placedTraps) {
    if (t.revealed && t.active) s.add(t.gx + ',' + t.gy);
  }
  return s.size ? s : null;
}

function getSlimePuddleAvoidSet() {
  const s = new Set();
  for (const p of slimePuddles) {
    s.add(Math.floor(p.wx / TILE) + ',' + Math.floor(p.wy / TILE));
  }
  return s.size ? s : null;
}

// ── Spawn adventurer ─────────────────────────────────────────
function spawnAdventurer() {
  waveSpawned++;
  const clsPool = dungeonRank === 0 ? F_CLS : ADV_CLS;
  let cls       = clsPool[Math.floor(Math.random() * clsPool.length)];
  // Global cleric rules (all ranks):
  //   1. Max 3 clerics active at once.
  //   2. Party can never be all clerics — if all alive adventurers are clerics, force a non-cleric.
  const aliveAdvs    = adventurers.filter(a => a.alive);
  const clericCount  = aliveAdvs.filter(a => a.cls === 'cleric').length;
  const allClerics   = aliveAdvs.length > 0 && aliveAdvs.every(a => a.cls === 'cleric');
  const noClericPool = clsPool.filter(c => c !== 'cleric');
  if (cls === 'cleric' && (clericCount >= 3 || allClerics)) {
    cls = noClericPool[Math.floor(Math.random() * noClericPool.length)];
  }

  let hp, dmg, spd;
  if (dungeonRank === 0) {
    const fs = F_STATS[cls];
    hp  = Math.min(fs.maxHp,  Math.round(fs.hp  + (wave - 1) * fs.hpW));
    dmg = Math.min(fs.maxDmg, Math.round(fs.dmg + (wave - 1) * fs.dmgW));
    spd = Math.min(fs.maxSpd, Math.round(fs.spd + (wave - 1) * fs.spdW));
  } else {
    const m    = ADV_M[cls];
    const bHp  = 40  + wave * 20;
    const bDmg = 8   + wave * 4;
    const bSpd = 85  + wave * 6;
    hp  = Math.round(bHp  * m.hp);
    dmg = Math.round(bDmg * m.dmg);
    spd = Math.round(bSpd * m.spd);
  }

  adventurers.push({
    x: 7*TILE+4, y: 2,
    cls, rank: RANKS[dungeonRank],
    hp, maxHp: hp, dmg, speed: spd,
    atkCd: 0, atkCdMax: 1.1,
    path: null, pathIdx: 0, pathT: 0,
    alive: true, flash: 0,
    loot: 14 + Math.floor(Math.random()*10),
    bobPhase: Math.random() * Math.PI * 2,
    wobble: 0,
    kbX: 0, kbY: 0,
    enteredDungeon: false,
    aggroTimer: 0, aggroTarget: null, aggroMinion: null,
    fleeing:    false,
    fleeTimer:  0, fleeFromX: 0, fleeFromY: 0,
    fartFlee: false, fartFleeTimer: 0, fartFleeX: 0, fartFleeY: 0,
    shootTimer: cls === 'ranger' ? 1.5 + Math.random() : 0,
    leapCd:     0,
    healTimer:  cls === 'cleric' ? 1.0 : 0,
    burstTimer: 1.5 + Math.random() * 2, burst: false, burstTime: 0,
    orbitDir: Math.random() > 0.5 ? 1 : -1,
    dashTimer: cls === 'rogue' ? 1.0 + Math.random() * 2.0 : 0, dashPhase: true,
    webSlowTimer: 0,
    stunTimer: 0,
    slimedTimer: 0, slimedAmt: 1.0,
    acidTimer: 0, acidDmg: 0, acidTickTimer: 0,
    burnTimer: 0, burnDmg: 0, burnTickTimer: 0,
    isHealing: false,
    luredByMimic: null,
  });
}

function advTarget() {
  if (heart && !heartCarried) return { gx: heart.gx, gy: heart.gy };
  return { gx: Math.floor((player.x+16)/TILE), gy: Math.floor((player.y+16)/TILE) };
}

// ── Game loop ─────────────────────────────────────────────────
let lastT = 0;
function loop(ts) {
  const dt = Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────
function update(dt) {
  if (flashT > 0)    flashT    -= dt;
  if (flashTopT > 0) flashTopT -= dt;
  if (gameState === 'raceSelect') return;
  if (paused || gameState === 'gameover') return;

  // Auto rank-up when F-Infamy hits 100
  if (dungeonRank === 0 && fInfamy >= INFAMY_CAP) {
    fInfamy    -= INFAMY_CAP;
    dungeonRank++;
    wave        = 1;
    waveTimer   = 60;
    adventurers = [];
    projectiles = [];
    particles   = [];
    slashAnims   = [];
    circleAnims  = [];
    heavensWake    = null;
    fireboltCast   = null;
    lesserHealCast = null;
    selfHealCast   = null;
    healAnims      = [];
    franticCharge  = null;
    goblinEscapeBoostTimer = 0;
    quickFeetTimer = 0;
    lhAOEAnim      = null;
    spiritSiphonAnims = [];
    spectralGraspAnim = null;
    ghostlyWailAnim   = null;
    slimePuddles      = [];
    slimyMinions      = [];
    trapContext    = null;
    soilContext    = null;
    for (const t of placedTraps) { t.revealed = false; t.active = true; t.cooldownTimer = 0; if (t.type === 'groundSpikes') t.durability = TRAP_TYPES.groundSpikes.durabilityAtLevel(t.level); }
    gameState   = 'build';
    showMsg('100 F-Infamy!  Dungeon ranked to ' + RANKS[dungeonRank] + '!');
    burst(DW/2, CH/2, ['#ffdd00','#ff88ff','#44bbff','#88dd44'], 20);
  }

  updateScreenShake(dt);
  for (const p of particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= (1 - dt*3); p.vy *= (1 - dt*3); p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const s of slashAnims) s.life -= dt;
  slashAnims = slashAnims.filter(s => s.life > 0);
  for (const f of flurryAnims) f.life -= dt;
  flurryAnims = flurryAnims.filter(f => f.life > 0);
  for (const c of circleAnims) c.life -= dt;
  circleAnims = circleAnims.filter(c => c.life > 0);
  for (const h of healAnims) h.life -= dt;
  healAnims = healAnims.filter(h => h.life > 0);
  if (lhAOEAnim) { lhAOEAnim.life -= dt; if (lhAOEAnim.life <= 0) lhAOEAnim = null; }
  for (const s of spiritSiphonAnims) s.life -= dt;
  spiritSiphonAnims = spiritSiphonAnims.filter(s => s.life > 0);
  if (spectralGraspAnim) { spectralGraspAnim.life -= dt; if (spectralGraspAnim.life <= 0) spectralGraspAnim = null; }
  if (ghostlyWailAnim)   { ghostlyWailAnim.life   -= dt; if (ghostlyWailAnim.life   <= 0) ghostlyWailAnim   = null; }
  for (const trap of placedTraps) {
    if (trap.cooldownTimer > 0) {
      trap.cooldownTimer -= dt;
      if (trap.cooldownTimer <= 0) { trap.cooldownTimer = 0; trap.active = true; }
    }
  }

  updateMovement(dt);

  // Goblin / Spirit: slow out-of-combat HP regen (paused while carrying heart)
  if ((player.race === 'goblin' || player.race === 'spirit') && !heartCarried) {
    if (player.combatTimer > 0) player.combatTimer -= dt;
    else if (player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.015 * dt);
    }
  }
  // Slime: constant regen even in combat (0.3%/s)
  if (player.race === 'slime' && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.003 * dt);
  }


  // Hunger: consume (5 × level + minion upkeep) food every 60s
  hungerTimer -= dt;
  if (hungerTimer <= 0) {
    hungerTimer = 60;
    const minionUpkeep = placedMinions.reduce((s, m) => s + m.level * MINION_TYPES[m.type].foodPerLevel, 0);
    const cost = 5 * player.level + minionUpkeep;
    if (food >= cost) {
      food -= cost;
      if (starving) { starving = false; showMsg('Food supply restored!  Starvation ended.'); }
    } else {
      food = 0; // consume remainder, cannot go negative
      if (!starving) {
        starving = true;
        showMsg('⚠ Starving!  Heart drains 2%/s until food is restored!');
      }
    }
  }
  // Every second: check food; drain heart 2% of max HP if food = 0
  starveDrainTimer -= dt;
  if (starveDrainTimer <= 0) {
    starveDrainTimer = 1;
    if (food > 0) {
      if (starving) { starving = false; showMsg('Food supply restored!  Starvation ended.'); }
    } else {
      if (!starving) { starving = true; showMsg('⚠ Starving!  Heart drains 2%/s until food is restored!'); }
      if (heart) {
        heart.hp = Math.max(0, heart.hp - heart.maxHp * 0.02);
        if (heart.hp <= 0) { gameState = 'gameover'; return; }
      }
    }
  }

  updateMinions(dt);      // runs in both build and combat
  updateSlimyMinions(dt);
  updateSlimePuddles(dt);
  if (heart) updateSkillCds(dt);
  updateHeavensWake(dt);   // runs in both so cast/rain works outside of raids
  updateFireboltCast(dt);   // runs in both so cast works outside of raids
  updateLesserHealCast(dt); // runs in both so cast works outside of raids
  updateSelfHealCast(dt);   // runs in both so channel works outside of raids
  updateFranticCharge(dt);  // runs in both so charge movement works outside of raids
  updateProjectiles(dt);   // runs in both so skill projectiles move outside of raids

  if (keys['Space']) useSkill(4);

  if (gameState === 'build') {
    if (heartEverPlaced && !heartCarried) {
      waveTimer -= dt;
      if (waveTimer <= 0) {
        if (heart) startRaid();
        else { waveTimer = 60; showMsg('Place your Heart!  Wave delayed.'); }
      }
    }
    return;
  }

  if (gameState === 'combat') {
    updateEmberboltTraps(dt);
    updateAdventurers(dt);
    spawnTimer -= dt;
    if (waveSpawned < waveTarget && spawnTimer <= 0) {
      spawnAdventurer();
      spawnTimer = 0.18 + Math.random() * 0.12;
    }
    if (waveSpawned >= waveTarget && waveDefeated >= waveTarget) {
      const prev = wave;
      wave++;
      waveTimer = 60;
      gameState = 'build';
      adventurers  = [];
      heavensWake  = null;
      fireboltCast = null;
      for (const t of placedTraps) { if (t.type !== 'emberbolt') { t.revealed = false; t.active = true; t.cooldownTimer = 0; if (t.type === 'groundSpikes') t.durability = TRAP_TYPES.groundSpikes.durabilityAtLevel(t.level); } }
      if (heart && heart.hp < heart.maxHp) {
        heart.hp = Math.min(heart.maxHp, heart.hp + heart.maxHp * 0.10);
      }
      slimePuddles = [];
      slimyMinions = [];
      // F-rank: 50% chance to grow party size each cleared wave (max 6)
      if (dungeonRank === 0 && fPartySize < 6 && Math.random() < 0.5) {
        fPartySize++;
        showMsg('Wave ' + prev + ' cleared!  Party grew to ' + fPartySize + '!');
      } else {
        showMsg('Wave ' + prev + ' cleared!  Next wave in 60s');
      }
    }
    if (heart && heart.hp <= 0) {
      gameState = 'gameover';
    } else if (player.hp <= 0) {
      if (heart) {
        // Respawn near heart — try adjacent tiles
        const candidates = [
          [heart.x + TILE, heart.y], [heart.x - TILE, heart.y],
          [heart.x, heart.y - TILE], [heart.x, heart.y + TILE],
          [heart.x + TILE, heart.y + TILE], [heart.x - TILE, heart.y - TILE],
        ];
        let rx = heart.x, ry = heart.y;
        for (const [cx, cy] of candidates) {
          if (canMove(cx, cy, 32, 32)) { rx = cx; ry = cy; break; }
        }
        player.x       = rx;
        player.y       = ry;
        player.hp      = Math.round(player.maxHp * 0.3);
        player.iframes = 3.0;
        showMsg('You fell!  Respawned at Heart!');
        burst(player.x+16, player.y+16, ['#44ff44','#aaffaa','#ffffff'], 10);
      } else {
        gameState = 'gameover';
      }
    }
  }
}

function updateMovement(dt) {
  if (!franticCharge) {
    let vx = 0, vy = 0;
    if (keys['KeyW']||keys['ArrowUp'])    vy = -player.speed;
    if (keys['KeyS']||keys['ArrowDown'])  vy =  player.speed;
    if (keys['KeyA']||keys['ArrowLeft'])  vx = -player.speed;
    if (keys['KeyD']||keys['ArrowRight']) vx =  player.speed;
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }
    if (inHeavensWake(player.x+16, player.y+16)) { vx *= 0.5; vy *= 0.5; }
    if ((heavensWake && heavensWake.phase === 'casting') || fireboltCast || selfHealCast) { vx *= 0.2; vy *= 0.2; }
    if (player.raceSkill === 'goblinRace' && player.hp < player.maxHp * 0.3) { vx *= 1.25; vy *= 1.25; }
    if (goblinEscapeBoostTimer > 0) { vx *= 1.2; vy *= 1.2; goblinEscapeBoostTimer -= dt; }
    if (quickFeetTimer > 0) { vx *= 1.4; vy *= 1.4; quickFeetTimer -= dt; }
    const nx = player.x + vx*dt, ny = player.y + vy*dt;
    if (canMove(nx, player.y, 32, 32)) player.x = nx;
    if (canMove(player.x, ny, 32, 32)) player.y = ny;
  }
  if (player.kbX || player.kbY) {
    const kbNX = player.x + player.kbX * dt;
    const kbNY = player.y + player.kbY * dt;
    if (canMove(kbNX, player.y, 32, 32)) player.x = kbNX; else player.kbX = 0;
    if (canMove(player.x, kbNY, 32, 32)) player.y = kbNY; else player.kbY = 0;
    player.kbX *= (1 - dt * 14);
    player.kbY *= (1 - dt * 14);
    if (Math.abs(player.kbX) < 2) player.kbX = 0;
    if (Math.abs(player.kbY) < 2) player.kbY = 0;
  }
  if (player.atkCd > 0)    player.atkCd    -= dt;
  if (player.iframes > 0)  player.iframes  -= dt;
  // Smooth camera follow
  const targetWX = player.x + 16 - (DW / 2) / cam.zoom;
  const targetWY = player.y + 16 - (CH / 2) / cam.zoom;
  cam.wx += (targetWX - cam.wx) * Math.min(1, 8 * dt);
  cam.wy += (targetWY - cam.wy) * Math.min(1, 8 * dt);
}

function isPassable(px, py) {
  const gx = Math.floor(px / TILE), gy = Math.floor(py / TILE);
  if (gx >= 0 && gy >= 0 && gx < GRID && gy < GRID) return grid[gy][gx] !== T_WALL;
  for (const c of worldCorridors) {
    if (px < c.pxMin || px >= c.pxMax || py < c.pyMin || py >= c.pyMax) continue;
    const isEW = c.dir === 'E' || c.dir === 'W';
    const cols = isEW ? 8 : 5, rows = isEW ? 5 : 8;
    const lgx = Math.floor((px-c.pxMin)/TILE), lgy = Math.floor((py-c.pyMin)/TILE);
    if (lgx < 0 || lgy < 0 || lgx >= cols || lgy >= rows) return false;
    return c.grid[lgy][lgx] !== T_WALL;
  }
  for (const r of worldRooms) {
    if (r.id === 0) continue;
    const ox = r.wx * TILE, oy = r.wy * TILE;
    const rgx = Math.floor((px - ox) / TILE), rgy = Math.floor((py - oy) / TILE);
    if (rgx >= 0 && rgy >= 0 && rgx < GRID && rgy < GRID) return r.grid[rgy][rgx] !== T_WALL;
  }
  return false;
}

function canMove(px, py, w, h) {
  for (const [cx,cy] of [[px,py],[px+w,py],[px,py+h],[px+w,py+h]]) {
    if (!isPassable(cx, cy)) return false;
  }
  return true;
}

function canMoveAdv(ax, ay) {
  for (const [cx,cy] of [[ax,ay],[ax+30,ay],[ax,ay+30],[ax+30,ay+30]]) {
    if (!isPassable(cx, cy)) return false;
  }
  return true;
}

function canMoveAdv2x2(ax, ay) {
  for (const [cx,cy] of [[ax,ay],[ax+76,ay],[ax,ay+76],[ax+76,ay+76]]) {
    if (!isPassable(cx, cy)) return false;
  }
  return true;
}

function updateAdventurers(dt) {
  for (const a of adventurers) {
    if (!a.alive) continue;
    if (a.flash > 0)          a.flash          -= dt;
    if (a.aggroTimer > 0)     a.aggroTimer     -= dt;
    if (a.webSlowTimer > 0)   a.webSlowTimer   -= dt;
    if (a.stunTimer > 0)      a.stunTimer      -= dt;
    if (a.slimedTimer > 0)    a.slimedTimer    -= dt;
    a.isHealing = false;
    if (a.burnTimer > 0) {
      a.burnTimer     -= dt;
      a.burnTickTimer -= dt;
      if (a.burnTickTimer <= 0) {
        a.burnTickTimer = FB_BURN_TICK;
        a.hp -= a.burnDmg;
        a.flash = 0.10;
        burst(a.x+16, a.y+16, ['#ff4400','#ff8800','#ffcc22'], 3);
        if (a.hp <= 0) killAdventurer(a);
      }
    }
    if (a.poisonTimer > 0) {
      a.poisonTimer     -= dt;
      a.poisonTickTimer -= dt;
      if (a.poisonTickTimer <= 0) {
        a.poisonTickTimer = 0.5;
        a.hp -= a.poisonDmg;
        a.flash = 0.08;
        burst(a.x+16, a.y+16, ['#44cc22','#66ee33','#22aa11'], 2);
        if (a.hp <= 0) killAdventurer(a);
      }
    }
    if (a.acidTimer > 0) {
      a.acidTimer     -= dt;
      a.acidTickTimer -= dt;
      if (a.acidTickTimer <= 0) {
        a.acidTickTimer = 0.2;
        a.hp -= a.acidDmg;
        a.flash = 0.08;
        burst(a.x+16, a.y+16, ['#22cc44','#44ff66','#00aa22'], 2);
        if (a.hp <= 0) killAdventurer(a);
      }
    }
    if (!a.enteredDungeon && a.y >= TILE) a.enteredDungeon = true;

    // Knockback decay (wall-clamped)
    if (a.kbX || a.kbY) {
      const kbNX = a.x + a.kbX * dt;
      const kbNY = a.y + a.kbY * dt;
      if (canMoveAdv(kbNX, a.y)) a.x = kbNX; else a.kbX = 0;
      if (canMoveAdv(a.x, kbNY)) a.y = kbNY; else a.kbY = 0;
      a.kbX *= (1 - dt*14);
      a.kbY *= (1 - dt*14);
      if (Math.abs(a.kbX) < 2) a.kbX = 0;
      if (Math.abs(a.kbY) < 2) a.kbY = 0;
    }

    // Quicksand speed multiplier for this adventurer this frame
    const _qsAdv = placedTraps.find(t =>
      t.type === 'quicksand' && t.revealed &&
      Math.floor((a.x+16)/TILE) === t.gx && Math.floor((a.y+16)/TILE) === t.gy
    );
    const qsAdvMult = _qsAdv ? 0.6 : 1.0; // 40% speed reduction

    // Stun (Spectral Grasp)
    let skipPath = false;
    if (a.stunTimer > 0) skipPath = true;
    if (a.fartFlee) {
      a.fartFleeTimer -= dt;
      if (a.fartFleeTimer <= 0) {
        a.fartFlee = false;
      } else {
        const fdx = a.fartFleeX - (a.x+16), fdy = a.fartFleeY - (a.y+16);
        const fdist = Math.hypot(fdx, fdy) || 1;
        const fnx = a.x - (fdx/fdist) * a.speed * qsAdvMult * dt;
        const fny = a.y - (fdy/fdist) * a.speed * qsAdvMult * dt;
        if (canMoveAdv(fnx, a.y)) a.x = fnx;
        if (canMoveAdv(a.x, fny)) a.y = fny;
        skipPath = true;
      }
    }
    // Cleric: flee from attacker for 3s
    if (a.cls === 'cleric' && a.fleeTimer > 0 && !skipPath) {
      a.fleeTimer -= dt;
      if (a.fleeTimer <= 0) { a.fleeing = false; }
      const fdx    = a.fleeFromX - (a.x+16);
      const fdy    = a.fleeFromY - (a.y+16);
      const fdist  = Math.hypot(fdx, fdy) || 1;
      const fleeNX = a.x - (fdx/fdist) * a.speed * qsAdvMult * dt;
      const fleeNY = a.y - (fdy/fdist) * a.speed * qsAdvMult * dt;
      if (canMoveAdv(fleeNX, a.y)) a.x = fleeNX;
      if (canMoveAdv(a.x, fleeNY)) a.y = fleeNY;
      skipPath = true;
    }
    // Cleric: if any injured ally is within heal range, stop and heal in place
    if (a.cls === 'cleric' && !skipPath) {
      const hasNearby = adventurers.some(o =>
        o !== a && o.alive && o.hp < o.maxHp &&
        Math.hypot((o.x+16)-(a.x+16),(o.y+16)-(a.y+16)) <= 120
      );
      if (hasNearby) {
        a.isHealing = true;
        a.healTimer -= dt;
        if (a.healTimer <= 0) { a.healTimer = 1.0; healAlly(a); }
        skipPath = true;
      }
    }

    if (!skipPath) {
      // Determine BFS target based on class + aggro
      let ptgx, ptgy;
      if (a.aggroTimer > 0) {
        // Chase whoever attacked us (minion or player)
        if (a.aggroTarget === 'minion' && a.aggroMinion && a.aggroMinion.alive) {
          ptgx = Math.floor((a.aggroMinion.x+16)/TILE); ptgy = Math.floor((a.aggroMinion.y+16)/TILE);
        } else {
          ptgx = Math.floor((player.x+16)/TILE);
          ptgy = Math.floor((player.y+16)/TILE);
        }
      } else if (a.luredByMimic && a.luredByMimic.alive && a.luredByMimic.mimicForm === 'chest') {
        // Lured to mimic chest — all classes BFS toward it (overrides normal AI)
        ptgx = Math.floor((a.luredByMimic.x+16)/TILE);
        ptgy = Math.floor((a.luredByMimic.y+16)/TILE);
      } else {
        if (a.cls === 'cleric' && a.rank === 'F') {
          let cBest = null, cBestRatio = 1.0;
          for (const other of adventurers) {
            if (other === a || !other.alive) continue;
            const d = Math.hypot((other.x+16)-(a.x+16),(other.y+16)-(a.y+16));
            if (d > 240) continue; // outside detect range
            const ratio = other.hp / other.maxHp;
            if (ratio < cBestRatio) { cBestRatio = ratio; cBest = other; }
          }
          if (cBest) {
            ptgx = Math.floor((cBest.x+16)/TILE);
            ptgy = Math.floor((cBest.y+16)/TILE);
          } else {
            const t = advTarget(); ptgx = t.gx; ptgy = t.gy;
          }
        } else if (a.cls === 'warrior' && a.rank === 'F') {
          // F-rank warrior: nearest minion within 6 tiles always wins, else player
          const AGGRO_RANGE = 6 * TILE;
          let nearestMinion = null, nearestMinionDist = AGGRO_RANGE + 1;
          for (const mn of placedMinions) {
            if (!mn.alive) continue;
            const md = Math.hypot((mn.x+16)-(a.x+16), (mn.y+16)-(a.y+16));
            if (md < AGGRO_RANGE && md < nearestMinionDist) { nearestMinionDist = md; nearestMinion = mn; }
          }
          if (nearestMinion) {
            ptgx = Math.floor((nearestMinion.x+16)/TILE); ptgy = Math.floor((nearestMinion.y+16)/TILE);
          } else {
            ptgx = Math.floor((player.x+16)/TILE);
            ptgy = Math.floor((player.y+16)/TILE);
          }
        } else if (a.cls === 'ranger' && a.rank === 'F') {
          // F-rank ranger: nearest minion within 6 tiles, else player; flee if player too close
          const DETECT_RANGE = 6 * TILE;
          let nearestMinion = null, nearestMinionDist = DETECT_RANGE + 1;
          for (const mn of placedMinions) {
            if (!mn.alive) continue;
            const md = Math.hypot((mn.x+16)-(a.x+16), (mn.y+16)-(a.y+16));
            if (md < DETECT_RANGE && md < nearestMinionDist) { nearestMinionDist = md; nearestMinion = mn; }
          }
          if (nearestMinion) {
            ptgx = Math.floor((nearestMinion.x+16)/TILE); ptgy = Math.floor((nearestMinion.y+16)/TILE);
          } else {
            const playerDist = Math.hypot((player.x+16)-(a.x+16), (player.y+16)-(a.y+16));
            if (playerDist < 4 * TILE) {
              const fdx = (a.x+16)-(player.x+16), fdy = (a.y+16)-(player.y+16);
              const flen = Math.hypot(fdx, fdy) || 1;
              ptgx = Math.max(1, Math.min(GRID-2, Math.floor((a.x+16)/TILE) + Math.round((fdx/flen)*5)));
              ptgy = Math.max(1, Math.min(GRID-2, Math.floor((a.y+16)/TILE) + Math.round((fdy/flen)*5)));
            } else {
              ptgx = Math.floor((player.x+16)/TILE);
              ptgy = Math.floor((player.y+16)/TILE);
            }
          }
        } else {
          // No aggro — all other classes default to heart (or player if no heart)
          const t = advTarget();
          ptgx = t.gx; ptgy = t.gy;
        }
      }

      // Repath periodically
      a.pathT -= dt;
      if (!a.path || a.pathIdx >= a.path.length || a.pathT <= 0) {
        const agx = Math.floor((a.x+16)/TILE);
        const agy = Math.floor((a.y+16)/TILE);
        const trapAvoid = getTrapAvoidSet();
        const puddleAvoid = getSlimePuddleAvoidSet();
        let avoidSet = null;
        if (trapAvoid && puddleAvoid) {
          avoidSet = new Set([...trapAvoid, ...puddleAvoid]);
        } else {
          avoidSet = trapAvoid || puddleAvoid;
        }
        let p = avoidSet ? bfs(agx, agy, ptgx, ptgy, avoidSet) : bfs(agx, agy, ptgx, ptgy);
        if (p === null && avoidSet) p = bfs(agx, agy, ptgx, ptgy); // fallback: walk through if no other route
        if (p !== null) { a.path = p; a.pathIdx = 0; }
        a.pathT = 0.7 + Math.random() * 0.5;
      }

      // Path following + class personality
      if (a.path && a.pathIdx < a.path.length) {
        const [tgx, tgy] = a.path[a.pathIdx];
        const tx = tgx*TILE+4, ty = tgy*TILE+4;
        const pdx = tx - a.x, pdy = ty - a.y;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist < 3) {
          a.pathIdx++;
        } else {
          let nx = pdx/pdist, ny = pdy/pdist;
          const veilSlow = (player.raceSkill === 'spiritRace' && Math.hypot((a.x+16)-(player.x+16),(a.y+16)-(player.y+16)) <= TILE*2) ? 0.9 : 1.0;
          const slimedMult = a.slimedTimer > 0 ? a.slimedAmt : 1.0;
          let spd = a.speed * ((a.webSlowTimer > 0 || inHeavensWake(a.x+16, a.y+16)) ? 0.5 : 1.0) * qsAdvMult * veilSlow * slimedMult, ex = 0, ey = 0;
          a.bobPhase += dt * 8;
          const t2    = advTarget();
          const tdx   = (t2.gx*TILE+16) - (a.x+16);
          const tdy   = (t2.gy*TILE+16) - (a.y+16);
          const tdist = Math.hypot(tdx, tdy);
          const perp  = { x:-ny, y:nx };

          switch (a.cls) {
            case 'warrior':
              if (a.rank === 'F') {
                a.burstTimer -= dt;
                if (a.burstTimer <= 0 && !a.burst) {
                  a.burst = true; a.burstTime = 0.48;
                  a.burstTimer = 2.5 + Math.random() * 1.5;
                }
                if (a.burst) {
                  a.burstTime -= dt;
                  if (a.burstTime <= 0) a.burst = false;
                  else spd *= 2.3;
                }
                ex = Math.sin(a.bobPhase * 0.35) * 0.1;
              }
              break;

            case 'mage':
              if (a.rank === 'F') {
                if (tdist < 3.5 * TILE) {
                  nx = -(tdx/tdist) * 0.65 + nx * 0.35;
                  ny = -(tdy/tdist) * 0.65 + ny * 0.35;
                }
                ex = perp.x * a.orbitDir * 0.42;
                ey = perp.y * a.orbitDir * 0.42;
              }
              break;

            case 'ranger': {
              if (a.rank === 'F') {
              // Shoot on timer
              a.shootTimer -= dt;
              if (a.shootTimer <= 0) {
                a.shootTimer = 2.0 + Math.random() * 1.0;
                fireRangerProjectile(a);
              }
              // Leap away from player when too close; stronger 2-tile leap on same tile
              if (a.leapCd > 0) a.leapCd -= dt;
              const lpx = (a.x+16)-(player.x+16), lpy = (a.y+16)-(player.y+16);
              const lpdist = Math.hypot(lpx, lpy);
              // Leap out of slime puddles
              if (a.leapCd <= 0) {
                const agxR = Math.floor((a.x+16)/TILE), agyR = Math.floor((a.y+16)/TILE);
                const onPuddle = slimePuddles.some(sp =>
                  Math.floor(sp.wx/TILE) === agxR && Math.floor(sp.wy/TILE) === agyR
                );
                if (onPuddle) {
                  const puddle = slimePuddles.find(sp =>
                    Math.floor(sp.wx/TILE) === agxR && Math.floor(sp.wy/TILE) === agyR
                  );
                  const pcx = puddle.wx + TILE/2, pcy = puddle.wy + TILE/2;
                  const fdx = (a.x+16) - pcx, fdy = (a.y+16) - pcy;
                  const flen = Math.hypot(fdx, fdy) || 1;
                  a.kbX = (fdx/flen) * 1400;
                  a.kbY = (fdy/flen) * 1400;
                  a.leapCd = 2.5;
                  burst(a.x+16, a.y+16, ['#88ff44','#44cc00'], 8);
                }
              }
              if (a.leapCd <= 0) {
                const agx = Math.floor((a.x+16)/TILE), agy = Math.floor((a.y+16)/TILE);
                const sameTile = agx === Math.floor((player.x+16)/TILE) && agy === Math.floor((player.y+16)/TILE);
                const minionSameTile = !sameTile && placedMinions.find(m =>
                  m.alive &&
                  !(m.type === 'mimic' && m.mimicForm === 'chest') &&
                  agx === Math.floor((m.x+16)/TILE) && agy === Math.floor((m.y+16)/TILE)
                );
                const advSameTile = !sameTile && !minionSameTile && adventurers.find(o =>
                  o !== a && o.alive &&
                  agx === Math.floor((o.x+16)/TILE) && agy === Math.floor((o.y+16)/TILE)
                );
                const crowded = sameTile || minionSameTile || advSameTile;
                if (crowded) {
                  let rdx, rdy;
                  if (minionSameTile) {
                    rdx = (a.x+16) - (minionSameTile.x+16);
                    rdy = (a.y+16) - (minionSameTile.y+16);
                  } else if (advSameTile) {
                    rdx = (a.x+16) - (advSameTile.x+16);
                    rdy = (a.y+16) - (advSameTile.y+16);
                  } else {
                    rdx = lpdist > 1 ? lpx/(lpdist||1) : (Math.random()*2-1);
                    rdy = lpdist > 1 ? lpy/(lpdist||1) : (Math.random()*2-1);
                  }
                  const ln = Math.hypot(rdx, rdy) || 1;
                  a.kbX = (rdx/ln) * 1100;
                  a.kbY = (rdy/ln) * 1100;
                  a.leapCd = 2.2 + Math.random() * 0.6;
                  burst(a.x+16, a.y+16, ['#aaeecc','#55bbaa'], 10);
                } else if (lpdist < TILE * 1.8) {
                  const ll = lpdist || 1;
                  a.kbX = (lpx/ll) * 520;
                  a.kbY = (lpy/ll) * 520;
                  a.leapCd = 2.2 + Math.random() * 0.6;
                  burst(a.x+16, a.y+16, ['#aaeecc','#55bbaa'], 5);
                }
              }
              // Strafe: keep distance, orbit
              if (tdist < 3 * TILE) {
                nx = nx * 0.15 + perp.x * a.orbitDir * 0.95;
                ny = ny * 0.15 + perp.y * a.orbitDir * 0.95;
              } else {
                ex = perp.x * a.orbitDir * 0.55;
                ey = perp.y * a.orbitDir * 0.55;
              }
              } // end rank === 'F'
              break;
            }

            case 'rogue':
              if (a.rank === 'F') {
                // Speed burst
                a.dashTimer -= dt;
                if (a.dashPhase) {
                  if (a.dashTimer <= 0) {
                    a.dashPhase = false;
                    a.dashTimer = 0.4;
                    burst(a.x+16, a.y+16, ['#ffee44','#cc88ff','#ffffff'], 6);
                  }
                } else {
                  if (a.dashTimer <= 0) {
                    a.dashPhase = true;
                    a.dashTimer = 2.0 + Math.random() * 2.5;
                  } else {
                    spd *= 1.4;
                  }
                }
                // Smooth fast movement with a slight weave
                a.wobble += dt * 3;
                ex = Math.sin(a.wobble) * 0.12;
              }
              break;

            case 'cleric':
              if (a.rank === 'F') {
                a.wobble += dt * 2;
                ex = Math.sin(a.wobble) * 0.2;
                spd *= 0.88;
              }
              break;
          }

          const tx2 = nx + ex, ty2 = ny + ey;
          const tlen = Math.hypot(tx2, ty2) || 1;
          const mvX  = (tx2/tlen) * spd * dt;
          const mvY  = (ty2/tlen) * spd * dt;
          if (canMoveAdv(a.x + mvX, a.y)) a.x += mvX;
          if (canMoveAdv(a.x, a.y + mvY)) a.y += mvY;
        }
      }
    }

    // Emberbolt fire arrow dodge
    if (a.enteredDungeon && a.alive) {
      for (const p of projectiles) {
        if (p.owner !== 'trap_emberbolt') continue;
        const pSpd = Math.hypot(p.vx, p.vy) || 1;
        const pnx = p.vx/pSpd, pny = p.vy/pSpd;
        const relX = (a.x+16) - p.x, relY = (a.y+16) - p.y;
        const ahead = relX*pnx + relY*pny;
        if (ahead <= 0 || ahead > 120) continue;
        if (Math.abs(relX*pny - relY*pnx) > 22) continue;
        const dnx = a.x + (-pny) * 55 * dt;
        const dny = a.y + pnx * 55 * dt;
        if (canMoveAdv(dnx, a.y)) a.x = dnx;
        if (canMoveAdv(a.x, dny)) a.y = dny;
      }
    }

    // Trap trigger (works anywhere in the world)
    if (a.enteredDungeon && a.alive) {
      const tgx = Math.floor((a.x+16)/TILE), tgy = Math.floor((a.y+16)/TILE);
      const tRes = resolveWorldTile(a.x+16, a.y+16);
      if (tRes && tRes.grid[tRes.lgy][tRes.lgx] === T_TRAP) {
        const trap = placedTraps.find(t => t.gx===tgx && t.gy===tgy);
        if (trap && !trap.revealed) {
          trap.revealed = true;
          const cfg = TRAP_TYPES[trap.type];
          burst(trap.gx*TILE+20, trap.gy*TILE+20, [cfg.accentColor, cfg.color, '#ffffff'], 8);
          showMsg(cfg.name + ' revealed!');
          for (const adv of adventurers) { if (adv.alive) adv.path = null; }
          // Non-quicksand traps fire their effect on reveal
          if (trap.type !== 'quicksand' && trap.type !== 'emberbolt' && trap.active) {
            triggerTrap(trap, a);
          }
        } else if (trap && trap.revealed && trap.type !== 'quicksand' && trap.type !== 'emberbolt' && trap.active) {
          // Trap is known but still fires if adventurer walks through (e.g. forced path)
          triggerTrap(trap, a);
        }
      }
      // Quicksand zone: 1% maxHp/s damage while standing on a revealed tile
      const qsTrap = placedTraps.find(t =>
        t.type === 'quicksand' && t.revealed &&
        Math.floor((a.x+16)/TILE) === t.gx && Math.floor((a.y+16)/TILE) === t.gy
      );
      if (qsTrap) {
        if (!a.qsDmgAcc) a.qsDmgAcc = 0;
        a.qsDmgAcc += dt;
        const cfg = TRAP_TYPES.quicksand;
        const dmgPct = 0.01 * qsTrap.level;
        if (a.qsDmgAcc >= 1.0) {
          a.qsDmgAcc -= 1.0;
          const dmg = Math.max(1, Math.round(a.maxHp * dmgPct));
          a.hp -= dmg;
          a.flash = 0.15;
          if (a.hp <= 0) killAdventurer(a);
        }
      } else {
        a.qsDmgAcc = 0;
      }
    }

    // Attack player or heart (ranger is ranged-only — no melee)
    if (a.stunTimer <= 0) a.atkCd -= dt * (a.slimedTimer > 0 ? a.slimedAmt : 1.0);
    if (a.atkCd <= 0 && a.stunTimer <= 0) {
      let atk = false;
      const dp = Math.hypot((player.x+16)-(a.x+16), (player.y+16)-(a.y+16));
      if (dp < 44 && player.iframes <= 0 && a.cls !== 'cleric' && a.cls !== 'ranger') {
        if (player.raceSkill === 'spiritRace' && Math.random() < 0.20) {
          a.atkCd = a.atkCdMax; atk = true;
          burst(player.x+16, player.y+16, ['#c8ddff','#aabbff','#ffffff'], 4);
        } else {
        const _mRaw = Math.max(1, a.dmg - playerEffDef());
        const _mDmg = player.raceSkill === 'slimeRace' ? Math.max(1, Math.round(_mRaw * 0.85)) : _mRaw;
        player.hp          = Math.max(0, player.hp - _mDmg);
        player.iframes     = 0.5;
        player.combatTimer = 5;
        a.atkCd            = a.atkCdMax;
        atk = true;
        addScreenShake(3);
        burst(player.x+16, player.y+16, ['#ff2244','#ff6688'], 4);
        if (a.cls === 'warrior' && a.burst) {
          const kdx = (player.x+16) - (a.x+16), kdy = (player.y+16) - (a.y+16);
          const kln = Math.hypot(kdx, kdy) || 1;
          player.kbX = (kdx/kln) * 500;
          player.kbY = (kdy/kln) * 500;
        }
        } // end else (not a miss)
      }
      if (!atk && heart && a.cls !== 'ranger' && a.cls !== 'cleric') {
        const dh = Math.hypot((heart.x+16)-(a.x+16), (heart.y+16)-(a.y+16));
        if (dh < 44) { heart.hp = Math.max(0, heart.hp - a.dmg); a.atkCd = a.atkCdMax; atk = true; }
      }
      if (!atk && a.cls !== 'cleric' && a.cls !== 'ranger') {
        for (const m of placedMinions) {
          if (!m.alive) continue;
          const _mhx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
          const _mhy = m.type === 'giantSpider' ? m.y+40 : m.y+16;
          const dm = Math.hypot(_mhx-(a.x+16), _mhy-(a.y+16));
          if (dm < 44) {
            const mDef = (MINION_TYPES[m.type].statsAtLevel(m.level).def) || 0;
            m.hp = Math.max(0, m.hp - Math.max(1, a.dmg - mDef));
            m.flash = 0.15;
            m.combatTimer = 5;
            a.atkCd = a.atkCdMax;
            burst(_mhx, _mhy, ['#ff4444','#ff8844'], 3);
            if (m.hp <= 0) killMinion(m);
            break;
          }
        }
      }
      if (!atk && a.cls !== 'cleric' && a.cls !== 'ranger') {
        for (const sm of slimyMinions) {
          if (!sm.alive) continue;
          const dms = Math.hypot((sm.x+12)-(a.x+16), (sm.y+12)-(a.y+16));
          if (dms < 36) {
            sm.hp -= Math.max(1, a.dmg - (sm.def || 0));
            sm.flash = 0.15;
            a.atkCd = a.atkCdMax; atk = true;
            burst(sm.x+12, sm.y+12, [sm.color, '#ffffff'], 4);
            if (sm.hp <= 0) {
              sm.alive = false;
              spawnSlimePuddle(sm.x + 12, sm.y + 12, sm.color);
            }
            break;
          }
        }
      }
    }
  }
}

// ── Particles ─────────────────────────────────────────────────
function burst(x, y, colors, n) {
  for (let i = 0; i < n; i++) {
    const a   = (Math.PI*2*i)/n + (Math.random()-0.5)*0.8;
    const spd = 60 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 0.35 + Math.random()*0.3, maxLife: 0.65,
      size: 2.5 + Math.random()*3,
    });
  }
  // A few spark trails
  for (let i = 0; i < Math.min(3, Math.ceil(n/3)); i++) {
    const a   = Math.PI*2*Math.random();
    const spd = 90 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 0.2 + Math.random()*0.2, maxLife: 0.4,
      size: 5 + Math.random()*3,
      type: 'spark',
    });
  }
}

function addScreenShake(mag) {
  screenShake.mag   = Math.max(screenShake.mag, mag);
  screenShake.timer = 0.18;
}
function updateScreenShake(dt) {
  if (screenShake.timer > 0) {
    screenShake.timer = Math.max(0, screenShake.timer - dt);
    const intensity = screenShake.timer / 0.18;
    screenShake.x = (Math.random() - 0.5) * 2 * screenShake.mag * intensity;
    screenShake.y = (Math.random() - 0.5) * 2 * screenShake.mag * intensity;
    if (screenShake.timer <= 0) { screenShake.x = 0; screenShake.y = 0; screenShake.mag = 0; }
  }
}

// ── Skill execution ───────────────────────────────────────────
function useSkill(slotIdx) {
  if (paused || skillMenuOpen || shopOpen || invOpen) return;
  if (gameState === 'raceSelect' || gameState === 'gameover') return;
  if (!heart) return;
  const key   = player.slots[slotIdx];
  if (!key || player.skillCds[slotIdx] > 0) return;
  const skill = SKILLS[key];
  if (!skill) return;
  // Cancel any active cast when a different skill is used
  if (heavensWake && heavensWake.phase === 'casting' && heavensWake.slotIdx !== slotIdx) {
    heavensWake = null;
    showMsg("Heaven's Wake cancelled!");
  }
  if (fireboltCast && fireboltCast.slotIdx !== slotIdx) {
    fireboltCast = null;
    showMsg('Firebolt cancelled!');
  }
  if (selfHealCast && selfHealCast.slotIdx !== slotIdx) {
    selfHealCast = null;
    showMsg('Self Heal cancelled!');
  }
  skill.use(slotIdx);
  player.skillCds[slotIdx] = skill.cooldown;
}

function updateSkillCds(dt) {
  for (let i = 0; i < 6; i++) {
    if (player.skillCds[i] > 0) player.skillCds[i] = Math.max(0, player.skillCds[i] - dt);
  }
}

// ── Cleric heal ───────────────────────────────────────────────
function healAlly(cleric) {
  const HEAL_RANGE = 120; // 3 tiles
  let best = null, bestRatio = 1.0;
  for (const other of adventurers) {
    if (other === cleric || !other.alive) continue;
    if (Math.hypot((other.x+16)-(cleric.x+16),(other.y+16)-(cleric.y+16)) > HEAL_RANGE) continue;
    const ratio = other.hp / other.maxHp;
    if (ratio < bestRatio) { bestRatio = ratio; best = other; }
  }
  if (best && best.hp < best.maxHp) {
    const heal = Math.round(best.maxHp * 0.12);
    best.hp = Math.min(best.maxHp, best.hp + heal);
    burst(best.x+16, best.y+16, ['#88ff44','#44ff88','#ccffaa'], 4);
  }
}

// ── Player skill actions ──────────────────────────────────────
function playerLeapToMouse() {
  const wmx = mouse.x / cam.zoom + cam.wx;
  const wmy = mouse.y / cam.zoom + cam.wy;
  const dx = wmx - (player.x + 16), dy = wmy - (player.y + 16);
  const dist = Math.hypot(dx, dy) || 1;
  const tx = player.x + (dx / dist) * TILE * 2;
  const ty = player.y + (dy / dist) * TILE * 2;
  player.iframes = 9999; // invincible during leap
  if (canMove(tx, ty, 32, 32)) {
    player.x = tx; player.y = ty;
  } else {
    if (canMove(tx, player.y, 32, 32)) player.x = tx;
    if (canMove(player.x, ty, 32, 32)) player.y = ty;
  }
  player.iframes = 0; // leap finished — invincibility ends
  burst(player.x+16, player.y+16, ['#44ffaa','#88eedd','#ffffff'], 8);
}

function goblinEscapeLeap() {
  const wmx = mouse.x / cam.zoom + cam.wx;
  const wmy = mouse.y / cam.zoom + cam.wy;
  const dx = wmx - (player.x + 16), dy = wmy - (player.y + 16);
  const dist = Math.hypot(dx, dy) || 1;
  const tx = player.x + (dx / dist) * TILE * 3;
  const ty = player.y + (dy / dist) * TILE * 3;
  player.iframes = 9999;
  if (canMove(tx, ty, 32, 32)) {
    player.x = tx; player.y = ty;
  } else {
    if (canMove(tx, player.y, 32, 32)) player.x = tx;
    if (canMove(player.x, ty, 32, 32)) player.y = ty;
  }
  player.iframes = 0;
  goblinEscapeBoostTimer = 0.5;
  burst(player.x+16, player.y+16, ['#44dd44','#88ff55','#aaffaa','#ffffff'], 10);
}

function playerFireArrow() {
  const wmx = mouse.x / cam.zoom + cam.wx;
  const wmy = mouse.y / cam.zoom + cam.wy;
  const px = player.x + 16, py = player.y + 16;
  const dx = wmx - px, dy = wmy - py;
  const dist = Math.hypot(dx, dy) || 1;
  projectiles.push({
    x: px, y: py,
    vx: (dx / dist) * 320,
    vy: (dy / dist) * 320,
    dmg: Math.round(playerEffAtk() * 1.5),
    life: 3.0,
    owner: 'player',
  });
  burst(px, py, ['#ffee66','#ffaa22'], 4);
}

function startFranticCharge(idx) {
  if (franticCharge) return;
  const wmx = mouse.x / cam.zoom + cam.wx;
  const wmy = mouse.y / cam.zoom + cam.wy;
  const dx = wmx - (player.x + 16), dy = wmy - (player.y + 16);
  const dist = Math.hypot(dx, dy) || 1;
  franticCharge = {
    timer: 0.5,
    nx: dx / dist,
    ny: dy / dist,
    slotIdx: idx,
    hit: new Set(),
  };
  burst(player.x+16, player.y+16, ['#ff8800','#ffcc44','#ffffff'], 10);
}

function updateFranticCharge(dt) {
  if (!franticCharge) return;
  const fc = franticCharge;
  fc.timer -= dt;
  if (fc.timer <= 0) {
    franticCharge = null;
    return;
  }
  const spd = player.speed * 1.1;
  const mx = fc.nx * spd * dt;
  const my = fc.ny * spd * dt;
  if (canMove(player.x + mx, player.y + my, 32, 32)) {
    player.x += mx; player.y += my;
  } else if (canMove(player.x + mx, player.y, 32, 32)) {
    player.x += mx;
  } else if (canMove(player.x, player.y + my, 32, 32)) {
    player.y += my;
  }
  const chargeDmg = Math.round(playerEffAtk());
  for (const a of adventurers) {
    if (!a.alive || fc.hit.has(a)) continue;
    if (Math.hypot((a.x+16)-(player.x+16), (a.y+16)-(player.y+16)) < 28) {
      fc.hit.add(a);
      a.hp -= chargeDmg;
      a.flash = 0.15;
      const kdx = (a.x+16)-(player.x+16), kdy = (a.y+16)-(player.y+16);
      const kln = Math.hypot(kdx, kdy) || 1;
      a.kbX = (kdx/kln) * 1120;
      a.kbY = (kdy/kln) * 1120;
      burst(a.x+16, a.y+16, ['#ff8800','#ffaa22','#ffcc44'], 6);
      if (a.hp <= 0) killAdventurer(a);
    }
  }
}

// ── Heaven's Wake ─────────────────────────────────────────────
function startHeavensWake(idx) {
  if (heavensWake) return;
  heavensWake = {
    phase: 'casting',   // 'casting' | 'rain' | 'fading'
    timer: 0,
    cx: mouse.x / cam.zoom + cam.wx,
    cy: mouse.y / cam.zoom + cam.wy,
    slotIdx: idx,
    damageTimer: 0,
    rainDrops: [],
  };
}

function updateHeavensWake(dt) {
  if (!heavensWake) return;
  const hw = heavensWake;

  if (hw.phase === 'casting') {
    hw.timer += dt;
    if (hw.timer >= HW_CAST_TIME) {
      hw.phase = 'rain';
      hw.timer = 0;
      showTopMsg("HEAVEN'S WAKE! Holy rain descends!");
      burst(hw.cx, hw.cy, ['#ffffff','#aaddff','#ddeeff','#eeeeff'], 24);
    }

  } else if (hw.phase === 'rain') {
    hw.timer += dt;
    hw.damageTimer += dt;

    // Spawn rain drops inside the circle
    const drops = Math.round(dt * 55);
    for (let i = 0; i < drops; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.sqrt(Math.random()) * HW_RADIUS;
      hw.rainDrops.push({
        x:    hw.cx + Math.cos(angle) * r,
        y:    hw.cy + Math.sin(angle) * r - TILE * 2.5,
        vy:   130 + Math.random() * 90,
        life: 0.35 + Math.random() * 0.2,
      });
    }
    for (const d of hw.rainDrops) { d.y += d.vy * dt; d.life -= dt; }
    hw.rainDrops = hw.rainDrops.filter(d => d.life > 0);

    // Damage tick
    while (hw.damageTimer >= HW_DMG_TICK) {
      hw.damageTimer -= HW_DMG_TICK;
      const tickDmg = Math.max(1, Math.round(playerEffAtk() * HW_DMG_MULT));
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16)-hw.cx, (a.y+16)-hw.cy) <= HW_RADIUS) {
          a.hp -= tickDmg; a.flash = 0.12;
          if (a.hp <= 0) killAdventurer(a);
        }
      }
      for (const m of placedMinions) {
        if (!m.alive) continue;
        const _hwmx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
        const _hwmy = m.type === 'giantSpider' ? m.y+40 : m.y+16;
        if (Math.hypot(_hwmx-hw.cx, _hwmy-hw.cy) <= HW_RADIUS) {
          m.hp -= tickDmg; m.flash = 0.12;
          if (m.hp <= 0) killMinion(m);
        }
      }
      if (Math.hypot((player.x+16)-hw.cx, (player.y+16)-hw.cy) <= HW_RADIUS) {
        player.hp = Math.max(0, player.hp - tickDmg);
        player.combatTimer = 5;
      }
    }

    if (hw.timer >= HW_RAIN_TIME) {
      hw.phase = 'fading';
      hw.timer = 0;
      hw.rainDrops = [];
    }

  } else { // fading
    hw.timer += dt;
    if (hw.timer >= HW_FADE_TIME) heavensWake = null;
  }
}

// Draws one of 6 angular rune symbols centred at world (wx,wy)
function drawRuneAt(wx, wy, idx) {
  const s = 7;
  ctx.beginPath();
  switch (idx) {
    case 0: // Isa — vertical bar with two crossbars
      ctx.moveTo(wx,wy-s); ctx.lineTo(wx,wy+s);
      ctx.moveTo(wx-s*.5,wy-s*.35); ctx.lineTo(wx+s*.5,wy-s*.35);
      ctx.moveTo(wx-s*.5,wy+s*.35); ctx.lineTo(wx+s*.5,wy+s*.35);
      break;
    case 1: // Tiwaz — upward arrow
      ctx.moveTo(wx,wy-s); ctx.lineTo(wx,wy+s);
      ctx.moveTo(wx,wy-s); ctx.lineTo(wx-s*.6,wy-s*.1);
      ctx.moveTo(wx,wy-s); ctx.lineTo(wx+s*.6,wy-s*.1);
      break;
    case 2: // Othala — diamond with leg struts
      ctx.moveTo(wx,wy-s*.7); ctx.lineTo(wx+s*.7,wy);
      ctx.lineTo(wx,wy+s*.5); ctx.lineTo(wx-s*.7,wy); ctx.closePath();
      ctx.moveTo(wx-s*.7,wy); ctx.lineTo(wx-s,wy+s);
      ctx.moveTo(wx+s*.7,wy); ctx.lineTo(wx+s,wy+s);
      break;
    case 3: // Algiz — Y fork
      ctx.moveTo(wx,wy); ctx.lineTo(wx,wy+s);
      ctx.moveTo(wx,wy); ctx.lineTo(wx-s*.65,wy-s*.75);
      ctx.moveTo(wx,wy); ctx.lineTo(wx+s*.65,wy-s*.75);
      break;
    case 4: // Sowulo — lightning bolt
      ctx.moveTo(wx+s*.35,wy-s); ctx.lineTo(wx-s*.35,wy);
      ctx.lineTo(wx+s*.35,wy);   ctx.lineTo(wx-s*.35,wy+s);
      break;
    case 5: // Hagalaz — H with diagonal bar
      ctx.moveTo(wx-s*.5,wy-s); ctx.lineTo(wx-s*.5,wy+s);
      ctx.moveTo(wx+s*.5,wy-s); ctx.lineTo(wx+s*.5,wy+s);
      ctx.moveTo(wx-s*.5,wy-s*.2); ctx.lineTo(wx+s*.5,wy+s*.2);
      break;
  }
  ctx.stroke();
}

// ── Firebolt ──────────────────────────────────────────────────
function startFirebolt(idx) {
  if (fireboltCast) return;
  fireboltCast = {
    timer: 0,
    cx: mouse.x / cam.zoom + cam.wx,
    cy: mouse.y / cam.zoom + cam.wy,
    slotIdx: idx,
  };
}

function updateFireboltCast(dt) {
  if (!fireboltCast) return;
  const fb = fireboltCast;
  fb.timer += dt;
  if (fb.timer >= FB_CAST_TIME) {
    const px = player.x + 16, py = player.y + 16;
    const dx = fb.cx - px, dy = fb.cy - py;
    const dist = Math.hypot(dx, dy) || 1;
    const dmg = Math.round(playerEffAtk() * FB_DMG_MULT);
    projectiles.push({
      x: px, y: py,
      vx: (dx / dist) * FB_SPEED,
      vy: (dy / dist) * FB_SPEED,
      dmg,
      life: 3.0,
      owner: 'player_firebolt',
    });
    burst(px, py, ['#ff2200', '#ff6600', '#ffcc22'], 6);
    fireboltCast = null;
  }
}

function drawFireboltCast() {
  if (!fireboltCast) return;
  const cx = player.x + 16, cy = player.y + 16;
  const progress = fireboltCast.timer / FB_CAST_TIME;
  const R = 26;
  const pulse = 0.6 + 0.4 * Math.sin(progress * Math.PI * 10);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ff2200';
  ctx.lineWidth   = 2;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#ff4400';
  // Outer circle
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  // Inner ring
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.stroke();
  // Equilateral triangle inscribed in outer circle, slowly rotating
  ctx.lineWidth = 2;
  const rot = -Math.PI / 2 + progress * Math.PI;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = rot + (i / 3) * Math.PI * 2;
    const tx = cx + Math.cos(angle) * R;
    const ty = cy + Math.sin(angle) * R;
    if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
  }
  ctx.closePath();
  ctx.stroke();
  // Triangle center dot
  ctx.fillStyle = '#ff4400';
  ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFireboltCastBar() {
  if (!fireboltCast) return;
  const progress = fireboltCast.timer / FB_CAST_TIME;
  const bw = 140, bh = 14;
  const bx = DW / 2 - bw / 2;
  const by = CH - 160;
  ctx.fillStyle = '#00000099';
  ctx.fillRect(bx - 3, by - 18, bw + 6, bh + 22);
  ctx.fillStyle = '#ffffff'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText('FIREBOLT', DW / 2, by - 5);
  ctx.fillStyle = '#111100'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#ff4400'; ctx.fillRect(bx, by, bw * progress, bh);
  ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  ctx.textAlign = 'left';
}

// ── Self Heal ─────────────────────────────────────────────────
const SH_CAST_TIME  = 2.0;
const SH_TICK_TIME  = 0.25;
const SH_TICK_PCT   = 0.025;

function startSelfHeal(idx) {
  if (selfHealCast) return;
  selfHealCast = { timer: 0, tickTimer: 0, slotIdx: idx };
}

function updateSelfHealCast(dt) {
  if (!selfHealCast) return;
  const sh = selfHealCast;
  sh.timer     += dt;
  sh.tickTimer += dt;
  if (sh.tickTimer >= SH_TICK_TIME) {
    sh.tickTimer -= SH_TICK_TIME;
    const amt = Math.max(1, Math.round(player.maxHp * SH_TICK_PCT));
    player.hp = Math.min(player.maxHp, player.hp + amt);
    spawnHealAnim(player.x + 16, player.y + 16);
    burst(player.x + 16, player.y + 16, ['#00ee55', '#44ff88', '#00cc44'], 4);
  }
  if (sh.timer >= SH_CAST_TIME) {
    selfHealCast = null;
  }
}

function drawSelfHealCast() {
  if (!selfHealCast) return;
  const cx = player.x + 16, cy = player.y + 16;
  const R      = 26;
  const t      = gNow() / 1000;
  const prog   = selfHealCast.timer / SH_CAST_TIME;
  const pulse  = 0.6 + 0.4 * Math.sin(t * 6);
  const rot    = t * 1.5;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth   = 2;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#00ff66';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = rot + (i / 3) * Math.PI * 2;
    const tx = cx + Math.cos(angle) * R, ty = cy + Math.sin(angle) * R;
    if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
  }
  ctx.closePath(); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = -rot + (Math.PI / 3) + (i / 3) * Math.PI * 2;
    const tx = cx + Math.cos(angle) * R, ty = cy + Math.sin(angle) * R;
    if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
  }
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle  = '#00ee55';
  ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawSelfHealCastBar() {
  if (!selfHealCast) return;
  const progress = selfHealCast.timer / SH_CAST_TIME;
  const bw = 140, bh = 14;
  const bx = DW / 2 - bw / 2;
  const by = CH - 160;
  ctx.fillStyle = '#00000099';
  ctx.fillRect(bx - 3, by - 18, bw + 6, bh + 22);
  ctx.fillStyle = '#ffffff'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText('SELF HEAL', DW / 2, by - 5);
  ctx.fillStyle = '#111100'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#00cc44'; ctx.fillRect(bx, by, bw * progress, bh);
  ctx.strokeStyle = '#00aa33'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  ctx.textAlign = 'left';
}

function updateLesserHealCast(dt) {
  if (!lesserHealCast) return;
  const lh = lesserHealCast;
  const moving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
                 keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];
  if (moving) {
    lesserHealCast = null;
    showMsg('Lesser Heal interrupted!');
    return;
  }
  lh.timer += dt;
  if (lh.timer >= LH_CAST_TIME) {
    const R = LH_AOE_RADIUS;
    lhAOEAnim = { cx: lh.tx, cy: lh.ty, life: 0.2, maxLife: 0.2 };
    let healed = false;
    // Heal player if in range
    if (Math.hypot((player.x+16) - lh.tx, (player.y+16) - lh.ty) < R) {
      const amt = Math.max(1, Math.round(player.maxHp * LH_HEAL_PCT));
      player.hp = Math.min(player.maxHp, player.hp + amt);
      spawnHealAnim(player.x+16, player.y+16);
      healed = true;
    }
    // Heal all minions in range
    for (const m of placedMinions) {
      if (!m.alive) continue;
      const mcx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
      const mcy = m.type === 'giantSpider' ? m.y+40 : m.y+16;
      if (Math.hypot(mcx - lh.tx, mcy - lh.ty) < R) {
        const amt = Math.max(1, Math.round(m.maxHp * LH_HEAL_PCT));
        m.hp = Math.min(m.maxHp, m.hp + amt);
        spawnHealAnim(mcx, mcy);
        healed = true;
      }
    }
    if (!healed) showMsg('No friendly target in range!');
    lesserHealCast = null;
  }
}

function drawLesserHealCast() {
  if (!lesserHealCast) return;
  const cx = player.x + 16, cy = player.y + 16;
  const R = 26;
  const t     = gNow() / 1000;
  const pulse = 0.6 + 0.4 * Math.sin(t * 6);
  const rot   = t * 1.5;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth   = 2;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#00ff66';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = rot + (i / 3) * Math.PI * 2;
    const tx = cx + Math.cos(angle) * R;
    const ty = cy + Math.sin(angle) * R;
    if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
  }
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle  = '#00ee55';
  ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLesserHealCastBar() {
  if (!lesserHealCast) return;
  const progress = lesserHealCast.timer / LH_CAST_TIME;
  const bw = 140, bh = 14;
  const bx = DW / 2 - bw / 2;
  const by = CH - 160;
  ctx.fillStyle = '#00000099';
  ctx.fillRect(bx - 3, by - 18, bw + 6, bh + 22);
  ctx.fillStyle = '#ffffff'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText('LESSER HEAL', DW / 2, by - 5);
  ctx.fillStyle = '#111100'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#00cc44'; ctx.fillRect(bx, by, bw * progress, bh);
  ctx.strokeStyle = '#00aa33'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  ctx.textAlign = 'left';
}

function spawnHealAnim(x, y) {
  healAnims.push({ x, y, life: 0.5, maxLife: 0.5 });
}

function drawLhAOEAnim() {
  if (!lhAOEAnim) return;
  const { cx, cy, life, maxLife } = lhAOEAnim;
  const R   = LH_AOE_RADIUS; // matches actual hit radius (40px)
  const t   = gNow() / 1000;
  const rot = t * 3;
  const age     = maxLife - life;
  const fadeIn  = Math.min(1, age / 0.05);       // snap in in first 50ms
  const fadeOut = Math.min(1, life / 0.08);       // fade out in last 80ms
  const alpha   = Math.min(fadeIn, fadeOut);

  ctx.save();

  // Filled flash burst on first frame
  if (age < 0.06) {
    ctx.globalAlpha = (1 - age / 0.06) * 0.35;
    ctx.fillStyle = '#44ff88';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#00cc44';
  ctx.shadowBlur  = 18;
  ctx.shadowColor = '#00ff66';

  // Outer ring
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // Inner ring
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.stroke();

  // Rotating triangle (touches outer ring — same as cleric circle)
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * Math.PI * 2;
    const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();

  // Counter-rotating triangle
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -rot + (Math.PI / 3) + (i / 3) * Math.PI * 2;
    const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();

  // Centre dot
  ctx.fillStyle = '#44ff88';
  ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawHealAnims() {
  for (const h of healAnims) {
    const progress = 1 - h.life / h.maxLife;
    const r     = 6 + progress * 28;
    const alpha = 1 - progress;
    const rise  = progress * 18; // cross rises upward
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#44ff88';
    ctx.fillStyle   = '#88ffaa';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00ff66';

    // Expanding rings
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.5, 0, Math.PI * 2); ctx.stroke();

    // Floating "+" cross above the target
    const cx = h.x, cy = h.y - 14 - rise;
    const arm = 5;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.stroke();

    ctx.restore();
  }
}

function drawHeavensWake() {
  if (!heavensWake) return;
  const hw = heavensWake;
  const cx = hw.cx, cy = hw.cy, R = HW_RADIUS;

  let drawProg, alpha;
  if      (hw.phase === 'casting') { drawProg = hw.timer / HW_CAST_TIME; alpha = 1; }
  else if (hw.phase === 'rain')    { drawProg = 1; alpha = 1; }
  else                             { drawProg = 1; alpha = 1 - hw.timer / HW_FADE_TIME; }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';

  // ── Outer ring (0–25%) ─────────────────────────────────────
  if (drawProg > 0) {
    const p = Math.min(1, drawProg / 0.25);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.shadowBlur = 14; ctx.shadowColor = '#aaddff';
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI/2, -Math.PI/2 + p * Math.PI * 2);
    ctx.stroke();
  }
  // ── Mid ring (25–40%) ──────────────────────────────────────
  if (drawProg > 0.25) {
    const p = Math.min(1, (drawProg - 0.25) / 0.15);
    ctx.strokeStyle = '#ddeeff'; ctx.lineWidth = 1;
    ctx.shadowBlur = 8; ctx.shadowColor = '#88bbff';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.58, -Math.PI/2, -Math.PI/2 + p * Math.PI * 2);
    ctx.stroke();
  }
  // ── Hexagram triangle 1 (40–60%) ──────────────────────────
  if (drawProg > 0.40) {
    const p    = Math.min(1, (drawProg - 0.40) / 0.20);
    const pts  = [0,1,2].map(i => {
      const a = -Math.PI/2 + i * (Math.PI * 2 / 3);
      return [cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82];
    });
    const segs = [[pts[0],pts[1]],[pts[1],pts[2]],[pts[2],pts[0]]];
    ctx.strokeStyle = '#eeeeff'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10; ctx.shadowColor = '#aaddff';
    const shown = Math.floor(p * 3), frac = p * 3 - shown;
    for (let i = 0; i < Math.min(shown + 1, 3); i++) {
      const [p1,p2] = segs[i];
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]);
      if (i < shown) ctx.lineTo(p2[0], p2[1]);
      else ctx.lineTo(p1[0] + (p2[0]-p1[0])*frac, p1[1] + (p2[1]-p1[1])*frac);
      ctx.stroke();
    }
  }
  // ── Hexagram triangle 2 (60–78%) ──────────────────────────
  if (drawProg > 0.60) {
    const p    = Math.min(1, (drawProg - 0.60) / 0.18);
    const pts  = [0,1,2].map(i => {
      const a = -Math.PI/6 + i * (Math.PI * 2 / 3);
      return [cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82];
    });
    const segs = [[pts[0],pts[1]],[pts[1],pts[2]],[pts[2],pts[0]]];
    ctx.strokeStyle = '#eeeeff'; ctx.lineWidth = 1.5;
    const shown = Math.floor(p * 3), frac = p * 3 - shown;
    for (let i = 0; i < Math.min(shown + 1, 3); i++) {
      const [p1,p2] = segs[i];
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]);
      if (i < shown) ctx.lineTo(p2[0], p2[1]);
      else ctx.lineTo(p1[0] + (p2[0]-p1[0])*frac, p1[1] + (p2[1]-p1[1])*frac);
      ctx.stroke();
    }
  }
  // ── Rune marks at 6 points (78–93%) ───────────────────────
  if (drawProg > 0.78) {
    const p      = Math.min(1, (drawProg - 0.78) / 0.15);
    const shown  = Math.floor(p * 6);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.shadowBlur = 8; ctx.shadowColor = '#ffffff';
    for (let i = 0; i < shown; i++) {
      const a  = -Math.PI/2 + i * (Math.PI / 3);
      drawRuneAt(cx + Math.cos(a) * R, cy + Math.sin(a) * R, i);
    }
  }
  // ── Centre dot + cross (93–100%) ──────────────────────────
  if (drawProg > 0.93) {
    const p = Math.min(1, (drawProg - 0.93) / 0.07);
    ctx.globalAlpha = alpha * p;
    ctx.shadowBlur = 22; ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx-10, cy); ctx.lineTo(cx+10, cy);
    ctx.moveTo(cx, cy-10); ctx.lineTo(cx, cy+10);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  // ── Gentle area fill pulse during rain ─────────────────────
  if (hw.phase === 'rain') {
    const pulse = 0.03 + Math.abs(Math.sin(hw.timer * 2.8)) * 0.055;
    ctx.globalAlpha = alpha * pulse;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaddff';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha;
  }

  // ── Rain drops ─────────────────────────────────────────────
  ctx.shadowBlur = 4; ctx.shadowColor = '#aaddff';
  ctx.strokeStyle = '#ddeeff'; ctx.lineWidth = 0.8;
  for (const d of hw.rainDrops) {
    ctx.globalAlpha = alpha * Math.min(1, d.life * 6);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - 0.5, d.y + 10);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHeavensWakeCastBar() {
  if (!heavensWake || heavensWake.phase !== 'casting') return;
  const progress = heavensWake.timer / HW_CAST_TIME;
  const bw = 180, bh = 14;
  const bx = DW / 2 - bw / 2;
  const by = CH - 160;

  // Background
  ctx.fillStyle = '#00000099';
  ctx.fillRect(bx - 3, by - 18, bw + 6, bh + 22);

  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = '6px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("HEAVEN'S WAKE", DW / 2, by - 5);

  // Bar track
  ctx.fillStyle = '#111122';
  ctx.fillRect(bx, by, bw, bh);

  // Bar fill — gold-to-white gradient feel via solid colour
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(bx, by, bw * progress, bh);

  // Bar border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.textAlign = 'left';
}

// ── Ranger projectile fire ────────────────────────────────────
function fireRangerProjectile(ranger) {
  const ax = ranger.x + 16, ay = ranger.y + 16;
  // When aggroed on a minion, aim at it and use minion-targeting owner
  if (ranger.aggroTimer > 0 && ranger.aggroTarget === 'minion' && ranger.aggroMinion && ranger.aggroMinion.alive) {
    const m = ranger.aggroMinion;
    const tx = m.x + 16, ty = m.y + 16;
    const dist = Math.hypot(tx - ax, ty - ay) || 1;
    projectiles.push({
      x: ax, y: ay,
      vx: (tx - ax) / dist * 220,
      vy: (ty - ay) / dist * 220,
      dmg: ranger.dmg,
      life: 3.0,
      owner: 'enemy_rangerMinion',
    });
    return;
  }
  // Default: aim at player
  const tx = player.x + 16, ty = player.y + 16;
  const dist = Math.hypot(tx - ax, ty - ay) || 1;
  projectiles.push({
    x: ax, y: ay,
    vx: (tx - ax) / dist * 220,
    vy: (ty - ay) / dist * 220,
    dmg: ranger.dmg,
    life: 3.0,
    owner: 'enemy',
  });
}

// ── Projectile update ─────────────────────────────────────────
function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) continue;

    // World-aware wall collision
    if (!isPassable(p.x, p.y)) { p.life = 0; continue; }

    if (p.owner === 'player') {
      // Player arrow — hits adventurers
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 18) {
          a.hp -= p.dmg;
          a.flash = 0.12;
          burst(p.x, p.y, ['#ffee44','#ffaa22'], 5);
          p.life = 0;
          if (a.hp <= 0) { killAdventurer(a); }
          else {
            if (a.cls === 'warrior' || a.cls === 'ranger' || a.cls === 'rogue') {
              a.aggroTimer = 9999; a.aggroTarget = 'player'; a.aggroMinion = null; a.path = null;
            }
            if (a.cls === 'cleric') { a.fleeing = true; a.fleeTimer = 3.0; a.fleeFromX = player.x+16; a.fleeFromY = player.y+16; a.path = null; }
          }
          break;
        }
      }
    } else if (p.owner === 'player_slimeBall') {
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 20) {
          a.hp -= p.dmg;
          a.flash = 0.12;
          if (a.slimedTimer <= 0 || a.slimedAmt > 0.7) a.slimedAmt = 0.7;
          a.slimedTimer = Math.max(a.slimedTimer, 1.0);
          burst(p.x, p.y, ['#22ddaa','#44ffcc','#00bb88'], 6);
          p.life = 0;
          if (a.hp <= 0) killAdventurer(a);
          else {
            if (a.cls === 'warrior' || a.cls === 'ranger' || a.cls === 'rogue') {
              a.aggroTimer = 9999; a.aggroTarget = 'player'; a.aggroMinion = null; a.path = null;
            }
            if (a.cls === 'cleric') { a.fleeing = true; a.fleeTimer = 3.0; a.fleeFromX = player.x+16; a.fleeFromY = player.y+16; a.path = null; }
          }
          break;
        }
      }
    } else if (p.owner === 'player_acidPuddle') {
      if (Math.hypot(p.targetX - p.x, p.targetY - p.y) < 20) {
        spawnSlimePuddle(p.targetX, p.targetY, '#22cc44');
        burst(p.targetX, p.targetY, ['#22cc44','#44ff66','#00aa22','#88ffaa'], 8);
        p.life = 0;
      }
    } else if (p.owner === 'player_firebolt') {
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 20) {
          a.hp -= p.dmg;
          a.flash = 0.14;
          a.burnTimer     = FB_BURN_DUR;
          a.burnDmg       = Math.max(1, Math.round(a.maxHp * FB_BURN_PCT));
          a.burnTickTimer = FB_BURN_TICK;
          burst(p.x, p.y, ['#ff2200','#ff6600','#ffcc22','#ff4400'], 8);
          p.life = 0;
          if (a.hp <= 0) killAdventurer(a);
          else {
            if (a.cls === 'warrior' || a.cls === 'ranger' || a.cls === 'rogue') {
              a.aggroTimer = 9999; a.aggroTarget = 'player'; a.aggroMinion = null; a.path = null;
            }
            if (a.cls === 'cleric') { a.fleeing = true; a.fleeTimer = 3.0; a.fleeFromX = player.x+16; a.fleeFromY = player.y+16; a.path = null; }
          }
          break;
        }
      }
    } else if (p.owner === 'minion_web') {
      // Spider web — slows adventurers, no damage
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 18) {
          a.webSlowTimer = 3.0;
          burst(p.x, p.y, ['#aaaaaa','#cccccc','#888888'], 6);
          p.life = 0;
          break;
        }
      }
    } else if (p.owner === 'minion_goblinArrow') {
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 16) {
          a.hp -= p.dmg;
          a.flash = 0.12;
          a.poisonTimer     = 2.0;
          a.poisonDmg       = Math.max(1, Math.round(a.maxHp * 0.01));
          a.poisonTickTimer = 0.5;
          burst(p.x, p.y, ['#44cc22','#88ee44','#22aa11'], 6);
          p.life = 0;
          if (a.hp <= 0) killAdventurer(a);
          else {
            if (a.cls === 'warrior' || a.cls === 'ranger' || a.cls === 'rogue') {
              a.aggroTimer = 6; a.aggroTarget = 'minion'; a.aggroMinion = p.minionRef || null; a.path = null;
            }
          }
          break;
        }
      }
    } else if (p.owner === 'minion_goblinFirebolt') {
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 18) {
          a.hp -= p.dmg;
          a.flash = 0.14;
          a.burnTimer     = Math.max(a.burnTimer || 0, 2.0);
          a.burnDmg       = Math.max(a.burnDmg || 0, Math.max(1, Math.round(a.maxHp * 0.02)));
          a.burnTickTimer = a.burnTickTimer > 0 ? a.burnTickTimer : 1.0;
          burst(p.x, p.y, ['#aa44ff','#7722cc','#dd88ff','#ff6600'], 8);
          p.life = 0;
          if (a.hp <= 0) killAdventurer(a);
          else {
            if (a.cls === 'warrior' || a.cls === 'ranger' || a.cls === 'rogue') {
              a.aggroTimer = 6; a.aggroTarget = 'minion'; a.aggroMinion = p.minionRef || null; a.path = null;
            }
          }
          break;
        }
      }
    } else if (p.owner === 'trap_emberbolt') {
      for (const a of adventurers) {
        if (!a.alive) continue;
        if (Math.hypot((a.x+16) - p.x, (a.y+16) - p.y) < 18) {
          const impactDmg = Math.max(1, Math.round(a.maxHp * 0.10));
          a.hp -= impactDmg;
          a.flash = 0.14;
          a.burnTimer     = 5.0;
          a.burnDmg       = Math.max(1, Math.round(a.maxHp * 0.02));
          a.burnTickTimer = 1.0;
          burst(p.x, p.y, ['#ff2200','#ff6600','#ffcc22','#ff4400'], 10);
          p.life = 0;
          if (a.hp <= 0) killAdventurer(a);
          break;
        }
      }
    } else if (p.owner === 'enemy_rangerMinion') {
      // Ranger arrow targeting a minion — hits placed minions and slimy minions
      let arrowHit = false;
      for (const m of placedMinions) {
        if (!m.alive) continue;
        if (Math.hypot((m.x+16) - p.x, (m.y+16) - p.y) < 16) {
          m.hp -= p.dmg; m.flash = 0.15;
          burst(p.x, p.y, ['#ffcc44','#ff8844'], 5);
          p.life = 0; arrowHit = true;
          if (m.hp <= 0) killMinion(m);
          break;
        }
      }
      if (!arrowHit) {
        for (const sm of slimyMinions) {
          if (!sm.alive) continue;
          if (Math.hypot((sm.x+12) - p.x, (sm.y+12) - p.y) < 14) {
            sm.hp -= Math.max(1, p.dmg - (sm.def || 0)); sm.flash = 0.15;
            burst(p.x, p.y, ['#ffcc44','#ff8844'], 5);
            p.life = 0;
            if (sm.hp <= 0) { sm.alive = false; spawnSlimePuddle(sm.x+12, sm.y+12, sm.color); }
            break;
          }
        }
      }
    } else {
      // Enemy arrow — hits player and heart
      if (Math.hypot((player.x+16) - p.x, (player.y+16) - p.y) < 16 && player.iframes <= 0) {
        if (player.raceSkill === 'spiritRace' && Math.random() < 0.20) {
          burst(player.x+16, player.y+16, ['#c8ddff','#aabbff','#ffffff'], 4);
          p.life = 0; continue;
        }
        const _aRaw = Math.max(1, p.dmg - playerEffDef());
        const _aDmg = player.raceSkill === 'slimeRace' ? Math.max(1, Math.round(_aRaw * 0.85)) : _aRaw;
        player.hp          = Math.max(0, player.hp - _aDmg);
        player.iframes     = 0.5;
        player.combatTimer = 5;
        burst(p.x, p.y, ['#ff4444','#ff8844'], 5);
        p.life = 0; continue;
      }
      if (heart && Math.hypot((heart.x+16) - p.x, (heart.y+16) - p.y) < 20) {
        heart.hp = Math.max(0, heart.hp - p.dmg);
        burst(p.x, p.y, ['#ff4488','#ff1166'], 5);
        p.life = 0;
      }
    }
  }
  projectiles = projectiles.filter(p => p.life > 0);
}

// ── Helpers ───────────────────────────────────────────────────
function showMsg(m)     { flash    = m; flashT    = 2.8; }
function showTopMsg(m)  { flashTop = m; flashTopT = 3.5; }
function inR(mx,my,rx,ry,rw,rh) { return mx>=rx && mx<=rx+rw && my>=ry && my<=ry+rh; }
function playerEffAtk() {
  let atk = player.slots.includes('fRankSteelSkin') ? Math.round(player.atkDmg * 1.05) : player.atkDmg;
  if (player.raceSkill === 'goblinRace' && player.hp < player.maxHp * 0.3) atk = Math.round(atk * 0.75);
  return atk;
}
function inHeavensWake(cx, cy) {
  return heavensWake && heavensWake.phase === 'rain' &&
         Math.hypot(cx - heavensWake.cx, cy - heavensWake.cy) <= HW_RADIUS;
}
function playerEffDef() { return player.slots.includes('fRankSteelSkin') ? Math.round(player.def   * 1.05) : player.def; }
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx-ax, dy = by-ay, lenSq = dx*dx+dy*dy;
  if (lenSq === 0) return Math.hypot(px-ax, py-ay);
  const t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/lenSq));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
/** Returns the "effective" now — frozen while paused so timers don't drift */
function gNow()      { return paused ? pauseStart : Date.now(); }

// ── Input ────────────────────────────────────────────────────
const PBX=DW-42, PBY=8, PBW=36, PBH=24; // pause button position

c.addEventListener('keydown', e => {
  keys[e.code] = true;
  focused = true;
  if (e.code === 'Escape') { shopOpen = false; skillMenuOpen = false; invOpen = false; trapContext = null; minionContext = null; soilContext = null; pendingSkill = null; if (!heartCarried) placeMode = null; }
  if (e.code === 'KeyP')   togglePause();
  const SKILL_CODES = ['KeyQ','KeyE','KeyR','KeyF'];
  if (SKILL_CODES.includes(e.code)) useSkill(SKILL_CODES.indexOf(e.code));
  if (placeMode === 'trap_emberbolt') {
    if (e.code === 'KeyW') emberboltDir = 'up';
    if (e.code === 'KeyA') emberboltDir = 'left';
    if (e.code === 'KeyS') emberboltDir = 'down';
    if (e.code === 'KeyD') emberboltDir = 'right';
  }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space',
       'KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyR','KeyF'].includes(e.code))
    e.preventDefault();
});
c.addEventListener('keyup',      e => { keys[e.code] = false; });
function clientToCanvas(clientX, clientY) {
  return {
    x: (clientX - _gameOx) / _gameScale,
    y: (clientY - _gameOy) / _gameScale,
  };
}

c.addEventListener('mousemove',  e => {
  const p = clientToCanvas(e.clientX, e.clientY);
  mouse.x = p.x; mouse.y = p.y;
});
c.addEventListener('click', e => {
  c.focus();
  focused = true;
  const p = clientToCanvas(e.clientX, e.clientY);
  handleClick(p.x, p.y);
});
c.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (gameState === 'combat') useSkill(5);
});
c.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 40 : -40;
  if (skillMenuOpen && inR(mouse.x, mouse.y, SKMNX, SKMNY, SKMNW, SKMNH)) {
    skillScrollY = Math.max(0, skillScrollY + delta); return;
  }
  if (shopOpen && inR(mouse.x, mouse.y, SX, SY, SW, SH)) {
    shopScrollY = Math.max(0, shopScrollY + delta); return;
  }
  if (invOpen && inR(mouse.x, mouse.y, SX, SY, SW, SH)) {
    invScrollY = Math.max(0, invScrollY + delta); return;
  }
  if (mouse.x >= DW) return;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  cam.zoom = Math.min(1.0, Math.max(0.18, cam.zoom * factor));
}, { passive: false });

function handleClick(mx, my) {
  if (gameState === 'raceSelect') { raceSelectClick(mx, my); return; }
  if (gameState === 'gameover') {
    if (inR(mx,my, DW/2-80, CH/2+15, 160, 36)) init();
    return;
  }
  if (inR(mx,my, PBX, PBY, PBW, PBH)) { togglePause(); return; }
  if (paused) return;

  if (mx >= DW)                                { if (gameState === 'build') uiClick(mx, my); return; }
  if (skillMenuOpen)                           { skillMenuClick(mx, my); return; }
  if (shopOpen)                                { shopClick(mx, my); return; }
  if (invOpen)                                 { inventoryClick(mx, my); return; }
  if (minionContext && gameState === 'build')  { minionContextClick(mx, my); return; }
  if (trapContext && gameState === 'build')    { trapContextClick(mx, my); return; }
  if (soilContext && gameState === 'build')    { soilContextClick(mx, my); return; }
  if (gameState === 'build')  { dungeonBuildClick(mx, my); }
  else if (gameState === 'combat') dungeonCombatClick(mx, my);
}

function dungeonBuildClick(mx, my) {
  const wmx = mx/cam.zoom + cam.wx, wmy = my/cam.zoom + cam.wy;

  // Corridor/room placement don't need a tile resolve
  if (placeMode === 'corridor') {
    const hit = getCorridorInfoAtWorld(wmx, wmy);
    if (hit) {
      if (!placeCorridorAt(hit.info, hit.roomRef)) showMsg('Cannot place corridor here.');
    } else {
      showMsg('Click an outer wall of any dungeon room to place a corridor.');
    }
    return;
  }
  if (placeMode === 'dungeonRoom') {
    let placed = false;
    for (const c of worldCorridors) {
      if (c.toRoomId !== null) continue;
      const rx=c.roomWX*TILE, ry=c.roomWY*TILE;
      if (wmx>=rx&&wmx<rx+GRID*TILE&&wmy>=ry&&wmy<ry+GRID*TILE) { placeRoomAtCorridor(c); placed=true; break; }
    }
    if (!placed) showMsg('Click the dashed outline at a corridor end to place a room.');
    return;
  }

  const res = resolveWorldTile(wmx, wmy);

  // Heart: place in any room or corridor
  if (placeMode === 'heart') {
    if (!res) return;
    const { grid: tgrid, lgx, lgy, worldPX, worldPY } = res;
    if (tgrid[lgy][lgx] === T_FLOOR) {
      if (heart) setWorldTile(heart.gx, heart.gy, T_FLOOR);
      const wgx = Math.round(worldPX/TILE), wgy = Math.round(worldPY/TILE);
      const hp = heartCarried ? heartCarriedHp : 200;
      const maxHp = heartCarried ? heartCarriedMaxHp : 200;
      heart = { gx: wgx, gy: wgy, x: worldPX+4, y: worldPY+4, hp, maxHp };
      tgrid[lgy][lgx] = T_HEART;
      heartCarried = false;
      if (!heartEverPlaced) { heartEverPlaced = true; waveTimer = 60; }
      placeMode = null;
      showMsg('Heart placed!');
    }
    return;
  }

  if (!res) return;
  const { grid: tgrid, lgx, lgy, worldPX, worldPY } = res;
  const wgx = Math.round(worldPX/TILE), wgy = Math.round(worldPY/TILE);

  if (placeMode === 'cropTile') {
    if (tgrid[lgy][lgx] === T_FLOOR) {
      tgrid[lgy][lgx] = T_SOIL;
      ctInv--;
      placeMode = null;
      showMsg('Dungeon Soil placed! (' + ctInv + ' left)');
    }
  } else if (placeMode && placeMode.startsWith('trap_')) {
    const type = placeMode.slice(5);
    if (tgrid[lgy][lgx] === T_FLOOR) {
      if (placedTraps.length >= trapSlots) {
        showMsg('Trap slots full! (' + trapSlots + '/' + trapSlots + ')  Expand in Inventory.');
      } else {
        const invIdx = trapInventory.findIndex(t => t.type === type);
        if (invIdx >= 0) {
          const trap = trapInventory.splice(invIdx, 1)[0];
          trap.gx = wgx; trap.gy = wgy;
          if (type === 'emberbolt') { trap.dir = emberboltDir; trap.fireTimer = 0; trap.revealed = true; }
          placedTraps.push(trap);
          tgrid[lgy][lgx] = T_TRAP;
          placeMode = null;
          showMsg(TRAP_TYPES[type].name + ' placed!  ' + placedTraps.length + '/' + trapSlots + ' slots');
        }
      }
    }
  } else if (placeMode && placeMode.startsWith('minion_')) {
    const type = placeMode.slice(7);
    if (type === 'giantSpider') {
      const ok = [[lgx,lgy],[lgx+1,lgy],[lgx,lgy+1],[lgx+1,lgy+1]]
        .every(([x,y]) => tgrid[y] && tgrid[y][x] === T_FLOOR);
      if (!ok) { showMsg('Need 2×2 floor tiles for Giant Spider!'); return; }
      if (placedMinions.some(m => m.gx===wgx && m.gy===wgy)) { showMsg('A minion is already there!'); return; }
      const invIdx = minionInventory.findIndex(m => m.type === 'giantSpider');
      if (invIdx >= 0) {
        const min = minionInventory.splice(invIdx, 1)[0];
        const stats = MINION_TYPES.giantSpider.statsAtLevel(min.level);
        min.gx = wgx; min.gy = wgy;
        min.x = worldPX; min.y = worldPY;
        min.homeX = min.x; min.homeY = min.y;
        min.maxHp = stats.hp;
        min.atkCd = 0; min.atkCdMax = stats.atkCdMax; min.webCd = 0;
        if (min.alive !== false) { min.alive = true; min.hp = stats.hp; min.respawnTimer = 0; }
        min.combatTimer = 0; min.flash = 0; min.bobPhase = Math.random()*Math.PI*2;
        min.target = null;
        placedMinions.push(min);
        placeMode = null;
        showMsg('Giant Spider placed!');
      }
    } else if (type === 'goblinFarmer') {
      if (tgrid[lgy][lgx] !== T_SOIL) { showMsg('Mushroom Farmer must be placed on a Soil tile!'); return; }
      if (placedMinions.some(m => m.gx===wgx && m.gy===wgy)) { showMsg('A minion is already there!'); return; }
      const invIdx = minionInventory.findIndex(m => m.type === 'goblinFarmer');
      if (invIdx >= 0) {
        const min = minionInventory.splice(invIdx, 1)[0];
        const stats = MINION_TYPES.goblinFarmer.statsAtLevel(min.level);
        min.gx = wgx; min.gy = wgy;
        min.x = worldPX+4; min.y = worldPY+4;
        min.homeX = min.x; min.homeY = min.y;
        min.maxHp = stats.hp;
        min.atkCd = 0; min.atkCdMax = stats.atkCdMax;
        min.arrowCd = 0; min.fireCd = 0; min.leapCd = 0; min.foodAccum = 0;
        if (min.alive !== false) { min.alive = true; min.hp = stats.hp; min.respawnTimer = 0; }
        min.combatTimer = 0; min.flash = 0; min.bobPhase = Math.random()*Math.PI*2;
        min.target = null;
        placedMinions.push(min);
        placeMode = null;
        showMsg('Mushroom Farmer placed! Generating +' + MINION_TYPES.goblinFarmer.foodGenAtLevel(min.level) + ' food/min');
      }
    } else if (tgrid[lgy][lgx] === T_FLOOR) {
      if (placedMinions.some(m => m.gx===wgx && m.gy===wgy)) {
        showMsg('A minion is already there!');
      } else {
        const invIdx = minionInventory.findIndex(m => m.type === type);
        if (invIdx >= 0) {
          const min = minionInventory.splice(invIdx, 1)[0];
          const stats = MINION_TYPES[type].statsAtLevel(min.level);
          min.gx = wgx; min.gy = wgy;
          min.x = worldPX+4; min.y = worldPY+4;
          min.homeX = min.x; min.homeY = min.y;
          min.maxHp = stats.hp;
          min.atkCd = 0; min.atkCdMax = stats.atkCdMax; min.webCd = 0;
          min.arrowCd = 0; min.fireCd = 0; min.leapCd = 0;
          if (min.alive !== false) { min.alive = true; min.hp = stats.hp; min.respawnTimer = 0; }
          min.combatTimer = 0; min.flash = 0; min.bobPhase = Math.random()*Math.PI*2;
          min.target = null;
          if (type === 'mimic') { min.mimicForm = 'chest'; min.luredAdv = null; }
          placedMinions.push(min);
          placeMode = null;
          showMsg(MINION_TYPES[type].name + ' placed!');
        }
      }
    }
  } else {
    // Pick up heart (build mode only)
    if (tgrid[lgy][lgx] === T_HEART && gameState === 'build') {
      heartCarriedHp    = heart ? heart.hp    : 200;
      heartCarriedMaxHp = heart ? heart.maxHp : 200;
      setWorldTile(wgx, wgy, T_FLOOR);
      heart        = null;
      heartCarried = true;
      placeMode    = 'heart';
      shopOpen = false; skillMenuOpen = false; invOpen = false; pendingSkill = null;
      showMsg('Heart picked up!  Click a floor tile to place it.  Timers are frozen.');
      return;
    }
    const clickedMinion = placedMinions.find(m => Math.floor((m.x+16)/TILE)===wgx && Math.floor((m.y+16)/TILE)===wgy);
    if (clickedMinion) { minionContext = clickedMinion; return; }
    if (tgrid[lgy][lgx] === T_TRAP) {
      const trap = placedTraps.find(t => t.gx===wgx && t.gy===wgy);
      if (trap) { trapContext = trap; return; }
    }
    if (tgrid[lgy][lgx] === T_SOIL) {
      soilContext = { gx: wgx, gy: wgy, worldPX, worldPY };
    }
  }
}

function killAdventurer(a) {
  a.alive = false;
  a.luredByMimic = null;
  waveDefeated++;
  addScreenShake(1.5);
  let coinGain = a.loot;
  if (player.raceSkill === 'goblinRace') coinGain += Math.floor(a.loot * 0.1);
  coins += coinGain;
  if (player.raceSkill === 'spiritRace') {
    const soulHeal = Math.max(1, Math.round(player.maxHp * 0.01));
    player.hp = Math.min(player.maxHp, player.hp + soulHeal);
    spawnHealAnim(player.x+16, player.y+16);
  }
  if (a.rank === 'F') fInfamy++;
  showMsg('+' + coinGain + ' coins   +1 F-Infamy (' + fInfamy + '/100)');
  burst(a.x+16, a.y+16, ['#ffd700','#ffaa22','#ff8800'], 10);
  burst(a.x+16, a.y+16, ['#bbbbbb','#dddddd'], 6);
  player.xp += RANK_XP[a.rank] || 10;
  while (player.xp >= player.xpNext) {
    player.xp    -= player.xpNext;
    player.level++;
    player.maxHp += LVL_HP;
    player.hp     = player.maxHp;
    player.atkDmg += LVL_DMG;
    player.def    += LVL_DEF;
    player.speed  += LVL_SPD;
    player.xpNext  = XP_BASE + (player.level - 1) * XP_SCALE;
    showMsg('LEVEL UP!  Now LV ' + player.level + '!');
    burst(player.x+16, player.y+16, ['#ffdd00','#ffffff','#88ff44'], 14);
  }
  // F-rank ranger: 10% chance to drop a skill not yet owned
  if (a.rank === 'F' && a.cls === 'ranger' && Math.random() < 0.10) {
    const pool = ['fRankLeap', 'fRankBowMastery'].filter(
      sk => !player.unlockedSkills.includes(sk) && !player.slots.includes(sk)
    );
    if (pool.length > 0) {
      const dropped = pool[Math.floor(Math.random() * pool.length)];
      player.unlockedSkills.push(dropped);
      showTopMsg('SKILL DROP: ' + SKILLS[dropped].name + '!  Open Skills menu to equip.');
    }
  }
  // F-rank cleric: 10% chance to drop [F] Soft Heal
  if (a.rank === 'F' && a.cls === 'cleric' && Math.random() < 0.10) {
    const pool = ['fLesserHeal'].filter(
      sk => !player.unlockedSkills.includes(sk) && !player.slots.includes(sk)
    );
    if (pool.length > 0) {
      player.unlockedSkills.push(pool[0]);
      showTopMsg('SKILL DROP: ' + SKILLS[pool[0]].name + '!  Open Skills menu to equip.');
    }
  }
  // F-rank warrior: 10% chance to drop a skill not yet owned
  if (a.rank === 'F' && a.cls === 'warrior' && Math.random() < 0.10) {
    const pool = ['fRankFranticCharge', 'fRankSteelSkin'].filter(
      sk => !player.unlockedSkills.includes(sk) && !player.slots.includes(sk)
    );
    if (pool.length > 0) {
      const dropped = pool[Math.floor(Math.random() * pool.length)];
      player.unlockedSkills.push(dropped);
      showTopMsg('SKILL DROP: ' + SKILLS[dropped].name + '!  Open Skills menu to equip.');
    }
  }
  // F-rank rogue: 10% chance to drop [F] Quick Feet
  if (a.rank === 'F' && a.cls === 'rogue' && Math.random() < 0.10) {
    const pool = ['fRankQuickFeet'].filter(
      sk => !player.unlockedSkills.includes(sk) && !player.slots.includes(sk)
    );
    if (pool.length > 0) {
      player.unlockedSkills.push(pool[0]);
      showTopMsg('SKILL DROP: ' + SKILLS[pool[0]].name + '!  Open Skills menu to equip.');
    }
  }
}

function triggerTrap(trap, triggerAdv) {
  const cfg = TRAP_TYPES[trap.type];
  trap.active = false;
  trap.cooldownTimer = cfg.cooldown;

  if (trap.type === 'groundSpikes') {
    const dmgPct = cfg.baseEffect + (trap.level - 1) * cfg.upgradeBoost;
    const dmg = Math.max(1, Math.round(triggerAdv.maxHp * dmgPct));
    triggerAdv.hp -= dmg;
    triggerAdv.flash = 0.3;
    burst(triggerAdv.x+16, triggerAdv.y+16, ['#cc8844','#ff6622','#ffcc66'], 8);
    if (trap.durability === undefined) trap.durability = cfg.durabilityAtLevel(trap.level);
    trap.durability = Math.max(0, trap.durability - 1);
    if (trap.durability <= 0) {
      trap.cooldownTimer = Infinity;
      showMsg('Spikes! ' + triggerAdv.cls + ' -' + dmg + ' HP  (Broken — refills next wave)');
    } else {
      showMsg('Spikes! ' + triggerAdv.cls + ' -' + dmg + ' HP  (DUR:' + trap.durability + ')');
    }
    if (triggerAdv.hp <= 0) killAdventurer(triggerAdv);
  } else if (trap.type === 'fartMushroom') {
    const fogR = cfg.baseEffect + (trap.level - 1) * cfg.upgradeBoost;
    let affected = 0;
    for (const a of adventurers) {
      if (!a.alive) continue;
      const agx = Math.floor((a.x+16)/TILE), agy = Math.floor((a.y+16)/TILE);
      if (Math.abs(agx - trap.gx) <= fogR && Math.abs(agy - trap.gy) <= fogR) {
        a.fartFlee = true; a.fartFleeTimer = 3.0;
        a.fartFleeX = trap.gx * TILE + 20; a.fartFleeY = trap.gy * TILE + 20;
        a.path = null; affected++;
      }
    }
    for (let i = 0; i < 14; i++) {
      const ox = (Math.random()-0.5)*fogR*TILE*2.2, oy = (Math.random()-0.5)*fogR*TILE*2.2;
      burst(trap.gx*TILE+20+ox, trap.gy*TILE+20+oy, ['#88aa22','#aabb44','#ccdd55','#667711'], 3);
    }
    showMsg('Fart cloud! ' + affected + ' adventurer(s) flee!');
    trap.cooldownTimer = Infinity; // disabled until wave reset
  }
}

function updateEmberboltTraps(dt) {
  for (const trap of placedTraps) {
    if (trap.type !== 'emberbolt') continue;
    const fireRate = TRAP_TYPES.emberbolt.fireRateAtLevel(trap.level);
    trap.fireTimer = (trap.fireTimer || 0) - dt;
    if (trap.fireTimer <= 0) {
      trap.fireTimer = fireRate;
      const dirs = { right:[1,0], left:[-1,0], up:[0,-1], down:[0,1] };
      const [dvx, dvy] = dirs[trap.dir] || [1, 0];
      projectiles.push({
        x: trap.gx * TILE + TILE/2 + dvx * 8,
        y: trap.gy * TILE + TILE/2 + dvy * 8,
        vx: dvx * 280, vy: dvy * 280,
        dmg: 0,
        life: 8.0,
        owner: 'trap_emberbolt',
        trapLevel: trap.level,
      });
    }
  }
}

function dominantSpriteColor(spr, col) {
  const counts = {};
  for (const row of spr) for (const v of row) {
    if (v !== 0) counts[v] = (counts[v] || 0) + 1;
  }
  let best = null, bestN = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) { bestN = n; best = k; }
  }
  return (best !== null && col[best]) ? col[best] : '#ffffff';
}

function attackNearest() {
  let best = null, bestD = player.atkRange;
  for (const a of adventurers) {
    if (!a.alive) continue;
    const d = Math.hypot((a.x+16)-(player.x+16), (a.y+16)-(player.y+16));
    if (d < bestD) { bestD = d; best = a; }
  }
  const atkColor = dominantSpriteColor(player.sprite || PSPR, player.sprColors || PCOL);
  circleAnims.push({ x: player.x+16, y: player.y+16, r: player.atkRange, life: 0.30, maxLife: 0.30, hit: best !== null, color: atkColor });
  if (best) {
    best.hp   -= playerEffAtk();
    best.flash = 0.12;
    player.atkCd = player.atkCdMax;
    const kl = Math.hypot((best.x+16)-(player.x+16), (best.y+16)-(player.y+16)) || 1;
    best.kbX = ((best.x+16)-(player.x+16))/kl * 210;
    best.kbY = ((best.y+16)-(player.y+16))/kl * 210;

    // Warrior, ranger, rogue: permanently aggro on the player when hit
    if (best.cls === 'warrior' || best.cls === 'ranger' || best.cls === 'rogue') {
      best.aggroTimer = 9999; best.aggroTarget = 'player'; best.aggroMinion = null; best.path = null;
    }
    // Cleric: hitting the cleric makes it flee from the player for 3s
    if (best.cls === 'cleric') {
      best.fleeing = true; best.fleeTimer = 3.0;
      best.fleeFromX = player.x+16; best.fleeFromY = player.y+16;
      best.path = null;
    }

    if (best.hp <= 0) {
      killAdventurer(best);
    } else {
      burst(best.x+16, best.y+16, ['#ff4444','#cc1111'], 5);
    }
  }
}

function dungeonCombatClick(mx, my) {
  useSkill(4);
}

function goblinSnatchAttack() {
  const px = player.x + 16, py = player.y + 16;
  const mwx = mouse.x / cam.zoom + cam.wx, mwy = mouse.y / cam.zoom + cam.wy;
  const aimDx = mwx - px, aimDy = mwy - py;
  const aimLen = Math.hypot(aimDx, aimDy) || 1;
  const aimNx = aimDx / aimLen, aimNy = aimDy / aimLen;
  const anim = { x:px, y:py, angle:Math.atan2(aimDy, aimDx), life:0.19, maxLife:0.19, hit:false };
  slashAnims.push(anim);
  const SNATCH_RANGE = 90;
  const SNATCH_COS = Math.cos(Math.PI * 100 / 360);
  const snatchDmg = Math.round(playerEffAtk() * 1.5);
  const coinPerHit = 5 * player.level;
  let totalCoins = 0;
  for (const a of adventurers) {
    if (!a.alive) continue;
    const dx = (a.x+16) - px, dy = (a.y+16) - py;
    const dist = Math.hypot(dx, dy);
    if (dist > SNATCH_RANGE) continue;
    if ((dx/dist)*aimNx + (dy/dist)*aimNy < SNATCH_COS) continue;
    a.hp -= snatchDmg;
    a.flash = 0.15;
    const kl = dist || 1;
    a.kbX = (dx/kl) * 160; a.kbY = (dy/kl) * 160;
    if (a.cls === 'warrior' || a.cls === 'ranger' || a.cls === 'rogue') {
      a.aggroTimer = 9999; a.aggroTarget = 'player'; a.aggroMinion = null; a.path = null;
    }
    if (a.cls === 'cleric') { a.fleeing = true; a.fleeTimer = 3.0; a.fleeFromX = player.x+16; a.fleeFromY = player.y+16; a.path = null; }
    coins += coinPerHit;
    totalCoins += coinPerHit;
    anim.hit = true;
    if (a.hp <= 0) killAdventurer(a);
    else burst(a.x+16, a.y+16, ['#ffd700','#ffaa22','#88ff44'], 5);
  }
  if (anim.hit) {
    burst(px, py, ['#ffd700','#ffee88','#88ff44'], 8);
    showMsg('Goblin Snatch! +' + totalCoins + ' coins stolen!');
  }
}

function goblinFlurryAttack() {
  const px = player.x + 16, py = player.y + 16;
  const mwx = mouse.x / cam.zoom + cam.wx, mwy = mouse.y / cam.zoom + cam.wy;
  const aimDx = mwx - px, aimDy = mwy - py;
  const aimLen = Math.hypot(aimDx, aimDy) || 1;
  const aimNx = aimDx / aimLen, aimNy = aimDy / aimLen;
  const FLURRY_RANGE = player.atkRange;
  const FLURRY_COS   = Math.cos(Math.PI * 100 / 360); // 100° cone, same as Snatch
  const flurryDmg    = Math.round(playerEffAtk() * 0.6);
  const CONE_HALF_F = Math.PI * 50 / 180;
  const sparks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const a = -CONE_HALF_F + t * CONE_HALF_F * 2;
    return [Math.cos(a) * player.atkRange, Math.sin(a) * player.atkRange];
  });
  const anim = { x:px, y:py, angle:Math.atan2(aimDy,aimDx), life:0.073, maxLife:0.073, hit:false, sparks };
  flurryAnims.push(anim);
  for (const a of adventurers) {
    if (!a.alive) continue;
    const dx = (a.x+16)-px, dy = (a.y+16)-py;
    const dist = Math.hypot(dx,dy);
    if (dist > FLURRY_RANGE) continue;
    if ((dx/dist)*aimNx+(dy/dist)*aimNy < FLURRY_COS) continue;
    a.hp -= flurryDmg; a.flash = 0.09;
    const kl = dist||1;
    a.kbX = (dx/kl)*90; a.kbY = (dy/kl)*90;
    if (a.cls==='warrior'||a.cls==='ranger'||a.cls==='rogue') { a.aggroTimer=9999; a.aggroTarget='player'; a.aggroMinion=null; a.path=null; }
    if (a.cls==='cleric') { a.fleeing=true; a.fleeTimer=3.0; a.fleeFromX=player.x+16; a.fleeFromY=player.y+16; a.path=null; }
    anim.hit = true;
    if (a.hp<=0) killAdventurer(a);
    else burst(a.x+16,a.y+16,['#aaff22','#ccff55','#ffff44'],4);
  }
}

// ── Spirit Race skills ────────────────────────────────────────
function spiritSiphonAttack() {
  const px = player.x + 16, py = player.y + 16;
  const mwx = mouse.x / cam.zoom + cam.wx, mwy = mouse.y / cam.zoom + cam.wy;
  const aimDx = mwx - px, aimDy = mwy - py;
  const aimLen = Math.hypot(aimDx, aimDy) || 1;
  const aimNx = aimDx / aimLen, aimNy = aimDy / aimLen;
  const SIPH_COS  = Math.cos(Math.PI * 100 / 360);
  const siphDmg   = Math.round(playerEffAtk() * 0.8);
  const angle     = Math.atan2(aimDy, aimDx);
  const CONE_HALF = Math.PI * 50 / 180;
  // Pre-seed stable suck particles (avoids per-frame random flickering)
  const particles = [];
  for (let i = 0; i < 12; i++) {
    const a = -CONE_HALF + Math.random() * CONE_HALF * 2;
    const r = player.atkRange * (0.25 + Math.random() * 0.75);
    const delay = Math.random() * 0.35;
    particles.push([a, r, delay]);
  }
  const anim = { angle, life: 0.35, maxLife: 0.35, hit: false, particles };
  spiritSiphonAnims.push(anim);
  let totalDmg = 0;
  for (const a of adventurers) {
    if (!a.alive) continue;
    const dx = (a.x+16)-px, dy = (a.y+16)-py;
    const dist = Math.hypot(dx, dy);
    if (dist > player.atkRange) continue;
    if ((dx/dist)*aimNx + (dy/dist)*aimNy < SIPH_COS) continue;
    a.hp -= siphDmg; a.flash = 0.12; totalDmg += siphDmg;
    const kl = dist || 1;
    a.kbX = (dx/kl)*70; a.kbY = (dy/kl)*70;
    if (a.cls==='warrior'||a.cls==='ranger'||a.cls==='rogue') { a.aggroTimer=9999; a.aggroTarget='player'; a.aggroMinion=null; a.path=null; }
    if (a.cls==='cleric') { a.fleeing=true; a.fleeTimer=3.0; a.fleeFromX=px; a.fleeFromY=py; a.path=null; }
    anim.hit = true;
    if (a.hp <= 0) killAdventurer(a);
    else burst(a.x+16, a.y+16, ['#c8ddff','#9966ff','#aabbff'], 4);
  }
  if (totalDmg > 0) {
    const healAmt = Math.max(1, Math.round(totalDmg * 0.05));
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    spawnHealAnim(px, py);
  }
}

function spectralGraspAttack(idx) {
  const px = player.x + 16, py = player.y + 16;
  const mwx = mouse.x / cam.zoom + cam.wx, mwy = mouse.y / cam.zoom + cam.wy;
  const aimDx = mwx - px, aimDy = mwy - py;
  const aimLen = Math.hypot(aimDx, aimDy) || 1;
  const aimNx = aimDx / aimLen, aimNy = aimDy / aimLen;
  const REACH = TILE * 4;
  const GRASP_COS = Math.cos(Math.PI * 60 / 360); // 60° half-angle search cone
  const angle = Math.atan2(aimDy, aimDx);
  let best = null, bestDist = REACH;
  for (const a of adventurers) {
    if (!a.alive) continue;
    const dx = (a.x+16)-px, dy = (a.y+16)-py;
    const dist = Math.hypot(dx, dy);
    if (dist > REACH) continue;
    if (dist > 0 && (dx/dist)*aimNx + (dy/dist)*aimNy < GRASP_COS) continue;
    if (dist < bestDist) { bestDist = dist; best = a; }
  }
  spectralGraspAnim = { angle, life: 0.35, maxLife: 0.35, hit: best !== null };
  if (best) {
    const pullDx = px - (best.x+16), pullDy = py - (best.y+16);
    const pullLen = Math.hypot(pullDx, pullDy) || 1;
    const pullDist = TILE * 2;
    const nx = best.x + (pullDx/pullLen) * pullDist;
    const ny = best.y + (pullDy/pullLen) * pullDist;
    if (canMoveAdv(nx, best.y)) best.x = nx;
    if (canMoveAdv(best.x, ny)) best.y = ny;
    best.hp -= Math.round(playerEffAtk());
    best.flash = 0.15;
    best.stunTimer = 0.5;
    best.kbX = 0; best.kbY = 0;
    best.path = null;
    burst(best.x+16, best.y+16, ['#c8ddff','#6644cc','#aabbff'], 6);
    if (best.hp <= 0) killAdventurer(best);
  } else {
    showMsg('No target in range!');
  }
}

function ghostlyWailAttack(idx) {
  const px = player.x + 16, py = player.y + 16;
  const mwx = mouse.x / cam.zoom + cam.wx, mwy = mouse.y / cam.zoom + cam.wy;
  const aimDx = mwx - px, aimDy = mwy - py;
  const aimLen = Math.hypot(aimDx, aimDy) || 1;
  const aimNx = aimDx / aimLen, aimNy = aimDy / aimLen;
  const WAIL_RADIUS = TILE * 3;
  const WAIL_COS    = Math.cos(Math.PI * 100 / 360); // 50° half-angle = 100° cone, same as Goblin Snatch
  const angle = Math.atan2(aimDy, aimDx);
  ghostlyWailAnim = { angle, life: 0.45, maxLife: 0.45 };
  let hit = false;
  for (const a of adventurers) {
    if (!a.alive) continue;
    const dx = (a.x+16)-px, dy = (a.y+16)-py;
    const dist = Math.hypot(dx, dy);
    if (dist > WAIL_RADIUS) continue;
    if (dist > 0 && (dx/dist)*aimNx + (dy/dist)*aimNy < WAIL_COS) continue;
    a.fleeing = true; a.fleeTimer = 1.5;
    a.fleeFromX = px; a.fleeFromY = py;
    a.aggroTimer = 0; a.aggroTarget = null; a.aggroMinion = null;
    a.luredByMimic = null; a.path = null;
    const kl = dist || 1;
    a.kbX = (dx/kl) * TILE * 2 * 8; a.kbY = (dy/kl) * TILE * 2 * 8;
    burst(a.x+16, a.y+16, ['#c8ddff','#aabbff','#ffffff'], 5);
    hit = true;
  }
  if (!hit) showMsg('No enemies in range!');
}

// ── Slime Race skill functions ────────────────────────────────
const SLIMY_COLORS = ['#88ff44','#ff6622','#22aaff','#ff22cc','#ffdd22','#22ddff','#ff4488','#aaff00'];

function spawnSlimePuddle(wx, wy, color) {
  const gx = Math.floor(wx / TILE) * TILE;
  const gy = Math.floor(wy / TILE) * TILE;
  slimePuddles.push({ wx: gx, wy: gy, life: 3.0, maxLife: 3.0, color });
}

function slimeBallsAttack(idx) {
  const px = player.x + 16, py = player.y + 16;
  const wmx = mouse.x / cam.zoom + cam.wx, wmy = mouse.y / cam.zoom + cam.wy;
  const dx = wmx - px, dy = wmy - py;
  const dist = Math.hypot(dx, dy) || 1;
  const spd = 420;
  const range = TILE * 8;
  projectiles.push({
    x: px, y: py,
    vx: (dx / dist) * spd, vy: (dy / dist) * spd,
    dmg: Math.round(playerEffAtk() * 0.8),
    life: range / spd,
    owner: 'player_slimeBall',
  });
}

function acidPuddlesAttack(idx) {
  const px = player.x + 16, py = player.y + 16;
  const wmx = mouse.x / cam.zoom + cam.wx, wmy = mouse.y / cam.zoom + cam.wy;
  const tx = Math.floor(wmx / TILE) * TILE + TILE / 2;
  const ty = Math.floor(wmy / TILE) * TILE + TILE / 2;
  const dx = tx - px, dy = ty - py;
  const distToTarget = Math.hypot(dx, dy) || 1;
  const spd = 300;
  projectiles.push({
    x: px, y: py,
    vx: (dx / distToTarget) * spd, vy: (dy / distToTarget) * spd,
    dmg: 0,
    life: (distToTarget / spd) + 0.5,
    owner: 'player_acidPuddle',
    targetX: tx, targetY: ty,
  });
}

function cellDivisionAttack(idx) {
  for (let i = 0; i < 2; i++) {
    const ox = (i === 0 ? -1 : 1) * (TILE + 4);
    const col = SLIMY_COLORS[Math.floor(Math.random() * SLIMY_COLORS.length)];
    slimyMinions.push({
      x: player.x + 16 + ox - 12,
      y: player.y + 4,
      hp: 1, maxHp: 1, atk: 1, def: 1,
      speed: 40,
      atkCd: 0, atkCdMax: 1.5,
      alive: true,
      color: col,
      bobPhase: Math.random() * Math.PI * 2,
      flash: 0,
      kbX: 0, kbY: 0,
    });
  }
}

function updateSlimyMinions(dt) {
  for (const m of slimyMinions) {
    if (!m.alive) continue;
    m.bobPhase += dt * 6;
    if (m.flash > 0) m.flash -= dt;
    if (m.kbX || m.kbY) {
      const nx = m.x + m.kbX * dt, ny = m.y + m.kbY * dt;
      if (canMove(nx, m.y, 24, 24)) m.x = nx; else m.kbX = 0;
      if (canMove(m.x, ny, 24, 24)) m.y = ny; else m.kbY = 0;
      m.kbX *= (1 - dt * 12); m.kbY *= (1 - dt * 12);
      if (Math.abs(m.kbX) < 5) m.kbX = 0;
      if (Math.abs(m.kbY) < 5) m.kbY = 0;
    }
    let bestDist = TILE * 10 + 1, best = null;
    for (const a of adventurers) {
      if (!a.alive) continue;
      const d = Math.hypot((a.x+16)-(m.x+12),(a.y+16)-(m.y+12));
      if (d < bestDist) { bestDist = d; best = a; }
    }
    if (best && bestDist > 28) {
      const ddx = (best.x+16)-(m.x+12), ddy = (best.y+16)-(m.y+12);
      const dl = Math.hypot(ddx, ddy) || 1;
      const nx = m.x + (ddx/dl)*m.speed*dt, ny = m.y + (ddy/dl)*m.speed*dt;
      if (canMove(nx, m.y, 24, 24)) m.x = nx;
      if (canMove(m.x, ny, 24, 24)) m.y = ny;
    }
    if (m.atkCd > 0) m.atkCd -= dt;
    if (best && bestDist < 28 && m.atkCd <= 0) {
      best.hp -= m.atk;
      best.flash = 0.08;
      m.atkCd = m.atkCdMax;
      if (best.hp <= 0) killAdventurer(best);
    }
  }
  slimyMinions = slimyMinions.filter(m => m.alive);
}

function updateSlimePuddles(dt) {
  for (const p of slimePuddles) p.life -= dt;
  slimePuddles = slimePuddles.filter(p => p.life > 0);
  for (const p of slimePuddles) {
    for (const a of adventurers) {
      if (!a.alive) continue;
      const ax = a.x + 16, ay = a.y + 16;
      if (ax >= p.wx && ax < p.wx + TILE && ay >= p.wy && ay < p.wy + TILE) {
        a.slimedAmt   = Math.min(a.slimedAmt, 0.5);
        a.slimedTimer = 3.0;
        if (a.acidTimer <= 0) {
          a.acidTimer     = 1.0;
          a.acidDmg       = Math.max(1, Math.round(a.maxHp * 0.02));
          a.acidTickTimer = 0.2;
        }
      }
    }
  }
}

function drawSlimePuddles() {
  const t = gNow() / 1000;
  for (const p of slimePuddles) {
    const alpha = 0.5 + 0.15 * Math.sin(t * 3 + p.wx * 0.1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.wx, p.wy, TILE, TILE);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.wx + 2, p.wy + 2, TILE - 4, TILE - 4);
    ctx.globalAlpha = 1;
    const lifeFrac = p.life / 3.0;
    ctx.fillStyle = p.color + '88';
    ctx.fillRect(p.wx, p.wy + TILE - 3, TILE * lifeFrac, 3);
  }
}

function drawSlimyMinions() {
  for (const m of slimyMinions) {
    if (!m.alive) continue;
    const bob = Math.sin(m.bobPhase) * 1.5;
    const dx = Math.round(m.x), dy = Math.round(m.y + bob);
    ctx.globalAlpha = m.flash > 0 ? 0.4 : 1;
    const slimyCol = { 1: m.color, 2: '#112211', 3: '#ffffff' };
    sprS(SLIME_SPR, slimyCol, dx, dy, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111'; ctx.fillRect(dx+1, dy-5, 16, 3);
    ctx.fillStyle = '#44ff22'; ctx.fillRect(dx+1, dy-5, 16 * (m.hp/m.maxHp), 3);
  }
}

// ── Spirit skill draw functions ───────────────────────────────
function drawSpiritSiphonAnims() {
  const REACH     = player.atkRange;
  const CONE_HALF = Math.PI * 50 / 180;
  for (const s of spiritSiphonAnims) {
    const progress = 1 - s.life / s.maxLife; // 0=fresh 1=done
    const alpha = progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1;
    ctx.save();
    ctx.translate(player.x + 16, player.y + 16);
    ctx.rotate(s.angle);
    ctx.shadowBlur = 10;
    ctx.shadowColor = s.hit ? '#9944ff' : '#4466cc';

    // Cone fill — bright at start, fades as energy is drained inward
    ctx.globalAlpha = alpha * Math.max(0, 0.4 - progress * 0.4);
    ctx.fillStyle = s.hit ? 'rgba(180,100,255,0.5)' : 'rgba(100,140,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, REACH, -CONE_HALF, CONE_HALF);
    ctx.closePath();
    ctx.fill();

    // Wisp particles sucked inward toward player
    ctx.strokeStyle = s.hit ? '#cc88ff' : '#88aaff';
    for (const [pa, pr, delay] of s.particles) {
      const t = Math.max(0, (progress - delay) / (1 - delay));
      if (t <= 0) continue;
      const eased = 1 - Math.pow(1 - t, 2); // ease-in: accelerates toward center
      const r = pr * (1 - eased);
      const wx = Math.cos(pa) * r, wy = Math.sin(pa) * r;
      const size = Math.max(0.5, 3.5 * (1 - eased));
      ctx.globalAlpha = alpha * (1 - eased) * 0.85;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(wx, wy, size, 0, Math.PI * 2); ctx.stroke();
    }

    // Center absorption glow — brightens as particles arrive
    ctx.globalAlpha = alpha * Math.min(1, progress * 1.5) * (s.hit ? 0.9 : 0.5);
    ctx.fillStyle = s.hit ? '#dd99ff' : '#99bbff';
    ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(0, 0, 5 * Math.min(1, progress * 2), 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }
}

function drawSpectralGraspAnim() {
  if (!spectralGraspAnim) return;
  const sg = spectralGraspAnim;
  const progress = 1 - sg.life / sg.maxLife;
  // Extend 0→0.5, hold 0.5→0.7, retract 0.7→1.0
  let extFrac;
  if      (progress < 0.5) extFrac = progress / 0.5;
  else if (progress < 0.7) extFrac = 1;
  else                      extFrac = 1 - (progress - 0.7) / 0.3;
  const alpha = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;
  const len   = TILE * 4 * extFrac;
  const col   = sg.hit ? '#cc99ff' : '#7799dd';
  const glow  = sg.hit ? '#9944ff' : '#2244aa';

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(player.x + 16, player.y + 16);
  ctx.rotate(sg.angle);
  ctx.shadowBlur = 14;
  ctx.shadowColor = glow;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── Forearm — tapered filled shape ────────────────────────────
  const wristX = len - 20;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(2, -5);
  ctx.lineTo(wristX, -3.5);
  ctx.lineTo(wristX,  3.5);
  ctx.lineTo(2,  5);
  ctx.closePath();
  ctx.fill();

  // ── Hand + fingers (fade in as arm extends) ───────────────────
  if (extFrac > 0.25) {
    const handT = Math.min(1, (extFrac - 0.25) / 0.35);
    ctx.globalAlpha = alpha * handT;

    // Palm — ellipse bridging wrist to knuckles
    const palmCX = len - 12;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(palmCX, 0, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Knuckle line: front edge of palm where fingers begin
    const kx = palmCX + 9;

    // 4 main fingers: [baseY, forward-angle, length, stroke-width]
    const fingers = [
      { by: -9,  a: -0.22, fl: 15, w: 2.8 },  // index
      { by: -3,  a: -0.06, fl: 17, w: 3.0 },  // middle (longest)
      { by:  3,  a:  0.09, fl: 15, w: 2.8 },  // ring
      { by:  9,  a:  0.24, fl: 11, w: 2.4 },  // pinky
    ];

    ctx.strokeStyle = col;
    for (const f of fingers) {
      const ex = kx + Math.cos(f.a) * f.fl;
      const ey = f.by + Math.sin(f.a) * f.fl;
      // Finger shaft — slightly curved bezier
      ctx.lineWidth = f.w;
      ctx.beginPath();
      ctx.moveTo(kx, f.by);
      ctx.quadraticCurveTo(kx + f.fl * 0.5, f.by + Math.sin(f.a) * f.fl * 0.4, ex, ey);
      ctx.stroke();
      // Rounded fingertip
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(ex, ey, f.w * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thumb — emerges from the lower side of the palm, angled forward-upward
    const thumbBx = palmCX - 1, thumbBy = 13;
    const thumbEx = palmCX + 8,  thumbEy = 8;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(thumbBx, thumbBy);
    ctx.quadraticCurveTo(thumbBx + 4, thumbBy - 1, thumbEx, thumbEy);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(thumbEx, thumbEy, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Wisp trail along the arm ───────────────────────────────────
  ctx.globalAlpha = alpha * 0.28;
  ctx.strokeStyle = '#aabbff';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 6;
  for (let i = 1; i <= 3; i++) {
    const ox = Math.sin(progress * 12 + i) * 4;
    ctx.beginPath();
    ctx.arc(len * (i / 4), ox, 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGhostlyWailAnim() {
  if (!ghostlyWailAnim) return;
  const gw = ghostlyWailAnim;
  const progress = 1 - gw.life / gw.maxLife;
  const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
  const CONE_HALF = Math.PI * 50 / 180; // 50° half-angle = 100° total cone
  const R = TILE * 3;
  ctx.save();
  ctx.globalAlpha = alpha * 0.45;
  ctx.translate(player.x + 16, player.y + 16);
  ctx.rotate(gw.angle);
  // Cone fill
  ctx.fillStyle = 'rgba(180,160,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, R * (0.5 + progress * 0.5), -CONE_HALF, CONE_HALF);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha;
  // Expanding concentric arcs for wave effect
  ctx.strokeStyle = '#c8ddff';
  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#9966ff';
  for (let i = 0; i < 3; i++) {
    const wave = ((progress + i * 0.33) % 1);
    ctx.lineWidth = 2 - wave;
    ctx.globalAlpha = alpha * (1 - wave) * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, R * wave, -CONE_HALF, CONE_HALF);
    ctx.stroke();
  }
  // Cone edges
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = '#aabbff'; ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-CONE_HALF)*R, Math.sin(-CONE_HALF)*R);
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(CONE_HALF)*R,  Math.sin(CONE_HALF)*R);
  ctx.stroke();
  ctx.restore();
}

function drawEtherealVeilAura() {
  if (player.raceSkill !== 'spiritRace') return;
  const t = gNow() / 1000;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.5);
  ctx.save();
  ctx.globalAlpha = 0.18 * pulse;
  ctx.strokeStyle = '#c8ddff';
  ctx.shadowBlur  = 14;
  ctx.shadowColor = '#8899ff';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.arc(player.x+16, player.y+16, TILE * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.06 * pulse;
  ctx.fillStyle   = '#aabbff';
  ctx.beginPath(); ctx.arc(player.x+16, player.y+16, TILE * 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function uiClick(mx, my) {
  const ux = DW;
  if (inR(mx,my, ux+10,155, UW-20,36)) { if (!heart && !heartCarried) placeMode = placeMode==='heart' ? null : 'heart'; return; }
  if (inR(mx,my, ux+10,232, UW-20,28)) { if (heartCarried) { showMsg('Place the Heart down first!'); return; } shopOpen = !shopOpen; if (shopOpen) { skillMenuOpen = false; invOpen = false; pendingSkill = null; shopScrollY = 0; } return; }
  if (inR(mx,my, ux+10,266, UW-20,28)) { if (heartCarried) { showMsg('Place the Heart down first!'); return; } skillMenuOpen = !skillMenuOpen; if (skillMenuOpen) { shopOpen = false; invOpen = false; skillScrollY = 0; } else { pendingSkill = null; } return; }
  if (inR(mx,my, ux+10,300, UW-20,28)) { if (heartCarried) { showMsg('Place the Heart down first!'); return; } invOpen = !invOpen; if (invOpen) { shopOpen = false; skillMenuOpen = false; pendingSkill = null; invTab = 'traps'; invScrollY = 0; } return; }
  if (inR(mx,my, ux+10,421, UW-20,28)) { if (heartCarried) showMsg('Place Heart down first!'); else if (!heart) showMsg('Place Heart first!'); else startRaid(); }
}

function trapShopItems() {
  return [
    { key:'trapSlots', name:'TRAP CAPACITY', type:'slotUpgrade',
      desc: 'Expand trap slots: '+trapSlots+' → '+(trapSlots+5),
      cost: 1000, have: trapSlots+' slots', maxed: false },
    { key:'groundSpikes', name:'GROUND SPIKES', type:'trap',
      desc: '5% max HP dmg  Upg:50 coins', cost: TRAP_TYPES.groundSpikes.baseCost, have: trapInventory.filter(t=>t.type==='groundSpikes').length },
    { key:'fartMushroom', name:'FART MUSHROOM', type:'trap',
      desc: '3x3 flee fog  Upg:200 coins', cost: TRAP_TYPES.fartMushroom.baseCost, have: trapInventory.filter(t=>t.type==='fartMushroom').length },
    { key:'quicksand', name:'QUICKSAND', type:'trap',
      desc: 'Hidden. Reveals on step. -20% SPD + 1% HP/s  Dur:∞  Upg:160 coins', cost: TRAP_TYPES.quicksand.baseCost, have: trapInventory.filter(t=>t.type==='quicksand').length },
    { key:'emberbolt', name:'EMBERBOLT TRAP', type:'trap',
      desc: 'Always visible. WASD to aim. Fires fire arrow every 1s. 10% maxHP + 5s burn.  Upg:150 coins', cost: TRAP_TYPES.emberbolt.baseCost, have: trapInventory.filter(t=>t.type==='emberbolt').length },
  ];
}

function minionShopItems() {
  return [
    { key:'skeleton', name:'SKELETON', type:'minion',
      desc:'Very weak. Attacks adventurers on sight. Respawns in 10s.',
      cost: MINION_TYPES.skeleton.baseCost, food: MINION_TYPES.skeleton.foodPerLevel,
      have: minionInventory.filter(m=>m.type==='skeleton').length + placedMinions.filter(m=>m.type==='skeleton').length },
    { key:'goblin', name:'GOBLIN MINION', type:'minion',
      desc:'Weak but fast. Attacks adventurers on sight.',
      cost: player.raceSkill === 'goblinRace' ? Math.round(MINION_TYPES.goblin.baseCost * 0.5) : MINION_TYPES.goblin.baseCost,
      food: MINION_TYPES.goblin.foodPerLevel,
      have: minionInventory.filter(m=>m.type==='goblin').length + placedMinions.filter(m=>m.type==='goblin').length },
    { key:'goblinWarrior', name:'GOBLIN WARRIOR', type:'minion',
      desc:'Armored tank. High HP and DEF. Slow melee fighter.',
      cost: player.raceSkill === 'goblinRace' ? Math.round(MINION_TYPES.goblinWarrior.baseCost * 0.5) : MINION_TYPES.goblinWarrior.baseCost,
      food: MINION_TYPES.goblinWarrior.foodPerLevel,
      locked: ![...minionInventory,...placedMinions].some(m=>m.type==='goblin'&&m.level>=5),
      have: minionInventory.filter(m=>m.type==='goblinWarrior').length + placedMinions.filter(m=>m.type==='goblinWarrior').length },
    { key:'goblinArcher', name:'GOBLIN ARCHER', type:'minion',
      desc:'Poison arrows every 1s. Leaps away when cornered. 15-tile range.',
      cost: player.raceSkill === 'goblinRace' ? Math.round(MINION_TYPES.goblinArcher.baseCost * 0.5) : MINION_TYPES.goblinArcher.baseCost,
      food: MINION_TYPES.goblinArcher.foodPerLevel,
      locked: ![...minionInventory,...placedMinions].some(m=>m.type==='goblin'&&m.level>=5),
      have: minionInventory.filter(m=>m.type==='goblinArcher').length + placedMinions.filter(m=>m.type==='goblinArcher').length },
    { key:'goblinMage', name:'GOBLIN MAGE', type:'minion',
      desc:'Firebolts every 1.5s. Applies burn. Keeps distance. 10-tile range.',
      cost: player.raceSkill === 'goblinRace' ? Math.round(MINION_TYPES.goblinMage.baseCost * 0.5) : MINION_TYPES.goblinMage.baseCost,
      food: MINION_TYPES.goblinMage.foodPerLevel,
      locked: ![...minionInventory,...placedMinions].some(m=>m.type==='goblin'&&m.level>=5),
      have: minionInventory.filter(m=>m.type==='goblinMage').length + placedMinions.filter(m=>m.type==='goblinMage').length },
    { key:'giantSpider', name:'GIANT SPIDER', type:'minion',
      desc:'Bites nearby foes. Webs slow distant ones 50% for 3s.',
      cost: MINION_TYPES.giantSpider.baseCost, food: MINION_TYPES.giantSpider.foodPerLevel,
      have: minionInventory.filter(m=>m.type==='giantSpider').length + placedMinions.filter(m=>m.type==='giantSpider').length },
    { key:'mimic', name:'MIMIC', type:'minion',
      desc:'Disguises as a chest. Lures adventurers in, then attacks!',
      cost: MINION_TYPES.mimic.baseCost, food: MINION_TYPES.mimic.foodPerLevel,
      have: minionInventory.filter(m=>m.type==='mimic').length + placedMinions.filter(m=>m.type==='mimic').length },
  ];
}

function dungeonShopItems() {
  return [
    { key:'corridor', name:'CORRIDOR', type:'corridor',
      desc:'5-wide passage. Click outer wall to expand.',
      cost: 0, have: corridorInventory },
    { key:'dungeonRoom', name:'DUNGEON ROOM', type:'dungeonRoom',
      desc:'New 15x15 room. Place at corridor end.',
      cost: 0, have: dungeonRoomInventory },
  ];
}

function shopClick(mx, my) {
  if (inR(mx,my, SX+SW-38, SY+8, 28, 28)) { shopOpen = false; return; }
  const TAB_W = 75, TAB_GAP = 4;
  if (inR(mx,my, SX+12,SY+40, TAB_W,24))                      { shopTab='food';    shopScrollY=0; return; }
  if (inR(mx,my, SX+12+(TAB_W+TAB_GAP),SY+40, TAB_W,24))      { shopTab='traps';   shopScrollY=0; return; }
  if (inR(mx,my, SX+12+(TAB_W+TAB_GAP)*2,SY+40, TAB_W,24))    { shopTab='minions'; shopScrollY=0; return; }
  if (inR(mx,my, SX+12+(TAB_W+TAB_GAP)*3,SY+40, TAB_W,24))    { shopTab='dungeon'; shopScrollY=0; return; }

  // Apply scroll offset for content area clicks
  const SHOP_CTOP = SY + 70, SHOP_CBOT = SY + SH;
  if (my < SHOP_CTOP || my > SHOP_CBOT) return;
  const smy = my + shopScrollY;

  if (shopTab === 'food') {
    const items = foodShopItems();
    let iy = SY + 76;
    for (const item of items) {
      const rowH = item.food !== undefined ? 94 : 80;
      if (inR(mx,smy, SX+SW-104, iy+20, 88, 32)) {
        if (item.type === 'tile') {
          if (coins >= item.cost) {
            coins -= item.cost; ctInv++;
            showMsg('Dungeon Soil purchased! (' + ctInv + ' owned)');
          } else showMsg('Need ' + item.cost + ' coins!');
        } else {
          if (food >= item.cost) {
            food -= item.cost;
            const mEntry = { type:'goblinFarmer', level:1, combatTimer:0, webCd:0, arrowCd:0, fireCd:0, leapCd:0, foodAccum:0 };
            minionInventory.push(mEntry);
            showMsg('Mushroom Farmer added to inventory!');
          } else showMsg('Need ' + item.cost + ' food!');
        }
      }
      iy += rowH;
    }
  } else if (shopTab === 'traps') {
    const items = trapShopItems();
    let iy = SY + 76;
    for (const item of items) {
      if (inR(mx,smy, SX+SW-104, iy+20, 88, 32)) {
        if (item.maxed) { showMsg('Already at maximum!'); }
        else if (coins >= item.cost) {
          coins -= item.cost;
          if (item.type === 'slotUpgrade') {
            trapSlots += 5;
            showMsg('Trap slots expanded to ' + trapSlots + '!');
          } else {
            const cfg = TRAP_TYPES[item.key];
            const newTrap = { type:item.key, level:1, cooldownTimer:0, active:true };
            if (item.key === 'groundSpikes') newTrap.durability = TRAP_TYPES.groundSpikes.durabilityAtLevel(1);
            trapInventory.push(newTrap);
            showMsg(cfg.name + ' added to inventory!');
          }
        } else showMsg('Need ' + item.cost + ' coins!');
      }
      iy += 80;
    }
  } else if (shopTab === 'minions') {
    const items = minionShopItems();
    let iy = SY + 76;
    for (const item of items) {
      const rowH = item.food !== undefined ? 94 : 80;
      if (inR(mx,smy, SX+SW-104, iy+20, 88, 32)) {
        if (item.locked) { showMsg('Upgrade a Goblin Minion to level 5 to unlock this!'); }
        else if (food >= item.cost) {
          food -= item.cost;
          const mEntry = { type:item.key, level:1, combatTimer:0, webCd:0, arrowCd:0, fireCd:0, leapCd:0, foodAccum:0 };
          if (item.key === 'mimic') { mEntry.mimicForm = 'chest'; mEntry.luredAdv = null; }
          minionInventory.push(mEntry);
          showMsg(MINION_TYPES[item.key].name + ' added to inventory!');
        } else showMsg('Need ' + item.cost + ' food!');
      }
      iy += rowH;
    }
  } else if (shopTab === 'dungeon') {
    const items = dungeonShopItems();
    let iy = SY + 76;
    for (const item of items) {
      if (inR(mx,smy, SX+SW-104, iy+20, 88, 32)) {
        if (item.type === 'corridor') {
          corridorInventory++;
          placeMode = 'corridor';
          shopOpen = false;
          showMsg('Corridor purchased!  Click an outer dungeon wall to place it.');
        } else if (item.type === 'dungeonRoom') {
          if (worldCorridors.some(c => c.toRoomId === null)) {
            dungeonRoomInventory++;
            placeMode = 'dungeonRoom';
            shopOpen = false;
            showMsg('Dungeon Room purchased!  Click the dashed outline to place it.');
          } else {
            showMsg('Place a corridor first!');
          }
        }
      }
      iy += 80;
    }
  }
}

// ── Skill menu click handler ──────────────────────────────────
function skillMenuClick(mx, my) {
  // Close button
  const CX = SKMNX + SKMNW - 38, CY = SKMNY + 8;
  if (inR(mx, my, CX, CY, 28, 28)) { skillMenuOpen = false; pendingSkill = null; return; }

  // Equipped slots (row1: 0-3, row2: 4-5)
  const totalSlotW  = 4 * SK_SLOT_W + 3 * SK_SLOT_GAP;
  const slotStartX  = SKMNX + (SKMNW - totalSlotW) / 2;
  const slotY       = SKMNY + 56;
  const slotY2      = slotY + SK_SLOT_H + 20;
  const totalSlotW2 = 2 * SK_SLOT_W + 1 * SK_SLOT_GAP;
  const slotStartX2 = SKMNX + (SKMNW - totalSlotW2) / 2;

  for (let i = 0; i < 6; i++) {
    const row2 = i >= 4;
    const col  = row2 ? i - 4 : i;
    const bx   = row2 ? slotStartX2 + col * (SK_SLOT_W + SK_SLOT_GAP) : slotStartX + col * (SK_SLOT_W + SK_SLOT_GAP);
    const by   = row2 ? slotY2 : slotY;
    if (!inR(mx, my, bx, by, SK_SLOT_W, SK_SLOT_H)) continue;

    if (pendingSkill === null) {
      if (player.slots[i]) pendingSkill = { type: 'slot', idx: i };
    } else {
      const movingKey = pendingSkill.type === 'slot'
        ? player.slots[pendingSkill.idx]
        : player.unlockedSkills[pendingSkill.idx];
      const displaced = player.slots[i];
      if (pendingSkill.type === 'slot') {
        player.slots[pendingSkill.idx] = displaced;
        player.slots[i]                = movingKey;
      } else {
        player.slots[i] = movingKey;
        player.unlockedSkills.splice(pendingSkill.idx, 1);
        if (displaced) player.unlockedSkills.push(displaced);
      }
      pendingSkill = null;
    }
    return;
  }

  // Race slot — locked, absorb click so it doesn't fall through
  const raceSlotX = SKMNX + (SKMNW - SK_SLOT_W) / 2;
  const raceSlotY = slotY2 + SK_SLOT_H + 12;
  if (inR(mx, my, raceSlotX, raceSlotY, SK_SLOT_W, SK_SLOT_H)) { pendingSkill = null; return; }

  // Unlocked skill cards (scrollable)
  const sepY        = raceSlotY + SK_SLOT_H + 14;
  const cardsPerRow = Math.floor((SKMNW - 32) / (SK_CARD_W + SK_CARD_GAP));
  const cardStartX  = SKMNX + (SKMNW - cardsPerRow * (SK_CARD_W + SK_CARD_GAP) + SK_CARD_GAP) / 2;
  const cardStartY  = sepY + 24;
  const cardClipTop = cardStartY - 4;
  const smy = (my >= cardClipTop && my <= SKMNY+SKMNH) ? my + skillScrollY : -9999;

  for (let i = 0; i < player.unlockedSkills.length; i++) {
    const col = i % cardsPerRow, row = Math.floor(i / cardsPerRow);
    const cx = cardStartX + col * (SK_CARD_W + SK_CARD_GAP);
    const cy = cardStartY + row * (SK_CARD_H + SK_CARD_GAP);
    if (!inR(mx, smy, cx, cy, SK_CARD_W, SK_CARD_H)) continue;
    if (pendingSkill && pendingSkill.type === 'unlocked' && pendingSkill.idx === i) {
      pendingSkill = null;
    } else {
      pendingSkill = { type: 'unlocked', idx: i };
    }
    return;
  }
}

// ── Draw ─────────────────────────────────────────────────────
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.setTransform(DPR * _gameScale, 0, 0, DPR * _gameScale, _gameOx * DPR, _gameOy * DPR);
  if (gameState === 'raceSelect') {
    drawRaceSelect();
    if (flash && flashT > 0)       drawFlash();
    if (flashTop && flashTopT > 0) drawFlashTop();
    return;
  }
  // ── World view (camera-transformed) ─────────────────────────
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, DW, CH); ctx.clip();
  ctx.fillStyle = '#100a04'; ctx.fillRect(0, 0, DW, CH);
  ctx.setTransform(
    cam.zoom * _gameScale * DPR, 0, 0, cam.zoom * _gameScale * DPR,
    (_gameOx - cam.wx * cam.zoom * _gameScale) * DPR,
    (_gameOy - cam.wy * cam.zoom * _gameScale) * DPR
  );
  if (screenShake && (screenShake.x || screenShake.y)) ctx.translate(screenShake.x, screenShake.y);
  drawWasteland();
  drawWorldCorridors();
  drawExtraRooms();
  drawDungeon();
  if (!paused) {
    if (placeMode === 'heart')                       drawGhost(mouse.x, mouse.y, T_FLOOR, '#ff4488');
    if (placeMode === 'cropTile')                    drawGhost(mouse.x, mouse.y, T_FLOOR, '#7a5230');
    if (placeMode === 'trap_emberbolt') drawEmberboltGhost();
    else if (placeMode && placeMode.startsWith('trap_')) drawGhost(mouse.x, mouse.y, T_FLOOR, '#cc6600');
    if (placeMode === 'minion_giantSpider') drawSpiderGhost();
    else if (placeMode === 'minion_goblinFarmer') drawGhost(mouse.x, mouse.y, T_SOIL, '#cc8833');
    else if (placeMode && placeMode.startsWith('minion_')) drawGhost(mouse.x, mouse.y, T_FLOOR, '#33aa22');
    if (placeMode === 'corridor')                    drawCorridorGhost();
    if (placeMode === 'dungeonRoom')                 drawRoomGhost();
  }
  drawSlimePuddles();
  if (heart) drawHeart();
  drawMinions();
  drawSlimyMinions();
  for (const a of adventurers) if (a.alive) drawAdventurer(a);
  drawHeavensWake();
  drawFireboltCast();
  drawLesserHealCast();
  drawSelfHealCast();
  drawLhAOEAnim();
  drawHealAnims();
  drawSnatchAnims();
  drawFlurryAnims();
  drawSpiritSiphonAnims();
  drawSpectralGraspAnim();
  drawGhostlyWailAnim();
  drawEtherealVeilAura();
  drawParticles();
  drawProjectiles();
  drawPlayer();
  drawCircleAnims();
  ctx.restore();
  // ── Screen-space HUD ─────────────────────────────────────────
  if (!paused) drawWaveWarning();
  drawHeavensWakeCastBar();
  drawFireboltCastBar();
  drawLesserHealCastBar();
  drawSelfHealCastBar();
  drawSkillBar();
  drawUI();
  if (shopOpen && !paused)                          drawShop();
  if (skillMenuOpen && !paused)                     drawSkillMenu();
  if (invOpen && !paused)                           drawInventory();
  if (trapContext && gameState==='build' && !paused)   drawTrapContext();
  if (minionContext && gameState==='build' && !paused) drawMinionContext();
  if (soilContext && gameState==='build' && !paused)   drawSoilContext();
  if (paused)   drawPauseOverlay();
  drawPauseBtn();
  if (!focused) drawFocusPrompt();
  if (flash && flashT > 0)       drawFlash();
  if (flashTop && flashTopT > 0) drawFlashTop();
  if (gameState === 'gameover') drawGameOverOverlay();
}

// ── Shared tile renderer (main dungeon, corridors, extra rooms) ─
function drawDungeonTile(px, py, t, gx, gy, now, trapGX, trapGY) {
  if (t === T_WALL) {
    ctx.fillStyle='#110b1f'; ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle='#231940'; ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
    ctx.fillStyle='#342558';
    const ev=(gx+gy)%2===0;
    ctx.fillRect(px+2, ev?py+3:py+20, 18, 12);
    ctx.fillRect(px+23,ev?py+20:py+3, 14, 12);
    ctx.fillStyle='#4a3370';
    ctx.fillRect(px+1,py+1,TILE-2,2); ctx.fillRect(px+1,py+1,2,TILE-2);
  } else if (t === T_SOIL) {
    ctx.fillStyle='#3d2006'; ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle='#522c0a'; ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
    ctx.fillStyle='#6b3a12';
    for (let i=7; i<TILE-3; i+=8) ctx.fillRect(px+3,py+i,TILE-6,3);
    ctx.strokeStyle='#7a4818'; ctx.lineWidth=0.5; ctx.strokeRect(px+1,py+1,TILE-2,TILE-2);
  } else {
    ctx.fillStyle=FC[((gx*3+gy*7)%3+3)%3]; ctx.fillRect(px,py,TILE,TILE);
    ctx.strokeStyle='#2a2240'; ctx.lineWidth=0.5; ctx.strokeRect(px,py,TILE,TILE);
    if ((gx*13+gy*7)%7===0) {
      ctx.fillStyle='#2c2448';
      ctx.fillRect(px+14,py+14,5,5); ctx.fillRect(px+24,py+22,3,3);
    }
    if (t === T_HEART) {
      const hp=0.25+0.12*Math.sin(now*0.004);
      ctx.fillStyle='rgba(255,40,100,'+hp+')'; ctx.fillRect(px,py,TILE,TILE);
    } else if (t === T_TRAP) {
      const trap = placedTraps.find(tr => tr.gx===trapGX && tr.gy===trapGY);
      if (trap) drawTrapTile(px, py, trap, now);
    }
  }
}

// ── World draw (corridors + extra rooms) ──────────────────────
function drawWorldCorridors() {
  const now = gNow();
  for (const c of worldCorridors) {
    const isEW = c.dir === 'E' || c.dir === 'W';
    const cols = isEW ? 8 : 5, rows = isEW ? 5 : 8;
    const baseGX = Math.floor(c.pxMin / TILE);
    const baseGY = Math.floor(c.pyMin / TILE);
    ctx.fillStyle = '#1c1830';
    ctx.fillRect(c.pxMin, c.pyMin, cols*TILE, rows*TILE);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = c.pxMin + col*TILE, py = c.pyMin + row*TILE;
        const t = c.grid[row][col];
        drawDungeonTile(px, py, t, baseGX+col, baseGY+row, now, baseGX+col, baseGY+row);
      }
    }
    if (c.toRoomId === null) {
      const rox=c.roomWX*TILE, roy=c.roomWY*TILE;
      ctx.strokeStyle='#44ff4466'; ctx.lineWidth=2/cam.zoom;
      ctx.setLineDash([6/cam.zoom, 4/cam.zoom]);
      ctx.strokeRect(rox, roy, GRID*TILE, GRID*TILE);
      ctx.setLineDash([]);
    }
  }
}

function drawExtraRooms() {
  const now = gNow();
  for (const r of worldRooms) {
    if (r.id === 0) continue;
    const ox = r.wx*TILE, oy = r.wy*TILE;
    ctx.fillStyle = '#1c1830';
    ctx.fillRect(ox, oy, GRID*TILE, GRID*TILE);
    for (let lgy = 0; lgy < GRID; lgy++) {
      for (let lgx = 0; lgx < GRID; lgx++) {
        const px = ox+lgx*TILE, py = oy+lgy*TILE, t = r.grid[lgy][lgx];
        drawDungeonTile(px, py, t, r.wx+lgx, r.wy+lgy, now, r.wx+lgx, r.wy+lgy);
      }
    }
  }
}

function corridorGeometry(gx, gy) {
  const LEN = 8, W = 2;
  if (gy === 0 && gx > 0 && gx < GRID-1) {
    const cx = Math.max(W, Math.min(GRID-1-W, gx));
    return { dir:'N', center:cx, pxMin:(cx-W)*TILE, pyMin:-LEN*TILE, pxMax:(cx+W+1)*TILE, pyMax:0, roomWX:cx-7, roomWY:-(LEN+GRID) };
  }
  if (gy === GRID-1 && gx > 0 && gx < GRID-1) {
    const cx = Math.max(W, Math.min(GRID-1-W, gx));
    return { dir:'S', center:cx, pxMin:(cx-W)*TILE, pyMin:GRID*TILE, pxMax:(cx+W+1)*TILE, pyMax:(GRID+LEN)*TILE, roomWX:cx-7, roomWY:GRID+LEN };
  }
  if (gx === 0 && gy > 0 && gy < GRID-1) {
    const cy = Math.max(W, Math.min(GRID-1-W, gy));
    return { dir:'W', center:cy, pxMin:-LEN*TILE, pyMin:(cy-W)*TILE, pxMax:0, pyMax:(cy+W+1)*TILE, roomWX:-(LEN+GRID), roomWY:cy-7 };
  }
  if (gx === GRID-1 && gy > 0 && gy < GRID-1) {
    const cy = Math.max(W, Math.min(GRID-1-W, gy));
    return { dir:'E', center:cy, pxMin:GRID*TILE, pyMin:(cy-W)*TILE, pxMax:(GRID+LEN)*TILE, pyMax:(cy+W+1)*TILE, roomWX:GRID+LEN, roomWY:cy-7 };
  }
  return null;
}

function corridorGeometryForRoom(room, lgx, lgy) {
  const LEN = 8, W = 2;
  const ox = room.wx * TILE, oy = room.wy * TILE;
  if (lgy === 0 && lgx > 0 && lgx < GRID-1) {
    const cx = Math.max(W, Math.min(GRID-1-W, lgx));
    return { dir:'N', center:cx, pxMin:ox+(cx-W)*TILE, pyMin:oy-LEN*TILE, pxMax:ox+(cx+W+1)*TILE, pyMax:oy,
             roomWX:room.wx+cx-7, roomWY:room.wy-LEN-GRID };
  }
  if (lgy === GRID-1 && lgx > 0 && lgx < GRID-1) {
    const cx = Math.max(W, Math.min(GRID-1-W, lgx));
    return { dir:'S', center:cx, pxMin:ox+(cx-W)*TILE, pyMin:oy+GRID*TILE, pxMax:ox+(cx+W+1)*TILE, pyMax:oy+(GRID+LEN)*TILE,
             roomWX:room.wx+cx-7, roomWY:room.wy+GRID+LEN };
  }
  if (lgx === 0 && lgy > 0 && lgy < GRID-1) {
    const cy = Math.max(W, Math.min(GRID-1-W, lgy));
    return { dir:'W', center:cy, pxMin:ox-LEN*TILE, pyMin:oy+(cy-W)*TILE, pxMax:ox, pyMax:oy+(cy+W+1)*TILE,
             roomWX:room.wx-LEN-GRID, roomWY:room.wy+cy-7 };
  }
  if (lgx === GRID-1 && lgy > 0 && lgy < GRID-1) {
    const cy = Math.max(W, Math.min(GRID-1-W, lgy));
    return { dir:'E', center:cy, pxMin:ox+GRID*TILE, pyMin:oy+(cy-W)*TILE, pxMax:ox+(GRID+LEN)*TILE, pyMax:oy+(cy+W+1)*TILE,
             roomWX:room.wx+GRID+LEN, roomWY:room.wy+cy-7 };
  }
  return null;
}

function getCorridorInfoAtWorld(wmx, wmy) {
  // Main dungeon
  const gx = Math.floor(wmx/TILE), gy = Math.floor(wmy/TILE);
  if (gx >= 0 && gy >= 0 && gx < GRID && gy < GRID && grid[gy][gx] === T_WALL) {
    const info = corridorGeometry(gx, gy);
    if (info) return { info, roomRef: null };
  }
  // Extra rooms
  for (const room of worldRooms) {
    if (room.id === 0) continue;
    const ox = room.wx * TILE, oy = room.wy * TILE;
    const lgx = Math.floor((wmx - ox) / TILE), lgy = Math.floor((wmy - oy) / TILE);
    if (lgx < 0 || lgy < 0 || lgx >= GRID || lgy >= GRID) continue;
    if (room.grid[lgy][lgx] !== T_WALL) continue;
    const info = corridorGeometryForRoom(room, lgx, lgy);
    if (info) return { info, roomRef: room };
  }
  return null;
}

function placeCorridorAt(info, roomRef) {
  if (!info) return false;
  const wallGrid = roomRef ? roomRef.grid : grid;
  if (info.dir === 'E' || info.dir === 'W') {
    const col = info.dir === 'E' ? GRID-1 : 0;
    for (let y = info.center - 1; y <= info.center + 1; y++) { if (y>=0&&y<GRID) wallGrid[y][col] = T_FLOOR; }
  } else {
    const row = info.dir === 'S' ? GRID-1 : 0;
    for (let x = info.center - 1; x <= info.center + 1; x++) { if (x>=0&&x<GRID) wallGrid[row][x] = T_FLOOR; }
  }
  const LEN = 8;
  let cgrid;
  if (info.dir === 'E' || info.dir === 'W') {
    cgrid = Array.from({length: 5}, (_, row) =>
      Array.from({length: LEN}, () => (row === 0 || row === 4) ? T_WALL : T_FLOOR)
    );
  } else {
    cgrid = Array.from({length: LEN}, (_, row) =>
      Array.from({length: 5}, (_, col) => (col === 0 || col === 4) ? T_WALL : T_FLOOR)
    );
  }
  worldCorridors.push({ ...info, id: worldCorridors.length, fromRoomId: roomRef ? roomRef.id : 0, toRoomId: null, roomRef: roomRef || null, grid: cgrid });
  corridorInventory--;
  showMsg('Corridor placed!  Buy a Dungeon Room to extend further.');
  placeMode = null;
  fitCamera();
  return true;
}

function roomOverlaps(wxNew, wyNew, skipCorrId) {
  const rpxMin = wxNew*TILE + 1, rpxMax = (wxNew+GRID)*TILE - 1;
  const rpyMin = wyNew*TILE + 1, rpyMax = (wyNew+GRID)*TILE - 1;
  for (const r of worldRooms) {
    const ox=r.wx*TILE, oy=r.wy*TILE, ow=GRID*TILE, oh=GRID*TILE;
    if (rpxMin < ox+ow && rpxMax > ox && rpyMin < oy+oh && rpyMax > oy) return true;
  }
  for (const c of worldCorridors) {
    if (c.id === skipCorrId) continue;
    if (rpxMin < c.pxMax && rpxMax > c.pxMin && rpyMin < c.pyMax && rpyMax > c.pyMin) return true;
  }
  return false;
}

function playerInRoom(r) {
  const ox = r.wx * TILE, oy = r.wy * TILE;
  return player.x + 32 > ox && player.x < ox + GRID*TILE &&
         player.y + 32 > oy && player.y < oy + GRID*TILE;
}

function roomIsEmpty(r) {
  const ox = r.wx * TILE, oy = r.wy * TILE;
  for (const m of placedMinions) {
    if (m.gx * TILE >= ox && m.gx * TILE < ox + GRID*TILE &&
        m.gy * TILE >= oy && m.gy * TILE < oy + GRID*TILE) return false;
  }
  for (const t of placedTraps) {
    if (t.gx * TILE >= ox && t.gx * TILE < ox + GRID*TILE &&
        t.gy * TILE >= oy && t.gy * TILE < oy + GRID*TILE) return false;
  }
  // check r.grid for crop tiles and heart
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (r.grid[y][x] === T_SOIL || r.grid[y][x] === T_HEART) return false;
    }
  }
  return true;
}

function resolveWorldTile(wmx, wmy) {
  const mgx = Math.floor(wmx/TILE), mgy = Math.floor(wmy/TILE);
  if (mgx >= 0 && mgy >= 0 && mgx < GRID && mgy < GRID)
    return { grid, lgx: mgx, lgy: mgy, worldPX: mgx*TILE, worldPY: mgy*TILE, type: 'main', cols: GRID, rows: GRID };
  for (const r of worldRooms) {
    if (r.id === 0) continue;
    const ox = r.wx*TILE, oy = r.wy*TILE;
    const lgx = Math.floor((wmx-ox)/TILE), lgy = Math.floor((wmy-oy)/TILE);
    if (lgx >= 0 && lgy >= 0 && lgx < GRID && lgy < GRID)
      return { grid: r.grid, lgx, lgy, worldPX: ox+lgx*TILE, worldPY: oy+lgy*TILE, type: 'room', obj: r, cols: GRID, rows: GRID };
  }
  for (const c of worldCorridors) {
    if (wmx < c.pxMin || wmx >= c.pxMax || wmy < c.pyMin || wmy >= c.pyMax) continue;
    const isEW = c.dir === 'E' || c.dir === 'W';
    const cols = isEW ? 8 : 5, rows = isEW ? 5 : 8;
    const lgx = Math.floor((wmx-c.pxMin)/TILE), lgy = Math.floor((wmy-c.pyMin)/TILE);
    if (lgx >= 0 && lgy >= 0 && lgx < cols && lgy < rows)
      return { grid: c.grid, lgx, lgy, worldPX: c.pxMin+lgx*TILE, worldPY: c.pyMin+lgy*TILE, type: 'corridor', obj: c, cols, rows };
  }
  return null;
}

function setWorldTile(wgx, wgy, type) {
  const res = resolveWorldTile(wgx*TILE+1, wgy*TILE+1);
  if (res) res.grid[res.lgy][res.lgx] = type;
}

function playerOnCorridor(c) {
  return player.x + 32 > c.pxMin && player.x < c.pxMax &&
         player.y + 32 > c.pyMin && player.y < c.pyMax;
}

function corridorIsEmpty(c) {
  const isEW = c.dir === 'E' || c.dir === 'W';
  const cols = isEW ? 8 : 5, rows = isEW ? 5 : 8;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wgx = Math.floor(c.pxMin/TILE) + col, wgy = Math.floor(c.pyMin/TILE) + row;
      if (placedMinions.some(m => m.gx === wgx && m.gy === wgy)) return false;
      if (placedTraps.some(t => t.gx === wgx && t.gy === wgy)) return false;
      if (c.grid[row][col] === T_SOIL) return false;
    }
  }
  return true;
}

function removeCorridorFromWorld(c) {
  if (playerOnCorridor(c)) { showMsg('Cannot remove — you are on the corridor!'); return; }
  if (!corridorIsEmpty(c)) { showMsg('Cannot remove — items are placed in the corridor!'); return; }
  // Restore the punched wall tiles in whichever room owns this corridor
  const wallGrid = c.roomRef ? c.roomRef.grid : grid;
  if (c.dir === 'E' || c.dir === 'W') {
    const col = c.dir === 'E' ? GRID - 1 : 0;
    for (let y = c.center - 1; y <= c.center + 1; y++) {
      if (y >= 0 && y < GRID) wallGrid[y][col] = T_WALL;
    }
  } else {
    const row = c.dir === 'S' ? GRID - 1 : 0;
    for (let x = c.center - 1; x <= c.center + 1; x++) {
      if (x >= 0 && x < GRID) wallGrid[row][x] = T_WALL;
    }
  }
  worldCorridors.splice(worldCorridors.indexOf(c), 1);
  // Re-index ids
  worldCorridors.forEach((cr, i) => cr.id = i);
  corridorInventory++;
  showMsg('Corridor removed.');
  fitCamera();
}

function removeRoomFromWorld(r) {
  // Disconnect from any corridor that pointed to it
  for (const c of worldCorridors) {
    if (c.toRoomId === r.id) c.toRoomId = null;
  }
  worldRooms.splice(worldRooms.indexOf(r), 1);
  dungeonRoomInventory++;
  showMsg('Dungeon Room removed.');
  fitCamera();
}

function placeRoomAtCorridor(c) {
  if (roomOverlaps(c.roomWX, c.roomWY, c.id)) {
    showMsg('Cannot place here — overlaps with an existing room or corridor!');
    return;
  }
  const id = worldRooms.length;
  const g = Array.from({length:GRID}, (_,y) =>
    Array.from({length:GRID}, (_,x) => (x===0||y===0||x===GRID-1||y===GRID-1) ? T_WALL : T_FLOOR)
  );
  if (c.dir==='E') { for (let y=6;y<=8;y++) g[y][0]=T_FLOOR; }
  if (c.dir==='W') { for (let y=6;y<=8;y++) g[y][GRID-1]=T_FLOOR; }
  if (c.dir==='S') { for (let x=6;x<=8;x++) g[0][x]=T_FLOOR; }
  if (c.dir==='N') { for (let x=6;x<=8;x++) g[GRID-1][x]=T_FLOOR; }
  worldRooms.push({ id, wx: c.roomWX, wy: c.roomWY, grid: g });
  c.toRoomId = id;
  dungeonRoomInventory--;
  showMsg('Dungeon Room ' + id + ' placed and connected!');
  placeMode = null;
  fitCamera();
}

function drawCorridorGhost() {
  if (mouse.x >= DW) return;
  const wmx = mouse.x / cam.zoom + cam.wx, wmy = mouse.y / cam.zoom + cam.wy;
  const hit = getCorridorInfoAtWorld(wmx, wmy);
  if (!hit) return;
  const { info } = hit;
  const pw = info.pxMax - info.pxMin, ph = info.pyMax - info.pyMin;
  ctx.fillStyle = '#4488ff18'; ctx.fillRect(info.pxMin, info.pyMin, pw, ph);
  ctx.strokeStyle = '#4488ffbb'; ctx.lineWidth = 2/cam.zoom;
  ctx.strokeRect(info.pxMin, info.pyMin, pw, ph);
  ctx.fillStyle = '#4488ff88'; ctx.font = (10/cam.zoom)+'px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('CORRIDOR', info.pxMin+pw/2, info.pyMin+ph/2);
  ctx.textAlign='left';
}

function drawRoomGhost() {
  const wmx = mouse.x / cam.zoom + cam.wx, wmy = mouse.y / cam.zoom + cam.wy;
  for (const c of worldCorridors) {
    if (c.toRoomId !== null) continue;
    const rx = c.roomWX*TILE, ry = c.roomWY*TILE, rw = GRID*TILE, rh = GRID*TILE;
    const hover = wmx>=rx && wmx<rx+rw && wmy>=ry && wmy<ry+rh;
    const blocked = roomOverlaps(c.roomWX, c.roomWY, c.id);
    const col = blocked ? '#ff4444' : '#44ff44';
    ctx.strokeStyle = hover ? col+'cc' : col+'55'; ctx.lineWidth = (hover?3:2)/cam.zoom;
    ctx.setLineDash([8/cam.zoom, 5/cam.zoom]);
    ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
    if (hover) { ctx.fillStyle = col+'10'; ctx.fillRect(rx,ry,rw,rh); }
    ctx.fillStyle = hover ? col+'aa' : col+'66';
    ctx.font=(8/cam.zoom)+'px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(blocked ? 'BLOCKED' : 'PLACE ROOM', rx+rw/2, ry+rh/2); ctx.textAlign='left';
  }
}

function fitCamera() {
  let minPX=0, minPY=0, maxPX=GRID*TILE, maxPY=GRID*TILE;
  for (const c of worldCorridors) {
    minPX=Math.min(minPX,c.pxMin); minPY=Math.min(minPY,c.pyMin);
    maxPX=Math.max(maxPX,c.pxMax); maxPY=Math.max(maxPY,c.pyMax);
  }
  for (const r of worldRooms) {
    if (r.id===0) continue;
    minPX=Math.min(minPX,r.wx*TILE); minPY=Math.min(minPY,r.wy*TILE);
    maxPX=Math.max(maxPX,(r.wx+GRID)*TILE); maxPY=Math.max(maxPY,(r.wy+GRID)*TILE);
  }
  const pad = 50;
  const worldW = maxPX - minPX + pad*2, worldH = maxPY - minPY + pad*2;
  cam.zoom = Math.min(1.0, DW / worldW, CH / worldH);
  // wx/wy are managed by camera follow in updateMovement; don't override here
}

// Floor tile shades
const FC = ['#1c1830','#1e1b32','#201d36'];

// Deterministic per-tile hash for wasteland decoration
function wh(gx, gy) {
  let h = (gx * 374761393 + gy * 1073741789) | 0;
  h = (h ^ (h >>> 13)) * 1664525 + 1013904223 | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}


// ── Polluted ponds ─────────────────────────────────────────────
// One pond candidate per POND_CHUNK×POND_CHUNK area; ~1 in 6 chunks has a pond.
// POND_MARGIN keeps centers in the inner region so adjacent-chunk ponds can't overlap.
const POND_CHUNK  = 20;  // chunk size in tiles (increased to space ponds out)
const POND_R      = 3;   // pond radius (tiles)
const POND_MARGIN = 5;   // center kept at least this many tiles from chunk edge
const POND_EXCL   = 8;   // tile buffer from dungeon edge where ponds can't center

function pondAt(gx, gy) {
  const chX  = Math.floor(gx / POND_CHUNK);
  const chY  = Math.floor(gy / POND_CHUNK);
  const inner = POND_CHUNK - POND_MARGIN * 2;  // 10 — usable interior width
  for (let dcy = -1; dcy <= 1; dcy++) {
    for (let dcx = -1; dcx <= 1; dcx++) {
      const cx = chX + dcx, cy = chY + dcy;
      const hc = wh(cx * 37 + 11, cy * 53 + 7);
      if (hc % 6 !== 0) continue;                     // ~1/6 chunks have a pond (50% fewer)
      // Constrain center to chunk interior — guarantees no inter-chunk overlap
      const pcx = cx * POND_CHUNK + POND_MARGIN + (hc >>  4) % inner;
      const pcy = cy * POND_CHUNK + POND_MARGIN + (hc >> 10) % inner;
      // Exclude pond centers within POND_EXCL tiles of the dungeon
      if (pcx > -POND_EXCL && pcx < GRID + POND_EXCL &&
          pcy > -POND_EXCL && pcy < GRID + POND_EXCL) continue;
      const dist = Math.hypot(gx - pcx, gy - pcy);
      // Slightly irregular radius per tile
      const jitter = 1 + 0.2 * (((wh(gx + 3, gy + 5) >> 5) & 7) / 7 - 0.5);
      if (dist < POND_R * jitter)     return 'water';
      if (dist < POND_R * jitter + 1) return 'bank';
    }
  }
  return null;
}

function drawDeadTree(px, py, h, dc) {
  if (!dc) dc = ctx;
  const bx   = px + (TILE >> 1) - 2;
  const by   = py + TILE - 3;
  const bark = '#484848', dark = '#282828', hi = '#626262';

  switch (h % 5) {

    case 0: { // ── Tall birch — thin trunk, sparse twigs near top ──────
      const th = 62 + (h >> 4 & 0xe);
      dc.fillStyle = dark;
      dc.fillRect(bx-2, by-3, 2, 3); dc.fillRect(bx+3, by-2, 3, 2);
      dc.fillStyle = bark;
      dc.fillRect(bx+1, by-3, 2, 3);
      dc.fillRect(bx, by-th, 3, th);
      dc.fillStyle = hi;  dc.fillRect(bx, by-th, 1, th);
      dc.fillStyle = dark; dc.fillRect(bx+2, by-th+2, 1, th-2);
      const mid = by - (th*0.5)|0;
      dc.fillStyle = bark;
      dc.fillRect(bx-5, mid,   5, 2); dc.fillRect(bx-5, mid-3, 2, 3);
      dc.fillRect(bx+3, mid+8, 5, 2); dc.fillRect(bx+6, mid+4, 2, 4);
      const top = by - th;
      dc.fillRect(bx-5, top+2, 5, 1); dc.fillRect(bx-5, top-4, 1, 6); dc.fillRect(bx-7, top-2, 2, 2);
      dc.fillRect(bx+3, top+4, 4, 1); dc.fillRect(bx+5, top-3, 1, 7); dc.fillRect(bx+6, top-1, 3, 1);
      dc.fillRect(bx+1, top-9, 1, 9); dc.fillRect(bx-1, top-5, 1, 3); dc.fillRect(bx+2, top-7, 1, 5);
      break;
    }

    case 1: { // ── Broad oak — wide horizontal wings both sides ─────────
      const th = 40 + (h >> 4 & 0x8);
      dc.fillStyle = dark;
      dc.fillRect(bx-6, by-4, 6, 4); dc.fillRect(bx+5, by-3, 5, 3);
      dc.fillStyle = bark;
      dc.fillRect(bx-4, by-3, 4, 3); dc.fillRect(bx+5, by-2, 3, 2);
      dc.fillRect(bx-1, by-th, 5, th);
      dc.fillStyle = hi;  dc.fillRect(bx-1, by-th, 1, th);
      dc.fillStyle = dark; dc.fillRect(bx+3, by-th+3, 1, th-3);
      const lb = by - (th*0.72)|0;
      dc.fillStyle = bark;
      dc.fillRect(bx-20, lb, 20, 3);
      dc.fillRect(bx-20, lb-9, 3, 9); dc.fillRect(bx-24, lb-6, 4, 2);
      dc.fillRect(bx-14, lb-11, 2, 11); dc.fillRect(bx-17, lb-8, 4, 2);
      dc.fillStyle = dark; dc.fillRect(bx-19, lb+2, 18, 1);
      const rb = by - (th*0.55)|0;
      dc.fillStyle = bark;
      dc.fillRect(bx+4, rb, 19, 3);
      dc.fillRect(bx+20, rb-9, 3, 9); dc.fillRect(bx+22, rb-6, 4, 2);
      dc.fillRect(bx+13, rb-11, 2, 11); dc.fillRect(bx+14, rb-8, 4, 2);
      dc.fillStyle = dark; dc.fillRect(bx+5, rb+2, 18, 1);
      const top = by - th;
      dc.fillStyle = bark;
      dc.fillRect(bx,   top-7, 2, 7); dc.fillRect(bx+2, top-5, 2, 5);
      dc.fillRect(bx-2, top-4, 2, 4); dc.fillRect(bx+4, top-3, 2, 3);
      break;
    }

    case 2: { // ── Gnarled — leans right, sweeping left branch ──────────
      const th = 50 + (h >> 4 & 0x8);
      dc.fillStyle = dark;
      dc.fillRect(bx-8, by-2, 8, 2); dc.fillRect(bx+5, by-3, 6, 3);
      dc.fillRect(bx-5, by-5, 3, 3);
      dc.fillStyle = bark;
      dc.fillRect(bx-6, by-1, 5, 1); dc.fillRect(bx+5, by-2, 4, 2);
      dc.fillRect(bx-4, by-4, 2, 3);
      // Trunk in 3 leaning segments
      dc.fillStyle = bark;
      dc.fillRect(bx,   by-(th*0.34)|0, 4, (th*0.34)|0);
      dc.fillRect(bx+1, by-(th*0.67)|0, 4, (th*0.33)|0);
      dc.fillRect(bx+2, by-th,          4, (th*0.33)|0);
      dc.fillStyle = hi;
      dc.fillRect(bx,   by-(th*0.34)|0, 1, (th*0.34)|0);
      dc.fillRect(bx+1, by-(th*0.67)|0, 1, (th*0.33)|0);
      dc.fillRect(bx+2, by-th,          1, (th*0.33)|0);
      dc.fillStyle = dark; dc.fillRect(bx+1, (by-th*0.4)|0, 3, 5);
      const lb = by - (th*0.72)|0;
      dc.fillStyle = bark;
      dc.fillRect(bx-18, lb+5, 19, 3);
      dc.fillRect(bx-18, lb-3, 3, 8); dc.fillRect(bx-22, lb,   5, 2);
      dc.fillRect(bx-12, lb-12, 2, 12); dc.fillRect(bx-15, lb-8, 4, 2);
      dc.fillRect(bx-9,  lb-16, 2,  6); dc.fillRect(bx-11, lb-13, 3, 2);
      dc.fillStyle = dark; dc.fillRect(bx-17, lb+7, 17, 1);
      const rs = by - (th*0.42)|0;
      dc.fillStyle = bark;
      dc.fillRect(bx+5, rs, 9, 2); dc.fillRect(bx+12, rs-5, 2, 5); dc.fillRect(bx+13, rs-3, 3, 2);
      const top = by - th;
      dc.fillRect(bx+2, top-6, 2, 6); dc.fillRect(bx+4, top-4, 2, 4);
      dc.fillRect(bx,   top-3, 2, 3); dc.fillRect(bx+5, top-7, 1, 4);
      break;
    }

    case 3: { // ── Snag — short thick trunk, lightning-struck top ───────
      const th = 24 + (h >> 4 & 0xa);
      dc.fillStyle = dark;
      dc.fillRect(bx-8, by-5, 8, 5); dc.fillRect(bx+5, by-4, 7, 4);
      dc.fillStyle = bark;
      dc.fillRect(bx-6, by-4, 6, 4); dc.fillRect(bx+5, by-3, 5, 3);
      // Wide trunk (6px)
      dc.fillRect(bx-1, by-th, 6, th);
      dc.fillStyle = hi;  dc.fillRect(bx-1, by-th, 1, th);
      dc.fillStyle = dark; dc.fillRect(bx+4, by-th+3, 1, th-3);
      // Jagged break at top
      dc.fillRect(bx,   by-th,   2, 5);
      dc.fillRect(bx+3, by-th,   2, 7);
      dc.fillRect(bx+1, by-th+3, 2, 4);
      // Splinters above break
      dc.fillStyle = bark;
      dc.fillRect(bx+2, by-th-7, 1, 7);
      dc.fillRect(bx-1, by-th-3, 1, 3);
      dc.fillRect(bx+5, by-th-5, 1, 5);
      // Left stub
      const s1 = by - (th*0.72)|0;
      dc.fillRect(bx-9, s1, 9, 3); dc.fillRect(bx-9, s1-2, 2, 2);
      dc.fillStyle = dark; dc.fillRect(bx-8, s1+2, 7, 1);
      // Right stub
      const s2 = by - (th*0.4)|0;
      dc.fillStyle = bark;
      dc.fillRect(bx+5, s2, 8, 3); dc.fillRect(bx+11, s2-2, 2, 2);
      dc.fillStyle = dark; dc.fillRect(bx+6, s2+2, 6, 1);
      break;
    }

    default: { // ── Y-Fork — trunk splits into two angled sub-trunks ────
      const forkY = by - 14;
      dc.fillStyle = dark;
      dc.fillRect(bx-3, by-3, 3, 3); dc.fillRect(bx+4, by-2, 4, 2);
      dc.fillStyle = bark;
      dc.fillRect(bx-2, by-2, 2, 2);
      // Base trunk
      dc.fillRect(bx, by-14, 4, 14);
      dc.fillStyle = hi;  dc.fillRect(bx, by-14, 1, 14);
      dc.fillStyle = dark; dc.fillRect(bx+3, by-11, 1, 11);
      // Left sub-trunk (3 segments, angling left)
      dc.fillStyle = bark;
      dc.fillRect(bx-2,  forkY-14, 3, 14);
      dc.fillRect(bx-5,  forkY-30, 3, 16);
      dc.fillRect(bx-8,  forkY-48, 2, 18);
      dc.fillStyle = hi;
      dc.fillRect(bx-2, forkY-14, 1, 14);
      dc.fillRect(bx-5, forkY-30, 1, 16);
      // Left branch
      dc.fillStyle = bark;
      dc.fillRect(bx-16, forkY-22, 11, 2);
      dc.fillRect(bx-16, forkY-27,  2,  5); dc.fillRect(bx-20, forkY-25, 4, 2);
      // Left crown
      const ltop = forkY - 48;
      dc.fillRect(bx-10, ltop-5, 2, 5); dc.fillRect(bx-8,  ltop-4, 2, 4);
      dc.fillRect(bx-12, ltop-3, 2, 3);
      // Right sub-trunk (3 segments, angling right)
      dc.fillStyle = bark;
      dc.fillRect(bx+4,  forkY-14, 3, 14);
      dc.fillRect(bx+7,  forkY-28, 3, 14);
      dc.fillRect(bx+9,  forkY-42, 2, 14);
      dc.fillStyle = hi;
      dc.fillRect(bx+4, forkY-14, 1, 14);
      dc.fillRect(bx+7, forkY-28, 1, 14);
      // Right branch
      dc.fillStyle = bark;
      dc.fillRect(bx+13, forkY-18, 9, 2);
      dc.fillRect(bx+20, forkY-23, 2,  5); dc.fillRect(bx+21, forkY-21, 3, 2);
      // Right crown
      const rtop = forkY - 42;
      dc.fillRect(bx+10, rtop-5, 2, 5); dc.fillRect(bx+12, rtop-3, 2, 3);
      dc.fillRect(bx+8,  rtop-3, 2, 3);
      break;
    }
  }
}

// ── Wasteland offscreen cache ──────────────────────────────────────────────────
// Static content (earth, trees, pond tiles) is rendered once to an offscreen canvas
// and blitted each frame. Only animated bubbles are drawn live.
let _wlCache = null, _wlCacheCam = null, _wlWaterTiles = [];

function _buildWastelandCache() {
  if (!_wlCache || _wlCache.width !== c.width || _wlCache.height !== c.height) {
    _wlCache = document.createElement('canvas');
    _wlCache.width  = c.width;
    _wlCache.height = c.height;
  }
  _wlCacheCam  = { wx: cam.wx, wy: cam.wy, zoom: cam.zoom };
  _wlWaterTiles = [];

  const oc = _wlCache.getContext('2d');
  oc.clearRect(0, 0, _wlCache.width, _wlCache.height);
  oc.setTransform(
    cam.zoom * _gameScale * DPR, 0, 0, cam.zoom * _gameScale * DPR,
    (_gameOx - cam.wx * cam.zoom * _gameScale) * DPR,
    (_gameOy - cam.wy * cam.zoom * _gameScale) * DPR
  );

  const viewW = DW / cam.zoom, viewH = CH / cam.zoom;
  const x0 = Math.floor(cam.wx / TILE) - 1;
  const y0 = Math.floor(cam.wy / TILE) - 1;
  const x1 = Math.ceil((cam.wx + viewW) / TILE) + 1;
  const y1 = Math.ceil((cam.wy + viewH) / TILE) + 1;
  const DX0 = -3, DX1 = GRID + 2, DY0 = -3, DY1 = GRID + 2;
  const BASES  = ['#1e1208','#231508','#261a0a','#201005'];
  const LIGHTS = ['#3a220e','#362010','#3e2812','#2e1c09'];
  const DARK   = '#130c04';
  const ROCK   = '#1a1006';
  const ROCKHI = '#261608';

  oc.lineWidth = 1;

  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const px = gx * TILE, py = gy * TILE;
      const h  = wh(gx, gy);
      const rv = pondAt(gx, gy);
      const nearDungeon = gx >= DX0 && gx <= DX1 && gy >= DY0 && gy <= DY1;

      if (rv === 'water') {
        if (h % 3 === 0) _wlWaterTiles.push({ gx, gy, h });  // 1/3 eligible for bubbles
        oc.fillStyle = '#090f05';
        oc.fillRect(px, py, TILE, TILE);
        oc.fillStyle = '#0c1507';
        oc.fillRect(px+2, py+2, TILE-4, TILE-4);
        if (h % 5 === 0) {
          oc.fillStyle = '#121c08';
          oc.fillRect(px + (h >> 5 & 0x18), py + (h >> 9 & 0x18), 9, 6);
        }
        oc.fillStyle = '#141a07';
        oc.fillRect(px, py,        TILE, 2);
        oc.fillRect(px, py+TILE-2, TILE, 2);
        oc.fillRect(px, py+2,         2, TILE-4);
        oc.fillRect(px+TILE-2, py+2,  2, TILE-4);
        continue;
      }

      if (rv === 'bank') {
        oc.fillStyle = '#191408';
        oc.fillRect(px, py, TILE, TILE);
        oc.fillStyle = '#201a0a';
        oc.fillRect(px+1, py+1, TILE-2, TILE-2);
        oc.fillStyle = '#282010';
        oc.fillRect(px+2, py+2, TILE-4, 2);
        oc.fillRect(px+2, py+TILE-4, TILE-4, 2);
        continue;
      }

      oc.fillStyle = BASES[h % 4];
      oc.fillRect(px, py, TILE, TILE);
      if ((h >> 2 & 3) === 0) {
        oc.fillStyle = LIGHTS[(h >> 4) % 4];
        oc.fillRect(px + (h >> 13 & 0x1f), py + (h >> 18 & 0x1f),
                    10 + (h >> 6 & 0xf),   6  + (h >> 10 & 0x7));
      }
      if ((h >> 3 & 3) === 0) {
        oc.strokeStyle = DARK;
        const crx = px + 4 + (h >> 7 & 0x1c), cry = py + 4 + (h >> 12 & 0x1c);
        const clen = 8 + (h >> 17 & 0x7), flip = h >> 5 & 1;
        oc.beginPath(); oc.moveTo(crx, cry); oc.lineTo(crx + clen, cry + (flip ? 3 : -2)); oc.stroke();
        oc.beginPath(); oc.moveTo(crx + (clen >> 1), cry + (flip ? 1 : -1));
        oc.lineTo(crx + (clen >> 1) + 4, cry + (flip ? 7 : -6)); oc.stroke();
      }
      if ((h >> 1 & 7) === 0) {
        const rx = px + (h >> 9 & 0x1e), ry = py + (h >> 14 & 0x1e);
        const rw = 5 + (h >> 19 & 3),    rh = 3 + (h >> 21 & 2);
        oc.fillStyle = ROCK; oc.fillRect(rx, ry, rw, rh);
        oc.fillStyle = ROCKHI; oc.fillRect(rx+1, ry, rw-2, 1);
      }
      if ((h >> 4 & 5) === 0) {
        oc.fillStyle = ROCK;
        oc.fillRect(px + (h >> 8  & 0x1f), py + (h >> 13 & 0x1f), 2, 2);
        oc.fillRect(px + (h >> 16 & 0x1f), py + (h >> 21 & 0x1f), 2, 1);
      }
      if (h % 11 === 0) {
        const tx = px + (h >> 6 & 0x1e), ty = py + (h >> 11 & 0x1e);
        oc.fillStyle = '#2e1e08';
        oc.fillRect(tx,   ty+4, 1, 5); oc.fillRect(tx+2, ty+2, 1, 7); oc.fillRect(tx+4, ty+5, 1, 4);
        oc.fillStyle = '#3a2810';
        oc.fillRect(tx,   ty+3, 1, 1); oc.fillRect(tx+2, ty+1, 1, 1); oc.fillRect(tx+4, ty+4, 1, 1);
      }
      if (h % 44 === 0 && !nearDungeon) {
        drawDeadTree(px, py, h, oc);
      }
    }
  }
}

function drawWasteland() {
  const now = gNow();

  // Rebuild static cache when camera moves more than half a tile or zoom changes
  const needRebuild = !_wlCache
    || _wlCache.width  !== c.width
    || _wlCache.height !== c.height
    || cam.zoom        !== _wlCacheCam.zoom
    || Math.abs(cam.wx - _wlCacheCam.wx) > TILE / 2
    || Math.abs(cam.wy - _wlCacheCam.wy) > TILE / 2;

  if (needRebuild) _buildWastelandCache();

  // Blit static wasteland — reset to identity so we draw straight to screen coords
  const dx = (_wlCacheCam.wx - cam.wx) * cam.zoom * _gameScale * DPR;
  const dy = (_wlCacheCam.wy - cam.wy) * cam.zoom * _gameScale * DPR;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(_wlCache, dx, dy);
  ctx.restore();

  // Animated bubbles only — bigger circles, ~1/3 of water tiles, shorter visible window
  for (const { gx, gy, h } of _wlWaterTiles) {
    const bubPhase = (now * 0.00035 + (h & 0xff) * 0.04) % 1;
    if (bubPhase >= 0.04) continue;
    const px = gx * TILE, py = gy * TILE;
    const bx = px + (h >> 7 & 0x1c) + 4;
    const by = py + (h >> 11 & 0x1c) + 4;
    ctx.fillStyle = '#1e2e0e';
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c1507';
    ctx.beginPath();
    ctx.arc(bx + 1, by - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDungeon() {
  const now = gNow();
  for (let gy=0; gy<GRID; gy++) {
    for (let gx=0; gx<GRID; gx++) {
      const px=gx*TILE, py=gy*TILE, t=grid[gy][gx];
      drawDungeonTile(px, py, t, gx, gy, now, gx, gy);
    }
  }
  // Dungeon entrance gate
  const ex = 7*TILE;
  const gateX = ex, gateW = TILE, gateY = 0, gateH = TILE;

  // Gate arch opening (dark void)
  ctx.fillStyle = '#0a0010';
  ctx.fillRect(gateX + 5, gateY, gateW - 10, gateH);

  // Portcullis bars (vertical iron bars)
  const barCount = 5;
  const barW = 2;
  const innerW = gateW - 10;
  const spacing = (innerW - barCount * barW) / (barCount + 1);
  ctx.fillStyle = '#666688';
  for (let i = 0; i < barCount; i++) {
    const bx = gateX + 5 + Math.round(spacing * (i + 1) + barW * i);
    ctx.fillRect(bx, gateY, barW, gateH);
  }
  // Portcullis horizontal cross-bar
  ctx.fillStyle = '#666688';
  ctx.fillRect(gateX + 5, gateY + Math.round(gateH * 0.55), innerW, 2);

  // Stone pillars (left and right edges)
  ctx.fillStyle = '#4a4a5a';
  ctx.fillRect(gateX, gateY, 5, gateH);
  ctx.fillRect(gateX + gateW - 5, gateY, 5, gateH);
  // Pillar stone brick lines
  ctx.fillStyle = '#3a3a48';
  for (let row = 0; row < 4; row++) {
    const ly = gateY + row * 10 + 5;
    ctx.fillRect(gateX, ly, 5, 1);
    ctx.fillRect(gateX + gateW - 5, ly, 5, 1);
  }
  // Pillar highlights
  ctx.fillStyle = '#5a5a6e';
  ctx.fillRect(gateX, gateY, 1, gateH);
  ctx.fillRect(gateX + gateW - 1, gateY, 1, gateH);

  // Top arch lintel
  ctx.fillStyle = '#4a4a5a';
  ctx.fillRect(gateX, gateY, gateW, 5);
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(gateX, gateY + 4, gateW, 1);
  ctx.fillStyle = '#5a5a6e';
  ctx.fillRect(gateX, gateY, gateW, 1);

  // Animated torches on each side
  function drawTorch(tx, ty) {
    const flicker1 = Math.sin(now * 0.007 + tx) * 0.5 + 0.5;
    const flicker2 = Math.sin(now * 0.011 + tx * 0.3) * 0.5 + 0.5;
    const flicker3 = Math.sin(now * 0.0053 + tx * 0.7) * 0.5 + 0.5;

    // Torch handle
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(tx - 1, ty + 3, 3, 7);

    // Torch bracket
    ctx.fillStyle = '#555566';
    ctx.fillRect(tx - 2, ty + 2, 5, 3);

    // Outer glow
    const glowR = 6 + flicker1 * 3;
    const grd = ctx.createRadialGradient(tx + 0.5, ty - 2, 0, tx + 0.5, ty - 2, glowR);
    grd.addColorStop(0, 'rgba(255,200,60,0.35)');
    grd.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(tx + 0.5, ty - 2, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Flame core (orange)
    const fh = 5 + flicker2 * 2;
    const fw = 3 + flicker3 * 1;
    ctx.fillStyle = `rgba(255,${Math.round(100 + flicker1 * 80)},0,0.95)`;
    ctx.beginPath();
    ctx.ellipse(tx + 0.5, ty - 1 - fh * 0.3, fw * 0.5, fh * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flame tip (yellow-white)
    ctx.fillStyle = `rgba(255,${Math.round(220 + flicker2 * 35)},${Math.round(60 + flicker3 * 80)},0.9)`;
    ctx.beginPath();
    ctx.ellipse(tx + 0.5, ty - 2 - fh * 0.5, fw * 0.3, fh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Left torch (outside left pillar)
  drawTorch(gateX - 6, gateY + 14);
  // Right torch (outside right pillar)
  drawTorch(gateX + gateW + 5, gateY + 14);
}



function spr(sp, col, ox, oy) {
  for (let py=0; py<sp.length; py++)
    for (let px=0; px<sp[py].length; px++) {
      const v = sp[py][px];
      if (v && col[v]) { ctx.fillStyle=col[v]; ctx.fillRect(ox+px*S, oy+py*S, S, S); }
    }
}

function sprS(sp, col, ox, oy, sc) {
  for (let py=0; py<sp.length; py++)
    for (let px=0; px<sp[py].length; px++) {
      const v = sp[py][px];
      if (v && col[v]) { ctx.fillStyle=col[v]; ctx.fillRect(ox+px*sc, oy+py*sc, sc, sc); }
    }
}

function drawGhost(mx, my, allowed, color) {
  if (mx >= DW) return;
  const wmx = mx/cam.zoom + cam.wx, wmy = my/cam.zoom + cam.wy;
  const res = resolveWorldTile(wmx, wmy);
  if (!res || res.grid[res.lgy][res.lgx] !== allowed) return;
  ctx.fillStyle=color+'22'; ctx.fillRect(res.worldPX,res.worldPY,TILE,TILE);
  ctx.strokeStyle=color+'aa'; ctx.lineWidth=2/cam.zoom; ctx.strokeRect(res.worldPX,res.worldPY,TILE,TILE);
}

function drawEmberboltGhost() {
  if (mouse.x >= DW) return;
  const wmx = mouse.x/cam.zoom + cam.wx, wmy = mouse.y/cam.zoom + cam.wy;
  const res = resolveWorldTile(wmx, wmy);
  if (!res || res.grid[res.lgy][res.lgx] !== T_FLOOR) return;
  const { worldPX: px, worldPY: py } = res;
  const cx = px + TILE/2, cy = py + TILE/2;
  ctx.fillStyle = '#cc330022'; ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = '#ff8833aa'; ctx.lineWidth = 2/cam.zoom; ctx.strokeRect(px, py, TILE, TILE);
  ctx.save();
  ctx.translate(cx, cy);
  const nRot = { right:0, left:Math.PI, up:-Math.PI/2, down:Math.PI/2 };
  ctx.rotate(nRot[emberboltDir] || 0);
  ctx.fillStyle = '#ff883399';
  ctx.fillRect(0, -3/cam.zoom, 14/cam.zoom, 6/cam.zoom);
  ctx.beginPath();
  ctx.moveTo(12/cam.zoom, -7/cam.zoom);
  ctx.lineTo(20/cam.zoom, 0);
  ctx.lineTo(12/cam.zoom, 7/cam.zoom);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ff8833cc';
  ctx.font = `${7/cam.zoom}px "Press Start 2P"`;
  ctx.textAlign = 'center';
  ctx.fillText(emberboltDir.toUpperCase(), cx, py + TILE + 10/cam.zoom);
  ctx.fillText('WASD:rotate', cx, py + TILE + 20/cam.zoom);
  ctx.textAlign = 'left';
}

function drawSpiderGhost() {
  if (mouse.x >= DW) return;
  const wmx = mouse.x/cam.zoom + cam.wx, wmy = mouse.y/cam.zoom + cam.wy;
  const res = resolveWorldTile(wmx, wmy);
  if (!res) return;
  const { grid: tgrid, lgx, lgy, worldPX, worldPY } = res;
  const valid = [[lgx,lgy],[lgx+1,lgy],[lgx,lgy+1],[lgx+1,lgy+1]]
    .every(([x,y]) => tgrid[y] && tgrid[y][x] === T_FLOOR);
  const col = valid ? '#33aa22' : '#aa2222';
  ctx.fillStyle = col+'22'; ctx.fillRect(worldPX, worldPY, TILE*2, TILE*2);
  ctx.strokeStyle = col+'aa'; ctx.lineWidth = 2/cam.zoom;
  ctx.strokeRect(worldPX, worldPY, TILE*2, TILE*2);
}


function drawHeart() {
  const now=gNow(), hp=heart.hp/heart.maxHp;
  const col = hp>0.5 ? '#ff3388' : (hp>0.25 ? '#ff6622' : '#ff1111');
  ctx.shadowBlur=10+7*Math.sin(now*0.004); ctx.shadowColor=col;
  spr(HSPR, {1:col,2:'#ffaad4'}, heart.x, heart.y);
  ctx.shadowBlur=0;
  ctx.fillStyle='#070710'; ctx.fillRect(heart.x-1,heart.y-11,38,7);
  ctx.fillStyle='#111';    ctx.fillRect(heart.x,heart.y-10,36,5);
  if (hp > 0) {
    const hW = Math.max(1, Math.round(36*hp));
    ctx.fillStyle=col; ctx.fillRect(heart.x,heart.y-10,hW,5);
    ctx.globalAlpha=0.45; ctx.fillStyle='#fff'; ctx.fillRect(heart.x,heart.y-10,hW,1);
    ctx.globalAlpha=1;
  }
}

function drawPlayer() {
  if (player.iframes > 0 && Math.floor(player.iframes*12)%2===0) return;
  if (franticCharge) {
    ctx.strokeStyle = '#ff880044';
    ctx.lineWidth   = 2;
    ctx.strokeRect(player.x - 2, player.y - 2, 36, 36);
  }
  if (quickFeetTimer > 0) {
    const t     = gNow() / 1000;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 15));
    const px = player.x, py = player.y;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffee44';
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#aa44ff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(px - 2, py - 2, 36, 36);
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.55 * pulse;
    const lines = [
      [px - 4, py + 6,  px - 10, py + 6 ],
      [px - 4, py + 14, px - 8,  py + 14],
      [px - 4, py + 22, px - 12, py + 22],
      [px + 36, py + 10, px + 42, py + 10],
      [px + 36, py + 20, px + 40, py + 20],
    ];
    for (const [x1,y1,x2,y2] of lines) {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle='#00000055'; ctx.fillRect(player.x+3, player.y+30, 26, 4);
  spr(player.sprite || PSPR, player.sprColors || PCOL, player.x, player.y);
  const hp = player.hp / player.maxHp;
  const hpCol = hp>0.5 ? '#33ee33' : (hp>0.25 ? '#ffaa00' : '#ff2222');
  const hpHiCol = hp>0.5 ? '#88ff88' : (hp>0.25 ? '#ffdd88' : '#ff7777');
  // HP bar border
  ctx.fillStyle = '#070710';
  ctx.fillRect(player.x-1, player.y-9, 34, 7);
  // HP bar bg
  ctx.fillStyle = '#111';
  ctx.fillRect(player.x, player.y-8, 32, 5);
  // HP bar fill + highlight
  if (hp > 0) {
    const hpW = Math.max(1, Math.round(32*hp));
    ctx.fillStyle = hpCol;
    ctx.fillRect(player.x, player.y-8, hpW, 5);
    ctx.fillStyle = hpHiCol;
    ctx.fillRect(player.x, player.y-8, hpW, 1);
  }
  if (player.atkCd > player.atkCdMax*0.6) {
    ctx.strokeStyle='#44cc4433'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(player.x+16, player.y+16, player.atkRange, 0, Math.PI*2); ctx.stroke();
  }
}

function drawAdventurer(a) {
  const bob = Math.abs(Math.sin(a.bobPhase)) * 2.5;
  const dx  = Math.round(a.x), dy = Math.round(a.y - bob);
  ctx.fillStyle='#00000055'; ctx.fillRect(dx+3, a.y+28, 26, Math.max(2, 5-bob));
  const cs = CSPR[a.cls];
  spr(cs.s, a.flash > 0 ? AHIT : cs.c, dx, dy);
  // HP bar (rank-coloured)
  const hp = a.hp / a.maxHp;
  ctx.fillStyle = '#070710';
  ctx.fillRect(dx-1, dy-9, 34, 7);
  ctx.fillStyle = '#111';
  ctx.fillRect(dx, dy-8, 32, 5);
  if (hp > 0) {
    const aHpW = Math.max(1, Math.round(32*hp));
    const aCol = RCOL[a.rank] || '#aaa';
    ctx.fillStyle = aCol;
    ctx.fillRect(dx, dy-8, aHpW, 5);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx, dy-8, aHpW, 1);
    ctx.globalAlpha = 1;
  }
  // Rank badge + class tag
  ctx.fillStyle=RCOL[a.rank]||'#aaa'; ctx.fillRect(dx,dy-16,14,8);
  ctx.fillStyle='#111'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(a.rank, dx+7, dy-9);
  ctx.fillStyle='#334'; ctx.fillRect(dx+15,dy-16,18,8);
  ctx.fillStyle='#ccc'; ctx.fillText(a.cls.slice(0,3).toUpperCase(), dx+24, dy-9);
  ctx.textAlign='left';
  // Warrior charge indicator
  if (a.burst) { ctx.strokeStyle='#ff880044'; ctx.lineWidth=2; ctx.strokeRect(dx-2,dy-2,36,36); }
  // Rogue speed burst indicator
  if (a.cls === 'rogue' && !a.dashPhase) {
    const t     = gNow() / 1000;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 15));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffee44';
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#aa44ff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(dx - 2, dy - 2, 36, 36);
    // Speed streak lines on both sides
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.55 * pulse;
    const lines = [
      [dx - 4, dy + 6,  dx - 10, dy + 6 ],
      [dx - 4, dy + 14, dx - 8,  dy + 14],
      [dx - 4, dy + 22, dx - 12, dy + 22],
      [dx + 36, dy + 10, dx + 42, dy + 10],
      [dx + 36, dy + 20, dx + 40, dy + 20],
    ];
    for (const [x1,y1,x2,y2] of lines) {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    ctx.restore();
  }
  // Web slow indicator
  if (a.webSlowTimer > 0) {
    ctx.strokeStyle = '#aaaaaa88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(dx+16, dy+16, 18, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#aaaaaa55';
    ctx.fillRect(dx+3, dy+3, 26, 26);
  }
  // Cleric healing circle
  if (a.isHealing) {
    const cx = dx+16, cy = dy+16, R = 26;
    const t   = gNow() / 1000;
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    const rot   = t * 1.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#00cc44';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00ff66';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rot + (i / 3) * Math.PI * 2;
      const tx = cx + Math.cos(angle) * R;
      const ty = cy + Math.sin(angle) * R;
      if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle  = '#00ee55';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawSnatchAnims() {
  const REACH = 85;
  for (const s of slashAnims) {
    const progress = 1 - (s.life / s.maxLife);
    // Extend 0–0.38, hold 0.38–0.62, retract 0.62–1.0
    let extFrac;
    if (progress < 0.38)      extFrac = progress / 0.38;
    else if (progress < 0.62) extFrac = 1;
    else                      extFrac = 1 - (progress - 0.62) / 0.38;
    const alpha = progress < 0.78 ? 1 : 1 - (progress - 0.78) / 0.22;
    const len   = REACH * extFrac;
    const col   = '#55dd44';
    const glow  = '#22aa11';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(player.x + 16, player.y + 16);
    ctx.rotate(s.angle);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = glow;

    // Arm stub — tapered green forearm
    if (len > 14) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(2, -3.5);
      ctx.lineTo(len - 16, -2.5);
      ctx.lineTo(len - 16,  2.5);
      ctx.lineTo(2,  3.5);
      ctx.closePath();
      ctx.fill();
    }

    // Goblin hand: palm + 3 clawed fingers, fades in as arm extends
    if (extFrac > 0.2) {
      const handT  = Math.min(1, (extFrac - 0.2) / 0.3);
      ctx.globalAlpha = alpha * handT;

      // Palm blob
      const palmX = len - 11;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(palmX, 0, 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3 goblin fingers from knuckle edge, spread in a fan
      const kx = palmX + 7;
      const fingers = [
        { by: -5,  a: -0.22, fl: 11 },  // index
        { by:  0,  a:  0.0,  fl: 13 },  // middle (longest)
        { by:  5,  a:  0.22, fl: 10 },  // ring
      ];
      ctx.strokeStyle = col;
      for (const f of fingers) {
        const ex = kx + Math.cos(f.a) * f.fl;
        const ey = f.by + Math.sin(f.a) * f.fl;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        ctx.moveTo(kx, f.by);
        ctx.quadraticCurveTo(kx + f.fl * 0.5, f.by + Math.sin(f.a) * f.fl * 0.35, ex, ey);
        ctx.stroke();
        // Claw tip — sharp nub, glows gold on hit
        ctx.fillStyle   = s.hit ? '#ccff88' : '#aaffaa';
        ctx.shadowColor = s.hit ? '#ffcc00' : '#44aa44';
        ctx.shadowBlur  = s.hit ? 12 : 5;
        ctx.beginPath();
        ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle   = col;
        ctx.shadowColor = glow;
        ctx.shadowBlur  = 8;
      }

      ctx.globalAlpha = alpha;
    }

    // Gold coin burst at full reach on hit
    if (s.hit && extFrac >= 0.9) {
      ctx.shadowBlur  = 18;
      ctx.shadowColor = '#ffaa00';
      ctx.fillStyle   = '#ffd700';
      ctx.beginPath();
      ctx.arc(len, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle  = '#ffff88';
      ctx.shadowBlur = 0;
      ctx.font = '5px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('$', len, 2);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }
}

function drawFlurryAnims() {
  const REACH     = 45;
  const CONE_HALF = Math.PI * 50 / 180;

  for (const f of flurryAnims) {
    const progress = 1 - f.life / f.maxLife;
    const t = 1 - Math.pow(1 - Math.min(progress / 0.85, 1), 2);
    const swipeAngle = -CONE_HALF + t * CONE_HALF * 2;
    const alpha = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    const col  = f.hit ? '#ccff22' : '#99ee22';
    const glow = f.hit ? '#aaff00' : '#66cc00';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(player.x + 16, player.y + 16);
    ctx.rotate(f.angle);

    // Trail sector — swept area so far
    ctx.fillStyle = f.hit ? 'rgba(170,255,34,0.13)' : 'rgba(110,220,10,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, REACH, -CONE_HALF, swipeAngle);
    ctx.closePath();
    ctx.fill();

    // Trail arc edge
    ctx.strokeStyle = f.hit ? '#88ff22' : '#55bb00';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 4;
    ctx.shadowColor = glow;
    ctx.globalAlpha = alpha * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, REACH, -CONE_HALF, swipeAngle);
    ctx.stroke();
    ctx.globalAlpha = alpha;

    // Motion blur trail line slightly behind the hand
    const trailOff   = CONE_HALF * 0.28;
    const trailAngle = swipeAngle - trailOff;
    if (trailAngle > -CONE_HALF) {
      const tx2 = Math.cos(trailAngle) * REACH * 0.92;
      const ty2 = Math.sin(trailAngle) * REACH * 0.92;
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 7;
      ctx.shadowColor = glow;
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // ── Goblin hand at the leading edge of the swipe ──────────────
    const bx = Math.cos(swipeAngle) * REACH;
    const by = Math.sin(swipeAngle) * REACH;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(swipeAngle);   // fingers point radially outward from player
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur  = 10;
    ctx.shadowColor = glow;

    // Small palm
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3 short clawed fingers fanning outward (+X = radially outward)
    const kx = 5;
    const sfingers = [
      { by: -4, a: -0.22, fl: 8 },  // index
      { by:  0, a:  0.0,  fl: 9 },  // middle
      { by:  4, a:  0.22, fl: 7 },  // ring
    ];
    ctx.strokeStyle = col;
    for (const sf of sfingers) {
      const ex = kx + Math.cos(sf.a) * sf.fl;
      const ey = sf.by + Math.sin(sf.a) * sf.fl;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(kx, sf.by);
      ctx.quadraticCurveTo(kx + sf.fl * 0.5, sf.by + Math.sin(sf.a) * sf.fl * 0.3, ex, ey);
      ctx.stroke();
      // Claw tip
      ctx.fillStyle   = f.hit ? '#ffff88' : col;
      ctx.shadowColor = f.hit ? '#ffaa00' : glow;
      ctx.shadowBlur  = f.hit ? 14 : 6;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle   = col;
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 10;
    }

    ctx.restore(); // end hand transform

    // Impact sparks at end of swing when hit
    if (f.hit && progress > 0.72) {
      const sparkA = (progress - 0.72) / 0.28;
      ctx.globalAlpha = alpha * sparkA;
      ctx.fillStyle   = '#ffff55';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 18;
      for (const [sx, sy] of f.sparks) {
        ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore(); // end player transform
  }
}

function drawCircleAnims() {
  for (const c of circleAnims) {
    const progress  = 1 - c.life / c.maxLife;       // 0 → 1
    const sweepFrac = Math.min(1, progress / 0.55);  // arc sweeps 0→2π in first 55% of duration
    const alpha     = progress > 0.55 ? 1 - (progress - 0.55) / 0.45 : 1;

    ctx.save();
    ctx.globalAlpha  = alpha * (c.hit ? 1.0 : 0.6);
    ctx.strokeStyle  = c.color;
    ctx.lineWidth    = 2.5;
    ctx.shadowBlur   = 10;
    ctx.shadowColor  = c.color;
    const cx = player.x+16, cy = player.y+16;
    ctx.beginPath();
    ctx.arc(cx, cy, c.r, -Math.PI / 2, -Math.PI / 2 + sweepFrac * Math.PI * 2);
    ctx.stroke();
    // Bright leading-edge dot at the tip of the sweep
    if (sweepFrac < 1) {
      const tipAngle = -Math.PI / 2 + sweepFrac * Math.PI * 2;
      ctx.fillStyle   = '#ffffff';
      ctx.shadowBlur  = 14;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(tipAngle) * c.r, cy + Math.sin(tipAngle) * c.r, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = t * t;
    if (p.type === 'spark') {
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const trailLen = p.size * 2.5 * t;
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = Math.max(0.5, p.size * 0.35 * t);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / speed) * trailLen, p.y - (p.vy / speed) * trailLen);
      ctx.stroke();
    } else {
      const r = Math.max(0.5, p.size * 0.5 * (0.4 + 0.6 * t));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawProjectiles() {
  for (const p of projectiles) {
    if (p.owner === 'minion_web') {
      // Grey sticky blob
      ctx.fillStyle = '#999988';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#bbbbaa';
      ctx.beginPath(); ctx.arc(p.x-2, p.y-2, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#666655';
      ctx.beginPath(); ctx.arc(p.x+2, p.y+2, 1.5, 0, Math.PI*2); ctx.fill();
      continue;
    }
    if (p.owner === 'player_slimeBall') {
      ctx.save();
      ctx.shadowBlur = 8; ctx.shadowColor = '#22ddaa';
      ctx.fillStyle = '#22ddaa';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#aaffee';
      ctx.beginPath(); ctx.arc(p.x-2, p.y-2, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (p.owner === 'player_acidPuddle') {
      ctx.save();
      ctx.shadowBlur = 6; ctx.shadowColor = '#22cc44';
      ctx.fillStyle = '#22cc44';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#88ff88';
      ctx.beginPath(); ctx.arc(p.x-1.5, p.y-1.5, 2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (p.owner === 'player_firebolt') {
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff4400';
      ctx.fillStyle = '#ff2200';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffcc22';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (p.owner === 'minion_goblinArrow') {
      const angle = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(angle);
      ctx.fillStyle = '#553311'; ctx.fillRect(-8, -1, 11, 2);
      ctx.fillStyle = '#88ee44';
      ctx.beginPath(); ctx.moveTo(3, -3); ctx.lineTo(9, 0); ctx.lineTo(3, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#44aa22'; ctx.fillRect(-8, -2, 3, 1); ctx.fillRect(-8, 1, 3, 1);
      ctx.restore();
      continue;
    }
    if (p.owner === 'minion_goblinFirebolt') {
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#9922ff';
      ctx.fillStyle = '#7722cc';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#dd88ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (p.owner === 'trap_emberbolt') {
      const angle = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#ff4400';
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#551100'; ctx.fillRect(-10, -2, 14, 4);
      ctx.fillStyle = '#ff6622';
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(13, 0); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffcc22';
      ctx.beginPath(); ctx.arc(-10, 0, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.arc(-10, 0, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      continue;
    }
    const angle = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#999999';
    ctx.fillRect(-7, -1, 10, 2);
    ctx.fillStyle = '#dddddd';
    ctx.beginPath();
    ctx.moveTo(3, -3); ctx.lineTo(8, 0); ctx.lineTo(3, 3);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#777777';
    ctx.fillRect(-7, -3, 3, 2);
    ctx.fillRect(-7,  1, 3, 2);
    ctx.restore();
  }
}

function drawWaveWarning() {
  if (gameState !== 'build') return;
  // Heart-carried banner
  if (heartCarried) {
    const pulse = 0.7 + 0.3*Math.abs(Math.sin(Date.now()*0.005));
    ctx.fillStyle = `rgba(255,60,120,${pulse*0.18})`;
    ctx.fillRect(0, 0, DW, CH);
    ctx.fillStyle = `rgba(255,60,120,${pulse})`;
    ctx.font = '9px "Press Start 2P"'; ctx.textAlign = 'center';
    ctx.fillText('♥ HEART UNPLACED — Timers frozen  Click floor to place ♥', DW/2, 18);
    ctx.textAlign = 'left';
    return;
  }
  if (!heart || waveTimer > 15) return;
  const pulse = 0.15 + 0.12*Math.abs(Math.sin(Date.now()*0.006));
  ctx.strokeStyle=`rgba(255,50,50,${pulse})`; ctx.lineWidth=5;
  ctx.strokeRect(2,2,DW-4,CH-4);
}

function drawPauseBtn() {
  if (gameState==='gameover') return;
  const hov = inR(mouse.x,mouse.y, PBX,PBY, PBW,PBH);
  ctx.fillStyle   = paused ? '#2a1a44' : (hov ? '#221535' : '#160f28');
  ctx.fillRect(PBX,PBY,PBW,PBH);
  ctx.strokeStyle = paused ? '#c084fc' : '#5b21b6'; ctx.lineWidth=1.5;
  ctx.strokeRect(PBX,PBY,PBW,PBH);
  ctx.fillStyle   = paused ? '#c084fc' : '#7c5aaa';
  ctx.font='9px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(paused ? '\u25ba' : '\u2016', PBX+PBW/2, PBY+16);
  ctx.textAlign='left';
}

function drawPauseOverlay() {
  ctx.fillStyle='#00000077'; ctx.fillRect(0,0,DW,CH);
  const pw=300,ph=110,px=DW/2-pw/2,py=CH/2-ph/2;
  ctx.fillStyle='#1a0f2ecc'; ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle='#7c3aed'; ctx.lineWidth=2; ctx.strokeRect(px,py,pw,ph);
  ctx.fillStyle='#c084fc'; ctx.font='20px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('PAUSED', DW/2, CH/2-8);
  ctx.fillStyle='#665580'; ctx.font='6px "Press Start 2P"';
  ctx.fillText('Press P or click \u25ba to resume', DW/2, CH/2+18);
  ctx.textAlign='left';
}

// ── UI panel ──────────────────────────────────────────────────
function drawUI() {
  const ux = DW;
  // Panel background
  ctx.fillStyle='#0a0716'; ctx.fillRect(ux,0,UW,CH);
  // Header gradient
  const hdrGrd = ctx.createLinearGradient(ux, 0, ux, 54);
  hdrGrd.addColorStop(0, '#1a0a2e');
  hdrGrd.addColorStop(1, '#0a0716');
  ctx.fillStyle = hdrGrd;
  ctx.fillRect(ux, 0, UW, 54);
  // Panel border + inner border
  ctx.strokeStyle='#4a2a66'; ctx.lineWidth=2; ctx.strokeRect(ux,0,UW,CH);
  ctx.strokeStyle='#22103a'; ctx.lineWidth=1; ctx.strokeRect(ux+3,3,UW-6,CH-6);

  ctx.font='11px "Press Start 2P"'; ctx.textAlign='center';
  ctx.save();
  ctx.shadowBlur = 12; ctx.shadowColor = '#cc88ff';
  ctx.fillStyle='#cc88ff'; ctx.fillText('DUNGEON', ux+UW/2, 26);
  ctx.shadowBlur = 8; ctx.shadowColor = '#7c3aed';
  ctx.fillStyle='#9955ee'; ctx.fillText('LORD',    ux+UW/2, 42);
  ctx.restore();
  ctx.textAlign='left';
  hr(ux+10, 50);

  // Resources
  ctx.fillStyle='#ffd700'; ctx.font='8px "Press Start 2P"'; ctx.fillText('\u25c6 '+coins, ux+12, 66);
  ctx.fillStyle='#444';    ctx.font='5px "Press Start 2P"'; ctx.fillText('COINS', ux+12, 75);
  const foodDisCol = starving ? '#ff4444' : '#88ff44';
  ctx.fillStyle=foodDisCol; ctx.font='8px "Press Start 2P"'; ctx.fillText('\u2665 '+food,  ux+UW/2+4, 66);
  const minionUpkeepHUD = placedMinions.reduce((s, m) => s + m.level * MINION_TYPES[m.type].foodPerLevel, 0);
  const hungerRate = 5 * player.level + minionUpkeepHUD;
  const farmerIncome = placedMinions.reduce((s, m) => m.type === 'goblinFarmer' && m.alive ? s + MINION_TYPES.goblinFarmer.foodGenAtLevel(m.level) : s, 0);
  const netRate = farmerIncome - hungerRate;
  const hungerLbl = starving ? '#ff6644' : (netRate >= 0 ? '#55dd88' : '#667744');
  ctx.fillStyle=hungerLbl; ctx.font='5px "Press Start 2P"';
  const netLbl = netRate >= 0 ? '\u25b2 +'+netRate+'/min' : '\u25bc '+netRate+'/min';
  ctx.fillText(netLbl, ux+UW/2+4, 75);
  hr(ux+10, 82);

  // Wave + rank badge
  ctx.fillStyle='#ff8844'; ctx.font='8px "Press Start 2P"'; ctx.fillText('WAVE '+wave, ux+12, 96);
  ctx.fillStyle='#aaddff'; ctx.font='7px "Press Start 2P"'; ctx.fillText('LV '+player.level, ux+92, 96);
  const rname=RANKS[dungeonRank], rcol=RCOL[rname];
  ctx.fillStyle=rcol; ctx.fillRect(ux+UW-72,86,62,16);
  ctx.fillStyle='#111'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(rname+' RANK', ux+UW-41, 97); ctx.textAlign='left';
  // XP bar
  const xpBarW = UW - 84;
  ctx.fillStyle='#111';    ctx.fillRect(ux+12, 101, xpBarW, 5);
  ctx.fillStyle='#4488ff'; ctx.fillRect(ux+12, 101, xpBarW * (player.xp / player.xpNext), 5);
  ctx.strokeStyle='#223355'; ctx.lineWidth=1; ctx.strokeRect(ux+12, 101, xpBarW, 5);
  hr(ux+10, 108);

  // Souls + upgrade button
  ctx.fillStyle='#bbaaaa'; ctx.font='7px "Press Start 2P"'; ctx.fillText('◆ F-Infamy: '+fInfamy+'/100', ux+12, 122);
  if (dungeonRank === 0) {
    ctx.fillStyle='#111';    ctx.fillRect(ux+12, 126, UW-24, 6);
    ctx.fillStyle='#cc44ff'; ctx.fillRect(ux+12, 126, (UW-24) * Math.min(1, fInfamy/INFAMY_CAP), 6);
    ctx.strokeStyle='#443355'; ctx.lineWidth=1; ctx.strokeRect(ux+12, 126, UW-24, 6);
  } else {
    ctx.fillStyle='#556633'; ctx.font='5px "Press Start 2P"';
    ctx.fillText('E+ ranks coming soon', ux+12, 138);
  }
  hr(ux+10, 135);

  if      (gameState==='build')   drawBuildUI(ux);
  else if (gameState==='combat')  drawCombatUI(ux);
  else if (gameState==='gameover')drawGameoverUI(ux);
}

function hr(x, y) {
  ctx.fillStyle='#18082e'; ctx.fillRect(x,y,UW-20,1);
  ctx.fillStyle='#4a2a66'; ctx.fillRect(x,y+1,UW-20,1);
  ctx.fillStyle='#1a0a24'; ctx.fillRect(x,y+2,UW-20,1);
}

function drawBuildUI(ux) {
  ctx.fillStyle='#a78bfa'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('-- BUILD MODE --', ux+UW/2, 148); ctx.textAlign='left';

  // Heart button
  const hHov = inR(mouse.x,mouse.y, ux+10,155, UW-20,36);
  ctx.fillStyle = placeMode==='heart' ? '#4a0e2e' : (hHov&&!heart?'#2a1240':'#180d2c');
  ctx.fillRect(ux+10,155,UW-20,36);
  ctx.strokeStyle = placeMode==='heart' ? '#ff4488' : (heart?'#443366':'#7c3aed'); ctx.lineWidth=2;
  ctx.strokeRect(ux+10,155,UW-20,36);
  ctx.fillStyle=heart?'#665577':'#ffffff'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(heart?'\u2665 HEART PLACED':(placeMode==='heart'?'\u25ba CLICK TILE':'\u2665 PLACE HEART'), ux+UW/2, 175);
  ctx.fillStyle='#665577'; ctx.font='6px "Press Start 2P"';
  ctx.fillText(heart?'click to reposition':(placeMode==='heart'?'on dungeon floor':'(free)'), ux+UW/2, 188);
  ctx.textAlign='left';

  hr(ux+10, 200);

  // Shop button
  const shHov=!heartCarried&&inR(mouse.x,mouse.y, ux+10,232, UW-20,28);
  ctx.fillStyle=heartCarried?'#0d0b14':(shHov?'#1a0f2e':'#110920'); ctx.fillRect(ux+10,232,UW-20,28);
  ctx.strokeStyle=heartCarried?'#332244':'#7c3aed'; ctx.lineWidth=2; ctx.strokeRect(ux+10,232,UW-20,28);
  ctx.fillStyle=heartCarried?'#443366':'#c084fc'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('\u25c6 SHOP \u25c6', ux+UW/2, 251); ctx.textAlign='left';

  // Skills button
  const skHov=!heartCarried&&inR(mouse.x,mouse.y, ux+10,266, UW-20,28);
  ctx.fillStyle=heartCarried?'#080c12':(skillMenuOpen?'#0f1a30':(skHov?'#0c1828':'#080f1c'));
  ctx.fillRect(ux+10,266,UW-20,28);
  ctx.strokeStyle=heartCarried?'#1a2233':(skillMenuOpen?'#88bbff':'#2244aa'); ctx.lineWidth=2;
  ctx.strokeRect(ux+10,266,UW-20,28);
  ctx.fillStyle=heartCarried?'#2a3a55':(skillMenuOpen?'#88bbff':'#4488ff'); ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('\u2694 SKILLS \u2694', ux+UW/2, 285); ctx.textAlign='left';

  // Inventory button
  const invHov=!heartCarried&&inR(mouse.x,mouse.y, ux+10,300, UW-20,28);
  ctx.fillStyle=heartCarried?'#0c0900':(invOpen?'#1a0e00':(invHov?'#1a1000':'#0f0900'));
  ctx.fillRect(ux+10,300,UW-20,28);
  ctx.strokeStyle=heartCarried?'#2a2000':(invOpen?'#ffaa00':'#886600'); ctx.lineWidth=2;
  ctx.strokeRect(ux+10,300,UW-20,28);
  ctx.fillStyle=heartCarried?'#3a2a00':(invOpen?'#ffaa00':'#cc8800'); ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('\u25a4 INVENTORY', ux+UW/2, 319); ctx.textAlign='left';

  hr(ux+10, 334);

  // Hunger indicator
  const minionUpkeepB = placedMinions.reduce((s,m)=>s+m.level*MINION_TYPES[m.type].foodPerLevel, 0);
  const hungerCostB = 5 * player.level + minionUpkeepB;
  ctx.textAlign = 'center';
  if (starving) {
    const sp = 0.5 + 0.5*Math.abs(Math.sin(Date.now()*0.005));
    ctx.globalAlpha = sp;
    ctx.fillStyle='#ff4444'; ctx.font='6px "Press Start 2P"';
    ctx.fillText('\u26a0 STARVING!  Heart -2%/s!', ux+UW/2, 347);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle='#886644'; ctx.font='5px "Press Start 2P"';
    ctx.fillText('\u25bc Hunger: -'+hungerCostB+' food in '+Math.ceil(hungerTimer)+'s', ux+UW/2, 347);
  }
  ctx.textAlign = 'left';

  hr(ux+10, 356);

  // Wave countdown
  const sec=Math.ceil(Math.max(0,waveTimer)), urgent=waveTimer<=15&&heart&&!paused;
  const pct=Math.max(0,waveTimer/60), timerCol=urgent?'#ff3333':'#44aaff';
  const pulse=urgent?(0.7+0.3*Math.abs(Math.sin(Date.now()*0.006))):1;
  ctx.fillStyle='#aaccff'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('NEXT ADVENTURERS', ux+UW/2, 368);
  ctx.globalAlpha=pulse;
  ctx.fillStyle=paused?'#776688':timerCol; ctx.font='18px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(sec+'s', ux+UW/2, 394);
  ctx.globalAlpha=1;
  ctx.fillStyle='#111'; ctx.fillRect(ux+14,398,UW-28,7);
  ctx.fillStyle=paused?'#554477':timerCol; ctx.fillRect(ux+14,398,(UW-28)*pct,7);
  ctx.strokeStyle='#221833'; ctx.lineWidth=1; ctx.strokeRect(ux+14,398,UW-28,7);
  ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
  if      (paused)       { ctx.fillStyle='#886699'; ctx.fillText('(paused)', ux+UW/2, 413); }
  else if (heartCarried) { ctx.fillStyle='#ff6699'; ctx.fillText('Heart unplaced!', ux+UW/2, 413); }
  else if (!heart)       { ctx.fillStyle='#ff8844'; ctx.fillText('Place Heart first!', ux+UW/2, 413); }
  else if (urgent)       { ctx.fillStyle='#ff3333'; ctx.fillText('INCOMING!', ux+UW/2, 413); }
  else                   { ctx.fillStyle='#555577'; ctx.fillText('wave '+wave+': '+(wave+1)+' adventurers', ux+UW/2, 413); }
  ctx.textAlign='left';

  // Raid Now button
  const canRaid=!!heart&&!paused&&!heartCarried, rnHov=canRaid&&inR(mouse.x,mouse.y, ux+10,421, UW-20,28);
  ctx.fillStyle=rnHov?'#3a1008':(canRaid?'#280a08':'#0f0c0c');
  ctx.fillRect(ux+10,421,UW-20,28);
  ctx.strokeStyle=canRaid?'#ff4422':'#2a1810'; ctx.lineWidth=2;
  ctx.strokeRect(ux+10,421,UW-20,28);
  ctx.fillStyle=canRaid?'#ff6644':'#443322'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('\u2694 RAID NOW \u2694', ux+UW/2, 440); ctx.textAlign='left';
}

function drawCombatUI(ux) {
  ctx.fillStyle='#ff5555'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('\u2694 COMBAT \u2694', ux+UW/2, 150); ctx.textAlign='left';

  ctx.fillStyle='#aaccff'; ctx.font='6px "Press Start 2P"'; ctx.fillText('YOU   DEF:'+player.def+'  ATK:'+player.atkDmg, ux+15, 166);
  bBar(ux+15,170,UW-30,13, player.hp/player.maxHp, '#44ff44','#ff2222');
  ctx.fillStyle='#fff'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(player.hp+' / '+player.maxHp, ux+UW/2, 182); ctx.textAlign='left';

  if (heart) {
    ctx.fillStyle='#ff88cc'; ctx.font='6px "Press Start 2P"'; ctx.fillText('HEART', ux+15, 200);
    bBar(ux+15,204,UW-30,13, heart.hp/heart.maxHp, '#ff4488','#ff1111');
    ctx.fillStyle='#fff'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(heart.hp+' / '+heart.maxHp, ux+UW/2, 216); ctx.textAlign='left';
  }
  hr(ux+10, 228);

  ctx.fillStyle='#ff9944'; ctx.font='6px "Press Start 2P"'; ctx.fillText('WAVE PROGRESS', ux+15, 244);
  bBar(ux+15,249,UW-30,10, waveDefeated/Math.max(1,waveTarget), '#ff8844','#441100');
  ctx.fillStyle='#cc7733'; ctx.font='7px "Press Start 2P"';
  ctx.fillText(waveDefeated+'/'+waveTarget+' slain', ux+15, 268);
  ctx.fillText(adventurers.filter(a=>a.alive).length+' active', ux+15, 283);
  hr(ux+10, 296);

  // Active class breakdown
  const clsCounts = {};
  for (const a of adventurers) if (a.alive) clsCounts[a.cls] = (clsCounts[a.cls]||0)+1;
  ctx.fillStyle='#8899aa'; ctx.font='6px "Press Start 2P"'; ctx.fillText('ACTIVE:', ux+15, 312);
  let cx2 = ux+15;
  for (const [cls,cnt] of Object.entries(clsCounts)) {
    ctx.fillStyle=CSPR[cls].c[1]||'#fff'; ctx.font='5px "Press Start 2P"';
    ctx.fillText(cls.slice(0,3).toUpperCase()+'x'+cnt, cx2, 326); cx2 += 50;
  }
  hr(ux+10, 334);

  hr(ux+10, 350);

  ctx.fillStyle='#bbaaaa'; ctx.font='7px "Press Start 2P"'; ctx.fillText('◆ F-Infamy: '+fInfamy+'/100', ux+15, 394);
  ctx.fillStyle='#443355'; ctx.font='6px "Press Start 2P"';
  ctx.fillText('Click / SPACE = attack', ux+15, 410);
  ctx.fillText('P = Pause',              ux+15, 424);
  hr(ux+10, 432);
  const minionUpkeepC = placedMinions.reduce((s,m)=>s+m.level*MINION_TYPES[m.type].foodPerLevel, 0);
  const hungerCostC = 5 * player.level + minionUpkeepC;
  if (starving) {
    const cp = 0.5 + 0.5*Math.abs(Math.sin(Date.now()*0.005));
    ctx.globalAlpha = cp;
    ctx.fillStyle='#ff4444'; ctx.font='6px "Press Start 2P"';
    ctx.fillText('⚠ STARVING!', ux+15, 446);
    ctx.globalAlpha = 1;
    ctx.fillStyle='#cc4422'; ctx.font='5px "Press Start 2P"';
    ctx.fillText('Heart draining -2%/s!', ux+15, 458);
  } else {
    ctx.fillStyle='#886644'; ctx.font='5px "Press Start 2P"';
    ctx.fillText('▼ -'+hungerCostC+' food/min', ux+15, 446);
    ctx.fillText('Next: '+Math.ceil(hungerTimer)+'s', ux+15, 458);
  }
}

function drawGameoverUI(ux) {
  ctx.fillStyle='#ff4444'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('DUNGEON LOST', ux+UW/2, 160); ctx.textAlign='left';
  ctx.fillStyle='#664455'; ctx.font='6px "Press Start 2P"';
  ctx.fillText('level: '+player.level,      ux+15, 185);
  ctx.fillText('wave: '+wave,               ux+15, 201);
  ctx.fillText('coins: '+coins,             ux+15, 217);
  ctx.fillText('F-infamy: '+fInfamy,        ux+15, 233);
  ctx.fillText('rank: '+RANKS[dungeonRank], ux+15, 249);
}

function bBar(x,y,w,h,p,good,bad) {
  p = Math.max(0, Math.min(1, p));
  ctx.fillStyle='#0d0a18'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = p>0.5 ? good : (p>0.25 ? '#ffaa00' : bad);
  ctx.fillRect(x,y,w*p,h);
  ctx.strokeStyle='#221833'; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
}

// ── Inventory overlay ─────────────────────────────────────────
// ── Trap tile rendering ───────────────────────────────────────
function drawTrapTile(px, py, trap, now) {
  const onCd = !trap.active;
  if (trap.type === 'groundSpikes') {
    const revealed = trap.revealed;
    const phase = now * 0.003;
    const pulse = revealed ? 0.7 + 0.3 * Math.sin(phase * 2.5) : 1.0;
    const col = onCd ? '#553322' : (revealed ? '#ccaa55' : '#997744');
    const tip = onCd ? '#664433' : (revealed ? '#ffee88' : '#ddbb66');
    ctx.save();
    if (revealed && !onCd) {
      ctx.shadowBlur  = 10;
      ctx.shadowColor = '#ffdd44';
      ctx.globalAlpha = pulse;
    }
    for (let s = 0; s < 4; s++) {
      const sx = px + 6 + s * 8;
      ctx.fillStyle = col;  ctx.fillRect(sx, py+22, 5, 14);
      ctx.fillStyle = tip;  ctx.fillRect(sx+1, py+14, 3, 8);
      ctx.fillStyle = col;  ctx.fillRect(sx, py+34, 5, 2);
    }
    ctx.restore();
    if (revealed && !onCd) {
      const cx = px + TILE/2, cy = py + TILE/2;
      ctx.save();
      ctx.strokeStyle = '#ffdd44';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(phase);
      ctx.beginPath(); ctx.arc(cx, cy, 10 + 3*Math.sin(phase), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(phase + 1.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 17 + 2*Math.sin(phase + 1.5), 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    // Durability bar at bottom of tile
    if (trap.durability !== undefined) {
      const maxDur = TRAP_TYPES.groundSpikes.durabilityAtLevel(trap.level);
      const bw = TILE - 8;
      ctx.fillStyle = '#111';
      ctx.fillRect(px + 4, py + 36, bw, 3);
      ctx.fillStyle = trap.durability > 0 ? '#ffdd44' : '#553322';
      ctx.fillRect(px + 4, py + 36, Math.round(bw * (trap.durability / maxDur)), 3);
    }
  } else if (trap.type === 'quicksand') {
    const cx = px + TILE/2, cy = py + TILE/2;
    if (!trap.revealed) {
      // Hidden: subtle sandy overlay visible to dungeon lord only
      ctx.fillStyle = '#c8a02044';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#d4b04066';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(px+4+i*7, py+14+(i%3)*6, 3, 3);
      }
    } else {
      // Revealed: sandy base with animated concentric rings
      ctx.fillStyle = '#a07818';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#c8980e';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(px+3+i*6, py+3+(i%2)*4, 4, 4);
        ctx.fillRect(px+2+i*6, py+24+(i%3)*4, 3, 3);
      }
      const phase = now * 0.003;
      ctx.save();
      ctx.strokeStyle = '#f0d060';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(phase);
      ctx.beginPath(); ctx.arc(cx, cy, 7 + 3*Math.sin(phase), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(phase + 1.5);
      ctx.beginPath(); ctx.arc(cx, cy, 13 + 2*Math.sin(phase + 1.5), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(phase + 3.0);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 18 + 2*Math.sin(phase + 3.0), 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#f0d060';
      ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('Lv'+trap.level, cx, py + TILE - 3);
      ctx.textAlign = 'left';
    }
  } else if (trap.type === 'fartMushroom') {
    const revealed = trap.revealed;
    const active   = trap.active;
    const phase = now * 0.003;
    // disabled = revealed but fired this wave; use dim regrowth colors, no glow
    const disabled = revealed && !active;
    const stemCol = (revealed && active) ? '#55aa22' : '#335511';
    const capCol  = (revealed && active) ? '#88ee44' : '#558833';
    const spotCol = (revealed && active) ? '#336611' : '#224411';
    ctx.save();
    if (disabled) {
      // tiny centered mushroom — ~half scale, no glow
      ctx.fillStyle = stemCol; ctx.fillRect(px+17, py+26, 6, 8);
      ctx.fillStyle = capCol;  ctx.fillRect(px+13, py+18, 14, 8); ctx.fillRect(px+15, py+14, 10, 5);
      ctx.fillStyle = spotCol; ctx.fillRect(px+14, py+21, 2, 3);  ctx.fillRect(px+21, py+20, 2, 3);
    } else {
      if (revealed && active) {
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#88ff44';
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(phase * 2.5);
      }
      ctx.fillStyle=stemCol; ctx.fillRect(px+14,py+24,12,12);
      ctx.fillStyle=capCol;  ctx.fillRect(px+6,py+10,28,14); ctx.fillRect(px+10,py+6,20,6);
      ctx.fillStyle=spotCol; ctx.fillRect(px+10,py+13,4,5); ctx.fillRect(px+24,py+11,4,5);
    }
    ctx.restore();
    if (revealed && active) {
      const cx = px + TILE/2, cy = py + TILE/2;
      ctx.save();
      ctx.strokeStyle = '#88ff44';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(phase);
      ctx.beginPath(); ctx.arc(cx, cy, 10 + 3*Math.sin(phase), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(phase + 1.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 17 + 2*Math.sin(phase + 1.5), 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    } else if (!revealed) {
      const pulse = 0.5 + 0.5*Math.sin(now*0.004);
      if (pulse > 0.6) { ctx.fillStyle='rgba(136,204,51,0.25)'; ctx.fillRect(px,py,TILE,TILE); }
    }
  } else if (trap.type === 'emberbolt') {
    const dir = trap.dir || 'right';
    const phase = now * 0.003;
    const cx = px + TILE/2, cy = py + TILE/2;
    ctx.save();
    // Dark metal base
    ctx.fillStyle = '#1a0800'; ctx.fillRect(px+3, py+3, TILE-6, TILE-6);
    ctx.fillStyle = '#2e1200'; ctx.fillRect(px+7, py+7, TILE-14, TILE-14);
    // Corner rivets
    ctx.fillStyle = '#553322';
    for (const [rx,ry] of [[px+4,py+4],[px+TILE-8,py+4],[px+4,py+TILE-8],[px+TILE-8,py+TILE-8]]) {
      ctx.fillRect(rx, ry, 4, 4);
    }
    // Directional barrel
    ctx.save();
    ctx.translate(cx, cy);
    const nRot = { right:0, left:Math.PI, up:-Math.PI/2, down:Math.PI/2 };
    ctx.rotate(nRot[dir] || 0);
    ctx.fillStyle = '#773311'; ctx.fillRect(-2, -4, 16, 8);
    ctx.fillStyle = '#994422'; ctx.fillRect(10, -5, 6, 10);
    ctx.fillStyle = '#cc5533'; ctx.fillRect(12, -6, 4, 12);
    ctx.restore();
    // Ember glow at barrel tip
    const glowX = cx + (dir==='right'?16:dir==='left'?-16:0);
    const glowY = cy + (dir==='down'?16:dir==='up'?-16:0);
    const pulse = 0.65 + 0.35 * Math.sin(phase * 4.5);
    ctx.shadowBlur = 14 * pulse; ctx.shadowColor = '#ff4400';
    ctx.fillStyle = `rgba(255,${Math.round(80+80*Math.sin(phase*3))},0,${0.85*pulse})`;
    ctx.beginPath(); ctx.arc(glowX, glowY, 5+2*Math.sin(phase*4.5), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,220,50,${0.75*pulse})`;
    ctx.beginPath(); ctx.arc(glowX, glowY, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff8833'; ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
    ctx.fillText('Lv'+trap.level, cx, py+TILE-3);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ── Trap context popup ────────────────────────────────────────
function trapPopupPos(trap) {
  const pw = 172;
  const ph = 108;
  const sx = (trap.gx*TILE - cam.wx) * cam.zoom;
  const sy = (trap.gy*TILE - cam.wy) * cam.zoom;
  let px = sx + TILE*cam.zoom + 4, py = sy - 10;
  if (px + pw > DW - 4) px = sx - pw - 4;
  if (py + ph > CH - 4) py = CH - ph - 4;
  if (py < 4) py = 4;
  return { px, py, pw, ph };
}

function drawTrapContext() {
  const trap = trapContext;
  const cfg = TRAP_TYPES[trap.type];
  const { px, py, pw, ph } = trapPopupPos(trap);
  const isQS  = trap.type === 'quicksand';
  const maxed = trap.level >= cfg.maxLevel;

  ctx.fillStyle='#0f0900'; ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle='#cc8800'; ctx.lineWidth=2; ctx.strokeRect(px,py,pw,ph);

  // Header
  ctx.fillStyle='#ffaa00'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='left';
  ctx.fillText(cfg.name+' Lv'+trap.level+(maxed?' (MAX)':''), px+8, py+14);
  ctx.fillStyle='#886644'; ctx.font='5px "Press Start 2P"';
  ctx.fillText(cfg.effectDesc(trap.level), px+8, py+26);
  ctx.fillStyle='#88aa88';
  if (isQS)
    ctx.fillText(trap.revealed ? 'REVEALED' : 'HIDDEN', px+8, py+38);
  else if (trap.type === 'groundSpikes' && trap.durability !== undefined) {
    const maxDur = TRAP_TYPES.groundSpikes.durabilityAtLevel(trap.level);
    if (trap.durability <= 0) {
      ctx.fillStyle = '#cc4422';
      ctx.fillText('BROKEN  (refills next wave)', px+8, py+38);
    } else {
      ctx.fillStyle = '#ddbb44';
      ctx.fillText('DUR: '+trap.durability+' / '+maxDur, px+8, py+38);
    }
  } else if (!trap.active && cfg.cooldown >= 5)
    ctx.fillText('CD: '+Math.ceil(trap.cooldownTimer)+'s', px+8, py+38);

  // UPGRADE button
  const upgCost = maxed ? 0 : Math.round(cfg.upgradeBaseCost * Math.pow(2, trap.level - 1));
  const canUpg = !maxed && coins >= upgCost;
  const upgHov = !maxed && inR(mouse.x,mouse.y, px+6,py+48, pw-12,22);
  ctx.fillStyle = maxed ? '#0a0800' : (canUpg?(upgHov?'#2a1600':'#1a1000'):'#0d0800');
  ctx.fillRect(px+6,py+48,pw-12,22);
  ctx.strokeStyle = maxed ? '#221800' : (canUpg?'#cc8800':'#332200'); ctx.lineWidth=1;
  ctx.strokeRect(px+6,py+48,pw-12,22);
  ctx.fillStyle = maxed ? '#332200' : (canUpg?'#ffaa00':'#443322');
  ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText(maxed ? 'MAX LEVEL' : 'UPGRADE ('+upgCost+' coins)', px+pw/2, py+62);

  // PICK UP button
  const puY = py+76;
  const puHov = inR(mouse.x,mouse.y, px+6,puY, pw-12,22);
  ctx.fillStyle=puHov?'#1a1200':'#0f0900';
  ctx.fillRect(px+6,puY,pw-12,22);
  ctx.strokeStyle='#886600'; ctx.lineWidth=1; ctx.strokeRect(px+6,puY,pw-12,22);
  ctx.fillStyle='#cc8833'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('PICK UP', px+pw/2, puY+14);

  // Close X
  const clX=px+pw-18, clY=py+4;
  ctx.fillStyle='#330000'; ctx.fillRect(clX,clY,14,14);
  ctx.strokeStyle='#ff4444'; ctx.lineWidth=1; ctx.strokeRect(clX,clY,14,14);
  ctx.fillStyle='#ff4444'; ctx.fillText('X', clX+7, clY+10);
  ctx.textAlign='left';
}

function trapContextClick(mx, my) {
  const trap = trapContext;
  const cfg = TRAP_TYPES[trap.type];
  const { px, py, pw, ph } = trapPopupPos(trap);
  if (inR(mx,my, px+pw-18,py+4, 14,14)) { trapContext=null; return; }

  // Upgrade
  if (inR(mx,my, px+6,py+48, pw-12,22)) {
    if (trap.level >= cfg.maxLevel) { showMsg('Already at max level!'); return; }
    const upgCost = Math.round(cfg.upgradeBaseCost * Math.pow(2, trap.level - 1));
    if (coins >= upgCost) {
      coins -= upgCost;
      trap.level++;
      if (trap.type === 'groundSpikes') {
        trap.durability = TRAP_TYPES.groundSpikes.durabilityAtLevel(trap.level);
        trap.active = true; trap.cooldownTimer = 0;
      }
      showMsg(cfg.name + ' upgraded to Lv' + trap.level + (trap.level >= cfg.maxLevel ? ' (MAX)' : '') + '!');
    } else showMsg('Need ' + upgCost + ' coins to upgrade!');
    return;
  }

  // Pick up
  const puY = py+76;
  if (inR(mx,my, px+6,puY, pw-12,22)) {
    setWorldTile(trap.gx, trap.gy, T_FLOOR);
    placedTraps.splice(placedTraps.indexOf(trap), 1);
    trap.revealed = false; trap.active = true; trap.cooldownTimer = 0;
    if (trap.type === 'groundSpikes') trap.durability = TRAP_TYPES.groundSpikes.durabilityAtLevel(trap.level);
    trapInventory.push(trap);
    trapContext = null;
    showMsg(cfg.name + ' picked up!');
    return;
  }

  if (!inR(mx,my, px,py, pw,ph)) trapContext = null;
}

function soilPopupPos() {
  const sx = (soilContext.gx * TILE - cam.wx) * cam.zoom;
  const sy = (soilContext.gy * TILE - cam.wy) * cam.zoom;
  const pw = 160, ph = 72;
  let px = sx + TILE * cam.zoom + 4, py = sy - 10;
  if (px + pw > DW - 4) px = sx - pw - 4;
  if (py + ph > CH - 4) py = CH - ph - 4;
  if (py < 4) py = 4;
  return { px, py, pw, ph };
}

function drawSoilContext() {
  const { px, py, pw, ph } = soilPopupPos();
  const hasMinion = placedMinions.some(m => m.gx === soilContext.gx && m.gy === soilContext.gy);

  ctx.fillStyle = '#080c04'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#886633'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = '#cc9944'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'left';
  ctx.fillText('Dungeon Soil', px+8, py+14);
  ctx.fillStyle = '#665533'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText(hasMinion ? 'Minion is standing here' : 'Empty — ready to pick up', px+8, py+26);

  // PICK UP button
  const canPickUp = !hasMinion;
  const puHov = canPickUp && inR(mouse.x, mouse.y, px+6, py+36, pw-12, 22);
  ctx.fillStyle = !canPickUp ? '#0d0d08' : (puHov ? '#1a1400' : '#111008');
  ctx.fillRect(px+6, py+36, pw-12, 22);
  ctx.strokeStyle = canPickUp ? '#886633' : '#332211'; ctx.lineWidth = 1;
  ctx.strokeRect(px+6, py+36, pw-12, 22);
  ctx.fillStyle = canPickUp ? '#cc9944' : '#443322';
  ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText(hasMinion ? 'BLOCKED' : 'PICK UP', px+pw/2, py+50);

  // Close X
  const clX = px+pw-18, clY = py+4;
  ctx.fillStyle = '#330000'; ctx.fillRect(clX, clY, 14, 14);
  ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1; ctx.strokeRect(clX, clY, 14, 14);
  ctx.fillStyle = '#ff4444'; ctx.fillText('X', clX+7, clY+10);
  ctx.textAlign = 'left';
}

function soilContextClick(mx, my) {
  const { px, py, pw, ph } = soilPopupPos();
  // Close X
  if (inR(mx, my, px+pw-18, py+4, 14, 14)) { soilContext = null; return; }
  // Pick Up
  if (inR(mx, my, px+6, py+36, pw-12, 22)) {
    const hasMinion = placedMinions.some(m => m.gx === soilContext.gx && m.gy === soilContext.gy);
    if (hasMinion) { showMsg('Remove the minion first before picking up this soil!'); return; }
    setWorldTile(soilContext.gx, soilContext.gy, T_FLOOR);
    ctInv++;
    burst(soilContext.worldPX+20, soilContext.worldPY+20, ['#cc8833','#ffcc55','#886622'], 6);
    showMsg('Soil tile picked up!  (' + ctInv + ' owned)');
    soilContext = null;
    return;
  }
  if (!inR(mx, my, px, py, pw, ph)) soilContext = null;
}

function drawInventory() {
  ctx.fillStyle='#000000aa'; ctx.fillRect(0,0,DW,CH);
  ctx.fillStyle='#0f0900'; ctx.fillRect(SX,SY,SW,SH);
  ctx.strokeStyle='#cc8800'; ctx.lineWidth=2; ctx.strokeRect(SX,SY,SW,SH);
  ctx.strokeStyle='#5c3a00'; ctx.lineWidth=1; ctx.strokeRect(SX+4,SY+4,SW-8,SH-8);

  // Title
  ctx.fillStyle='#ffaa00'; ctx.font='11px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('INVENTORY', DW/2, SY+26);

  // Close button
  const cx=SX+SW-38, cy=SY+8;
  const chov=inR(mouse.x,mouse.y, cx,cy, 28,28);
  ctx.fillStyle=chov?'#3a1500':'#1e0a00'; ctx.fillRect(cx,cy,28,28);
  ctx.strokeStyle='#ff8800'; ctx.lineWidth=1.5; ctx.strokeRect(cx,cy,28,28);
  ctx.fillStyle='#ff8800'; ctx.font='10px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('X', cx+14, cy+18);

  // Tabs
  const TABS = ['food','traps','minions','dungeon'];
  const TAB_LABELS = ['FOOD','TRAPS','MINIONS','DUNGEON'];
  const tabW = Math.floor((SW-24)/4);
  for (let i=0; i<4; i++) {
    const tx=SX+12+i*(tabW+4), ty=SY+38;
    const active=invTab===TABS[i];
    const thov=inR(mouse.x,mouse.y, tx,ty, tabW,24);
    ctx.fillStyle=active?'#3a2200':(thov?'#2a1600':'#1a0e00');
    ctx.fillRect(tx,ty,tabW,24);
    ctx.strokeStyle=active?'#ffaa00':'#5c3a00'; ctx.lineWidth=active?2:1;
    ctx.strokeRect(tx,ty,tabW,24);
    ctx.fillStyle=active?'#ffaa00':'#886633'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(TAB_LABELS[i], tx+tabW/2, ty+15);
  }

  // Divider
  ctx.fillStyle='#5c3a00'; ctx.fillRect(SX+8,SY+66,SW-16,1);
  ctx.textAlign='left';

  if      (invTab==='food')    drawInventoryFood();
  else if (invTab==='traps')   drawInventoryTraps();
  else if (invTab==='minions') drawInventoryMinions();
  else                         drawInventoryDungeon();
}

function drawInventoryFood() {
  let minionTip = null;
  const INV_VIEW_H = SH - 70;
  // Compute goblinFarmer inventory groups
  const farmerGroups = {};
  for (const m of minionInventory.filter(m => m.type === 'goblinFarmer')) {
    const k = 'goblinFarmer_' + m.level;
    if (!farmerGroups[k]) farmerGroups[k] = { type:'goblinFarmer', level:m.level, count:0 };
    farmerGroups[k].count++;
  }
  const fGrpArr = Object.values(farmerGroups);
  const placedFarmers = placedMinions.filter(m => m.type === 'goblinFarmer');
  let _totalH = 68 + 8 + 20 + (fGrpArr.length === 0 ? 20 : fGrpArr.length * 78);
  _totalH += 9 + 16 + (placedFarmers.length === 0 ? 14 : placedFarmers.length * 14 + 14);
  invScrollY = Math.max(0, Math.min(Math.max(0, _totalH - INV_VIEW_H), invScrollY));
  const smy = (mouse.y >= SY+70 && mouse.y <= SY+SH) ? mouse.y + invScrollY : -9999;
  ctx.save();
  ctx.beginPath(); ctx.rect(SX+8, SY+70, SW-16, INV_VIEW_H); ctx.clip();
  ctx.translate(0, -invScrollY);
  let iy = SY + 76;

  // — Dungeon Soil row —
  const soilColor = '#3a2a12';
  const soilActive = placeMode === 'cropTile';
  const soilHov = inR(mouse.x, smy, SX+8, iy, SW-16, 68);
  ctx.fillStyle = soilHov ? '#1a1000' : '#110b00'; ctx.fillRect(SX+8, iy, SW-16, 68);
  ctx.strokeStyle = soilActive ? soilColor : '#2a1800'; ctx.lineWidth = soilActive ? 2 : 1;
  ctx.strokeRect(SX+8, iy, SW-16, 68);
  ctx.fillStyle = soilColor; ctx.fillRect(SX+18, iy+16, 28, 28);
  ctx.strokeStyle = '#3a2200'; ctx.lineWidth = 1; ctx.strokeRect(SX+18, iy+16, 28, 28);
  ctx.fillStyle = '#ffcc88'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('DUNGEON SOIL', SX+56, iy+22);
  ctx.fillStyle = '#886644'; ctx.font = '5px "Press Start 2P"'; ctx.fillText('Convert floor tile to soil', SX+56, iy+35);
  ctx.fillStyle = ctInv > 0 ? '#88ff88' : '#665544'; ctx.fillText('Owned: ' + ctInv, SX+56, iy+48);
  const sbx = SX+SW-100, sby = iy+16;
  const sbHov = inR(mouse.x, smy, sbx, sby, 84, 32);
  ctx.fillStyle = soilActive ? '#2a1600' : (ctInv > 0 ? (sbHov ? '#3a2000' : '#221000') : '#0d0a00');
  ctx.fillRect(sbx, sby, 84, 32);
  ctx.strokeStyle = soilActive ? soilColor : (ctInv > 0 ? '#cc8800' : '#2a1800'); ctx.lineWidth = 1.5;
  ctx.strokeRect(sbx, sby, 84, 32);
  ctx.fillStyle = soilActive ? soilColor : (ctInv > 0 ? '#ffaa00' : '#443322');
  ctx.font = '7px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText(soilActive ? 'CANCEL' : 'PLACE SOIL', sbx+42, sby+20); ctx.textAlign = 'left';
  iy += 68 + 8;

  // — Mushroom Farmers —
  ctx.fillStyle = '#446633'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('MUSHROOM FARMERS:', SX+12, iy+12); iy += 20;
  if (fGrpArr.length === 0) {
    ctx.fillStyle = '#334422'; ctx.fillText('None — buy from Shop', SX+12, iy+12); iy += 20;
  } else {
    for (const grp of fGrpArr) {
      const cfg = MINION_TYPES.goblinFarmer;
      const msr = MINION_SPRS.goblinFarmer;
      const active = placeMode === 'minion_goblinFarmer';
      const iHov = inR(mouse.x, smy, SX+8, iy, SW-16, 74);
      if (iHov) minionTip = { key:'goblinFarmer', level:grp.level };
      ctx.fillStyle = iHov ? '#111800' : '#0a1000'; ctx.fillRect(SX+8, iy, SW-16, 74);
      ctx.strokeStyle = active ? cfg.accentColor : '#1a2800'; ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(SX+8, iy, SW-16, 74);
      sprS(msr.s, msr.c, SX+16, iy+10, 3);
      ctx.fillStyle = '#aaffaa'; ctx.font = '6px "Press Start 2P"';
      ctx.fillText(cfg.name + ' Lv' + grp.level, SX+46, iy+20);
      ctx.fillStyle = '#668844'; ctx.font = '5px "Press Start 2P"';
      ctx.fillText(cfg.effectDesc(grp.level), SX+46, iy+32);
      const gfGen = MINION_TYPES.goblinFarmer.foodGenAtLevel(grp.level);
      ctx.fillStyle = '#55dd88'; ctx.fillText('Gen: +' + gfGen + '/min  Free', SX+46, iy+44);
      ctx.fillStyle = '#88ff88'; ctx.fillText('x' + grp.count + ' in inventory', SX+46, iy+56);
      const bx = SX+SW-96, by = iy+16;
      const bHov = inR(mouse.x, smy, bx, by, 80, 32);
      ctx.fillStyle = active ? '#1a2800' : (bHov ? '#2a3800' : '#141e00');
      ctx.fillRect(bx, by, 80, 32);
      ctx.strokeStyle = active ? cfg.accentColor : '#446622'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, 80, 32);
      ctx.fillStyle = active ? cfg.accentColor : '#88cc44';
      ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText(active ? 'CANCEL' : 'PLACE', bx+40, by+20); ctx.textAlign = 'left';
      iy += 78;
    }
  }
  ctx.fillStyle = '#2a3800'; ctx.fillRect(SX+8, iy, SW-16, 1); iy += 9;
  ctx.fillStyle = '#446633'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('PLACED (' + placedFarmers.length + '):', SX+12, iy+12); iy += 16;
  if (placedFarmers.length === 0) {
    ctx.fillStyle = '#334422'; ctx.fillText('None placed', SX+12, iy+12);
  } else {
    for (const m of placedFarmers) {
      const gfGen = MINION_TYPES.goblinFarmer.foodGenAtLevel(m.level);
      const status = m.alive ? 'HP:' + m.hp + '/' + m.maxHp : 'DEAD Respawn:' + Math.ceil(m.respawnTimer) + 's';
      ctx.fillStyle = m.alive ? '#88cc88' : '#aa6644'; ctx.font = '5px "Press Start 2P"';
      ctx.fillText('Farmer Lv' + m.level + '  (' + m.gx + ',' + m.gy + ')  ' + status + '  +' + gfGen + '/min', SX+12, iy+12);
      iy += 14;
    }
    ctx.fillStyle = '#443322'; ctx.font = '4px "Press Start 2P"';
    ctx.fillText('Click a farmer in the dungeon to upgrade/pick up', SX+12, iy+12);
  }
  ctx.restore();
  if (_totalH > INV_VIEW_H) {
    const trackH = INV_VIEW_H - 4, maxS = _totalH - INV_VIEW_H;
    const thumbH = Math.max(20, (INV_VIEW_H / _totalH) * trackH);
    const thumbY = SY+70+2 + (invScrollY / maxS) * (trackH - thumbH);
    ctx.fillStyle = '#3a2200'; ctx.fillRect(SX+SW-8, SY+70+2, 5, trackH);
    ctx.fillStyle = '#cc8800'; ctx.fillRect(SX+SW-8, thumbY, 5, thumbH);
  }
  if (minionTip) drawMinionTooltip(minionTip.key, minionTip.level);
}

// ── Trap tooltip panel (shared by shop + inventory) ───────────
function drawTrapTooltip(key, level) {
  const cfg = TRAP_TYPES[key];
  const col  = cfg.accentColor || cfg.color;
  const TTX  = SX + SW + 8;
  const TTW  = CW - TTX - 8;
  const TTY  = SY - 10;
  const TTH  = SH + 20;
  const mid  = TTX + TTW / 2;
  const PAD  = 10;

  ctx.fillStyle = '#040209';
  ctx.fillRect(TTX, TTY, TTW, TTH);
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.strokeRect(TTX, TTY, TTW, TTH);
  ctx.strokeStyle = col+'33'; ctx.lineWidth = 1;
  ctx.strokeRect(TTX+3, TTY+3, TTW-6, TTH-6);
  ctx.fillStyle = col+'22';
  ctx.fillRect(TTX+2, TTY+2, TTW-4, 46);

  ctx.save();
  ctx.beginPath(); ctx.rect(TTX+4, TTY+4, TTW-8, TTH-8); ctx.clip();

  // Trap icon (scaled drawTrapTile)
  const iconSize = 40;
  const iconX = mid - iconSize * 0.55;
  const iconY = TTY + 4;
  ctx.save();
  ctx.translate(iconX, iconY);
  ctx.scale(1.1, 1.1);
  const mockTrap = { type: key, level: level, revealed: true, active: true, cooldownTimer: 0, dir: 'right' };
  drawTrapTile(0, 0, mockTrap, performance.now());
  ctx.restore();

  // Name
  let cy = TTY + 52;
  ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillStyle = col;
  const nameWords = cfg.name.split(' ');
  let nameLine = '';
  for (const w of nameWords) {
    const test = nameLine + (nameLine ? ' ' : '') + w;
    if (ctx.measureText(test).width > TTW - PAD*2) {
      ctx.fillText(nameLine, mid, cy); nameLine = w; cy += 10;
    } else { nameLine = test; }
  }
  ctx.fillText(nameLine, mid, cy); cy += 12;

  // Type badge
  const BADGES = {
    groundSpikes: ['DAMAGE',     '#2e1200', '#ff9944'],
    fartMushroom: ['AREA EFFECT','#0e200a', '#88dd33'],
    quicksand:    ['SLOW + DOT', '#221a00', '#f0d060'],
    emberbolt:    ['DIRECTIONAL','#2a0a00', '#ff5522'],
  };
  const [badgeLabel, badgeBg, badgeFg] = BADGES[key] || ['TRAP','#111','#aaa'];
  const bw = 76, bh = 13;
  ctx.fillStyle = badgeBg; ctx.fillRect(mid-bw/2, cy-10, bw, bh);
  ctx.strokeStyle = badgeFg; ctx.lineWidth = 1; ctx.strokeRect(mid-bw/2, cy-10, bw, bh);
  ctx.font = '5px "Press Start 2P"'; ctx.fillStyle = badgeFg;
  ctx.fillText(badgeLabel, mid, cy-1); cy += 8;

  // Divider
  ctx.fillStyle = col+'55'; ctx.fillRect(TTX+PAD, cy, TTW-PAD*2, 1); cy += 9;

  // Level stats line
  ctx.textAlign = 'left'; ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = col;
  ctx.fillText('Lv'+level+' Effect: '+cfg.effectDesc(level), TTX+PAD, cy); cy += 9;
  if (cfg.maxLevel) {
    ctx.fillStyle = '#776655';
    ctx.fillText('Max level: '+cfg.maxLevel, TTX+PAD, cy); cy += 9;
  }
  cy += 2;

  // Divider
  ctx.fillStyle = col+'55'; ctx.fillRect(TTX+PAD, cy, TTW-PAD*2, 1); cy += 9;

  // Bullet tips — derived from cfg so they stay in sync with any stat changes
  const TIPS = {
    groundSpikes: cfg => [
      'Hidden until an adventurer walks over it.',
      `Deals ${Math.round(cfg.baseEffect*100)}% of the enemy's max HP on trigger.`,
      `Each upgrade adds +${Math.round(cfg.upgradeBoost*100)}% more damage (max level ${cfg.maxLevel}).`,
      `Rearms every ${cfg.cooldown}s, but only up to its durability limit.`,
      'Durability equals the trap level (Lv1 = 1 use, Lv5 = 5 uses per wave).',
      'When durability hits 0 the trap is disabled — it refills at the next wave.',
    ],
    fartMushroom: cfg => [
      'Hidden until an adventurer walks over it.',
      'Releases a fear cloud that scares enemies away.',
      'The cloud area grows larger with each upgrade.',
      'Fires once per wave — regrows automatically next wave.',
    ],
    quicksand: cfg => [
      'Invisible to adventurers — a pure ambush trap.',
      'Slows enemies caught inside by 20%.',
      'Also drains 1% of max HP every second while inside.',
      'Never breaks — stays active forever.',
      'Upgrade for stronger slow and more damage per second.',
    ],
    emberbolt: cfg => [
      'Always visible. Fires a fire arrow automatically.',
      'Choose firing direction with WASD keys when placing.',
      'Each arrow deals 10% of the target\'s max HP on hit.',
      'Applies Burn: ongoing fire damage for 5 seconds.',
      'Enemies will try to dodge the arrows.',
      `Fires every ${cfg.fireRateAtLevel(1)}s at level 1. Upgrade to fire faster.`,
    ],
  };
  const tips = TIPS[key] ? TIPS[key](cfg) : [];
  ctx.font = '5px "Press Start 2P"';
  const lineW = TTW - PAD*2 - 9;
  const textX = TTX + PAD + 8;
  const dotX  = TTX + PAD;
  for (const tip of tips) {
    ctx.fillStyle = col; ctx.fillRect(dotX, cy-4, 4, 4);
    const words = tip.split(' ');
    let line = '', ty = cy, first = true;
    for (const w of words) {
      const test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > lineW) {
        ctx.fillStyle = first ? '#ddeeff' : '#99aabb';
        ctx.fillText(line, textX, ty); line = w; ty += 10; first = false;
      } else { line = test; }
    }
    ctx.fillStyle = first ? '#ddeeff' : '#99aabb';
    if (line) ctx.fillText(line, textX, ty);
    cy = ty + 13;
  }

  // Cost footer
  cy += 2; ctx.fillStyle = col+'55'; ctx.fillRect(TTX+PAD, cy, TTW-PAD*2, 1); cy += 9;
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = '#ffd700'; ctx.fillText('Buy cost:  '+cfg.baseCost+' coins', TTX+PAD, cy); cy += 9;
  ctx.fillStyle = '#aabbcc'; ctx.fillText('Upg cost:  '+cfg.upgradeBaseCost+' coins/level', TTX+PAD, cy);

  ctx.restore();
  ctx.textAlign = 'left';
}

function drawInventoryTraps() {
  let trapTip = null;
  let iy = SY+76;
  const INV_VIEW_H = SH - 70;

  // Fixed header: trap slot capacity bar (not scrolled)
  const canUpgSlot = coins >= 1000;
  ctx.fillStyle='#cc8800'; ctx.font='6px "Press Start 2P"';
  ctx.fillText('TRAP SLOTS: '+placedTraps.length+' / '+trapSlots+' placed', SX+14, iy+14);
  const barW = SW-148;
  ctx.fillStyle='#111'; ctx.fillRect(SX+12,iy+20,barW,8);
  ctx.fillStyle='#cc6600'; ctx.fillRect(SX+12,iy+20,barW*(placedTraps.length/Math.max(1,trapSlots)),8);
  ctx.strokeStyle='#553300'; ctx.lineWidth=1; ctx.strokeRect(SX+12,iy+20,barW,8);
  {
    const bx=SX+14+barW, by=iy+14;
    const bHov=inR(mouse.x,mouse.y, bx,by, 118,20);
    ctx.fillStyle=canUpgSlot?(bHov?'#2a1600':'#1a1000'):'#0d0800';
    ctx.fillRect(bx,by,118,20);
    ctx.strokeStyle=canUpgSlot?'#cc8800':'#332200'; ctx.lineWidth=1; ctx.strokeRect(bx,by,118,20);
    ctx.fillStyle=canUpgSlot?'#ffaa00':'#443322'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText('EXPAND (1000)', bx+59, by+13); ctx.textAlign='left';
  }
  ctx.fillStyle='#5c3a00'; ctx.fillRect(SX+8,iy+36,SW-16,1);
  const headerH = 44; // slot bar height

  // Compute total scrollable content height
  const groups = {};
  for (const t of trapInventory) {
    const k=t.type+'_'+t.level;
    if (!groups[k]) groups[k]={type:t.type,level:t.level,count:0};
    groups[k].count++;
  }
  const grpArr = Object.values(groups);
  let _totalH = 16 + (grpArr.length === 0 ? 20 : grpArr.length * 64);
  _totalH += 9 + 16 + (placedTraps.length === 0 ? 14 : placedTraps.length * 14 + 14) + 8;
  const contentTop = SY + 70 + headerH;
  const contentViewH = INV_VIEW_H - headerH;
  invScrollY = Math.max(0, Math.min(Math.max(0, _totalH - contentViewH), invScrollY));
  const smy = (mouse.y >= contentTop && mouse.y <= SY+SH) ? mouse.y + invScrollY : -9999;

  ctx.save();
  ctx.beginPath(); ctx.rect(SX+8, contentTop, SW-16, contentViewH); ctx.clip();
  ctx.translate(0, -invScrollY);
  iy = SY + 76 + headerH;

  ctx.fillStyle='#886644'; ctx.font='5px "Press Start 2P"';
  ctx.fillText('IN INVENTORY:', SX+12, iy+12); iy += 16;
  if (grpArr.length === 0) {
    ctx.fillStyle='#443322'; ctx.fillText('None — buy traps from the shop', SX+12, iy+12); iy += 20;
  } else {
    for (const grp of grpArr) {
      const cfg = TRAP_TYPES[grp.type];
      const active = placeMode === 'trap_'+grp.type;
      const iHov = inR(mouse.x,smy, SX+8,iy, SW-16,60);
      if (iHov) trapTip = { key: grp.type, level: grp.level };
      ctx.fillStyle=iHov?'#1a1000':'#110b00'; ctx.fillRect(SX+8,iy,SW-16,60);
      ctx.strokeStyle=active?cfg.accentColor:'#2a1800'; ctx.lineWidth=active?2:1;
      ctx.strokeRect(SX+8,iy,SW-16,60);
      ctx.fillStyle=cfg.color; ctx.fillRect(SX+18,iy+12,28,28);
      ctx.strokeStyle='#3a2200'; ctx.lineWidth=1; ctx.strokeRect(SX+18,iy+12,28,28);
      ctx.fillStyle='#ffcc88'; ctx.font='6px "Press Start 2P"';
      ctx.fillText(cfg.name+' Lv'+grp.level, SX+56, iy+20);
      ctx.fillStyle='#886644'; ctx.font='5px "Press Start 2P"';
      ctx.fillText(cfg.effectDesc(grp.level), SX+56, iy+32);
      ctx.fillStyle='#88ff88'; ctx.fillText('x'+grp.count+' owned', SX+56, iy+44);
      const canPlace = placedTraps.length < trapSlots;
      const bx=SX+SW-96, by=iy+12;
      const bHov2=inR(mouse.x,smy, bx,by, 80,32);
      ctx.fillStyle=active?'#2a1600':(canPlace?(bHov2?'#3a2000':'#221000'):'#0d0a00');
      ctx.fillRect(bx,by,80,32);
      ctx.strokeStyle=active?cfg.accentColor:(canPlace?'#cc8800':'#2a1800'); ctx.lineWidth=1.5;
      ctx.strokeRect(bx,by,80,32);
      ctx.fillStyle=active?cfg.accentColor:(canPlace?'#ffaa00':'#443322');
      ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(active?'CANCEL':'PLACE', bx+40, by+20); ctx.textAlign='left';
      iy += 64;
    }
  }

  ctx.fillStyle='#5c3a00'; ctx.fillRect(SX+8,iy,SW-16,1); iy += 9;
  ctx.fillStyle='#886644'; ctx.font='5px "Press Start 2P"';
  ctx.fillText('PLACED ('+placedTraps.length+'/'+trapSlots+'):', SX+12, iy+12); iy += 16;
  if (placedTraps.length === 0) {
    ctx.fillStyle='#443322'; ctx.fillText('None placed', SX+12, iy+12);
  } else {
    for (const t of placedTraps) {
      const cfg = TRAP_TYPES[t.type];
      const status = t.type === 'quicksand' ? (t.revealed ? 'REVEALED' : 'HIDDEN')
        : t.type === 'groundSpikes' ? (t.durability <= 0 ? 'BROKEN' : 'DUR:'+t.durability+'/'+TRAP_TYPES.groundSpikes.durabilityAtLevel(t.level))
        : (!t.active ? 'CD:'+Math.ceil(t.cooldownTimer)+'s' : 'READY');
      ctx.fillStyle = t.type === 'quicksand' ? (t.revealed ? '#ddaa44' : '#8899aa') : (t.active?'#88cc88':'#5577aa');
      ctx.font='5px "Press Start 2P"';
      ctx.fillText(cfg.shortName+' Lv'+t.level+'  ('+t.gx+','+t.gy+')  '+status, SX+12, iy+12);
      iy += 14;
    }
    ctx.fillStyle='#443322'; ctx.font='4px "Press Start 2P"';
    ctx.fillText('Click a trap in the dungeon to upgrade/pick up', SX+12, iy+12);
  }
  ctx.restore();
  if (_totalH > contentViewH) {
    const trackH=contentViewH-4, maxS=_totalH-contentViewH;
    const thumbH=Math.max(20,(contentViewH/_totalH)*trackH);
    const thumbY=contentTop+2+(invScrollY/maxS)*(trackH-thumbH);
    ctx.fillStyle='#3a2200'; ctx.fillRect(SX+SW-8,contentTop+2,5,trackH);
    ctx.fillStyle='#cc8800'; ctx.fillRect(SX+SW-8,thumbY,5,thumbH);
  }
  if (trapTip) drawTrapTooltip(trapTip.key, trapTip.level);
}

function inventoryClick(mx, my) {
  // Close button
  const cx=SX+SW-38, cy=SY+8;
  if (inR(mx,my, cx,cy, 28,28)) { invOpen=false; placeMode=null; return; }

  // Tabs
  const TABS=['food','traps','minions','dungeon'];
  const tabW=Math.floor((SW-24)/4);
  for (let i=0; i<4; i++) {
    const tx=SX+12+i*(tabW+4), ty=SY+38;
    if (inR(mx,my, tx,ty, tabW,24)) { invTab=TABS[i]; invScrollY=0; return; }
  }

  // Scroll offset for content area clicks
  if (my < SY+70 || my > SY+SH) return;
  const smy = my + invScrollY;

  // Food tab rows (soil tile + goblinFarmer)
  if (invTab==='food') {
    let iy = SY + 76;
    // Soil PLACE button
    const sbx=SX+SW-100, sby=iy+16;
    if (inR(mx,smy, sbx,sby, 84,32)) {
      if (placeMode==='cropTile') { placeMode=null; }
      else if (ctInv>0) { placeMode='cropTile'; invOpen=false; }
      else showMsg('No Dungeon Soil!  Buy from Shop.');
      return;
    }
    iy += 68 + 8 + 20; // soil row + divider + header label
    // goblinFarmer groups
    const farmerGroups = {};
    for (const m of minionInventory.filter(m=>m.type==='goblinFarmer')) {
      const k='goblinFarmer_'+m.level;
      if (!farmerGroups[k]) farmerGroups[k]={type:'goblinFarmer',level:m.level,count:0};
      farmerGroups[k].count++;
    }
    const fGrpArr = Object.values(farmerGroups);
    if (fGrpArr.length === 0) { iy += 20; }
    else {
      for (const grp of fGrpArr) {
        const bx=SX+SW-96, by=iy+16;
        if (inR(mx,smy, bx,by, 80,32)) {
          if (placeMode==='minion_goblinFarmer') { placeMode=null; }
          else { placeMode='minion_goblinFarmer'; invOpen=false; }
          return;
        }
        iy += 78;
      }
    }
  }

  // Trap rows
  if (invTab==='traps') {
    let iy=SY+76;
    // Expand slot button is in fixed header — use original my
    const barW = SW-148;
    const ebx=SX+14+barW, eby=iy+14;
    if (inR(mx,my, ebx,eby, 118,20)) {
      if (coins >= 1000) {
        coins -= 1000; trapSlots += 5;
        showMsg('Trap slots expanded to '+trapSlots+'!');
      } else showMsg('Need 1000 coins to expand trap slots!');
      return;
    }
    iy += 44 + 16; // header + "IN INVENTORY" label — matches draw scroll offset base
    if (trapInventory.length === 0) { iy += 20; }
    else {
      const groups = {};
      for (const t of trapInventory) {
        const k=t.type+'_'+t.level;
        if (!groups[k]) groups[k]={type:t.type,level:t.level,count:0};
        groups[k].count++;
      }
      for (const grp of Object.values(groups)) {
        const bx=SX+SW-96, by=iy+12;
        if (inR(mx,smy, bx,by, 80,32)) {
          const placeKey='trap_'+grp.type;
          if (placeMode===placeKey) { placeMode=null; }
          else if (placedTraps.length >= trapSlots) { showMsg('Trap slots full!'); }
          else { placeMode=placeKey; invOpen=false; }
          return;
        }
        iy += 64;
      }
    }
  }

  // Minion rows
  if (invTab==='minions') {
    const nonFarmerInv = minionInventory.filter(m => m.type !== 'goblinFarmer');
    const aliveInv = nonFarmerInv.filter(m => m.alive !== false);
    const deadInv  = nonFarmerInv.filter(m => m.alive === false);
    function makeGroups(arr) {
      const g = {};
      for (const m of arr) {
        const k = m.type+'_'+m.level;
        if (!g[k]) g[k] = { type:m.type, level:m.level, count:0 };
        g[k].count++;
      }
      return Object.values(g);
    }
    const aliveGrps = makeGroups(aliveInv);
    const deadGrps  = makeGroups(deadInv);

    let iy = SY + 76;
    // ALIVE section
    iy += 20; // header
    if (aliveGrps.length === 0) { iy += 20; }
    else {
      for (const grp of aliveGrps) {
        const bx=SX+SW-96, by=iy+16;
        if (inR(mx,smy, bx,by, 80,32)) {
          const placeKey='minion_'+grp.type;
          if (placeMode===placeKey) { placeMode=null; }
          else { placeMode=placeKey; invOpen=false; }
          return;
        }
        iy += 78;
      }
    }
    // DEAD section
    iy += 9; // divider
    iy += 16; // header
    if (deadGrps.length === 0) { iy += 20; }
    else {
      for (const grp of deadGrps) {
        const bx=SX+SW-96, by=iy+16;
        if (inR(mx,smy, bx,by, 80,32)) {
          const placeKey='minion_'+grp.type;
          if (placeMode===placeKey) { placeMode=null; }
          else { placeMode=placeKey; invOpen=false; }
          return;
        }
        iy += 78;
      }
    }
    // PLACED section — no buttons (interact via dungeon click)
  }

  // Dungeon tab
  if (invTab==='dungeon') {
    let iy = SY + 76;
    iy += 20; // section header

    // Corridor PLACE button
    {
      if (corridorInventory > 0) {
        const bx=SX+SW-96, by=iy+2;
        if (inR(mx,smy, bx,by, 80,32)) {
          if (placeMode==='corridor') { placeMode=null; }
          else { placeMode='corridor'; invOpen=false; }
          return;
        }
      }
      iy += 40;
    }

    // Room PLACE button
    {
      if (dungeonRoomInventory > 0) {
        const bx=SX+SW-96, by=iy+2;
        if (inR(mx,smy, bx,by, 80,32)) {
          if (placeMode==='dungeonRoom') { placeMode=null; }
          else { placeMode='dungeonRoom'; invOpen=false; }
          return;
        }
      }
      iy += 40;
    }

    iy += 9; // divider
    iy += 18; // corridor section header
    if (worldCorridors.length === 0) { iy += 18; }
    else {
      for (const c of worldCorridors) {
        const canRemove = c.toRoomId === null && !playerOnCorridor(c) && corridorIsEmpty(c);
        if (canRemove) {
          const bx=SX+SW-80, by=iy+2;
          if (inR(mx,smy, bx,by, 68,24)) {
            removeCorridorFromWorld(c);
            return;
          }
        }
        iy += 32;
      }
    }

    iy += 9; // divider
    iy += 18; // rooms section header
    const extraRooms = worldRooms.filter(r => r.id !== 0);
    for (const r of extraRooms) {
      const inside = playerInRoom(r);
      const empty  = roomIsEmpty(r);
      if (!inside && empty) {
        const bx=SX+SW-80, by=iy+2;
        if (inR(mx,smy, bx,by, 68,24)) {
          removeRoomFromWorld(r);
          return;
        }
      }
      iy += 32;
    }
  }
}

// ── Minion logic ──────────────────────────────────────────────
function killMinion(m) {
  m.alive = false;
  m.hp = 0;
  m.target = null;
  if (m.type === 'mimic') {
    for (const a of adventurers) { if (a.luredByMimic === m) { a.luredByMimic = null; a.path = null; } }
    m.luredAdv = null;
  }
  m.respawnTimer = MINION_TYPES[m.type].respawnTime;
  const _kbx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
  const _kby = m.type === 'giantSpider' ? m.y+40 : m.y+16;
  burst(_kbx, _kby, ['#44ff44','#ffff44','#ffffff'], 8);
  showMsg(MINION_TYPES[m.type].name + ' defeated!  Respawning in ' + MINION_TYPES[m.type].respawnTime + 's...');
}

function updateMinions(dt) {
  for (const m of placedMinions) {
    if (!m.alive) {
      m.respawnTimer -= dt;
      if (m.respawnTimer <= 0) {
        const stats = MINION_TYPES[m.type].statsAtLevel(m.level);
        m.x = m.homeX; m.y = m.homeY; // snap back to placed tile
        m.hp = stats.hp; m.maxHp = stats.hp;
        m.atkCd = 0; m.webCd = 0; m.arrowCd = 0; m.fireCd = 0; m.leapCd = 0; m.foodAccum = 0; m.alive = true; m.target = null; m.combatTimer = 0;
        if (m.type === 'mimic') { m.mimicForm = 'chest'; m.luredAdv = null; }
        const _rbx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
        const _rby = m.type === 'giantSpider' ? m.y+40 : m.y+16;
        burst(_rbx, _rby, ['#44ff44','#88ff88','#ffffff'], 6);
        showMsg(MINION_TYPES[m.type].name + ' respawned!');
      }
      continue;
    }
    m.bobPhase += dt * 3;
    if (m.flash > 0)    m.flash    -= dt;
    if (m.atkCd > 0)    m.atkCd    -= dt;
    if (m.webCd > 0)    m.webCd    -= dt;
    if (m.arrowCd > 0)  m.arrowCd  -= dt;
    if (m.fireCd > 0)   m.fireCd   -= dt;
    if (m.leapCd > 0)   m.leapCd   -= dt;
    if (m.combatTimer > 0) m.combatTimer -= dt;
    else if (m.hp < m.maxHp && !heartCarried) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.015 * dt);

    // goblinFarmer: food generation — runs in build and combat
    if (m.type === 'goblinFarmer') {
      const gfGen = MINION_TYPES.goblinFarmer.foodGenAtLevel(m.level);
      m.foodAccum = (m.foodAccum || 0) + gfGen / 60 * dt;
      if (m.foodAccum >= 1) { food += Math.floor(m.foodAccum); m.foodAccum -= Math.floor(m.foodAccum); }
      // Always drift back to home soil tile
      const gfhx = m.homeX - m.x, gfhy = m.homeY - m.y;
      const gfhd = Math.hypot(gfhx, gfhy);
      if (gfhd > 2) {
        const gfSpd = MINION_TYPES.goblinFarmer.statsAtLevel(m.level).speed;
        const gfnx = (gfhx/gfhd)*gfSpd*dt, gfny = (gfhy/gfhd)*gfSpd*dt;
        if (canMoveAdv(m.x+gfnx, m.y)) m.x += gfnx;
        if (canMoveAdv(m.x, m.y+gfny) && m.y+gfny >= TILE) m.y += gfny;
      }
      // Flee from adventurers during combat
      if (gameState === 'combat') {
        let nearestAdv = null, nearestAdvDist = TILE * 5;
        for (const a of adventurers) {
          if (!a.alive || !a.enteredDungeon) continue;
          const d = Math.hypot((a.x+16)-(m.x+16), (a.y+16)-(m.y+16));
          if (d < nearestAdvDist) { nearestAdvDist = d; nearestAdv = a; }
        }
        if (nearestAdv) {
          const fdx = (m.x+16)-(nearestAdv.x+16), fdy = (m.y+16)-(nearestAdv.y+16);
          const flen = Math.hypot(fdx, fdy) || 1;
          const gfSpd = MINION_TYPES.goblinFarmer.statsAtLevel(m.level).speed;
          const fnx = (fdx/flen)*gfSpd*dt, fny = (fdy/flen)*gfSpd*dt;
          if (canMoveAdv(m.x+fnx, m.y)) m.x += fnx;
          if (canMoveAdv(m.x, m.y+fny) && m.y+fny >= TILE) m.y += fny;
        }
      }
      m.target = null;
      continue;
    }

    if (gameState !== 'combat') {
      // Return to home in build mode
      const hdx = m.homeX - m.x, hdy = m.homeY - m.y;
      const hdist = Math.hypot(hdx, hdy);
      if (hdist > 2) {
        const spd = MINION_TYPES[m.type].statsAtLevel(m.level).speed;
        const nx = (hdx/hdist)*spd*dt, ny = (hdy/hdist)*spd*dt;
        if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
        if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
      }
      m.target = null;
      continue;
    }

    const stats = MINION_TYPES[m.type].statsAtLevel(m.level);
    const _mhx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
    const _mhy = m.type === 'giantSpider' ? m.y+40 : m.y+16;
    const mSpeedMult = inHeavensWake(_mhx, _mhy) ? 0.5 : 1.0;

    // ── Mimic logic ──────────────────────────────────────────────
    if (m.type === 'mimic') {
      if (m.mimicForm === 'chest') {
        // Lure adventurers within lureRange that aren't aggro'd or already lured
        for (const a of adventurers) {
          if (!a.alive || !a.enteredDungeon) continue;
          if (a.luredByMimic || a.aggroTimer > 0 || a.fleeTimer > 0) continue;
          const d = Math.hypot((a.x+16)-(m.x+16), (a.y+16)-(m.y+16));
          if (d <= stats.lureRange) {
            a.luredByMimic = m;
            a.path = null; // force repath toward mimic
          }
        }
        // Check if any lured adventurer is close enough to "open" the chest
        let triggered = false;
        for (const a of adventurers) {
          if (!a.alive || a.luredByMimic !== m) continue;
          const d = Math.hypot((a.x+16)-(m.x+16), (a.y+16)-(m.y+16));
          if (d <= 44) {
            triggered = true;
            m.luredAdv = a;
            break;
          }
        }
        if (triggered) {
          m.mimicForm = 'monster';
          m.combatTimer = 8;
          showTopMsg('MIMIC! The chest was a trap!');
          burst(m.x+16, m.y+16, ['#f0c030','#ff4400','#ffee88','#ffffff'], 12);
          // Release lure on all adventurers lured to this mimic
          for (const a of adventurers) { if (a.luredByMimic === m) { a.luredByMimic = null; a.path = null; } }
        }
      } else {
        // Monster form: attack luredAdv or nearest in detectRng
        m.combatTimer = Math.max(m.combatTimer, 0);
        let target = m.luredAdv && m.luredAdv.alive ? m.luredAdv : null;
        if (!target) {
          let bd = stats.detectRng;
          for (const a of adventurers) {
            if (!a.alive || !a.enteredDungeon) continue;
            const d = Math.hypot((a.x+16)-(m.x+16), (a.y+16)-(m.y+16));
            if (d < bd) { bd = d; target = a; }
          }
        }
        m.target = target;
        if (target) {
          const dx = (target.x+16)-(m.x+16), dy = (target.y+16)-(m.y+16);
          const dist = Math.hypot(dx, dy) || 1;
          if (dist > 36) {
            const nx = (dx/dist)*stats.speed*mSpeedMult*dt, ny = (dy/dist)*stats.speed*mSpeedMult*dt;
            if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
            if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
          }
          if (dist <= 44 && m.atkCd <= 0) {
            target.hp -= stats.atk;
            target.flash = 0.12;
            m.atkCd = stats.atkCdMax;
            m.combatTimer = 8;
            if (target.cls === 'warrior' || target.cls === 'ranger' || target.cls === 'rogue') {
              target.aggroTimer = 6; target.aggroTarget = 'minion'; target.aggroMinion = m; target.path = null;
            }
            if (target.cls === 'cleric') { target.fleeing = true; target.fleeTimer = 3.0; target.fleeFromX = m.x+16; target.fleeFromY = m.y+16; target.path = null; }
            const kl = dist || 1;
            target.kbX = (dx/kl)*70; target.kbY = (dy/kl)*70;
            burst(target.x+16, target.y+16, ['#f0c030','#aa6600','#ffee44'], 5);
            if (target.hp <= 0) killAdventurer(target);
          }
        } else {
          // No targets — revert to chest form
          m.mimicForm = 'chest';
          m.luredAdv = null;
          m.target = null;
          // Return to home
          const hdx = m.homeX - m.x, hdy = m.homeY - m.y;
          const hdist = Math.hypot(hdx, hdy);
          if (hdist > 2) {
            const nx = (hdx/hdist)*stats.speed*mSpeedMult*dt, ny = (hdy/hdist)*stats.speed*mSpeedMult*dt;
            if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
            if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
          }
        }
      }
      continue;
    }

    // Find nearest adventurer inside the dungeon within detection range
    const mcx = m.type === 'giantSpider' ? m.x+40 : m.x+16;
    const mcy = m.type === 'giantSpider' ? m.y+40 : m.y+16;
    const mDetectRng = m.type === 'giantSpider' ? Math.max(stats.detectRng, TILE * 8) : stats.detectRng;
    let bestAdv = null, bestDist = mDetectRng;
    for (const a of adventurers) {
      if (!a.alive || !a.enteredDungeon) continue;
      const d = Math.hypot((a.x+16)-mcx, (a.y+16)-mcy);
      if (d < bestDist) { bestDist = d; bestAdv = a; }
    }
    m.target = bestAdv;

    if (bestAdv) {
      const dx = (bestAdv.x+16)-mcx, dy = (bestAdv.y+16)-mcy;
      const dist = Math.hypot(dx, dy) || 1;

      if (m.type === 'giantSpider') {
        const BITE_RANGE = TILE;      // 1 tile = 40px
        const WEB_RANGE  = TILE * 8;  // 8 tiles = 320px
        if (dist <= BITE_RANGE) {
          // Priority 1: Bite
          if (m.atkCd <= 0) {
            bestAdv.hp -= stats.atk;
            bestAdv.flash = 0.12;
            m.atkCd = stats.atkCdMax;
            m.combatTimer = 5;
            if (bestAdv.cls === 'warrior' || bestAdv.cls === 'ranger' || bestAdv.cls === 'rogue') {
              bestAdv.aggroTimer = 6; bestAdv.aggroTarget = 'minion'; bestAdv.aggroMinion = m; bestAdv.path = null;
            }
            if (bestAdv.cls === 'cleric') { bestAdv.fleeing = true; bestAdv.fleeTimer = 3.0; bestAdv.fleeFromX = mcx; bestAdv.fleeFromY = mcy; bestAdv.path = null; }
            const kl = dist || 1;
            bestAdv.kbX = (dx/kl)*80; bestAdv.kbY = (dy/kl)*80;
            burst(bestAdv.x+16, bestAdv.y+16, ['#886633','#553311','#cc9955'], 5);
            if (bestAdv.hp <= 0) killAdventurer(bestAdv);
          }
        } else if (dist <= WEB_RANGE && m.webCd <= 0) {
          // Priority 2: Web shot
          projectiles.push({
            x: mcx, y: mcy,
            vx: (dx/dist)*110, vy: (dy/dist)*110,
            dmg: 0, life: 5.0, owner: 'minion_web',
          });
          m.webCd = stats.webCdMax;
          burst(mcx, mcy, ['#aaaaaa','#bbbbbb','#888888'], 3);
        } else {
          // Priority 3: Move straight toward target
          const nx = (dx/dist)*stats.speed*mSpeedMult*dt, ny = (dy/dist)*stats.speed*mSpeedMult*dt;
          if (canMoveAdv2x2(m.x+nx, m.y)) m.x += nx;
          if (canMoveAdv2x2(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
        }
      } else if (m.type === 'goblinWarrior') {
        if (dist > 36) {
          const nx = (dx/dist)*stats.speed*mSpeedMult*dt, ny = (dy/dist)*stats.speed*mSpeedMult*dt;
          if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
          if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
        }
        if (dist <= 44 && m.atkCd <= 0) {
          bestAdv.hp -= stats.atk;
          bestAdv.flash = 0.12;
          m.atkCd = stats.atkCdMax;
          m.combatTimer = 5;
          if (bestAdv.cls === 'warrior' || bestAdv.cls === 'ranger' || bestAdv.cls === 'rogue') {
            bestAdv.aggroTimer = 6; bestAdv.aggroTarget = 'minion'; bestAdv.aggroMinion = m; bestAdv.path = null;
          }
          if (bestAdv.cls === 'cleric') { bestAdv.fleeing = true; bestAdv.fleeTimer = 3.0; bestAdv.fleeFromX = m.x+16; bestAdv.fleeFromY = m.y+16; bestAdv.path = null; }
          const kl = dist || 1;
          bestAdv.kbX = (dx/kl)*55; bestAdv.kbY = (dy/kl)*55;
          burst(bestAdv.x+16, bestAdv.y+16, ['#aaaacc','#8888bb','#ffffff'], 4);
          if (bestAdv.hp <= 0) killAdventurer(bestAdv);
        }
      } else if (m.type === 'goblinArcher') {
        // Leap away if enemy on same tile
        if (dist <= TILE && m.leapCd <= 0) {
          const awayX = -(dx/dist) * TILE * 2, awayY = -(dy/dist) * TILE * 2;
          const lnx = m.x + awayX, lny = m.y + awayY;
          if (canMoveAdv(lnx, lny) && lny >= TILE) { m.x = lnx; m.y = lny; }
          m.leapCd = 1.5;
          burst(m.x+16, m.y+16, ['#88ff44','#44cc22'], 4);
        }
        // Back away when enemy is within 3 tiles
        if (dist < TILE * 3) {
          const nx = -(dx/dist)*stats.speed*mSpeedMult*dt, ny = -(dy/dist)*stats.speed*mSpeedMult*dt;
          if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
          if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
        }
        // Shoot poison arrow
        if (dist <= stats.detectRng && m.arrowCd <= 0) {
          projectiles.push({
            x: mcx, y: mcy,
            vx: (dx/dist)*200, vy: (dy/dist)*200,
            dmg: stats.atk, life: 5.0, owner: 'minion_goblinArrow', minionRef: m,
          });
          m.arrowCd = 2.0 + Math.random() * 1.0;
          m.combatTimer = 5;
          burst(mcx, mcy, ['#88cc44','#44aa22'], 2);
        }
      } else if (m.type === 'goblinMage') {
        // Back away if too close
        if (dist < TILE * 3) {
          const nx = -(dx/dist)*stats.speed*mSpeedMult*dt, ny = -(dy/dist)*stats.speed*mSpeedMult*dt;
          if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
          if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
        }
        // Shoot firebolt
        if (dist <= stats.detectRng && m.fireCd <= 0) {
          projectiles.push({
            x: mcx, y: mcy,
            vx: (dx/dist)*180, vy: (dy/dist)*180,
            dmg: stats.atk, life: 6.0, owner: 'minion_goblinFirebolt', minionRef: m,
          });
          m.fireCd = stats.atkCdMax;
          m.combatTimer = 5;
          burst(mcx, mcy, ['#aa44ff','#7722cc','#dd88ff'], 4);
        }
      } else {
        // Generic (goblin, skeleton): chase + melee
        if (dist > 36) {
          const nx = (dx/dist)*stats.speed*mSpeedMult*dt, ny = (dy/dist)*stats.speed*mSpeedMult*dt;
          if (canMoveAdv(m.x+nx, m.y)) m.x += nx;
          if (canMoveAdv(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
        }
        if (dist <= 44 && m.atkCd <= 0) {
          bestAdv.hp -= stats.atk;
          bestAdv.flash = 0.12;
          m.atkCd = stats.atkCdMax;
          m.combatTimer = 5;
          if (bestAdv.cls === 'warrior' || bestAdv.cls === 'ranger' || bestAdv.cls === 'rogue') {
            bestAdv.aggroTimer = 6; bestAdv.aggroTarget = 'minion'; bestAdv.aggroMinion = m; bestAdv.path = null;
          }
          if (bestAdv.cls === 'cleric') { bestAdv.fleeing = true; bestAdv.fleeTimer = 3.0; bestAdv.fleeFromX = m.x+16; bestAdv.fleeFromY = m.y+16; bestAdv.path = null; }
          const kl = dist || 1;
          bestAdv.kbX = (dx/kl)*65; bestAdv.kbY = (dy/kl)*65;
          burst(bestAdv.x+16, bestAdv.y+16, ['#44ff44','#22aa22','#aaffaa'], 3);
          if (bestAdv.hp <= 0) killAdventurer(bestAdv);
        }
      }
    } else {
      // No target — return to home tile
      const hdx = m.homeX - m.x, hdy = m.homeY - m.y;
      const hdist = Math.hypot(hdx, hdy);
      if (hdist > 2) {
        const nx = (hdx/hdist)*stats.speed*mSpeedMult*dt, ny = (hdy/hdist)*stats.speed*mSpeedMult*dt;
        const moveFn = m.type === 'giantSpider' ? canMoveAdv2x2 : canMoveAdv;
        if (moveFn(m.x+nx, m.y)) m.x += nx;
        if (moveFn(m.x, m.y+ny) && m.y+ny >= TILE) m.y += ny;
      }
    }
  }
}

// ── Minion drawing ────────────────────────────────────────────
function drawMinions() {
  for (const m of placedMinions) {
    const cfg = MINION_TYPES[m.type];
    const msr = MINION_SPRS[m.type] || MINION_SPRS.mimicChest;
    if (!m.alive) {
      // Ghost + respawn countdown
      const pct = 1 - m.respawnTimer / cfg.respawnTime;
      ctx.globalAlpha = 0.2 + pct * 0.25;
      if (m.type === 'giantSpider') sprS(msr.s, msr.c, m.x, m.y, 5);
      else spr(msr.s, msr.c, m.x, m.y);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#88ff88'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(m.respawnTimer)+'s', m.type === 'giantSpider' ? m.x+40 : m.x+16, m.y-3);
      ctx.textAlign = 'left';
      continue;
    }
    // Mimic: chest form has no bob; monster form is normal
    if (m.type === 'mimic') {
      if (m.mimicForm === 'chest') {
        const dx = Math.round(m.x), dy = Math.round(m.y);
        spr(MINION_SPRS.mimicChest.s, m.flash > 0 ? AHIT : MINION_SPRS.mimicChest.c, dx, dy);
        // Gold lure aura pulse
        if (gameState === 'combat') {
          const pulse = 0.08 + Math.abs(Math.sin(m.bobPhase * 0.8)) * 0.12;
          ctx.globalAlpha = pulse;
          const stats2 = cfg.statsAtLevel(m.level);
          ctx.strokeStyle = '#f0c030'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(dx+16, dy+16, stats2.lureRange, 0, Math.PI*2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // HP bar
        const hpR = m.hp / m.maxHp;
        ctx.fillStyle = '#111'; ctx.fillRect(dx, dy-8, 32, 5);
        ctx.fillStyle = hpR > 0.5 ? '#44ff44' : (hpR > 0.25 ? '#ffaa00' : '#ff2222');
        ctx.fillRect(dx, dy-8, 32*hpR, 5);
        ctx.fillStyle = cfg.color; ctx.fillRect(dx, dy-16, 18, 8);
        ctx.fillStyle = '#110a00'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillText('L'+m.level, dx+9, dy-9);
        ctx.textAlign = 'left';
        continue;
      }
      // Monster form — falls through to normal draw below with monster sprite
    }
    const msprKey = (m.type === 'mimic') ? 'mimic' : m.type;
    const msprDraw = MINION_SPRS[msprKey];
    const bob = Math.abs(Math.sin(m.bobPhase)) * 1.5;
    const dx = Math.round(m.x), dy = Math.round(m.y - bob);
    if (m.type === 'giantSpider') {
      // 2×2 spider: 16×16 sprite at scale 5 = 80×80px
      ctx.fillStyle = '#00000055'; ctx.fillRect(dx+4, m.y+74, 72, Math.max(2, 4-bob));
      sprS(msprDraw.s, m.flash > 0 ? AHIT : msprDraw.c, dx, dy, 5);
      const hp = m.hp / m.maxHp;
      ctx.fillStyle = '#111'; ctx.fillRect(dx, dy-8, 80, 5);
      ctx.fillStyle = hp > 0.5 ? '#44ff44' : (hp > 0.25 ? '#ffaa00' : '#ff2222');
      ctx.fillRect(dx, dy-8, 80*hp, 5);
      ctx.fillStyle = cfg.color; ctx.fillRect(dx, dy-16, 18, 8);
      ctx.fillStyle = '#001100'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('L'+m.level, dx+9, dy-9);
      if (!m.target && gameState === 'combat') {
        ctx.strokeStyle = cfg.color + '33'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(dx+40, dy+40, TILE * 8, 0, Math.PI*2); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#00000055'; ctx.fillRect(dx+3, m.y+28, 26, Math.max(2, 4-bob));
      spr(msprDraw.s, m.flash > 0 ? AHIT : msprDraw.c, dx, dy);
      const hp = m.hp / m.maxHp;
      ctx.fillStyle = '#111'; ctx.fillRect(dx, dy-8, 32, 5);
      ctx.fillStyle = hp > 0.5 ? '#44ff44' : (hp > 0.25 ? '#ffaa00' : '#ff2222');
      ctx.fillRect(dx, dy-8, 32*hp, 5);
      ctx.fillStyle = cfg.color; ctx.fillRect(dx, dy-16, 18, 8);
      ctx.fillStyle = '#001100'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('L'+m.level, dx+9, dy-9);
      if (!m.target && gameState === 'combat') {
        const stats = cfg.statsAtLevel(m.level);
        ctx.strokeStyle = cfg.color + '33'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(dx+16, dy+16, stats.detectRng, 0, Math.PI*2); ctx.stroke();
      }
    }
    ctx.textAlign = 'left';
  }
}

// ── Minion context popup ──────────────────────────────────────
function minionPopupPos(m) {
  const pw = 172, ph = 108;
  const sx = (m.gx*TILE - cam.wx) * cam.zoom;
  const sy = (m.gy*TILE - cam.wy) * cam.zoom;
  let px = sx + TILE*cam.zoom + 4, py = sy - 10;
  if (px + pw > DW - 4) px = sx - pw - 4;
  if (py + ph > CH - 4) py = CH - ph - 4;
  if (py < 4) py = 4;
  return { px, py, pw, ph };
}

function drawMinionContext() {
  const m = minionContext;
  const cfg = MINION_TYPES[m.type];
  const { px, py, pw, ph } = minionPopupPos(m);
  const stats = cfg.statsAtLevel(m.level);

  ctx.fillStyle = '#001800'; ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle = '#44aa22'; ctx.lineWidth = 2; ctx.strokeRect(px,py,pw,ph);

  ctx.fillStyle = '#88ff44'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'left';
  ctx.fillText(cfg.name+' Lv'+m.level, px+8, py+14);
  ctx.fillStyle = '#668844'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('HP:'+(m.alive?m.hp:0)+'/'+stats.hp+'  ATK:'+stats.atk, px+8, py+26);
  ctx.fillStyle = '#446644';
  if (m.type === 'goblinFarmer') {
    const gfGen = MINION_TYPES.goblinFarmer.foodGenAtLevel(m.level);
    ctx.fillText('Gen: +'+gfGen+'/min  No upkeep', px+8, py+38);
  } else {
    ctx.fillText('Food: '+(m.level*cfg.foodPerLevel)+'/min  Detect:'+stats.detectRng+'px', px+8, py+38);
  }

  // UPGRADE button
  const upgCost = cfg.upgradeFoodCost(m.level);
  const canUpg = food >= upgCost;
  const upgHov = inR(mouse.x,mouse.y, px+6,py+48, pw-12,22);
  ctx.fillStyle = canUpg ? (upgHov?'#1a3300':'#112200') : '#080d00';
  ctx.fillRect(px+6,py+48,pw-12,22);
  ctx.strokeStyle = canUpg ? '#44aa22' : '#223311'; ctx.lineWidth = 1;
  ctx.strokeRect(px+6,py+48,pw-12,22);
  ctx.fillStyle = canUpg ? '#88ff44' : '#334422';
  ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText('UPGRADE ('+upgCost+' food)', px+pw/2, py+62);

  // PICK UP button
  const puHov = inR(mouse.x,mouse.y, px+6,py+76, pw-12,22);
  ctx.fillStyle = puHov ? '#1a2200' : '#0f1800';
  ctx.fillRect(px+6,py+76,pw-12,22);
  ctx.strokeStyle = '#446622'; ctx.lineWidth = 1; ctx.strokeRect(px+6,py+76,pw-12,22);
  ctx.fillStyle = '#88aa55'; ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText('PICK UP', px+pw/2, py+90);

  // Close X
  const clX = px+pw-18, clY = py+4;
  ctx.fillStyle = '#001100'; ctx.fillRect(clX,clY,14,14);
  ctx.strokeStyle = '#44ff44'; ctx.lineWidth = 1; ctx.strokeRect(clX,clY,14,14);
  ctx.fillStyle = '#44ff44'; ctx.fillText('X', clX+7, clY+10);
  ctx.textAlign = 'left';
}

function minionContextClick(mx, my) {
  const m = minionContext;
  const cfg = MINION_TYPES[m.type];
  const { px, py, pw, ph } = minionPopupPos(m);

  if (inR(mx,my, px+pw-18,py+4, 14,14)) { minionContext = null; return; }

  // Upgrade
  if (inR(mx,my, px+6,py+48, pw-12,22)) {
    const upgCost = cfg.upgradeFoodCost(m.level);
    if (food >= upgCost) {
      food -= upgCost;
      m.level++;
      const stats = cfg.statsAtLevel(m.level);
      m.maxHp = stats.hp; m.hp = stats.hp; // full heal on upgrade
      m.atkCdMax = stats.atkCdMax;
      showMsg(cfg.name+' upgraded to Lv'+m.level+'!');
    } else showMsg('Need '+upgCost+' food to upgrade!');
    return;
  }

  // Pick up
  if (inR(mx,my, px+6,py+76, pw-12,22)) {
    placedMinions.splice(placedMinions.indexOf(m), 1);
    const stats = cfg.statsAtLevel(m.level);
    if (m.alive) {
      m.hp = stats.hp; m.maxHp = stats.hp; m.respawnTimer = 0;
    } else {
      m.respawnTimer = cfg.respawnTime; // reset to full for re-placement
    }
    minionInventory.push(m);
    minionContext = null;
    showMsg(cfg.name+' picked up!');
    return;
  }

  if (!inR(mx,my, px,py, pw,ph)) minionContext = null;
}

// ── Minion tooltip panel (shared by shop + inventory) ─────────
function drawMinionTooltip(key, level) {
  const cfg  = MINION_TYPES[key];
  const msr  = MINION_SPRS[key];
  const stats = cfg.statsAtLevel(level);
  const col  = cfg.accentColor || cfg.color;
  const TTX  = SX + SW + 8;
  const TTW  = CW - TTX - 8;
  const TTY  = SY - 10;
  const TTH  = SH + 20;
  const mid  = TTX + TTW / 2;
  const PAD  = 10;

  ctx.fillStyle = '#040209';
  ctx.fillRect(TTX, TTY, TTW, TTH);
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.strokeRect(TTX, TTY, TTW, TTH);
  ctx.strokeStyle = col+'33'; ctx.lineWidth = 1;
  ctx.strokeRect(TTX+3, TTY+3, TTW-6, TTH-6);
  ctx.fillStyle = col+'22';
  ctx.fillRect(TTX+2, TTY+2, TTW-4, 36);

  ctx.save();
  ctx.beginPath(); ctx.rect(TTX+4, TTY+4, TTW-8, TTH-8); ctx.clip();

  // Sprite
  sprS(msr.s, msr.c, TTX + TTW/2 - 16, TTY + 6, 4);

  // Name (word-wrapped, centered below sprite)
  let cy = TTY + 44;
  ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillStyle = col;
  const nameWords = cfg.name.split(' ');
  let nameLine = '';
  for (const w of nameWords) {
    const test = nameLine + (nameLine ? ' ' : '') + w;
    if (ctx.measureText(test).width > TTW - PAD*2) {
      ctx.fillText(nameLine, mid, cy); nameLine = w; cy += 10;
    } else { nameLine = test; }
  }
  ctx.fillText(nameLine, mid, cy); cy += 12;

  // Role badge
  const ROLES = {
    skeleton:     ['UNDEAD',  '#18183a', '#8888cc'],
    goblin:       ['MELEE',   '#0e2010', '#55cc66'],
    goblinFarmer: ['FARMER',  '#241c00', '#ccaa22'],
    goblinWarrior:['TANK',    '#12122e', '#6699dd'],
    goblinArcher: ['RANGED',  '#0a200a', '#44cc44'],
    goblinMage:   ['MAGE',    '#180a28', '#bb66ff'],
    giantSpider:  ['AMBUSH',  '#181810', '#aaaa44'],
    mimic:        ['LURE',    '#281600', '#ffaa22'],
  };
  const [roleLabel, roleBg, roleFg] = ROLES[key] || ['MINION','#111','#aaa'];
  const bw = 58, bh = 13;
  ctx.fillStyle = roleBg; ctx.fillRect(mid-bw/2, cy-10, bw, bh);
  ctx.strokeStyle = roleFg; ctx.lineWidth = 1; ctx.strokeRect(mid-bw/2, cy-10, bw, bh);
  ctx.font = '5px "Press Start 2P"'; ctx.fillStyle = roleFg;
  ctx.fillText(roleLabel, mid, cy-1); cy += 8;

  // Divider
  ctx.fillStyle = col+'55'; ctx.fillRect(TTX+PAD, cy, TTW-PAD*2, 1); cy += 8;

  // Stats
  ctx.textAlign = 'left'; ctx.font = '5px "Press Start 2P"';
  const sx2 = TTX + PAD;
  ctx.fillStyle = '#88ff88'; ctx.fillText('HP:  ' + stats.hp, sx2, cy); cy += 9;
  if (stats.atk  > 0) { ctx.fillStyle = '#ff9966'; ctx.fillText('ATK: ' + stats.atk,   sx2, cy); cy += 9; }
  if (stats.def  > 0) { ctx.fillStyle = '#88aaff'; ctx.fillText('DEF: ' + stats.def,   sx2, cy); cy += 9; }
  ctx.fillStyle = '#88ddff'; ctx.fillText('SPD: ' + stats.speed, sx2, cy); cy += 9;
  if (stats.detectRng > 0) { ctx.fillStyle = '#ddcc88'; ctx.fillText('RNG: ' + stats.detectRng + 'px', sx2, cy); cy += 9; }

  // Divider
  cy += 2; ctx.fillStyle = col+'55'; ctx.fillRect(TTX+PAD, cy, TTW-PAD*2, 1); cy += 9;

  // Bullet tips
  // Tips derived from cfg so they stay in sync with any stat changes
  const TIPS = {
    skeleton:     cfg => ['Very fragile — best used in large numbers.','Attacks any adventurer in range on sight.',`${cfg.respawnTime} second respawn.`],
    goblin:       cfg => ['Fast melee fighter. Low HP but quick.','Attacks on sight.','Goblin race players get 50% off.',`${cfg.respawnTime} second respawn.`],
    goblinFarmer: cfg => ['Must be placed on a Soil tile.',`Generates +${cfg.foodGenAtLevel(1)} food/min at level 1, scaling per level.`,'Does not attack — runs from danger.','No food upkeep cost.',`${cfg.respawnTime} second respawn.`],
    goblinWarrior:cfg => ['Frontline tank with high HP and armor.','DEF stat reduces damage from each hit.','Slow but soaks a lot of punishment.','Goblin race players get 50% off.',`${cfg.respawnTime} second respawn.`],
    goblinArcher: cfg => ['Fires poison arrows every 2–3 seconds.','Poison deals damage over time.','Leaps away when enemies get too close.','Goblin race players get 50% off.',`${cfg.respawnTime} second respawn.`],
    goblinMage:   cfg => ['Launches firebolts every 1.5 seconds.','Firebolt applies Burn: ongoing fire damage.','Backs away from nearby enemies.','Goblin race players get 50% off.',`${cfg.respawnTime} second respawn.`],
    giantSpider:  cfg => ['Bites enemies up close for direct damage.','Spits webs at distant enemies.','Web slows targets 50% for 3 seconds.',`${cfg.respawnTime} second respawn.`],
    mimic:        cfg => ['Disguises as a treasure chest.','Lures adventurers close before attacking.','Works great near traps or chokepoints.',`${cfg.respawnTime} second respawn.`],
  };
  const tips = TIPS[key] ? TIPS[key](cfg) : [];
  const lineW = TTW - PAD*2 - 9;
  const textX = TTX + PAD + 8;
  const dotX  = TTX + PAD;
  for (const tip of tips) {
    ctx.fillStyle = col; ctx.fillRect(dotX, cy-4, 4, 4);
    const words = tip.split(' ');
    let line = '', ty = cy, first = true;
    for (const w of words) {
      const test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > lineW) {
        ctx.fillStyle = first ? '#ddeeff' : '#99aabb';
        ctx.fillText(line, textX, ty); line = w; ty += 10; first = false;
      } else { line = test; }
    }
    ctx.fillStyle = first ? '#ddeeff' : '#99aabb';
    if (line) ctx.fillText(line, textX, ty);
    cy = ty + 13;
  }

  // Food footer
  cy += 2; ctx.fillStyle = col+'55'; ctx.fillRect(TTX+PAD, cy, TTW-PAD*2, 1); cy += 9;
  ctx.font = '5px "Press Start 2P"';
  if (key === 'goblinFarmer') {
    const gen = cfg.foodGenAtLevel(level);
    ctx.fillStyle = '#55dd88'; ctx.fillText('+'+gen+' food/min  No upkeep', TTX+PAD, cy);
  } else {
    const upkeep = level * cfg.foodPerLevel;
    ctx.fillStyle = upkeep === 0 ? '#99aa99' : '#ff9944';
    ctx.fillText('Food upkeep: '+(upkeep === 0 ? '0' : upkeep)+'/min', TTX+PAD, cy);
  }

  ctx.restore();
  ctx.textAlign = 'left';
}

// ── Inventory: Minions tab ────────────────────────────────────
function drawInventoryMinions() {
  let minionTip = null;
  const INV_VIEW_H = SH - 70;

  const nonFarmerInv = minionInventory.filter(m => m.type !== 'goblinFarmer');
  const aliveInv = nonFarmerInv.filter(m => m.alive !== false);
  const deadInv  = nonFarmerInv.filter(m => m.alive === false);

  function makeGroups(arr) {
    const g = {};
    for (const m of arr) {
      const k = m.type+'_'+m.level;
      if (!g[k]) g[k] = { type:m.type, level:m.level, count:0 };
      g[k].count++;
    }
    return Object.values(g);
  }
  const aliveGrps = makeGroups(aliveInv);
  const deadGrps  = makeGroups(deadInv);
  const shownPlaced = placedMinions.filter(m => m.type !== 'goblinFarmer');

  let _totalH = 20 + (aliveGrps.length === 0 ? 20 : aliveGrps.length * 78);
  _totalH += 9 + 16 + (deadGrps.length === 0 ? 20 : deadGrps.length * 78);
  _totalH += 9 + 16 + (shownPlaced.length === 0 ? 14 : shownPlaced.length * 14 + 14);

  invScrollY = Math.max(0, Math.min(Math.max(0, _totalH - INV_VIEW_H), invScrollY));
  const smy = (mouse.y >= SY+70 && mouse.y <= SY+SH) ? mouse.y + invScrollY : -9999;
  ctx.save();
  ctx.beginPath(); ctx.rect(SX+8, SY+70, SW-16, INV_VIEW_H); ctx.clip();
  ctx.translate(0, -invScrollY);
  let iy = SY + 76;

  function drawMinionRow(grp, isDead) {
    const cfg = MINION_TYPES[grp.type];
    const msr = MINION_SPRS[grp.type];
    const active = placeMode === 'minion_'+grp.type;
    const iHov = inR(mouse.x, smy, SX+8, iy, SW-16, 74);
    if (iHov) minionTip = { key: grp.type, level: grp.level };
    ctx.fillStyle = iHov ? (isDead?'#1a0800':'#111800') : (isDead?'#100500':'#0a1000');
    ctx.fillRect(SX+8, iy, SW-16, 74);
    ctx.strokeStyle = active ? cfg.accentColor : (isDead?'#331400':'#1a2800');
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(SX+8, iy, SW-16, 74);
    sprS(msr.s, msr.c, SX+16, iy+10, 3);
    ctx.fillStyle = isDead ? '#aa7755' : '#aaffaa'; ctx.font = '6px "Press Start 2P"';
    ctx.fillText(cfg.name+' Lv'+grp.level, SX+46, iy+20);
    ctx.fillStyle = '#668844'; ctx.font = '5px "Press Start 2P"';
    if (isDead) {
      ctx.fillStyle = '#cc4422'; ctx.fillText('DEAD — waiting to be placed', SX+46, iy+32);
    } else {
      ctx.fillText(cfg.effectDesc(grp.level), SX+46, iy+32);
      const stats = cfg.statsAtLevel(grp.level);
      ctx.fillStyle = '#88ff88'; ctx.fillText('HP: '+stats.hp+'/'+stats.hp, SX+46, iy+44);
    }
    const foodTotal = grp.level * cfg.foodPerLevel;
    ctx.fillStyle = foodTotal === 0 ? '#55dd88' : '#ff9944';
    ctx.fillText((foodTotal === 0 ? 'Food: Free' : 'Food: '+foodTotal+'/min')+'  x'+grp.count, SX+46, iy+56);
    const bx = SX+SW-96, by = iy+16;
    const bHov = inR(mouse.x, smy, bx, by, 80, 32);
    ctx.fillStyle = active ? (isDead?'#2a0800':'#1a2800') : (bHov ? (isDead?'#3a1000':'#2a3800') : (isDead?'#1a0500':'#141e00'));
    ctx.fillRect(bx, by, 80, 32);
    ctx.strokeStyle = active ? cfg.accentColor : (isDead?'#884422':'#446622'); ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, 80, 32);
    ctx.fillStyle = active ? cfg.accentColor : (isDead?'#ff8844':'#88cc44');
    ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
    ctx.fillText(active?'CANCEL':'PLACE', bx+40, by+20); ctx.textAlign = 'left';
    iy += 78;
  }

  // — Alive section —
  ctx.fillStyle = '#446633'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('ALIVE ('+aliveInv.length+'):', SX+12, iy+12); iy += 20;
  if (aliveGrps.length === 0) {
    ctx.fillStyle = '#334422'; ctx.fillText('None — buy minions from the shop', SX+12, iy+12); iy += 20;
  } else {
    for (const grp of aliveGrps) drawMinionRow(grp, false);
  }

  // — Dead section —
  ctx.fillStyle = '#2a3800'; ctx.fillRect(SX+8, iy, SW-16, 1); iy += 9;
  ctx.fillStyle = '#884422'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('DEAD ('+deadInv.length+'):', SX+12, iy+12); iy += 16;
  if (deadGrps.length === 0) {
    ctx.fillStyle = '#334422'; ctx.fillText('None', SX+12, iy+12); iy += 20;
  } else {
    for (const grp of deadGrps) drawMinionRow(grp, true);
  }

  // — Placed section —
  ctx.fillStyle = '#2a3800'; ctx.fillRect(SX+8, iy, SW-16, 1); iy += 9;
  ctx.fillStyle = '#446633'; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('PLACED ('+shownPlaced.length+'):', SX+12, iy+12); iy += 16;
  if (shownPlaced.length === 0) {
    ctx.fillStyle = '#334422'; ctx.fillText('None placed', SX+12, iy+12);
  } else {
    for (const m of shownPlaced) {
      const cfg = MINION_TYPES[m.type];
      const status = m.alive ? 'HP:'+m.hp+'/'+m.maxHp : 'DEAD Respawn:'+Math.ceil(m.respawnTimer)+'s';
      const foodCost = m.level * cfg.foodPerLevel;
      const foodTag = foodCost === 0 ? '  Food:Free' : '  Food:'+foodCost+'/m';
      ctx.fillStyle = m.alive?'#88cc88':'#aa6644'; ctx.font = '5px "Press Start 2P"';
      ctx.fillText(cfg.shortName+' Lv'+m.level+'  ('+m.gx+','+m.gy+')  '+status+foodTag, SX+12, iy+12);
      iy += 14;
    }
    ctx.fillStyle = '#443322'; ctx.font = '4px "Press Start 2P"';
    ctx.fillText('Click a minion in the dungeon to upgrade/pick up', SX+12, iy+12);
  }
  ctx.restore();
  if (_totalH > INV_VIEW_H) {
    const trackH=INV_VIEW_H-4, maxS=_totalH-INV_VIEW_H;
    const thumbH=Math.max(20,(_totalH>INV_VIEW_H?(INV_VIEW_H/_totalH)*trackH:trackH));
    const thumbY=SY+70+2+(invScrollY/maxS)*(trackH-thumbH);
    ctx.fillStyle='#1a2800'; ctx.fillRect(SX+SW-8,SY+70+2,5,trackH);
    ctx.fillStyle='#446633'; ctx.fillRect(SX+SW-8,thumbY,5,thumbH);
  }
  if (minionTip) drawMinionTooltip(minionTip.key, minionTip.level);
}

// ── Inventory: Dungeon tab ─────────────────────────────────────
function drawInventoryDungeon() {
  const col = '#44aacc';
  const INV_VIEW_H = SH - 70;
  const extraRooms = worldRooms.filter(r => r.id !== 0);
  let _totalH = 20 + 40 + 40 + 9 + 18 + (worldCorridors.length === 0 ? 18 : worldCorridors.length * 32);
  _totalH += 9 + 18 + (extraRooms.length === 0 ? 14 : extraRooms.length * 32);
  invScrollY = Math.max(0, Math.min(Math.max(0, _totalH - INV_VIEW_H), invScrollY));
  const smy = (mouse.y >= SY+70 && mouse.y <= SY+SH) ? mouse.y + invScrollY : -9999;
  ctx.save();
  ctx.beginPath(); ctx.rect(SX+8, SY+70, SW-16, INV_VIEW_H); ctx.clip();
  ctx.translate(0, -invScrollY);
  let iy = SY + 76;

  ctx.fillStyle = col; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('IN INVENTORY:', SX+12, iy+12); iy += 20;
  {
    const active = placeMode === 'corridor';
    const cnt = corridorInventory;
    const iHov = inR(mouse.x,smy, SX+8,iy, SW-16,36);
    ctx.fillStyle = iHov?'#0a1820':'#060e14'; ctx.fillRect(SX+8,iy,SW-16,36);
    ctx.strokeStyle = active?'#44aacc':'#1a3040'; ctx.lineWidth = active?2:1;
    ctx.strokeRect(SX+8,iy,SW-16,36);
    ctx.fillStyle = '#88ccee'; ctx.font = '6px "Press Start 2P"';
    ctx.fillText('CORRIDOR  x'+cnt, SX+14, iy+14);
    ctx.fillStyle = '#446677'; ctx.font = '5px "Press Start 2P"';
    ctx.fillText('5-tile wide passage between rooms', SX+14, iy+26);
    if (cnt > 0) {
      const bx = SX+SW-96, by = iy+2;
      const bHov = inR(mouse.x,smy, bx,by, 80,32);
      ctx.fillStyle = active?'#0a1828':(bHov?'#1a3040':'#0a1820');
      ctx.fillRect(bx,by,80,32);
      ctx.strokeStyle = active?'#44aacc':'#336688'; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,80,32);
      ctx.fillStyle = active?'#44aacc':'#88ccee'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(active?'CANCEL':'PLACE', bx+40, by+20); ctx.textAlign='left';
    }
    iy += 40;
  }
  {
    const active = placeMode === 'dungeonRoom';
    const cnt = dungeonRoomInventory;
    const iHov = inR(mouse.x,smy, SX+8,iy, SW-16,36);
    ctx.fillStyle = iHov?'#0a1820':'#060e14'; ctx.fillRect(SX+8,iy,SW-16,36);
    ctx.strokeStyle = active?'#44aacc':'#1a3040'; ctx.lineWidth = active?2:1;
    ctx.strokeRect(SX+8,iy,SW-16,36);
    ctx.fillStyle = '#88ccee'; ctx.font = '6px "Press Start 2P"';
    ctx.fillText('DUNGEON ROOM  x'+cnt, SX+14, iy+14);
    ctx.fillStyle = '#446677'; ctx.font = '5px "Press Start 2P"';
    ctx.fillText('15x15 room — place at corridor end', SX+14, iy+26);
    if (cnt > 0) {
      const bx = SX+SW-96, by = iy+2;
      const bHov = inR(mouse.x,smy, bx,by, 80,32);
      ctx.fillStyle = active?'#0a1828':(bHov?'#1a3040':'#0a1820');
      ctx.fillRect(bx,by,80,32);
      ctx.strokeStyle = active?'#44aacc':'#336688'; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,80,32);
      ctx.fillStyle = active?'#44aacc':'#88ccee'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(active?'CANCEL':'PLACE', bx+40, by+20); ctx.textAlign='left';
    }
    iy += 40;
  }
  ctx.fillStyle = '#1a3040'; ctx.fillRect(SX+8,iy,SW-16,1); iy += 9;
  ctx.fillStyle = col; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('CORRIDORS PLACED ('+worldCorridors.length+'):', SX+12, iy+12); iy += 18;
  if (worldCorridors.length === 0) {
    ctx.fillStyle = '#335566'; ctx.fillText('None placed', SX+12, iy+12); iy += 18;
  } else {
    for (const c of worldCorridors) {
      const connected = c.toRoomId !== null;
      const onIt = playerOnCorridor(c);
      const hasItems = !corridorIsEmpty(c);
      const canRemove = !connected && !onIt && !hasItems;
      const iHov = inR(mouse.x,smy, SX+8,iy, SW-16,28);
      ctx.fillStyle = iHov?'#0a1820':'#060e14'; ctx.fillRect(SX+8,iy,SW-16,28);
      ctx.strokeStyle = '#1a3040'; ctx.lineWidth=1; ctx.strokeRect(SX+8,iy,SW-16,28);
      ctx.fillStyle = '#88ccee'; ctx.font = '5px "Press Start 2P"';
      ctx.fillText('Corridor #'+c.id+' ('+c.dir+')', SX+14, iy+12);
      ctx.fillStyle = canRemove?'#668899':'#443333'; ctx.font = '4px "Press Start 2P"';
      const reason = connected?'Room attached':onIt?'You are on it':'Items placed inside';
      ctx.fillText(canRemove?'Empty — can remove':reason, SX+14, iy+22);
      if (canRemove) {
        const bx = SX+SW-80, by = iy+2;
        const bHov = inR(mouse.x,smy, bx,by, 68,24);
        ctx.fillStyle = bHov?'#3a0808':'#200505'; ctx.fillRect(bx,by,68,24);
        ctx.strokeStyle = '#cc4444'; ctx.lineWidth=1; ctx.strokeRect(bx,by,68,24);
        ctx.fillStyle = '#ff8888'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('REMOVE', bx+34, by+16); ctx.textAlign='left';
      }
      iy += 32;
    }
  }
  ctx.fillStyle = '#1a3040'; ctx.fillRect(SX+8,iy,SW-16,1); iy += 9;
  ctx.fillStyle = col; ctx.font = '5px "Press Start 2P"';
  ctx.fillText('ROOMS PLACED ('+extraRooms.length+'):', SX+12, iy+12); iy += 18;
  if (extraRooms.length === 0) {
    ctx.fillStyle = '#335566'; ctx.fillText('None placed', SX+12, iy+12);
  } else {
    for (const r of extraRooms) {
      const inside = playerInRoom(r);
      const empty  = roomIsEmpty(r);
      const canRemove = !inside && empty;
      const iHov = inR(mouse.x,smy, SX+8,iy, SW-16,28);
      ctx.fillStyle = iHov?'#0a1820':'#060e14'; ctx.fillRect(SX+8,iy,SW-16,28);
      ctx.strokeStyle = '#1a3040'; ctx.lineWidth=1; ctx.strokeRect(SX+8,iy,SW-16,28);
      ctx.fillStyle = '#88ccee'; ctx.font = '5px "Press Start 2P"';
      ctx.fillText('Room #'+r.id+'  ('+r.wx+','+r.wy+')', SX+14, iy+12);
      ctx.fillStyle = canRemove?'#668899':(inside?'#886622':'#664444');
      ctx.font = '4px "Press Start 2P"';
      const reason = inside?'You are inside':'Room not empty';
      ctx.fillText(canRemove?'Empty — can remove':reason, SX+14, iy+22);
      if (canRemove) {
        const bx = SX+SW-80, by = iy+2;
        const bHov = inR(mouse.x,smy, bx,by, 68,24);
        ctx.fillStyle = bHov?'#3a0808':'#200505'; ctx.fillRect(bx,by,68,24);
        ctx.strokeStyle = '#cc4444'; ctx.lineWidth=1; ctx.strokeRect(bx,by,68,24);
        ctx.fillStyle = '#ff8888'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('REMOVE', bx+34, by+16); ctx.textAlign='left';
      }
      iy += 32;
    }
  }
  ctx.restore();
  if (_totalH > INV_VIEW_H) {
    const trackH=INV_VIEW_H-4, maxS=_totalH-INV_VIEW_H;
    const thumbH=Math.max(20,(INV_VIEW_H/_totalH)*trackH);
    const thumbY=SY+70+2+(invScrollY/maxS)*(trackH-thumbH);
    ctx.fillStyle='#1a3040'; ctx.fillRect(SX+SW-8,SY+70+2,5,trackH);
    ctx.fillStyle='#44aacc'; ctx.fillRect(SX+SW-8,thumbY,5,thumbH);
  }
}

function drawShop() {
  ctx.fillStyle='#000000aa'; ctx.fillRect(0,0,DW,CH);
  ctx.fillStyle='#0f0921'; ctx.fillRect(SX,SY,SW,SH);
  ctx.strokeStyle='#7c3aed'; ctx.lineWidth=2; ctx.strokeRect(SX,SY,SW,SH);
  ctx.strokeStyle='#3d1a6a'; ctx.lineWidth=1; ctx.strokeRect(SX+4,SY+4,SW-8,SH-8);
  ctx.fillStyle='#c084fc'; ctx.font='11px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('SHOP', DW/2, SY+26);
  // Close button
  const cx=SX+SW-38, cy=SY+8;
  const chov=inR(mouse.x,mouse.y, cx,cy, 28,28);
  ctx.fillStyle=chov?'#3a0f2a':'#1e0e28'; ctx.fillRect(cx,cy,28,28);
  ctx.strokeStyle='#ff4488'; ctx.lineWidth=1.5; ctx.strokeRect(cx,cy,28,28);
  ctx.fillStyle='#ff4488'; ctx.font='10px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('X', cx+14, cy+18);
  // Tabs
  const TAB_W = 75, TAB_GAP = 4;
  const tabs = [['food','FOOD'],['traps','TRAPS'],['minions','MNNS'],['dungeon','DNGN']];
  for (let i=0; i<4; i++) {
    const tx=SX+12+i*(TAB_W+TAB_GAP), ty=SY+40;
    const active=shopTab===tabs[i][0];
    const thov=inR(mouse.x,mouse.y, tx,ty, TAB_W,24);
    ctx.fillStyle=active?'#1a0b2e':(thov?'#150826':'#0d051e');
    ctx.fillRect(tx,ty,TAB_W,24);
    ctx.strokeStyle=active?'#7c3aed':'#3d1a6a'; ctx.lineWidth=active?2:1;
    ctx.strokeRect(tx,ty,TAB_W,24);
    ctx.fillStyle=active?'#c084fc':'#7c5aaa'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(tabs[i][1], tx+TAB_W/2, ty+15);
  }
  ctx.fillStyle='#3d2458'; ctx.fillRect(SX+8,SY+70,SW-16,1);
  ctx.textAlign='left';

  const items = shopTab==='food' ? foodShopItems() : shopTab==='traps' ? trapShopItems() : shopTab==='minions' ? minionShopItems() : dungeonShopItems();
  // Compute total content height and clamp scroll
  let _sh = 0; for (const it of items) _sh += it.food !== undefined ? 94 : 80;
  const SHOP_VIEW_H = SH - 70;
  shopScrollY = Math.max(0, Math.min(Math.max(0, _sh - SHOP_VIEW_H), shopScrollY));
  const smy = (mouse.y >= SY+70 && mouse.y <= SY+SH) ? mouse.y + shopScrollY : -9999;
  ctx.save();
  ctx.beginPath(); ctx.rect(SX+8, SY+70, SW-16, SHOP_VIEW_H); ctx.clip();
  ctx.translate(0, -shopScrollY);
  let iy = SY + 76;
  let minionTipKey = null;
  let trapTipKey = null;
  for (const item of items) {
    const hasFood = item.food !== undefined;
    const rowH = hasFood ? 94 : 80;
    const iHov=inR(mouse.x,smy, SX+8,iy, SW-16,rowH);
    if (iHov && (shopTab === 'minions' || (shopTab === 'food' && item.type === 'minion')) && item.key) minionTipKey = item.key;
    if (iHov && shopTab === 'traps' && item.type === 'trap') trapTipKey = item.key;
    ctx.fillStyle=iHov?'#1a1030':'#120820'; ctx.fillRect(SX+8,iy,SW-16,rowH);
    ctx.strokeStyle='#2a1848'; ctx.lineWidth=1; ctx.strokeRect(SX+8,iy,SW-16,rowH);
    const paysFood = item.type === 'minion';
    ctx.fillStyle='#ffffff'; ctx.font='8px "Press Start 2P"'; ctx.fillText(item.name, SX+20, iy+18);
    ctx.fillStyle='#9988aa'; ctx.font='6px "Press Start 2P"'; ctx.fillText(item.desc, SX+20, iy+32);
    ctx.fillStyle=paysFood?'#55dd88':'#ffd700'; ctx.font='7px "Press Start 2P"';
    ctx.fillText('Cost: '+item.cost+(paysFood?' food':' coins'), SX+20, iy+47);
    if (hasFood) {
      let foodStr, foodCol;
      if (item.foodGen !== undefined) {
        foodStr = '+'+item.foodGen+' food/min (scales per level)'; foodCol = '#55dd88';
      } else if (item.food === 0) {
        foodStr = '0 food upkeep/min'; foodCol = '#aabbaa';
      } else {
        foodStr = item.food+' food upkeep/min per level'; foodCol = '#ff9944';
      }
      ctx.fillStyle = foodCol;
      ctx.font = '6px "Press Start 2P"';
      ctx.fillText(foodStr, SX+20, iy+62);
      ctx.fillStyle='#88aa88'; ctx.font='6px "Press Start 2P"'; ctx.fillText('Have: '+item.have, SX+20, iy+76);
    } else {
      ctx.fillStyle='#88aa88'; ctx.font='6px "Press Start 2P"'; ctx.fillText('Have: '+item.have, SX+20, iy+62);
    }
    if (item.locked) {
      ctx.fillStyle = '#888866'; ctx.font = '5px "Press Start 2P"';
      ctx.fillText('Requires: Goblin Minion Lv5', SX+20, iy+(hasFood?82:68));
    }
    const canBuy=!item.maxed&&!item.locked&&(paysFood?food:coins)>=item.cost, bx=SX+SW-104, by=iy+20;
    const bHov=inR(mouse.x,smy, bx,by, 88,32);
    ctx.fillStyle=item.locked?'#1a1a0a':(canBuy?(bHov?'#1a4a1a':'#0f3010'):'#0d0a12'); ctx.fillRect(bx,by,88,32);
    ctx.strokeStyle=item.locked?'#555533':(canBuy?'#44ff44':'#2a2233'); ctx.lineWidth=1.5; ctx.strokeRect(bx,by,88,32);
    ctx.fillStyle=item.locked?'#888844':(canBuy?'#44ff44':(item.maxed?'#335533':'#443355')); ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(item.locked?'LOCK':(item.maxed?'MAX':'BUY'), bx+44, by+20); ctx.textAlign='left';
    iy += rowH;
  }
  ctx.restore();
  if (_sh > SHOP_VIEW_H) {
    const trackH = SHOP_VIEW_H - 4, maxS = _sh - SHOP_VIEW_H;
    const thumbH = Math.max(20, (SHOP_VIEW_H / _sh) * trackH);
    const thumbY = SY+70+2 + (shopScrollY / maxS) * (trackH - thumbH);
    ctx.fillStyle='#1a1030'; ctx.fillRect(SX+SW-8, SY+70+2, 5, trackH);
    ctx.fillStyle='#7755cc'; ctx.fillRect(SX+SW-8, thumbY, 5, thumbH);
  }
  if (minionTipKey) drawMinionTooltip(minionTipKey, 1);
  if (trapTipKey)   drawTrapTooltip(trapTipKey, 1);
}

// ── Skill bar HUD ─────────────────────────────────────────────
function drawSkillBar() {
  if (gameState === 'gameover') return;
  const SB_W = 58, SB_H = 40, SB_GAP = 8;
  const LBLS = ['Q','E','R','F','LMB','RMB'];
  // Row 1: slots 0-3 (Q/E/R/F), Row 2: slots 4-5 (LMB/RMB)
  const totalW4 = 4 * SB_W + 3 * SB_GAP;
  const totalW2 = 2 * SB_W + 1 * SB_GAP;
  const sx4 = (DW - totalW4) / 2;
  const sx2 = (DW - totalW2) / 2;
  const sy1 = CH - SB_H * 2 - 14;
  const sy2 = CH - SB_H - 6;

  for (let i = 0; i < 6; i++) {
    const row = i < 4 ? 0 : 1;
    const col = i < 4 ? i : i - 4;
    const bx  = row === 0 ? sx4 + col * (SB_W + SB_GAP) : sx2 + col * (SB_W + SB_GAP);
    const sy  = row === 0 ? sy1 : sy2;
    const key = player.slots[i];
    const sk  = key ? SKILLS[key] : null;
    const cd  = player.skillCds[i];
    const sel = pendingSkill && pendingSkill.type === 'slot' && pendingSkill.idx === i;

    const rc = skillColor(key);
    const ready = sk && cd <= 0;
    // Slot background
    ctx.fillStyle = '#080612cc';
    ctx.fillRect(bx, sy, SB_W, SB_H);
    // Glow for ready skills
    if (ready && !sel) {
      ctx.save();
      ctx.shadowBlur  = 10;
      ctx.shadowColor = rc;
      ctx.strokeStyle = rc;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(bx, sy, SB_W, SB_H);
      ctx.restore();
    } else {
      ctx.strokeStyle = sel ? '#88bbff' : (sk ? rc + '88' : '#2a1840');
      ctx.lineWidth   = sel ? 2 : 1;
      ctx.strokeRect(bx, sy, SB_W, SB_H);
    }

    ctx.fillStyle = i >= 4 ? '#44aa77' : '#4466aa';
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(LBLS[i], bx + 3, sy + 9);

    ctx.fillStyle = sk ? (cd > 0 ? '#554477' : rc) : '#2a1848';
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(sk ? sk.shortName : '---', bx + SB_W / 2, sy + 28);

    if (cd > 0 && sk) {
      ctx.fillStyle = '#00000088';
      ctx.fillRect(bx, sy, SB_W, SB_H * (cd / sk.cooldown));
      ctx.fillStyle = '#ccccee';
      ctx.font = '6px "Press Start 2P"';
      ctx.fillText(cd.toFixed(1) + 's', bx + SB_W / 2, sy + SB_H / 2 + 3);
    }
  }
  ctx.textAlign = 'left';
}

// ── Skill menu overlay ────────────────────────────────────────
function drawSkillMenu() {
  let skillTip = null; // key of hovered skill, set during slot/card loops below

  ctx.fillStyle = '#000000aa';
  ctx.fillRect(0, 0, DW, CH);

  ctx.fillStyle = '#0f0921';
  ctx.fillRect(SKMNX, SKMNY, SKMNW, SKMNH);
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(SKMNX, SKMNY, SKMNW, SKMNH);
  ctx.strokeStyle = '#1a1840';
  ctx.lineWidth = 1;
  ctx.strokeRect(SKMNX + 4, SKMNY + 4, SKMNW - 8, SKMNH - 8);

  // Title
  ctx.fillStyle = '#88bbff';
  ctx.font = '11px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('SKILL MENU', DW / 2, SKMNY + 26);

  // Close button
  const CX = SKMNX + SKMNW - 38, CY = SKMNY + 8;
  const chov = inR(mouse.x, mouse.y, CX, CY, 28, 28);
  ctx.fillStyle = chov ? '#3a0f2a' : '#1e0e28';
  ctx.fillRect(CX, CY, 28, 28);
  ctx.strokeStyle = '#ff4488';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(CX, CY, 28, 28);
  ctx.fillStyle = '#ff4488';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('X', CX + 14, CY + 18);

  // Equipped slots label
  ctx.fillStyle = '#6688aa';
  ctx.font = '6px "Press Start 2P"';
  ctx.fillText('— EQUIPPED SLOTS —', DW / 2, SKMNY + 48);

  // 6 slots: row1 = Q/E/R/F (slots 0-3), row2 = LMB/RMB (slots 4-5)
  const LBLS = ['Q','E','R','F','LMB','RMB'];
  const totalSlotW = 4 * SK_SLOT_W + 3 * SK_SLOT_GAP;
  const slotStartX = SKMNX + (SKMNW - totalSlotW) / 2;
  const slotY = SKMNY + 56;
  const slotY2 = slotY + SK_SLOT_H + 20;
  const totalSlotW2 = 2 * SK_SLOT_W + 1 * SK_SLOT_GAP;
  const slotStartX2 = SKMNX + (SKMNW - totalSlotW2) / 2;

  for (let i = 0; i < 6; i++) {
    const row2 = i >= 4;
    const col  = row2 ? i - 4 : i;
    const bx   = row2 ? slotStartX2 + col * (SK_SLOT_W + SK_SLOT_GAP) : slotStartX + col * (SK_SLOT_W + SK_SLOT_GAP);
    const by   = row2 ? slotY2 : slotY;
    const key  = player.slots[i];
    const sk   = key ? SKILLS[key] : null;
    const sel  = pendingSkill && pendingSkill.type === 'slot' && pendingSkill.idx === i;
    const hov  = inR(mouse.x, mouse.y, bx, by, SK_SLOT_W, SK_SLOT_H);

    if (hov && sk) skillTip = key;
    const src = skillColor(key);
    ctx.fillStyle = sel ? '#1a2a44' : (hov ? '#151030' : '#0d0a20');
    ctx.fillRect(bx, by, SK_SLOT_W, SK_SLOT_H);
    ctx.strokeStyle = sel ? '#88bbff' : (sk ? src : '#2a2050');
    ctx.lineWidth = sel ? 2 : 1.5;
    ctx.strokeRect(bx, by, SK_SLOT_W, SK_SLOT_H);

    ctx.save();
    ctx.beginPath(); ctx.rect(bx + 2, by + 2, SK_SLOT_W - 4, SK_SLOT_H - 4); ctx.clip();

    ctx.fillStyle = row2 ? '#44aa77' : '#4488ff';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText('[' + LBLS[i] + ']', bx + 5, by + 13);

    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillStyle = sk ? src : '#332255';
    ctx.fillText(sk ? sk.name : 'EMPTY', bx + SK_SLOT_W / 2, by + 38);

    if (sk) {
      ctx.fillStyle = '#7799aa';
      ctx.font = '5px "Press Start 2P"';
      ctx.fillText('CD: ' + sk.cooldown + 's', bx + SK_SLOT_W / 2, by + 52);
      ctx.fillStyle = '#556677';
      const words = sk.desc.split(' ');
      let line = '', ly = by + 64;
      for (const w of words) {
        const test = line + (line ? ' ' : '') + w;
        if (ctx.measureText(test).width > SK_SLOT_W - 8) {
          ctx.fillText(line, bx + SK_SLOT_W / 2, ly);
          line = w; ly += 10;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, bx + SK_SLOT_W / 2, ly);
    }
    ctx.restore();
  }

  // Race skill slot (locked, read-only)
  const raceSlotX = SKMNX + (SKMNW - SK_SLOT_W) / 2;
  const raceSlotY = slotY2 + SK_SLOT_H + 12;
  {
    const rsk = player.raceSkill ? SKILLS[player.raceSkill] : null;
    if (inR(mouse.x, mouse.y, raceSlotX, raceSlotY, SK_SLOT_W, SK_SLOT_H) && rsk) skillTip = player.raceSkill;
    ctx.fillStyle = '#100a18';
    ctx.fillRect(raceSlotX, raceSlotY, SK_SLOT_W, SK_SLOT_H);
    ctx.strokeStyle = '#aa8800';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(raceSlotX, raceSlotY, SK_SLOT_W, SK_SLOT_H);

    ctx.save();
    ctx.beginPath(); ctx.rect(raceSlotX + 2, raceSlotY + 2, SK_SLOT_W - 4, SK_SLOT_H - 4); ctx.clip();
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aa8800';
    ctx.fillText('[RACE]', raceSlotX + 5, raceSlotY + 13);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#664400';
    ctx.fillText('LOCKED', raceSlotX + SK_SLOT_W - 5, raceSlotY + 13);
    ctx.textAlign = 'center';
    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = rsk ? '#ffcc44' : '#332255';
    ctx.fillText(rsk ? rsk.name : 'NONE', raceSlotX + SK_SLOT_W / 2, raceSlotY + 36);
    if (rsk) {
      ctx.fillStyle = '#7799aa';
      ctx.font = '5px "Press Start 2P"';
      ctx.fillText('PASSIVE', raceSlotX + SK_SLOT_W / 2, raceSlotY + 49);
      ctx.fillStyle = '#665533';
      const words = rsk.desc.split(' ');
      let line = '', ly = raceSlotY + 61;
      for (const w of words) {
        const test = line + (line ? ' ' : '') + w;
        if (ctx.measureText(test).width > SK_SLOT_W - 8) {
          ctx.fillText(line, raceSlotX + SK_SLOT_W / 2, ly);
          line = w; ly += 9;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, raceSlotX + SK_SLOT_W / 2, ly);
    }
    ctx.restore();
  }

  // Separator + unlocked label
  const sepY = raceSlotY + SK_SLOT_H + 14;
  ctx.fillStyle = '#1a1848';
  ctx.fillRect(SKMNX + 12, sepY, SKMNW - 24, 1);
  ctx.fillStyle = '#6688aa';
  ctx.font = '6px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('— UNLOCKED SKILLS —', DW / 2, sepY + 16);

  // Unlocked skills grid (scrollable)
  const cardsPerRow = Math.floor((SKMNW - 32) / (SK_CARD_W + SK_CARD_GAP));
  const cardStartX  = SKMNX + (SKMNW - cardsPerRow * (SK_CARD_W + SK_CARD_GAP) + SK_CARD_GAP) / 2;
  const cardStartY  = sepY + 24;
  const cardClipTop = cardStartY - 4;
  const cardViewH   = SKMNY + SKMNH - cardClipTop - 4;
  const numRows     = Math.ceil(player.unlockedSkills.length / cardsPerRow);
  const _cardTotalH = numRows * (SK_CARD_H + SK_CARD_GAP);
  skillScrollY = Math.max(0, Math.min(Math.max(0, _cardTotalH - cardViewH), skillScrollY));
  const smyCard = (mouse.y >= cardClipTop && mouse.y <= SKMNY+SKMNH) ? mouse.y + skillScrollY : -9999;

  ctx.save();
  ctx.beginPath(); ctx.rect(SKMNX+4, cardClipTop, SKMNW-8, cardViewH); ctx.clip();
  ctx.translate(0, -skillScrollY);

  if (player.unlockedSkills.length === 0) {
    ctx.fillStyle = '#332255';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('No skills unlocked yet.', DW / 2, cardStartY + 20);
    ctx.fillStyle = '#221a33';
    ctx.font = '5px "Press Start 2P"';
    ctx.fillText('Defeat adventurers to earn skills!', DW / 2, cardStartY + 38);
  } else {
    for (let i = 0; i < player.unlockedSkills.length; i++) {
      const sk  = SKILLS[player.unlockedSkills[i]];
      if (!sk) continue;
      const col = i % cardsPerRow, row = Math.floor(i / cardsPerRow);
      const cx  = cardStartX + col * (SK_CARD_W + SK_CARD_GAP);
      const cy  = cardStartY + row * (SK_CARD_H + SK_CARD_GAP);
      const sel = pendingSkill && pendingSkill.type === 'unlocked' && pendingSkill.idx === i;
      const hov = inR(mouse.x, smyCard, cx, cy, SK_CARD_W, SK_CARD_H);

      if (hov) skillTip = player.unlockedSkills[i];
      const crc = skillColor(player.unlockedSkills[i]);
      ctx.fillStyle = sel ? '#1a2a44' : (hov ? '#151030' : '#0d0a20');
      ctx.fillRect(cx, cy, SK_CARD_W, SK_CARD_H);
      ctx.strokeStyle = sel ? '#88bbff' : crc;
      ctx.lineWidth = sel ? 2 : 1.5;
      ctx.strokeRect(cx, cy, SK_CARD_W, SK_CARD_H);

      ctx.save();
      ctx.beginPath(); ctx.rect(cx + 2, cy + 2, SK_CARD_W - 4, SK_CARD_H - 4); ctx.clip();
      ctx.fillStyle = crc;
      ctx.font = '5px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(sk.name, cx + SK_CARD_W / 2, cy + 18);
      ctx.fillStyle = '#7799aa';
      ctx.fillText('CD: ' + sk.cooldown + 's', cx + SK_CARD_W / 2, cy + 34);
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.textAlign = 'left';
  if (_cardTotalH > cardViewH) {
    const trackH=cardViewH-4, maxS=_cardTotalH-cardViewH;
    const thumbH=Math.max(16,(cardViewH/_cardTotalH)*trackH);
    const thumbY=cardClipTop+2+(skillScrollY/maxS)*(trackH-thumbH);
    ctx.fillStyle='#1a1848'; ctx.fillRect(SKMNX+SKMNW-7,cardClipTop+2,5,trackH);
    ctx.fillStyle='#4488ff'; ctx.fillRect(SKMNX+SKMNW-7,thumbY,5,thumbH);
  }

  // ── Skill tooltip panel ───────────────────────────────────────
  if (skillTip) {
    const tsk = SKILLS[skillTip];
    const TTX = SKMNX + SKMNW + 10;
    const TTW = CW - TTX - 10;
    const TTY = SKMNY;
    const TTH = SKMNH;
    const col = skillColor(skillTip);
    const mid = TTX + TTW / 2;
    const PAD = 12;

    // Panel
    ctx.fillStyle = '#06030f';
    ctx.fillRect(TTX, TTY, TTW, TTH);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(TTX, TTY, TTW, TTH);
    ctx.strokeStyle = col + '33';
    ctx.lineWidth = 1;
    ctx.strokeRect(TTX + 3, TTY + 3, TTW - 6, TTH - 6);

    // Colored header accent strip
    ctx.fillStyle = col + '22';
    ctx.fillRect(TTX + 2, TTY + 2, TTW - 4, 38);

    ctx.save();
    ctx.beginPath(); ctx.rect(TTX + 4, TTY + 4, TTW - 8, TTH - 8); ctx.clip();

    // ── Skill name (centered, word-wrapped) ──
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillStyle = col;
    let nameY = TTY + 16;
    const nameWords = tsk.name.split(' ');
    let nameLine = '';
    for (const w of nameWords) {
      const test = nameLine + (nameLine ? ' ' : '') + w;
      if (ctx.measureText(test).width > TTW - PAD * 2) {
        ctx.fillText(nameLine, mid, nameY); nameLine = w; nameY += 11;
      } else { nameLine = test; }
    }
    ctx.fillText(nameLine, mid, nameY);
    let cy = nameY + 16;

    // ── Type badge + cooldown row ──
    const isPassive = tsk.cooldown === 0;
    const isCast    = tsk.desc.includes('Cast');
    const typeLabel = isPassive ? 'PASSIVE' : (isCast ? 'CAST' : 'ACTIVE');
    const typeBg    = isPassive ? '#1a2e1a' : (isCast ? '#1a1a3a' : '#1a2a2a');
    const typeFg    = isPassive ? '#55cc66' : (isCast ? '#7788ff' : '#44bbbb');
    const bw = 52, bh = 13;
    ctx.fillStyle = typeBg;
    ctx.fillRect(mid - bw / 2, cy - 10, bw, bh);
    ctx.strokeStyle = typeFg;
    ctx.lineWidth = 1;
    ctx.strokeRect(mid - bw / 2, cy - 10, bw, bh);
    ctx.font = '5px "Press Start 2P"';
    ctx.fillStyle = typeFg;
    ctx.fillText(typeLabel, mid, cy - 1);
    cy += 10;

    if (!isPassive) {
      ctx.fillStyle = '#4488aa';
      ctx.font = '5px "Press Start 2P"';
      ctx.fillText('Cooldown:  ' + tsk.cooldown + 's', mid, cy);
      cy += 8;
    }

    // ── Divider ──
    cy += 4;
    ctx.fillStyle = col + '55';
    ctx.fillRect(TTX + PAD, cy, TTW - PAD * 2, 1);
    cy += 10;

    // ── Bullet-point tips ──
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'left';
    const lineW  = TTW - PAD * 2 - 10;
    const textX  = TTX + PAD + 9;
    const dotX   = TTX + PAD;

    for (const tip of (tsk.tips || [])) {
      // Colored square bullet
      ctx.fillStyle = col;
      ctx.fillRect(dotX, cy - 4, 4, 4);

      // Word-wrap tip text
      const tipWords = tip.split(' ');
      let tLine = '';
      let ty = cy;
      let first = true;
      for (const w of tipWords) {
        const test = tLine + (tLine ? ' ' : '') + w;
        if (ctx.measureText(test).width > lineW) {
          ctx.fillStyle = first ? '#ddeeff' : '#99aabb';
          ctx.fillText(tLine, textX, ty);
          tLine = w; ty += 10; first = false;
        } else { tLine = test; }
      }
      ctx.fillStyle = first ? '#ddeeff' : '#99aabb';
      if (tLine) ctx.fillText(tLine, textX, ty);
      cy = ty + 14;
    }

    ctx.restore();
    ctx.textAlign = 'left';
  }
}

// ── Race select screen ────────────────────────────────────────
const RS_KEYS  = ['goblin', 'spirit', 'slime'];
const RS_CARD_W = 210, RS_CARD_H = 390;
const RS_GAP    = 18;

function drawRaceSelect() {
  ctx.fillStyle = '#06030f';
  ctx.fillRect(0, 0, CW, CH);

  // Title
  ctx.fillStyle = '#c084fc'; ctx.font = '16px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText('CHOOSE YOUR RACE', CW/2, 56);
  ctx.fillStyle = '#5b21b6'; ctx.font = '6px "Press Start 2P"';
  ctx.fillText('Your race determines your starting skills and passives.', CW/2, 80);
  ctx.textAlign = 'left';

  const totalW = RS_KEYS.length * RS_CARD_W + (RS_KEYS.length - 1) * RS_GAP;
  const startX = (CW - totalW) / 2;
  const cardY  = 100;

  for (let i = 0; i < RS_KEYS.length; i++) {
    const race = RACES[RS_KEYS[i]];
    const cx   = startX + i * (RS_CARD_W + RS_GAP);
    const hov  = !race.comingSoon && inR(mouse.x, mouse.y, cx, cardY, RS_CARD_W, RS_CARD_H);

    ctx.fillStyle   = race.comingSoon ? '#0c0918' : (hov ? '#1a0f2e' : '#110a22');
    ctx.fillRect(cx, cardY, RS_CARD_W, RS_CARD_H);
    ctx.strokeStyle = race.comingSoon ? '#2a1840' : (hov ? race.color : race.color + '88');
    ctx.lineWidth   = hov ? 2.5 : 1.5;
    ctx.strokeRect(cx, cardY, RS_CARD_W, RS_CARD_H);

    // Sprite preview (8px per logical pixel)
    const sc    = 8;
    const sprOx = cx + RS_CARD_W/2 - 4*sc;
    const sprOy = cardY + 18;
    ctx.globalAlpha = race.comingSoon ? 0.25 : 1;
    sprS(race.sprite, race.sprColors, sprOx, sprOy, sc);
    ctx.globalAlpha = 1;

    const nameY = sprOy + 8*sc + 22;
    ctx.textAlign = 'center';

    // Race name
    ctx.fillStyle = race.comingSoon ? '#333' : race.color;
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(race.name, cx + RS_CARD_W/2, nameY);

    if (race.comingSoon) {
      ctx.fillStyle = '#443355'; ctx.font = '7px "Press Start 2P"';
      ctx.fillText('COMING SOON', cx + RS_CARD_W/2, nameY + 22);
    } else {
      // Description
      ctx.fillStyle = '#9988aa'; ctx.font = '6px "Press Start 2P"';
      ctx.fillText(race.desc, cx + RS_CARD_W/2, nameY + 20);

      // Traits
      ctx.fillStyle = '#6688aa'; ctx.font = '6px "Press Start 2P"';
      ctx.fillText('— TRAITS —', cx + RS_CARD_W/2, nameY + 44);
      race.traits.forEach((t, ti) => {
        ctx.fillStyle = '#aaccff'; ctx.font = '5px "Press Start 2P"';
        ctx.fillText('▸ ' + t, cx + RS_CARD_W/2, nameY + 60 + ti * 16);
      });

      // Starting skills
      const skY = nameY + 60 + race.traits.length * 16 + 14;
      ctx.fillStyle = '#6688aa'; ctx.font = '6px "Press Start 2P"';
      ctx.fillText('— SKILLS —', cx + RS_CARD_W/2, skY);
      const displaySkills = RS_KEYS[i] === 'goblin'
        ? [...race.startSkills, 'goblinFlurry']
        : RS_KEYS[i] === 'spirit'
        ? [...race.startSkills, 'spiritSiphon']
        : RS_KEYS[i] === 'slime'
        ? [...race.startSkills, 'slimeBalls']
        : race.startSkills;
      displaySkills.forEach((sk, si) => {
        const skill = SKILLS[sk];
        if (!skill) return;
        ctx.fillStyle = '#88bbff'; ctx.font = '5px "Press Start 2P"';
        ctx.fillText('▸ ' + skill.name, cx + RS_CARD_W/2, skY + 16 + si * 14);
      });

      // SELECT button
      const btnY = cardY + RS_CARD_H - 52;
      const btnX = cx + 20, btnW = RS_CARD_W - 40;
      const btnHov = inR(mouse.x, mouse.y, btnX, btnY, btnW, 36);
      ctx.fillStyle   = btnHov ? '#2a1a3e' : '#1a0f2e';
      ctx.fillRect(btnX, btnY, btnW, 36);
      ctx.strokeStyle = race.color; ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnW, 36);
      ctx.fillStyle = race.color; ctx.font = '9px "Press Start 2P"';
      ctx.fillText('SELECT', cx + RS_CARD_W/2, btnY + 23);
    }
    ctx.textAlign = 'left';
  }
}

function raceSelectClick(mx, my) {
  const totalW = RS_KEYS.length * RS_CARD_W + (RS_KEYS.length - 1) * RS_GAP;
  const startX = (CW - totalW) / 2;
  const cardY  = 100;

  for (let i = 0; i < RS_KEYS.length; i++) {
    const race = RACES[RS_KEYS[i]];
    const cx   = startX + i * (RS_CARD_W + RS_GAP);
    if (race.comingSoon) {
      if (inR(mx, my, cx, cardY, RS_CARD_W, RS_CARD_H)) {
        showMsg(race.name + ' — Coming Soon!');
        return;
      }
    } else {
      const btnY = cardY + RS_CARD_H - 52;
      const btnX = cx + 20, btnW = RS_CARD_W - 40;
      if (inR(mx, my, btnX, btnY, btnW, 36)) {
        selectRace(RS_KEYS[i]);
        return;
      }
    }
  }
}

function drawFlash() {
  ctx.font='8px "Press Start 2P"';
  const tw=ctx.measureText(flash).width, bw=Math.max(tw+32,200);
  const bx=DW/2-bw/2, by=CH-55;
  ctx.globalAlpha=Math.min(1, flashT*0.9);
  ctx.fillStyle='#110a22ee'; ctx.fillRect(bx-1,by-1,bw+2,30);
  ctx.strokeStyle='#5b21b6'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,28);
  ctx.fillStyle='#ffd700'; ctx.textAlign='center'; ctx.fillText(flash, DW/2, by+18);
  ctx.textAlign='left'; ctx.globalAlpha=1;
}

function drawFlashTop() {
  ctx.font='8px "Press Start 2P"';
  const tw=ctx.measureText(flashTop).width, bw=Math.max(tw+32,220);
  const bx=DW/2-bw/2, by=10;
  ctx.globalAlpha=Math.min(1, flashTopT*0.9);
  ctx.fillStyle='#0a1a0aee'; ctx.fillRect(bx-1,by-1,bw+2,30);
  ctx.strokeStyle='#22cc44'; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,bw,28);
  ctx.fillStyle='#44ffaa'; ctx.textAlign='center'; ctx.fillText(flashTop, DW/2, by+18);
  ctx.textAlign='left'; ctx.globalAlpha=1;
}

function drawFocusPrompt() {
  ctx.globalAlpha=0.93; ctx.fillStyle='#06030f'; ctx.fillRect(0,0,DW,CH); ctx.globalAlpha=1;
  ctx.fillStyle='#c084fc'; ctx.font='14px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('DUNGEON LORD', DW/2, CH/2-70);
  ctx.fillStyle='#7c3aed'; ctx.font='8px "Press Start 2P"';
  ctx.fillText('Defend your dungeon!', DW/2, CH/2-44);
  ctx.fillStyle='#44cc44'; ctx.font='9px "Press Start 2P"';
  ctx.fillText('CLICK TO PLAY', DW/2, CH/2+5);
  ctx.fillStyle='#554a77'; ctx.font='6px "Press Start 2P"';
  [
    '1. Place Heart',
    '2. Open Shop',
    '3. Adventurers raid every 60s!',
    '4. Kill them for coins and infamy!',
    '5. Buy minions to defend your dungeon!',
    'WASD=Move  Click=Basic Attack  P=Pause',
  ].forEach((t,i) => ctx.fillText(t, DW/2-130, CH/2+35+i*17));
  ctx.textAlign='left';
}

function drawGameOverOverlay() {
  ctx.fillStyle='#000000aa'; ctx.fillRect(0,0,DW,CH);
  const pw=340,ph=150,px=DW/2-pw/2,py=CH/2-ph/2;
  ctx.fillStyle='#0e0820'; ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle='#ff2222'; ctx.lineWidth=3; ctx.strokeRect(px,py,pw,ph);
  ctx.fillStyle='#ff2222'; ctx.font='18px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('GAME OVER', DW/2, CH/2-20);
  const bx=DW/2-80, by=CH/2+15;
  const bHov=inR(mouse.x,mouse.y, bx,by, 160,36);
  ctx.fillStyle=bHov?'#1a0f2e':'#110920'; ctx.fillRect(bx,by,160,36);
  ctx.strokeStyle='#ff2222'; ctx.lineWidth=2; ctx.strokeRect(bx,by,160,36);
  ctx.fillStyle='#ff2222'; ctx.font='9px "Press Start 2P"';
  ctx.fillText('RESTART', DW/2, by+23); ctx.textAlign='left';
}

// ── Start ────────────────────────────────────────────────────
init();
requestAnimationFrame(loop);
