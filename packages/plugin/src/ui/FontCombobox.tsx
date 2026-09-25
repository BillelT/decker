import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface FontComboboxProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

/** Largeur de la boîte pilotée par l'attribut HTML `size` (en caractères) plutôt que par `width` : un `<input>`, contrairement à un `<select>`, ne se dimensionne pas seul sur son contenu. */
const MIN_SIZE = 10;
const MAX_SIZE = 26;

/**
 * Remplace le `<select>` natif du bandeau "Fonts" : garde l'apparence et le
 * comportement d'un select (fermé par défaut, liste au clic, valeur unique
 * dans `AVAILABLE_SLIDES_FONTS`) tout en laissant taper pour filtrer la
 * liste, la police Slides étant plus longue à retrouver au clavier.
 */
export function FontCombobox({ value, options, onChange, ariaLabel }: FontComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  // Tant que l'utilisateur n'a pas tapé depuis l'ouverture, `query` vaut
  // encore la police actuelle : filtrer dessus ne montrerait qu'elle-même
  // (match exact) au lieu de laisser parcourir toute la liste, comme un
  // `<select>` classique fraîchement ouvert.
  const [typed, setTyped] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Position calculée en pixels plutôt que `position: absolute` dans le
  // flux normal : le bandeau "Fonts" scrolle horizontalement
  // (`.f2s-toolbar-row` a `overflow-x: auto`), ce qui force aussi
  // `overflow-y` à se comporter comme `auto` (quirk CSS bien connu dès
  // qu'un seul axe n'est pas `visible`) et rognerait donc la liste si elle
  // restait positionnée dans ce flux. `position: fixed` avec des
  // coordonnées calculées échappe à ce rognage (un `fixed` n'est clippé que
  // par un ancêtre qui a lui-même transform/filter/perspective, ce qui
  // n'est pas le cas ici).
  const [listRect, setListRect] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  useLayoutEffect(() => {
    if (!open) return;
    function updateRect() {
      const box = rootRef.current?.getBoundingClientRect();
      if (!box) return;
      setListRect({ top: box.bottom + 4, left: box.left, minWidth: box.width });
    }
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
        setTyped(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector('.f2s-font-combobox-option--active')?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  const trimmed = typed ? query.trim().toLowerCase() : '';
  const filtered = trimmed ? options.filter((f) => f.toLowerCase().includes(trimmed)) : options;

  function commit(font: string) {
    onChange(font);
    setQuery(font);
    setTyped(false);
    setOpen(false);
  }

  function openList() {
    setOpen(true);
    setTyped(false);
    const current = options.findIndex((f) => f === value);
    setHighlight(Math.max(0, current));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        commit(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery(value);
        setTyped(false);
      }
    }
  }

  const displayText = open ? query : value;
  const sizeAttr = Math.min(MAX_SIZE, Math.max(MIN_SIZE, displayText.length + 1));

  return (
    <div
      className={`f2s-font-combobox${open ? ' f2s-font-combobox--open' : ''}`}
      ref={rootRef}
      onMouseDown={(e) => {
        // Clic sur la flèche ou le padding (pas l'input lui-même, qui gère
        // déjà son propre focus) : ouvre quand même, comme un `<select>`
        // qu'on peut ouvrir en cliquant n'importe où dans sa boîte.
        if (e.target === inputRef.current) return;
        e.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className="f2s-font-combobox-input"
        size={sizeAttr}
        value={displayText}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autocomplete="off"
        onFocus={() => {
          openList();
          inputRef.current?.select();
        }}
        onClick={() => {
          if (!open) openList();
        }}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          setQuery(v);
          setTyped(true);
          if (!open) setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Un clic sur une option ne déclenche pas ce blur : la liste
          // l'intercepte via `onMouseDown`/`preventDefault` (voir plus bas),
          // donc ce blur ne voit que les sorties "réelles" (Tab, clic
          // ailleurs déjà géré par le listener document, etc.).
          setOpen(false);
          setQuery(value);
          setTyped(false);
        }}
      />
      <span className="f2s-font-combobox-arrow" aria-hidden="true" />
      {open && listRect && (
        <ul
          className="f2s-font-combobox-list"
          role="listbox"
          style={{ top: `${listRect.top}px`, left: `${listRect.left}px`, minWidth: `${listRect.minWidth}px` }}
        >
          {filtered.length === 0 ? (
            <li className="f2s-font-combobox-empty">No matching font</li>
          ) : (
            filtered.map((font, i) => (
              <li
                key={font}
                role="option"
                aria-selected={font === value}
                className={`f2s-font-combobox-option${i === highlight ? ' f2s-font-combobox-option--active' : ''}${
                  font === value ? ' f2s-font-combobox-option--selected' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(font);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                {font}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
