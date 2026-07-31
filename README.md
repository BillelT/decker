# figma-to-slides

Plugin Figma qui exporte une ou plusieurs frames vers Google Slides en
gardant chaque élément **éditable nativement** (texte, forme, image)
plutôt que de tout aplatir en une capture d'écran. Voir
[`figma-to-slides-plugin-spec.md`](./figma-to-slides-plugin-spec.md) pour
la spécification complète (architecture, contrats, critères d'acceptation)
et [`LIMITATIONS.md`](./LIMITATIONS.md) pour ce que l'API Slides ne peut
pas reproduire.

Le plugin propose aussi un mode **"Create a template"** (bouton dans
l'en-tête) pour construire un jeu de layouts Slides réutilisables plutôt
qu'un deck ponctuel — voir
[`brief-creation-template-google-slides.md`](./brief-creation-template-google-slides.md)
pour le brief et les décisions de conception, et la section dédiée de
[`LIMITATIONS.md`](./LIMITATIONS.md#création-de-template-mode-dédié) pour
ce que ce mode impose (zéro rasterisation tolérée) et comment les
placeholders sont marqués (convention de nom de calque `[[role]]` +
alt text côté Slides).

## Structure du monorepo

```
packages/
  shared/    Types IR partagés entre le plugin et le backend (le contrat, spec §6)
  backend/   Node.js + Express : OAuth Google, mapper IR → Slides, stockage d'assets, calibration
  plugin/    Plugin Figma (code.ts = sandbox, ui.tsx = iframe) + manifest.json
```

## Prérequis

- Node.js ≥ 20, npm ≥ 10.
- Un projet Google Cloud avec les APIs **Google Slides API** et **Google
  Drive API** activées.
- L'application desktop Figma (ou figma.com) pour charger le plugin en
  développement.

## 1. Configuration Google Cloud

1. [Console Google Cloud](https://console.cloud.google.com/) → créer un
   projet (ou en réutiliser un).
2. **APIs & Services → Library** → activer :
   - Google Slides API
   - Google Drive API (nécessaire pour le scope `drive.file`)
3. **APIs & Services → OAuth consent screen** :
   - Type : External (ou Internal si Google Workspace).
   - Scopes à déclarer : `.../auth/presentations`, `.../auth/drive.file`
     (spec §5.2 — **ne pas** ajouter `drive` ou `drive.readonly`, cela
     déclenche une revue CASA longue et inutile ici).
   - Tant que l'app est en mode "Testing", ajoute les comptes Google qui
     testeront le plugin dans "Test users".
4. **APIs & Services → Credentials → Create credentials → OAuth client
   ID** :
   - Type d'application : **Web application**.
   - Authorized redirect URIs : `http://localhost:8787/auth/callback` en
     dev (adapter en production).
   - Note le **Client ID** et le **Client Secret**.

## 2. Variables d'environnement (backend)

```bash
cp packages/backend/.env.example packages/backend/.env
```

Renseigne `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`, et génère une clé de chiffrement pour les refresh
tokens (spec §5.2) :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → colle le résultat dans SESSION_ENCRYPTION_KEY
```

`PLUGIN_ALLOWED_ORIGINS` doit lister l'origine depuis laquelle l'iframe du
plugin appelle le backend (CORS).

## 3. Installation

```bash
npm install
```

`packages/shared` se compile automatiquement après l'install (hook
`postinstall`) et avant chaque `npm test` (hook `pretest`) — pas besoin de
le builder à la main.

## 4. Lancer le backend en dev

```bash
npm run dev --workspace packages/backend
# → écoute sur http://localhost:8787 (voir PORT dans .env)
```

## 5. Construire et charger le plugin Figma

```bash
npm run build --workspace packages/plugin
```

Cela génère `packages/plugin/dist/code.js` et `dist/ui.html`. Dans
Figma desktop : **Plugins → Development → Import plugin from manifest…**
et sélectionne `packages/plugin/manifest.json`.

Par défaut le plugin pointe vers `http://localhost:8787`. Pour builder
contre un autre backend :

```bash
F2S_BACKEND_URL=https://ton-backend.example.com npm run build --workspace packages/plugin
```

Pense à ajouter ce domaine à `networkAccess.allowedDomains` dans
`manifest.json` (spec §11.12 — sinon les requêtes de l'iframe sont
bloquées silencieusement).

## 6. Tests

```bash
npm test
```

- `packages/backend` : tests unitaires du mapper (IR → requêtes Slides,
  purs, sans réseau) + tests de calibration (SSIM sur images synthétiques).
- `packages/plugin` : tests unitaires de la logique de sérialisation
  (arbre de décision natif/raster, résolution de polices, mapping texte).

## 7. Harnais de calibration (Phase 0, spec §4)

`npm run calibrate` crée une vraie présentation Google Slides à partir
d'une fixture géométrique connue (5 rectangles), récupère son rendu réel
via l'API, et compare au rendu attendu (SSIM + écart de position par
élément). Ça nécessite un **access token Google valide** :

```bash
F2S_SESSION_TOKEN=<access_token_avec_scopes_presentations_et_drive.file> \
  npm run calibrate --workspace packages/backend
```

Le script écrit `calibration-report.html` (à ouvrir dans un navigateur) et
`calibration.json` (consommé par le mapper backend pour compenser les
écarts non documentés par l'API Slides — marge interne du texte, etc.).
Voir [`LIMITATIONS.md`](./LIMITATIONS.md) pour l'état actuel de la
calibration.

## 8. Déploiement sur Vercel (backend)

Le backend garde en mémoire (`Map`) les sessions, l'état des jobs
d'export, et le PKCE OAuth en attente, et stocke les images exportées sur
le disque local — rien de tout ça ne survit d'une invocation de fonction
serverless à l'autre sur Vercel. Ce dépôt utilise donc :

- [`@upstash/redis`](https://www.npmjs.com/package/@upstash/redis) pour
  les sessions, les jobs, et le PKCE (`src/kv.ts`, `src/auth/session.ts`,
  `src/jobs/jobStore.ts`, `src/auth/pendingAuth.ts`).
- [`@vercel/blob`](https://www.npmjs.com/package/@vercel/blob) pour les
  images exportées (`ASSET_STORAGE_DRIVER=vercel-blob`,
  `src/storage/vercelBlobAssetStore.ts`).
- [`waitUntil`](https://www.npmjs.com/package/@vercel/functions) pour que
  l'export continue de s'exécuter après la réponse HTTP 202 (le pattern
  "fire and forget" + polling `/export/:jobId` ne fonctionne pas tel quel
  sur une fonction serverless, qui peut être gelée dès la réponse envoyée).

### 8.1 Créer le projet Vercel

1. Pousse ce dépôt sur GitHub (ou GitLab/Bitbucket), puis
   [importe-le sur Vercel](https://vercel.com/new).
2. Dans les réglages du projet : **Root Directory** → `packages/backend`.
   `packages/backend/vercel.json` définit déjà la commande de build
   (`cd ../.. && npm install && npm run build --workspace packages/backend`,
   qui compile `packages/shared` en premier) et les rewrites qui routent
   tout vers `api/index.js`.

### 8.2 Lier Redis et Blob

1. **Storage → Create Database** (ou **Marketplace**) → une intégration
   **Redis** (Upstash) → lie-la à ce projet. Ça injecte automatiquement
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (ou les variables
   `KV_REST_API_*` historiques — `Redis.fromEnv()` accepte les deux).
2. **Storage → Create → Blob** → lie-le à ce projet. Ça injecte
   `BLOB_READ_WRITE_TOKEN` automatiquement.

### 8.3 Variables d'environnement (à définir à la main)

Dans **Settings → Environment Variables** :

| Variable | Valeur |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Depuis la Console Google Cloud (§1). |
| `GOOGLE_REDIRECT_URI` | `https://<ton-domaine>.vercel.app/auth/callback` |
| `SESSION_ENCRYPTION_KEY` | Comme en local (§2). |
| `PLUGIN_ALLOWED_ORIGINS` | Origine de l'iframe du plugin (CORS). |
| `ASSET_STORAGE_DRIVER` | `vercel-blob` |

`PUBLIC_BACKEND_URL` n'a **pas** besoin d'être définie : en son absence,
le backend utilise automatiquement `VERCEL_URL` (le domaine du
déploiement, injecté par Vercel).

⚠️ Le **redirect URI OAuth est fixe** côté Google (ajouté une fois pour
toutes dans Authorized redirect URIs, Console Google Cloud) — l'OAuth ne
fonctionnera donc que sur un domaine stable (production, ou un domaine
personnalisé), pas sur les URLs de preview générées à chaque déploiement
(uniques à chaque fois). Teste l'OAuth sur le domaine de production.

### 8.4 Pointer le plugin vers le backend déployé

```bash
F2S_BACKEND_URL=https://<ton-domaine>.vercel.app npm run build --workspace packages/plugin
```

Puis mets à jour `networkAccess.allowedDomains` dans
`packages/plugin/manifest.json` avec cette même URL (sinon les requêtes
de l'iframe sont bloquées silencieusement, spec §11.12).

## Licence

Non spécifiée.
