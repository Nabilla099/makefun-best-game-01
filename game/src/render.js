// Emberward — everything the player sees, drawn on one 2D canvas.
// The renderer reads the World and never mutates it, except for the
// precomputed grass tufts it keeps for the arena floor. Screens: title,
// HUD + banners during play, upgrade cards, pause, and game over.

import { ARENA_MARGIN, PALETTE, UPGRADES, VIEW_H, VIEW_W } from './config.js';
import { comboMultiplier } from './world.js';
import { makeRng } from './random.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', font = 'bold') {
  ctx.fillStyle = color;
  ctx.font = `${font} ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Fixed grass tufts and pebbles so the floor does not shimmer.
    const rng = makeRng(777);
    this.tufts = [];
    for (let i = 0; i < 90; i += 1) {
      this.tufts.push({
        x: ARENA_MARGIN + rng() * (VIEW_W - ARENA_MARGIN * 2),
        y: ARENA_MARGIN + rng() * (VIEW_H - ARENA_MARGIN * 2),
        kind: rng() < 0.7 ? 'tuft' : 'pebble',
        s: 2 + rng() * 4,
      });
    }
  }

  draw(world, input) {
    const ctx = this.ctx;
    ctx.save();
    if (world.shake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * world.shake,
        (Math.random() - 0.5) * world.shake,
      );
    }
    this.drawBackground(world);
    this.drawLantern(world);
    this.drawPickups(world);
    this.drawEnemies(world);
    if (world.state !== 'title') this.drawPlayer(world);
    this.drawBullets(world);
    this.drawParticles(world);
    this.drawFloaters(world);
    ctx.restore();

    if (world.state === 'title') this.drawTitle(world);
    else if (world.state === 'playing' || world.state === 'paused') this.drawHud(world);
    if (world.state === 'playing' && world.waveState === 'banner') this.drawBanner(world);
    if (world.state === 'upgrade') this.drawUpgrade(world, input);
    if (world.state === 'paused') this.drawPaused(world);
    if (world.state === 'gameover') this.drawGameOver(world);
  }

  drawBackground(world) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Arena floor.
    ctx.fillStyle = PALETTE.ground;
    roundRect(ctx, ARENA_MARGIN, ARENA_MARGIN, VIEW_W - ARENA_MARGIN * 2, VIEW_H - ARENA_MARGIN * 2, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.groundLine;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Grass tufts and pebbles.
    ctx.fillStyle = PALETTE.grassTuft;
    for (const t of this.tufts) {
      if (t.kind === 'tuft') {
        ctx.beginPath();
        ctx.moveTo(t.x - t.s, t.y);
        ctx.lineTo(t.x, t.y - t.s * 2);
        ctx.lineTo(t.x + t.s, t.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.s * 0.5, 0, TAU);
        ctx.fill();
      }
    }

    // Fireflies.
    for (const f of world.fireflies) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(f.phase * 2));
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The lantern at the arena's heart: the thing the player guards. Its
  // glow pulses and warms everything near it.
  drawLantern(world) {
    const ctx = this.ctx;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const pulse = 0.75 + 0.25 * Math.sin(world.time * 1.6);
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190 * pulse);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 200, cy - 200, 400, 400);

    ctx.fillStyle = '#3a2b1c';
    ctx.fillRect(cx - 3, cy + 8, 6, 26);
    ctx.fillStyle = '#2a1f14';
    ctx.fillRect(cx - 12, cy + 30, 24, 6);
    // Lantern body.
    ctx.fillStyle = '#ffb347';
    roundRect(ctx, cx - 16, cy - 22, 32, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    roundRect(ctx, cx - 10, cy - 16, 20, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#3a2b1c';
    ctx.fillRect(cx - 18, cy - 26, 36, 5);
  }

  drawPickups(world) {
    const ctx = this.ctx;
    for (const pk of world.pickups) {
      const bob = Math.sin(pk.bob) * 2;
      if (pk.pickupKind === 'ember') {
        ctx.fillStyle = PALETTE.ember;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, pk.radius, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PALETTE.emberHot;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, pk.radius * 0.45, 0, TAU);
        ctx.fill();
      } else if (pk.pickupKind === 'heart') {
        this.drawHeart(pk.x, pk.y + bob, 11, PALETTE.heart);
      } else {
        this.drawStar(pk.x, pk.y + bob, 13, PALETTE.star);
      }
    }
  }

  drawHeart(x, y, s, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.8);
    ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.2, y, x, y + s * 0.8);
    ctx.fill();
  }

  drawStar(x, y, r, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawEnemies(world) {
    const ctx = this.ctx;
    for (const e of world.enemies) {
      const color = PALETTE[e.color] || PALETTE.wisp;
      const core = e.kind === 'brute' || e.kind === 'warden' ? PALETTE.bruteCore : PALETTE.wispCore;
      // Shadow aura.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(e.x, e.y + e.radius * 0.7, e.radius * 0.9, 0, TAU);
      ctx.fill();
      // Body: a wisp with a wobbling outline.
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : color;
      ctx.beginPath();
      const spikes = e.kind === 'warden' ? 10 : 8;
      for (let i = 0; i <= spikes; i += 1) {
        const a = (i / spikes) * TAU;
        const r = e.radius * (1 + 0.16 * Math.sin(a * 3 + e.wobble));
        const px = e.x + Math.cos(a) * r;
        const py = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Core and eyes.
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      const eyeOff = e.radius * 0.32;
      const eyeR = Math.max(2, e.radius * 0.11);
      ctx.beginPath();
      ctx.arc(e.x - eyeOff, e.y - 2, eyeR, 0, TAU);
      ctx.arc(e.x + eyeOff, e.y - 2, eyeR, 0, TAU);
      ctx.fill();
      // Health bar for tough foes.
      if (e.maxHp >= 10) {
        const w = e.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        ctx.fillStyle = PALETTE.danger;
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
      }
      // Slow tint.
      if (e.slowTimer > 0) {
        ctx.strokeStyle = 'rgba(160, 220, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 3, 0, TAU);
        ctx.stroke();
      }
    }
  }

  drawPlayer(world) {
    const ctx = this.ctx;
    const p = world.player;
    if (p.invuln > 0 && Math.floor(world.time * 14) % 2 === 0 && p.dashing <= 0) return; // blink
    const aim = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    // Lantern glow around the keeper.
    const glow = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 64);
    glow.addColorStop(0, 'rgba(255, 207, 92, 0.35)');
    glow.addColorStop(1, 'rgba(255, 207, 92, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 70, p.y - 70, 140, 140);
    // Cloak: a circle with a little bob.
    const bob = Math.sin(p.walkPhase) * 1.5;
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, p.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, p.radius - 4, 0, TAU);
    ctx.fill();
    // Face and hood point toward the aim.
    ctx.fillStyle = '#123b34';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(aim) * 5, p.y + bob + Math.sin(aim) * 5, 4.5, 0, TAU);
    ctx.fill();
    // The ember staff, pointing at the mouse.
    ctx.strokeStyle = '#8a6a3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(aim) * 8, p.y + bob - Math.sin(aim) * 8);
    ctx.lineTo(p.x + Math.cos(aim) * 20, p.y + bob + Math.sin(aim) * 20);
    ctx.stroke();
    ctx.fillStyle = PALETTE.emberHot;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(aim) * 23, p.y + bob + Math.sin(aim) * 23, 4.5, 0, TAU);
    ctx.fill();
    // Dash cooldown ring.
    if (p.hasDash) {
      const frac = 1 - Math.max(0, p.dashCooldown) / (p.dashCooldownMax || 1);
      ctx.strokeStyle = 'rgba(127, 231, 210, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, p.radius + 7, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      ctx.stroke();
    }
  }

  drawBullets(world) {
    const ctx = this.ctx;
    for (const b of world.bullets) {
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.emberHot;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius - 1.5, 0, TAU);
      ctx.fill();
    }
    for (const b of world.enemyBullets) {
      ctx.fillStyle = PALETTE.spitter;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd7f2';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, TAU);
      ctx.fill();
    }
  }

  drawParticles(world) {
    const ctx = this.ctx;
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(world) {
    const ctx = this.ctx;
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(ctx, f.text, f.x, f.y, 17, f.color);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(world) {
    const ctx = this.ctx;
    const p = world.player;
    // Top bar.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 16, 12, 420, 64, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, `SCORE  ${world.score}`, 32, 32, 22, PALETTE.text, 'left');
    text(ctx, `BEST  ${world.best}`, 32, 58, 15, PALETTE.textDim, 'left');
    text(ctx, `WAVE ${world.wave}`, 300, 32, 22, PALETTE.ember, 'left');
    const left = world.spawnQueue.length + world.enemies.length;
    text(ctx, left > 0 ? `foes left ${left}` : 'clear!', 300, 58, 15, PALETTE.textDim, 'left');

    // Health bar, top right.
    const bw = 260;
    const bx = VIEW_W - bw - 16;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, bx - 8, 12, bw + 16, 64, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    text(ctx, `HEALTH  ${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`, bx, 32, 16, PALETTE.text, 'left');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, bx, 46, bw, 14, 7);
    ctx.fill();
    const hfrac = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = hfrac > 0.5 ? '#7fe7a8' : hfrac > 0.25 ? '#ffcf5c' : PALETTE.danger;
    if (hfrac > 0) {
      roundRect(ctx, bx, 46, bw * hfrac, 14, 7);
      ctx.fill();
    }

    // Combo meter, bottom left.
    if (world.combo > 1) {
      const mult = comboMultiplier(world.combo);
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, 16, VIEW_H - 64, 220, 48, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.stroke();
      text(ctx, `COMBO x${mult}`, 32, VIEW_H - 46, 20, PALETTE.ember, 'left');
      const cfrac = Math.max(0, world.comboTimer / p.comboWindow);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, 32, VIEW_H - 32, 188, 8, 4);
      ctx.fill();
      ctx.fillStyle = PALETTE.ember;
      roundRect(ctx, 32, VIEW_H - 32, 188 * cfrac, 8, 4);
      ctx.fill();
    }

    // Owned upgrades, bottom right.
    const owned = Object.entries(p.stacks).filter(([, n]) => n > 0);
    if (owned.length > 0) {
      const names = owned.map(([id, n]) => {
        const def = UPGRADES.find((u) => u.id === id);
        return def ? `${def.icon}${n > 1 ? `x${n}` : ''}` : id;
      });
      text(ctx, names.join('   '), VIEW_W - 24, VIEW_H - 28, 20, PALETTE.textDim, 'right');
    }
    text(ctx, 'P pause · M mute · Shift dash', VIEW_W / 2, VIEW_H - 16, 13, PALETTE.textDim);
  }

  drawBanner(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8, 10, 26, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, world.bannerText, VIEW_W / 2, VIEW_H / 2 - 30, 54, PALETTE.ember);
    text(ctx, world.bannerSub, VIEW_W / 2, VIEW_H / 2 + 22, 20, PALETTE.text);
  }

  drawTitle(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8, 10, 26, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'EMBERWARD', VIEW_W / 2, 168, 72, PALETTE.ember);
    text(ctx, 'Guardian of the Last Lantern', VIEW_W / 2, 226, 26, PALETTE.text);
    text(ctx, 'The night sends its shadows. Hold the grove until dawn —', VIEW_W / 2, 300, 19, PALETTE.textDim);
    text(ctx, 'one wave at a time.', VIEW_W / 2, 326, 19, PALETTE.textDim);
    // How to play card.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, VIEW_W / 2 - 300, 360, 600, 150, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, 'WASD / arrows — move', VIEW_W / 2, 392, 19, PALETTE.text);
    text(ctx, 'Mouse — aim · hold click / Space — shoot embers', VIEW_W / 2, 424, 19, PALETTE.text);
    text(ctx, 'Shift — dash (once unlocked) · P — pause · M — mute', VIEW_W / 2, 456, 19, PALETTE.text);
    text(ctx, 'Clear each wave, then choose an upgrade. Survive.', VIEW_W / 2, 488, 19, PALETTE.textDim);
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'CLICK OR PRESS ENTER TO BEGIN', VIEW_W / 2, 566, 24, PALETTE.emberHot);
    ctx.globalAlpha = 1;
    if (world.best > 0) text(ctx, `Best score: ${world.best}`, VIEW_W / 2, 612, 18, PALETTE.textDim);
  }

  drawUpgrade(world, input) {
    const ctx = this.ctx;
    this.drawHud(world);
    ctx.fillStyle = 'rgba(8, 10, 26, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, `WAVE ${world.wave} CLEARED`, VIEW_W / 2, 150, 40, PALETTE.ember);
    text(ctx, 'Choose an upgrade — click a card or press 1, 2 or 3', VIEW_W / 2, 200, 20, PALETTE.text);
    const cardW = 300;
    const cardH = 190;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const x0 = (VIEW_W - total) / 2;
    const y0 = 300;
    world.upgradeChoices.forEach((choice, i) => {
      const x = x0 + i * (cardW + gap);
      const hover = input.mouseX >= x && input.mouseX <= x + cardW
        && input.mouseY >= y0 && input.mouseY <= y0 + cardH;
      ctx.fillStyle = hover ? 'rgba(38, 48, 92, 0.95)' : PALETTE.panel;
      roundRect(ctx, x, y0, cardW, cardH, 14);
      ctx.fill();
      ctx.strokeStyle = hover ? PALETTE.ember : PALETTE.panelEdge;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.stroke();
      text(ctx, choice.icon, x + cardW / 2, y0 + 46, 40, PALETTE.ember);
      text(ctx, choice.name, x + cardW / 2, y0 + 92, 21, PALETTE.text);
      text(ctx, choice.blurb, x + cardW / 2, y0 + 128, 16, PALETTE.textDim);
      const owned = world.player.stacks[choice.id] || 0;
      text(ctx, owned > 0 ? `owned x${owned}` : 'press ' + (i + 1), x + cardW / 2, y0 + 162, 15, PALETTE.textDim);
    });
  }

  drawPaused(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8, 10, 26, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'PAUSED', VIEW_W / 2, VIEW_H / 2 - 20, 48, PALETTE.text);
    text(ctx, 'Press P or Esc to continue', VIEW_W / 2, VIEW_H / 2 + 30, 20, PALETTE.textDim);
  }

  drawGameOver(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8, 10, 26, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'THE LANTERN FADES', VIEW_W / 2, 168, 52, PALETTE.danger);
    text(ctx, 'The shadows take the grove… this time.', VIEW_W / 2, 222, 20, PALETTE.textDim);
    if (world.newBest) text(ctx, '★ NEW BEST SCORE ★', VIEW_W / 2, 262, 24, PALETTE.star);
    // Results card.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, VIEW_W / 2 - 260, 290, 520, 190, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const acc = world.shotsFired > 0 ? Math.round((world.hits / Math.max(1, world.shotsFired)) * 100) : 0;
    const mins = Math.floor(world.timePlayed / 60);
    const secs = Math.floor(world.timePlayed % 60).toString().padStart(2, '0');
    text(ctx, `SCORE   ${world.score}`, VIEW_W / 2, 330, 30, PALETTE.ember);
    text(ctx, `Waves cleared   ${Math.max(0, world.wave - 1)}      Foes felled   ${world.kills}`, VIEW_W / 2, 378, 19, PALETTE.text);
    text(ctx, `Accuracy   ${acc}%      Time   ${mins}:${secs}`, VIEW_W / 2, 414, 19, PALETTE.text);
    text(ctx, `Best   ${world.best}`, VIEW_W / 2, 450, 19, PALETTE.textDim);
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', VIEW_W / 2, 540, 24, PALETTE.emberHot);
    ctx.globalAlpha = 1;
  }
}
