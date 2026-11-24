import { useMemo, useState } from 'react';

import { useNavigate } from '@/shared/router/compat';
import { useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { errorMessage } from '@/shared/api/errors';
import {
  Button,
  Callout,
  DataTable,
  PageHeader,
  Select,
  Tabs,
  type Column,
} from '@/shared/ui';

import {
  useFleetCount,
  useFleetPage,
  useFleetWarehouses,
} from '../hooks';
import {
  FLEET_PAGE_SIZES,
  FLEET_SORTABLE_FIELDS,
  type FleetActivity,
  type FleetKind,
  type FleetPageSize,
} from '../fleetGraphql';
import {
  activeText,
  warehouseText,
  type Driver,
  type FleetStatusTarget,
  type Vehicle,
} from '../types';
import { VehicleDialog } from '../components/VehicleDialog';
import { DriverDialog } from '../components/DriverDialog';
import { FleetStatusDialog } from '../components/FleetStatusDialog';

const FLEET_TABS = ['vehicles', 'drivers'] as const;

export function FleetPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const allowed = can(user, 'fleet.manage');

  const warehouses = useFleetWarehouses();

  // Switching tabs must drop the other tab's cursor, sort, search and filters.
  const [tab, setTab] = useEnumParam('tab', FLEET_TABS, 'vehicles', {
    resets: [...PAGINATION_RESETS, PAGINATION_PARAM_NAMES.SORT, PAGINATION_PARAM_NAMES.SEARCH, 'status', 'wh'],
  });
  const kind: FleetKind = tab;
  const { params } = useQueryParams();
  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), FLEET_PAGE_SIZES, 20) as FleetPageSize;
  const search = params.get('q') ?? undefined;
  const [activity, setActivity] = useEnumParam<FleetActivity | 'active' | 'inactive'>(
    'status', ['', 'active', 'inactive'] as const, '', { resets: PAGINATION_RESETS },
  );
  const [warehouseId, setWarehouseId] = useStringParam('wh', { resets: PAGINATION_RESETS });
  const sortable = FLEET_SORTABLE_FIELDS[kind];
  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && sortable.includes(rawSort.field)
    ? { field: rawSort.field, direction: rawSort.direction }
    : undefined;

  const searchWarehouseIds = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return (warehouses.data ?? [])
      .filter((w) => w.name?.toLowerCase().includes(q) || w.code?.toLowerCase().includes(q))
      .map((w) => w.id);
  }, [warehouses.data, search]);

  const listQuery = {
    kind,
    size: pageSize,
    after,
    before,
    activity,
    warehouseId: warehouseId || undefined,
    search,
    searchWarehouseIds: search ? searchWarehouseIds : undefined,
    sort: activeSort,
  };
  // Only the visible tab is fetched.
  const current = useFleetPage<Vehicle | Driver>(listQuery);
  const loading = current.isLoading || current.isPlaceholderData;
  const listError = current.isPlaceholderData ? undefined : current.error;
  const vehicleCount = useFleetCount('vehicles');
  const driverCount = useFleetCount('drivers');
  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: current.data?.pageInfo,
    totalCount: current.data?.totalCount,
    loading: current.isLoading || current.isFetching,
    error: current.isPlaceholderData ? undefined : current.error,
    defaultPageSize: 20,
    pageSizeOptions: FLEET_PAGE_SIZES,
    urlState: true,
  });
  const filterExtra = (
    <>
      <label className="lbl">
        Trạng thái
        <Select
          value={activity}
          onChange={(e) => setActivity(e.target.value as FleetActivity)}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'active', label: 'Hoạt động' },
            { value: 'inactive', label: 'Ngừng hoạt động' },
          ]}
        />
      </label>
      <label className="lbl">
        Kho
        <Select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          options={[
            { value: '', label: 'Tất cả' },
            ...(warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name })),
          ]}
        />
      </label>
    </>
  );
  const [vehicleDialog, setVehicleDialog] =
    useState<{ item: Vehicle | null } | null>(null);
  const [driverDialog, setDriverDialog] =
    useState<{ item: Driver | null } | null>(null);
  const [statusTarget, setStatusTarget] =
    useState<FleetStatusTarget | null>(null);

  const warehouseLabel = (id: string) =>
    warehouseText(warehouses.data, id);

  const vehicleColumns: Column<Vehicle>[] = [
    {
      key: 'plateNumber',
      sortable: true,
      header: 'Biển số',
      text: (item) => item.plateNumber,
      render: (item) => <strong>{item.plateNumber}</strong>,
    },
    { key: 'vehicleType', header: 'Loại xe', sortable: true },
    {
      key: 'capacity',
      sortable: true,
      header: 'Sức chứa',
      align: 'right',
      text: (item) => `${item.capacity.toLocaleString('vi-VN')} thùng`,
    },
    {
      key: 'warehouse',
      header: 'Kho quản lý',
      text: (item) => warehouseLabel(item.warehouseId),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      text: (item) => activeText(item.isActive),
    },
  ];

  const driverColumns: Column<Driver>[] = [
    { key: 'code', header: 'Mã tài xế', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'phone', header: 'Điện thoại', sortable: true },
    { key: 'licenseNumber', header: 'Số GPLX', sortable: true },
    {
      key: 'warehouse',
      header: 'Kho quản lý',
      text: (item) => warehouseLabel(item.warehouseId),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      text: (item) => activeText(item.isActive),
    },
  ];

  if (!allowed) {
    return <Callout tone="danger">Bạn không có quyền quản lý xe và tài xế.</Callout>;
  }

  return (
    <>
      <PageHeader
        title="Xe & tài xế"
        subtitle="Quản lý danh mục xe và nhân sự giao hàng theo kho."
      />

      {warehouses.error && (
        <Callout tone="danger">
          Không tải được tên kho: {errorMessage(warehouses.error)}.{' '}
          <Button size="sm" onClick={() => void warehouses.refetch()}>
            Thử lại
          </Button>
        </Callout>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'vehicles',
            label: 'Xe giao hàng',
            count: vehicleCount.data,
          },
          {
            key: 'drivers',
            label: 'Tài xế',
            count: driverCount.data,
          },
        ]}
      />

      {tab === 'vehicles' ? (
        <DataTable
          key="vehicles"
          title="Danh sách xe"
          rows={current.data?.rows as Vehicle[] | undefined}
          loading={loading}
          error={listError}
          rowKey={(item) => item.id}
          columns={vehicleColumns}
          summaryColumns={['plateNumber', 'vehicleType', 'capacity', 'warehouse', 'status']}
          searchPlaceholder="Biển số, loại xe, kho…"
          cursor={pagingProps}
          serverSort={{ ...sortProps, sortableFields: sortable }}
          filterExtra={filterExtra}
          actions={
            <>
              <Button onClick={() => void current.refetch()}>
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => setVehicleDialog({ item: null })}
              >
                + Thêm xe
              </Button>
            </>
          }
          onRowClick={(item) => navigate(`/fleet/vehicles/${item.id}`)}
          rowActionsWidth="300px"
          rowActions={(item) => (
            <>
              <Button
                size="sm"
                onClick={() => navigate(`/fleet/vehicles/${item.id}`)}
              >
                Xem
              </Button>
              <Button
                size="sm"
                onClick={() => setVehicleDialog({ item })}
              >
                Sửa
              </Button>
              <Button
                size="sm"
                onClick={() => setStatusTarget({ kind: 'vehicle', item })}
              >
                {item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
              </Button>
            </>
          )}
        />
      ) : (
        <DataTable
          key="drivers"
          title="Danh sách tài xế"
          rows={current.data?.rows as Driver[] | undefined}
          loading={loading}
          error={listError}
          rowKey={(item) => item.id}
          columns={driverColumns}
          summaryColumns={['code', 'fullName', 'phone', 'warehouse', 'status']}
          searchPlaceholder="Mã, họ tên, điện thoại, số GPLX, kho…"
          cursor={pagingProps}
          serverSort={{ ...sortProps, sortableFields: sortable }}
          filterExtra={filterExtra}
          actions={
            <>
              <Button onClick={() => void current.refetch()}>
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => setDriverDialog({ item: null })}
              >
                + Thêm tài xế
              </Button>
            </>
          }
          onRowClick={(item) => navigate(`/fleet/drivers/${item.id}`)}
          rowActionsWidth="300px"
          rowActions={(item) => (
            <>
              <Button
                size="sm"
                onClick={() => navigate(`/fleet/drivers/${item.id}`)}
              >
                Xem
              </Button>
              <Button
                size="sm"
                onClick={() => setDriverDialog({ item })}
              >
                Sửa
              </Button>
              <Button
                size="sm"
                onClick={() => setStatusTarget({ kind: 'driver', item })}
              >
                {item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
              </Button>
            </>
          )}
        />
      )}

      {vehicleDialog && (
        <VehicleDialog
          key={vehicleDialog.item?.id ?? 'new-vehicle'}
          vehicle={vehicleDialog.item}
          onClose={() => setVehicleDialog(null)}
        />
      )}

      {driverDialog && (
        <DriverDialog
          key={driverDialog.item?.id ?? 'new-driver'}
          driver={driverDialog.item}
          onClose={() => setDriverDialog(null)}
        />
      )}

      {statusTarget && (
        <FleetStatusDialog
          key={`${statusTarget.kind}:${statusTarget.item.id}`}
          target={statusTarget}
          onClose={() => setStatusTarget(null)}
        />
      )}
    </>
  );
}
