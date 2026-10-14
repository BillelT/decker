/**
 * Panneau de réglages du plugin, ouvert depuis le bouton "Settings" du footer
 * (ui.tsx). Le seul réglage d'apparence est l'habillage de l'UI (Modern /
 * Windows 95, cf. ui/types.ts), en tab menu, persisté côté sandbox
 * (clientStorage : l'iframe UI n'a aucun stockage durable). Il n'y a plus de
 * thème sombre (retiré le 2026-10-14).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { CloseIcon } from './StatusIcon.js';
import type { UiSkin } from './types.js';

/** Durée des transitions d'ouverture/fermeture — doit rester alignée sur `--f2s-modal-duration` (styles.css). */
const TRANSITION_MS = 220;

interface SettingsModalProps {
  open: boolean;
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
  /** Domaine public du site (voir ui.tsx §SITE_URL) — sert à pointer les liens légaux vers /privacy et /terms. Distinct du backend d'API. */
  siteUrl: string;
}

const SKIN_TABS: { value: UiSkin; label: string; hint: string }[] = [
  { value: 'modern', label: 'Modern', hint: 'Brand orange palette with Windows 95 bevels and square corners.' },
  { value: 'win95', label: 'Windows 95', hint: 'Retro Windows 95 chrome: title bar, bevels, system gray.' },
];

/**
 * Choix exclusif entre deux ou trois valeurs, peint en segmented control
 * (`.f2s-tabs`) mais annoncé comme ce qu'il est : un groupe de boutons radio.
 * Les anciens `role="tab"` promettaient des panneaux d'onglets qui n'existent
 * pas. Clavier des radios natifs : un seul arrêt de tabulation (l'option
 * cochée), les flèches changent l'option et la sélectionnent.
 */
function RadioSegment<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const checkedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    ((event.currentTarget as HTMLElement).parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div className="f2s-tabs" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === checkedIndex ? 0 : -1}
          title={option.hint}
          className={`f2s-tab${option.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Contrôles atteignables à la tabulation dans le panneau (les radios non cochés en sont exclus, tabIndex -1). */
const TABBABLE = 'button:not(:disabled):not([tabindex="-1"]), a[href], select:not(:disabled), input:not(:disabled)';

export function SettingsModal({
  open,
  skin,
  onSkinChange,
  onClose,
  signedIn,
  accountEmail,
  onSignOut,
  showDebugExport,
  onExportDebugIr,
  siteUrl,
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

  // À la fermeture, le focus revient sur ce qui l'avait à l'ouverture (le
  // bouton Settings) : il retombait sur <body>, et un utilisateur au clavier
  // repartait du haut du panneau.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener?.focus();
  }, [open]);

  /** Tab et Maj+Tab bouclent dans le panneau au lieu de filer vers le plugin resté derrière l'overlay. */
  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const tabbables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(TABBABLE));
    if (tabbables.length === 0) return;
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
        onKeyDown={trapFocus}
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
                  'Signed in (email unavailable: sign out and back in to see it).'
                ) : (
                  'Not signed in.'
                )}
              </p>
            </div>
            {signedIn && (
              <button
                type="button"
                className="f2s-btn f2s-btn--secondary"
                title="Sign out. You'll be asked to pick a Google account next time you sign in."
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
            <RadioSegment
              label="Interface style"
              options={SKIN_TABS}
              value={skin}
              onChange={onSkinChange}
            />
          </section>

          {showDebugExport && (
            <section className="f2s-setting">
              <div className="f2s-setting-text">
                <h3 className="f2s-setting-title">Developer</h3>
                <p className="f2s-setting-desc">
                  Download the current deck as IRDocument JSON, for building calibration fixtures (see LIMITATIONS.md). Never sent over the network.
                </p>
              </div>
              <button type="button" className="f2s-btn f2s-btn--secondary" onClick={onExportDebugIr}>
                Download IR JSON
              </button>
            </section>
          )}
        </div>

        <footer className="f2s-modal-footer">
          <a href={`${siteUrl}/privacy`} target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          <a href={`${siteUrl}/terms`} target="_blank" rel="noreferrer">
            Terms of Use
          </a>
        </footer>
      </div>
    </div>
  );
}
