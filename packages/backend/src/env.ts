function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  // Vercel injecte VERCEL_URL (host seul, sans protocole, toujours https)
  // automatiquement à chaque déploiement — évite de devoir mettre à jour
  // PUBLIC_BACKEND_URL à la main après chaque déploiement/URL de preview.
  publicBackendUrl:
    process.env.PUBLIC_BACKEND_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT ?? 8787}`),

  google: {
    get clientId() {
      return required('GOOGLE_CLIENT_ID');
    },
    get clientSecret() {
      return required('GOOGLE_CLIENT_SECRET');
    },
    get redirectUri() {
      return required('GOOGLE_REDIRECT_URI');
    },
    // Spec §5.2 — scopes minimaux. N'ajoute jamais `drive` / `drive.readonly` ici.
    // `userinfo.email` est un scope non sensible (pas de revue Google
    // requise) : sert uniquement à afficher le compte connecté dans la
    // modale Settings du plugin (audit 2026-08, section Compte).
    scopes: [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  },

  get sessionEncryptionKey() {
    // 32 bytes hex-encoded for AES-256-GCM (spec §5.2 — refresh token chiffré au repos).
    return required('SESSION_ENCRYPTION_KEY');
  },

  assets: {
    driver: (process.env.ASSET_STORAGE_DRIVER ?? 'local-disk') as 'local-disk' | 's3' | 'vercel-blob',
    ttlMs: Number(process.env.ASSET_TTL_MS ?? 15 * 60 * 1000),
    localDir: process.env.ASSET_LOCAL_DIR ?? '.data/assets',
  },

  // Driver `s3` — testé contre Cloudflare R2 (compatible API S3, egress
  // gratuit). `region` vaut toujours 'auto' pour R2. `publicBaseUrl` est le
  // domaine servant le contenu du bucket publiquement (dev URL r2.dev ou
  // domaine custom) — voir .env.example pour la procédure de setup R2.
  s3: {
    get endpoint() {
      return required('S3_ENDPOINT');
    },
    get bucket() {
      return required('S3_BUCKET');
    },
    get accessKeyId() {
      return required('S3_ACCESS_KEY_ID');
    },
    get secretAccessKey() {
      return required('S3_SECRET_ACCESS_KEY');
    },
    get publicBaseUrl() {
      return required('S3_PUBLIC_BASE_URL');
    },
    region: process.env.S3_REGION ?? 'auto',
  },

  allowedOrigins: (process.env.PLUGIN_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
};
