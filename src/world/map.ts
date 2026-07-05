export const TILE   = 24;
export const VCOLS  = 96;
export const VROWS  = 39;
export const VIEW_W = 576;
export const VIEW_H = 360;

// Map key: T=border/tree, G=grass, C=concrete, D=dirt/quarry, P=path, W=water, S=sand, F=forest floor
// East extension (cols 48-95): PP spine road → residential district → FFFFFFF forest → T border
// Path rows (5,10) continue east as road through residential; other rows are grass
export const VMAP: string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 0
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 1
  'TCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 2
  'TCDDDDDDCGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 3
  'TCDDDDDDCGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 4
  'TCDDDDDDCPPPPPPPPPPPPPPPPPPPPPPPPPGPPPPFFFFFFFFGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGGGGGFFFFFFFT', // 5
  'TCDDDDDDDPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 6
  'TCDDDDDDCPGGGGWWWWGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 7
  'TCCCCCCCCPGGGGWWWWGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 8
  'TGGGGGGGGPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 9
  'TGGGGGGGGPPPPPPPPPPPPPPPPPPPPPPPPPGPPPPFFFFFFFFGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGGGGGFFFFFFFT', // 10
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 11
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 12
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 13
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 14
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 15
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 16
  'TSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSST', // 17
  'TSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSST', // 18
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 19
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 20
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 21
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 22
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 23
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 24
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 25
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 26
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 27
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 28
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 29
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 30
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 31
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 32
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 33
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 34
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 35
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 36
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 37
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 38
];

export interface WorldObject {
  id: string;
  kind: string;
  tx: number;
  ty: number;
  w?: number;
  h?: number;
  tab?: string;
  name?: string;
  ic?: string;
  ore?: string;
  lvl?: number;
  vein?: string;
  sparkle?: boolean;
  wall?: string;
  roof?: string;
  chimney?: boolean;
  awn?: string;
  hair?: string;
  shirt?: string;
}

export const V_OBJECTS: WorldObject[] = [
  // --- Mining rocks (west quarry) ---
  { id: 'rock_iron',   kind: 'rock',  tx: 3,  ty: 3,  ore: 'iron_ore',   lvl: 1,  vein: '#aab2bd' },
  { id: 'rock_copper', kind: 'rock',  tx: 5,  ty: 3,  ore: 'copper_ore', lvl: 5,  vein: '#c97b45' },
  { id: 'rock_coal',   kind: 'rock',  tx: 3,  ty: 5,  ore: 'coal',       lvl: 10, vein: '#2f2f38' },
  { id: 'rock_baux',   kind: 'rock',  tx: 5,  ty: 5,  ore: 'bauxite',    lvl: 20, vein: '#e0863a' },
  { id: 'rock_rare',   kind: 'rock',  tx: 2,  ty: 6,  ore: 'rare_earth', lvl: 40, vein: '#7ee0ff', sparkle: true },
  // --- Industrial buildings ---
  { id: 'furnace',     kind: 'bld',   tx: 11, ty: 2,  w: 3, h: 3, tab: 'steelworks',    name: 'Furnace',       ic: '🔥', wall: '#c9b294', roof: '#8a5a3c', chimney: true },
  { id: 'workshop',    kind: 'bld',   tx: 15, ty: 2,  w: 3, h: 3, tab: 'manufacturing', name: 'Workshop',      ic: '⚙️', wall: '#dbc99f', roof: '#5f7fbe' },
  { id: 'depot',       kind: 'bld',   tx: 19, ty: 2,  w: 3, h: 3, tab: 'contracts',     name: 'Depot',         ic: '📦', wall: '#cfd8bd', roof: '#4e7d5b' },
  { id: 'hall',        kind: 'bld',   tx: 23, ty: 2,  w: 3, h: 3, tab: 'upgrades',      name: 'Town Hall',     ic: '🛒', wall: '#ecdfc6', roof: '#b0574f' },
  { id: 'bank',        kind: 'bld',   tx: 27, ty: 2,  w: 2, h: 3, tab: 'bank',          name: 'Village Bank',  ic: '🏦', wall: '#e8e0cc', roof: '#8a7a5a' },
  { id: 'exchange',    kind: 'bld',   tx: 30, ty: 2,  w: 2, h: 3, tab: 'exchange',      name: 'Exchange Floor', ic: '📈', wall: '#d0d8e8', roof: '#2a4a6a' },
  // --- Trade stalls ---
  { id: 'stall_marge', kind: 'stall', tx: 12, ty: 11, w: 2, h: 2, tab: 'trade', name: 'Marge',  lvl: 1,  awn: '#ff8a5c', hair: '#c9a24b', shirt: '#7cb46b' },
  { id: 'stall_bolt',  kind: 'stall', tx: 15, ty: 11, w: 2, h: 2, tab: 'trade', name: 'Bolt',   lvl: 10, awn: '#6fb7d9', hair: '#3a3a3a', shirt: '#c9723a' },
  { id: 'stall_perry', kind: 'stall', tx: 18, ty: 11, w: 2, h: 2, tab: 'trade', name: 'Perry',  lvl: 25, awn: '#e8c94e', hair: '#7a4a2a', shirt: '#4a6ea9' },
  // --- Other buildings ---
  { id: 'barn',        kind: 'bld',   tx: 24, ty: 11, w: 3, h: 3, tab: 'pets',     name: 'Companion Barn', ic: '🐾', wall: '#d9a86a', roof: '#9a5f3a' },
  { id: 'trophy',      kind: 'bld',   tx: 29, ty: 11, w: 2, h: 2, tab: 'ach',      name: 'Trophy Hall',    ic: '🏆', wall: '#e8dcb8', roof: '#c9a02e' },
  { id: 'sign',        kind: 'sign',  tx: 12, ty: 12, w: 1, h: 1, tab: 'settings', name: 'Save Post',      ic: '💾' },
  // --- Forest cabin (east) ---
  { id: 'sawmill',     kind: 'bld',   tx: 41, ty: 3,  w: 3, h: 3, tab: 'woodcutting', name: 'Sawmill', ic: '🪓', wall: '#9a7050', roof: '#5a3a20' },
  // --- Pier & fishmonger (beach) ---
  { id: 'pier',         kind: 'bld',   tx: 22, ty: 16, w: 3, h: 2, tab: 'fishing', name: 'Pier',    ic: '🎣', wall: '#8c6947', roof: '#6a4a28' },
  { id: 'stall_marina', kind: 'stall', tx: 17, ty: 16, w: 2, h: 2, tab: 'trade',   name: 'Marina',  lvl: 1,  awn: '#4da8cc', hair: '#8a5a20', shirt: '#4a7a9a' },
  // --- Streetlamps (town) ---
  { id: 'lamp_1', kind: 'lamp', tx: 10, ty: 6,  w: 1, h: 1 },
  { id: 'lamp_2', kind: 'lamp', tx: 32, ty: 6,  w: 1, h: 1 },
  { id: 'lamp_3', kind: 'lamp', tx: 10, ty: 11, w: 1, h: 1 },
  { id: 'lamp_4', kind: 'lamp', tx: 32, ty: 11, w: 1, h: 1 },
  // --- Streetlamps (residential district) ---
  { id: 'lamp_r1', kind: 'lamp', tx: 49, ty: 5,  w: 1, h: 1 },
  { id: 'lamp_r2', kind: 'lamp', tx: 49, ty: 10, w: 1, h: 1 },
  { id: 'lamp_r3', kind: 'lamp', tx: 74, ty: 5,  w: 1, h: 1 },
  { id: 'lamp_r4', kind: 'lamp', tx: 74, ty: 10, w: 1, h: 1 },
  // --- Forest trees ---
  { id: 'tree_pine1',  kind: 'tree', tx: 41, ty: 2,  w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_pine2',  kind: 'tree', tx: 41, ty: 8,  w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_pine3',  kind: 'tree', tx: 44, ty: 3,  w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_pine4',  kind: 'tree', tx: 45, ty: 5,  w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_oak1',   kind: 'tree', tx: 44, ty: 10, w: 1, h: 2, ore: 'oak',      lvl: 8  },
  { id: 'tree_oak2',   kind: 'tree', tx: 45, ty: 8,  w: 1, h: 2, ore: 'oak',      lvl: 8  },
  { id: 'tree_oak3',   kind: 'tree', tx: 41, ty: 12, w: 1, h: 2, ore: 'oak',      lvl: 8  },
  { id: 'tree_hard1',  kind: 'tree', tx: 44, ty: 14, w: 1, h: 2, ore: 'hardwood', lvl: 20 },
  { id: 'tree_hard2',  kind: 'tree', tx: 45, ty: 13, w: 1, h: 2, ore: 'hardwood', lvl: 20 },
  // --- Town decorations ---
  { id: 'fountain',  kind: 'fountain', tx: 22, ty: 6,  w: 2, h: 2, name: 'Fountain' },
  { id: 'bench_1',   kind: 'bench',    tx: 19, ty: 7,  w: 2, h: 1, name: 'Bench' },
  { id: 'bench_2',   kind: 'bench',    tx: 26, ty: 7,  w: 2, h: 1, name: 'Bench' },
  { id: 'pot_1',     kind: 'plant',    tx: 12, ty: 6,  w: 1, h: 1 },
  { id: 'pot_2',     kind: 'plant',    tx: 27, ty: 12, w: 1, h: 1 },
  { id: 'pot_3',     kind: 'plant',    tx: 11, ty: 9,  w: 1, h: 1 },
  { id: 'pot_4',     kind: 'plant',    tx: 30, ty: 9,  w: 1, h: 1 },
  { id: 'pot_5',     kind: 'plant',    tx: 31, ty: 6,  w: 1, h: 1 },
  { id: 'flowerbed', kind: 'plant',    tx: 21, ty: 9,  w: 2, h: 1 },
  // --- East forest trees (cols 88-94, woodcutting-capable) ---
  { id: 'tree_e_pine1', kind: 'tree', tx: 88, ty: 3,  w: 1, h: 2, ore: 'pine',     lvl: 1 },
  { id: 'tree_e_pine2', kind: 'tree', tx: 90, ty: 7,  w: 1, h: 2, ore: 'pine',     lvl: 1 },
  { id: 'tree_e_pine3', kind: 'tree', tx: 93, ty: 2,  w: 1, h: 2, ore: 'pine',     lvl: 1 },
  { id: 'tree_e_oak1',  kind: 'tree', tx: 89, ty: 11, w: 1, h: 2, ore: 'oak',      lvl: 8 },
  { id: 'tree_e_oak2',  kind: 'tree', tx: 92, ty: 14, w: 1, h: 2, ore: 'oak',      lvl: 8 },
  { id: 'tree_e_hard1', kind: 'tree', tx: 91, ty: 5,  w: 1, h: 2, ore: 'hardwood', lvl: 20 },
  // --- Park (residential district, around tx:77-83, ty:7-9) ---
  { id: 'park_bench_1', kind: 'bench', tx: 77, ty: 8, w: 2, h: 1 },
  { id: 'park_bench_2', kind: 'bench', tx: 82, ty: 8, w: 2, h: 1 },
  { id: 'park_flower1', kind: 'plant', tx: 78, ty: 7, w: 2, h: 1 },
  { id: 'park_flower2', kind: 'plant', tx: 80, ty: 9, w: 2, h: 1 },
  // --- Residential decorations (planters along home rows) ---
  { id: 'home_pot_1', kind: 'plant', tx: 54, ty: 5, w: 1, h: 1 },
  { id: 'home_pot_2', kind: 'plant', tx: 59, ty: 5, w: 1, h: 1 },
  { id: 'home_pot_3', kind: 'plant', tx: 64, ty: 5, w: 1, h: 1 },
  { id: 'home_pot_4', kind: 'plant', tx: 70, ty: 5, w: 1, h: 1 },
  { id: 'home_pot_5', kind: 'plant', tx: 54, ty: 10, w: 1, h: 1 },
  { id: 'home_pot_6', kind: 'plant', tx: 59, ty: 10, w: 1, h: 1 },
  { id: 'home_pot_7', kind: 'plant', tx: 64, ty: 10, w: 1, h: 1 },
  { id: 'home_pot_8', kind: 'plant', tx: 69, ty: 10, w: 1, h: 1 },
  // --- Residential homes (east district, 3 rows × 5 homes) ---
  // Row A: north of east path (ty=3, approach from south at path row 5)
  { id: 'home_01', kind: 'bld', tx: 51, ty: 3, w: 2, h: 2, tab: 'home', name: "Agnes's Cottage",  ic: '🏠', wall: '#d9c8b0', roof: '#8a6a4a' },
  { id: 'home_02', kind: 'bld', tx: 56, ty: 3, w: 2, h: 2, tab: 'home', name: "Bertie's Cottage",  ic: '🏠', wall: '#c8b8a0', roof: '#6a5a4a' },
  { id: 'home_03', kind: 'bld', tx: 61, ty: 3, w: 2, h: 2, tab: 'home', name: "Clara's Cottage",   ic: '🏠', wall: '#e8d8a0', roof: '#8a7a3a' },
  { id: 'home_04', kind: 'bld', tx: 66, ty: 3, w: 2, h: 2, tab: 'home', name: "Derek's Cottage",   ic: '🏠', wall: '#b8c8b0', roof: '#4a6a4a' },
  { id: 'home_05', kind: 'bld', tx: 71, ty: 3, w: 2, h: 2, tab: 'home', name: "Edna's Cottage",    ic: '🏠', wall: '#d8c0d0', roof: '#7a5a7a' },
  { id: 'cafe',    kind: 'bld', tx: 68, ty: 3, w: 2, h: 2, tab: 'cafe', name: 'Village Café',       ic: '☕', wall: '#f0e8d0', roof: '#c06030' },
  // Row B: between east paths (ty=6, approach at row 8 grass)
  { id: 'home_06', kind: 'bld', tx: 51, ty: 6, w: 2, h: 2, tab: 'home', name: "Frank's Cottage",   ic: '🏠', wall: '#c8b0a0', roof: '#7a5040' },
  { id: 'home_07', kind: 'bld', tx: 56, ty: 6, w: 2, h: 2, tab: 'home', name: "Gracie's Cottage",  ic: '🏠', wall: '#b8d0b0', roof: '#4a7a4a' },
  { id: 'home_08', kind: 'bld', tx: 61, ty: 6, w: 2, h: 2, tab: 'home', name: "Hector's Cottage",  ic: '🏠', wall: '#b0b8d0', roof: '#3a4a7a' },
  { id: 'home_09', kind: 'bld', tx: 66, ty: 6, w: 2, h: 2, tab: 'home', name: "Ida's Cottage",     ic: '🏠', wall: '#b0c8d8', roof: '#3a5a7a' },
  { id: 'home_10',    kind: 'bld', tx: 71, ty: 6, w: 2, h: 2, tab: 'home',   name: "Jack's Cottage",  ic: '🏠', wall: '#d0b0b0', roof: '#6a3a3a' },
  { id: 'player_home', kind: 'bld', tx: 68, ty: 6, w: 2, h: 2, tab: 'myhome', name: 'Your Cottage',    ic: '🏡', wall: '#d4c8a8', roof: '#7a5a40' },
  // Row C: south section (ty=11, approach at row 13 grass)
  { id: 'home_11', kind: 'bld', tx: 51, ty: 11, w: 2, h: 2, tab: 'home', name: "Kitty's Cottage",  ic: '🏠', wall: '#b8c0d0', roof: '#4a5a7a' },
  { id: 'home_12', kind: 'bld', tx: 56, ty: 11, w: 2, h: 2, tab: 'home', name: "Lenny's Cottage",  ic: '🏠', wall: '#d0d0b8', roof: '#5a5a3a' },
  { id: 'home_13', kind: 'bld', tx: 61, ty: 11, w: 2, h: 2, tab: 'home', name: "Mabel's Cottage",  ic: '🏠', wall: '#e0c8d0', roof: '#7a4a5a' },
  { id: 'home_14', kind: 'bld', tx: 66, ty: 11, w: 2, h: 2, tab: 'home', name: "Ned's Cottage",    ic: '🏠', wall: '#b8c8b0', roof: '#3a5a3a' },
  { id: 'home_15', kind: 'bld', tx: 71, ty: 11, w: 2, h: 2, tab: 'home', name: "Olive's Cottage",  ic: '🏠', wall: '#b0ccd8', roof: '#3a607a' },
  // --- Village School (north of park, accessible from east path row 5) ---
  { id: 'school',     kind: 'bld', tx: 76, ty: 2, w: 5, h: 3, tab: 'school',     name: 'Village School', ic: '🏫', wall: '#e8e4c0', roof: '#5a8a4a' },
  { id: 'university', kind: 'bld', tx: 82, ty: 2, w: 3, h: 3, tab: 'university', name: 'University',     ic: '🎓', wall: '#ddd8c0', roof: '#4a3a7a' },
  // --- Park interactive equipment (interaction zones; drawn by drawExtras) ---
  { id: 'park_slide', kind: 'slide', tx: 82, ty: 6, w: 2, h: 2, name: 'Slide' },
  { id: 'park_swing', kind: 'swing', tx: 84, ty: 7, w: 2, h: 2, name: 'Swings' },
];
