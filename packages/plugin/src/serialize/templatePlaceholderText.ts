import type { IRElement, IRParagraph, IRText, IRTextRun } from '@figma-to-slides/shared';

/**
 * Le texte RÉEL d'un calque tagué `[[role]]` part aujourd'hui tel quel vers
 * Slides — rien ne distingue, dans le résultat, un placeholder "à remplir"
 * d'un contenu final (TODO.md § Mode template, point 6). Remplace le
 * contenu d'un élément texte placeholder par un indicateur lisible
 * (`[Title]`, `[Body text]`…) au moment de la création du template, pour
 * que quiconque duplique une slide à la main — même sans le plugin —
 * comprenne immédiatement qu'il faut le remplacer.
 *
 * Ne touche jamais le style : le premier run/paragraphe d'origine (police,
 * taille, couleur, alignement…) est réappliqué au nouveau texte, juste
 * raccourci à sa longueur. Pure et immutable comme le reste de
 * `serialize/` : renvoie de nouveaux éléments, ne mute jamais ceux passés
 * en entrée.
 */
export function applyPlaceholderText(elements: IRElement[]): IRElement[] {
  return elements.map((el): IRElement => {
    if (el.kind !== 'text' || !el.placeholder) return el;
    const text = el as IRText;
    const placeholder = text.placeholder!;
    const content = `[${placeholder.label}]`;

    const baseRun = text.runs[0];
    const runs: IRTextRun[] = baseRun ? [{ ...baseRun, start: 0, end: content.length }] : [];

    const baseParagraph = text.paragraphs[0];
    const paragraphs: IRParagraph[] = baseParagraph ? [{ ...baseParagraph, start: 0, end: content.length }] : [];

    return { ...text, content, runs, paragraphs };
  });
}
