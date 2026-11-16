"use strict";
/* ===== FILM =====
   A short scripted "video" for level 0. It plays a real, hidden game (F) on the same engine: the camera
   glides between shots, the builds happen on screen, the mills turn and the lake runs dry, with a caption
   under each shot. The player's own game (G) is parked while it runs and restored afterwards.
   Nothing here is saved, and the film game has no letters, steps or goals. */
let FILM=null;

// One scene = camera target [cell x, cell y, cells visible across], a caption, how fast time runs (ticks per second), and what gets built.
function filmScenes(g, kind){
  const at=(x,y)=>cellXY(g,x,y), tool=(id,cells)=>{ for (const i of cells) applyTool(id,i); };
  const col=(x,y0,y1)=>{ const a=[]; for (let y=y0;y<=y1;y++) a.push(at(x,y)); return a; };
  const row=(y,x0,x1)=>{ const a=[]; for (let x=x0;x<=x1;x++) a.push(at(x,y)); return a; };
  if (kind && kind!=='leren'){   // a new pump type: zoom onto it, show what it needs, show it working
    const I=TOOLINFO[kind];
    return [
      {dur:5.5, cam:[10,27.5,8], run:0, t:I.title, s:I.text+' Lifts up to '+I.lift+'.', act(){ tool('dike', col(10,27,28)); tool(I.pump, col(10,27,28)); }},
      {dur:5.5, cam:[13,17,18], run:0, t:'What it needs', s:I.need, act(){ tool('road', col(10,8,26)); tool('road', row(8,11,22)); }},
      {dur:6, cam:[13,27.5,10], run:60, t:'Water at its feet', s:'Dig a canal to the pump and it works day and night. Cost: '+I.cost+'.', act(){ for (const y of [27,28]) tool('canal', row(y,11,20)); }, last:true}
    ];
  }
  return [
    {dur:5, cam:[16,25,26], run:0, t:'This is a lake', s:'But here it should be farmland. Your goal: make it dry land.'},
    {dur:4, cam:[10,27.5,11], run:0, t:'1 · Dike', s:'Close the gap, so the water cannot come back.', act(){ tool('dike', col(10,27,28)); }},
    {dur:5.5, cam:[10,27.5,5], run:50, t:'2 · Mill', s:'The wind turns the sails and lifts water over the dike.', act(){ tool('mill', col(10,27,28)); }},
    {dur:4.5, cam:[15.5,27.5,13], run:40, t:'3 · Canals', s:'They carry the water to the mill.', act(){ for (const y of [27,28]) tool('canal', row(y,11,20)); }},
    {dur:6, cam:[16,25,24], run:260, t:'4 · Wait', s:'Speed up time. The lake slowly falls dry.', act(){ tool('canal', col(16,21,33)); }},
    {dur:5.5, cam:[19.5,16,15], run:130, t:'5 · Farm', s:'Dry land grows crops. A road takes them to town.', act(){
      if (applyTool('farm', at(17,20))){ tool('road', col(17,8,19)); tool('road', row(8,18,22)); } }},
    {dur:6, cam:[16,22,30], run:130, t:'Now you try', s:'Drain 90% of the lake, then build a farm on the new land.', last:true}
  ];
}
// camera targets are in canonical map coordinates (see cellXY); mirror them like the map
function filmCam(c){ const f=G.sc.flip||[0,0]; return {cs:cw/c[2], cx:f[0]?G.C-1-c[0]:c[0], cy:f[1]?G.R-1-c[1]:c[1]}; }
function filmApply(c){ view.cs=c.cs; view.ox=cw/2-(c.cx+.5)*c.cs; view.oy=ch/2-(c.cy+.5)*c.cs; }
const ease=(t)=>t<=0?0:t>=1?1:t*t*(3-2*t);

function filmAllowed(){ return !navigator.webdriver || window.PEIL_FILM; }   // automated tests skip the film unless they ask for it
function playFilm(sc, done, kind){
  if (FILM) return;
  const demo=kind && kind!=='leren', base=demo ? SCENARIOS.find(s=>s.id==='leren') : sc;
  const real=G, F=generate(Object.assign({}, base, {letters:[], steps:[], goals:{dry:9}, tutorial:false}, demo?{money:90000, tools:['look','dike','canal','road','mill','steam','electric','sluice','farm','house','remove']}:{}));
  G=F; setWeather(0); rebuild(); pops.length=0; floaters.length=0; sprites.length=0;
  const scenes=filmScenes(F, kind), total=scenes.reduce((a,s)=>a+s.dur,0);
  FILM={real, F, scenes, n:-1, t:0, tAll:0, total, acc:0, prev:null, done:done||(()=>{}), cam:null};
  document.documentElement.classList.add('film'); $('film').classList.remove('hide');
  const w=filmCam(scenes[0].cam); view.fit=Math.min(cw/F.C, ch/F.R); filmApply(w); FILM.prev=w;
  markDirty(); filmScene(0);
}
function filmScene(n){
  const f=FILM, s=f.scenes[n]; f.n=n; f.t=0; f.acc=0;
  const cap=$('filmCap'); cap.classList.remove('in'); void cap.offsetWidth;
  $('filmT').textContent=s.t; $('filmS').textContent=dtext(s.s); cap.classList.add('in');
  if (s.act) s.act();
  if (n>0){ sfx('place'); haptic(); }
  markDirty();
}
function filmFrame(dt){
  const f=FILM; dt=Math.min(dt,0.1);
  f.t+=dt; f.tAll+=dt;
  let s=f.scenes[f.n];
  if (f.t>=s.dur){ if (s.last){ endFilm(); return; } f.prev=f.cur; filmScene(f.n+1); s=f.scenes[f.n]; }
  // camera: glide to this scene's target over 1.6 s (zoom in log space, so it feels even), then hold with a very slow drift
  const to=filmCam(s.cam), k=ease(f.t/1.6), a=f.prev;
  const cur={cs:Math.exp(Math.log(a.cs)+(Math.log(to.cs)-Math.log(a.cs))*k), cx:a.cx+(to.cx-a.cx)*k, cy:a.cy+(to.cy-a.cy)*k};
  if (k>=1){ const dr=(f.t-1.6)*0.05; cur.cx+=dr; }
  filmApply(cur); f.cur=cur;
  // time runs
  if (s.run>0){ f.acc+=dt*s.run; let n=0; while (f.acc>=1 && n<90){ tick(); f.acc-=1; n++; } if (n){ baseStale=true; frameDirty=true; } }
  $('filmProg').firstElementChild.style.width=(f.tAll/f.total*100)+'%';
  requestRender();
}
function endFilm(){
  const f=FILM; if (!f) return; FILM=null;
  document.documentElement.classList.remove('film'); $('film').classList.add('hide');
  G=f.real; setWeather(G.tick); rebuild(); pops.length=0; floaters.length=0; sprites.length=0;
  cw=0; resize(); homeView(); markDirty(); updateHud();
  f.done();
}
$('filmSkip').onclick=()=>{ if (FILM) endFilm(); };
window.addEventListener('keydown', e=>{ if (FILM && (e.key==='Escape' || e.key==='Enter' || e.key===' ')){ e.preventDefault(); endFilm(); } }, true);
