import { useId, useState } from 'react';
import type { SelectOption } from './FormField';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase();

/** Search labels while keeping only a known option's identifier in form state. */
export function SearchSelect({ value, options, onChange, placeholder = 'Tìm mã hoặc tên sản phẩm…', disabled, invalid }: {
  value: string; options: (SelectOption | string)[]; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean; invalid?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const opts = options.map((o) => typeof o === 'string' ? { value: o, label: o } : o);
  const selected = opts.find((o) => o.value === value);
  const matches = opts.filter((o) => !o.disabled && normalize(o.label).includes(normalize(query)));
  const choose = (option: SelectOption) => { onChange(option.value); setOpen(false); setQuery(''); };
  return <div style={{ position: 'relative', minWidth: 0 }}>
    <input className={`inp${invalid ? ' invalid' : ''}`} role="combobox" autoComplete="off"
      aria-expanded={open} aria-controls={id} aria-autocomplete="list"
      aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
      disabled={disabled} placeholder={placeholder} value={open ? query : selected?.label ?? ''}
      onFocus={() => { setQuery(''); setActive(0); setOpen(true); }}
      onBlur={() => { setOpen(false); setQuery(''); }}
      onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); if (value) onChange(''); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setQuery(''); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setOpen(true);
          setActive((a) => Math.max(0, Math.min(matches.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1))));
        }
        if (e.key === 'Enter' && open) { e.preventDefault(); if (matches[active]) choose(matches[active]); }
      }} />
    {open && <div id={id} role="listbox" style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
      maxHeight: 260, overflowY: 'auto', background: 'white', border: '1px solid var(--c-border)', borderRadius: 8, boxShadow: '0 4px 16px #0002' }}>
      {matches.length ? matches.map((o, i) => <div key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value}
        onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}
        style={{ padding: '10px 12px', cursor: 'pointer', background: i === active ? '#e5f2ee' : undefined, overflowWrap: 'anywhere' }}>{o.label}</div>)
        : <div style={{ padding: 12 }}>Không tìm thấy kết quả.</div>}
    </div>}
  </div>;
}
