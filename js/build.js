"use strict";
/* ===== BUILDING =====
   toolAt(id, cell, commit) is the single source of truth for what a tool does on a cell.
   With commit=false it only answers {ok, cost, msg}, which is what the build preview shows.
   A result without msg is a silent skip (nothing to do there). */
function toolAt(id, i, commit){
  const g=G; if (i<0 || i>=g.N) return {ok:false};
  const k=g.kind[i], s=g.struct[i];
  const no = (msg) => ({ok:false, msg});
  const pay = (cost, fn) => { if (g.money<cost) return {ok:false, msg:'Not enough money ('+fmtMoney(cost)+').', cost, poor:true}; if (commit){ g.money-=cost; fn(); } return {ok:true, cost}; };
  switch(id){
    case 'dike': {
      if (k===2 && openSeaCell(g,i)) return no('Not in open sea.');
      if (k===2) return pay(Math.round(40+15*Math.max(0,-g.ground[i])), ()=>{ g.kind[i]=0; g.depth[i]=0; g.dike[i]=2.0-g.ground[i]; g.dirty=true; });   // a dam in a sea arm
      if (k===1) return pay(40, ()=>{ g.kind[i]=0; g.depth[i]=0; g.dike[i]=BZ_NORM+1.5-g.ground[i]; g.dirty=true; });
      if (s===S.FARM || s===S.HOUSE || s===S.TOWN) return no('Something is already built here.');
      if (g.dike[i]>0){ if (g.ground[i]+g.dike[i]>=7) return no('That dike is as high as it goes.'); return pay(10, ()=>{ g.dike[i]+=0.5; }); }
      const base=g.ground[i]+g.canal[i], crest=Math.max(base+1.0, BZ_NORM+1.5), h=crest-base;
      return pay(Math.round(8+10*h), ()=>{ if (g.canal[i]){ g.ground[i]=base; g.canal[i]=0; } g.dike[i]=h; g.depth[i]=0; g.dirty=true; });
    }
    case 'canal': {
      if (k!==0 || g.dike[i]>0 || s) return no(g.kind[i]===1 ? 'That is boezem water (the channel). Canals go on land or the lake bed.' : g.kind[i]===2 ? 'That is the sea. Canals go on land or the lake bed.' : 'Canals go on open land or lake bed.');
      if (g.canal[i]>=3) return no('This canal is already 3 m deep.');
      return pay(8, ()=>{ g.canal[i]++; g.ground[i]-=1; g.road[i]=0; g.dirty=true; });
    }
    case 'road': {
      if (k===2) return no('Not in the sea.');
      if (k===0 && g.depth[i]>0.3 && !g.canal[i]) return no('Too wet for a road. Drain it first.');
      if (s===S.FARM || s===S.HOUSE || g.road[i] || g.dike[i]>0) return {ok:false};
      return pay(5, ()=>{ g.road[i]=1; g.dirty=true; });
    }
    case 'remove': {
      if (s && s!==S.TOWN){ const refund=g.given[i] ? 0 : Math.round((TOOL[STRUCT_TOOL[s]].price||0)/2);
        if (commit){ g.money+=refund; g.struct[i]=0; g.given[i]=0; g.stock[i]=0; g.dirty=true; } return {ok:true, cost:-refund}; }
      if (g.road[i]){ if (commit){ g.road[i]=0; g.dirty=true; } return {ok:true, cost:0}; }
      if (g.dike[i]>0){ if (commit){ g.dike[i]=0; g.dirty=true; } return {ok:true, cost:0}; }
      if (g.canal[i]){ if (commit){ g.ground[i]+=g.canal[i]; g.canal[i]=0; g.dirty=true; } return {ok:true, cost:0}; }
      return {ok:false};
    }
    case 'lock': {
      const T=TOOL.lock;
      if (g.dike[i]<=0 || k!==0) return no('Locks go on top of a dike.');
      if (s) return no('Something is already built here.');
      if (!lockSides(i)) return no('A lock needs the boezem on one side of the dike and polder water or a canal on the other, straight across.');
      return pay(T.price, ()=>{ g.struct[i]=S.LOCK; g.given[i]=0; g.dirty=true; if (g.flags.holdPeil==null) g.flags.holdPeil=1; });
    }
    case 'mill': case 'steam': case 'electric': case 'sluice': {
      const T=TOOL[id];
      if (g.dike[i]<=0 || k!==0) return no((id==='mill'?'Mills':id==='sluice'?'Sluices':T.label+' pumps')+' go on top of a dike.');
      if (s) return no('Something is already built here.');
      if (id==='sluice' && !neighbors4(i).some(j=>g.kind[j]>0)) return no('A sluice must touch the boezem or the sea.');
      if (id!=='sluice' && !bestPair(i)) return no('Needs open ground or water on two opposite sides of a dike one cell thick.');
      return pay(T.price, ()=>{ g.struct[i]={mill:1,steam:2,electric:3,sluice:6}[id]; g.given[i]=0; if (id!=='sluice') autoDir(i); g.dirty=true; });
    }
    case 'farm': case 'house': {
      const T=TOOL[id];
      if (k!==0 || g.dike[i]>0 || g.canal[i] || s) return no('Needs open land.');
      if (id==='farm' && !g.polder[i]) return no('Farms go on reclaimed land. Drain the lake first.');   // otherwise the old shore is free farmland and the goals are skipped
      if (g.depth[i]>0.03) return no('Too wet. Drain it first.');
      if (g.polder[i] && g.ripe[i]<0.5) return no('Still mud. Wait for the reeds.');
      return pay(T.price, ()=>{ g.struct[i]= id==='farm'?S.FARM:S.HOUSE; g.given[i]=0; g.stock[i]=0; g.road[i]=0; g.dirty=true; });
    }
  }
  return {ok:false};
}

// Apply one tool to one cell. Returns true when something was built (kept for tests and scripts).
function applyTool(id, i){
  const r=toolAt(id, i, true);
  if (G.dirty){ G.dirty=false; rebuild(); }
  return r.ok ? true : (r.msg ? false : undefined);
}

// Commit a whole stroke as one undoable action. Returns {built, cost, msg}.
function commitStroke(id, cells){
  const g=G; snapshot();
  let built=0, cost=0, msg='';
  for (const c of cells){ const r=toolAt(id, c, true); if (r.ok){ built++; cost+=r.cost||0; } else if (r.msg && !msg) msg=r.msg; }
  if (g.dirty){ g.dirty=false; rebuild(); } else if (built) metrics();
  if (!built) undoStack.pop(); else redoStack.length=0;
  return {built, cost, msg};
}
