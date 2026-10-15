import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** No inner padding (tables). */
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Card({ title, actions, children, flush, className, style }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')} style={style}>
      {(title || actions) && (
        <div className="card-hd" style={flush ? { paddingBottom: 12 } : undefined}>
          {typeof title === 'string' ? <h2 className="sec spacer">{title}</h2> : <div className="spacer">{title}</div>}
          {actions}
        </div>
      )}
      <div className={flush ? undefined : title || actions ? 'card-bd' : 'card-pad'}>{children}</div>
    </section>
  );
}
