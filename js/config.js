"use strict";
/* ===== CONFIG ===== */
const APP_VERSION = '2.0';
const MAP_V = 2;                // map layout version: 2 = varied maps (flips, lobes, arms, peat strips)
const SAVE_V = 2;               // save format version (see save.js for migrations)
const DAY = 24;                 // ticks per game day (1 tick = 1 hour)
const BZ_NORM = -0.4;           // boezem target level (m NAP)
const SPEEDS = [0, 6, 20, 60];  // ticks per real second
const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const SOILS = ['clay','peat','sand'];
const SEEP = [0.000015, 0.00003, 0.00006];
const FERT = [1.2, 0.75, 0.6];
const S = {NONE:0, MILL:1, STEAM:2, ELEC:3, FARM:4, HOUSE:5, SLUICE:6, TOWN:7, LOCK:8};
const STRUCT_TOOL = {1:'mill', 2:'steam', 3:'electric', 4:'farm', 5:'house', 6:'sluice', 8:'lock'};
const PUMP = {
  1:{name:'Windmill', lift:1.6, cap:0.15, wind:true, upkeep:0},
  2:{name:'Steam pump', lift:6, cap:1.0, net:true, upkeep:0.5},
  3:{name:'Electric pump', lift:8, cap:1.6, net:true, upkeep:0.17}
};
// Freight: farms fill a cart with grain, the cart drives to town and pays on arrival.
const CART_LOAD = 8;            // guilders of grain per cart
const CART_SPEED = 0.5;         // cells per tick
const DRAFT = 0.6;              // m of water a grain barge needs under it
const BARGE_SPEED = 0.25;       // cells per tick
const BARGE_BONUS = 1.5;        // grain shipped by water sells for this much more than by cart
const LOCK_SPILL = 1.5;         // m³ (cell-metres) of boezem water let into the polder per barge through a lock
const COAL_EVERY = DAY * 2;     // a coal cart per running steam pump, every 2 days (visual only)

const ICON = {
  look:'<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/>',
  dike:'<path d="M2 18 7 10h10l5 8z"/><path d="M7 10h10"/>',
  canal:'<path d="M3 9q3-3 6 0t6 0 6 0M3 15q3-3 6 0t6 0 6 0"/>',
  road:'<path d="M8 3 6 21M16 3l2 18M12 5v2M12 11v2M12 17v2"/>',
  mill:'<circle cx="12" cy="12" r="1.8"/><path d="M12 12 5 5M12 12l7-7M12 12l-7 7M12 12l7 7"/>',
  steam:'<path d="M4 20V11h9v9zM14 20V6h3v14M3 20h18"/><circle cx="17.5" cy="3.5" r="1.3"/>',
  electric:'<rect x="5" y="6" width="14" height="14" rx="1"/><path d="M13 8l-3 5h4l-3 5"/>',
  sluice:'<path d="M5 3v18M19 3v18M5 9h14M5 15h14"/>',
  lock:'<path d="M3 8h18M3 16h18M8 8v8M16 8v8"/><path d="M10.5 12h3"/>',
  farm:'<rect x="4" y="7" width="16" height="13" rx="1"/><path d="M4 11.5h16M4 16h16"/>',
  house:'<path d="M5 20v-9l7-6 7 6v9z"/><path d="M10 20v-5h4v5"/>',
  remove:'<path d="M6 6l12 12M18 6 6 18"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  view:'<path d="M12 4 3 9l9 5 9-5z"/><path d="M3 14l9 5 9-5"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  play:'<path d="M8 5l10 7-10 7z"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  mail:'<rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>'
};
// Tool icons: drawn for Peil in the map's own ink-and-wash style (30x30), with a few fixed map colours.
const TICON = {
  look:'<circle cx="13" cy="13" r="7" fill="#f4ecd8" stroke="currentColor" stroke-width="2.2"/><path d="M18 18l7 7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  dike:'<path d="M2 24 L10 12 H20 L28 24 Z" fill="#7d9a4a" stroke="currentColor" stroke-width="2"/><path d="M8 20l-2 2M12 15l-2 2M20 15l2 2M24 20l2 2" stroke="currentColor" stroke-width="1.6"/>',
  canal:'<path d="M2 11 Q8 7 15 11 T28 11" fill="none" stroke="#44707c" stroke-width="3"/><path d="M2 17 Q8 13 15 17 T28 17" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 23 Q8 19 15 23 T28 23" fill="none" stroke="currentColor" stroke-width="1"/>',
  road:'<path d="M5 29 C10 21 10.5 14.5 15 11.5 S22 8 25.5 1.5" fill="none" stroke="currentColor" stroke-width="8.5"/><path d="M5 29 C10 21 10.5 14.5 15 11.5 S22 8 25.5 1.5" fill="none" stroke="#d9c79a" stroke-width="5.3"/><path d="M5 29 C10 21 10.5 14.5 15 11.5 S22 8 25.5 1.5" fill="none" stroke="#26261f" stroke-width="1.4" stroke-dasharray="3.2 2.6"/>',
  mill:'<path d="M11 28 L13 14 H17 L19 28 Z" fill="#5a4430" stroke="currentColor" stroke-width="1.6"/><path d="M15 12 L4 3 M15 12 L26 3 M15 12 L4 21 M15 12 L26 21" stroke="currentColor" stroke-width="2.2"/><circle cx="15" cy="12" r="2" fill="currentColor"/>',
  steam:'<path d="M3 27V15l7-6 7 6v12Z" fill="#9a4a32" stroke="currentColor" stroke-width="1.8"/><rect x="8.5" y="20" width="3.5" height="7" fill="currentColor"/><rect x="20" y="7" width="4.5" height="20" fill="#7a3424" stroke="currentColor" stroke-width="1.6"/><circle cx="23.5" cy="4" r="2.4" fill="#c9c2b0" stroke="currentColor" stroke-width="1.1"/><circle cx="27" cy="2.4" r="1.5" fill="#c9c2b0" stroke="currentColor" stroke-width=".9"/>',
  electric:'<path d="M4 27V13l11-8 11 8v14Z" fill="#e9dcc0" stroke="currentColor" stroke-width="1.8"/><path d="M16.5 11l-5 8h5l-3.5 7" fill="none" stroke="#2f6d8c" stroke-width="2.4" stroke-linejoin="round"/>',
  sluice:'<path d="M2 21 Q8 18 15 21 T28 21" fill="none" stroke="#44707c" stroke-width="2.6"/><rect x="6" y="3" width="4" height="24" fill="currentColor"/><rect x="20" y="3" width="4" height="24" fill="currentColor"/><rect x="10" y="8" width="10" height="6" fill="#8a6a44" stroke="currentColor" stroke-width="1.4"/>',
  lock:'<rect x="5" y="9" width="20" height="12" fill="#7fa9b0" stroke="currentColor" stroke-width="1.4"/><path d="M2 9h26M2 21h26" stroke="currentColor" stroke-width="2.6"/><path d="M9.5 9v12M20.5 9v12" stroke="#8a6a44" stroke-width="3"/>',
  farm:'<path d="M4 27 V15 L11 8 L18 15 V27 Z" fill="#e9dcc0" stroke="currentColor" stroke-width="1.8"/><path d="M3 15.5 L11 7 L19 15.5" fill="none" stroke="#8a3b26" stroke-width="3"/><ellipse cx="24" cy="22" rx="4" ry="5" fill="#d8b452" stroke="currentColor" stroke-width="1.6"/>',
  house:'<path d="M7 27 V14 L15 5 L23 14 V27 Z" fill="#b55a3c" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="19" width="4" height="8" fill="currentColor"/><rect x="9.5" y="15" width="3" height="3" fill="#f1e7d0"/><rect x="17.5" y="15" width="3" height="3" fill="#f1e7d0"/>',
  remove:'<path d="M7 7l16 16M23 7 7 23" stroke="currentColor" stroke-width="3"/>'
};
const svg = (k) => TICON[k] ? `<svg viewBox="0 0 30 30" aria-hidden="true">${TICON[k]}</svg>`
  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${ICON[k]}</svg>`;

const TOOLS = [
  {id:'look', label:'Look', hint:'Tap anything to inspect it. Drag to move the map.'},
  {id:'dike', label:'Dike', paint:true, cost:'~ƒ30', hint:'Drag to draw, across water too. Or tap a dike with Look to raise a whole stretch in one go.'},
  {id:'canal', label:'Canal', paint:true, cost:'ƒ8', price:8, hint:'Drag to dig 1 m deep. Draw over it again to go deeper (3 m max).'},
  {id:'road', label:'Road', paint:true, cost:'ƒ5', price:5, hint:'Links pumps, farms and houses to town. Dike tops count as roads.'},
  {id:'mill', label:'Mill', cost:'ƒ400', price:400, hint:'Goes on a dike. Lifts water up to 1.6 m when there is wind.'},
  {id:'steam', label:'Steam', cost:'ƒ2.5k', price:2500, hint:'Goes on a dike. Lifts 6 m. Needs a road to town for coal, ƒ12 a day.'},
  {id:'electric', label:'Electric', cost:'ƒ4k', price:4000, hint:'Goes on a dike. Lifts 8 m. Needs a link to town, ƒ4 a day.'},
  {id:'lock', label:'Lock', cost:'ƒ900', price:900, hint:'Goes on a dike between a canal and the boezem. Farms on a canal ship grain by barge: worth half again as much, but every barge lets boezem water in.'},
  {id:'sluice', label:'Sluice', cost:'ƒ600', price:600, hint:'Goes on a dike beside boezem or sea. Drains when the outside is lower.'},
  {id:'farm', label:'Farm', cost:'ƒ150', price:150, hint:'Goes on reclaimed land only. Sends grain carts to town. Clay is the most fertile.'},
  {id:'house', label:'House', cost:'ƒ100', price:100, hint:'Goes on dry land by a road. Pays tax. One farm feeds 8 people.'},
  {id:'remove', label:'Remove', paint:true, hint:'Drag to remove, top layer first. Buildings refund half.'}
];
const TOOL = {}; for (const t of TOOLS) TOOL[t.id] = t;
const PUMP_TOOLS = {mill:1, steam:2, electric:3};
