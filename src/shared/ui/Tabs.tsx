export interface TabItem<K extends string = string> {
  key: K;
  label: string;
  count?: number;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** "pills" = filled buttons as in the prototype trace modal. */
  variant?: 'line' | 'pills';
}

export function Tabs<K extends string>({ items, value, onChange, variant = 'line' }: TabsProps<K>) {
  if (variant === 'pills') {
    return (
      <div className="pills" role="tablist">
        {items.map((t) => (
          <button key={t.key} role="tab" aria-selected={t.key === value} className={`pill${t.key === value ? ' active' : ''}`} onClick={() => onChange(t.key)}>
            {t.label}
            {t.count != null && ` (${t.count})`}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.key} role="tab" aria-selected={t.key === value} className={`tab${t.key === value ? ' active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
