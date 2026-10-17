import type { ThemeColorRole } from '@figma-to-slides/shared';
import { AVAILABLE_SLIDES_FONTS } from '../serialize/fonts.js';
import { suggestColorRoles } from '../serialize/templateColorRoles.js';
import { colorKey } from '../serialize/templateSummary.js';
import { THEME_ROLE_LABELS, VISIBLE_THEME_ROLES } from '../serialize/templateTheme.js';
import { FontCombobox } from './FontCombobox.js';
import { selectSourceNodes, type TemplateColorSwatch, type TemplateElement, type TemplateFontUsage } from './types.js';

export interface TemplateStylePanelProps {
  /** Premier layout du rail, écrit sur le Master Slides (absent sous 2 layouts). */
  master?: { name: string; elements: TemplateElement[] };
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  /** Choix manuel de police (bandeau "Fonts") — voir logEntryFlag.ts pour le même besoin côté Logs. */
  fontOverrides: Record<string, string>;
  /** Même état que le bandeau "Fonts" : les deux sélecteurs restent synchronisés. */
  setFontOverrides: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  colorRoles: Record<string, ThemeColorRole>;
  setColorRoles: (updater: (prev: Record<string, ThemeColorRole>) => Record<string, ThemeColorRole>) => void;
  /** Information à afficher dans le toast du panneau (ex. un rôle repris à une autre couleur). */
  onNotice: (message: string) => void;
  /** Export en cours : les rôles de couleur sont déjà partis, on ne les change plus. */
  locked?: boolean;
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
const SUGGESTION_PLURALS = new Intl.PluralRules('en');

export function TemplateStylePanel({ master, colors, fonts, fontOverrides, setFontOverrides, colorRoles, setColorRoles, onNotice, locked = false }: TemplateStylePanelProps) {
  const assignedKeyByRole = new Map<ThemeColorRole, string>();
  for (const [key, role] of Object.entries(colorRoles)) assignedKeyByRole.set(role, key);
  const sortedColors = [...colors].sort((a, b) => b.usageCount - a.usageCount);
  const byKey = new Map(colors.map((c) => [colorKey(c.hex, c.alpha), c]));

  /**
   * Un rôle n'est jamais assignable qu'à une seule couleur à la fois (11
   * rôles éditables au maximum, cf. `VISIBLE_THEME_ROLES`). Choisir un rôle
   * déjà pris par une AUTRE couleur le lui retire — le sélecteur de chaque
   * couleur reste donc toujours complet plutôt que de faire disparaître des
   * options d'une ligne à l'autre, et le toast du panneau le signale, ce
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
      onNotice(`"${THEME_ROLE_LABELS[role]}" moved from ${stolenFrom ? colorLabel(stolenFrom) : previousKey} to this color.`);
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

  // Rôles proposés d'après l'usage de chaque couleur (texte, fond, lien,
  // élément), sans jamais toucher à un choix déjà fait : voir
  // templateColorRoles.ts. Bouton désactivé quand il n'a plus rien à proposer.
  const suggestedRoles = suggestColorRoles(colors, colorRoles);
  const suggestedCount = Object.keys(suggestedRoles).length - Object.keys(colorRoles).length;

  function applySuggestedRoles() {
    setColorRoles(() => suggestedRoles);
    onNotice(`${suggestedCount} ${SUGGESTION_PLURALS.select(suggestedCount) === 'one' ? 'role' : 'roles'} suggested. Change any of them below.`);
  }

  return (
    <div className="f2s-style-panel">
      {/* Ce que le Master propage : tout ce qui est posé sur le premier
          layout apparaît sur chaque layout et chaque slide une fois dans
          Slides (backend mapper/templateLayouts.ts::mapMasterBatch). */}
      <section className="f2s-tmpl-section">
        <h3 className="f2s-tmpl-heading f2s-style-heading">Master content</h3>
        {!master ? (
          <p className="f2s-toolbar-muted">The first layout becomes the master once you add a second one. What it holds appears on every slide.</p>
        ) : master.elements.length === 0 ? (
          <p className="f2s-toolbar-muted">"{master.name}" is the master. Add a logo or a footer to it to show them on every slide.</p>
        ) : (
          <ul className="f2s-style-list">
            {master.elements.map((el) => (
              <li key={el.id}>
                <button type="button" className="f2s-tmpl-chip" title={`Select "${el.name}" in Figma`} onClick={() => selectSourceNodes([el.sourceNodeId])}>
                  <span className="f2s-tmpl-chip-label">{el.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="f2s-tmpl-section">
        <div className="f2s-section-head">
          <h3 className="f2s-tmpl-heading f2s-style-heading">Colors</h3>
          {colors.length > 0 && (
            <button
              type="button"
              className="f2s-btn f2s-btn--ghost"
              disabled={locked || suggestedCount === 0}
              title={
                suggestedCount === 0
                  ? 'Nothing left to suggest: every role or color is already assigned.'
                  : 'Fill the free roles from how each color is used: text, background, links, then vivid colors as accents.'
              }
              onClick={applySuggestedRoles}
            >
              Suggest roles
            </button>
          )}
        </div>
        {colors.length === 0 ? (
          <p className="f2s-toolbar-muted">The colors of your layouts will appear here, ready to map to the Slides theme.</p>
        ) : (
          <ul className="f2s-style-list">
            {sortedColors.map((c) => {
              const key = colorKey(c.hex, c.alpha);
              const label = colorLabel(c);
              return (
                <li key={key} className="f2s-style-row">
                  <div className="f2s-style-row-main">
                    <span
                      className={`f2s-style-swatch${c.alpha < 1 ? ' f2s-style-swatch--transparent' : ''}`}
                      style={{ backgroundColor: c.hex, opacity: c.alpha }}
                    />
                    <span className="f2s-style-label" title={label}>
                      {label}
                    </span>
                    <select
                      className="f2s-font-dropdown f2s-style-role-select"
                      aria-label={`Theme role for ${label}`}
                      value={colorRoles[key] ?? ''}
                      disabled={locked}
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
          <p className="f2s-toolbar-muted">The fonts of your layouts will appear here, ready to replace.</p>
        ) : (
          <ul className="f2s-style-list">
            {fonts.map((f) => {
              // Même clé que le bandeau "Fonts" (police d'origine si
              // substituée, sinon sa propre famille) : changer l'un change
              // l'autre. `family` reflète le choix courant plutôt que la
              // résolution figée au serialize (cf. logEntryFlag.ts).
              const key = f.original ?? f.family;
              const family = fontOverrides[key] ?? f.family;
              return (
                <li key={key} className="f2s-style-row">
                  <div className="f2s-style-row-main">
                    <span className="f2s-style-font-swatch" style={{ fontFamily: family }}>
                      Aa
                    </span>
                    <span className="f2s-style-font-info">
                      <span className="f2s-tmpl-font-family" title={key}>
                        {key}
                      </span>
                      <span className="f2s-toolbar-muted">{f.weights.join(', ')}</span>
                    </span>
                  </div>
                  <div className="f2s-style-font-replace">
                    <span className="f2s-font-arrow">→</span>
                    <FontCombobox
                      value={family}
                      options={AVAILABLE_SLIDES_FONTS}
                      ariaLabel={`Replacement font for "${key}"`}
                      onChange={(value) => setFontOverrides((prev) => ({ ...prev, [key]: value }))}
                    />
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
