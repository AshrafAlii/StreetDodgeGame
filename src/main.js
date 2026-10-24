import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---- tweakables ----
const CAR_YAW = Math.PI;      // set to 0 if the car looks like it drives backwards
const ROAD_W = 14;
const LIMIT = ROAD_W / 2 - 1.2;
const START_SPEED = 18, MAX_SPEED = 48;

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1f3a);
scene.fog = new THREE.Fog(0x1b1f3a, 40, 130);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 5.5, 10);

scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x2a2a2a, 1.6));
const sun = new THREE.DirectionalLight(0xffe2b0, 2);
sun.position.set(10, 20, 10);
scene.add(sun);

// ground + road + lane dashes
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2d3b2d }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 400), new THREE.MeshStandardMaterial({ color: 0x2b2b2f }));
road.rotation.x = -Math.PI / 2; scene.add(road);
const dashes = [];
for (let i = 0; i < 20; i++) {
  const d = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  d.rotation.x = -Math.PI / 2; d.position.set(0, 0.01, -i * 8 + 10); scene.add(d); dashes.push(d);
}
for (const s of [-1, 1]) {
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 400), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
  edge.rotation.x = -Math.PI / 2; edge.position.set(s * (ROAD_W / 2 - 0.3), 0.01, 0); scene.add(edge);
}

// ---- model loading ----
const loader = new GLTFLoader();
const load = (url) => loader.loadAsync(url).then((g) => g.scene);

// Normalise a generated model: uniform scale to `size`, centred on x/z, sitting on y=0.
function prepare(root, size) {
  root.traverse((o) => { if (o.isMesh) o.geometry.computeVertexNormals(); });
  const box = new THREE.Box3().setFromObject(root);
  const dim = box.getSize(new THREE.Vector3());
  const k = size / Math.max(dim.x, dim.y, dim.z);
  const c = box.getCenter(new THREE.Vector3());
  root.scale.setScalar(k);
  root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  const wrap = new THREE.Group(); wrap.add(root);
  const half = dim.clone().multiplyScalar(k / 2);
  return { wrap, hx: half.x, hz: half.z };
}

let carObj, templates = {};
async function init() {
  const [car, square, rect, pad] = await Promise.all([
    load('models/car.glb'), load('models/square.glb'), load('models/rect.glb'), load('models/output.glb'),
  ]);
  const c = prepare(car, 4.2); // car: length ~4.2
  const holder = new THREE.Group(); c.wrap.rotation.y = CAR_YAW; holder.add(c.wrap);
  carObj = { group: holder, hx: 0.9, hz: 1.8, body: c.wrap };
  scene.add(holder);

  templates.block = [prepare(square, 3.2), prepare(rect, 3.8)];
  const p = prepare(pad, 3.2); p.wrap.children[0].rotation.x = -Math.PI / 2; // lay the slab flat
  templates.pad = p;
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 0.18, 28),
    new THREE.MeshStandardMaterial({ color: 0xffc800, metalness: 0.7, roughness: 0.3, emissive: 0x553300 })
  );
  coin.rotation.x = Math.PI / 2; coin.position.y = 1.1; // stand the coin up, facing the camera
  const cg = new THREE.Group(); cg.add(coin);
  templates.coin = { wrap: cg, hx: 0.8, hz: 0.8 };
  document.getElementById('go').disabled = false;
}

// ---- game state ----
const BOOST_MULT = 1.7, BOOST_DRAIN = 35, COIN_FILL = 8, PAD_FILL = 15;
let state = 'ready', speed, dist, bonus, vx, spawnT, items = [];
let coins = 0, boost = 0, mul = 1, boostHeld = false;
let best = +localStorage.getItem('streetDodgeBest') || 0;
const $ = (id) => document.getElementById(id);
$('best').textContent = best ? `Best ${best}` : '';
$('go').disabled = true;

// input
const keys = {};
addEventListener('keydown', (e) => (keys[e.code] = true));
addEventListener('keyup', (e) => (keys[e.code] = false));
let touchDir = 0;
addEventListener('pointerdown', (e) => { touchDir = e.clientX < innerWidth / 2 ? -1 : 1; });
addEventListener('pointerup', () => (touchDir = 0));
// on-screen boost button (stopPropagation so it doesn't also steer)
const bb = $('boostBtn');
bb.addEventListener('pointerdown', (e) => { e.stopPropagation(); boostHeld = true; });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) bb.addEventListener(ev, () => (boostHeld = false));

function start() {
  items.forEach((i) => scene.remove(i.obj)); items = [];
  speed = START_SPEED; dist = 0; bonus = 0; vx = 0; spawnT = 0;
  coins = 0; boost = 0; mul = 1;
  carObj.group.position.set(0, 0, 0);
  $('coins').textContent = '🪙 0';
  state = 'play'; $('overlay').classList.add('hidden');
}
$('go').onclick = start;
addEventListener('keydown', (e) => { if (e.code === 'Enter' && state !== 'play' && !$('go').disabled) start(); });

function end() {
  state = 'over';
  const score = Math.floor(dist + bonus);
  if (score > best) { best = score; localStorage.setItem('streetDodgeBest', best); }
  $('best').textContent = `Best ${best}`;
  $('title').textContent = 'CRASHED';
  $('msg').innerHTML = `Score <b>${score}</b> · Coins <b>${coins}</b> · Best <b>${best}</b>`;
  $('go').textContent = 'Retry';
  $('overlay').classList.remove('hidden');
}

function addItem(kind, t, x, z) {
  const obj = t.wrap.clone();
  obj.position.set(x, 0, z);
  if (kind === 'block') obj.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
  const swapped = kind === 'block' && Math.abs(Math.sin(obj.rotation.y)) > 0.5;
  scene.add(obj);
  items.push({ obj, kind, hx: swapped ? t.hz : t.hx, hz: swapped ? t.hx : t.hz });
}
function spawn() {
  const r = Math.random(), x = (Math.random() * 2 - 1) * LIMIT;
  if (r < 0.15) addItem('pad', templates.pad, x, -140);
  else if (r < 0.55) for (let k = 0; k < 4; k++) addItem('coin', templates.coin, x, -140 - k * 4); // coin line
  else addItem('block', templates.block[Math.random() < 0.5 ? 0 : 1], x, -140);
}

// ---- loop ----
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (carObj && state === 'play') {
    const dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) || touchDir;
    vx += (dir * 16 - vx) * Math.min(1, dt * 8);
    const g = carObj.group;
    g.position.x = THREE.MathUtils.clamp(g.position.x + vx * dt, -LIMIT, LIMIT);
    carObj.body.rotation.y = CAR_YAW - vx * 0.03;
    carObj.body.rotation.z = -vx * 0.01;

    // boost: hold Shift / Space / B (or the on-screen button); drains the bar
    const wantBoost = boostHeld || keys.ShiftLeft || keys.ShiftRight || keys.Space || keys.KeyB;
    const boosting = wantBoost && boost > 0;
    if (boosting) boost = Math.max(0, boost - BOOST_DRAIN * dt);
    mul += ((boosting ? BOOST_MULT : 1) - mul) * Math.min(1, dt * 6);
    carObj.body.position.y = Math.sin(t * (boosting ? 55 : 30)) * (boosting ? 0.03 : 0.015);
    camera.fov += ((boosting ? 78 : 60) - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();

    speed = Math.min(MAX_SPEED, speed + dt * 0.5);
    const v = speed * mul;
    dist += v * dt * 0.5;
    spawnT -= dt * mul;
    if (spawnT <= 0) { spawn(); spawnT = Math.max(0.28, 0.95 - (speed - START_SPEED) * 0.018); }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; it.obj.position.z += v * dt;
      if (it.kind !== 'block') it.obj.rotation.y += dt * (it.kind === 'coin' ? 4 : 2);
      const dx = Math.abs(it.obj.position.x - g.position.x), dz = Math.abs(it.obj.position.z);
      if (dx < (it.hx + carObj.hx) * 0.8 && dz < (it.hz + carObj.hz) * 0.8) {
        if (it.kind === 'block') { end(); break; }
        if (it.kind === 'coin') { coins++; boost = Math.min(100, boost + COIN_FILL); $('coins').textContent = '🪙 ' + coins; }
        else { bonus += 100; boost = Math.min(100, boost + PAD_FILL); }
        scene.remove(it.obj); items.splice(i, 1); continue;
      }
      if (it.obj.position.z > 20) { scene.remove(it.obj); items.splice(i, 1); }
    }
    for (const d of dashes) { d.position.z += v * dt; if (d.position.z > 12) d.position.z -= 160; }

    $('score').textContent = Math.floor(dist + bonus);
    $('boostFill').style.width = boost + '%';
    $('boostBar').classList.toggle('on', boosting);
    $('boostBar').classList.toggle('full', boost >= 99.9);
    bb.classList.toggle('on', boosting);
    camera.position.x += (g.position.x * 0.5 - camera.position.x) * dt * 4;
    camera.lookAt(g.position.x * 0.7, 1, -12);
  } else if (carObj) {
    camera.lookAt(0, 1, -12);
  }
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

init().then(tick).catch((e) => { console.error(e); $('msg').textContent = 'Failed to load models: ' + e.message; });
