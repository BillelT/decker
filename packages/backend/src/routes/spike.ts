import { Router } from 'express';
import { extractSessionToken } from './auth.js';
import { getValidAccessToken, UnauthenticatedError } from '../auth/getAccessToken.js';
import { runMasterThemeSpike } from '../spikes/masterThemeSpike.js';

export const spikeRouter = Router();

/**
 * Route TEMPORAIRE (audit 2026-08, mode template) — à retirer (avec
 * `spikes/masterThemeSpike.ts` et le bouton "Run theme spike" du plugin)
 * une fois la validation faite. Réutilise la session Google déjà ouverte
 * dans le plugin plutôt que de demander un access token séparé (voir
 * `spikes/masterThemeSpike.ts` pour l'alternative en ligne de commande).
 * Pas de risque au-delà de l'utilisateur courant : crée une présentation
 * jetable dans SON PROPRE Drive, avec son propre quota Slides API.
 */
spikeRouter.post('/spike/theme-test', async (req, res) => {
  const sessionToken = extractSessionToken(req);
  try {
    const accessToken = await getValidAccessToken(sessionToken);
    const result = await runMasterThemeSpike(accessToken);
    res.json(result);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      res.status(401).json({ error: 'unauthenticated', message: err.message });
      return;
    }
    throw err;
  }
});
