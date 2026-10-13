import { useState } from 'react';
import { Button, ConfirmDialog } from '@/shared/ui';
import { useCloneProduct, useDeleteProduct, useInactivateProduct, usePublishProduct } from '../hooks';
import type { Product } from '../types';

type Kind = 'publish' | 'inactivate' | 'clone' | 'delete';
const copy: Record<Kind, { title: string; message: string; label: string; danger?: boolean }> = {
  publish: { title: 'Publish sản phẩm', message: 'Sau khi publish, thông tin sản phẩm bị khóa và Sales / retailer thấy sản phẩm. Nếu đây là bản thay thế, SKU cũ sẽ chuyển Inactive.', label: 'Publish' },
  inactivate: { title: 'Chuyển Inactive', message: 'Sản phẩm không còn xuất hiện khi tạo đơn mới. Tồn kho và đơn cũ không bị ảnh hưởng.', label: 'Chuyển Inactive', danger: true },
  clone: { title: 'Tạo bản mới', message: 'Tạo bản nháp sao chép từ SKU này để chỉnh sửa. Khi publish bản nháp, SKU hiện tại tự chuyển Inactive.', label: 'Tạo bản nháp' },
  delete: { title: 'Xóa bản nháp', message: 'Chỉ xóa được bản nháp. Thao tác không thể hoàn tác.', label: 'Xóa', danger: true },
};

/** Lifecycle buttons by status: Draft → Publish / Xóa; Published → Tạo bản mới / Inactive; Inactive → Tạo bản mới. */
export function ProductActions({ p, onEdit, size = 'sm', onDeleted }: { p: Product; onEdit?: () => void; size?: 'sm' | 'md'; onDeleted?: () => void }) {
  const publish = usePublishProduct();
  const inactivate = useInactivateProduct();
  const clone = useCloneProduct();
  const remove = useDeleteProduct();
  const [kind, setKind] = useState<Kind | null>(null);
  const run = async () => {
    if (kind === 'publish') await publish.mutateAsync(p.sku);
    if (kind === 'inactivate') await inactivate.mutateAsync(p.sku);
    if (kind === 'clone') await clone.mutateAsync(p.sku);
    if (kind === 'delete') {
      await remove.mutateAsync(p.sku);
      onDeleted?.();
    }
    setKind(null);
  };
  return (
    <>
      {p.status === 'Draft' && (
        <>
          {onEdit && <Button size={size} onClick={onEdit}>Sửa</Button>}
          <Button size={size} variant="primary" onClick={() => setKind('publish')}>Publish</Button>
          <Button size={size} variant="danger" onClick={() => setKind('delete')}>Xóa</Button>
        </>
      )}
      {p.status !== 'Draft' && <Button size={size} onClick={() => setKind('clone')}>Tạo bản mới</Button>}
      {p.status === 'Published' && <Button size={size} variant="danger" onClick={() => setKind('inactivate')}>Inactive</Button>}
      {kind && <ConfirmDialog open title={`${copy[kind].title} · ${p.sku}`} message={copy[kind].message} confirmLabel={copy[kind].label} danger={copy[kind].danger} onClose={() => setKind(null)} onConfirm={run} />}
    </>
  );
}
