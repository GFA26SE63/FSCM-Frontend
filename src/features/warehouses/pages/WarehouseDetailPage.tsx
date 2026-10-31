import { useMemo, useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatMoney, statusLabels } from '@/shared/lib';
import {
  Button,
  Callout,
  Card,
  Chip,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
  useToast,
} from '@/shared/ui';
import { WarehouseDialog } from '../components/WarehouseDialog';
import { buildWarehouseMapDoc } from '../components/warehouseMap';
import {
  useRetailerMapPoints,
  useUpdateWarehouseStatus,
  useWarehouse,
  useWarehouses,
} from '../hooks';
import type { MapPoint } from '../types';

export function WarehouseDetailPage() {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canViewInventory =
    user?.role === 'Admin' ||
    user?.role === 'Operator' ||
    user?.role === 'WarehouseKeeper';

  const query = useWarehouse(code, canViewInventory);
  const w = query.data;
  const { data: allWarehouses = [] } = useWarehouses();
  const { data: retailers = [] } = useRetailerMapPoints();
  const updateStatus = useUpdateWarehouseStatus();
  const [edit, setEdit] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const lowStockWarnings = useMemo(() => {
    if (!w || !w.inventory?.length) return [];
    const min = w.minStock ?? 30;
    const bySku = new Map<string, number>();
    for (const item of w.inventory) {
      if (item.expiryStatus === 'Expired' || item.expiryStatus === 'Disposed') {
        continue;
      }
      bySku.set(item.sku, (bySku.get(item.sku) ?? 0) + item.available);
    }
    const low: string[] = [];
    bySku.forEach((have, sku) => {
      if (have > 0 && have < min) {
        low.push(`${sku}: còn ${have} thùng (< ${min})`);
      }
    });
    return low;
  }, [w]);

  const mapSrcDoc = useMemo(() => {
    if (!w) return '';
    const dmax = w.dmaxRetailerKm ?? 20;
    const points: MapPoint[] = [
      {
        lat: w.lat || 10.87,
        lng: w.lng || 106.65,
        kind: w.type === 'Central' ? 'central' : 'wh',
        label: `${w.code} · ${w.name}`,
        sub: w.address,
      },
      ...allWarehouses
        .filter((x) => x.code !== w.code)
        .map((x) => ({
          lat: x.lat || 10.87,
          lng: x.lng || 106.65,
          kind: (x.type === 'Central' ? 'central' : 'wh') as MapPoint['kind'],
          label: `${x.code} · ${x.name}`,
          sub: x.address,
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
      center: [w.lat || 10.87, w.lng || 106.65],
      points,
      radiusKm: dmax,
      zoom: 12,
    });
  }, [w, allWarehouses, retailers]);

  const handleToggleStatus = async (codeTarget: string, curStatus: 'Active' | 'Paused') => {
    try {
      const nextActive = curStatus !== 'Active';
      await updateStatus.mutateAsync({ code: codeTarget, isActive: nextActive });
      if (!nextActive) {
        toast.show(
          `Đã vô hiệu hóa kho ${codeTarget}. Kho không còn được chọn khi phân bổ đơn mới.`,
        );
      } else {
        toast.show(`Đã kích hoạt lại kho ${codeTarget}.`);
      }
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <QueryState query={query}>
      {(wh) => {
        const dmax = wh.dmaxRetailerKm ?? 20;
        const transitVer = wh.transitTableVersion ?? 1;
        return (
          <>
            <PageHeader
              back="/whs"
              title={`${wh.code} · ${wh.name}`}
              chips={<StatusChip domain="active" value={wh.status} />}
              actions={
                isAdmin ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={() => setEdit(true)}>Sửa</Button>
                    {wh.status === 'Active' ? (
                      <Button
                        variant="danger"
                        disabled={updateStatus.isPending}
                        onClick={() => handleToggleStatus(wh.code, wh.status)}
                      >
                        Vô hiệu hóa
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={updateStatus.isPending}
                        onClick={() => handleToggleStatus(wh.code, wh.status)}
                      >
                        Kích hoạt lại
                      </Button>
                    )}
                  </div>
                ) : undefined
              }
            />

            <Card>
              <Fields
                cols={2}
                items={[
                  { label: 'Mã kho', value: wh.code },
                  { label: 'Tên kho', value: wh.name },
                  { label: 'Loại kho', value: statusLabels.warehouseType[wh.type] ?? wh.type },
                  { label: 'Địa chỉ', value: wh.address },
                  {
                    label: 'Tọa độ',
                    value: wh.lat && wh.lng ? `${wh.lat}, ${wh.lng}` : '[lat, lng]',
                  },
                  { label: 'Thủ kho', value: wh.keeperName || '— Chưa gán' },
                  {
                    label: 'Tồn tối thiểu',
                    value: `${wh.minStock ?? 30} thùng / SKU – cảnh báo khi có thể cấp thấp hơn`,
                  },
                  {
                    label: 'Số batch đang có',
                    value: `${wh.batchCount} batch (${wh.capacityPallets} pallet)`,
                  },
                ]}
              />
              {lowStockWarnings.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <Callout tone="warn">
                    <strong>Dưới tồn tối thiểu: </strong>
                    {lowStockWarnings.join(' · ')} – cần nhập bổ sung.
                  </Callout>
                </div>
              )}
            </Card>

            <Card title={`Bản đồ vị trí kho · vòng tròn bán kính phục vụ ${dmax} km`}>
              <iframe
                title="Bản đồ"
                srcDoc={mapSrcDoc}
                style={{
                  width: '100%',
                  height: 380,
                  border: '1px solid #E2E5E0',
                  borderRadius: 8,
                }}
              />
            </Card>

            <Card
              title={`Khoảng cách đường bộ tới retailer (Dijkstra) · Bảng vận chuyển v${transitVer}`}
              flush
            >
              <SimpleTable
                rows={wh.retailerDistances}
                empty="Chưa có dữ liệu khoảng cách tới điểm bán."
                columns={[
                  {
                    header: 'Retailer',
                    cell: (r) => `${r.retailerCode} · ${r.retailerName}`,
                  },
                  {
                    header: 'Khoảng cách',
                    cell: (r) => `${r.km.toFixed(1)} km`,
                  },
                  {
                    header: 'Thời gian giao',
                    cell: (r) => (r.transitDays ? `${r.transitDays} ngày` : '—'),
                  },
                  {
                    header: 'Chi phí giao ước tính',
                    cell: (r) =>
                      r.estimatedCost ? formatMoney(r.estimatedCost) : '—',
                  },
                  {
                    header: `Trong bán kính ${dmax} km`,
                    cell: (r) => (
                      <Chip tone={r.withinRange ? 'ok' : 'neutral'}>
                        {r.withinRange ? 'Trong phạm vi' : 'Ngoài bán kính'}
                      </Chip>
                    ),
                  },
                ]}
              />
            </Card>

            {canViewInventory && wh.inventory && wh.inventory.length > 0 && (
              <Card title={`Tồn kho theo batch tại kho (${wh.inventory.length} batch)`} flush>
                <SimpleTable
                  rows={wh.inventory}
                  columns={[
                    {
                      header: 'Mã batch',
                      cell: (b) => (
                        <a
                          href={`/batches/${b.code}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/batches/${b.code}`);
                          }}
                        >
                          <b>{b.code}</b>
                        </a>
                      ),
                    },
                    { header: 'SKU', cell: (b) => b.sku },
                    { header: 'Sản phẩm', cell: (b) => b.productName },
                    { header: 'HSD', cell: (b) => b.expiry },
                    { header: 'Tồn thực tế', align: 'right', cell: (b) => `${b.onHand} thùng` },
                    { header: 'Đã giữ', align: 'right', cell: (b) => `${b.held} thùng` },
                    {
                      header: 'Có thể cấp',
                      align: 'right',
                      cell: (b) => <b>{b.available} thùng</b>,
                    },
                    {
                      header: 'Trạng thái HSD',
                      cell: (b) =>
                        b.expiryStatus ? (
                          <StatusChip domain="expiry" value={b.expiryStatus} />
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                />
              </Card>
            )}

            <WarehouseDialog
              open={edit}
              warehouse={wh}
              onClose={() => setEdit(false)}
            />
          </>
        );
      }}
    </QueryState>
  );
}
