import type { ThemeTokens } from './types';

// Centralised design tokens. Every colour and font in the app comes from one of these
// presets (or a custom theme the owner saves in the Atelier). Nothing else hardcodes colours.

const baseFonts = {
  display: 'Cormorant Garamond',
  body: 'Lora',
  pixel: 'Pixelify Sans',
  script: 'Pinyon Script',
};

export const COQUETTE: ThemeTokens = {
  id: 'coquette',
  name: 'Ribbonmere Coquette',
  colors: {
    bg: '#f6e9e4',
    paper: '#fffaf5',
    ink: '#4a2e35',
    inkSoft: '#7d5a62',
    pink: '#f4c6d0',
    blush: '#f9dfe3',
    rose: '#c98694',
    roseDeep: '#9c5465',
    cream: '#fbf1e2',
    gold: '#c9a36a',
    sage: '#b9c9a8',
    sageDeep: '#7f9a74',
    sky: '#f8d9d0',
    skyTop: '#e9c6d6',
    water: '#a9c4cf',
    path: '#efe0cf',
    roof: '#d88f9d',
    wall: '#fff3ec',
    trim: '#ffffff',
    window: '#ffe8b8',
    accent: '#a7bccd',
    focus: '#8a4fff',
  },
  fonts: baseFonts,
  sizes: { base: 17, scale: 1.25 },
  radius: 14,
  frame: 'lace',
  button: 'pill',
  texture: 'gingham',
  shadow: 0.5,
  animation: 1,
  cursor: 'heart',
  hover: 'lift',
  season: 'petals',
};

export const PRESET_THEMES: ThemeTokens[] = [
  COQUETTE,
  {
    ...COQUETTE,
    id: 'spring-rose',
    name: 'Spring Rose Garden',
    colors: {
      ...COQUETTE.colors,
      bg: '#f3efe2', sage: '#bfd6a0', sageDeep: '#7fa66a', roof: '#e59aa8', pink: '#f7c9d4',
      sky: '#fbe7d6', skyTop: '#d9e8f0', water: '#9fc9d8', accent: '#e8b8c8',
    },
    texture: 'florals',
    season: 'petals',
  },
  {
    ...COQUETTE,
    id: 'autumn-cottage',
    name: 'Autumn Cottage',
    colors: {
      ...COQUETTE.colors,
      bg: '#efe1cf', paper: '#fdf6ec', ink: '#47302a', inkSoft: '#7a5a4c', pink: '#e8b8a6',
      blush: '#f2d6c6', rose: '#b86f5e', roseDeep: '#8a4536', sage: '#c9b98a', sageDeep: '#8f8152',
      sky: '#f2cfa8', skyTop: '#e3b89a', roof: '#b9705c', wall: '#fbeee0', window: '#ffd58a',
      path: '#e6d2b5', gold: '#c48a3f', accent: '#a5845f',
    },
    fonts: { ...baseFonts, display: 'IM Fell English', body: 'Lora' },
    texture: 'gingham',
    season: 'leaves',
  },
  {
    ...COQUETTE,
    id: 'winter-sugarplum',
    name: 'Winter Sugarplum',
    colors: {
      ...COQUETTE.colors,
      bg: '#eef0f6', paper: '#fdfcff', ink: '#3b3350', inkSoft: '#6a6283', pink: '#e7cde6',
      blush: '#f2e3f1', rose: '#a98bb8', roseDeep: '#76598a', sage: '#e6ebf0', sageDeep: '#a9b8c6',
      sky: '#e9e6f4', skyTop: '#cfd6ea', water: '#c4d6e6', roof: '#b99ac7', wall: '#ffffff',
      window: '#fff1c9', path: '#f7f7fb', gold: '#b6a2c9', accent: '#9fb3d1',
    },
    texture: 'stars',
    season: 'snow',
  },
  {
    ...COQUETTE,
    id: 'vintage-valentine',
    name: 'Vintage Valentine',
    colors: {
      ...COQUETTE.colors,
      bg: '#f4e4dc', paper: '#fff8f1', ink: '#4d1f2a', inkSoft: '#82444f', pink: '#eeb1bd',
      blush: '#f7d5d9', rose: '#b5485d', roseDeep: '#7e2638', roof: '#c2566b', wall: '#fff1ea',
      gold: '#c69a5b', accent: '#d9a0a8',
    },
    fonts: { ...baseFonts, display: 'Playfair Display', script: 'Pinyon Script' },
    texture: 'lace',
    season: 'hearts',
  },
  {
    ...COQUETTE,
    id: 'midnight-fairytale',
    name: 'Midnight Fairytale',
    colors: {
      ...COQUETTE.colors,
      bg: '#211b2e', paper: '#2d2540', ink: '#f6e6ee', inkSoft: '#cdb6c8', pink: '#e2a6bf',
      blush: '#4a3a5c', rose: '#d993ae', roseDeep: '#f2bfd2', cream: '#3a2f4f', gold: '#e3c486',
      sage: '#3e4a5a', sageDeep: '#2c3644', sky: '#3a3157', skyTop: '#1b1730', water: '#4a5f7a',
      path: '#5b5070', roof: '#8e5a7c', wall: '#e8d8e4', trim: '#f5e9f1', window: '#ffd27a',
      accent: '#8fa6cf', focus: '#ffd27a',
    },
    texture: 'stars',
    season: 'fireflies',
  },
];

export const FONT_CHOICES = [
  'Cormorant Garamond', 'Playfair Display', 'IM Fell English', 'Lora', 'EB Garamond',
  'Pinyon Script', 'Dancing Script', 'Pixelify Sans', 'VT323', 'Silkscreen', 'Georgia',
];
