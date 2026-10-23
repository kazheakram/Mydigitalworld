// Reads the Firebase web config from one environment variable. It accepts either JSON or the
// `const firebaseConfig = { apiKey: "…", … };` snippet copied straight from the Firebase console.
export interface FirebaseWebConfig { apiKey: string; authDomain: string; projectId: string; appId: string; storageBucket?: string; messagingSenderId?: string }

export function parseFirebaseConfig(raw: string | undefined | null): FirebaseWebConfig | null {
  if (!raw || !raw.trim()) return null;
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g)) out[m[1]] = m[2];
  if (!out.apiKey || !out.projectId) return null;
  return {
    apiKey: out.apiKey, projectId: out.projectId, appId: out.appId ?? '',
    authDomain: out.authDomain ?? `${out.projectId}.firebaseapp.com`,
    storageBucket: out.storageBucket, messagingSenderId: out.messagingSenderId,
  };
}

/** Firebase user IDs are letters and digits (the rules check the same shape). */
export const isValidUid = (uid: string | undefined | null) => !!uid && /^[A-Za-z0-9]{10,128}$/.test(uid.trim());
