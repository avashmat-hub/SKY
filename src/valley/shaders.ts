import { K1, K2, K3, LOOP_LENGTH } from './terrain';

const GLSL_TERRAIN_FUNCTIONS = `
const float LOOP_LENGTH = ${LOOP_LENGTH.toFixed(1)};
const float K1 = ${K1.toFixed(8)};
const float K2 = ${K2.toFixed(8)};
const float K3 = ${K3.toFixed(8)};

float getValleyCenterX(float z) {
  return sin(z * K1) * 16.0 + sin(z * K2 + 1.1) * 6.5;
}

float getValleyHeight(float dx, float z) {
  float absDx = abs(dx);
  float valleyWall = pow(absDx * 0.055, 2.05) * 9.5;
  float shoulderRoll = sin(absDx * 0.14 + z * K2) * 1.15 * min(1.0, absDx * 0.08);
  float floorWave =
    sin(z * K1 + dx * 0.07) * 1.45 +
    cos(z * K3 - dx * 0.11) * 0.72 +
    sin(dx * 0.24 + z * K2) * 0.42;
  return valleyWall + shoulderRoll + floorWave - 2.6;
}
`;

export const BOTANICAL_VERTEX_SHADER = `
${GLSL_TERRAIN_FUNCTIONS}

attribute float aLocalX;
attribute float aBaseZ;
attribute float aExtraY;
attribute float aScale;
attribute float aCellIndex;
attribute float aSeed;
attribute vec3 aTint;

uniform float uTime;
uniform float uCameraZ;
uniform float uPixelRatio;
uniform float uViewportHeight;
uniform float uAspect;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uHover;
uniform float uIntro;
uniform float uIsFlower;
uniform float uBloomNear;
uniform float uBloomFar;

varying float vCellIndex;
varying float vAlpha;
varying float vMouseGlow;
varying float vFogFactor;
varying float vRotation;
varying float vHover;
varying float vTwinkle;
varying vec3 vTint;

void main() {
  // Seamless infinite wrap ahead of camera (traveling toward -Z)
  float relZ = mod(aBaseZ - uCameraZ + 20.0, LOOP_LENGTH) - (LOOP_LENGTH - 20.0);
  float worldZ = uCameraZ + relZ;

  float centerX = getValleyCenterX(worldZ);
  float worldX = centerX + aLocalX;
  float groundY = getValleyHeight(aLocalX, worldZ);
  float worldY = groundY + aExtraY;

  // Gentle nocturnal valley breeze & firefly micro-drift
  float swayPhase = uTime * (0.75 + aSeed * 0.65) + worldX * 0.14 + worldZ * 0.09;
  float swayAmp = mix(0.16, 0.34, uIsFlower);
  worldX += sin(swayPhase) * swayAmp;
  worldY += cos(swayPhase * 0.9 + aSeed * 6.28) * swayAmp * mix(0.35, 0.75, uIsFlower);

  // Hover transition: detach tiny lights & leaves into swirling ascending embers
  float hoverEase = uHover * uHover * (3.0 - 2.0 * uHover);
  float swirlAngle = aSeed * 6.283185 + uTime * (0.38 + aSeed * 0.45);
  float swirlRad = (1.6 + aSeed * 6.8) * hoverEase;
  float lift = (2.8 + aSeed * 15.5) * hoverEase * mix(0.65, 1.35, uIsFlower);
  worldX += cos(swirlAngle) * swirlRad;
  worldY += lift + sin(uTime * 1.1 + aSeed * 14.0) * 0.65 * hoverEase;
  worldZ += sin(swirlAngle) * swirlRad;

  vec3 worldPos = vec3(worldX, worldY, worldZ);
  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
  vec4 clipPos = projectionMatrix * mvPosition;

  // Screen-space mouse repulsion & cursor proximity glow
  float mouseGlow = 0.0;
  if (clipPos.w > 0.1) {
    vec2 ndc = clipPos.xy / clipPos.w;
    vec2 delta = ndc - uMouse;
    vec2 aspectDelta = vec2(delta.x * uAspect, delta.y);
    float screenDist = length(aspectDelta);
    float radius = 0.34;
    if (screenDist < radius && uMouseActive > 0.001) {
      float t = 1.0 - screenDist / radius;
      float push = t * t * (0.24 * uMouseActive);
      vec2 pushDir = aspectDelta / max(screenDist, 0.0001);
      // Repel outward in screen space
      clipPos.x += (pushDir.x / uAspect) * push * clipPos.w;
      clipPos.y += pushDir.y * push * clipPos.w;
      mouseGlow = pow(t, 1.75) * uMouseActive;
    }
  }

  gl_Position = clipPos;

  float camDist = max(0.5, -mvPosition.z);

  // Distance-driven emergence: leaves unfurl further out, tiny lights brighten softly up close
  float bloomProgress = smoothstep(uBloomFar, uBloomNear, camDist);
  float bloomCurve = mix(0.28, 1.0, pow(bloomProgress, mix(0.82, 1.05, uIsFlower)));

  // Intro cascade
  float introMask = smoothstep(0.0, 1.0, uIntro * 1.35 - (camDist / 165.0) * 0.65 - aSeed * 0.18);

  // Subtle hover scale behavior
  float hoverScale = mix(1.0, mix(0.28, 1.18, uIsFlower), hoverEase);
  float cursorScaleBoost = 1.0 + mouseGlow * mix(0.24, 0.45, uIsFlower);

  float baseSpriteSize = aScale * bloomCurve * introMask * hoverScale * cursorScaleBoost;
  float pointSize = (baseSpriteSize * uViewportHeight * 0.85) / camDist;
  float maxPointSize = mix(180.0, 15.0, uIsFlower) * uPixelRatio;
  gl_PointSize = clamp(pointSize * uPixelRatio, 1.0, maxPointSize);

  // Smooth near-camera & far-horizon alpha fade
  float nearFade = smoothstep(1.6, 6.5, camDist);
  float farFade = 1.0 - smoothstep(145.0, 220.0, camDist);

  // Exponential nocturnal depth fog
  float fogDensity = 0.0115;
  float fog = 1.0 - exp(-pow(camDist * fogDensity, 1.72));

  vCellIndex = aCellIndex;
  vAlpha = nearFade * farFade * introMask;
  vMouseGlow = mouseGlow;
  vFogFactor = clamp(fog, 0.0, 1.0);
  vRotation = (aSeed - 0.5) * 0.7 + sin(uTime * 0.45 + aSeed * 9.0) * 0.12 + mouseGlow * 0.4;
  vHover = hoverEase;
  vTwinkle = 0.58 + 0.42 * sin(uTime * (1.2 + aSeed * 2.4) + aSeed * 43.17);
  vTint = aTint;
}
`;

export const BOTANICAL_FRAGMENT_SHADER = `
uniform sampler2D uAtlas;
uniform float uIsFlower;
uniform vec3 uFogColor;

varying float vCellIndex;
varying float vAlpha;
varying float vMouseGlow;
varying float vFogFactor;
varying float vRotation;
varying float vHover;
varying float vTwinkle;
varying vec3 vTint;

void main() {
  if (vAlpha < 0.01) discard;

  vec2 centered = gl_PointCoord - 0.5;
  float radialDist = length(centered) * 2.0;

  // Tiny shimmering pinpoint lights mode (replaces flowers)
  if (uIsFlower > 0.5) {
    if (radialDist > 1.0) discard;
    float halo = pow(1.0 - radialDist, 2.2) * 0.42;
    float pinpoint = pow(1.0 - radialDist, 5.2);
    float lightShape = halo + pinpoint;

    float alpha = lightShape * vAlpha * vTwinkle;
    if (alpha < 0.015) discard;

    // Restrained warm nocturnal spark color with bright white-cream center
    vec3 sparkColor = mix(vTint, vec3(1.0, 0.97, 0.90), pinpoint * 0.75);
    vec3 color = sparkColor * (0.58 + pinpoint * 0.65 + vHover * 0.22);

    // Subtle cursor proximity brightening
    color += vec3(1.0, 0.95, 0.84) * vMouseGlow * 0.45;

    // Soft nocturnal depth attenuation
    float fogDim = 1.0 - vFogFactor * (0.78 - vHover * 0.35);
    gl_FragColor = vec4(color * fogDim, alpha * fogDim);
    return;
  }

  // Nocturnal foliage & fern fronds
  float c = cos(vRotation);
  float s = sin(vRotation);
  vec2 rotUv = vec2(
    centered.x * c - centered.y * s,
    centered.x * s + centered.y * c
  ) + 0.5;

  float col = mod(vCellIndex, 4.0);
  float row = floor(vCellIndex / 4.0);
  vec2 cellUv = (vec2(col, 3.0 - row) + clamp(rotUv, 0.02, 0.98)) * 0.25;

  vec4 texel = texture2D(uAtlas, cellUv);

  float orbMask = smoothstep(1.0, 0.0, radialDist);
  float orbCore = pow(orbMask, 2.4);

  float spriteAlpha = mix(texel.a, orbMask * 0.75, vHover);
  float finalAlpha = spriteAlpha * vAlpha;
  if (finalAlpha < 0.025) discard;

  vec3 baseColor = texel.rgb * vTint;
  vec3 emberColor = vec3(0.45, 0.85, 0.72);
  vec3 color = mix(baseColor * 0.30, emberColor * (0.42 + orbCore * 0.28), vHover * 0.85);
  color += vec3(0.42, 0.88, 0.76) * vMouseGlow * 0.26;
  color = mix(color, uFogColor, vFogFactor * (1.0 - vHover * 0.45));

  gl_FragColor = vec4(color, finalAlpha * mix(0.95, 0.78, vHover));
}
`;

export const DUST_VERTEX_SHADER = `
${GLSL_TERRAIN_FUNCTIONS}

attribute float aLocalX;
attribute float aBaseZ;
attribute float aHeight;
attribute float aScale;
attribute float aSeed;

uniform float uTime;
uniform float uCameraZ;
uniform float uPixelRatio;
uniform float uViewportHeight;
uniform float uAspect;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uHover;

varying float vAlpha;
varying float vGlow;

void main() {
  float relZ = mod(aBaseZ - uCameraZ + 18.0, LOOP_LENGTH) - (LOOP_LENGTH - 18.0);
  float worldZ = uCameraZ + relZ;
  float centerX = getValleyCenterX(worldZ);
  float groundY = getValleyHeight(aLocalX, worldZ);

  float driftX = sin(uTime * (0.28 + aSeed * 0.35) + aSeed * 21.0) * (1.5 + uHover * 3.5);
  float driftY = mod(aHeight + uTime * (0.35 + aSeed * 0.4 + uHover * 1.1), 22.0);
  float worldX = centerX + aLocalX + driftX;
  float worldY = groundY + 1.2 + driftY;

  vec4 mvPosition = modelViewMatrix * vec4(worldX, worldY, worldZ, 1.0);
  vec4 clipPos = projectionMatrix * mvPosition;

  float mouseGlow = 0.0;
  if (clipPos.w > 0.1 && uMouseActive > 0.001) {
    vec2 ndc = clipPos.xy / clipPos.w;
    vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);
    float dist = length(d);
    if (dist < 0.38) {
      float t = 1.0 - dist / 0.38;
      vec2 dir = d / max(dist, 0.0001);
      clipPos.x += (dir.x / uAspect) * t * t * 0.22 * uMouseActive * clipPos.w;
      clipPos.y += dir.y * t * t * 0.22 * uMouseActive * clipPos.w;
      mouseGlow = t * t * uMouseActive;
    }
  }

  gl_Position = clipPos;

  float camDist = max(1.0, -mvPosition.z);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.4 + aSeed * 2.2) + aSeed * 37.0);
  float nearFade = smoothstep(2.0, 9.0, camDist);
  float farFade = 1.0 - smoothstep(105.0, 185.0, camDist);

  gl_PointSize = clamp((aScale * (1.0 + uHover * 0.65 + mouseGlow * 0.5) * uViewportHeight * 0.35 / camDist) * uPixelRatio, 1.5, 42.0 * uPixelRatio);
  vAlpha = nearFade * farFade * twinkle * (0.55 + uHover * 0.45);
  vGlow = mouseGlow + uHover * 0.4;
}
`;

export const DUST_FRAGMENT_SHADER = `
uniform sampler2D uDustMap;

varying float vAlpha;
varying float vGlow;

void main() {
  vec4 tex = texture2D(uDustMap, gl_PointCoord);
  float a = tex.a * vAlpha;
  if (a < 0.01) discard;
  vec3 col = mix(vec3(0.76, 0.88, 0.92), vec3(1.0, 0.95, 0.82), clamp(0.45 + vGlow, 0.0, 1.0));
  gl_FragColor = vec4(col * (0.78 + vGlow * 0.28), a);
}
`;

export const TERRAIN_VERTEX_SHADER = `
${GLSL_TERRAIN_FUNCTIONS}

uniform float uCameraZ;

varying float vCamDist;
varying float vElevation;
varying float vSlope;

void main() {
  // Plane grid in local (dx, localZ) transformed directly onto infinite valley
  float localX = position.x;
  float worldZ = uCameraZ + position.z;
  float worldX = getValleyCenterX(worldZ) + localX;
  float worldY = getValleyHeight(localX, worldZ) - 0.15;

  // Approximate cross-slope for subtle moonlight rim shading
  float hRight = getValleyHeight(localX + 1.2, worldZ);
  float slope = clamp(abs(hRight - worldY) * 0.45, 0.0, 1.0);

  vec4 mvPos = modelViewMatrix * vec4(worldX, worldY, worldZ, 1.0);
  gl_Position = projectionMatrix * mvPos;

  vCamDist = max(0.1, -mvPos.z);
  vElevation = worldY;
  vSlope = slope;
}
`;

export const TERRAIN_FRAGMENT_SHADER = `
uniform vec3 uFogColor;

varying float vCamDist;
varying float vElevation;
varying float vSlope;

void main() {
  vec3 troughColor = vec3(0.012, 0.024, 0.032);
  vec3 ridgeColor = vec3(0.025, 0.055, 0.068);
  vec3 base = mix(troughColor, ridgeColor, clamp((vElevation + 3.0) * 0.06 + vSlope * 0.45, 0.0, 1.0));

  float fog = 1.0 - exp(-pow(vCamDist * 0.0115, 1.72));
  vec3 col = mix(base, uFogColor, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Custom post-processing shader: RGB-split chromatic aberration,
 * subtle animated nocturnal film noise, and speed-reactive vignette.
 */
export const COMPOSITE_POST_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uHover: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uHover;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float radial = length(centered);

      // RGB split scales subtly with scroll velocity and screen edge distance
      float rgbShift = (0.0012 + uSpeed * 0.0055 + uHover * 0.0015) * radial;
      vec2 offset = normalize(centered + vec2(0.0001)) * rgbShift;

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 color = vec3(r, g, b);

      // Subtle RGB-split organic film grain to enrich nocturnal shadows
      float t = fract(uTime * 1.7);
      vec3 grain = vec3(
        hash12(vUv * 920.0 + vec2(t * 73.1, 11.7)),
        hash12(vUv * 920.0 + vec2(t * 41.3, 57.2)),
        hash12(vUv * 920.0 + vec2(t * 97.9, 89.4))
      ) - 0.5;
      color += grain * (0.022 + uSpeed * 0.012);

      // Dynamic cinematic vignette that tightens smoothly as movement velocity rises
      float vigInner = mix(0.46, 0.24, clamp(uSpeed * 1.15, 0.0, 1.0));
      float vigOuter = mix(1.06, 0.80, clamp(uSpeed * 1.15, 0.0, 1.0));
      float vignette = 1.0 - smoothstep(vigInner, vigOuter, radial * 1.38);
      color *= mix(0.28, 1.0, vignette);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
