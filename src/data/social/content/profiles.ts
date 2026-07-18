// NPC profiles + voice profiles. The three pilots (Frosty, Perry, Edna) are authored
// in depth; the remaining named NPCs get real profile data + a safe greeting fallback
// (see graphs.ts) rather than shallow bulk dialogue.
import type { NpcProfile } from '../types.ts';

export const PROFILES: Record<string, NpcProfile> = {
  frosty: {
    id: 'frosty', displayName: 'Frosty', occupation: 'Valley Guide & Mentor', organisation: 'Frost Lodge',
    portrait: '❄️',
    expressions: { neutral: '❄️', happy: '😊', concerned: '😟', suspicious: '🤨', disappointed: '😔', surprised: '😯', angry: '😠' },
    voice: {
      sentenceLength: 'short', formality: 'plain', humour: 'warm', temper: 'calm',
      values: ['graft', 'fair dealing', 'looking after your own'],
      taboo: ['cruelty', 'ripping off the vulnerable'],
      earnsWarmth: 'kindness to neighbours', earnsTrust: 'keeping your word', earnsRespect: 'delivering on time and in full',
      raisesSuspicion: 'shady shortcuts and getting nicked',
      signature: ['Stay frosty.', "That's a proper job.", 'No rest for the busy.'],
      expertise: ['contracts', 'suppliers', 'the valley', 'keeping your head'],
      ambition: 'see every newcomer make an honest go of it',
      hiddenConcern: 'that the valley loses its soul to sharp operators',
    },
    relationshipConfig: { startWarmth: 40, startTrust: 35, startRespect: 25, startSuspicion: 0 },
  },
  perry: {
    id: 'perry', displayName: 'Perry', occupation: 'Freight Agent', organisation: 'Port Salvo',
    portrait: '📦',
    expressions: { neutral: '📦', happy: '🙂', concerned: '😬', suspicious: '🧐', disappointed: '😑' },
    voice: {
      sentenceLength: 'short', formality: 'blunt', humour: 'dry', temper: 'testy',
      values: ['reliability', 'straight talk', 'a full manifest'],
      taboo: ['excuses', 'chancers'],
      earnsWarmth: 'not wasting his time', earnsTrust: 'owning your mistakes', earnsRespect: 'handling a disruption cleanly',
      raisesSuspicion: 'orders that keep lapsing',
      signature: ['Manifest says otherwise.', 'On the pallet or it never happened.', "I've seen it all through this gate."],
      expertise: ['suppliers', 'lead times', 'who ships short'],
      ambition: 'run the tightest yard on the coast',
      hiddenConcern: 'his best supplier is quietly going under',
    },
    relationshipConfig: { startWarmth: 10, startTrust: 15, startRespect: 20, startSuspicion: 10 },
  },
  edna: {
    id: 'edna', displayName: 'Edna', occupation: 'Homeware Keeper', organisation: 'Featherstone WI',
    portrait: '🧶',
    expressions: { neutral: '🧶', happy: '😄', concerned: '🙁', disappointed: '😞', surprised: '😮' },
    voice: {
      sentenceLength: 'medium', formality: 'plain', humour: 'warm', temper: 'calm',
      values: ['neighbourliness', 'a tidy home', 'remembering birthdays'],
      taboo: ['gossip that hurts', 'forgetting a promise'],
      earnsWarmth: 'small kindnesses and gifts', earnsTrust: 'doing what you said you would', earnsRespect: 'a well-kept cottage',
      raisesSuspicion: 'letting people down',
      signature: ['Bless you, love.', "I'll not forget that.", "Put the kettle on, why don't you."],
      expertise: ['the townsfolk', 'homeware', 'who needs a hand'],
      ambition: 'a valley where everyone knows their neighbours',
      hiddenConcern: 'being quietly left behind as the town modernises',
    },
    relationshipConfig: { startWarmth: 25, startTrust: 20, startRespect: 15, startSuspicion: 0 },
  },
};

// Lightweight profiles for the other market traders + notable residents so no NPC is
// "unknown" — enough for the header + a contextual greeting fallback.
const trader = (id: string, name: string, occ: string, port: string): NpcProfile => ({
  id, displayName: name, occupation: occ, organisation: 'Featherstone Market', portrait: port,
  voice: { sentenceLength: 'short', formality: 'plain', humour: 'dry', temper: 'calm', values: ['fair prices'], taboo: [], earnsWarmth: 'repeat custom', earnsTrust: 'paying up', earnsRespect: 'knowing your goods', raisesSuspicion: 'haggling in bad faith', signature: [], expertise: [occ], ambition: 'a good day at the stall', hiddenConcern: 'a slow season' },
  relationshipConfig: { startWarmth: 12, startTrust: 12, startRespect: 15, startSuspicion: 3 },
});
Object.assign(PROFILES, {
  marge: trader('marge', 'Marge', 'Ore Broker', '👩‍🌾'),
  bolt: trader('bolt', 'Bolt', 'Scrap Dealer', '🧑‍🏭'),
  quinn: trader('quinn', 'Quinn', 'Wholesaler', '🧑‍💼'),
  marina: trader('marina', 'Marina', 'Fishmonger', '🐟'),
  finn: trader('finn', 'Finn', 'Homeware Trader', '🛋️'),
  wren: trader('wren', 'Wren', 'Forager', '🍄'),
});

export function profileFor(id: string): NpcProfile | null { return PROFILES[id] || null; }
export const PROFILE_IDS = new Set(Object.keys(PROFILES));
