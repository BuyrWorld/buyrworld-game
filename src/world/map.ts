export const TILE   = 24;
export const VCOLS  = 36;
export const VROWS  = 22;
export const VIEW_W = 576;
export const VIEW_H = 360;

export const VMAP: string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TCDDDDDDCGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TCDDDDDDCGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TCDDDDDDCPPPPPPPPPPPPPPPPPPPPPPPPPGT',
  'TCDDDDDDDPGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TCDDDDDDCPGGGGWWWWGGGGGGGGGGGGGGGGGT',
  'TCCCCCCCCPGGGGWWWWGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGPGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGPPPPPPPPPPPPPPPPPPPPPPPPPGT',
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGT',
  'TSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSST',
  'TSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSST',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
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
  { id: 'rock_iron',   kind: 'rock',  tx: 3,  ty: 3,  ore: 'iron_ore',   lvl: 1,  vein: '#aab2bd' },
  { id: 'rock_copper', kind: 'rock',  tx: 5,  ty: 3,  ore: 'copper_ore', lvl: 5,  vein: '#c97b45' },
  { id: 'rock_coal',   kind: 'rock',  tx: 3,  ty: 5,  ore: 'coal',       lvl: 10, vein: '#2f2f38' },
  { id: 'rock_baux',   kind: 'rock',  tx: 5,  ty: 5,  ore: 'bauxite',    lvl: 20, vein: '#e0863a' },
  { id: 'rock_rare',   kind: 'rock',  tx: 2,  ty: 6,  ore: 'rare_earth', lvl: 40, vein: '#7ee0ff', sparkle: true },
  { id: 'furnace',     kind: 'bld',   tx: 11, ty: 2,  w: 3, h: 3, tab: 'steelworks',    name: 'Furnace',       ic: '🔥', wall: '#c9b294', roof: '#8a5a3c', chimney: true },
  { id: 'workshop',    kind: 'bld',   tx: 15, ty: 2,  w: 3, h: 3, tab: 'manufacturing', name: 'Workshop',      ic: '⚙️', wall: '#dbc99f', roof: '#5f7fbe' },
  { id: 'depot',       kind: 'bld',   tx: 19, ty: 2,  w: 3, h: 3, tab: 'contracts',     name: 'Depot',         ic: '📦', wall: '#cfd8bd', roof: '#4e7d5b' },
  { id: 'hall',        kind: 'bld',   tx: 23, ty: 2,  w: 3, h: 3, tab: 'upgrades',      name: 'Town Hall',     ic: '🛒', wall: '#ecdfc6', roof: '#b0574f' },
  { id: 'stall_marge', kind: 'stall', tx: 12, ty: 11, w: 2, h: 2, tab: 'trade', name: 'Marge',  lvl: 1,  awn: '#ff8a5c', hair: '#c9a24b', shirt: '#7cb46b' },
  { id: 'stall_bolt',  kind: 'stall', tx: 15, ty: 11, w: 2, h: 2, tab: 'trade', name: 'Bolt',   lvl: 10, awn: '#6fb7d9', hair: '#3a3a3a', shirt: '#c9723a' },
  { id: 'stall_perry', kind: 'stall', tx: 18, ty: 11, w: 2, h: 2, tab: 'trade', name: 'Perry',  lvl: 25, awn: '#e8c94e', hair: '#7a4a2a', shirt: '#4a6ea9' },
  { id: 'barn',        kind: 'bld',   tx: 24, ty: 11, w: 3, h: 3, tab: 'pets',     name: 'Companion Barn', ic: '🐾', wall: '#d9a86a', roof: '#9a5f3a' },
  { id: 'trophy',      kind: 'bld',   tx: 29, ty: 11, w: 2, h: 2, tab: 'ach',      name: 'Trophy Hall',    ic: '🏆', wall: '#e8dcb8', roof: '#c9a02e' },
  { id: 'sign',        kind: 'sign',  tx: 10, ty: 11, w: 1, h: 1, tab: 'settings', name: 'Save Post',      ic: '💾' },
];
