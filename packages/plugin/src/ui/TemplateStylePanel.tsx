import type { ThemeColorRole } from '@figma-to-slides/shared';
import { colorKey } from '../serialize/templateSummary.js';
import { DEFAULT_THEME_ROLE_HEX, THEME_ROLES, THEME_ROLE_LABELS, resolveThemeRoleHexes } from '../serialize/templateTheme.js';
import type { TemplateColorSwatch, TemplateFontUsage } from './types.js';

export interface TemplateStylePanelProps {
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  colorRoles: Record<string, ThemeColorRole>;
  setColorRoles: (updater: (prev: Record<string, ThemeColorRole>) => Record<string, ThemeColorRole>) => void;
  roleColorOverrides: Partial<Record<ThemeColorRole, string>>;
  setRoleColorOverrides: (
    updater: (prev: Partial<Record<ThemeColorRole, string>>) => Partial<Record<ThemeColorRole, string>>,
  ) => void;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function HexField({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  return (
    <input
      key={value}
      type="text"
      className="f2s-tmpl-hex-input"
      defaultValue={value}
      spellcheck={false}
      maxLength={7}
      aria-label="Hex color"
      onInput={(e) => {
        const raw = (e.target as HTMLInputElement).value.trim();
        const hex = raw.startsWith('#') ? raw : `#${raw}`;
        if (HEX_RE.test(hex)) onCommit(hex.toUpperCase());
      }}
    />
  );
}

/**
 * Onglet "Style" du mode template (audit 2026-08, point 2 — TODO.md §
 * Mode template) : vue agrégée de TOUT le template (contrairement au
 * rapport par layout de TemplatePanel, qui n'affiche qu'une frame à la
 * fois). Centré sur les 12 rôles de thème Slides (pas sur les couleurs
 * détectées) — voir `serialize/templateTheme.ts` — puisque ce sont eux
 * que l'API écrit d'un coup sur le Master (mapper/theme.ts) : les 12
 * apparaissent donc toujours, avec leur valeur de repli, plutôt que de
 * n'afficher que ce que le créateur a explicitement touché. Un rôle non
 * assigné reste un aplat RGB statique par élément comme avant : cet
 * onglet est strictement additif, jamais requis pour créer un template.
 */
export function TemplateStylePanel({ colors, fonts, colorRoles, setColorRoles, roleColorOverrides, setRoleColorOverrides }: TemplateStylePanelProps) {
  const roleHexes = resolveThemeRoleHexes(colorRoles, colors, roleColorOverrides);
  const assignedKeyByRole = new Map<ThemeColorRole, string>();
  for (const [key, role] of Object.entries(colorRoles)) assignedKeyByRole.set(role, key);
  const sortedColors = [...colors].sort((a, b) => b.usageCount - a.usageCount);

  /** Un clic sur une couleur détectée l'assigne au rôle — retire l'éventuelle autre couleur qui tenait déjà ce rôle (un rôle = une source à la fois) et l'éventuel hex tapé à la main (la couleur détectée reprend la main). */
  function assignDetectedColor(role: ThemeColorRole, key: string) {
    setColorRoles((prev) => {
      const next: Record<string, ThemeColorRole> = {};
      for (const [k, r] of Object.entries(prev)) {
        if (r === role || k === key) continue;
        next[k] = r;
      }
      next[key] = role;
      return next;
    });
    setRoleColorOverrides((prev) => {
      if (!(role in prev)) return prev;
      const next = { ...prev };
      delete next[role];
      return next;
    });
  }

  function setRoleHex(role: ThemeColorRole, hex: string) {
    setRoleColorOverrides((prev) => ({ ...prev, [role]: hex }));
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
          <h3 className="f2s-tmpl-heading">Theme colors (12)</h3>
          <ul className="f2s-tmpl-list">
            {THEME_ROLES.map((role) => {
              const hex = roleHexes[role];
              const assignedKey = assignedKeyByRole.get(role);
              return (
                <li key={role} className="f2s-tmpl-role-row">
                  <span className="f2s-tmpl-swatch">
                    <span className="f2s-tmpl-swatch-color" style={{ backgroundColor: hex }} />
                  </span>
                  <span className="f2s-tmpl-role">{THEME_ROLE_LABELS[role]}</span>
                  <HexField value={hex} onCommit={(next) => setRoleHex(role, next)} />
                  {hex !== DEFAULT_THEME_ROLE_HEX[role] && (
                    <button
                      type="button"
                      className="f2s-icon-btn"
                      title="Reset to default"
                      onClick={() => {
                        if (assignedKey) setColorRoles((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== assignedKey)));
                        setRoleColorOverrides((prev) => {
                          if (!(role in prev)) return prev;
                          const next = { ...prev };
                          delete next[role];
                          return next;
                        });
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {sortedColors.length > 0 && (
                    <span className="f2s-tmpl-suggestions">
                      {sortedColors.map((c) => {
                        const key = colorKey(c.hex, c.alpha);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`f2s-tmpl-suggestion${key === assignedKey ? ' is-selected' : ''}`}
                            title={`Use ${c.hex}${c.alpha < 1 ? ` · ${Math.round(c.alpha * 100)}%` : ''} · used ${c.usageCount}×`}
                            onClick={() => assignDetectedColor(role, key)}
                          >
                            <span style={{ backgroundColor: c.hex, opacity: c.alpha }} />
                          </button>
                        );
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {colors.length === 0 && <p className="f2s-toolbar-muted">No color detected yet — add layouts first.</p>}
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
