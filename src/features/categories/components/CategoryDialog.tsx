import { FormDialog } from '@/shared/ui';
import { useCreateCategory, useUpdateCategory } from '../hooks';
import type { Category } from '../types';

export function CategoryDialog({ open, category, onClose }: { open: boolean; category?: Category | null; onClose: () => void }) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const edit = !!category;
  return (
    <FormDialog
      open={open}
      width={560}
      columns={1}
      title={edit ? `Sửa danh mục ${category!.code}` : 'Thêm danh mục'}
      submitLabel={edit ? 'Lưu' : 'Thêm danh mục'}
      note={edit ? undefined : 'Mã CAT-xx do hệ thống cấp; tên danh mục không được trùng.'}
      initial={category ? { ...category } : { name: '', description: '', status: 'Active' }}
      fields={[
        { key: 'name', label: 'Tên danh mục', required: true },
        { key: 'description', label: 'Mô tả', type: 'textarea' },
        { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'Inactive', label: 'Inactive' }] },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { name: v.name, description: v.description ?? '', status: v.status };
        await (edit ? update.mutateAsync({ ...input, code: category!.code }) : create.mutateAsync(input));
        onClose();
      }}
    />
  );
}
