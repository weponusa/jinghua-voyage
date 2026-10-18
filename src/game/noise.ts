/** Small deterministic value-noise helpers used by terrain, foliage and sky (no dependencies). */

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** Smooth 2D value noise in [-1, 1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = fade(x - xi)
  const yf = fade(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return (a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf) * 2 - 1
}

/** Fractal noise, roughly in [-1, 1]. */
export function fbm(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * freq, y * freq, seed + i * 17) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

/** Periodic 1D noise on a circle (for coastlines and horizon ridges): angle in radians. */
export function ringNoise(angle: number, seed = 0, freq = 3, octaves = 3): number {
  return fbm(Math.cos(angle) * freq + 11.3, Math.sin(angle) * freq - 7.1, seed, octaves)
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Distance from point p to segment ab (2D). */
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}
