// 5-second cartoon parody: a toon footballer (Beckham caricature) tells a soccer joke.
const W = 1280, H = 720, FPS = 24, NF = 120, TAU2 = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = rng(11);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const octx = out.getContext('2d');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcde8ff, 60, 260);
const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 1200);
const sunDir = new THREE.Vector3(0.7, 0.8, 0.4).normalize();
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x7fa860, 1.35));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
sun.position.copy(sunDir).multiplyScalar(15); scene.add(sun, sun.target);

function gradTex(vals) {
  const d = new Uint8Array(vals.length * 4); vals.forEach((v, i) => d.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(d, vals.length, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
const GRAD = gradTex([120, 200, 255]), GRAD_SOFT = gradTex([170, 225, 255]);
const tc = {};
const toon = (c, soft) => tc[c + '' + soft] || (tc[c + '' + soft] = new THREE.MeshToonMaterial({ color: c, gradientMap: soft ? GRAD_SOFT : GRAD }));
const oc = {};
function outlineMat(t) {
  return oc[t] || (oc[t] = new THREE.ShaderMaterial({
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
      void main(){ gl_FragColor = vec4(0.10,0.07,0.12,1.0);
        #include <fog_fragment>
      }`,
    side: THREE.BackSide, fog: true,
  }));
}
function mk(geo, color, outline = 0.012, parent, opts = {}) {
  const m = new THREE.Mesh(geo, opts.mat || toon(color, opts.soft)); m.castShadow = true; m.receiveShadow = true;
  if (outline) m.add(new THREE.Mesh(geo, outlineMat(outline)));
  if (parent) parent.add(m); return m;
}
const G = {
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  sph: (r, sx = 1, sy = 1, sz = 1, seg = 24) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)).scale(sx, sy, sz),
  cap: (r, l, sx = 1, sz = 1) => new THREE.CapsuleGeometry(r, l, 6, 16).scale(sx, 1, sz),
  cyl: (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg),
};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// sky
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vDir; void main(){ float h = normalize(vDir).y;
    vec3 c = mix(vec3(0.80,0.92,1.0), vec3(0.36,0.66,0.98), smoothstep(0.0,0.2,h)); c = mix(c, vec3(0.10,0.40,0.92), smoothstep(0.2,0.8,h));
    gl_FragColor = vec4(c,1.0); }`, side: THREE.BackSide, depthWrite: false, fog: false,
}));
scene.add(sky);
const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x9ab8e8, emissiveIntensity: 0.5, gradientMap: gradTex([140, 230]), fog: false });
for (let i = 0; i < 6; i++) {
  const cg = new THREE.Group(); cg.position.set(-260 - R() * 60, 40 + R() * 50, -160 + i * 64 + R() * 20);
  for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(G.sph(8 + R() * 10, 1, 0.85, 1, 16), cloudMat); m.position.set((R() - 0.5) * 12, (R() - 0.2) * 8, (R() - 0.5) * 36); cg.add(m); }
  scene.add(cg);
}

// pitch with mowing stripes + lines
const pitchTex = canvasTex(2, 1, (c) => { c.fillStyle = '#7fd05a'; c.fillRect(0, 0, 1, 1); c.fillStyle = '#6cc04b'; c.fillRect(1, 0, 1, 1); });
pitchTex.magFilter = THREE.NearestFilter; pitchTex.wrapS = THREE.RepeatWrapping; pitchTex.repeat.set(30, 1);
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshToonMaterial({ map: pitchTex, gradientMap: GRAD_SOFT }));
pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
const lineMat = toon(0xffffff, true);
const circ = new THREE.Mesh(new THREE.RingGeometry(9.0, 9.15, 64), lineMat); circ.rotation.x = -Math.PI / 2; circ.position.set(-2, 0.01, 0); scene.add(circ);
const half = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 120), lineMat); half.rotation.x = -Math.PI / 2; half.position.set(-2, 0.01, 0); scene.add(half);

// stands with crowd behind
const crowd = [];
for (let i = 0; i < 7; i++) {
  mk(G.box(1.6, 0.8 * (i + 1), 120), i % 2 ? 0x9aa7bd : 0xb7c2d6, 0, scene).position.set(-38 - 1.6 * i, 0.4 * (i + 1), 0);
  for (let z = -40; z < 40; z += 0.75) if (R() > 0.12) crowd.push({ x: -38 - 1.6 * i + (R() - 0.5) * 0.3, y: 0.8 * (i + 1), z: z + (R() - 0.5) * 0.3, ph: R() * TAU2, sp: 5 + R() * 6 });
}
mk(G.box(0.4, 1.2, 120), 0x1f4fd1, 0, scene).position.set(-36.6, 0.6, 0);
const bodyIM = new THREE.InstancedMesh(G.cap(0.22, 0.3), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD }), crowd.length);
const headIM = new THREE.InstancedMesh(G.sph(0.17, 1, 1, 1, 10), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD }), crowd.length);
{ const shirts = [0xff5c5c, 0xffffff, 0x2a4bd6, 0xffffff, 0xe8282b, 0xffc23a], skins = [0xf5d0b0, 0xe8b48f, 0xc98e66, 0x9a6a48];
  crowd.forEach((c, i) => { bodyIM.setColorAt(i, new THREE.Color(shirts[Math.floor(R() * 6)])); headIM.setColorAt(i, new THREE.Color(skins[Math.floor(R() * 4)])); }); }
scene.add(bodyIM, headIM);
function updateCrowd(t, ex) {
  const m = new THREE.Matrix4();
  crowd.forEach((c, i) => { const b = Math.abs(Math.sin(t * c.sp + c.ph)) * 0.2 * ex;
    m.makeTranslation(c.x, c.y + 0.45 + b, c.z); bodyIM.setMatrixAt(i, m); m.makeTranslation(c.x, c.y + 1.0 + b, c.z); headIM.setMatrixAt(i, m); });
  bodyIM.instanceMatrix.needsUpdate = headIM.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- footballer (cartoon caricature)
const P = {};
{
  const SKIN = 0xf0c09a, KIT = 0xffffff, SHORTS = 0x1b2a6b, HAIR = 0xc9a25a, BOOT = 0x111111;
  const root = new THREE.Group(); scene.add(root); P.root = root;
  const hips = new THREE.Group(); hips.position.y = 0.97; root.add(hips); P.hips = hips;
  mk(G.sph(0.17, 1, 0.75, 1.2), SHORTS, 0.012, hips).position.y = 0.02;
  const torso = new THREE.Group(); torso.position.y = 0.04; hips.add(torso); P.torso = torso;
  mk(G.cap(0.17, 0.26, 0.85, 1.25), KIT, 0.012, torso).position.y = 0.27;
  // kit trim + number/crest
  const crest = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b2a6b'; c.font = '900 92px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', w / 2, h / 2 + 6); });
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshToonMaterial({ map: crest, gradientMap: GRAD_SOFT }));
  num.rotation.y = Math.PI / 2; num.position.set(0.152, 0.33, -0.08); torso.add(num);
  mk(new THREE.TorusGeometry(0.075, 0.016, 8, 24), 0x1b2a6b, 0, torso).rotation.x = Math.PI / 2;
  torso.children[torso.children.length - 1].position.y = 0.56;
  mk(G.cyl(0.06, 0.065, 0.12), SKIN, 0.01, torso).position.y = 0.58;
  const head = new THREE.Group(); head.position.y = 0.76; torso.add(head); P.head = head;
  mk(G.sph(0.155, 0.98, 1.08, 0.94, 32), SKIN, 0.012, head);
  mk(G.sph(0.11, 0.9, 0.55, 0.85, 20), 0xd9a882, 0, head).position.set(0.06, -0.09, 0); // jaw / stubble shade
  // faux-hawk: short sides, tall ridge on top
  mk(G.sph(0.158, 0.99, 0.75, 0.96, 24), HAIR, 0.01, head).position.set(-0.012, 0.045, 0);
  for (let i = 0; i < 6; i++) {
    const s = mk(G.cyl(0.0, 0.05, 0.13, 8), 0xd8b066, 0.008, head);
    s.position.set(0.11 - i * 0.045, 0.15 + Math.sin(i / 5 * Math.PI) * 0.03, 0); s.rotation.z = 0.5 - i * 0.12;
  }
  for (const z of [0.152, -0.152]) mk(G.sph(0.035, 0.7, 1.2, 0.6, 12), SKIN, 0.008, head).position.set(0.0, -0.01, z);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1210 }), iris = new THREE.MeshBasicMaterial({ color: 0x3f6fa8 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  P.eyes = [];
  for (const s of [1, -1]) {
    const eg = new THREE.Group(); eg.position.set(0.132, 0.015, s * 0.055); eg.rotation.y = -s * 0.35; head.add(eg);
    eg.add(new THREE.Mesh(G.sph(0.034, 0.35, 1.15, 1, 16), white));
    const ir = new THREE.Mesh(G.sph(0.026, 0.4, 1.2, 0.85, 16), iris); ir.position.set(0.006, -0.004, 0); eg.add(ir);
    const pu = new THREE.Mesh(G.sph(0.014, 0.4, 1.2, 0.85, 12), eyeMat); pu.position.set(0.011, -0.006, 0); eg.add(pu);
    const hl = new THREE.Mesh(G.sph(0.008, 0.4, 1, 1, 8), white); hl.position.set(0.016, 0.012, s * 0.007); eg.add(hl);
    const lid = new THREE.Mesh(G.box(0.012, 0.007, 0.068), eyeMat); lid.position.set(0.012, 0.04, 0); eg.add(lid);
    P.eyes.push(eg);
    const brow = mk(G.box(0.02, 0.016, 0.07), 0x8a6a3a, 0, head); brow.position.set(0.148, 0.07, s * 0.056); brow.rotation.x = s * 0.15;
    (s > 0 ? P : P).browL = s > 0 ? brow : P.browL; if (s < 0) P.browR = brow;
  }
  mk(G.sph(0.024, 1, 1, 1, 12), SKIN, 0.006, head).position.set(0.157, -0.02, 0);
  const mouth = new THREE.Mesh(G.sph(0.03, 0.35, 1, 1.6, 16), new THREE.MeshBasicMaterial({ color: 0x5a1a1a }));
  mouth.position.set(0.138, -0.075, 0); head.add(mouth); P.mouth = mouth;
  const teeth = new THREE.Mesh(G.box(0.01, 0.012, 0.05), white); teeth.position.set(0.012, 0.018, 0); mouth.add(teeth);
  // arms
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(0, 0.46, s * 0.22); torso.add(sh);
    mk(G.sph(0.075, 1, 1, 1, 14), KIT, 0.01, sh);
    mk(G.cyl(0.07, 0.06, 0.14), KIT, 0.01, sh).position.y = -0.06;
    mk(G.cap(0.048, 0.2), SKIN, 0.01, sh).position.y = -0.16;
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    mk(G.cap(0.044, 0.19), SKIN, 0.01, el).position.y = -0.13;
    const hand = new THREE.Group(); hand.position.y = -0.28; el.add(hand);
    mk(G.sph(0.055, 1, 1.05, 0.9, 14), SKIN, 0.01, hand);
    const thumb = mk(G.cap(0.018, 0.05), SKIN, 0.006, hand); thumb.position.set(0, 0.05, s * 0.0); thumb.visible = false;
    return { sh, el, hand, thumb };
  };
  P.aL = arm(1); P.aR = arm(-1);
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(0, -0.02, s * 0.1); hips.add(hp);
    mk(G.cyl(0.095, 0.088, 0.22), SHORTS, 0.01, hp).position.y = -0.1;
    mk(G.cap(0.066, 0.3), SKIN, 0.01, hp).position.y = -0.25;
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
    mk(G.cap(0.06, 0.3), 0xffffff, 0.01, kn).position.y = -0.2; // socks
    mk(G.cyl(0.064, 0.062, 0.04), 0x1b2a6b, 0, kn).position.y = -0.05;
    const an = new THREE.Group(); an.position.y = -0.43; kn.add(an);
    mk(G.box(0.27, 0.085, 0.11), BOOT, 0.01, an).position.set(0.06, -0.025, 0);
    mk(G.box(0.12, 0.02, 0.112), 0xffd23a, 0, an).position.set(0.03, -0.005, 0);
    return { hp, kn, an };
  };
  P.lL = leg(1); P.lR = leg(-1);
}
// ball
const ballTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#111';
  for (let i = 0; i < 10; i++) { const x = (i % 5) * 52 + (i > 4 ? 26 : 0) + 10, y = i > 4 ? 88 : 36; c.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU2 - Math.PI / 2; c.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } c.fill(); }
});
const ball = mk(new THREE.SphereGeometry(0.11, 24, 18), 0, 0.008, scene, { mat: new THREE.MeshToonMaterial({ map: ballTex, gradientMap: GRAD }) });

// root faces camera (+x points at camera)
P.root.rotation.y = -0.25;

function pose(t) {
  const talk = (t > 0.35 && t < 2.55) || (t > 2.75 && t < 4.3);
  // mouth flaps
  const flap = talk ? 0.25 + 0.75 * Math.abs(Math.sin(t * 17) * Math.sin(t * 7.3 + 1)) : 0.15;
  const grin = sstep(4.2, 4.5, t);
  P.mouth.scale.set(1, lerp(flap, 0.55, grin), lerp(1, 1.4, grin));
  // idle sway + gestures
  const sway = Math.sin(t * 2.2) * 0.04;
  P.torso.rotation.set(0.0, sway, -0.03);
  P.head.rotation.set(0.04 * Math.sin(t * 3.1), 0.08 * Math.sin(t * 1.7), 0.05 + (talk ? 0.04 * Math.sin(t * 6) : 0));
  // setup: question shrug (left arm open), punchline: points, then thumbs up
  const q = sstep(0.4, 0.8, t) * (1 - sstep(2.4, 2.8, t));
  const pl = sstep(2.8, 3.1, t) * (1 - sstep(3.9, 4.1, t));
  const up = sstep(4.0, 4.3, t);
  P.aL.sh.rotation.set(-0.15 - 0.55 * q, 0, 0.1 + 0.5 * q + 1.2 * pl);
  P.aL.el.rotation.z = 0.2 + 1.2 * q + 0.4 * pl;
  P.aR.sh.rotation.set(0.12 + 0.2 * q, 0, -0.05 + 0.6 * up);
  P.aR.el.rotation.z = 0.25 + 1.9 * up;
  P.aR.hand.rotation.z = 0;
  P.aR.thumb.visible = up > 0.5;
  // eyebrows raise on question
  P.browL.position.y = P.browR.position.y = 0.07 + 0.018 * q;
  // wink at the end
  const wink = sstep(4.25, 4.35, t) * (1 - sstep(4.8, 4.9, t));
  P.eyes[0].scale.y = 1 - 0.9 * wink;
  P.eyes[1].scale.y = (t % 2.1) < 0.1 ? 0.15 : 1;
  // keepy-uppy with left foot
  const kick = (t * 1.6) % 1, kk = Math.max(0, Math.sin(Math.min(kick / 0.25, 1) * Math.PI));
  P.lL.hp.rotation.set(-0.05, 0, 0.55 * kk); P.lL.kn.rotation.z = -0.5 * kk; P.lL.an.rotation.z = 0.2 * kk;
  P.lR.hp.rotation.set(0.05, 0, -0.03); P.lR.kn.rotation.z = -0.05;
  P.hips.position.y = 0.97 - 0.015 * kk;
  P.root.updateMatrixWorld(true);
  const foot = new THREE.Vector3(0.12, -0.02, 0); P.lL.an.localToWorld(foot);
  const bh = 0.62 * 4 * kick * (1 - kick);
  ball.position.set(foot.x, foot.y + 0.13 + bh, foot.z);
  ball.rotation.set(t * 3, 0, -t * 6);
}

// ---------------------------------------------------------------- overlay
function bubble(ctx, text, x, y, w, k, tailX, tailY) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); const s = 0.6 + 0.4 * Math.min(1, k * 1.2) + 0.06 * Math.sin(Math.min(k, 1) * Math.PI);
  ctx.scale(s, s); ctx.globalAlpha = Math.min(1, k * 2);
  const lines = text.split('\n'), lh = 50, h = lines.length * lh + 44;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b1030'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  const bx = clamp(tailX - x, -w / 2 + 70, w / 2 - 70), tx = (tailX - x) / s, ty = (tailY - y) / s;
  ctx.beginPath(); ctx.moveTo(bx - 22, h / 2 - 6); ctx.lineTo(tx, ty); ctx.lineTo(bx + 22, h / 2 - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 36); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx - 19, h / 2 - 8); ctx.lineTo(bx + 19, h / 2 - 8); ctx.lineWidth = 12; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#1b1030'; ctx.font = '800 38px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
  ctx.restore();
}
function popText(ctx, txt, x, y, size, k, rot) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const s = k < 0.3 ? lerp(0.3, 1.2, k / 0.3) : lerp(1.2, 1, Math.min(1, (k - 0.3) / 0.2)); ctx.scale(s, s);
  ctx.font = `900 ${size}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.32; ctx.strokeStyle = '#fff'; ctx.strokeText(txt, 0, 0);
  ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#1b1030'; ctx.strokeText(txt, 0, 0);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff35c'); g.addColorStop(1, '#ff7a1a'); ctx.fillStyle = g; ctx.fillText(txt, 0, 0);
  ctx.restore();
}
function overlay(ctx, t, f) {
  const hp = new THREE.Vector3(0.14, -0.06, 0); P.head.localToWorld(hp); hp.project(camera);
  const mx = (hp.x * 0.5 + 0.5) * W, my = (-hp.y * 0.5 + 0.5) * H;
  bubble(ctx, 'Why did the football\nquit the team?', 380, 150, 520, (t - 0.35) / 0.25 * (t < 2.6 ? 1 : 0), mx - 40, my);
  bubble(ctx, "It was tired of being\nkicked around!", 380, 150, 540, (t - 2.75) / 0.25 * (t < 4.85 ? 1 : 0), mx - 40, my);
  if (t > 4.2) {
    const k = (t - 4.2) / 0.6;
    const r = rng(f * 7);
    ctx.save(); for (let i = 0; i < 40; i++) { const a = r() * TAU2, r0 = 300 + r() * 200; ctx.fillStyle = 'rgba(255,240,140,0.5)'; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a - 0.01) * 1400, H / 2 + Math.sin(a - 0.01) * 1400); ctx.lineTo(W / 2 + Math.cos(a + 0.01) * 1400, H / 2 + Math.sin(a + 0.01) * 1400); ctx.fill(); } ctx.restore();
    popText(ctx, 'BA-DUM TSS!', 360, 560, 70, k, -0.08);
  }
  if (t > 4.3) {
    const p = new THREE.Vector3(0.0, 0.02, 0.02); P.eyes[0].localToWorld(p); p.project(camera);
    const a = Math.sin(Math.PI * clamp((t - 4.3) / 0.5, 0, 1));
    ctx.save(); ctx.translate((p.x * 0.5 + 0.5) * W + 20, (-p.y * 0.5 + 0.5) * H - 10); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.shadowColor = '#ffe'; ctx.shadowBlur = 16;
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? 5 : 26, an = i / 8 * TAU2; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); ctx.restore();
  }
  // parody tag
  ctx.save(); ctx.fillStyle = 'rgba(27,16,48,0.75)'; ctx.beginPath(); ctx.roundRect(W - 200, 24, 176, 40, 10); ctx.fill();
  ctx.fillStyle = '#ffd23a'; ctx.font = '800 18px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★ CARTOON PARODY', W - 112, 45); ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(20,10,40,0)'); vg.addColorStop(1, 'rgba(20,10,40,0.25)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (t < 0.25) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; ctx.fillRect(0, 0, W, H); }
  if (t > 4.75) { ctx.fillStyle = `rgba(0,0,0,${(t - 4.75) / 0.25})`; ctx.fillRect(0, 0, W, H); }
}

window.renderFrame = function (f) {
  const t = f / FPS;
  pose(t);
  updateCrowd(t, t > 4.2 ? 1 : 0.3);
  // slow push-in, small punch-in on the punchline
  const push = sstep(0, 4.2, t) * 0.5 + sstep(4.15, 4.3, t) * 0.5;
  camera.position.set(4.8 - push, 1.5, -0.2 + push * 0.1);
  camera.fov = 36 - sstep(4.15, 4.3, t) * 5; camera.updateProjectionMatrix();
  camera.lookAt(0, 1.3, 0.75);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
  octx.drawImage(renderer.domElement, 0, 0);
  overlay(octx, t, f);
  return out.toDataURL('image/jpeg', 0.93);
};
window.READY = true;
