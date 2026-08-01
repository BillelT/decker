#!/usr/bin/env node
import 'dotenv/config';

/**
 * Script de diagnostic ponctuel (PAS un module testé/maintenu, appelé par
 * aucune route ni aucune UI — la route temporaire `routes/spike.ts` et le
 * bouton "Run theme spike" du plugin, utilisés pour la validation initiale,
 * ont été retirés une fois le résultat confirmé). Gardé pour re-tester à la
 * main si besoin (ex. après un changement côté API Google).
 *
 * A confirmé, en conditions réelles (audit 2026-08, captures d'écran à
 * l'appui), deux hypothèses qui contredisaient ce que documentait jusqu'ici
 * LIMITATIONS.md :
 *
 * 1. `PageProperties.colorScheme` EST modifiable en écriture via
 *    `UpdatePagePropertiesRequest`, mais uniquement en ciblant la page
 *    `Master` de la présentation, avec les 12 premiers `ThemeColorType`
 *    fournis d'un coup.
 * 2. Un élément posé directement sur cette page Master s'hérite bien sur
 *    toute slide qui référence un Layout descendant de ce Master.
 *
 * Voir `mapper/theme.ts` pour l'exploitation de ce résultat dans le mapper
 * de production (TODO.md § Mode template, point 1).
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

export interface MasterThemeSpikeResult {
  presentationId: string;
  presentationUrl: string;
  masterId: string;
  layoutId: string;
  layoutName: string;
  colorSchemeWriteConfirmed: boolean;
  writtenAccent1: RgbColor | undefined;
  checklist: string[];
}

const CHECKLIST = [
  'Sur la 2e slide : le bandeau magenta "F2S MASTER TEST" (posé UNIQUEMENT sur le Master, jamais sur cette slide) apparaît-il en haut à gauche ? → confirme l\'héritage Master → Layout → Slide.',
  'Sur cette même slide : le grand rectangle est-il ORANGE (#FF6B00) avec un texte CYAN (#00B4D8) ? → confirme le binding themeColor (fill ET texte).',
  'Menu "Diapositive > Modifier le thème" : les 12 couleurs custom apparaissent-elles déjà dans l\'éditeur au lieu du thème par défaut ?',
  'Changer "Accent 1" à la main dans cet éditeur : le rectangle de l\'étape 2 se recolore-t-il EN DIRECT ?',
];

/** Crée une présentation Slides jetable et exécute les deux vérifications décrites en tête de fichier. */
export async function runMasterThemeSpike(accessToken: string): Promise<MasterThemeSpikeResult> {
  const created = await callApi<{ presentationId: string; slides: { objectId: string }[] }>(accessToken, '/presentations', {
    method: 'POST',
    body: JSON.stringify({ title: 'F2S — spike thème & master (jetable, à supprimer après test)' }),
  });
  const presentationId = created.presentationId;

  const before = await callApi<PresentationSummary>(accessToken, `/presentations/${presentationId}`);
  const masterId = before.masters[0]?.objectId;
  const layout = before.layouts[0];
  if (!masterId || !layout) {
    throw new Error('Présentation créée sans master/layout — impossible de continuer le spike.');
  }

  await callApi(accessToken, `/presentations/${presentationId}:batchUpdate`, {
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

  await callApi(accessToken, `/presentations/${presentationId}:batchUpdate`, {
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

  await callApi(accessToken, `/presentations/${presentationId}:batchUpdate`, {
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

  const after = await callApi<PresentationSummary>(accessToken, `/presentations/${presentationId}`);
  const masterAfter = after.masters.find((m) => m.objectId === masterId);
  const accent1 = masterAfter?.pageProperties?.colorScheme?.colors.find((c) => c.type === 'ACCENT1');
  const expected = hexToRgb('#FF6B00');
  const colorSchemeWriteConfirmed = !!accent1 && Math.abs(accent1.color.red - expected.red) < 0.01;

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    masterId,
    layoutId: layout.objectId,
    layoutName: layout.layoutProperties?.displayName ?? 'sans nom',
    colorSchemeWriteConfirmed,
    writtenAccent1: accent1?.color,
    checklist: CHECKLIST,
  };
}

async function main(): Promise<void> {
  const token = process.env.F2S_SESSION_TOKEN;
  if (!token) {
    printMissingCredentialsHelp();
    process.exitCode = 1;
    return;
  }

  console.log('Création de la présentation de test et écriture du thème...');
  const result = await runMasterThemeSpike(token);

  console.log(
    `\nColorScheme relu sur le Master → ACCENT1 = ${result.writtenAccent1 ? JSON.stringify(result.writtenAccent1) : 'ABSENT'} ` +
      (result.colorSchemeWriteConfirmed ? '✅ correspond' : '⚠️ ne correspond pas à ce qui a été envoyé'),
  );
  console.log(`\nPrésentation créée : ${result.presentationUrl}`);
  console.log('\nCheckilst à vérifier à l\'oeil dans Slides :');
  result.checklist.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));
  console.log('\nPrésentation jetable — à supprimer de Google Drive une fois le test terminé.');
}

function printMissingCredentialsHelp(): void {
  console.error(`
Ce spike a besoin d'un vrai access token Google (PAS le token de session du
plugin, qui est un identifiant interne à ce backend — voir
packages/backend/src/auth/getAccessToken.ts) avec le scope :
  - https://www.googleapis.com/auth/presentations

Façon la plus rapide de l'obtenir, sans rien lancer en local :
  1. Ouvrir https://developers.google.com/oauthplayground
  2. Dans le champ en bas "Input your own scopes", ajouter :
     https://www.googleapis.com/auth/presentations
  3. "Authorize APIs" → se connecter avec le compte Google à tester → autoriser.
  4. "Exchange authorization code for tokens" → copier la valeur "Access token"
     (valide ~1h).
  5. Relancer avec :
       F2S_SESSION_TOKEN=<access_token> npm run spike:theme --workspace packages/backend
`);
}

// Rien n'importe plus `runMasterThemeSpike` depuis un autre module (la route
// temporaire qui le faisait a été retirée) — cette garde n'a donc plus
// d'utilité pratique aujourd'hui, mais reste inoffensive si ce fichier est
// un jour réimporté ailleurs plutôt qu'exécuté en CLI.
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
