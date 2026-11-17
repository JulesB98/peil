"use strict";
/* ===== SAVE / MENU / MODALS =====
   Save format, localStorage key peil_save_<scenario id>:
   v1 (no "v" field): the original handoff build. Lacks stock, given and carts.
   v2: adds v, stock, given, carts ([cell, value, progress] per grain cart).
   mapV: the map layouts. Saves from older layouts (mapV missing or lower) no longer fit the map and are ignored.
   load() upgrades older saves in memory; the next save() writes them back as the current version. */
function save(){
  if (!G) return; const o={v:SAVE_V, mapV:MAP_V, sc:G.sc.id}; if (G.sc.rnd){ o.rseed=G.sc.rnd; o.rdiff=G.sc.diff||0; }
  for (const k of ARR_KEYS) o[k]=Array.from(G[k], v=>Math.round(v*10000)/10000);
  for (const k of ['tick','money','boezem','stats','done','stormFlags','won','lost','stormsPassed','houses0','townIdx','log','flags','step','unread','V0']) o[k]=G[k];
  o.carts=G.carts.map(c=>[c.i, Math.round(c.v*100)/100, Math.round(c.p*100)/100]);
  o.boats=G.boats.map(b=>[b.i, Math.round(b.v*100)/100, Math.round(b.p*100)/100, b.w]);
  if (!lsSet('peil_save_'+G.sc.id, o) && !save.warned){ save.warned=true; letter('Your phone would not store the save. Progress may be lost when you close the game.', true, 'Peil'); }
  lsSet('peil_last', G.sc.id);
}
function load(id){
  const o=lsGet('peil_save_'+id); if (id==='random' && o && o.rseed) setRandom(o.rseed, o.rdiff||0); const sc=SCENARIOS.find(s=>s.id===id); if (!o || !sc) return null;
  if ((o.v||1)>SAVE_V) return null;                      // written by a newer version of the game
  if ((o.mapV||1)!==MAP_V) return null;                  // made on an older map layout
  const g=newGame(sc);
  for (const k of ARR_KEYS){ if (!o[k]){ if (k==='pin'||k==='pout'||k==='stock'||k==='given') continue; return null; } if (o[k].length!==g.N) return null; g[k].set(o[k]); }
  if (typeof o.money!=='number' || typeof o.boezem!=='number' || !(o.townIdx>=0)) return null;
  g.tick=o.tick||0; g.money=o.money; g.boezem=o.boezem; g.townIdx=o.townIdx; g.houses0=o.houses0||0; g.V0=o.V0||0; g.step=o.step||0; g.unread=o.unread||0;
  g.stormsPassed=o.stormsPassed||0; g.won=!!o.won; g.lost=!!o.lost;
  g.stats=o.stats||{breaches:0,housesLost:0}; g.done=o.done||{}; g.stormFlags=o.stormFlags||{}; g.flags=o.flags||{}; g.log=o.log||[];
  g.carts=(o.carts||[]).filter(c=>c[0]>=0 && c[0]<g.N).map(c=>({k:'g', i:c[0], v:c[1], p:c[2]||0, w:0}));
  g.boats=(o.boats||[]).filter(b=>b[0]>=0 && b[0]<g.N).map(b=>({i:b[0], v:b[1], p:b[2]||0, w:b[3]||0}));
  return g;
}
// The very first launch skips the menu and opens the tutorial.
function firstRun(){ return !lsGet('peil_last') && !starsFor('leren') && !hasSave('leren'); }
function hasSave(id){ const o=lsGet('peil_save_'+id); return !!o && (o.mapV||1)===MAP_V; }
function starsFor(id){ return (lsGet('peil_stars')||{})[id]||0; }
function starHtml(n){ return '★'.repeat(n)+'<i>'+'☆'.repeat(3-n)+'</i>'; }   // stars not yet earned are outlines, not just paler

function showMenu(){
  if (G){ save(); }
  setSpeed(0); $('menu').classList.remove('hide');
  const list=$('scList'); list.innerHTML='';
  const last=lsGet('peil_last');
  if (last && hasSave(last)){ const sc=SCENARIOS.find(s=>s.id===last); if (sc){ const b=document.createElement('button'); b.className='sc cont'; b.innerHTML=`<div class="n">${svg('play')}</div><div class="t"><b>Continue</b><span>${sc.id==='random'?'Random map #'+sc.rnd:sc.name}</span></div>`; b.onclick=()=>{ initAudio(); startScenario(last,true); }; list.appendChild(b); } }
  SCENARIOS.forEach((sc,n)=>{
    const b=document.createElement('button'); b.style.setProperty('--i', Math.min(n,6)); b.className='sc'+(sc.tutorial && !starsFor(sc.id) ? ' learn' : '');
    b.innerHTML=`<div class="n">${sc.sandbox?'∞':sc.tutorial?'?':n}</div><div class="t"><b>${sc.id==='random'?'Random map':sc.name}</b><span>${sc.id==='random'?'A new lake every time · always winnable.':sc.blurb}</span></div>${sc.sandbox||sc.tutorial?(sc.tutorial&&starsFor(sc.id)?'<div class="stars" aria-label="done">✓</div>':''):`<div class="stars" aria-label="${starsFor(sc.id)} of 3 stars">${starHtml(starsFor(sc.id))}</div>`}`;
    b.onclick=()=>{ initAudio();
      if (sc.id==='random'){ const o=lsGet('peil_save_random'); if (o && o.rseed && (o.mapV||1)===MAP_V && o.tick>0 && !o.won && !o.lost) modal(`<h2>Random map</h2><p>Map #${o.rseed} is in progress.</p><button class="btn" onclick="closeModal();rollRandom()">New map</button><button class="btn pri" onclick="closeModal();startScenario('random',true)">Continue it</button>`); else rollRandom(); return; }
      // never throw away a game in progress without asking
      const o=lsGet('peil_save_'+sc.id);
      if (o && (o.mapV||1)===MAP_V && o.tick>0 && !o.won && !o.lost) modal(`<h2>${sc.name}</h2><p>You have a game in progress here.</p><button class="btn" onclick="closeModal();startScenario('${sc.id}',false)">Start over</button><button class="btn pri" onclick="closeModal();startScenario('${sc.id}',true)">Continue</button>`);
      else startScenario(sc.id,false); };
    list.appendChild(b);
  });
  const tg=$('toggles'); tg.innerHTML='';
  const mk=(label, key, fn)=>{ const b=document.createElement('button'); b.className='tg'+(SET[key]?' on':''); b.setAttribute('aria-pressed', SET[key]); b.innerHTML=`${label} <b>${SET[key]?'on':'off'}</b>`; b.onclick=()=>{ fn(!SET[key]); showMenu(); }; tg.appendChild(b); };
  mk('Sound', 'sound', v=>{ setSound(v); if (v) sfx('tap'); });
  mk('Haptics', 'haptics', v=>{ SET.haptics=v; saveSettings(); haptic(); });
  { const b=document.createElement('button'); b.className='tg'; b.innerHTML=`Theme <b>${SET.theme}</b>`; b.onclick=()=>{ SET.theme={auto:'dark',dark:'light',light:'auto'}[SET.theme]||'auto'; saveSettings(); applyTheme(); showMenu(); }; tg.appendChild(b); }
  { const b=document.createElement('button'); b.className='tg'; b.innerHTML=`Layout <b>${isDesk()?'desktop':'phone'}</b>`; b.onclick=()=>setMode(isDesk()?'phone':'desktop'); tg.appendChild(b); }
  { const b=document.createElement('button'); b.className='tg'; b.innerHTML='Back up saves <b>file</b>'; b.onclick=backupSaves; tg.appendChild(b); }
  { const b=document.createElement('button'); b.className='tg'; b.innerHTML='Restore saves <b>file</b>'; b.onclick=()=>{ const i=document.createElement('input'); i.type='file'; i.accept='application/json,.json'; i.onchange=()=>{ const f=i.files&&i.files[0]; if (f) f.text().then(restoreSaves).catch(()=>modal('<h2>Restore saves</h2><p>Could not read that file.</p><button class="btn pri" onclick="closeModal()">OK</button>')); }; i.click(); }; tg.appendChild(b); }
  { const b=document.createElement('button'); b.className='tg'; b.innerHTML=`Random map difficulty <b>${RANDOM_DIFFS[RANDOM_DIFF].name}</b>`; b.onclick=()=>{ RANDOM_DIFF=(RANDOM_DIFF+1)%RANDOM_DIFFS.length; lsSet('peil_rdiff', RANDOM_DIFF); showMenu(); }; tg.appendChild(b); }
  mk('Touch debug', 'debug', v=>{ SET.debug=v; saveSettings(); requestRender(); });
  const standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  $('foot').innerHTML=(isDesk() ? `Drag to draw. Drag with Look, or right-drag with any tool, to move the map. Wheel zooms.<br>Keys: 1–9 tools · Space play · S speed · Z undo · Y redo · X remove · F fit · Esc look.<br>The game saves by itself.` : `One finger draws. Two fingers move and zoom the map. The game saves by itself.${standalone?'':'<br>For fullscreen: Share → Add to Home Screen.'}`)+`<br>Peil ${APP_VERSION}`;
}
function startScenario(id, cont){
  const sc=SCENARIOS.find(s=>s.id===id);
  let g = cont ? load(id) : null;
  if (!g){ g=generate(sc); cont=false; }
  G=g; setWeather(G.tick); rebuild(); closeModal();
  ptrs.clear(); gesture=null; pops.length=0; floaters.length=0;
  $('menu').classList.add('hide'); $('log').classList.add('hide'); $('scName').textContent=sc.name; $('toast').innerHTML='';
  if (selMode) endMulti(); tool='look'; selected=-1; viewMode=0; $('zView').classList.remove('on'); $('legend').classList.add('hide');
  buildToolbar(); setSpeed(0); showToolHint();
  cw=0; resize(); homeView();
  undoStack.length=0; redoStack.length=0; updateBadge();
  if (!cont){
    G.log.push({t:0, text:sc.intro, from:sc.sign, serif:true});
    updateHud(); markDirty();
    if (sc.tutorial && filmAllowed()) setTimeout(()=>{ if (G && G.sc===sc && !FILM) playFilm(sc, ()=>showIntro(sc)); }, 40); else showIntro(sc);
  }
  if (!cont || G.tick===0) dailyCheck();
  updateHud(); markDirty(); save();
}
// Chapter intro: a real picture, a short story in the family's voice, and what you have to do.
function picHtml(p){ return p ? `<figure class="pic"><img src="${p.src}" alt="${p.alt||''}" draggable="false"><figcaption>${p.credit||''}</figcaption></figure>` : ''; }
function showIntro(sc){
  const st=STORY[sc.id]||{}, ps=(st.story||[sc.intro]).map(t=>`<p class="body serif">${t}</p>`), paras=ps[0]+(ps.length>1?`<details class="more"><summary>Read on</summary>${ps.slice(1).join('')}</details>`:'');
  modal(`<div class="intro">${picHtml(st.photo)}<div class="when">${fmtDate(dateAt(G,0))} · ${sc.name}</div>${paras}${sc.sign?`<div class="sig">${sc.sign}</div>`:''}
    ${st.goal?`<div class="goalbox"><b>Your goal</b>${dtext(st.goal)}</div>`:''}
    <div style="text-align:center"><button class="btn pri" onclick="beginLevel()">Begin</button>${sc.tutorial?'<br><button class="btn quiet" onclick="closeModal();playFilm(G.sc,()=>showIntro(G.sc))">Watch the film again</button><br><button class="btn quiet" onclick="closeModal();showMenu()">Skip the lesson</button>':''}</div></div>`);
}
// After the story: show each tool that is new in this chapter, one by one (a short zoom film, or a card).
function beginLevel(){
  closeModal(); const q=newTools(G.sc), sc=G.sc;
  // tools with a zoom film get their own film and card; the rest share one card, so a chapter never stacks three cards
  const films=q.filter(t=>TOOLINFO[t].film && filmAllowed()), rest=q.filter(t=>!films.includes(t));
  const next=()=>{ if (G.sc!==sc) return; const t=films.shift();
    if (t){ playFilm(sc, ()=>toolCard(t,next), t); return; }
    if (rest.length===1){ const r=rest.shift(); toolCard(r,next); } else if (rest.length){ const r=rest.splice(0); toolsCard(r,next); } };
  next();
}
function toolsCard(list, then){
  window._toolNext=then;
  modal(`<div class="real"><div class="tag">New tools</div>${list.map(t=>{ const I=TOOLINFO[t]; return `<div style="display:flex;gap:12px;align-items:flex-start;margin:10px 0"><div style="width:40px;height:40px;flex:none">${svg(t)}</div><div><b>${I.title.replace('New: the ','The ')}</b><p class="serif" style="margin:2px 0 0">${I.text}</p></div></div>`; }).join('')}
    <button class="btn pri" onclick="closeModal();window._toolNext&&window._toolNext()">Got it</button></div>`);
}
function toolCard(t, then){
  const I=TOOLINFO[t], T=TOOL[t];
  window._toolNext=then;
  modal(`<div class="real"><div class="tag">New tool</div><div style="display:flex;align-items:center;gap:12px;margin:2px 0 8px"><div style="width:44px;height:44px;flex:none">${svg(t)}</div><h3 style="margin:0">${I.title.replace('New: the ','The ')}</h3></div>
    <p class="serif">${I.text}</p><ul><li>${I.need}</li><li>${T.cost?'Price '+T.cost:''}</li></ul><button class="btn pri" onclick="closeModal();window._toolNext&&window._toolNext()">Got it</button></div>`);
}
// "In real life": the history behind a chapter, with a photo and a few facts.
function showReal(sc, then){
  const st=STORY[sc.id]; if (!st || !st.real){ if (then) then(); return; } const r=st.real;
  modal(`<div class="real">${picHtml(st.photo)}<div class="tag">In real life</div><h3>${r.title}</h3><p class="serif">${r.text}</p><ul>${r.facts.map(f=>`<li>${f}</li>`).join('')}</ul>
    <button class="btn pri" onclick="closeModal();${then?'showMenu()':''}">${then?'Next chapter':'Close'}</button></div>`);
}
function modal(html){ $('modal').innerHTML=html; glossify($('modal'),'.intro p,.real p,.real li,.tinfo p,.goalbox'); $('modalwrap').classList.remove('hide'); document.documentElement.classList.add('modalopen'); }
function closeModal(){ $('modalwrap').classList.add('hide'); document.documentElement.classList.remove('modalopen'); }
function showWin(){
  const g=G, days=Math.floor(g.tick/DAY); let n=1; const why=['★ Goals reached'];
  if (days<=g.sc.par){ n++; why.push('★ Within par ('+days+' of '+g.sc.par+' days)'); } else why.push('☆ Par is '+g.sc.par+' days (you took '+days+')');
  if (!g.stats.breaches && !g.stats.housesLost){ n++; why.push('★ No breaches, no houses lost'); } else why.push('☆ '+g.stats.breaches+' breaches, '+g.stats.housesLost+' houses lost');
  const all=lsGet('peil_stars')||{}; all[g.sc.id]=Math.max(all[g.sc.id]||0,n); lsSet('peil_stars',all);
  if (g.sc.epilogue) g.log.push({t:g.tick, text:g.sc.epilogue, from:g.sc.sign, serif:true});
  save(); sfx('win'); haptic('heavy');
  modal(`<h2>Drooggelegd</h2>${g.sc.tutorial?'':`<div class="stars">${starHtml(n)}</div>`}<p>${g.sc.name} · ${fmtDate(dateAt(g,g.tick))}</p>${g.sc.epilogue?`<p class="serif" style="color:var(--ink);font-size:15px;line-height:1.45">${g.sc.epilogue}<br><span style="color:var(--muted);font-style:italic;font-size:12px">${g.sc.sign}</span></p>`:''}${g.sc.tutorial?'':`<div class="why">${why.join('<br>')}</div>`}
    <button class="btn" onclick="closeModal()">Keep building</button>${STORY[g.sc.id]?'<button class="btn" onclick="showReal(G.sc,1)">In real life</button>':''}<button class="btn pri" onclick="closeModal();showMenu()">Next</button>`);
}
function showLose(){
  save(); sfx('lose');
  modal(`<h2>The sea won</h2><p>Too many houses were lost. Raise the sea dike sooner and keep the pumps on power.</p>
    <button class="btn" onclick="closeModal()">Look around</button><button class="btn pri" onclick="closeModal();replay()">Try again</button>`);
}

function showLate(){
  save(); sfx('lose');
  modal(`<h2>Out of time</h2><p>The board's patience has run out. A second pump and deeper canals drain faster; count the days before you spend.</p>
    <button class="btn" onclick="closeModal()">Look around</button><button class="btn pri" onclick="closeModal();replay()">Try again</button>`);
}

// Random map: deal a validated map number, never the one just played, and start it.
function rollRandom(){ const a=RANDOM_OK.length?RANDOM_OK:[1], cur=SCENARIOS.find(s=>s.id==='random').rnd; let n=a[Math.floor(Math.random()*a.length)]; if (a.length>1 && n===cur) n=a[(a.indexOf(n)+1)%a.length]; setRandom(n); startScenario('random',false); }
function replay(){ if (G.sc.id==='random') rollRandom(); else startScenario(G.sc.id,false); }

// Back up and restore: every peil_* key in localStorage, as one JSON file (an installed web app can lose its storage if the phone clears it)
function backupSaves(){
  const o={peil:1, saved:new Date().toISOString(), data:{}}; try { for (let k=0;k<localStorage.length;k++){ const key=localStorage.key(k); if (key.startsWith('peil_')) o.data[key]=localStorage.getItem(key); } } catch(e){}
  const text=JSON.stringify(o), name='peil-backup-'+new Date().toISOString().slice(0,10)+'.json', file=new File([text], name, {type:'application/json'});
  if (navigator.canShare && navigator.canShare({files:[file]})) navigator.share({files:[file], title:'Peil backup'}).catch(()=>{});
  else { const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); }
}
function restoreSaves(text){
  let o; try { o=JSON.parse(text); } catch(e){ o=null; }
  if (!o || o.peil!==1 || !o.data || typeof o.data!=='object'){ modal('<h2>Restore saves</h2><p>That is not a Peil backup file.</p><button class="btn pri" onclick="closeModal()">OK</button>'); return; }
  let n=0; for (const [k,v] of Object.entries(o.data)){ if (!/^peil_[a-z0-9_]+$/i.test(k) || typeof v!=='string') continue; try { JSON.parse(v); localStorage.setItem(k, v); n++; } catch(e){} }
  showMenu(); modal('<h2>Restore saves</h2><p>'+n+' saved items restored.</p><button class="btn pri" onclick="closeModal()">OK</button>');
}
