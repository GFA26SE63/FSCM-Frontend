import { useNavigate } from '@/shared/router/compat';
import {
  DataTable,
  type Column,
} from '@/shared/ui';
import { formatMoney } from '@/shared/lib';

import { reportSearch } from '../filters';
import type {
  ReportFilters,
  SalesRankingEntry,
} from '../types';

interface Props {
  rows: SalesRankingEntry[];
  filters: ReportFilters;
}

export function SalesRankingTable({ rows, filters }: Props) {
  const navigate = useNavigate();

  function openDetail(row: SalesRankingEntry) {
    navigate(
      `/kpi/sales/${row.salesUserId}/${row.salesGroupId}` +
      reportSearch(filters, 'sales'),
    );
  }

  const columns: Column<SalesRankingEntry>[] = [
    {
      key: 'rank',
      header: 'Hạng',
      width: '70px',
      align: 'right',
    },
    {
      key: 'salesUserName',
      header: 'Nhân viên bán hàng',
      text: (row) => row.salesUserName,
      render: (row) => <strong>{row.salesUserName}</strong>,
    },
    {
      key: 'group',
      header: 'Nhóm bán hàng',
      text: (row) =>
        `${row.salesGroupCode} · ${row.salesGroupName}`,
    },
    {
      key: 'orderCount',
      header: 'Số đơn ghi nhận',
      align: 'right',
    },
    {
      key: 'recognizedRevenue',
      header: 'Doanh thu ghi nhận',
      align: 'right',
      text: (row) => formatMoney(row.recognizedRevenue),
    },
  ];

  return (
    <DataTable
      stateKey="sales"
      title="Xếp hạng nhân viên bán hàng"
      rows={rows}
      columns={columns}
      rowKey={(row) => `${row.salesUserId}:${row.salesGroupId}`}
      searchPlaceholder="Tên nhân viên bán hàng, mã hoặc tên nhóm…"
      onRowClick={openDetail}
      emptyText="Không có dữ liệu nhân viên bán hàng được ghi nhận trong kỳ và phạm vi này."
    />
  );
}