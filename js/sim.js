"use strict";
/* ===== SIMULATION =====
   One tick is one game hour. The order of the steps in tick() matters and is covered by tests/sim.test.js. */
const surf = (i) => G.ground[i]+G.dike[i]+G.depth[i];
function hasWater(i){ return G.kind[i]>0 || G.depth[i]>0.02; }
function addWater(i, v){ if (G.kind[i]===1) G.boezem += v/G.bArea; else if (G.kind[i]===0) G.depth[i]+=v; }
function takeWater(i, v){ if (G.kind[i]===1){ G.boezem -= v/G.bArea; return v; } if (G.kind[i]===2) return v; const t=Math.min(v, G.depth[i]); G.depth[i]-=t; return t; }

function stormT0(st){ return (Date.parse(st.date+'T00:00:00Z') - G.startMs)/3600000; }
function stormAt(t){
  let best=null;
  for (const st of G.sc.storms){
    const t0 = stormT0(st);
    if (t>=t0 && t<=t0+st.dur){ const env=Math.pow(Math.sin(Math.PI*(t-t0)/st.dur),2); if (!best || env*st.surge>best.env*best.surge) best={env, surge:st.surge, st, t0}; }
  }
  return best;
}
function windAt(t){ return clamp(0.52 + 0.28*Math.sin(t/41) + 0.18*Math.sin(t/13.3+1.3) + 0.1*Math.sin(t/5.7+2.1), 0.05, 0.93); }
// Weather is a pure function of the tick, so a loaded save shows the right sky at once.
function setWeather(t){
  const g=G, st=stormAt(t);
  g.stormEnv = st ? st.env : 0;
  g.wind = st && st.env>0.2 ? 1 : windAt(t);
  const rainy = hash2(Math.floor(t/DAY), 3, g.sc.seed) < 0.3;
  g.rain = st ? 0.0004 + 0.0018*st.env : (rainy ? 0.00042 : 0);
  g.sea = 0.75*Math.sin(2*Math.PI*t/12.42) + (st ? st.surge*st.env : 0);
}

let delta = null, stackBuf=null, compMark=null, cellBuf=null;

function tick(){
  const g=G, {N,C,R}=g; g.tick++; const t=g.tick;
  setWeather(t);

  // rain, seepage, infiltration, evaporation
  const bz=g.boezem, rain=g.rain;
  for (let i=0;i<N;i++){
    if (g.kind[i]!==0) continue;
    let d=g.depth[i] + rain;
    const top=g.ground[i]+g.dike[i];
    if (top > bz+0.05){ if (d>0) d = Math.max(0, d*0.96-0.001); }
    else { d += SEEP[g.soil[i]]*(bz-top); if (!rain) d = Math.max(0, d-0.00008); }
    g.depth[i]=d;
  }
  g.boezem += rain*0.6;
  // ditch drainage into canals
  for (let i=0;i<N;i++){
    const nc=g.nearCanal[i]; if (nc<0 || nc===i || g.canal[i]) continue;
    const d=g.depth[i]; if (d<=0 || d>0.25) continue;
    const m=Math.min(d, 0.002+0.04*d); g.depth[i]-=m; g.depth[nc]+=m;
  }
  // pumps
  for (const p of g.pumps){
    const T=PUMP[g.struct[p]], inI=g.pin[p], outI=g.pout[p];
    let flow=0, state=0;
    if (inI<0 || outI<0) state=6;                                   // no valid sides
    else if (!hasWater(inI) || (g.kind[inI]===0 && g.depth[inI]<0.03)) state=1; // nothing to pump
    else if (g.sc.peil && g.region[inI]>=0 && surf(inI) <= g.rLvl[g.region[inI]]+0.01) state=8;  // resting at its peil
    else if (g.flags.holdPeil && g.locks.length && g.depth[inI]<=DRAFT+0.05 && lockRegion(g.region[inI])) state=7; // holding barge water
    else {
      const lift=surf(outI)-surf(inI);
      if (lift > T.lift) state=2;                                   // too high
      else if (T.net && (!connected(p) || g.money<=0)) state=3;     // no coal / power
      else if (T.wind && g.wind>=0.97) state=4;                     // storm: sails furled
      else {
        const rate=T.cap*(1-0.35*Math.max(0,lift)/T.lift)*(T.wind?g.wind:1);
        flow=takeWater(inI, rate); addWater(outI, flow);
        if (flow>0.001){
          if (g.struct[p]===S.STEAM){ g.flags.steamRan=1; if (t % COAL_EVERY === (p % COAL_EVERY)) coalCart(p); }
          const ri=g.region[inI], ro=g.region[outI];
          if (ri>=0 && ri===g.lakeRegion && ro>=0 && !g.rOpen[ro] && ro!==ri) g.flags.gangIn=1;
          if (ri>=0 && ri!==g.lakeRegion && !g.rOpen[ri] && (g.kind[outI]===1 || (ro>=0 && g.rOpen[ro]))) g.flags.gangOut=1;
        }
        if (T.upkeep && flow>0.001) g.money-=T.upkeep;
      }
    }
    g.pumpFlow[p]=flow; g.pumpState[p]=state;
  }
  // sluices: only outward (to boezem from polder, or to sea)
  for (const p of g.sluices){
    const nb=neighbors4(p); let hi=-1, lo=-1, sh=-1e9, sl=1e9;
    for (const j of nb){ if (!hasWater(j) || g.dike[j]>0) continue; const s=surf(j); if (g.kind[j]!==2 && s>sh){ sh=s; hi=j; } if (g.kind[j]>0 && s<sl){ sl=s; lo=j; } }
    let f=0;
    if (hi>=0 && lo>=0 && hi!==lo && sh>sl && g.kind[lo]>g.kind[hi]){
      let cap=Math.min(2.5, 1.6*(sh-sl));
      if (g.kind[hi]===1) cap=Math.min(cap, Math.max(0, g.boezem-BZ_NORM)*g.bArea*0.5); // water board keeps the boezem at target
      f=takeWater(hi, cap); addWater(lo, f); }
    g.pumpFlow[p]=f;
  }
  refreshLumped();
  // diffusion
  if (!delta || delta.length!==N){ delta=new Float32Array(N); stackBuf=new Int32Array(N); compMark=new Int32Array(N); cellBuf=new Int32Array(N); }
  const K=0.24;
  for (let sub=0; sub<3; sub++){
    delta.fill(0);
    for (let y=0;y<R;y++) for (let x=0;x<C;x++){
      const i=y*C+x;
      if (x<C-1) flowPair(i, i+1, K);
      if (y<R-1) flowPair(i, i+C, K);
    }
    let bsum=0;
    for (let i=0;i<N;i++){ const dv=delta[i]; if (dv===0) continue; const k=g.kind[i]; if (k===1) bsum+=dv; else if (k===0) g.depth[i]=Math.max(0, g.depth[i]+dv); }
    g.boezem += bsum/g.bArea;
    refreshLumped();
  }
  level();
  // dike erosion and breaches
  for (let i=0;i<N;i++){
    if (g.dike[i]<=0 || g.depth[i]<=0.03) continue;
    g.dike[i] -= 0.03 + g.depth[i]*0.15;
    if (g.dike[i] <= 0.15) breach(i);
  }
  // land, buildings, economy
  let income=0, farmsOK=0, housesOK=0;
  const ripeStep = 1/(DAY*30);
  for (let i=0;i<N;i++){
    if (g.kind[i]!==0) continue;
    const d=g.depth[i], s=g.struct[i];
    if (g.polder[i] && g.dike[i]===0 && !g.canal[i]){
      if (d<0.03){
        if (g.ripe[i]<1){ g.ripe[i]=Math.min(1, g.ripe[i]+ripeStep*(g.soil[i]===1?0.8:1)); if (g.ripe[i]>=1 && !g.sold[i]){ g.sold[i]=1; g.money+=12; onLandSold(i); } }
        if (g.sc.peil){ const gp=peilGap(i); if (gp>0.8) g.ground[i]-=0.00006*SUBS[g.soil[i]]*(gp-0.8); }
        else if (g.soil[i]===1) g.ground[i]-=0.000004;
      } else if (d>0.3 && g.ripe[i]>0) g.ripe[i]=Math.max(0, g.ripe[i]-ripeStep*4);
    }
    if (s===S.FARM || s===S.HOUSE){
      if (d>0.12){ if (++g.flood[i] > 6){ g.struct[i]=0; g.flood[i]=0; g.stock[i]=0; if (s===S.HOUSE){ g.stats.housesLost++; } g.dirty=true; } continue; }
      g.flood[i]=0;
      if (!connected(i) && !(s===S.FARM && shipLinked(i))) continue;
      if (s===S.FARM){
        // grain piles up at the farm and leaves by cart (freight.js); the cart pays when it reaches town
        farmsOK++; const inc=0.08*FERT[g.soil[i]]*(g.polder[i]?0.4+0.6*g.ripe[i]:0.8)*(g.sc.peil && g.polder[i] ? peilYield(peilGap(i)) : 1);
        income += inc; g.stock[i] += inc; if (g.stock[i] >= CART_LOAD) grainCart(i);
      }
      else housesOK++;
    }
  }
  const pop=housesOK*5, food=farmsOK*8;
  const tax = housesOK*0.04*(pop<=food?1:0.5);
  g.money += tax; income += tax;
  g.pop=pop; g.food=food; g.income=income;
  freightTick();
  if (g.dirty){ g.dirty=false; rebuild(); }
  if (t % 6 === 0) metrics();
  if (t % DAY === 0) dailyCheck();
  stormEvents(t);
}

function flowPair(i, j, K){
  const g=G, ki=g.kind[i], kj=g.kind[j];
  if (ki!==0 && ki===kj) return;
  const si=g.ground[i]+g.dike[i]+g.depth[i], sj=g.ground[j]+g.dike[j]+g.depth[j];
  let a, b, dh;
  if (si>sj){ a=i; b=j; dh=si-sj; } else if (sj>si){ a=j; b=i; dh=sj-si; } else return;
  const avail = g.kind[a]===2 ? 50 : g.depth[a];
  if (avail<=0) return;
  const f=Math.min(dh*K, avail*0.24);
  if (f<1e-7) return;
  delta[a]-=f; delta[b]+=f;
}

// Flatten every connected body of standing water to one level (binary search on the level).
function level(){
  const g=G, {N,C,R}=g; compMark.fill(-1);
  const cells=cellBuf;
  for (let s=0;s<N;s++){
    if (compMark[s]!==-1 || g.kind[s]!==0 || g.dike[s]>0 || g.depth[s]<=0.02) continue;
    let sp=0, n=0; stackBuf[sp++]=s; compMark[s]=s;
    while (sp){ const i=stackBuf[--sp]; cells[n++]=i; const x=i%C, y=(i/C)|0;
      for (let k=0;k<4;k++){ let j; if (k===0){ if (x===0) continue; j=i-1; } else if (k===1){ if (x===C-1) continue; j=i+1; } else if (k===2){ if (y===0) continue; j=i-C; } else { if (y===R-1) continue; j=i+C; }
        if (compMark[j]!==-1 || g.kind[j]!==0 || g.dike[j]>0 || g.depth[j]<=0.02) continue; compMark[j]=s; stackBuf[sp++]=j; } }
    if (n<2) continue;
    let V=0, lo=1e9, hi=-1e9;
    for (let q=0;q<n;q++){ const i=cells[q]; V+=g.depth[i]; const gr=g.ground[i]; if (gr<lo) lo=gr; if (gr+g.depth[i]>hi) hi=gr+g.depth[i]; }
    for (let it=0; it<22; it++){ const m=(lo+hi)/2; let v=0; for (let q=0;q<n;q++){ const dd=m-g.ground[cells[q]]; if (dd>0) v+=dd; } if (v>V) hi=m; else lo=m; }
    const Lv=(lo+hi)/2;
    for (let q=0;q<n;q++){ const i=cells[q]; g.depth[i]=Math.max(0, Lv-g.ground[i]); }
  }
}

function breach(i){
  const g=G;
  g.dike[i]=0; g.ground[i]-=0.3; g.road[i]=0;
  if (g.struct[i]!==S.TOWN) g.struct[i]=0;
  g.stats.breaches++; g.dirty=true;
  (g.fx = g.fx||[]).push({i, t:g.tick});
  if (!g.lastBreachMsg || g.tick-g.lastBreachMsg>DAY){ g.lastBreachMsg=g.tick; sfx('breach'); letter('Dike breach! Water is pouring through. Rebuild it once the water drops.', true); }
}

function stormEvents(t){
  const g=G;
  g.sc.storms.forEach((st, k) => {
    const t0=stormT0(st), f=g.stormFlags;
    if (!f['w'+k] && t>=t0-DAY*4){ f['w'+k]=1; setSpeed(0); letter('Storm warning: a surge of about +' + st.surge.toFixed(1) + ' m in 4 days. Check your dike heights and empty the boezem.', true); }
    if (!f['s'+k] && t>=t0){ f['s'+k]=1; letter('The storm has hit. The sea is high, the sluices are shut and the mills are furled.', true); }
    if (!f['p'+k] && t>=t0+st.dur+DAY*7){ f['p'+k]=1; g.stormsPassed++; }
    if (!f['e'+k] && t>=t0+st.dur){ f['e'+k]=1; letter(g.stats.breaches ? 'The storm has passed. Count the damage and close the breaches.' : 'The storm has passed and the dikes held. Watch for seepage over the next days.'); }
  });
}

/* ===== METRICS / GOALS ===== */
function metrics(){
  const g=G, C=g.C; let cropSum=0, tot=0, dry=0, farms=0, houses=0, dikes=0, canals=0, deep=0, sluices=0, electric=0, farmsLinked=0, seaMin=99, armSea=0;
  const open=[]; let vol=0, wsum=0, wlev=0;
  for (let i=0;i<g.N;i++){
    if (g.polder[i] && g.kind[i]===0 && !g.canal[i] && g.dike[i]===0){ vol+=g.depth[i]; if (g.depth[i]>0.05){ wsum+=g.depth[i]; wlev+=g.depth[i]*(g.ground[i]+g.depth[i]); } }
    if (g.kind[i]===0 && g.polder[i] && g.dike[i]===0){ const x=i%C, y=(i/C)|0;
      if ((x>0&&g.kind[i-1]===1)||(x<C-1&&g.kind[i+1]===1)||(y>0&&g.kind[i-C]===1)||(y<g.R-1&&g.kind[i+C]===1)) open.push(i); }
    if (g.canal[i]){ canals++; if (g.canal[i]>=2) deep++; }
    if (g.struct[i]===S.SLUICE) sluices++; else if (g.struct[i]===S.ELEC) electric++;
    else if (g.struct[i]===S.FARM && g.net && (connected(i) || shipLinked(i))) farmsLinked++;
    const front=seaFront(i); if (front) seaMin=Math.min(seaMin, g.ground[i]+g.dike[i]);
    if (g.kind[i]===2 && !openSeaCell(g,i)) armSea++;
    if (g.polder[i] && g.dike[i]===0 && !g.canal[i] && g.kind[i]===0){ tot++; if (g.depth[i]<0.05) dry++; }
    const s=g.struct[i]; if (s===S.FARM){ farms++; cropSum+=g.sc.peil && g.polder[i] ? peilYield(peilGap(i)) : 1; } else if (s===S.HOUSE) houses++;
    if (g.dike[i]>0 && (g.polder[i] || !front)) dikes++;
  }
  g.m = { crop: farms? cropSum/farms : 1, dry: tot? dry/tot : 0, farms, houses, pop:g.pop||0, pumps:(g.pumps||[]).length, dikes, openings:open.length, open, canals, deepCanals:deep, sluices, electric, farmsLinked, seaMin, armSea, enclosed: g.lakeRegion>=0 && g.rPolder ? g.rPolder[g.lakeRegion] : 0, basins: g.rSize? g.rSize.filter((n,id)=>!g.rOpen[id] && id!==g.lakeRegion && n>=3 && n<=150).length : 0, waterLeft: g.V0>50 ? vol/g.V0 : 0, lakeLevel: wsum>1 ? wlev/wsum : -99 };
}
function goalState(){
  const g=G, go=g.sc.goals, out=[];
  if (go.dry!=null) out.push({k:'dry', label:'Dry', v:g.m.dry, target:go.dry, ok:g.m.dry>=go.dry, pct:true});
  if (go.farms) out.push({k:'farms', label:'Farms', v:g.m.farms, target:go.farms, ok:g.m.farms>=go.farms});
  if (go.crop) out.push({k:'crop', label:'Crops', v:g.m.crop, target:go.crop, ok:g.m.farms>0 && g.m.crop>=go.crop, pct:true});
  if (go.pop) out.push({k:'pop', label:'People', v:g.m.pop, target:go.pop, ok:g.m.pop>=go.pop});
  if (go.keep){ const frac = g.houses0? g.m.houses/g.houses0 : 1; out.push({k:'keep', label:'Houses', v:frac, target:go.keep, ok:frac>=go.keep, pct:true, fail: frac<go.keep}); }
  if (go.steps){ const n=(g.sc.steps||[]).length; out.push({k:'steps', label:'Lesson', v:Math.min(g.step,n), target:n, ok:g.step>=n}); }
  if (go.storm) out.push({k:'storm', label:'Storm', ok:g.stormsPassed>=g.sc.storms.length, storm:true});
  return out;
}
function dailyCheck(){
  const g=G;
  for (const L of g.sc.letters){ if (!g.done[L.k] && L.when(g)){ g.done[L.k]=1; letter(L.text, L.alert); break; } }
  if (g.won || g.lost || g.sc.sandbox) return;
  stallAdvice(g);
  const gs=goalState();
  if (g.sc.goals.keep && g.stormsPassed>=g.sc.storms.length){
    const keep=gs.find(x=>x.k==='keep'); if (keep && !keep.ok){ g.lost=true; setSpeed(0); showLose(); return; }
  }
  if (gs.length && gs.every(x=>x.ok)){ g.won=true; setSpeed(0); showWin(); return; }
  if (g.sc.deadline && g.tick>=g.sc.deadline*DAY){ g.lost=true; setSpeed(0); showLate(); }
}

// Drainage stalled? Every 30 days, if the dry share barely moved, say why in one letter.
// State lives in g.flags (saved), so no new fields on G.
function stallAdvice(g){
  const day=Math.floor(g.tick/DAY), f=g.flags, goal=g.sc.goals.dry;
  if (!goal || day%30!==0 || !g.pumps || !g.pumps.length) return;
  const dry=g.m.dry, prev=f.stallDry; f.stallDry=dry;
  if (prev==null || dry>=goal || dry<0.05 || dry-prev>0.01) return;
  if (f.stallMsg!=null && day-f.stallMsg<60) return;
  let far=0, low=0;
  for (let i=0;i<g.N;i++){
    if (!g.polder[i] || g.kind[i]!==0 || g.dike[i]>0 || g.canal[i] || g.depth[i]<0.05) continue;
    const nc=g.nearCanal[i]; if (nc<0) far++; else if (g.ground[i] < g.ground[nc]+g.depth[nc]) low++;
  }
  const states=g.pumps.map(p=>g.pumpState[p]), allHigh=states.every(s=>s===2);
  let text='';
  if (g.flags.holdPeil && states.some(s=>s===7)) text='Drainage has slowed because your lock keeps barge water in the canals, and land lower than that water stays wet. Tap the lock and choose Drain deeper if you need the land more than the barges.';
  else if (allHigh) text='Drainage has stopped: every pump is being asked to lift more than it can. Look at a pump to see its lift.';
  else if (low>=far && low>0) text='Drainage has stopped. The last pools lie lower than the water in your canals, and water only runs downhill. Deepen the canal next to each pump first, up to 3 m, then the rest.';
  else if (far>0) text='Drainage has stopped. Some wet land is more than 3 cells from any canal. Dig a canal through it, joined to a pump.';
  else if (states.every(s=>s===1)) text='Drainage has stopped: your pumps have no water at their feet. Dig a canal right up to each one.';
  if (!text) return;
  f.stallMsg=day; letter(text, true);
}

// Is there a lock whose polder side lies in this region? Pumps in that region hold barge water when the lock asks.
function lockRegion(r){ if (r<0) return false; for (const p of G.locks){ const sd=lockSides(p); if (sd && G.region[sd[0]]===r) return true; } return false; }


/* ----- Peil: the water level a basin is held at -----
   Each pump has a peil (0 = none: drain as deep as it can). A basin's level is the lowest peil among its pumps, never below its
   own deepest ground (canals count). Land wants to sit 0.5 to 1.2 m above that level: wetter and crops fail, drier and the
   soil shrinks (peat most) and yields fall. Only maps with sc.peil use this. */
function peilRegions(){
  const g=G, n=g.rSize.length; g.rLvl=new Float32Array(n).fill(-1e9); g.rBed=new Float32Array(n).fill(1e9);
  for (let i=0;i<g.N;i++){ const r=g.region[i]; if (r>=0 && g.kind[i]===0 && g.ground[i]<g.rBed[r]) g.rBed[r]=g.ground[i]; }
  const set=new Float32Array(n).fill(1e9);
  for (const p of g.pumps){ const a=g.pin[p]; if (a<0 || g.kind[a]!==0) continue; const r=g.region[a]; if (r<0) continue; if (g.peil[p]>PEIL_OFF+1 && g.peil[p]<set[r]) set[r]=g.peil[p]; }
  for (let r=0;r<n;r++) g.rLvl[r]=Math.max(set[r]<1e9 ? set[r] : -1e9, -1e9);
}
// level the land of cell i actually sees: the set peil, or the deepest bed the pumps can reach
function peilLevel(i){ const g=G, r=g.region[i]; if (r<0) return -99; return Math.max(g.rLvl[r], g.rBed[r]); }
function peilGap(i){ return G.ground[i]-peilLevel(i); }
function peilYield(gap){ if (gap<0.5) return Math.max(0, (gap-0.1)/0.4); if (gap>1.2) return Math.max(0.55, 1-0.3*(gap-1.2)); return 1; }
// set the peil of every pump in the same basin as pump p, in 0.25 m steps; going to the bed (or below) means no peil
function nudgePeil(p, dir){
  const g=G, a=g.pin[p]; if (a<0 || g.kind[a]!==0) return false; const r=g.region[a]; if (r<0) return false;
  const bed=g.rBed[r], cur=Math.max(g.rLvl[r], bed); let v=Math.round((cur+dir*0.25)*4)/4; if (v<=bed+0.01) v=PEIL_OFF; v=Math.min(v, bed+4);
  for (const q of g.pumps) if (g.pin[q]>=0 && g.region[g.pin[q]]===r) g.peil[q]=v;
  peilRegions(); return true;
}
