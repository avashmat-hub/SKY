import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  LOOP_LENGTH,
  createSeededRandom,
  getValleyCenterX,
  getValleyHeight,
  sampleCameraPath,
} from './terrain';
import {
  createBotanicalAtlasTexture,
  createDustTexture,
  createLightRayTexture,
} from './textures';
import {
  BOTANICAL_FRAGMENT_SHADER,
  BOTANICAL_VERTEX_SHADER,
  COMPOSITE_POST_SHADER,
  DUST_FRAGMENT_SHADER,
  DUST_VERTEX_SHADER,
  TERRAIN_FRAGMENT_SHADER,
  TERRAIN_VERTEX_SHADER,
} from './shaders';
import { AmbientAudioStore } from './AmbientAudio';

// Reusable scratch vectors to ensure zero GC allocations in the render loop
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _adjustedTarget = new THREE.Vector3();
const _fogColor = new THREE.Color('#040910');

interface LightRayEntry {
  mesh: THREE.Mesh;
  localX: number;
  baseZ: number;
  baseYOffset: number;
  baseOpacity: number;
  phase: number;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class ValleyEngine {
  private container: HTMLElement;
  private mountEl: HTMLElement;
  private onLoaded: () => void;
  private onIntroDone: () => void;
  private onSpeedChange?: (normalizedSpeed: number) => void;

  public audioStore: AmbientAudioStore;

  private isSoftwareGl: boolean;
  private reducedMotion: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private audioListener: THREE.AudioListener;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private postPass: ShaderPass | null = null;

  private flowerMaterial!: THREE.ShaderMaterial;
  private leafMaterial!: THREE.ShaderMaterial;
  private dustMaterial!: THREE.ShaderMaterial;
  private terrainMaterial!: THREE.ShaderMaterial;
  private lightRays: LightRayEntry[] = [];
  private skyMesh!: THREE.Mesh;
  private starsPoints!: THREE.Points;

  private textures: THREE.Texture[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  // Virtual scroller & motion state
  private cameraZ = 0;
  private targetScrollDelta = 0;
  private scrollVelocity = 0;
  private smoothSpeed = 0;
  private hoverTarget = 0;
  private hoverCurrent = 0;
  private introProgress = 0;
  private introNotified = false;
  private elapsed = 0;
  private lastTime = 0;

  // Pointer & touch state
  private mouseTarget = new THREE.Vector2(0, 0);
  private mouseCurrent = new THREE.Vector2(0, 0);
  private mouseActiveTarget = 0;
  private mouseActiveCurrent = 0;
  private lastTouchY: number | null = null;

  // Lifecycle state
  private frameId = 0;
  private disposed = false;
  private contextLost = false;

  constructor(
    container: HTMLElement,
    onLoaded: () => void,
    onIntroDone: () => void,
    onSpeedChange?: (normalizedSpeed: number) => void
  ) {
    this.container = container;
    this.mountEl =
      (container.querySelector('.js-canvas-container') as HTMLElement) || container;
    this.onLoaded = onLoaded;
    this.onIntroDone = onIntroDone;
    this.onSpeedChange = onSpeedChange;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.scene = new THREE.Scene();
    this.scene.background = _fogColor.clone();

    const width = Math.max(1, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mountEl.clientHeight || window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.25, 420);
    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);

    this.audioStore = new AmbientAudioStore();
    this.audioStore.initAudio(this.audioListener);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);

    this.mountEl.innerHTML = '';
    this.mountEl.appendChild(this.renderer.domElement);

    this.buildSkyAndStars();
    this.buildTerrain();
    this.buildBotanicalFields();
    this.buildDustField();
    this.buildLightRays();
    this.setupPostProcessing(width, height);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();

    // Signal loaded on next animation frame so initial scene state is primed
    requestAnimationFrame(() => {
      if (!this.disposed) {
        this.onLoaded();
      }
    });

    this.lastTime = performance.now();
    this.tick();
  }

  private buildSkyAndStars(): void {
    // Deep nocturnal sky dome with soft moonlit horizon mist
    const skyGeo = new THREE.SphereGeometry(320, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#020307') },
        uHorizon: { value: new THREE.Color('#091826') },
        uGlow: { value: new THREE.Color('#132c3d') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGlow;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
          // Soft moonlit atmospheric band ahead along the valley horizon
          float moonSpot = pow(max(0.0, dot(normalize(vDir), normalize(vec3(0.08, 0.12, -1.0)))), 5.0);
          col += uGlow * moonSpot * 0.52;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
    this.geometries.push(skyGeo);
    this.materials.push(skyMat);

    // Delicate nocturnal starfield above the ridge
    const rand = createSeededRandom(90125);
    const starCount = 650;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(0.12 + rand() * 0.88); // Upper hemisphere only
      const r = 275 + rand() * 25;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 1.0 + rand() * 2.2;
      phases[i] = rand() * Math.PI * 2;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vTwinkle;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = aSize * uPixelRatio;
          vTwinkle = 0.4 + 0.6 * sin(uTime * 1.1 + aPhase);
        }
      `,
      fragmentShader: `
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, d) * vTwinkle * 0.65;
          if (a < 0.02) discard;
          gl_FragColor = vec4(0.95, 0.93, 0.88, a);
        }
      `,
    });

    this.starsPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsPoints);
    this.geometries.push(starGeo);
    this.materials.push(starMat);
  }

  private buildTerrain(): void {
    // Grounding undulating valley surface following the camera seamlessly
    const geo = new THREE.PlaneGeometry(148, 250, 72, 110);
    // Rotate plane into X-Z and shift forward ahead of camera (-230 to +20)
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -105);

    this.terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERTEX_SHADER,
      fragmentShader: TERRAIN_FRAGMENT_SHADER,
      uniforms: {
        uCameraZ: { value: 0 },
        uFogColor: { value: _fogColor.clone() },
      },
    });

    const terrainMesh = new THREE.Mesh(geo, this.terrainMaterial);
    terrainMesh.frustumCulled = false;
    this.scene.add(terrainMesh);
    this.geometries.push(geo);
    this.materials.push(this.terrainMaterial);
  }

  private createBotanicalPoints(
    count: number,
    isFlower: boolean,
    atlasTexture: THREE.Texture,
    seedOffset: number
  ): { points: THREE.Points; material: THREE.ShaderMaterial } {
    const rand = createSeededRandom(seedOffset);
    const positions = new Float32Array(count * 3);
    const localX = new Float32Array(count);
    const baseZ = new Float32Array(count);
    const extraY = new Float32Array(count);
    const scales = new Float32Array(count);
    const cellIndices = new Float32Array(count);
    const seeds = new Float32Array(count);
    const tints = new Float32Array(count * 3);

    // Rich nocturnal wildflower tints & deep botanical foliage tints
    const flowerPalette = [
      new THREE.Color('#fff5e4'), // Warm ivory cream
      new THREE.Color('#ffd4b8'), // Peach moonlight
      new THREE.Color('#d2c2ff'), // Soft nocturnal lavender
      new THREE.Color('#ffe094'), // Bioluminescent gold
      new THREE.Color('#9be0ff'), // Periwinkle starlight
      new THREE.Color('#ff9ab4'), // Wild rose poppy
      new THREE.Color('#d4ffe6'), // Dew mint glow
      new THREE.Color('#f7e8d0'), // Champagne petal
    ];

    const leafPalette = [
      new THREE.Color('#2c7a62'),
      new THREE.Color('#236b66'),
      new THREE.Color('#34805c'),
      new THREE.Color('#1f5e6e'),
      new THREE.Color('#3d8572'),
    ];

    // Pre-generate organic wildflower drift cluster centers
    const clusterCount = 46;
    const clusters: Array<{ x: number; z: number; spreadX: number; spreadZ: number; paletteIdx: number; cellIdx: number }> = [];
    for (let c = 0; c < clusterCount; c++) {
      const side = c % 2 === 0 ? -1 : 1;
      const distFromPath = 3.2 + Math.pow(rand(), 1.15) * 42.0;
      clusters.push({
        x: side * distFromPath + (rand() - 0.5) * 5.0,
        z: rand() * LOOP_LENGTH,
        spreadX: 3.5 + rand() * 8.5,
        spreadZ: 6.0 + rand() * 14.0,
        paletteIdx: Math.floor(rand() * flowerPalette.length),
        cellIdx: Math.floor(rand() * 8),
      });
    }

    for (let i = 0; i < count; i++) {
      let lx: number;
      let bz: number;
      let cellIdx: number;
      let tint: THREE.Color;

      if (isFlower && rand() < 0.72) {
        // Place inside natural wildflower drifts along slopes & meadow edges
        const cl = clusters[Math.floor(rand() * clusters.length)];
        // Gaussian-like approximation
        const gx = (rand() + rand() + rand() - 1.5) * 0.82;
        const gz = (rand() + rand() + rand() - 1.5) * 0.82;
        lx = THREE.MathUtils.clamp(cl.x + gx * cl.spreadX, -58, 58);
        bz = ((cl.z + gz * cl.spreadZ) % LOOP_LENGTH + LOOP_LENGTH) % LOOP_LENGTH;
        cellIdx = rand() < 0.75 ? cl.cellIdx : Math.floor(rand() * 8);
        tint = flowerPalette[rand() < 0.8 ? cl.paletteIdx : Math.floor(rand() * flowerPalette.length)];
      } else {
        // Organic valley-wide coverage keeping the immediate camera path slightly parted
        const u = rand();
        const side = rand() < 0.5 ? -1 : 1;
        const dist = isFlower
          ? 2.2 + Math.pow(u, 1.12) * 52.0
          : 0.6 + Math.pow(u, 1.05) * 56.0;
        lx = side * dist;
        bz = rand() * LOOP_LENGTH;
        cellIdx = isFlower ? Math.floor(rand() * 8) : 8 + Math.floor(rand() * 8);
        tint = isFlower
          ? flowerPalette[Math.floor(rand() * flowerPalette.length)]
          : leafPalette[Math.floor(rand() * leafPalette.length)];
      }

      localX[i] = lx;
      baseZ[i] = bz;
      // Tiny lights hover delicately above the dark valley foliage carpet
      extraY[i] = isFlower
        ? 0.35 + Math.pow(rand(), 0.9) * 2.45
        : 0.15 + rand() * 0.95;
      scales[i] = isFlower
        ? 0.13 + Math.pow(rand(), 1.65) * 0.26
        : 1.35 + Math.pow(rand(), 1.1) * 2.45;
      cellIndices[i] = cellIdx;
      seeds[i] = rand();

      // Subtle brightness variation per individual plant
      const brightness = isFlower ? 0.78 + rand() * 0.48 : 0.65 + rand() * 0.52;
      tints[i * 3] = tint.r * brightness;
      tints[i * 3 + 1] = tint.g * brightness;
      tints[i * 3 + 2] = tint.b * brightness;

      // Placeholder position (real position computed per-frame in vertex shader)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aLocalX', new THREE.BufferAttribute(localX, 1));
    geometry.setAttribute('aBaseZ', new THREE.BufferAttribute(baseZ, 1));
    geometry.setAttribute('aExtraY', new THREE.BufferAttribute(extraY, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aCellIndex', new THREE.BufferAttribute(cellIndices, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));

    const width = Math.max(1, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mountEl.clientHeight || window.innerHeight);

    const material = new THREE.ShaderMaterial({
      vertexShader: BOTANICAL_VERTEX_SHADER,
      fragmentShader: BOTANICAL_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: isFlower ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uAtlas: { value: atlasTexture },
        uTime: { value: 0 },
        uCameraZ: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uViewportHeight: { value: height },
        uAspect: { value: width / height },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
        uHover: { value: 0 },
        uIntro: { value: 0 },
        uIsFlower: { value: isFlower ? 1.0 : 0.0 },
        uBloomNear: { value: isFlower ? 13.0 : 34.0 },
        uBloomFar: { value: isFlower ? 128.0 : 172.0 },
        uFogColor: { value: _fogColor.clone() },
      },
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = isFlower ? 2 : 1;

    this.geometries.push(geometry);
    this.materials.push(material);
    return { points, material };
  }

  private buildBotanicalFields(): void {
    const atlas = createBotanicalAtlasTexture(
      this.renderer.capabilities.getMaxAnisotropy()
    );
    this.textures.push(atlas);

    // 18,500 nocturnal fern & foliage sprites carpeting the valley
    const leaves = this.createBotanicalPoints(18500, false, atlas, 41203);
    this.leafMaterial = leaves.material;
    this.scene.add(leaves.points);

    // 16,000 very tiny shimmering lights scattered across the midnight valley
    const flowers = this.createBotanicalPoints(16000, true, atlas, 77319);
    this.flowerMaterial = flowers.material;
    this.scene.add(flowers.points);
  }

  private buildDustField(): void {
    const dustTexture = createDustTexture();
    this.textures.push(dustTexture);

    const rand = createSeededRandom(55109);
    const count = 1100;
    const positions = new Float32Array(count * 3);
    const localX = new Float32Array(count);
    const baseZ = new Float32Array(count);
    const heights = new Float32Array(count);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      localX[i] = (rand() - 0.5) * 68;
      baseZ[i] = rand() * LOOP_LENGTH;
      heights[i] = rand() * 20;
      scales[i] = 0.25 + rand() * 0.65;
      seeds[i] = rand();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aLocalX', new THREE.BufferAttribute(localX, 1));
    geometry.setAttribute('aBaseZ', new THREE.BufferAttribute(baseZ, 1));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const width = Math.max(1, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mountEl.clientHeight || window.innerHeight);

    this.dustMaterial = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uDustMap: { value: dustTexture },
        uTime: { value: 0 },
        uCameraZ: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uViewportHeight: { value: height },
        uAspect: { value: width / height },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
        uHover: { value: 0 },
      },
    });

    const dustPoints = new THREE.Points(geometry, this.dustMaterial);
    dustPoints.frustumCulled = false;
    dustPoints.renderOrder = 3;
    this.scene.add(dustPoints);

    this.geometries.push(geometry);
    this.materials.push(this.dustMaterial);
  }

  private buildLightRays(): void {
    const rayTex = createLightRayTexture();
    this.textures.push(rayTex);

    const rand = createSeededRandom(31847);
    const rayGeo = new THREE.PlaneGeometry(1, 1);
    this.geometries.push(rayGeo);

    const count = 24;
    for (let i = 0; i < count; i++) {
      const baseOpacity = 0.08 + rand() * 0.12;
      const mat = new THREE.MeshBasicMaterial({
        map: rayTex,
        color: i % 3 === 0 ? new THREE.Color('#cde6e0') : new THREE.Color('#a6c9df'),
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.materials.push(mat);

      const mesh = new THREE.Mesh(rayGeo, mat);
      const w = 12 + rand() * 18;
      const h = 42 + rand() * 32;
      mesh.scale.set(w, h, 1);
      mesh.rotation.z = -0.22 + (rand() - 0.5) * 0.24;
      mesh.rotation.y = (rand() - 0.5) * 0.55;
      mesh.renderOrder = 4;

      const side = i % 2 === 0 ? -1 : 1;
      const localX = side * (6 + rand() * 24);
      const baseZ = (i / count) * LOOP_LENGTH + rand() * 8;
      const baseYOffset = 14 + rand() * 9;

      this.scene.add(mesh);
      this.lightRays.push({
        mesh,
        localX,
        baseZ,
        baseYOffset,
        baseOpacity,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  private setupPostProcessing(width: number, height: number): void {
    if (this.isSoftwareGl) return;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Subtle dreamy nocturnal bloom on bright flower cores & cursor-lit blossoms
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(width * 0.65), Math.floor(height * 0.65)),
      0.22,
      0.62,
      0.42
    );
    this.composer.addPass(this.bloomPass);

    // RGB split noise + velocity-reactive vignette
    this.postPass = new ShaderPass(COMPOSITE_POST_SHADER);
    this.composer.addPass(this.postPass);
  }

  public startHoverTransition(): void {
    this.hoverTarget = 1;
    this.audioStore.setMuffled(true);
  }

  public stopHoverTransition(): void {
    this.hoverTarget = 0;
    this.audioStore.setMuffled(false);
  }

  public nudgeScroll(delta: number): void {
    this.targetScrollDelta += delta;
  }

  private handleWheel = (e: WheelEvent): void => {
    if ((e.target as HTMLElement | null)?.closest('[data-drawer-scroll="true"]')) {
      return;
    }
    e.preventDefault();
    const clamped = THREE.MathUtils.clamp(e.deltaY, -160, 160);
    this.targetScrollDelta += clamped * 0.045;
  };

  private handleTouchStart = (e: TouchEvent): void => {
    if ((e.target as HTMLElement | null)?.closest('[data-drawer-scroll="true"]')) {
      return;
    }
    if (e.touches.length > 0) {
      this.lastTouchY = e.touches[0].clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if ((e.target as HTMLElement | null)?.closest('[data-drawer-scroll="true"]')) {
      return;
    }
    if (this.lastTouchY !== null && e.touches.length > 0) {
      const currentY = e.touches[0].clientY;
      const dy = this.lastTouchY - currentY;
      this.lastTouchY = currentY;
      // Virtual scroller touch multiplier = 20 normalized by viewport height
      const normalized = (dy / Math.max(320, window.innerHeight)) * 20.0;
      this.targetScrollDelta += THREE.MathUtils.clamp(normalized, -8, 8) * 1.4;
    }
  };

  private handleTouchEnd = (): void => {
    this.lastTouchY = null;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = -((e.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
    this.mouseTarget.set(nx, ny);
    this.mouseActiveTarget = 1;
  };

  private handlePointerLeave = (): void => {
    this.mouseActiveTarget = 0;
    this.mouseTarget.set(0, 0);
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mountEl.clientHeight || window.innerHeight);
    const pr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height);

    const aspect = width / height;
    for (const mat of [this.flowerMaterial, this.leafMaterial, this.dustMaterial]) {
      mat.uniforms.uPixelRatio.value = pr;
      mat.uniforms.uViewportHeight.value = height;
      mat.uniforms.uAspect.value = aspect;
    }
    (this.starsPoints.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = pr;

    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(Math.floor(width * 0.65), Math.floor(height * 0.65));
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
  };

  private bindEvents(): void {
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('resize', this.handleResize);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private unbindEvents(): void {
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('resize', this.handleResize);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private updateScene(dt: number): void {
    const motionScale = this.reducedMotion ? 0.35 : 1.0;
    this.elapsed += dt * motionScale;

    // Intro bloom & camera settle choreography
    if (this.introProgress < 1) {
      this.introProgress = Math.min(1, this.introProgress + dt * 0.78);
    }
    if (!this.introNotified && this.introProgress >= 0.65) {
      this.introNotified = true;
      this.onIntroDone();
    }

    // Smooth hover transition damping (halts camera flight & scatters flowers)
    this.hoverCurrent = THREE.MathUtils.damp(
      this.hoverCurrent,
      this.hoverTarget,
      3.4,
      dt
    );

    // Smooth pointer tracking
    this.mouseCurrent.x = THREE.MathUtils.damp(
      this.mouseCurrent.x,
      this.mouseTarget.x,
      6.0,
      dt
    );
    this.mouseCurrent.y = THREE.MathUtils.damp(
      this.mouseCurrent.y,
      this.mouseTarget.y,
      6.0,
      dt
    );
    this.mouseActiveCurrent = THREE.MathUtils.damp(
      this.mouseActiveCurrent,
      this.mouseActiveTarget,
      4.5,
      dt
    );

    // Virtual scroller physics with idle forward drift along valley path
    const flightFactor = Math.max(0, 1 - this.hoverCurrent * 1.15);
    const consumedScroll = this.targetScrollDelta * Math.min(1, dt * 7.5);
    this.targetScrollDelta -= consumedScroll;

    const targetVel = consumedScroll / Math.max(dt, 0.008);
    this.scrollVelocity = THREE.MathUtils.damp(
      this.scrollVelocity,
      targetVel,
      5.5,
      dt
    );

    const idleDrift = (this.reducedMotion ? 1.4 : 4.2) * flightFactor;
    // Moving forward into the valley decreases Z
    const totalAdvance = (idleDrift + this.scrollVelocity * flightFactor) * dt;
    this.cameraZ -= totalAdvance;

    // Normalized speed metric [0..1] for vignette tightening & RGB split
    const rawSpeed = Math.abs(this.scrollVelocity) * 0.045;
    this.smoothSpeed = THREE.MathUtils.damp(
      this.smoothSpeed,
      THREE.MathUtils.clamp(rawSpeed, 0, 1),
      4.5,
      dt
    );
    if (this.onSpeedChange) {
      this.onSpeedChange(this.smoothSpeed);
    }

    // Sample curved valley camera path
    const bankRoll = sampleCameraPath(this.cameraZ, _camPos, _camTarget);

    // Intro gentle rise out of nocturnal mist
    const introEase = 1 - Math.pow(1 - this.introProgress, 3);
    _camPos.y -= (1 - introEase) * 2.2;

    // Subtle pointer camera tilt toward mouse cursor
    _lookDir.subVectors(_camTarget, _camPos).normalize();
    _rightVec.crossVectors(_lookDir, _upVec).normalize();

    const tiltX = this.mouseCurrent.x * 2.4 * this.mouseActiveCurrent;
    const tiltY = this.mouseCurrent.y * 1.35 * this.mouseActiveCurrent;

    _adjustedTarget
      .copy(_camTarget)
      .addScaledVector(_rightVec, tiltX)
      .addScaledVector(_upVec, tiltY);

    this.camera.position.copy(_camPos);
    this.camera.lookAt(_adjustedTarget);
    this.camera.rotation.z += bankRoll - this.mouseCurrent.x * 0.025 * this.mouseActiveCurrent;

    // Keep sky dome & starfield centered on camera
    this.skyMesh.position.copy(_camPos);
    this.starsPoints.position.copy(_camPos);
    (this.starsPoints.material as THREE.ShaderMaterial).uniforms.uTime.value = this.elapsed;

    // Update terrain & botanical shader uniforms
    this.terrainMaterial.uniforms.uCameraZ.value = this.cameraZ;

    for (const mat of [this.flowerMaterial, this.leafMaterial]) {
      mat.uniforms.uTime.value = this.elapsed;
      mat.uniforms.uCameraZ.value = this.cameraZ;
      mat.uniforms.uMouse.value.copy(this.mouseCurrent);
      mat.uniforms.uMouseActive.value = this.mouseActiveCurrent;
      mat.uniforms.uHover.value = this.hoverCurrent;
      mat.uniforms.uIntro.value = introEase;
    }

    this.dustMaterial.uniforms.uTime.value = this.elapsed;
    this.dustMaterial.uniforms.uCameraZ.value = this.cameraZ;
    this.dustMaterial.uniforms.uMouse.value.copy(this.mouseCurrent);
    this.dustMaterial.uniforms.uMouseActive.value = this.mouseActiveCurrent;
    this.dustMaterial.uniforms.uHover.value = this.hoverCurrent;

    // Wrap & shimmer volumetric moonlight rays along the winding valley
    for (let i = 0; i < this.lightRays.length; i++) {
      const ray = this.lightRays[i];
      let relZ = ((ray.baseZ - this.cameraZ + 20) % LOOP_LENGTH + LOOP_LENGTH) % LOOP_LENGTH;
      relZ -= LOOP_LENGTH - 20;
      const worldZ = this.cameraZ + relZ;
      const centerX = getValleyCenterX(worldZ);
      const groundY = getValleyHeight(ray.localX, worldZ);

      ray.mesh.position.set(
        centerX + ray.localX + Math.sin(this.elapsed * 0.25 + ray.phase) * 1.2,
        groundY + ray.baseYOffset,
        worldZ
      );

      const dist = Math.abs(relZ);
      const fade =
        THREE.MathUtils.smoothstep(dist, 12, 35) *
        (1 - THREE.MathUtils.smoothstep(dist, 145, 210));
      const shimmer = 0.72 + 0.28 * Math.sin(this.elapsed * 0.55 + ray.phase);
      const mat = ray.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = ray.baseOpacity * fade * shimmer * introEase * (1 - this.hoverCurrent * 0.35);
    }

    // Update GPU post-processing uniforms
    if (this.postPass) {
      this.postPass.uniforms.uTime.value = this.elapsed;
      this.postPass.uniforms.uSpeed.value = this.smoothSpeed;
      this.postPass.uniforms.uHover.value = this.hoverCurrent;
    }
    if (this.bloomPass) {
      this.bloomPass.strength = 0.21 + this.hoverCurrent * 0.14 + this.smoothSpeed * 0.06;
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.08);
    this.lastTime = now;

    if (!this.contextLost) {
      this.updateScene(dt);
      if (this.isSoftwareGl || !this.composer) {
        this.renderer.render(this.scene, this.camera);
      } else {
        this.composer.render();
      }
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.audioStore.dispose();

    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
