import * as THREE from 'three';

function drawRadialGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  innerColor: string,
  midColor: string,
  outerColor: string
) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.45, midColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPetalFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  petals: number,
  outerRadius: number,
  petalWidth: number,
  tipColor: string,
  baseColor: string,
  coreColor: string,
  doubleLayer = true
) {
  // Soft bioluminescent aura behind petals
  drawRadialGlow(ctx, cx, cy, outerRadius * 1.08, 'rgba(255,248,232,0.34)', 'rgba(255,235,210,0.08)', 'rgba(0,0,0,0)');

  const drawLayer = (count: number, rad: number, width: number, rotOffset: number, alpha: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotOffset);
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.rotate((i / count) * Math.PI * 2);
      const grad = ctx.createLinearGradient(0, 0, 0, -rad);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.55, tipColor);
      grad.addColorStop(1, 'rgba(255,250,240,0.92)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-width, -rad * 0.3, -width * 0.85, -rad * 0.85, 0, -rad);
      ctx.bezierCurveTo(width * 0.85, -rad * 0.85, width, -rad * 0.3, 0, 0);
      ctx.fill();

      // Delicate central petal vein
      ctx.strokeStyle = 'rgba(255,252,244,0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -rad * 0.12);
      ctx.lineTo(0, -rad * 0.78);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  if (doubleLayer) {
    drawLayer(petals, outerRadius * 0.96, petalWidth * 1.05, Math.PI / petals, 0.78);
  }
  drawLayer(petals, outerRadius * 0.78, petalWidth * 0.82, 0, 0.96);

  // Luminous stamen core
  drawRadialGlow(ctx, cx, cy, outerRadius * 0.32, '#ffffff', coreColor, 'rgba(255,220,160,0)');

  // Fine stamen dots
  ctx.fillStyle = '#fff9e6';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    const r = outerRadius * (0.14 + (i % 2) * 0.06);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawUmbelCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  tint: string
) {
  drawRadialGlow(ctx, cx, cy, radius * 1.05, 'rgba(255,248,236,0.28)', 'rgba(210,235,255,0.08)', 'rgba(0,0,0,0)');
  const rings = [
    { count: 1, r: 0, size: 11 },
    { count: 7, r: radius * 0.34, size: 8.5 },
    { count: 14, r: radius * 0.68, size: 6.5 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2 + ring.r * 0.03;
      const x = cx + Math.cos(a) * ring.r;
      const y = cy + Math.sin(a) * ring.r;
      drawRadialGlow(ctx, x, y, ring.size * 2.1, '#ffffff', tint, 'rgba(255,255,255,0)');
    }
  }
}

function drawBellCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  colorA: string,
  colorB: string
) {
  drawRadialGlow(ctx, cx, cy, radius, 'rgba(180,225,255,0.25)', 'rgba(120,165,255,0.07)', 'rgba(0,0,0,0)');
  const positions = [
    { x: 0, y: -radius * 0.32, s: 0.56, r: 0 },
    { x: -radius * 0.34, y: radius * 0.14, s: 0.48, r: -0.45 },
    { x: radius * 0.34, y: radius * 0.18, s: 0.46, r: 0.45 },
    { x: 0, y: radius * 0.36, s: 0.42, r: 0.1 },
  ];
  for (const p of positions) {
    drawPetalFlower(
      ctx,
      cx + p.x,
      cy + p.y,
      5,
      radius * p.s,
      radius * p.s * 0.36,
      colorA,
      colorB,
      '#fff4d6',
      false
    );
  }
}

function drawDandelionGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  drawRadialGlow(ctx, cx, cy, radius * 1.02, 'rgba(245,255,244,0.45)', 'rgba(190,242,216,0.16)', 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(cx, cy);
  const rays = 32;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const len = radius * (0.72 + (i % 3) * 0.08);
    ctx.strokeStyle = 'rgba(235,250,242,0.52)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,252,240,0.9)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * len, Math.sin(a) * len, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  drawRadialGlow(ctx, cx, cy, radius * 0.28, '#ffffff', '#e8f9e8', 'rgba(255,255,255,0)');
}

function drawFernFrond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  baseHex: string,
  tipHex: string,
  curve: number
) {
  ctx.save();
  ctx.translate(cx, cy + size * 0.42);

  // Main stem
  ctx.strokeStyle = tipHex;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(curve * size * 0.25, -size * 0.45, curve * size * 0.14, -size * 0.88);
  ctx.stroke();

  // Paired leaflets
  const pairs = 11;
  for (let i = 1; i <= pairs; i++) {
    const t = i / (pairs + 1);
    const sx = curve * size * (0.25 * 2 * (1 - t) * t + 0.14 * t * t);
    const sy = -size * 0.88 * t;
    const leafLen = size * 0.34 * Math.sin(Math.pow(t, 0.72) * Math.PI);
    const leafW = Math.max(3.5, leafLen * 0.28);

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(side * (0.68 - t * 0.24));
      const grad = ctx.createLinearGradient(0, 0, side * leafLen, -leafLen * 0.25);
      grad.addColorStop(0, baseHex);
      grad.addColorStop(1, tipHex);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * leafLen * 0.5, -leafW, side * leafLen, -leafLen * 0.15);
      ctx.quadraticCurveTo(side * leafLen * 0.45, leafW * 0.65, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawBroadLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  darkHex: string,
  edgeHex: string,
  widthFactor: number
) {
  ctx.save();
  ctx.translate(cx, cy + size * 0.42);
  const grad = ctx.createLinearGradient(0, 0, 0, -size * 0.86);
  grad.addColorStop(0, darkHex);
  grad.addColorStop(0.75, edgeHex);
  grad.addColorStop(1, 'rgba(140,210,195,0.68)');
  ctx.fillStyle = grad;

  const h = size * 0.86;
  const w = size * widthFactor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w, -h * 0.25, -w * 0.85, -h * 0.78, 0, -h);
  ctx.bezierCurveTo(w * 0.85, -h * 0.78, w, -h * 0.25, 0, 0);
  ctx.fill();

  // Midrib & lateral veins
  ctx.strokeStyle = 'rgba(180,235,220,0.32)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.04);
  ctx.lineTo(0, -h * 0.9);
  ctx.stroke();

  ctx.lineWidth = 1.0;
  for (let i = 1; i <= 5; i++) {
    const y = -h * (i * 0.15);
    const vx = w * 0.48 * Math.sin((i / 6) * Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(-vx, y - h * 0.09);
    ctx.moveTo(0, y);
    ctx.lineTo(vx, y - h * 0.09);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrassBlades(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  baseHex: string,
  tipHex: string
) {
  ctx.save();
  ctx.translate(cx, cy + size * 0.44);
  const blades = [
    { lean: -0.45, h: 0.76, w: 6 },
    { lean: -0.22, h: 0.9, w: 7 },
    { lean: 0.04, h: 0.95, w: 7.5 },
    { lean: 0.28, h: 0.84, w: 6.5 },
    { lean: 0.48, h: 0.7, w: 5.5 },
  ];
  for (const b of blades) {
    const h = size * b.h;
    const grad = ctx.createLinearGradient(0, 0, b.lean * size * 0.65, -h);
    grad.addColorStop(0, baseHex);
    grad.addColorStop(1, tipHex);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-b.w * 0.5, 0);
    ctx.quadraticCurveTo(b.lean * size * 0.22 - b.w * 0.3, -h * 0.55, b.lean * size * 0.68, -h);
    ctx.quadraticCurveTo(b.lean * size * 0.25 + b.w * 0.45, -h * 0.52, b.w * 0.5, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Generates a crisp 1024x1024 4x4 procedural botanical sprite atlas:
 * Cells 0..7  = Luminous nocturnal flower varieties
 * Cells 8..15 = Moonlit fern fronds, botanical leaves, and valley grasses
 */
export function createBotanicalAtlasTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const cell = size / 4; // 256px per sprite
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const center = (col: number, row: number) => ({
    cx: col * cell + cell * 0.5,
    cy: row * cell + cell * 0.5,
  });

  // Row 0 & Row 1: 8 Nocturnal Flower Varieties
  {
    const { cx, cy } = center(0, 0);
    drawPetalFlower(ctx, cx, cy, 8, 96, 28, '#f5d2b8', '#f5efe2', '#ffd88a', true);
  }
  {
    const { cx, cy } = center(1, 0);
    drawPetalFlower(ctx, cx, cy, 6, 98, 30, '#b5a3ff', '#ebe6ff', '#ffe8a3', true);
  }
  {
    const { cx, cy } = center(2, 0);
    drawPetalFlower(ctx, cx, cy, 5, 92, 42, '#ffca78', '#fff4d4', '#fff0a6', true);
  }
  {
    const { cx, cy } = center(3, 0);
    drawBellCluster(ctx, cx, cy, 96, '#87d4f5', '#dff4ff');
  }
  {
    const { cx, cy } = center(0, 1);
    drawPetalFlower(ctx, cx, cy, 6, 94, 38, '#f57e9b', '#ffdbe5', '#ffe18c', true);
  }
  {
    const { cx, cy } = center(1, 1);
    drawUmbelCluster(ctx, cx, cy, 98, '#f5efe2');
  }
  {
    const { cx, cy } = center(2, 1);
    drawPetalFlower(ctx, cx, cy, 7, 98, 22, '#9a7bff', '#d9d4ff', '#ffe299', true);
  }
  {
    const { cx, cy } = center(3, 1);
    drawDandelionGlow(ctx, cx, cy, 96);
  }

  // Row 2 & Row 3: 8 Nocturnal Foliage & Fern Varieties
  {
    const { cx, cy } = center(0, 2);
    drawFernFrond(ctx, cx, cy, 215, '#123e33', '#3b8c74', 0.42);
  }
  {
    const { cx, cy } = center(1, 2);
    drawBroadLeaf(ctx, cx, cy, 210, '#103534', '#2e7c72', 0.44);
  }
  {
    const { cx, cy } = center(2, 2);
    drawGrassBlades(ctx, cx, cy, 215, '#133a2e', '#469170');
  }
  {
    const { cx, cy } = center(3, 2);
    drawFernFrond(ctx, cx, cy, 215, '#143b45', '#428e96', -0.38);
  }
  {
    const { cx, cy } = center(0, 3);
    drawBroadLeaf(ctx, cx, cy, 200, '#183f2d', '#488d64', 0.56);
  }
  {
    const { cx, cy } = center(1, 3);
    drawFernFrond(ctx, cx, cy, 208, '#173832', '#529c82', 0.16);
  }
  {
    const { cx, cy } = center(2, 3);
    drawGrassBlades(ctx, cx, cy, 210, '#163d3c', '#458e88');
  }
  {
    const { cx, cy } = center(3, 3);
    drawBroadLeaf(ctx, cx, cy, 210, '#12333e', '#36758c', 0.34);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Soft glowing atmospheric pollen / firefly spore texture.
 */
export function createDustTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  drawRadialGlow(
    ctx,
    half,
    half,
    half,
    'rgba(255, 252, 240, 1.0)',
    'rgba(245, 235, 212, 0.38)',
    'rgba(245, 235, 212, 0.0)'
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Volumetric diagonal moonlight god-ray sprite texture.
 */
export function createLightRayTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const horiz = ctx.createLinearGradient(0, 0, w, 0);
  horiz.addColorStop(0.0, 'rgba(175, 215, 235, 0)');
  horiz.addColorStop(0.32, 'rgba(195, 226, 240, 0.14)');
  horiz.addColorStop(0.5, 'rgba(235, 242, 238, 0.28)');
  horiz.addColorStop(0.68, 'rgba(195, 226, 240, 0.14)');
  horiz.addColorStop(1.0, 'rgba(175, 215, 235, 0)');

  ctx.fillStyle = horiz;
  ctx.fillRect(0, 0, w, h);

  // Fade top & bottom softly using destination-in mask
  ctx.globalCompositeOperation = 'destination-in';
  const vert = ctx.createLinearGradient(0, 0, 0, h);
  vert.addColorStop(0.0, 'rgba(255,255,255,0)');
  vert.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  vert.addColorStop(0.7, 'rgba(255,255,255,0.45)');
  vert.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
