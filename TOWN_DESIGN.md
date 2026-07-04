# TOWN_DESIGN.md — Living Town Implementation Guide (v1)
Principle: the town is the game. Every area must answer "why visit?" or be redesigned.

## Layout rules
- No grid. Organic paths, a river with 2 bridges, central plaza + fountain, parks, flower beds, back alleys.
- Landmarks visible from distance (one per district) for instant screenshot recognition.
- Current 36×22 map grows by annexing district plots at map edges (data-driven map chunks), not by redrawing.

## Districts (rollout order, one per milestone-cluster)
| District | Palette | Ambience | Anchor buildings | Exclusive loop |
|---|---|---|---|---|
| Town Centre (exists) | meadow/cream | birds, fountain | Furnace, Workshop, Depot, Hall, Market | current core loop |
| Retail High Street | candy brights | crowd chatter, tills | Retail Centre, Coffee Shop, Estate Agent | shop economy, cosmetics |
| Logistics Hub | steel blue/amber | forklifts, reversing beeps | Warehouse, Port, rail yard | bulk contracts, routing |
| Financial District | navy/gold, glass | traffic, fountains | Bank, Exchange Floor | investing, net worth, loans |
| University & Research Park | ivy green/stone | pages, bells | University, Library | courses → skill multipliers |
| Manufacturing Quarter | brick red/smoke | machinery | Mega-factory, QC lab | production lines, quality |
| Residential & Leisure | pastel | kids, dogs | Homes, Gym, Park, Arcade & Music Hall | housing, energy, social |
| Robotics & AI Campus | white/neon teal | servo hums | Robotics Lab, Data Centre | automation endgame |

## Every building has gameplay (no décor-only)
- Bank: savings interest, loans, portfolio, net-worth screen.
- Coffee Shop: energy restore, rotating NPC micro-quests.
- Gym: stamina stat → faster action speed buff.
- University: courses (time+coins) → permanent skill perks.
- Estate Agent: buy/upgrade homes → visible in Residential district.
- Exchange Floor: fictional stocks driven by economy signals (child-safe risk-play, not gambling).
- Hospital: recover energy after over-work; Airport/Port: future expansion + imports.

## Living NPCs (routine system)
- Game clock bands: Morning 6–11 (commute to factories/uni, cafés busy), Midday 11–16 (shops, deliveries, construction), Evening 16–22 (restaurants, arcade, residential), Night 22–6 (streetlights, sparse walkers, foxes).
- NPC = JSON: {id, name, palette, home, work, hangout, tips[], questIds[], memoryKey}.
- Schedule = list of (band → location); pathing = existing wander-to-target within area.

## Interactive scenery (each = small reward + cooldown)
- Benches (rest buff), vending machines (coffee), mailbox (daily reward), fruit trees (harvest), post box, construction sites (watch → tip), random NPC surprise quests.

## Secrets (drip-feed 1–2 per milestone)
- Hidden alley behind Market; rooftop access via ladder; underground tunnel quarry→port; abandoned factory (restorable); secret lab; rare companion spawns at odd hours; Easter eggs (dev references, IREN ticker gag on Exchange).

## Dynamic world
- Day/night tint + streetlights (first), then weather (rain → snow), seasons re-palette tiles, holiday decorations by real date, construction projects that finish over real days, economy booms/recessions (ties to AI news later).

## Visible player progression
- Home upgrades render in Residential; factory tier changes smoke/size; owned vehicles park/drive (exists — extend); statue/plaza upgrades at wealth tiers.

## Engagement heartbeat
- Scheduler guarantees an event every 20–30s of active play: pick from {NPC line, price alert, companion sighting, mailbox ping, mini-quest, discovery sparkle}. Weight by what player hasn't seen recently.

## Ambience (per district, layered under music)
- Industrial: machinery/forklift beeps · Financial: traffic/fountain · Residential: birds/kids/dogs · Port: gulls/cranes/water · Arcade: crowd/bass.
