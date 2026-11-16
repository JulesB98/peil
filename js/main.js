"use strict";
/* ===== LOOP & WIRING ===== */
let lastT=performance.now(), acc=0, hudT=0, saveT=0, idleT=0;
function frame(now){
  const dt=Math.min(0.25,(now-lastT)/1000); lastT=now;
  if (G && FILM){ filmFrame(dt); render(now); requestAnimationFrame(frame); return; }
  if (G){
    let ticked=0;
    if (speed>0){ acc+=dt*SPEEDS[speed]; while (acc>=1 && ticked<80){ tick(); acc-=1; ticked++; } if (ticked>=80) acc=0; }
    if (ticked){ baseStale=true; frameDirty=true; }   // the map base repaints at most every PAINT_MS while time runs
    inputFrame(dt);
    // Draw only when something changed; while paused, animations tick over at a low rate to spare the battery.
    idleT+=dt;
    if (frameDirty || speed>0 || (idleT>0.066 && hasIdleAnim())){ frameDirty=false; idleT=0; render(now); }
    hudT+=dt; if (hudT>0.25){ hudT=0; updateHud(); audioFrame(); }
    saveT+=dt; if (saveT>15){ saveT=0; save(); }
  }
  requestAnimationFrame(frame);
}

// buttons
$('bMenu').innerHTML=svg('menu'); $('bLog').insertAdjacentHTML('afterbegin', svg('mail')); $('bLogClose').innerHTML=svg('close');
$('gaugeBtn').onclick=()=>{ gaugeOpen=!gaugeOpen; $('gaugeBtn').setAttribute('aria-expanded', gaugeOpen); drawGauge(); };
$('zIn').innerHTML=svg('plus'); $('zOut').innerHTML=svg('minus'); $('zFit').innerHTML=svg('fit'); $('zView').innerHTML=svg('view');
document.querySelector('.logo').onclick=()=>{ if (filmAllowed()) playOpening(()=>{}); };   // tap the name to see the opening again
$('bMenu').onclick=()=>{ sfx('tap'); showMenu(); };
$('bLog').onclick=()=>{ sfx('tap'); openLog(); }; $('step').onclick=openLog; $('bLogClose').onclick=()=>$('log').classList.add('hide');
$('bPlay').onclick=()=>{ initAudio(); sfx('tap'); haptic(); setSpeed(speed>0?0:lastSpeed); pulseTool(((G.sc.steps||[])[G.step]||{}).tool); };
$('bSpeed').onclick=()=>{ initAudio(); sfx('tap'); haptic(); const n=lastSpeed%3+1; lastSpeed=n; setSpeed(speed>0?n:0); };
$('bUndo').onclick=()=>{ initAudio(); undo(); };
$('bRedo').onclick=()=>{ initAudio(); redo(); };
$('bRemove').onclick=()=>{ initAudio(); sfx('tap'); haptic(); selectTool(tool==='remove'?'look':'remove'); };
$('zIn').onclick=()=>zoomAt(cw/2,ch/2,1.5); $('zOut').onclick=()=>zoomAt(cw/2,ch/2,1/1.5);
$('zFit').onclick=()=>{ if (Math.abs(view.cs-view.fit)<0.01) homeView(); else wholeView(); };
$('zView').onclick=()=>{ viewMode=1-viewMode; $('zView').classList.toggle('on', viewMode===1); $('legend').classList.toggle('hide', viewMode!==1); markDirty(); };

// desktop: keyboard shortcuts (1-9 tools, Space play, Z undo, Y redo, X remove, + - zoom, F fit, Esc look)
const hid=id=>$(id).classList.contains('rvh');   // controls the first lesson has not revealed yet do not answer their shortcut either
document.addEventListener('keydown', e=>{
  if (!G || FILM || !isDesk() || e.metaKey || e.altKey) return;
  const blocked = !$('menu').classList.contains('hide') || !$('modalwrap').classList.contains('hide');
  const k=e.key.toLowerCase();
  if (k==='escape'){ if (!$('log').classList.contains('hide')) $('log').classList.add('hide'); else if (!blocked) selectTool('look'); return; }
  if (blocked || !$('log').classList.contains('hide')) return;
  const tb=$('toolScroll').children;
  if (/^[1-9]$/.test(k)){ const b=tb[+k-1]; if (b && !b.classList.contains('rvh')){ sfx('tap'); selectTool(b.dataset.t); } }
  else if (k===' '){ e.preventDefault(); if (!hid('bPlay')) $('bPlay').click(); }
  else if (k==='z' && !e.shiftKey){ e.preventDefault(); if (!hid('bUndo')) undo(); }
  else if (k==='y' || (k==='z' && e.shiftKey)){ e.preventDefault(); if (!hid('bRedo')) redo(); }
  else if (k==='x'){ if (!hid('bRemove')) $('bRemove').click(); }
  else if (k==='+' || k==='='){ if (!hid('zIn')) $('zIn').click(); } else if (k==='-'){ if (!hid('zOut')) $('zOut').click(); }
  else if (k==='f'){ if (!hid('zFit')) $('zFit').click(); }
  else if (k==='s'){ $('bSpeed').click(); }
});

// first run: ask how the game is being played. Touch devices default to phone without asking.
function chooseMode(){
  modal(`<h2>How are you playing?</h2><p>This sets the layout. You can change it later in the menu.</p>
    <button class="btn pri" onclick="setMode('desktop')">Desktop<br><small>mouse and keyboard</small></button>
    <button class="btn" onclick="setMode('phone')">Phone<br><small>touch</small></button>`);
}
function setMode(m){ SET.mode=m; saveSettings(); applyMode(); closeModal(); if (G) buildToolbar(); resize(); requestRender(); if (firstRun()) openFirst(); else showMenu(); }
if (!SET.mode && IS_TOUCH){ SET.mode='phone'; saveSettings(); }
applyMode();

// keep the canvas in step with its box, whatever makes the box change
if (window.ResizeObserver) new ResizeObserver(resize).observe(stageEl);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
document.addEventListener('visibilitychange', ()=>{ if (document.hidden) save(); else { lastT=performance.now(); requestRender(); } });
window.addEventListener('pagehide', save);

// offline support + auto-update
if ('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  const hadController = !!navigator.serviceWorker.controller; let reloaded=false;
  navigator.serviceWorker.register('sw.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if (!hadController || reloaded) return; reloaded=true; if (G) save(); location.reload(); });
}

// test and debug hook
window.PEIL = { get G(){return G;}, get view(){return view;}, get tool(){return tool;}, get gesture(){return gesture;}, get stage(){return {cw, ch, dpr};},
  tick, startScenario, setMode, applyTool, selectTool, setSpeed, metrics, goalState, rebuild, save, load, cellAt, resize };
resize(); if (firstRun() && SET.mode){ openFirst(); } else { showMenu(); if (!SET.mode) chooseMode(); } requestAnimationFrame(frame);
