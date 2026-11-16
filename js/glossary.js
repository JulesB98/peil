"use strict";
/* ===== GLOSSARY =====
   Jargon in the UI gets a dotted underline. Tap it (phone) or hover it (desktop) for a short explanation.
   glossify(root) wraps the first match of each term inside root. Call it after setting innerHTML.
   Terms inside SVG text carry data-g by hand (see ui.js and render.js). */
const GLOSS = {
  boezem:{t:'Boezem', m:'boezem', x:'The ring of canals and lakes that your polders drain into. It empties into the sea through sluices, but only when the sea is lower. When it runs high, pumps have to lift further.'},
  polder:{t:'Polder', m:'polders?', x:'Land that used to be water or marsh, kept dry by dikes and pumps. Stop the pumps and it floods again.'},
  dike:{t:'Dike', m:'dikes?', x:'A bank of earth that holds water back. Water finds every gap, and a higher dike holds more.'},
  crest:{t:'Crest', m:'crest', x:'The top of a dike. Water that rises above the crest spills over.'},
  seadike:{t:'Sea dike', m:'sea dike', x:'The lowest point of the dike that faces the sea, in metres above NAP. A storm surge has to stay below it.'},
  sluice:{t:'Sluice', m:'sluices?', x:'A gate in a dike. It opens by itself when the water outside is lower than inside, and drains your polder for free. It shuts when the sea is higher.'},
  lock:{t:'Lock', m:'locks?', x:'A gate that lets barges through a dike. Every barge that passes lets a little boezem water into your polder.'},
  barge:{t:'Barge', m:'barges?', x:()=>'A grain barge needs '+DRAFT+' m of water under it, all the way to the lock. A farm that ships by barge sells its grain for half again as much as by cart.'},
  canal:{t:'Canal', m:'canals?', x:'Water only reaches a pump along a canal. Dig one from the lowest ground to the pump. A deeper canal lets the pump drain lower.'},
  mill:{t:'Windmill', m:'mills?', x:()=>'Lifts water up to '+PUMP[1].lift+' m, but only when the wind blows. Steam and electric pumps lift more and ignore the wind.'},
  lift:{t:'Lift', m:'lift(?= \\d)', x:'How many metres a pump has to raise the water: the outlet level minus the intake level. A pump gets stuck when the lift is more than it can manage.'},
  deepest:{t:'Deepest bed', m:'deepest bed', x:'The lowest ground under the water this pump drains. If it is below the dashed line, this pump cannot empty it alone.'},
  drainto:{t:'Can drain to', m:'can drain to', x:'The lowest level this pump can pull its water down to: the outlet level minus its lift. Ground deeper than that stays wet.'},
  lakebed:{t:'Lake bed', m:'lake bed', x:'The ground under the lake. It lies lower than the water around it, so it only stays dry while the pumps keep working.'},
  reeds:{t:'Reeds', m:'reeds?', x:'The first plants on drained mud. When they grow, the soil is ripe enough for a farm.'},
  mud:{t:'Mud', m:'mud', x:'Freshly drained ground, still too wet and salty to farm. Wait for reeds.'},
  nap:{t:'NAP', m:'NAP', x:'Normaal Amsterdams Peil, the Dutch zero for height. +1 m is one metre above it, −1 m below. Much of the Netherlands lies below zero.'},
  storm:{t:'Storm', m:'storms?', x:'A storm surge pushes the sea up for a few days, and mills furl their sails. If the water tops your sea dike, the polder floods. Raise the dike before it comes.'},
  tide:{t:'Tide', m:'(?:low |high )?tide', x:'The sea rises and falls twice a day. Sluices to the sea only open at low tide.'},
  wind:{t:'Wind', m:'wind', x:'Mills only turn when it blows. Steam and electric pumps do not need it.'},
  dry:{t:'Dry', m:'dry(?= \\d)', x:'The share of the lake bed with no standing water left. Pumps lower the water and the mud shows first.'},
  people:{t:'People', m:'people(?= \\d)', x:'Houses hold five people each. Farms feed eight. When people outnumber the food, house tax is halved.'}
};
// Longer, more specific patterns first: the alternation takes the first one that matches at a position.
const GLOSS_ORDER = ['seadike','deepest','drainto','lakebed','lift','tide','boezem','polder','dike','crest','sluice','lock','barge','canal','mill','reeds','mud','nap','storm','wind','dry','people'];
const GLOSS_SKIP = '.btn,.tool,.sc,#infoA,.term,svg,h2,h3,.when,.sig,.stars,.k,.c';
let glossRe=null, glossReOne={};
function glossInit(){
  glossRe = new RegExp('\\b(?:'+GLOSS_ORDER.map(k=>'('+GLOSS[k].m+')').join('|')+')\\b','gi');
  for (const k of GLOSS_ORDER) glossReOne[k]=new RegExp('^(?:'+GLOSS[k].m.replace(/\(\?=.*?\)/,'')+')$','i');   // the lookahead only decides where a term starts
}
function glossKey(word){ for (const k of GLOSS_ORDER){ if (glossReOne[k].test(word)) return k; } return null; }

// Wrap the first match of each term under root. root may hold several items (opt.each) that start fresh.
function glossify(root, each){
  if (!root) return;
  if (!glossRe) glossInit();
  const parts = each ? root.querySelectorAll(each) : [root];
  for (const part of parts){
    const seen=new Set(), walk=document.createTreeWalker(part, NodeFilter.SHOW_TEXT), nodes=[];
    for (let n=walk.nextNode(); n; n=walk.nextNode()) nodes.push(n);
    for (const n of nodes){
      const p=n.parentElement; if (!p || p.closest(GLOSS_SKIP)) continue;
      const s=n.nodeValue; glossRe.lastIndex=0; let m, last=0, frag=null;
      while ((m=glossRe.exec(s))){
        const k=glossKey(m[0]); if (!k || seen.has(k)) continue; seen.add(k);
        if (!frag) frag=document.createDocumentFragment();
        frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const sp=document.createElement('span'); sp.className='term'; sp.dataset.g=k; sp.textContent=m[0]; frag.appendChild(sp); last=m.index+m[0].length;
      }
      if (frag){ frag.appendChild(document.createTextNode(s.slice(last))); n.parentNode.replaceChild(frag, n); }
    }
  }
}

/* ----- the explanation card ----- */
let glossEl=null, glossFor=null, glossT=0, ptrDown=false;
function glossCard(){
  if (glossEl) return glossEl;
  glossEl=document.createElement('div'); glossEl.id='gloss'; glossEl.className='card'; glossEl.setAttribute('role','tooltip'); glossEl.hidden=true;
  document.body.appendChild(glossEl); return glossEl;
}
function glossShow(target){
  const k=target.dataset.g, d=GLOSS[k]; if (!d) return;
  clearTimeout(glossT); const el=glossCard(); glossFor=target;
  el.innerHTML=`<b>${d.t}</b><span>${typeof d.x==='function'?d.x():d.x}</span>`; el.hidden=false;
  const r=target.getBoundingClientRect(), w=el.offsetWidth, h=el.offsetHeight, vw=window.innerWidth, vh=window.innerHeight;
  let x=r.left+r.width/2-w/2; x=Math.max(8, Math.min(vw-w-8, x));
  let y=r.top-h-8; if (y<8) y=Math.min(vh-h-8, r.bottom+8);                    // above the term, or below it when there is no room
  el.style.left=x+'px'; el.style.top=y+'px';
  target.setAttribute('aria-describedby','gloss');
}
function glossHide(){ clearTimeout(glossT); if (glossEl) glossEl.hidden=true; if (glossFor){ glossFor.removeAttribute('aria-describedby'); glossFor=null; } }
const termOf=e=>{ const t=e.target; return t && t.closest ? t.closest('[data-g]') : null; };

// tap or click: show it, tap the same term again to close. The tap does nothing else (a letter will not open, a step card will not open the letters).
document.addEventListener('click', e=>{
  const t=termOf(e); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  if (glossFor===t && glossEl && !glossEl.hidden) glossHide(); else { glossShow(t); if (e.pointerType!=='mouse') glossT=setTimeout(glossHide, 9000); }
}, true);
// desktop: hover
document.addEventListener('pointerover', e=>{ if (e.pointerType!=='mouse') return; const t=termOf(e); if (t){ clearTimeout(glossT); glossT=setTimeout(()=>glossShow(t), 120); } });
document.addEventListener('pointerout', e=>{ if (e.pointerType!=='mouse') return; if (termOf(e)){ clearTimeout(glossT); glossT=setTimeout(glossHide, 60); } });
// anywhere else: close it (the tap still goes through)
document.addEventListener('pointerdown', e=>{ ptrDown=true; if (!termOf(e)) glossHide(); }, true);
const glossUp=()=>setTimeout(()=>{ ptrDown=false; }, 60);
document.addEventListener('pointerup', glossUp, true); document.addEventListener('pointercancel', glossUp, true);
document.addEventListener('keydown', e=>{ if (e.key==='Escape') glossHide(); });
// keyboard: terms in the card text are not tab stops (they would crowd the controls); the Letters and the log stay readable without them
// Redrawing a term under a finger would swallow the tap, so live parts skip a redraw while a pointer is down.
const glossBusy=()=>ptrDown;
