import type { ReactNode } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button } from './Button';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Show "← Quay lại"; string = path, true = history back. */
  back?: string | boolean;
  chips?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, back, chips, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="page-hd">
      {back && (
        <Button onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>← Quay lại</Button>
      )}
      <div className="spacer" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="page-title">{title}</span>
          {chips}
        </div>
        {subtitle && <span className="page-sub">{subtitle}</span>}
      </div>
      {actions}
    </div>
  );
}
