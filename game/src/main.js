// Emberward — entry point: the game loop and the top-level state machine.
// The World advances in fixed 1/60 s steps; this file owns the animation
// frame, the title-screen start, and the mute key. With ?shot= in the URL
// the game renders one deterministic scene instead (see shots.js).

import { STEP, MAX_STEPS_PER_FRAME, VIEW_H, VIEW_W } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const sound = new SoundBank();
const input = new Input(canvas);
const world = new World(sound);
const renderer = new Renderer(canvas);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

function beginIfTitle() {
  if (world.state !== 'title') return;
  sound.ensure();
  sound.click();
  world.startRun();
}

if (shot) {
  // Screenshot mode: one fixed scene, then signal readiness.
  const seed = Number(params.get('seed')) || 1;
  setupShot(world, shot, seed);
  renderer.draw(world, input);
  window.__shotReady = true;
} else {
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += elapsed;

    if (input.wasPressed('KeyM')) {
      const muted = sound.toggleMute();
      void muted;
    }
    if (world.state === 'title'
      && (input.wasPressed('Enter') || input.wasMousePressed())) {
      beginIfTitle();
    }
    if (input.anyGesture) sound.ensure();

    let steps = 0;
    while (accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
      world.update(STEP, input);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;

    renderer.draw(world, input);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
