import type { ThemeColorRole } from '@figma-to-slides/shared';
import { colorKey } from '../serialize/templateSummary.js';
import type { TemplateColorSwatch, TemplateFontUsage } from './types.js';

export interface TemplateStylePanelProps {
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  colorRoles: Record<string, ThemeColorRole>;
  setColorRoles: (updater: (prev: Record<string, ThemeColorRole>) => Record<string, ThemeColorRole>) => void;
}

const ROLE_OPTIONS: { value: ThemeColorRole; label: string }[] = [
  { value: 'DARK1', label: 'Dark 1' },
  { value: 'LIGHT1', label: 'Light 1' },
  { value: 'DARK2', label: 'Dark 2' },
  { value: 'LIGHT2', label: 'Light 2' },
  { value: 'ACCENT1', label: 'Accent 1' },
  { value: 'ACCENT2', label: 'Accent 2' },
  { value: 'ACCENT3', label: 'Accent 3' },
  { value: 'ACCENT4', label: 'Accent 4' },
  { value: 'ACCENT5', label: 'Accent 5' },
  { value: 'ACCENT6', label: 'Accent 6' },
  { value: 'HYPERLINK', label: 'Hyperlink' },
  { value: 'FOLLOWED_HYPERLINK', label: 'Followed hyperlink' },
];

/**
 * Onglet "Style" du mode template (audit 2026-08, point 2 — TODO.md §
 * Mode template) : vue agrégée de TOUT le template (contrairement au
 * rapport par layout de TemplatePanel, qui n'affiche qu'une frame à la
 * fois), pour assigner un rôle de thème Slides réel — voir
 * `mapper/theme.ts` — à chaque couleur détectée. Une couleur sans rôle
 * assigné ici reste un aplat RGB statique par élément comme avant : cet
 * onglet est strictement additif, jamais requis pour créer un template.
 */
export function TemplateStylePanel({ colors, fonts, colorRoles, setColorRoles }: TemplateStylePanelProps) {
  const usedRoles = new Set(Object.values(colorRoles));

  function assignRole(key: string, role: ThemeColorRole | '') {
    setColorRoles((prev) => {
      const next = { ...prev };
      if (role === '') {
        delete next[key];
      } else {
        next[key] = role;
      }
      return next;
    });
  }

  return (
    <div className="f2s-body">
      <main className="f2s-canvas f2s-canvas--template">
        <p className="f2s-tmpl-note">
          Assign a Slides theme color role to the colors that matter most. The Slides API can't set its native theme colors
          directly, but an assigned color is linked LIVE to that role instead of a fixed value — changing it later in Slides
          (Slide &gt; Edit theme colors) recolors every element that uses it, everywhere in the template at once.
        </p>

        <section className="f2s-tmpl-section">
          <h3 className="f2s-tmpl-heading">Colors ({colors.length})</h3>
          {colors.length === 0 ? (
            <p className="f2s-toolbar-muted">No color detected yet — add layouts first.</p>
          ) : (
            <ul className="f2s-tmpl-list">
              {colors.map((c) => {
                const key = colorKey(c.hex, c.alpha);
                const current = colorRoles[key];
                return (
                  <li key={key} className="f2s-tmpl-swatch-item">
                    <span className="f2s-tmpl-swatch">
                      <span className="f2s-tmpl-swatch-color" style={{ backgroundColor: c.hex, opacity: c.alpha }} />
                    </span>
                    <span className="f2s-tmpl-swatch-label">
                      {c.hex}
                      {c.alpha < 1 ? ` · ${Math.round(c.alpha * 100)}%` : ''}
                      <span className="f2s-toolbar-muted"> · used {c.usageCount}×</span>
                    </span>
                    <select
                      className="f2s-font-dropdown"
                      value={current ?? ''}
                      onChange={(e) => assignRole(key, (e.target as HTMLSelectElement).value as ThemeColorRole | '')}
                    >
                      <option value="">— no role —</option>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value} disabled={usedRoles.has(r.value) && current !== r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="f2s-tmpl-section">
          <h3 className="f2s-tmpl-heading">Typography ({fonts.length})</h3>
          {fonts.length === 0 ? (
            <p className="f2s-toolbar-muted">No text detected yet.</p>
          ) : (
            <ul className="f2s-tmpl-list">
              {fonts.map((f) => (
                <li key={f.family}>
                  <span className="f2s-tmpl-font-family">{f.family}</span>{' '}
                  <span className="f2s-toolbar-muted">({f.weights.join(', ')})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
