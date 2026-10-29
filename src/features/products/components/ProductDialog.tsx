import { useRef } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';

import {
  Button,
  FormDialog,
  Modal,
  QueryState,
} from '@/shared/ui';

import {
  useCategoryOptions,
  useCreateProduct,
  useUpdateProduct,
} from '../hooks';

import {
  dayError,
  daysToHours,
  numberValue,
  priceError,
  priceText,
  productFormError,
  skuError,
} from '../utils';

import type { Product } from '../types';

interface Props {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
}

export function ProductDialog({
  open,
  product,
  onClose,
}: Props) {
  const { user } = useAuth();
  const categories = useCategoryOptions(open);
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const submitting = useRef(false);

  const close = () => {
    if (!submitting.current) onClose();
  };

  if (!open) return null;

  if (
    !can(user, 'products.manage') ||
    (product && product.status !== 'Draft')
  ) {
    return (
      <Modal
        open
        title="Không thể chỉnh sửa"
        onClose={close}
      >
        Chỉ tài khoản có quyền quản lý mới được
        tạo/sửa sản phẩm Nháp.
      </Modal>
    );
  }

  if (
    categories.isLoading ||
    categories.error ||
    !categories.data
  ) {
    return (
      <Modal
        open
        title="Danh mục sản phẩm"
        onClose={close}
      >
        <QueryState query={categories}>
          {() => null}
        </QueryState>

        {categories.error && (
          <Button
            onClick={() =>
              void categories.refetch()
            }
          >
            Thử lại
          </Button>
        )}
      </Modal>
    );
  }

  const active = categories.data.filter(
    (c) => c.isActive,
  );

  const options = categories.data.filter(
    (c) =>
      c.isActive ||
      c.id === product?.productCategoryId,
  );

  if (!active.length) {
    return (
      <Modal
        open
        title="Chưa có danh mục hoạt động"
        onClose={close}
      >
        Cần có danh mục hoạt động để lưu sản phẩm.
      </Modal>
    );
  }

  return (
    <FormDialog
      key={product?.id ?? 'create'}
      open
      width={760}
      columns={2}
      title={
        product
          ? 'Sửa bản nháp ' + product.sku
          : 'Thêm sản phẩm (bản nháp)'
      }
      submitLabel={
        product ? 'Lưu nháp' : 'Tạo bản nháp'
      }
      onClose={close}
      initial={
        product
          ? {
              sku: product.sku,
              productCategoryId:
                product.productCategoryId,
              name: product.name,
              unit: product.unit,
              shelfLifeDays:
                product.shelfLifeHours / 24,
              nearDateDays:
                product.nearDateThresholdHours / 24,
            }
          : {
              sku: '',
              productCategoryId: active[0].id,
              name: '',
              unit: 'Thùng',
              shelfLifeDays: '',
              nearDateDays: '',
              initialUnitPrice: '',
            }
      }
      fields={[
        {
          key: 'sku',
          label: 'SKU',
          required: true,
          readOnly: Boolean(product),
          placeholder: 'SKU001',
          validate: skuError,
        },
        {
          key: 'productCategoryId',
          label: 'Danh mục',
          type: 'select',
          required: true,
          options: options.map((c) => ({
            value: c.id,
            label:
              c.code +
              ' · ' +
              c.name +
              (
                c.isActive
                  ? ''
                  : ' (ngừng hoạt động)'
              ),
            disabled: !c.isActive,
          })),
          validate: (value) =>
            active.some((c) => c.id === value)
              ? undefined
              : 'Hãy chọn danh mục đang hoạt động.',
        },
        {
          key: 'name',
          label: 'Tên sản phẩm',
          required: true,
          span: 2,
          validate: (value) =>
            String(value).trim().length > 200
              ? 'Tối đa 200 ký tự.'
              : undefined,
        },
        {
          key: 'unit',
          label: 'Đơn vị bán',
          required: true,
          validate: (value) =>
            String(value).trim().length > 50
              ? 'Tối đa 50 ký tự.'
              : undefined,
        },
        ...(
          product
            ? [
                {
                  key: 'currentPrice',
                  label: 'Giá hiện tại / đơn vị',
                  type: 'info' as const,
                  info: () =>
                    priceText(
                      product.currentUnitPrice,
                    ),
                },
              ]
            : [
                {
                  key: 'initialUnitPrice',
                  label:
                    'Giá bán ban đầu / đơn vị (đ)',
                  type: 'number' as const,
                  required: true,
                  validate: priceError,
                },
              ]
        ),
        {
          key: 'shelfLifeDays',
          label: 'Tổng hạn dùng (ngày)',
          type: 'number',
          required: true,
          hint:
            'Có thể nhập số lẻ, ví dụ 1,5 ngày = 36 giờ.',
          validate: (value) => dayError(value),
        },
        {
          key: 'nearDateDays',
          label: 'Cận hạn khi còn (ngày)',
          type: 'number',
          required: true,
          validate: (value, values) =>
            dayError(value, true) ||
            (
              numberValue(value) >=
              numberValue(values.shelfLifeDays)
                ? 'Phải nhỏ hơn tổng hạn dùng.'
                : undefined
            ),
        },
      ]}
      note={
        product
          ? 'SKU giữ cố định. Để đổi giá, đóng form và chọn Cập nhật giá.'
          : 'Sản phẩm mới ở trạng thái Nháp. Sau khi đăng bán, thông tin được khóa.'
      }
      onSubmit={async (values) => {
        if (submitting.current) return;
        submitting.current = true;

        try {
          const input = {
            productCategoryId: String(
              values.productCategoryId,
            ),
            name: String(values.name).trim(),
            unit: String(values.unit).trim(),
            shelfLifeHours: daysToHours(
              values.shelfLifeDays,
            ),
            nearDateThresholdHours: daysToHours(
              values.nearDateDays,
            ),
          };

          if (product) {
            await update.mutateAsync({
              id: product.id,
              ...input,
            });
          } else {
            await create.mutateAsync({
              ...input,
              sku: String(values.sku)
                .trim()
                .toUpperCase(),
              initialUnitPrice: numberValue(
                values.initialUnitPrice,
              ),
            });
          }

          onClose();
        } catch (error) {
          throw productFormError(error);
        } finally {
          submitting.current = false;
        }
      }}
    />
  );
}