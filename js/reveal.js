"use strict";
/* ===== REVEAL =====
   The first lesson starts with almost nothing on screen. A control appears on the step that needs it, and then stays.
   Every other chapter shows everything. REVEAL_AT lists the lesson step (index) that unlocks each control. */
const REVEAL_AT = {
  zoom:1,            // + and − buttons
  zoomMore:8,        // whole map, heights view
  gauge:7, log:5, section:8, chips:7, info:2,
  undo:5, remove:9, play:7,
  tool:{dike:3, mill:6, canal:8, road:9, farm:10, house:10}
};
function revealStep(){
  const g=G; if (!g || !g.sc.tutorial) return 99;
  const n=(g.sc.steps||[]).length; return g.step>=n ? 99 : g.step;
}
function applyReveal(){
  if (!G) return; const s=revealStep(), R=REVEAL_AT, rv=(e,hide)=>{ const was=e.classList.contains('rvh'); e.classList.toggle('rvh', hide); if (was && !hide && !REDUCED){ e.classList.remove('rvnew'); void e.offsetWidth; e.classList.add('rvnew'); setTimeout(()=>e.classList.remove('rvnew'),450); } }, show=(id,at)=>{ const e=$(id); if (e) rv(e, s<at); };
  show('zIn',R.zoom); show('zOut',R.zoom); show('zFit',R.zoomMore); show('zView',R.zoomMore);
  show('gaugeBtn',R.gauge); show('bLog',R.log); show('chips',R.chips); show('info',R.info);
  show('section',R.section); show('bUndo',R.undo); show('bRedo',R.undo); show('bRemove',R.remove); show('bPlay',R.play); show('bSpeed',R.play);
  for (const b of $('toolScroll').children) rv(b, s < (R.tool[b.dataset.t]||0));
  document.documentElement.classList.toggle('lesson0', s<99);
}
