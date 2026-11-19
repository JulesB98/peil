/* Playtest log (opt-in, Menu > Playtest log). Records what the player does and how the game state moves, on this device only.
   Nothing is sent anywhere; "Export playtest log" saves a JSON file that can be shared by hand. Event rows: [ms, type, ...data].
   Types: u undo/redo, s session start, snap state sample, t tool chosen, a build attempt (ok/fail), i inspect, sp speed, p peil nudge, st lesson step,
   n note (tag), w win, l lose, h tab hidden/visible, e script error. */
const PT_BUILD = 'peil-v54', PT_KEY = 'peil_playtest', PT_MAX = 6000;
const PT = { ev: lsGet(PT_KEY) || [], t0: Date.now(), last: 0, timer: 0, dirty: 0 };
function ptOn(){ return !!SET.playtest; }
function ptLog(type, ...d){
  if (!ptOn()) return; const row=[Date.now()-PT.t0, type, ...d]; PT.ev.push(row); if (PT.ev.length>PT_MAX) PT.ev.splice(0, PT.ev.length-PT_MAX);
  if (++PT.dirty>=15) ptSave();
}
function ptSave(){ PT.dirty=0; try { localStorage.setItem(PT_KEY, JSON.stringify(PT.ev)); } catch(e){ PT.ev.splice(0, Math.floor(PT.ev.length/2)); } }
function ptState(){ const g=G; if (!g || !g.m) return null; return [Math.round(g.tick/DAY), speed, Math.round(g.money), +g.m.dry.toFixed(2), g.m.farms, +(g.m.crop||1).toFixed(2), g.m.openings, g.pumps.length, g.pumps.filter(p=>g.pumpState[p]===0).length, g.stats.breaches]; }
function ptWrap(name, make){ const f=window[name]; if (typeof f!=='function' || f._pt) return; const w=make(f); w._pt=1; window[name]=w; }
function ptInstall(){
  ptWrap('startScenario', f=>function(id, cont){ ptSession(id, cont); return f.apply(this, arguments); });
  ptWrap('selectTool', f=>function(id){ ptLog('t', id); return f.apply(this, arguments); });
  ptWrap('applyTool', f=>function(id, i){ const r=f.apply(this, arguments); ptLog('a', id, i, r===true?1:0); return r; });
  ptWrap('commitStroke', f=>function(id, cells){ const r=f.apply(this, arguments); ptLog('a', id, cells[0], r && r.built>0 ? 1 : 0, cells.length, r ? r.built : 0); return r; });
  ptWrap('undo', f=>function(){ ptLog('u', 0); return f.apply(this, arguments); });
  ptWrap('redo', f=>function(){ ptLog('u', 1); return f.apply(this, arguments); });
  ptWrap('inspect', f=>function(i, quiet){ if (!quiet) ptLog('i', i, G && G.struct ? G.struct[i] : -1); return f.apply(this, arguments); });
  ptWrap('setSpeed', f=>function(n){ ptLog('sp', n); return f.apply(this, arguments); });
  ptWrap('nudgePeil', f=>function(p, dir){ const r=f.apply(this, arguments); ptLog('p', p, dir, +(G.peil[p]).toFixed(2)); return r; });
  ptWrap('showWin', f=>function(){ ptLog('w', ptState()); ptSave(); return f.apply(this, arguments); });
  ptWrap('showLose', f=>function(){ ptLog('l', 'houses', ptState()); ptSave(); return f.apply(this, arguments); });
  ptWrap('showLate', f=>function(){ ptLog('l', 'late', ptState()); ptSave(); return f.apply(this, arguments); });
}
function ptSession(id, cont){
  const sc=SCENARIOS.find(s=>s.id===id)||{}; ptLog('s', id, sc.rnd||0, sc.diff||0, cont?1:0, PT_BUILD, innerWidth+'x'+innerHeight, isDesk()?'desktop':'phone', navigator.userAgent.slice(0,80));
}
// one state sample every 10 s while a game is open; a step change is logged when it happens
function ptTick(){
  if (!ptOn() || !G || $('menu') && !$('menu').classList.contains('hide')) return;
  const s=ptState(); if (s) ptLog('snap', ...s);
  if (G.sc && G.sc.steps && G.sc.steps.length && G.step!==ptTick.step){ ptTick.step=G.step; ptLog('st', G.step); }
}
function ptNoteUI(){
  const was=speed; if (speed>0) setSpeed(0);
  const tags=[['confusing','Confusing'],['boring','Boring'],['easy','Too easy'],['hard','Too hard'],['unfair','Unfair'],['fun','Fun'],['bug','Bug / looks wrong']];
  modal(`<h2>Note</h2><p>What is it right now?</p><div class="ptchips">${tags.map(([k,l])=>`<button class="btn" onclick="ptNote('${k}',${was})">${l}</button>`).join('')}</div><button class="btn" onclick="closeModal();if(${was})setSpeed(${was})">Cancel</button>`);
}
function ptNote(tag, was){ ptLog('n', tag, ptState()); ptSave(); closeModal(); if (was) setSpeed(was); }
function ptButton(){
  let b=$('ptBtn'); if (!b){ b=document.createElement('button'); b.id='ptBtn'; b.className='ib'; b.textContent='✎ Note'; b.setAttribute('aria-label','Add a playtest note'); b.onclick=ptNoteUI; document.body.appendChild(b); }
  b.classList.toggle('hide', !ptOn() || !G || ($('menu') && !$('menu').classList.contains('hide')));
}
function ptExport(){
  ptSave(); const o={peil_playtest:1, build:PT_BUILD, exported:new Date().toISOString(), events:PT.ev}, text=JSON.stringify(o), name='peil-playtest-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.json', file=new File([text], name, {type:'application/json'});
  if (navigator.canShare && navigator.canShare({files:[file]})) navigator.share({files:[file], title:'Peil playtest log'}).catch(()=>{});
  else { const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); }
}
function ptClear(){ PT.ev.length=0; try { localStorage.removeItem(PT_KEY); } catch(e){} }
ptInstall();
setInterval(()=>{ ptTick(); ptButton(); }, 10000/ (window.PT_FAST||1));
setInterval(ptButton, 1000);
document.addEventListener('visibilitychange', ()=>{ ptLog('h', document.hidden?1:0); if (document.hidden) ptSave(); });
window.addEventListener('pagehide', ptSave);
window.addEventListener('error', e=>ptLog('e', String(e.message).slice(0,120)));
