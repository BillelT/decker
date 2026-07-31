import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Spec §5.2 — refresh token chiffré au repos (AES-256-GCM, clé en variable
 * d'environnement). Le client ne reçoit jamais ce token en clair.
 */
export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('SESSION_ENCRYPTION_KEY must be 32 bytes hex-encoded (64 hex chars)');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
