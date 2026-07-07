// @ts-nocheck
// HX2 — Asset-Led House Interior data.
// Each villager home gets a palette + an ordered list of props. Props are drawn
// by _homeProp() in main.ts; positions are fractions of the interior canvas
// (fx,fy in 0..1) so they scale with the room. Keys map to the prop library.
//
// Zones (keep one prop per zone to avoid overlap):
//   L-TALL   fx~0.03 fy~0.25  — left-wall tall unit (shelf/wardrobe/cabinet)
//   L-CNTR   fx~0.03 fy~0.25  — left back counter (kitchen/workbench)
//   BACK     fx~0.34 fy~0.05  — back-wall decor (charts/nets/photos/bunting)
//   R-FLOOR  fx~0.80 fy~0.70  — right floor furniture (sofa/armchair)
//   F-LEFT   fx~0.17 fy~0.74  — left floor prop / story corner
//   F-MIDR   fx~0.62 fy~0.78  — mid-right floor prop
//   DOOR     fx~0.90 fy~0.72  — door-side plant/boots
// Anchor tiles from the Roguelike Interior Pack are drawn via keys prefixed
// "tile:" (verified coordinates only — see HOUSE_INTERIOR_ASSET_GUIDE.md).

export interface HomePalette { wallTop:string; wall:string; floorA:string; floorB:string; trim:string; }
export interface HomeProp { k:string; fx:number; fy:number; }
export interface HomeTheme { arch:string; pal:HomePalette; rug:string; props:HomeProp[]; }

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

// Safe zones (avoid: bed top-right; children's beds right-mid on family homes;
// the bottom-centre door/exit lane). Right-side props only sit BELOW the bed line.
export const HOME_INTERIORS: Record<string, HomeTheme> = {
  // ---- Council / admin ----
  home_01: { arch:"neat older resident", pal:P.adminWarm, rug:"#b8607a", props:[
    { k:"tile:bookshelf", fx:0.03, fy:0.24 }, { k:"tea_shelf", fx:0.30, fy:0.05 },
    { k:"writing_desk", fx:0.13, fy:0.74 }, { k:"tea_table", fx:0.40, fy:0.82 },
    { k:"armchair", fx:0.80, fy:0.70 }, { k:"tile:plant", fx:0.90, fy:0.56 } ] },
  home_08: { arch:"neat professional", pal:P.adminCool, rug:"#4a6a9a", props:[
    { k:"filing_cabinet", fx:0.03, fy:0.24 }, { k:"framed_certs", fx:0.32, fy:0.05 },
    { k:"writing_desk", fx:0.13, fy:0.74 }, { k:"single_chair", fx:0.80, fy:0.72 },
    { k:"tile:plant", fx:0.90, fy:0.56 } ] },

  // ---- Steelworkers ----
  home_02: { arch:"practical worker", pal:P.forge, rug:"#8a5a3a", props:[
    { k:"wardrobe", fx:0.03, fy:0.24 }, { k:"tool_hooks", fx:0.34, fy:0.05 },
    { k:"tile:fireplace", fx:0.80, fy:0.60 }, { k:"armchair", fx:0.40, fy:0.80 },
    { k:"kettle_stove", fx:0.13, fy:0.74 } ] },
  home_10: { arch:"practical worker", pal:P.forge, rug:"#9a5a30", props:[
    { k:"wardrobe", fx:0.03, fy:0.24 }, { k:"tool_hooks", fx:0.34, fy:0.05 },
    { k:"armchair", fx:0.80, fy:0.70 }, { k:"kettle_stove", fx:0.13, fy:0.74 },
    { k:"ember_apron", fx:0.42, fy:0.82 }, { k:"boots", fx:0.90, fy:0.82 } ] },

  // ---- Bakers (family) ----
  home_03: { arch:"family home", pal:P.bakerWarm, rug:"#d09850", props:[
    { k:"kitchen_counter", fx:0.03, fy:0.24 }, { k:"preserve_shelf", fx:0.34, fy:0.05 },
    { k:"cake_stand", fx:0.14, fy:0.74 }, { k:"kids_toys", fx:0.26, fy:0.84 },
    { k:"tile:table", fx:0.60, fy:0.74 } ] },
  home_13: { arch:"family + baker", pal:P.bakerRose, rug:"#c86a86", props:[
    { k:"kitchen_counter", fx:0.03, fy:0.24 }, { k:"bunting", fx:0.16, fy:0.03 },
    { k:"rosettes", fx:0.46, fy:0.05 }, { k:"cake_stand", fx:0.14, fy:0.74 },
    { k:"kids_toys", fx:0.26, fy:0.84 }, { k:"tile:table", fx:0.60, fy:0.74 } ] },

  // ---- Logistics ----
  home_04: { arch:"practical / family", pal:P.logistics, rug:"#4a6a8a", props:[
    { k:"route_board", fx:0.03, fy:0.24 }, { k:"pinned_manifests", fx:0.34, fy:0.05 },
    { k:"writing_desk", fx:0.13, fy:0.74 }, { k:"toy_lorry", fx:0.40, fy:0.83 },
    { k:"armchair", fx:0.80, fy:0.70 } ] },
  home_12: { arch:"big family home", pal:P.logistics, rug:"#6a7a5a", props:[
    { k:"route_board", fx:0.03, fy:0.24 }, { k:"bunting", fx:0.16, fy:0.03 },
    { k:"toy_lorry", fx:0.14, fy:0.80 }, { k:"kids_toys", fx:0.28, fy:0.84 },
    { k:"tile:table", fx:0.60, fy:0.74 } ] },

  // ---- Collector ----
  home_05: { arch:"eccentric collector", pal:P.collector, rug:"#8a6a4a", props:[
    { k:"display_case", fx:0.03, fy:0.22 }, { k:"wall_photos", fx:0.32, fy:0.04 },
    { k:"stacked_files", fx:0.14, fy:0.82 }, { k:"medal_case", fx:0.42, fy:0.80 },
    { k:"armchair", fx:0.80, fy:0.70 } ] },

  // ---- Sawyers ----
  home_06: { arch:"sawmill worker (messy)", pal:P.sawyer, rug:"#a06838", props:[
    { k:"workbench", fx:0.03, fy:0.24 }, { k:"axe_wall", fx:0.34, fy:0.05 },
    { k:"timber_stack", fx:0.13, fy:0.76 }, { k:"boots", fx:0.26, fy:0.86 },
    { k:"wood_crafts", fx:0.42, fy:0.82 }, { k:"tile:bookshelf", fx:0.86, fy:0.66 } ] },
  home_14: { arch:"tidy sawyer", pal:P.sawyer, rug:"#96703c", props:[
    { k:"tile:bookshelf", fx:0.03, fy:0.24 }, { k:"axe_wall", fx:0.34, fy:0.05 },
    { k:"timber_stack", fx:0.13, fy:0.78 }, { k:"wood_crafts", fx:0.42, fy:0.82 },
    { k:"reading_chair", fx:0.80, fy:0.72 } ] },

  // ---- Farmer ----
  home_07: { arch:"farmer / rural", pal:P.farmer, rug:"#8aa858", props:[
    { k:"egg_dresser", fx:0.03, fy:0.24 }, { k:"herb_bunches", fx:0.34, fy:0.04 },
    { k:"flower_pots", fx:0.13, fy:0.80 }, { k:"animal_basket", fx:0.42, fy:0.82 },
    { k:"rocking_chair", fx:0.80, fy:0.70 }, { k:"feed_sacks", fx:0.90, fy:0.80 } ] },

  // ---- Tinkerer ----
  home_11: { arch:"messy tinkerer", pal:P.tinkerer, rug:"#6a7a8a", props:[
    { k:"metal_shelf", fx:0.03, fy:0.22 }, { k:"workbench", fx:0.32, fy:0.24 },
    { k:"tool_chest", fx:0.14, fy:0.82 }, { k:"gears_project", fx:0.42, fy:0.82 },
    { k:"kettle_mug", fx:0.82, fy:0.72 } ] },

  // ---- Fishers / seaside ----
  home_09: { arch:"fisher / seaside", pal:P.seaside, rug:"#3a7a9a", props:[
    { k:"sea_cabinet", fx:0.03, fy:0.24 }, { k:"hanging_net", fx:0.34, fy:0.05 },
    { k:"bucket", fx:0.14, fy:0.82 }, { k:"tackle_box", fx:0.42, fy:0.82 },
    { k:"crate_stack", fx:0.80, fy:0.72 }, { k:"oilskins", fx:0.90, fy:0.60 } ] },
  home_15: { arch:"seaside family", pal:P.seaside, rug:"#3a8a8a", props:[
    { k:"sea_cabinet", fx:0.03, fy:0.24 }, { k:"hanging_net", fx:0.34, fy:0.05 },
    { k:"kids_toys", fx:0.14, fy:0.82 }, { k:"flower_jar", fx:0.42, fy:0.82 },
    { k:"crate_stack", fx:0.80, fy:0.72 } ] },
  home_17: { arch:"practical seaside", pal:P.seaside, rug:"#4a8a9a", props:[
    { k:"ice_box", fx:0.03, fy:0.58 }, { k:"knife_rack", fx:0.34, fy:0.05 },
    { k:"crate_stack", fx:0.14, fy:0.76 }, { k:"scales", fx:0.42, fy:0.82 },
    { k:"bucket", fx:0.82, fy:0.80 } ] },

  // ---- Harbourmaster ----
  home_16: { arch:"cosy older seafarer", pal:P.harbour, rug:"#3a6a8a", props:[
    { k:"sea_cabinet", fx:0.03, fy:0.24 }, { k:"nav_chart", fx:0.32, fy:0.04 },
    { k:"sea_chest", fx:0.14, fy:0.78 }, { k:"model_boat", fx:0.42, fy:0.82 },
    { k:"armchair", fx:0.80, fy:0.70 }, { k:"lantern", fx:0.90, fy:0.60 } ] },
};

export const DEFAULT_THEME: HomeTheme = {
  arch:"cosy cottage", pal:P.adminWarm, rug:"#a07850",
  props:[ { k:"tile:bookshelf", fx:0.03, fy:0.25 }, { k:"armchair", fx:0.80, fy:0.70 }, { k:"tile:plant", fx:0.90, fy:0.55 } ],
};
