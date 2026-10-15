// Généré par scripts/sync-tokens.mjs depuis tokens/token.css (DA billel-skill). Ne pas modifier à la main.

export const DESIGN_TOKENS_CSS = `
:root {
  --b-black: hsl(30, 12%, 6%);
  --b-white: hsl(30, 20%, 98%);
  --b-ink: hsl(30, 12%, 6%);

  --b-gray-50: hsl(40, 10%, 96%);
  --b-gray-100: hsl(30, 23%, 93%);
  --b-gray-200: hsl(18, 8%, 84%);
  --b-gray-400: hsl(24, 6%, 65%);
  --b-gray-500: hsl(25, 6%, 53%);
  --b-gray-600: hsl(24, 6%, 41%);
  --b-gray-800: hsl(22, 8%, 22%);

  --b-text: var(--b-ink);
  --b-text-muted: var(--b-gray-800);
  --b-text-faint: var(--b-gray-600);
  --b-text-control: var(--b-gray-800);

  --b-surface: var(--b-white);
  --b-surface-subtle: var(--b-gray-50);
  --b-surface-hover: var(--b-gray-50);
  --b-surface-muted: var(--b-gray-100);
  --b-surface-sunken: var(--b-gray-100);

  --b-border: var(--b-gray-200);
  --b-border-subtle: var(--b-gray-100);

  --b-dark-surface: var(--b-black);
  --b-dark-text: var(--b-white);
  --b-dark-text-muted: var(--b-gray-200);
  --b-dark-text-faint: var(--b-gray-400);
  --b-dark-border: var(--b-gray-800);

  --b-accent: hsl(26, 100%, 47%);
  --b-accent-40: hsla(26, 100%, 47%, 0.4);
  --b-accent-20: hsla(26, 100%, 47%, 0.2);
  --b-accent-red: hsl(16, 100%, 47%);
  --b-accent-hover: hsl(20, 100%, 62%);

  --b-track: rgba(0, 0, 0, 0.08);
  --b-switch-off: rgba(0, 0, 0, 0.18);
  --b-scrollbar-thumb: rgba(0, 0, 0, 0.18);

  --b-space-2: 2px;
  --b-space-4: 4px;
  --b-space-6: 6px;
  --b-space-8: 8px;
  --b-space-12: 12px;
  --b-space-16: 16px;
  --b-space-20: 20px;
  --b-space-24: 24px;
  --b-space-32: 32px;
  --b-space-48: 48px;
  --b-space-64: 64px;
  --b-space-96: 96px;

  --b-radius-2xs: 2px;
  --b-radius-xs: 4px;
  --b-radius-sm: 6px;
  --b-radius-md: 8px;
  --b-radius-lg: 32px;
  --b-radius-full: 9999px;

  --b-font-sans:
    "Cabinet Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --b-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  --b-text-xs: 12px;
  --b-text-sm: 14px;
  --b-text-base: 16px;
  --b-text-lg: 18px;
  --b-text-xl: 20px;
  --b-text-3xl: 36px;
  --b-text-6xl: 72px;

  --b-font-regular: 400;
  --b-font-medium: 500;
  --b-font-semibold: 600;
  --b-font-bold: 700;

  --b-leading-none: 1.02;
  --b-leading-tight: 1.2;
  --b-leading-snug: 1.333;
  --b-leading-normal: 1.4;
  --b-leading-relaxed: 1.5;

  --b-tracking-tight: -0.01em;
  --b-tracking-tighter: -0.03em;
  --b-tracking-wide: 0.08em;

  --b-shadow-raised: 0 1px 2px #0000000a;

  --b-shadow-switch-track: inset 0 0 0 0.5px rgba(0, 0, 0, 0.1);
  --b-shadow-switch-thumb: 0 1px 2px rgba(0, 0, 0, 0.3);

  --b-shadow-focus: 0 0 0 3px rgba(0, 0, 0, 0.1);

  --b-focus-outline: 2px solid var(--b-black);
  --b-focus-offset: 2px;

  --b-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --b-ease-default: cubic-bezier(
    0.4,
    0,
    0.2,
    1
  );
  --b-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --b-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --b-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --b-ease-icon: cubic-bezier(0.2, 0, 0, 1);
  --b-duration-instant: 0.05s;
  --b-duration-fast: 0.12s;
  --b-duration: 0.15s;
  --b-duration-slow: 0.2s;
}

::selection {
  background: var(--b-accent-20);
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--b-scrollbar-thumb) transparent;
  overscroll-behavior: contain;
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: var(--b-scrollbar-thumb);
  border-radius: var(--b-radius-full);
}
`;
