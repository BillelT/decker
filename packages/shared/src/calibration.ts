/**
 * Sortie du harnais de calibration (spec §4). Consommé par le mapper pour
 * compenser les écarts non documentés par l'API Slides (padding interne des
 * text boxes, rayon effectif des ROUND_RECTANGLE, etc.).
 */
export interface CalibrationData {
  /** Marge interne réelle des TEXT_BOX, en pt. */
  textInset: { left: number; right: number; top: number; bottom: number };
  /** Rayon effectif d'un ROUND_RECTANGLE en fonction de min(w,h). */
  roundRectRadiusRatio: number;
  /** Épaisseur par défaut héritée quand aucun `outline` n'est fourni. */
  defaultOutlineWeightPt: number;
  /** Rapport réel entre lineSpacing:100 et la hauteur de ligne rendue. */
  lineSpacingBaseline: number;
  /** Seuil de tolérance pour accepter un ROUND_RECTANGLE natif (spec §3.3). */
  radiusNativeTolerance: { min: number; max: number };
  /**
   * Marge de sécurité ajoutée à la largeur de chaque TEXT_BOX, exprimée en
   * multiple de la taille de police du plus grand run qu'elle contient.
   * Même police et taille nominales, le moteur de rendu de Figma et celui de
   * Slides ne produisent jamais des largeurs de glyphes strictement
   * identiques (hinting, shaping différents) — sans marge, un texte à
   * largeur ajustée pile sur son contenu (`textAutoResize` hug, fréquent
   * pour un libellé court sur son propre calque) retourne à la ligne de
   * façon inattendue dans Slides, parfois en pleine mot, alors qu'il tenait
   * sur une ligne dans Figma.
   */
  textWidthSafetyMarginEm: number;
  /**
   * Marge additionnelle (em, s'ajoute à `textWidthSafetyMarginEm`) quand la
   * police du texte a dû être substituée (spec fonts.ts côté plugin) — les
   * métriques de caractères d'une police de repli diffèrent forcément de
   * celles de la police d'origine.
   */
  textWidthSafetyMarginSubstitutedFontEm: number;
  /**
   * Marge additionnelle (em) quand le texte est en `tightFit` (§ci-dessus,
   * `textAutoResize: 'WIDTH_AND_HEIGHT'` — très fréquent pour un libellé
   * dans un auto-layout Figma) : la boîte n'a alors aucun jeu du tout, donc
   * le moindre écart de rendu fait retourner le texte à la ligne.
   */
  textWidthSafetyMarginTightFitEm: number;
  /**
   * Marge additionnelle proportionnelle à la largeur de la boîte (0..1),
   * appliquée uniquement en `tightFit`. Les marges ci-dessus sont fixes
   * (fonction de la taille de police, pas de la longueur du texte) : sur
   * un texte tightFit COURT (un mot), l'écart de rendu cumulé Figma↔Slides
   * est negligeable et une marge fixe suffit ; sur un texte tightFit LONG
   * (plusieurs mots), cet écart s'accumule caractère par caractère et finit
   * par dépasser la marge fixe (observé : phrases de plusieurs mots encore
   * en trop après une marge fixe généreuse, alors que les mots isolés
   * tenaient déjà). D'où ce terme en plus, proportionnel à la largeur déjà
   * mesurée de la boîte (qui, en tightFit, est justement celle du contenu).
   */
  textWidthSafetyMarginTightFitProportional: number;
  measuredAt: string; // ISO 8601
}

export const DEFAULT_RADIUS_NATIVE_TOLERANCE = { min: 0.08, max: 0.25 };

/**
 * Valeurs par défaut prudentes, utilisées tant que `calibration.json` n'a
 * pas été régénéré par `npm run calibrate` contre un compte Google réel.
 * NE PAS considérer ces valeurs comme calibrées (spec §4 — RÈGLE padding).
 */
export const UNCALIBRATED_DEFAULTS: CalibrationData = {
  textInset: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
  roundRectRadiusRatio: 0.16,
  defaultOutlineWeightPt: 1,
  lineSpacingBaseline: 1.2,
  radiusNativeTolerance: DEFAULT_RADIUS_NATIVE_TOLERANCE,
  textWidthSafetyMarginEm: 0.15,
  textWidthSafetyMarginSubstitutedFontEm: 0.9,
  textWidthSafetyMarginTightFitEm: 1.2,
  textWidthSafetyMarginTightFitProportional: 0.05,
  measuredAt: '1970-01-01T00:00:00.000Z',
};
