import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { statusLabels } from '@/shared/lib';
import {
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
} from '@/shared/ui';
import { buildWarehouseMapDoc } from '../components/warehouseMap';
import {
  useCreateRegion,
  useRegions,
  useRetailerMapPoints,
  useUpdateRegionStatus,
  useUpdateWarehouseStatus,
  useWarehouses,
} from '../hooks';
import type { MapPoint, SortOrder, Warehouse, WarehouseRegion } from '../types';

export function WarehousesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'regions' | 'all-whs'>('regions');
  const [regionSortOrder, setRegionSortOrder] = useState<SortOrder>('desc');
  const [whSortOrder, setWhSortOrder] = useState<SortOrder>('desc');

  // Modal create region state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [regionDesc, setRegionDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Network map modal state
  const [netMapOpen, setNetMapOpen] = useState(false);

  // Queries & Mutations
  const regionsQuery = useRegions();
  const warehousesQuery = useWarehouses();
  const { data: retailers = [] } = useRetailerMapPoints(netMapOpen);
  const createRegion = useCreateRegion();
  const updateRegionStatus = useUpdateRegionStatus();
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

  const refWh = useMemo(
    () => allWarehouses.find((w) => w.code === 'WH-TA') ?? allWarehouses[0],
    [allWarehouses],
  );

  const netMapDoc = useMemo(() => {
    if (!netMapOpen) return '';
    const points: MapPoint[] = [
      ...allWarehouses.map((w) => ({
        lat: w.lat || 10.87,
        lng: w.lng || 106.65,
        kind: 'wh' as const,
        label: `${w.code} · ${w.name}`,
        sub: w.address,
      })),
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
    });
  }, [netMapOpen, allWarehouses, retailers, refWh]);

  const handleToggleRegionStatus = async (r: WarehouseRegion) => {
    try {
      const nextActive = !r.isActive;
      await updateRegionStatus.mutateAsync({ id: r.id, isActive: nextActive });
      toast.show(
        nextActive
          ? `Đã kích hoạt lại vùng ${r.name}.`
          : `Đã tạm ngừng vùng ${r.name}.`,
      );
    } catch (e) {
      toast.error(e);
    }
  };

  const handleToggleWarehouseStatus = async (w: Warehouse) => {
    try {
      const nextActive = w.status !== 'Active';
      await updateWarehouseStatus.mutateAsync({ code: w.code, isActive: nextActive });
      toast.show(
        nextActive
          ? `Đã kích hoạt lại kho ${w.code}.`
          : `Đã vô hiệu hóa kho ${w.code}. Kho không còn được chọn khi phân bổ đơn mới.`,
      );
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
      toast.show(`Đã tạo vùng kho "${regionName.trim()}" thành công.`);
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

  return (
    <>
      <PageHeader
        title="Quản lý kho"
        subtitle="Mô hình Vùng kho → Kho thuộc vùng · Quản lý cơ sở hạ tầng lưu trữ và phân phối"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button onClick={() => setNetMapOpen(true)}>
              Bản đồ mạng lưới kho
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={() => setCreateModalOpen(true)}
              >
                + Thêm vùng kho
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
              label: 'Vùng kho',
              count: sortedRegions.length,
            },
            {
              key: 'all-whs',
              label: 'Tất cả kho',
              count: sortedWarehouses.length,
            },
          ]}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab as 'regions' | 'all-whs')}
        />
      </div>

      {activeTab === 'regions' ? (
        <DataTable
          title="Danh sách vùng kho"
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
                  + Thêm vùng kho
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
              header: 'Tên vùng kho',
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
          rowActionsWidth="240px"
          rowActions={(r) => (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate(`/whs/regions/${r.id}`)}
              >
                Xem danh sách kho
              </Button>
              {isAdmin && (
                r.isActive ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={updateRegionStatus.isPending}
                    onClick={() => handleToggleRegionStatus(r)}
                  >
                    Tạm ngừng
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={updateRegionStatus.isPending}
                    onClick={() => handleToggleRegionStatus(r)}
                  >
                    Kích hoạt
                  </Button>
                )
              )}
            </>
          )}
        />
      ) : (
        <DataTable
          title="Tất cả kho"
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
              header: 'Vùng kho',
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
          rowActionsWidth="240px"
          rowActions={(w) => (
            <>
              <Button size="sm" onClick={() => navigate(`/whs/${w.code}`)}>
                Xem
              </Button>
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/whs/${w.code}/edit`)}
                  >
                    Sửa
                  </Button>
                  {w.status === 'Active' ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={updateWarehouseStatus.isPending}
                      onClick={() => handleToggleWarehouseStatus(w)}
                    >
                      Vô hiệu hóa
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateWarehouseStatus.isPending}
                      onClick={() => handleToggleWarehouseStatus(w)}
                    >
                      Kích hoạt lại
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        />
      )}

      {/* Modal: Tạo vùng kho mới */}
      <Modal
        open={createModalOpen}
        title="Tạo vùng kho mới"
        subtitle="Vùng kho quản lý mạng lưới các kho trực thuộc trong khu vực"
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
              {createRegion.isPending ? 'Đang tạo…' : 'Tạo vùng kho'}
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
          <FormField label="Mã vùng kho *" required>
            <Input
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="Ví dụ: MB, MT, MN, HCM-EAST"
              autoFocus
            />
          </FormField>
          <FormField label="Tên vùng kho *" required>
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
              placeholder="Mô tả phạm vi hoạt động của vùng kho…"
              rows={3}
            />
          </FormField>
        </div>
      </Modal>

      {/* Modal: Bản đồ mạng lưới kho */}
      <Modal
        open={netMapOpen}
        title="Bản đồ mạng lưới kho & điểm bán"
        subtitle={`${allWarehouses.length} kho · ${retailers.length} retailer · vòng tròn = bán kính phục vụ 20 km tính từ ${refWh?.name ?? 'Kho Thới An'}`}
        width={1100}
        onClose={() => setNetMapOpen(false)}
        footer={<Button onClick={() => setNetMapOpen(false)}>Đóng</Button>}
      >
        <iframe
          title="Bản đồ mạng lưới kho"
          srcDoc={netMapDoc}
          style={{
            width: '100%',
            height: 640,
            border: '1px solid #E2E5E0',
            borderRadius: 8,
          }}
        />
      </Modal>
    </>
  );
}
