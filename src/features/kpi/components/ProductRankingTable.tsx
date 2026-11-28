import { DataTable, type Column } from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';

import { quantityUnitText } from '../filters';
import type { ProductRankingEntry } from '../types';

interface Props {
  rows: ProductRankingEntry[];
  quantityUnit: string;
}

export function ProductRankingTable({
  rows,
  quantityUnit,
}: Props) {
  const columns: Column<ProductRankingEntry>[] = [
    {
      key: 'rank',
      header: 'Hạng',
      width: '70px',
      align: 'right',
    },
    { key: 'sku', header: 'SKU', width: '120px' },
    { key: 'productName', header: 'Sản phẩm' },
    {
      key: 'categoryName',
      header: 'Ngành hàng',
      text: (row) => row.categoryName || '—',
    },
    {
      key: 'orderCount',
      header: 'Số đơn',
      align: 'right',
      text: (row) => (row.orderCount != null && row.orderCount > 0 ? formatNumber(row.orderCount) : '—'),
    },
    {
      key: 'normalizedSoldQuantity',
      header: `Số lượng (${quantityUnitText(quantityUnit)})`,
      align: 'right',
      text: (row) => formatNumber(row.normalizedSoldQuantity, 3),
    },
    {
      key: 'grossRevenue',
      header: 'Trước giảm',
      align: 'right',
      text: (row) => (row.grossRevenue != null && row.grossRevenue > 0 ? formatMoney(row.grossRevenue) : '—'),
    },
    {
      key: 'adjustedNetRevenue',
      header: 'Doanh thu thuần điều chỉnh',
      align: 'right',
      text: (row) => formatMoney(row.adjustedNetRevenue),
    },
  ];

  return (
    <DataTable
      stateKey="products"
      title="Sản phẩm bán chạy"
      rows={rows}
      columns={columns}
      rowKey={(row) => row.productId}
      searchPlaceholder="SKU, tên sản phẩm…"
      emptyText="Không có sản phẩm được ghi nhận trong kỳ và phạm vi này."
    />
  );
}