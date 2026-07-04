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
  return "valley";
}
const MUSIC = (() => {
  let ctx = null, timer = null, master = null, cur = null, loopStart = 0, noiseBuf = null;
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
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur*beat*0.9);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur*beat);
  }
  function thump(t, vel){
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = noiseBuf;
    g.gain.setValueAtTime(vel*0.12, t);
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
        master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.35);
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
    start(){ this.unlocked = true; this.play(zoneForTab(S.tab)); },
  };
})();
function updateMusicZone(){
  if (MUSIC.unlocked && S.settings && S.settings.music) MUSIC.play(zoneForTab(S.tab));
}
function syncMusicButton(){
  const b = document.getElementById("btn-music");
  if (b) b.textContent = (S.settings && S.settings.music) ? "🔊" : "🔇";
}
function setMusic(on){
  S.settings.music = on;
  if (on){ MUSIC.unlocked = true; updateMusicZone(); } else MUSIC.stop();
  syncMusicButton(); save();
}

/* ================= VILLAGE WORLD ================= */
const CAM = { x:0, y:0 };
const PL_HAIR = "#6a4a2f", PL_SHIRT = "#ff8a5c";

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
  { id:"frost", n:"Frost", hair:"#17161a", shirt:"#bfe8f7", x:16*TILE, y:9*TILE, tx:null, ty:null, wait:2, moving:false, facing:1, pending:null,
    area:[10,6,32,9], tips:FROST_TIPS, tee:"STAYFROSTY" },
  { id:"poppy", n:"Poppy", hair:"#b0574f", shirt:"#ffd666", x:5*TILE, y:14*TILE, tx:null, ty:null, wait:3, moving:false, facing:1, pending:null,
    area:[2,12,8,16], tips:[
      "Morning! My turnips go by lorry now. Fancy that.",
      "Frost says you're the new founder. Don't work too hard!",
      "The market stalls pay best on green-arrow days.",
    ]},
  { id:"sam", n:"Sam", hair:"#3a3a3a", shirt:"#4a6ea9", x:26*TILE, y:17.6*TILE, tx:null, ty:null, wait:3, moving:false, facing:1, pending:null,
    area:[12,17,32,18], tips:[
      "One day ships'll dock here. Port Salvo, they'll call it.",
      "See that boat? Doesn't leak much anymore.",
      "Heaviest thing I ever lifted? A Cargo Turtle. True story.",
    ]},
];
const VP = { x: 16*TILE, y: 6.5*TILE, tx: null, ty: null, pending: null, facing: 1, moving: false, dir:"down" };
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
  const t = tileAt(px, py);
  if (t==="T" || t==="W" || t==="C") return true;
  for (const o of V_OBJECTS){
    const r = objRect(o);
    if (px>=r.x && px<r.x+r.w && py>=r.y && py<r.y+r.h) return true;
  }
  return false;
}
function moveActor(a, dt, speed){
  let dx=0, dy=0;
  if (a===VP && (VKEYS.ArrowLeft||VKEYS.a)) dx-=1;
  if (a===VP && (VKEYS.ArrowRight||VKEYS.d)) dx+=1;
  if (a===VP && (VKEYS.ArrowUp||VKEYS.w)) dy-=1;
  if (a===VP && (VKEYS.ArrowDown||VKEYS.s)) dy+=1;
  if (dx||dy){ a.tx=null; a.ty=null; a.pending=null; }
  else if (a.tx!==null && a.tx!==undefined){
    const vx=a.tx-a.x, vy=a.ty-a.y, d=Math.hypot(vx,vy);
    if (d < 4){ a.tx=null; a.ty=null; }
    else { dx=vx/d; dy=vy/d; }
  }
  a.moving = !!(dx||dy);
  if (!a.moving) return;
  if (dx) a.facing = dx>0?1:-1;
  a.dir = Math.abs(dx) >= Math.abs(dy) ? (dx>0 ? "right" : "left") : (dy>0 ? "down" : "up");
  const st = speed*dt, half=6, feet=2;
  const nx = a.x + dx*st;
  if (!solidAt(nx-half, a.y+feet) && !solidAt(nx+half, a.y+feet)) a.x = nx;
  else if (!dy){ a.tx=null; a.ty=null; }
  const ny = a.y + dy*st;
  if (!solidAt(a.x-half, ny+feet) && !solidAt(a.x+half, ny+feet)) a.y = ny;
  else if (!dx){ a.tx=null; a.ty=null; }
}
function stationPos(skill, actId){
  if (skill==="mining"){
    const o = V_OBJECTS.find(x=>x.kind==="rock" && x.ore===actId);
    if (o){ const r=objRect(o); return { x:r.x+12, y:r.y+22 }; }
  }
  if (skill==="steelworks"){ const o=V_OBJECTS.find(x=>x.id==="furnace"); const a=objApproach(o); return {x:a.x, y:a.y}; }
  if (skill==="manufacturing"){ const o=V_OBJECTS.find(x=>x.id==="workshop"); const a=objApproach(o); return {x:a.x, y:a.y}; }
  return null;
}
const SKILL_TOOL = { mining:"⛏️", steelworks:"🔨", manufacturing:"🔧" };
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
  if (o.kind==="stall"){
    const locked = skillLvl("trading") < o.lvl;
    return `⚖️ ${o.name}'s Stall${locked ? " 🔒 Trading "+o.lvl : ""}`;
  }
  return `${o.ic||""} ${o.name}`;
}
function interactObj(o){
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
  S.tab = o.tab; renderNav(); renderMain();
}
function villageClick(e){
  const cv = document.getElementById("village");
  if (!cv) return;
  const rect = cv.getBoundingClientRect();
  const wx = (e.clientX-rect.left)*(cv.width/rect.width) + CAM.x;
  const wy = (e.clientY-rect.top)*(cv.height/rect.height) + CAM.y;
  for (const w of WANDERERS){
    if (Math.hypot(wx-w.x, wy-w.y) < 20){
      const o = { kind:"npc", w };
      if (Math.hypot(VP.x-w.x, VP.y-w.y) < 60) interactObj(o);
      else { VP.tx=w.x; VP.ty=w.y+18; VP.pending=o; }
      return;
    }
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
function drawPerson(ctx, x, y, hair, shirt, t, moving, facing, tool, dir){
  dir = dir || (facing>=0 ? "right" : "left");
  const bob = moving ? Math.sin(t*10)*1.5 : Math.sin(t*2)*0.6;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y+bob));
  ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 10-bob, 8, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle="rgba(40,28,16,.55)";
  ctx.fillRect(-8, -19, 16, 30);
  const legSwing = moving ? Math.sin(t*10)*3 : 0;
  ctx.fillStyle="#4a5a8a";
  ctx.fillRect(-5, 2, 4, 8+legSwing*0.4); ctx.fillRect(1, 2, 4, 8-legSwing*0.4);
  ctx.fillStyle=shirt; ctx.fillRect(-7, -6, 14, 10);
  ctx.fillStyle=shirt;
  const armSwing = moving ? Math.sin(t*10+3)*3 : 0;
  ctx.fillRect(-9, -5+armSwing*0.3, 3, 8); ctx.fillRect(6, -5-armSwing*0.3, 3, 8);
  ctx.fillStyle="#f2c49a"; ctx.fillRect(-9, 2+armSwing*0.3, 3, 3); ctx.fillRect(6, 2-armSwing*0.3, 3, 3);
  ctx.fillStyle="#f2c49a"; ctx.fillRect(-5, -16, 10, 10);
  if (dir==="up"){
    ctx.fillStyle=hair; ctx.fillRect(-6, -18, 12, 10);
  } else {
    ctx.fillStyle=hair; ctx.fillRect(-6, -18, 12, 5); ctx.fillRect(-6, -16, 2, 5); ctx.fillRect(4, -16, 2, 5);
    ctx.fillStyle="#17161a";
    if (dir==="down"){ ctx.fillRect(-3, -11, 2, 2); ctx.fillRect(2, -11, 2, 2); ctx.fillStyle="#c96f4a"; ctx.fillRect(-1, -8, 3, 1); }
    else { ctx.fillRect(facing>=0?0:-2, -11, 2, 2); ctx.fillRect(facing>=0?3:-5, -11, 2, 2); }
  }
  if (tool){
    const swing = Math.sin(t*11);
    ctx.save();
    ctx.translate(facing*9, -4);
    ctx.rotate(facing * (swing*0.9 - 0.4));
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
      ctx.fillStyle="#5db3d8"; ctx.fillRect(x,y,TILE,TILE);
      ctx.fillStyle="#8ed0ea";
      if ((c+r+Math.floor(t*2))%3===0) ctx.fillRect(x+4,y+10,12,3);
      if (r>0 && VMAP[r-1][c]==="S"){ ctx.fillStyle="rgba(255,255,255,.7)"; ctx.fillRect(x, y+Math.sin(t*2+c)*2, TILE, 3); }
    } else if (ch==="S"){
      ctx.fillStyle="#efdfae"; ctx.fillRect(x,y,TILE,TILE);
      const h=(c*7+r*13)%23;
      if (h===0){ ctx.fillStyle="#dcc98e"; ctx.fillRect(x+8,y+10,5,3); }
      if (h===9){ drawEmojiC(ctx,"🐚",x+12,y+12,8); }
    } else if (ch==="D"){
      ctx.fillStyle="#b39468"; ctx.fillRect(x,y,TILE,TILE);
      ctx.fillStyle="#a1855c"; if ((c*5+r*11)%4===0) ctx.fillRect(x+5,y+7,6,4);
    } else if (ch==="C"){
      ctx.fillStyle="#8d939c"; ctx.fillRect(x,y,TILE,TILE);
      ctx.fillStyle="#787e88"; ctx.fillRect(x,y+16,TILE,8);
      ctx.fillStyle="#a5abb4"; ctx.fillRect(x+3,y+3,7,5); ctx.fillRect(x+13,y+9,7,5);
    } else if (ch==="P"){
      if (tier>=2){
        ctx.fillStyle="#cfc5b0"; ctx.fillRect(x,y,TILE,TILE);
        ctx.strokeStyle="#bdb29c"; ctx.lineWidth=1;
        ctx.strokeRect(x+2,y+2,9,9); ctx.strokeRect(x+13,y+2,9,9); ctx.strokeRect(x+2,y+13,9,9); ctx.strokeRect(x+13,y+13,9,9);
      } else {
        ctx.fillStyle="#e5cf9a"; ctx.fillRect(x,y,TILE,TILE);
        ctx.fillStyle="#d4ba7e"; if ((c*7+r*13)%5===0) ctx.fillRect(x+6,y+8,4,4);
      }
    } else {
      ctx.fillStyle=(c+r)%2 ? "#9fd6a8" : "#95cf9e"; ctx.fillRect(x,y,TILE,TILE);
      const h=(c*7+r*13)%29;
      if (ch==="G" && h===0){ ctx.fillStyle="#ff9db0"; ctx.fillRect(x+9,y+9,4,4); ctx.fillStyle="#ffd666"; ctx.fillRect(x+10,y+10,2,2); }
      else if (ch==="G" && h===7){ ctx.fillStyle="#7cbf86"; ctx.fillRect(x+6,y+12,3,6); ctx.fillRect(x+14,y+9,3,9); }
      else if (ch==="G" && h===15 && r>12 && c<9){ ctx.fillStyle="#8a6a45"; ctx.fillRect(x+2,y+16,20,3); ctx.fillStyle="#63b573"; ctx.fillRect(x+4,y+10,3,6); ctx.fillRect(x+11,y+9,3,7); ctx.fillRect(x+17,y+11,3,5); }
    }
    if (ch==="T"){
      const pine = (c*13+r*7)%3===0;
      ctx.fillStyle="#7a5230"; ctx.fillRect(x+9,y+12,6,10);
      if (pine){
        ctx.fillStyle="#3f8b52";
        ctx.beginPath(); ctx.moveTo(x+12,y-4); ctx.lineTo(x+2,y+14); ctx.lineTo(x+22,y+14); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle="#4e9e5f"; ctx.beginPath(); ctx.arc(x+12,y+8,10,0,7); ctx.fill();
        ctx.fillStyle="#63b573"; ctx.beginPath(); ctx.arc(x+8,y+6,6,0,7); ctx.fill();
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
    if (o.kind==="bld"){
      ctx.fillStyle="rgba(0,0,0,.15)"; ctx.fillRect(r.x+3, r.y+r.h-4, r.w-4, 5);
      ctx.fillStyle=o.wall; ctx.fillRect(r.x, r.y+10, r.w, r.h-10);
      ctx.fillStyle=o.roof;
      ctx.beginPath(); ctx.moveTo(r.x-4, r.y+12); ctx.lineTo(r.x+r.w/2, r.y-4); ctx.lineTo(r.x+r.w+4, r.y+12); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#6a4a2f"; ctx.fillRect(r.x+r.w/2-6, r.y+r.h-16, 12, 16);
      if (r.w >= 3*TILE){
        ctx.fillStyle="#bfe8f7"; ctx.fillRect(r.x+8, r.y+20, 10, 8); ctx.fillRect(r.x+r.w-18, r.y+20, 10, 8);
        ctx.strokeStyle="#8c6947"; ctx.lineWidth=1; ctx.strokeRect(r.x+8, r.y+20, 10, 8); ctx.strokeRect(r.x+r.w-18, r.y+20, 10, 8);
      }
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
      ctx.fillStyle="#8c6947"; ctx.fillRect(r.x+2, r.y+16, r.w-4, r.h-16);
      ctx.fillStyle="#a97f52"; ctx.fillRect(r.x, r.y+14, r.w, 5);
      for (let i=0;i<r.w;i+=8){ ctx.fillStyle = (i/8)%2 ? "#fff8e6" : o.awn; ctx.fillRect(r.x+i, r.y, 8, 10); }
      drawPerson(ctx, r.x+r.w/2, r.y+12, o.hair, o.shirt, t+o.tx, false, 1);
      if (skillLvl("trading") < o.lvl) drawEmojiC(ctx,"🔒", r.x+r.w/2, r.y-6, 10);
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
  ctx.fillStyle="#8c6947";
  for (let i=0;i<5;i++) ctx.fillRect(28*TILE, 17.5*TILE+i*10, 2*TILE, 7);
  ctx.fillStyle="#7a5a3a"; ctx.fillRect(28*TILE+4, 17.5*TILE, 4, 52); ctx.fillRect(30*TILE-8, 17.5*TILE, 4, 52);
  const bob = Math.sin(t*1.6)*2;
  ctx.fillStyle="#b0574f"; ctx.fillRect(31.4*TILE, 19.6*TILE+bob, 46, 12);
  ctx.fillStyle="#e8e2d2"; ctx.fillRect(31.4*TILE+16, 19.6*TILE-10+bob, 4, 12);
  ctx.fillStyle="#fff8e6"; ctx.beginPath(); ctx.moveTo(31.4*TILE+20, 19.6*TILE-10+bob); ctx.lineTo(31.4*TILE+38, 19.6*TILE-2+bob); ctx.lineTo(31.4*TILE+20, 19.6*TILE-2+bob); ctx.closePath(); ctx.fill();
  if (tier>=1){
    [[10,5],[32,5],[10,10],[32,10]].forEach(([c,r])=>{
      const x=c*TILE+12, y=r*TILE-2;
      ctx.fillStyle="rgba(255,214,102,.22)"; ctx.beginPath(); ctx.arc(x, y-14, 12, 0, 7); ctx.fill();
      ctx.fillStyle="#5a4a3a"; ctx.fillRect(x-2, y-12, 4, 14);
      ctx.fillStyle="#ffd666"; ctx.fillRect(x-4, y-18, 8, 7);
    });
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
      } else {
        drawPerson(ctx, p.x, p.y, PL_HAIR, PL_SHIRT, t, false, -1, SKILL_TOOL[S.action.skill]);
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
  const mw = VCOLS*2, mh = VROWS*2, mx = VIEW_W-mw-8, my = 8;
  ctx.fillStyle="rgba(69,52,35,.78)"; ctx.fillRect(mx-3, my-3, mw+6, mh+6);
  const cmap = { G:"#8fc79a", P:"#dcc48f", W:"#5db3d8", T:"#3f7a4e", C:"#7d838c", D:"#a1855c", S:"#e6d49e" };
  for (let r=0;r<VROWS;r++) for (let c=0;c<VCOLS;c++){
    ctx.fillStyle = cmap[VMAP[r][c]] || "#888";
    ctx.fillRect(mx+c*2, my+r*2, 2, 2);
  }
  for (const o of V_OBJECTS){
    if (o.kind==="bld" || o.kind==="stall"){ ctx.fillStyle=o.roof||o.awn; ctx.fillRect(mx+o.tx*2, my+o.ty*2, (o.w||1)*2, (o.h||1)*2); }
    if (o.kind==="rock"){ ctx.fillStyle=o.vein; ctx.fillRect(mx+o.tx*2, my+o.ty*2, 2, 2); }
  }
  ctx.fillStyle="#bfe8f7"; const fr=WANDERERS[0]; ctx.fillRect(mx+fr.x/TILE*2-1, my+fr.y/TILE*2-1, 2, 2);
  ctx.fillStyle="#fff"; ctx.fillRect(mx+VP.x/TILE*2-1, my+VP.y/TILE*2-1, 3, 3);
}
function drawVillage(t){
  const cv = document.getElementById("village");
  if (!cv || S.tab!=="village") return;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const camTX = Math.max(0, Math.min(VCOLS*TILE-VIEW_W, VP.x - VIEW_W/2));
  const camTY = Math.max(0, Math.min(VROWS*TILE-VIEW_H, VP.y - VIEW_H/2));
  CAM.x += (camTX - CAM.x) * 0.14;
  CAM.y += (camTY - CAM.y) * 0.14;
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
    if (w.tee){
      ctx.fillStyle="#1c6ea4"; ctx.font="bold 5px monospace"; ctx.textAlign="center";
      ctx.fillText(w.tee, w.x, w.y-1);
    }
  }
  if (VP.tx!==null && VP.tx!==undefined){
    ctx.strokeStyle="rgba(255,248,230,.8)"; ctx.lineWidth=2;
    const rad = 6+Math.sin(t*8)*2;
    ctx.beginPath(); ctx.arc(VP.tx, VP.ty, rad, 0, 7); ctx.stroke();
  }
  drawPerson(ctx, VP.x, VP.y, PL_HAIR, PL_SHIRT, t, VP.moving, VP.facing, playerTool, playerTool ? (VP.facing>=0?"right":"left") : VP.dir);
  if (S.playerName){
    ctx.font="bold 9px monospace"; ctx.textAlign="center";
    const nm = S.playerName, wdt = ctx.measureText(nm).width+8;
    ctx.fillStyle="rgba(255,248,230,.85)"; ctx.fillRect(VP.x-wdt/2, VP.y-34, wdt, 12);
    ctx.fillStyle="#453423"; ctx.fillText(nm, VP.x, VP.y-25);
  }
  const near = nearestInteractable();
  if (near){
    const isN = near.kind==="npc";
    const r = isN ? {x:near.w.x-12, y:near.w.y-24, w:24} : objRect(near);
    const label = isN ? ((near.w.id==="frost"?"❄️ ":"💬 ")+near.w.n) : villageTip(near);
    ctx.font="bold 9px monospace";
    const w = ctx.measureText(label).width+10, bx = r.x+(r.w||24)/2;
    ctx.fillStyle="rgba(255,248,230,.95)"; ctx.fillRect(bx-w/2, r.y-18, w, 13);
    ctx.strokeStyle="#8c6947"; ctx.strokeRect(bx-w/2, r.y-18, w, 13);
    ctx.fillStyle="#453423"; ctx.textAlign="center"; ctx.fillText(label, bx, r.y-8);
  }
  ctx.restore();
  drawMinimap(ctx);
}
function updateWanderers(dt){
  for (const w of WANDERERS){
    if (w.tx===null){
      w.wait -= dt;
      if (w.wait<=0){
        const [ax,ay,bx,by] = w.area;
        const gx=(ax+Math.random()*(bx-ax))*TILE, gy=(ay+Math.random()*(by-ay))*TILE;
        if (!solidAt(gx,gy)){ w.tx=gx; w.ty=gy; }
        w.wait = 2+Math.random()*4;
      }
    }
    moveActor(w, dt, 30);
  }
}
function drawInterior(t){
  const cv = document.getElementById("interior");
  if (!cv) return;
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  const active = S.action ? S.action.skill : null;
  if (S.tab==="mining"){
    ctx.fillStyle="#6a5340"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#5c4736"; for(let i=0;i<6;i++) ctx.fillRect(0, 18*i+((i*13)%7), W, 4);
    for (let i=0;i<5;i++){
      const o = V_OBJECTS[i];
      ctx.fillStyle = o.vein; const gx=60+i*110, gy=40+(i*37)%50;
      ctx.fillRect(gx,gy,5,5); ctx.fillRect(gx+8,gy+6,4,4);
    }
    ctx.fillStyle="#3d3128"; ctx.fillRect(40,H-34,70,24);
    ctx.fillStyle="#8d939c"; ctx.fillRect(46,H-30,58,10);
    ctx.fillStyle="#2a2a2a"; ctx.beginPath(); ctx.arc(56,H-8,7,0,7); ctx.arc(94,H-8,7,0,7); ctx.fill();
    for (let i=0;i<3;i++){ const lx=170+i*160; ctx.fillStyle="rgba(255,214,102,.25)"; ctx.beginPath(); ctx.arc(lx,26,16,0,7); ctx.fill(); drawEmojiC(ctx,"🏮",lx,26,14); }
    drawPerson(ctx, W-60, H-24, PL_HAIR, PL_SHIRT, t, false, -1, active==="mining" ? "⛏️" : null);
  } else if (S.tab==="steelworks"){
    ctx.fillStyle="#4a3f3a"; ctx.fillRect(0,0,W,H);
    for(let r=0;r<7;r++) for(let c=0;c<20;c++){ ctx.strokeStyle="#3a312d"; ctx.strokeRect(c*30+(r%2?15:0), r*18, 30, 18); }
    for (let f=0;f<2;f++){
      const fx = 90+f*180;
      ctx.fillStyle="#5a4a42"; ctx.fillRect(fx-34, 26, 68, 70);
      ctx.fillStyle="#2b2320"; ctx.beginPath(); ctx.arc(fx, 74, 24, Math.PI, 0); ctx.fill(); ctx.fillRect(fx-24,74,48,20);
      const fl = 0.6+0.4*Math.sin(t*9+f*2);
      ctx.fillStyle="#ff8a3c"; ctx.beginPath(); ctx.arc(fx, 80, 17*fl+4, Math.PI, 0); ctx.fill();
      ctx.fillStyle="#ffd666"; ctx.beginPath(); ctx.arc(fx, 84, 9*fl+2, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle="#3a3a3a"; ctx.fillRect(W-170, H-36, 90, 12); ctx.fillRect(W-140,H-24,30,18);
    if (active==="steelworks"){ ctx.fillStyle="#ff9a4c"; ctx.fillRect(W-160, H-42, 44, 8); }
    drawPerson(ctx, W-60, H-24, PL_HAIR, PL_SHIRT, t, false, -1, active==="steelworks" ? "🔨" : null);
  } else if (S.tab==="manufacturing"){
    ctx.fillStyle="#55606e"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#49535f"; ctx.fillRect(0,0,W,26);
    ctx.fillStyle="#3d4650"; ctx.fillRect(0, H-52, W, 22);
    const off = (t*60)%24;
    ctx.fillStyle="#2f363e"; for(let x=-24;x<W;x+=24) ctx.fillRect(x+off, H-52, 12, 22);
    for(let b=0;b<4;b++){ const bx=(b*150+t*60)%(W+60)-30; drawEmojiC(ctx,"📦",bx,H-62,16); }
    ctx.fillStyle="#7a8494"; ctx.fillRect(150, 30, 14, 46);
    ctx.save(); ctx.translate(157, 34); ctx.rotate(Math.sin(t*3)*0.5);
    ctx.fillStyle="#95a0b0"; ctx.fillRect(-5, 0, 10, 34); ctx.fillStyle="#ffd666"; ctx.fillRect(-7, 30, 14, 8); ctx.restore();
    drawPerson(ctx, W-60, H-24, PL_HAIR, PL_SHIRT, t, false, -1, active==="manufacturing" ? "🔧" : null);
  } else if (S.tab==="contracts"){
    ctx.fillStyle="#6e5f4a"; ctx.fillRect(0,0,W,H);
    const stock = Math.min(24, Math.floor(Object.values(S.items).reduce((a,b)=>a+b,0)/12));
    for (let sh=0; sh<2; sh++){
      ctx.fillStyle="#57493a"; ctx.fillRect(20, 30+sh*42, W-220, 8);
      for (let i=0;i<12;i++){
        if (sh*12+i < stock){ ctx.fillStyle=["#d9a86a","#c98a5a","#e8c94e"][i%3]; ctx.fillRect(26+i*26, 12+sh*42, 20, 18); ctx.strokeStyle="#8c6947"; ctx.strokeRect(26+i*26, 12+sh*42, 20, 18); }
      }
    }
    ctx.fillStyle="#4e7d5b"; ctx.fillRect(W-150, 20, 120, 70);
    ctx.fillStyle="#2f3e35"; ctx.fillRect(W-140, 30, 100, 50);
    ctx.fillStyle="#1c1c1c"; ctx.beginPath(); ctx.arc(W-130,96,10,0,7); ctx.arc(W-50,96,10,0,7); ctx.fill();
    drawEmojiC(ctx,"📋", W-190, H-40, 18);
    drawPerson(ctx, W-210, H-24, PL_HAIR, PL_SHIRT, t, false, 1);
  } else if (S.tab==="trade"){
    ctx.fillStyle="#7a5a3a"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#6a4c30"; for(let i=0;i<8;i++) ctx.fillRect(0,i*16,W,3);
    const stalls = V_OBJECTS.filter(o=>o.kind==="stall");
    stalls.forEach((o,i)=>{
      const sx = 100+i*180;
      for (let k=0;k<6;k++){ ctx.fillStyle = k%2 ? "#fff8e6" : o.awn; ctx.fillRect(sx-42+k*14, 18, 14, 12); }
      ctx.fillStyle="#8c6947"; ctx.fillRect(sx-42, 66, 84, 30);
      drawPerson(ctx, sx, 62, o.hair, o.shirt, t+i, false, 1);
      if (skillLvl("trading") < o.lvl) drawEmojiC(ctx,"🔒", sx, 34, 12);
    });
    drawPerson(ctx, 30, H-24, PL_HAIR, PL_SHIRT, t, false, 1);
  } else if (S.tab==="pets"){
    ctx.fillStyle="#8a6a45"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#7a5c3a"; for(let i=0;i<10;i++) ctx.fillRect(i*60,0,4,H);
    drawEmojiC(ctx,"🌾", 50, H-24, 26); drawEmojiC(ctx,"🌾", 90, H-20, 20); drawEmojiC(ctx,"🌾", W-60, H-22, 24);
    if (!S.pets.owned.length) drawEmojiC(ctx,"❓", W/2, H/2, 30);
    S.pets.owned.forEach((id,i)=>{
      const p = PETS.find(x=>x.id===id); if (!p) return;
      const px = 80+i*90+Math.sin(t*1.2+i)*24, py = 62+Math.cos(t*0.9+i*2)*14;
      drawEmojiC(ctx, p.ic, px, py+Math.sin(t*6+i)*2, 24);
      if (S.pets.active===id) drawEmojiC(ctx,"⭐", px+12, py-14, 10);
    });
  } else if (S.tab==="upgrades" || S.tab==="ach"){
    ctx.fillStyle="#6a6252"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#57503f"; ctx.fillRect(0,H-30,W,30);
    ctx.fillStyle="#8c6947"; ctx.fillRect(60, 50, 170, 44); ctx.fillStyle="#a9855c"; ctx.fillRect(60,50,170,8);
    drawEmojiC(ctx,"🗂️", 100, 42, 16); drawEmojiC(ctx,"☕", 190, 42, 14);
    ctx.fillStyle="#d9cdb0"; ctx.fillRect(300, 20, 200, 70); ctx.strokeStyle="#8c6947"; ctx.strokeRect(300,20,200,70);
    if (S.tab==="upgrades"){
      const owned = Object.keys(S.upgrades).length;
      for (let i=0;i<Math.min(owned,10);i++){ ctx.fillStyle=["#fff","#ffe9c9","#e6f4ff"][i%3]; ctx.fillRect(310+(i%5)*38, 28+Math.floor(i/5)*32, 28, 24); ctx.fillStyle="#e05d5d"; ctx.fillRect(322+(i%5)*38, 26, 4, 4); }
    } else {
      const got = ACH.filter(a=>S.ach && S.ach[a.id]);
      got.slice(0,10).forEach((a,i)=>{ drawEmojiC(ctx, a.ic, 320+(i%5)*38, 40+Math.floor(i/5)*32, 18); });
    }
    drawEmojiC(ctx,"🏳️", 540, 34, 20);
    drawPerson(ctx, 260, H-24, "#8a8a8a", "#b0574f", t, false, 1);
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
  const t = ts/1000;
  const dt = Math.min(0.05, vLastT ? t-vLastT : 0.016);
  vLastT = t;
  const tl = document.getElementById("title");
  if (tl && tl.style.display !== "none"){
    drawTitleFX(t);
  } else if (S.tab==="village"){
    moveActor(VP, dt, 104);
    if (VP.moving && t-lastDust > 0.16){
      lastDust = t;
      DUST.push({ x:VP.x+(Math.random()*6-3), y:VP.y+9, born:Date.now() });
      if (DUST.length > 14) DUST.shift();
    }
    updateWanderers(dt);
    if (VP.pending){
      const o = VP.pending;
      const ap = o.kind==="npc" ? {x:o.w.x, y:o.w.y+18} : objApproach(o);
      if (Math.hypot(VP.x-ap.x, VP.y-ap.y) < 46 && VP.tx===null){
        VP.pending=null; interactObj(o);
      } else if (VP.tx===null && !VP.moving){ VP.pending=null; }
    }
    drawVillage(t);
  } else {
    drawInterior(t);
  }
  requestAnimationFrame(villageFrame);
}
function setupVillage(){
  const cv = document.getElementById("village");
  if (cv) cv.onclick = villageClick;
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
const SAVE_KEY = "buyrworld_game_save_v1";
const OFFLINE_CAP_MS = 8 * 3600 * 1000;

function freshState(){
  return {
    v:1, coins:0, items:{}, lastSeen:Date.now(), market:null,
    playerName:"", settings:{ music:true }, prod:{}, tut:{ step:0, done:false }, ach:{},
    skills:{ mining:{xp:0}, steelworks:{xp:0}, manufacturing:{xp:0}, logistics:{xp:0}, trading:{xp:0} },
    upgrades:{}, pets:{ owned:[], active:null },
    counters:{ actions:0, contracts:0, coinsEarned:0, trades:0 },
    action:null,
    contracts:[],
    tab:"village",
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
      if (!("settings" in parsed)) S.settings = { music:true };
      if (!("prod" in parsed)) S.prod = {};
      if (!("tut" in parsed)) S.tut = { step:99, done:true };
      if (!("ach" in parsed)) S.ach = {};
      if (!("coinsEarned" in S.counters)) S.counters.coinsEarned = 0;
      if (!("trades" in S.counters)) S.counters.trades = 0;
      if (typeof S.playerName !== "string") S.playerName = "";
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
  const pet = PETS.find(p=>p.id===S.pets.active);
  if (pet){
    if (pet.id==="forklift_fox" && skill==="mining") m *= 0.88;
    if (pet.id==="drone_owl" && skill==="manufacturing") m *= 0.88;
  }
  return m;
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
  { id:"contracts", n:"Contracts", ic:"📋" },
  { id:"trade", n:"Trade", ic:"⚖️" },
  { id:"upgrades", n:"Upgrades", ic:"🛒" },
  { id:"pets", n:"Companions", ic:"🦊" },
  { id:"ach", n:"Awards", ic:"🏆" },
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
function interiorHtml(title){
  return `<div class="panel" style="padding:8px;">
    <canvas id="interior" width="${VIEW_W}" height="120" style="width:100%;display:block;image-rendering:pixelated;border:2px solid var(--edge);"></canvas>
    <div class="vhint">${title}</div></div>`;
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
function renderMain(){
  const m = $("#main");
  const banner = tutBannerHtml();
  if (S.tab==="village") m.innerHTML = banner + `<div class="panel" style="padding:8px;">
      <canvas id="village" width="${VIEW_W}" height="${VIEW_H}"></canvas>
      <div class="vhint">Tap to walk · tap rocks, buildings, stalls and villagers to interact · WASD/arrows also work · quarry is west, beach is south</div>
    </div>` + renderInventoryPanel();
  else if (S.tab==="contracts") m.innerHTML = banner + interiorHtml("📦 Inside the Depot — shelves fill up as your warehouse does") + renderContracts();
  else if (S.tab==="trade") m.innerHTML = banner + interiorHtml("⚖️ Inside the Market Hall") + renderTrade();
  else if (S.tab==="upgrades") m.innerHTML = banner + interiorHtml("🛒 Inside the Town Hall — CapEx office") + renderUpgrades();
  else if (S.tab==="pets") m.innerHTML = banner + interiorHtml("🐾 Inside the Companion Barn — your crew hangs out here") + renderPets();
  else if (S.tab==="ach") m.innerHTML = banner + renderAch();
  else if (S.tab==="settings") m.innerHTML = banner + renderSettings();
  else m.innerHTML = banner + interiorHtml(S.tab==="mining" ? "⛏️ Down in the Quarry" : S.tab==="steelworks" ? "🔥 Inside the Furnace" : "⚙️ Inside the Workshop") + renderSkillPanel(S.tab);
  bindMain();
  setupVillage();
  updateMusicZone();
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
  if (nameEl) nameEl.textContent = S.playerName ? S.playerName : "—";
  const stat = document.getElementById("hud-name-stat");
  if (stat){
    if (S.playerName) stat.classList.add("named");
    else stat.classList.remove("named");
  }
  const pet = PETS.find(p=>p.id===S.pets.active);
  $("#hud-pet").textContent = pet ? pet.ic+" "+pet.n.split(" ")[1] : "—";
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
renderNav(); renderMain(); updateHud(); syncMusicButton();
document.getElementById("btn-music").onclick = () => setMusic(!S.settings.music);
window.addEventListener("keydown", e => {
  if (S.tab !== "village") return;
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
