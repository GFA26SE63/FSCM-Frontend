import { useRef, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, ConfirmDialog } from '@/shared/ui';
import { useDeleteProduct, useInactivateProduct, usePublishProduct } from '../hooks';
import type { Product } from '../types';

type Action = 'publish' | 'inactivate' | 'delete';
const copy = {
  publish: { title: 'Đăng bán sản phẩm', message: 'Thông tin và giá sẽ khóa trên Portal. Nếu đây là bản thay thế, SKU nguồn sẽ chuyển Ngừng bán.', label: 'Đăng bán', danger: false },
  inactivate: { title: 'Ngừng bán sản phẩm', message: 'Sản phẩm không còn dùng cho đơn mới.', label: 'Ngừng bán', danger: true },
  delete: { title: 'Xóa bản nháp', message: 'Xóa bản nháp này? Thao tác không thể hoàn tác.', label: 'Xóa', danger: true },
} as const;

export function ProductActions({ p, size = 'sm', onDeleted }: {
  p: Product; size?: 'sm' | 'md'; onDeleted?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const publish = usePublishProduct();
  const inactivate = useInactivateProduct();
  const remove = useDeleteProduct();
  const [action, setAction] = useState<Action | null>(null);
  const [failure, setFailure] = useState('');
  const saving = useRef(false);
  const busy = publish.isPending || inactivate.isPending || remove.isPending;
  if (!can(user, 'products.manage')) return null;
  const choose = (next: Action) => { setFailure(''); setAction(next); };
  const confirm = async () => {
    if (!action || saving.current) return;
    saving.current = true;
    setFailure('');
    try {
      if (action === 'publish') await publish.mutateAsync(p.id);
      else if (action === 'inactivate') await inactivate.mutateAsync(p.id);
      else await remove.mutateAsync(p.id);
      setAction(null);
      if (action === 'delete') onDeleted?.();
    } catch (error) { setFailure(errorMessage(error)); }
    finally { saving.current = false; }
  };
  return <>
    {p.status === 'Draft' && <>
      <Button size={size} disabled={busy} onClick={() => navigate('/skus/' + p.id + '/edit')}>Sửa nháp / giá</Button>
      <Button size={size} variant="primary" disabled={busy} onClick={() => choose('publish')}>Đăng bán</Button>
      <Button size={size} variant="danger" disabled={busy} onClick={() => choose('delete')}>Xóa</Button>
    </>}
    {p.status === 'Published' && <>
      <Button size={size} disabled={busy} onClick={() => navigate('/skus/' + p.id + '/new-version')}>Tạo bản mới</Button>
      <Button size={size} variant="danger" disabled={busy} onClick={() => choose('inactivate')}>Ngừng bán</Button>
    </>}
    {action && <ConfirmDialog open title={copy[action].title + ' · ' + p.sku}
      confirmLabel={copy[action].label} danger={copy[action].danger} onConfirm={confirm}
      onClose={() => { if (!saving.current) setAction(null); }}
      message={<><p>{copy[action].message}</p>{failure && <div className="callout callout-danger" role="alert">{failure}</div>}</>}
    />}
  </>;
}
