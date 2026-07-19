// @ts-nocheck
// M21 — Business Licence & Company Ownership.
// Buy a licence to OWN one of Featherstone's businesses, then hire staff and run it for
// a real, visible P&L that pays into your wallet over time (idle/offline-safe). Pure +
// deterministic here; ownership state, the wallet booking and the Town-Hall dashboard
// live in main.ts. Numbers are tuned so a staffed company profits (upkeep only applies
// while operating) and scaling up is a capital decision (each hire has a one-off fee).

import { DAY_DURATION_MS } from '../world/daynight.ts';

export interface Company {
  id: string;
  n: string;
  ic: string;
  blurb: string;
  licence: number;      // one-off cost to own it
  slots: number;        // max staff
  revPerStaff: number;  // coins/day of revenue per staff
  wagePerStaff: number; // coins/day wage per staff
  upkeep: number;       // fixed coins/day while operating (staff > 0)
  hireFee: number;      // one-off cost to hire one staff member
  unlockLvl: number;    // total-level gate
}

export const COMPANIES: Company[] = [
  { id:'corner_shop', n:'Corner Shop', ic:'🏪',
    blurb:'A tidy little high-street shop. Low outlay, steady takings.',
    licence:1200,  slots:3, revPerStaff:120, wagePerStaff:55,  upkeep:60,  hireFee:300,  unlockLvl:8  },
  { id:'timber_yard', n:'Timber Yard', ic:'🪵',
    blurb:'Mill and sell timber by the pallet. Bigger margins, bigger costs.',
    licence:3500,  slots:4, revPerStaff:180, wagePerStaff:85,  upkeep:90,  hireFee:500,  unlockLvl:16 },
  { id:'fab_workshop', n:'Fabrication Workshop', ic:'⚙️',
    blurb:'Contract fabrication. Skilled crew, healthy day rate.',
    licence:7000,  slots:5, revPerStaff:260, wagePerStaff:125, upkeep:130, hireFee:800,  unlockLvl:26 },
  { id:'haulage_firm', n:'Haulage Firm', ic:'🚚',
    blurb:'Move freight across the valley. Heavy overheads, heavy profits.',
    licence:14000, slots:6, revPerStaff:360, wagePerStaff:175, upkeep:185, hireFee:1200, unlockLvl:40 },
];

export function companyById(id: string): Company | null {
  return COMPANIES.find(c => c.id === id) || null;
}
export function companiesForLevel(totalLevel: number): Company[] {
  return COMPANIES.filter(c => (totalLevel || 0) >= c.unlockLvl);
}

export interface PnL { revenue: number; wages: number; upkeep: number; net: number; }

// Daily profit & loss for a company at a given staffing. Upkeep only applies while the
// business is actually operating (staff > 0), so an idle company never bleeds coins.
// `demandMult` is a light read-only nudge from the living economy (≈0.85–1.15).
export function dailyPnL(co: Company, staff: number, demandMult = 1): PnL {
  const s = Math.max(0, Math.min(co.slots, staff | 0));
  const revenue = Math.round(s * co.revPerStaff * demandMult);
  const wages = s * co.wagePerStaff;
  const upkeep = s > 0 ? co.upkeep : 0;
  return { revenue, wages, upkeep, net: revenue - wages - upkeep };
}

// The one-off fee to hire the next staff member (flat per company).
export function hireCost(co: Company): number { return co.hireFee; }

// Whole coins earned over `elapsedMs` at a given `net`/day, plus the time those coins
// consumed (so the caller can carry the sub-coin remainder and never lose fractions).
export function accrueCompany(net: number, elapsedMs: number): { coins: number; consumedMs: number } {
  if (!net || elapsedMs <= 0) return { coins: 0, consumedMs: 0 };
  const earned = net * elapsedMs / DAY_DURATION_MS;
  const coins = Math.trunc(earned);
  if (coins === 0) return { coins: 0, consumedMs: 0 };
  const consumedMs = Math.round((coins / net) * DAY_DURATION_MS);
  return { coins, consumedMs };
}

// Rough payback in game-days for the licence at full staff (for the dashboard).
export function paybackDays(co: Company): number {
  const net = dailyPnL(co, co.slots).net;
  return net > 0 ? Math.ceil(co.licence / net) : Infinity;
}
