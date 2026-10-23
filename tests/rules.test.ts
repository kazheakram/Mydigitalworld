// Firestore security-rule tests. Run with:  npm run test:rules
// (starts the official Firebase emulator locally; no real project or internet account is used)
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc, writeBatch, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';

const OWNER = 'Ow9nerUid0000000000000000000a'; // shaped like a real Firebase user ID
let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ribbonmere',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8').replaceAll('PASTE_YOUR_USER_ID_HERE', OWNER), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

const item = (o: Record<string, any>) => ({ kind: 'book', roomId: 'library', visibility: 'public', data: { title: 't' }, createdAt: 'x', updatedAt: 'x', ...o });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/world_public'), { json: '{}', publicRoomIds: ['library', 'journal', 'secret-garden'], guestbookRoomIds: ['postoffice'] });
    await setDoc(doc(db, 'config/theme_public'), { json: '{}' });
    await setDoc(doc(db, 'config/world_draft'), { json: '{"secret":"unpublished plans"}' });
    await setDoc(doc(db, 'config/world_published'), { json: '{}' });
    await setDoc(doc(db, 'config/theme_draft'), { json: '{}' });
    await setDoc(doc(db, 'versions/v1'), { key: 'world', json: '{}' });
    await setDoc(doc(db, 'items/pub'), item({}));
    await setDoc(doc(db, 'items/priv'), item({ visibility: 'private', data: { title: 'diary' } }));
    await setDoc(doc(db, 'items/unl'), item({ visibility: 'unlisted', roomId: 'journal', kind: 'entry' }));
    await setDoc(doc(db, 'items/inPrivateRoom'), item({ roomId: 'diary-room' }));
    await setDoc(doc(db, 'items/bm'), item({ kind: 'bookmark', visibility: 'public', roomId: null }));
    await setDoc(doc(db, 'items_private/pub'), { privateNotes: 'only for me' });
    await setDoc(doc(db, 'public_rooms/library'), { json: '[]' });
    await setDoc(doc(db, 'feeds/f1'), { title: 'feed' });
    await setDoc(doc(db, 'media/m1'), { name: 'secret.png', visibility: 'private' });
    await setDoc(doc(db, 'guestbook_pending/g1'), { name: 'a', message: 'hi there' });
  });
});

// Every kind of outsider gets the same treatment: anonymous visitor, a stranger's account, an anonymous-auth guest.
const outsiders = () => [
  ['logged-out visitor', env.unauthenticatedContext().firestore()],
  ['another account', env.authenticatedContext('stranger', { email: 'x@y.z', firebase: { sign_in_provider: 'password' } } as any).firestore()],
  ['anonymous guest', env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } } as any).firestore()],
] as const;

test('outsiders can read only published, public things', async () => {
  for (const [who, db] of outsiders()) {
    await assertSucceeds(getDoc(doc(db, 'config/world_public')));
    await assertSucceeds(getDoc(doc(db, 'config/theme_public')));
    await assertSucceeds(getDoc(doc(db, 'public_rooms/library')));
    await assertSucceeds(getDoc(doc(db, 'items/pub')));
    await assertSucceeds(getDoc(doc(db, 'items/unl')));
    for (const p of ['items/priv', 'items/inPrivateRoom', 'items/bm', 'items_private/pub', 'config/world_draft', 'config/world_published',
      'config/theme_draft', 'versions/v1', 'feeds/f1', 'media/m1', 'guestbook_pending/g1']) {
      await assertFails(getDoc(doc(db, p))).catch(() => assert.fail(`${who} could read ${p}`));
    }
    for (const c of ['items', 'items_private', 'config', 'versions', 'feeds', 'media', 'guestbook_pending', 'public_rooms']) {
      await assertFails(getDocs(collection(db, c))).catch(() => assert.fail(`${who} could list ${c}`));
    }
  }
});

test('outsiders cannot write anything except a guestbook letter', async () => {
  for (const [who, db] of outsiders()) {
    const tries: [string, () => Promise<any>][] = [
      ['create item', () => setDoc(doc(db, 'items/new'), item({}))],
      ['edit item', () => updateDoc(doc(db, 'items/pub'), { 'data.title': 'hacked' })],
      ['delete item', () => deleteDoc(doc(db, 'items/pub'))],
      ['read-modify private notes', () => setDoc(doc(db, 'items_private/pub'), { privateNotes: 'x' })],
      ['publish world', () => setDoc(doc(db, 'config/world_public'), { json: '{}', publicRoomIds: ['everything'] })],
      ['write draft', () => setDoc(doc(db, 'config/world_draft'), { json: '{}' })],
      ['write bundle', () => setDoc(doc(db, 'public_rooms/library'), { json: '[]' })],
      ['write feed', () => setDoc(doc(db, 'feeds/f2'), { title: 'x' })],
      ['write media', () => setDoc(doc(db, 'media/m2'), { name: 'x' })],
      ['write version', () => setDoc(doc(db, 'versions/v2'), { json: '{}' })],
      ['approve own letter', () => setDoc(doc(db, 'items/letter'), item({ kind: 'guestbook', roomId: 'postoffice' }))],
    ];
    for (const [what, fn] of tries) await assertFails(fn()).catch(() => assert.fail(`${who} could ${what}`));
  }
});

test('the owner can do everything, and the rules still guard privacy invariants', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  for (const p of ['items/priv', 'items_private/pub', 'config/world_draft', 'versions/v1', 'feeds/f1', 'media/m1', 'guestbook_pending/g1']) {
    await assertSucceeds(getDoc(doc(db, p))).catch((e) => assert.fail(`owner could not read ${p}: ${e.message.slice(0, 80)}`));
  }
  await assertSucceeds(getDocs(collection(db, 'items')));
  await assertSucceeds(setDoc(doc(db, 'items/new'), item({ visibility: 'private' })));
  await assertSucceeds(setDoc(doc(db, 'config/world_draft'), { json: '{}' }));
  await assertSucceeds(deleteDoc(doc(db, 'guestbook_pending/g1')));
  // Even the owner's app cannot accidentally make a bookmark/letterbox item public…
  await assertFails(setDoc(doc(db, 'items/bm2'), item({ kind: 'bookmark', visibility: 'public', roomId: null })));
  await assertFails(setDoc(doc(db, 'items/in2'), item({ kind: 'inbox', visibility: 'unlisted', roomId: null })));
  // …or put owner-only notes inside a readable document.
  await assertFails(setDoc(doc(db, 'items/b2'), item({ data: { title: 'x', privateNotes: 'oops' } })));
  // …or invent unknown fields/kinds.
  await assertFails(setDoc(doc(db, 'items/b3'), item({ kind: 'weird' })));
  await assertFails(setDoc(doc(db, 'items/b4'), { ...item({}), extra: 1 }));
});

const letter = (uid: string, o: Record<string, any> = {}) => ({ name: 'Rose', message: 'Your village is lovely', stationery: 'rose', roomId: 'postoffice', uid, createdAt: serverTimestamp(), ...o });
async function sendLetter(db: any, uid: string, o: Record<string, any> = {}) {
  const b = writeBatch(db);
  b.set(doc(db, `gb_limits/${uid}`), { last: serverTimestamp() });
  b.set(doc(collection(db, 'guestbook_pending')), letter(uid, o));
  return b.commit();
}

test('guestbook: one valid letter every few minutes, pending until approved', async () => {
  const db = env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } } as any).firestore();
  await assertSucceeds(sendLetter(db, 'anon1'));
  await assertFails(sendLetter(db, 'anon1')); // too soon
  const db2 = env.authenticatedContext('anon2', { firebase: { sign_in_provider: 'anonymous' } } as any).firestore();
  await assertFails(setDoc(doc(collection(db2, 'guestbook_pending')), letter('anon2'))); // without a rate-limit stamp
  await assertFails(sendLetter(db2, 'anon2', { uid: 'someone-else' }));
  await assertFails(sendLetter(db2, 'anon2', { roomId: 'library' })); // not a guestbook room
  await assertFails(sendLetter(db2, 'anon2', { message: 'x'.repeat(1501) }));
  await assertFails(sendLetter(db2, 'anon2', { message: 'http://a http://b http://c spam' }));
  await assertFails(sendLetter(db2, 'anon2', { approved: true }));
  await assertSucceeds(sendLetter(db2, 'anon2'));
  // A stale stamp lets them write again.
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'gb_limits/anon1'), { last: Timestamp.fromMillis(Date.now() - 6 * 60_000) }); });
  await assertSucceeds(sendLetter(db, 'anon1'));
  // Logged-out visitors (no anonymous sign-in) cannot post at all.
  await assertFails(sendLetter(env.unauthenticatedContext().firestore(), 'nobody'));
});

test('making a room private hides its items once published', async () => {
  const visitor = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(visitor, 'items/pub')));
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'config/world_public'), { publicRoomIds: ['journal'] }); });
  await assertFails(getDoc(doc(visitor, 'items/pub')));
});

test('before the owner ID is filled in, nobody has owner powers', async () => {
  const raw = await initializeTestEnvironment({
    projectId: 'demo-ribbonmere-unconfigured',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  try {
    for (const uid of ['someone', 'PASTE_YOUR_USER_ID_HERE']) {
      const db = raw.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, 'items/x'), item({ visibility: 'private' })));
      await assertFails(getDocs(collection(db, 'items')));
      await assertFails(setDoc(doc(db, 'config/world_public'), { json: '{}' }));
    }
  } finally { await raw.cleanup(); }
});
