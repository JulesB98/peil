"use strict";
/* ===== SOUND & HAPTICS =====
   Everything is synthesised with Web Audio, so there are no sound files to download or cache.
   The AudioContext is created on the first touch (iOS requires a user gesture). */
let AC=null, master=null, noiseBuf=null, amb=null; const sfxLast={};

function initAudio(){
  if (AC || !SET.sound) { if (AC && AC.state==='suspended') AC.resume(); return; }
  const Ctx=window.AudioContext||window.webkitAudioContext; if (!Ctx) return;
  try {
    AC=new Ctx(); master=AC.createGain(); master.gain.value=0.5; master.connect(AC.destination);
    noiseBuf=AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate); const d=noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    // ambience: one looping noise source through three filters (water, wind, rain)
    const src=AC.createBufferSource(); src.buffer=noiseBuf; src.loop=true;
    const mk=(type,f,q)=>{ const fl=AC.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const gn=AC.createGain(); gn.gain.value=0; src.connect(fl); fl.connect(gn); gn.connect(master); return {fl, gn}; };
    amb={ water:mk('bandpass',520,0.6), wind:mk('lowpass',300,0.4), rain:mk('highpass',3800,0.3) };
    src.start();
  } catch(e){ AC=null; }
}
function setSound(on){ SET.sound=on; saveSettings(); if (on) initAudio(); else if (AC){ AC.close(); AC=null; amb=null; } }

// Called a few times a second: ambience follows the weather and the pumps.
function audioFrame(){
  if (!AC || !amb || !G) return; const t=AC.currentTime, run=speed>0 && !document.hidden ? 1 : 0.25;
  let flow=0; for (const p of G.pumps) flow+=G.pumpFlow[p];
  const set=(n,v)=>n.gn.gain.setTargetAtTime(v, t, 0.6);
  set(amb.water, run*Math.min(0.05, 0.012+flow*0.02));
  set(amb.wind, run*(0.01+0.05*Math.pow(G.wind||0,2)+0.1*(G.stormEnv||0)));
  amb.wind.fl.frequency.setTargetAtTime(220+500*(G.wind||0), t, 1.5);
  set(amb.rain, run*Math.min(0.06, (G.rain||0)*40));
}

function tone(type, f0, f1, dur, vol, when){
  const t=AC.currentTime+(when||0), o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t); if (f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol, t+0.008); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.02);
}
function noise(type, f0, f1, dur, vol, when){
  const t=AC.currentTime+(when||0), s=AC.createBufferSource(), fl=AC.createBiquadFilter(), g=AC.createGain();
  s.buffer=noiseBuf; s.loop=true; fl.type=type; fl.frequency.setValueAtTime(f0,t); if (f1!==f0) fl.frequency.exponentialRampToValueAtTime(f1, t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol, t+0.01); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t+dur+0.02);
}
const SFX = {
  tap:   ()=>tone('sine', 620, 620, 0.05, 0.08),
  dike:  ()=>{ noise('lowpass', 500, 180, 0.14, 0.35); tone('sine', 110, 62, 0.16, 0.3); },
  canal: ()=>{ noise('bandpass', 900, 500, 0.1, 0.3); tone('sine', 700, 1300, 0.07, 0.07, 0.06); },
  road:  ()=>noise('highpass', 2500, 1500, 0.09, 0.18),
  place: ()=>{ tone('triangle', 240, 200, 0.06, 0.25); tone('triangle', 320, 260, 0.07, 0.22, 0.09); },
  remove:()=>noise('bandpass', 1400, 300, 0.16, 0.22),
  error: ()=>{ tone('triangle', 190, 170, 0.09, 0.16); tone('triangle', 150, 140, 0.12, 0.16, 0.1); },
  undo:  ()=>tone('sine', 520, 330, 0.12, 0.1),
  coin:  ()=>{ tone('triangle', 1320, 1320, 0.07, 0.05); tone('triangle', 1760, 1760, 0.1, 0.05, 0.06); },
  letter:()=>{ tone('sine', 880, 880, 0.5, 0.09); tone('sine', 1320, 1320, 0.6, 0.06, 0.12); },
  step:  ()=>{ tone('sine', 660, 660, 0.12, 0.09); tone('sine', 990, 990, 0.2, 0.09, 0.1); },
  breach:()=>{ noise('lowpass', 900, 90, 1.1, 0.5); tone('sine', 70, 40, 0.9, 0.3); },
  win:   ()=>[523,659,784,1047].forEach((f,k)=>tone('triangle', f, f, 0.45, 0.12, k*0.13)),
  lose:  ()=>[392,330,262].forEach((f,k)=>tone('triangle', f, f, 0.5, 0.11, k*0.2))
};
const SFX_GAP = {coin:400, letter:600, breach:1500, error:250};
function sfx(name){
  if (!SET.sound || !AC || AC.state!=='running') return;
  const now=performance.now(), gap=SFX_GAP[name]||40; if (now-(sfxLast[name]||0)<gap) return; sfxLast[name]=now;
  try { SFX[name](); } catch(e){}
}

/* Haptics. Android has navigator.vibrate. iOS Safari does not, but since iOS 17.4 toggling a
   <input type="checkbox" switch> gives a system tick, and clicking its label from a touch handler triggers it. */
let hapticLabel=null;
function haptic(kind){
  if (!SET.haptics) return;
  try {
    if (navigator.vibrate){ navigator.vibrate(kind==='error' ? [12,60,12] : kind==='heavy' ? 18 : 8); return; }
    if (!hapticLabel){ hapticLabel=document.createElement('label'); hapticLabel.setAttribute('aria-hidden','true'); hapticLabel.style.cssText='position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:0;pointer-events:none';
      const inp=document.createElement('input'); inp.type='checkbox'; inp.setAttribute('switch',''); inp.tabIndex=-1; hapticLabel.appendChild(inp); document.body.appendChild(hapticLabel); }
    hapticLabel.click(); if (kind==='error') setTimeout(()=>hapticLabel.click(), 90);
  } catch(e){}
}
