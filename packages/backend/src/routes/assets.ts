import { Router } from 'express';
import multer from 'multer';
import { getAssetStore, LocalDiskAssetStore } from '../storage/index.js';
import { verify } from '../storage/signedUrl.js';
import { env } from '../env.js';

export const assetsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * Spec §5: POST /assets → reçoit les PNG, renvoie des URLs publiques
 * signées (TTL 15 min). Accepte plusieurs fichiers en une requête pour
 * limiter les allers-retours sur un export multi-frames.
 *
 * `upload.any()` plutôt que `upload.array('files')` : le plugin envoie
 * chaque fichier sous le nom de champ = son `assetKey` (même convention que
 * POST /export) pour que la clé soit préservée telle quelle côté store et
 * puisse être re-référencée par un futur POST /export sans avoir à faire
 * l'aller-retour de mapping ci-dessous. Le champ générique `files` reste
 * accepté pour compat (clé auto-générée).
 */
assetsRouter.post('/assets', upload.any(), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'no_files' });
    return;
  }

  const store = getAssetStore();
  const results: { assetKey: string; url: string }[] = [];

  for (const file of files) {
    // Spec §2.3 — PNG/JPEG/GIF uniquement, < 50 Mo, < 25 mégapixels
    // (la contrainte mégapixels est vérifiée côté plugin avant upload,
    // au moment du raster — cf. packages/plugin).
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.mimetype)) {
      res.status(415).json({ error: 'unsupported_media_type', file: file.originalname });
      return;
    }
    const assetKey = file.fieldname === 'files' ? `${Date.now()}_${file.originalname}` : file.fieldname;
    await store.put(assetKey, file.buffer, file.mimetype);
    const url = await store.getSignedUrl(assetKey);
    results.push({ assetKey, url });
  }

  res.json({ assets: results });
});

/**
 * Route de service locale (driver `local-disk` uniquement) : sert un asset
 * si la signature HMAC est valide et non expirée. En production avec le
 * driver `s3`, cette route n'est jamais atteinte — l'URL signée pointe
 * directement vers le bucket.
 */
assetsRouter.get('/assets/:key', async (req, res) => {
  if (env.assets.driver !== 'local-disk') {
    res.status(404).end();
    return;
  }
  const { key } = req.params;
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig ?? '');

  if (!verify(key, exp, sig, env.sessionEncryptionKey)) {
    res.status(403).json({ error: 'invalid_or_expired_signature' });
    return;
  }

  try {
    const store = getAssetStore() as LocalDiskAssetStore;
    const data = await store.read(key);
    res.setHeader('Cache-Control', 'no-store');
    res.send(data);
  } catch {
    res.status(404).json({ error: 'not_found' });
  }
});
