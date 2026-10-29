import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Remplace le `<select>` natif : sa liste ouverte est dessinée par le
 * navigateur (survol et sélection en bleu système, impossibles à teinter),
 * alors que la DA veut la même liste que le sélecteur de polices
 * (`FontCombobox`) : mêmes classes, donc même fond, même survol gris, et
 * l'option choisie garde son fond gris tant qu'on n'en choisit pas une autre.
 */
export function Select({ value, options, onChange, ariaLabel, title, className = '', disabled = false, invalid }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // `position: fixed` calculé depuis la boîte à l'écran, pour la même raison
  // que FontCombobox : les bandeaux qui scrollent rogneraient une liste
  // posée dans le flux.
  const [rect, setRect] = useState<{ top: number; left?: number; right?: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = Math.max(0, options.findIndex((o) => o.value === value));
  const shown = options.find((o) => o.value === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const box = buttonRef.current?.getBoundingClientRect();
      if (!box) return;
      // Ancrée du côté où il reste de la place, pour ne pas sortir du plugin.
      const alignRight = box.left > window.innerWidth / 2;
      setRect({
        top: box.bottom + 4,
        ...(alignRight ? { right: window.innerWidth - box.right } : { left: box.left }),
        width: box.width,
      });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector('.f2s-font-combobox-option--active')?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  function openList() {
    setHighlight(current);
    setOpen(true);
  }

  function commit(next: string) {
    setOpen(false);
    buttonRef.current?.focus();
    if (next !== value) onChange(next);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      setHighlight((h) => Math.min(options.length - 1, Math.max(0, h + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      commit(options[highlight].value);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={`f2s-select ${className}`} ref={rootRef} data-empty={value === '' ? '' : undefined}>
      <button
        ref={buttonRef}
        type="button"
        className="f2s-select-button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid ? true : undefined}
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="f2s-select-text">{shown?.label}</span>
        <span className="f2s-font-combobox-arrow" aria-hidden="true" />
      </button>
      {open && rect && (
        <ul
          className="f2s-font-combobox-list f2s-select-list"
          role="listbox"
          style={{ top: `${rect.top}px`, left: rect.left === undefined ? undefined : `${rect.left}px`, right: rect.right === undefined ? undefined : `${rect.right}px`, minWidth: `${rect.width}px` }}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`f2s-font-combobox-option${i === highlight ? ' f2s-font-combobox-option--active' : ''}${o.value === value ? ' f2s-font-combobox-option--selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o.value);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
