"use strict";
/* ===== RENDER =====
   Layers, bottom to top: cell colours (one pixel per cell, scaled up) → field texture, shorelines, ripples →
   canals → dikes → roads → pump arrows → buildings → freight → warning marks → effects → build preview →
   tutorial focus → weather → loupe and touch debug.
   All drawing is in CSS pixels; the canvas buffer is cw*dpr by ch*dpr and always matches the stage box (see resize). */
const cv=$('cv'), ctx=cv.getContext('2d'), stageEl=$('stage');
const off=document.createElement('canvas'), octx=off.getContext('2d');
let selSet=null, hoverCell=-1;   // hoverCell: the cell under the mouse (desktop mode)   // cells of the dike / canal stretch shown in the info card
let img=null, wet=null, view={cs:10, ox:0, oy:0, fit:10}, viewMode=0, selected=-1, dpr=1, cw=0, ch=0;
let baseDirty=true, frameDirty=true, lastRender=0;
const pops=[], floaters=[], sprites=[];
let dbg=null;                                  // last touch, for the debug overlay

function markDirty(){ baseDirty=true; frameDirty=true; }
function requestRender(){ frameDirty=true; }

/* ----- view ----- */
const VIEW_PAD = {t:130, b:190, s:80};         // how far the map may be dragged out from under the floating cards
const minCs = () => view.fit*0.9, maxCs = () => Math.max(view.fit*6, 48);
// Re-derive the canvas from the real stage box. Called by a ResizeObserver, so it also catches
// layout changes that are not window resizes (the cause of the old "touch lands a row too high" bug).
function resize(){
  const r=stageEl.getBoundingClientRect(); if (r.width<2 || r.height<2) return;
  const nd=Math.min(window.devicePixelRatio||1, 3), bw=Math.round(r.width*nd), bh=Math.round(r.height*nd);
  if (bw===cv.width && bh===cv.height && Math.abs(r.width-cw)<0.01 && Math.abs(r.height-ch)<0.01) return;
  const had = G && cw>0; let mx=0, my=0; if (had){ mx=(cw/2-view.ox)/view.cs; my=(ch/2-view.oy)/view.cs; }
  cw=r.width; ch=r.height; dpr=nd; cv.width=bw; cv.height=bh;
  if (G){ view.fit=Math.min(cw/G.C, ch/G.R);
    if (had){ view.cs=clamp(view.cs, minCs(), maxCs()); view.ox=cw/2-mx*view.cs; view.oy=ch/2-my*view.cs; clampView(); } else homeView(); }
  frameDirty=true;
}
// Start view: the map fills the width, centred on the lake.
function homeView(){
  view.fit=Math.min(cw/G.C, ch/G.R); view.cs=Math.max(view.fit, cw/G.C);
  const c=homeCell(G), x=c%G.C, y=(c/G.C)|0; view.ox=cw/2-(x+.5)*view.cs; view.oy=ch/2-(y+.5)*view.cs; clampView(); frameDirty=true;
}
function wholeView(){ view.cs=view.fit; view.ox=(cw-G.C*view.cs)/2; view.oy=(ch-G.R*view.cs)/2; clampView(); frameDirty=true; }
function clampView(){
  const W=G.C*view.cs, H=G.R*view.cs;
  // there is always some slack, even when the whole map fits, so anything can be pulled out from under a card
  const cx=(cw-W)/2, cy=(ch-H)/2;
  view.ox = W<=cw ? clamp(view.ox, cx-VIEW_PAD.s, cx+VIEW_PAD.s) : clamp(view.ox, cw-W-VIEW_PAD.s, VIEW_PAD.s);
  view.oy = H<=ch ? clamp(view.oy, cy-VIEW_PAD.b, cy+VIEW_PAD.t) : clamp(view.oy, ch-H-VIEW_PAD.b, VIEW_PAD.t);
}
function zoomAt(mx,my,f){ if (G) G.flags.zoomed=1;const ns=clamp(view.cs*f, minCs(), maxCs()), k=ns/view.cs; view.ox=mx-(mx-view.ox)*k; view.oy=my-(my-view.oy)*k; view.cs=ns; clampView(); frameDirty=true; }

/* ----- cell colours ----- */
const COL = {
  shallow:[168,204,208], deep:[52,98,128], sea:[60,100,128], seaDeep:[42,74,100], boezem:[84,128,156],
  mud:[178,158,120], reed:[150,168,110], meadow:[188,204,136], land:[216,211,189], landHi:[236,232,214],
  dikeLo:[170,178,130], dikeHi:[124,138,92], high:[226,214,178], low:[80,120,160], peak:[120,100,74]
};
const WINTER=[.24,.2,.08,0,0,0,0,0,0,0,.08,.2], AUTUMN=[0,0,0,0,0,0,0,0,.07,.13,.1,.03];
function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

function paintCells(){
  const g=G, {C,R,N}=g;
  if (!img || off.width!==C || off.height!==R){ off.width=C; off.height=R; img=octx.createImageData(C,R); wet=new Uint8Array(N); }
  const data=img.data, mo=dateAt(g,g.tick).getUTCMonth(), wA=WINTER[mo], aA=AUTUMN[mo];
  const gh=(j,self)=> g.kind[j]>0 ? self : g.ground[j];
  for (let i=0;i<N;i++){
    const d=g.depth[i], k=g.kind[i], lvl=g.canal[i], x=i%C, y=(i/C)|0;
    const inBank = lvl>0 && d<=lvl+0.03;                       // canal water that stays inside its banks
    const w = k>0 || (d>0.03 && !inBank && g.dike[i]===0); wet[i]=w?1:0;
    let c;
    if (viewMode===1){
      const gr=g.ground[i]+g.dike[i]; c = gr<0 ? mix(COL.high, COL.low, clamp(-gr/5,0,1)) : mix(COL.high, COL.peak, clamp(gr/4,0,1));
      if (d>0.03) c=mix(c,[60,110,160],0.22);
    } else if (k===2){ c=mix(COL.sea, COL.seaDeep, clamp((d-5)/2,0,1)); }
    else if (g.dike[i]>0){ c=mix(COL.dikeLo, COL.dikeHi, clamp(g.dike[i]/4,0,1)); if (d>0.03) c=mix(c,COL.shallow,0.6); }
    else if (w){ c=mix(COL.shallow, COL.deep, clamp(d/4,0,1)); if (k===1) c=mix(c,COL.boezem,0.3); }
    else {
      if (g.polder[i]){
        const r=g.ripe[i]; c = r<0.5 ? mix(COL.mud, COL.reed, r*2) : mix(COL.reed, COL.meadow, (r-0.5)*2);
        if (r>0.5 && hash2(x>>2, y, 5)>0.5) c=mix(c,[250,250,225],0.07);      // parcel strips
        if (d>0.005 && !lvl) c=mix(c,COL.shallow,0.35);
        if (g.soil[i]===1) c=mix(c,[120,100,80],0.12); else if (g.soil[i]===2) c=mix(c,[230,215,170],0.15);
      } else {
        c=mix(COL.land, COL.landHi, clamp(g.ground[i],0,1)*0.4);
        if (g.soil[i]===1) c=mix(c,[170,160,130],0.15);
      }
      if (wA) c=mix(c,[236,236,230],wA); if (aA) c=mix(c,[206,172,112],aA);
      // soft relief, lit from the top left
      const self=g.ground[i], sl=(gh(x>0?i-1:i,self)-gh(x<C-1?i+1:i,self)) + (gh(y>0?i-C:i,self)-gh(y<R-1?i+C:i,self));
      const sh=clamp(sl*0.22,-0.1,0.12); c = sh>0 ? mix(c,[70,58,36],sh) : mix(c,[255,255,246],-sh);
    }
    const o=i*4; data[o]=c[0]; data[o+1]=c[1]; data[o+2]=c[2]; data[o+3]=255;
  }
  octx.putImageData(img,0,0);
}

/* ----- frame ----- */
function render(now){
  if (!G) return;
  const g=G, {C,R}=g, cs=view.cs, T=REDUCED?0:now/1000;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // the sky clock runs with game time, so clouds, glints and cows rest while paused
  if (!REDUCED && lastRender) skyT += Math.min(0.1,(now-lastRender)/1000) * (speed>0 ? SPEEDS[speed]/SPEEDS[1] : 0); lastRender=now;
  ctx.fillStyle=isDark()?'#1e1913':'#ddd0aa'; ctx.fillRect(0,0,cw,ch);
  if (viewMode===1){   // Heights view: flat cells, coloured by height
    if (baseDirty){ paintCells(); baseDirty=false; }
    ctx.imageSmoothingEnabled=false; ctx.drawImage(off, view.ox, view.oy, C*cs, R*cs);
  } else {
    if (baseDirty){ landDirty=true; paintMap(); baseDirty=false; } else if ((baseStale && now-mapPainted>PAINT_MS) || landCv.width!==C*MAPK) paintMap();
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='low'; ctx.drawImage(landCv, view.ox, view.oy, C*cs, R*cs); ctx.drawImage(waterCv, view.ox, view.oy, C*cs, R*cs);
  }
  ctx.imageSmoothingEnabled=true;
  const x0=Math.max(0,Math.floor(-view.ox/cs)-1), y0=Math.max(0,Math.floor(-view.oy/cs)-1);
  const x1=Math.min(C,Math.ceil((cw-view.ox)/cs)+1), y1=Math.min(R,Math.ceil((ch-view.oy)/cs)+1);
  const X=(x)=>view.ox+x*cs, Y=(y)=>view.oy+y*cs;
  ctx.lineCap='butt'; ctx.lineJoin='round'; ctx.setLineDash([]);

  // contours every half metre, in Heights view
  if (viewMode===1 && cs>=5){
    ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=1; ctx.beginPath();
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){
      const i=y*C+x; if (g.kind[i]===2 || g.dike[i]>0) continue;
      const b=Math.floor(g.ground[i]/0.5);
      if (x<C-1){ const j=i+1; if (g.kind[j]!==2 && g.dike[j]===0 && Math.floor(g.ground[j]/0.5)!==b){ ctx.moveTo(X(x+1),Y(y)); ctx.lineTo(X(x+1),Y(y+1)); } }
      if (y<R-1){ const j=i+C; if (g.kind[j]!==2 && g.dike[j]===0 && Math.floor(g.ground[j]/0.5)!==b){ ctx.moveTo(X(x),Y(y+1)); ctx.lineTo(X(x+1),Y(y+1)); } }
    }
    ctx.stroke();
  }
  if (viewMode===0) drawGlints(x0,y0,x1,y1,X,Y,cs);
  drawCanals(x0,y0,x1,y1,X,Y,cs);
  drawDikes(x0,y0,x1,y1,X,Y,cs);
  // height / depth markers: a small ink-ringed dot per dike or canal cell once zoomed in, darker = higher / deeper, numbers when close
  if (cs>=12){ const lab = cs>=22, r=lab?cs*0.2:Math.max(1.8,cs*0.1);
    if (lab){ ctx.font='800 '+Math.round(cs*0.3)+'px "Alegreya Sans",system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; }
    const hot = selected>=0 ? selSet : null;                                        // the stretch picked in the info card
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; let v=0, dark=0, txt='';
      if (g.dike[i]>0 && g.kind[i]===0 && !g.struct[i]){ const crest=g.ground[i]+g.dike[i]; dark=clamp((crest-1)/5,0,1); txt=crest.toFixed(1); v=1; }
      else if (g.canal[i] && g.kind[i]===0 && !g.struct[i]){ dark=g.canal[i]/3; txt=g.canal[i]+''; v=2; }
      if (!v) continue; const cx=X(x+.5), cy=Y(y+.5);
      if (hot && hot.has(i)){ ctx.fillStyle='rgba(244,236,216,.9)'; ctx.beginPath(); ctx.arc(cx,cy,r*1.9,0,6.3); ctx.fill(); }
      const c = v===1 ? mix([236,226,196],[60,52,30],dark) : mix([200,222,226],[30,60,72],dark);
      ctx.fillStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; ctx.strokeStyle=INK; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,r,0,6.3); ctx.fill(); ctx.stroke();
      if (lab){ ctx.fillStyle = dark>0.45 ? '#f4ecd8' : INK; ctx.fillText(txt,cx,cy+.5); } }
    ctx.textAlign='start'; ctx.textBaseline='alphabetic'; }
  drawRoads(x0,y0,x1,y1,X,Y,cs);
  if (viewMode===0) drawCows(x0,y0,x1,y1,X,Y,cs);
  // pump arrows sit between the dike and the building graphic (dike → arrow → building); colour and dash say what the pump is doing
  for (const p of g.pumps){ const a=g.pin[p], b=g.pout[p]; if (a<0||b<0) continue;
    const ax=a%C, ay=(a/C)|0, bx=b%C, by=(b/C)|0; if (bx<x0-1||bx>x1||by<y0-1||by>y1) continue;
    const st=g.pumpState[p], run=st===0 && g.pumpFlow[p]>0.001, col= st===0?'#225b78': st===2?'#a8452f': st===3?'#7d5f3a':'#7f8a90';
    let sx=X(ax+.5), sy=Y(ay+.5), ex=X(bx+.5), ey=Y(by+.5), dx=(ex-sx), dy=(ey-sy), L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L;
    let diagN=false;
    { const n=wallNormal(p, ux, uy); if (n){ diagN=true; const pcx=X((p%C)+.5), pcy=Y(((p/C)|0)+.5); ux=n[0]; uy=n[1]; sx=pcx-ux*cs*1.6; sy=pcy-uy*cs*1.6; ex=pcx+ux*cs*1.6; ey=pcy+uy*cs*1.6; L=Math.hypot(ex-sx,ey-sy); } }   // a diagonal dike: draw the arrow straight through it
    ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=Math.max(1.5,cs*0.13);
    if (run){ ctx.setLineDash([cs*.22,cs*.16]); ctx.lineDashOffset=-T*cs*1.6*(speed||0.3); } else if (st!==0) ctx.setLineDash([cs*.1,cs*.14]);
    ctx.beginPath();
    if (diagN){ const mx=(sx+ex)/2, my=(sy+ey)/2, gap=cs*.62; ctx.moveTo(sx+ux*cs*.1, sy+uy*cs*.1); ctx.lineTo(mx-ux*gap, my-uy*gap); ctx.moveTo(mx+ux*gap, my+uy*gap); ctx.lineTo(ex-ux*cs*.3, ey-uy*cs*.3); }   // on a diagonal dike the arrow runs either side of the mill, not over it
    else { ctx.moveTo(sx+ux*cs*.15, sy+uy*cs*.15); ctx.lineTo(ex-ux*cs*.3, ey-uy*cs*.3); }
    ctx.stroke(); ctx.setLineDash([]);
    const hx=ex-ux*cs*.05, hy=ey-uy*cs*.05, w=cs*.3;
    ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(hx-ux*w-uy*w*.7, hy-uy*w+ux*w*.7); ctx.lineTo(hx-ux*w+uy*w*.7, hy-uy*w-ux*w*.7); ctx.closePath(); ctx.fill();
  }
  // buildings
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x, s=g.struct[i]; if (s) drawStruct(s, i, X(x), Y(y), cs, T); }
  // freight
  if (cs>=6){ freightSprites(sprites);
    for (const sp of sprites){ const px=X(sp[0]), py=Y(sp[1]); if (px<-cs||py<-cs||px>cw+cs||py>ch+cs) continue;
      if (sp[2]===3 || sp[2]===4){ const horiz=Math.abs(sp[3]||0)>=Math.abs(sp[4]||0), w=cs*(horiz?.78:.36), h=cs*(horiz?.36:.78);
        ctx.fillStyle='#2b3338'; ctx.fillRect(px-w/2-.8,py-h/2-.8,w+1.6,h+1.6); ctx.fillStyle='#6b5236'; ctx.fillRect(px-w/2,py-h/2,w,h); ctx.fillStyle='#e0bd55'; ctx.fillRect(px-w*.3,py-h*.28,w*.6,h*.56);
        if (sp[2]===4){ ctx.strokeStyle='#a8452f'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(px,py,cs*.62,0,7); ctx.stroke(); } }
      else if (sp[2]===2){ const horiz=Math.abs(sp[3]||0)>=Math.abs(sp[4]||0), w=cs*(horiz?.8:.34), h=cs*(horiz?.34:.8);
        ctx.fillStyle='rgba(255,255,255,.3)'; ctx.fillRect(px-w/2-1,py-h/2-1,w+2,h+2); ctx.fillStyle='#5b4733'; ctx.fillRect(px-w/2,py-h/2,w,h); ctx.fillStyle='#c9a13a'; ctx.fillRect(px-w*.22,py-h*.22,w*.44,h*.44); }
      else { const w=cs*.36, h=cs*.26; ctx.fillStyle='#2b3338'; ctx.fillRect(px-w/2-.8,py-h/2-.8,w+1.6,h+1.6); ctx.fillStyle=sp[2]?'#55504a':'#d9b24a'; ctx.fillRect(px-w/2,py-h/2,w,h); } } }
  // breach rings
  if (g.fx){ g.fx=g.fx.filter(f=>g.tick-f.t<DAY*3); for (const f of g.fx){ const x=f.i%C, y=(f.i/C)|0, a=1-(g.tick-f.t)/(DAY*3); ctx.strokeStyle=`rgba(168,69,47,${a})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(X(x+.5),Y(y+.5), cs*(0.8+0.6*Math.sin(T*5.5)), 0, 7); ctx.stroke(); } }
  // warning marks, by shape as well as colour: ▲ lift too high, ✕ no link to town
  if (cs>=8 && g.net){ for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x, s=g.struct[i]; if (!s || s===S.TOWN || s===S.SLUICE || s===S.LOCK) continue;
      const pump=s<=3, st=pump?g.pumpState[i]:0; const kind = pump ? (st===2?1 : st===3?2 : 0) : (connected(i) || (s===S.FARM && shipLinked(i)) ?0:2); if (!kind) continue;
      const mx=X(x+.86), my=Y(y+.14), r=Math.max(4.5,cs*.24);
      ctx.fillStyle=kind===1?'#a8452f':'#7d5f3a'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.beginPath();
      if (kind===1){ ctx.moveTo(mx,my-r); ctx.lineTo(mx+r,my+r*.8); ctx.lineTo(mx-r,my+r*.8); ctx.closePath(); } else ctx.arc(mx,my,r,0,7);
      ctx.fill(); ctx.stroke();
      if (kind===2){ ctx.beginPath(); ctx.moveTo(mx-r*.4,my-r*.4); ctx.lineTo(mx+r*.4,my+r*.4); ctx.moveTo(mx+r*.4,my-r*.4); ctx.lineTo(mx-r*.4,my+r*.4); ctx.stroke(); } } }
  // build pops and money floaters
  // a new dike is inked first, then the grass fills in along the stroke (DESIGN.md, the signature moment); other builds get a ring
  for (let k=pops.length-1;k>=0;k--){ const p=pops[k], a=(now-p.t)/(REDUCED?1:520); if (a>=1){ pops.splice(k,1); continue; } if (a<0 && REDUCED) continue; const x=p.i%C, y=(p.i/C)|0;
    if (g.dike[p.i]>0 && !REDUCED){ const t=clamp(a,0,1), r=cs*0.36*(1-t*t*(3-2*t)); if (r>0.3){ ctx.fillStyle=INK; ctx.beginPath(); ctx.arc(X(x+.5),Y(y+.5),r,0,7); ctx.fill(); } continue; }
    if (a<0) continue; const e=cs*0.5*(REDUCED?0:a);
    ctx.strokeStyle=`rgba(38,38,31,${0.7*(1-a)})`; ctx.lineWidth=1.5; ctx.strokeRect(X(x)-e,Y(y)-e,cs+2*e,cs+2*e); }
  if (floaters.length){ ctx.font='800 12.5px "Alegreya Sans",system-ui,sans-serif'; ctx.textAlign='center';
    for (let k=floaters.length-1;k>=0;k--){ const f=floaters[k], a=(now-f.t)/1400; if (a>=1){ floaters.splice(k,1); continue; } const x=f.i%C, y=(f.i/C)|0;
      ctx.fillStyle=`rgba(74,99,38,${1-a})`; ctx.fillText(f.text, X(x+.5), Y(y)-6-(REDUCED?0:a*18)); } ctx.textAlign='left'; }
  if (hoverCell>=0 && isDesk() && !(gesture && gesture.type==='build')){ const hx=hoverCell%C, hy=(hoverCell/C)|0; ctx.strokeStyle='rgba(34,48,58,.55)'; ctx.lineWidth=1.5; ctx.strokeRect(X(hx)+.75,Y(hy)+.75,cs-1.5,cs-1.5); }
  // build preview: dark cells will be built, red crossed cells will not
  if (gesture && gesture.type==='build' && gesture.cells.length){
    ctx.lineWidth=1.5;
    for (let k=0;k<gesture.cells.length;k++){ const i=gesture.cells[k], x=i%C, y=(i/C)|0, ok=gesture.ok[k];
      ctx.fillStyle=ok?'rgba(34,48,58,.3)':'rgba(168,69,47,.25)'; ctx.strokeStyle=ok?'#22303a':'#a8452f';
      ctx.fillRect(X(x),Y(y),cs,cs); ctx.strokeRect(X(x)+.5,Y(y)+.5,cs-1,cs-1);
      if (!ok){ ctx.beginPath(); ctx.moveTo(X(x)+2,Y(y)+2); ctx.lineTo(X(x+1)-2,Y(y+1)-2); ctx.moveTo(X(x+1)-2,Y(y)+2); ctx.lineTo(X(x)+2,Y(y+1)-2); ctx.stroke(); } }
    const c=gesture.cells[gesture.cells.length-1];
    if (PUMP_TOOLS[tool] && g.dike[c]>0 && !g.struct[c]){ const pr=bestPair(c); if (pr){ const a=pr[0], b=pr[1], ax=X(a%C+.5), ay=Y(((a/C)|0)+.5), bx=X(b%C+.5), by=Y(((b/C)|0)+.5), L=Math.hypot(bx-ax,by-ay)||1, ux=(bx-ax)/L, uy=(by-ay)/L, w=cs*.34;
      ctx.strokeStyle='#22303a'; ctx.fillStyle='#22303a'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx-ux*w,by-uy*w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx-ux*w-uy*w*.7,by-uy*w+ux*w*.7); ctx.lineTo(bx-ux*w+uy*w*.7,by-uy*w-ux*w*.7); ctx.closePath(); ctx.fill(); } }
  }
  // tutorial focus
  const cells=focusCells();
  if (cells.length){
    const a=REDUCED?0.85:0.5+0.4*Math.sin(now/260);
    ctx.strokeStyle=`rgba(163,58,36,${a})`; ctx.lineWidth=Math.max(2,cs*0.16); ctx.beginPath();
    for (const i of cells){ const x=i%C, y=(i/C)|0; ctx.rect(X(x)+1,Y(y)+1,cs-2,cs-2); }
    ctx.stroke();
  }
  // selection
  if (selected>=0){ const x=selected%C, y=(selected/C)|0; ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.strokeRect(X(x)-.5,Y(y)-.5,cs+1,cs+1); ctx.strokeStyle='#22303a'; ctx.lineWidth=1.5; ctx.strokeRect(X(x)-.5,Y(y)-.5,cs+1,cs+1); }
  ctx.strokeStyle='rgba(38,38,31,.6)'; ctx.lineWidth=1; ctx.strokeRect(X(0)-.5,Y(0)-.5,C*cs+1,R*cs+1);
  // sky and weather
  if (viewMode===0) drawSky(cs);
  if (g.stormEnv>0.02){ ctx.fillStyle=`rgba(30,40,58,${0.28*g.stormEnv})`; ctx.fillRect(0,0,cw,ch); }
  if (g.rain>0 && speed>0 && !REDUCED){ const n=Math.floor(g.rain*90000); ctx.strokeStyle='rgba(60,84,108,.26)'; ctx.lineWidth=1; ctx.beginPath();
    for (let k=0;k<n;k++){ const rx=(hash2(k,1,3)*cw - T*90) % cw, ry=(hash2(k,2,3)*ch + T*(520+hash2(k,3,3)*200)) % ch, px=rx<0?rx+cw:rx; ctx.moveTo(px,ry); ctx.lineTo(px-3,ry+9); } ctx.stroke(); }
  drawLoupe();
  if (SET.debug) drawDebug();
}
function focusCells(){
  const g=G, stp=(g.sc.steps||[])[g.step]; if (!stp || !stp.focus || !g.m) return [];
  if (stp.focus==='open') return g.m.open.length>400 ? g.m.open.slice(0,400) : g.m.open;
  if (stp.focus==='sea'){ const out=[]; for (let i=0;i<g.N && out.length<400;i++) if (seaFront(i) && g.ground[i]+g.dike[i]<4.5) out.push(i); return out; }
  if (stp.focus==='mouth'){ const out=[]; for (let i=0;i<g.N && out.length<400;i++) if (g.kind[i]===2 && !openSeaCell(g,i) && neighbors4(i).some(j=>openSeaCell(g,j))) out.push(i); return out; }
  return [];
}
function hasIdleAnim(){ return (G.fx&&G.fx.length) || pops.length || floaters.length || (gesture&&gesture.type==='build') || (!REDUCED && focusCells().length>0); }
function addPop(i, delay){ if (pops.length<200) pops.push({i, t:performance.now()+(delay||0)}); frameDirty=true; }
function addFloater(i, text){ if (floaters.length<4) floaters.push({i, text, t:performance.now()}); }

// While a finger is drawing it hides the very cell it is aiming at. The loupe shows that spot, enlarged, above the finger.
function drawLoupe(){
  const b=gesture; if (!b || b.type!=='build' || !b.touch || !b.cells.length) return;
  const target=30; if (view.cs>=target) return;
  const mag=target/view.cs, R=50; let lx=b.x, ly=b.y-R-44;
  if (ly-R<4){ ly=b.y; lx = b.x<cw/2 ? b.x+R+52 : b.x-R-52; }
  lx=clamp(lx, R+4, cw-R-4); ly=clamp(ly, R+4, ch-R-4);
  const sw=2*R/mag;
  ctx.save(); ctx.beginPath(); ctx.arc(lx,ly,R,0,7); ctx.clip();
  ctx.fillStyle='#e9e4d6'; ctx.fillRect(lx-R,ly-R,2*R,2*R);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(cv, (b.x-sw/2)*dpr, (b.y-sw/2)*dpr, sw*dpr, sw*dpr, lx-R, ly-R, 2*R, 2*R);
  ctx.imageSmoothingEnabled=true; ctx.restore();
  ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(lx,ly,R,0,7); ctx.stroke();
  ctx.strokeStyle='#22303a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(lx,ly,R+1.5,0,7); ctx.stroke();
  ctx.strokeStyle='rgba(34,48,58,.75)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(lx-7,ly); ctx.lineTo(lx+7,ly); ctx.moveTo(lx,ly-7); ctx.lineTo(lx,ly+7); ctx.stroke();
}
// Touch debug (menu → Touch debug): where the browser says the finger is, and which cell that resolves to.
function drawDebug(){
  const g=G, C=g.C, cs=view.cs; ctx.font='11px ui-monospace,Menlo,monospace';
  const r=cv.getBoundingClientRect();
  const lines=[`stage ${cw.toFixed(1)}×${ch.toFixed(1)} css ${r.width.toFixed(1)}×${r.height.toFixed(1)}`, `buf ${cv.width}×${cv.height} dpr ${dpr} cell ${cs.toFixed(2)}px`];
  if (dbg){ const x=dbg.cell%C, y=(dbg.cell/C)|0;
    if (dbg.cell>=0){ ctx.strokeStyle='#d0f'; ctx.lineWidth=2; ctx.strokeRect(view.ox+x*cs, view.oy+y*cs, cs, cs); }
    ctx.strokeStyle='#d0f'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(dbg.x-18,dbg.y); ctx.lineTo(dbg.x+18,dbg.y); ctx.moveTo(dbg.x,dbg.y-18); ctx.lineTo(dbg.x,dbg.y+18); ctx.stroke();
    ctx.beginPath(); ctx.arc(dbg.x,dbg.y,22,0,7); ctx.stroke();
    lines.push(`touch ${dbg.x.toFixed(1)},${dbg.y.toFixed(1)} → ${dbg.cell<0?'off map':'col '+x+' row '+y}`); }
  ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillRect(6, ch-164, 232, lines.length*14+8);
  ctx.fillStyle='#909'; lines.forEach((s,k)=>ctx.fillText(s, 10, ch-150+k*14));
}

// drawStruct, the map painter and the sky are in paint.js

/* ----- peilschaal: the Dutch water gauge, as designed in the Hollandse lucht mockup (design/hollandse-lucht).
   Slim board by default (the two marks and the lake reading); tap to open the full board with the NAP scale and a legend.
   Marks differ in shape as well as colour: boezem = a triangle pointing at the board, lake = a bar across it.
   Chapters with storms add the sea (a wave line) and the sea dike crest (a green bar), and the scale reaches up to +5 m. */
let gaugeOpen=false;
function gaugeRange(g){ const deep=Math.floor((g.sc.lake||g.sc.arms[0]).bottom); return g.sc.storms.length ? [5, Math.min(-2,deep)] : [0.5, Math.min(-2,deep)]; }
function drawGauge(){
  const g=G, el=$('gauge'), [top,bot]=gaugeRange(g), range=top-bot, INKC='#26261f', AL='font-family="Alegreya Sans" font-weight="800"';
  const sea=g.sea||0, bz=g.boezem, lake=g.m&&g.m.lakeLevel>-50?g.m.lakeLevel:null, storms=g.sc.storms.length>0;
  const tooth = range<=3 ? 0.1 : range<=6 ? 0.2 : 0.5;            // E teeth: every 10 cm on a short board, coarser on a tall one
  const wave=(x0,x1,y)=>{ let d=`M${x0} ${y}`; for (let x=x0+1.5;x<=x1;x+=1.5) d+=` L${x} ${(y+Math.sin((x-x0)/1.6)*1.4).toFixed(2)}`; return d; };
  let s='', W, Hh;
  if (gaugeOpen){
    const y0=10, H=176, Y=v=>y0+(top-clamp(v,bot,top))/range*H, dm=H/(range/tooth), bx=6, bw=20;
    const marks=[]; if (storms) marks.push(['sea',sea,'#24485a']); marks.push(['boezem',bz,'#245666']); if (lake!=null) marks.push(['lake',lake,'#a33a24']);
    W=86; Hh=H+18+marks.length*14;
    s+=`<rect x="0.5" y="0.5" width="85" height="${Hh-2}" rx="3" fill="rgba(244,236,216,.94)" stroke="${INKC}"/>`;
    s+=`<rect x="${bx}" y="${y0}" width="${bw}" height="${H}" fill="#fbf7ec" stroke="${INKC}" stroke-width="1"/><rect x="${bx}" y="${y0}" width="4" height="${H}" fill="${INKC}"/>`;
    for (let k=0; k<Math.round(range/tooth); k++){ const v=top-k*tooth, whole=Math.abs(v*2-Math.round(v*2))<1e-6; if (k%2===0) s+=`<rect x="${bx}" y="${Y(v).toFixed(1)}" width="${whole?bw:bw*0.62}" height="${(dm*0.5).toFixed(2)}" fill="${INKC}"/>`; }
    const step = range<=3 ? 0.5 : range<=6 ? 1 : 2, labels=[]; for (let v=Math.ceil(bot/step)*step; v<=top+1e-6; v+=step) labels.push(+v.toFixed(2)); if (!labels.includes(0)) labels.push(0);
    for (const v of labels){ const yy=Y(v); s+=`<line x1="${bx+bw}" x2="${bx+bw+4}" y1="${yy}" y2="${yy}" stroke="${INKC}"/><text x="${bx+bw+6}" y="${yy+3.5}" font-size="10.5" fill="${INKC}" ${AL}${v===0?' data-g="nap" class="gt"':''}>${v===0?'NAP':(v>0?'+':'−')+String(Math.abs(v)).replace('.0','')}</text>`; }
    if (storms && g.m){ const yy=Y(g.m.seaMin); s+=`<rect x="${bx-3}" y="${yy-1.5}" width="${bw+6}" height="3" fill="#4a6326"/>`; }
    for (const [label,v,col] of marks){ const yy=Y(v);
      s+= label==='boezem' ? `<path d="M${bx-1} ${yy} l-5 -4.5 v9 z" fill="${col}" stroke="${INKC}" stroke-width=".6"/><line x1="${bx}" x2="${bx+bw}" y1="${yy}" y2="${yy}" stroke="${col}" stroke-width="1.4" stroke-dasharray="2 1.5"/>`
        : label==='lake' ? `<rect x="${bx-3}" y="${yy-1.6}" width="${bw+6}" height="3.2" fill="${col}"/>`
        : `<path d="${wave(bx-3,bx+bw+3,yy)}" fill="none" stroke="${col}" stroke-width="2"/>`; }
    let ly=y0+H+2;
    for (const [label,v,col] of marks){ ly+=13; s+= (label==='boezem' ? `<path d="M${bx+8} ${ly-6.5} l-5 -4 v8 z" fill="${col}"/>` : label==='lake' ? `<rect x="${bx}" y="${ly-8}" width="10" height="3.2" fill="${col}"/>` : `<path d="${wave(bx,bx+10,ly-6.5)}" fill="none" stroke="${col}" stroke-width="1.8"/>`)
      + `<text data-g="${label==='sea'?'storm':label==='boezem'?'boezem':'lakebed'}" class="gt" x="${bx+14}" y="${ly-3}" font-size="11" fill="${col}" ${AL}>${label} ${(v<0?'−':'+')+Math.abs(v).toFixed(2)}</text>`; }
  } else {
    const y0=6, H=118, Y=v=>y0+(top-clamp(v,bot,top))/range*H, bx=8, bw=12; W=30; Hh=150;
    s+=`<rect x="0.5" y="0.5" width="29" height="149" rx="3" fill="rgba(244,236,216,.94)" stroke="${INKC}"/>`;
    s+=`<rect x="${bx}" y="${y0}" width="${bw}" height="${H}" fill="#fbf7ec" stroke="${INKC}" stroke-width=".8"/><rect x="${bx}" y="${y0}" width="2.5" height="${H}" fill="${INKC}"/>`;
    for (let k=0; k<=Math.round(range/tooth); k+=2){ const v=top-k*tooth, whole=Math.abs(v*2-Math.round(v*2))<1e-6; s+=`<rect x="${bx}" y="${Y(v).toFixed(1)}" width="${whole?bw:bw*0.6}" height="${(H/(range/tooth)/2).toFixed(2)}" fill="${INKC}"/>`; }
    if (storms){ if (g.m) s+=`<rect x="${bx-2}" y="${Y(g.m.seaMin)-1.4}" width="${bw+5}" height="2.8" fill="#4a6326"/>`; s+=`<path d="${wave(bx-3,bx+bw+3,Y(sea))}" fill="none" stroke="#24485a" stroke-width="1.8"/>`; }
    { const yy=Y(bz); s+=`<path d="M${bx-.5} ${yy} l-6 -4.5 v9 z" fill="#245666" stroke="${INKC}" stroke-width=".6"/>`; }
    if (lake!=null){ const yy=Y(lake); s+=`<rect x="${bx-2}" y="${yy-1.6}" width="${bw+5}" height="3.2" fill="#a33a24"/><text x="15.5" y="144" text-anchor="middle" font-size="12" fill="#a33a24" ${AL}>${(lake<0?'−':'+')+Math.abs(lake).toFixed(1)}</text>`; }
  }
  el.setAttribute('viewBox', `0 0 ${W} ${Hh}`); el.style.width=W+'px'; el.style.height=Hh+'px'; if (el._s!==s && !glossBusy()){ el._s=s; el.innerHTML=s; }
  $('gaugeBtn').setAttribute('aria-label', 'Water levels: '+(storms?'sea '+sea.toFixed(2)+' m, ':'')+'boezem '+bz.toFixed(2)+' m'+(lake!=null?', lake '+lake.toFixed(2)+' m':'')+'. '+(gaugeOpen?'Tap to close the gauge.':'Tap to open the gauge.'));
}

// For a pump on a diagonal dike (a staircase of cells), the unit vector straight across the wall, pointing the way the water goes
// (the axis pair in/out stays horizontal or vertical in the sim; only the drawing turns). null on a straight wall.
function wallNormal(p, ux, uy){
  const g=G, C=g.C, R=g.R, x=p%C, y=(p/C)|0, d=(xx,yy)=>xx>=0&&yy>=0&&xx<C&&yy<R&&g.dike[yy*C+xx]>0;
  const back=d(x-1,y-1)&&d(x+1,y+1), fwd=d(x+1,y-1)&&d(x-1,y+1);
  if (back===fwd) return null;
  let nx=back?1:1, ny=back?-1:1; const k=Math.SQRT1_2; nx*=k; ny*=k;
  if (nx*ux+ny*uy<0){ nx=-nx; ny=-ny; }
  return [nx,ny];
}
