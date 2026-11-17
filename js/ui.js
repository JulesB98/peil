"use strict";
/* ===== UI: toolbar, speed, info card, letters, HUD ===== */
let tool='look', speed=0, lastSpeed=1, infoTimer=0, lastStroke=null, infoKey='';

function selectTool(id){
  tool=id; selected=-1; lastStroke=null; if (selMode) endMulti();
  for (const c of $('toolScroll').children) c.classList.toggle('on', c.dataset.t===tool);
  $('bRemove').classList.toggle('on', tool==='remove');
  showToolHint(); requestRender();
}
function buildToolbar(){
  const el=$('toolScroll'); el.innerHTML='';
  for (const t of TOOLS){ if (!G.sc.tools.includes(t.id) || t.id==='remove') continue;   // Remove, Undo and Redo live in the floating buttons
    const b=document.createElement('button'); b.className='tool'+(t.id===tool?' on':'')+(t.id==='dike'||t.id==='mill'||t.id==='farm'?' grp':''); b.dataset.t=t.id;   // grp = start of a group: shape the land | pumps | buildings
 b.setAttribute('aria-label', t.label);
    b.innerHTML=svg(t.id)+`<span>${t.label}</span>`+(t.cost?`<span class="c">${t.cost}</span>`:'')+`<i class="key">${el.children.length+1}</i>`;
    b.onclick=()=>{ initAudio(); sfx('tap'); haptic(); selectTool(t.id); };
    el.appendChild(b); }
  $('bUndo').innerHTML=svg('undo'); $('bRedo').innerHTML=svg('redo'); $('bRemove').innerHTML=svg('remove');
  $('bRemove').classList.toggle('on', tool==='remove'); applyReveal();
}
function setSpeed(n){
  speed=n; if (n>0) lastSpeed=n;
  const p=$('bPlay'); p.innerHTML=svg(n>0?'pause':'play'); p.classList.toggle('on', n>0);
  $('bSpeed').textContent=lastSpeed+'×';
  requestRender();
}

/* ----- info card: tool hints, build feedback, inspection ----- */
let selMode=false, multi=new Set(), multiType='';
function setInfo(html, err, actions){
  { const h=html.slice(0,22), el=$('info'); if (setInfo._h!==h){ setInfo._h=h; if (!REDUCED){ el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } } }
  clearTimeout(infoTimer); infoKey=html; $('section').classList.add('hide');
  $('infoX').innerHTML=dtext(html); glossify($('infoX')); $('info').classList.toggle('err', !!err); $('info').classList.toggle('multi', (actions||[]).length>1);
  const a=$('infoA'); a.innerHTML='';
  for (const act of (actions||[])){ const b=document.createElement('button'); b.textContent=act.label; b.onclick=act.fn; if (act.sec) b.classList.add('sec'); a.appendChild(b); }
}
function showToolHint(){ const t=TOOL[tool]; setInfo(`<b>${t.label}</b>${t.cost?' · '+t.cost:''} · ${t.hint}`); }
function flashHint(msg){ setInfo(msg, true); sfx('error'); haptic('error'); infoTimer=setTimeout(showToolHint, 2800); }

function letter(text, alert, from){
  const sign = from===undefined ? (G&&G.sc.sign) : from;
  if (G){ G.log.push({t:G.tick, text, alert:!!alert, from:sign}); G.unread=(G.unread||0)+1; updateBadge(); }
  sfx('letter');
  const el=document.createElement('button'); el.className='letter card in'+(alert?' alert':''); el.innerHTML=`${text}<small>${sign||'Peil'} · tap to open Letters</small>`; glossify(el);
  el.onclick=()=>{ el.remove(); openLog(); }; const box=$('toast'); box.appendChild(el);
  requestAnimationFrame(()=>el.classList.remove('in'));
  while (box.children.length>1) box.firstChild.remove();           // one at a time; every letter is kept in the Letters panel
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(), 450); }, alert?11000:8000);
}
function onLandSold(i){ if (typeof addFloater==='function' && hash2(i,G.tick,1)<0.25) addFloater(i,'+ƒ12'); }

/* ----- HUD ----- */
function updateHud(){
  const g=G; const m=$('money'); m.textContent=fmtMoney(g.money); m.classList.toggle('neg', g.money<0);
  $('date').textContent=fmtDate(dateAt(g,g.tick));
  const chips=[];
  for (const s of goalState()){
    if (s.storm){ chips.push(`<span class="chip ${s.ok?'done':''}">${s.ok?'✓ ':''}Storm ${s.ok?'survived':nextStormText()}</span>`); continue; }
    const v = s.pct? Math.round(s.v*100)+'%' : s.v, tg = s.pct? Math.round(s.target*100)+'%' : s.target;
    const p = clamp(s.v/s.target,0,1)*100;
    chips.push(`<span class="chip ${s.ok?'done':s.fail?'bad':''}">${s.ok?'✓ ':''}${s.label} ${v} / ${tg}<span class="bar"><i style="width:${p}%"></i></span></span>`);
  }
  if (g.sc.tutorial && g.m){ const p=Math.round(g.m.dry*100); chips.push(`<span class="chip ${g.m.dry>=0.9?'done':''}">Goal: lake dry ${p}% / 90%<span class="bar"><i style="width:${clamp(g.m.dry/0.9,0,1)*100}%"></i></span></span>`); }
  if (g.sc.sandbox){ chips.push(`<span class="chip">Dry ${Math.round(g.m.dry*100)}%</span>`); const ns=nextStormText(); if (ns) chips.push(`<span class="chip">Storm ${ns}</span>`); }
  const bz=g.boezem; if (bz>0.1) chips.push(`<span class="chip bad">▲ Boezem ${fmtM1(bz)} m</span>`);
  if (g.sc.deadline){ const left=Math.max(0, Math.ceil(g.sc.deadline-g.tick/DAY)); chips.push(`<span class="chip ${left<=Math.round(g.sc.deadline*0.2)?'bad':''}">${left} days left</span>`); }
  if (g.sc.storms.length && g.m) chips.push(`<span class="chip ${g.m.seaMin<4?'bad':''}">Sea dike ${fmtM1(g.m.seaMin)} m</span>`);
  chips.push(`<span class="chip">Wind ${g.wind>=0.97?'storm':Math.round((g.wind||0)*100)+'%'}</span>`);
  if (g.pop) chips.push(`<span class="chip ${g.pop>g.food?'bad':''}">People ${g.pop} · food for ${g.food}</span>`);
  if (g.income>0.01) chips.push(`<span class="chip">ƒ${Math.round(g.income*DAY)} a day</span>`);
  const html=chips.join(''), el=$('chips'); if (el._h!==html && !glossBusy()){ el._h=html; el.innerHTML=html; glossify(el,'.chip'); }
  for (const b of $('toolScroll').children){ const t=TOOL[b.dataset.t]; b.classList.toggle('poor', !!(t.price && g.money<t.price)); }
  $('bUndo').classList.toggle('dim', !undoStack.length); $('bRedo').classList.toggle('dim', !redoStack.length);
  if (selected>=0 && !gesture && !selMode) inspect(selected, true);
  drawGauge();
  updateStep(); applyReveal();
}
function nextStormText(){
  const g=G; for (const st of g.sc.storms){ const t0=stormT0(st); if (g.tick<t0) { const d=Math.ceil((t0-g.tick)/DAY); return 'in '+d+'d'; } if (g.tick<=t0+st.dur) return 'now'; }
  return '';
}

/* ----- inspection ----- */
function reversePump(i){
  const g=G, t=g.pin[i]; g.pin[i]=g.pout[i]; g.pout[i]=t; sfx('place'); haptic(); inspect(i); requestRender();
}
// The connected stretch of dike (same crest) or canal (same depth) around cell i.
function stretchCells(i){
  const g=G, isD=g.dike[i]>0, isC=!isD && g.canal[i]>0;
  if (!isD && !isC) return null;
  const key=(j)=> isD ? (g.dike[j]>0 && g.kind[j]===0 ? Math.round((g.ground[j]+g.dike[j])*10) : -1)
                      : (g.canal[j]>0 && g.kind[j]===0 && g.dike[j]<=0 && !g.struct[j] ? g.canal[j] : -1);
  const k0=key(i); if (k0<0) return null;
  const seen=new Set([i]), q=[i];
  for (let h=0; h<q.length; h++) for (const j of neighbors4(q[h])) if (!seen.has(j) && key(j)===k0){ seen.add(j); q.push(j); }
  return {cells:q.slice(), id:isD?'dike':'canal'};
}
// Lower dikes by 0.5 m (a dike at 0.5 m goes away) or make canals 1 m shallower. One undoable step.
function lowerCells(id, cells){
  const g=G; snapshot(); let n=0;
  for (const i of cells){ if (g.struct[i]) continue;
    if (id==='dike' && g.dike[i]>0){ g.dike[i]-=0.5; if (g.dike[i]<0.25) g.dike[i]=0; n++; }
    else if (id==='canal' && g.canal[i]>0){ g.canal[i]--; g.ground[i]+=1; n++; } }
  if (!n){ undoStack.pop(); flashHint('Nothing to lower here.'); return 0; }
  redoStack.length=0; g.dirty=false; rebuild(); sfx('remove'); haptic(); updateHud(); requestRender(); return n;
}
// One-button upgrade, lower and "select several" for the stretch around i.
function upgradeStretch(i){
  const st=stretchCells(i); if (!st) return null;
  const g=G, cells=st.cells, id=st.id, isD=id==='dike', one=(cells.length===1);
  let cost=0, can=0; for (const c of cells){ const r=toolAt(id,c,false); if (r.ok){ can++; cost+=r.cost||0; } }
  const maxed = can===0, verb = isD ? 'Raise' : 'Deepen', step = isD ? '+0.5 m' : '+1 m', lowStep = isD ? '−0.5 m' : '−1 m';
  const note = ` · ${one?'1 cell':cells.length+' cells in this stretch'}` + (maxed ? ' · at its limit' : '');
  const lower={sec:1, label:`${isD?'Lower':'Shallower'} ${lowStep}`, fn:()=>{ if (lowerCells(id, cells)){ selected=i; inspect(i); } }};
  const more={sec:1, label:'Select more', fn:()=>{ selMode=true; multiType=id; multi=new Set(cells); inspectMulti(); }};
  const act = maxed ? {label:'Maxed', fn:()=>{}, up:1}
    : {label:`${verb} ${one?'':cells.length+' cells '}${step} · ${fmtMoney(cost)}`, up:1, fn:()=>{ const r=doStroke(id, cells); if (r && r.built){ G.flags.raised=1; selected=i; inspect(i); } }};
  return {set:new Set(cells), note, act, extra:[lower, more]};
}
// Several stretches at once: tap or drag across dikes (or canals) to add them, tap again to take one out.
function multiCost(id){ let cost=0; for (const c of multi){ const r=toolAt(id,c,false); if (r.ok) cost+=r.cost||0; } return cost; }
function inspectMulti(){
  const g=G, id=multiType, isD=id==='dike', n=multi.size, w=isD?'dike':'canal';
  selSet=multi; selected=n?[...multi][0]:-1;
  const act=(label,fn)=>({label, fn, sec:1});
  const t = n ? `<b>${n} ${w} cells</b> selected · drag across more ${w}s to add them, tap one to take it out` : `<b>Select ${w}s</b> · drag across them, or tap one`;
  const acts=[];
  if (n){
    acts.push({label:`${isD?'Raise':'Deepen'} all ${isD?'+0.5 m':'+1 m'} · ${fmtMoney(multiCost(id))}`, up:1, fn:()=>{ const r=commitStroke(id,[...multi]); if (!r.built){ flashHint(r.msg||'Nothing to do.'); return; } sfx(id); haptic(); g.flags.raised=1; updateHud(); requestRender(); inspectMulti(); }});
    acts.push(act(`${isD?'Lower':'Shallower'} all ${isD?'−0.5 m':'−1 m'}`, ()=>{ if (lowerCells(id,[...multi])) inspectMulti(); }));
  }
  acts.push(act('Done', ()=>{ endMulti(); showToolHint(); }));
  setInfo(t, false, acts); infoKey=t+acts.map(a=>a.label).join();
}
function endMulti(){ selMode=false; multi=new Set(); multiType=''; selSet=null; selected=-1; requestRender(); }
function multiAdd(i, toggle){
  const st=stretchCells(i); if (!st) return false; if (multi.size && st.id!==multiType) return false; multiType=st.id;
  if (toggle && st.cells.every(c=>multi.has(c))) for (const c of st.cells) multi.delete(c); else for (const c of st.cells) multi.add(c);
  return true;
}
function inspect(i, quiet){
  const g=G, k=g.kind[i], s=g.struct[i], d=g.depth[i];
  if (!quiet) g.flags.inspected=1;
  if (g.dike[i]>0 && seaFront(i)) g.flags.inspectedSea=1;
  let t='', actions=[], warn=false;
  if (k===2) t=`<b>Sea</b> · level ${fmtM(g.sea)}`;
  else if (k===1) t=`<b>Boezem</b> · level ${fmtM(g.boezem)} · kept near ${fmtM(BZ_NORM)} by the sea sluice`;
  else if (s>=1 && s<=3){
    const T=PUMP[s], st=g.pumpState[i], lift=pumpLift(i), a=sideName(g.pin[i]), b=sideName(g.pout[i]);
    const why=['pumping '+(g.pumpFlow[i]*24).toFixed(1)+' a day', 'idle: no water at its '+a+' side. Dig a canal up to it.', 'stuck: '+lift.toFixed(1)+' m is more than it can lift.', 'stopped: no road to town.', 'storm: sails furled.', '', 'no open sides.', 'holding barge water: your lock is set to keep '+DRAFT+' m in the canals.', 'resting: the basin is at its peil.'][st];
    warn = st===2 || st===3;
    t=`<b>${T.name}</b> · ${a} → ${b} · lift ${Math.max(0,lift).toFixed(1)} of ${T.lift} m · ${why}`;
    actions=[{label:'Reverse', fn:()=>reversePump(i)}];
    if (g.sc.peil && g.kind[g.pin[i]]===0){ const lv=peilLevel(g.pin[i]), set=g.rLvl[g.region[g.pin[i]]]>-1e8; t+=` · peil ${set?fmtM(lv):'none: drains to the bed ('+fmtM(lv)+')'}`;
      actions.push({label:'Peil −', fn:()=>{ nudgePeil(i,-1); inspect(i); }}, {label:'Peil +', fn:()=>{ nudgePeil(i,1); inspect(i); }}); }
  } else if (s===S.LOCK){ const sd=lockSides(i); let reach=0; if (g.wPar) for (let j=0;j<g.N;j++) if (g.wPar[j]>=0) reach++;
    warn=!sd || !(g.wPar && sd && g.wPar[sd[0]]>=0);
    t=`<b>Lock</b> · ${warn?'no barge water at its polder side: needs '+DRAFT+' m':'barge water reaches '+reach+' cells'} · ${g.flags.holdPeil?'pumps keep '+DRAFT+' m in barge canals':'pumps drain as deep as they can'} · ${g.flags.lockPass||0} barges through`;
    actions=[{label: g.flags.holdPeil ? 'Drain deeper' : 'Keep barge water', fn:()=>{ g.flags.holdPeil = g.flags.holdPeil ? 0 : 1; inspect(i); }}];
  } else if (s===S.SLUICE) t=`<b>Sluice</b> · ${g.pumpFlow[i]>0.001?'open, draining':'closed. Opens when the outside is lower.'}`;
  else if (s===S.FARM){ const ship=shipLinked(i), road=connected(i); warn=!road && !ship; t=`<b>Farm</b> · ${SOILS[g.soil[i]]} · ${ship?'ships by barge, '+Math.round(100*g.stock[i]/CART_LOAD)+'% loaded':road?'cart '+Math.round(100*g.stock[i]/CART_LOAD)+'% full':'no road to town'}${d>0.1?' · flooding!':''}${g.sc.peil && g.polder[i] ? (()=>{ const gp=peilGap(i); return gp<0.5 ? ' · too wet: land only '+gp.toFixed(1)+' m above the water level' : gp>1.2 ? ' · too dry: '+gp.toFixed(1)+' m above the water level, yield falls' : ' · water level just right'; })() : ''}`; }
  else if (s===S.HOUSE){ warn=!connected(i); t=`<b>House</b> · 5 people · ${connected(i)?'pays tax':'no road to town'}${d>0.1?' · flooding!':''}`; }
  else if (s===S.TOWN) t=`<b>Town</b> · buys grain, sells coal · ${g.carts.length} cart${g.carts.length===1?'':'s'} on the road`;
  else {
    const name = g.dike[i]>0 ? 'Dike' : g.canal[i] ? 'Canal, '+g.canal[i]+' m deep'+(g.locks.length ? (g.wPar && g.wPar[i]>=0 ? ' · barges float' : ' · too shallow for barges ('+d.toFixed(1)+' of '+DRAFT+' m)') : '') : g.road[i] ? 'Road' : g.polder[i] ? (d>0.05?'Lake':g.ripe[i]<0.35?'Mud':g.ripe[i]<0.8?'Reeds':'Meadow') : 'Land';
    t=`<b>${name}</b>`;
    if (g.dike[i]>0) t+=` · crest ${fmtM(g.ground[i]+g.dike[i])}`; else t+=` · ground ${fmtM(g.ground[i])}`;
    if (d>0.005) t+=` · water ${d.toFixed(2)} m deep`;
    t+=` · ${SOILS[g.soil[i]]}`;
    const up = upgradeStretch(i); if (up){ selSet=up.set; actions=[up.act, ...up.extra]; t+=up.note; }
  }
  if (!actions.length || !actions[0].up) selSet=null;
  const key=t+actions.map(a=>a.label).join(), isPump = k===0 && ((s>=1 && s<=3) || s===S.SLUICE || s===S.LOCK);
  if (quiet && infoKey===key){ if (isPump) drawSection(i); return; }
  setInfo(t, warn, actions); infoKey=key;
  if (isPump) drawSection(i);
}
/* ----- cross-sections (Hollandse lucht): an engraved slice through a pump, sluice or lock -----
   The slice is laid out the way the map is: left in the drawing is left on the screen (for a pump on a vertical
   line, the top of the screen is the left of the drawing), so water flows the same way in both. Drawn on its own
   paper plate, like the peilschaal, in light and dark. */
const SEC={ W:320, H:140, ink:'#26261f', paper:'#f4ecd8', earth:'#b59b6d', grass:'#6d8a42', water:'#7fa9b0', waterDk:'#44707c', rood:'#a33a24', ok:'#4a6326', muted:'#5b5648' };
// eleven cells through p along the line from a to b, in screen order
function sectionCols(p, a, b){
  const g=G, C=g.C, horiz = (a%C)!==(b%C), px=p%C, py=(p/C)|0, cols=[];
  for (let k=-5;k<=5;k++){ const x=horiz?px+k:px, y=horiz?py:py+k; if (x<0||y<0||x>=C||y>=g.R) continue; const i=y*C+x;
    const lvl = g.kind[i]===1 ? g.boezem : g.kind[i]===2 ? g.sea : (g.depth[i]>0.02 ? g.ground[i]+g.depth[i] : null);
    cols.push({k, i, ground:g.ground[i], top:g.ground[i]+g.dike[i], lvl, dike:g.dike[i]>0}); }
  return cols;
}
// ground, water and dikes of a slice; returns helpers to draw on top
function sectionBase(cols, lo, hi, label){
  const {W,H,ink}=SEC, top=44, bot=H-10, n=cols.length, cw=W/n, Y=v=>top+(hi-v)/(hi-lo)*(bot-top), X=k=>cols.findIndex(c=>c.k===k)*cw;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><defs><pattern id="secHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${ink}" stroke-opacity=".22" stroke-width="1"/></pattern></defs>`;
  s+=`<rect x=".5" y=".5" width="${W-1}" height="${H-1}" rx="3" fill="${SEC.paper}" stroke="${ink}"/>`;
  // water bodies: a fill, an inked surface and one waterlijn under it
  for (const c of cols){ if (c.lvl==null || c.lvl<=c.ground || c.k===0 && c.dike) continue; const x=X(c.k), y=Y(c.lvl);
    s+=`<rect x="${x}" y="${y}" width="${cw+0.6}" height="${Math.max(0,Y(c.ground)-y)}" fill="${SEC.water}"/><line x1="${x}" x2="${x+cw+0.6}" y1="${y}" y2="${y}" stroke="${ink}" stroke-width="1.4"/>`;
    if (Y(c.ground)-y>7) s+=`<line x1="${x}" x2="${x+cw+0.6}" y1="${y+4}" y2="${y+4}" stroke="${ink}" stroke-opacity=".35" stroke-width=".8"/>`; }
  // ground: one profile through the cells, klei with an engraved hatch
  let d=`M0 ${H-1}`; for (const c of cols){ const x=X(c.k); d+=` L${x} ${Y(c.ground)} L${x+cw} ${Y(c.ground)}`; } d+=` L${W} ${H-1} Z`;
  s+=`<path d="${d}" fill="${SEC.earth}"/><path d="${d}" fill="url(#secHatch)"/>`;
  let e=''; for (const c of cols){ const x=X(c.k); e+=`${e?' L':'M'}${x} ${Y(c.ground)} L${x+cw} ${Y(c.ground)}`; } s+=`<path d="${e}" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  // dikes: grass body, ink edge, hatch ticks on the flanks
  for (const c of cols){ if (!c.dike) continue; const x=X(c.k), x0=x+cw*0.1, x1=x+cw*0.9, yb=Y(c.ground), yt=Y(c.top);
    s+=`<path d="M${x-1} ${yb} L${x0} ${yt} L${x1} ${yt} L${x+cw+1} ${yb} Z" fill="${SEC.grass}" stroke="${ink}" stroke-width="1.2"/>`;
    for (let t=0.3;t<0.95;t+=0.3){ const yy=yt+(yb-yt)*t, l=x0-(x0-x+1)*t, r=x1+(x+cw+1-x1)*t; s+=`<path d="M${l} ${yy} l4 0 M${r} ${yy} l-4 0" stroke="${ink}" stroke-opacity=".5" stroke-width=".8"/>`; } }
  return { s, Y, X, cw, top, bot };
}
const secText=(x,y,t,col,anchor,size,g)=>`<text${g?` data-g="${g}" class="gt"`:''} x="${x}" y="${y}" text-anchor="${anchor||'start'}" font-family="Alegreya Sans" font-weight="800" font-size="${size||11}" fill="${col||SEC.ink}">${t}</text>`;
// the pump itself on the crest, small and inked
function secPump(type, x, y, w, on){
  const ink=SEC.ink;
  if (type===S.MILL){ const h=w*1.1; let s=`<path d="M${x-w*.22} ${y} L${x-w*.15} ${y-h*.62} H${x+w*.15} L${x+w*.22} ${y} Z" fill="#6b5236" stroke="${ink}" stroke-width="1"/><path d="M${x-w*.18} ${y-h*.6} Q${x} ${y-h*.85} ${x+w*.18} ${y-h*.6} Z" fill="#3a2f26" stroke="${ink}" stroke-width=".9"/>`;
    const hx=x, hy=y-h*.66, L=w*.62, a0=on ? (performance.now()/900)%(Math.PI/2) : 0.3; for (let k=0;k<4;k++){ const an=a0+k*Math.PI/2; s+=`<line x1="${hx}" y1="${hy}" x2="${hx+Math.cos(an)*L}" y2="${hy+Math.sin(an)*L}" stroke="${ink}" stroke-width="2"/>`; } return s+`<circle cx="${hx}" cy="${hy}" r="1.6" fill="${ink}"/>`; }
  const wall = type===S.STEAM ? '#9a4a32' : '#e9dcc0';
  let s=`<path d="M${x-w*.32} ${y} V${y-w*.55} L${x} ${y-w*.85} L${x+w*.32} ${y-w*.55} V${y} Z" fill="${wall}" stroke="${ink}" stroke-width="1"/>`;
  if (type===S.STEAM) s+=`<rect x="${x+w*.18}" y="${y-w*1.1}" width="${w*.12}" height="${w*.6}" fill="#7a3424" stroke="${ink}" stroke-width=".8"/>`;
  else s+=`<path d="M${x+2} ${y-w*.62} l-3.5 6 h3.5 l-2.5 5" fill="none" stroke="#2f6d8c" stroke-width="1.6"/>`;
  return s;
}
function drawSection(p){
  if (G.struct[p]===S.SLUICE || G.struct[p]===S.LOCK) return drawGateSection(p);
  const g=G, a=g.pin[p], b=g.pout[p], el=$('section');
  if (a<0 || b<0){ el.classList.add('hide'); return; }
  const cols=sectionCols(p,a,b), T=PUMP[g.struct[p]], sIn=surf(a), sOut=surf(b), floor=sOut-T.lift, st=g.pumpState[p], ok = sOut-sIn <= T.lift;
  // deepest bed on the intake side: can this pump ever empty it?
  let bed=1e9; const ra=g.kind[a]===0 ? g.region[a] : -1; if (ra>=0) for (let i=0;i<g.N;i++) if (g.region[i]===ra && g.ground[i]<bed) bed=g.ground[i];
  let lo=1e9, hi=-1e9; for (const c of cols){ lo=Math.min(lo,c.ground); hi=Math.max(hi,c.top, c.lvl==null?-1e9:c.lvl); }
  const plv = g.sc.peil && g.kind[a]===0 && g.region[a]>=0 ? peilLevel(a) : null, plSet = plv!=null && g.rLvl[g.region[a]]>-1e8;
  if (plv!=null) hi=Math.max(hi, plv+0.3);
  if (bed<1e9) lo=Math.min(lo,bed); lo=Math.min(lo,floor); lo-=0.4; hi+=0.9;
  const B=sectionBase(cols, lo, hi, 'Cross-section through the pump: '+sideName(a)+' to '+sideName(b)), {Y,X,cw,W}={...B,W:SEC.W}, H=SEC.H;
  let s=B.s;
  const kIn=cols.find(c=>c.i===a).k, inLeft = kIn<0, xm=X(0)+cw/2, crest=Y(g.ground[p]+g.dike[p]);
  const xIn = inLeft ? 4 : W-4, inSide = inLeft ? [2, xm-cw*0.6] : [xm+cw*0.6, W-2];
  // how far down this pump can pull the intake side, and the deepest bed it has to reach
  const yf=Y(floor), short = bed<1e9 && bed<floor-0.05, fcol = short ? SEC.rood : SEC.ok;
  // two labels on the intake side; when their lines are close, the upper label sits above its line and the lower one below
  let tyF = yf-3, tyB = null;
  if (bed<1e9){ const yb=Y(bed); tyB=yb-3; if (Math.abs(yb-yf)<14){ if (yb<yf){ tyB=yb-3; tyF=yf+11; } else { tyF=yf-3; tyB=yb+11; } }
    s+=`<line x1="${inSide[0]}" x2="${inSide[1]}" y1="${yb}" y2="${yb}" stroke="${SEC.ink}" stroke-opacity=".5" stroke-width="1"/>`+secText(xIn, tyB, 'deepest bed '+fmtM(bed), SEC.ink, inLeft?'start':'end', 10.5, 'deepest'); }
  s+=`<line x1="${inSide[0]}" x2="${inSide[1]}" y1="${yf}" y2="${yf}" stroke="${fcol}" stroke-dasharray="5 3" stroke-width="1.6"/>`+secText(xIn, tyF, 'can drain to '+fmtM(floor)+(short?' · not deep enough':''), fcol, inLeft?'start':'end', 10.5, 'drainto');
  // the peil: the level this basin is held at (or the deepest bed when none is set), as a labelled line across the intake side
  if (plv!=null){ const yp=Y(plv), pc=SEC.waterDk, ix = inLeft ? xm+cw*0.65 : xm-cw*0.65, label = plSet ? 'peil '+fmtM(plv) : 'no peil set';
    s+=`<line x1="2" x2="${W-2}" y1="${yp}" y2="${yp}" stroke="${pc}" stroke-width="1.6" stroke-dasharray="1 3" stroke-linecap="round"/>`
      +`<text x="${ix}" y="${yp-4}" text-anchor="${inLeft?'start':'end'}" font-size="10.5" font-weight="700" fill="${pc}" stroke="#f4ecd8" stroke-width="3" paint-order="stroke" stroke-linejoin="round">${label}</text>`; }
  // the flow: an arrow from the intake water, over the crest, down to the outlet water, the way it goes on the map
  const y1=Y(sIn), y2=Y(sOut), xa = inLeft ? X(kIn)+cw*0.2 : X(kIn)+cw*0.8, xb = inLeft ? X(cols.find(c=>c.i===b).k)+cw*0.8 : X(cols.find(c=>c.i===b).k)+cw*0.2;
  const run = st===0, acol = !ok ? SEC.rood : run ? SEC.waterDk : SEC.muted, peak=Math.min(crest-16, y1-10, y2-10);
  s+=`<path d="M${xa} ${y1-2} C${xa} ${peak} ${xb} ${peak} ${xb} ${y2-6}" fill="none" stroke="${acol}" stroke-width="2.4" ${run&&ok?'':'stroke-dasharray="5 4"'}/>`;
  const dir = xb>xa ? 1 : -1; s+=`<path d="M${xb-5} ${y2-11} L${xb} ${y2-3} L${xb+5} ${y2-11} Z" fill="${acol}" transform="rotate(${-dir*12} ${xb} ${y2-6})"/>`;
  s+=secPump(g.struct[p], xm, crest, cw*0.9, run);
  // lift bracket on the outlet side of the crest
  const lift=Math.max(0,sOut-sIn), bx = inLeft ? xm+cw*0.7 : xm-cw*0.7;
  if (Math.abs(y1-y2)>3) s+=`<path d="M${bx-3} ${y1} H${bx+3} M${bx} ${y1} V${y2} M${bx-3} ${y2} H${bx+3}" stroke="${ok?SEC.ink:SEC.rood}" stroke-width="1.1"/>`;
  s+=secText(W/2, 14, 'lift '+lift.toFixed(1)+' of '+T.lift+' m'+(ok?'':' · too high'), ok?SEC.ink:SEC.rood, 'middle', 12, 'lift');
  // side names under each side, in screen order
  const left = inLeft ? [a,sIn] : [b,sOut], right = inLeft ? [b,sOut] : [a,sIn];
  s+=secText(6, 30, sideName(left[0])+' '+fmtM(left[1]), SEC.ink)+secText(W-6, 30, sideName(right[0])+' '+fmtM(right[1]), SEC.ink, 'end');
  s+=`</svg>`;
  if (el.innerHTML!==s && !glossBusy()) el.innerHTML=s; el.classList.remove('hide');
}

// Sluice and lock: water on both sides of the gate. A sluice opens when the inside is higher; a lock shows the barge draft.
function gateSides(p){
  const g=G;
  if (g.struct[p]===S.LOCK){ const sd=lockSides(p); return sd ? [sd[0], sd[1]] : null; }
  let inI=-1, outI=-1, sh=-1e9, sl=1e9;
  // inside is polder water, or the boezem for a sluice in the sea dike; outside is boezem or sea
  const inside=(j)=> g.kind[j]===0 || (g.kind[j]===1 && neighbors4(p).some(k=>g.kind[k]===2));
  for (const j of neighbors4(p)){ if (g.dike[j]>0) continue; const s=surf(j); if (inside(j)){ if (s>sh){ sh=s; inI=j; } } else if (g.kind[j]>0 && s<sl){ sl=s; outI=j; } }
  return inI>=0 && outI>=0 ? [inI, outI] : null;
}
function drawGateSection(p){
  const g=G, el=$('section'), sd=gateSides(p); if (!sd){ el.classList.add('hide'); return; }
  const [a,b]=sd, lock=g.struct[p]===S.LOCK, cols=sectionCols(p,a,b);
  const sIn=surf(a), sOut=surf(b), open = !lock && g.pumpFlow[p]>0.001, need = lock ? g.ground[a]+DRAFT : null;
  let lo=1e9, hi=-1e9; for (const c of cols){ lo=Math.min(lo,c.ground); hi=Math.max(hi,c.top, c.lvl==null?-1e9:c.lvl); } if (need!=null) hi=Math.max(hi,need); lo-=0.4; hi+=0.7;
  const B=sectionBase(cols.map(c=>c.k===0?{...c,dike:false}:c), lo, hi, 'Cross-section through the '+(lock?'lock':'sluice')), {Y,X,cw}=B, W=SEC.W, H=SEC.H, ink=SEC.ink;
  let s=B.s; const kIn=cols.find(c=>c.i===a).k, inLeft=kIn<0;
  // the gate cell: two walls, and the gate open or shut
  const x0=X(0), crest=Y(g.ground[p]+g.dike[p]), gb=Y(g.ground[p]);
  if (lock){ const lv=Math.min(sIn,sOut); s+=`<rect x="${x0+6}" y="${Y(lv)}" width="${cw-12}" height="${gb-Y(lv)}" fill="${SEC.water}"/><line x1="${x0+6}" x2="${x0+cw-6}" y1="${Y(lv)}" y2="${Y(lv)}" stroke="${ink}" stroke-width="1.2"/>`; }
  else if (open){ const lv=Math.max(sIn,sOut); s+=`<rect x="${x0+6}" y="${Y(lv)}" width="${cw-12}" height="${gb-Y(lv)}" fill="${SEC.water}" opacity=".85"/>`; }
  else s+=`<rect x="${x0+6}" y="${crest+4}" width="${cw-12}" height="${gb-crest-4}" fill="#8a6a44" stroke="${ink}" stroke-width="1"/>`;
  s+=`<rect x="${x0+1}" y="${crest}" width="5" height="${gb-crest}" fill="${ink}"/><rect x="${x0+cw-6}" y="${crest}" width="5" height="${gb-crest}" fill="${ink}"/>`;
  if (open){ const xa=inLeft?x0-cw*0.4:x0+cw*1.4, xb=inLeft?x0+cw*1.4:x0-cw*0.4, yy=Y(Math.max(sIn,sOut))+8, dir=xb>xa?1:-1; s+=`<path d="M${xa} ${yy} H${xb-dir*6}" stroke="${SEC.waterDk}" stroke-width="2.2"/><path d="M${xb} ${yy} l${-dir*7} -4.5 v9 z" fill="${SEC.waterDk}"/>`; }
  if (need!=null){ const ok=sIn>=need-0.001, yn=Y(need), col=ok?SEC.ok:SEC.rood, xs=inLeft?[2,x0]:[x0+cw,W-2];
    s+=`<line x1="${xs[0]}" x2="${xs[1]}" y1="${yn}" y2="${yn}" stroke="${col}" stroke-dasharray="5 3" stroke-width="1.6"/>`+secText(inLeft?4:W-4, yn-3, 'barges need '+fmtM(need)+(ok?'':' · too shallow'), col, inLeft?'start':'end', 10.5, 'barge'); }
  const head = lock ? `lock · ${g.flags.lockPass||0} barges through` : (open ? 'sluice open · draining' : (sIn>sOut ? 'sluice shut' : 'sluice shut · outside is higher'));
  s+=secText(W/2, 14, head, ink, 'middle', 12);
  const left = inLeft ? [a,sIn] : [b,sOut], right = inLeft ? [b,sOut] : [a,sIn];
  s+=secText(6, 30, sideName(left[0])+' '+fmtM(left[1]), ink)+secText(W-6, 30, sideName(right[0])+' '+fmtM(right[1]), ink, 'end')+`</svg>`;
  if (el.innerHTML!==s && !glossBusy()) el.innerHTML=s; el.classList.remove('hide');
}
