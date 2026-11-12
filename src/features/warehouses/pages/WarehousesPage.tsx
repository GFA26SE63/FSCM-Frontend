import { useMemo, useState } from 'react';
import { Eye, MapPin, Pause, Pencil, Play } from 'lucide-react';
import { useLocation, useNavigate } from '@/shared/router/compat';
import { useEnumParam, useQueryParams } from '@/shared/router/listState';
import { useAuth } from '@/shared/auth/AuthContext';
import { statusLabels } from '@/shared/lib';
import {
  ActionDropdown,
  Button,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusChip,
  Tabs,
  TextArea,
  useToast,
  type ActionDropdownItem,
} from '@/shared/ui';
import { buildWarehouseMapDoc } from '../components/warehouseMap';
import { DeactivateWarehouseModal } from '../components/DeactivateWarehouseModal';
import {
  useCreateRegion,
  useRegions,
  useRetailerMapPoints,
  useUpdateWarehouseStatus,
  useWarehouses,
} from '../hooks';
import type { MapPoint, SortOrder, Warehouse, WarehouseRegion } from '../types';

const SORT_ORDERS: readonly SortOrder[] = ['desc', 'asc'];

export function WarehousesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const navigate = useNavigate();
  const toast = useToast();

  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tabParam = searchParams.get('tab');

  // tab=warehouses | all-whs (liên kết cũ) → danh sách kho; mặc định: vùng hoạt động.
  const activeTab: 'regions' | 'all-whs' = tabParam === 'warehouses' || tabParam === 'all-whs' ? 'all-whs' : 'regions';
  const { setParams } = useQueryParams();
  const setActiveTab = (tab: 'regions' | 'all-whs') => setParams({ tab: tab === 'all-whs' ? 'warehouses' : null });
  const [regionSortOrder, setRegionSortOrder] = useEnumParam<SortOrder>('regions.sort', SORT_ORDERS, 'desc');
  const [whSortOrder, setWhSortOrder] = useEnumParam<SortOrder>('warehouses.sort', SORT_ORDERS, 'desc');

  // Modal create region state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [regionDesc, setRegionDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Network map modal state
  const [netMapOpen, setNetMapOpen] = useState(false);
  const [mapRegionFilter, setMapRegionFilter] = useState<string>('all');
  const [mapWarehouseFilter, setMapWarehouseFilter] = useState<string>('all');

  // Queries & Mutations
  const regionsQuery = useRegions();
  const warehousesQuery = useWarehouses();
  const { data: retailers = [] } = useRetailerMapPoints(netMapOpen);
  const createRegion = useCreateRegion();
  const updateWarehouseStatus = useUpdateWarehouseStatus();

  const allWarehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const rawRegions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);

  // Map warehouse counts and region names
  const regionsWithCounts = useMemo<WarehouseRegion[]>(() => {
    return rawRegions.map((r) => {
      const count = allWarehouses.filter((w) => w.regionId === r.id).length;
      return {
        ...r,
        warehouseCount: count,
      };
    });
  }, [rawRegions, allWarehouses]);

  // Sort regions by createdAt (default DESC)
  const sortedRegions = useMemo(() => {
    return [...regionsWithCounts].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return regionSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [regionsWithCounts, regionSortOrder]);

  // Sort warehouses by createdAt (default DESC)
  const sortedWarehouses = useMemo(() => {
    return [...allWarehouses].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return whSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [allWarehouses, whSortOrder]);

  // Available warehouse options for map filter
  const mapWarehouseOptions = useMemo(() => {
    if (mapRegionFilter === 'all') return allWarehouses;
    return allWarehouses.filter((w) => w.regionId === mapRegionFilter);
  }, [allWarehouses, mapRegionFilter]);

  const refWh = useMemo(() => {
    if (mapWarehouseFilter !== 'all') {
      const matched = allWarehouses.find((w) => w.code === mapWarehouseFilter && w.lat);
      if (matched) return matched;
    }
    if (mapRegionFilter !== 'all') {
      const matchedInRegion = allWarehouses.find((w) => w.regionId === mapRegionFilter && w.lat);
      if (matchedInRegion) return matchedInRegion;
    }
    return allWarehouses.find((w) => w.code === 'WH-TA') ?? allWarehouses[0];
  }, [allWarehouses, mapRegionFilter, mapWarehouseFilter]);

  const netMapDoc = useMemo(() => {
    if (!netMapOpen) return '';
    const points: MapPoint[] = [
      ...allWarehouses.map((w) => {
        const reg = rawRegions.find((r) => r.id === w.regionId);
        return {
          lat: w.lat || 10.87,
          lng: w.lng || 106.65,
          kind: 'wh' as const,
          label: `${w.code} · ${w.name}`,
          sub: w.address,
          regionId: w.regionId,
          regionName: reg?.name,
        };
      }),
      ...retailers.map((r) => ({
        lat: r.lat || 10.87,
        lng: r.lng || 106.65,
        kind: 'ret' as const,
        label: r.name,
        sub: `${r.code} · ${r.address}`,
      })),
    ];
    return buildWarehouseMapDoc({
      center: refWh ? [refWh.lat || 10.8744, refWh.lng || 106.6511] : [10.8744, 106.6511],
      points,
      radiusKm: 20,
      zoom: 11,
      selectedRegionId: mapRegionFilter === 'all' ? null : mapRegionFilter,
      selectedWarehouseCode: mapWarehouseFilter === 'all' ? null : mapWarehouseFilter,
    });
  }, [netMapOpen, allWarehouses, retailers, refWh, rawRegions, mapRegionFilter, mapWarehouseFilter]);

  const [deactivatingWarehouse, setDeactivatingWarehouse] = useState<Warehouse | null>(null);

  const handleConfirmDeactivate = async (reason: string) => {
    if (!deactivatingWarehouse) return;
    try {
      await updateWarehouseStatus.mutateAsync({
        code: deactivatingWarehouse.code,
        isActive: false,
      });
      toast.show(
        `Đã vô hiệu hóa kho ${deactivatingWarehouse.code}. Lý do: ${reason}`,
      );
    } catch (e) {
      toast.error(e);
    } finally {
      setDeactivatingWarehouse(null);
    }
  };

  const handleToggleWarehouseStatus = async (w: Warehouse) => {
    if (w.status === 'Active') {
      setDeactivatingWarehouse(w);
      return;
    }
    try {
      await updateWarehouseStatus.mutateAsync({ code: w.code, isActive: true });
      toast.show(`Đã kích hoạt lại kho ${w.code}.`);
    } catch (e) {
      toast.error(e);
    }
  };

  const handleCreateRegion = async () => {
    if (!regionCode.trim() || !regionName.trim()) {
      setCreateError('Mã vùng và Tên vùng là bắt buộc.');
      return;
    }
    setCreateError(null);
    try {
      await createRegion.mutateAsync({
        code: regionCode.trim().toUpperCase(),
        name: regionName.trim(),
        description: regionDesc.trim() || undefined,
      });
      toast.show(`Đã tạo vùng hoạt động "${regionName.trim()}" thành công.`);
      setRegionCode('');
      setRegionName('');
      setRegionDesc('');
      setCreateModalOpen(false);
    } catch (e) {
      toast.error(e);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const openMapWithSelection = (regionId = 'all', whCode = 'all') => {
    setMapRegionFilter(regionId);
    setMapWarehouseFilter(whCode);
    setNetMapOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Quản lý kho"
        subtitle="Mô hình Vùng hoạt động → Kho thuộc vùng · Quản lý cơ sở hạ tầng lưu trữ và phân phối"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button onClick={() => openMapWithSelection('all', 'all')}>
              Bản đồ mạng lưới kho
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={() => setCreateModalOpen(true)}
              >
                + Thêm vùng hoạt động
              </Button>
            )}
          </div>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            {
              key: 'regions',
              label: 'Vùng hoạt động',
              count: sortedRegions.length,
            },
            {
              key: 'all-whs',
              label: 'Danh sách kho',
              count: sortedWarehouses.length,
            },
          ]}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab as 'regions' | 'all-whs')}
        />
      </div>

      {activeTab === 'regions' ? (
        <DataTable
          key="regions"
          stateKey="regions"
          title="Danh sách vùng hoạt động"
          rows={sortedRegions}
          loading={regionsQuery.isLoading}
          error={regionsQuery.error}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/whs/regions/${r.id}`)}
          searchPlaceholder="Mã, tên vùng, mô tả…"
          actions={
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Sắp xếp:
                </span>
                <Select
                  value={regionSortOrder}
                  onChange={(e) => setRegionSortOrder(e.target.value as SortOrder)}
                  options={[
                    { value: 'desc', label: 'Mới nhất trước (DESC)' },
                    { value: 'asc', label: 'Cũ nhất trước (ASC)' },
                  ]}
                  style={{ width: 190 }}
                />
              </div>
              {isAdmin && (
                <Button
                  variant="primary"
                  onClick={() => setCreateModalOpen(true)}
                >
                  + Thêm vùng hoạt động
                </Button>
              )}
            </div>
          }
          columns={[
            {
              key: 'code',
              header: 'Mã vùng',
              width: '120px',
              render: (r) => <b style={{ color: '#1B254B' }}>{r.code}</b>,
              text: (r) => r.code,
            },
            {
              key: 'name',
              header: 'Tên vùng hoạt động',
              render: (r) => (
                <div>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{r.name}</span>
                </div>
              ),
              text: (r) => r.name,
            },
            {
              key: 'description',
              header: 'Mô tả',
              render: (r) => (
                <span style={{ color: '#64748B' }}>
                  {r.description || '—'}
                </span>
              ),
              text: (r) => r.description || '',
            },
            {
              key: 'warehouseCount',
              header: 'Số lượng kho',
              width: '140px',
              render: (r) => (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: (r.warehouseCount ?? 0) > 0 ? '#DEF7EC' : '#F1F5F9',
                    color: (r.warehouseCount ?? 0) > 0 ? '#03543F' : '#64748B',
                    border: `1px solid ${(r.warehouseCount ?? 0) > 0 ? '#BCF0DA' : '#E2E8F0'}`,
                  }}
                >
                  {r.warehouseCount ?? 0} kho
                </span>
              ),
              text: (r) => `${r.warehouseCount ?? 0}`,
            },
            {
              key: 'createdAt',
              header: 'Thời gian tạo',
              width: '150px',
              render: (r) => (
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {formatDate(r.createdAt)}
                </span>
              ),
              text: (r) => formatDate(r.createdAt),
            },
            {
              key: 'status',
              header: 'Trạng thái',
              width: '120px',
              render: (r) => (
                <StatusChip
                  domain="active"
                  value={r.isActive ? 'Active' : 'Paused'}
                />
              ),
              text: (r) => (r.isActive ? 'Hoạt động' : 'Tạm ngừng'),
            },
          ]}
          rowActionsWidth="135px"
          rowActionHeader="Thao tác"
          rowActions={(r) => {
            const dropdownItems: ActionDropdownItem[] = [
              {
                key: 'map',
                label: 'Xem trên bản đồ',
                icon: <MapPin size={14} style={{ color: '#0284C7' }} />,
                color: '#0284C7',
                onClick: () => openMapWithSelection(r.id, 'all'),
                title: 'Xem bản đồ vùng này',
              },
            ];

            return (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'flex-end',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => navigate(`/whs/regions/${r.id}`)}
                  title="Xem danh sách kho thuộc vùng"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    height: 30,
                  }}
                >
                  <Eye size={14} />
                  <span>Xem</span>
                </Button>

                {dropdownItems.length > 0 && (
                  <ActionDropdown items={dropdownItems} />
                )}
              </div>
            );
          }}
        />
      ) : (
        <DataTable
          key="warehouses"
          stateKey="warehouses"
          title="Danh sách kho"
          rows={sortedWarehouses}
          loading={warehousesQuery.isLoading}
          error={warehousesQuery.error}
          rowKey={(w) => w.code}
          onRowClick={(w) => navigate(`/whs/${w.code}`)}
          searchPlaceholder="Mã, tên kho, địa chỉ…"
          actions={
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Sắp xếp:
                </span>
                <Select
                  value={whSortOrder}
                  onChange={(e) => setWhSortOrder(e.target.value as SortOrder)}
                  options={[
                    { value: 'desc', label: 'Mới nhất trước (DESC)' },
                    { value: 'asc', label: 'Cũ nhất trước (ASC)' },
                  ]}
                  style={{ width: 190 }}
                />
              </div>
              {isAdmin && (
                <Button
                  variant="primary"
                  onClick={() => navigate('/whs/new')}
                >
                  + Thêm kho
                </Button>
              )}
            </div>
          }
          columns={[
            {
              key: 'code',
              header: 'Mã kho',
              width: '100px',
              render: (w) => <b style={{ color: '#1B254B' }}>{w.code}</b>,
              text: (w) => w.code,
            },
            {
              key: 'name',
              header: 'Tên kho',
              render: (w) => <span style={{ fontWeight: 500 }}>{w.name}</span>,
              text: (w) => w.name,
            },
            {
              key: 'region',
              header: 'Vùng hoạt động',
              width: '140px',
              render: (w) => {
                const reg = rawRegions.find((r) => r.id === w.regionId);
                return (
                  <span style={{ color: '#334155', fontWeight: 500 }}>
                    {reg ? reg.name : '—'}
                  </span>
                );
              },
              text: (w) => {
                const reg = rawRegions.find((r) => r.id === w.regionId);
                return reg?.name || '';
              },
            },
            {
              key: 'address',
              header: 'Địa chỉ',
              render: (w) => w.address,
              text: (w) => w.address,
            },
            {
              key: 'coord',
              header: 'Tọa độ',
              width: '140px',
              render: (w) =>
                w.lat && w.lng ? `${w.lat}, ${w.lng}` : '[lat, lng]',
              text: (w) => `${w.lat}, ${w.lng}`,
            },
            {
              key: 'keeperName',
              header: 'Thủ kho',
              width: '140px',
              render: (w) => w.keeperName || '— Chưa gán',
              text: (w) => w.keeperName || '',
            },
            {
              key: 'minStock',
              header: 'Tồn tối thiểu',
              width: '120px',
              render: (w) => `${w.minStock ?? 30} thùng`,
              text: (w) => `${w.minStock ?? 30}`,
            },
            {
              key: 'createdAt',
              header: 'Ngày tạo',
              width: '150px',
              render: (w) => (
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {formatDate(w.createdAt)}
                </span>
              ),
              text: (w) => formatDate(w.createdAt),
            },
            {
              key: 'status',
              header: 'Trạng thái',
              width: '120px',
              render: (w) => <StatusChip domain="active" value={w.status} />,
              text: (w) => statusLabels.active[w.status] ?? w.status,
            },
          ]}
          rowActionsWidth="135px"
          rowActionHeader="Thao tác"
          rowActions={(w) => {
            const dropdownItems: ActionDropdownItem[] = [
              {
                key: 'map',
                label: 'Xem trên bản đồ',
                icon: <MapPin size={14} style={{ color: '#0284C7' }} />,
                color: '#0284C7',
                onClick: () => openMapWithSelection(w.regionId || 'all', w.code),
                title: 'Xem kho này trên bản đồ',
              },
            ];

            if (isAdmin) {
              dropdownItems.push({
                key: 'edit',
                label: 'Chỉnh sửa',
                icon: <Pencil size={14} style={{ color: '#1D4ED8' }} />,
                color: '#1D4ED8',
                onClick: () => navigate(`/whs/${w.code}/edit`),
                title: 'Chỉnh sửa thông tin kho',
              });

              if (w.status === 'Active') {
                dropdownItems.push({
                  key: 'deactivate',
                  label: 'Ngừng hoạt động',
                  icon: <Pause size={14} style={{ color: '#C2410C' }} />,
                  color: '#C2410C',
                  onClick: () => handleToggleWarehouseStatus(w),
                  title: 'Vô hiệu hóa kho',
                });
              } else {
                dropdownItems.push({
                  key: 'reactivate',
                  label: 'Kích hoạt lại',
                  icon: <Play size={14} style={{ color: '#15803D' }} />,
                  color: '#15803D',
                  onClick: () => handleToggleWarehouseStatus(w),
                  title: 'Kích hoạt lại kho',
                });
              }
            }

            return (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'flex-end',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => navigate(`/whs/${w.code}`)}
                  title="Xem chi tiết kho"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    height: 30,
                  }}
                >
                  <Eye size={14} />
                  <span>Xem</span>
                </Button>

                {dropdownItems.length > 0 && (
                  <ActionDropdown items={dropdownItems} />
                )}
              </div>
            );
          }}
        />
      )}

      {/* Modal: Tạo vùng hoạt động mới */}
      <Modal
        open={createModalOpen}
        title="Tạo vùng hoạt động mới"
        subtitle="Vùng hoạt động quản lý mạng lưới các kho trực thuộc trong khu vực"
        width={560}
        onClose={() => setCreateModalOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
            <Button
              variant="primary"
              disabled={createRegion.isPending}
              onClick={handleCreateRegion}
            >
              {createRegion.isPending ? 'Đang tạo…' : 'Tạo vùng hoạt động'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {createError && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: '#FEE2E2',
                color: '#B91C1C',
                fontSize: 13,
              }}
            >
              {createError}
            </div>
          )}
          <FormField label="Mã vùng hoạt động *" required>
            <Input
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="Ví dụ: MB, MT, MN, HCM-EAST"
              autoFocus
            />
          </FormField>
          <FormField label="Tên vùng hoạt động *" required>
            <Input
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="Ví dụ: Khu vực Miền Nam, TP. Thủ Đức"
            />
          </FormField>
          <FormField label="Mô tả">
            <TextArea
              value={regionDesc}
              onChange={(e) => setRegionDesc(e.target.value)}
              placeholder="Mô tả phạm vi của vùng hoạt động…"
              rows={3}
            />
          </FormField>
        </div>
      </Modal>

      {/* Modal: Bản đồ mạng lưới kho */}
      <Modal
        open={netMapOpen}
        title="Bản đồ mạng lưới kho"
        subtitle="Vòng tròn = bán kính phục vụ 20 km quanh từng kho"
        width={1120}
        onClose={() => setNetMapOpen(false)}
        footer={<Button onClick={() => setNetMapOpen(false)}>Đóng</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              padding: '10px 14px',
              background: '#F8FAFC',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                Vùng hoạt động:
              </label>
              <Select
                value={mapRegionFilter}
                onChange={(e) => {
                  setMapRegionFilter(e.target.value);
                  setMapWarehouseFilter('all');
                }}
                options={[
                  { value: 'all', label: 'Tất cả vùng hoạt động' },
                  ...rawRegions.map((r) => ({
                    value: r.id,
                    label: `${r.name} (${r.code})`,
                  })),
                ]}
                style={{ minWidth: 220 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                Kho:
              </label>
              <Select
                value={mapWarehouseFilter}
                onChange={(e) => setMapWarehouseFilter(e.target.value)}
                options={[
                  { value: 'all', label: mapRegionFilter === 'all' ? 'Tất cả kho' : 'Tất cả kho trong vùng' },
                  ...mapWarehouseOptions.map((w) => ({
                    value: w.code,
                    label: `${w.code} · ${w.name}`,
                  })),
                ]}
                style={{ minWidth: 240 }}
              />
            </div>
          </div>

          <iframe
            title="Bản đồ mạng lưới kho"
            srcDoc={netMapDoc}
            style={{
              width: '100%',
              height: 600,
              border: '1px solid #E2E8F0',
              borderRadius: 8,
            }}
          />
        </div>
      </Modal>

      {/* Modal: Xác nhận vô hiệu hóa kho */}
      <DeactivateWarehouseModal
        warehouse={deactivatingWarehouse}
        open={Boolean(deactivatingWarehouse)}
        onClose={() => setDeactivatingWarehouse(null)}
        onConfirm={handleConfirmDeactivate}
        loading={updateWarehouseStatus.isPending}
      />
    </>
  );
}
