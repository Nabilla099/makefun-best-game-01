// Emberward — shared tuning constants, palette and upgrade catalogue.
// Every number that shapes how the game feels lives here, so balance can be
// tuned in one place without touching the simulation or the renderer.

// Logical playfield. The canvas is always 1280x720; CSS scales it to the window.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const ARENA_MARGIN = 28;

// Fixed simulation step (seconds). Rendering interpolates nothing: the loop
// advances the world in exact 1/60 s steps, which also makes the ?shot=
// screenshot scenes deterministic.
export const STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

// Palette: a night grove lit by embers. Deep indigo ground, amber light,
// teal accents for the player, violet for the shadow creatures.
export const PALETTE = {
  skyTop: '#0b1030',
  skyBottom: '#1a1440',
  ground: '#141b33',
  groundLine: '#232c52',
  grassTuft: '#2c3a6b',
  lanternGlow: '#ffb347',
  ember: '#ffcf5c',
  emberHot: '#fff3b0',
  player: '#7fe7d2',
  playerDark: '#2f9e8c',
  wisp: '#b78cff',
  wispCore: '#e9dcff',
  spitter: '#ff7ad9',
  splitter: '#9db4ff',
  brute: '#ff5f6d',
  bruteCore: '#ffd166',
  heart: '#ff6b81',
  star: '#ffe066',
  text: '#f4eedd',
  textDim: '#a9b0d6',
  panel: 'rgba(12, 16, 38, 0.86)',
  panelEdge: '#4a548f',
  danger: '#ff5f6d',
};

export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.16,
  bulletSpeed: 540,
  bulletDamage: 1,
  bulletRadius: 5,
  dashCooldown: 2.6,
  dashTime: 0.16,
  dashSpeed: 780,
  pickupRadius: 70,
  invulnTime: 1.0,
};

export const COMBO = {
  window: 3.0, // seconds a kill chain stays alive
  perKill: 1, // combo points added per kill
  max: 12, // combo multiplier caps at x5 (see world.js)
};

export const WAVES = {
  baseCount: 6, // enemies in wave 1
  perWave: 3, // extra enemies per wave
  betweenSeconds: 2.2, // breather before the next wave banner
  bossEvery: 5, // every 5th wave ends with a Gloom Warden
};

// Enemy kinds. hp scales a little with the wave; speed is in px/s.
export const ENEMIES = {
  drifter: { hp: 2, speed: 78, radius: 15, score: 50, damage: 12, color: 'wisp' },
  spitter: { hp: 3, speed: 58, radius: 15, score: 90, damage: 10, color: 'spitter' },
  splitter: { hp: 3, speed: 66, radius: 17, score: 110, damage: 12, color: 'splitter' },
  brute: { hp: 11, speed: 40, radius: 26, score: 250, damage: 22, color: 'brute' },
  mini: { hp: 1, speed: 120, radius: 9, score: 25, damage: 8, color: 'wisp' },
  warden: { hp: 60, speed: 34, radius: 40, score: 1500, damage: 26, color: 'brute' },
};

// Upgrade cards offered between waves. Each may be taken up to maxStacks times.
// id, name, blurb, maxStacks and the stat it changes are all data here.
export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Embers', icon: '»', maxStacks: 5,
    blurb: 'Shoot 22% faster.' },
  { id: 'heavy', name: 'Heavy Embers', icon: '●', maxStacks: 5,
    blurb: '+1 ember damage.' },
  { id: 'twin', name: 'Twin Flames', icon: '✦', maxStacks: 3,
    blurb: 'Fire one extra ember per shot.' },
  { id: 'swift', name: 'Swift Boots', icon: '➤', maxStacks: 4,
    blurb: 'Move 12% faster.' },
  { id: 'pierce', name: 'Piercing Light', icon: '↗', maxStacks: 3,
    blurb: 'Embers pierce one extra foe.' },
  { id: 'heart', name: 'Lantern Heart', icon: '♥', maxStacks: 4,
    blurb: '+30 max health and heal 30.' },
  { id: 'magnet', name: 'Ember Magnet', icon: '◎', maxStacks: 3,
    blurb: 'Pickups fly to you from 70% farther.' },
  { id: 'frost', name: 'Frost Embers', icon: '❄', maxStacks: 3,
    blurb: 'Hits slow foes by 35% for 1.2 s.' },
  { id: 'dash', name: 'Blink Dash', icon: '⚡', maxStacks: 2,
    blurb: 'Unlock Shift dash, then recharge 30% faster.' },
  { id: 'keeper', name: 'Combo Keeper', icon: '∞', maxStacks: 3,
    blurb: 'Your combo lasts 50% longer.' },
];

export const PICKUPS = {
  emberValue: 10, // score per ember orb
  heartHeal: 18,
  starScore: 500,
  heartDropChance: 0.06,
  starDropChance: 0.02,
};

export const BEST_KEY = 'emberward.best.score.v1';
export const MUTE_KEY = 'emberward.muted.v1';
