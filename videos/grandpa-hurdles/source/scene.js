// "Grandpa Hurdles!" — cel-shaded 3D anime short, rendered frame by frame.
const W = 1280, H = 720, FPS = 24, DUR = 120, NF = FPS * DUR;
const V = 6.0, J = 1.9, JH = 0.62, HH = 0.76, STRIDE_F = 1.55;
const TAU2 = Math.PI * 2;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = rng(7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- timeline
const hurdleAll = []; for (let x = 15; x < 1500; x += 11) hurdleAll.push(x);

const SHOTS = [
  { t0: 0, type: 'skyTilt' },
  { t0: 5, type: 'face' },
  { t0: 9, type: 'startLow' },
  { t0: 13.5, type: 'side', d: 6.5, fov: 40 },
  { t0: 21, type: 'front' },
  { t0: 27, type: 'slowSide', slow: 'slow' },
  { t0: 33, type: 'aerial' },
  { t0: 41, type: 'chase' },
  { t0: 47, type: 'hurdleCam' },
  { t0: 51, type: 'side', d: 10, fov: 28 },
  { t0: 58, type: 'feet' },
  { t0: 64, type: 'front' },
  { t0: 70, type: 'bullet', slow: 'bullet' },
  { t0: 79, type: 'aerial' },
  { t0: 86, type: 'side', d: 5.5, fov: 42 },
  { t0: 92, type: 'hurdleCam' },
  { t0: 96, type: 'chase' },
  { t0: 102, type: 'slowFront', slow: 'slow' },
  { t0: 108, type: 'finishStatic' },
  { t0: 114, type: 'celebrate' },
];
SHOTS.forEach((s, i) => s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : DUR);
function shotAt(t) { let s = SHOTS[0]; for (const sh of SHOTS) if (t >= sh.t0) s = sh; return s; }

let xF = null;
function speed(tau, x) {
  let v = V * sstep(9, 10.6, tau);
  if (xF !== null && x > xF - 0.5) v *= clamp(1 - (x - xF + 0.5) / 7, 0, 1);
  return v;
}
function rateFor(sh, x) {
  if (!sh.slow || sh.hx == null) return 1;
  const d = Math.abs(x - sh.hx);
  if (sh.slow === 'bullet') return 0.04 + 0.96 * sstep(0.25, 3.0, d);
  return 0.18 + 0.82 * sstep(1.6, 3.6, d);
}

const sim = new Array(NF);
{
  let tau = 0, x = 0, phi = 0;
  for (let f = 0; f < NF; f++) {
    const t = f / FPS, sh = shotAt(t);
    if (sh.slow && sh.hx === undefined) sh.hx = hurdleAll.find(h => h - x > 5);
    if (sh.type === 'hurdleCam' && sh.hc === undefined) sh.hc = hurdleAll.find(h => h - x > 9);
    if (sh.x0 === undefined) sh.x0 = x;
    if (f === Math.round(111.5 * FPS)) xF = x + 3;
    sim[f] = { f, t, tau, x, phi, v: speed(tau, x), rate: rateFor(sh, x) };
    for (let k = 0; k < 10; k++) {
      const r = rateFor(sh, x), dta = r / FPS / 10, v = speed(tau, x);
      x += v * dta; phi += TAU2 * STRIDE_F * (v / V) * dta; tau += dta;
    }
  }
}
const hurdles = hurdleAll.filter(h => h < xF - 6);
function tauAtX(X) {
  for (let f = 1; f < NF; f++) if (sim[f].x >= X) {
    const a = sim[f - 1], b = sim[f], k = (X - a.x) / ((b.x - a.x) || 1);
    return a.tau + k * (b.tau - a.tau);
  }
  return 1e9;
}
const events = [];
hurdles.forEach(h => {
  events.push({ tau: tauAtX(h - J + 0.1), x: h - J + 0.1, n: 4 });
  events.push({ tau: tauAtX(h + J), x: h + J, n: 7 });
});

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const out = document.createElement('canvas'); out.width = W; out.height = H;
document.body.appendChild(out);
const octx = out.getContext('2d');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcde8ff, 140, 900);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 2600);

const sunDir = new THREE.Vector3(0.35, 0.78, 0.55).normalize();
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x7fa860, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// toon helpers
function gradTex(vals) {
  const d = new Uint8Array(vals.length * 4);
  vals.forEach((v, i) => d.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(d, vals.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
const GRAD = gradTex([120, 200, 255]);
const GRAD_SOFT = gradTex([170, 225, 255]);
const toonCache = {};
function toon(color, soft) {
  const k = color + (soft ? 's' : '');
  return toonCache[k] || (toonCache[k] = new THREE.MeshToonMaterial({ color, gradientMap: soft ? GRAD_SOFT : GRAD }));
}
const outlineCache = {};
function outlineMat(t, col = '0.10,0.07,0.12') {
  const k = t + col;
  return outlineCache[k] || (outlineCache[k] = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: t } }]),
    vertexShader: `uniform float t;
      #include <fog_pars_vertex>
      void main(){ vec4 p = vec4(position + normal*t, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 mvPosition = modelViewMatrix * p; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      void main(){ gl_FragColor = vec4(${col},1.0);
        #include <fog_fragment>
      }`,
    side: THREE.BackSide, fog: true,
  }));
}
function mk(geo, color, outline = 0.012, parent, opts = {}) {
  const m = new THREE.Mesh(geo, opts.mat || toon(color, opts.soft));
  m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
  if (outline) { const o = new THREE.Mesh(geo, outlineMat(outline)); o.castShadow = false; m.add(o); }
  if (parent) parent.add(m);
  return m;
}
const G = {
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  sph: (r, sx = 1, sy = 1, sz = 1, seg = 24) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)).scale(sx, sy, sz),
  cap: (r, l, sx = 1, sz = 1) => new THREE.CapsuleGeometry(r, l, 6, 16).scale(sx, 1, sz),
  cyl: (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg),
};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- sky + clouds
const skyMat = new THREE.ShaderMaterial({
  uniforms: { sunDir: { value: sunDir } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 sunDir; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 top = vec3(0.10,0.40,0.92), mid = vec3(0.36,0.66,0.98), hor = vec3(0.80,0.92,1.0);
      vec3 c = mix(hor, mid, smoothstep(0.0,0.18,h)); c = mix(c, top, smoothstep(0.18,0.75,h));
      if (h < 0.0) c = hor;
      float s = max(dot(d, sunDir), 0.0);
      c += vec3(1.0,0.97,0.85)*smoothstep(0.9993,0.9996,s)*1.5 + vec3(1.0,0.92,0.7)*pow(s,24.0)*0.35;
      gl_FragColor = vec4(c,1.0); }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
sky.renderOrder = -10; scene.add(sky);

const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x9ab8e8, emissiveIntensity: 0.5, gradientMap: gradTex([140, 230]), fog: false });
const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
const cloudOut = outlineMat(0.0, '0.55,0.68,0.85');
for (let i = 0; i < 18; i++) {
  const a = R() * TAU2, dist = 380 + R() * 260, cg = new THREE.Group();
  cg.position.set(Math.cos(a) * dist, 70 + R() * 110, Math.sin(a) * dist);
  const n = 7 + Math.floor(R() * 7), size = 14 + R() * 18;
  for (let k = 0; k < n; k++) {
    const r = size * (0.5 + R() * 0.7);
    const m = new THREE.Mesh(G.sph(r, 1, 0.85, 1, 18), cloudMat);
    m.position.set((R() - 0.5) * size * 3.2, (R() - 0.2) * size * 0.9, (R() - 0.5) * size * 1.6);
    cg.add(m);
  }
  cg.lookAt(0, cg.position.y, 0);
  cloudGroup.add(cg);
}

// ---------------------------------------------------------------- ground / track
const grassTex = canvasTex(2, 1, (c) => { c.fillStyle = '#86d35c'; c.fillRect(0, 0, 1, 1); c.fillStyle = '#76c44f'; c.fillRect(1, 0, 1, 1); });
grassTex.magFilter = THREE.NearestFilter; grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(3000 / 16, 1);
const grass = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshToonMaterial({ map: grassTex, gradientMap: GRAD_SOFT }));
grass.rotation.x = -Math.PI / 2; grass.position.x = 500; grass.receiveShadow = true; scene.add(grass);

const TL = 1700, TX = -150 + TL / 2;
mk(G.box(TL, 0.02, 7.4), 0xd0583f, 0, scene, { soft: true }).position.set(TX, 0.01, 0);
for (const z of [-3.05, -1.83, -0.61, 0.61, 1.83, 3.05])
  mk(G.box(TL, 0.004, 0.05), 0xffffff, 0, scene, { cast: false }).position.set(TX, 0.022, z);
for (const z of [-3.78, 3.78]) mk(G.box(TL, 0.07, 0.16), 0xf4f4f4, 0, scene, { soft: true }).position.set(TX, 0.035, z);
mk(G.box(0.08, 0.004, 7.3), 0xffffff, 0, scene).position.set(-0.6, 0.023, 0);

// hills & mountains
for (let i = 0; i < 22; i++) {
  const side = i % 2 ? 1 : -1, r = 70 + R() * 90;
  const cols = [0x6fbf4d, 0x5aae46, 0x82c95a, 0x4f9e48];
  const m = mk(G.sph(r, 1.6, 1, 1, 28), cols[i % 4], 0, scene, { soft: true, cast: false });
  m.position.set(-300 + R() * 1500, -r * 0.62, side * (200 + R() * 160));
}
for (let i = 0; i < 9; i++) {
  const h = 160 + R() * 120;
  const m = mk(G.cyl(0, h * 1.2, h, 6), 0x7d9fc9, 0, scene, { soft: true, cast: false });
  m.position.set(-200 + i * 180 + R() * 60, h / 2 - 10, -720 - R() * 120);
}

// trees (instanced)
{
  const spots = [];
  for (let x = -120; x < 1300; x += 5.5) for (const side of [-1, 1]) {
    if (R() < 0.35) continue;
    const z = side * (15 + R() * 45);
    if (side < 0 && z > -16) continue;
    spots.push({ x: x + R() * 4, z, s: 0.8 + R() * 0.7, ry: R() * TAU2 });
  }
  const parts = [
    { geo: G.cyl(0.22, 0.3, 2.4, 8).translate(0, 1.2, 0), col: () => new THREE.Color(0x8a5a35), out: 0.03 },
    { geo: G.sph(1.6, 1, 0.9, 1, 14).translate(0, 3.4, 0), col: (i) => new THREE.Color().setHSL(0.27 + (i % 7) * 0.012, 0.55, 0.42 + (i % 5) * 0.03), out: 0.05 },
    { geo: G.sph(1.15, 1, 0.9, 1, 12).translate(0.8, 2.75, 0.4), col: (i) => new THREE.Color().setHSL(0.28 + (i % 5) * 0.012, 0.55, 0.45), out: 0.05 },
    { geo: G.sph(1.1, 1, 0.9, 1, 12).translate(-0.7, 2.85, -0.4), col: (i) => new THREE.Color().setHSL(0.26 + (i % 3) * 0.012, 0.55, 0.4), out: 0.05 },
  ];
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geo, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD }), spots.length);
    const om = new THREE.InstancedMesh(p.geo, outlineMat(p.out), spots.length);
    spots.forEach((s, i) => {
      q.setFromEuler(e.set(0, s.ry, 0));
      mtx.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      im.setMatrixAt(i, mtx); om.setMatrixAt(i, mtx); im.setColorAt(i, p.col(i));
    });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im, om);
  }
}

// ad boards
const adTex = canvasTex(1024, 96, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#1f4fd1'); g.addColorStop(1, '#3a7bf0');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffd23a'; c.fillRect(0, h - 10, w, 10);
  c.font = '900 52px Inter, sans-serif'; c.fillStyle = '#fff'; c.textBaseline = 'middle';
  c.fillText('★ GRANDPA CUP 2026 ★ SUNNY DAY CLASSIC', 24, h / 2 - 4);
});
const adMat = new THREE.MeshBasicMaterial({ map: adTex });
for (let x = -40; x < xF + 60; x += 13) {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.0), adMat);
  b.position.set(x, 0.62, -5.4); scene.add(b);
  mk(G.box(12.6, 1.1, 0.08), 0x2a3a66, 0, scene).position.set(x, 0.6, -5.46);
}

// stands + crowd
const crowd = [];
function stand(x0, x1) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  for (let i = 0; i < 4; i++) {
    mk(G.box(len, 0.5 * (i + 1), 1.2), i % 2 ? 0x9aa7bd : 0xb7c2d6, 0.02, scene, { soft: true }).position.set(cx, 0.25 * (i + 1), -7.2 - 1.2 * i);
    for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.62) {
      if (R() < 0.18) continue;
      crowd.push({ x: x + (R() - 0.5) * 0.15, y: 0.5 * (i + 1), z: -7.2 - 1.2 * i + (R() - 0.5) * 0.2, ph: R() * TAU2, sp: 6 + R() * 5, fin: x0 > 100 });
    }
  }
}
stand(-28, 34); stand(xF - 40, xF + 22);
const bodyIM = new THREE.InstancedMesh(G.cap(0.17, 0.22), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD }), crowd.length);
const headIM = new THREE.InstancedMesh(G.sph(0.13, 1, 1, 1, 12), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD }), crowd.length);
const bodyOut = new THREE.InstancedMesh(bodyIM.geometry, outlineMat(0.02), crowd.length);
const headOut = new THREE.InstancedMesh(headIM.geometry, outlineMat(0.02), crowd.length);
{
  const shirts = [0xff5c5c, 0xffc23a, 0x4fa3ff, 0x6ad16a, 0xff8ad8, 0xffffff, 0x9b6bff, 0xff9a3c];
  const skins = [0xf5d0b0, 0xe8b48f, 0xc98e66, 0x9a6a48, 0xf8dcc4];
  crowd.forEach((c, i) => { bodyIM.setColorAt(i, new THREE.Color(shirts[Math.floor(R() * shirts.length)])); headIM.setColorAt(i, new THREE.Color(skins[Math.floor(R() * skins.length)])); });
}
scene.add(bodyIM, headIM, bodyOut, headOut);
function updateCrowd(t, excite) {
  const m = new THREE.Matrix4();
  crowd.forEach((c, i) => {
    const ex = c.fin ? excite : 0.25;
    const b = Math.abs(Math.sin(t * c.sp + c.ph)) * 0.18 * ex;
    m.makeTranslation(c.x, c.y + 0.37 + b, c.z); bodyIM.setMatrixAt(i, m); bodyOut.setMatrixAt(i, m);
    m.makeTranslation(c.x, c.y + 0.82 + b, c.z); headIM.setMatrixAt(i, m); headOut.setMatrixAt(i, m);
  });
  for (const im of [bodyIM, headIM, bodyOut, headOut]) im.instanceMatrix.needsUpdate = true;
}

// finish arch + tape
const finTex = (txt) => canvasTex(1024, 192, (c, w, h) => {
  c.fillStyle = '#e8282b'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff'; c.fillRect(0, 10, w, 8); c.fillRect(0, h - 18, w, 8);
  c.font = '900 120px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4);
});
{
  for (const z of [-4.3, 4.3]) mk(G.cyl(0.12, 0.12, 4.2), 0xf0f0f0, 0.02, scene).position.set(xF, 2.1, z);
  mk(G.box(0.25, 1.2, 9.0), 0xe8282b, 0.02, scene).position.set(xF, 3.9, 0);
  const tex = finTex('FINISH');
  const a = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 1.1), new THREE.MeshBasicMaterial({ map: tex })); a.rotation.y = -Math.PI / 2; a.position.set(xF - 0.13, 3.9, 0); scene.add(a);
  const b = a.clone(); b.rotation.y = Math.PI / 2; b.position.x = xF + 0.13; scene.add(b);
  const chk = canvasTex(16, 2, (c) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(i, j, 1, 1); } });
  chk.magFilter = THREE.NearestFilter;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 7.3), new THREE.MeshToonMaterial({ map: chk, gradientMap: GRAD_SOFT }));
  chk.rotation = Math.PI / 2; chk.center.set(0.5, 0.5);
  fl.rotation.x = -Math.PI / 2; fl.position.set(xF, 0.024, 0); fl.receiveShadow = true; scene.add(fl);
}
const tapeL = new THREE.Group(), tapeR = new THREE.Group();
tapeL.position.set(xF, 1.15, 4.2); tapeR.position.set(xF, 1.15, -4.2);
mk(G.box(0.02, 0.05, 4.2), 0xff3355, 0, tapeL).position.z = -2.1;
mk(G.box(0.02, 0.05, 4.2), 0xff3355, 0, tapeR).position.z = 2.1;
scene.add(tapeL, tapeR);

// hurdles
function buildHurdle() {
  const g = new THREE.Group();
  for (const z of [-0.6, 0.6]) {
    mk(G.box(0.045, HH, 0.045), 0xe8e8e8, 0.01, g).position.set(0, HH / 2, z);
    mk(G.box(0.55, 0.045, 0.06), 0x333344, 0.01, g).position.set(-0.24, 0.022, z);
  }
  mk(G.box(0.03, 0.11, 1.3), 0xffffff, 0.012, g).position.set(0, HH - 0.055, 0);
  for (const z of [-0.33, 0.33, 0]) mk(G.box(0.034, 0.114, 0.14), z === 0 ? 0xe8282b : 0x222222, 0, g).position.set(0, HH - 0.055, z);
  return g;
}
const hurdleProto = buildHurdle();
hurdles.forEach(h => { const g = hurdleProto.clone(); g.position.x = h; scene.add(g); });

// dust puffs
const puffMat = new THREE.MeshToonMaterial({ color: 0xfff6e8, gradientMap: GRAD_SOFT, transparent: true, opacity: 0.6, depthWrite: false });
const puffs = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(G.sph(1, 1, 1, 1, 12), puffMat.clone()); m.visible = false; scene.add(m); puffs.push(m); }

// ---------------------------------------------------------------- grandpa
const P = {};
function buildGrandpa() {
  const SKIN = 0xf3c7a2, SHIRT = 0xffffff, SHORTS = 0x2459d6, BAND = 0xe8282b, HAIR = 0xf7f7f7, SHOE = 0xff7a1a;
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  mk(G.sph(0.17, 1, 0.72, 1.22), SHORTS, 0.012, hips).position.y = 0.02;
  const torso = new THREE.Group(); torso.position.y = 0.04; hips.add(torso);
  mk(G.cap(0.16, 0.22, 0.95, 1.18), SHIRT, 0.012, torso).position.y = 0.24;
  mk(G.sph(0.15, 1, 0.95, 1.1), SHIRT, 0.012, torso).position.set(0.05, 0.15, 0); // little belly
  const bibTex = canvasTex(128, 96, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e8282b'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#111'; c.font = '900 62px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('82', w / 2, h / 2 + 4);
  });
  const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.13), new THREE.MeshToonMaterial({ map: bibTex, gradientMap: GRAD_SOFT }));
  bib.rotation.y = Math.PI / 2; bib.rotation.z = 0.05; bib.position.set(0.195, 0.26, 0); torso.add(bib);
  mk(G.cyl(0.055, 0.06, 0.12), SKIN, 0.01, torso).position.y = 0.53;
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  mk(G.sph(0.16, 1, 1.02, 0.97, 32), SKIN, 0.012, head);
  // hair tufts
  for (const [x, y, z, r] of [[-0.07, -0.01, 0.12, 0.07], [-0.07, -0.01, -0.12, 0.07], [-0.13, 0.0, 0.06, 0.07], [-0.13, 0.0, -0.06, 0.07], [-0.02, -0.03, 0.14, 0.05], [-0.02, -0.03, -0.14, 0.05]])
    mk(G.sph(r, 1, 0.9, 1, 14), HAIR, 0.01, head).position.set(x, y, z);
  for (const z of [0.155, -0.155]) mk(G.sph(0.035, 0.7, 1.2, 0.6, 12), SKIN, 0.008, head).position.set(0.0, -0.02, z);
  // face
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a14 });
  const irisMat = new THREE.MeshBasicMaterial({ color: 0x5a3820 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  P.eyes = [];
  for (const s of [1, -1]) {
    const eg = new THREE.Group(); eg.position.set(0.138, 0.0, s * 0.056); eg.rotation.y = -s * 0.35; head.add(eg);
    const sclera = new THREE.Mesh(G.sph(0.036, 0.35, 1.25, 1, 16), white); eg.add(sclera);
    const iris = new THREE.Mesh(G.sph(0.028, 0.4, 1.3, 0.85, 16), irisMat); iris.position.set(0.006, -0.004, 0); eg.add(iris);
    const pupil = new THREE.Mesh(G.sph(0.016, 0.4, 1.3, 0.85, 12), eyeMat); pupil.position.set(0.011, -0.006, 0); eg.add(pupil);
    const hl = new THREE.Mesh(G.sph(0.009, 0.4, 1, 1, 8), white); hl.position.set(0.016, 0.014, s * 0.008); eg.add(hl);
    const hl2 = new THREE.Mesh(G.sph(0.005, 0.4, 1, 1, 8), white); hl2.position.set(0.016, -0.018, -s * 0.007); eg.add(hl2);
    const lid = new THREE.Mesh(G.box(0.012, 0.008, 0.07), eyeMat); lid.position.set(0.012, 0.045, 0); eg.add(lid);
    P.eyes.push(eg);
    const brow = mk(G.sph(0.045, 0.55, 0.42, 1.25, 14), HAIR, 0.008, head); brow.position.set(0.14, 0.072, s * 0.06); brow.rotation.x = s * 0.25;
    const blush = new THREE.Mesh(G.sph(0.025, 0.3, 0.6, 1.1, 10), new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.55 }));
    blush.position.set(0.13, -0.045, s * 0.088); blush.rotation.y = -s * 0.5; head.add(blush);
  }
  mk(G.sph(0.028, 1, 0.9, 1, 12), SKIN, 0.006, head).position.set(0.16, -0.025, 0);
  P.must = [];
  for (const s of [1, -1]) {
    const mg = new THREE.Group(); mg.position.set(0.148, -0.062, s * 0.012); head.add(mg);
    const m = mk(G.sph(0.05, 0.55, 0.42, 1.35, 14), HAIR, 0.008, mg); m.position.set(0, -0.006, s * 0.045); m.rotation.x = s * 0.45;
    P.must.push(mg);
  }
  mk(G.sph(0.038, 0.8, 1.1, 1, 12), HAIR, 0.008, head).position.set(0.125, -0.12, 0);
  // headband
  const band = mk(new THREE.TorusGeometry(0.158, 0.022, 10, 36), BAND, 0.008, head); band.rotation.x = Math.PI / 2; band.position.y = 0.05; band.scale.set(1, 0.98, 1);
  P.tails = [];
  for (const s of [1, -1]) {
    const tg = new THREE.Group(); tg.position.set(-0.16, 0.05, s * 0.025); head.add(tg);
    mk(G.box(0.22, 0.04, 0.01), BAND, 0.006, tg).position.x = -0.11;
    P.tails.push(tg);
  }
  // arms
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(0, 0.43, s * 0.215); torso.add(sh);
    mk(G.sph(0.07, 1, 1, 1, 14), SHIRT, 0.01, sh);
    mk(G.cap(0.046, 0.2), SKIN, 0.01, sh).position.y = -0.15;
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    mk(G.cap(0.042, 0.19), SKIN, 0.01, el).position.y = -0.13;
    mk(G.sph(0.055, 1, 1.1, 0.9, 14), SKIN, 0.01, el).position.y = -0.28;
    return { sh, el };
  };
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(0, -0.02, s * 0.1); hips.add(hp);
    mk(G.cyl(0.095, 0.085, 0.22), SHORTS, 0.01, hp).position.y = -0.1;
    mk(G.cap(0.064, 0.3), SKIN, 0.01, hp).position.y = -0.25;
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
    mk(G.cap(0.056, 0.3), SKIN, 0.01, kn).position.y = -0.2;
    mk(G.cyl(0.06, 0.058, 0.13), 0xffffff, 0.008, kn).position.y = -0.34;
    const an = new THREE.Group(); an.position.y = -0.43; kn.add(an);
    mk(G.box(0.27, 0.085, 0.115), SHOE, 0.01, an).position.set(0.06, -0.025, 0);
    mk(G.box(0.28, 0.03, 0.12), 0xffffff, 0.006, an).position.set(0.06, -0.075, 0);
    return { hp, kn, an };
  };
  Object.assign(P, { root, hips, torso, head, aL: arm(1), aR: arm(-1), lL: leg(1), lR: leg(-1) });
  return root;
}
scene.add(buildGrandpa());

const POSE_KEYS = ['lean', 'twist', 'hipY', 'thL', 'knL', 'abL', 'thR', 'knR', 'abR', 'arL', 'elL', 'abaL', 'arR', 'elR', 'abaR', 'headZ', 'ftL', 'ftR'];
function mixPose(a, b, w) { if (w <= 0) return a; const o = {}; for (const k of POSE_KEYS) o[k] = lerp(a[k] || 0, b[k] || 0, w); return o; }
function poseFor(s) {
  const { tau, x, phi, v } = s;
  let p = { hipY: 0.95, headZ: 0.05, elL: 0.15, elR: 0.15, abaL: 0.08, abaR: 0.08 };
  // stretching arm circles
  if (tau < 6) {
    let ang = -6 * Math.PI * sstep(0.6, 4.6, tau); ang = ang % TAU2;
    const kb = 0.25 * (0.5 - 0.5 * Math.cos(tau * 6.3)) * (1 - sstep(4.2, 4.8, tau));
    p = mixPose(p, { hipY: 0.95 - kb * 0.25, thL: kb * 0.5, knL: -kb, thR: kb * 0.5, knR: -kb, arL: ang, arR: ang, abaL: 0.3, abaR: 0.3, elL: 0.1, elR: 0.1, headZ: 0.1, lean: -kb * 0.3 }, 1);
  }
  // ready stance
  const wReady = sstep(4.8, 5.8, tau);
  const nod = Math.exp(-Math.pow((tau - 7.1) / 0.18, 2));
  p = mixPose(p, { lean: -0.32, hipY: 0.86, thL: 0.35, knL: -0.6, thR: -0.1, knR: -0.35, ftL: 0.25, ftR: 0.1, arL: -0.5, elL: 1.2, arR: 0.6, elR: 1.3, abaL: 0.1, abaR: 0.1, headZ: 0.32 - 0.3 * nod }, wReady);
  // running
  const runW = clamp(v / V * 1.6, 0, 1);
  if (runW > 0) {
    const sL = Math.sin(phi), sR = Math.sin(phi + Math.PI);
    const kn = (ph) => -(0.18 + 1.45 * Math.pow(Math.max(0, Math.cos(ph + 0.4)), 1.4));
    const run = {
      lean: -0.24, twist: 0.13 * sL, hipY: 0.9 + 0.05 * Math.abs(sL),
      thL: 0.78 * sL + 0.12, knL: kn(phi), thR: 0.78 * sR + 0.12, knR: kn(phi + Math.PI),
      ftL: 0.3 * Math.max(0, -Math.cos(phi)), ftR: 0.3 * Math.max(0, Math.cos(phi)),
      arL: -0.75 * sL, elL: 1.45 - 0.25 * sL, arR: 0.75 * sL, elR: 1.45 + 0.25 * sL, abaL: 0.12, abaR: 0.12, headZ: 0.2,
    };
    p = mixPose(p, run, runW);
  }
  // hurdle clearance
  const jp = jumpP(x);
  let rootY = 0;
  if (jp >= 0) {
    const jw = sstep(0, 0.26, jp) * (1 - sstep(0.74, 1, jp));
    p = mixPose(p, { lean: -0.68, twist: -0.25, hipY: 0.9, thL: 1.55, knL: -0.05, ftL: -0.3, thR: 0.25, abR: 1.3, knR: -1.75, ftR: 0.2, arR: 1.75, elR: 0.12, abaR: 0.05, arL: -0.75, elL: 1.1, abaL: 0.35, headZ: 0.55 }, jw);
    rootY = JH * 4 * jp * (1 - jp);
  }
  // victory
  let cheerW = 0;
  if (x > xF - 0.4) cheerW = sstep(0.75, 0.25, v / V);
  if (cheerW > 0) {
    const pump = Math.sin(tau * 11);
    p = mixPose(p, { lean: 0.12, hipY: 0.94, thL: 0.05, knL: -0.12, thR: -0.05, knR: -0.12, arL: 2.95 + 0.12 * pump, abaL: -0.55, elL: 0.3, arR: 2.95 - 0.12 * pump, abaR: -0.55, elR: 0.35, headZ: 0.4 }, cheerW);
    rootY += 0.13 * Math.abs(Math.sin(tau * 5.5)) * cheerW;
  }
  p.rootY = rootY; p.cheerW = cheerW;
  return p;
}
function jumpP(x) {
  for (const h of hurdles) { if (h - x > J) break; if (Math.abs(x - h) < J) return (x - h + J) / (2 * J); }
  return -1;
}
function applyPose(s) {
  const p = poseFor(s);
  P.root.position.set(s.x, p.rootY, 0);
  P.hips.position.y = p.hipY;
  P.torso.rotation.set(0, p.twist || 0, p.lean || 0);
  P.head.rotation.set(0, -(p.twist || 0) * 0.6, (p.headZ || 0) - (p.lean || 0) * 0.5);
  P.lL.hp.rotation.set(-(p.abL || 0), 0, p.thL || 0); P.lL.kn.rotation.z = p.knL || 0; P.lL.an.rotation.z = p.ftL || 0;
  P.lR.hp.rotation.set(p.abR || 0, 0, p.thR || 0); P.lR.kn.rotation.z = p.knR || 0; P.lR.an.rotation.z = p.ftR || 0;
  P.aL.sh.rotation.set(-(p.abaL || 0), 0, p.arL || 0); P.aL.el.rotation.z = p.elL || 0;
  P.aR.sh.rotation.set(p.abaR || 0, 0, p.arR || 0); P.aR.el.rotation.z = p.elR || 0;
  // secondary motion
  const sp = 0.25 + 0.75 * s.v / V, tau = s.tau;
  P.tails.forEach((tg, i) => { tg.rotation.set(0, (i ? -1 : 1) * 0.25 + 0.35 * Math.sin(tau * 17 + i) * sp, -0.5 * (1 - sp) + 0.25 * Math.sin(tau * 13 + i * 2) * sp); });
  P.must.forEach((mg, i) => { mg.rotation.z = 0.12 * Math.sin(tau * 21 + i) * sp; });
  const bl = (tau % 3.7) < 0.11 && p.cheerW < 0.5 ? 0.12 : 1;
  P.eyes.forEach(e => e.scale.y = bl);
  return p;
}

// ---------------------------------------------------------------- per-frame world update
function updateWorld(s) {
  const { tau, x } = s;
  applyPose(s);
  P.root.updateMatrixWorld(true);
  sun.position.set(x + sunDir.x * 40, sunDir.y * 40, sunDir.z * 40);
  sun.target.position.set(x, 0, 0); sun.target.updateMatrixWorld();
  // tape
  const brk = sstep(xF - 0.1, xF + 2.2, x);
  tapeL.rotation.set(0, -brk * 1.35, 0); tapeR.rotation.set(0, brk * 1.35, 0);
  tapeL.position.y = tapeR.position.y = 1.15 - brk * 0.5;
  // crowd
  updateCrowd(tau, 0.3 + 0.7 * sstep(xF - 25, xF, x));
  // puffs
  let pi = 0;
  for (const e of events) {
    const age = tau - e.tau; if (age < 0 || age > 0.75) continue;
    const r = rng(Math.round(e.x * 100));
    for (let k = 0; k < e.n && pi < puffs.length; k++, pi++) {
      const m = puffs[pi]; m.visible = true;
      const dir = (r() - 0.5) * Math.PI * 1.4, spd = 0.5 + r() * 0.8, k2 = 1 - Math.exp(-age * 5);
      m.position.set(e.x - 0.3 + Math.cos(dir) * -spd * k2 * 0.7, 0.08 + k2 * 0.18 * r(), Math.sin(dir) * spd * k2);
      m.scale.setScalar((0.07 + 0.2 * k2) * (0.7 + r() * 0.6));
      m.material.opacity = 0.6 * (1 - sstep(0.25, 0.75, age));
    }
  }
  for (; pi < puffs.length; pi++) puffs[pi].visible = false;
}

// ---------------------------------------------------------------- cameras
const tmp = new THREE.Vector3(), headW = new THREE.Vector3();
function setCamera(sh, s) {
  const t = s.t, x = s.x, k = (t - sh.t0) / (sh.t1 - sh.t0);
  P.head.getWorldPosition(headW);
  const body = new THREE.Vector3(x, P.root.position.y + 1.05, 0);
  let pos, look, fov = 40, roll = 0;
  switch (sh.type) {
    case 'skyTilt': {
      const e = sstep(0.05, 0.95, k);
      pos = new THREE.Vector3(lerp(-6, -5.5, e), lerp(2.2, 1.5, e), lerp(13, 6.5, e));
      look = new THREE.Vector3(lerp(30, 0, e), lerp(70, 1.15, e), lerp(-120, 0, e));
      fov = lerp(55, 38, e); break;
    }
    case 'face': {
      const e = sstep(0, 1, k);
      pos = headW.clone().add(new THREE.Vector3(lerp(1.5, 1.1, e), 0.05, lerp(0.6, 0.42, e)));
      look = headW.clone().add(new THREE.Vector3(0, -0.05, 0)); fov = 34; break;
    }
    case 'startLow':
      pos = new THREE.Vector3(17.5, 0.22, 1.7); look = new THREE.Vector3(x, 1.0 + P.root.position.y, 0);
      fov = lerp(30, 50, sstep(10, 15, x)); break;
    case 'side': {
      const d = sh.d || 6.5;
      pos = new THREE.Vector3(x + 0.4, 1.15, d); look = new THREE.Vector3(x + 0.4, 0.95, 0); fov = sh.fov || 40; break;
    }
    case 'front':
      pos = new THREE.Vector3(x + 5.2, 0.55, 1.25); look = new THREE.Vector3(x, 1.2, 0); fov = 44; roll = 0.04; break;
    case 'chase':
      pos = new THREE.Vector3(x - 4.6, 1.75, -1.3); look = new THREE.Vector3(x + 5, 0.9, 0.3); fov = 48; break;
    case 'aerial': {
      const e = sstep(0, 1, k);
      pos = new THREE.Vector3(x - 9 + 13 * e, lerp(3.5, 15, e), lerp(13, 9, e)); look = new THREE.Vector3(x + 2, 0.6, 0); fov = 50; break;
    }
    case 'slowSide':
      pos = new THREE.Vector3(x + 0.4, 1.15, 3.1); look = new THREE.Vector3(x + 0.4, 1.15 + P.root.position.y * 0.6, 0); fov = 36; break;
    case 'hurdleCam':
      pos = new THREE.Vector3(sh.hc + 1.0, 0.12, 0.95); look = body.clone(); fov = 58; roll = -0.05; break;
    case 'feet':
      pos = new THREE.Vector3(x + 0.8, 0.28, 3.4); look = new THREE.Vector3(x + 0.8, 0.75, 0); fov = 50; break;
    case 'bullet': {
      const e = sstep(sh.t0 + 0.6, sh.t1 - 0.4, t);
      const a = Math.PI / 2 - e * Math.PI * 1.55;
      const c = body.clone(); c.y += 0.1;
      pos = c.clone().add(new THREE.Vector3(Math.cos(a) * 3.3, 0.25 - 0.4 * Math.sin(e * Math.PI), Math.sin(a) * 3.3));
      look = c; fov = 40; break;
    }
    case 'slowFront':
      pos = new THREE.Vector3(x + 3.4, 0.45, 1.0); look = new THREE.Vector3(x, 1.3 + P.root.position.y, 0); fov = 44; break;
    case 'finishStatic':
      pos = new THREE.Vector3(xF + 11, 1.4, 2.6); look = new THREE.Vector3(Math.min(x, xF + 3), 1.4, 0); fov = 40; break;
    case 'celebrate': {
      const e = sstep(0, 1, k), a = lerp(-0.2, 1.0, e);
      const c = new THREE.Vector3(x, 1.25 + P.root.position.y * 0.5, 0);
      pos = c.clone().add(new THREE.Vector3(Math.cos(a) * lerp(3.2, 4.6, e), lerp(-0.45, 0.3, e), Math.sin(a) * lerp(3.2, 4.6, e)));
      look = c; fov = 42; break;
    }
  }
  camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix();
  camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(look);
  sky.position.copy(camera.position);
  cloudGroup.position.set(camera.position.x * 0.85, 0, camera.position.z);
}

// ---------------------------------------------------------------- 2D overlay (anime FX)
function speedLines(ctx, f, amt, cx = W / 2, cy = H / 2, color = '255,255,255') {
  if (amt <= 0.01) return;
  const r = rng(f * 977 + 13);
  ctx.save();
  const n = Math.floor(90 * amt);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU2, r0 = 260 + r() * 260, w = 0.004 + r() * 0.012;
    ctx.fillStyle = `rgba(${color},${0.25 + r() * 0.45 * amt})`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * 1500, cy + Math.sin(a - w) * 1500);
    ctx.lineTo(cx + Math.cos(a + w) * 1500, cy + Math.sin(a + w) * 1500);
    ctx.fill();
  }
  ctx.restore();
}
function hLines(ctx, f, amt) {
  if (amt <= 0.01) return;
  const r = rng(f * 31 + 7);
  ctx.save();
  for (let i = 0; i < 26 * amt; i++) {
    const y = r() * H, len = 200 + r() * 500, x0 = r() * W - len / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.35 * r()})`; ctx.fillRect(x0, y, len, 1 + r() * 2.5);
  }
  ctx.restore();
}
function sunFlare(ctx) {
  const sp = camera.position.clone().add(sunDir.clone().multiplyScalar(1000));
  const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
  if (camDir.dot(sunDir) < 0.2) return;
  const n = sp.project(camera);
  const sx = (n.x * 0.5 + 0.5) * W, sy = (-n.y * 0.5 + 0.5) * H;
  if (sx < -300 || sx > W + 300 || sy < -300 || sy > H + 300) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 380);
  g.addColorStop(0, 'rgba(255,250,225,0.95)'); g.addColorStop(0.08, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU2 + 0.2, len = i % 2 ? 260 : 420;
    ctx.fillStyle = 'rgba(255,245,210,0.10)'; ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - 0.03) * len, sy + Math.sin(a - 0.03) * len); ctx.lineTo(sx + Math.cos(a + 0.03) * len, sy + Math.sin(a + 0.03) * len); ctx.fill();
  }
  const dx = W / 2 - sx, dy = H / 2 - sy;
  [[0.5, 30, '180,255,200'], [0.8, 60, '160,200,255'], [1.25, 22, '255,180,220'], [1.6, 90, '200,230,255']].forEach(([k, r, c]) => {
    const g2 = ctx.createRadialGradient(sx + dx * k, sy + dy * k, 0, sx + dx * k, sy + dy * k, r);
    g2.addColorStop(0, `rgba(${c},0.12)`); g2.addColorStop(0.8, `rgba(${c},0.08)`); g2.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx + dx * k, sy + dy * k, r, 0, TAU2); ctx.fill();
  });
  ctx.restore();
}
function animeText(ctx, txt, x, y, size, opts = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(opts.rot || 0); ctx.scale(opts.scale || 1, opts.scale || 1);
  ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
  ctx.font = `${opts.weight || 900} ${size}px ${opts.font || 'Inter, "IPAGothic", sans-serif'}`;
  ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.32; ctx.strokeStyle = opts.outer || '#ffffff'; ctx.strokeText(txt, 0, 0);
  ctx.lineWidth = size * 0.16; ctx.strokeStyle = opts.stroke || '#1b1030'; ctx.strokeText(txt, 0, 0);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, opts.c1 || '#fff35c'); g.addColorStop(1, opts.c2 || '#ff7a1a');
  ctx.fillStyle = g; ctx.fillText(txt, 0, 0);
  ctx.restore();
}
function sparkle(ctx, x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(255,255,200,0.9)'; ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.18 : s; const ang = i / 8 * TAU2; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
  ctx.fill(); ctx.restore();
}
function drawOverlay(ctx, sh, s, f) {
  const t = s.t;
  sunFlare(ctx);
  // anime FX per shot
  const jp = jumpP(s.x), inJump = jp >= 0 ? Math.sin(Math.PI * jp) : 0;
  if (sh.type === 'front' || sh.type === 'slowFront') speedLines(ctx, f, 0.35 + 0.65 * inJump);
  if (sh.type === 'chase') speedLines(ctx, f, 0.4, W / 2, H * 0.55);
  if (sh.type === 'side' || sh.type === 'feet') hLines(ctx, f, 0.5 + inJump * 0.6);
  if (sh.slow) {
    const slowAmt = 1 - s.rate;
    if (sh.type === 'slowSide') hLines(ctx, Math.floor(f / 3), slowAmt * 1.2);
    else speedLines(ctx, Math.floor(f / 2), slowAmt * 1.1);
    if (sh.type === 'bullet') {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,225,190,${0.35 * slowAmt})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
  // cut flash into slow-mo shots
  for (const S of SHOTS) if (S.slow && t >= S.t0 && t < S.t0 + 0.3) { ctx.fillStyle = `rgba(255,255,255,${1 - (t - S.t0) / 0.3})`; ctx.fillRect(0, 0, W, H); }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
  vg.addColorStop(0, 'rgba(20,10,40,0)'); vg.addColorStop(1, 'rgba(20,10,40,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // title
  if (t > 0.6 && t < 5.0) {
    const a = sstep(0.6, 1.1, t) * (1 - sstep(4.5, 5.0, t));
    const sl = 1 - sstep(0.6, 1.3, t);
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#ff3d5a';
    ctx.beginPath(); ctx.moveTo(0, 455 - sl * 200); ctx.lineTo(W, 395 - sl * 200); ctx.lineTo(W, 470 - sl * 200); ctx.lineTo(0, 530 - sl * 200); ctx.fill(); ctx.restore();
    animeText(ctx, 'おじいちゃん、跳ぶ！', W / 2 + sl * 900, 330, 96, { alpha: a, font: '"IPAGothic", sans-serif', weight: 700, rot: -0.05 });
    animeText(ctx, 'GRANDPA HURDLES!', W / 2 - sl * 900, 462, 44, { alpha: a, c1: '#ffffff', c2: '#ffe0f0', rot: -0.05 });
    animeText(ctx, 'EPISODE 1 · A SUNNY DAY', W / 2, 560, 22, { alpha: a * sstep(1.4, 2.0, t), c1: '#fff', c2: '#dff', weight: 800 });
  }
  // name caption
  if (t > 5.6 && t < 8.9) {
    const a = sstep(5.6, 6.0, t) * (1 - sstep(8.5, 8.9, t));
    const sl = 1 - sstep(5.6, 6.1, t);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.moveTo(60 - sl * 500, 560); ctx.lineTo(560 - sl * 500, 560); ctx.lineTo(530 - sl * 500, 650); ctx.lineTo(60 - sl * 500, 650); ctx.fill();
    ctx.fillStyle = '#ff3d5a'; ctx.fillRect(60 - sl * 500, 560, 14, 90);
    ctx.fillStyle = '#1b1030'; ctx.font = '900 40px Inter, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('KENJI TANAKA', 92 - sl * 500, 592);
    ctx.font = '700 22px Inter, sans-serif'; ctx.fillStyle = '#ff3d5a'; ctx.fillText('AGE 82 · RETIRED POSTMAN · LEGEND', 94 - sl * 500, 628);
    ctx.restore();
  }
  if (sh.type === 'face' && t > 7.3 && t < 8.6) {
    const a = Math.sin(Math.PI * (t - 7.3) / 1.3);
    for (const e of P.eyes) {
      const p = new THREE.Vector3(0.02, 0.02, 0); e.localToWorld(p); p.project(camera);
      sparkle(ctx, (p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, 26 + 14 * a, a);
    }
  }
  if (t > 8.95 && t < 10.6) {
    const k = (t - 8.95) / 1.65, sc = 0.6 + 0.5 * sstep(0, 0.15, k) - 0.1 * sstep(0.15, 0.3, k);
    speedLines(ctx, f, 0.8 * (1 - k), W / 2, H / 2, '255,240,120');
    animeText(ctx, 'GO!!', W / 2, H / 2, 170, { scale: sc, alpha: 1 - sstep(0.75, 1, k), rot: -0.08 });
  }
  // HUD
  if (t > 13.5 && t < 116) {
    const cleared = hurdles.filter(h => h + J < s.x).length;
    ctx.save(); ctx.globalAlpha = sstep(13.5, 14, t) * (1 - sstep(115.5, 116, t));
    ctx.fillStyle = 'rgba(27,16,48,0.75)'; ctx.beginPath(); ctx.moveTo(30, 28); ctx.lineTo(300, 28); ctx.lineTo(285, 78); ctx.lineTo(30, 78); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(30, 28, 8, 50);
    ctx.font = '800 18px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText('HURDLES CLEARED', 52, 53);
    ctx.font = '900 34px Inter, sans-serif'; ctx.fillStyle = '#ffd23a'; ctx.fillText(String(cleared), 228, 54);
    ctx.restore();
  }
  // slow-mo label
  if (sh.slow && s.rate < 0.6) {
    ctx.save(); ctx.globalAlpha = sstep(0.6, 0.3, s.rate);
    ctx.font = 'italic 900 26px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.strokeStyle = '#1b1030'; ctx.lineWidth = 6; ctx.strokeText(sh.slow === 'bullet' ? '⏸  OJII-TIME' : 'SLOW-MO', W - 40, 56); ctx.fillText(sh.slow === 'bullet' ? '⏸  OJII-TIME' : 'SLOW-MO', W - 40, 56);
    ctx.restore();
  }
  // finish!
  if (t > 112 && t < 116.5 && s.x > xF) {
    const k = clamp((t - 112) / 4.5, 0, 1);
    let tf = 0; for (let i = 0; i < NF; i++) if (sim[i].x > xF) { tf = sim[i].t; break; }
    const kk = clamp((t - tf) / 0.5, 0, 1);
    if (t - tf < 0.25) { ctx.fillStyle = `rgba(255,255,255,${1 - (t - tf) / 0.25})`; ctx.fillRect(0, 0, W, H); }
    speedLines(ctx, f, 0.7 * (1 - sstep(tf, tf + 2.5, t)), W / 2, H / 2, '255,230,120');
    animeText(ctx, 'ゴール！！', W * 0.27, 150, 100, { scale: 0.5 + 0.5 * sstep(0, 1, kk * 2) , alpha: 1 - sstep(0.85, 1, k), font: '"IPAGothic", sans-serif', weight: 700, rot: -0.06 });
    animeText(ctx, 'FINISH!', W * 0.27, 250, 50, { alpha: (1 - sstep(0.85, 1, k)) * kk, c1: '#ffffff', c2: '#ffd0e8', rot: -0.06 });
  }
  // confetti
  if (s.x > xF && t > 111) {
    let tf = 0; for (let i = 0; i < NF; i++) if (sim[i].x > xF) { tf = sim[i].t; break; }
    const r = rng(99), cols = ['#ff3d5a', '#ffd23a', '#3ab0ff', '#6ad16a', '#ff8ad8', '#ffffff', '#9b6bff'];
    for (let i = 0; i < 220; i++) {
      const st = tf + r() * 3.5, x0 = r() * W, sp = 120 + r() * 160, sw = r() * 6, c = cols[i % cols.length], sz = 6 + r() * 8;
      const age = t - st; if (age < 0) continue;
      const y = -20 + age * sp, x = x0 + Math.sin(age * 2 + sw) * 30;
      if (y > H + 20) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(age * (3 + sw)); ctx.scale(1, Math.abs(Math.cos(age * 5 + sw)) + 0.1);
      ctx.fillStyle = c; ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
    }
  }
  // the end
  if (t > 116.6) {
    const a = sstep(116.6, 117.4, t);
    ctx.fillStyle = `rgba(255,255,255,${0.35 * a})`; ctx.fillRect(0, 0, W, H);
    const cleared = hurdles.length;
    animeText(ctx, 'おわり', W / 2, 105, 100, { alpha: a, font: '"IPAGothic", sans-serif', weight: 700, c1: '#ffffff', c2: '#ffd6e6', stroke: '#ff3d5a' });
    animeText(ctx, `THE END · ${cleared} HURDLES · 0 REGRETS`, W / 2, 190, 30, { alpha: sstep(117.2, 117.9, t), c1: '#fff', c2: '#fff', weight: 800 });
    const fb = sstep(119.3, 120, t); ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H);
  }
  if (t < 0.5) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.5})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- entry
window.renderFrame = function (f) {
  const s = sim[f], sh = shotAt(s.t);
  updateWorld(s);
  setCamera(sh, s);
  renderer.render(scene, camera);
  octx.drawImage(renderer.domElement, 0, 0);
  drawOverlay(octx, sh, s, f);
  return out.toDataURL('image/jpeg', 0.93);
};
window.INFO = { xF, hurdles: hurdles.length, shots: SHOTS.map(s => [s.t0, s.type, s.hx, s.hc, s.x0 && s.x0.toFixed(1)]) };
window.READY = true;
