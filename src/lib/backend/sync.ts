import { useSyncExternalStore } from 'react';

// Tracks whether your changes have reached the cloud, so the app can say so honestly:
// "synced", "saving…", "offline — kept on this device", or exactly what went wrong.

export interface SyncState { online: boolean; pending: number; error: string | null; lastSynced: number | null }
let state: SyncState = { online: typeof navigator === 'undefined' ? true : navigator.onLine, pending: 0, error: null, lastSynced: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<SyncState>) => { state = { ...state, ...patch }; emit(); };

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
  // Leaving while a change is still on its way to the cloud could lose it — ask first.
  window.addEventListener('beforeunload', (e) => {
    if (state.pending > 0 && state.online) { e.preventDefault(); e.returnValue = ''; }
  });
}

export function friendlyError(e: any): string {
  const code = String(e?.code ?? '').replace(/^(firestore|auth)\//, '');
  switch (code) {
    case 'permission-denied':
      return 'The cloud refused this change. If you have just set Ribbonmere up, check that your security rules contain your user ID (see the Setup page).';
    case 'resource-exhausted':
      return "Today's free Firebase allowance is used up, so this change couldn't be saved. It resets every day at midnight Pacific time — please try again then.";
    case 'unauthenticated': case 'user-token-expired':
      return 'Your sign-in has expired. Please sign in again.';
    case 'unavailable': case 'network-request-failed':
      return "Can't reach the cloud right now. Changes are kept on this device and will sync when you're back online.";
    case 'invalid-credential': case 'wrong-password': case 'user-not-found': case 'invalid-login-credentials':
      return 'That email and password don’t match.';
    case 'email-already-in-use': return 'An account with that email already exists — sign in instead.';
    case 'weak-password': return 'Please choose a password of at least 8 characters.';
    case 'too-many-requests': return 'Too many attempts. Please wait a few minutes.';
    case 'invalid-email': return 'That email address looks incomplete.';
    case 'failed-precondition': return 'This browser blocked offline storage (private window?). Ribbonmere still works, but changes sync only while you are online.';
    default: return e?.message ? String(e.message) : 'Something went wrong while syncing.';
  }
}

/** Watch a cloud write: counts it as pending until Google confirms it, and reports failures. */
export function track<T>(p: Promise<T>, what = 'change'): Promise<T> {
  set({ pending: state.pending + 1 });
  p.then(
    () => set({ pending: Math.max(0, state.pending - 1), lastSynced: Date.now(), error: null }),
    (e) => {
      const msg = friendlyError(e);
      set({ pending: Math.max(0, state.pending - 1), error: msg });
      window.dispatchEvent(new CustomEvent('rm-sync-error', { detail: `Your ${what} wasn't saved to the cloud. ${msg}` }));
    },
  );
  return p;
}
export const reportError = (msg: string) => set({ error: msg });
export const clearError = () => set({ error: null });
export const getSync = () => state;
export function useSync() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
