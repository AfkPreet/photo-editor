import { mulberry32 } from '../lib/random';

export const NOISE_SIZE = 192;

/** Coarse noise grid sampled bilinearly, giving clumpy film-like grain rather than per-pixel static. */
export function makeNoise(seed: number, size = NOISE_SIZE): Float32Array {
  const rand = mulberry32(seed);
  const n = new Float32Array(size * size);
  for (let i = 0; i < n.length; i++) n[i] = rand() * 2 - 1;
  return n;
}
