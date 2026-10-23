import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DB } from './db';

// Single-owner authentication: one password (scrypt-hashed), random session tokens stored
// hashed in the database, delivered as an HttpOnly cookie.

const COOKIE = 'rm_session';
const SESSION_DAYS = 30;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

export function getMeta(db: DB, key: string): string | undefined {
  return (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as any)?.value;
}
export function setMeta(db: DB, key: string, value: string) {
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSession(db: DB, res: Response, secure: boolean) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  db.prepare('INSERT INTO sessions(token_hash, expires_at) VALUES(?, ?)').run(sha(token), expires);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}
export function destroySession(db: DB, req: Request, res: Response) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}
export function isOwner(db: DB, req: Request): boolean {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(sha(token)) as any;
  return !!row && row.expires_at > Date.now();
}

/** Simple in-memory fixed-window limiter, keyed by IP and purpose. */
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
  h.n++;
  return h.n <= max;
}

export const requireOwner = (db: DB) => (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).owner) return next();
  res.status(401).json({ error: 'Only the owner of this world can do that. Please sign in.' });
};
