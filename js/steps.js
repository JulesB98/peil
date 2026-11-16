"use strict";
/* ===== STEPS / LETTERS / UNDO ===== */
function updateStep(){
  const g=G, st=g.sc.steps||[], el=$('step');
  if (!st.length || !g.m){ el.classList.add('hide'); pulseTool(null); return; }
  let adv=false;
  while (g.step<st.length && st[g.step].done(g)){ g.log.push({t:g.tick, text:st[g.step].text, step:true}); g.step++; adv=true; }
  if (adv){ sfx('step'); markDirty(); }
  if (g.step>=st.length){ el.classList.add('hide'); pulseTool(null); return; }
  el.classList.remove('hide');
  $('stepK').textContent=(g.step+1)+' / '+st.length;
  { const t=dtext(st[g.step].text); if ($('stepX')._t!==t){ $('stepX')._t=t; $('stepX').textContent=t; glossify($('stepX')); } }
  pulseTool(st[g.step].tool);
  if (st[g.step].focus && g.flags.focusShown!==g.step && cw>0){ const c=focusCells(); if (c.length){ g.flags.focusShown=g.step; showCells(c); } }
  if (adv){ el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 900); if (!REDUCED){ el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } }
}
// Point at the button the current step needs, until it is the active one.
function pulseTool(id){
  for (const b of $('toolScroll').children) b.classList.toggle('pulse', !!id && b.dataset.t===id && tool!==id);
  // a tool the step needs may sit beyond the right edge of the toolbar: bring it into view once
  if (id && pulseTool._id!==id){ pulseTool._id=id; const b=[...$('toolScroll').children].find(x=>x.dataset.t===id && !x.classList.contains('rvh')), sc=$('toolScroll');
    if (b && b.offsetLeft+b.offsetWidth>sc.scrollLeft+sc.clientWidth-30) sc.scrollTo({left:b.offsetLeft-sc.clientWidth+b.offsetWidth+40, behavior:'smooth'}); }
  $('bPlay').classList.toggle('pulse', id==='play' && speed===0);
  for (const [k,el] of [['undo','bUndo'],['redo','bRedo'],['remove','bRemove'],['zoom','zIn']]) $(el).classList.toggle('pulse', id===k && !(k==='remove' && tool==='remove'));
}
function updateBadge(){ const b=$('logBadge'), n=G?G.unread:0; b.classList.toggle('hide', !(n>0)); b.textContent=n>9?'9+':n; }
function openLog(){
  const g=G; if (!g) return; g.unread=0; updateBadge();
  const st=g.sc.steps||[], out=[], sy=STORY[g.sc.id];
  if (sy && sy.goal) out.push(`<div class="entry"><div class="d">Goal</div><b>${dtext(sy.goal)}</b></div>`);
  if (st.length){
    const rows=st.map((x,n)=> n<g.step ? `<div style="color:var(--ok)">✓ ${x.text}</div>` : n===g.step ? `<div style="font-weight:600;color:var(--ink)">→ ${x.text}</div>` : `<div style="color:var(--muted)">· ${x.text}</div>`);
    out.push(`<div class="entry stepnow"><div class="d">Steps · ${Math.min(g.step,st.length)} of ${st.length} done</div><div style="display:flex;flex-direction:column;gap:6px">${rows.join('')}</div></div>`);
  }
  for (const e of g.log.slice().reverse()){
    if (e.step) continue;
    out.push(`<div class="entry ${e.alert?'alert':''}"><div class="d">${fmtDate(dateAt(g,e.t))}${e.from?' · '+e.from:''}</div><span class="${e.serif?'serif':''}">${e.text}</span></div>`);
  }
  if (sy && sy.real) out.push(`<button class="btn quiet" style="width:100%" onclick="$('log').classList.add('hide');showReal(G.sc)">In real life: ${sy.real.title}</button>`);
  $('logList').innerHTML=out.join('') || '<div class="entry">No letters yet.</div>'; glossify($('logList'),'.entry');
  $('log').classList.remove('hide');
}

/* Undo: a snapshot of the buildable layers before every stroke. Valid for 2 game days. */
const undoStack=[];
const UNDO_KEYS=['kind','ground','dike','struct','road','canal','polder','depth','pin','pout','given','stock'];
function snapshot(){ undoStack.push({t:G.tick, money:G.money, a:UNDO_KEYS.map(k=>G[k].slice())}); if (undoStack.length>15) undoStack.shift(); }
const redoStack=[];   // states undone, in order; cleared as soon as something new is built
function takeState(){ return {t:G.tick, money:G.money, a:UNDO_KEYS.map(k=>G[k].slice())}; }
function putState(sn){ UNDO_KEYS.forEach((k,n)=>G[k].set(sn.a[n])); G.money=sn.money; selected=-1; lastStroke=null; rebuild(); }
function undo(){
  const sn=undoStack.pop(); if (!sn) return flashHint('Nothing to undo.');
  if (G.tick-sn.t>DAY*2){ undoStack.length=0; redoStack.length=0; return flashHint('Too late to undo: more than 2 days have passed.'); }
  G.flags.undone=1; redoStack.push(takeState()); putState(sn); sfx('undo'); haptic();
  setInfo('<b>Undone.</b> '+(undoStack.length?undoStack.length+' more step'+(undoStack.length===1?'':'s')+' can be undone. ':'')+'Redo brings it back.'); updateHud();
}
function redo(){
  const sn=redoStack.pop(); if (!sn) return flashHint('Nothing to redo.');
  if (G.tick-sn.t>DAY*2){ redoStack.length=0; return flashHint('Too late to redo: more than 2 days have passed.'); }
  G.flags.redone=1; undoStack.push(takeState()); putState(sn); sfx('undo'); haptic();
  setInfo('<b>Redone.</b>'); updateHud();
}

// Bring a step's pulsing cells into view once, if they are off screen or hidden under the step card.
function showCells(cells){
  const C=G.C, sr=stageEl.getBoundingClientRect(), er=$('step').getBoundingClientRect();
  const top=Math.max(0, er.bottom-sr.top)+8, bot=ch-120;
  const sx=i=>view.ox+(i%C+.5)*view.cs, sy=i=>view.oy+(((i/C)|0)+.5)*view.cs;
  if (cells.some(i=>{ const x=sx(i), y=sy(i); return x>=0 && x<=cw && y>=top && y<=bot; })) return;
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for (const i of cells){ const x=i%C, y=(i/C)|0; x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); }
  view.ox=cw/2-((x0+x1)/2+.5)*view.cs; view.oy=top+(bot-top)*0.35-((y0+y1)/2+.5)*view.cs; clampView(); frameDirty=true;
}
