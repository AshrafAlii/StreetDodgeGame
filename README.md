# 🚗 Street Dodge

A fast-paced 3D endless dodger built with **Vite** and **Three.js**. Drive your car down an infinite road, weave between blocks, collect coins to charge your boost, and grab score pads — survive as long as you can.

🔗 **Live demo:** https://streetdodge.netlify.app/

---

## ✨ Features

- **Smooth 3D driving** with a realtime physics-lite camera that leans into turns
- **Obstacle avoidance** — steer left/right to dodge falling blocks
- **Coin collection** — grab coins to fill your boost bar and earn score multiplier time
- **Score pads** — drive over pads for big bonus points + boost refill
- **Boost mechanic** — hold Shift/Space/B (or the on-screen button) to speed up; drains your boost bar
- **Progressive difficulty** — speed increases the longer you survive
- **Mobile-friendly** — tap left/right of screen to steer, on-screen boost button
- **High score saved** locally in `localStorage`
- Zero-config dev server via Vite; tiny dependency footprint (`three` only)

---

## 🎮 Controls

| Input | Action |
|-------|--------|
| `←` / `A` | Steer left |
| `→` / `D` | Steer right |
| `Shift` / `Space` / `B` | Activate boost (hold) |
| `Enter` | Start / Retry |
| **Touch** | Tap left half of screen to steer left, tap right half to steer right |
| **Touch boost** | Press the on-screen **Boost** button |

---

## 🛠️ Tech stack

- **Three.js** `^0.160.0` — 3D rendering
- **Vite** `^5.4.0` — dev server & bundler
- Plain JavaScript (ES modules) — no frameworks

---

## 🚀 Getting started

### Install dependencies

```bash
npm install
```

### Run the dev server

```bash
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
```

Output goes to `dist/`. You can preview it locally with:

```bash
npm run preview
```

---

## 📁 Project structure

```
street-dodge/
├── index.html          # Entry HTML with HUD & overlay UI
├── vite.config.js      # Vite config (base: './')
├── package.json        # Scripts & dependencies
├── package-lock.json
├── .gitignore
├── public/
│   └── models/         # GLTF assets loaded at runtime
│       ├── car.glb     # Player car
│       ├── square.glb  # Obstacle template
│       ├── rect.glb    # Obstacle template
│       └── output.glb  # Score-pad template
└── src/
    └── main.js         # All game logic (rendering, input, spawning, collisions)
```

---

## 🧠 How it works

`src/main.js` is a single-file game loop (~200 lines):

1. **Scene setup** — `PerspectiveCamera`, `WebGLRenderer`, ground, road, lane dashes, hemisphere + directional lights.
2. **Model loading** — `GLTFLoader` loads the four `.glb` assets; each is normalized (centered, scaled, sitting on y=0) via the `prepare()` helper.
3. **Spawning** — blocks (obstacles), coin lines, and score pads spawn ahead of the car at random x-positions; spawn rate increases as speed rises.
4. **Input** — keyboard (`ArrowKeys`/`WASD`) and pointer/touch; a screen-space boost button.
5. **Update** — each frame the car clamps to the road limits, items scroll toward the player, AABB-ish collision checks trigger:
   - **block** → game over
   - **coin** → +1 coin, boost fill
   - **pad** → +100 bonus points, boost fill
6. **Rendering** — camera follows with easing, FOV widens during boost for a speed feel.

---

## 📜 License

This project is open source and free to use.

---

### Quick commands

```bash
# install
npm install

# dev server (hot reload)
npm run dev

# production build
npm run build

# preview production build
npm run preview
```
