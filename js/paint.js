"use strict";
/* ===== MAP PAINTING: "Hollandse lucht" (see DESIGN.md) =====
   An inked survey map under a moving Dutch sky.
   - Base layers (paintMap), rasterised at MAPK px per cell: land (landCv) is one colour per cell, smoothed by upscaling,
     with hillshade, stipple and parcel ditches; water (waterCv) is drawn from a signed distance to the shore, so
     shores are curves and the waterlijnen (ink lines that follow every shore) are its contour lines.
     Water repaints at once after a build and at most every PAINT_MS while time runs; land at most every LAND_MS.
   - Everything built (canals, dikes, roads, buildings) is drawn as vectors per frame on top (render.js).
   - Sky (drawSky): cloud shadows and light live in map cells, so they pan and zoom with the land. */
const PAINT_MS = 200, LAND_MS = 2500;
const landCv=document.createElement('canvas'), landCx=landCv.getContext('2d');
const waterCv=document.createElement('canvas'), waterCx=waterCv.getContext('2d');
const cellCv=document.createElement('canvas'), cellCx=cellCv.getContext('2d');
let MAPK=12, mapPainted=0, landPainted=0, landDirty=true, baseStale=false, skyT=0, wImg=null, sdf=null, shade=null;
// a light, sunny palette: paper-bright old land, fresh meadow, clear water that deepens without going black
const PAL = { mud:[184,166,126], mead:[148,178,94], old:[218,208,168], old2:[190,194,132], dike:[109,138,66],
  shallow:[158,198,196], deep:[90,138,148], sea:[86,126,142], seaDeep:[62,100,118], ink:[30,40,40] };
const INK='#26261f', ROOD='#a33a24';
// pixels per cell: as fine as a budget of about 300k pixels allows, between 8 and 14
function mapK(g){ return clamp(Math.floor(Math.sqrt(300000/(g.C*g.R))), 8, 14); }

// Repaint what changed: the land only after a build or every LAND_MS while time runs (crops ripen slowly), the water every time.
function paintMap(force){
  const g=G; if (!wet || wet.length!==g.N) wet=new Uint8Array(g.N);
  const K=mapK(g); if (K!==MAPK || landCv.width!==g.C*K || landCv.height!==g.R*K){ MAPK=K; landCv.width=waterCv.width=g.C*K; landCv.height=waterCv.height=g.R*K; wImg=null; force=true; }
  const now=performance.now();
  if (force || landDirty || now-landPainted>LAND_MS){ paintLand(); landPainted=now; landDirty=false; }
  paintWater(); mapPainted=now; baseStale=false;
}

function sunGradient(c,W,H){ const s=c.createLinearGradient(W,0,0,H); s.addColorStop(0,'rgba(255,200,120,.45)'); s.addColorStop(.6,'rgba(255,236,200,.12)'); s.addColorStop(1,'rgba(130,120,160,.16)'); return s; }
function paintLand(){
  const g=G, {C,R,N}=g, K=MAPK, W=C*K, H=R*K;
  if (cellCv.width!==C || cellCv.height!==R){ cellCv.width=C; cellCv.height=R; }
  const mo=dateAt(g,g.tick).getUTCMonth(), wA=WINTER[mo], aA=AUTUMN[mo];
  const li=cellCx.createImageData(C,R), ld=li.data, gh=(j,self)=> g.kind[j]>0 ? self : g.ground[j];
  for (let i=0;i<N;i++){ const x=i%C, y=(i/C)|0; let c;
    if (g.polder[i]){ c=mix(PAL.mud, PAL.mead, clamp(g.ripe[i],0,1)); if (g.soil[i]===1) c=mix(c,[96,80,58],0.14); else if (g.soil[i]===2) c=mix(c,[214,196,150],0.16); }
    else { c=mix(PAL.old, PAL.old2, 0.3+hash2(x,y,3)*0.18); if (g.soil[i]===2) c=mix(c,[222,206,160],0.25); }
    if (wA) c=mix(c,[226,224,214],wA); if (aA) c=mix(c,[190,150,92],aA);
    const self=g.ground[i], sl=(gh(x>0?i-1:i,self)-gh(x<C-1?i+1:i,self)) + (gh(y>0?i-C:i,self)-gh(y<R-1?i+C:i,self)), sh=clamp(1+sl*0.12,0.9,1.1);
    const o=i*4; ld[o]=c[0]*sh; ld[o+1]=c[1]*sh; ld[o+2]=c[2]*sh; ld[o+3]=255; }
  cellCx.putImageData(li,0,0);
  const c=landCx; c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(cellCv,0,0,W,H);
  // parcel ditches on ripe land (the striped polder), stipple: grass ticks on meadow, dots on mud and old land
  const ditch=new Path2D(), grass=new Path2D();
  c.fillStyle='rgba(60,44,24,.26)';
  for (let i=0;i<N;i++){ if (g.kind[i] || g.struct[i] || g.road[i] || g.canal[i]) continue; const x0=(i%C)*K, y0=((i/C)|0)*K, ripe=g.polder[i]?g.ripe[i]:0.5;
    if (g.polder[i] && ripe>=0.55) for (let k=1;k<3;k++){ const yy=y0+k*K/3+0.5; ditch.moveTo(x0,yy); ditch.lineTo(x0+K,yy); }
    for (let k=0;k<4;k++){ const x=x0+hash2(i,k,21)*K, y=y0+hash2(i,k,22)*K; if (ripe>0.6){ grass.moveTo(x,y); grass.lineTo(x+0.6,y-2); } else c.fillRect(x,y,1,1); } }
  c.lineWidth=1; c.strokeStyle='rgba(40,50,24,.22)'; c.stroke(ditch); c.strokeStyle='rgba(40,60,20,.3)'; c.stroke(grass);
  // a low warm sun from the top right, baked into the land (it belongs to the map, not the screen)
  c.save(); c.globalCompositeOperation='soft-light'; c.fillStyle=sunGradient(c,W,H); c.fillRect(0,0,W,H); c.restore();
  // paper grain
  const n=Math.round(W*H/50); for (let k=0;k<n;k++){ const x=hash2(k,1,7)*W, y=hash2(k,2,7)*H, v=hash2(k,3,7); c.fillStyle=v>0.5?'rgba(255,248,230,.09)':'rgba(40,30,20,.07)'; c.fillRect(x,y,1+v*2,1); }
}

// Water: a signed distance to the shore per cell (positive in water), interpolated per pixel. Its zero line is the
// shore, so shores come out as curves, and the waterlijnen are its contour lines at fixed distances.
function paintWater(){
  const g=G, {C,R,N}=g, K=MAPK, W=C*K, H=R*K;
  if (!wImg || wImg.width!==W || wImg.height!==H){ wImg=waterCx.createImageData(W,H); sdf=new Float32Array(N); shade=new Float32Array(N); }
  for (let i=0;i<N;i++){ const d=g.depth[i], k=g.kind[i], lvl=g.canal[i], inBank = lvl>0 && d<=lvl+0.03;
    wet[i] = (k>0 || (d>0.03 && !inBank && g.dike[i]===0)) && !(g.dike[i]>0) ? 1 : 0;
    shade[i] = k===2 ? 2 : clamp((k===1?1.6:d)/2.6,0,1); }
  // two-pass chamfer distances on the cell grid: to the nearest dry cell (inside) and to the nearest wet cell (outside)
  const din=sdf, dout=shade.__out || (shade.__out=new Float32Array(N));
  for (let i=0;i<N;i++){ din[i]=wet[i]?1e6:0; dout[i]=wet[i]?0:1e6; }
  const pass=(a)=>{ for (let y=0;y<R;y++) for (let x=0;x<C;x++){ const i=y*C+x; if (!a[i]) continue; let v=a[i]; if (x>0) v=Math.min(v,a[i-1]+1); if (y>0){ v=Math.min(v,a[i-C]+1); if (x>0) v=Math.min(v,a[i-C-1]+1.414); if (x<C-1) v=Math.min(v,a[i-C+1]+1.414); } a[i]=v; }
    for (let y=R-1;y>=0;y--) for (let x=C-1;x>=0;x--){ const i=y*C+x; if (!a[i]) continue; let v=a[i]; if (x<C-1) v=Math.min(v,a[i+1]+1); if (y<R-1){ v=Math.min(v,a[i+C]+1); if (x<C-1) v=Math.min(v,a[i+C+1]+1.414); if (x>0) v=Math.min(v,a[i+C-1]+1.414); } a[i]=v; } };
  pass(din); pass(dout);
  for (let i=0;i<N;i++) din[i] = wet[i] ? Math.min(din[i],3)-0.5 : -(Math.min(dout[i],3)-0.5);   // signed, in cells, capped
  // one soft blur takes the corners off, so shores read as curves rather than steps
  for (let i=0;i<N;i++) dout[i]=din[i];
  for (let y=0;y<R;y++) for (let x=0;x<C;x++){ const i=y*C+x; let t=dout[i]*4, w=4;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=C||ny>=R) continue; t+=dout[ny*C+nx]; w++; }
    for (const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=C||ny>=R) continue; t+=dout[ny*C+nx]*0.5; w+=0.5; }
    din[i]=t/w; if (wet[i] && din[i]<0.05) din[i]=0.05; if (!wet[i] && din[i]>-0.05) din[i]=-0.05; }   // never flip a cell between wet and dry
  const o=wImg.data; o.fill(0);
  const L1=0.05+0.6/K, L2=0.16, L3=0.31, L4=0.5, w2=0.6/K, hatch=Math.max(3,Math.round(K*0.16+1));
  for (let cy=0;cy<R;cy++) for (let cx=0;cx<C;cx++){ const i=cy*C+cx;
    // skip cells with no water near them
    let any=false; for (let dy=-1;dy<=1 && !any;dy++) for (let dx=-1;dx<=1;dx++){ const x=cx+dx, y=cy+dy; if (x>=0&&y>=0&&x<C&&y<R&&wet[y*C+x]){ any=true; break; } } if (!any) continue;
    for (let py=cy*K; py<cy*K+K; py++){ const v=(py+0.5)/K-0.5, y0=clamp(Math.floor(v),0,R-1), y1=Math.min(R-1,y0+1), fy=clamp(v-y0,0,1);
      for (let px=cx*K; px<cx*K+K; px++){ const u=(px+0.5)/K-0.5, x0=clamp(Math.floor(u),0,C-1), x1=Math.min(C-1,x0+1), fx=clamp(u-x0,0,1);
        const a=y0*C+x0, b=y0*C+x1, c2=y1*C+x0, d=y1*C+x1;
        const f=(din[a]*(1-fx)+din[b]*fx)*(1-fy)+(din[c2]*(1-fx)+din[d]*fx)*fy; if (f<=0) continue;
        const sa=shade[a], sb=shade[b], sc=shade[c2], sd=shade[d], sea=(sa>1.5||sb>1.5||sc>1.5||sd>1.5);
        const dn=((Math.min(sa,1)*(1-fx)+Math.min(sb,1)*fx)*(1-fy)+(Math.min(sc,1)*(1-fx)+Math.min(sd,1)*fx)*fy);
        let col = sea ? mix(PAL.sea, PAL.seaDeep, dn) : mix(PAL.shallow, PAL.deep, dn), al=0;
        if (f<L1) al=0.85; else if (Math.abs(f-L2)<w2) al=0.45; else if (Math.abs(f-L3)<w2) al=0.3; else if (Math.abs(f-L4)<w2) al=0.18; else if (py%hatch===0) al=0.12;
        if (al) col=mix(col,PAL.ink,al);
        const sun=(px/W + (1-py/H))*0.5; col = sun>0.55 ? mix(col,[226,190,130],(sun-0.55)*0.3) : mix(col,[70,72,100],(0.55-sun)*0.1);   // warm top right, cool bottom left
        const p=(py*W+px)*4; o[p]=col[0]; o[p+1]=col[1]; o[p+2]=col[2]; o[p+3]=255; } } }
  waterCx.putImageData(wImg,0,0);
}

/* ----- vectors drawn per frame, in screen space ----- */
// Paths through cell centres for dike, road or canal cells, joined to their 4-neighbours (dikes also corner to corner).
function cellPath(cells, x0,y0,x1,y1, X,Y, cs, has, diag, round){
  const g=G, C=g.C, R=g.R, p=new Path2D();
  if (round){   // canals: every cell draws its own halves up to the cell edges, and a corner cell is one smooth curve, so a staircase of cells reads as a diagonal
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; if (!has(i)) continue; const cx=X(x+.5), cy=Y(y+.5), h=cs/2;
      const r=x<C-1&&has(i+1), l=x>0&&has(i-1), d=y<R-1&&has(i+C), u=y>0&&has(i-C), n=r+l+d+u;
      if (cells) cells.push(i);
      if (n===2 && (r||l) && (u||d)){ const hx=r?cx+h:cx-h, vy=d?cy+h:cy-h; p.moveTo(hx,cy); p.quadraticCurveTo(cx,cy,cx,vy); continue; }
      if (!n){ p.moveTo(cx,cy); p.lineTo(cx+.01,cy); continue; }
      if (r){ p.moveTo(cx,cy); p.lineTo(cx+h,cy); } if (l){ p.moveTo(cx,cy); p.lineTo(cx-h,cy); } if (d){ p.moveTo(cx,cy); p.lineTo(cx,cy+h); } if (u){ p.moveTo(cx,cy); p.lineTo(cx,cy-h); } }
    return p; }
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; if (!has(i)) continue; const cx=X(x+.5), cy=Y(y+.5); let any=false;
    if (x<C-1 && has(i+1)){ p.moveTo(cx,cy); p.lineTo(cx+cs,cy); any=true; }
    if (y<R-1 && has(i+C)){ p.moveTo(cx,cy); p.lineTo(cx,cy+cs); any=true; }
    if ((x>0 && has(i-1)) || (y>0 && has(i-C))) any=true;
    if (diag && y<R-1){ if (x<C-1 && has(i+C+1) && !has(i+1) && !has(i+C)){ p.moveTo(cx,cy); p.lineTo(cx+cs,cy+cs); any=true; }
      if (x>0 && has(i+C-1) && !has(i-1) && !has(i+C)){ p.moveTo(cx,cy); p.lineTo(cx-cs,cy+cs); any=true; } }
    if (diag && !any && y>0 && ((x>0 && has(i-C-1)) || (x<C-1 && has(i-C+1)))) any=true;
    if (cells) cells.push(i);
    if (!any){ p.moveTo(cx,cy); p.lineTo(cx+.01,cy); } }
  return p;
}
// Dikes: an ink edge, a grass body, a light crest, and hatch ticks on the flanks when zoomed in.
function drawDikes(x0,y0,x1,y1,X,Y,cs){
  const g=G, C=g.C, has=(j)=>g.dike[j]>0, cells=[];
  const p=cellPath(cells,x0,y0,x1,y1,X,Y,cs,has,true);
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.strokeStyle=INK; ctx.lineWidth=cs*0.86; ctx.stroke(p);
  ctx.strokeStyle='#6d8a42'; ctx.lineWidth=cs*0.66; ctx.stroke(p);
  ctx.strokeStyle='rgba(222,226,170,.55)'; ctx.lineWidth=Math.max(1,cs*0.11); ctx.stroke(p);
  if (cs>=10){ ctx.strokeStyle='rgba(38,38,31,.5)'; ctx.lineWidth=Math.max(1,cs*0.04); ctx.beginPath();
    for (const i of cells){ const x=i%C, y=(i/C)|0, cx=X(x+.5), cy=Y(y+.5);
      for (const [dx,dy] of [[1,0],[0,1]]){ const j=i+dx+dy*C; if (x+dx>=C || !has(j)) continue;
        for (let t=0.25;t<1;t+=0.25){ const px=cx+dx*cs*t, py=cy+dy*cs*t; for (const sgn of [1,-1]){ const nx=-dy*sgn, ny=dx*sgn; ctx.moveTo(px+nx*cs*.2, py+ny*cs*.2); ctx.lineTo(px+nx*cs*.31, py+ny*cs*.31); } } } }
    ctx.stroke(); }
  ctx.lineCap='butt';
}
// Roads: a double ink line, the way old maps drew them.
function drawRoads(x0,y0,x1,y1,X,Y,cs){
  const g=G, C=g.C, R=g.R, isR=(j)=>g.road[j]||g.struct[j]===S.TOWN, p=new Path2D();
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; if (!g.road[i]) continue; const cx=X(x+.5), cy=Y(y+.5); let any=false;
    for (const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=C||ny>=R) continue; const j=ny*C+nx;
      if (isR(j)||g.dike[j]>0||g.struct[j]===S.FARM||g.struct[j]===S.HOUSE){ if (dx>0||dy>0||!isR(j)){ p.moveTo(cx,cy); p.lineTo(cx+dx*cs*(isR(j)?1:.5),cy+dy*cs*(isR(j)?1:.5)); } any=true; } }
    if (!any){ p.moveTo(cx-cs*.2,cy); p.lineTo(cx+cs*.2,cy); } }
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.strokeStyle=INK; ctx.lineWidth=Math.max(2,cs*0.34); ctx.stroke(p);
  ctx.strokeStyle='#d9c79a'; ctx.lineWidth=Math.max(1,cs*0.2); ctx.stroke(p);
  ctx.lineCap='butt';
}
// Canals: an inked channel; overfull water spills, normal water is blue, a dry canal shows its clay bed.
function drawCanals(x0,y0,x1,y1,X,Y,cs){
  const g=G, C=g.C, R=g.R;
  const has=(j)=>g.canal[j] && g.kind[j]===0 && !(g.dike[j]>0);
  const st=(i)=>{ const d=g.depth[i], lvl=g.canal[i]; return d>lvl+0.03 ? 0 : d>0.03 ? 1 : 2; };
  const p=cellPath(null,x0,y0,x1,y1,X,Y,cs,has,false,true);
  // stubs to the pumps that draw from or feed a canal
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; if (!has(i)) continue; const cx=X(x+.5), cy=Y(y+.5);
    for (const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=C||ny>=R) continue; const j=ny*C+nx;
      if (g.struct[j]>=1 && g.struct[j]<=3 && (g.pin[j]===i || g.pout[j]===i)){ p.moveTo(cx,cy); p.lineTo(cx+dx*cs*.5,cy+dy*cs*.5); } } }
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.strokeStyle=INK; ctx.lineWidth=Math.max(2.4,cs*0.46); ctx.stroke(p);
  ctx.strokeStyle='#8f7650'; ctx.lineWidth=Math.max(1.4,cs*0.32); ctx.stroke(p);
  // water on top: a canal over its banks shows a wider, paler band; a canal with water a blue band; a dry one only its clay bed
  const over=cellPath(null,x0,y0,x1,y1,X,Y,cs,(j)=>has(j)&&st(j)===0,false,true), water=cellPath(null,x0,y0,x1,y1,X,Y,cs,(j)=>has(j)&&st(j)<2,false,true);
  ctx.strokeStyle='#8fb4b8'; ctx.lineWidth=Math.max(1.4,cs*0.4); ctx.stroke(over);
  ctx.strokeStyle='#5f8f9a'; ctx.lineWidth=Math.max(1.2,cs*0.24); ctx.stroke(water);
  if (cs>=14){ ctx.strokeStyle='rgba(240,248,240,.35)'; ctx.lineWidth=1; ctx.setLineDash([cs*.18,cs*.32]); ctx.stroke(water); ctx.setLineDash([]); }
  ctx.lineCap='butt';
}

/* ----- buildings, inked with one fill ----- */
function gable(c,x,y,w,h,roof,wall){ c.lineWidth=Math.max(1,w*0.06); c.strokeStyle=INK;
  c.fillStyle=wall; c.beginPath(); c.moveTo(x,y+h); c.lineTo(x,y+h*.45); c.lineTo(x+w/2,y); c.lineTo(x+w,y+h*.45); c.lineTo(x+w,y+h); c.closePath(); c.fill(); c.stroke();
  c.fillStyle=roof; c.beginPath(); c.moveTo(x-1,y+h*.47); c.lineTo(x+w/2,y-1); c.lineTo(x+w+1,y+h*.47); c.lineTo(x+w*.82,y+h*.47); c.lineTo(x+w/2,y+h*.16); c.lineTo(x+w*.18,y+h*.47); c.closePath(); c.fill(); c.stroke();
  c.fillStyle=INK; c.fillRect(x+w*.42,y+h*.66,w*.16,h*.34); }
function drawStruct(s, i, x, y, cs, T){
  const g=G, cx=x+cs/2, cy=y+cs/2, c=ctx;
  if (s===S.MILL){   // a post mill whose sails turn with the pump
    if (!REDUCED) g.pumpAng[i]+= g.pumpFlow[i]*0.9 + (g.pumpState[i]===0&&speed>0?0.02:0);
    c.lineWidth=Math.max(1,cs*0.05); c.strokeStyle=INK;
    c.fillStyle='#5a4430'; c.beginPath(); c.moveTo(cx-cs*.2,cy+cs*.32); c.lineTo(cx-cs*.14,cy-cs*.22); c.lineTo(cx+cs*.14,cy-cs*.22); c.lineTo(cx+cs*.2,cy+cs*.32); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#3a2f26'; c.beginPath(); c.moveTo(cx-cs*.17,cy-cs*.22); c.lineTo(cx,cy-cs*.36); c.lineTo(cx+cs*.17,cy-cs*.22); c.closePath(); c.fill(); c.stroke();
    const hx=cx, hy=cy-cs*.16, a=g.pumpAng[i]+0.6;
    for (let k=0;k<4;k++){ const an=a+k*Math.PI/2, ux=Math.cos(an), uy=Math.sin(an), px=-uy, py=ux, L=cs*.58, w=cs*.12;
      c.fillStyle='rgba(240,232,210,.92)'; c.beginPath(); c.moveTo(hx+ux*cs*.12,hy+uy*cs*.12); c.lineTo(hx+ux*L,hy+uy*L); c.lineTo(hx+ux*L+px*w,hy+uy*L+py*w); c.lineTo(hx+ux*cs*.12+px*w,hy+uy*cs*.12+py*w); c.closePath(); c.fill();
      c.lineWidth=Math.max(.8,cs*0.035); c.stroke(); c.beginPath(); c.moveTo(hx,hy); c.lineTo(hx+ux*L,hy+uy*L); c.lineWidth=Math.max(1,cs*0.055); c.stroke(); }
    c.fillStyle=INK; c.beginPath(); c.arc(hx,hy,cs*.06,0,7); c.fill();
  } else if (s===S.STEAM){   // a brick engine house with a chimney that smokes while it pumps
    c.lineWidth=Math.max(1,cs*0.05); c.strokeStyle=INK; gable(c,x+cs*.14,y+cs*.3,cs*.56,cs*.6,'#4c4a44','#9a4a32');
    c.fillStyle='#7a3424'; c.fillRect(x+cs*.68,y+cs*.06,cs*.14,cs*.8); c.strokeRect(x+cs*.68,y+cs*.06,cs*.14,cs*.8);
    if (g.pumpFlow[i]>0.01 && !REDUCED){ for (let k=0;k<3;k++){ const p=(T/1.4+k/3)%1; c.fillStyle=`rgba(90,88,84,${0.4*(1-p)})`; c.beginPath(); c.arc(x+cs*.75+p*cs*.4, y+cs*.02-p*cs*.6, cs*(.08+p*.18), 0, 7); c.fill(); } }
  } else if (s===S.ELEC){    // a pale pumping station with a blue line on its door when it runs
    c.lineWidth=Math.max(1,cs*0.05); gable(c,x+cs*.16,y+cs*.22,cs*.68,cs*.68,'#4c4a44','#e9dcc0');
    c.strokeStyle=g.pumpFlow[i]>0.01?'#2f6d8c':INK; c.lineWidth=Math.max(1.2,cs*.07); c.beginPath(); c.moveTo(cx+cs*.04,y+cs*.4); c.lineTo(cx-cs*.08,cy+cs*.08); c.lineTo(cx+cs*.08,cy+cs*.08); c.lineTo(cx-cs*.04,y+cs*.8); c.stroke();
  } else if (s===S.LOCK){
    c.fillStyle='#7fa9b0'; c.fillRect(x+cs*.2,y+cs*.22,cs*.6,cs*.56);
    c.fillStyle=INK; c.fillRect(x+cs*.08,y+cs*.14,cs*.84,cs*.12); c.fillRect(x+cs*.08,y+cs*.74,cs*.84,cs*.12);
    c.fillStyle='#8a6a44'; c.fillRect(x+cs*.18,y+cs*.26,cs*.08,cs*.48); c.fillRect(x+cs*.74,y+cs*.26,cs*.08,cs*.48);
  } else if (s===S.SLUICE){
    if (g.pumpFlow[i]>0.01){ c.fillStyle='#7fa9b0'; c.fillRect(x+cs*.31,y+cs*.2,cs*.38,cs*.6); }
    c.fillStyle=INK; c.fillRect(x+cs*.15,y+cs*.12,cs*.16,cs*.76); c.fillRect(x+cs*.69,y+cs*.12,cs*.16,cs*.76);
    c.fillStyle='#8a6a44'; if (g.pumpFlow[i]<=0.01) c.fillRect(x+cs*.31,y+cs*.42,cs*.38,cs*.16);
  } else if (s===S.FARM){    // farmhouse, a field of stubble and a haystack
    c.fillStyle= g.flood[i] ? 'rgba(150,140,110,.55)' : 'rgba(214,190,110,.6)'; c.fillRect(x+1,y+1,cs-2,cs-2);
    c.strokeStyle='rgba(120,92,30,.45)'; c.lineWidth=1; c.beginPath(); for (let k=1;k<5;k++){ c.moveTo(x+2,y+k*cs/5); c.lineTo(x+cs-2,y+k*cs/5); } c.stroke();
    gable(c,x+cs*.14,y+cs*.16,cs*.48,cs*.56,'#8a3b26', g.flood[i]?'#b8ad94':'#e9dcc0');
    c.fillStyle='#d8b452'; c.strokeStyle=INK; c.lineWidth=Math.max(1,cs*.045); c.beginPath(); c.ellipse(x+cs*.78,y+cs*.66,cs*.13,cs*.16,0,0,7); c.fill(); c.stroke();
  } else if (s===S.HOUSE){   // a brick gable house
    gable(c,x+cs*.2,y+cs*.14,cs*.6,cs*.72, hash2(i,9,9)>0.5?'#7a3424':'#4c4a44', g.flood[i]?'#8f6a5c':'#b55a3c');
    c.fillStyle='#f1e7d0'; c.fillRect(x+cs*.3,y+cs*.6,cs*.08,cs*.1); c.fillRect(x+cs*.62,y+cs*.6,cs*.08,cs*.1);
  } else if (s===S.TOWN){    // a church tower between gables
    gable(c,x-cs*.55,y+cs*.25,cs*.5,cs*.62,'#7a3424','#b55a3c'); gable(c,x+cs*1.05,y+cs*.3,cs*.48,cs*.58,'#4c4a44','#c46b48');
    c.fillStyle='#d9ccad'; c.strokeStyle=INK; c.lineWidth=Math.max(1,cs*.06); c.fillRect(x+cs*.25,y-cs*.2,cs*.5,cs*1.08); c.strokeRect(x+cs*.25,y-cs*.2,cs*.5,cs*1.08);
    c.fillStyle='#4c4a44'; c.beginPath(); c.moveTo(x+cs*.2,y-cs*.2); c.lineTo(cx,y-cs*1.05); c.lineTo(x+cs*.8,y-cs*.2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle=INK; c.fillRect(x+cs*.42,y+cs*.55,cs*.16,cs*.33);
  }
}
// Cows graze in the meadow next to each farm.
function drawCows(x0,y0,x1,y1,X,Y,cs){
  if (cs<9) return; const g=G, C=g.C;
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; if (g.struct[i]!==S.FARM) continue;
    for (let k=0;k<2;k++){ for (let t=0;t<8;t++){ const j=i+[1,-1,C,-C,C+1,C-1,-C+1,-C-1][(t+k*3)%8]; if (j<0||j>=g.N || !g.polder[j] || wet[j] || g.struct[j] || g.road[j] || g.dike[j]>0 || g.canal[j] || g.ripe[j]<0.5) continue;
      const jx=(j%C)+.3+hash2(j,k,4)*.4, jy=((j/C)|0)+.3+hash2(j,k,5)*.4, white=hash2(j,k,7)>0.4, px=X(jx)+Math.sin(skyT*.3+hash2(j,k,6)*6)*cs*.05, py=Y(jy);
      ctx.fillStyle=white?'#f2eee2':'#3a2f26'; ctx.strokeStyle=INK; ctx.lineWidth=.9; ctx.beginPath(); ctx.ellipse(px,py,cs*.13,cs*.08,0,0,7); ctx.fill(); ctx.stroke();
      if (white){ ctx.fillStyle=INK; ctx.fillRect(px-cs*.03,py-cs*.05,cs*.05,cs*.05); } break; } } }
}
// Glints on deep open water.
function drawGlints(x0,y0,x1,y1,X,Y,cs){
  if (cs<7) return; const g=G, C=g.C; ctx.strokeStyle='rgba(240,248,240,.55)'; ctx.lineWidth=1.1; ctx.beginPath();
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=y*C+x; if (!wet[i] || (g.kind[i]===0 && g.depth[i]<0.5) || hash2(x,y,4)>0.1) continue;
    const ph=hash2(x,y,5)*6+skyT*0.8, a=(Math.sin(ph)+1)/2; if (a<0.65) continue; const px=X(x+.5)+Math.sin(ph*.5)*cs*.2, py=Y(y+.5); ctx.moveTo(px-cs*.18,py); ctx.lineTo(px+cs*.18,py); }
  ctx.stroke();
}

/* ----- the sky: cloud shadows that roll as they drift, a low sun, lamplight at night ----- */
const CLOUDS=[[0.1,0.2,1.0],[0.55,0.55,1.3],[0.25,0.85,0.9],[0.8,0.15,1.1]];
const puffImg=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); const gr=x.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(20,24,30,.5)'); gr.addColorStop(.55,'rgba(20,24,30,.28)'); gr.addColorStop(1,'rgba(20,24,30,0)'); x.fillStyle=gr; x.fillRect(0,0,128,128); return c; })();
const PUFFS=CLOUDS.map((_,j)=>Array.from({length:9},(_,k)=>({x:.15+hash2(j,k,31)*.7, y:.2+hash2(j,k,32)*.6, r:.16+hash2(j,k,33)*.16, p:hash2(j,k,34)*6.3, f:.25+hash2(j,k,35)*.35})));
const cloudCv=document.createElement('canvas'), cloudCx=cloudCv.getContext('2d'); let cloudT=-1;
const CLOUDK=4;   // pixels per cell in the cloud layer: shadows are soft, so a coarse layer is enough
function paintClouds(){
  const g=G, W=g.C*CLOUDK, H=g.R*CLOUDK; if (cloudCv.width!==W || cloudCv.height!==H){ cloudCv.width=W; cloudCv.height=H; }
  const c=cloudCx; c.clearRect(0,0,W,H);
  CLOUDS.forEach(([cx,cy,s],j)=>{ const w=g.C*0.9*s*CLOUDK, h=w*0.7, span=W*1.6+w, x=((cx*W*1.6 + skyT*(0.6+(g.wind||0.3)*1.6)*CLOUDK) % span) - w, y=cy*H-h*0.5;
    for (const q of PUFFS[j]){ const t=skyT*q.f*0.35+q.p, r=w*q.r*(1+0.22*Math.sin(t)), px=x+w*(q.x+0.05*Math.sin(t*0.7)), py=y+h*(q.y+0.07*Math.cos(t*0.9)); c.drawImage(puffImg, px-r, py-r, r*2, r*2); } });
  cloudT=skyT;
}
function drawSky(cs){
  const g=G, MW=g.C*cs, MH=g.R*cs, ox=view.ox, oy=view.oy;
  if (cloudT!==skyT || cloudCv.width!==g.C*CLOUDK) paintClouds();
  ctx.save(); ctx.globalCompositeOperation='multiply'; ctx.globalAlpha=.2; ctx.drawImage(cloudCv, ox, oy, MW, MH); ctx.restore();
  if (isDark()){ ctx.save(); ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(72,64,92,.34)'; ctx.fillRect(0,0,cw,ch); ctx.globalCompositeOperation='soft-light'; const lx=ox+MW*.62, ly=oy+MH*.3, l=ctx.createRadialGradient(lx,ly,10,lx,ly,MH*.55); l.addColorStop(0,'rgba(255,200,120,.7)'); l.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=l; ctx.fillRect(0,0,cw,ch); ctx.restore(); }
}
