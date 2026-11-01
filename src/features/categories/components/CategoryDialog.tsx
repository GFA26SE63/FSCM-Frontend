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
      note={edit ? undefined : 'Mã CAT-xx do hệ thống cấp hoặc nhập thủ công; tên danh mục không được trùng.'}
      initial={category ? { ...category } : { code: '', name: '', description: '', status: 'Active' }}
      fields={[
        ...(edit
          ? []
          : [
              {
                key: 'code',
                label: 'Mã danh mục',
                placeholder: 'Để trống để tự động sinh mã (CAT-xx)',
                hint: 'Định dạng quy định: CAT-xx (VD: CAT-01, CAT-02)',
              },
            ]),
        { key: 'name', label: 'Tên danh mục', required: true },
        { key: 'description', label: 'Mô tả', type: 'textarea' },
        {
          key: 'status',
          label: 'Trạng thái',
          type: 'select',
          options: [
            { value: 'Active', label: 'Hoạt động' },
            { value: 'Inactive', label: 'Ngừng hoạt động' },
          ],
        },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = {
          name: String(v.name ?? ''),
          description: String(v.description ?? ''),
          status: (v.status as Category['status']) || 'Active',
        };
        if (edit) {
          await update.mutateAsync({
            ...input,
            id: category!.id,
            code: category!.code,
            parentCategoryId: category!.parentCategoryId,
          });
        } else {
          await create.mutateAsync({
            ...input,
            code: v.code ? String(v.code).trim().toUpperCase() : undefined,
          });
        }
        onClose();
      }}
    />
  );
}

