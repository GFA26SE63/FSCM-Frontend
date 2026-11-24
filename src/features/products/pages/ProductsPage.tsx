import { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { useNavigate } from '@/shared/router/compat';
import { useEnumParam, useStringParam, useQueryParams } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import {
  Button,
  DataTable,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { statusLabels } from '@/shared/lib';
import { useCategoryOptions, useProductsPage, useProductPricesForPage } from '../hooks';
import { ProductActions } from '../components/ProductActions';
import { lifeText, priceText } from '../utils';
import { PRODUCTS_PAGE_SIZES, PRODUCTS_SORT_MAP, PRODUCTS_SORTABLE_FIELDS, type ProductPageSize, type ProductSortField } from '../productsGraphql';
import type { Product } from '../types';

const STATUS_VALUES = ['', 'Draft', 'Published', 'Inactive'] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

const STATUS_FILTER_OPTIONS = [
  { label: 'Tất cả', value: '' },
  { label: statusLabels.product['Draft'], value: 'Draft' },
  { label: statusLabels.product['Published'], value: 'Published' },
  { label: statusLabels.product['Inactive'], value: 'Inactive' },
];

const SIZE_VALUES = PRODUCTS_PAGE_SIZES.map(String) as `${ProductPageSize}`[];
const PAGE_RESETS = PAGINATION_RESETS;

export function ProductsPage() {
  const navigate = useNavigate();
  const { params } = useQueryParams();

  // Read cursor params directly from URL
  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), PRODUCTS_PAGE_SIZES, 20) as ProductPageSize;
  const search = params.get('q') ?? undefined;

  // Wire size selector to URL; resets cursors when changed
  useEnumParam<`${ProductPageSize}`>('size', SIZE_VALUES, '20', { resets: PAGE_RESETS });

  const [statusFilter, setStatusFilter] = useEnumParam<StatusValue>(
    'status',
    STATUS_VALUES,
    '',
    { resets: PAGE_RESETS },
  );

  const [categoryFilter, setCategoryFilter] = useStringParam('category', { resets: PAGE_RESETS });

  // Read sort from URL synchronously before the query
  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && PRODUCTS_SORT_MAP[rawSort.field as ProductSortField]
    ? { field: rawSort.field as ProductSortField, direction: rawSort.direction }
    : undefined;

  const categoriesQuery = useCategoryOptions();

  const query = useProductsPage({
    size: pageSize,
    after,
    before,
    status: statusFilter || undefined,
    categoryId: categoryFilter || undefined,
    search: search || undefined,
    sort: activeSort,
  });

  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: PRODUCTS_PAGE_SIZES,
    urlState: true,
  });

  // Collect product IDs for price batch fetch (stable reference — only changes when page changes)
  const pageProductIds = useMemo(
    () => (query.data?.rows ?? []).map((p) => p.id),
    [query.data?.rows],
  );
  const pricesQuery = useProductPricesForPage(pageProductIds);

  // Enrich rows: category names from cache, prices from entities.productPrices batch
  const rows = useMemo(() => {
    const cats = categoriesQuery.data ?? [];
    const prices = pricesQuery.data;
    return (query.data?.rows ?? []).map((p) => {
      const cat = (p.categoryCode && p.categoryName)
        ? undefined
        : cats.find((c) => c.id === p.productCategoryId);
      const price = prices?.get(p.id) ?? null;
      const enriched = {
        ...p,
        ...(cat ? { categoryCode: cat.code, categoryName: cat.name } : {}),
        currentUnitPrice: price,
      };
      return enriched;
    });
  }, [query.data?.rows, categoriesQuery.data, pricesQuery.data]);

  const categoryOptions = [
    { label: 'Tất cả danh mục', value: '' },
    ...(categoriesQuery.data ?? [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: `${c.code} · ${c.name}`, value: c.id })),
  ];

  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '95px',
      sortable: true,
      render: (p) => <span className="bold">{p.sku}</span>,
    },
    {
      key: 'name',
      header: 'Tên sản phẩm',
      width: '260px',
      sortable: true,
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
      render: (p) => <>{priceText(p.currentUnitPrice)}<div className="muted small">/ {p.unit}</div></>,
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
        rows={rows}
        loading={query.isLoading || query.isPlaceholderData || categoriesQuery.isLoading}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(p) => p.id}
        columns={columns}
        summaryColumns={['sku', 'name', 'categoryName', 'price', 'status']}
        searchPlaceholder="SKU, tên, danh mục…"
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: PRODUCTS_SORTABLE_FIELDS }}
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
        rowActionsWidth="150px"
        rowActions={(p) => (
          <div className="table-actions-inline">
            <Button size="sm" onClick={() => navigate('/skus/' + p.id)}>
              <Eye size={14} /> Xem
            </Button>
            <ProductActions p={p} dropdown />
          </div>
        )}
      />
    </>
  );
}
