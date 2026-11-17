// Emberward — entity factories.
// Entities are plain objects; the world advances them and the renderer draws
// them. Factories live here so the shape of every thing in the arena is
// defined in one place.

import { ENEMIES, PLAYER, VIEW_W, VIEW_H } from './config.js';

export function makePlayer(x, y) {
  return {
    kind: 'player',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    aimX: x + 1,
    aimY: y,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashing: 0,
    invuln: 0,
    walkPhase: 0,
    // Upgrade stacks, keyed by upgrade id.
    stacks: {},
    // Derived stats, recomputed by applyUpgrades in world.js.
    fireInterval: PLAYER.fireInterval,
    bulletDamage: PLAYER.bulletDamage,
    bulletCount: 1,
    pierce: 0,
    speed: PLAYER.speed,
    pickupRadius: PLAYER.pickupRadius,
    hasDash: false,
    slowOnHit: 0,
    comboWindow: 3.0,
  };
}

export function makeBullet(x, y, angle, speed, damage, pierce, slow) {
  return {
    kind: 'bullet',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: PLAYER.bulletRadius,
    damage,
    pierce,
    slow,
    life: 1.6,
    hitIds: new Set(),
  };
}

let nextEnemyId = 1;

export function makeEnemy(kind, x, y, wave) {
  const def = ENEMIES[kind];
  const hpScale = 1 + (wave - 1) * 0.08;
  const enemy = {
    id: nextEnemyId,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed * (0.9 + Math.random() * 0.2),
    score: def.score,
    damage: def.damage,
    color: def.color,
    slowTimer: 0,
    shootTimer: 1.5 + Math.random() * 1.5,
    wobble: Math.random() * Math.PI * 2,
    flash: 0,
  };
  nextEnemyId += 1;
  return enemy;
}

// Enemy bullets (spitter and warden shots) travel like player bullets but
// hurt only the player.
export function makeEnemyBullet(x, y, angle, speed, damage) {
  return {
    kind: 'enemyBullet',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 7,
    damage,
    life: 4,
  };
}

export function makeParticle(x, y, color, count, speed, life, size) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    parts.push({
      kind: 'particle',
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      radius: size * (0.5 + Math.random()),
      color,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
    });
  }
  return parts;
}

export function makePickup(kind, x, y) {
  return {
    kind: 'pickup',
    pickupKind: kind, // 'ember' | 'heart' | 'star'
    x,
    y,
    vx: 0,
    vy: 0,
    radius: kind === 'ember' ? 7 : 12,
    life: 12,
    bob: Math.random() * Math.PI * 2,
  };
}

// Floating score text that rises and fades.
export function makeFloater(x, y, text, color) {
  return {
    kind: 'floater',
    x,
    y,
    text,
    color,
    life: 1.0,
    maxLife: 1.0,
  };
}

// Clamp a point inside the arena (leaving a margin for the radius).
export function clampToArena(entity, margin) {
  const m = margin + entity.radius;
  entity.x = Math.max(m, Math.min(VIEW_W - m, entity.x));
  entity.y = Math.max(m, Math.min(VIEW_H - m, entity.y));
}

export function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
