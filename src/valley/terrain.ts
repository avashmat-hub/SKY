import * as THREE from 'three';

export const LOOP_LENGTH = 240.0;
export const TAU = Math.PI * 2;
export const K1 = TAU / LOOP_LENGTH;
export const K2 = (TAU * 2.0) / LOOP_LENGTH;
export const K3 = (TAU * 3.0) / LOOP_LENGTH;

/**
 * Deterministic PRNG (Mulberry32) so flower patches and terrain details
 * distribute organically and reproducibly.
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Periodic valley centerline X offset along Z.
 * Must match the GLSL helper in shaders.ts identically so wrapped sprites
 * remain seated flush on the terrain slopes at any infinite scroll distance.
 */
export function getValleyCenterX(z: number): number {
  return Math.sin(z * K1) * 16.0 + Math.sin(z * K2 + 1.1) * 6.5;
}

/**
 * Derivative dX/dZ of the valley centerline, used for camera heading & banking.
 */
export function getValleyCenterSlopeX(z: number): number {
  return Math.cos(z * K1) * 16.0 * K1 + Math.cos(z * K2 + 1.1) * 6.5 * K2;
}

/**
 * Periodic undulating valley terrain elevation at local cross-valley offset `dx`
 * and world `z`. Matches GLSL `getValleyHeight(dx, z)` identically.
 */
export function getValleyHeight(dx: number, z: number): number {
  const absDx = Math.abs(dx);
  // Gentle central meadow trough rising into sweeping nocturnal valley walls
  const valleyWall = Math.pow(absDx * 0.055, 2.05) * 9.5;
  const shoulderRoll = Math.sin(absDx * 0.14 + z * K2) * 1.15 * Math.min(1.0, absDx * 0.08);
  const floorWave =
    Math.sin(z * K1 + dx * 0.07) * 1.45 +
    Math.cos(z * K3 - dx * 0.11) * 0.72 +
    Math.sin(dx * 0.24 + z * K2) * 0.42;

  return valleyWall + shoulderRoll + floorWave - 2.6;
}

/**
 * Samples the camera position & look-at target along the endless winding valley path
 * (procedural equivalent of the smooth camera-path07 trajectory).
 */
export function sampleCameraPath(
  zPos: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3
): number {
  const centerX = getValleyCenterX(zPos);
  const floorY = getValleyHeight(0, zPos);

  // Subtle organic sway & breathing hover height above the midnight meadow
  const swayX = Math.sin(zPos * K2 * 0.5) * 1.4;
  const hoverHeight = 4.35 + Math.sin(zPos * K1 * 2.0 + 0.6) * 0.55;

  outPosition.set(centerX + swayX, floorY + hoverHeight, zPos);

  // Look ahead smoothly along the winding valley corridor (traveling toward -Z)
  const lookAheadZ = zPos - 28.0;
  const lookCenterX = getValleyCenterX(lookAheadZ);
  const lookFloorY = getValleyHeight(0, lookAheadZ);
  outTarget.set(lookCenterX, lookFloorY + 3.2, lookAheadZ);

  // Return subtle roll angle proportional to curve curvature
  const slopeNow = getValleyCenterSlopeX(zPos);
  const slopeNext = getValleyCenterSlopeX(zPos - 14.0);
  return THREE.MathUtils.clamp((slopeNext - slopeNow) * 0.42, -0.075, 0.075);
}
