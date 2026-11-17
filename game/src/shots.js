// Emberward — deterministic screenshot scenes.
// When the page is opened with ?shot=start|play|end&seed=N, the game is put
// into a fixed scene and rendered once, so the screenshots are real renders
// of the game's own code at a repeatable moment. The live game never uses
// this path.

import { STEP, VIEW_H, VIEW_W } from './config.js';
import { recomputeStats } from './world.js';
import { makeRng } from './random.js';

// A scripted input that steers the player in a slow circle and keeps the
// trigger held, aiming at the nearest foe — enough to fill a play shot
// with bullets, particles and a combo.
function scriptedInput(world, t) {
  const p = world.player;
  const angle = t * 0.9;
  let aimX = p.x + 200;
  let aimY = p.y;
  let best = Infinity;
  for (const e of world.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < best) { best = d; aimX = e.x; aimY = e.y; }
  }
  return {
    mouseX: aimX,
    mouseY: aimY,
    mouseDown: true,
    moveVector() { return { x: Math.cos(angle), y: Math.sin(angle) * 0.7 }; },
    firing() { return true; },
    dashPressed() { return false; },
    wasPressed() { return false; },
    wasMousePressed() { return false; },
    endFrame() {},
  };
}

export function setupShot(world, scene, seed) {
  const rng = makeRng(seed || 1);
  if (scene === 'start') {
    world.resetRun();
    // A few wisps wandering behind the title, placed by the seeded rng.
    for (let i = 0; i < 4; i += 1) {
      const a = rng() * Math.PI * 2;
      const r = 240 + rng() * 140;
      const kinds = ['drifter', 'spitter', 'drifter'];
      world.enemies.push({
        id: 1000 + i,
        kind: kinds[i % kinds.length],
        x: VIEW_W / 2 + Math.cos(a) * r,
        y: VIEW_H / 2 + Math.sin(a) * r * 0.7,
        vx: 0, vy: 0,
        radius: 15, hp: 2, maxHp: 2, speed: 60, score: 50, damage: 10,
        color: 'wisp', slowTimer: 0, shootTimer: 2, wobble: rng() * 6, flash: 0,
      });
    }
    world.state = 'title';
    return;
  }

  if (scene === 'play') {
    world.startRun();
    // A mid-game loadout so the frame is busy: twin flames, rapid embers.
    world.player.stacks.twin = 1;
    world.player.stacks.rapid = 1;
    recomputeStats(world.player);
    // Fight for nine simulated seconds with the scripted input, then hold
    // the frame: HUD, combo, bullets and a wave in progress.
    for (let step = 0; step < 9 * 60; step += 1) {
      const input = scriptedInput(world, step * STEP);
      world.update(STEP, input);
      if (world.state === 'upgrade') {
        world.applyUpgrade(world.upgradeChoices[0]);
      }
      if (world.state === 'gameover') break;
    }
    if (world.state === 'upgrade') world.applyUpgrade(world.upgradeChoices[0]);
    // Settle into live combat: keep stepping until the next wave is
    // fighting with foes on screen (the banner and the upgrade pause
    // would otherwise leave an empty frame).
    for (let step = 0; step < 900 && world.state === 'playing'
      && (world.waveState !== 'fighting' || world.enemies.length < 5); step += 1) {
      const input = scriptedInput(world, step * STEP);
      world.update(STEP, input);
      if (world.state === 'upgrade') world.applyUpgrade(world.upgradeChoices[0]);
      if (world.state === 'gameover') break;
    }
    return;
  }

  if (scene === 'end') {
    world.startRun();
    for (let step = 0; step < 4 * 60; step += 1) {
      const input = scriptedInput(world, step * STEP);
      world.update(STEP, input);
      if (world.state === 'upgrade') world.applyUpgrade(world.upgradeChoices[0]);
      if (world.state === 'gameover') break;
    }
    // Force the fall so the results card is always on screen, with a run
    // that reads as a real one: died on wave 4, three waves cleared.
    world.player.hp = 0;
    world.wave = 4;
    world.score = Math.max(world.score, 2450);
    world.kills = Math.max(world.kills, 57);
    world.shotsFired = Math.max(world.shotsFired, 420);
    world.hits = Math.max(world.hits, 260);
    world.timePlayed = Math.max(world.timePlayed, 196);
    world.gameOver();
  }
}
