/**
 * Spec §5.3 — deux stratégies d'hébergement, dans cet ordre de préférence :
 *  1. Stockage objet + URL signée courte (S3/R2/GCS, TTL 15 min) — RECOMMANDÉ.
 *  2. Fallback : upload sur le Drive de l'utilisateur + permission temporaire.
 * Cette interface découple le reste du backend du choix d'implémentation.
 */
export interface AssetStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  getSignedUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export class AssetNotFoundError extends Error {
  constructor(key: string) {
    super(`Asset not found: ${key}`);
  }
}
