/**
 * Mode template, frame Master : chaque texte y devient automatiquement un
 * placeholder modifiable de chaque layout (surtitre, sujet, date), sauf les
 * mentions légales de la marque (copyright, confidentialité), qui restent
 * fixes et communes à toutes les slides : on les change une fois, sur le
 * Master. Logos, images et formes restent fixes aussi (Slides n'a pas de
 * placeholder d'image). Partagé entre le plugin (affichage) et le backend
 * (export) pour que les deux disent la même chose.
 */
const LEGAL_MENTION = /©|\(c\)|copyright|all rights reserved|tous droits|confidential|confidentiel/i;

export function isFixedMasterText(content: string): boolean {
  return LEGAL_MENTION.test(content);
}
