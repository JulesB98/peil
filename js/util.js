"use strict";
/* ===== UTIL ===== */
function hash2(x, y, s){ let n = Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263) + Math.imul(s|0, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vnoise(x, y, scale, s){ const fx=x/scale, fy=y/scale, ix=Math.floor(fx), iy=Math.floor(fy), tx=fx-ix, ty=fy-iy; const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
  const a=hash2(ix,iy,s), b=hash2(ix+1,iy,s), c=hash2(ix,iy+1,s), d=hash2(ix+1,iy+1,s); return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy; }
function fbm(x,y,s){ return vnoise(x,y,9,s)*0.6 + vnoise(x,y,4,s+7)*0.3 + vnoise(x,y,2,s+13)*0.1; }
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp = (a,b,t) => a+(b-a)*t;
function fmtMoney(v){ v=Math.floor(v); return (v<0?'−':'') + 'ƒ ' + Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function fmtM(v){ return (v<0?'−':'+') + Math.abs(v).toFixed(2) + ' m'; }
function fmtM1(v){ return (v<0?'−':'+') + Math.abs(v).toFixed(1); }
function dateAt(g, t){ return new Date(g.startMs + t*3600000); }
function fmtDate(d){ return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
function lsGet(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
const $ = (id) => document.getElementById(id);
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// Player settings, kept apart from saves.
const SET = Object.assign({sound:true, haptics:true, debug:false, playtest:false, mode:'', theme:'auto'}, lsGet('peil_settings') || {});   // mode: '' (not chosen yet), 'phone' or 'desktop'
if (/[?&]debug=1/.test(location.search)) SET.debug = true;
function saveSettings(){ lsSet('peil_settings', SET); }

/* ----- phone / desktop ----- */
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
function isDesk(){ return SET.mode==='desktop'; }
function applyMode(){ document.documentElement.classList.toggle('desk', isDesk()); }
// Wording for a mouse: the scenario texts are written for a finger.
function dtext(s){
  if (!isDesk() || !s) return s;
  return s.replace('Drag one finger across the map','Drag across the map').replace('pinch with two fingers, or tap the + button','scroll the wheel, or click the + button')
    .replace('Lifting your finger builds it','Letting go builds it').replace(/your finger/g,'the mouse').replace(/\bTapping\b/g,'Clicking').replace(/\bTap\b/g,'Click').replace(/\btap\b/g,'click');
}

/* ----- theme: auto follows the system, or light / dark by hand ----- */
const DARKQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function isDark(){ return SET.theme==='dark' || (SET.theme!=='light' && !!(DARKQ && DARKQ.matches)); }
function applyTheme(){
  document.documentElement.classList.toggle('dark', isDark());
  const m=document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', isDark()?'#2b241c':'#ece3cc');
  if (typeof requestRender==='function' && typeof G!=='undefined' && G) requestRender();
}
if (DARKQ && DARKQ.addEventListener) DARKQ.addEventListener('change', ()=>{ if (SET.theme==='auto') applyTheme(); });
applyTheme();
