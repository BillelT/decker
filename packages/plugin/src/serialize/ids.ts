/**
 * Spec §5.4 RÈGLE — objectId générés côté client, `^[a-zA-Z0-9_-]{5,50}$`,
 * préfixés par job pour éviter les collisions : `f2s_<jobId>_<seq>`.
 */
export function createIdGenerator(jobId: string): () => string {
  let seq = 0;
  return () => `f2s_${jobId}_${seq++}`;
}
