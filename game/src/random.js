// Emberward — deterministic randomness.
// A tiny mulberry32 generator plus the helpers the world uses. Gameplay runs
// on Math.random by default; the ?shot= screenshot scenes seed one of these
// so every render of a scene is identical.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max] inclusive.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick a float in [min, max).
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one element of an array.
export function randPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// A point on a circle of the given radius around a centre.
export function ringPoint(rng, cx, cy, radius) {
  const angle = rng() * Math.PI * 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

// Shuffle a copy of an array (Fisher-Yates) with the given generator.
export function shuffled(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
