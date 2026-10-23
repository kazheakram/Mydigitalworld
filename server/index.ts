import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(root, 'data'));
const { app } = createApp({ dataDir, production, ownerPassword: process.env.OWNER_PASSWORD });

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  // Single-page app: every non-API path returns index.html so deep links work.
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`  ♡ Ribbonmere is awake on http://localhost:${port}${fs.existsSync(dist) ? '' : '  (API only — run "npm run dev" for the site)'}`);
  console.log(`    data folder: ${dataDir}`);
});
