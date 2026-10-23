import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, connectAuthEmulator, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, type Auth } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG, USE_EMULATORS } from './config';
import { reportError } from './sync';

// Starts Firebase once. Firestore keeps an offline copy in the browser (IndexedDB), so the owner's
// edits are saved on the device immediately and synced to every other device when online.

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function firebase() {
  if (!FIREBASE_CONFIG) throw new Error('Firebase is not connected yet. Add VITE_FIREBASE_CONFIG in Cloudflare Pages (see the setup guide).');
  if (!app) {
    app = initializeApp(FIREBASE_CONFIG);
    _auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] });
    try {
      _db = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Private windows and some browsers forbid IndexedDB — fall back to memory (still syncs, no offline copy).
      _db = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: memoryLocalCache() });
      reportError('This browser blocked offline storage, so changes only save while you are online.');
    }
    if (USE_EMULATORS) {
      connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(_db, '127.0.0.1', 8080);
    }
  }
  return { app: app!, auth: _auth!, db: _db! };
}

/** Call one of the site's Cloudflare functions with the owner's sign-in attached. */
export async function cloud(path: string, init: RequestInit = {}): Promise<Response> {
  const { auth } = firebase();
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new Error("Can't reach the Ribbonmere functions — are you offline?");
  }
  if (res.status === 404 && path.startsWith('/api/') && !(res.headers.get('content-type') ?? '').includes('json')) {
    throw new Error('The Cloudflare functions are not deployed (the /functions folder must be part of the Pages project).');
  }
  return res;
}

export async function cloudJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await cloud(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error ?? `Request failed (${res.status}).`), { status: res.status });
  return data as T;
}
