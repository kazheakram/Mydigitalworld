import type { WorldConfig } from '../../shared/types';
import { featureMode } from '../../shared/features';

// A read-only reference to the current world for code that runs outside React components.
let current: WorldConfig | null = null;
export const setLiveWorld = (w: WorldConfig) => { current = w; };
export const liveFeatureOn = (id: string) => featureMode(current, id) !== 'off';
export const isYoutubeFeed = (url = '') => /youtube\.com\/feeds\//.test(url);
