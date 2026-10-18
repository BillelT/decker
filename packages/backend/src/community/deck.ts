/**
 * Le deck Trailworn tel qu'il est dans Figma : les neuf vraies slides
 * d'exemple (assets/mockup slides/, exportées de Figma en 1920x1080), et ce
 * que le plugin en sait une fois les frames ajoutées.
 *
 * Les couleurs et les textes sont ceux du deck, pas de l'interface : ils
 * restent hors des tokens de la DA, au même titre qu'une capture d'écran.
 */

export interface DeckSlide {
  /** Id du nœud Figma de la frame (ce que code.ts envoie à l'UI). */
  id: string;
  /** Fichier dans assets/mockup slides/, sans extension. */
  file: string;
  /** Nom de la frame dans Figma, affiché dans le rail. */
  name: string;
  /** Calques qui partent en objets Slides natifs (rapport de contenu). */
  native: number;
}

export const DECK: DeckSlide[] = [
  { id: '12:1', file: '01-intro', name: 'Cover', native: 8 },
  { id: '12:2', file: '02-pillars', name: 'Three pillars', native: 21 },
  { id: '12:3', file: '03-compare', name: 'Old way vs new', native: 34 },
  { id: '12:4', file: '04-stat-87', name: 'Stat 87%', native: 4 },
  { id: '12:5', file: '05-stat-96', name: 'Stat 96%', native: 4 },
  { id: '12:6', file: '06-chart', name: 'Repairs chart', native: 19 },
  { id: '12:7', file: '07-stat-120k', name: 'Stat 120k', native: 4 },
  { id: '12:8', file: '08-quote', name: 'Quote', native: 6 },
  { id: '12:9', file: '09-conclusion', name: 'Closing', native: 4 },
];

/** Couleurs du deck, relevées sur les PNG. */
export const TRAILWORN = {
  forest: '#26332A',
  clay: '#BD5B34',
  sand: '#F3EEE2',
  night: '#171311',
  white: '#FFFFFF',
};

/** URL servie par render.ts (page.route) pour une slide du deck. */
export const slideUrl = (s: DeckSlide): string => `https://community.decker.local/slides/${s.file}.png`;

export const slide = (file: string): DeckSlide => {
  const found = DECK.find((s) => s.file === file);
  if (!found) throw new Error(`slide inconnue : ${file}`);
  return found;
};
