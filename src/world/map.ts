export const TILE   = 24;
export const VCOLS  = 96;
export const VROWS  = 59;
export const VIEW_W = 576;
export const VIEW_H = 360;
export const NORTH_EXT = 20;

// Map key: T=border/tree, G=grass, C=concrete, D=dirt/quarry, P=path, W=water, S=sand, F=forest floor
// North extension (rows 0-19): retail high street + north forest block
// East extension (cols 48-95): PP spine road → residential district → FFFFFFF forest → T border
// Path rows (5,10) continue east as road through residential; other rows are grass
export const VMAP: string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 0  north border
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT', // 1  retail back
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT', // 2  retail shop row
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT', // 3  retail building ext
  'TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPT', // 4  HIGH STREET
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT', // 5  south plaza/approach
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 6  north forest
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 7
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 8
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 9
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 10
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 11
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 12
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 13
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 14
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 15
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 16
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFPPFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 17
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT', // 18 transition grass
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT', // 19 transition grass
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 20 (was row 0)
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 21 (was row 1)
  'TCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 22 (was row 2)
  'TCDDDDDDCGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 23 (was row 3)
  'TCDDDDDDCGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 24 (was row 4)
  'TCDDDDDDCPPPPPPPPPPPPPPPPPPPPPPPPPGPPPPFFFFFFFFGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGGGGGFFFFFFFT', // 25 (was row 5)
  'TCDDDDDDDPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 26 (was row 6)
  'TCDDDDDDCPGGGGWWWWGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 27 (was row 7)
  'TCCCCCCCCPGGGGWWWWGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 28 (was row 8)
  'TGGGGGGGGPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 29 (was row 9)
  'TGGGGGGGGPPPPPPPPPPPPPPPPPPPPPPPPPGPPPPFFFFFFFFGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGGGGGFFFFFFFT', // 30 (was row 10)
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 31 (was row 11)
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 32 (was row 12)
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 33 (was row 13)
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 34 (was row 14)
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 35 (was row 15)
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFFGPPGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGFFFFFFFT', // 36 (was row 16)
  'TSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSST', // 37 (was row 17)
  'TSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSST', // 38 (was row 18)
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 39 (was row 19)
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 40
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 41
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 42
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 43
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 44
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 45
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 46
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 47
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 48
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 49
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 50
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 51
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 52
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 53
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 54
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 55
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 56
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 57
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 58
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
  { id: 'rock_iron',   kind: 'rock',  tx: 3,  ty: 23, ore: 'iron_ore',   lvl: 1,  vein: '#aab2bd' },
  { id: 'rock_copper', kind: 'rock',  tx: 5,  ty: 23, ore: 'copper_ore', lvl: 5,  vein: '#c97b45' },
  { id: 'rock_coal',   kind: 'rock',  tx: 3,  ty: 25, ore: 'coal',       lvl: 10, vein: '#2f2f38' },
  { id: 'rock_baux',   kind: 'rock',  tx: 5,  ty: 25, ore: 'bauxite',    lvl: 20, vein: '#e0863a' },
  { id: 'rock_rare',   kind: 'rock',  tx: 2,  ty: 26, ore: 'rare_earth', lvl: 40, vein: '#7ee0ff', sparkle: true },
  // --- Industrial buildings ---
  { id: 'furnace',     kind: 'bld',   tx: 11, ty: 22, w: 3, h: 3, tab: 'steelworks',    name: 'Furnace',       ic: '🔥', wall: '#c9b294', roof: '#8a5a3c', chimney: true },
  { id: 'workshop',    kind: 'bld',   tx: 15, ty: 22, w: 3, h: 3, tab: 'manufacturing', name: 'Workshop',      ic: '⚙️', wall: '#dbc99f', roof: '#5f7fbe' },
  { id: 'depot',       kind: 'bld',   tx: 19, ty: 22, w: 3, h: 3, tab: 'contracts',     name: 'Depot',         ic: '📦', wall: '#cfd8bd', roof: '#4e7d5b' },
  { id: 'hall',        kind: 'bld',   tx: 23, ty: 22, w: 3, h: 3, tab: 'upgrades',      name: 'Town Hall',     ic: '🛒', wall: '#ecdfc6', roof: '#b0574f' },
  { id: 'bank',        kind: 'bld',   tx: 27, ty: 22, w: 2, h: 3, tab: 'bank',          name: 'Village Bank',  ic: '🏦', wall: '#e8e0cc', roof: '#8a7a5a' },
  { id: 'exchange',    kind: 'bld',   tx: 30, ty: 22, w: 2, h: 3, tab: 'exchange',      name: 'Exchange Floor',  ic: '📈', wall: '#d0d8e8', roof: '#2a4a6a' },
  // --- Retail district (new high street, north extension) ---
  { id: 'retail',      kind: 'bld',   tx: 8,  ty: 2,  w: 2, h: 2, tab: 'retail',        name: 'Retail Stall',    ic: '🛍️', wall: '#f8d0d8', roof: '#e84060' },
  { id: 'postoffice',  kind: 'bld',   tx: 15, ty: 2,  w: 2, h: 2, tab: 'postoffice',    name: 'Post Office',     ic: '📮', wall: '#e8e0d8', roof: '#b03020' },
  { id: 'estateagent', kind: 'bld',   tx: 22, ty: 2,  w: 2, h: 2, tab: 'estateagent',   name: 'Estate Agent',    ic: '🏘️', wall: '#d8e0e8', roof: '#2a4060' },
  { id: 'bike_shop',   kind: 'bld',   tx: 29, ty: 2,  w: 2, h: 2, tab: 'bike_shop',     name: 'Cycle Shop',      ic: '🚲', wall: '#c8d8c0', roof: '#3a6a3a' },
  { id: 'notice_board', kind: 'sign', tx: 35, ty: 3,  w: 1, h: 1, tab: 'notice_board', name: 'Notice Board',    ic: '📋' },
  // --- Retail district decorations ---
  { id: 'lamp_retail_1', kind: 'lamp', tx: 11, ty: 4, w: 1, h: 1 },
  { id: 'lamp_retail_2', kind: 'lamp', tx: 18, ty: 4, w: 1, h: 1 },
  { id: 'lamp_retail_3', kind: 'lamp', tx: 25, ty: 4, w: 1, h: 1 },
  { id: 'lamp_retail_4', kind: 'lamp', tx: 32, ty: 4, w: 1, h: 1 },
  { id: 'rplant_1', kind: 'plant', tx: 5,  ty: 4, w: 1, h: 1 },
  { id: 'rplant_2', kind: 'plant', tx: 12, ty: 4, w: 1, h: 1 },
  { id: 'rplant_3', kind: 'plant', tx: 19, ty: 4, w: 1, h: 1 },
  { id: 'rplant_4', kind: 'plant', tx: 26, ty: 4, w: 1, h: 1 },
  { id: 'rbench_1', kind: 'bench', tx: 30, ty: 4, w: 2, h: 1 },
  // --- Trade stalls ---
  { id: 'stall_marge', kind: 'stall', tx: 12, ty: 31, w: 2, h: 2, tab: 'trade', name: 'Marge',  lvl: 1,  awn: '#ff8a5c', hair: '#c9a24b', shirt: '#7cb46b' },
  { id: 'stall_bolt',  kind: 'stall', tx: 15, ty: 31, w: 2, h: 2, tab: 'trade', name: 'Bolt',   lvl: 10, awn: '#6fb7d9', hair: '#3a3a3a', shirt: '#c9723a' },
  { id: 'stall_perry', kind: 'stall', tx: 18, ty: 31, w: 2, h: 2, tab: 'trade', name: 'Perry',  lvl: 25, awn: '#e8c94e', hair: '#7a4a2a', shirt: '#4a6ea9' },
  { id: 'stall_finn',  kind: 'stall', tx: 21, ty: 31, w: 2, h: 2, tab: 'trade', name: 'Finn',   lvl: 1,  awn: '#c84a7a', hair: '#8a3030', shirt: '#7a5a9a' },
  // --- Other buildings ---
  { id: 'barn',        kind: 'bld',   tx: 24, ty: 31, w: 3, h: 3, tab: 'pets',     name: 'Companion Barn', ic: '🐾', wall: '#d9a86a', roof: '#9a5f3a' },
  { id: 'trophy',      kind: 'bld',   tx: 29, ty: 31, w: 2, h: 2, tab: 'ach',      name: 'Trophy Hall',    ic: '🏆', wall: '#e8dcb8', roof: '#c9a02e' },
  // --- North forest (rows 6-17, above the high street) ---
  { id: 'forager_hut', kind: 'bld',   tx: 35, ty: 9,  w: 2, h: 2, tab: 'foraging',   name: "Wren's Forager Hut", ic: '🌿', wall: '#7a6a4a', roof: '#4a5a2a' },
  { id: 'stall_wren',  kind: 'stall', tx: 50, ty: 8,  w: 2, h: 2, tab: 'trade',      name: 'Wren',       lvl: 1,  awn: '#3a7a3a', hair: '#3a2a1a', shirt: '#4a7a3a' },
  { id: 'lore_stone',   kind: 'sign',  tx: 20, ty: 13, w: 1, h: 1, tab: 'lore_stone', name: 'Old Stone',  ic: '🪨' },
  { id: 'village_fund', kind: 'sign',  tx: 43, ty: 2,  w: 1, h: 1, tab: 'village_fund', name: 'Village Fund', ic: '🌸' },
  { id: 'artisan_shed', kind: 'bld',   tx: 39, ty: 9,  w: 2, h: 2, tab: 'crafting',   name: "Artisan's Shed", ic: '🧺', wall: '#c0a870', roof: '#6a4a20' },
  // --- North forest trees (west of path, cols 1-46) ---
  { id: 'tree_nf_h1',  kind: 'tree',  tx: 10, ty: 7,  w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_h2',  kind: 'tree',  tx: 30, ty: 10, w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_h5',  kind: 'tree',  tx: 12, ty: 12, w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_h6',  kind: 'tree',  tx: 40, ty: 7,  w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_o1',  kind: 'tree',  tx: 18, ty: 9,  w: 1, h: 2, ore: 'oak',        lvl: 8  },
  { id: 'tree_nf_o2',  kind: 'tree',  tx: 32, ty: 7,  w: 1, h: 2, ore: 'oak',        lvl: 8  },
  { id: 'tree_nf_o3',  kind: 'tree',  tx: 42, ty: 15, w: 1, h: 2, ore: 'oak',        lvl: 8  },
  { id: 'tree_nf_p1',  kind: 'tree',  tx: 5,  ty: 11, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_p2',  kind: 'tree',  tx: 15, ty: 7,  w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_p3',  kind: 'tree',  tx: 25, ty: 16, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_p4',  kind: 'tree',  tx: 38, ty: 13, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_p5',  kind: 'tree',  tx: 8,  ty: 15, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_r1',  kind: 'tree',  tx: 3,  ty: 8,  w: 1, h: 2, ore: 'rare_leaf',  lvl: 30 },
  { id: 'tree_nf_r2',  kind: 'tree',  tx: 28, ty: 14, w: 1, h: 2, ore: 'rare_leaf',  lvl: 30 },
  { id: 'tree_nf_r3',  kind: 'tree',  tx: 43, ty: 11, w: 1, h: 2, ore: 'rare_leaf',  lvl: 30 },
  // --- North forest trees (east of path, cols 49-94) ---
  { id: 'tree_nf_h3',  kind: 'tree',  tx: 62, ty: 8,  w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_h4',  kind: 'tree',  tx: 78, ty: 12, w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_eh1', kind: 'tree',  tx: 70, ty: 9,  w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_eh2', kind: 'tree',  tx: 92, ty: 7,  w: 1, h: 2, ore: 'hardwood',   lvl: 20 },
  { id: 'tree_nf_eo1', kind: 'tree',  tx: 58, ty: 8,  w: 1, h: 2, ore: 'oak',        lvl: 8  },
  { id: 'tree_nf_eo2', kind: 'tree',  tx: 75, ty: 11, w: 1, h: 2, ore: 'oak',        lvl: 8  },
  { id: 'tree_nf_eo3', kind: 'tree',  tx: 87, ty: 16, w: 1, h: 2, ore: 'oak',        lvl: 8  },
  { id: 'tree_nf_ep1', kind: 'tree',  tx: 55, ty: 12, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_ep2', kind: 'tree',  tx: 65, ty: 7,  w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_ep3', kind: 'tree',  tx: 72, ty: 15, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_ep4', kind: 'tree',  tx: 83, ty: 9,  w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_ep5', kind: 'tree',  tx: 90, ty: 13, w: 1, h: 2, ore: 'pine',       lvl: 1  },
  { id: 'tree_nf_er1', kind: 'tree',  tx: 52, ty: 14, w: 1, h: 2, ore: 'rare_leaf',  lvl: 30 },
  { id: 'tree_nf_er2', kind: 'tree',  tx: 80, ty: 8,  w: 1, h: 2, ore: 'rare_leaf',  lvl: 30 },
  { id: 'tree_nf_er3', kind: 'tree',  tx: 93, ty: 12, w: 1, h: 2, ore: 'rare_leaf',  lvl: 30 },
  // --- Forest cabin (east) ---
  { id: 'sawmill',     kind: 'bld',   tx: 41, ty: 23, w: 3, h: 3, tab: 'woodcutting', name: 'Sawmill', ic: '🪓', wall: '#9a7050', roof: '#5a3a20' },
  // --- Pier & fishmonger (beach) ---
  { id: 'pier',         kind: 'bld',   tx: 22, ty: 36, w: 3, h: 2, tab: 'fishing', name: 'Pier',    ic: '🎣', wall: '#8c6947', roof: '#6a4a28' },
  { id: 'stall_marina', kind: 'stall', tx: 17, ty: 36, w: 2, h: 2, tab: 'trade',   name: 'Marina',  lvl: 1,  awn: '#4da8cc', hair: '#8a5a20', shirt: '#4a7a9a' },
  // --- Streetlamps (town) ---
  { id: 'lamp_1', kind: 'lamp', tx: 10, ty: 26, w: 1, h: 1 },
  { id: 'lamp_2', kind: 'lamp', tx: 32, ty: 26, w: 1, h: 1 },
  { id: 'lamp_3', kind: 'lamp', tx: 10, ty: 31, w: 1, h: 1 },
  { id: 'lamp_4', kind: 'lamp', tx: 32, ty: 31, w: 1, h: 1 },
  // --- Streetlamps (residential district) ---
  { id: 'lamp_r1', kind: 'lamp', tx: 49, ty: 25, w: 1, h: 1 },
  { id: 'lamp_r2', kind: 'lamp', tx: 49, ty: 30, w: 1, h: 1 },
  { id: 'lamp_r3', kind: 'lamp', tx: 74, ty: 25, w: 1, h: 1 },
  { id: 'lamp_r4', kind: 'lamp', tx: 74, ty: 30, w: 1, h: 1 },
  // --- Forest trees ---
  { id: 'tree_pine1',  kind: 'tree', tx: 41, ty: 22, w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_pine2',  kind: 'tree', tx: 41, ty: 28, w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_pine3',  kind: 'tree', tx: 44, ty: 23, w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_pine4',  kind: 'tree', tx: 45, ty: 25, w: 1, h: 2, ore: 'pine',     lvl: 1  },
  { id: 'tree_oak1',   kind: 'tree', tx: 44, ty: 30, w: 1, h: 2, ore: 'oak',      lvl: 8  },
  { id: 'tree_oak2',   kind: 'tree', tx: 45, ty: 28, w: 1, h: 2, ore: 'oak',      lvl: 8  },
  { id: 'tree_oak3',   kind: 'tree', tx: 41, ty: 32, w: 1, h: 2, ore: 'oak',      lvl: 8  },
  { id: 'tree_hard1',  kind: 'tree', tx: 44, ty: 34, w: 1, h: 2, ore: 'hardwood', lvl: 20 },
  { id: 'tree_hard2',  kind: 'tree', tx: 45, ty: 33, w: 1, h: 2, ore: 'hardwood', lvl: 20 },
  // --- Town decorations ---
  { id: 'fountain',  kind: 'fountain', tx: 22, ty: 26, w: 2, h: 2, name: 'Fountain' },
  { id: 'bench_1',   kind: 'bench',    tx: 19, ty: 27, w: 2, h: 1, name: 'Bench' },
  { id: 'bench_2',   kind: 'bench',    tx: 26, ty: 27, w: 2, h: 1, name: 'Bench' },
  { id: 'pot_1',     kind: 'plant',    tx: 12, ty: 26, w: 1, h: 1 },
  { id: 'pot_2',     kind: 'plant',    tx: 27, ty: 32, w: 1, h: 1 },
  { id: 'pot_3',     kind: 'plant',    tx: 11, ty: 29, w: 1, h: 1 },
  { id: 'pot_4',     kind: 'plant',    tx: 30, ty: 29, w: 1, h: 1 },
  { id: 'pot_5',     kind: 'plant',    tx: 31, ty: 26, w: 1, h: 1 },
  { id: 'flowerbed', kind: 'plant',    tx: 21, ty: 29, w: 2, h: 1 },
  // --- East forest trees (cols 88-94, woodcutting-capable) ---
  { id: 'tree_e_pine1', kind: 'tree', tx: 88, ty: 23, w: 1, h: 2, ore: 'pine',     lvl: 1 },
  { id: 'tree_e_pine2', kind: 'tree', tx: 90, ty: 27, w: 1, h: 2, ore: 'pine',     lvl: 1 },
  { id: 'tree_e_pine3', kind: 'tree', tx: 93, ty: 22, w: 1, h: 2, ore: 'pine',     lvl: 1 },
  { id: 'tree_e_oak1',  kind: 'tree', tx: 89, ty: 31, w: 1, h: 2, ore: 'oak',      lvl: 8 },
  { id: 'tree_e_oak2',  kind: 'tree', tx: 92, ty: 34, w: 1, h: 2, ore: 'oak',      lvl: 8 },
  { id: 'tree_e_hard1', kind: 'tree', tx: 91, ty: 25, w: 1, h: 2, ore: 'hardwood', lvl: 20 },
  // --- Park (residential district, around tx:77-83, ty:27-29) ---
  { id: 'park_bench_1', kind: 'bench', tx: 77, ty: 28, w: 2, h: 1 },
  { id: 'park_bench_2', kind: 'bench', tx: 82, ty: 28, w: 2, h: 1 },
  { id: 'park_flower1', kind: 'plant', tx: 78, ty: 27, w: 2, h: 1 },
  { id: 'park_flower2', kind: 'plant', tx: 80, ty: 29, w: 2, h: 1 },
  // --- Residential decorations (planters along home rows) ---
  { id: 'home_pot_1', kind: 'plant', tx: 54, ty: 25, w: 1, h: 1 },
  { id: 'home_pot_2', kind: 'plant', tx: 59, ty: 25, w: 1, h: 1 },
  { id: 'home_pot_3', kind: 'plant', tx: 64, ty: 25, w: 1, h: 1 },
  { id: 'home_pot_4', kind: 'plant', tx: 70, ty: 25, w: 1, h: 1 },
  { id: 'home_pot_5', kind: 'plant', tx: 54, ty: 30, w: 1, h: 1 },
  { id: 'home_pot_6', kind: 'plant', tx: 59, ty: 30, w: 1, h: 1 },
  { id: 'home_pot_7', kind: 'plant', tx: 64, ty: 30, w: 1, h: 1 },
  { id: 'home_pot_8', kind: 'plant', tx: 69, ty: 30, w: 1, h: 1 },
  // --- Residential homes (east district, 3 rows × 5 homes) ---
  // Row A: north of east path (ty=23, approach from south at path row 25)
  { id: 'home_01', kind: 'bld', tx: 51, ty: 23, w: 2, h: 2, tab: 'home', name: "Agnes's Cottage",  ic: '🏠', wall: '#d9c8b0', roof: '#8a6a4a' },
  { id: 'home_02', kind: 'bld', tx: 56, ty: 23, w: 2, h: 2, tab: 'home', name: "Bertie's Cottage",  ic: '🏠', wall: '#c8b8a0', roof: '#6a5a4a' },
  { id: 'home_03', kind: 'bld', tx: 61, ty: 23, w: 2, h: 2, tab: 'home', name: "Clara's Cottage",   ic: '🏠', wall: '#e8d8a0', roof: '#8a7a3a' },
  { id: 'home_04', kind: 'bld', tx: 66, ty: 23, w: 2, h: 2, tab: 'home', name: "Derek's Cottage",   ic: '🏠', wall: '#b8c8b0', roof: '#4a6a4a' },
  { id: 'home_05', kind: 'bld', tx: 71, ty: 23, w: 2, h: 2, tab: 'home', name: "Edna's Cottage",    ic: '🏠', wall: '#d8c0d0', roof: '#7a5a7a' },
  { id: 'cafe',    kind: 'bld', tx: 68, ty: 23, w: 2, h: 2, tab: 'cafe', name: 'Village Café',       ic: '☕', wall: '#f0e8d0', roof: '#c06030' },
  // Row B: between east paths (ty=26, approach at row 28 grass)
  { id: 'home_06', kind: 'bld', tx: 51, ty: 26, w: 2, h: 2, tab: 'home', name: "Frank's Cottage",   ic: '🏠', wall: '#c8b0a0', roof: '#7a5040' },
  { id: 'home_07', kind: 'bld', tx: 56, ty: 26, w: 2, h: 2, tab: 'home', name: "Gracie's Cottage",  ic: '🏠', wall: '#b8d0b0', roof: '#4a7a4a' },
  { id: 'home_08', kind: 'bld', tx: 61, ty: 26, w: 2, h: 2, tab: 'home', name: "Hector's Cottage",  ic: '🏠', wall: '#b0b8d0', roof: '#3a4a7a' },
  { id: 'home_09', kind: 'bld', tx: 66, ty: 26, w: 2, h: 2, tab: 'home', name: "Ida's Cottage",     ic: '🏠', wall: '#b0c8d8', roof: '#3a5a7a' },
  { id: 'home_10', kind: 'bld',    tx: 71, ty: 26, w: 2, h: 2, tab: 'home',   name: "Jack's Cottage",  ic: '🏠', wall: '#d0b0b0', roof: '#6a3a3a' },
  { id: 'player_home', kind: 'bld', tx: 74, ty: 26, w: 2, h: 2, tab: 'myhome', name: 'Your Cottage',    ic: '🏡', wall: '#d4c8a8', roof: '#7a5a40' },
  // Row C: south section (ty=31, approach at row 33 grass)
  { id: 'home_11', kind: 'bld', tx: 51, ty: 31, w: 2, h: 2, tab: 'home', name: "Kitty's Cottage",  ic: '🏠', wall: '#b8c0d0', roof: '#4a5a7a' },
  { id: 'home_12', kind: 'bld', tx: 56, ty: 31, w: 2, h: 2, tab: 'home', name: "Lenny's Cottage",  ic: '🏠', wall: '#d0d0b8', roof: '#5a5a3a' },
  { id: 'home_13', kind: 'bld', tx: 61, ty: 31, w: 2, h: 2, tab: 'home', name: "Mabel's Cottage",  ic: '🏠', wall: '#e0c8d0', roof: '#7a4a5a' },
  { id: 'home_14', kind: 'bld', tx: 66, ty: 31, w: 2, h: 2, tab: 'home', name: "Ned's Cottage",    ic: '🏠', wall: '#b8c8b0', roof: '#3a5a3a' },
  { id: 'home_15', kind: 'bld', tx: 71, ty: 31, w: 2, h: 2, tab: 'home', name: "Olive's Cottage",  ic: '🏠', wall: '#b0ccd8', roof: '#3a607a' },
  // --- Harbour District (south-east, ty=31-35, unlocks at total level 100) ---
  { id: 'home_16', kind: 'bld', tx: 77, ty: 31, w: 2, h: 2, tab: 'home', name: "Reg's Cottage",   ic: '🏠', wall: '#c8d8e0', roof: '#2a4a6a' },
  { id: 'home_17', kind: 'bld', tx: 82, ty: 31, w: 2, h: 2, tab: 'home', name: "Pearl's Cottage", ic: '🏠', wall: '#d0e0d8', roof: '#2a5a4a' },
  { id: 'harbour_office',  kind: 'bld', tx: 53, ty: 33, w: 2, h: 2, tab: 'harbour_office',  name: "Harbourmaster's",  ic: '⚓', wall: '#d8c8a8', roof: '#2a4a6a' },
  { id: 'boat_hire',       kind: 'bld', tx: 60, ty: 33, w: 2, h: 2, tab: 'boat_hire',       name: 'Boat Hire',        ic: '⛵', wall: '#c8b89a', roof: '#3a5a3a' },
  { id: 'fishmonger_wh',   kind: 'bld', tx: 67, ty: 33, w: 2, h: 2, tab: 'fishmonger_wh',   name: 'Fish Warehouse',   ic: '🐟', wall: '#8ab0a8', roof: '#1a3a3a' },
  { id: 'lamp_harbour_1',  kind: 'lamp', tx: 55, ty: 36, w: 1, h: 1 },
  { id: 'lamp_harbour_2',  kind: 'lamp', tx: 62, ty: 36, w: 1, h: 1 },
  { id: 'lamp_harbour_3',  kind: 'lamp', tx: 69, ty: 36, w: 1, h: 1 },
  // --- Village School (north of park, accessible from east path row 25) ---
  { id: 'school',     kind: 'bld', tx: 76, ty: 22, w: 5, h: 3, tab: 'school',     name: 'Village School', ic: '🏫', wall: '#e8e4c0', roof: '#5a8a4a' },
  { id: 'university', kind: 'bld', tx: 82, ty: 22, w: 3, h: 3, tab: 'university', name: 'University',     ic: '🎓', wall: '#ddd8c0', roof: '#4a3a7a' },
  // --- Park interactive equipment (interaction zones; drawn by drawExtras) ---
  { id: 'park_slide', kind: 'slide', tx: 82, ty: 26, w: 2, h: 2, name: 'Slide' },
  { id: 'park_swing', kind: 'swing', tx: 84, ty: 27, w: 2, h: 2, name: 'Swings' },
];
