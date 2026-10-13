import { FormDialog } from '@/shared/ui';
import { useCategoryOptions, useCreateProduct, useUpdateProduct } from '../hooks';
import type { ProductDetail } from '../types';

/** Create / edit a Draft product. Published and Inactive SKUs are locked – use "Tạo bản mới". */
export function ProductDialog({ open, product, onClose }: { open: boolean; product?: ProductDetail | null; onClose: () => void }) {
  const cats = useCategoryOptions(open);
  const create = useCreateProduct();
  const update = useUpdateProduct();
  if (!open || !cats.data) return null;
  const edit = !!product;
  return (
    <FormDialog
      open
      width={760}
      columns={3}
      title={edit ? `Sửa bản nháp ${product!.sku}` : 'Thêm sản phẩm (bản nháp)'}
      submitLabel={edit ? 'Lưu nháp' : 'Tạo bản nháp'}
      note="Sản phẩm mới ở trạng thái Nháp; sau khi Publish, thông tin bị khóa và retailer mới thấy sản phẩm."
      initial={product ? { ...product } : { name: '', categoryCode: cats.data[0]?.code ?? '', packSpec: '', basePrice: '', unitCost: '', shelfLifeDays: '', nearExpiryDays: '', defaultMlor: '0.5' }}
      fields={[
        { key: 'name', label: 'Tên sản phẩm', required: true, span: 2 },
        { key: 'categoryCode', label: 'Danh mục', type: 'select', required: true, options: cats.data.filter((c) => c.status === 'Active').map((c) => ({ value: c.code, label: c.name })) },
        { key: 'packSpec', label: 'Quy cách đóng gói', required: true, span: 2, placeholder: 'Thùng 24 hộp × 180 ml' },
        { key: 'basePrice', label: 'Giá bán / thùng (đ)', type: 'number', required: true, validate: (v) => (Number(v) <= 0 ? 'Giá phải lớn hơn 0.' : undefined) },
        { key: 'unitCost', label: 'Giá vốn / thùng (đ)', type: 'number' },
        { key: 'shelfLifeDays', label: 'Tổng hạn dùng (ngày)', type: 'number', required: true, validate: (v) => (Number(v) <= 0 ? 'Phải lớn hơn 0.' : undefined) },
        { key: 'nearExpiryDays', label: 'Cận hạn khi còn (ngày)', type: 'number', required: true, validate: (v, all) => (Number(v) >= Number(all.shelfLifeDays) ? 'Phải nhỏ hơn tổng hạn dùng.' : undefined) },
        { key: 'defaultMlor', label: 'm mặc định (0–1)', type: 'number', required: true, hint: 'MLOR = m × hạn dùng', validate: (v) => (Number(v) <= 0 || Number(v) >= 1 ? 'm phải nằm trong (0, 1).' : undefined) },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { name: v.name, categoryCode: v.categoryCode, packSpec: v.packSpec, basePrice: Number(v.basePrice), unitCost: Number(v.unitCost) || 0, shelfLifeDays: Number(v.shelfLifeDays), nearExpiryDays: Number(v.nearExpiryDays), defaultMlor: Number(v.defaultMlor) };
        await (edit ? update.mutateAsync({ ...input, sku: product!.sku }) : create.mutateAsync(input));
        onClose();
      }}
    />
  );
}
