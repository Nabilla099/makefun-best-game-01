// Emberward — the simulation: waves, combat, upgrades, scoring.
// The World owns every entity and the state machine (title, playing,
// upgrade choice, paused, game over). It advances in fixed 1/60 s steps
// and knows nothing about drawing; render.js reads this state.

import {
  ARENA_MARGIN, BEST_KEY, COMBO, ENEMIES, PICKUPS, PLAYER, STEP,
  UPGRADES, VIEW_H, VIEW_W, WAVES,
} from './config.js';
import {
  angleTo, clampToArena, distSq, makeBullet, makeEnemy, makeEnemyBullet,
  makeFloater, makeParticle, makePickup, makePlayer,
} from './entities.js';
import { makeRng, randInt, randPick, randRange, ringPoint, shuffled } from './random.js';

export function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // storage unavailable; the best score lives for this session only
  }
}

export function comboMultiplier(combo) {
  return 1 + Math.min(Math.floor(combo / 4), 4);
}

export function recomputeStats(player) {
  const s = player.stacks;
  const rapid = s.rapid || 0;
  const heavy = s.heavy || 0;
  const twin = s.twin || 0;
  const swift = s.swift || 0;
  const pierce = s.pierce || 0;
  const magnet = s.magnet || 0;
  const dash = s.dash || 0;
  const keeper = s.keeper || 0;
  player.fireInterval = PLAYER.fireInterval * (0.78 ** rapid);
  player.bulletDamage = PLAYER.bulletDamage + heavy;
  player.bulletCount = 1 + twin;
  player.pierce = pierce;
  player.speed = PLAYER.speed * (1.12 ** swift);
  player.pickupRadius = PLAYER.pickupRadius * (1.7 ** magnet);
  player.hasDash = dash >= 1;
  player.dashCooldownMax = PLAYER.dashCooldown * (dash >= 2 ? 0.7 : 1);
  player.slowOnHit = (s.frost || 0) > 0 ? 0.35 : 0;
  player.comboWindow = COMBO.window * (1.5 ** keeper);
}

export class World {
  constructor(sound) {
    this.sound = sound;
    this.state = 'title';
    this.best = loadBest();
    this.resetRun();
    // Ambient fireflies drift over the title screen and the arena.
    this.fireflies = [];
    const rng = makeRng(20261117);
    for (let i = 0; i < 42; i += 1) {
      this.fireflies.push({
        x: rng() * VIEW_W,
        y: rng() * VIEW_H,
        phase: rng() * Math.PI * 2,
        speed: 6 + rng() * 14,
      });
    }
    this.time = 0;
  }

  resetRun() {
    this.player = makePlayer(VIEW_W / 2, VIEW_H / 2);
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];
    this.floaters = [];
    this.score = 0;
    this.wave = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.timePlayed = 0;
    this.shake = 0;
    this.waveState = 'banner';
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.bannerText = '';
    this.bannerSub = '';
    this.upgradeChoices = [];
    this.newBest = false;
    this.state = 'title';
  }

  startRun() {
    this.resetRun();
    this.state = 'playing';
    this.nextWave();
    this.sound.ensure();
    this.sound.wave();
  }

  nextWave() {
    this.wave += 1;
    this.state = 'playing';
    this.waveState = 'banner';
    this.waveTimer = WAVES.betweenSeconds;
    this.bannerText = `WAVE ${this.wave}`;
    const boss = this.wave % WAVES.bossEvery === 0;
    this.bannerSub = boss
      ? 'The Gloom Warden stirs…'
      : this.wave === 1
        ? 'Defend the lantern — WASD to move, mouse to aim, hold click to shoot'
        : 'The shadows grow bolder';
    this.buildSpawnQueue(boss);
  }

  buildSpawnQueue(boss) {
    const rng = Math.random;
    const count = WAVES.baseCount + (this.wave - 1) * WAVES.perWave;
    const queue = [];
    for (let i = 0; i < count; i += 1) {
      let kind = 'drifter';
      const roll = rng();
      if (this.wave >= 4 && roll < 0.10) kind = 'brute';
      else if (this.wave >= 3 && roll < 0.30) kind = 'splitter';
      else if (this.wave >= 2 && roll < 0.52) kind = 'spitter';
      queue.push(kind);
    }
    if (boss) queue.push('warden');
    this.spawnQueue = shuffled(rng, queue);
    this.spawnTimer = 0.4;
  }

  offerUpgrades() {
    const available = UPGRADES.filter((u) => (this.player.stacks[u.id] || 0) < u.maxStacks);
    const picks = shuffled(Math.random, available).slice(0, 3);
    while (picks.length < 3) {
      picks.push({
        id: 'hoard', name: 'Ember Hoard', icon: '✦', maxStacks: 99,
        blurb: '+500 score at once.',
      });
    }
    this.upgradeChoices = picks;
    this.state = 'upgrade';
  }

  applyUpgrade(choice) {
    const player = this.player;
    if (choice.id === 'hoard') {
      this.score += 500;
      this.floaters.push(makeFloater(player.x, player.y - 30, '+500', '#ffe066'));
      this.sound.upgrade();
      this.nextWave();
      return;
    }
    player.stacks[choice.id] = (player.stacks[choice.id] || 0) + 1;
    if (choice.id === 'heart') {
      player.maxHp += 30;
      player.hp = Math.min(player.maxHp, player.hp + 30);
    }
    recomputeStats(player);
    this.sound.upgrade();
    this.nextWave();
  }

  // One fixed step. Input edges (pause, dash) are read here; render.js
  // draws whatever state results.
  update(dt, input) {
    this.time += dt;
    for (const f of this.fireflies) {
      f.phase += dt * 0.7;
      f.x += Math.sin(f.phase) * f.speed * dt;
      f.y += Math.cos(f.phase * 0.8) * f.speed * dt * 0.6;
      if (f.x < 0) f.x += VIEW_W;
      if (f.x > VIEW_W) f.x -= VIEW_W;
      if (f.y < 0) f.y += VIEW_H;
      if (f.y > VIEW_H) f.y -= VIEW_H;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    if (this.state === 'title') {
      this.updateTitle(dt);
      return;
    }
    if (this.state === 'upgrade') {
      this.updateUpgrade(input);
      this.updateParticles(dt);
      this.updateFloaters(dt);
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        this.state = 'playing';
        this.sound.click();
      }
      return;
    }
    if (this.state === 'gameover') {
      this.updateParticles(dt);
      this.updateFloaters(dt);
      if (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.wasMousePressed()) {
        this.startRun();
      }
      return;
    }
    // playing
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.state = 'paused';
      this.sound.click();
      return;
    }
    this.timePlayed += dt;
    this.updatePlaying(dt, input);
  }

  updateTitle(dt) {
    // A few wisps wander the title screen so it feels alive behind the menu.
    if (this.enemies.length < 5 && Math.random() < dt * 0.6) {
      const p = ringPoint(Math.random, VIEW_W / 2, VIEW_H / 2, 300 + Math.random() * 120);
      this.enemies.push(makeEnemy(randPick(Math.random, ['drifter', 'spitter']), p.x, p.y, 1));
    }
    for (const e of this.enemies) {
      e.wobble += dt;
      e.x += Math.cos(e.wobble) * 24 * dt;
      e.y += Math.sin(e.wobble * 0.7) * 24 * dt;
      clampToArena(e, ARENA_MARGIN);
    }
    this.updateParticles(dt);
  }

  updateUpgrade(input) {
    const picks = this.upgradeChoices;
    for (let i = 0; i < picks.length; i += 1) {
      if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) {
        this.applyUpgrade(picks[i]);
        return;
      }
    }
    if (input.wasMousePressed()) {
      const cardW = 300;
      const gap = 28;
      const total = cardW * 3 + gap * 2;
      const x0 = (VIEW_W - total) / 2;
      const y0 = 300;
      for (let i = 0; i < picks.length; i += 1) {
        const x = x0 + i * (cardW + gap);
        if (input.mouseX >= x && input.mouseX <= x + cardW
          && input.mouseY >= y0 && input.mouseY <= y0 + 190) {
          this.applyUpgrade(picks[i]);
          return;
        }
      }
    }
  }

  updatePlaying(dt, input) {
    const player = this.player;

    if (this.waveState === 'banner') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.waveState = 'fighting';
      this.updateParticles(dt);
      this.updateFloaters(dt);
      return;
    }

    // --- spawning ---------------------------------------------------------
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.45;
        const kind = this.spawnQueue.pop();
        const p = this.spawnPoint();
        this.enemies.push(makeEnemy(kind, p.x, p.y, this.wave));
      }
    } else if (this.enemies.length === 0 && this.enemyBullets.length === 0) {
      // Wave cleared: bonus, then the upgrade choice.
      const bonus = 100 * this.wave;
      this.score += bonus;
      this.floaters.push(makeFloater(player.x, player.y - 40, `WAVE CLEAR +${bonus}`, '#ffe066'));
      this.sound.wave();
      this.offerUpgrades();
      return;
    }

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (player.hp <= 0) this.gameOver();
  }

  spawnPoint() {
    // Spawn at an arena edge, at least 260 px from the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const side = randInt(Math.random, 0, 3);
      let x;
      let y;
      const m = ARENA_MARGIN + 20;
      if (side === 0) { x = randRange(Math.random, m, VIEW_W - m); y = m; }
      else if (side === 1) { x = randRange(Math.random, m, VIEW_W - m); y = VIEW_H - m; }
      else if (side === 2) { x = m; y = randRange(Math.random, m, VIEW_H - m); }
      else { x = VIEW_W - m; y = randRange(Math.random, m, VIEW_H - m); }
      const dx = x - this.player.x;
      const dy = y - this.player.y;
      if (dx * dx + dy * dy > 260 * 260) return { x, y };
    }
    return { x: ARENA_MARGIN + 20, y: ARENA_MARGIN + 20 };
  }

  updatePlayer(dt, input) {
    const p = this.player;
    p.aimX = input.mouseX;
    p.aimY = input.mouseY;
    const move = input.moveVector();

    if (p.invuln > 0) p.invuln -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;

    if (p.hasDash && input.dashPressed() && p.dashCooldown <= 0 && p.dashing <= 0) {
      p.dashing = PLAYER.dashTime;
      p.dashCooldown = p.dashCooldownMax || PLAYER.dashCooldown;
      p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.1);
      this.sound.dash();
      this.particles.push(...makeParticle(p.x, p.y, '#7fe7d2', 10, 180, 0.4, 3));
    }

    let tx = move.x * p.speed;
    let ty = move.y * p.speed;
    if (p.dashing > 0) {
      p.dashing -= dt;
      const dirX = move.x !== 0 || move.y !== 0 ? move.x : Math.cos(Math.atan2(p.aimY - p.y, p.aimX - p.x));
      const dirY = move.x !== 0 || move.y !== 0 ? move.y : Math.sin(Math.atan2(p.aimY - p.y, p.aimX - p.x));
      tx = dirX * PLAYER.dashSpeed;
      ty = dirY * PLAYER.dashSpeed;
    }
    const accel = p.dashing > 0 ? 1 : 12;
    p.vx += (tx - p.vx) * Math.min(1, accel * dt);
    p.vy += (ty - p.vy) * Math.min(1, accel * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampToArena(p, ARENA_MARGIN);
    p.walkPhase += Math.hypot(p.vx, p.vy) * dt * 0.06;

    // Firing: a spread of embers toward the mouse.
    p.fireTimer -= dt;
    if (input.firing() && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      const base = Math.atan2(p.aimY - p.y, p.aimX - p.x);
      const n = p.bulletCount;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * 0.13;
        const bx = p.x + Math.cos(base) * (p.radius + 6);
        const by = p.y + Math.sin(base) * (p.radius + 6);
        this.bullets.push(makeBullet(bx, by, base + off, PLAYER.bulletSpeed, p.bulletDamage, p.pierce, p.slowOnHit));
      }
      this.shotsFired += 1;
      this.sound.shoot();
      p.vx -= Math.cos(base) * 14;
      p.vy -= Math.sin(base) * 14;
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.flash > 0) e.flash -= dt;
      if (e.slowTimer > 0) e.slowTimer -= dt;
      const slowFactor = e.slowTimer > 0 ? 0.65 : 1;
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const nx = (p.x - e.x) / d;
      const ny = (p.y - e.y) / d;
      e.wobble += dt * 2;

      if (e.kind === 'spitter') {
        // Keep a shooting distance, strafe sideways.
        const want = 260;
        const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
        const strafe = Math.sin(e.wobble) * 0.8;
        e.vx = (nx * radial + -ny * strafe) * e.speed * slowFactor;
        e.vy = (ny * radial + nx * strafe) * e.speed * slowFactor;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 560) {
          e.shootTimer = 2.4;
          const a = angleTo(e, p);
          this.enemyBullets.push(makeEnemyBullet(e.x, e.y, a, 190, e.damage));
          this.sound.spit();
        }
      } else if (e.kind === 'warden') {
        e.vx = nx * e.speed * slowFactor;
        e.vy = ny * e.speed * slowFactor;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 3.0;
          for (let i = 0; i < 10; i += 1) {
            const a = (i / 10) * Math.PI * 2 + e.wobble;
            this.enemyBullets.push(makeEnemyBullet(e.x, e.y, a, 150, 14));
          }
          this.shake = Math.max(this.shake, 6);
          this.sound.die();
        }
      } else {
        // Drifters, splitters, minis and brutes chase, with a wobble.
        const wob = Math.sin(e.wobble) * 0.35;
        e.vx = (nx + -ny * wob) * e.speed * slowFactor;
        e.vy = (ny + nx * wob) * e.speed * slowFactor;
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      clampToArena(e, ARENA_MARGIN);

      // Touching the player hurts.
      if (p.invuln <= 0 && p.dashing <= 0) {
        const rr = e.radius + p.radius;
        if (distSq(e, p) < rr * rr) {
          this.hurtPlayer(e.damage);
          // Knock the enemy back so it cannot hit twice in one touch.
          e.x -= nx * 30;
          e.y -= ny * 30;
        }
      }
    }
  }

  hurtPlayer(damage) {
    const p = this.player;
    p.hp -= damage;
    p.invuln = PLAYER.invulnTime;
    this.shake = Math.max(this.shake, 9);
    this.combo = 0;
    this.comboTimer = 0;
    this.particles.push(...makeParticle(p.x, p.y, '#ff5f6d', 14, 240, 0.5, 3.5));
    this.sound.hurt();
  }

  updateBullets(dt) {
    const dead = new Set();
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > VIEW_W || b.y < 0 || b.y > VIEW_H) {
        dead.add(b);
        continue;
      }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue; // already felled this frame by another ember
        if (b.hitIds.has(e.id)) continue;
        const rr = b.radius + e.radius;
        if (distSq(b, e) < rr * rr) {
          this.hits += 1;
          b.hitIds.add(e.id);
          e.hp -= b.damage;
          e.flash = 0.09;
          if (b.slow > 0) e.slowTimer = 1.2;
          this.particles.push(...makeParticle(b.x, b.y, '#ffcf5c', 4, 140, 0.3, 2.5));
          this.sound.hit();
          if (e.hp <= 0) this.killEnemy(e);
          if (b.hitIds.size > b.pierce) {
            dead.add(b);
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !dead.has(b));
  }

  updateEnemyBullets(dt) {
    const p = this.player;
    const dead = new Set();
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > VIEW_W + 20 || b.y < -20 || b.y > VIEW_H + 20) {
        dead.add(b);
        continue;
      }
      if (p.invuln <= 0 && p.dashing <= 0) {
        const rr = b.radius + p.radius;
        if (distSq(b, p) < rr * rr) {
          this.hurtPlayer(b.damage);
          dead.add(b);
        }
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !dead.has(b));
  }

  killEnemy(enemy) {
    const mult = comboMultiplier(this.combo);
    const gained = enemy.score * mult;
    this.score += gained;
    this.kills += 1;
    this.combo += COMBO.perKill;
    this.comboTimer = this.player.comboWindow;
    this.floaters.push(makeFloater(enemy.x, enemy.y, `+${gained}`, '#ffe066'));
    this.particles.push(...makeParticle(enemy.x, enemy.y, '#b78cff', 16, 260, 0.6, 3.5));
    this.particles.push(...makeParticle(enemy.x, enemy.y, '#ffcf5c', 8, 180, 0.4, 3));
    this.sound.die();
    if (enemy.kind === 'warden') this.shake = Math.max(this.shake, 12);

    // Splitters burst into two minis.
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const mini = makeEnemy('mini', enemy.x + (i === 0 ? -14 : 14), enemy.y, this.wave);
        this.enemies.push(mini);
      }
    }

    // Drops: embers always, a heart or a star sometimes.
    const emberCount = enemy.kind === 'warden' ? 8 : enemy.kind === 'brute' ? 3 : 1;
    for (let i = 0; i < emberCount; i += 1) {
      this.pickups.push(makePickup('ember',
        enemy.x + randRange(Math.random, -14, 14),
        enemy.y + randRange(Math.random, -14, 14)));
    }
    const roll = Math.random();
    if (roll < PICKUPS.starDropChance) this.pickups.push(makePickup('star', enemy.x, enemy.y));
    else if (roll < PICKUPS.starDropChance + PICKUPS.heartDropChance) {
      this.pickups.push(makePickup('heart', enemy.x, enemy.y));
    }

    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.life -= dt;
      pk.bob += dt * 4;
      const d2 = distSq(pk, p);
      const magnetR = p.pickupRadius;
      if (d2 < magnetR * magnetR) {
        const d = Math.sqrt(d2) || 1;
        const pull = 420 * (1 - d / (magnetR * 1.4));
        pk.vx += ((p.x - pk.x) / d) * pull * dt * 6;
        pk.vy += ((p.y - pk.y) / d) * pull * dt * 6;
      }
      pk.vx *= 0.92;
      pk.vy *= 0.92;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      const rr = pk.radius + p.radius;
      if (d2 < rr * rr) {
        pk.life = 0;
        if (pk.pickupKind === 'ember') {
          this.score += PICKUPS.emberValue;
          this.sound.pickup();
        } else if (pk.pickupKind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + PICKUPS.heartHeal);
          this.floaters.push(makeFloater(p.x, p.y - 26, `+${PICKUPS.heartHeal} HP`, '#ff6b81'));
          this.sound.heart();
        } else {
          this.score += PICKUPS.starScore;
          this.floaters.push(makeFloater(p.x, p.y - 26, `+${PICKUPS.starScore}`, '#ffe066'));
          this.sound.star();
        }
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  gameOver() {
    this.state = 'gameover';
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      saveBest(this.score);
    }
    this.sound.over();
  }
}
