/**
 * Panneau de réglages du plugin, ouvert depuis le bouton "Settings" du footer
 * (ui.tsx). Premier réglage exposé : le thème de l'UI (clair / sombre), sous
 * forme de tab menu — par défaut le plugin suit le thème de Figma
 * (`themeColors: true`, cf. code.ts), ce choix-ci le force explicitement et
 * survit à la fermeture du plugin (clientStorage).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ThemePreference } from './theme.js';

/** Durée des transitions d'ouverture/fermeture — doit rester alignée sur `--f2s-modal-duration` (styles.css). */
const TRANSITION_MS = 220;

interface SettingsModalProps {
  open: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onClose: () => void;
}

const THEME_TABS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Force the light palette, whatever theme Figma is using.' },
  { value: 'dark', label: 'Dark', hint: 'Force the dark palette, whatever theme Figma is using.' },
];

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsModal({ open, theme, onThemeChange, onClose }: SettingsModalProps) {
  // La modale reste montée le temps de l'animation de sortie : la démonter dès
  // `open === false` couperait la transition net (rien à animer une fois le
  // nœud retiré du DOM).
  const [mounted, setMounted] = useState(open);
  // Classe posée un frame APRÈS le montage : sans ce délai, l'état initial et
  // l'état final de la transition seraient peints dans le même frame et le
  // navigateur n'interpolerait rien (ouverture sèche).
  const [entered, setEntered] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Échap ferme la modale — attendu de tout dialogue, et seule porte de sortie
  // au clavier tant que le focus n'est pas piégé dans le panneau.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Focus déplacé dans le panneau à l'ouverture : sans ça, Échap n'atteindrait
  // le handler que si le focus se trouve déjà dans l'iframe du plugin.
  useEffect(() => {
    if (open && entered) dialogRef.current?.focus();
  }, [open, entered]);

  if (!mounted) return null;

  return (
    <div
      className={`f2s-modal-overlay${entered ? ' is-open' : ''}`}
      // Le clic ne ferme que s'il naît ET meurt sur l'overlay : un drag démarré
      // dans le panneau et relâché en dehors ne doit pas passer pour un clic
      // "à côté".
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="f2s-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="f2s-modal-header">
          <h2 className="f2s-modal-title">Settings</h2>
          <button type="button" className="f2s-icon-btn" title="Close settings" aria-label="Close settings" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="f2s-modal-body">
          <section className="f2s-setting">
            <div className="f2s-setting-text">
              <h3 className="f2s-setting-title">Appearance</h3>
              <p className="f2s-setting-desc">Pick the palette used by the plugin panel.</p>
            </div>
            <div className="f2s-tabs" role="tablist" aria-label="Theme">
              {THEME_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={theme === tab.value}
                  title={tab.hint}
                  className={`f2s-tab${theme === tab.value ? ' is-active' : ''}`}
                  onClick={() => onThemeChange(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
