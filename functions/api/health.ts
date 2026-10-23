import { type Env, json, settings } from '../_lib/env';

// A setup checklist the website shows on its setup page. Reveals only yes/no, never secret values.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const s = settings(env);
  return json({
    functions: true,
    firebaseConfig: !!s.projectId,
    projectId: s.projectId,
    ownerConfigured: !!s.ownerUid,
    mediaStorage: !!env.MEDIA,
    mediaSecret: !!env.MEDIA_SECRET && env.MEDIA_SECRET.length >= 24,
    emulator: env.AUTH_EMULATOR === '1',
  });
};
