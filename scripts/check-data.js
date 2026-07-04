#!/usr/bin/env node
// Validates referential integrity of all data JSON registries.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = f => JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', f), 'utf8'));

const items  = load('items.json');
const skills = load('skills.json');
const npcs   = load('npcs.json');

let errors = 0;
const err = msg => { console.error('ERROR:', msg); errors++; };

// items: every entry has n, ic, v > 0
for (const [id, item] of Object.entries(items)) {
  if (!item.n)      err(`items.${id}: missing name`);
  if (!item.ic)     err(`items.${id}: missing icon`);
  if (!(item.v > 0)) err(`items.${id}: value must be > 0`);
}

// skills: every action output/input references a valid item ID
for (const [sk, skill] of Object.entries(skills)) {
  for (const action of skill.actions) {
    for (const id of Object.keys(action.out ?? {}))
      if (!items[id]) err(`${sk}.${action.id}: output '${id}' not in items`);
    for (const id of Object.keys(action.in ?? {}))
      if (!items[id]) err(`${sk}.${action.id}: input '${id}' not in items`);
    if (!(action.lvl >= 1)) err(`${sk}.${action.id}: lvl must be >= 1`);
    if (!(action.xp  > 0))  err(`${sk}.${action.id}: xp must be > 0`);
    if (!(action.ms  > 0))  err(`${sk}.${action.id}: ms must be > 0`);
  }
}

// npcs: every stock item references a valid item ID
for (const npc of npcs) {
  for (const id of npc.stock)
    if (!items[id]) err(`npc.${npc.id}: stock item '${id}' not in items`);
}

if (errors) {
  console.error(`\n${errors} error(s) found.`);
  process.exit(1);
} else {
  const actionCount = Object.values(skills).reduce((a, s) => a + s.actions.length, 0);
  console.log(`Data OK — ${Object.keys(items).length} items, ${actionCount} actions, ${npcs.length} traders.`);
}
