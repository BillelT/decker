import { postToPlugin, selectSourceNodes, type TemplateLayoutState } from './types.js';

export interface TemplatePanelProps {
  order: string[];
  layouts: Record<string, TemplateLayoutState>;
  activeId: string | undefined;
  setActiveId: (id: string) => void;
  selecting: boolean;
  hasCanvasSelection: boolean;
  notice: string | undefined;
  onRemove: (id: string) => void;
}

/**
 * Rail de layouts + rapport de contenu communicable du mode template
 * (brief-creation-template-google-slides.md : couleurs, typos, layouts,
 * placeholders). Contrairement au deck, pas (encore) de réordonnancement
 * par drag — voir TODO.md.
 */
export function TemplatePanel({ order, layouts, activeId, setActiveId, selecting, hasCanvasSelection, notice, onRemove }: TemplatePanelProps) {
  const activeLayout = activeId ? layouts[activeId] : undefined;

  function selectLayout(id: string) {
    setActiveId(id);
    postToPlugin({ type: 'select-nodes', nodeIds: [id] });
  }

  return (
    <div className="f2s-body">
      <aside className="f2s-sidebar">
        {notice && <p className="f2s-error">{notice}</p>}
        {selecting && order.length > 0 && !hasCanvasSelection && (
          <p className="f2s-toolbar-muted">Select one or more frames on the Figma canvas, then click "Add selection".</p>
        )}
        {order.length === 0 ? (
          <p className="f2s-empty">
            {selecting
              ? 'Select one or more frames on the Figma canvas, then click "Add selection".'
              : 'Click "Select layout to add" to choose the layouts that make up this template — e.g. a title slide, a content slide.'}
          </p>
        ) : (
          order.map((id, index) => {
            const layout = layouts[id];
            if (!layout) return null;
            return (
              <div key={id} className="f2s-sidebar-item">
                <button
                  type="button"
                  className={`f2s-frame-preview${activeId === id ? ' is-active' : ''}${layout.blocking ? ' f2s-frame-preview--blocking' : ''}`}
                  onClick={() => selectLayout(id)}
                  title={layout.blocking ? 'Contains an element that would be rasterized — open it to see the details.' : undefined}
                >
                  {layout.previewDataUrl && <img src={layout.previewDataUrl} alt={layout.name} draggable={false} />}
                </button>
                <div className="f2s-frame-info">
                  <span className="f2s-frame-text">
                    {index + 1}. {layout.name}
                  </span>
                  <div className="f2s-frame-controls">
                    <button type="button" className="f2s-icon-btn" title="Remove" onClick={() => onRemove(id)}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </aside>

      <main className="f2s-canvas f2s-canvas--template">
        {/*
          Attentes de fin de parcours (audit template) : l'API Slides ne
          permettant pas de créer un vrai Master/Layout, le livrable est une
          présentation normale à dupliquer — l'équivalent pratique d'un
          "thème" Slides. Dit ICI, dans l'UI, plutôt que découvert après
          création.
        */}
        <p className="f2s-tmpl-note">
          A template is a reusable Slides deck (like a Slides theme): each layout becomes a slide your team duplicates and fills.
          The Slides API can't create native masters/layouts, so the result is a regular presentation to copy from.
        </p>

        {activeLayout ? (
          <div className="f2s-tmpl-report">
            <div className="f2s-canvas-preview f2s-tmpl-preview">
              {activeLayout.previewDataUrl && <img src={activeLayout.previewDataUrl} alt={activeLayout.name} />}
            </div>

            <div className="f2s-tmpl-panel">
              {activeLayout.warnings.filter((w) => w.severity === 'blocking').length > 0 && (
                <section className="f2s-tmpl-section f2s-tmpl-section--blocking">
                  <h3 className="f2s-tmpl-heading">Fix before creating the template</h3>
                  <ul className="f2s-tmpl-list">
                    {activeLayout.warnings
                      .filter((w) => w.severity === 'blocking')
                      .map((w, i) => (
                        <li key={i}>
                          <button type="button" className="f2s-tmpl-warning" onClick={() => selectSourceNodes([w.sourceNodeId])}>
                            <strong>{w.nodeName}</strong> — {w.message}
                          </button>
                        </li>
                      ))}
                  </ul>
                </section>
              )}

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Placeholders</h3>
                {activeLayout.placeholders.length === 0 ? (
                  <p className="f2s-toolbar-muted">
                    No tagged placeholder yet — prefix a layer name in Figma with <code>[[title]]</code>, <code>[[body]]</code>,{' '}
                    <code>[[image]]</code>, <code>[[subtitle]]</code> or <code>[[logo]]</code> to mark it.
                  </p>
                ) : (
                  <ul className="f2s-tmpl-list">
                    {activeLayout.placeholders.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="f2s-tmpl-chip" onClick={() => selectSourceNodes([p.sourceNodeId])}>
                          <span className="f2s-tmpl-role">{p.role}</span>
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Colors</h3>
                {activeLayout.colors.length === 0 ? (
                  <p className="f2s-toolbar-muted">No solid color detected.</p>
                ) : (
                  <ul className="f2s-tmpl-swatches">
                    {activeLayout.colors.map((c, i) => (
                      <li key={i} className="f2s-tmpl-swatch-item">
                        {/* Fond damier sous la pastille : une couleur semi-transparente
                            se lit comme telle au lieu d'être faussée par le fond du panneau. */}
                        <span className="f2s-tmpl-swatch">
                          <span
                            className="f2s-tmpl-swatch-color"
                            style={{ backgroundColor: c.hex, opacity: c.alpha }}
                          />
                        </span>
                        <span className="f2s-tmpl-swatch-label">
                          {c.hex}
                          {c.alpha < 1 ? ` · ${Math.round(c.alpha * 100)}%` : ''}
                          <span className="f2s-toolbar-muted"> · used {c.usageCount}×</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Typography</h3>
                {activeLayout.fonts.length === 0 ? (
                  <p className="f2s-toolbar-muted">No text detected.</p>
                ) : (
                  <ul className="f2s-tmpl-list">
                    {activeLayout.fonts.map((f) => (
                      <li key={f.family}>
                        <span className="f2s-tmpl-font-family">{f.family}</span>{' '}
                        <span className="f2s-toolbar-muted">({f.weights.join(', ')})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : (
          <p className="f2s-canvas-empty">Select a layout on the left to see its report.</p>
        )}
      </main>
    </div>
  );
}
