import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export interface EmptyStateDemoProps {
  /** Libellé du bouton principal du mode ("Export", "Create template"), rejoué dans l'animation. */
  actionLabel: string;
  /** Les trois étapes, surlignées tour à tour en même temps que l'animation. */
  steps: [ComponentChildren, ComponentChildren, ComponentChildren];
}

type PlayState = 'playing' | 'paused' | 'done';

/**
 * État vide des deux modes : au lieu de seulement décrire le parcours, le
 * montre. Un curseur sélectionne deux frames sur un canvas miniature,
 * clique "Add" (les frames rejoignent le rail), puis le bouton principal.
 * Les trois étapes écrites restent dessous et s'allument au même rythme :
 * le mouvement n'est jamais le seul canal.
 *
 * Joué une fois (7 s) puis figé sur l'état final, avec un bouton Pause /
 * Replay : tout ce qui bouge plus de 5 s doit pouvoir s'arrêter. En
 * mouvement réduit, l'état final s'affiche directement, sans bouton.
 * Les styles de base décrivent l'état FINAL ; les keyframes décrivent le
 * trajet pour y arriver (voir styles.css § Démo de l'état vide).
 */
export function EmptyStateDemo({ actionLabel, steps }: EmptyStateDemoProps) {
  const [run, setRun] = useState(0);
  const [state, setState] = useState<PlayState>('playing');

  function onControl() {
    if (state === 'playing') setState('paused');
    else if (state === 'paused') setState('playing');
    else {
      setRun((n) => n + 1);
      setState('playing');
    }
  }

  return (
    <div className="f2s-empty-demo">
      <div
        key={run}
        className={`f2s-demo${state === 'paused' ? ' is-paused' : ''}${state === 'done' ? ' is-done' : ''}`}
        aria-hidden="true"
      >
        <div className="f2s-demo-canvas" />
        <div className="f2s-demo-frame f2s-demo-frame--1" />
        <div className="f2s-demo-frame f2s-demo-frame--2" />
        <div className="f2s-demo-frame f2s-demo-frame--3" />
        <div className="f2s-demo-window" />
        <div className="f2s-demo-btn f2s-demo-btn--add">Add</div>
        <div className="f2s-demo-thumb f2s-demo-thumb--1" />
        <div className="f2s-demo-thumb f2s-demo-thumb--2" />
        <div className="f2s-demo-btn f2s-demo-btn--primary">{actionLabel}</div>
        <svg className="f2s-demo-cursor" viewBox="0 0 16 20" width="16" height="20" onAnimationEnd={() => setState('done')}>
          <path d="M1 1 L1 16 L5 12.5 L8 19 L10.5 18 L7.5 11.5 L12.5 11.5 Z" />
        </svg>
      </div>

      <ol className={`f2s-empty-steps f2s-empty-steps--demo${state === 'paused' ? ' is-paused' : ''}${state === 'done' ? ' is-done' : ''}`} key={`steps-${run}`}>
        {steps.map((step, i) => (
          <li key={i}>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <button type="button" className="f2s-btn f2s-btn--ghost f2s-demo-control" onClick={onControl}>
        {state === 'playing' ? 'Pause' : state === 'paused' ? 'Play' : 'Replay'}
      </button>
    </div>
  );
}
