export interface Appearance {
  skin:      string;
  hair:      string;
  shirt:     string;
  trousers:  string;
  hairStyle: number;
  hat:       string;
  hatColor:  string;
}

export const DEFAULT_APPEARANCE: Appearance = {
  skin:      '#f2c49a',
  hair:      '#6a4a2f',
  shirt:     '#ff8a5c',
  trousers:  '#4a5a8a',
  hairStyle: 0,
  hat:       'none',
  hatColor:  '#2a1a0a',
};

export const SKIN_TONES = [
  { label: 'Fair',   v: '#f2c49a' },
  { label: 'Light',  v: '#e8a87c' },
  { label: 'Medium', v: '#c8814a' },
  { label: 'Tan',    v: '#a06030' },
  { label: 'Deep',   v: '#6b3a22' },
  { label: 'Dark',   v: '#4a2515' },
];

export const HAIR_COLOURS = [
  { label: 'Chestnut', v: '#6a4a2f' },
  { label: 'Blonde',   v: '#e8c860' },
  { label: 'Ginger',   v: '#c84820' },
  { label: 'Raven',    v: '#17161a' },
  { label: 'Silver',   v: '#b0aab8' },
  { label: 'White',    v: '#f2f0f8' },
  { label: 'Teal',     v: '#2a8a9a' },
  { label: 'Rose',     v: '#d04080' },
];

export const SHIRT_COLOURS = [
  { label: 'Coral',   v: '#ff8a5c' },
  { label: 'Sky',     v: '#6fb7d9' },
  { label: 'Mint',    v: '#3aa66a' },
  { label: 'Amber',   v: '#e8961e' },
  { label: 'Plum',    v: '#8a4a8a' },
  { label: 'Crimson', v: '#c04040' },
  { label: 'Slate',   v: '#5a6a7a' },
  { label: 'Cream',   v: '#f2e8d0' },
  { label: 'Forest',  v: '#2a5a2a' },
  { label: 'Lemon',   v: '#d8c020' },
  { label: 'Rose',    v: '#d06070' },
  { label: 'Lavender',v: '#8070c0' },
];

export const TROUSER_COLOURS = [
  { label: 'Navy',  v: '#4a5a8a' },
  { label: 'Olive', v: '#5a6a30' },
  { label: 'Brown', v: '#7a5a3a' },
  { label: 'Black', v: '#2a2a32' },
  { label: 'Grey',  v: '#7a7a8a' },
  { label: 'Khaki', v: '#a09a6a' },
];

export const HAT_STYLES = [
  { label: 'None',     v: 'none'     },
  { label: 'Flat Cap', v: 'flat_cap' },
  { label: 'Beanie',   v: 'beanie'   },
  { label: 'Sun Hat',  v: 'sun_hat'  },
];

export const HAT_COLOURS = [
  { label: 'Dark',  v: '#2a1a0a' },
  { label: 'Navy',  v: '#1a2a5a' },
  { label: 'Olive', v: '#4a5a20' },
  { label: 'Rust',  v: '#8a3010' },
  { label: 'Cream', v: '#e8d8b0' },
  { label: 'Grey',  v: '#6a6a7a' },
];
