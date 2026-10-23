import { parseFirebaseConfig, isValidUid } from '../../../shared/firebaseConfig';

// Which backend this build talks to, and the (public) Firebase settings.
export const BACKEND: 'server' | 'firebase' = import.meta.env.VITE_BACKEND === 'firebase' ? 'firebase' : 'server';
export const IS_FIREBASE = BACKEND === 'firebase';
export const FIREBASE_CONFIG = parseFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG);
const owner = import.meta.env.VITE_OWNER_UID?.trim();
export const OWNER_UID = isValidUid(owner) ? owner! : null;
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === '1';
