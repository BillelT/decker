# Figma → Google Slides : plugin d'export éditable & pixel-perfect

> **Document de référence pour l'implémentation.**
> Lis ce fichier en entier avant d'écrire du code. Les sections `RÈGLE`, `CONTRAT` et `CRITÈRE` sont normatives : ne les contourne pas sans le signaler explicitement.

---

## 0. TL;DR pour l'agent

**Ce qu'on construit :** un plugin Figma qui envoie **une ou plusieurs frames** vers une présentation Google Slides, où chaque élément reste un **objet Slides natif éditable** (texte, forme, image) positionné **au point près**, plutôt qu'une capture aplatie.

**Les trois contraintes qui structurent tout le projet :**

1. L'API Slides est **beaucoup plus pauvre** que Figma (pas de gradient, pas de letter-spacing, pas de radius paramétrable, ombres en lecture seule). Le mapping est donc **lossy par nature** : le travail consiste à décider, élément par élément, entre *reproduire nativement* et *rasteriser*, et à **rendre cette décision visible à l'utilisateur avant l'envoi**.
2. Le thread principal d'un plugin Figma **n'a pas accès au réseau**. Tout appel HTTP passe par l'iframe UI.
3. Google Slides n'accepte des images **que via URL publiquement accessible**. Il faut donc un backend qui héberge temporairement les rasterisations.

**Ordre de construction impératif :** Phase 0 (calibration) → Phase 1 (texte + formes) → Phase 2 (images + raster) → Phase 3 (multi-frames + UI) → Phases optionnelles. **Ne pas** démarrer par l'UI ou par l'OAuth : la boucle de calibration pixel est ce qui détermine si le projet a de la valeur.

---

## 1. Objectif et critère de succès

### 1.1 Objectif

Exporter des frames Figma vers Google Slides en conservant simultanément :

- **la fidélité visuelle** : position, taille, couleur, typographie, ordre de superposition ;
- **l'éditabilité native** : le destinataire doit pouvoir cliquer sur un titre dans Slides et le retaper, changer une couleur de fond, déplacer un bloc.

C'est la combinaison des deux qui différencie le produit. Les solutions existantes rasterisent la frame entière : fidèles mais mortes.

### 1.2 Critère de succès mesurable

**CRITÈRE GLOBAL** — sur le jeu de frames de test (§9) :

| Métrique | Seuil |
|---|---|
| Écart de position/taille de chaque élément natif vs. sa position Figma cible | **≤ 1 pt** |
| Éléments rasterisés sur la frame de référence "layout marketing standard" | **≤ 20 %** des nœuds visibles |
| Diff perceptuel (SSIM) entre rendu Slides et export Figma | **≥ 0,95** |
| Textes exportés en `TEXT_BOX` éditable (hors fallback police) | **100 %** |

Ces seuils sont vérifiés automatiquement par le harnais de calibration (§4). Un export qui ne les atteint pas est un bug, pas une limite acceptée.

### 1.3 Non-objectifs (V1)

- Import inverse Slides → Figma.
- Animations, transitions, éléments interactifs.
- Synchronisation continue / re-export incrémental d'une frame déjà envoyée.
- Auto-layout responsive côté Slides (converti en positions statiques, cf. §3.4).
- Composants/variantes Figma traités comme entités logiques (ils sont aplatis comme n'importe quel groupe).

---

## 2. Capacités réelles de l'API Slides (vérifié)

**RÈGLE :** cette section est la source de vérité pour décider quoi est mappable. Ne suppose rien au-delà.

### 2.1 Ce qui est disponible en écriture

| Propriété | Champ API | Notes |
|---|---|---|
| Fond de forme | `shapeProperties.shapeBackgroundFill.solidFill` | `{color: {rgbColor}, alpha}` — **couleur unie uniquement** |
| Contour | `shapeProperties.outline` | `outlineFill.solidFill`, `weight` (Dimension), `dashStyle` — **uniforme sur les 4 côtés** |
| Alignement vertical du texte | `shapeProperties.contentAlignment` | `TOP` / `MIDDLE` / `BOTTOM` |
| Autofit | `shapeProperties.autofit.autofitType` | En écriture : **seulement** `NONE` et `AUTOFIT_TYPE_UNSPECIFIED` |
| Style de texte (run) | `TextStyle` | `bold`, `italic`, `underline`, `strikethrough`, `smallCaps`, `fontFamily`, `weightedFontFamily`, `fontSize`, `foregroundColor`, `backgroundColor`, `baselineOffset`, `link` |
| Style de paragraphe | `ParagraphStyle` | `alignment`, `lineSpacing` (**en %**, pas en pt), `spaceAbove`, `spaceBelow`, `indentStart`, `indentEnd`, `indentFirstLine`, `direction` |
| Position / taille / rotation | `PageElementProperties.transform` (`AffineTransform`) | `scaleX/Y`, `shearX/Y`, `translateX/Y`, `unit` |
| Types de formes | `shapeType` | ~150 presets ECMA-376 : `RECTANGLE`, `ROUND_RECTANGLE`, `ELLIPSE`, `TRIANGLE`, `DIAMOND`, `STAR_5`, `RIGHT_ARROW`, etc. |
| Images | `CreateImageRequest` | **URL publique requise** |

### 2.2 Ce qui N'EXISTE PAS ou est en lecture seule

**RÈGLE :** chaque ligne ci-dessous déclenche une décision de rasterisation ou d'approximation documentée. Ne perds pas de temps à chercher un contournement API.

| Manque | Conséquence |
|---|---|
| **Aucun gradient** (`ShapeBackgroundFill` n'expose que `solidFill`) | Tout fill `GRADIENT_*` → **raster** |
| **Aucun letter-spacing / tracking** dans `TextStyle` | Perte silencieuse. Si `letterSpacing ≠ 0`, → **avertissement**, et **raster** si écart de largeur mesuré > 2 % |
| **Radius d'angle non paramétrable** | `ROUND_RECTANGLE` a un rayon fixe imposé par Slides. Voir §3.3 pour l'arbitrage |
| **`shapeProperties.shadow` en lecture seule** | Aucune ombre portée native. Ombre visible → **raster** |
| **`ImageProperties.transparency` en lecture seule** | On ne peut pas rendre une image semi-transparente via l'API → **l'alpha doit être cuit dans le PNG** (crucial pour l'option §7.1) |
| **`ImageProperties.cropProperties` en lecture seule** | Le recadrage doit être appliqué au pixel avant upload |
| **`ImageProperties.brightness/contrast/recolor` en lecture seule** | Idem : appliquer avant upload |
| **Pas de contrôle des marges internes du texte** | Les text boxes Slides ont un padding interne non exposé → **compensation obligatoire**, valeur mesurée en Phase 0 |
| **Pas de fills multiples ni de blend modes** | `blendMode ≠ NORMAL` ou ≥ 2 fills visibles → **raster** |
| **Pas de bordure par côté, pas d'inset stroke** | Approximation centrée, ou raster si l'écart est visible |

### 2.3 Contraintes d'insertion d'image

- Formats acceptés : **PNG, JPEG, GIF**.
- Taille : **< 50 Mo** et **< 25 mégapixels**.
- URL : **≤ 2 ko**, doit être accessible **sans authentification** au moment de l'appel.
- L'image est **récupérée une seule fois à l'insertion** et recopiée dans la présentation → l'URL temporaire peut expirer juste après.

### 2.4 Ordre de superposition (z-order)

**RÈGLE :** les éléments sont empilés dans leur **ordre de création**. Émets les requêtes `create*` dans l'ordre **arrière → avant**, c'est-à-dire dans l'ordre naturel de `node.children` de Figma (index 0 = arrière-plan). N'utilise `UpdatePageElementsZOrderRequest` qu'en correction ciblée (ex. underlay §7.1), jamais comme mécanisme principal.

---

## 3. Système de conversion

### 3.1 Coordonnées

- Figma : pixels, origine en haut à gauche **de la frame** (`node.absoluteBoundingBox` moins l'origine de la frame).
- Slides : `Dimension {magnitude, unit}` avec `unit: 'PT'` ou `'EMU'`. **Utilise `PT` partout** : plus lisible, moins d'erreurs d'arrondi cumulées. (1 pt = 12 700 EMU ; 1 pouce = 72 pt = 914 400 EMU.)

**CONTRAT — conversion :**

```ts
// Taille de slide par défaut : 16:9 = 10in × 5.625in = 720pt × 405pt
const SLIDE_16_9 = { widthPt: 720, heightPt: 405 };

/**
 * Facteur unique appliqué à TOUTES les dimensions.
 * Ratio préservé : on prend le min pour que la frame tienne entièrement,
 * puis on centre (offsetX/offsetY) si les ratios diffèrent.
 */
function computeScale(frame: {width: number; height: number}, slide = SLIDE_16_9) {
  const s = Math.min(slide.widthPt / frame.width, slide.heightPt / frame.height);
  return {
    scale: s,
    offsetXPt: (slide.widthPt  - frame.width  * s) / 2,
    offsetYPt: (slide.heightPt - frame.height * s) / 2,
  };
}

const toPt = (px: number, scale: number) => px * scale;
```

**RÈGLE — arrondi :** n'arrondis **jamais** en cours de chaîne. Garde des flottants jusqu'à la sérialisation JSON finale, où tu arrondis à 3 décimales. Les arrondis intermédiaires sont la première cause de dérive pixel.

### 3.2 Transform des éléments

Slides positionne via une `AffineTransform` appliquée à une taille de base. La forme canonique à utiliser :

```ts
// size = dimensions réelles de l'élément ; scaleX/Y = 1 ; translate = coin haut-gauche
elementProperties: {
  pageObjectId,
  size: {
    width:  { magnitude: wPt, unit: 'PT' },
    height: { magnitude: hPt, unit: 'PT' },
  },
  transform: { scaleX: 1, scaleY: 1, translateX: xPt, translateY: yPt, unit: 'PT' },
}
```

**Rotation** (`node.rotation`, en degrés, sens antihoraire dans Figma) : Slides applique la transform autour de l'**origine haut-gauche**, pas du centre. Il faut donc composer une translation vers le centre, la rotation, puis la translation inverse :

```ts
function rotatedTransform(xPt, yPt, wPt, hPt, degCCW) {
  const t = -degCCW * Math.PI / 180;           // Figma CCW → Slides CW
  const cos = Math.cos(t), sin = Math.sin(t);
  const cx = xPt + wPt / 2, cy = yPt + hPt / 2;
  return {
    scaleX: cos, scaleY: cos, shearX: -sin, shearY: sin,
    translateX: cx - cos * (wPt / 2) + sin * (hPt / 2),
    translateY: cy - sin * (wPt / 2) - cos * (hPt / 2),
    unit: 'PT',
  };
}
```

**CRITÈRE :** une frame de test contenant un rectangle à 0°, 15°, 45°, 90°, -30° doit produire un SSIM ≥ 0,98. Si ce n'est pas le cas, le bug est ici — corrige avant d'avancer.

### 3.3 Arbre de décision : natif ou raster ?

**RÈGLE :** applique cet arbre à chaque nœud, dans cet ordre. Le premier `→ RASTER` atteint arrête l'évaluation.

```
Nœud visible ? ─ non → IGNORER (ne crée aucun élément)
   │ oui
   ├─ opacity == 0 ou dimensions < 0.5px ? ────────────────→ IGNORER
   ├─ blendMode != 'NORMAL' ? ─────────────────────────────→ RASTER
   ├─ effects contient DROP_SHADOW / INNER_SHADOW /
   │  LAYER_BLUR / BACKGROUND_BLUR visible ? ──────────────→ RASTER
   ├─ isMask == true ou parent applique un masque ? ───────→ RASTER (aplatir le groupe masqué entier)
   │
   ├─ type == 'TEXT'
   │    ├─ police absente de Google Fonts ET non substituable ? → RASTER (avec avertissement)
   │    ├─ letterSpacing != 0 et impact largeur > 2% ? ────→ RASTER (avec avertissement)
   │    ├─ textDecoration/fill mixtes non représentables ? → RASTER
   │    └─ sinon ─────────────────────────────────────────→ NATIF : TEXT_BOX
   │
   ├─ type in ('RECTANGLE','ELLIPSE','POLYGON','STAR','LINE')
   │    ├─ fills.length > 1 visible ? ─────────────────────→ RASTER
   │    ├─ fill.type commence par 'GRADIENT' ? ────────────→ RASTER
   │    ├─ fill.type == 'IMAGE' ? ─────────────────────────→ IMAGE (extraire le bitmap)
   │    ├─ strokes multiples ou strokeAlign != 'CENTER'
   │    │  avec écart > 0.5pt ? ───────────────────────────→ RASTER
   │    ├─ cornerRadius != 0 → voir RÈGLE RADIUS ci-dessous
   │    └─ sinon ─────────────────────────────────────────→ NATIF : shape preset
   │
   ├─ type in ('VECTOR','BOOLEAN_OPERATION','STAR' custom,
   │           'POLYGON' custom, 'LINE' courbe) ───────────→ RASTER
   │
   ├─ type in ('GROUP','FRAME','COMPONENT','INSTANCE')
   │    ├─ clipsContent && des enfants débordent ? ────────→ RASTER (le groupe entier)
   │    └─ sinon ─────────→ DESCENDRE dans les enfants (aplatir la hiérarchie,
   │                        coordonnées recalculées en absolu ; le fond
   │                        de la frame devient un RECTANGLE natif si uni)
   │
   └─ autre (SLICE, CONNECTOR, WIDGET, …) ─────────────────→ IGNORER
```

**RÈGLE RADIUS** — Slides ne permet pas de fixer le rayon :

| Cas | Décision |
|---|---|
| `cornerRadius == 0` | `RECTANGLE` natif |
| Rayon ≥ min(w,h)/2 sur les 4 coins (pilule/cercle) | `ELLIPSE` si w≈h, sinon `ROUND_RECTANGLE` |
| Rayons uniformes, rayon/min(w,h) ∈ [0.08 ; 0.25] | `ROUND_RECTANGLE` — écart accepté, **mentionné dans le rapport** |
| Rayons non uniformes, ou hors de cette plage | **RASTER** |

Le seuil est un paramètre : expose-le comme constante `RADIUS_NATIVE_TOLERANCE` pour pouvoir l'ajuster après calibration.

### 3.4 Aplatissement de la hiérarchie

**RÈGLE :** la hiérarchie Figma est **entièrement aplatie**. Aucune tentative de recréer des groupes Slides en V1 (les groupes Slides ne se créent pas via `batchUpdate` de façon fiable et compliquent l'édition ultérieure).

Pour chaque nœud retenu, la position est calculée en **absolu par rapport à la frame racine** :

```ts
const rel = {
  x: node.absoluteBoundingBox.x - rootFrame.absoluteBoundingBox.x,
  y: node.absoluteBoundingBox.y - rootFrame.absoluteBoundingBox.y,
};
```

**Attention :** `absoluteBoundingBox` inclut l'effet des rotations et des strokes selon les cas. Pour les nœuds tournés, utilise `absoluteRenderBounds` pour le raster (qui doit couvrir le rendu réel, effets compris) et `absoluteBoundingBox` + `rotation` pour le natif.

L'auto-layout n'a pas d'équivalent : il est résolu par Figma au moment de la lecture, on ne lit donc que les positions finales. Rien de spécial à faire — mais **documente** que la responsivité est perdue.

### 3.5 Texte : la partie qui demande le plus de soin

**CONTRAT — extraction :** utilise `node.getStyledTextSegments([...])` pour obtenir des runs homogènes, **jamais** les propriétés de premier niveau (qui renvoient `figma.mixed` dès qu'il y a un style mixte) :

```ts
const segments = textNode.getStyledTextSegments([
  'fontSize', 'fontName', 'fontWeight', 'fills', 'textDecoration',
  'textCase', 'letterSpacing', 'lineHeight', 'hyperlink', 'listOptions',
  'indentation', 'textStyleId',
]);
```

Chaque segment devient un `UpdateTextStyleRequest` avec `textRange: {type: 'FIXED_RANGE', startIndex, endIndex}`.

**Mapping des propriétés délicates :**

| Figma | Slides | Traitement |
|---|---|---|
| `fontName.family` + `fontName.style` | `weightedFontFamily: {fontFamily, weight}` | `weight` ∈ {100..900, multiple de 100}. Parse le style Figma (`"Bold"` → 700, `"Semi Bold"` → 600, `"Regular"` → 400, `"Light"` → 300…). **Préfère `weightedFontFamily` à `fontFamily`+`bold`** : plus fidèle pour les familles à graisses multiples |
| `fontSize` (px) | `fontSize: {magnitude, unit:'PT'}` | `fontSize_px × scale` — la police suit le même facteur que la géométrie |
| `lineHeight` | `paragraphStyle.lineSpacing` (**%**) | `{unit:'PIXELS', value}` → `value / fontSize_px × 100`. `{unit:'PERCENT', value}` → `value` tel quel. `AUTO` → ne pas envoyer le champ |
| `letterSpacing` | ∅ | Non supporté. Calcule l'impact : `Δlargeur = spacing × (nbChars-1)`. Si `Δ/largeur > 2%` → raster + avertissement, sinon ignorer silencieusement mais **loguer** |
| `textCase` `UPPER`/`LOWER`/`TITLE` | ∅ | **Applique la transformation au contenu texte lui-même** avant insertion (Slides n'a pas de text-transform). `SMALL_CAPS` → `textStyle.smallCaps: true` |
| `textAlignHorizontal` | `paragraphStyle.alignment` | `LEFT`→`START`, `CENTER`→`CENTER`, `RIGHT`→`END`, `JUSTIFIED`→`JUSTIFIED` |
| `textAlignVertical` | `shapeProperties.contentAlignment` | `TOP`/`CENTER`→`MIDDLE`/`BOTTOM` |
| `textAutoResize` | `autofit.autofitType: 'NONE'` | Toujours `NONE` : on gère la taille nous-mêmes |
| `listOptions` | `CreateParagraphBulletsRequest` | `UNORDERED` → `BULLET_DISC_CIRCLE_SQUARE`, `ORDERED` → `NUMBERED_DIGIT_ALPHA_ROMAN` |
| `fills[0].color` | `textStyle.foregroundColor.opaqueColor.rgbColor` | ⚠️ Composantes en **0.0–1.0**, pas 0–255 |
| `hyperlink` | `textStyle.link.url` | Direct |

**RÈGLE — padding interne :** les text boxes Slides appliquent une marge interne non exposée par l'API. **Ne devine pas sa valeur** : elle est mesurée en Phase 0 et stockée dans `calibration.json` sous `textInset: {left, right, top, bottom}` (en pt). Toutes les boîtes de texte sont ensuite créées avec :

```ts
x = xPt - inset.left;  width  = wPt + inset.left + inset.right;
y = yPt - inset.top;   height = hPt + inset.top  + inset.bottom;
```

**RÈGLE — polices :** avant export, résous chaque famille contre la liste Google Fonts (API `webfonts/v1`, mise en cache 24 h) **plus** la liste des polices système Slides (Arial, Times New Roman, Verdana, Georgia, Courier New, Trebuchet MS, Impact, Comic Sans MS). Trois issues :

1. **Disponible** → mapping direct.
2. **Substituable** (table de substitution explicite, ex. `SF Pro Text → Inter`, `Helvetica Neue → Arial`, `Segoe UI → Open Sans`) → substitution + avertissement dans la preview.
3. **Ni l'un ni l'autre** → raster du bloc texte + avertissement bloquant (l'utilisateur doit cocher « je comprends » ou changer la police).

> ⚠️ Slides **accepte silencieusement** n'importe quelle chaîne dans `fontFamily` et retombe sur une police par défaut sans erreur. La validation en amont est donc obligatoire : l'API ne t'avertira jamais.

### 3.6 Couleurs

```ts
// Figma: {r,g,b} en 0..1 + opacity séparée ; Slides: rgbColor en 0..1 + alpha
const toSlidesColor = (c: RGB) => ({ rgbColor: { red: c.r, green: c.g, blue: c.b } });
const toAlpha = (fillOpacity = 1, nodeOpacity = 1) => fillOpacity * nodeOpacity;
```

**RÈGLE :** l'opacité du nœud (`node.opacity`) **et** celle du fill se multiplient. Une seule valeur `alpha` est disponible côté Slides : envoie le produit.

---

## 4. Phase 0 — Harnais de calibration (à faire EN PREMIER)

**Justification :** « pixel-perfect » n'est pas vérifiable à l'œil. Sans boucle de mesure automatique, chaque phase suivante accumule des dérives invisibles. Cette phase produit l'outil qui valide tout le reste.

**Livrable :** un script `npm run calibrate` qui :

1. Lit une frame de référence Figma exportée en PNG (`fixtures/<name>.png`) et son JSON sérialisé (`fixtures/<name>.json`).
2. Génère la présentation via le pipeline complet.
3. Récupère le rendu via `presentations.pages.getThumbnail` (résolution `LARGE`).
4. Aligne les deux images et calcule : **SSIM global**, **carte de diff**, et **écart de bounding box par élément** (via `presentations.get` qui renvoie les transforms réelles appliquées).
5. Écrit `calibration-report.html` avec les trois images côte à côte + le tableau des écarts.

**Ce que la Phase 0 doit déterminer empiriquement et écrire dans `calibration.json` :**

- `textInset` : marge interne réelle des `TEXT_BOX` (mesure : boîte à fond coloré + texte connu, on compare la position du glyphe).
- `roundRectRadiusRatio` : rayon effectif de `ROUND_RECTANGLE` en fonction de w/h.
- `defaultOutlineWeight` : épaisseur par défaut des formes créées sans `outline` (à annuler explicitement via `propertyState: 'NOT_RENDERED'`).
- `lineSpacingBaseline` : rapport réel entre `lineSpacing: 100` et la hauteur de ligne rendue.

**CRITÈRE de sortie de Phase 0 :** une frame contenant uniquement 4 rectangles unis positionnés aux 4 coins + 1 au centre atteint un SSIM ≥ 0,99 et un écart de position ≤ 0,5 pt.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ PLUGIN FIGMA                                                │
│                                                             │
│  code.ts  (sandbox, PAS d'accès réseau)                     │
│   ├─ lit la sélection, valide que ce sont des frames        │
│   ├─ sérialise l'arbre → IRDocument (§6)                    │
│   ├─ exportAsync() pour chaque nœud à rasteriser + preview  │
│   └─ postMessage(IRDocument + Uint8Array[]) ──────┐         │
│                                                    ▼         │
│  ui.html / ui.tsx  (iframe, SEUL accès réseau)              │
│   ├─ grille de previews, sélection, réordonnancement        │
│   ├─ affiche le rapport de fidélité (§8.3)                  │
│   └─ fetch() → backend                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (manifest.networkAccess.allowedDomains)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND — Node.js + Express + TypeScript                    │
│                                                             │
│  POST /auth/google        → démarre OAuth2 (PKCE)           │
│  GET  /auth/callback      → échange code, stocke tokens     │
│  POST /assets             → reçoit les PNG, renvoie des     │
│                             URLs publiques signées (TTL 15m)│
│  POST /export             → IRDocument → batchUpdate        │
│  GET  /export/:jobId      → progression (SSE ou polling)    │
│                                                             │
│  src/mapper/   IRDocument → SlidesRequest[]  (PUR, testable)│
│  src/slides/   client API, chunking, retry                  │
│  src/storage/  stockage éphémère des assets                 │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
              Google Slides API v1 · batchUpdate
```

### 5.1 Pourquoi un backend

- Le sandbox du plugin **n'a pas de `fetch`** dans le thread principal ; l'iframe en a un, mais l'OAuth2 avec redirect URI y est impraticable (pas d'origine stable, pas de stockage de refresh token sûr).
- Slides exige des **URLs d'image publiques** : il faut un point d'hébergement.
- Le mapper doit être **testable hors Figma** : l'isoler côté serveur permet de le couvrir en tests unitaires purs.

### 5.2 OAuth & scopes

**RÈGLE — scopes minimaux :**

```
https://www.googleapis.com/auth/drive.file      # accès aux SEULS fichiers créés par l'app — suffit pour presentations.create/batchUpdate/get
```

**N'utilise pas** `drive`, `drive.readonly` ou `presentations` : `drive`/`drive.readonly` sont des scopes restreints qui imposent une revue de sécurité Google (CASA) longue et coûteuse ; `presentations` est un scope sensible à accès continu sur toutes les présentations de l'utilisateur (revue Google refusée le 2026-08 faute de justification suffisante). Decker ne touche jamais un fichier Slides préexistant — seulement ceux qu'il crée lui-même via l'API — donc `drive.file` seul suffit.

- Flow **Authorization Code + PKCE**, `access_type=offline`, `prompt=consent` au premier passage.
- Refresh token **chiffré au repos** (AES-256-GCM, clé en variable d'environnement), jamais renvoyé au client.
- Le client ne reçoit qu'un **jeton de session opaque** (cookie `HttpOnly` + `SameSite=None; Secure`, ou header `Authorization` porté par l'iframe).

### 5.3 Hébergement des images

**RÈGLE :** deux stratégies, à implémenter dans cet ordre de préférence.

1. **Stockage objet + URL signée courte** (S3 / R2 / GCS, TTL 15 min). Fiable, indépendant de la config Workspace de l'utilisateur. **Recommandé.**
2. *Fallback* : upload sur le Drive de l'utilisateur (`drive.file`) + permission `anyone/reader` temporaire, puis suppression de la permission après insertion. **Fragile** : de nombreuses organisations Workspace interdisent le partage public, et l'appel échouera silencieusement en 400.

Dans les deux cas, l'image n'est lue qu'une fois par Slides à l'insertion → **supprime l'asset dès que le `batchUpdate` a répondu 200**.

### 5.4 Robustesse des appels batchUpdate

**RÈGLE :**

- Découpe en lots de **≤ 300 requêtes** (`batchUpdate` échoue sur des payloads trop gros ; la limite exacte n'est pas documentée, 300 est un seuil sûr).
- **Une slide = un lot minimum indivisible** : ne coupe jamais une slide en deux lots, sinon un échec partiel laisse une slide incohérente.
- Retry avec **backoff exponentiel + jitter** sur 429 / 500 / 503 (5 tentatives, base 1 s, plafond 32 s).
- Les `objectId` sont **générés côté client** (`^[a-zA-Z0-9_-]{5,50}$`) → permet de référencer un élément dans la même requête que sa création. Utilise un préfixe par job pour éviter les collisions : `f2s_<jobId>_<seq>`.
- **Idempotence :** en cas de reprise après échec, ne rejoue pas un lot déjà appliqué — persiste l'état du job (`pending` / `applied` par lot).

---

## 6. CONTRAT — Représentation intermédiaire (IR)

**RÈGLE :** c'est la frontière entre le plugin et le backend. Le mapper backend ne connaît **que** ce type ; il n'importe jamais de types Figma. Ce découplage est ce qui rend le mapper testable et le pipeline débogable.

```ts
// packages/shared/src/ir.ts — partagé entre plugin et backend

export interface IRDocument {
  version: 1;
  presentationTitle: string;
  /** Si absent, une nouvelle présentation est créée */
  targetPresentationId?: string;
  slideSize: { widthPt: number; heightPt: number };
  slides: IRSlide[];
  options: ExportOptions;
}

export interface IRSlide {
  /** id du nœud Figma source, pour la traçabilité */
  sourceNodeId: string;
  frameName: string;
  /** Position finale dans le deck, 0-indexé. Modifiable par drag dans l'UI. */
  order: number;
  frameSize: { width: number; height: number };  // px Figma
  background?: IRPaint;
  /** Ordre arrière → avant. */
  elements: IRElement[];
  /** Diagnostics remontés à l'UI. */
  warnings: IRWarning[];
  /**
   * Aperçu bas-def pour la grille de l'UI (data URL PNG, largeur 320px).
   * Usage UI UNIQUEMENT : à retirer du payload avant l'envoi au backend.
   */
  previewDataUrl: string;
  /** Cf. §7.1 — image de contrôle en fond. */
  underlay?: IRUnderlay;
}

export type IRElement = IRText | IRShape | IRImage;

interface IRBase {
  id: string;                 // objectId Slides, généré côté plugin
  sourceNodeId: string;
  /** En px Figma, relatif au coin haut-gauche de la frame. */
  rect: { x: number; y: number; w: number; h: number };
  /** Degrés, antihoraire (convention Figma). */
  rotation: number;
  /** 0..1, produit node.opacity × fill.opacity. */
  opacity: number;
}

export interface IRText extends IRBase {
  kind: 'text';
  /** Contenu APRÈS application de textCase. */
  content: string;
  runs: IRTextRun[];
  paragraphs: IRParagraph[];
  vAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
}

export interface IRTextRun {
  start: number;              // index de caractère, inclusif
  end: number;                // exclusif
  fontFamily: string;         // DÉJÀ résolu contre Google Fonts
  fontWeight: number;         // 100..900
  italic: boolean;
  fontSizePx: number;
  color: IRColor;
  underline?: boolean;
  strikethrough?: boolean;
  smallCaps?: boolean;
  link?: string;
  /** Renseigné si substitution : affiché en avertissement. */
  originalFontFamily?: string;
}

export interface IRParagraph {
  start: number;
  end: number;
  align: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  /** En %, convention Slides. undefined = hérité. */
  lineSpacingPct?: number;
  spaceAbovePt?: number;
  spaceBelowPt?: number;
  indentStartPt?: number;
  bullet?: 'UNORDERED' | 'ORDERED';
  bulletLevel?: number;
}

export interface IRShape extends IRBase {
  kind: 'shape';
  /** Valeur littérale de l'enum Slides Page.Type. */
  shapeType: 'RECTANGLE' | 'ROUND_RECTANGLE' | 'ELLIPSE' | 'TRIANGLE'
           | 'DIAMOND' | 'RIGHT_TRIANGLE' | 'PARALLELOGRAM' | 'HEXAGON'
           | 'PENTAGON' | 'STAR_5' | 'RIGHT_ARROW' | 'TEXT_BOX';
  fill?: IRPaint;
  stroke?: { color: IRColor; weightPt: number; dash: 'SOLID' | 'DASH' | 'DOT' };
}

export interface IRImage extends IRBase {
  kind: 'image';
  /** Clé de l'asset dans le payload binaire ; le backend la remplace par une URL. */
  assetKey: string;
  /** true si l'image est une rasterisation de fallback (≠ image d'origine). */
  isRasterFallback: boolean;
  /** Nœud(s) Figma aplati(s) dans ce raster — pour le rapport. */
  rasterizedNodeIds?: string[];
}

export type IRPaint = { type: 'SOLID'; color: IRColor };

export interface IRColor { r: number; g: number; b: number; a: number } // tous 0..1

export interface IRWarning {
  code: 'FONT_SUBSTITUTED' | 'FONT_MISSING' | 'GRADIENT_RASTERIZED'
      | 'EFFECT_RASTERIZED' | 'BLEND_MODE_RASTERIZED' | 'MASK_RASTERIZED'
      | 'VECTOR_RASTERIZED' | 'LETTER_SPACING_LOST' | 'RADIUS_APPROXIMATED'
      | 'CORNER_RADIUS_RASTERIZED' | 'MULTIPLE_FILLS_RASTERIZED';
  severity: 'info' | 'warning' | 'blocking';
  sourceNodeId: string;
  nodeName: string;
  message: string;             // formulé pour un designer, pas pour un dev
}

export interface ExportOptions {
  mode: 'new-presentation' | 'append-to-existing';
  rasterScale: 2 | 3 | 4;
  /** Cf. §7.1 */
  includeUnderlay: boolean;
  underlayOpacity: number;     // 0..1, défaut 0.3
  /** Bloque l'export si un warning 'blocking' subsiste. */
  strictMode: boolean;
}

export interface IRUnderlay {
  assetKey: string;
  opacity: number;
}
```

**CONTRAT — transport :** le plugin envoie `multipart/form-data` : le champ `document` contient l'`IRDocument` en JSON, et chaque asset est un fichier nommé par son `assetKey`. Ne base64-encode pas les PNG dans le JSON (×1,33 de volume et pics mémoire dans l'iframe).

---

## 7. Fonctionnalités UI

### 7.0 Multi-frames et grille de preview — **REQUIS**

Le plugin doit traiter **plusieurs frames en un seul export**.

**Comportement attendu :**

1. **Sélection.** Au lancement, le plugin lit `figma.currentPage.selection` et retient tous les nœuds de type `FRAME`, `COMPONENT` ou `INSTANCE` de premier niveau. Si la sélection est vide, il propose toutes les frames de premier niveau de la page courante. Les nœuds non exportables sont listés avec la raison.
2. **Grille de previews.** Chaque frame retenue s'affiche en vignette (`exportAsync` PNG, largeur 320 px, générée en tâche de fond), avec :
   - son nom, ses dimensions, et un badge de ratio (⚠️ si ≠ ratio de la slide cible) ;
   - une **case à cocher d'inclusion** (toutes cochées par défaut) ;
   - un **badge de fidélité** : `N objets natifs · M rasterisés`, coloré vert / orange / rouge selon le taux ;
   - le **numéro de slide** de destination.
3. **Ordre.** Les slides sont générées dans l'ordre d'affichage de la grille. Ordre initial = ordre de sélection, sinon ordre spatial (haut→bas puis gauche→droite via `absoluteBoundingBox`).
4. **Actions groupées.** « Tout cocher / décocher », « Trier par position sur le canevas », « Trier par nom ».
5. **Progression.** Barre par frame pendant l'analyse (`analyse → raster → upload → création`), la frame en cours étant surlignée. L'analyse d'une frame ne doit pas bloquer l'affichage des autres.
6. **Résultat.** À la fin : lien vers la présentation, **plus** un récapitulatif par slide avec ses avertissements. Un échec partiel n'annule pas les slides réussies — il est signalé frame par frame avec option « réessayer les échecs ».

**RÈGLE — performance :** l'analyse et l'`exportAsync` de N frames doivent être **séquentiels avec `yield`** entre chaque frame (`await new Promise(r => setTimeout(r, 0))`), sinon l'UI Figma se fige. Au-delà de 20 frames sélectionnées, avertis l'utilisateur et propose de continuer.

**CRITÈRE :** 10 frames de complexité moyenne s'exportent en un seul appel, dans l'ordre affiché, sans blocage de l'UI Figma pendant plus de 200 ms d'affilée.

### 7.1 OPTIONNEL — Underlay de contrôle

> **Statut : OPTIONNEL.** N'implémente cette section que si les phases 0 à 3 sont terminées et validées, ou sur demande explicite.

**Besoin :** vérifier visuellement, dans Slides, que les éléments natifs sont bien positionnés — en superposant le rendu Figma d'origine derrière eux.

**Comportement :** une case à cocher « Ajouter une capture de contrôle en fond » (décochée par défaut) + un slider d'opacité (10–50 %, défaut 30 %). Si cochée, chaque slide reçoit une image de la frame complète, **plein cadre, semi-transparente, en tout dernier plan**.

**⚠️ CONTRAINTE CRITIQUE :** `ImageProperties.transparency` est **en lecture seule** dans l'API Slides. Il est **impossible** de rendre une image semi-transparente après insertion.

**Solution obligatoire :** cuire l'alpha dans le PNG **avant l'upload**, côté plugin :

```ts
// Dans ui.tsx (l'iframe a un DOM et un canvas ; le sandbox code.ts n'en a pas)
async function bakeAlpha(png: Uint8Array, opacity: number): Promise<Blob> {
  const bmp = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d')!;
  ctx.globalAlpha = opacity;
  ctx.drawImage(bmp, 0, 0);
  return c.convertToBlob({ type: 'image/png' });   // PNG avec canal alpha
}
```

**RÈGLE — z-order :** l'underlay doit être créé **en tout premier** dans la séquence de requêtes de sa slide (§2.4). Si l'ordre de création ne suffit pas, corrige avec un `UpdatePageElementsZOrderRequest { operation: 'SEND_TO_BACK' }` en fin de lot.

**RÈGLE — nommage :** donne à l'underlay un `objectId` reconnaissable (`f2s_<jobId>_underlay_<n>`) et mentionne dans l'UI comment le supprimer en masse une fois la vérification faite. Prévois un bouton « Retirer toutes les captures de contrôle » qui émet des `DeletePageElementRequest` ciblés sur ce préfixe.

**CRITÈRE :** avec l'option activée à 30 %, l'image de fond est visible derrière **tous** les autres éléments sur les 100 % des slides générées, et son opacité rendue correspond à ±0,05 près à la valeur demandée.

### 7.2 OPTIONNEL — Réordonnancement par drag & drop

> **Statut : OPTIONNEL.** À implémenter après §7.0.

Dans la grille de preview, les vignettes sont réorganisables à la souris ; l'ordre résultant détermine `IRSlide.order`.

**Contraintes d'implémentation :**

- Utilise l'**API HTML5 Drag & Drop native** ou une bibliothèque légère (`@dnd-kit/core`, ~10 ko). **Évite** `react-beautiful-dnd` (non maintenu, lourd pour un iframe de plugin).
- L'iframe du plugin a une **taille fixe** définie par `figma.showUI({width, height})` : la grille doit scroller, et l'auto-scroll pendant le drag près des bords est nécessaire.
- Feedback visuel : vignette source à 50 % d'opacité, **indicateur d'insertion** entre les vignettes (pas juste un surlignage de cible), transition CSS ≤ 150 ms.
- **Accessibilité :** un réordonnancement au clavier doit rester possible (flèches ↑↓ avec Ctrl, ou boutons « ◀ ▶ » sur chaque vignette). Le drag seul est un piège d'accessibilité.
- Renuméroter les badges « Slide N » **immédiatement** au drop, pas à l'export.
- Persiste l'ordre dans `figma.clientStorage` pour le restaurer si l'utilisateur rouvre le plugin sur la même sélection.

**CRITÈRE :** déplacer la vignette 5 en position 1 sur une grille de 12 met à jour les 12 numéros de slide instantanément, et la présentation générée respecte exactement cet ordre.

---

## 8. Plan d'implémentation

**RÈGLE :** une phase n'est terminée que quand **tous** ses critères d'acceptation passent en test automatisé. Ne démarre pas la phase N+1 avec des critères en échec en phase N.

### Phase 0 — Socle et calibration

- Monorepo : `packages/plugin`, `packages/backend`, `packages/shared`.
- Types IR (§6) dans `shared`, en dépendance des deux autres.
- `manifest.json` avec `networkAccess.allowedDomains` correctement renseigné.
- Harnais de calibration (§4) + `calibration.json`.
- Backend minimal : OAuth fonctionnel, `POST /export` acceptant un IR trivial (un rectangle).

**Acceptation :** `npm run calibrate` produit un rapport ; la frame « 5 rectangles » atteint SSIM ≥ 0,99 et écart ≤ 0,5 pt ; `textInset` est mesuré et documenté.

### Phase 1 — Texte et formes natifs

- Sérialisation Figma → IR pour `TEXT`, `RECTANGLE`, `ELLIPSE`, et frames à fond uni.
- Mapper IR → `SlidesRequest[]` : `CreateShape`, `InsertText`, `UpdateTextStyle` (par run), `UpdateParagraphStyle`, `UpdateShapeProperties`.
- Résolution des polices contre Google Fonts + table de substitution.
- Rotation (§3.2).

**Acceptation :** frames `text-simple`, `text-multi-style`, `shapes-basic`, `rotation` atteignent SSIM ≥ 0,95 et écart ≤ 1 pt ; 100 % des textes sont éditables dans Slides ; le mapper a une couverture de tests unitaires ≥ 80 % (tests purs IR → requêtes, sans appel réseau).

### Phase 2 — Images et rasterisation de fallback

- Arbre de décision (§3.3) implémenté et **testé nœud par nœud**.
- `exportAsync` des nœuds à rasteriser à `rasterScale` (défaut 2×), avec `absoluteRenderBounds` comme boîte cible.
- Extraction des fills image, upload backend, URLs signées, insertion, nettoyage des assets.
- Génération des `IRWarning`.

**Acceptation :** frames `gradients`, `vectors`, `effects`, `images` atteignent SSIM ≥ 0,95 ; chaque nœud rasterisé produit exactement un warning avec le bon code ; les assets temporaires sont supprimés après un export réussi (vérifié en test d'intégration).

### Phase 3 — Multi-frames et UI complète

- §7.0 en entier.
- Rapport de fidélité pré-export (§8.3).
- Gestion des échecs partiels et reprise.

**Acceptation :** critères de §7.0 ; un échec réseau simulé sur la slide 3 sur 5 laisse les slides 1, 2, 4, 5 intactes et propose une reprise ciblée.

### Phase 4 — OPTIONNEL

- §7.1 (underlay), puis §7.2 (drag & drop), dans cet ordre.

**Acceptation :** critères respectifs de §7.1 et §7.2.

### 8.3 Rapport de fidélité pré-export

Avant de lancer l'export, l'UI affiche un panneau récapitulatif — c'est la matérialisation de la promesse « pas de mauvaise surprise » :

```
┌───────────────────────────────────────────────┐
│  4 frames · 87 objets                         │
│                                               │
│  ✓ 71 objets natifs éditables          (82 %) │
│  ▣ 16 objets convertis en image        (18 %) │
│                                               │
│  ⚠ 2 polices substituées                      │
│      SF Pro Display → Inter      (12 textes)  │
│      Söhne → Open Sans            (3 textes)  │
│  ⚠ 9 dégradés rasterisés                      │
│  ⚠ 5 ombres portées rasterisées               │
│  ⓘ 2 rayons d'angle approximés                │
│                                               │
│  [Voir le détail]     [Annuler]  [Exporter]   │
└───────────────────────────────────────────────┘
```

**RÈGLE :** cliquer sur une ligne du rapport **sélectionne les nœuds concernés dans Figma** (`figma.currentPage.selection = nodes; figma.viewport.scrollAndZoomIntoView(nodes)`). C'est la fonctionnalité qui rend le rapport actionnable plutôt que décoratif.

---

## 9. Jeu de frames de test

À créer dans un fichier Figma dédié, exportées en fixtures (`PNG` + `IRDocument` JSON) versionnées dans le repo :

| Frame | Contenu | Ce qu'elle valide |
|---|---|---|
| `01-rects` | 5 rectangles unis aux coins et au centre | Coordonnées, échelle, z-order |
| `02-rotation` | Rectangles à 0/15/45/90/-30° | Transform affine |
| `03-text-simple` | 3 blocs, une police Google, un alignement chacun | Texte natif de base |
| `04-text-multi-style` | Un paragraphe à graisses/couleurs/tailles mixtes, liens, listes | `getStyledTextSegments`, runs |
| `05-text-edge` | Police non-Google, letter-spacing, textCase UPPER, line-height serré | Substitution, avertissements |
| `06-shapes` | Ellipses, polygones, étoiles, radius variés, strokes | Mapping des presets + règle radius |
| `07-gradients` | Linéaire, radial, angulaire, multi-stops | Rasterisation des fills |
| `08-effects` | Drop shadow, inner shadow, layer blur | Rasterisation des effets |
| `09-vectors` | Icônes, opérations booléennes, tracés custom | Rasterisation vectorielle |
| `10-images` | Photos avec crop, avec radius, masquées | Chaîne d'upload d'images |
| `11-autolayout` | Auto-layout imbriqué avec padding et gap | Aplatissement des positions |
| `12-realistic` | Slide marketing complète et crédible | **Frame de référence du critère global §1.2** |
| `13-batch` | 10 frames variées | Multi-frames, ordre, performance |

---

## 10. Livrables

- **Plugin Figma** : `manifest.json`, `code.ts`, `ui.tsx`, build via `esbuild` ou `create-figma-plugin`.
- **Backend** : Node.js + TypeScript + Express, OAuth Google, mapper, stockage d'assets, Dockerfile.
- **`packages/shared`** : types IR, seule source de vérité du contrat.
- **Harnais de calibration** : script + fixtures + rapport HTML.
- **Tests** : unitaires sur le mapper (pur, sans réseau), intégration sur le pipeline complet avec API Slides mockée, calibration visuelle contre l'API réelle.
- **`README.md`** : setup Google Cloud (activation d'API, écran de consentement OAuth, redirect URIs), variables d'environnement, lancement en dev.
- **`LIMITATIONS.md`** : §2.2 rédigé pour un designer, à afficher aussi dans l'UI du plugin.

---

## 11. Pièges connus — à lire avant de déboguer

1. **Couleurs en 0–1.** Slides attend `{red: 0.5}` et non `{red: 128}`. Une couleur > 1 est acceptée sans erreur et rendue en blanc.
2. **`fontFamily` invalide = échec silencieux.** Aucune erreur API, juste une police de remplacement. Valide en amont.
3. **`lineSpacing` est un pourcentage**, pas des points. `lineSpacing: 14` produit un texte écrasé et illisible.
4. **Le padding des text boxes n'est pas nul** et n'est pas réglable. Sans la compensation `textInset`, tous les textes sont décalés d'environ 1 à 4 pt.
5. **Contour par défaut.** Une forme créée sans `outline` explicite peut hériter d'un contour du thème. Force `outline.propertyState: 'NOT_RENDERED'` quand Figma n'a pas de stroke.
6. **Ordre de création = z-order.** Créer un fond après ses enfants les masque intégralement.
7. **`InsertTextRequest` avant `UpdateTextStyleRequest`.** Les index de style pointent vers du texte qui doit déjà exister — dans le même `batchUpdate`, l'ordre du tableau `requests` fait foi.
8. **Les index de texte comptent en UTF-16.** Emoji et caractères hors BMP occupent 2 unités. Les offsets Figma et Slides s'accordent sur cette convention, mais `String.length` en JS aussi — ne « corrige » pas avec `[...str].length`.
9. **`absoluteBoundingBox` ≠ `absoluteRenderBounds`.** Le second inclut ombres et blurs : c'est celui qu'il faut pour dimensionner un raster, sinon les effets sont coupés.
10. **`figma.mixed`** est renvoyé dès qu'une propriété varie dans un nœud texte. Toute lecture directe de `fontSize`/`fills` sur un `TextNode` doit être considérée comme un bug.
11. **Pas de `fetch` dans `code.ts`.** Tout appel réseau passe par `ui.tsx` via `postMessage`.
12. **`networkAccess.allowedDomains`** doit lister le domaine du backend, sinon les requêtes de l'iframe sont bloquées sans message clair.
13. **Quotas Slides.** Les limites par minute et par utilisateur sont réelles ; un export de 20 frames peut les atteindre. Le backoff n'est pas optionnel.
14. **La création d'une présentation renvoie une slide vide par défaut.** Supprime-la (`DeleteObjectRequest`) ou réutilise-la comme première slide — sinon le deck a une page blanche en tête.

---

## 12. Sources

- [Google Slides API — Shapes (`ShapeProperties`, `ShapeBackgroundFill`, `Autofit`)](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/shapes)
- [Google Slides API — Other (`SolidFill`, `Outline`, `Shadow`, `ImageProperties`, `CropProperties`)](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/other)
- [Google Slides API — Text (`TextStyle`, `ParagraphStyle`)](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/text)
- [Google Slides API — Add images to a slide](https://developers.google.com/workspace/slides/api/guides/add-image)
- [Google Slides API — Size and position page elements](https://developers.google.com/workspace/slides/api/guides/transform)
- [Google Slides API — Usage limits](https://developers.google.com/workspace/slides/api/limits)
- [Figma Plugin API — `ExportSettings`](https://developers.figma.com/docs/plugins/api/ExportSettings)
- [Figma Plugin API — Asynchronous tasks](https://figma.com/plugin-docs/async-tasks)
- [Figma Plugin API — `networkAccess` (manifest)](https://developers.figma.com/docs/plugins/updates/2023/05/10/version-1-update-66)
