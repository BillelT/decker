#!/usr/bin/env node
import 'dotenv/config';

/**
 * Spike (script jetable, PAS un module testé/maintenu) pour vérifier deux
 * hypothèses issues de l'audit 2026-08 sur le mode template, contredisant ce
 * que documentait jusqu'ici LIMITATIONS.md :
 *
 * 1. `PageProperties.colorScheme` EST modifiable en écriture via
 *    `UpdatePagePropertiesRequest`, mais uniquement en ciblant la page
 *    `Master` de la présentation, avec les 12 premiers `ThemeColorType`
 *    fournis d'un coup (confirmé sur le schéma officiel de l'API, pas testé
 *    en conditions réelles avant ce script).
 * 2. Un élément posé directement sur cette page Master devrait s'hériter
 *    automatiquement sur toute slide qui référence un Layout descendant de
 *    ce Master (comportement standard du modèle Page → Layout → Master de
 *    l'API, mais jamais vérifié ici avec un vrai rendu Slides).
 *
 * Si les deux tiennent, le mode template peut écrire un vrai thème Slides
 * (couleurs liées via `themeColor`, logo/footer posés une seule fois sur le
 * Master) plutôt que des aplats RGB statiques dupliqués sur chaque slide.
 *
 * Usage : F2S_SESSION_TOKEN=<access_token_google> npm run spike:theme --workspace packages/backend
 * (voir le message d'aide plus bas pour obtenir ce token)
 */

const API_BASE = 'https://slides.googleapis.com/v1';

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/**
 * Couleurs délibérément improbables dans un thème Slides par défaut (qui
 * reste sur des bleus/gris sourds) — si elles apparaissent telles quelles,
 * ça ne peut être que notre écriture, pas une coïncidence avec le thème
 * de base.
 */
const TEST_COLORS: Record<string, string> = {
  DARK1: '#1A1A2E',
  LIGHT1: '#FFFFFF',
  DARK2: '#16213E',
  LIGHT2: '#F5F5F5',
  ACCENT1: '#FF6B00',
  ACCENT2: '#00B4D8',
  ACCENT3: '#7B2CBF',
  ACCENT4: '#06D6A0',
  ACCENT5: '#FFD60A',
  ACCENT6: '#EF476F',
  HYPERLINK: '#1B9AAA',
  FOLLOWED_HYPERLINK: '#6A4C93',
};

function hexToRgb(hex: string): RgbColor {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

async function callApi<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(`Slides API ${res.status} sur ${path} — ${JSON.stringify(body)}`);
  }
  return body as T;
}

interface PresentationSummary {
  presentationId: string;
  slides: { objectId: string }[];
  masters: { objectId: string; pageProperties?: { colorScheme?: { colors: { type: string; color: RgbColor }[] } } }[];
  layouts: { objectId: string; layoutProperties?: { displayName?: string } }[];
}

async function main(): Promise<void> {
  const token = process.env.F2S_SESSION_TOKEN;
  if (!token) {
    printMissingCredentialsHelp();
    process.exitCode = 1;
    return;
  }

  console.log('1/6 — Création de la présentation de test...');
  const created = await callApi<{ presentationId: string; slides: { objectId: string }[] }>(token, '/presentations', {
    method: 'POST',
    body: JSON.stringify({ title: 'F2S — spike thème & master (jetable, à supprimer après test)' }),
  });
  const presentationId = created.presentationId;

  console.log('2/6 — Lecture de la structure (masters/layouts)...');
  const before = await callApi<PresentationSummary>(token, `/presentations/${presentationId}`);
  const masterId = before.masters[0]?.objectId;
  const layout = before.layouts[0];
  if (!masterId || !layout) {
    throw new Error('Présentation créée sans master/layout — impossible de continuer le spike.');
  }
  console.log(`   master=${masterId} layout=${layout.objectId} (${layout.layoutProperties?.displayName ?? 'sans nom'})`);

  console.log('3/6 — Écriture des 12 couleurs de thème sur le Master...');
  await callApi(token, `/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updatePageProperties: {
            objectId: masterId,
            pageProperties: {
              colorScheme: {
                colors: Object.entries(TEST_COLORS).map(([type, hex]) => ({ type, color: hexToRgb(hex) })),
              },
            },
            fields: 'colorScheme',
          },
        },
      ],
    }),
  });

  console.log("4/6 — Ajout d'un élément témoin directement sur le Master (test d'héritage)...");
  await callApi(token, `/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          createShape: {
            objectId: 'f2sMasterTestShape',
            shapeType: 'RECTANGLE',
            elementProperties: {
              pageObjectId: masterId,
              size: { width: { magnitude: 260, unit: 'PT' }, height: { magnitude: 26, unit: 'PT' } },
              transform: { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: 20, translateY: 20, unit: 'PT' },
            },
          },
        },
        {
          updateShapeProperties: {
            objectId: 'f2sMasterTestShape',
            shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: hexToRgb('#FF00FF') } } } },
            fields: 'shapeBackgroundFill.solidFill.color',
          },
        },
        { insertText: { objectId: 'f2sMasterTestShape', text: 'F2S MASTER TEST — visible partout ?', insertionIndex: 0 } },
      ],
    }),
  });

  console.log("5/6 — Création d'une slide référençant ce layout, avec une forme + un texte liés au thème...");
  await callApi(token, `/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          createSlide: {
            objectId: 'f2sTestSlide',
            insertionIndex: 1,
            slideLayoutReference: { layoutId: layout.objectId },
          },
        },
        {
          createShape: {
            objectId: 'f2sThemeBoundShape',
            shapeType: 'RECTANGLE',
            elementProperties: {
              pageObjectId: 'f2sTestSlide',
              size: { width: { magnitude: 320, unit: 'PT' }, height: { magnitude: 100, unit: 'PT' } },
              transform: { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: 100, translateY: 150, unit: 'PT' },
            },
          },
        },
        {
          updateShapeProperties: {
            objectId: 'f2sThemeBoundShape',
            shapeProperties: { shapeBackgroundFill: { solidFill: { color: { themeColor: 'ACCENT1' } } } },
            fields: 'shapeBackgroundFill.solidFill.color',
          },
        },
        { insertText: { objectId: 'f2sThemeBoundShape', text: 'Liée à ACCENT1 (fond) / ACCENT2 (texte)', insertionIndex: 0 } },
        {
          updateTextStyle: {
            objectId: 'f2sThemeBoundShape',
            textRange: { type: 'ALL' },
            style: { foregroundColor: { opaqueColor: { themeColor: 'ACCENT2' } } },
            fields: 'foregroundColor',
          },
        },
      ],
    }),
  });

  console.log('6/6 — Vérification automatique (relecture de la présentation)...');
  const after = await callApi<PresentationSummary>(token, `/presentations/${presentationId}`);
  const masterAfter = after.masters.find((m) => m.objectId === masterId);
  const accent1 = masterAfter?.pageProperties?.colorScheme?.colors.find((c) => c.type === 'ACCENT1');
  console.log(
    '   ColorScheme relu sur le Master → ACCENT1 =',
    accent1 ? JSON.stringify(accent1.color) + (Math.abs(accent1.color.red - hexToRgb('#FF6B00').red) < 0.01 ? ' ✅ correspond' : ' ⚠️ différent de ce qu\'on a envoyé') : '❌ ABSENT — écriture refusée ou ignorée',
  );

  const url = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  console.log(`\nPrésentation créée : ${url}`);
  console.log(`
Checklist à vérifier à l'oeil dans Slides (voir aussi le message renvoyé à l'utilisateur) :
  1. Ouvrir l'URL ci-dessus.
  2. Sur la 2e slide : le bandeau magenta "F2S MASTER TEST" (posé UNIQUEMENT sur le
     Master, jamais sur cette slide) apparaît-il en haut à gauche ?
     → confirme l'héritage Master → Layout → Slide.
  3. Sur cette même slide : le grand rectangle est-il ORANGE (#FF6B00) avec un
     texte CYAN (#00B4D8) ?
     → confirme le binding themeColor (fill ET texte).
  4. Menu "Diapositive > Modifier le thème" : les 12 couleurs custom
     apparaissent-elles déjà dans l'éditeur au lieu du thème par défaut ?
  5. Changer "Accent 1" à la main dans cet éditeur : le rectangle de l'étape 3
     se recolore-t-il EN DIRECT ?

Présentation jetable — à supprimer de Google Drive une fois le test terminé.
`);
}

function printMissingCredentialsHelp(): void {
  console.error(`
Ce spike a besoin d'un vrai access token Google (PAS le token de session du
plugin, qui est un identifiant interne à ce backend — voir
packages/backend/src/auth/getAccessToken.ts) avec les scopes :
  - https://www.googleapis.com/auth/presentations
  - https://www.googleapis.com/auth/drive.file (pas strictement nécessaire
    pour ce spike précis, qui ne crée aucune image)

Façon la plus rapide de l'obtenir, sans rien lancer en local :
  1. Ouvrir https://developers.google.com/oauthplayground
  2. Dans la liste à gauche (ou le champ en bas "Input your own scopes"),
     ajouter : https://www.googleapis.com/auth/presentations
  3. "Authorize APIs" → se connecter avec le compte Google à tester → autoriser.
  4. "Exchange authorization code for tokens" → copier la valeur "Access token"
     (valide ~1h).
  5. Relancer avec :
       F2S_SESSION_TOKEN=<access_token> npm run spike:theme --workspace packages/backend
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
