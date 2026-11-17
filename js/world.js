"use strict";
/* ===== WORLD / GENERATION ===== */
let G = null;

// The whole game state. Every field is created here, in one literal, and never added later:
// that keeps the object in V8's fast mode (adding fields one by one with Object.assign made every tick about twice as slow).
function newGame(sc){
  const C=sc.C, R=sc.R, N=C*R;
  return { sc, C, R, N,
    // per cell, saved (ARR_KEYS)
    ground:new Float32Array(N), depth:new Float32Array(N), dike:new Float32Array(N), kind:new Uint8Array(N),
    soil:new Uint8Array(N), struct:new Uint8Array(N), road:new Uint8Array(N), canal:new Uint8Array(N), polder:new Uint8Array(N),
    ripe:new Float32Array(N), sold:new Uint8Array(N), flood:new Uint8Array(N), pin:new Int32Array(N).fill(-1), pout:new Int32Array(N).fill(-1),
    stock:new Float32Array(N), given:new Uint8Array(N), peil:new Float32Array(N).fill(PEIL_OFF),
    // scalars, saved
    tick:0, money:sc.money, boezem:BZ_NORM, townIdx:0, houses0:0, V0:0.5, step:0, unread:0, stormsPassed:0, won:false, lost:false,
    stats:{breaches:0, housesLost:0}, done:{}, stormFlags:{}, flags:{}, log:[], carts:[], boats:[],
    // weather and economy, recomputed every tick
    startMs:Date.parse(sc.start+'T00:00:00Z'), wind:0.5, sea:0.5, rain:0.5, stormEnv:0.5, pop:0, food:0, income:0.5,
    // transient
    dirty:false, fx:[], lastBreachMsg:0, coal:[], barges:[],
    // derived by rebuild() and metrics()
    bArea:0, region:null, rSize:null, rOpen:null, rPolder:null, lakeRegion:-1, pumps:[], sluices:[],
    pumpFlow:null, pumpState:null, pumpAng:null, net:null, netPar:null, nearCanal:null, lane:[], m:null,
    locks:[], wPar:null, wTick:-1, rLvl:null, rBed:null };
}
const ARR_KEYS = ['ground','depth','dike','kind','soil','struct','road','canal','polder','ripe','sold','flood','pin','pout','stock','given','peil'];

/* ----- map layout -----
   Every map is generated in one canonical frame: open sea along the top (rows 0-2), the sea dike on row 3,
   the boezem channel under it (rows 4-5) and down the left side. sc.flip = [x, y] mirrors the finished map,
   so the sea can lie at the bottom and the boezem on the right. Scripts (films, test playthroughs) use
   canonical coordinates through cellXY(), so they work whatever the flip.
   The lake is a union of ellipse lobes (sc.lake plus sc.lake.lobes), so shapes differ from map to map.
   Extra features: river (a meandering boezem channel), islands (old high ground), arms (sea arms open to the
   open sea through a mouth in the sea dike; dam the mouth and the arm becomes a lake), strips (peat lakes
   with narrow strips of land between them), seaLake (the lake lies right against the sea dike).
   An arm with sea:true is an estuary: dam it and it becomes inland water, but not polder to drain. */
function flipIdx(g, i){ const C=g.C, f=g.sc.flip||[0,0], x=i%C, y=(i/C)|0; return (f[1]?g.R-1-y:y)*C+(f[0]?C-1-x:x); }   // its own inverse
function cellXY(g, x, y){ return flipIdx(g, y*g.C+x); }
function canonY(g, i){ return (flipIdx(g, i)/g.C)|0; }
function mainIdx(g){ return cellXY(g, 1, 4); }                 // a cell of the boezem channel that every boezem cell must reach
function openSeaCell(g, i){ return g.kind[i]===2 && canonY(g, i)<3; }
function lobeR(L, x, y){ let r=1e9; for (const o of [[L.cx,L.cy,L.rx,L.ry], ...(L.lobes||[])]){ const dx=(x-o[0])/o[2], dy=(y-o[1])/o[3]; r=Math.min(r, Math.sqrt(dx*dx+dy*dy)); } return r; }
function seaFront(i){ const g=G; if (g.kind[i]!==0) return false; for (const j of neighbors4(i)) if (g.kind[j]===2) return true; return false; }
function homeCell(g){ const L=g.sc.lake||g.sc.arms[0]; return cellXY(g, Math.round(L.cx), Math.round(L.cy)); }
function riverX(sc, y){ return sc.river ? 1+Math.round(1.6+1.6*Math.sin(y/6.5+sc.seed)) : 1; }

function generate(sc){
  const C=sc.C, R=sc.R, N=C*R, s=sc.seed;
  const g = newGame(sc);
  const L = sc.lake, at=(x,y)=>y*C+x, inb=(x,y)=>x>=0&&y>=0&&x<C&&y<R;
  const water=(i,k,gr)=>{ g.kind[i]=k; g.ground[i]=gr; g.polder[i]=0; g.dike[i]=0; };
  for (let y=0;y<R;y++) for (let x=0;x<C;x++){
    const i=at(x,y), n=fbm(x,y,s), n2=fbm(x,y,s+99);
    g.ground[i] = sc.land + (n-0.5)*0.5;
    const sv = n2 + sc.soilBias*0.5;
    g.soil[i] = sv>0.62 ? 1 : (n2<0.3 ? 2 : 0);
    if (!L) continue;
    const r = lobeR(L, x, y) * (1 + (fbm(x,y,s+50)-0.5)*0.3);
    if (r < 1){
      g.polder[i]=1;
      const sh = r<0.55 ? 1 : 1-0.72*Math.pow((r-0.55)/0.45, 1.3);
      g.ground[i] = L.bottom*sh + (n-0.5)*L.vary;
      if (sc.soilBias>0.2 && n2>0.45) g.soil[i]=1;
    }
  }
  // ring: a strip of low polder land two cells wide around the lake, then a ring canal two cells wide.
  // Measured in cells (not in lobe radius), so small lobes get as thick a ring as big ones and it never has gaps.
  if (L && sc.ring){
    const dist=new Uint8Array(N).fill(255), q=[];
    for (let i=0;i<N;i++) if (g.polder[i]){ dist[i]=0; q.push(i); }
    for (let h=0;h<q.length;h++){ const i=q[h], x=i%C, y=(i/C)|0; if (dist[i]>=4) continue;
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if (!inb(nx,ny)) continue; const j=at(nx,ny); if (dist[j]!==255) continue; dist[j]=dist[i]+1; q.push(j); } }
    for (let i=0;i<N;i++){ const x=i%C, y=(i/C)|0;
      if (dist[i]===1 || dist[i]===2){ g.polder[i]=1; g.ground[i] = -0.85 + (fbm(x,y,s)-0.5)*0.2; }
      else if (dist[i]===3 || dist[i]===4) water(i, 1, -2.2); }
  }
  // peat lakes: long parallel lakes with narrow strips of land (legakkers) between them, joined at one end by a wetering
  if (sc.strips){ const P=sc.strips;
    for (let y=P.y0;y<=P.y1+2;y++) for (let x=P.x0;x<=P.x1;x++){ const i=at(x,y), n=fbm(x,y,s+5), k=(x-P.x0)%(P.w+P.gap);
      const end = y>P.y1;                                   // the wetering across the ends
      const from = P.y0 + Math.floor(hash2(Math.floor((x-P.x0)/(P.w+P.gap)),1,s)*P.ragged);   // strips start raggedly at the far end
      // the beds slope up toward the far end, so a lake dries from its far end inward and the player sees progress early
      const t = end ? 0 : clamp((P.y1-y)/(P.y1-P.y0),0,1);
      if (end || (k<P.w && y>=from)){ g.polder[i]=1; g.ground[i]=P.bottom+(P.top-P.bottom)*t+(n-0.5)*P.vary - (end?0.3:0); g.soil[i]=1; }
      else { g.polder[i]=0; g.ground[i]=-0.15+(n-0.5)*0.12; g.soil[i]=1; } } }
  // old high ground: islands and dunes
  for (const [cx,cy,rad,h] of sc.islands||[]) for (let y=0;y<R;y++) for (let x=0;x<C;x++){ const d=Math.hypot(x-cx,(y-cy)*0.8)/rad*(1+(fbm(x,y,s+70)-0.5)*0.5); if (d<1){ const i=at(x,y); g.polder[i]=0; g.kind[i]=0; g.ground[i]=Math.max(g.ground[i], h*(1-d*d)+0.3); g.soil[i]=2; } }
  // sea, sea dike, boezem channels
  const crest = sc.seaCrest || 3.4, top=sc.topChannel||[1, C-2];
  for (let x=0;x<C;x++){
    for (let y=0;y<3;y++) water(at(x,y), 2, -6);
    const d=at(x,3); g.kind[d]=0; g.polder[d]=0; g.ground[d]=0.8; g.dike[d]=crest-0.8; g.soil[d]=2;
    if (x>=top[0] && x<=top[1]) for (let y=4;y<6;y++){ const i=at(x,y); if (sc.seaLake && g.polder[i]) continue; water(i, 1, -2.2); }
  }
  for (let y=4;y<R-2;y++){ const x0=riverX(sc,y); for (let x=x0;x<x0+2;x++) water(at(x,y), 1, -2.2); if (sc.river){ const x1=riverX(sc,y+1); for (let x=Math.min(x0,x1);x<Math.max(x0,x1)+2;x++) water(at(x,y), 1, -2.2); } }
  // sluice on the sea dike
  const sl=at(sc.sluiceX||6, 3); g.struct[sl]=S.SLUICE; g.given[sl]=1;
  // sea arms: sea water through a mouth in the sea dike into one or more lobes, with sea dikes along every shore
  const armCell=new Uint8Array(N);
  for (const A of sc.arms||[]){
    const rr=(x,y)=>lobeR(A, x, y)*(1+(fbm(x,y,s+40)-0.5)*0.35);
    let mTo=R; for (let x=A.mouth[0];x<=A.mouth[1];x++) for (let y=3;y<R;y++) if (rr(x,y)<1){ mTo=Math.min(mTo, y+1); break; }   // the mouth runs down until it meets the arm
    for (let y=3;y<R;y++) for (let x=0;x<C;x++){ const i=at(x,y), r=rr(x,y);
      const mouth = x>=A.mouth[0] && x<=A.mouth[1] && y<=mTo;
      if (r<1 || mouth){ armCell[i]=1; const sh = r<0.5 ? 1 : 1-0.6*Math.pow(clamp((r-0.5)/0.5,0,1),1.2); g.kind[i]=2; g.dike[i]=0; g.struct[i]=0; g.polder[i]=A.sea?0:1; g.ground[i]=(mouth&&r>=1 ? A.bottom*0.8 : A.bottom*sh)+(fbm(x,y,s+3)-0.5)*(A.vary||0.3); } }
    for (let y=3;y<R;y++) for (let x=0;x<C;x++){ const i=at(x,y); if (armCell[i] || g.kind[i]===2 && y<3) continue;
      let near=false; for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if (inb(x+dx,y+dy) && armCell[at(x+dx,y+dy)]) near=true;
      if (near){ g.kind[i]=0; g.polder[i]=0; g.struct[i]=0; g.ground[i]=Math.max(g.ground[i], 0.5); g.dike[i]=crest-g.ground[i]; g.soil[i]=2; } }
  }
  // connect the lake (or ring) to the boezem
  const x0=(y)=>riverX(sc,y)+2;
  if (L && sc.strait){
    for (let x=x0(L.cy);x<C;x++){ const i=at(x,L.cy), j=i+C; if (g.polder[i] && g.ground[i]<-1.3 && g.ground[j]<-1.3) break; g.ground[i]=Math.min(g.ground[i],-1.3); g.ground[j]=Math.min(g.ground[j],-1.3); if (!g.polder[i]) g.kind[i]=1; if (!g.polder[j]) g.kind[j]=1; }
  } else if (L && sc.ring){
    for (let x=x0(L.cy);x<C;x++){ const i=at(x,L.cy); if (g.kind[i]===1 && x>x0(L.cy)+1) break; if (g.kind[i]===0 && !g.polder[i]){ g.kind[i]=1; g.ground[i]=-2.2; } }
  }
  // town
  const [tx,ty] = sc.town || [sc.predrained ? L.cx : C-5, 8];
  const ti = at(tx,ty); g.kind[ti]=0; g.ground[ti]=Math.max(g.ground[ti],0.4); g.struct[ti]=S.TOWN; g.polder[ti]=0; g.dike[ti]=0;
  g.townIdx = ti;
  // initial water
  g.boezem = BZ_NORM;
  for (let i=0;i<N;i++){
    if (g.kind[i]===0 && g.dike[i]===0 && g.ground[i] < BZ_NORM - 0.02 && (g.polder[i] || g.ground[i] < -1)) g.depth[i] = BZ_NORM - g.ground[i];
  }
  if (sc.predrained) predrain(g);
  flipMap(g);
  g.wind=0; g.sea=0; g.rain=0; g.stormEnv=0; g.income=0;
  g.houses0 = 0; g.V0=0; for (let i=0;i<N;i++){ if (g.struct[i]===S.HOUSE) g.houses0++; if (g.polder[i] && g.kind[i]!==1) g.V0+=g.kind[i]===2 ? Math.max(0,-g.ground[i]) : g.depth[i]; }
  return g;
}
// mirror every per-cell array (and the town) from the canonical frame into the map's real orientation
function flipMap(g){
  const f=g.sc.flip; if (!f || (!f[0] && !f[1])) return;
  for (const k of ARR_KEYS){ const a=g[k], b=a.slice(); for (let i=0;i<g.N;i++) a[flipIdx(g,i)]=b[i]; }
  g.townIdx=flipIdx(g, g.townIdx);
}

function predrain(g){
  const {C,R,N} = g;
  const nb = (i) => { const x=i%C, y=(i/C)|0, a=[]; if(x>0)a.push(i-1); if(x<C-1)a.push(i+1); if(y>0)a.push(i-C); if(y<R-1)a.push(i+C); return a; };
  for (let i=0;i<N;i++){
    if (!g.polder[i]) continue;
    if (nb(i).some(j => !g.polder[j])){ g.dike[i] = 0.2 - g.ground[i]; g.depth[i]=0; }
  }
  const L=g.sc.lake;
  for (let y=0;y<R;y++) for (let x=0;x<C;x++){
    const i=y*C+x; if (!g.polder[i] || g.dike[i]>0) continue;
    g.depth[i]=0; g.ripe[i]=1; g.sold[i]=1;
    if ((x - L.cx) % 5 === 0 || y === L.cy){ g.canal[i]=1; g.ground[i]=Math.min(g.ground[i]-1, L.bottom-1.1); g.depth[i]=0.3; }
    if (y % 9 === 0 && y !== L.cy) g.road[i]=1;
  }
  // road from town down to ring dike
  for (let y=9;y<R;y++){ const i=y*C+L.cx; if (g.dike[i]>0 && g.polder[i]) break; g.road[i]=1; }
  // steam pumps where the main canal meets the ring dike, mills where side canals do
  const pumpAt = (i, type) => { if (g.dike[i]>0 && !g.struct[i] && nb(i).some(j=>g.canal[j]) && nb(i).some(j=>g.kind[j]===1)){ g.struct[i]=type; g.given[i]=1; return true; } return false; };
  for (const dir of [-1,1]){ for (let x=L.cx; x>=0 && x<C; x+=dir){ const i=L.cy*C+x; if (g.dike[i]>0){ if (!pumpAt(i,S.STEAM)){ const k=g.kind[i+dir]; if (k===0){ g.kind[i+dir]=1; g.ground[i+dir]=-2.2; pumpAt(i,S.STEAM); } } break; } } }
  let placed=0;
  for (let i=0;i<N && placed<2;i++){ if (g.polder[i] && pumpAt(i, S.MILL)) placed++; }
  // farms and houses
  for (let i=0;i<N;i++){
    if (!g.polder[i] || g.dike[i]>0 || g.canal[i] || g.road[i]) continue;
    const n=nb(i); if (!n.some(j=>g.road[j])) continue;
    const h=hash2(i,7,g.sc.seed);
    if (h<0.22){ g.struct[i]=S.HOUSE; g.given[i]=1; } else if (h<0.42){ g.struct[i]=S.FARM; g.given[i]=1; }
  }
}

/* ===== DERIVED STATE ===== */
function neighbors4(i){ const C=G.C, x=i%C, y=(i/C)|0, a=[]; if(x>0)a.push(i-1); if(x<C-1)a.push(i+1); if(y>0)a.push(i-C); if(y<G.R-1)a.push(i+C); return a; }

// How "outside" a cell is, for choosing which way a pump faces.
function openness(j){ const g=G; if (g.kind[j]>0) return 2e9; const r=g.region[j]; if (r<0) return -1; return g.rOpen[r] ? 1e9 : 1e6-g.rSize[r]; }
function bestPair(p){
  const g=G, C=g.C, x=p%C, y=(p/C)|0, pairs=[];
  if (x>0 && x<C-1) pairs.push([p-1,p+1]); if (y>0 && y<g.R-1) pairs.push([p-C,p+C]);
  let best=null, bd=-1;
  for (const [a,b] of pairs){ if (g.dike[a]>0 || g.dike[b]>0) continue; if (g.kind[a]===2 && g.kind[b]===2) continue;
    let oa=openness(a), ob=openness(b); let inI=a, outI=b;
    if (oa>ob || g.kind[a]===2 || (oa===ob && surf(a)>surf(b))){ inI=b; outI=a; }
    if (g.kind[inI]===2) continue;
    const d=Math.abs(oa-ob)+(hasWater(inI)?0.5:0); if (d>bd){ bd=d; best=[inI,outI]; } }
  return best;
}
function autoDir(p){ const pr=bestPair(p); if (pr){ G.pin[p]=pr[0]; G.pout[p]=pr[1]; } else { G.pin[p]=-1; G.pout[p]=-1; } }
function sideName(j){ const g=G; if (j<0) return '?'; if (g.kind[j]===2) return 'sea'; if (g.kind[j]===1) return 'boezem'; const r=g.region[j];
  if (!g.polder[j]) return 'land';
  if (r>=0 && r!==g.lakeRegion && !g.rOpen[r] && g.rSize[r]<=150) return 'basin';
  return g.depth[j]>0.05 ? 'lake' : 'polder'; }
function pumpLift(p){ const a=G.pin[p], b=G.pout[p]; if (a<0||b<0) return 0; return surf(b)-surf(a); }

function rebuild(){
  const g=G, {N,C,R}=g;
  // boezem: only water still connected to the main channel stays boezem
  // sea arms: sea water no longer joined to the open sea (its mouth is dammed) becomes a lake in the polder,
  // or with sc.armLake a freshwater lake that joins the boezem (like the IJsselmeer behind the Afsluitdijk)
  { const sea=new Uint8Array(N), sq=[]; for (let i=0;i<N;i++) if (openSeaCell(g,i)){ sea[i]=1; sq.push(i); }
    while (sq.length){ const i=sq.pop(); for (const j of neighbors4(i)) if (!sea[j] && g.kind[j]===2){ sea[j]=1; sq.push(j); } }
    for (let i=0;i<N;i++) if (g.kind[i]===2 && !sea[i]){ if (g.sc.armLake) g.kind[i]=1; else { g.kind[i]=0; g.depth[i]=Math.max(0, -g.ground[i]); } } }
  const main=mainIdx(g), seen=new Uint8Array(N), bq=[];
  if (g.kind[main]===1){ seen[main]=1; bq.push(main); }
  // an arm lake stays boezem where it touches the dam (a dike facing the open sea); parts walled off from the dam become polder
  if (g.sc.armLake) for (let i=0;i<N;i++) if (g.kind[i]===1 && g.polder[i] && !seen[i] && neighbors4(i).some(j=>g.dike[j]>0 && neighbors4(j).some(k=>openSeaCell(g,k)))){ seen[i]=1; bq.push(i); }
  while (bq.length){ const i=bq.pop(); for (const j of neighbors4(i)) if (!seen[j] && g.kind[j]===1){ seen[j]=1; bq.push(j); } }
  for (let i=0;i<N;i++) if (g.kind[i]===1 && !seen[i]){ g.kind[i]=0; g.polder[i]=1; g.depth[i]=Math.max(0, g.boezem-g.ground[i]); }
  g.bArea=0; for (let i=0;i<N;i++) if (g.kind[i]===1) g.bArea++;
  // regions: areas of land/water separated by dikes
  g.region=new Int32Array(N).fill(-1); g.rSize=[]; g.rOpen=[]; g.rPolder=[];
  { const st=[]; for (let s0=0;s0<N;s0++){ if (g.region[s0]>=0 || g.kind[s0]!==0 || g.dike[s0]>0) continue;
      const id=g.rSize.length; let n=0, open=false, pol=0; g.region[s0]=id; st.push(s0);
      while (st.length){ const i=st.pop(); n++; if (g.polder[i]) pol++;
        for (const j of neighbors4(i)){ if (g.kind[j]>0) open=true; else if (g.dike[j]===0 && g.region[j]<0){ g.region[j]=id; st.push(j); } } }
      g.rSize.push(n); g.rOpen.push(open); g.rPolder.push(pol); } }
  g.lakeRegion=-1; { let best=0; g.rSize.forEach((n,id)=>{ if (!g.rOpen[id] && g.rPolder[id]>best){ best=g.rPolder[id]; g.lakeRegion=id; } }); }
  // pumps / sluices
  g.pumps=[]; g.sluices=[];
  g.locks=[];
  for (let i=0;i<N;i++){ const s=g.struct[i]; if (s>=1 && s<=3) g.pumps.push(i); else if (s===S.SLUICE) g.sluices.push(i); else if (s===S.LOCK) g.locks.push(i); }
  g.wTick=-1;
  for (const p of g.pumps){ const a=g.pin[p], b=g.pout[p]; if (a<0 || b<0 || g.dike[a]>0 || g.dike[b]>0 || g.kind[a]===2) autoDir(p); }
  peilRegions();
  if (!g.pumpFlow || g.pumpFlow.length!==N){ g.pumpFlow=new Float32Array(N); g.pumpState=new Uint8Array(N); g.pumpAng=new Float32Array(N); }
  // road network from town (roads, dike tops), breadth-first so netPar gives the shortest way home
  g.net = new Uint8Array(N); g.netPar = new Int32Array(N).fill(-1);
  { const q=[g.townIdx]; g.net[g.townIdx]=1;
    for (let h=0; h<q.length; h++){ const i=q[h], x=i%C, y=(i/C)|0;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=C||ny>=R) continue; const j=ny*C+nx;
        if (g.net[j]) continue; if (g.road[j] || g.dike[j]>0 || g.struct[j]===S.TOWN){ g.net[j]=1; g.netPar[j]=i; q.push(j); } } } }
  // canal proximity (Chebyshev 3)
  g.nearCanal = new Int32Array(N).fill(-1);
  const dist = new Uint8Array(N).fill(255); const qq=[];
  for (let i=0;i<N;i++) if (g.canal[i] && g.kind[i]===0){ g.nearCanal[i]=i; dist[i]=0; qq.push(i); }
  for (let h=0; h<qq.length; h++){
    const i=qq[h]; if (dist[i]>=3) continue; const x=i%C, y=(i/C)|0;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
      const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=C||ny>=R) continue; const j=ny*C+nx;
      if (dist[j]!==255 || g.kind[j]!==0 || g.dike[j]>0) continue; dist[j]=dist[i]+1; g.nearCanal[j]=g.nearCanal[i]; qq.push(j);
    }
  }
  // barge lane: the longest reach of boezem from the main channel
  g.lane = [];
  if (g.kind[main]===1){ const par=new Int32Array(N).fill(-2), q=[main]; par[main]=-1; let far=main;
    for (let h=0; h<q.length; h++){ const i=q[h]; far=i; for (const j of neighbors4(i)) if (par[j]===-2 && g.kind[j]===1){ par[j]=i; q.push(j); } }
    for (let i=far; i>=0; i=par[i]) g.lane.push(i); g.lane.reverse(); }
  refreshLumped();
  metrics();
  if (typeof freightRepath==='function') freightRepath();
  if (typeof markDirty==='function') markDirty();
}
function connected(i){ if (G.net[i]) return true; for (const j of neighbors4(i)) if (G.net[j]) return true; return false; }

function refreshLumped(){
  const g=G;
  for (let i=0;i<g.N;i++){
    if (g.kind[i]===1) g.depth[i]=Math.max(0, g.boezem-g.ground[i]);
    else if (g.kind[i]===2) g.depth[i]=Math.max(0, (g.sea||0)-g.ground[i]);
  }
}
