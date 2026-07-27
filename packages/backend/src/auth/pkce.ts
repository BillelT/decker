import { createHash, randomBytes } from 'node:crypto';

/** Spec §5.2 — Authorization Code + PKCE. */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function deriveCodeChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
