import { useNavigate } from '@/shared/router/compat';
import {
  Button,
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
      header: 'Sales',
      text: (row) => row.salesUserName,
      render: (row) => <strong>{row.salesUserName}</strong>,
    },
    {
      key: 'group',
      header: 'Nhóm Sales',
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
      title="Xếp hạng Sales"
      rows={rows}
      columns={columns}
      rowKey={(row) => `${row.salesUserId}:${row.salesGroupId}`}
      searchPlaceholder="Tên Sales, mã hoặc tên nhóm…"
      onRowClick={openDetail}
      rowActionsWidth="90px"
      rowActions={(row) => (
        <Button size="sm" onClick={() => openDetail(row)}>
          Xem
        </Button>
      )}
      emptyText="Không có dữ liệu Sales được ghi nhận trong kỳ và phạm vi này."
    />
  );
}