// @ts-nocheck — full typing extracted progressively from M3+
import { XP_TABLE, levelFromXp } from './engine/xp.ts';
import { ITEMS } from './data/items.ts';
import { SKILLS } from './data/skills.ts';
import { NPCS, MARKET_ROLL_MS } from './data/npcs.ts';
import { UPGRADES } from './data/upgrades.ts';
import { PETS } from './data/pets.ts';
import { CLIENTS, CONTRACT_POOL } from './data/contracts.ts';
import { TRACKS } from './audio/tracks.ts';
import { TILE, VCOLS, VROWS, VIEW_W, VIEW_H, VMAP, V_OBJECTS, NORTH_EXT } from './world/map.ts';
import { nightAlpha, lampGlow, isNight, skyTint, gameHour, DAY_DURATION_MS } from './world/daynight.ts';
import { pixelScale } from './world/renderer.ts';
import { DEFAULT_APPEARANCE, SKIN_TONES, HAIR_COLOURS, HAIR_STYLE_LABELS, SHIRT_COLOURS, TROUSER_COLOURS, FACIAL_HAIR_STYLES, EYE_COLOURS, JACKET_COLOURS, SHOE_COLOURS, ACCESSORY_STYLES, SCARF_COLOURS, HAT_STYLES, HAT_COLOURS } from './player/customisation.ts';
import { VILLAGERS } from './data/villagers.ts';
import { HOME_INTERIORS, DEFAULT_THEME, BED_CONFIG, buildLayout, homeCollisionRects } from './data/homeInteriors.ts';
import { PUBLIC_COLS } from './data/interiorCollision.ts';
import { CLUB_THEMES, clubTheme, clubThemeIndex, msToNextTheme } from './data/clubThemes.ts';
import { SWING_SKILLS, SWING_FRAC, SWING_COOLDOWN_MS, swingClicks } from './data/swing.ts';
import { ECON, applySalePressure, applyBuyPressure, recoverPressure, driftToward, nudgeDrift, baseFactor, markToMarket, macroPhase, macroPhaseId, macroDemand, msToNextPhase } from './data/economy.ts';
import { DISTRICTS, isDistrictOpen, districtForBuilding, nextGatedDistrict } from './data/districts.ts';
import { AUTOMATONS, SKILL_GROUP, automatonById, automatonsForSkill, autoSpeedMult, autoYieldChance } from './data/automatons.ts';
import { JOURNEY, stageComplete, stageProgress, currentStageIndex, currentStage, canClaim, earnedTitle, isJourneyComplete } from './data/journey.ts';
import { RECIPES, recipeById, recipeUnlocked, canCook, maxCookable, buffDurationMs, availableRecipes } from './data/cooking.ts';
import { FISH, fishById, rollCatch as _rollCatch, catchChance as _catchChance } from './data/fishing.ts';
import { SCHOOL_UPGRADES, schoolTier, nextUpgrade, isSchoolComplete } from './data/school.ts';
import { PRESTIGE_MIN_TOTAL, prestigeEligible, legacyXpMult, legacySellMult, legacyStars, legacyRank, legacyBonusText } from './data/legacy.ts';
import { timeOfDay as _timeOfDay, pickLine as _pickLine, convoLine as _convoLine, INTRO_NPCS, introLine as _introLine } from './data/dialogue.ts';
import { GRID_TIERS, GRID_MAX_TIER, gridTier, gridBonus, gridNext } from './data/grid.ts';
import { WEATHER_INFO, pickWeather, weatherDuration } from './data/weather.ts';
import { preloadAll, drawSprite, getSprite, drawFurnitureTile } from './world/assets.ts';

/* =====================================================
   BuyrWorld v0.8 — Vite+TS modular entry point
   Engine: pure tick(state, dt). No backend. No tracking.
   ===================================================== */

function ensureMarket(){
  if (!S.market) S.market = { drift:{}, last:Date.now() };
  NPCS.forEach(n => {
    if (!S.market.drift[n.id]) S.market.drift[n.id] = {};
    n.stock.forEach(it => {
      if (typeof S.market.drift[n.id][it] !== "number")
        S.market.drift[n.id][it] = 0.85 + Math.random()*0.4;
    });
  });
}
function ensureEcon(){
  if (!S.econ) S.econ = { pressure:{}, news:[], phaseId:null };
  if (!S.econ.pressure) S.econ.pressure = {};
  if (!S.econ.news) S.econ.news = [];
  if (!("phaseId" in S.econ)) S.econ.phaseId = null;
}
// LE2: prepend a headline to the economic news feed (capped).
function pushNews(icon, text, tone){
  ensureEcon();
  S.econ.news.unshift({ t: Date.now(), icon, text, tone: tone||"" });
  if (S.econ.news.length > 20) S.econ.news.length = 20;
}
// LE3: recipe graph (produced item → its input recipe), built once from the
// actions data. Raw/gathered items have no entry, so they act as chain leaves.
let _recipeMap = null;
function recipeMap(){
  if (_recipeMap) return _recipeMap;
  _recipeMap = {};
  for (const sk in SKILLS){
    for (const act of (SKILLS[sk].actions || [])){
      if (act.in && Object.keys(act.in).length){
        for (const outId in (act.out||{})) if (!_recipeMap[outId]) _recipeMap[outId] = { in: act.in };
      }
    }
  }
  return _recipeMap;
}
function _econNudge(it, p){
  NPCS.forEach(n => {
    if (n.stock.includes(it) && typeof S.market.drift[n.id]?.[it] === "number")
      S.market.drift[n.id][it] = nudgeDrift(S.market.drift[n.id][it], p);
  });
}
// LE1/LE3: selling saturates the market (pressure down); LE3: buying tightens it (pressure up).
function _econSale(it, qty){
  ensureEcon();
  const v = ITEMS[it]?.v || 10;
  const prev = S.econ.pressure[it] ?? ECON.P_START;
  const p = applySalePressure(prev, qty, v);
  S.econ.pressure[it] = p; _econNudge(it, p);
  if (p <= 0.66 && prev > 0.66){ pushNews("📦", `Glut of ${ITEMS[it]?.n||it} — the market's flooded, prices soft.`, "bad"); S.counters.econShocks = (S.counters.econShocks||0)+1; }
}
function _econBuy(it, qty){
  ensureEcon();
  const v = ITEMS[it]?.v || 10;
  const prev = S.econ.pressure[it] ?? ECON.P_START;
  const p = applyBuyPressure(prev, qty, v);
  S.econ.pressure[it] = p; _econNudge(it, p);
  if (p >= 1.34 && prev < 1.34){ pushNews("🔥", `Run on ${ITEMS[it]?.n||it} — demand's tight, prices firming.`, "good"); S.counters.econShocks = (S.counters.econShocks||0)+1; }
}
function rollMarket(force){
  ensureMarket(); ensureEcon();
  // LE2: announce a macro phase change whenever the town's cycle turns.
  const _ph = macroPhaseId();
  if (S.econ.phaseId !== _ph){
    if (S.econ.phaseId !== null) pushNews("", macroPhase().head, macroPhase().tone);
    S.econ.phaseId = _ph;
  }
  const steps = force ? 1 : Math.floor((Date.now() - S.market.last) / MARKET_ROLL_MS);
  if (steps <= 0) return false;
  const nsteps = Math.min(steps, 24);
  // supply/demand pressure heals toward 1.0 over the elapsed steps
  for (const it in S.econ.pressure) S.econ.pressure[it] = recoverPressure(S.econ.pressure[it], nsteps);
  // per-NPC drift mean-reverts toward each item's equilibrium.
  // LE3: eq = macro demand × baseFactor(item) where baseFactor = own pressure ×
  // recursive input cost-push. Computed once per item per roll (not per step).
  const _md = macroDemand();
  const _rm = recipeMap();
  const _recipeOf = (id) => _rm[id] || null;
  const _valueOf  = (id) => ITEMS[id]?.v || 0;
  const _pressureOf = (id) => S.econ.pressure[id] ?? ECON.P_START;
  const _eqCache = {};
  const eqOf = (it) => (it in _eqCache) ? _eqCache[it]
    : (_eqCache[it] = _md * baseFactor(it, _recipeOf, _valueOf, _pressureOf));
  for (let s = 0; s < nsteps; s++){
    NPCS.forEach(n => n.stock.forEach(it => {
      S.market.drift[n.id][it] = driftToward(S.market.drift[n.id][it], eqOf(it));
    }));
  }
  S.market.last = Date.now();
  return true;
}
function tradeBonus(){
  let b = skillLvl("trading") * 0.002;
  if (S.pets.active === "warehouse_panda") b += 0.05;
  if (S.degrees && S.degrees.includes("mkt_analysis")) b += 0.08;
  b += perkSellBonus();
  return Math.min(b, 0.60);
}
function eventMult(it){
  if (!S.worldEvent) return 1;
  const _ev = WORLD_EVENTS.find(e => e.id === S.worldEvent.id) || SEASONAL_EVENTS.find(e => e.id === S.worldEvent.id);
  if (!_ev) return 1;
  if (_ev.affects && !_ev.affects.includes(it)) return 1;
  return _ev.mult;
}
function buyPrice(npc, it){
  ensureMarket();
  const d = S.market.drift[npc.id][it];
  return Math.max(1, Math.round(ITEMS[it].v * d * 1.35 * eventMult(it) * seasonMult(it) * (1 - tradeBonus()) * (1 - perkBuyDiscount())));
}
function sellPrice(npc, it){
  ensureMarket();
  const d = S.market.drift[npc.id][it];
  const p = Math.round(ITEMS[it].v * d * 0.80 * eventMult(it) * seasonMult(it) * (1 + tradeBonus()) * mealBuffMult('sell') * legacySellMult(S.legacy));
  return Math.max(1, Math.min(p, buyPrice(npc, it) - 1));
}
function doTrade(npcId, it, qty, mode){
  const npc = NPCS.find(n=>n.id===npcId);
  if (!npc || skillLvl("trading") < npc.lvl) return;
  if (mode === "buy"){
    const unit = buyPrice(npc, it);
    const q = qty === "max" ? Math.floor(S.coins / unit) : Math.min(qty, Math.floor(S.coins / unit));
    if (q <= 0){ toast("Not enough coins."); return; }
    S.coins -= unit * q; addItem(it, q);
    _econBuy(it, q);   // LE3: buying tightens the market → cost-push up the chain
    grantXp("trading", Math.max(1, Math.round(unit * q * 0.06)));
    log(`⚖️ Bought ${q}× ${ITEMS[it].n} from ${npc.n} (−${fmt(unit*q)} coins)`);
  } else {
    const unit = sellPrice(npc, it);
    const q = qty === "max" ? itemCount(it) : Math.min(qty, itemCount(it));
    if (q <= 0){ toast("Nothing to sell."); return; }
    S.items[it] -= q; S.coins += unit * q;
    _econSale(it, q);   // LE1: selling saturates the market → your price softens
    S.counters.coinsEarned = (S.counters.coinsEarned||0) + unit * q;
    grantXp("trading", Math.max(2, Math.round(unit * q * 0.22)));
    rollPet("trading");
    log(`⚖️ Sold ${q}× ${ITEMS[it].n} to ${npc.n} → <b>+${fmt(unit*q)} coins</b>`, "good");
  }
  S.counters.trades = (S.counters.trades||0) + 1;
  achCheck();
  renderMain(); updateHud(); save();
}

/* ---------- Frost, the tutorial guide ---------- */
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function pName(){ return S.playerName ? esc(S.playerName) : "boss"; }
function frostSvg(size){
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 40" style="image-rendering:pixelated" role="img" aria-label="Frost, your guide">
    <rect x="7" y="2" width="18" height="7" fill="#17161a"/>
    <rect x="5" y="4" width="4" height="9" fill="#17161a"/><rect x="23" y="4" width="4" height="9" fill="#17161a"/>
    <rect x="9" y="7" width="14" height="9" fill="#f2c49a"/>
    <rect x="12" y="10" width="2" height="2" fill="#17161a"/><rect x="18" y="10" width="2" height="2" fill="#17161a"/>
    <rect x="14" y="13" width="4" height="1" fill="#c96f4a"/>
    <rect x="8" y="17" width="16" height="14" fill="#bfe8f7"/>
    <rect x="5" y="17" width="3" height="9" fill="#bfe8f7"/><rect x="24" y="17" width="3" height="9" fill="#bfe8f7"/>
    <rect x="5" y="26" width="3" height="3" fill="#f2c49a"/><rect x="24" y="26" width="3" height="3" fill="#f2c49a"/>
    <text x="16" y="23" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="4" fill="#1c6ea4">STAY</text>
    <text x="16" y="28" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="4" fill="#1c6ea4">FROSTY</text>
    <rect x="10" y="31" width="5" height="7" fill="#4a6ea9"/><rect x="17" y="31" width="5" height="7" fill="#4a6ea9"/>
    <rect x="9" y="38" width="6" height="2" fill="#17161a"/><rect x="17" y="38" width="6" height="2" fill="#17161a"/>
  </svg>`;
}
const TUT = [
  { say:()=>`Hey ${pName()}! Frost here — I keep things cool around the valley. Follow the path <b>west</b> into the quarry canyon and tap the <b>Iron Rock</b> to mine <b>5 Iron Ore</b>.`,
    obj:"Mine 5 Iron Ore", cond:()=> (S.prod.iron_ore||0) >= 5, reward:60,
    target:"rock_iron", where:"Quarry (far west)", cur:()=>(S.prod.iron_ore||0), max:5 },
  { say:()=>`Nice swing, ${pName()}! Ore's no good raw. Walk to the <b>Furnace</b> (the building with the chimney, west of the quarry) and smelt <b>2 Iron Bars</b>.`,
    obj:"Smelt 2 Iron Bars", cond:()=> (S.prod.iron_bar||0) >= 2, reward:90,
    target:"furnace", where:"The Furnace", cur:()=>(S.prod.iron_bar||0), max:2 },
  { say:()=>`Toasty! Now make something someone will pay for — pop into the <b>Workshop</b> next door and press <b>1 Bracket</b>.`,
    obj:"Press 1 Bracket", cond:()=> (S.prod.bracket||0) >= 1, reward:120,
    target:"workshop", where:"The Workshop", cur:()=>(S.prod.bracket||0), max:1 },
  { say:()=>`Last step: head to the <b>Depot</b> and deliver an order. Clients round here love punctuality almost as much as I love this t-shirt.`,
    obj:"Deliver 1 contract", cond:()=> S.counters.contracts >= 1, reward:200,
    target:"depot", where:"The Depot", cur:()=>S.counters.contracts, max:1 },
];
// Current tutorial objective + live progress (for the Warehouse panel & banner).
function tutObjectiveHtml(){
  if (!S.tut || S.tut.done || S.tut.step >= TUT.length) return "";
  const st = TUT[S.tut.step];
  const cur = Math.min(st.max, st.cur ? st.cur() : 0), max = st.max || 1;
  const pct = Math.round(cur / max * 100);
  return `<div class="obj-tracker">
    <div class="obj-row"><span>🎯 ${st.obj}</span><span><b>${cur}/${max}</b></span></div>
    <div class="obj-bar"><div class="obj-fill" style="width:${pct}%"></div></div>
    <div class="obj-where">📍 Go to: <b>${st.where}</b></div>
  </div>`;
}
function tutCheck(){
  if (!S.tut || S.tut.done) return;
  let advanced = false;
  while (S.tut.step < TUT.length && TUT[S.tut.step].cond()){
    const st = TUT[S.tut.step];
    S.coins += st.reward;
    toast(`❄️ FROST: NICE ONE! +${st.reward} COINS`);
    log(`❄️ Frost approves — objective complete (<b>+${st.reward} coins</b>).`, "good");
    S.tut.step++; advanced = true;
  }
  if (S.tut.step >= TUT.length && !S.tut.done){
    S.tut.done = true;
    log(`❄️ Frost: "That's the whole loop, ${pName()} — mine, make, move, get paid. The valley's yours now. Stay frosty."`, "rare");
  }
  if (advanced){ updateHud(); save(); }
}
function tutBannerHtml(){
  if (!S.tut || S.tut.done || S.tut.step >= TUT.length) return "";
  const st = TUT[S.tut.step];
  return `<div class="frost">${frostSvg(64)}
    <div class="say"><div class="who">FROST — YOUR GUIDE (${S.tut.step+1}/${TUT.length})</div>
    <p>${st.say()}</p><div class="obj">▸ Objective: ${st.obj} · Reward: ${st.reward} coins</div></div>
  </div>`;
}

// A prominent first-run guidance banner over the village: how to move + where to go.
// Only shows during the opening objective, so it never nags experienced players.
function firstRunHintHtml(){
  if (S.tab !== "village" || !S.tut || S.tut.done || S.tut.step > 0) return "";
  if ((S.prod.iron_ore||0) >= 5) return "";
  return `<div class="firstrun-hint">🎮 Move with <b>WASD</b> / arrow keys — or <b>tap</b> where to go. Head <b>west ◀</b> to the quarry ⛏️ and tap the Iron Rock.</div>`;
}
// Task 4: a quest marker guiding the player to the CURRENT objective's location —
// a floating label when it's on screen, or an edge arrow pointing toward it when not.
const QUEST_TARGET_LABEL = {
  rock_iron: "⛏️ Iron Rock — tap to mine!",
  furnace:   "🔥 Furnace — smelt here",
  workshop:  "🏭 Workshop — craft here",
  depot:     "📦 Depot — deliver here",
};
function questMarkerHtml(){
  if (S.tab !== "village" || !S.tut || S.tut.done || S.tut.step >= TUT.length) return "";
  const st = TUT[S.tut.step];
  const target = V_OBJECTS.find(o => o.id === st.target);
  if (!target) return "";
  let rx, ry;
  if (target.kind === "rock"){ rx = (target.tx + 0.5) * TILE; ry = (target.ty + 0.5) * TILE; }
  else { const r = objRect(target); rx = r.x + r.w/2; ry = r.y + r.h; }
  const sx = (rx - CAM.x) / VIEW_W * 100, sy = (ry - CAM.y) / VIEW_H * 100;
  const lbl = QUEST_TARGET_LABEL[st.target] || `📍 ${st.where}`;
  if (sx > 3 && sx < 97 && sy > 8 && sy < 94){
    return `<div class="quest-rock" style="left:${sx.toFixed(1)}%;top:${sy.toFixed(1)}%">${lbl}</div>`;
  }
  // off screen: an arrow at the screen edge pointing toward the objective
  const ang = Math.atan2(ry - (CAM.y + VIEW_H/2), rx - (CAM.x + VIEW_W/2));
  const ex = Math.max(9, Math.min(91, 50 + Math.cos(ang) * 44));
  const ey = Math.max(14, Math.min(86, 50 + Math.sin(ang) * 38));
  return `<div class="quest-arrow" style="left:${ex.toFixed(1)}%;top:${ey.toFixed(1)}%;transform:translate(-50%,-50%) rotate(${ang.toFixed(3)}rad)">➤</div>`
       + `<div class="quest-arrow-lbl" style="left:${ex.toFixed(1)}%;top:${(ey+8).toFixed(1)}%">${esc(st.where)}</div>`;
}
/* ---------- original soundtrack (Web Audio chiptune, per-location) ---------- */
function zoneForTab(tab){
  if (tab==="mining") return "quarry";
  if (tab==="steelworks") return "forge";
  if (tab==="manufacturing") return "line";
  if (tab==="trade" || tab==="contracts") return "market";
  if (tab==="pets") return "barn";
  if (tab==="woodcutting") return "barn";
  if (tab==="fishing") return "pier";
  if (tab==="upgrades" || tab==="ach") return "market";
  if (tab==="home") return "home";
  if (tab==="nightclub") return "club_" + clubTheme().track;
  return "valley";
}
const MUSIC = (() => {
  let ctx = null, timer = null, master = null, cur = null, loopStart = 0, noiseBuf = null, volMult = 1.0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function ensureCtx(){
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    if (!noiseBuf){
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate*0.12), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    }
  }
  function blip(track, midi, t, dur, type, vol){
    if (!midi) return;
    const beat = 60/track.tempo;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = mtof(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * volMult, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur*beat*0.9);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur*beat);
  }
  function thump(t, vel){
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = noiseBuf;
    g.gain.setValueAtTime(vel*0.12*volMult, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.1);
    s.connect(g); g.connect(master);
    s.start(t);
  }
  function loopBeats(track){ return track.lead.reduce((a,[,d])=>a+d, 0); }
  function scheduleLoop(track, t0){
    const beat = 60/track.tempo;
    let t = t0;
    track.lead.forEach(([m,d]) => { blip(track, m, t, d, track.leadType, 0.05); t += d*beat; });
    t = t0;
    track.bass.forEach(([m,d]) => { blip(track, m, t, d, track.bassType, 0.075); t += d*beat; });
    if (track.perc) track.perc.forEach(([b,v]) => thump(t0 + b*beat, v));
  }
  function pump(){
    if (!ctx || !cur) return;
    const track = TRACKS[cur], beat = 60/track.tempo, len = loopBeats(track)*beat;
    if (ctx.currentTime > loopStart + len - 0.3){
      loopStart += len;
      scheduleLoop(track, loopStart);
    }
  }
  return {
    unlocked:false,
    play(id){
      try{
        ensureCtx();
        if (cur === id && timer) return;
        if (master){
          const old = master;
          old.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
          setTimeout(()=>{ try{ old.disconnect(); }catch(e){} }, 900);
        }
        if (timer){ clearInterval(timer); timer = null; }
        master = ctx.createGain();
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(volLevel(), ctx.currentTime + 0.35);
        master.connect(ctx.destination);
        cur = id;
        loopStart = ctx.currentTime + 0.06;
        scheduleLoop(TRACKS[id], loopStart);
        timer = setInterval(pump, 120);
      }catch(e){}
    },
    stop(){
      if (timer){ clearInterval(timer); timer = null; }
      if (master && ctx){ master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
      cur = null;
    },
    setVol(v){ if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.08); },
    setVolMult(m){ volMult = m; },
    start(){ this.unlocked = true; this.play(zoneForTab(S.tab)); },
  };
})();
function updateMusicZone(){
  if (MUSIC.unlocked && S.settings && S.settings.music){
    const isHome = S.tab === "home";
    const isInterior = INTERIOR_TABS.has(S.tab) && S.tab !== "village";
    MUSIC.setVolMult(isHome ? 0.28 : isInterior ? 0.42 : 1.0);
    MUSIC.play(zoneForTab(S.tab));
  }
}
/* ---------- action sound effects ---------- */
const VOL_LEVELS = { low: 0.45, med: 0.75, loud: 1.05 };
function volLevel(){ return VOL_LEVELS[(S.settings && S.settings.vol) || "med"] || 0.75; }
const SFX = (() => {
  let ctx = null, noise = null;
  function ensure(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate*0.08), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    }
    if (ctx.state === "suspended") ctx.resume();
  }
  function osc(type, f0, f1, dur, vol, at=0){
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0+dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+dur);
  }
  function hit(vol, dur, at=0){
    const s = ctx.createBufferSource(), g = ctx.createGain(), t0 = ctx.currentTime + at;
    s.buffer = noise; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
    s.connect(g); g.connect(ctx.destination); s.start(t0);
  }
  return { play(skill){
    if (!MUSIC.unlocked || !S.settings || !S.settings.music) return;
    try{
      ensure();
      const mv = volLevel() / 0.75;
      if (skill==="mining"){ hit(0.10*mv, 0.05); osc("square", 1500, 640, 0.07, 0.05*mv); }
      else if (skill==="steelworks"){ osc("square", 660, 200, 0.16, 0.06*mv); hit(0.08*mv, 0.10); }
      else if (skill==="manufacturing"){ hit(0.07*mv, 0.03); hit(0.07*mv, 0.03, 0.08); }
      else if (skill==="woodcutting"){ hit(0.12*mv, 0.09); osc("triangle", 190, 90, 0.10, 0.07*mv); }
      else if (skill==="fishing"){ hit(0.06*mv, 0.12); osc("sine", 320, 110, 0.18, 0.05*mv); }
    }catch(e){}
  },
  levelUp(){
    if (!MUSIC.unlocked || !S.settings || !S.settings.music) return;
    try{
      ensure(); const mv = volLevel() / 0.75;
      // rising major arpeggio C-E-G-C
      osc("square", 523, 523, 0.12, 0.055*mv, 0);
      osc("square", 659, 659, 0.12, 0.055*mv, 0.10);
      osc("square", 784, 784, 0.14, 0.06*mv, 0.20);
      osc("triangle", 1047, 1047, 0.28, 0.07*mv, 0.30);
    }catch(e){}
  },
  snap(){
    if (!MUSIC.unlocked || !S.settings || !S.settings.music) return;
    try{
      ensure(); const mv = volLevel() / 0.75;
      hit(0.10*mv, 0.05);                          // the crack
      osc("square", 950, 150, 0.09, 0.06*mv, 0);   // twang whipping back
    }catch(e){}
  },
  cook(){
    if (!MUSIC.unlocked || !S.settings || !S.settings.music) return;
    try{
      ensure(); const mv = volLevel() / 0.75;
      hit(0.07*mv, 0.22);                         // sizzle
      hit(0.05*mv, 0.18, 0.10);
      osc("sine", 440, 660, 0.18, 0.045*mv, 0.14); // a cheerful "ready!" chime
      osc("sine", 660, 880, 0.20, 0.05*mv, 0.30);
    }catch(e){}
  },
  fanfare(){
    if (!MUSIC.unlocked || !S.settings || !S.settings.music) return;
    try{
      ensure(); const mv = volLevel() / 0.75;
      // grand two-bar rising fanfare for a Founder's Journey milestone
      osc("square",   523, 523, 0.14, 0.05*mv, 0.00);   // C5
      osc("square",   784, 784, 0.14, 0.05*mv, 0.12);   // G5
      osc("square",  1047,1047, 0.16, 0.055*mv, 0.24);  // C6
      osc("triangle",1319,1319, 0.20, 0.06*mv, 0.36);   // E6
      osc("triangle",1568,1568, 0.42, 0.07*mv, 0.50);   // G6 (held)
      hit(0.05*mv, 0.20, 0.50);                         // shimmer
    }catch(e){}
  }};
})();
// celebratory "LEVEL N!" burst over the screen when a skill levels up
function showLevelBurst(skill, lvl){
  try{
    const el = document.createElement("div");
    el.className = "level-burst";
    el.innerHTML = `<div class="lb-ic">${SKILLS[skill].ic}</div><div class="lb-sk">${SKILLS[skill].n}</div><div class="lb-lv">LEVEL ${lvl}</div>`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1500);
  }catch(e){}
}
// celebratory burst when a Founder's Journey stage is claimed (reuses .level-burst)
function showJourneyBurst(stage){
  try{
    const el = document.createElement("div");
    el.className = "level-burst";
    const title = stage.reward.title ? `<div class="lb-lv">“${stage.reward.title}”</div>` : "";
    el.innerHTML = `<div class="lb-ic">${stage.ic}</div><div class="lb-sk">${stage.title}</div>${title}`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1900);
  }catch(e){}
}
function syncMusicButton(){
  const b = document.getElementById("btn-music");
  if (!b) return;
  b.textContent = !S.settings.music ? "🔇" : S.settings.vol === "low" ? "🔉" : S.settings.vol === "loud" ? "📣" : "🔊";
  b.title = !S.settings.music ? "Sound: off" : "Volume: " + S.settings.vol;
}
function setMusic(on){
  S.settings.music = on;
  if (on){ MUSIC.unlocked = true; updateMusicZone(); MUSIC.setVol(volLevel()); } else MUSIC.stop();
  syncMusicButton(); save();
}
function cycleVolume(){
  if (!S.settings.music){ S.settings.vol = "low"; setMusic(true); return; }
  if (S.settings.vol === "low"){ S.settings.vol = "med"; }
  else if (S.settings.vol === "med"){ S.settings.vol = "loud"; }
  else { setMusic(false); return; }
  MUSIC.setVol(volLevel()); syncMusicButton(); save();
}

/* ================= VILLAGE WORLD ================= */
const CAM = { x:0, y:0 };
// Derive player colours from S.appearance (falls back to defaults for legacy saves)
const plHair      = () => (S.appearance && S.appearance.hair)     || DEFAULT_APPEARANCE.hair;
const plShirt     = () => (S.appearance && S.appearance.shirt)    || DEFAULT_APPEARANCE.shirt;
const plSkin      = () => (S.appearance && S.appearance.skin)     || DEFAULT_APPEARANCE.skin;
const plTrousers  = () => (S.appearance && S.appearance.trousers) || DEFAULT_APPEARANCE.trousers;
const plHat       = () => (S.appearance && S.appearance.hat)      || 'none';
const plHatColor  = () => (S.appearance && S.appearance.hatColor) || '#2a1a0a';
const plGender    = () => (S.appearance && S.appearance.gender)   || 'male';
const plHairStyle = () => (S.appearance && S.appearance.hairStyle != null) ? +S.appearance.hairStyle : 0;
const plEyeColor  = () => (S.appearance && S.appearance.eyeColor) || '#17161a';
const plFacialHair= () => (S.appearance && S.appearance.facialHair) || 'none';
const plJacket    = () => (S.appearance && S.appearance.jacket)   || '';
const plShoes     = () => (S.appearance && S.appearance.shoes)    || '#2a2a32';
const plAccessory = () => (S.appearance && S.appearance.accessory)|| 'none';
const plScarfColor= () => (S.appearance && S.appearance.scarfColor)|| '#c04040';
const plOpts      = () => ({ hairStyle:plHairStyle(), eyeColor:plEyeColor(), facialHair:plFacialHair(), jacket:plJacket(), shoes:plShoes(), accessory:plAccessory(), scarfColor:plScarfColor() });

const FROST_TIPS = [
  "Rocks respawn instantly round here. Union rules.",
  "Sell when the arrow's green. Buy when it's red. That's the whole MBA.",
  "The Rail Rhino is real. I've seen it. Deliver enough contracts.",
  "Upgrades in the Town Hall pay for themselves. Usually.",
  "Stay frosty.",
];

/* ---------- achievements ---------- */
function prodSum(ids){ return ids.reduce((a,id)=>a+(S.prod[id]||0),0); }
const ORES    = ["iron_ore","copper_ore","coal","bauxite","rare_earth"];
const BARS    = ["iron_bar","copper_wire","steel_bar","alu_ingot","tech_alloy"];
const GOODS   = ["bracket","wiring_loom","gearbox","chassis","servo_unit"];
const CRAFTED = ["berry_jam","herb_tea","carved_bowl","smoked_fish","gift_basket"];
const ACH = [
  { id:"first_swing", ic:"⛏️", n:"First Swing",      ds:"Mine your first ore.",              r:10,   c:()=>prodSum(ORES)>=1 },
  { id:"ore_100",     ic:"🪨", n:"Quarry Regular",    ds:"Mine 100 ores.",                    r:50,   c:()=>prodSum(ORES)>=100 },
  { id:"ore_1000",    ic:"⛰️", n:"Mountain Mover",    ds:"Mine 1,000 ores.",                  r:300,  c:()=>prodSum(ORES)>=1000 },
  { id:"hot_stuff",   ic:"🔥", n:"Hot Stuff",         ds:"Smelt your first bar.",             r:25,   c:()=>prodSum(BARS)>=1 },
  { id:"made_here",   ic:"🏭", n:"Made in the Valley",ds:"Manufacture your first product.",   r:25,   c:()=>prodSum(GOODS)>=1 },
  { id:"first_run",   ic:"🚚", n:"First Delivery",    ds:"Deliver your first contract.",      r:50,   c:()=>S.counters.contracts>=1 },
  { id:"runs_10",     ic:"📦", n:"Reliable Supplier", ds:"Deliver 10 contracts.",             r:100,  c:()=>S.counters.contracts>=10 },
  { id:"runs_50",     ic:"🚛", n:"Logistics Legend",  ds:"Deliver 50 contracts.",             r:500,  c:()=>S.counters.contracts>=50 },
  { id:"first_deal",  ic:"⚖️", n:"Deal!",             ds:"Make your first trade.",            r:25,   c:()=>S.counters.trades>=1 },
  { id:"deals_25",    ic:"🤝", n:"Wheeler Dealer",    ds:"Make 25 trades.",                   r:150,  c:()=>S.counters.trades>=25 },
  { id:"first_grand", ic:"💰", n:"First Grand",       ds:"Earn 1,000 coins in total.",        r:100,  c:()=>S.counters.coinsEarned>=1000 },
  { id:"tycoon",      ic:"🏦", n:"Valley Tycoon",     ds:"Earn 25,000 coins in total.",       r:1000, c:()=>S.counters.coinsEarned>=25000 },
  { id:"skilled_10",  ic:"⭐", n:"Getting Good",      ds:"Reach level 10 in any skill.",      r:50,   c:()=>Object.keys(S.skills).some(k=>skillLvl(k)>=10) },
  { id:"chartered",   ic:"🎓", n:"Chartered!",        ds:"Reach level 25 in any skill.",      r:200,  c:()=>Object.keys(S.skills).some(k=>skillLvl(k)>=25) },
  { id:"halfway",     ic:"🌟", n:"Halfway to Legend", ds:"Reach level 50 in any skill.",      r:1000, c:()=>Object.keys(S.skills).some(k=>skillLvl(k)>=50) },
  { id:"total_100",   ic:"📈", n:"Century Founder",   ds:"Reach total level 100.",            r:250,  c:()=>totalLvl()>=100 },
  { id:"best_friend", ic:"🦊", n:"Best Friend",       ds:"Recruit your first companion.",     r:100,  c:()=>S.pets.owned.length>=1 },
  { id:"full_barn",   ic:"🐾", n:"Full Barn",         ds:"Recruit all "+PETS.length+" companions.", r:2000, c:()=>S.pets.owned.length>=PETS.length },
  { id:"capex",       ic:"🛒", n:"CapEx Approved",    ds:"Buy your first upgrade.",           r:50,   c:()=>Object.keys(S.upgrades).length>=1 },
  { id:"rail_baron",  ic:"🚆", n:"Rail Baron",        ds:"Sign the Rail Freight Deal.",       r:1000, c:()=>!!S.upgrades.fleet3 },
  { id:"frosty_grad", ic:"❄️", n:"Stay Frosty",       ds:"Complete Frost's tutorial.",        r:50,   c:()=>S.tut && S.tut.done },
  { id:"first_fish",   ic:"🎣", n:"First Cast",        ds:"Catch your first fish.",             r:25,   c:()=>prodSum(["sardine","mackerel","bass","salmon","tuna"])>=1 },
  { id:"angler_100",   ic:"🐟", n:"Seasoned Angler",   ds:"Catch 100 fish.",                    r:150,  c:()=>prodSum(["sardine","mackerel","bass","salmon","tuna"])>=100 },
  { id:"graduate",     ic:"🏛️", n:"Graduate",           ds:"Complete a university degree.",      r:150,  c:()=>(S.degrees?.length||0)>=1 },
  { id:"full_honours", ic:"📜", n:"Full Honours",       ds:"Complete all university degrees.",   r:2000, c:()=>(S.degrees?.length||0)>=7 },
  { id:"landlord",     ic:"🏡", n:"Landlord",           ds:"Buy your first property.",           r:100,  c:()=>(S.properties?.length||0)>=1 },
  { id:"mogul",        ic:"🏰", n:"Property Mogul",     ds:"Own all three properties.",          r:500,  c:()=>(S.properties?.length||0)>=3 },
  { id:"home_t1",      ic:"🛋️", n:"Moving In",          ds:"Upgrade your cottage to Tier 1.",    r:50,   c:()=>(S.homeTier||0)>=1 },
  { id:"home_t4",      ic:"🎹", n:"Dream Cottage",      ds:"Reach the highest home tier.",       r:500,  c:()=>(S.homeTier||0)>=4 },
  { id:"first_loan",   ic:"💳", n:"In the Red",         ds:"Take your first bank loan.",         r:15,   c:()=>(S.counters?.loansTotal||0)>=1 },
  { id:"in_the_black",  ic:"📈", n:"In the Black",       ds:"Close an exchange position at a profit.", r:200, c:()=>(S.counters?.exchangeProfits||0)>=1 },
  { id:"good_neighbour",ic:"📬", n:"Good Neighbour",    ds:"Complete a villager delivery request.", r:75,  c:()=>(S.counters?.deliveries||0)>=1 },
  { id:"postman",      ic:"🚚", n:"Village Postman",    ds:"Complete 10 villager delivery requests.", r:300, c:()=>(S.counters?.deliveries||0)>=10 },
  { id:"sea_legs",     ic:"⚓", n:"Sea Legs",          ds:"Unlock the Harbour District.",            r:200, c:()=>totalLvl()>=100 },
  { id:"first_craft",    ic:"🫙", n:"First Pot",        ds:"Make your first crafted item.",                r:30,  c:()=>prodSum(CRAFTED)>=1 },
  { id:"jam_maker",      ic:"🍓", n:"Jam Maker",         ds:"Pot your first Berry Jam.",                    r:25,  c:()=>(S.prod.berry_jam||0)>=1 },
  { id:"smoke_master",   ic:"🐡", n:"Smoke Master",      ds:"Smoke your first fish at the clay oven.",      r:40,  c:()=>(S.prod.smoked_fish||0)>=1 },
  { id:"gift_giver",     ic:"🧺", n:"Gift Giver",        ds:"Weave your first Gift Basket.",                r:75,  c:()=>(S.prod.gift_basket||0)>=1 },
  { id:"artisan",        ic:"⚱️", n:"Artisan",           ds:"Craft 50 items in the Artisan's Shed.",        r:150, c:()=>prodSum(CRAFTED)>=50 },
  { id:"master_artisan", ic:"🏺", n:"Master Artisan",    ds:"Craft 200 items in the Artisan's Shed.",       r:500, c:()=>prodSum(CRAFTED)>=200 },
  { id:"village_patron",    ic:"🌸", n:"Village Patron",     ds:"Fund your first beautification project.",      r:50,  c:()=>(S.beautification?.length||0)>=1 },
  { id:"village_benefactor",ic:"🌺", n:"Village Benefactor", ds:"Fund 10 beautification projects.",            r:200, c:()=>(S.beautification?.length||0)>=10 },
  { id:"greenfield_champion",ic:"🏡",n:"Featherstone Champion",ds:"Complete all 50 beautification projects.",    r:2000,c:()=>(S.beautification?.length||0)>=50 },
  { id:"first_best_friend", ic:"💖", n:"Best Friends",            ds:"Reach Best Friends with any villager.",                  r:200, c:()=>VILLAGERS.some(v=>friendLvl(v.id)>=5) },
  { id:"social_butterfly",  ic:"🦋", n:"Social Butterfly",        ds:"Reach Friends level with all 17 villagers.",             r:500, c:()=>VILLAGERS.every(v=>friendLvl(v.id)>=2) },
  { id:"request_1",         ic:"💌", n:"Good Samaritan",          ds:"Fulfil your first personal villager request.",           r:40,  c:()=>(S.counters?.requestsFulfilled||0)>=1 },
  { id:"request_10",        ic:"🤝", n:"Helpful Neighbour",       ds:"Fulfil 10 personal villager requests.",                  r:150, c:()=>(S.counters?.requestsFulfilled||0)>=10 },
  { id:"request_50",        ic:"🏅", n:"Pillar of the Community", ds:"Fulfil 50 personal villager requests.",                  r:500, c:()=>(S.counters?.requestsFulfilled||0)>=50 },
  { id:"first_perk",   ic:"⭐", n:"Rising Star",     ds:"Choose your first skill perk.",                        r:50,  c:()=>Object.keys(S.perks||{}).length>=1 },
  { id:"fully_specced",ic:"🌟", n:"Fully Specced",   ds:"Choose all 3 perks in any one skill.",                 r:300, c:()=>Object.keys(SKILL_PERKS).some(sk=>[10,25,40].every(t=>S.perks?.[sk+'_'+t])) },
  { id:"spring_craft", ic:"🌸", n:"Spring Sprout",  ds:"Craft a seasonal spring item at the Artisan's Shed.",  r:60,  c:()=>prodSum(['flower_crown','spring_tonic','blossom_jam'])>=1 },
  { id:"summer_craft", ic:"☀️", n:"Summer Glow",    ds:"Craft a seasonal summer item at the Artisan's Shed.",  r:60,  c:()=>prodSum(['lemonade','sun_hat','honey_cake'])>=1 },
  { id:"autumn_craft", ic:"🍂", n:"Autumn Bounty",  ds:"Craft a seasonal autumn item at the Artisan's Shed.",  r:60,  c:()=>prodSum(['spiced_cider','pickled_mushrooms','harvest_wreath'])>=1 },
  { id:"winter_craft", ic:"❄️", n:"Winter Warmth",  ds:"Craft a seasonal winter item at the Artisan's Shed.",  r:60,  c:()=>prodSum(['mulled_tea','pine_garland','winter_hamper'])>=1 },
  { id:"all_seasons",  ic:"🎪", n:"All Seasons",    ds:"Craft at least one item in every season.",             r:500, c:()=>prodSum(['flower_crown','spring_tonic','blossom_jam'])>=1&&prodSum(['lemonade','sun_hat','honey_cake'])>=1&&prodSum(['spiced_cider','pickled_mushrooms','harvest_wreath'])>=1&&prodSum(['mulled_tea','pine_garland','winter_hamper'])>=1 },
  { id:"daily_first", ic:"🎯", n:"Challenge Accepted",   ds:"Complete your first daily village challenge.",    r:50,  c:()=>(S.counters?.challengesClaimed||0)>=1 },
  { id:"daily_7",     ic:"🏅", n:"7-Day Habit",          ds:"Complete 7 daily village challenges.",            r:200, c:()=>(S.counters?.challengesClaimed||0)>=7 },
  { id:"daily_30",    ic:"🏆", n:"Dedicated Supplier",   ds:"Complete 30 daily village challenges.",           r:500, c:()=>(S.counters?.challengesClaimed||0)>=30 },
  { id:"first_harvest",ic:"🌱", n:"First Harvest",       ds:"Harvest your first crop from the cottage garden.", r:40,   c:()=>(S.counters?.gardenHarvests||0)>=1 },
  { id:"green_thumb",  ic:"🌻", n:"Green Thumb",         ds:"Harvest 20 crops from the cottage garden.",        r:150,  c:()=>(S.counters?.gardenHarvests||0)>=20 },
  { id:"home_cook",    ic:"🍳", n:"Home Cook",           ds:"Cook your first meal in the kitchen.",             r:40,   c:()=>(S.counters?.mealsCooked||0)>=1 },
  { id:"village_chef", ic:"🧑‍🍳", n:"Village Chef",        ds:"Cook 25 meals in the kitchen.",                    r:250,  c:()=>(S.counters?.mealsCooked||0)>=25 },
  { id:"full_menu",    ic:"🍱", n:"Full Menu",            ds:"Cook every recipe in the kitchen at least once.",  r:600,  c:()=>RECIPES.every(r=>(S.prod?.[r.out]||0)>=1) },
  { id:"beloved_greenfield", ic:"💝", n:"Beloved of Featherstone", ds:"Reach Best Friends with all 17 villagers and collect every keepsake.", r:2000, c:()=>(S.keepsakes?.length||0)>=17 },
  { id:"home_decorated",    ic:"🛋️", n:"Home Sweet Home",    ds:"Place your first piece of furniture.",         r:50,   c:()=>(S.placedFurniture?.length||0)>=1 },
  { id:"interior_designer", ic:"🏠", n:"Interior Designer",  ds:"Have 5 pieces of furniture placed at once.",   r:200,  c:()=>(S.placedFurniture?.length||0)>=5 },
  { id:"festival_goer",   ic:"🎪", n:"Festival Goer",    ds:"Attend your first seasonal festival.",        r:100,  c:()=>(S.festival?.attended?.length||0)>=1 },
  { id:"festival_regular",ic:"🎡", n:"Festival Regular",  ds:"Attend all four seasonal festivals.",          r:500,  c:()=>(S.festival?.attended?.length||0)>=4 },
  { id:"raffle_winner",   ic:"🎟️", n:"Raffle Winner",    ds:"Win 10 raffle prizes at village festivals.",   r:200,  c:()=>(S.counters?.raffleWins||0)>=10 },
  { id:"automation_age",  ic:"🤖", n:"Automation Age",   ds:"Build your first automaton at the Automation Lab.",   r:300,  c:()=>Object.keys(S.automatons||{}).length>=1 },
  { id:"fully_automated", ic:"🦾", n:"Fully Automated",  ds:"Have an automaton working every automatable skill.",  r:1500, c:()=>Object.keys(SKILL_GROUP).every(sk=>S.automatons?.[sk]) },
  { id:"powering_up",     ic:"⚡", n:"Powering Up",      ds:"Bring the Power Grid online (Tier 1).",               r:500,  c:()=>(S.grid?.tier||0)>=1 },
  { id:"smart_grid",      ic:"🛰️", n:"Smart Grid",       ds:"Upgrade the Power Grid to maximum.",                  r:2500, c:()=>(S.grid?.tier||0)>=GRID_MAX_TIER },
  { id:"town_planner",    ic:"🗺️", n:"Town Planner",     ds:"Reach total level 200 — every district unlocked.",    r:1500, c:()=>totalLvl()>=200 },
  { id:"self_made",       ic:"💎", n:"Self-Made",        ds:"Reach a net worth of 100,000 coins.",                 r:2000, c:()=>netWorth()>=100000 },
  { id:"market_mover",    ic:"📊", n:"Market Mover",     ds:"Move prices — cause 5 market gluts or shortages by trading in bulk.", r:400, c:()=>(S.counters?.econShocks||0)>=5 },
  { id:"new_chapter",     ic:"🌟", n:"A New Chapter",    ds:"Begin your first New Chapter — pass the valley to a successor.",       r:1000, c:()=>(S.legacy||0)>=1 },
  { id:"living_legacy",   ic:"✨", n:"Living Legacy",    ds:"Reach Legacy 3 — three New Chapters written.",                        r:5000, c:()=>(S.legacy||0)>=3 },
];
const ACH_PROG = {
  ore_100:     ()=>({ cur:Math.min(100,  prodSum(ORES)),                              max:100   }),
  ore_1000:    ()=>({ cur:Math.min(1000, prodSum(ORES)),                              max:1000  }),
  runs_10:     ()=>({ cur:Math.min(10,   S.counters?.contracts||0),                  max:10    }),
  runs_50:     ()=>({ cur:Math.min(50,   S.counters?.contracts||0),                  max:50    }),
  deals_25:    ()=>({ cur:Math.min(25,   S.counters?.trades||0),                     max:25    }),
  first_grand: ()=>({ cur:Math.min(1000, S.counters?.coinsEarned||0),                max:1000  }),
  tycoon:      ()=>({ cur:Math.min(25000,S.counters?.coinsEarned||0),                max:25000 }),
  angler_100:  ()=>({ cur:Math.min(100,  prodSum(["sardine","mackerel","bass","salmon","tuna"])), max:100 }),
  full_barn:   ()=>({ cur:Math.min(PETS.length, S.pets?.owned?.length||0),           max:PETS.length }),
  total_100:   ()=>({ cur:Math.min(100,  totalLvl()),                                max:100   }),
  full_honours:()=>({ cur:Math.min(7,    S.degrees?.length||0),                      max:7     }),
  mogul:       ()=>({ cur:Math.min(3,    S.properties?.length||0),                   max:3     }),
  postman:        ()=>({ cur:Math.min(10,  S.counters?.deliveries||0),                max:10    }),
  artisan:        ()=>({ cur:Math.min(50,  prodSum(CRAFTED)),                          max:50    }),
  master_artisan: ()=>({ cur:Math.min(200, prodSum(CRAFTED)),                          max:200   }),
  village_benefactor:   ()=>({ cur:Math.min(10, S.beautification?.length||0),          max:10    }),
  greenfield_champion:  ()=>({ cur:Math.min(50, S.beautification?.length||0),          max:50    }),
  request_10:           ()=>({ cur:Math.min(10, S.counters?.requestsFulfilled||0),     max:10    }),
  request_50:           ()=>({ cur:Math.min(50, S.counters?.requestsFulfilled||0),     max:50    }),
  daily_7:              ()=>({ cur:Math.min(7,  S.counters?.challengesClaimed||0),     max:7     }),
  daily_30:             ()=>({ cur:Math.min(30, S.counters?.challengesClaimed||0),     max:30    }),
  green_thumb:          ()=>({ cur:Math.min(20, S.counters?.gardenHarvests||0),        max:20    }),
  beloved_greenfield:   ()=>({ cur:Math.min(17, S.keepsakes?.length||0),               max:17    }),
  interior_designer:    ()=>({ cur:Math.min(5,  S.placedFurniture?.length||0),          max:5     }),
  festival_regular:     ()=>({ cur:Math.min(4,  S.festival?.attended?.length||0),      max:4     }),
  raffle_winner:        ()=>({ cur:Math.min(10, S.counters?.raffleWins||0),            max:10    }),
};
function achCheck(){
  if (!S.ach) S.ach = {};
  for (const a of ACH){
    if (!a.id || S.ach[a.id] || !a.n) continue;
    if (a.c()){
      S.ach[a.id] = 1;
      S.coins += a.r;
      toast(`🏆 AWARD: ${a.n}! +${a.r} COINS`);
      log(`🏆 Award unlocked: <b>${a.n}</b> — ${a.ds} (+${a.r} coins)`, "rare");
    }
  }
}
const WANDERERS = [
  { id:"frost", n:"Frost", hair:"#17161a", shirt:"#bfe8f7", x:11*TILE, y:26*TILE, tx:null, ty:null, wait:2, moving:false, facing:1, pending:null,
    area:[10,25,25,29], home:[10,29,20,29], tips:FROST_TIPS, tee:"STAYFROSTY", ri:-1, benchIdx:5,
    // patrols the path by the furnace/quarry (avoids the pond at tx14–17,ty27–28)
    route:[[11,26],[18,26],[24,26],[24,29],[18,29],[11,29]],
    profile:{ job:"Supply Chain Professional", home:"The Valley Lodge", children:["Harison (6)"] } },
  { id:"poppy", n:"Poppy", hair:"#b0574f", shirt:"#ffd666", x:5*TILE, y:(14+NORTH_EXT)*TILE, tx:null, ty:null, wait:3, moving:false, facing:1, pending:null,
    area:[2,12+NORTH_EXT,8,16+NORTH_EXT], home:[2,12+NORTH_EXT,5,13+NORTH_EXT], tips:[
      "Morning! My turnips go by lorry now. Fancy that.",
      "Frost says you're the new founder. Don't work too hard!",
      "The market stalls pay best on green-arrow days.",
    ],
    profile:{ job:"Turnip Farmer", home:"Poppy's Farm" } },
  { id:"sam", n:"Sam", hair:"#3a3a3a", shirt:"#4a6ea9", x:27*TILE, y:(17.5+NORTH_EXT)*TILE, tx:null, ty:null, wait:3, moving:false, facing:1, pending:null,
    area:[26,17+NORTH_EXT,37,17.8+NORTH_EXT], home:[27,17+NORTH_EXT,35,17.8+NORTH_EXT], tips:[
      "One day ships'll dock here. Port Salvo, they'll call it.",
      "See that boat? Doesn't leak much anymore.",
      "Heaviest thing I ever lifted? A Cargo Turtle. True story.",
    ],
    profile:{ job:"Harbour Warden", home:"Dockside Hut" } },
];
const VP = { x: 75*TILE, y: 28*TILE, tx: null, ty: null, pending: null, facing: 1, moving: false, dir:"down", enterCooldown: 0 };
let _lastIActionId = null;   // tracks the last interior action so the player re-walks to a new station
let _fishCatchT = 0;         // timestamp of the last fish caught, for the reel-up animation
let _fishCastT = 0;          // timestamp of the last cast (new fishing station), for the cast animation
let _fishActiveId = null;    // which fishing station is currently being fished
let _fishRodTip = { x:0, y:0 };  // world position of the player's rod tip (so the line connects to the character)
let _intVfx = [];               // interior completion rewards (floating +item pops)
let _comboCount = 0, _comboAt = 0, _comboSkill = null;   // consecutive-action streak (addictive feedback)
let _fishSpot = null;            // where the bobber has been cast (interior coords) — click the water to set it
let _fishAnchor = { x:0, y:0 };  // where the angler stood when they cast (for the retract/snap distance)
let _cat = { x:29*TILE, y:28*TILE, tx:29*TILE, ty:28*TILE, pauseT:0, facing:1, moving:false };
let _bflies = [];            // ambient butterflies (warm seasons)
let _homeVil = null;         // wandering home-villager state (per home)
let _homeVilLbl = null;      // {x,y,name} for the crisp home-villager label this frame
let _homeAwayName = null;    // name of the home's occupant when they're away at work (crisp HTML note)
const IP = { x: VIEW_W/2, y: VIEW_H*0.68, tx: null, ty: null, facing: 1, moving: false, dir:"down" };
const BEACH_BIRDS = [
  { x:6*TILE, y:(17.2+NORTH_EXT)*TILE, vx:0, vy:0, state:"sit", flap:0 },
  { x:34*TILE, y:(17.4+NORTH_EXT)*TILE, vx:0, vy:0, state:"sit", flap:1.4 },
];
// M6: villager runtime state (positions, phase, quip cycling)
const VILLAGER_STATE = VILLAGERS.map(v => {
  const homeObj = V_OBJECTS.find(o => o.id === v.homeId);
  const workObj = V_OBJECTS.find(o => o.id === v.workId);
  const homePos = homeObj
    ? { x: (homeObj.tx + (homeObj.w||2)/2)*TILE, y: (homeObj.ty + (homeObj.h||2))*TILE + 10 }
    : { x: 52*TILE, y: 5*TILE };
  const workPos = workObj
    ? { x: (workObj.tx + (workObj.w||2)/2)*TILE, y: (workObj.ty + (workObj.h||2))*TILE + 10 }
    : homePos;
  return { id:v.id, n:v.n, hair:v.hair, shirt:v.shirt, trouser:v.trouser, female:!!v.female,
           homePos, workPos, workTab: workObj?.tab || null,
           homeId: v.homeId, workId: v.workId, workKind: workObj?.kind || null,
           partner: v.partner || null, children: v.children || [],
           x:homePos.x, y:homePos.y,
           tx:null, ty:null, facing:1, moving:false, dir:"down", indoor:false,
           phase:"sleep", quips:v.quips, quipIdx:0, quipTimer:Math.random()*20, wait:0,
           wanderTimer:Math.random()*2, wTarget:null,
           iwx:0, iwy:0, iwTimer:Math.random()*3, iwTarget:null };
});
let CHAT_NPC = null; // villager the player is talking to inside a building
// Resident NPCs you can talk to inside activity interiors (tap them). Positions are
// the centre of each hardcoded sprite (they only sway a little; the click radius covers it).
const INTERIOR_RESIDENTS = {
  foraging:       { name:"Wren",         x:156, y:80,  lines:["The forest gives freely, if you know where to look.","Mushrooms come up after rain; berries love the sun.","I've foraged these woods forty years, love.","Mind the nettles by the north path."] },
  crafting:       { name:"Marlow",       x:160, y:60, r:46, lines:["Slow hands make fine things.","A good jar of jam keeps you all winter.","Everything on these shelves is made by hand.","Patience — the craft can't be rushed."] },
  bike_shop:      { name:"Cog",          x:130, y:84,  lines:["A well-oiled chain is a happy chain.","Fancy a new set of wheels?","Mind your brakes on the harbour hill."] },
  notice_board:   { name:"Warden Pike",  x:158, y:88,  lines:["Plenty of folk needing a hand today.","Pin your finished jobs up here, if you would.","The whole village runs on favours."] },
  harbour_office: { name:"Reg",          x:136, y:80,  lines:["Tide's fair today.","I can fast-travel you across the bay any time.","Reg's the name; the sea's my game."] },
  fishmonger_wh:  { name:"Pearl",        x:150, y:100, lines:["Freshest catch on the coast.","Sell in bulk and I'll pay a premium.","Pearl by name, pearls of the sea by trade."] },
  village_fund:   { name:"The Committee",x:90,  y:76,  lines:["Every donation makes the valley bloom.","We've grand plans for the village green.","Thank you kindly for your generosity."] },
  contracts:      { name:"Depot Clerk",  x:43,  y:120, lines:["Orders keep piling up — grand for business!","Deliver the goods, collect your coin.","Bigger orders pay the most, mind.","The lorry's due in any minute now."] },
  upgrades:       { name:"The Mayor",    x:160, y:56,  lines:["Welcome to the Town Hall!","Invest your profits — every upgrade pays for itself.","A prosperous founder makes a prosperous valley.","We're always improving Featherstone."] },
};
let _intChat = null; // {name, lines, idx} — the resident NPC you're currently chatting with
// ---- Dialogue system v2: ambient, situational, legible speech bubbles ----
// A villager "speaks" for SPEAK_ON seconds out of every SPEAK_CYCLE, staggered by a
// hash of their id so the town chatters continuously without everyone talking at once.
const SPEAK_CYCLE = 13, SPEAK_ON = 5;
function _idHash(s){ let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0; return h; }
function _dlgCtx(){ return { timeOfDay:_timeOfDay(gameHour()), weather:_weather.type, season:getSeason() }; }
function _speakOffset(v){ return (_idHash(v.id) % 1000) / 1000 * SPEAK_CYCLE; }
// Is this villager mid-utterance right now?
function isSpeaking(v){ return (((Date.now()/1000) + _speakOffset(v)) % SPEAK_CYCLE) < SPEAK_ON; }
// The line a villager is currently saying — stable within one speak window, mixing
// their personal quips with situational lines. Deterministic per window (no flicker).
function speechLine(v){
  const quips = v.quips && v.quips.length ? v.quips : ["..."];
  const win = Math.floor(((Date.now()/1000) + _speakOffset(v)) / SPEAK_CYCLE);
  const quip = quips[Math.abs(win) % quips.length];
  let s = (_idHash(v.id) ^ (win * 2654435761)) >>> 0;
  const rng = () => { s = (s*1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // early emotional hooks: key NPCs greet the player by name / react to the first
  // quest (often before it's done, occasionally after). Only intro NPCs consume the
  // extra roll, so everyone else's chatter is unchanged.
  if (INTRO_NPCS[v.id]){
    const tutDone = !!(S.tut && S.tut.done);
    if (rng() < (tutDone ? 0.3 : 0.7)){
      const _il = _introLine(v.id, tutDone, S.playerName || "friend", rng);
      if (_il) return _il;
    }
  }
  return _pickLine(quip, _dlgCtx(), rng, 0.4);
}
// A crisp, legible speech bubble anchored at screen-percentage (x%,y%) above a head.
function speechBubbleHtml(name, line, xPct, yPct){
  return `<div class="npc-bubble" style="left:${xPct.toFixed(1)}%;top:${yPct.toFixed(1)}%"><span class="nb-name">${name}</span>${esc(line)}</div>`;
}
// ---- Conversations: when two villagers meet, they trade lines back and forth ----
const CONVO_RANGE = 1.8 * TILE;    // how close two villagers must be to chat
const CONVO_TURN = 2.8;            // seconds each line stays up
const CONVO_TURNS = 4;            // lines exchanged before a pause
const CONVO_GAP = 6;             // quiet seconds between exchanges
const CONVO_CYCLE = CONVO_TURNS * CONVO_TURN + CONVO_GAP;
function _convoSeed(a, b){ return _idHash(a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id); }
// The nearest eligible villager to v within chatting range (or null).
function _nearestChatter(v){
  let best = null, bd = CONVO_RANGE;
  for (const o of VILLAGER_STATE){
    if (o === v || o.indoor || o.phase === "sleep" || !o.quips) continue;
    const d = Math.hypot(v.x - o.x, v.y - o.y);
    if (d < bd){ bd = d; best = o; }
  }
  return best;
}
// A conversation only forms when each villager's nearest chatter is the other
// (a clean mutual pair — no love-triangles when three cluster together).
function convoPartner(v){
  const p = _nearestChatter(v);
  if (p && _nearestChatter(p) === v) return p;
  return null;
}
// Whose turn it is right now in a pair's exchange, and what they say. Deterministic
// from the pair seed + wall clock, so both villagers agree without shared state.
// Returns { speaker, line } or null during the quiet gap.
function convoTurn(v, p){
  const a = v.id < p.id ? v : p, b = v.id < p.id ? p : v;
  const seed = _convoSeed(a, b);
  const phase = (((Date.now() / 1000) + (seed % 1000) / 1000 * CONVO_CYCLE) % CONVO_CYCLE);
  if (phase >= CONVO_TURNS * CONVO_TURN) return null;   // between exchanges
  const turn = Math.floor(phase / CONVO_TURN);
  const speaker = (turn % 2 === 0) ? a : b;
  const partner = speaker === a ? b : a;
  const cycleIdx = Math.floor(((Date.now() / 1000) + (seed % 1000) / 1000 * CONVO_CYCLE) / CONVO_CYCLE);
  let s = (seed ^ (cycleIdx * 2654435761) ^ (turn * 40503)) >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return { speaker, line: _convoLine(turn, partner.n, rng) };
}
// Children NPCs — derived from villager family data + extra school children
const CHILDREN_DATA = [
  { id:"ruby",    n:"Ruby",    age:9,  female:true,  hair:"#c9a24b", shirt:"#ff8070", trouser:"#4a5a8a", homeId:"home_03" },
  { id:"tom",     n:"Tom",     age:6,  female:false, hair:"#4a3a2a", shirt:"#5a9adc", trouser:"#3a3a5a", homeId:"home_04" },
  { id:"lily",    n:"Lily",    age:10, female:true,  hair:"#c9a060", shirt:"#7cb46b", trouser:"#3a5a3a", homeId:"home_06" },
  { id:"ben",     n:"Ben",     age:14, female:false, hair:"#5a4a3a", shirt:"#4a7aba", trouser:"#3a3a4a", homeId:"home_12" },
  { id:"sue",     n:"Sue",     age:11, female:true,  hair:"#8a6a2a", shirt:"#e8c9a0", trouser:"#5a3a3a", homeId:"home_12" },
  { id:"max",     n:"Max",     age:5,  female:false, hair:"#5a4a3a", shirt:"#e84a4a", trouser:"#4a4a3a", homeId:"home_12" },
  { id:"daisy",   n:"Daisy",   age:7,  female:true,  hair:"#c9a060", shirt:"#f0b0dc", trouser:"#2a4a6a", homeId:"home_14" },
  { id:"harison", n:"Harison", age:6,  female:false, hair:"#17161a", shirt:"#bfe8f7", trouser:"#3a3a4a", homeId:"home_05" },
  { id:"ethan",   n:"Ethan",   age:8,  female:false, hair:"#6a4a2a", shirt:"#4a9a4a", trouser:"#3a3a4a", homeId:"home_08" },
  { id:"maya",    n:"Maya",    age:10, female:true,  hair:"#3a2a1a", shirt:"#d46b8a", trouser:"#3a3a5a", homeId:"home_09" },
  { id:"finn",    n:"Finn",    age:11, female:false, hair:"#3a3a3a", shirt:"#9a7050", trouser:"#4a5a3a", homeId:"home_10" },
];
const CHILDREN_STATE = CHILDREN_DATA.map((c,i) => {
  const homeObj = V_OBJECTS.find(o => o.id === c.homeId);
  const homePos = homeObj ? { x:(homeObj.tx+(homeObj.w||2)/2)*TILE, y:(homeObj.ty+(homeObj.h||2))*TILE+10 } : { x:60*TILE, y:5*TILE };
  const parkPos = { x:(78+(i%6))*TILE, y:(7+NORTH_EXT+Math.floor(i/6)*1.5)*TILE };
  return { ...c, homePos, parkPos, x:homePos.x, y:homePos.y, phase:"sleep",
           tx:null, ty:null, facing:1, moving:false, dir:"down", wTarget:null, wanderTimer:Math.random()*3 };
});
// Night wildlife
const FOX = { x:42*TILE, y:(8+NORTH_EXT)*TILE, tx:null, ty:null, facing:1, moving:false, dir:"right", wait:0 };
const OWLS = [
  { x:41.4*TILE, y:(1.8+NORTH_EXT)*TILE, blink:0 },
  { x:44.3*TILE, y:(2.8+NORTH_EXT)*TILE, blink:0.7 },
  { x:44.6*TILE, y:(9.8+NORTH_EXT)*TILE, blink:1.4 },
];
const SHARK = { x:28*TILE, y:(21.5+NORTH_EXT)*TILE, vx:0.35 };
const SEASONAL_EVENTS = [
  { id:"xmas_market",    n:"Christmas Market",  msg:"The village Christmas market is open — festive spending is up!",     affects:null,                                       mult:1.28, months:[11,0] },
  { id:"summer_fete",    n:"Summer Fete",        msg:"The summer fete is on — everyone's in a spending mood.",            affects:["sardine","mackerel","bass","wood","plank"], mult:1.20, months:[5,6,7] },
  { id:"harvest_season", n:"Harvest Festival",   msg:"Harvest festival — fresh goods and crafted items flying off stalls.",affects:["bracket","wood","plank","iron_ore"],        mult:1.22, months:[8,9,10] },
];
// 3-day seasonal festival windows (month 0-indexed, real calendar dates)
const FESTIVAL_DEFS: Record<string,{ n:string; ic:string; month:number; day:number; days:number; col:string; col2:string; raffleItems:string[]; feastQty:number }> = {
  spring: { n:"Spring Fair",    ic:"🌸", month:3,  day:15, days:3, col:"#e890d8", col2:"#b8e890", raffleItems:['flower_crown','spring_tonic','blossom_jam'],          feastQty:2 },
  summer: { n:"Summer Fete",    ic:"☀️", month:6,  day:15, days:3, col:"#ffe870", col2:"#ffb830", raffleItems:['lemonade','sun_hat','honey_cake'],                    feastQty:2 },
  autumn: { n:"Harvest Feast",  ic:"🍂", month:9,  day:15, days:3, col:"#e8b060", col2:"#c85010", raffleItems:['spiced_cider','pickled_mushrooms','harvest_wreath'],  feastQty:2 },
  winter: { n:"Winter Market",  ic:"❄️", month:11, day:20, days:5, col:"#b0d8f8", col2:"#5080d0", raffleItems:['mulled_tea','pine_garland','winter_hamper'],           feastQty:2 },
};
// ---- FURNITURE SYSTEM ----
const FURNITURE_DEFS: Record<string,{ n:string; ic:string; price:number; craftIn?:Record<string,number>; w:number; h:number; col:string }> = {
  furn_bed:    { n:"Bed",     ic:"🛏️", price:80,  w:60, h:44, col:"#7a5030" },
  furn_sofa:   { n:"Sofa",    ic:"🛋️", price:60,  w:64, h:28, col:"#8a6a80" },
  furn_tv:     { n:"TV Set",  ic:"📺", price:90,  w:56, h:44, col:"#222222" },
  furn_table:  { n:"Table",   ic:"🪑", price:40,  w:48, h:28, col:"#8a6040", craftIn:{ wood:4, plank:2 } },
  furn_chair:  { n:"Chair",   ic:"🪑", price:20,  w:28, h:28, col:"#7a5a30", craftIn:{ wood:2, plank:1 } },
  furn_rug_sm: { n:"Rug",     ic:"🧩", price:30,  w:64, h:44, col:"#c06830", craftIn:{ wood:3, berries:2 } },
  furn_sink:   { n:"Sink",    ic:"🚰", price:50,  w:28, h:36, col:"#d0d8e0" },
  furn_fridge: { n:"Fridge",  ic:"🧊", price:70,  w:28, h:44, col:"#e0e8f0" },
  furn_shower: { n:"Shower",  ic:"🚿", price:55,  w:28, h:44, col:"#c8d8e8" },
  furn_toilet: { n:"Toilet",  ic:"🚽", price:45,  w:28, h:32, col:"#e8e8e0" },
};
// 9 named room positions inside the myhome interior (INT_W=320, INT_H=200)
const FURN_SPOTS = [
  { slot:0, label:"Back Left",    px:12,  py:54  },
  { slot:1, label:"Back Centre",  px:128, py:54  },
  { slot:2, label:"Back Right",   px:240, py:54  },
  { slot:3, label:"Mid Left",     px:12,  py:104 },
  { slot:4, label:"Mid Centre",   px:128, py:104 },
  { slot:5, label:"Mid Right",    px:240, py:104 },
  { slot:6, label:"Front Left",   px:12,  py:150 },
  { slot:7, label:"Front Centre", px:128, py:150 },
  { slot:8, label:"Front Right",  px:240, py:150 },
];
function addFurniture(id: string, qty: number){
  if (!S.ownedFurniture) S.ownedFurniture = {};
  S.ownedFurniture[id] = (S.ownedFurniture[id]||0) + qty;
}
// ---- END FURNITURE SYSTEM ----
const WORLD_EVENTS = [
  { id:"ore_shortage", n:"Iron Ore Shortage",       msg:"A mine collapse disrupts supply — metal prices soaring.",        affects:["iron_ore","copper_ore","coal","bauxite"], mult:1.35 },
  { id:"fish_glut",    n:"Bumper Catch Season",     msg:"Excellent seas bring record catches — fish prices have fallen.",  affects:["sardine","mackerel","bass","salmon","tuna"], mult:0.72 },
  { id:"trade_fair",   n:"Regional Trade Fair",     msg:"Traders gather from across the region — market prices are up.",  affects:null, mult:1.20 },
  { id:"slowdown",     n:"Economic Slowdown",       msg:"Consumer confidence slips — prices are falling broadly.",        affects:null, mult:0.82 },
  { id:"ore_vein",     n:"New Ore Vein Discovered", msg:"A rich new seam found nearby — ore prices have eased.",          affects:["iron_ore","copper_ore","bauxite"], mult:0.76 },
  { id:"harvest_fest", n:"Harvest Festival",        msg:"The festival draws crowds — stalls doing brisk trade.",          affects:null, mult:1.15 },
  { id:"storm",        n:"Storm Warning Issued",    msg:"Storm approaching — fishing is suspended until it passes.",      affects:["sardine","mackerel","bass","salmon","tuna"], mult:0.58 },
  { id:"craft_demand", n:"Artisan Goods in Demand", msg:"Urban buyers seek crafted items — manufactured goods are rising.",affects:["bracket","gearbox","wiring_loom","chassis","servo_unit"], mult:1.28 },
  { id:"metal_boom",   n:"Construction Boom",       msg:"A city project drives demand — steel and bar prices are rising.",affects:["iron_bar","steel_bar","alu_ingot","tech_alloy"], mult:1.30 },
];
let _weather = { type:"clear", until:0 };
let _tickerX = 576;
function getSeason(){
  const m = new Date().getMonth(); // 0=Jan, 11=Dec
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}
function daysLeftInSeason(){
  const now = new Date(); const m = now.getMonth(); let next;
  if (m >= 2 && m <= 4) next = new Date(now.getFullYear(), 5, 1);
  else if (m >= 5 && m <= 7) next = new Date(now.getFullYear(), 8, 1);
  else if (m >= 8 && m <= 10) next = new Date(now.getFullYear(), 11, 1);
  else { const yr = m === 11 ? now.getFullYear()+1 : now.getFullYear(); next = new Date(yr, 2, 1); }
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / (24*60*60*1000)));
}
function isFestivalActive(){ const d=new Date(),m=d.getMonth(),day=d.getDate(); for(const [season,f] of Object.entries(FESTIVAL_DEFS)){ if(m===f.month&&day>=f.day&&day<f.day+f.days) return { season, ...f }; } return null; }
function daysLeftInFestival(){ const fst=isFestivalActive(); if(!fst) return 0; const d=new Date(),end=new Date(d.getFullYear(),fst.month,fst.day+fst.days); return Math.max(1,Math.ceil((end.getTime()-d.getTime())/(24*60*60*1000))); }
function festivalFriendXpMult(){ return isFestivalActive() ? 2 : 1; }
function getTodayStr(){ return new Date().toISOString().slice(0,10); }
function dailySeed(s){ let h=0; for (let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return Math.abs(h); }
function getDailyChallengeDef(){ return DAILY_CHALLENGE_POOL[dailySeed(getTodayStr()) % DAILY_CHALLENGE_POOL.length]; }
function dailyChallengeProgress(){
  const dc = S.dailyChallenge;
  if (!dc) return { done:false, pct:0, cur:0, max:0 };
  const ch = DAILY_CHALLENGE_POOL.find(c=>c.id===dc.id);
  if (!ch) return { done:false, pct:0, cur:0, max:0 };
  if (ch.type === 'prod'){
    const ids = Object.keys(ch.items);
    let totalCur=0, totalMax=0, allDone=true;
    for (const id of ids){
      const goal = ch.items[id];
      const cur = Math.min(goal, Math.max(0, (S.prod[id]||0) - (dc.baseline?.[id]||0)));
      totalCur += cur; totalMax += goal;
      if (cur < goal) allDone = false;
    }
    return { done:allDone, pct:totalMax>0?totalCur/totalMax:0, cur:totalCur, max:totalMax };
  }
  if (ch.type === 'counter'){
    const cur = Math.min(ch.qty, Math.max(0, (S.counters[ch.counter]||0) - (dc.baselineCounters?.[ch.counter]||0)));
    return { done:cur>=ch.qty, pct:ch.qty>0?cur/ch.qty:0, cur, max:ch.qty };
  }
  if (ch.type === 'coins'){
    const cur = Math.min(ch.qty, Math.max(0, (S.counters.coinsEarned||0) - (dc.baselineCoins||0)));
    return { done:cur>=ch.qty, pct:ch.qty>0?cur/ch.qty:0, cur, max:ch.qty };
  }
  return { done:false, pct:0, cur:0, max:0 };
}
function updateDailyChallenge(){
  const today = getTodayStr();
  if (S.dailyChallenge && S.dailyChallenge.date === today) return;
  const ch = getDailyChallengeDef();
  if (!ch) return;
  const baseline: any = {}, baselineCounters: any = {};
  if (ch.type === 'prod' && ch.items) for (const id of Object.keys(ch.items)) baseline[id] = S.prod[id]||0;
  if (ch.type === 'counter') baselineCounters[ch.counter] = S.counters[ch.counter]||0;
  S.dailyChallenge = { date:today, id:ch.id, baseline, baselineCounters, baselineCoins:ch.type==='coins'?(S.counters.coinsEarned||0):0, claimed:false };
  save();
}
const SEASON_DEFS = {
  spring: { n:"Spring", ic:"🌸", grass:"#8acc7a", skyOverlay:"rgba(255,200,220,.04)", col:"#b8e890", col2:"#d890d8",
    items:['flower_crown','spring_tonic','blossom_jam'], blurb:"The valley blooms. Gather what the hedgerows offer.",
    priceShift:{ wood:1.10, plank:1.10, sardine:1.12, mackerel:1.12, bass:1.10 },
    obs:["🌸 Blossom is on the trees along the valley path.","🌱 Fresh shoots are coming up along the village green.","🐦 The birds have started nesting. Spring is here.","☁️ April showers drift over the ridge. Classic.","🌷 Clara has put out new flower pots along the high street."] },
  summer: { n:"Summer", ic:"☀️", grass:"#7cbf86", skyOverlay:"rgba(255,240,160,.04)", col:"#ffe870", col2:"#ffb830",
    items:['lemonade','sun_hat','honey_cake'], blurb:"Long days and warm nights. The stalls are busy.",
    priceShift:{ sardine:0.85, mackerel:0.85, bass:0.82, iron_ore:0.92, coal:0.80 },
    obs:["☀️ A long bright evening over Featherstone. Peak summer.","🌿 The valley is thick with green — everything's growing.","🍦 The days are long and warm. Even the furnace feels bearable.","🌞 Barely a cloud. The mountains are sharp on the horizon.","🦋 Butterflies over the park. The kids are loving this weather."] },
  autumn: { n:"Autumn", ic:"🍂", grass:"#a8a858", skyOverlay:"rgba(200,140,60,.06)", col:"#e8b060", col2:"#c85010",
    items:['spiced_cider','pickled_mushrooms','harvest_wreath'], blurb:"The harvest is in. Preserve and pickle before the frost.",
    priceShift:{ wood:1.18, plank:1.18, bracket:1.14, gearbox:1.14, iron_ore:1.08 },
    obs:["🍂 Leaves are coming down. The valley's gone copper and gold.","🍁 A sharp autumn morning — ground's already crunchy.","🌫️ Early mist in the valley. Classic October.","🍄 Frank found a huge fungus in the north wood. He's showing everyone.","🦔 Gracie spotted a hedgehog under the barn hedge last night."] },
  winter: { n:"Winter", ic:"❄️", grass:"#c0cc99", skyOverlay:"rgba(160,190,230,.09)", col:"#b0d8f8", col2:"#5080d0",
    items:['mulled_tea','pine_garland','winter_hamper'], blurb:"Frost on the panes. Warm gifts are worth more.",
    priceShift:{ coal:1.35, iron_ore:1.20, sardine:1.22, mackerel:1.18, bass:1.15 },
    obs:["❄️ A proper frost this morning. Puddles crackled underfoot.","🌨️ Light snow expected by evening over the ridge.","🧥 Agnes has put the thick coat on — it's properly cold now.","🕯️ The lamplights look especially warm on a winter evening.","☃️ The kids built a snowman on the green. Max is delighted."] },
};
function seasonMult(it){
  const _ps = SEASON_DEFS[getSeason()].priceShift;
  return (_ps && _ps[it]) || 1;
}
let _snowflakes = [];
let _autumnLeaves = [];
let _blossomPetals = [];
let _lastSeason = "";
const HOME_TIERS = [
  { n:"Basic Cottage",  desc:"A simple roof and walls. Humble but yours.",            cost:0     },
  { n:"Furnished",      desc:"A bookshelf, kitchen table, and a proper rug.",         cost:250   },
  { n:"Comfortable",    desc:"An armchair, a real fireplace, and a better bed.",       cost:1000  },
  { n:"Homely",         desc:"Cabinets, wall art, and a cosy reading nook.",           cost:4000  },
  { n:"Grand Cottage",  desc:"The finest cottage in the valley. Everything you need.", cost:12000 },
];
const GARDEN_CROPS = [
  { id:'berry_bush',   n:'Berry Bush',    ic:'🫐', seedCost:15,  ms:20*60*1000, out:{berries:6},              desc:'Juicy berries. Jams and requests.' },
  { id:'herb_patch',   n:'Herb Patch',    ic:'🌿', seedCost:20,  ms:30*60*1000, out:{wild_herb:4},             desc:'Aromatic herbs for teas and tonics.' },
  { id:'mushroom_log', n:'Mushroom Log',  ic:'🍄', seedCost:25,  ms:45*60*1000, out:{mushroom:5},              desc:'Grows best in shade. Steady yield.' },
  { id:'wildflower',   n:'Wildflowers',   ic:'🌸', seedCost:30,  ms:60*60*1000, out:{berries:3, wild_herb:2},  desc:'Pretty and useful. Bees love them.' },
];
function plotsUnlocked(tier: number){ return Math.min(4, Math.max(0, tier)); }
const DELIVERY_POOL = ["iron_ore","copper_ore","coal","iron_bar","steel_bar","bracket","wood","plank","sardine","mackerel","bass","wiring_loom","gearbox"];
let _heartbeatAt = 0;
const _heartbeatCD = {};
const HEARTBEAT_POOL = [
  { id:"lemonade", w:4, fn:()=>{
    if (!lemonadeOpen()) return null;
    if (!S.school) S.school = { raised:0, notifiedTier:0 };
    S.school.raised += LEMONADE.price;   // a passer-by buys one; proceeds go to the school
    checkSchoolTier();
    const _v = VILLAGERS[Math.floor(Math.random()*VILLAGERS.length)];
    const _c = ["Refreshing!","Just the ticket on a warm day.","For a good cause, too.","Mmm — tart and sweet.","The little ones make a grand lemonade.","Keep the change, kids!"];
    return `🍋 ${_v.n} bought a lemonade — "${_c[Math.floor(Math.random()*_c.length)]}"`;
  }},
  { id:"v_life", w:3, fn:()=>{
    const _vs = VILLAGER_STATE.filter(v=>!v.indoor&&v.phase!=="sleep");
    if (!_vs.length) return null;
    const _v = VILLAGERS.find(vl=>vl.id===_vs[Math.floor(Math.random()*_vs.length)].id);
    if (!_v) return null;
    const _acts=["heads to work","waves to a neighbour","stops to check the sky","is deep in thought","crosses the path purposefully"];
    return "👀 " + _v.n + " " + _acts[Math.floor(Math.random()*_acts.length)] + ".";
  }},
  { id:"mkt_flash", w:2, fn:()=>{
    if (!S.market) return null;
    const _npc=NPCS[Math.floor(Math.random()*NPCS.length)];
    const _it=_npc.stock[Math.floor(Math.random()*_npc.stock.length)];
    const _d=S.market.drift[_npc.id]&&S.market.drift[_npc.id][_it];
    if (!_d) return null;
    if (_d>1.12) return "📊 " + ITEMS[_it].n + " prices ▲" + Math.round((_d-1)*100) + "% at " + _npc.n + "'s.";
    if (_d<0.88) return "📊 " + ITEMS[_it].n + " prices ▼" + Math.round((1-_d)*100) + "% at " + _npc.n + "'s.";
    return null;
  }},
  { id:"pet_mom", w:2, fn:()=>{
    if (!S.pets.active) return null;
    const _pet=PETS.find(p=>p.id===S.pets.active);
    if (!_pet) return null;
    const _acts=["sniffs the air","does a little spin","watches a butterfly","yawns contentedly","trots happily by your side"];
    return "🐾 " + _pet.n + " " + _acts[Math.floor(Math.random()*_acts.length)] + ".";
  }},
  { id:"weather", w:2, fn:()=>{
    if (_weather.type==="rain") return "🌧️ The rain patters steadily across the valley.";
    if (_weather.type==="fog")  return "🌫️ Fog hangs low over the rooftops today.";
    if (_weather.type==="overcast") return "☁️ Grey skies over the valley — but dry, at least.";
    const _h=gameHour();
    if (_h>=22||_h<6) return "🌙 Stars are bright over Featherstone tonight.";
    if (_h>=6&&_h<9) return "🌅 A fine morning. The valley is waking up.";
    if (_h>=17&&_h<20) return "🌇 The sun is getting low over the ridge.";
    return null;
  }},
  { id:"season", w:3, fn:()=>{
    const _sd=SEASON_DEFS[getSeason()]; if (!_sd) return null;
    return _sd.obs[Math.floor(Math.random()*_sd.obs.length)];
  }},
  { id:"tip", w:1, fn:()=>{
    const _tips=["💡 The Café gives a 20% speed boost for 5 minutes — worth it.","💡 World events shift market prices. Keep an eye on the ticker!","💡 Villagers post delivery requests — look for the green badge above them.","💡 Your Cottage can be upgraded. Visit it east of town.","💡 Rain affects the vibe. Fishing during a storm? Brave.","💡 Seasons affect prices — coal and fish are pricier in winter.","💡 The University offers permanent XP boosts. Worth the investment.","💡 The Exchange Floor lets you speculate on commodity prices using world events."];
    return _tips[Math.floor(Math.random()*_tips.length)];
  }},
];
const INTERIOR_TABS = new Set(["mining","steelworks","manufacturing","crafting","contracts","trade","pets","upgrades","ach","woodcutting","fishing","foraging","home","school","cafe","myhome","bank","exchange","university","retail","postoffice","estateagent","lore_stone","bike_shop","notice_board","harbour_office","boat_hire","fishmonger_wh","village_fund","seasonal_market","furniture_shop","pub","police_station","police_cell","nightclub","robotics_lab","data_centre"]);
const PROPERTIES = [
  { id:"cottage_a", n:"Valley Cottage",   desc:"A cosy rental by the river. Reliable steady yield.",   cost:3000,  rent:2  },
  { id:"flat_b",    n:"Market Flat",      desc:"Above the market hall. High footfall, good yield.",     cost:10000, rent:8  },
  { id:"manor_c",   n:"Featherstone Manor", desc:"The grand estate on the hill. Premium rental income.",  cost:35000, rent:25 },
];
// Village beautification — 50 projects across 5 categories. Total prestige: 209. Total cost: ~500k.
const BEAUTIFICATION = [
  // 🌸 Gardens & Greenery
  { id:"window_boxes",      cat:"Gardens",    ic:"🪴", n:"Window Boxes",           cost:150,   prestige:1,  ds:"Colourful blooms in every cottage window." },
  { id:"herb_planters",     cat:"Gardens",    ic:"🌿", n:"Herb Planters",           cost:250,   prestige:1,  ds:"Rosemary and thyme line the market lane." },
  { id:"rose_archway",      cat:"Gardens",    ic:"🌹", n:"Rose Archway",            cost:450,   prestige:2,  ds:"Climbing roses frame the market entrance." },
  { id:"cottage_gardens",   cat:"Gardens",    ic:"🏡", n:"Cottage Gardens",         cost:700,   prestige:2,  ds:"Villagers tend their front patches with pride." },
  { id:"village_green",     cat:"Gardens",    ic:"🌱", n:"Village Green Turf",      cost:1200,  prestige:3,  ds:"Fresh grass seeded on the village green." },
  { id:"wildflower_meadow", cat:"Gardens",    ic:"🌼", n:"Wildflower Meadow",       cost:2000,  prestige:3,  ds:"A wildflower strip along the north forest path." },
  { id:"kitchen_garden",    cat:"Gardens",    ic:"🥬", n:"Kitchen Garden",          cost:3500,  prestige:4,  ds:"A communal vegetable patch behind the café." },
  { id:"topiary_bushes",    cat:"Gardens",    ic:"🌲", n:"Topiary Bushes",          cost:6000,  prestige:5,  ds:"Clipped into the shapes of valley animals." },
  { id:"cherry_trees",      cat:"Gardens",    ic:"🌸", n:"Cherry Blossom Trees",    cost:10000, prestige:6,  ds:"Pink blossoms drift across the high street in spring." },
  { id:"manor_gardens",     cat:"Gardens",    ic:"🏰", n:"Manor Gardens",           cost:22000, prestige:8,  ds:"Formal hedged gardens behind the estate agent." },
  // 🪨 Paths & Infrastructure
  { id:"gravel_paths",      cat:"Paths",      ic:"🪨", n:"Gravel Paths",            cost:200,   prestige:1,  ds:"Neat gravel laid between the market stalls." },
  { id:"village_signpost",  cat:"Paths",      ic:"🪧", n:"Village Signpost",        cost:300,   prestige:1,  ds:"Points the way to the quarry, pier and forest." },
  { id:"stone_kerbs",       cat:"Paths",      ic:"🧱", n:"Stone Kerbs",             cost:550,   prestige:2,  ds:"Raised stone edges tidy up the lane." },
  { id:"nb_oak_frame",      cat:"Paths",      ic:"📋", n:"Notice Board Oak Frame",  cost:800,   prestige:2,  ds:"A proper carved oak frame for the notice board." },
  { id:"cobblestone_sq",    cat:"Paths",      ic:"🔲", n:"Cobblestone Square",      cost:1600,  prestige:3,  ds:"Hand-laid cobbles around the market area." },
  { id:"drystone_walls",    cat:"Paths",      ic:"🧱", n:"Dry Stone Walls",         cost:2800,  prestige:4,  ds:"Traditional walls separate the fields and lanes." },
  { id:"picket_fences",     cat:"Paths",      ic:"🏡", n:"Picket Fences",           cost:4000,  prestige:4,  ds:"White-painted picket fences around the cottages." },
  { id:"stone_gateposts",   cat:"Paths",      ic:"🏛️", n:"Stone Gateposts",        cost:7000,  prestige:5,  ds:"Carved stone posts mark the village entrance." },
  { id:"cobbled_high_st",   cat:"Paths",      ic:"🏗️", n:"Cobbled High Street",    cost:14000, prestige:7,  ds:"Full hand-laid cobbling of the entire high street." },
  { id:"village_arch",      cat:"Paths",      ic:"🏛️", n:"Village Arch",           cost:32000, prestige:9,  ds:"A grand stone arch over the main road into Featherstone." },
  // 💡 Lighting & Atmosphere
  { id:"candle_lanterns",   cat:"Lighting",   ic:"🕯️", n:"Candle Lanterns",        cost:280,   prestige:1,  ds:"Lanterns hung from market stall awnings." },
  { id:"window_lights",     cat:"Lighting",   ic:"🪟", n:"Window Lights",           cost:420,   prestige:2,  ds:"Warm amber glow from cottage windows at dusk." },
  { id:"fairy_lights",      cat:"Lighting",   ic:"✨", n:"Fairy Lights",            cost:900,   prestige:2,  ds:"Strung between the trees along the high street." },
  { id:"iron_lamp_posts",   cat:"Lighting",   ic:"🏮", n:"Iron Lamp Posts",         cost:1400,  prestige:3,  ds:"Old-fashioned cast iron lamps along the lane." },
  { id:"harbour_lanterns",  cat:"Lighting",   ic:"🏮", n:"Harbour Lanterns",        cost:2400,  prestige:3,  ds:"A string of lanterns along the harbour dock." },
  { id:"forest_path_lights",cat:"Lighting",   ic:"🌲", n:"Forest Path Lights",      cost:3800,  prestige:4,  ds:"Softlit posts mark the north forest path at night." },
  { id:"market_sq_lamps",   cat:"Lighting",   ic:"💡", n:"Market Square Lamps",     cost:6500,  prestige:5,  ds:"A ring of lamps illuminates the market square." },
  { id:"fountain_lights",   cat:"Lighting",   ic:"💧", n:"Illuminated Fountain",    cost:9000,  prestige:6,  ds:"The stone fountain glows amber after dark." },
  { id:"gas_street_lights", cat:"Lighting",   ic:"🔆", n:"Gas Street Lighting",     cost:18000, prestige:7,  ds:"Full gas lighting across every Featherstone street." },
  { id:"beacon_tower",      cat:"Lighting",   ic:"🗼", n:"Beacon Tower",            cost:45000, prestige:10, ds:"A lit tower visible for miles at sea. Sailors call it home." },
  // 🐦 Wildlife & Nature
  { id:"bird_boxes",        cat:"Wildlife",   ic:"🐦", n:"Bird Boxes",              cost:180,   prestige:1,  ds:"Mounted on every cottage gable end." },
  { id:"bat_houses",        cat:"Wildlife",   ic:"🦇", n:"Bat Houses",              cost:320,   prestige:1,  ds:"Evening visitors help with the insects." },
  { id:"hedgehog_hotel",    cat:"Wildlife",   ic:"🦔", n:"Hedgehog Hotel",          cost:520,   prestige:2,  ds:"A sheltered corner behind Wren's Forager Hut." },
  { id:"bee_hives",         cat:"Wildlife",   ic:"🐝", n:"Bee Hives",               cost:950,   prestige:2,  ds:"Local honey on the café menu and better forest pollination." },
  { id:"butterfly_garden",  cat:"Wildlife",   ic:"🦋", n:"Butterfly Garden",        cost:1500,  prestige:3,  ds:"Buddleia and lavender planted near the school." },
  { id:"duck_pond",         cat:"Wildlife",   ic:"🦆", n:"Duck Pond",               cost:2600,  prestige:4,  ds:"Ducks take up residence on the village green." },
  { id:"squirrel_feeders",  cat:"Wildlife",   ic:"🐿️", n:"Squirrel Feeders",       cost:4200,  prestige:4,  ds:"The north forest children love watching them." },
  { id:"owl_boxes",         cat:"Wildlife",   ic:"🦉", n:"Owl Boxes",               cost:7500,  prestige:5,  ds:"Barn owls nest in the old mill rafters." },
  { id:"deer_path",         cat:"Wildlife",   ic:"🦌", n:"Deer Path",               cost:13000, prestige:6,  ds:"A corridor through the forest for red deer." },
  { id:"wildlife_reserve",  cat:"Wildlife",   ic:"🌿", n:"Wildlife Reserve",        cost:28000, prestige:9,  ds:"A protected strip of the north forest. Frank loves it." },
  // 🏛️ Landmarks & Prestige
  { id:"village_bench",     cat:"Landmarks",  ic:"🪑", n:"Village Bench",           cost:380,   prestige:1,  ds:"Agnes likes to sit here of an afternoon." },
  { id:"wishing_well",      cat:"Landmarks",  ic:"🪣", n:"Wishing Well",            cost:750,   prestige:2,  ds:"Three coins in for luck. People actually believe it." },
  { id:"sundial",           cat:"Landmarks",  ic:"☀️", n:"Sundial",                 cost:1100,  prestige:3,  ds:"Erected by the school. It's mostly right." },
  { id:"war_memorial",      cat:"Landmarks",  ic:"🏛️", n:"War Memorial",           cost:1900,  prestige:3,  ds:"Names of the valley's fallen, carved in stone." },
  { id:"bandstand",         cat:"Landmarks",  ic:"🎶", n:"Bandstand",               cost:4500,  prestige:5,  ds:"Summer concerts on the village green." },
  { id:"water_fountain",    cat:"Landmarks",  ic:"⛲", n:"Stone Fountain",           cost:8000,  prestige:6,  ds:"A stone drinking fountain in the market square." },
  { id:"community_orchard", cat:"Landmarks",  ic:"🍎", n:"Community Orchard",       cost:15000, prestige:7,  ds:"Apple, pear and plum — free for all villagers." },
  { id:"clock_tower",       cat:"Landmarks",  ic:"🕰️", n:"Clock Tower",             cost:38000, prestige:9,  ds:"Featherstone's landmark. The whole valley tells the time by it." },
  { id:"village_hall",      cat:"Landmarks",  ic:"🏛️", n:"Village Hall Restoration",cost:65000, prestige:10, ds:"The old hall, fully restored. Featherstone's pride." },
  { id:"valley_monument",   cat:"Landmarks",  ic:"🗿", n:"Valley Monument",         cost:110000,prestige:10, ds:"A grand stone monument to the heritage of the valley." },
];
const PRESTIGE_THRESHOLDS = [
  { at:15,  coinsPm:1,  label:"+1 coin/min from village prestige" },
  { at:30,  friendXpPct:5,  label:"+5% friendship XP on all interactions" },
  { at:50,  coinsPm:2,  label:"+2 coins/min" },
  { at:70,  xpPct:5,    label:"+5% all skill XP" },
  { at:90,  coinsPm:3,  label:"+3 coins/min" },
  { at:120, friendXpPct:10, label:"+10% friendship XP" },
  { at:150, coinsPm:5,  label:"+5 coins/min" },
  { at:175, rentPct:5,  label:"+5% rent income" },
  { at:200, coinsPm:5,  label:"+5 coins/min" },
];
const SEASONAL_ITEMS = ['flower_crown','spring_tonic','blossom_jam','lemonade','sun_hat','honey_cake','spiced_cider','pickled_mushrooms','harvest_wreath','mulled_tea','pine_garland','winter_hamper'];
const DAILY_CHALLENGE_POOL = [
  { id:'ch_mine_iron',     type:'prod',    items:{iron_ore:12},                  reward:120, ic:'⛏️', ds:'Mine 12 Iron Ore.' },
  { id:'ch_mine_coal',     type:'prod',    items:{coal:10},                      reward:140, ic:'⚫', ds:'Dig 10 Coal.' },
  { id:'ch_mine_rare',     type:'prod',    items:{rare_earth:3},                 reward:280, ic:'💎', ds:'Extract 3 Rare Earths.' },
  { id:'ch_smelt_iron',    type:'prod',    items:{iron_bar:8},                   reward:160, ic:'🔩', ds:'Smelt 8 Iron Bars.' },
  { id:'ch_smelt_steel',   type:'prod',    items:{steel_bar:5},                  reward:220, ic:'⛓️', ds:'Smelt 5 Steel Bars.' },
  { id:'ch_forge_alloy',   type:'prod',    items:{tech_alloy:2},                 reward:320, ic:'✨', ds:'Forge 2 Tech Alloys.' },
  { id:'ch_make_bracket',  type:'prod',    items:{bracket:8},                    reward:130, ic:'🧱', ds:'Press 8 Brackets.' },
  { id:'ch_make_gearbox',  type:'prod',    items:{gearbox:3},                    reward:200, ic:'⚙️', ds:'Assemble 3 Gearboxes.' },
  { id:'ch_make_sensor',   type:'prod',    items:{sensor:2},                     reward:300, ic:'📡', ds:'Assemble 2 Sensors.' },
  { id:'ch_deliver_3',     type:'counter', counter:'contracts',         qty:3,   reward:220, ic:'🚚', ds:'Complete 3 contracts.' },
  { id:'ch_deliver_5',     type:'counter', counter:'contracts',         qty:5,   reward:380, ic:'🚚', ds:'Complete 5 contracts.' },
  { id:'ch_trade_10',      type:'counter', counter:'trades',            qty:10,  reward:150, ic:'⚖️', ds:'Make 10 market trades.' },
  { id:'ch_earn_600',      type:'coins',                                qty:600, reward:180, ic:'💰', ds:'Earn 600 coins from any source.' },
  { id:'ch_chop_wood',     type:'prod',    items:{wood:15},                      reward:120, ic:'🪵', ds:'Chop 15 Wood.' },
  { id:'ch_fell_rare',     type:'prod',    items:{rare_wood:4},                  reward:240, ic:'🌟', ds:'Fell 4 Rare Trees.' },
  { id:'ch_fish_sardine',  type:'prod',    items:{sardine:10},                   reward:110, ic:'🐟', ds:'Catch 10 Sardines.' },
  { id:'ch_fish_mackerel', type:'prod',    items:{mackerel:6},                   reward:140, ic:'🐠', ds:'Catch 6 Mackerel.' },
  { id:'ch_fish_salmon',   type:'prod',    items:{salmon:3},                     reward:230, ic:'🍣', ds:'Catch 3 Salmon.' },
  { id:'ch_forage_berries',type:'prod',    items:{berries:15},                   reward:120, ic:'🫐', ds:'Gather 15 Forest Berries.' },
  { id:'ch_forage_herb',   type:'prod',    items:{wild_herb:8},                  reward:150, ic:'🌿', ds:'Collect 8 Wild Herbs.' },
  { id:'ch_forage_mush',   type:'prod',    items:{mushroom:10},                  reward:130, ic:'🍄', ds:'Pick 10 Wild Mushrooms.' },
  { id:'ch_craft_jam',     type:'prod',    items:{berry_jam:3},                  reward:190, ic:'🫙', ds:'Pot 3 Berry Jams.' },
  { id:'ch_craft_basket',  type:'prod',    items:{gift_basket:2},                reward:300, ic:'🧺', ds:'Weave 2 Gift Baskets.' },
  { id:'ch_craft_smoked',  type:'prod',    items:{smoked_fish:3},                reward:220, ic:'🐡', ds:'Smoke 3 Fish.' },
  { id:'ch_request_2',     type:'counter', counter:'requestsFulfilled', qty:2,   reward:210, ic:'💌', ds:'Fulfil 2 villager personal requests.' },
  { id:'ch_fish_smoke',    type:'prod',    items:{mackerel:4, smoked_fish:2},    reward:280, ic:'🎣', ds:'Catch 4 Mackerel and smoke 2 Fish.' },
  { id:'ch_forage_craft',  type:'prod',    items:{berries:10, berry_jam:2},      reward:230, ic:'🫐', ds:'Gather 10 Berries and pot 2 Berry Jams.' },
  { id:'ch_mine_smelt',    type:'prod',    items:{iron_ore:10, iron_bar:4},      reward:230, ic:'⛏️', ds:'Mine 10 Ore and smelt 4 Iron Bars.' },
  { id:'ch_chop_craft',    type:'prod',    items:{wood:8, herb_tea:2},           reward:200, ic:'🪵', ds:'Chop 8 Wood and blend 2 Herb Teas.' },
];
const PERK_DEFS: Record<string,any> = {
  // Mining
  lucky_strike:    { label:'Lucky Strike',      ds:'15% chance of an extra ore per action.',      type:'yield',   val:0.15, skill:'mining' },
  seam_reader:     { label:'Seam Reader',        ds:'Mining actions are 15% faster.',              type:'speed',   val:0.15, skill:'mining' },
  motherlode:      { label:'Motherlode',         ds:'7% chance of triple ore output.',             type:'yield3',  val:0.07, skill:'mining' },
  iron_lungs:      { label:'Iron Lungs',         ds:'Gain 20% more Mining XP.',                   type:'xp',      val:0.20, skill:'mining' },
  deep_core:       { label:'Deep Core',          ds:'25% chance of an extra ore per action.',     type:'yield',   val:0.25, skill:'mining' },
  efficient_blast: { label:'Efficient Blast',    ds:'Mining actions are 25% faster.',             type:'speed',   val:0.25, skill:'mining' },
  // Steelworks
  slag_return:     { label:'Slag Return',        ds:'15% chance of an extra bar per smelt.',      type:'yield',   val:0.15, skill:'steelworks' },
  furnace_master:  { label:'Furnace Master',     ds:'Steelworks actions are 15% faster.',         type:'speed',   val:0.15, skill:'steelworks' },
  perfect_alloy:   { label:'Perfect Alloy',      ds:'10% chance of double bar output.',           type:'yield',   val:0.10, skill:'steelworks' },
  flux_economy:    { label:'Flux Economy',       ds:'Steelworks inputs cost 1 less (min 1).',     type:'effcost', val:1,    skill:'steelworks' },
  grand_forge:     { label:'Grand Forge',        ds:'Steelworks actions are 25% faster.',         type:'speed',   val:0.25, skill:'steelworks' },
  double_batch:    { label:'Double Batch',       ds:'20% chance of double bar output.',           type:'yield',   val:0.20, skill:'steelworks' },
  // Manufacturing
  assembly_line:   { label:'Assembly Line',      ds:'Manufacturing actions are 15% faster.',      type:'speed',   val:0.15, skill:'manufacturing' },
  precision_fit:   { label:'Precision Fit',      ds:'12% chance of double component output.',     type:'yield',   val:0.12, skill:'manufacturing' },
  quality_control: { label:'Quality Control',    ds:'Gain 20% more Manufacturing XP.',            type:'xp',      val:0.20, skill:'manufacturing' },
  lean_prod:       { label:'Lean Production',    ds:'Manufacturing inputs cost 1 less (min 1).',  type:'effcost', val:1,    skill:'manufacturing' },
  turbo_press:     { label:'Turbo Press',        ds:'Manufacturing actions are 25% faster.',      type:'speed',   val:0.25, skill:'manufacturing' },
  master_builder:  { label:'Master Builder',     ds:'20% chance of double component output.',     type:'yield',   val:0.20, skill:'manufacturing' },
  // Logistics
  fast_lane:       { label:'Fast Lane',          ds:'Contract payouts are 10% higher.',           type:'pay',     val:0.10, skill:'logistics' },
  bulk_deals:      { label:'Bulk Deals',         ds:'Earn 20% more Logistics XP.',                type:'xp',      val:0.20, skill:'logistics' },
  premium_client:  { label:'Premium Client',     ds:'Contract payouts are 20% higher.',           type:'pay',     val:0.20, skill:'logistics' },
  route_planner:   { label:'Route Planner',      ds:'Earn 30% more Logistics XP.',                type:'xp',      val:0.30, skill:'logistics' },
  trade_empire:    { label:'Trade Empire',       ds:'Contract payouts are 30% higher.',           type:'pay',     val:0.30, skill:'logistics' },
  load_master:     { label:'Load Master',        ds:'Earn 40% more Logistics XP.',                type:'xp',      val:0.40, skill:'logistics' },
  // Trading
  sharp_eye:       { label:'Sharp Eye',          ds:'Sell prices are 10% better.',                type:'sell',    val:0.10, skill:'trading' },
  bulk_discount:   { label:'Bulk Discount',      ds:'Buy prices are 10% lower.',                  type:'buy',     val:0.10, skill:'trading' },
  market_sense:    { label:'Market Sense',       ds:'Sell prices are 20% better.',                type:'sell',    val:0.20, skill:'trading' },
  savvy_buyer:     { label:'Savvy Buyer',        ds:'Buy prices are 20% lower.',                  type:'buy',     val:0.20, skill:'trading' },
  merchant_prince: { label:'Merchant Prince',    ds:'Sell prices are 30% better.',                type:'sell',    val:0.30, skill:'trading' },
  arbitrage:       { label:'Arbitrage',          ds:'Sell +15%, buy −10% simultaneously.',        type:'arb',     sell:0.15, buy:0.10, skill:'trading' },
  // Woodcutting
  keen_edge:       { label:'Keen Edge',          ds:'Woodcutting actions are 15% faster.',        type:'speed',   val:0.15, skill:'woodcutting' },
  timber_eye:      { label:'Timber Eye',         ds:'15% chance of an extra wood per chop.',      type:'yield',   val:0.15, skill:'woodcutting' },
  lumber_jack:     { label:'Lumber Jack',        ds:'Woodcutting actions are 20% faster.',        type:'speed',   val:0.20, skill:'woodcutting' },
  grove_sense:     { label:'Grove Sense',        ds:'20% chance of an extra wood per chop.',      type:'yield',   val:0.20, skill:'woodcutting' },
  clear_cut:       { label:'Clear Cut',          ds:'Woodcutting actions are 30% faster.',        type:'speed',   val:0.30, skill:'woodcutting' },
  rare_spotter:    { label:'Rare Spotter',       ds:'25% chance of an extra wood per chop.',      type:'yield',   val:0.25, skill:'woodcutting' },
  // Fishing
  steady_hand:     { label:'Steady Hand',        ds:'Fishing actions are 15% faster.',            type:'speed',   val:0.15, skill:'fishing' },
  lucky_cast:      { label:'Lucky Cast',         ds:'15% chance of an extra fish per catch.',     type:'yield',   val:0.15, skill:'fishing' },
  calm_waters:     { label:'Calm Waters',        ds:'Fishing actions are 25% faster.',            type:'speed',   val:0.25, skill:'fishing' },
  big_haul:        { label:'Big Haul',           ds:'20% chance of double fish per catch.',       type:'yield',   val:0.20, skill:'fishing' },
  deep_fisher:     { label:'Deep Fisher',        ds:'Fishing actions are 30% faster.',            type:'speed',   val:0.30, skill:'fishing' },
  legend_catch:    { label:'Legend Catch',       ds:'25% chance of double fish per catch.',       type:'yield',   val:0.25, skill:'fishing' },
  // Foraging
  forest_eye:      { label:'Forest Eye',         ds:'Foraging actions are 15% faster.',           type:'speed',   val:0.15, skill:'foraging' },
  bountiful_pick:  { label:'Bountiful Pick',     ds:'15% chance of double forage per gather.',    type:'yield',   val:0.15, skill:'foraging' },
  hedge_wisdom:    { label:'Hedge Wisdom',       ds:'Foraging actions are 20% faster.',           type:'speed',   val:0.20, skill:'foraging' },
  wild_bounty:     { label:'Wild Bounty',        ds:'20% chance of double forage per gather.',    type:'yield',   val:0.20, skill:'foraging' },
  grove_mastery:   { label:'Grove Mastery',      ds:'Foraging actions are 30% faster.',           type:'speed',   val:0.30, skill:'foraging' },
  natures_gift:    { label:"Nature's Gift",      ds:"25% chance of double forage per gather.",    type:'yield',   val:0.25, skill:'foraging' },
  // Crafting
  steady_craft:    { label:'Steady Craft',       ds:'Crafting actions are 15% faster.',           type:'speed',   val:0.15, skill:'crafting' },
  artisan_luck:    { label:'Artisan Luck',       ds:'15% chance of crafting two items.',          type:'yield',   val:0.15, skill:'crafting' },
  refined_touch:   { label:'Refined Touch',      ds:'Gain 20% more Crafting XP.',                 type:'xp',      val:0.20, skill:'crafting' },
  material_sense:  { label:'Material Sense',     ds:'Crafting inputs cost 1 less (min 1).',       type:'effcost', val:1,    skill:'crafting' },
  master_craft:    { label:'Master Craft',       ds:'25% chance of crafting two items.',          type:'yield',   val:0.25, skill:'crafting' },
  festival_flair:  { label:'Festival Flair',     ds:'Festival sell price +25% for seasonal items.',type:'festival',val:0.25, skill:'crafting' },
};
const SKILL_PERKS: Record<string,Record<number,string[]>> = {
  mining:        { 10:['lucky_strike','seam_reader'],    25:['motherlode','iron_lungs'],        40:['deep_core','efficient_blast']  },
  steelworks:    { 10:['slag_return','furnace_master'],   25:['perfect_alloy','flux_economy'],   40:['grand_forge','double_batch']   },
  manufacturing: { 10:['assembly_line','precision_fit'],  25:['quality_control','lean_prod'],    40:['turbo_press','master_builder'] },
  logistics:     { 10:['fast_lane','bulk_deals'],         25:['premium_client','route_planner'], 40:['trade_empire','load_master']   },
  trading:       { 10:['sharp_eye','bulk_discount'],      25:['market_sense','savvy_buyer'],     40:['merchant_prince','arbitrage']  },
  woodcutting:   { 10:['keen_edge','timber_eye'],         25:['lumber_jack','grove_sense'],      40:['clear_cut','rare_spotter']     },
  fishing:       { 10:['steady_hand','lucky_cast'],       25:['calm_waters','big_haul'],         40:['deep_fisher','legend_catch']   },
  foraging:      { 10:['forest_eye','bountiful_pick'],    25:['hedge_wisdom','wild_bounty'],     40:['grove_mastery','natures_gift'] },
  crafting:      { 10:['steady_craft','artisan_luck'],    25:['refined_touch','material_sense'], 40:['master_craft','festival_flair']},
};
function hasPerk(id: string){ return Object.values(S.perks||{}).includes(id); }
function pendingPerk(skill: string){
  if (!SKILL_PERKS[skill]) return null;
  const lvl = skillLvl(skill);
  for (const t of [10,25,40]) if (lvl >= t && !(S.perks?.[skill+'_'+t])) return t;
  return null;
}
function skillSpeedBonus(skill: string){ return [10,25,40].reduce((s,t)=>{ const d=PERK_DEFS[S.perks?.[skill+'_'+t]]; return s+(d&&d.type==='speed'?d.val:0); },0); }
function skillXpBonus(skill: string){    return [10,25,40].reduce((s,t)=>{ const d=PERK_DEFS[S.perks?.[skill+'_'+t]]; return s+(d&&d.type==='xp'   ?d.val:0); },0); }
function perkPayBonus(){  return [10,25,40].reduce((s,t)=>{ const d=PERK_DEFS[S.perks?.['logistics_'+t]]; return s+(d&&d.type==='pay'?d.val:0); },0) + keepsakePayBonus(); }
function perkSellBonus(){ return [10,25,40].reduce((s,t)=>{ const d=PERK_DEFS[S.perks?.['trading_'+t]]; return s+(d?(d.type==='sell'?d.val:d.type==='arb'?d.sell:0):0); },0) + keepsakeSellBonus(); }
function perkBuyDiscount(){ return Math.min(0.50,[10,25,40].reduce((s,t)=>{ const d=PERK_DEFS[S.perks?.['trading_'+t]]; return s+(d?(d.type==='buy'?d.val:d.type==='arb'?d.buy:0):0); },0)); }
function perkEffcostActive(skill: string){ return [10,25,40].some(t=>{ const d=PERK_DEFS[S.perks?.[skill+'_'+t]]; return d&&d.type==='effcost'; }); }
function villagePrestige(){ return BEAUTIFICATION.filter(b=>(S.beautification||[]).includes(b.id)).reduce((a,b)=>a+b.prestige,0); }
function prestigeCoinsPm(){ return PRESTIGE_THRESHOLDS.filter(r=>r.coinsPm&&villagePrestige()>=r.at).reduce((a,r)=>a+(r.coinsPm||0),0); }
function prestigeFriendXpMult(){ return 1+PRESTIGE_THRESHOLDS.filter(r=>r.friendXpPct&&villagePrestige()>=r.at).reduce((a,r)=>a+(r.friendXpPct||0),0)/100; }
function prestigeXpMult(){ return 1+PRESTIGE_THRESHOLDS.filter(r=>r.xpPct&&villagePrestige()>=r.at).reduce((a,r)=>a+(r.xpPct||0),0)/100; }
function prestigeRentMult(){ return 1+PRESTIGE_THRESHOLDS.filter(r=>r.rentPct&&villagePrestige()>=r.at).reduce((a,r)=>a+(r.rentPct||0),0)/100; }
const EXCHANGE_COMMODITIES = [
  { id:"iron_ore",    n:"Iron Ore",    ic:"🪨", unit:50  },
  { id:"steel_bar",   n:"Steel Bar",   ic:"⛓️", unit:120 },
  { id:"sardine",     n:"Sardine",     ic:"🐟", unit:40  },
  { id:"bracket",     n:"Bracket",     ic:"🧱", unit:100 },
  { id:"wiring_loom", n:"Wiring Loom", ic:"🔌", unit:160 },
];
const COURSES = [
  { id:"survey",       n:"Surveying",              skill:"mining",        perk:"xp",    val:0.15, cost:500,  ms:10*60*1000, ic:"⛏️",  desc:"Mine 15% more XP." },
  { id:"metallurgy",   n:"Metallurgy",             skill:"steelworks",    perk:"xp",    val:0.15, cost:1000, ms:20*60*1000, ic:"🔥",  desc:"Smelt 15% more XP." },
  { id:"mech_eng",     n:"Mechanical Engineering", skill:"manufacturing", perk:"xp",    val:0.15, cost:1500, ms:30*60*1000, ic:"⚙️",  desc:"Manufacture 15% more XP." },
  { id:"log_mgmt",     n:"Logistics Management",   skill:"logistics",     perk:"xp",    val:0.20, cost:800,  ms:15*60*1000, ic:"🚚",  desc:"Earn 20% more Logistics XP." },
  { id:"mkt_analysis", n:"Market Analysis",        skill:"trading",       perk:"bonus", val:0.08, cost:2000, ms:40*60*1000, ic:"⚖️",  desc:"+8% sell price bonus." },
  { id:"forestry",     n:"Forestry",               skill:"woodcutting",   perk:"xp",    val:0.15, cost:600,  ms:12*60*1000, ic:"🌲",  desc:"Chop 15% more XP." },
  { id:"marine_bio",   n:"Marine Biology",         skill:"fishing",       perk:"xp",    val:0.15, cost:700,  ms:15*60*1000, ic:"🎣",  desc:"Fish 15% more XP." },
];
const STATION_DEFS = {
  mining:        [
    { fx:0.15, fy:0.34, sk:'prop_hopper',   skill:'mining',        id:'iron_ore',   ic:'🪨', lbl:'Iron Ore' },
    { fx:0.40, fy:0.50, sk:'prop_hopper',   skill:'mining',        id:'copper_ore', ic:'🟤', lbl:'Copper Ore' },
    { fx:0.65, fy:0.34, sk:'prop_hopper',   skill:'mining',        id:'coal',       ic:'⚫', lbl:'Coal' },
    { fx:0.86, fy:0.50, sk:'prop_hopper',   skill:'mining',        id:'bauxite',    ic:'🟠', lbl:'Bauxite' },
    { fx:0.35, fy:0.72, sk:'prop_hopper',   skill:'mining',        id:'rare_earth', ic:'💎', lbl:'Rare Earths' },
    { fx:0.68, fy:0.72, sk:'prop_hopper',   skill:'mining',        id:'diamond',    ic:'💠', lbl:'Diamond' },
  ],
  steelworks:    [
    { fx:0.28, fy:0.55, sk:'prop_machine',  skill:'steelworks',    id:'iron_bar',   ic:'🔩', lbl:'Smelt Iron' },
    { fx:0.64, fy:0.55, sk:'prop_machine',  skill:'steelworks',    id:'steel_bar',  ic:'⛓️', lbl:'Steel Bar' },
  ],
  manufacturing: [
    { fx:0.20, fy:0.53, sk:'prop_conveyor', skill:'manufacturing', id:'bracket',    ic:'🧱', lbl:'Brackets' },
    { fx:0.55, fy:0.53, sk:'prop_machine',  skill:'manufacturing', id:'gearbox',    ic:'⚙️', lbl:'Gearbox' },
    { fx:0.82, fy:0.53, sk:'prop_machine',  skill:'manufacturing', id:'wiring_loom',ic:'🔌', lbl:'Wiring Loom' },
  ],
  woodcutting:   [
    { fx:0.18, fy:0.62, sk:'log_pine',      skill:'woodcutting',   id:'pine',       ic:'🌲', lbl:'Pine Logs' },
    { fx:0.50, fy:0.62, sk:'log_oak',       skill:'woodcutting',   id:'oak',        ic:'🌳', lbl:'Oak Logs' },
    { fx:0.82, fy:0.62, sk:'log_hard',      skill:'woodcutting',   id:'hardwood',   ic:'🪵', lbl:'Hardwood Logs' },
  ],
  foraging: [
    { fx:0.20, fy:0.72, sk:'prop_hopper', skill:'foraging', id:'gather_mushroom', ic:'🍄', lbl:'Mushrooms' },
    { fx:0.50, fy:0.72, sk:'prop_hopper', skill:'foraging', id:'gather_berries',  ic:'🫐', lbl:'Berries' },
    { fx:0.80, fy:0.72, sk:'prop_hopper', skill:'foraging', id:'gather_herb',     ic:'🌿', lbl:'Wild Herbs' },
  ],
  crafting: [
    { fx:0.14, fy:0.65, sk:'prop_machine', skill:'crafting', id:'make_jam',    ic:'🫙', lbl:'Berry Jam' },
    { fx:0.32, fy:0.65, sk:'prop_machine', skill:'crafting', id:'make_tea',    ic:'🍵', lbl:'Herb Tea' },
    { fx:0.50, fy:0.65, sk:'prop_machine', skill:'crafting', id:'carve_bowl',  ic:'🥣', lbl:'Carved Bowl' },
    { fx:0.68, fy:0.65, sk:'prop_machine', skill:'crafting', id:'smoke_fish',  ic:'🐡', lbl:'Smoked Fish' },
    { fx:0.86, fy:0.65, sk:'prop_machine', skill:'crafting', id:'gift_basket', ic:'🧺', lbl:'Gift Basket' },
  ],
  fishing: [
    { fx:0.50, fy:0.60, sk:'prop_hopper', skill:'fishing', id:'fish', ic:'🎣', lbl:'Fishing Spot' },
  ],
};
// Skill interior canvas size (mining/steelworks/manufacturing/woodcutting)
const INT_W = 320;
const INT_H = 200;
// Returns the current interior canvas logical dimensions
function icanvasW(){ return INT_W; }
function icanvasH(){ return INT_H; }

const ZONE_TIPS = {
  mining:        { ic:"⛏️", n:"The Quarry",         tip:"Strike the vein to collect ore." },
  steelworks:    { ic:"🔥", n:"The Furnace",         tip:"Smelt ore into bars." },
  manufacturing: { ic:"⚙️", n:"The Workshop",        tip:"Craft components for the supply chain." },
  woodcutting:   { ic:"🪓", n:"The Sawmill",         tip:"Chop timber and mill planks." },
  fishing:       { ic:"🎣", n:"The Pier",            tip:"Cast your line. Patience is a virtue." },
  foraging:      { ic:"🌿", n:"The Forager's Hut",  tip:"Gather what the forest freely gives." },
  crafting:      { ic:"🧺", n:"The Artisan's Shed",  tip:"Turn gathered goods into artisan products." },
  bike_shop:     { ic:"🚲", n:"Cycle Shop",          tip:"Rent, repair and upgrade your bike." },
  notice_board:  { ic:"📋", n:"Village Notice Board", tip:"Community tasks from your neighbours." },
  harbour_office:{ ic:"⚓", n:"Harbourmaster's Office", tip:"Fast travel and harbour services." },
  boat_hire:     { ic:"⛵", n:"Featherstone Boat Hire",   tip:"Hire a boat to cross the bay quickly." },
  fishmonger_wh: { ic:"🐟", n:"Fish Warehouse",         tip:"Sell your catch in bulk at a premium." },
  contracts:     { ic:"📦", n:"The Depot",           tip:"Fulfil orders to earn Logistics XP." },
  trade:         { ic:"⚖️", n:"The Market Hall",     tip:"Buy and sell goods with traders." },
  upgrades:      { ic:"🛒", n:"The Town Hall",        tip:"Invest profits in permanent upgrades." },
  pets:          { ic:"🐾", n:"The Companion Barn",  tip:"Your crew lives here." },
  village_fund:     { ic:"🌸", n:"The Village Fund",    tip:"Invest in Featherstone's beauty and earn prestige bonuses." },
  seasonal_market:  { ic:"🎪", n:"Seasonal Market",     tip:"Exclusive seasonal crafts and festival trades." },
};
let _zoneCardData = null;
function showZoneCard(tab){
  const z = ZONE_TIPS[tab]; if (!z) return;
  _zoneCardData = { ic: z.ic, n: z.n, shownAt: Date.now() };
  const el = document.getElementById("zone-card-canvas"); if (!el) return;
  el.innerHTML = `${z.ic} ${z.n}<br><span style="font:400 9px 'IBM Plex Mono',monospace;color:#c9b090">walk south to exit</span>`;
  el.style.display = "block"; el.style.opacity = "1";
  clearTimeout(el._zcTimer);
  el._zcTimer = setTimeout(()=>{ el.style.opacity="0"; setTimeout(()=>{ el.style.display="none"; },520); }, 2600);
}

// Solid collision rects for interior rooms (pixel coords on 320×200 canvas)
const INTERIOR_COLS = {
  // pier: the water (top of the canvas) is solid so the angler stays on the deck
  fishing: [
    {x:0, y:0, w:320, h:86},
  ],
  mining: [
    // Open cave — support beams only clip the ceiling now, so you can walk freely
    // to every ore vein. Just a couple of low props remain as obstacles.
    {x:4,   y:160,w:22, h:26},  // coal pile (bottom-left corner)
    {x:280, y:160,w:34, h:24},  // crates (bottom-right corner)
  ],
  steelworks: [
    {x:42,  y:10, w:38, h:38},  // furnace 1
    {x:212, y:10, w:38, h:38},  // furnace 2
    {x:198, y:112,w:29, h:12},  // anvil
    {x:244, y:103,w:10, h:29},  // tool rack
    {x:266, y:127,w:16, h:14},  // crate a
    {x:266, y:142,w:16, h:14},  // crate b
    {x:46,  y:146,w:38, h:16},  // coal heap
    {x:14,  y:118,w:30, h:36},  // quench barrel
  ],
  manufacturing: [
    {x:33,  y:32, w:43, h:19},  // workbench 1
    {x:132, y:32, w:43, h:19},  // workbench 2
    {x:232, y:32, w:43, h:19},  // workbench 3
    {x:8,   y:88, w:24, h:33},  // shelf unit
    {x:277, y:88, w:34, h:28},  // pallet stack
    {x:8,   y:29, w:16, h:44},  // cabinet left
    {x:296, y:29, w:16, h:44},  // cabinet right
  ],
  ach: [
    {x:33,  y:80, w:26, h:16},
    {x:99,  y:80, w:26, h:16},
    {x:195, y:80, w:26, h:16},
    {x:261, y:80, w:26, h:16},
    {x:33,  y:132,w:26, h:16},
    {x:99,  y:132,w:26, h:16},
    {x:195, y:132,w:26, h:16},
    {x:261, y:132,w:26, h:16},
  ],
  contracts: [
    {x:16,  y:126,w:54, h:16},  // clerk desk
    {x:236, y:52, w:72, h:62},  // loading bay + lorry
    {x:240, y:122,w:56, h:35},  // pallet stack
    {x:20,  y:126,w:18, h:34},  // crate stack
    {x:170, y:114,w:52, h:28},  // forklift
    {x:10,  y:50, w:74, h:62},  // racking (flush left wall)
  ],
  trade: [
    {x:24,  y:58, w:278,h:30},  // trader counters row
    {x:12,  y:144,w:22, h:26},  // barrel left
    {x:288, y:144,w:22, h:26},  // barrel right
  ],
  pets: [
    {x:14,  y:60, w:50, h:46},  // hay bales
    {x:266, y:82, w:20, h:30},  // scratching post
  ],
  upgrades: [
    {x:141, y:58, w:38, h:28},  // podium
    {x:16,  y:60, w:22, h:42},  // filing cabinet
    {x:280, y:84, w:24, h:16},  // plant
  ],
  woodcutting: [
    {x:36,  y:76, w:64, h:18},  // saw table
    {x:244, y:132,w:50, h:26},  // log pile
    {x:14,  y:142,w:50, h:14},  // plank stack
  ],
  // HX4: core public rooms (pub, café, bank, shops) get matching counter/bar collision.
  ...PUBLIC_COLS,
  // NPC homes: collision is generated per-home from the layout (homeColsCached),
  // not from this static list — the "home" tab is shared by 17 different floorplans.
  home: [],
};
// Per-home collision, derived from the same buildLayout() that draws the room,
// memoised by roomObjId so it isn't recomputed every frame.
const _homeColsCache: Record<string, any[]> = {};
function homeColsCached(id: string){
  if (!_homeColsCache[id]) _homeColsCache[id] = homeCollisionRects(id, icanvasW(), icanvasH());
  return _homeColsCache[id];
}
const VKEYS = {};
const GPKEYS: Record<string,boolean> = {}; // gamepad movement, kept separate so keyboard keys never get cleared
const VFX = [];
const DUST = [];
let vLastT = 0, lastDust = 0;

function objRect(o){
  const w = (o.w||1)*TILE, h = (o.h||1)*TILE;
  return { x:o.tx*TILE, y:o.ty*TILE, w, h };
}
function objApproach(o){
  const r = objRect(o);
  return { x: r.x + r.w/2, y: r.y + r.h + 10 };
}
function tileAt(px, py){
  const c = Math.floor(px/TILE), r = Math.floor(py/TILE);
  if (c<0||r<0||c>=VCOLS||r>=VROWS) return "T";
  return VMAP[r][c];
}
// Bike system
const BIKE_WHEEL_TIER: Record<string,number> = { standard:0, sport:1, offroad:2, mountain:3 };
const BIKE_WHEEL_N: Record<string,string> = { standard:"Standard Wheels", sport:"Sport Wheels", offroad:"Off-road Tyres", mountain:"Mountain Bike" };
// Friendship system
const FRIEND_LOVES: Record<string,string[]> = {
  agnes:['wild_herb','berries','herb_tea'], bertie:['iron_bar','coal'],         clara:['berries','mushroom','berry_jam'],
  derek:['steel_bar','iron_bar'],           edna:['painting','vase','gift_basket'], frank:['wood','plank'],
  gracie:['berries','mushroom'],            hector:['bracket','wiring_loom'],    ida:['salmon','tuna','smoked_fish'],
  jack:['coal','steel_bar'],                kitty:['gearbox','wiring_loom'],     lenny:['plank','wood'],
  mabel:['berries','wild_herb','herb_tea','berry_jam'], ned:['rare_wood','wood'], olive:['salmon','tuna','smoked_fish'],
  reg:['iron_bar','coal'],                  pearl:['salmon','tuna'],
};
const FRIEND_LVL_NAMES = ['Stranger','Acquaintance','Friends','Good Friends','Close Friends','Best Friends'];
const FRIEND_GIFT: Record<string,string> = {
  agnes:'wild_herb', bertie:'iron_bar', clara:'berries', derek:'plank',
  edna:'painting', frank:'plank', gracie:'mushroom', hector:'bracket',
  ida:'salmon', jack:'coal', kitty:'gearbox', lenny:'wood',
  mabel:'berries', ned:'rare_wood', olive:'tuna',
  reg:'plank', pearl:'mackerel',
};
const NB_POOL = [
  { npcId:'agnes',  npcName:'Agnes',  itemId:'bracket',     qty:3, reward:60,  friendXp:8  },
  { npcId:'agnes',  npcName:'Agnes',  itemId:'plank',       qty:5, reward:55,  friendXp:8  },
  { npcId:'agnes',  npcName:'Agnes',  itemId:'wiring_loom', qty:2, reward:90,  friendXp:10 },
  { npcId:'bertie', npcName:'Bertie', itemId:'coal',        qty:4, reward:40,  friendXp:6  },
  { npcId:'bertie', npcName:'Bertie', itemId:'iron_ore',    qty:5, reward:30,  friendXp:6  },
  { npcId:'bertie', npcName:'Bertie', itemId:'iron_bar',    qty:3, reward:55,  friendXp:8  },
  { npcId:'clara',  npcName:'Clara',  itemId:'berries',     qty:5, reward:50,  friendXp:8  },
  { npcId:'clara',  npcName:'Clara',  itemId:'mushroom',    qty:3, reward:45,  friendXp:8  },
  { npcId:'clara',  npcName:'Clara',  itemId:'wild_herb',   qty:4, reward:60,  friendXp:8  },
  { npcId:'derek',  npcName:'Derek',  itemId:'plank',       qty:4, reward:45,  friendXp:6  },
  { npcId:'derek',  npcName:'Derek',  itemId:'bracket',     qty:3, reward:60,  friendXp:8  },
  { npcId:'derek',  npcName:'Derek',  itemId:'steel_bar',   qty:2, reward:70,  friendXp:8  },
  { npcId:'edna',   npcName:'Edna',   itemId:'painting',    qty:1, reward:100, friendXp:12 },
  { npcId:'edna',   npcName:'Edna',   itemId:'vase',        qty:2, reward:100, friendXp:12 },
  { npcId:'edna',   npcName:'Edna',   itemId:'lamp',        qty:2, reward:75,  friendXp:10 },
  { npcId:'frank',  npcName:'Frank',  itemId:'wood',        qty:6, reward:25,  friendXp:5  },
  { npcId:'frank',  npcName:'Frank',  itemId:'plank',       qty:4, reward:45,  friendXp:6  },
  { npcId:'frank',  npcName:'Frank',  itemId:'rare_wood',   qty:2, reward:175, friendXp:14 },
  { npcId:'gracie', npcName:'Gracie', itemId:'mushroom',    qty:4, reward:55,  friendXp:8  },
  { npcId:'gracie', npcName:'Gracie', itemId:'berries',     qty:5, reward:50,  friendXp:8  },
  { npcId:'gracie', npcName:'Gracie', itemId:'wild_herb',   qty:3, reward:55,  friendXp:8  },
  { npcId:'hector', npcName:'Hector', itemId:'iron_bar',    qty:2, reward:35,  friendXp:6  },
  { npcId:'hector', npcName:'Hector', itemId:'bracket',     qty:4, reward:65,  friendXp:8  },
  { npcId:'hector', npcName:'Hector', itemId:'wiring_loom', qty:2, reward:90,  friendXp:10 },
  { npcId:'ida',    npcName:'Ida',    itemId:'sardine',     qty:5, reward:55,  friendXp:7  },
  { npcId:'ida',    npcName:'Ida',    itemId:'mackerel',    qty:3, reward:60,  friendXp:8  },
  { npcId:'ida',    npcName:'Ida',    itemId:'bass',        qty:2, reward:75,  friendXp:8  },
  { npcId:'jack',   npcName:'Jack',   itemId:'coal',        qty:5, reward:50,  friendXp:7  },
  { npcId:'jack',   npcName:'Jack',   itemId:'steel_bar',   qty:2, reward:70,  friendXp:8  },
  { npcId:'jack',   npcName:'Jack',   itemId:'iron_bar',    qty:3, reward:55,  friendXp:8  },
  { npcId:'kitty',  npcName:'Kitty',  itemId:'gearbox',     qty:1, reward:100, friendXp:12 },
  { npcId:'kitty',  npcName:'Kitty',  itemId:'bracket',     qty:4, reward:65,  friendXp:8  },
  { npcId:'kitty',  npcName:'Kitty',  itemId:'wiring_loom', qty:2, reward:90,  friendXp:10 },
  { npcId:'lenny',  npcName:'Lenny',  itemId:'wood',        qty:5, reward:20,  friendXp:5  },
  { npcId:'lenny',  npcName:'Lenny',  itemId:'plank',       qty:4, reward:45,  friendXp:6  },
  { npcId:'lenny',  npcName:'Lenny',  itemId:'bracket',     qty:3, reward:60,  friendXp:8  },
  { npcId:'mabel',  npcName:'Mabel',  itemId:'berries',     qty:6, reward:60,  friendXp:8  },
  { npcId:'mabel',  npcName:'Mabel',  itemId:'mushroom',    qty:4, reward:55,  friendXp:8  },
  { npcId:'mabel',  npcName:'Mabel',  itemId:'wild_herb',   qty:3, reward:55,  friendXp:8  },
  { npcId:'ned',    npcName:'Ned',    itemId:'rare_wood',   qty:2, reward:175, friendXp:14 },
  { npcId:'ned',    npcName:'Ned',    itemId:'wood',        qty:8, reward:30,  friendXp:5  },
  { npcId:'ned',    npcName:'Ned',    itemId:'plank',       qty:5, reward:55,  friendXp:7  },
  { npcId:'olive',  npcName:'Olive',  itemId:'sardine',     qty:6, reward:60,  friendXp:8  },
  { npcId:'olive',  npcName:'Olive',  itemId:'tuna',        qty:1, reward:140, friendXp:14 },
  { npcId:'olive',  npcName:'Olive',  itemId:'mackerel',    qty:3, reward:60,  friendXp:8  },
  { npcId:'reg',    npcName:'Reg',    itemId:'iron_bar',    qty:3, reward:55,  friendXp:8  },
  { npcId:'reg',    npcName:'Reg',    itemId:'coal',        qty:5, reward:50,  friendXp:7  },
  { npcId:'reg',    npcName:'Reg',    itemId:'plank',       qty:4, reward:45,  friendXp:6  },
  { npcId:'pearl',  npcName:'Pearl',  itemId:'salmon',      qty:3, reward:90,  friendXp:10 },
  { npcId:'pearl',  npcName:'Pearl',  itemId:'mackerel',    qty:5, reward:55,  friendXp:8  },
  { npcId:'pearl',  npcName:'Pearl',  itemId:'tuna',        qty:1, reward:140, friendXp:14 },
  { npcId:'agnes',  npcName:'Agnes',  itemId:'herb_tea',    qty:2, reward:90,  friendXp:10 },
  { npcId:'clara',  npcName:'Clara',  itemId:'berry_jam',   qty:2, reward:95,  friendXp:10 },
  { npcId:'mabel',  npcName:'Mabel',  itemId:'berry_jam',   qty:1, reward:55,  friendXp:8  },
  { npcId:'mabel',  npcName:'Mabel',  itemId:'herb_tea',    qty:2, reward:90,  friendXp:10 },
  { npcId:'ida',    npcName:'Ida',    itemId:'smoked_fish', qty:2, reward:120, friendXp:12 },
  { npcId:'olive',  npcName:'Olive',  itemId:'smoked_fish', qty:1, reward:75,  friendXp:9  },
  { npcId:'edna',   npcName:'Edna',   itemId:'gift_basket', qty:1, reward:180, friendXp:15 },
];
// Personal requests — shown in the Village Friends panel, refresh every 24 h, scale with friendship level
const PERSONAL_REQUESTS = [
  { npcId:'agnes',  itemId:'berries',     qty:4, reward:50,  friendXp:8,  minLvl:0 },
  { npcId:'agnes',  itemId:'wild_herb',   qty:3, reward:65,  friendXp:10, minLvl:1 },
  { npcId:'agnes',  itemId:'herb_tea',    qty:2, reward:90,  friendXp:12, minLvl:2 },
  { npcId:'agnes',  itemId:'gift_basket', qty:1, reward:165, friendXp:18, minLvl:3 },
  { npcId:'bertie', itemId:'coal',        qty:4, reward:42,  friendXp:7,  minLvl:0 },
  { npcId:'bertie', itemId:'iron_ore',    qty:5, reward:35,  friendXp:7,  minLvl:0 },
  { npcId:'bertie', itemId:'iron_bar',    qty:3, reward:62,  friendXp:10, minLvl:2 },
  { npcId:'bertie', itemId:'steel_bar',   qty:2, reward:82,  friendXp:12, minLvl:3 },
  { npcId:'clara',  itemId:'berries',     qty:5, reward:55,  friendXp:8,  minLvl:0 },
  { npcId:'clara',  itemId:'mushroom',    qty:3, reward:50,  friendXp:8,  minLvl:1 },
  { npcId:'clara',  itemId:'berry_jam',   qty:2, reward:105, friendXp:14, minLvl:2 },
  { npcId:'clara',  itemId:'gift_basket', qty:1, reward:168, friendXp:18, minLvl:3 },
  { npcId:'derek',  itemId:'wood',        qty:6, reward:25,  friendXp:6,  minLvl:0 },
  { npcId:'derek',  itemId:'plank',       qty:4, reward:50,  friendXp:8,  minLvl:1 },
  { npcId:'derek',  itemId:'steel_bar',   qty:2, reward:82,  friendXp:12, minLvl:2 },
  { npcId:'derek',  itemId:'gearbox',     qty:1, reward:110, friendXp:15, minLvl:3 },
  { npcId:'edna',   itemId:'lamp',        qty:2, reward:80,  friendXp:10, minLvl:0 },
  { npcId:'edna',   itemId:'vase',        qty:2, reward:105, friendXp:12, minLvl:1 },
  { npcId:'edna',   itemId:'painting',    qty:1, reward:100, friendXp:14, minLvl:2 },
  { npcId:'edna',   itemId:'gift_basket', qty:1, reward:178, friendXp:20, minLvl:3 },
  { npcId:'frank',  itemId:'wood',        qty:6, reward:22,  friendXp:6,  minLvl:0 },
  { npcId:'frank',  itemId:'plank',       qty:4, reward:50,  friendXp:8,  minLvl:1 },
  { npcId:'frank',  itemId:'rare_wood',   qty:2, reward:182, friendXp:16, minLvl:3 },
  { npcId:'gracie', itemId:'mushroom',    qty:4, reward:55,  friendXp:8,  minLvl:0 },
  { npcId:'gracie', itemId:'berries',     qty:5, reward:50,  friendXp:8,  minLvl:0 },
  { npcId:'gracie', itemId:'wild_herb',   qty:3, reward:62,  friendXp:10, minLvl:2 },
  { npcId:'gracie', itemId:'berry_jam',   qty:2, reward:105, friendXp:13, minLvl:3 },
  { npcId:'hector', itemId:'iron_bar',    qty:2, reward:35,  friendXp:7,  minLvl:0 },
  { npcId:'hector', itemId:'bracket',     qty:4, reward:72,  friendXp:9,  minLvl:1 },
  { npcId:'hector', itemId:'wiring_loom', qty:2, reward:96,  friendXp:12, minLvl:2 },
  { npcId:'hector', itemId:'gearbox',     qty:1, reward:108, friendXp:15, minLvl:3 },
  { npcId:'ida',    itemId:'sardine',     qty:5, reward:55,  friendXp:7,  minLvl:0 },
  { npcId:'ida',    itemId:'mackerel',    qty:3, reward:62,  friendXp:9,  minLvl:1 },
  { npcId:'ida',    itemId:'smoked_fish', qty:2, reward:132, friendXp:14, minLvl:2 },
  { npcId:'ida',    itemId:'salmon',      qty:2, reward:142, friendXp:15, minLvl:3 },
  { npcId:'jack',   itemId:'coal',        qty:5, reward:50,  friendXp:7,  minLvl:0 },
  { npcId:'jack',   itemId:'iron_bar',    qty:3, reward:62,  friendXp:9,  minLvl:1 },
  { npcId:'jack',   itemId:'steel_bar',   qty:2, reward:82,  friendXp:12, minLvl:2 },
  { npcId:'kitty',  itemId:'bracket',     qty:3, reward:62,  friendXp:8,  minLvl:0 },
  { npcId:'kitty',  itemId:'wiring_loom', qty:2, reward:96,  friendXp:12, minLvl:1 },
  { npcId:'kitty',  itemId:'gearbox',     qty:1, reward:108, friendXp:14, minLvl:2 },
  { npcId:'kitty',  itemId:'sensor',      qty:1, reward:292, friendXp:20, minLvl:4 },
  { npcId:'lenny',  itemId:'wood',        qty:5, reward:20,  friendXp:5,  minLvl:0 },
  { npcId:'lenny',  itemId:'plank',       qty:4, reward:48,  friendXp:8,  minLvl:1 },
  { npcId:'lenny',  itemId:'rare_wood',   qty:2, reward:182, friendXp:16, minLvl:3 },
  { npcId:'mabel',  itemId:'berries',     qty:6, reward:62,  friendXp:8,  minLvl:0 },
  { npcId:'mabel',  itemId:'mushroom',    qty:4, reward:55,  friendXp:8,  minLvl:0 },
  { npcId:'mabel',  itemId:'berry_jam',   qty:2, reward:105, friendXp:13, minLvl:2 },
  { npcId:'mabel',  itemId:'herb_tea',    qty:2, reward:96,  friendXp:13, minLvl:2 },
  { npcId:'ned',    itemId:'wood',        qty:8, reward:30,  friendXp:5,  minLvl:0 },
  { npcId:'ned',    itemId:'plank',       qty:5, reward:56,  friendXp:8,  minLvl:1 },
  { npcId:'ned',    itemId:'carved_bowl', qty:2, reward:118, friendXp:14, minLvl:2 },
  { npcId:'ned',    itemId:'rare_wood',   qty:2, reward:182, friendXp:16, minLvl:3 },
  { npcId:'olive',  itemId:'sardine',     qty:6, reward:62,  friendXp:8,  minLvl:0 },
  { npcId:'olive',  itemId:'mackerel',    qty:3, reward:62,  friendXp:9,  minLvl:1 },
  { npcId:'olive',  itemId:'smoked_fish', qty:2, reward:132, friendXp:14, minLvl:2 },
  { npcId:'olive',  itemId:'tuna',        qty:1, reward:148, friendXp:16, minLvl:3 },
  { npcId:'reg',    itemId:'iron_ore',    qty:5, reward:30,  friendXp:6,  minLvl:0 },
  { npcId:'reg',    itemId:'coal',        qty:5, reward:50,  friendXp:7,  minLvl:0 },
  { npcId:'reg',    itemId:'plank',       qty:4, reward:48,  friendXp:8,  minLvl:1 },
  { npcId:'reg',    itemId:'iron_bar',    qty:3, reward:62,  friendXp:9,  minLvl:2 },
  { npcId:'pearl',  itemId:'mackerel',    qty:5, reward:56,  friendXp:8,  minLvl:0 },
  { npcId:'pearl',  itemId:'salmon',      qty:3, reward:96,  friendXp:12, minLvl:1 },
  { npcId:'pearl',  itemId:'tuna',        qty:1, reward:148, friendXp:16, minLvl:3 },
  // Seasonal requests — only generated when the matching season is active
  { npcId:'agnes',  itemId:'flower_crown',      qty:1, reward:112, friendXp:15, minLvl:1, season:'spring' },
  { npcId:'clara',  itemId:'blossom_jam',       qty:1, reward:122, friendXp:16, minLvl:2, season:'spring' },
  { npcId:'gracie', itemId:'spring_tonic',      qty:2, reward:108, friendXp:14, minLvl:1, season:'spring' },
  { npcId:'mabel',  itemId:'flower_crown',      qty:1, reward:112, friendXp:15, minLvl:1, season:'spring' },
  { npcId:'edna',   itemId:'sun_hat',           qty:1, reward:122, friendXp:15, minLvl:2, season:'summer' },
  { npcId:'mabel',  itemId:'lemonade',          qty:3, reward:108, friendXp:13, minLvl:1, season:'summer' },
  { npcId:'pearl',  itemId:'honey_cake',        qty:1, reward:152, friendXp:16, minLvl:2, season:'summer' },
  { npcId:'clara',  itemId:'lemonade',          qty:3, reward:108, friendXp:13, minLvl:1, season:'summer' },
  { npcId:'ida',    itemId:'spiced_cider',      qty:2, reward:118, friendXp:14, minLvl:1, season:'autumn' },
  { npcId:'ned',    itemId:'harvest_wreath',    qty:1, reward:175, friendXp:18, minLvl:3, season:'autumn' },
  { npcId:'olive',  itemId:'pickled_mushrooms', qty:2, reward:108, friendXp:13, minLvl:2, season:'autumn' },
  { npcId:'bertie', itemId:'spiced_cider',      qty:2, reward:118, friendXp:14, minLvl:1, season:'autumn' },
  { npcId:'frank',  itemId:'pine_garland',      qty:2, reward:135, friendXp:15, minLvl:2, season:'winter' },
  { npcId:'jack',   itemId:'mulled_tea',        qty:2, reward:120, friendXp:14, minLvl:1, season:'winter' },
  { npcId:'edna',   itemId:'winter_hamper',     qty:1, reward:235, friendXp:22, minLvl:3, season:'winter' },
  { npcId:'kitty',  itemId:'mulled_tea',        qty:3, reward:155, friendXp:16, minLvl:1, season:'winter' },
];
function isHarbourUnlocked(){ return totalLvl() >= 100; }
function serviceCost(){ return Math.max(5, Math.round((100 - (S.bike?.condition ?? 100)) * 1.5)); }
function bikeSpeedMult(){
  if (!S.bike?.equipped) return 1.0;
  const onForest = tileAt(VP.x, VP.y) === 'F';
  const wheels = S.bike.wheels || 'standard';
  const cond = Math.max(0, S.bike.condition ?? 100) / 100;
  let mult: number;
  if (wheels === 'mountain')     mult = onForest ? 1.30 : 1.35;
  else if (wheels === 'offroad') mult = 1.25;
  else if (wheels === 'sport')   mult = onForest ? 0.90 : 1.35;
  else                           mult = onForest ? 0.90 : 1.25; // standard
  // condition scales the speed bonus (but not the forest penalty)
  return mult >= 1.0 ? 1.0 + (mult - 1.0) * cond : mult;
}
// Friendship helpers
function friendXp(id: string){ return (S.friendships?.[id]?.xp) ?? 0; }
function friendLvl(id: string){ const x=friendXp(id); return x>=150?5:x>=100?4:x>=60?3:x>=30?2:x>=10?1:0; }
function heartsHtml(id: string, sz=11){
  const l = friendLvl(id);
  return Array.from({length:5},(_,i)=>`<span style="font-size:${sz}px;opacity:${i<l?1:.18}">❤️</span>`).join('');
}
function grantFriendshipGift(id: string, name: string){
  const g = FRIEND_GIFT[id];
  if (g && ITEMS[g]){ addItem(g, 3); toast(`🎁 ${name} gives you 3× ${ITEMS[g].n} as a gift!`); log(`🎁 <b>${name}</b> gifted you 3× ${ITEMS[g].n}`, "good"); }
}

const KEEPSAKE_DEFS: Record<string, { n:string; ic:string; bonus:string; type:string; skill?:string; val:number }> = {
  agnes:  { n:"Agnes's Recipe Book",        ic:"📖", bonus:"+5% Crafting XP",          type:'xp',     skill:'crafting',       val:0.05 },
  bertie: { n:"Bertie's Forging Stamp",     ic:"🔨", bonus:"+5% Steelworks speed",     type:'speed',  skill:'steelworks',     val:0.05 },
  clara:  { n:"Clara's Seed Pouch",         ic:"🌱", bonus:"Garden crops 10% faster",  type:'garden',                         val:0.10 },
  derek:  { n:"Derek's Blueprint Roll",     ic:"📐", bonus:"+5% Manufacturing speed",  type:'speed',  skill:'manufacturing',  val:0.05 },
  edna:   { n:"Edna's Watercolour",         ic:"🎨", bonus:"+5% sell bonus",           type:'sell',                           val:0.05 },
  frank:  { n:"Frank's Woodworking Plane",  ic:"🪚", bonus:"+5% Woodcutting XP",      type:'xp',     skill:'woodcutting',    val:0.05 },
  gracie: { n:"Gracie's Forest Map",        ic:"🗺️", bonus:"+5% Foraging speed",      type:'speed',  skill:'foraging',       val:0.05 },
  hector: { n:"Hector's Production Notes",  ic:"📋", bonus:"+5% Manufacturing XP",    type:'xp',     skill:'manufacturing',  val:0.05 },
  ida:    { n:"Ida's Lucky Lure",           ic:"🎣", bonus:"+5% Fishing speed",        type:'speed',  skill:'fishing',        val:0.05 },
  jack:   { n:"Jack's Mining Lamp",         ic:"🪔", bonus:"+5% Mining XP",           type:'xp',     skill:'mining',         val:0.05 },
  kitty:  { n:"Kitty's Engineer's Spanner", ic:"🔧", bonus:"+5% Steelworks XP",       type:'xp',     skill:'steelworks',     val:0.05 },
  lenny:  { n:"Lenny's Carved Axe Handle",  ic:"🪓", bonus:"+5% Woodcutting speed",   type:'speed',  skill:'woodcutting',    val:0.05 },
  mabel:  { n:"Mabel's Preserving Jar",     ic:"🫙", bonus:"+5% Crafting speed",      type:'speed',  skill:'crafting',       val:0.05 },
  ned:    { n:"Ned's Pressed Leaf",         ic:"🍃", bonus:"+5% Foraging XP",         type:'xp',     skill:'foraging',       val:0.05 },
  olive:  { n:"Olive's Tide Chart",         ic:"🌊", bonus:"+5% Fishing XP",          type:'xp',     skill:'fishing',        val:0.05 },
  reg:    { n:"Reg's Navigation Chart",     ic:"⚓", bonus:"+5% Logistics XP",        type:'xp',     skill:'logistics',      val:0.05 },
  pearl:  { n:"Pearl's Market Scale",       ic:"⚖️", bonus:"+5% contract payout",     type:'pay',                            val:0.05 },
};
const KEEPSAKE_MSG: Record<string, string> = {
  agnes:  "You've brought such warmth to my kitchen. Take my recipe book — may it fill your home with good smells.",
  bertie: "I've watched you grow from a stranger into a real friend. Use my old stamp to mark your finest work.",
  clara:  "These seeds came all the way from my grandmother's garden. I know they'll flourish in your care.",
  derek:  "A builder is only as good as their plans. Take these — they hold the best ideas I never got around to.",
  edna:   "Every painting tells a story. This one's of Featherstone on the day we first met. For you, always.",
  frank:  "My father carved this plane from driftwood. Now it belongs to hands that know how to use it.",
  gracie: "I've walked every trail on this map a hundred times. Now you can find your own favourites.",
  hector: "These notes are everything I've learned about supply chains. Messy, but they work. Just like us.",
  ida:    "A lucky lure is only lucky when you share it with someone you trust. That's you.",
  jack:   "This lamp kept me safe in the deep seams for twenty years. Carry it with you — it'll never let you down.",
  kitty:  "Every gear I've ever fixed, I've thought of as a small victory. This spanner's won a few. Take it.",
  lenny:  "I carved this handle on a rainy afternoon, thinking of you. Silly, maybe. But there it is.",
  mabel:  "Mum always said the best gifts come in jars. This one holds a bit of every season I can remember.",
  ned:    "I pressed this leaf on the first autumn I met you. Some things are worth keeping.",
  olive:  "The tide knows things the rest of us don't. Read the chart, trust the water, and you'll always find your way home.",
  reg:    "Every port I've ever anchored at is on this chart. Now you can find them too — and maybe a few new ones.",
  pearl:  "A fair scale is the most honest thing in any market. May it always tip in your favour.",
};

function keepsakeSpeedBonus(skill: string){ return (S.keepsakes||[]).reduce((s,id)=>{ const k=KEEPSAKE_DEFS[id]; return s+(k&&k.type==='speed'&&k.skill===skill?k.val:0); },0); }
function keepsakeXpBonus(skill: string){    return (S.keepsakes||[]).reduce((s,id)=>{ const k=KEEPSAKE_DEFS[id]; return s+(k&&k.type==='xp'   &&k.skill===skill?k.val:0); },0); }
function keepsakeSellBonus(){               return (S.keepsakes||[]).reduce((s,id)=>{ const k=KEEPSAKE_DEFS[id]; return s+(k&&k.type==='sell'               ?k.val:0); },0); }
function keepsakePayBonus(){                return (S.keepsakes||[]).reduce((s,id)=>{ const k=KEEPSAKE_DEFS[id]; return s+(k&&k.type==='pay'                ?k.val:0); },0); }
function keepsakeGardenBonus(){             return (S.keepsakes||[]).reduce((s,id)=>{ const k=KEEPSAKE_DEFS[id]; return s+(k&&k.type==='garden'             ?k.val:0); },0); }

function showKeepsakeCeremony(id: string, name: string){
  if (!Array.isArray(S.keepsakes)) S.keepsakes = [];
  if (S.keepsakes.includes(id)) return;
  S.keepsakes.push(id);
  const k = KEEPSAKE_DEFS[id];
  if (!k) return;
  const modal = document.getElementById('keepsake-modal');
  if (!modal) return;
  (document.getElementById('ks-name')  as HTMLElement).textContent = name;
  (document.getElementById('ks-quote') as HTMLElement).textContent = `"${KEEPSAKE_MSG[id] || ''}"`;
  (document.getElementById('ks-ic')        as HTMLElement).textContent = k.ic;
  (document.getElementById('ks-item-name') as HTMLElement).textContent = k.n;
  (document.getElementById('ks-bonus')     as HTMLElement).textContent = k.bonus;
  modal.classList.add('open');
  const btn = document.getElementById('ks-close-btn');
  if (btn) btn.onclick = () => {
    modal.classList.remove('open');
    achCheck(); renderMain(); updateHud(); save();
  };
  log(`💖 <b>${name}</b> gave you a keepsake: ${k.ic} ${k.n} — ${k.bonus}`, "good");
  toast(`💖 Best Friends with ${name}! You received: ${k.ic} ${k.n}`);
}

function renderKeepsakes(): string {
  const ks = S.keepsakes || [];
  if (ks.length === 0) return '';
  const items = ks.map(id => {
    const k = KEEPSAKE_DEFS[id]; if (!k) return '';
    const v = VILLAGERS.find(v=>v.id===id);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:20px">${k.ic}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${k.n}</div>
        <div style="font-size:10px;color:var(--dim)">${v?v.n:'?'} · <span style="color:var(--mint)">${k.bonus}</span></div>
      </div>
    </div>`;
  }).join('');
  return `<div class="panel" style="padding:10px;margin-top:8px">
    <h3 style="margin:0 0 8px;font-size:13px">💝 Keepsakes <span style="color:var(--dim);font-size:10px">(${ks.length}/17 best friends)</span></h3>
    ${items}
  </div>`;
}
function solidAt(px, py){
  // picket fences along forest edges — solid except path gates
  {
    const _fr = Math.floor(py/TILE);
    // west forest west fence (col 39)
    if (px >= 39*TILE-4 && px <= 39*TILE+8 && _fr >= 22 && _fr <= 36 && _fr!==25 && _fr!==26 && _fr!==30 && _fr!==31) return true;
    // west forest east fence (col 47)
    if (px >= 47*TILE-4 && px <= 47*TILE+8 && _fr >= 22 && _fr <= 36 && _fr!==25 && _fr!==26 && _fr!==30 && _fr!==31) return true;
    // east forest west fence (col 87)
    if (px >= 87*TILE-4 && px <= 87*TILE+8 && _fr >= 22 && _fr <= 36 && _fr!==25 && _fr!==26 && _fr!==30 && _fr!==31) return true;
  }
  const t = tileAt(px, py);
  if (t==="T" || t==="W" || t==="C") return true;
  for (const o of V_OBJECTS){
    if (o.kind==="lamp" || o.kind==="sign" || o.kind==="plant" || o.kind==="swing" || o.kind==="slide" || o.kind==="sandbox") continue;
    if (o.kind==="tree" && S?.treeRespawn?.[o.id] && getTreeStage(o) < 2) continue;
    const r = objRect(o);
    if (px>=r.x && px<r.x+r.w && py>=r.y && py<r.y+r.h) return true;
  }
  return false;
}
function moveActor(a, dt, speed, free=false){
  let dx=0, dy=0;
  if ((a===VP||a===IP) && (VKEYS.ArrowLeft||VKEYS.a||GPKEYS.ArrowLeft))  dx-=1;
  if ((a===VP||a===IP) && (VKEYS.ArrowRight||VKEYS.d||GPKEYS.ArrowRight)) dx+=1;
  if ((a===VP||a===IP) && (VKEYS.ArrowUp||VKEYS.w||GPKEYS.ArrowUp))    dy-=1;
  if ((a===VP||a===IP) && (VKEYS.ArrowDown||VKEYS.s||GPKEYS.ArrowDown))  dy+=1;
  if (dx||dy){ a.tx=null; a.ty=null; if (a.pending!==undefined) a.pending=null; }
  else if (a.tx!==null && a.tx!==undefined){
    const vx=a.tx-a.x, vy=a.ty-a.y, d=Math.hypot(vx,vy);
    if (d < 4){ a.tx=null; a.ty=null; }
    else { dx=vx/d; dy=vy/d; }
  }
  a.moving = !!(dx||dy);
  if (!a.moving) return;
  if (dx) a.facing = dx>0?1:-1;
  a.dir = Math.abs(dx) >= Math.abs(dy) ? (dx>0 ? "right" : "left") : (dy>0 ? "down" : "up");
  const st = speed*dt;
  if (free){
    a.x = Math.max(16, Math.min(icanvasW()-16, a.x + dx*st));
    a.y = Math.max(24, Math.min(icanvasH()-16, a.y + dy*st));
  } else {
    const half=6, feet=2;
    const nx = a.x + dx*st;
    if (!solidAt(nx-half, a.y+feet) && !solidAt(nx+half, a.y+feet)) a.x = nx;
    else if (!dy){ a.tx=null; a.ty=null; }
    const ny = a.y + dy*st;
    if (!solidAt(a.x-half, ny+feet) && !solidAt(a.x+half, ny+feet)) a.y = ny;
    else if (!dx){ a.tx=null; a.ty=null; }
  }
}
function stationPos(skill, actId){
  if (skill==="mining"){
    const o = S.action?.objId ? V_OBJECTS.find(x=>x.id===S.action.objId) : V_OBJECTS.find(x=>x.kind==="rock" && x.ore===actId);
    if (o){ const r=objRect(o); return { x:r.x+12, y:r.y+22 }; }
  }
  if (skill==="steelworks"){ const o=V_OBJECTS.find(x=>x.id==="furnace"); const a=objApproach(o); return {x:a.x, y:a.y}; }
  if (skill==="manufacturing"){ const o=V_OBJECTS.find(x=>x.id==="workshop"); const a=objApproach(o); return {x:a.x, y:a.y}; }
  if (skill==="woodcutting"){ const o=S.action?.objId ? V_OBJECTS.find(x=>x.id===S.action.objId) : V_OBJECTS.find(x=>x.kind==="tree" && x.ore===actId); if (o){ const r=objRect(o); return {x:r.x+r.w/2, y:r.y+r.h+4}; } }
  if (skill==="fishing"){ const o=V_OBJECTS.find(x=>x.id==="pier"); if(o){ const a=objApproach(o); return {x:a.x, y:a.y}; } return null; }
  if (skill==="foraging"){ const o=V_OBJECTS.find(x=>x.id==="forager_hut"); if(o){ const a=objApproach(o); return {x:a.x, y:a.y}; } return null; }
  if (skill==="crafting"){ const o=V_OBJECTS.find(x=>x.id==="artisan_shed"); if(o){ const a=objApproach(o); return {x:a.x, y:a.y}; } return null; }
  return null;
}
const SKILL_TOOL = { mining:"⛏️", steelworks:"🔨", manufacturing:"🔧", woodcutting:"🪓", fishing:"🎣", foraging:"🌿", crafting:"🫙" };
// A characterful greeting when you step into each building type.
const BUILDING_FLAVOUR: Record<string,string> = {
  bank:'🏦 "Morning! Your interest is compounding nicely."',
  exchange:'📈 "Markets are open — buy low, sell high!"',
  cafe:'☕ "A fresh brew, coming right up."',
  pub:'🍺 "Evening! What can I get you?"',
  nightclub:'🪩 "Welcome to the floor — tonight\'s theme is a belter!"',
  furniture_shop:'🛋️ "Take your time browsing, love."',
  retail:'🛍️ "Everything\'s fresh in today!"',
  postoffice:'📮 "Parcel, or after some stamps?"',
  estateagent:'🏘️ "Looking to invest in bricks and mortar?"',
  bike_shop:'🚲 "Fancy a new set of wheels?"',
  robotics_lab:'🤖 "Mind the servos — automation at work."',
  data_centre:'🖥️ "The grid\'s humming along nicely."',
  university:'🎓 "Knowledge awaits, scholar."',
  school:'🏫 "Quiet please — lessons in progress."',
  harbour_office:'⚓ "Tide\'s fair today."',
  boat_hire:'⛵ "Fancy a trip out on the water?"',
  fishmonger_wh:'🐟 "Freshest catch on the coast."',
  barn:'🐾 "The animals are pleased to see you."',
  trophy:'🏆 "Admiring your handiwork?"',
  village_fund:'🌸 "Every little helps the valley bloom."',
  furniture:'🛋️ "Make yourself at home."',
};
// One-time tutorials — the first time you enter a system a short "how it works"
// explainer is logged (persistently) and toasted, so every feature teaches itself.
// Tracked in S.seenTips keyed by tab/skill id. Later visits fall back to the
// characterful BUILDING_FLAVOUR greeting instead. Keep each line couch-legible.
const SYSTEM_TUTORIAL: Record<string,string> = {
  // Money & trade
  bank:'Bank — your coins quietly earn interest here over time, and you can borrow against your net worth. Pop back to let your savings compound.',
  exchange:'Exchange — commodity prices rise and fall with the living economy. Buy a good while it\'s cheap, sell when it spikes for a profit.',
  trade:'Market Hall — sell what you gather and buy what you need. Dumping loads of one good drops its price, so sell in sensible batches.',
  contracts:'The Depot — accept an order, deliver the listed goods, and earn coins plus Logistics XP. Bigger orders pay more.',
  upgrades:'Town Hall — spend profits on permanent upgrades: better tools, faster actions and passive boosts. They pay for themselves fast.',
  village_fund:'Village Fund — donate coins to beautify Featherstone and earn lasting prestige bonuses for the whole valley.',
  // Services & leisure
  cafe:'Café — order a coffee for a short speed boost, or head to the Kitchen to cook what you grow and catch into meals: eat one for a buff, or serve it for a premium.',
  pub:'Pub — a pint grants a handy buff for a while, but pace yourself through the evening.',
  nightclub:'Nightclub — the theme rotates every few days. Hit the dance floor for an energy buff and a bit of nightlife.',
  university:'University — enrol in a degree for a lasting XP boost in that subject. Your studies complete over real time.',
  school:'School — brush up on the basics for small early-game bonuses.',
  estateagent:'Estate Agent — buy properties for passive rental income that pays out whether you\'re playing or not.',
  retail:'Retail — stock the shelves with your goods and they sell themselves over time, completely hands-free.',
  postoffice:'Post Office — collect your daily reward here, and send parcels for bonus coins.',
  furniture_shop:'Furniture Shop — buy furnishings to personalise your home; some cosy pieces grant comfort bonuses.',
  bike_shop:'Cycle Shop — rent or buy a bike to move around Featherstone far faster.',
  pets:'Companion Barn — your crew of helpers live here. Look after them and they\'ll lend a hand with your work.',
  // Advanced districts
  robotics_lab:'Automation Lab — build mechanical bots from crafted parts, then assign one per skill to work it passively while you\'re away.',
  data_centre:'Data Centre — upgrade the Power Grid for a town-wide efficiency bonus that lifts every skill at once.',
  // Harbour
  harbour_office:'Harbourmaster — fast-travel across the bay and manage your harbour trade from this office.',
  boat_hire:'Boat Hire — hire a boat to cross the water quickly and reach the far coast.',
  fishmonger_wh:'Fish Warehouse — sell your catch in bulk here for a premium over the market stalls.',
  seasonal_market:'Seasonal Market — limited festival stalls with exclusive crafts, only around for the season.',
  notice_board:'Notice Board — neighbours post tasks here. Complete them for coins, XP and a bit of goodwill.',
  // Production skills
  mining:'Mining — walk up to a vein and strike it to collect ore. Higher-level veins need a better pickaxe from the Town Hall.',
  woodcutting:'Woodcutting — chop trees for timber; they regrow over time. Tougher woods need a higher Woodcutting level.',
  steelworks:'The Furnace — smelt raw ore into bars, the backbone of the whole supply chain.',
  manufacturing:'The Workshop — craft raw materials into components that feed into higher-value goods.',
  fishing:'Fishing — cast your rod and wait for a bite. When the bobber dips, you\'ve hooked one!',
  foraging:'Foraging — gather herbs, berries and mushrooms the forest gives freely.',
  crafting:'Artisan Shed — turn gathered goods into finished artisan products worth far more.',
  // Meta / UI systems
  _districts:'Districts — Featherstone is split into themed districts. Tap one to fast-travel to its hub; advanced districts unlock as your total level climbs.',
  _inventory:'Inventory — everything you own, sorted by value. Sell goods at the Market Hall or use them in crafting.',
};
// Shows a tutorial exactly once. Returns true if it fired (so callers can suppress
// a duplicate greeting on that first visit).
function tipOnce(id, msg){
  if (!msg) return false;
  if (!S.seenTips) S.seenTips = {};
  if (S.seenTips[id]) return false;
  S.seenTips[id] = true;
  log("💡 Tip — " + msg, "good");
  toast("💡 " + msg);
  save();
  return true;
}
const TREE_RESPAWN_MS: Record<string,number> = { pine:600000, oak:1200000, hardwood:7200000, rare_leaf:21600000 };
function getTreeStage(o: any): number {
  const rd = S.treeRespawn?.[o.id];
  if (!rd) return 2;
  const elapsed = Date.now() - rd.choppedAt;
  const total = TREE_RESPAWN_MS[o.ore] || 600000;
  if (elapsed >= total) { delete S.treeRespawn[o.id]; return 2; }
  if (elapsed < total/3) return 0;
  return 1;
}
const TOOL_TIER_COLORS = ["#c8a060","#a0a0a0","#8090a8","#ffd666","#7ee0ff"]; // wood/stone/iron/gold/diamond
function toolTier(){
  if (S.upgrades.tool_diamond) return 4;
  if (S.upgrades.tool_gold)    return 3;
  if (S.upgrades.tool_iron)    return 2;
  if (S.upgrades.tool_stone)   return 1;
  return 0;
}
function toolTierColor(){ return TOOL_TIER_COLORS[toolTier()]; }
function pushVfx(skill, act){
  const p = stationPos(skill, act.id);
  if (!p) return;
  const out = Object.keys(act.out)[0];
  VFX.push({ x:p.x+(Math.random()*16-8), y:p.y-26, born:Date.now(), txt:"+"+act.out[out]+" "+ITEMS[out].ic });
  if (VFX.length > 24) VFX.shift();
}
function villageTip(o){
  if (o.kind==="rock"){
    const locked = skillLvl("mining") < o.lvl;
    return `⛏️ ${ITEMS[o.ore].n}${locked ? " 🔒 Lv "+o.lvl : ""}`;
  }
  if (o.kind==="tree"){
    if (S.treeRespawn?.[o.id]) { const st=getTreeStage(o); if (st===0) return "🌱 Seedling — regrowing..."; if (st===1) return "🌿 Sapling — nearly full..."; }
    const locked = skillLvl("woodcutting") < o.lvl;
    const act = SKILLS.woodcutting?.actions?.find(a=>a.id===o.ore);
    const prefix = o.ore==="rare_leaf" ? "✨" : "🌲";
    return `${prefix} ${act ? act.n : o.ore}${locked ? " · Lv "+o.lvl+" required" : ""}`;
  }
  if (o.kind==="lamp" || o.kind==="plant") return "";
  if (o.kind==="bench") return "🪑 Bench";
  if (o.kind==="swing") return "🌟 Swings";
  if (o.kind==="slide") return "🎉 Slide";
  if (o.kind==="fountain") return "⛲ Fountain";
  if (o.kind==="stall"){
    const locked = skillLvl("trading") < o.lvl;
    return `⚖️ ${o.name}'s Stall${locked ? " 🔒 Trading "+o.lvl : ""}`;
  }
  return `${o.ic||""} ${o.name}`;
}
function interactObj(o){
  if (o.kind==="lamp" || o.kind==="plant") return;
  if (o.kind==="bench"){ toast("🪑 You rest your legs for a moment. Lovely."); return; }
  if (o.kind==="swing"){ toast("🌟 You sway back and forth on the swings. Bliss."); return; }
  if (o.kind==="slide"){ toast("🎉 Wheee! You slide all the way down!"); return; }
  if (o.kind==="fountain"){ toast("⛲ You toss a coin in. Feels lucky."); return; }
  if (o.kind==="tree"){
    if (S.treeRespawn?.[o.id]) {
      const st = getTreeStage(o);
      if (st < 2) { toast(st===0 ? "🌱 This seedling is still sprouting." : "🌿 This sapling needs more time to grow."); return; }
    }
    if (skillLvl("woodcutting") < o.lvl){ toast(`Requires Woodcutting level ${o.lvl}.`); return; }
    if (S.action && S.action.skill==="woodcutting" && S.action.objId===o.id){
      swing(); return;   // M12: click the tree you're chopping to swing (idle continues if you stop)
    }
    tipOnce("woodcutting", SYSTEM_TUTORIAL.woodcutting);
    const act = SKILLS.woodcutting?.actions?.find(a=>a.id===o.ore);
    S.action = { skill:"woodcutting", id:o.ore, objId:o.id, progress:0 };
    toast(`🪓 ${act ? act.n : "Chopping"}...`);
    log(`▶ Started: ${act ? act.n : "Chop Tree"}`);
    renderNav(); save(); return;
  }
  if (o.kind==="rock"){
    if (skillLvl("mining") < o.lvl){ toast(`Requires Mining level ${o.lvl}.`); return; }
    if (S.action && S.action.skill==="mining" && S.action.objId===o.id){
      swing(); return;   // M12: click the rock you're mining to swing (idle continues if you stop)
    }
    tipOnce("mining", SYSTEM_TUTORIAL.mining);
    S.action = { skill:"mining", id:o.ore, objId:o.id, progress:0 };
    toast(`⛏️ Mining ${ITEMS[o.ore].n}...`);
    log(`▶ Started: Mine ${ITEMS[o.ore].n}`);
    renderNav(); save();
    return;
  }
  if (o.kind==="npc"){
    toast(`${o.w.id==="frost"?"❄️":"💬"} ${o.w.n.toUpperCase()}: ` + o.w.tips[Math.floor(Math.random()*o.w.tips.length)]);
    return;
  }
  if (o.id==="town_directory"){ openDistricts(); return; }
  if (o.tab==="robotics_lab" && totalLvl() < 150){ toast(`🤖 The Automation Lab opens at total level 150 (you: ${totalLvl()}).`); return; }
  if (o.tab==="data_centre" && totalLvl() < 200){ toast(`🖥️ The Data Centre opens at total level 200 (you: ${totalLvl()}).`); return; }
  // First visit teaches the system; later visits get the characterful greeting.
  if (!tipOnce(o.tab, SYSTEM_TUTORIAL[o.tab]) && BUILDING_FLAVOUR[o.tab]) toast(BUILDING_FLAVOUR[o.tab]);
  S.tab = o.tab;
  S.roomObjId = o.id;
  IP.x = icanvasW()/2; IP.y = icanvasH() - 34; IP.tx = null; IP.ty = null; IP.moving = false; IP.dir = "up";
  // set trespass flag when entering someone else's home
  if (o.tab === "home"){
    S.trespass = { active: true, homeId: o.id };
    S.fleeUntil = 0;
    if (isNight()) toast(`🤫 ${pName()}: "I probably shouldn't be in here…"`);
  } else {
    S.trespass = { active: false, homeId: null };
    S.fleeUntil = 0;
  }
  renderNav(); renderMain(); showZoneCard(o.tab);
}
function showWandererProfile(w){
  if (!S.npcMet){ S.npcMet = true; }   // Task 9: "First Hello" journal milestone
  const existing = document.getElementById("villager-profile-modal");
  if (existing) existing.remove();
  const p = w.profile || {};
  let rows = "";
  if (p.job) rows += `<div class="vp-row"><span class="vp-lbl">Job</span><span class="vp-val">${p.job}</span></div>`;
  if (p.home) rows += `<div class="vp-row"><span class="vp-lbl">Home</span><span class="vp-val">${p.home}</span></div>`;
  if (p.partner) rows += `<div class="vp-row"><span class="vp-lbl">Partner</span><span class="vp-val">${p.partner}</span></div>`;
  if (p.children && p.children.length) rows += `<div class="vp-row"><span class="vp-lbl">Children</span><span class="vp-val">${p.children.join(", ")}</span></div>`;
  const el = document.createElement("div");
  el.id = "villager-profile-modal";
  el.innerHTML = `<div class="vp-card"><div class="vp-name">${w.n}</div>${rows}<button class="vp-close" onclick="document.getElementById('villager-profile-modal').remove()">✕</button></div>`;
  document.body.appendChild(el);
}
function _scheduleStr(phase, workKind){
  const hr = gameHour();
  const hh = (h) => `${String(Math.floor(h)).padStart(2,"0")}:${h%1===0.5?"30":"00"}`;
  if (phase==="sleep") return `😴 Sleeping · home until ${hh(6.5)}`;
  if (phase==="work"){
    if (workKind==="stall") return `🏪 At stall until ${hh(18.5)}`;
    return `⚒️ At work until ${hh(18.5)}`;
  }
  return `🌿 Leisure until ${hh(22)}`;
}
function showVillagerProfile(v){
  if (!S.npcMet){ S.npcMet = true; }   // Task 9: "First Hello" journal milestone
  const existing = document.getElementById("villager-profile-modal");
  if (existing) existing.remove();
  const homeObj = V_OBJECTS.find(o => o.id === v.homeId);
  const workObj = V_OBJECTS.find(o => o.id === v.workId);
  const homeName = homeObj?.name || v.homeId;
  const workName = workObj?.name || v.workId;
  const partnerName = v.partner ? (VILLAGER_STATE.find(p => p.id === v.partner)?.n || v.partner) : null;
  let rows = `<div class="vp-row"><span class="vp-lbl">Home</span><span class="vp-val">${homeName}</span></div>`;
  rows += `<div class="vp-row"><span class="vp-lbl">Works at</span><span class="vp-val">${workName}</span></div>`;
  if (partnerName) rows += `<div class="vp-row"><span class="vp-lbl">Partner</span><span class="vp-val">${partnerName}</span></div>`;
  if (v.children && v.children.length) rows += `<div class="vp-row"><span class="vp-lbl">Children</span><span class="vp-val">${v.children.join(", ")}</span></div>`;
  rows += `<div class="vp-schedule">${_scheduleStr(v.phase, v.workKind)}</div>`;
  const el = document.createElement("div");
  el.id = "villager-profile-modal";
  el.innerHTML = `<div class="vp-card"><div class="vp-name">${v.n}</div>${rows}<button class="vp-close" onclick="document.getElementById('villager-profile-modal').remove()">✕</button></div>`;
  document.body.appendChild(el);
}
function villageClick(e){
  const cv = document.getElementById("village");
  if (!cv) return;
  const rect = cv.getBoundingClientRect();
  const wx = (e.clientX-rect.left)*(cv.width/rect.width) + CAM.x;
  const wy = (e.clientY-rect.top)*(cv.height/rect.height) + CAM.y;
  // check for outdoor villager click
  for (const v of VILLAGER_STATE){
    if (v.indoor || v.phase === "sleep") continue;
    if (Math.hypot(wx-v.x, wy-v.y) < 20){ showVillagerProfile(v); return; }
  }
  for (const w of WANDERERS){
    if (Math.hypot(wx-w.x, wy-w.y) < 20){ showWandererProfile(w); return; }
  }
  // the children's lemonade stand (when it's open)
  if (lemonadeOpen()){
    const _lsx = (LEMONADE.tx+0.5)*TILE, _lsy = LEMONADE.ty*TILE;
    if (Math.abs(wx-_lsx) < TILE*1.1 && wy > _lsy-TILE*1.2 && wy < _lsy+TILE*1.4){ openLemonadeStand(); return; }
  }
  for (const o of V_OBJECTS){
    const r = objRect(o), pad=6;
    if (wx>=r.x-pad && wx<=r.x+r.w+pad && wy>=r.y-pad && wy<=r.y+r.h+pad){
      const ap = objApproach(o);
      if (Math.hypot(VP.x-ap.x, VP.y-ap.y) < 46) interactObj(o);
      else { VP.tx=ap.x; VP.ty=ap.y; VP.pending=o; }
      return;
    }
  }
  VP.tx = Math.max(TILE, Math.min((VCOLS-1)*TILE, wx));
  VP.ty = Math.max(TILE, Math.min((VROWS-1)*TILE, wy));
  VP.pending = null;
}
// Draws a proper pixel tool in the swinging arm's local frame (arm points +y, so
// the handle runs down the arm and the tier-coloured head sits at the far end).
function drawSwingTool(ctx, type, color){
  color = color || "#9aa2ad";
  ctx.fillStyle = "#8a5a2a";                 // wooden handle
  ctx.fillRect(-1, 3, 2, 12);
  ctx.fillStyle = "#6a431e";                 // handle shade
  ctx.fillRect(0, 3, 1, 12);
  ctx.fillStyle = color;
  if (type === "pick"){
    ctx.fillRect(-6, 13, 12, 3);             // cross bar
    ctx.beginPath(); ctx.moveTo(-6,12); ctx.lineTo(-10,15); ctx.lineTo(-6,16); ctx.closePath(); ctx.fill();  // left point
    ctx.beginPath(); ctx.moveTo(6,12);  ctx.lineTo(10,15);  ctx.lineTo(6,16);  ctx.closePath(); ctx.fill();  // right point
    ctx.fillStyle = "#ffffff66"; ctx.fillRect(-5, 13, 10, 1);   // top highlight
  } else if (type === "axe"){
    ctx.fillRect(1, 11, 6, 8);               // blade
    ctx.beginPath(); ctx.moveTo(7,11); ctx.lineTo(9,15); ctx.lineTo(7,19); ctx.closePath(); ctx.fill();      // curved edge
    ctx.fillStyle = "#dfe6ef"; ctx.fillRect(6, 12, 1, 6);       // edge shine
  } else { // hammer
    ctx.fillRect(-4, 11, 8, 6);              // block head
    ctx.fillStyle = "#dfe6ef"; ctx.fillRect(-4, 11, 8, 1);      // shine
    ctx.fillStyle = "#00000033"; ctx.fillRect(-4, 16, 8, 1);    // shade
  }
}
function drawPerson(ctx, x, y, hair, shirt, t, moving, facing, tool, dir, skin, trouser, toolColor, female, scale=1.0, hat='none', hatColor='#2a1a0a', opts:any={}){
  skin    = skin    || "#f2c49a";
  trouser = trouser || "#4a5a8a";
  dir = dir || (facing>=0 ? "right" : "left");
  const _hs  = +( opts.hairStyle ?? 0 ) || 0;
  const _eye = opts.eyeColor  || '#17161a';
  const _fh  = opts.facialHair|| 'none';
  const _jk  = opts.jacket    || '';
  const _sh  = opts.shoes     || '';
  const _acc = opts.accessory || 'none';
  const _scf = opts.scarfColor|| '#c04040';
  const _fem = female || false;
  const _stride = +(opts.stride) || 1;   // >1 exaggerates the walk cycle (used by the big previews)
  const bob = moving ? Math.sin(t*10)*1.5 : Math.sin(t*2)*0.6;
  // ---- activity detection: which activity (if any) the character is performing ----
  // The tool-side arm is REPLACED by an animated activity arm so the character
  // visibly does the work rather than a prop moving next to a static body.
  const _swingType = (!moving && tool==="⛏️") ? "pick" : (!moving && tool==="🪓") ? "axe" : (!moving && tool==="🔨") ? "hammer" : null;
  const _fishing = !moving && tool === "🎣";
  const _forage = tool === "🌿" && !moving;
  const _manu = !moving && (tool === "🔧" || tool === "🫙");   // workbench / artisan work
  const _activity = _swingType ? "swing" : _fishing ? "fish" : _forage ? "forage" : _manu ? "manu" : null;
  let _fPhase = 0, _fBend = 0;
  if (_forage){ const FP = 1.3; _fPhase = (((t % FP) + FP) % FP) / FP; _fBend = _fPhase < 0.65 ? Math.sin(_fPhase/0.65*Math.PI) : 0; }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y+bob));
  if (scale !== 1.0) ctx.scale(scale, scale);
  // shadow (drawn before the crouch so it stays planted on the ground)
  ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 10-bob, 8, 3, 0, 0, 7); ctx.fill();
  // apply the crouch squash to the body only (feet stay planted)
  if (_fBend > 0){ const s = 1 - _fBend*0.16; ctx.translate(facing*_fBend*2, 10*(1-s)); ctx.scale(1, s); }
  const legSwing = moving ? Math.sin(t*10)*3*_stride : 0;
  const armSwing = moving ? Math.sin(t*10+Math.PI)*3*_stride : 0;   // arms swing opposite to legs
  // alternating foot lift — only kicks in when the walk is exaggerated (stride>1),
  // so ordinary in-world sprites are unchanged (lift = 0 at stride 1).
  const _phase = moving ? Math.sin(t*10) : 0;
  const _lift  = (_stride - 1) * 2;
  const _lL = _phase > 0 ?  _lift * _phase  : 0;
  const _lR = _phase < 0 ?  _lift * -_phase : 0;
  // legs
  ctx.fillStyle=trouser;
  ctx.fillRect(-5, 2-_lL, 4, 8+legSwing*0.4); ctx.fillRect(1, 2-_lR, 4, 8-legSwing*0.4);
  // shoes
  if (_sh){ ctx.fillStyle=_sh; ctx.fillRect(-6,8+legSwing*0.4-_lL,5,2); ctx.fillRect(0,8-legSwing*0.4-_lR,5,2); }
  // shirt body + arms. During an activity BOTH base arms are skipped — the activity
  // block below draws its own arms (a working arm + a supporting arm), so no static
  // limb is left showing next to the animated one.
  ctx.fillStyle=shirt; ctx.fillRect(-7,-6,14,10);
  if (!_activity){
    ctx.fillRect(-9,-5+armSwing*0.3,3,8); ctx.fillRect(6,-5-armSwing*0.3,3,8);
    ctx.fillStyle=skin; ctx.fillRect(-9,2+armSwing*0.3,3,3); ctx.fillRect(6,2-armSwing*0.3,3,3);
  }
  // jacket overlay (torso always; arms only when not doing an activity)
  if (_jk){ ctx.fillStyle=_jk; ctx.fillRect(-7,-6,14,8); if (!_activity){ ctx.fillRect(-9,-5+armSwing*0.3,3,6); ctx.fillRect(6,-5-armSwing*0.3,3,6); } }
  // head
  ctx.fillStyle=skin; ctx.fillRect(-5,-16,10,10);
  // scarf at neck
  if (_acc==='scarf'){ ctx.fillStyle=_scf; ctx.fillRect(-6,-7,12,3); }
  // hair
  ctx.fillStyle=hair;
  if (dir==="up"){
    // back of head — all styles show a solid back cap
    if (_hs===7){ ctx.fillRect(-8,-22,16,14); }            // afro: very wide back
    else if (_hs===2){ ctx.fillRect(-7,-20,14,12); }       // curly: taller back
    else { ctx.fillRect(-6,-18,12,10); }                   // default back cap
    if (_hs===3){ ctx.fillRect(-3,-23,6,6); }              // bun bump on back
    if (_hs===4){ ctx.fillRect(facing>=0?-7:4,-14,3,18); } // ponytail hanging down back
    if (_fem && _hs<=1){ ctx.fillRect(-8,-14,3,12); ctx.fillRect(5,-14,3,12); } // female flowing back strands
  } else {
    // front/side view — base cap + style
    ctx.fillRect(-6,-18,12,5); // base hair cap
    switch(_hs){
      case 0: // straight
        if (_fem){ ctx.fillRect(-8,-16,3,15); ctx.fillRect(5,-16,3,15); }
        else { ctx.fillRect(-6,-16,2,5); ctx.fillRect(4,-16,2,5); }
        break;
      case 1: // wavy — slightly more volume
        ctx.fillRect(-7,-18,14,5);
        ctx.fillRect(-8,-16,3,10); ctx.fillRect(5,-16,3,7);
        if (_fem){ ctx.fillRect(-8,-14,2,12); }
        break;
      case 2: // curly — wide puff
        ctx.fillRect(-7,-20,14,7);
        ctx.fillRect(-8,-17,3,9); ctx.fillRect(5,-17,3,9);
        break;
      case 3: // bun — tight sides + bun top
        ctx.fillRect(-3,-23,6,6);                          // bun
        ctx.fillRect(-6,-17,2,4); ctx.fillRect(4,-17,2,4); // tight sides
        break;
      case 4: // ponytail
        ctx.fillRect(-5,-16,2,5);                          // left side
        ctx.fillRect(facing>=0?4:-7,-17,3,16);             // ponytail (away from camera)
        break;
      case 5: // short crop — minimal
        ctx.fillRect(-5,-18,10,3);                         // tighter cap
        ctx.fillRect(-5,-16,1,3); ctx.fillRect(4,-16,1,3); // tiny stubs
        break;
      case 6: // side sweep
        ctx.fillRect(-9,-17,6,4);                          // swept left
        ctx.fillRect(4,-17,2,4);
        break;
      case 7: // afro — wide puff
        ctx.fillRect(-8,-22,16,7);
        ctx.fillRect(-10,-19,5,8); ctx.fillRect(5,-19,5,8);
        break;
    }
    // eyes
    ctx.fillStyle=_eye;
    if (dir==="down"){ ctx.fillRect(-3,-11,2,2); ctx.fillRect(2,-11,2,2); ctx.fillStyle="#c96f4a"; ctx.fillRect(-1,-8,3,1); }
    else { ctx.fillRect(facing>=0?0:-2,-11,2,2); ctx.fillRect(facing>=0?3:-5,-11,2,2); }
    // glasses
    if (_acc==='glasses' && dir!=='up'){
      ctx.save(); ctx.strokeStyle='#3a3a3a'; ctx.lineWidth=0.7;
      if (dir==='down'){ ctx.strokeRect(-4,-13,3,3); ctx.strokeRect(1,-13,3,3); ctx.beginPath(); ctx.moveTo(-1,-11); ctx.lineTo(1,-11); ctx.stroke(); }
      else { ctx.strokeRect(facing>=0?-1:-5,-13,3,3); }
      ctx.restore();
    }
    // earrings
    if (_acc==='earrings'){ ctx.fillStyle='#e8c040'; ctx.fillRect(-7,-12,2,3); ctx.fillRect(5,-12,2,3); }
    // facial hair (drawn on chin, down/side only)
    if (_fh!=='none'){
      ctx.fillStyle=hair;
      if (_fh==='stubble' && dir==='down'){ ctx.fillRect(-3,-9,2,1); ctx.fillRect(0,-9,2,1); ctx.fillRect(2,-9,2,1); ctx.fillRect(-2,-7,2,1); ctx.fillRect(1,-7,2,1); }
      else if (_fh==='short'){ if(dir==='down') ctx.fillRect(-3,-9,7,3); else ctx.fillRect(facing>=0?0:-4,-9,4,3); }
      else if (_fh==='full'){ if(dir==='down'){ ctx.fillRect(-4,-9,9,5); ctx.fillRect(-3,-6,8,2); } else ctx.fillRect(facing>=0?0:-4,-9,4,5); }
    }
  }
  // hat (optional)
  if (hat && hat !== 'none'){
    ctx.fillStyle = hatColor || '#2a1a0a';
    if (hat === 'flat_cap'){
      ctx.fillRect(-8,-20,16,3); ctx.fillRect(-5,-23,10,4);
    } else if (hat === 'beanie'){
      ctx.fillRect(-6,-23,12,7);
      ctx.fillStyle = (hatColor||'#2a1a0a') + 'cc'; ctx.fillRect(-7,-17,14,3);
    } else if (hat === 'sun_hat'){
      ctx.fillRect(-11,-18,22,3); ctx.fillRect(-5,-22,10,5);
      ctx.fillStyle = (hatColor||'#c8a020') + '88'; ctx.fillRect(-10,-16,22,2);
    }
  }
  // Strike tools (pick / axe / hammer) get a proper animation cycle: a slow
  // wind-up raising the tool overhead, a fast downswing, an impact with sparks
  // and dust, then an ease back to rest. Non-strike tools keep a gentle emoji.
  if (_swingType){
    const PERIOD = 0.85;                                   // seconds per full swing
    const p = (((t % PERIOD) + PERIOD) % PERIOD) / PERIOD; // phase 0..1
    const REST = -0.30, UP = -2.30, HIT = 0.72;            // arm angles (radians)
    const easeOut = u => 1-(1-u)*(1-u);
    const easeIn  = u => u*u;
    const easeIO  = u => u<0.5 ? 2*u*u : 1-Math.pow(-2*u+2,2)/2;
    let ang, dip = 0;
    if (p < 0.50){ ang = REST + (UP-REST)*easeOut(p/0.50); }            // wind up (slow)
    else if (p < 0.64){ const u=(p-0.50)/0.14; ang = UP + (HIT-UP)*easeIn(u); dip = u*1.4; }  // downswing (fast)
    else { const u=(p-0.64)/0.36; ang = HIT + (REST-HIT)*easeIO(u); dip = 1.4*(1-u); }         // recover
    const impact = (p>=0.60 && p<0.75) ? 1-(p-0.60)/0.15 : 0;
    // rear arm braces the body
    ctx.fillStyle=shirt; ctx.fillRect(facing*-8,-4,3,7);
    ctx.fillStyle=skin;  ctx.fillRect(facing*-8,2,3,3);
    // swinging arm + tool, pivoted at the shoulder, with a small impact dip
    ctx.save();
    ctx.translate(facing*5, -6 + dip);
    ctx.rotate(facing*ang);
    ctx.fillStyle=shirt; ctx.fillRect(-1.5,0,3,7);        // upper arm
    ctx.fillStyle=skin;  ctx.fillRect(-1.5,6,3,4);        // hand grips handle
    drawSwingTool(ctx, _swingType, toolColor);
    ctx.restore();
    // impact flash — sparks + a puff of dust where the tool lands
    if (impact > 0){
      const hx = facing*15, hy = 9 + dip;
      ctx.save(); ctx.globalAlpha = impact;
      ctx.fillStyle = _swingType==="axe" ? "#f6e0a0" : "#fff4c0";
      for (let i=0;i<5;i++){ const a=-0.5+i*0.5, d=4+(1-impact)*8; ctx.fillRect(Math.round(hx+Math.cos(a)*d), Math.round(hy-Math.sin(a)*d), 2, 2); }
      ctx.fillStyle = "rgba(168,150,112,.5)"; ctx.fillRect(hx-3, hy+2, 7, 2);
      ctx.restore();
    }
  } else if (tool === "🌿"){
    // foraging: a hand reaches to the ground, then gathered specks pop up when picked
    const reach = _fBend;
    // support arm braced on the knee
    ctx.fillStyle=shirt; ctx.fillRect(facing*-8, -3, 3, 7); ctx.fillStyle=skin; ctx.fillRect(facing*-8, 3, 3, 3);
    ctx.save(); ctx.translate(facing*6, -3); ctx.rotate(facing*(0.5 + reach*0.8));
    ctx.fillStyle=shirt; ctx.fillRect(-1.5, 0, 3, 6+reach*3);
    ctx.fillStyle=skin;  ctx.fillRect(-1.5, 6+reach*3, 3, 3);
    ctx.restore();
    if (_fPhase > 0.5 && _fPhase < 0.95){
      const pp = (_fPhase-0.5)/0.45;
      const cols = ["#6a9a3a","#8a4a9a","#c07a3a"];
      for (let i=0;i<3;i++){ ctx.globalAlpha = 1-pp; ctx.fillStyle = cols[i]; ctx.fillRect(facing*8 + i*2 - 2, -4 - pp*15 - i*2, 2, 2); }
      ctx.globalAlpha = 1;
    }
  } else if (_fishing){
    // fishing: the character raises an arm and holds a rod pointing up toward the
    // water, with a rapid reel jerk while a fish is on. The line/bobber are drawn
    // by the water so they connect to this rod tip (published in _fishRodTip).
    const now = (typeof performance!=="undefined"?performance.now():Date.now());
    const reeling = (now - _fishCatchT) < 900;
    const jerk = reeling ? Math.sin((now - _fishCatchT)/45)*2 : 0;
    const sway = Math.sin(t*1.5)*0.8;
    const gripX = facing*4, gripY = -4;
    const tipX = facing*7 + sway + jerk*0.4, tipY = -26 - jerk*0.5;
    // lower support hand on the rod butt + raised arm gripping higher up
    ctx.fillStyle=shirt; ctx.fillRect(facing*-6, -3, 3, 6); ctx.fillStyle=skin; ctx.fillRect(facing*-6, 3, 3, 3);   // support arm
    ctx.fillStyle=shirt; ctx.fillRect(facing*3-1, -7, 3, 6);   // upper arm reaching up
    ctx.fillStyle=skin;  ctx.fillRect(gripX-1, gripY-1, 3, 3); // hand on the grip
    // the rod
    ctx.strokeStyle="#7a4f26"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle="#9a6f36"; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.fillStyle="#e8d84a"; ctx.fillRect(Math.round(tipX)-1, Math.round(tipY)-1, 2, 2);   // rod-tip guide
    // publish the rod tip in world space (scale assumed 1 for in-world sprites)
    _fishRodTip = { x: Math.round(x) + tipX, y: Math.round(y+bob) + tipY };
  } else if (_manu){
    // manufacturing / crafting: both hands work at the bench in front, moving in an
    // alternating rhythm, with the odd spark or glint on the work beat.
    const wp = Math.sin(t*7), wp2 = Math.sin(t*7 + 1.4);
    ctx.fillStyle=shirt;
    ctx.fillRect(facing*2-1, -6 + wp*1.3, 3, 7);       // near arm
    ctx.fillRect(facing*6-1, -6 + wp2*1.3, 3, 7);      // far arm
    ctx.fillStyle=skin;
    ctx.fillRect(facing*2-1, wp*1.3, 3, 3);            // near hand
    ctx.fillRect(facing*6-1, 1 + wp2*1.3, 3, 3);       // far hand
    // the part being worked, sitting on the bench in front
    ctx.fillStyle = tool==="🫙" ? "#b8925a" : "#8a94a2"; ctx.fillRect(facing*3, 4, 6, 3);
    if (wp > 0.85){ for (let i=0;i<3;i++){ ctx.fillStyle = i%2 ? "#ffe070" : (tool==="🫙"?"#ffd0a0":"#9ad8ff"); ctx.fillRect(facing*5 + i*2 - 1, 1 - i, 2, 2); } }
  } else if (tool){
    // gentle handheld emoji for anything else
    const sway = Math.sin(t*4)*0.18;
    ctx.save(); ctx.translate(facing*9,-4); ctx.rotate(facing*(sway-0.2));
    ctx.font="14px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(tool, facing*7,-6);
    ctx.restore();
  }
  ctx.restore();
}
function drawChild(ctx, x, y, hair, shirt, t, moving, dir, trouser, female, sz){
  // crisp pixel-art child — no ctx.scale() to avoid blur; draws proportionally smaller using integer coords
  // sz: 0=tiny(age≤6), 1=small(age7-10), 2=medium(age11-14)
  trouser = trouser || "#4a5a8a";
  const skin = "#f2c49a";
  const D = sz===0 ? [6,5,5,6,5] : sz===1 ? [8,6,6,7,6] : [10,7,7,8,7];
  const [bW,bH,lH,hW,hH] = D;
  const bHalf=bW>>1, hHalf=hW>>1;
  const bob = moving ? Math.round(Math.sin(t*10)*0.9) : 0;
  const ix = Math.round(x), iy = Math.round(y) + bob;
  const lsw = (moving && Math.sin(t*10)>0) ? 1 : 0;
  ctx.save();
  ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(ix,iy+1,bHalf+2,2,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=trouser;
  ctx.fillRect(ix-bHalf, iy-lH, Math.max(1,bHalf-1), lH+lsw);
  ctx.fillRect(ix+1, iy-lH, Math.max(1,bHalf-1), lH-lsw);
  ctx.fillStyle=shirt; ctx.fillRect(ix-bHalf, iy-lH-bH, bW, bH);
  ctx.fillStyle=skin;
  if(dir==="right") ctx.fillRect(ix-bHalf-2, iy-lH-bH+1, 2, bH-1);
  else if(dir==="left") ctx.fillRect(ix+bHalf, iy-lH-bH+1, 2, bH-1);
  else{ ctx.fillRect(ix-bHalf-2,iy-lH-bH+1,2,bH-1); ctx.fillRect(ix+bHalf,iy-lH-bH+1,2,bH-1); }
  ctx.fillStyle=skin; ctx.fillRect(ix-hHalf, iy-lH-bH-hH, hW, hH);
  ctx.fillStyle=hair; ctx.fillRect(ix-hHalf, iy-lH-bH-hH, hW, Math.max(2,hH>>1));
  if(female) ctx.fillRect(ix+hHalf-2, iy-lH-bH-hH+(hH>>1), 2, (hH>>1)+3);
  ctx.restore();
}
function drawEmojiC(ctx, em, x, y, px){ ctx.font = px+"px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(em, x, y); }
// Draw board/sign text that ALWAYS fits within maxW by shrinking the font (down to a
// floor) — so captions never spill outside their panel. Sets alignment explicitly so
// it never depends on leftover canvas state. Centered by default.
function fitText(ctx, text, cx, y, maxW, maxPx, opts){
  opts = opts || {};
  const family = opts.family || "'IBM Plex Mono',monospace";
  const weight = opts.weight || "";
  const min = opts.min || 4;
  ctx.textAlign = opts.align || "center";
  ctx.textBaseline = opts.baseline || "top";
  let px = maxPx;
  while (px > min){
    ctx.font = (weight ? weight+" " : "") + px + "px " + family;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 0.5;
  }
  ctx.fillText(text, cx, y);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";   // restore defaults
  return px;
}
function drawOccy(ctx, cx, cy, t, sz){
  const s = sz / 18;
  // tentacles — 8 animated wavy arms
  ctx.lineWidth = Math.max(1, 2.5*s);
  for(let i=0;i<8;i++){
    const ox = cx + (i - 3.5) * 3.2 * s;
    const wave = Math.sin(t*2.2 + i*0.75) * 4*s;
    ctx.strokeStyle = i===3||i===4 ? "#2a70c0" : "#3a88d8";
    ctx.beginPath();
    ctx.moveTo(ox, cy + 6*s);
    ctx.quadraticCurveTo(ox + wave, cy + 12*s, ox - wave*0.6, cy + 19*s);
    ctx.stroke();
  }
  // body
  ctx.fillStyle = "#4a9ae8";
  ctx.beginPath(); ctx.ellipse(cx, cy, 13*s, 11*s, 0, 0, Math.PI*2); ctx.fill();
  // mantle shading (top)
  ctx.fillStyle = "#2a7ad0";
  ctx.beginPath(); ctx.ellipse(cx, cy - 4*s, 13*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
  // highlight shimmer
  ctx.fillStyle = "rgba(160,220,255,0.55)";
  ctx.beginPath(); ctx.ellipse(cx - 4*s, cy - 4*s, 5*s, 3.5*s, -0.5, 0, Math.PI*2); ctx.fill();
  // eyes — white
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(cx - 5*s, cy - 1*s, 4*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5*s, cy - 1*s, 4*s, 0, Math.PI*2); ctx.fill();
  // pupils
  ctx.fillStyle = "#111122";
  ctx.beginPath(); ctx.arc(cx - 4.5*s, cy - 1*s, 2*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5.5*s, cy - 1*s, 2*s, 0, Math.PI*2); ctx.fill();
  // eye shine
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(cx - 3.8*s, cy - 2*s, 0.9*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6.2*s, cy - 2*s, 0.9*s, 0, Math.PI*2); ctx.fill();
}
// HX2 household prop library — draws one prop at anchor (x,y). Canvas props keep
// full positional control; "tile:" keys use verified Roguelike Interior tiles.
function _homeProp(ctx, k, x, y, W, H, t, _ft, pal){
  const _R=(c,X,Y,w,h)=>{ ctx.fillStyle=c; ctx.fillRect(X|0,Y|0,w|0,h|0); };
  const _E=(e,X,Y,s)=>drawEmojiC(ctx,e,X,Y,s);
  const _SR=(c,X,Y,w,h,lw=1)=>{ ctx.strokeStyle=c; ctx.lineWidth=lw; ctx.strokeRect((X|0)+.5,(Y|0)+.5,w-1,h-1); };
  if (k.indexOf("tile:")===0){
    const T={ bookshelf:[8,2,1,2,"#6a4228"], plant:[14,0,1,2,"#3a8a2a"], fireplace:[22,0,2,2,"#4a3020"],
              table:[4,0,2,2,"#7a5030"], sofa:[0,4,3,1,"#7a5a60"], cabinet:[12,0,1,2,"#6a4228"] }[k.slice(5)];
    if (T) _ft(T[0],T[1],x,y,T[2],T[3],T[4]);
    return;
  }
  const tall=(body,door,items,glass)=>{ const h=Math.max(40,H-y-14), w=26;
    _R(body,x,y,w,h); _R(door,x+2,y+2,w-4,h-4);
    _SR("rgba(0,0,0,.2)",x,y,w,h); _R("rgba(0,0,0,.2)",x+w/2-0.5,y+4,1,h-8);
    if(glass) _R("rgba(180,210,230,.22)",x+3,y+3,w-6,h-6);
    if(items) items.forEach((e,i)=>_E(e,x+w/2,y+16+i*20,10));
  };
  const counter=(len,top,body,items)=>{ _R(body,x,y+6,len,16); _R(top,x,y+4,len,4);
    _SR("rgba(0,0,0,.15)",x,y+6,len,16);
    if(items) items.forEach((e,i)=>_E(e,x+12+i*22,y-2,10));
  };
  const chair=(col,dark,back)=>{ _R("rgba(0,0,0,.12)",x-2,y+16,24,4);
    _R(col,x-3,y+2,4,13); _R(col,x+19,y+2,4,13); _R(col,x,y,20,16); _R(dark,x+2,y+12,16,4);
    if(back) _R(col,x,y-6,20,7);
  };
  switch(k){
    // ---- HX3 zone clusters ----
    case "kitchen_run": {
      _R("#6a4a30",x,y+6,118,16); _R("#8a6a44",x,y+4,118,4); _SR("rgba(0,0,0,.18)",x,y+6,118,16);
      _R("#3a3a40",x+6,y+8,22,12); _R("#1e1e22",x+9,y+11,6,5); _R("#1e1e22",x+18,y+11,6,5);   // stove
      _R("#b8c0c4",x+40,y+8,20,12); _R("#8a9498",x+43,y+10,14,7);                              // sink
      _E("🍞",x+74,y+1,10); _E("🫖",x+94,y+1,10);                                              // worktop
      _R("#7a5a38",x+2,y-14,58,4); _E("🫙",x+9,y-18,9); _E("🍯",x+27,y-18,9); _E("🧂",x+45,y-18,8); // shelf
      break; }
    case "dining_set": {
      _R("#7a5230",x+9,y-6,20,7); _R("#7a5230",x+9,y+26,20,7);
      _R("#8a6238",x+4,y+2,30,20); _R("#9a7248",x+4,y,30,4); _SR("rgba(0,0,0,.2)",x+4,y+2,30,20);
      _E("🍽️",x+19,y+11,11); break; }
    case "dining_big": {
      _R("#7a5230",x+8,y-6,18,7); _R("#7a5230",x+32,y-6,18,7); _R("#7a5230",x+18,y+26,22,7);
      _R("#8a6238",x+4,y+2,52,20); _R("#9a7248",x+4,y,52,4); _SR("rgba(0,0,0,.2)",x+4,y+2,52,20);
      _E("🍲",x+18,y+11,11); _E("🍞",x+40,y+11,9); break; }
    case "living_set": {
      _R("#7a5a4a",x+2,y+2,18,4); _R("#7a5a4a",x+2,y+46,18,5);                    // sofa arms
      _R("#7a5a4a",x+2,y+4,18,44); _R("#6a4a3a",x+2,y+4,6,44); _R("#8a6a58",x+9,y+9,9,34);
      _SR("rgba(0,0,0,.2)",x+2,y+4,18,44);
      _R("#8a5f38",x+44,y+12,26,14); _R("#9a6f44",x+44,y+10,26,3); _SR("rgba(0,0,0,.18)",x+44,y+12,26,14);
      _E("🍵",x+57,y+8,9);                                                       // coffee table
      _R("#4a3a2a",x+95,y+30,3,18); _E("💡",x+96,y+21,12);                        // floor lamp
      break; }
    case "bedside": {
      _R("#7a5230",x,y+2,16,22); _R("#8a6238",x,y,16,4); _SR("rgba(0,0,0,.2)",x,y+2,16,22);
      _R("#6a4228",x+2,y+9,12,5); _E("🕯️",x+8,y-4,11); break; }
    case "div_screen": {
      for(let i=0;i<4;i++){ _R(i%2?"#9a8468":"#b4a488",x,y+i*18,6,17); _SR("rgba(0,0,0,.22)",x,y+i*18,6,17); }
      break; }
    case "entry_mat": {
      _R("#9a7850",x,y,32,10); _SR("#6a4a30",x,y,32,10,1.5);
      for(let i=0;i<5;i++) _R("rgba(0,0,0,.12)",x+3+i*6,y+2,2,6); break; }
    case "entry_plant": {
      _R("#8a5a34",x,y+10,12,10); _R("#7a4a28",x,y+18,12,2);
      ctx.fillStyle="#3a8a3a"; ctx.beginPath(); ctx.arc(x+6,y+6,8,0,7); ctx.fill();
      ctx.fillStyle="#4aa048"; ctx.beginPath(); ctx.arc(x+2,y+2,5,0,7); ctx.arc(x+10,y+3,5,0,7); ctx.fill();
      break; }
    case "toy_corner": {
      ctx.fillStyle="#b08850"; ctx.beginPath(); ctx.ellipse(x+10,y+10,13,7,0,0,7); ctx.fill();
      ctx.fillStyle="#c89a60"; ctx.beginPath(); ctx.ellipse(x+10,y+8,11,5,0,0,7); ctx.fill();
      _E("🧸",x+8,y+1,12); _R("#e05a5a",x+22,y+8,7,7); _R("#5a9ae0",x+29,y+9,7,7); _R("#e0b84a",x+26,y+1,7,7);
      break; }
    case "bookshelf_tall": {
      const bh=Math.max(40,H-y-14);
      _R("#5a3a22",x,y,26,bh); _SR("rgba(0,0,0,.25)",x,y,26,bh);
      for(let r=0;r*22<bh-8;r++){ const sy=y+6+r*22;
        _R("#4a2e1a",x+2,sy+16,22,3);
        const cols=["#c94a3a","#4a6ec9","#c99a4a","#4ac96a","#9a4ac9","#c96a2a"];
        for(let b=0;b<5;b++) _R(cols[(r*5+b)%6],x+3+b*4,sy,3,15);
      }
      break; }
    // tall units
    case "wardrobe":       tall("#3a2a1a","#5a4030",null); _R("#7a5a30",x+18,y+18,3,3); break;
    case "filing_cabinet": tall("#5a6478","#8a94a8",null); for(let i=0;i<3;i++){ _R("#c4ccd8",x+4,y+10+i*18,18,12); _R("#33405a",x+11,y+15+i*18,4,2);} break;
    case "display_case":   tall("#4a3626","#6a5038",["🏆","📖","🖼️"],true); break;
    case "metal_shelf":    tall("#3a3a42","#55555f",["⚙️","🔧","🔩"]); break;
    case "sea_cabinet":    tall("#2a4a6a","#3f6a8a",["🐚","🌊"]); break;
    case "egg_dresser":    tall("#6a4a28","#8a6238",["🥚","🧺","🌿"]); break;
    case "tool_chest":     _R("#4a4a52",x,y,30,16); _R("#5a5a62",x+2,y+2,26,5); _R("#3a3a42",x+2,y+9,26,5); _E("🔧",x+15,y+7,9); break;
    // counters
    case "kitchen_counter": counter(W*0.30,"#c0a880","#8a5a30",["🫙","🍵","🧺"]); break;
    case "workbench":       counter(W*0.28,"#8a6a3a","#5a3f22",["🪚","🔨","🪵"]); break;
    // wall decor
    case "tea_shelf":     _R("#7a5a30",x,y,56,5); _E("🫖",x+9,y-4,10); _E("☕",x+28,y-4,9); _E("🍯",x+46,y-4,9); break;
    case "framed_certs":  _R("#33405a",x,y,20,15); _R("#c4ccd8",x+2,y+2,16,11); _R("#33405a",x+26,y,20,15); _R("#e6ecf2",x+28,y+2,16,11); break;
    case "wall_photos":   _R("#5a3a18",x,y,22,17); _R("#a0c0d8",x+2,y+2,18,13); _R("#5a3a18",x+30,y,22,17); _R("#d0c0a0",x+32,y+2,18,13); break;
    case "tool_hooks":    _R("#4a3020",x-4,y+11,60,4); _E("🔨",x+2,y,10); _E("🗜️",x+24,y,10); _E("🔩",x+46,y,9); break;
    case "axe_wall":      _R("#6a4a28",x-2,y+11,58,4); _E("🪓",x+8,y,12); _E("🪚",x+34,y+1,11); break;
    case "hanging_net":   ctx.strokeStyle="rgba(210,200,170,.5)"; ctx.lineWidth=0.9; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(x+i*11,y+8,10+i*2,0,Math.PI); ctx.stroke(); } _R("#5a4020",x-4,y-2,12,4); break;
    case "nav_chart":     _R("#2a4a6a",x,y,44,28); _R("#7aa0c8",x+2,y+2,40,24); ctx.fillStyle="#c8e4ff"; ctx.beginPath(); ctx.arc(x+22,y+14,7,0,7); ctx.fill(); _R("#2a4a6a",x+22,y+6,1,16); _R("#2a4a6a",x+15,y+14,14,1); break;
    case "route_board":   _R("#6a5030",x,y,34,28); _R("#c0a870",x+2,y+2,30,24); _R("rgba(60,80,160,.35)",x+4,y+4,26,20); for(let i=0;i<3;i++)_R("rgba(200,60,60,.6)",x+8+i*7,y+7+i*4,12,2); _E("📍",x+9,y+9,7); break;
    case "pinned_manifests": _R("#e8e0c8",x,y,14,18); _R("#e0d8bc",x+18,y+2,14,18); _R("#ece4cc",x+36,y,14,18); _E("📄",x+7,y+9,8); break;
    case "bunting":       for(let i=0;i<7;i++){ ctx.fillStyle=["#e05a5a","#e0b84a","#5ab46a","#5a9ae0"][i%4]; ctx.beginPath(); ctx.moveTo(x+i*16,y); ctx.lineTo(x+i*16+12,y); ctx.lineTo(x+i*16+6,y+9); ctx.closePath(); ctx.fill(); } break;
    case "rosettes":      _E("🏵️",x,y,13); _E("🎀",x+20,y+2,12); _R("#c8a020",x-2,y+16,28,3); break;
    case "herb_bunches":  _E("🌿",x,y,12); _E("🌾",x+18,y+1,12); _E("🧄",x+36,y,11); break;
    case "knife_rack":    _R("#5a4028",x,y,44,6); for(let i=0;i<4;i++){ _R("#c8ccd4",x+6+i*10,y+6,2,10); _R("#3a2a1a",x+5+i*10,y+15,4,3); } break;
    // chairs
    case "armchair":      chair("#8a5a4a","#6a4030",true); break;
    case "single_chair":  chair("#6a7a8a","#4a5a6a",true); break;
    case "reading_chair": chair("#6a5a8a","#4a3a6a",true); _E("📖",x+9,y+6,8); break;
    case "rocking_chair": chair("#7a5a30","#5a3f20",true); _R("#5a3f20",x-3,y+19,26,2); break;
    // floor props
    case "writing_desk":  _R("#7a5030",x,y,42,18); _R("#8a5f38",x,y-2,42,4); _R("#4a7888",x+4,y+3,20,10); _E("📋",x+31,y+2,9); break;
    case "tea_table":     _R("#8a5f38",x,y,24,4); _R("#6a4020",x+10,y+4,4,12); _E("🫖",x+12,y-3,10); break;
    case "cake_stand":    _R("#e8e0d0",x+6,y+10,4,8); _R("#f4ecdc",x,y+6,16,5); _E("🍰",x+8,y+1,11); break;
    case "kids_toys":     _E("🧸",x,y,12); _E("⚽",x+18,y+3,10); _R("#e05a5a",x+30,y+4,6,6); _R("#5a9ae0",x+37,y+4,6,6); break;
    case "toy_lorry":     _R("#c85a4a",x,y+4,22,9); _R("#8a3a2a",x+16,y,8,7); ctx.fillStyle="#2a2a2a"; ctx.beginPath(); ctx.arc(x+5,y+14,3,0,7); ctx.arc(x+18,y+14,3,0,7); ctx.fill(); break;
    case "crate_stack":   { const cr=(X,Y)=>{ _R("#8c6947",X,Y,16,14); _SR("#5a3a20",X,Y,16,14); _R("#5a3a20",X+7,Y,2,14); }; cr(x,y+16); cr(x+18,y+16); cr(x+9,y); } break;
    case "timber_stack":  for(let i=0;i<3;i++){ _R("#9a7442",x,y+i*7,40,6); _R("#7a5a2f",x,y+i*7,40,1);} for(let i=0;i<2;i++){ ctx.fillStyle="#b48a52"; ctx.beginPath(); ctx.arc(x+2,y+3+i*7,3,0,7); ctx.arc(x+40,y+3+i*7,3,0,7); ctx.fill(); } break;
    case "wood_crafts":   _E("🪵",x,y,11); _E("🔖",x+16,y+2,9); _E("🪑",x+30,y,10); break;
    case "gears_project": _E("⚙️",x,y,13); _E("🔩",x+16,y+4,9); _R("#6a6a72",x+26,y,14,12); _R("#8a8a92",x+28,y+2,10,3); break;
    case "kettle_stove":  _R("#4a4a52",x,y,26,18); _R("#2a2a30",x+3,y+3,20,4); _E("🫖",x+13,y-3,10); break;
    case "kettle_mug":    _E("🫖",x,y,11); _E("☕",x+16,y+2,9); break;
    case "ember_apron":   _R("#7a4a3a",x,y,16,20); _R("#5a3020",x+2,y-3,12,4); _E("🧤",x+24,y+4,10); break;
    case "boots":         _R("#3a2a1a",x,y+6,8,10); _R("#3a2a1a",x+10,y+6,8,10); _R("#2a1c10",x,y+13,8,4); _R("#2a1c10",x+10,y+13,8,4); break;
    case "preserve_shelf":_R("#8a6238",x,y,50,5); _E("🫙",x+8,y-4,10); _E("🍯",x+26,y-4,10); _E("🍓",x+44,y-4,9); break;
    case "medal_case":    _R("#4a3626",x,y,34,16); _R("rgba(200,220,240,.3)",x+2,y+2,30,12); _E("🥇",x+9,y+7,10); _E("🎖️",x+25,y+7,10); break;
    case "stacked_files": _R("#d8ccae",x,y,18,5); _R("#cfc2a0",x+1,y+5,18,5); _R("#e0d4b6",x,y+10,18,5); _E("📚",x+9,y-4,9); break;
    case "tackle_box":    _R("#3a6a4a",x,y+6,22,12); _R("#4a7a5a",x,y+3,22,4); _E("🎣",x+11,y-2,10); break;
    case "bucket":        ctx.fillStyle="#7a8a94"; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+14,y); ctx.lineTo(x+11,y+14); ctx.lineTo(x+3,y+14); ctx.closePath(); ctx.fill(); _R("#9aaab4",x,y,14,3); _E("🐟",x+7,y+6,8); break;
    case "oilskins":      _R("#c8a83a",x,y,14,22); _R("#b89830",x+2,y-3,10,4); _R("#a88820",x,y+8,14,2); break;
    case "flower_jar":    ctx.fillStyle="#a0c0d8"; ctx.beginPath(); ctx.arc(x+7,y+12,6,0,7); ctx.fill(); _E("💐",x+7,y-2,12); break;
    case "flower_pots":   _R("#6a4020",x,y+6,12,10); ctx.fillStyle="#2a8a2a"; ctx.beginPath(); ctx.arc(x+6,y+2,8,0,7); ctx.fill(); _E("🌻",x+6,y-8,11); _R("#6a4020",x+18,y+9,10,8); ctx.fillStyle="#3a9a3a"; ctx.beginPath(); ctx.arc(x+23,y+5,6,0,7); ctx.fill(); break;
    case "feed_sacks":    _R("#c8b890",x,y+4,16,16); _R("#b8a880",x+2,y,12,6); _R("#c8b890",x+14,y+8,14,12); _E("🌾",x+8,y+10,9); break;
    case "animal_basket": ctx.fillStyle="#a07840"; ctx.beginPath(); ctx.ellipse(x+12,y+8,14,7,0,0,7); ctx.fill(); ctx.fillStyle="#c8a860"; ctx.beginPath(); ctx.ellipse(x+12,y+6,12,5,0,0,7); ctx.fill(); _E("🐈",x+12,y+2,12); break;
    case "sea_chest":     _R("#6a4a2a",x,y+4,30,16); _R("#8a6238",x,y,30,6); _R("#c8a020",x+13,y+2,4,16); ctx.fillStyle="#c8a020"; ctx.beginPath(); ctx.arc(x+15,y+11,2,0,7); ctx.fill(); break;
    case "model_boat":    _R("#7a5030",x,y+8,20,5); ctx.fillStyle="#e8e0d0"; ctx.beginPath(); ctx.moveTo(x+10,y-6); ctx.lineTo(x+10,y+8); ctx.lineTo(x+18,y+8); ctx.closePath(); ctx.fill(); _R("#5a3f20",x+9,y-6,2,14); break;
    case "lantern":       _R("#3a2a1a",x+3,y,8,3); _R("#c8a020",x+2,y+3,10,10); ctx.fillStyle="rgba(255,220,120,"+(0.5+Math.sin(t*3)*0.2).toFixed(2)+")"; ctx.beginPath(); ctx.arc(x+7,y+8,5,0,7); ctx.fill(); _R("#3a2a1a",x+2,y+13,10,3); break;
    case "scales":        _R("#8a8a92",x+9,y+6,2,10); _R("#6a6a72",x,y+4,20,3); ctx.fillStyle="#aab0b8"; ctx.beginPath(); ctx.arc(x+3,y+9,4,0,Math.PI); ctx.arc(x+17,y+9,4,0,Math.PI); ctx.fill(); break;
    case "ice_box":       _R("#8aa8b8",x,y,26,20); _R("#a8c4d0",x+2,y+2,22,7); _R("#c8dce4",x+2,y+2,22,2); _E("🧊",x+13,y+13,10); break;
  }
}
// ---- Districts: directory modal + fast-travel ----
function currentDistrict(){
  const tl = totalLvl();
  let best=null, bd=Infinity;
  for (const d of DISTRICTS){
    if (!isDistrictOpen(d, tl)) continue;
    const hx=d.hub[0]*TILE+TILE/2, hy=d.hub[1]*TILE+TILE/2;
    const dist=Math.hypot(VP.x-hx, VP.y-hy);
    if (dist<bd){ bd=dist; best=d; }
  }
  return (best && bd < 14*TILE) ? best : null;
}
function closeDistricts(){ const e=document.getElementById("districts-modal"); if(e) e.remove(); }
function visitDistrict(id){
  const d=DISTRICTS.find(x=>x.id===id); if(!d || !isDistrictOpen(d, totalLvl())) return;
  const [tx,ty]=d.hub;
  VP.x=tx*TILE+TILE/2; VP.y=ty*TILE+TILE/2; VP.tx=null; VP.ty=null; VP.moving=false; VP.pending=null;
  CAM.x=Math.max(0, Math.min(VP.x-VIEW_W/2, VCOLS*TILE-VIEW_W));
  CAM.y=Math.max(0, Math.min(VP.y-VIEW_H/2, VROWS*TILE-VIEW_H));
  if (S.tab!=="village"){ S.tab="village"; renderNav(); renderMain(); }
  closeDistricts();
  toast(`${d.ic} Arrived at ${d.name}.`);
}
function openDistricts(){
  closeDistricts();
  tipOnce("_districts", SYSTEM_TUTORIAL._districts);
  const tl=totalLvl();
  const cards=DISTRICTS.map(d=>{
    const planned=d.unlock.type==='planned', open=isDistrictOpen(d, tl);
    const names=[...new Set((V_OBJECTS as any[]).filter(o=>o.name && districtForBuilding(o.id)===d.id).map(o=>o.name))];
    const bl = names.length ? (names.slice(0,5).join(", ")+(names.length>5?` +${names.length-5} more`:"")) : "In development";
    const badge = planned?`<span style="color:#9a9aa8">Planned</span>`:open?`<span style="color:#4aff88">● Open</span>`:`<span style="color:#ffb04a">🔒 Lvl ${d.unlock.n}</span>`;
    const action = planned?`<span style="font-size:11px;color:var(--dim)">Coming soon</span>`
      :open?`<button data-dvisit="${d.id}" style="background:${d.color};color:#161008;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:700">Visit →</button>`
      :`<span style="font-size:11px;color:#ffb04a">Reach total level ${d.unlock.n} (you: ${tl})</span>`;
    return `<div style="border-left:4px solid ${d.color};background:rgba(255,255,255,.03);border-radius:4px;padding:8px 10px;margin-bottom:6px;opacity:${(planned||!open)?0.72:1}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="font-weight:700;font-size:13px">${d.ic} ${d.name}</div><div style="font-size:11px;white-space:nowrap">${badge}</div></div>
      <div style="font-size:11px;color:var(--dim);margin:3px 0 5px">${d.blurb}</div>
      <div style="font-size:10px;color:var(--dim)">${bl}</div>
      <div style="margin-top:7px">${action}</div>
    </div>`;
  }).join("");
  const el=document.createElement("div");
  el.id="districts-modal"; el.className="dd-modal";
  el.innerHTML=`<div class="dd-card"><button class="vp-close" onclick="document.getElementById('districts-modal').remove()">✕</button>
    <div class="dd-title">🗺️ Town Directory</div>
    <div class="dd-sub">Featherstone's districts — visit any open one to travel there instantly.</div>
    <div>${cards}</div></div>`;
  document.body.appendChild(el);
  el.querySelectorAll("[data-dvisit]").forEach(b=>(b as HTMLElement).onclick=()=>visitDistrict((b as HTMLElement).dataset.dvisit));
  el.addEventListener("click", e=>{ if(e.target===el) el.remove(); });
}
// ---- Founder's Ledger: a "where am I / what's next" progression overview ----
function closeLedger(){ const e=document.getElementById("ledger-modal"); if(e) e.remove(); }
// Announce a gated district the moment the player crosses its level threshold.
function checkDistrictUnlocks(){
  if (!S.announcedDistricts) S.announcedDistricts = [];
  const tl = totalLvl();
  for (const d of DISTRICTS){
    if (d.unlock.type==='level' && tl >= (d.unlock as any).n && !S.announcedDistricts.includes(d.id)){
      S.announcedDistricts.push(d.id);
      toast(`${d.ic} ${d.name} unlocked!`);
      log(`${d.ic} <b>${d.name}</b> is now open — find it via the 🗺️ Town Directory! (Total level ${(d.unlock as any).n})`, "good");
    }
  }
}
function openLedger(){
  closeLedger();
  const tl = totalLvl();
  const openCount = DISTRICTS.filter(d=>isDistrictOpen(d,tl)).length;
  const nextD = nextGatedDistrict(tl);
  const autoCount = Object.keys(S.automatons||{}).length;
  const gt = gridTier(S.grid?.tier||0);
  const achDone = ACH.filter(a=>S.ach && S.ach[a.id]).length;
  const bff = VILLAGERS.filter(v=>friendLvl(v.id)>=5).length;
  const ph = macroPhase();
  const _bar = (cur,max,col)=>`<div style="background:rgba(255,255,255,.1);border-radius:3px;height:7px;overflow:hidden;margin-top:3px"><div style="width:${Math.min(100,Math.round(cur/max*100))}%;height:100%;background:${col}"></div></div>`;
  const nextHtml = nextD
    ? `<div style="margin-top:2px"><div style="display:flex;justify-content:space-between;font-size:11px"><span>Next: ${nextD.ic} ${nextD.name}</span><span style="color:var(--dim)">lvl ${tl}/${(nextD.unlock as any).n}</span></div>${_bar(tl,(nextD.unlock as any).n,nextD.color)}</div>`
    : `<div style="margin-top:4px;font-size:11px;color:#4aff88">🏆 Every district unlocked — the whole valley is yours.</div>`;
  const row = (label,val,extra)=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12px"><span style="color:var(--dim)">${label}</span><span style="font-weight:700">${val}${extra?` <span style="color:var(--dim);font-weight:400">${extra}</span>`:''}</span></div>`;
  const el=document.createElement("div");
  el.id="ledger-modal"; el.className="dd-modal";
  el.innerHTML=`<div class="dd-card"><button class="vp-close" onclick="document.getElementById('ledger-modal').remove()">✕</button>
    <div class="dd-title">📖 Founder's Ledger</div>
    <div class="dd-sub">${S.playerName?esc(S.playerName):'Founder'}'s journey across Featherstone Valley.</div>
    <div style="background:rgba(255,214,102,.08);border:1px solid rgba(255,214,102,.25);border-radius:6px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700">📈 Total level</span><span style="font-size:20px;font-weight:800;color:#ffd666">${tl}</span></div>
      ${nextHtml}
    </div>
    ${row('🗺️ Districts unlocked', `${openCount}/${DISTRICTS.length}`)}
    ${row('🤖 Skills automated', `${autoCount}/7`)}
    ${row('⚡ Power grid', gt.tier>0?`${gt.ic} ${gt.name}`:'off-grid')}
    ${row('💎 Net worth', `${fmt(netWorth())}`, 'coins')}
    ${row('🏅 Achievements', `${achDone}/${ACH.length}`)}
    ${row('💖 Best friends', `${bff}/${VILLAGERS.length}`)}
    ${row('📊 Market', `${ph.ic} ${ph.name}`)}
    ${(S.legacy||0) > 0 ? row('🌟 Legacy', `${"⭐".repeat(legacyStars(S.legacy))} ${legacyRank(S.legacy)}`, legacyBonusText(S.legacy)) : ''}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-size:12px;font-weight:700">🌟 A New Chapter${prestigeEligible(tl)?'':` <span style="color:var(--dim);font-weight:400">(total lvl ${PRESTIGE_MIN_TOTAL})</span>`}</span>
        <button id="ledger-prestige" style="background:${prestigeEligible(tl)?'#e8b020':'#5a5040'};color:#161008;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:800">${prestigeEligible(tl)?'Begin →':'Locked 🔒'}</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e=>{ if(e.target===el) el.remove(); });
  const _pb = document.getElementById("ledger-prestige"); if (_pb) _pb.onclick = ()=>{ el.remove(); openPrestige(); };
}
// ---- The Founder's Journey — an ordered story-quest chain across the whole game ----
// Live metrics for the journey objectives, read from existing game state/counters.
function journeyCtx(){
  return {
    actions:        S.counters?.actions || 0,
    steelworksLvl:  skillLvl('steelworks'),
    trades:         S.counters?.trades || 0,
    contracts:      S.counters?.contracts || 0,
    gardenHarvests: S.counters?.gardenHarvests || 0,
    friends:        VILLAGERS.filter(v => friendLvl(v.id) >= 2).length,
    totalLevel:     totalLvl(),
    beautification: S.beautification?.length || 0,
    automatons:     Object.keys(S.automatons || {}).length,
    gridTier:       S.grid?.tier || 0,
  };
}
// Nudge once (per stage) when a new stage becomes claimable — called from the tick.
function checkJourney(){
  if (!S.journey) S.journey = { claimed:[], notified:"" };
  const stage = currentStage(S.journey.claimed);
  if (!stage) return;
  if (stageComplete(stage, journeyCtx()) && S.journey.notified !== stage.id){
    S.journey.notified = stage.id;
    toast(`🧭 Journey milestone ready: “${stage.title}” — claim it!`);
    log(`🧭 <b>Founder's Journey</b> — “${stage.title}” is ready to claim. Open the 🧭 Journey to collect your reward.`, "good");
    syncJourneyBtn();
  }
}
// Claim the current stage (must be met); grants coins + an earned Title, then advances.
function claimJourneyStage(){
  if (!S.journey) S.journey = { claimed:[], notified:"" };
  const stage = currentStage(S.journey.claimed);
  if (!stage){ toast("🏆 The whole journey is complete!"); return; }
  if (!stageComplete(stage, journeyCtx())){ toast("Objective not met yet."); return; }
  S.journey.claimed.push(stage.id);
  S.coins += stage.reward.coins;
  S.counters.coinsEarned = (S.counters.coinsEarned || 0) + stage.reward.coins;
  const titleMsg = stage.reward.title ? ` You are now <b>“${stage.reward.title}”</b>.` : "";
  log(`👑 Founder's Journey: <b>${stage.title}</b> complete! +${fmt(stage.reward.coins)} coins.${titleMsg}`, "rare");
  toast(`👑 ${stage.title} — +${fmt(stage.reward.coins)}c${stage.reward.title ? ` · “${stage.reward.title}”` : ""}`);
  try{ SFX.fanfare(); }catch(e){}
  showJourneyBurst(stage);
  if (isJourneyComplete(S.journey.claimed)){
    setTimeout(()=>{ toast("🏆 Legend of Featherstone — your Founder's Journey is complete!"); }, 1400);
  }
  updateHud(); save(); renderJourney(); syncJourneyBtn();
}
function closeJourney(){ const e = document.getElementById("journey-modal"); if (e) e.remove(); }
// Reflect a claimable stage on the HUD button (a gentle pulse + dot).
function syncJourneyBtn(){
  const b = document.getElementById("btn-journey");
  if (!b) return;
  const ready = S.journey && canClaim(S.journey.claimed, journeyCtx());
  b.classList.toggle("has-claim", !!ready);
}
function renderJourney(){
  const open = document.getElementById("journey-modal");
  const ctx = journeyCtx();
  const claimed = (S.journey && S.journey.claimed) || [];
  const curIdx = currentStageIndex(claimed);
  const rows = JOURNEY.map((s, i) => {
    const done = claimed.includes(s.id);
    const isCurrent = i === curIdx;
    const met = isCurrent && stageComplete(s, ctx);
    const locked = i > curIdx;
    const pr = stageProgress(s, ctx);
    const marker = done ? "✅" : isCurrent ? s.ic : "🔒";
    const titleCol = done ? "#8a7a63" : isCurrent ? "var(--text)" : "#9a9aa8";
    const bar = isCurrent && !met
      ? `<div style="background:rgba(0,0,0,.12);border-radius:4px;height:8px;overflow:hidden;margin-top:6px"><div style="width:${pr.pct}%;height:100%;background:#d8b84a"></div></div>
         <div style="font-size:10px;color:var(--dim);margin-top:2px">${fmt(pr.cur)} / ${fmt(pr.max)}</div>`
      : "";
    const claimBtn = met
      ? `<button data-claim-journey style="background:#d8b84a;color:#161008;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:800;margin-top:6px">Claim +${fmt(s.reward.coins)}c 👑</button>`
      : "";
    const rewardLine = done
      ? `<span style="color:#4aa86a">Claimed · +${fmt(s.reward.coins)}c${s.reward.title ? ` · “${s.reward.title}”` : ""}</span>`
      : `<span style="color:var(--dim)">Reward: +${fmt(s.reward.coins)}c${s.reward.title ? ` · title “${s.reward.title}”` : ""}</span>`;
    return `<div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid rgba(0,0,0,.08);opacity:${locked ? .55 : 1}">
      <div style="font-size:26px;line-height:1;flex-shrink:0;width:30px;text-align:center">${marker}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14px;color:${titleCol}">${i + 1}. ${s.title}</div>
        <div style="font-size:12px;color:${done ? "#9a8a73" : "var(--dim)"};margin-top:2px">${s.desc}</div>
        ${bar}
        <div style="font-size:11px;margin-top:5px">${rewardLine}</div>
        ${claimBtn}
      </div>
    </div>`;
  }).join("");
  const doneCount = claimed.length;
  const title = earnedTitle(claimed);
  const headline = isJourneyComplete(claimed)
    ? `🏆 Journey complete — you are the <b>Legend of Featherstone</b>.`
    : `Stage ${Math.min(curIdx + 1, JOURNEY.length)} of ${JOURNEY.length}${title ? ` · current title: <b>“${title}”</b>` : ""}`;
  const inner = `<div class="dd-card" style="max-width:560px">
    <button class="vp-close" onclick="document.getElementById('journey-modal').remove()">✕</button>
    <div class="dd-title">🧭 The Founder's Journey</div>
    <div class="dd-sub">${headline}</div>
    <div style="background:rgba(216,184,74,.1);border:1px solid rgba(216,184,74,.3);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px">
      ${doneCount}/${JOURNEY.length} milestones · ${S.playerName ? esc(S.playerName) : "The Founder"}'s legacy in Featherstone Valley
    </div>
    <div style="max-height:52vh;overflow-y:auto">${rows}</div>
  </div>`;
  if (open){ open.innerHTML = inner; wireJourneyButtons(open); return; }
  const el = document.createElement("div");
  el.id = "journey-modal"; el.className = "dd-modal";
  el.innerHTML = inner;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
  wireJourneyButtons(el);
}
function wireJourneyButtons(root){
  const b = root.querySelector("[data-claim-journey]");
  if (b) b.onclick = () => claimJourneyStage();
}
function openJourney(){ closeJourney(); renderJourney(); }
// ---- Valley Journal (Task 9): a gentle first-session checklist of "firsts" ----
const VALLEY_JOURNAL = [
  { id:'first_ore',     ic:'⛏️', title:'First Ore',      hint:'Mine ore at the quarry',           reward:20, cond:()=> prodSum(ORES) >= 1 },
  { id:'first_bar',     ic:'🔥', title:'First Smelt',    hint:'Smelt a bar at the furnace',        reward:25, cond:()=> prodSum(BARS) >= 1 },
  { id:'first_craft',   ic:'🏭', title:'First Build',    hint:'Craft a part at the workshop',      reward:30, cond:()=> (prodSum(GOODS)+prodSum(CRAFTED)) >= 1 },
  { id:'first_sale',    ic:'🤝', title:'First Sale',     hint:'Deliver a contract or make a trade',reward:35, cond:()=> (S.counters?.contracts||0) >= 1 || (S.counters?.trades||0) >= 1 },
  { id:'first_upgrade', ic:'🛒', title:'First Upgrade',  hint:'Buy an upgrade at the Town Hall',   reward:40, cond:()=> Object.keys(S.upgrades||{}).length >= 1 },
  { id:'first_npc',     ic:'💬', title:'First Hello',    hint:'Tap a villager to meet them',       reward:20, cond:()=> !!S.npcMet },
];
// Auto-grants a small reward the first time each milestone is reached.
function checkJournal(){
  if (!S.firsts) S.firsts = {};
  let changed = false;
  for (const j of VALLEY_JOURNAL){
    if (!S.firsts[j.id] && j.cond()){
      S.firsts[j.id] = true;
      S.coins += j.reward;
      S.counters.coinsEarned = (S.counters.coinsEarned||0) + j.reward;
      toast(`📔 Journal: ${j.ic} ${j.title}! +${fmt(j.reward)} coins`);
      log(`📔 <b>Valley Journal</b> — ${j.title} ✓ (+${fmt(j.reward)} coins)`, "good");
      changed = true;
    }
  }
  if (changed){
    updateHud(); save();
    const m = document.getElementById("journal-modal"); if (m) renderJournal();
    syncJournalBtn();
  }
}
function syncJournalBtn(){
  const b = document.getElementById("btn-journal");
  if (!b) return;
  const done = VALLEY_JOURNAL.filter(j => S.firsts && S.firsts[j.id]).length;
  b.setAttribute("title", `Valley Journal — ${done}/${VALLEY_JOURNAL.length} firsts`);
}
function closeJournalModal(){ const e = document.getElementById("journal-modal"); if (e) e.remove(); }
function renderJournal(){
  const done = VALLEY_JOURNAL.filter(j => S.firsts && S.firsts[j.id]).length;
  const all = done >= VALLEY_JOURNAL.length;
  const rows = VALLEY_JOURNAL.map(j => {
    const ok = !!(S.firsts && S.firsts[j.id]);
    return `<div style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-top:1px solid rgba(0,0,0,.08);opacity:${ok?1:.85}">
      <div style="font-size:24px;width:30px;text-align:center">${ok ? '✅' : j.ic}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14px;color:${ok?'#4aa86a':'var(--text)'}">${j.title}</div>
        <div style="font-size:12px;color:var(--dim)">${ok ? 'Done!' : j.hint}</div>
      </div>
      <div style="font-size:12px;font-weight:700;color:${ok?'#4aa86a':'#8a6a2a'};white-space:nowrap">${ok?'✓ ':'+'}${fmt(j.reward)}c</div>
    </div>`;
  }).join("");
  const inner = `<div class="dd-card" style="max-width:480px">
    <button class="vp-close" onclick="document.getElementById('journal-modal').remove()">✕</button>
    <div class="dd-title">📔 Valley Journal</div>
    <div class="dd-sub">${all ? "Every 'first' complete — you know the valley now!" : `Your first steps in Featherstone · ${done}/${VALLEY_JOURNAL.length}`}</div>
    <div style="background:rgba(90,150,60,.1);border:1px solid rgba(90,150,60,.3);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px">
      Rewards are added automatically the moment you complete each first.
    </div>
    <div>${rows}</div>
  </div>`;
  const open = document.getElementById("journal-modal");
  if (open){ open.innerHTML = inner; open.addEventListener("click", e=>{ if(e.target===open) open.remove(); }); return; }
  const el = document.createElement("div");
  el.id = "journal-modal"; el.className = "dd-modal";
  el.innerHTML = inner;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
}
function openJournalPanel(){ closeJournalModal(); renderJournal(); }
// ---- v0.10 Roadmap / About (Task 10) — honest early-prototype framing ----
// Set FEEDBACK_LINK to your own channel (email, form, Discord…). Leave "" to show
// a neutral message instead of a link — no personal contact is hard-coded.
const FEEDBACK_LINK = "";
function openRoadmap(){
  const ex = document.getElementById("roadmap-modal"); if (ex){ ex.remove(); return; }
  const list = (items) => items.map(i => `<li style="margin:3px 0">${i}</li>`).join("");
  // comprehensive milestone log, grouped so it's easy to skim
  const sections = [
    { h:"🏭 The supply chain", items:[
      "Mine ore, smelt bars, manufacture parts, and deliver contracts at the Depot",
      "Nine skills: Mining, Smelting, Manufacturing, Logistics, Trading, Woodcutting, Fishing, Foraging &amp; Crafting",
      "Tool tiers — wood → stone → iron → gold → diamond — that speed up and improve your yields",
    ]},
    { h:"🎣 Gathering &amp; making", items:[
      "Fishing at the pier with a probabilistic catch (better rods land rarer fish)",
      "Foraging, woodcutting, and the Artisan's Shed for jams, teas, baskets &amp; more",
      "The Village Kitchen — cook what you grow &amp; catch into meals that sell high or grant buffs",
      "A cottage garden with crops that grow over time",
    ]},
    { h:"🏡 Village life", items:[
      "17 named neighbours with daily routines, homes, and two-way conversations",
      "Situational dialogue that reacts to time, weather, season &amp; your progress",
      "Your own cottage with furniture, décor &amp; upgrade tiers",
      "The Rose &amp; Pallet pub, Club Featherstone (themed nights), seasonal festivals &amp; the seasonal market",
      "Mischief &amp; the Law — trespass, sneak-steal, and the village police",
    ]},
    { h:"💰 Economy &amp; districts", items:[
      "A living economy — supply &amp; demand, business cycles, news &amp; a net-worth dashboard",
      "The Exchange (commodity speculation) and the Bank (interest &amp; loans)",
      "Eight districts + the Harbour, with a Town Directory &amp; fast travel",
      "The Automation Lab (helper bots) and the Data Centre's Power Grid",
      "Estate agent rentals, retail auto-sell &amp; the village beautification fund",
    ]},
    { h:"🏆 Goals &amp; progression", items:[
      "The Founder's Journey (11-stage story with earned titles) &amp; the 📔 Valley Journal of firsts",
      "🌟 The Legacy — a cosy prestige: start a New Chapter for permanent bonuses &amp; a rank",
      "Achievements, skill perks, University degrees, companions/pets &amp; a bike",
      "Notice-board quests, daily challenges &amp; personal villager requests",
      "Friendship keepsakes, village beautification &amp; the school fund",
    ]},
    { h:"✨ Comfort &amp; onboarding", items:[
      "Quick Start, a guided first quest with on-map markers, and self-teaching tips",
      "Progressive tab unlocking so new players aren't overwhelmed",
      "Fullscreen &amp; couch/TV legibility, gamepad support &amp; an inventory view",
    ]},
  ];
  const nextItems = [
    "📖 More story, characters &amp; guided quests",
    "🎪 More living-world village events",
    "⚖️ Ongoing balancing &amp; polish — shaped by your feedback",
  ];
  const feedback = FEEDBACK_LINK
    ? `<a href="${FEEDBACK_LINK}" target="_blank" rel="noopener" style="color:#4a9ad8;font-weight:700">Share your feedback →</a>`
    : `Your feedback genuinely shapes what gets built next — thank you for playing this early.`;
  const el = document.createElement("div");
  el.id = "roadmap-modal"; el.className = "dd-modal";
  el.innerHTML = `<div class="dd-card" style="max-width:520px">
    <button class="vp-close" onclick="document.getElementById('roadmap-modal').remove()">✕</button>
    <div class="dd-title">🗺️ BuyrWorld v0.10 — Roadmap</div>
    <div class="dd-sub">A cosy supply-chain life sim · early prototype, updated often</div>
    <div style="background:rgba(232,150,30,.1);border:1px solid rgba(232,150,30,.35);border-radius:6px;padding:9px 11px;margin-bottom:10px;font-size:12px;line-height:1.5">
      🚧 <b>This is an early prototype.</b> It's playable end-to-end, but things will
      change and grow. Your progress saves in this browser — export it from the
      💾 Save tab to keep it safe.
    </div>
    <div style="font-weight:800;font-size:14px;color:#5ad07a;margin-bottom:4px">✅ Playable now</div>
    ${sections.map(sec => `<div style="font-weight:700;font-size:12.5px;color:#ffd666;margin:8px 0 2px">${sec.h}</div>
      <ul style="font-size:12.5px;line-height:1.5;color:#f2ead6;margin:0;padding-left:18px">${list(sec.items)}</ul>`).join("")}
    <div style="font-weight:800;font-size:14px;color:#e8a648;margin:14px 0 4px">🔜 Coming next</div>
    <ul style="font-size:12.5px;line-height:1.5;color:#f2ead6;margin:0 0 12px;padding-left:18px">${list(nextItems)}</ul>
    <div style="font-weight:800;font-size:14px;margin-bottom:2px;color:#f2ead6">💬 Feedback</div>
    <p style="font-size:12.5px;color:#c8bd9e;margin:0">${feedback}</p>
  </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
}
// ---- The children's lemonade stand — funds the village school (opens after school) ----
const LEMONADE = { tx:18, ty:5, price:5 };
function lemonadeOpen(){ const h = gameHour(); return h >= 15.5 && h < 19.5; }   // 4 hours after school ends
function _lemonDay(){ return Math.floor(Date.now() / 86400000); }
function lemonadeSellers(){
  const k = CHILDREN_DATA; if (!k.length) return [];
  const a = k[_lemonDay() % k.length], b = k[(_lemonDay()+3) % k.length];
  return (b && b !== a) ? [a, b] : [a];
}
function checkSchoolTier(){
  if (!S.school) S.school = { raised:0, notifiedTier:0 };
  const tier = schoolTier(S.school.raised);
  if (tier > (S.school.notifiedTier||0)){
    for (let i=(S.school.notifiedTier||0); i<tier; i++){ const u = SCHOOL_UPGRADES[i]; toast(`🏫 School fund: bought ${u.ic} ${u.name}!`); log(`🏫 <b>The school</b> raised enough for ${u.ic} <b>${u.name}</b>!`, "good"); }
    S.school.notifiedTier = tier;
  }
}
function buyLemonade(){
  if (!lemonadeOpen()){ toast("🍋 The stand's shut — it opens for 4 hours after school."); return; }
  if (S.coins < LEMONADE.price){ toast("Not enough coins."); return; }
  S.coins -= LEMONADE.price;
  if (!S.school) S.school = { raised:0, notifiedTier:0 };
  S.school.raised += LEMONADE.price;
  addItem("lemonade", 1); S.prod.lemonade = (S.prod.lemonade||0) + 1;
  S.counters.lemonadeBought = (S.counters.lemonadeBought||0) + 1;
  const kid = lemonadeSellers()[0];
  const thanks = ["Thank you!", "Every penny helps!", "Wait till Miss hears!", "You're the best!"];
  toast(`🍋 ${kid ? kid.n : "The kids"}: "${thanks[Math.floor(Math.random()*thanks.length)]} That's ${LEMONADE.price}c for the school!"`);
  checkSchoolTier(); updateHud(); save();
  if (document.getElementById("lemonade-modal")) renderLemonadeStand();
}
function closeLemonadeStand(){ const e = document.getElementById("lemonade-modal"); if (e) e.remove(); }
function renderLemonadeStand(){
  const raised = S.school?.raised || 0, tier = schoolTier(raised), nx = nextUpgrade(raised);
  const names = lemonadeSellers().map(k => k.n).join(" & ");
  const rows = SCHOOL_UPGRADES.map((u,i)=>{
    const bought = i < tier, isNext = !!nx && nx.upgrade.id === u.id;
    const bar = isNext ? `<div style="background:rgba(0,0,0,.18);border-radius:4px;height:7px;overflow:hidden;margin-top:3px"><div style="width:${Math.round(nx.have/nx.need*100)}%;height:100%;background:#5ad07a"></div></div><div style="font-size:10px;color:var(--dim);margin-top:1px">${fmt(nx.have)} / ${fmt(nx.need)}c</div>` : "";
    return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 2px;border-top:1px solid rgba(255,255,255,.08);opacity:${bought||isNext?1:.6}">
      <div style="font-size:22px;width:26px;text-align:center">${bought?"✅":u.ic}</div>
      <div style="flex:1"><div style="font-weight:700;font-size:13px;color:${bought?'#5ad07a':'var(--text)'}">${u.name}</div>
        <div style="font-size:11px;color:var(--dim)">${bought?"Bought!":`Needs ${fmt(u.cost)}c raised`}</div>${bar}</div></div>`;
  }).join("");
  const inner = `<div class="dd-card" style="max-width:460px">
    <button class="vp-close" onclick="document.getElementById('lemonade-modal').remove()">✕</button>
    <div class="dd-title">🍋 Lemonade Stand</div>
    <div class="dd-sub">${names?esc(names):"The children"}'s fundraiser for the village school</div>
    <div style="background:rgba(255,224,80,.12);border:1px solid rgba(232,180,40,.4);border-radius:6px;padding:9px 11px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700">🏫 Raised for the school</span><span style="font-size:19px;font-weight:800;color:#f0c050">${fmt(raised)}c</span></div>
      ${nx?`<div style="font-size:11px;color:var(--dim);margin-top:2px">Saving for ${nx.upgrade.ic} ${nx.upgrade.name}</div>`:`<div style="font-size:11px;color:#5ad07a;margin-top:2px">✨ Every upgrade funded — what a school!</div>`}
    </div>
    <button data-buy-lemonade style="background:#e8a020;color:#161008;border:none;padding:10px 16px;border-radius:5px;cursor:pointer;font-size:15px;font-weight:800;width:100%">🍋 Buy a lemonade — ${LEMONADE.price}c</button>
    <div style="font-size:11px;color:var(--dim);text-align:center;margin:5px 0 10px">All proceeds go straight to the school.</div>
    <div style="font-weight:700;font-size:12px;color:#ffd666;margin-bottom:2px">🏫 Equipment fund</div>
    ${rows}
  </div>`;
  const open = document.getElementById("lemonade-modal");
  if (open){ open.innerHTML = inner; open.querySelector("[data-buy-lemonade]").onclick = ()=>buyLemonade(); return; }
  const el = document.createElement("div"); el.id = "lemonade-modal"; el.className = "dd-modal"; el.innerHTML = inner;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
  el.querySelector("[data-buy-lemonade]").onclick = ()=>buyLemonade();
}
function openLemonadeStand(){ closeLemonadeStand(); renderLemonadeStand(); }
// ---- The Legacy — a cosy prestige / "New Chapter" (endgame milestone) ----
function doPrestige(){
  if (!prestigeEligible(totalLvl())){ toast(`🌟 Reach total level ${PRESTIGE_MIN_TOTAL} to start a New Chapter.`); return; }
  S.legacy = (S.legacy||0) + 1;
  // reset the economic grind…
  for (const k in S.skills) S.skills[k] = { xp:0 };
  S.coins = 200; S.items = {}; S.prod = {}; S.action = null;
  S.upgrades = {}; S.automatons = {}; S.grid = { tier:0 };
  S.perks = {}; S.degrees = []; S.studying = null;
  S.contracts = []; S.exchange = { positions:[] };
  S.caffBuff = 0; S.pintBuff = 0; S.mealBuff = null; S.danceBuff = 0; S.schoolBuff = 0;
  // …but keep name, appearance, home & furniture, friends & keepsakes, achievements,
  //   Founder's Journey titles, beautification, the school fund, and unlocked tabs.
  S.tut = { step:99, done:true };   // no re-tutorial
  fillContracts(); ensureMarket(); rollMarket(false); achCheck();
  try{ SFX.fanfare(); }catch(e){}
  const rank = legacyRank(S.legacy);
  toast(`🌟 New Chapter ${S.legacy}! You are now ${rank}.`);
  log(`🌟 <b>New Chapter ${S.legacy}</b> — you handed the valley to a successor and began again as <b>${rank}</b>. Permanent Legacy: ${legacyBonusText(S.legacy)}.`, "rare");
  showJourneyBurst({ ic:"🌟", title:`New Chapter — ${rank}`, reward:{ title:rank } });
  S.tab = "village"; closePrestige();
  renderNav(); renderMain(); updateHud(); save();
}
function closePrestige(){ const e = document.getElementById("prestige-modal"); if (e) e.remove(); }
function openPrestige(){
  closePrestige();
  const tl = totalLvl(), elig = prestigeEligible(tl), lg = S.legacy||0;
  const el = document.createElement("div"); el.id = "prestige-modal"; el.className = "dd-modal";
  el.innerHTML = `<div class="dd-card" style="max-width:480px">
    <button class="vp-close" onclick="document.getElementById('prestige-modal').remove()">✕</button>
    <div class="dd-title">🌟 A New Chapter</div>
    <div class="dd-sub">Hand the valley to a successor and begin again — wiser, and quicker.</div>
    ${lg>0?`<div style="background:rgba(255,214,102,.12);border:1px solid rgba(255,214,102,.35);border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:12px">Current Legacy: ${"⭐".repeat(legacyStars(lg))} <b>${legacyRank(lg)}</b><br><span style="color:var(--dim)">${legacyBonusText(lg)}</span></div>`:""}
    <p style="font-size:12px;line-height:1.5;margin:0 0 8px">Start a New Chapter and you keep your <b>name, home, friends, achievements and Founder's titles</b> — but your <b>skills, coins and upgrades reset</b>. In return you gain a permanent <b>Legacy</b> that makes every future climb faster and every sale worth more.</p>
    <div style="background:rgba(90,150,60,.1);border:1px solid rgba(90,150,60,.3);border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:12px">
      Next chapter → ${"⭐".repeat(legacyStars(lg+1))} <b>${legacyRank(lg+1)}</b> · <b style="color:#5ad07a">${legacyBonusText(lg+1)}</b>
    </div>
    <div style="font-size:11px;color:var(--dim);margin-bottom:8px"><b>Kept:</b> name, home &amp; furniture, friends &amp; keepsakes, achievements, Journey titles, beautification, the school fund, unlocked tabs.<br><b>Reset:</b> all skills, coins, items, upgrades, automatons, power grid, perks &amp; degrees.</div>
    ${elig
      ? `<button data-prestige style="background:#e8b020;color:#161008;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:15px;font-weight:800;width:100%">🌟 Begin a New Chapter</button>`
      : `<div style="text-align:center;color:#e8a648;font-size:12px;font-weight:700;padding:8px">🔒 Reach total level ${PRESTIGE_MIN_TOTAL} to begin (you're at ${tl}).</div>`}
  </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
  const b = el.querySelector("[data-prestige]");
  if (b) b.onclick = () => { if (confirm("Begin a New Chapter?\n\nYour skills, coins and upgrades will reset — but you keep a permanent Legacy, your home, friends, achievements and titles.")) doPrestige(); };
}
// ---- The Village Kitchen — cook what you grow, catch and forage into meals ----
function mealBuffRemainingMs(){ return S.mealBuff ? Math.max(0, S.mealBuff.until - Date.now()) : 0; }
function cookRecipe(id){
  const r = recipeById(id); if (!r) return;
  if (!recipeUnlocked(r, totalLvl())){ toast(`🔒 Unlocks at total level ${r.unlock}.`); return; }
  if (!canCook(r, S.items)){
    const miss = Object.entries(r.in).find(([k,q]) => (S.items[k]||0) < q);
    toast(miss ? `Need more ${ITEMS[miss[0]]?.n||miss[0]}.` : "Missing ingredients."); return;
  }
  for (const [k,q] of Object.entries(r.in)) S.items[k] = (S.items[k]||0) - q;
  addItem(r.out, 1);
  S.prod[r.out] = (S.prod[r.out]||0) + 1;
  S.counters.mealsCooked = (S.counters.mealsCooked||0) + 1;
  try{ SFX.cook(); }catch(e){}
  toast(`${r.ic} Cooked ${r.name}! Eat it for a buff, or serve it for coins.`);
  log(`${r.ic} Cooked <b>${r.name}</b>.`, "good");
  achCheck(); renderMain(); updateHud(); save();
}
function eatMeal(id){
  const r = recipeById(id); if (!r) return;
  if ((S.items[id]||0) < 1){ toast("You don't have that meal."); return; }
  S.items[id] -= 1;
  const now = Date.now();
  // eating the same kind of buff extends it; a different kind replaces it fresh
  const base = (S.mealBuff && S.mealBuff.kind === r.buff.kind && S.mealBuff.until > now) ? S.mealBuff.until : now;
  S.mealBuff = { kind:r.buff.kind, mult:r.buff.mult, until: base + buffDurationMs(r), label:r.buff.label, ic:r.buff.ic, name:r.name };
  S.counters.mealsEaten = (S.counters.mealsEaten||0) + 1;
  const eff = r.buff.kind==='speed' ? `${Math.round((1-r.buff.mult)*100)}% faster actions`
            : r.buff.kind==='xp'    ? `+${Math.round((r.buff.mult-1)*100)}% skill XP`
            : `+${Math.round((r.buff.mult-1)*100)}% sale prices`;
  toast(`${r.buff.ic} ${r.buff.label}! ${eff} for ${r.buff.mins} min.`);
  log(`${r.buff.ic} Ate <b>${r.name}</b> — ${eff} for ${r.buff.mins} min.`, "good");
  renderMain(); updateHud(); save();
}
function serveMeal(id){
  const r = recipeById(id); if (!r) return;
  if ((S.items[id]||0) < 1){ toast("You don't have that meal."); return; }
  S.items[id] -= 1;
  const val = ITEMS[id].v;
  S.coins += val; S.counters.coinsEarned = (S.counters.coinsEarned||0) + val;
  toast(`${r.ic} Served ${r.name} to the café — +${fmt(val)} coins.`);
  log(`${r.ic} Served <b>${r.name}</b> for ${fmt(val)}c.`, "good");
  renderMain(); updateHud(); save();
}
// Renders the kitchen; `where` tags the heading ("café" or "cottage").
function renderKitchen(where){
  const tl = totalLvl();
  const buffMs = mealBuffRemainingMs();
  const buffBanner = buffMs > 0 && S.mealBuff
    ? `<div class="panel" style="background:rgba(90,150,60,.16);border:1px solid #5a9a3c;padding:8px;margin-bottom:8px">
        <b style="color:#5a9a3c">${S.mealBuff.ic} ${S.mealBuff.label} active</b>
        <span style="color:var(--dim);font-size:11px"> · ${Math.ceil(buffMs/1000)}s left</span></div>`
    : "";
  const cards = RECIPES.map(r => {
    const unlocked = recipeUnlocked(r, tl);
    if (!unlocked){
      return `<div class="card" style="padding:8px;opacity:.6;display:flex;align-items:center;gap:8px">
        <span style="font-size:22px;filter:grayscale(1)">${r.ic}</span>
        <div style="flex:1"><div style="font-weight:700;font-size:12px">🔒 ${r.name}</div>
        <div style="font-size:11px;color:var(--dim)">Unlocks at total level ${r.unlock}</div></div></div>`;
    }
    const ok = canCook(r, S.items);
    const ingr = Object.entries(r.in).map(([k,q]) => {
      const have = S.items[k]||0;
      const col = have >= q ? "var(--dim)" : "#d05a5a";
      return `<span style="color:${col};font-size:11px;white-space:nowrap">${ITEMS[k]?.ic||"📦"} ${have}/${q}</span>`;
    }).join(' · ');
    const eff = r.buff.kind==='speed' ? `${Math.round((1-r.buff.mult)*100)}% faster`
              : r.buff.kind==='xp'    ? `+${Math.round((r.buff.mult-1)*100)}% XP`
              : `+${Math.round((r.buff.mult-1)*100)}% sales`;
    const owned = S.items[r.out]||0;
    const cookBtn = `<button data-cook="${r.id}" style="background:${ok?'#8a5a1a':'#555'};color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:${ok?'pointer':'default'};font-size:12px;font-weight:700"${ok?'':' disabled'}>${r.ic} Cook</button>`;
    const ownedRow = owned > 0
      ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">
          <span style="font-size:11px;color:#5a9a3c;font-weight:700">You have ${owned}</span>
          <button data-eat="${r.id}" style="background:#4a8a3a;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">🍽️ Eat</button>
          <button data-serve="${r.id}" style="background:#3a6a8a;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">Serve +${fmt(ITEMS[r.out].v)}c</button>
        </div>`
      : "";
    return `<div class="card" style="padding:8px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:24px">${r.ic}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${r.name}</div>
          <div style="font-size:11px;color:var(--dim)">${r.desc}</div>
        </div>
        ${cookBtn}
      </div>
      <div style="margin-top:5px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <span>${ingr}</span>
        <span style="font-size:11px;color:#8a6a2a;font-weight:700">${r.buff.ic} ${eff} · ${r.buff.mins}m</span>
      </div>
      ${ownedRow}
    </div>`;
  }).join('');
  const nextLocked = RECIPES.find(r => !recipeUnlocked(r, tl));
  const hint = nextLocked
    ? `<p style="font-size:11px;color:var(--dim);margin:6px 0 0">Level up any skills to unlock more recipes — next at total level ${nextLocked.unlock}.</p>`
    : `<p style="font-size:11px;color:#ffd666;margin:6px 0 0">✨ Every recipe unlocked — you're a master cook!</p>`;
  return `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 6px;font-size:14px">👩‍🍳 The Kitchen</h3>
    <p style="color:var(--dim);font-size:12px;margin:0 0 8px">Cook what you grow, catch and forage into meals. <b>Eat</b> one for a timed buff, or <b>Serve</b> it for a premium.</p>
    ${buffBanner}
    ${cards}
    ${hint}
  </div>`;
}
// ---- Inventory: a large, couch-legible view of everything you own ----
function toggleInventory(){
  const ex = document.getElementById("inv-modal");
  if (ex){ ex.remove(); return; }
  tipOnce("_inventory", SYSTEM_TUTORIAL._inventory);
  const entries = Object.entries(S.items).filter(([,q]:any)=>q>0)
    .sort((a:any,b:any)=> (ITEMS[b[0]]?.v||0)*b[1] - (ITEMS[a[0]]?.v||0)*a[1]);
  const cells = entries.length
    ? entries.map(([id,q]:any)=>`<div class="inv-cell"><div class="inv-ic">${ITEMS[id]?.ic||"📦"}</div><div class="inv-nm">${ITEMS[id]?.n||id}</div><div class="inv-q">×${fmt(q)}</div></div>`).join("")
    : `<div style="grid-column:1/-1;text-align:center;color:var(--dim);padding:24px">Empty — go gather or craft something!</div>`;
  const el=document.createElement("div");
  el.id="inv-modal"; el.className="dd-modal";
  el.innerHTML=`<div class="dd-card"><button class="vp-close" onclick="document.getElementById('inv-modal').remove()">✕</button>
    <div class="dd-title">🎒 Inventory</div>
    <div class="dd-sub">💰 ${fmt(S.coins)} coins · 📦 ${fmt(inventoryValue())} in goods at market value</div>
    <div class="inv-grid">${cells}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e=>{ if(e.target===el) el.remove(); });
}
function nearestInteractable(){
  let best=null, bd=56;
  for (const w of WANDERERS){
    const d = Math.hypot(VP.x-w.x, VP.y-w.y);
    if (d < bd){ best={kind:"npc", w}; bd=d; }
  }
  for (const o of V_OBJECTS){
    const ap=objApproach(o), d=Math.hypot(VP.x-ap.x, VP.y-ap.y);
    if (d<bd){ bd=d; best=o; }
  }
  return best;
}
function villageTierLvl(){ const tl = totalLvl(); return tl>=300?3 : tl>=150?2 : tl>=50?1 : 0; }
function getTreePalette(tType){
  const _s = getSeason();
  if (tType===0){ // pine — evergreen in UK, minor tint by season
    if (_s==="winter") return { layers:["#2a6020","#386830","#487838"], bare:false, snow:true };
    if (_s==="spring") return { layers:["#4a9038","#5aaa48","#6aba58"], bare:false, snow:false };
    return { layers:["#3a7a2a","#4a9a38","#5ab848"], bare:false, snow:false }; // summer/autumn
  }
  if (_s==="winter") return { bare:true, trunkCol:"#4a3828" };
  if (_s==="autumn"){
    if (tType===1) return { layers:["#a05a18","#c07020","#d08030","#e09040"], bare:false };
    return { layers:["#904820","#b06228","#a05018","#c07030"], bare:false };
  }
  if (_s==="spring"){
    if (tType===1) return { layers:["#4a9040","#5aaa50","#6aba60","#78c868"], bare:false };
    return { layers:["#3a8030","#4a9040","#5a9848","#68a850"], bare:false };
  }
  // summer
  if (tType===1) return { layers:["#4a8038","#5a9248","#69a856","#78b860"], bare:false };
  return { layers:["#2e6828","#3a7832","#4a8840","#5a9848"], bare:false };
}
function drawTiles(ctx, t){
  const tier = villageTierLvl();
  const c0 = Math.max(0, Math.floor(CAM.x/TILE)), c1 = Math.min(VCOLS, c0+VIEW_W/TILE+2);
  const r0 = Math.max(0, Math.floor(CAM.y/TILE)), r1 = Math.min(VROWS, r0+VIEW_H/TILE+2);
  for (let r=r0;r<r1;r++) for (let c=c0;c<c1;c++){
    const ch = VMAP[r][c], x=c*TILE, y=r*TILE;
    if (ch==="W"){
      // depth tint: deeper rows slightly darker blue
      ctx.fillStyle = r < 20 ? "#4da8cc" : "#5db3d8"; ctx.fillRect(x,y,TILE,TILE);
      // two staggered wave layers for parallax shimmer
      ctx.fillStyle="rgba(255,255,255,0.38)";
      if ((c+r+Math.floor(t*2.2))%4===0) ctx.fillRect(x+2,y+7,14,2);
      if ((c*2+r+Math.floor(t*1.6)+2)%5===0) ctx.fillRect(x+5,y+15,10,2);
      // foam where water meets sand
      if (r>0 && VMAP[r-1][c]==="S"){ ctx.fillStyle="rgba(255,255,255,.75)"; ctx.fillRect(x, y+Math.sin(t*2+c)*2, TILE, 3); }
    } else if (ch==="S"){
      ctx.fillStyle="#efdfae"; ctx.fillRect(x,y,TILE,TILE);
      const h=(c*7+r*13)%23;
      if (h===0){ ctx.fillStyle="#dcc98e"; ctx.fillRect(x+8,y+10,5,3); }
      if (h===4){ ctx.fillStyle="#e0cc99"; ctx.fillRect(x+3,y+5,4,2); }
      if (h===9){ drawEmojiC(ctx,"🐚",x+12,y+12,8); }
    } else if (ch==="D"){
      ctx.fillStyle="#b39468"; ctx.fillRect(x,y,TILE,TILE);
      ctx.fillStyle="#a1855c"; if ((c*5+r*11)%4===0) ctx.fillRect(x+5,y+7,6,4);
      if ((c*3+r*17)%7===0){ ctx.fillStyle="#957040"; ctx.fillRect(x+14,y+3,4,3); }
      if ((c*11+r*5)%9===0){ ctx.fillStyle="#8a6840"; ctx.fillRect(x+2,y+15,3,3); }
    } else if (ch==="C"){
      ctx.fillStyle="#8d939c"; ctx.fillRect(x,y,TILE,TILE);
      ctx.fillStyle="#787e88"; ctx.fillRect(x,y+16,TILE,8);
      ctx.fillStyle="#a5abb4"; ctx.fillRect(x+3,y+3,7,5); ctx.fillRect(x+13,y+9,7,5);
      // vertical crack line for geological detail
      if ((c*9+r*11)%5===0){ ctx.strokeStyle="#6e7480"; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(x+10,y+2); ctx.lineTo(x+8,y+14); ctx.stroke(); }
    } else if (ch==="P"){
      if (tier>=2){
        ctx.fillStyle="#cfc5b0"; ctx.fillRect(x,y,TILE,TILE);
        ctx.strokeStyle="#bdb29c"; ctx.lineWidth=1;
        ctx.strokeRect(x+2,y+2,9,9); ctx.strokeRect(x+13,y+2,9,9); ctx.strokeRect(x+2,y+13,9,9); ctx.strokeRect(x+13,y+13,9,9);
        ctx.fillStyle="#d9cfba"; ctx.fillRect(x+3,y+3,3,3); ctx.fillRect(x+14,y+14,3,3);
      } else {
        ctx.fillStyle="#e5cf9a"; ctx.fillRect(x,y,TILE,TILE);
        ctx.fillStyle="#d4ba7e"; if ((c*7+r*13)%5===0) ctx.fillRect(x+6,y+8,4,4);
        // wheel ruts on dirt path
        if (c*7%3===0){ ctx.fillStyle="#ccad72"; ctx.fillRect(x+5,y,2,TILE); }
      }
    } else if (ch==="F"){
      ctx.fillStyle=(c+r)%2 ? "#4a7a3a" : "#426e34"; ctx.fillRect(x,y,TILE,TILE);
      const hf=(c*7+r*13)%17;
      if (hf===0){ ctx.fillStyle="#3a6028"; ctx.fillRect(x+4,y+8,4,10); ctx.fillRect(x+14,y+6,3,12); }
      if (hf===3){ ctx.fillStyle="#5a9048"; ctx.fillRect(x+10,y+10,3,8); }
      if (hf===6){ ctx.fillStyle="#3e5e2a"; ctx.fillRect(x+2,y+14,5,4); ctx.fillRect(x+14,y+10,4,4); }
    } else {
      ctx.fillStyle=(c+r)%2 ? "#9fd6a8" : "#95cf9e"; ctx.fillRect(x,y,TILE,TILE);
      const h=(c*7+r*13)%29;
      if (ch==="G" && h===0){ ctx.fillStyle="#ff9db0"; ctx.fillRect(x+9,y+9,4,4); ctx.fillStyle="#ffd666"; ctx.fillRect(x+10,y+10,2,2); }
      else if (ch==="G" && h===1){ ctx.fillStyle="#ffffc0"; ctx.fillRect(x+14,y+5,3,3); ctx.fillStyle="#ffd666"; ctx.fillRect(x+15,y+6,1,1); }
      else if (ch==="G" && h===2){ ctx.fillStyle="#ffffff"; ctx.fillRect(x+5,y+14,2,2); ctx.fillRect(x+7,y+13,2,2); ctx.fillRect(x+6,y+15,2,2); }
      else if (ch==="G" && h===7){ ctx.fillStyle="#7cbf86"; ctx.fillRect(x+6,y+12,3,6); ctx.fillRect(x+14,y+9,3,9); }
      else if (ch==="G" && h===8){ ctx.fillStyle="#6ab576"; ctx.fillRect(x+10,y+6,2,8); ctx.fillRect(x+13,y+8,2,6); }
      else if (ch==="G" && h===14){ ctx.fillStyle="#9a9a9a"; ctx.fillRect(x+8,y+12,3,2); ctx.fillStyle="#b8b8b8"; ctx.fillRect(x+9,y+12,1,1); }
      else if (ch==="G" && h===15 && r>12 && c<9){ ctx.fillStyle="#8a6a45"; ctx.fillRect(x+2,y+16,20,3); ctx.fillStyle="#63b573"; ctx.fillRect(x+4,y+10,3,6); ctx.fillRect(x+11,y+9,3,7); ctx.fillRect(x+17,y+11,3,5); }
    }
    if (ch==="T"){
      const tType = (c*13+r*7)%3; // 0=pine, 1=oak, 2=hardwood
      const sway = Math.sin(t*0.8 + c*0.7 + r*0.5) * 1.2;
      const _tp = getTreePalette(tType);
      if (_tp.bare){
        // winter bare deciduous — trunk and bare branch strokes
        ctx.fillStyle=_tp.trunkCol; ctx.fillRect(x+8, y+10, tType===1?8:10, 12);
        ctx.strokeStyle="#3a2818"; ctx.lineWidth=1.2;
        ctx.beginPath();
        const _bx=x+12, _by=y+10;
        ctx.moveTo(_bx,_by); ctx.lineTo(_bx-6,_by-8); ctx.moveTo(_bx,_by); ctx.lineTo(_bx+7,_by-7);
        ctx.moveTo(_bx-3,_by-5); ctx.lineTo(_bx-9,_by-11); ctx.moveTo(_bx+4,_by-5); ctx.lineTo(_bx+10,_by-10);
        ctx.moveTo(_bx,_by-2); ctx.lineTo(_bx,_by-11);
        ctx.stroke(); ctx.lineWidth=1;
      } else if (tType===0){ // pine
        const [c0,c1,c2] = _tp.layers;
        ctx.fillStyle="#7a5230"; ctx.fillRect(x+10,y+12,4,10);
        ctx.fillStyle=c0;
        ctx.beginPath(); ctx.moveTo(x+12+sway*1.2,y-6); ctx.lineTo(x+1,y+14); ctx.lineTo(x+23,y+14); ctx.closePath(); ctx.fill();
        ctx.fillStyle=c1;
        ctx.beginPath(); ctx.moveTo(x+12+sway,y+1); ctx.lineTo(x+4,y+14); ctx.lineTo(x+20,y+14); ctx.closePath(); ctx.fill();
        ctx.fillStyle=c2;
        ctx.beginPath(); ctx.moveTo(x+12+sway*0.6,y+6); ctx.lineTo(x+6,y+14); ctx.lineTo(x+18,y+14); ctx.closePath(); ctx.fill();
        if (_tp.snow){ // winter snow on pine tips
          ctx.fillStyle="rgba(230,240,255,.85)";
          ctx.beginPath(); ctx.moveTo(x+12+sway*1.2,y-6); ctx.lineTo(x+6,y+0); ctx.lineTo(x+18,y+0); ctx.closePath(); ctx.fill();
        }
      } else if (tType===1){ // oak
        const [c0,c1,c2,c3] = _tp.layers;
        ctx.fillStyle="#6a4828"; ctx.fillRect(x+8,y+12,8,10);
        const sw=sway*0.7;
        ctx.fillStyle=c0; ctx.beginPath(); ctx.arc(x+12+sw,y+7,11,0,7); ctx.fill();
        ctx.fillStyle=c1; ctx.beginPath(); ctx.arc(x+6+sw,y+5,7,0,7); ctx.fill();
        ctx.fillStyle=c2; ctx.beginPath(); ctx.arc(x+18+sw*0.8,y+5,6,0,7); ctx.fill();
        ctx.fillStyle=c3; ctx.beginPath(); ctx.arc(x+12+sw*0.5,y+0,6,0,7); ctx.fill();
        if (getSeason()==="spring"){ // spring blossom clusters on oak
          ctx.fillStyle="rgba(255,200,210,.7)";
          ctx.beginPath(); ctx.arc(x+7+sw,y+2,4,0,7); ctx.arc(x+16+sw*0.6,y+1,3,0,7); ctx.fill();
        }
      } else { // hardwood
        const [c0,c1,c2,c3] = _tp.layers;
        ctx.fillStyle="#5a3818"; ctx.fillRect(x+7,y+11,10,11);
        const sw=sway*0.8;
        ctx.fillStyle=c0; ctx.beginPath(); ctx.arc(x+12+sw,y+8,13,0,7); ctx.fill();
        ctx.fillStyle=c1; ctx.beginPath(); ctx.arc(x+4+sw,y+5,9,0,7); ctx.fill();
        ctx.fillStyle=c2; ctx.beginPath(); ctx.arc(x+20+sw*0.9,y+7,8,0,7); ctx.fill();
        ctx.fillStyle=c3; ctx.beginPath(); ctx.arc(x+11+sw*0.6,y+0,8,0,7); ctx.fill();
      }
    }
  }
}
function drawObjects(ctx, t){
  for (const o of V_OBJECTS){
    const r = objRect(o);
    if (o.kind==="rock"){
      const locked = skillLvl("mining") < o.lvl;
      ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(r.x+12, r.y+20, 10, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = locked ? "#a7adb3" : "#8d939c";
      ctx.beginPath(); ctx.moveTo(r.x+3,r.y+20); ctx.lineTo(r.x+6,r.y+8); ctx.lineTo(r.x+14,r.y+4); ctx.lineTo(r.x+21,r.y+12); ctx.lineTo(r.x+20,r.y+20); ctx.closePath(); ctx.fill();
      ctx.fillStyle=o.vein;
      ctx.fillRect(r.x+8,r.y+11,3,3); ctx.fillRect(r.x+14,r.y+9,3,3); ctx.fillRect(r.x+12,r.y+15,3,3);
      if (o.sparkle && Math.floor(t*3)%2) drawEmojiC(ctx,"✨",r.x+18,r.y+4,10);
      if (locked) drawEmojiC(ctx,"🔒",r.x+12,r.y-4,10);
    }
    if (o.kind==="fountain"){
      const fx = r.x + r.w/2, fy = r.y + r.h/2;
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(fx, fy+r.h/2-2, r.w/2, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#b8b0a0"; ctx.beginPath(); ctx.arc(fx, fy, r.w/2-2, 0, 7); ctx.fill();
      ctx.fillStyle="#8f887a"; ctx.beginPath(); ctx.arc(fx, fy, r.w/2-2, 0, 7); ctx.lineWidth=3; ctx.strokeStyle="#8f887a"; ctx.stroke();
      ctx.fillStyle="#5db3d8"; ctx.beginPath(); ctx.arc(fx, fy, r.w/2-7, 0, 7); ctx.fill();
      ctx.fillStyle="#8ed0ea"; ctx.fillRect(fx-9+((t*14)%14), fy-2, 6, 2);
      ctx.fillStyle="#cfc8ba"; ctx.fillRect(fx-3, fy-9, 6, 9);
      ctx.fillStyle="#e3dccc"; ctx.beginPath(); ctx.arc(fx, fy-10, 4, 0, 7); ctx.fill();
      for (let i=0;i<5;i++){ const p=(t*1.5+i*0.2)%1; ctx.fillStyle=`rgba(255,255,255,${(0.85*(1-p)).toFixed(2)})`; ctx.fillRect(fx-1+Math.sin(p*7+i*2)*8, fy-10-p*10+p*p*14, 2, 2); }
      continue;
    }
    if (o.kind==="bench"){
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(r.x+2, r.y+r.h-3, r.w-4, 3);
      ctx.fillStyle="#7a5a38"; ctx.fillRect(r.x+3, r.y+2, r.w-6, 4);
      ctx.fillStyle="#8c6947"; ctx.fillRect(r.x+2, r.y+7, r.w-4, 7);
      ctx.fillStyle="#6a4a2f"; ctx.fillRect(r.x+2, r.y+9, r.w-4, 2);
      ctx.fillStyle="#5a3e26"; ctx.fillRect(r.x+4, r.y+14, 3, 6); ctx.fillRect(r.x+r.w-7, r.y+14, 3, 6);
      continue;
    }
    if (o.kind==="plant"){
      const px = r.x + r.w/2;
      if (r.w > TILE){ // flower bed
        ctx.fillStyle="#6a4a2c"; ctx.fillRect(r.x+2, r.y+10, r.w-4, 12);
        ctx.fillStyle="#7c5a38"; ctx.fillRect(r.x+2, r.y+8, r.w-4, 3);
        for (let i=0;i<5;i++){ ctx.fillStyle=["#ff9db0","#ffd666","#b48ad9","#ff8a5c","#fff8e6"][i%5]; ctx.fillRect(r.x+6+i*8, r.y+11, 4, 4); ctx.fillStyle="#3aa66a"; ctx.fillRect(r.x+7+i*8, r.y+15, 2, 5); }
      } else { // terracotta pot
        ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(px, r.y+21, 7, 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle="#b06a42"; ctx.fillRect(px-6, r.y+12, 12, 9);
        ctx.fillStyle="#c97b50"; ctx.fillRect(px-7, r.y+10, 14, 3);
        ctx.fillStyle="#3aa66a"; ctx.fillRect(px-1, r.y+3, 2, 8);
        const _fc = ["#ff9db0","#ffd666","#b48ad9"][((o.tx||0)+(o.ty||0))%3];
        ctx.fillStyle=_fc; ctx.fillRect(px-4, r.y, 3, 3); ctx.fillRect(px+1, r.y-2, 3, 3); ctx.fillRect(px-1, r.y+3, 3, 3);
      }
      continue;
    }
    if (o.kind==="bld"){
      // drop shadow
      ctx.fillStyle="rgba(0,0,0,.18)"; ctx.fillRect(r.x+4, r.y+r.h, r.w-2, 5);
      // try Kenney sprite; fall back to procedural canvas building
      // normalise: cap sprite height so tall assets can't dwarf the village
      let _dw = r.w + 14;
      const _bimg = getSprite(`bld_${o.id}`);
      if (_bimg){
        const _asp = _bimg.naturalHeight / _bimg.naturalWidth;
        const _maxH = r.h + 26;
        if (_dw * _asp > _maxH) _dw = _maxH / _asp;
      }
      const _spriteDrawn = drawSprite(ctx, `bld_${o.id}`, r.x+r.w/2, r.y+r.h+4, _dw);
      if (!_spriteDrawn){
        // stone foundation strip
        ctx.fillStyle="#5a4030"; ctx.fillRect(r.x, r.y+r.h-5, r.w, 5);
        ctx.fillStyle=o.wall; ctx.fillRect(r.x, r.y+10, r.w, r.h-15);
        ctx.fillStyle=o.roof;
        ctx.beginPath(); ctx.moveTo(r.x-4, r.y+12); ctx.lineTo(r.x+r.w/2, r.y-4); ctx.lineTo(r.x+r.w+4, r.y+12); ctx.closePath(); ctx.fill();
        // door with knob
        ctx.fillStyle="#6a4a2f"; ctx.fillRect(r.x+r.w/2-6, r.y+r.h-18, 12, 18);
        ctx.fillStyle="#c8a060"; ctx.fillRect(r.x+r.w/2-1, r.y+r.h-12, 2, 2);
        if (r.w >= 3*TILE){
          ctx.fillStyle="#bfe8f7"; ctx.fillRect(r.x+8, r.y+20, 10, 8); ctx.fillRect(r.x+r.w-18, r.y+20, 10, 8);
          ctx.strokeStyle="#8c6947"; ctx.lineWidth=1; ctx.strokeRect(r.x+8, r.y+20, 10, 8); ctx.strokeRect(r.x+r.w-18, r.y+20, 10, 8);
          ctx.fillStyle="rgba(255,255,255,0.65)"; ctx.fillRect(r.x+9, r.y+21, 3, 2); ctx.fillRect(r.x+r.w-17, r.y+21, 3, 2);
        }
        // shops get a striped awning + hanging sign so they read distinctly from houses
        if (BUILDING_FLAVOUR[o.tab]){
          const _awY = r.y + r.h - 24, _n = Math.max(3, Math.floor(r.w/8));
          for (let s=0; s<_n; s++){ ctx.fillStyle = s%2 ? "#f4ece0" : (o.roof||"#c04060"); ctx.fillRect(r.x + s*(r.w/_n), _awY, r.w/_n + 0.5, 6); }
          ctx.fillStyle="rgba(0,0,0,.18)"; ctx.fillRect(r.x, _awY+6, r.w, 2);
          for (let s=0; s<_n; s++){ ctx.fillStyle=(o.roof||"#c04060"); ctx.beginPath(); ctx.moveTo(r.x+s*(r.w/_n),_awY+6); ctx.lineTo(r.x+(s+0.5)*(r.w/_n),_awY+10); ctx.lineTo(r.x+(s+1)*(r.w/_n),_awY+6); ctx.closePath(); ctx.fill(); }
          // hanging signboard on the left
          ctx.fillStyle="#4a3320"; ctx.fillRect(r.x-1, r.y+9, 2, 7);
          ctx.fillStyle="#e8d8b0"; ctx.fillRect(r.x-8, r.y+15, 14, 10);
          ctx.strokeStyle="#4a3320"; ctx.lineWidth=1; ctx.strokeRect(r.x-8, r.y+15, 14, 10);
        }
      }
      // Always draw emoji label and dynamic effects on top of sprite or canvas building
      drawEmojiC(ctx, o.ic, r.x+r.w/2, r.y+16, 13);
      // YOUR cottage stands out from the neighbours: a pennant, window flowers, a mat
      if (o.id === "player_home"){
        const _cx = r.x + r.w/2;
        ctx.fillStyle="#6a4a2f"; ctx.fillRect(_cx-1, r.y-17, 2, 17);                          // flag pole
        ctx.fillStyle="#e05a80"; ctx.beginPath(); ctx.moveTo(_cx+1, r.y-17); ctx.lineTo(_cx+15, r.y-13); ctx.lineTo(_cx+1, r.y-9); ctx.closePath(); ctx.fill();  // pennant
        ctx.fillStyle="#fff8e6"; ctx.font="6px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("♥", _cx+5, r.y-13); ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        // flower boxes under the windows
        for (const _bx of [r.x+7, r.x+r.w-19]){
          ctx.fillStyle="#6a4a2f"; ctx.fillRect(_bx, r.y+28, 12, 3);
          for (let f=0; f<3; f++){ ctx.fillStyle=["#e05a80","#ffd666","#f86040"][f]; ctx.fillRect(_bx+2+f*4, r.y+25, 2, 3); }
        }
        ctx.fillStyle="#c0603a"; ctx.fillRect(_cx-9, r.y+r.h-3, 18, 3);                        // welcome mat
      }
      if (o.chimney){
        const _swLvl = skillLvl("steelworks");
        const _chimW = 8 + Math.min(6, Math.floor(_swLvl/10)*2); // chimney grows with level
        const _chimX = r.x + r.w - 16;
        ctx.fillStyle="#7a5a45"; ctx.fillRect(_chimX, r.y-10, _chimW, 14);
        ctx.fillStyle="#6a4a35"; ctx.fillRect(_chimX, r.y-12, _chimW, 4); // chimney rim
        // smoke — always drifts, denser when active or high level
        const _smokePuffs = S.action && S.action.skill==="steelworks" ? Math.min(6, 3+Math.floor(_swLvl/15)) : Math.max(0, Math.floor(_swLvl/20));
        const _smokeAlpha = S.action && S.action.skill==="steelworks" ? 0.55 : 0.25;
        for (let i=0;i<_smokePuffs;i++){
          const p=((t*0.5+i/_smokePuffs)%1);
          const _sa = (_smokeAlpha*(1-p)).toFixed(2);
          ctx.fillStyle=`rgba(110,110,120,${_sa})`;
          ctx.beginPath(); ctx.arc(_chimX+_chimW/2+Math.sin(p*5+i)*4, r.y-14-p*28, 3+p*5, 0, 7); ctx.fill();
        }
      }
      if (o.id==="workshop" && S.action && S.action.skill==="manufacturing" && Math.floor(t*4)%2)
        drawEmojiC(ctx,"✨", r.x+r.w-8, r.y+8, 10);
    }
    if (o.kind==="stall"){
      const scx = r.x + r.w/2;
      // awning canopy on slim posts
      ctx.fillStyle="#6a4a2f"; ctx.fillRect(r.x+2, r.y+8, 3, r.h-18); ctx.fillRect(r.x+r.w-5, r.y+8, 3, r.h-18);
      for (let i=0;i<r.w;i+=8){ ctx.fillStyle = (i/8)%2 ? "#fff8e6" : o.awn; ctx.fillRect(r.x+i, r.y, 8, 9); }
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(r.x, r.y+9, r.w, 2);
      // vendor bobs gently; turns to face the player when nearby
      const _bob = Math.sin(t*2 + o.tx)*1.2;
      const _near = Math.hypot(VP.x-scx, VP.y-(r.y+r.h)) < 80;
      drawPerson(ctx, scx, r.y+r.h-16+_bob, o.hair, o.shirt, t+o.tx, false, _near ? (VP.x>=scx?1:-1) : 1, null, "down");
      // slim counter with this trader's actual goods on display
      ctx.fillStyle="#8c6947"; ctx.fillRect(r.x+1, r.y+r.h-12, r.w-2, 10);
      ctx.fillStyle="#a97f52"; ctx.fillRect(r.x+1, r.y+r.h-14, r.w-2, 3);
      const _npc = NPCS.find(n=>`stall_${n.id}`===o.id);
      if (_npc){ _npc.stock.slice(0,3).forEach((it,k)=>{ const _it=ITEMS[it]; if(_it) drawEmojiC(ctx, _it.ic, r.x+9+k*14, r.y+r.h-16, 9); }); }
      if (skillLvl("trading") < o.lvl) drawEmojiC(ctx,"🔒", scx, r.y-6, 10);
    }
    if (o.kind==="tree"){
      const cx = r.x + r.w/2;
      const stage = getTreeStage(o);
      // Seedling stage
      if (stage === 0) {
        ctx.fillStyle="#5a8040"; ctx.fillRect(cx-1, r.y+r.h-5, 3, 5);
        drawEmojiC(ctx, "🌱", cx, r.y+r.h-9, 11);
        continue;
      }
      // Sapling stage
      if (stage === 1) {
        const bark2 = o.ore==="pine" ? "#7a5a2e" : "#6a4828";
        ctx.fillStyle=bark2; ctx.fillRect(cx-2, r.y+r.h-5, 3, 6);
        ctx.fillStyle=o.ore==="pine"?"#3a8a30":"#5a8040"; ctx.beginPath(); ctx.arc(cx, r.y+r.h-12, 9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=o.ore==="pine"?"#4aaa3a":"#6a9850"; ctx.beginPath(); ctx.arc(cx, r.y+r.h-18, 6, 0, Math.PI*2); ctx.fill();
        continue;
      }
      // Full tree
      const treeActive = S.action?.skill==="woodcutting" && S.action?.objId===o.id;
      const locked = skillLvl("woodcutting") < o.lvl;
      const sway = Math.sin(t*0.8 + o.tx*0.5);
      const bark = o.ore==="pine" ? "#7a5a2e" : o.ore==="oak" ? "#6a4828" : "#5a3818";
      const l1 = locked ? (o.ore==="pine"?"#2a5028":o.ore==="oak"?"#3a4820":"#2a3818") : (o.ore==="pine"?"#3a8a30":o.ore==="oak"?"#5a8040":"#2a7030");
      const l2 = locked ? (o.ore==="pine"?"#1e4020":o.ore==="oak"?"#2a3810":"#1e2e10") : (o.ore==="pine"?"#4aaa3a":o.ore==="oak"?"#6a9850":"#3a8848");
      const l3 = locked ? "#3a4a20" : (o.ore==="pine"?"#5ac840":o.ore==="oak"?"#7aaa60":"#4a9860");
      if (o.ore==="rare_leaf"){
        // exotic rare tree — pulsing purple/teal canopy
        const rl1 = locked ? "#4a3a5a" : "#9a40d0";
        const rl2 = locked ? "#3a2a4a" : "#7030a8";
        const rl3 = locked ? "#5a4a6a" : "#c060e8";
        ctx.fillStyle=bark; ctx.fillRect(cx-5, r.y+r.h-8, 10, 9);
        ctx.fillStyle=rl1; ctx.beginPath(); ctx.arc(cx+sway, r.y+r.h-24, 16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=rl2; ctx.beginPath(); ctx.arc(cx-14+sway, r.y+r.h-30, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=rl2; ctx.beginPath(); ctx.arc(cx+12+sway, r.y+r.h-28, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=rl3; ctx.beginPath(); ctx.arc(cx+sway*0.8, r.y+r.h-38, 8, 0, Math.PI*2); ctx.fill();
        if (!locked && Math.floor(Date.now()/700)%3===0) drawEmojiC(ctx,"✨", cx+sway*2, r.y+r.h-44, 8);
      } else if (o.ore==="pine"){
        // tall narrow triangular layered silhouette
        ctx.fillStyle=bark; ctx.fillRect(cx-2, r.y+r.h-6, 4, 7);
        ctx.fillStyle=l1; ctx.beginPath(); ctx.moveTo(cx+sway*1.5, r.y+r.h-30); ctx.lineTo(cx-13+sway, r.y+r.h-12); ctx.lineTo(cx+13+sway, r.y+r.h-12); ctx.closePath(); ctx.fill();
        ctx.fillStyle=l2; ctx.beginPath(); ctx.moveTo(cx+sway, r.y+r.h-40); ctx.lineTo(cx-9+sway*0.7, r.y+r.h-24); ctx.lineTo(cx+9+sway*0.7, r.y+r.h-24); ctx.closePath(); ctx.fill();
        ctx.fillStyle=l3; ctx.beginPath(); ctx.moveTo(cx+sway*0.5, r.y+r.h-48); ctx.lineTo(cx-5+sway*0.4, r.y+r.h-34); ctx.lineTo(cx+5+sway*0.4, r.y+r.h-34); ctx.closePath(); ctx.fill();
      } else if (o.ore==="oak"){
        // wide round multi-cluster spreading canopy
        ctx.fillStyle=bark; ctx.fillRect(cx-4, r.y+r.h-7, 8, 8);
        ctx.fillStyle=l1; ctx.beginPath(); ctx.arc(cx+sway, r.y+r.h-22, 17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l2; ctx.beginPath(); ctx.arc(cx-12+sway*0.8, r.y+r.h-28, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l2; ctx.beginPath(); ctx.arc(cx+12+sway*0.9, r.y+r.h-27, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l3; ctx.beginPath(); ctx.arc(cx+sway*0.6, r.y+r.h-35, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l3; ctx.beginPath(); ctx.arc(cx-6+sway*0.7, r.y+r.h-16, 7, 0, Math.PI*2); ctx.fill();
      } else {
        // massive irregular spreading hardwood canopy
        ctx.fillStyle=bark; ctx.fillRect(cx-5, r.y+r.h-8, 10, 9);
        ctx.fillStyle=l1; ctx.beginPath(); ctx.arc(cx+sway, r.y+r.h-20, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l2; ctx.beginPath(); ctx.arc(cx-16+sway*1.2, r.y+r.h-26, 13, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l2; ctx.beginPath(); ctx.arc(cx+14+sway, r.y+r.h-28, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l3; ctx.beginPath(); ctx.arc(cx-6+sway*0.8, r.y+r.h-36, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l3; ctx.beginPath(); ctx.arc(cx+8+sway*1.1, r.y+r.h-38, 9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=l1; ctx.beginPath(); ctx.arc(cx+sway*0.4, r.y+r.h-44, 7, 0, Math.PI*2); ctx.fill();
      }
      if (locked){ ctx.fillStyle="rgba(0,0,0,.22)"; ctx.beginPath(); ctx.arc(cx+sway, r.y+r.h-28, 22, 0, Math.PI*2); ctx.fill(); }
      if (treeActive) drawEmojiC(ctx, "🪓", cx+Math.sin(t*10)*4, r.y+r.h-22, 13);
      continue;
    }
    if (o.kind==="lamp"){
      const lx = r.x + r.w/2, ly = r.y;
      const _g = lampGlow();
      ctx.fillStyle="rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(lx, ly+2, 6, 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle='#3a3230'; ctx.fillRect(lx-2, ly-30, 4, 32);
      ctx.fillStyle='#2c2624'; ctx.fillRect(lx-6, ly-42, 12, 10);
      ctx.fillStyle = _g > 0.05 ? `rgba(255,214,102,${(0.35+0.65*_g).toFixed(2)})` : '#5a6470';
      ctx.fillRect(lx-4, ly-40, 8, 6);
      ctx.fillStyle='#2c2624'; ctx.fillRect(lx-7, ly-45, 14, 3);
      continue;
    }
    if (o.kind==="sign"){
      ctx.fillStyle="#8c6947"; ctx.fillRect(r.x+10, r.y+8, 4, 14);
      ctx.fillStyle="#c9a06a"; ctx.fillRect(r.x+2, r.y, 20, 12);
      drawEmojiC(ctx, o.ic, r.x+12, r.y+6, 9);
    }
  }
}
function drawSeasonalBillboard(ctx, t){
  const _curSeason = getSeason();
  const _billX = 40*TILE, _billY = 2*TILE;
  const THEMES = {
    summer: { post:"#5a3a1a", bg:"#e8d090", edge:"#c8a860", fg:"#a83020", sub:"#5a3010", title:"☀ SUMMER FETE",  dates:"Jun – Aug" },
    autumn: { post:"#5a3a1a", bg:"#e0a050", edge:"#b87838", fg:"#3a2010", sub:"#5a3010", title:"🍂 HARVEST FEST", dates:"Sep – Nov" },
    winter: { post:"#3a3a5a", bg:"#c8d8f0", edge:"#98a8c8", fg:"#2a3a6a", sub:"#3a3a5a", title:"❄ XMAS MARKET",  dates:"Dec – Jan" },
  };
  const th = THEMES[_curSeason]; if (!th) return;
  // wider board so the caption always sits comfortably inside it
  const bw = 72, bh = 22, left = _billX - bw/2;
  ctx.fillStyle = th.post; ctx.fillRect(_billX-1, _billY+bh-2, 3, 22);   // hanging post
  ctx.fillStyle = th.edge; ctx.fillRect(left-1, _billY-1, bw+2, bh+2);   // frame
  ctx.fillStyle = th.bg;   ctx.fillRect(left, _billY, bw, bh);           // board face
  const cx = _billX;
  ctx.fillStyle = th.fg;  fitText(ctx, th.title, cx, _billY+3,  bw-8, 8, { weight:"bold" });
  ctx.fillStyle = th.sub; fitText(ctx, th.dates, cx, _billY+13, bw-8, 7);
}
function drawExtras(ctx, t){
  const tier = villageTierLvl();
  // helper: draw picket fence strip at given x-offset, rows 2-16, with gate rows skipped
  const _drawFence = (fxBase, gateRows) => {
    const _fx = fxBase - 4;
    for (let fr = 22; fr <= 36; fr++){
      if (gateRows.includes(fr)) continue;
      const fy = fr*TILE;
      ctx.fillStyle="#e8e2d2";
      ctx.fillRect(_fx, fy+2, 4, 18); ctx.fillRect(_fx+12, fy+2, 4, 18);
      ctx.fillStyle="#cfc8b8";
      ctx.beginPath(); ctx.moveTo(_fx, fy+2); ctx.lineTo(_fx+2, fy-2); ctx.lineTo(_fx+4, fy+2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(_fx+12, fy+2); ctx.lineTo(_fx+14, fy-2); ctx.lineTo(_fx+16, fy+2); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#d9d2c2"; ctx.fillRect(_fx-3, fy+6, 22, 3); ctx.fillRect(_fx-3, fy+13, 22, 3);
    }
  };
  _drawFence(39*TILE, [25,26,30,31]); // west forest west fence
  _drawFence(47*TILE, [25,26,30,31]); // west forest east fence
  _drawFence(87*TILE, [25,26,30,31]); // east forest west fence
  // Retail high street — decorative bunting between lamp posts
  {
    const _ryBase = 4*TILE;  // retail HIGH STREET row y pixel (VMAP row 4)
    const _rx0 = 5*TILE;
    const _rx1 = 33*TILE;
    // bunting string
    ctx.strokeStyle="#8a6a4a"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(_rx0, _ryBase-8); ctx.lineTo(_rx1, _ryBase-8); ctx.stroke();
    // bunting flags every ~18px
    const _flagColors = ["#e84060","#ffd666","#4a8ae8","#68cc68","#e86040","#c840e8"];
    for(let bi=0; bi<Math.floor((_rx1-_rx0)/18); bi++){
      const _bx = _rx0 + bi*18 + 4;
      ctx.fillStyle = _flagColors[bi % _flagColors.length];
      ctx.beginPath(); ctx.moveTo(_bx, _ryBase-9); ctx.lineTo(_bx-5, _ryBase-1); ctx.lineTo(_bx+5, _ryBase-1); ctx.closePath(); ctx.fill();
    }
    // "HIGH STREET" sign on a post at tx≈35
    const _signX = 35*TILE, _signY = 3*TILE;
    ctx.fillStyle="#3a2010"; ctx.fillRect(_signX-1, _signY, 3, TILE*2);
    ctx.fillStyle="#c8a060"; ctx.fillRect(_signX-24, _signY+8, 50, 14);
    ctx.fillStyle="#1a0c00";
    fitText(ctx, "HIGH STREET", _signX+1, _signY+15, 46, 8, { weight:"bold", family:"sans-serif", baseline:"middle" });
    // Seasonal high street decorations
    const _curSeason = getSeason();
    if (_curSeason === "winter"){
      // Christmas: red-green garland stripe + gold stars
      ctx.strokeStyle="#c02020"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(_rx0, _ryBase-13); ctx.lineTo(_rx1, _ryBase-13); ctx.stroke();
      ctx.strokeStyle="#208a20"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(_rx0, _ryBase-11); ctx.lineTo(_rx1, _ryBase-11); ctx.stroke();
      for(let sx=_rx0+14; sx<_rx1; sx+=32) drawEmojiC(ctx,"⭐", sx, _ryBase-18, 8);
    } else if (_curSeason === "summer"){
      // Summer fete: extra dense rainbow pennants on a second line
      const _fcS = ["#ff4040","#ff9020","#ffe030","#40c040","#4080ff","#c040e0"];
      ctx.strokeStyle="#5a3a2a"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(_rx0, _ryBase-15); ctx.lineTo(_rx1, _ryBase-15); ctx.stroke();
      for(let bi=0; bi<Math.floor((_rx1-_rx0)/13); bi++){
        const _bx = _rx0 + bi*13 + 3;
        ctx.fillStyle = _fcS[bi % _fcS.length];
        ctx.beginPath(); ctx.moveTo(_bx, _ryBase-16); ctx.lineTo(_bx-4, _ryBase-8); ctx.lineTo(_bx+4, _ryBase-8); ctx.closePath(); ctx.fill();
      }
    } else if (_curSeason === "autumn"){
      // Harvest: orange/gold pennants + pumpkins at stall fronts
      const _hc = ["#e06020","#c89020","#c84020","#a86020"];
      ctx.strokeStyle="#5a3a10"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(_rx0, _ryBase-13); ctx.lineTo(_rx1, _ryBase-13); ctx.stroke();
      for(let bi=0; bi<Math.floor((_rx1-_rx0)/15); bi++){
        const _bx = _rx0 + bi*15 + 4;
        ctx.fillStyle = _hc[bi % _hc.length];
        ctx.beginPath(); ctx.moveTo(_bx, _ryBase-14); ctx.lineTo(_bx-5, _ryBase-6); ctx.lineTo(_bx+5, _ryBase-6); ctx.closePath(); ctx.fill();
      }
      for(let px=_rx0+20; px<_rx1-10; px+=52) drawEmojiC(ctx,"🎃", px, _ryBase-2, 9);
    }
    // Summer Fete — a purely decorative event ABOVE the high street so it never
    // obstructs anyone walking. A striped marquee anchors it.
    if (_curSeason === "summer"){
      const _topY = 2*TILE;   // row 2, above the walkable street (row 4)
      // striped marquee tent centred on the high street
      const _mqX = 20*TILE;
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(_mqX, _topY+30, 40, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#f6ecd8"; ctx.fillRect(_mqX-34, _topY+14, 68, 18);                 // tent body
      for (let s=0;s<7;s++){ ctx.fillStyle = s%2 ? "#e84060" : "#fff6e6"; ctx.beginPath(); ctx.moveTo(_mqX-34+s*10, _topY+15); ctx.lineTo(_mqX-34+s*10+5, _topY+2); ctx.lineTo(_mqX-34+s*10+10, _topY+15); ctx.closePath(); ctx.fill(); }  // striped roof
      ctx.fillStyle="#8a6a4a"; ctx.fillRect(_mqX-34, _topY+14, 2, 18); ctx.fillRect(_mqX+32, _topY+14, 2, 18);  // poles
      ctx.fillStyle="#3aa66a"; ctx.beginPath(); ctx.moveTo(_mqX, _topY-6); ctx.lineTo(_mqX+9, _topY-3); ctx.lineTo(_mqX, _topY); ctx.closePath(); ctx.fill();  // pennant
      ctx.fillStyle="#6a4a2f"; ctx.fillRect(_mqX-0.5, _topY-6, 1, 8);
      drawEmojiC(ctx,"🎪", _mqX, _topY+22, 12);
      // bunting helpers & treats, all above the street
      drawEmojiC(ctx,"🍦", 30*TILE, _topY+20, 11);
      drawEmojiC(ctx,"🎈", 12*TILE, _topY+18, 12);
      drawEmojiC(ctx,"🎈", 28*TILE, _topY+18, 12);
    }
    // Children's lemonade stand (open for 4 hours after school) — funds the school
    if (lemonadeOpen()){
      const sx = LEMONADE.tx*TILE, sy = LEMONADE.ty*TILE;
      // sign on a post
      ctx.fillStyle="#8a6a40"; ctx.fillRect(sx+12, sy-16, 2, 20);
      ctx.fillStyle="#fff4e0"; ctx.fillRect(sx+2, sy-18, 22, 12);
      ctx.strokeStyle="#c89020"; ctx.lineWidth=1; ctx.strokeRect(sx+2, sy-18, 22, 12);
      ctx.fillStyle="#c84020"; fitText(ctx,"LEMONADE", sx+13, sy-16, 20, 5, {weight:"bold"});
      ctx.fillStyle="#3a7a3a"; fitText(ctx, LEMONADE.price+"c → school", sx+13, sy-10, 20, 4);
      // the child(ren) serving, drawn behind the stall
      const _kids = lemonadeSellers();
      if (_kids[0]) drawPerson(ctx, sx+7,  sy+1, _kids[0].hair||"#6a4a2f", _kids[0].shirt||"#ffd666", t, false, 1,  null, "down", null, _kids[0].trouser||"#4a5a3a", null, _kids[0].female, 0.82);
      if (_kids[1]) drawPerson(ctx, sx+19, sy+1, _kids[1].hair||"#8a6a2a", _kids[1].shirt||"#f0b0dc", t, false, -1, null, "down", null, _kids[1].trouser||"#5a3a3a", null, _kids[1].female, 0.82);
      // stall table + striped cloth in front of them
      ctx.fillStyle="#8a5a2a"; ctx.fillRect(sx, sy+8, 26, 3); ctx.fillRect(sx+1, sy+11, 3, 9); ctx.fillRect(sx+22, sy+11, 3, 9);
      for(let s=0;s<6;s++){ ctx.fillStyle = s%2 ? "#ffe25a" : "#ff9a3c"; ctx.fillRect(sx+s*4.4, sy+11, 5, 8); }
      // pitcher + cups on the table
      ctx.fillStyle="#fff8e6"; ctx.fillRect(sx+11, sy+4, 5, 6); ctx.fillStyle="#ffe25a"; ctx.fillRect(sx+11, sy+5, 5, 4);
      ctx.fillStyle="#fff8e6"; ctx.fillRect(sx+4, sy+7, 3, 3); ctx.fillRect(sx+20, sy+7, 3, 3);
      drawEmojiC(ctx,"🍋", sx+6, sy+3, 7); drawEmojiC(ctx,"🍋", sx+22, sy+3, 7);
    }
  }
  // park (tx:76-86, ty:6-10): traditional manicured park
  {
    const pkX = 76*TILE, pkY = (6+NORTH_EXT)*TILE, pkW = 10*TILE, pkH = 4*TILE;
    const pcy = pkY + pkH/2;
    // rich grass base with mowed stripe texture
    ctx.fillStyle="#4e9e3a"; ctx.fillRect(pkX, pkY, pkW, pkH);
    for(let gx=pkX; gx<pkX+pkW; gx+=TILE){
      ctx.fillStyle=(((gx-pkX)/TILE)%2===0)?"rgba(0,0,0,.06)":"rgba(255,255,255,.04)";
      ctx.fillRect(gx, pkY, TILE/2, pkH);
    }
    // E-W cobblestone path with joint detail
    ctx.fillStyle="#c8bc98"; ctx.fillRect(pkX, pcy-7, pkW, 14);
    ctx.fillStyle="#b0a480"; ctx.fillRect(pkX, pcy-7, pkW, 2); ctx.fillRect(pkX, pcy+5, pkW, 2);
    ctx.fillStyle="rgba(0,0,0,.12)";
    for(let px=pkX+18; px<pkX+pkW; px+=18){ ctx.fillRect(px, pcy-5, 1, 10); }
    for(let px=pkX+2; px<pkX+pkW; px+=22){ ctx.fillRect(px, pcy-3, 12, 1); ctx.fillRect(px+9, pcy+1, 11, 1); }
    // central circular flower bed — raised stone edging + rich soil + vivid flowers
    const fcx=pkX+pkW/2, fcy=pcy;
    ctx.fillStyle="#7a5830"; ctx.beginPath(); ctx.arc(fcx,fcy,18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#4a2a08"; ctx.beginPath(); ctx.arc(fcx,fcy,16,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a7028"; ctx.beginPath(); ctx.arc(fcx,fcy,13,0,Math.PI*2); ctx.fill();
    const FC=["#ff3870","#ffd020","#9040d8","#ff5010","#28d888","#ff60c0","#38b0ff","#ffc840"];
    for(let fi=0;fi<8;fi++){
      const ang=fi*Math.PI/4;
      ctx.fillStyle=FC[fi]; ctx.beginPath(); ctx.arc(fcx+Math.cos(ang)*9,fcy+Math.sin(ang)*9,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(fcx+Math.cos(ang)*8.5,fcy+Math.sin(ang)*8.5,1.5,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle="#ffc830"; ctx.beginPath(); ctx.arc(fcx,fcy,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff0a0"; ctx.beginPath(); ctx.arc(fcx,fcy,2.5,0,Math.PI*2); ctx.fill();
    // corner flower patches (NW and NE, above path)
    [[pkX+10,pkY+8],[pkX+pkW-42,pkY+8]].forEach(([bx,by])=>{
      ctx.fillStyle="#5a3a10"; ctx.fillRect(bx-2,by-2,34,20);
      ctx.fillStyle="#3a2008"; ctx.fillRect(bx,by,30,16);
      ctx.fillStyle="#3a7020"; ctx.fillRect(bx+2,by+2,26,12);
      const pc=["#ff3870","#ffd020","#9040d8","#28d888","#ff60c0","#38b0ff"];
      for(let k=0;k<6;k++){ ctx.fillStyle=pc[k]; ctx.beginPath(); ctx.arc(bx+5+k*4,by+9,3,0,Math.PI*2); ctx.fill(); }
    });
    // grey bitumen perimeter path (UK park tarmac)
    ctx.fillStyle="#b0b0b0"; ctx.fillRect(pkX-6, pkY-6, pkW+12, 10);   // north edge
    ctx.fillRect(pkX-6, pkY+pkH-4, pkW+12, 10);                         // south edge
    ctx.fillRect(pkX-6, pkY-6, 10, pkH+12);                             // west edge
    ctx.fillRect(pkX+pkW-4, pkY-6, 10, pkH+12);                         // east edge
    ctx.fillStyle="#a0a0a0"; ctx.fillRect(pkX-5, pkY-5, pkW+10, 2);     // subtle kerb shadow north
    ctx.fillRect(pkX-5, pkY+pkH+3, pkW+10, 2);                          // south
    // sandbox (SW area below E-W path)
    const sbX=pkX+8, sbY=pkY+pkH-36;
    ctx.fillStyle="#7a4a18";
    ctx.fillRect(sbX-3,sbY-3,44,5); ctx.fillRect(sbX-3,sbY+29,44,5);
    ctx.fillRect(sbX-3,sbY-3,5,35); ctx.fillRect(sbX+39,sbY-3,5,35);
    ctx.fillStyle="#e4c860"; ctx.fillRect(sbX,sbY,40,30);
    ctx.fillStyle="#f0d880"; ctx.fillRect(sbX+4,sbY+4,32,22);
    ctx.fillStyle="#c8a030"; ctx.fillRect(sbX+6,sbY+10,12,3); ctx.fillRect(sbX+6,sbY+16,18,3);
    drawEmojiC(ctx,"🪣",sbX+28,sbY+16,10);
    // slide (east side, north-to-south)
    const slX=pkX+154, slY=pkY+8;
    ctx.fillStyle="#4a3010"; ctx.fillRect(slX-8,slY,4,pkH-26); ctx.fillRect(slX,slY,4,pkH-26);
    for(let rs=slY+5;rs<pkY+pkH-28;rs+=5){ ctx.fillStyle="#6a4818"; ctx.fillRect(slX-8,rs,12,2); }
    ctx.fillStyle="#c02848";
    ctx.beginPath(); ctx.moveTo(slX+4,slY+5); ctx.lineTo(slX+28,pkY+pkH-22); ctx.lineTo(slX+28,pkY+pkH-18); ctx.lineTo(slX+4,slY+9); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#e03860";
    ctx.beginPath(); ctx.moveTo(slX+8,slY+5); ctx.lineTo(slX+24,pkY+pkH-22); ctx.lineTo(slX+24,pkY+pkH-20); ctx.lineTo(slX+9,slY+5); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#a02040"; ctx.fillRect(slX+4,slY,26,7);
    ctx.fillStyle="#c83060"; ctx.fillRect(slX+6,slY+1,22,4);
    // swings (far east, animated arc)
    const swX=pkX+194, swY=pkY+8;
    ctx.fillStyle="#4a3010"; ctx.fillRect(swX,swY,4,pkH-26); ctx.fillRect(swX+28,swY,4,pkH-26);
    ctx.fillStyle="#382008"; ctx.fillRect(swX-2,swY,36,5);
    const sa=Math.sin(t*1.4)*13;
    ctx.strokeStyle="#382808"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(swX+2,swY+5); ctx.lineTo(swX+8+sa,swY+36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(swX+30,swY+5); ctx.lineTo(swX+24+sa,swY+36); ctx.stroke();
    ctx.fillStyle="#1a4fc0"; ctx.fillRect(swX+4+sa,swY+36,20,5);
    ctx.fillStyle="#2860d8"; ctx.fillRect(swX+5+sa,swY+36,18,3);
    // festival bunting across the park during active festivals
    if (isFestivalActive()){
      const _bColors = ['#e84040','#f0c030','#40a040','#4060e8','#e040c0','#f08020'];
      const _bY = pkY + 3;
      ctx.strokeStyle="rgba(80,50,20,.55)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pkX+2,_bY); ctx.lineTo(pkX+pkW-2,_bY); ctx.stroke();
      for(let fi=0;fi<9;fi++){
        const _fx = pkX+4 + fi*(pkW-8)/8;
        ctx.fillStyle=_bColors[fi%_bColors.length];
        ctx.beginPath(); ctx.moveTo(_fx-4,_bY); ctx.lineTo(_fx+4,_bY); ctx.lineTo(_fx,_bY+9); ctx.closePath(); ctx.fill();
      }
    }
  }
  // ambient life — a wandering village cat + seasonal butterflies
  {
    // cat pads around the town square (tx 24-34, ty 26-30)
    const _cd = Math.hypot(_cat.tx-_cat.x, _cat.ty-_cat.y) || 1;
    if (_cd < 4){
      if (!_cat.pauseT) _cat.pauseT = Date.now() + 2000 + Math.random()*4000;
      if (Date.now() > _cat.pauseT){ _cat.tx=(24+Math.random()*10)*TILE; _cat.ty=(26+Math.random()*4)*TILE; _cat.pauseT=0; }
      _cat.moving=false;
    } else { _cat.x+=(_cat.tx-_cat.x)/_cd*0.7; _cat.y+=(_cat.ty-_cat.y)/_cd*0.7; _cat.moving=true; _cat.facing=(_cat.tx-_cat.x)>=0?1:-1; }
    const cx=Math.round(_cat.x), cy=Math.round(_cat.y), bob=_cat.moving?Math.sin(t*10)*1:0;
    ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(cx,cy+3,7,2,0,0,7); ctx.fill();
    ctx.fillStyle="#6a5a4a"; ctx.fillRect(cx-6,cy-4+bob,10,6);                 // body
    ctx.fillRect(cx-8*_cat.facing,cy-2+bob,3,4);                              // head bump
    ctx.fillRect(cx+4*_cat.facing,cy-7+bob,1,3); ctx.fillRect(cx+6*_cat.facing,cy-7+bob,1,3); // ears
    ctx.strokeStyle="#6a5a4a"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(cx-6,cy-2+bob); ctx.lineTo(cx-9,cy-4-Math.sin(t*4)*2+bob); ctx.stroke(); // tail
    // butterflies flit over the residential/park area in spring & summer
    const _wsn=getSeason();
    if (_wsn==="spring"||_wsn==="summer"){
      while(_bflies.length<4) _bflies.push({ x:(74+Math.random()*12)*TILE, y:(26+Math.random()*4)*TILE, ph:Math.random()*7, col:["#ff90c0","#ffd050","#a0d0ff","#ff8060"][Math.floor(Math.random()*4)] });
      for(const b of _bflies){
        b.x+=Math.sin(t*1.3+b.ph)*0.6; b.y+=Math.cos(t*1.7+b.ph)*0.5;
        const flap=Math.sin(t*14+b.ph)>0?1:-1;
        ctx.fillStyle=b.col; ctx.fillRect(b.x-3*flap|0,b.y-2|0,3,4); ctx.fillRect(b.x|0,b.y-2|0,3,4);
      }
    } else _bflies.length=0;
  }
  // residential flower strip (along path rows 5 and 10)
  for (let col = 50; col < 86; col += 5){
    const colors = ["#ff9db0","#ffd666","#b48ad9","#7cd0a8"];
    const fc = colors[Math.floor(col/5)%4];
    ctx.fillStyle=fc; ctx.fillRect(col*TILE+10, (4+NORTH_EXT)*TILE+14, 4, 4); ctx.fillStyle="#3aa66a"; ctx.fillRect(col*TILE+11, (4+NORTH_EXT)*TILE+18, 2, 3);
    ctx.fillStyle=colors[(Math.floor(col/5)+2)%4]; ctx.fillRect(col*TILE+10, (9+NORTH_EXT)*TILE+14, 4, 4); ctx.fillStyle="#3aa66a"; ctx.fillRect(col*TILE+11, (9+NORTH_EXT)*TILE+18, 2, 3);
  }
  // North forest clearing — light dappled circle near the lore stone (tx:20, ty:13)
  {
    const _clx = 20*TILE + TILE/2, _cly = 13*TILE + TILE/2;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#c8e890";
    ctx.beginPath(); ctx.arc(_clx, _cly, 38, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#e8f8c0";
    ctx.beginPath(); ctx.arc(_clx, _cly, 28, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // small mushroom emoji cluster
    drawEmojiC(ctx, "🍄", _clx - 14, _cly + 10, 8);
    drawEmojiC(ctx, "🍄", _clx + 8,  _cly + 6,  7);
    drawEmojiC(ctx, "🌿", _clx - 4,  _cly - 10, 8);
  }
  // sky birds — three V-shapes drifting across the upper sky
  ctx.strokeStyle="rgba(40,30,20,0.6)"; ctx.lineWidth=1;
  for (let i=0;i<3;i++){
    const p=(t*0.038+i*0.37)%1;
    const bx=p*(VCOLS*TILE+160)-80, by=TILE*0.5+Math.sin(p*Math.PI*8)*7+i*19;
    if (by < TILE*3){
      ctx.beginPath(); ctx.moveTo(bx-5,by-2); ctx.lineTo(bx,by+2); ctx.lineTo(bx+5,by-2); ctx.stroke();
    }
  }
  // beach birds — sit on sand, scatter when VP gets within 3 tiles
  for (const b of BEACH_BIRDS){
    b.flap += 0.09;
    const bsx = Math.round(b.x - CAM.x), bsy = Math.round(b.y - CAM.y);
    if (bsx < -12 || bsx > VIEW_W+12 || bsy < -12 || bsy > VIEW_H+12) continue;
    if (b.state==="sit"){
      // body
      ctx.fillStyle="#f5f2ee"; ctx.fillRect(bsx-5,bsy-1,11,5);
      // head bump
      ctx.fillStyle="#f5f2ee"; ctx.fillRect(bsx-3,bsy-4,6,4);
      // beak
      ctx.fillStyle="#e8901a"; ctx.fillRect(bsx+3,bsy-2,4,2);
      // eye
      ctx.fillStyle="#1a1614"; ctx.fillRect(bsx+1,bsy-3,2,2);
      // wing fold line
      ctx.fillStyle="#c8c4c0"; ctx.fillRect(bsx-4,bsy+1,9,2);
      // legs
      ctx.fillStyle="#e8901a"; ctx.fillRect(bsx-2,bsy+4,2,3); ctx.fillRect(bsx+2,bsy+4,2,3);
    } else {
      const wf = Math.sin(b.flap*6)*4;
      // body
      ctx.fillStyle="#f5f2ee"; ctx.fillRect(bsx-3,bsy-1,6,4);
      // left wing up
      ctx.fillStyle="#dcdad6"; ctx.fillRect(bsx-12,bsy-2-wf,10,3);
      // right wing down
      ctx.fillStyle="#dcdad6"; ctx.fillRect(bsx+3,bsy-2+wf,10,3);
      // head
      ctx.fillStyle="#f5f2ee"; ctx.fillRect(bsx-2,bsy-4,5,4);
      // beak
      ctx.fillStyle="#e8901a"; ctx.fillRect(bsx+2,bsy-3,3,2);
      // eye
      ctx.fillStyle="#1a1614"; ctx.fillRect(bsx,bsy-3,2,2);
    }
  }
  ctx.fillStyle="#8c6947";
  for (let i=0;i<5;i++) ctx.fillRect(28*TILE, (17.5+NORTH_EXT)*TILE+i*10, 2*TILE, 7);
  ctx.fillStyle="#7a5a3a"; ctx.fillRect(28*TILE+4, (17.5+NORTH_EXT)*TILE, 4, 52); ctx.fillRect(30*TILE-8, (17.5+NORTH_EXT)*TILE, 4, 52);
  const bob = Math.sin(t*1.6)*2;
  { const bx = 31.4*TILE, by = (19.6+NORTH_EXT)*TILE + bob;
    ctx.strokeStyle="#6a4a2f"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(30*TILE+6, (18.6+NORTH_EXT)*TILE+8); ctx.quadraticCurveTo(bx-6, by-4, bx+4, by+3); ctx.stroke();
    ctx.fillStyle="rgba(20,60,90,.25)"; ctx.beginPath(); ctx.ellipse(bx+27, by+15, 26, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#8a3e34";
    ctx.beginPath(); ctx.moveTo(bx-4, by); ctx.lineTo(bx+50, by); ctx.lineTo(bx+58, by+5); ctx.lineTo(bx+46, by+13); ctx.lineTo(bx+2, by+13); ctx.lineTo(bx-10, by+5); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#b0574f"; ctx.fillRect(bx-4, by, 54, 5);
    ctx.fillStyle="#e8e2d2"; ctx.fillRect(bx-2, by-2, 52, 2);
    ctx.fillStyle="#d9a86a"; ctx.fillRect(bx+30, by-9, 14, 9);
    ctx.fillStyle="#453423"; ctx.fillRect(bx+33, by-7, 4, 3);
    ctx.fillStyle="#6a4a2f"; ctx.fillRect(bx+16, by-26, 3, 26);
    ctx.fillStyle="#fff8e6"; ctx.beginPath(); ctx.moveTo(bx+19, by-25); ctx.quadraticCurveTo(bx+38+Math.sin(t*2)*2, by-18, bx+19, by-8); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#e8dcc0"; ctx.fillRect(bx+12, by-26, 3, 3);
  }
  if (tier>=2){
    ctx.strokeStyle="#8c6947"; ctx.beginPath(); ctx.moveTo(12*TILE, (10.7+NORTH_EXT)*TILE); ctx.lineTo(20*TILE, (10.7+NORTH_EXT)*TILE); ctx.stroke();
    for (let i=0;i<12;i++){
      ctx.fillStyle=["#ff8a5c","#ffd666","#6fb7d9","#ff9db0"][i%4];
      const bx = 12*TILE+i*16;
      ctx.beginPath(); ctx.moveTo(bx, (10.7+NORTH_EXT)*TILE); ctx.lineTo(bx+12, (10.7+NORTH_EXT)*TILE); ctx.lineTo(bx+6, (10.7+NORTH_EXT)*TILE+8); ctx.closePath(); ctx.fill();
    }
    const fx=15.9*TILE, fy=(7.4+NORTH_EXT)*TILE;
    ctx.fillStyle="#cfd8dd"; ctx.fillRect(fx-6, fy-2, 12, 8);
    for (let i=0;i<4;i++){ const p=(t*1.4+i*0.25)%1; ctx.fillStyle="rgba(255,255,255,"+(0.8*(1-p)).toFixed(2)+")"; ctx.fillRect(fx-2+Math.sin(p*7+i)*6, fy-4-p*14, 3, 3); }
  }
  if (tier>=3){
    const sx=30.5*TILE, sy=(13+NORTH_EXT)*TILE;
    ctx.fillStyle="#cfc5b0"; ctx.fillRect(sx-10, sy+6, 20, 8);
    ctx.fillStyle="#e8c14e"; ctx.fillRect(sx-6, sy-14, 12, 20); ctx.fillRect(sx-9, sy-8, 3, 8); ctx.fillRect(sx+6, sy-8, 3, 8);
    ctx.fillStyle="#c9a02e"; ctx.fillRect(sx-4, sy-20, 8, 6);
    if (Math.floor(t*2)%2) drawEmojiC(ctx,"✨", sx+10, sy-18, 9);
  }
  if (S.upgrades.fleet1 && !S.upgrades.fleet2){
    const vx=22.2*TILE, vy=(3.4+NORTH_EXT)*TILE;
    ctx.fillStyle="#e8e2d2"; ctx.fillRect(vx, vy, 30, 14);
    ctx.fillStyle="#6fb7d9"; ctx.fillRect(vx+20, vy+2, 8, 6);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(vx+7,vy+15,4,0,7); ctx.arc(vx+24,vy+15,4,0,7); ctx.fill();
  }
  if (S.upgrades.fleet2){
    const lx = ((t*46)%((VCOLS+4)*TILE))-2*TILE, ly=(10+NORTH_EXT)*TILE+3;
    ctx.fillStyle="#4e7d5b"; ctx.fillRect(lx, ly, 40, 15);
    ctx.fillStyle="#e8e2d2"; ctx.fillRect(lx+40, ly+3, 14, 12);
    ctx.fillStyle="#6fb7d9"; ctx.fillRect(lx+46, ly+5, 6, 5);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(lx+9,ly+16,4,0,7); ctx.arc(lx+31,ly+16,4,0,7); ctx.arc(lx+48,ly+16,4,0,7); ctx.fill();
  }
  if (S.upgrades.fleet3){
    ctx.fillStyle="#5a4a3a"; ctx.fillRect(0, (1+NORTH_EXT)*TILE+12, VCOLS*TILE, 4);
    ctx.fillStyle="#3d332a"; for(let x=0;x<VCOLS*TILE;x+=12) ctx.fillRect(x, (1+NORTH_EXT)*TILE+10, 4, 8);
    const trx = (t*70)%((VCOLS+8)*TILE)-4*TILE;
    ctx.fillStyle="#b0574f"; ctx.fillRect(trx, (1+NORTH_EXT)*TILE, 34, 14);
    ctx.fillStyle="#6fb7d9"; ctx.fillRect(trx+4, (1+NORTH_EXT)*TILE+3, 8, 6); ctx.fillRect(trx+16, (1+NORTH_EXT)*TILE+3, 8, 6);
    ctx.fillStyle="#8a5a3c"; ctx.fillRect(trx+36, (1+NORTH_EXT)*TILE+2, 26, 12); ctx.fillRect(trx+64, (1+NORTH_EXT)*TILE+2, 26, 12);
    ctx.fillStyle="rgba(200,200,210,.5)"; ctx.beginPath(); ctx.arc(trx-4, (1+NORTH_EXT)*TILE-4, 5, 0, 7); ctx.fill();
  }
  const stock = Object.values(S.items).reduce((a,b)=>a+b,0);
  const crates = Math.min(6, Math.floor(stock/40));
  for (let i=0;i<crates;i++){
    const cx=22.1*TILE+(i%2)*11, cy=(4.2+NORTH_EXT)*TILE-Math.floor(i/2)*10;
    ctx.fillStyle=["#d9a86a","#c98a5a","#e8c94e"][i%3]; ctx.fillRect(cx, cy, 10, 9);
    ctx.strokeStyle="#8c6947"; ctx.strokeRect(cx, cy, 10, 9);
  }
  // Night wildlife: fox, owls, shark fin
  if (isNight()){
    // Fox wanders the forest at night
    const fsx=Math.round(FOX.x-CAM.x), fsy=Math.round(FOX.y-CAM.y);
    if (fsx>-20&&fsx<VIEW_W+20&&fsy>-20&&fsy<VIEW_H+20){
      const fd=FOX.facing;
      ctx.fillStyle="#c8642a"; ctx.fillRect(fsx-5,fsy-4,12,6);
      ctx.fillStyle="#c8642a"; ctx.fillRect(fsx+(fd>0?5:-9),fsy-7,5,5);
      ctx.fillStyle="#f0f0e0"; ctx.fillRect(fsx+(fd>0?8:-8),fsy-6,3,2);
      ctx.fillStyle="#1a1614"; ctx.fillRect(fsx+(fd>0?9:-7),fsy-7,2,2);
      ctx.fillStyle="#c8642a"; ctx.fillRect(fsx+(fd>0?-12:-4),fsy-2,8,3);
      ctx.fillStyle="#f0f0e0"; ctx.fillRect(fsx+(fd>0?-14:-4),fsy-2,5,2);
      ctx.fillStyle="#1a1614"; ctx.fillRect(fsx-2,fsy+2,2,4); ctx.fillRect(fsx+3,fsy+2,2,4);
    }
    // Owls perch in tree tiles at night
    for (const owl of OWLS){
      owl.blink = (owl.blink||0) + 0.02;
      const osx=Math.round(owl.x-CAM.x), osy=Math.round(owl.y-CAM.y);
      if (osx<-14||osx>VIEW_W+14||osy<-14||osy>VIEW_H+14) continue;
      ctx.fillStyle="#d0c8a0"; ctx.fillRect(osx-4,osy-6,9,10);
      ctx.fillStyle="#2a2218"; ctx.fillRect(osx-3,osy-8,3,3); ctx.fillRect(osx+3,osy-8,3,3);
      const eyeH = Math.sin(owl.blink*5)>0.96 ? 1 : 3;
      ctx.fillStyle="#f0c040"; ctx.fillRect(osx-2,osy-4,3,eyeH); ctx.fillRect(osx+1,osy-4,3,eyeH);
      ctx.fillStyle="#2a1a0a"; ctx.fillRect(osx-1,osy-3,2,1);
    }
    // Shark fin drifts offshore
    const ssx=Math.round(SHARK.x-CAM.x), ssy=Math.round(SHARK.y-CAM.y);
    if (ssx>-16&&ssx<VIEW_W+16&&ssy>-16&&ssy<VIEW_H+16){
      ctx.fillStyle="#354050";
      ctx.beginPath(); ctx.moveTo(ssx,ssy+4); ctx.lineTo(ssx+5,ssy-12); ctx.lineTo(ssx+10,ssy+4); ctx.closePath(); ctx.fill();
    }
  }
  // Harbour District dock — jetty planks + mooring posts + anchored boat
  {
    const _dockY = 36*TILE - CAM.y;
    const _dockX1 = 53*TILE - CAM.x;
    const _dockW  = 18*TILE;
    if (_dockY > -40 && _dockY < VIEW_H + 40){
      // horizontal dock planks on sand row
      ctx.fillStyle="#7a5a38";
      for(let pi=0; pi<_dockW; pi+=TILE){
        ctx.fillRect(_dockX1+pi, _dockY, TILE-2, 8);
        ctx.fillStyle="#6a4a2a"; ctx.fillRect(_dockX1+pi, _dockY, TILE-2, 2);
        ctx.fillStyle="#7a5a38";
      }
      // mooring posts
      for(const _mx of [53,57,61,65,69,71]){
        const _mpx = _mx*TILE - CAM.x;
        ctx.fillStyle="#5a3a1e"; ctx.fillRect(_mpx, _dockY-8, 5, 16);
        ctx.fillStyle="#7a5a38"; ctx.fillRect(_mpx, _dockY-10, 5, 4);
        ctx.fillStyle="#c9a060"; ctx.beginPath(); ctx.arc(_mpx+2, _dockY-10, 3, 0, Math.PI*2); ctx.fill();
      }
      // rope lines between posts
      ctx.strokeStyle="#8c6a3a"; ctx.lineWidth=1; ctx.setLineDash([3,3]);
      for(let ri=0; ri<3; ri++){
        const _rx1 = (53+ri*6)*TILE - CAM.x + 2;
        const _rx2 = (59+ri*6)*TILE - CAM.x + 2;
        ctx.beginPath(); ctx.moveTo(_rx1, _dockY-8); ctx.lineTo(_rx2, _dockY-8); ctx.stroke();
      }
      ctx.setLineDash([]);
      // small anchored dingy near boat hire
      const _bx = 62*TILE - CAM.x, _by = 37.5*TILE - CAM.y;
      if (_by > -30 && _by < VIEW_H+30){
        ctx.fillStyle="#c9a86a"; ctx.fillRect(_bx-14, _by, 28, 10);
        ctx.fillStyle="#b09050"; ctx.fillRect(_bx-12, _by+2, 24, 6);
        ctx.fillStyle="#e8d8a8"; ctx.fillRect(_bx-10, _by, 20, 3);
        ctx.fillStyle="#8c6a38"; ctx.fillRect(_bx-2, _by-12, 2, 12);
        ctx.fillStyle="#d8c890"; ctx.fillRect(_bx-10, _by-10, 10, 6);
        // bob gently
        const _bob2 = Math.sin(t*0.9)*1.5;
        ctx.fillStyle="rgba(100,180,255,.3)"; ctx.fillRect(_bx-16, _by+10+_bob2, 32, 3);
      }
    }
  }
}
function drawWorkerAndVfx(ctx, t){
  let playerTool = null;
  if (S.action && SKILL_TOOL[S.action.skill]){
    const p = stationPos(S.action.skill, S.action.id);
    if (p){
      // the tool only comes out once the character is right next to the spot (~1 block)
      const near = Math.hypot(VP.x-p.x, VP.y-p.y) < TILE*1.7;
      if (near){
        playerTool = SKILL_TOOL[S.action.skill];
        VP.facing = p.x >= VP.x ? 1 : -1;
        // activity particle effects at the station
        const sw = Math.sin(t*9);
        if (S.action.skill==="mining" && sw > 0.65){
          ctx.save();
          for(let i=0;i<4;i++){
            const ang=t*11+i*1.7, rad=6+Math.random()*6;
            ctx.fillStyle=["#c8c8cc","#e0d8c8","#a8a8b0","#f0e8c0"][i];
            ctx.fillRect(p.x+Math.cos(ang)*rad, p.y-20+Math.sin(ang)*rad*0.4, 2, 2);
          }
          ctx.restore();
        }
        if (S.action.skill==="woodcutting" && sw > 0.55){
          ctx.save();
          for(let i=0;i<3;i++){
            ctx.fillStyle=["#a06a3a","#c89060","#8a5020"][i];
            ctx.fillRect(p.x+(Math.sin(t*12+i*2.1)*8), p.y-12+(i*3), 3, 2);
          }
          ctx.restore();
        }
      }
      // (no "ghost worker" is drawn at the station when the player is away — the
      //  tool only appears on the character once they walk up to the spot.)
    }
  }
  const now = Date.now();
  for (let i=VFX.length-1; i>=0; i--){
    const f = VFX[i], age = (now-f.born)/1100;
    if (age >= 1){ VFX.splice(i,1); continue; }
    ctx.globalAlpha = 1-age;
    ctx.font="bold 11px monospace"; ctx.textAlign="center";
    ctx.fillStyle="#fff8e6"; ctx.fillText(f.txt, f.x+1, f.y-age*22+1);
    ctx.fillStyle="#2f7d4f"; ctx.fillText(f.txt, f.x, f.y-age*22);
    ctx.globalAlpha = 1;
  }
  return playerTool;
}
function drawMinimap(ctx){
  const mw = VCOLS, mh = VROWS, mx = VIEW_W-mw-8, my = 8;
  ctx.fillStyle="rgba(69,52,35,.78)"; ctx.fillRect(mx-2, my-2, mw+4, mh+4);
  const cmap = { G:"#8fc79a", P:"#dcc48f", W:"#5db3d8", T:"#3f7a4e", C:"#7d838c", D:"#a1855c", S:"#e6d49e" };
  for (let r=0;r<VROWS;r++) for (let c=0;c<VCOLS;c++){
    ctx.fillStyle = cmap[VMAP[r][c]] || "#888";
    ctx.fillRect(mx+c, my+r, 1, 1);
  }
  for (const o of V_OBJECTS){
    if (o.kind==="bld" || o.kind==="stall"){ ctx.fillStyle=o.roof||o.awn||"#888"; ctx.fillRect(mx+o.tx, my+o.ty, o.w||1, o.h||1); }
    if (o.kind==="rock"){ ctx.fillStyle=o.vein; ctx.fillRect(mx+o.tx, my+o.ty, 1, 1); }
    if (o.kind==="tree"){ ctx.fillStyle="#3a7032"; ctx.fillRect(mx+o.tx, my+o.ty, 1, 2); }
  }
  for (const v of VILLAGER_STATE){ if(!v.indoor && v.phase!=="sleep"){ ctx.fillStyle=v.shirt; ctx.fillRect(mx+Math.round(v.x/TILE), my+Math.round(v.y/TILE), 1, 1); } }
  ctx.fillStyle="#bfe8f7"; const fr=WANDERERS[0]; ctx.fillRect(mx+Math.round(fr.x/TILE)-1, my+Math.round(fr.y/TILE)-1, 2, 2);
  ctx.fillStyle="#fff"; ctx.fillRect(mx+Math.round(VP.x/TILE)-1, my+Math.round(VP.y/TILE)-1, 2, 2);
}
function drawVillage(t){
  const cv = document.getElementById("village");
  if (!cv || S.tab!=="village") return;
  const ratio = pixelScale();
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const camTX = Math.max(0, Math.min(VCOLS*TILE-VIEW_W, VP.x - VIEW_W/2));
  const camTY = Math.max(0, Math.min(VROWS*TILE-VIEW_H, VP.y - VIEW_H/2));
  CAM.x += (camTX - CAM.x) * 0.10;
  CAM.y += (camTY - CAM.y) * 0.10;
  if (Math.abs(camTX-CAM.x) < 0.5) CAM.x = camTX;
  if (Math.abs(camTY-CAM.y) < 0.5) CAM.y = camTY;
  ctx.fillStyle=SEASON_DEFS[getSeason()].grass; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.save();
  ctx.translate(-Math.round(CAM.x), -Math.round(CAM.y));
  drawTiles(ctx, t);
  drawSeasonalBillboard(ctx, t); // billboard must be behind buildings
  drawObjects(ctx, t);
  drawExtras(ctx, t);
  const nowD = Date.now();
  for (let i=DUST.length-1;i>=0;i--){
    const d = DUST[i], age = (nowD-d.born)/450;
    if (age>=1){ DUST.splice(i,1); continue; }
    ctx.fillStyle = "rgba(214,196,158,"+(0.5*(1-age)).toFixed(2)+")";
    ctx.beginPath(); ctx.arc(d.x, d.y, 2+age*4, 0, 7); ctx.fill();
  }
  const playerTool = drawWorkerAndVfx(ctx, t);
  for (const w of WANDERERS){
    drawPerson(ctx, w.x, w.y, w.hair, w.shirt, t, w.moving, w.facing, null, w.dir);
  }
  for (const v of VILLAGER_STATE){
    if (v.phase === "sleep" || v.indoor) continue;
    drawPerson(ctx, v.x, v.y, v.hair, v.shirt, t, v.moving, v.facing, null, v.dir, null, v.trouser, null, v.female);
  }
  for (const c of CHILDREN_STATE){
    if (c.phase==="sleep" || c.phase==="school") continue;
    const _csz = c.age<=6?0:c.age<=10?1:2;
    drawChild(ctx, c.x, c.y+10, c.hair, c.shirt, t, c.moving, c.dir, c.trouser, c.female, _csz);
  }
  if (VP.tx!==null && VP.tx!==undefined){
    ctx.strokeStyle="rgba(255,248,230,.8)"; ctx.lineWidth=2;
    const rad = 6+Math.sin(t*8)*2;
    ctx.beginPath(); ctx.arc(VP.tx, VP.ty, rad, 0, 7); ctx.stroke();
  }
  // bike beneath player when equipped
  if (S.bike?.equipped){
    const _bc = S.bike.color || '#e84040';
    const _bx = VP.x, _by = VP.y + 8;
    ctx.save();
    ctx.strokeStyle = _bc; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(_bx-10, _by, 7, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(_bx+10, _by, 7, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(_bx-10,_by); ctx.lineTo(_bx+1,_by-7); ctx.lineTo(_bx+10,_by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(_bx+1,_by-7); ctx.lineTo(_bx-4,_by+1); ctx.stroke();
    ctx.strokeStyle = _bc; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(_bx+10,_by-3); ctx.lineTo(_bx+14,_by-3); ctx.lineTo(_bx+14,_by-7); ctx.stroke();
    ctx.restore();
  }
  drawPerson(ctx, VP.x, VP.y, plHair(), plShirt(), t, VP.moving, VP.facing, playerTool, playerTool ? (VP.facing>=0?"right":"left") : VP.dir, plSkin(), plTrousers(), playerTool ? toolTierColor() : null, plGender()==='female', 1.0, plHat(), plHatColor(), plOpts());
  ctx.restore();
  // HTML overlay: player name tag + nearest-interactable tooltip (crisp text, no canvas blurriness)
  const overlay = document.getElementById("village-overlay");
  if (overlay){
    let html = "";
    const near = nearestInteractable();
    if (near){
      const isN = near.kind==="npc";
      const r = isN ? {x:near.w.x-12, y:near.w.y-12, w:24} : objRect(near);
      const label = isN ? ((near.w.id==="frost"?"❄️ ":"💬 ")+near.w.n) : villageTip(near);
      if (label){
        const tx = (r.x+(r.w||24)/2 - CAM.x) / VIEW_W * 100;
        const ty = (r.y - 18 - CAM.y) / VIEW_H * 100;
        if (tx > -5 && tx < 105 && ty > -5 && ty < 100)
          html += `<div class="vlbl" style="left:${tx.toFixed(1)}%;top:${ty.toFixed(1)}%">${label}</div>`;
      }
    }
    // floating name tags and speech dock for nearby outdoor villagers
    for (const v of VILLAGER_STATE){
      if (v.phase === "sleep" || v.indoor) continue;
      const vdist = Math.hypot(VP.x-v.x, VP.y-v.y);
      if (vdist < TILE){
        const nlx = (v.x - CAM.x) / VIEW_W * 100;
        const nly = (v.y - 24 - CAM.y) / VIEW_H * 100;
        html += `<div class="vlbl" style="left:${nlx.toFixed(1)}%;top:${nly.toFixed(1)}%">👤 ${v.n} ${heartsHtml(v.id,9)}</div>`;
      }
    }
    // post office daily reward badge
    if (S.dailyReward && S.dailyReward.lastDate !== new Date().toDateString()){
      const _po = V_OBJECTS.find(o => o.id==="postoffice");
      if (_po){
        const _por = objRect(_po);
        const _px = (_por.x + _por.w/2 - CAM.x) / VIEW_W * 100;
        const _py = (_por.y - 14 - CAM.y) / VIEW_H * 100;
        if (_px > -5 && _px < 105 && _py > -5 && _py < 105)
          html += `<div class="vlbl" style="left:${_px.toFixed(1)}%;top:${_py.toFixed(1)}%;background:rgba(160,30,20,.92);color:#fff">📮 Parcel!</div>`;
      }
    }
    // notice board active quest badge
    if (S.noticeBoard?.quests?.length > 0 && !S.noticeBoard.quests.every((q:any)=>q.done)){
      const _nbo = V_OBJECTS.find(o => o.id==="notice_board");
      if (_nbo){
        const _nbr = objRect(_nbo);
        const _nbpx = (_nbr.x + _nbr.w/2 - CAM.x) / VIEW_W * 100;
        const _nbpy = (_nbr.y - 14 - CAM.y) / VIEW_H * 100;
        if (_nbpx > -5 && _nbpx < 105 && _nbpy > -5 && _nbpy < 105){
          const _nbOpen = S.noticeBoard.quests.filter((q:any)=>!q.done).length;
          html += `<div class="vlbl" style="left:${_nbpx.toFixed(1)}%;top:${_nbpy.toFixed(1)}%;background:rgba(60,80,140,.92);color:#fff">📋 ${_nbOpen} quest${_nbOpen!==1?'s':''}</div>`;
        }
      }
    }
    // floating delivery request badge above the requesting villager
    if (S.deliveryReq){
      const _dReqV = VILLAGER_STATE.find(v => v.id===S.deliveryReq.npcId && !v.indoor && v.phase!=="sleep");
      if (_dReqV){
        const _dlx = (_dReqV.x - CAM.x) / VIEW_W * 100;
        const _dly = (_dReqV.y - 40 - CAM.y) / VIEW_H * 100;
        if (_dlx > -5 && _dlx < 105 && _dly > -5 && _dly < 105){
          const _tLeft = Math.max(0, Math.ceil((S.deliveryReq.expiresAt - Date.now()) / 60000));
          const _dbg = _tLeft <= 5 ? 'rgba(160,40,20,.92)' : _tLeft <= 10 ? 'rgba(160,100,20,.92)' : 'rgba(20,110,50,.92)';
          html += `<div class="vlbl" style="left:${_dlx.toFixed(1)}%;top:${_dly.toFixed(1)}%;background:${_dbg};color:#fff">📬 ${S.deliveryReq.qty}× ${ITEMS[S.deliveryReq.itemId].n} · ${_tLeft}m</div>`;
        }
      }
    }
    const dockV = VILLAGER_STATE.find(v => !v.indoor && v.phase !== "sleep" && Math.hypot(VP.x-v.x, VP.y-v.y) < TILE);
    if (dockV){
      const _isReqV = S.deliveryReq && S.deliveryReq.npcId === dockV.id;
      if (_isReqV){
        const _hasIt = itemCount(S.deliveryReq.itemId) >= S.deliveryReq.qty;
        const _btn = _hasIt ? `<button onclick="deliverReq()" style="margin-left:8px;background:#1a8a3a;color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;font-family:inherit">Deliver ✓</button>` : `<span style="color:rgba(255,255,255,.55);font-size:11px;margin-left:6px">(need ${S.deliveryReq.qty}× ${ITEMS[S.deliveryReq.itemId].n})</span>`;
        const _mLeft = Math.max(0, Math.ceil((S.deliveryReq.expiresAt - Date.now()) / 60000));
        const _urg = _mLeft <= 5 ? `<span style="color:#ff8870;margin-left:8px">⏰ ${_mLeft}m left!</span>` : `<span style="color:rgba(255,255,255,.5);margin-left:8px">${_mLeft}m left</span>`;
        html += `<div class="speech-dock"><b>${dockV.n}:</b> "Could you spare ${S.deliveryReq.qty}× ${ITEMS[S.deliveryReq.itemId].n}? I'll pay ${fmt(S.deliveryReq.reward)} coins!"${_btn}${_urg}</div>`;
      } else {
        const q = speechLine(dockV);
        const _fId = dockV.id;
        const _hHtml = heartsHtml(_fId, 10);
        const _lastChat = S.friendships?.[_fId]?.lastChat || 0;
        const _chatReady = Date.now() - _lastChat > 3*60*1000;
        const _chatSec = _chatReady ? 0 : Math.ceil((3*60*1000-(Date.now()-_lastChat))/1000);
        // Top inventory items as gift options (loved items first)
        const _loved = FRIEND_LOVES[_fId]||[];
        const _giftItems = Object.entries(S.items||{})
          .filter(([id,qty])=>(qty as number)>0 && ITEMS[id])
          .sort(([a],[b])=> (_loved.includes(a)?0:1) - (_loved.includes(b)?0:1))
          .slice(0,5);
        const _giftBtns = _giftItems.map(([id,qty])=>{
          const lov = _loved.includes(id);
          return `<button onclick="giftVillager('${_fId}','${id}')" style="background:${lov?'#5a3a7a':'#3a3a5a'};color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px" title="${lov?'Loved gift!':ITEMS[id].n}">${ITEMS[id].ic||'🎁'}${lov?'★':''}</button>`;
        }).join('');
        html += `<div class="speech-dock">
          <div style="margin-bottom:3px">${_hHtml} <b>${dockV.n}:</b> "${q}"</div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <button onclick="chatVillager('${_fId}')" style="background:${_chatReady?'#3a5a3a':'#444'};color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">${_chatReady?'💬 Chat':'💬 '+_chatSec+'s'}</button>
            ${_giftBtns.length ? `<span style="color:rgba(0,0,0,.4);font-size:9px">gift:</span>${_giftBtns}` : ''}
          </div>
        </div>`;
      }
    }
    // speech bubbles as you walk the village: villagers chat in pairs when they
    // meet, and chatter to themselves otherwise. Capped/nearest-first for legibility.
    {
      const _handled = new Set();
      const _bubble = (v, line) => {
        const bx = (v.x - CAM.x) / VIEW_W * 100;
        const by = (v.y - 34 - CAM.y) / VIEW_H * 100;
        if (bx > 2 && bx < 98 && by > 4 && by < 98) html += speechBubbleHtml(v.n, line, bx, by);
      };
      const _near = VILLAGER_STATE
        .filter(v => !v.indoor && v.phase !== "sleep" && v.quips && v !== dockV)
        .map(v => ({ v, d: Math.hypot(VP.x - v.x, VP.y - v.y) }))
        .filter(o => o.d < 9 * TILE)
        .sort((a, b) => a.d - b.d);
      // 1) two-way conversations between mutual pairs take priority
      let _convoShown = 0;
      for (const { v } of _near){
        if (_handled.has(v.id)) continue;
        const p = convoPartner(v);
        if (!p || _handled.has(p.id)) continue;
        _handled.add(v.id); _handled.add(p.id);
        if (_convoShown >= 2) continue;              // cap concurrent conversations
        _convoShown++;
        const ct = convoTurn(v, p);
        if (ct) _bubble(ct.speaker, ct.line);        // only the current speaker's bubble
      }
      // 2) ambient solo chatter for everyone else (nearest few)
      let _ambient = 0;
      for (const { v } of _near){
        if (_handled.has(v.id) || !isSpeaking(v)) continue;
        _bubble(v, speechLine(v));
        if (++_ambient >= 3) break;
      }
    }
    // district identity: a single subtle "you're in" chip, top-right only
    {
      const _cd = currentDistrict();
      if (_cd) html += `<div class="dist-chip" style="border-color:${_cd.color};color:${_cd.color}">${_cd.ic} ${_cd.name}</div>`;
    }
    html += firstRunHintHtml();   // Task 3/4: opening movement + direction guidance
    html += questMarkerHtml();    // Task 4: marker/arrow to the first Iron Rock
    if (_comboCount >= 3 && (Date.now()-_comboAt) < 3200){ html += `<div class="combo-badge">🔥 ${_comboCount} in a row!</div>`; }
    // a gentle marker so YOUR cottage is easy to pick out from the neighbours
    {
      const _ph = V_OBJECTS.find(o => o.id === "player_home");
      if (_ph){ const _r = objRect(_ph); const _px = (_r.x + _r.w/2 - CAM.x)/VIEW_W*100, _py = (_r.y - 10 - CAM.y)/VIEW_H*100;
        if (_px > 0 && _px < 100 && _py > 0 && _py < 100) html += `<div class="home-marker" style="left:${_px.toFixed(1)}%;top:${_py.toFixed(1)}%">🏡 Your Cottage</div>`;
      }
    }
    overlay.innerHTML = html;
  }
  // night/sunrise/sunset sky tint
  const alpha = nightAlpha();
  if (alpha > 0.01){
    ctx.fillStyle = `rgba(${skyTint()},${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Extra darkness over forest areas at night
    const _fExtra = Math.min(0.55, alpha * 1.6);
    ctx.save(); ctx.fillStyle = `rgba(0,5,20,${_fExtra.toFixed(3)})`;
    // North forest (VMAP rows 0-17, world y 0..18*TILE)
    const _nfy1 = Math.max(0, 0 - CAM.y), _nfy2 = Math.min(VIEW_H, 18*TILE - CAM.y);
    if (_nfy2 > _nfy1) ctx.fillRect(0, _nfy1, VIEW_W, _nfy2 - _nfy1);
    // West forest strip (rows 22-36, cols 39-47)
    const _wfy1 = Math.max(0, 22*TILE - CAM.y), _wfy2 = Math.min(VIEW_H, 36*TILE - CAM.y);
    const _wfx1 = Math.max(0, 39*TILE - CAM.x), _wfx2 = Math.min(VIEW_W, 47*TILE - CAM.x);
    if (_wfy2 > _wfy1 && _wfx2 > _wfx1) ctx.fillRect(_wfx1, _wfy1, _wfx2-_wfx1, _wfy2-_wfy1);
    // East forest strip (rows 22-36, cols 87-94)
    const _efy1 = _wfy1, _efy2 = _wfy2;
    const _efx1 = Math.max(0, 87*TILE - CAM.x), _efx2 = Math.min(VIEW_W, 95*TILE - CAM.x);
    if (_efy2 > _efy1 && _efx2 > _efx1) ctx.fillRect(_efx1, _efy1, _efx2-_efx1, _efy2-_efy1);
    ctx.restore();
  }
  if (alpha > 0.08){
    const mAlpha = Math.min(1, (alpha - 0.08) / 0.22);
    const moonX = VIEW_W - 54, moonY = 28;
    ctx.save();
    ctx.globalAlpha = mAlpha;
    ctx.fillStyle = '#fffce0';
    ctx.beginPath(); ctx.arc(moonX, moonY, 15, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(moonX+10, moonY-6, 13, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle='rgba(255,255,200,0.7)';
    [[moonX-40,moonY+12],[moonX-22,moonY-18],[VIEW_W-20,moonY+8],[moonX-60,moonY-10]].forEach(([sx,sy])=>{ ctx.fillRect(sx,sy,2,2); });
    ctx.restore();
  }
  // rain overlay (drawn after night tint so rain is visible at night)
  if (_weather.type === "rain"){
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#7090b0";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(180,215,255,0.7)";
    ctx.lineWidth = 1;
    for (let _ri=0; _ri<55; _ri++){
      const _rx = (((_ri*73 + Math.floor(t*140)) % (VIEW_W+40)) + VIEW_W+40) % (VIEW_W+40) - 20;
      const _ry = (((_ri*47 + Math.floor(t*180)) % (VIEW_H+20)) + VIEW_H+20) % (VIEW_H+20) - 10;
      ctx.beginPath(); ctx.moveTo(_rx, _ry); ctx.lineTo(_rx-2, _ry+6); ctx.stroke();
    }
    ctx.restore();
  }
  // overcast — a soft grey dimming
  if (_weather.type === "overcast"){
    ctx.save(); ctx.fillStyle = "rgba(96,102,116,0.12)"; ctx.fillRect(0,0,VIEW_W,VIEW_H); ctx.restore();
  }
  // fog — a drifting translucent haze
  if (_weather.type === "fog"){
    ctx.save();
    ctx.fillStyle = "rgba(212,216,224,0.20)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.fillStyle = "rgba(228,231,238,0.15)";
    for (let _fi=0; _fi<5; _fi++){
      const _fx = (((_fi*150 + t*9) % (VIEW_W+260)) + VIEW_W+260) % (VIEW_W+260) - 130;
      ctx.beginPath(); ctx.ellipse(_fx, VIEW_H*(0.28+_fi*0.14), 130, 34, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  // lamp glow pools drawn over the night overlay so they actually illuminate
  const glow = lampGlow();
  if (glow > 0.02){
    ctx.save();
    ctx.translate(-Math.round(CAM.x), -Math.round(CAM.y));
    for (const o of V_OBJECTS){
      if (o.kind !== "lamp") continue;
      const r = objRect(o);
      const lx = r.x + r.w/2, ly = r.y - 14;
      const rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 80);
      rg.addColorStop(0, `rgba(255,214,102,${Math.min(0.74, glow*0.74).toFixed(2)})`);
      rg.addColorStop(0.45, `rgba(255,200,80,${(glow*0.28).toFixed(2)})`);
      rg.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = rg; ctx.fillRect(lx-80, ly-80, 160, 160);
    }
    // bike light — warm radial glow around player when equipped
    if (S.bike?.equipped && S.bike?.hasLight){
      const _blrg = ctx.createRadialGradient(VP.x, VP.y, 0, VP.x, VP.y, 90);
      _blrg.addColorStop(0, `rgba(255,240,180,${Math.min(0.70, glow*0.70).toFixed(2)})`);
      _blrg.addColorStop(0.4, `rgba(255,220,140,${(glow*0.30).toFixed(2)})`);
      _blrg.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = _blrg; ctx.fillRect(VP.x-90, VP.y-90, 180, 180);
    }
    ctx.restore();
  }
  drawMinimap(ctx);
  // seasonal sky overlay — subtle tint over the whole canvas
  const _seasonNow = getSeason();
  const _sDef = SEASON_DEFS[_seasonNow];
  ctx.fillStyle = _sDef.skyOverlay;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // seasonal particles (screen-space, no camera offset)
  if (_seasonNow === "winter"){
    // snowflakes — initialise / update / draw
    while (_snowflakes.length < 48) _snowflakes.push({ x:Math.random()*VIEW_W, y:Math.random()*VIEW_H, vy:0.25+Math.random()*0.35, vx:(Math.random()-0.5)*0.25, r:0.8+Math.random()*1.2, ph:Math.random()*Math.PI*2 });
    ctx.fillStyle = "rgba(230,240,255,0.82)";
    for (const sf of _snowflakes){
      sf.y += sf.vy; sf.x += sf.vx + Math.sin(t*0.6+sf.ph)*0.18;
      if (sf.y > VIEW_H+2) { sf.y=-2; sf.x=Math.random()*VIEW_W; }
      if (sf.x < -2) sf.x=VIEW_W+2; if (sf.x > VIEW_W+2) sf.x=-2;
      ctx.beginPath(); ctx.arc(sf.x, sf.y, sf.r, 0, 7); ctx.fill();
    }
    // frost ground tint
    ctx.fillStyle="rgba(200,215,240,.10)"; ctx.fillRect(0, VIEW_H*0.55, VIEW_W, VIEW_H*0.45);
  } else { _snowflakes = []; }
  if (_seasonNow === "autumn"){
    const _leafCols = ["#c87020","#a05018","#d09028","#b06030","#8a4010"];
    while (_autumnLeaves.length < 28) _autumnLeaves.push({ x:Math.random()*VIEW_W, y:Math.random()*VIEW_H, vy:0.18+Math.random()*0.28, vx:(Math.random()-0.5)*0.4, a:Math.random()*Math.PI*2, va:(Math.random()-0.5)*0.08, col:Math.floor(Math.random()*_leafCols.length) });
    for (const lf of _autumnLeaves){
      lf.y += lf.vy; lf.x += lf.vx + Math.sin(t*0.5+lf.a)*0.22; lf.a += lf.va;
      if (lf.y > VIEW_H+4) { lf.y=-4; lf.x=Math.random()*VIEW_W; }
      ctx.save(); ctx.translate(lf.x, lf.y); ctx.rotate(lf.a);
      ctx.fillStyle=_leafCols[lf.col]; ctx.fillRect(-2,-1.5,4,3); ctx.restore();
    }
  } else { _autumnLeaves = []; }
  if (_seasonNow === "spring"){
    while (_blossomPetals.length < 20) _blossomPetals.push({ x:Math.random()*VIEW_W, y:Math.random()*VIEW_H, vy:0.12+Math.random()*0.16, vx:(Math.random()-0.5)*0.3, a:Math.random()*Math.PI*2, ph:Math.random()*Math.PI*2 });
    ctx.fillStyle="rgba(255,200,215,0.65)";
    for (const bp of _blossomPetals){
      bp.y += bp.vy; bp.x += bp.vx + Math.sin(t*0.4+bp.ph)*0.2; bp.a += 0.02;
      if (bp.y > VIEW_H+4) { bp.y=-4; bp.x=Math.random()*VIEW_W; }
      ctx.save(); ctx.translate(bp.x, bp.y); ctx.rotate(bp.a);
      ctx.beginPath(); ctx.ellipse(0,0,2,1,0,0,7); ctx.fill(); ctx.restore();
    }
  } else { _blossomPetals = []; }
  // check for season change and announce it
  if (_lastSeason && _lastSeason !== _seasonNow){
    const _ns = SEASON_DEFS[_seasonNow];
    toast(_ns.ic + " " + _ns.n + " has arrived over Featherstone!");
    log(_ns.ic + " <b>" + _ns.n + " begins.</b> " + _ns.obs[0], "good");
  }
  _lastSeason = _seasonNow;
  // scrolling news ticker at bottom of village canvas
  const _tickerMsg = S.worldEvent
    ? (()=>{ const _tev=WORLD_EVENTS.find(e=>e.id===S.worldEvent.id); return _tev ? "  📰 " + _tev.n.toUpperCase() + ": " + _tev.msg + "       " : null; })()
    : "  " + _sDef.ic + " " + _sDef.n.toUpperCase() + " — Featherstone Valley  ·  " + new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long"}) + "       ";
  if (_tickerMsg){
    _tickerX -= 0.9;
    ctx.save();
    ctx.font = "bold 10px sans-serif";
    const _tw = ctx.measureText(_tickerMsg).width;
    if (_tickerX < -_tw) _tickerX = VIEW_W;
    ctx.fillStyle = S.worldEvent ? "rgba(0,0,0,0.78)" : "rgba(20,20,40,0.70)";
    ctx.fillRect(0, VIEW_H-17, VIEW_W, 17);
    ctx.fillStyle = S.worldEvent ? "#ffe066" : _sDef.ic==="❄️"?"#c0d8ff":_sDef.ic==="🍂"?"#e8a040":_sDef.ic==="🌸"?"#ffb8c8":"#c8f090";
    ctx.textBaseline = "middle";
    ctx.fillText(_tickerMsg, _tickerX, VIEW_H-8);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
  // save-flash: brief checkmark in bottom-right corner after auto-save
  if (Date.now() < _saveFlashUntil) {
    const _fAlpha = Math.min(1, (_saveFlashUntil - Date.now()) / 400);
    ctx.save();
    ctx.globalAlpha = _fAlpha * 0.85;
    if (!drawSprite(ctx, 'icon_check', VIEW_W - 14, VIEW_H - 20, 14)) {
      ctx.fillStyle = "#4aff88"; ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText("✓", VIEW_W - 4, VIEW_H - 20);
    }
    ctx.restore();
  }
}
function updateWanderers(dt){
  const night = isNight();
  for (const w of WANDERERS){
    if (w.route && !night){
      if (w.tx===null){
        w.wait -= dt;
        if (w.wait<=0){
          w.ri = ((w.ri ?? -1)+1) % w.route.length;
          const [cx,cy] = w.route[w.ri];
          w.tx = cx*TILE; w.ty = cy*TILE;
          w.wait = (w.ri === w.benchIdx) ? 8+Math.random()*4 : 1.5+Math.random()*2;
        }
      }
      moveActor(w, dt, 27);
      continue;
    }
    if (w.tx===null){
      w.wait -= dt;
      if (w.wait<=0){
        const area = (night && w.home) ? w.home : w.area;
        const [ax,ay,bx,by] = area;
        let gx, gy, tries=0;
        do { gx=(ax+Math.random()*(bx-ax))*TILE; gy=(ay+Math.random()*(by-ay))*TILE; tries++; }
        while (solidAt(gx,gy) && tries < 15);
        if (!solidAt(gx,gy)){ w.tx=gx; w.ty=gy; }
        w.wait = night ? 4+Math.random()*6 : 2+Math.random()*4;
      }
    }
    moveActor(w, dt, night ? 20 : 30);
  }
}
function drawInterior(t){
  const cv = document.getElementById("interior");
  if (!cv) return;
  const ratio = pixelScale();
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const W = cv.width / ratio, H = cv.height / ratio;
  const active = S.action ? S.action.skill : null;
  // --- cosy room painter (Harvest-Moon-style wall band + tiled floor + exit mat) ---
  const room = (wallTop, wall, floorA, floorB, trim="#4a3524") => {
    ctx.fillStyle=wall; ctx.fillRect(0,0,W,46);
    ctx.fillStyle=wallTop; ctx.fillRect(0,0,W,9);
    ctx.fillStyle="rgba(0,0,0,.07)"; for(let x=18;x<W;x+=34) ctx.fillRect(x,9,2,35);
    ctx.fillStyle=trim; ctx.fillRect(0,43,W,4);
    for(let y=47;y<H;y+=16) for(let x=0;x<W;x+=16){ ctx.fillStyle=((x+y)>>4)%2? floorA:floorB; ctx.fillRect(x,y,16,16); }
    ctx.fillStyle="rgba(0,0,0,.10)"; ctx.fillRect(0,47,8,H-47); ctx.fillRect(W-8,47,8,H-47);
    ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(0,47,W,5);
    // wall depth — top highlight, base skirting, side skirting + corner posts
    ctx.fillStyle="rgba(255,255,255,.06)"; ctx.fillRect(0,0,W,2);
    ctx.fillStyle="rgba(0,0,0,.16)"; ctx.fillRect(0,43,W,4);
    ctx.fillStyle="rgba(0,0,0,.13)"; ctx.fillRect(6,47,4,H-51); ctx.fillRect(W-10,47,4,H-51);
    ctx.fillStyle="rgba(255,255,255,.05)"; ctx.fillRect(10,47,2,H-51); ctx.fillRect(W-12,47,2,H-51);
    ctx.fillStyle="rgba(0,0,0,.10)"; ctx.fillRect(6,43,6,7); ctx.fillRect(W-12,43,6,7);
    ctx.fillStyle="#a04a42"; ctx.fillRect(W/2-18,H-15,36,13);
    ctx.fillStyle="#c96a5a"; ctx.fillRect(W/2-15,H-13,30,9);
    ctx.fillStyle="#fff8e6"; ctx.fillRect(W/2-2,H-12,4,5);
    ctx.beginPath(); ctx.moveTo(W/2-5,H-7); ctx.lineTo(W/2+5,H-7); ctx.lineTo(W/2,H-3); ctx.closePath(); ctx.fill();
  };
  const crate = (x,y,w=16,h=14,c="#8c6947") => {
    ctx.fillStyle=c; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle="#5a3a20"; ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.fillStyle="#5a3a20"; ctx.fillRect(x+w/2-1,y,2,h); ctx.fillRect(x,y+h/2-1,w,2);
  };
  const winP = (x,w=34) => {
    ctx.fillStyle="#6a5240"; ctx.fillRect(x-2,12,w+4,26);
    ctx.fillStyle="#a8ddf0"; ctx.fillRect(x,14,w,22);
    ctx.fillStyle="rgba(255,255,255,.7)"; ctx.fillRect(x+3,16,8,7);
    ctx.fillStyle="#6a5240"; ctx.fillRect(x+w/2-1,14,2,22); ctx.fillRect(x,24,w,2);
  };
  if (S.tab==="mining"){
    // stone cave — 320×200 canvas
    ctx.fillStyle="#3a2e26"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#2e2320"; for(let i=0;i<W;i+=10) ctx.fillRect(i,0,5,(i*7)%8+3);
    // ore vein streaks near back wall
    [{c:"#aab2bd",x:15,w:3,h:26},{c:"#c97b45",x:106,w:3,h:22},{c:"#2f2f38",x:194,w:4,h:28},{c:"#7ee0ff",x:278,w:3,h:20}].forEach(v=>{
      ctx.fillStyle=v.c+"90"; ctx.fillRect(v.x,0,v.w,v.h);
    });
    // floor + mini rail track
    ctx.fillStyle="#211910"; ctx.fillRect(0,H-12,W,12);
    ctx.fillStyle="#3d3020"; ctx.fillRect(W*.36,H-12,2,12); ctx.fillRect(W*.55,H-12,2,12);
    for(let x=W*.36+3;x<W*.55;x+=6){ ctx.fillStyle="#4a3828"; ctx.fillRect(x,H-7,3,3); }
    // ceiling support beams only clip the top now (they no longer block the floor)
    [40,120,200,280].forEach(bx=>{
      ctx.fillStyle="#5a3a1e"; ctx.fillRect(bx-3,0,7,30);
      ctx.fillStyle="#7a5534"; ctx.fillRect(bx-5,28,11,4);
    });
    ctx.fillStyle="#4a3018"; ctx.fillRect(0,0,W,7);   // ceiling beam across the top
    // ore-vein rock mounds at every mining station — the "veins" you walk up to
    const _oreCols = { iron_ore:"#aab2bd", copper_ore:"#c97b45", coal:"#3a3a44", bauxite:"#e0863a", rare_earth:"#8fe6ff", diamond:"#d4f6ff" };
    STATION_DEFS.mining.forEach(st=>{
      const sx=st.fx*W, sy=st.fy*H, col=_oreCols[st.id]||"#8a8a92";
      // rocky mound
      ctx.fillStyle="#2a2320"; ctx.beginPath(); ctx.ellipse(sx, sy+9, 20, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#463a32"; ctx.beginPath(); ctx.moveTo(sx-18,sy+10); ctx.lineTo(sx-11,sy-9); ctx.lineTo(sx-2,sy-3); ctx.lineTo(sx+7,sy-11); ctx.lineTo(sx+18,sy+10); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#54463c"; ctx.beginPath(); ctx.moveTo(sx-11,sy-9); ctx.lineTo(sx-2,sy-3); ctx.lineTo(sx-6,sy+4); ctx.closePath(); ctx.fill();
      // glittering ore veins embedded in the rock
      ctx.fillStyle=col; for(let g=0;g<5;g++){ const gx=sx-10+((g*97)%20), gy=sy-6+((g*53)%13); ctx.fillRect(gx,gy,2,2); }
      if (Math.floor(t*3+sx)%3===0){ ctx.fillStyle="#ffffff"; const gy=sy-6+((Math.floor(t*2)+Math.floor(sx))%12); ctx.fillRect(sx-6+((Math.floor(t*4))%12),gy,1,1); }
    });
    // props tucked in the corners (walk-through; collision matches the two corners)
    ctx.fillStyle="#1e1814"; ctx.fillRect(4,H-40,22,26); ctx.fillRect(6,H-46,14,8);   // coal pile (bottom-left)
    [[284,H-40],[296,H-40]].forEach(([x,y],i)=>{                                        // crates (bottom-right)
      const cw=14,ch=22,c=i?"#7a5a38":"#8c6947";
      ctx.fillStyle=c; ctx.fillRect(x,y,cw,ch); ctx.strokeStyle="#5a3a20"; ctx.lineWidth=1; ctx.strokeRect(x,y,cw,ch);
    });
    // minecart on the rail (decorative, walk-through)
    ctx.fillStyle="#4a3428"; ctx.fillRect(W*.30,H-30,W*.15,H*.11);
    ctx.fillStyle="#1e1a18"; ctx.beginPath(); ctx.arc(W*.34,H-6,4,0,7); ctx.arc(W*.42,H-6,4,0,7); ctx.fill();
    // hanging lanterns for light
    for(const fx of[0.15,0.50,0.86]){
      ctx.fillStyle="rgba(255,200,80,0.16)"; ctx.beginPath(); ctx.arc(W*fx,H*.10,W*.06,0,7); ctx.fill();
      drawEmojiC(ctx,"🏮",W*fx,H*.10,10);
    }
    ctx.strokeStyle="rgba(0,0,0,.25)"; ctx.lineWidth=1;
    for(const [mx,my] of [[60,30],[140,42],[230,26],[95,54]] as [number,number][]){ ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+6,my+4); ctx.moveTo(mx+3,my-2); ctx.lineTo(mx+8,my+2); ctx.stroke(); }
    // deep-underground vignette
    const _mv = ctx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,W*0.7);
    _mv.addColorStop(0,"rgba(0,0,0,0)"); _mv.addColorStop(1,"rgba(0,0,0,0.45)");
    ctx.fillStyle=_mv; ctx.fillRect(0,0,W,H);
  } else if (S.tab==="steelworks"){
    // brick wall — 320×200 canvas
    ctx.fillStyle="#4a3f3a"; ctx.fillRect(0,0,W,H);
    for(let r=0;r<7;r++) for(let c=0;c<13;c++){ ctx.strokeStyle="#3a312d"; ctx.lineWidth=1; ctx.strokeRect(c*26+(r%2?13:0),r*16,26,16); }
    // overhead pipes
    ctx.fillStyle="#5a5050"; ctx.fillRect(0,0,W,5);
    for(const px of[55,155,215]) { ctx.fillStyle="#4a4040"; ctx.fillRect(px,5,5,24); }
    // floor
    ctx.fillStyle="#3a3030"; ctx.fillRect(0,H-10,W,10);
    ctx.fillStyle="#2e2828"; for(let x=0;x<W;x+=16) ctx.fillRect(x,H-10,2,10);
    // 2 furnaces with animated flame (stations iron_bar@x=90, steel_bar@x=205)
    for(let f=0;f<2;f++){
      const fx=42+f*170;
      ctx.fillStyle="#5a4a42"; ctx.fillRect(fx,10,38,38);
      ctx.fillStyle="#3a2e2a"; ctx.fillRect(fx+6,16,26,22);
      ctx.fillStyle="#2b2320"; ctx.beginPath(); ctx.arc(fx+19,46,12,Math.PI,0); ctx.fill(); ctx.fillRect(fx+7,46,24,10);
      const fl=0.6+0.4*Math.sin(t*9+f*2);
      ctx.fillStyle="#ff8a3c"; ctx.beginPath(); ctx.arc(fx+19,50,9*fl+2,Math.PI,0); ctx.fill();
      ctx.fillStyle="#ffd666"; ctx.beginPath(); ctx.arc(fx+19,52,4*fl+1,Math.PI,0); ctx.fill();
      ctx.fillStyle="#e05a20"; ctx.fillRect(fx+6,10,5,8); ctx.fillRect(fx+27,10,5,8);
    }
    // anvil — comes alive with glowing metal + hammer strikes while you're smithing
    ctx.fillStyle="#808898"; ctx.fillRect(201,106,26,6); ctx.fillStyle="#6a7080"; ctx.fillRect(198,112,32,8);
    ctx.fillStyle="#5a6070"; ctx.fillRect(203,120,6,7); ctx.fillRect(218,120,6,7);
    if (S.action && S.action.skill === "steelworks"){
      // a piece of hot metal rests on the anvil, glowing as it's worked (the
      // hammering itself is done by the character, who swings their own hammer)
      const glow = 0.6 + 0.4*Math.sin(t*6);
      ctx.fillStyle = `rgba(255,150,50,${(glow*0.4).toFixed(2)})`; ctx.fillRect(203,100,22,9);
      ctx.fillStyle = glow>0.85 ? "#ffd88a" : glow>0.6 ? "#ffb84a" : "#ff7a2a";
      ctx.fillRect(206,103,16,4);
    } else {
      drawEmojiC(ctx,"🔨",213,104,10);   // idle: hammer resting on the anvil
    }
    // tool rack (right)
    ctx.fillStyle="#6a4a28"; ctx.fillRect(244,103,6,29); ctx.fillStyle="#8c6947"; ctx.fillRect(240,103,14,3);
    drawEmojiC(ctx,"🔧",249,116,8); drawEmojiC(ctx,"🪛",249,126,8);
    // quench barrel — wooden staves with water on top
    ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(28,152,14,4,0,0,7); ctx.fill();
    ctx.fillStyle="#7a5230"; ctx.fillRect(16,120,26,32);
    ctx.fillStyle="#8c6947"; for(const bx of [16,25,34]) ctx.fillRect(bx,120,3,32);
    ctx.fillStyle="#4a3018"; ctx.fillRect(15,126,28,3); ctx.fillRect(15,142,28,3);
    ctx.fillStyle="#5db3d8"; ctx.beginPath(); ctx.ellipse(29,121,12,4,0,0,7); ctx.fill();
    ctx.fillStyle="#8ed0ea"; ctx.fillRect(24,119,7,2);
    // coal pile (left)
    ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(64,162,18,4,0,0,7); ctx.fill();
    ctx.fillStyle="#26221e"; ctx.beginPath(); ctx.arc(58,156,10,Math.PI,0); ctx.arc(70,156,11,Math.PI,0); ctx.fill(); ctx.fillRect(48,156,33,6);
    ctx.fillStyle="#3a342e"; ctx.fillRect(55,150,4,4); ctx.fillRect(66,148,4,4); ctx.fillRect(72,153,4,4);
    // crates (right)
    [[266,127,"#8c6947"],[266,142,"#7a5a38"]].forEach(([x,y,c])=>{
      ctx.fillStyle=c; ctx.fillRect(x,y,16,14); ctx.strokeStyle="#5a3a20"; ctx.lineWidth=1;
      ctx.strokeRect(x,y,16,14); ctx.fillStyle="#5a3a20"; ctx.fillRect(x+7,y,2,14); ctx.fillRect(x,y+6,16,2);
    });
  } else if (S.tab==="manufacturing"){
    // workshop — 320×200 canvas
    ctx.fillStyle="#55606e"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#49535f"; ctx.fillRect(0,0,W,10);
    // ceiling girders
    ctx.fillStyle="#3d4650"; for(const gx of[0,80,160,240]) ctx.fillRect(gx,0,66,5);
    ctx.fillStyle="#4a5460"; for(const gx of[0,116,233]) ctx.fillRect(gx,5,4,26);
    // floor
    ctx.fillStyle="#3d4650"; ctx.fillRect(0,H-10,W,10);
    ctx.fillStyle="#334048"; for(let x=0;x<W;x+=14) ctx.fillRect(x,H-10,2,10);
    // animated conveyor belt at y=136 (no collision — player exits through/past it)
    const off=(t*60)%14;
    ctx.fillStyle="#2f363e"; ctx.fillRect(0,136,W,14);
    ctx.fillStyle="#3d4650"; for(let x=-14;x<W;x+=14) ctx.fillRect(x+off,137,7,12);
    ctx.fillStyle="#4a5460"; ctx.fillRect(0,134,W,3); ctx.fillRect(0,149,W,3);
    for(let b=0;b<4;b++){ const bx=(b*90+t*60)%(W+60)-30; drawEmojiC(ctx,"📦",bx,143,10); }
    // 3 workbenches (station nodes sit below at y≈88-96, benches at y=32-51)
    [[33,32,43,19],[132,32,43,19],[232,32,43,19]].forEach(([x,y,w,h])=>{
      ctx.fillStyle="#5a4a36"; ctx.fillRect(x,y+h,w,4);
      ctx.fillStyle="#7a6a52"; ctx.fillRect(x,y,w,h);
      ctx.strokeStyle="#5a4a36"; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
      ctx.fillStyle="#8a7a62"; ctx.fillRect(x+3,y+3,w-6,h-6);
      ctx.fillStyle="#9a8a72"; ctx.fillRect(x+3,y+3,w-6,3);
    });
    // shelf unit (left wall)
    ctx.fillStyle="#5a4a36"; ctx.fillRect(8,88,24,33);
    for(const sy of[94,103,112,120]){ ctx.fillStyle="#7a6a52"; ctx.fillRect(9,sy,22,5); }
    drawEmojiC(ctx,"📦",20,98,8); drawEmojiC(ctx,"📦",20,109,8);
    // pallet stack (right wall)
    ctx.fillStyle="#7a6040"; ctx.fillRect(277,88,34,8);
    [[279,96,30,8,"#8c6947"],[281,104,26,8,"#d9a86a"],[283,112,22,8,"#c98a5a"]].forEach(([x,y,w,h,c])=>{
      ctx.fillStyle=c; ctx.fillRect(x,y,w,h); ctx.strokeStyle="#6a4820"; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
    });
    // machine cabinets on side walls
    [[8,29,16,44,"#4a5a6a"],[296,29,16,44,"#4a5a6a"]].forEach(([x,y,w,h,c])=>{
      ctx.fillStyle=c; ctx.fillRect(x,y,w,h);
      ctx.fillStyle="#3a4a58"; ctx.fillRect(x+2,y+2,w-4,Math.floor(h/2)-2);
      ctx.fillStyle="#5a8a9a"; ctx.fillRect(x+3,y+4,w-6,6);
      if(Math.floor(t*2)%2){ ctx.fillStyle="#ffd666"; ctx.fillRect(x+3,y+4,Math.floor((w-6)/2),3); }
    });
    // a working bench at each station with the component taking shape (+ assembly sparks)
    const _partIc = { bracket:"🧱", gearbox:"⚙️", wiring_loom:"🔌", chassis:"🛠️", sensor:"📡", servo_unit:"🤖", pallet_jack:"🛺", diamond_drill:"🛠️" };
    const _making = S.action?.skill === "manufacturing";
    STATION_DEFS.manufacturing.forEach(st=>{
      const sx = st.fx*W, sy = st.fy*H;
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(sx-20, sy+22, 40, 3);
      ctx.fillStyle="#5a4a36"; ctx.fillRect(sx-20, sy+4, 40, 6); ctx.fillRect(sx-18, sy+10, 5, 13); ctx.fillRect(sx+13, sy+10, 5, 13);
      ctx.fillStyle="#8a7a62"; ctx.fillRect(sx-20, sy-2, 40, 6);
      ctx.fillStyle="#3a4a58"; ctx.fillRect(sx-4, sy-6, 8, 5);            // vice
      drawEmojiC(ctx, _partIc[st.id]||"⚙️", sx, sy-5, 11);
      if (_making && S.action.id === st.id){
        for (let k=0;k<5;k++){ const a=-0.25-k*0.4, d=5+((k*37+Math.floor(t*90))%9); ctx.fillStyle = k%2 ? "#ffe070" : "#9ad8ff"; ctx.fillRect(Math.round(sx+Math.cos(a)*d), Math.round(sy-6-Math.sin(a)*d*0.7), 2, 2); }
      }
    });
  } else if (S.tab==="fishing"){
    // pier over sea — 320×200 canvas
    ctx.fillStyle="#4da8cc"; ctx.fillRect(0,0,W,H);
    // water shimmer
    for(let wy=4;wy<H*.50;wy+=16){
      ctx.fillStyle="rgba(255,255,255,0.22)";
      if((Math.floor(wy/16)+Math.floor(t*2))%3===0) ctx.fillRect(6+(wy*13)%38,wy,W*.16,2);
      if((Math.floor(wy/16)+Math.floor(t*1.4)+2)%4===0) ctx.fillRect(W*.55+(wy*7)%32,wy+4,W*.12,2);
    }
    // an occasional shark shadow glides down through the deep (behind the fish)
    {
      const SHARK_CYCLE = 24;                      // seconds between passes
      const sp = (t % SHARK_CYCLE) / SHARK_CYCLE;
      if (sp < 0.5){
        const syp = sp/0.5;                        // 0..1 top → surface
        const shx = W*0.5 + Math.sin(t*0.5)*W*0.16;
        const shy = -32 + syp*(H*.44 + 40);
        const wig = Math.sin(t*3)*3;
        ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = "#08222f";
        // tapered body (nose down since it swims top→down), narrowing to the tail
        ctx.beginPath();
        ctx.moveTo(shx, shy+27);
        ctx.quadraticCurveTo(shx-10, shy+6, shx-4, shy-18);
        ctx.lineTo(shx, shy-21);
        ctx.lineTo(shx+4, shy-18);
        ctx.quadraticCurveTo(shx+10, shy+6, shx, shy+27);
        ctx.closePath(); ctx.fill();
        // forked caudal (tail) fin
        ctx.beginPath(); ctx.moveTo(shx-1, shy-19); ctx.lineTo(shx-9+wig, shy-34); ctx.lineTo(shx, shy-25); ctx.lineTo(shx+9+wig, shy-34); ctx.lineTo(shx+1, shy-19); ctx.closePath(); ctx.fill();
        // dorsal fin (to the side, top-down view)
        ctx.beginPath(); ctx.moveTo(shx+6, shy-3); ctx.lineTo(shx+17, shy+3); ctx.lineTo(shx+6, shy+9); ctx.closePath(); ctx.fill();
        // pectoral fins
        ctx.beginPath(); ctx.moveTo(shx-5, shy+6); ctx.lineTo(shx-16, shy+13); ctx.lineTo(shx-4, shy+13); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(shx+5, shy+6); ctx.lineTo(shx+16, shy+13); ctx.lineTo(shx+4, shy+13); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // fish swimming below the surface — body + a flicking tail, both directions
    for(let i=0;i<7;i++){
      const dir = (i%2) ? 1 : -1;
      const speed = 13 + (i%3)*7;
      const travel = (t*speed + i*57) % (W+90);
      const fx = dir>0 ? travel-45 : W+45-travel;
      const fy = H*.08 + (i*0.13 % 1)*H*.30 + Math.sin(t*1.2+i*1.4)*4;
      const wig = Math.sin(t*6 + i)* 2;
      ctx.fillStyle = i%4===0 ? "rgba(40,70,90,.4)" : "rgba(30,60,80,.32)";
      ctx.beginPath(); ctx.ellipse(fx, fy, 6, 2.6, 0, 0, 7); ctx.fill();                 // body
      ctx.beginPath(); ctx.moveTo(fx - dir*6, fy); ctx.lineTo(fx - dir*10, fy-2.5+wig); ctx.lineTo(fx - dir*10, fy+2.5+wig); ctx.closePath(); ctx.fill();  // tail
    }
    // pier deck planks
    ctx.fillStyle="#8c6947"; ctx.fillRect(0,H*.50,W,H*.50);
    for(let px=0;px<W;px+=13){ ctx.fillStyle="#7a5a38"; ctx.fillRect(px,H*.50,2,H*.50); }
    for(let py=0;py<H*.50;py+=10){ ctx.fillStyle="#6a4a28"; ctx.fillRect(0,H*.50+py,W,2); }
    // pier railing
    ctx.fillStyle="#5a3a20"; ctx.fillRect(0,H*.44,W,5);
    for(let rx=0;rx<W;rx+=32){ ctx.fillStyle="#6a4a28"; ctx.fillRect(rx,H*.44-2,5,18); }
    // ---- fishing: a full cast → bob → nibble → bite → reel cycle ----
    const _now = (typeof performance!=="undefined"?performance.now():Date.now());
    // detect a new cast (active station changed) so the line whips out fresh
    const _fishNow = S.action?.skill==="fishing";
    if (_fishNow && S.action.id !== _fishActiveId){
      _fishActiveId = S.action.id; _fishCastT = _now;
      _fishAnchor = { x:IP.x, y:IP.y };
      if (!_fishSpot) _fishSpot = { x: W*0.5, y: H*0.20 };   // default cast if started from the panel
    }
    if (!_fishNow) _fishActiveId = null;
    const _fcAge = _now - _fishCatchT;
    const _castAge = _now - _fishCastT;
    // The bobber sits at a FIXED spot on the water; the line runs from the rod the
    // character holds (tip in _fishRodTip). Wander up to 3 blocks and it stays
    // connected; past 3 it retracts to just the rod; at 4 the line snaps.
    if (_fishNow){
      const spotX = _fishSpot ? _fishSpot.x : W*0.5;     // where the line was cast (click the water)
      const spotY = _fishSpot ? _fishSpot.y : H*.18;
      const tipX = _fishRodTip.x || spotX;
      const tipY = _fishRodTip.y || H*.30;
      const blocks = Math.hypot(IP.x - _fishAnchor.x, IP.y - _fishAnchor.y) / 30;   // how far the angler wandered from the cast
      if (blocks >= 4){
        // line snaps — a frayed end whips back to the rod, and the cast ends
        ctx.strokeStyle="rgba(255,255,255,.85)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(tipX,tipY); ctx.lineTo(tipX+3, tipY+9); ctx.stroke();
        toast("🎣 Too far — your line snapped!");
        log("🎣 You wandered too far and your line snapped.", "");
        try{ SFX.snap(); }catch(e){}
        S.action = null; renderNav();
      } else if (blocks > 3){
        // retracted — the angler just holds the rod, a short slack line dangling
        ctx.strokeStyle="rgba(245,245,245,.5)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(tipX,tipY); ctx.lineTo(tipX+2, tipY+8+Math.sin(t*3)*2); ctx.stroke();
      } else {
        const _fcAge = _now - _fishCatchT, _castAge = _now - _fishCastT;
        const CAST = 520;
        let bx, by, casting = _castAge < CAST;
        if (casting){
          const cp = _castAge / CAST;
          bx = tipX + (spotX - tipX) * cp;
          by = tipY + (spotY - tipY) * cp - Math.sin(cp*Math.PI) * 20;   // arcs out and settles
        } else {
          const wob = Math.sin(t*2.0)*2.2;
          const nibble = (Math.sin(t*0.7) > 0.85) ? Math.sin(t*20)*2.5 : 0;
          const biting = _fcAge < 260;
          bx = spotX + Math.sin(t*1.3)*2;
          by = spotY + wob + nibble + (biting ? 6 : 0);
        }
        ctx.strokeStyle = "rgba(245,245,245,.75)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tipX, tipY);
        ctx.quadraticCurveTo((tipX+bx)/2, Math.max(tipY,by)+3, bx, by); ctx.stroke();
        if (!(casting && _castAge < 60)){
          ctx.fillStyle="#dd4444"; ctx.beginPath(); ctx.arc(bx, by, 4, 0, 7); ctx.fill();
          ctx.fillStyle="#fff8e6"; ctx.beginPath(); ctx.arc(bx, by, 4, Math.PI, 0); ctx.fill();
          ctx.fillStyle="#7a1e1e"; ctx.fillRect(bx-1, by-5, 2, 2);
        }
        if (!casting){
          const rr = (t*30 % 26);
          ctx.strokeStyle = `rgba(255,255,255,${(0.35*(1-rr/26)).toFixed(2)})`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.ellipse(bx, by+3, 5+rr*0.5, 2+rr*0.2, 0, 0, 7); ctx.stroke();
        }
        if (!casting && _castAge < CAST+220){
          const sp = (_castAge-CAST)/220;
          ctx.strokeStyle=`rgba(255,255,255,${(0.7*(1-sp)).toFixed(2)})`; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(spotX, spotY+3, 4+sp*16, 0, 7); ctx.stroke();
        }
        if (_fcAge < 1000){
          const rp = _fcAge/1000;
          if (rp < 0.4){
            ctx.strokeStyle=`rgba(255,255,255,${(0.8*(1-rp/0.4)).toFixed(2)})`; ctx.lineWidth=2;
            ctx.beginPath(); ctx.arc(bx, by+2, 5+rp*22, 0, 7); ctx.stroke();
            for(let d=0;d<4;d++){ const a=-0.6+d*0.5; ctx.fillStyle="rgba(220,240,255,.7)"; ctx.fillRect(bx+Math.cos(a)*rp*18, by-Math.sin(a)*rp*20, 2, 2); }
          }
          const fx = bx + (tipX-bx)*rp, fy = by + (tipY-by)*rp;
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(t*24)*0.4 - 0.5);
          ctx.font="14px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("🐟", 0, 0);
          ctx.restore();
          if (rp>0.3){ ctx.fillStyle="rgba(180,215,240,.6)"; ctx.fillRect(fx-1, fy+6+(_fcAge%180)/22, 2, 3); }
        }
      }
    }
  } else if (S.tab==="contracts"){
    room("#6a5a44","#8a7a62","#c9beac","#bfb2a0","#5a4a34");
    winP(20);
    const stock = Math.min(18, Math.floor(Object.values(S.items).reduce((a,b)=>a+b,0)/10));
    for (let u=0;u<3;u++){
      const ux=70+u*62;
      ctx.fillStyle="#5f4f3c"; ctx.fillRect(ux,12,52,32);
      for(const sy of [22,34]){ ctx.fillStyle="#7a6a52"; ctx.fillRect(ux+2,sy,48,4); }
      for(let i=0;i<6;i++){ if (u*6+i<stock){ ctx.fillStyle=["#d9a86a","#c98a5a","#e8c94e"][i%3]; ctx.fillRect(ux+4+(i%3)*16, i<3?14:26, 14, 7); } }
    }
    ctx.fillStyle="#2c2824"; ctx.fillRect(236,52,72,62);
    ctx.fillStyle="#4e7d5b"; ctx.fillRect(242,58,60,44);
    ctx.fillStyle="#2f3e35"; ctx.fillRect(247,63,50,34);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(252,104,6,0,7); ctx.arc(292,104,6,0,7); ctx.fill();
    for(let i=0;i<9;i++){ ctx.fillStyle=i%2?"#ffd666":"#2c2824"; ctx.fillRect(236+i*8,114,8,5); }
    // lorry rear detail + clean company wall sign
    ctx.fillStyle="#3f6449"; ctx.fillRect(271,63,2,34);
    ctx.fillStyle="#2c2824"; ctx.fillRect(249,68,3,5); ctx.fillRect(249,86,3,5); ctx.fillRect(292,68,3,5); ctx.fillRect(292,86,3,5);
    ctx.fillStyle="#453423"; ctx.fillRect(234,10,76,26);
    ctx.fillStyle="#fff8e6"; ctx.fillRect(237,13,70,20);
    ctx.fillStyle="#d9a86a"; ctx.fillRect(241,17,10,12); ctx.fillStyle="#5db3d8"; ctx.fillRect(244,20,5,5);
    ctx.textAlign="left";
    // forklift — orange body, black mast, forks
    ctx.fillStyle="rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(188,142,22,4,0,0,7); ctx.fill();
    ctx.fillStyle="#2c2824"; ctx.fillRect(198,110,5,30);
    ctx.fillStyle="#8a8078"; ctx.fillRect(203,132,16,3); ctx.fillRect(203,138,16,3);
    ctx.fillStyle="#e8961e"; ctx.fillRect(172,118,26,18);
    ctx.fillStyle="#c97b20"; ctx.fillRect(172,118,26,5);
    ctx.fillStyle="#3a3230"; ctx.fillRect(176,110,14,9);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(178,140,5,0,7); ctx.arc(194,140,5,0,7); ctx.fill();
    // tall racking flush against the left wall
    ctx.fillStyle="#5a6a7a"; ctx.fillRect(12,50,6,62); ctx.fillRect(76,50,6,62);
    for(const ry of [58,80,102]){ ctx.fillStyle="#7a8a9a"; ctx.fillRect(12,ry,70,4); }
    for(let bi=0;bi<6;bi++){ ctx.fillStyle=["#d9a86a","#c98a5a","#e8c94e"][bi%3]; ctx.fillRect(18+(bi%3)*21, 47+Math.floor(bi/3)*22, 17, 11); }
    ctx.fillStyle="#7a5a3a"; ctx.fillRect(16,134,54,8); ctx.fillStyle="#8c6c48"; ctx.fillRect(16,126,54,8);
    drawEmojiC(ctx,"📋",30,122,9); drawEmojiC(ctx,"🖊️",52,122,8);
    drawPerson(ctx, 43, 120, "#4a3a2a", "#5a7a5a", t, false, IP.x >= 43 ? 1 : -1, null, "down");
    // busy warehouse worker pacing with a parcel
    const _wx = 152 + Math.sin(t*0.45)*54, _wf = Math.cos(t*0.45) >= 0 ? 1 : -1;
    drawPerson(ctx, _wx, 108, "#2a2a32", "#c9723a", t, true, _wf, null, _wf>0 ? "right" : "left");
    drawEmojiC(ctx, "📦", _wx, 88, 10);
    ctx.fillStyle="#7a6040"; ctx.fillRect(240,150,56,7);
    crate(244,136,20,14); crate(266,136,20,14,"#7a5a38"); crate(255,122,20,14,"#d9a86a");
    crate(20,144,18,16); crate(20,126,18,16,"#7a5a38");
    drawEmojiC(ctx,"🛒",84,138,13);
  } else if (S.tab==="trade"){
    room("#5a3e26","#7a5a3a","#c9a06a","#bd9560","#4a3018");
    for(let i=0;i<16;i++){ ctx.fillStyle=["#ff8a5c","#ffd666","#6fb7d9","#ff9db0"][i%4]; const bx=10+i*19; ctx.beginPath(); ctx.moveTo(bx,10); ctx.lineTo(bx+14,10); ctx.lineTo(bx+7,20); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle="#e8dcc0"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(6,10); ctx.lineTo(W-6,10); ctx.stroke();
    ctx.fillStyle="#a4643c"; ctx.fillRect(W/2-52,116,104,46);
    ctx.fillStyle="#c9855a"; ctx.fillRect(W/2-46,121,92,36);
    ctx.fillStyle="#a4643c"; ctx.fillRect(W/2-30,131,60,16);
    const AWN = { marge:"#ff8a5c", bolt:"#6fb7d9", perry:"#e8c94e", quinn:"#b48ad9" };
    const LOOKS = { marge:["#c9a24b","#7cb46b"], bolt:["#3a3a3a","#c9723a"], perry:["#7a4a2a","#4a6ea9"], quinn:["#2a2a32","#8a4a8a"] };
    NPCS.forEach((n,i)=>{
      const sx = 24 + i*74;
      const lk = LOOKS[n.id] || ["#4a3a2a","#888888"];
      const _tb = Math.sin(t*2+i)*1.2;
      const _fc = Math.abs(IP.x-(sx+28)) < 60 ? (IP.x>=sx+28?1:-1) : 1;
      drawPerson(ctx, sx+28, 60+_tb, lk[0], lk[1], t+i, false, _fc, null, "down");
      ctx.fillStyle="#8c6947"; ctx.fillRect(sx,66,56,22);
      ctx.fillStyle="#a97f52"; ctx.fillRect(sx,64,56,5);
      ctx.fillStyle=AWN[n.id]||"#ff8a5c"; ctx.fillRect(sx,57,56,8);
      ctx.fillStyle="rgba(255,255,255,.35)"; for(let k=0;k<56;k+=14) ctx.fillRect(sx+k,57,7,8);
      drawEmojiC(ctx, n.ic, sx+10, 77, 10);
      if (skillLvl("trading") < n.lvl) drawEmojiC(ctx,"🔒", sx+46, 53, 10);
    });
    for(const bx of [12,288]){ ctx.fillStyle="#7a5230"; ctx.fillRect(bx,146,20,24); ctx.fillStyle="#5a3a20"; ctx.fillRect(bx,152,20,3); ctx.fillRect(bx,161,20,3); ctx.fillStyle="#8c6947"; ctx.fillRect(bx,146,20,4); }
    drawEmojiC(ctx,"🧺", 60, 154, 13); drawEmojiC(ctx,"🍎", W-60, 154, 11);
    // a hanging set of scales over the counter + shoppers browsing (a bustling hall)
    ctx.fillStyle="#6a4a2a"; ctx.fillRect(W/2-1, 96, 2, 10); drawEmojiC(ctx,"⚖️", W/2, 108, 12);
    for(let s=0;s<2;s++){ const _ph=t*0.4 + s*2.3; const _shx = 48 + s*168 + Math.sin(_ph)*34; const _shf = Math.cos(_ph)>=0?1:-1;
      drawPerson(ctx, _shx, 150, ["#8a6a4a","#5a3a2a"][s], ["#6a8ac0","#c07a4a"][s], t+s, true, _shf, null, _shf>0?"right":"left"); }
  } else if (S.tab==="pets"){
    room("#5a3e22","#7c5a38","#caa870","#c09c62","#4a3018");
    ctx.fillStyle="#5a4228"; ctx.fillRect(0,40,W,7);
    ctx.fillStyle="#8c6c44"; ctx.fillRect(W-26,12,5,34); ctx.fillRect(W-14,12,5,34);
    for(const ly of [16,24,32,40]){ ctx.fillStyle="#8c6c44"; ctx.fillRect(W-26,ly,17,3); }
    winP(20,30);
    for(const [hx,hy,hr] of [[30,84,20],[52,94,15],[22,102,13]]){
      ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(hx,hy+hr*0.55,hr*1.1,4,0,0,7); ctx.fill();
      ctx.fillStyle="#e0c268"; ctx.beginPath(); ctx.arc(hx,hy,hr,Math.PI,0); ctx.fill(); ctx.fillRect(hx-hr,hy,hr*2,hr*0.5);
      ctx.strokeStyle="#b8923a"; ctx.lineWidth=1;
      for(let k=0;k<4;k++){ ctx.beginPath(); ctx.moveTo(hx-hr+3+k*hr*0.5, hy+hr*0.4); ctx.lineTo(hx-hr+8+k*hr*0.5, hy-hr*0.5); ctx.stroke(); }
      ctx.fillStyle="#e8d088"; ctx.fillRect(hx+hr-4, hy-hr*0.3, 5, 2); ctx.fillRect(hx-hr, hy-2, 4, 2);
    }
    ctx.fillStyle="#8c6c44"; ctx.fillRect(64,66,3,30);
    ctx.fillStyle="#a8a098"; for(const px of [60,64,68]) ctx.fillRect(px,60,2,9);
    const _bed = (bx, by, c1, c2) => {
      ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(bx, by+8, 20, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle=c1; ctx.beginPath(); ctx.ellipse(bx, by, 20, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle=c2; ctx.beginPath(); ctx.ellipse(bx, by, 13, 6, 0, 0, 7); ctx.fill();
    };
    _bed(226, 78, "#b0574f", "#d9847a");
    _bed(272, 128, "#5f7fbe", "#8aa4d9");
    ctx.fillStyle="#8a5a34"; ctx.beginPath(); ctx.ellipse(78, 150, 10, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#c9955a"; ctx.beginPath(); ctx.ellipse(78, 148, 7, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#8a5a34"; ctx.beginPath(); ctx.ellipse(102, 152, 10, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#5db3d8"; ctx.beginPath(); ctx.ellipse(102, 150, 7, 3, 0, 0, 7); ctx.fill();
    drawEmojiC(ctx,"🧶", 170, 142, 12); drawEmojiC(ctx,"🦴", 128, 160, 11);
    ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(276, 112, 10, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#a8905a"; ctx.fillRect(272, 88, 8, 24);
    ctx.fillStyle="#c9b284"; ctx.fillRect(266, 82, 20, 8);
    for(const [sx2,sy2] of [[110,158],[150,166],[236,156],[196,170]]){
      ctx.strokeStyle="#d9b968"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx2,sy2); ctx.lineTo(sx2-4,sy2-9); ctx.moveTo(sx2,sy2); ctx.lineTo(sx2,sy2-11); ctx.moveTo(sx2,sy2); ctx.lineTo(sx2+4,sy2-8); ctx.stroke();
    }
    if (!S.pets.owned.length){
      ctx.fillStyle="#e8dcc0"; ctx.fillRect(W/2-34,14,68,26); ctx.strokeStyle="#8c6947"; ctx.strokeRect(W/2-34,14,68,26);
      drawEmojiC(ctx,"❓", W/2, 27, 16);
    }
    S.pets.owned.forEach((id,i)=>{
      const p = PETS.find(x=>x.id===id); if (!p) return;
      const px = 60 + (i%5)*48 + Math.sin(t*1.1+i)*14, py = 112 + Math.floor(i/5)*32 + Math.cos(t*0.8+i*2)*8;
      const _bob = py + Math.sin(t*5+i)*2;
      if (p.id === "occy") drawOccy(ctx, px, _bob, t, 18);
      else drawEmojiC(ctx, p.ic, px, _bob, 18);
      if (S.pets.active===id) drawEmojiC(ctx,"⭐", px+10, py-12, 9);
    });
  } else if (S.tab==="foraging"){
    // Forager's hut — warm woodland cabin
    room("#3a5a2a","#4a6a34","#7a8a50","#6a7a44","#2a3a1a");
    // ceiling beam with hanging dried herbs
    ctx.fillStyle="#5a3a18"; ctx.fillRect(0, 9, W, 5);
    for(let hx=22; hx<W-18; hx+=26){
      ctx.strokeStyle="#8a6a30"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(hx, 14); ctx.lineTo(hx-3, 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx+4, 14); ctx.lineTo(hx+7, 27); ctx.stroke();
      const hc = ["#6a8a30","#7aaa40","#8a7a20","#5a9a50"][Math.floor(hx/26)%4];
      ctx.fillStyle=hc; ctx.beginPath(); ctx.ellipse(hx-2, 31, 4, 7, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx+7, 28, 3, 6, 0.3, 0, Math.PI*2); ctx.fill();
    }
    // window with forest view
    winP(220, 38);
    ctx.fillStyle="#3a5828"; ctx.fillRect(222, 14, 34, 20);
    ctx.fillStyle="#4a7a34"; ctx.fillRect(222, 16, 34, 10);
    ctx.fillStyle="#3a6028"; ctx.fillRect(222, 24, 34, 10);
    // wicker baskets with forage goods
    const _bskt = (bx:number, by:number, ic:string) => {
      ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(bx, by+15, 14, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#c9a24b"; ctx.beginPath(); ctx.ellipse(bx, by+8, 14, 9, 0, 0, Math.PI*2); ctx.fill(); ctx.fillRect(bx-14, by+8, 28, 7);
      ctx.strokeStyle="#a07830"; ctx.lineWidth=1;
      for(let k=0;k<5;k++){ ctx.beginPath(); ctx.moveTo(bx-14, by+9+k*1.4); ctx.lineTo(bx+14, by+9+k*1.4); ctx.stroke(); }
      ctx.fillStyle="#8a6230"; ctx.beginPath(); ctx.ellipse(bx, by+8, 14, 3, 0, 0, Math.PI*2); ctx.fill();
      drawEmojiC(ctx, ic, bx, by+2, 13);
    };
    _bskt(52, 104, "🍄");
    _bskt(120, 112, "🫐");
    _bskt(188, 108, "🌿");
    // mossy forage patches at each station — walk up to what's growing here
    const _foraging = S.action?.skill === "foraging";
    STATION_DEFS.foraging.forEach(st=>{
      const sx = st.fx*W, sy = st.fy*H;
      ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(sx, sy+10, 20, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#3a5a2a"; ctx.beginPath(); ctx.ellipse(sx, sy+7, 19, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#4a7a34"; ctx.beginPath(); ctx.ellipse(sx-4, sy+5, 12, 5, 0, 0, 7); ctx.fill();
      for (let g=0; g<4; g++){ ctx.fillStyle="#3aa66a"; ctx.fillRect(sx-9+g*6, sy, 1, 6); }
    });
    // pollen/spores drifting in the air — a soft flurry while you're gathering
    for (let i=0; i<(_foraging?9:4); i++){
      const _px = (i*61 + t*(_foraging?18:7)) % W, _py = 42 + ((i*43 + t*10) % (H-72));
      ctx.fillStyle = `rgba(206,232,150,${_foraging?0.5:0.24})`; ctx.beginPath(); ctx.arc(_px, _py, 1.4, 0, 7); ctx.fill();
    }
    // mossy stone left
    ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(28, 156, 16, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle="#5a6a4a"; ctx.beginPath(); ctx.ellipse(28, 148, 16, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle="#6a7a5a"; ctx.beginPath(); ctx.ellipse(28, 145, 10, 6, 0, 0, Math.PI*2); ctx.fill();
    drawEmojiC(ctx,"🪨", 28, 143, 8);
    // small table on the right with notes
    ctx.fillStyle="#7a5a30"; ctx.fillRect(248, 98, 48, 10); ctx.fillRect(252, 108, 4, 32); ctx.fillRect(288, 108, 4, 32);
    drawEmojiC(ctx,"📝", 270, 95, 10); drawEmojiC(ctx,"🌿", 290, 95, 9);
    // Wren NPC inside
    const _wnx = 156 + Math.sin(t*0.5)*14;
    drawPerson(ctx, _wnx, 80, "#3a2a1a", "#4a7a3a", t, false, IP.x >= _wnx ? 1 : -1, null, "down");
  } else if (S.tab==="bike_shop"){
    // Cycle Shop — mechanic's workshop
    room("#2a3828","#384838","#907860","#806850","#1a2818");
    // pegboard tool wall
    ctx.fillStyle="#5a4830"; ctx.fillRect(0, 9, W, 36);
    ctx.fillStyle="#3a3020";
    for(let hx=10; hx<W-6; hx+=14) for(let hy=14; hy<42; hy+=10){
      ctx.beginPath(); ctx.arc(hx, hy, 1.5, 0, Math.PI*2); ctx.fill();
    }
    for(const [ic,tx] of [["🔧",32],["🔩",68],["🔨",110],["⚙️",152],["🔧",192],["✂️",234],["🔩",274],["🔨",308]] as [string,number][]){
      drawEmojiC(ctx, ic, tx, 36, 8);
    }
    // window right
    winP(230, 34);
    // bike display rack
    const _drawBike = (bx:number, by:number, col:string) => {
      ctx.save();
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(bx,by+13,15,3,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(bx-12,by,9,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx+12,by,9,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=0.5; ctx.strokeStyle="rgba(255,255,255,.25)";
      for(let a=0;a<4;a++){
        const ag=a*Math.PI/4;
        ctx.beginPath(); ctx.moveTo(bx-12+Math.cos(ag)*9,by+Math.sin(ag)*9); ctx.lineTo(bx-12-Math.cos(ag)*9,by-Math.sin(ag)*9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx+12+Math.cos(ag)*9,by+Math.sin(ag)*9); ctx.lineTo(bx+12-Math.cos(ag)*9,by-Math.sin(ag)*9); ctx.stroke();
      }
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(bx-12,by); ctx.lineTo(bx+1,by-10); ctx.lineTo(bx+12,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+1,by-10); ctx.lineTo(bx-4,by+1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+12,by-4); ctx.lineTo(bx+16,by-4); ctx.lineTo(bx+16,by-9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx-2,by-12); ctx.lineTo(bx+3,by-12); ctx.stroke();
      ctx.restore();
    };
    _drawBike(72, 80, S.bike?.color || '#e84040');
    _drawBike(168, 84, '#4070c0');
    _drawBike(252, 78, '#3a8a3a');
    // workbench left
    ctx.fillStyle="#7a5a30"; ctx.fillRect(0,118,110,8); ctx.fillRect(0,126,8,42);
    ctx.fillStyle="#8a6a40"; ctx.fillRect(2,115,106,5);
    drawEmojiC(ctx,"🔧",28,112,9); drawEmojiC(ctx,"⚙️",58,112,9); drawEmojiC(ctx,"🔩",86,112,9);
    // condition gauge on workbench
    const _cond = Math.round(S.bike?.condition ?? 100);
    ctx.fillStyle="#2a2a1a"; ctx.fillRect(108,126,60,8);
    ctx.fillStyle = _cond>60?"#4aff88":_cond>30?"#ffd666":"#ff6a6a";
    ctx.fillRect(108,126,Math.round(60*_cond/100),8);
    ctx.fillStyle="rgba(255,255,255,.5)"; ctx.font="7px monospace"; ctx.textAlign="center"; ctx.fillText(_cond+"%",138,134); ctx.textAlign="left";
    // parts shelf right
    ctx.fillStyle="#7a5a30";
    for(const sy of [100,120,140]) ctx.fillRect(200,sy,116,5);
    drawEmojiC(ctx,"🛞",218,116,10); drawEmojiC(ctx,"🛞",244,116,10); drawEmojiC(ctx,"⚙️",270,116,10); drawEmojiC(ctx,"🔩",294,116,10);
    drawEmojiC(ctx,"🪣",212,136,8); drawEmojiC(ctx,"🔦",240,136,8); drawEmojiC(ctx,"💡",268,136,8); drawEmojiC(ctx,"🪛",296,136,8);
    // mechanic NPC
    const _mx = 130 + Math.sin(t*0.4)*10;
    drawPerson(ctx, _mx, 84, "#4a3820", "#3a4a8a", t, false, IP.x >= _mx ? 1 : -1, null, "down");
  } else if (S.tab==="notice_board"){
    // Community Hall — warm wood panels, large pinboard across back wall
    room("#3a2a1a","#5a3a28","#c0a070","#b09060","#2a1810");
    // pinboard spanning back wall
    ctx.fillStyle="#7a5a38"; ctx.fillRect(16,10,W-32,34);
    ctx.fillStyle="#c9a86a"; ctx.fillRect(18,12,W-36,30);
    // pinned papers across the board
    const _pprs:number[][] = [[22,14,54,22],[86,15,52,20],[148,14,58,24],[216,16,50,20],[274,13,26,22],[22,38,40,12],[76,37,52,14],[140,36,58,16],[210,38,46,12],[268,37,28,12]];
    for(const [px,py,pw,ph] of _pprs){
      ctx.fillStyle="#fffae0"; ctx.fillRect(px,py,pw,ph);
      ctx.fillStyle="#c9c9a0";
      for(let li=3;li<ph-2;li+=4) ctx.fillRect(px+3,py+li,pw-6,1);
      ctx.fillStyle="#e04040"; ctx.beginPath(); ctx.arc(px+pw/2,py,2,0,7); ctx.fill();
    }
    // window right
    winP(240, 34);
    // title plaque
    ctx.fillStyle="#5a3a1e"; ctx.fillRect(W/2-36,9,72,5);
    drawEmojiC(ctx,"📋",W/2,H*0.19,13);
    // bench left
    ctx.fillStyle="#7a5a38"; ctx.fillRect(20,112,90,8); ctx.fillRect(20,120,10,36); ctx.fillRect(100,120,10,36);
    // bench right
    ctx.fillStyle="#7a5a38"; ctx.fillRect(210,112,90,8); ctx.fillRect(210,120,10,36); ctx.fillRect(290,120,10,36);
    // corner plants
    drawEmojiC(ctx,"🪴",12,110,14); drawEmojiC(ctx,"🪴",W-12,110,14);
    // central table
    ctx.fillStyle="#8c6947"; ctx.fillRect(W/2-44,132,88,8); ctx.fillRect(W/2-44,140,8,28); ctx.fillRect(W/2+36,140,8,28);
    drawEmojiC(ctx,"📝",W/2-18,138,10); drawEmojiC(ctx,"☕",W/2+6,138,10); drawEmojiC(ctx,"📌",W/2-6,133,8);
    // warden NPC near board
    const _nbwx = 158 + Math.sin(t*0.3)*8;
    drawPerson(ctx, _nbwx, 88, "#3a3a4a", "#6a3a3a", t, true, IP.x >= _nbwx ? 1 : -1, null, "down");
  } else if (S.tab==="harbour_office"){
    // Harbourmaster's Office — dark navy walls, nautical charts
    room("#1a2830","#2a3848","#906840","#806030","#0a1820");
    // porthole window left
    ctx.fillStyle="#4a5a6a"; ctx.beginPath(); ctx.arc(42,28,18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#7ab8d8"; ctx.beginPath(); ctx.arc(42,28,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(38,24,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#3a4a5a"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(42,28,14,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle="#4a5a6a"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(42,14); ctx.lineTo(42,42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28,28); ctx.lineTo(56,28); ctx.stroke();
    // anchor on wall
    drawEmojiC(ctx,"⚓",W-36,28,16);
    // chart table
    ctx.fillStyle="#6a4828"; ctx.fillRect(W/2-48,88,96,10); ctx.fillRect(W/2-50,85,100,5);
    ctx.fillStyle="#fffae0"; ctx.fillRect(W/2-44,65,88,22);
    ctx.fillStyle="#a8b8c8"; for(let gx=0;gx<88;gx+=10) ctx.fillRect(W/2-44+gx,65,1,22);
    for(let gy=0;gy<22;gy+=7) ctx.fillRect(W/2-44,65+gy,88,1);
    ctx.fillStyle="#e84040"; ctx.fillRect(W/2+10,72,3,3); ctx.beginPath(); ctx.arc(W/2+11,71,6,0,Math.PI*2); ctx.stroke();
    drawEmojiC(ctx,"🗺️",W/2,75,10);
    // table legs
    ctx.fillStyle="#5a3820"; ctx.fillRect(W/2-50,98,8,50); ctx.fillRect(W/2+42,98,8,50);
    // rope coils
    drawEmojiC(ctx,"🪝",W/2-70,108,14); drawEmojiC(ctx,"🪢",W/2+60,108,14);
    // life preserver on wall
    drawEmojiC(ctx,"🛟",W-32,80,16);
    // reg NPC at chart table
    const _hwx = W/2-24 + Math.sin(t*0.25)*6;
    drawPerson(ctx, _hwx, 80, "#3a2a1a", "#2a4a6a", t, false, IP.x >= _hwx ? 1 : -1, null, "down");
  } else if (S.tab==="boat_hire"){
    // Boat Hire shack — weathered timber, sandy floor
    room("#4a3820","#6a5030","#c0a060","#b09050","#2a1808");
    // weather boards on back wall
    ctx.fillStyle="#5a3a18"; for(let bx=0;bx<W;bx+=22) ctx.fillRect(bx,9,2,38);
    // single round window
    ctx.fillStyle="#4a5a4a"; ctx.beginPath(); ctx.arc(W/2,26,16,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#8ad0b0"; ctx.beginPath(); ctx.arc(W/2,26,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(W/2-3,22,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#4a5a4a"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(W/2,26,12,0,Math.PI*2); ctx.stroke();
    // hire counter
    ctx.fillStyle="#8c6947"; ctx.fillRect(60,100,200,10); ctx.fillRect(56,96,208,6);
    ctx.fillStyle="#a07850"; ctx.fillRect(60,101,200,8);
    // hanging life preservers
    drawEmojiC(ctx,"🛟",30,56,14); drawEmojiC(ctx,"🛟",W-30,56,14);
    // oars stacked against wall
    ctx.fillStyle="#6a4828"; ctx.fillRect(14,50,4,110); ctx.fillRect(20,50,4,110);
    ctx.fillStyle="#8c6a40"; ctx.fillRect(12,50,8,12); ctx.fillRect(18,50,8,12);
    // price board
    ctx.fillStyle="#3a2010"; ctx.fillRect(W/2-48,56,96,32);
    ctx.fillStyle="#c9a86a"; ctx.fillRect(W/2-46,58,92,28);
    ctx.fillStyle="#3a2010";
    fitText(ctx, "BOAT HIRE",       W/2, 63, 84, 9, { weight:"bold" });
    fitText(ctx, "10 coins / trip", W/2, 76, 84, 7);
    // fishing nets on right
    drawEmojiC(ctx,"🪣",W-30,100,12); drawEmojiC(ctx,"🎣",W-52,100,12);
    // harbour keeper silhouette (no NPC inside — self-service)
    drawEmojiC(ctx,"⛵",W/2+50,85,18);
  } else if (S.tab==="fishmonger_wh"){
    // Fish Warehouse — cool industrial blue-grey, crates and ice
    room("#182828","#203038","#708080","#608070","#0a1818");
    // industrial ceiling pipes
    ctx.fillStyle="#2a3838"; ctx.fillRect(0,0,W,6);
    for(const px of [60,140,210]) { ctx.fillStyle="#2a3838"; ctx.fillRect(px,6,5,20); }
    // hanging lanterns (cold blue light)
    for(const lx of [60,140,210]){
      ctx.fillStyle="rgba(100,200,255,0.12)"; ctx.beginPath(); ctx.arc(lx,20,22,0,Math.PI*2); ctx.fill();
      drawEmojiC(ctx,"💡",lx,18,9);
    }
    // fish crate racks
    const _crate2 = (x,y,w=28,h=18) => {
      ctx.fillStyle="#4a6860"; ctx.fillRect(x,y,w,h);
      ctx.strokeStyle="#2a3838"; ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
      ctx.fillStyle="#2a3838"; ctx.fillRect(x+w/2-1,y,2,h); ctx.fillRect(x,y+h/2-1,w,2);
      ctx.fillStyle="rgba(180,230,255,.25)"; ctx.fillRect(x+2,y+2,w-4,4);
    };
    [[20,60],[54,60],[88,60],[20,84],[54,84],[88,84],[160,60],[194,60],[228,60],[160,84],[194,84],[228,84]].forEach(([x,y])=>_crate2(x,y));
    // ice bins
    ctx.fillStyle="#6ab8d8"; for(let ix=20;ix<260;ix+=22) { ctx.fillStyle="#5aA8c8"; ctx.fillRect(ix,108,18,10); ctx.fillStyle="rgba(255,255,255,.4)"; ctx.fillRect(ix+2,108,6,4); }
    // weighing scale in center
    ctx.fillStyle="#4a4a5a"; ctx.fillRect(W/2-10,116,20,6); ctx.fillRect(W/2-14,120,28,4);
    drawEmojiC(ctx,"⚖️",W/2,122,10);
    // fish emoji scattered on crates
    for(const [fx,fy,em] of [[32,66,"🐟"],[66,66,"🍣"],[100,66,"🐠"],[172,66,"🐋"],[206,66,"🐟"],[240,66,"🍣"]]){
      drawEmojiC(ctx,em,fx,fy,8);
    }
    // pearl NPC
    const _fwx = 150 + Math.sin(t*0.35)*10;
    drawPerson(ctx, _fwx, 100, "#c9a060", "#3a7a5a", t, true, IP.x >= _fwx ? 1 : -1, null, "down");
  } else if (S.tab==="crafting"){
    // artisan shed — warm amber walls, central workbench, herb bundles, clay oven
    room("#5a4020","#7a5a30","#c9a878","#b89868","#3a2a10");
    winP(50, 36); winP(220, 36);
    // hanging herb bundles from ceiling beam
    ctx.fillStyle="#5a3a10"; ctx.fillRect(0, 9, W, 5);
    for(const [hx, hem] of [[30,"🌿"],[68,"🫐"],[108,"🌿"],[148,"🌿"],[186,"🫐"],[224,"🌿"],[262,"🌿"],[300,"🌿"]]){
      ctx.fillStyle="#6a4a20"; ctx.fillRect(hx+3, 14, 2, 8);
      drawEmojiC(ctx, hem, hx+4, 27, 9);
    }
    // clay oven (right side — smoke fish station area)
    ctx.fillStyle="#7a5a40"; ctx.fillRect(246, 52, 52, 42);
    ctx.fillStyle="#5a3a20"; ctx.fillRect(248, 54, 48, 32);
    ctx.fillStyle="#1a1010"; ctx.fillRect(256, 62, 32, 18);
    const _glow = 0.25 + Math.abs(Math.sin(t*1.5))*0.25;
    ctx.fillStyle=`rgba(255,120,30,${_glow})`; ctx.fillRect(258, 64, 28, 14);
    drawEmojiC(ctx,"🔥", 272, 70, 11);
    ctx.fillStyle="#4a3028"; ctx.fillRect(250, 86, 44, 6);
    // central workbench
    ctx.fillStyle="#5a3a18"; ctx.fillRect(70, 80, 180, 12);
    ctx.fillStyle="#7a5028"; ctx.fillRect(70, 68, 180, 14);
    ctx.fillStyle="#6a4020"; ctx.fillRect(72, 82, 2, 24); ctx.fillRect(246, 82, 2, 24);
    ctx.fillRect(98, 82, 2, 24); ctx.fillRect(220, 82, 2, 24);
    // items on workbench
    for(const [ix, em] of [[88,"🫙"],[140,"🍵"],[192,"🥣"]]){
      drawEmojiC(ctx, em, ix, 62, 11);
    }
    // jars shelf (left wall)
    ctx.fillStyle="#6a4a28"; ctx.fillRect(12, 52, 44, 6); ctx.fillRect(12, 78, 44, 6);
    for(const [jx, jy, jc] of [[16,42,"🫙"],[28,42,"🍵"],[40,42,"🥣"],[16,68,"🫙"],[28,68,"🫙"],[40,68,"🍵"]]){
      drawEmojiC(ctx, jc, jx, jy, 9);
    }
    // gift basket on floor (right corner)
    drawEmojiC(ctx,"🧺", 296, 130, 16);
    // crafting feedback: steam wisps + a sparkle rise from the workbench while you make things
    const _crafting = S.action?.skill === "crafting";
    if (_crafting){
      for (let i=0;i<7;i++){ const ph=(t*22 + i*13) % 24; const _wx = 88+(i%3)*52 + Math.sin(t*2+i)*3, _wy = 60 - ph; ctx.fillStyle=`rgba(242,240,230,${(0.42*(1-ph/24)).toFixed(2)})`; ctx.beginPath(); ctx.arc(_wx, _wy, 2, 0, 7); ctx.fill(); }
      if (Math.floor(t*4)%2===0){ for (const ix of [88,140,192]){ ctx.fillStyle="rgba(255,240,150,.8)"; ctx.fillRect(Math.round(ix+Math.sin(t*5+ix)*6), 54, 2, 2); } }
    }
    // warm dust motes drifting in the light (ambient)
    for (let i=0;i<4;i++){ const _dx=(i*71 + t*6) % W, _dy = 30 + ((i*47 + t*8) % (H-70)); ctx.fillStyle="rgba(255,220,150,.18)"; ctx.fillRect(_dx, _dy, 1.5, 1.5); }
    // artisan NPC (moves slowly left/right near workbench)
    const _ax = 160 + Math.sin(t*0.4)*30;
    drawPerson(ctx, _ax, 60, "#7a5040", "#c9804a", t, false, Math.sin(t*0.4)>0 ? 1:-1, null, "down");
  } else if (S.tab==="village_fund"){
    // Village Fund committee room — round table, plans, framed projects, warm and civic
    room("#3a4a2a","#506040","#c8b888","#bca878","#2a3a1a");
    winP(W*0.06, 36); winP(W*0.70, 36);
    // round committee table with plans
    ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(W/2, H*0.56, 62, 18, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#7a5030"; ctx.beginPath(); ctx.ellipse(W/2, H*0.52, 60, 17, 0, 0, 7); ctx.fill();
    ctx.fillStyle="#9a6840"; ctx.beginPath(); ctx.ellipse(W/2, H*0.50, 58, 15, 0, 0, 7); ctx.fill();
    // papers / village plans on the table
    ctx.fillStyle="#e8e0c0"; ctx.fillRect(W/2-24, H*0.44, 30, 20); ctx.fillStyle="#c8c0a0"; ctx.fillRect(W/2-22, H*0.46, 26, 16);
    ctx.fillStyle="#4a8a4a"; ctx.fillRect(W/2-20, H*0.48, 22, 2); ctx.fillRect(W/2-20, H*0.51, 16, 2); ctx.fillRect(W/2-20, H*0.54, 18, 2);
    ctx.fillStyle="#e0d8b8"; ctx.fillRect(W/2+2, H*0.45, 22, 16); ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(W/2+4, H*0.47, 18, 12);
    // chairs around table
    for(const [chx,chy,rot] of [[W/2-74,H*0.50,0],[W/2+74,H*0.50,0],[W/2-30,H*0.70,0],[W/2+30,H*0.70,0],[W/2,H*0.28,0]]){
      ctx.fillStyle="#5a3a1e"; ctx.fillRect(chx-8, chy-6, 16, 12);
      ctx.fillStyle="#3a2010"; ctx.fillRect(chx-6, chy+6, 12, 6);
    }
    // framed completed project pictures on walls
    const _frames = [[28,14,"🌸"],[68,14,"🌲"],[108,14,"🏮"],[196,14,"🦋"],[236,14,"⛲"],[276,14,"🕰️"]];
    _frames.forEach(([fx,fy,em], fi)=>{
      const _done = (S.beautification||[]).length > fi;
      ctx.fillStyle="#6a4a28"; ctx.fillRect(fx-2, fy-2, 22, 20);
      ctx.fillStyle=_done?"#e8e0c8":"#2a2a2a"; ctx.fillRect(fx, fy, 18, 16);
      if (_done) drawEmojiC(ctx, em, fx+9, fy+8, 11);
      else { ctx.fillStyle="rgba(255,255,255,.08)"; ctx.fillRect(fx+2,fy+2,14,12); }
    });
    // prestige score on wall plaque
    const _pv = villagePrestige();
    ctx.fillStyle="#c9a030"; ctx.fillRect(W/2-28, 12, 56, 20);
    ctx.fillStyle="#7a5010"; ctx.fillRect(W/2-26, 14, 52, 16);
    ctx.fillStyle="#ffd060"; ctx.font="7px monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(`✨ ${_pv} / 209`, W/2, 22);
    // committee member NPCs (two, wandering slowly)
    const _cm1x = 90 + Math.sin(t*0.3)*15, _cm2x = 230 + Math.sin(t*0.4+1)*12;
    drawPerson(ctx, _cm1x, H*0.38, "#5a3a2a", "#3a5a7a", t, false, Math.sin(t*0.3)>0?1:-1, null, "down");
    drawPerson(ctx, _cm2x, H*0.38, "#4a5a3a", "#7a4a3a", t, true,  Math.sin(t*0.4)>0?1:-1, null, "down");
  } else if (S.tab==="lore_stone"){
    // mossy forest clearing — ancient boundary stone
    ctx.fillStyle="#1a2e1a"; ctx.fillRect(0,0,W,H);
    // canopy gradient at top
    for(let i=0;i<32;i++){ ctx.fillStyle=`rgba(20,60,20,${(1-i/32)*0.8})`; ctx.fillRect(0,i*2,W,2); }
    // forest floor — dark moss patches
    ctx.fillStyle="#1e3a1e"; ctx.fillRect(0,H*0.52,W,H*0.48);
    for(let x=0;x<W;x+=22){ ctx.fillStyle=x%44?"#243a22":"#2a4428"; ctx.fillRect(x,H*0.54,(x%44?18:16),H*0.46); }
    // scattered moss clumps
    for(const [mx,my] of [[28,H*0.62],[80,H*0.74],[140,H*0.58],[200,H*0.68],[260,H*0.60],[290,H*0.78]]){
      ctx.fillStyle="#2e5a28"; ctx.beginPath(); ctx.ellipse(mx, my, 14, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#3a7a30"; ctx.beginPath(); ctx.ellipse(mx, my-2, 10, 4, 0, 0, 7); ctx.fill();
    }
    // tree trunks left and right (darker forest edge)
    for(const [tx2,tw] of [[4,18],[W-22,18],[W*0.08|0,12],[W*0.88|0,12]]){
      ctx.fillStyle="#0e1e0e"; ctx.fillRect(tx2, 0, tw, H);
      ctx.fillStyle="#162616"; ctx.fillRect(tx2, 0, 4, H);
    }
    // ambient green glow from canopy
    ctx.fillStyle="rgba(30,100,30,.12)"; ctx.fillRect(0,0,W,H*0.5);
    // ancient stone — large grey monolith centre
    const _sy = H*0.28, _sh = H*0.46, _sw = 52;
    const _sx = W/2 - _sw/2;
    // soft stone glow (magical ambient)
    const _glowR = 0.18 + Math.abs(Math.sin(t*0.4))*0.08;
    ctx.fillStyle=`rgba(160,200,160,${_glowR})`; ctx.beginPath(); ctx.ellipse(W/2, _sy+_sh*0.6, _sw+28, _sh*0.5, 0, 0, 7); ctx.fill();
    // stone body
    ctx.fillStyle="#6a7a6a"; ctx.fillRect(_sx, _sy, _sw, _sh);
    ctx.fillStyle="#7a8a7a"; ctx.fillRect(_sx+2, _sy+2, _sw-4, 6);
    ctx.fillStyle="#5a6a5a"; ctx.fillRect(_sx, _sy, 4, _sh); ctx.fillRect(_sx+_sw-4, _sy, 4, _sh);
    // rune marks — pixel scratches
    ctx.fillStyle="rgba(180,220,180,.55)";
    for(const [rx,ry,rw,rh] of [
      [_sx+10, _sy+14, 8,  2], [_sx+10, _sy+18, 8,  2], [_sx+14, _sy+14, 2,  6],
      [_sx+26, _sy+12, 2,  10],[_sx+22, _sy+16, 8,  2],
      [_sx+38, _sy+14, 6,  2], [_sx+38, _sy+20, 6,  2], [_sx+38, _sy+14, 2,  8],
      [_sx+12, _sy+30, 10, 2], [_sx+28, _sy+28, 2,  8], [_sx+24, _sy+28, 8,  2], [_sx+24, _sy+36, 8,  2],
    ]){ ctx.fillRect(rx, ry, rw, rh); }
    // lichen patches
    ctx.fillStyle="rgba(140,180,100,.3)"; ctx.beginPath(); ctx.ellipse(_sx+8, _sy+_sh*0.65, 10, 5, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle="rgba(100,160,80,.25)"; ctx.beginPath(); ctx.ellipse(_sx+_sw-6, _sy+_sh*0.45, 8, 4, 0.4, 0, 7); ctx.fill();
    // ground shadow beneath stone
    ctx.fillStyle="rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(W/2, _sy+_sh+4, _sw*0.7, 7, 0, 0, 7); ctx.fill();
    // small wildflowers
    for(const [fx,fy,fc] of [[60,H*0.72,"#ffeeaa"],[90,H*0.80,"#ffaacc"],[220,H*0.76,"#aaffcc"],[250,H*0.70,"#ffeeaa"]]){
      ctx.fillStyle="#2a5a1a"; ctx.fillRect(fx, fy-8, 2, 10);
      ctx.fillStyle=fc; ctx.beginPath(); ctx.arc(fx+1, fy-8, 4, 0, 7); ctx.fill();
    }
    // fox (wanders slowly) or owl at night
    if (isNight()){
      const _ox = 70 + Math.sin(t*0.2)*8;
      drawEmojiC(ctx,"🦉", _ox, H*0.42, 14);
    } else {
      const _fx = 72 + Math.sin(t*0.3)*20;
      ctx.fillStyle="#b06a30"; ctx.fillRect(_fx, H*0.66, 18, 8);
      ctx.fillStyle="#8a4a20"; ctx.fillRect(_fx+14, H*0.66, 6, 5);
      ctx.fillStyle="#c07a40"; ctx.fillRect(_fx, H*0.64, 8, 4);
      ctx.fillStyle="#1a1a1a"; ctx.fillRect(_fx+16, H*0.65, 2, 2);
    }
  } else if (S.tab==="woodcutting"){
    room("#3f5330","#4f6339","#b08c58","#a68050","#324226");
    // timber-planked back wall
    ctx.fillStyle="#6a5238"; for(let px=0;px<W;px+=26) ctx.fillRect(px,7,24,32);
    ctx.fillStyle="rgba(0,0,0,.10)"; for(let px=0;px<W;px+=26) ctx.fillRect(px+24,7,2,32);
    // sunny window with a forest view + a soft sunbeam onto the floor
    ctx.fillStyle="#2e4a24"; ctx.fillRect(214,10,40,24); ctx.fillStyle="#3f6a30"; ctx.fillRect(214,12,40,12); ctx.fillStyle="#54863c"; for(const _tx of [220,232,244]){ ctx.beginPath(); ctx.moveTo(_tx,26); ctx.lineTo(_tx+5,14); ctx.lineTo(_tx+10,26); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle="#7a5a38"; ctx.lineWidth=2; ctx.strokeRect(214,10,40,24); ctx.beginPath(); ctx.moveTo(234,10); ctx.lineTo(234,34); ctx.moveTo(214,22); ctx.lineTo(254,22); ctx.stroke();
    ctx.fillStyle="rgba(255,240,180,.10)"; ctx.beginPath(); ctx.moveTo(214,34); ctx.lineTo(254,34); ctx.lineTo(240,H-12); ctx.lineTo(180,H-12); ctx.closePath(); ctx.fill();
    // big circular saw bench, centre-back
    ctx.fillStyle="#6a5240"; ctx.fillRect(120,70,80,10); ctx.fillStyle="#7c6450"; ctx.fillRect(120,62,80,10);
    ctx.fillStyle="#3a3a40"; ctx.fillRect(150,50,20,14);                       // motor housing
    const _cutting = S.action?.skill === "woodcutting";
    const _spin = t * (_cutting ? 9 : 2.5);
    ctx.fillStyle="#c8ccd2"; ctx.beginPath(); ctx.arc(138,62,13,0,7); ctx.fill();
    ctx.fillStyle="#9aa0a8"; for(let a=0;a<12;a++){ const ang=a/12*6.283 + _spin; ctx.fillRect(138+Math.cos(ang)*13-1, 62+Math.sin(ang)*13-1, 3,3); }
    ctx.fillStyle="#6a7078"; ctx.beginPath(); ctx.arc(138,62,4,0,7); ctx.fill();
    // log piles at each cutting station, in that timber's colour
    const _woodCols = { pine:["#e2c288","#caa262"], oak:["#bb8c4c","#98723c"], hardwood:["#7c5432","#5e3e22"] };
    STATION_DEFS.woodcutting.forEach(st=>{
      const sx = st.fx*W, sy = st.fy*H, cols = _woodCols[st.id] || ["#c9a05a","#a87c42"];
      const _log = (lx,ly)=>{ ctx.fillStyle=cols[1]; ctx.fillRect(lx,ly,22,7); ctx.fillStyle=cols[0]; ctx.beginPath(); ctx.arc(lx+22,ly+3.5,4,0,7); ctx.fill(); ctx.fillStyle="#5a3a20"; ctx.beginPath(); ctx.arc(lx+22,ly+3.5,2,0,7); ctx.fill(); };
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(sx, sy+16, 20, 4, 0, 0, 7); ctx.fill();
      _log(sx-12, sy+8); _log(sx-6, sy+1); _log(sx-12, sy-6);
    });
    // stack of finished planks (bottom-left)
    ctx.fillStyle="#c9a05a"; for(let p=0;p<4;p++){ ctx.fillRect(12+p, 150-p*5, 46, 4); }
    // wood-wares goods shelf (top-right)
    ctx.fillStyle="#5a4228"; ctx.fillRect(268,10,44,34);
    ctx.fillStyle="#6e5234"; for(const _sy of [20,33]) ctx.fillRect(270,_sy,40,3);
    drawEmojiC(ctx,"🪑", 280, 16, 11); drawEmojiC(ctx,"🥣", 300, 16, 9); drawEmojiC(ctx,"🧺", 290, 30, 10);
    // sawdust motes drifting in the light — a flurry of chips while you're cutting
    for(let i=0;i<(_cutting?12:4);i++){
      const _dx = (i*53 + (_cutting?t*40:t*8)) % W, _dy = 60 + ((i*37 + t*14) % (H-80));
      ctx.fillStyle = `rgba(224,196,140,${_cutting?0.5:0.28})`; ctx.fillRect(_dx, _dy, 2, 2);
    }
  } else if (S.tab==="upgrades"){
    room("#4e5a68","#6c7c8c","#cfc8b8","#c3bcac","#3e4a56");
    winP(18,34);
    ctx.fillStyle="#8c6947"; ctx.fillRect(W-124,12,104,30); ctx.fillStyle="#d9cdb0"; ctx.fillRect(W-121,15,98,24);
    const owned = Object.keys(S.upgrades).length;
    for (let i=0;i<Math.min(owned,8);i++){ ctx.fillStyle=["#ffffff","#ffe9c9","#e6f4ff"][i%3]; ctx.fillRect(W-117+(i%4)*24, 17+Math.floor(i/4)*11, 19, 9); ctx.fillStyle="#e05d5d"; ctx.fillRect(W-109+(i%4)*24, 16, 3, 3); }
    // podium with speaker — the visitors' hall
    ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(160,84,22,4,0,0,7); ctx.fill();
    ctx.fillStyle="#6a5240"; ctx.fillRect(144,62,32,22);
    ctx.fillStyle="#7c6450"; ctx.fillRect(141,58,38,6);
    ctx.fillStyle="#e8c14e"; ctx.fillRect(156,66,8,6);
    drawPerson(ctx, 160, 56, "#8a8a8a", "#b0574f", t, false, 1, null, "down");
    // 10 brown chairs in two rows, all facing the podium
    for (let row=0; row<2; row++) for (let ci=0; ci<5; ci++){
      const chx = 78 + ci*34, chy = 104 + row*30;
      ctx.fillStyle="rgba(0,0,0,.10)"; ctx.fillRect(chx+1, chy+13, 14, 3);
      ctx.fillStyle="#8a5a34"; ctx.fillRect(chx, chy, 16, 12);
      ctx.fillStyle="#6a4225"; ctx.fillRect(chx, chy+9, 16, 5);
      ctx.fillStyle="#5a3a20"; ctx.fillRect(chx+1, chy+14, 3, 4); ctx.fillRect(chx+12, chy+14, 3, 4);
    }
    ctx.fillStyle="#5a6a7a"; ctx.fillRect(16,60,22,42); ctx.fillStyle="#48586a"; for(const cy of [66,80,92]) ctx.fillRect(18,cy,18,8);
    drawEmojiC(ctx,"💼", 188, 82, 10);
    // a civic banner behind the podium
    ctx.fillStyle="#3a5a8a"; ctx.fillRect(120,40,80,10); ctx.fillStyle="#ffd666"; fitText(ctx,"FEATHERSTONE TOWN HALL",160,45,74,5,{weight:"bold",baseline:"middle"});
    // a couple of attendees seated in the audience
    drawPerson(ctx, 78+34+8,  104+2, "#6a4a2a", "#5a7a9a", t, false, 1,  null, "up");
    drawPerson(ctx, 78+3*34+8, 134+2, "#8a6a4a", "#9a5a4a", t, false, -1, null, "up");
    const _bigPlant = (px, py) => {
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(px, py+14, 11, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle="#b06a42"; ctx.fillRect(px-8, py, 16, 13);
      ctx.fillStyle="#c97b50"; ctx.fillRect(px-10, py-3, 20, 4);
      ctx.fillStyle="#2f8a52"; ctx.beginPath(); ctx.arc(px, py-12, 10, 0, 7); ctx.fill();
      ctx.fillStyle="#3aa66a"; ctx.beginPath(); ctx.arc(px-6, py-17, 7, 0, 7); ctx.arc(px+6, py-16, 7, 0, 7); ctx.fill();
      ctx.fillStyle="#4dbf7e"; ctx.beginPath(); ctx.arc(px, py-21, 6, 0, 7); ctx.fill();
    };
    _bigPlant(292, 88); _bigPlant(52, 92);
    drawEmojiC(ctx,"🕐", 60, 27, 12);
  } else if (S.tab==="ach"){
    room("#3e2430","#5a3644","#e8e2d2","#dcd6c6","#c9a02e");
    ctx.fillStyle="#c9a02e"; ctx.fillRect(0,41,W,3);
    for(let i=0;i<6;i++){ ctx.fillStyle=i%2?"#c9a02e":"#e8e2d2"; const px=30+i*52; ctx.beginPath(); ctx.moveTo(px,10); ctx.lineTo(px+16,10); ctx.lineTo(px+8,26); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle="#c9a02e"; ctx.beginPath(); ctx.arc(W/2,24,13,0,7); ctx.fill();
    ctx.fillStyle="#5a3644"; ctx.beginPath(); ctx.arc(W/2,24,10,0,7); ctx.fill();
    drawEmojiC(ctx,"🏆", W/2, 24, 13);
    ctx.fillStyle="#c9a02e"; ctx.fillRect(W/2-24,47,48,H-61);
    ctx.fillStyle="#9e2b33"; ctx.fillRect(W/2-20,47,40,H-61);
    ctx.fillStyle="#7d1f27"; for(let cy=54;cy<H-18;cy+=14) ctx.fillRect(W/2-20,cy,40,2);
    for(const rx of [W/2-34, W/2+34]){
      for(const ry of [66,106,146]){
        ctx.fillStyle="#c9a02e"; ctx.fillRect(rx-2,ry,4,16); ctx.beginPath(); ctx.arc(rx,ry,3,0,7); ctx.fill();
      }
      ctx.strokeStyle="#9e2b33"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(rx,68); ctx.quadraticCurveTo(rx,86,rx,108); ctx.quadraticCurveTo(rx,126,rx,148); ctx.stroke();
    }
    const _got = ACH.filter(a=>S.ach && S.ach[a.id]);
    const _spots = [[46,80],[112,80],[208,80],[274,80],[46,132],[112,132],[208,132],[274,132]];
    _spots.forEach(([px,py],i)=>{
      ctx.fillStyle="rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(px,py+16,14,3,0,0,7); ctx.fill();
      ctx.fillStyle="#f2eee2"; ctx.fillRect(px-11,py,22,14);
      ctx.fillStyle="#cfc8b8"; ctx.fillRect(px-13,py+12,26,4);
      ctx.fillStyle="#fff"; ctx.fillRect(px-11,py,22,3);
      if (_got[i]){
        drawEmojiC(ctx, _got[i].ic, px, py-9, 15);
        if (Math.floor(t*2+i)%3===0) drawEmojiC(ctx,"✨", px+11, py-16, 8);
      } else {
        ctx.fillStyle="rgba(69,52,35,.25)"; ctx.beginPath(); ctx.arc(px,py-8,7,0,7); ctx.fill();
      }
    });
  }
  if (S.tab==="home"){
    const _v = VILLAGERS.find(v => v.homeId === S.roomObjId);
    const _theme = HOME_INTERIORS[S.roomObjId] || DEFAULT_THEME;
    const _pal = _theme.pal;
    const _L = buildLayout(_theme, S.roomObjId, W, H);
    room(_pal.wallTop, _pal.wall, _pal.floorA, _pal.floorB, _pal.trim);
    winP(_L.windows[0], 30); winP(_L.windows[1], 30);
    const _bConf = BED_CONFIG[S.roomObjId] || {d:0,k:0};
    // Duvet accent color per home
    const _cov = ({
      home_01:"#c8a0c0",home_02:"#8a9ab0",home_03:"#e0c870",home_04:"#7aaa70",
      home_05:"#c0a8c8",home_06:"#8a7050",home_07:"#7aaa78",home_08:"#6a7898",
      home_09:"#9ab8c8",home_10:"#b06a60",home_11:"#8ab0c8",home_12:"#c0c080",
      home_13:"#e0b8c0",home_14:"#7aaa68",home_15:"#7ab8c8",home_16:"#8898a8",
      home_17:"#88b0a0",
    } as Record<string,string>)[S.roomObjId] || "#c0b090";
    // Zone floor patches — kitchen tiles, living rug, bedroom rug (drawn under furniture)
    for (const _f of _L.floors){
      ctx.save(); ctx.globalAlpha=_f.a; ctx.fillStyle=_f.c;
      ctx.fillRect(_f.x,_f.y,_f.w,_f.h); ctx.restore();
      if (_f.border){ ctx.save(); ctx.globalAlpha=Math.min(1,_f.a+0.22); ctx.strokeStyle=_f.c;
        ctx.lineWidth=1.5; ctx.strokeRect(_f.x+3,_f.y+3,_f.w-6,_f.h-6); ctx.restore(); }
    }
    // Main bed — top-right corner
    const _bW = _bConf.d ? 72 : 50;
    const _bX = W - _bW - 10, _bY = 50;
    ctx.fillStyle="#6a4020"; ctx.fillRect(_bX,_bY,_bW,46);
    ctx.fillStyle="#8c5a30"; ctx.fillRect(_bX,_bY,_bW,14);       // headboard
    ctx.fillStyle="#7a4820"; ctx.fillRect(_bX+2,_bY+2,_bW-4,10);
    ctx.fillStyle="#6a4020"; ctx.fillRect(_bX,_bY+42,_bW,4);     // footboard
    ctx.fillStyle=_cov; ctx.fillRect(_bX+2,_bY+14,_bW-4,28);    // duvet
    ctx.fillStyle="#f4f0e8";
    if (_bConf.d){ ctx.fillRect(_bX+4,_bY+15,28,9); ctx.fillRect(_bX+_bW/2+2,_bY+15,28,9); }
    else { ctx.fillRect(_bX+4,_bY+15,_bW-8,9); }
    ctx.fillStyle="rgba(0,0,0,.08)"; ctx.fillRect(_bX+2,_bY+27,_bW-4,2);
    // Children's beds — below main bed, stacked left
    for(let ci=0;ci<_bConf.k;ci++){
      const _cbX = W - (ci+1)*46 - 10, _cbY = _bY + 52;
      if (_cbX < 0) break;
      ctx.fillStyle="#8a6a40"; ctx.fillRect(_cbX,_cbY,40,28);
      ctx.fillStyle="#9a7a50"; ctx.fillRect(_cbX,_cbY,40,9);
      ctx.fillStyle="#6a4a28"; ctx.fillRect(_cbX,_cbY+24,40,4);
      ctx.fillStyle=(["#c0d8e0","#e0c8d8","#d8e8c0"] as string[])[ci%3];
      ctx.fillRect(_cbX+2,_cbY+9,36,15);
      ctx.fillStyle="#f4f0e8"; ctx.fillRect(_cbX+4,_cbY+9,32,6);
    }
    // Household furniture & props (zone-based floorplan — see data/homeInteriors.ts)
    const _sc = 2, _tsz = 16*_sc;
    const _ft = (col,row,x,y,tw=1,th=1,fbCol="#8a6a4a") => {
      if (!drawFurnitureTile(ctx, col, row, Math.round(x), Math.round(y), _sc, tw, th)){
        ctx.fillStyle=fbCol; ctx.fillRect(Math.round(x),Math.round(y),_tsz*tw,_tsz*th);
      }
    };
    for (const _p of _L.placements){
      _homeProp(ctx, _p.k, _p.x, _p.y, W, H, t, _ft, _pal);
    }
    // --- NPC daily routine (time-of-day activity) ---
    _homeVilLbl = null; _homeAwayName = null;
    if (_v){
      const _nHr=gameHour();
      if (_nHr>=22||_nHr<7){
        // sleeping — head(s) peek above the duvet line
        const _drawHead=(hx:number,hy:number,hc:string,fem2:boolean)=>{
          ctx.fillStyle="#f2c49a"; ctx.beginPath(); ctx.arc(hx,hy,6,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=hc; ctx.fillRect(hx-5,hy-10,10,5);
          if(fem2){ctx.fillRect(hx-8,hy-6,3,10);}
        };
        _drawHead(_bX+10,_bY+10,_v.hair||"#6a4a2f",_v.female||false);
        if(_bConf.d){
          const _p2=VILLAGERS.find(v2=>v2.n.toLowerCase()===(_v.partner||"").toLowerCase());
          _drawHead(_bX+_bW/2+6,_bY+10,_p2?.hair||"#c9a24b",_p2?.female||false);
        }
        ctx.globalAlpha=0.35+Math.sin(t*1.4)*0.25;
        ctx.fillStyle="#5a4a8a"; ctx.font="bold 8px monospace";
        ctx.fillText("Zzz",_bX+(_bConf.d?Math.round(_bW*0.6):18)+6,_bY-4);
        ctx.globalAlpha=1;
      } else if ((_nHr>=9.5&&_nHr<12)||(_nHr>=13.5&&_nHr<18.5)){
        // at work — a pinned note on the table; the crisp, legible text is drawn as
        // an HTML overlay (set _homeAwayName), not tiny canvas text.
        ctx.fillStyle="#f4e8c8"; ctx.fillRect(W/2-26,H-54,52,30);
        ctx.strokeStyle="#8a6a40"; ctx.lineWidth=0.8; ctx.strokeRect(W/2-26,H-54,52,30);
        drawEmojiC(ctx,"📌",W/2+24,H-56,8);
        _homeAwayName = _v.n;
      } else {
        // awake at home → wander between rooms doing chores
        const _wp = [[66,96],[54,128],[158,165],[112,150],[Math.max(22,_bX-16),112]];
        if (!_homeVil || _homeVil.roomId !== S.roomObjId)
          _homeVil = { roomId:S.roomObjId, x:112, y:150, tx:112, ty:150, moving:false, facing:1, pauseT:0 };
        const _dx=_homeVil.tx-_homeVil.x, _dy=_homeVil.ty-_homeVil.y, _dd=Math.hypot(_dx,_dy)||1;
        if (_dd < 3){
          if (!_homeVil.pauseT) _homeVil.pauseT = Date.now() + 1500 + Math.random()*2800;
          if (Date.now() > _homeVil.pauseT){ const _n=_wp[Math.floor(Math.random()*_wp.length)]; _homeVil.tx=_n[0]; _homeVil.ty=_n[1]; _homeVil.pauseT=0; }
          _homeVil.moving=false;
        } else {
          _homeVil.x+=_dx/_dd*1.1; _homeVil.y+=_dy/_dd*1.1; _homeVil.moving=true; _homeVil.facing=_dx>=0?1:-1;
        }
        drawPerson(ctx,Math.round(_homeVil.x),Math.round(_homeVil.y),_v.hair,_v.shirt,t,_homeVil.moving,_homeVil.facing,null,"down",null,_v.trouser,null,_v.female||false);
        if (!_homeVil.moving){
          const _em = Math.hypot(_homeVil.x-66,_homeVil.y-96)<20?"☕":Math.hypot(_homeVil.x-54,_homeVil.y-128)<20?"🍽️":Math.hypot(_homeVil.x-158,_homeVil.y-165)<26?"📺":"✨";
          drawEmojiC(ctx,_em,_homeVil.x+11,_homeVil.y-14,11);
        }
        _homeVilLbl = { x:_homeVil.x, y:_homeVil.y, name:_v.n };
      }
    }
  }
  if (S.tab==="school"){
    // school interior — two classrooms split by centre wall
    room("#e8f0d0","#e0e8c8","#d8deb8","#ccd4ac","#5a7a3a");
    winP(W*0.05, 34); winP(W*0.39, 34); // left room windows
    winP(W*0.55, 34); winP(W*0.88, 34); // right room windows
    // centre dividing wall
    ctx.fillStyle="#c8b898"; ctx.fillRect(W/2-4,0,8,H);
    ctx.fillStyle="#b0a078"; ctx.fillRect(W/2-5,0,2,H); ctx.fillRect(W/2+3,0,2,H);
    // --- Classroom A (left half, older children) ---
    ctx.fillStyle="#2a4a2a"; ctx.fillRect(W*0.02,8,W*0.44,24);
    ctx.fillStyle="#3a6a3a"; ctx.fillRect(W*0.03,10,W*0.42,20);
    // crisp chalk marks — pixel rectangles, no fillText to avoid canvas blur
    { const _bxA=W*0.03|0; ctx.fillStyle="rgba(255,255,255,.72)";
      let _cx=_bxA+5;
      for(let k=0;k<4;k++){ctx.fillRect(_cx,18,6,2);_cx+=9;} ctx.fillRect(_cx,18,3,3);_cx+=7;
      for(let k=0;k<3;k++){ctx.fillRect(_cx,18,6,2);_cx+=9;} ctx.fillRect(_cx,18,3,3);_cx+=7;
      for(let k=0;k<4;k++){ctx.fillRect(_cx,18,6,2);_cx+=9;}
    }
    ctx.fillStyle="#7a5a30"; ctx.fillRect(W*0.06,36,W*0.16,8); // teacher desk A
    drawPerson(ctx, W*0.14, H*0.30, "#5a3a2a", "#7a6a9a", t, false, 1, null, "down", null, "#4a4a5a", null, true); // teacher A
    const DA=[[W*0.06,H*0.58],[W*0.17,H*0.58],[W*0.27,H*0.58],[W*0.06,H*0.76],[W*0.17,H*0.76],[W*0.27,H*0.76]];
    DA.forEach(([dx,dy])=>{ ctx.fillStyle="#9a7a4a"; ctx.fillRect(dx,dy,18,10); ctx.fillStyle="#7a5a30"; ctx.fillRect(dx,dy+10,18,3); });
    // --- Classroom B (right half, younger children) ---
    ctx.fillStyle="#2a4a2a"; ctx.fillRect(W*0.54,8,W*0.44,24);
    ctx.fillStyle="#3a6a3a"; ctx.fillRect(W*0.55,10,W*0.42,20);
    { const _bxB=W*0.55|0; ctx.fillStyle="rgba(255,255,255,.72)";
      let _dx=_bxB+5;
      for(let k=0;k<4;k++){ctx.fillRect(_dx,18,6,2);_dx+=9;} ctx.fillRect(_dx,18,3,3);_dx+=7;
      for(let k=0;k<2;k++){ctx.fillRect(_dx,18,6,2);_dx+=9;} ctx.fillRect(_dx,18,3,3);_dx+=7;
      for(let k=0;k<5;k++){ctx.fillRect(_dx,18,6,2);_dx+=9;}
    }
    ctx.fillStyle="#7a5a30"; ctx.fillRect(W*0.56,36,W*0.16,8); // teacher desk B
    drawPerson(ctx, W*0.64, H*0.30, "#4a5a6a", "#4a8a7a", t, false, 1, null, "down", null, "#3a4a3a", null, false); // teacher B
    const DB=[[W*0.57,H*0.58],[W*0.67,H*0.58],[W*0.77,H*0.58],[W*0.57,H*0.76],[W*0.67,H*0.76],[W*0.77,H*0.76]];
    DB.forEach(([dx,dy])=>{ ctx.fillStyle="#9a7a4a"; ctx.fillRect(dx,dy,18,10); ctx.fillStyle="#7a5a30"; ctx.fillRect(dx,dy+10,18,3); });
    // draw school children at desks
    const _sc=CHILDREN_STATE.filter(c=>c.phase==="school");
    _sc.filter(c=>c.age>=8).slice(0,6).forEach((c,i)=>{ if(i<DA.length) drawChild(ctx,DA[i][0]+9,DA[i][1],c.hair,c.shirt,t,false,"down",c.trouser,c.female,c.age>=12?2:1); });
    _sc.filter(c=>c.age<8).slice(0,6).forEach((c,i)=>{ if(i<DB.length) drawChild(ctx,DB[i][0]+9,DB[i][1],c.hair,c.shirt,t,false,"down",c.trouser,c.female,0); });
    // occasional chalk dust
    if(Math.floor(t*3)%7===0){ ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fillRect(W*0.20+Math.sin(t*7)*4,12,2,2); ctx.fillRect(W*0.18,14,2,2); }
    if(Math.floor(t*3)%11===0){ ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fillRect(W*0.70+Math.sin(t*5)*4,12,2,2); ctx.fillRect(W*0.68,14,2,2); }
  }
  if (S.tab==="cafe"){
    // Village Café interior — warm coffee shop aesthetic
    room("#5a3820","#8a5a30","#c8a878","#bca070","#3a2010");
    winP(W*0.10, 34); winP(W*0.58, 34);
    // back counter
    ctx.fillStyle="#4a2c10"; ctx.fillRect(18,48,W-36,24);
    ctx.fillStyle="#7a4a22"; ctx.fillRect(20,50,W-40,10);
    ctx.fillStyle="#c8a060"; ctx.fillRect(20,50,W-40,3); // counter highlight
    // coffee machine
    ctx.fillStyle="#282828"; ctx.fillRect(W/2-24,30,24,22);
    ctx.fillStyle="#3a3a3a"; ctx.fillRect(W/2-22,32,20,12);
    ctx.fillStyle="#c8c8c8"; ctx.fillRect(W/2-16,44,8,6);
    ctx.fillStyle="#9a3818"; ctx.beginPath(); ctx.arc(W/2-12,37,5,0,7); ctx.fill();
    ctx.fillStyle="#7a2a10"; ctx.beginPath(); ctx.arc(W/2-12,37,3,0,7); ctx.fill();
    ctx.fillStyle="#282828"; ctx.fillRect(W/2+2,36,9,16); // grinder box
    ctx.fillStyle="#444"; ctx.fillRect(W/2+4,38,5,10);
    drawEmojiC(ctx,"☕", W/2+20, 50, 10);
    // barista (female, dark hair, red apron)
    drawPerson(ctx, W/2-10, 42, "#2a1a0a", "#c05030", t, false, 1, null, "down", null, "#2a1850", null, true);
    // menu board top-right
    ctx.fillStyle="#2a1408"; ctx.fillRect(W*0.70,6,W*0.27,34);
    ctx.fillStyle="#f0e4c4"; ctx.fillRect(W*0.71,7,W*0.25,32);
    { const _mx=W*0.72|0;
      ctx.fillStyle="#5a3020"; ctx.fillRect(_mx,12,32,2); ctx.fillRect(_mx,17,24,2); ctx.fillRect(_mx,22,30,2); ctx.fillRect(_mx,27,18,2);
    }
    drawEmojiC(ctx,"☕", W*0.94, 20, 9);
    // 3 small café tables
    const _cafeTbls = [[W*0.14,H*0.62],[W*0.43,H*0.64],[W*0.14,H*0.82]];
    for(const [cx,cy] of _cafeTbls){
      ctx.fillStyle="rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(cx,cy+11,17,5,0,0,7); ctx.fill();
      ctx.fillStyle="#6a4020"; ctx.beginPath(); ctx.ellipse(cx,cy,17,9,0,0,7); ctx.fill();
      ctx.fillStyle="#8a5a30"; ctx.beginPath(); ctx.ellipse(cx,cy,15,7,0,0,7); ctx.fill();
      ctx.fillStyle="#5a3010"; ctx.fillRect(cx-1,cy+9,2,12);
      // four stools around table
      for(const [ox,oy] of [[-22,0],[22,0],[0,-15],[0,15]]){
        ctx.fillStyle="rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(cx+ox,cy+oy+8,6,2,0,0,7); ctx.fill();
        ctx.fillStyle="#7a4a20"; ctx.fillRect(cx+ox-5,cy+oy-5,10,9);
        ctx.fillStyle="#6a3a14"; ctx.fillRect(cx+ox-2,cy+oy+4,4,6);
      }
    }
    // coffee aroma wisps
    for(let _w=0;_w<3;_w++){
      const _wa = ((t*0.8+_w*0.4) % 1);
      ctx.fillStyle="rgba(120,80,40,"+(0.3*(1-_wa)).toFixed(2)+")";
      const _wx = W/2-16+_w*6, _wy = 30-_wa*12+Math.sin(t*2+_w)*2;
      ctx.beginPath(); ctx.arc(_wx,_wy,2,0,7); ctx.fill();
    }
    // potted plant right of door
    ctx.fillStyle="#6a4020"; ctx.fillRect(W-26,H-44,14,18);
    ctx.fillStyle="#3a8a2a"; ctx.beginPath(); ctx.arc(W-19,H-46,10,0,7); ctx.fill();
    ctx.fillStyle="#4ab040"; ctx.beginPath(); ctx.arc(W-25,H-51,7,0,7); ctx.arc(W-13,H-51,7,0,7); ctx.fill();
  }
  if (S.tab==="myhome"){
    const _ht = S.homeTier||0;
    room("#6a5a3a","#8a7050","#d4c8a0","#c8bc90","#4a3020");
    winP(W*0.12, 34); winP(W*0.62, 34);
    // _ft: draw furniture tile (col,row) at dest (x,y) scaled 2×; falls back to canvas rect
    const _sc = 2, _tsz = 16 * _sc; // 32px per tile at scale 2
    const _ft = (col, row, x, y, tw=1, th=1, fbCol="#8a6a4a") => {
      if (!drawFurnitureTile(ctx, col, row, x, y, _sc, tw, th)) {
        ctx.fillStyle = fbCol; ctx.fillRect(x, y, _tsz*tw, _tsz*th);
      }
    };
    // T0+: bed — top-right corner (2×2 tiles = 64×64px)
    // roguelikeIndoor: single bed is at col 0, row 0 (2×2 block)
    _ft(0, 0, W-70, 50, 2, 2, "#7a5030");
    // T1+: bookshelf (left wall), oval rug + table (floor centre)
    if (_ht >= 1){
      // bookshelf: col 8, row 2 (1 wide, 2 tall) = 32×64px
      _ft(8, 2, 8, 50, 1, 2, "#6a4228");
      // oval rug: col 0, row 7 (3 wide, 2 tall) = 96×64px — centre floor
      _ft(0, 7, W/2-48, H-74, 3, 2, "#b07848");
      // table: col 4, row 0 (2×2) above rug
      _ft(4, 0, W/2-32, H-100, 2, 2, "#7a5030");
    }
    // T2+: sofa (right) + fireplace (left wall)
    if (_ht >= 2){
      // fireplace: col 22, row 0 (2×2) on left wall below shelf
      _ft(22, 0, 8, 116, 2, 2, "#4a3020");
      // sofa: col 0, row 4 (3 wide, 1 tall) right side floor
      _ft(0, 4, W-100, H-56, 3, 1, "#7a5a60");
    }
    // T3+: wall art (back wall) + cabinet (left of shelf)
    if (_ht >= 3){
      // painting on back wall: col 16, row 0 (3 wide, 1 tall)
      _ft(16, 0, W/2-24, 10, 3, 1, "#5a3a20");
      // cabinet: col 12, row 0 (1 wide, 2 tall)
      _ft(12, 0, 44, 50, 1, 2, "#6a4228");
    }
    // T4+: piano + potted plant + decorative floor border
    if (_ht >= 4){
      // piano: canvas rect (unique, no tilesheet equivalent)
      ctx.fillStyle="#282828"; ctx.fillRect(64,50,48,36); ctx.fillStyle="#f0f0f0"; ctx.fillRect(66,64,44,10);
      for(let ki=0;ki<10;ki++) { ctx.fillStyle=ki%3===2?"#282828":"#fff"; ctx.fillRect(67+ki*4+(ki>4?2:0),64,3,8); }
      // potted plant: col 14, row 0 (1×2)
      _ft(14, 0, W/2+28, 48, 1, 2, "#3a8a2a");
      // decorative border strip
      ctx.fillStyle="rgba(160,120,50,.18)"; ctx.fillRect(0,H-48,W,2); ctx.fillRect(0,H-50,W,2);
    }
    // bonus sprites if player owns legacy furniture items
    if (S.items && S.items["fancy_rug"] > 0) _ft(3, 7, W/2-48, H-40, 3, 2, "#c06830");
    if (S.items && S.items["lamp"]      > 0) _ft(20, 1, W-38, H-68, 1, 1, "#c09830");
    if (S.items && S.items["bookcase"]  > 0) _ft(8,  4, 8, 116, 1, 2, "#5a3a20");
    if (S.items && S.items["painting"]  > 0 && _ht < 3) _ft(16, 0, W/2-24, 10, 3, 1, "#5a3a20");
    if (S.items && S.items["vase"]      > 0) _ft(18, 0, W/2+8, 10, 1, 1, "#9a8060");
    // placed furniture from the furniture system
    for (const _pf of (S.placedFurniture||[])){
      const _fd = FURNITURE_DEFS[_pf.id];
      const _sp = FURN_SPOTS[_pf.slot];
      if (!_fd || !_sp) continue;
      ctx.fillStyle = _fd.col + "cc"; ctx.fillRect(_sp.px, _sp.py, _fd.w, _fd.h);
      ctx.strokeStyle="rgba(0,0,0,.18)"; ctx.lineWidth=1; ctx.strokeRect(_sp.px, _sp.py, _fd.w, _fd.h);
      drawEmojiC(ctx, _fd.ic, _sp.px + _fd.w/2, _sp.py + _fd.h/2, 14);
    }
  }
  if (S.tab==="bank"){
    // Village Bank interior — marble-effect, clean columns
    room("#6a6050","#9a9080","#e0dcd0","#d8d4c8","#4a3828");
    winP(W*0.08, 38); winP(W*0.60, 38);
    // marble floor tone on top of room floor
    ctx.fillStyle="rgba(255,255,255,.08)"; for(let fy=47;fy<H;fy+=32) ctx.fillRect(0,fy,W,16);
    // two classical columns
    for(const cx of [W*0.22|0, W*0.74|0]){
      ctx.fillStyle="#c8c4b8"; ctx.fillRect(cx-6,9,12,H-22);
      ctx.fillStyle="#e0dcd0"; ctx.fillRect(cx-5,11,10,H-24);
      ctx.fillStyle="#c8c4b8"; ctx.fillRect(cx-8,9,16,6); ctx.fillRect(cx-8,H-22,16,6); // capital + base
    }
    // teller counter back wall
    ctx.fillStyle="#5a5048"; ctx.fillRect(18,52,W-36,22);
    ctx.fillStyle="#8a8070"; ctx.fillRect(20,54,W-40,10);
    ctx.fillStyle="#e0dcd0"; ctx.fillRect(20,54,W-40,3);
    // vault door right side
    ctx.fillStyle="#484038"; ctx.fillRect(W-52,10,40,42);
    ctx.fillStyle="#6a6058"; ctx.fillRect(W-50,12,36,38);
    ctx.fillStyle="#c8a020"; for(let _r=0;_r<3;_r++) ctx.beginPath(), ctx.arc(W-34, 22+_r*10, 3, 0, 7), ctx.fill();
    ctx.fillStyle="#ffd666"; ctx.beginPath(); ctx.arc(W-34, 31, 8, 0, 7); ctx.fill();
    ctx.fillStyle="#c8a020"; ctx.beginPath(); ctx.arc(W-34, 31, 6, 0, 7); ctx.fill();
    ctx.fillStyle="#ffd666"; ctx.fillRect(W-36,24,4,14); ctx.fillRect(W-41,29,14,4);
    // teller (male, formal dark shirt)
    drawPerson(ctx, W/2, 46, "#2a2020", "#2a3a6a", t, false, 1, null, "down", null, "#1a2030");
    // waiting chairs
    for(const _cx of [W*0.38|0, W*0.50|0, W*0.62|0]){
      ctx.fillStyle="#7a7060"; ctx.fillRect(_cx-8,H-54,16,12); ctx.fillRect(_cx-10,H-56,20,4);
      ctx.fillStyle="#5a5048"; ctx.fillRect(_cx-7,H-43,14,4); ctx.fillRect(_cx-7,H-39,3,6); ctx.fillRect(_cx+4,H-39,3,6);
    }
    // decorative plant left
    ctx.fillStyle="#6a4020"; ctx.fillRect(22,H-44,14,18);
    ctx.fillStyle="#3a8a2a"; ctx.beginPath(); ctx.arc(29,H-46,10,0,7); ctx.fill();
    ctx.fillStyle="#4ab040"; ctx.beginPath(); ctx.arc(23,H-51,7,0,7); ctx.arc(35,H-51,7,0,7); ctx.fill();
  }
  if (S.tab==="furniture_shop"){
    // Nell's Home Store interior — warm, cosy showroom
    room("#7a5a3a","#a07050","#d4c4a0","#c8b890","#4a2a10");
    winP(W*0.10, 36); winP(W*0.65, 36);
    // back wall display shelf
    ctx.fillStyle="#5a3a18"; ctx.fillRect(10,52,W-20,14); ctx.fillStyle="#8a6040"; ctx.fillRect(10,52,W-20,3);
    // display furniture on shelf
    drawEmojiC(ctx,"🛋️",40,62,12); drawEmojiC(ctx,"🛏️",90,62,12); drawEmojiC(ctx,"📺",140,62,12);
    drawEmojiC(ctx,"🪑",190,62,12); drawEmojiC(ctx,"🧩",240,62,12); drawEmojiC(ctx,"🚽",285,62,12);
    // floor rug sample display
    ctx.fillStyle="#c06830aa"; ctx.fillRect(W/2-44,H-72,88,46);
    ctx.strokeStyle="#8a4820"; ctx.lineWidth=1.5; ctx.strokeRect(W/2-40,H-68,80,38);
    drawEmojiC(ctx,"🧩",W/2,H-50,16);
    // sofa display left
    ctx.fillStyle="#8a6a80"; ctx.fillRect(14,H-60,56,28); ctx.fillRect(10,H-64,12,32); ctx.fillRect(58,H-64,12,32);
    ctx.fillStyle="#7a5a70"; ctx.fillRect(16,H-62,52,8);
    drawEmojiC(ctx,"🛋️",40,H-54,11);
    // fridge/sink display right
    ctx.fillStyle="#e0e8f0"; ctx.fillRect(W-62,H-66,26,40); ctx.fillStyle="#d0d8e8"; ctx.fillRect(W-60,H-64,22,36);
    ctx.fillStyle="#d0d8e0"; ctx.fillRect(W-34,H-60,22,34); ctx.fillStyle="#c0c8d0"; ctx.fillRect(W-32,H-58,18,30);
    drawEmojiC(ctx,"🧊",W-49,H-48,10); drawEmojiC(ctx,"🚰",W-23,H-46,10);
    // shopkeeper Nell (female, warm shirt)
    drawPerson(ctx, W/2+60, 52, "#8a5a20", "#c86030", t, false, -1, null, "down", "#e8b880", "#4a3020", null, true);
    // price tag on shelf — widened so both lines fit inside
    const _ftx = W*0.45|0;
    ctx.fillStyle="#fff8f0"; ctx.fillRect(_ftx,46,52,18);
    ctx.fillStyle="#5a3a18";
    fitText(ctx, "🛋 FROM 20c",   _ftx+26, 48, 48, 7, { weight:"bold" });
    fitText(ctx, "DELIVERY FREE", _ftx+26, 56, 48, 7, { weight:"bold" });
  }
  if (S.tab==="pub"){
    // The Rose & Pallet — classic British pub
    room("#3a2010","#6a3820","#c8a060","#c09848","#1a0a04");
    winP(W*0.10, 36); winP(W*0.68, 36);
    // red carpet with black dot pattern (centre floor)
    ctx.fillStyle="#9a1a10"; ctx.fillRect(60,80,200,100);
    for(let _dy=0;_dy<5;_dy++) for(let _dx=0;_dx<10;_dx++){
      ctx.fillStyle="rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(68+_dx*20,90+_dy*20,2,0,7); ctx.fill();
    }
    // back wall bar counter
    ctx.fillStyle="#2a1008"; ctx.fillRect(8,46,W-16,24);
    ctx.fillStyle="#5a2c14"; ctx.fillRect(10,48,W-20,12);
    ctx.fillStyle="#c89040"; ctx.fillRect(10,48,W-20,3);
    // 3 beer tap pumps
    const _tapXs=[W*0.28,W*0.48,W*0.68];
    const _tapLabels=["VALE","STOUT","PALE"];
    for(let _ti=0;_ti<3;_ti++){
      const _tx2=_tapXs[_ti];
      ctx.fillStyle="#7a5030"; ctx.fillRect(_tx2-2,26,4,22);
      ctx.fillStyle="#c8a040"; ctx.fillRect(_tx2-5,22,10,6);
      ctx.fillStyle="#402010"; ctx.beginPath(); ctx.arc(_tx2,25,4,0,7); ctx.fill();
      ctx.fillStyle="rgba(255,248,220,.9)"; ctx.font="bold 5px monospace"; ctx.textAlign="center";
      ctx.fillText(_tapLabels[_ti],_tx2,44); ctx.textAlign="left";
    }
    // fireplace left wall
    ctx.fillStyle="#2a1408"; ctx.fillRect(6,60,34,62);
    ctx.fillStyle="#3a1c10"; ctx.fillRect(10,64,26,54);
    ctx.fillStyle="#1a0a04"; ctx.fillRect(12,82,22,34);
    const _ffr=(Math.sin(Date.now()/200)*0.12+0.72);
    ctx.fillStyle=`rgba(255,${110+Math.floor(Math.sin(Date.now()/280)*18)},20,${_ffr.toFixed(2)})`; ctx.fillRect(14,100,18,14);
    ctx.fillStyle=`rgba(255,200,50,${(_ffr*0.65).toFixed(2)})`; ctx.fillRect(16,96,14,10);
    ctx.fillStyle="#7a5030"; ctx.fillRect(8,120,34,4);
    // pool table (centre-right)
    const _ptX=158,_ptY=88;
    ctx.fillStyle="#1a5a1a"; ctx.fillRect(_ptX,_ptY,118,70);
    ctx.strokeStyle="#2a8a2a"; ctx.lineWidth=2; ctx.strokeRect(_ptX,_ptY,118,70);
    ctx.fillStyle="#2a7a2a"; ctx.fillRect(_ptX+2,_ptY+2,114,66);
    ctx.strokeStyle="#1a5a1a"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(_ptX+59,_ptY+2); ctx.lineTo(_ptX+59,_ptY+68); ctx.stroke();
    // pool balls
    for(const [bc,bx,by] of [["#e8e8e0",_ptX+22,_ptY+35],["#e84020",_ptX+88,_ptY+22],["#e8a020",_ptX+94,_ptY+32],["#2040e8",_ptX+86,_ptY+42]] as [string,number,number][]){
      ctx.fillStyle=bc; ctx.beginPath(); ctx.arc(bx,by,4,0,7); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(bx-1,by-1,1.5,0,7); ctx.fill();
    }
    // cue
    ctx.strokeStyle="#a07040"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(_ptX-12,_ptY+35); ctx.lineTo(_ptX+22,_ptY+35); ctx.stroke();
    // 2 round tables with stools (left side)
    for(const [_tx3,_ty3] of [[W*0.10,H-62],[W*0.38,H-62]] as [number,number][]){
      ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(_tx3,_ty3+10,18,6,0,0,7); ctx.fill();
      ctx.fillStyle="#5a3010"; ctx.beginPath(); ctx.ellipse(_tx3,_ty3,18,9,0,0,7); ctx.fill();
      ctx.fillStyle="#7a4a20"; ctx.beginPath(); ctx.ellipse(_tx3,_ty3,16,7,0,0,7); ctx.fill();
      ctx.fillStyle="#4a2008"; ctx.fillRect(_tx3-1,_ty3+9,2,12);
      for(const [_ox,_oy] of [[-26,0],[26,0]] as [number,number][]){
        ctx.fillStyle="#5a2a10"; ctx.fillRect(_tx3+_ox-5,_ty3+_oy-5,10,8);
        ctx.fillStyle="#3a1808"; ctx.fillRect(_tx3+_ox-2,_ty3+_oy+3,4,6);
      }
      drawEmojiC(ctx,"🍺",_tx3,_ty3-4,8);
    }
    // Rex landlord behind bar (white shirt)
    drawPerson(ctx, W/2-18, 48, "#5a3a20", "#e8e8e0", t, false, 1, null, "down", "#c89060", "#2a1808", null, false);
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.fillRect(W/2-22,38,8,18); // apron
    // evening crowd
    const _evHr=gameHour();
    if (_evHr>=18.5||_evHr<2){
      const _pats:[string,number,number,string,string,boolean][]=[
        ["#8a4a20",W*0.10,H-68,"#4a6aaa","#2a2a4a",false],
        ["#3a3a3a",W*0.38,H-64,"#c07040","#3a3020",true],
        ["#c9a24b",W*0.10,H-80,"#4a8a3a","#2a3a20",false],
        ["#6a3a20",W*0.38,H-78,"#9a3a60","#2a1a2a",true],
      ];
      for(const [h2,px2,py2,sh2,tr2,fem] of _pats) drawPerson(ctx,px2,py2,h2,sh2,t,false,1,null,"down",null,tr2,null,fem);
      // patron speech bubble
      const _qts=["*laughs*","Top drop!","Your round!","Cheers!","Grand pub this."];
      const _qt=_qts[Math.floor(Date.now()/5000)%_qts.length];
      const _bw=_qt.length*6+12;
      ctx.fillStyle="rgba(255,248,220,.95)"; ctx.strokeStyle="#8a6040"; ctx.lineWidth=1;
      ctx.fillRect(W*0.10-_bw/2,H-100,_bw,14); ctx.strokeRect(W*0.10-_bw/2,H-100,_bw,14);
      ctx.fillStyle="#453423"; ctx.font="bold 7px monospace"; ctx.textAlign="center";
      ctx.fillText(_qt,W*0.10,H-90); ctx.textAlign="left";
    }
    // pub sign on back wall top-right
    ctx.fillStyle="#2a1008"; ctx.fillRect(W-82,4,72,30);
    ctx.fillStyle="#8a4020"; ctx.fillRect(W-80,6,68,26);
    ctx.fillStyle="#ffd666";
    fitText(ctx, "THE ROSE", W-46, 9,  64, 9, { weight:"bold" });
    fitText(ctx, "& PALLET", W-46, 20, 64, 9, { weight:"bold" });
  }
  if (S.tab==="police_station"){
    room("#1a2a5a","#c0c8d8","#d8e0ec","#ccd8e8","#2a3a5a");
    winP(W*0.12,34); winP(W*0.65,34);
    // crest on back wall
    ctx.fillStyle="#2a3a5a"; ctx.fillRect(W/2-22,8,44,32);
    ctx.fillStyle="#1a2a4a"; ctx.fillRect(W/2-20,10,40,28);
    ctx.fillStyle="#ffd666"; ctx.font="bold 11px serif"; ctx.textAlign="center"; ctx.fillText("⚖",W/2,28); ctx.textAlign="left";
    // reception desk
    ctx.fillStyle="#3a4a6a"; ctx.fillRect(W/2-50,58,100,28);
    ctx.fillStyle="#4a5a7a"; ctx.fillRect(W/2-48,60,96,14);
    ctx.fillStyle="#ffd666"; ctx.fillRect(W/2-2,63,4,8);
    // wanted poster board
    ctx.fillStyle="#5a4030"; ctx.fillRect(W-44,10,36,52);
    ctx.fillStyle="#f4e8d0"; ctx.fillRect(W-42,12,32,48);
    ctx.fillStyle="#3a2020";
    fitText(ctx, "WANTED",    W-26, 16, 30, 6, { weight:"bold" });
    fitText(ctx, "have you",  W-26, 27, 30, 5, { weight:"bold" });
    fitText(ctx, "seen this", W-26, 35, 30, 5, { weight:"bold" });
    fitText(ctx, "person?",   W-26, 43, 30, 5, { weight:"bold" });
    drawEmojiC(ctx,"❓",W-26,58,9);
    // filing cabinet
    ctx.fillStyle="#4a5a6a"; ctx.fillRect(10,52,22,90);
    for(let fi=0;fi<4;fi++){ ctx.fillStyle="#5a6a7a"; ctx.fillRect(12,54+fi*22,18,18); ctx.fillStyle="#c8a040"; ctx.fillRect(18,62+fi*22,6,2); }
    // cell bars back-right
    ctx.fillStyle="#3a3a4a"; ctx.fillRect(W-62,48,52,62);
    ctx.fillStyle="#2a2a38"; ctx.fillRect(W-60,50,48,58);
    ctx.fillStyle="#4a4a5a"; for(let bi=0;bi<5;bi++) ctx.fillRect(W-58+bi*8,50,4,58);
    ctx.fillStyle="#c8a040"; ctx.fillRect(W-40,78,6,4);
    // 3 officers
    drawPerson(ctx,W/2,52,"#3a3a4a","#2a3a5a",t,false,1,null,"down","#d4b896","#1a2a4a",null,false);
    drawPerson(ctx,W*0.16,H*0.62,"#4a4a3a","#2a3a5a",t,false,1,null,"down","#c8a070","#1a2a4a",null,false);
    drawPerson(ctx,W*0.84,H*0.62,"#6a4a30","#2a3a5a",t,false,-1,null,"left","#d4b090","#1a2a4a",null,true);
    // floor badge
    ctx.fillStyle="#3a4a7a"; ctx.beginPath(); ctx.ellipse(W/2,H-28,36,14,0,0,7); ctx.fill();
    ctx.fillStyle="#ffd666"; ctx.font="bold 5px monospace"; ctx.textAlign="center"; ctx.fillText("FEATHERSTONE CONSTABULARY",W/2,H-25); ctx.textAlign="left";
  }
  if (S.tab==="police_cell"){
    // grim grey cell
    ctx.fillStyle="#4a4a52"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#3a3a40"; ctx.fillRect(0,0,W,9);
    for(let _gy=9;_gy<46;_gy+=14) for(let _gx=0;_gx<W;_gx+=28){ ctx.fillStyle="rgba(0,0,0,.09)"; ctx.fillRect(_gx,_gy,27,13); }
    ctx.fillStyle="#5a5a62"; ctx.fillRect(0,47,W,H-47);
    ctx.fillStyle="rgba(0,0,0,.06)"; for(let x=0;x<W;x+=20) ctx.fillRect(x,47,1,H-47);
    // bars on left
    ctx.fillStyle="#2a2a30"; ctx.fillRect(0,0,14,H);
    ctx.fillStyle="#4a4a5a"; for(let bi=0;bi<4;bi++) ctx.fillRect(bi*3,0,2,H);
    // barred window
    ctx.fillStyle="#1a1a20"; ctx.fillRect(W-36,10,30,24);
    ctx.fillStyle="#3a4a5a"; ctx.fillRect(W-34,12,26,20);
    for(let bi=0;bi<3;bi++){ ctx.fillStyle="#2a2a2a"; ctx.fillRect(W-28+bi*6,12,2,20); }
    // bed
    ctx.fillStyle="#3a3a42"; ctx.fillRect(16,60,62,34);
    ctx.fillStyle="#2a2a30"; ctx.fillRect(16,60,62,10);
    ctx.fillStyle="#5a4a3a"; ctx.fillRect(18,70,58,22);
    ctx.fillStyle="#4a3a2a"; ctx.fillRect(20,72,16,8);
    // comedy bucket
    ctx.fillStyle="#6a7a6a"; ctx.fillRect(W-22,H-32,14,20); ctx.fillStyle="#4a5a4a"; ctx.fillRect(W-22,H-32,14,4);
    drawEmojiC(ctx,"🪣",W-15,H-22,11);
    // graffiti
    ctx.fillStyle="rgba(255,255,255,.22)"; ctx.font="bold 6px monospace";
    ctx.fillText("I WOZ ERE",Math.round(W*0.40),34); ctx.fillText("♥ BETTY",Math.round(W*0.60),26);
    // cellmate
    const _cmX=W*0.72, _cmY=H*0.65;
    drawPerson(ctx,_cmX,_cmY,"#3a3a3a","#5a5a5a",t,false,-1,null,"left","#c89060","#3a3a3a",null,false);
    const _cLines=["First time? Heh. Won't be.","*snores loudly*","I was framed. Again.","The chips in here are terrible.","Officer Plonk's got it in for me.","You smell like someone else's house."];
    const _cl=_cLines[Math.floor(Date.now()/6000)%_cLines.length];
    const _cbw=_cl.length*5+14;
    ctx.fillStyle="rgba(240,240,220,.9)"; ctx.strokeStyle="#6a6a7a"; ctx.lineWidth=1;
    ctx.fillRect(_cmX-_cbw+12,_cmY-38,_cbw,14); ctx.strokeRect(_cmX-_cbw+12,_cmY-38,_cbw,14);
    ctx.fillStyle="#2a2a3a"; ctx.font="bold 6px monospace"; ctx.textAlign="center";
    ctx.fillText(_cl,_cmX-_cbw/2+12,_cmY-28); ctx.textAlign="left";
    // blocked exit door
    ctx.fillStyle="#3a3a42"; ctx.fillRect(W/2-14,H-20,28,20);
    ctx.fillStyle="#4a4a52"; ctx.fillRect(W/2-12,H-18,24,16);
    ctx.fillStyle="#3a3a48"; for(let bi2=0;bi2<3;bi2++) ctx.fillRect(W/2-10+bi2*7,H-18,3,16);
    drawEmojiC(ctx,"🔒",W/2,H-8,10);
    // player
    drawPerson(ctx,IP.x,IP.y,plHair(),plShirt(),t,IP.moving,IP.facing,null,IP.dir,plSkin(),plTrousers(),null,plGender()==='female',1.0,plHat(),plHatColor(),plOpts());
  }
  if (S.tab==="retail"){
    // Retail Stall interior — candy-bright, market feel
    room("#8a2040","#c04060","#fce8f0","#f8d8e8","#4a0820");
    winP(W*0.14, 38); winP(W*0.70, 38);
    // striped awning across top
    for(let i=0;i<8;i++){ ctx.fillStyle=i%2===0?"#e84060":"#fff8fc"; ctx.fillRect(i*(W/8),0,W/8,12); }
    // display counter
    ctx.fillStyle="#5a1828"; ctx.fillRect(12,52,W-24,22);
    ctx.fillStyle="#c04060"; ctx.fillRect(14,54,W-28,10);
    ctx.fillStyle="#fce8f0"; ctx.fillRect(14,54,W-28,3);
    // display items on counter
    const _rItems = ["🥐","🍎","🧁","🎀","🪴"];
    _rItems.forEach((em,i)=>{ drawEmojiC(ctx, em, 30+i*52, 52, 12); });
    // chalk price board on back wall — text centred and fitted within the board
    ctx.fillStyle="#2a1020"; ctx.fillRect(W-80,8,70,44);
    ctx.fillStyle="#3a2030"; ctx.fillRect(W-78,10,66,40);
    const _pbcx = W-45;   // board centre (W-78..W-12)
    ctx.fillStyle="rgba(255,255,255,.72)";
    fitText(ctx, "TODAY'S",   _pbcx, 14, 60, 8, { weight:"bold" });
    fitText(ctx, "SPECIALS",  _pbcx, 24, 60, 8, { weight:"bold" });
    ctx.fillStyle="rgba(255,220,150,.85)";
    fitText(ctx, "✦ Fresh ✦", _pbcx, 34, 60, 7);
    // shopkeeper
    drawPerson(ctx, W/2, 46, "#c9a24b", "#e84060", t, false, 1, null, "down", null, "#4a1828", null, true);
    // bunting across ceiling
    for(let bi=0;bi<6;bi++){
      const _bx = bi*(W/5.5), _by = 6+Math.sin(bi*1.2)*3;
      ctx.fillStyle=["#e84060","#ffd666","#4a8ae8","#68cc68","#e86040"][bi%5];
      ctx.beginPath(); ctx.moveTo(_bx,0); ctx.lineTo(_bx-6,_by+8); ctx.lineTo(_bx+6,_by+8); ctx.closePath(); ctx.fill();
      if (bi>0) { ctx.strokeStyle="#8a4060"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(_bx-(W/5.5),3); ctx.lineTo(_bx,3); ctx.stroke(); }
    }
    // waiting customer
    drawPerson(ctx, W*0.22, H-40, "#8a6a4a", "#4a6aaa", t, false, 1, null, "down", null, "#2a2a4a");
    drawPerson(ctx, W*0.75, H-44, "#c08050", "#c8704a", t, false, 1, null, "down", null, "#3a3a2a", null, true);
  }
  if (S.tab==="postoffice"){
    // Post Office interior — classic British red, efficient
    room("#6a1010","#9a2020","#f0e8e0","#e8dcd0","#2a0808");
    winP(W*0.10, 38); winP(W*0.65, 38);
    // royal mail red service counter
    ctx.fillStyle="#8a1a1a"; ctx.fillRect(10,52,W-20,22);
    ctx.fillStyle="#c02020"; ctx.fillRect(12,54,W-24,10);
    ctx.fillStyle="#f0e8e0"; ctx.fillRect(12,54,W-24,3);
    // glass partition
    ctx.fillStyle="rgba(180,210,230,.30)"; ctx.fillRect(12,28,W-24,26);
    ctx.strokeStyle="#8a9aaa"; ctx.lineWidth=1; ctx.strokeRect(12,28,W-24,26); ctx.lineWidth=1;
    // shelving with parcels behind counter
    for(let sh=0;sh<3;sh++){
      ctx.fillStyle="#5a3818"; ctx.fillRect(W-90,10+sh*14,70,2);
      const _parcCols=["#c84020","#e8a020","#2a5aaa","#4a8a3a"];
      for(let p=0;p<3;p++){ ctx.fillStyle=_parcCols[(sh*3+p)%4]; ctx.fillRect(W-88+p*22,12+sh*14,18,10); }
    }
    // postmaster
    drawPerson(ctx, W*0.55, 46, "#3a3a3a", "#c02020", t, false, 1, null, "down", null, "#1a1a1a", null, false);
    // royal cipher/crest on wall
    ctx.fillStyle="#c09820"; ctx.font="bold 14px serif"; ctx.textAlign="center";
    ctx.fillText("✦ GR ✦", 38, 34); ctx.textAlign="left";
    // mailboxes on left wall
    for(let mb=0;mb<4;mb++){
      ctx.fillStyle="#c02020"; ctx.fillRect(12,H-72+mb*14,22,12);
      ctx.fillStyle="#8a1010"; ctx.fillRect(26,H-66+mb*14,4,2);
    }
    // waiting area chairs
    for(const _cx of [W*0.28|0, W*0.42|0]){
      ctx.fillStyle="#6a3030"; ctx.fillRect(_cx-8,H-44,16,10); ctx.fillRect(_cx-10,H-46,20,3);
    }
    // seated customer with parcel
    drawPerson(ctx, W*0.30, H-48, "#c9a060", "#4a6a9a", t, false, 1, null, "down", null, "#2a3a5a");
    ctx.fillStyle="#c84020"; ctx.fillRect(W*0.30-8,H-56,16,10); // parcel in hands
  }
  if (S.tab==="estateagent"){
    // Estate Agent interior — smart navy/glass, aspirational
    room("#1a2a3a","#2a4060","#e8ecf0","#dde4ea","#0a1420");
    winP(W*0.08, 38); winP(W*0.68, 38);
    // marble-effect floor
    ctx.fillStyle="rgba(255,255,255,.06)"; for(let fy=47;fy<H;fy+=28) ctx.fillRect(0,fy,W,14);
    // property photo boards on back wall
    const _propCols=["#c8b878","#b0c0a8","#d0c8b8"];
    const _propIcs=["🏡","🏠","🏰"];
    [0,1,2].forEach(i=>{
      const _bx=14+i*96, _by=8;
      ctx.fillStyle="#1a2a3a"; ctx.fillRect(_bx,_by,84,46);
      ctx.fillStyle=_propCols[i]; ctx.fillRect(_bx+2,_by+2,80,36);
      drawEmojiC(ctx, _propIcs[i], _bx+42, _by+22, 18);
      ctx.fillStyle="#fff"; ctx.font="bold 5px monospace"; ctx.fillText(PROPERTIES[i].n.slice(0,12), _bx+4, _by+44);
    });
    // agent desk
    ctx.fillStyle="#1a3050"; ctx.fillRect(W/2-36,52,72,20);
    ctx.fillStyle="#2a4060"; ctx.fillRect(W/2-34,54,68,8);
    // laptop glow on desk
    ctx.fillStyle="#0a3a5a"; ctx.fillRect(W/2-10,46,20,6);
    ctx.fillStyle="rgba(80,180,255,.4)"; ctx.fillRect(W/2-9,46,18,5);
    // agent
    drawPerson(ctx, W/2, 48, "#4a3a2a", "#1a3060", t, false, 1, null, "down", null, "#0a1020", null, true);
    // client chairs
    for(const _cx of [W*0.30|0, W*0.70|0]){
      ctx.fillStyle="#2a4060"; ctx.fillRect(_cx-10,H-50,20,14); ctx.fillRect(_cx-12,H-52,24,4);
    }
    // waiting clients
    drawPerson(ctx, W*0.28, H-58, "#8a6a50", "#3a5a80", t, false, 1, null, "down", null, "#1a2a3a");
    drawPerson(ctx, W*0.72, H-54, "#c9a060", "#2a4a70", t, false, 1, null, "down", null, "#0a1830", null, true);
    // potted plant
    ctx.fillStyle="#3a2010"; ctx.fillRect(W-28,H-44,16,20);
    ctx.fillStyle="#1a5a28"; ctx.beginPath(); ctx.arc(W-20,H-46,10,0,7); ctx.fill();
    ctx.fillStyle="#2a7a38"; ctx.beginPath(); ctx.arc(W-26,H-50,7,0,7); ctx.arc(W-14,H-50,7,0,7); ctx.fill();
  }
  if (S.tab==="nightclub"){
    // Club Featherstone — dark venue, themed night (M11)
    const _th = clubTheme();
    const _pulse = 0.5 + 0.5*Math.sin(t*6);
    ctx.fillStyle="#0e0a16"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#160e22"; ctx.fillRect(0,0,W,46);                 // back wall
    ctx.fillStyle=_th.neon;  ctx.fillRect(0,44,W,2);                 // neon wall strips
    ctx.fillStyle=_th.neon2; ctx.fillRect(0,H-3,W,3);
    // disco ball + light rays
    const _dbx=W/2, _dby=30;
    for(let r=0;r<8;r++){ const a=t*0.6+r*Math.PI/4; ctx.strokeStyle=(r%2?_th.neon:_th.neon2)+"44"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(_dbx,_dby); ctx.lineTo(_dbx+Math.cos(a)*190,_dby+Math.sin(a)*190); ctx.stroke(); }
    ctx.fillStyle="#c8c8d8"; ctx.beginPath(); ctx.arc(_dbx,_dby,7,0,7); ctx.fill();
    for(let i=0;i<6;i++){ ctx.fillStyle=i%2?"#fff":"#8a8aa0"; ctx.fillRect(_dbx-6+i*2,_dby-6,2,12); }
    // dance-floor grid (theme palette, pulsing)
    const _fx0=70,_fy0=72,_cols=8,_rows=5,_cs=22;
    for(let r=0;r<_rows;r++) for(let c=0;c<_cols;c++){
      const idx=(r+c+Math.floor(t*3))%_th.floor.length;
      ctx.globalAlpha=(((c+r+Math.floor(t*2))%2)===0)?0.85:0.4; ctx.fillStyle=_th.floor[idx];
      ctx.fillRect(_fx0+c*_cs,_fy0+r*_cs,_cs-2,_cs-2);
    }
    ctx.globalAlpha=1;
    // DJ booth (back centre)
    ctx.fillStyle="#1a1226"; ctx.fillRect(120,10,80,28); ctx.fillStyle=_th.neon+"aa"; ctx.fillRect(120,10,80,3);
    for(const _tx of [138,182]){ ctx.fillStyle="#2a2a32"; ctx.beginPath(); ctx.arc(_tx,26,8,0,7); ctx.fill();
      ctx.fillStyle="#0a0a0a"; ctx.beginPath(); ctx.arc(_tx,26,6,0,7); ctx.fill();
      ctx.strokeStyle=_th.neon2; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(_tx,26); ctx.lineTo(_tx+Math.cos(t*8)*5,26+Math.sin(t*8)*5); ctx.stroke(); }
    drawPerson(ctx,160,20,"#1a1a1a",_th.neon,t,false,1,null,"down",null,"#0a0a0a",null,false);
    drawEmojiC(ctx,"🎧",160,9,10);
    // speaker stacks
    for(const _sx of [10,286]){ ctx.fillStyle="#14101c"; ctx.fillRect(_sx,10,24,34);
      ctx.fillStyle="#0a0810"; for(const _sy of [17,31]){ ctx.beginPath(); ctx.arc(_sx+12,_sy,6+_pulse*2,0,7); ctx.fill(); }
      ctx.fillStyle=_th.neon+"66"; ctx.fillRect(_sx,10,24,2); }
    // bar (right)
    ctx.fillStyle="#1c1428"; ctx.fillRect(250,96,60,20); ctx.fillStyle=_th.neon2+"88"; ctx.fillRect(250,96,60,3);
    drawEmojiC(ctx,"🍹",266,104,10); drawEmojiC(ctx,"🥤",292,104,9);
    drawPerson(ctx,280,92,"#2a1a2a","#e0e0e8",t,false,-1,null,"down",null,"#1a1a20",null,true);
    // dancing crowd (theme outfits, bobbing)
    const _dancers=[[100,152],[150,162],[200,152],[128,126],[184,128]];
    _dancers.forEach((p,i)=>{ const o=_th.outfit[i%_th.outfit.length]; const bob=Math.sin(t*8+i*1.3)*3;
      drawPerson(ctx,p[0],p[1]+bob,(["#2a1a0a","#6a4a2a","#c9a24b"] as string[])[i%3],o[0],t,true,i%2?1:-1,null,"down",null,o[1],null,i%2===0); });
    // bouncer by the door
    drawPerson(ctx,W/2+42,H-30,"#1a1a1a","#2a2a2a",t,false,-1,null,"down",null,"#111111",null,false);
    drawEmojiC(ctx,"🕶️",W/2+42,H-40,8);
    // theme banner (drawn last, on top)
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(W/2-72,4,144,15);
    ctx.strokeStyle=_th.neon; ctx.lineWidth=1; ctx.strokeRect(W/2-72,4,144,15);
    ctx.fillStyle=_th.neon; ctx.font="bold 8px monospace"; ctx.textAlign="center";
    ctx.fillText(_th.emoji+" "+_th.name.toUpperCase(), W/2, 14); ctx.textAlign="left"; ctx.font="10px monospace";
  }
  if (S.tab==="robotics_lab"){
    // Automation Lab — server racks, robot arm, charging bots
    room("#3a4a5a","#7a8a9a","#c0c8d0","#b4bcc6","#2a3440");
    winP(W*0.12,34); winP(W*0.62,34);
    for(let i=0;i<4;i++){ const sx=14+i*20;
      ctx.fillStyle="#1a222c"; ctx.fillRect(sx,50,16,H-72);
      ctx.fillStyle="#2a3440"; ctx.fillRect(sx+2,52,12,H-76);
      for(let r=0;r*12<H-90;r++){ ctx.fillStyle=(Math.floor(t*2)+i+r)%3===0?"#4affaa":"#2a6a4a"; ctx.fillRect(sx+3,56+r*12,3,3); ctx.fillStyle="#3a8ad0"; ctx.fillRect(sx+9,56+r*12,3,3); } }
    // animated robot arm (centre)
    const _ax=Math.round(W*0.5), _ay=Math.round(H*0.5), _aa=Math.sin(t*1.5)*0.5;
    ctx.strokeStyle="#8a94a0"; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(_ax,_ay+18); ctx.lineTo(_ax,_ay); ctx.lineTo(_ax+Math.cos(-0.6+_aa)*30,_ay+Math.sin(-0.6+_aa)*30); ctx.stroke();
    ctx.fillStyle="#c8ccd8"; ctx.fillRect(_ax-9,_ay+16,18,8);
    ctx.fillStyle="#e8a020"; ctx.beginPath(); ctx.arc(_ax+Math.cos(-0.6+_aa)*30,_ay+Math.sin(-0.6+_aa)*30,4,0,7); ctx.fill();
    // holo screen
    ctx.fillStyle="rgba(60,150,220,.22)"; ctx.fillRect(W-70,54,54,34); ctx.strokeStyle="#3a8ad0"; ctx.lineWidth=1; ctx.strokeRect(W-70,54,54,34);
    drawEmojiC(ctx,"📊",W-43,71,14);
    // charging bots (dormant, lower corners)
    for(const [bx,by,i] of [[Math.round(W*0.2),H-38,0],[Math.round(W*0.82),H-42,1]] as [number,number,number][]){
      ctx.fillStyle="#8a94a0"; ctx.fillRect(bx-8,by-10,16,16); ctx.fillStyle="#2a3440"; ctx.fillRect(bx-5,by-7,10,6);
      ctx.fillStyle=(Math.floor(t*3)+i)%2?"#4affaa":"#2a6a4a"; ctx.fillRect(bx-3,by-5,2,2); ctx.fillStyle="#3a8ad0"; ctx.fillRect(bx+1,by-5,2,2);
      drawEmojiC(ctx,"🔌",bx,by+11,9);
    }
    // engineer
    drawPerson(ctx,Math.round(W*0.5),H-28,"#3a3a3a","#4a8ad0",t,false,1,null,"down",null,"#2a2a2a",null,false);
  }
  if (S.tab==="data_centre"){
    // Data Centre — cool server hall, big grid status wall
    room("#2a3a4a","#5a6a7a","#aab4c0","#9ea8b4","#1a2430");
    const _gt = gridTier(S.grid?.tier||0), _lit = (S.grid?.tier||0) > 0;
    // rows of server cabinets
    for(let i=0;i<5;i++){ const sx=12+i*18;
      ctx.fillStyle="#141c26"; ctx.fillRect(sx,52,14,H-74);
      ctx.fillStyle="#1e2a38"; ctx.fillRect(sx+2,54,10,H-78);
      for(let r=0;r*10<H-92;r++){ const on=_lit && ((Math.floor(t*3)+i*2+r)%4!==0); ctx.fillStyle=on?"#2affd0":"#204040"; ctx.fillRect(sx+3,58+r*10,8,2); }
    }
    // grid status wall (right)
    ctx.fillStyle="rgba(20,40,60,.6)"; ctx.fillRect(W-78,52,64,44); ctx.strokeStyle=_lit?"#2affd0":"#3a5a6a"; ctx.lineWidth=1; ctx.strokeRect(W-78,52,64,44);
    drawEmojiC(ctx, _gt.ic, W-46, 66, 15);
    ctx.fillStyle=_lit?"#2affd0":"#7a8a96"; ctx.font="bold 7px monospace"; ctx.textAlign="center";
    ctx.fillText(_gt.name.toUpperCase(), W-46, 84);
    ctx.fillText(_lit?`+${Math.round(_gt.speedBonus*100)}% EFFICIENCY`:"OFFLINE", W-46, 92); ctx.textAlign="left"; ctx.font="10px monospace";
    // power conduits on the floor (glow when powered)
    ctx.strokeStyle=_lit?`rgba(42,255,208,${(0.4+Math.sin(t*3)*0.2).toFixed(2)})`:"rgba(90,110,120,.3)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(20,H-24); ctx.lineTo(W-20,H-24); ctx.stroke();
    // technician
    drawPerson(ctx,Math.round(W*0.5),H-30,"#2a2a2a","#3a7a8a",t,false,1,null,"down",null,"#1a2a30",null,true);
  }
  if (S.tab==="exchange"){
    // Exchange Floor interior — corporate, sleek, lots of screens
    room("#303848","#485060","#c0c8d0","#d0d8e0","#1a2028");
    winP(W*0.12, 38); winP(W*0.72, 38);
    // dark tile floor with grid lines
    ctx.fillStyle="rgba(0,0,0,.15)"; ctx.fillRect(0,45,W,H);
    for(let gy=55;gy<H;gy+=20) { ctx.fillStyle="rgba(255,255,255,.04)"; ctx.fillRect(0,gy,W,1); }
    for(let gx=0;gx<W;gx+=20)  { ctx.fillStyle="rgba(255,255,255,.04)"; ctx.fillRect(gx,45,1,H); }
    // back wall screens (price charts)
    const _scrColors = ["#1a3a5a","#1a4a2a","#3a2a1a","#3a1a3a","#1a3a4a"];
    const _scrX = [14,72,130,188,246];
    _scrColors.forEach((bg,i)=>{
      ctx.fillStyle="#111"; ctx.fillRect(_scrX[i],10,52,38);
      ctx.fillStyle=bg; ctx.fillRect(_scrX[i]+2,12,48,34);
      // chart line
      ctx.strokeStyle=i%2===0?"#4aff88":"#ff6a4a"; ctx.lineWidth=1.5; ctx.beginPath();
      for(let px=0;px<48;px+=4){
        const py = 20 + Math.sin(px*0.4+i)*7;
        px===0 ? ctx.moveTo(_scrX[i]+2+px,12+py) : ctx.lineTo(_scrX[i]+2+px,12+py);
      }
      ctx.stroke(); ctx.lineWidth=1;
      // ticker label
      ctx.fillStyle="#fff"; ctx.font="bold 5px monospace";
      ctx.fillText(["ORE","STLB","FISH","BRKT","WLOM"][i], _scrX[i]+3, 47);
    });
    // trading desks
    for(const _dx of [W*0.25|0, W*0.55|0, W*0.80|0]){
      ctx.fillStyle="#2a3a4a"; ctx.fillRect(_dx-18,H-72,36,18);
      ctx.fillStyle="#1a2a38"; ctx.fillRect(_dx-14,H-80,28,10);
      drawPerson(ctx, _dx, H-76, "#8a7a5a", "#1a3060", t, false, 1, null, "down", null, "#111");
    }
    // ticker tape along top
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(0,0,W,9);
    ctx.fillStyle="#ffd666"; ctx.font="bold 6px monospace";
    const _tapeItems = ["ORE +2.1%","STLB +5.4%","FISH -3.2%","BRKT +8.7%","WLOM +1.2%"];
    let _tx2 = (_tickerX * 0.6) % (W + 200) - 80;
    _tapeItems.forEach(s=>{ ctx.fillText(s, _tx2, 7); _tx2 += ctx.measureText(s).width + 24; });
    // receptionist desk front
    ctx.fillStyle="#384858"; ctx.fillRect(W/2-30,H-48,60,14);
    ctx.fillStyle="#4a5a6a"; ctx.fillRect(W/2-28,H-56,56,10);
    drawPerson(ctx, W/2, H-58, "#c09060", "#c83030", t, true, 1, null, "down", null, "#1a1a2a");
  }
  if (S.tab==="university"){
    // University interior — stone, ivy, chalkboards, lecture hall
    room("#6a6450","#9a9070","#e8e4d0","#ddd8c0","#3a3020");
    winP(W*0.08, 38); winP(W*0.68, 38);
    // stone floor texture
    for(let gy=47;gy<H;gy+=18) for(let gx=0;gx<W;gx+=36){
      ctx.fillStyle="rgba(0,0,0,.06)"; ctx.fillRect(gx+(gy%36<18?0:18),gy,17,17);
    }
    // chalkboard back wall
    ctx.fillStyle="#2a3020"; ctx.fillRect(14,8,W-28,50);
    ctx.fillStyle="#344028"; ctx.fillRect(16,10,W-32,46);
    // chalk drawings on board
    ctx.strokeStyle="rgba(255,255,255,.7)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(30,22); ctx.lineTo(80,22); ctx.lineTo(55,40); ctx.closePath(); ctx.stroke(); // triangle
    ctx.beginPath(); ctx.arc(W/2,28,10,0,7); ctx.stroke(); // circle
    ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.beginPath(); ctx.moveTo(W-80,14); ctx.lineTo(W-20,14); ctx.moveTo(W-70,22); ctx.lineTo(W-30,22); ctx.stroke(); // text lines
    ctx.fillStyle="rgba(255,255,255,.6)"; ctx.font="bold 7px monospace"; ctx.fillText("SKILLS +XP", W/2-26, 40);
    ctx.lineWidth=1;
    // lecturer at board
    drawPerson(ctx, W/2, 50, "#7a5a30", "#4a2a8a", t, true, 1, null, "down", null, "#1a1020");
    // rows of desks
    for(let row=0;row<2;row++) for(let col=0;col<4;col++){
      const _dx = 30+col*68, _dy = H-80+row*32;
      ctx.fillStyle="#8a7a50"; ctx.fillRect(_dx-14,_dy,28,10);
      ctx.fillStyle="#6a5a38"; ctx.fillRect(_dx-12,_dy+10,4,12); ctx.fillRect(_dx+8,_dy+10,4,12);
      // seated student (alternating)
      if (row===0||col<3) drawPerson(ctx, _dx, _dy-4, "#c09060", col%2===0?"#4a6a9a":"#9a4a2a", t, col%3!==0, 1, null, "down", null, "#1a1a1a");
    }
    // ivy on walls
    ctx.fillStyle="#3a6a2a";
    for(let iy=0;iy<6;iy++){ ctx.beginPath(); ctx.arc(6+iy*8,50+iy*12,5,0,7); ctx.fill(); }
    for(let iy=0;iy<5;iy++){ ctx.beginPath(); ctx.arc(W-10+iy*3,55+iy*10,4,0,7); ctx.fill(); }
  }
  // station nodes from STATION_DEFS — drawn on top of background, below player
  const stations = STATION_DEFS[S.tab];
  if (stations){
    stations.forEach(st=>{
      const sx = st.fx * W, sy = st.fy * H;
      const isActive = active===st.skill && S.action?.id===st.id;
      const locked = skillLvl(st.skill) < (findAction(st.skill, st.id)?.lvl || 0);
      // sprite or fallback box
      // ground shadow so props sit on the floor instead of floating
      ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(sx, sy+16, 22, 5, 0, 0, 7); ctx.fill();
      if (S.tab==="woodcutting"){
        // milled log piles (indoor-appropriate — no trees in here)
        const _n = st.id==='pine' ? 2 : st.id==='oak' ? 3 : 4;
        const _tone = st.id==='hardwood' ? "#6a3e1e" : st.id==='oak' ? "#8a5a30" : "#a06a3a";
        for (let li=0; li<_n; li++){
          const lyr = Math.floor(li/2), _lx = sx-20+(li%2)*20-lyr*10, _ly = sy+6-lyr*9;
          ctx.fillStyle = locked ? "#8a8078" : _tone; ctx.fillRect(_lx, _ly, 24, 9);
          ctx.fillStyle = locked ? "#a8a098" : "#c9955a"; ctx.beginPath(); ctx.arc(_lx+24, _ly+4.5, 4.5, 0, 7); ctx.fill();
          ctx.fillStyle = locked ? "#8a8078" : _tone; ctx.beginPath(); ctx.arc(_lx+24, _ly+4.5, 2.5, 0, 7); ctx.fill();
        }
      } else {
        ctx.globalAlpha = locked ? 0.45 : 1;
        if (!drawSprite(ctx, st.sk, sx, sy+15, 44)){
          ctx.fillStyle = locked ? "#888" : isActive ? "#ffd666" : "#b09060";
          ctx.fillRect(sx-20, sy-13, 40, 32);
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = locked ? 0.55 : 1;
      drawEmojiC(ctx, st.ic, sx, sy-18, 14);
      ctx.globalAlpha = 1;
      if (locked) drawEmojiC(ctx, "🔒", sx+16, sy-28, 9);
      if (isActive){
        drawEmojiC(ctx, SKILL_TOOL[st.skill]||"⚒️", sx+Math.sin(t*8)*3, sy-10, 13);
      }
    });
  }
  // exit door — bottom centre; player walks to bottom edge to leave
  ctx.fillStyle="#6a4a2f"; ctx.fillRect(W/2-14, H-20, 28, 20);
  ctx.fillStyle="#c8a060"; ctx.fillRect(W/2-1, H-10, 3, 3);
  drawEmojiC(ctx, "🚪", W/2, H-9, 11);
  // draw villagers who work in this room (indoor flag set by updateVillagers)
  const _tabWorkers = VILLAGER_STATE.filter(v => v.indoor && v.workTab===S.tab);
  _tabWorkers.forEach((v, i) => {
    // initialise interior position first time they arrive
    if (!v.iwx){ v.iwx = (i+1)/(_tabWorkers.length+1)*W; v.iwy = H*0.58; }
    drawPerson(ctx, v.iwx, v.iwy, v.hair, v.shirt, t, v.moving, v.facing, null, v.dir||"down", null, v.trouser, null, v.female);
  });
  // player drawn last so they render above furniture. The character now holds and
  // works every tool themselves (including the fishing rod).
  const _iTool = SKILL_TOOL[active] || null;
  drawPerson(ctx, IP.x, IP.y, plHair(), plShirt(), t, IP.moving, IP.facing, _iTool, IP.dir, plSkin(), plTrousers(), _iTool ? toolTierColor() : null, plGender()==='female', 1.0, plHat(), plHatColor(), plOpts());
  // completion feedback: floating "+item" rewards that pop and rise from the station
  {
    const _nowv = Date.now();
    for (let i=_intVfx.length-1; i>=0; i--){
      const f = _intVfx[i], age = (_nowv - f.born) / 1200;
      if (age >= 1){ _intVfx.splice(i,1); continue; }
      const _yy = f.y - 22 - age*22, _bounce = Math.sin(Math.min(1, age*3)*Math.PI)*4;
      if (age < 0.3){ ctx.strokeStyle = `rgba(255,240,150,${(0.85*(1-age/0.3)).toFixed(2)})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(f.x, f.y-6, 5+age*44, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = Math.min(1, (1-age)*1.6);
      ctx.font="bold 11px 'IBM Plex Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      const _txt = `+${f.n} ${f.ic}`;
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillText(_txt, f.x+1, _yy-_bounce+1);
      ctx.fillStyle="#fff2c0"; ctx.fillText(_txt, f.x, _yy-_bounce);
      ctx.globalAlpha = 1;
    }
    // combo streak badge (top-centre) while a run is going
    if (_comboCount >= 3 && (_nowv - _comboAt) < 3200){
      ctx.globalAlpha = Math.min(1, (3200-(_nowv-_comboAt))/900);
      ctx.font="bold 12px 'IBM Plex Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      const _ct = `🔥 ${_comboCount} in a row!`;
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillText(_ct, W/2+1, 15);
      ctx.fillStyle="#ffd666"; ctx.fillText(_ct, W/2, 14);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  }
  // crisp HTML overlays: name tags + chat panel
  const _iOverlay = document.getElementById("interior-overlay");
  if (_iOverlay){
    let _iHtml = "";
    _tabWorkers.forEach(v => {
      const px = v.iwx/W*100;
      // speaking villagers get a legible bubble you can read across the room;
      // otherwise just a name tag when you're close.
      if (v !== CHAT_NPC && isSpeaking(v)){
        _iHtml += speechBubbleHtml(v.n, speechLine(v), px, (v.iwy-34)/H*100);
      } else if (Math.hypot(IP.x-v.iwx, IP.y-v.iwy) < 28){
        _iHtml += `<div class="int-vlbl" style="left:${px.toFixed(1)}%;top:${((v.iwy-30)/H*100).toFixed(1)}%">${v.n}</div>`;
      }
    });
    if (CHAT_NPC){
      const q = speechLine(CHAT_NPC);
      _iHtml += `<div class="int-chat"><span class="int-chat-name">${CHAT_NPC.n}:</span><span class="int-chat-txt"> ${esc(q)}</span><span class="int-chat-dim"> · tap to dismiss</span></div>`;
    }
    // resident NPC: either a chat panel, or a "talk to me" tag over their head
    {
      const _res = INTERIOR_RESIDENTS[S.tab];
      if (_res){
        if (_intChat && _intChat.name === _res.name){
          const _l = _intChat.lines[_intChat.idx];
          _iHtml += `<div class="int-chat"><span class="int-chat-name">${_res.name}:</span><span class="int-chat-txt"> ${esc(_l)}</span><span class="int-chat-dim"> · tap to continue</span></div>`;
        } else {
          _iHtml += `<div class="int-vlbl" style="left:${(_res.x/W*100).toFixed(1)}%;top:${(((_res.y-30)/H)*100).toFixed(1)}%">💬 ${_res.name}</div>`;
        }
      }
    }
    // home occupant: a legible speech bubble when they're chatting, else a name tag
    if (S.tab==="home" && _homeVilLbl){
      const _hx = _homeVilLbl.x/W*100;
      const _hv = VILLAGERS.find(vl => vl.homeId === S.roomObjId);
      if (_hv && isSpeaking(_hv)){
        _iHtml += speechBubbleHtml(_homeVilLbl.name, speechLine(_hv), _hx, (_homeVilLbl.y-34)/H*100);
      } else {
        _iHtml += `<div class="int-vlbl" style="left:${_hx.toFixed(1)}%;top:${((_homeVilLbl.y-30)/H*100).toFixed(1)}%">${_homeVilLbl.name}</div>`;
      }
    }
    // crisp "gone to work" note when the occupant is out (legible, not tiny canvas text)
    if (S.tab==="home" && _homeAwayName){
      _iHtml += `<div class="int-note" style="left:50%;top:${((H-40)/H*100).toFixed(1)}%">🏢 Gone to work!<span class="int-note-sub">— ${esc(_homeAwayName)}</span></div>`;
    }
    // trespass badge
    if (S.tab==="home" && S.trespass?.active){
      _iHtml += `<div style="position:absolute;left:6px;bottom:24px;background:rgba(180,20,20,.9);color:#fff;font:700 9px 'IBM Plex Mono',monospace;padding:2px 8px;border-radius:3px;pointer-events:none;letter-spacing:.5px">⚠ TRESPASSING</div>`;
    }
    // flee countdown overlay
    if (S.fleeUntil > 0){
      const _rem = Math.max(0, S.fleeUntil - Date.now());
      const _sec = Math.ceil(_rem / 1000);
      const _pct = (_rem / 10000) * 100;
      _iHtml += `<div style="position:absolute;top:4px;left:50%;transform:translateX(-50%);background:rgba(180,20,20,.92);color:#fff;font:700 10px 'IBM Plex Mono',monospace;padding:4px 14px 6px;border-radius:4px;pointer-events:none;text-align:center;white-space:nowrap">🚨 FLEE! ${_sec}s<div style="height:4px;background:rgba(255,255,255,.25);border-radius:2px;margin-top:3px"><div style="height:4px;background:#ff4040;border-radius:2px;width:${_pct.toFixed(1)}%;transition:width .2s"></div></div></div>`;
    }
    _iOverlay.innerHTML = _iHtml;
  }
}
function drawTitleFX(t){
  const cv = document.getElementById("titlefx");
  if (!cv) return;
  const tl = document.getElementById("title");
  if (!tl || tl.style.display === "none") return;
  if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight){
    cv.width = cv.clientWidth || 800; cv.height = cv.clientHeight || 600;
  }
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  const day = (Math.sin(t*0.08)+1)/2;
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, `rgb(${166+day*40},${200+day*23},${245-day*60})`);
  g.addColorStop(0.55, "#ffe9c0");
  g.addColorStop(0.56, "#9fd6a8");
  g.addColorStop(1, "#7cbf86");
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  const sy = H*0.32 - day*30;
  ctx.fillStyle="rgba(255,214,102,.35)"; ctx.beginPath(); ctx.arc(W*0.78, sy, 60, 0, 7); ctx.fill();
  ctx.fillStyle="#ffd666"; ctx.beginPath(); ctx.arc(W*0.78, sy, 34, 0, 7); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.85)";
  for (let i=0;i<4;i++){
    const cx = ((t*(9+i*3)+i*260)%(W+260))-130, cy = H*0.12+i*44;
    ctx.beginPath(); ctx.arc(cx,cy,20,0,7); ctx.arc(cx+22,cy+4,16,0,7); ctx.arc(cx-20,cy+6,14,0,7); ctx.fill();
  }
  [["#8fc79a",0.62,36,0.006,8],["#7cbf86",0.72,28,0.009,14],["#63b573",0.84,22,0.013,22]].forEach(([col,base,amp,f,sp])=>{
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,H);
    for (let x=0;x<=W;x+=8) ctx.lineTo(x, H*base + Math.sin(x*f + t*sp*0.02)*amp);
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
  });
  const lx = ((t*70)%(W+180))-90;
  const ly = H*0.84 + Math.sin(lx*0.013 + t*22*0.02)*22 - 16;
  drawEmojiC(ctx,"🚚", lx, ly, 30);
  for (let i=0;i<5;i++){
    const p = ((t*0.06)+i*0.2)%1;
    drawEmojiC(ctx,"📦", W*0.1+i*W*0.19+Math.sin(t+i)*12, H*(1-p), 16+8*Math.sin(i));
  }
  if (Math.floor(t*4)%3===0) drawEmojiC(ctx,"✨", (t*137)%W, (t*89)%(H*0.5), 12);
  // floating feature words
  const _TW=["Supply Chain","Village Life","Real Ale","Fish the Pier","Craft & Trade","Featherstone Valley","Ore & Steel","Friends & Pets","Seasonal Harvest","Notice Board","Evening at the Pub","Your Own Cottage"];
  ctx.font="bold 9px 'IBM Plex Mono',monospace"; ctx.textAlign="center";
  for(let _wi=0;_wi<_TW.length;_wi++){
    const _wt=((t*0.042+_wi/_TW.length)%1);
    const _wx=((_wi*137.508)%1)*(W-120)+60;
    const _wy=H*(1-_wt)-8;
    const _a=_wt<0.12?_wt/0.12:_wt>0.78?(1-_wt)/0.22:1;
    ctx.globalAlpha=Math.min(1,_a*0.75);
    ctx.fillStyle="#453423"; ctx.fillText(_TW[_wi],_wx,_wy);
  }
  ctx.globalAlpha=1; ctx.textAlign="left";
}
const _STOLEN_FOODS = ["mushroom","berries","wild_herb","berry_jam","herb_tea","sardine"];
function _arrestPlayer(){
  const _fine = Math.floor(S.coins * 0.20);
  S.coins = Math.max(0, S.coins - _fine);
  const _dur = DAY_DURATION_MS * (S.stolen ? 2 : 1);
  S.caught = { active: true, cellUntil: Date.now() + _dur, maxTime: _dur };
  S.trespass = { active: false, homeId: null };
  S.stolen = false;
  S.fleeUntil = 0;
  S.tab = "police_cell";
  IP.x = icanvasW()/2; IP.y = icanvasH() - 60;
  IP.tx = null; IP.ty = null; IP.moving = false; IP.dir = "down";
  CHAT_NPC = null;
  if (_fine > 0) log(`🚔 Arrested! ${fmt(_fine)} coin fine. Sentence: ${S.caught.maxTime === DAY_DURATION_MS ? "24" : "48"} game-hours.`, "bad");
  else log(`🚔 Arrested! Sentence: ${S.caught.maxTime === DAY_DURATION_MS ? "24" : "48"} game-hours.`, "bad");
  toast(`🚔 YOU'VE BEEN NICKED! ${_fine > 0 ? `${fmt(_fine)} coins fined.` : ""}`);
  renderNav(); renderMain(); save();
}
function villageFrame(ts){
  pollGamepad();
  updateClock();
  if (S.drunkUntil){ const _isDrunk=Date.now()<S.drunkUntil; document.body.classList.toggle("game-drunk",_isDrunk); if(!_isDrunk) S.drunkUntil=0; } else document.body.classList.remove("game-drunk");
  const t = ts/1000;
  const dt = Math.min(0.05, vLastT ? t-vLastT : 0.016);
  vLastT = t;
  const tl = document.getElementById("title");
  if (tl && tl.style.display !== "none"){
    drawTitleFX(t);
  } else if (S.tab==="village"){
    moveActor(VP, dt, 104 * bikeSpeedMult());
    // degrade bike condition when riding (faster in forest)
    if (S.bike?.equipped && VP.moving){
      const _onF = tileAt(VP.x, VP.y) === 'F';
      S.bike.condition = Math.max(0, (S.bike.condition ?? 100) - dt * (_onF ? 0.17 : 0.083));
    }
    if (VP.y > 18.2*TILE && (!globalThis._swimAt || performance.now() - globalThis._swimAt > 6000)){
      globalThis._swimAt = performance.now();
      toast(`🌊 ${pName()}: "I can't swim… yet."`);
      log(`🌊 ${pName()} eyes the water: "I can't swim… yet."`);
    }
    // walk-in building entry — fires when VP feet reach door bottom edge
    if (VP.enterCooldown > 0) VP.enterCooldown--;
    else if (!VP.pending) {
      for (const o of V_OBJECTS) {
        if (o.kind !== "bld") continue;
        const r = objRect(o);
        const doorX = r.x + r.w/2, doorY = r.y + r.h;
        if (Math.abs(VP.x - doorX) < TILE*0.7 && VP.y > doorY - TILE*0.6 && VP.y < doorY + TILE*0.6) {
          interactObj(o); VP.enterCooldown = 90; break;
        }
      }
    }
    // auto-cancel action when player walks away from station
    if (S.action && VP.moving) {
      const sp = stationPos(S.action.skill, S.action.id);
      if (sp && Math.hypot(VP.x-sp.x, VP.y-sp.y) > 1.5*TILE) { S.action = null; renderNav(); }
    }
    if (VP.moving && t-lastDust > 0.16){
      lastDust = t;
      DUST.push({ x:VP.x+(Math.random()*6-3), y:VP.y+9, born:Date.now() });
      if (DUST.length > 14) DUST.shift();
    }
    updateWanderers(dt);
    updateBeachBirds();
    updateVillagers(dt);
    updateChildren(dt);
    updateNightWildlife(dt);
    if (VP.pending){
      const o = VP.pending;
      const ap = o.kind==="npc" ? {x:o.w.x, y:o.w.y+18} : objApproach(o);
      if (Math.hypot(VP.x-ap.x, VP.y-ap.y) < 46 && VP.tx===null){
        VP.pending=null; interactObj(o);
      } else if (VP.tx===null && !VP.moving){ VP.pending=null; }
    }
    drawVillage(t);
  } else if (INTERIOR_TABS.has(S.tab)){
    // auto-walk to the active workstation when the action changes, so the player
    // visibly moves to the NEW activity instead of working the old spot
    if (S.action && STATION_DEFS[S.tab]){
      const _ast = STATION_DEFS[S.tab].find(s=>s.skill===S.action.skill && s.id===S.action.id);
      if (_ast && S.action.id !== _lastIActionId){
        IP.tx = _ast.fx*icanvasW(); IP.ty = _ast.fy*icanvasH() + 18; IP.moving = true; _lastIActionId = S.action.id;
      }
    } else if (!S.action) _lastIActionId = null;
    moveActor(IP, dt, 80, true);
    // push IP out of interior prop collision rects
    const iCols = S.tab==="home" ? homeColsCached(S.roomObjId) : INTERIOR_COLS[S.tab];
    if (iCols){
      const half=6, feet=6;
      for (const c of iCols){
        const px=IP.x, cy=IP.y+feet;
        if (px+half>c.x && px-half<c.x+c.w && cy>c.y && cy<c.y+c.h){
          const dL=(px+half)-c.x, dR=(c.x+c.w)-(px-half), dU=cy-c.y, dD=(c.y+c.h)-cy;
          const mn=Math.min(dL,dR,dU,dD);
          if(mn===dL) IP.x=c.x-half;
          else if(mn===dR) IP.x=c.x+c.w+half;
          else if(mn===dU) IP.y=c.y-feet;
          else IP.y=c.y+c.h-feet;
        }
      }
    }
    // exit building if player walks to the bottom door
    const _cellLocked = S.tab==="police_cell" && S.caught?.active && Date.now() < S.caught.cellUntil;
    if (IP.y > icanvasH() - 18 && !_cellLocked) {
      IP.tx = null; IP.ty = null; IP.moving = false;
      CHAT_NPC = null;
      // clear trespass on legitimate exit
      if (S.trespass?.active){ S.trespass = { active: false, homeId: null }; S.fleeUntil = 0; }
      if (S.caught?.active && !_cellLocked){ S.caught = { active: false, cellUntil: 0, maxTime: 0 }; }
      VP.enterCooldown = 90;
      S.tab = "village"; renderNav(); renderMain();
    } else {
      drawInterior(t);
      // trespass: check NPC proximity at night + flee timer
      if (S.tab==="home" && S.trespass?.active){
        const _now2 = Date.now();
        if (S.fleeUntil > 0 && _now2 > S.fleeUntil){
          _arrestPlayer();
        } else if (S.fleeUntil === 0 && isNight()){
          // bed zone is top-right of home interior
          const _bedX = icanvasW()*0.75, _bedY = 70;
          if (Math.hypot(IP.x-_bedX, IP.y-_bedY) < 48){
            const _hv = VILLAGERS.find(v => v.homeId === S.roomObjId);
            const _hvn = _hv ? _hv.n : "Someone";
            S.fleeUntil = Date.now() + 10000;
            toast(`😱 ${_hvn}: "GET OUT OR I'M CALLING THE POLICE! 🚨"`);
            log(`🚨 ${_hvn} woke up! 10 seconds to flee!`, "bad");
            renderMain();
          }
        }
      }
    }
  } else {
    drawInterior(t);
  }
  requestAnimationFrame(villageFrame);
}
function setupVillage(){
  const cv = document.getElementById("village");
  if (cv) cv.onclick = villageClick;
}
function interiorClick(e){
  const cv = document.getElementById("interior");
  if (!cv) return;
  const rect = cv.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (icanvasW() / rect.width);
  const cy = (e.clientY - rect.top) * (icanvasH() / rect.height);
  // talk to the resident NPC of this interior (tap them to chat, tap again to continue)
  {
    const _res = INTERIOR_RESIDENTS[S.tab];
    if (_res){
      if (Math.hypot(cx-_res.x, cy-_res.y) < (_res.r || 34)){
        if (_intChat && _intChat.name === _res.name) _intChat.idx = (_intChat.idx+1) % _res.lines.length;
        else { _intChat = { name:_res.name, lines:_res.lines, idx:0 }; if (!S.npcMet) S.npcMet = true; }
        return;
      }
      if (_intChat){ _intChat = null; }   // tapped away — dismiss, then allow the move below
    }
  }
  // fishing: click anywhere on the water to cast your line there
  if (S.tab === "fishing" && cy < icanvasH()*0.44){
    _fishSpot = { x: Math.max(16, Math.min(icanvasW()-16, cx)), y: Math.max(12, cy) };
    _fishAnchor = { x: IP.x, y: IP.y };
    _fishCastT = (typeof performance!=="undefined"?performance.now():Date.now());
    if (!(S.action?.skill === "fishing")){ S.action = { skill:"fishing", id:"fish", progress:0 }; log("▶ Cast your line."); }
    _fishActiveId = "fish";
    renderNav(); save();
    return;
  }
  // check if click hits a station node
  const stations = STATION_DEFS[S.tab];
  if (stations){
    const cw = icanvasW(), ch = icanvasH();
    for (const st of stations){
      const sx = st.fx * cw, sy = st.fy * ch;
      if (Math.abs(cx-sx) < 28 && Math.abs(cy-sy) < 28){
        const locked = skillLvl(st.skill) < (findAction(st.skill, st.id)?.lvl || 0);
        if (locked){ toast("Level too low."); return; }
        if (S.action?.skill===st.skill && S.action?.id===st.id){
          S.action = null;
        } else {
          const act = findAction(st.skill, st.id);
          if (act?.in && !canAfford(act)){ toast("Not enough materials."); return; }
          S.action = { skill:st.skill, id:st.id, progress:0 };
          log(`▶ Started: ${act?.n || st.lbl}`);
        }
        renderNav(); save();
        return;
      }
    }
  }
  // dismiss chat on tap outside (cycle quip first so next open shows a fresh line)
  if (CHAT_NPC){ CHAT_NPC.quipIdx = (CHAT_NPC.quipIdx+1) % CHAT_NPC.quips.length; CHAT_NPC = null; return; }
  // check if click hits an interior villager (use their actual wander position)
  const tabWorkers = VILLAGER_STATE.filter(v => v.indoor && v.workTab===S.tab);
  const cw2 = icanvasW(), ch2 = icanvasH();
  for (let i=0; i<tabWorkers.length; i++){
    const vx = tabWorkers[i].iwx || (i+1)/(tabWorkers.length+1)*cw2;
    const vy = tabWorkers[i].iwy || ch2*0.58;
    if (Math.hypot(cx-vx, cy-vy) < 26){ CHAT_NPC = tabWorkers[i]; return; }
  }
  IP.tx = Math.max(16, Math.min(icanvasW()-16, cx));
  IP.ty = Math.max(24, Math.min(icanvasH()-16, cy));
}
function setupInterior(){
  const cv = document.getElementById("interior");
  if (cv) cv.onclick = interiorClick;
}

let _titlePreviewRaf = 0;
let _charPreviewRaf  = 0;
let _wizFocus: 'face'|'body' = 'body';
function _drawTitlePreview(){
  const cv = document.getElementById("title-preview") as HTMLCanvasElement;
  if (!cv || document.getElementById("title")?.style.display === "none") return;
  const ctx2 = cv.getContext("2d");
  const W2 = cv.width, H2 = cv.height, t2 = performance.now()/1000;
  // sky-grass background
  ctx2.fillStyle="#9fd6a8"; ctx2.fillRect(0,0,W2,H2);
  ctx2.fillStyle="#7cbf86"; ctx2.fillRect(0,H2*0.68,W2,H2*0.32);
  // sun
  ctx2.fillStyle="#ffd666"; ctx2.beginPath(); ctx2.arc(W2*0.82,H2*0.18,14,0,7); ctx2.fill();
  ctx2.fillStyle="rgba(255,214,102,.3)"; ctx2.beginPath(); ctx2.arc(W2*0.82,H2*0.18,22,0,7); ctx2.fill();
  // small flowers
  for(let _fi=0;_fi<4;_fi++){ ctx2.fillStyle=["#e84060","#ffd666","#f86040","#6fb7ff"][_fi]; ctx2.beginPath(); ctx2.arc(16+_fi*28,H2*0.74,4,0,7); ctx2.fill(); }
  // player character — zooms to the face for head-detail steps, walks full-body otherwise
  const _face = _wizFocus === 'face';
  const _scale = _face ? 6.6 : 3.2;
  const _cx = W2/2;
  const _cy = _face ? Math.round(H2*0.42 + 11*_scale) : H2*0.72;
  drawPerson(ctx2, _cx, _cy, plHair(), plShirt(), t2, !_face, 1, null, "down", plSkin(), plTrousers(), null, plGender()==='female', _scale, plHat(), plHatColor(), {...plOpts(), stride:2.4});
  _titlePreviewRaf = requestAnimationFrame(_drawTitlePreview);
}
// Build a fully random appearance for Quick Start (fields match the wizard).
function randomAppearance(){
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const g = Math.random() < 0.5 ? 'male' : 'female';
  const ap = Object.assign({}, DEFAULT_APPEARANCE);
  ap.gender     = g;
  ap.skin       = pick(SKIN_TONES).v;
  ap.hair       = pick(HAIR_COLOURS).v;
  ap.hairStyle  = Math.floor(Math.random()*HAIR_STYLE_LABELS.length);
  ap.eyeColor   = pick(EYE_COLOURS).v;
  ap.facialHair = g === 'female' ? 'none' : pick(FACIAL_HAIR_STYLES).v;
  ap.shirt      = pick(SHIRT_COLOURS).v;
  ap.jacket     = pick(JACKET_COLOURS).v;
  ap.trousers   = pick(TROUSER_COLOURS).v;
  ap.shoes      = pick(SHOE_COLOURS).v;
  ap.accessory  = pick(ACCESSORY_STYLES).v;
  ap.scarfColor = pick(SCARF_COLOURS).v;
  ap.hat        = pick(HAT_STYLES).v;
  ap.hatColor   = pick(HAT_COLOURS).v;
  return ap;
}
// Give keyboard focus to the game so WASD/arrows work immediately after starting.
function focusGameInput(){
  try {
    const el = document.getElementById("village") || document.getElementById("main");
    if (el){ if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1"); (el as HTMLElement).focus({ preventScroll:true }); }
    else window.focus();
  } catch(e){}
}
function showTitle(){
  const tEl = document.getElementById("title");
  tEl.style.display = "flex";
  // typewriter subtitle
  const _tagline = "A cosy supply-chain life sim · Featherstone Valley";
  const _twEl = document.getElementById("title-typewriter") as HTMLElement;
  const _btnStart = document.getElementById("btn-start") as HTMLButtonElement;
  _btnStart.style.display = "none";
  let _twIdx = 0;
  const _twIv = setInterval(()=>{
    _twIdx++;
    if (_twEl) _twEl.textContent = _tagline.slice(0, _twIdx);
    if (_twIdx >= _tagline.length){ clearInterval(_twIv); }  // START is shown by the wizard's final step
  }, 38);
  // character preview canvas
  cancelAnimationFrame(_titlePreviewRaf);
  _drawTitlePreview();
  // ---- Character-creation wizard (one step at a time) ----
  const _input   = document.getElementById("name-input") as HTMLInputElement;
  const _errEl   = document.getElementById("name-err") as HTMLElement;
  const _nameBlk = document.getElementById("wiz-name") as HTMLElement;
  const _stepLbl = document.getElementById("wiz-step-label") as HTMLElement;
  const _stepCnt = document.getElementById("wiz-count") as HTMLElement;
  const _optsEl  = document.getElementById("wiz-options") as HTMLElement;
  const _dotsEl  = document.getElementById("wiz-dots") as HTMLElement;
  const _backBtn = document.getElementById("wiz-back") as HTMLButtonElement;
  const _nextBtn = document.getElementById("wiz-next") as HTMLButtonElement;

  const _swHtml  = (arr, field, ap) => `<div class="cust-swatches">${arr.map(c=>`<button class="swatch${ap[field]===c.v?' sel':''}" style="background:${c.v||'rgba(120,90,60,.25)'}" data-cf="${field}" data-cv="${c.v}" title="${c.label}"></button>`).join('')}</div>`;
  const _txtHtml = (arr, field, ap) => `<div class="cust-swatches" style="flex-wrap:wrap;gap:5px">${arr.map(c=>`<button class="swatch-txt${ap[field]==c.v?' sel':''}" data-cf="${field}" data-cv="${c.v}">${c.label}</button>`).join('')}</div>`;

  const _steps: any[] = [
    { label:"Choose your character", focus:'body', kind:'gender', hint:"Pick a body type — you can change everything next." },
    { label:"Skin tone",   focus:'face', kind:'swatch', arr:SKIN_TONES,        field:'skin' },
    { label:"Hair colour", focus:'face', kind:'swatch', arr:HAIR_COLOURS,      field:'hair' },
    { label:"Hair style",  focus:'face', kind:'text',   arr:HAIR_STYLE_LABELS, field:'hairStyle' },
    { label:"Eye colour",  focus:'face', kind:'swatch', arr:EYE_COLOURS,       field:'eyeColor' },
    { label:"Facial hair", focus:'face', kind:'text',   arr:FACIAL_HAIR_STYLES,field:'facialHair', showIf:(ap)=>ap.gender!=='female' },
    { label:"Shirt",       focus:'body', kind:'swatch', arr:SHIRT_COLOURS,     field:'shirt' },
    { label:"Jacket",      focus:'body', kind:'swatch', arr:JACKET_COLOURS,    field:'jacket' },
    { label:"Trousers",    focus:'body', kind:'swatch', arr:TROUSER_COLOURS,   field:'trousers' },
    { label:"Shoes",       focus:'body', kind:'swatch', arr:SHOE_COLOURS,      field:'shoes' },
    { label:"Accessory",   focus:'body', kind:'text',   arr:ACCESSORY_STYLES,  field:'accessory',
      extra:(ap)=> ap.accessory==='scarf' ? `<div class="cust-sub">Scarf colour</div>`+_swHtml(SCARF_COLOURS,'scarfColor',ap) : '' },
    { label:"Hat",         focus:'body', kind:'text',   arr:HAT_STYLES,        field:'hat',
      extra:(ap)=> (ap.hat && ap.hat!=='none') ? `<div class="cust-sub">Hat colour</div>`+_swHtml(HAT_COLOURS,'hatColor',ap) : '' },
    { label:"Your name",   focus:'body', kind:'name' },
  ];

  let _wizStep = 0;
  const _visibleSteps = () => _steps.filter(s => !s.showIf || s.showIf(S.appearance));

  function _renderWizard(){
    const steps = _visibleSteps();
    _wizStep = Math.max(0, Math.min(_wizStep, steps.length-1));
    const step = steps[_wizStep];
    const ap = S.appearance;
    _wizFocus = step.focus;
    _stepLbl.textContent = step.label;
    _stepCnt.textContent = `${_wizStep+1} / ${steps.length}`;
    let html = "";
    if (step.kind==='gender'){
      html = `<div class="cust-swatches">`
        + `<button class="swatch-txt${ap.gender==='male'?' sel':''}" data-cf="gender" data-cv="male">♂ Male</button>`
        + `<button class="swatch-txt${ap.gender==='female'?' sel':''}" data-cf="gender" data-cv="female">♀ Female</button></div>`;
    } else if (step.kind==='swatch'){ html = _swHtml(step.arr, step.field, ap); }
    else if (step.kind==='text'){ html = _txtHtml(step.arr, step.field, ap); }
    if (step.extra) html += step.extra(ap);
    if (step.hint) html += `<div class="wiz-hint">${step.hint}</div>`;
    _optsEl.innerHTML = html;
    _optsEl.style.display  = step.kind==='name' ? 'none' : '';
    _nameBlk.style.display = step.kind==='name' ? ''     : 'none';
    _dotsEl.innerHTML = steps.map((_,i)=>`<span class="wiz-dot${i===_wizStep?' on':''}${i<_wizStep?' done':''}"></span>`).join('');
    _backBtn.style.visibility = _wizStep===0 ? 'hidden' : 'visible';
    const _last = _wizStep === steps.length-1;
    _nextBtn.style.display = _last ? 'none' : '';
    _btnStart.style.display = _last ? '' : 'none';
    if (_last) setTimeout(()=>{ try{ _input.focus(); }catch(e){} }, 30);
    _optsEl.querySelectorAll("[data-cf]").forEach(b=>{
      (b as HTMLElement).onclick = ()=>{
        const _f=(b as HTMLElement).dataset.cf!, _v=(b as HTMLElement).dataset.cv!;
        S.appearance[_f] = _f==='hairStyle' ? parseInt(_v) : _v;
        _renderWizard();
      };
    });
  }
  _backBtn.onclick = ()=>{ if(_wizStep>0){ _wizStep--; _renderWizard(); } };
  _nextBtn.onclick = ()=>{ if(_wizStep < _visibleSteps().length-1){ _wizStep++; _renderWizard(); } };
  _renderWizard();

  document.getElementById("btn-preview").onclick = () => { MUSIC.unlocked = true; MUSIC.play("valley"); };
  // shared launch — validated name in, game begins. Used by START and Quick Start.
  const _launch = (name, delay) => {
    _errEl.style.display = "none";
    S.playerName = name;
    cancelAnimationFrame(_titlePreviewRaf);
    const badge = document.getElementById("name-badge");
    const badgeVal = document.getElementById("badge-name-val");
    if (badge && badgeVal){ badgeVal.textContent = name.toUpperCase(); badge.classList.add("show"); }
    setTimeout(()=>{
      tEl.style.display = "none";
      MUSIC.unlocked = true; updateMusicZone();
      const stat = document.getElementById("hud-name-stat");
      if (stat){ stat.classList.add("named","named-anim"); setTimeout(()=>stat.classList.remove("named-anim"),500); }
      log(`❄️ Frost: "Welcome to Featherstone Valley, <b>${pName()}</b>! Follow my lead and you'll be running this valley by teatime."`, "good");
      updateHud(); renderNav(); renderMain(); save();
      focusGameInput();   // Task 3: keyboard works the moment you land in the village
    }, delay);
  };
  _btnStart.onclick = () => {
    const _n = _input.value.trim().replace(/[<>"'&]/g,"").slice(0,16);
    if (!_n){
      _errEl.style.display = "block";
      _input.classList.remove("input-shake");
      void _input.offsetWidth; // reflow to restart animation
      _input.classList.add("input-shake");
      setTimeout(()=>_input.classList.remove("input-shake"), 450);
      return;
    }
    _launch(_n, 1100);
  };
  // Quick Start — a random character and a default name, straight into the game.
  const _btnQuick = document.getElementById("btn-quick") as HTMLButtonElement;
  if (_btnQuick) _btnQuick.onclick = () => {
    S.appearance = randomAppearance();
    const _n = _input.value.trim().replace(/[<>"'&]/g,"").slice(0,16) || "Founder";
    toast(`⚡ Quick start! Welcome, ${_n}.`);
    _launch(_n, 500);
  };
  _input.onkeydown = e => { if (e.key==="Enter") _btnStart.click(); };
  const box = tEl.querySelector(".box") as HTMLElement;
  tEl.onmousemove = (e) => {
    const r = tEl.getBoundingClientRect();
    const dx=(e.clientX-(r.left+r.width/2))/r.width, dy=(e.clientY-(r.top+r.height/2))/r.height;
    box.style.transform = `translate(${(dx*8).toFixed(1)}px,${(dy*5).toFixed(1)}px)`;
  };
  tEl.onmouseleave = () => { box.style.transform = ""; };
}
if (typeof document !== 'undefined'){
  const _st = document.createElement('style');
  _st.textContent = `
  .village-wrap{display:flex;flex-direction:column;gap:14px}
  @media(min-width:980px){.village-wrap{flex-direction:row;align-items:flex-start}.village-canvas-panel{flex:1;min-width:0}.village-sidebar{flex:0 0 250px}}
  .village-canvas-rel{position:relative}
  #village-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .vlbl{position:absolute;transform:translate(-50%,-100%);background:rgba(255,248,230,.96);border:2px solid #8c6947;color:#453423;font:600 11px/1.3 'IBM Plex Mono',monospace;padding:2px 8px;border-radius:4px;white-space:nowrap;box-shadow:2px 2px 0 rgba(70,50,30,.25);pointer-events:none}
  .int-canvas-wrap .ilbl{position:absolute;transform:translate(-50%,0);background:rgba(69,52,35,.92);color:#fff8e6;font:600 11px/1.3 'IBM Plex Mono',monospace;padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;box-shadow:0 2px 0 rgba(0,0,0,.25)}
  .ilbl-lock{color:#ffd666}
  .int-canvas-wrap .ilbl-exit{position:absolute;left:50%;bottom:3px;transform:translateX(-50%);background:rgba(176,60,50,.95);color:#fff8e6;font:700 11px 'IBM Plex Mono',monospace;padding:3px 10px;border-radius:5px;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.4);animation:exitPulse 1.8s ease-in-out infinite}
  @keyframes exitPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,90,70,.55)}50%{box-shadow:0 0 0 5px rgba(232,90,70,0)}}
  .firstrun-hint{position:absolute;top:28px;left:50%;transform:translateX(-50%);max-width:94%;background:rgba(42,26,10,.93);color:#fff8e6;border:2px solid #e8961e;border-radius:8px;padding:7px 14px;font:600 12px/1.45 'IBM Plex Mono',monospace;text-align:center;pointer-events:none;box-shadow:0 3px 10px rgba(0,0,0,.45);animation:frPulse 2.2s ease-in-out infinite}
  .firstrun-hint b{color:#ffd666}
  @keyframes frPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,150,30,.5)}50%{box-shadow:0 0 0 6px rgba(232,150,30,0)}}
  .fullscreen-mode .firstrun-hint{font-size:15px;padding:9px 18px}
  .quest-rock{position:absolute;transform:translate(-50%,-140%);background:rgba(42,90,30,.96);color:#fff8e6;border:2px solid #ffd666;border-radius:8px;padding:3px 9px;font:700 11px 'IBM Plex Mono',monospace;white-space:nowrap;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.45);animation:qrBob 1.2s ease-in-out infinite}
  @keyframes qrBob{0%,100%{transform:translate(-50%,-140%)}50%{transform:translate(-50%,-172%)}}
  .quest-arrow{position:absolute;color:#ffd666;font-size:26px;pointer-events:none;text-shadow:0 2px 5px rgba(0,0,0,.7);animation:qaPulse 1s ease-in-out infinite}
  @keyframes qaPulse{0%,100%{opacity:.65}50%{opacity:1}}
  .quest-arrow-lbl{position:absolute;transform:translate(-50%,0);color:#ffd666;font:700 10px 'IBM Plex Mono',monospace;text-shadow:0 1px 3px rgba(0,0,0,.8);pointer-events:none;white-space:nowrap}
  .fullscreen-mode .quest-rock{font-size:14px}.fullscreen-mode .quest-arrow{font-size:32px}
  @media (prefers-reduced-motion: reduce){.firstrun-hint,.int-canvas-wrap .ilbl-exit,.quest-rock,.quest-arrow{animation:none}}
  .vhint{text-align:center}
  .btn.quickstart{background:#2a6a3a;color:#fff8e6;border:2px solid #1a4a28;font-size:13px;padding:9px 18px}
  .btn.quickstart:hover{background:#348046}
  @media(max-width:560px){.btn.quickstart{font-size:14px;padding:11px 18px}}
  .int-layout{display:flex;flex-direction:column;gap:14px;isolation:isolate}
  .int-left{position:relative;z-index:2}
  .int-left .int-canvas-wrap{overflow:hidden;border-radius:4px}
  .int-left canvas{position:relative;z-index:2;display:block}
  .int-right{position:relative;z-index:1}
  @media(min-width:1080px){
    .int-layout{flex-direction:row;align-items:flex-start}
    .int-left{flex:0 0 auto;width:min(660px,46%)}
    .int-left .int-canvas-wrap{margin:0}
    .int-right{flex:1;min-width:0}
  }
  .int-right .panel{margin-bottom:14px}
  .ilbl-room{position:absolute;left:6px;bottom:6px;background:rgba(69,52,35,.9);color:#ffd666;font:700 11px 'IBM Plex Mono',monospace;padding:2px 9px;border-radius:4px;pointer-events:none;letter-spacing:.5px}
  #hud-time{font:700 12px 'IBM Plex Mono',monospace;color:#e8961e;background:rgba(69,52,35,.08);border:2px solid #8c694733;border-radius:6px;padding:4px 9px;white-space:nowrap}
  .speech-dock{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(255,248,230,.97);border:2px solid #8c6947;color:#453423;font:600 11px/1.5 'IBM Plex Mono',monospace;padding:4px 14px;border-radius:6px;white-space:nowrap;box-shadow:2px 2px 0 rgba(70,50,30,.25);pointer-events:none;max-width:80%;text-align:center}
  @keyframes drunk-sway{0%{transform:rotate(0deg)}20%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}80%{transform:rotate(-3deg)}100%{transform:rotate(0deg)}}
  body.game-drunk #village,body.game-drunk #interior{animation:drunk-sway 1.6s ease-in-out infinite;transform-origin:center center;filter:blur(.9px) saturate(1.6) brightness(1.08)}
  `;
  document.head.appendChild(_st);
}
let _lastClock = "";
function updateClock(){
  let el = document.getElementById("hud-time");
  if (!el){
    const host = document.querySelector(".stats") || document.querySelector("header");
    if (!host) return;
    el = document.createElement("div");
    el.id = "hud-time";
    host.appendChild(el);
  }
  const h = gameHour(), hh = Math.floor(h), mm = Math.floor((h-hh)*60);
  const hh12 = hh%12||12, ampm = hh<12?"AM":"PM";
  const _bikePrefix = S.bike?.equipped ? "🚲 " : "";
  const str = `${_bikePrefix}${isNight()?"🌙":"☀️"} ${hh12}:${String(mm).padStart(2,"0")} ${ampm}`;
  if (str !== _lastClock){
    _lastClock = str;
    el.textContent = str;
    const vc = document.getElementById("village-clock");
    if (vc) vc.textContent = str;
  }
}
const SAVE_KEY = "buyrworld_game_save_v1";
const OFFLINE_CAP_MS = 8 * 3600 * 1000;

function freshState(){
  return {
    v:1, coins:0, items:{}, lastSeen:Date.now(), market:null, econ:{ pressure:{}, news:[], phaseId:null }, netWorth:{ history:[], last:0 }, automatons:{}, grid:{ tier:0 }, announcedDistricts:[], seenTips:{}, journey:{ claimed:[], notified:"" },
    playerName:"", settings:{ music:true, vol:"med" }, prod:{}, tut:{ step:0, done:false }, ach:{}, unlockedTabs:{}, firsts:{}, npcMet:false, school:{ raised:0, notifiedTier:0 }, legacy:0,
    skills:{ mining:{xp:0}, steelworks:{xp:0}, manufacturing:{xp:0}, logistics:{xp:0}, trading:{xp:0}, woodcutting:{xp:0}, fishing:{xp:0}, foraging:{xp:0}, crafting:{xp:0} },
    treeRespawn:{},
    upgrades:{}, pets:{ owned:[], active:null },
    counters:{ actions:0, contracts:0, coinsEarned:0, trades:0, raffleWins:0 },
    action:null,
    contracts:[],
    tab:"village",
    appearance: Object.assign({}, DEFAULT_APPEARANCE),
    worldEvent: null, nextEventAt: Date.now() + 3*60*1000,
    caffBuff: 0,
    mealBuff: null,
    homeTier: 0,
    deliveryReq: null, nextDeliveryAt: Date.now() + 5*60*1000,
    exchange: { positions:[] },
    degrees: [], studying: null,
    interestAt: Date.now() + 30*60*1000,
    retail: { slots:[{itemId:null,qty:0},{itemId:null,qty:0},{itemId:null,qty:0}], lastSale:0, dailySold:0, lastReset:"" },
    dailyReward: { lastDate:"" },
    properties: [],
    rentAt: Date.now() + 5*60*1000,
    loans: [],
    seNotified: "",
    bike: { owned:false, equipped:false, color:'#e84040', wheels:'standard', hasLight:false, condition:100 },
    friendships: {},
    noticeBoard: { quests:[], lastRefresh:0 },
    harbour: { boatTrips:0 },
    schoolBuff: 0,
    beautification: [],
    prestigeIncomeAt: 0,
    villagerRequests: {},
    perks: {},
    dailyChallenge: null,
    garden: [null, null, null, null],
    keepsakes: [],
    festival: { raffleDate:"", raffleCount:0, gamesDate:"", feastId:"", attended:[] as string[], notified:"" },
    ownedFurniture: {} as Record<string,number>,
    placedFurniture: [] as {id:string; slot:number}[],
    pintBuff: 0,
    pintsTonight: 0,
    drunkUntil: 0,
    pintDate: "",
    trespass: { active: false, homeId: null as string|null },
    stolen: false,
    fleeUntil: 0,
    caught: { active: false, cellUntil: 0, maxTime: 0 },
  };
}
let S = freshState();

function storageOK(){ try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; } catch(e){ return false; } }
const HAS_LS = storageOK();
let _saveFlashUntil = 0, _lastSaveFlash = 0;
function save(){
  S.lastSeen = Date.now();
  if (HAS_LS) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      const _n = Date.now();
      if (_n - _lastSaveFlash > 5000) { _saveFlashUntil = _n + 1200; _lastSaveFlash = _n; }
    } catch(e) {}
  }
}
function load(){
  if (!HAS_LS) return false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1) {
      S = Object.assign(freshState(), parsed);
      if (!parsed.skills || !parsed.skills.trading) S.skills.trading = { xp:0 };
      if (!S.skills.woodcutting) S.skills.woodcutting = { xp:0 };
      if (!S.skills.fishing) S.skills.fishing = { xp:0 };
      if (!S.skills.foraging) S.skills.foraging = { xp:0 };
      if (!S.skills.crafting) S.skills.crafting = { xp:0 };
      if (!S.treeRespawn) S.treeRespawn = {};
      if (!S.bike) S.bike = { owned:false, equipped:false, color:'#e84040', wheels:'standard', hasLight:false, condition:100 };
      if (!S.friendships) S.friendships = {};
      if (!S.noticeBoard) S.noticeBoard = { quests:[], lastRefresh:0 };
      if (!S.harbour) S.harbour = { boatTrips:0 };
      if (!S.schoolBuff) S.schoolBuff = 0;
      if (!S.beautification) S.beautification = [];
      if (!S.prestigeIncomeAt) S.prestigeIncomeAt = 0;
      if (!S.villagerRequests) S.villagerRequests = {};
      if (!S.perks) S.perks = {};
      if (!S.seenTips) S.seenTips = {};
      if (!S.journey || !Array.isArray(S.journey.claimed)) S.journey = { claimed:[], notified:"" };
      if (!S.unlockedTabs) S.unlockedTabs = {};
      if (!S.firsts) S.firsts = {};
      if (typeof S.npcMet !== "boolean") S.npcMet = false;
      if (!S.school) S.school = { raised:0, notifiedTier:0 };
      if (typeof S.legacy !== "number") S.legacy = 0;
      if (S.dailyChallenge === undefined) S.dailyChallenge = null;
      if (!Array.isArray(S.garden)) S.garden = [null, null, null, null];
      if (!Array.isArray(S.keepsakes)) S.keepsakes = [];
      if (!S.festival) S.festival = { raffleDate:"", raffleCount:0, gamesDate:"", feastId:"", attended:[], notified:"" };
      if (!S.ownedFurniture) S.ownedFurniture = {};
      if (!Array.isArray(S.placedFurniture)) S.placedFurniture = [];
      if (S.appearance && !S.appearance.hat) S.appearance.hat = 'none';
      if (S.appearance && !S.appearance.hatColor) S.appearance.hatColor = '#2a1a0a';
      if (S.appearance && !S.appearance.gender) S.appearance.gender = 'male';
      if (S.appearance && !S.appearance.facialHair) S.appearance.facialHair = 'none';
      if (S.appearance && !S.appearance.eyeColor) S.appearance.eyeColor = '#17161a';
      if (S.appearance && !('jacket' in S.appearance)) S.appearance.jacket = '';
      if (S.appearance && !S.appearance.shoes) S.appearance.shoes = '#2a2a32';
      if (S.appearance && !S.appearance.accessory) S.appearance.accessory = 'none';
      if (S.appearance && !S.appearance.scarfColor) S.appearance.scarfColor = '#c04040';
      if (!Array.isArray(S.festival.attended)) S.festival.attended = [];
      if (!("notified" in S.festival)) S.festival.notified = "";
      if (!("raffleWins" in S.counters)) S.counters.raffleWins = 0;
      // migrate old pick tier upgrades to unified tool tiers
      if (S.upgrades.pick3){ S.upgrades.tool_gold = true; delete S.upgrades.pick1; delete S.upgrades.pick2; delete S.upgrades.pick3; }
      else if (S.upgrades.pick2){ S.upgrades.tool_iron = true; delete S.upgrades.pick1; delete S.upgrades.pick2; }
      else if (S.upgrades.pick1){ S.upgrades.tool_stone = true; delete S.upgrades.pick1; }
      if (!("settings" in parsed)) S.settings = { music:true };
      if (!("prod" in parsed)) S.prod = {};
      if (!("tut" in parsed)) S.tut = { step:99, done:true };
      if (!("ach" in parsed)) S.ach = {};
      if (!("coinsEarned" in S.counters)) S.counters.coinsEarned = 0;
      if (!("trades" in S.counters)) S.counters.trades = 0;
      if (typeof S.playerName !== "string") S.playerName = "";
      if (!parsed.appearance) S.appearance = Object.assign({}, DEFAULT_APPEARANCE);
      if (!("worldEvent" in parsed)) { S.worldEvent = null; S.nextEventAt = Date.now() + 5*60*1000; }
      if (!("caffBuff" in parsed)) S.caffBuff = 0;
      if (!("mealBuff" in parsed)) S.mealBuff = null;
      if (!("homeTier" in parsed)) S.homeTier = 0;
      if (!("deliveryReq" in parsed)) { S.deliveryReq = null; S.nextDeliveryAt = Date.now() + 5*60*1000; }
      if (!("exchange" in parsed)) S.exchange = { positions:[] };
      if (!Array.isArray(S.exchange.positions)) S.exchange.positions = [];
      if (!("degrees" in parsed)) S.degrees = [];
      if (!Array.isArray(S.degrees)) S.degrees = [];
      if (!("studying" in parsed)) S.studying = null;
      if (!("interestAt" in parsed)) S.interestAt = Date.now() + 30*60*1000;
      if (!("retail" in parsed)) S.retail = { slots:[{itemId:null,qty:0},{itemId:null,qty:0},{itemId:null,qty:0}], lastSale:0, dailySold:0, lastReset:"" };
      if (!Array.isArray(S.retail.slots)) S.retail.slots = [{itemId:null,qty:0},{itemId:null,qty:0},{itemId:null,qty:0}];
      if (!("dailyReward" in parsed)) S.dailyReward = { lastDate:"" };
      if (!("properties" in parsed)) S.properties = [];
      if (!Array.isArray(S.properties)) S.properties = [];
      if (!("rentAt" in parsed)) S.rentAt = Date.now() + 5*60*1000;
      if (!S.loans) S.loans = [];
      if (!("deliveries" in S.counters)) S.counters.deliveries = 0;
      if (!("exchangeProfits" in S.counters)) S.counters.exchangeProfits = 0;
      if (!("seNotified" in parsed)) S.seNotified = "";
      if (!("pintBuff" in parsed)) S.pintBuff = 0;
      if (!("pintsTonight" in parsed)) S.pintsTonight = 0;
      if (!("drunkUntil" in parsed)) S.drunkUntil = 0;
      if (!("pintDate" in parsed)) S.pintDate = "";
      if (!("trespass" in parsed)) S.trespass = { active: false, homeId: null };
      if (!("stolen" in parsed)) S.stolen = false;
      if (!("fleeUntil" in parsed)) S.fleeUntil = 0;
      if (!("caught" in parsed)) S.caught = { active: false, cellUntil: 0, maxTime: 0 };
      if (S.caught && !("maxTime" in S.caught)) S.caught.maxTime = S.caught.cellUntil > 0 ? DAY_DURATION_MS : 0;
      if (!("econ" in parsed) || !S.econ || !S.econ.pressure) S.econ = { pressure:{} };
      if (!("netWorth" in parsed) || !S.netWorth || !Array.isArray(S.netWorth.history)) S.netWorth = { history:[], last:0 };
      if (!("automatons" in parsed) || !S.automatons || typeof S.automatons !== "object") S.automatons = {};
      if (!("grid" in parsed) || !S.grid || typeof S.grid.tier !== "number") S.grid = { tier:0 };
      // pre-mark already-unlocked gated districts so returning players aren't re-notified
      if (!("announcedDistricts" in parsed) || !Array.isArray(S.announcedDistricts))
        S.announcedDistricts = DISTRICTS.filter(d => d.unlock.type==='level' && isDistrictOpen(d, totalLvl())).map(d => d.id);
      return true;
    }
  } catch(e){}
  return false;
}

const $ = sel => document.querySelector(sel);
function fmt(n){ return n >= 1e6 ? (n/1e6).toFixed(2)+"M" : n >= 1e4 ? (n/1e3).toFixed(1)+"k" : Math.floor(n).toLocaleString(); }
function skillLvl(k){ return levelFromXp(S.skills[k].xp); }
function totalLvl(){ return Object.keys(S.skills).reduce((a,k)=>a+skillLvl(k),0); }
function itemCount(id){ return S.items[id] || 0; }
function addItem(id, q){ S.items[id] = (S.items[id]||0) + q; }
function findAction(skill, id){ return SKILLS[skill].actions.find(a=>a.id===id); }

// Active meal-buff multiplier for a given kind (1 when no matching buff is active).
// speed buffs are <1 (faster); xp/sell buffs are >1 (bonus).
function mealBuffMult(kind){
  const b = S.mealBuff;
  return (b && b.kind === kind && Date.now() < b.until) ? b.mult : 1;
}
function speedMult(skill){
  let m = 1;
  UPGRADES.forEach(u => { if (u.skill===skill && u.mult && S.upgrades[u.id]) m = Math.min(m, u.mult); });
  // Tool tier upgrades apply to pick/axe/rod skills
  if (skill==="mining" || skill==="woodcutting" || skill==="fishing"){
    UPGRADES.forEach(u => { if (u.skill==="tools" && u.mult && S.upgrades[u.id]) m = Math.min(m, u.mult); });
  }
  const pet = PETS.find(p=>p.id===S.pets.active);
  if (pet){
    if (pet.id==="forklift_fox" && skill==="mining") m *= 0.88;
    if (pet.id==="drone_owl" && skill==="manufacturing") m *= 0.88;
  }
  if (S.caffBuff && Date.now() < S.caffBuff) m *= 0.80;
  if (S.pintBuff && Date.now() < S.pintBuff) m *= 0.90;
  if (S.danceBuff && Date.now() < S.danceBuff) m *= 0.85;
  m *= mealBuffMult('speed');   // cooking: a "well fed" speed buff from an eaten meal
  m *= autoSpeedMult(skill, S.automatons?.[skill]);   // robotics: assigned speed automaton
  m *= (1 - gridBonus(S.grid?.tier || 0));            // energy: town-wide power-grid efficiency
  const _sb = skillSpeedBonus(skill);
  if (_sb > 0) m *= (1 - _sb);
  const _kb = keepsakeSpeedBonus(skill);
  if (_kb > 0) m *= (1 - _kb);
  return Math.max(0.20, m);
}
function updateBeachBirds(){
  for (const b of BEACH_BIRDS){
    if (b.state==="sit"){
      if (Math.hypot(VP.x - b.x, VP.y - b.y) < 3*TILE){
        // dive toward sea (south) when player approaches
        b.state="fly"; b.vx=(Math.random()-0.5)*1.2; b.vy=2.8+Math.random();
      }
    } else {
      b.x += b.vx*1.4; b.y += b.vy*1.4; b.vx*=0.99;
      // landing from fly-in (vy<0 coming down from above)
      if (b.vy<0 && b.y >= (17.1+NORTH_EXT)*TILE){
        if (Math.hypot(VP.x-b.x, VP.y-b.y)>3*TILE){ b.vy=0; b.vx=0; b.state="sit"; b.y=(17.1+NORTH_EXT)*TILE+Math.random()*0.7*TILE; }
        else { b.vy=-2; }
      }
      // flew into sea or off map — respawn on a far sand spot
      if (b.y > (20+NORTH_EXT)*TILE || b.x < -TILE || b.x > (VCOLS+1)*TILE){
        let nx=0,ny=0,tr=0;
        do{ nx=(3+Math.floor(Math.random()*42))*TILE; ny=(17.1+NORTH_EXT+Math.random()*0.8)*TILE; tr++; }
        while(Math.hypot(VP.x-nx,VP.y-ny)<6*TILE && tr<20);
        b.x=nx; b.y=ny; b.vx=0; b.vy=0; b.state="sit";
      }
    }
  }
  // occasionally send one bird gliding in from the sky (vy>0 going down to land)
  if (Math.random() < 0.0003){
    const b = BEACH_BIRDS[Math.floor(Math.random()*BEACH_BIRDS.length)];
    if (b.state==="sit"){
      let nx=0,tr=0;
      do{ nx=(3+Math.floor(Math.random()*42))*TILE; tr++; } while(Math.hypot(VP.x-nx,VP.y-(17+NORTH_EXT)*TILE)<6*TILE && tr<20);
      b.x=nx; b.y=(13+NORTH_EXT)*TILE; b.vx=(Math.random()-0.5)*1.5; b.vy=-2; b.state="fly";
    }
  }
}
function updateFestivalNotification(){
  const _fst = isFestivalActive();
  if (!S.festival) return;
  if (_fst){
    const _fKey = _fst.season + new Date().getFullYear();
    if (S.festival.notified !== _fKey){
      S.festival.notified = _fKey;
      if (!S.festival.attended.includes(_fst.season)) S.festival.attended.push(_fst.season);
      toast(`🎪 The ${_fst.n} has begun! ${daysLeftInFestival()} days of double friendship XP!`);
      log(`🎪 <b>${_fst.n}</b> is on in Featherstone! Visit the Seasonal Market for festival activities.`, "good");
      achCheck(); save();
    }
  }
}
function updateWorldEvents(){
  const _now = Date.now();
  // Seasonal events override random ones for the whole calendar month
  const _m = new Date().getMonth();
  const _se = SEASONAL_EVENTS.find(e => e.months.includes(_m));
  if (_se){
    const _mEnd = new Date(); _mEnd.setMonth(_mEnd.getMonth()+1, 1); _mEnd.setHours(0,0,0,0);
    if (!S.worldEvent || S.worldEvent.id !== _se.id){
      S.worldEvent = { id:_se.id, endsAt:_mEnd.getTime(), seasonal:true };
      S.nextEventAt = _mEnd.getTime();
      if (S.seNotified !== _se.id){
        S.seNotified = _se.id;
        _tickerX = VIEW_W;
        toast("🎉 " + _se.n + " — special prices this month!");
        log("🎉 <b>" + _se.n + "</b> — " + _se.msg, "good");
        if (S.tab==="trade") renderMain();
      }
    } else {
      S.worldEvent.endsAt = _mEnd.getTime(); // stay refreshed through month end
    }
    return;
  }
  // Normal random event logic (spring months only, roughly)
  if (S.worldEvent && !S.worldEvent.seasonal && _now > S.worldEvent.endsAt){
    const _ev = WORLD_EVENTS.find(e=>e.id===S.worldEvent.id);
    log("📰 Market: the " + (_ev ? _ev.n : "event") + " has ended. Prices normalising.");
    S.worldEvent = null;
    S.nextEventAt = _now + (8+Math.random()*20)*60*1000;
    if (S.tab==="trade") renderMain();
  }
  if (!S.worldEvent && _now > S.nextEventAt){
    const _ev = WORLD_EVENTS[Math.floor(Math.random()*WORLD_EVENTS.length)];
    const _dur = (5+Math.random()*15)*60*1000;
    S.worldEvent = { id:_ev.id, endsAt:_now+_dur };
    S.nextEventAt = _now + _dur + (8+Math.random()*20)*60*1000;
    _tickerX = VIEW_W;
    toast("📰 " + _ev.n + ": " + _ev.msg);
    log("📰 World event: <b>" + _ev.n + "</b> — " + _ev.msg, "good");
    if (S.tab==="trade") renderMain();
  }
}
function updateWeather(){
  const _now = Date.now();
  if (_weather.until === 0){
    _weather.until = _now + (8+Math.random()*15)*60*1000;
  } else if (_now > _weather.until){
    const _prev = _weather.type;
    _weather.type = pickWeather(getSeason());
    _weather.until = _now + weatherDuration(_weather.type);
    const _wi = WEATHER_INFO[_weather.type];
    if (_weather.type !== _prev && _wi?.toast) toast(`${_wi.ic} ${_wi.toast}`);
    else if (_weather.type !== _prev && (_prev==="rain"||_prev==="fog")) toast("☀️ The weather clears over the valley.");
  }
}
function updateDeliveries(){
  const _now = Date.now();
  if (S.deliveryReq){
    const _minsLeft = (S.deliveryReq.expiresAt - _now) / 60000;
    if (!S.deliveryReq.warned && _minsLeft <= 5 && _minsLeft > 0){
      S.deliveryReq.warned = true;
      const _dv = VILLAGERS.find(v => v.id === S.deliveryReq.npcId);
      toast(`⏰ ${_dv ? _dv.n : "Villager"} needs their delivery in ${Math.ceil(_minsLeft)} min!`);
    }
    if (_now > S.deliveryReq.expiresAt){
      const _dv = VILLAGERS.find(v => v.id === S.deliveryReq.npcId);
      toast(`❌ ${_dv ? _dv.n : "Villager"}'s request expired — they found another supplier.`);
      log("📬 " + (_dv ? _dv.n : "Villager") + "'s delivery request expired — they found another supplier.", "dim");
      S.deliveryReq = null;
      S.nextDeliveryAt = _now + 30*60*1000;
    }
  }
  if (!S.deliveryReq && _now > (S.nextDeliveryAt||0)){
    // ask for something the player has actually made before (so it's fulfillable);
    // fall back to the full pool only if they've produced nothing yet.
    const _made = DELIVERY_POOL.filter(id => (S.prod?.[id]||0) > 0);
    const _src = _made.length ? _made : DELIVERY_POOL;
    const _it = _src[Math.floor(Math.random()*_src.length)];
    const _qty = 1 + Math.floor(Math.random()*4);
    const _reward = Math.round(ITEMS[_it].v * _qty * (1.6 + Math.random()*0.8));
    const _vi = Math.floor(Math.random()*VILLAGERS.length);
    const _dv = VILLAGERS[_vi];
    S.deliveryReq = { npcId:_dv.id, itemId:_it, qty:_qty, reward:_reward, expiresAt:_now+20*60*1000 };
    S.nextDeliveryAt = _now + _reward; // placeholder; real value set on delivery or expiry
    toast("📬 " + _dv.n + " needs " + _qty + "× " + ITEMS[_it].n + "! Deliver for " + fmt(_reward) + " coins.");
    log("📬 <b>" + _dv.n + "</b> requests " + _qty + "× " + ITEMS[_it].n + " — reward: <b>" + fmt(_reward) + " coins</b>", "good");
  }
}
function deliverReq(){
  if (!S.deliveryReq) return;
  if (itemCount(S.deliveryReq.itemId) < S.deliveryReq.qty){ toast("Not enough " + ITEMS[S.deliveryReq.itemId].n + "."); return; }
  S.items[S.deliveryReq.itemId] = (S.items[S.deliveryReq.itemId]||0) - S.deliveryReq.qty;
  S.coins += S.deliveryReq.reward;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + S.deliveryReq.reward;
  const _xpSkill = ["iron_ore","copper_ore","coal","bauxite"].includes(S.deliveryReq.itemId) ? "mining"
    : ["iron_bar","steel_bar","copper_wire","alu_ingot","tech_alloy"].includes(S.deliveryReq.itemId) ? "steelworks"
    : ["bracket","wiring_loom","gearbox","chassis","pallet_jack","sensor","servo_unit"].includes(S.deliveryReq.itemId) ? "manufacturing"
    : ["wood","plank"].includes(S.deliveryReq.itemId) ? "woodcutting"
    : ["sardine","mackerel","bass","salmon","tuna"].includes(S.deliveryReq.itemId) ? "fishing" : "trading";
  grantXp(_xpSkill, Math.round(S.deliveryReq.reward * 0.15));
  S.counters.deliveries = (S.counters.deliveries||0) + 1;
  const _dv = VILLAGERS.find(v => v.id === S.deliveryReq.npcId);
  toast("📬 Delivered! +" + fmt(S.deliveryReq.reward) + " coins from " + (_dv ? _dv.n : "villager") + ".");
  log("📬 Delivery complete for <b>" + (_dv ? _dv.n : "villager") + "</b> — <b>+" + fmt(S.deliveryReq.reward) + " coins</b>", "good");
  S.deliveryReq = null;
  S.nextDeliveryAt = Date.now() + (10+Math.random()*15)*60*1000;
  achCheck(); renderMain(); updateHud(); save();
}
// Friendship globals called from inline onclick in speech dock
(globalThis as any).chatVillager = function(id: string){
  if (!S.friendships) S.friendships = {};
  if (!S.friendships[id]) S.friendships[id] = { xp:0, lastChat:0 };
  const f = S.friendships[id];
  if (Date.now() - (f.lastChat||0) < 3*60*1000){ toast("💬 Come back later to chat."); return; }
  const wasLvl = friendLvl(id);
  f.xp = (f.xp||0) + Math.round(2 * prestigeFriendXpMult() * festivalFriendXpMult());
  f.lastChat = Date.now();
  const vst = VILLAGER_STATE.find(v=>v.id===id);
  if (vst) vst.quipIdx = (vst.quipIdx+1) % vst.quips.length;
  const vn = VILLAGERS.find(v=>v.id===id)?.n || id;
  const newLvl = friendLvl(id);
  if (newLvl > wasLvl) { toast(`❤️ You're now ${FRIEND_LVL_NAMES[newLvl]} with ${vn}!`); log(`❤️ Friendship up: <b>${vn}</b> — ${FRIEND_LVL_NAMES[newLvl]}`, "good"); }
  else toast(`💬 You chat with ${vn}. (+2 ❤️)`);
  save();
};
(globalThis as any).giftVillager = function(id: string, itemId: string){
  if (!ITEMS[itemId] || (S.items[itemId]||0) <= 0){ toast("You don't have that."); return; }
  if (!S.friendships) S.friendships = {};
  if (!S.friendships[id]) S.friendships[id] = { xp:0, lastChat:0 };
  const f = S.friendships[id];
  const loved = (FRIEND_LOVES[id]||[]).includes(itemId);
  const xpGain = Math.round((loved ? 15 : 3) * prestigeFriendXpMult() * festivalFriendXpMult());
  const wasLvl = friendLvl(id);
  f.xp = (f.xp||0) + xpGain;
  S.items[itemId] = Math.max(0, (S.items[itemId]||0) - 1);
  const vn = VILLAGERS.find(v=>v.id===id)?.n || id;
  const newLvl = friendLvl(id);
  if (newLvl > wasLvl){
    toast(`❤️ You're now ${FRIEND_LVL_NAMES[newLvl]} with ${vn}!`);
    log(`❤️ Friendship up: <b>${vn}</b> — ${FRIEND_LVL_NAMES[newLvl]}`, "good");
    if (newLvl === 4) grantFriendshipGift(id, vn);
    if (newLvl === 5) showKeepsakeCeremony(id, vn);
  } else toast(`🎁 ${vn} loves the ${ITEMS[itemId].n}! +${xpGain} ❤️`);
  updateHud(); save();
};
function avgDrift(itemId){
  ensureMarket();
  let sum=0, cnt=0;
  for (const npc of NPCS){
    if (npc.stock.includes(itemId)){
      const d = S.market.drift[npc.id] && S.market.drift[npc.id][itemId];
      if (typeof d==="number"){ sum+=d; cnt++; }
    }
  }
  return cnt ? sum/cnt : 1;
}
// ---- LE4: net-worth dashboard ----
function inventoryValue(){
  let v = 0;
  for (const it in (S.items||{})){
    const q = S.items[it]||0;
    if (q > 0 && ITEMS[it]) v += markToMarket(q, ITEMS[it].v, avgDrift(it));
  }
  return Math.round(v);
}
function propertyValue(){
  return (S.properties||[]).reduce((s,pid)=>{ const p=PROPERTIES.find(x=>x.id===pid); return s+(p?p.cost:0); }, 0);
}
function netWorth(){ return Math.round((S.coins||0) + inventoryValue() + propertyValue()); }
const NETWORTH_SAMPLE_MS = 5*60*1000;
function sampleNetWorth(force){
  if (!S.netWorth) S.netWorth = { history:[], last:0 };
  const now = Date.now();
  if (!force && now - (S.netWorth.last||0) < NETWORTH_SAMPLE_MS) return;
  S.netWorth.last = now;
  S.netWorth.history.push({ t:now, v:netWorth() });
  if (S.netWorth.history.length > 60) S.netWorth.history.shift();
}
function _sparkline(hist, w=240, h=40){
  const pts = (hist||[]).filter(p=>typeof p?.v==="number");
  if (pts.length < 2) return `<div style="font-size:11px;color:var(--dim);padding:8px 0">📈 Building your net-worth history — check back as you play.</div>`;
  const vs = pts.map(p=>p.v), mn=Math.min(...vs), mx=Math.max(...vs), rng=(mx-mn)||1;
  const step = w/(pts.length-1);
  const xy = (p,i)=>[i*step, h - ((p.v-mn)/rng)*(h-6) - 3];
  const path = pts.map((p,i)=>{ const [x,y]=xy(p,i); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  const up = vs[vs.length-1] >= vs[0], col = up ? "#4aff88" : "#e8907a";
  const [lx,ly] = xy(pts[pts.length-1], pts.length-1);
  return `<svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block;margin:4px 0">
    <polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${path}"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.6" fill="${col}"/>
  </svg>`;
}
function _netWorthPanel(){
  sampleNetWorth();
  const cash=Math.round(S.coins||0), inv=inventoryValue(), prop=propertyValue(), nw=cash+inv+prop;
  const hist=(S.netWorth?.history)||[];
  const first = hist.length ? hist[0].v : nw;
  const delta = nw - first, dCol = delta>=0 ? "#4aff88" : "#e8907a";
  const holdings = Object.keys(S.items||{})
    .map(it=>({ it, val: Math.round(markToMarket(S.items[it]||0, ITEMS[it]?.v||0, avgDrift(it))) }))
    .filter(h=> h.val>0 && ITEMS[h.it]).sort((a,b)=>b.val-a.val).slice(0,4);
  return `<div class="panel" style="padding:12px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--dim)">Net worth</div>
    <div style="font-size:26px;font-weight:800;color:#ffd666;line-height:1.1;margin:2px 0">${fmt(nw)} <span style="font-size:13px;color:var(--dim)">coins</span></div>
    <div style="font-size:11px;color:${dCol};margin-bottom:4px">${delta>=0?'▲':'▼'} ${fmt(Math.abs(delta))} since tracking began</div>
    ${_sparkline(hist)}
    <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:78px"><div style="font-size:10px;color:var(--dim)">💰 Cash</div><div style="font-weight:700">${fmt(cash)}</div></div>
      <div style="flex:1;min-width:78px"><div style="font-size:10px;color:var(--dim)">📦 Inventory</div><div style="font-weight:700">${fmt(inv)}</div></div>
      <div style="flex:1;min-width:78px"><div style="font-size:10px;color:var(--dim)">🏘️ Property</div><div style="font-weight:700">${fmt(prop)}</div></div>
    </div>
    ${holdings.length ? `<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--dim);margin-bottom:3px">Biggest holdings (at market)</div>
      ${holdings.map(h=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span>${ITEMS[h.it].ic} ${ITEMS[h.it].n} ×${fmt(S.items[h.it])}</span><span style="color:#ffd666">${fmt(h.val)}</span></div>`).join('')}
    </div>` : ''}
    <p style="color:var(--dim);font-size:10px;margin:10px 0 0">Inventory is valued at the live market — your net worth moves with the economy.</p>
  </div>`;
}
function positionValue(pos){
  const curDrift = avgDrift(pos.commodity) * eventMult(pos.commodity);
  return Math.max(1, Math.round(pos.qty * pos.costPerUnit * (curDrift / pos.driftAtBuy)));
}
function buyPosition(commodityId, qty){
  const comm = EXCHANGE_COMMODITIES.find(c=>c.id===commodityId);
  if (!comm){ return; }
  const totalCost = comm.unit * qty;
  if (S.coins < totalCost){ toast("Not enough coins."); return; }
  const driftAtBuy = avgDrift(commodityId) * eventMult(commodityId);
  S.coins -= totalCost;
  S.exchange.positions.push({ id:Date.now().toString(), commodity:commodityId, qty, costPerUnit:comm.unit, driftAtBuy, boughtAt:Date.now() });
  log("📈 Opened position: " + qty + "× " + comm.n + " @ " + fmt(totalCost) + " coins.");
  renderMain(); updateHud(); save();
}
function sellPosition(posId){
  const idx = S.exchange.positions.findIndex(p=>p.id===posId);
  if (idx<0) return;
  const pos = S.exchange.positions[idx];
  const val = positionValue(pos);
  const comm = EXCHANGE_COMMODITIES.find(c=>c.id===pos.commodity);
  S.exchange.positions.splice(idx, 1);
  S.coins += val;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + val;
  const profit = val - pos.qty * pos.costPerUnit;
  log("📈 Closed position: " + (comm?comm.n:pos.commodity) + " → +" + fmt(val) + " coins (" + (profit>=0?"+":"") + fmt(profit) + ")", profit>=0?"good":"");
  grantXp("trading", Math.round(Math.max(1, Math.abs(profit)*0.1)));
  if (profit > 0) S.counters.exchangeProfits = (S.counters.exchangeProfits||0) + 1;
  achCheck(); renderMain(); updateHud(); save();
}
function updateStudying(){
  if (!S.studying) return;
  if (Date.now() >= S.studying.endsAt){
    const _c = COURSES.find(c=>c.id===S.studying.courseId);
    if (_c && !S.degrees.includes(_c.id)){
      S.degrees = [...S.degrees, _c.id];
      toast(_c.ic + " " + _c.n + " degree earned! " + _c.desc);
      log(_c.ic + " <b>" + _c.n + "</b> completed — " + _c.desc, "good");
    }
    S.studying = null;
    if (S.tab==="university") renderMain();
    save();
  }
}
function updateBankInterest(now){
  if (!S.interestAt || now < S.interestAt) return;
  if (S.coins > 100){
    const _int = Math.floor(S.coins * 0.0005);
    if (_int > 0){
      S.coins += _int;
      S.counters.coinsEarned = (S.counters.coinsEarned||0) + _int;
      log("🏦 Interest: +" + fmt(_int) + " coins on your savings.", "good");
      if (S.tab==="bank") renderMain();
    }
  }
  S.interestAt = now + 30*60*1000;
  save();
}
function updateRetail(now){
  if (!S.retail || !S.retail.slots) return;
  const _today = new Date().toDateString();
  if (S.retail.lastReset !== _today){ S.retail.dailySold = 0; S.retail.lastReset = _today; }
  if ((S.retail.dailySold||0) >= 200) return;
  if (now < (S.retail.lastSale||0) + 2*60*1000) return;
  const _stocked = S.retail.slots.filter(sl => sl && sl.itemId && sl.qty > 0);
  if (!_stocked.length) return;
  const _sl = _stocked[Math.floor(Math.random()*_stocked.length)];
  const _it = _sl.itemId;
  const _npc = NPCS.find(n => n.stock && n.stock.includes(_it));
  const _price = _npc ? Math.round(sellPrice(_npc, _it) * 1.15) : Math.round((ITEMS[_it]?.v || 10) * 0.9);
  _sl.qty--;
  if (_sl.qty <= 0) _sl.itemId = null;
  S.coins += _price;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + _price;
  S.retail.dailySold = (S.retail.dailySold||0) + 1;
  S.retail.lastSale = now;
  grantXp("trading", Math.round(_price * 0.08));
  if (S.tab==="retail") renderMain();
  updateHud(); save();
}
function updateRent(now){
  if (!S.properties || !S.properties.length) return;
  if (now < (S.rentAt||0)) return;
  const _period = 5; // minutes
  const _total = Math.round(S.properties.reduce((sum, pid) => {
    const p = PROPERTIES.find(pr => pr.id===pid);
    return sum + (p ? p.rent * _period : 0);
  }, 0) * prestigeRentMult());
  if (_total > 0){
    S.coins += _total;
    S.counters.coinsEarned = (S.counters.coinsEarned||0) + _total;
    log("🏘️ Rent collected: +" + fmt(_total) + " coins from " + S.properties.length + " propert" + (S.properties.length===1?"y":"ies") + ".", "good");
    if (S.tab==="estateagent") renderMain();
    updateHud();
  }
  S.rentAt = now + _period*60*1000;
  save();
}
function updateFriendGifts(now){
  // Level 3+ friends occasionally send small gifts (once per 15 min per friend)
  if (!S.friendships) return;
  for (const [id, f] of Object.entries(S.friendships) as [string,any][]){
    const lvl = friendLvl(id);
    if (lvl < 3) continue;
    const interval = lvl >= 5 ? 8*60*1000 : 15*60*1000;
    if (now - (f.lastGift||0) < interval) continue;
    f.lastGift = now;
    const g = FRIEND_GIFT[id];
    if (g && ITEMS[g]){
      addItem(g, 1);
      const vn = VILLAGERS.find(v=>v.id===id)?.n || id;
      toast(`💌 ${vn} left you a ${ITEMS[g].n}!`);
      log(`💌 <b>${vn}</b> left a ${ITEMS[g].n} for you.`, "good");
      updateHud(); save();
    }
  }
}
function generateNBQuests(){
  const _shuffled = [...NB_POOL].sort(()=>Math.random()-0.5);
  const _picked: any[] = [];
  const _usedNpcs = new Set<string>();
  for (const q of _shuffled){
    if (_usedNpcs.has(q.npcId)) continue;
    _usedNpcs.add(q.npcId);
    _picked.push({ ...q, id: q.npcId+'_'+Date.now()+'_'+(Math.random()*9999|0), done:false });
    if (_picked.length >= 4) break;
  }
  return _picked;
}
function updateNoticeBoard(now){
  if (!S.noticeBoard) S.noticeBoard = { quests:[], lastRefresh:0 };
  const _allDone = S.noticeBoard.quests.length > 0 && S.noticeBoard.quests.every((q:any)=>q.done);
  const _stale = now - (S.noticeBoard.lastRefresh||0) > 30*60*1000;
  if (S.noticeBoard.quests.length === 0 || _stale || _allDone){
    S.noticeBoard.quests = generateNBQuests();
    S.noticeBoard.lastRefresh = now;
    if (S.noticeBoard.quests.length > 0) toast("📋 New quests on the Notice Board!");
    save();
  }
}
function updatePrestigeIncome(now){
  const _cpm = prestigeCoinsPm();
  if (_cpm <= 0) return;
  if (now < (S.prestigeIncomeAt||0)) return;
  S.coins += _cpm;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + _cpm;
  S.prestigeIncomeAt = now + 60000;
  save();
}
function generateVillagerRequest(npcId: string, now: number){
  const lvl = friendLvl(npcId);
  if (lvl < 1) return null;
  const pool = PERSONAL_REQUESTS.filter(r => r.npcId === npcId && r.minLvl <= lvl && (r.season === undefined || r.season === getSeason()));
  if (!pool.length) return null;
  const r = pool[Math.floor(Math.random() * pool.length)];
  return { itemId: r.itemId, qty: r.qty, reward: r.reward, friendXp: r.friendXp, expiresAt: now + 24*60*60*1000 };
}
function updateVillagerRequests(now: number){
  if (!S.villagerRequests) S.villagerRequests = {};
  let changed = false;
  for (const v of VILLAGERS){
    const cur = S.villagerRequests[v.id];
    if (!cur || now > cur.expiresAt){
      const req = generateVillagerRequest(v.id, now);
      if (req){ S.villagerRequests[v.id] = req; changed = true; }
      else if (cur){ delete S.villagerRequests[v.id]; changed = true; }
    }
  }
  if (changed) save();
}
(globalThis as any).fulfillVillagerRequest = function(npcId: string){
  if (!S.villagerRequests) { toast("No active request."); return; }
  const req = S.villagerRequests[npcId];
  if (!req){ toast("No active request."); return; }
  if ((S.items[req.itemId]||0) < req.qty){ toast("You don't have enough " + (ITEMS[req.itemId]?.n||req.itemId) + "."); return; }
  S.items[req.itemId] = (S.items[req.itemId]||0) - req.qty;
  S.coins += req.reward;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + req.reward;
  S.counters.requestsFulfilled = (S.counters.requestsFulfilled||0) + 1;
  if (!S.friendships) S.friendships = {};
  if (!S.friendships[npcId]) S.friendships[npcId] = { xp:0, lastChat:0 };
  const wasLvl = friendLvl(npcId);
  S.friendships[npcId].xp = (S.friendships[npcId].xp||0) + Math.round(req.friendXp * prestigeFriendXpMult() * festivalFriendXpMult());
  delete S.villagerRequests[npcId];
  const vn = VILLAGERS.find(v=>v.id===npcId)?.n || npcId;
  const newLvl = friendLvl(npcId);
  if (newLvl > wasLvl){
    toast(`❤️ You're now ${FRIEND_LVL_NAMES[newLvl]} with ${vn}!`);
    log(`❤️ Friendship up: <b>${vn}</b> — ${FRIEND_LVL_NAMES[newLvl]}`, "good");
    if (newLvl === 4) grantFriendshipGift(npcId, vn);
    if (newLvl === 5) showKeepsakeCeremony(npcId, vn);
  } else {
    toast(`💌 ${vn} thanks you! +${fmt(req.reward)} coins, +${req.friendXp} ❤️`);
  }
  log(`💌 Personal request fulfilled for <b>${vn}</b>: ${req.qty}× ${ITEMS[req.itemId]?.n||req.itemId} — +${fmt(req.reward)} coins`, "good");
  achCheck(); renderMain(); updateHud(); save();
};
(globalThis as any).choosePerk = function(skill: string, level: number, perkId: string){
  if (!S.perks) S.perks = {};
  const key = skill + '_' + level;
  if (S.perks[key]){ toast("Perk already chosen."); return; }
  const opts = SKILL_PERKS[skill]?.[level];
  if (!opts || !opts.includes(perkId)){ toast("Invalid perk."); return; }
  S.perks[key] = perkId;
  const def = PERK_DEFS[perkId];
  toast(`⭐ ${def.label} unlocked! ${def.ds}`);
  log(`⭐ <b>${def.label}</b> — ${def.ds}`, "good");
  achCheck(); renderMain(); save();
};
(globalThis as any).claimDailyChallenge = function(){
  if (!S.dailyChallenge || S.dailyChallenge.claimed){ toast("Already claimed."); return; }
  const prog = dailyChallengeProgress();
  if (!prog.done){ toast("Challenge not complete yet!"); return; }
  const ch = DAILY_CHALLENGE_POOL.find(c=>c.id===S.dailyChallenge.id);
  if (!ch) return;
  S.dailyChallenge.claimed = true;
  S.coins += ch.reward;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + ch.reward;
  S.counters.challengesClaimed = (S.counters.challengesClaimed||0) + 1;
  toast(`🎯 Daily Challenge complete! +${fmt(ch.reward)} coins`);
  log(`🎯 <b>Daily Challenge</b> — "${ch.ds}" Complete! +${fmt(ch.reward)} coins`, "good");
  achCheck(); renderMain(); updateHud(); save();
};
(globalThis as any).plantGarden = function(slot: number, cropId: string){
  const slots = plotsUnlocked(S.homeTier||0);
  if (slot < 0 || slot >= slots){ toast("Plot not unlocked."); return; }
  if (S.garden[slot]){ toast("Plot already in use."); return; }
  const crop = GARDEN_CROPS.find(c=>c.id===cropId);
  if (!crop){ toast("Unknown crop."); return; }
  if (S.coins < crop.seedCost){ toast("Not enough coins."); return; }
  S.coins -= crop.seedCost;
  const now = Date.now();
  const _gBonus = keepsakeGardenBonus();
  const _ms = Math.round(crop.ms * (1 - _gBonus));
  S.garden[slot] = { cropId, plantedAt:now, readyAt:now+_ms };
  toast(`🌱 ${crop.n} planted! Ready in ${Math.round(_ms/60000)} min.`);
  renderMain(); updateHud(); save();
};
(globalThis as any).harvestGarden = function(slot: number){
  const g = S.garden?.[slot];
  if (!g){ toast("Nothing to harvest."); return; }
  if (Date.now() < g.readyAt){ toast("Not ready yet!"); return; }
  const crop = GARDEN_CROPS.find(c=>c.id===g.cropId);
  if (!crop) return;
  for (const [id, qty] of Object.entries(crop.out)){
    addItem(id, qty as number);
    S.prod[id] = (S.prod[id]||0) + (qty as number);
  }
  S.garden[slot] = null;
  S.counters.gardenHarvests = (S.counters.gardenHarvests||0) + 1;
  _gardenToasted[slot] = false;
  const outStr = Object.entries(crop.out).map(([id,q])=>`${q}× ${ITEMS[id]?.n||id}`).join(' + ');
  toast(`🌻 Harvested ${crop.n}! Got ${outStr}.`);
  log(`🌱 <b>Garden harvest:</b> ${crop.n} → ${outStr}`, "good");
  achCheck(); renderMain(); updateHud(); save();
};
function updateLoans(){
  if (!S.loans || !S.loans.length) return;
  const _now = Date.now();
  const _dayMs = 24*60*60*1000;
  S.loans.forEach(ln => {
    const _elapsed = _now - (ln.lastAccrual || ln.borrowed);
    if (_elapsed >= _dayMs){ ln.interestAccrued = (ln.interestAccrued||0) + ln.amount*0.05; ln.lastAccrual = _now; save(); }
  });
}
// (game time comes from the imported real-time gameHour in world/daynight.ts —
//  1 game hour ≈ 1 real minute. A stale local override used to freeze it at 9:00.)
function _villagerTileOk(x, y){
  const t = tileAt(x, y);
  return t !== "W" && t !== "T" && t !== "C";
}
function updateChildren(dt){
  const hr = gameHour();
  const phase = (hr>=22||hr<8)?"sleep":(hr>=8.5&&hr<15.5)?"school":(hr>=15.5&&hr<18.5)?"park":"home";
  for (const c of CHILDREN_STATE){
    c.phase = phase;
    if (phase==="sleep"||phase==="school"){ c.moving=false; continue; }
    c.wanderTimer -= dt;
    if (!c.wTarget || c.wanderTimer<=0){
      if (phase==="park"){
        c.wTarget={ x:(78+Math.random()*5)*TILE, y:(6.8+Math.random()*2.4)*TILE };
      } else {
        c.wTarget={ x:c.homePos.x+(Math.random()*16-8), y:c.homePos.y };
      }
      c.wanderTimer=4+Math.random()*6;
    }
    const dx=c.wTarget.x-c.x, dy=c.wTarget.y-c.y, dist=Math.hypot(dx,dy);
    if (dist<5){ c.wTarget=null; c.moving=false; }
    else {
      const sp=26*dt, nx=c.x+(dx/dist)*sp, ny=c.y+(dy/dist)*sp;
      if(_villagerTileOk(nx,ny)){ c.x=nx; c.y=ny; }
      c.moving=true; c.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"); c.facing=dx>=0?1:-1;
    }
  }
}
function updateVillagers(dt){
  const hr = gameHour();
  const isWork = hr >= 6.5 && hr < 18.5;
  const isSleep = hr >= 22 || hr < 6;
  for (const v of VILLAGER_STATE){
    const newPhase = isSleep ? "sleep" : isWork ? "work" : "leisure";
    if (newPhase !== v.phase){ v.phase = newPhase; v.wTarget = null; v.wanderTimer = 0; v.indoor = false; }
    if (v.phase === "sleep"){ v.indoor = true; v.moving = false; continue; }
    // Bld workers go indoor when they reach work; stall workers stay outdoors
    const goesIndoor = v.phase === "work" && v.workKind === "bld";
    if (goesIndoor){
      const distToWork = Math.hypot(v.workPos.x - v.x, v.workPos.y - v.y);
      if (distToWork < 2.5*TILE){
        v.indoor = true;
        // wander within building interior canvas
        v.iwTimer -= dt;
        if (v.iwTimer <= 0 || !v.iwTarget){
          v.iwTimer = 2 + Math.random()*3;
          const iW = icanvasW(), iH = icanvasH();
          v.iwTarget = { x: iW*0.15 + Math.random()*iW*0.7, y: iH*0.38 + Math.random()*iH*0.32 };
        }
        if (v.iwTarget){
          const idx = v.iwTarget.x - v.iwx, idy = v.iwTarget.y - v.iwy;
          const id = Math.hypot(idx, idy);
          if (id > 4){ const s=50*dt; v.iwx+=idx/id*s; v.iwy+=idy/id*s; v.moving=true; v.facing=idx>=0?1:-1; }
          else { v.iwTarget=null; v.moving=false; }
        }
        continue;
      }
      v.indoor = false;
    } else {
      v.indoor = false;
    }
    const mainDest = v.phase === "work" ? v.workPos : v.homePos;
    const distToMain = Math.hypot(mainDest.x - v.x, mainDest.y - v.y);
    // Stall workers stand still at their stall during work hours
    if (v.phase === "work" && v.workKind === "stall"){
      if (distToMain > 8){
        v.wTarget = mainDest; v.wanderTimer = 0.5;
      } else {
        v.moving = false; v.wTarget = null; v.wanderTimer = 99;
        if (VP.x !== undefined){ v.facing = VP.x >= v.x ? 1 : -1; }
      }
      // skip wide-wander logic for stall workers at work
      const sd = v.wTarget;
      if (sd && distToMain > 8){
        const dx = sd.x-v.x, dy = sd.y-v.y, dist = Math.hypot(dx, dy);
        if (dist > 4){ const nx=v.x+(dx/dist)*30*dt, ny=v.y+(dy/dist)*30*dt; if(_villagerTileOk(nx,ny)){v.x=nx;v.y=ny;} v.moving=true; v.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"); v.facing=dx>=0?1:-1; }
      }
      v.quipTimer -= dt;
      if (v.quipTimer <= 0){ v.quipIdx=(v.quipIdx+1)%v.quips.length; v.quipTimer=18+Math.random()*12; }
      continue;
    }
    v.wanderTimer -= dt;
    if (v.wanderTimer <= 0 || !v.wTarget){
      v.wanderTimer = 1.2 + Math.random() * 2;
      if (distToMain < 4*TILE){
        let wx, wy, tries = 0;
        do {
          const a = Math.random()*Math.PI*2, r = (0.4+Math.random()*2)*TILE;
          wx = mainDest.x + Math.cos(a)*r; wy = mainDest.y + Math.sin(a)*r;
          tries++;
        } while (!_villagerTileOk(wx, wy) && tries < 12);
        v.wTarget = _villagerTileOk(wx, wy) ? { x:wx, y:wy } : mainDest;
      } else {
        v.wTarget = mainDest;
      }
    }
    const dest = v.wTarget;
    const dx = dest.x - v.x, dy = dest.y - v.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4){
      const nx = v.x + (dx/dist)*30*dt, ny = v.y + (dy/dist)*30*dt;
      // reject movement into water / off-map
      if (_villagerTileOk(nx, ny)){ v.x = nx; v.y = ny; }
      else { v.wTarget = null; } // blocked — pick new target next tick
      v.moving = true;
      v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      v.facing = dx >= 0 ? 1 : -1;
    } else {
      v.moving = false;
      v.wTarget = null;
    }
    v.quipTimer -= dt;
    if (v.quipTimer <= 0){ v.quipIdx = (v.quipIdx+1)%v.quips.length; v.quipTimer = 18+Math.random()*12; }
    // separation — push apart from other outdoor villagers and wanderers
    for (const other of VILLAGER_STATE){
      if (other === v || other.indoor || other.phase === "sleep") continue;
      const sd = Math.hypot(v.x-other.x, v.y-other.y);
      if (sd > 0 && sd < 13){ const f=(13-sd)/sd*0.55; v.x+=(v.x-other.x)*f; v.y+=(v.y-other.y)*f; }
    }
    for (const w of WANDERERS){
      const sd = Math.hypot(v.x-w.x, v.y-w.y);
      if (sd > 0 && sd < 13){ const f=(13-sd)/sd*0.55; v.x+=(v.x-w.x)*f; v.y+=(v.y-w.y)*f; }
    }
  }
}
function updateNightWildlife(dt){
  const hr = gameHour();
  const isNight = hr >= 22 || hr < 6;
  if (!isNight) return;
  // fox wanders between forest tiles
  const fdx = FOX.tx !== null ? FOX.tx - FOX.x : 0;
  const fdy = FOX.ty !== null ? FOX.ty - FOX.y : 0;
  if (FOX.tx === null || Math.hypot(fdx, fdy) < 4){
    FOX.tx = (40 + Math.random()*5) * TILE;
    FOX.ty = (4 + Math.random()*10) * TILE;
  } else {
    const fd = Math.hypot(fdx, fdy);
    FOX.x += (fdx/fd) * 18 * dt;
    FOX.y += (fdy/fd) * 18 * dt;
    FOX.dir = fdx >= 0 ? "right" : "left";
  }
  // shark drifts horizontally in water
  SHARK.x += SHARK.vx;
  if (SHARK.x > 44*TILE || SHARK.x < 4*TILE) SHARK.vx = -SHARK.vx;
}
function payMult(){
  let m = 1;
  UPGRADES.forEach(u => { if (u.pay && S.upgrades[u.id]) m = Math.max(m, u.pay); });
  const pet = PETS.find(p=>p.id===S.pets.active);
  if (pet && pet.id==="container_crab") m *= 1.15;
  if (pet && pet.id==="rail_rhino") m *= 1.30;
  m *= (1 + perkPayBonus());
  return m;
}
function inputsFor(act){
  if (!act.in) return null;
  return act.in;
}
function canAfford(act){
  if (!act.in) return true;
  return Object.entries(act.in).every(([id,q]) => itemCount(id) >= effCost(act, id, q));
}
function effCost(act, id, q){
  let cost = q;
  if (S.pets.active === "cargo_turtle" && SKILLS.steelworks.actions.some(a => a===act)) cost = Math.max(1, cost-1);
  if (perkEffcostActive('steelworks')    && SKILLS.steelworks.actions.some(a => a===act))    cost = Math.max(1, cost-1);
  if (perkEffcostActive('manufacturing') && SKILLS.manufacturing.actions.some(a => a===act)) cost = Math.max(1, cost-1);
  if (perkEffcostActive('crafting')      && SKILLS.crafting.actions.some(a => a===act))      cost = Math.max(1, cost-1);
  return cost;
}

function log(msg, cls){
  const el = document.createElement("p");
  const t = new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  el.innerHTML = `<span class="t">[${t}]</span><span class="${cls||""}">${msg}</span>`;
  const box = $("#log"); box.prepend(el);
  while (box.children.length > 60) box.removeChild(box.lastChild);
}
let toastTimer = null;
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.remove("show");
  void t.offsetWidth; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove("show"), 2600);
}

function grantXp(skill, xp){
  const _degCourse = COURSES.find(c => c.skill===skill && c.perk==="xp" && S.degrees && S.degrees.includes(c.id));
  if (_degCourse) xp = Math.round(xp * (1 + _degCourse.val));
  if ((S.schoolBuff||0) > Date.now()) xp = Math.round(xp * 1.15);
  { const _mb = mealBuffMult('xp'); if (_mb !== 1) xp = Math.round(xp * _mb); }   // cooking: a meal that sharpens the mind
  const _pxm = prestigeXpMult(); if (_pxm > 1) xp = Math.round(xp * _pxm);
  const _lxm = legacyXpMult(S.legacy); if (_lxm > 1) xp = Math.round(xp * _lxm);   // permanent Legacy bonus
  const _xpBonus = skillXpBonus(skill); if (_xpBonus > 0) xp = Math.round(xp * (1 + _xpBonus));
  const _kxp = keepsakeXpBonus(skill); if (_kxp > 0) xp = Math.round(xp * (1 + _kxp));
  const before = skillLvl(skill);
  S.skills[skill].xp += xp;
  const after = skillLvl(skill);
  if (after > before){
    showLevelBurst(skill, after);
    if (typeof SFX !== "undefined") SFX.levelUp();
    log(`${SKILLS[skill].n} reached level <b>${after}</b>.`, "good");
    if (SKILL_PERKS[skill]){
      for (const t of [10,25,40]){
        if (after >= t && before < t){
          toast(`⭐ Perk unlocked! Open the ${SKILLS[skill].n} panel to choose your level ${t} talent.`);
          log(`⭐ <b>${SKILLS[skill].n} perk</b> available at level ${t} — open the panel to choose.`, "good");
        }
      }
    }
    renderNav();
  }
}
function rollPet(src){
  PETS.forEach(p => {
    if (p.src !== src) return;
    if (S.pets.owned.includes(p.id)) return;
    if (Math.random() < p.chance){
      S.pets.owned.push(p.id);
      if (!S.pets.active) S.pets.active = p.id;
      toast(`${p.ic} A ${p.rar.toUpperCase()} companion joins you: ${p.n}!`);
      log(`${p.ic} <b>${p.n}</b> has joined your operation! (${p.ds})`, "rare");
      updateHud();
    }
  });
}

function completeAction(act, skill, silent){
  if (act.in){
    for (const [id,q] of Object.entries(act.in)){
      const cost = effCost(act, id, q);
      if (itemCount(id) < cost) return false;
    }
    for (const [id,q] of Object.entries(act.in)) S.items[id] -= effCost(act, id, q);
  }
  // Fishing lands a probabilistic catch (rarer/pricier fish need a better rod),
  // rather than a fixed output — everything below uses this rolled `_out`.
  let _out = act.out, _fishCaught = null;
  if (skill === "fishing"){
    _fishCaught = _rollCatch(toolTier(), Math.random);
    _out = { [_fishCaught]: 1 };
  }
  for (const [id,q] of Object.entries(_out)){ addItem(id, q); S.prod[id] = (S.prod[id]||0) + q; }
  // Occy: 20% chance to yield a bonus crafted item
  if (S.pets.active === "occy" && skill === "crafting" && Math.random() < 0.20){
    const _bonusId = Object.keys(_out)[0];
    addItem(_bonusId, 1);
    S.prod[_bonusId] = (S.prod[_bonusId]||0) + 1;
    if (!silent) toast(`🐙 Occy lends a tentacle — bonus ${ITEMS[_bonusId].n}!`);
  }
  // Yield perks: each chosen perk rolls independently
  if (S.perks){
    for (const t of [10,25,40]){
      const _pid = S.perks[skill+'_'+t];
      if (!_pid) continue;
      const _def = PERK_DEFS[_pid];
      if (!_def || (_def.type!=='yield' && _def.type!=='yield3')) continue;
      if (Math.random() < _def.val){
        const _bid = Object.keys(_out)[0];
        const _bq = _def.type==='yield3' ? _out[_bid]*2 : _out[_bid];
        addItem(_bid, _bq);
        S.prod[_bid] = (S.prod[_bid]||0) + _bq;
        if (!silent) toast(`⭐ ${_def.label} — +${ITEMS[_bid].n}!`);
      }
    }
  }
  // robotics: assigned yield automaton rolls for a bonus of the primary output
  {
    const _ay = autoYieldChance(skill, S.automatons?.[skill]);
    if (_ay > 0 && Math.random() < _ay){
      const _bid = Object.keys(_out)[0];
      const _bq = _out[_bid];
      addItem(_bid, _bq); S.prod[_bid] = (S.prod[_bid]||0) + _bq;
      if (!silent) toast(`🤖 Automaton bonus — +${_bq} ${ITEMS[_bid].n}!`);
    }
  }
  // interior completion feedback: a satisfying floating reward at the station, and
  // a consecutive-action combo streak to keep the loop moreish.
  if (!silent && INTERIOR_TABS.has(S.tab) && S.action){
    const _st = (STATION_DEFS[S.tab]||[]).find(s => s.id === S.action.id);
    const _oid = Object.keys(_out)[0];
    if (_oid && ITEMS[_oid]){
      _intVfx.push({ x: _st ? _st.fx*icanvasW() : icanvasW()/2, y: _st ? _st.fy*icanvasH() : icanvasH()*0.5, born: Date.now(), ic: ITEMS[_oid].ic, n: _out[_oid] });
      if (_intVfx.length > 20) _intVfx.shift();
    }
  }
  // consecutive-action combo streak — for any activity, village or interior
  if (!silent){
    const _n = Date.now();
    const _win = (act.ms * speedMult(skill)) * 2.2 + 1500;
    _comboCount = (_comboSkill === skill && (_n - _comboAt) < _win) ? _comboCount + 1 : 1;
    _comboSkill = skill; _comboAt = _n;
  }
  if (!silent && skill==="fishing") _fishCatchT = (typeof performance!=="undefined"?performance.now():Date.now());
  // fishing XP scales with the fish landed; everything else uses the action's xp
  grantXp(skill, _fishCaught ? (fishById(_fishCaught)?.xp || act.xp) : act.xp);
  S.counters.actions++;
  rollPet(skill);
  if (!silent && typeof pushVfx === "function" && skill!=="fishing" && !INTERIOR_TABS.has(S.tab)) pushVfx(skill, act);
  if (!silent && typeof SFX !== "undefined") SFX.play(skill);
  tutCheck();
  achCheck();
  if (!silent){
    if (_fishCaught){
      const _rar = fishById(_fishCaught)?.rarity || 0;
      const _tag = _rar >= 3 ? " 🌟 A prize catch!" : _rar >= 2 ? " ✨ A rare one!" : "";
      toast(`🎣 Landed a ${ITEMS[_fishCaught].n}!${_tag}`);
    }
    const outName = Object.keys(_out).map(id=>ITEMS[id].n).join(", ");
    log(`${SKILLS[skill].ic} ${act.n} → +${outName}`);
  }
  // Tree chopping (direct click on tree): record respawn and stop action
  if (skill==="woodcutting" && S.action && S.action.objId) {
    if (!S.treeRespawn) S.treeRespawn = {};
    S.treeRespawn[S.action.objId] = { choppedAt: Date.now() };
    S.action = null;
  }
  return true;
}

function tick(dt){
  if (!S.action) return;
  const act = findAction(S.action.skill, S.action.id);
  if (!act){ S.action = null; return; }
  const dur = act.ms * speedMult(S.action.skill);
  S.action.progress += dt;
  while (S.action && S.action.progress >= dur){
    S.action.progress -= dur;
    const ok = completeAction(act, S.action.skill, false);
    if (!ok){
      log(`⏸️ ${act.n} stopped — out of materials.`, "");
      S.action = null;
      renderMain();
      break;
    }
  }
}

// M12 — Active Swing Mode. Adds a tool-tier-scaled chunk of progress to the
// CURRENT gathering action. Additive only: same yield/XP as idle (routes through
// completeAction), never touches offline catch-up, cooldown-capped so it can't be
// autoclicked past active-play speed. If you stop clicking, tick() carries on.
let _lastSwingMs = 0;
function swing(){
  if (!S.action || !SWING_SKILLS.has(S.action.skill)) return false;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (now - _lastSwingMs < SWING_COOLDOWN_MS) return false;
  const act = findAction(S.action.skill, S.action.id);
  if (!act) return false;
  _lastSwingMs = now;
  const dur = act.ms * speedMult(S.action.skill);
  S.action.progress += dur * (SWING_FRAC[toolTier()] || SWING_FRAC[0]); // frac < 1: never a one-click resource
  if (typeof SFX !== "undefined") SFX.play(S.action.skill);
  let completed = 0;
  while (S.action && S.action.progress >= dur){
    S.action.progress -= dur;
    if (!completeAction(act, S.action.skill, false)){ S.action = null; break; }
    completed++;
  }
  updateProgressBar();
  if (completed > 0) updateHud();
  return true;
}

function applyOffline(){
  const now = Date.now();
  const elapsed = Math.min(now - (S.lastSeen || now), OFFLINE_CAP_MS);
  if (elapsed < 60*1000) return;
  const passiveLines = [];
  let passiveCoins = 0;

  // --- active skill catch-up ---
  if (S.action){
    const act = findAction(S.action.skill, S.action.id);
    if (!act){ S.action = null; }
    else {
      const dur = act.ms * speedMult(S.action.skill);
      let possible = Math.floor(elapsed / dur), done = 0;
      while (possible-- > 0){
        if (!completeAction(act, S.action.skill, true)){ S.action = null; break; }
        done++;
      }
      if (done > 0){
        const ds = elapsed>=3600000 ? (elapsed/3600000).toFixed(1)+"h" : Math.round(elapsed/60000)+"m";
        passiveLines.push(`⛏️ ${done}× ${act.n} (${ds} night shift)`);
      }
    }
  }

  // --- bank interest: compound across missed 30-min windows ---
  if (S.coins > 100 && S.interestAt && S.interestAt <= now){
    let cursor = S.interestAt, running = S.coins, gained = 0;
    while (cursor <= now){
      if (running > 100){ const i = Math.floor(running * 0.0005); if (i>0){ gained+=i; running+=i; } }
      cursor += 30*60*1000;
    }
    S.interestAt = cursor;
    if (gained > 0){
      S.coins += gained; S.counters.coinsEarned = (S.counters.coinsEarned||0) + gained;
      passiveCoins += gained; passiveLines.push(`🏦 Bank interest: +${fmt(gained)}`);
    }
  }

  // --- retail stall: sell up to daily cap across missed 2-min windows ---
  if (S.retail && S.retail.slots){
    const intervalMs = 2*60*1000;
    const since = S.retail.lastSale || (now - elapsed);
    const ticks = Math.min(Math.floor((now - since) / intervalMs), 200);
    let retailEarned = 0, unitsSold = 0;
    for (let t = 0; t < ticks; t++){
      if ((S.retail.dailySold||0) >= 200) break;
      const stocked = S.retail.slots.filter(sl => sl && sl.itemId && sl.qty > 0);
      if (!stocked.length) break;
      const sl = stocked[t % stocked.length];
      const npc = NPCS.find(n => n.stock && n.stock.includes(sl.itemId));
      const price = npc ? Math.round(sellPrice(npc, sl.itemId) * 1.15) : Math.round((ITEMS[sl.itemId]?.v||10) * 0.9);
      sl.qty--; if (sl.qty <= 0){ sl.itemId = null; sl.qty = 0; }
      S.coins += price; S.counters.coinsEarned = (S.counters.coinsEarned||0) + price;
      S.retail.dailySold = (S.retail.dailySold||0) + 1;
      retailEarned += price; unitsSold++;
    }
    S.retail.lastSale = now;
    if (retailEarned > 0){ passiveCoins += retailEarned; passiveLines.push(`🛍️ Retail stall: +${fmt(retailEarned)} (${unitsSold} units)`); }
  }

  // --- property rent: sum across missed 5-min windows ---
  if (S.properties && S.properties.length && S.rentAt && S.rentAt <= now){
    const periodMs = 5*60*1000;
    let cursor = S.rentAt, rentEarned = 0;
    const tickRent = S.properties.reduce((s,pid)=>{ const p=PROPERTIES.find(pr=>pr.id===pid); return s+(p?p.rent*5:0); },0);
    while (cursor <= now){ rentEarned += tickRent; cursor += periodMs; }
    S.rentAt = cursor;
    if (rentEarned > 0){
      S.coins += rentEarned; S.counters.coinsEarned = (S.counters.coinsEarned||0) + rentEarned;
      passiveCoins += rentEarned; passiveLines.push(`🏘️ Rental income: +${fmt(rentEarned)}`);
    }
  }

  // --- loan interest: days elapsed per loan ---
  if (S.loans && S.loans.length){
    const dayMs = 24*60*60*1000;
    let anyAccrued = false;
    S.loans.forEach(ln => {
      const days = Math.floor((now - (ln.lastAccrual||ln.borrowed)) / dayMs);
      if (days > 0){
        ln.interestAccrued = (ln.interestAccrued||0) + ln.amount * 0.05 * days;
        ln.lastAccrual = (ln.lastAccrual||ln.borrowed) + days * dayMs;
        anyAccrued = true;
      }
    });
    if (anyAccrued) passiveLines.push(`💳 Loan interest accrued — check the bank`);
  }

  // --- show summary ---
  if (passiveLines.length > 0){
    const hrsAway = elapsed >= 3600000 ? (elapsed/3600000).toFixed(1)+"h" : Math.round(elapsed/60000)+"m";
    window._offlineSummary = { hrsAway, passiveCoins, lines: passiveLines };
  }
}

function contractSlots(){ return 2 + (skillLvl("logistics") >= 20 ? 1 : 0); }
function genContract(){
  const mLvl = skillLvl("manufacturing");
  const opts = CONTRACT_POOL.filter(c => c.minLvl <= Math.max(mLvl, skillLvl("steelworks")));
  const pick = opts[Math.floor(Math.random()*opts.length)];
  const item = ITEMS[pick.item];
  const qty = Math.max(2, Math.floor(2 + Math.random()*4 + mLvl/8));
  const coins = Math.round(item.v * qty * (1.5 + Math.random()*0.5));
  const xp = Math.round(item.v * qty * 0.45) + 10;
  return { client: CLIENTS[Math.floor(Math.random()*CLIENTS.length)], item: pick.item, qty, coins, xp };
}
function fillContracts(){ while (S.contracts.length < contractSlots()) S.contracts.push(genContract()); }
function deliverContract(i){
  const c = S.contracts[i];
  if (!c || itemCount(c.item) < c.qty) return;
  S.items[c.item] -= c.qty;
  const payout = Math.round(c.coins * payMult());
  S.coins += payout;
  S.counters.coinsEarned = (S.counters.coinsEarned||0) + payout;
  grantXp("logistics", c.xp);
  S.counters.contracts++;
  rollPet("contract");
  tutCheck();
  achCheck();
  log(`🚚 Delivered ${c.qty}× ${ITEMS[c.item].n} to ${c.client} → <b>+${fmt(payout)} coins</b>`, "good");
  S.contracts.splice(i,1);
  fillContracts(); renderMain(); updateHud(); save();
}
function rerollContract(i){
  const cost = 25;
  if (S.coins < cost) { toast("Need 25 coins to re-tender."); return; }
  S.coins -= cost;
  S.contracts[i] = genContract();
  log("📋 Contract re-tendered (−25 coins).");
  renderMain(); updateHud(); save();
}

const TABS = [
  { id:"village", n:"Village", ic:"🏡" },
  { id:"mining", n:"Mining", ic:"⛏️", skill:true },
  { id:"steelworks", n:"Steelworks", ic:"🔥", skill:true },
  { id:"manufacturing", n:"Manufacturing", ic:"🏭", skill:true },
  { id:"woodcutting", n:"Woodcutting", ic:"🪓", skill:true },
  { id:"fishing", n:"Fishing", ic:"🎣", skill:true },
  { id:"contracts", n:"Contracts", ic:"📋" },
  { id:"trade", n:"Trade", ic:"⚖️" },
  { id:"upgrades", n:"Upgrades", ic:"🛒" },
  { id:"pets", n:"Companions", ic:"🦊" },
  { id:"ach", n:"Awards", ic:"🏆" },
  { id:"character", n:"Character", ic:"👤" },
  { id:"settings", n:"Save", ic:"💾" },
];
// ---- Progressive tab unlocking (Tasks 2 & 6) ----
// New players see only the essentials; advanced tabs unlock as they play so the UI
// never overwhelms and nothing reads as an empty "coming soon" panel. Unlocks are
// persisted (S.unlockedTabs) so they can never re-lock (e.g. after a prestige reset).
const TAB_ALWAYS = new Set(["village", "mining", "character", "settings"]);
const TAB_COND = {
  steelworks:    () => prodSum(ORES) >= 1,
  manufacturing: () => prodSum(BARS) >= 1,
  woodcutting:   () => !!(S.tut && S.tut.done),
  fishing:       () => !!(S.tut && S.tut.done),
  contracts:     () => prodSum(GOODS) >= 1,
  trade:         () => (S.counters?.contracts || 0) >= 1,
  upgrades:      () => (S.counters?.coinsEarned || 0) >= 100,
  pets:          () => !!(S.tut && S.tut.done),
  ach:           () => !!(S.tut && S.tut.done),
};
const TAB_UNLOCK_HINT = {
  steelworks:    "Mine some ore to unlock",
  manufacturing: "Smelt a bar to unlock",
  woodcutting:   "Finish Frost's tutorial to unlock",
  fishing:       "Finish Frost's tutorial to unlock",
  contracts:     "Manufacture a part to unlock",
  trade:         "Deliver a contract to unlock",
  upgrades:      "Earn 100 coins to unlock",
  pets:          "Finish Frost's tutorial to unlock",
  ach:           "Finish Frost's tutorial to unlock",
};
function tabUnlocked(id){ return TAB_ALWAYS.has(id) || !!(S.unlockedTabs && S.unlockedTabs[id]); }
// Grant any newly-earned tab unlocks. `silent` skips the toast/log (used on load to
// back-fill existing saves so nothing they already earned disappears).
function syncTabUnlocks(silent){
  if (!S.unlockedTabs) S.unlockedTabs = {};
  let changed = false;
  for (const id in TAB_COND){
    if (!S.unlockedTabs[id] && TAB_COND[id]()){
      S.unlockedTabs[id] = true; changed = true;
      if (!silent){
        const t = TABS.find(x => x.id === id);
        if (t){ toast(`🔓 ${t.ic} ${t.n} unlocked!`); log(`🔓 <b>${t.n}</b> is now available in your tabs.`, "good"); }
      }
    }
  }
  if (changed && !silent) renderNav();
  return changed;
}
function renderNav(){
  const nav = $("#nav"); nav.innerHTML = "";
  let shownLocked = 0;
  TABS.forEach(t => {
    if (!tabUnlocked(t.id)){
      // show just the next locked tab as a progression hint; hide the rest
      if (shownLocked >= 1 || !TAB_UNLOCK_HINT[t.id]) return;
      shownLocked++;
      const lb = document.createElement("button");
      lb.className = "locked";
      lb.innerHTML = `🔒 ${t.n}`;
      lb.title = TAB_UNLOCK_HINT[t.id];
      lb.onclick = () => toast(`🔒 ${t.ic} ${t.n} — ${TAB_UNLOCK_HINT[t.id]}.`);
      nav.appendChild(lb);
      return;
    }
    const b = document.createElement("button");
    let label = `${t.ic} ${t.n}`;
    if (t.skill) label += ` <span class="lvl">${skillLvl(t.id)}</span>`;
    if (t.id==="contracts") label += ` <span class="lvl">Log ${skillLvl("logistics")}</span>`;
    if (t.id==="trade") label += ` <span class="lvl">${skillLvl("trading")}</span>`;
    b.innerHTML = label;
    if (S.tab === t.id) b.classList.add("active");
    if (S.action && S.action.skill === t.id) b.classList.add("working");
    b.onclick = () => { S.tab = t.id; renderNav(); renderMain(); };
    nav.appendChild(b);
  });
}

function xpBarHtml(skill){
  const lvl = skillLvl(skill), xp = S.skills[skill].xp;
  const lo = XP_TABLE[lvl], hi = lvl >= 99 ? lo : XP_TABLE[lvl+1];
  const pct = lvl >= 99 ? 100 : ((xp - lo) / (hi - lo) * 100);
  return `<div class="xpwrap">
    <div class="xprow"><span>Level ${lvl} / 99</span><span>${fmt(xp)} / ${lvl>=99?"MAX":fmt(hi)} XP</span></div>
    <div class="bar xp"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div>
  </div>`;
}
function ioHtml(act){
  let s = "";
  if (act.in){
    s += Object.entries(act.in).map(([id,q])=>{
      const have = itemCount(id) >= q;
      return `<span class="${have?'have':'need'}">${q}× ${ITEMS[id].n} (${itemCount(id)})</span>`;
    }).join(" + ");
    s += " → ";
  }
  s += Object.entries(act.out).map(([id,q])=>`${q}× ${ITEMS[id].n}`).join(", ");
  return s;
}
function renderBikeShop(){
  const b = S.bike || {};
  const cond = Math.round(b.condition ?? 100);
  const condCol = cond > 60 ? "#4aff88" : cond > 30 ? "#ffd666" : "#ff6a6a";
  const condBar = `<div style="background:rgba(255,255,255,.1);height:6px;border-radius:3px;margin:3px 0 8px"><div style="background:${condCol};width:${cond}%;height:100%;border-radius:3px"></div></div>`;
  const BIKE_COLORS = [
    { hex:'#e84040', lbl:'Red'    },
    { hex:'#4070c0', lbl:'Blue'   },
    { hex:'#3a8a3a', lbl:'Green'  },
    { hex:'#c8b020', lbl:'Yellow' },
    { hex:'#1a1a1a', lbl:'Black'  },
    { hex:'#c050c0', lbl:'Purple' },
  ];
  const WHEEL_UPS = [
    { id:'sport',    n:'Sport Wheels',  cost:200, desc:'+35% road speed. Slows in forest like standard.' },
    { id:'offroad',  n:'Off-road Tyres', cost:300, desc:'+25% everywhere — maintains speed in forest.' },
    { id:'mountain', n:'Mountain Bike', cost:500, desc:'Best everywhere: +35% road, +30% forest.' },
  ];
  let html = `<div class="panel" style="padding:10px">`;
  if (!b.owned){
    html += `<h3 style="margin:0 0 6px;font-size:13px">🚲 Buy a Bike</h3>
    <p style="color:var(--dim);font-size:12px;margin:0 0 10px">A sturdy town bike — 25% faster on roads and paths. Slows down off-road.</p>
    <button data-bikerent="1" style="background:${S.coins>=150?'#3a7a3a':'#555'};color:#fff;border:none;padding:6px 18px;border-radius:4px;cursor:pointer;font-size:13px"${S.coins>=150?'':' disabled'}>🚲 Buy Bike — 150 coins</button>
    ${S.coins<150?`<p style="color:var(--warn);font-size:11px;margin:6px 0 0">Need 150 coins (${fmt(150-S.coins)} short)</p>`:''}`;
  } else {
    const curTier = BIKE_WHEEL_TIER[b.wheels||'standard'] ?? 0;
    html += `<h3 style="margin:0 0 4px;font-size:13px">Your Bike</h3>
    <div style="font-size:12px;color:var(--dim);margin-bottom:3px">${BIKE_WHEEL_N[b.wheels||'standard']} · <span style="color:${condCol}">Condition ${cond}%</span></div>
    ${condBar}
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button data-bikeequip="1" style="background:${b.equipped?'#5a7a5a':'#3a4a3a'};color:#fff;border:none;padding:4px 14px;border-radius:3px;cursor:pointer;font-size:12px">${b.equipped?'🛑 Park Bike':'🚲 Ride Bike'}</button>
      ${cond < 100
        ? `<button data-bikeservice="1" style="background:${S.coins>=serviceCost()?'#5a5a2a':'#555'};color:#fff;border:none;padding:4px 12px;border-radius:3px;cursor:pointer;font-size:12px"${S.coins>=serviceCost()?'':' disabled'}>🔧 Service — ${fmt(serviceCost())} coins</button>`
        : `<span style="color:#4aff88;font-size:12px;line-height:1;padding:4px 0">✓ Tip-top condition</span>`
      }
    </div>
    </div>
    <div class="panel" style="padding:10px;margin-top:8px">
    <h3 style="margin:0 0 8px;font-size:13px">🎨 Colour Respray — 30 coins</h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">`;
    for (const c of BIKE_COLORS){
      const active = (b.color||'#e84040') === c.hex;
      html += `<button data-bikecolor="${c.hex}" title="${c.lbl}" style="background:${c.hex};width:28px;height:28px;border-radius:50%;border:${active?'3px solid #fff':'2px solid rgba(255,255,255,.2)'};cursor:pointer"${active||S.coins>=30?'':' disabled'}></button>`;
    }
    html += `</div>
    <h3 style="margin:0 0 6px;font-size:13px">⬆️ Wheel Upgrades</h3>`;
    for (const wu of WHEEL_UPS){
      const thisTier = BIKE_WHEEL_TIER[wu.id];
      const isOwned = curTier >= thisTier;
      const isNext = !isOwned && thisTier === curTier + 1;
      const canBuy = isNext && S.coins >= wu.cost;
      html += `<div class="card" style="margin-bottom:5px;padding:5px 8px;${isOwned?'opacity:.45':''}">
        <span class="ic">${isOwned?'✅':'🔄'}</span>
        <div class="body">
          <div class="nm">${wu.n}${isOwned?' <span style="color:var(--dim);font-weight:400">(owned)</span>':' — '+fmt(wu.cost)+' coins'}</div>
          <div class="ds">${wu.desc}</div>
          ${!isOwned?`<button data-bikewheels="${wu.id}" style="margin-top:4px;background:${canBuy?'#4a6a8a':'#555'};color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px"${canBuy?'':' disabled'}>Buy</button>`:''}
        </div>
      </div>`;
    }
    if (!b.hasLight){
      html += `<div class="card" style="margin-top:6px;padding:5px 8px">
        <span class="ic">💡</span>
        <div class="body">
          <div class="nm">Bike Light — 150 coins</div>
          <div class="ds">Illuminates the path around you at night.</div>
          <button data-bikelight="1" style="margin-top:4px;background:${S.coins>=150?'#6a5a2a':'#555'};color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px"${S.coins>=150?'':' disabled'}>Buy</button>
        </div>
      </div>`;
    } else {
      html += `<div class="card" style="margin-top:6px;padding:5px 8px;opacity:.45">
        <span class="ic">💡</span><div class="body"><div class="nm">Bike Light (owned)</div></div>
      </div>`;
    }
    html += `</div>`;
  }
  if (!b.owned) html += `</div>`;
  return html;
}
function renderSkillPanel(skill){
  const sk = SKILLS[skill];
  const lvl = skillLvl(skill);
  let html = `<div class="panel"><h2>${sk.ic} ${sk.n}<small>${sk.desc}</small></h2>${xpBarHtml(skill)}`;
  // Perk choice card (pending)
  const _pp = pendingPerk(skill);
  if (_pp && SKILL_PERKS[skill]?.[_pp]){
    const [opt1,opt2] = SKILL_PERKS[skill][_pp];
    const d1=PERK_DEFS[opt1], d2=PERK_DEFS[opt2];
    html += `<div style="background:linear-gradient(135deg,#2a4a10,#1a2a08);border:2px solid #7acf3a;border-radius:6px;padding:10px;margin:6px 0 10px">
      <div style="font-weight:700;color:#8adf4a;font-size:11px;margin-bottom:8px;letter-spacing:.5px">⭐ LEVEL ${_pp} PERK — choose your talent</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button data-perk="${skill}|${_pp}|${opt1}" style="background:#1a3a08;border:1px solid #5ab02a;color:#fff;padding:8px;border-radius:4px;cursor:pointer;text-align:left;line-height:1.4">
          <div style="font-weight:700;font-size:11px">${d1.label}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">${d1.ds}</div>
        </button>
        <button data-perk="${skill}|${_pp}|${opt2}" style="background:#1a3a08;border:1px solid #5ab02a;color:#fff;padding:8px;border-radius:4px;cursor:pointer;text-align:left;line-height:1.4">
          <div style="font-weight:700;font-size:11px">${d2.label}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">${d2.ds}</div>
        </button>
      </div>
    </div>`;
  } else {
    const _activePerks = [10,25,40].map(t=>S.perks?.[skill+'_'+t]).filter(Boolean).map(id=>PERK_DEFS[id]).filter(Boolean);
    if (_activePerks.length) html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 8px">${_activePerks.map(d=>`<span style="background:#1a3a08;border:1px solid #4a8020;border-radius:3px;padding:2px 7px;font-size:10px;color:#8adf4a">⭐ ${d.label}</span>`).join('')}</div>`;
  }
  html += `<div class="actions">`;
  sk.actions.forEach(act => {
    const seasonLocked = act.season !== undefined && act.season !== getSeason();
    const locked = lvl < act.lvl || seasonLocked;
    const running = S.action && S.action.skill===skill && S.action.id===act.id;
    const dur = (act.ms * speedMult(skill) / 1000).toFixed(1);
    const _sDef = act.season ? SEASON_DEFS[act.season] : null;
    const seasonBadge = _sDef ? ` <span style="font-size:9px;opacity:.65">${_sDef.ic}</span>` : '';
    const metaText = lvl < act.lvl ? `Requires level ${act.lvl}` : seasonLocked ? `${_sDef.ic} ${_sDef.n} only` : `${dur}s · ${act.xp} XP`;
    html += `<button class="action ${running?'running':''}" data-skill="${skill}" data-act="${act.id}" ${locked?'disabled':''}>
      <div class="nm"><span class="ic">${ITEMS[Object.keys(act.out)[0]].ic}</span>${act.n}${seasonBadge}</div>
      <div class="meta">${metaText}</div>
      <div class="io">${ioHtml(act)}</div>
      ${running ? `<div class="prog"><div class="fill" id="prog-${act.id}"></div></div>${SWING_SKILLS.has(skill)?`<span class="stopbtn" data-swing="1" style="background:#3a5a1a;border-color:#6aaa2a;color:#cfeeb0" title="Swing! ~${swingClicks(toolTier())} clicks per resource at your tool tier">🪓 SWING</span> `:""}<span class="stopbtn" data-stop="1">STOP</span>` : ""}
    </button>`;
  });
  html += `</div></div>`;
  html += renderInventoryPanel();
  return html;
}
function renderInventoryPanel(){
  const entries = Object.entries(S.items).filter(([,q])=>q>0);
  let html = `<div class="panel"><h2>📦 Warehouse</h2>${tutObjectiveHtml()}<div class="inv">`;
  if (!entries.length) html += `<span style="color:var(--dim);font-size:12px;">Empty. The auditors would approve. Go mine something.</span>`;
  entries.forEach(([id,q])=>{
    // highlight the item the current objective wants, so progress is obvious
    const _hl = (!S.tut || S.tut.done) ? false
      : (S.tut.step===0 && id==="iron_ore") || (S.tut.step===1 && id==="iron_bar") || (S.tut.step===2 && id==="bracket");
    html += `<span class="chip${_hl?' chip-obj':''}">${ITEMS[id].ic} ${ITEMS[id].n} <b>${fmt(q)}</b></span>`;
  });
  html += `</div></div>`;
  return html;
}
function renderContracts(){
  fillContracts();
  let html = `<div class="panel"><h2>📋 Open Contracts<small>Deliver goods, earn coins, level Logistics. Slots: ${contractSlots()}${skillLvl("logistics")<20?" (3rd slot at Logistics 20)":""}</small></h2>${xpBarHtml("logistics")}`;
  S.contracts.forEach((c,i)=>{
    const have = itemCount(c.item);
    const ok = have >= c.qty;
    const payout = Math.round(c.coins * payMult());
    html += `<div class="contract">
      <div class="who">🏢 ${c.client}</div>
      <div class="pay">💰 ${fmt(payout)} coins · +${c.xp} Logistics XP</div>
      <div class="req">Needs <span class="${ok?'have':'short'}">${c.qty}× ${ITEMS[c.item].ic} ${ITEMS[c.item].n}</span> — you have ${have}</div>
      <button class="btn deliver" data-deliver="${i}" ${ok?'':'disabled'}>DELIVER</button>
      <button class="btn alt" data-reroll="${i}">Re-tender (25c)</button>
    </div>`;
  });
  html += `</div>` + renderInventoryPanel();
  return html;
}
function trendArrow(d){
  if (d >= 1.12) return `<span style="color:var(--mint)">▲ high</span>`;
  if (d <= 0.88) return `<span style="color:var(--red)">▼ low</span>`;
  return `<span style="color:var(--dim)">▬ fair</span>`;
}
// LE3 — infer why an item's price is moving (for the movers list).
function _priceDriver(it){
  const p = S.econ.pressure[it] ?? 1;
  if (p <= 0.85) return "glut";
  if (p >= 1.16) return "tight demand";
  const rm = recipeMap();
  if (rm[it]){
    for (const inId in rm[it].in){
      const ip = S.econ.pressure[inId] ?? 1;
      if (ip >= 1.12) return "input costs up";
      if (ip <= 0.88) return "cheaper inputs";
    }
  }
  return macroPhase().name.toLowerCase();
}
// LE3 — biggest price movers across all traders, with their driver.
function _econMoversHtml(){
  const seen = new Set(), rows = [];
  NPCS.forEach(n => n.stock.forEach(it => {
    if (seen.has(it)) return; seen.add(it);
    const d = S.market.drift[n.id]?.[it];
    if (typeof d === "number") rows.push([it, d]);
  }));
  rows.sort((a,b) => Math.abs(b[1]-1) - Math.abs(a[1]-1));
  const top = rows.filter(r => Math.abs(r[1]-1) > 0.05).slice(0, 4);
  if (!top.length) return "";
  return `<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--dim);margin-bottom:3px">Top movers</div>
    ${top.map(([it,d]) => { const up = d>1, col = up ? 'var(--mint)' : '#e8907a';
      return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span>${ITEMS[it].ic} ${ITEMS[it].n}</span><span style="color:${col}">${up?'▲':'▼'} ${_priceDriver(it)}</span></div>`;
    }).join('')}
  </div>`;
}
// LE2 — shared "Market Report" block: macro phase chip + live flavour + headlines.
function _econNewsHtml(limit){
  ensureEcon();
  const ph = macroPhase();
  const mins = Math.max(1, Math.ceil(msToNextPhase()/60000));
  const flav = ph.flavour[Math.floor(Date.now()/9000) % ph.flavour.length];
  const toneCol = ph.tone==='good' ? 'var(--mint)' : ph.tone==='bad' ? 'var(--red)' : 'var(--amber)';
  const news = (S.econ.news||[]).slice(0, limit||5);
  const newsHtml = news.length
    ? news.map(nw=>`<div style="font-size:11px;color:${nw.tone==='good'?'var(--mint)':nw.tone==='bad'?'#e8907a':'var(--dim)'};padding:3px 0;border-top:1px solid rgba(255,255,255,.06)">${nw.icon?nw.icon+' ':''}${nw.text}</div>`).join('')
    : `<div style="font-size:11px;color:var(--dim);padding:3px 0">Quiet on the wires — trade to make headlines.</div>`;
  return `<div class="panel" style="padding:10px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--dim);margin-bottom:7px">📰 Market Report</div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="background:color-mix(in srgb,${toneCol} 16%,transparent);border:1px solid ${toneCol};color:${toneCol};border-radius:4px;padding:3px 9px;font-weight:700;font-size:12px">${ph.ic} ${ph.name}</span>
      <span style="font-size:11px;color:var(--dim)">${flav} · turns in ~${mins} min</span>
    </div>
    <div style="margin-top:8px">${newsHtml}</div>
    ${_econMoversHtml()}
  </div>`;
}
function renderTrade(){
  ensureMarket();
  const tLvl = skillLvl("trading");
  let html = `<div class="panel"><h2>⚖️ Traders<small>Prices move with supply, demand and the town's business cycle — buy low, sell high. Trading level bonus: ${(tradeBonus()*100).toFixed(1)}%.</small></h2>${xpBarHtml("trading")}</div>`;
  html += _econNewsHtml(3);
  NPCS.forEach(npc=>{
    const locked = tLvl < npc.lvl;
    html += `<div class="panel" ${locked?'style="opacity:.55"':''}>
      <h2>${npc.ic} ${npc.n} — ${npc.title}<small>${locked ? `Requires Trading level ${npc.lvl}.` : `"${npc.quip}"`}</small></h2>`;
    if (!locked){
      npc.stock.forEach(it=>{
        const d = S.market.drift[npc.id][it];
        html += `<div class="contract">
          <div class="who">${ITEMS[it].ic} ${ITEMS[it].n} <span style="font-size:11px;">${trendArrow(d)}</span></div>
          <div class="pay">Buy ${fmt(buyPrice(npc,it))} · Sell ${fmt(sellPrice(npc,it))} <span style="color:var(--dim)">· you have ${fmt(itemCount(it))}</span></div>
          <div class="row" style="margin-top:0;width:100%;">
            <button class="btn alt" data-trade="${npc.id}|${it}|1|buy">Buy 1</button>
            <button class="btn alt" data-trade="${npc.id}|${it}|10|buy">Buy 10</button>
            <button class="btn" data-trade="${npc.id}|${it}|1|sell" ${itemCount(it)<1?'disabled':''}>Sell 1</button>
            <button class="btn" data-trade="${npc.id}|${it}|10|sell" ${itemCount(it)<10?'disabled':''}>Sell 10</button>
            <button class="btn deliver" data-trade="${npc.id}|${it}|max|sell" ${itemCount(it)<1?'disabled':''}>Sell all</button>
          </div>
        </div>`;
      });
    }
    html += `</div>`;
  });
  html += renderInventoryPanel();
  return html;
}
function renderUpgrades(){
  let html = `<div class="panel"><h2>🛒 Capital Expenditure<small>One-off purchases. Business case: numbers go up faster.</small></h2>`;
  UPGRADES.forEach(u=>{
    const owned = !!S.upgrades[u.id];
    const gated = u.req && !S.upgrades[u.req];
    html += `<div class="card ${owned?'owned':''} ${gated?'locked':''}">
      <span class="ic">${u.ic}</span>
      <div class="body"><div class="nm">${u.n}</div><div class="ds">${u.ds}${gated ? " — requires "+UPGRADES.find(x=>x.id===u.req).n : ""}</div></div>
      ${owned ? `<span style="color:var(--mint);font-size:11px;">OWNED ✔</span>`
              : `<button class="btn" data-buy="${u.id}" ${(S.coins<u.cost||gated)?'disabled':''}>${fmt(u.cost)} coins</button>`}
    </div>`;
  });
  html += `</div>`;
  return html;
}
function renderGarden(){
  const _ht = S.homeTier||0;
  const slots = plotsUnlocked(_ht);
  if (slots === 0) return `<div class="panel" style="padding:10px;margin-top:8px;text-align:center">
    <p style="font-size:22px;margin:0 0 4px">🌱</p>
    <p style="font-size:12px;font-weight:600;margin:0 0 4px">Cottage Garden</p>
    <p style="color:var(--dim);font-size:11px;margin:0">Upgrade your cottage to Tier 1 to plant your first plot.</p>
  </div>`;
  const now = Date.now();
  let html = `<div class="panel" style="padding:10px;margin-top:8px">
    <h3 style="margin:0 0 4px;font-size:13px">🌱 Cottage Garden</h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 10px">Grow crops passively — harvest when ready.</p>`;
  for (let i=0; i<4; i++){
    if (i >= slots){
      html += `<div style="border:1px dashed #5a4a3a;border-radius:6px;padding:7px 10px;margin-bottom:7px;opacity:.4;text-align:center;font-size:10px;color:var(--dim)">🔒 Plot ${i+1} — unlocks at Cottage Tier ${i+1}</div>`;
      continue;
    }
    const g = S.garden[i];
    if (!g){
      html += `<div style="border:1px solid #5a6a3a;border-radius:6px;padding:8px;margin-bottom:7px">
        <p style="font-size:10px;color:var(--dim);margin:0 0 5px;font-weight:600">Plot ${i+1} — empty</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${GARDEN_CROPS.map(c=>`<button data-plant-garden="${i}|${c.id}" style="background:#1e3a10;color:#a8d870;border:1px solid #3a6a1a;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:10px"${S.coins<c.seedCost?' disabled':''} title="${c.desc} (${c.seedCost}c)">${c.ic} ${c.n} <span style="opacity:.65">${c.seedCost}c</span></button>`).join('')}
        </div>
      </div>`;
    } else {
      const ready = now >= g.readyAt;
      const pct = Math.round(Math.min(1,(now-g.plantedAt)/(g.readyAt-g.plantedAt))*100);
      const minLeft = ready ? 0 : Math.ceil((g.readyAt-now)/60000);
      const crop = GARDEN_CROPS.find(c=>c.id===g.cropId);
      const outStr = crop ? Object.entries(crop.out).map(([id,q])=>`${q}× ${ITEMS[id]?.n||id}`).join(' + ') : '';
      html += `<div style="border:1px solid ${ready?'#40d040':'#3a6a1a'};border-radius:6px;padding:8px;margin-bottom:7px;background:${ready?'rgba(40,200,40,.06)':'transparent'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600">${crop?.ic||'🌱'} ${crop?.n||g.cropId}</span>
          <span style="font-size:10px;color:${ready?'#40d040':'var(--dim)'}">${ready?'✅ Ready!':minLeft+'m left'}</span>
        </div>
        <div style="background:#1a2a0a;border-radius:3px;height:4px;margin-bottom:6px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${ready?'#40d040':'#2a8a1a'};border-radius:3px;transition:width .5s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;color:var(--dim)">Yields: ${outStr}</span>
          ${ready?`<button data-harvest-garden="${i}" style="background:#28c828;color:#000;border:none;padding:3px 12px;border-radius:3px;cursor:pointer;font-size:10px;font-weight:bold">Harvest</button>`:''}
        </div>
      </div>`;
    }
  }
  html += `</div>`;
  return html;
}
function renderNoticeBoard(){
  const nb = S.noticeBoard || { quests:[], lastRefresh:0 };
  const _now = Date.now();
  const _refreshIn = Math.max(0, Math.ceil((30*60*1000 - (_now - (nb.lastRefresh||0))) / 60000));
  const _dch = getDailyChallengeDef();
  const _prog = dailyChallengeProgress();
  const _dc = S.dailyChallenge;
  const _pct = Math.round((_prog.pct||0)*100);
  let html = `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 6px;font-size:13px">📋 Village Notice Board</h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 10px">Community tasks from your neighbours. Complete them for coins and friendship XP.</p>
    ${_econNewsHtml(6)}
    <div style="background:linear-gradient(135deg,#1e3a1e,#0f2a1a);border-radius:8px;padding:10px;margin-bottom:12px;border:1px solid #2e6a2e">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:11px;font-weight:bold;color:#90d870">🎯 Today's Village Challenge</span>
        <span style="font-size:9px;color:#4a7a4a">Resets at midnight</span>
      </div>
      <div style="font-size:12px;color:#c8f0a8;margin-bottom:7px">${_dch?.ic||'🎯'} ${_dch?.ds||'Loading…'}</div>
      <div style="background:#0a1a0a;border-radius:3px;height:5px;margin-bottom:6px;overflow:hidden">
        <div style="width:${_pct}%;height:100%;background:${_prog.done?'#40e040':'#1a8a1a'};transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;color:#5a8a5a">${_prog.cur}/${_prog.max} · Reward: 💰 ${fmt(_dch?.reward||0)}</span>
        ${_dc?.claimed ? `<span style="font-size:10px;color:#40e040;font-weight:bold">✅ Claimed!</span>`
          : _prog.done ? `<button class="btn" data-challenge-claim style="font-size:10px;padding:2px 10px;background:#28c828;color:#000;font-weight:bold">Claim Reward</button>`
          : ''}
      </div>
    </div>`;
  if (!nb.quests || nb.quests.length === 0){
    html += `<p style="color:var(--dim);font-size:12px;font-style:italic;margin:0">No tasks pinned yet. Check back soon!</p>`;
  } else {
    for (const q of nb.quests as any[]){
      const _item = ITEMS[q.itemId];
      const _have = S.items[q.itemId]||0;
      const _canDo = !q.done && _have >= q.qty;
      html += `<div class="card" style="margin-bottom:8px;opacity:${q.done?0.5:1}">
        <span class="ic">${_item?.ic||'📦'}</span>
        <div class="body">
          <div class="nm">${q.npcName} needs ${q.qty}× ${_item?.n||q.itemId}</div>
          <div class="ds">💰 ${fmt(q.reward)} coins · +${q.friendXp} ❤️ XP · ${q.done?'✅ Complete':'have '+_have+'/'+q.qty}</div>
          ${!q.done ? `<button class="btn" data-nbcomplete="${q.id}" ${_canDo?'':'disabled'} style="margin-top:4px;font-size:10px;padding:2px 8px">Hand In</button>` : ''}
        </div>
      </div>`;
    }
    const _done = (nb.quests as any[]).filter(q=>q.done).length;
    html += `<p style="color:var(--dim);font-size:10px;margin:6px 0 0">${_done}/${nb.quests.length} complete · new quests in ~${_refreshIn} min</p>`;
  }
  html += `</div>`;
  return html;
}
function renderHarbourOffice(){
  if (!isHarbourUnlocked()) return `<div class="panel" style="padding:12px;text-align:center">
    <p style="font-size:28px;margin:0 0 8px">⚓</p>
    <h3 style="margin:0 0 8px;font-size:13px">Harbourmaster's Office</h3>
    <p style="color:var(--dim);font-size:12px;margin:0 0 10px">The Harbour District opens when your total level reaches <b>100</b>.</p>
    <p style="color:var(--dim);font-size:11px;margin:0">Current total level: <b>${totalLvl()}</b> / 100</p>
  </div>`;
  const _trips = S.harbour?.boatTrips||0;
  return `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 6px;font-size:13px">⚓ Harbourmaster's Office</h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 10px">"Welcome to Port Salvo — or as the locals call it, Featherstone Harbour. Good seas today." — Reg</p>
    <div class="card" style="margin-bottom:8px">
      <span class="ic">⚓</span>
      <div class="body">
        <div class="nm">Harbour District</div>
        <div class="ds">Boat Hire offers fast travel to the Pier. The Fish Warehouse buys bulk catch at a 30% premium.</div>
      </div>
    </div>
    <div class="card">
      <span class="ic">🗺️</span>
      <div class="body">
        <div class="nm">Boat Trips Taken</div>
        <div class="ds">You've made ${_trips} trip${_trips===1?'':'s'} across the bay.</div>
      </div>
    </div>
  </div>`;
}
function renderBoatHire(){
  if (!isHarbourUnlocked()) return `<div class="panel" style="padding:12px;text-align:center">
    <p style="font-size:28px;margin:0 0 8px">⛵</p>
    <h3 style="margin:0 0 8px;font-size:13px">Boat Hire</h3>
    <p style="color:var(--dim);font-size:12px;margin:0">Unlocks at total level 100. Current: <b>${totalLvl()}</b> / 100</p>
  </div>`;
  const _atPier = Math.hypot(VP.x - 22.5*TILE, VP.y - 38*TILE) < 200;
  return `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 6px;font-size:13px">⛵ Featherstone Boat Hire</h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 10px">10 coins per crossing. Cross the bay to the Pier and back instantly.</p>
    <div class="card" style="margin-bottom:8px">
      <span class="ic">🎣</span>
      <div class="body">
        <div class="nm">Travel to the Pier</div>
        <div class="ds">Cross to the fishing pier on the west side of the bay. (10 coins)</div>
        <button class="btn" data-boat-travel="pier" ${S.coins<10?'disabled':''} style="margin-top:4px;font-size:10px">Hire a Boat (10c)</button>
      </div>
    </div>
    <div class="card">
      <span class="ic">⚓</span>
      <div class="body">
        <div class="nm">Travel to the Harbour</div>
        <div class="ds">Return to the Harbour District from the pier. (10 coins)</div>
        <button class="btn" data-boat-travel="harbour" ${S.coins<10?'disabled':''} style="margin-top:4px;font-size:10px">Return to Harbour (10c)</button>
      </div>
    </div>
    <p style="color:var(--dim);font-size:10px;margin:8px 0 0">You have ${fmt(S.coins)} coins. Trips taken: ${S.harbour?.boatTrips||0}</p>
  </div>`;
}
function renderFishmongerWH(){
  if (!isHarbourUnlocked()) return `<div class="panel" style="padding:12px;text-align:center">
    <p style="font-size:28px;margin:0 0 8px">🐟</p>
    <h3 style="margin:0 0 8px;font-size:13px">Fish Warehouse</h3>
    <p style="color:var(--dim);font-size:12px;margin:0">Unlocks at total level 100. Current: <b>${totalLvl()}</b> / 100</p>
  </div>`;
  const _fish = ["sardine","mackerel","bass","salmon","tuna"];
  const _inStock = _fish.filter(f=>(S.items[f]||0)>0);
  let html = `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 6px;font-size:13px">🐟 Fish Warehouse</h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 10px">"Bring me what the sea gives you. I'll give you 30% above market." — Pearl</p>`;
  if (_inStock.length === 0){
    html += `<p style="color:var(--dim);font-size:12px;font-style:italic;margin:0">No fish in your inventory. Head to the Pier!</p>`;
  } else {
    for (const fid of _inStock){
      const _qty = S.items[fid]||0;
      const _baseV = ITEMS[fid].v;
      const _premV = Math.round(_baseV * 1.3);
      const _total = _qty * _premV;
      html += `<div class="card" style="margin-bottom:6px">
        <span class="ic">${ITEMS[fid].ic}</span>
        <div class="body">
          <div class="nm">${ITEMS[fid].n} × ${_qty}</div>
          <div class="ds">${_premV} coins each (30% premium) = ${fmt(_total)} total</div>
          <button class="btn" data-fw-sell="${fid}" style="margin-top:4px;font-size:10px">Sell All (${fmt(_total)}c)</button>
        </div>
      </div>`;
    }
  }
  html += `</div>`;
  return html;
}
function renderPets(){
  const _activePet = PETS.find(p=>p.id===S.pets.active && S.pets.owned.includes(p.id));
  const _activeBanner = _activePet
    ? `<div style="background:rgba(255,200,80,.12);border:1px solid rgba(255,200,80,.35);border-radius:4px;padding:6px 10px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="font-size:20px">${_activePet.ic}</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--amber)">${_activePet.n} is on shift</div>
          <div style="font-size:11px;color:var(--dim)">${_activePet.ds}</div>
        </div>
       </div>`
    : `<p style="font-size:12px;color:var(--dim);margin:0 0 10px">No companion on shift. Put one on shift to activate their bonus.</p>`;
  let html = `<div class="panel"><h2>🦊 Logistics Companions<small>Rare colleagues found through honest work. One active at a time.</small></h2>${_activeBanner}`;
  PETS.forEach(p=>{
    const owned = S.pets.owned.includes(p.id);
    const active = S.pets.active === p.id;
    const _srcHint = p.src==="contract" ? "delivering contracts" : `${p.src} actions`;
    html += `<div class="card ${owned?'owned':''} ${active?'activepet':''}">
      <span class="ic">${owned?p.ic:"❓"}</span>
      <div class="body">
        <div class="nm">${owned?p.n:"???"} <span class="rar-${p.rar}">[${p.rar}]</span></div>
        <div class="ds">${owned ? p.ds : `Hidden companion — found via ${_srcHint}.`}</div>
      </div>
      ${owned ? (active ? `<span style="color:var(--amber);font-size:11px;font-weight:700">ON SHIFT ⭐</span>`
                        : `<button class="btn" data-pet="${p.id}">Put on shift</button>`) : ""}
    </div>`;
  });
  html += `</div>`;
  return html;
}
function renderFurniturePlacement(): string {
  const _placed = S.placedFurniture || [];
  const _owned = S.ownedFurniture || {};
  const _occupiedSlots = _placed.map(p=>p.slot);
  const _freeSpots = FURN_SPOTS.filter(sp=>!_occupiedSlots.includes(sp.slot));
  const _placedHtml = _placed.length === 0
    ? `<p style="color:var(--dim);font-size:11px;margin:0 0 4px">Nothing placed yet. Buy furniture from 🛋️ Nell's Home Store on the high street.</p>`
    : _placed.map(pf=>{
        const fd=FURNITURE_DEFS[pf.id], sp=FURN_SPOTS[pf.slot];
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:16px">${fd?.ic||'?'}</span>
          <span style="font-size:11px;flex:1"><b>${fd?.n||pf.id}</b> <span style="color:var(--dim)">${sp?.label||''}</span></span>
          <button data-pickup-furn="${pf.id}|${pf.slot}" style="background:#555;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Pick Up</button>
        </div>`;
      }).join('');
  const _ownedEntries = Object.entries(_owned).filter(([,qty])=>(qty as number)>0);
  const _ownedHtml = _ownedEntries.length === 0 ? ''
    : `<p style="font-size:10px;color:var(--dim);margin:8px 0 4px;font-weight:700">OWNED (unplaced):</p>` +
      _ownedEntries.map(([id,qty])=>{
        const fd=FURNITURE_DEFS[id];
        if(!fd) return '';
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">
          <span style="font-size:16px">${fd.ic}</span>
          <span style="font-size:11px;min-width:60px"><b>${fd.n}</b> ×${qty}</span>
          ${_freeSpots.length===0
            ? `<span style="font-size:10px;color:var(--warn)">Room full (9/9)</span>`
            : `<select id="spot-sel-${id}" style="font-size:10px;padding:2px 4px;border-radius:3px;background:#333;color:#fff;border:1px solid #555">
                ${_freeSpots.map(sp=>`<option value="${sp.slot}">${sp.label}</option>`).join('')}
              </select>
              <button data-place-furn="${id}" style="background:#3a5a3a;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Place</button>`
          }
        </div>`;
      }).join('');
  return `<div class="panel" style="padding:10px;margin-top:8px">
    <h3 style="margin:0 0 8px;font-size:13px">🛋️ Room Furniture
      <span style="color:var(--dim);font-weight:normal;font-size:10px">— ${_placed.length}/9 spots filled</span>
    </h3>
    ${_placedHtml}${_ownedHtml}
  </div>`;
}
const REX_BANTER = [
  "What'll it be then?",
  "Quiet night for a Tuesday…",
  "Pool table's free if you fancy a game.",
  "They say this pub's been here since before the quarry. I believe it.",
  "Lovely evening, isn't it? Weather's turning.",
  "Mind the step on your way out. Caught three people on it today.",
  "Local real ale, brewed up in the valley. Can't go wrong.",
  "Regular? Good. I'll remember your face.",
  "Kitchen closes at nine. Don't say I didn't warn you.",
  "The darts board's a bit wonky but we blame gravity.",
  "Aye, the stout's fresh on tonight. New barrel.",
  "You look like you've had a long day. This'll sort you out.",
];
function renderDataCentre(): string {
  const tier = S.grid?.tier || 0;
  const cur = gridTier(tier), next = gridNext(tier);
  let html = `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 4px">🖥️ Data Centre — Power Grid</h3>
    <p style="font-size:11px;color:var(--dim);margin:0 0 8px">Upgrade the grid for a town-wide efficiency boost — faster actions on <b>every</b> skill, working passively even while you're away.</p>
    <div style="display:flex;align-items:center;gap:10px;background:rgba(42,255,208,.08);border:1px solid rgba(42,255,208,.3);border-radius:6px;padding:8px 10px">
      <div style="font-size:22px">${cur.ic}</div>
      <div><div style="font-weight:700">${cur.name}</div>
        <div style="font-size:11px;color:${tier>0?'#2affd0':'var(--dim)'}">${tier>0?`−${Math.round(cur.speedBonus*100)}% action time, all skills`:'No grid power yet'}</div></div>
    </div>
  </div>`;
  if (next && next.cost){
    const canAfford = S.coins>=next.cost.coins && Object.entries(next.cost.items).every(([id,q])=>itemCount(id)>=(q as number));
    const costStr = `${fmt(next.cost.coins)} coins` + Object.entries(next.cost.items).map(([id,q])=>` · ${q}× ${ITEMS[id]?.ic||id} ${ITEMS[id]?.n||id}`).join('');
    html += `<div class="panel" style="padding:10px;margin-top:6px">
      <div style="font-weight:700;font-size:12px;margin-bottom:2px">${next.ic} Upgrade to ${next.name}</div>
      <div style="font-size:11px;color:#2affd0;margin-bottom:6px">${next.ds}</div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:8px">Cost: ${costStr}</div>
      <button data-gridup ${canAfford?'':'disabled'} style="background:${canAfford?'#1a6a5a':'#2a2a2a'};color:${canAfford?'#eafff8':'#777'};border:none;padding:6px 16px;border-radius:4px;cursor:${canAfford?'pointer':'default'};font-size:13px;font-weight:700">${next.ic} Build ${next.name}</button>
    </div>`;
  } else {
    html += `<div class="panel" style="padding:10px;margin-top:6px"><p style="margin:0;font-size:12px;color:#2affd0">⚡ Smart Grid online — the town runs at peak efficiency. Fully upgraded!</p></div>`;
  }
  return html;
}
function renderRoboticsLab(): string {
  const skills = Object.keys(SKILL_GROUP);
  const _active = skills.filter(s => S.automatons?.[s]).length;
  let html = `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 4px">🤖 Automation Lab</h3>
    <p style="font-size:11px;color:var(--dim);margin:0">Build helper automatons from crafted parts and assign one per skill. They work passively — even while you're away. <b>${_active}/${skills.length}</b> skills automated.</p>
  </div>`;
  for (const sk of skills){
    const cur = S.automatons?.[sk];
    const curDef = automatonById(cur);
    html += `<div class="panel" style="padding:8px 10px;margin-top:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-weight:700;font-size:12px">${SKILLS[sk].ic} ${SKILLS[sk].n}</div>
        ${curDef ? `<span style="font-size:11px;color:#4aff88;white-space:nowrap">${curDef.ic} ${curDef.name} · ${curDef.ds}</span>` : `<span style="font-size:11px;color:var(--dim)">no automaton</span>`}
      </div>`;
    if (curDef){
      html += `<div style="margin-top:6px"><button data-autoscrap="${sk}" style="background:#5a3a2a;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Dismantle</button></div>`;
    } else {
      html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">`;
      for (const a of automatonsForSkill(sk)){
        const canAfford = S.coins>=a.cost.coins && Object.entries(a.cost.items).every(([id,q])=>itemCount(id)>=(q as number));
        const costStr = `${fmt(a.cost.coins)}c` + Object.entries(a.cost.items).map(([id,q])=>` · ${q}× ${ITEMS[id]?.ic||id}`).join('');
        html += `<button data-autobuild="${sk}|${a.id}" ${canAfford?'':'disabled'} style="flex:1;min-width:140px;background:${canAfford?'#233a52':'#2a2a2a'};color:${canAfford?'#cfe6ff':'#777'};border:1px solid ${canAfford?'#3a6a9a':'#3a3a3a'};padding:6px 8px;border-radius:4px;cursor:${canAfford?'pointer':'default'};font-size:11px;text-align:left">
          <b>${a.ic} ${a.name}</b><br>${a.ds}<br><span style="font-size:10px;opacity:.85">${costStr}</span></button>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  return html;
}
function renderNightclub(): string {
  const _th = clubTheme();
  const _mins = Math.max(1, Math.ceil(msToNextTheme()/60000));
  const _danceMs = (S.danceBuff||0) - Date.now();
  const _line = _th.lines[Math.floor(Date.now()/6000) % _th.lines.length];
  const _buff = _danceMs > 0
    ? `<div style="background:rgba(255,255,255,.06);border:1px solid ${_th.neon}66;border-radius:4px;padding:6px 10px;font-size:12px;color:${_th.neon};margin-bottom:8px">💃 On the floor! All action speed +15% for ${Math.ceil(_danceMs/60000)} more min.</div>`
    : "";
  const _rotation = CLUB_THEMES.map(x => x.id===_th.id ? `<b style="color:${_th.neon}">${x.name}</b>` : x.name).join(" · ");
  return `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 4px;color:${_th.neon}">${_th.emoji} ${_th.name}</h3>
    <p style="font-size:11px;color:var(--dim);margin:0 0 8px">${_th.tag} · next night in ~${_mins} min</p>
    <p style="font-size:12px;margin:0 0 10px"><i>"${_line}"</i></p>
    ${_buff}
    <button data-dance style="background:${_th.neon};color:#160a12;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700">💃 Hit the dance floor</button>
    <p style="font-size:10px;color:var(--dim);margin:12px 0 0">Themed nights rotate every 7 game days:<br>${_rotation}</p>
  </div>`;
}
function renderPub(): string {
  const _now = Date.now();
  const _today = getTodayStr();
  if ((S.pintDate||"") !== _today){ S.pintsTonight = 0; S.pintDate = _today; }
  const _pintMs = (S.pintBuff||0) - _now;
  const _drunkMs = (S.drunkUntil||0) - _now;
  const _buffHtml = _pintMs > 0
    ? `<div class="panel" style="background:rgba(120,60,10,.18);border:1px solid #8a4020;padding:8px;margin-bottom:8px"><b style="color:#e09030">🍺 Pint glow active!</b><br><span style="color:var(--dim);font-size:11px">Actions 10% faster · ${Math.ceil(_pintMs/1000)}s remaining</span></div>`
    : "";
  const _drunkHtml = _drunkMs > 0
    ? `<div class="panel" style="background:rgba(255,200,20,.12);border:1px solid #e8a020;padding:8px;margin-bottom:8px"><b style="color:#e8a020">🌀 A bit wobbly…</b><br><span style="color:var(--dim);font-size:11px">The room is spinning. Sobering up in ${Math.ceil(_drunkMs/1000)}s.</span></div>`
    : "";
  const _banter = REX_BANTER[Math.floor(_now/10000) % REX_BANTER.length];
  const _pints = S.pintsTonight || 0;
  const _canBuy = S.coins >= 8;
  return `
    ${_buffHtml}${_drunkHtml}
    <div class="panel" style="padding:10px">
      <p style="margin:0 0 4px"><b>Rex</b> <span style="color:var(--dim);font-size:11px">— Landlord, The Rose & Pallet</span></p>
      <p style="font-style:italic;color:#c89040;font-size:12px;margin:0 0 10px">"${_banter}"</p>
      <hr style="border:none;border-top:1px solid #3a2810;margin:8px 0">
      <p style="margin:0 0 6px"><b>Order at the Bar</b></p>
      <p style="color:var(--dim);font-size:12px;margin:0 0 8px">Pints tonight: ${_pints}${_pints>=3?' <span style="color:#e8a020">— Rex is giving you a look.</span>':""}</p>
      <button data-buy-pint="1" style="background:${_canBuy?"#5a2010":"#444"};color:#fff;border:none;padding:6px 18px;border-radius:4px;cursor:pointer;font-size:13px"${_canBuy?"":" disabled"}>🍺 Buy a Pint — 8 coins</button>
      ${S.coins < 8 ? '<p style="color:var(--warn);font-size:11px;margin:6px 0 0">Not enough coins.</p>' : ""}
      <p style="color:var(--dim);font-size:11px;margin:10px 0 0">Each pint: 10% action speed boost for 3 min. Three pints and the room gets a bit… interesting.</p>
    </div>`;
}
function renderFurnitureShop(): string {
  const _owned = S.ownedFurniture || {};
  const _allItems = Object.entries(FURNITURE_DEFS);
  const _buyRows = _allItems.map(([id,fd])=>{
    const have = _owned[id]||0;
    const canBuy = S.coins >= fd.price;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <span style="font-size:20px">${fd.ic}</span>
      <div style="flex:1;font-size:11px"><b>${fd.n}</b>${have>0?` <span style="color:var(--mint)">×${have} owned</span>`:''}</div>
      <button data-buy-furn="${id}" style="background:${canBuy?'#5a3a1a':'#444'};color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px"${canBuy?'':' disabled'}>${fmt(fd.price)}c</button>
    </div>`;
  }).join('');
  const _craftable = _allItems.filter(([,fd])=>fd.craftIn);
  const _craftRows = _craftable.map(([id,fd])=>{
    const ing = Object.entries(fd.craftIn!).map(([k,v])=>`${ITEMS[k]?.ic||''}${ITEMS[k]?.n||k}×${v}`).join(', ');
    const canCraft = Object.entries(fd.craftIn!).every(([k,v])=>(S.items[k]||0)>=(v as number));
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <span style="font-size:20px">${fd.ic}</span>
      <div style="flex:1;font-size:11px"><b>${fd.n}</b><br><span style="color:var(--dim)">${ing}</span></div>
      <button data-craft-furn="${id}" style="background:${canCraft?'#1a5a3a':'#444'};color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px"${canCraft?'':' disabled'}>Craft</button>
    </div>`;
  }).join('');
  return `<div class="panel" style="padding:10px;margin-bottom:8px">
    <h2 style="margin:0 0 4px">🛋️ Nell's Home Store</h2>
    <p style="color:var(--dim);font-size:12px;margin:0 0 10px">Nell gives you a warm smile. "See anything you like?"</p>
    <h3 style="font-size:12px;margin:0 0 8px">🛍️ Buy Furniture</h3>
    ${_buyRows}
  </div>
  <div class="panel" style="padding:10px;margin-bottom:8px">
    <h3 style="font-size:12px;margin:0 0 6px">🪚 Craft Furniture <span style="color:var(--dim);font-weight:normal;font-size:10px">— uses materials from your inventory</span></h3>
    ${_craftRows}
  </div>
  ${renderInventoryPanel()}`;
}
function renderSeasonalMarket(): string {
  const _sd = SEASON_DEFS[getSeason()];
  const _fst = isFestivalActive();
  const _sitems = _sd.items.map(id=>({ id, it:ITEMS[id], qty:(S.items[id]||0) }));
  const _hasSome = _sitems.some(x=>x.qty>0);
  const _craftedList = _sd.items.map(id=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">${ITEMS[id].ic}</span><div style="flex:1;font-size:11px"><b>${ITEMS[id].n}</b><br><span style="color:var(--dim)">In stock: ${S.items[id]||0} &nbsp;·&nbsp; Crafted: ${S.prod[id]||0} &nbsp;·&nbsp; Sell: ${fmt(Math.round(ITEMS[id].v*1.5))}c each</span></div></div>`).join('');
  const _sellBtn = _hasSome ? `<button data-season-sell="1" style="background:#3a6a1a;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🎪 Sell all ${_sd.ic} goods</button>` : `<p style="color:var(--dim);font-size:11px;margin:0">Head to the Artisan's Shed to craft some first.</p>`;
  if (!_fst){
    // off-season: show normal seasonal sell panel
    const _days = daysLeftInSeason();
    return `<div class="panel" style="background:linear-gradient(135deg,${_sd.col}30,${_sd.col2}18);border:1px solid ${_sd.col}60;padding:12px;margin-bottom:8px"><h2 style="margin:0 0 4px">${_sd.ic} ${_sd.n} Season</h2><p style="color:var(--dim);font-size:12px;margin:0 0 6px">${_sd.blurb}</p><p style="font-size:11px;color:${_sd.col2}">⏳ ${_days} day${_days===1?'':'s'} left this season</p><p style="font-size:10px;color:var(--dim);margin:4px 0 0">The seasonal festival runs mid-month — check back then for games, raffle and grand feast!</p></div><div class="panel" style="padding:10px;margin-bottom:8px"><h3 style="margin:0 0 8px;font-size:13px">🎪 Seasonal Sell <span style="color:var(--dim);font-weight:normal;font-size:10px">— 1.5× base value while in season</span></h3>${_sellBtn}</div><div class="panel" style="padding:10px">${_craftedList}</div>${renderInventoryPanel()}`;
  }
  // FESTIVAL MODE
  const _daysLeft = daysLeftInFestival();
  const _today = getTodayStr();
  const _fest = S.festival || { raffleDate:"", raffleCount:0, gamesDate:"", feastId:"", attended:[], notified:"" };
  const _raffleLeft = Math.max(0, 5 - (_fest.raffleDate === _today ? _fest.raffleCount : 0));
  const _gamesAvail = _fest.gamesDate !== _today;
  const _feastKey = _fst.season + new Date().getFullYear();
  const _feastDone = _fest.feastId === _feastKey;
  const _feastItems = _fst.raffleItems;
  const _feastQty = _fst.feastQty;
  const _canFeast = !_feastDone && _feastItems.every(id=>(S.items[id]||0)>=_feastQty);
  const _feastNeeds = _feastItems.map(id=>`${ITEMS[id]?.ic||''} ${ITEMS[id]?.n||id} ×${_feastQty} (have ${S.items[id]||0})`).join(', ');
  return `<div class="panel" style="background:linear-gradient(135deg,${_fst.col}40,${_fst.col2}28);border:2px solid ${_fst.col};padding:14px;margin-bottom:10px">
    <h2 style="margin:0 0 4px">${_fst.ic} ${_fst.n} — Festival!</h2>
    <p style="font-size:12px;color:var(--dim);margin:0 0 6px">Double friendship XP on all gifts and chats during the festival.</p>
    <p style="font-size:11px;color:${_fst.col2}">🎉 ${_daysLeft} day${_daysLeft===1?'':'s'} remaining</p>
  </div>
  <div class="panel" style="padding:10px;margin-bottom:8px">
    <h3 style="margin:0 0 6px;font-size:13px">🎟️ Raffle <span style="color:var(--dim);font-weight:normal;font-size:10px">— 25c per ticket · max 5 per day · ${_raffleLeft} left today</span></h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 8px">Win seasonal crafts, coins, or bonus XP — luck of the draw!</p>
    ${_raffleLeft > 0 ? `<button data-festival-raffle="1" style="background:#7a3a8a;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🎟️ Buy Raffle Ticket — 25c</button>` : `<p style="color:var(--dim);font-size:11px;margin:0">Come back tomorrow for more tickets.</p>`}
  </div>
  <div class="panel" style="padding:10px;margin-bottom:8px">
    <h3 style="margin:0 0 6px;font-size:13px">🎡 Village Games <span style="color:var(--dim);font-weight:normal;font-size:10px">— 15c entry · once per day</span></h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 8px">Join in the fun and earn friendship with 3 random villagers.</p>
    ${_gamesAvail ? `<button data-festival-games="1" style="background:#3a6a8a;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🎡 Enter Village Games — 15c</button>` : `<p style="color:var(--amber);font-size:11px;margin:0">✅ You've played today — come back tomorrow!</p>`}
  </div>
  <div class="panel" style="padding:10px;margin-bottom:8px">
    <h3 style="margin:0 0 6px;font-size:13px">🍽️ Grand Feast Order <span style="color:var(--dim);font-weight:normal;font-size:10px">— once per festival · 400c reward</span></h3>
    <p style="color:var(--dim);font-size:11px;margin:0 0 8px">Provide the festival feast: ${_feastNeeds}</p>
    ${_feastDone ? `<p style="color:var(--amber);font-size:11px;margin:0">✅ Feast provided — well done!</p>` : _canFeast ? `<button data-festival-feast="1" style="background:#6a3a1a;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🍽️ Provide the Grand Feast — 400c</button>` : `<p style="color:var(--dim);font-size:11px;margin:0">Craft more seasonal goods to fulfil the feast order.</p>`}
  </div>
  <div class="panel" style="padding:10px;margin-bottom:8px">
    <h3 style="margin:0 0 6px;font-size:13px">🎪 Festival Sell <span style="color:var(--dim);font-weight:normal;font-size:10px">— 1.5× base value</span></h3>
    ${_sellBtn}
  </div>
  <div class="panel" style="padding:10px">${_craftedList}</div>
  ${renderInventoryPanel()}`;
}
function renderBeautification(){
  const _bought = S.beautification || [];
  const _pv = villagePrestige();
  const _maxPv = BEAUTIFICATION.reduce((a,b)=>a+b.prestige,0);
  const _cpm = prestigeCoinsPm();
  // active bonuses summary
  const _bonuses = PRESTIGE_THRESHOLDS.filter(r=>_pv>=r.at);
  const _next = PRESTIGE_THRESHOLDS.find(r=>_pv<r.at);
  let html = `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 4px;font-size:13px">🌸 Village Beautification Fund</h3>
    <p style="font-size:11px;color:var(--dim);margin:0 0 8px">Invest in Featherstone's beauty. Each project raises Village Prestige and unlocks passive bonuses.</p>
    <div style="background:rgba(255,255,255,.06);border-radius:4px;padding:6px 10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:700">✨ Village Prestige</span>
        <span style="font-size:13px;color:#ffd666;font-weight:700">${_pv} / ${_maxPv}</span>
      </div>
      <div style="background:rgba(255,255,255,.1);border-radius:2px;height:5px;margin-bottom:6px">
        <div style="background:#ffd666;height:5px;border-radius:2px;width:${Math.round(_pv/_maxPv*100)}%"></div>
      </div>
      ${_bonuses.length ? `<div style="font-size:10px;color:#4aff88">${_bonuses.map(r=>r.label).join(" · ")}</div>` : `<div style="font-size:10px;color:var(--dim)">Reach prestige 15 to unlock bonuses.</div>`}
      ${_next ? `<div style="font-size:10px;color:var(--dim);margin-top:2px">Next bonus at ${_next.at} prestige: ${_next.label}</div>` : `<div style="font-size:10px;color:#ffd666;margin-top:2px">🏆 All prestige bonuses unlocked!</div>`}
      ${_cpm>0 ? `<div style="font-size:10px;color:#4aff88;margin-top:2px">+${_cpm} coin${_cpm>1?"s":""}/min passive income</div>` : ""}
    </div>`;
  // projects grouped by category
  const _cats = ["Gardens","Paths","Lighting","Wildlife","Landmarks"];
  const _catIc: Record<string,string> = { Gardens:"🌸", Paths:"🪨", Lighting:"💡", Wildlife:"🐦", Landmarks:"🏛️" };
  _cats.forEach(cat=>{
    const _items = BEAUTIFICATION.filter(b=>b.cat===cat);
    const _doneCount = _items.filter(b=>_bought.includes(b.id)).length;
    html += `<div style="margin-bottom:4px"><p style="font-size:11px;font-weight:700;color:var(--dim);margin:8px 0 4px">${_catIc[cat]} ${cat} (${_doneCount}/${_items.length})</p>`;
    _items.forEach(b=>{
      const _owned = _bought.includes(b.id);
      const _canAfford = S.coins >= b.cost;
      html += `<div class="card" style="margin-bottom:4px;opacity:${_owned?0.7:1}">
        <span class="ic">${b.ic}</span>
        <div class="body">
          <div class="nm">${b.n} <span style="font-size:9px;color:var(--dim)">+${b.prestige} prestige</span></div>
          <div class="ds">${b.ds}</div>
        </div>
        ${_owned
          ? `<span style="color:#4aff88;font-size:11px;white-space:nowrap">✓ Done</span>`
          : `<button class="btn" data-beautify="${b.id}" ${_canAfford?'':'disabled'} style="font-size:10px;white-space:nowrap">${fmt(b.cost)}c</button>`}
      </div>`;
    });
    html += `</div>`;
  });
  html += `<p style="font-size:10px;color:var(--dim);margin:8px 0 0">${_bought.length} of 50 projects funded · ${fmt(S.coins)} coins available</p></div>`;
  return html;
}
function renderSettings(){
  return `<div class="panel"><h2>💾 Save & Data<small>${HAS_LS ? "Auto-saves to this browser every 15s." : "⚠️ Browser storage unavailable here — use export/import save strings."}</small></h2>
    <p style="font-size:12px;color:var(--dim);">Export your save string and keep it somewhere safe. Import it on any device.</p>
    <div class="row">
      <button class="btn" id="btn-export">Export save</button>
      <button class="btn alt" id="btn-import">Import save</button>
      <button class="btn alt" id="btn-wipe" style="color:var(--red);border-color:var(--red);">Wipe save</button>
    </div>
    <textarea id="savebox" placeholder="Save string appears here / paste one here to import" style="margin-top:10px;"></textarea>
    <p style="font-size:11px;color:var(--dim);margin-top:10px;">Stats: ${fmt(S.counters.actions)} actions · ${fmt(S.counters.contracts)} contracts delivered · Total level ${totalLvl()}</p>
  </div>
  <div class="panel"><h2>🗺️ About &amp; Roadmap<small>What's playable now and what's coming next.</small></h2>
    <p style="font-size:12px;color:var(--dim);">BuyrWorld is an early prototype, updated often.</p>
    <div class="row"><button class="btn" id="btn-roadmap">Open v0.10 Roadmap</button></div>
  </div>`;
}
function _animCharPreview(){
  const cv = document.getElementById("char-preview") as HTMLCanvasElement;
  if (!cv || S.tab !== "character"){ _charPreviewRaf = 0; return; }
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
  const W2 = cv.width, H2 = cv.height, t2 = performance.now()/1000;
  ctx.clearRect(0,0,W2,H2);
  ctx.fillStyle="#9fd6a8"; ctx.fillRect(0,0,W2,H2);
  ctx.fillStyle="#7cbf86"; ctx.fillRect(0,Math.round(H2*0.75),W2,Math.round(H2*0.25));
  for(let _fi=0;_fi<4;_fi++){ ctx.fillStyle=(["#e84060","#ffd666","#f86040","#6fb7ff"] as string[])[_fi]; ctx.beginPath(); ctx.arc(14+_fi*24,Math.round(H2*0.79),3,0,7); ctx.fill(); }
  ctx.save(); ctx.translate(Math.round(W2/2), H2-16); ctx.scale(3,3);
  drawPerson(ctx,0,0,plHair(),plShirt(),t2,true,1,null,"down",plSkin(),plTrousers(),null,plGender()==='female',1.0,plHat(),plHatColor(),{...plOpts(),stride:2.4});
  ctx.restore();
  _charPreviewRaf = requestAnimationFrame(_animCharPreview);
}
function drawCharPreview(canvasId: string){
  if (canvasId === "char-preview"){
    cancelAnimationFrame(_charPreviewRaf);
    _animCharPreview();
    return;
  }
  // hud-portrait: single static frame
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const ctx = (cv as HTMLCanvasElement).getContext("2d");
  if (!ctx) return;
  const W2 = (cv as HTMLCanvasElement).width, H2 = (cv as HTMLCanvasElement).height;
  ctx.clearRect(0,0,W2,H2);
  ctx.fillStyle="#9fd6a8"; ctx.fillRect(0,0,W2,H2);
  ctx.save(); ctx.translate(Math.round(W2/2), H2-12);
  drawPerson(ctx,0,0,plHair(),plShirt(),0,false,1,null,"down",plSkin(),plTrousers(),null,plGender()==='female',1.0,plHat(),plHatColor(),plOpts());
  ctx.restore();
}
function renderPoliceCellPanel(){
  const _now = Date.now();
  const _cellUntil = S.caught?.cellUntil || 0;
  const _maxTime = S.caught?.maxTime || DAY_DURATION_MS;
  const _remaining = Math.max(0, _cellUntil - _now);
  const _free = _remaining <= 0;
  const _gameHrsLeft = Math.ceil(_remaining / (DAY_DURATION_MS / 24));
  const _minsLeft = Math.ceil(_remaining / 60000);
  const _pct = _free ? 0 : Math.round((_remaining / _maxTime) * 100);
  if (_free){
    return `<div class="panel" style="padding:10px">
      <h3 style="color:#4aff88;margin:0 0 6px">🔓 Sentence served!</h3>
      <p style="font-size:12px;color:var(--dim);margin:0 0 10px">Try to stay out of trouble, ${pName()}. Officer Plonk is watching.</p>
      <button data-leave-cell style="background:#2a5a2a;color:#fff;border:none;padding:6px 18px;border-radius:4px;cursor:pointer;font-size:13px">🚶 Walk out</button>
    </div>`;
  }
  const _dealCost = Math.max(20, Math.round(S.coins * 0.15));
  const _canDeal = S.coins >= _dealCost;
  return `<div class="panel" style="padding:10px">
    <h3 style="color:#ff8870;margin:0 0 4px">🚔 In Custody — Featherstone Constabulary</h3>
    <p style="font-size:11px;color:var(--dim);margin:0 0 8px">${_gameHrsLeft} game-hours remaining (~${_minsLeft} real min)</p>
    <div style="height:6px;background:rgba(255,255,255,.1);border-radius:3px;margin-bottom:10px">
      <div style="height:6px;background:#ff5040;border-radius:3px;width:${_pct}%;transition:width 1s"></div>
    </div>
    <p style="font-size:11px;color:var(--dim);margin:0 0 8px">Your cellmate: <b>Derek</b> — in for "aggressive parking".</p>
    <p style="font-size:10px;color:var(--dim);margin:0 0 10px">💡 Officer Plonk does deals if you've got the coins.</p>
    ${_canDeal
      ? `<button data-deal-cell style="background:#4a3a1a;color:#ffd666;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:12px">🤝 Make a deal — pay ${fmt(_dealCost)} coins (halve sentence)</button>`
      : `<p style="font-size:11px;color:var(--dim);margin:0">Need ${fmt(_dealCost)} coins to make a deal.</p>`}
  </div>`;
}
function renderPoliceStationPanel(){
  const _stolen = S.stolen;
  const _fine = Math.floor(S.coins * 0.10);
  return `<div class="panel" style="padding:10px">
    <h3 style="margin:0 0 4px">🚔 Featherstone Police Station</h3>
    <p style="font-size:11px;color:var(--dim);margin:0 0 10px">Serving Featherstone Valley since 1954. Officer Plonk on duty.</p>
    <p style="font-size:12px;margin:0 0 8px"><b>Officer Plonk:</b> <i>"Keep it cosy out there."</i></p>
    ${_stolen
      ? `<div style="background:rgba(255,200,40,.1);border:1px solid rgba(255,200,40,.3);border-radius:4px;padding:8px 10px;margin-bottom:8px">
          <p style="font-size:11px;color:#ffd666;margin:0 0 6px">🤚 You're carrying stolen goods. Best to come clean now — reduced sentence of 12 game-hours instead of 24.</p>
          <button data-surrender style="background:#5a3a1a;color:#ffd666;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:12px">🙋 Hand yourself in (pay ${fmt(_fine)} coin fine, 12 game-hr sentence)</button>
        </div>`
      : `<p style="font-size:11px;color:var(--dim);margin:0">Nothing to report? Good. Keep it that way.</p>`}
  </div>`;
}
function renderCharacterCustomisation(){
  const ap = S.appearance || DEFAULT_APPEARANCE;
  function swatchRow(label, arr, field){
    return `<div class="cust-row"><div class="cust-lbl">${label}</div><div class="cust-swatches">${
      arr.map(c=>`<button class="swatch${ap[field]===c.v?' sel':''}" data-cust="${field}" data-val="${c.v}" style="background:${c.v||'rgba(120,90,60,.25)'};" title="${c.label}" aria-label="${c.label}"></button>`).join('')
    }</div></div>`;
  }
  function textRow(label, arr, field){
    return `<div class="cust-row"><div class="cust-lbl">${label}</div><div class="cust-swatches" style="flex-wrap:wrap;gap:4px">${
      arr.map(c=>`<button class="swatch-txt${ap[field]==c.v?' sel':''}" data-cust="${field}" data-val="${c.v}" aria-label="${c.label}">${c.label}</button>`).join('')
    }</div></div>`;
  }
  const genderRow = `<div class="cust-row"><div class="cust-lbl">Gender</div><div class="cust-swatches"><button class="swatch-txt${ap.gender==='male'?' sel':''}" data-cust="gender" data-val="male">♂ Male</button><button class="swatch-txt${ap.gender==='female'?' sel':''}" data-cust="gender" data-val="female">♀ Female</button></div></div>`;
  return `<div class="panel cust-panel">
    <h2>👤 Character<small>Customise your look. Saved automatically.</small></h2>
    <div class="cust-preview-wrap">
      <canvas id="char-preview" width="120" height="140" style="image-rendering:pixelated;display:block;border:2px solid var(--edge);background:#9fd6a8;"></canvas>
      <div class="cust-name">${S.playerName || "Founder"}</div>
    </div>
    ${genderRow}
    ${swatchRow("Skin Tone", SKIN_TONES, "skin")}
    ${swatchRow("Hair", HAIR_COLOURS, "hair")}
    ${textRow("Hair Style", HAIR_STYLE_LABELS, "hairStyle")}
    ${ap.gender!=='female' ? textRow("Facial Hair", FACIAL_HAIR_STYLES, "facialHair") : ''}
    ${swatchRow("Eye Colour", EYE_COLOURS, "eyeColor")}
    ${swatchRow("Shirt", SHIRT_COLOURS, "shirt")}
    ${swatchRow("Jacket", JACKET_COLOURS, "jacket")}
    ${swatchRow("Trousers", TROUSER_COLOURS, "trousers")}
    ${swatchRow("Shoes", SHOE_COLOURS, "shoes")}
    ${textRow("Accessory", ACCESSORY_STYLES, "accessory")}
    ${ap.accessory==='scarf' ? swatchRow("Scarf Colour", SCARF_COLOURS, "scarfColor") : ''}
    ${textRow("Hat", HAT_STYLES, "hat")}
    ${swatchRow("Hat Colour", HAT_COLOURS, "hatColor")}
  </div>`;
}
function interiorHtml(title){
  const cw = icanvasW(), ch = icanvasH(), r = pixelScale();
  const stations = STATION_DEFS[S.tab] || [];
  const lbls = stations.map(st=>{
    const lvl = findAction(st.skill, st.id)?.lvl || 0;
    const locked = skillLvl(st.skill) < lvl;
    const topPct = ((st.fy + 0.12) * 100).toFixed(1);
    return `<div class="ilbl" style="left:${(st.fx*100).toFixed(1)}%;top:${topPct}%">${st.ic} ${st.lbl}${locked?` <span class="ilbl-lock">Lv${lvl}</span>`:''}</div>`;
  }).join('');
  const depotLbl = S.tab==="contracts" ? `<div class="ilbl" style="left:73%;top:5%;background:rgba(255,248,230,.96);color:#453423;font:700 9px 'IBM Plex Mono',monospace;padding:2px 6px;border-radius:3px;pointer-events:none">BUYR FREIGHT</div>` : "";
  return `<div class="panel" style="padding:8px;"><div class="int-canvas-wrap" style="max-width:${cw*2}px;margin:0 auto;position:relative;">
    <canvas id="interior" width="${cw*r}" height="${ch*r}" style="image-rendering:pixelated;display:block;width:100%;aspect-ratio:${cw}/${ch};max-width:${cw*2}px;"></canvas>
    ${lbls}${depotLbl}<div class="ilbl-room">${title.split("·")[0].split("—")[0].trim()}</div><div class="ilbl-exit">🚪 Walk south to leave ↓</div>
    <div id="zone-card-canvas" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(30,22,14,.92);border:2px solid #ffd666;color:#ffd666;font:700 13px/1.5 'IBM Plex Mono',monospace;padding:8px 20px;border-radius:5px;text-align:center;pointer-events:none;white-space:nowrap;z-index:10;transition:opacity .5s"></div>
    <div id="interior-overlay" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;"></div>
  </div>
  <div class="vhint">${title} · WASD/tap · walk south to exit</div></div>`;
}
function renderAch(){
  if (!S.ach) S.ach = {};
  const earned = ACH.filter(a=>S.ach[a.id]);
  const locked  = ACH.filter(a=>!S.ach[a.id]);
  const coinsFromAch = earned.reduce((s,a)=>s+a.r,0);
  let html = `<div class="panel"><h2>🏆 Trophy Room<small>${earned.length} / ${ACH.length} awards · ${fmt(coinsFromAch)} coins earned</small></h2>`;
  if (earned.length){
    html += `<p style="font-size:11px;color:var(--mint);margin:4px 0 6px;font-weight:700">✔ EARNED (${earned.length})</p>`;
    earned.forEach(a=>{
      html += `<div class="card owned"><span class="ic">${a.ic}</span><div class="body"><div class="nm">${a.n}</div><div class="ds">${a.ds}</div></div><span style="font-size:11px;color:var(--mint)">+${fmt(a.r)} ✔</span></div>`;
    });
  }
  if (locked.length){
    html += `<p style="font-size:11px;color:var(--dim);margin:10px 0 6px;font-weight:700">🔒 LOCKED (${locked.length})</p>`;
    locked.forEach(a=>{
      const p = ACH_PROG[a.id] ? ACH_PROG[a.id]() : null;
      const pct = p ? Math.round(p.cur/p.max*100) : 0;
      const prog = p ? `<div style="height:3px;background:#333;border-radius:2px;margin-top:4px"><div style="height:3px;background:#4a8aee;border-radius:2px;width:${pct}%"></div></div><div style="font-size:10px;color:#6a8aaa;margin-top:2px">${fmt(p.cur)} / ${fmt(p.max)}</div>` : '';
      html += `<div class="card locked"><span class="ic">🔒</span><div class="body"><div class="nm">${a.ds}</div>${prog}</div><span style="font-size:11px;color:var(--dim)">+${fmt(a.r)}</span></div>`;
    });
  }
  html += `</div>`;
  return html;
}
let _lastRoomTab = null;
function renderMain(){
  const m = $("#main");
  const _entering = INTERIOR_TABS.has(S.tab) && S.tab !== _lastRoomTab;
  if (_entering){
    IP.x = icanvasW()/2; IP.y = icanvasH() - 34;
    IP.tx = null; IP.ty = null; IP.moving = false; IP.dir = "up";
    _intChat = null;   // clear any resident chat from the previous room
  }
  _lastRoomTab = INTERIOR_TABS.has(S.tab) ? S.tab : null;
  const banner = tutBannerHtml();
  if (S.tab==="village") m.innerHTML = banner + `<div class="village-wrap">
      <div class="panel village-canvas-panel" style="padding:8px;margin-bottom:0;">
        <div class="village-canvas-rel">
          <canvas id="village" width="${VIEW_W*pixelScale()}" height="${VIEW_H*pixelScale()}" style="image-rendering:pixelated;display:block;width:100%;aspect-ratio:${VIEW_W}/${VIEW_H};"></canvas>
          <div id="village-overlay"></div>
          <div id="village-clock"></div>
        </div>
        <div class="vhint">Tap to walk · tap rocks, buildings, stalls and villagers to interact · WASD/arrows also work</div>
      </div>
      <div class="village-sidebar" id="village-sidebar">${renderInventoryPanel()}</div>
    </div>`;
  else if (S.tab==="character") m.innerHTML = banner + renderCharacterCustomisation();
  else if (S.tab==="settings") m.innerHTML = banner + renderSettings();
  else {
    const _withRoom = (title, body) => banner + `<div class="int-layout"><div class="int-left">${interiorHtml(title)}</div><div class="int-right">${body}</div></div>`;
    if (S.tab==="contracts") m.innerHTML = _withRoom("📦 Inside the Depot — shelves fill up as your warehouse does", renderContracts());
    else if (S.tab==="trade") m.innerHTML = _withRoom("⚖️ Inside the Market Hall", renderTrade());
    else if (S.tab==="upgrades") m.innerHTML = _withRoom("🛒 Inside the Town Hall — CapEx office", renderUpgrades());
    else if (S.tab==="pets") m.innerHTML = _withRoom("🐾 Inside the Companion Barn — your crew hangs out here", renderPets());
    else if (S.tab==="ach") m.innerHTML = _withRoom("🏆 Inside the Trophy Hall", renderAch());
    else if (S.tab==="woodcutting") m.innerHTML = _withRoom("🪓 Inside the Sawmill", renderSkillPanel(S.tab));
    else if (S.tab==="fishing") m.innerHTML = _withRoom("🎣 Down at the Pier", renderSkillPanel(S.tab));
    else if (S.tab==="foraging") m.innerHTML = _withRoom("🌿 Wren's Forager Hut", renderSkillPanel(S.tab));
    else if (S.tab==="crafting") m.innerHTML = _withRoom("🧺 The Artisan's Shed", renderSkillPanel(S.tab));
    else if (S.tab==="village_fund") m.innerHTML = _withRoom("🌸 The Village Fund", renderBeautification());
    else if (S.tab==="seasonal_market"){ m.innerHTML = _withRoom("🎪 Seasonal Market", renderSeasonalMarket()); }
    else if (S.tab==="bike_shop") m.innerHTML = _withRoom("🚲 Featherstone Cycle Shop", renderBikeShop());
    else if (S.tab==="furniture_shop") m.innerHTML = _withRoom("🛋️ Nell's Home Store", renderFurnitureShop());
    else if (S.tab==="pub") m.innerHTML = _withRoom("🍺 The Rose & Pallet", renderPub());
    else if (S.tab==="nightclub") m.innerHTML = _withRoom("🪩 Club Featherstone", renderNightclub());
    else if (S.tab==="robotics_lab") m.innerHTML = _withRoom("🤖 Automation Lab", renderRoboticsLab());
    else if (S.tab==="data_centre") m.innerHTML = _withRoom("🖥️ Data Centre", renderDataCentre());
    else if (S.tab==="police_station") m.innerHTML = _withRoom("🚔 Featherstone Police Station", renderPoliceStationPanel());
    else if (S.tab==="police_cell") m.innerHTML = _withRoom("🚔 Holding Cell — Featherstone Constabulary", renderPoliceCellPanel());
    else if (S.tab==="notice_board") m.innerHTML = _withRoom("📋 Village Notice Board", renderNoticeBoard());
    else if (S.tab==="harbour_office") m.innerHTML = _withRoom("⚓ Harbourmaster's Office", renderHarbourOffice());
    else if (S.tab==="boat_hire") m.innerHTML = _withRoom("⛵ Featherstone Boat Hire", renderBoatHire());
    else if (S.tab==="fishmonger_wh") m.innerHTML = _withRoom("🐟 Pearl's Fish Warehouse", renderFishmongerWH());
    else if (S.tab==="home"){
      const _homeVillager = VILLAGERS.find(v => v.homeId === S.roomObjId);
      const _hvName = _homeVillager ? _homeVillager.n : "Someone";
      const _hvQuip = _homeVillager ? speechLine(_homeVillager) : "A quiet life in the valley.";
      const _hvFamily = _homeVillager
        ? [_homeVillager.partner ? `Partner: ${_homeVillager.partner.charAt(0).toUpperCase()+_homeVillager.partner.slice(1)}` : null,
           (_homeVillager.children && _homeVillager.children.length) ? `Children: ${_homeVillager.children.join(", ")}` : null
          ].filter(Boolean).join(" · ")
        : "";
      const _isNightNow = isNight();
      const _canSteal = !S.stolen;
      const _trespassBadge = `<div style="background:rgba(180,20,20,.9);color:#fff;font:700 9px 'IBM Plex Mono',monospace;padding:2px 8px;border-radius:3px;display:inline-block;margin-bottom:8px">⚠ TRESPASSING</div>`;
      const _fleeBar = S.fleeUntil > 0
        ? `<div style="background:rgba(180,20,20,.15);border:1px solid rgba(255,60,40,.5);border-radius:4px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:#ff5040;font-weight:700">🚨 FLEE! ${Math.max(0,Math.ceil((S.fleeUntil-Date.now())/1000))}s to get out!</div>`
        : "";
      const _stealHint = _isNightNow
        ? `<span style="font-size:10px;color:#ff8870;margin-left:6px">😴 they're home & asleep — risky!</span>`
        : `<span style="font-size:10px;color:var(--dim);margin-left:6px">🚪 the place is empty right now…</span>`;
      const _stealBtn = `<button data-steal style="background:${_canSteal?"#2a1a3a":"#3a3a3a"};color:${_canSteal?"#d080ff":"#6a6a6a"};border:none;padding:5px 12px;border-radius:3px;cursor:${_canSteal?"pointer":"default"};font-size:11px;margin-top:6px"${_canSteal?"":" disabled"}>${_canSteal?"🤫 Steal from the kitchen":"✓ Already pocketed something — best leave!"}</button>${_canSteal?_stealHint:""}`;
      m.innerHTML = _withRoom(`🏠 ${_hvName}'s Cottage`,
        `<div class="panel" style="padding:10px">
          ${_trespassBadge}
          ${_fleeBar}
          <p style="margin:0 0 6px;font-size:13px"><b>${_hvName}</b>${_hvFamily ? `<span style="color:var(--dim);font-size:11px;margin-left:8px">${_hvFamily}</span>` : ""}</p>
          <p style="color:var(--dim);font-size:12px;font-style:italic;margin:0 0 6px">"${_hvQuip}"</p>
          ${_stealBtn}
        </div>`
      );
    }
    else if (S.tab==="school") {
      const _hr = gameHour();
      const _isOpen = _hr >= 8.5 && _hr < 15.5;
      const _inClass = CHILDREN_STATE.filter(c => c.phase === "school");
      const _buffActive = (S.schoolBuff||0) > Date.now();
      const _buffMins = _buffActive ? Math.ceil(((S.schoolBuff||0) - Date.now()) / 60000) : 0;
      const _olderKids = _inClass.filter(c => c.age >= 8);
      const _youngerKids = _inClass.filter(c => c.age < 8);
      const _childRow = (c) => `<span style="display:inline-block;background:rgba(255,255,255,.07);border-radius:3px;padding:2px 6px;margin:2px;font-size:11px">
        ${c.female?"👧":"👦"} ${c.n} <span style="color:var(--dim)">age ${c.age}</span></span>`;
      m.innerHTML = _withRoom("🏫 Inside the Village School",
        `<div class="panel" style="padding:10px">
          <h3 style="margin:0 0 6px;font-size:13px">🏫 Featherstone Village School</h3>
          <p style="color:var(--dim);font-size:11px;margin:0 0 10px">Two classrooms, one dining hall. Teaching Featherstone since 1952.</p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="font-size:18px">${_isOpen ? "🟢" : "🔴"}</span>
            <span style="font-size:12px;font-weight:700">${_isOpen ? "School open" : "School closed"}</span>
            <span style="font-size:11px;color:var(--dim)">${_isOpen ? `Hours 8:30–15:30 · ${_inClass.length} pupils in` : "Opens at 8:30"}</span>
          </div>
          ${_isOpen && _olderKids.length ? `<p style="font-size:11px;color:var(--dim);margin:0 0 4px">📖 Miss Haverstock's class (age 8+)</p><div style="margin-bottom:8px">${_olderKids.map(_childRow).join("")}</div>` : ""}
          ${_isOpen && _youngerKids.length ? `<p style="font-size:11px;color:var(--dim);margin:0 0 4px">🎨 Mr Bellamy's class (under 8)</p><div style="margin-bottom:8px">${_youngerKids.map(_childRow).join("")}</div>` : ""}
          ${!_isOpen ? `<p style="font-size:12px;color:var(--dim);margin:0 0 10px">The classrooms are quiet. Come back during school hours to see the children at their desks.</p>` : ""}
        </div>
        <div class="panel" style="padding:10px;margin-top:8px">
          <h3 style="margin:0 0 6px;font-size:13px">📦 Donate Supplies</h3>
          <p style="font-size:11px;color:var(--dim);margin:0 0 8px">Contribute stationery and books to the school. In return, the teachers share their methods — you gain +15% XP on all skills for 15 minutes.</p>
          ${_buffActive
            ? `<div style="background:rgba(74,255,136,.12);border:1px solid rgba(74,255,136,.3);border-radius:4px;padding:6px 10px;font-size:12px;color:#4aff88">📚 Education buff active — ${_buffMins} min remaining. All XP +15%.</div>`
            : `<button data-school-donate style="background:#3a5a3a;color:#fff;border:none;padding:6px 14px;border-radius:3px;cursor:pointer;font-size:12px">Donate Supplies — 100 coins</button>`}
          <p style="font-size:10px;color:var(--dim);margin:8px 0 0">For advanced academic qualifications, visit the University in the east district.</p>
        </div>
        <div class="panel" style="padding:10px;margin-top:8px">
          <h3 style="margin:0 0 6px;font-size:13px">🍋 School Fund</h3>
          <p style="font-size:11px;color:var(--dim);margin:0 0 8px">Raised at the children's lemonade stand on the high street — open for 4 hours after school${lemonadeOpen()?` · <b style="color:#4aa86a">open now!</b>`:""}.</p>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span style="font-weight:700;font-size:12px">Total raised</span><span style="font-size:17px;font-weight:800;color:#e8961e">${fmt(S.school?.raised||0)}c</span></div>
          ${SCHOOL_UPGRADES.map((u,i)=>{ const _rt=S.school?.raised||0; const _t=schoolTier(_rt); const _b=i<_t; const _nx=nextUpgrade(_rt); const _isN=_nx&&_nx.upgrade.id===u.id;
            return `<div style="display:flex;gap:8px;align-items:center;padding:3px 0;border-top:1px solid rgba(0,0,0,.05);font-size:12px;opacity:${_b||_isN?1:.55}"><span style="width:22px;text-align:center;font-size:15px">${_b?"✅":u.ic}</span><span style="flex:1;${_b?"color:#4aa86a;font-weight:700":""}">${u.name}</span><span style="font-size:10px;color:var(--dim)">${_b?"bought":_isN&&_nx?`${fmt(_nx.have)}/${fmt(_nx.need)}c`:`${fmt(u.cost)}c`}</span></div>`;
          }).join("")}
        </div>`
      );
    }
    else if (S.tab==="bank"){
      const _spent = UPGRADES.filter(u=>S.upgrades[u.id]).reduce((s,u)=>s+u.cost,0)
                   + (HOME_TIERS[S.homeTier]?.cost||0) - (HOME_TIERS[0]?.cost||0);
      const _totalEarned = S.counters.coinsEarned||0;
      m.innerHTML = _withRoom("🏦 Inside the Village Bank",
        `${_netWorthPanel()}
        <div class="panel" style="padding:10px;margin-top:8px">
          <h3 style="margin:0 0 10px;font-size:14px">💰 Cash & Interest</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:3px 0;color:var(--dim)">Current balance</td><td style="text-align:right;color:#ffd666;font-weight:700">${fmt(S.coins)} coins</td></tr>
            <tr><td style="padding:3px 0;color:var(--dim)">Total earned</td><td style="text-align:right">${fmt(_totalEarned)} coins</td></tr>
            <tr><td style="padding:3px 0;color:var(--dim)">Invested in upgrades</td><td style="text-align:right">${fmt(_spent)} coins</td></tr>
          <tr style="border-top:1px solid rgba(255,255,255,.1)"><td style="padding:5px 0 3px;color:var(--dim)">Savings rate</td><td style="text-align:right;color:#4aff88">0.05% / 30 min</td></tr>
          <tr><td style="padding:3px 0;color:var(--dim)">Next interest</td><td style="text-align:right">${fmt(Math.max(0, (S.interestAt - Date.now()) / 60000))} min</td></tr>
          </table>
        <p style="color:var(--dim);font-size:11px;margin:12px 0 0">Interest accrues automatically while you play. Keep a healthy balance!</p>
        </div>
        <div class="panel" style="padding:10px;margin-top:8px">
          <h3 style="margin:0 0 8px;font-size:13px">🏦 Loans</h3>
          ${S.loans.length === 0
            ? '<p style="color:var(--dim);font-size:12px;margin:0 0 8px">No outstanding loans.</p>'
            : S.loans.map((ln,i)=>`<div class="card" style="margin-bottom:6px;padding:6px 8px;display:flex;align-items:center;gap:8px">
                <div style="flex:1;font-size:12px"><b>${fmt(ln.amount)}</b> borrowed · <span style="color:#ff8870">${fmt(Math.round(ln.interestAccrued))} interest</span></div>
                <button data-loanrepay="${i}" style="background:#5a3a2a;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px" ${S.coins<ln.amount+Math.round(ln.interestAccrued)?'disabled':''}>Repay ${fmt(ln.amount+Math.round(ln.interestAccrued))}</button>
              </div>`).join('')}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            <button data-loanborrow="50"  style="background:#2a4a6a;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Borrow 50</button>
            <button data-loanborrow="200" style="background:#2a4a6a;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Borrow 200</button>
            <button data-loanborrow="500" style="background:#2a4a6a;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Borrow 500</button>
          </div>
          <p style="color:var(--dim);font-size:11px;margin:8px 0 0">5% daily interest. Repay when you can.</p>
        </div>`
      );
    }
    else if (S.tab==="myhome"){
      const _ht = S.homeTier||0;
      const _tier = HOME_TIERS[_ht];
      const _next = HOME_TIERS[_ht+1];
      const _canUp = _next && S.coins >= _next.cost;
      const _upBtn = _next
        ? `<button data-homeup="1" style="background:${_canUp?"#5a7a3a":"#666"};color:#fff;border:none;padding:6px 18px;border-radius:4px;cursor:pointer;font-size:13px;margin-top:8px"${_canUp?"":" disabled"}>Upgrade → ${_next.n} — ${fmt(_next.cost)} coins</button>`
        : `<p style="color:#ffd666;font-size:12px;margin:8px 0">✨ Fully upgraded — the finest cottage in the valley.</p>`;
      const _starImg = `<img src="/assets/UI/star.png" style="width:12px;height:12px;image-rendering:pixelated;vertical-align:middle;margin-right:2px">`;
      const _homeImg = `<img src="/assets/UI/home.png" style="width:16px;height:16px;image-rendering:pixelated;vertical-align:middle;margin-right:4px;filter:invert(1)">`;
      const _tierStars = HOME_TIERS.map((_,i)=>i<_ht?_starImg:`<span style="opacity:.3">${_starImg}</span>`).join("");
      m.innerHTML = _withRoom(`${_homeImg}Your Cottage`,
        `<div class="panel" style="padding:10px">
          <p style="margin:0 0 2px">${_tierStars}</p>
          <p style="margin:0 0 4px"><b>${_tier.n}</b> <span style="color:var(--dim);font-size:11px">Tier ${_ht+1} of ${HOME_TIERS.length}</span></p>
          <p style="color:var(--dim);font-size:12px;margin:0 0 10px">${_tier.desc}</p>
          ${_upBtn}
          ${_next && !_canUp ? `<p style="color:var(--warn);font-size:11px;margin:6px 0 0">Need ${fmt(_next.cost)} coins (${fmt(_next.cost-S.coins)} short)</p>` : ""}
        </div>
        ${renderFurniturePlacement()}
        ${renderGarden()}
        ${renderKitchen('cottage')}
        ${renderKeepsakes()}
        <div class="panel" style="padding:10px;margin-top:8px">
          <h3 style="margin:0 0 8px;font-size:13px">❤️ Village Friends</h3>
          ${VILLAGERS.map(v=>{
            const lvl = friendLvl(v.id);
            const xp = friendXp(v.id);
            const nextThresh = [10,30,60,100,150][lvl] ?? null;
            const xpBar = nextThresh
              ? `<div style="background:rgba(255,255,255,.1);height:3px;border-radius:2px;margin-top:2px"><div style="background:#e07070;width:${Math.round(xp/nextThresh*100)}%;height:100%;border-radius:2px"></div></div>`
              : `<div style="height:3px"></div>`;
            const req = S.villagerRequests?.[v.id];
            const reqHtml = req ? (()=>{
              const it = ITEMS[req.itemId];
              const have = (S.items[req.itemId]||0) >= req.qty;
              const ttl = Math.max(0, Math.ceil((req.expiresAt - Date.now()) / 3600000));
              return `<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:4px 6px;margin-top:4px;display:flex;align-items:center;gap:6px">
                <span style="font-size:14px">${it?.ic||'📦'}</span>
                <span style="font-size:10px;color:var(--dim);flex:1">${v.n} needs ${req.qty}× ${it?.n||req.itemId} · <span style="color:#ffd666">+${fmt(req.reward)}c +${req.friendXp}❤️</span> <span style="opacity:.5">(${ttl}h)</span></span>
                <button data-fulfill-req="${v.id}" style="background:${have?'#3a5a3a':'#444'};color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px"${have?'':' disabled'}>${have?'Fulfil':'Need more'}</button>
              </div>`;
            })() : (lvl >= 1 ? `<div style="font-size:10px;color:rgba(255,255,255,.25);margin:2px 0 4px">No request right now.</div>` : '');
            return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
              <span style="font-size:11px;min-width:52px;color:var(--dim)">${v.n}</span>
              <span>${heartsHtml(v.id,10)}</span>
              <span style="font-size:10px;color:var(--dim);flex:1">${FRIEND_LVL_NAMES[lvl]}${nextThresh?` · ${xp}/${nextThresh}`:''}</span>
            </div>${xpBar}${reqHtml}`;
          }).join('')}
        </div>
        ${renderSettings()}`
      );
    }
    else if (S.tab==="cafe"){
      const _caffMs = (S.caffBuff||0) - Date.now();
      const _buffHtml = _caffMs > 0
        ? `<div class="panel" style="background:rgba(180,100,20,.15);border:1px solid #c06030;padding:8px;margin-bottom:8px"><b style="color:#e07030">☕ Coffee active!</b><br><span style="color:var(--dim);font-size:11px">Actions 20% faster · ${Math.ceil(_caffMs/1000)}s remaining</span></div>`
        : "";
      m.innerHTML = _withRoom("☕ Inside the Village Café",
        `${_buffHtml}<div class="panel" style="padding:10px"><p style="margin:0 0 8px"><b>Order a Coffee</b> — boosts all action speed by 20% for 5 minutes.</p>
        <p style="color:var(--dim);font-size:12px;margin:0 0 10px">The barista gives you a knowing nod as she pulls the shot.</p>
        <button data-coffee="1" style="background:#c06030;color:#fff;border:none;padding:6px 18px;border-radius:4px;cursor:pointer;font-size:13px">☕ Buy Coffee — 15 coins</button>
        ${S.coins < 15 ? '<p style="color:var(--warn);font-size:11px;margin:6px 0 0">Not enough coins.</p>' : ''}
        </div>
        ${renderKitchen('café')}`
      );
    }
    else if (S.tab==="exchange"){
      ensureMarket();
      const _posHtml = S.exchange.positions.length === 0
        ? `<p style="color:var(--dim);font-size:12px;margin:8px 0">No open positions. Buy below to speculate on commodity prices.</p>`
        : S.exchange.positions.map(pos=>{
            const comm = EXCHANGE_COMMODITIES.find(c=>c.id===pos.commodity);
            const cur = positionValue(pos);
            const cost = pos.qty * pos.costPerUnit;
            const pct = ((cur-cost)/cost*100).toFixed(1);
            const col = cur>=cost?"#4aff88":"#ff6a6a";
            return `<div class="card" style="margin-bottom:6px;padding:6px 8px;display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">${comm?comm.ic:"📦"}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:12px">${comm?comm.n:pos.commodity} ×${pos.qty}</div>
                <div style="font-size:11px;color:var(--dim)">Paid ${fmt(cost)} · Now ${fmt(cur)} <span style="color:${col}">(${pct}%)</span></div>
              </div>
              <button data-pos-sell="${pos.id}" style="background:#5a3a2a;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Sell</button>
            </div>`;
          }).join('')
      ;
      const _buyHtml = EXCHANGE_COMMODITIES.map(comm=>{
        const drift = avgDrift(comm.id) * eventMult(comm.id);
        const pctStr = drift>=1 ? `<span style="color:#4aff88">+${((drift-1)*100).toFixed(1)}%</span>` : `<span style="color:#ff6a6a">${((drift-1)*100).toFixed(1)}%</span>`;
        const canBuy1 = S.coins >= comm.unit;
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:16px">${comm.ic}</span>
          <div style="flex:1;font-size:12px"><b>${comm.n}</b> · ${fmt(comm.unit)}/unit · Drift ${pctStr}</div>
          <button data-pos-buy="${comm.id}|1" style="background:${canBuy1?"#2a5a3a":"#444"};color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px"${canBuy1?"":" disabled"}>×1</button>
          <button data-pos-buy="${comm.id}|5" style="background:${S.coins>=comm.unit*5?"#1a4a2a":"#444"};color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px"${S.coins>=comm.unit*5?"":" disabled"}>×5</button>
        </div>`;
      }).join('');
      m.innerHTML = _withRoom("📈 Exchange Floor",
        `<div class="panel" style="padding:10px">
          <h3 style="margin:0 0 6px;font-size:14px">📊 Open Positions</h3>
          ${_posHtml}
          <h3 style="margin:12px 0 6px;font-size:14px">🛒 Buy Position</h3>
          <p style="color:var(--dim);font-size:11px;margin:0 0 8px">Buy a position at the current drift price. Sell when drift is favourable — world events create opportunities.</p>
          ${_buyHtml}
        </div>`
      );
    }
    else if (S.tab==="university"){
      const _studHtml = S.studying
        ? (()=>{
            const _c = COURSES.find(c=>c.id===S.studying.courseId);
            const _rem = Math.max(0, S.studying.endsAt - Date.now());
            const _pct = Math.round((1 - _rem/(_c?_c.ms:1))*100);
            return `<div style="background:rgba(80,60,140,.2);border:1px solid #7a5aaa;padding:8px;border-radius:4px;margin-bottom:10px">
              <b style="color:#c0a0ff">${_c?_c.ic:""} Studying: ${_c?_c.n:"..."}</b><br>
              <div style="background:#1a1a2a;border-radius:2px;height:6px;margin:4px 0;overflow:hidden"><div style="background:#7a5aaa;height:6px;width:${_pct}%"></div></div>
              <span style="color:var(--dim);font-size:11px">${Math.ceil(_rem/60000)} min remaining</span>
            </div>`;
          })()
        : "";
      const _courseHtml = COURSES.map(c=>{
        const done = S.degrees.includes(c.id);
        const studying = S.studying && S.studying.courseId===c.id;
        const canEnroll = !done && !S.studying && S.coins>=c.cost;
        return `<div class="card" style="margin-bottom:6px;padding:6px 10px;display:flex;align-items:center;gap:8px;opacity:${done?"0.7":"1"}">
          <span style="font-size:18px">${c.ic}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:12px">${c.n} ${done?"✓":""}</div>
            <div style="font-size:11px;color:var(--dim)">${c.desc} · ${Math.round(c.ms/60000)} min · ${fmt(c.cost)} coins</div>
          </div>
          ${done ? `<span style="color:#4aff88;font-size:11px">DONE</span>`
            : studying ? `<span style="color:#c0a0ff;font-size:11px">STUDYING</span>`
            : `<button data-enroll="${c.id}" style="background:${canEnroll?"#4a3a8a":"#444"};color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px"${canEnroll?"":" disabled"}>Enroll</button>`}
        </div>`;
      }).join('');
      m.innerHTML = _withRoom("🎓 University",
        `<div class="panel" style="padding:10px">
          <h3 style="margin:0 0 6px;font-size:14px">📚 Courses — Permanent Skill Perks</h3>
          <p style="color:var(--dim);font-size:11px;margin:0 0 10px">Complete courses for permanent bonuses. One course at a time. Degrees last forever.</p>
          ${_studHtml}${_courseHtml}
        </div>`
      );
    }
    else if (S.tab==="retail"){
      const _today = new Date().toDateString();
      if (S.retail.lastReset !== _today){ S.retail.dailySold = 0; S.retail.lastReset = _today; }
      const _slotHtml = S.retail.slots.map((sl, i)=>{
        if (sl && sl.itemId && sl.qty > 0){
          return `<div class="card" style="padding:6px 8px;display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:18px">${ITEMS[sl.itemId]?.ic||"📦"}</span>
            <div style="flex:1"><div style="font-weight:700;font-size:12px">${ITEMS[sl.itemId]?.n||sl.itemId}</div><div style="font-size:11px;color:var(--dim)">${sl.qty} units remaining</div></div>
            <button data-retail-clear="${i}" style="background:#5a2a2a;color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px">Clear</button>
          </div>`;
        }
        const _invItems = Object.keys(S.items).filter(id=>S.items[id]>0&&ITEMS[id]);
        const _opts = _invItems.map(id=>`<option value="${id}">${ITEMS[id].n} (${S.items[id]})</option>`).join('');
        return `<div class="card" style="padding:6px 8px;display:flex;align-items:center;gap:8px;margin-bottom:6px;opacity:0.7">
          <span style="font-size:18px">➕</span>
          <div style="flex:1"><select data-retail-sel="${i}" style="background:#2a2a3a;color:#fff;border:1px solid #555;padding:2px 4px;font-size:11px;border-radius:3px"><option value="">— stock an item —</option>${_opts}</select></div>
          <button data-retail-stock="${i}" style="background:#2a5a3a;color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px">Stock</button>
        </div>`;
      }).join('');
      m.innerHTML = _withRoom("🛍️ Retail Stall — High Street",
        `<div class="panel" style="padding:10px">
          <h3 style="margin:0 0 6px;font-size:14px">🏪 Your Stall</h3>
          <p style="color:var(--dim);font-size:11px;margin:0 0 10px">Stock up to 3 items. The stall auto-sells 1 unit every 2 min at +15% above market price. Daily cap: 200 units.</p>
          ${_slotHtml}
          <p style="color:var(--dim);font-size:11px;margin:8px 0 0">Sold today: ${S.retail.dailySold||0} / 200 units</p>
        </div>`);
    }
    else if (S.tab==="postoffice"){
      const _isReady = S.dailyReward.lastDate !== new Date().toDateString();
      const _reward = Math.min(500, 50 + totalLvl() * 3);
      m.innerHTML = _withRoom("📮 Post Office",
        `<div class="panel" style="padding:10px">
          <h3 style="margin:0 0 6px;font-size:14px">📬 Daily Parcel</h3>
          <p style="color:var(--dim);font-size:12px;margin:0 0 10px">A parcel waits for you each day. Come back daily to collect your reward — the amount scales with your total level.</p>
          ${_isReady
            ? `<button data-daily-claim="1" style="background:#b03020;color:#fff;border:none;padding:8px 22px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:700">📮 Collect Parcel — ${fmt(_reward)} coins</button>`
            : `<div style="color:#4aff88;font-size:13px;margin:4px 0">✔ Parcel collected today. Come back tomorrow!</div>`}
          <p style="color:var(--dim);font-size:11px;margin:10px 0 0">Current reward: <b>${fmt(_reward)} coins</b> (Level ${totalLvl()} × 3 + 50, capped at 500)</p>
        </div>`);
    }
    else if (S.tab==="estateagent"){
      const _nextRent = Math.max(0, ((S.rentAt||0) - Date.now()) / 60000);
      const _totalRent = S.properties.reduce((s,pid)=>{ const p=PROPERTIES.find(pr=>pr.id===pid); return s+(p?p.rent:0); }, 0);
      const _propHtml = PROPERTIES.map(p=>{
        const owned = S.properties.includes(p.id);
        const canBuy = !owned && S.coins >= p.cost;
        return `<div class="card" style="padding:8px 10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${p.id==="cottage_a"?"🏡":p.id==="flat_b"?"🏠":"🏰"}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">${p.n} ${owned?"✓":""}</div>
            <div style="font-size:11px;color:var(--dim)">${p.desc}</div>
            <div style="font-size:11px;color:${owned?"#4aff88":"var(--dim)"}">+${p.rent} coins/min${owned?" · OWNED":""}</div>
          </div>
          ${owned ? `<span style="color:#4aff88;font-size:11px">OWNED</span>`
            : `<button data-buy-prop="${p.id}" style="background:${canBuy?"#2a4060":"#444"};color:#fff;border:none;padding:5px 12px;border-radius:3px;cursor:pointer;font-size:11px"${canBuy?"":" disabled"}>${fmt(p.cost)} coins</button>`}
        </div>`;
      }).join('');
      m.innerHTML = _withRoom("🏘️ Estate Agent",
        `<div class="panel" style="padding:10px">
          <h3 style="margin:0 0 6px;font-size:14px">🏘️ Property Portfolio</h3>
          <p style="color:var(--dim);font-size:11px;margin:0 0 10px">Buy properties for passive rental income. Rent collected every 5 minutes.</p>
          ${S.properties.length ? `<p style="color:#4aff88;font-size:12px;margin:0 0 8px">Portfolio: +${_totalRent} coins/min · Next rent in ${_nextRent.toFixed(1)} min</p>` : ""}
          ${_propHtml}
        </div>`);
    }
    else if (S.tab==="lore_stone") m.innerHTML = _withRoom("🪨 The Old Stone — North Forest",
      `<div class="panel" style="padding:10px">
        <h3 style="margin:0 0 8px;font-size:13px">🪨 Featherstone Boundary Stone</h3>
        <p style="color:var(--dim);font-size:12px;margin:0 0 10px;font-style:italic">"Here the valley ends and the old forest begins. Travellers, keep to the path."</p>
        <div class="card" style="margin-bottom:6px"><span class="ic">📜</span><div class="body"><div class="nm">Origin Unknown</div><div class="ds">The stone predates the village by centuries. No one carved it — or so the elders say.</div></div></div>
        <div class="card" style="margin-bottom:6px"><span class="ic">🌲</span><div class="body"><div class="nm">Ancient Hardwood</div><div class="ds">The great trees here are older than the quarry. A skilled woodcutter might find them worth the effort.</div></div></div>
        <div class="card" style="margin-bottom:6px"><span class="ic">🍄</span><div class="body"><div class="nm">Forager's Clearing</div><div class="ds">Wren knows every inch of these woods. She says the mushrooms here grow better than any in the valley.</div></div></div>
        <p style="font-size:11px;color:var(--dim);margin:10px 0 0">Visit Wren's stall nearby to trade foraged goods from the forest.</p>
      </div>`
    );
    else m.innerHTML = _withRoom(S.tab==="mining" ? "⛏️ Down in the Quarry" : S.tab==="steelworks" ? "🔥 Inside the Furnace" : "⚙️ Inside the Workshop", renderSkillPanel(S.tab));
  }
  bindMain();
  setupVillage();
  setupInterior();
  updateMusicZone();
  if (_entering) showZoneCard(S.tab); // after innerHTML so zone-card-canvas exists
  if (S.tab==="character") drawCharPreview("char-preview");
}
function bindMain(){
  document.querySelectorAll(".action").forEach(el=>{
    el.onclick = (e)=>{
      if (e.target.dataset.swing){ swing(); return; }   // M12 active swing (no re-render; bar updates live)
      if (e.target.dataset.stop){ S.action = null; renderMain(); renderNav(); save(); return; }
      const skill = el.dataset.skill, id = el.dataset.act;
      if (S.action && S.action.skill===skill && S.action.id===id) return;
      const act = findAction(skill,id);
      if (act.in && !canAfford(act)){ toast("Not enough materials."); return; }
      S.action = { skill, id, progress:0 };
      log(`▶ Started: ${act.n}`);
      renderMain(); renderNav(); save();
    };
  });
  document.querySelectorAll("[data-trade]").forEach(b=> b.onclick = ()=>{
    const [npc, it, q, mode] = b.dataset.trade.split("|");
    doTrade(npc, it, q==="max" ? "max" : +q, mode);
  });
  document.querySelectorAll("[data-deliver]").forEach(b=> b.onclick = ()=> deliverContract(+b.dataset.deliver));
  document.querySelectorAll("[data-reroll]").forEach(b=> b.onclick = ()=> rerollContract(+b.dataset.reroll));
  document.querySelectorAll("[data-buy]").forEach(b=> b.onclick = ()=>{
    const u = UPGRADES.find(x=>x.id===b.dataset.buy);
    if (S.coins < u.cost) return;
    S.coins -= u.cost; S.upgrades[u.id] = true;
    toast(`${u.ic} ${u.n} PURCHASED`); log(`🛒 CapEx approved: <b>${u.n}</b>`, "good");
    achCheck();
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-homeup]").forEach(b=> b.onclick = ()=>{
    const _ht = S.homeTier||0;
    const _next = HOME_TIERS[_ht+1];
    if (!_next || S.coins < _next.cost){ toast("Not enough coins."); return; }
    S.coins -= _next.cost; S.homeTier = _ht + 1;
    toast("🏡 Home upgraded to " + _next.n + "!");
    log("🏡 Home upgrade: <b>" + _next.n + "</b>", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-coffee]").forEach(b=> b.onclick = ()=>{
    if (S.coins < 15){ toast("Not enough coins."); return; }
    S.coins -= 15;
    const _dur = 5*60*1000;
    S.caffBuff = Math.max(S.caffBuff||0, Date.now()) + _dur;
    toast("☕ Coffee! All actions 20% faster for 5 minutes.");
    log("☕ <b>Coffee purchased</b> — 5 min speed boost active.", "good");
    renderMain(); updateHud(); save();
  });
  // kitchen (cooking) handlers
  document.querySelectorAll("[data-cook]").forEach(b=> b.onclick = ()=> cookRecipe((b as HTMLElement).dataset.cook));
  document.querySelectorAll("[data-eat]").forEach(b=> b.onclick = ()=> eatMeal((b as HTMLElement).dataset.eat));
  document.querySelectorAll("[data-serve]").forEach(b=> b.onclick = ()=> serveMeal((b as HTMLElement).dataset.serve));
  // retail stall handlers
  document.querySelectorAll("[data-retail-stock]").forEach(b=> b.onclick = ()=>{
    const _i = parseInt(b.dataset.retailStock);
    const _sel = document.querySelector(`[data-retail-sel="${_i}"]`);
    const _itemId = _sel ? _sel.value : "";
    if (!_itemId || !ITEMS[_itemId]){ toast("Pick an item to stock."); return; }
    const _qty = S.items[_itemId]||0;
    if (_qty <= 0){ toast("None in inventory."); return; }
    S.retail.slots[_i] = { itemId:_itemId, qty:_qty };
    S.items[_itemId] = 0;
    toast("🛍️ Stocked " + _qty + "× " + ITEMS[_itemId].n + " in slot " + (_i+1) + ".");
    renderMain(); save();
  });
  document.querySelectorAll("[data-retail-clear]").forEach(b=> b.onclick = ()=>{
    const _i = parseInt(b.dataset.retailClear);
    const _sl = S.retail.slots[_i];
    if (_sl && _sl.itemId && _sl.qty > 0){
      addItem(_sl.itemId, _sl.qty);
      toast("Returned " + _sl.qty + "× " + (ITEMS[_sl.itemId]?.n||_sl.itemId) + " to inventory.");
    }
    S.retail.slots[_i] = { itemId:null, qty:0 };
    renderMain(); save();
  });
  document.querySelectorAll("[data-fulfill-req]").forEach(b=> b.onclick = ()=>{
    fulfillVillagerRequest((b as HTMLElement).dataset.fulfillReq);
  });
  document.querySelectorAll("[data-perk]").forEach(b => b.onclick = ()=>{
    const parts = (b as HTMLElement).dataset.perk.split('|');
    choosePerk(parts[0], parseInt(parts[1]), parts[2]);
  });
  document.querySelectorAll("[data-season-sell]").forEach(b=> b.onclick = ()=>{
    const _sd = SEASON_DEFS[getSeason()];
    const _festMult = hasPerk('festival_flair') ? 1.25 : 1.0;
    let _total = 0;
    _sd.items.forEach(id => {
      const qty = S.items[id]||0;
      if (qty > 0 && ITEMS[id]){
        const val = Math.round(ITEMS[id].v * 1.5 * _festMult * qty);
        S.coins += val; S.counters.coinsEarned = (S.counters.coinsEarned||0) + val;
        S.items[id] = 0; _total += val;
      }
    });
    if (!_total){ toast("Nothing seasonal to sell."); return; }
    grantXp("trading", Math.round(_total * 0.05));
    toast(`🎪 Festival sale! +${fmt(_total)} coins`);
    log(`🎪 <b>${_sd.ic} ${_sd.n} Festival Sale</b> — +${fmt(_total)} coins`, "good");
    achCheck(); renderMain(); updateHud(); save();
  });
  // festival raffle
  document.querySelectorAll("[data-festival-raffle]").forEach(b=> b.onclick = ()=>{
    if (S.coins < 25){ toast("Not enough coins."); return; }
    const _fst = isFestivalActive(); if (!_fst){ toast("No festival active."); return; }
    const _today = getTodayStr();
    if (!S.festival) S.festival = { raffleDate:"", raffleCount:0, gamesDate:"", feastId:"", attended:[], notified:"" };
    if (S.festival.raffleDate !== _today){ S.festival.raffleDate = _today; S.festival.raffleCount = 0; }
    if (S.festival.raffleCount >= 5){ toast("🎟️ No more tickets today — come back tomorrow!"); return; }
    S.coins -= 25; S.festival.raffleCount++;
    // prize pool: seasonal items, 50c, or 20 skill XP
    const _skills = Object.keys(S.skills||{}).filter(sk=>sk!=='logistics'&&sk!=='trading');
    const _pool = [..._fst.raffleItems, ..._fst.raffleItems, '50coins', `xp_${_skills[Math.floor(Math.random()*_skills.length)]}`];
    const _prize = _pool[Math.floor(Math.random()*_pool.length)];
    if (_prize === '50coins'){
      S.coins += 50; S.counters.coinsEarned = (S.counters.coinsEarned||0)+50;
      toast(`🎟️ Raffle: Lucky! You won 50 coins!`); log(`🎟️ Raffle prize: <b>50 coins</b>`, "good");
    } else if (_prize.startsWith('xp_')){
      const _sk = _prize.slice(3); grantXp(_sk, 20);
      toast(`🎟️ Raffle: +20 ${_sk} XP!`); log(`🎟️ Raffle prize: <b>+20 ${_sk} XP</b>`, "good");
    } else {
      addItem(_prize, 1);
      toast(`🎟️ Raffle: You won ${ITEMS[_prize]?.ic||''} ${ITEMS[_prize]?.n||_prize}!`);
      log(`🎟️ Raffle prize: <b>${ITEMS[_prize]?.ic||''} ${ITEMS[_prize]?.n||_prize}</b>`, "good");
    }
    S.counters.raffleWins = (S.counters.raffleWins||0)+1;
    achCheck(); renderMain(); updateHud(); save();
  });
  // festival village games
  document.querySelectorAll("[data-festival-games]").forEach(b=> b.onclick = ()=>{
    if (S.coins < 15){ toast("Not enough coins."); return; }
    const _fst = isFestivalActive(); if (!_fst){ toast("No festival active."); return; }
    if (!S.festival) S.festival = { raffleDate:"", raffleCount:0, gamesDate:"", feastId:"", attended:[], notified:"" };
    const _today = getTodayStr();
    if (S.festival.gamesDate === _today){ toast("🎡 You've already played today!"); return; }
    S.coins -= 15; S.festival.gamesDate = _today;
    if (!S.friendships) S.friendships = {};
    const _shuffled = [...VILLAGERS].sort(()=>Math.random()-.5).slice(0,3);
    _shuffled.forEach(v=>{
      if (!S.friendships[v.id]) S.friendships[v.id] = { xp:0, lastChat:0 };
      const wasLvl = friendLvl(v.id);
      S.friendships[v.id].xp = (S.friendships[v.id].xp||0) + Math.round(10 * prestigeFriendXpMult() * festivalFriendXpMult());
      const newLvl = friendLvl(v.id);
      if (newLvl > wasLvl){
        toast(`❤️ ${v.n} — ${FRIEND_LVL_NAMES[newLvl]}!`);
        if (newLvl === 4) grantFriendshipGift(v.id, v.n);
        if (newLvl === 5) showKeepsakeCeremony(v.id, v.n);
      }
    });
    const _names = _shuffled.map(v=>v.n).join(', ');
    toast(`🎡 Great fun with ${_names}! Friendship XP gained.`);
    log(`🎡 <b>Village Games</b> — warmer with ${_names}`, "good");
    achCheck(); renderMain(); updateHud(); save();
  });
  // festival grand feast
  document.querySelectorAll("[data-festival-feast]").forEach(b=> b.onclick = ()=>{
    const _fst = isFestivalActive(); if (!_fst){ toast("No festival active."); return; }
    if (!S.festival) S.festival = { raffleDate:"", raffleCount:0, gamesDate:"", feastId:"", attended:[], notified:"" };
    const _feastKey = _fst.season + new Date().getFullYear();
    if (S.festival.feastId === _feastKey){ toast("🍽️ Feast already provided this festival!"); return; }
    const _qty = _fst.feastQty;
    const _ok = _fst.raffleItems.every(id=>(S.items[id]||0)>=_qty);
    if (!_ok){ toast("You don't have enough feast items yet."); return; }
    _fst.raffleItems.forEach(id=>{ S.items[id] = Math.max(0,(S.items[id]||0)-_qty); });
    S.festival.feastId = _feastKey;
    S.coins += 400; S.counters.coinsEarned = (S.counters.coinsEarned||0)+400;
    grantXp("crafting", 80);
    toast(`🍽️ Grand Feast provided! +400 coins and +80 crafting XP!`);
    log(`🍽️ <b>Grand Feast</b> — the village is grateful! +400 coins, +80 crafting XP`, "good");
    achCheck(); renderMain(); updateHud(); save();
  });
  // furniture shop — buy
  document.querySelectorAll("[data-buy-furn]").forEach(b=> b.onclick = ()=>{
    const _id = (b as HTMLElement).dataset.buyFurn!;
    const _fd = FURNITURE_DEFS[_id]; if (!_fd){ toast("Unknown item."); return; }
    if (S.coins < _fd.price){ toast("Not enough coins."); return; }
    S.coins -= _fd.price; addFurniture(_id, 1);
    toast(`🛋️ Bought ${_fd.n}! Place it in Your Cottage.`);
    log(`🛋️ <b>${_fd.n}</b> purchased from Nell's Home Store.`, "good");
    achCheck(); renderMain(); updateHud(); save();
  });
  // furniture shop — craft from materials
  document.querySelectorAll("[data-craft-furn]").forEach(b=> b.onclick = ()=>{
    const _id = (b as HTMLElement).dataset.craftFurn!;
    const _fd = FURNITURE_DEFS[_id]; if (!_fd?.craftIn){ toast("Not craftable."); return; }
    for (const [k,v] of Object.entries(_fd.craftIn)){
      if ((S.items[k]||0) < (v as number)){ toast(`Need more ${ITEMS[k]?.n||k}.`); return; }
    }
    for (const [k,v] of Object.entries(_fd.craftIn)) S.items[k] = (S.items[k]||0) - (v as number);
    addFurniture(_id, 1);
    grantXp("crafting", 15);
    toast(`🪚 Crafted ${_fd.n}! Place it in Your Cottage.`);
    log(`🪚 Crafted <b>${_fd.n}</b>.`, "good");
    achCheck(); renderMain(); updateHud(); save();
  });
  // myhome — place furniture
  document.querySelectorAll("[data-place-furn]").forEach(b=> b.onclick = ()=>{
    const _id = (b as HTMLElement).dataset.placeFurn!;
    const _fd = FURNITURE_DEFS[_id]; if (!_fd){ toast("Unknown item."); return; }
    if (!S.ownedFurniture || !S.ownedFurniture[_id] || S.ownedFurniture[_id] < 1){ toast("You don't own that."); return; }
    const _sel = document.getElementById('spot-sel-'+_id) as HTMLSelectElement|null;
    const _slot = _sel ? parseInt(_sel.value) : -1;
    if (_slot < 0 || _slot > 8){ toast("Choose a room spot."); return; }
    if ((S.placedFurniture||[]).some(p=>p.slot===_slot)){ toast("That spot is already occupied."); return; }
    if (!S.placedFurniture) S.placedFurniture = [];
    S.ownedFurniture[_id]--;
    S.placedFurniture.push({ id:_id, slot:_slot });
    toast(`🛋️ ${_fd.n} placed in ${FURN_SPOTS[_slot]?.label||'room'}.`);
    achCheck(); renderMain(); updateHud(); save();
  });
  // myhome — pick up furniture
  document.querySelectorAll("[data-pickup-furn]").forEach(b=> b.onclick = ()=>{
    const [_id, _slotStr] = ((b as HTMLElement).dataset.pickupFurn||'').split('|');
    const _slot = parseInt(_slotStr);
    if (!_id || isNaN(_slot)){ toast("Error picking up."); return; }
    const _idx = (S.placedFurniture||[]).findIndex(p=>p.id===_id && p.slot===_slot);
    if (_idx < 0){ toast("Not found."); return; }
    S.placedFurniture.splice(_idx, 1);
    addFurniture(_id, 1);
    const _fd = FURNITURE_DEFS[_id];
    toast(`📦 ${_fd?.n||_id} picked up.`);
    achCheck(); renderMain(); updateHud(); save();
  });
  // pub pint purchase
  document.querySelectorAll("[data-buy-pint]").forEach(b=> b.onclick = ()=>{
    if (S.coins < 8){ toast("Not enough coins."); return; }
    const _today = getTodayStr();
    if ((S.pintDate||"") !== _today){ S.pintsTonight = 0; S.pintDate = _today; }
    S.coins -= 8;
    S.pintsTonight = (S.pintsTonight||0) + 1;
    S.pintBuff = Math.max(S.pintBuff||0, Date.now()) + 3*60*1000;
    if (S.pintsTonight === 3){
      S.drunkUntil = Date.now() + 60*1000;
      toast("🍺🍺🍺 Three pints in… hic! The room won't stop spinning!");
      log(`🍺 <b>Three pints at The Rose & Pallet</b> — Rex: "Right, I think that's your lot, pal."`, "");
    } else if (S.pintsTonight > 3){
      S.drunkUntil = Math.max(S.drunkUntil||0, Date.now()) + 30*1000;
      toast('🍺 Rex: "Maybe… hic… one more?"');
    } else {
      toast(`🍺 Pint ${S.pintsTonight}/3 — actions 10% faster for 3 min.`);
      log(`🍺 <b>Pint at The Rose & Pallet</b>.`, "good");
    }
    achCheck(); renderMain(); updateHud(); save();
  });
  // M10 — mischief handlers
  document.querySelectorAll("[data-steal]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    if (S.stolen){ toast("You've already taken something — leave!"); return; }
    const _item = _STOLEN_FOODS[Math.floor(Math.random()*_STOLEN_FOODS.length)];
    if (!S.items) S.items = {};
    S.items[_item] = (S.items[_item]||0) + 1;
    S.stolen = true;
    const _stir = Math.random() < 0.25;
    if (_stir){
      toast(`😬 You heard something stir… grab what you can and get out!`);
    } else {
      toast(`🤫 Grabbed: ${_item.replace(/_/g," ")}. Now get out before they wake!`);
    }
    log(`🦹 ${pName()} pinched a <b>${_item.replace(/_/g," ")}</b> from ${VILLAGERS.find(v=>v.homeId===S.roomObjId)?.n||"someone"}'s fridge.`);
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-leave-cell]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    if (S.caught?.cellUntil > Date.now()){ toast("Sentence not served yet."); return; }
    S.caught = { active: false, cellUntil: 0, maxTime: 0 };
    S.trespass = { active: false, homeId: null };
    S.stolen = false; S.fleeUntil = 0;
    IP.tx = null; IP.ty = null; IP.moving = false;
    VP.enterCooldown = 90;
    S.tab = "village";
    log(`🔓 ${pName()} released from the Featherstone holding cell.`, "good");
    toast("🔓 You're free! Try to stay out of trouble.");
    renderNav(); renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-deal-cell]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    const _dealCost = Math.max(20, Math.round(S.coins * 0.15));
    if (S.coins < _dealCost){ toast("Not enough coins."); return; }
    S.coins -= _dealCost;
    const _halfRemaining = Math.round((S.caught.cellUntil - Date.now()) / 2);
    S.caught.cellUntil = Date.now() + _halfRemaining;
    toast(`🤝 Deal struck! ${fmt(_dealCost)} coins to Officer Plonk. Sentence halved.`);
    log(`🤝 Paid Officer Plonk ${fmt(_dealCost)} coins — sentence halved.`, "");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-surrender]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    const _fine = Math.floor(S.coins * 0.10);
    S.coins = Math.max(0, S.coins - _fine);
    const _dur = Math.round(DAY_DURATION_MS / 2); // 12 game-hours
    S.caught = { active: true, cellUntil: Date.now() + _dur, maxTime: _dur };
    S.stolen = false; S.trespass = { active: false, homeId: null }; S.fleeUntil = 0;
    S.tab = "police_cell";
    IP.x = icanvasW()/2; IP.y = icanvasH() - 60;
    IP.tx = null; IP.ty = null; IP.moving = false; IP.dir = "down";
    CHAT_NPC = null;
    if (_fine > 0) log(`🙋 ${pName()} handed themselves in. ${fmt(_fine)} coin fine. Reduced sentence.`, "");
    toast(`🙋 Reduced sentence: 12 game-hours (about ${Math.round(_dur/60000)} real min).`);
    renderNav(); renderMain(); updateHud(); save();
  });
  // energy — upgrade the power grid
  const _gridBtn = document.querySelector("[data-gridup]");
  if (_gridBtn) (_gridBtn as HTMLElement).onclick = ()=>{
    const tier = S.grid?.tier || 0; const next = gridNext(tier);
    if (!next || !next.cost) return;
    if (S.coins < next.cost.coins || !Object.entries(next.cost.items).every(([id,q])=>itemCount(id)>=(q as number))){ toast("Not enough parts or coins."); return; }
    S.coins -= next.cost.coins;
    for (const [id,q] of Object.entries(next.cost.items)) S.items[id] -= (q as number);
    if (!S.grid) S.grid = { tier:0 };
    S.grid.tier = next.tier;
    toast(`${next.ic} ${next.name} online — all actions −${Math.round(next.speedBonus*100)}%!`);
    log(`⚡ Power grid upgraded to <b>${next.name}</b> — town-wide efficiency boost.`, "good");
    achCheck(); renderMain(); updateHud(); save();
  };
  // robotics — build / dismantle automatons
  document.querySelectorAll("[data-autobuild]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    const [sk, aid] = (b as HTMLElement).dataset.autobuild.split("|");
    const a = automatonById(aid); if (!a) return;
    if (S.automatons?.[sk]){ toast("That skill already has an automaton."); return; }
    if (S.coins < a.cost.coins || !Object.entries(a.cost.items).every(([id,q])=>itemCount(id)>=(q as number))){ toast("Not enough parts or coins."); return; }
    S.coins -= a.cost.coins;
    for (const [id,q] of Object.entries(a.cost.items)) S.items[id] -= (q as number);
    if (!S.automatons) S.automatons = {};
    S.automatons[sk] = aid;
    toast(`${a.ic} ${a.name} built — now working your ${SKILLS[sk].n}!`);
    log(`🤖 Automaton deployed: <b>${a.name}</b> on ${SKILLS[sk].n}.`, "good");
    achCheck(); renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-autoscrap]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    const sk = (b as HTMLElement).dataset.autoscrap;
    if (S.automatons?.[sk]){ delete S.automatons[sk]; toast("Automaton dismantled."); renderMain(); updateHud(); save(); }
  });
  // nightclub — hit the dance floor
  document.querySelectorAll("[data-dance]").forEach(b=> (b as HTMLElement).onclick = ()=>{
    S.danceBuff = Date.now() + 5*60000;
    MUSIC.unlocked = true;
    toast("💃 You hit the dance floor — buzzing! (+15% speed, 5 min)");
    renderMain(); updateHud(); save();
  });
  // village beautification purchases
  document.querySelectorAll("[data-beautify]").forEach(b=>{
    b.onclick = ()=>{
      const _id = (b as HTMLElement).dataset.beautify;
      const _proj = BEAUTIFICATION.find(x=>x.id===_id);
      if (!_proj) return;
      if ((S.beautification||[]).includes(_id)){ toast("Already funded."); return; }
      if (S.coins < _proj.cost){ toast(`Need ${fmt(_proj.cost)} coins.`); return; }
      S.coins -= _proj.cost;
      if (!S.beautification) S.beautification = [];
      S.beautification.push(_id);
      const _pv = villagePrestige();
      const _newBonus = PRESTIGE_THRESHOLDS.find(r=>r.at===_pv);
      toast(`🌸 ${_proj.n} funded! +${_proj.prestige} prestige${_newBonus ? ` · Bonus unlocked: ${_newBonus.label}` : ""}`);
      achCheck(); renderMain(); updateHud(); save();
    };
  });
  // school supply donation
  document.querySelectorAll("[data-school-donate]").forEach(b=>{
    b.onclick = ()=>{
      if (S.coins < 100){ toast("Need 100 coins to donate supplies."); return; }
      S.coins -= 100;
      S.schoolBuff = Date.now() + 15*60*1000;
      toast("📚 Supplies donated! +15% XP on all skills for 15 minutes.");
      renderMain(); updateHud(); save();
    };
  });
  // boat hire fast travel
  document.querySelectorAll("[data-boat-travel]").forEach(b=>{
    b.onclick = ()=>{
      if (S.coins < 10){ toast("Not enough coins."); return; }
      const _dest = (b as HTMLElement).dataset.boatTravel;
      S.coins -= 10;
      if (!S.harbour) S.harbour = { boatTrips:0 };
      S.harbour.boatTrips = (S.harbour.boatTrips||0) + 1;
      if (_dest === "pier"){
        VP.x = 22.5*TILE; VP.y = 38.4*TILE;
        toast("⛵ Crossing complete! You step off at the Pier.");
        log("⛵ <b>Boat trip</b> — crossed to the Pier. -10 coins.", "good");
      } else {
        VP.x = 61*TILE; VP.y = 35.4*TILE;
        toast("⛵ Crossing complete! You step off at the Harbour.");
        log("⛵ <b>Boat trip</b> — returned to the Harbour. -10 coins.", "good");
      }
      S.tab = "village"; renderNav(); renderMain(); updateHud(); save();
    };
  });
  // fishmonger warehouse sell
  document.querySelectorAll("[data-fw-sell]").forEach(b=>{
    b.onclick = ()=>{
      const _fid = (b as HTMLElement).dataset.fwSell;
      const _qty = S.items[_fid]||0;
      if (_qty <= 0 || !ITEMS[_fid]){ toast("None in inventory."); return; }
      const _premV = Math.round(ITEMS[_fid].v * 1.3);
      const _total = _qty * _premV;
      S.items[_fid] = 0;
      S.coins += _total;
      S.counters.coinsEarned = (S.counters.coinsEarned||0) + _total;
      toast(`🐟 Sold ${_qty}× ${ITEMS[_fid].n} for ${fmt(_total)} coins (30% premium)!`);
      log(`🐟 <b>Warehouse sale:</b> ${_qty}× ${ITEMS[_fid].n} → +${fmt(_total)} coins.`, "good");
      renderMain(); updateHud(); save();
    };
  });
  // notice board quest hand-in
  document.querySelectorAll("[data-nbcomplete]").forEach(b=> {
    b.onclick = ()=>{
      const _qId = (b as HTMLElement).dataset.nbcomplete;
      const _q = (S.noticeBoard?.quests as any[])?.find(q=>q.id===_qId);
      if (!_q || _q.done){ toast("Quest not found."); return; }
      if ((S.items[_q.itemId]||0) < _q.qty){ toast("Not enough " + (ITEMS[_q.itemId]?.n||_q.itemId) + "."); return; }
      S.items[_q.itemId] = Math.max(0, (S.items[_q.itemId]||0) - _q.qty);
      S.coins += _q.reward;
      S.counters.coinsEarned = (S.counters.coinsEarned||0) + _q.reward;
      _q.done = true;
      if (!S.friendships[_q.npcId]) S.friendships[_q.npcId] = { xp:0, lastChat:0 };
      const _wasLvl = friendLvl(_q.npcId);
      S.friendships[_q.npcId].xp = (S.friendships[_q.npcId].xp||0) + Math.round(_q.friendXp * prestigeFriendXpMult() * festivalFriendXpMult());
      const _newLvl = friendLvl(_q.npcId);
      if (_newLvl > _wasLvl){
        toast(`❤️ You're now ${FRIEND_LVL_NAMES[_newLvl]} with ${_q.npcName}!`);
        log(`❤️ Friendship up: <b>${_q.npcName}</b> — ${FRIEND_LVL_NAMES[_newLvl]}`, "good");
        if (_newLvl === 4) grantFriendshipGift(_q.npcId, _q.npcName);
        if (_newLvl === 5) showKeepsakeCeremony(_q.npcId, _q.npcName);
      } else {
        toast(`✅ Quest done! +${fmt(_q.reward)} coins, +${_q.friendXp} ❤️ with ${_q.npcName}.`);
      }
      log(`📋 Quest complete: <b>${_q.npcName}</b> — ${fmt(_q.reward)} coins earned.`, "good");
      renderMain(); updateHud(); save();
    };
  });
  document.querySelectorAll("[data-challenge-claim]").forEach(b=> b.onclick = ()=> (globalThis as any).claimDailyChallenge());
  document.querySelectorAll("[data-plant-garden]").forEach(b=> b.onclick = ()=>{
    const [slot,cropId] = (b as HTMLElement).dataset.plantGarden.split('|');
    (globalThis as any).plantGarden(parseInt(slot), cropId);
  });
  document.querySelectorAll("[data-harvest-garden]").forEach(b=> b.onclick = ()=>{
    (globalThis as any).harvestGarden(parseInt((b as HTMLElement).dataset.harvestGarden));
  });
  // daily reward
  document.querySelectorAll("[data-daily-claim]").forEach(b=> b.onclick = ()=>{
    if (S.dailyReward.lastDate === new Date().toDateString()){ toast("Already collected today."); return; }
    const _r = Math.min(500, 50 + totalLvl() * 3);
    S.coins += _r; S.counters.coinsEarned = (S.counters.coinsEarned||0) + _r;
    S.dailyReward.lastDate = new Date().toDateString();
    toast("📮 Daily parcel collected! +" + fmt(_r) + " coins.");
    log("📮 <b>Daily parcel:</b> +" + fmt(_r) + " coins. Come back tomorrow!", "good");
    renderMain(); updateHud(); save();
  });
  // property purchase
  document.querySelectorAll("[data-buy-prop]").forEach(b=> b.onclick = ()=>{
    const _pid = b.dataset.buyProp;
    const _p = PROPERTIES.find(pr=>pr.id===_pid);
    if (!_p || S.properties.includes(_pid)){ return; }
    if (S.coins < _p.cost){ toast("Not enough coins."); return; }
    S.coins -= _p.cost; S.properties.push(_pid);
    toast("🏘️ " + _p.n + " purchased! Earning +" + _p.rent + " coins/min.");
    log("🏘️ Property acquired: <b>" + _p.n + "</b> — +" + _p.rent + " coins/min passive income.", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-pos-sell]").forEach(b=> b.onclick = ()=> sellPosition(b.dataset.posSell));
  document.querySelectorAll("[data-pos-buy]").forEach(b=> b.onclick = ()=>{
    const [cid, qStr] = (b.dataset.posBuy||"").split("|");
    buyPosition(cid, parseInt(qStr)||1);
  });
  document.querySelectorAll("[data-loanborrow]").forEach(b=>b.onclick=()=>{
    const amt=parseInt(b.dataset.loanborrow);
    S.coins+=amt;
    S.loans.push({amount:amt, borrowed:Date.now(), interestAccrued:0});
    S.counters.loansTotal = (S.counters.loansTotal||0) + 1;
    toast(`🏦 Borrowed ${fmt(amt)} coins — 5% daily interest.`);
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-loanrepay]").forEach(b=>b.onclick=()=>{
    const i=parseInt(b.dataset.loanrepay), ln=S.loans[i];
    if (!ln) return;
    const total=ln.amount+Math.round(ln.interestAccrued);
    if (S.coins<total){ toast("Not enough coins to repay."); return; }
    S.coins-=total; S.loans.splice(i,1);
    toast(`✅ Loan repaid — ${fmt(total)} coins.`);
    renderMain(); updateHud(); save();
  });
  // bike shop handlers
  document.querySelectorAll("[data-bikerent]").forEach(b=> b.onclick = ()=>{
    if (S.coins < 150){ toast("Need 150 coins."); return; }
    S.coins -= 150; S.bike.owned = true;
    toast("🚲 Bike purchased! Equip it from the Cycle Shop.");
    log("🚲 <b>Bike purchased</b> — 25% faster on roads.", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-bikeequip]").forEach(b=> b.onclick = ()=>{
    S.bike.equipped = !S.bike.equipped;
    toast(S.bike.equipped ? "🚲 Bike equipped — ride on!" : "🛑 Bike parked.");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-bikeservice]").forEach(b=> b.onclick = ()=>{
    const cost = serviceCost();
    if (S.coins < cost){ toast("Not enough coins."); return; }
    S.coins -= cost; S.bike.condition = 100;
    toast("🔧 Bike serviced — back to 100%!");
    log("🔧 <b>Bike serviced</b> — " + fmt(cost) + " coins.", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-bikecolor]").forEach(b=> b.onclick = ()=>{
    const newCol = b.dataset.bikecolor;
    if ((S.bike.color||'#e84040') === newCol) return;
    if (S.coins < 30){ toast("Need 30 coins for a respray."); return; }
    S.coins -= 30; S.bike.color = newCol;
    toast("🎨 Bike resprayed!");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-bikewheels]").forEach(b=> b.onclick = ()=>{
    const wid = b.dataset.bikewheels;
    const costs = { sport:200, offroad:300, mountain:500 };
    const cost = costs[wid] || 0;
    if (S.coins < cost){ toast("Not enough coins."); return; }
    S.coins -= cost; S.bike.wheels = wid;
    toast("⬆️ " + BIKE_WHEEL_N[wid] + " installed!");
    log("⬆️ Bike upgraded: <b>" + BIKE_WHEEL_N[wid] + "</b>", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-bikelight]").forEach(b=> b.onclick = ()=>{
    if (S.coins < 150){ toast("Need 150 coins."); return; }
    S.coins -= 150; S.bike.hasLight = true;
    toast("💡 Bike light fitted — lights up the night!");
    log("💡 <b>Bike light</b> installed.", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-enroll]").forEach(b=> b.onclick = ()=>{
    const _cid = b.dataset.enroll;
    const _c = COURSES.find(c=>c.id===_cid);
    if (!_c) return;
    if (S.degrees.includes(_cid)){ toast("Already completed."); return; }
    if (S.studying){ toast("Already studying: " + (COURSES.find(c=>c.id===S.studying.courseId)?.n||"?") + "."); return; }
    if (S.coins < _c.cost){ toast("Not enough coins."); return; }
    S.coins -= _c.cost;
    S.studying = { courseId:_cid, endsAt:Date.now() + _c.ms };
    toast(_c.ic + " Enrolled in " + _c.n + ". Study time: " + Math.round(_c.ms/60000) + " min.");
    log(_c.ic + " Enrolled in <b>" + _c.n + "</b>.", "good");
    renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-pet]").forEach(b=> b.onclick = ()=>{
    S.pets.active = b.dataset.pet; renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-cust]").forEach(b=> b.onclick = ()=>{
    if (!S.appearance) S.appearance = Object.assign({}, DEFAULT_APPEARANCE);
    S.appearance[b.dataset.cust] = b.dataset.cust==='hairStyle' ? parseInt(b.dataset.val) : b.dataset.val;
    renderMain(); updateHud(); save();
  });
  const ex = $("#btn-export");
  if (ex){
    ex.onclick = ()=>{ save(); $("#savebox").value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); toast("Save exported — copy the string."); };
    $("#btn-import").onclick = ()=>{
      try{
        const parsed = JSON.parse(decodeURIComponent(escape(atob($("#savebox").value.trim()))));
        if (parsed && parsed.v===1){ S = Object.assign(freshState(), parsed); toast("Save imported!"); log("💾 Save imported.","good"); renderNav(); renderMain(); updateHud(); save(); }
        else toast("That save string isn't valid.");
      }catch(e){ toast("That save string isn't valid."); }
    };
    $("#btn-wipe").onclick = ()=>{
      if (confirm("Wipe your empire and start again? This cannot be undone.")){
        S = freshState(); if (HAS_LS) try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
        renderNav(); renderMain(); updateHud(); log("🧹 Fresh start. The valley awaits.");
        showTitle();
      }
    };
  }
  const _rm = document.getElementById("btn-roadmap");
  if (_rm) _rm.onclick = () => openRoadmap();
}

function updateHud(){
  $("#hud-coins").textContent = fmt(S.coins);
  $("#hud-total").textContent = totalLvl();
  const nameEl = document.getElementById("hud-name");
  if (nameEl) nameEl.textContent = S.playerName || "—";
  const titleEl = document.getElementById("hud-title");
  if (titleEl){
    const lg = S.legacy||0;
    const t = earnedTitle((S.journey && S.journey.claimed) || []);
    const txt = lg > 0 ? `${"⭐".repeat(legacyStars(lg))} ${legacyRank(lg)}` : (t ? `“${t}”` : "");
    titleEl.textContent = txt;
    titleEl.style.display = txt ? "block" : "none";
  }
  const stat = document.getElementById("hud-name-stat");
  if (stat){
    if (S.playerName) stat.classList.add("named");
    else stat.classList.remove("named");
  }
  const pet = PETS.find(p=>p.id===S.pets.active);
  $("#hud-pet").textContent = pet ? pet.ic+" "+pet.n.split(" ")[1] : "—";
  drawCharPreview("hud-portrait");
  const charBtn = document.getElementById("btn-character");
  if (charBtn) charBtn.onclick = () => { S.tab="character"; renderNav(); renderMain(); };
  updateClock();
}
function updateProgressBar(){
  if (!S.action) return;
  const act = findAction(S.action.skill, S.action.id);
  if (!act) return;
  const el = document.getElementById("prog-"+act.id);
  if (el){
    const dur = act.ms * speedMult(S.action.skill);
    el.style.width = Math.min(100, S.action.progress / dur * 100) + "%";
  }
}

/* ---------- boot ---------- */
const hadSave = load();
applyOffline();
syncTabUnlocks(true);   // back-fill tab unlocks for existing saves (never lose earned tabs)
ensureMarket(); rollMarket(false);
fillContracts();
if (!TABS.some(t=>t.id===S.tab)) S.tab = "village";
preloadAll();
renderNav(); renderMain(); updateHud(); syncMusicButton();
document.getElementById("btn-music").onclick = () => cycleVolume();
document.getElementById("btn-fullscreen").onclick = () => toggleFullscreen();
document.getElementById("btn-districts")?.addEventListener("click", () => openDistricts());
document.getElementById("btn-ledger")?.addEventListener("click", () => openLedger());
document.getElementById("btn-inv")?.addEventListener("click", () => toggleInventory());
document.getElementById("btn-journey")?.addEventListener("click", () => openJourney());
document.getElementById("btn-journal")?.addEventListener("click", () => openJournalPanel());
document.getElementById("version-label")?.addEventListener("click", () => openRoadmap());
document.getElementById("version-label")?.addEventListener("keydown", (e:any) => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); openRoadmap(); } });
syncJourneyBtn(); syncJournalBtn();
window.addEventListener("keydown", e => {
  if ((e.key==="j"||e.key==="J") && !/^(INPUT|TEXTAREA)$/.test((e.target as any)?.tagName||"")){ openJourney(); return; }
  if ((e.key==="i"||e.key==="I") && !/^(INPUT|TEXTAREA)$/.test((e.target as any)?.tagName||"")){ toggleInventory(); return; }
  if (S.tab !== "village" && !INTERIOR_TABS.has(S.tab)) return;
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","a","d","w","s"].includes(e.key)){
    VKEYS[e.key] = true;
    if (e.key.startsWith("Arrow")) e.preventDefault();
  }
});
window.addEventListener("keyup", e => { VKEYS[e.key] = false; });
requestAnimationFrame(villageFrame);
if (!S.playerName){
  showTitle();
} else {
  log(`👷 Back on shift, <b>${pName()}</b>. The supply chain never sleeps.`, "good");
}
if (window._offlineSummary){
  const _os = window._offlineSummary;
  const _coinStr = _os.passiveCoins > 0 ? ` +<b>${fmt(_os.passiveCoins)} coins</b>` : '';
  log(`🌙 <b>Away for ${_os.hrsAway}</b> —${_coinStr} earned while you slept.`, "good");
  _os.lines.forEach(l => log(`&nbsp;&nbsp;${l}`, "dim"));
  if (_os.passiveCoins > 0) toast(`🌙 Welcome back! +${fmt(_os.passiveCoins)} coins earned while away.`);
  window._offlineSummary = null;
}
if (!hadSave){
  log("Mine Iron Ore, smelt it in the Steelworks, press Brackets, then deliver Contracts — or haggle with Marge in the Trade tab.");
}

/* ---- Garden ---- */
const _gardenToasted = [false, false, false, false];
function updateGarden(now: number){
  if (!Array.isArray(S.garden)) return;
  const slots = plotsUnlocked(S.homeTier||0);
  for (let i=0; i<slots; i++){
    const g = S.garden[i];
    if (g && now >= g.readyAt && !_gardenToasted[i]){
      _gardenToasted[i] = true;
      const crop = GARDEN_CROPS.find(c=>c.id===g.cropId);
      if (crop) toast(`🌻 ${crop.n} is ready to harvest! Visit your cottage.`);
    }
    if (!g) _gardenToasted[i] = false;
  }
}

/* ---- Fullscreen ---- */
function toggleFullscreen(){
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen().catch(()=>{});
  else
    document.exitFullscreen().catch(()=>{});
}
document.addEventListener('fullscreenchange', ()=>{
  const fs = !!document.fullscreenElement;
  document.body.classList.toggle('fullscreen-mode', fs);
  const btn = document.getElementById('btn-fullscreen');
  if (btn) btn.textContent = fs ? '✕FS' : '⛶';
});

/* ---- Gamepad ---- */
const _gpLastBtns: boolean[] = [];
function pollGamepad(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : ([] as (Gamepad|null)[]);
  const pad = Array.from(pads).find(p => p && p.connected) as Gamepad | undefined;
  GPKEYS.ArrowLeft = false; GPKEYS.ArrowRight = false;
  GPKEYS.ArrowUp   = false; GPKEYS.ArrowDown  = false;
  if (!pad) return;
  const lx = (pad.axes[0]||0), ly = (pad.axes[1]||0), dead = 0.20;
  if (lx < -dead || pad.buttons[14]?.pressed) GPKEYS.ArrowLeft  = true;
  if (lx >  dead || pad.buttons[15]?.pressed) GPKEYS.ArrowRight = true;
  if (ly < -dead || pad.buttons[12]?.pressed) GPKEYS.ArrowUp    = true;
  if (ly >  dead || pad.buttons[13]?.pressed) GPKEYS.ArrowDown  = true;
  const prev = _gpLastBtns;
  if (pad.buttons[0]?.pressed  && !prev[0])  gpInteract();
  if (pad.buttons[1]?.pressed  && !prev[1])  gpBack();
  if (pad.buttons[3]?.pressed  && !prev[3])  toggleInventory();   // Y — inventory
  if (pad.buttons[2]?.pressed  && !prev[2])  openJourney();       // X — Founder's Journey
  if (pad.buttons[9]?.pressed  && !prev[9])  toggleFullscreen();
  for (let i=0;i<pad.buttons.length;i++) _gpLastBtns[i] = pad.buttons[i]?.pressed||false;
}
function gpInteract(){
  if (CHAT_NPC){ CHAT_NPC.quipIdx=(CHAT_NPC.quipIdx+1)%CHAT_NPC.quips.length; CHAT_NPC=null; renderMain(); return; }
  if (INTERIOR_TABS.has(S.tab)){
    const workers = VILLAGER_STATE.filter(v=>v.indoor && v.workTab===S.tab);
    const nearest = workers.sort((a,b)=>Math.hypot(IP.x-a.iwx,IP.y-a.iwy)-Math.hypot(IP.x-b.iwx,IP.y-b.iwy))[0];
    if (nearest && Math.hypot(IP.x-nearest.iwx, IP.y-nearest.iwy) < 60){ CHAT_NPC=nearest; renderMain(); }
    return;
  }
  if (S.tab!=="village") return;
  let bestO: any = null, bestD = Infinity;
  for (const o of V_OBJECTS){
    const ap = objApproach(o), d = Math.hypot(VP.x-ap.x, VP.y-ap.y);
    if (d < 120 && d < bestD){ bestO=o; bestD=d; }
  }
  if (bestO){
    if (bestD < 46) interactObj(bestO);
    else { const ap=objApproach(bestO); VP.tx=ap.x; VP.ty=ap.y; VP.pending=bestO; }
  }
}
function gpBack(){
  if (CHAT_NPC){ CHAT_NPC=null; renderMain(); return; }
  if (INTERIOR_TABS.has(S.tab)||S.tab!=="village"){ S.tab="village"; renderNav(); renderMain(); }
}
window.addEventListener('gamepadconnected', ()=>{
  toast('🎮 Controller connected!');
  const el = document.getElementById('gp-indicator');
  if (el) el.style.display='flex';
});
window.addEventListener('gamepaddisconnected', ()=>{
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  if (!pads.length){ const el=document.getElementById('gp-indicator'); if (el) el.style.display='none'; }
});

let lastTick = Date.now();
setInterval(()=>{
  const now = Date.now();
  const dt = now - lastTick; lastTick = now;
  const beforeItems = JSON.stringify(S.items);
  tick(dt);
  updateWorldEvents();
  updateFestivalNotification();
  updateWeather();
  updateDeliveries();
  updateStudying();
  updateBankInterest(now);
  updateRetail(now);
  updateRent(now);
  updateLoans();
  updateFriendGifts(now);
  updateNoticeBoard(now);
  updatePrestigeIncome(now);
  updateVillagerRequests(now);
  updateDailyChallenge();
  updateGarden(now);
  // engagement heartbeat — something every 20-30 seconds
  if (now > _heartbeatAt){
    const _cands = HEARTBEAT_POOL.filter(e => now > (_heartbeatCD[e.id]||0));
    if (_cands.length){
      let _r = Math.random() * _cands.reduce((s,e)=>s+e.w,0);
      const _hev = _cands.find(e=>(_r-=e.w)<=0) || _cands[0];
      const _hmsg = _hev.fn();
      if (_hmsg){ toast(_hmsg); _heartbeatCD[_hev.id] = now + 90*1000; _heartbeatAt = now + (20+Math.random()*10)*1000; }
      else { _heartbeatAt = now + 5000; }
    } else { _heartbeatAt = now + 5000; }
  }
  updateProgressBar();
  sampleNetWorth();   // LE4: throttled net-worth history sampling
  checkDistrictUnlocks();   // announce a district the moment its level gate is crossed
  checkJourney();           // nudge when a Founder's Journey milestone becomes claimable
  syncTabUnlocks(false);    // reveal advanced tabs as the player earns them
  checkJournal();           // auto-grant Valley Journal "firsts" rewards
  if (rollMarket(false) && S.tab === "trade") renderMain();
  const _itemsChanged = JSON.stringify(S.items) !== beforeItems;
  if (_itemsChanged && (S.tab in SKILLS || S.tab==="contracts")) {
    renderMain(); updateHud();
  }
  // Village: refresh just the Warehouse sidebar so ore/bar counts and the
  // objective tracker update live while mining, without rebuilding the canvas.
  if (S.tab === "village"){
    const _sb = document.getElementById("village-sidebar");
    if (_sb && (_itemsChanged || (S.tut && !S.tut.done))) _sb.innerHTML = renderInventoryPanel();
  }
}, 200);
setInterval(save, 15000);
window.addEventListener("beforeunload", save);
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState==="hidden") save(); });

/* ---------- dismiss pixel loading screen ---------- */
(function(){
  const b = document.getElementById('ld-bar');
  if (b) { b.style.transition = 'width 0.25s'; b.style.width = '100%'; }
  setTimeout(() => {
    const ld = document.getElementById('loading');
    if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 550); }
  }, 280);
})();
