import { describe, it, expect } from 'vitest';
import {
  FLEET_TIERS, boatTier, nextBoatTier, fleetSpeedMult, fleetCargoMult, fleetMaxBoats,
  fleetUpgradeCost, canUpgradeFleet, routeUnlocked,
} from '../src/data/fleet.ts';

describe('Shipyard — boat tiers', () => {
  it('tiers improve monotonically and are well-formed', () => {
    for (let i = 0; i < FLEET_TIERS.length; i++) {
      const b = FLEET_TIERS[i];
      expect(b.n && b.ic && b.ds).toBeTruthy();
      expect(b.speedMult).toBeGreaterThan(0);
      expect(b.cargoMult).toBeGreaterThanOrEqual(1);
      if (i > 0) {
        expect(b.cost).toBeGreaterThan(FLEET_TIERS[i - 1].cost);
        expect(b.speedMult).toBeLessThanOrEqual(FLEET_TIERS[i - 1].speedMult);
        expect(b.cargoMult).toBeGreaterThanOrEqual(FLEET_TIERS[i - 1].cargoMult);
      }
    }
    expect(FLEET_TIERS[0].cost).toBe(0);
    expect(fleetMaxBoats(0)).toBe(3);   // preserves the original 3-boat cap
  });
  it('boatTier clamps out-of-range indices', () => {
    expect(boatTier(-5).tier).toBe(0);
    expect(boatTier(99).tier).toBe(FLEET_TIERS.length - 1);
    expect(nextBoatTier(FLEET_TIERS.length - 1)).toBeNull();
    expect(nextBoatTier(0).tier).toBe(1);
  });
});

describe('Shipyard — upgrades & multipliers', () => {
  it('accessors read the current tier', () => {
    expect(fleetSpeedMult(2)).toBe(FLEET_TIERS[2].speedMult);
    expect(fleetCargoMult(3)).toBe(FLEET_TIERS[3].cargoMult);
    expect(fleetMaxBoats(4)).toBe(FLEET_TIERS[4].maxBoats);
  });
  it('upgrade cost and affordability', () => {
    expect(fleetUpgradeCost(0)).toBe(FLEET_TIERS[1].cost);
    expect(fleetUpgradeCost(FLEET_TIERS.length - 1)).toBeNull();
    expect(canUpgradeFleet(0, FLEET_TIERS[1].cost)).toBe(true);
    expect(canUpgradeFleet(0, FLEET_TIERS[1].cost - 1)).toBe(false);
    expect(canUpgradeFleet(FLEET_TIERS.length - 1, 1e9)).toBe(false);
  });
});

describe('Shipyard — route gating', () => {
  it('routes unlock at their required boat tier', () => {
    expect(routeUnlocked(0, 0)).toBe(true);
    expect(routeUnlocked(2, 1)).toBe(false);
    expect(routeUnlocked(2, 2)).toBe(true);
    expect(routeUnlocked(undefined, 0)).toBe(true);
  });
});
