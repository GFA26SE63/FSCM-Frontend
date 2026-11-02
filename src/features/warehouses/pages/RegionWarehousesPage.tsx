import { useMemo, useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { statusLabels } from '@/shared/lib';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Select,
  StatusChip,
  useToast,
} from '@/shared/ui';
import {
  useRegions,
  useUpdateRegionStatus,
  useUpdateWarehouseStatus,
  useWarehouses,
} from '../hooks';
import type { SortOrder, Warehouse } from '../types';

export function RegionWarehousesPage() {
  const { regionId = '' } = useParams<{ regionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const regionsQuery = useRegions();
  const warehousesQuery = useWarehouses();
  const updateRegionStatus = useUpdateRegionStatus();
  const updateWarehouseStatus = useUpdateWarehouseStatus();

  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
        Đang tải thông tin vùng kho…
      </div>
    );
  }

  if (!region) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState
          title="Không tìm thấy vùng kho"
          description={`Vùng kho có mã định danh "${regionId}" không tồn tại hoặc đã bị xóa.`}
          action={
            <Button variant="primary" onClick={() => navigate('/whs')}>
              ← Quay lại danh sách vùng kho
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
        title={`Vùng kho: ${region.name}`}
        subtitle={`Mã vùng: ${region.code} · ${regionWarehouses.length} kho trực thuộc`}
        chips={
          <StatusChip
            domain="active"
            value={region.isActive ? 'Active' : 'Paused'}
          />
        }
        actions={
          isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              {region.isActive ? (
                <Button
                  variant="danger"
                  disabled={updateRegionStatus.isPending}
                  onClick={handleToggleRegionStatus}
                >
                  Tạm ngừng vùng
                </Button>
              ) : (
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
            </div>
          )
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
                    Kích hoạt
                  </Button>
                )}
              </>
            )}
          </>
        )}
      />
    </>
  );
}
