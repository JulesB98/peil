"use strict";
/* ===== STORY =====
   Data only. Per scenario id:
   photo  {src, alt, credit}         real picture, shown on the intro and on the real-life card
   story  [paragraphs]               the longer intro, in the voice of the Pieck family (the old one-line intro stays in the log)
   goal   'text'                     what you have to do, in one sentence (level 0 shows it large)
   real   {title, text, facts[]}     "In real life": shown after a win and from the Letters panel
   All photos are CC0 or public domain (Nationaal Archief, Rijksmuseum, Wikimedia Commons). */
const STORY = {
  leren: {
    photo:{src:'img/leren.jpg', alt:'Windmills beside a polder canal', credit:'Windmills draining a polder, Noord-Holland · Nationaal Archief, CC0'},
    goal:'Turn the lake into dry land, and grow a farm on it.',
    story:[
      'Where you stand, the land is lower than the sea. Water wants to be here, and it will come back every time you look away.',
      'Over the centuries the Dutch learned a trick: build a dike around a lake, lift the water out with wind, and the lake bed turns into farmland. We call that land a polder.'
    ],
    real:{title:'Land that was never meant to be dry', text:'Windmills like these pumped Dutch polders dry from the 1400s onward. Every polder is a bowl: the water around it is higher than the land inside, so something has to keep pumping, forever.',
      facts:['About a quarter of the Netherlands lies below sea level.', 'Water boards (waterschappen) date from the 1200s. They are among the oldest democratic bodies still at work.', 'A polder mill lifts water only about 1.5 m. Higher means stacking mills one after another.']}
  },
  kleine: {
    photo:{src:'img/kleine.jpg', alt:'Old map of the drained Beemster polder', credit:'Map of the Beemster polder · Rijksmuseum, CC0'},
    goal:'Drain the lake, then build four farms.',
    story:[
      'My father lost his barn to the Kleine Plas. It crept closer each winter, a hand-width at a time, and nobody did anything because nobody knew how.',
      'Now there is a new idea going around, and it comes from Beemster. Dike the lake in. Lift it out with mills. Plant the bed. Men who sneered at it ten years ago are queuing to buy shares.',
      'I have the council\'s money, one summer, and a surveyor who says the lake is shallow. Let us begin.'
    ],
    real:{title:'The Beemster, 1612', text:'The Beemster was a lake of about 7,000 hectares. Between 1608 and 1612, dozens of windmills lifted its water out, and the lake bed was divided into a strict grid of fields, roads and ditches. The result is so well preserved that it is a UNESCO World Heritage Site.',
      facts:['Jan Adriaanszoon Leeghwater, a mill builder, led much of the work.', 'Investors from Amsterdam paid for it and got the land in return.', 'The map above shows the grid: every straight line is a ditch or a road.']}
  },
  veen: {
    photo:{src:'img/veen.jpg', alt:'Peat diggers at work on long peat lakes, with windmills on the horizon', credit:'In het veen: peat diggers near Grafhorst, wood engraving by Johannes Walter after P.J.C. Gabriël · Rijksmuseum, CC0'},
    goal:'Join the long peat lakes to your mills and drain them.',
    story:[
      'Half of this village burns peat, and the peat came out from under the water. The diggers dredged it up in long rows and dried it on the thin strips of land in between. What they left is a field of long, narrow lakes.',
      'Every winter the waves eat a little more of the strips. Give it fifty years and the small lakes will be one big lake, and the village will be standing at its edge.',
      'The lakes all end in one wetering. Dam it off from the river, put mills on the dam, and give each lake a way to reach them.'
    ],
    real:{title:'Lakes made by digging', text:'In the 17th and 18th centuries peat was the main fuel of Holland. Diggers dredged it from below the water line and dried it on narrow strips called legakkers. The long lakes they left behind (petgaten) grew as the strips washed away. Some became the lake districts of today, like Loosdrecht and Vinkeveen. Others were drained again.',
      facts:['Dredged peat was spread out on the legakkers to dry before it could be burned.', 'The Zuidplaspolder, drained in 1839 and 1840, was once a peat-digging lake. It holds the lowest point of the Netherlands, nearly 7 m below sea level.', 'From the air you can still see the striped pattern of old peat digging in many polders.']}
  },
  diep: {
    photo:{src:'img/diep.jpg', alt:'Old maps of the Zijpe, Beemster, Purmer and Wormer polders', credit:'Maps of the drained polders, 17th century · Rijksmuseum, CC0'},
    goal:'Ring canal, basin, and a chain of mills. Then farms.',
    story:[
      'The Beemster made men rich, so now every lake in Holland has an investor looking at it. Purmer. Wormer. Schermer. They are all being drained, one after another.',
      'The Diepe Meer is the hard one. A single mill lifts water about a metre and a half, and this lake is deeper than that. So we stack them: the first mill lifts into a basin, the second lifts out of the basin, and so on up. We call that a molengang.',
      'It will take a ring canal, patience and a great deal of Amsterdam money. They want to see farms.'
    ],
    real:{title:'Mills in a row', text:'A windmill scoop wheel can only lift water a metre or two. For deeper lakes, builders placed mills in a staircase, each lifting into a basin that the next one emptied. Some Dutch polders still show these chains.',
      facts:['The Purmer was drained in 1622, the Wormer in 1626, the Heerhugowaard around 1631.', 'Drained peat sinks as it dries, so those polders needed mills for the next 400 years.', 'Land owners paid a "polder tax" to the water board to keep the mills turning.']}
  },
  groot: {
    photo:{src:'img/groot.jpg', alt:'The Cruquius steam pumping station', credit:'Pumping station De Cruquius · Wikimedia Commons, public domain'},
    goal:'Steam pumps, a road for coal, and the whole lake dry.',
    story:[
      'Two hundred years of mills, and the Grote Meer still eats a village every winter. In bad storms the water sweeps right up to the city walls. People call it the water wolf.',
      'The engineers say wind is not enough. They want engines: coal-fired, iron, as big as a church. One engine can lift what fifty mills can.',
      'The engines need coal, and coal comes by cart along a road. Cut the road and the engines stop. Remember that.'
    ],
    real:{title:'The Haarlemmermeer, 1852', text:'The Haarlemmermeer was a lake that kept growing and threatened Amsterdam and Leiden. After a decade of debate, three huge steam pumps drained it between 1849 and 1852. The Cruquius engine, shown here, has a cylinder 3.6 metres wide, among the largest ever built.',
      facts:['The lake bed is now farmland, villages, and Schiphol Airport.', 'It was the first big drainage done by steam, not wind.', 'The Cruquius is now a museum, and its giant engine is still there.']}
  },
  meer: {
    photo:{src:'img/meer.jpg', alt:'Aerial photo of the Wieringermeer polder with the Afsluitdijk', credit:'The Wieringermeer from the air · Wikimedia Commons, public domain'},
    goal:'Sixteen farms and seventy people, before the winter storm.',
    story:[
      'This is the first piece of the big plan. A dam will close the sea arm called the Zuiderzee, but before it is finished we are already draining its first corner.',
      'The lake bed is heavy peat. It will sink as it dries, and the water will have to be lifted higher every year. Mills cannot do it. Steam can, if the road holds.',
      'The government has promised new families a farm and a house. It wants them settled before the winter storms.'
    ],
    real:{title:'The Wieringermeer, 1930', text:'The Wieringermeer was the first polder of the Zuiderzee Works. Its dikes were closed in 1929 and the pumps made it dry land in 1930. Around 20,000 hectares of new land appeared, with new villages like Middenmeer.',
      facts:['Pumping stations Leemans and Lely did the work. Lely is named after Cornelis Lely, the engineer behind the whole plan.', 'In April 1945 retreating troops blew up the dike and flooded the polder. It was drained again within months.', 'Settlers were carefully selected before they were given a farm.']}
  },
  afsluit: {
    photo:{src:'img/afsluit.jpg', alt:'Crane barge and wooden materials during the Zuiderzee Works', credit:'Building dikes for the Zuiderzee Works · Nationaal Archief, CC0'},
    goal:'Close the sea arm, then wall off a polder inside the new lake and drain it.',
    story:[
      'The Zuiderzee has been taking fishermen and villages for centuries. In 1916 a storm flooded its shores again. After that nobody argued about whether to close it.',
      'One long dam across its mouth will do it. Behind the dam the salt water slowly turns into a freshwater lake. We will not drain all of it: the lake has to take the rivers and the polder water. We wall off one piece and drain that.',
      'Not everyone is happy. Whole towns made their living from the sea behind it.'
    ],
    real:{title:'The Afsluitdijk, 1932', text:'The Afsluitdijk is 32 kilometres long. It was closed on 28 May 1932 and turned the Zuiderzee into the IJsselmeer, a freshwater lake. Four more big polders were drained behind it over the next decades.',
      facts:['It was designed after the Zuiderzee flood of 1916, using the plan of Cornelis Lely.', 'It carries the A7 motorway and two big sluice complexes that let the IJsselmeer drain into the Wadden Sea.', 'Fishing towns like Volendam and Enkhuizen lost their sea. Enkhuizen now has a Zuiderzee museum.']}
  },
  storm: {
    photo:{src:'img/storm.jpg', alt:'Medal showing a house in flood waves, dated 1 February 1953', credit:'Medal for the flood of 1 February 1953 · Rijksmuseum, CC0'},
    goal:'Survive the night of the storm with your houses intact.',
    story:[
      'Everyone says the dike is fine. It has held for a hundred years, they say. The old men on the dike listen to the wind and say nothing.',
      'A north-western gale is coming up the North Sea, and the spring tide is high. If the two meet, the sea has only the dike to stop it.',
      'Raise the dike now, while there is time. Tomorrow there will not be.'
    ],
    real:{title:'1 February 1953', text:'During the night of 31 January to 1 February 1953, a north-western storm and a spring tide met. Dikes in Zeeland and South Holland failed. More than 1,800 people died, and about 200,000 hectares of land flooded.',
      facts:['It was the worst natural disaster in the Netherlands in modern times.', 'Many dikes were too low and many were weak in the back, where overtopping water eroded them.', 'It led directly to the Delta Works.']}
  },
  delta: {
    photo:{src:'img/delta.jpg', alt:'Building the Haringvliet sluices', credit:'Building the Haringvliet sluices, Delta Works · Nationaal Archief, CC0'},
    goal:'Close both sea arms, raise the sea dike, and survive two storms.',
    story:[
      'On the last night of January the sea took the south-west. Our dike held by a few centimetres. Not everyone was so lucky.',
      'Parliament has decided: never again. Every sea arm in the delta will be closed or fitted with a gate, and the coast will be raised to stand a storm that comes once in many thousand years.',
      'You start with two open arms and a low dike. Two storms will test what you build.'
    ],
    real:{title:'The Delta Works, 1958-1997', text:'After the 1953 flood, the Delta Act of 1958 set a new safety standard and launched the Delta Works: dams, sluices, and surge barriers that shortened the coast by 700 kilometres. The Haringvlietdam was finished in 1971 and the Oosterscheldekering, a barrier that is usually open, in 1986.',
      facts:['The Maeslantkering, the last big barrier, closed for the first time in 2023.', 'The standard for the main coast is a storm that comes once in 10,000 years.', 'Some of the 1953 dikes are still being raised, as sea level creeps up.']}
  }
};

/* New tools: shown once at the start of the first chapter that has them (after the story).
   film: a short demo on the film engine (js/film.js); otherwise just a card. */
const TOOLINFO = {
  steam:{film:true, title:'New: the steam pump', pump:'steam', lift:'6 m', cost:'coal, ƒ12 a day', text:'A coal-fired engine. It lifts water up to 6 m, where a mill gives up at 1.6 m, and it does not need wind.', need:'Coal arrives by cart along a road from the town. Cut the road and the engine stops.'},
  electric:{film:true, title:'New: the electric pump', pump:'electric', lift:'8 m', cost:'power, ƒ4 a day', text:'Lifts water up to 8 m and needs neither wind nor coal carts.', need:'It only needs a link to the town, a road or a dike top, for the power line.'},
  lock:{film:false, title:'New: the lock', text:'A lock lets barges through a dike, between a canal in the polder and the boezem. A farm next to barge water ships its grain by barge, and that grain sells for half again as much as by cart.', need:'Barges need '+DRAFT+' m of water all the way to the lock, and every barge that passes lets some boezem water into your polder. Pumps empty a canal down to the bottom of the canal cell at their feet, so dig the barge canal deeper than that.'},
  sluice:{film:false, title:'New: the sluice', text:'A gate in a dike beside the boezem or the sea. It opens by itself when the water outside is lower than inside, and drains your polder for free.', need:'It cannot work when the sea is higher. Then you need a pump.'}
};
function newTools(sc){
  const i=SCENARIOS.indexOf(sc); if (i<0 || sc.tutorial || sc.sandbox) return [];
  const seen=new Set(); for (let k=0;k<i;k++) for (const t of SCENARIOS[k].tools) seen.add(t);
  return sc.tools.filter(t=>!seen.has(t) && TOOLINFO[t]);
}
