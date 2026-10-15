export interface EmptyStateDemoProps {
  /** Libellé du bouton principal du mode ("Export", "Create template"), rejoué dans l'animation. */
  actionLabel: string;
  /** Résumé du parcours pour les lecteurs d'écran : l'animation est décorative. */
  description: string;
}

/**
 * État vide des deux modes : le parcours montré plutôt que décrit. Un
 * curseur sélectionne deux frames sur un canvas miniature, clique "Add"
 * (les frames rejoignent le rail), puis le bouton principal. Joué en
 * boucle (décision du 15 octobre : ni texte d'étapes ni bouton pause,
 * l'animation suffit). En mouvement réduit, l'état final reste figé.
 * Les styles de base décrivent l'état FINAL ; les keyframes décrivent le
 * trajet pour y arriver (voir styles.css § Démo de l'état vide).
 */
export function EmptyStateDemo({ actionLabel, description }: EmptyStateDemoProps) {
  return (
    <div className="f2s-demo" role="img" aria-label={description}>
      <div className="f2s-demo-canvas" />
      <div className="f2s-demo-frame f2s-demo-frame--1" />
      <div className="f2s-demo-frame f2s-demo-frame--2" />
      <div className="f2s-demo-frame f2s-demo-frame--3" />
      <div className="f2s-demo-window" />
      <div className="f2s-demo-btn f2s-demo-btn--add">Add</div>
      <div className="f2s-demo-thumb f2s-demo-thumb--1" />
      <div className="f2s-demo-thumb f2s-demo-thumb--2" />
      <div className="f2s-demo-btn f2s-demo-btn--primary">{actionLabel}</div>
      <svg className="f2s-demo-cursor" viewBox="0 0 16 20" width="16" height="20">
        <path d="M1 1 L1 16 L5 12.5 L8 19 L10.5 18 L7.5 11.5 L12.5 11.5 Z" />
      </svg>
    </div>
  );
}
