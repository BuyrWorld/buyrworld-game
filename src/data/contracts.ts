export interface ContractSpec {
  item: string;
  minLvl: number;
}

export const CLIENTS: string[] = [
  'Greenfield Growers Co-op',
  'Port Salvo Chandlers',
  'Valley Rail Maintenance',
  'Bramble & Sons Ironmongers',
  'OmniProcure PLC (they pay late)',
  'The Night Shift Collective',
  'Dockside Repair Guild',
  'Frostline Advance Party',
];

export const CONTRACT_POOL: ContractSpec[] = [
  { item: 'bracket',     minLvl: 1  },
  { item: 'iron_bar',    minLvl: 1  },
  { item: 'wiring_loom', minLvl: 6  },
  { item: 'steel_bar',   minLvl: 10 },
  { item: 'gearbox',     minLvl: 14 },
  { item: 'alu_ingot',   minLvl: 20 },
  { item: 'chassis',     minLvl: 26 },
  { item: 'tech_alloy',  minLvl: 40 },
  { item: 'servo_unit',  minLvl: 46 },
];
