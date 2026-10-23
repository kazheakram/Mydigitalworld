/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_BACKEND: 'server' | 'firebase';
  readonly VITE_FIREBASE_CONFIG?: string;
  readonly VITE_OWNER_UID?: string;
  readonly VITE_USE_EMULATORS?: string;
}
declare module '*.rules?raw' { const s: string; export default s; }
