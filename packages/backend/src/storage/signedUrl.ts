import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(key: string, expiresAt: number, secretHex: string): string {
  const hmac = createHmac('sha256', Buffer.from(secretHex, 'hex'));
  hmac.update(`${key}:${expiresAt}`);
  return hmac.digest('base64url');
}

export function verify(key: string, expiresAt: number, signature: string, secretHex: string): boolean {
  if (Date.now() > expiresAt) return false;
  const expected = Buffer.from(sign(key, expiresAt, secretHex));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
