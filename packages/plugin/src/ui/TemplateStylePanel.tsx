import type { ThemeColorRole } from '@figma-to-slides/shared';
import { colorKey } from '../serialize/templateSummary.js';
import { DEFAULT_THEME_ROLE_HEX, THEME_ROLE_LABELS, VISIBLE_THEME_ROLES, resolveThemeRoleHexes } from '../serialize/templateTheme.js';
import type { TemplateColorSwatch, TemplateFontUsage } from './types.js';

export interface TemplateStylePanelProps {
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  /** Choix manuel de police (bandeau "Fonts") — voir logEntryFlag.ts pour le même besoin côté Logs. */
  fontOverrides: Record<string, string>;
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
 * Panneau "Styles" du mode template (audit 2026-08, point 2 — TODO.md §
 * Mode template) : vue agrégée de TOUT le template (contrairement au
 * rapport par layout de TemplatePanel, qui n'affiche qu'une frame à la
 * fois), affichée dans l'aside droit (280px, cf. TemplatePanel) plutôt
 * que dans un onglet séparé — comme la liste "Color styles"/"Text
 * styles" de Figma, mais chaque ligne reste directement éditable (hex
 * tapé à la main) et propose les couleurs détectées comme suggestions de
 * remplacement en un clic, là où Figma se contente d'assigner un style
 * existant. Centré sur les 12 rôles de thème Slides (pas sur les couleurs
 * détectées) — voir `serialize/templateTheme.ts` — puisque ce sont eux
 * que l'API écrit d'un coup sur le Master (mapper/theme.ts) : les 12
 * apparaissent donc toujours, avec leur valeur de repli, plutôt que de
 * n'afficher que ce que le créateur a explicitement touché. Un rôle non
 * assigné reste un aplat RGB statique par élément comme avant : ce
 * panneau est strictement additif, jamais requis pour créer un template.
 */
export function TemplateStylePanel({ colors, fonts, fontOverrides, colorRoles, setColorRoles, roleColorOverrides, setRoleColorOverrides }: TemplateStylePanelProps) {
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
    <div className="f2s-style-panel">
      <section className="f2s-tmpl-section">
        <h3 className="f2s-tmpl-heading f2s-style-heading">Colors</h3>
        <ul className="f2s-style-list">
          {VISIBLE_THEME_ROLES.map((role) => {
            const hex = roleHexes[role];
            const assignedKey = assignedKeyByRole.get(role);
            return (
              <li key={role} className="f2s-style-row">
                <div className="f2s-style-row-main">
                  <span className="f2s-style-swatch" style={{ backgroundColor: hex }} />
                  <span className="f2s-style-label" title={THEME_ROLE_LABELS[role]}>
                    {THEME_ROLE_LABELS[role]}
                  </span>
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
                </div>
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
