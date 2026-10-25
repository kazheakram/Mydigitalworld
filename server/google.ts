import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { GoogleConfig } from '../shared/googleServer';

// Google settings for the home server, read from the environment (see the Owner's Guide).
// The token-encryption secret is GOOGLE_TOKEN_SECRET, or a random key kept beside the database.

export function googleConfigFromEnv(env: NodeJS.ProcessEnv, dataDir: string): GoogleConfig {
  let secret = env.GOOGLE_TOKEN_SECRET?.trim();
  if (!secret) {
    const file = path.join(dataDir, 'google.key');
    try { secret = fs.readFileSync(file, 'utf8').trim(); } catch { /* first run */ }
    if (!secret) {
      secret = crypto.randomBytes(32).toString('base64url');
      fs.writeFileSync(file, secret, { mode: 0o600 });
    }
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID?.trim() || undefined,
    clientSecret: env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
    apiKey: env.GOOGLE_API_KEY?.trim() || undefined,
    appId: env.GOOGLE_APP_ID?.trim() || undefined,
    redirectUri: env.GOOGLE_REDIRECT_URI?.trim() || undefined,
    secret,
    authUrl: env.GOOGLE_TEST_AUTH_URL, tokenUrl: env.GOOGLE_TEST_TOKEN_URL, revokeUrl: env.GOOGLE_TEST_REVOKE_URL,
    sheetsBase: env.GOOGLE_TEST_API_BASE, driveBase: env.GOOGLE_TEST_API_BASE,
  };
}
