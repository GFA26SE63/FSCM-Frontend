import { useRef, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';

import {
  Button,
  ConfirmDialog,
  FormDialog,
} from '@/shared/ui';

import {
  useCloneProduct,
  useDeleteProduct,
  useInactivateProduct,
  usePublishProduct,
  useSetProductPrice,
} from '../hooks';

import {
  numberValue,
  priceError,
  priceText,
  skuError,
} from '../utils';

import type { Product } from '../types';

type Action = 'publish' | 'inactivate' | 'delete';

const copy = {
  publish: {
    title: 'Đăng bán sản phẩm',
    message:
      'Sau khi đăng bán, thông tin bị khóa. Sản phẩm cần có giá và thuộc danh mục hoạt động.',
    label: 'Publish',
    danger: false,
  },
  inactivate: {
    title: 'Ngừng bán sản phẩm',
    message:
      'Chuyển sang Inactive. Sản phẩm không còn dùng cho đơn mới.',
    label: 'Inactive',
    danger: true,
  },
  delete: {
    title: 'Xóa bản nháp',
    message:
      'Xóa bản nháp này? Thao tác không thể hoàn tác.',
    label: 'Xóa',
    danger: true,
  },
} as const;

interface Props {
  p: Product;
  onEdit?: () => void;
  size?: 'sm' | 'md';
  onDeleted?: () => void;
}

export function ProductActions({
  p,
  onEdit,
  size = 'sm',
  onDeleted,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const publish = usePublishProduct();
  const inactivate = useInactivateProduct();
  const remove = useDeleteProduct();
  const setPrice = useSetProductPrice();
  const clone = useCloneProduct();

  const submitting = useRef(false);

  const [action, setAction] =
    useState<Action | null>(null);

  const [form, setForm] =
    useState<'price' | 'clone' | null>(null);

  const [failure, setFailure] =
    useState<string | null>(null);

  const busy =
    publish.isPending ||
    inactivate.isPending ||
    remove.isPending ||
    setPrice.isPending ||
    clone.isPending;

  if (!can(user, 'products.manage')) {
    return null;
  }

  const close = () => {
    if (submitting.current) return;

    setAction(null);
    setForm(null);
    setFailure(null);
  };

  const choose = (next: Action) => {
    setFailure(null);
    setAction(next);
  };

  const confirm = async () => {
    if (!action || submitting.current) return;

    submitting.current = true;
    setFailure(null);

    try {
      if (action === 'publish') {
        await publish.mutateAsync(p.id);
      } else if (action === 'inactivate') {
        await inactivate.mutateAsync(p.id);
      } else {
        await remove.mutateAsync(p.id);
      }

      setAction(null);

      if (action === 'delete') {
        onDeleted?.();
      }
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      submitting.current = false;
    }
  };

  return (
    <>
      {p.status === 'Draft' && (
        <>
          {onEdit && (
            <Button
              size={size}
              disabled={busy}
              onClick={onEdit}
            >
              Sửa
            </Button>
          )}

          <Button
            size={size}
            variant="primary"
            disabled={busy}
            onClick={() => choose('publish')}
          >
            Publish
          </Button>

          <Button
            size={size}
            variant="danger"
            disabled={busy}
            onClick={() => choose('delete')}
          >
            Xóa
          </Button>
        </>
      )}

      {p.status !== 'Inactive' && (
        <Button
          size={size}
          disabled={busy}
          onClick={() => setForm('price')}
        >
          Cập nhật giá
        </Button>
      )}

      {p.status !== 'Draft' && (
        <Button
          size={size}
          disabled={busy}
          onClick={() => setForm('clone')}
        >
          Tạo bản mới
        </Button>
      )}

      {p.status === 'Published' && (
        <Button
          size={size}
          variant="danger"
          disabled={busy}
          onClick={() => choose('inactivate')}
        >
          Inactive
        </Button>
      )}

      {action && (
        <ConfirmDialog
          open
          title={
            copy[action].title + ' · ' + p.sku
          }
          confirmLabel={copy[action].label}
          danger={copy[action].danger}
          onClose={close}
          onConfirm={confirm}
          message={
            <>
              <p>{copy[action].message}</p>

              {failure && (
                <div
                  className="callout callout-danger"
                  role="alert"
                >
                  {failure}
                </div>
              )}
            </>
          }
        />
      )}

      {form && (
        <FormDialog
          key={p.id + '-' + form}
          open
          columns={1}
          title={
            form === 'price'
              ? 'Cập nhật giá · ' + p.sku
              : 'Tạo bản mới từ ' + p.sku
          }
          submitLabel={
            form === 'price'
              ? 'Lưu giá'
              : 'Tạo bản nháp'
          }
          onClose={close}
          initial={
            form === 'price'
              ? {
                  unitPrice:
                    p.currentUnitPrice ?? '',
                }
              : { sku: '' }
          }
          fields={
            form === 'price'
              ? [
                  {
                    key: 'unitPrice',
                    label:
                      'Giá mới / ' +
                      p.unit +
                      ' (đ)',
                    type: 'number',
                    required: true,
                    validate: (value) =>
                      priceError(value) ||
                      (
                        numberValue(value) ===
                        p.currentUnitPrice
                          ? 'Giá mới phải khác giá hiện tại.'
                          : undefined
                      ),
                  },
                ]
              : [
                  {
                    key: 'sku',
                    label: 'SKU mới',
                    required: true,
                    placeholder: 'SKU002',
                    validate: (value) =>
                      skuError(value) ||
                      (
                        String(value)
                          .trim()
                          .toUpperCase() === p.sku
                          ? 'SKU mới phải khác SKU nguồn.'
                          : undefined
                      ),
                  },
                ]
          }
          note={
            form === 'price'
              ? 'Giá hiện tại: ' +
                priceText(p.currentUnitPrice) +
                '. Lưu giá riêng với thông tin sản phẩm.'
              : 'Tạo bản nháp độc lập; không sao chép tồn kho và không tự ngừng bán sản phẩm nguồn. Bạn có thể chỉnh sửa bản nháp sau khi tạo.'
          }
          onSubmit={async (values) => {
            if (submitting.current) return;
            submitting.current = true;

            try {
              if (form === 'price') {
                await setPrice.mutateAsync({
                  id: p.id,
                  unitPrice: numberValue(
                    values.unitPrice,
                  ),
                });

                setForm(null);
              } else {
                const created =
                  await clone.mutateAsync({
                    id: p.id,
                    sku: String(values.sku)
                      .trim()
                      .toUpperCase(),
                  });

                setForm(null);
                navigate('/skus/' + created.id);
              }
            } finally {
              submitting.current = false;
            }
          }}
        />
      )}
    </>
  );
}