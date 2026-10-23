import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import rulesTemplate from '../firestore.rules?raw';
import { api } from './lib/api';
import { IS_FIREBASE, FIREBASE_CONFIG, OWNER_UID } from './lib/backend/config';
import { useStore } from './lib/store';
import { TopNav } from './ui/Nav';
import { BowIcon, Loading } from './ui/kit';

// The cloud setup checklist: shows what's connected, what's missing, and the exact values to copy.

interface Health { functions: boolean; firebaseConfig: boolean; projectId: string | null; ownerConfigured: boolean; mediaStorage: boolean; mediaSecret: boolean; emulator?: boolean }

export function SetupPage() {
  const { toast, owner } = useStore();
  const [health, setHealth] = useState<Health | null | 'missing'>(null);
  const [status, setStatus] = useState<{ uid: string | null; email: string | null; signedIn: boolean } | null>(null);
  const [rulesOk, setRulesOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health').then(async (r) => setHealth(r.ok && (r.headers.get('content-type') ?? '').includes('json') ? await r.json() : 'missing')).catch(() => setHealth('missing'));
    if (IS_FIREBASE && FIREBASE_CONFIG) api('GET', '/api/auth/status').then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    // If the owner can read their private draft, the security rules have their user ID.
    if (!owner) return;
    api('GET', '/api/config/world').then((c) => setRulesOk(!!c.draft)).catch(() => setRulesOk(false));
  }, [owner]);

  if (!IS_FIREBASE) {
    return (
      <div className="page"><header className="page-header"><TopNav /></header>
        <main className="page-main narrow"><div className="paper-sheet"><h1 className="script page-title">Cloud setup</h1>
          <p>This copy of Ribbonmere runs on its own home server, so there's nothing to set up here. The cloud version is used automatically when the site is built by Cloudflare Pages.</p></div></main></div>
    );
  }
  const uid = status?.uid ?? null;
  const rules = uid ? rulesTemplate.replaceAll('PASTE_YOUR_USER_ID_HERE', uid) : rulesTemplate;
  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied ♡`), () => toast('Could not copy — select the text and copy it by hand.'));
  const h = health && health !== 'missing' ? health : null;
  const Row = ({ ok, title, children }: { ok: boolean | null; title: string; children?: React.ReactNode }) => (
    <li><span className="setup-mark" aria-label={ok ? 'done' : ok === null ? 'checking' : 'to do'}>{ok ? '✅' : ok === null ? '⏳' : '🎀'}</span>
      <div><strong>{title}</strong>{!ok && children && <div className="muted">{children}</div>}</div></li>
  );

  return (
    <div className="page">
      <header className="page-header"><Link to="/" className="back-link">← the village</Link><TopNav /></header>
      <main className="page-main narrow" id="main">
        <div className="paper-sheet">
          <BowIcon size={50} />
          <h1 className="script page-title">Cloud setup</h1>
          <p className="smallcaps">your checklist · nothing here is secret</p>
          {health === null ? <Loading what="Checking" /> : (
            <ul className="setup-list">
              <Row ok={health !== 'missing' && !!h?.functions} title="Cloudflare functions are running">
                The <code>/functions</code> folder isn't deployed. Make sure the Cloudflare Pages project is connected to this repository (not uploaded by hand), then deploy again.
              </Row>
              <Row ok={!!FIREBASE_CONFIG && !!h?.firebaseConfig} title="Firebase is connected">
                Add <code>VITE_FIREBASE_CONFIG</code> in Cloudflare → your Pages project → Settings → Variables and Secrets, then redeploy (guide step 4).
              </Row>
              <Row ok={!!status?.signedIn} title="You have an owner account">
                <Link to="/login">Create your account</Link> (or sign in) — it only takes an email and a password.
              </Row>
              <Row ok={!!OWNER_UID && !!h?.ownerConfigured && (!uid || uid === OWNER_UID)} title="The site knows you're the owner">
                {uid ? <>Add a variable named <code>VITE_OWNER_UID</code> with this value, then redeploy:
                  <code className="setup-code">{uid}</code><button className="btn small" onClick={() => copy(uid, 'Your user ID')}>Copy my user ID</button>
                  {OWNER_UID && OWNER_UID !== uid && <p className="error-note">The site is set up for a different account ({OWNER_UID.slice(0, 6)}…). Sign in with that account, or change VITE_OWNER_UID.</p>}</>
                  : 'Sign in first, and your user ID will appear here.'}
              </Row>
              <Row ok={rulesOk} title="Firestore security rules contain your user ID">
                {uid ? <>In the Firebase console → Firestore Database → Rules, replace everything with these rules (your ID is already filled in) and press <strong>Publish</strong>:
                  <code className="setup-code">{rules}</code><button className="btn small" onClick={() => copy(rules, 'Security rules')}>Copy the rules</button></> : 'Sign in first.'}
              </Row>
              <Row ok={!!h?.mediaStorage} title="Image storage (Workers KV) is attached">
                In Cloudflare → your Pages project → Settings → Bindings, add a KV namespace binding named <code>MEDIA</code> (guide step 6).
              </Row>
              <Row ok={!!h?.mediaSecret} title="Private-image secret is set">
                Add a secret named <code>MEDIA_SECRET</code> with at least 24 random characters (guide step 6). Here is a fresh one you can use:
                <code className="setup-code">{Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')}</code>
              </Row>
            </ul>
          )}
          {h?.emulator && <p className="error-note">⚠ AUTH_EMULATOR is switched on. That is only for local testing — remove it from your Cloudflare variables.</p>}
          <p className="muted">After changing variables in Cloudflare, go to Deployments → ⋯ → Retry deployment so the site picks them up.</p>
        </div>
      </main>
    </div>
  );
}
