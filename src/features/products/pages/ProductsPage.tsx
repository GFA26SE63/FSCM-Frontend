import { useState } from 'react';
import { Can } from '@/shared/auth/Can';
import { useNavigate } from '@/shared/router/compat';

import {
  Button,
  DataTable,
  Modal,
  PageHeader,
  QueryState,
  StatusChip,
  type Column,
} from '@/shared/ui';

import { statusLabels } from '@/shared/lib';
import { useProduct, useProducts } from '../hooks';
import { ProductActions } from '../components/ProductActions';
import { ProductDialog } from '../components/ProductDialog';
import { lifeText, priceText } from '../utils';

import type { Product } from '../types';

export function ProductsPage() {
  const navigate = useNavigate();
  const query = useProducts();

  const [editing, setEditing] = useState<{
    id: string | null;
  } | null>(null);

  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '95px',
      render: (p) => (
        <span className="bold">{p.sku}</span>
      ),
    },
    {
      key: 'name',
      header: 'Tên sản phẩm',
    },
    {
      key: 'categoryName',
      header: 'Danh mục',
      width: '150px',
    },
    {
      key: 'unit',
      header: 'Đơn vị',
      width: '85px',
    },
    {
      key: 'price',
      header: 'Giá / đơn vị',
      width: '130px',
      align: 'right',
      text: (p) => priceText(p.currentUnitPrice),
    },
    {
      key: 'life',
      header: 'Hạn dùng',
      width: '130px',
      text: (p) => lifeText(p.shelfLifeHours),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      text: (p) => statusLabels.product[p.status],
      render: (p) => (
        <StatusChip
          domain="product"
          value={p.status}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sản phẩm (SKU)"
        subtitle="Nháp → Đăng bán → Ngừng bán. Thông tin được khóa sau khi đăng bán; giá được quản lý riêng."
      />

      {query.error && (
        <Button
          onClick={() => void query.refetch()}
        >
          Thử tải lại
        </Button>
      )}

      <DataTable
        title="Danh sách sản phẩm"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(p) => p.id}
        columns={columns}
        searchPlaceholder="SKU, tên, danh mục…"
        filters={[
          {
            label: 'Trạng thái',
            options: Object.values(
              statusLabels.product,
            ),
            value: (p) =>
              statusLabels.product[p.status],
          },
          {
            label: 'Danh mục',
            options: [
              ...new Set(
                (query.data ?? []).map(
                  (p) => p.categoryName,
                ),
              ),
            ],
            value: (p) => p.categoryName,
          },
        ]}
        actions={
          <Can permission="products.manage">
            <Button
              variant="primary"
              onClick={() =>
                setEditing({ id: null })
              }
            >
              + Thêm sản phẩm
            </Button>
          </Can>
        }
        onRowClick={(p) =>
          navigate('/skus/' + p.id)
        }
        rowActionsWidth="410px"
        rowActions={(p) => (
          <>
            <Button
              size="sm"
              onClick={() =>
                navigate('/skus/' + p.id)
              }
            >
              Xem
            </Button>

            <ProductActions
              p={p}
              onEdit={() =>
                setEditing({ id: p.id })
              }
            />
          </>
        )}
      />

      {editing && (
        <EditHost
          id={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditHost({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const query = useProduct(id ?? '');

  if (!id) {
    return (
      <ProductDialog
        open
        onClose={onClose}
      />
    );
  }

  if (
    query.isLoading ||
    query.error ||
    !query.data
  ) {
    return (
      <Modal
        open
        title="Tải sản phẩm"
        onClose={onClose}
      >
        <QueryState query={query}>
          {() => null}
        </QueryState>

        {query.error && (
          <Button
            onClick={() =>
              void query.refetch()
            }
          >
            Thử lại
          </Button>
        )}
      </Modal>
    );
  }

  return (
    <ProductDialog
      open
      product={query.data}
      onClose={onClose}
    />
  );
}