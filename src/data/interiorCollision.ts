// @ts-nocheck
// HX4 — collision rects for the core public interiors (320×200 canvas).
// Matched to the furniture drawn in drawInterior() so counters/bars/tables are
// solid instead of walk-through. Merged into INTERIOR_COLS in main.ts and guarded
// by tests/publicInteriors.test.ts. Nothing sits in the bottom-centre exit lane.

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
};
