"use strict";
/* ===== RANDOM MAPS =====
   randomScenario(n) turns a map number into a scenario, purely from n (no Math.random), so a number always gives the
   same map. Parameters stay inside an envelope the scripted solver (tests/random.test.js) can win. RANDOM_OK lists the
   numbers that were actually played through by the solver; the game only deals those, so a random map is always winnable.
   Two families: "strait" (small lake joined by a strait, mills) and "ring" (a big lake with a ring dike, steam pumps). */
function rndStream(n){ let a=(n*2654435761+1013904223)>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
// Difficulty tiers. Money and the dry/farm goal squeeze the build; the deadline (game days) makes slow plans lose.
// Hard is the strictest on every axis, so a map the solver wins on Hard is winnable on all three.
const RANDOM_DIFFS=[{name:'Easy', money:{strait:1, ring:1}, dry:0.85, farms:0, dl:null}, {name:'Normal', money:{strait:0.88, ring:0.92}, dry:0.85, farms:0, dl:{strait:130, ring:170}}, {name:'Hard', money:{strait:0.75, ring:0.85}, dry:0.86, farms:1, dl:{strait:100, ring:130}}];
let RANDOM_DIFF=(()=>{ try { const d=JSON.parse(localStorage.getItem('peil_rdiff')); return d>=0 && d<=2 ? d|0 : 0; } catch(e){ return 0; } })();
function randomScenario(n, diff){
  const D=RANDOM_DIFFS[diff==null?RANDOM_DIFF:diff]||RANDOM_DIFFS[0];
  const r=rndStream(n), u=(a,b)=>a+(b-a)*r(), iu=(a,b)=>Math.round(u(a,b)), ring=r()<0.4, flip=[r()<0.5?1:0, r()<0.5?1:0];
  let sc;
  if (!ring){
    const C=iu(30,36), R=iu(48,56), rx=u(6.5,8.5), ry=u(8,10.5), cx=Math.round(C*u(0.52,0.62)), cy=Math.round(R*u(0.6,0.68)), lobes=r()<0.6?[[cx-Math.round(u(4,7)), cy-Math.round(u(10,13)), u(4,5.5), u(5,6.5)]]:[];
    const farms=iu(3,5);
    sc={ C, R, money:iu(3000,3600), land:0.25, lake:{cx, cy, rx, ry, bottom:+u(-1.9,-1.3).toFixed(2), vary:0.3, lobes}, strait:true, soilBias:0, goals:{dry:0.85, farms}, par:200, kind:'strait',
      tools:['look','dike','canal','road','mill','farm','house','remove'], storms:[] };
  } else {
    const C=iu(40,46), R=iu(64,72), rx=u(9,11.5), ry=u(12,14.5), cx=Math.round(C*u(0.5,0.58)), cy=Math.round(R*u(0.55,0.6));
    const lobes=[[cx-Math.round(u(6,9)), cy-Math.round(u(11,14)), u(5.5,7), u(6.5,8)]]; if (r()<0.5) lobes.push([cx+Math.round(u(4,7)), cy+Math.round(u(14,17)), u(5.5,7), u(6,7.5)]);
    sc={ C, R, money:iu(16000,22000), land:0.2, lake:{cx, cy, rx, ry, bottom:+u(-3.4,-2.5).toFixed(2), vary:0.5, lobes}, ring:true, river:r()<0.5, soilBias:0.1, goals:{dry:0.85, farms:iu(8,11)}, par:420, kind:'ring',
      tools:['look','dike','canal','road','mill','steam','electric','sluice','lock','farm','house','remove'], storms:[] };
  }
  sc.money=Math.round(sc.money*D.money[sc.kind]/50)*50; sc.goals.dry=D.dry; sc.goals.farms+=D.farms; sc.deadline=D.dl?D.dl[sc.kind]:0; sc.diff=RANDOM_DIFFS.indexOf(D);
  return Object.assign(sc, { id:'random', name:'Random map #'+n, rnd:n, flip, seed:n*7+3, start:'1700-04-01', sign:'', epilogue:'Another lake, another polder. The water is patient. So are you.',
    blurb:'Map #'+n+' · '+D.name+' · A new lake every time, always winnable.', steps:[], letters:[],
    intro:(ring ? 'A wide lake behind a ring of low land. Close it off, bring steam pumps and dig deep.' : 'A small lake and one strait to the boezem. Dam it, mill it, settle it.')+' Goal: drain '+Math.round(sc.goals.dry*100)+'% and settle '+sc.goals.farms+' farms'+(sc.deadline?' within '+sc.deadline+' days.':'.') });
}
// Map numbers the solver has won (filled in by tests/random.test.js --record). A player's map is the Nth entry.
const RANDOM_OK = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,73,74,75,76,77,78,79,80,81,82,83,84,85,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,177,178,179,180,181,182,183,185,186,188,189,190,191,192,193,194,195,196,197,198,200,201,202,203,205,206,207,208,209,210,211,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,248,249,250,251,252,253,254,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,275,276,277,278,279,280,281,282,283,284,285,286,288,289,290,291,292,293,294,295,296,297,298,299,300];
function pickRandom(k){ const a=RANDOM_OK.length?RANDOM_OK:[1]; return a[((k%a.length)+a.length)%a.length]; }
function setRandom(n, diff){ const sc=SCENARIOS.find(s=>s.id==='random'); const next=randomScenario(n, diff); for (const k of Object.keys(sc)) delete sc[k]; Object.assign(sc, next); return sc; }
SCENARIOS.push(randomScenario(1));
