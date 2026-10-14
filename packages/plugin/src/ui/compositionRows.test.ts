import { describe, expect, it } from 'vitest';
import { splitCompositionRows } from './compositionRows.js';
import type { TemplateElement, TemplateWarning } from './types.js';

const el = (id: string, kind: TemplateElement['kind'], role?: string): TemplateElement => ({ id, sourceNodeId: `n${id}`, name: `Layer ${id}`, kind, role });

const warn = (code: string, sourceNodeId: string, message: string): TemplateWarning => ({ code, severity: 'warning', sourceNodeId, nodeName: sourceNodeId, message });

describe('splitCompositionRows', () => {
  it('range les calques tagués dans Composition, les autres dans Content, ordre conservé', () => {
    const rows = splitCompositionRows([el('1', 'text', 'TITLE'), el('2', 'text'), el('3', 'shape', 'IMAGE'), el('4', 'image')], []);
    expect(rows.tagged.map((e) => e.id)).toEqual(['1', '3']);
    expect(rows.untagged.map((e) => e.id)).toEqual(['2', '4']);
    expect(rows.conflicts.size).toBe(0);
  });

  it('marque chaque calque en conflit avec ses messages, sans doublon', () => {
    const rows = splitCompositionRows(
      [el('1', 'text', 'TITLE'), el('2', 'shape', 'TITLE')],
      [
        warn('PLACEHOLDER_ROLE_DUPLICATE', 'n1', '2 layers tagged [[title]].'),
        warn('PLACEHOLDER_ROLE_DUPLICATE', 'n2', '2 layers tagged [[title]].'),
        warn('PLACEHOLDER_ROLE_KIND_MISMATCH', 'n2', 'Tagged [[title]] but not a text layer.'),
        warn('PLACEHOLDER_ROLE_KIND_MISMATCH', 'n2', 'Tagged [[title]] but not a text layer.'),
      ],
    );
    expect(rows.conflicts.get('n1')).toEqual(['2 layers tagged [[title]].']);
    expect(rows.conflicts.get('n2')).toEqual(['2 layers tagged [[title]].', 'Tagged [[title]] but not a text layer.']);
    expect(rows.unattached).toEqual([]);
  });

  it('garde à part un avertissement qui ne vise aucun calque tagué', () => {
    const layoutLevel = warn('LAYOUT_WITHOUT_PLACEHOLDER', 'frame', 'No placeholder in this layout.');
    const rows = splitCompositionRows([el('1', 'text')], [layoutLevel]);
    expect(rows.tagged).toEqual([]);
    expect(rows.unattached).toEqual([layoutLevel]);
  });
});
