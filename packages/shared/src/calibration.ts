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
  measuredAt: '1970-01-01T00:00:00.000Z',
};
