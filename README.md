# figma-to-slides

Plugin Figma qui exporte une ou plusieurs frames vers Google Slides en
gardant chaque élément **éditable nativement** (texte, forme, image)
plutôt que de tout aplatir en une capture d'écran. Voir
[`figma-to-slides-plugin-spec.md`](./figma-to-slides-plugin-spec.md) pour
la spécification complète (architecture, contrats, critères d'acceptation)
et [`LIMITATIONS.md`](./LIMITATIONS.md) pour ce que l'API Slides ne peut
pas reproduire.

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

## Licence

Non spécifiée.
