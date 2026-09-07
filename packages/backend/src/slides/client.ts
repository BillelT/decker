import type { RequestBatch, SlidesRequest } from '../mapper/index.js';

const API_BASE = 'https://slides.googleapis.com/v1';
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 32_000;

export class SlidesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

/** Spec §5.4 RÈGLE — backoff exponentiel + jitter, 5 tentatives, base 1s, plafond 32s. */
async function withRetry<T>(fn: () => Promise<T>, isRetryableStatus: (status: number) => boolean): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err instanceof SlidesApiError ? err.status : undefined;
      if (attempt === MAX_ATTEMPTS || status === undefined || !isRetryableStatus(status)) {
        throw err;
      }
      const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
      const jitter = Math.random() * delay * 0.25;
      await sleep(delay + jitter);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      // `body` porte déjà le detail Google (`error.message`), mais rien ne
      // l'incluait dans `.message` — le client ne voyait donc jamais que le
      // code HTTP nu, sans la vraie raison du rejet (ex. quel champ précis
      // d'une requête `createImage`/`createShape` est invalide).
      const detail = (body as { error?: { message?: string } } | undefined)?.error?.message;
      const message = detail ? `Slides API ${res.status} on ${path}: ${detail}` : `Slides API ${res.status} on ${path}`;
      throw new SlidesApiError(message, res.status, body);
    }
    return (await res.json()) as T;
  }, (status) => RETRYABLE_STATUS.has(status));
}

export async function createPresentation(
  accessToken: string,
  title: string,
  pageSizePt?: { widthPt: number; heightPt: number },
): Promise<{ presentationId: string; firstSlideObjectId: string; masterObjectId: string }> {
  // Le pageSize (comme le ratio d'aspect de la présentation entière) ne se
  // règle qu'à la création — la Slides API n'a aucune requête batchUpdate
  // pour le modifier après coup. Sans ça, une frame Figma qui n'est pas en
  // 16:9 (le défaut Slides, 720x405pt) est réduite à l'échelle et
  // centrée dans ce format par `computeScale`, laissant des bandes vides.
  const pageSize = pageSizePt
    ? {
        width: { magnitude: pageSizePt.widthPt, unit: 'PT' },
        height: { magnitude: pageSizePt.heightPt, unit: 'PT' },
      }
    : undefined;
  // `presentations.create` renvoie la ressource `Presentation` complète
  // (masters/layouts inclus, pas juste les slides) — pas besoin d'un
  // second appel `getPresentation` pour récupérer l'id du Master (audit
  // 2026-08, mode template : voir `mapper/theme.ts`).
  const body = await callApi<{ presentationId: string; slides: { objectId: string }[]; masters: { objectId: string }[] }>(
    accessToken,
    '/presentations',
    { method: 'POST', body: JSON.stringify({ title, ...(pageSize ? { pageSize } : {}) }) },
  );
  return { presentationId: body.presentationId, firstSlideObjectId: body.slides[0].objectId, masterObjectId: body.masters[0].objectId };
}

export async function batchUpdate(
  accessToken: string,
  presentationId: string,
  requests: SlidesRequest[],
): Promise<unknown> {
  if (requests.length === 0) return { replies: [] };
  return callApi(accessToken, `/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
}

export async function getPresentation(accessToken: string, presentationId: string): Promise<unknown> {
  return callApi(accessToken, `/presentations/${presentationId}`);
}

export async function getPageThumbnail(
  accessToken: string,
  presentationId: string,
  pageObjectId: string,
): Promise<{ contentUrl: string }> {
  return callApi(
    accessToken,
    `/presentations/${presentationId}/pages/${pageObjectId}/thumbnail?thumbnailProperties.thumbnailSize=LARGE`,
  );
}

/**
 * Applique un ensemble de lots (un par slide, spec §5.4) : chaque lot est un
 * appel `batchUpdate` séparé pour respecter la règle "une slide = un lot
 * minimum indivisible" côté idempotence appelante (voir jobs/runner.ts).
 */
export async function applyBatch(accessToken: string, presentationId: string, batch: RequestBatch): Promise<unknown> {
  return batchUpdate(accessToken, presentationId, batch.requests);
}
