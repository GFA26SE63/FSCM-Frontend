import { useQuery } from '@tanstack/react-query';
import { Can } from '@/shared/auth/Can';
import { useNavigate } from '@/shared/router/compat';
import { useEnumParam, useStringParam } from '@/shared/router/listState';
import { useRestPagination, paginationQueryKeys } from '@/shared/pagination';
import {
  Button,
  DataTable,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { statusLabels } from '@/shared/lib';
import { productApi } from '../api';
import { useCategoryOptions } from '../hooks';
import { ProductActions } from '../components/ProductActions';
import { lifeText, priceText } from '../utils';
import type { Product } from '../types';

const STATUS_VALUES = ['', 'Draft', 'Published', 'Inactive'] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

const STATUS_FILTER_OPTIONS = [
  { label: 'Tất cả', value: '' },
  { label: statusLabels.product['Draft'], value: 'Draft' },
  { label: statusLabels.product['Published'], value: 'Published' },
  { label: statusLabels.product['Inactive'], value: 'Inactive' },
];

export function ProductsPage() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useEnumParam<StatusValue>(
    'status',
    STATUS_VALUES,
    '',
    { resets: ['page'] },
  );

  const [categoryFilter, setCategoryFilter] = useStringParam('category', { resets: ['page'] });

  const { page, pageSize, search, pagingProps: basePagingProps } = useRestPagination({
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    urlState: true,
  });

  const query = useQuery({
    queryKey: paginationQueryKeys.restPage('products', {
      page,
      size: pageSize,
      search,
      filters: { status: statusFilter, categoryId: categoryFilter },
    }),
    queryFn: () =>
      productApi.listPage({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const categoriesQuery = useCategoryOptions();

  const categoryOptions = [
    { label: 'Tất cả danh mục', value: '' },
    ...(categoriesQuery.data ?? [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: `${c.code} · ${c.name}`, value: c.id })),
  ];

  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pagingProps = { ...basePagingProps, total: totalCount, totalPages };

  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '95px',
      render: (p) => <span className="bold">{p.sku}</span>,
    },
    {
      key: 'name',
      header: 'Tên sản phẩm',
      width: '260px',
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
      render: (p) => <StatusChip domain="product" value={p.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Sản phẩm (SKU)"
        subtitle="Nháp → Đăng bán → Ngừng bán. Thông tin và giá được khóa sau khi đăng bán. Muốn chỉnh sửa, hãy tạo bản mới."
      />

      {query.error && !query.isPlaceholderData && (
        <Button onClick={() => void query.refetch()}>Thử tải lại</Button>
      )}

      <DataTable
        title="Danh sách sản phẩm"
        rows={query.data?.items}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(p) => p.id}
        columns={columns}
        searchPlaceholder="SKU, tên, danh mục…"
        server={pagingProps}
        filterExtra={
          <>
            <label className="lbl">
              Trạng thái
              <Select
                value={statusFilter}
                options={STATUS_FILTER_OPTIONS}
                onChange={(e) => setStatusFilter(e.target.value as StatusValue)}
              />
            </label>
            <label className="lbl">
              Danh mục
              <Select
                value={categoryFilter}
                options={categoryOptions}
                onChange={(e) => setCategoryFilter(e.target.value)}
              />
            </label>
          </>
        }
        actions={
          <Can permission="products.manage">
            <Button variant="primary" onClick={() => navigate('/skus/new')}>
              + Thêm sản phẩm
            </Button>
          </Can>
        }
        onRowClick={(p) => navigate('/skus/' + p.id)}
        rowActionsWidth="410px"
        rowActions={(p) => (
          <>
            <Button size="sm" onClick={() => navigate('/skus/' + p.id)}>
              Xem
            </Button>
            <ProductActions p={p} />
          </>
        )}
      />
    </>
  );
}
