// Runs the complete cloud version on your own computer — no accounts needed:
// Firebase emulators (Auth + Firestore with the real security rules) + Cloudflare Pages/Functions/KV
// (wrangler) + the site built for the cloud.   npm run dev:cloud
// Sign in at http://localhost:8899/login with  owner@example.com / ribbonmere-local
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT = 'demo-ribbonmere';
const EMAIL = 'owner@example.com';
const PASSWORD = 'ribbonmere-local';
const procs: ChildProcess[] = [];
const stop = () => { for (const p of procs) { try { process.kill(-p.pid!, 'SIGTERM'); } catch { /* gone */ } } process.exit(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);

function start(cmd: string, args: string[], ready: RegExp, env: Record<string, string> = {}) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  procs.push(p);
  let log = '';
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${cmd} did not start:\n${log.slice(-1500)}`)), 120_000);
    const on = (d: Buffer) => { log += d; if (process.env.VERBOSE) process.stdout.write(d); if (ready.test(log)) { clearTimeout(t); resolve(); } };
    p.stdout!.on('data', on); p.stderr!.on('data', on);
  });
}

console.log('  ♡ starting Firebase emulators…');
await start('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT], /All emulators ready/);
const res = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
})).json();
const OWNER = res.localId;
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}:securityRules`, {
  method: 'PUT', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: fs.readFileSync('firestore.rules', 'utf8').replaceAll('PASTE_YOUR_USER_ID_HERE', OWNER) }] } }),
});
const firebaseConfig = JSON.stringify({ apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:1:web:1' });
console.log('  ♡ building the cloud version…');
execSync('npx vite build --outDir dist-cloud --emptyOutDir', { stdio: 'ignore', env: { ...process.env, VITE_BACKEND: 'firebase', VITE_FIREBASE_CONFIG: firebaseConfig, VITE_OWNER_UID: OWNER, VITE_USE_EMULATORS: '1' } });
console.log('  ♡ starting Cloudflare Pages (wrangler)…');
await start('npx', ['wrangler', 'pages', 'dev', 'dist-cloud', '--port', '8899', '--kv', 'MEDIA', '--persist-to', path.resolve('.wrangler-local'),
  '--compatibility-date=2025-09-01', '--binding', `VITE_FIREBASE_CONFIG=${firebaseConfig}`, '--binding', `VITE_OWNER_UID=${OWNER}`,
  '--binding', 'MEDIA_SECRET=local-development-secret-not-for-production', '--binding', 'AUTH_EMULATOR=1', '--binding', 'ALLOW_PRIVATE_FETCH=1'],
/Ready on/, { WRANGLER_SEND_METRICS: 'false' });
console.log(`\n  ♡ Ribbonmere (cloud version, local) is ready on http://localhost:8899`);
console.log(`    sign in with ${EMAIL} / ${PASSWORD}   ·   data resets when you stop this (Ctrl+C)\n`);
await new Promise(() => {});
