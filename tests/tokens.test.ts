// Unit test of real (RS256) Firebase token verification, using a locally generated key in place of Google's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { verifyIdToken } from '../functions/_lib/auth';

const PROJECT = 'demo-ribbonmere';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload: Record<string, unknown>, kid = 'k1', key = privateKey) {
  const head = `${b64({ alg: 'RS256', kid, typ: 'JWT' })}.${b64(payload)}`;
  return `${head}.${createSign('RSA-SHA256').update(head).sign(key).toString('base64url')}`;
}
const now = Math.floor(Date.now() / 1000);
const good = { aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'Ow9nerUid0000000000000000000a', iat: now, exp: now + 3600 };
const env = { VITE_FIREBASE_CONFIG: JSON.stringify({ apiKey: 'k', projectId: PROJECT }) };

globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=60' } })) as any;

test('accepts a correctly signed token', async () => {
  assert.equal((await verifyIdToken(sign(good), env)).uid, good.sub);
});
test('rejects tampering, wrong keys, wrong project and expiry', async () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyIdToken(sign(good, 'k1', other), env), /Invalid/);
  await assert.rejects(verifyIdToken(sign(good, 'unknown-kid'), env), /Unknown/);
  const t = sign(good).split('.');
  await assert.rejects(verifyIdToken(`${t[0]}.${b64({ ...good, sub: 'attacker' })}.${t[2]}`, env), /Invalid/);
  await assert.rejects(verifyIdToken(sign({ ...good, aud: 'other' }), env), /different project/);
  await assert.rejects(verifyIdToken(sign({ ...good, exp: now - 5 }), env), /expired/);
  // Unsigned emulator-style tokens are refused unless AUTH_EMULATOR=1 is set.
  await assert.rejects(verifyIdToken(`${b64({ alg: 'none' })}.${b64(good)}.`, env), /Unexpected/);
});
