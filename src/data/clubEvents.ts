// @ts-nocheck
// Club Featherstone — backstage supply micro-contract + dynamic event pool.
// Pure + deterministic so it's unit-testable and identical across sessions. The game
// layer (main.ts) applies coins/reputation/relationship via these descriptors; nothing
// here mutates state or touches audio/DOM.

import { DAY_DURATION_MS } from '../world/daynight.ts';

// ---- Backstage supply micro-contract (BuyrWorld's supply-chain identity) ---------
export interface ClubChoice {
  id: string;
  label: string;
  cost: number;        // coins spent to take this option (0 = free)
  risk: number;        // 0..1 chance the option goes wrong
  ok: string;          // message on success
  bad: string;         // message on failure (only reachable when risk>0)
  rep: number;         // event-reputation delta on success (negative on failure handled by caller)
  frosty: number;      // Frosty relationship delta on success
}
export interface ClubIncident {
  id: string;
  title: string;
  problem: string;     // what's gone wrong backstage
  choices: ClubChoice[];
}

export const CLUB_INCIDENTS: ClubIncident[] = [
  {
    id: 'speaker_cable', title: 'Speaker cable is late', problem: "The main speaker cable delivery hasn't turned up and doors open soon.",
    choices: [
      { id:'buy_local', label:'Buy locally (higher cost, reliable)', cost:120, risk:0,   ok:"Sorted — you grab a cable from the cash-and-carry. Sound is crisp all night.", bad:"", rep:2, frosty:2 },
      { id:'cheap',     label:'Cheap market cable (risky)',          cost:35,  risk:0.4, ok:"The bargain cable holds! Big sound, small spend.",                          bad:"The cheap cable buzzes — the low end drops out mid-set.", rep:1, frosty:1 },
      { id:'delay',     label:'Delay the opening 20 min',            cost:0,   risk:0,   ok:"You push the opening back; the proper cable arrives. Crowd grumbles a little.", bad:"", rep:-1, frosty:0 },
    ],
  },
  {
    id: 'light_qc', title: 'Lighting rig fails QC', problem: "A stage light failed inspection — run it as-is, or fix it?",
    choices: [
      { id:'rework',   label:'Rework the fixture (costs time & parts)', cost:90, risk:0,   ok:"You swap the driver — the rig passes and the sweeps look immaculate.",      bad:"", rep:2, frosty:2 },
      { id:'run',      label:'Run it anyway (risky)',                   cost:0,  risk:0.5, ok:"It holds — nobody notices. Lucky.",                                        bad:"The fixture pops mid-set; half the stage goes dark.", rep:1, frosty:0 },
      { id:'substitute',label:'Substitute from stock',                 cost:40, risk:0.15,ok:"A spare from the store does the job nicely.",                               bad:"The spare's the wrong colour temperature — a bit off, but it works.", rep:1, frosty:1 },
    ],
  },
  {
    id: 'bar_short', title: 'Bar supplier short-ships', problem: "The drinks order came up two crates short for a busy night.",
    choices: [
      { id:'expedite', label:'Expedite an emergency top-up',  cost:110, risk:0,   ok:"A rush delivery lands — the bar never runs dry.",                bad:"", rep:2, frosty:1 },
      { id:'ration',   label:'Ration the popular lines',      cost:0,   risk:0.3, ok:"Careful pouring gets you through the night.",                    bad:"You run out of the headline drink; a few punters drift off.", rep:0, frosty:0 },
      { id:'substitute',label:'Substitute similar stock',     cost:30,  risk:0.2, ok:"The swaps go unnoticed — crisis averted.",                       bad:"Regulars spot the swap and grumble about it.", rep:1, frosty:1 },
    ],
  },
  {
    id: 'ice_late', title: 'Ice delivery delayed', problem: "No ice for the bar with an hour to go.",
    choices: [
      { id:'buy_local', label:'Collect from a local supplier', cost:60, risk:0,   ok:"You run out and back with a boot full of ice. Sorted.",       bad:"", rep:1, frosty:1 },
      { id:'cheap',     label:'Make do with what you have',    cost:0,  risk:0.35,ok:"It just about stretches to closing.",                          bad:"Warm drinks by midnight — not a great look.", rep:0, frosty:0 },
    ],
  },
  {
    id: 'dj_part', title: 'DJ gear needs a part', problem: "Frosty's mixer has a dodgy channel — he needs a replacement fader.",
    choices: [
      { id:'expedite', label:'Courier the exact part',   cost:100, risk:0,   ok:"The right fader arrives — Frosty's decks are flawless. He's made up.", bad:"", rep:2, frosty:3 },
      { id:'substitute',label:'Rig a workaround',        cost:20,  risk:0.3, ok:"Your bodge holds — Frosty grins and rolls with it.",                  bad:"The workaround crackles; Frosty has to nurse the channel all night.", rep:1, frosty:1 },
    ],
  },
  {
    id: 'security_short', title: 'Security understaffed', problem: "The security contractor is a body short for a big crowd.",
    choices: [
      { id:'buy_local', label:'Hire a vetted stand-in',   cost:80, risk:0,   ok:"A solid stand-in arrives — the door runs smoothly.",         bad:"", rep:2, frosty:1 },
      { id:'cheap',     label:'Cover it with staff',      cost:0,  risk:0.4, ok:"Everyone pitches in and it holds together.",                 bad:"A scuffle at the door gets messy without enough cover.", rep:0, frosty:0 },
    ],
  },
];

// One incident per game day, deterministic from the same epoch as the theme rotation.
const CLUB_EPOCH = Date.UTC(2026, 0, 5);
export function clubIncidentIndex(now = Date.now()): number {
  const day = Math.floor((now - CLUB_EPOCH) / DAY_DURATION_MS);
  const i = day % CLUB_INCIDENTS.length;
  return ((i % CLUB_INCIDENTS.length) + CLUB_INCIDENTS.length) % CLUB_INCIDENTS.length;
}
export function clubIncidentFor(now = Date.now()): ClubIncident {
  return CLUB_INCIDENTS[clubIncidentIndex(now)];
}
export function clubChoiceById(incident: ClubIncident, id: string): ClubChoice | null {
  return incident.choices.find(c => c.id === id) || null;
}
// Resolve a choice. `roll` is a 0..1 value (caller supplies Math.random()); pure so tests
// can force success/failure. Returns the descriptor the game layer applies.
export function resolveClubChoice(incident: ClubIncident, choiceId: string, roll = 0.99){
  const c = clubChoiceById(incident, choiceId);
  if (!c) return null;
  const failed = c.risk > 0 && roll < c.risk;
  return {
    choiceId, cost: c.cost, failed,
    message: failed ? c.bad : c.ok,
    rep: failed ? -1 : c.rep,
    frosty: failed ? Math.min(0, c.frosty - 1) : c.frosty,
  };
}

// ---- Dynamic event pool ----------------------------------------------------------
export interface ClubEventResponse { id: string; label: string; rep: number; }
export interface ClubEvent { id: string; title: string; prompt: string; responses: ClubEventResponse[]; }

export const CLUB_EVENTS: ClubEvent[] = [
  { id:'power_trip', title:'The power trips', prompt:"The lights cut for a second — the crowd whoops, then it's back. Someone needs to reset the board.",
    responses:[ {id:'reset',label:'Reset the board yourself',rep:2}, {id:'staff',label:'Send a staff member',rep:1}, {id:'ignore',label:'Let it ride',rep:0} ] },
  { id:'dance_off', title:'A dance-off kicks off', prompt:"Two regulars start a friendly dance-off and the floor circles up.",
    responses:[ {id:'join',label:'Jump in',rep:2}, {id:'cheer',label:'Cheer them on',rep:1}, {id:'watch',label:'Watch from the bar',rep:0} ] },
  { id:'vip_arrival', title:'A VIP guest arrives', prompt:"A well-known face sweeps in toward the mezzanine. The bouncer glances your way.",
    responses:[ {id:'greet',label:'Greet them warmly',rep:2}, {id:'nod',label:'A respectful nod',rep:1}, {id:'ignore',label:'Keep your distance',rep:0} ] },
  { id:'supplier_rep', title:'A supplier rep is here', prompt:"A drinks-supplier rep is working the room, handing out cards.",
    responses:[ {id:'card',label:'Take a card & chat',rep:2}, {id:'polite',label:'Politely decline',rep:0}, {id:'later',label:'Ask them to call round',rep:1} ] },
  { id:'track_preview', title:'Frosty previews a track', prompt:"Frosty leans over: 'Want to hear something no one's heard yet?'",
    responses:[ {id:'yes',label:'Absolutely',rep:2}, {id:'busy',label:'Maybe later',rep:0} ] },
  { id:'lost_item', title:'Someone lost their keys', prompt:"A panicked guest is hunting for dropped keys near the booths.",
    responses:[ {id:'help',label:'Help them look',rep:2}, {id:'staff',label:'Point them to staff',rep:1}, {id:'ignore',label:'Not your problem',rep:-1} ] },
];

export function clubEventById(id: string): ClubEvent | null { return CLUB_EVENTS.find(e => e.id === id) || null; }
// Deterministic event for a given visit index (so a reload shows the same one, no dupes).
export function clubEventForVisit(visitIndex: number): ClubEvent {
  const i = ((visitIndex % CLUB_EVENTS.length) + CLUB_EVENTS.length) % CLUB_EVENTS.length;
  return CLUB_EVENTS[i];
}
