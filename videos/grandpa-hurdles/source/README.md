# Grandpa Hurdles! (おじいちゃん、跳ぶ！)

2-minute cel-shaded 3D anime short: an 82-year-old runs a sunny-day hurdle race.

- `scene.js` — Three.js scene, character rig, cameras, and 2D anime FX
- `render.js` — renders frames in headless Chromium and pipes them to ffmpeg
- `events.js` + `music.py` — export jump timings and synthesize the soundtrack

Rebuild: `npm i three@0.160.0 playwright`, then `node render.js range 0 2880 out.mp4`,
`node events.js && python3 music.py`, and mux `out.mp4` with `music.wav`.
