"use strict";
/* ===== INPUT =====
   Gesture model (one rule per finger count, so gestures never fight):
   - Look tool:   one finger drags the map, a tap inspects.
   - Build tools: one finger draws a preview; lifting the finger builds it. Nothing is built before that.
   - Two fingers: always pan and zoom. A second finger cancels a preview.
   - Dragging a preview to the screen edge scrolls the map.
   Coordinates always come from clientX/Y against a freshly read canvas rect, scaled to the canvas's own
   size, so a touch maps to the cell that is drawn under it even if the layout has just changed. */
const ptrs=new Map(); let gesture=null;
const TAP_SLOP=10;

function local(e){ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*(cw/(r.width||1)), (e.clientY-r.top)*(ch/(r.height||1))]; }
function cellAt(px,py){ const x=Math.floor((px-view.ox)/view.cs), y=Math.floor((py-view.oy)/view.cs); if (x<0||y<0||x>=G.C||y>=G.R) return -1; return y*G.C+x; }
function lineCells(a, b){ const C=G.C; let x0=a%C, y0=(a/C)|0; const x1=b%C, y1=(b/C)|0; const out=[]; const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let err=dx+dy;
  while (true){ out.push(y0*C+x0); if (x0===x1&&y0===y1) break; const e2=2*err; if (e2>=dy){ err+=dy; x0+=sx; if (e2<=dx) out.push(y0*C+x0); } if (e2<=dx){ err+=dx; y0+=sy; } } return out; }

/* ----- build preview ----- */
function startBuild(x, y, touch){
  const c=cellAt(x,y); selected=-1; lastStroke=null;
  gesture={type:'build', cells:[], ok:[], set:new Set(), last:-1, x, y, sx:x, sy:y, touch, cost:0, msg:''};
  if (c>=0) extendBuild(c);
  previewInfo();
}
function extendBuild(c){
  const b=gesture; if (c<0 || c===b.last) return;
  if (TOOL[tool].paint){ for (const cc of (b.last>=0 ? lineCells(b.last,c) : [c])) if (!b.set.has(cc)){ b.set.add(cc); b.cells.push(cc); } }
  else { b.cells=[c]; }
  b.last=c;
  // what would each cell do, and what would the whole stroke cost with the money we have
  b.ok=[]; b.cost=0; b.msg=''; let left=G.money;
  for (const i of b.cells){ const r=toolAt(tool, i, false); let ok=r.ok;
    if (r.cost>0 && r.cost>left && !r.poor){ ok=false; if (!b.msg) b.msg='Not enough money for all of it.'; }
    if (ok){ b.cost+=r.cost||0; left-=r.cost||0; } else if (r.msg && !b.msg) b.msg=r.msg;
    b.ok.push(ok); }
}
function previewInfo(){
  const g=G, b=gesture; if (!b || b.type!=='build') return;
  const T=TOOL[tool], n=b.ok.filter(Boolean).length, c=b.cells[b.cells.length-1];
  if (!b.cells.length){ setInfo(`<b>${T.label}</b> · slide onto the map`); return; }
  if (PUMP_TOOLS[tool] && b.ok[0]){
    const pr=bestPair(c), lift=surf(pr[1])-surf(pr[0]), mx=PUMP[PUMP_TOOLS[tool]].lift;
    setInfo(`<b>${T.label}</b> · ${sideName(pr[0])} → ${sideName(pr[1])} · lift ${Math.max(0,lift).toFixed(1)} of ${mx} m${lift>mx?' · too high for it':''} · lift finger to build`, lift>mx); return;
  }
  if (!n){ setInfo(`<b>${T.label}</b> · ${b.msg||'Nothing to do here.'}`, true); return; }
  const cost = b.cost>0 ? ' · '+fmtMoney(b.cost) : b.cost<0 ? ' · refund '+fmtMoney(-b.cost) : '';
  setInfo(`<b>${T.label}</b> · ${T.paint?n+' cell'+(n>1?'s':''):'here'}${cost} · lift finger to ${tool==='remove'?'remove':'build'}${b.msg&&n<b.cells.length?' · '+b.msg:''}`);
}
function cancelBuild(){ if (gesture && gesture.type==='build'){ gesture=null; showToolHint(); requestRender(); } }

// Build a finished stroke (also used by the "Again" button).
function doStroke(id, cells){
  const r=commitStroke(id, cells), T=TOOL[id];
  if (!r.built){ flashHint(r.msg||'Nothing to do here.'); return r; }
  sfx(id==='remove'?'remove':T.paint?id:'place'); haptic(T.paint?undefined:'heavy');
  if (id==='remove') G.flags.removed=1;
  const C=G.C; cells.forEach((c,k)=>{ if (k<60) addPop(c, k*12); });
  if (PUMP_TOOLS[id]){ selected=cells[0]; inspect(selected); }
  else if ((id==='farm'||id==='house') && !connected(cells[0])) setInfo(`<b>${T.label}</b> built, but it has no road to town yet.`, true);
  else {
    lastStroke={id, cells:cells.slice()};
    const again = (id==='dike'||id==='canal') ? [{label:'Again', fn:()=>doStroke(id, lastStroke.cells)}] : [];
    const what = id==='remove' ? 'removed' : id==='dike' ? 'built or raised' : id==='canal' ? 'dug' : 'built';
    setInfo(`<b>${T.label}</b> · ${r.built} ${what}${r.cost>0?' · '+fmtMoney(r.cost):r.cost<0?' · refund '+fmtMoney(-r.cost):''}${r.msg&&r.built<cells.length?' · '+r.msg:''}`, false, again);
  }
  updateHud(); requestRender(); return r;
}

/* ----- pointers ----- */
cv.addEventListener('pointerdown', e=>{
  if (!G || FILM) return; e.preventDefault(); initAudio();
  try { cv.setPointerCapture(e.pointerId); } catch(_){}
  const [x,y]=local(e); ptrs.set(e.pointerId,{x,y,sx:x,sy:y});
  dbg={x, y, cell:cellAt(x,y)}; requestRender();
  if (ptrs.size===2){ if (gesture && gesture.type==='build') showToolHint();
    const [a,b]=[...ptrs.values()]; gesture={type:'pinch', d:Math.hypot(a.x-b.x,a.y-b.y)||1, mx:(a.x+b.x)/2, my:(a.y+b.y)/2}; return; }
  if (ptrs.size>2) return;
  if (e.pointerType==='mouse' && e.button!==0){ gesture={type:'pan', moved:false, forced:true}; return; }   // right or middle button: pan with any tool
  if (tool==='look' && selMode){ gesture={type:'select', moved:false, last:-1, start:cellAt(x,y)}; return; }
  if (tool==='look'){ gesture={type:'pan', moved:false}; return; }
  startBuild(x, y, e.pointerType==='touch');
});
cv.addEventListener('pointermove', e=>{
  if (e.pointerType==='mouse' && isDesk()){ const [hx,hy]=local(e), c=cellAt(hx,hy); if (c!==hoverCell){ hoverCell=c; requestRender(); } }
  const p=ptrs.get(e.pointerId); if (!p || !gesture) return; const [x,y]=local(e); const px0=p.x, py0=p.y; p.x=x; p.y=y;
  if (SET.debug) dbg={x, y, cell:cellAt(x,y)};
  requestRender();
  if (gesture.type==='pinch'){
    if (ptrs.size<2) return;
    const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y)||1, mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const ns=clamp(view.cs*d/gesture.d, minCs(), maxCs()), k=ns/view.cs;
    view.ox = mx - (gesture.mx - view.ox)*k; view.oy = my - (gesture.my - view.oy)*k; view.cs=ns;
    G.flags.panned=1; if (Math.abs(d/gesture.d-1)>0.01) G.flags.zoomed=1;
    gesture.d=d; gesture.mx=mx; gesture.my=my; clampView(); return;
  }
  if (gesture.type==='select'){
    if (!gesture.moved){ if (Math.hypot(x-p.sx,y-p.sy)<=TAP_SLOP) return; gesture.moved=true; if (gesture.start>=0) multiAdd(gesture.start); }
    const n=Math.max(1,Math.ceil(Math.hypot(x-px0,y-py0)/Math.max(4,view.cs/3)));
    for (let k=1;k<=n;k++){ const c=cellAt(px0+(x-px0)*k/n, py0+(y-py0)*k/n); if (c>=0 && c!==gesture.last){ gesture.last=c; multiAdd(c); } }
    inspectMulti(); return; }
  if (gesture.type==='build'){ gesture.x=x; gesture.y=y; const c=cellAt(x,y); if (c>=0 && c!==gesture.last){ extendBuild(c); previewInfo(); } return; }
  if (gesture.type==='pan'){
    // once the finger has clearly moved, catch up with the whole distance so the map stays under the finger
    if (!gesture.moved){ if (Math.hypot(x-p.sx,y-p.sy)<=TAP_SLOP) return; gesture.moved=true; G.flags.panned=1; view.ox+=x-p.sx; view.oy+=y-p.sy; } else { view.ox+=x-px0; view.oy+=y-py0; }
    clampView(); }
});
function endPtr(e){
  const p=ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
  try { cv.releasePointerCapture(e.pointerId); } catch(_){}
  requestRender();
  if (e.type==='pointerup' && gesture && ptrs.size===0){
    if (gesture.type==='pan' && !gesture.moved && gesture.forced){ /* a right-click without a drag does nothing */ }
    else if (gesture.type==='select'){ if (!gesture.moved){ const c=cellAt(p.x,p.y); if (c>=0 && !multiAdd(c, true)) flashHint('Pick dikes, or canals, not both at once.'); else { if (c>=0) sfx('tap'); inspectMulti(); } } else inspectMulti(); }
    else if (gesture.type==='pan' && !gesture.moved){ const c=cellAt(p.x,p.y); if (c>=0){ selected=c; sfx('tap'); inspect(c); } else { selected=-1; showToolHint(); } }
    else if (gesture.type==='build'){ const b=gesture; gesture=null; if (b.cells.length) doStroke(tool, b.cells); else showToolHint(); }
  } else if (e.type==='pointercancel' && gesture && gesture.type==='build'){ gesture=null; showToolHint(); }
  if (ptrs.size===0) gesture=null;
  else if (gesture && gesture.type==='pinch' && ptrs.size===1){ gesture={type:'pan', moved:true}; const q=[...ptrs.values()][0]; q.sx=q.x; q.sy=q.y; }
}
cv.addEventListener('pointerleave', e=>{ if (hoverCell>=0){ hoverCell=-1; requestRender(); } });
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('lostpointercapture', e=>{ if (ptrs.has(e.pointerId)) endPtr({type:'pointercancel', pointerId:e.pointerId}); });
cv.addEventListener('wheel', e=>{ e.preventDefault(); if (FILM) return; const [mx,my]=local(e); zoomAt(mx,my,e.deltaY<0?1.12:0.89); }, {passive:false});
// iOS: stop the page from scrolling, zooming or showing the text loupe while a finger is on the map
cv.addEventListener('touchstart', e=>e.preventDefault(), {passive:false});
cv.addEventListener('contextmenu', e=>e.preventDefault());
for (const ev of ['gesturestart','gesturechange','gestureend']) document.addEventListener(ev, e=>e.preventDefault());
document.addEventListener('dblclick', e=>e.preventDefault());

// Called every frame: scroll the map when a drawing finger rests near an edge that has more map behind it.
function inputFrame(dt){
  const b=gesture; if (!b || b.type!=='build' || Math.hypot(b.x-b.sx, b.y-b.sy)<24) return;
  const W=G.C*view.cs, H=G.R*view.cs, m=28, topM=30, botM=84; let vx=0, vy=0;
  if (b.x<m && view.ox<0) vx=(m-b.x)/m; else if (b.x>cw-m && view.ox+W>cw) vx=-(b.x-(cw-m))/m;
  if (b.y<topM && view.oy<56) vy=(topM-b.y)/topM; else if (b.y>ch-botM && view.oy+H>ch-70) vy=-(b.y-(ch-botM))/botM;
  if (!vx && !vy) return;
  const ox=view.ox, oy=view.oy; view.ox+=clamp(vx,-1,1)*380*dt; view.oy+=clamp(vy,-1,1)*380*dt; clampView();
  if (view.ox===ox && view.oy===oy) return;
  const c=cellAt(b.x,b.y); if (c>=0 && c!==b.last){ extendBuild(c); previewInfo(); }
  requestRender();
}
