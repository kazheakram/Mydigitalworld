/// <reference types="@cloudflare/workers-types" />
import { parseFirebaseConfig, isValidUid } from '../../shared/firebaseConfig';

export interface Env {
  /** The Firebase web config (JSON or the console snippet). Same variable the website build uses. */
  VITE_FIREBASE_CONFIG?: string;
  /** Your Firebase user ID — the owner. */
  VITE_OWNER_UID?: string;
  /** A long random secret used to sign the private-image cookie. */
  MEDIA_SECRET?: string;
  /** Workers KV namespace for images. */
  MEDIA?: KVNamespace;
  /** Only for local tests with the Firebase emulator. Never set this in production. */
  AUTH_EMULATOR?: string;
  /** Only for local tests: lets the feed fetcher reach localhost fixtures. */
  ALLOW_PRIVATE_FETCH?: string;
  /** Book Tracker (Google Sheets) — all optional; see the Owner's Guide. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_APP_ID?: string;
  GOOGLE_REDIRECT_URI?: string;
  /** Encrypts the stored Google token (falls back to MEDIA_SECRET). */
  GOOGLE_TOKEN_SECRET?: string;
  /** Only for local tests against a fake Google. Never set these in production. */
  GOOGLE_TEST_AUTH_URL?: string;
  GOOGLE_TEST_TOKEN_URL?: string;
  GOOGLE_TEST_REVOKE_URL?: string;
  GOOGLE_TEST_API_BASE?: string;
}

export function settings(env: Env) {
  const fb = parseFirebaseConfig(env.VITE_FIREBASE_CONFIG);
  const owner = env.VITE_OWNER_UID?.trim();
  return { projectId: fb?.projectId ?? null, ownerUid: isValidUid(owner) ? owner! : null };
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (status: number, error: string) => json({ error }, status);
