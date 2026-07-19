// @ts-nocheck
// HX4 — collision rects for the core public interiors.
// Matched to the furniture drawn in drawInterior() so counters/bars/tables are
// solid instead of walk-through. Merged into INTERIOR_COLS in main.ts and guarded
// by tests/publicInteriors.test.ts. Nothing sits in the bottom-centre exit lane.
//
// Most rooms use the default 320×200 canvas; a few get a roomier canvas (see
// ROOM_DIMS) and their collision is authored in that larger coordinate space. main.ts
// reads ROOM_DIMS as its INT_SIZES so art, collision, clicks and stations all agree.

export const ROOM_DIMS: Record<string, { w: number; h: number }> = {
  mining:    { w: 448, h: 288 },
  nightclub: { w: 480, h: 270 },   // wide 16:9 club — larger, multi-zone venue
};

export const PUBLIC_COLS: Record<string, {x:number;y:number;w:number;h:number}[]> = {
  pub: [
    { x:8,   y:46,  w:304, h:24 },  // bar counter (back wall)
    { x:6,   y:60,  w:34,  h:62 },  // fireplace (left wall)
    { x:158, y:88,  w:118, h:70 },  // pool table (centre-right)
    { x:16,  y:130, w:34,  h:20 },  // round table (left)
    { x:106, y:130, w:34,  h:20 },  // round table (left-centre)
  ],
  cafe: [
    { x:18,  y:48,  w:284, h:24 },  // back counter
    { x:28,  y:116, w:34,  h:20 },  // café table 1
    { x:121, y:120, w:34,  h:20 },  // café table 2
    { x:28,  y:156, w:34,  h:20 },  // café table 3
  ],
  bank: [
    { x:18,  y:52,  w:284, h:22 },  // teller counter
    { x:62,  y:9,   w:16,  h:170 }, // classical column (left)
    { x:229, y:9,   w:16,  h:170 }, // classical column (right)
    { x:268, y:10,  w:40,  h:42 },  // vault door (top-right)
  ],
  furniture_shop: [
    { x:10,  y:52,  w:300, h:14 },  // back display shelf
    { x:10,  y:136, w:62,  h:34 },  // sofa display (left)
    { x:258, y:134, w:52,  h:40 },  // fridge/sink display (right)
  ],
  retail: [
    { x:12,  y:52,  w:296, h:22 },  // display counter
  ],
  postoffice: [
    { x:10,  y:52,  w:300, h:22 },  // service counter
    { x:12,  y:128, w:22,  h:56 },  // mailboxes (left wall)
  ],
  estateagent: [
    { x:124, y:52,  w:72,  h:20 },  // agent desk
  ],
  // Club Featherstone — authored in the 480×270 canvas (ROOM_DIMS.nightclub). Zones:
  // DJ stage (back centre), bar (left), VIP + booths (right), dance floor (centre,
  // open/walkable), entrance framing (bottom). The bottom-centre exit lane and the
  // approaches to the bar/DJ/booths are kept clear.
  nightclub: [
    { x:168, y:40,  w:144, h:70 },  // DJ stage platform (approach from the front)
    { x:140, y:44,  w:24,  h:66 },  // speaker stack (stage-left)
    { x:316, y:44,  w:24,  h:66 },  // speaker stack (stage-right)
    { x:16,  y:120, w:132, h:26 },  // bar back-shelf (left)
    { x:16,  y:150, w:132, h:22 },  // bar counter (left)
    { x:360, y:70,  w:112, h:12 },  // VIP railing (top-right, gated area behind)
    { x:356, y:120, w:112, h:34 },  // lounge booth (right, upper)
    { x:356, y:166, w:112, h:34 },  // lounge booth (right, middle)
    { x:356, y:212, w:112, h:30 },  // lounge booth (right, lower)
    { x:18,  y:224, w:76,  h:40 },  // BW crates (bottom-left entrance framing)
    { x:392, y:226, w:70,  h:38 },  // planter + conveyor (bottom-right framing)
  ],
  robotics_lab: [
    { x:12,  y:50,  w:80,  h:82 },  // server racks (back-left)
    { x:150, y:92,  w:20,  h:22 },  // robot arm base (centre)
  ],
  data_centre: [
    { x:12,  y:52,  w:82,  h:78 },  // server cabinet rows (back-left)
    { x:242, y:52,  w:64,  h:44 },  // grid status wall (right)
  ],
};
