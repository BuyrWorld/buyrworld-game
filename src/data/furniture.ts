// Milestone 2 — visual furniture placement. Central furniture metadata + a pure,
// testable grid/collision model for the cottage. The decoration-mode canvas UI
// (ghost preview, cursor, rotate/customise) lives in main.ts and uses these.

// ---- Cottage placement grid ----------------------------------------------
// A grid over the cottage floor. Row 0 is the back wall (wall-mounted items go
// here). One cell ≈ one character width, so footprints read proportionally.
export const GRID = { cols: 8, rows: 4, cellW: 37, cellH: 33, originX: 10, originY: 52 };

// ---- Furniture metadata (single source of truth) -------------------------
export interface FurnitureDef {
  id: string;
  n: string;
  ic: string;
  price: number;
  craftIn?: Record<string, number>;
  fw: number;            // footprint width in grid cells
  fd: number;            // footprint depth in grid cells
  scale: number;         // display scale of the sprite relative to its footprint (proportional to the character)
  rotates: boolean;      // supports 90° rotation
  wall: boolean;         // must sit against the back wall (row 0)
  colors: string[];      // selectable colour/style variants (first = default)
  seatH?: number;        // notes for proportional reference (character-relative), unused by logic
  interact?: boolean;    // has an interaction point
}
// Footprints are proportional to the character (1 cell ≈ one character width):
// chair 1×1 (seat height), table 2×1 (waist height), bed 2×2 (longer than the
// character), sofa 3×1 (2+ character widths), rug 3×2 flat on the floor.
export const FURNITURE: Record<string, FurnitureDef> = {
  furn_chair:  { id:'furn_chair',  n:'Chair',   ic:'🪑', price:20, craftIn:{ wood:2, plank:1 }, fw:1, fd:1, scale:0.82, rotates:true,  wall:false, colors:['#7a5a30','#8a3030','#3a5a8a','#3a6a3a'], seatH:0.5, interact:true },
  furn_table:  { id:'furn_table',  n:'Table',   ic:'🪵', price:40, craftIn:{ wood:4, plank:2 }, fw:2, fd:1, scale:0.9,  rotates:true,  wall:false, colors:['#8a6040','#5a3a20','#b08050'] },
  furn_bed:    { id:'furn_bed',    n:'Bed',     ic:'🛏️', price:80, fw:2, fd:2, scale:0.95, rotates:true,  wall:false, colors:['#7a5030','#8a6a80','#4a6a8a'] },
  furn_sofa:   { id:'furn_sofa',   n:'Sofa',    ic:'🛋️', price:60, fw:3, fd:1, scale:0.9,  rotates:true,  wall:false, colors:['#8a6a80','#5a7a5a','#7a5a3a','#4a5a7a'] },
  furn_tv:     { id:'furn_tv',     n:'TV Set',  ic:'📺', price:90, fw:2, fd:1, scale:0.85, rotates:false, wall:true,  colors:['#222222'], interact:true },
  furn_rug_sm: { id:'furn_rug_sm', n:'Rug',     ic:'🟫', price:30, craftIn:{ wood:3, berries:2 }, fw:3, fd:2, scale:1.0,  rotates:true,  wall:false, colors:['#c06830','#3a6a8a','#8a3a5a','#5a7a3a'] },
  furn_sink:   { id:'furn_sink',   n:'Sink',    ic:'🚰', price:50, fw:1, fd:1, scale:0.85, rotates:false, wall:true,  colors:['#d0d8e0'], interact:true },
  furn_fridge: { id:'furn_fridge', n:'Fridge',  ic:'🧊', price:70, fw:1, fd:1, scale:0.95, rotates:false, wall:true,  colors:['#e0e8f0','#c0d0e0','#3a5a4a'] },
  furn_shower: { id:'furn_shower', n:'Shower',  ic:'🚿', price:55, fw:1, fd:1, scale:0.9,  rotates:false, wall:true,  colors:['#c8d8e8'], interact:true },
  furn_toilet: { id:'furn_toilet', n:'Toilet',  ic:'🚽', price:45, fw:1, fd:1, scale:0.85, rotates:false, wall:false, colors:['#e8e8e0'], interact:true },
  // ---- Finn's Furniture & Homeware (also trade commodities) — now placeable décor.
  // Ids match their items.json entries so the warehouse stock and placement reconcile.
  lamp:      { id:'lamp',      n:'Table Lamp', ic:'💡', price:28, fw:1, fd:1, scale:0.55, rotates:false, wall:false, colors:['#d8a850','#e8e8e0','#3a3a3a'], interact:true },
  bookcase:  { id:'bookcase',  n:'Bookcase',   ic:'📚', price:55, fw:1, fd:1, scale:0.95, rotates:false, wall:true,  colors:['#8a6040','#5a3a20','#e0d8c8'] },
  vase:      { id:'vase',      n:'Vase',       ic:'🏺', price:22, fw:1, fd:1, scale:0.5,  rotates:false, wall:false, colors:['#b06840','#3a6a8a','#8a3a5a'] },
  painting:  { id:'painting',  n:'Painting',   ic:'🖼️', price:40, fw:1, fd:1, scale:0.8,  rotates:false, wall:true,  colors:['#c8a850','#3a3a3a','#8a6040'] },
  fancy_rug: { id:'fancy_rug', n:'Fancy Rug',  ic:'🟪', price:48, fw:3, fd:2, scale:1.0,  rotates:true,  wall:false, colors:['#7a3a6a','#3a5a7a','#7a5a3a','#3a6a4a'] },
};
export function furnitureDef(id: string): FurnitureDef | null { return FURNITURE[id] || null; }
export function defaultColor(id: string): string { return FURNITURE[id]?.colors[0] || '#8a6a4a'; }

// Rotated footprint size (0/180 = w×d, 90/270 = d×w).
export function rotatedSize(fw: number, fd: number, rot: number): { w: number; d: number } {
  const r = ((rot % 360) + 360) % 360;
  return (r === 90 || r === 270) ? { w: fd, d: fw } : { w: fw, d: fd };
}
// The grid cells an item occupies at (gx,gy) with a rotation.
export function footprintCells(id: string, gx: number, gy: number, rot: number): Array<{ x: number; y: number }> {
  const def = FURNITURE[id]; if (!def) return [];
  const { w, d } = rotatedSize(def.fw, def.fd, rot);
  const cells: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) cells.push({ x: gx + dx, y: gy + dy });
  return cells;
}

// ---- Placement validation -------------------------------------------------
export interface PlacedItem { id: string; gx: number; gy: number; rot: number; color?: string; }
export interface PlaceOpts {
  placed: PlacedItem[];        // already-placed items (exclude the one being moved)
  exitCells?: Array<{ x: number; y: number }>;
  spawnCells?: Array<{ x: number; y: number }>;
  reserved?: Array<{ x: number; y: number }>;   // required interactive objects that must stay clear
}
export const PLACE_REASONS: Record<string, string> = {
  ok: 'Looks good here',
  outside: 'Outside the room',
  blocked: 'Blocked by other furniture',
  exit: 'The exit must stay clear',
  wall: 'This must go against the wall',
  spawn: "Can't cover where you stand",
  reserved: 'Something important is here',
};
export interface PlaceResult { ok: boolean; reason: string; text: string; }

export function canPlace(id: string, gx: number, gy: number, rot: number, opts: PlaceOpts): PlaceResult {
  const def = FURNITURE[id];
  const res = (reason: string): PlaceResult => ({ ok: reason === 'ok', reason, text: PLACE_REASONS[reason] });
  if (!def) return res('blocked');
  const cells = footprintCells(id, gx, gy, rot);
  // inside the room?
  for (const c of cells) if (c.x < 0 || c.y < 0 || c.x >= GRID.cols || c.y >= GRID.rows) return res('outside');
  // wall requirement (must occupy the back row)
  if (def.wall && !cells.some(c => c.y === 0)) return res('wall');
  const has = (list: Array<{ x: number; y: number }> | undefined, c: { x: number; y: number }) => (list || []).some(e => e.x === c.x && e.y === c.y);
  for (const c of cells){
    if (has(opts.exitCells, c)) return res('exit');
    if (has(opts.spawnCells, c)) return res('spawn');
    if (has(opts.reserved, c)) return res('reserved');
  }
  // overlap other furniture
  const occupied = new Set<string>();
  for (const p of opts.placed) for (const c of footprintCells(p.id, p.gx, p.gy, p.rot)) occupied.add(c.x + ',' + c.y);
  for (const c of cells) if (occupied.has(c.x + ',' + c.y)) return res('blocked');
  return res('ok');
}

// ---- Migration of the old 9-slot text placements --------------------------
// The old FURN_SPOTS were a 3×3 label grid; map them into the new cell grid.
export function slotToGrid(slot: number): { gx: number; gy: number } {
  const col = slot % 3, row = Math.floor(slot / 3);           // 0..2 each
  return { gx: [1, 3, 6][col] ?? 1, gy: [0, 2, 3][row] ?? 0 };
}
// Convert an old placement to a grid placement, or null if it can't fit safely
// (the caller then returns the item to inventory — never deletes it).
export function migratePlacement(old: { id: string; slot: number }, placedSoFar: PlacedItem[], opts: PlaceOpts): PlacedItem | null {
  const { gx, gy } = slotToGrid(old.slot);
  const merged = { ...opts, placed: placedSoFar };
  const tryAt = (x: number, y: number): PlacedItem | null =>
    canPlace(old.id, x, y, 0, merged).ok ? { id: old.id, gx: x, gy: y, rot: 0, color: defaultColor(old.id) } : null;
  let p = tryAt(gx, gy);
  if (p) return p;
  // nearest-fit fallback scan
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++){ p = tryAt(x, y); if (p) return p; }
  return null;
}
