# TODO

## Feedback utilisateur — audit 2026-08

Plusieurs points ci-dessous ont depuis été implémentés (le rapport de
fidélité du deck, l'affichage des erreurs, la position des dimensions et
du lien "Open presentation", l'animation rétro de progression du deck) —
gardés ici seulement comme trace de décision, ou reformulés en tâche
restante précise.

- ~~**Affichage des erreurs**~~ — fait (footer, par mode) : le backend
  renvoie des messages détaillés par slide (`Slide "Nom": Slides API 400
  — …`) et l'UI les affiche désormais (`ui.tsx`, corrigé dans `d271152`).
- ~~**Progression pendant l'export**~~ — fait, deck ET template : l'aperçu
  affiche la frame/le layout dont le lot est en cours d'application,
  "générée" bande par bande façon Windows 95, avec "Generating slide N of
  M" et une barre de progression (`ui/RetroExportPreview.tsx`,
  `ui/exportCursor.ts`). `TemplatePanel` reçoit désormais `exportCursor`
  comme `DeckPanel` (audit 2026-08) — il fallait aussi retirer la garde
  `exportModeRef.current === 'deck'` dans `applyLiveBatches` (`ui.tsx`),
  qui empêchait le cursor de se mettre à jour en mode template alors que
  `exportCursorFromBatches` est générique (indexé sur `sourceSlideId`,
  peu importe frame de deck ou layout de template).
- ~~**Rapport de fidélité du deck**~~ — fait : badge "N natifs · M
  rasterisés" + liste de warnings cliquable qui sélectionne l'élément dans
  Figma (`DeckPanel.tsx`).
- ~~**Lien "Open presentation"**~~ — fait : sorti du header, position
  définitive en footer à côté de Ko-fi.
- ~~**Emplacement des dimensions**~~ — fait : déplacé sous l'aperçu
  (`Dimensions : W × H px`), plus dans le header.
- ~~**Notice de sélection en mode deck**~~ — fait : affichée en toast
  absolu auto-dismiss (`.f2s-toast`, `DeckPanel.tsx`) plutôt qu'en texte
  inline (le rail de vignettes a une largeur fixe). Au passage, "Select
  frames to add" et "Prepare for Slides" sont désormais désactivés
  pendant qu'un export tourne, pour éviter de modifier `order`/`frames`
  sous les pieds de l'aperçu rétro en train de dérouler le deck.
- ~~**Retour d'erreur sur une vignette de layout bloquante**~~ — fait
  (audit 2026-08) : badge rond rouge "!" en surimpression (coin
  haut-droit de la vignette, `.f2s-frame-preview--blocking::after`) en
  plus de la bordure pleine `--color-error` — se remarque même quand la
  bordure seule se distingue mal sur un contenu déjà coloré. Angles droits
  en win95/hybrid, cohérent avec chaque skin ; le `title` explicatif au
  survol reste inchangé.
- ~~**Indicateur de chargement du bouton "Sign in with Google".**~~ — fait :
  spinner + libellé dédié aux deux moments d'attente (`.f2s-spinner`,
  `.f2s-btn-loading`, déjà présents en CSS mais jamais câblés) — "Preparing
  sign-in…" pendant l'appel au backend qui récupère l'URL Google au
  montage, puis "Waiting for Google sign-in…" après clic sur le lien, tout
  le temps du polling (`pollAuthSession`, jusqu'à 10 min), piloté par le
  nouveau state `authLinkClicked` (`ui.tsx`).
- ~~**Avertissements non bloquants dans le rapport template**~~ — fait
  (audit 2026-08) : nouvelle section "Notes" dans `TemplatePanel.tsx`
  (entre "Fix before creating the template" et "Placeholders"), liste les
  warnings `info`/`warning` (police substituée, rayon approximé…) en style
  neutre — cliquable, sélectionne l'élément dans Figma comme les autres
  entrées du rapport.

## Divers

- ~~**`POST /auth/google` systématique et inutile à chaque ouverture du
  plugin.**~~ — fait (audit 2026-08) : `useEffect(() => { if
  (!sessionToken) startLogin() }, [])` (`ui.tsx`) se déclenchait au montage
  AVANT que `code.ts` ait pu répondre à `ui-ready` par
  `session-token-restored` (lecture asynchrone de `clientStorage`) — donc
  un appel réseau partait même quand une session persistée allait être
  restaurée l'instant d'après. Corrigé : `code.ts` envoie désormais
  toujours ce message (token vide si rien n'est stocké), et l'UI attend
  cette réponse explicite avant de décider de démarrer l'OAuth
  (`authHandshakeDoneRef`), avec un timeout de 2 s en filet de sécurité si
  le message n'arrive jamais.
- ~~**Cookie de session potentiellement non fonctionnel en prod
  (`trust proxy`).**~~ — fait : `routes/auth.ts` pose le cookie avec
  `secure: req.secure`, mais `index.ts` n'appelait jamais `app.set('trust
  proxy', …)` — derrière le proxy Vercel, Express ne peut détecter le
  HTTPS d'origine que via `X-Forwarded-Proto`, qui n'est lu que si `trust
  proxy` est activé. Sans ce réglage, `req.secure` valait probablement
  `false` en prod HTTPS, et un cookie `SameSite=None; Secure:false` est
  silencieusement rejeté par le navigateur — le fallback cookie (censé
  compenser un polling défaillant en iframe sandboxée) risquait de ne
  jamais fonctionner en prod. `app.set('trust proxy', 1)` ajouté.
- ~~**Mode template : rien n'empêchait de modifier les layouts pendant un
  export/une création de template en cours.**~~ — fait : "Select layout to
  add", "Prepare for Slides" (template) et le bouton de bascule
  deck/template sont désormais désactivés pendant `exporting`, symétrique
  à la protection déjà en place côté deck.
- ~~**Interaction retry × lot thème.**~~ — fait, et plus grave que ce que
  cette note décrivait initialement : le lot thème (`THEME_BATCH_SOURCE_ID`,
  `mapper/theme.ts`) n'était en réalité jamais inclus dans `job.batches`
  dès la création du job (`routes/export.ts::createJob` ne listait que les
  `sourceNodeId` des slides), pas seulement à la reprise — un échec du lot
  thème dès le PREMIER essai était donc avalé silencieusement
  (`updateBatchStatus` ne trouvait rien à mettre à jour) et
  `POST /export/:jobId/retry` répondait `200 {pendingSlideIds: []}` sans
  rien rejouer, laissant le job `failed` sans aucun moyen de réparation.
  Corrigé (audit 2026-08) : la sentinelle thème est ajoutée à
  `job.batches` si `doc.theme` est présent, `masterObjectId` est persisté
  sur le `JobRecord` dès la création de la présentation
  (`jobs/runner.ts::runExportJob`), et `retryExportJob` le réutilise pour
  reconstruire le lot thème. Test dédié dans `jobs/runner.test.ts`.
- ~~**"Buy me a coffee".**~~ — fait : lien réel
  ([ko-fi.com/billelt](https://ko-fi.com/billelt)), ouverture dans un
  nouvel onglet.

## Mode template — refonte interface & flow (audit 2026-08, benchmark workflow expert Slides / limites API)

Confrontation de deux docs de référence (workflow d'un expert Slides côté
métier, limites techniques de l'API Slides côté technique) avec le code
existant, puis **validation en conditions réelles** via un spike
(`packages/backend/src/spikes/masterThemeSpike.ts`, bouton "Run theme
spike" du plugin, testé le 2026-08 — captures d'écran à l'appui : écriture
confirmée, bandeau témoin hérité sur toutes les slides, éditeur "Modifier
le thème" affichant déjà la palette custom). Deux conclusions corrigées
par rapport à un précédent audit et aux deux docs de référence, qui
affirmaient tous les deux le contraire :

- **Le vrai thème Slides (couleurs) EST modifiable en écriture** —
  `UpdatePagePropertiesRequest` sur la page `Master`, 12 `ThemeColorType`
  d'un coup, et un élément peut être lié à un slot via `OpaqueColor.themeColor`
  plutôt qu'un `rgbColor` figé. Voir `LIMITATIONS.md` § Création de template.
- **Un élément posé sur le Master s'hérite bien** sur toute slide qui
  référence un layout descendant — confirmé visuellement, pas juste déduit
  du schéma. Le master peut donc porter le chrome récurrent (logo, footer,
  mention de confidentialité) une seule fois plutôt que dupliqué par slide.

Ce qui NE change pas : toujours aucun nouvel objet `Layout` créable en
écriture (`CreateSlideRequest` ne fait que référencer un des ~8 layouts
prédéfinis) — les variantes de mise en page restent des slides normales
avec leurs placeholders, ce n'est pas un problème puisque c'est là
qu'était la vraie valeur de toute façon (le master lui-même ne porte
typiquement que le chrome, pas les variantes).

Backlog, dans un ordre de dépendance logique (le premier point débloque
les suivants) :

1. ~~**Mapper : écrire le vrai thème plutôt que des aplats statiques.**~~
   — fait. `IRDocument.theme` (12 rôles, `packages/shared/src/ir.ts`) +
   `IRColor.themeRole` dans le contrat partagé ; `mapper/theme.ts`
   construit le lot `updatePageProperties` sur le Master, préfixé par
   `mapDocumentToBatches` quand `doc.theme` ET un `masterObjectId` sont
   fournis (`slides/client.ts` le renvoie désormais depuis la même
   réponse `presentations.create`, sans appel réseau supplémentaire) ;
   `colors.ts::toOpaqueColor` émet `themeColor` au lieu de `rgbColor`
   quand `themeRole` est renseigné. Testé (nouveaux tests `theme.test.ts`,
   `colors.test.ts`, `client.test.ts`, `index.test.ts`). **Encore inerte
   en pratique** : rien ne construit `doc.theme` ni n'assigne `themeRole`
   côté plugin faute d'UI — c'est le point 2 (l'onglet "Style") qui
   consommera cette capacité.
2. ~~**Onglet "Style" au niveau du template entier**~~ — fait pour la
   partie couleurs (l'essentiel, ce qui alimente le mapper). Nouvel onglet
   "View: Layouts / Style" dans le toolbar du mode template
   (`ui/TemplateStylePanel.tsx`) : agrège couleurs + polices de TOUS les
   layouts (`aggregateColorSwatches`/`aggregateFontUsages`,
   `serialize/templateSummary.ts`) plutôt que par layout, avec un
   `<select>` par couleur pour lui assigner un rôle parmi les 12
   `ThemeColorType` (empêche d'assigner deux fois le même rôle). À
   l'export, `code.ts::handleTemplateCreateRequest` lie ces couleurs aux
   éléments via `themeRole` et construit `IRDocument.theme`
   (`serialize/templateTheme.ts` : `applyThemeRolesToElements` +
   `buildTemplateTheme`, avec repli sur une palette par défaut pour les
   rôles non assignés — l'API exige les 12 d'un coup). Strictement
   additif : un template dont le créateur ne touche pas l'onglet Style
   s'exporte à l'identique d'avant.
   **Pas fait dans cette passe** (gardé simple pour livrer la partie
   fonctionnelle d'abord) :
   - Rôles pré-suggérés à partir du **nom du style de couleur Figma**
     (`fillStyleId`/variable liée) — toujours non lu par
     `serializeFrame.ts`, qui ne capture que la couleur résolue.
   - Regroupement des polices par rôle (Heading/Body) — l'onglet Style
     affiche la liste agrégée mais sans cette étiquette.
   - Bouton "Harmoniser" (réécrire les calques Figma d'une couleur
     quasi-identique vers le hex canonique du rôle) — resté un rapport en
     lecture seule pour les polices, l'assignation de rôle couleur ne
     modifie aucun calque Figma en retour.
3. **Chrome de master (logo/footer/watermark) posé une seule fois.** UI
   pour désigner un ou plusieurs éléments Figma comme "chrome récurrent"
   (plutôt que de les dupliquer manuellement sur chaque layout comme
   aujourd'hui) ; à l'export, ces éléments sont écrits sur la page Master
   plutôt que sur chaque slide individuellement.
   **Point bloquant relevé à l'audit 2026-09, à traiter AVANT d'écrire le
   code** : `mapper/index.ts::mapBackground` crée, sur chaque slide, un
   rectangle plein cadre en tout premier plan arrière quand la frame Figma
   a un fond uni, ce qui est le cas courant. Un élément posé sur le Master
   est rendu DERRIÈRE le contenu de la slide : le chrome hérité serait donc
   intégralement masqué par ce rectangle, et la fonctionnalité paraîtrait
   ne rien faire. Ce n'est donc pas un simple portage du mapper vers
   `pageObjectId: masterObjectId` ; il faut d'abord décider ce que devient
   ce fond de slide en mode template (le déplacer lui aussi sur le Master ?
   ne plus l'émettre quand un chrome de master existe ? le rendre
   transparent ?). À valider par un spike comme l'a été l'écriture du thème
   (`spikes/masterThemeSpike.ts`), plutôt qu'en déduction : aucun
   environnement Figma/Slides réel n'est disponible côté dev.
4. ~~**Slide de style guide optionnelle.**~~ — abandonné (2026-08-03) :
   l'idée initiale (checkbox à l'export générant une slide swatches/rôles/
   échantillon typo en 1ère position) servait surtout de preuve visuelle de
   ce qui a été écrit dans le vrai thème. Devenu redondant maintenant que le
   point 1 écrit le vrai `colorScheme` sur le Master — la palette est déjà
   visible nativement dans l'éditeur "Modifier le thème" de Google Slides
   une fois le template exporté, pas besoin d'une slide fabriquée pour la
   prouver.
5. **Étiquette "Cover/Master" purement visuelle** sur une vignette du rail
   de layouts — distincte du chrome réellement écrit sur le Master (point
   3), juste pour que le rail se lise comme un vrai jeu de layouts
   (Cover → Section → Content).
6. ~~**Texte de placeholder visuellement explicite.**~~ — fait (audit
   2026-08) : `serialize/templatePlaceholderText.ts::applyPlaceholderText`
   remplace, uniquement au moment de la création du TEMPLATE (jamais un
   export de deck), le contenu réel d'un élément texte tagué par
   `[Title]`/`[Body text]`/… — style (police, taille, couleur, alignement)
   du run/paragraphe d'origine conservé, juste réappliqué au texte plus
   court. L'aperçu du plugin (capture Figma) continue de montrer le VRAI
   contenu, seul l'IRDocument envoyé au backend change. Prépare toujours le
   terrain pour un futur `replaceAllText` automatisé (technique du doc API
   qu'on n'utilise pas du tout aujourd'hui : on ne pose que l'alt text
   `f2s-placeholder:<RÔLE>`, jamais de token `{{title}}` dans le texte
   lui-même).
7. ~~**Validation de composition des templates.**~~ : fait (audit
   2026-09) : `serialize/templateComposition.ts`, trois codes de warning
   NON bloquants, appliqués après `enforceTemplateStrictness` (jamais
   avant : ils n'ont rien à faire dans le jeu de codes que celle-ci
   reclasse en bloquant) et affichés dans une section "Composition" à part
   du rapport, avec message sur plusieurs lignes plutôt que tronqué sur
   une seule, puisqu'ils disent quoi FAIRE.
   - `PLACEHOLDER_ROLE_DUPLICATE` : deux calques tagués du même rôle dans
     le même layout (lequel est LE titre ?). Signalé sur CHAQUE occurrence,
     pour pouvoir cliquer les deux et arbitrer. Deux `[[custom:...]]` ne
     sont des doublons que s'ils partagent le même libellé.
   - `PLACEHOLDER_ROLE_KIND_MISMATCH` : `[[image]]`/`[[logo]]` sur un
     calque texte, ou `[[title]]`/`[[subtitle]]`/`[[body]]` sur autre chose
     qu'un texte. Une FORME reste acceptée pour `[[image]]` : un rectangle
     vide qui réserve l'emplacement est le cas normal.
   - `LAYOUT_WITHOUT_PLACEHOLDER` (`info`) : layout sans aucun placeholder,
     porté par la frame elle-même. Volontairement le plus doux des trois,
     une slide de séparation est un cas légitime.
8. ~~**Réordonnancement par glisser-déposer des layouts de template.**~~ —
   fait (audit 2026-08) : même mécanique de drag au pointeur que
   `DeckPanel.tsx` (`ui/reorderFrames.ts`), portée telle quelle sur
   `TemplatePanel.tsx` (nouvelle prop `setOrder`).
9. ~~**Remplacer la convention de nom de calque `[[role]]`** par un contrôle
   actif.~~ : fait (audit 2026-09). Le sélecteur de rôle existait déjà mais
   n'était greffé que sur les entrées du rapport de FIDÉLITÉ : seul un
   calque ayant, par hasard, un problème de rendu (police substituée,
   dégradé...) pouvait se voir assigner un rôle depuis le plugin. Un layout
   parfaitement propre, donc sans aucun avertissement, n'offrait aucun
   moyen de taguer quoi que ce soit ; il fallait aller renommer le calque à
   la main dans Figma, exactement ce que ce point voulait supprimer.
   Désormais : `summarizeTaggableElements` (`serialize/templateSummary.ts`)
   remonte TOUS les calques taguables du layout (les lignes non taguées
   exceptées), la section "Content" du rapport les liste avec leur rôle
   courant et un sélecteur, et l'option "No role" retire le tag
   (`clearPlaceholderTag`), ce qu'aucun contrôle ne savait faire jusqu'ici.
   Le rôle proposé est filtré par TYPE d'élément (`placeholderRoleTagsForKind`)
   plutôt que par code de warning. La convention de nom reste évidemment
   valide et interopérable : le sélecteur ne fait que poser/retirer le
   `[[role]]` sur le vrai nom de calque.
   Le stockage en `pluginData` évoqué à l'origine reste écarté : le nom de
   calque est visible et modifiable directement dans le panneau de calques
   Figma, sans aller-retour avec l'UI du plugin (voir `placeholder.ts`).
10. **Outil compagnon "dupliquer un layout + remplir ses placeholders"** —
    idée de backlog pour l'utilisateur FINAL d'un template (pas son
    créateur) : repérer automatiquement titre/image/corps de texte grâce au
    tag `f2s-placeholder:<RÔLE>` déjà posé en alt text côté Slides (et, si
    le point 6 sur `replaceAllText` est fait, remplir directement via un
    `batchUpdate` plutôt qu'à la main), pour l'aider à remplir une nouvelle
    slide dupliquée depuis un layout. **Hors périmètre de l'UI du plugin
    Figma** (2026-08-03) : cet utilisateur final travaille dans Google
    Slides une fois le template déjà exporté, pas dans Figma — ce serait un
    outil séparé (ex. Apps Script côté Slides), pas un panneau du plugin.

~~**Nettoyage**~~ — fait : la route temporaire `routes/spike.ts` et le
bouton "Run theme spike" du footer plugin ont été retirés une fois la
validation confirmée. `packages/backend/src/spikes/masterThemeSpike.ts`
reste comme script CLI de diagnostic ponctuel (`npm run spike:theme`).

## Audit plugin 2026-09 : corrections de bugs

Trois défauts trouvés en relisant le mode template, tous silencieux (aucun
message d'erreur, aucun plantage : le plugin donnait simplement un résultat
qui ne correspondait pas à ce que l'utilisateur avait demandé).

- ~~**Le champ de nom d'une vignette de layout ne faisait rien.**~~ : fait.
  `onRename` (`TemplatePanel.tsx`) ne mettait à jour que l'état de l'UI. Le
  nom n'était jamais renvoyé au sandbox : ni l'export (qui repart de
  `frame.name` via `slide.frameName`), ni la réouverture du plugin (où
  `loadTaggedFrames` recharge les layouts depuis Figma) ne le voyaient. Un
  créateur qui renommait ses layouts "Cover / Section / Content" retrouvait
  ses noms Figma d'origine au rechargement suivant, sans avertissement.
  Corrigé : nouveau message `rename-template-layout`, qui renomme la VRAIE
  frame Figma, à la validation seulement (blur ou Entrée) plutôt qu'à
  chaque frappe, car renommer le nœud à chaque caractère déclencherait autant
  de `nodechange`, donc autant de re-sérialisations du layout par le live
  refresh. Le nom sert aussi de libellé aux erreurs par slide remontées par
  le backend (`jobs/runner.ts`), qui deviennent donc lisibles.
- ~~**Rôles de thème fantômes.**~~ : fait. `colorRoles` (`ui.tsx`) est
  indexé par couleur (`colorKey`), jamais par layout, et rien ne le
  purgeait quand une couleur disparaissait du template (layout retiré, ou
  recoloré dans Figma puis re-sérialisé). Trois conséquences, toutes
  silencieuses : un rôle restait marqué "(in use)" dans chaque sélecteur
  sans qu'aucune ligne visible ne le porte ; la notification de
  réassignation citait une clé brute (`#RRGGBB:1.00`) faute de couleur à
  nommer ; et surtout `buildTemplateTheme` écrivait quand même un thème sur
  le Master (l'objet `colorRoles` n'étant pas vide), imposant au template
  toute la palette de repli `DEFAULT_THEME_ROLE_COLORS` alors qu'aucune
  couleur visible n'avait de rôle assigné. Corrigé par un effet de purge
  sur `templateColors`, neutre tant qu'aucune couleur n'est connue (au
  montage, ou entre le retrait du dernier layout et l'ajout du suivant),
  où tout effacer serait le pire moment.
- ~~**Un rôle de placeholder ne pouvait plus être retiré.**~~ : fait. Le
  sélecteur savait poser un tag, jamais en enlever un : son option vide
  était `disabled` ("Set placeholder role…"). Un rôle assigné par erreur ne
  pouvait être défait qu'en renommant le calque à la main dans Figma.
  Ajout de `clearPlaceholderTag` (`serialize/placeholder.ts`) et de
  l'option "No role". Un calque dont le tag était TOUT le nom ne se
  retrouve pas sans nom (Figma le renommerait selon son type, le repère
  visuel serait perdu dans le panneau de calques) : il garde son libellé
  par défaut ("Title", "Body text"...).

Contrat partagé touché au passage : `IRBase.sourceNodeName` (optionnel,
jamais lu par le mapper backend). Jusqu'ici, seul `IRWarning` transportait
un nom de calque lisible, et c'est précisément pourquoi le rapport de
template ne savait parler que des calques ayant un avertissement.

## Checklist de test manuel — trouver les limites réelles du plugin

Pas encore vérifié contre un vrai fichier Figma ni un vrai export Slides
(voir LIMITATIONS.md § état du projet — pas d'environnement Figma/Google
dans cet environnement de dev). À dérouler dans un fichier Figma réel,
avec "Prepare for Slides" ET un export brut (sans préparation) pour
comparer les deux, puis vérification du rendu final dans Slides.

- **Couleurs**
  - [ ] Remplissage solide simple, avec opacité < 100 %.
  - [ ] Styles de couleur Figma (fill styles) partagés entre plusieurs calques.
  - [ ] Couleur de contour (stroke) distincte de la couleur de fill.
- **Dégradés**
  - [ ] Linéaire 2 stops → vérifier que "Prepare for Slides" les aplatit
        en solide (couleur du 1er stop) plutôt que de rasteriser.
  - [ ] Linéaire/radial/angulaire à 3+ stops (aplatissement forcément
        avec perte des stops intermédiaires — vérifier que c'est
        acceptable visuellement).
  - [ ] Dégradé appliqué à un contour (stroke), pas juste un fill.
  - [ ] Dégradé sur une LINE (outil Ligne).
- **Images**
  - [ ] Image simple (fill IMAGE) sans transformation.
  - [ ] Image recadrée (crop) / mode "Fill" vs "Fit" vs "Tile".
  - [ ] Image avec coins arrondis ou masque de forme.
  - [ ] Image semi-transparente (opacité réduite).
  - [ ] Très grande image source (poids/temps d'export, cf. limite 413
        déjà traitée côté upload par lots).
- **Formes simples (natif attendu)**
  - [ ] Rectangle sans rayon, avec rayon dans la plage supportée (8–25 %
        du plus petit côté), et pilule (rayon ≥ moitié du plus petit côté).
  - [ ] Rectangle à rayon non uniforme entre les 4 coins → vérifier
        l'uniformisation automatique par "Prepare for Slides".
  - [ ] Rectangle à rayon très faible (< 8 %) ou très fort mais non pilule
        (> 25 %) → vérifier le clamp à 0 ou à la borne haute.
  - [ ] Ellipse, avec/sans contour.
  - [ ] Contour multiple, contour "à l'intérieur"/"à l'extérieur" (non
        centré), épaisseur mixte par côté → vérifier l'unification en un
        seul contour centré.
- **Formes complexes (raster attendu, à confirmer visuellement fidèle)**
  - [ ] Icône vectorielle custom (VECTOR).
  - [ ] Opération booléenne (union/soustraction/intersection).
  - [ ] Étoile et polygone à un nombre de côtés inhabituel (5, 7, 12…).
  - [ ] Groupe avec `clipsContent` et enfants qui débordent.
  - [ ] Calque masqué par un calque au-dessus (masque de calque Figma).
- **Lignes (outil Ligne)**
  - [ ] Ligne simple, pointillée, avec épaisseur variée.
  - [ ] Terminaison décorative (flèche, losange, cercle) → vérifier la
        normalisation à "aucune terminaison" par "Prepare for Slides".
- **Effets**
  - [ ] Ombre portée, ombre interne, flou de calque, flou d'arrière-plan
        → vérifier qu'ils sont bien retirés par "Prepare for Slides" (et
        rasterisés si on exporte sans préparation).
- **Modes de fusion**
  - [ ] Multiply, Screen, Darken, etc. sur un calque avec fond visible
        derrière (vérifier le rendu rasterisé à l'export brut).
- **Texte**
  - [ ] Police déjà disponible dans Slides (Roboto, Arial…) — pas de
        substitution attendue.
  - [ ] Police absente de la liste (ex. police custom de marque) —
        vérifier la substitution auto ET le remplacement par le choix
        fait dans le select "Fonts" de l'UI.
  - [ ] Styles mixtes dans un même bloc (gras + normal + italique sur des
        mots différents).
  - [ ] Espacement des lettres (tracking) prononcé → vérifier qu'il est
        bien remis à 0 par "Prepare for Slides".
  - [ ] Interligne : "Auto", valeur en % et valeur en px, chacun testé.
  - [ ] "Vertical trim" activé sur un texte → vérifier la désactivation.
  - [ ] Alignement vertical Top/Center/Bottom et horizontal
        Left/Center/Right/Justify.
  - [ ] Texte tout en majuscules / petites capitales / casse de titre
        (text case Figma).
  - [ ] Zone de texte en largeur/hauteur fixe vs "hug" (auto-resize) vs
        troncature.
  - [ ] Retour à la ligne manuel (Maj+Entrée) au milieu d'un paragraphe.
  - [ ] Lien hypertexte sur une partie du texte.
  - [ ] Liste à puces / numérotée, indentation.
- **Structure**
  - [ ] Auto-layout (imbriqué sur plusieurs niveaux) → vérifier
        l'aplatissement en positions fixes par "Prepare for Slides".
  - [ ] Frame/groupe/composant imbriqués sur 3+ niveaux de profondeur.
  - [ ] Élément tourné (texte, forme, ligne) à un angle quelconque.
  - [ ] Deck de 20+ frames (seuil `MAX_FRAMES_WARNING`) — vérifier le
        message d'avertissement et le temps de traitement.
- **Flow "Prepare for Slides" spécifiquement**
  - [ ] Re-cliquer "Prepare for Slides" sur une copie déjà taguée
        (retravaillée entre-temps) — doit relinter en place, pas
        dupliquer une nouvelle copie.
  - [ ] Fermer et rouvrir le plugin avec des frames déjà taguées sur le
        canvas — doivent réapparaître automatiquement dans le panneau
        sans re-sélection.
  - [ ] Vérifier que les repères rouges de lint ne se dupliquent pas au
        fil des re-préparations, et disparaissent bien si le problème est
        corrigé.
- **Mode template**
  - [ ] Élément tagué `[[title]]`, `[[body]]`, `[[image]]`, `[[logo]]`,
        `[[custom:...]]` → vérifier le rapport de placeholders et l'alt
        text posé côté Slides après création.
  - [ ] Layout avec un élément qui serait rasterisé → vérifier que la
        création de template est bien bloquée tant qu'il n'est pas corrigé.
  - [ ] Layout 100% propre (aucun avertissement) → la section "Content"
        doit quand même lister ses calques et permettre de leur assigner un
        rôle (audit 2026-09, point 9).
  - [ ] Assigner un rôle depuis le sélecteur, puis choisir "No role" →
        le tag `[[role]]` doit apparaître puis disparaître du nom de calque
        dans Figma, et le rapport se rafraîchir tout seul (live refresh).
  - [ ] Deux calques tagués `[[title]]` dans le même layout, puis un layout
        sans aucun placeholder, puis `[[image]]` sur un calque texte →
        vérifier les trois entrées de la section "Composition", et que
        AUCUNE ne bloque le bouton "Create template".
  - [ ] Renommer un layout dans le rail, fermer et rouvrir le plugin →
        le nom doit persister (la frame Figma elle-même est renommée).
  - [ ] Assigner un rôle de thème à une couleur, puis retirer le layout qui
        la portait → le rôle ne doit plus être compté "(in use)", et un
        template sans plus aucune couleur assignée ne doit PAS écrire de
        thème sur le Master.
- **Après export réel dans Slides**
  - [ ] Comparer visuellement le rendu Slides à la copie "Prepare for
        Slides" sur le canvas Figma (c'est censé être la même chose).
  - [ ] Vérifier qu'aucun élément natif n'est resté éditable de façon
        cassée (texte débordant, forme mal positionnée, couleur éteinte).
