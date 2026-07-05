// @ts-nocheck — full typing extracted progressively from M3+
import { XP_TABLE, levelFromXp } from './engine/xp.ts';
import { ITEMS } from './data/items.ts';
import { SKILLS } from './data/skills.ts';
import { NPCS, MARKET_ROLL_MS } from './data/npcs.ts';
import { UPGRADES } from './data/upgrades.ts';
import { PETS } from './data/pets.ts';
import { CLIENTS, CONTRACT_POOL } from './data/contracts.ts';
import { TRACKS } from './audio/tracks.ts';
import { TILE, VCOLS, VROWS, VIEW_W, VIEW_H, VMAP, V_OBJECTS } from './world/map.ts';
import { nightAlpha, lampGlow, isNight, skyTint, gameHour } from './world/daynight.ts';
import { pixelScale } from './world/renderer.ts';
import { DEFAULT_APPEARANCE, SKIN_TONES, HAIR_COLOURS, SHIRT_COLOURS, TROUSER_COLOURS } from './player/customisation.ts';
import { VILLAGERS } from './data/villagers.ts';
import { preloadAll, drawSprite, getSprite } from './world/assets.ts';

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
function rollMarket(force){
  ensureMarket();
  const steps = force ? 1 : Math.floor((Date.now() - S.market.last) / MARKET_ROLL_MS);
  if (steps <= 0) return false;
  for (let s = 0; s < Math.min(steps, 24); s++){
    NPCS.forEach(n => n.stock.forEach(it => {
      let d = S.market.drift[n.id][it];
      d = d * (0.93 + Math.random()*0.14);
      S.market.drift[n.id][it] = Math.min(1.45, Math.max(0.65, d));
    }));
  }
  S.market.last = Date.now();
  return true;
}
function tradeBonus(){
  let b = skillLvl("trading") * 0.002;
  if (S.pets.active === "warehouse_panda") b += 0.05;
  return Math.min(b, 0.25);
}
function buyPrice(npc, it){
  ensureMarket();
  const d = S.market.drift[npc.id][it];
  return Math.max(1, Math.round(ITEMS[it].v * d * 1.35 * (1 - tradeBonus())));
}
function sellPrice(npc, it){
  ensureMarket();
  const d = S.market.drift[npc.id][it];
  const p = Math.round(ITEMS[it].v * d * 0.80 * (1 + tradeBonus()));
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
    grantXp("trading", Math.max(1, Math.round(unit * q * 0.06)));
    log(`⚖️ Bought ${q}× ${ITEMS[it].n} from ${npc.n} (−${fmt(unit*q)} coins)`);
  } else {
    const unit = sellPrice(npc, it);
    const q = qty === "max" ? itemCount(it) : Math.min(qty, itemCount(it));
    if (q <= 0){ toast("Nothing to sell."); return; }
    S.items[it] -= q; S.coins += unit * q;
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
  { say:()=>`Hey ${pName()}! Frost here — I keep things cool around the valley. Follow the path west into the quarry canyon and tap the Iron Rock and mine <b>5 Iron Ore</b>.`,
    obj:"Mine 5 Iron Ore", cond:()=> (S.prod.iron_ore||0) >= 5, reward:25 },
  { say:()=>`Nice swing, ${pName()}! Ore's no good raw. Walk up to the <b>Furnace</b> (the building with the chimney) and smelt <b>2 Iron Bars</b>.`,
    obj:"Smelt 2 Iron Bars", cond:()=> (S.prod.iron_bar||0) >= 2, reward:25 },
  { say:()=>`Toasty! Now make something someone will pay for — pop into the <b>Workshop</b> next door and press <b>1 Bracket</b>.`,
    obj:"Press 1 Bracket", cond:()=> (S.prod.bracket||0) >= 1, reward:30 },
  { say:()=>`Last step: head to the <b>Depot</b> and deliver an order. Clients round here love punctuality almost as much as I love this t-shirt.`,
    obj:"Deliver 1 contract", cond:()=> S.counters.contracts >= 1, reward:60 },
];
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
  }};
})();
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
const plHair     = () => (S.appearance && S.appearance.hair)     || DEFAULT_APPEARANCE.hair;
const plShirt    = () => (S.appearance && S.appearance.shirt)    || DEFAULT_APPEARANCE.shirt;
const plSkin     = () => (S.appearance && S.appearance.skin)     || DEFAULT_APPEARANCE.skin;
const plTrousers = () => (S.appearance && S.appearance.trousers) || DEFAULT_APPEARANCE.trousers;

const FROST_TIPS = [
  "Rocks respawn instantly round here. Union rules.",
  "Sell when the arrow's green. Buy when it's red. That's the whole MBA.",
  "The Rail Rhino is real. I've seen it. Deliver enough contracts.",
  "Upgrades in the Town Hall pay for themselves. Usually.",
  "Stay frosty.",
];

/* ---------- achievements ---------- */
function prodSum(ids){ return ids.reduce((a,id)=>a+(S.prod[id]||0),0); }
const ORES = ["iron_ore","copper_ore","coal","bauxite","rare_earth"];
const BARS = ["iron_bar","copper_wire","steel_bar","alu_ingot","tech_alloy"];
const GOODS = ["bracket","wiring_loom","gearbox","chassis","servo_unit"];
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
];
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
  { id:"frost", n:"Frost", hair:"#17161a", shirt:"#bfe8f7", x:16*TILE, y:5.45*TILE, tx:null, ty:null, wait:2, moving:false, facing:1, pending:null,
    area:[10,6,32,9], home:[13,7,17,9], tips:FROST_TIPS, tee:"STAYFROSTY", ri:-1, benchIdx:5,
    route:[[11,5.45],[20,5.45],[31,5.45],[31,10.45],[20,10.45],[20.6,8.35],[11,10.45]],
    profile:{ job:"Supply Chain Professional", home:"The Valley Lodge", children:["Harison (6)"] } },
  { id:"poppy", n:"Poppy", hair:"#b0574f", shirt:"#ffd666", x:5*TILE, y:14*TILE, tx:null, ty:null, wait:3, moving:false, facing:1, pending:null,
    area:[2,12,8,16], home:[2,12,5,13], tips:[
      "Morning! My turnips go by lorry now. Fancy that.",
      "Frost says you're the new founder. Don't work too hard!",
      "The market stalls pay best on green-arrow days.",
    ],
    profile:{ job:"Turnip Farmer", home:"Poppy's Farm" } },
  { id:"sam", n:"Sam", hair:"#3a3a3a", shirt:"#4a6ea9", x:26*TILE, y:17.6*TILE, tx:null, ty:null, wait:3, moving:false, facing:1, pending:null,
    area:[12,17,32,18], home:[27,17,31,18], tips:[
      "One day ships'll dock here. Port Salvo, they'll call it.",
      "See that boat? Doesn't leak much anymore.",
      "Heaviest thing I ever lifted? A Cargo Turtle. True story.",
    ],
    profile:{ job:"Harbour Warden", home:"Dockside Hut" } },
];
const VP = { x: 16*TILE, y: 6.5*TILE, tx: null, ty: null, pending: null, facing: 1, moving: false, dir:"down", enterCooldown: 0 };
const IP = { x: VIEW_W/2, y: VIEW_H*0.68, tx: null, ty: null, facing: 1, moving: false, dir:"down" };
const BEACH_BIRDS = [
  { x:6*TILE, y:17.2*TILE, vx:0, vy:0, state:"sit", flap:0 },
  { x:34*TILE, y:17.4*TILE, vx:0, vy:0, state:"sit", flap:1.4 },
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
// Night wildlife
const FOX = { x:42*TILE, y:8*TILE, tx:null, ty:null, facing:1, moving:false, dir:"right", wait:0 };
const OWLS = [
  { x:41.4*TILE, y:1.8*TILE, blink:0 },
  { x:44.3*TILE, y:2.8*TILE, blink:0.7 },
  { x:44.6*TILE, y:9.8*TILE, blink:1.4 },
];
const SHARK = { x:28*TILE, y:21.5*TILE, vx:0.35 };
const INTERIOR_TABS = new Set(["mining","steelworks","manufacturing","contracts","trade","pets","upgrades","ach","woodcutting","fishing","home"]);
const STATION_DEFS = {
  mining:        [
    { fx:0.16, fy:0.50, sk:'prop_hopper',   skill:'mining',        id:'iron_ore',   ic:'🪨', lbl:'Iron Ore' },
    { fx:0.50, fy:0.62, sk:'prop_hopper',   skill:'mining',        id:'copper_ore', ic:'🟤', lbl:'Copper Ore' },
    { fx:0.84, fy:0.50, sk:'prop_hopper',   skill:'mining',        id:'coal',       ic:'⚫', lbl:'Coal' },
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
  fishing: [
    { fx:0.25, fy:0.36, sk:'prop_hopper', skill:'fishing', id:'sardine',  ic:'🐟', lbl:'Sardine Spot' },
    { fx:0.50, fy:0.30, sk:'prop_hopper', skill:'fishing', id:'mackerel', ic:'🐠', lbl:'Mackerel Spot' },
    { fx:0.75, fy:0.36, sk:'prop_hopper', skill:'fishing', id:'bass',     ic:'🐡', lbl:'Bass Spot' },
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
  contracts:     { ic:"📦", n:"The Depot",           tip:"Fulfil orders to earn Logistics XP." },
  trade:         { ic:"⚖️", n:"The Market Hall",     tip:"Buy and sell goods with traders." },
  upgrades:      { ic:"🛒", n:"The Town Hall",        tip:"Invest profits in permanent upgrades." },
  pets:          { ic:"🐾", n:"The Companion Barn",  tip:"Your crew lives here." },
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
  mining: [
    {x:12,  y:8,  w:7,  h:156}, // beam 1 (left of iron_ore station x=45)
    {x:78,  y:8,  w:7,  h:156}, // beam 2 (between iron x=45 and copper x=128)
    {x:160, y:8,  w:7,  h:156}, // beam 3 (between copper x=128 and coal x=211)
    {x:248, y:8,  w:7,  h:156}, // beam 4 (right of coal station x=211)
    {x:66,  y:160,w:36, h:20},  // minecart
    {x:222, y:158,w:14, h:14},  // crate a
    {x:238, y:158,w:14, h:14},  // crate b
    {x:4,   y:154,w:22, h:32},  // coal pile
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
  home: [
    {x:14,  y:56, w:64, h:76},  // bed
    {x:230, y:50, w:38, h:44},  // fireplace surround
  ],
};
const VKEYS = {};
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
function solidAt(px, py){
  // picket fences along forest edges — solid except path gates
  {
    const _fr = Math.floor(py/TILE);
    // west forest west fence (col 39)
    if (px >= 39*TILE-4 && px <= 39*TILE+8 && _fr >= 2 && _fr <= 16 && _fr!==5 && _fr!==6 && _fr!==10 && _fr!==11) return true;
    // west forest east fence (col 47)
    if (px >= 47*TILE-4 && px <= 47*TILE+8 && _fr >= 2 && _fr <= 16 && _fr!==5 && _fr!==6 && _fr!==10 && _fr!==11) return true;
    // east forest west fence (col 87)
    if (px >= 87*TILE-4 && px <= 87*TILE+8 && _fr >= 2 && _fr <= 16 && _fr!==5 && _fr!==6 && _fr!==10 && _fr!==11) return true;
  }
  const t = tileAt(px, py);
  if (t==="T" || t==="W" || t==="C") return true;
  for (const o of V_OBJECTS){
    if (o.kind==="lamp" || o.kind==="sign" || o.kind==="plant") continue;
    const r = objRect(o);
    if (px>=r.x && px<r.x+r.w && py>=r.y && py<r.y+r.h) return true;
  }
  return false;
}
function moveActor(a, dt, speed, free=false){
  let dx=0, dy=0;
  if ((a===VP||a===IP) && (VKEYS.ArrowLeft||VKEYS.a)) dx-=1;
  if ((a===VP||a===IP) && (VKEYS.ArrowRight||VKEYS.d)) dx+=1;
  if ((a===VP||a===IP) && (VKEYS.ArrowUp||VKEYS.w)) dy-=1;
  if ((a===VP||a===IP) && (VKEYS.ArrowDown||VKEYS.s)) dy+=1;
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
    const o = V_OBJECTS.find(x=>x.kind==="rock" && x.ore===actId);
    if (o){ const r=objRect(o); return { x:r.x+12, y:r.y+22 }; }
  }
  if (skill==="steelworks"){ const o=V_OBJECTS.find(x=>x.id==="furnace"); const a=objApproach(o); return {x:a.x, y:a.y}; }
  if (skill==="manufacturing"){ const o=V_OBJECTS.find(x=>x.id==="workshop"); const a=objApproach(o); return {x:a.x, y:a.y}; }
  if (skill==="woodcutting"){ const o=S.action?.objId ? V_OBJECTS.find(x=>x.id===S.action.objId) : V_OBJECTS.find(x=>x.kind==="tree" && x.ore===actId); if (o){ const r=objRect(o); return {x:r.x+r.w/2, y:r.y+r.h+4}; } }
  if (skill==="fishing"){ const o=V_OBJECTS.find(x=>x.id==="pier"); if(o){ const a=objApproach(o); return {x:a.x, y:a.y}; } return null; }
  return null;
}
const SKILL_TOOL = { mining:"⛏️", steelworks:"🔨", manufacturing:"🔧", woodcutting:"🪓", fishing:"🎣" };
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
    const locked = skillLvl("woodcutting") < o.lvl;
    const act = SKILLS.woodcutting?.actions?.find(a=>a.id===o.ore);
    return `🌲 ${act ? act.n : o.ore}${locked ? " · Lv "+o.lvl+" required" : ""}`;
  }
  if (o.kind==="lamp" || o.kind==="plant") return "";
  if (o.kind==="bench") return "🪑 Bench";
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
  if (o.kind==="fountain"){ toast("⛲ You toss a coin in. Feels lucky."); return; }
  if (o.kind==="tree"){
    if (skillLvl("woodcutting") < o.lvl){ toast(`Requires Woodcutting level ${o.lvl}.`); return; }
    if (S.action && S.action.skill==="woodcutting" && S.action.objId===o.id){
      S.action = null; renderNav(); toast("Stopped woodcutting."); save(); return;
    }
    const act = SKILLS.woodcutting?.actions?.find(a=>a.id===o.ore);
    S.action = { skill:"woodcutting", id:o.ore, objId:o.id, progress:0 };
    toast(`🪓 ${act ? act.n : "Chopping"}...`);
    log(`▶ Started: ${act ? act.n : "Chop Tree"}`);
    renderNav(); save(); return;
  }
  if (o.kind==="rock"){
    if (skillLvl("mining") < o.lvl){ toast(`Requires Mining level ${o.lvl}.`); return; }
    if (S.action && S.action.skill==="mining" && S.action.id===o.ore){
      S.action = null; renderNav(); toast("Stopped mining."); save(); return;
    }
    S.action = { skill:"mining", id:o.ore, progress:0 };
    toast(`⛏️ Mining ${ITEMS[o.ore].n}...`);
    log(`▶ Started: Mine ${ITEMS[o.ore].n}`);
    renderNav(); save();
    return;
  }
  if (o.kind==="npc"){
    toast(`${o.w.id==="frost"?"❄️":"💬"} ${o.w.n.toUpperCase()}: ` + o.w.tips[Math.floor(Math.random()*o.w.tips.length)]);
    return;
  }
  S.tab = o.tab;
  S.roomObjId = o.id;
  IP.x = icanvasW()/2; IP.y = icanvasH() - 34; IP.tx = null; IP.ty = null; IP.moving = false; IP.dir = "up";
  renderNav(); renderMain(); showZoneCard(o.tab);
}
function showWandererProfile(w){
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
function drawPerson(ctx, x, y, hair, shirt, t, moving, facing, tool, dir, skin, trouser, toolColor, female){
  skin    = skin    || "#f2c49a";
  trouser = trouser || "#4a5a8a";
  dir = dir || (facing>=0 ? "right" : "left");
  const bob = moving ? Math.sin(t*10)*1.5 : Math.sin(t*2)*0.6;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y+bob));
  ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 10-bob, 8, 3, 0, 0, 7); ctx.fill();
  const legSwing = moving ? Math.sin(t*10)*3 : 0;
  ctx.fillStyle=trouser;
  ctx.fillRect(-5, 2, 4, 8+legSwing*0.4); ctx.fillRect(1, 2, 4, 8-legSwing*0.4);
  ctx.fillStyle=shirt; ctx.fillRect(-7, -6, 14, 10);
  ctx.fillStyle=shirt;
  const armSwing = moving ? Math.sin(t*10+3)*3 : 0;
  ctx.fillRect(-9, -5+armSwing*0.3, 3, 8); ctx.fillRect(6, -5-armSwing*0.3, 3, 8);
  ctx.fillStyle=skin; ctx.fillRect(-9, 2+armSwing*0.3, 3, 3); ctx.fillRect(6, 2-armSwing*0.3, 3, 3);
  ctx.fillStyle=skin; ctx.fillRect(-5, -16, 10, 10);
  if (dir==="up"){
    ctx.fillStyle=hair; ctx.fillRect(-6, -18, 12, 10);
    if (female){ ctx.fillRect(-8,-14,3,12); ctx.fillRect(5,-14,3,12); }
  } else {
    ctx.fillStyle=hair; ctx.fillRect(-6, -18, 12, 5);
    if (female){
      ctx.fillRect(-8, -16, 3, 15); // left flowing strand
      ctx.fillRect(5, -16, 3, 15);  // right flowing strand
    } else {
      ctx.fillRect(-6, -16, 2, 5); ctx.fillRect(4, -16, 2, 5);
    }
    ctx.fillStyle="#17161a";
    if (dir==="down"){ ctx.fillRect(-3, -11, 2, 2); ctx.fillRect(2, -11, 2, 2); ctx.fillStyle="#c96f4a"; ctx.fillRect(-1, -8, 3, 1); }
    else { ctx.fillRect(facing>=0?0:-2, -11, 2, 2); ctx.fillRect(facing>=0?3:-5, -11, 2, 2); }
  }
  if (tool){
    const swing = Math.sin(t*11);
    ctx.save();
    ctx.translate(facing*9, -4);
    ctx.rotate(facing * (swing*0.9 - 0.4));
    if (toolColor){
      ctx.fillStyle = toolColor + "99";
      ctx.beginPath(); ctx.arc(facing*7, -6, 7, 0, 7); ctx.fill();
    }
    ctx.font="14px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(tool, facing*7, -6);
    ctx.restore();
    if (swing > 0.82){
      ctx.fillStyle="#fff";
      ctx.fillRect(facing*14+((Math.floor(t*11)*7)%6), -2, 2, 2);
      ctx.fillRect(facing*17-((Math.floor(t*11)*5)%5), 2, 2, 2);
    }
  }
  ctx.restore();
}
function drawEmojiC(ctx, em, x, y, px){ ctx.font = px+"px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(em, x, y); }
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
      const pine = (c*13+r*7)%3===0;
      // gentle wind sway based on position + time
      const sway = Math.sin(t*0.8 + c*0.7 + r*0.5) * 1.5;
      ctx.fillStyle="#7a5230"; ctx.fillRect(x+9,y+12,6,10);
      if (pine){
        ctx.fillStyle="#3f8b52";
        ctx.beginPath(); ctx.moveTo(x+12+sway,y-4); ctx.lineTo(x+2,y+14); ctx.lineTo(x+22,y+14); ctx.closePath(); ctx.fill();
        ctx.fillStyle="#4e9e62"; // mid layer brightens the silhouette
        ctx.beginPath(); ctx.moveTo(x+12+sway*0.7,y+2); ctx.lineTo(x+5,y+14); ctx.lineTo(x+19,y+14); ctx.closePath(); ctx.fill();
      } else {
        const swayX = sway * 0.7;
        ctx.fillStyle="#4e9e5f"; ctx.beginPath(); ctx.arc(x+12+swayX,y+8,10,0,7); ctx.fill();
        ctx.fillStyle="#63b573"; ctx.beginPath(); ctx.arc(x+8+swayX,y+6,6,0,7); ctx.fill();
        ctx.fillStyle="#74c882"; ctx.beginPath(); ctx.arc(x+15+swayX*0.8,y+5,4,0,7); ctx.fill();
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
      }
      // Always draw emoji label and dynamic effects on top of sprite or canvas building
      drawEmojiC(ctx, o.ic, r.x+r.w/2, r.y+16, 13);
      if (o.chimney){
        ctx.fillStyle="#7a5a45"; ctx.fillRect(r.x+r.w-16, r.y-10, 8, 14);
        if (S.action && S.action.skill==="steelworks"){
          for (let i=0;i<3;i++){
            const p=((t*0.6+i*0.33)%1);
            ctx.fillStyle="rgba(120,120,130,"+(0.5*(1-p)).toFixed(2)+")";
            ctx.beginPath(); ctx.arc(r.x+r.w-12+Math.sin(p*6)*3, r.y-12-p*22, 4+p*4, 0, 7); ctx.fill();
          }
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
      const treeActive = S.action?.skill==="woodcutting" && S.action?.objId===o.id;
      const locked = skillLvl("woodcutting") < o.lvl;
      const sway = Math.sin(t*0.8 + o.tx*0.5)*2;
      // bark & foliage colour by species; muted when locked
      const bark = o.ore==="pine" ? "#7a5a2e" : o.ore==="oak" ? "#6a4828" : "#5a3818";
      const leaf1 = locked ? (o.ore==="pine"?"#3a6030":o.ore==="oak"?"#4a5828":"#3a4820")
                           : (o.ore==="pine"?"#4a9a3a":o.ore==="oak"?"#5a8040":"#3a7838");
      const leaf2 = locked ? (o.ore==="pine"?"#2e5028":o.ore==="oak"?"#3a4820":"#2a3a18")
                           : (o.ore==="pine"?"#5ab848":o.ore==="oak"?"#6a9050":"#4a8848");
      ctx.fillStyle=bark; ctx.fillRect(cx-3, r.y+r.h-6, 6, 7);
      ctx.fillStyle=leaf1; ctx.beginPath(); ctx.arc(cx+sway, r.y+r.h-18, o.ore==="pine"?12:15, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=leaf2; ctx.beginPath(); ctx.arc(cx+sway-(o.ore==="pine"?4:5), r.y+r.h-(o.ore==="pine"?25:28), o.ore==="pine"?7:10, 0, Math.PI*2); ctx.fill();
      if (o.ore==="hardwood"){ ctx.fillStyle=leaf1; ctx.beginPath(); ctx.arc(cx+sway+4, r.y+r.h-26, 8, 0, Math.PI*2); ctx.fill(); }
      if (locked){ ctx.fillStyle="rgba(0,0,0,.22)"; ctx.beginPath(); ctx.arc(cx, r.y+r.h-20, 16, 0, Math.PI*2); ctx.fill(); }
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
function drawExtras(ctx, t){
  const tier = villageTierLvl();
  // helper: draw picket fence strip at given x-offset, rows 2-16, with gate rows skipped
  const _drawFence = (fxBase, gateRows) => {
    const _fx = fxBase - 4;
    for (let fr = 2; fr <= 16; fr++){
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
  _drawFence(39*TILE, [5,6,10,11]); // west forest west fence
  _drawFence(47*TILE, [5,6,10,11]); // west forest east fence
  _drawFence(87*TILE, [5,6,10,11]); // east forest west fence
  // park (residential, tx≈76-86, ty≈6-10): sand area + border + spaced equipment
  {
    const pkX = 76*TILE, pkY = 6*TILE, pkW = 10*TILE, pkH = 4*TILE;
    // sand ground fill
    ctx.fillStyle="#e8d898"; ctx.fillRect(pkX+4, pkY+4, pkW-8, pkH-8);
    ctx.fillStyle="#e0d080"; ctx.fillRect(pkX+8, pkY+8, pkW-16, pkH-16);
    // thin picket border
    ctx.strokeStyle="#8c6040"; ctx.lineWidth=3; ctx.strokeRect(pkX+4, pkY+4, pkW-8, pkH-8);
    for(let bx=pkX+14; bx<pkX+pkW-8; bx+=10){ ctx.fillStyle="#a07050"; ctx.fillRect(bx,pkY+1,4,6); }
    for(let bx=pkX+14; bx<pkX+pkW-8; bx+=10){ ctx.fillStyle="#a07050"; ctx.fillRect(bx,pkY+pkH-6,4,6); }
    // sandbox (left zone)
    const sbX=pkX+12, sbY=pkY+pkH-46;
    ctx.fillStyle="#7a4a20"; ctx.fillRect(sbX,sbY,38,4); ctx.fillRect(sbX,sbY+28,38,4); ctx.fillRect(sbX,sbY,4,32); ctx.fillRect(sbX+34,sbY,4,32);
    ctx.fillStyle="#dfc878"; ctx.fillRect(sbX+4,sbY+4,30,24);
    ctx.fillStyle="#ede8a0"; ctx.fillRect(sbX+7,sbY+7,22,16);
    // slide (centre)
    const slX=pkX+90, slY=pkY+10;
    ctx.fillStyle="#6a4a2f"; ctx.fillRect(slX,slY,5,pkH-18);
    ctx.fillStyle="#c94a6a"; ctx.fillRect(slX+5,slY+8,14,4); // slide top ledge
    ctx.fillStyle="#e04060";
    ctx.beginPath(); ctx.moveTo(slX+5,slY+12); ctx.lineTo(slX+22,pkY+pkH-14); ctx.lineTo(slX+22,pkY+pkH-10); ctx.lineTo(slX+5,slY+16); ctx.closePath(); ctx.fill();
    // swings (right zone)
    const swX=pkX+140, swY=pkY+14;
    ctx.fillStyle="#6a4a2f"; ctx.fillRect(swX,swY,4,pkH-24); ctx.fillRect(swX+22,swY,4,pkH-24);
    ctx.strokeStyle="#5a3a1a"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(swX+2,swY+4); ctx.lineTo(swX+10,swY+34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(swX+24,swY+4); ctx.lineTo(swX+16,swY+34); ctx.stroke();
    ctx.fillStyle="#4a9ade"; ctx.fillRect(swX+7,swY+34,10,5);
    // small park tree (far right)
    ctx.fillStyle="#7a5230"; ctx.fillRect(pkX+pkW-22,pkY+10,5,pkH-20);
    ctx.fillStyle="#3f8b52"; ctx.beginPath(); ctx.arc(pkX+pkW-20,pkY+8,11,0,7); ctx.fill();
    ctx.fillStyle="#4e9e62"; ctx.beginPath(); ctx.arc(pkX+pkW-26,pkY+13,7,0,7); ctx.fill();
  }
  // residential flower strip (along path rows 5 and 10)
  for (let col = 50; col < 86; col += 5){
    const colors = ["#ff9db0","#ffd666","#b48ad9","#7cd0a8"];
    const fc = colors[Math.floor(col/5)%4];
    ctx.fillStyle=fc; ctx.fillRect(col*TILE+10, 4*TILE+14, 4, 4); ctx.fillStyle="#3aa66a"; ctx.fillRect(col*TILE+11, 4*TILE+18, 2, 3);
    ctx.fillStyle=colors[(Math.floor(col/5)+2)%4]; ctx.fillRect(col*TILE+10, 9*TILE+14, 4, 4); ctx.fillStyle="#3aa66a"; ctx.fillRect(col*TILE+11, 9*TILE+18, 2, 3);
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
  for (let i=0;i<5;i++) ctx.fillRect(28*TILE, 17.5*TILE+i*10, 2*TILE, 7);
  ctx.fillStyle="#7a5a3a"; ctx.fillRect(28*TILE+4, 17.5*TILE, 4, 52); ctx.fillRect(30*TILE-8, 17.5*TILE, 4, 52);
  const bob = Math.sin(t*1.6)*2;
  { const bx = 31.4*TILE, by = 19.6*TILE + bob;
    ctx.strokeStyle="#6a4a2f"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(30*TILE+6, 18.6*TILE+8); ctx.quadraticCurveTo(bx-6, by-4, bx+4, by+3); ctx.stroke();
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
    ctx.strokeStyle="#8c6947"; ctx.beginPath(); ctx.moveTo(12*TILE, 10.7*TILE); ctx.lineTo(20*TILE, 10.7*TILE); ctx.stroke();
    for (let i=0;i<12;i++){
      ctx.fillStyle=["#ff8a5c","#ffd666","#6fb7d9","#ff9db0"][i%4];
      const bx = 12*TILE+i*16;
      ctx.beginPath(); ctx.moveTo(bx, 10.7*TILE); ctx.lineTo(bx+12, 10.7*TILE); ctx.lineTo(bx+6, 10.7*TILE+8); ctx.closePath(); ctx.fill();
    }
    const fx=15.9*TILE, fy=7.4*TILE;
    ctx.fillStyle="#cfd8dd"; ctx.fillRect(fx-6, fy-2, 12, 8);
    for (let i=0;i<4;i++){ const p=(t*1.4+i*0.25)%1; ctx.fillStyle="rgba(255,255,255,"+(0.8*(1-p)).toFixed(2)+")"; ctx.fillRect(fx-2+Math.sin(p*7+i)*6, fy-4-p*14, 3, 3); }
  }
  if (tier>=3){
    const sx=30.5*TILE, sy=13*TILE;
    ctx.fillStyle="#cfc5b0"; ctx.fillRect(sx-10, sy+6, 20, 8);
    ctx.fillStyle="#e8c14e"; ctx.fillRect(sx-6, sy-14, 12, 20); ctx.fillRect(sx-9, sy-8, 3, 8); ctx.fillRect(sx+6, sy-8, 3, 8);
    ctx.fillStyle="#c9a02e"; ctx.fillRect(sx-4, sy-20, 8, 6);
    if (Math.floor(t*2)%2) drawEmojiC(ctx,"✨", sx+10, sy-18, 9);
  }
  if (S.upgrades.fleet1 && !S.upgrades.fleet2){
    const vx=22.2*TILE, vy=3.4*TILE;
    ctx.fillStyle="#e8e2d2"; ctx.fillRect(vx, vy, 30, 14);
    ctx.fillStyle="#6fb7d9"; ctx.fillRect(vx+20, vy+2, 8, 6);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(vx+7,vy+15,4,0,7); ctx.arc(vx+24,vy+15,4,0,7); ctx.fill();
  }
  if (S.upgrades.fleet2){
    const lx = ((t*46)%((VCOLS+4)*TILE))-2*TILE, ly=10*TILE+3;
    ctx.fillStyle="#4e7d5b"; ctx.fillRect(lx, ly, 40, 15);
    ctx.fillStyle="#e8e2d2"; ctx.fillRect(lx+40, ly+3, 14, 12);
    ctx.fillStyle="#6fb7d9"; ctx.fillRect(lx+46, ly+5, 6, 5);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(lx+9,ly+16,4,0,7); ctx.arc(lx+31,ly+16,4,0,7); ctx.arc(lx+48,ly+16,4,0,7); ctx.fill();
  }
  if (S.upgrades.fleet3){
    ctx.fillStyle="#5a4a3a"; ctx.fillRect(0, 1*TILE+12, VCOLS*TILE, 4);
    ctx.fillStyle="#3d332a"; for(let x=0;x<VCOLS*TILE;x+=12) ctx.fillRect(x, 1*TILE+10, 4, 8);
    const trx = (t*70)%((VCOLS+8)*TILE)-4*TILE;
    ctx.fillStyle="#b0574f"; ctx.fillRect(trx, 1*TILE, 34, 14);
    ctx.fillStyle="#6fb7d9"; ctx.fillRect(trx+4, 1*TILE+3, 8, 6); ctx.fillRect(trx+16, 1*TILE+3, 8, 6);
    ctx.fillStyle="#8a5a3c"; ctx.fillRect(trx+36, 1*TILE+2, 26, 12); ctx.fillRect(trx+64, 1*TILE+2, 26, 12);
    ctx.fillStyle="rgba(200,200,210,.5)"; ctx.beginPath(); ctx.arc(trx-4, 1*TILE-4, 5, 0, 7); ctx.fill();
  }
  const stock = Object.values(S.items).reduce((a,b)=>a+b,0);
  const crates = Math.min(6, Math.floor(stock/40));
  for (let i=0;i<crates;i++){
    const cx=22.1*TILE+(i%2)*11, cy=4.2*TILE-Math.floor(i/2)*10;
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
}
function drawWorkerAndVfx(ctx, t){
  let playerTool = null;
  if (S.action && SKILL_TOOL[S.action.skill]){
    const p = stationPos(S.action.skill, S.action.id);
    if (p){
      const near = Math.hypot(VP.x-p.x, VP.y-p.y) < 64;
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
        if (S.action.skill==="fishing"){
          // rod casting line to water
          ctx.save();
          ctx.strokeStyle="rgba(180,200,255,.55)"; ctx.lineWidth=1;
          const rodTip = { x: VP.x + VP.facing*10, y: VP.y - 18 };
          const waterX = p.x + VP.facing*18, waterY = p.y + 8;
          ctx.beginPath(); ctx.moveTo(rodTip.x, rodTip.y); ctx.quadraticCurveTo((rodTip.x+waterX)/2, rodTip.y-20, waterX, waterY); ctx.stroke();
          ctx.fillStyle="rgba(100,180,255,.7)"; ctx.beginPath(); ctx.arc(waterX, waterY, 3+Math.sin(t*4)*1.2, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        }
      } else {
        drawPerson(ctx, p.x, p.y, plHair(), plShirt(), t, false, -1, SKILL_TOOL[S.action.skill], null, plSkin(), plTrousers(), toolTierColor());
      }
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
  ctx.fillStyle="#7cbf86"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.save();
  ctx.translate(-Math.round(CAM.x), -Math.round(CAM.y));
  drawTiles(ctx, t);
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
  if (VP.tx!==null && VP.tx!==undefined){
    ctx.strokeStyle="rgba(255,248,230,.8)"; ctx.lineWidth=2;
    const rad = 6+Math.sin(t*8)*2;
    ctx.beginPath(); ctx.arc(VP.tx, VP.ty, rad, 0, 7); ctx.stroke();
  }
  drawPerson(ctx, VP.x, VP.y, plHair(), plShirt(), t, VP.moving, VP.facing, playerTool, playerTool ? (VP.facing>=0?"right":"left") : VP.dir, plSkin(), plTrousers(), playerTool ? toolTierColor() : null);
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
        html += `<div class="vlbl" style="left:${nlx.toFixed(1)}%;top:${nly.toFixed(1)}%">👤 ${v.n}</div>`;
      }
    }
    const dockV = VILLAGER_STATE.find(v => !v.indoor && v.phase !== "sleep" && Math.hypot(VP.x-v.x, VP.y-v.y) < TILE);
    if (dockV){
      const q = dockV.quips[dockV.quipIdx % dockV.quips.length];
      html += `<div class="speech-dock">${dockV.n}: "${q}"</div>`;
    }
    overlay.innerHTML = html;
  }
  // night/sunrise/sunset sky tint
  const alpha = nightAlpha();
  if (alpha > 0.01){
    ctx.fillStyle = `rgba(${skyTint()},${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
    ctx.restore();
  }
  drawMinimap(ctx);
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
    // 4 support beams (between station x-positions: stations at x≈45,128,211)
    [12,78,160,248].forEach(bx=>{
      ctx.fillStyle="#5a3a1e"; ctx.fillRect(bx,8,7,H-20);
      ctx.fillStyle="#7a5534"; ctx.fillRect(bx,8,7,5); ctx.fillRect(bx,H*.44,7,4);
      ctx.fillStyle="#6a4828"; for(const by of[H*.26,H*.52]) ctx.fillRect(bx-4,by,15,3);
    });
    // minecart body + wheels
    ctx.fillStyle="#4a3428"; ctx.fillRect(W*.36,H*.75,W*.19,H*.14);
    ctx.fillStyle="#231810"; ctx.fillRect(W*.38,H*.79,W*.15,H*.08);
    ctx.fillStyle="#1e1a18"; ctx.beginPath(); ctx.arc(W*.41,H*.9,5,0,7); ctx.arc(W*.52,H*.9,5,0,7); ctx.fill();
    drawEmojiC(ctx,"⛏️",W*.47,H*.76,9);
    // coal pile (left)
    ctx.fillStyle="#1e1814"; ctx.fillRect(4,H*.74,W*.09,H*.26); ctx.fillRect(5,H*.69,W*.07,H*.07); ctx.fillRect(6,H*.64,W*.04,H*.07);
    // crates (right of coal station)
    [[W*.72,H*.79],[W*.80,H*.79]].forEach(([x,y],i)=>{
      const cw=W*.07,ch=H*.12,c=i?"#7a5a38":"#8c6947";
      ctx.fillStyle=c; ctx.fillRect(x,y,cw,ch); ctx.strokeStyle="#5a3a20"; ctx.lineWidth=1;
      ctx.strokeRect(x,y,cw,ch); ctx.fillStyle="#5a3a20"; ctx.fillRect(x+cw*.5-1,y,2,ch); ctx.fillRect(x,y+ch*.5-1,cw,2);
    });
    // hanging lanterns above each station
    for(const fx of[0.14,0.40,0.66]){
      ctx.fillStyle="rgba(255,200,80,0.18)"; ctx.beginPath(); ctx.arc(W*fx,H*.12,W*.055,0,7); ctx.fill();
      drawEmojiC(ctx,"🏮",W*fx,H*.14,10);
    }
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
    // anvil (below steel_bar station at x=205, y=88 — anvil at y=112 so player passes above it)
    ctx.fillStyle="#808898"; ctx.fillRect(201,106,26,6); ctx.fillStyle="#6a7080"; ctx.fillRect(198,112,32,8);
    ctx.fillStyle="#5a6070"; ctx.fillRect(203,120,6,7); ctx.fillRect(218,120,6,7);
    drawEmojiC(ctx,"🔨",213,104,10);
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
  } else if (S.tab==="fishing"){
    // pier over sea — 320×200 canvas
    ctx.fillStyle="#4da8cc"; ctx.fillRect(0,0,W,H);
    // water shimmer
    for(let wy=4;wy<H*.50;wy+=16){
      ctx.fillStyle="rgba(255,255,255,0.22)";
      if((Math.floor(wy/16)+Math.floor(t*2))%3===0) ctx.fillRect(6+(wy*13)%38,wy,W*.16,2);
      if((Math.floor(wy/16)+Math.floor(t*1.4)+2)%4===0) ctx.fillRect(W*.55+(wy*7)%32,wy+4,W*.12,2);
    }
    // fish silhouettes drifting below surface
    for(let i=0;i<5;i++){
      const fx=(t*0.9+i*62)%(W+80)-40, fy=H*.15+Math.sin(t+i*1.3)*H*.09;
      ctx.fillStyle="rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.ellipse(fx, fy, 14, 5, Math.sin(t*0.4+i)*0.2, 0, 7); ctx.fill();
    }
    // pier deck planks
    ctx.fillStyle="#8c6947"; ctx.fillRect(0,H*.50,W,H*.50);
    for(let px=0;px<W;px+=13){ ctx.fillStyle="#7a5a38"; ctx.fillRect(px,H*.50,2,H*.50); }
    for(let py=0;py<H*.50;py+=10){ ctx.fillStyle="#6a4a28"; ctx.fillRect(0,H*.50+py,W,2); }
    // pier railing
    ctx.fillStyle="#5a3a20"; ctx.fillRect(0,H*.44,W,5);
    for(let rx=0;rx<W;rx+=32){ ctx.fillStyle="#6a4a28"; ctx.fillRect(rx,H*.44-2,5,18); }
    // rod + bobber for each station
    STATION_DEFS.fishing.forEach(st=>{
      const sx=st.fx*W;
      const bx=sx+Math.sin(t*1.8+st.fx*5)*9, by=H*.20+Math.sin(t*1.3+st.fx*4)*8;
      ctx.strokeStyle="#5a3a1e"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(sx, H*.44); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle="#dd4444"; ctx.beginPath(); ctx.arc(bx, by, 4, 0, 7); ctx.fill();
      ctx.fillStyle="#fff8e6"; ctx.beginPath(); ctx.arc(bx, by, 4, Math.PI, 0); ctx.fill();
      if(Math.sin(t*4.1+st.fx*11)>0.90){ ctx.fillStyle="rgba(255,255,255,.7)"; ctx.fillRect(bx-6,by+4,12,2); }
    });
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
      drawEmojiC(ctx, p.ic, px, py+Math.sin(t*5+i)*2, 18);
      if (S.pets.active===id) drawEmojiC(ctx,"⭐", px+10, py-12, 9);
    });
  } else if (S.tab==="woodcutting"){
    room("#465a36","#5c7044","#b08c58","#a68050","#3a4a28");
    ctx.fillStyle="#6a5240"; ctx.fillRect(36,86,64,8); ctx.fillStyle="#7c6450"; ctx.fillRect(36,76,64,12);
    ctx.fillStyle="#a8b0b8"; ctx.beginPath(); ctx.arc(68,76,9,0,7); ctx.fill();
    ctx.fillStyle="#7a828a"; for(let a=0;a<8;a++){ const ang=a/8*6.283 + t*3; ctx.fillRect(68+Math.cos(ang)*9-1, 76+Math.sin(ang)*9-1, 3,3); }
    for(const [lx,ly] of [[248,146],[268,146],[258,136]]){ ctx.fillStyle="#8a5a30"; ctx.fillRect(lx,ly,22,10); ctx.fillStyle="#c9955a"; ctx.beginPath(); ctx.arc(lx+22,ly+5,5,0,7); ctx.fill(); ctx.fillStyle="#8a5a30"; ctx.beginPath(); ctx.arc(lx+22,ly+5,3,0,7); ctx.fill(); }
    ctx.fillStyle="#c9a05a"; ctx.fillRect(14,150,44,5); ctx.fillRect(18,144,44,5);
    ctx.fillStyle="rgba(222,196,140,.5)"; for(const [dx,dy] of [[60,104],[84,110],[110,150]]){ ctx.beginPath(); ctx.ellipse(dx,dy,9,3,0,0,7); ctx.fill(); }
    drawEmojiC(ctx,"🪚", 90, 70, 10);
    // goods shelf — cut timber and wooden wares for sale
    ctx.fillStyle="#5a4228"; ctx.fillRect(196,12,110,32);
    ctx.fillStyle="#6e5234"; for(const sy of [22,36]) ctx.fillRect(198,sy,106,4);
    ctx.fillStyle="#c9a05a"; ctx.fillRect(202,15,26,4); ctx.fillRect(204,20,26,4);
    ctx.fillStyle="#a87c42"; ctx.fillRect(236,15,20,8);
    drawEmojiC(ctx,"🪑", 270, 18, 11); drawEmojiC(ctx,"🧺", 292, 18, 10);
    ctx.fillStyle="#c9a05a"; ctx.fillRect(202,28,30,4); ctx.fillRect(240,28,26,4);
    drawEmojiC(ctx,"🥣", 284, 31, 9);
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
    // variant 0-4 based on which home was entered
    const _hNum = parseInt((S.roomObjId||"home_01").replace(/\D/g,""))||1;
    const _hv = (_hNum-1) % 5;
    const _wallPals = [
      ["#5a7a4a","#6a8a5a","#d4c4a0","#c8b890"],  // sage green walls
      ["#6a5a7a","#7a6a8a","#d0c8e0","#c4b8d8"],  // lavender
      ["#7a5a4a","#8a6a5a","#e0d0b8","#d4c4a8"],  // warm terracotta
      ["#4a6a7a","#5a7a8a","#c8d8e0","#b8c8d0"],  // slate blue
      ["#7a6a4a","#8a7a5a","#e0d4b0","#d4c8a0"],  // harvest gold
    ];
    const _rugPals = ["rgba(180,80,60,.35)","rgba(100,60,160,.3)","rgba(180,100,40,.35)","rgba(40,100,160,.3)","rgba(140,120,40,.3)"];
    const _rugBorder = ["rgba(200,160,60,.5)","rgba(160,120,200,.5)","rgba(200,140,60,.5)","rgba(60,140,200,.5)","rgba(200,180,60,.5)"];
    const [wt,wc,fa,fb] = _wallPals[_hv];
    room(wt,wc,fa,fb,"#4a3020");
    winP(W*0.12, 38); winP(W*0.62, 38);
    // shared: bed (position varies)
    const _bx = _hv < 3 ? W-58 : 10;
    ctx.fillStyle="#8c6040"; ctx.fillRect(_bx,60,50,60);
    ctx.fillStyle="#c09060"; ctx.fillRect(_bx+2,62,46,18);
    ctx.fillStyle=["#e8c8a0","#d8b8e8","#e8c8a0","#b8d8e8","#e0d8a0"][_hv]; ctx.fillRect(_bx+6,66,38,10);
    ctx.fillStyle=["#f0dfc0","#e8d8f8","#f0dfc0","#d8eef8","#f0e8c0"][_hv]; ctx.fillRect(_bx+4,82,42,34);
    // rug
    ctx.fillStyle=_rugPals[_hv]; ctx.fillRect(W/2-44,H-64,88,52);
    ctx.strokeStyle=_rugBorder[_hv]; ctx.lineWidth=2; ctx.strokeRect(W/2-40,H-60,80,44);
    // variant-specific furniture
    if (_hv===0){
      // fireplace left, table centre
      ctx.fillStyle="#4a3020"; ctx.fillRect(8,46,28,H-60); ctx.fillStyle="#c94a1a"; ctx.fillRect(14,H-40,8,10); ctx.fillStyle="#ffd666"; ctx.fillRect(17,H-44,4,6);
      ctx.fillStyle="#8c6040"; ctx.fillRect(W/2-18,H-50,36,24); ctx.fillRect(W/2-18,H-26,4,22); ctx.fillRect(W/2+14,H-26,4,22);
      ctx.fillStyle="#f0e8d8"; ctx.fillRect(W/2-5,H-52,10,6); // tea
    } else if (_hv===1){
      // bookshelf left + armchair + pot plant right
      ctx.fillStyle="#5a3a20"; ctx.fillRect(10,50,22,H-65);
      for(let bi=0;bi<6;bi++){ ctx.fillStyle=["#c94a3a","#4a6ec9","#4ac96a","#c9c94a","#9a4ac9","#c9804a"][bi]; ctx.fillRect(12,52+bi*14,18,12); }
      // armchair
      ctx.fillStyle="#7a5a80"; ctx.fillRect(W-55,H-55,40,30); ctx.fillRect(W-58,H-60,8,34); ctx.fillRect(W-18,H-60,8,34);
      // pot plant
      ctx.fillStyle="#6a4a20"; ctx.fillRect(W/2+30,H-44,12,18);
      ctx.fillStyle="#3a8a3a"; ctx.beginPath(); ctx.arc(W/2+36,H-48,10,0,7); ctx.fill();
    } else if (_hv===2){
      // TV set + sofa
      ctx.fillStyle="#2a2a2a"; ctx.fillRect(W/2-28,52,56,36); ctx.fillStyle="#1a1aff"; ctx.fillRect(W/2-24,55,48,28);
      ctx.fillStyle="#3a2a14"; ctx.fillRect(W/2-4,88,8,12);
      // sofa (dark orange)
      ctx.fillStyle="#c97040"; ctx.fillRect(W/2-40,H-52,80,28); ctx.fillRect(W/2-44,H-60,12,34); ctx.fillRect(W/2+32,H-60,12,34);
    } else if (_hv===3){
      // desk left + bookshelf right
      ctx.fillStyle="#6a4a30"; ctx.fillRect(10,55,32,18); ctx.fillRect(14,73,4,H-80); ctx.fillRect(34,73,4,H-80);
      ctx.fillStyle="#5a8090"; ctx.fillRect(10,57,30,12); // writing pad
      // bookshelf right
      ctx.fillStyle="#5a3a20"; ctx.fillRect(W-32,50,22,H-65);
      for(let bi=0;bi<5;bi++){ ctx.fillStyle=["#4a8ec9","#c94a4a","#4ac96a","#c9904a","#6a4ac9"][bi]; ctx.fillRect(W-30,52+bi*16,18,13); }
    } else {
      // two armchairs facing each other + round table + wall art
      ctx.fillStyle="#8c7040"; ctx.fillRect(W/2-52,H-55,28,30); ctx.fillRect(W/2-56,H-62,8,36); ctx.fillRect(W/2-28,H-62,8,36);
      ctx.fillStyle="#8c7040"; ctx.fillRect(W/2+24,H-55,28,30); ctx.fillRect(W/2+20,H-62,8,36); ctx.fillRect(W/2+48,H-62,8,36);
      // round table
      ctx.fillStyle="#a07850"; ctx.beginPath(); ctx.arc(W/2,H-42,14,0,7); ctx.fill();
      // wall art frame
      ctx.fillStyle="#6a4a20"; ctx.fillRect(W/2-20,58,40,32); ctx.fillStyle="#a0c8e0"; ctx.fillRect(W/2-17,61,34,25);
      // hanging plant
      ctx.fillStyle="#5a3a10"; ctx.fillRect(W-30,47,4,20);
      ctx.fillStyle="#3a8a2a"; for(let pi=0;pi<4;pi++) { ctx.beginPath(); ctx.arc(W-28+Math.sin(pi*2)*8, 68+pi*6, 5, 0, 7); ctx.fill(); }
    }
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
  // player drawn last so they render above furniture
  const _iTool = SKILL_TOOL[active] || null;
  drawPerson(ctx, IP.x, IP.y, plHair(), plShirt(), t, IP.moving, IP.facing, _iTool, IP.dir, plSkin(), plTrousers(), _iTool ? toolTierColor() : null);
  // crisp HTML overlays: name tags + chat panel
  const _iOverlay = document.getElementById("interior-overlay");
  if (_iOverlay){
    let _iHtml = "";
    _tabWorkers.forEach(v => {
      const dist = Math.hypot(IP.x-v.iwx, IP.y-v.iwy);
      if (dist < 28){
        const px = v.iwx/W*100, py = (v.iwy-30)/H*100;
        _iHtml += `<div class="int-vlbl" style="left:${px.toFixed(1)}%;top:${py.toFixed(1)}%">${v.n}</div>`;
      }
    });
    if (CHAT_NPC){
      const q = CHAT_NPC.quips[CHAT_NPC.quipIdx % CHAT_NPC.quips.length];
      _iHtml += `<div class="int-chat"><span class="int-chat-name">${CHAT_NPC.n}:</span><span class="int-chat-txt"> ${q}</span><span class="int-chat-dim"> · tap to dismiss</span></div>`;
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
}
function villageFrame(ts){
  updateClock();
  const t = ts/1000;
  const dt = Math.min(0.05, vLastT ? t-vLastT : 0.016);
  vLastT = t;
  const tl = document.getElementById("title");
  if (tl && tl.style.display !== "none"){
    drawTitleFX(t);
  } else if (S.tab==="village"){
    moveActor(VP, dt, 104);
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
    moveActor(IP, dt, 80, true);
    // push IP out of interior prop collision rects
    const iCols = INTERIOR_COLS[S.tab];
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
    if (IP.y > icanvasH() - 18) {
      IP.tx = null; IP.ty = null; IP.moving = false;
      CHAT_NPC = null;
      VP.enterCooldown = 90; // prevent stepping straight back in
      S.tab = "village"; renderNav(); renderMain();
    } else {
      drawInterior(t);
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

function showTitle(){
  const t = document.getElementById("title");
  t.style.display = "flex";
  document.getElementById("frost-avatar-title").innerHTML = frostSvg(72);
  const input = document.getElementById("name-input");
  document.getElementById("btn-preview").onclick = () => { MUSIC.unlocked = true; MUSIC.play("valley"); };
  document.getElementById("btn-start").onclick = () => {
    let n = input.value.trim().replace(/[<>"'&]/g, "").slice(0, 16);
    S.playerName = n || "Founder";
    const badge = document.getElementById("name-badge");
    const badgeVal = document.getElementById("badge-name-val");
    if (badge && badgeVal){
      badgeVal.textContent = S.playerName.toUpperCase();
      badge.classList.add("show");
    }
    setTimeout(()=>{
      t.style.display = "none";
      MUSIC.unlocked = true;
      updateMusicZone();
      const stat = document.getElementById("hud-name-stat");
      if (stat){ stat.classList.add("named","named-anim"); setTimeout(()=>stat.classList.remove("named-anim"),500); }
      log(`❄️ Frost: "Welcome aboard, <b>${pName()}</b>! Follow my lead and you'll run this valley by teatime."`, "good");
      updateHud(); renderMain(); save();
    }, 1100);
  };
  input.onkeydown = e => { if (e.key === "Enter") document.getElementById("btn-start").click(); };
  const box = t.querySelector(".box");
  t.onmousemove = (e) => {
    const r = t.getBoundingClientRect();
    const dx = (e.clientX-(r.left+r.width/2))/r.width;
    const dy = (e.clientY-(r.top+r.height/2))/r.height;
    box.style.transform = `translate(${(dx*10).toFixed(1)}px,${(dy*6).toFixed(1)}px)`;
  };
  t.onmouseleave = () => { box.style.transform = ""; };
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
  .int-canvas-wrap .ilbl-exit{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);background:rgba(176,87,79,.92);color:#fff8e6;font:600 10px 'IBM Plex Mono',monospace;padding:1px 7px;border-radius:4px;pointer-events:none}
  .vhint{text-align:center}
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
  const str = `${isNight()?"🌙":"☀️"} ${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
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
    v:1, coins:0, items:{}, lastSeen:Date.now(), market:null,
    playerName:"", settings:{ music:true, vol:"med" }, prod:{}, tut:{ step:0, done:false }, ach:{},
    skills:{ mining:{xp:0}, steelworks:{xp:0}, manufacturing:{xp:0}, logistics:{xp:0}, trading:{xp:0}, woodcutting:{xp:0}, fishing:{xp:0} },
    upgrades:{}, pets:{ owned:[], active:null },
    counters:{ actions:0, contracts:0, coinsEarned:0, trades:0 },
    action:null,
    contracts:[],
    tab:"village",
    appearance: Object.assign({}, DEFAULT_APPEARANCE),
  };
}
let S = freshState();

function storageOK(){ try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; } catch(e){ return false; } }
const HAS_LS = storageOK();
function save(){ S.lastSeen = Date.now(); if (HAS_LS) { try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} } }
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
  return m;
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
      if (b.vy<0 && b.y >= 17.1*TILE){
        if (Math.hypot(VP.x-b.x, VP.y-b.y)>3*TILE){ b.vy=0; b.vx=0; b.state="sit"; b.y=17.1*TILE+Math.random()*0.7*TILE; }
        else { b.vy=-2; }
      }
      // flew into sea or off map — respawn on a far sand spot
      if (b.y > 20*TILE || b.x < -TILE || b.x > (VCOLS+1)*TILE){
        let nx=0,ny=0,tr=0;
        do{ nx=(3+Math.floor(Math.random()*42))*TILE; ny=(17.1+Math.random()*0.8)*TILE; tr++; }
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
      do{ nx=(3+Math.floor(Math.random()*42))*TILE; tr++; } while(Math.hypot(VP.x-nx,VP.y-17*TILE)<6*TILE && tr<20);
      b.x=nx; b.y=13*TILE; b.vx=(Math.random()-0.5)*1.5; b.vy=-2; b.state="fly";
    }
  }
}
function gameHour(){ const h = S.clock ? S.clock.h : 9; const m = S.clock ? S.clock.m : 0; return h + m/60; }
function _villagerTileOk(x, y){
  const t = tileAt(x, y);
  return t !== "W" && t !== "T" && t !== "C";
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
  const turtleActive = S.pets.active === "cargo_turtle";
  if (turtleActive && SKILLS.steelworks.actions.some(a => a===act)) return Math.max(1, q-1);
  return q;
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
  const before = skillLvl(skill);
  S.skills[skill].xp += xp;
  const after = skillLvl(skill);
  if (after > before){
    toast(`${SKILLS[skill].ic} ${SKILLS[skill].n} LEVEL ${after}!`);
    log(`${SKILLS[skill].n} reached level <b>${after}</b>.`, "good");
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
  for (const [id,q] of Object.entries(act.out)){ addItem(id, q); S.prod[id] = (S.prod[id]||0) + q; }
  grantXp(skill, act.xp);
  S.counters.actions++;
  rollPet(skill);
  if (!silent && typeof pushVfx === "function") pushVfx(skill, act);
  if (!silent && typeof SFX !== "undefined") SFX.play(skill);
  tutCheck();
  achCheck();
  if (!silent){
    const outName = Object.keys(act.out).map(id=>ITEMS[id].n).join(", ");
    log(`${SKILLS[skill].ic} ${act.n} → +${outName}`);
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

function applyOffline(){
  const elapsed = Math.min(Date.now() - (S.lastSeen || Date.now()), OFFLINE_CAP_MS);
  if (elapsed < 5000 || !S.action) return;
  const act = findAction(S.action.skill, S.action.id);
  if (!act) { S.action = null; return; }
  const dur = act.ms * speedMult(S.action.skill);
  let possible = Math.floor(elapsed / dur);
  let done = 0;
  while (possible > 0){
    if (!completeAction(act, S.action.skill, true)) { S.action = null; break; }
    done++; possible--;
  }
  if (done > 0){
    const hrs = (elapsed/3600000);
    const dur_str = hrs >= 1 ? hrs.toFixed(1)+"h" : Math.round(elapsed/60000)+"m";
    toast(`🌙 NIGHT SHIFT: ${done}× ${act.n} while you were away (${dur_str}).`);
    log(`🌙 Night shift report: <b>${done}×</b> ${act.n} completed while away.`, "good");
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
function renderNav(){
  const nav = $("#nav"); nav.innerHTML = "";
  TABS.forEach(t => {
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
function renderSkillPanel(skill){
  const sk = SKILLS[skill];
  const lvl = skillLvl(skill);
  let html = `<div class="panel"><h2>${sk.ic} ${sk.n}<small>${sk.desc}</small></h2>${xpBarHtml(skill)}<div class="actions">`;
  sk.actions.forEach(act => {
    const locked = lvl < act.lvl;
    const running = S.action && S.action.skill===skill && S.action.id===act.id;
    const dur = (act.ms * speedMult(skill) / 1000).toFixed(1);
    html += `<button class="action ${running?'running':''}" data-skill="${skill}" data-act="${act.id}" ${locked?'disabled':''}>
      <div class="nm"><span class="ic">${ITEMS[Object.keys(act.out)[0]].ic}</span>${act.n}</div>
      <div class="meta">${locked ? `Requires level ${act.lvl}` : `${dur}s · ${act.xp} XP`}</div>
      <div class="io">${ioHtml(act)}</div>
      ${running ? `<div class="prog"><div class="fill" id="prog-${act.id}"></div></div><span class="stopbtn" data-stop="1">STOP</span>` : ""}
    </button>`;
  });
  html += `</div></div>`;
  html += renderInventoryPanel();
  return html;
}
function renderInventoryPanel(){
  const entries = Object.entries(S.items).filter(([,q])=>q>0);
  let html = `<div class="panel"><h2>📦 Warehouse</h2><div class="inv">`;
  if (!entries.length) html += `<span style="color:var(--dim);font-size:12px;">Empty. The auditors would approve. Go mine something.</span>`;
  entries.forEach(([id,q])=>{ html += `<span class="chip">${ITEMS[id].ic} ${ITEMS[id].n} <b>${fmt(q)}</b></span>`; });
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
function renderTrade(){
  ensureMarket();
  const tLvl = skillLvl("trading");
  let html = `<div class="panel"><h2>⚖️ Traders<small>Prices drift every few minutes — buy low, sell high. Better prices as Trading levels up (current bonus: ${(tradeBonus()*100).toFixed(1)}%).</small></h2>${xpBarHtml("trading")}</div>`;
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
function renderPets(){
  let html = `<div class="panel"><h2>🦊 Logistics Companions<small>Rare colleagues found through honest work. One active at a time.</small></h2>`;
  PETS.forEach(p=>{
    const owned = S.pets.owned.includes(p.id);
    const active = S.pets.active === p.id;
    html += `<div class="card ${owned?'owned':''} ${active?'activepet':''}">
      <span class="ic">${owned?p.ic:"❓"}</span>
      <div class="body">
        <div class="nm">${owned?p.n:"???"} <span class="rar-${p.rar}">[${p.rar}]</span></div>
        <div class="ds">${owned ? p.ds : "Found via "+(p.src==="contract"?"delivering contracts":p.src+" actions")+"."}</div>
      </div>
      ${owned ? (active ? `<span style="color:var(--amber);font-size:11px;">ON SHIFT</span>`
                        : `<button class="btn" data-pet="${p.id}">Put on shift</button>`) : ""}
    </div>`;
  });
  html += `</div>`;
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
  </div>`;
}
function drawCharPreview(canvasId){
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle="#9fd6a8"; ctx.fillRect(0, 0, cv.width, cv.height);
  const big = canvasId === "char-preview";
  const sc = big ? 3 : 1;
  ctx.save();
  ctx.translate(cv.width/2, cv.height - (big ? 20 : 12));
  ctx.scale(sc, sc);
  drawPerson(ctx, 0, 0, plHair(), plShirt(), 0, false, 1, null, "down", plSkin(), plTrousers());
  ctx.restore();
}
function renderCharacterCustomisation(){
  const ap = S.appearance || DEFAULT_APPEARANCE;
  function swatchRow(label, arr, field){
    return `<div class="cust-row"><div class="cust-lbl">${label}</div><div class="cust-swatches">${
      arr.map(c=>`<button class="swatch${ap[field]===c.v?' sel':''}" data-cust="${field}" data-val="${c.v}" style="background:${c.v};" title="${c.label}" aria-label="${c.label}"></button>`).join('')
    }</div></div>`;
  }
  return `<div class="panel cust-panel">
    <h2>👤 Character<small>Customise your look. Saved automatically.</small></h2>
    <div class="cust-preview-wrap">
      <canvas id="char-preview" width="120" height="140" style="image-rendering:pixelated;display:block;border:2px solid var(--edge);background:#9fd6a8;"></canvas>
      <div class="cust-name">${S.playerName || "Founder"}</div>
    </div>
    ${swatchRow("Skin Tone", SKIN_TONES, "skin")}
    ${swatchRow("Hair", HAIR_COLOURS, "hair")}
    ${swatchRow("Shirt", SHIRT_COLOURS, "shirt")}
    ${swatchRow("Trousers", TROUSER_COLOURS, "trousers")}
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
    ${lbls}${depotLbl}<div class="ilbl-room">${title.split("·")[0].split("—")[0].trim()}</div><div class="ilbl-exit">🚪 EXIT ↓</div>
    <div id="zone-card-canvas" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(30,22,14,.92);border:2px solid #ffd666;color:#ffd666;font:700 13px/1.5 'IBM Plex Mono',monospace;padding:8px 20px;border-radius:5px;text-align:center;pointer-events:none;white-space:nowrap;z-index:10;transition:opacity .5s"></div>
    <div id="interior-overlay" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;"></div>
  </div>
  <div class="vhint">${title} · WASD/tap · walk south to exit</div></div>`;
}
function renderAch(){
  if (!S.ach) S.ach = {};
  const got = ACH.filter(a=>S.ach[a.id]).length;
  let html = `<div class="panel"><h2>🏆 Trophy Room<small>${got} / ${ACH.length} awards earned. Each one pays a coin bonus.</small></h2>`;
  ACH.forEach(a=>{
    const own = !!S.ach[a.id];
    html += `<div class="card ${own?'owned':'locked'}">
      <span class="ic">${own?a.ic:"🔒"}</span>
      <div class="body"><div class="nm">${own?a.n:"???"}</div><div class="ds">${a.ds}</div></div>
      <span style="font-size:11px;color:${own?'var(--mint)':'var(--dim)'};">${own?"EARNED ✔":"+"+fmt(a.r)+" coins"}</span>
    </div>`;
  });
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
      <div class="village-sidebar">${renderInventoryPanel()}</div>
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
    else if (S.tab==="home") m.innerHTML = _withRoom("🏠 A Villager's Cottage", `<p style="color:var(--dim);font-size:12px;margin:8px 0">A cosy home. Someone lives here.</p>`);
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
  document.querySelectorAll("[data-pet]").forEach(b=> b.onclick = ()=>{
    S.pets.active = b.dataset.pet; renderMain(); updateHud(); save();
  });
  document.querySelectorAll("[data-cust]").forEach(b=> b.onclick = ()=>{
    if (!S.appearance) S.appearance = Object.assign({}, DEFAULT_APPEARANCE);
    S.appearance[b.dataset.cust] = b.dataset.val;
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
}

function updateHud(){
  $("#hud-coins").textContent = fmt(S.coins);
  $("#hud-total").textContent = totalLvl();
  const nameEl = document.getElementById("hud-name");
  if (nameEl) nameEl.textContent = S.playerName || "—";
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
  const timeEl = document.getElementById("hud-time");
  if (timeEl) timeEl.textContent = isNight() ? "🌙 Night" : "☀️ Day";
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
ensureMarket(); rollMarket(false);
fillContracts();
if (!TABS.some(t=>t.id===S.tab)) S.tab = "village";
preloadAll();
renderNav(); renderMain(); updateHud(); syncMusicButton();
document.getElementById("btn-music").onclick = () => cycleVolume();
window.addEventListener("keydown", e => {
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
if (!hadSave){
  log("Mine Iron Ore, smelt it in the Steelworks, press Brackets, then deliver Contracts — or haggle with Marge in the Trade tab.");
}

let lastTick = Date.now();
setInterval(()=>{
  const now = Date.now();
  const dt = now - lastTick; lastTick = now;
  const beforeItems = JSON.stringify(S.items);
  tick(dt);
  updateProgressBar();
  if (rollMarket(false) && S.tab === "trade") renderMain();
  if (JSON.stringify(S.items) !== beforeItems && (S.tab in SKILLS || S.tab==="contracts")) {
    renderMain(); updateHud();
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
