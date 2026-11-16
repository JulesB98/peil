"use strict";
/* ===== OPENING =====
   A low, calm flight forward through a polder in faux 3D: you start inside the reeds, they part to both sides,
   a canal opens ahead between two dikes, mills and farms slide past, then the view rises over the whole landscape
   and the name is written. Plays on the very first launch before the lesson and when the menu logo is tapped.
   openDraw(ctx, W, H, t) is a pure function of time, so openAt(t) can draw any moment. Nothing here touches the game. */
const OPEN_END = 13.6, OPEN_WRITE = 10.2;
const oC=(v,a,b)=>v<(a===undefined?0:a)?(a===undefined?0:a):v>(b===undefined?1:b)?(b===undefined?1:b):v;
const oS=v=>{ v=oC(v); return v*v*(3-2*v); }, oSeg=(t,a,b)=>oC((t-a)/(b-a));
const oMix=(a,b,k)=>[a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k];
const oRgb=c=>'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')';
const oHash=n=>{ n=Math.sin(n*127.1+311.7)*43758.5453; return n-Math.floor(n); };
const OP={ haze:[236,228,204], skyTop:[176,204,212], skyLow:[238,230,206], fieldA:[146,176,92], fieldB:[128,160,80], ditch:[120,164,172], water:[88,142,156], waterFar:[196,214,210],
  crest:[122,154,72], slopeLit:[160,188,92], slopeShade:[84,112,52], slopeOut:[100,130,60], ink:[38,38,31], wood:[122,90,58], brick:[168,69,44], cream:[240,232,208] };
// forward distance travelled by time t (units): a gentle start, a cruise, then slowing for the reveal
const OPEN_Z=(()=>{ const a=[0]; for (let i=1;i<=Math.round(OPEN_END*20)+40;i++){ const tt=i/20, v=8.4*oS(tt/2.6)*(1-0.84*oS((tt-8.4)/4.6)); a.push(a[i-1]+v/20); } return a; })();
const openZ=t=>{ const k=oC(t,0,OPEN_END+1)*20, i=Math.floor(k); return OPEN_Z[i]+(OPEN_Z[i+1]-OPEN_Z[i])*(k-i); };

function openDraw(c, W, H, t){
  const lift=oS((t-7.6)/5.0), F=Math.min(W*0.95, H*0.56)*(1-0.55*lift), cx=W/2, reedsGone=oS((t-4.6)/2.6);
  const camZ=openZ(t), camY=1.3+0.55*oS((t-2)/3)+17*lift*lift, camX=Math.sin(t*0.33)*0.55*(1-lift), hz=0.47-0.26*lift, y0=H*hz;
  const proj=(x,y,z)=>{ const dz=Math.max(0.45,z-camZ), s=F/dz; return [cx+(x-camX)*s, y0+(camY-y)*s, s]; };
  const fog=dz=>{ const f=oC(dz/150); return f*f*(3-2*f); };
  const poly=(pts,col)=>{ c.fillStyle=col; c.beginPath(); c.moveTo(pts[0][0],pts[0][1]); for (let i=1;i<pts.length;i++) c.lineTo(pts[i][0],pts[i][1]); c.closePath(); c.fill(); };
  const band=(xa,ya,xb,yb,z0,z1,col)=>poly([proj(xa,ya,z0),proj(xb,yb,z0),proj(xb,yb,z1),proj(xa,ya,z1)],col);
  c.save(); c.lineJoin='round'; c.lineCap='round';

  // sky: a soft gradient, a low sun, slow cloud banks, a few birds
  { const g=c.createLinearGradient(0,0,0,Math.max(40,y0)); g.addColorStop(0,oRgb(OP.skyTop)); g.addColorStop(1,oRgb(OP.skyLow)); c.fillStyle=g; c.fillRect(0,0,W,Math.max(40,y0)+2); }
  { const sx=W*0.74, sy=y0-F*0.16, g=c.createRadialGradient(sx,sy,0,sx,sy,F*0.62); g.addColorStop(0,'rgba(255,214,150,.75)'); g.addColorStop(0.25,'rgba(255,200,130,.38)'); g.addColorStop(1,'rgba(255,200,130,0)'); c.fillStyle=g; c.fillRect(0,0,W,Math.max(40,y0)+2); }
  for (let k=0;k<7;k++){ const sc=0.7+oHash(k+3)*0.9, x=((oHash(k)*(W+500)+t*(3+k*0.9))%(W+500))-250, y=Math.max(10,y0)*(0.12+0.7*oHash(k+11))+4; c.fillStyle='rgba(255,252,242,.78)';
    for (const [dx,dy,r] of [[0,0,46],[44,-10,34],[-42,6,30],[84,6,26],[-76,10,22]]){ c.beginPath(); c.ellipse(x+dx*sc, y+dy*sc*0.6, r*sc*1.5, r*sc*0.55, 0, 0, 7); c.fill(); }
    c.fillStyle='rgba(150,160,170,.16)'; c.beginPath(); c.ellipse(x, y+16*sc, 120*sc, 12*sc, 0, 0, 7); c.fill(); }
  c.strokeStyle='rgba(60,56,48,.55)'; c.lineWidth=1.6;
  for (let k=0;k<5;k++){ const bx=((oHash(k+30)*(W+200)+t*(14+k*3))%(W+200))-100, by=Math.max(20,y0)*(0.25+0.4*oHash(k+40))+Math.sin(t*0.8+k)*6, fl=Math.sin(t*5+k*2)*5; c.beginPath(); c.moveTo(bx-9,by-fl); c.quadraticCurveTo(bx-4,by-4,bx,by); c.quadraticCurveTo(bx+4,by-4,bx+9,by-fl); c.stroke(); }

  // the ground, drawn far to near in slices
  c.fillStyle=oRgb(OP.haze); c.fillRect(0,y0-1,W,H-y0+2);
  const STEP=2.5, NSEG=64, base=Math.floor((camZ+0.5)/STEP)*STEP, YC=1.0, buckets=[];
  // things that stand in the landscape, found by index so they are always in the same place
  const put=(z,kind,x,n)=>{ const k=Math.floor((z-base)/STEP); if (k>=0 && k<NSEG) (buckets[k]||(buckets[k]=[])).push({z,kind,x,n}); };
  for (let n=Math.floor((camZ-10)/21)-1; n<=Math.ceil((camZ+160)/21); n++){ if (n>=1) put(10+n*21, 'mill', n%2?-4.8:4.8, n); }
  for (let n=Math.floor((camZ-10)/17)-1; n<=Math.ceil((camZ+160)/17); n++){ if (n>=1){ const side=oHash(n*3.1)<0.5?-1:1; put(7+n*17+oHash(n)*6, 'farm', side*(10+oHash(n+5)*16), n); } }
  put(62,'pump',9.6,0);
  for (let n=Math.floor((camZ-5)/6)-1; n<=Math.ceil((camZ+150)/6); n++){ if (n>=1){ for (const s of [-1,1]) if (oHash(n*7+s)<0.8) put(n*6+oHash(n+s)*3, 'tree', s*(7.9+oHash(n*5+s)*0.5), n*2+s); } }
  for (let n=Math.floor((camZ-5)/9); n<=Math.ceil((camZ+130)/9); n++){ if (n>=1){ const s=oHash(n*2.2)<0.5?-1:1; put(n*9+oHash(n)*5,'cow',s*(11+oHash(n+9)*20),n); } }
  for (let k=NSEG-1;k>=0;k--){
    const z0=base+k*STEP, z1=z0+STEP, dz=z0+STEP/2-camZ; if (z1-camZ<0.5) continue;
    const f=fog(dz), idx=Math.round(z0/STEP), fm=col=>oRgb(oMix(col,OP.haze,f));
    for (const s of [-1,1]){
      for (let b=0;b<9;b++){ const xa=s*(7.4+5.5*b), xb=s*(7.4+5.5*(b+1)); let col=oMix((b+idx%2)%2?OP.fieldA:OP.fieldB, [168,190,104], oHash(idx*5+b*3+(s>0?1:0))*0.22);
        if (s<0){ const p=oC((t-9.0-b*0.28-(idx%5)*0.07)/2.4); if (p<1){ const wc=oMix(oMix(OP.water,[118,168,180],((idx+b)%2)*0.14),OP.waterFar,Math.min(1,f)), mud=[116,104,72]; col=p<0.5?oMix(wc,mud,oS(p*2)):oMix(mud,col,oS((p-0.5)*2)); } }
        band(xa,0,xb,0,z0,z1+0.02,fm(col)); }
      for (const dx of [23.9,40.4]) band(s*dx,0,s*(dx+0.55),0,z0,z1+0.02,fm(OP.ditch));
      band(s*7.4,0,s*5.4,YC,z0,z1+0.02,fm(OP.slopeOut)); band(s*5.4,YC,s*4.2,YC,z0,z1+0.02,fm(OP.crest));
      band(s*4.2,YC,s*3.0,0,z0,z1+0.02,fm(s<0?OP.slopeLit:OP.slopeShade)); }
    if (idx%10===0) { band(-62,0,-7.4,0,z0,z0+0.5,fm(OP.ditch)); band(7.4,0,62,0,z0,z0+0.5,fm(OP.ditch)); }
    const wcol=oMix(oMix(OP.water,[110,160,172],idx%2?0.12:0),OP.waterFar,Math.min(1,f*1.4+0.12)); band(-3.0,0,3.0,0,z0,z1+0.02,oRgb(wcol));
    for (const o of (buckets[k]||[])){
      const odz=o.z-camZ; if (odz<0.5) continue; const of=fog(odz), ofm=col=>oRgb(oMix(col,OP.haze,of)), cf=oRgb(OP.ink), ink=Math.max(0.8,F/odz*0.05);
      c.lineWidth=ink; c.strokeStyle='rgba(38,38,31,'+(0.8*(1-of))+')';
      if (o.kind==='tree'){ const [tx,ty,s]=proj(o.x,0,o.z), [,cy]=proj(o.x,3.4,o.z); c.strokeStyle=ofm([90,70,50]); c.lineWidth=Math.max(1,s*0.16); c.beginPath(); c.moveTo(tx,ty); c.lineTo(tx,cy+s*0.9); c.stroke();
        c.fillStyle=ofm(oHash(o.n)<0.5?[98,132,64]:[84,118,58]); c.beginPath(); c.ellipse(tx,cy+s*0.25,s*1.05,s*1.55,0,0,7); c.fill(); }
      else if (o.kind==='cow'){ const [px,py,s]=proj(o.x,0,o.z); c.fillStyle=ofm([48,44,40]); c.beginPath(); c.ellipse(px,py-s*0.35,s*0.8,s*0.4,0,0,7); c.fill(); c.fillStyle=ofm([236,232,220]); c.beginPath(); c.ellipse(px-s*0.1,py-s*0.4,s*0.35,s*0.2,0,0,7); c.fill(); }
      else if (o.kind==='farm' || o.kind==='pump'){ const big=o.kind==='pump', hw=big?2.4:1.7, wh=big?3.0:2.1, rh=big?2.0:1.5; const a=proj(o.x-hw,0,o.z), b=proj(o.x+hw,wh,o.z), r=proj(o.x,wh+rh,o.z), l=proj(o.x-hw*1.15,wh,o.z), rr=proj(o.x+hw*1.15,wh,o.z);
        c.fillStyle=ofm(big?OP.brick:OP.cream); c.fillRect(a[0],b[1],b[0]-a[0],a[1]-b[1]); c.strokeRect(a[0],b[1],b[0]-a[0],a[1]-b[1]);
        c.fillStyle=ofm(big?[60,54,48]:OP.brick); c.beginPath(); c.moveTo(l[0],l[1]); c.lineTo(r[0],r[1]); c.lineTo(rr[0],rr[1]); c.closePath(); c.fill(); c.stroke();
        if (big){ const ch=proj(o.x+hw*0.55,wh+rh*0.5,o.z), cb=proj(o.x+hw*0.55,wh+rh*0.5+4.2,o.z); c.fillStyle=ofm(OP.brick); c.fillRect(ch[0]-ch[2]*0.28,cb[1],ch[2]*0.56,ch[1]-cb[1]); c.strokeRect(ch[0]-ch[2]*0.28,cb[1],ch[2]*0.56,ch[1]-cb[1]);
          for (let q=0;q<5;q++){ const ph=((t*0.35+q/5)%1); c.fillStyle='rgba(120,114,104,'+(0.32*(1-ph)*(1-of))+')'; c.beginPath(); c.arc(cb[0]+ph*ch[2]*2.2, cb[1]-ph*ch[2]*3.4, ch[2]*(0.35+ph*0.9), 0, 7); c.fill(); } } }
      else if (o.kind==='mill'){ const bx=o.x, dxm=bx-camX, kx=oC(odz/Math.hypot(dxm,odz),0.14,1);
        const p1=proj(bx-0.95,YC,o.z), p2=proj(bx-0.55,YC+5.4,o.z), p3=proj(bx+0.55,YC+5.4,o.z), p4=proj(bx+0.95,YC,o.z), tip=proj(bx,YC+6.6,o.z), hub=proj(bx,YC+5.3,o.z), s=hub[2];
        c.fillStyle=ofm(OP.wood); c.beginPath(); c.moveTo(p1[0],p1[1]); c.lineTo(p2[0],p2[1]); c.lineTo(p3[0],p3[1]); c.lineTo(p4[0],p4[1]); c.closePath(); c.fill(); c.stroke();
        c.fillStyle=cf; c.globalAlpha=1-of; c.beginPath(); c.moveTo(p2[0]-s*0.15,p2[1]); c.lineTo(tip[0],tip[1]); c.lineTo(p3[0]+s*0.15,p3[1]); c.closePath(); c.fill(); c.globalAlpha=1;
        if (odz<70){ const sg=bx<0?1:-1; for (let q=0;q<7;q++){ const ph=(t*0.8+q/7)%1, px=bx+sg*(0.9+ph*(Math.abs(bx)-0.9+0.1)), py=YC+0.35+Math.sin(ph*Math.PI)*0.9-ph*(YC+0.35); const pj=proj(px,Math.max(0,py),o.z); c.fillStyle='rgba(228,240,242,'+(0.8*(1-of)*(1-ph*0.3))+')'; c.beginPath(); c.arc(pj[0],pj[1],Math.max(0.8,pj[2]*0.06),0,7); c.fill(); } }
        const ang=t*0.85+o.n, len=s*3.7;
        for (let q=0;q<4;q++){ const an=ang+q*Math.PI/2, ca=Math.cos(an)*kx, sa=Math.sin(an); c.strokeStyle=ofm(OP.ink); c.lineWidth=Math.max(1,s*0.1); c.beginPath(); c.moveTo(hub[0],hub[1]); c.lineTo(hub[0]+ca*len,hub[1]+sa*len); c.stroke();
          c.lineWidth=Math.max(0.8,s*0.05); for (let r=1;r<=4;r++){ const fr=0.3+r*0.16, px=hub[0]+ca*len*fr, py=hub[1]+sa*len*fr, nx=-Math.sin(an)*s*0.5*kx, ny=Math.cos(an)*s*0.5, w=len*0.12; c.beginPath(); c.moveTo(px,py); c.lineTo(px+nx,py+ny); c.lineTo(px+nx+Math.cos(an)*kx*w,py+ny+sa*w); c.stroke(); } }
        c.fillStyle=cf; c.beginPath(); c.arc(hub[0],hub[1],Math.max(1.5,s*0.16),0,7); c.fill(); }
    }
  }
  // mist on the horizon
  { const g=c.createLinearGradient(0,y0-H*0.06,0,y0+H*0.09); g.addColorStop(0,'rgba(240,232,208,0)'); g.addColorStop(0.5,'rgba(240,232,208,.7)'); g.addColorStop(1,'rgba(240,232,208,0)'); c.fillStyle=g; c.fillRect(0,y0-H*0.06,W,H*0.15); }

  // the reeds: they fill the view, then lean aside and part for you, and finally fall away below
  if (reedsGone<1){
    const N=96; for (let i=0;i<N;i++){
      const u=oHash(i*1.7+0.3), side=u<0.5?-1:1, cc=(u-0.5)*2, ac=Math.abs(cc), e=oS((t-0.5-(1-ac)*0.4)/2.0);   // the centre ones move first
      const x0=W*(0.5+cc*0.58), x1=W*(0.5+side*(0.46+0.2*ac+oHash(i+9)*0.1)), bx=x0+(x1-x0)*e;
      const depth=0.55+0.9*oHash(i*2.3+1), hgt=H*(0.62+0.5*oHash(i*3.1+2))*(1-0.4*oS((t-2.6)/3.5))*depth, by=H*(1.03+0.05*oHash(i+4))+H*0.7*reedsGone*reedsGone+H*0.05*(1-depth);
      const lean=side*H*0.3*Math.sin(Math.PI*e)*(0.4+oHash(i+6))+side*H*0.05*e+Math.sin(t*1.3+i*1.9)*H*0.012*depth;
      const col=[[96,126,60],[118,138,70],[150,142,86],[78,108,52]][i%4], shade=0.78+0.3*depth;
      c.strokeStyle='rgb('+((col[0]*shade)|0)+','+((col[1]*shade)|0)+','+((col[2]*shade)|0)+')'; c.lineWidth=2+3.2*depth; c.beginPath(); c.moveTo(bx,by); c.quadraticCurveTo(bx+lean*0.15,by-hgt*0.55,bx+lean,by-hgt); c.stroke();
      if (i%3===0){ c.fillStyle='rgba(150,118,76,.85)'; c.beginPath(); c.ellipse(bx+lean,by-hgt-8*depth,3.4*depth+1.5,13*depth+4,Math.atan2(lean,hgt)*0.8,0,7); c.fill(); } } }
  // a warm light over everything, a soft vignette, and the first fade from paper
  c.fillStyle='rgba(255,200,130,.07)'; c.fillRect(0,0,W,H);
  { const g=c.createRadialGradient(W/2,H*0.5,Math.min(W,H)*0.45,W/2,H*0.5,Math.max(W,H)*0.85); g.addColorStop(0,'rgba(40,30,18,0)'); g.addColorStop(1,'rgba(40,30,18,.28)'); c.fillStyle=g; c.fillRect(0,0,W,H); }
  const v=oS((t-(OPEN_WRITE-1.4))/2.6); if (v>0){ const g=c.createLinearGradient(0,0,0,H*0.5); g.addColorStop(0,'rgba(239,230,207,'+(0.94*v)+')'); g.addColorStop(0.55,'rgba(239,230,207,'+(0.8*v)+')'); g.addColorStop(1,'rgba(239,230,207,0)'); c.fillStyle=g; c.fillRect(0,0,W,H*0.5); }
  if (t<0.8) { c.fillStyle='rgba(239,230,207,'+(1-oS(t/0.8))+')'; c.fillRect(0,0,W,H); }
  c.restore();
}
let OPENING=null;
function openAt(t){ const cv=$('openCv'), d=window.devicePixelRatio||1; openDraw(cv.getContext('2d'), cv.width/d, cv.height/d, t); }
function playOpening(done){
  if (OPENING) return; const wrap=document.createElement('div'); wrap.id='opening'; wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-label','Peil');
  wrap.innerHTML='<canvas id="openCv" aria-hidden="true"></canvas><div id="openName" aria-hidden="true"><span id="openWord">Peil</span></div><div id="openNib"></div><div id="openSub">Keep the water at the level you choose.</div><button id="openSkip" class="btn quiet">Skip</button><div id="openGo" aria-live="polite"></div>';
  document.body.appendChild(wrap); const cv=$('openCv'), c=cv.getContext('2d'), dpr=Math.min(window.devicePixelRatio||1,2), word=$('openWord'), nib=$('openNib'), sub=$('openSub'), go=$('openGo');
  const size=()=>{ const W=window.innerWidth, H=window.innerHeight; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px'; c.setTransform(dpr,0,0,dpr,0,0); };
  size(); window.addEventListener('resize', size);
  let t0=performance.now(), raf=0, over=false, ready=false; OPENING={};
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('italic 400 64px Fell'), document.fonts.load('500 16px "Alegreya Sans"')]).then(()=>{ t0=performance.now(); }).catch(()=>{});
  const finish=()=>{ if (over) return; over=true; cancelAnimationFrame(raf); window.removeEventListener('resize', size); wrap.classList.add('out'); setTimeout(()=>{ wrap.remove(); OPENING=null; }, 520); if (typeof initAudio==='function') initAudio(); if (done) done(); };
  const frame=(now)=>{ const t=REDUCED?OPEN_END+1:(now-t0)/1000; openDraw(c, window.innerWidth, window.innerHeight, Math.min(t,OPEN_END+60));
    const w=oS((t-OPEN_WRITE)/2.4), r=word.getBoundingClientRect(); word.style.clipPath='inset(0 '+((1-w)*100)+'% 0 0)';
    nib.style.opacity=(w>0&&w<1)?1:0; nib.style.left=(r.left+r.width*w)+'px'; nib.style.top=(r.top+r.height*(0.62+0.08*Math.sin(w*30)))+'px';
    sub.style.opacity=oS((t-OPEN_WRITE-2.2)/1.4);
    if (t>=OPEN_END+0.4 && !ready){ ready=true; go.textContent='Tap to begin'; go.style.opacity=1; $('openSkip').classList.add('hide'); }
    if (!over) raf=requestAnimationFrame(frame); };
  raf=requestAnimationFrame(frame);
  $('openSkip').onclick=e=>{ e.stopPropagation(); finish(); };
  wrap.addEventListener('click', ()=>{ if (ready) finish(); });
  document.addEventListener('keydown', function k(e){ if (over){ document.removeEventListener('keydown',k); return; } if (e.key==='Escape' || ((e.key==='Enter'||e.key===' ') && ready)){ e.preventDefault(); finish(); } });
}
// First launch: the opening, then the lesson. Automated tests skip it like the lesson film.
function openFirst(){ const go=()=>startScenario('leren',false); if (filmAllowed()) playOpening(go); else go(); }
