"use strict";
/* ===== SCENARIOS =====
   Data only. A step has: text, done(g), and optionally focus ('open' | 'sea': cells to pulse) and tool (toolbar button to pulse).
   Letters fire once, on the first daily check where when(g) is true. */
const SCENARIOS = [
  { id:'leren', name:'Eerste Les', tutorial:true, blurb:'Tutorial · The controls and the water, one step at a time.',
    start:'1600-04-01', C:28, R:46, money:3000, seed:5,
    land:0.3, lake:{cx:16, cy:27, rx:6, ry:8, bottom:-1.3, vary:0.2}, strait:true, flip:[1,0],
    soilBias:0, tools:['look','dike','canal','road','mill','farm','house','remove'],
    goals:{steps:true}, par:150, storms:[],
    sign:'Cornelis Pieck, dijkgraaf',
    intro:'Before the big lakes, a small one. I will show you how to move around, how to build, and how water behaves. Take your time. Nothing here can go wrong.',
    epilogue:'You have the basics: look first, dike the water in, lift it out with mills, dig canals so it can find the mills. The rest is patience.',
    steps:[
      {text:'Drag one finger across the map to move it.', done:g=>g.flags.panned, tool:'look'},
      {text:'Zoom: pinch with two fingers, or tap the + button.', done:g=>g.flags.zoomed, tool:'zoom'},
      {text:'Tap anything on the map to inspect it. Try the lake.', done:g=>g.flags.inspected, tool:'look'},
      {text:'Water finds every gap. Pick Dike and drag across the pulsing gap. Lifting your finger builds it.', done:g=>g.m.openings===0, focus:'open', tool:'dike'},
      {text:'Pick Look and tap your dike. The blue button raises the whole stretch. A higher dike holds more water.', done:g=>g.flags.raised, tool:'look'},
      {text:'Made a mistake? Tap Undo (bottom right), then Redo.', done:g=>g.flags.undone && g.flags.redone, tool:'undo'},
      {text:'Put a mill on the dike. The arrow shows where it lifts the water to.', done:g=>g.m.pumps>=1, tool:'mill'},
      {text:'Press play. Mills only turn when there is wind. The speed button changes how fast time runs.', done:g=>g.tick>DAY*2, tool:'play'},
      {text:'The mill needs water at its feet. Dig a canal from the lake to the mill.', done:g=>g.m.canals>=6, tool:'canal'},
      {text:'Try ✕ (bottom right): draw a road piece on dry land, then sweep ✕ over it to remove it.', done:g=>g.flags.removed, tool:'remove'},
      {text:'When reeds grow on the drained land, build a farm there and draw a road to the town.', done:g=>g.m.farmsLinked>=1, tool:'farm'},
      {text:'Drain 90% of the lake. Speed up time and wait.', done:g=>g.m.dry>=0.9}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.3, text:'See how the mud shows? Land that was a lake bed is lower than the water around it. Only pumps and patience keep it dry.'}
    ]},
  { id:'kleine', name:'De Kleine Plas', blurb:'1612 · Drain it, then settle four farms.',
    start:'1612-04-01', C:32, R:52, money:3200, seed:11,
    land:0.25, lake:{cx:19, cy:34, rx:8, ry:10, bottom:-1.45, vary:0.3, lobes:[[13,22,5,6]]}, strait:true, flip:[0,1],
    soilBias:0, tools:['look','dike','canal','road','mill','farm','house','remove'],
    goals:{dry:0.85, farms:4}, par:150, storms:[],
    sign:'Cornelis Pieck, dijkgraaf',
    intro:'The Kleine Plas has swallowed three farms in ten years. The council has given me three thousand two hundred guilders and one summer. It must pay for the dikes, the mills and the farms. I mean to take the lake back.',
    epilogue:'Twelve new farms by the end of the decade. My daughter Aaltje already has her eye on the Diepe Meer. God help us.',
    steps:[
      {text:'Dam the channel between lake and boezem. Pick Dike and drag across the pulsing cells.', done:g=>g.m.openings===0, focus:'open', tool:'dike'},
      {text:'Put two mills on your dam. The arrow shows where the water goes.', done:g=>g.m.pumps>=2, tool:'mill'},
      {text:'Press play. Mills only turn when there is wind.', done:g=>g.tick>DAY*2, tool:'play'},
      {text:'The lake bed is lowest in the middle. Dig a canal from the middle to your mills.', done:g=>g.m.canals>=6, tool:'canal'},
      {text:'When reeds grow, build a farm on dry land and draw a road from it to the town.', done:g=>g.m.farmsLinked>=1, tool:'farm'},
      {text:'Drain 85% of the lake and build four farms. A farm only earns with a road to town.', done:g=>g.m.dry>=0.85 && g.m.farms>=4}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.3, text:'The first mud flats smell of rot and salt. Half the village came out to look, and the other half to say it won\'t last.'},
      {k:'f2', when:g=>g.m.dry>0.6, text:'My father said a lake can\'t be drained with mills. He was half right. It can, just not quickly.'}
    ]},
  { id:'veen', name:'De Veenplassen', blurb:'1622 · Long peat lakes. Join them up, then drain.',
    start:'1622-04-01', C:32, R:52, money:5000, seed:17,
    land:0.05, lake:{cx:17, cy:40, rx:0.6, ry:0.6, bottom:-1.9, vary:0.2}, strips:{x0:8, x1:26, y0:12, y1:39, w:3, gap:1, bottom:-1.5, top:-0.45, vary:0.2, ragged:8},
    strait:true, river:true, flip:[1,0], town:[27,8],
    soilBias:0.6, tools:['look','dike','canal','road','mill','farm','house','remove'],
    goals:{dry:0.8, farms:6}, par:150, storms:[],
    sign:'Cornelis Pieck, dijkgraaf',
    intro:'The peat diggers have left us a field of long lakes with thin strips of land between them. Every winter the waves eat the strips. Before the lakes run together, I want them dry.',
    epilogue:'The lakes are fields now, long and narrow like the lakes were. From the church tower you can still see where the diggers worked.',
    steps:[
      {text:'All the lakes end in one wetering. Dam it off from the river: drag Dike across the pulsing cells.', done:g=>g.m.openings===0, focus:'open', tool:'dike'},
      {text:'Put two mills on your dam.', done:g=>g.m.pumps>=2, tool:'mill'},
      {text:'Press play. Mills only turn when there is wind.', done:g=>g.tick>DAY*2, tool:'play'},
      {text:'Water at the far end of a long lake never reaches the wetering. Dig a canal down the middle of each lake, joined to the wetering.', done:g=>g.m.canals>=30, tool:'canal'},
      {text:'Build 6 farms on the drained lakes, linked to town by road.', done:g=>g.m.farms>=6, tool:'farm'},
      {text:'Drain 80% of the lakes.', done:g=>g.m.dry>=0.8}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.3, text:'Peat shrinks as it dries. The new fields already sit a little lower than last month.'},
      {k:'f2', when:g=>g.m.dry>0.6, text:'The strips between the lakes are only a few paces wide. Now that the water is gone they look like dikes that forgot what they were for.'}
    ]},
  { id:'diep', name:'Het Diepe Meer', blurb:'1631 · Too deep for one mill. Stack them.',
    start:'1631-05-01', C:36, R:58, money:7000, seed:23,
    land:0.2, lake:{cx:21, cy:34, rx:8, ry:9, bottom:-2.9, vary:0.3, lobes:[[15,25,6,6],[25,44,6,6]]}, ring:true, flip:[1,1],
    soilBias:0.15, tools:['look','dike','canal','road','mill','farm','house','remove'],
    goals:{dry:0.8, farms:10}, par:420, storms:[],
    sign:'Aaltje Pieck, dijkgravin',
    intro:'My father drained a puddle. This is a real lake: nearly three metres deep, with a ring canal all the way round. The investors in Amsterdam have paid for their land and want to see it.',
    epilogue:'The investors got their land. The peat is already sinking under it, so the mills will never stop. Neither will we.',
    steps:[
      {text:'Close the ring. Draw a dike over every pulsing cell.', done:g=>g.m.openings===0, focus:'open', tool:'dike'},
      {text:'A mill lifts 1.6 m, the bed is 3 m down. Make a halfway basin: a small dike box, about 4×4, against the inside of the ring dike.', done:g=>g.m.basins>=1, tool:'dike'},
      {text:'Put a mill on the basin wall facing the lake. Arrow into the basin.', done:g=>g.flags.gangIn, tool:'mill'},
      {text:'Put a mill on the ring dike beside the basin. Arrow out to the ring canal. Mill → basin → mill → boezem.', done:g=>g.flags.gangOut, tool:'mill'},
      {text:'Mills need water at their feet. Dig a canal to each mill: one in the basin, one out into the deep lake.', done:g=>g.m.canals>=8, tool:'canal'},
      {text:'Build 10 farms on the new land, linked to town by road or dike.', done:g=>g.m.farms>=10, tool:'farm'},
      {text:'Drain 80% of the lake.', done:g=>g.m.dry>=0.8}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.3, text:'The peat sinks as it dries, a few centimetres a year. The lower the land, the harder the water pushes back up.'},
      {k:'f2', when:g=>g.boezem>0.15, text:'The boezem is running high. It only empties at low tide through the sluice in the sea dike. Ease off the mills, or wait.', alert:true}
    ]},
  { id:'groot', name:'De Grote Meer', blurb:'1840 · Steam, coal and a spring storm.',
    start:'1840-06-01', C:40, R:66, money:16000, seed:37,
    land:0.15, lake:{cx:21, cy:37, rx:8, ry:11, bottom:-3.8, vary:0.5, lobes:[[15,23,6,7],[27,50,7,8],[28,29,5,6]]}, ring:true, river:true, seaCrest:2.9,
    soilBias:0.1, tools:['look','dike','canal','road','mill','steam','sluice','lock','farm','house','remove'],
    goals:{dry:0.75, pop:60, storm:true}, par:330,
    storms:[{date:'1841-02-12', dur:40, surge:2.3}],
    sign:'Hendrik Pieck, ingenieur',
    intro:'Two hundred years of mills, and the Grote Meer still eats a village every winter. Now we have steam. Coal from the town, iron pumps, no wind needed. Let\'s finish this.',
    epilogue:'The lake is gone. Its bed is a polder, and they\'re already arguing over what to call it.',
    steps:[
      {text:'Close the ring dike along the whole shore.', done:g=>g.m.openings===0, focus:'open', tool:'dike'},
      {text:'Build a steam pump on the ring dike and link it to town by road. No road, no coal.', done:g=>g.flags.steamRan, tool:'steam'},
      {text:'Dig canals from each pump into the lake, 3 m deep near the pumps: draw over a canal three times. The lake bed is lower than the shore, and water only runs downhill.', done:g=>g.m.deepCanals>=8, tool:'canal'},
      {text:'Build a second sluice on the sea dike. Steam fills the boezem fast.', done:g=>g.m.sluices>=2, tool:'sluice'},
      {text:'A storm comes in February. Raise low dikes, then ride it out.', done:g=>g.stormsPassed>=1, tool:'dike'},
      {text:'Reach 75% dry and 60 people.', done:g=>g.m.dry>=0.75 && g.m.pop>=60}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.4, text:'Settlers are coming. They want houses on roads and farms close by. Each farm feeds eight.'},
      {k:'f2', when:g=>g.boezem>0.1, text:'The boezem is rising. Every pump empties into it, and the sluices only open at low tide.', alert:true}
    ]},
  { id:'meer', name:'De Wieringermeer', blurb:'1930 · A deep peat lake, a new town, and a winter storm.',
    start:'1930-05-01', C:40, R:66, money:24000, seed:37,
    land:0.1, lake:{cx:20, cy:14, rx:11, ry:12, bottom:-3.8, vary:0.5, lobes:[[17,28,8,9]]}, ring:true, seaLake:true, islands:[[13,11,3.2,1.2]], town:[37,30], flip:[0,1], seaCrest:3.1,
    soilBias:0.4, tools:['look','dike','canal','road','mill','steam','electric','sluice','lock','farm','house','remove'],
    goals:{dry:0.8, farms:16, pop:70, storm:true}, par:360,
    storms:[{date:'1931-01-18', dur:36, surge:2.9}],
    sign:'Marijke Pieck, waterschap',
    intro:'The lake bed is peat, and peat sinks as it dries. Mills cannot lift from this deep. Steam can, if the town has a road to carry the coal. The government wants sixteen farms and seventy people here before the winter storm.',
    epilogue:'The new land has a name and a church. The peat will keep sinking, so the pumps will never stop.',
    steps:[
      {text:'Close the ring dike along the whole shore.', done:g=>g.m.openings===0, focus:'open', tool:'dike'},
      {text:'Build a steam pump on the ring dike and link it to town by road.', done:g=>g.flags.steamRan, tool:'steam'},
      {text:'Dig canals from the pump into the lake. Deepen them as the water drops.', done:g=>g.m.deepCanals>=8, tool:'canal'},
      {text:'Raise the sea dike before the January storm.', done:g=>g.m.seaMin>=4, focus:'sea', tool:'dike'},
      {text:'Build 16 farms and houses for 70 people on the new land, all linked to town by road.', done:g=>g.m.farms>=16 && g.m.pop>=70, tool:'farm'},
      {text:'Drain 80% of the lake and survive the storm.', done:g=>g.m.dry>=0.8 && g.stormsPassed>=1}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.3, text:'The peat has started to shrink. Every winter the ground is a hand lower than the one before.'},
      {k:'f2', when:g=>g.tick>DAY*200, text:'The January storm is close. The sea dike is older than the lake we are draining. Look at it.', alert:true}
    ]},
  { id:'afsluit', name:'De Afsluitdijk', blurb:'1932 · Close a sea arm. Build a polder inside the new lake.',
    start:'1932-05-01', C:44, R:72, money:36000, seed:61,
    land:0.1, arms:[{cx:27, cy:42, rx:12, ry:16, lobes:[[19,28,8,8],[32,58,8,8]], mouth:[24,29], bottom:-3.4, vary:0.4}], topChannel:[1,20], town:[39,8], flip:[1,0], armLake:true, seaCrest:3.3,
    soilBias:0.15, tools:['look','dike','canal','road','mill','steam','electric','sluice','lock','farm','house','remove'],
    goals:{dry:0.7, farms:20, pop:60}, par:200, storms:[],
    sign:'Hendrik Pieck, ingenieur',
    intro:'This is not a lake. It is an arm of the sea, and it has been taking fishermen for centuries. One dam across its mouth cuts it off and the salt water turns into a freshwater lake. Inside that lake we build our polder.',
    epilogue:'The sea arm is a lake now, and a piece of it is a polder with a name, a church and a village. Not everyone is glad. The fishermen lost their sea.',
    steps:[
      {text:'Close the sea arm: drag Dike across its mouth, wall to wall.', done:g=>g.m.armSea===0, focus:'mouth', tool:'dike'},
      {text:'The arm is a freshwater lake now. Wall off a polder: draw a dike across the lake from shore to shore.', done:g=>g.m.enclosed>=150, tool:'dike'},
      {text:'Build steam pumps on your new dike, linked to town by road. They pump the polder out into the lake.', done:g=>g.flags.steamRan, tool:'steam'},
      {text:'Dig deep canals from the pumps over the polder floor.', done:g=>g.m.deepCanals>=20, tool:'canal'},
      {text:'Build 20 farms and houses for 60 people on the new land, on roads linked to town.', done:g=>g.m.farms>=20 && g.m.pop>=60, tool:'farm'},
      {text:'Drain 70% of the polder. The lake drains to the sea through the sluices.', done:g=>g.m.dry>=0.7}
    ],
    letters:[
      {k:'f1', when:g=>g.m.dry>0.2, text:'The salt is still in the soil. Nothing grows well on the first mud, but the reeds come, and then the cattle.'},
      {k:'f2', when:g=>g.m.dry>0.5, text:'Halfway. From the dam the old sea arm looks like a field with a puddle in the middle.'}
    ]},
  { id:'storm', name:'Stormvloed', blurb:'1952 · A full polder and an old sea dike.',
    start:'1952-03-01', C:40, R:66, money:10000, seed:53,
    land:0.1, lake:{cx:17, cy:38, rx:9, ry:16, bottom:-4.0, vary:0.4}, ring:true, predrained:true, arms:[{cx:36.5, cy:36, rx:2.5, ry:24, mouth:[35,38], bottom:-4, vary:0.5, sea:true}], topChannel:[1,30], flip:[0,1], seaCrest:2.4,
    soilBias:0, tools:['look','dike','canal','road','mill','steam','electric','sluice','lock','farm','house','remove'],
    goals:{storm:true, keep:0.9, dry:0.85, crop:0.8}, par:365,   // the storm date is fixed (day ~337 + 36 h), so par must sit after it
    storms:[{date:'1953-01-31', dur:36, surge:4.6}],
    sign:'Marijke Pieck, waterschap',
    intro:'The polder has never been fuller: 170 people, good clay, two old steam pumps. The sea is on two sides of us now, the coast and the estuary, and neither dike has been raised since my grandfather\'s time. Everyone says it\'s fine.',
    epilogue:'The sea came up the dike and stopped just short of the top. Further south it didn\'t. We will be raising dikes for the next fifty years.',
    steps:[
      {text:'Pick Look and tap the sea dike. Check its crest.', done:g=>g.flags.inspectedSea, tool:'look', focus:'sea'},
      {text:'Raise every sea dike to +4.5 m, along the coast and the estuary. Draw along it with Dike, then tap Again.', done:g=>g.m.seaMin>=4.5, focus:'sea', tool:'dike'},
      {text:'Build an electric pump as a backup for the old steam pumps.', done:g=>g.m.electric>=1, tool:'electric'},
      {text:'Get through the winter storm with 90% of homes standing and the crops healthy. If the sea gets through a dike, salt ruins the crops for months.', done:g=>g.stormsPassed>=1}
    ],
    letters:[
      {k:'f1', when:g=>g.tick>DAY*30, text:'The old mills on the ring dike can\'t lift from this deep. They\'re kept for the postcards.'},
      {k:'f2', when:g=>g.tick>DAY*200, text:'If the sea gets into the ring canal, it spills over every low dike into the polder. The ring dike is only +0.2 m.', alert:true}
    ]},
  { id:'delta', name:'De Deltawerken', blurb:'1952 · Close two sea arms before the next storm.',
    start:'1952-09-01', C:44, R:72, money:44000, seed:73,
    land:0.1, arms:[{cx:13, cy:40, rx:5, ry:20, mouth:[11,16], bottom:-3.0, vary:0.4}, {cx:32, cy:46, rx:7, ry:17, lobes:[[28,30,5,7]], mouth:[30,35], bottom:-3.4, vary:0.4}], topChannel:[1,6], town:[22,8], flip:[1,1], seaCrest:2.6,
    soilBias:0.2, tools:['look','dike','canal','road','mill','steam','electric','sluice','lock','farm','house','remove'],
    goals:{dry:0.7, farms:20, pop:60, storm:true}, par:560,
    storms:[{date:'1953-01-31', dur:36, surge:3.4}, {date:'1954-02-10', dur:30, surge:3.8}],
    sign:'Marijke Pieck, waterschap',
    intro:'On the last night of January the sea took the south-west. We were spared by a few centimetres. Now the government wants the sea arms closed. Every arm we dam is coast we no longer have to raise. Two storms will test it.',
    epilogue:'The arms are closed and the dikes held through the second storm. Fifty years from now someone will say we should have done more. They will be right, and they will be standing on dry land.',
    steps:[
      {text:'Dam both sea arms where they meet the sea. Every dam makes the coast you have to defend shorter.', done:g=>g.m.armSea===0, focus:'mouth', tool:'dike'},
      {text:'Raise what is left of the sea dike to +4.5 m before the January storm, the dams too. It is only +2.6 m now.', done:g=>g.m.seaMin>=4.5, focus:'sea', tool:'dike'},
      {text:'Build steam pumps on the dams, linked to town by road.', done:g=>g.flags.steamRan, tool:'steam'},
      {text:'Dig deep canals from the pumps over the floor of each arm.', done:g=>g.m.deepCanals>=20, tool:'canal'},
      {text:'Ride out both storms, then drain 70% and build 20 farms and homes for 60 people.', done:g=>g.stormsPassed>=2 && g.m.dry>=0.7 && g.m.farms>=20 && g.m.pop>=60}
    ],
    letters:[
      {k:'f1', when:g=>g.tick>DAY*60, text:'Everyone remembers last winter. Nobody wants to pay for the dike. Both are true.'},
      {k:'f2', when:g=>g.tick>DAY*110, text:'The storm is close. The sea dike is the first thing the water will find.', alert:true}
    ]},
  { id:'vrij', name:'Vrij spel', blurb:'Sandbox · All tools, a big lake, winter storms.',
    start:'1700-04-01', C:44, R:72, money:60000, seed:71,
    land:0.2, lake:{cx:24, cy:41, rx:11, ry:14, bottom:-4.0, vary:0.6, lobes:[[16,28,7,8],[30,58,7,7]]}, ring:true, river:true, flip:[1,1],
    soilBias:0.15, tools:['look','dike','canal','road','mill','steam','electric','sluice','lock','farm','house','remove'],
    goals:{}, par:0, sandbox:true,
    storms:[{date:'1701-01-20', dur:30, surge:1.8},{date:'1702-02-05', dur:36, surge:2.4},{date:'1703-01-12', dur:40, surge:2.9}],
    sign:'', intro:'Sandbox. No goals, a big lake and three winter storms. Build what you like.', steps:[], letters:[]}
];

