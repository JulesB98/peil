"use strict";
/* ===== FREIGHT =====
   Grain carts carry a farm's income along the road network to town and pay on arrival, so a cut road
   stops the money. Coal carts and barges are there to be watched: they follow the real network but carry no money.
   Cart: {k:'g'|'c', i:cell, v:value, p:progress to next cell, w:ticks waiting, path:[cells] (coal only), n:index in path} */

function netStart(i){ const g=G; if (g.net[i]) return i; for (const j of neighbors4(i)) if (g.net[j]) return j; return -1; }

// Locks and grain barges. A lock sits on a dike with the boezem on one side and polder water on the other.
// Farms next to navigable water (DRAFT deep, joined to a lock) ship by barge: BARGE_BONUS more money,
// but each barge through the lock lets LOCK_SPILL of boezem water into the polder, and a barge on water
// that gets too shallow runs aground. So the canal level becomes something to manage, not just to lower.
function lockSides(p){
  const g=G, C=g.C, x=p%C, y=(p/C)|0, pairs=[];
  if (x>0 && x<C-1) pairs.push([p-1,p+1]); if (y>0 && y<g.R-1) pairs.push([p-C,p+C]);
  for (const [a,b] of pairs){
    if (g.kind[a]===1 && g.kind[b]===0 && g.dike[b]===0) return [b,a];
    if (g.kind[b]===1 && g.kind[a]===0 && g.dike[a]===0) return [a,b];
  }
  return null;
}
const navigable = (i) => G.kind[i]===0 && G.dike[i]===0 && G.depth[i]>=DRAFT;
function waterways(){                      // wPar: next cell towards a lock along navigable water (the lock itself at the end)
  const g=G; if (g.wTick===g.tick) return; g.wTick=g.tick;
  if (!g.wPar || g.wPar.length!==g.N) g.wPar=new Int32Array(g.N);
  g.wPar.fill(-1); if (!g.locks.length) return;
  const q=[];
  for (const p of g.locks){ const sd=lockSides(p); if (sd && navigable(sd[0]) && g.wPar[sd[0]]<0){ g.wPar[sd[0]]=p; q.push(sd[0]); } }
  for (let h=0; h<q.length; h++){ const i=q[h]; for (const j of neighbors4(i)) if (g.wPar[j]<0 && navigable(j)){ g.wPar[j]=i; q.push(j); } }
}
function waterStart(i){ const g=G; if (!g.wPar || !g.locks.length) return -1; for (const j of neighbors4(i)) if (g.wPar[j]>=0) return j; return -1; }
function shipLinked(i){ return waterStart(i)>=0; }

function grainCart(farm){
  const g=G, w=waterStart(farm);
  if (w>=0 && g.boats.length<60){ const v=g.stock[farm]; g.stock[farm]=0; g.boats.push({i:w, v:v*BARGE_BONUS, p:0, w:0}); g.flags.shipped=(g.flags.shipped||0)+1; return; }
  const s=netStart(farm); if (s<0) return;
  const v=g.stock[farm]; g.stock[farm]=0;
  if (g.carts.length>400){ g.money+=v; return; }           // safety valve: never let carts pile up without end
  g.carts.push({k:'g', i:s, v, p:0, w:0});
}
function coalCart(pump){
  const g=G, s=netStart(pump); if (s<0 || !g.coal) return;
  if (g.coal.length>40) return;
  const path=[]; for (let i=s; i>=0 && path.length<4000; i=g.netPar[i]) path.push(i);
  if (path[path.length-1]!==g.townIdx) return;
  path.reverse(); g.coal.push({k:'c', path, n:0, p:0});
}

function freightTick(){
  const g=G; if (!g.coal) g.coal=[]; if (!g.barges) g.barges=[];
  if (g.locks.length && (g.tick%6===0 || !g.wPar)) waterways();
  // grain barges: follow wPar to the lock, sell there, and let boezem water in as they pass
  if (g.boats.length){ let kb=0;
    for (let q=0;q<g.boats.length;q++){ const b=g.boats[q]; let alive=true;
      const nx = g.wPar ? g.wPar[b.i] : -1;
      if (nx<0){ b.p=0; b.w++; if (b.w>DAY*6){ alive=false; if (!g.flags.aground){ g.flags.aground=1; letter('A grain barge ran aground and its load rotted. Barges need '+DRAFT+' m of water all the way to the lock. Your pumps drained that canal too far: dig the barge canal deeper than the canal at the pump.', true); } } }
      else { b.w=0; b.p+=BARGE_SPEED;
        while (b.p>=1 && alive){ b.p-=1; const n2=g.wPar[b.i]; if (n2<0){ b.p=0; break; }
          if (g.struct[n2]===S.LOCK){ passLock(n2, b); alive=false; } else b.i=n2; } }
      if (alive) g.boats[kb++]=b; }
    g.boats.length=kb; }
  // grain: follow netPar home
  let keep=0;
  for (let q=0;q<g.carts.length;q++){
    const c=g.carts[q]; let alive=true;
    if (c.i===g.townIdx){ deliver(c); alive=false; }
    else if (g.netPar[c.i]<0){                                // road gone under the cart: wait, or hop to a road beside it
      c.p=0; c.w=(c.w||0)+1; const s=netStart(c.i); if (s>=0 && s!==c.i){ c.i=s; c.w=0; }
      else if (c.w>DAY*5) alive=false;                        // the grain spoils
    } else {
      c.w=0; c.p+=CART_SPEED;
      while (c.p>=1 && alive){ c.p-=1; c.i=g.netPar[c.i]; if (c.i===g.townIdx){ deliver(c); alive=false; } else if (g.netPar[c.i]<0){ c.p=0; break; } }
    }
    if (alive) g.carts[keep++]=c;
  }
  g.carts.length=keep;
  // coal: town to pump, for show
  keep=0;
  for (let q=0;q<g.coal.length;q++){ const c=g.coal[q]; c.p+=CART_SPEED; while (c.p>=1){ c.p-=1; c.n++; } if (c.n<c.path.length-1) g.coal[keep++]=c; }
  g.coal.length=keep;
  // barges on the boezem: more trade, more barges
  const L=g.lane.length;
  if (g.tick%12===0){
    const want = L>14 ? Math.min(3, Math.floor(((g.m&&g.m.farmsLinked)||0)/4) + (g.flags.steamRan?1:0)) : 0;
    if (g.barges.length<want) g.barges.push({pos:0, dir:1});
    else if (g.barges.length>want) g.barges.pop();
  }
  for (const b of g.barges){ b.pos+=b.dir*0.22; if (b.pos>=L-1){ b.pos=L-1; b.dir=-1; } else if (b.pos<=0){ b.pos=0; b.dir=1; } }
}
function passLock(p, b){
  const g=G, sd=lockSides(p); g.money+=b.v; g.flags.lockPass=(g.flags.lockPass||0)+1;
  if (sd){ const v=takeWater(sd[1], LOCK_SPILL); addWater(sd[0], v); }
  if (typeof addFloater==='function') addFloater(p, '+ƒ'+Math.round(b.v));
  sfx('coin');
}
function deliver(c){
  const g=G; g.money+=c.v;
  if (typeof addFloater==='function') addFloater(g.townIdx, '+ƒ'+Math.round(c.v));
  sfx('coin');
}
// After the network changes: coal carts and barges are for show, so simply clear the ones that lost their way.
function freightRepath(){
  const g=G; if (!g.carts) g.carts=[];
  if (g.coal) g.coal=g.coal.filter(c=>c.path.every(i=>g.net[i]));
  if (g.barges && g.barges.length){ const L=g.lane.length; if (L<2) g.barges=[]; else for (const b of g.barges) b.pos=clamp(b.pos,0,L-1); }
}

// Positions in cell units for the renderer: [x, y, kind]
function freightSprites(out){
  const g=G, C=g.C; out.length=0;
  const mid=(a,b,t)=>{ const ax=a%C, ay=(a/C)|0, bx=b%C, by=(b/C)|0; return [ax+(bx-ax)*t+0.5, ay+(by-ay)*t+0.5]; };
  for (const c of g.carts){ const nx=g.netPar[c.i]; const m=mid(c.i, nx>=0?nx:c.i, c.p); out.push([m[0], m[1], 0]); }
  if (g.coal) for (const c of g.coal){ const a=c.path[c.n], b=c.path[Math.min(c.n+1,c.path.length-1)]; const m=mid(a,b,c.p); out.push([m[0], m[1], 1]); }
  for (const b of g.boats){ const nx=g.wPar?g.wPar[b.i]:-1; const m=mid(b.i, nx>=0?nx:b.i, b.p); out.push([m[0], m[1], nx<0?4:3, (nx>=0?nx%C:0)-(b.i%C), (nx>=0?(nx/C)|0:0)-((b.i/C)|0)]); }
  if (g.barges) for (const b of g.barges){ const k=Math.floor(b.pos), a=g.lane[k], n=g.lane[Math.min(k+1,g.lane.length-1)]; if (a===undefined) continue; const m=mid(a,n,b.pos-k); out.push([m[0], m[1], 2, (n%C)-(a%C), ((n/C)|0)-((a/C)|0)]); }
  return out;
}
