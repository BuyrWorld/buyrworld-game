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
    hub:[27,25], buildings:['hall','bank','exchange'], unlock:{type:'open'} },
  { id:'manufacturing', name:'Manufacturing Quarter', ic:'🏭', color:'#b06a3a',
    blurb:'Furnaces, workshops and the sawmill — where raw becomes made.',
    hub:[14,25], buildings:['furnace','workshop','sawmill','artisan_shed'], unlock:{type:'open'} },
  { id:'logistics', name:'Logistics Hub', ic:'🚚', color:'#4a7a9a',
    blurb:'The depot and market stalls — moving goods and closing deals.',
    hub:[16,29], buildings:['depot','stall_marge','stall_bolt','stall_perry','stall_finn'], unlock:{type:'open'} },
  { id:'retail', name:'Retail High Street', ic:'🛍️', color:'#e05a80',
    blurb:'Shops, services and nightlife along the bustling high street.',
    hub:[30,5], buildings:['retail','postoffice','estateagent','bike_shop','furniture_shop','pub','nightclub','police_station'], unlock:{type:'open'} },
  { id:'residential', name:'Residential & Leisure', ic:'🏡', color:'#6aaa5a',
    blurb:'Cottages, the café, the park and the trophy hall — home life.',
    hub:[68,28], buildings:['cafe','barn','trophy','player_home'], prefixes:['home_'], unlock:{type:'open'} },
  { id:'university', name:'University & Research Park', ic:'🎓', color:'#7a5ac0',
    blurb:'The school, university and forager’s hut — learning and study.',
    hub:[80,25], buildings:['school','university','forager_hut'], unlock:{type:'open'} },
  { id:'harbour', name:'Harbour District', ic:'⚓', color:'#3a8aa8',
    blurb:'Docks, boats and the fish trade on the south-east coast.',
    hub:[57,32], buildings:['harbour_office','boat_hire','fishmonger_wh','pier','stall_marina'], unlock:{type:'level', n:100} },
  { id:'robotics', name:'Robotics & Automation', ic:'🤖', color:'#5a8ac0',
    blurb:'The Automation Lab — build helper bots to work your skills.',
    hub:[75,4], buildings:['robotics_lab'], unlock:{type:'level', n:150} },
  { id:'energy', name:'Energy & Data Centre', ic:'⚡', color:'#c0a020',
    blurb:'The Data Centre — upgrade the power grid for a town-wide efficiency boost.',
    hub:[83,4], buildings:['data_centre'], unlock:{type:'level', n:200} },
];

export function isDistrictOpen(d: District, totalLevel: number): boolean {
  if (d.unlock.type === 'open') return true;
  if (d.unlock.type === 'level') return totalLevel >= d.unlock.n;
  return false; // planned
}

// The next level-gated district the player hasn't reached yet (for goal display).
export function nextGatedDistrict(totalLevel: number): District | null {
  const gated = DISTRICTS.filter(d => d.unlock.type === 'level')
    .sort((a, b) => (a.unlock as any).n - (b.unlock as any).n);
  return gated.find(d => totalLevel < (d.unlock as any).n) || null;
}

// Which district a building id belongs to (by id or prefix); null if none.
export function districtForBuilding(objId: string): string | null {
  for (const d of DISTRICTS) {
    if (d.buildings.includes(objId)) return d.id;
    if (d.prefixes && d.prefixes.some(p => objId.startsWith(p))) return d.id;
  }
  return null;
}
