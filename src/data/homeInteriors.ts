// @ts-nocheck
// HX3 — Normal Home Layout engine.
// Each villager home is described compactly (template + palette + story props),
// and buildLayout() turns that into a believable floorplan: zone floor patches,
// furniture placements (drawn by _homeProp in main.ts), and collision solids —
// all from one source so movement matches what's drawn. See
// HOUSE_INTERIOR_LAYOUT_GUIDE.md for the zone grammar.

export interface HomePalette { wallTop:string; wall:string; floorA:string; floorB:string; trim:string; }
export interface HomeTheme {
  arch:string; template:string; pal:HomePalette; rug:string;
  wall?:string; nook:string[]; family?:boolean; clutter:'low'|'medium'|'high';
}

const P = {
  adminWarm: { wallTop:"#8a6a4a", wall:"#c9b78a", floorA:"#d8c9a8", floorB:"#cebd98", trim:"#5a4028" },
  adminCool: { wallTop:"#3a4a6a", wall:"#8a94a8", floorA:"#c4ccd8", floorB:"#b8c0cc", trim:"#33405a" },
  forge:     { wallTop:"#3a2a1a", wall:"#6a5038", floorA:"#9a7850", floorB:"#8c6c46", trim:"#2a1c10" },
  bakerWarm: { wallTop:"#a07038", wall:"#e0c078", floorA:"#e8d29a", floorB:"#dcc78e", trim:"#6a4a20" },
  bakerRose: { wallTop:"#a05868", wall:"#e0aec0", floorA:"#e6cdd4", floorB:"#dcc0c8", trim:"#6a3a48" },
  logistics: { wallTop:"#2a3a5a", wall:"#7a86a0", floorA:"#c0c4b8", floorB:"#b4b8ac", trim:"#26324a" },
  collector: { wallTop:"#4a3a2a", wall:"#8a7a60", floorA:"#b0a488", floorB:"#a89c80", trim:"#3a2c1c" },
  sawyer:    { wallTop:"#5a3f22", wall:"#9a7442", floorA:"#c0a06a", floorB:"#b49460", trim:"#3f2a14" },
  farmer:    { wallTop:"#4a6a2a", wall:"#a8c078", floorA:"#cdd6a0", floorB:"#c2cc94", trim:"#3a4a1c" },
  seaside:   { wallTop:"#2a4a6a", wall:"#7aa0bc", floorA:"#bcd0dc", floorB:"#b0c6d4", trim:"#264056" },
  harbour:   { wallTop:"#22384f", wall:"#5f7d92", floorA:"#a8bcc8", floorB:"#9cb2c0", trim:"#1c2c3c" },
  tinkerer:  { wallTop:"#3a3a42", wall:"#7a7a84", floorA:"#b0b0b8", floorB:"#a6a6b0", trim:"#2c2c34" },
} as const;

// d = double bed (couple), k = children's beds — shared by the bed renderer & collision.
export const BED_CONFIG: Record<string,{d:number,k:number}> = {
  home_01:{d:1,k:0}, home_02:{d:1,k:0}, home_03:{d:1,k:2}, home_04:{d:1,k:0},
  home_05:{d:0,k:0}, home_06:{d:1,k:1}, home_07:{d:1,k:0}, home_08:{d:0,k:0},
  home_09:{d:1,k:0}, home_10:{d:1,k:0}, home_11:{d:0,k:0}, home_12:{d:1,k:2},
  home_13:{d:1,k:1}, home_14:{d:1,k:1}, home_15:{d:1,k:0}, home_16:{d:0,k:0},
  home_17:{d:0,k:0},
};

// Nook props that stand tall against the wall (draw full-height, block movement).
const TALL_NOOK = new Set(['wardrobe','filing_cabinet','display_case','egg_dresser','bookshelf_tall']);

export const HOME_INTERIORS: Record<string, HomeTheme> = {
  home_01:{ arch:"neat older resident", template:"cosy",   pal:P.adminWarm, rug:"#b8607a", wall:"tea_shelf",   nook:["bookshelf_tall","stacked_files"], clutter:"low" },
  home_02:{ arch:"practical worker",    template:"worker", pal:P.forge,     rug:"#8a5a3a", wall:"tool_hooks",  nook:["wardrobe","boots"], clutter:"medium" },
  home_03:{ arch:"family home",         template:"family", pal:P.bakerWarm, rug:"#d09850", wall:"preserve_shelf", nook:["crate_stack"], family:true, clutter:"medium" },
  home_04:{ arch:"practical / family",  template:"trader", pal:P.logistics, rug:"#4a6a8a", wall:"route_board", nook:["crate_stack","tool_chest"], clutter:"medium" },
  home_05:{ arch:"eccentric collector", template:"cosy",   pal:P.collector, rug:"#8a6a4a", wall:"wall_photos", nook:["display_case","stacked_files"], clutter:"high" },
  home_06:{ arch:"messy sawyer",        template:"worker", pal:P.sawyer,    rug:"#a06838", wall:"axe_wall",    nook:["workbench","timber_stack"], family:true, clutter:"high" },
  home_07:{ arch:"farmer / rural",      template:"family", pal:P.farmer,    rug:"#8aa858", wall:"herb_bunches", nook:["egg_dresser","feed_sacks"], family:true, clutter:"medium" },
  home_08:{ arch:"neat professional",   template:"trader", pal:P.adminCool, rug:"#4a6a9a", wall:"framed_certs", nook:["filing_cabinet"], clutter:"low" },
  home_09:{ arch:"fisher / seaside",    template:"fisher", pal:P.seaside,   rug:"#3a7a9a", wall:"hanging_net", nook:["crate_stack","tackle_box","bucket"], clutter:"medium" },
  home_10:{ arch:"practical worker",    template:"worker", pal:P.forge,     rug:"#9a5a30", wall:"tool_hooks",  nook:["wardrobe","ember_apron"], clutter:"medium" },
  home_11:{ arch:"messy tinkerer",      template:"worker", pal:P.tinkerer,  rug:"#6a7a8a", wall:"tool_hooks",  nook:["workbench","gears_project","tool_chest"], clutter:"high" },
  home_12:{ arch:"big family home",     template:"family", pal:P.logistics, rug:"#6a7a5a", wall:"route_board", nook:["crate_stack","toy_lorry"], family:true, clutter:"high" },
  home_13:{ arch:"family + baker",      template:"family", pal:P.bakerRose, rug:"#c86a86", wall:"rosettes",   nook:["crate_stack"], family:true, clutter:"medium" },
  home_14:{ arch:"tidy sawyer",         template:"worker", pal:P.sawyer,    rug:"#96703c", wall:"axe_wall",    nook:["bookshelf_tall","timber_stack"], family:true, clutter:"low" },
  home_15:{ arch:"seaside family",      template:"fisher", pal:P.seaside,   rug:"#3a8a8a", wall:"hanging_net", nook:["crate_stack","tackle_box"], family:true, clutter:"medium" },
  home_16:{ arch:"cosy older seafarer", template:"cosy",   pal:P.harbour,   rug:"#3a6a8a", wall:"nav_chart",  nook:["sea_chest","model_boat"], clutter:"medium" },
  home_17:{ arch:"practical seaside",   template:"fisher", pal:P.seaside,   rug:"#4a8a9a", wall:"knife_rack", nook:["ice_box","scales","crate_stack"], clutter:"medium" },
};

export const DEFAULT_THEME: HomeTheme = {
  arch:"cosy cottage", template:"cosy", pal:P.adminWarm, rug:"#a07850",
  wall:"tea_shelf", nook:["bookshelf_tall"], clutter:"low",
};

// Build a full floorplan for one home. Pure geometry — used for both drawing
// (main.ts) and collision (homeCollisionRects), so they never drift apart.
export function buildLayout(theme: HomeTheme, id: string, W: number, H: number){
  const bc = BED_CONFIG[id] || { d:0, k:0 };
  const bW = bc.d ? 72 : 50, bX = W - bW - 10, bY = 50;
  const fam = !!theme.family;
  const floors:any[] = [], P:any[] = [], S:any[] = [];
  const push = (k:string,x:number,y:number)=> P.push({ k, x:Math.round(x), y:Math.round(y) });
  const solid = (x:number,y:number,w:number,h:number)=> S.push({ x:Math.round(x), y:Math.round(y), w:Math.round(w), h:Math.round(h) });

  // ---- KITCHEN / DINING (back-left) ----
  floors.push({ x:4, y:47, w:132, h:50, c:"#efe3c6", a:0.5 });
  if (theme.wall) push(theme.wall, 142, 10);
  push("kitchen_run", 8, 48);  solid(8, 54, 118, 16);
  const dk = fam ? "dining_big" : "dining_set";
  push(dk, 34, 104);           solid(38, 106, fam ? 52 : 30, 22);

  // ---- LIVING (centre, on a rug) ----
  floors.push({ x:104, y:120, w:114, h:60, c:theme.rug, a:0.26, border:true });
  push("living_set", 106, 126);
  solid(108, 132, 18, 42);   // sofa (vertical, left edge of rug)
  solid(150, 140, 26, 14);   // coffee table

  // ---- SLEEPING (built around the top-right bed) ----
  floors.push({ x:bX-6, y:bY+42, w:bW+12, h:30, c:theme.rug, a:0.18 });
  push("bedside", bX-20, bY+16);  solid(bX-20, bY+18, 16, 24);
  if (bc.k === 0){ push("div_screen", bX-30, bY+2); solid(bX-29, bY+2, 5, 72); }
  solid(bX, bY, bW, 46);                                   // main bed
  for (let ci=0; ci<bc.k; ci++){ const cbX = W-(ci+1)*46-10; solid(cbX, 102, 40, 28); } // kids' beds

  // ---- ENTRANCE (bottom-centre, at the door) ----
  push("entry_mat",   W/2-16, H-22);
  push("boots",       W/2-46, H-24);
  push("entry_plant", W/2+30, H-34);

  // ---- STORAGE / PERSONALITY nook (bottom-left) ----
  (theme.nook || []).forEach((k,i)=>{
    if (i===0){
      if (TALL_NOOK.has(k)){ push(k, 10, 116); solid(10, 116, 26, H-14-116); }
      else if (k==="workbench"){ push(k, 8, 150); solid(8, 156, 82, 18); }
      else { push(k, 12, 152); solid(12, 152, 34, 26); }
    } else {
      const ex = [[54,160],[78,168],[48,132]][(i-1)%3];
      push(k, ex[0], ex[1]);
    }
  });

  // ---- FAMILY toy corner ----
  if (fam) push("toy_corner", 74, H-30);

  return { floors, placements:P, solids:S, windows:[30,198], bed:{ bX, bY, bW } };
}

export function homeCollisionRects(id: string, W: number, H: number){
  const th = HOME_INTERIORS[id] || DEFAULT_THEME;
  return buildLayout(th, id, W, H).solids;
}
