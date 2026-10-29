import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { statusLabels } from '@/shared/lib';
import {
  Button,
  DataTable,
  Modal,
  StatusChip,
  useToast,
} from '@/shared/ui';
import { WarehouseDialog } from '../components/WarehouseDialog';
import { buildWarehouseMapDoc } from '../components/warehouseMap';
import {
  useRetailerMapPoints,
  useUpdateWarehouseStatus,
  useWarehouses,
} from '../hooks';
import type { MapPoint, Warehouse } from '../types';

export function WarehousesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const query = useWarehouses();
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const [dialog, setDialog] = useState<{ open: boolean; wh: Warehouse | null }>({
    open: false,
    wh: null,
  });
  const [netMapOpen, setNetMapOpen] = useState(false);

  const { data: retailers = [] } = useRetailerMapPoints(netMapOpen);
  const updateStatus = useUpdateWarehouseStatus();
  const toast = useToast();
  const navigate = useNavigate();

  const refWh = useMemo(
    () => rows.find((w) => w.code === 'WH-TA') ?? rows[0],
    [rows],
  );

  const netMapDoc = useMemo(() => {
    if (!netMapOpen) return '';
    const points: MapPoint[] = [
      ...rows.map((w) => ({
        lat: w.lat || 10.87,
        lng: w.lng || 106.65,
        kind: (w.type === 'Central' ? 'central' : 'wh') as MapPoint['kind'],
        label: `${w.code} · ${w.name}`,
        sub: `${w.address} · ${w.type === 'Central' ? 'Kho tổng' : 'Kho vùng'}`,
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
  }, [netMapOpen, rows, retailers, refWh]);

  const handleToggleStatus = async (w: Warehouse) => {
    try {
      const nextActive = w.status !== 'Active';
      await updateStatus.mutateAsync({ code: w.code, isActive: nextActive });
      if (!nextActive) {
        toast.show(
          `Đã vô hiệu hóa kho ${w.code}. Kho không còn được chọn khi phân bổ đơn mới.`,
        );
      } else {
        toast.show(`Đã kích hoạt lại kho ${w.code}.`);
      }
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <>
      <DataTable
        title="Kho"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(w) => w.code}
        onRowClick={(w) => navigate(`/whs/${w.code}`)}
        searchPlaceholder="Mã, tên kho…"
        filters={[
          {
            label: 'Loại kho',
            options: ['Tất cả', 'Kho tổng', 'Kho vùng'],
            value: (w) => statusLabels.warehouseType[w.type] ?? w.type,
          },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button onClick={() => setNetMapOpen(true)}>
              Bản đồ mạng lưới kho
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={() => setDialog({ open: true, wh: null })}
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
            render: (w) => <b>{w.code}</b>,
            text: (w) => w.code,
          },
          {
            key: 'name',
            header: 'Tên kho',
            render: (w) => w.name,
            text: (w) => w.name,
          },
          {
            key: 'type',
            header: 'Loại kho',
            width: '120px',
            render: (w) => <StatusChip domain="warehouseType" value={w.type} />,
            text: (w) => statusLabels.warehouseType[w.type] ?? w.type,
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
            width: '150px',
            render: (w) =>
              w.lat && w.lng ? `${w.lat}, ${w.lng}` : '[lat, lng]',
            text: (w) => `${w.lat}, ${w.lng}`,
          },
          {
            key: 'keeperName',
            header: 'Thủ kho',
            width: '150px',
            render: (w) => w.keeperName || '— Chưa gán',
            text: (w) => w.keeperName || '',
          },
          {
            key: 'minStock',
            header: 'Tồn tối thiểu',
            width: '140px',
            render: (w) => `${w.minStock ?? 30} thùng / SKU`,
            text: (w) => `${w.minStock ?? 30}`,
          },
          {
            key: 'status',
            header: 'Trạng thái',
            width: '120px',
            render: (w) => <StatusChip domain="active" value={w.status} />,
            text: (w) => statusLabels.active[w.status] ?? w.status,
          },
        ]}
        rowActionsWidth="250px"
        rowActions={(w) => (
          <>
            <Button size="sm" onClick={() => navigate(`/whs/${w.code}`)}>
              Xem
            </Button>
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  onClick={() => setDialog({ open: true, wh: w })}
                >
                  Sửa
                </Button>
                {w.status === 'Active' ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={updateStatus.isPending}
                    onClick={() => handleToggleStatus(w)}
                  >
                    Vô hiệu hóa
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={updateStatus.isPending}
                    onClick={() => handleToggleStatus(w)}
                  >
                    Kích hoạt lại
                  </Button>
                )}
              </>
            )}
          </>
        )}
      />

      <WarehouseDialog
        open={dialog.open}
        warehouse={dialog.wh}
        onClose={() => setDialog({ open: false, wh: null })}
      />

      <Modal
        open={netMapOpen}
        title="Bản đồ mạng lưới kho & điểm bán"
        subtitle={`${rows.length} kho · ${retailers.length} retailer · vòng tròn = bán kính phục vụ 20 km tính từ ${refWh?.name ?? 'Kho Thới An'}`}
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
