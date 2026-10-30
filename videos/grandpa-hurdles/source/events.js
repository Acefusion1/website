const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
await p.goto('file://'+path.join(__dirname,'index.html'));await p.waitForFunction(()=>window.READY);
const r=await p.evaluate(()=>{const tOf=tau=>{for(let f=1;f<NF;f++)if(sim[f].tau>=tau)return sim[f].t;return 999};
 return {jumps:events.filter(e=>e.n===4).map(e=>tOf(e.tau)),lands:events.filter(e=>e.n===7).map(e=>tOf(e.tau)),
 finish:sim.find(s=>s.x>xF).t, slow:SHOTS.filter(s=>s.slow).map(s=>[s.t0,s.t1])}});
require('fs').writeFileSync('events.json',JSON.stringify(r));console.log(JSON.stringify(r).slice(0,300));await b.close();})();
