import { useMemo, useState } from 'react';
import { Eye, MapPin, Pause, Pencil, Play } from 'lucide-react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { statusLabels } from '@/shared/lib';
import {
  ActionDropdown,
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  StatusChip,
  useToast,
  type ActionDropdownItem,
} from '@/shared/ui';
import { buildWarehouseMapDoc } from '../components/warehouseMap';
import { DeactivateWarehouseModal } from '../components/DeactivateWarehouseModal';
import {
  useRegions,
  useRetailerMapPoints,
  useUpdateRegionStatus,
  useUpdateWarehouseStatus,
  useWarehouses,
} from '../hooks';
import type { MapPoint, SortOrder, Warehouse } from '../types';

export function RegionWarehousesPage() {
  const { regionId = '' } = useParams<{ regionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [netMapOpen, setNetMapOpen] = useState(false);
  const [mapWarehouseFilter, setMapWarehouseFilter] = useState<string>('all');

  const regionsQuery = useRegions();
  const warehousesQuery = useWarehouses();
  const { data: retailers = [] } = useRetailerMapPoints(netMapOpen);
  const updateRegionStatus = useUpdateRegionStatus();
  const updateWarehouseStatus = useUpdateWarehouseStatus();

  const region = useMemo(() => {
    return (regionsQuery.data ?? []).find((r) => r.id === regionId);
  }, [regionsQuery.data, regionId]);

  const regionWarehouses = useMemo(() => {
    return (warehousesQuery.data ?? []).filter((w) => w.regionId === regionId);
  }, [warehousesQuery.data, regionId]);

  const sortedWarehouses = useMemo(() => {
    return [...regionWarehouses].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [regionWarehouses, sortOrder]);

  const refWh = useMemo(() => {
    if (mapWarehouseFilter !== 'all') {
      const matched = regionWarehouses.find((w) => w.code === mapWarehouseFilter && w.lat);
      if (matched) return matched;
    }
    return regionWarehouses.find((w) => w.lat) ?? regionWarehouses[0];
  }, [regionWarehouses, mapWarehouseFilter]);

  const netMapDoc = useMemo(() => {
    if (!netMapOpen || !region) return '';
    const allWh = warehousesQuery.data ?? [];
    const points: MapPoint[] = [
      ...allWh.map((w) => {
        const reg = (regionsQuery.data ?? []).find((r) => r.id === w.regionId);
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
      zoom: 12,
      selectedRegionId: region.id,
      selectedWarehouseCode: mapWarehouseFilter === 'all' ? null : mapWarehouseFilter,
    });
  }, [netMapOpen, region, warehousesQuery.data, regionsQuery.data, retailers, refWh, mapWarehouseFilter]);

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

  const handleToggleRegionStatus = async () => {
    if (!region) return;
    try {
      const nextActive = !region.isActive;
      await updateRegionStatus.mutateAsync({ id: region.id, isActive: nextActive });
      toast.show(
        nextActive
          ? `Đã kích hoạt lại vùng ${region.name}.`
          : `Đã tạm ngừng vùng ${region.name}.`,
      );
    } catch (e) {
      toast.error(e);
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

  if (regionsQuery.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
        Đang tải thông tin vùng hoạt động…
      </div>
    );
  }

  if (!region) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState
          title="Không tìm thấy vùng hoạt động"
          description={`Vùng hoạt động có mã định danh "${regionId}" không tồn tại hoặc đã bị xóa.`}
          action={
            <Button variant="primary" onClick={() => navigate('/whs')}>
              ← Quay lại danh sách vùng hoạt động
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        back="/whs"
        title={`Vùng hoạt động: ${region.name}`}
        subtitle={`Mã vùng: ${region.code} · ${regionWarehouses.length} kho trực thuộc`}
        chips={
          <StatusChip
            domain="active"
            value={region.isActive ? 'Active' : 'Paused'}
          />
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => {
                setMapWarehouseFilter('all');
                setNetMapOpen(true);
              }}
            >
              Bản đồ vùng hoạt động
            </Button>
            {isAdmin && (
              <>
                {!region.isActive && (
                  <Button
                    variant="primary"
                    disabled={updateRegionStatus.isPending}
                    onClick={handleToggleRegionStatus}
                  >
                    Kích hoạt vùng
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => navigate(`/whs/new?regionId=${region.id}`)}
                >
                  + Thêm kho vào vùng
                </Button>
              </>
            )}
          </div>
        }
      />

      {region.description && (
        <Card style={{ marginBottom: 16, padding: '12px 16px', background: '#F8FAFC' }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <strong style={{ color: '#1E293B' }}>Mô tả vùng:</strong> {region.description}
          </div>
        </Card>
      )}

      <DataTable
        title={`Danh sách kho thuộc vùng ${region.name}`}
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
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
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
                onClick={() => navigate(`/whs/new?regionId=${region.id}`)}
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
            width: '110px',
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
            key: 'address',
            header: 'Địa chỉ',
            render: (w) => w.address,
            text: (w) => w.address,
          },
          {
            key: 'coord',
            header: 'Tọa độ',
            width: '140px',
            render: (w) => (w.lat && w.lng ? `${w.lat}, ${w.lng}` : '[lat, lng]'),
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
            width: '130px',
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
              onClick: () => {
                setMapWarehouseFilter(w.code);
                setNetMapOpen(true);
              },
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

      {/* Modal: Bản đồ mạng lưới kho vùng hoạt động */}
      <Modal
        open={netMapOpen}
        title={`Bản đồ mạng lưới kho · Vùng ${region.name}`}
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
              Vùng: <span style={{ color: '#059669' }}>{region.name} ({region.code})</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                Kho:
              </label>
              <Select
                value={mapWarehouseFilter}
                onChange={(e) => setMapWarehouseFilter(e.target.value)}
                options={[
                  { value: 'all', label: `Tất cả kho trong vùng (${regionWarehouses.length})` },
                  ...regionWarehouses.map((w) => ({
                    value: w.code,
                    label: `${w.code} · ${w.name}`,
                  })),
                ]}
                style={{ minWidth: 260 }}
              />
            </div>
          </div>

          <iframe
            title={`Bản đồ kho vùng ${region.name}`}
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
