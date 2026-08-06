/**
 * Panneau de réglages du plugin, ouvert depuis le bouton "Settings" du footer
 * (ui.tsx). Deux réglages exposés, tous deux en tab menu et tous deux
 * persistés côté sandbox (clientStorage — l'iframe UI n'a aucun stockage
 * durable) :
 *
 * - l'habillage de l'UI (Windows 95 / Modern), cf. ui/types.ts ;
 * - le thème de l'UI (clair / sombre) : par défaut le plugin suit celui de
 *   Figma (`themeColors: true`, cf. code.ts), ce choix-ci le force.
 *
 * Le second dépend du premier : le skin Windows 95 est mono-thème (c'est ce
 * gris-là), donc le tab menu du thème n'y a rien à piloter — il est désactivé
 * et le dit, plutôt que d'être retiré (la modale garderait alors deux hauteurs
 * différentes selon l'habillage) ou de rester actif sans effet visible.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ThemePreference } from './theme.js';
import type { UiSkin } from './types.js';

/** Durée des transitions d'ouverture/fermeture — doit rester alignée sur `--f2s-modal-duration` (styles.css). */
const TRANSITION_MS = 220;

interface SettingsModalProps {
  open: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  skin: UiSkin;
  onSkinChange: (skin: UiSkin) => void;
  onClose: () => void;
  /** Une session Google existe (sessionToken non vide) — indépendant de accountEmail : une session créée avant l'ajout du scope `userinfo.email` reste valide (export fonctionnel) mais n'a pas d'email connu. */
  signedIn: boolean;
  /** Email du compte Google connecté (GET /auth/me) — undefined si inconnu (session plus ancienne que le scope email) ou pas encore chargé. */
  accountEmail: string | undefined;
  onSignOut: () => void;
  /** Section Developer visible seulement en mode deck avec au moins une frame (voir ui.tsx). */
  showDebugExport: boolean;
  onExportDebugIr: () => void;
  /** Base URL du backend (voir ui.tsx §backend) — sert à pointer les liens légaux vers /privacy et /terms. */
  backendUrl: string;
}

const THEME_TABS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Force the light palette, whatever theme Figma is using.' },
  { value: 'dark', label: 'Dark', hint: 'Force the dark palette, whatever theme Figma is using.' },
];

const SKIN_TABS: { value: UiSkin; label: string; hint: string }[] = [
  { value: 'win95', label: 'Windows 95', hint: 'Retro Windows 95 chrome — title bar, bevels, system gray.' },
  { value: 'modern', label: 'Modern', hint: 'The plugin design system — brand orange, rounded corners.' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Brand orange palette with Windows 95 bevels and square corners.' },
];

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsModal({
  open,
  theme,
  onThemeChange,
  skin,
  onSkinChange,
  onClose,
  signedIn,
  accountEmail,
  onSignOut,
  showDebugExport,
  onExportDebugIr,
  backendUrl,
}: SettingsModalProps) {
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
              <h3 className="f2s-setting-title">Account</h3>
              <p className="f2s-setting-desc">
                {accountEmail ? (
                  <>
                    Signed in as <strong>{accountEmail}</strong>.
                  </>
                ) : signedIn ? (
                  'Signed in (email unavailable — sign out and back in to see it).'
                ) : (
                  'Not signed in.'
                )}
              </p>
            </div>
            {signedIn && (
              <button
                type="button"
                className="f2s-btn f2s-btn--secondary"
                title="Sign out — you'll be asked to pick a Google account next time you sign in."
                onClick={onSignOut}
              >
                Sign out
              </button>
            )}
          </section>

          <section className="f2s-setting">
            <div className="f2s-setting-text">
              <h3 className="f2s-setting-title">Interface</h3>
              <p className="f2s-setting-desc">Pick how the plugin panel is painted.</p>
            </div>
            <div className="f2s-tabs" role="tablist" aria-label="Interface style">
              {SKIN_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={skin === tab.value}
                  title={tab.hint}
                  className={`f2s-tab${skin === tab.value ? ' is-active' : ''}`}
                  onClick={() => onSkinChange(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          <section className="f2s-setting">
            <div className="f2s-setting-text">
              <h3 className="f2s-setting-title">Appearance</h3>
              <p className="f2s-setting-desc">
                {skin === 'win95' ? 'The Windows 95 interface has a single palette.' : 'Pick the palette used by the plugin panel.'}
              </p>
            </div>
            <div className="f2s-tabs" role="tablist" aria-label="Theme">
              {THEME_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={theme === tab.value}
                  disabled={skin === 'win95'}
                  title={skin === 'win95' ? 'Switch to the Modern interface to change the palette.' : tab.hint}
                  className={`f2s-tab${theme === tab.value ? ' is-active' : ''}`}
                  onClick={() => onThemeChange(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {showDebugExport && (
            <section className="f2s-setting">
              <div className="f2s-setting-text">
                <h3 className="f2s-setting-title">Developer</h3>
                <p className="f2s-setting-desc">
                  Download the current deck as IRDocument JSON — for building calibration fixtures (see LIMITATIONS.md). Never sent over the network.
                </p>
              </div>
              <button type="button" className="f2s-btn f2s-btn--secondary" onClick={onExportDebugIr}>
                Download IR JSON
              </button>
            </section>
          )}
        </div>

        <footer className="f2s-modal-footer">
          <a href={`${backendUrl}/privacy`} target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          <a href={`${backendUrl}/terms`} target="_blank" rel="noreferrer">
            Terms of Use
          </a>
        </footer>
      </div>
    </div>
  );
}
