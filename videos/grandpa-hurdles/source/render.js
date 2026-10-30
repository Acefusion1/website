// usage: node render.js stills t1,t2,...   |   node render.js range <f0> <f1> <out.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => console.log('PAGE', m.text()));
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.READY, null, { timeout: 120000 });
  const mode = process.argv[2];
  if (mode === 'stills') {
    console.log(JSON.stringify(await page.evaluate(() => window.INFO)));
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const ts of process.argv[3].split(',')) {
      const f = Math.round(parseFloat(ts) * 24);
      const t0 = Date.now();
      const d = await page.evaluate(f => renderFrame(f), f);
      fs.writeFileSync(path.join(__dirname, 'stills', `t${ts}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
      console.log('frame', f, Date.now() - t0, 'ms');
    }
  } else {
    const f0 = +process.argv[3], f1 = +process.argv[4], outp = process.argv[5];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '24', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', outp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      const d = await page.evaluate(f => renderFrame(f), f);
      const buf = Buffer.from(d.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 120 === 0) console.log(outp, f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
