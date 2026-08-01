import type { ExportOptions, IRDocument, IRSlide } from '@figma-to-slides/shared';
import { createIdGenerator } from './serialize/ids.js';
import { serializeFrame } from './serialize/serializeFrame.js';
import { lintFrame, type LintWarning } from './serialize/lintFrame.js';
import { reformatForSlides } from './serialize/reformatForSlides.js';
import { enforceTemplateStrictness, hasBlockingWarnings } from './serialize/templateValidation.js';
import { summarizeColors, summarizeFonts, summarizePlaceholders } from './serialize/templateSummary.js';

const MAX_FRAMES_WARNING = 20;
/**
 * Un template reste un petit jeu de layouts réutilisables (cf. "Simple
 * Light" et les ~8 layouts prédéfinis d'une présentation Slides neuve) —
 * pas un deck complet : le plafond est volontairement plus bas que
 * `MAX_FRAMES_WARNING`.
 */
const TEMPLATE_MAX_LAYOUTS = 10;
// 320px produisait un aperçu visiblement pixellisé une fois agrandi dans le
// grand canvas de l'UI (jusqu'à 640px CSS, donc ~1280px physiques en HiDPI).
const PREVIEW_WIDTH = 960;

// Brief "copie de vérification" — donnée stockée directement dans le
// fichier Figma (survit à la fermeture du plugin/fichier, contrairement à
// localStorage/sessionStorage dans l'iframe) pour retrouver les frames
// prêtes à l'export sans dépendre de la sélection courante. La VALEUR du
// tag distingue une copie de deck ('true', valeur historique) d'une copie
// de layout de template ('template') : à la réouverture du plugin, chacune
// doit repeupler SA liste, jamais celle de l'autre mode.
const SLIDES_READY_KEY = 'slidesExportReady';
const DECK_TAG = 'true';
const TEMPLATE_TAG = 'template';
const LINT_GROUP_ID_KEY = 'slidesLintGroupId';
const SLIDES_READY_PREFIX = '[Slides Ready] ';
const TEMPLATE_READY_PREFIX = '[Template Ready] ';
const COPY_GAP_PX = 200;
// Jeton de session backend, persisté via clientStorage (survit à la
// fermeture du plugin — l'iframe UI, elle, n'a aucun stockage durable) pour
// ne pas refaire l'OAuth Google à chaque ouverture. Chaque export crée une
// présentation NEUVE côté backend (mode 'new-presentation') : réutiliser la
// session Google ne peut donc jamais écraser un deck déjà envoyé.
const SESSION_TOKEN_STORAGE_KEY = 'f2s:sessionToken';
// Les deux réglages de la modale, persistés pour la même raison que le jeton
// de session : l'iframe UI est recréée à chaque ouverture et n'a aucun
// stockage durable, donc un choix ne survit que s'il est gardé côté sandbox.
//
// Habillage visuel de l'UI ('win95' par défaut, 'modern' pour le design
// system historique).
const UI_SKIN_STORAGE_KEY = 'f2s:uiSkin';
// Thème forcé depuis la modale de réglages ('light' | 'dark'). Absent =
// l'UI suit le thème de Figma (`themeColors: true`).
const THEME_STORAGE_KEY = 'f2s:theme';

type ExportableNode = FrameNode | ComponentNode | InstanceNode;

function isExportable(node: SceneNode): node is ExportableNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
}

function readyTagOf(node: SceneNode): string {
  return node.getPluginData(SLIDES_READY_KEY);
}

function isSlidesReady(node: SceneNode): boolean {
  return readyTagOf(node) === DECK_TAG;
}

function isTemplateReady(node: SceneNode): boolean {
  return readyTagOf(node) === TEMPLATE_TAG;
}

function stripReadyPrefix(name: string): string {
  if (name.startsWith(SLIDES_READY_PREFIX)) return name.slice(SLIDES_READY_PREFIX.length);
  if (name.startsWith(TEMPLATE_READY_PREFIX)) return name.slice(TEMPLATE_READY_PREFIX.length);
  return name;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Linter visuel (brief export ponctuel) : au lieu de faire chercher à
 * l'utilisateur les substitutions de police dans le texte des warnings,
 * on les extrait ici sous forme structurée pour l'en-tête "Polices" de
 * l'UI (une paire par famille remplacée, dédupliquée).
 */
function collectFontSubstitutions(slide: PendingSlide['slide']): { original: string; resolved: string }[] {
  const seen = new Set<string>();
  const subs: { original: string; resolved: string }[] = [];
  for (const el of slide.elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      if (!run.originalFontFamily) continue;
      const key = `${run.originalFontFamily}→${run.fontFamily}`;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ original: run.originalFontFamily, resolved: run.fontFamily });
    }
  }
  return subs;
}

/** Applique le choix manuel de police fait dans le select "Fonts" de l'UI, par famille d'origine. */
function applyFontOverrides(slide: PendingSlide['slide'], overrides: Record<string, string>): void {
  if (Object.keys(overrides).length === 0) return;
  for (const el of slide.elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      const override = run.originalFontFamily && overrides[run.originalFontFamily];
      if (override) run.fontFamily = override;
    }
  }
}

async function generatePreview(node: ExportableNode): Promise<string> {
  const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: PREVIEW_WIDTH } });
  return `data:image/png;base64,${figma.base64Encode(bytes)}`;
}

interface PendingSlide {
  frame: ExportableNode;
  slide: Omit<IRSlide, 'order' | 'previewDataUrl'>;
  nodesToRaster: Map<string, SceneNode[]>;
}

/** Construit et poste le message décrivant l'état sérialisé courant d'une frame — partagé entre un premier ajout et un rafraîchissement en place. */
function postCandidateMessage(type: 'candidate-added' | 'candidate-updated', frame: ExportableNode, previewDataUrl: string, slide: PendingSlide['slide']): void {
  const nativeCount = slide.elements.filter((e) => e.kind !== 'image' || !e.isRasterFallback).length;
  const rasterCount = slide.elements.length - nativeCount;
  figma.ui.postMessage({
    type,
    frame: { id: frame.id, name: frame.name, width: frame.width, height: frame.height },
    previewDataUrl,
    nativeCount,
    rasterCount,
    warnings: slide.warnings,
    fontSubstitutions: collectFontSubstitutions(slide),
  });
}

/**
 * Une présentation Slides n'a qu'UNE taille de page, fixée à la création
 * (voir `computeSlideSizePt`) : mélanger des frames de ratios différents ne
 * produirait que des slides déformées ou letterboxées à l'arrivée. Plutôt
 * que de laisser faire et décevoir à l'export, les frames dont le ratio
 * s'écarte de celui de la référence (la première frame de la liste) sont
 * refusées à l'ajout, avec une notification qui explique pourquoi.
 */
const RATIO_TOLERANCE = 0.01;

function sameAspectRatio(a: { width: number; height: number }, b: { width: number; height: number }): boolean {
  if (a.height <= 0 || b.height <= 0) return false;
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / rb <= RATIO_TOLERANCE;
}

function filterMatchingRatio(nodes: ExportableNode[], reference: ExportableNode | undefined): ExportableNode[] {
  const ref = reference ?? nodes[0];
  if (!ref) return nodes;
  const kept = nodes.filter((n) => sameAspectRatio(n, ref));
  const rejected = nodes.length - kept.length;
  if (rejected > 0) {
    figma.notify(
      `${rejected} frame(s) skipped: a Slides presentation has a single page size, so every frame must match the aspect ratio of "${stripReadyPrefix(ref.name)}".`,
      { error: true, timeout: 6000 },
    );
  }
  return kept;
}

/**
 * Ajoute au deck une liste de frames déjà résolues (pas de doublon avec ce
 * qui est déjà dans `pending`) — logique commune à l'ajout manuel (sélection
 * sur le canvas) et à la découverte automatique des frames taguées
 * `slidesExportReady` au lancement du plugin (brief §"Nouveau flux proposé"
 * point 5 : aucune re-sélection manuelle requise).
 */
async function addFrames(nodes: ExportableNode[], pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const known = new Set(pending.map((p) => p.frame.id));
  const candidates = nodes.filter((n) => !known.has(n.id));
  const toAdd = filterMatchingRatio(candidates, pending[0]?.frame);
  if (toAdd.length === 0) return;
  if (toAdd.length > MAX_FRAMES_WARNING) {
    figma.ui.postMessage({ type: 'too-many-frames', count: toAdd.length, max: MAX_FRAMES_WARNING });
  }

  // Spec §7.0 RÈGLE performance : séquentiel avec yield entre chaque frame,
  // pour ne jamais figer l'UI Figma plus de 200ms d'affilée (§7.0 CRITÈRE).
  for (const frame of toAdd) {
    const previewDataUrl = await generatePreview(frame);
    const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
    pending.push({ frame, slide, nodesToRaster });
    postCandidateMessage('candidate-added', frame, previewDataUrl, slide);
    await yieldToUi();
  }
}

/**
 * Ré-analyse une frame déjà connue de `pending` (re-sérialisation + relint)
 * et remplace son entrée EN PLACE plutôt que d'en pousser une nouvelle —
 * utilisé à la fois par "Prepare for Slides" re-cliqué sur une copie déjà
 * taguée, et par le suivi live des frames `[Slides Ready]` (voir
 * `watchFramesForLiveRefresh` plus bas). Ne fait rien si la frame n'est pas (ou
 * plus) suivie — évite de repêcher silencieusement une frame retirée du
 * panneau côté UI (`removeFrame`, purement local à l'UI).
 */
async function refreshPendingEntry(frame: ExportableNode, pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<boolean> {
  const idx = pending.findIndex((p) => p.frame.id === frame.id);
  if (idx === -1) return false;

  const previewDataUrl = await generatePreview(frame);
  const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
  pending[idx] = { frame, slide, nodesToRaster };

  const warnings = await lintFrame(frame);
  await addLintAnnotations(frame, warnings);

  postCandidateMessage('candidate-updated', frame, previewDataUrl, slide);
  return true;
}

/**
 * Ajoute au deck les frames actuellement sélectionnées sur le canvas Figma
 * (déclenché par le bouton « Select frames to add » de l'UI) — l'utilisateur
 * choisit explicitement quoi exporter et dans quel ordre construire sa liste.
 */
async function addSelectedFrames(pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const selected = figma.currentPage.selection.filter(isExportable);
  if (selected.length === 0) {
    figma.ui.postMessage({ type: 'no-frames-selected' });
    return;
  }
  await addFrames(selected, pending, idGen);
}

/**
 * Brief "Nouveau flux proposé" point 5 — retrouve automatiquement, sans
 * dépendre de la sélection courante, les frames taguées `slidesExportReady`
 * lors d'une session précédente (copie de vérification retravaillée sur le
 * canvas puis plugin fermé/rouvert).
 */
async function loadTaggedFrames(pending: PendingSlide[], templatePending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const deckTagged = figma.currentPage.findAll((n) => isExportable(n) && isSlidesReady(n)) as ExportableNode[];
  if (deckTagged.length > 0) await addFrames(deckTagged, pending, idGen);

  // Même reprise de session pour le mode template : les copies `[Template
  // Ready]` d'une session précédente repeuplent la liste de layouts.
  const templateTagged = figma.currentPage.findAll((n) => isExportable(n) && isTemplateReady(n)) as ExportableNode[];
  if (templateTagged.length > 0) await addTemplateLayoutNodes(templateTagged, templatePending, idGen);
}

/**
 * Aplatit récursivement l'auto-layout de la copie — Slides n'a pas
 * d'équivalent et l'export bake déjà les positions au moment du batchUpdate
 * (LIMITATIONS.md) ; désactiver l'auto-layout ICI, sur la copie de
 * vérification, fige les positions actuelles sans bouger un seul pixel
 * (Figma préserve les positions courantes des enfants en désactivant le
 * mode) — évite qu'un redimensionnement accidentel de la copie pendant le
 * "refine pixel perfect" ne réagence tout le contenu.
 */
function flattenAutoLayout(node: SceneNode): void {
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    node.layoutMode = 'NONE';
  }
  if ('children' in node) {
    for (const child of node.children) flattenAutoLayout(child);
  }
}

/** Retire l'annotation de lint précédente de cette copie, le cas échéant (évite l'accumulation à chaque re-préparation). */
async function removeLintAnnotations(copy: ExportableNode): Promise<void> {
  const groupId = copy.getPluginData(LINT_GROUP_ID_KEY);
  if (!groupId) return;
  const group = await figma.getNodeByIdAsync(groupId);
  if (group && !group.removed) group.remove();
  copy.setPluginData(LINT_GROUP_ID_KEY, '');
}

/**
 * Brief "Approche retenue" — linter visuel : place un repère rouge au
 * coin haut-droit de chaque calque qui serait rasterisé à l'export, en
 * SIBLING de la copie (jamais un enfant) pour ne jamais polluer le contenu
 * réellement exporté. Positionné en coordonnées absolues (repère direct
 * enfant de la page), donc correct même si la copie est imbriquée.
 */
async function addLintAnnotations(copy: ExportableNode, warnings: LintWarning[]): Promise<void> {
  await removeLintAnnotations(copy);
  if (warnings.length === 0) return;

  const badges: EllipseNode[] = [];
  for (const w of warnings) {
    const node = await figma.getNodeByIdAsync(w.nodeId);
    if (!node || !('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) continue;
    const box = node.absoluteBoundingBox;
    const badge = figma.createEllipse();
    badge.resize(10, 10);
    badge.x = box.x + box.width - 5;
    badge.y = box.y - 5;
    badge.fills = [{ type: 'SOLID', color: { r: 0.94, g: 0.23, b: 0.18 } }];
    badge.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    badge.strokeWeight = 1;
    badge.name = `⚠ ${w.nodeName} — ${w.message}`;
    badges.push(badge);
  }
  if (badges.length === 0) return;

  const group = badges.length > 1 ? figma.group(badges, figma.currentPage) : badges[0];
  group.name = `Slides lint — ${stripReadyPrefix(copy.name)}`;
  group.locked = true;
  if ('expanded' in group) group.expanded = false;
  copy.setPluginData(LINT_GROUP_ID_KEY, group.id);
}

/**
 * Brief "Nouveau flux proposé" points 2-3 — génère (ou retravaille, si la
 * sélection est déjà une copie taguée) la copie de vérification : dupliquée
 * à côté de l'originale, taguée `slidesExportReady`, préfixée dans son nom,
 * auto-layout aplati, puis relintée pour poser les annotations à jour.
 */
async function prepareFrameForSlides(
  source: ExportableNode,
  fontOverrides: Record<string, string>,
  tag: typeof DECK_TAG | typeof TEMPLATE_TAG = DECK_TAG,
): Promise<{ copy: ExportableNode; warnings: LintWarning[] }> {
  let copy: ExportableNode;
  if (readyTagOf(source) === tag) {
    copy = source;
  } else {
    const clone = source.clone();
    if (!isExportable(clone)) throw new Error(`Unexpected clone type for "${source.name}"`);
    copy = clone;
    copy.x = source.x + source.width + COPY_GAP_PX;
    copy.y = source.y;
    copy.name = (tag === TEMPLATE_TAG ? TEMPLATE_READY_PREFIX : SLIDES_READY_PREFIX) + stripReadyPrefix(source.name);
    copy.setPluginData(SLIDES_READY_KEY, tag);
  }

  flattenAutoLayout(copy);
  await reformatForSlides(copy, fontOverrides);
  const warnings = await lintFrame(copy);
  await addLintAnnotations(copy, warnings);
  return { copy, warnings };
}

/**
 * Handler du bouton "Prepare for Slides" — prépare une copie de vérification
 * pour CHAQUE frame du deck actuel (le panneau du plugin, `deckFrameIds`),
 * union avec la sélection canvas courante s'il y en a une en plus : cliquer
 * le bouton n'exige donc plus de re-sélectionner sur le canvas exactement
 * les frames déjà listées dans le panneau (source d'oublis/frustration —
 * seul un sous-ensemble se faisait préparer sinon). Recentre le canvas Figma
 * sur les copies (c'est la "preview" : l'utilisateur voit tout de suite la
 * version reformatée posée à côté de l'originale, prête pour le "refine
 * pixel perfect"), puis les ajoute au panneau comme le ferait "Add
 * selection" — sauf pour une copie déjà taguée `[Slides Ready]`, où c'est
 * son entrée EXISTANTE qui est rafraîchie en place (voir
 * `refreshPendingEntry`), pas une nouvelle qui s'ajoute en double.
 */
async function handlePrepareForSlides(
  pending: PendingSlide[],
  idGen: ReturnType<typeof createIdGenerator>,
  fontOverrides: Record<string, string>,
  deckFrameIds: string[],
): Promise<void> {
  const deckNodes = (await Promise.all(deckFrameIds.map((id) => figma.getNodeByIdAsync(id))))
    .filter((n): n is ExportableNode => n !== null && isExportable(n as SceneNode));
  const canvasSelected = figma.currentPage.selection.filter(isExportable);

  const targets = new Map<string, ExportableNode>();
  for (const n of [...deckNodes, ...canvasSelected]) targets.set(n.id, n);

  if (targets.size === 0) {
    figma.notify('Select at least one frame on the canvas, or add frames to the deck first.', { error: true });
    return;
  }

  const copies: ExportableNode[] = [];
  const newlyCreated: ExportableNode[] = [];
  let totalWarnings = 0;

  for (const frame of targets.values()) {
    const wasAlreadyTagged = isSlidesReady(frame);
    const { copy, warnings } = await prepareFrameForSlides(frame, fontOverrides);
    copies.push(copy);
    totalWarnings += warnings.length;

    if (wasAlreadyTagged) {
      await refreshPendingEntry(copy, pending, idGen);
    } else {
      newlyCreated.push(copy);
      // La frame BRUTE d'origine était déjà dans le panneau (ex. ajoutée via
      // "Select frames to add" avant d'être préparée) : remplacée par sa
      // copie prête pour Slides plutôt que doublée dans la liste.
      const rawIdx = pending.findIndex((p) => p.frame.id === frame.id);
      if (rawIdx !== -1) {
        pending.splice(rawIdx, 1);
        figma.ui.postMessage({ type: 'candidate-removed', id: frame.id });
      }
    }
    await yieldToUi();
  }

  figma.currentPage.selection = copies;
  figma.viewport.scrollAndZoomIntoView(copies);

  const label = copies.length === 1 ? 'frame' : 'frames';
  figma.notify(
    totalWarnings === 0
      ? `Prepared ${copies.length} ${label} for Slides — no issues found.`
      : `Prepared ${copies.length} ${label} for Slides — ${totalWarnings} issue(s) flagged on canvas (red markers).`,
  );

  await addFrames(newlyCreated, pending, idGen);
}

/** Pendant `template-candidate-added`/`-updated` : sérialisation + stricture template + résumés (couleurs/typos/placeholders), partagé entre ajout, refresh en place et live refresh. */
function postTemplateCandidateMessage(type: 'template-candidate-added' | 'template-candidate-updated', frame: ExportableNode, previewDataUrl: string, slide: PendingSlide['slide']): void {
  figma.ui.postMessage({
    type,
    frame: { id: frame.id, name: frame.name, width: frame.width, height: frame.height },
    previewDataUrl,
    warnings: slide.warnings,
    blocking: hasBlockingWarnings(slide.warnings),
    placeholders: summarizePlaceholders(slide.elements),
    colors: summarizeColors(slide.elements),
    fonts: summarizeFonts(slide.elements),
    fontSubstitutions: collectFontSubstitutions(slide),
  });
}

/**
 * Ajoute au template une liste de frames déjà résolues (brief-creation-
 * template-google-slides.md) — un layout par frame, comme `addFrames` pour
 * un deck, mais avec trois différences :
 * 1. les avertissements de rasterisation sont reclassés en bloquants
 *    (`enforceTemplateStrictness`) : un template doit rester 100% natif ;
 * 2. l'UI reçoit en plus les placeholders/couleurs/typos détectés, pour le
 *    rapport de contenu communicable (couleurs, typos, layouts) ;
 * 3. le plafond `TEMPLATE_MAX_LAYOUTS` est DUR (l'ajout au-delà est refusé,
 *    pas juste signalé) : c'est une limite produit du plugin — un template
 *    reste un petit jeu de layouts, comme les ~8 layouts prédéfinis d'une
 *    présentation Slides neuve — pas une limite de l'API Slides.
 */
async function addTemplateLayoutNodes(nodes: ExportableNode[], pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const known = new Set(pending.map((p) => p.frame.id));
  const candidates = filterMatchingRatio(nodes.filter((n) => !known.has(n.id)), pending[0]?.frame);
  if (candidates.length === 0) return;

  const remaining = TEMPLATE_MAX_LAYOUTS - pending.length;
  const toAdd = candidates.slice(0, Math.max(0, remaining));
  if (toAdd.length < candidates.length) {
    figma.ui.postMessage({ type: 'too-many-frames', count: pending.length + candidates.length, max: TEMPLATE_MAX_LAYOUTS });
    figma.notify(
      `A template is capped at ${TEMPLATE_MAX_LAYOUTS} layouts (plugin limit to keep templates focused) — ${candidates.length - toAdd.length} frame(s) not added.`,
      { error: true, timeout: 6000 },
    );
  }

  for (const frame of toAdd) {
    const previewDataUrl = await generatePreview(frame);
    const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
    slide.warnings = enforceTemplateStrictness(slide.warnings);
    pending.push({ frame, slide, nodesToRaster });
    postTemplateCandidateMessage('template-candidate-added', frame, previewDataUrl, slide);
    await yieldToUi();
  }
}

/** Ajoute au template les frames actuellement sélectionnées sur le canvas (bouton « Select layout to add »). */
async function addSelectedTemplateLayouts(pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const selected = figma.currentPage.selection.filter(isExportable);
  if (selected.length === 0) {
    figma.ui.postMessage({ type: 'no-frames-selected' });
    return;
  }
  await addTemplateLayoutNodes(selected, pending, idGen);
}

/**
 * Pendant template de `refreshPendingEntry` — referme la boucle centrale du
 * mode template : l'utilisateur corrige un problème bloquant dans Figma, le
 * layout se re-valide TOUT SEUL dans le panneau (via le live refresh
 * ci-dessous), sans supprimer/re-ajouter. Les annotations de lint sur le
 * canvas ne sont posées que sur une copie `[Template Ready]` (jamais sur une
 * frame source brute, que le plugin ne doit pas décorer sans opt-in).
 */
async function refreshTemplateEntry(frame: ExportableNode, pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<boolean> {
  const idx = pending.findIndex((p) => p.frame.id === frame.id);
  if (idx === -1) return false;

  const previewDataUrl = await generatePreview(frame);
  const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
  slide.warnings = enforceTemplateStrictness(slide.warnings);
  pending[idx] = { frame, slide, nodesToRaster };

  if (isTemplateReady(frame)) {
    const warnings = await lintFrame(frame);
    await addLintAnnotations(frame, warnings);
  }

  postTemplateCandidateMessage('template-candidate-updated', frame, previewDataUrl, slide);
  return true;
}

/**
 * « Prepare for Slides » du mode template — même flow que le deck
 * (`handlePrepareForSlides`), mais tague les copies `[Template Ready]` et
 * alimente la liste de layouts : le reformatage automatique (dégradés
 * aplatis en solide, ombres retirées, tracking remis à 0…) élimine
 * mécaniquement la majorité des avertissements BLOQUANTS du mode template,
 * là où il n'était qu'optionnel pour un deck.
 */
async function handlePrepareTemplateForSlides(
  pending: PendingSlide[],
  idGen: ReturnType<typeof createIdGenerator>,
  fontOverrides: Record<string, string>,
  layoutFrameIds: string[],
): Promise<void> {
  const listNodes = (await Promise.all(layoutFrameIds.map((id) => figma.getNodeByIdAsync(id))))
    .filter((n): n is ExportableNode => n !== null && isExportable(n as SceneNode));
  const canvasSelected = figma.currentPage.selection.filter(isExportable);

  const targets = new Map<string, ExportableNode>();
  for (const n of [...listNodes, ...canvasSelected]) targets.set(n.id, n);

  if (targets.size === 0) {
    figma.notify('Select at least one frame on the canvas, or add layouts to the template first.', { error: true });
    return;
  }

  const copies: ExportableNode[] = [];
  const newlyCreated: ExportableNode[] = [];
  let totalWarnings = 0;

  for (const frame of targets.values()) {
    const wasAlreadyTagged = isTemplateReady(frame);
    const { copy, warnings } = await prepareFrameForSlides(frame, fontOverrides, TEMPLATE_TAG);
    copies.push(copy);
    totalWarnings += warnings.length;

    if (wasAlreadyTagged) {
      await refreshTemplateEntry(copy, pending, idGen);
    } else {
      newlyCreated.push(copy);
      const rawIdx = pending.findIndex((p) => p.frame.id === frame.id);
      if (rawIdx !== -1) {
        pending.splice(rawIdx, 1);
        figma.ui.postMessage({ type: 'template-candidate-removed', id: frame.id });
      }
    }
    await yieldToUi();
  }

  figma.currentPage.selection = copies;
  figma.viewport.scrollAndZoomIntoView(copies);

  const label = copies.length === 1 ? 'layout' : 'layouts';
  figma.notify(
    totalWarnings === 0
      ? `Prepared ${copies.length} ${label} for Slides — no issues found.`
      : `Prepared ${copies.length} ${label} for Slides — ${totalWarnings} issue(s) flagged on canvas (red markers).`,
  );

  await addTemplateLayoutNodes(newlyCreated, pending, idGen);
}

// Propriétés qu'une frame `[Slides Ready]` peut voir changer SANS que ce
// soit un vrai édit utilisateur : uniquement le plugin data qu'on écrit
// nous-mêmes (tag `slidesExportReady`, id du groupe de lint) pendant une
// préparation ou un rafraîchissement — les ignorer évite qu'un
// `refreshPendingEntry` déclenche, via son propre `setPluginData`, un nouvel
// événement `nodechange` qui reprogrammerait indéfiniment un rafraîchissement
// (boucle infinie).
const LIVE_REFRESH_IGNORABLE_PROPERTIES = new Set<NodeChangeProperty>(['pluginData']);

function isOnlyIgnorableNodeChange(change: NodeChange): boolean {
  return change.type === 'PROPERTY_CHANGE' && change.properties.every((p) => LIVE_REFRESH_IGNORABLE_PROPERTIES.has(p));
}

/** Remonte l'arbre depuis le nœud modifié jusqu'à la première frame suivie (et acceptée par `accepts`) rencontrée, s'il y en a une. */
function nearestTrackedAncestor(node: BaseNode, trackedIds: Set<string>, accepts: (node: SceneNode) => boolean): ExportableNode | undefined {
  let current: BaseNode | null = node;
  while (current) {
    if (isExportable(current as SceneNode) && trackedIds.has(current.id) && accepts(current as SceneNode)) {
      return current as ExportableNode;
    }
    current = 'parent' in current ? current.parent : null;
  }
  return undefined;
}

const LIVE_REFRESH_DEBOUNCE_MS = 700;

/**
 * Brief demandé : les frames `[Slides Ready]` retravaillées sur le canvas
 * après "Prepare for Slides" doivent se refléter dans le panneau/l'export
 * SANS re-sélection manuelle. On écoute les changements du document (scopé à
 * la page courante via `PageNode.on('nodechange', …)` — pas besoin de
 * `loadAllPagesAsync`, contrairement à l'event global `documentchange`, cf.
 * doc Figma), on ne retient que les frames déjà suivies (et acceptées par
 * `accepts`), puis on ne relance QUE la re-sérialisation + le relint (jamais
 * `reformatForSlides` : ce serait re-muter en continu des retouches
 * volontaires de l'utilisateur pendant qu'il travaille dessus).
 *
 * Généralisé aux deux modes :
 * - deck : uniquement les copies taguées `[Slides Ready]` (une frame brute
 *   du panneau reste libre d'être retouchée sans re-analyse) ;
 * - template : TOUTES les frames suivies, taguées ou non — c'est ce qui
 *   referme la boucle « corrige l'erreur bloquante dans Figma → le layout
 *   se re-valide dans le panneau » sans supprimer/re-ajouter.
 */
function watchFramesForLiveRefresh(
  pending: PendingSlide[],
  accepts: (node: SceneNode) => boolean,
  refresh: (frame: ExportableNode) => Promise<boolean>,
): void {
  const dirtyIds = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    timer = undefined;
    const ids = [...dirtyIds];
    dirtyIds.clear();
    for (const id of ids) {
      try {
        const node = await figma.getNodeByIdAsync(id);
        if (!node || !isExportable(node as SceneNode)) continue;
        await refresh(node as ExportableNode);
      } catch (err) {
        console.error(`[figma-to-slides] live refresh failed for ${id}`, err);
      }
      await yieldToUi();
    }
  };

  figma.currentPage.on('nodechange', (event) => {
    if (pending.length === 0) return;
    const trackedIds = new Set(pending.map((p) => p.frame.id));
    let dirty = false;
    for (const change of event.nodeChanges) {
      if (change.type === 'DELETE') continue;
      if (isOnlyIgnorableNodeChange(change)) continue;
      const node = change.node;
      if (!node || (node as RemovedNode).removed) continue;
      const match = nearestTrackedAncestor(node as BaseNode, trackedIds, accepts);
      if (match) {
        dirtyIds.add(match.id);
        dirty = true;
      }
    }
    if (!dirty) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), LIVE_REFRESH_DEBOUNCE_MS);
  });
}

async function main(): Promise<void> {
  // Layout à deux colonnes (rail de miniatures + canvas) : plus large que
  // l'ancien panneau vertical, pour laisser une vraie zone de
  // prévisualisation. `themeColors: true` fait poser par Figma la classe
  // `figma-dark`/`figma-light` sur <html> — le CSS de l'UI s'en sert pour
  // basculer sa palette (styles.css).
  figma.showUI(__html__, { width: 960, height: 640, themeColors: true });

  const pending: PendingSlide[] = [];
  // Store distinct du deck : basculer entre "Export" et "Create a template"
  // dans l'UI ne doit ni mélanger les deux listes, ni perdre l'une pendant
  // qu'on construit l'autre.
  const templatePending: PendingSlide[] = [];
  const idGen = createIdGenerator(figma.root.id.slice(0, 8));

  // Permet à l'UI de masquer son hint « sélectionne des frames sur le
  // canvas » dès qu'une sélection exportable existe déjà, plutôt que de le
  // garder affiché même une fois l'action faite.
  figma.on('selectionchange', () => {
    figma.ui.postMessage({
      type: 'canvas-selection-changed',
      hasSelection: figma.currentPage.selection.some(isExportable),
    });
  });

  watchFramesForLiveRefresh(pending, isSlidesReady, (frame) => refreshPendingEntry(frame, pending, idGen));
  watchFramesForLiveRefresh(templatePending, () => true, (frame) => refreshTemplateEntry(frame, templatePending, idGen));

  figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'ui-ready') {
      // Brief "Nouveau flux proposé" point 5 — un `figma.ui.postMessage`
      // envoyé avant que l'iframe UI n'ait fini de charger son JS est
      // perdu (pas de mise en tampon côté `postMessage`) : on attend que
      // l'UI signale son montage avant de lui pousser les frames taguées
      // trouvées via `findAll`.
      //
      // On envoie aussi l'état de sélection courant : le bouton "Prepare
      // for Slides" en dépend dès le premier rendu, et l'événement
      // `selectionchange` ne se redéclenche pas si la sélection existait
      // déjà avant l'ouverture du plugin.
      figma.ui.postMessage({
        type: 'canvas-selection-changed',
        hasSelection: figma.currentPage.selection.some(isExportable),
      });
      // Skin persisté : envoyé en tout premier pour que l'UI repeigne son
      // premier rendu avant d'afficher quoi que ce soit d'autre (sinon on
      // verrait le skin par défaut clignoter vers celui choisi).
      try {
        const storedSkin = await figma.clientStorage.getAsync(UI_SKIN_STORAGE_KEY);
        if (storedSkin === 'win95' || storedSkin === 'modern') {
          figma.ui.postMessage({ type: 'skin-restored', skin: storedSkin });
        }
      } catch (err) {
        console.error(err);
      }
      // Session Google persistée (voir SESSION_TOKEN_STORAGE_KEY) : envoyée
      // AVANT les frames taguées pour que l'UI sache tout de suite si le
      // bouton Export/Create doit être actif ou proposer la connexion.
      try {
        const storedToken = await figma.clientStorage.getAsync(SESSION_TOKEN_STORAGE_KEY);
        if (typeof storedToken === 'string' && storedToken.length > 0) {
          figma.ui.postMessage({ type: 'session-token-restored', token: storedToken });
        }
      } catch (err) {
        console.error(err);
      }
      // Thème forcé lors d'une session précédente : envoyé avant les frames
      // pour que l'UI ne s'affiche pas d'abord dans le thème de Figma avant de
      // basculer sous les yeux de l'utilisateur.
      try {
        const storedTheme = await figma.clientStorage.getAsync(THEME_STORAGE_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark') {
          figma.ui.postMessage({ type: 'theme-preference-restored', theme: storedTheme });
        }
      } catch (err) {
        console.error(err);
      }
      try {
        await loadTaggedFrames(pending, templatePending, idGen);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (msg.type === 'save-theme-preference') {
      try {
        await figma.clientStorage.setAsync(THEME_STORAGE_KEY, msg.theme as string);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (msg.type === 'save-session-token') {
      try {
        await figma.clientStorage.setAsync(SESSION_TOKEN_STORAGE_KEY, msg.token as string);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (msg.type === 'save-ui-skin') {
      try {
        await figma.clientStorage.setAsync(UI_SKIN_STORAGE_KEY, msg.skin as string);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Bouton de fermeture de la barre de titre Windows 95 : la seule des
    // trois cases classiques qui ait un équivalent réel côté Figma (pas de
    // réduction/agrandissement pour une iframe de plugin), donc la seule
    // rendue par l'UI.
    if (msg.type === 'close-plugin') {
      figma.closePlugin();
      return;
    }

    if (msg.type === 'clear-session-token') {
      try {
        await figma.clientStorage.deleteAsync(SESSION_TOKEN_STORAGE_KEY);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (msg.type === 'add-selected-frames') {
      try {
        await addSelectedFrames(pending, idGen);
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
      }
      return;
    }

    if (msg.type === 'prepare-for-slides') {
      try {
        await handlePrepareForSlides(pending, idGen, (msg.fontOverrides as Record<string, string> | undefined) ?? {}, (msg.deckFrameIds as string[] | undefined) ?? []);
      } catch (err) {
        console.error(err);
        figma.notify(`Prepare for Slides failed: ${(err as Error).message}`, { error: true });
      }
      return;
    }

    if (msg.type === 'add-template-layout') {
      try {
        await addSelectedTemplateLayouts(templatePending, idGen);
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
      }
      return;
    }

    if (msg.type === 'prepare-template-for-slides') {
      try {
        await handlePrepareTemplateForSlides(
          templatePending,
          idGen,
          (msg.fontOverrides as Record<string, string> | undefined) ?? {},
          (msg.layoutFrameIds as string[] | undefined) ?? [],
        );
      } catch (err) {
        console.error(err);
        figma.notify(`Prepare for Slides failed: ${(err as Error).message}`, { error: true });
      }
      return;
    }

    if (msg.type === 'select-nodes') {
      // Spec §8.3 RÈGLE — cliquer sur une ligne du rapport sélectionne les nœuds dans Figma.
      const ids = msg.nodeIds as string[];
      const resolved = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
      const nodes = resolved.filter((n): n is SceneNode => n !== null && 'x' in n);
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
      return;
    }

    if (msg.type === 'request-export') {
      // Sans ce try/catch, une exception ici (p. ex. `exportAsync` qui
      // échoue sur un nœud dégénéré) rejette silencieusement cette promesse
      // — l'UI n'a aucun moyen de le savoir et reste bloquée indéfiniment
      // sur "analyse en cours", sans le moindre message d'erreur.
      try {
        await handleExportRequest(
          msg as unknown as {
            includedFrameIds: string[];
            order: string[];
            options: ExportOptions;
            presentationTitle: string;
            fontOverrides?: Record<string, string>;
          },
          pending,
        );
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
      }
      return;
    }

    if (msg.type === 'request-template') {
      try {
        await handleTemplateCreateRequest(
          msg as unknown as {
            includedFrameIds: string[];
            order: string[];
            presentationTitle: string;
            fontOverrides?: Record<string, string>;
          },
          templatePending,
        );
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
      }
    }
  };
}

// Une présentation Slides n'a qu'une seule taille de page, fixée à la
// création (aucune requête batchUpdate ne permet de la changer ensuite) —
// on la dérive donc du ratio de la première frame plutôt que de forcer le
// 16:9 par défaut de Slides (720x405pt), qui laissait des bandes vides
// quand la frame source n'était pas déjà en 16:9. Ancré sur le plus grand
// des deux côtés pour rester dans un ordre de grandeur de points familier
// quelle que soit l'orientation de la frame.
const REFERENCE_SIDE_PT = 720;

function computeSlideSizePt(frameSize: { width: number; height: number } | undefined): { widthPt: number; heightPt: number } {
  if (!frameSize || frameSize.width <= 0 || frameSize.height <= 0) {
    return { widthPt: REFERENCE_SIDE_PT, heightPt: REFERENCE_SIDE_PT * (9 / 16) };
  }
  const { width, height } = frameSize;
  return width >= height
    ? { widthPt: REFERENCE_SIDE_PT, heightPt: REFERENCE_SIDE_PT * (height / width) }
    : { widthPt: REFERENCE_SIDE_PT * (width / height), heightPt: REFERENCE_SIDE_PT };
}

/**
 * Commun aux deux flux (deck export §7.0, template creation ci-dessus) :
 * applique les overrides de police, rasterise les nœuds qui le nécessitent
 * (formes marquées `nodesToRaster`, qu'il s'agisse d'un vrai raster fallback
 * ou d'une image Figma extraite telle quelle), et construit les `IRSlide`
 * finaux dans l'ordre demandé.
 */
async function collectSlidesAndAssets(
  pending: PendingSlide[],
  orderedIds: string[],
  fontOverrides: Record<string, string>,
  rasterScale: 2 | 3 | 4,
): Promise<{ slides: IRSlide[]; assets: { assetKey: string; bytes: Uint8Array; mimeType: string }[] }> {
  const byId = new Map(pending.map((p) => [p.frame.id, p]));

  const slides: IRSlide[] = [];
  const assets: { assetKey: string; bytes: Uint8Array; mimeType: string }[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const p = byId.get(orderedIds[i]);
    if (!p) continue;

    applyFontOverrides(p.slide, fontOverrides);

    for (const [assetKey, nodes] of p.nodesToRaster) {
      const node = nodes[0];
      const scaleConstraint = { type: 'SCALE' as const, value: rasterScale };
      try {
        const bytes = await node.exportAsync({ format: 'PNG', constraint: scaleConstraint });
        assets.push({ assetKey, bytes, mimeType: 'image/png' });
      } catch (err) {
        // Un nœud dégénéré (p. ex. une LINE dont la bounding box a une
        // largeur ou hauteur nulle sur un axe) fait échouer `exportAsync` —
        // on saute cet asset plutôt que de faire échouer tout l'export : le
        // reste des slides reste exportable, celui-ci apparaîtra juste sans
        // cette image.
        console.error(`[export] échec de rasterisation pour ${node.name} (${node.id})`, err);
      }
      await yieldToUi();
    }

    slides.push({ ...p.slide, order: i, previewDataUrl: '' });
  }

  return { slides, assets };
}

function postExportPayload(doc: IRDocument, assets: { assetKey: string; bytes: Uint8Array; mimeType: string }[]): void {
  figma.ui.postMessage({
    type: 'export-payload',
    document: doc,
    assets: assets.map((a) => ({ assetKey: a.assetKey, mimeType: a.mimeType })),
  });

  for (const asset of assets) {
    figma.ui.postMessage({ type: 'export-asset', assetKey: asset.assetKey, bytes: asset.bytes.buffer });
  }
}

async function handleExportRequest(
  msg: {
    includedFrameIds: string[];
    order: string[];
    options: ExportOptions;
    presentationTitle: string;
    fontOverrides?: Record<string, string>;
  },
  pending: PendingSlide[],
): Promise<void> {
  const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));
  const { slides, assets } = await collectSlidesAndAssets(pending, orderedIds, msg.fontOverrides ?? {}, msg.options.rasterScale);

  const doc: IRDocument = {
    version: 1,
    presentationTitle: msg.presentationTitle,
    slideSize: computeSlideSizePt(slides[0]?.frameSize),
    slides,
    options: msg.options,
  };

  postExportPayload(doc, assets);
}

/**
 * Crée le template final : réutilise TEL QUEL le pipeline d'export d'un
 * deck (mêmes endpoints backend `/assets` + `/export`, cf. ui.tsx) — un
 * template n'est, côté API Slides, qu'une présentation dont chaque slide
 * est un layout réutilisable plutôt qu'un contenu final. La différence
 * tient entièrement en amont : contraintes actives pendant la création
 * (`enforceTemplateStrictness`) et tags de placeholder (`placeholder.ts`,
 * matérialisés en alt text côté mapper backend).
 *
 * Garde-fou serveur : refuse la création si une layout a encore un
 * avertissement bloquant, même si l'UI est censée déjà désactiver le
 * bouton — un aller-retour manuel entre plusieurs sélections ne doit
 * jamais pouvoir contourner la contrainte.
 */
async function handleTemplateCreateRequest(
  msg: {
    includedFrameIds: string[];
    order: string[];
    presentationTitle: string;
    fontOverrides?: Record<string, string>;
  },
  pending: PendingSlide[],
): Promise<void> {
  const byId = new Map(pending.map((p) => [p.frame.id, p]));
  const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));

  const blocked = orderedIds.map((id) => byId.get(id)).find((p): p is PendingSlide => Boolean(p) && hasBlockingWarnings(p!.slide.warnings));
  if (blocked) {
    figma.ui.postMessage({
      type: 'export-error',
      message: `"${blocked.frame.name}" still contains elements that would be converted to images — fix them in Figma before creating the template.`,
    });
    return;
  }

  const { slides, assets } = await collectSlidesAndAssets(pending, orderedIds, msg.fontOverrides ?? {}, 2);

  const doc: IRDocument = {
    version: 1,
    presentationTitle: msg.presentationTitle,
    slideSize: computeSlideSizePt(slides[0]?.frameSize),
    slides,
    options: { mode: 'new-presentation', rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: true },
  };

  postExportPayload(doc, assets);
}

main().catch((err) => {
  console.error(err);
  figma.notify(`Plugin error: ${(err as Error).message}`, { error: true });
});
