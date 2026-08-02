/**
 * Thème de l'UI du plugin.
 *
 * Par défaut, l'UI suit le thème de Figma : `showUI(..., { themeColors: true })`
 * (code.ts) fait poser par Figma la classe `figma-dark`/`figma-light` sur
 * <html>, dont le CSS dérive sa palette (styles.css). La modale de réglages
 * permet de FORCER l'un des deux thèmes : on pose alors une classe
 * `f2s-theme-*`, plus spécifique, qui l'emporte sur celle de Figma.
 */

export type ThemePreference = 'light' | 'dark';

const OVERRIDE_CLASS: Record<ThemePreference, string> = {
  light: 'f2s-theme-light',
  dark: 'f2s-theme-dark',
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

/**
 * Thème que l'UI aurait SANS override : la classe posée par Figma, ou à
 * défaut la préférence système (rendu hors Figma, en dev navigateur).
 */
export function readFigmaTheme(): ThemePreference {
  const root = document.documentElement;
  if (root.classList.contains('figma-dark')) return 'dark';
  if (root.classList.contains('figma-light')) return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Override réellement affiché au tout premier rendu : comme pour le skin
 * (voir `readInitialSkin`), code.ts injecte déjà la classe `f2s-theme-*`
 * persistée dans le HTML avant de créer l'iframe, donc <html> la porte dès
 * le montage. Partir d'ici plutôt que de `undefined` évite qu'un thème
 * forcé ne s'affiche d'abord dans le thème de Figma avant de basculer.
 */
export function readInitialThemeOverride(): ThemePreference | undefined {
  const root = document.documentElement;
  if (root.classList.contains(OVERRIDE_CLASS.light)) return 'light';
  if (root.classList.contains(OVERRIDE_CLASS.dark)) return 'dark';
  return undefined;
}

/** Applique (ou retire, si `undefined`) le thème forcé par l'utilisateur. */
export function applyThemeOverride(theme: ThemePreference | undefined): void {
  const root = document.documentElement;
  root.classList.toggle(OVERRIDE_CLASS.light, theme === 'light');
  root.classList.toggle(OVERRIDE_CLASS.dark, theme === 'dark');
}

/**
 * Suit les changements de thème DE FIGMA (l'utilisateur bascule Figma en
 * sombre pendant que le plugin est ouvert) : tant qu'aucun thème n'est forcé,
 * le tab menu doit refléter le thème réellement affiché.
 */
export function watchFigmaTheme(onChange: (theme: ThemePreference) => void): () => void {
  const observer = new MutationObserver(() => onChange(readFigmaTheme()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onMediaChange = () => onChange(readFigmaTheme());
  media?.addEventListener('change', onMediaChange);

  return () => {
    observer.disconnect();
    media?.removeEventListener('change', onMediaChange);
  };
}
