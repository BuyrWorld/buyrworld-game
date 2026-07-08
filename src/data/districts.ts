// @ts-nocheck
// Districts — a data-driven registry that gives Featherstone's sprawling map
// legible identity and breadth. Groups existing buildings into named districts
// (with a hub tile to fast-travel to and an unlock rule); the not-yet-built ones
// are present as `planned` entries. Pure/testable — UI lives in main.ts.

export interface District {
  id: string; name: string; ic: string; color: string; blurb: string;
  hub: [number, number];                 // tile (tx,ty) to centre on when visiting
  buildings: string[];                    // V_OBJECT ids in this district
  prefixes?: string[];                    // id prefixes (e.g. "home_") also belong here
  unlock: { type: 'open' } | { type: 'level'; n: number } | { type: 'planned' };
}

export const DISTRICTS: District[] = [
  { id:'financial', name:'Financial District', ic:'🏦', color:'#d8b84a',
    blurb:'Coin, credit and commodities — the money heart of the valley.',
    hub:[28,23], buildings:['hall','bank','exchange'], unlock:{type:'open'} },
  { id:'manufacturing', name:'Manufacturing Quarter', ic:'🏭', color:'#b06a3a',
    blurb:'Furnaces, workshops and the sawmill — where raw becomes made.',
    hub:[14,23], buildings:['furnace','workshop','sawmill','artisan_shed'], unlock:{type:'open'} },
  { id:'logistics', name:'Logistics Hub', ic:'🚚', color:'#4a7a9a',
    blurb:'The depot and market stalls — moving goods and closing deals.',
    hub:[17,31], buildings:['depot','stall_marge','stall_bolt','stall_perry','stall_finn'], unlock:{type:'open'} },
  { id:'retail', name:'Retail High Street', ic:'🛍️', color:'#e05a80',
    blurb:'Shops, services and nightlife along the bustling high street.',
    hub:[30,3], buildings:['retail','postoffice','estateagent','bike_shop','furniture_shop','pub','nightclub','police_station'], unlock:{type:'open'} },
  { id:'residential', name:'Residential & Leisure', ic:'🏡', color:'#6aaa5a',
    blurb:'Cottages, the café, the park and the trophy hall — home life.',
    hub:[68,28], buildings:['cafe','barn','trophy','player_home'], prefixes:['home_'], unlock:{type:'open'} },
  { id:'university', name:'University & Research Park', ic:'🎓', color:'#7a5ac0',
    blurb:'The school, university and forager’s hut — learning and study.',
    hub:[80,23], buildings:['school','university','forager_hut'], unlock:{type:'open'} },
  { id:'harbour', name:'Harbour District', ic:'⚓', color:'#3a8aa8',
    blurb:'Docks, boats and the fish trade on the south-east coast.',
    hub:[60,34], buildings:['harbour_office','boat_hire','fishmonger_wh','pier','stall_marina'], unlock:{type:'level', n:100} },
  { id:'robotics', name:'Robotics & AI Campus', ic:'🤖', color:'#8a8a9a',
    blurb:'Automation, robotics and AI research. In development.',
    hub:[88,45], buildings:[], unlock:{type:'planned'} },
  { id:'energy', name:'Energy & Data Centre', ic:'⚡', color:'#c0a020',
    blurb:'Power generation and the data centre. In development.',
    hub:[88,52], buildings:[], unlock:{type:'planned'} },
];

export function isDistrictOpen(d: District, totalLevel: number): boolean {
  if (d.unlock.type === 'open') return true;
  if (d.unlock.type === 'level') return totalLevel >= d.unlock.n;
  return false; // planned
}

// Which district a building id belongs to (by id or prefix); null if none.
export function districtForBuilding(objId: string): string | null {
  for (const d of DISTRICTS) {
    if (d.buildings.includes(objId)) return d.id;
    if (d.prefixes && d.prefixes.some(p => objId.startsWith(p))) return d.id;
  }
  return null;
}
