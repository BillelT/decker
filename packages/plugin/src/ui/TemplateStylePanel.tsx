import type { ThemeColorRole } from '@figma-to-slides/shared';
import { colorKey } from '../serialize/templateSummary.js';
import { THEME_ROLE_LABELS, VISIBLE_THEME_ROLES } from '../serialize/templateTheme.js';
import { postToPlugin } from './types.js';
import type { TemplateColorSwatch, TemplateFontUsage } from './types.js';

export interface TemplateStylePanelProps {
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  /** Choix manuel de police (bandeau "Fonts") — voir logEntryFlag.ts pour le même besoin côté Logs. */
  fontOverrides: Record<string, string>;
  colorRoles: Record<string, ThemeColorRole>;
  setColorRoles: (updater: (prev: Record<string, ThemeColorRole>) => Record<string, ThemeColorRole>) => void;
}

/** Hex ou nom de variable Figma tronqué sur une ligne — le libellé complet reste dans `title` (même convention que `f2s-tmpl-chip-label`). */
function colorLabel(c: TemplateColorSwatch): string {
  return c.variableName ?? c.hex;
}

/**
 * Panneau "Styles" du mode template (audit 2026-08, point 2 — TODO.md §
 * Mode template) : vue agrégée de TOUT le template (contrairement au
 * rapport par layout de TemplatePanel, qui n'affiche qu'une frame à la
 * fois), affichée dans l'aside droit (280px, cf. TemplatePanel) plutôt que
 * dans un onglet séparé. Centré sur les couleurs RÉELLEMENT DÉTECTÉES
 * (contrairement à une précédente version centrée sur les 12 rôles de
 * thème Slides) : chaque couleur détectée peut se voir assigner l'un des
 * 11 rôles éditables (`VISIBLE_THEME_ROLES` — `FOLLOWED_HYPERLINK` n'est
 * jamais assignable, cf. `templateTheme.ts`), et l'API continue de
 * recevoir ses 12 rôles d'un coup côté export (`buildTemplateTheme` remplit
 * tout rôle non assigné avec `DEFAULT_THEME_ROLE_COLORS`) — ce panneau
 * reste strictement additif, jamais requis pour créer un template.
 */
export function TemplateStylePanel({ colors, fonts, fontOverrides, colorRoles, setColorRoles }: TemplateStylePanelProps) {
  const assignedKeyByRole = new Map<ThemeColorRole, string>();
  for (const [key, role] of Object.entries(colorRoles)) assignedKeyByRole.set(role, key);
  const sortedColors = [...colors].sort((a, b) => b.usageCount - a.usageCount);
  const byKey = new Map(colors.map((c) => [colorKey(c.hex, c.alpha), c]));

  /**
   * Un rôle n'est jamais assignable qu'à une seule couleur à la fois (11
   * rôles éditables au maximum, cf. `VISIBLE_THEME_ROLES`). Choisir un rôle
   * déjà pris par une AUTRE couleur le lui retire — le sélecteur de chaque
   * couleur reste donc toujours complet plutôt que de faire disparaître des
   * options d'une ligne à l'autre — et une notif Figma le signale, ce
   * changement n'étant sinon visible que si on regarde la ligne qui vient
   * de perdre son rôle.
   */
  function handleRoleChange(key: string, value: string) {
    if (!value) {
      setColorRoles((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const role = value as ThemeColorRole;
    const previousKey = assignedKeyByRole.get(role);
    if (previousKey && previousKey !== key) {
      const stolenFrom = byKey.get(previousKey);
      postToPlugin({
        type: 'notify',
        message: `"${THEME_ROLE_LABELS[role]}" was already used by ${stolenFrom ? colorLabel(stolenFrom) : previousKey} — reassigned.`,
      });
    }

    setColorRoles((prev) => {
      const next: Record<string, ThemeColorRole> = {};
      for (const [k, r] of Object.entries(prev)) {
        if (r === role) continue;
        next[k] = r;
      }
      next[key] = role;
      return next;
    });
  }

  return (
    <div className="f2s-style-panel">
      <section className="f2s-tmpl-section">
        <h3 className="f2s-tmpl-heading f2s-style-heading">Colors</h3>
        {colors.length === 0 ? (
          <p className="f2s-toolbar-muted">No color detected yet — add layouts first.</p>
        ) : (
          <ul className="f2s-style-list">
            {sortedColors.map((c) => {
              const key = colorKey(c.hex, c.alpha);
              const label = colorLabel(c);
              return (
                <li key={key} className="f2s-style-row">
                  <div className="f2s-style-row-main">
                    <span className="f2s-style-swatch" style={{ backgroundColor: c.hex, opacity: c.alpha }} />
                    <span className="f2s-style-label" title={label}>
                      {label}
                    </span>
                    <select
                      className="f2s-font-dropdown f2s-style-role-select"
                      value={colorRoles[key] ?? ''}
                      onChange={(e) => handleRoleChange(key, (e.target as HTMLSelectElement).value)}
                    >
                      <option value="">No role</option>
                      {VISIBLE_THEME_ROLES.map((role) => {
                        const takenByOther = assignedKeyByRole.get(role) && assignedKeyByRole.get(role) !== key;
                        return (
                          <option key={role} value={role}>
                            {THEME_ROLE_LABELS[role]}
                            {takenByOther ? ' (in use)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="f2s-tmpl-section">
        <h3 className="f2s-tmpl-heading f2s-style-heading">Typography</h3>
        {fonts.length === 0 ? (
          <p className="f2s-toolbar-muted">No text detected yet.</p>
        ) : (
          <ul className="f2s-style-list">
            {fonts.map((f) => {
              // Reflète le choix courant du sélecteur "Fonts" plutôt que la
              // résolution par défaut figée au moment du serialize — voir
              // logEntryFlag.ts::logEntryTagText pour le même besoin côté Logs.
              const family = f.original ? (fontOverrides[f.original] ?? f.family) : f.family;
              return (
                <li key={f.original ?? f.family} className="f2s-style-row">
                  <div className="f2s-style-row-main">
                    <span className="f2s-style-font-swatch" style={{ fontFamily: family }}>
                      Aa
                    </span>
                    <span className="f2s-style-font-info">
                      <span className="f2s-tmpl-font-family">{family}</span>
                      <span className="f2s-toolbar-muted">{f.weights.join(', ')}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
