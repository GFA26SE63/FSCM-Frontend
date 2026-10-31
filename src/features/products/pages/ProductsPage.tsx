import { Can } from '@/shared/auth/Can';
import { useNavigate } from '@/shared/router/compat';

import {
  Button,
  DataTable,

  PageHeader,

  StatusChip,
  type Column,
} from '@/shared/ui';

import { statusLabels } from '@/shared/lib';
import { useProducts } from '../hooks';
import { ProductActions } from '../components/ProductActions';

import { lifeText, priceText } from '../utils';

import type { Product } from '../types';

export function ProductsPage() {
  const navigate = useNavigate();
  const query = useProducts();

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
        subtitle="Nháp → Đăng bán → Ngừng bán. Thông tin và giá được khóa sau khi đăng bán. Muốn chỉnh sửa, hãy tạo bản mới."
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
                navigate('/skus/new')
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
            />
          </>
        )}
      />
    </>
  );
}
